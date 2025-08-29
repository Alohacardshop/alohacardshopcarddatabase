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

    const client = new JustTCGClient(justTCGApiKey)

    // Create sync job
    const { data: job, error: jobError } = await supabaseClient
      .from('sync_jobs')
      .insert({
        type: 'games',
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (jobError) {
      throw new Error(`Failed to create sync job: ${jobError.message}`)
    }

    console.log(`Starting games sync, job ID: ${job.id}`)

    try {
      // Fetch games from JustTCG API
      const games = await client.getGames()
      console.log(`Fetched ${games.length} games from JustTCG`)

      let syncedCount = 0
      const errors: string[] = []

      // Update progress
      await supabaseClient
        .from('sync_jobs')
        .update({ 
          progress: { current: 0, total: games.length, rate: 0 }
        })
        .eq('id', job.id)

      // Sync each game
      for (const game of games) {
        try {
          const { error } = await supabaseClient
            .from('games')
            .upsert({
              name: game.name,
              slug: game.slug,
              justtcg_id: game.id,
              is_active: true
            }, {
              onConflict: 'slug'
            })

          if (error) {
            errors.push(`Game ${game.name}: ${error.message}`)
          } else {
            syncedCount++
          }

          // Update progress every 5 games
          if (syncedCount % 5 === 0) {
            await supabaseClient
              .from('sync_jobs')
              .update({ 
                progress: { current: syncedCount, total: games.length, rate: 0 }
              })
              .eq('id', job.id)
          }

        } catch (error) {
          const errorMsg = `Game ${game.name}: ${error.message}`
          errors.push(errorMsg)
          console.error(errorMsg)
        }
      }

      // Complete job
      const results = {
        total_fetched: games.length,
        synced_count: syncedCount,
        error_count: errors.length,
        errors: errors.slice(0, 10) // Limit error details
      }

      await supabaseClient
        .from('sync_jobs')
        .update({
          status: errors.length === games.length ? 'failed' : 'completed',
          progress: { current: syncedCount, total: games.length, rate: 0 },
          results,
          error_details: errors.length > 0 ? { errors: errors.slice(0, 10) } : null,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id)

      console.log(`Games sync completed: ${syncedCount}/${games.length} synced`)

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
    console.error('Sync games error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})