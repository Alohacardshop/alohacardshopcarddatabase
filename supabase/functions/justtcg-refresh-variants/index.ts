import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GameService } from '../_shared/game-service.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Enhanced configuration constants for 500K/month API limits
const BATCH_SIZE = 150; // Optimized for 500K/month = ~16K/day budget
const TIME_LIMIT_MS = 4.5 * 60 * 1000; // 4.5 minutes to stay under 5min limit
const MAX_REQUESTS_PER_MINUTE = 400; // Stay under 500/min API limit (80% capacity)
const CIRCUIT_BREAKER_THRESHOLD = 5; // Open circuit after 5 consecutive failures
const CIRCUIT_BREAKER_TIMEOUT = 30; // Minutes to wait before retry

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
  retryAttempts: number;
  circuitBreakerTripped: boolean;
}

interface CircuitBreakerStatus {
  state: string;
  can_proceed: boolean;
}

/**
 * Sleep utility for rate limiting and backoff
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Record API usage metrics with detailed tracking
 */
async function recordApiUsage(
  supabase: any,
  jobRunId: string,
  endpoint: string,
  statusCode: number,
  responseTimeMs: number,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    await supabase
      .from('pricing_api_usage')
      .insert({
        job_run_id: jobRunId,
        endpoint,
        status_code: statusCode,
        response_time_ms: responseTimeMs,
        success,
        error_message: errorMessage,
        recorded_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('⚠️ Failed to record API usage:', error);
    // Don't throw - metrics are non-critical
  }
}

/**
 * Check circuit breaker status before API calls
 */
async function checkCircuitBreaker(supabase: any, game: string): Promise<CircuitBreakerStatus> {
  try {
    const { data, error } = await supabase.rpc('check_circuit_breaker', { p_game: game });
    
    if (error) {
      console.error('Circuit breaker check failed:', error);
      return { state: 'closed', can_proceed: true }; // Default to allowing requests
    }
    
    const result = data?.[0] || { state: 'closed', can_proceed: true };
    console.log(`🔌 Circuit breaker for ${game}: ${result.state} (can_proceed: ${result.can_proceed})`);
    return result;
  } catch (error) {
    console.error('Circuit breaker check exception:', error);
    return { state: 'closed', can_proceed: true };
  }
}

/**
 * Record circuit breaker result after API operations
 */
async function recordCircuitBreakerResult(supabase: any, game: string, success: boolean): Promise<void> {
  try {
    await supabase.rpc('record_circuit_breaker_result', { 
      p_game: game, 
      p_success: success 
    });
  } catch (error) {
    console.error('⚠️ Failed to record circuit breaker result:', error);
  }
}

/**
 * Enhanced API call with comprehensive error handling and retry logic
 */
async function fetchVariantPricing(
  variantIds: string[],
  apiKey: string,
  supabase: any,
  jobRunId: string,
  game: string
): Promise<JustTCGVariant[]> {
  const maxRetries = 3;
  let attempt = 0;
  
  const JTCG_BASE = Deno.env.get('JTCG_BASE') || 'https://api.justtcg.com/v1';
  const url = `${JTCG_BASE}/cards`;
  
  const requestBody = variantIds.map(id => ({ variantId: id }));
  
  console.log(`🔄 Fetching pricing for ${variantIds.length} variants (attempt 1/${maxRetries})`);
  
  while (attempt < maxRetries) {
    const apiStartTime = Date.now();
    let statusCode = 0;
    let success = false;
    let errorMessage = '';
    
    try {
      console.log(`📞 API Call attempt ${attempt + 1}/${maxRetries} to ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      statusCode = response.status;
      const responseTime = Date.now() - apiStartTime;
      
      console.log(`📡 API Response: ${response.status} ${response.statusText} (${responseTime}ms)`);

      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const backoffMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(2000 * Math.pow(2, attempt), 30000);
        
        errorMessage = `Rate limited, backing off for ${backoffMs}ms`;
        console.log(`⏳ ${errorMessage} (attempt ${attempt + 1})`);
        
        await recordApiUsage(supabase, jobRunId, 'cards', statusCode, responseTime, false, errorMessage);
        await sleep(backoffMs);
        attempt++;
        continue;
      }

      const responseText = await response.text();
      console.log(`📄 Response preview: ${responseText.slice(0, 200)}...`);

      if (!response.ok) {
        errorMessage = `API error ${response.status}: ${responseText.slice(0, 200)}`;
        console.error(`❌ JustTCG API error: ${errorMessage}`);
        
        await recordApiUsage(supabase, jobRunId, 'cards', statusCode, responseTime, false, errorMessage);
        
        // Don't retry auth failures
        if (response.status === 401 || response.status === 403) {
          await recordCircuitBreakerResult(supabase, game, false);
          throw new Error(`API authentication failed (${response.status}): ${responseText}`);
        }
        
        // Record failure for circuit breaker
        await recordCircuitBreakerResult(supabase, game, false);
        
        attempt++;
        if (attempt >= maxRetries) {
          console.error(`💥 All attempts failed for variant batch`);
          return [];
        }
        
        const backoffMs = Math.min(3000 * attempt, 15000);
        await sleep(backoffMs);
        continue;
      }

      // Parse response
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseText);
        success = true;
      } catch (parseError) {
        errorMessage = `JSON parse error: ${parseError}`;
        console.error(`❌ ${errorMessage}`);
        
        await recordApiUsage(supabase, jobRunId, 'cards', statusCode, responseTime, false, errorMessage);
        await recordCircuitBreakerResult(supabase, game, false);
        
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
      
      // Record successful API usage
      await recordApiUsage(supabase, jobRunId, 'cards', statusCode, responseTime, true);
      await recordCircuitBreakerResult(supabase, game, true);
      
      return allVariants;
      
    } catch (error) {
      const responseTime = Date.now() - apiStartTime;
      errorMessage = String(error);
      
      console.error(`❌ Attempt ${attempt + 1} failed:`, error);
      
      await recordApiUsage(supabase, jobRunId, 'cards', statusCode || 0, responseTime, false, errorMessage);
      await recordCircuitBreakerResult(supabase, game, false);
      
      if (attempt === maxRetries - 1) {
        console.error('💥 All variant pricing attempts exhausted');
        return [];
      }
      
      const backoffMs = Math.min(2000 * Math.pow(2, attempt), 10000);
      await sleep(backoffMs);
      attempt++;
    }
  }
  
  return [];
}

/**
 * Update job progress in database with enhanced tracking
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
 * Queue failed variants for retry with exponential backoff
 */
async function queueVariantForRetry(
  supabase: any,
  variantId: string,
  game: string,
  error: string
): Promise<void> {
  try {
    await supabase.rpc('queue_variant_retry', {
      p_variant_id: variantId,
      p_game: game,
      p_error_message: error
    });
  } catch (error) {
    console.error('⚠️ Failed to queue variant retry:', error);
  }
}

/**
 * Process a single batch with comprehensive error handling
 */
async function processBatch(
  supabase: any,
  batch: any[],
  batchIndex: number,
  totalBatches: number,
  apiKey: string,
  progress: JobProgress,
  jobRunId: string,
  game: string
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

  // Fetch pricing data from JustTCG with enhanced error handling
  progress.apiRequestsUsed++;
  console.log(`🔄 API Request ${progress.apiRequestsUsed} - fetching ${variantIds.length} variants`);
  
  const pricingData = await fetchVariantPricing(variantIds, apiKey, supabase, jobRunId, game);
  console.log(`✅ JustTCG returned pricing for ${pricingData.length}/${variantIds.length} variants`);

  // Update variants in database with retry queuing for failures
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
          market_price_cents: variantPricing.price ? Math.round(variantPricing.price * 100) : null,
          last_updated: new Date().toISOString()
        })
        .eq('id', dbVariant.id);

      if (updateError) {
        console.error(`❌ Error updating variant ${dbVariant.id}:`, updateError);
        await queueVariantForRetry(supabase, dbVariant.id, game, updateError.message);
        batchErrors++;
      } else {
        batchUpdated++;
        if (variantPricing.price) {
          console.log(`💰 Updated variant ${variantPricing.id}: $${variantPricing.price.toFixed(2)}`);
        }
      }

    } catch (updateException) {
      console.error(`💥 Exception updating variant ${dbVariant.id}:`, updateException);
      await queueVariantForRetry(supabase, dbVariant.id, game, String(updateException));
      batchErrors++;
    }
  }

  // Queue variants that weren't returned by API for retry
  const returnedIds = new Set(pricingData.map(p => p.id));
  for (const variant of batch) {
    if (variant.justtcg_variant_id && !returnedIds.has(variant.justtcg_variant_id)) {
      await queueVariantForRetry(supabase, variant.id, game, 'No pricing data returned from API');
      batchErrors++;
    }
  }

  return {
    processed: batch.length,
    updated: batchUpdated,
    errors: batchErrors
  };
}

/**
 * Record daily performance metrics
 */
async function recordPerformanceMetrics(
  supabase: any,
  game: string,
  progress: JobProgress,
  processingTimeSeconds: number
): Promise<void> {
  try {
    const successRate = progress.totalFound > 0 ? (progress.updated / progress.totalFound) * 100 : 0;
    
    await supabase
      .from('pricing_performance_metrics')
      .upsert({
        game,
        variants_processed: progress.processed,
        variants_updated: progress.updated,
        api_requests_used: progress.apiRequestsUsed,
        processing_time_seconds: processingTimeSeconds,
        batch_size_used: BATCH_SIZE,
        success_rate: successRate,
        recorded_date: new Date().toISOString().split('T')[0] // YYYY-MM-DD
      }, {
        onConflict: 'game,recorded_date'
      });
      
    console.log(`📊 Recorded performance metrics for ${game}: ${successRate.toFixed(1)}% success rate`);
  } catch (error) {
    console.error('⚠️ Failed to record performance metrics:', error);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let jobRunId: string | null = null;
  let queueJobId: string | null = null;
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

    console.log(`🚀 Starting enhanced pricing refresh for ${gameMapping.displayName}`);

    // **NEW: Job Queue Management - Prevent duplicate jobs**
    try {
      const { data: queueResult, error: queueError } = await supabase.rpc('enqueue_pricing_job', {
        p_game: gameMapping.databaseSlug,
        p_priority: 10 // High priority for manual runs
      });

      if (queueError) {
        throw new Error(`Failed to enqueue job: ${queueError.message}`);
      }

      queueJobId = queueResult;
      console.log(`📋 Job queued with ID: ${queueJobId}`);

      // Check if this is a duplicate job
      const { data: existingQueue } = await supabase
        .from('pricing_job_queue')
        .select('status, started_at')
        .eq('id', queueJobId)
        .single();

      if (existingQueue?.status === 'running') {
        return new Response(
          JSON.stringify({
            success: false,
            error: "duplicate_job",
            message: `A pricing job for ${gameMapping.displayName} is already running`,
            queue_id: queueJobId
          }),
          { 
            status: 409, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    } catch (queueingError) {
      console.error('❌ Job queuing failed:', queueingError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "queuing_failed",
          message: `Failed to queue pricing job: ${queueingError.message}`
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // **NEW: Circuit Breaker Check**
    const circuitStatus = await checkCircuitBreaker(supabase, gameMapping.databaseSlug);
    
    if (!circuitStatus.can_proceed) {
      await supabase.rpc('complete_pricing_job', {
        p_job_id: queueJobId,
        p_status: 'failed',
        p_error_message: `Circuit breaker open for ${gameMapping.displayName} - too many recent failures`
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "circuit_breaker_open",
          message: `Circuit breaker is open for ${gameMapping.displayName} due to recent failures. Please wait before retrying.`,
          circuit_state: circuitStatus.state
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

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
      
      await supabase.rpc('complete_pricing_job', {
        p_job_id: queueJobId,
        p_status: 'completed',
        p_error_message: null
      });

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
      
      await supabase.rpc('complete_pricing_job', {
        p_job_id: queueJobId,
        p_status: 'completed',
        p_error_message: null
      });

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

    // Initialize enhanced progress tracking
    const progress: JobProgress = {
      totalFound: variants.length,
      processed: 0,
      updated: 0,
      errors: 0,
      batchesCompleted: 0,
      totalBatches: Math.ceil(variants.length / BATCH_SIZE),
      apiRequestsUsed: 0,
      elapsedTimeMs: 0,
      retryAttempts: 0,
      circuitBreakerTripped: false
    };

    // Process variants in optimized batches
    const batches = [];
    for (let i = 0; i < variants.length; i += BATCH_SIZE) {
      batches.push(variants.slice(i, i + BATCH_SIZE));
    }

    console.log(`⚡ Processing ${batches.length} batches of up to ${BATCH_SIZE} variants each`);
    console.log(`📊 Estimated API usage: ${batches.length} requests (Monthly budget: 500K requests)`);

    // Enhanced rate limiting tracking
    let requestCount = 0;
    let minuteStartTime = Date.now();

    // Process each batch with comprehensive error handling
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

          await supabase.rpc('complete_pricing_job', {
            p_job_id: queueJobId,
            p_status: 'completed',
            p_error_message: 'Partial completion due to time limit'
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

          await supabase.rpc('complete_pricing_job', {
            p_job_id: queueJobId,
            p_status: 'cancelled',
            p_error_message: 'Job cancelled by user request'
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

        // **NEW: Enhanced Rate Limiting** - reset counter every minute
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

        // Process this batch with enhanced error handling
        const batchResult = await processBatch(
          supabase, 
          batch, 
          batchIndex, 
          batches.length, 
          justTCGApiKey, 
          progress,
          jobRunId,
          gameMapping.databaseSlug
        );

        // Update progress tracking
        progress.processed += batchResult.processed;
        progress.updated += batchResult.updated;
        progress.errors += batchResult.errors;
        progress.batchesCompleted++;
        requestCount++;

        // Update job progress in database
        await updateJobProgress(supabase, jobRunId, progress);

        // Brief pause between batches for system stability
        if (batchIndex < batches.length - 1) {
          await sleep(200);
        }

      } catch (batchError) {
        console.error(`💥 Error processing batch ${batchIndex + 1}:`, batchError);
        progress.errors += batch.length;
        progress.processed += batch.length;
        progress.batchesCompleted++;
        progress.retryAttempts++;

        // Update progress even on errors
        await updateJobProgress(supabase, jobRunId, progress);
      }
    }

    // Determine final job status with enhanced logic
    const finalStatus = progress.errors === 0 ? 'completed' : 
                       (progress.updated > 0 ? 'completed' : 'error');
    const finalError = finalStatus === 'error' ? 
                      `${progress.errors} variants failed to update` : null;

    // Finalize job run
    await supabase.rpc('finish_pricing_job_run', {
      p_job_id: jobRunId,
      p_status: finalStatus,
      p_actual_batches: progress.batchesCompleted,
      p_cards_processed: progress.processed,
      p_variants_updated: progress.updated,
      p_error: finalError
    });

    // Complete queue job
    await supabase.rpc('complete_pricing_job', {
      p_job_id: queueJobId,
      p_status: finalStatus,
      p_error_message: finalError
    });

    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
    
    // **NEW: Record Performance Metrics**
    await recordPerformanceMetrics(supabase, gameMapping.databaseSlug, progress, elapsedSeconds);
    
    console.log(`🎉 Enhanced pricing refresh completed successfully in ${elapsedSeconds}s!`);
    console.log(`📊 Final results: ${progress.updated}/${progress.processed} variants updated from ${progress.totalFound} found`);
    console.log(`⚡ API efficiency: Used ${progress.apiRequestsUsed} requests (~${Math.round(progress.apiRequestsUsed/MAX_REQUESTS_PER_MINUTE*100)}% of rate limit)`);
    console.log(`🔄 Retry attempts: ${progress.retryAttempts}, Circuit breaker status: ${progress.circuitBreakerTripped ? 'tripped' : 'stable'}`);

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
      retryAttempts: progress.retryAttempts,
      processingTimeSeconds: elapsedSeconds,
      circuitBreakerTripped: progress.circuitBreakerTripped,
      message: `Successfully processed ${progress.processed} variants in ${progress.batchesCompleted} batches for ${gameMapping.displayName}`,
      queue_id: queueJobId
    };

    return new Response(JSON.stringify(result), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('💥 Critical error in enhanced pricing refresh:', error);
    
    // Update job status to error if we have IDs
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
        console.error('❌ Error updating job run status:', updateError);
      }
    }

    if (queueJobId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase.rpc('complete_pricing_job', {
          p_job_id: queueJobId,
          p_status: 'failed',
          p_error_message: String(error).slice(0, 500)
        });
      } catch (updateError) {
        console.error('❌ Error updating queue job status:', updateError);
      }
    }

    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Unknown error occurred',
      details: String(error).slice(0, 500)
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});