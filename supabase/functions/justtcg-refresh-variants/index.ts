import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PricingVariant {
  id: string;
  justtcg_variant_id: string;
  price_cents: number;
  last_updated: string;
  card_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🔄 JustTCG Refresh Variants - Starting...');
  const startTime = Date.now();

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { game = 'pokemon', test_mode = false, limit = 200 } = await req.json();
    
    console.log(`🎯 Processing variants for game: ${game}, test_mode: ${test_mode}, limit: ${limit}`);

    // Start pricing job run
    const batchLimit = test_mode ? 10 : limit;
    const expectedBatches = Math.ceil(batchLimit / 50); // Assuming 50 cards per batch
    
    const { data: jobId, error: jobStartError } = await supabase.rpc('start_pricing_job_run', {
      p_game: game,
      p_expected_batches: expectedBatches
    });

    if (jobStartError) {
      console.error('❌ Failed to start pricing job run:', jobStartError);
      throw new Error(`Failed to start job run: ${jobStartError.message}`);
    }

    console.log(`✅ Started pricing job run with ID: ${jobId}`);

    // Fetch cards with variants for the specific game
    const { data: cardData, error: fetchError } = await supabase.rpc('fetch_cards_with_variants', {
      p_game: game,
      p_limit: batchLimit,
      p_offset: 0
    });

    if (fetchError) {
      console.error('❌ Failed to fetch cards:', fetchError);
      await supabase.rpc('finish_pricing_job_run', {
        p_job_id: jobId,
        p_status: 'error',
        p_error: `Failed to fetch cards: ${fetchError.message}`
      });
      throw new Error(`Failed to fetch cards: ${fetchError.message}`);
    }

    if (!cardData || cardData.length === 0) {
      console.log('⚠️ No cards found for processing');
      await supabase.rpc('finish_pricing_job_run', {
        p_job_id: jobId,
        p_status: 'completed',
        p_actual_batches: 0,
        p_cards_processed: 0,
        p_variants_updated: 0
      });
      
      return new Response(JSON.stringify({
        success: true,
        message: 'No cards found to process',
        job_id: jobId,
        cards_processed: 0,
        variants_updated: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📊 Found ${cardData.length} cards to process`);

    let totalCardsProcessed = 0;
    let totalVariantsUpdated = 0;
    let actualBatches = 0;
    const batchSize = 50;

    // Process cards in batches
    for (let i = 0; i < cardData.length; i += batchSize) {
      const batch = cardData.slice(i, i + batchSize);
      actualBatches++;
      
      console.log(`🔄 Processing batch ${actualBatches} (${batch.length} cards)`);

      // Get card IDs for this batch
      const cardIds = batch.map((card: any) => card.card_id);

      // Fetch variants that need updating for these cards
      const { data: variants, error: variantsError } = await supabase.rpc('get_variants_for_pricing_update', {
        p_card_ids: cardIds
      });

      if (variantsError) {
        console.error('❌ Failed to fetch variants:', variantsError);
        continue;
      }

      if (!variants || variants.length === 0) {
        console.log('⚠️ No variants found for this batch');
        totalCardsProcessed += batch.length;
        continue;
      }

      console.log(`💰 Fetching pricing for ${variants.length} variants`);

      // Prepare batch request for JustTCG API
      const priceRequests = batch.map((card: any) => ({
        tcgplayerId: card.justtcg_card_id
      }));

      // Call the justtcg-prices function to get current pricing
      const { data: priceResponse, error: priceError } = await supabase.functions.invoke('justtcg-prices', {
        body: priceRequests
      });

      if (priceError) {
        console.error('❌ Failed to fetch prices:', priceError);
        totalCardsProcessed += batch.length;
        continue;
      }

      if (!priceResponse?.success || !priceResponse?.data) {
        console.log('⚠️ No price data returned for this batch');
        totalCardsProcessed += batch.length;
        continue;
      }

      // Process and update variants with new pricing data
      const priceData = priceResponse.data;
      const variantUpdates: any[] = [];

      for (const variant of variants) {
        // Find matching price data
        const matchingPrice = priceData.find((p: any) => 
          p.tcgplayerId === variant.justtcg_variant_id ||
          batch.some((card: any) => card.justtcg_card_id === p.tcgplayerId)
        );

        if (matchingPrice && matchingPrice.price) {
          const priceCents = Math.round(matchingPrice.price * 100);
          const marketPriceCents = matchingPrice.marketPrice ? Math.round(matchingPrice.marketPrice * 100) : priceCents;
          const lowPriceCents = matchingPrice.lowPrice ? Math.round(matchingPrice.lowPrice * 100) : priceCents;
          const highPriceCents = matchingPrice.highPrice ? Math.round(matchingPrice.highPrice * 100) : priceCents;

          variantUpdates.push({
            card_id: variant.card_id,
            justtcg_variant_id: variant.justtcg_variant_id,
            condition: 'near_mint', // Default condition
            printing: 'normal', // Default printing
            price_cents: priceCents,
            market_price_cents: marketPriceCents,
            low_price_cents: lowPriceCents,
            high_price_cents: highPriceCents,
            last_updated: new Date().toISOString()
          });
        }
      }

      // Update variants in database
      if (variantUpdates.length > 0) {
        const { data: updateResult, error: updateError } = await supabase.rpc('upsert_variants_from_justtcg', {
          p_rows: variantUpdates
        });

        if (updateError) {
          console.error('❌ Failed to update variants:', updateError);
        } else {
          totalVariantsUpdated += updateResult || variantUpdates.length;
          console.log(`✅ Updated ${updateResult || variantUpdates.length} variants`);
        }
      }

      totalCardsProcessed += batch.length;

      // Update job progress
      await supabase.rpc('update_pricing_job_progress', {
        p_job_id: jobId,
        p_actual_batches: actualBatches,
        p_cards_processed: totalCardsProcessed,
        p_variants_updated: totalVariantsUpdated
      });

      // Rate limiting between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Complete the job
    await supabase.rpc('finish_pricing_job_run', {
      p_job_id: jobId,
      p_status: 'completed',
      p_actual_batches: actualBatches,
      p_cards_processed: totalCardsProcessed,
      p_variants_updated: totalVariantsUpdated
    });

    const elapsedMs = Date.now() - startTime;
    console.log(`🎉 Pricing refresh completed in ${elapsedMs}ms`);

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully processed ${totalCardsProcessed} cards and updated ${totalVariantsUpdated} variants`,
      job_id: jobId,
      game: game,
      cards_processed: totalCardsProcessed,
      variants_updated: totalVariantsUpdated,
      batches_processed: actualBatches,
      elapsed_ms: elapsedMs,
      test_mode: test_mode
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Error in justtcg-refresh-variants:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'pricing_refresh_failed',
      message: error.message || 'Unknown error occurred',
      details: String(error).slice(0, 500)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});