import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GameService } from '../_shared/game-service.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🚀 OPTIMIZED: JustTCG Enterprise plan configuration
const BATCH_SIZE = 200; // Increased from 150 to Enterprise limit
const TIME_LIMIT_MS = 4.5 * 60 * 1000; // 4.5 minutes to stay under 5min limit
const MAX_REQUESTS_PER_MINUTE = 400; // 80% of 500/min Enterprise limit
const DAILY_LIMIT = 40000; // 80% of 50K daily Enterprise limit
const CIRCUIT_BREAKER_THRESHOLD = 5; // Open circuit after 5 consecutive failures
const CIRCUIT_BREAKER_TIMEOUT = 30; // Minutes to wait before retry

// 🎯 OPTIMIZED: Default filtering for fastest lookups
const DEFAULT_CONDITION = "Near Mint"; // Focus on Near Mint condition
const DEFAULT_PRINTING = "Normal"; // Focus on Normal printing

interface JustTCGVariant {
  id: string;
  cardId: string;
  price?: number;
  priceChange24h?: number;
  lastUpdated?: number;
  condition?: string;
  printing?: string;
  tcgplayerId?: string; // Added for optimized lookups
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
  dailyRequestsUsed: number; // NEW: Track daily usage
}

interface CircuitBreakerStatus {
  state: string;
  can_proceed: boolean;
}

// 📊 NEW: Enhanced variant lookup with priority optimization
interface OptimizedVariantRequest {
  variantId?: string;     // 1st priority: fastest lookup
  tcgplayerId?: string;   // 2nd priority: fast lookup  
  cardId?: string;        // 3rd priority: moderate lookup
  searchQuery?: string;   // 4th priority: slowest lookup
  condition?: string;     // Default to Near Mint
  printing?: string;      // Default to Normal
}

/**
 * 🔄 BACKWARDS COMPATIBILITY: Normalize Magic card IDs from old to new format
 */
async function normalizeMagicCardId(supabase: any, cardId: string): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('normalize_magic_card_id', { card_id: cardId });
    if (error) {
      console.warn('Failed to normalize card ID:', error);
      return cardId; // Fallback to original
    }
    return data || cardId;
  } catch (error) {
    console.warn('Exception normalizing card ID:', error);
    return cardId; // Fallback to original
  }
}

/**
 * Sleep utility for rate limiting and backoff
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 🆕 Check daily API usage limit (Enterprise plan: 50K/day, using 40K limit)
 */
async function checkDailyUsage(supabase: any): Promise<number> {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { data, error } = await supabase
      .from('pricing_api_usage')
      .select('*', { count: 'exact', head: true })
      .gte('recorded_at', todayStart.toISOString());
      
    if (error) {
      console.error('Error checking daily usage:', error);
      return 0;
    }
    
    const dailyCount = data?.length || 0;
    console.log(`📊 Daily API usage: ${dailyCount}/${DAILY_LIMIT} requests`);
    
    return dailyCount;
  } catch (error) {
    console.error('Exception checking daily usage:', error);
    return 0;
  }
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
 * 🚀 OPTIMIZED: Create optimized variant requests with priority-based lookups
 */
function createOptimizedRequests(variants: any[]): OptimizedVariantRequest[] {
  return variants.map(variant => {
    const request: OptimizedVariantRequest = {
      condition: DEFAULT_CONDITION,
      printing: DEFAULT_PRINTING
    };
    
    // Priority 1: Use variantId if available (fastest lookup)
    if (variant.justtcg_variant_id) {
      request.variantId = variant.justtcg_variant_id;
      return request;
    }
    
    // Priority 2: Use tcgplayerId if available (fast lookup)
    if (variant.tcgplayer_id) {
      request.tcgplayerId = variant.tcgplayer_id;
      return request;
    }
    
    // Priority 3: Use cardId (moderate speed)
    if (variant.card_id) {
      request.cardId = variant.card_id;
      return request;
    }
    
    // Priority 4: Fallback to search query (slowest)
    if (variant.name) {
      request.searchQuery = variant.name;
      return request;
    }
    
    return request;
  });
}

