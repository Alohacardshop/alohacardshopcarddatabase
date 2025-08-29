import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Get comprehensive database statistics
    const [
      gamesStats,
      setsStats,
      cardsStats,
      variantsStats,
      jobsStats,
      recentJobsStats
    ] = await Promise.all([
      supabaseClient.from('games').select('*', { count: 'exact' }),
      supabaseClient.from('sets').select('sync_status', { count: 'exact' }),
      supabaseClient.from('cards').select('rarity', { count: 'exact' }),
      supabaseClient.from('variants').select('condition', { count: 'exact' }),
      supabaseClient.from('sync_jobs').select('status,type', { count: 'exact' }),
      supabaseClient
        .from('sync_jobs')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
    ])

    // Process sets statistics
    const setsByStatus = setsStats.data?.reduce((acc: any, set: any) => {
      acc[set.sync_status] = (acc[set.sync_status] || 0) + 1
      return acc
    }, {}) || {}

    // Process cards statistics  
    const cardsByRarity = cardsStats.data?.reduce((acc: any, card: any) => {
      const rarity = card.rarity || 'Unknown'
      acc[rarity] = (acc[rarity] || 0) + 1
      return acc
    }, {}) || {}

    // Process variants statistics
    const variantsByCondition = variantsStats.data?.reduce((acc: any, variant: any) => {
      acc[variant.condition] = (acc[variant.condition] || 0) + 1
      return acc
    }, {}) || {}

    // Process jobs statistics
    const jobsByStatus = jobsStats.data?.reduce((acc: any, job: any) => {
      acc[job.status] = (acc[job.status] || 0) + 1
      return acc
    }, {}) || {}

    const jobsByType = jobsStats.data?.reduce((acc: any, job: any) => {
      acc[job.type] = (acc[job.type] || 0) + 1
      return acc
    }, {}) || {}

    // Calculate sync performance metrics
    const completedJobs = recentJobsStats.data?.filter(job => job.status === 'completed') || []
    const avgSyncTime = completedJobs.length > 0 ? 
      completedJobs.reduce((sum, job) => {
        const start = new Date(job.started_at).getTime()
        const end = new Date(job.completed_at).getTime()
        return sum + (end - start)
      }, 0) / completedJobs.length : 0

    const successRate = jobsStats.count > 0 ? 
      ((jobsByStatus.completed || 0) / jobsStats.count * 100).toFixed(1) : 0

    const stats = {
      timestamp: new Date().toISOString(),
      overview: {
        total_games: gamesStats.count || 0,
        total_sets: setsStats.count || 0,
        total_cards: cardsStats.count || 0,
        total_variants: variantsStats.count || 0,
        total_jobs: jobsStats.count || 0
      },
      sets_by_status: setsByStatus,
      cards_by_rarity: cardsByRarity,
      variants_by_condition: variantsByCondition,
      jobs_by_status: jobsByStatus,
      jobs_by_type: jobsByType,
      performance: {
        average_sync_time_ms: Math.round(avgSyncTime),
        success_rate_percent: parseFloat(successRate),
        jobs_last_24h: recentJobsStats.data?.length || 0,
        active_jobs: jobsByStatus.running || 0
      },
      health: {
        database_responsive: true,
        last_successful_sync: completedJobs[0]?.completed_at || null
      }
    }

    return new Response(
      JSON.stringify(stats, null, 2),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Stats API error:', error)
    
    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})