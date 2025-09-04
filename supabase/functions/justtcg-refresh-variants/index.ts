import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GameService } from '../_shared/game-service.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configuration constants
const BATCH_SIZE = 100; // Increased from 20 - process more variants per API call
const TIME_LIMIT_MS = 4.0 * 60 * 1000; // 4 minutes to stay under 5min limit
const MAX_REQUESTS_PER_MINUTE = 400; // Stay under 500/min API limit (80% capacity)

interface JustTCGVariant {
  id: string;
  cardId: string;
  price?: number;
  priceChange24h?: number;
  lastUpdated?: number;
  condition?: string;
  printing?: string;
}

interface JobProgress {
  totalFound: number;
  processed: number;
  updated: number;
  errors: number;
  batchesCompleted: number;
  totalBatches: number;
  apiRequestsUsed: number;
  elapsedTimeMs: number;
}

/**
 * Sleep utility for rate limiting and backoff
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch variant pricing from JustTCG API with comprehensive retry logic
 */
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

      // Handle rate limiting
      if (response.status === 429) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`⏳ Rate limited, backing off for ${backoffMs}ms (attempt ${attempt + 1})`);
        await sleep(backoffMs);
        attempt++;
        continue;
      }

      const responseText = await response.text();
      console.log(`📄 Response preview: ${responseText.slice(0, 200)}...`);

      if (!response.ok) {
        console.error(`❌ JustTCG API error ${response.status}: ${responseText.slice(0, 400)}`);
        
        // Don't retry auth failures
        if (response.status === 401 || response.status === 403) {
          throw new Error(`API authentication failed (${response.status}): ${responseText}`);
        }
        
        attempt++;
        if (attempt >= maxRetries) {
          console.error(`💥 All attempts failed for variant batch`);
          return [];
        }
        
        const backoffMs = Math.min(2000 * attempt, 8000);
        await sleep(backoffMs);
        continue;
      }

      // Parse response
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`❌ JSON parse error: ${parseError}`);
        attempt++;
        if (attempt >= maxRetries) return [];
        continue;
      }
      
      const cards = parsedResponse?.data || [];
      console.log(`✅ Found ${cards.length} cards in API response`);
      
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
      
      console.log(`🎯 Extracted ${allVariants.length} variants with pricing data`);
      return allVariants;
      
    } catch (error) {
      console.error(`❌ Attempt ${attempt + 1} failed:`, error);
      
      if (attempt === maxRetries - 1) {
        console.error('💥 All variant pricing attempts exhausted');
        return [];
      }
      
      const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000);
      await sleep(backoffMs);
      attempt++;
    }
  }
  
  return [];
}

/**
 * Update job progress in database
 */
async function updateJobProgress(
  supabase: any,
  jobRunId: string,
  progress: JobProgress
): Promise<void> {
  try {
    await supabase.rpc('update_pricing_job_progress', {
      p_job_id: jobRunId,
      p_actual_batches: progress.batchesCompleted,
      p_cards_processed: progress.processed,
      p_variants_updated: progress.updated
    });
  } catch (error) {
    console.error('⚠️ Failed to update job progress:', error);
    // Don't throw - progress updates are non-critical
  }
}

/**
 * Process a single batch of variants
 */
