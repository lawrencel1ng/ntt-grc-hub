-- Migration 049: Spread control.test_runs ran_at across last 90 days,
-- and align compliance.assessments.created_at to started_at - 7 days.
-- Idempotent: control.test_runs WHERE ran_at in seed window;
--             assessments WHERE created_at = exact seed date.

-- =============================================================================
-- Part 1: control.test_runs — spread ran_at across last 90 days
-- Hash-based offset: 0–7,776,000 seconds (0–90 days)
-- =============================================================================

UPDATE control.test_runs
SET ran_at = '2026-02-27 01:00:00+08'::timestamptz
            + make_interval(secs => (abs(hashtext(id::text)) % 7776000))
WHERE ran_at >= '2026-05-25 00:00:00+08'
  AND ran_at <  '2026-05-30 00:00:00+08';

-- =============================================================================
-- Part 2: compliance.assessments — set created_at to started_at - 7 days
-- or now() - 90 days as fallback for rows without started_at
-- =============================================================================

UPDATE compliance.assessments
SET created_at = COALESCE(started_at - interval '7 days',
                          '2026-02-27 01:00:00+08'::timestamptz
                          + make_interval(secs => (abs(hashtext(id::text)) % 7776000)))
WHERE created_at = '2026-05-29 00:42:44.718393+08'::timestamptz;
