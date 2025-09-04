-- Admin RPC to forcibly finish a pricing job
CREATE OR REPLACE FUNCTION public.force_finish_pricing_job(
  p_job_id uuid,
  p_status text DEFAULT 'cancelled',
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'ops','public'
AS $function$
BEGIN
  -- Allow only safe terminal statuses
  IF p_status NOT IN ('cancelled', 'error', 'completed', 'preflight_ceiling') THEN
    RAISE EXCEPTION 'Invalid status % for force_finish_pricing_job', p_status;
  END IF;

  UPDATE ops.pricing_job_runs
  SET 
    status = p_status,
    finished_at = now(),
    error = COALESCE(p_error, error)
  WHERE id = p_job_id;
END;
$function$;