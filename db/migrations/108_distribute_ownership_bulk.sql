-- Migration 108: Distribute owner_user_id across all remaining single-owner tables.
--
-- Eight tables still have only one owner per tenant (all seeded to a single
-- "priya.*" risk-owner).  Each table gets a round-robin assignment via
-- ROW_NUMBER() ordered by created_at, matching the pattern from migration 107.
--
-- Role pools chosen to match real-world accountability:
--   risk.risks / risk.treatments / bcm.plans / policy.documents
--   incident.incidents / issue.actions / compliance.gaps
--       → admin · risk-owner · control-owner
--   control.library
--       → control-owner · admin · risk-owner  (control-owner priority)

-- ── Helper macro: builds (owners, owner_counts, ranked_rows, assignments) CTEs
-- Each section is independent; copy-paste keeps the file self-contained.

-- ── risk.risks ────────────────────────────────────────────────────────────────
WITH owners AS (
  SELECT
    tenant_id, id AS user_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY
      CASE role WHEN 'admin' THEN 1 WHEN 'risk-owner' THEN 2 WHEN 'control-owner' THEN 3 ELSE 4 END, email
    ) AS rn
  FROM platform.users
  WHERE role IN ('admin', 'risk-owner', 'control-owner')
),
owner_counts AS (
  SELECT tenant_id, COUNT(*) AS cnt FROM owners GROUP BY tenant_id
),
ranked AS (
  SELECT id, tenant_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at) AS rn
  FROM risk.risks
),
assignments AS (
  SELECT r.id, o.user_id
  FROM ranked r
  JOIN owner_counts oc ON oc.tenant_id = r.tenant_id
  JOIN owners o ON o.tenant_id = r.tenant_id AND o.rn = ((r.rn - 1) % oc.cnt) + 1
)
UPDATE risk.risks t SET owner_user_id = a.user_id
FROM assignments a WHERE t.id = a.id;

-- ── risk.treatments ───────────────────────────────────────────────────────────
WITH owners AS (
  SELECT
    tenant_id, id AS user_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY
      CASE role WHEN 'risk-owner' THEN 1 WHEN 'control-owner' THEN 2 WHEN 'admin' THEN 3 ELSE 4 END, email
    ) AS rn
  FROM platform.users
  WHERE role IN ('risk-owner', 'control-owner', 'admin')
),
owner_counts AS (
  SELECT tenant_id, COUNT(*) AS cnt FROM owners GROUP BY tenant_id
),
ranked AS (
  SELECT id, tenant_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at) AS rn
  FROM risk.treatments
),
assignments AS (
  SELECT r.id, o.user_id
  FROM ranked r
  JOIN owner_counts oc ON oc.tenant_id = r.tenant_id
  JOIN owners o ON o.tenant_id = r.tenant_id AND o.rn = ((r.rn - 1) % oc.cnt) + 1
)
UPDATE risk.treatments t SET owner_user_id = a.user_id
FROM assignments a WHERE t.id = a.id;

-- ── compliance.gaps ───────────────────────────────────────────────────────────
WITH owners AS (
  SELECT
    tenant_id, id AS user_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY
      CASE role WHEN 'admin' THEN 1 WHEN 'risk-owner' THEN 2 WHEN 'control-owner' THEN 3 WHEN 'auditor' THEN 4 ELSE 5 END, email
    ) AS rn
  FROM platform.users
  WHERE role IN ('admin', 'risk-owner', 'control-owner', 'auditor')
),
owner_counts AS (
  SELECT tenant_id, COUNT(*) AS cnt FROM owners GROUP BY tenant_id
),
ranked AS (
  SELECT id, tenant_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at) AS rn
  FROM compliance.gaps
),
assignments AS (
  SELECT r.id, o.user_id
  FROM ranked r
  JOIN owner_counts oc ON oc.tenant_id = r.tenant_id
  JOIN owners o ON o.tenant_id = r.tenant_id AND o.rn = ((r.rn - 1) % oc.cnt) + 1
)
UPDATE compliance.gaps t SET owner_user_id = a.user_id
FROM assignments a WHERE t.id = a.id;

-- ── control.library ───────────────────────────────────────────────────────────
WITH owners AS (
  SELECT
    tenant_id, id AS user_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY
      CASE role WHEN 'control-owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'risk-owner' THEN 3 ELSE 4 END, email
    ) AS rn
  FROM platform.users
  WHERE role IN ('control-owner', 'admin', 'risk-owner')
),
owner_counts AS (
  SELECT tenant_id, COUNT(*) AS cnt FROM owners GROUP BY tenant_id
),
ranked AS (
  SELECT id, tenant_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at) AS rn
  FROM control.library
),
assignments AS (
  SELECT r.id, o.user_id
  FROM ranked r
  JOIN owner_counts oc ON oc.tenant_id = r.tenant_id
  JOIN owners o ON o.tenant_id = r.tenant_id AND o.rn = ((r.rn - 1) % oc.cnt) + 1
)
UPDATE control.library t SET owner_user_id = a.user_id
FROM assignments a WHERE t.id = a.id;

