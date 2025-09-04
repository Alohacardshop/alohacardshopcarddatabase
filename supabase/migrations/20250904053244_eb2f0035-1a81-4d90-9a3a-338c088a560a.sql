-- Create function to get variants for pricing updates with card ID filtering
CREATE OR REPLACE FUNCTION public.get_variants_for_pricing_update(p_card_ids uuid[], p_limit integer DEFAULT 700)
 RETURNS TABLE(
   id uuid, 
   justtcg_variant_id text, 
   price_cents integer, 
   last_updated timestamp with time zone, 
   card_id uuid
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    v.id,
    v.justtcg_variant_id,
    v.price_cents,
    v.last_updated,
    v.card_id
  FROM public.variants v
  WHERE v.card_id = ANY(p_card_ids)
    AND v.justtcg_variant_id IS NOT NULL
    AND v.last_updated < (now() - interval '1 hour')
  ORDER BY v.last_updated ASC
  LIMIT p_limit;
END;
$function$