/**
 * 🚀 OPTIMIZED: Enhanced API call with priority-based lookups and Enterprise limits
 */
async function fetchVariantPricing(
  variants: any[],
  apiKey: string,
  supabase: any,
  jobRunId: string,
  game: string
): Promise<JustTCGVariant[]> {
  const maxRetries = 3;
  let attempt = 0;
  
  const JTCG_BASE = Deno.env.get('JTCG_BASE') || 'https://api.justtcg.com/v1';
  const url = `${JTCG_BASE}/cards`;
  
  // 🎯 OPTIMIZED: Create priority-based requests
  const requestBody = createOptimizedRequests(variants);
  
  console.log(`🔄 Fetching pricing for ${variants.length} variants using optimized lookups (attempt 1/${maxRetries})`);
  console.log(`🎯 Lookup distribution: variantId=${requestBody.filter(r => r.variantId).length}, tcgplayerId=${requestBody.filter(r => r.tcgplayerId).length}, cardId=${requestBody.filter(r => r.cardId).length}, search=${requestBody.filter(r => r.searchQuery).length}`);
  
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
        body: JSON.stringify({
          requests: requestBody, // 🚀 OPTIMIZED: Send structured requests
          defaultCondition: DEFAULT_CONDITION,
          defaultPrinting: DEFAULT_PRINTING
        })
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
      
      // Extract variants from cards with enhanced data
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
              condition: variant.condition || DEFAULT_CONDITION,
              printing: variant.printing || DEFAULT_PRINTING,
              tcgplayerId: variant.tcgplayerId || card.tcgplayerId
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
      p_error_message: error.slice(0, 500)
    });
  } catch (retryError) {
    console.error('⚠️ Failed to queue variant for retry:', retryError);
  }
}

/**
 * Process a single batch of variants with enhanced error handling
 */
async function processBatch(
  supabase: any,
  variants: any[],
  batchIndex: number,
  totalBatches: number,
  apiKey: string,
  progress: JobProgress,
  jobRunId: string,
  game: string
): Promise<{ processed: number; updated: number; errors: number }> {
  
  console.log(`\n🔄 Processing batch ${batchIndex + 1}/${totalBatches} (${variants.length} variants)`);
  
  let processed = 0;
  let updated = 0;
  let errors = 0;
  
  try {
    // Fetch pricing data using optimized lookups
    const pricingData = await fetchVariantPricing(variants, apiKey, supabase, jobRunId, game);
    progress.apiRequestsUsed++;
    progress.dailyRequestsUsed++;
    
    console.log(`📊 Batch ${batchIndex + 1}: Found ${pricingData.length} pricing records`);
    
    if (pricingData.length === 0) {
      console.log(`⚠️ No pricing data returned for batch ${batchIndex + 1}`);
      processed = variants.length;
      errors = variants.length;
      return { processed, updated, errors };
    }
    
    // Process pricing updates with better matching
    const updateRecords = [];
    
    for (const variant of variants) {
      processed++;
      
      // Find matching pricing data using multiple strategies
      let matchedPricing = null;
      
      // Strategy 1: Match by justtcg_variant_id (most accurate)
      if (variant.justtcg_variant_id) {
        matchedPricing = pricingData.find(p => p.id === variant.justtcg_variant_id);
      }
      
      // Strategy 2: Match by card relationship
      if (!matchedPricing && variant.card_id) {
        matchedPricing = pricingData.find(p => 
          p.cardId === variant.card_id && 
          (p.condition === DEFAULT_CONDITION || !p.condition) &&
          (p.printing === DEFAULT_PRINTING || !p.printing)
        );
      }
      
      if (matchedPricing && matchedPricing.price !== undefined && matchedPricing.price !== null) {
        const priceCents = Math.round((matchedPricing.price || 0) * 100);
        
        updateRecords.push({
          card_id: variant.card_id,
          justtcg_variant_id: matchedPricing.id,
          condition: variant.condition,
          printing: variant.printing,
          price_cents: priceCents,
          market_price_cents: matchedPricing.priceChange24h ? Math.round((matchedPricing.price + matchedPricing.priceChange24h) * 100) : priceCents,
          low_price_cents: priceCents,
          high_price_cents: priceCents,
          last_updated: new Date().toISOString()
        });
        
        updated++;
      } else {
        console.log(`⚠️ No pricing match found for variant ${variant.id}`);
        await queueVariantForRetry(supabase, variant.id, game, 'No pricing data found');
        errors++;
      }
    }
    
    // Bulk update variants
    if (updateRecords.length > 0) {
      console.log(`💾 Updating ${updateRecords.length} variants in database`);
      
      const { error: upsertError } = await supabase.rpc('upsert_variants_from_justtcg', {
        p_rows: updateRecords
      });
      
      if (upsertError) {
        console.error(`❌ Database update failed for batch ${batchIndex + 1}:`, upsertError);
        errors += updateRecords.length;
        updated -= updateRecords.length;
      } else {
        console.log(`✅ Batch ${batchIndex + 1}: Successfully updated ${updateRecords.length} variants`);
      }
    }
    
    console.log(`📋 Batch ${batchIndex + 1} summary: ${processed} processed, ${updated} updated, ${errors} errors`);
    
  } catch (batchError) {
    console.error(`💥 Critical error in batch ${batchIndex + 1}:`, batchError);
    
    // Queue all variants in this batch for retry
    for (const variant of variants) {
      await queueVariantForRetry(supabase, variant.id, game, String(batchError));
    }
    
    processed = variants.length;
    errors = variants.length;
  }
  
  return { processed, updated, errors };
}

