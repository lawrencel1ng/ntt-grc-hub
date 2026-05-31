-- Migration 093: Backfill owner_user_id for risks, BCM plans, and AI models
-- Uses each tenant's 'risk-owner' user for risks/BCM, and 'admin' user for AI models.
-- Where a tenant has multiple users of that role, deterministically picks the one
-- with the lowest UUID (MIN) so results are stable on re-run.
-- All updates are idempotent (only touch rows where owner_user_id IS NULL).

-- 1. Risks → tenant's risk-owner
UPDATE risk.risks r
SET owner_user_id = (
  SELECT u.id
  FROM platform.users u
  WHERE u.tenant_id = r.tenant_id
    AND u.role = 'risk-owner'
    AND u.status = 'active'
  ORDER BY u.id LIMIT 1
)
WHERE r.owner_user_id IS NULL;

-- 2. BCM plans → tenant's risk-owner (they own continuity plans)
UPDATE bcm.plans p
SET owner_user_id = (
  SELECT u.id
  FROM platform.users u
  WHERE u.tenant_id = p.tenant_id
    AND u.role = 'risk-owner'
    AND u.status = 'active'
  ORDER BY u.id LIMIT 1
)
WHERE p.owner_user_id IS NULL;

-- 3. AI models → tenant's admin user
UPDATE ai_gov.models m
SET owner_user_id = (
  SELECT u.id
  FROM platform.users u
  WHERE u.tenant_id = m.tenant_id
    AND u.role = 'admin'
    AND u.status = 'active'
  ORDER BY u.id LIMIT 1
)
WHERE m.owner_user_id IS NULL;

\echo ' >> owner_user_id backfilled for risks, bcm.plans, and ai_gov.models'
