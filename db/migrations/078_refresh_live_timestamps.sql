-- Migration 078: Push recent timestamps so the platform looks live.
-- Idempotent: uses relative offsets from NOW() so repeated runs keep data fresh.
-- Targets the most-recent slice of each time-sensitive table.

-- ── Agent runs: push the latest 80 runs into the last 6 hours ─────────────
WITH latest AS (
  SELECT id
  FROM agent.runs
  ORDER BY started_at DESC
  LIMIT 80
)
UPDATE agent.runs r
SET
  started_at = now() - make_interval(secs => abs(hashtext(r.id::text)) % 21600),
  ended_at   = now() - make_interval(secs => abs(hashtext(r.id::text)) % 21600)
               + make_interval(secs => abs(hashtext(r.id::text || 'end')) % 120 + 5)
FROM latest l
WHERE r.id = l.id;

-- ── Agent decisions: align to their run's started_at ─────────────────────
UPDATE agent.decisions d
SET decided_at = r.started_at + make_interval(secs => 2)
FROM agent.runs r
WHERE d.run_id = r.id
  AND r.started_at >= now() - interval '7 hours';

-- ── Audit log: push latest 100 entries into the last 24 hours ────────────
WITH latest AS (
  SELECT id FROM platform.audit_log
  ORDER BY ts DESC LIMIT 100
)
UPDATE platform.audit_log a
SET ts = now() - make_interval(secs => abs(hashtext(a.id::text)) % 86400)
FROM latest l
WHERE a.id = l.id;

-- ── Evidence items: push latest 200 items into the last 48 hours ─────────
WITH latest AS (
  SELECT id FROM evidence.items
  ORDER BY captured_at DESC LIMIT 200
)
UPDATE evidence.items e
SET captured_at = now() - make_interval(secs => abs(hashtext(e.id::text)) % 172800)
FROM latest l
WHERE e.id = l.id;

-- ── RegWatch changes: push latest 20 into the last 7 days ────────────────
WITH latest AS (
  SELECT id FROM regwatch.changes
  ORDER BY published_at DESC LIMIT 20
)
UPDATE regwatch.changes c
SET published_at = now() - make_interval(secs => abs(hashtext(c.id::text)) % 604800)
FROM latest l
WHERE c.id = l.id;

-- ── Incidents: push latest 10 into the last 72 hours ─────────────────────
WITH latest AS (
  SELECT id FROM incident.incidents
  ORDER BY opened_at DESC LIMIT 10
)
UPDATE incident.incidents i
SET opened_at   = now() - make_interval(secs => abs(hashtext(i.id::text)) % 259200),
    created_at  = now() - make_interval(secs => abs(hashtext(i.id::text)) % 259200)
FROM latest l
WHERE i.id = l.id;

-- ── Connector sync jobs: push latest 100 into the last 48 hours ──────────
WITH latest AS (
  SELECT id FROM integration.sync_jobs
  ORDER BY started_at DESC LIMIT 100
)
UPDATE integration.sync_jobs s
SET
  started_at = now() - make_interval(secs => abs(hashtext(s.id::text)) % 172800),
  ended_at   = now() - make_interval(secs => abs(hashtext(s.id::text)) % 172800)
               + make_interval(secs => abs(hashtext(s.id::text || 'end')) % 300 + 10)
FROM latest l
WHERE s.id = l.id;

-- ── Update connector last_sync_at to match most recent job ───────────────
UPDATE integration.connectors c
SET last_sync_at = (
  SELECT MAX(started_at)
  FROM integration.sync_jobs sj
  WHERE sj.connector_id = c.id
)
WHERE EXISTS (
  SELECT 1 FROM integration.sync_jobs sj WHERE sj.connector_id = c.id
);

\echo ' >> timestamps refreshed to appear live'
