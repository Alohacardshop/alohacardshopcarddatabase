import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Import the JustTCG client from the shared utilities
// Note: We'll inline the client class here since we can't import from other project files
class JustTCGClient {
  private apiKey: string
  private baseURL = 'https://api.justtcg.com/api/v1'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async getCard(cardId: string) {
    const response = await fetch(`${this.baseURL}/cards/${cardId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`JustTCG API error: ${response.status}`)
    }

    return response.json()
  }

  static processVariantForStorage(variant: any) {
    return {
      justtcg_variant_id: variant.id,
      condition: this.normalizeCondition(variant.condition),
      printing: this.normalizePrinting(variant.printing),
      price_cents: variant.price ? Math.round(variant.price * 100) : null,
      market_price_cents: variant.market_price ? Math.round(variant.market_price * 100) : null,
      low_price_cents: variant.low_price ? Math.round(variant.low_price * 100) : null,
      high_price_cents: variant.high_price ? Math.round(variant.high_price * 100) : null,
      is_available: variant.is_available ?? true,
      last_updated: new Date().toISOString()
    }
  }

  static normalizeCondition(condition: string): string {
    const normalized = condition?.toLowerCase().trim() || 'near mint'
    const conditionMap: { [key: string]: string } = {
      'mint': 'mint',
      'near mint': 'near_mint', 
      'lightly played': 'lightly_played',
      'light played': 'light_played',
      'moderately played': 'moderately_played',
      'played': 'played',
      'heavily played': 'heavily_played',
      'poor': 'poor',
      'damaged': 'damaged',
      'good': 'good',
      'excellent': 'excellent'
    }
    return conditionMap[normalized] || 'near_mint'
  }

  static normalizePrinting(printing: string): string {
    const normalized = printing?.toLowerCase().trim() || 'normal'
    const printingMap: { [key: string]: string } = {
      'normal': 'normal',
      'foil': 'foil',
      'holo': 'holo',
      'reverse holo': 'reverse_holo',
      'etched': 'etched',
      'borderless': 'borderless',
      'extended': 'extended',
      'showcase': 'showcase',
      'promo': 'promo',
      'first edition': 'first_edition'
    }
    return printingMap[normalized] || 'normal'
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PricingRequest {
  cardId: string
  condition?: string
  printing?: string
  refresh?: boolean // Flag to force refresh from API
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Initialize JustTCG client
    const apiKey = Deno.env.get('JUSTTCG_API_KEY')
    if (!apiKey) {
      throw new Error('JUSTTCG_API_KEY not configured')
    }
    const justTCGClient = new JustTCGClient(apiKey)

    let cardId: string
    let condition: string | undefined
    let printing: string | undefined
    let refresh = false

    if (req.method === 'GET') {
      const url = new URL(req.url)
      cardId = url.searchParams.get('cardId') ?? ''
      condition = url.searchParams.get('condition') ?? undefined
      printing = url.searchParams.get('printing') ?? undefined
      refresh = url.searchParams.get('refresh') === 'true'
    } else {
      const body: PricingRequest = await req.json()
      cardId = body.cardId
      condition = body.condition
      printing = body.printing
      refresh = body.refresh || false
    }

    if (!cardId) {
      return new Response(
        JSON.stringify({ error: 'cardId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get card info to fetch JustTCG card ID
    const { data: cardData, error: cardError } = await supabase
      .from('cards')
      .select('justtcg_card_id, name, image_url, sets!inner(name, games!inner(name, slug))')
      .eq('id', cardId)
      .single()

    if (cardError || !cardData) {
      return new Response(
        JSON.stringify({ error: 'Card not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If refresh is requested, fetch fresh data from JustTCG API
    if (refresh) {
      console.log(`Refreshing pricing data for card ${cardId}`)
      
      try {
        // Fetch fresh card data from JustTCG API
        const apiCardData = await justTCGClient.getCard(cardData.justtcg_card_id)
        
        if (apiCardData.variants && Array.isArray(apiCardData.variants)) {
          // Update variants in database
          for (const apiVariant of apiCardData.variants) {
            const processedVariant = JustTCGClient.processVariantForStorage(apiVariant)
            
            // Upsert variant data
            const { error: upsertError } = await supabase
              .from('variants')
              .upsert({
                card_id: cardId,
                ...processedVariant
              }, {
                onConflict: 'card_id,justtcg_variant_id'
              })

            if (upsertError) {
              console.error('Error upserting variant:', upsertError)
            }
          }
          
          console.log(`Updated ${apiCardData.variants.length} variants for card ${cardId}`)
        }
      } catch (apiError) {
        console.error('Error fetching from JustTCG API:', apiError)
        // Continue with existing database data if API fails
      }
    }

    // Build query for variants from database (now with fresh data if refresh was requested)
    let query = supabase
      .from('variants')
      .select('*')
      .eq('card_id', cardId)

    if (condition) {
      query = query.eq('condition', condition)
    }

    if (printing) {
      query = query.eq('printing', printing)
    }

    const { data: variants, error } = await query

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pricing data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!variants || variants.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No variants found for the specified card' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        cardId,
        refreshed: refresh,
        variants: variants.map(variant => ({
          id: variant.id,
          condition: variant.condition,
          printing: variant.printing,
          pricing: {
            price_cents: variant.price_cents,
            market_price_cents: variant.market_price_cents,
            low_price_cents: variant.low_price_cents,
            high_price_cents: variant.high_price_cents
          },
          is_available: variant.is_available,
          last_updated: variant.last_updated,
          card: {
            name: cardData.name,
            image_url: cardData.image_url,
            set_name: cardData.sets.name,
            game_name: cardData.sets.games.name
          }
        }))
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in get-card-pricing:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})