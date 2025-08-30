-- Add item_type enum and column to categorize all JustTCG items
CREATE TYPE IF NOT EXISTS public.item_type_enum AS ENUM (
  'card',
  'booster_pack', 
  'theme_deck',
  'starter_deck',
  'bundle',
  'collection',
  'other'
);

-- Add item_type column to cards table with default 'card'
ALTER TABLE public.cards 
ADD COLUMN IF NOT EXISTS item_type public.item_type_enum NOT NULL DEFAULT 'card';