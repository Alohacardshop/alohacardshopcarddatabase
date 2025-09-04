-- Create RPC for robust variant upserts from JustTCG data
CREATE OR REPLACE FUNCTION public.upsert_variants_from_justtcg(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_row jsonb;
BEGIN
  -- Process each row in the JSON array
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    -- Upsert variant using card_id, printing, and condition as conflict resolution
    INSERT INTO public.variants (
      card_id,
      justtcg_variant_id, 
      condition,
      printing,
      price_cents,
      market_price_cents,
      low_price_cents,
      high_price_cents,
      last_updated
    ) VALUES (
      (v_row->>'card_id')::uuid,
      v_row->>'justtcg_variant_id',
      (v_row->>'condition')::card_condition_enum,
      (v_row->>'printing')::card_printing_enum,
      (v_row->>'price_cents')::integer,
      (v_row->>'market_price_cents')::integer,
      (v_row->>'low_price_cents')::integer,
      (v_row->>'high_price_cents')::integer,
      (v_row->>'last_updated')::timestamp with time zone
    )
    ON CONFLICT (card_id, condition, printing) 
    DO UPDATE SET
      justtcg_variant_id = EXCLUDED.justtcg_variant_id,
      price_cents = EXCLUDED.price_cents,
      market_price_cents = EXCLUDED.market_price_cents,
      low_price_cents = EXCLUDED.low_price_cents,
      high_price_cents = EXCLUDED.high_price_cents,
      last_updated = EXCLUDED.last_updated;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.upsert_variants_from_justtcg(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_variants_from_justtcg(jsonb) TO service_role;