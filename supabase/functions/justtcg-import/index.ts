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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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
      const batchSize = 200

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
            progress: allCards.length,
            total: response.pagination?.total || allCards.length
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
        
        // Categorize and prepare all items (cards, booster packs, theme decks, etc.)
        const categorizedItems = batch.map(item => {
          const name = item.name?.toLowerCase() || '';
          let itemType = 'card'; // default
          
          if (name.includes('booster pack') || name.includes('booster box')) {
            itemType = 'booster_pack';
          } else if (name.includes('theme deck')) {
            itemType = 'theme_deck';  
          } else if (name.includes('starter deck')) {
            itemType = 'starter_deck';
          } else if (name.includes('bundle') || name.includes('collection')) {
            itemType = 'bundle';
          } else if (!item.number || !/^\d+/.test(item.number)) {
            // Items without proper card numbers are likely other products
            itemType = 'other';
          }
          
          return {
            set_id: set.id,
            item_type: itemType,
            ...JustTCGClient.processCardForStorage(item)
          };
        });

        try {
          // Batch insert all items (cards, booster packs, theme decks, etc.)
          const { data: insertedItems, error: itemsError } = await supabaseClient
            .from('cards')
            .upsert(categorizedItems, {
              onConflict: 'justtcg_card_id'
            })
            .select()

          if (itemsError) {
            for (const item of batch) {
              errors.push(`Item ${item.name}: ${itemsError.message}`)
            }
            continue
          }

          syncedCards += insertedItems.length
          console.log(`Synced ${insertedItems.length} items from batch ${i}-${i + dbBatchSize}`);

          // Process variants only for actual cards (not booster packs, theme decks, etc.)
          const variantsBatch: any[] = []
          for (let j = 0; j < batch.length; j++) {
            const item = batch[j]
            const insertedItem = insertedItems.find(ii => ii.justtcg_card_id === item.id)
            
            // Only process variants for actual cards
            if (insertedItem && insertedItem.item_type === 'card' && item.variants && item.variants.length > 0) {
              for (const variant of item.variants) {
                const processedVariant = JustTCGClient.processVariantForStorage(variant)
                variantsBatch.push({
                  card_id: insertedItem.id,
                  ...processedVariant
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
              console.error('Variants insert error:', variantsError)
              errors.push(`Variants batch: ${variantsError.message}`)
            } else {
              syncedVariants += variantsBatch.length
            }
          }

        } catch (error) {
          for (const item of batch) {
            const errorMsg = `Item ${item.name}: ${error.message}`
            errors.push(errorMsg)
            console.error(errorMsg)
          }
        }

        // Update progress with performance metrics
        await supabaseClient
          .from('sync_jobs')
          .update({ 
            progress: Math.min(i + dbBatchSize, allCards.length),
            total: allCards.length
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
          progress: allCards.length,
          total: allCards.length,
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