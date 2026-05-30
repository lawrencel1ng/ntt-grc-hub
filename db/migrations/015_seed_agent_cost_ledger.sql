-- Migration 015: Seed agent.agents (if missing) and agent.cost_ledger for last 90 days
-- agent.agents is normally in seed.sql; this ensures migrations-only deploys work.

INSERT INTO agent.agents (id, name, slug, description, type, status, owner_team, cost_per_run_cents, cost_monthly_estimate_cents, fte_equivalent)
VALUES
  ('ag_evidence',  'Evidence Collector',    'evidence-collector',    'Pulls evidence from AWS, Azure, GCP, Okta, Jira, M365, GitHub, ServiceNow. Hashes and seals each item.', 'deterministic', 'running', 'GRC Platform',        2,    0,     0.80),
  ('ag_tester',    'Control Tester',        'control-tester',        'Continuously evaluates technical controls against live cloud config.',                                   'ai-powered',    'running', 'GRC Platform',        4,    3000,  0.60),
  ('ag_vendor',    'Vendor Risk Analyst',   'vendor-risk-analyst',   'Auto-fills SIG/CAIQ from vendor SOC 2 / ISO reports, scores residual risk.',                             'ai-powered',    'idle',    'TPRM',                12,   8000,  0.50),
  ('ag_policy',    'Policy Drafter',        'policy-drafter',        'Drafts policy documents from framework deltas + org context.',                                           'ai-powered',    'idle',    'Policy Office',       28,   12000, 0.40),
  ('ag_regwatch',  'Regulatory Horizon',    'regulatory-horizon',    'Scans 40+ regulator sources, tags impact, opens assessments.',                                           'intelligent',   'running', 'GRC Intelligence',    16,   20000, 0.55),
  ('ag_audit',     'Audit Companion',       'audit-companion',       'Assembles auditor evidence packs, links evidence → control → requirement.',                              'intelligent',   'idle',    'Internal Audit',      32,   15000, 0.45),
  ('ag_fair',      'Risk Quantifier',       'risk-quantifier',       'Runs FAIR Monte Carlo (10k trials), produces LEC + ALE.',                                                'ai-powered',    'idle',    'ERM',                 8,    4000,  0.40),
  ('ag_incident',  'Incident Investigator', 'incident-investigator', 'Builds incident timeline + draft postmortem from logs/tickets/chat.',                                   'intelligent',   'idle',    'SOC',                 24,   18000, 0.60),
  ('ag_mapper',    'Control Mapper',        'control-mapper',        'Maps a new/custom control into all 35+ frameworks with semantic similarity.',                            'ai-powered',    'idle',    'Compliance',          6,    6000,  0.40),
  ('ag_board',     'Board Narrator',        'board-narrator',        'Generates monthly 1-page board narratives from quantitative data.',                                      'ai-powered',    'idle',    'Executive Office',    40,   9000,  0.30)
ON CONFLICT (id) DO NOTHING;

-- Cost ledger: 90 days × 10 agents × 3 hero tenants + 5 shallow tenants
-- Uses deterministic integer arithmetic (no random()) so migration is reproducible.
-- Runs/day per agent based on agent type; scaled per tenant tier.
INSERT INTO agent.cost_ledger (tenant_id, agent_id, ts, runs, cost_cents, fte_saved_hours)
SELECT
  t.tid,
  a.id,
  (now() - (d.n * interval '1 day'))::timestamptz,
  GREATEST(0, (
    CASE a.id
      WHEN 'ag_evidence' THEN 24
      WHEN 'ag_tester'   THEN 24
      WHEN 'ag_vendor'   THEN 3
      WHEN 'ag_policy'   THEN 1
      WHEN 'ag_regwatch' THEN 4
      WHEN 'ag_audit'    THEN 2
      WHEN 'ag_fair'     THEN 6
      WHEN 'ag_incident' THEN 1
      WHEN 'ag_mapper'   THEN 2
      WHEN 'ag_board'    THEN 1
      ELSE 1
    END * t.scale + ((d.n + 1) % 3) - 1
  )::int),
  (
    CASE a.id
      WHEN 'ag_evidence' THEN 24
      WHEN 'ag_tester'   THEN 24
      WHEN 'ag_vendor'   THEN 3
      WHEN 'ag_policy'   THEN 1
      WHEN 'ag_regwatch' THEN 4
      WHEN 'ag_audit'    THEN 2
      WHEN 'ag_fair'     THEN 6
      WHEN 'ag_incident' THEN 1
      WHEN 'ag_mapper'   THEN 2
      WHEN 'ag_board'    THEN 1
      ELSE 1
    END * t.scale * a.cost_per_run_cents
  )::int,
  (a.fte_equivalent * t.scale * 8.0 / 30)::numeric(8,2)
FROM agent.agents a
CROSS JOIN (VALUES
  ('t_maybank',    10),
  ('t_grab',        9),
  ('t_mindef',      5),
  ('t_singhealth',  1),
  ('t_govtech',     2),
  ('t_astar',       1),
  ('t_mediacorp',   1),
  ('t_singtel',     2)
) AS t(tid, scale)
CROSS JOIN generate_series(0, 89) AS d(n)
ON CONFLICT DO NOTHING;

\echo ' >> agent cost_ledger seed data inserted (90 days)'
