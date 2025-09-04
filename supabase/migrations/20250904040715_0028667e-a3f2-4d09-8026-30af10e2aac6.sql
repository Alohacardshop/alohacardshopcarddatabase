-- Create catalog_v2 schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS catalog_v2;

-- Create catalog_v2.variants table for JustTCG variant pricing
CREATE TABLE IF NOT EXISTS catalog_v2.variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'justtcg',
  card_provider_id TEXT NOT NULL,
  variant_provider_id TEXT NOT NULL,
  language TEXT,
  printing TEXT,
  condition TEXT,
  sku TEXT,
  currency TEXT DEFAULT 'USD',
  price NUMERIC,
  market_price NUMERIC,
  low_price NUMERIC,
  mid_price NUMERIC,
  high_price NUMERIC,
  data JSONB,
  updated_from_source_at TIMESTAMP WITH TIME ZONE,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on provider + variant_provider_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_provider_variant 
ON catalog_v2.variants (provider, variant_provider_id);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_variants_game ON catalog_v2.variants (game);
CREATE INDEX IF NOT EXISTS idx_variants_card_provider_id ON catalog_v2.variants (card_provider_id);
CREATE INDEX IF NOT EXISTS idx_variants_updated_from_source ON catalog_v2.variants (updated_from_source_at);

-- Enable RLS
ALTER TABLE catalog_v2.variants ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Public read access for variants" 
ON catalog_v2.variants 
FOR SELECT 
USING (true);

CREATE POLICY "Admin write access for variants" 
ON catalog_v2.variants 
FOR ALL 
USING (false) 
WITH CHECK (false);

-- Create bulk upsert RPC for variant pricing
CREATE OR REPLACE FUNCTION public.catalog_v2_upsert_variants(rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO catalog_v2.variants (
    game, provider, card_provider_id, variant_provider_id,
    language, printing, condition, sku,
    currency, price, market_price, low_price, mid_price, high_price,
    data, updated_from_source_at, last_updated
  )
  SELECT
    (r->>'game')::text,
    COALESCE(r->>'provider','justtcg'),
    r->>'card_provider_id',
    r->>'variant_provider_id',
    r->>'language',
    r->>'printing',
    r->>'condition',
    r->>'sku',
    COALESCE(r->>'currency','USD'),
    NULLIF(r->>'price','')::numeric,
    NULLIF(r->>'market_price','')::numeric,
    NULLIF(r->>'low_price','')::numeric,
    NULLIF(r->>'mid_price','')::numeric,
    NULLIF(r->>'high_price','')::numeric,
    (r->>'data')::jsonb,
    (r->>'updated_from_source_at')::timestamptz,
    now()
  FROM jsonb_array_elements(rows) AS r
  ON CONFLICT (provider, variant_provider_id)
  DO UPDATE SET
    price                   = EXCLUDED.price,
    market_price            = EXCLUDED.market_price,
    low_price               = EXCLUDED.low_price,
    mid_price               = EXCLUDED.mid_price,
    high_price              = EXCLUDED.high_price,
    currency                = EXCLUDED.currency,
    data                    = COALESCE(EXCLUDED.data, catalog_v2.variants.data),
    updated_from_source_at  = EXCLUDED.updated_from_source_at,
    last_updated            = now();
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION public.catalog_v2_upsert_variants(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.catalog_v2_upsert_variants(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_v2_upsert_variants(jsonb) TO service_role;