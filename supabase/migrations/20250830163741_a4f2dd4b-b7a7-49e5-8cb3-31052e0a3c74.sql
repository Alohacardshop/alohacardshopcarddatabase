-- Add missing condition values to enum
ALTER TYPE card_condition_enum ADD VALUE IF NOT EXISTS 'lightly_played';
ALTER TYPE card_condition_enum ADD VALUE IF NOT EXISTS 'moderately_played';
ALTER TYPE card_condition_enum ADD VALUE IF NOT EXISTS 'heavily_played';
ALTER TYPE card_condition_enum ADD VALUE IF NOT EXISTS 'damaged';

-- Add missing printing values to enum  
ALTER TYPE card_printing_enum ADD VALUE IF NOT EXISTS 'holo';
ALTER TYPE card_printing_enum ADD VALUE IF NOT EXISTS 'reverse_holo';
ALTER TYPE card_printing_enum ADD VALUE IF NOT EXISTS 'promo';
ALTER TYPE card_printing_enum ADD VALUE IF NOT EXISTS 'first_edition';

-- Create function to normalize condition names from JustTCG API
CREATE OR REPLACE FUNCTION normalize_condition(api_condition text)
RETURNS card_condition_enum AS $$
BEGIN
  RETURN CASE LOWER(TRIM(api_condition))
    WHEN 'mint' THEN 'mint'::card_condition_enum
    WHEN 'near mint' THEN 'near_mint'::card_condition_enum
    WHEN 'lightly played' THEN 'lightly_played'::card_condition_enum
    WHEN 'light played' THEN 'light_played'::card_condition_enum
    WHEN 'moderately played' THEN 'moderately_played'::card_condition_enum
    WHEN 'played' THEN 'played'::card_condition_enum
    WHEN 'heavily played' THEN 'heavily_played'::card_condition_enum
    WHEN 'poor' THEN 'poor'::card_condition_enum
    WHEN 'damaged' THEN 'damaged'::card_condition_enum
    WHEN 'good' THEN 'good'::card_condition_enum
    WHEN 'excellent' THEN 'excellent'::card_condition_enum
    ELSE 'near_mint'::card_condition_enum -- default fallback
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to normalize printing names from JustTCG API
CREATE OR REPLACE FUNCTION normalize_printing(api_printing text)
RETURNS card_printing_enum AS $$
BEGIN
  RETURN CASE LOWER(TRIM(COALESCE(api_printing, 'normal')))
    WHEN 'normal' THEN 'normal'::card_printing_enum
    WHEN 'foil' THEN 'foil'::card_printing_enum
    WHEN 'holo' THEN 'holo'::card_printing_enum
    WHEN 'reverse holo' THEN 'reverse_holo'::card_printing_enum
    WHEN 'etched' THEN 'etched'::card_printing_enum
    WHEN 'borderless' THEN 'borderless'::card_printing_enum
    WHEN 'extended' THEN 'extended'::card_printing_enum
    WHEN 'showcase' THEN 'showcase'::card_printing_enum
    WHEN 'promo' THEN 'promo'::card_printing_enum
    WHEN 'first edition' THEN 'first_edition'::card_printing_enum
    ELSE 'normal'::card_printing_enum -- default fallback
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;