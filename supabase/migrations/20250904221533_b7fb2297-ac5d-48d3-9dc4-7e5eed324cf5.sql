-- Create price history tables for tracking price changes
CREATE TABLE public.price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE,
  sealed_product_id UUID REFERENCES public.sealed_products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.variants(id) ON DELETE CASCADE,
  sealed_variant_id UUID REFERENCES public.sealed_variants(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL CHECK (product_type IN ('card', 'sealed')),
  price_cents_old INTEGER,
  price_cents_new INTEGER NOT NULL,
  market_price_cents_old INTEGER,
  market_price_cents_new INTEGER,
  percentage_change NUMERIC(5,2),
  change_type TEXT CHECK (change_type IN ('increase', 'decrease', 'stable')),
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT price_history_product_check CHECK (
    (card_id IS NOT NULL AND sealed_product_id IS NULL) OR
    (card_id IS NULL AND sealed_product_id IS NOT NULL)
  ),
  CONSTRAINT price_history_variant_check CHECK (
    (variant_id IS NOT NULL AND sealed_variant_id IS NULL) OR
    (variant_id IS NULL AND sealed_variant_id IS NOT NULL)
  )
);

-- Create daily price snapshots for trending analysis
CREATE TABLE public.daily_price_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE,
  sealed_product_id UUID REFERENCES public.sealed_products(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL CHECK (product_type IN ('card', 'sealed')),
  avg_price_cents INTEGER NOT NULL,
  min_price_cents INTEGER NOT NULL,
  max_price_cents INTEGER NOT NULL,
  market_price_cents INTEGER,
  variant_count INTEGER DEFAULT 1,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(card_id, sealed_product_id, snapshot_date),
  CONSTRAINT daily_snapshots_product_check CHECK (
    (card_id IS NOT NULL AND sealed_product_id IS NULL) OR
    (card_id IS NULL AND sealed_product_id IS NOT NULL)
  )
);

-- Create price alerts table for user notifications
CREATE TABLE public.price_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, -- Will reference auth.users
  card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE,
  sealed_product_id UUID REFERENCES public.sealed_products(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL CHECK (product_type IN ('card', 'sealed')),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('price_drop', 'price_rise', 'back_in_stock', 'percentage_change')),
  target_price_cents INTEGER,
  percentage_threshold NUMERIC(5,2),
  condition_filter TEXT,
  language_filter TEXT DEFAULT 'English',
  is_active BOOLEAN NOT NULL DEFAULT true,
  triggered_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT price_alerts_product_check CHECK (
    (card_id IS NOT NULL AND sealed_product_id IS NULL) OR
    (card_id IS NULL AND sealed_product_id IS NOT NULL)
  )
);

-- Create alert notifications table
CREATE TABLE public.alert_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id UUID NOT NULL REFERENCES public.price_alerts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  price_old_cents INTEGER,
  price_new_cents INTEGER,
  percentage_change NUMERIC(5,2),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create market intelligence view for profit analysis
CREATE VIEW public.market_intelligence AS
WITH sealed_roi AS (
  SELECT 
    sp.id,
    sp.name,
    sp.category::text as category,
    sp.msrp_cents,
    AVG(sv.market_price_cents) as avg_market_price_cents,
    CASE 
      WHEN sp.msrp_cents > 0 THEN 
        ROUND(((AVG(sv.market_price_cents) - sp.msrp_cents)::numeric / sp.msrp_cents * 100), 2)
      ELSE 0
    END as roi_percentage,
    COUNT(sv.id) as variant_count,
    g.name as game_name,
    g.slug as game_slug
  FROM public.sealed_products sp
  JOIN public.games g ON sp.game_id = g.id
  LEFT JOIN public.sealed_variants sv ON sp.id = sv.sealed_product_id
  WHERE sp.msrp_cents > 0 AND sv.market_price_cents > 0
  GROUP BY sp.id, sp.name, sp.category, sp.msrp_cents, g.name, g.slug
),
condition_spreads AS (
  SELECT 
    c.id,
    c.name,
    s.name as set_name,
    MAX(v.price_cents) - MIN(v.price_cents) as price_spread_cents,
    CASE 
      WHEN MIN(v.price_cents) > 0 THEN
        ROUND(((MAX(v.price_cents) - MIN(v.price_cents))::numeric / MIN(v.price_cents) * 100), 2)
      ELSE 0
    END as spread_percentage,
    COUNT(v.id) as condition_count
  FROM public.cards c
  JOIN public.sets s ON c.set_id = s.id
  JOIN public.variants v ON c.id = v.card_id
  WHERE v.price_cents > 0
  GROUP BY c.id, c.name, s.name
  HAVING COUNT(v.id) >= 3 AND MAX(v.price_cents) - MIN(v.price_cents) > 0
)
SELECT 
  'sealed' as product_type,
  sr.id,
  sr.name,
  sr.game_name,
  sr.category as subcategory,
  sr.msrp_cents as base_price_cents,
  sr.avg_market_price_cents as current_price_cents,
  sr.roi_percentage as profit_margin_percentage,
  'ROI Opportunity' as opportunity_type
