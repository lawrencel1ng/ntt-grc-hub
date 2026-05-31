-- Migration 094: Backfill owner_user_id for all remaining tables with NULL owners.
-- Role assignments reflect who would realistically own each record type:
--   risk-owner    → compliance/risk items (gaps, ESG, issues, registers, treatments, incidents, policies)
--   control-owner → control library, issue actions
--   auditor       → audit findings
-- Where a tenant has multiple users of a role, picks the lowest UUID deterministically.
-- All updates are idempotent (WHERE owner_user_id IS NULL).

-- audit.findings → auditor
UPDATE audit.findings f
SET owner_user_id = (
  SELECT u.id FROM platform.users u
  WHERE u.tenant_id = f.tenant_id AND u.role = 'auditor' AND u.status = 'active'
  ORDER BY u.id LIMIT 1
)
WHERE f.owner_user_id IS NULL;

-- compliance.gaps → risk-owner
UPDATE compliance.gaps g
SET owner_user_id = (
  SELECT u.id FROM platform.users u
  WHERE u.tenant_id = g.tenant_id AND u.role = 'risk-owner' AND u.status = 'active'
  ORDER BY u.id LIMIT 1
)
WHERE g.owner_user_id IS NULL;

-- control.library → control-owner
UPDATE control.library c
SET owner_user_id = (
  SELECT u.id FROM platform.users u
  WHERE u.tenant_id = c.tenant_id AND u.role = 'control-owner' AND u.status = 'active'
  ORDER BY u.id LIMIT 1
)
WHERE c.owner_user_id IS NULL;

-- esg.targets → risk-owner
UPDATE esg.targets t
SET owner_user_id = (
  SELECT u.id FROM platform.users u
  WHERE u.tenant_id = t.tenant_id AND u.role = 'risk-owner' AND u.status = 'active'
  ORDER BY u.id LIMIT 1
)
WHERE t.owner_user_id IS NULL;

-- incident.incidents → risk-owner
UPDATE incident.incidents i
SET owner_user_id = (
  SELECT u.id FROM platform.users u
  WHERE u.tenant_id = i.tenant_id AND u.role = 'risk-owner' AND u.status = 'active'
  ORDER BY u.id LIMIT 1
)
WHERE i.owner_user_id IS NULL;

-- issue.actions → control-owner
UPDATE issue.actions a
SET owner_user_id = (
  SELECT u.id FROM platform.users u
  WHERE u.tenant_id = a.tenant_id AND u.role = 'control-owner' AND u.status = 'active'
  ORDER BY u.id LIMIT 1
)
WHERE a.owner_user_id IS NULL;

-- issue.issues → risk-owner
UPDATE issue.issues i
SET owner_user_id = (
  SELECT u.id FROM platform.users u
  WHERE u.tenant_id = i.tenant_id AND u.role = 'risk-owner' AND u.status = 'active'
  ORDER BY u.id LIMIT 1
)
WHERE i.owner_user_id IS NULL;

-- policy.documents → risk-owner
UPDATE policy.documents d
SET owner_user_id = (
  SELECT u.id FROM platform.users u
  WHERE u.tenant_id = d.tenant_id AND u.role = 'risk-owner' AND u.status = 'active'
  ORDER BY u.id LIMIT 1
)
WHERE d.owner_user_id IS NULL;

-- risk.registers → risk-owner
UPDATE risk.registers r
SET owner_user_id = (
  SELECT u.id FROM platform.users u
  WHERE u.tenant_id = r.tenant_id AND u.role = 'risk-owner' AND u.status = 'active'
  ORDER BY u.id LIMIT 1
)
WHERE r.owner_user_id IS NULL;

-- risk.treatments → risk-owner
UPDATE risk.treatments t
SET owner_user_id = (
  SELECT u.id FROM platform.users u
  WHERE u.tenant_id = t.tenant_id AND u.role = 'risk-owner' AND u.status = 'active'
  ORDER BY u.id LIMIT 1
)
WHERE t.owner_user_id IS NULL;

\echo ' >> owner_user_id backfilled for audit.findings, compliance.gaps, control.library, esg.targets, incident.incidents, issue.actions, issue.issues, policy.documents, risk.registers, risk.treatments'
