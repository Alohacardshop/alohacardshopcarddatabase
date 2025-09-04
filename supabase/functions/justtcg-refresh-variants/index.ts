import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BATCH_SIZE = 200;
const CEILING = 470;

interface JustTCGCard {
  id: string;
  variants?: JustTCGVariant[];
}

interface JustTCGVariant {
  id: string;
  condition: string;
  printing: string;
  price?: number;
  market_price?: number;
  low_price?: number;
  high_price?: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJustTcgBatch(cardIds: string[], apiKey: string): Promise<JustTCGCard[]> {
  const maxRetries = 5;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const response = await fetch('https://api.justtcg.com/v1/cards/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: cardIds })
      });

      if (response.status === 429) {
        const backoffMs = Math.min(100 * Math.pow(2, attempt), 5000);
        console.log(`Rate limited, backing off for ${backoffMs}ms (attempt ${attempt + 1})`);
        await sleep(backoffMs);
        attempt++;
        continue;
      }

      if (!response.ok) {
        throw new Error(`JustTCG API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries - 1) throw error;
      
      const backoffMs = Math.min(100 * Math.pow(2, attempt), 5000);
      await sleep(backoffMs);
      attempt++;
    }
  }
  
  return [];
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

    // Count cards for the game
    const { data: cntRow, error: cntErr } = await supabase.rpc("catalog_v2_count_cards_by_game", { p_game: game });
    if (cntErr) {
      console.error('Error counting cards:', cntErr);
      return new Response(
        JSON.stringify({ success: false, error: String(cntErr) }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Parse RPC result correctly
    const totalCards = Array.isArray(cntRow) ? Number(cntRow[0]?.count || 0) : Number(cntRow || 0);
    const expectedBatches = Math.ceil(totalCards / BATCH_SIZE);

    console.log(`Found ${totalCards} cards, expecting ${expectedBatches} batches`);

    // Log the start of this job run using public RPC
    const { data: jobRunResult, error: jobRunError } = await supabase
      .rpc('start_pricing_job_run', {
        p_game: game,
        p_expected_batches: expectedBatches
      });

    if (jobRunError) {
      console.error('Error creating job run:', jobRunError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create job run',
          details: jobRunError.message
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    jobRunId = jobRunResult;

    // Preflight check
    if (expectedBatches > CEILING) {
      await supabase.rpc('finish_pricing_job_run', {
        p_job_id: jobRunId,
        p_status: 'preflight_ceiling'
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

    let batchCount = 0;
    let totalCardsProcessed = 0;
    let totalVariantsUpdated = 0;

    // Process cards in batches
    for (let offset = 0; offset < totalCards; offset += BATCH_SIZE) {
      try {
        // Fetch batch of cards using public RPC
        const { data: cardsData, error: cardsError } = await supabase
          .rpc('fetch_cards_with_variants', {
            p_game: game,
            p_limit: BATCH_SIZE,
            p_offset: offset
          });

        if (cardsError) {
          console.error('Error fetching cards:', cardsError);
          // Update job run with error
          await supabase.rpc('finish_pricing_job_run', {
            p_job_id: jobRunId,
            p_status: 'error',
            p_error: `Failed to fetch cards: ${cardsError.message}`
          });
          
          return new Response(
            JSON.stringify({ 
              error: 'Failed to fetch cards',
              details: cardsError.message
            }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        if (!cardsData || cardsData.length === 0) {
          console.log(`No cards found in batch ${offset}-${offset + BATCH_SIZE}`);
          batchCount++;
          continue;
        }

        // Extract unique JustTCG card IDs
        const cardIds = [...new Set(cardsData
          .filter(card => card.justtcg_card_id)
          .map(card => card.justtcg_card_id))];

        if (cardIds.length === 0) {
          totalCardsProcessed += cardsData.length;
          batchCount++;
          continue;
        }

        console.log(`Processing batch ${batchCount + 1}: ${cardIds.length} unique cards`);

        // Fetch pricing from JustTCG
        const pricingData = await fetchJustTcgBatch(cardIds, justTCGApiKey);
        
        // Map to variant updates for public.variants table
        const variantUpserts: any[] = [];
        const priceHistoryInserts: any[] = [];

        for (const card of pricingData) {
          if (!card.variants) continue;
          
          for (const variant of card.variants) {
            // Find matching card from our database
            const dbCard = cardsData.find(c => c.justtcg_card_id === card.id);
            
            if (!dbCard) continue;

            const variantUpdate = {
              card_id: dbCard.card_id,
              justtcg_variant_id: variant.id,
              condition: variant.condition.toLowerCase().replace(' ', '_'),
              printing: variant.printing.toLowerCase().replace(' ', '_') || 'normal',
              price_cents: variant.price ? Math.round(variant.price * 100) : null,
              market_price_cents: variant.market_price ? Math.round(variant.market_price * 100) : null,
              low_price_cents: variant.low_price ? Math.round(variant.low_price * 100) : null,
              high_price_cents: variant.high_price ? Math.round(variant.high_price * 100) : null,
              last_updated: new Date().toISOString()
            };

            variantUpserts.push(variantUpdate);

            // History entry for catalog_v2 schema
            priceHistoryInserts.push({
              variant_id: `${dbCard.card_id}-${variant.id}`,
              price_cents: variantUpdate.price_cents,
              low_price_cents: variantUpdate.low_price_cents,
              high_price_cents: variantUpdate.high_price_cents,
              market_price_cents: variantUpdate.market_price_cents,
              recorded_at: new Date().toISOString()
            });
          }
        }

        // Update variants in public.variants table
        if (variantUpserts.length > 0) {
          const { error: variantError } = await supabase
            .from("variants")
            .upsert(variantUpserts, { 
              onConflict: 'card_id,condition,printing' 
            });

          if (variantError) {
            console.error('Error upserting variants:', variantError);
          } else {
            totalVariantsUpdated += variantUpserts.length;
          }
        }

        // Insert variant price history records using public RPC
        if (priceHistoryInserts.length > 0) {
          const { error: historyError } = await supabase
            .rpc('insert_variant_price_history', {
              p_records: priceHistoryInserts
            });

          if (historyError) {
            console.warn('Error inserting price history:', historyError);
            // Don't fail the entire batch for history insertion errors
          }
        }

        totalCardsProcessed += cardsData.length;
        batchCount++;

        console.log(`Batch ${batchCount} complete: ${variantUpserts.length} variants updated`);

        // Rate limiting
        await sleep(125);

      } catch (error) {
        console.error(`Error processing batch ${offset}-${offset + BATCH_SIZE}:`, error);
        batchCount++;
      }
    }

    // Mark job as complete using public RPC
    await supabase.rpc('finish_pricing_job_run', {
      p_job_id: jobRunId,
      p_status: 'completed',
      p_actual_batches: batchCount,
      p_cards_processed: totalCardsProcessed,
      p_variants_updated: totalVariantsUpdated
    });

    console.log(`Variant pricing refresh completed: ${totalCardsProcessed} cards processed, ${totalVariantsUpdated} variants updated`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        game, 
        expectedBatches, 
        actualBatches: batchCount, 
        cardsProcessed: totalCardsProcessed, 
        variantsUpdated: totalVariantsUpdated 
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

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
          p_error: error.message || 'Unknown error occurred'
        });
      } catch (updateError) {
        console.error('Error updating job status:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});