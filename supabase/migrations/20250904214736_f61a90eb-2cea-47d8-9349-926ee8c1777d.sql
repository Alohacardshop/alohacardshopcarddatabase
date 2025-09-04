-- Migration to update Magic card IDs from old to new format
-- Old format: "magic-{set}-{card}" 
-- New format: "magic-the-gathering-{set}-{card}"

-- Update cards table
UPDATE public.cards 
SET justtcg_card_id = REPLACE(justtcg_card_id, 'magic-', 'magic-the-gathering-')
WHERE justtcg_card_id LIKE 'magic-%' 
  AND justtcg_card_id NOT LIKE 'magic-the-gathering-%'
  AND set_id IN (
    SELECT s.id FROM public.sets s 
    JOIN public.games g ON s.game_id = g.id 
    WHERE g.slug = 'mtg'
  );

-- Update variants table
UPDATE public.variants 
SET justtcg_variant_id = REPLACE(justtcg_variant_id, 'magic-', 'magic-the-gathering-')
WHERE justtcg_variant_id LIKE 'magic-%' 
  AND justtcg_variant_id NOT LIKE 'magic-the-gathering-%'
  AND card_id IN (
    SELECT c.id FROM public.cards c
    JOIN public.sets s ON c.set_id = s.id
    JOIN public.games g ON s.game_id = g.id
    WHERE g.slug = 'mtg'
  );

-- Count updated records for reporting
DO $$
DECLARE
  cards_updated INTEGER;
  variants_updated INTEGER;
BEGIN
  -- Count cards that were updated
  SELECT COUNT(*) INTO cards_updated
  FROM public.cards c
  JOIN public.sets s ON c.set_id = s.id
  JOIN public.games g ON s.game_id = g.id
  WHERE g.slug = 'mtg' 
    AND c.justtcg_card_id LIKE 'magic-the-gathering-%';

  -- Count variants that were updated  
  SELECT COUNT(*) INTO variants_updated
  FROM public.variants v
  JOIN public.cards c ON v.card_id = c.id
  JOIN public.sets s ON c.set_id = s.id
  JOIN public.games g ON s.game_id = g.id
  WHERE g.slug = 'mtg' 
    AND v.justtcg_variant_id LIKE 'magic-the-gathering-%';

  -- Log the results
  RAISE NOTICE 'Magic card ID migration completed:';
  RAISE NOTICE 'Cards updated: %', cards_updated;
  RAISE NOTICE 'Variants updated: %', variants_updated;
END $$;

-- Create function for backwards compatibility in edge functions
CREATE OR REPLACE FUNCTION public.normalize_magic_card_id(card_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Convert old format to new format if needed
  IF card_id LIKE 'magic-%' AND card_id NOT LIKE 'magic-the-gathering-%' THEN
    RETURN REPLACE(card_id, 'magic-', 'magic-the-gathering-');
  END IF;
  
  RETURN card_id;
END;
$$;