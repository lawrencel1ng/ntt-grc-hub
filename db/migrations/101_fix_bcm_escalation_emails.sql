-- Migration 101: Replace @example.sg placeholder emails in bcm.escalation_contacts
-- with proper organisational addresses matching the tenant's platform users.
--
-- Mapping per tenant:
--   Incident Commander → Admin user (Alex *)
--   Technical Lead     → Ops user   (Marcus *)
--   Communications Lead → Risk user  (Priya *)
--
-- Only the five tenants that still carry @example.sg addresses are updated.

-- ── A*STAR ───────────────────────────────────────────────────────────────────
UPDATE bcm.escalation_contacts SET email = 'alex.quek@a-star.edu.sg'
  WHERE tenant_id = 't_astar' AND email = 'astar.incident.commander@example.sg';
UPDATE bcm.escalation_contacts SET email = 'marcus.wee@a-star.edu.sg'
  WHERE tenant_id = 't_astar' AND email = 'astar.technical.lead@example.sg';
UPDATE bcm.escalation_contacts SET email = 'priya.kumar@a-star.edu.sg'
  WHERE tenant_id = 't_astar' AND email = 'astar.communications.lead@example.sg';

-- ── GovTech Singapore ────────────────────────────────────────────────────────
UPDATE bcm.escalation_contacts SET email = 'alex.phua@tech.gov.sg'
  WHERE tenant_id = 't_govtech' AND email = 'govtech.incident.commander@example.sg';
UPDATE bcm.escalation_contacts SET email = 'marcus.foo@tech.gov.sg'
  WHERE tenant_id = 't_govtech' AND email = 'govtech.technical.lead@example.sg';
UPDATE bcm.escalation_contacts SET email = 'priya.devi@tech.gov.sg'
  WHERE tenant_id = 't_govtech' AND email = 'govtech.communications.lead@example.sg';

-- ── Mediacorp ────────────────────────────────────────────────────────────────
UPDATE bcm.escalation_contacts SET email = 'alex.heng@mediacorp.com.sg'
  WHERE tenant_id = 't_mediacorp' AND email = 'mediacorp.incident.commander@example.sg';
UPDATE bcm.escalation_contacts SET email = 'marcus.chia@mediacorp.com.sg'
  WHERE tenant_id = 't_mediacorp' AND email = 'mediacorp.technical.lead@example.sg';
UPDATE bcm.escalation_contacts SET email = 'priya.menon@mediacorp.com.sg'
  WHERE tenant_id = 't_mediacorp' AND email = 'mediacorp.communications.lead@example.sg';

-- ── SingHealth ───────────────────────────────────────────────────────────────
UPDATE bcm.escalation_contacts SET email = 'alex.koh@singhealth.com.sg'
  WHERE tenant_id = 't_singhealth' AND email = 'singhealth.incident.commander@example.sg';
UPDATE bcm.escalation_contacts SET email = 'marcus.seah@singhealth.com.sg'
  WHERE tenant_id = 't_singhealth' AND email = 'singhealth.technical.lead@example.sg';
UPDATE bcm.escalation_contacts SET email = 'priya.pillai@singhealth.com.sg'
  WHERE tenant_id = 't_singhealth' AND email = 'singhealth.communications.lead@example.sg';

-- ── Singtel ──────────────────────────────────────────────────────────────────
UPDATE bcm.escalation_contacts SET email = 'alex.sim@singtel.com'
  WHERE tenant_id = 't_singtel' AND email = 'singtel.incident.commander@example.sg';
UPDATE bcm.escalation_contacts SET email = 'marcus.ong@singtel.com'
  WHERE tenant_id = 't_singtel' AND email = 'singtel.technical.lead@example.sg';
UPDATE bcm.escalation_contacts SET email = 'priya.iyer@singtel.com'
  WHERE tenant_id = 't_singtel' AND email = 'singtel.communications.lead@example.sg';

\echo ' >> BCM escalation contact emails updated to proper organisational addresses'
