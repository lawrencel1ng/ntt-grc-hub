-- Migration 070: Fill remaining data gaps for 5 small tenants.
-- Covers: integration connectors/sync_jobs, evidence collectors,
-- control tests/exceptions, incident timeline events, vendor responses,
-- workflow executions/steps, regwatch mappings.
-- All sections are idempotent.

-- =====================================================================
-- Part 1: Integration connectors (5 per small tenant)
-- UNIQUE(tenant_id, kind, name) — ON CONFLICT DO NOTHING
-- =====================================================================
INSERT INTO integration.connectors
  (tenant_id, kind, name, status, last_sync_at)
SELECT t.tenant_id, k.kind, k.name,
  CASE WHEN k.kind = 'm365' AND t.tenant_id = 't_singhealth' THEN 'degraded'
       ELSE 'connected' END::integration.status,
  now() - make_interval(hours => abs(hashtext(t.tenant_id || k.kind)) % 12 + 1)
FROM (VALUES
  ('t_astar'),('t_govtech'),('t_mediacorp'),('t_singhealth'),('t_singtel')
) AS t(tenant_id)
CROSS JOIN (VALUES
  ('aws',        'AWS Cloud Infrastructure'),
  ('okta',       'Okta Identity Management'),
  ('jira',       'Jira Issue Tracker'),
  ('servicenow', 'ServiceNow ITSM'),
  ('m365',       'Microsoft 365')
) AS k(kind, name)
ON CONFLICT (tenant_id, kind, name) DO NOTHING;

-- Part 1b: Sync jobs (3 per connector — 2 success, 1 failed for most recent)
INSERT INTO integration.sync_jobs
  (tenant_id, connector_id, started_at, ended_at, status, records_ingested, errors)
SELECT c.tenant_id, c.id,
  now() - make_interval(hours => n * 8),
  now() - make_interval(hours => n * 8) + interval '12 minutes',
  CASE n WHEN 1 THEN 'failed' ELSE 'success' END,
  CASE n WHEN 1 THEN 0 ELSE abs(hashtext(c.id::text || n::text)) % 800 + 100 END,
  CASE n WHEN 1 THEN 2 ELSE 0 END
FROM integration.connectors c
CROSS JOIN (VALUES (1),(2),(3)) AS t(n)
WHERE c.tenant_id IN ('t_astar','t_govtech','t_mediacorp','t_singhealth','t_singtel')
  AND NOT EXISTS (
    SELECT 1 FROM integration.sync_jobs sj WHERE sj.connector_id = c.id
  );

-- =====================================================================
-- Part 2: Evidence collectors (3 per small tenant)
-- id is text PK — use deterministic slug
-- =====================================================================
INSERT INTO evidence.collectors
  (id, tenant_id, name, kind, schedule_cron, last_run_at, enabled)
SELECT
  'coll-' || t.tenant_id || '-' || k.kind,
  t.tenant_id, k.name, k.kind::evidence.collector_kind,
  k.cron,
  now() - make_interval(hours => abs(hashtext(t.tenant_id || k.kind)) % 6 + 1),
  true
FROM (VALUES
  ('t_astar'),('t_govtech'),('t_mediacorp'),('t_singhealth'),('t_singtel')
) AS t(tenant_id)
CROSS JOIN (VALUES
  ('aws',    'AWS Resource Evidence Collector',    '0 */6 * * *'),
  ('okta',   'Okta Access Event Collector',        '0 */4 * * *'),
  ('manual', 'Manual Upload Collector',             NULL)
) AS k(kind, name, cron)
WHERE NOT EXISTS (
  SELECT 1 FROM evidence.collectors ec
  WHERE ec.id = 'coll-' || t.tenant_id || '-' || k.kind
);

-- =====================================================================
-- Part 3: Control tests (manual + automated per control, small tenants)
-- No unique constraint — guard per (control_id, kind)
-- =====================================================================
INSERT INTO control.tests
  (tenant_id, control_id, name, kind, schedule_cron, procedure_md)
