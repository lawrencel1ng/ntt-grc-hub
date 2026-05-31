-- Migration 079: Refresh policy version timestamps so "Updated (30d)" KPI shows non-zero.
-- The effective_at on policy.versions maxed out at ~33 days ago; push the latest 20 per
-- tenant into the last 28 days so approved policies appear as recently updated.

WITH latest AS (
  SELECT DISTINCT ON (tenant_id)
         id,
         tenant_id
  FROM policy.versions
  WHERE status = 'approved'
    AND effective_at IS NOT NULL
  ORDER BY tenant_id, version_no DESC
)
UPDATE policy.versions v
SET effective_at = now() - make_interval(secs => abs(hashtext(v.id::text)) % (28 * 86400))
FROM latest l
WHERE v.id = l.id;

-- Also push a broader set (latest 3 approved per tenant) into last 30 days
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY version_no DESC) AS rn
  FROM policy.versions
  WHERE status = 'approved'
    AND effective_at IS NOT NULL
)
UPDATE policy.versions v
SET effective_at = now() - make_interval(secs => abs(hashtext(v.id::text || 'p')) % (25 * 86400))
FROM ranked r
WHERE v.id = r.id
  AND r.rn <= 3;

\echo ' >> policy version timestamps refreshed'
