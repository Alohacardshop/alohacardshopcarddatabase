-- Add performance indexes for better search and query performance
CREATE INDEX IF NOT EXISTS idx_cards_name_trgm ON public.cards USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cards_oracle_text_trgm ON public.cards USING GIN (oracle_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cards_type_line ON public.cards (type_line);
CREATE INDEX IF NOT EXISTS idx_cards_rarity ON public.cards (rarity);
CREATE INDEX IF NOT EXISTS idx_cards_set_id ON public.cards (set_id);
CREATE INDEX IF NOT EXISTS idx_cards_created_at ON public.cards (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sets_game_id ON public.sets (game_id);
CREATE INDEX IF NOT EXISTS idx_sets_sync_status ON public.sets (sync_status);
CREATE INDEX IF NOT EXISTS idx_sets_code ON public.sets (code);
CREATE INDEX IF NOT EXISTS idx_sets_name ON public.sets (name);

CREATE INDEX IF NOT EXISTS idx_variants_card_id ON public.variants (card_id);
CREATE INDEX IF NOT EXISTS idx_variants_condition ON public.variants (condition);
CREATE INDEX IF NOT EXISTS idx_variants_printing ON public.variants (printing);
CREATE INDEX IF NOT EXISTS idx_variants_price_cents ON public.variants (price_cents DESC) WHERE price_cents IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_variants_last_updated ON public.variants (last_updated DESC);

CREATE INDEX IF NOT EXISTS idx_games_slug ON public.games (slug);
CREATE INDEX IF NOT EXISTS idx_games_is_active ON public.games (is_active);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_cards_set_rarity ON public.cards (set_id, rarity);
CREATE INDEX IF NOT EXISTS idx_variants_card_condition ON public.variants (card_id, condition);
CREATE INDEX IF NOT EXISTS idx_sets_game_status ON public.sets (game_id, sync_status);