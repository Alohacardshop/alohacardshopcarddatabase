-- Create public RPCs to wrap operations on non-public schemas

-- RPC to start a pricing job run
CREATE OR REPLACE FUNCTION public.start_pricing_job_run(
  p_game text,
  p_expected_batches integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ops, public
AS $$
DECLARE
  job_id uuid;
BEGIN
  INSERT INTO ops.pricing_job_runs (game, expected_batches, status, started_at)
  VALUES (p_game, p_expected_batches, 'running', now())
  RETURNING id INTO job_id;
  
  RETURN job_id;
END;
$$;

-- RPC to finish a pricing job run
CREATE OR REPLACE FUNCTION public.finish_pricing_job_run(
  p_job_id uuid,
  p_status text,
  p_actual_batches integer DEFAULT NULL,
  p_cards_processed integer DEFAULT NULL,
  p_variants_updated integer DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ops, public
AS $$
BEGIN
  UPDATE ops.pricing_job_runs
  SET 
    status = p_status,
    finished_at = now(),
    actual_batches = COALESCE(p_actual_batches, actual_batches),
    cards_processed = COALESCE(p_cards_processed, cards_processed),
    variants_updated = COALESCE(p_variants_updated, variants_updated),
    error = p_error
  WHERE id = p_job_id;
END;
$$;

-- RPC to fetch cards with variants for pricing
CREATE OR REPLACE FUNCTION public.fetch_cards_with_variants(
  p_game text,
  p_limit integer DEFAULT 200,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  card_id uuid,
  justtcg_card_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = catalog_v2, public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cwv.card_id,
    cwv.justtcg_card_id
  FROM catalog_v2.cards_with_variants cwv
  WHERE cwv.game = p_game
  ORDER BY cwv.card_id
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- RPC to insert variant price history
CREATE OR REPLACE FUNCTION public.insert_variant_price_history(
  p_records jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = catalog_v2, public
AS $$
BEGIN
  INSERT INTO catalog_v2.variant_price_history (
    variant_id,
    price_cents,
    low_price_cents,
    high_price_cents,
    market_price_cents,
    recorded_at
  )
  SELECT 
    (record->>'variant_id')::uuid,
    (record->>'price_cents')::integer,
    (record->>'low_price_cents')::integer,
    (record->>'high_price_cents')::integer,
    (record->>'market_price_cents')::integer,
    (record->>'recorded_at')::timestamp with time zone
  FROM jsonb_array_elements(p_records) AS record;
END;
$$;

-- Grant execute permissions to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.start_pricing_job_run(text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finish_pricing_job_run(uuid, text, integer, integer, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fetch_cards_with_variants(text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_variant_price_history(jsonb) TO authenticated, service_role;