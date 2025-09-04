-- Create catalog_v2 schema if not exists
CREATE SCHEMA IF NOT EXISTS catalog_v2;

-- Create ops schema if not exists  
CREATE SCHEMA IF NOT EXISTS ops;

-- 1.1 Pricing history (append-only)
CREATE TABLE IF NOT EXISTS catalog_v2.variant_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'justtcg',
  game TEXT NOT NULL,                 -- 'pokemon' | 'pokemon-japan' | 'mtg'
  variant_key TEXT NOT NULL,          -- matches catalog_v2.variants.variant_key
  price_cents INT,
  market_price_cents INT,
  low_price_cents INT,
  high_price_cents INT,
  currency TEXT DEFAULT 'USD',
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vph_game_variant_key_idx
  ON catalog_v2.variant_price_history (game, variant_key, scraped_at DESC);

-- 1.2 Lightweight job run log
CREATE TABLE IF NOT EXISTS ops.pricing_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game TEXT NOT NULL,
  expected_batches INT NOT NULL,
  actual_batches INT NOT NULL DEFAULT 0,
  cards_processed INT NOT NULL DEFAULT 0,
  variants_updated INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'started',   -- started | ok | error | preflight_ceiling
  error TEXT
);

CREATE INDEX IF NOT EXISTS pricing_job_runs_started_idx
  ON ops.pricing_job_runs (started_at DESC);

-- 1.3 Optional read view for clients (latest)
CREATE OR REPLACE VIEW catalog_v2.variant_prices_latest AS
SELECT
  v.game,
  v.variant_key,
  v.price_cents,
  v.market_price_cents,
  v.low_price_cents,
  v.high_price_cents,
  v.updated_at AS last_updated
FROM catalog_v2.variants v;

-- Helper function to count cards by game
CREATE OR REPLACE FUNCTION catalog_v2_count_cards_by_game(p_game TEXT)
RETURNS TABLE(count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT COUNT(*) FROM catalog_v2.cards WHERE game = p_game;
END;
$$ LANGUAGE plpgsql;

-- Helper view for cards with variants
CREATE OR REPLACE VIEW catalog_v2.cards_with_variants AS
SELECT 
  c.id AS card_id,
  c.game,
  c.justtcg_card_id,
  v.variant_key,
  v.justtcg_variant_id AS provider_variant_id,
  v.condition,
  v.printing
FROM catalog_v2.cards c
LEFT JOIN catalog_v2.variants v ON c.id = v.card_id
WHERE v.variant_key IS NOT NULL;

-- Enable extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;