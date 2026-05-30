-- Migration 017: Human risk remediation actions log
-- Records manual training enrolments and phishing simulations triggered from the UI.
--   psql $DATABASE_URL -f db/migrations/017_human_risk_remediation_actions.sql

CREATE TABLE IF NOT EXISTS human_risk.remediation_actions (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES human_risk.users(id) ON DELETE CASCADE,
    action_type     TEXT NOT NULL,   -- 'training_enrollment' | 'phishing_simulation'
    actor_id        TEXT,            -- platform user who triggered the action
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hr_remediation_actions_tenant_created_idx
    ON human_risk.remediation_actions (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hr_remediation_actions_user_idx
    ON human_risk.remediation_actions (user_id);
