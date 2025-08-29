-- Create enum types for better data integrity
CREATE TYPE sync_status_enum AS ENUM ('pending', 'syncing', 'completed', 'failed');
CREATE TYPE sync_job_status_enum AS ENUM ('queued', 'running', 'completed', 'failed');
CREATE TYPE sync_job_type_enum AS ENUM ('games', 'sets', 'cards');
CREATE TYPE card_condition_enum AS ENUM ('mint', 'near_mint', 'excellent', 'good', 'light_played', 'played', 'poor');
CREATE TYPE card_printing_enum AS ENUM ('normal', 'foil', 'etched', 'borderless', 'extended', 'showcase');

-- Create games table
CREATE TABLE public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    justtcg_id TEXT UNIQUE,
    description TEXT,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create sets table
CREATE TABLE public.sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    release_date DATE,
    justtcg_set_id TEXT UNIQUE,
    card_count INTEGER DEFAULT 0,
    sync_status sync_status_enum DEFAULT 'pending',
    last_synced_at TIMESTAMPTZ,
    image_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(game_id, code)
);

-- Create cards table
CREATE TABLE public.cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    set_id UUID NOT NULL REFERENCES public.sets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    number TEXT,
    rarity TEXT,
    justtcg_card_id TEXT UNIQUE,
    tcgplayer_id TEXT,
    image_url TEXT,
    image_small_url TEXT,
    details JSONB DEFAULT '{}',
    mana_cost TEXT,
    type_line TEXT,
    oracle_text TEXT,
    power TEXT,
    toughness TEXT,
    loyalty TEXT,
    cmc INTEGER,
    colors TEXT[],
    color_identity TEXT[],
    keywords TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(set_id, number)
);

-- Create variants table
CREATE TABLE public.variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    condition card_condition_enum NOT NULL DEFAULT 'near_mint',
    printing card_printing_enum NOT NULL DEFAULT 'normal',
    price_cents INTEGER,
    justtcg_variant_id TEXT UNIQUE,
    market_price_cents INTEGER,
    low_price_cents INTEGER,
    high_price_cents INTEGER,
    last_updated TIMESTAMPTZ DEFAULT now(),
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(card_id, condition, printing)
);

-- Create sync_jobs table
CREATE TABLE public.sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type sync_job_type_enum NOT NULL,
    game_slug TEXT,
    set_code TEXT,
    status sync_job_status_enum DEFAULT 'queued',
    progress INTEGER DEFAULT 0,
    total INTEGER,
    results JSONB DEFAULT '{}',
    error_details JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create performance indexes
-- Games indexes
CREATE INDEX idx_games_slug ON public.games(slug);
CREATE INDEX idx_games_justtcg_id ON public.games(justtcg_id) WHERE justtcg_id IS NOT NULL;
CREATE INDEX idx_games_active ON public.games(is_active) WHERE is_active = true;

-- Sets indexes
CREATE INDEX idx_sets_game_id ON public.sets(game_id);
CREATE INDEX idx_sets_code ON public.sets(code);
CREATE INDEX idx_sets_justtcg_id ON public.sets(justtcg_set_id) WHERE justtcg_set_id IS NOT NULL;
CREATE INDEX idx_sets_sync_status ON public.sets(sync_status);
CREATE INDEX idx_sets_release_date ON public.sets(release_date DESC NULLS LAST);
CREATE INDEX idx_sets_game_release ON public.sets(game_id, release_date DESC NULLS LAST);

-- Cards indexes
CREATE INDEX idx_cards_set_id ON public.cards(set_id);
CREATE INDEX idx_cards_name ON public.cards(name);
CREATE INDEX idx_cards_name_trgm ON public.cards USING gin(name gin_trgm_ops);
CREATE INDEX idx_cards_justtcg_id ON public.cards(justtcg_card_id) WHERE justtcg_card_id IS NOT NULL;
CREATE INDEX idx_cards_tcgplayer_id ON public.cards(tcgplayer_id) WHERE tcgplayer_id IS NOT NULL;
CREATE INDEX idx_cards_rarity ON public.cards(rarity);
CREATE INDEX idx_cards_type_line ON public.cards(type_line);
CREATE INDEX idx_cards_colors ON public.cards USING gin(colors);
CREATE INDEX idx_cards_keywords ON public.cards USING gin(keywords);
CREATE INDEX idx_cards_cmc ON public.cards(cmc) WHERE cmc IS NOT NULL;
CREATE INDEX idx_cards_details ON public.cards USING gin(details);

-- Full-text search index for cards
CREATE INDEX idx_cards_search ON public.cards USING gin(
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(type_line, '') || ' ' || coalesce(oracle_text, ''))
);

