-- Fix security issues identified by the linter

-- Drop and recreate the search function with proper security settings
DROP FUNCTION IF EXISTS public.search_cards CASCADE;

-- Create the search function with proper search_path security
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
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Fix the update_updated_at_column function with proper search_path
DROP FUNCTION IF EXISTS public.update_updated_at_column CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Recreate the triggers since we dropped the function
CREATE TRIGGER update_games_updated_at
    BEFORE UPDATE ON public.games
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sets_updated_at
    BEFORE UPDATE ON public.sets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cards_updated_at
    BEFORE UPDATE ON public.cards
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_variants_updated_at
    BEFORE UPDATE ON public.variants
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sync_jobs_updated_at
    BEFORE UPDATE ON public.sync_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();