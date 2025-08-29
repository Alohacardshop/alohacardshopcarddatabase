-- Fix security definer functions to remove the remaining ERROR warnings

-- Recreate update_updated_at_column without SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Recreate search_cards without SECURITY DEFINER  
CREATE OR REPLACE FUNCTION public.search_cards(search_query text, game_slug text DEFAULT NULL::text, set_code text DEFAULT NULL::text, limit_count integer DEFAULT 50)
RETURNS TABLE(id uuid, name text, set_name text, game_name text, rarity text, image_url text, rank real)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
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