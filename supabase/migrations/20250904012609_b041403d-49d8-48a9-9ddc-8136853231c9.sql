-- Create function to fetch recent pricing jobs for UI
CREATE OR REPLACE FUNCTION public.get_pricing_jobs_recent()
RETURNS TABLE(
  id uuid,
  game text,
  expected_batches integer,
  actual_batches integer,
  cards_processed integer,
  variants_updated integer,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  status text,
  error text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pjr.id,
    pjr.game,
    pjr.expected_batches,
    pjr.actual_batches,
    pjr.cards_processed,
    pjr.variants_updated,
    pjr.started_at,
    pjr.finished_at,
    pjr.status,
    pjr.error
  FROM ops.pricing_job_runs pjr
  ORDER BY pjr.started_at DESC
  LIMIT 10;
END;
$$;