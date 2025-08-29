-- Fix remaining security warnings by recreating views without security definer

-- Drop and recreate views to ensure they don't have SECURITY DEFINER
DROP VIEW IF EXISTS public.database_stats CASCADE;
DROP VIEW IF EXISTS public.popular_cards CASCADE;

-- Recreate database_stats view (this is not security definer by default)
CREATE VIEW public.database_stats AS
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

-- Recreate popular_cards view (this is not security definer by default)
CREATE VIEW public.popular_cards AS
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