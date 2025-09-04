import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BATCH_SIZE = 200;
const CEILING = 470;

interface BatchRequest {
  id: string;
  printing?: string;
  condition?: string;
}

interface JustTCGCard {
  id: string;
  cardId?: string;
  variants?: JustTCGVariant[];
  data?: JustTCGVariant[];
}

interface JustTCGVariant {
  id: string;
  condition: string;
  printing: string;
  price?: number;
  market?: number;
  market_price?: number;
  low_price?: number;
  low?: number;
  high_price?: number;
  high?: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJustTcgBatch(
  cardIds: string[],
  apiKey: string,
  opts: { printing?: string; condition?: string } = {}
): Promise<JustTCGCard[]> {
  const maxRetries = 5;
  let attempt = 0;
  
  // Build request body as array of objects with id, printing, condition
  const body: BatchRequest[] = cardIds.map(id => ({
    id,
    printing: opts.printing ?? 'normal',
    condition: opts.condition ?? 'near_mint'
  }));
  
  while (attempt < maxRetries) {
    try {
      const response = await fetch('https://api.justtcg.com/cards/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(body)
      });

      if (response.status === 429) {
        const backoffMs = Math.min(100 * Math.pow(2, attempt), 5000);
        console.log(`Rate limited, backing off for ${backoffMs}ms (attempt ${attempt + 1})`);
        await sleep(backoffMs);
        attempt++;
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`JustTCG batch non-200 ${response.status}:`, errorText.slice(0, 400));
        return [];
      }

      const raw = await response.json().catch(() => ({}));
      
      // Handle both direct array and { data: [...] } response formats
      const data = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
      
      if (!Array.isArray(data)) {
        console.warn('Unexpected JustTCG payload shape:', JSON.stringify(raw).slice(0, 400));
        return [];
      }
      
      return data as JustTCGCard[];
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries - 1) {
        console.warn('All JustTCG batch attempts failed');
        return [];
      }
      
      const backoffMs = Math.min(100 * Math.pow(2, attempt), 5000);
      await sleep(backoffMs);
      attempt++;
    }
  }
  
  return [];
}

function mapVariantRow(card: JustTCGCard, variant: JustTCGVariant, cardId: string) {
  const toCents = (value: any) => Math.round((Number(value) || 0) * 100);
  
  return {
    card_id: cardId,
    justtcg_variant_id: variant.id,
    condition: String(variant.condition || 'near_mint').toLowerCase(),
    printing: String(variant.printing || 'normal').toLowerCase(),
    price_cents: toCents(variant.price),
    market_price_cents: toCents(variant.market ?? variant.market_price ?? variant.price),
    low_price_cents: toCents(variant.low ?? variant.low_price),
    high_price_cents: toCents(variant.high ?? variant.high_price),
    last_updated: new Date().toISOString()
  };
}