-- ── bcm.plans ─────────────────────────────────────────────────────────────────
WITH owners AS (
  SELECT
    tenant_id, id AS user_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY
      CASE role WHEN 'admin' THEN 1 WHEN 'risk-owner' THEN 2 WHEN 'control-owner' THEN 3 ELSE 4 END, email
    ) AS rn
  FROM platform.users
  WHERE role IN ('admin', 'risk-owner', 'control-owner')
),
owner_counts AS (
  SELECT tenant_id, COUNT(*) AS cnt FROM owners GROUP BY tenant_id
),
ranked AS (
  SELECT id, tenant_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at) AS rn
  FROM bcm.plans
),
assignments AS (
  SELECT r.id, o.user_id
  FROM ranked r
  JOIN owner_counts oc ON oc.tenant_id = r.tenant_id
  JOIN owners o ON o.tenant_id = r.tenant_id AND o.rn = ((r.rn - 1) % oc.cnt) + 1
)
UPDATE bcm.plans t SET owner_user_id = a.user_id
FROM assignments a WHERE t.id = a.id;

-- ── policy.documents ──────────────────────────────────────────────────────────
WITH owners AS (
  SELECT
    tenant_id, id AS user_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY
      CASE role WHEN 'admin' THEN 1 WHEN 'risk-owner' THEN 2 WHEN 'control-owner' THEN 3 ELSE 4 END, email
    ) AS rn
  FROM platform.users
  WHERE role IN ('admin', 'risk-owner', 'control-owner')
),
owner_counts AS (
  SELECT tenant_id, COUNT(*) AS cnt FROM owners GROUP BY tenant_id
),
ranked AS (
  SELECT id, tenant_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at) AS rn
  FROM policy.documents
),
assignments AS (
  SELECT r.id, o.user_id
  FROM ranked r
  JOIN owner_counts oc ON oc.tenant_id = r.tenant_id
  JOIN owners o ON o.tenant_id = r.tenant_id AND o.rn = ((r.rn - 1) % oc.cnt) + 1
)
UPDATE policy.documents t SET owner_user_id = a.user_id
FROM assignments a WHERE t.id = a.id;

-- ── incident.incidents ────────────────────────────────────────────────────────
WITH owners AS (
  SELECT
    tenant_id, id AS user_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY
      CASE role WHEN 'admin' THEN 1 WHEN 'risk-owner' THEN 2 WHEN 'control-owner' THEN 3 ELSE 4 END, email
    ) AS rn
  FROM platform.users
  WHERE role IN ('admin', 'risk-owner', 'control-owner')
),
owner_counts AS (
  SELECT tenant_id, COUNT(*) AS cnt FROM owners GROUP BY tenant_id
),
ranked AS (
  SELECT id, tenant_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at) AS rn
  FROM incident.incidents
),
assignments AS (
  SELECT r.id, o.user_id
  FROM ranked r
  JOIN owner_counts oc ON oc.tenant_id = r.tenant_id
  JOIN owners o ON o.tenant_id = r.tenant_id AND o.rn = ((r.rn - 1) % oc.cnt) + 1
)
UPDATE incident.incidents t SET owner_user_id = a.user_id
FROM assignments a WHERE t.id = a.id;

-- ── issue.actions ─────────────────────────────────────────────────────────────
WITH owners AS (
  SELECT
    tenant_id, id AS user_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY
      CASE role WHEN 'admin' THEN 1 WHEN 'risk-owner' THEN 2 WHEN 'control-owner' THEN 3 ELSE 4 END, email
    ) AS rn
  FROM platform.users
  WHERE role IN ('admin', 'risk-owner', 'control-owner')
),
owner_counts AS (
  SELECT tenant_id, COUNT(*) AS cnt FROM owners GROUP BY tenant_id
),
ranked AS (
  SELECT id, tenant_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at) AS rn
  FROM issue.actions
),
assignments AS (
  SELECT r.id, o.user_id
  FROM ranked r
  JOIN owner_counts oc ON oc.tenant_id = r.tenant_id
  JOIN owners o ON o.tenant_id = r.tenant_id AND o.rn = ((r.rn - 1) % oc.cnt) + 1
)
UPDATE issue.actions t SET owner_user_id = a.user_id
FROM assignments a WHERE t.id = a.id;

\echo ' >> ownership distributed: risk.risks, risk.treatments, compliance.gaps, control.library, bcm.plans, policy.documents, incident.incidents, issue.actions'
