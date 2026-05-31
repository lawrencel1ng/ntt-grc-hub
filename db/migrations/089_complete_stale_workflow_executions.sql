-- Migration 089: Mark workflow executions older than 2 days that are still
-- 'running' as 'success' (with a deterministic mix of fail) so the workflow
-- history looks like a realistic live system rather than frozen at seed time.
-- Executions started within the last 2 days remain 'running' to show
-- active workflows on the /workflows page.

UPDATE workflow.executions
SET
  status = CASE
    WHEN abs(hashtext(id::text)) % 10 < 2 THEN 'failed'::workflow.execution_status
    ELSE 'success'::workflow.execution_status
  END,
  ended_at = started_at + make_interval(
    secs => 30 + abs(hashtext(id::text || 'dur')) % 1800   -- 30s–30m duration
  )
WHERE status = 'running'
  AND started_at < now() - interval '2 days';

\echo ' >> stale running workflow executions completed'
