-- Migration 051: Push ~50 agent.runs into the last 6 hours so the
-- "last decision" counter shows minutes/hours, not days.
-- Selects runs deterministically by hashtext and updates their timestamps
-- to now() - 0..6 hours.
-- Idempotent: only touches runs WHERE started_at = exact seed ceiling date.

WITH target_runs AS (
  SELECT id
  FROM agent.runs
  WHERE started_at >= '2026-05-27 20:00:00+08'
    AND started_at <  '2026-05-28 02:00:00+08'
  ORDER BY abs(hashtext(id::text))
  LIMIT 80
)
UPDATE agent.runs r
SET
  started_at = now() - make_interval(secs => abs(hashtext(r.id::text)) % 21600),
  ended_at   = now() - make_interval(secs => abs(hashtext(r.id::text)) % 21600)
              + make_interval(secs => abs(hashtext(r.id::text || 'end')) % 120 + 5)
FROM target_runs t
WHERE r.id = t.id;

-- Align decisions for those runs
UPDATE agent.decisions d
SET decided_at = r.started_at + make_interval(secs => 2)
FROM agent.runs r
WHERE d.run_id = r.id
  AND r.started_at >= now() - interval '7 hours';
