import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PAGE = 200;
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

function pricingToVariantUpserts(cards: JustTCGCard[], game: string): any[] {
  const upserts: any[] = [];
  
  for (const card of cards) {
    if (!card.variants) continue;
    
    for (const variant of card.variants) {
      const variantKey = `${card.id}-${variant.condition}-${variant.printing}`;
      
      upserts.push({
        variant_key: variantKey,
        price_cents: variant.price ? Math.round(variant.price * 100) : null,
        market_price_cents: variant.market_price ? Math.round(variant.market_price * 100) : null,
        low_price_cents: variant.low_price ? Math.round(variant.low_price * 100) : null,
        high_price_cents: variant.high_price ? Math.round(variant.high_price * 100) : null,
        updated_at: new Date().toISOString()
      });
    }
  }
  
  return upserts;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const justTCGApiKey = Deno.env.get('JUSTTCG_API_KEY')!;

    const sb = createClient(supabaseUrl, supabaseServiceKey);
    
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
    const { data: cntRow, error: cntErr } = await sb.rpc("catalog_v2_count_cards_by_game", { p_game: game });
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
    const expectedBatches = Math.ceil(totalCards / PAGE);

    console.log(`Found ${totalCards} cards, expecting ${expectedBatches} batches`);

    // Log start
    const { data: runRow, error: runError } = await sb
      .schema('ops')
      .from("pricing_job_runs")
      .insert({ 
        game, 
        expected_batches: expectedBatches 
      })
      .select()
      .single();

    if (runError) {
      console.error('Error creating job run:', runError);
      return new Response(
        JSON.stringify({ success: false, error: String(runError) }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Preflight check
    if (expectedBatches > CEILING) {
      await sb
        .schema('ops')
        .from("pricing_job_runs")
        .update({ 
          status: "preflight_ceiling", 
          finished_at: new Date().toISOString() 
        })
        .eq("id", runRow.id);
        
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

    let actualBatches = 0;
    let cardsProcessed = 0;
    let variantsUpdated = 0;

    // Process cards in batches
    for (let offset = 0; offset < totalCards; offset += PAGE) {
      try {
        // Fetch cards with variants for this batch
        const { data: cards, error: cardsError } = await sb
          .schema('catalog_v2')
          .from("cards_with_variants")
          .select("card_id, variant_key, provider_variant_id, condition, printing, justtcg_card_id")
          .eq("game", game)
          .order("card_id", { ascending: true })
          .range(offset, Math.min(offset + PAGE - 1, totalCards - 1));

        if (cardsError) {
          console.error(`Error fetching cards batch ${offset}-${offset + PAGE}:`, cardsError);
          continue;
        }

        if (!cards || cards.length === 0) {
          console.log(`No cards found in batch ${offset}-${offset + PAGE}`);
          continue;
        }

        // Extract unique JustTCG card IDs
        const cardIds = [...new Set(cards
          .filter(card => card.justtcg_card_id)
          .map(card => card.justtcg_card_id))];

        if (cardIds.length === 0) {
          cardsProcessed += cards.length;
          actualBatches++;
          continue;
        }

        console.log(`Processing batch ${actualBatches + 1}: ${cardIds.length} unique cards`);

        // Fetch pricing from JustTCG
        const pricingData = await fetchJustTcgBatch(cardIds, justTCGApiKey);
        
        // Map to variant upserts for public.variants table
        const variantUpserts: any[] = [];
        const historyInserts: any[] = [];

        for (const card of pricingData) {
          if (!card.variants) continue;
          
          for (const variant of card.variants) {
            // Find matching variant from our database
            const dbVariant = cards.find(c => 
              c.justtcg_card_id === card.id && 
              c.provider_variant_id === variant.id
            );
            
            if (!dbVariant) continue;

            const variantUpdate = {
              card_id: dbVariant.card_id,
              justtcg_variant_id: variant.id,
              price_cents: variant.price ? Math.round(variant.price * 100) : null,
              market_price_cents: variant.market_price ? Math.round(variant.market_price * 100) : null,
              low_price_cents: variant.low_price ? Math.round(variant.low_price * 100) : null,
              high_price_cents: variant.high_price ? Math.round(variant.high_price * 100) : null,
              updated_at: new Date().toISOString()
            };

            variantUpserts.push(variantUpdate);

            // History entry
            historyInserts.push({
              provider: "justtcg",
              game,
              variant_key: dbVariant.variant_key,
              price_cents: variantUpdate.price_cents,
              market_price_cents: variantUpdate.market_price_cents,
              low_price_cents: variantUpdate.low_price_cents,
              high_price_cents: variantUpdate.high_price_cents,
              currency: "USD"
            });
          }
        }

        // Update variants in public.variants table
        if (variantUpserts.length > 0) {
          const { error: variantError } = await sb
            .from("variants")
            .upsert(variantUpserts, { 
              onConflict: 'card_id,justtcg_variant_id' 
            });

          if (variantError) {
            console.error('Error upserting variants:', variantError);
          } else {
            variantsUpdated += variantUpserts.length;
          }
        }

        // Insert history
        if (historyInserts.length > 0) {
          const { error: historyError } = await sb
            .schema('catalog_v2')
            .from("variant_price_history")
            .insert(historyInserts);

          if (historyError) {
            console.error('Error inserting price history:', historyError);
          }
        }

        cardsProcessed += cards.length;
        actualBatches++;

        console.log(`Batch ${actualBatches} complete: ${variantUpserts.length} variants updated`);

        // Rate limiting
        await sleep(125);

      } catch (error) {
        console.error(`Error processing batch ${offset}-${offset + PAGE}:`, error);
        actualBatches++;
      }
    }

    // Update job status
    await sb
      .schema('ops')
      .from("pricing_job_runs")
      .update({
        status: "ok",
        actual_batches: actualBatches,
        cards_processed: cardsProcessed,
        variants_updated: variantsUpdated,
        finished_at: new Date().toISOString()
      })
      .eq("id", runRow.id);

    console.log(`Variant pricing refresh completed: ${cardsProcessed} cards processed, ${variantsUpdated} variants updated`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        game, 
        expectedBatches, 
        actualBatches, 
        cardsProcessed, 
        variantsUpdated 
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in justtcg-refresh-variants:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});