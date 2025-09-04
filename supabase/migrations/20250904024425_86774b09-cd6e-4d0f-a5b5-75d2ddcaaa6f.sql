-- 1) Control table to track cancellation requests
CREATE TABLE IF NOT EXISTS public.pricing_job_control (
  job_id UUID PRIMARY KEY,
  cancel_requested BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  requested_by UUID,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS and add a read policy for admins (writes go through SECURITY DEFINER RPCs)
ALTER TABLE public.pricing_job_control ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'pricing_job_control' 
      AND policyname = 'Admins can read pricing_job_control'
  ) THEN
    CREATE POLICY "Admins can read pricing_job_control"
      ON public.pricing_job_control
      FOR SELECT
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END$$;

-- 2) RPC: request a cancellation for a job (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.request_pricing_job_cancel(p_job_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.pricing_job_control (job_id, cancel_requested, reason, requested_by)
  VALUES (p_job_id, true, p_reason, auth.uid())
  ON CONFLICT (job_id) DO UPDATE
    SET cancel_requested = true,
        reason = COALESCE(p_reason, pricing_job_control.reason),
        requested_by = auth.uid(),
        requested_at = now();
END;
$function$;

-- 3) RPC: check if a job has been cancelled
CREATE OR REPLACE FUNCTION public.is_pricing_job_cancelled(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.pricing_job_control 
    WHERE job_id = p_job_id AND cancel_requested = true
  );
$function$;

-- 4) RPC: update mid-run progress (heartbeat)
CREATE OR REPLACE FUNCTION public.update_pricing_job_progress(
  p_job_id uuid,
  p_actual_batches integer,
  p_cards_processed integer,
  p_variants_updated integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'ops','public'
AS $function$
BEGIN
  UPDATE ops.pricing_job_runs
  SET 
    actual_batches = COALESCE(p_actual_batches, actual_batches),
    cards_processed = COALESCE(p_cards_processed, cards_processed),
    variants_updated = COALESCE(p_variants_updated, variants_updated)
  WHERE id = p_job_id;
END;
$function$;

-- 5) RPC: clean up stuck 'running' jobs older than N minutes; return number updated
CREATE OR REPLACE FUNCTION public.cancel_stuck_pricing_jobs(p_max_minutes integer DEFAULT 60)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'ops','public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  WITH upd AS (
    UPDATE ops.pricing_job_runs
    SET 
      status = 'error',
      finished_at = now(),
      error = COALESCE(error, 'Auto-timeout: force-stopped after exceeding max runtime')
    WHERE status = 'running'
      AND started_at < now() - (p_max_minutes || ' minutes')::interval
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;

  RETURN COALESCE(v_count, 0);
END;
$function$;