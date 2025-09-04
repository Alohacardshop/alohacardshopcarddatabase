import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BATCH_SIZE = 20; // JustTCG API limit for variant queries
const CEILING = 470;
const TIME_LIMIT_MS = 4.5 * 60 * 1000; // 4.5 minutes in milliseconds
const VARIANT_LIMIT = 700; // Reduced from 1000 to ensure completion within time window

// Game mapping from UI names to API format
const GAME_MAP: Record<string, string> = {
  'pokemon': 'pokemon',
  'Pokémon EN': 'pokemon',
  'Pokémon JP': 'pokemon',
  'Pokemon EN': 'pokemon', 
  'Pokemon JP': 'pokemon',
  'magic-the-gathering': 'magic-the-gathering',
  'yugioh': 'yugioh',
  'lorcana-tcg': 'lorcana-tcg',
  'one-piece': 'one-piece',
  'digimon': 'digimon',
  'union-arena': 'union-arena'
};

interface JustTCGVariant {
  id: string;
  cardId: string;
  price?: number;
  priceChange24h?: number;
  lastUpdated?: number;
  condition?: string;
  printing?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchVariantPricing(
  variantIds: string[],
  apiKey: string
): Promise<JustTCGVariant[]> {
  const maxRetries = 3;
  let attempt = 0;
  
  const JTCG_BASE = Deno.env.get('JTCG_BASE') || 'https://api.justtcg.com/v1';
  const url = `${JTCG_BASE}/cards`;
  
  const requestBody = variantIds.map(id => ({ variantId: id }));
  
  console.log(`🔄 Fetching pricing for ${variantIds.length} variants`);
  console.log(`🔑 API Key present: ${!!apiKey}`);
  
  while (attempt < maxRetries) {
    try {
      console.log(`📞 API Call attempt ${attempt + 1}/${maxRetries}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log(`📡 API Response: ${response.status} ${response.statusText}`);

      if (response.status === 429) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.log(`⏳ Rate limited, backing off for ${backoffMs}ms (attempt ${attempt + 1})`);
        await sleep(backoffMs);
        attempt++;
        continue;
      }

      const responseText = await response.text();
      console.log(`📄 Raw response (first 200 chars): ${responseText.slice(0, 200)}`);

      if (!response.ok) {
        console.error(`❌ JustTCG API error ${response.status}: ${responseText.slice(0, 400)}`);
        
        if (response.status === 401 || response.status === 403) {
          throw new Error(`API authentication failed (${response.status}): ${responseText}`);
        }
        
        attempt++;
        if (attempt >= maxRetries) {
          return [];
        }
        continue;
      }

      let raw;
      try {
        raw = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`❌ JSON parse error: ${parseError}`);
        return [];
      }
      
      const cards = raw?.data || [];
      console.log(`✅ Found ${cards.length} cards in response`);
      
      // Extract variants from cards
      const allVariants: JustTCGVariant[] = [];
      
      for (const card of cards) {
        const cardVariants = card.variants || [];
        
        for (const variant of cardVariants) {
          if (variant && variant.id) {
            allVariants.push({
              id: variant.id,
              cardId: card.id || variant.cardId,
              price: variant.price,
              priceChange24h: variant.priceChange24h,
              lastUpdated: variant.lastUpdated,
              condition: variant.condition,
              printing: variant.printing
            });
          }
        }
      }
      
      console.log(`🎯 Extracted ${allVariants.length} variants with pricing`);
      return allVariants;
      
    } catch (error) {
      console.error(`❌ Attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries - 1) {
        console.error('💥 All variant pricing attempts failed');
        return [];
      }
      
      const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000);
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
  const startTime = Date.now(); // Track start time for time-guard

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const justTCGApiKey = Deno.env.get('JUSTTCG_API_KEY');

    // Fail-fast if API key is missing
    if (!justTCGApiKey) {
      console.error('JUSTTCG_API_KEY is not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "missing_api_key",
          message: "JustTCG API key is not configured. Please add the JUSTTCG_API_KEY secret." 
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Accept game from POST body or URL params
    let rawGame = "";
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        rawGame = body.game || body.gameSlug || "";
      } catch {
        // Fallback to URL params
        const url = new URL(req.url);
        rawGame = url.searchParams.get("game") || "";
      }
    } else {
      const url = new URL(req.url);
      rawGame = url.searchParams.get("game") || "";
    }
    
    // Map game names to API format
    const game = GAME_MAP[rawGame] || rawGame;
    console.log(`Game mapping: "${rawGame}" -> "${game}"`);
    
    if (!["pokemon", "magic-the-gathering", "yugioh", "lorcana-tcg", "one-piece", "digimon", "union-arena"].includes(game)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "bad_game",
          message: `Unsupported game: ${rawGame}. Supported games: pokemon, magic-the-gathering, yugioh, lorcana-tcg, one-piece, digimon, union-arena`
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Starting variant-based pricing refresh for game: ${game}`);

    // Query database for variants that need price updates
    console.log(`Querying database for ${game} variants...`);
    
    const { data: variants, error: queryError } = await supabase
      .from('variants')
      .select('id, justtcg_variant_id, price_cents, last_updated, card_id')
      .not('justtcg_variant_id', 'is', null)
      .lt('last_updated', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Only variants not updated in last hour
      .order('last_updated', { ascending: true })
      .limit(VARIANT_LIMIT);

    if (queryError) {
      console.error('Database query failed:', queryError);
      throw new Error(`Database query failed: ${queryError.message}`);
    }

    if (!variants || variants.length === 0) {
      console.log(`No variants found for game: ${game}`);
      return new Response(
        JSON.stringify({
          success: true,
          game,
          message: 'No variants found to update',
          variantsProcessed: 0,
          variantsUpdated: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${variants.length} variants to process`);

    // Start job run
    const { data: jobRunResult, error: jobRunError } = await supabase.rpc('start_pricing_job_run', {
      p_game: game,
      p_expected_batches: Math.ceil(variants.length / BATCH_SIZE)
    });

    if (jobRunError) {
      console.error('Error creating job run:', jobRunError);
      throw new Error(`Failed to create job run: ${jobRunError.message}`);
    }

    jobRunId = jobRunResult;

    // Process variants in batches
    const batches = [];
    for (let i = 0; i < variants.length; i += BATCH_SIZE) {
      batches.push(variants.slice(i, i + BATCH_SIZE));
    }

    console.log(`Processing ${batches.length} batches of up to ${BATCH_SIZE} variants each`);

    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalErrors = 0;

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`Processing batch ${batchIndex + 1}/${batches.length}...`);

      try {
        // Time-guard: Check if we're approaching the time limit
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime > TIME_LIMIT_MS) {
          console.log(`Time limit approaching (${elapsedTime}ms), stopping gracefully to avoid timeout`);
          await supabase.rpc('finish_pricing_job_run', {
            p_job_id: jobRunId,
            p_status: 'preflight_ceiling',
            p_actual_batches: batchIndex,
            p_cards_processed: totalProcessed,
            p_variants_updated: totalUpdated,
            p_error: `Time limit reached after ${Math.floor(elapsedTime/1000)}s. Job stopped to avoid Edge Function timeout.`
          });
          
          return new Response(JSON.stringify({ 
            success: true, 
            preflight_ceiling: true,
            game, 
            actualBatches: batchIndex, 
            cardsProcessed: totalProcessed, 
            variantsUpdated: totalUpdated,
            message: `Job stopped due to time limit. Processed ${batchIndex}/${batches.length} batches.`
          }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        // Check for cancellation
        const { data: isCancelled } = await supabase.rpc('is_pricing_job_cancelled', { p_job_id: jobRunId });
        
        if (isCancelled) {
          console.log('Job cancellation requested, stopping gracefully');
          await supabase.rpc('finish_pricing_job_run', {
            p_job_id: jobRunId,
            p_status: 'cancelled',
            p_actual_batches: batchIndex,
            p_cards_processed: totalProcessed,
            p_variants_updated: totalUpdated,
            p_error: null
          });
          
          return new Response(JSON.stringify({ 
            success: true, 
            cancelled: true,
            game, 
            actualBatches: batchIndex, 
            cardsProcessed: totalProcessed, 
            variantsUpdated: totalUpdated 
          }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        // Extract variant IDs for JustTCG API call
        const variantIds = batch
          .filter(v => v.justtcg_variant_id)
          .map(v => v.justtcg_variant_id);

        if (variantIds.length === 0) {
          console.log(`Skipping batch ${batchIndex + 1} - no valid variant IDs`);
          continue;
        }

        // Fetch pricing from JustTCG
        const pricingData = await fetchVariantPricing(variantIds, justTCGApiKey);
        
        console.log(`JustTCG returned pricing for ${pricingData.length} variants in batch ${batchIndex + 1}`);

        // Update variants in database
        for (const variantPricing of pricingData) {
          const dbVariant = batch.find(v => v.justtcg_variant_id === variantPricing.id);
          if (!dbVariant) continue;

          try {
            const { error: updateError } = await supabase
              .from('variants')
              .update({
                price_cents: variantPricing.price ? Math.round(variantPricing.price * 100) : null,
                last_updated: new Date().toISOString()
              })
              .eq('id', dbVariant.id);

            if (updateError) {
              console.error(`Error updating variant ${dbVariant.id}:`, updateError);
              totalErrors++;
            } else {
              totalUpdated++;
              console.log(`Updated variant ${variantPricing.id}: $${variantPricing.price}`);
            }

            totalProcessed++;

          } catch (updateException) {
            console.error(`Exception updating variant ${dbVariant.id}:`, updateException);
            totalErrors++;
          }
        }

        // Update job progress
        await supabase.rpc('update_pricing_job_progress', {
          p_job_id: jobRunId,
          p_actual_batches: batchIndex + 1,
          p_cards_processed: totalProcessed,
          p_variants_updated: totalUpdated
        });

        // Rate limiting - delay between batches
        if (batchIndex < batches.length - 1) {
          await sleep(1000); // 1 second delay
        }

      } catch (batchError) {
        console.error(`Error processing batch ${batchIndex + 1}:`, batchError);
        totalErrors += batch.length;
      }
    }

    // Determine final status
    const finalStatus = totalErrors === 0 ? 'completed' : (totalUpdated > 0 ? 'completed' : 'error');
    const finalError = finalStatus === 'error' ? `${totalErrors} variants failed to update` : null;

    await supabase.rpc('finish_pricing_job_run', {
      p_job_id: jobRunId,
      p_status: finalStatus,
      p_actual_batches: batches.length,
      p_cards_processed: totalProcessed,
      p_variants_updated: totalUpdated,
      p_error: finalError
    });

    const result = {
      success: true,
      game,
      batchesProcessed: batches.length,
      variantsProcessed: totalProcessed,
      variantsUpdated: totalUpdated,
      errors: totalErrors,
      message: `Successfully updated ${totalUpdated} of ${totalProcessed} variants`
    };

    console.log('Variant pricing refresh completed:', result);

    return new Response(JSON.stringify(result), { 
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