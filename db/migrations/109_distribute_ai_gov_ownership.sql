-- Migration 109: Distribute ai_gov.models ownership across admin, agent-operator,
-- and risk-owner users per tenant. Previously all models per tenant were owned
-- by a single "priya.*" risk-owner (same seeding defect fixed in mig 107-108).
-- agent-operator is prioritised as the primary AI model owner.

WITH owners AS (
  SELECT
    tenant_id, id AS user_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY
      CASE role
        WHEN 'agent-operator' THEN 1
        WHEN 'admin'          THEN 2
        WHEN 'risk-owner'     THEN 3
        ELSE 4
      END, email
    ) AS rn
  FROM platform.users
  WHERE role IN ('agent-operator', 'admin', 'risk-owner')
),
owner_counts AS (
  SELECT tenant_id, COUNT(*) AS cnt FROM owners GROUP BY tenant_id
),
ranked AS (
  SELECT id, tenant_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at) AS rn
  FROM ai_gov.models
),
assignments AS (
  SELECT r.id, o.user_id
  FROM ranked r
  JOIN owner_counts oc ON oc.tenant_id = r.tenant_id
  JOIN owners o ON o.tenant_id = r.tenant_id AND o.rn = ((r.rn - 1) % oc.cnt) + 1
)
UPDATE ai_gov.models t SET owner_user_id = a.user_id
FROM assignments a WHERE t.id = a.id;

\echo ' >> ai_gov.models ownership distributed across agent-operator / admin / risk-owner'
