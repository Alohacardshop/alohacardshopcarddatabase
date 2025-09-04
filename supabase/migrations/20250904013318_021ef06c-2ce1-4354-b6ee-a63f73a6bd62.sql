-- Add unique index on variants table for reliable upserts
CREATE UNIQUE INDEX IF NOT EXISTS variants_card_justtcg_variant_unique 
ON public.variants (card_id, justtcg_variant_id);