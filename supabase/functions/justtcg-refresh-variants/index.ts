import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { JustTCGClient } from '../_shared/justtcg-client.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RefreshRequest {
  gameSlug: string;
  setCode?: string; // Optional - if provided, only refresh this set
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const justTCGClient = new JustTCGClient(justTCGApiKey);

    const { gameSlug, setCode }: RefreshRequest = await req.json();

    if (!gameSlug) {
      return new Response(
        JSON.stringify({ error: 'gameSlug is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting variant refresh for game: ${gameSlug}${setCode ? `, set: ${setCode}` : ''}`);

    // Create a sync job
    const { data: syncJob, error: jobError } = await supabase
      .from('sync_jobs')
      .insert({
        type: 'refresh_variants',
        game_slug: gameSlug,
        set_code: setCode,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create sync job: ${jobError.message}`);
    }

    // Start background processing
    const backgroundTask = async () => {
      try {
        let totalProcessed = 0;
        let totalUpdated = 0;

        // Get cards to refresh variants for
        let cardsQuery = supabase
          .from('cards')
          .select(`
            id,
            justtcg_card_id,
            set_id,
            sets!inner(
              code,
              games!inner(slug)
            )
          `)
          .eq('sets.games.slug', gameSlug);

        if (setCode) {
          cardsQuery = cardsQuery.eq('sets.code', setCode);
        }

        const { data: cards, error: cardsError } = await cardsQuery;

        if (cardsError) {
          throw new Error(`Failed to fetch cards: ${cardsError.message}`);
        }

        if (!cards || cards.length === 0) {
          console.log('No cards found to refresh variants for');
          await supabase
            .from('sync_jobs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              progress: 0,
              total: 0,
              results: { processed: 0, updated: 0, message: 'No cards found' }
            })
            .eq('id', syncJob.id);
          return;
        }

        const total = cards.length;
        await supabase
          .from('sync_jobs')
          .update({ 
            progress: 0,
            total
          })
          .eq('id', syncJob.id);

        console.log(`Processing ${total} cards for variant refresh`);

        // Process cards in batches
        const batchSize = 200; // Premium plan: process 200 cards at a time
        for (let i = 0; i < cards.length; i += batchSize) {
          const batch = cards.slice(i, i + batchSize);
          const cardIds = batch
            .filter(card => card.justtcg_card_id)
            .map(card => card.justtcg_card_id);

          if (cardIds.length === 0) {
            totalProcessed += batch.length;
            continue;
          }

          try {
            // Fetch updated card data with variants from JustTCG
            const updatedCards = await justTCGClient.batchGetCards(cardIds);
            
            for (const updatedCard of updatedCards) {
              const dbCard = batch.find(c => c.justtcg_card_id === updatedCard.id);
              if (!dbCard || !updatedCard.variants) continue;

              // Update variants for this card
              for (const variant of updatedCard.variants) {
                const variantData = JustTCGClient.processVariantForStorage(variant);
                
                const { error: variantError } = await supabase
                  .from('variants')
                  .upsert({
                    card_id: dbCard.id,
                    justtcg_variant_id: variant.id,
                    ...variantData
                  }, {
                    onConflict: 'card_id,justtcg_variant_id'
                  });

                if (variantError) {
                  console.error(`Failed to upsert variant ${variant.id}:`, variantError);
                } else {
                  totalUpdated++;
                }
              }

              totalProcessed++;
            }

            // Update progress
            await supabase
              .from('sync_jobs')
              .update({ 
                progress: totalProcessed,
                total
              })
              .eq('id', syncJob.id);

            console.log(`Processed ${totalProcessed}/${total} cards, updated ${totalUpdated} variants`);

          } catch (error) {
            console.error(`Error processing batch ${i}-${i + batchSize}:`, error);
            // Continue with next batch
            totalProcessed += batch.length;
          }
        }

        // Mark job as completed
        await supabase
          .from('sync_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            progress: totalProcessed,
            total,
            results: { 
              processed: totalProcessed, 
              updated: totalUpdated,
              message: `Successfully refreshed variants for ${totalProcessed} cards, updated ${totalUpdated} variants`
            }
          })
          .eq('id', syncJob.id);

        console.log(`Variant refresh completed: ${totalProcessed} cards processed, ${totalUpdated} variants updated`);

      } catch (error) {
        console.error('Background task failed:', error);
        
        // Mark job as failed
        await supabase
          .from('sync_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_details: { message: error.message, stack: error.stack }
          })
          .eq('id', syncJob.id);
      }
    };

    // Start the background task
    backgroundTask();

    return new Response(
      JSON.stringify({
        success: true,
        job_id: syncJob.id,
        message: 'Variant refresh started'
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