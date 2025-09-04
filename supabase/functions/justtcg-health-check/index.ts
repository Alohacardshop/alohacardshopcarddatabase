import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const justTCGApiKey = Deno.env.get('JUSTTCG_API_KEY');
    const jtcgBase = Deno.env.get('JTCG_BASE') || 'https://api.justtcg.com/v1';

    // Check if API key is configured
    if (!justTCGApiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "missing_api_key",
          message: "JUSTTCG_API_KEY is not configured",
          checks: {
            api_key_configured: false,
            api_connection: false,
            games_accessible: false
          }
        }), 
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Testing JustTCG API connection to: ${jtcgBase}`);

    // Test basic API connection with games endpoint
    const gamesUrl = `${jtcgBase}/games`;
    const gamesResponse = await fetch(gamesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${justTCGApiKey}`,
        'Content-Type': 'application/json',
      }
    });

    console.log(`Games API response: ${gamesResponse.status}`);

    if (!gamesResponse.ok) {
      const errorText = await gamesResponse.text();
      console.error(`Games API error: ${errorText}`);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `api_error_${gamesResponse.status}`,
          message: `JustTCG API error (${gamesResponse.status}): ${errorText}`,
          checks: {
            api_key_configured: true,
            api_connection: false,
            games_accessible: false
          }
        }), 
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const gamesData = await gamesResponse.json();
    const availableGames = gamesData.data || [];
    
    console.log(`Available games: ${availableGames.map((g: any) => g.slug).join(', ')}`);

    // Test a small variants request for pokemon to verify full access
    const variantsUrl = `${jtcgBase}/variants?game=pokemon&limit=1&offset=0`;
    const variantsResponse = await fetch(variantsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${justTCGApiKey}`,
        'Content-Type': 'application/json',
      }
    });

    console.log(`Variants API response: ${variantsResponse.status}`);
    
    const variantsAccessible = variantsResponse.ok;
    let variantsData = null;
    
    if (variantsAccessible) {
      try {
        variantsData = await variantsResponse.json();
      } catch (e) {
        console.warn('Could not parse variants response as JSON:', e);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "JustTCG API connection successful",
      api_base: jtcgBase,
      checks: {
        api_key_configured: true,
        api_connection: true,
        games_accessible: true,
        variants_accessible: variantsAccessible
      },
      games: availableGames.map((g: any) => ({
        slug: g.slug,
        name: g.name,
        supported: ['pokemon', 'pokemon-japan', 'mtg'].includes(g.slug)
      })),
      sample_variants_count: variantsData?.data?.length || 0
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Health check error:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: "health_check_failed",
      message: `Health check failed: ${error.message}`,
      checks: {
        api_key_configured: !!Deno.env.get('JUSTTCG_API_KEY'),
        api_connection: false,
        games_accessible: false
      }
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
})