async function processBatch(
  supabase: any,
  batch: any[],
  batchIndex: number,
  totalBatches: number,
  apiKey: string,
  progress: JobProgress
): Promise<{ processed: number; updated: number; errors: number }> {
  
  console.log(`🔄 Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} variants)`);
  console.log(`📈 Overall progress: ${progress.processed}/${progress.totalFound} variants (${Math.round(progress.processed/progress.totalFound*100)}%)`);

  // Extract variant IDs for API call
  const variantIds = batch
    .filter(v => v.justtcg_variant_id)
    .map(v => v.justtcg_variant_id);

  if (variantIds.length === 0) {
    console.log(`⏭️ Skipping batch ${batchIndex + 1} - no valid variant IDs`);
    return { processed: batch.length, updated: 0, errors: 0 };
  }

  // Fetch pricing data from JustTCG
  progress.apiRequestsUsed++;
  console.log(`🔄 API Request ${progress.apiRequestsUsed} - fetching ${variantIds.length} variants`);
  
  const pricingData = await fetchVariantPricing(variantIds, apiKey);
  console.log(`✅ JustTCG returned pricing for ${pricingData.length}/${variantIds.length} variants`);

  // Update variants in database
  let batchUpdated = 0;
  let batchErrors = 0;
  
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
        console.error(`❌ Error updating variant ${dbVariant.id}:`, updateError);
        batchErrors++;
      } else {
        batchUpdated++;
        if (variantPricing.price) {
          console.log(`💰 Updated variant ${variantPricing.id}: $${variantPricing.price.toFixed(2)}`);
        }
      }

    } catch (updateException) {
      console.error(`💥 Exception updating variant ${dbVariant.id}:`, updateException);
      batchErrors++;
    }
  }

  return {
    processed: batch.length,
    updated: batchUpdated,
    errors: batchErrors
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let jobRunId: string | null = null;
  const startTime = Date.now();

  try {
    // Initialize services
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const justTCGApiKey = Deno.env.get('JUSTTCG_API_KEY');

    // Validate API key
    if (!justTCGApiKey) {
      console.error('❌ JUSTTCG_API_KEY is not configured');
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
    const gameService = new GameService(supabase);
    
    // Parse game parameter
    let rawGame = "";
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        rawGame = body.game || body.gameSlug || "";
      } catch {
        const url = new URL(req.url);
        rawGame = url.searchParams.get("game") || "";
      }
    } else {
      const url = new URL(req.url);
      rawGame = url.searchParams.get("game") || "";
    }
    
    if (!rawGame) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "missing_game",
          message: "Game parameter is required" 
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Use GameService to get game mapping
    const gameMapping = await gameService.getGameMapping(rawGame);
    
    if (!gameMapping) {
      const supportedGames = await gameService.getSupportedGames();
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "unsupported_game",
          message: `Unsupported game: ${rawGame}. Supported games: ${supportedGames.join(', ')}`
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    gameService.logGameMapping(rawGame, gameMapping);
    console.log(`🚀 Starting comprehensive pricing refresh for ${gameMapping.displayName}`);

    // Fetch all cards for this game
    console.log(`📋 Fetching cards for game: ${gameMapping.databaseSlug}...`);
    
    const { data: gameCards, error: cardsError } = await supabase
      .rpc('fetch_cards_with_variants', { 
        p_game: gameMapping.databaseSlug, 
        p_limit: 50000, // Large limit to get all cards
        p_offset: 0 
      });

    if (cardsError) {
      console.error('❌ Failed to fetch game cards:', cardsError);
      throw new Error(`Failed to fetch cards for game ${gameMapping.databaseSlug}: ${cardsError.message}`);
    }

    if (!gameCards || gameCards.length === 0) {
      console.log(`⚠️ No cards found for game: ${gameMapping.databaseSlug}`);
      return new Response(
        JSON.stringify({
          success: true,
          game: gameMapping.databaseSlug,
          message: `No cards found for game: ${gameMapping.displayName}`,
          cardsFound: 0
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`📊 Found ${gameCards.length} cards for ${gameMapping.displayName}`);

    // Get ALL variants that need price updates (no limit)
    const cardIds = gameCards.map(card => card.card_id);
    console.log(`🔍 Querying ALL stale variants for ${cardIds.length} cards...`);
    
    const { data: variants, error: queryError } = await supabase
      .rpc('get_variants_for_pricing_update', {
        p_card_ids: cardIds
        // No limit parameter - process ALL stale variants
      });

    if (queryError) {
      console.error('❌ Database query failed:', queryError);
      throw new Error(`Database query failed: ${queryError.message}`);
    }

    if (!variants || variants.length === 0) {
      console.log(`✅ No stale variants found for ${gameMapping.displayName}`);
      return new Response(
        JSON.stringify({
          success: true,
          game: gameMapping.databaseSlug,
          message: 'No variants found needing updates - all pricing is current',
          variantsProcessed: 0,
          variantsUpdated: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🎯 Found ${variants.length} stale variants to refresh`);

    // Create pricing job run
    const { data: jobRunResult, error: jobRunError } = await supabase.rpc('start_pricing_job_run', {
      p_game: gameMapping.databaseSlug,
      p_expected_batches: Math.ceil(variants.length / BATCH_SIZE)
    });

    if (jobRunError) {
      console.error('❌ Error creating job run:', jobRunError);
      throw new Error(`Failed to create job run: ${jobRunError.message}`);
    }

    jobRunId = jobRunResult;
    console.log(`📋 Started job run: ${jobRunId}`);

    // Initialize progress tracking
    const progress: JobProgress = {
      totalFound: variants.length,
      processed: 0,
      updated: 0,
      errors: 0,
      batchesCompleted: 0,
      totalBatches: Math.ceil(variants.length / BATCH_SIZE),
      apiRequestsUsed: 0,
      elapsedTimeMs: 0
    };

    // Process variants in batches
    const batches = [];
    for (let i = 0; i < variants.length; i += BATCH_SIZE) {
      batches.push(variants.slice(i, i + BATCH_SIZE));
    }

    console.log(`⚡ Processing ${batches.length} batches of up to ${BATCH_SIZE} variants each`);

    // Rate limiting tracking
    let requestCount = 0;
    let minuteStartTime = Date.now();

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      try {
        // Check time limits
        progress.elapsedTimeMs = Date.now() - startTime;
        if (progress.elapsedTimeMs > TIME_LIMIT_MS) {
          console.log(`⏰ Time limit approaching (${Math.round(progress.elapsedTimeMs/1000)}s), stopping gracefully`);
          
          await supabase.rpc('finish_pricing_job_run', {
            p_job_id: jobRunId,
            p_status: 'preflight_ceiling',
            p_actual_batches: progress.batchesCompleted,
            p_cards_processed: progress.processed,
            p_variants_updated: progress.updated,
            p_error: `Time limit reached after ${Math.floor(progress.elapsedTimeMs/1000)}s. Processed ${progress.processed}/${variants.length} variants.`
          });
          
          return new Response(JSON.stringify({ 
            success: true, 
            preflight_ceiling: true,
            game: gameMapping.databaseSlug,
            gameDisplayName: gameMapping.displayName,
            totalFound: progress.totalFound,
            processed: progress.processed,
            updated: progress.updated,
            message: `Partial completion: processed ${progress.processed}/${variants.length} variants before time limit`
          }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        // Check for job cancellation
        const { data: isCancelled } = await supabase.rpc('is_pricing_job_cancelled', { p_job_id: jobRunId });
        
        if (isCancelled) {
          console.log('🛑 Job cancellation requested, stopping gracefully');
          
          await supabase.rpc('finish_pricing_job_run', {
            p_job_id: jobRunId,
            p_status: 'cancelled',
            p_actual_batches: progress.batchesCompleted,
            p_cards_processed: progress.processed,
            p_variants_updated: progress.updated,
            p_error: null
          });
          
          return new Response(JSON.stringify({ 
            success: true, 
            cancelled: true,
            game: gameMapping.databaseSlug,
            gameDisplayName: gameMapping.displayName,
            processed: progress.processed,
            updated: progress.updated
          }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        // Rate limiting - reset counter every minute
        const currentTime = Date.now();
        const timeInCurrentMinute = currentTime - minuteStartTime;
        
        if (timeInCurrentMinute >= 60000) {
          minuteStartTime = currentTime;
          requestCount = 0;
        }
        
        if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
          const waitTime = 60000 - timeInCurrentMinute;
          console.log(`⏳ Rate limit protection: waiting ${Math.round(waitTime/1000)}s`);
          await sleep(waitTime);
          minuteStartTime = Date.now();
          requestCount = 0;
        }

        // Process this batch
        const batchResult = await processBatch(
          supabase, 
          batch, 
          batchIndex, 
          batches.length, 
          justTCGApiKey, 
          progress
        );

        // Update progress
        progress.processed += batchResult.processed;
        progress.updated += batchResult.updated;
        progress.errors += batchResult.errors;
        progress.batchesCompleted++;
        requestCount++;

        // Update job progress in database
        await updateJobProgress(supabase, jobRunId, progress);

        // Brief pause between batches
        if (batchIndex < batches.length - 1) {
          await sleep(150);
        }

      } catch (batchError) {
        console.error(`💥 Error processing batch ${batchIndex + 1}:`, batchError);
        progress.errors += batch.length;
        progress.processed += batch.length;
        progress.batchesCompleted++;
      }
    }

    // Determine final job status
    const finalStatus = progress.errors === 0 ? 'completed' : 
                       (progress.updated > 0 ? 'completed' : 'error');
    const finalError = finalStatus === 'error' ? 
                      `${progress.errors} variants failed to update` : null;

    // Finalize job
    await supabase.rpc('finish_pricing_job_run', {
      p_job_id: jobRunId,
      p_status: finalStatus,
      p_actual_batches: progress.batchesCompleted,
      p_cards_processed: progress.processed,
      p_variants_updated: progress.updated,
      p_error: finalError
    });

    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
    
    console.log(`🎉 Pricing refresh completed successfully in ${elapsedSeconds}s!`);
    console.log(`📊 Final results: ${progress.updated}/${progress.processed} variants updated from ${progress.totalFound} found`);
    console.log(`⚡ API efficiency: Used ${progress.apiRequestsUsed} requests (~${Math.round(progress.apiRequestsUsed/MAX_REQUESTS_PER_MINUTE*100)}% of rate limit)`);

    const result = {
      success: true,
      game: gameMapping.databaseSlug,
      gameDisplayName: gameMapping.displayName,
      totalFound: progress.totalFound,
      batchesProcessed: progress.batchesCompleted,
      variantsProcessed: progress.processed,
      variantsUpdated: progress.updated,
      apiRequestsUsed: progress.apiRequestsUsed,
      errors: progress.errors,
      processingTimeSeconds: elapsedSeconds,
      message: `Successfully processed ${progress.processed} variants in ${progress.batchesCompleted} batches for ${gameMapping.displayName}`
    };

    return new Response(JSON.stringify(result), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('💥 Critical error in pricing refresh:', error);
    
    // Update job status to error if we have a jobRunId
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
        console.error('❌ Error updating job status:', updateError);
      }
    }

    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Unknown error occurred' 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});