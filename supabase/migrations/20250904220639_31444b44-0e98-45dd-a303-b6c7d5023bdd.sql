-- Add new cron jobs for sealed products and Yu-Gi-Oh
SELECT cron.schedule(
  'sealed-products-daily',
  '0 5 * * *', -- 5:00 AM UTC daily
  $$
  SELECT
    net.http_post(
      url:='https://dhyvufggodqkcjbrjhxk.supabase.co/functions/v1/justtcg-sealed-sync',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeXZ1Zmdnb2Rxa2NqYnJqaHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MDIyOTcsImV4cCI6MjA3MjA3ODI5N30.0GncadcSHVbthqyubXLiBflm44sFEz_izfF5uF-xEvs"}'::jsonb,
      body:=json_build_object('gameSlug', 'pokemon-en')::jsonb
    ) as request_id;
  $$
);

SELECT cron.schedule(
  'yugioh-complete-daily', 
  '0 6 * * *', -- 6:00 AM UTC daily
  $$
  SELECT
    net.http_post(
      url:='https://dhyvufggodqkcjbrjhxk.supabase.co/functions/v1/justtcg-refresh-variants',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeXZ1Zmdnb2Rxa2NqYnJqaHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MDIyOTcsImV4cCI6MjA3MjA3ODI5N30.0GncadcSHVbthqyubXLiBflm44sFEz_izfF5uF-xEvs"}'::jsonb,
      body:=json_build_object('gameSlug', 'yugioh')::jsonb  
    ) as request_id;
  $$
);