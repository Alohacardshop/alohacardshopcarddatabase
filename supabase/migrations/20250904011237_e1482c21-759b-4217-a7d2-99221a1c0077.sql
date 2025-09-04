-- Set up database setting for service role token (replace with your actual service role key)
-- WARNING: Only run this with your actual service role key
-- ALTER DATABASE postgres SET app.settings.service_role TO 'your-service-role-jwt-here';

-- For now, create the cron jobs structure - user will need to add service role key manually

-- Pokémon EN nightly refresh at 00:00 UTC
SELECT cron.schedule(
  'justtcg-refresh-pokemon-nightly',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dhyvufggodqkcjbrjhxk.supabase.co/functions/v1/justtcg-refresh-variants?game=pokemon',
    headers := jsonb_build_object('Authorization','Bearer ' || current_setting('app.settings.service_role')),
    body := '{}'::jsonb
  );
  $$
);

-- Pokémon Japan nightly refresh at 00:02 UTC
SELECT cron.schedule(
  'justtcg-refresh-pokemon-japan-nightly',
  '2 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dhyvufggodqkcjbrjhxk.supabase.co/functions/v1/justtcg-refresh-variants?game=pokemon-japan',
    headers := jsonb_build_object('Authorization','Bearer ' || current_setting('app.settings.service_role')),
    body := '{}'::jsonb
  );
  $$
);

-- MTG nightly refresh at 00:04 UTC
SELECT cron.schedule(
  'justtcg-refresh-mtg-nightly',
  '4 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dhyvufggodqkcjbrjhxk.supabase.co/functions/v1/justtcg-refresh-variants?game=mtg',
    headers := jsonb_build_object('Authorization','Bearer ' || current_setting('app.settings.service_role')),
    body := '{}'::jsonb
  );
  $$
);

-- Create a view to monitor cron jobs
CREATE OR REPLACE VIEW ops.cron_jobs AS
SELECT 
  jobname,
  schedule,
  command,
  active,
  jobid
FROM cron.job 
WHERE jobname LIKE '%justtcg-refresh%'
ORDER BY jobname;

-- Create a helper function to trigger initial runs (for testing)
CREATE OR REPLACE FUNCTION ops.trigger_pricing_refresh(p_game TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- This will need to be called manually or via a different method
  -- since we can't directly call the edge function from SQL without the service role token
  RETURN jsonb_build_object(
    'message', 'Use the edge function directly or set up service role token first',
    'game', p_game,
    'url', 'https://dhyvufggodqkcjbrjhxk.supabase.co/functions/v1/justtcg-refresh-variants?game=' || p_game
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions for the ops schema
GRANT USAGE ON SCHEMA ops TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA ops TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA catalog_v2 TO authenticated;

-- Grant permissions for the pricing job monitoring
GRANT SELECT ON ops.pricing_job_runs TO authenticated;
GRANT SELECT ON catalog_v2.variant_price_history TO authenticated;