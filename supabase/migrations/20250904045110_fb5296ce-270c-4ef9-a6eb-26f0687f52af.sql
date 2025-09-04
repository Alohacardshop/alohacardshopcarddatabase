-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule Pokémon pricing refresh every 6 hours
SELECT cron.schedule(
  'pokemon-pricing-refresh',
  '0 */6 * * *', -- Every 6 hours
  $$
  SELECT
    net.http_post(
        url:='https://dhyvufggodqkcjbrjhxk.supabase.co/functions/v1/justtcg-refresh-variants',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeXZ1Zmdnb2Rxa2NqYnJqaHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MDIyOTcsImV4cCI6MjA3MjA3ODI5N30.0GncadcSHVbthqyubXLiBflm44sFEz_izfF5uF-xEvs"}'::jsonb,
        body:='{"game": "pokemon"}'::jsonb
    ) as request_id;
  $$
);

-- Schedule Magic pricing refresh every 8 hours (offset by 2 hours)
SELECT cron.schedule(
  'mtg-pricing-refresh', 
  '0 2,10,18 * * *', -- At 2AM, 10AM, 6PM
  $$
  SELECT
    net.http_post(
        url:='https://dhyvufggodqkcjbrjhxk.supabase.co/functions/v1/justtcg-refresh-variants',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeXZ1Zmdnb2Rxa2NqYnJqaHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MDIyOTcsImV4cCI6MjA3MjA3ODI5N30.0GncadcSHVbthqyubXLiBflm44sFEz_izfF5uF-xEvs"}'::jsonb,
        body:='{"game": "magic-the-gathering"}'::jsonb
    ) as request_id;
  $$
);

-- Schedule Yu-Gi-Oh pricing refresh daily at 4AM
SELECT cron.schedule(
  'yugioh-pricing-refresh',
  '0 4 * * *', -- Daily at 4AM
  $$
  SELECT
    net.http_post(
        url:='https://dhyvufggodqkcjbrjhxk.supabase.co/functions/v1/justtcg-refresh-variants',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeXZ1Zmdnb2Rxa2NqYnJqaHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MDIyOTcsImV4cCI6MjA3MjA3ODI5N30.0GncadcSHVbthqyubXLiBflm44sFEz_izfF5uF-xEvs"}'::jsonb,
        body:='{"game": "yugioh"}'::jsonb
    ) as request_id;
  $$
);