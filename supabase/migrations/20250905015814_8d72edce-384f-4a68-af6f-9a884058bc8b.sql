
-- 1) Kill stuck jobs across pricing and sync jobs (admin-only)
create or replace function public.kill_stuck_jobs(p_max_runtime_minutes integer default 120)
returns jsonb
language plpgsql
security definer
set search_path to 'public','ops'
as $$
declare
  v_pricing_killed integer := 0;
  v_sync_failed integer := 0;
  v_queue_cancelled integer := 0;
begin
  -- Only admins can run
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Not authorized';
  end if;

  -- Kill stuck pricing job runs (> p_max_runtime_minutes)
  with upd as (
    update ops.pricing_job_runs
    set
      status = 'error',
      finished_at = now(),
      error = coalesce(error, 'Stuck job terminated by admin')
    where status = 'running'
      and started_at < now() - (p_max_runtime_minutes || ' minutes')::interval
    returning 1
  ) select count(*) into v_pricing_killed from upd;

  -- Fail stuck sync jobs (> p_max_runtime_minutes)
  with upd2 as (
    update public.sync_jobs
    set
      status = 'failed',
      completed_at = now(),
      error_details = coalesce(error_details, '{}'::jsonb)
        || jsonb_build_object('admin_note','Stuck job terminated by admin','terminated_at', now())
    where status = 'running'
      and started_at < now() - (p_max_runtime_minutes || ' minutes')::interval
    returning 1
  ) select count(*) into v_sync_failed from upd2;

  -- Cancel running items in the pricing queue (defensive)
  with upd3 as (
    update public.pricing_job_queue
    set
      status = 'cancelled',
      updated_at = now(),
      error_message = coalesce(error_message, 'Cancelled by admin (kill_stuck_jobs)')
    where status in ('running')
    returning 1
  ) select count(*) into v_queue_cancelled from upd3;

  return jsonb_build_object(
    'pricing_jobs_killed', v_pricing_killed,
    'sync_jobs_failed', v_sync_failed,
    'queue_cancelled', v_queue_cancelled
  );
end;
$$;

-- 2) Reset the whole sync system (admin-only)
create or replace function public.reset_sync_system()
returns jsonb
language plpgsql
security definer
set search_path to 'public','ops'
as $$
declare
  v_kill jsonb;
  v_queue_cleared integer := 0;
  v_pricing_cancelled integer := 0;
  v_sync_cancelled integer := 0;
  v_breakers_reset integer := 0;
begin
  -- Only admins can run
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Not authorized';
  end if;

  -- First, kill anything running (no grace period)
  v_kill := public.kill_stuck_jobs(0);

  -- Cancel remaining running pricing jobs
  with upd as (
    update ops.pricing_job_runs
    set
      status = 'error',
      finished_at = now(),
      error = coalesce(error, 'Cancelled by admin (reset_sync_system)')
    where status = 'running'
    returning 1
  ) select count(*) into v_pricing_cancelled from upd;

  -- Cancel remaining running sync jobs
  with upd2 as (
    update public.sync_jobs
    set
      status = 'failed',
      completed_at = now(),
      error_details = coalesce(error_details, '{}'::jsonb)
        || jsonb_build_object('admin_note','Cancelled by admin (reset_sync_system)','terminated_at', now())
    where status = 'running'
    returning 1
  ) select count(*) into v_sync_cancelled from upd2;

  -- Clear the job queue (queued or running)
  delete from public.pricing_job_queue
  where status in ('queued','running');
  get diagnostics v_queue_cleared = row_count;

  -- Reset circuit breakers
  update public.pricing_circuit_breaker
  set
    state = 'closed',
    failure_count = 0,
    last_failure_at = null,
    next_attempt_at = null,
    updated_at = now()
  where state <> 'closed';
  get diagnostics v_breakers_reset = row_count;

  return jsonb_build_object(
    'kill_result', v_kill,
    'pricing_cancelled', v_pricing_cancelled,
    'sync_cancelled', v_sync_cancelled,
    'queue_cleared', v_queue_cleared,
    'breakers_reset', v_breakers_reset
  );
end;
$$;

