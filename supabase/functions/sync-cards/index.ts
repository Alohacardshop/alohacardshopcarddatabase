import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { JustTCGClient } from '../_shared/justtcg-client.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { gameSlug, setCode } = await req.json()
    
    if (!gameSlug || !setCode) {
      throw new Error('gameSlug and setCode are required')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const justTCGApiKey = Deno.env.get('JUSTTCG_API_KEY')
    if (!justTCGApiKey) {
      throw new Error('JUSTTCG_API_KEY environment variable is required')
    }

    // Get set from database
    const { data: set, error: setError } = await supabaseClient
      .from('sets')
      .select('*, games(slug)')
      .eq('code', setCode)
      .eq('games.slug', gameSlug)
      .single()

    if (setError || !set) {
      throw new Error(`Set not found: ${gameSlug}/${setCode}`)
    }

    // Check if already synced recently
    if (set.sync_status === 'completed' && set.last_synced_at) {
      const lastSync = new Date(set.last_synced_at)
      const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60)
      
      if (hoursSinceSync < 24) {
        return new Response(
          JSON.stringify({
            success: true,
            message: `Set ${setCode} was already synced ${hoursSinceSync.toFixed(1)} hours ago`,
            job_id: null
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
    }

    const client = new JustTCGClient(justTCGApiKey)

    // Create sync job
    const { data: job, error: jobError } = await supabaseClient
      .from('sync_jobs')
      .insert({
        type: 'cards',
        game_slug: gameSlug,
        set_code: setCode,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (jobError) {
      throw new Error(`Failed to create sync job: ${jobError.message}`)
    }

    console.log(`Starting cards sync for ${gameSlug}/${setCode}, job ID: ${job.id}`)

    try {
      // Update set status
      await supabaseClient
        .from('sets')
        .update({ sync_status: 'syncing' })
        .eq('id', set.id)

      let allCards: any[] = []
      let page = 1
      let hasMore = true

      // Fetch all cards with pagination
      while (hasMore) {
        const response = await client.getCards(gameSlug, setCode, page, 200)
        allCards = allCards.concat(response.cards)
        
        hasMore = response.pagination?.has_more || false
        page++
        
        console.log(`Fetched page ${page - 1}, total cards: ${allCards.length}`)
        
        // Update progress
        await supabaseClient
          .from('sync_jobs')
          .update({ 
            progress: { 
              current: allCards.length, 
              total: response.pagination?.total || allCards.length,
              rate: 0 
            }
          })
          .eq('id', job.id)
      }

      console.log(`Fetched ${allCards.length} cards for ${gameSlug}/${setCode}`)

      let syncedCards = 0
      let syncedVariants = 0
      const errors: string[] = []

      // Process cards in batches
      const batchSize = 50
      for (let i = 0; i < allCards.length; i += batchSize) {
        const batch = allCards.slice(i, i + batchSize)
        
        for (const card of batch) {
          try {
            // Insert card
            const { data: insertedCard, error: cardError } = await supabaseClient
              .from('cards')
              .upsert({
                set_id: set.id,
                name: card.name,
                number: card.number,
                rarity: card.rarity,
                justtcg_card_id: card.id,
                tcgplayer_id: card.tcgplayer_id,
                image_url: card.image_url
              }, {
                onConflict: 'justtcg_card_id'
              })
              .select()
              .single()

            if (cardError) {
              errors.push(`Card ${card.name}: ${cardError.message}`)
              continue
            }

            syncedCards++

            // Insert variants if present
            if (card.variants && card.variants.length > 0) {
              for (const variant of card.variants) {
                try {
                  const { error: variantError } = await supabaseClient
                    .from('variants')
                    .upsert({
                      card_id: insertedCard.id,
                      condition: variant.condition,
                      printing: variant.printing || 'normal',
                      price_cents: variant.price_cents,
                      justtcg_variant_id: variant.id
                    }, {
                      onConflict: 'justtcg_variant_id'
                    })

                  if (variantError) {
                    errors.push(`Variant ${variant.id}: ${variantError.message}`)
                  } else {
                    syncedVariants++
                  }
                } catch (error) {
                  errors.push(`Variant ${variant.id}: ${error.message}`)
                }
              }
            }

          } catch (error) {
            const errorMsg = `Card ${card.name}: ${error.message}`
            errors.push(errorMsg)
            console.error(errorMsg)
          }
        }

        // Update progress after each batch
        await supabaseClient
          .from('sync_jobs')
          .update({ 
            progress: { 
              current: Math.min(i + batchSize, allCards.length),
              total: allCards.length,
              rate: 0
            }
          })
          .eq('id', job.id)
      }

      // Update set with sync completion
      await supabaseClient
        .from('sets')
        .update({
          sync_status: 'completed',
          card_count: syncedCards,
          last_synced_at: new Date().toISOString()
        })
        .eq('id', set.id)

      // Complete job
      const results = {
        total_fetched: allCards.length,
        synced_cards: syncedCards,
        synced_variants: syncedVariants,
        error_count: errors.length,
        errors: errors.slice(0, 10) // Limit error details
      }

      await supabaseClient
        .from('sync_jobs')
        .update({
          status: errors.length > allCards.length / 2 ? 'failed' : 'completed',
          progress: { current: allCards.length, total: allCards.length, rate: 0 },
          results,
          error_details: errors.length > 0 ? { errors: errors.slice(0, 10) } : null,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id)

      console.log(`Cards sync completed: ${syncedCards}/${allCards.length} cards, ${syncedVariants} variants`)

      return new Response(
        JSON.stringify({
          success: true,
          job_id: job.id,
          results
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )

    } catch (error) {
      // Mark job and set as failed
      await Promise.all([
        supabaseClient
          .from('sync_jobs')
          .update({
            status: 'failed',
            error_details: { message: error.message, stack: error.stack },
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id),
        supabaseClient
          .from('sets')
          .update({ sync_status: 'failed' })
          .eq('id', set.id)
      ])

      throw error
    }

  } catch (error) {
    console.error('Sync cards error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})