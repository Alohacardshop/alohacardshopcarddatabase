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
      let offset = 0
      let hasMore = true
      const batchSize = 100

      // Fetch all cards with offset-based pagination (Premium plan optimized)
      while (hasMore) {
        const response = await client.getCards(gameSlug, set.justtcg_set_id, offset, batchSize)
        allCards = allCards.concat(response.cards)
        
        hasMore = response.pagination?.has_more || response.cards.length === batchSize
        offset += batchSize
        
        console.log(`Fetched offset ${offset - batchSize}-${offset}, total cards: ${allCards.length}`)
        
        // Update progress during fetch
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

      // Process cards in optimized batches for database operations
      const dbBatchSize = 25 // Optimized batch size for database performance
      for (let i = 0; i < allCards.length; i += dbBatchSize) {
        const batch = allCards.slice(i, i + dbBatchSize)
        
        // Prepare card data using client helper
        const cardsBatch = batch.map(card => ({
          set_id: set.id,
          ...JustTCGClient.processCardForStorage(card)
        }))

        try {
          // Batch insert cards
          const { data: insertedCards, error: cardsError } = await supabaseClient
            .from('cards')
            .upsert(cardsBatch, {
              onConflict: 'justtcg_card_id'
            })
            .select()

          if (cardsError) {
            for (const card of batch) {
              errors.push(`Card ${card.name}: ${cardsError.message}`)
            }
            continue
          }

          syncedCards += insertedCards.length

          // Process variants for this batch
          const variantsBatch: any[] = []
          for (let j = 0; j < batch.length; j++) {
            const card = batch[j]
            const insertedCard = insertedCards.find(ic => ic.justtcg_card_id === card.id)
            
            if (insertedCard && card.variants && card.variants.length > 0) {
              for (const variant of card.variants) {
                variantsBatch.push({
                  card_id: insertedCard.id,
                  ...JustTCGClient.processVariantForStorage(variant)
                })
              }
            }
          }

          // Batch insert variants if any
          if (variantsBatch.length > 0) {
            const { error: variantsError } = await supabaseClient
              .from('variants')
              .upsert(variantsBatch, {
                onConflict: 'justtcg_variant_id'
              })

            if (variantsError) {
              errors.push(`Variants batch: ${variantsError.message}`)
            } else {
              syncedVariants += variantsBatch.length
            }
          }

        } catch (error) {
          for (const card of batch) {
            const errorMsg = `Card ${card.name}: ${error.message}`
            errors.push(errorMsg)
            console.error(errorMsg)
          }
        }

        // Update progress with performance metrics
        const elapsedSeconds = (Date.now() - Date.parse(job.started_at || job.created_at)) / 1000
        const cardsPerSecond = Math.round(syncedCards / Math.max(elapsedSeconds, 1))
        
        await supabaseClient
          .from('sync_jobs')
          .update({ 
            progress: { 
              current: Math.min(i + dbBatchSize, allCards.length),
              total: allCards.length,
              rate: cardsPerSecond
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