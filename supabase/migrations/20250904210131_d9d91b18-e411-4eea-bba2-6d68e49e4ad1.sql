-- Enable the automated pricing cron jobs

-- First, unschedule any existing jobs to avoid duplicates
SELECT cron.unschedule('pricing-pokemon-en-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pricing-pokemon-en-daily');
SELECT cron.unschedule('pricing-pokemon-jp-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pricing-pokemon-jp-daily');
SELECT cron.unschedule('pricing-mtg-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pricing-mtg-daily');

-- Schedule Pokémon EN daily at 2:00 AM UTC
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

-- Schedule Pokémon JP daily at 3:00 AM UTC  
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

-- Schedule MTG daily at 4:00 AM UTC
SELECT cron.schedule(
  'pricing-mtg-daily', 
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url:='https://dhyvufggodqkcjbrjhxk.supabase.co/functions/v1/pricing-job-scheduler',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeXZ1Zmdnb2Rxa2NqYnJqaHhrIiwicm9sZSI6ImFub22"}'::jsonb,
    body:='{"game": "mtg", "priority": 10}'::jsonb
  );
  $$
);

-- Create function to get current cron job status
CREATE OR REPLACE FUNCTION public.get_cron_jobs_status()
RETURNS TABLE(
  job_name text,
  schedule text,
  active boolean,
  last_run timestamp with time zone,
  next_run timestamp with time zone
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    jobname::text,
    schedule::text,
    active,
    last_run,
    (
      CASE 
        WHEN active THEN 
          cron.schedule_in_database(schedule, timezone('UTC', now()))
        ELSE NULL
      END
    )::timestamp with time zone as next_run
  FROM cron.job 
  WHERE jobname LIKE '%pricing-%'
  ORDER BY jobname;
$$;

-- Create test function to trigger small batch pricing update  
CREATE OR REPLACE FUNCTION public.trigger_test_pricing_batch(
  p_game text DEFAULT 'mtg',
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_response jsonb;
BEGIN
  -- Call the pricing scheduler with test parameters
  SELECT net.http_post(
    url:='https://dhyvufggodqkcjbrjhxk.supabase.co/functions/v1/pricing-job-scheduler',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeXZ1Zmdnb2Rxa2NqYnJqaHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MDIyOTcsImV4cCI6MjA3MjA3ODI5N30.0GncadcSHVbthqyubXLiBflm44sFEz_izfF5uF-xEvs"}'::jsonb,
    body:=json_build_object('game', p_game, 'priority', 100, 'test_mode', true, 'test_limit', p_limit)::jsonb
  ) INTO v_response;

  RETURN v_response;
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'error', SQLERRM,
    'success', false
  )::jsonb;
END;
$$;