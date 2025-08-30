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
    const { gameSlug } = await req.json()
    
    if (!gameSlug) {
      throw new Error('gameSlug is required')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const justTCGApiKey = Deno.env.get('JUSTTCG_API_KEY')
    if (!justTCGApiKey) {
      throw new Error('JUSTTCG_API_KEY environment variable is required')
    }

    // Get game from database
    const { data: game, error: gameError } = await supabaseClient
      .from('games')
      .select('*')
      .eq('slug', gameSlug)
      .single()

    if (gameError || !game) {
      throw new Error(`Game not found: ${gameSlug}`)
    }

    const client = new JustTCGClient(justTCGApiKey)

    // Create sync job
    const { data: job, error: jobError } = await supabaseClient
      .from('sync_jobs')
      .insert({
        type: 'sets',
        game_slug: gameSlug,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (jobError) {
      throw new Error(`Failed to create sync job: ${jobError.message}`)
    }

    console.log(`Starting sets sync for ${gameSlug}, job ID: ${job.id}`)

    try {
      let allSets: any[] = []
      let offset = 0
      let hasMore = true
      const batchSize = 200

      // Fetch all sets with offset-based pagination (Premium plan optimized)
      while (hasMore) {
        const response = await client.getSets(gameSlug, offset, batchSize)
        allSets = allSets.concat(response.sets)
        
        hasMore = response.pagination?.has_more || response.sets.length === batchSize
        offset += batchSize
        
        console.log(`Fetched offset ${offset - batchSize}-${offset}, total sets: ${allSets.length}`)

        // Update progress during fetch
        await supabaseClient
          .from('sync_jobs')
          .update({ 
            progress: allSets.length,
            total: response.pagination?.total || allSets.length
          })
          .eq('id', job.id)
      }

      console.log(`Fetched ${allSets.length} sets for ${gameSlug}`)

      let syncedCount = 0
      const errors: string[] = []

      // Update progress with final total
      await supabaseClient
        .from('sync_jobs')
        .update({ 
          progress: 0,
          total: allSets.length
        })
        .eq('id', job.id)

      // Sync each set with batch operations
      const syncBatchSize = 25 // Process 25 sets per database transaction
      for (let i = 0; i < allSets.length; i += syncBatchSize) {
        const batch = allSets.slice(i, i + syncBatchSize)
        
        try {
          // Prepare batch data
          const batchData = batch.map(set => ({
            game_id: game.id,
            name: set.name,
            code: set.id, // JustTCG uses 'id' as the set code/identifier
            justtcg_set_id: set.id,
            card_count: set.cards_count || 0,
            sync_status: 'pending'
          }))

          const { error } = await supabaseClient
            .from('sets')
            .upsert(batchData, {
              onConflict: 'justtcg_set_id'
            })

          if (error) {
            for (const set of batch) {
              errors.push(`Set ${set.id}: ${error.message}`)
            }
          } else {
            syncedCount += batch.length
          }

        } catch (error) {
          for (const set of batch) {
            const errorMsg = `Set ${set.id}: ${error.message}`
            errors.push(errorMsg)
            console.error(errorMsg)
          }
        }

        // Update progress
        await supabaseClient
          .from('sync_jobs')
          .update({ 
            progress: syncedCount,
            total: allSets.length
          })
          .eq('id', job.id)
      }

      // Complete job
      const results = {
        total_fetched: allSets.length,
        synced_count: syncedCount,
        error_count: errors.length,
        errors: errors.slice(0, 10) // Limit error details
      }

      await supabaseClient
        .from('sync_jobs')
        .update({
          status: errors.length === allSets.length ? 'failed' : 'completed',
          progress: syncedCount,
          total: allSets.length,
          results,
          error_details: errors.length > 0 ? { errors: errors.slice(0, 10) } : null,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id)

      console.log(`Sets sync completed: ${syncedCount}/${allSets.length} synced`)

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
      // Mark job as failed
      await supabaseClient
        .from('sync_jobs')
        .update({
          status: 'failed',
          error_details: { message: error.message, stack: error.stack },
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id)

      throw error
    }

  } catch (error) {
    console.error('Sync sets error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})