FROM sealed_roi sr
WHERE sr.roi_percentage > 20
UNION ALL
SELECT 
  'card' as product_type,
  cs.id,
  cs.name,
  cs.set_name as game_name,
  'arbitrage' as subcategory,
  0 as base_price_cents,
  cs.price_spread_cents as current_price_cents,
  cs.spread_percentage as profit_margin_percentage,
  'Arbitrage Opportunity' as opportunity_type
FROM condition_spreads cs
WHERE cs.spread_percentage > 30;

-- Create indexes for performance
CREATE INDEX idx_price_history_product_type ON public.price_history(product_type);
CREATE INDEX idx_price_history_recorded_at ON public.price_history(recorded_at);
CREATE INDEX idx_price_history_card_id ON public.price_history(card_id);
CREATE INDEX idx_price_history_sealed_product_id ON public.price_history(sealed_product_id);
CREATE INDEX idx_price_history_percentage_change ON public.price_history(percentage_change);

CREATE INDEX idx_daily_snapshots_date ON public.daily_price_snapshots(snapshot_date);
CREATE INDEX idx_daily_snapshots_card_id ON public.daily_price_snapshots(card_id);
CREATE INDEX idx_daily_snapshots_sealed_product_id ON public.daily_price_snapshots(sealed_product_id);

CREATE INDEX idx_price_alerts_user_id ON public.price_alerts(user_id);
CREATE INDEX idx_price_alerts_active ON public.price_alerts(is_active);
CREATE INDEX idx_price_alerts_card_id ON public.price_alerts(card_id);
CREATE INDEX idx_price_alerts_sealed_product_id ON public.price_alerts(sealed_product_id);

CREATE INDEX idx_alert_notifications_user_id ON public.alert_notifications(user_id);
CREATE INDEX idx_alert_notifications_read ON public.alert_notifications(is_read);
CREATE INDEX idx_alert_notifications_created_at ON public.alert_notifications(created_at);

-- Enable RLS on new tables
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_price_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for price history (public read)
CREATE POLICY "Public read access for price_history"
ON public.price_history FOR SELECT
USING (true);

CREATE POLICY "Edge functions can insert price_history"
ON public.price_history FOR INSERT
WITH CHECK (true);

-- Create RLS policies for daily snapshots (public read)
CREATE POLICY "Public read access for daily_price_snapshots"
ON public.daily_price_snapshots FOR SELECT
USING (true);

CREATE POLICY "Edge functions can upsert daily_price_snapshots"
ON public.daily_price_snapshots FOR ALL
USING (true)
WITH CHECK (true);

-- Create RLS policies for price alerts (user-specific)
CREATE POLICY "Users can view their own alerts"
ON public.price_alerts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own alerts"
ON public.price_alerts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts"
ON public.price_alerts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alerts"
ON public.price_alerts FOR DELETE
USING (auth.uid() = user_id);

-- Create RLS policies for alert notifications (user-specific)
CREATE POLICY "Users can view their own notifications"
ON public.alert_notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Edge functions can create notifications"
ON public.alert_notifications FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own notifications"
ON public.alert_notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_price_alerts_updated_at
  BEFORE UPDATE ON public.price_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to record price changes
