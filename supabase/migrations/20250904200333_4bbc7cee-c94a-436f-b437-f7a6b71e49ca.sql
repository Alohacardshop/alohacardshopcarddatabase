-- Fix critical security issues from previous migration
-- Drop catalog_v2 schema completely to eliminate security definer views
DROP SCHEMA IF EXISTS catalog_v2 CASCADE;

-- Fix function search path for the update trigger function  
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SET search_path = public;