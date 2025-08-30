
-- Add the missing job type so the refresh-variants function can write to sync_jobs
ALTER TYPE public.sync_job_type_enum
ADD VALUE IF NOT EXISTS 'refresh_variants';