CREATE OR REPLACE FUNCTION public.record_price_change(
  p_product_type TEXT,
  p_card_id UUID DEFAULT NULL,
  p_sealed_product_id UUID DEFAULT NULL,
  p_variant_id UUID DEFAULT NULL,
  p_sealed_variant_id UUID DEFAULT NULL,
  p_price_old INTEGER DEFAULT NULL,
  p_price_new INTEGER,
  p_market_price_old INTEGER DEFAULT NULL,
  p_market_price_new INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_percentage_change NUMERIC(5,2) := 0;
  v_change_type TEXT := 'stable';
BEGIN
  -- Calculate percentage change
  IF p_price_old IS NOT NULL AND p_price_old > 0 THEN
    v_percentage_change := ROUND(((p_price_new - p_price_old)::numeric / p_price_old * 100), 2);
    
    IF v_percentage_change > 0 THEN
      v_change_type := 'increase';
    ELSIF v_percentage_change < 0 THEN
      v_change_type := 'decrease';
    END IF;
  END IF;
  
  -- Only record if change is significant (>1% or new price)
  IF p_price_old IS NULL OR ABS(v_percentage_change) >= 1 THEN
    INSERT INTO public.price_history (
      product_type,
      card_id,
      sealed_product_id,
      variant_id,
      sealed_variant_id,
      price_cents_old,
      price_cents_new,
      market_price_cents_old,
      market_price_cents_new,
      percentage_change,
      change_type
    ) VALUES (
      p_product_type,
      p_card_id,
      p_sealed_product_id,
      p_variant_id,
      p_sealed_variant_id,
      p_price_old,
      p_price_new,
      p_market_price_old,
      p_market_price_new,
      v_percentage_change,
      v_change_type
    );
  END IF;
END;
$$;

-- Create function to update daily price snapshots
CREATE OR REPLACE FUNCTION public.update_daily_price_snapshots()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update card snapshots
  INSERT INTO public.daily_price_snapshots (
    card_id,
    product_type,
    avg_price_cents,
    min_price_cents,
    max_price_cents,
    market_price_cents,
    variant_count,
    snapshot_date
  )
  SELECT 
    c.id,
    'card',
    COALESCE(AVG(v.price_cents)::integer, 0),
    COALESCE(MIN(v.price_cents), 0),
    COALESCE(MAX(v.price_cents), 0),
    COALESCE(AVG(v.market_price_cents)::integer, AVG(v.price_cents)::integer, 0),
    COUNT(v.id),
    CURRENT_DATE
  FROM public.cards c
  LEFT JOIN public.variants v ON c.id = v.card_id AND v.price_cents IS NOT NULL
  GROUP BY c.id
  HAVING COUNT(v.id) > 0
  ON CONFLICT (card_id, snapshot_date)
  DO UPDATE SET
    avg_price_cents = EXCLUDED.avg_price_cents,
    min_price_cents = EXCLUDED.min_price_cents,
    max_price_cents = EXCLUDED.max_price_cents,
    market_price_cents = EXCLUDED.market_price_cents,
    variant_count = EXCLUDED.variant_count;

  -- Update sealed product snapshots
  INSERT INTO public.daily_price_snapshots (
    sealed_product_id,
    product_type,
    avg_price_cents,
    min_price_cents,
    max_price_cents,
    market_price_cents,
    variant_count,
    snapshot_date
  )
  SELECT 
    sp.id,
    'sealed',
    COALESCE(AVG(sv.price_cents)::integer, 0),
    COALESCE(MIN(sv.price_cents), 0),
    COALESCE(MAX(sv.price_cents), 0),
    COALESCE(AVG(sv.market_price_cents)::integer, AVG(sv.price_cents)::integer, 0),
    COUNT(sv.id),
    CURRENT_DATE
  FROM public.sealed_products sp
  LEFT JOIN public.sealed_variants sv ON sp.id = sv.sealed_product_id AND sv.price_cents IS NOT NULL
  GROUP BY sp.id
  HAVING COUNT(sv.id) > 0
  ON CONFLICT (sealed_product_id, snapshot_date)
  DO UPDATE SET
    avg_price_cents = EXCLUDED.avg_price_cents,
    min_price_cents = EXCLUDED.min_price_cents,
    max_price_cents = EXCLUDED.max_price_cents,
    market_price_cents = EXCLUDED.market_price_cents,
    variant_count = EXCLUDED.variant_count;
END;
$$;