-- Variants indexes
CREATE INDEX idx_variants_card_id ON public.variants(card_id);
CREATE INDEX idx_variants_justtcg_id ON public.variants(justtcg_variant_id) WHERE justtcg_variant_id IS NOT NULL;
CREATE INDEX idx_variants_condition ON public.variants(condition);
CREATE INDEX idx_variants_printing ON public.variants(printing);
CREATE INDEX idx_variants_price ON public.variants(price_cents) WHERE price_cents IS NOT NULL;
CREATE INDEX idx_variants_available ON public.variants(is_available) WHERE is_available = true;
CREATE INDEX idx_variants_card_price ON public.variants(card_id, price_cents DESC NULLS LAST);

-- Sync jobs indexes
CREATE INDEX idx_sync_jobs_type ON public.sync_jobs(type);
CREATE INDEX idx_sync_jobs_status ON public.sync_jobs(status);
CREATE INDEX idx_sync_jobs_game_slug ON public.sync_jobs(game_slug) WHERE game_slug IS NOT NULL;
CREATE INDEX idx_sync_jobs_created_at ON public.sync_jobs(created_at DESC);
CREATE INDEX idx_sync_jobs_active ON public.sync_jobs(status, created_at DESC) WHERE status IN ('queued', 'running');

-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
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

-- Create database_stats view for admin dashboard
CREATE OR REPLACE VIEW public.database_stats AS
SELECT
    (SELECT count(*) FROM public.games WHERE is_active = true) as total_games,
    (SELECT count(*) FROM public.sets) as total_sets,
    (SELECT count(*) FROM public.cards) as total_cards,
    (SELECT count(*) FROM public.variants) as total_variants,
    (SELECT count(*) FROM public.sets WHERE sync_status = 'completed') as synced_sets,
    (SELECT count(*) FROM public.sync_jobs WHERE created_at > now() - interval '24 hours') as recent_jobs,
    (SELECT count(*) FROM public.sync_jobs WHERE status = 'running') as active_jobs,
    (SELECT 
        json_build_object(
            'pending', count(*) FILTER (WHERE sync_status = 'pending'),
            'syncing', count(*) FILTER (WHERE sync_status = 'syncing'),
            'completed', count(*) FILTER (WHERE sync_status = 'completed'),
            'failed', count(*) FILTER (WHERE sync_status = 'failed')
        )
        FROM public.sets
    ) as sync_status_breakdown,
    (SELECT pg_size_pretty(pg_total_relation_size('public.cards'))) as cards_table_size,
    (SELECT pg_size_pretty(pg_total_relation_size('public.variants'))) as variants_table_size,
    now() as last_updated;

-- Enable Row Level Security
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public read access
CREATE POLICY "Public read access for games" ON public.games
    FOR SELECT USING (true);

CREATE POLICY "Public read access for sets" ON public.sets
    FOR SELECT USING (true);

CREATE POLICY "Public read access for cards" ON public.cards
    FOR SELECT USING (true);

CREATE POLICY "Public read access for variants" ON public.variants
    FOR SELECT USING (true);

-- Create RLS policies for admin write access (will need user roles system later)
CREATE POLICY "Admin write access for games" ON public.games
    FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "Admin write access for sets" ON public.sets
    FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "Admin write access for cards" ON public.cards
    FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "Admin write access for variants" ON public.variants
    FOR ALL USING (false) WITH CHECK (false);

-- Sync jobs - admin only access
CREATE POLICY "Admin only access for sync_jobs" ON public.sync_jobs
    FOR ALL USING (false) WITH CHECK (false);

-- Insert initial game data
INSERT INTO public.games (name, slug, justtcg_id, description, is_active) VALUES 
    ('Magic: The Gathering', 'magic-the-gathering', 'magic', 'The original trading card game created by Richard Garfield', true),
    ('Pokémon', 'pokemon', 'pokemon', 'Gotta catch ''em all! The popular trading card game based on the beloved franchise', true),
    ('Yu-Gi-Oh!', 'yu-gi-oh', 'yugioh', 'The strategic trading card game where duelists battle with monsters, spells, and traps', true),
    ('Lorcana', 'lorcana', 'lorcana', 'Disney''s magical trading card game featuring beloved characters and stories', true),
    ('One Piece', 'one-piece', 'onepiece', 'Set sail for adventure with the One Piece trading card game', true);

-- Create a function to search cards with full-text search
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
$$ LANGUAGE plpgsql STABLE;

-- Create a function to get popular cards (by variant count/price activity)
CREATE OR REPLACE VIEW public.popular_cards AS
SELECT 
    c.id,
    c.name,
    s.name as set_name,
    g.name as game_name,
    c.rarity,
    c.image_url,
    count(v.id) as variant_count,
    avg(v.price_cents) as avg_price_cents,
    max(v.price_cents) as max_price_cents,
    max(v.last_updated) as last_price_update
FROM public.cards c
JOIN public.sets s ON c.set_id = s.id
JOIN public.games g ON s.game_id = g.id
LEFT JOIN public.variants v ON c.id = v.card_id AND v.is_available = true
WHERE g.is_active = true
GROUP BY c.id, c.name, s.name, g.name, c.rarity, c.image_url
HAVING count(v.id) > 0
ORDER BY variant_count DESC, avg_price_cents DESC NULLS LAST;