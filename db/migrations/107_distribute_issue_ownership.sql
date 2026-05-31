-- Migration 107: Distribute issue.issues and audit.findings ownership across
-- multiple users per tenant. Currently all issues/findings for each tenant
-- are assigned to a single user (the first risk-owner), which looks unrealistic.
--
-- Strategy: round-robin assignment across admin + risk-owner + control-owner
-- users, using ROW_NUMBER() ordered by created_at so older issues get
-- more senior owners and newer ones rotate across the team.

-- ── issue.issues ──────────────────────────────────────────────────────────────
WITH owners AS (
  SELECT
    tenant_id,
    id AS user_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY
      CASE role
        WHEN 'admin'         THEN 1
        WHEN 'risk-owner'    THEN 2
        WHEN 'control-owner' THEN 3
        ELSE 4
      END, email
    ) AS rn
  FROM platform.users
  WHERE role IN ('admin', 'risk-owner', 'control-owner')
),
owner_counts AS (
  SELECT tenant_id, COUNT(*) AS cnt FROM owners GROUP BY tenant_id
),
ranked_issues AS (
  SELECT
    i.id,
    i.tenant_id,
    ROW_NUMBER() OVER (PARTITION BY i.tenant_id ORDER BY i.created_at) AS issue_rn
  FROM issue.issues i
),
assignments AS (
  SELECT
    ri.id,
    o.user_id
  FROM ranked_issues ri
  JOIN owner_counts oc ON oc.tenant_id = ri.tenant_id
  JOIN owners o
    ON o.tenant_id = ri.tenant_id
   AND o.rn = ((ri.issue_rn - 1) % oc.cnt) + 1
)
UPDATE issue.issues i
SET owner_user_id = a.user_id
FROM assignments a
WHERE i.id = a.id;

-- ── audit.findings ────────────────────────────────────────────────────────────
-- Distribute findings across auditor + control-owner users (who typically
-- own remediation of audit findings).
WITH owners AS (
  SELECT
    tenant_id,
    id AS user_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY
      CASE role
        WHEN 'auditor'       THEN 1
        WHEN 'control-owner' THEN 2
        WHEN 'risk-owner'    THEN 3
        ELSE 4
      END, email
    ) AS rn
  FROM platform.users
  WHERE role IN ('auditor', 'control-owner', 'risk-owner')
),
owner_counts AS (
  SELECT tenant_id, COUNT(*) AS cnt FROM owners GROUP BY tenant_id
),
ranked_findings AS (
  SELECT
    f.id,
    f.tenant_id,
    ROW_NUMBER() OVER (PARTITION BY f.tenant_id ORDER BY f.created_at) AS finding_rn
  FROM audit.findings f
),
assignments AS (
  SELECT
    rf.id,
    o.user_id
  FROM ranked_findings rf
  JOIN owner_counts oc ON oc.tenant_id = rf.tenant_id
  JOIN owners o
    ON o.tenant_id = rf.tenant_id
   AND o.rn = ((rf.finding_rn - 1) % oc.cnt) + 1
)
UPDATE audit.findings f
SET owner_user_id = a.user_id
FROM assignments a
WHERE f.id = a.id;

\echo ' >> issue.issues and audit.findings ownership distributed across team roles'
