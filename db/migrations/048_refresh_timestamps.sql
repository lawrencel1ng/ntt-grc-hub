-- Migration 048: Spread agent.runs and agent.decisions timestamps across
-- the last 90 days, and push recent evidence items into the last 24 hours
-- so activity dashboards show live data.
-- Idempotent: agent.runs WHERE started_at = exact seed date.

-- =============================================================================
-- Part 1: agent.runs — spread across last 90 days
-- Hash-based offset: 0–7,776,000 seconds (0–90 days)
-- ended_at preserves the same relative duration (400ms per run)
-- =============================================================================

UPDATE agent.runs
SET
  started_at = '2026-02-27 01:00:00+08'::timestamptz
              + make_interval(secs => (abs(hashtext(id::text)) % 7776000)),
  ended_at   = '2026-02-27 01:00:00+08'::timestamptz
              + make_interval(secs => (abs(hashtext(id::text)) % 7776000))
              + make_interval(secs => (abs(hashtext(id::text || 'end')) % 120 + 5))
WHERE started_at = '2026-05-17 00:05:35.797676+08'::timestamptz;

-- =============================================================================
-- Part 2: agent.decisions — align to their run's timestamp
-- =============================================================================

UPDATE agent.decisions d
SET decided_at = r.started_at + make_interval(secs => 2)
FROM agent.runs r
WHERE d.run_id = r.id
  AND d.decided_at = '2026-05-17 00:05:50.797676+08'::timestamptz;

-- =============================================================================
-- Part 3: evidence.items — push the most recent ~120 items into last 24 hours
-- Uses hashtext to pick a subset and staggers them over the past 18 hours
-- =============================================================================

WITH recent_subset AS (
  SELECT id
  FROM evidence.items
  WHERE captured_at >= '2026-05-29 00:00:00+08'
    AND captured_at < '2026-05-30 00:00:00+08'
  ORDER BY captured_at DESC
  LIMIT 120
)
UPDATE evidence.items e
SET captured_at = now() - make_interval(secs => (abs(hashtext(e.id::text)) % 64800))
FROM recent_subset rs
WHERE e.id = rs.id;
