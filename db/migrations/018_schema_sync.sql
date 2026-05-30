-- =====================================================================
-- Migration 018: Sync init.sql with migrations 006-017
--
-- This migration is idempotent (IF NOT EXISTS / IF COLUMN NOT EXISTS
-- equivalents via ADD COLUMN IF NOT EXISTS). Safe to run on any
-- existing deployment that already has 006-017 applied.
-- =====================================================================

-- ── platform.tenants ─────────────────────────────────────────────────
ALTER TABLE platform.tenants
  ADD COLUMN IF NOT EXISTS accent_color    TEXT NOT NULL DEFAULT '#6d28d9',
  ADD COLUMN IF NOT EXISTS ai_provider     TEXT NOT NULL DEFAULT 'anthropic',
  ADD COLUMN IF NOT EXISTS data_residency  TEXT NOT NULL DEFAULT 'SG';

-- ── vendor.vendors ───────────────────────────────────────────────────
ALTER TABLE vendor.vendors
  ADD COLUMN IF NOT EXISTS employee_count INT;

-- ── issue.issues ─────────────────────────────────────────────────────
ALTER TABLE issue.issues
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendor.vendors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ON issue.issues (vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ON issue.issues (tenant_id, due_at);

-- ── bcm.plans ────────────────────────────────────────────────────────
ALTER TABLE bcm.plans
  ADD COLUMN IF NOT EXISTS description       TEXT,
  ADD COLUMN IF NOT EXISTS recovery_strategy TEXT;

-- ── bcm.escalation_contacts (new table) ─────────────────────────────
CREATE TABLE IF NOT EXISTS bcm.escalation_contacts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    plan_id     UUID NOT NULL REFERENCES bcm.plans(id) ON DELETE CASCADE,
    role        TEXT NOT NULL,
    name        TEXT NOT NULL,
    email       TEXT,
    phone       TEXT,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bcm_esc_contacts_plan ON bcm.escalation_contacts (plan_id);

-- ── ai_gov.models ────────────────────────────────────────────────────
ALTER TABLE ai_gov.models
  ADD COLUMN IF NOT EXISTS training_data_summary TEXT;

-- ── policy.document_frameworks (new table) ──────────────────────────
CREATE TABLE IF NOT EXISTS policy.document_frameworks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES policy.documents(id) ON DELETE CASCADE,
    framework_id    TEXT NOT NULL REFERENCES compliance.frameworks(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_id, framework_id)
);
CREATE INDEX IF NOT EXISTS policy_doc_fwk_doc ON policy.document_frameworks (document_id);

-- ── sox.deficiencies ─────────────────────────────────────────────────
ALTER TABLE sox.deficiencies
  ADD COLUMN IF NOT EXISTS root_cause TEXT;

-- ── integration.connectors — prevent duplicate connectors ────────────
CREATE UNIQUE INDEX IF NOT EXISTS connectors_tenant_kind_name
  ON integration.connectors (tenant_id, kind, name);

-- ── human_risk CHECK constraints ─────────────────────────────────────
-- Add constraints if they don't already exist (check pg_constraint)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sync_jobs_status_check' AND conrelid = 'human_risk.sync_jobs'::regclass) THEN
    ALTER TABLE human_risk.sync_jobs ADD CONSTRAINT sync_jobs_status_check
      CHECK (status IN ('ok','error','partial'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_scores_risk_level_check' AND conrelid = 'human_risk.org_scores'::regclass) THEN
    ALTER TABLE human_risk.org_scores ADD CONSTRAINT org_scores_risk_level_check
      CHECK (risk_level IN ('low','moderate','high','critical'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_risk_level_check' AND conrelid = 'human_risk.users'::regclass) THEN
    ALTER TABLE human_risk.users ADD CONSTRAINT users_risk_level_check
      CHECK (risk_level IN ('low','moderate','high','critical'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_phish_result_check' AND conrelid = 'human_risk.users'::regclass) THEN
    ALTER TABLE human_risk.users ADD CONSTRAINT users_phish_result_check
      CHECK (last_phish_result IN ('clicked','reported','no-action'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_risk_level_check' AND conrelid = 'human_risk.departments'::regclass) THEN
    ALTER TABLE human_risk.departments ADD CONSTRAINT departments_risk_level_check
      CHECK (risk_level IN ('low','moderate','high','critical'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'remediation_action_type_check' AND conrelid = 'human_risk.remediation_actions'::regclass) THEN
    ALTER TABLE human_risk.remediation_actions ADD CONSTRAINT remediation_action_type_check
      CHECK (action_type IN ('training_enrollment','phishing_simulation'));
  END IF;
END$$;

-- ── human_risk.users — make (tenant_id, email) unique ────────────────
CREATE UNIQUE INDEX IF NOT EXISTS human_risk_users_tenant_email
  ON human_risk.users (tenant_id, email);

-- ── Additional performance indexes ───────────────────────────────────
CREATE INDEX IF NOT EXISTS ON incident.incidents (tenant_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS ON audit.findings (control_id);
CREATE INDEX IF NOT EXISTS ON compliance.gaps (requirement_id);
CREATE INDEX IF NOT EXISTS ON agent.approvals (approver_user_id);
CREATE INDEX IF NOT EXISTS ON workflow.approvals (approver_user_id);
