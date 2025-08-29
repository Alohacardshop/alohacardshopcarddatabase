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
    const startTime = Date.now()
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Test database connection
    const { data: dbTest, error: dbError } = await supabaseClient
      .from('games')
      .select('count')
      .limit(1)

    const dbHealthy = !dbError
    const dbLatency = Date.now() - startTime

    // Test JustTCG API
    let apiHealthy = false
    let apiLatency = 0
    let apiError = null

    const justTCGApiKey = Deno.env.get('JUSTTCG_API_KEY')
    if (justTCGApiKey) {
      try {
        const apiStartTime = Date.now()
        const client = new JustTCGClient(justTCGApiKey)
        await client.healthCheck()
        apiHealthy = true
        apiLatency = Date.now() - apiStartTime
      } catch (error) {
        apiError = error.message
      }
    } else {
      apiError = 'JustTCG API key not configured'
    }

    // Get rate limit status
    const rateLimitStatus = justTCGApiKey ? 
      new JustTCGClient(justTCGApiKey).getRateLimitStatus() : 
      null

    const totalLatency = Date.now() - startTime
    const overallHealthy = dbHealthy && apiHealthy

    const response = {
      status: overallHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime?.() || 0,
      latency: {
        total: totalLatency,
        database: dbLatency,
        justtcg_api: apiLatency
      },
      services: {
        database: {
          status: dbHealthy ? 'healthy' : 'error',
          error: dbError?.message || null
        },
        justtcg_api: {
          status: apiHealthy ? 'healthy' : 'error',
          error: apiError,
          rate_limit: rateLimitStatus
        }
      },
      environment: {
        node_version: Deno.version?.deno || 'unknown',
        region: Deno.env.get('DENO_REGION') || 'unknown'
      }
    }

    return new Response(
      JSON.stringify(response, null, 2),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        status: overallHealthy ? 200 : 503
      }
    )

  } catch (error) {
    console.error('Health check error:', error)
    
    return new Response(
      JSON.stringify({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
        latency: { total: Date.now() - Date.now() }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})