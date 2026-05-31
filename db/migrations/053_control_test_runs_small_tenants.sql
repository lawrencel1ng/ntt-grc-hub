-- Migration 053: Add control test runs for the 5 tenants that had none
-- (A*STAR, GovTech, Mediacorp, SingHealth, Singtel).
-- Creates 3 runs per control spread across the last 90 days.
-- Results are hash-assigned: mostly pass, some partial/fail.
-- Idempotent: INSERT … WHERE NOT EXISTS a run for tenant in last 90 days.

INSERT INTO control.test_runs (tenant_id, control_id, ran_at, result, notes, duration_ms)
SELECT
  cl.tenant_id,
  cl.id AS control_id,
  '2026-02-27 01:00:00+08'::timestamptz
    + make_interval(secs => (abs(hashtext(cl.id || '_run' || n::text)) % 7776000))
  AS ran_at,
  ((ARRAY['pass','pass','pass','partial','fail'])[abs(hashtext(cl.id || '_res' || n::text)) % 5 + 1])::control.test_result
  AS result,
  (ARRAY[
    'Continuous monitoring data reviewed; no deviations detected since last test cycle.',
    'Agent-executed control test passed. Evidence logged and linked to this run.',
    'Process control reviewed; sample of 15 transactions verified against requirement.',
    'Manual test completed. 1 minor exception noted; control owner acknowledged.',
    'Automated check passed. Configuration matches approved baseline.',
    'Test partially passed. 2 of 10 sampled items had minor documentation gaps.',
    'Control test failed — configuration drift detected. Remediation ticket raised.',
    'Administrative review complete. Policy acknowledged by all required stakeholders.'
  ])[abs(hashtext(cl.id || '_note' || n::text)) % 8 + 1]
  AS notes,
  (abs(hashtext(cl.id || '_dur' || n::text)) % 8000 + 200)::integer AS duration_ms
FROM control.library cl
CROSS JOIN generate_series(1, 3) AS n
WHERE cl.tenant_id IN ('t_astar', 't_govtech', 't_mediacorp', 't_singhealth', 't_singtel')
  AND NOT EXISTS (
    SELECT 1 FROM control.test_runs tr
    WHERE tr.control_id = cl.id
      AND tr.tenant_id  = cl.tenant_id
  );

-- Push the most recent run per small-tenant control into the last 3 days
-- so the all-tenant Controls Library shows recent test results in the
-- top-200 run window. Idempotent: only touches rows older than 3 days.
WITH latest_runs AS (
  SELECT DISTINCT ON (control_id) id, control_id, tenant_id, ran_at
  FROM control.test_runs
  WHERE tenant_id IN ('t_astar','t_govtech','t_mediacorp','t_singhealth','t_singtel')
  ORDER BY control_id, ran_at DESC
)
UPDATE control.test_runs tr
SET ran_at = now() - make_interval(secs => abs(hashtext(tr.id::text)) % 259200)
FROM latest_runs lr
WHERE tr.id = lr.id
  AND lr.ran_at < now() - interval '3 days';
