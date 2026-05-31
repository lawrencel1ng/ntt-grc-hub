-- Migration 069: Add policy.versions, policy.acknowledgements,
-- bcm.escalation_contacts, and bcm.bias (BIA) for 5 small tenants.
-- All four tables were empty for small tenants despite having
-- policy documents and BCM plans.
-- Idempotent: versions has UNIQUE(document_id, version_no);
-- escalation_contacts and bias use WHERE NOT EXISTS on plan_id.

-- =====================================================================
-- Part 1: Policy versions (1 approved version per document)
-- =====================================================================
INSERT INTO policy.versions
  (tenant_id, document_id, version_no, content_md, status,
   effective_at, drafted_by_agent_id, approved_by_user_id, created_at)
SELECT d.tenant_id, d.id, '1.0',
  '## Purpose\n\nThis policy establishes requirements for ' || d.title || ' across the organisation, ensuring compliance with applicable regulatory obligations including MAS TRM, PDPA, and ISO 27001.\n\n## Scope\n\nThis policy applies to all staff, contractors, and third parties who access or process organisational information assets.\n\n## Policy Statements\n\n1. **Ownership**: The CISO is accountable for this policy.\n2. **Compliance**: All personnel must acknowledge this policy annually.\n3. **Review Cycle**: Annual review or following material change.\n4. **Exceptions**: Exceptions require CISO approval with documented risk acceptance.',
  'approved',
  now() - make_interval(days => abs(hashtext(d.id::text)) % 90 + 30),
  'ag_policy',
  u.id,
  now() - make_interval(days => abs(hashtext(d.id::text)) % 90 + 32)
FROM policy.documents d
JOIN platform.users u ON u.tenant_id = d.tenant_id AND u.email LIKE '%.admin@%'
WHERE d.tenant_id IN ('t_astar','t_govtech','t_mediacorp','t_singhealth','t_singtel')
ON CONFLICT (document_id, version_no) DO NOTHING;

-- Part 1b: Policy acknowledgements (all users per version)
INSERT INTO policy.acknowledgements
  (tenant_id, version_id, user_id, acknowledged_at)
SELECT pv.tenant_id, pv.id, u.id,
  now() - make_interval(days => abs(hashtext(pv.id::text || u.id::text)) % 60)
FROM policy.versions pv
JOIN platform.users u ON u.tenant_id = pv.tenant_id
WHERE pv.tenant_id IN ('t_astar','t_govtech','t_mediacorp','t_singhealth','t_singtel')
  AND pv.version_no = '1.0'
ON CONFLICT (version_id, user_id) DO NOTHING;

-- =====================================================================
-- Part 2: BCM escalation contacts (3 per plan)
-- =====================================================================
INSERT INTO bcm.escalation_contacts
  (tenant_id, plan_id, role, name, email, phone, sort_order)
SELECT p.tenant_id, p.id,
  ec.role, ec.name,
  LOWER(REPLACE(p.tenant_id, 't_', '')) || '.' || LOWER(REPLACE(ec.role, ' ', '.')) || '@example.sg',
  ec.phone, ec.sort_order
FROM bcm.plans p
CROSS JOIN (VALUES
  ('Incident Commander', 'BCP Plan Owner', '+65 9100 0001', 1),
  ('Technical Lead', 'IT Recovery Lead', '+65 9100 0002', 2),
  ('Communications Lead', 'Crisis Comms Officer', '+65 9100 0003', 3)
) AS ec(role, name, phone, sort_order)
WHERE p.tenant_id IN ('t_astar','t_govtech','t_mediacorp','t_singhealth','t_singtel')
  AND NOT EXISTS (
    SELECT 1 FROM bcm.escalation_contacts e WHERE e.plan_id = p.id
  );

-- =====================================================================
-- Part 3: BCM BIA entries (business impact analysis per plan)
-- 4 entries per plan: 2 tech, 1 people, 1 vendor
-- =====================================================================
INSERT INTO bcm.bias
  (tenant_id, plan_id, dependency_kind, name, criticality, downtime_tolerance_hours)
SELECT p.tenant_id, p.id,
  b.kind, b.name,
  b.crit::vendor.criticality, b.rto_h
FROM bcm.plans p
CROSS JOIN (VALUES
  ('tech', 'Primary application servers', 'critical', 2),
  ('tech', 'Database and storage cluster', 'critical', 4),
  ('people', 'On-call incident response team', 'high', 8),
  ('vendor', 'Cloud infrastructure provider', 'high', 4)
) AS b(kind, name, crit, rto_h)
WHERE p.tenant_id IN ('t_astar','t_govtech','t_mediacorp','t_singhealth','t_singtel')
  AND NOT EXISTS (
    SELECT 1 FROM bcm.bias bi WHERE bi.plan_id = p.id
  );
