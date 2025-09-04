-- Fix fetch_cards_with_variants function to work with consolidated schema
CREATE OR REPLACE FUNCTION public.fetch_cards_with_variants(p_game text, p_limit integer DEFAULT 200, p_offset integer DEFAULT 0)
RETURNS TABLE(card_id uuid, justtcg_card_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    c.id as card_id,
    c.justtcg_card_id
  FROM cards c
  JOIN sets s ON c.set_id = s.id
  JOIN games g ON s.game_id = g.id
  WHERE g.slug = p_game
    AND c.justtcg_card_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM variants v 
      WHERE v.card_id = c.id 
        AND v.justtcg_variant_id IS NOT NULL
    )
  ORDER BY c.id
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;