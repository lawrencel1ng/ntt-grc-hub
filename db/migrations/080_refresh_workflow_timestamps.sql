-- Migration 080: Refresh workflow execution timestamps into the last 7 days.
-- workflow.executions.started_at was last at ~4 days ago; push the latest 100
-- into the last 7 days so the Workflows page shows recent activity.

WITH latest AS (
  SELECT id
  FROM workflow.executions
  ORDER BY started_at DESC
  LIMIT 100
)
UPDATE workflow.executions e
SET
  started_at = now() - make_interval(secs => abs(hashtext(e.id::text)) % 604800),
  ended_at   = now() - make_interval(secs => abs(hashtext(e.id::text)) % 604800)
               + make_interval(secs => abs(hashtext(e.id::text || 'end')) % 300 + 5)
FROM latest l
WHERE e.id = l.id;

\echo ' >> workflow execution timestamps refreshed'
