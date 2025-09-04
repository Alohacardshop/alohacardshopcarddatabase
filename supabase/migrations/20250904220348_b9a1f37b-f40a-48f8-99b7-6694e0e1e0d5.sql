-- Create sealed product categories enum
CREATE TYPE sealed_category_enum AS ENUM (
  'booster_box',
  'elite_trainer_box', 
  'starter_deck',
  'structure_deck',
  'theme_deck',
  'collector_box',
  'bundle',
  'collection',
  'tin',
  'blister_pack',
  'booster_pack',
  'precon_deck',
  'battle_deck',
  'special_set'
);

-- Create sealed product condition enum  
CREATE TYPE sealed_condition_enum AS ENUM (
  'factory_sealed',
  'opened_box',
  'damaged_package',
  'resealed'
);

-- Create sealed products table
CREATE TABLE public.sealed_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category sealed_category_enum NOT NULL,
  sku TEXT,
  justtcg_product_id TEXT,
  tcgplayer_id TEXT,
  image_url TEXT,
  description TEXT,
  msrp_cents INTEGER,
  release_date DATE,
  is_active BOOLEAN DEFAULT true,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sealed product variants table
CREATE TABLE public.sealed_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sealed_product_id UUID NOT NULL REFERENCES public.sealed_products(id) ON DELETE CASCADE,
  justtcg_variant_id TEXT,
  condition sealed_condition_enum NOT NULL DEFAULT 'factory_sealed',
  language TEXT DEFAULT 'English',
  price_cents INTEGER,
  market_price_cents INTEGER,
  low_price_cents INTEGER,
  high_price_cents INTEGER,
  is_available BOOLEAN DEFAULT true,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sealed_product_id, condition, language)
);

-- Add language support to existing variants table for singles
ALTER TABLE public.variants ADD COLUMN language TEXT DEFAULT 'English';

-- Create indexes for performance
CREATE INDEX idx_sealed_products_game_id ON public.sealed_products(game_id);
CREATE INDEX idx_sealed_products_justtcg_id ON public.sealed_products(justtcg_product_id);
CREATE INDEX idx_sealed_products_category ON public.sealed_products(category);
CREATE INDEX idx_sealed_variants_product_id ON public.sealed_variants(sealed_product_id);
CREATE INDEX idx_sealed_variants_justtcg_id ON public.sealed_variants(justtcg_variant_id);
CREATE INDEX idx_sealed_variants_condition ON public.sealed_variants(condition);
CREATE INDEX idx_variants_language ON public.variants(language);

-- Enable RLS on new tables
ALTER TABLE public.sealed_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sealed_variants ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sealed products
CREATE POLICY "Public read access for sealed_products"
ON public.sealed_products FOR SELECT
USING (true);

CREATE POLICY "Admin write access for sealed_products"
ON public.sealed_products FOR ALL
USING (false)
WITH CHECK (false);

CREATE POLICY "Allow edge functions to upsert sealed_products"
ON public.sealed_products FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow edge functions to update sealed_products"
ON public.sealed_products FOR UPDATE
USING (true);

-- Create RLS policies for sealed variants
CREATE POLICY "Public read access for sealed_variants"
ON public.sealed_variants FOR SELECT
USING (true);

CREATE POLICY "Admin write access for sealed_variants"
ON public.sealed_variants FOR ALL
USING (false)
WITH CHECK (false);

CREATE POLICY "Allow edge functions to upsert sealed_variants"
ON public.sealed_variants FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow edge functions to update sealed_variants"
ON public.sealed_variants FOR UPDATE
USING (true);

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_sealed_products_updated_at
  BEFORE UPDATE ON public.sealed_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sealed_variants_updated_at
  BEFORE UPDATE ON public.sealed_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to normalize sealed product condition
CREATE OR REPLACE FUNCTION public.normalize_sealed_condition(api_condition TEXT)
RETURNS sealed_condition_enum
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN CASE LOWER(TRIM(COALESCE(api_condition, 'factory_sealed')))
    WHEN 'factory sealed' THEN 'factory_sealed'::sealed_condition_enum
    WHEN 'sealed' THEN 'factory_sealed'::sealed_condition_enum
    WHEN 'opened box' THEN 'opened_box'::sealed_condition_enum
    WHEN 'opened' THEN 'opened_box'::sealed_condition_enum  
    WHEN 'damaged package' THEN 'damaged_package'::sealed_condition_enum
    WHEN 'damaged' THEN 'damaged_package'::sealed_condition_enum
    WHEN 'resealed' THEN 'resealed'::sealed_condition_enum
    ELSE 'factory_sealed'::sealed_condition_enum -- default fallback
  END;
