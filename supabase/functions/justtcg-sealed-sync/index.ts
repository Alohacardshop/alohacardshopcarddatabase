import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface JustTCGSealedProduct {
  id: string;
  name: string;
  category: string;
  sku?: string;
  image_url?: string;
  description?: string;
  msrp_cents?: number;
  release_date?: string;
  variants: Array<{
    id: string;
    condition: string;
    language?: string;
    price: number;
    market_price?: number;
    low_price?: number;
    high_price?: number;
    is_available?: boolean;
  }>;
}

interface SyncProgress {
  totalFound: number;
  processed: number;
  updated: number;
  errors: number;
  apiRequestsUsed: number;
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

    const { gameSlug } = await req.json();
    
    if (!gameSlug) {
      throw new Error('gameSlug is required');
    }

    const apiKey = Deno.env.get('JUSTTCG_API_KEY');
    if (!apiKey) {
      throw new Error('JUSTTCG_API_KEY not configured');
    }

    console.log(`🔄 Starting sealed products sync for game: ${gameSlug}`);

    // Get game ID
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id')
      .eq('slug', gameSlug)
      .single();

    if (gameError || !game) {
      throw new Error(`Game not found: ${gameSlug}`);
    }

    const progress: SyncProgress = {
      totalFound: 0,
      processed: 0,
      updated: 0,
      errors: 0,
      apiRequestsUsed: 0,
    };

    // Fetch sealed products from JustTCG API
    const response = await fetch(`https://api.justtcg.com/v1/games/${gameSlug}/sealed-products?include_variants=true`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    progress.apiRequestsUsed++;

    if (!response.ok) {
      throw new Error(`JustTCG API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const sealedProducts: JustTCGSealedProduct[] = data.sealed_products || [];
    
    progress.totalFound = sealedProducts.length;
    console.log(`📦 Found ${progress.totalFound} sealed products`);

    // Process sealed products in batches
    const BATCH_SIZE = 50;
    const batches = [];
    
    for (let i = 0; i < sealedProducts.length; i += BATCH_SIZE) {
      batches.push(sealedProducts.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const productUpserts = batch.map(product => {
        const category = normalizeSealedCategory(product.category);
        
        return {
          game_id: game.id,
          name: product.name,
          category,
          sku: product.sku,
          justtcg_product_id: product.id,
          image_url: product.image_url,
          description: product.description,
          msrp_cents: product.msrp_cents,
          release_date: product.release_date,
          is_active: true,
          details: {
            justtcg_data: product
          }
        };
      });

      // Upsert sealed products
      const { data: upsertedProducts, error: upsertError } = await supabase
        .from('sealed_products')
        .upsert(productUpserts, { 
          onConflict: 'justtcg_product_id',
          ignoreDuplicates: false 
        })
        .select('id, justtcg_product_id');

      if (upsertError) {
        console.error('Error upserting sealed products:', upsertError);
        progress.errors += batch.length;
        continue;
      }

      // Create mapping of justtcg_product_id to sealed_product_id
      const productIdMap = new Map();
      upsertedProducts?.forEach(product => {
        productIdMap.set(product.justtcg_product_id, product.id);
      });

      // Process variants for each product
      const variantUpserts = [];
      
      for (const product of batch) {
        const sealedProductId = productIdMap.get(product.id);
        if (!sealedProductId) continue;

        for (const variant of product.variants || []) {
          variantUpserts.push({
            sealed_product_id: sealedProductId,
            justtcg_variant_id: variant.id,
            condition: variant.condition || 'factory_sealed',
            language: variant.language || 'English',
            price_cents: Math.round(variant.price * 100),
            market_price_cents: variant.market_price ? Math.round(variant.market_price * 100) : null,
            low_price_cents: variant.low_price ? Math.round(variant.low_price * 100) : null,
            high_price_cents: variant.high_price ? Math.round(variant.high_price * 100) : null,
            is_available: variant.is_available ?? true,
            last_updated: new Date().toISOString(),
          });
        }
      }

      if (variantUpserts.length > 0) {
        const { error: variantsError } = await supabase
          .rpc('upsert_sealed_variants_from_justtcg', {
            p_rows: variantUpserts
          });

        if (variantsError) {
          console.error('Error upserting sealed variants:', variantsError);
          progress.errors += variantUpserts.length;
        } else {
          progress.updated += variantUpserts.length;
        }
      }

      progress.processed += batch.length;
      
      console.log(`✅ Processed batch: ${progress.processed}/${progress.totalFound} sealed products`);
    }

    console.log(`🎉 Sealed products sync completed:`, progress);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sealed products sync completed for ${gameSlug}`,
        progress,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Sealed products sync error:', error);
    
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

function normalizeSealedCategory(category: string): string {
  const normalized = category.toLowerCase().replace(/[^a-z0-9]/g, '_');
  
  // Map common category variations
  const categoryMap: { [key: string]: string } = {
    'booster_box': 'booster_box',
    'booster_boxes': 'booster_box',
    'elite_trainer_box': 'elite_trainer_box',
    'etb': 'elite_trainer_box',
    'starter_deck': 'starter_deck',
    'structure_deck': 'structure_deck',
    'theme_deck': 'theme_deck',
    'collector_box': 'collector_box',
    'bundle': 'bundle',
    'collection': 'collection',
    'tin': 'tin',
    'blister_pack': 'blister_pack',
    'booster_pack': 'booster_pack',
    'precon_deck': 'precon_deck',
    'battle_deck': 'battle_deck',
    'special_set': 'special_set',
  };

  return categoryMap[normalized] || 'collection';
}