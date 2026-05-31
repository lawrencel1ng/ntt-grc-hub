-- Migration 061: Fix remaining seeded timestamps on secondary tables.
-- issue.actions, vendor.questionnaires, compliance.gaps, audit.workpapers,
-- privacy.subject_requests, and compliance.attestations are all stuck at
-- their seed microsecond from 2026-05-29 00:42:44.xxx.
-- Spreads created_at across last 90-180 days with hashtext-based jitter.
-- Idempotent: WHERE matches exact seed date window.

-- issue.actions — spread across last 90 days
UPDATE issue.actions
SET created_at = '2026-02-27 01:00:00+08'::timestamptz
    + make_interval(secs => abs(hashtext(id::text)) % 7776000)
WHERE created_at >= '2026-05-28 00:00:00+08'
  AND created_at <  '2026-05-30 00:00:00+08'
  AND created_at::text LIKE '%00:42:44%';

-- vendor.questionnaires — spread across last 180 days
UPDATE vendor.questionnaires
SET created_at = '2025-11-28 01:00:00+08'::timestamptz
    + make_interval(secs => abs(hashtext(id::text)) % 15552000),
    sent_at = CASE WHEN sent_at IS NOT NULL THEN
      '2025-11-28 01:00:00+08'::timestamptz
      + make_interval(secs => abs(hashtext(id::text || 'sent')) % 15552000)
    ELSE NULL END
WHERE created_at >= '2026-05-28 00:00:00+08'
  AND created_at <  '2026-05-30 00:00:00+08'
  AND created_at::text LIKE '%00:42:44%';

-- compliance.gaps — spread across last 90 days
UPDATE compliance.gaps
SET created_at = '2026-02-27 01:00:00+08'::timestamptz
    + make_interval(secs => abs(hashtext(id::text)) % 7776000)
WHERE created_at >= '2026-05-28 00:00:00+08'
  AND created_at <  '2026-05-30 00:00:00+08'
  AND created_at::text LIKE '%00:42:44%';

-- audit.workpapers — spread across last 90 days
UPDATE audit.workpapers
SET created_at = '2026-02-27 01:00:00+08'::timestamptz
    + make_interval(secs => abs(hashtext(id::text)) % 7776000)
WHERE created_at >= '2026-05-28 00:00:00+08'
  AND created_at <  '2026-05-30 00:00:00+08'
  AND created_at::text LIKE '%00:42:44%';

-- privacy.subject_requests — spread across last 90 days
UPDATE privacy.subject_requests
SET created_at = '2026-02-27 01:00:00+08'::timestamptz
    + make_interval(secs => abs(hashtext(id::text)) % 7776000)
WHERE created_at >= '2026-05-28 00:00:00+08'
  AND created_at <  '2026-05-30 00:00:00+08'
  AND created_at::text LIKE '%00:42:44%';

-- compliance.attestations — spread across last 180 days
UPDATE compliance.attestations
SET created_at = '2025-11-28 01:00:00+08'::timestamptz
    + make_interval(secs => abs(hashtext(id::text)) % 15552000)
WHERE created_at >= '2026-05-28 00:00:00+08'
  AND created_at <  '2026-05-30 00:00:00+08'
  AND created_at::text LIKE '%00:42:44%';
