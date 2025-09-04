import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BATCH_SIZE = 50; // Reduced to respect API limits
const CEILING = 470;

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
  tcgplayerId?: string;
  cardName?: string;
  setName?: string;
  gameSlug?: string;
  condition?: string;
  printing?: string;
  price?: number;
  priceChange24h?: number;
  lastUpdated?: number;
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
  const maxRetries = 3;
  let attempt = 0;
  
  const JTCG_BASE = Deno.env.get('JTCG_BASE') || 'https://api.justtcg.com/v1';
  
  // Use the correct cards endpoint with game parameter (per official docs)
  const url = `${JTCG_BASE}/cards?game=${game}&limit=${limit}&offset=${offset}`;
  
  console.log(`🔄 Fetching cards for game ${game}: ${url}`);
  console.log(`🔑 API Key present: ${!!apiKey}, length: ${apiKey?.length || 0}`);
  
  while (attempt < maxRetries) {
    try {
      console.log(`📞 API Call attempt ${attempt + 1}/${maxRetries}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'X-API-Key': apiKey,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });

      console.log(`📡 API Response: ${response.status} ${response.statusText}`);

      if (response.status === 429) {
        const backoffMs = Math.min(100 * Math.pow(2, attempt), 5000);
        console.log(`⏳ Rate limited, backing off for ${backoffMs}ms (attempt ${attempt + 1})`);
        await sleep(backoffMs);
        attempt++;
        continue;
      }

      const responseText = await response.text();
      console.log(`📄 Raw response (first 500 chars): ${responseText.slice(0, 500)}`);

      if (!response.ok) {
        console.error(`❌ JustTCG API error ${response.status}: ${responseText.slice(0, 400)}`);
        
        // For 401/403 errors, throw immediately - don't retry
        if (response.status === 401 || response.status === 403) {
          throw new Error(`API authentication failed (${response.status}): ${responseText}`);
        }
        
        // For other errors, try next attempt
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
        console.error(`📄 Raw response that failed to parse: ${responseText}`);
        return [];
      }
      
      console.log(`📊 Response structure:`, {
        keys: Object.keys(raw || {}),
        dataType: Array.isArray(raw?.data) ? 'array' : typeof raw?.data,
        dataLength: Array.isArray(raw?.data) ? raw.data.length : 'n/a'
      });
      
      // Handle different response formats from JustTCG API
      let cards: any[] = [];
      
      if (raw?.data && Array.isArray(raw.data)) {
        cards = raw.data;
        console.log(`✅ Found ${cards.length} cards in response.data`);
      } else if (Array.isArray(raw)) {
        cards = raw;
        console.log(`✅ Found ${cards.length} cards in root array`);
      } else if (raw?.cards && Array.isArray(raw.cards)) {
        cards = raw.cards;
        console.log(`✅ Found ${cards.length} cards in response.cards`);
      } else {
        console.error('❌ Unexpected API response format:', {
          hasData: !!raw?.data,
          hasCards: !!raw?.cards,
          isArray: Array.isArray(raw),
          keys: Object.keys(raw || {}),
          sample: JSON.stringify(raw).slice(0, 200)
        });
        return [];
      }
      
      if (cards.length === 0) {
        console.log(`⚠️ No cards returned from API for game: ${game}`);
        return [];
      }
      
      // Log sample card structure
      console.log(`🃏 Sample card structure:`, JSON.stringify(cards[0], null, 2).slice(0, 500));
      
      // Flatten all variants from all cards
      const allVariants: JustTCGVariant[] = [];
      
      for (const card of cards) {
        // Handle different card structures
        const cardVariants = card.variants || card.prices || [card]; // Fallback to card itself if no variants
        
        if (Array.isArray(cardVariants)) {
          for (const variant of cardVariants) {
            // Ensure variant has required fields
            if (variant && (variant.id || variant.variantId)) {
              allVariants.push({
                ...variant,
                id: variant.id || variant.variantId || `${card.id || card.cardId}_${allVariants.length}`,
                cardId: card.id || card.cardId || variant.cardId,
                tcgplayerId: card.tcgplayerId || variant.tcgplayerId,
                cardName: card.name || card.cardName || variant.cardName,
                setName: card.set || card.setName || variant.setName,
                gameSlug: game,
                price: variant.price || variant.marketPrice,
                condition: variant.condition || 'near_mint',
                printing: variant.printing || variant.foil ? 'foil' : 'normal'
              });
            }
          }
        } else {
          console.log(`⚠️ Card has no variants array: ${card.name || card.id}`);
        }
      }
      
      console.log(`🎯 Extracted ${allVariants.length} variants from ${cards.length} cards`);
      
      // If no variants found, log the structure for debugging
      if (allVariants.length === 0 && cards.length > 0) {
        console.error('❌ No variants extracted. Sample card structure:', JSON.stringify(cards[0], null, 2));
      }
      
      return allVariants;
      
    } catch (error) {
      console.error(`❌ Attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries - 1) {
        console.error('💥 All JustTCG variants attempts failed');
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
    language: null, // JustTCG doesn't seem to provide language in this format
    printing: variant.printing || null,
    condition: variant.condition || null,
    sku: null, // Not provided in this format
    currency: 'USD', // JustTCG prices are in USD
    price: variant.price?.toString() || null,
    market_price: null, // Not provided in this response format
    low_price: null,
    mid_price: null,
    high_price: null,
    data: { 
      raw: variant,
      tcgplayerId: variant.tcgplayerId,
      cardName: variant.cardName,
      setName: variant.setName
    },
    updated_from_source_at: variant.lastUpdated 
      ? new Date(variant.lastUpdated * 1000).toISOString() 
      : new Date().toISOString()
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

    console.log(`Starting variant pricing refresh for game: ${game}`);
    console.log(`API Key configured: ${!!justTCGApiKey}`);
    console.log(`JTCG_BASE: ${Deno.env.get('JTCG_BASE') || 'https://api.justtcg.com/v1'}`);

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

      console.log(`Processing batch ${batchNumber + 1}: fetching cards at offset ${offset}`);

      // Fetch cards (with embedded variants) from JustTCG
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