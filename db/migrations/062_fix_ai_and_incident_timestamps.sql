-- Migration 062: Fix seeded timestamps on ai_gov and incident tables.
-- ai_gov.models, ai_gov.model_risk, incident.incidents, and
-- incident.postmortems still have created_at stuck at the seed date.
-- (incident.incidents.opened_at was fixed by migration 050.)
-- Idempotent: WHERE matches exact seed date window + time component.

-- ai_gov.model_risk — spread created_at across last 180 days
UPDATE ai_gov.model_risk
SET created_at = '2025-11-28 01:00:00+08'::timestamptz
    + make_interval(secs => abs(hashtext(id::text)) % 15552000)
WHERE created_at >= '2026-05-28 00:00:00+08'
  AND created_at <  '2026-05-30 00:00:00+08'
  AND created_at::text LIKE '%00:42:44%';

-- ai_gov.models — spread created_at across last 180 days
UPDATE ai_gov.models
SET created_at = '2025-11-28 01:00:00+08'::timestamptz
    + make_interval(secs => abs(hashtext(id::text)) % 15552000)
WHERE created_at >= '2026-05-28 00:00:00+08'
  AND created_at <  '2026-05-30 00:00:00+08'
  AND created_at::text LIKE '%00:42:44%';

-- incident.incidents — spread created_at (opened_at jitter done in migration 050)
UPDATE incident.incidents
SET created_at = '2026-02-27 01:00:00+08'::timestamptz
    + make_interval(secs => abs(hashtext(id::text)) % 7776000)
WHERE created_at >= '2026-05-28 00:00:00+08'
  AND created_at <  '2026-05-30 00:00:00+08'
  AND created_at::text LIKE '%00:42:44%';

-- incident.postmortems — spread created_at across last 90 days
UPDATE incident.postmortems
SET created_at = '2026-02-27 01:00:00+08'::timestamptz
    + make_interval(secs => abs(hashtext(id::text)) % 7776000)
WHERE created_at >= '2026-05-28 00:00:00+08'
  AND created_at <  '2026-05-30 00:00:00+08'
  AND created_at::text LIKE '%00:42:44%';
