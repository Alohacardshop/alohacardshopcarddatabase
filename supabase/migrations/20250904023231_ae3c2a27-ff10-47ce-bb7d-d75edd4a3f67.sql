-- Fix stuck pricing jobs by updating running jobs to error status
UPDATE ops.pricing_job_runs 
SET 
  status = 'error',
  finished_at = now(),
  error = 'Job timed out or failed to complete properly'
WHERE status = 'running' 
AND started_at < now() - interval '1 hour';