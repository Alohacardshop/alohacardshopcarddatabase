-- Fix critical security definer view issues
-- Drop any remaining catalog_v2 views that may have SECURITY DEFINER
DROP VIEW IF EXISTS catalog_v2.cards_with_variants CASCADE;
DROP VIEW IF EXISTS catalog_v2.variant_price_history CASCADE;

-- Ensure all remaining views use SECURITY INVOKER (default)
-- If there are other views causing the security definer errors, they would need to be identified and fixed

-- Fix function search path issues for the functions we just created
-- Set search path for the update trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SET search_path = public;