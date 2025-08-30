-- Add item_type enum and column to categorize all JustTCG items
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_type_enum') THEN
        CREATE TYPE public.item_type_enum AS ENUM (
            'card',
            'booster_pack', 
            'theme_deck',
            'starter_deck',
            'bundle',
            'collection',
            'other'
        );
    END IF;
END $$;

-- Add item_type column to cards table with default 'card'
ALTER TABLE public.cards 
ADD COLUMN IF NOT EXISTS item_type public.item_type_enum NOT NULL DEFAULT 'card';