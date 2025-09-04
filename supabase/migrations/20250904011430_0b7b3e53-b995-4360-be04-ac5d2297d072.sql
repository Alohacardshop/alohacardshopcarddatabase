-- Update cron jobs to work without service role token (since function is now public)
-- First, unschedule existing jobs if they exist
SELECT cron.unschedule('justtcg-refresh-pokemon-nightly');
SELECT cron.unschedule('justtcg-refresh-pokemon-japan-nightly'); 
SELECT cron.unschedule('justtcg-refresh-mtg-nightly');

-- Pokémon EN nightly refresh at 00:00 UTC (simplified without auth header)
SELECT cron.schedule(
  'justtcg-refresh-pokemon-nightly',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dhyvufggodqkcjbrjhxk.supabase.co/functions/v1/justtcg-refresh-variants?game=pokemon',
    headers := '{"Content-Type": "application/json"}'::jsonb,
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
    headers := '{"Content-Type": "application/json"}'::jsonb,
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
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Trigger initial test runs for all games
SELECT net.http_post(
  url := 'https://dhyvufggodqkcjbrjhxk.supabase.co/functions/v1/justtcg-refresh-variants?game=pokemon',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{}'::jsonb
);

SELECT net.http_post(
  url := 'https://dhyvufggodqkcjbrjhxk.supabase.co/functions/v1/justtcg-refresh-variants?game=pokemon-japan',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{}'::jsonb
);

SELECT net.http_post(
  url := 'https://dhyvufggodqkcjbrjhxk.supabase.co/functions/v1/justtcg-refresh-variants?game=mtg',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{}'::jsonb
);