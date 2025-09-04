-- Enhanced pricing system with job queuing, retry logic, and performance optimizations

-- Create pricing_api_usage table for API metrics tracking
CREATE TABLE IF NOT EXISTS public.pricing_api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_run_id UUID REFERENCES ops.pricing_job_runs(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pricing_job_queue table for preventing duplicate jobs
CREATE TABLE IF NOT EXISTS public.pricing_job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  priority INTEGER NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pricing_variant_retries table for tracking failed variants
CREATE TABLE IF NOT EXISTS public.pricing_variant_retries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.variants(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  last_error TEXT,
  last_retry_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  next_retry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pricing_circuit_breaker table for API failure management
CREATE TABLE IF NOT EXISTS public.pricing_circuit_breaker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half_open')),
  failure_count INTEGER NOT NULL DEFAULT 0,
  failure_threshold INTEGER NOT NULL DEFAULT 10,
  last_failure_at TIMESTAMP WITH TIME ZONE,
  recovery_timeout_minutes INTEGER NOT NULL DEFAULT 30,
  next_attempt_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pricing_performance_metrics table for system monitoring
CREATE TABLE IF NOT EXISTS public.pricing_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game TEXT NOT NULL,
  variants_processed INTEGER NOT NULL DEFAULT 0,
  variants_updated INTEGER NOT NULL DEFAULT 0,
  api_requests_used INTEGER NOT NULL DEFAULT 0,
  processing_time_seconds INTEGER NOT NULL DEFAULT 0,
  batch_size_used INTEGER NOT NULL DEFAULT 0,
  success_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(game, recorded_date)
);

-- Create materialized view for pricing statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS public.pricing_stats_mv AS
SELECT 
  COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as jobs_today,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= CURRENT_DATE - INTERVAL '7 days') * 100.0) / 
    NULLIF(COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'), 0),
    2
  ) as success_rate,
  ROUND(
    AVG(EXTRACT(EPOCH FROM (finished_at - started_at)) / 60) FILTER (WHERE status = 'completed' AND created_at >= CURRENT_DATE - INTERVAL '7 days'),
    1
  ) as avg_duration_minutes,
  COALESCE(SUM(variants_updated) FILTER (WHERE created_at >= CURRENT_DATE), 0) as variants_processed_today
