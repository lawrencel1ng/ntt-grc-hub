-- Migration 088: Refresh connector sync_jobs so the "records ingested (24h)"
-- KPI on /connectors is non-zero for active connectors.
-- Previous seeds set all sync timestamps in the past; this pushes the most
-- recent sync job per connector into the last 12 hours using hashtext for
-- deterministic per-connector offsets (idempotent on re-run).

-- Step 1: Push the latest sync_job per connector into the last 12 hours.
WITH latest AS (
  SELECT DISTINCT ON (connector_id) id, connector_id
  FROM integration.sync_jobs
  ORDER BY connector_id, started_at DESC
)
UPDATE integration.sync_jobs sj
SET
  started_at = now() - make_interval(secs => abs(hashtext(sj.connector_id::text)) % 43200),
  ended_at   = now() - make_interval(secs => abs(hashtext(sj.connector_id::text)) % 43200) + interval '90 seconds'
FROM latest l
WHERE sj.id = l.id;

-- Step 2: Sync connectors.last_sync_at to match the job timestamps.
UPDATE integration.connectors c
SET last_sync_at = sj.started_at
FROM (
  SELECT DISTINCT ON (connector_id) connector_id, started_at
  FROM integration.sync_jobs
  ORDER BY connector_id, started_at DESC
) sj
WHERE c.id = sj.connector_id;

\echo ' >> connector sync timestamps refreshed to last 12 hours'
