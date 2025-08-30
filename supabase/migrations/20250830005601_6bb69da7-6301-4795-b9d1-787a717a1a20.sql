
-- Deactivate legacy duplicates so only the canonical JustTCG IDs are visible
-- Canonical slugs: mtg, disney-lorcana, one-piece-card-game

UPDATE public.games
SET is_active = false
WHERE slug IN ('magic-the-gathering', 'one-piece', 'lorcana');

-- Optional: sanity check – see which games are active after the change
-- SELECT name, slug, is_active FROM public.games ORDER BY name;