FROM ops.pricing_job_runs;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pricing_api_usage_job_run_id ON public.pricing_api_usage(job_run_id);
CREATE INDEX IF NOT EXISTS idx_pricing_api_usage_recorded_at ON public.pricing_api_usage(recorded_at);
CREATE INDEX IF NOT EXISTS idx_pricing_job_queue_game_status ON public.pricing_job_queue(game, status);
CREATE INDEX IF NOT EXISTS idx_pricing_variant_retries_variant_game ON public.pricing_variant_retries(variant_id, game);
CREATE INDEX IF NOT EXISTS idx_pricing_variant_retries_next_retry ON public.pricing_variant_retries(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pricing_circuit_breaker_game_state ON public.pricing_circuit_breaker(game, state);
CREATE INDEX IF NOT EXISTS idx_pricing_performance_metrics_game_date ON public.pricing_performance_metrics(game, recorded_date);

-- Enable RLS policies
ALTER TABLE public.pricing_api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_variant_retries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_circuit_breaker ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_performance_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admin access
CREATE POLICY "Admins can read pricing_api_usage" ON public.pricing_api_usage FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can read pricing_job_queue" ON public.pricing_job_queue FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can read pricing_variant_retries" ON public.pricing_variant_retries FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can read pricing_circuit_breaker" ON public.pricing_circuit_breaker FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can read pricing_performance_metrics" ON public.pricing_performance_metrics FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Create functions for job queue management
CREATE OR REPLACE FUNCTION public.enqueue_pricing_job(p_game TEXT, p_priority INTEGER DEFAULT 0)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Check if job already exists for this game
  SELECT id INTO v_job_id 
  FROM public.pricing_job_queue 
  WHERE game = p_game AND status IN ('queued', 'running');
  
  IF v_job_id IS NOT NULL THEN
    -- Job already exists, return existing ID
    RETURN v_job_id;
  END IF;
  
  -- Create new job
  INSERT INTO public.pricing_job_queue (game, priority, status)
  VALUES (p_game, p_priority, 'queued')
  RETURNING id INTO v_job_id;
  
  RETURN v_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.dequeue_next_pricing_job()
RETURNS TABLE(id UUID, game TEXT, retry_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id UUID;
  v_game TEXT;
  v_retry_count INTEGER;
BEGIN
  -- Get highest priority queued job
  SELECT pj.id, pj.game, pj.retry_count
  INTO v_job_id, v_game, v_retry_count
  FROM public.pricing_job_queue pj
  WHERE pj.status = 'queued'
  ORDER BY pj.priority DESC, pj.scheduled_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF v_job_id IS NOT NULL THEN
    -- Mark as running
    UPDATE public.pricing_job_queue
    SET status = 'running', started_at = now(), updated_at = now()
    WHERE id = v_job_id;
    
    RETURN QUERY SELECT v_job_id, v_game, v_retry_count;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_pricing_job(p_job_id UUID, p_status TEXT, p_error_message TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.pricing_job_queue
  SET 
    status = p_status,
    completed_at = now(),
    updated_at = now(),
    error_message = p_error_message
  WHERE id = p_job_id;
END;
$$;

-- Create function for circuit breaker management
CREATE OR REPLACE FUNCTION public.check_circuit_breaker(p_game TEXT)
RETURNS TABLE(state TEXT, can_proceed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_breaker RECORD;
BEGIN
  -- Get or create circuit breaker for game
  INSERT INTO public.pricing_circuit_breaker (game)
  VALUES (p_game)
  ON CONFLICT (game) DO NOTHING;
  
  SELECT * INTO v_breaker 
  FROM public.pricing_circuit_breaker 
  WHERE game = p_game;
  
  -- Check if we can proceed based on circuit breaker state
  IF v_breaker.state = 'closed' THEN
    RETURN QUERY SELECT v_breaker.state, TRUE;
  ELSIF v_breaker.state = 'open' THEN
    -- Check if recovery timeout has passed
    IF v_breaker.next_attempt_at IS NULL OR now() >= v_breaker.next_attempt_at THEN
      -- Move to half-open state
      UPDATE public.pricing_circuit_breaker
      SET state = 'half_open', updated_at = now()
      WHERE game = p_game;
      RETURN QUERY SELECT 'half_open'::TEXT, TRUE;
    ELSE
      RETURN QUERY SELECT v_breaker.state, FALSE;
    END IF;
  ELSE -- half_open
    RETURN QUERY SELECT v_breaker.state, TRUE;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_circuit_breaker_result(p_game TEXT, p_success BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_breaker RECORD;
BEGIN
  SELECT * INTO v_breaker 
  FROM public.pricing_circuit_breaker 
  WHERE game = p_game;
  
  IF p_success THEN
    -- Success - reset failure count and close circuit
    UPDATE public.pricing_circuit_breaker
    SET 
      state = 'closed',
      failure_count = 0,
      last_failure_at = NULL,
      next_attempt_at = NULL,
      updated_at = now()
    WHERE game = p_game;
  ELSE
    -- Failure - increment count
    UPDATE public.pricing_circuit_breaker
    SET 
      failure_count = failure_count + 1,
      last_failure_at = now(),
      updated_at = now()
    WHERE game = p_game;
    
    -- Check if we should open the circuit
    SELECT * INTO v_breaker 
    FROM public.pricing_circuit_breaker 
    WHERE game = p_game;
    
    IF v_breaker.failure_count >= v_breaker.failure_threshold THEN
      UPDATE public.pricing_circuit_breaker
      SET 
        state = 'open',
        next_attempt_at = now() + (v_breaker.recovery_timeout_minutes || ' minutes')::INTERVAL,
        updated_at = now()
      WHERE game = p_game;
    END IF;
  END IF;
END;
$$;

-- Create function for variant retry management
CREATE OR REPLACE FUNCTION public.queue_variant_retry(p_variant_id UUID, p_game TEXT, p_error_message TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_retry_delay INTEGER := 300; -- 5 minutes base delay
BEGIN
  INSERT INTO public.pricing_variant_retries (variant_id, game, last_error, next_retry_at)
  VALUES (
    p_variant_id, 
    p_game, 
    p_error_message,
    now() + (v_retry_delay || ' seconds')::INTERVAL
  )
  ON CONFLICT (variant_id) DO UPDATE
  SET 
    retry_count = pricing_variant_retries.retry_count + 1,
    last_error = p_error_message,
    last_retry_at = now(),
    next_retry_at = now() + ((v_retry_delay * (pricing_variant_retries.retry_count + 1))::TEXT || ' seconds')::INTERVAL
  WHERE pricing_variant_retries.retry_count < pricing_variant_retries.max_retries;
END;
$$;

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION public.refresh_pricing_stats()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.pricing_stats_mv;
END;
$$;

-- Enable realtime for job monitoring
ALTER TABLE ops.pricing_job_runs REPLICA IDENTITY FULL;
ALTER TABLE public.pricing_job_queue REPLICA IDENTITY FULL;
ALTER TABLE public.pricing_api_usage REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER publication supabase_realtime ADD TABLE ops.pricing_job_runs;
ALTER publication supabase_realtime ADD TABLE public.pricing_job_queue;
ALTER publication supabase_realtime ADD TABLE public.pricing_api_usage;

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cron jobs for daily pricing updates (commented out - need to be enabled manually)
-- Daily Pokémon EN at 2:00 AM UTC
/*
SELECT cron.schedule(
  'pricing-pokemon-en-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url:='https://dhyvufggodqkcjbrjhxk.supabase.co/functions/v1/pricing-job-scheduler',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeXZ1Zmdnb2Rxa2NqYnJqaHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MDIyOTcsImV4cCI6MjA3MjA3ODI5N30.0GncadcSHVbthqyubXLiBflm44sFEz_izfF5uF-xEvs"}'::jsonb,
    body:='{"game": "pokemon", "priority": 10}'::jsonb
  );
  $$
);

-- Daily Pokémon JP at 3:00 AM UTC  
SELECT cron.schedule(
  'pricing-pokemon-jp-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://dhyvufggodqkcjbrjhxk.supabase.co/functions/v1/pricing-job-scheduler',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeXZ1Zmdnb2Rxa2NqYnJqaHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MDIyOTcsImV4cCI6MjA3MjA3ODI5N30.0GncadcSHVbthqyubXLiBflm44sFEz_izfF5uF-xEvs"}'::jsonb,
    body:='{"game": "pokemon-japan", "priority": 10}'::jsonb
  );
  $$
);

-- Daily MTG at 4:00 AM UTC
SELECT cron.schedule(
  'pricing-mtg-daily', 
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url:='https://dhyvufggodqkcjbrjhxk.supabase.co/functions/v1/pricing-job-scheduler',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeXZ1Zmdnb2Rxa2NqYnJqaHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MDIyOTcsImV4cCI6MjA3MjA3ODI5N30.0GncadcSHVbthqyubXLiBflm44sFEz_izfF5uF-xEvs"}'::jsonb,
    body:='{"game": "mtg", "priority": 10}'::jsonb
  );
  $$
);
*/

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pricing_job_queue_updated_at
  BEFORE UPDATE ON public.pricing_job_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_timestamp();

CREATE TRIGGER pricing_circuit_breaker_updated_at
  BEFORE UPDATE ON public.pricing_circuit_breaker
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_timestamp();