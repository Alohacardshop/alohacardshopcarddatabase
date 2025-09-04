import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface JustTCGSearchResult {
  id: string;
  name: string;
  type: string;
  game: string;
  set?: string;
  image_url?: string;
  variants: Array<{
    id: string;
    condition: string;
    printing?: string;
    language: string;
    price: number;
    market_price?: number;
    last_updated?: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { query, game, limit = 10 } = await req.json();
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Search query is required');
    }

    const apiKey = Deno.env.get('JUSTTCG_API_KEY');
    if (!apiKey) {
      throw new Error('JUSTTCG_API_KEY not configured');
    }

    console.log(`🔍 Instant price check for: "${query}"`);

    const searchParams = new URLSearchParams({
      q: query.trim(),
      include_variants: 'true',
      limit: limit.toString(),
    });

    if (game && game !== 'all') {
      searchParams.set('game', game);
    }

    // Search across JustTCG API
    const searchUrl = `https://api.justtcg.com/v1/search/cards?${searchParams}`;
    console.log('Search URL:', searchUrl);

    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('JustTCG API error:', response.status, errorText);
      throw new Error(`JustTCG API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`📊 Found ${data.cards?.length || 0} results`);

    const results: JustTCGSearchResult[] = (data.cards || []).map((card: any) => ({
      id: card.id,
      name: card.name,
      type: card.item_type || 'card',
      game: card.game?.name || 'Unknown Game',
      set: card.set?.name,
      image_url: card.image_url,
      variants: (card.variants || []).map((variant: any) => ({
        id: variant.id,
        condition: variant.condition || 'Near Mint',
        printing: variant.printing || 'Normal',
        language: variant.language || 'English',
        price: variant.price || 0,
        market_price: variant.market_price,
        last_updated: variant.last_updated,
      }))
    }));

    // Log API usage for monitoring
    await supabase
      .from('pricing_api_usage')
      .insert({
        endpoint: 'instant-price-check',
        status_code: response.status,
        success: true,
        response_time_ms: Date.now() - Date.parse(req.headers.get('x-request-start') || new Date().toISOString()),
      });

    console.log('✅ Price check completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        query,
        results,
        total_found: results.length,
        api_usage: {
          requests_used: 1,
          endpoint: 'instant-price-check'
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Instant price check error:', error);
    
    // Log API error for monitoring
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabase
        .from('pricing_api_usage')
        .insert({
          endpoint: 'instant-price-check',
          status_code: 500,
          success: false,
          error_message: error.message,
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});