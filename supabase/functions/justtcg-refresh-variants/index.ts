import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BATCH_SIZE = 1000;
const CEILING = 470;

interface JustTCGVariant {
  id: string;
  cardId: string;
  language?: string;
  printing?: string;
  condition?: string;
  sku?: string;
  prices?: {
    currency?: string;
    latest?: number;
    market?: number;
    low?: number;
    mid?: number;
    high?: number;
    updatedAt?: string;
  };
}

interface JustTCGApiResponse {
  data: JustTCGVariant[];
  pagination?: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJustTcgVariants(
  game: string,
  apiKey: string,
  offset: number = 0,
  limit: number = BATCH_SIZE
): Promise<JustTCGVariant[]> {
  const maxRetries = 5;
  let attempt = 0;
  
  const JTCG_BASE = Deno.env.get('JTCG_BASE') || 'https://api.justtcg.com/v1';
  const url = `${JTCG_BASE}/variants?game=${game}&limit=${limit}&offset=${offset}`;
  
  while (attempt < maxRetries) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        }
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
        console.warn(`JustTCG variants non-200 ${response.status}:`, errorText.slice(0, 400));
        return [];
      }

      const apiResponse: JustTCGApiResponse = await response.json();
      return apiResponse.data || [];
      
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries - 1) {
        console.warn('All JustTCG variants attempts failed');
        return [];
      }
      
      const backoffMs = Math.min(100 * Math.pow(2, attempt), 5000);
      await sleep(backoffMs);
      attempt++;
    }
  }
  
  return [];
}

function mapVariantToRow(game: string, variant: JustTCGVariant) {
  return {
    provider: 'justtcg',
    game,
    card_provider_id: variant.cardId,
    variant_provider_id: variant.id,
    language: variant.language || null,
    printing: variant.printing || null,
    condition: variant.condition || null,
    sku: variant.sku || null,
    currency: variant.prices?.currency || 'USD',
    price: variant.prices?.latest?.toString() || null,
    market_price: variant.prices?.market?.toString() || null,
    low_price: variant.prices?.low?.toString() || null,
    mid_price: variant.prices?.mid?.toString() || null,
    high_price: variant.prices?.high?.toString() || null,
    data: { raw: variant },
    updated_from_source_at: variant.prices?.updatedAt || new Date().toISOString()
  };
}

async function writeBatchToDb(supabase: any, game: string, variants: JustTCGVariant[]) {
  let variantsUpdated = 0;
  
  if (variants.length === 0) {
    return { variantsUpdated: 0, cardsProcessed: 0 };
  }
  
  // Map variants to database format
  const rows = variants.map(variant => mapVariantToRow(game, variant));
  
  // Upsert variants in chunks of 500
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    
    try {
      const { error } = await supabase.rpc('catalog_v2_upsert_variants', { 
        rows: chunk 
      });
      
      if (error) {
        console.warn('Variant upsert error:', error);
      } else {
        variantsUpdated += chunk.length;
      }
    } catch (err) {
      console.error('Variant upsert failed:', err);
    }
  }
  
  return { variantsUpdated, cardsProcessed: variants.length };
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

    // Start job run - we'll estimate batches based on pagination
    let estimatedBatches = 50; // Initial estimate, will be adjusted
    const { data: jobRunResult, error: jobRunError } = await supabase.rpc('start_pricing_job_run', {
      p_game: game,
      p_expected_batches: estimatedBatches
    });

    if (jobRunError) {
      console.error('Error creating job run:', jobRunError);
      throw new Error(`Failed to create job run: ${jobRunError.message}`);
    }

    jobRunId = jobRunResult;

    let totalCardsProcessed = 0;
    let totalVariantsUpdated = 0;
    let batchNumber = 0;
    let offset = 0;
    let hasMore = true;

    // Process variants with pagination
    while (hasMore) {
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
            p_actual_batches: batchNumber,
            p_cards_processed: totalCardsProcessed,
            p_variants_updated: totalVariantsUpdated,
            p_error: null
          });
          
          return new Response(JSON.stringify({ 
            success: true, 
            cancelled: true,
            game, 
            actualBatches: batchNumber, 
            cardsProcessed: totalCardsProcessed, 
            variantsUpdated: totalVariantsUpdated 
          }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        // Check ceiling
        if (batchNumber >= CEILING) {
          await supabase.rpc('finish_pricing_job_run', {
            p_job_id: jobRunId,
            p_status: 'preflight_ceiling',
            p_actual_batches: batchNumber,
            p_cards_processed: totalCardsProcessed,
            p_variants_updated: totalVariantsUpdated,
            p_error: `Too many batches: ${batchNumber} >= ${CEILING}`
          });
            
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "preflight_ceiling", 
              expectedBatches: batchNumber 
            }), 
            { 
              status: 200, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        console.log(`Processing batch ${batchNumber + 1}: fetching variants at offset ${offset}`);

        // Fetch variants from JustTCG
        const variants = await fetchJustTcgVariants(game, justTCGApiKey, offset, BATCH_SIZE);
        
        if (variants.length === 0) {
          hasMore = false;
          break;
        }

        // Write batch to database
        const result = await writeBatchToDb(supabase, game, variants);
        batchProcessed = result.cardsProcessed;
        batchUpdated = result.variantsUpdated;
        
        console.log(`Batch ${batchNumber + 1} complete: ${batchProcessed} variants processed, ${batchUpdated} variants updated`);
        
        // Update pagination
        offset += BATCH_SIZE;
        batchNumber++;
        
        // If we got less than the batch size, we're done
        if (variants.length < BATCH_SIZE) {
          hasMore = false;
        }
        
      } catch (error) {
        console.error(`Batch ${batchNumber + 1} error:`, error);
        // Continue with next batch
        offset += BATCH_SIZE;
        batchNumber++;
      } finally {
        // Always update progress
        totalCardsProcessed += batchProcessed;
        totalVariantsUpdated += batchUpdated;
        
        await supabase.rpc('update_pricing_job_progress', {
          p_job_id: jobRunId,
          p_actual_batches: batchNumber,
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
      p_actual_batches: batchNumber,
      p_cards_processed: totalCardsProcessed,
      p_variants_updated: totalVariantsUpdated,
      p_error: finalError
    });

    console.log(`Pricing refresh ${finalStatus}: ${totalCardsProcessed} variants processed, ${totalVariantsUpdated} variants updated`);

    return new Response(JSON.stringify({ 
      success: true, 
      game, 
      expectedBatches: batchNumber, 
      actualBatches: batchNumber, 
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