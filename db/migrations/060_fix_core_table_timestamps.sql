-- Migration 060: Fix seeded timestamps on core tables.
-- Many tables have all rows stuck at the seed timestamp (2026-05-29 00:42:44.xxx).
-- This spreads created_at across last 90 days and jitters the time component
-- of audit.engagements.opened_at / closed_at.
-- Idempotent: WHERE matches exact seed microsecond values.

-- =====================================================================
-- audit.findings — spread created_at across last 90 days
-- =====================================================================
UPDATE audit.findings
SET created_at = '2026-02-27 01:00:00+08'::timestamptz
    + make_interval(secs => abs(hashtext(id::text)) % 7776000)
WHERE created_at::text LIKE '%00:42:44.725372%';

-- =====================================================================
-- audit.engagements — jitter time component of opened_at / closed_at
-- =====================================================================
UPDATE audit.engagements
SET opened_at = opened_at
    - make_interval(secs => 42 * 60 + 44)           -- remove 00:42:44
    + make_interval(secs => abs(hashtext(id::text)) % 57600),  -- add 0-16h
    closed_at = CASE WHEN closed_at IS NOT NULL THEN
      closed_at
      - make_interval(secs => 42 * 60 + 44)
      + make_interval(secs => abs(hashtext(id::text || 'cl')) % 57600)
    ELSE NULL END,
    created_at = opened_at
    + make_interval(secs => abs(hashtext(id::text || 'cr')) % 3600)
WHERE opened_at::text LIKE '%00:42:44%';

-- =====================================================================
-- issue.issues — spread created_at across last 90 days
-- =====================================================================
UPDATE issue.issues
SET created_at = '2026-02-27 01:00:00+08'::timestamptz
    + make_interval(secs => abs(hashtext(id::text)) % 7776000)
WHERE created_at::text LIKE '%00:42:44.770803%';

-- =====================================================================
-- vendor.vendors — spread created_at across last 180 days
-- =====================================================================
UPDATE vendor.vendors
SET created_at = '2025-11-28 01:00:00+08'::timestamptz
    + make_interval(secs => abs(hashtext(id::text)) % 15552000)
WHERE created_at::text LIKE '%00:42:44.737328%';

-- =====================================================================
-- vendor.contracts — spread created_at across last 180 days
-- =====================================================================
UPDATE vendor.contracts
SET created_at = '2025-11-28 01:00:00+08'::timestamptz
    + make_interval(secs => abs(hashtext(id::text)) % 15552000)
WHERE created_at::text LIKE '%00:42:44%'
  AND created_at >= '2026-05-28 00:00:00+08'
  AND created_at <  '2026-05-30 00:00:00+08';

-- =====================================================================
-- policy.documents — spread created_at across last 365 days
-- =====================================================================
UPDATE policy.documents
SET created_at = '2025-05-29 01:00:00+08'::timestamptz
    + make_interval(secs => abs(hashtext(id::text)) % 31536000)
WHERE created_at::text LIKE '%00:42:44%'
  AND created_at >= '2026-05-28 00:00:00+08'
  AND created_at <  '2026-05-30 00:00:00+08';