SELECT c.tenant_id, c.id,
  CASE k.kind
    WHEN 'manual'    THEN 'Manual Evidence Review — ' || c.code
    WHEN 'automated' THEN 'Automated Compliance Check — ' || c.code
  END,
  k.kind::control.test_kind,
  CASE k.kind WHEN 'automated' THEN '0 2 * * 1' ELSE NULL END,
  CASE k.kind
    WHEN 'manual'
      THEN '1. Collect evidence from relevant systems'
        || E'\n' || '2. Review against control criteria and owner attestation'
        || E'\n' || '3. Document findings and note any exceptions'
        || E'\n' || '4. Obtain sign-off from control owner'
    WHEN 'automated'
      THEN '1. Run automated compliance scan against target'
        || E'\n' || '2. Compare results against approved baseline'
        || E'\n' || '3. Flag deviations > threshold for manual review'
        || E'\n' || '4. Archive scan artefacts to evidence repository'
  END
FROM control.library c
CROSS JOIN (VALUES ('manual'),('automated')) AS k(kind)
WHERE c.tenant_id IN ('t_astar','t_govtech','t_mediacorp','t_singhealth','t_singtel')
  AND NOT EXISTS (
    SELECT 1 FROM control.tests ct
    WHERE ct.control_id = c.id AND ct.kind = k.kind::control.test_kind
  );

-- =====================================================================
-- Part 4: Control exceptions (2 per tenant — all 8 tenants)
-- Guard per (tenant_id, control_id)
-- =====================================================================
INSERT INTO control.exceptions
  (tenant_id, control_id, requester_user_id, justification,
   granted, granted_by_user_id, granted_at, expires_at)
SELECT rn_ctl.tenant_id, rn_ctl.id,
  (SELECT u.id FROM platform.users u
   WHERE u.tenant_id = rn_ctl.tenant_id ORDER BY u.created_at LIMIT 1 OFFSET 1),
  CASE rn_ctl.rn
    WHEN 1 THEN 'Legacy system constraint prevents automated compliance. Compensating controls documented and reviewed quarterly.'
    ELSE 'Vendor platform does not support the required configuration. Risk formally accepted with documented mitigations valid until next contract renewal.'
  END,
  true,
  (SELECT u.id FROM platform.users u
   WHERE u.tenant_id = rn_ctl.tenant_id AND u.email LIKE '%.admin@%' LIMIT 1),
  now() - make_interval(days => (rn_ctl.rn * 15 + 10)::int),
  now() + make_interval(days => 90)
FROM (
  SELECT id, tenant_id, code,
         ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY id) AS rn
  FROM control.library
) rn_ctl
WHERE rn_ctl.rn IN (1, 2)
  AND NOT EXISTS (
    SELECT 1 FROM control.exceptions ce WHERE ce.control_id = rn_ctl.id
  );

-- =====================================================================
-- Part 5: Incident timeline events (3 per incident — small tenants)
-- Guard per incident_id
-- =====================================================================
INSERT INTO incident.timeline_events
  (tenant_id, incident_id, ts, actor, event, source)
SELECT i.tenant_id, i.id,
  i.opened_at + make_interval(hours => t.offset_h),
  t.actor, t.event, t.source
FROM incident.incidents i
CROSS JOIN (VALUES
  (0,  'soc-monitor-agent',  'Anomaly detected and incident ticket automatically created', 'agent'),
  (1,  'on-call-engineer',   'Response team assembled, incident war room opened in Slack',  'human'),
  (4,  'incident-commander', 'Root cause confirmed, remediation deployed to production',    'human')
) AS t(offset_h, actor, event, source)
WHERE i.tenant_id IN ('t_astar','t_govtech','t_mediacorp','t_singhealth','t_singtel')
  AND NOT EXISTS (
    SELECT 1 FROM incident.timeline_events te WHERE te.incident_id = i.id
  );

-- =====================================================================
-- Part 6: Vendor questionnaire responses (5 per questionnaire)
-- Guard per questionnaire_id
-- =====================================================================
INSERT INTO vendor.responses
  (tenant_id, questionnaire_id, question_code, response, confidence, answered_at)
