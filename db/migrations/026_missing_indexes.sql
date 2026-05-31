-- Migration 026: Add indexes that were skipped in earlier migrations because
-- those files used `CREATE INDEX IF NOT EXISTS ON table (col)` syntax
-- (missing the required index name), which Postgres rejects silently.
-- All statements are idempotent via IF NOT EXISTS.

CREATE INDEX IF NOT EXISTS prt_user_id_idx
    ON platform.password_reset_tokens (user_id);

CREATE INDEX IF NOT EXISTS prt_expires_at_idx
    ON platform.password_reset_tokens (expires_at);

CREATE INDEX IF NOT EXISTS phishing_campaigns_tenant_sent_idx
    ON human_risk.phishing_campaigns (tenant_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS training_campaigns_tenant_due_idx
    ON human_risk.training_campaigns (tenant_id, due_at DESC);

CREATE INDEX IF NOT EXISTS issues_vendor_id_idx
    ON issue.issues (vendor_id) WHERE vendor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS issues_tenant_due_idx
    ON issue.issues (tenant_id, due_at);

CREATE INDEX IF NOT EXISTS incidents_tenant_opened_idx
    ON incident.incidents (tenant_id, opened_at DESC);

CREATE INDEX IF NOT EXISTS findings_control_id_idx
    ON audit.findings (control_id);

CREATE INDEX IF NOT EXISTS gaps_requirement_id_idx
    ON compliance.gaps (requirement_id);

CREATE INDEX IF NOT EXISTS agent_approvals_approver_idx
    ON agent.approvals (approver_user_id);

CREATE INDEX IF NOT EXISTS workflow_approvals_approver_idx
    ON workflow.approvals (approver_user_id);
