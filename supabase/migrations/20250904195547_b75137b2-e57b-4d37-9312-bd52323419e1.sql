-- ===================================
-- Database Schema Consolidation & Fixes
-- ===================================

-- 1. Drop empty catalog_v2.variants table
DROP TABLE IF EXISTS catalog_v2.variants CASCADE;

-- 2. Create ops schema if it doesn't exist (for pricing_job_runs)
CREATE SCHEMA IF NOT EXISTS ops;

-- 3. Create pricing_job_runs table in ops schema (referenced by existing functions)
CREATE TABLE IF NOT EXISTS ops.pricing_job_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game TEXT NOT NULL,
    expected_batches INTEGER,
    actual_batches INTEGER,
    cards_processed INTEGER DEFAULT 0,
    variants_updated INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'running',
    error TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    finished_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on pricing_job_runs
ALTER TABLE ops.pricing_job_runs ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for admin access
CREATE POLICY "Admins can manage pricing job runs" 
ON ops.pricing_job_runs 
FOR ALL 
USING (has_role(auth.uid(), 'admin'));

-- 4. Create game_configs table for proper game configuration management
CREATE TABLE IF NOT EXISTS public.game_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    justtcg_api_slug TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on game_configs
ALTER TABLE public.game_configs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for game_configs
CREATE POLICY "Public read access for game_configs" 
ON public.game_configs 
FOR SELECT 
USING (true);

CREATE POLICY "Admin write access for game_configs" 
ON public.game_configs 
FOR ALL 
USING (has_role(auth.uid(), 'admin'));

-- Insert initial game configurations
INSERT INTO public.game_configs (slug, display_name, justtcg_api_slug) VALUES
    ('mtg', 'Magic: The Gathering', 'magic-the-gathering'),
    ('pokemon', 'Pokémon', 'pokemon'),
    ('pokemon-japan', 'Pokémon Japan', 'pokemon'),
    ('yugioh', 'Yu-Gi-Oh!', 'yugioh')
ON CONFLICT (slug) DO NOTHING;

-- 5. Add performance indexes
-- Index on variants for pricing queries
CREATE INDEX IF NOT EXISTS idx_variants_card_id_condition_printing 
ON public.variants (card_id, condition, printing);

CREATE INDEX IF NOT EXISTS idx_variants_last_updated 
ON public.variants (last_updated) 
WHERE justtcg_variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_variants_justtcg_id 
ON public.variants (justtcg_variant_id) 
WHERE justtcg_variant_id IS NOT NULL;

-- Index on cards for game-based queries
CREATE INDEX IF NOT EXISTS idx_cards_set_id 
ON public.cards (set_id);

-- Index on sets for game-based queries  
CREATE INDEX IF NOT EXISTS idx_sets_game_id 
ON public.sets (game_id);

-- Index on pricing_job_runs for monitoring queries
CREATE INDEX IF NOT EXISTS idx_pricing_job_runs_started_at 
ON ops.pricing_job_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_pricing_job_runs_status 
ON ops.pricing_job_runs (status);

-- 6. Remove duplicate unique constraints
-- Check and drop duplicate constraints on cards table
DO $$ 
BEGIN
    -- Drop cards_justtcg_card_id_key if it exists (keeping the other unique constraint)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cards_justtcg_card_id_key') THEN
        ALTER TABLE public.cards DROP CONSTRAINT cards_justtcg_card_id_key;
    END IF;
END $$;

DO $$ 
BEGIN
    -- Drop variants_justtcg_variant_id_key if it exists (keeping the other unique constraint)  
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'variants_justtcg_variant_id_key') THEN
        ALTER TABLE public.variants DROP CONSTRAINT variants_justtcg_variant_id_key;
    END IF;
END $$;

-- 7. Add updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for timestamp updates
DROP TRIGGER IF EXISTS update_pricing_job_runs_updated_at ON ops.pricing_job_runs;
CREATE TRIGGER update_pricing_job_runs_updated_at
    BEFORE UPDATE ON ops.pricing_job_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_game_configs_updated_at ON public.game_configs;  
CREATE TRIGGER update_game_configs_updated_at
    BEFORE UPDATE ON public.game_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();