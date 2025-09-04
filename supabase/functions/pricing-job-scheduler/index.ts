import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Cron Job Scheduler for Automated Daily Pricing Updates
 * 
 * This function is called by pg_cron on schedule:
 * - Pokémon EN: Daily at 2:00 AM UTC
 * - Pokémon JP: Daily at 3:00 AM UTC  
 * - MTG: Daily at 4:00 AM UTC
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`🕐 Cron job scheduler started at ${new Date().toISOString()}`);

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for game and priority
    let game = 'pokemon'; // Default game
    let priority = 10; // High priority for scheduled jobs
    
    try {
      const body = await req.json();
      game = body.game || 'pokemon';
      priority = body.priority || 10;
    } catch {
      // Use defaults if no body provided
      console.log('📋 Using default game: pokemon, priority: 10');
    }

    console.log(`🎯 Scheduling pricing job for game: ${game} with priority: ${priority}`);

    // Check if there's already a running job for this game
    const { data: existingJobs, error: checkError } = await supabase
      .from('pricing_job_queue')
      .select('id, status, started_at')
      .eq('game', game)
      .in('status', ['queued', 'running']);

    if (checkError) {
      console.error('❌ Error checking existing jobs:', checkError);
      throw new Error(`Failed to check existing jobs: ${checkError.message}`);
    }

    if (existingJobs && existingJobs.length > 0) {
      const runningJob = existingJobs[0];
      console.log(`⚠️ Job already exists for ${game}: ${runningJob.status} (ID: ${runningJob.id})`);
      
      return new Response(JSON.stringify({
        success: false,
        message: `A ${runningJob.status} pricing job for ${game} already exists`,
        existing_job_id: runningJob.id,
        game: game,
        scheduled_at: new Date().toISOString()
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Enqueue the pricing job
    const { data: queueJobId, error: enqueueError } = await supabase.rpc('enqueue_pricing_job', {
      p_game: game,
      p_priority: priority
    });

    if (enqueueError) {
      console.error('❌ Error enqueuing pricing job:', enqueueError);
      throw new Error(`Failed to enqueue pricing job: ${enqueueError.message}`);
    }

    console.log(`✅ Successfully queued pricing job for ${game} with ID: ${queueJobId}`);

    // Now trigger the actual pricing refresh
    try {
      console.log(`🚀 Triggering pricing refresh for ${game}...`);
      
      const { data: refreshResult, error: refreshError } = await supabase.functions.invoke('justtcg-refresh-variants', {
        body: { game: game }
      });

      if (refreshError) {
        console.error('❌ Error triggering pricing refresh:', refreshError);
        
        // Update queue job to failed status
        await supabase.rpc('complete_pricing_job', {
          p_job_id: queueJobId,
          p_status: 'failed',
          p_error_message: `Failed to trigger refresh: ${refreshError.message}`
        });

        throw new Error(`Failed to trigger pricing refresh: ${refreshError.message}`);
      }

      console.log(`🎉 Pricing refresh triggered successfully for ${game}:`, refreshResult);

      const elapsedMs = Date.now() - startTime;
      
      return new Response(JSON.stringify({
        success: true,
        message: `Scheduled pricing job for ${game} successfully initiated`,
        game: game,
        queue_job_id: queueJobId,
        refresh_result: refreshResult,
        scheduled_at: new Date().toISOString(),
        elapsed_ms: elapsedMs
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (refreshError) {
      console.error('💥 Error in pricing refresh execution:', refreshError);
      
      // Update queue job to failed status
      await supabase.rpc('complete_pricing_job', {
        p_job_id: queueJobId,
        p_status: 'failed',
        p_error_message: String(refreshError).slice(0, 500)
      });

      throw refreshError;
    }

  } catch (error) {
    console.error('💥 Critical error in cron job scheduler:', error);
    
    const elapsedMs = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: false,
      error: 'scheduler_error',
      message: error.message || 'Unknown error occurred in job scheduler',
      details: String(error).slice(0, 500),
      scheduled_at: new Date().toISOString(),
      elapsed_ms: elapsedMs
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});