-- 3) View stuck jobs over threshold (admin-only)
create or replace function public.get_stuck_jobs(p_max_runtime_minutes integer default 120)
returns table(
  source text,
  id uuid,
  game text,
  status text,
  started_at timestamptz,
  duration_minutes integer,
  details text
)
language sql
stable
set search_path to 'public','ops'
as $$
  with
  pricing as (
    select
      'pricing'::text as source,
      p.id,
      p.game::text as game,
      p.status::text as status,
      p.started_at,
      (extract(epoch from (now() - p.started_at))/60)::int as duration_minutes,
      coalesce(p.error,'') as details
    from ops.pricing_job_runs p
    where p.status = 'running'
      and p.started_at < now() - (p_max_runtime_minutes || ' minutes')::interval
  ),
  sync as (
    select
      'sync'::text as source,
      s.id,
      s.game_slug::text as game,
      s.status::text as status,
      s.started_at,
      (extract(epoch from (now() - s.started_at))/60)::int as duration_minutes,
      coalesce(s.type::text,'') as details
    from public.sync_jobs s
    where s.status = 'running'
      and s.started_at < now() - (p_max_runtime_minutes || ' minutes')::interval
  )
  select * from pricing
  union all
  select * from sync
  order by started_at desc;
$$;

-- 4) Hourly auto-cleanup routine (cron target)
create or replace function public.auto_cleanup_jobs_and_breakers()
returns jsonb
language plpgsql
security definer
set search_path to 'public','ops'
as $$
declare
  v_pricing_cancelled integer := 0;
  v_sync_failed integer := 0;
  v_pricing_deleted integer := 0;
  v_sync_deleted integer := 0;
  v_breakers_reset integer := 0;
begin
  -- Cancel stuck pricing runs (> 120 minutes) using existing helper
  v_pricing_cancelled := public.cancel_stuck_pricing_jobs(120);

  -- Fail stuck sync_jobs (> 120 minutes)
  with upd as (
    update public.sync_jobs
    set
      status = 'failed',
      completed_at = now(),
      error_details = coalesce(error_details,'{}'::jsonb)
        || jsonb_build_object('auto_cleanup', true, 'reason','Auto-timeout: exceeded max runtime', 'terminated_at', now())
    where status = 'running'
      and started_at < now() - interval '120 minutes'
    returning 1
  ) select count(*) into v_sync_failed from upd;

  -- Delete old pricing job runs (> 7 days, terminal states)
  with del as (
    delete from ops.pricing_job_runs
    where finished_at < now() - interval '7 days'
      and status in ('completed','error','cancelled','preflight_ceiling')
    returning 1
  ) select count(*) into v_pricing_deleted from del;

  -- Delete old sync jobs (> 7 days, terminal states)
  with del2 as (
    delete from public.sync_jobs
    where completed_at < now() - interval '7 days'
      and status in ('completed','failed')
    returning 1
  ) select count(*) into v_sync_deleted from del2;

  -- Reset circuit breakers if open and recovery window has passed
  with upd3 as (
    update public.pricing_circuit_breaker
    set
      state = 'closed',
      failure_count = 0,
      last_failure_at = null,
      next_attempt_at = null,
      updated_at = now()
    where state <> 'closed'
      and (next_attempt_at is null or now() >= next_attempt_at)
    returning 1
  ) select count(*) into v_breakers_reset from upd3;

  return jsonb_build_object(
    'pricing_cancelled', v_pricing_cancelled,
    'sync_failed', v_sync_failed,
    'pricing_deleted', v_pricing_deleted,
    'sync_deleted', v_sync_deleted,
    'breakers_reset', v_breakers_reset
  );
end;
$$;

-- 5) Idempotent hourly schedule for auto-cleanup
do $$
begin
  if exists (select 1 from cron.job where jobname = 'auto-cleanup-sync-system-hourly') then
    perform cron.unschedule('auto-cleanup-sync-system-hourly');
  end if;

  perform cron.schedule(
    'auto-cleanup-sync-system-hourly',
    '0 * * * *',
    $$ select public.auto_cleanup_jobs_and_breakers(); $$
  );
end $$;

-- 6) Immediate unblock: kill currently stuck jobs (> 120 minutes)
select public.kill_stuck_jobs(120);

-- Optional: show remaining stuck jobs (if any)
select * from public.get_stuck_jobs(120);
