-- Supabase pg_cron job: auto-transition ClassSession.status based on wall clock.
--
-- Runs every minute, inside Postgres — no Vercel function invocations.
-- Replaces what used to be `syncClassStatuses` called on every class.list
-- read, and what we briefly tried to do via a Vercel cron (rejected on
-- Hobby plan, max once-per-day).
--
-- Transitions:
--   SCHEDULED   -> IN_PROGRESS  when starts_at <= now()
--   IN_PROGRESS -> COMPLETED    when ends_at   <= now()
--   CANCELLED   -> (never touched)
--
-- ====================================================================
-- ONE-TIME SETUP (apply to PROD via Supabase SQL Editor)
-- ====================================================================
--
-- 1. Enable the pg_cron extension (Database -> Extensions, search "pg_cron",
--    toggle on). Or run:
--      CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- 2. Paste the schedule call below.
--
-- 3. Verify with:
--      SELECT jobid, schedule, command, active FROM cron.job
--      WHERE jobname = 'sync-class-statuses';
--
-- 4. After ~5 minutes, check it actually ran:
--      SELECT * FROM cron.job_run_details
--      WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-class-statuses')
--      ORDER BY start_time DESC LIMIT 10;
--
-- To remove (rollback):
--   SELECT cron.unschedule('sync-class-statuses');
--
-- ====================================================================

SELECT cron.schedule(
  'sync-class-statuses',
  '* * * * *',
  $$
    UPDATE public.class_sessions
       SET status = 'IN_PROGRESS'
     WHERE status = 'SCHEDULED'
       AND starts_at <= now();

    UPDATE public.class_sessions
       SET status = 'COMPLETED'
     WHERE status = 'IN_PROGRESS'
       AND ends_at <= now();
  $$
);