END;
$$;

-- Create function to upsert sealed variants from JustTCG
CREATE OR REPLACE FUNCTION public.upsert_sealed_variants_from_justtcg(p_rows JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER := 0;
  v_row JSONB;
BEGIN
  -- Process each row in the JSON array
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    -- Upsert sealed variant using sealed_product_id, condition, and language as conflict resolution
    INSERT INTO public.sealed_variants (
      sealed_product_id,
      justtcg_variant_id,
      condition,
      language,
      price_cents,
      market_price_cents,
      low_price_cents,
      high_price_cents,
      is_available,
      last_updated
    ) VALUES (
      (v_row->>'sealed_product_id')::uuid,
      v_row->>'justtcg_variant_id',
      normalize_sealed_condition(v_row->>'condition'),
      COALESCE(v_row->>'language', 'English'),
      (v_row->>'price_cents')::integer,
      (v_row->>'market_price_cents')::integer,
      (v_row->>'low_price_cents')::integer,
      (v_row->>'high_price_cents')::integer,
      COALESCE((v_row->>'is_available')::boolean, true),
      (v_row->>'last_updated')::timestamp with time zone
    )
    ON CONFLICT (sealed_product_id, condition, language)
    DO UPDATE SET
      justtcg_variant_id = EXCLUDED.justtcg_variant_id,
      price_cents = EXCLUDED.price_cents,
      market_price_cents = EXCLUDED.market_price_cents,
      low_price_cents = EXCLUDED.low_price_cents,
      high_price_cents = EXCLUDED.high_price_cents,
      is_available = EXCLUDED.is_available,
      last_updated = EXCLUDED.last_updated;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Update pricing_stats_mv view to include sealed products
DROP MATERIALIZED VIEW IF EXISTS public.pricing_stats_mv;

CREATE MATERIALIZED VIEW public.pricing_stats_mv AS
WITH card_stats AS (
  SELECT 
    COUNT(*) as total_cards,
    COUNT(CASE WHEN v.id IS NOT NULL THEN 1 END) as cards_with_pricing,
    AVG(v.price_cents) as avg_card_price_cents,
    COUNT(DISTINCT c.set_id) as sets_with_pricing
  FROM public.cards c
  LEFT JOIN public.variants v ON c.id = v.card_id
  WHERE v.last_updated > now() - interval '7 days'
),
sealed_stats AS (
  SELECT 
    COUNT(*) as total_sealed_products,
    COUNT(CASE WHEN sv.id IS NOT NULL THEN 1 END) as sealed_with_pricing,
    AVG(sv.price_cents) as avg_sealed_price_cents
  FROM public.sealed_products sp
  LEFT JOIN public.sealed_variants sv ON sp.id = sv.sealed_product_id
  WHERE sv.last_updated > now() - interval '7 days'
),
pricing_jobs AS (
  SELECT 
    COUNT(*) as total_jobs_last_30_days,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_jobs,
    AVG(EXTRACT(EPOCH FROM (finished_at - started_at))/60) as avg_duration_minutes
  FROM ops.pricing_job_runs
  WHERE started_at > now() - interval '30 days'
)
SELECT 
  cs.total_cards,
  cs.cards_with_pricing,
  cs.avg_card_price_cents,
  cs.sets_with_pricing,
  ss.total_sealed_products,
  ss.sealed_with_pricing,  
  ss.avg_sealed_price_cents,
  pj.total_jobs_last_30_days,
  pj.successful_jobs,
  COALESCE(pj.avg_duration_minutes, 0) as avg_job_duration_minutes,
  CASE 
    WHEN pj.total_jobs_last_30_days > 0 
    THEN ROUND((pj.successful_jobs::numeric / pj.total_jobs_last_30_days * 100), 2)
    ELSE 0
  END as success_rate_percentage,
  now() as last_updated
FROM card_stats cs
CROSS JOIN sealed_stats ss  
CROSS JOIN pricing_jobs pj;