SELECT q.tenant_id, q.id, r.code, r.response, r.confidence,
  now() - make_interval(days => abs(hashtext(q.id::text)) % 20 + 5)
FROM vendor.questionnaires q
CROSS JOIN (VALUES
  ('Q001', 'Yes — information security policy reviewed and approved by Board annually.', 0.96),
  ('Q002', 'Formal risk assessment completed Q4 2025. Next review due Q4 2026.', 0.91),
  ('Q003', 'SOC 2 Type II certification current. Valid until December 2026. Certificate available on request.', 0.98),
  ('Q004', 'Business Continuity Plan tested semi-annually. Documented RTO ≤4h, RPO ≤1h.', 0.93),
  ('Q005', 'All sub-processors contractually bound to equivalent data protection standards under DPA 2024.', 0.87)
) AS r(code, response, confidence)
WHERE q.tenant_id IN ('t_astar','t_govtech','t_mediacorp','t_singhealth','t_singtel')
  AND NOT EXISTS (
    SELECT 1 FROM vendor.responses vr WHERE vr.questionnaire_id = q.id
  );

-- =====================================================================
-- Part 7: Workflow executions + steps for 4 remaining small tenants
-- (t_singhealth already has data; skip it)
-- Guard executions per (workflow_id)
-- Guard steps per execution_id
-- =====================================================================
WITH new_execs AS (
  INSERT INTO workflow.executions
    (tenant_id, workflow_id, trigger, started_at, ended_at, status)
  SELECT d.tenant_id, d.id,
    CASE n WHEN 1 THEN 'scheduled' WHEN 2 THEN 'manual' ELSE 'api' END,
    now() - make_interval(days => n * 14 + abs(hashtext(d.id::text)) % 7),
    now() - make_interval(days => n * 14 + abs(hashtext(d.id::text)) % 7)
      + interval '90 minutes',
    CASE n WHEN 3 THEN 'failed' ELSE 'success' END::workflow.execution_status
  FROM workflow.definitions d
  CROSS JOIN (VALUES (1),(2),(3)) AS t(n)
  WHERE d.tenant_id IN ('t_astar','t_govtech','t_mediacorp','t_singtel')
    AND NOT EXISTS (
      SELECT 1 FROM workflow.executions e WHERE e.workflow_id = d.id
    )
  RETURNING id, tenant_id, started_at
)
INSERT INTO workflow.steps
  (tenant_id, execution_id, step_no, kind, status, started_at, ended_at)
SELECT ne.tenant_id, ne.id, s.step_no, s.kind::workflow.step_kind,
  'completed',
  ne.started_at + make_interval(mins => (s.step_no - 1) * 20),
  ne.started_at + make_interval(mins => s.step_no * 20)
FROM new_execs ne
CROSS JOIN (VALUES
  (1, 'agent'),
  (2, 'decision'),
  (3, 'agent')
) AS s(step_no, kind);

-- =====================================================================
-- Part 8: Regwatch mappings (map each change to its primary framework)
-- Guard per change_id
-- =====================================================================
INSERT INTO regwatch.mappings (change_id, framework_id, action)
SELECT rc.id,
  CASE rc.source_id
    WHEN 'src_mas'  THEN 'mas-trm'
    WHEN 'src_eu'   THEN
      CASE WHEN rc.title ILIKE '%AI%' OR rc.title ILIKE '%artificial%'
           THEN 'eu-ai-act' ELSE 'dora' END
    WHEN 'src_pdpc' THEN 'pdpa-sg'
    WHEN 'src_hkma' THEN 'hkma-tmg1'
    WHEN 'src_apra' THEN 'apra-cps230'
    WHEN 'src_bnm'  THEN 'bnm-rmit'
    WHEN 'src_ojk'  THEN 'ojk-1103'
    WHEN 'src_rbi'  THEN 'rbi-cyber'
    ELSE 'iso-27001'
  END,
  'mapped'
FROM regwatch.changes rc
WHERE NOT EXISTS (
  SELECT 1 FROM regwatch.mappings rm WHERE rm.change_id = rc.id
);
