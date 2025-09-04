-- Fix remaining function search path issues for existing functions
-- Update existing functions to have proper search_path settings

-- Fix normalize_condition function
CREATE OR REPLACE FUNCTION public.normalize_condition(api_condition text)
RETURNS card_condition_enum
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
BEGIN
  RETURN CASE LOWER(TRIM(api_condition))
    WHEN 'mint' THEN 'mint'::card_condition_enum
    WHEN 'near mint' THEN 'near_mint'::card_condition_enum
    WHEN 'lightly played' THEN 'lightly_played'::card_condition_enum
    WHEN 'light played' THEN 'light_played'::card_condition_enum
    WHEN 'moderately played' THEN 'moderately_played'::card_condition_enum
    WHEN 'played' THEN 'played'::card_condition_enum
    WHEN 'heavily played' THEN 'heavily_played'::card_condition_enum
    WHEN 'poor' THEN 'poor'::card_condition_enum
    WHEN 'damaged' THEN 'damaged'::card_condition_enum
    WHEN 'good' THEN 'good'::card_condition_enum
    WHEN 'excellent' THEN 'excellent'::card_condition_enum
    ELSE 'near_mint'::card_condition_enum -- default fallback
  END;
END;
$function$;

-- Fix normalize_printing function  
CREATE OR REPLACE FUNCTION public.normalize_printing(api_printing text)
RETURNS card_printing_enum
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
BEGIN
  RETURN CASE LOWER(TRIM(COALESCE(api_printing, 'normal')))
    WHEN 'normal' THEN 'normal'::card_printing_enum
    WHEN 'foil' THEN 'foil'::card_printing_enum
    WHEN 'holo' THEN 'holo'::card_printing_enum
    WHEN 'reverse holo' THEN 'reverse_holo'::card_printing_enum
    WHEN 'etched' THEN 'etched'::card_printing_enum
    WHEN 'borderless' THEN 'borderless'::card_printing_enum
    WHEN 'extended' THEN 'extended'::card_printing_enum
    WHEN 'showcase' THEN 'showcase'::card_printing_enum
    WHEN 'promo' THEN 'promo'::card_printing_enum
    WHEN 'first edition' THEN 'first_edition'::card_printing_enum
    ELSE 'normal'::card_printing_enum -- default fallback
  END;
END;
$function$;

-- Fix search_cards function
CREATE OR REPLACE FUNCTION public.search_cards(search_query text, game_slug text DEFAULT NULL::text, set_code text DEFAULT NULL::text, limit_count integer DEFAULT 50)
RETURNS TABLE(id uuid, name text, set_name text, game_name text, rarity text, image_url text, rank real)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        s.name as set_name,
        g.name as game_name,
        c.rarity,
        c.image_url,
        ts_rank(
            to_tsvector('english', coalesce(c.name, '') || ' ' || coalesce(c.type_line, '') || ' ' || coalesce(c.oracle_text, '')),
            plainto_tsquery('english', search_query)
        ) as rank
    FROM public.cards c
    JOIN public.sets s ON c.set_id = s.id
    JOIN public.games g ON s.game_id = g.id
    WHERE 
        to_tsvector('english', coalesce(c.name, '') || ' ' || coalesce(c.type_line, '') || ' ' || coalesce(c.oracle_text, '')) 
        @@ plainto_tsquery('english', search_query)
        AND (game_slug IS NULL OR g.slug = game_slug)
        AND (set_code IS NULL OR s.code = set_code)
        AND g.is_active = true
    ORDER BY rank DESC, c.name
    LIMIT limit_count;
END;
$function$;