/**
 * Record performance metrics for analytics
 */
async function recordPerformanceMetrics(
  supabase: any,
  game: string,
  progress: JobProgress,
  elapsedSeconds: number
): Promise<void> {
  try {
    const successRate = progress.processed > 0 ? (progress.updated / progress.processed) * 100 : 0;
    
    const { error } = await supabase
      .from('pricing_performance_metrics')
      .upsert({
        game,
        variants_processed: progress.processed,
        variants_updated: progress.updated,
        api_requests_used: progress.apiRequestsUsed,
        processing_time_seconds: elapsedSeconds,
        batch_size_used: BATCH_SIZE,
        success_rate: successRate,
        recorded_date: new Date().toISOString().split('T')[0]
      }, {
        onConflict: 'game,recorded_date'
      });
      
    if (error) {
      console.error('⚠️ Failed to record performance metrics:', error);
    } else {
      console.log(`📊 Performance metrics recorded: ${successRate.toFixed(1)}% success rate`);
    }
  } catch (error) {
    console.error('⚠️ Exception recording performance metrics:', error);
  }
}

// 🚀 ENHANCED PRICING REFRESH SERVERLESS FUNCTION
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🎯 Enhanced JustTCG pricing refresh started with Enterprise optimizations');
  
  let jobRunId: string | null = null;
  let queueJobId: string | null = null;
  const startTime = Date.now();

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get JustTCG API key
    const justTCGApiKey = Deno.env.get('JUSTTCG_API_KEY');
    if (!justTCGApiKey) {
      throw new Error('JUSTTCG_API_KEY environment variable is required');
    }

    // Parse game parameter
    const { game: requestedGame, priority = 0, test_mode = false, test_limit } = await req.json();
    
    if (!requestedGame) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Game parameter is required' 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`🎮 Processing pricing refresh for: ${requestedGame}`);
    console.log(`🚀 Enterprise optimizations: BATCH_SIZE=${BATCH_SIZE}, MAX_REQUESTS_PER_MINUTE=${MAX_REQUESTS_PER_MINUTE}, DAILY_LIMIT=${DAILY_LIMIT}`);

    // 🆕 Check daily usage limit before proceeding
    const dailyUsage = await checkDailyUsage(supabase);
    if (dailyUsage >= DAILY_LIMIT) {
      console.log(`🚫 Daily limit reached: ${dailyUsage}/${DAILY_LIMIT} requests`);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Daily API limit reached',
        daily_usage: dailyUsage,
        daily_limit: DAILY_LIMIT
      }), { 
        status: 429, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Initialize GameService and get mapping
    const gameService = new GameService(supabase);
    const gameMapping = await gameService.getGameMapping(requestedGame);
    
    if (!gameMapping) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Unsupported game: ${requestedGame}`,
        supported_games: ['mtg', 'pokemon', 'pokemon-japan']
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Enqueue pricing job (prevents duplicate runs)
    console.log(`🔄 Enqueuing pricing job for ${gameMapping.displayName}`);
    const { data: queueData, error: queueError } = await supabase.rpc('enqueue_pricing_job', {
      p_game: gameMapping.databaseSlug,
      p_priority: priority
    });

    if (queueError) {
      console.error('❌ Failed to enqueue pricing job:', queueError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Failed to enqueue job: ${queueError.message}` 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    queueJobId = queueData;
    console.log(`✅ Job queued with ID: ${queueJobId}`);

    // Check circuit breaker status
    const circuitBreakerStatus = await checkCircuitBreaker(supabase, gameMapping.databaseSlug);
    if (!circuitBreakerStatus.can_proceed) {
      console.log(`🚫 Circuit breaker is ${circuitBreakerStatus.state} for ${gameMapping.displayName}`);
      
      await supabase.rpc('complete_pricing_job', {
        p_job_id: queueJobId,
        p_status: 'failed',
        p_error_message: `Circuit breaker ${circuitBreakerStatus.state} - too many recent failures`
      });
      
      return new Response(JSON.stringify({ 
        success: false,
        error: `Circuit breaker ${circuitBreakerStatus.state}`,
        message: 'Too many recent failures. System is temporarily protecting against further errors.'
      }), { 
        status: 503, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Fetch all cards and their stale variants for the specified game
    console.log(`📊 Fetching cards and variants for ${gameMapping.displayName}...`);
    
    const { data: cardsData, error: cardsError } = await supabase.rpc('fetch_cards_with_variants', {
      p_game: gameMapping.databaseSlug,
      p_limit: test_mode && test_limit ? test_limit : 10000,
      p_offset: 0
    });

    if (cardsError) {
      throw new Error(`Failed to fetch cards: ${cardsError.message}`);
    }

    if (!cardsData || cardsData.length === 0) {
      console.log(`⚠️ No cards found for ${gameMapping.displayName}`);
      
      await supabase.rpc('complete_pricing_job', {
        p_job_id: queueJobId,
        p_status: 'completed',
        p_error_message: null
      });
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: `No cards found for ${gameMapping.displayName}`,
        totalFound: 0,
        processed: 0,
        updated: 0
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const cardIds = cardsData.map((card: any) => card.card_id);
    console.log(`🎯 Found ${cardIds.length} cards to process for ${gameMapping.displayName}`);

    // Get variants that need pricing updates (older than 1 hour)
    const { data: variants, error: variantsError } = await supabase.rpc('get_variants_for_pricing_update', {
      p_card_ids: cardIds
    });

    if (variantsError) {
      throw new Error(`Failed to fetch variants: ${variantsError.message}`);
    }

    if (!variants || variants.length === 0) {
      console.log(`✅ All pricing data is fresh for ${gameMapping.displayName}`);
      
      await supabase.rpc('complete_pricing_job', {
        p_job_id: queueJobId,
        p_status: 'completed',
        p_error_message: null
      });
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: `All pricing data is current for ${gameMapping.displayName}`,
        totalFound: cardIds.length,
        processed: 0,
        updated: 0,
        allCurrent: true
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`⚡ Found ${variants.length} variants needing price updates`);

    // 🆕 ENTERPRISE: Calculate expected batches with new batch size
    const expectedBatches = Math.ceil(variants.length / BATCH_SIZE);
    
    // Start job run tracking
    const { data: jobRunData, error: jobRunError } = await supabase.rpc('start_pricing_job_run', {
      p_game: gameMapping.databaseSlug,
      p_expected_batches: expectedBatches
    });

    if (jobRunError) {
      throw new Error(`Failed to start job run: ${jobRunError.message}`);
    }

    jobRunId = jobRunData;
    console.log(`📊 Started job run ${jobRunId} with ${expectedBatches} expected batches`);

    // Initialize progress tracking
    const progress: JobProgress = {
      totalFound: variants.length,
      processed: 0,
      updated: 0,
      errors: 0,
      batchesCompleted: 0,
      totalBatches: expectedBatches,
      apiRequestsUsed: 0,
      elapsedTimeMs: 0,
      retryAttempts: 0,
      circuitBreakerTripped: false,
      dailyRequestsUsed: dailyUsage // Track from current usage
    };

    // 🚀 OPTIMIZED: Process variants in larger Enterprise-sized batches
    const batches = [];
    for (let i = 0; i < variants.length; i += BATCH_SIZE) {
      batches.push(variants.slice(i, i + BATCH_SIZE));
    }

    console.log(`⚡ Processing ${batches.length} batches of up to ${BATCH_SIZE} variants each (Enterprise optimized)`);
    console.log(`📊 Estimated API usage: ${batches.length} requests (Daily remaining: ${DAILY_LIMIT - dailyUsage})`);

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

        // 🆕 Check daily limit before each batch
        if (progress.dailyRequestsUsed >= DAILY_LIMIT) {
          console.log(`🚫 Daily limit would be exceeded: ${progress.dailyRequestsUsed}/${DAILY_LIMIT}`);
          
          await supabase.rpc('finish_pricing_job_run', {
            p_job_id: jobRunId,
            p_status: 'completed',
            p_actual_batches: progress.batchesCompleted,
            p_cards_processed: progress.processed,
            p_variants_updated: progress.updated,
            p_error: `Daily API limit reached: ${progress.dailyRequestsUsed}/${DAILY_LIMIT}`
          });

          return new Response(JSON.stringify({ 
            success: true, 
            daily_limit_reached: true,
            game: gameMapping.databaseSlug,
            processed: progress.processed,
            updated: progress.updated,
            daily_usage: progress.dailyRequestsUsed
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

        // **ENHANCED Rate Limiting** - reset counter every minute
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
    
    // Record Performance Metrics
    await recordPerformanceMetrics(supabase, gameMapping.databaseSlug, progress, elapsedSeconds);
    
    console.log(`🎉 Enterprise-optimized pricing refresh completed in ${elapsedSeconds}s!`);
    console.log(`📊 Final results: ${progress.updated}/${progress.processed} variants updated from ${progress.totalFound} found`);
    console.log(`⚡ API efficiency: Used ${progress.apiRequestsUsed} requests (Daily: ${progress.dailyRequestsUsed}/${DAILY_LIMIT})`);
    console.log(`🚀 Enterprise optimizations: ${BATCH_SIZE} batch size, priority-based lookups, ${DEFAULT_CONDITION}+${DEFAULT_PRINTING} filtering`);

    const result = {
      success: true,
      game: gameMapping.databaseSlug,
      gameDisplayName: gameMapping.displayName,
      totalFound: progress.totalFound,
      batchesProcessed: progress.batchesCompleted,
      variantsProcessed: progress.processed,
      variantsUpdated: progress.updated,
      apiRequestsUsed: progress.apiRequestsUsed,
      dailyRequestsUsed: progress.dailyRequestsUsed,
      errors: progress.errors,
      retryAttempts: progress.retryAttempts,
      processingTimeSeconds: elapsedSeconds,
      circuitBreakerTripped: progress.circuitBreakerTripped,
      message: `Successfully processed ${progress.processed} variants in ${progress.batchesCompleted} batches for ${gameMapping.displayName} (Enterprise optimized)`,
      queue_id: queueJobId,
      enterprise_optimizations: {
        batch_size: BATCH_SIZE,
        daily_limit: DAILY_LIMIT,
        rate_limit: MAX_REQUESTS_PER_MINUTE,
        default_condition: DEFAULT_CONDITION,
        default_printing: DEFAULT_PRINTING
      }
    };

    return new Response(JSON.stringify(result), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('💥 Critical error in enterprise pricing refresh:', error);
    
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