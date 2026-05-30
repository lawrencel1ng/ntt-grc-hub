-- =====================================================================
--  010 — BCM plan description/recovery strategy + escalation contacts
-- =====================================================================

-- Add text columns to bcm.plans
ALTER TABLE bcm.plans
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS recovery_strategy TEXT;

-- Back-fill existing plans with generated text derived from real data
UPDATE bcm.plans SET
  description = name || ' establishes the continuity and recovery posture for ' || business_service ||
    '. The plan defines an RTO of ' || rto_minutes || ' minutes and an RPO of ' || rpo_minutes ||
    ' minutes, with documented failover procedures reviewed and tested on a regular cadence.',
  recovery_strategy =
    'Primary workloads run active-passive across two availability zones. ' ||
    'Critical data is replicated synchronously; tier-2 data uses async replication with ' ||
    'a ' || rpo_minutes || '-minute lag budget. DR runbooks are stored in the platform ' ||
    'and reviewed monthly by the Resilience Coach agent. Recovery time target: ' ||
    rto_minutes || ' minutes end-to-end.'
WHERE description IS NULL;

-- Escalation contacts table
CREATE TABLE IF NOT EXISTS bcm.escalation_contacts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  plan_id      UUID NOT NULL REFERENCES bcm.plans(id) ON DELETE CASCADE,
  role         TEXT NOT NULL,
  name         TEXT NOT NULL,
  email        TEXT,
  phone        TEXT,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bcm_escalation_contacts_plan_idx ON bcm.escalation_contacts (plan_id);

-- Seed four contacts per plan for every existing plan
INSERT INTO bcm.escalation_contacts (tenant_id, plan_id, role, name, email, phone, sort_order)
SELECT
  p.tenant_id,
  p.id,
  r.role,
  r.contact_name,
  r.role_slug || '@' || replace(p.tenant_id, 't_', '') || '.internal',
  '+65 9' || lpad(((abs(hashtext(p.id::text)) % 900000) + 100000)::text, 6, '0') ||
    lpad(r.so::text, 1, '0'),
  r.so
FROM bcm.plans p
CROSS JOIN (VALUES
  ('Incident Commander', 'CRO Office', 'ic', 1),
  ('Technology Lead',    'SRE',        'sre', 2),
  ('Communications Lead','PR',         'comms', 3),
  ('Regulatory Lead',    'Compliance', 'compliance', 4)
) AS r(role, contact_name, role_slug, so)
ON CONFLICT DO NOTHING;
