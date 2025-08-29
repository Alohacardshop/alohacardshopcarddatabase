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
      let page = 1
      let hasMore = true

      // Fetch all sets with pagination
      while (hasMore) {
        const response = await client.getSets(gameSlug, page, 100)
        allSets = allSets.concat(response.sets)
        
        hasMore = response.pagination?.has_more || false
        page++
        
        console.log(`Fetched page ${page - 1}, total sets: ${allSets.length}`)
      }

      console.log(`Fetched ${allSets.length} sets for ${gameSlug}`)

      let syncedCount = 0
      const errors: string[] = []

      // Update progress
      await supabaseClient
        .from('sync_jobs')
        .update({ total: allSets.length, progress: 0 })
        .eq('id', job.id)

      // Sync each set
      for (const set of allSets) {
        try {
          const { error } = await supabaseClient
            .from('sets')
            .upsert({
              game_id: game.id,
              name: set.name,
              code: set.code,
              release_date: set.release_date,
              justtcg_set_id: set.id,
              card_count: set.card_count || 0,
              sync_status: 'pending'
            }, {
              onConflict: 'game_id,code'
            })

          if (error) {
            errors.push(`Set ${set.code}: ${error.message}`)
          } else {
            syncedCount++
          }

          // Update progress every 10 sets
          if (syncedCount % 10 === 0) {
            await supabaseClient
              .from('sync_jobs')
              .update({ progress: syncedCount })
              .eq('id', job.id)
          }

        } catch (error) {
          const errorMsg = `Set ${set.code}: ${error.message}`
          errors.push(errorMsg)
          console.error(errorMsg)
        }
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
          results,
          error_details: errors.length > 0 ? errors.join('; ') : null,
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
          error_details: error.message,
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