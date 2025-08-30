-- Remove the problematic unique constraint on (set_id, number)
-- and make justtcg_card_id the primary unique identifier

-- First, drop the existing constraint that's causing issues
ALTER TABLE public.cards 
DROP CONSTRAINT IF EXISTS cards_set_id_number_key;

-- Make justtcg_card_id unique and not null since it's our primary identifier
ALTER TABLE public.cards 
ALTER COLUMN justtcg_card_id SET NOT NULL;

-- Add unique constraint on justtcg_card_id
ALTER TABLE public.cards 
ADD CONSTRAINT cards_justtcg_card_id_unique UNIQUE (justtcg_card_id);

-- For variants table, ensure proper unique constraint on justtcg_variant_id
ALTER TABLE public.variants
ALTER COLUMN justtcg_variant_id SET NOT NULL;

ALTER TABLE public.variants
ADD CONSTRAINT variants_justtcg_variant_id_unique UNIQUE (justtcg_variant_id);

-- Remove the old composite constraint on variants if it exists
ALTER TABLE public.variants
DROP CONSTRAINT IF EXISTS variants_card_id_justtcg_variant_id_key;