async function writeBatchToDb(supabase: any, cardPayload: JustTCGCard[], cardIdMap: Map<string, string>) {
  let variantsUpdated = 0;
  let cardsProcessed = 0;
  const historyRecords = [];
  
  for (const card of cardPayload) {
    const cardId = cardIdMap.get(card.id || card.cardId || '');
    if (!cardId) continue;
    
    // Get variants from either variants or data array
    const variants = Array.isArray(card.variants) ? card.variants : 
                    (Array.isArray(card.data) ? card.data : []);
    
    if (variants.length === 0) {
      cardsProcessed++;
      continue;
    }
    
    // Map variants to database format
    const variantRows = variants.map(v => mapVariantRow(card, v, cardId));
    
    // Upsert variants using our new RPC
    if (variantRows.length > 0) {
      const { data: upCount, error: upErr } = await supabase.rpc('upsert_variants_from_justtcg', {
        p_rows: variantRows
      });
      
      if (upErr) {
        console.warn('Variant upsert error:', upErr);
      } else {
        variantsUpdated += Number(upCount ?? 0);
      }
      
      // Build price history records
      for (const row of variantRows) {
        historyRecords.push({
          variant_id: row.justtcg_variant_id, // RPC will map this internally
          price_cents: row.price_cents,
          low_price_cents: row.low_price_cents,
          high_price_cents: row.high_price_cents,
          market_price_cents: row.market_price_cents,
          recorded_at: row.last_updated
        });
      }
    }
    
    cardsProcessed++;
  }
  
  // Insert price history
  if (historyRecords.length > 0) {
    const { error: histErr } = await supabase.rpc('insert_variant_price_history', {
      p_records: historyRecords
    });
    if (histErr) {
      console.warn('History insert error:', histErr);
    }
  }
  
  return { variantsUpdated, cardsProcessed };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let jobRunId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const justTCGApiKey = Deno.env.get('JUSTTCG_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Accept game from POST body or URL params
    let game = "";
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        game = body.game || body.gameSlug || "";
      } catch {
        // Fallback to URL params
        const url = new URL(req.url);
        game = url.searchParams.get("game") || "";
      }
    } else {
      const url = new URL(req.url);
      game = url.searchParams.get("game") || "";
    }
    
    if (!["pokemon", "pokemon-japan", "mtg"].includes(game)) {
      return new Response(
        JSON.stringify({ success: false, error: "bad_game" }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Starting variant pricing refresh for game: ${game}`);

    // Fetch all card IDs for this game
    const allCardIds: string[] = [];
    const cardIdMap = new Map<string, string>(); // justtcg_card_id -> card_id
    
    for (let offset = 0; ; offset += BATCH_SIZE) {
      const { data: cardsData, error: cardsError } = await supabase.rpc('fetch_cards_with_variants', {
        p_game: game,
        p_limit: BATCH_SIZE,
        p_offset: offset
      });
      
      if (cardsError) {
        console.error('Error fetching cards:', cardsError);
        throw new Error(`Failed to fetch cards: ${cardsError.message}`);
      }
      
      if (!cardsData || cardsData.length === 0) break;
      
      for (const card of cardsData) {
        if (card.justtcg_card_id) {
          allCardIds.push(card.justtcg_card_id);
          cardIdMap.set(card.justtcg_card_id, card.card_id);
        }
      }
      
      if (cardsData.length < BATCH_SIZE) break;
    }
    
    console.log(`Found ${allCardIds.length} cards with JustTCG IDs`);
    
    // Create batches for processing
    const batches: string[][] = [];
    for (let i = 0; i < allCardIds.length; i += BATCH_SIZE) {
      batches.push(allCardIds.slice(i, i + BATCH_SIZE));
    }
    
    const expectedBatches = batches.length;
    console.log(`Expected ${expectedBatches} batches to process`);

    // Start job run
    const { data: jobRunResult, error: jobRunError } = await supabase.rpc('start_pricing_job_run', {
      p_game: game,
      p_expected_batches: expectedBatches
    });

    if (jobRunError) {
      console.error('Error creating job run:', jobRunError);
      throw new Error(`Failed to create job run: ${jobRunError.message}`);
    }

    jobRunId = jobRunResult;

    // Preflight check
    if (expectedBatches > CEILING) {
      await supabase.rpc('finish_pricing_job_run', {
        p_job_id: jobRunId,
        p_status: 'preflight_ceiling',
        p_actual_batches: 0,
        p_cards_processed: 0,
        p_variants_updated: 0,
        p_error: `Too many batches: ${expectedBatches} > ${CEILING}`
      });
        
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "preflight_ceiling", 
          expectedBatches 
        }), 
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let totalCardsProcessed = 0;
    let totalVariantsUpdated = 0;

    // Process batches
    for (let i = 0; i < batches.length; i++) {
      let batchProcessed = 0;
      let batchUpdated = 0;
      
      try {
        // Check for cancellation before each batch
        const { data: isCancelled } = await supabase.rpc('is_pricing_job_cancelled', { p_job_id: jobRunId });
        
        if (isCancelled) {
          console.log('Job cancellation requested, stopping gracefully');
          await supabase.rpc('finish_pricing_job_run', {
            p_job_id: jobRunId,
            p_status: 'cancelled',
            p_actual_batches: i,
            p_cards_processed: totalCardsProcessed,
            p_variants_updated: totalVariantsUpdated,
            p_error: null
          });
          
          return new Response(JSON.stringify({ 
            success: true, 
            cancelled: true,
            game, 
            actualBatches: i, 
            cardsProcessed: totalCardsProcessed, 
            variantsUpdated: totalVariantsUpdated 
          }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        console.log(`Processing batch ${i + 1}/${batches.length}: ${batches[i].length} cards`);

        // Fetch pricing data from JustTCG
        const justTcgCards = await fetchJustTcgBatch(batches[i], justTCGApiKey, {
          printing: 'normal',
          condition: 'near_mint'
        });

        // Write batch to database
        const result = await writeBatchToDb(supabase, justTcgCards, cardIdMap);
        batchProcessed = result.cardsProcessed;
        batchUpdated = result.variantsUpdated;
        
        console.log(`Batch ${i + 1} complete: ${batchProcessed} cards, ${batchUpdated} variants`);
      } catch (error) {
        console.error(`Batch ${i + 1} error:`, error);
        // Continue with next batch
      } finally {
        // Always update progress
        totalCardsProcessed += batchProcessed;
        totalVariantsUpdated += batchUpdated;
        
        await supabase.rpc('update_pricing_job_progress', {
          p_job_id: jobRunId,
          p_actual_batches: i + 1,
          p_cards_processed: totalCardsProcessed,
          p_variants_updated: totalVariantsUpdated
        });
      }

      // Rate limiting
      await sleep(125);
    }

    // Determine final status - if no variants updated, mark as error
    const finalStatus = (totalCardsProcessed === 0 && totalVariantsUpdated === 0) ? 'error' : 'completed';
    const finalError = finalStatus === 'error' ? 'No pricing returned from API (unexpected payload shape or empty results).' : null;

    await supabase.rpc('finish_pricing_job_run', {
      p_job_id: jobRunId,
      p_status: finalStatus,
      p_actual_batches: batches.length,
      p_cards_processed: totalCardsProcessed,
      p_variants_updated: totalVariantsUpdated,
      p_error: finalError
    });

    console.log(`Pricing refresh ${finalStatus}: ${totalCardsProcessed} cards processed, ${totalVariantsUpdated} variants updated`);

    return new Response(JSON.stringify({ 
      success: true, 
      game, 
      expectedBatches, 
      actualBatches: batches.length, 
      cardsProcessed: totalCardsProcessed, 
      variantsUpdated: totalVariantsUpdated 
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Error in pricing refresh:', error);
    
    // Try to update job status to error if we have a jobRunId
    if (jobRunId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase.rpc('finish_pricing_job_run', {
          p_job_id: jobRunId,
          p_status: 'error',
          p_actual_batches: 0,
          p_cards_processed: 0,
          p_variants_updated: 0,
          p_error: String(error).slice(0, 500)
        });
      } catch (updateError) {
        console.error('Error updating job status:', updateError);
      }
    }

    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});