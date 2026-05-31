-- Migration 082: Move some framework assessments' next_due_at within the next 60 days
-- so the "Due in 60 days" KPI on /frameworks shows non-zero.
-- framework_score is a VIEW over compliance.assessments — update the base table.
-- ~25% of assessments are given upcoming due dates (deterministic by hash).

UPDATE compliance.assessments
SET next_due_at = now() + make_interval(secs => abs(hashtext(tenant_id || framework_id::text)) % (60 * 86400) + 86400)
WHERE abs(hashtext(tenant_id || framework_id::text)) % 4 = 0;

\echo ' >> framework due dates refreshed'
