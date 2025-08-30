import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { JustTCGClient } from '../_shared/justtcg-client.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create admin client for privileged database operations (bypasses RLS)
    const supabaseAdminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify required environment variables
    if (!Deno.env.get('SUPABASE_URL')) {
      throw new Error('SUPABASE_URL environment variable is required')
    }
    if (!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required')
    }

    const justTCGApiKey = Deno.env.get('JUSTTCG_API_KEY')
    if (!justTCGApiKey) {
      throw new Error('JUSTTCG_API_KEY environment variable is required')
    }

    const client = new JustTCGClient(justTCGApiKey)

    // Create sync job using admin client to bypass RLS
    const { data: job, error: jobError } = await supabaseAdminClient
      .from('sync_jobs')
      .insert({
        type: 'games',
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (jobError) {
      throw new Error(`sync_jobs insert failed: ${jobError.message}`)
    }

    console.log(`Starting games sync, job ID: ${job.id}`)

    try {
      // Fetch games from JustTCG API
      const games = await client.getGames()
      console.log(`Fetched ${games.length} games from JustTCG`)

      let syncedCount = 0
      const errors: string[] = []

      // Update progress - using integer columns as per schema
      const { error: progressError } = await supabaseAdminClient
        .from('sync_jobs')
        .update({ 
          progress: 0,
          total: games.length
        })
        .eq('id', job.id)

      if (progressError) {
        throw new Error(`sync_jobs progress update failed: ${progressError.message}`)
      }

      // Sync each game with optimized data processing
      for (const game of games) {
        try {
          const processedGame = {
            name: game.name,
            slug: game.id, // Use id as slug
            justtcg_id: game.id,
            is_active: true
          };

          const { error } = await supabaseAdminClient
            .from('games')
            .upsert(processedGame, {
              onConflict: 'slug'
            });

          if (error) {
            errors.push(`games upsert failed for ${game.name}: ${error.message}`);
          } else {
            syncedCount++;
          }

          // Update progress every 5 games
          if (syncedCount % 5 === 0) {
            const { error: updateError } = await supabaseAdminClient
              .from('sync_jobs')
              .update({ 
                progress: syncedCount
              })
              .eq('id', job.id);
            
            if (updateError) {
              console.error(`sync_jobs progress update failed: ${updateError.message}`);
            }
          }

        } catch (error) {
          const errorMsg = `Game processing failed for ${game.name}: ${error.message}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Complete job
      const results = {
        total_fetched: games.length,
        synced_count: syncedCount,
        error_count: errors.length,
        errors: errors.slice(0, 10) // Limit error details
      }

      const { error: completionError } = await supabaseAdminClient
        .from('sync_jobs')
        .update({
          status: errors.length === games.length ? 'failed' : 'completed',
          progress: syncedCount,
          results,
          error_details: errors.length > 0 ? { errors: errors.slice(0, 10) } : null,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id)

      if (completionError) {
        console.error(`sync_jobs completion update failed: ${completionError.message}`)
      }

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
      // Mark job as failed using admin client
      if (job?.id) {
        const { error: failureError } = await supabaseAdminClient
          .from('sync_jobs')
          .update({
            status: 'failed',
            error_details: { message: error.message, stack: error.stack },
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id)

        if (failureError) {
          console.error(`sync_jobs failure update failed: ${failureError.message}`)
        }
      }

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