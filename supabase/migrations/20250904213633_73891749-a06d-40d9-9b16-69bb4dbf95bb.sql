-- Unschedule legacy cron jobs safely by name (no errors if missing)
-- Using jobid lookup avoids errors when jobname not found
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'justtcg-refresh-pokemon-nightly';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'justtcg-refresh-pokemon-japan-nightly';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'justtcg-refresh-mtg-nightly';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'pokemon-pricing-refresh';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mtg-pricing-refresh';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'yugioh-pricing-refresh';