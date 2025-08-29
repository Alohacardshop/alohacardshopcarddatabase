-- Fix security warnings from the linter

-- 1. Fix function search path issues by setting explicit search path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Fix search_cards function search path
CREATE OR REPLACE FUNCTION public.search_cards(
    search_query TEXT,
    game_slug TEXT DEFAULT NULL,
    set_code TEXT DEFAULT NULL,
    limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    set_name TEXT,
    game_name TEXT,
    rarity TEXT,
    image_url TEXT,
    rank REAL
) AS $$
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 3. Move pg_trgm extension to extensions schema (recommended practice)
DROP EXTENSION IF EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;