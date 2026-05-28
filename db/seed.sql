-- =====================================================================
--  NTT GRC Hub — Comprehensive Seed Data
--
--  Run AFTER db/init.sql. Populates the database with investor-grade
--  demo data for 8 tenants:
--    Hero (deep data):
--      - t_maybank   Maybank Singapore       (MAS TRM / 655)
--      - t_mindef    MINDEF Defence Cloud    (IM8, classified)
--      - t_grab      Grab Fintech APAC       (multi-jurisdiction)
--    Shallow (minimal — identity + a handful of KPIs):
--      - t_singhealth, t_govtech, t_astar, t_mediacorp, t_singtel
--
--  Design notes:
--    - All temporal data is anchored to now() so seeds always look fresh.
--    - Bulk realism via generate_series + unnest(ARRAY[...]) lookup pools
--      — no thousand-line INSERT VALUES walls.
--    - Hash chain for evidence.seals is computed inline with a window
--      function (lag over captured_at order, per tenant).
--    - Hero "wow path" rows are inserted last with deliberate timestamps
--      so they appear at the top of any "most recent" query.
-- =====================================================================

\set ON_ERROR_STOP on
\c ntt_grc_hub

\echo ' >> seeding NTT GRC Hub demo data'

-- =====================================================================
-- 1. platform.tenants
-- =====================================================================
INSERT INTO platform.tenants (id, name, industry, region, classified, sla_tier, primary_framework, headquartered_in, mrr_sgd) VALUES
  ('t_maybank',    'Maybank Singapore',     'Banking',          'SG',  false, 'platinum', 'mas-trm',  'Singapore', 84000),
  ('t_mindef',     'MINDEF Defence Cloud',  'Defence',          'SG',  true,  'sovereign','im8',      'Singapore', 120000),
  ('t_grab',       'Grab Fintech APAC',     'Fintech',          'APAC',false, 'platinum', 'mas-trm',  'Singapore', 68000),
  ('t_singhealth', 'SingHealth',            'Healthcare',       'SG',  false, 'standard', 'iso-27001','Singapore', 22000),
  ('t_govtech',    'GovTech Singapore',     'Public Sector',    'SG',  false, 'gold',     'im8',      'Singapore', 38000),
  ('t_astar',      'A*STAR',                'Research',         'SG',  false, 'standard', 'iso-27001','Singapore', 14000),
  ('t_mediacorp',  'Mediacorp',             'Media',            'SG',  false, 'standard', 'pdpa-sg',  'Singapore', 9800),
  ('t_singtel',    'Singtel',               'Telecommunications','APAC',false,'gold',     'iso-27001','Singapore', 42000);

-- =====================================================================
-- 2. platform.users (5 per tenant — admin/risk-owner/control-owner/auditor/operator)
-- =====================================================================
INSERT INTO platform.users (tenant_id, email, name, role, status, password_hash, mfa_enabled, last_login_at)
SELECT
  t.id,
  lower(replace(t.name, ' ', '.')) || '.' || u.role_slug || '@example.sg',
  u.name_prefix || ' ' || initcap(split_part(t.name, ' ', 1)),
  u.role::platform.role,
  'active'::platform.user_status,
  '$2b$12$kN35cLnfRicoSwHBw.nTV.Gam3GPStPksqgLnUXna5m6Ksi4gS5U6',
  true,
  now() - (random() * interval '6 hours')
FROM platform.tenants t
CROSS JOIN (VALUES
  ('admin',          'admin',          'Alex'),
  ('risk-owner',     'risk',           'Priya'),
  ('control-owner',  'control',        'Kenji'),
  ('auditor',        'auditor',        'Mei Ling'),
  ('agent-operator', 'ops',            'Marcus')
) AS u(role, role_slug, name_prefix);

-- A small global pool of "viewer" users per hero tenant for ack volume
INSERT INTO platform.users (tenant_id, email, name, role, status, mfa_enabled, last_login_at)
SELECT
  hero.tid,
  'viewer' || g || '.' || hero.slug || '@example.sg',
  'Viewer ' || g || ' ' || hero.slug,
  'viewer'::platform.role,
  'active'::platform.user_status,
  (g % 2 = 0),
  now() - ((g % 30) * interval '1 day')
FROM (VALUES
  ('t_maybank', 'maybank'),
  ('t_mindef',  'mindef'),
  ('t_grab',    'grab')
) AS hero(tid, slug)
CROSS JOIN generate_series(1, 30) g;

\echo ' >> tenants + users seeded'

-- =====================================================================
-- 3. compliance.frameworks (35+ — global library, no tenant_id)
-- =====================================================================
INSERT INTO compliance.frameworks (id, name, version, regulator, region, jurisdiction, total_requirements, tags) VALUES
  -- Global
  ('soc2',           'SOC 2',                              '2017 TSC',     'AICPA',     'Global',    'US',     80,  '["audit","security"]'),
  ('iso-27001',      'ISO/IEC 27001',                       '2022',         'ISO',       'Global',    'INTL',   93,  '["security","isms"]'),
  ('iso-27017',      'ISO/IEC 27017',                       '2015',         'ISO',       'Global',    'INTL',   37,  '["cloud","security"]'),
  ('iso-27018',      'ISO/IEC 27018',                       '2019',         'ISO',       'Global',    'INTL',   25,  '["privacy","cloud"]'),
  ('iso-27701',      'ISO/IEC 27701',                       '2019',         'ISO',       'Global',    'INTL',   49,  '["privacy"]'),
  ('iso-22301',      'ISO 22301',                           '2019',         'ISO',       'Global',    'INTL',   62,  '["bcm"]'),
  ('iso-42001',      'ISO/IEC 42001',                       '2023',         'ISO',       'Global',    'INTL',   38,  '["ai-governance"]'),
  ('nist-csf',       'NIST CSF 2.0',                        '2.0',          'NIST',      'Global',    'US',     106, '["security"]'),
  ('nist-80053',     'NIST SP 800-53',                      'Rev 5',        'NIST',      'Global',    'US',     421, '["security","federal"]'),
  ('nist-airmf',     'NIST AI RMF',                         '1.0',          'NIST',      'Global',    'US',     72,  '["ai-governance"]'),
  ('pci-dss-4',      'PCI DSS',                             '4.0',          'PCI SSC',   'Global',    'INTL',   281, '["payments"]'),
  -- EU
  ('gdpr',           'GDPR',                                '2016/679',     'EDPB',      'EU',        'EU',     99,  '["privacy"]'),
  ('dora',           'DORA',                                '2022/2554',    'EBA',       'EU',        'EU',     112, '["operational-resilience","financial"]'),
  ('nis2',           'NIS2',                                '2022/2555',    'ENISA',     'EU',        'EU',     86,  '["security","critical-infra"]'),
  ('eu-ai-act',      'EU AI Act',                           '2024/1689',    'EC',        'EU',        'EU',     113, '["ai-governance"]'),
  ('csrd',           'CSRD',                                '2022/2464',    'EC',        'EU',        'EU',     82,  '["esg","sustainability"]'),
  -- Americas
  ('hipaa',          'HIPAA Security Rule',                 '2013',         'HHS',       'Americas',  'US',     54,  '["healthcare","privacy"]'),
  ('ccpa',           'CCPA / CPRA',                         '2023',         'CPPA',      'Americas',  'US',     46,  '["privacy"]'),
  ('sox',            'SOX',                                 '2002',         'SEC',       'Americas',  'US',     44,  '["financial","audit"]'),
  ('fedramp-mod',    'FedRAMP Moderate',                    'Rev 5',        'FedRAMP',   'Americas',  'US',     325, '["security","federal","cloud"]'),
  ('fedramp-high',   'FedRAMP High',                        'Rev 5',        'FedRAMP',   'Americas',  'US',     421, '["security","federal","cloud"]'),
  -- Singapore
  ('mas-trm',        'MAS TRM Guidelines',                  '2021',         'MAS',       'Singapore', 'SG',     188, '["financial","security"]'),
  ('mas-notice-655', 'MAS Notice 655',                      '2024 update',  'MAS',       'Singapore', 'SG',     38,  '["financial","outsourcing"]'),
  ('mas-notice-644', 'MAS Notice 644',                      '2022',         'MAS',       'Singapore', 'SG',     22,  '["financial","incident-reporting"]'),
  ('im8',            'IM8 (GovTech)',                       'v9.0',         'GovTech',   'Singapore', 'SG',     142, '["sovereign","public-sector"]'),
  ('pdpa-sg',        'PDPA Singapore',                      '2020',         'PDPC',      'Singapore', 'SG',     58,  '["privacy"]'),
  -- APAC banking
  ('hkma-tmg1',      'HKMA TM-G-1',                         '2019',         'HKMA',      'APAC',      'HK',     48,  '["financial"]'),
  ('apra-cps234',    'APRA CPS 234',                        '2019',         'APRA',      'APAC',      'AU',     36,  '["financial","security"]'),
  ('apra-cps230',    'APRA CPS 230',                        '2023',         'APRA',      'APAC',      'AU',     42,  '["financial","operational-resilience"]'),
  ('rbi-cyber',      'RBI Cyber Security Framework',        '2016',         'RBI',       'APAC',      'IN',     54,  '["financial","security"]'),
  ('ojk-1103',       'OJK POJK 11/03/2022',                 '2022',         'OJK',       'APAC',      'ID',     38,  '["financial"]'),
  ('bnm-rmit',       'BNM RMiT',                            '2020',         'BNM',       'APAC',      'MY',     62,  '["financial","security"]'),
  ('bot-itrisk',     'BOT IT Risk',                         '2021',         'BOT',       'APAC',      'TH',     34,  '["financial","security"]'),
  ('bsp-982',        'BSP Circular 982',                    '2017',         'BSP',       'APAC',      'PH',     28,  '["financial"]'),
  -- APAC privacy
  ('pipl',           'PIPL',                                '2021',         'CAC',       'APAC',      'CN',     74,  '["privacy"]'),
  ('appi',           'APPI',                                '2022',         'PPC',       'APAC',      'JP',     56,  '["privacy"]'),
  ('pipa',           'PIPA',                                '2020',         'PIPC',      'APAC',      'KR',     48,  '["privacy"]'),
  ('pdpa-my',        'PDPA Malaysia',                       '2010',         'JPDP',      'APAC',      'MY',     32,  '["privacy"]'),
  ('pdpa-th',        'PDPA Thailand',                       '2019',         'PDPC-TH',   'APAC',      'TH',     38,  '["privacy"]'),
  ('aus-privacy',    'Privacy Act',                         '1988',         'OAIC',      'APAC',      'AU',     42,  '["privacy"]'),
  -- ESG
  ('ghg-protocol',   'GHG Protocol',                        '2015 rev',     'WRI/WBCSD', 'Global',    'INTL',   28,  '["esg","ghg"]'),
  ('issb-s1-s2',     'ISSB IFRS S1/S2',                     '2023',         'ISSB',      'Global',    'INTL',   46,  '["esg","disclosure"]'),
  ('tcfd',           'TCFD',                                '2017 rev 2021','FSB',       'Global',    'INTL',   11,  '["esg","climate"]');

-- Child requirements: only for the top 8 frameworks (sample 30-80 each).
-- Code pattern: "{framework}-R{nnn}".
INSERT INTO compliance.requirements (id, framework_id, code, title, description, weight)
SELECT
  f.fid || '-R' || lpad(g::text, 3, '0'),
  f.fid,
  upper(f.fid) || '-' || lpad(g::text, 3, '0'),
  (ARRAY[
    'Access control policy',           'Encryption at rest',          'Encryption in transit',
    'Privileged access review',        'Vulnerability management',    'Incident response plan',
    'Data classification',             'Logging and monitoring',      'Change management',
    'Backup and recovery testing',     'Vendor risk management',      'Personnel security',
    'Business continuity testing',     'Risk assessment cadence',     'Security awareness training',
    'Audit log retention',             'MFA enforcement',             'Patch management SLA',
    'Network segmentation',            'Data retention policy',       'Subject access request handling',
    'Cross-border transfer controls',  'AI model risk management',    'Penetration testing',
    'Configuration baseline',          'Disaster recovery RTO/RPO',   'Cryptographic key management',
    'Third-party SOC2 review',         'Endpoint protection',         'Cloud workload isolation'
  ])[1 + (g % 30)] || ' (' || upper(f.fid) || '.' || g || ')',
  'Auto-generated requirement for ' || f.fid || ' — clause ' || g,
  CASE WHEN g % 7 = 0 THEN 2.0 WHEN g % 3 = 0 THEN 1.5 ELSE 1.0 END
FROM (VALUES
  ('soc2',       80),
  ('iso-27001',  60),
  ('nist-csf',   60),
  ('pci-dss-4',  80),
  ('mas-trm',    70),
  ('gdpr',       50),
  ('dora',       60),
  ('eu-ai-act',  40)
) AS f(fid, n)
CROSS JOIN LATERAL generate_series(1, f.n) g;

\echo ' >> frameworks + sample requirements seeded'

-- =====================================================================
-- 4. agent.agents (10 universal agents — platform-global)
-- =====================================================================
INSERT INTO agent.agents (id, name, slug, description, type, status, owner_team, cost_per_run_cents, cost_monthly_estimate_cents, fte_equivalent) VALUES
  ('ag_evidence',  'Evidence Collector',    'evidence-collector',   'Pulls evidence from AWS, Azure, GCP, Okta, Jira, M365, GitHub, ServiceNow. Hashes and seals each item.', 'deterministic', 'running', 'GRC Platform',        2,    0,     0.80),
  ('ag_tester',    'Control Tester',        'control-tester',       'Continuously evaluates technical controls against live cloud config.',                                  'ai-powered',    'running', 'GRC Platform',        4,    3000,  0.60),
  ('ag_vendor',    'Vendor Risk Analyst',   'vendor-risk-analyst',  'Auto-fills SIG/CAIQ from vendor SOC 2 / ISO reports, scores residual risk.',                            'ai-powered',    'idle',    'TPRM',                12,   8000,  0.50),
  ('ag_policy',    'Policy Drafter',        'policy-drafter',       'Drafts policy documents from framework deltas + org context.',                                          'ai-powered',    'idle',    'Policy Office',       28,   12000, 0.40),
  ('ag_regwatch',  'Regulatory Horizon',    'regulatory-horizon',   'Scans 40+ regulator sources, tags impact, opens assessments.',                                          'intelligent',   'running', 'GRC Intelligence',    16,   20000, 0.55),
  ('ag_audit',     'Audit Companion',       'audit-companion',      'Assembles auditor evidence packs, links evidence → control → requirement.',                             'intelligent',   'idle',    'Internal Audit',      32,   15000, 0.45),
  ('ag_fair',      'Risk Quantifier',       'risk-quantifier',      'Runs FAIR Monte Carlo (10k trials), produces LEC + ALE.',                                               'ai-powered',    'idle',    'ERM',                 8,    4000,  0.40),
  ('ag_incident',  'Incident Investigator', 'incident-investigator','Builds incident timeline + draft postmortem from logs/tickets/chat.',                                   'intelligent',   'idle',    'SOC',                 24,   18000, 0.60),
  ('ag_mapper',    'Control Mapper',        'control-mapper',       'Maps a new/custom control into all 35+ frameworks with semantic similarity.',                           'ai-powered',    'idle',    'Compliance',          6,    6000,  0.40),
  ('ag_board',     'Board Narrator',        'board-narrator',       'Generates monthly 1-page board narratives from quantitative data.',                                     'ai-powered',    'idle',    'Executive Office',    40,   9000,  0.30);

INSERT INTO agent.tools (agent_id, tool_name, tool_kind, description) VALUES
  ('ag_evidence',  'aws.s3.list',                  'api',    'List S3 buckets and bucket policies'),
  ('ag_evidence',  'okta.users.list',              'api',    'Pull Okta user inventory'),
  ('ag_evidence',  'github.repos.security_config', 'api',    'Read GitHub security & branch protection config'),
  ('ag_evidence',  'evidence.seal',                'db',     'Compute hash-chain seal'),
  ('ag_tester',    'aws.config.eval',              'api',    'Evaluate AWS Config managed rules'),
  ('ag_tester',    'azure.policy.eval',            'api',    'Evaluate Azure Policy compliance'),
  ('ag_tester',    'llm.interpret',                'llm',    'Interpret raw config into pass/fail with rationale'),
  ('ag_vendor',    'sig.parse',                    'script', 'Parse SIG questionnaire'),
  ('ag_vendor',    'soc2.extract',                 'llm',    'Extract controls from SOC 2 PDF'),
  ('ag_policy',    'policy.draft',                 'llm',    'Generate policy markdown'),
  ('ag_regwatch',  'web.fetch',                    'api',    'Fetch regulator publication feed'),
  ('ag_regwatch',  'regulator.diff',               'script', 'Diff against last snapshot'),
  ('ag_regwatch',  'llm.summarise',                'llm',    'Summarise regulatory change'),
  ('ag_audit',     'evidence.search',              'db',     'Semantic search over evidence vault'),
  ('ag_audit',     'pack.assemble',                'script', 'Bundle evidence into auditor pack'),
  ('ag_fair',      'fair.simulate',                'script', 'Monte Carlo simulation (10k trials)'),
  ('ag_incident',  'logs.fetch',                   'api',    'Pull logs from observability stack'),
  ('ag_incident',  'timeline.build',               'script', 'Construct incident timeline'),
  ('ag_incident',  'llm.draft-postmortem',         'llm',    'Draft postmortem narrative'),
  ('ag_mapper',    'embed.similarity',             'llm',    'Compute semantic similarity to existing controls'),
  ('ag_board',     'kpi.aggregate',                'db',     'Aggregate KPIs across modules'),
  ('ag_board',     'llm.narrative',                'llm',    'Generate executive narrative');

\echo ' >> agents + tools seeded'

-- =====================================================================
-- 5. regwatch.sources (global)
-- =====================================================================
INSERT INTO regwatch.sources (id, regulator_code, name, source_url, jurisdiction, last_scanned_at, enabled) VALUES
  ('src_mas',    'MAS',   'Monetary Authority of Singapore',         'https://www.mas.gov.sg/news', 'SG', now() - interval '4 minutes',  true),
  ('src_apra',   'APRA',  'Australian Prudential Regulation Authority','https://www.apra.gov.au/news-and-publications','AU', now() - interval '38 minutes', true),
  ('src_eu',     'EU',    'European Commission (DORA/NIS2/AI Act)',  'https://eur-lex.europa.eu',  'EU', now() - interval '12 minutes', true),
  ('src_ojk',    'OJK',   'Otoritas Jasa Keuangan',                  'https://www.ojk.go.id',      'ID', now() - interval '2 hours',    true),
  ('src_rbi',    'RBI',   'Reserve Bank of India',                   'https://www.rbi.org.in',     'IN', now() - interval '1 hour',     true),
  ('src_hkma',   'HKMA',  'Hong Kong Monetary Authority',            'https://www.hkma.gov.hk',    'HK', now() - interval '3 hours',    true),
  ('src_bnm',    'BNM',   'Bank Negara Malaysia',                    'https://www.bnm.gov.my',     'MY', now() - interval '6 hours',    true),
  ('src_bot',    'BOT',   'Bank of Thailand',                        'https://www.bot.or.th',      'TH', now() - interval '5 hours',    true),
  ('src_bsp',    'BSP',   'Bangko Sentral ng Pilipinas',             'https://www.bsp.gov.ph',     'PH', now() - interval '4 hours',    true),
  ('src_pdpc',   'PDPC',  'Personal Data Protection Commission SG',  'https://www.pdpc.gov.sg',    'SG', now() - interval '7 hours',    true),
  ('src_govtech','IM8',   'GovTech Singapore IM8',                   'https://www.tech.gov.sg/im8','SG', now() - interval '9 hours',    true),
  ('src_pipc',   'PIPC',  'Personal Information Protection Commission KR','https://www.pipc.go.kr','KR',now() - interval '11 hours',   true);

-- =====================================================================
-- 6. bcm.scenarios (global library)
-- =====================================================================
INSERT INTO bcm.scenarios (id, name, description, severity, assumptions) VALUES
  ('scn_dc_loss',      'Primary DC Loss',           'Full loss of primary datacentre — Changi-S',          'critical', '{"duration_hours":48,"region":"SG"}'),
  ('scn_cloud_region', 'AWS ap-southeast-1 outage', 'Multi-AZ regional outage at AWS Singapore',           'high',     '{"duration_hours":6,"provider":"aws"}'),
  ('scn_cyber',        'Ransomware on core banking','Ransomware encrypts core banking estate',             'critical', '{"recovery_hours":24}'),
  ('scn_keystaff',     'Key staff unavailable',     'CISO + 2 deputies unreachable for 72h',               'medium',   '{"duration_hours":72}'),
  ('scn_supplier',     'Tier-1 supplier failure',   'Critical SaaS supplier insolvency',                   'high',     '{"vendor_tier":"1"}'),
  ('scn_pandemic',     'Pandemic — remote-only',    '8 week mandatory work-from-home',                     'medium',   '{"duration_weeks":8}');

\echo ' >> regwatch sources + BCM scenarios seeded'

-- =====================================================================
-- 7. HERO TENANT: Maybank — risk register
-- =====================================================================
INSERT INTO risk.registers (id, tenant_id, name, description)
VALUES
  ('11111111-1111-1111-1111-111111111111', 't_maybank',  'Enterprise Risk Register',       'Top-down ERM register'),
  ('11111111-1111-1111-1111-111111111112', 't_maybank',  'Operational Risk Register',      'Op-risk by business service'),
  ('22222222-2222-2222-2222-222222222221', 't_grab',     'Enterprise Risk Register',       'Cross-jurisdiction ERM register'),
  ('22222222-2222-2222-2222-222222222222', 't_grab',     'Fintech Product Risk Register',  'Per-product risk for GrabPay/Loans'),
  ('33333333-3333-3333-3333-333333333331', 't_mindef',   'Defence ERM Register',           'Sovereign defence risk register'),
  ('44444444-4444-4444-4444-444444444441', 't_singhealth','Healthcare Risk Register',      'Healthcare op-risk'),
  ('44444444-4444-4444-4444-444444444442', 't_govtech',  'Public Sector Risk Register',    'GovTech IM8 risk register'),
  ('44444444-4444-4444-4444-444444444443', 't_astar',    'Research Risk Register',         'Research data risk register'),
  ('44444444-4444-4444-4444-444444444444', 't_mediacorp','Media Risk Register',            'Mediacorp content+privacy risk'),
  ('44444444-4444-4444-4444-444444444445', 't_singtel',  'Telco Risk Register',            'Singtel enterprise risk register');

-- Risk title pool (40 themes) — recycled with index suffix for uniqueness
INSERT INTO risk.risks (
  tenant_id, register_id, code, title, description, category,
  inherent_severity, inherent_likelihood, residual_severity, residual_likelihood,
  status, treatment_strategy, last_assessed_at, next_review_at, business_service, tags
)
SELECT
  spec.tid,
  spec.rid::uuid,
  'R-' || upper(substr(spec.tid, 3, 4)) || '-' || lpad(g::text, 4, '0'),
  (ARRAY[
    'Ransomware on customer-facing systems',           'Insider data exfiltration',
    'Third-party cloud concentration risk',            'Regulatory non-compliance — MAS Notice 655',
    'Cross-border data transfer breach',               'Privileged account misuse',
    'AI model bias in credit scoring',                 'Hallucination in AI customer assistant',
    'Vendor SaaS supplier insolvency',                 'Patch backlog on internet-facing servers',
    'Misconfigured cloud storage exposing PII',        'Key staff attrition (CISO office)',
    'Phishing-led credential compromise',              'Loss of primary datacentre',
    'Cyber attack on payment gateway',                 'Lack of segregation of duties in payments',
    'Inadequate logging on critical systems',          'BCM plan stale (>12 months)',
    'Privacy: subject request SLA breach',             'Encryption key rotation overdue',
    'Compromise of CI/CD pipeline',                    'Quantum-vulnerable cryptography in flight',
    'Open-source dependency vulnerability',            'Excessive cloud admin entitlements',
    'Concentration risk on AWS ap-southeast-1',        'Inadequate vendor exit plan',
    'Anti-money-laundering rule gap',                  'Cross-jurisdiction conflict (PIPL vs GDPR)',
    'Climate transition risk in lending book',         'ESG disclosure misstatement risk',
    'Lack of monitoring on shadow IT',                 'Inadequate IAM joiner/mover/leaver process',
    'Outdated DR runbook for Tier-1 service',          'Insufficient red-team coverage',
    'Manual control fatigue / drift',                  'Regulator change unmonitored',
    'Sanctions screening false-negative',              'Trade surveillance gap',
    'Model risk not registered (shadow AI)',           'Customer data retention overrun'
  ])[1 + (g % 40)] || ' #' || g,
  'Auto-generated demo risk for showcase. Inherent → residual scoring reflects mitigation maturity.',
  (ARRAY['cyber','technology','third-party','regulatory','financial','operational','people','privacy','ai','climate'])[1 + (g % 10)],
  -- inherent severity skewed toward higher
  (ARRAY['critical','high','high','high','medium','medium','medium','low'])[1 + (g % 8)]::risk.severity,
  (ARRAY['likely','possible','possible','likely','almost-certain','unlikely','possible','rare'])[1 + (g % 8)]::risk.likelihood,
  -- residual: a notch lower most of the time
  (ARRAY['high','high','medium','medium','medium','low','low','info','critical'])[1 + (g % 9)]::risk.severity,
  (ARRAY['possible','possible','unlikely','possible','rare','possible','unlikely','rare','likely'])[1 + (g % 9)]::risk.likelihood,
  (ARRAY['identified','assessed','treated','monitoring','assessed','treated'])[1 + (g % 6)]::risk.status,
  (ARRAY['mitigate','mitigate','mitigate','accept','transfer','mitigate','avoid'])[1 + (g % 7)]::risk.treatment_strategy,
  now() - ((g % 90) * interval '1 day'),
  now() + ((30 + g % 120) * interval '1 day'),
  (ARRAY['Core Banking','Payments','Trading','Retail','Wealth','Treasury','Lending','Onboarding','Mobile App','Internet Banking'])[1 + (g % 10)],
  jsonb_build_object('source','seed','batch',g % 12,'jurisdiction',(ARRAY['SG','MY','ID','TH','PH','IN'])[1 + (g % 6)])
FROM (
  -- Each row in this VALUES drives one tenant's risk batch
  VALUES
    ('t_maybank', '11111111-1111-1111-1111-111111111111', 340),
    ('t_grab',    '22222222-2222-2222-2222-222222222221', 410),
    ('t_mindef',  '33333333-3333-3333-3333-333333333331', 220),
    ('t_singhealth','44444444-4444-4444-4444-444444444441', 28),
    ('t_govtech',   '44444444-4444-4444-4444-444444444442', 36),
    ('t_astar',     '44444444-4444-4444-4444-444444444443', 18),
    ('t_mediacorp', '44444444-4444-4444-4444-444444444444', 14),
    ('t_singtel',   '44444444-4444-4444-4444-444444444445', 42)
) AS spec(tid, rid, n)
CROSS JOIN LATERAL generate_series(1, spec.n) g;

\echo ' >> risks seeded'

-- =====================================================================
-- 8. risk.treatments (one treatment per ~3 risks)
-- =====================================================================
INSERT INTO risk.treatments (tenant_id, risk_id, strategy, description, due_at, cost_sgd)
SELECT
  r.tenant_id,
  r.id,
  r.treatment_strategy,
  'Treatment plan: implement compensating control and reduce residual likelihood. Owner accountable; monthly cadence.',
  now() + ((30 + (random() * 180))::int * interval '1 day'),
  ((random() * 250000)::int)::numeric(14,2)
FROM (
  SELECT id, tenant_id, treatment_strategy,
         row_number() OVER (PARTITION BY tenant_id ORDER BY code) AS rn
  FROM risk.risks
) r
WHERE r.rn % 3 = 0;

-- =====================================================================
-- 9. risk.appetite_statements (5 per hero tenant)
-- =====================================================================
INSERT INTO risk.appetite_statements (tenant_id, category, statement, threshold_sgd, severity_cap, approved_at)
SELECT
  hero.tid,
  cats.cat,
  'No appetite for ' || cats.cat || ' incidents that exceed the stated threshold. Board-approved.',
  cats.thresh,
  cats.cap::risk.severity,
  now() - interval '90 days'
FROM (VALUES
  ('t_maybank'), ('t_mindef'), ('t_grab')
) AS hero(tid)
CROSS JOIN (VALUES
  ('cyber',       5000000.00, 'high'),
  ('regulatory',  1000000.00, 'high'),
  ('third-party', 2000000.00, 'high'),
  ('privacy',     500000.00,  'medium'),
  ('financial',   10000000.00,'critical')
) AS cats(cat, thresh, cap);

-- =====================================================================
-- 10. risk.scenarios + risk.fair_runs (FAIR Monte Carlo)
-- =====================================================================
-- 20 scenarios per Maybank, 20 per Grab, 10 for MINDEF
INSERT INTO risk.scenarios (tenant_id, risk_id, name, description, frequency_dist, magnitude_dist)
SELECT
  spec.tid,
  (SELECT id FROM risk.risks WHERE tenant_id = spec.tid ORDER BY code OFFSET (g % 20) LIMIT 1),
  (ARRAY[
    'Ransomware on core banking',          'PII breach via misconfigured S3',
    'Insider trading misuse',              'Payments outage > 4h',
    'Vendor SaaS supplier failure',         'Cross-border transfer breach',
    'AI credit scoring bias claim',         'Cloud region outage',
    'AML rule failure',                     'Subject access request mass event',
    'CI/CD pipeline compromise',            'OSS supply chain compromise',
    'Datacentre loss',                      'Regulatory fine — MAS Notice 655',
    'Phishing-led credential theft',        'Quantum-decrypt of long-lived secrets',
    'API abuse (credential stuffing)',      'Insider data exfiltration',
    'DDoS on consumer portal',              'Wire fraud via BEC'
  ])[1 + (g - 1) % 20] || ' (' || spec.tid || ' #' || g || ')',
  'FAIR scenario auto-seeded. Frequency and magnitude calibrated to industry benchmarks.',
  jsonb_build_object('kind','beta-pert','min', 0.1 + (g % 5)*0.2, 'mode', 1.0 + (g % 7), 'max', 4.0 + (g % 9)),
  jsonb_build_object('kind','lognormal','mean', 200000 + (g * 18000), 'stdev', 80000 + (g * 4500))
FROM (VALUES
  ('t_maybank', 20),
  ('t_grab',    20),
  ('t_mindef',  10)
) AS spec(tid, n)
CROSS JOIN LATERAL generate_series(1, spec.n) g;

INSERT INTO risk.fair_runs (tenant_id, scenario_id, trials, lec_percentiles, ale_sgd, aro, run_at)
SELECT
  s.tenant_id,
  s.id,
  10000,
  jsonb_build_object(
    'p10', 80000  + (random() * 50000)::int,
    'p25', 220000 + (random() * 100000)::int,
    'p50', 480000 + (random() * 220000)::int,
    'p75', 1100000 + (random() * 400000)::int,
    'p90', 2400000 + (random() * 800000)::int,
    'p95', 3800000 + (random() * 900000)::int,
    'p99', 6800000 + (random() * 1400000)::int
  ),
  (520000 + (random() * 1400000))::numeric(14,2),
  (0.4 + random() * 4.2)::numeric(10,4),
  now() - ((random() * 45)::int * interval '1 day')
FROM risk.scenarios s;

\echo ' >> risk treatments + scenarios + FAIR runs seeded'

-- =====================================================================
-- 11. control.library (1,200 Maybank · 1,500 Grab · 900 MINDEF · small shallow)
-- =====================================================================
INSERT INTO control.library (id, tenant_id, code, title, description, type, family, frequency, automated, maturity)
SELECT
  'ctl_' || spec.tid || '_' || lpad(g::text, 5, '0'),
  spec.tid,
  upper(substr(spec.tid, 3, 4)) || '-CTL-' || lpad(g::text, 5, '0'),
  (ARRAY[
    'MFA enforced on all admin accounts',         'Encryption at rest using KMS',
    'Encryption in transit (TLS 1.2+)',           'Quarterly privileged access review',
    'Vulnerability scanning weekly',              'Patch SLA 30 days for criticals',
    'Centralised audit logging',                  'Backup tested quarterly',
    'Change approval gate in CI/CD',              'Anti-malware on endpoints',
    'Network segmentation between tiers',         'Data classification labels enforced',
    'Subject-request workflow within 30 days',    'Vendor SOC 2 review on onboarding',
    'Joiner/mover/leaver process',                'Time-bound break-glass access',
    'Secrets rotated every 90 days',              'PII tokenisation in non-prod',
    'Public-bucket detection blocks deployment',  'Identity federation via Okta',
    'IAM root account locked & monitored',        'Cloud config drift alarm',
    'Penetration test annually',                  'Tabletop BCM exercise twice a year',
    'Threat intel feed integration',              'Privileged session recording',
    'Container image vulnerability scan',         'Infrastructure-as-Code policy gate',
    'Data loss prevention on email',              'Mobile device management'
  ])[1 + (g % 30)],
  'Auto-seeded control description. Owner accountable; evidence captured by Evidence Collector agent.',
  (ARRAY['technical','technical','technical','process','process','admin'])[1 + (g % 6)]::control.type,
  (ARRAY[
      '["access-control","identity"]'::jsonb,
      '["cryptography","data"]'::jsonb,
      '["network","segmentation"]'::jsonb,
      '["logging","monitoring"]'::jsonb,
      '["vulnerability","patch"]'::jsonb,
      '["change-management"]'::jsonb,
      '["privacy","data"]'::jsonb,
      '["third-party","vendor"]'::jsonb,
      '["bcm","resilience"]'::jsonb,
      '["ai","model-risk"]'::jsonb
   ])[1 + (g % 10)],
  (ARRAY['continuous','daily','weekly','monthly','quarterly','annual'])[1 + (g % 6)],
  (g % 3 = 0),
  (ARRAY['defined','managed','managed','optimised','developing','defined'])[1 + (g % 6)]::control.maturity
FROM (VALUES
  ('t_maybank',  1200),
  ('t_grab',     1500),
  ('t_mindef',   900),
  ('t_singhealth', 60),
  ('t_govtech',    90),
  ('t_astar',      45),
  ('t_mediacorp',  30),
  ('t_singtel',   120)
) AS spec(tid, n)
CROSS JOIN LATERAL generate_series(1, spec.n) g;

\echo ' >> control library seeded'

-- =====================================================================
-- 12. control.tests — one test per control (named after the control)
-- =====================================================================
INSERT INTO control.tests (tenant_id, control_id, name, kind, schedule_cron, procedure_md)
SELECT
  c.tenant_id,
  c.id,
  c.title || ' — automated check',
  (CASE WHEN c.automated THEN 'automated' ELSE 'manual' END)::control.test_kind,
  (ARRAY['0 */6 * * *','0 2 * * *','0 0 * * 0','0 0 1 * *',NULL])[1 + (abs(hashtext(c.id)) % 5)],
  '## Procedure' || E'\n' || '1. Query data source' || E'\n' || '2. Apply rule' || E'\n' || '3. Record result'
FROM control.library c
WHERE c.tenant_id IN ('t_maybank', 't_grab', 't_mindef');

-- =====================================================================
-- 13. control.mappings (~6,000 Maybank — 5 frameworks per control on
-- average; for Grab proportionally higher because multi-jurisdiction)
-- =====================================================================
-- We pick 5 frameworks per Maybank control, 7 per Grab, 4 per MINDEF.
-- To avoid uniqueness conflicts we use generate_series and offset.
INSERT INTO control.mappings (control_id, framework_id, coverage_pct, notes)
SELECT
  c.id,
  (ARRAY['mas-trm','iso-27001','pci-dss-4','soc2','nist-csf','dora','mas-notice-655','gdpr','eu-ai-act','iso-22301'])[1 + ((abs(hashtext(c.id)) + k) % 10)],
  (60 + ((abs(hashtext(c.id)) + k * 7) % 41)),
  'Auto-mapped by Control Mapper agent. Confidence ' || (70 + ((abs(hashtext(c.id)) + k) % 30))::text || '%'
FROM control.library c
CROSS JOIN LATERAL generate_series(0, CASE c.tenant_id
                                            WHEN 't_maybank' THEN 4
                                            WHEN 't_grab'    THEN 6
                                            WHEN 't_mindef'  THEN 3
                                            ELSE -1 END) AS k
WHERE c.tenant_id IN ('t_maybank', 't_grab', 't_mindef');

\echo ' >> control mappings seeded'

-- =====================================================================
-- 14. evidence.collectors (one per kind, per hero tenant)
-- =====================================================================
INSERT INTO evidence.collectors (id, tenant_id, name, kind, schedule_cron, last_run_at, enabled, config)
SELECT
  'col_' || hero.tid || '_' || k.kind,
  hero.tid,
  k.label || ' Collector',
  k.kind::evidence.collector_kind,
  '0 */6 * * *',
  now() - ((random() * 360)::int * interval '1 minute'),
  true,
  jsonb_build_object('region', hero.region, 'kind', k.kind)
FROM (VALUES
  ('t_maybank', 'ap-southeast-1'),
  ('t_grab',    'ap-southeast-1'),
  ('t_mindef',  'sg-sovereign')
) AS hero(tid, region)
CROSS JOIN (VALUES
  ('aws',         'AWS'),
  ('azure',       'Azure'),
  ('gcp',         'GCP'),
  ('okta',        'Okta'),
  ('jira',        'Jira'),
  ('m365',        'Microsoft 365'),
  ('github',      'GitHub'),
  ('servicenow',  'ServiceNow'),
  ('slack',       'Slack'),
  ('manual',      'Manual Upload')
) AS k(kind, label);

\echo ' >> evidence collectors seeded'

-- =====================================================================
-- 15. evidence.items (8,400 Maybank · 11,000 Grab · 5,200 MINDEF + shallow)
-- =====================================================================
-- Spread captured_at across the last 90 days (peak in last 7 days).
INSERT INTO evidence.items (tenant_id, collector_id, control_id, kind, title, source_url, blob_url, captured_at, metadata)
SELECT
  spec.tid,
  (SELECT id FROM evidence.collectors WHERE tenant_id = spec.tid ORDER BY id OFFSET (g % 10) LIMIT 1),
  -- control_id: pick one of the tenant's controls (round-robin via offset)
  (SELECT id FROM control.library WHERE tenant_id = spec.tid ORDER BY code OFFSET (g % GREATEST(spec.cn,1)) LIMIT 1),
  (ARRAY['screenshot','log','config','attestation','document','scan-result','api-response'])[1 + (g % 7)]::evidence.kind,
  (ARRAY[
    'AWS S3 bucket policy snapshot',         'Okta MFA enrolment report',
    'GitHub branch protection config',       'Azure NSG rule export',
    'Jira change ticket — approved',         'CrowdStrike agent inventory',
    'AWS Config compliance summary',         'KMS key rotation event',
    'IAM access review — quarterly',         'M365 conditional access report',
    'PCI ASV scan result',                   'Endpoint patch report',
    'Backup restore test result',            'DLP policy hit summary',
    'Tabletop exercise minutes',             'SOC 2 vendor attestation',
    'Penetration test exec summary',         'Threat intel digest',
    'BCP test report',                       'Privacy impact assessment'
  ])[1 + (g % 20)] || ' #' || g,
  'https://evidence.example.sg/' || spec.tid || '/' || g,
  's3://grc-evidence/' || spec.tid || '/' || g || '.bin',
  -- Weighted: 70% in last 14 days, 30% in last 90
  now() - (CASE WHEN g % 10 < 7
                THEN ((random() * 14)::int * interval '1 day')
                ELSE ((random() * 90)::int * interval '1 day')
           END) - ((random() * 24)::int * interval '1 hour'),
  jsonb_build_object('source','seed','batch', g % 50, 'idx', g)
FROM (VALUES
  ('t_maybank',  8400, 1200),
  ('t_grab',    11000, 1500),
  ('t_mindef',   5200, 900),
  ('t_singhealth', 200, 60),
  ('t_govtech',    400, 90),
  ('t_astar',      120, 45),
  ('t_mediacorp',   90, 30),
  ('t_singtel',    280, 120)
) AS spec(tid, n, cn)
CROSS JOIN LATERAL generate_series(1, spec.n) g;

\echo ' >> evidence items seeded'

-- =====================================================================
-- 16. evidence.seals — hash chain via window function
-- =====================================================================
INSERT INTO evidence.seals (item_id, prev_hash, row_hash, sealed_at)
SELECT
  id,
  lag(md5(tenant_id || id::text || coalesce(title,''))) OVER (PARTITION BY tenant_id ORDER BY captured_at, id),
  md5(coalesce(lag(md5(tenant_id || id::text || coalesce(title,''))) OVER (PARTITION BY tenant_id ORDER BY captured_at, id), '') || tenant_id || id::text || coalesce(title,'')),
  captured_at
FROM evidence.items;

-- =====================================================================
-- 17. evidence.attachments — about 1 attachment for every 2 evidence items
-- =====================================================================
INSERT INTO evidence.attachments (item_id, filename, mime_type, size_bytes, sha256)
SELECT
  i.id,
  'evidence_' || i.id || '.' || (ARRAY['pdf','json','png','log','txt'])[1 + (i.id::bigint % 5)],
  (ARRAY['application/pdf','application/json','image/png','text/plain','text/plain'])[1 + (i.id::bigint % 5)],
  (4096 + (i.id::bigint * 173) % 9_000_000)::bigint,
  md5('att_' || i.id::text)
FROM evidence.items i
WHERE i.id % 2 = 0;

\echo ' >> evidence seals + attachments seeded'

-- =====================================================================
-- 18. control.test_runs (~ enough to populate trends and recent fails)
-- =====================================================================
-- Generate runs per Maybank/Grab/MINDEF control sampled across 60 days
INSERT INTO control.test_runs (tenant_id, control_id, test_id, ran_at, result, notes, duration_ms)
SELECT
  c.tenant_id,
  c.id,
  (SELECT id FROM control.tests WHERE control_id = c.id LIMIT 1),
  now() - ((g % 60) * interval '1 day') - ((abs(hashtext(c.id || g::text)) % 86400) * interval '1 second'),
  (ARRAY['pass','pass','pass','pass','pass','pass','pass','partial','fail','na'])[1 + ((abs(hashtext(c.id)) + g) % 10)]::control.test_result,
  'Auto-seeded test run.',
  (120 + (abs(hashtext(c.id || g::text)) % 12000))
FROM control.library c
CROSS JOIN LATERAL generate_series(1,
   CASE c.tenant_id
     WHEN 't_maybank' THEN 3
     WHEN 't_grab'    THEN 3
     WHEN 't_mindef'  THEN 2
     ELSE 0
   END) g
WHERE c.tenant_id IN ('t_maybank','t_grab','t_mindef');

\echo ' >> control test runs seeded'

-- =====================================================================
-- 19. compliance.assessments + gaps + attestations
-- =====================================================================
-- One assessment per (hero tenant, top framework)
INSERT INTO compliance.assessments (tenant_id, framework_id, status, score, started_at, completed_at, next_due_at)
SELECT
  hero.tid,
  fw.fid,
  (ARRAY['complete','in-progress','complete','in-progress'])[1 + (idx % 4)]::compliance.assessment_status,
  (60 + (random() * 38))::numeric(5,2),
  now() - ((30 + (idx * 6)) * interval '1 day'),
  now() - ((idx * 2)        * interval '1 day'),
  now() + ((90 + idx * 5)   * interval '1 day')
FROM (VALUES
  ('t_maybank'), ('t_grab'), ('t_mindef'),
  ('t_singhealth'), ('t_govtech'), ('t_astar'), ('t_mediacorp'), ('t_singtel')
) AS hero(tid)
CROSS JOIN LATERAL (VALUES
  ('soc2', 1),
  ('iso-27001', 2),
  ('mas-trm', 3),
  ('nist-csf', 4),
  ('pci-dss-4', 5),
  ('gdpr', 6),
  ('dora', 7),
  ('eu-ai-act', 8)
) AS fw(fid, idx)
WHERE
  -- shallow tenants get only 2 assessments
  (hero.tid IN ('t_maybank','t_grab','t_mindef')) OR
  (idx <= 2);

-- gaps per assessment (~3 gaps each for hero, 0-1 for shallow)
INSERT INTO compliance.gaps (tenant_id, assessment_id, requirement_id, severity, remediation_plan, target_date)
SELECT
  a.tenant_id,
  a.id,
  r.id,
  (ARRAY['high','medium','medium','high','low','critical'])[1 + (g % 6)]::risk.severity,
  'Remediation: implement control, run test, capture evidence. ETA 30-60 days.',
  (now() + ((30 + g * 7) * interval '1 day'))::date
FROM compliance.assessments a
JOIN compliance.requirements r ON r.framework_id = a.framework_id
CROSS JOIN LATERAL generate_series(1,
  CASE WHEN a.tenant_id IN ('t_maybank','t_grab','t_mindef') THEN 3 ELSE 1 END) g
WHERE r.code LIKE '%-' || lpad(((abs(hashtext(a.id::text)) + g) % 30 + 1)::text, 3, '0')
ORDER BY a.id, r.id
LIMIT 600;

INSERT INTO compliance.attestations (tenant_id, framework_id, signed_at, valid_until, attestation_text)
SELECT
  a.tenant_id,
  a.framework_id,
  a.completed_at,
  a.completed_at + interval '365 days',
  'We attest that the in-scope systems comply with the relevant requirements as of the signing date.'
FROM compliance.assessments a
WHERE a.status = 'complete';

\echo ' >> compliance assessments + gaps + attestations seeded'

-- =====================================================================
-- 20. audit.engagements + findings + workpapers
-- =====================================================================
INSERT INTO audit.engagements (tenant_id, name, type, lead_auditor, opened_at, closed_at, scope, framework_id)
SELECT
  spec.tid,
  spec.eng,
  spec.kind::audit.engagement_type,
  spec.lead,
  now() - (spec.days_open * interval '1 day'),
  CASE WHEN spec.closed THEN now() - (spec.days_closed * interval '1 day') ELSE NULL END,
  spec.scope,
  spec.fid
FROM (VALUES
  -- Maybank: 12 engagements (mix internal/external/regulatory/customer)
  ('t_maybank','ISO 27001 Surveillance 2026','external','BDO Singapore', 120, false, NULL,  'Information Security Mgmt System', 'iso-27001'),
  ('t_maybank','SOC 2 Type II — H1 2026',   'external','EY',             95,  true,  20,    'Trust Services Criteria (Sec/Conf)','soc2'),
  ('t_maybank','MAS TRM Inspection 2026',   'regulatory','MAS Examiner', 60,  false, NULL,  'MAS TRM scope',                    'mas-trm'),
  ('t_maybank','PCI DSS 4.0 ROC',           'external','TrustWave',      150, true,  30,    'Cardholder Data Environment',      'pci-dss-4'),
  ('t_maybank','Internal Audit — Cloud',    'internal','Internal Audit Q1',80,true,  10,    'AWS production accounts',          'iso-27001'),
  ('t_maybank','Internal Audit — Vendors',  'internal','Internal Audit Q2',45,false, NULL,  'TPRM program review',              'iso-27001'),
  ('t_maybank','DORA Readiness 2026',       'internal','Internal Audit', 30,  false, NULL,  'EU DORA readiness',                'dora'),
  ('t_maybank','Customer Audit — DBS Pty',  'customer','DBS Procurement',25,  true,  5,     'Customer security review',         'soc2'),
  ('t_maybank','MAS Notice 655 Spot Check', 'regulatory','MAS Spot Team',7,   false, NULL,  'Outsourcing Notice spot inspection','mas-notice-655'),
  ('t_maybank','BCM Audit 2026',            'internal','Internal Audit', 65,  true,  20,    'BCM plan + tests',                 'iso-27001'),
  ('t_maybank','AI Model Audit',            'internal','Model Risk',     50,  false, NULL,  'AI/ML model risk review',          'eu-ai-act'),
  ('t_maybank','Privacy Audit',             'internal','DPO',            40,  true,  15,    'PDPA + GDPR readiness',            'gdpr'),
  -- Grab: a similar slate (10)
  ('t_grab','SOC 2 Type II — H1 2026',      'external','KPMG',           100, true,  18,    'Trust Services Criteria',          'soc2'),
  ('t_grab','MAS Inspection 2026',          'regulatory','MAS Examiner', 50,  false, NULL,  'GrabPay scope',                    'mas-trm'),
  ('t_grab','OJK Spot Check ID',            'regulatory','OJK',          15,  false, NULL,  'GrabPay Indonesia',                'ojk-1103'),
  ('t_grab','RBI Cyber Audit India',        'regulatory','RBI',          22,  false, NULL,  'Grab India platform',              'rbi-cyber'),
  ('t_grab','BNM RMiT Malaysia',            'regulatory','BNM',          12,  false, NULL,  'GrabPay Malaysia',                 'bnm-rmit'),
  ('t_grab','PCI DSS 4.0 ROC',              'external','Trustwave',      80,  true,  15,    'CDE — all regions',                'pci-dss-4'),
  ('t_grab','Internal Cloud Audit',         'internal','Internal Audit', 30,  false, NULL,  'AWS multi-region',                 'iso-27001'),
  ('t_grab','EU AI Act Readiness',          'internal','Model Risk',     20,  false, NULL,  'High-risk AI inventory',           'eu-ai-act'),
  ('t_grab','Privacy — multi-jurisdiction', 'internal','DPO',            40,  true,  10,    'PDPA / PIPL / GDPR',               'gdpr'),
  ('t_grab','Vendor Concentration Audit',   'internal','Internal Audit', 25,  true,  8,     'Tier-1 vendor concentration',      'iso-27001'),
  -- MINDEF: 4 engagements
  ('t_mindef','IM8 Compliance Audit',       'regulatory','GovTech',      45,  false, NULL,  'IM8 v9.0 scope',                   'im8'),
  ('t_mindef','ITSG-33 Sovereign Review',   'internal','Internal Audit', 30,  true,  10,    'Sovereign cloud controls',         'nist-80053'),
  ('t_mindef','BCM Sovereign Test',         'internal','BCM Team',       60,  true,  20,    'Sovereign DR test',                'iso-22301'),
  ('t_mindef','ISO 27001 Sovereign',        'external','BSI',            120, true,  30,    'Sovereign ISMS scope',             'iso-27001'),
  -- shallow tenants: one each
  ('t_singhealth','HIPAA + ISO Internal',   'internal','Internal Audit', 60,  true,  20, 'Combined audit',                      'iso-27001'),
  ('t_govtech','IM8 Audit',                 'regulatory','GovTech',      45,  false, NULL,'IM8 scope',                            'im8'),
  ('t_astar','Research Data Audit',         'internal','Internal Audit', 40,  true,  15, 'Research data',                       'iso-27001'),
  ('t_mediacorp','Privacy Audit',           'internal','DPO',            40,  true,  10, 'PDPA',                                'pdpa-sg'),
  ('t_singtel','SOC 2 + ISO',               'external','EY',             80,  true,  20, 'Combined audit',                      'soc2')
) AS spec(tid, eng, kind, lead, days_open, closed, days_closed, scope, fid);

-- findings: ~6-8 per Maybank engagement, fewer for others
INSERT INTO audit.findings (tenant_id, engagement_id, severity, title, description, due_at, status)
SELECT
  e.tenant_id,
  e.id,
  (ARRAY['high','high','medium','medium','medium','low','critical'])[1 + (g % 7)]::risk.severity,
  (ARRAY[
    'Privileged access review evidence stale (>120d)',
    'KMS key rotation overdue on prod buckets',
    'IAM policies overly permissive on prod role',
    'Branch protection disabled on critical repos',
    'No segregation of duties in payment release',
    'Tabletop exercise lessons not actioned',
    'Vendor SOC 2 missing for 4 Tier-1 vendors',
    'Logging gap on internal CRM',
    'Backup restore not tested in 9 months',
    'Privacy DPIA missing for new AI assistant'
  ])[1 + (g % 10)],
  'Auto-seeded finding. Owner accountable; remediation tracked via issue.',
  now() + ((30 + g * 7) * interval '1 day'),
  (ARRAY['open','open','open','closed','accepted-risk'])[1 + (g % 5)]::audit.finding_status
FROM audit.engagements e
CROSS JOIN LATERAL generate_series(1,
  CASE e.tenant_id
    WHEN 't_maybank' THEN 7
    WHEN 't_grab'    THEN 6
    WHEN 't_mindef'  THEN 4
    ELSE 2
  END) g;

INSERT INTO audit.workpapers (tenant_id, engagement_id, title, content_md)
SELECT
  e.tenant_id,
  e.id,
  e.name || ' — Workpaper ' || g,
  '# Workpaper' || E'\n\n' || '* Engagement: ' || e.name || E'\n' || '* Auditor: ' || e.lead_auditor || E'\n\n' || '## Procedures performed' || E'\n' || '- Sampled 25 evidence items' || E'\n' || '- Reviewed change tickets' || E'\n' || '- Interviewed control owner' || E'\n\n' || '## Conclusion' || E'\n' || 'Controls operating effectively with noted exceptions.'
FROM audit.engagements e
CROSS JOIN LATERAL generate_series(1,
  CASE e.tenant_id
    WHEN 't_maybank' THEN 3
    WHEN 't_grab'    THEN 2
    WHEN 't_mindef'  THEN 2
    ELSE 1
  END) g;

\echo ' >> audit engagements + findings + workpapers seeded'

-- =====================================================================
-- 21. policy.documents + versions + acknowledgements + exceptions
-- =====================================================================
INSERT INTO policy.documents (id, tenant_id, code, title, jurisdiction)
SELECT
  uuid_generate_v4(),
  spec.tid,
  upper(substr(spec.tid, 3, 4)) || '-POL-' || lpad(g::text, 3, '0'),
  (ARRAY[
    'Information Security Policy',         'Acceptable Use Policy',
    'Access Control Policy',               'Cryptography Policy',
    'Incident Response Policy',            'Business Continuity Policy',
    'Vendor Risk Management Policy',       'Privacy Policy',
    'AI Governance Policy',                'Data Classification Policy',
    'Change Management Policy',            'Vulnerability Management Policy',
    'Logging & Monitoring Policy',         'Backup & Recovery Policy',
    'Cloud Security Policy',               'Mobile Device Policy',
    'Outsourcing Policy (MAS 655)',        'ESG Reporting Policy'
  ])[1 + ((g-1) % 18)],
  CASE WHEN spec.tid = 't_grab' THEN 'APAC' ELSE 'SG' END
FROM (VALUES
  ('t_maybank',  18),
  ('t_grab',     18),
  ('t_mindef',   12),
  ('t_singhealth', 6),
  ('t_govtech',    8),
  ('t_astar',      4),
  ('t_mediacorp',  4),
  ('t_singtel',    8)
) AS spec(tid, n)
CROSS JOIN LATERAL generate_series(1, spec.n) g;

-- versions: 2 versions per Maybank policy (~36), similar for Grab/MINDEF
INSERT INTO policy.versions (tenant_id, document_id, version_no, content_md, status, effective_at)
SELECT
  d.tenant_id,
  d.id,
  'v' || v,
  '# ' || d.title || E'\n\nVersion v' || v || ' — auto-seeded content.' || E'\n\n' || '## Scope' || E'\n\nApplies to all in-scope systems and personnel.',
  CASE WHEN v = 2 THEN 'approved' ELSE 'retired' END::policy.version_status,
  now() - ((CASE WHEN v = 2 THEN 30 ELSE 365 END) * interval '1 day')
FROM policy.documents d
CROSS JOIN generate_series(1, 2) v
WHERE d.tenant_id IN ('t_maybank','t_grab','t_mindef');

-- Update current_version_id on documents to the v2 version
UPDATE policy.documents d SET current_version_id = v.id
FROM policy.versions v
WHERE v.document_id = d.id AND v.version_no = 'v2';

-- acknowledgements: 220 per hero tenant (~viewer users × subset of policies)
INSERT INTO policy.acknowledgements (tenant_id, version_id, user_id, acknowledged_at)
SELECT DISTINCT
  v.tenant_id,
  v.id,
  u.id,
  now() - ((random() * 60)::int * interval '1 day')
FROM policy.versions v
JOIN platform.users u ON u.tenant_id = v.tenant_id AND u.role = 'viewer'
WHERE v.status = 'approved'
  AND v.tenant_id IN ('t_maybank','t_grab','t_mindef')
  AND (abs(hashtext(v.id::text || u.id::text)) % 4) = 0;

-- a few policy exceptions
INSERT INTO policy.exceptions (tenant_id, document_id, requester_user_id, justification, granted, expires_at)
SELECT
  d.tenant_id,
  d.id,
  (SELECT id FROM platform.users WHERE tenant_id = d.tenant_id AND role = 'risk-owner' LIMIT 1),
  'Compensating control in place. Approved by CRO for 90 days.',
  (g % 2 = 0),
  now() + (60 * interval '1 day')
FROM policy.documents d
CROSS JOIN generate_series(1, 1) g
WHERE d.tenant_id IN ('t_maybank','t_grab','t_mindef')
  AND (abs(hashtext(d.id::text)) % 6) = 0;

\echo ' >> policy documents + versions + acks seeded'

-- =====================================================================
-- 22. vendor.* — vendors, contracts, questionnaires, responses,
-- 4th-parties, concentrations
-- =====================================================================
-- Maybank: 47 vendors. Grab: 89. MINDEF: 8. Shallow: 5 each.
INSERT INTO vendor.vendors (tenant_id, name, category, tier, criticality, hq_country, primary_contact_email, status, tags)
SELECT
  spec.tid,
  (ARRAY[
    'AWS','Microsoft','Google Cloud','Oracle','IBM','Salesforce','Snowflake','Databricks',
    'ServiceNow','Atlassian','Splunk','Datadog','New Relic','PagerDuty','Twilio','Stripe',
    'Adyen','Workday','SAP','Tableau','Power BI','Looker','Mongo Atlas','Confluent',
    'CrowdStrike','SentinelOne','Palo Alto','Cisco','Okta','Auth0','OneLogin','PingIdentity',
    'BitSight','SecurityScorecard','Vanta','Drata','Onetrust','TrustArc','Bitwarden','1Password',
    'GitHub','GitLab','Jira Service Mgmt','Notion','Slack','Zoom','Microsoft Teams',
    'Lacework','Wiz','Orca Security','Sysdig','Rapid7','Tenable','Qualys','HashiCorp',
    'Cloudflare','Akamai','Fastly','Imperva','F5','Zscaler','Netskope','Mimecast',
    'Proofpoint','KnowBe4','Anaplan','Coupa','Workiva','MetricStream','Archer',
    'IBM OpenPages','Solv FSL','NTT Data','Accenture','Deloitte Cyber','PwC',
    'KPMG','EY','Bain','BCG','McKinsey','Capgemini','Wipro','TCS','Infosys','HCL','Cognizant',
    'Maersk Logistics','DHL'
  ])[1 + ((g-1) % 89)] || ' — ' || spec.tid,
  (ARRAY['cloud','saas','consulting','managed-service','hardware','communications','security','data-platform'])[1 + (g % 8)],
  (ARRAY['1','2','2','3','3','4','1'])[1 + (g % 7)]::vendor.tier,
  (ARRAY['critical','high','high','medium','medium','low','critical'])[1 + (g % 7)]::vendor.criticality,
  (ARRAY['SG','SG','MY','ID','TH','IN','US','EU','HK'])[1 + (g % 9)],
  'contact' || g || '@vendor.example.com',
  (ARRAY['active','active','active','active','onboarding','offboarded'])[1 + (g % 6)]::vendor.status,
  jsonb_build_object('region',(ARRAY['SG','MY','ID','TH','IN','US','EU'])[1 + (g % 7)],'concentration_dim', (ARRAY['cloud','saas','region'])[1 + (g % 3)])
FROM (VALUES
  ('t_maybank',  47),
  ('t_grab',     89),
  ('t_mindef',    8),
  ('t_singhealth',5),
  ('t_govtech',   5),
  ('t_astar',     5),
  ('t_mediacorp', 5),
  ('t_singtel',   5)
) AS spec(tid, n)
CROSS JOIN LATERAL generate_series(1, spec.n) g;

-- One contract per vendor
INSERT INTO vendor.contracts (tenant_id, vendor_id, contract_no, value_sgd, starts_at, ends_at, renewal_window_days)
SELECT
  v.tenant_id,
  v.id,
  'CTR-' || upper(substr(v.tenant_id,3,4)) || '-' || lpad((row_number() OVER (PARTITION BY v.tenant_id ORDER BY v.created_at))::text, 5, '0'),
  (50000 + (random() * 2950000))::numeric(14,2),
  (now() - ((180 + (random() * 720))::int * interval '1 day'))::date,
  (now() + ((90 + (random() * 540))::int * interval '1 day'))::date,
  (ARRAY[30,60,90,120])[1 + (abs(hashtext(v.id::text)) % 4)]
FROM vendor.vendors v;

-- Questionnaires — one per vendor (47 Maybank), with responses
INSERT INTO vendor.questionnaires (tenant_id, vendor_id, template, status, sent_at, completed_at, score)
SELECT
  v.tenant_id,
  v.id,
  (ARRAY['SIG','CAIQ','Custom'])[1 + (abs(hashtext(v.id::text)) % 3)],
  (ARRAY['sent','in-progress','complete','complete','complete'])[1 + (abs(hashtext(v.id::text)) % 5)]::vendor.questionnaire_status,
  now() - ((30 + (abs(hashtext(v.id::text)) % 120)) * interval '1 day'),
  CASE WHEN abs(hashtext(v.id::text)) % 5 < 3 THEN now() - ((abs(hashtext(v.id::text)) % 30) * interval '1 day') ELSE NULL END,
  (60 + (abs(hashtext(v.id::text)) % 40))::numeric(5,2)
FROM vendor.vendors v
WHERE v.tenant_id IN ('t_maybank','t_grab','t_mindef');

-- 10 responses per questionnaire
INSERT INTO vendor.responses (tenant_id, questionnaire_id, question_code, response, confidence, answered_at)
SELECT
  q.tenant_id,
  q.id,
  'Q' || lpad(g::text, 3, '0'),
  (ARRAY['Yes','Yes','No','Partial','Not Applicable','Yes — see SOC 2 §4.2','Compensating control'])[1 + (g % 7)],
  (70 + (g * 3) % 30)::numeric(5,2),
  q.completed_at + (g * interval '5 minutes')
FROM vendor.questionnaires q
CROSS JOIN generate_series(1, 10) g
WHERE q.completed_at IS NOT NULL;

-- 4th parties: ~80 for Maybank
INSERT INTO vendor.fourth_parties (tenant_id, vendor_id, name, type, region, criticality)
SELECT
  v.tenant_id,
  v.id,
  (ARRAY['AWS','Stripe','Cloudflare','Twilio','SendGrid','Auth0','Datadog','Splunk','Snowflake','MongoDB Atlas'])[1 + (g % 10)] || ' (4P of ' || split_part(v.name,' ',1) || ')',
  (ARRAY['cloud','saas','processor','cloud'])[1 + (g % 4)],
  (ARRAY['SG','US','EU','MY','IN'])[1 + (g % 5)],
  (ARRAY['critical','high','medium','low'])[1 + (g % 4)]::vendor.criticality
FROM vendor.vendors v
CROSS JOIN LATERAL generate_series(1,
  CASE v.tenant_id
    WHEN 't_maybank' THEN 2
    WHEN 't_grab'    THEN 3
    WHEN 't_mindef'  THEN 1
    ELSE 0
  END) g;

-- Concentrations: 6 per hero tenant
INSERT INTO vendor.concentrations (tenant_id, dimension, key, vendor_count, exposure_sgd)
SELECT
  hero.tid,
  d.dim,
  d.key,
  d.vc,
  d.exp::numeric
FROM (VALUES ('t_maybank'), ('t_grab'), ('t_mindef')) hero(tid)
CROSS JOIN (VALUES
  ('cloud',     'AWS',                 18, 8400000),
  ('cloud',     'Azure',               9,  3200000),
  ('region',    'ap-southeast-1',      22, 11500000),
  ('region',    'ap-northeast-1',      7,  2800000),
  ('processor', 'Stripe',              4,  1200000),
  ('processor', 'Twilio',              3,  650000)
) d(dim, key, vc, exp);

\echo ' >> vendors + contracts + questionnaires + 4P + concentrations seeded'

-- =====================================================================
-- 23. privacy.* — RoPA, DPIAs, subject requests, breaches
-- =====================================================================
INSERT INTO privacy.processing_activities (tenant_id, code, name, controller, processor, purpose, lawful_basis, data_categories, retention_period, cross_border, jurisdictions)
SELECT
  hero.tid,
  upper(substr(hero.tid,3,4)) || '-ROPA-' || lpad(g::text, 3, '0'),
  (ARRAY[
    'Customer onboarding KYC',         'Marketing email campaigns',
    'Loan underwriting model',         'Customer support chats',
    'Mobile app analytics',            'Cookie consent management',
    'Card payment processing',         'Fraud detection',
    'Employee HR records',             'Recruitment pipeline',
    'Vendor due-diligence',            'Third-party API calls'
  ])[1 + ((g-1) % 12)],
  hero.tid,
  CASE WHEN g % 3 = 0 THEN 'AWS' ELSE NULL END,
  'Provide regulated financial service to customer',
  (ARRAY['contract','consent','legal-obligation','legitimate-interests'])[1 + (g % 4)],
  ARRAY['name','email','phone','address','financial']::text[],
  (ARRAY['7 years','5 years','1 year','retention by law'])[1 + (g % 4)],
  (g % 4 = 0),
  CASE WHEN g % 4 = 0 THEN ARRAY['SG','US','EU']::text[] ELSE ARRAY['SG']::text[] END
FROM (VALUES ('t_maybank'), ('t_grab'), ('t_mindef')) hero(tid)
CROSS JOIN generate_series(1, 12) g
WHERE NOT (hero.tid = 't_mindef' AND g % 4 = 0);  -- no cross-border for MINDEF

-- DPIAs: 8 per Maybank
INSERT INTO privacy.dpias (tenant_id, activity_id, status, residual_risk_severity, conducted_at, assessment)
SELECT
  pa.tenant_id,
  pa.id,
  (ARRAY['draft','approved','approved','in-review'])[1 + (g % 4)],
  (ARRAY['high','medium','medium','low','high'])[1 + (g % 5)]::risk.severity,
  now() - ((g * 14) * interval '1 day'),
  jsonb_build_object('mitigations', g + 2, 'residual_score', 30 + (g * 4))
FROM privacy.processing_activities pa
CROSS JOIN LATERAL generate_series(1, 1) g
WHERE pa.tenant_id IN ('t_maybank','t_grab','t_mindef')
  AND (abs(hashtext(pa.id::text)) % 3) = 0
LIMIT 24;

-- Subject requests (14 per hero)
INSERT INTO privacy.subject_requests (tenant_id, kind, requester_email, received_at, due_at, status, resolved_at)
SELECT
  hero.tid,
  (ARRAY['access','erasure','portability','objection','rectification'])[1 + (g % 5)]::privacy.request_kind,
  'subject' || g || '@example.com',
  now() - ((g * 4) * interval '1 day'),
  now() + ((30 - g * 2) * interval '1 day'),
  (ARRAY['received','in-progress','resolved','resolved','resolved'])[1 + (g % 5)]::privacy.request_status,
  CASE WHEN g % 5 > 1 THEN now() - ((g * 2) * interval '1 day') ELSE NULL END
FROM (VALUES ('t_maybank'), ('t_grab'), ('t_mindef')) hero(tid)
CROSS JOIN generate_series(1, 14) g;

-- 2 breaches per Maybank/Grab
INSERT INTO privacy.breaches (tenant_id, code, severity, occurred_at, detected_at, reported_at, affected_subjects, regulator_notified, root_cause)
SELECT
  hero.tid,
  upper(substr(hero.tid,3,4)) || '-BR-' || lpad(g::text, 3, '0'),
  (ARRAY['high','medium','high'])[1 + (g % 3)]::risk.severity,
  now() - ((g * 60) * interval '1 day'),
  now() - ((g * 60 - 2) * interval '1 day'),
  now() - ((g * 60 - 5) * interval '1 day'),
  500 + g * 1200,
  true,
  (ARRAY['Misconfigured access control','Phishing-led credential theft','Vendor breach upstream'])[1 + (g % 3)]
FROM (VALUES ('t_maybank'), ('t_grab')) hero(tid)
CROSS JOIN generate_series(1, 2) g;

\echo ' >> privacy seeded'

-- =====================================================================
-- 24. esg.* — metrics, disclosures, targets
-- =====================================================================
INSERT INTO esg.metrics (tenant_id, period, scope, category, metric, value, unit, framework)
SELECT
  hero.tid,
  p.period,
  (ARRAY['scope1','scope2','scope3'])[1 + (g % 3)],
  (ARRAY['energy','travel','cloud-compute','data-centre','procurement'])[1 + (g % 5)],
  (ARRAY['kWh consumed','tCO2e emitted','litres-of-fuel','GB egress','SaaS spend'])[1 + (g % 5)],
  ((100 + g * 17.4 + random() * 50)::numeric(18,4)),
  (ARRAY['kWh','tCO2e','L','GB','SGD'])[1 + (g % 5)],
  (ARRAY['GHG','CSRD','ISSB','TCFD'])[1 + (g % 4)]
FROM (VALUES ('t_maybank'), ('t_grab'), ('t_mindef')) hero(tid)
CROSS JOIN (VALUES ('2025-Q1'), ('2025-Q2'), ('2025-Q3'), ('2025-Q4'), ('2026-Q1')) p(period)
CROSS JOIN generate_series(1, 12) g;

INSERT INTO esg.disclosures (tenant_id, framework, period, status, published_at, content)
SELECT
  hero.tid,
  fw,
  '2025',
  'published',
  now() - interval '60 days',
  jsonb_build_object('summary','Annual disclosure','sections', 12)
FROM (VALUES ('t_maybank'), ('t_grab'), ('t_mindef')) hero(tid)
CROSS JOIN unnest(ARRAY['CSRD','ISSB','GHG','TCFD']) fw
WHERE NOT (hero.tid = 't_mindef' AND fw IN ('CSRD','ISSB'));

INSERT INTO esg.targets (tenant_id, framework, metric, baseline_value, baseline_period, target_value, target_period)
SELECT
  hero.tid,
  fw.fw,
  fw.metric,
  fw.baseline,
  '2024',
  fw.target,
  '2030'
FROM (VALUES ('t_maybank'), ('t_grab'), ('t_mindef')) hero(tid)
CROSS JOIN (VALUES
  ('GHG',  'Scope 1 tCO2e',  1200.0, 600.0),
  ('GHG',  'Scope 2 tCO2e',  4800.0, 1800.0),
  ('CSRD', 'Total energy GJ',82000.0,52000.0)
) AS fw(fw, metric, baseline, target)
WHERE NOT (hero.tid = 't_mindef' AND fw.fw = 'CSRD');

\echo ' >> ESG seeded'

-- =====================================================================
-- 25. ai_gov.* — models, model_risk, prompts_audit
-- =====================================================================
INSERT INTO ai_gov.models (tenant_id, name, kind, risk_tier, jurisdiction, eu_ai_act_class, iso_42001_status)
SELECT
  hero.tid,
  m.name,
  m.kind,
  m.tier::ai_gov.risk_tier,
  hero.juris,
  m.cls,
  m.iso::ai_gov.iso_42001_status
FROM (VALUES
  ('t_maybank', 'SG'),
  ('t_grab',    'APAC'),
  ('t_mindef',  'SG')
) hero(tid, juris)
CROSS JOIN (VALUES
  ('Credit Scoring Model',          'classifier','high',     'High-Risk',  'in-progress'),
  ('Customer Support LLM',          'llm',       'limited',  'Limited',    'compliant'),
  ('Fraud Detection Classifier',    'classifier','high',     'High-Risk',  'compliant'),
  ('Loan Pricing Regression',       'regression','high',     'High-Risk',  'in-progress'),
  ('Marketing Recommender',         'recommender','limited', 'Limited',    'compliant'),
  ('KYC Document Vision',           'vision',    'high',     'High-Risk',  'in-progress')
) AS m(name, kind, tier, cls, iso);

-- model_risk (2 per model)
INSERT INTO ai_gov.model_risk (tenant_id, model_id, risk_type, severity, mitigation)
SELECT
  m.tenant_id,
  m.id,
  (ARRAY['bias','hallucination','drift','explainability','privacy'])[1 + (g % 5)],
  (ARRAY['high','medium','medium','high','low'])[1 + (g % 5)]::risk.severity,
  'Quarterly review; SHAP analysis; HITL on edge cases.'
FROM ai_gov.models m
CROSS JOIN generate_series(1, 2) g;

-- prompts_audit: ~320 per Maybank, scaled down for others
INSERT INTO ai_gov.prompts_audit (tenant_id, model_id, prompt_redacted, response_redacted, tokens_in, tokens_out, cost_cents, captured_at)
SELECT
  m.tenant_id,
  m.id,
  '[REDACTED] customer asked about ' || (ARRAY['balance','interest rate','dispute','transfer fees','statement'])[1 + (g % 5)],
  '[REDACTED] response with explanation and CTA',
  120 + (g % 200),
  60 + (g % 180),
  ((120 + g % 200) * 0.05 + (60 + g % 180) * 0.15)::int,
  now() - ((g % 60) * interval '1 day') - ((g % 24) * interval '1 hour')
FROM ai_gov.models m
CROSS JOIN LATERAL generate_series(1,
  CASE m.tenant_id
    WHEN 't_maybank' THEN 53
    WHEN 't_grab'    THEN 38
    WHEN 't_mindef'  THEN 8
    ELSE 4
  END) g;

\echo ' >> AI governance seeded'

-- =====================================================================
-- 26. incident.* — incidents, timeline, postmortems
-- =====================================================================
INSERT INTO incident.incidents (tenant_id, code, severity, title, status, opened_at, contained_at, resolved_at, tags)
SELECT
  spec.tid,
  upper(substr(spec.tid,3,4)) || '-INC-' || lpad(g::text, 4, '0'),
  (ARRAY['sev1','sev2','sev2','sev3','sev3','sev4'])[1 + (g % 6)]::incident.severity,
  (ARRAY[
    'Payments gateway latency spike',
    'Suspicious login attempts from new geo',
    'Public S3 bucket misconfiguration',
    'DDoS on customer portal',
    'Database failover triggered',
    'Privileged role escalation alert',
    'AI assistant hallucination report',
    'Vendor outage propagated'
  ])[1 + (g % 8)] || ' #' || g,
  (ARRAY['open','contained','resolved','resolved','postmortem-done'])[1 + (g % 5)]::incident.status,
  now() - ((g * 6) * interval '1 day'),
  CASE WHEN g % 5 > 0 THEN now() - ((g * 6 - 1) * interval '1 day') ELSE NULL END,
  CASE WHEN g % 5 > 1 THEN now() - ((g * 6 - 2) * interval '1 day') ELSE NULL END,
  jsonb_build_object('source','seed','severity_score', (g * 7) % 10)
FROM (VALUES ('t_maybank', 14), ('t_grab', 12), ('t_mindef', 6)) AS spec(tid, n)
CROSS JOIN LATERAL generate_series(1, spec.n) g;

INSERT INTO incident.timeline_events (tenant_id, incident_id, ts, actor, event, source)
SELECT
  i.tenant_id,
  i.id,
  i.opened_at + (e * interval '15 minutes'),
  (ARRAY['SOC analyst','Incident Investigator agent','Control Tester agent','On-call SRE','Risk owner'])[1 + (e % 5)],
  (ARRAY[
    'Detected anomaly via SIEM rule SR-247',
    'Contained: revoked compromised credentials',
    'Engaged vendor support — ticket #12345',
    'Failover to DR region executed',
    'Investigation: pulled relevant logs (last 24h)',
    'Postmortem draft auto-generated',
    'Notified MAS via Notice 644 reporting'
  ])[1 + (e % 7)],
  (ARRAY['agent','human','system','agent','human'])[1 + (e % 5)]
FROM incident.incidents i
CROSS JOIN generate_series(1, 4) e;

INSERT INTO incident.postmortems (tenant_id, incident_id, root_cause_md, corrective_actions_md, drafted_by_agent_id, signed_off_at)
SELECT
  i.tenant_id,
  i.id,
  '## Root cause' || E'\n\nMisconfigured S3 bucket policy allowed list-objects from any principal.',
  '## Corrective actions' || E'\n\n1. Enable account-wide block-public-access' || E'\n' || '2. Add CI/CD policy gate to fail on public ACL.',
  'ag_incident',
  now() - interval '2 days'
FROM incident.incidents i
WHERE i.status = 'postmortem-done';

\echo ' >> incidents seeded'

-- =====================================================================
-- 27. issue.* — issues + actions
-- =====================================================================
INSERT INTO issue.issues (tenant_id, source, source_id, title, description, severity, status, due_at)
SELECT
  spec.tid,
  (ARRAY['audit','risk-treatment','incident','control-test','regulatory'])[1 + (g % 5)]::issue.source,
  upper(substr(spec.tid,3,4)) || '-SRC-' || lpad(g::text, 4, '0'),
  (ARRAY[
    'Privileged access review overdue',
    'Logging gap on internal CRM',
    'Backup restore not tested in 9 months',
    'Vendor SOC 2 missing for Tier-1 vendor',
    'KMS rotation overdue',
    'Branch protection disabled on critical repo',
    'AI DPIA missing for new feature',
    'Incident postmortem action overdue',
    'Vendor exit plan not documented',
    'Regulator change impact not assessed'
  ])[1 + (g % 10)] || ' (' || spec.tid || ' #' || g || ')',
  'Issue auto-seeded for demo. Owner accountable; tracked to closure.',
  (ARRAY['high','medium','medium','low','critical','high'])[1 + (g % 6)]::risk.severity,
  (ARRAY['open','open','in-progress','resolved','accepted-risk'])[1 + (g % 5)]::issue.status,
  now() + ((30 + g * 5) * interval '1 day')
FROM (VALUES ('t_maybank', 47), ('t_grab', 56), ('t_mindef', 18), ('t_singhealth', 6), ('t_govtech', 8), ('t_astar', 4), ('t_mediacorp', 3), ('t_singtel', 9)) AS spec(tid, n)
CROSS JOIN LATERAL generate_series(1, spec.n) g;

-- actions: ~2-3 per Maybank issue
INSERT INTO issue.actions (tenant_id, issue_id, description, due_at, status)
SELECT
  i.tenant_id,
  i.id,
  (ARRAY[
    'Engage control owner',
    'Capture evidence in vault',
    'Update remediation plan',
    'Review at next risk meeting',
    'Escalate to CRO',
    'Run agent-assisted check'
  ])[1 + (g % 6)],
  now() + ((10 + g * 3) * interval '1 day'),
  (ARRAY['not-started','in-progress','done'])[1 + (g % 3)]
FROM issue.issues i
CROSS JOIN LATERAL generate_series(1,
  CASE i.tenant_id
    WHEN 't_maybank' THEN 3
    WHEN 't_grab'    THEN 2
    WHEN 't_mindef'  THEN 2
    ELSE 1
  END) g;

\echo ' >> issues + actions seeded'

-- =====================================================================
-- 28. bcm.* — plans, bias, tests
-- =====================================================================
INSERT INTO bcm.plans (tenant_id, name, business_service, rto_minutes, rpo_minutes, last_tested_at, next_test_at)
SELECT
  hero.tid,
  'BCP — ' || svc,
  svc,
  (ARRAY[15, 60, 240, 720])[1 + (g % 4)],
  (ARRAY[5, 15, 60, 240])[1 + (g % 4)],
  now() - ((30 + g * 5) * interval '1 day'),
  now() + ((90 - g * 3) * interval '1 day')
FROM (VALUES ('t_maybank'), ('t_grab'), ('t_mindef')) hero(tid)
CROSS JOIN unnest(ARRAY[
  'Core Banking',
  'Payments',
  'Mobile App',
  'Internet Banking',
  'Treasury',
  'Trading',
  'Customer Support',
  'Data Warehouse'
]) WITH ORDINALITY t(svc, g);

INSERT INTO bcm.bias (tenant_id, plan_id, dependency_kind, name, criticality, downtime_tolerance_hours)
SELECT
  p.tenant_id,
  p.id,
  (ARRAY['people','tech','site','vendor'])[1 + (g % 4)],
  (ARRAY['CISO Team','AWS Region','Changi-S DC','Stripe','Okta','Splunk','Cloudflare'])[1 + (g % 7)],
  (ARRAY['critical','high','medium','low'])[1 + (g % 4)]::vendor.criticality,
  (ARRAY[1, 4, 8, 24])[1 + (g % 4)]
FROM bcm.plans p
CROSS JOIN LATERAL generate_series(1,
  CASE p.tenant_id
    WHEN 't_maybank' THEN 4
    WHEN 't_grab'    THEN 4
    WHEN 't_mindef'  THEN 3
    ELSE 1
  END) g;

INSERT INTO bcm.tests (tenant_id, plan_id, kind, conducted_at, result, lessons_md)
SELECT
  p.tenant_id,
  p.id,
  (ARRAY['tabletop','walkthrough','simulation','full-failover'])[1 + (g % 4)],
  now() - ((30 + g * 12) * interval '1 day'),
  (ARRAY['pass','pass','partial','fail'])[1 + (g % 4)]::bcm.test_result,
  '## Lessons learned' || E'\n\n- Update DR runbook' || E'\n' || '- Re-test in 90 days'
FROM bcm.plans p
CROSS JOIN LATERAL generate_series(1,
  CASE p.tenant_id
    WHEN 't_maybank' THEN 3
    WHEN 't_grab'    THEN 3
    WHEN 't_mindef'  THEN 2
    ELSE 0
  END) g;

\echo ' >> BCM seeded'

-- =====================================================================
-- 29. regwatch.* — changes + impact assessments + mappings
-- =====================================================================
INSERT INTO regwatch.changes (source_id, title, summary, published_at, effective_at, severity, detected_by_agent_id, raw)
SELECT
  spec.sid,
  spec.title || ' #' || g,
  'Auto-seeded summary of the regulatory change. Severity tagged by Regulatory Horizon agent.',
  now() - ((g * 3) * interval '1 day'),
  now() + ((90 - g * 2) * interval '1 day'),
  (ARRAY['high','medium','medium','low','critical'])[1 + (g % 5)]::risk.severity,
  'ag_regwatch',
  jsonb_build_object('source','seed','idx', g)
FROM (VALUES
  ('src_mas',   'MAS update'),
  ('src_apra',  'APRA prudential update'),
  ('src_eu',    'EU technical standard'),
  ('src_ojk',   'OJK regulation revision'),
  ('src_rbi',   'RBI cyber directive'),
  ('src_hkma',  'HKMA circular'),
  ('src_bnm',   'BNM policy update'),
  ('src_pdpc',  'PDPC clarification')
) spec(sid, title)
CROSS JOIN generate_series(1, 8) g;

-- Impact assessments (Maybank, Grab, MINDEF)
INSERT INTO regwatch.impact_assessments (tenant_id, change_id, framework_id, impact, gaps_opened, assessed_by_agent_id, assessed_at, notes)
SELECT
  hero.tid,
  c.id,
  (ARRAY['mas-trm','iso-27001','dora','gdpr','pci-dss-4'])[1 + (abs(hashtext(c.id::text)) % 5)],
  (ARRAY['high','medium','medium','low','none'])[1 + (abs(hashtext(hero.tid || c.id::text)) % 5)]::regwatch.impact,
  (abs(hashtext(c.id::text)) % 7),
  'ag_regwatch',
  c.published_at + interval '12 minutes',
  'Auto-seeded impact assessment.'
FROM (VALUES ('t_maybank'), ('t_grab'), ('t_mindef')) hero(tid)
CROSS JOIN regwatch.changes c
WHERE (abs(hashtext(hero.tid || c.id::text)) % 3) > 0
LIMIT 120;

\echo ' >> regwatch changes + impact assessments seeded'

-- =====================================================================
-- 30. integration.* — connectors + sync jobs + credentials
-- =====================================================================
INSERT INTO integration.connectors (tenant_id, kind, name, status, last_sync_at, config)
SELECT
  hero.tid,
  k.kind,
  k.name || ' — ' || hero.tid,
  (ARRAY['connected','connected','connected','degraded','disconnected'])[1 + (abs(hashtext(hero.tid || k.kind)) % 5)]::integration.status,
  now() - ((random() * 720)::int * interval '1 minute'),
  jsonb_build_object('region', hero.region)
FROM (VALUES
  ('t_maybank','ap-southeast-1'),
  ('t_grab','ap-southeast-1'),
  ('t_mindef','sg-sovereign')
) hero(tid, region)
CROSS JOIN (VALUES
  ('aws','AWS'),
  ('azure','Azure'),
  ('gcp','GCP'),
  ('okta','Okta'),
  ('jira','Jira'),
  ('m365','M365'),
  ('github','GitHub'),
  ('servicenow','ServiceNow'),
  ('slack','Slack'),
  ('splunk','Splunk')
) AS k(kind, name);

INSERT INTO integration.sync_jobs (tenant_id, connector_id, started_at, ended_at, status, records_ingested, errors)
SELECT
  c.tenant_id,
  c.id,
  now() - ((g * 6) * interval '1 hour'),
  now() - ((g * 6 - 1) * interval '1 hour'),
  (ARRAY['success','success','success','failed'])[1 + (g % 4)],
  100 + (g * 47) % 1500,
  CASE WHEN g % 4 = 3 THEN 1 + (g % 5) ELSE 0 END
FROM integration.connectors c
CROSS JOIN generate_series(1, 6) g;

INSERT INTO integration.credentials_meta (tenant_id, connector_id, key_id, scope, rotated_at)
SELECT
  c.tenant_id,
  c.id,
  'kid_' || substr(md5(c.id::text), 1, 12),
  'read-only',
  now() - ((random() * 90)::int * interval '1 day')
FROM integration.connectors c;

\echo ' >> integration connectors + sync jobs seeded'

-- =====================================================================
-- 31. workflow.* — definitions + executions + steps
-- =====================================================================
INSERT INTO workflow.definitions (tenant_id, name, description, steps, version, enabled)
SELECT
  hero.tid,
  w.name,
  w.descr,
  w.steps::jsonb,
  1,
  true
FROM (VALUES ('t_maybank'), ('t_grab'), ('t_mindef'), ('t_singhealth')) hero(tid)
CROSS JOIN (VALUES
  ('Vendor onboarding',
   'New vendor: parse SIG/CAIQ, score, route for approval',
   '[{"kind":"agent","ref":"ag_vendor","label":"Auto-fill SIG"},{"kind":"decision","label":"Risk score gate","requires_approval":true},{"kind":"manual","label":"Procurement signoff"}]'),
  ('Regulatory change triage',
   'On regulator change: tag impact, open gaps, notify owners',
   '[{"kind":"agent","ref":"ag_regwatch","label":"Tag impact"},{"kind":"agent","ref":"ag_mapper","label":"Map controls"},{"kind":"manual","label":"CRO review","requires_approval":true}]'),
  ('Audit pack assembly',
   'On audit event: assemble evidence pack',
   '[{"kind":"agent","ref":"ag_audit","label":"Assemble pack"},{"kind":"manual","label":"Lead auditor signoff","requires_approval":true}]'),
  ('Quarterly access review',
   'Pull entitlements; flag stale; route to managers',
   '[{"kind":"agent","ref":"ag_evidence","label":"Pull entitlements"},{"kind":"manual","label":"Manager review","requires_approval":true},{"kind":"agent","ref":"ag_evidence","label":"Seal evidence"}]')
) AS w(name, descr, steps);

-- ~200 executions
INSERT INTO workflow.executions (tenant_id, workflow_id, trigger, started_at, ended_at, status)
SELECT
  d.tenant_id,
  d.id,
  (ARRAY['cron','manual','event'])[1 + (g % 3)],
  now() - ((g * 8) * interval '1 hour'),
  now() - ((g * 8 - 1) * interval '1 hour'),
  (ARRAY['success','success','success','running','failed','halted'])[1 + (g % 6)]::workflow.execution_status
FROM workflow.definitions d
CROSS JOIN generate_series(1, 12) g;

INSERT INTO workflow.steps (tenant_id, execution_id, step_no, kind, ref_id, status, started_at, ended_at, output)
SELECT
  e.tenant_id,
  e.id,
  s,
  (ARRAY['agent','decision','manual'])[1 + (s % 3)]::workflow.step_kind,
  CASE WHEN s % 3 = 0 THEN 'ag_vendor' ELSE NULL END,
  (ARRAY['success','success','success','running','failed'])[1 + (s % 5)],
  e.started_at + (s * interval '5 minutes'),
  e.started_at + ((s + 1) * interval '5 minutes'),
  jsonb_build_object('idx', s)
FROM workflow.executions e
CROSS JOIN generate_series(1, 3) s;

\echo ' >> workflows seeded'

-- =====================================================================
-- 32. agent.runs (~20,000 across 90 days, weighted by agent type) +
-- agent.decisions (~30% of runs)
-- =====================================================================
-- We build a synthetic time-grid: for each (tenant, agent) we draw runs
-- per day from a Poisson-ish pool by using the per-agent multiplier.

WITH run_spec AS (
  SELECT * FROM (VALUES
    ('ag_evidence',  24),
    ('ag_tester',    24),
    ('ag_vendor',     3),
    ('ag_policy',     1),
    ('ag_regwatch',   4),
    ('ag_audit',      2),
    ('ag_fair',       6),
    ('ag_incident',   1),  -- rounded up from 0.5
    ('ag_mapper',     2),
    ('ag_board',      1)   -- rounded up from 0.1
  ) AS r(agent_id, runs_per_day)
),
tenants AS (
  SELECT * FROM (VALUES
    ('t_maybank',    1.0),
    ('t_grab',       0.9),
    ('t_mindef',     0.45),
    ('t_singhealth', 0.10),
    ('t_govtech',    0.15),
    ('t_astar',      0.08),
    ('t_mediacorp',  0.06),
    ('t_singtel',    0.20)
  ) AS t(tid, scale)
)
INSERT INTO agent.runs (tenant_id, agent_id, trigger, started_at, ended_at, status, input_summary, output_summary, tools_called, cost_cents, latency_ms, context)
SELECT
  t.tid,
  rs.agent_id,
  (ARRAY['cron','cron','cron','manual','event'])[1 + (g % 5)]::agent.run_trigger,
  ts_start,
  ts_start + ((400 + (abs(hashtext(t.tid || rs.agent_id || g::text)) % 12000)) * interval '1 millisecond'),
  (ARRAY['success','success','success','success','success','success','failed','halted','awaiting-approval'])[1 + (abs(hashtext(t.tid || rs.agent_id || g::text)) % 9)]::agent.run_status,
  (ARRAY[
    'Pull S3 inventory',          'Eval AWS Config rule',
    'Parse vendor SIG',            'Generate policy draft',
    'Scan MAS feed',              'Assemble auditor pack',
    'Run FAIR Monte Carlo',       'Build incident timeline',
    'Map control to frameworks',  'Generate board narrative'
  ])[1 + (abs(hashtext(rs.agent_id)) % 10)],
  (ARRAY[
    'Pulled 247 buckets',         'Eval: 38 pass / 2 fail',
    'SIG auto-filled (82% conf)', 'Drafted v2 (3,400 tokens)',
    'Detected 3 new items',       'Pack assembled (8s)',
    'ALE = $1.4M, P95 = $3.2M',   'Timeline reconstructed (148 evts)',
    'Mapped to 14 frameworks',    'Generated 1-page summary'
  ])[1 + (abs(hashtext(rs.agent_id)) % 10)],
  ARRAY['aws.api','llm','db.write']::text[],
  (rs.runs_per_day * 8)::int,
  120 + (abs(hashtext(t.tid || rs.agent_id || g::text)) % 12000),
  jsonb_build_object('seed_idx', g)
FROM tenants t
CROSS JOIN run_spec rs
CROSS JOIN LATERAL generate_series(1, GREATEST(1, (rs.runs_per_day * 90 * t.scale * 4 / 5)::int)) g  -- sample 4/5 to hit ~20k total
CROSS JOIN LATERAL (
  SELECT now() - ((random() * 90 * 86400)::int * interval '1 second') AS ts_start
) ts;

\echo ' >> agent runs seeded'

-- decisions: 30% sample of runs that are 'success' or 'awaiting-approval'
INSERT INTO agent.decisions (tenant_id, agent_id, run_id, decision_type, input, output, confidence, outcome, decided_at)
SELECT
  r.tenant_id,
  r.agent_id,
  r.id,
  (ARRAY['auto-evaluate','auto-fill','auto-tag','recommend','assess'])[1 + (r.id::bigint % 5)],
  jsonb_build_object('summary', r.input_summary),
  jsonb_build_object('summary', r.output_summary, 'confidence', 0.7 + random() * 0.3),
  (0.6 + random() * 0.4)::numeric(5,4),
  (ARRAY['auto-approved','auto-approved','auto-approved','awaiting-hitl','hitl-approved','hitl-rejected'])[1 + (r.id::bigint % 6)]::agent.decision_outcome,
  r.started_at + interval '15 seconds'
FROM agent.runs r
WHERE r.status IN ('success','awaiting-approval')
  AND (r.id::bigint % 10) < 3;

\echo ' >> agent decisions seeded'

-- =====================================================================
-- 33. agent.cost_ledger — 8 tenants × 10 agents × 90 days = 7,200 rows
-- =====================================================================
INSERT INTO agent.cost_ledger (tenant_id, agent_id, ts, runs, cost_cents, fte_saved_hours)
SELECT
  t.tid,
  a.id,
  (now() - (d * interval '1 day'))::timestamptz,
  -- runs per day per agent — scaled per tenant
  GREATEST(0, ((CASE a.id
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
   END) * t.scale + (random() * 4 - 2))::int),
  ((CASE a.id
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
   END) * t.scale * a.cost_per_run_cents)::int,
  -- FTE saved hours per day (small fraction)
  (a.fte_equivalent * t.scale * 8 / 30)::numeric(8,2)
FROM agent.agents a
CROSS JOIN (VALUES
  ('t_maybank',    1.0),
  ('t_grab',       0.9),
  ('t_mindef',     0.45),
  ('t_singhealth', 0.10),
  ('t_govtech',    0.15),
  ('t_astar',      0.08),
  ('t_mediacorp',  0.06),
  ('t_singtel',    0.20)
) AS t(tid, scale)
CROSS JOIN generate_series(0, 89) d;

-- agent.telemetry (small per-agent rollup, daily, last 30 days, 5 metrics)
INSERT INTO agent.telemetry (agent_id, ts, metric, value)
SELECT
  a.id,
  now() - (d * interval '1 day'),
  m.metric,
  CASE m.metric
    WHEN 'runs'         THEN (50 + (random() * 250))::numeric
    WHEN 'errors'       THEN (random() * 8)::numeric
    WHEN 'latency_p50'  THEN (180 + random() * 400)::numeric
    WHEN 'latency_p95'  THEN (800 + random() * 2400)::numeric
    WHEN 'cost_cents'   THEN (a.cost_per_run_cents * (50 + random() * 250))::numeric
  END
FROM agent.agents a
CROSS JOIN generate_series(0, 29) d
CROSS JOIN unnest(ARRAY['runs','errors','latency_p50','latency_p95','cost_cents']) m(metric);

\echo ' >> agent cost ledger + telemetry seeded'

-- =====================================================================
-- 34. platform.audit_log (hash-chained, ~last 30 days)
-- =====================================================================
WITH events AS (
  SELECT
    t.tid AS tenant_id,
    now() - ((g * 17) * interval '1 minute') AS ts,
    (ARRAY['admin@example.sg','risk@example.sg','agent-runner','viewer@example.sg'])[1 + (g % 4)] AS actor,
    (ARRAY['login','export.report','policy.publish','agent.run','vendor.questionnaire.complete','evidence.seal','risk.update','incident.open'])[1 + (g % 8)] AS action,
    (ARRAY['cockpit','ISO 27001 pack','Information Security Policy v2','ag_evidence','vendor:Stripe','evidence:item','risk:R-001','INC-0001'])[1 + (g % 8)] AS target,
    (ARRAY['success','success','success','success','success','failure','denied','success'])[1 + (g % 8)] AS result,
    g AS idx
  FROM (VALUES ('t_maybank'),('t_grab'),('t_mindef')) t(tid)
  CROSS JOIN generate_series(1, 80) g
)
INSERT INTO platform.audit_log (ts, tenant_id, actor_email, action, target, result, metadata, prev_hash, row_hash)
SELECT
  ts, tenant_id, actor, action, target, result,
  jsonb_build_object('seed_idx', idx),
  lag(md5(tenant_id || actor || action || target)) OVER (PARTITION BY tenant_id ORDER BY ts),
  md5(coalesce(lag(md5(tenant_id || actor || action || target)) OVER (PARTITION BY tenant_id ORDER BY ts), '') || tenant_id || actor || action || target || ts::text)
FROM events;

\echo ' >> audit_log seeded'

-- =====================================================================
-- 35. HERO "wow path" rows — these MUST land at the top of any
--     "most-recent" query. Inserted last so any defaults pick up
--     newer timestamps cleanly.
-- =====================================================================

-- 35.1 — Regulatory Horizon: MAS Notice 655 update, 11 minutes ago
INSERT INTO regwatch.changes (id, source_id, title, summary, published_at, effective_at, severity, detected_by_agent_id, raw)
VALUES (
  '99999999-aaaa-bbbb-cccc-000000000001',
  'src_mas',
  'MAS Notice 655 update — Outsourcing (HERO)',
  'MAS has issued an update to Notice 655 introducing stricter requirements on cross-border outsourcing, exit plans, and concentration risk reporting. Effective 90 days from publication.',
  now() - interval '11 minutes',
  now() + interval '90 days',
  'high'::risk.severity,
  'ag_regwatch',
  '{"section":"3.2","change":"new requirements on exit plans"}'::jsonb
);

INSERT INTO regwatch.impact_assessments (id, tenant_id, change_id, framework_id, impact, gaps_opened, assessed_by_agent_id, assessed_at, notes)
VALUES (
  '99999999-aaaa-bbbb-cccc-000000000002',
  't_maybank',
  '99999999-aaaa-bbbb-cccc-000000000001',
  'mas-notice-655',
  'high'::regwatch.impact,
  7,
  'ag_regwatch',
  now() - interval '8 minutes',
  'HERO: 7 new control gaps opened. Control Mapper to assign owners. Policy Drafter to draft Outsourcing Policy amendment.'
);

-- 35.2 — Maybank: ONE risk with residual jumped in last 24h + linked FAIR run ≈ $4.2M
INSERT INTO risk.risks (
  id, tenant_id, register_id, code, title, description, category,
  inherent_severity, inherent_likelihood, residual_severity, residual_likelihood,
  status, treatment_strategy, last_assessed_at, business_service, tags
) VALUES (
  '99999999-bbbb-cccc-dddd-000000000001',
  't_maybank',
  '11111111-1111-1111-1111-111111111111',
  'R-MAYB-HERO',
  'HERO — Cross-border outsourcing concentration risk',
  'Concentration on Tier-1 cloud provider in single region creates regulatory and resilience exposure. Residual elevated after MAS Notice 655 update.',
  'regulatory',
  'critical'::risk.severity, 'likely'::risk.likelihood,
  'high'::risk.severity,     'possible'::risk.likelihood,
  'assessed'::risk.status, 'mitigate'::risk.treatment_strategy,
  now() - interval '4 hours',
  'Core Banking',
  '{"hero":true,"elevated_in_last_24h":true}'::jsonb
);

INSERT INTO risk.scenarios (id, tenant_id, risk_id, name, description, frequency_dist, magnitude_dist)
VALUES (
  '99999999-bbbb-cccc-dddd-000000000002',
  't_maybank',
  '99999999-bbbb-cccc-dddd-000000000001',
  'HERO — Cross-border outsourcing failure (MAS 655 trigger)',
  'FAIR scenario aligned to MAS Notice 655 update. Loss = regulatory fine + remediation + reputational.',
  '{"kind":"beta-pert","min":0.4,"mode":1.2,"max":3.6}'::jsonb,
  '{"kind":"lognormal","mean":2200000,"stdev":1100000}'::jsonb
);

INSERT INTO risk.fair_runs (tenant_id, scenario_id, trials, lec_percentiles, ale_sgd, aro, run_at)
VALUES (
  't_maybank',
  '99999999-bbbb-cccc-dddd-000000000002',
  10000,
  '{"p10":380000,"p25":1100000,"p50":2200000,"p75":4800000,"p90":8200000,"p95":12400000,"p99":24000000}'::jsonb,
  4200000.00,
  1.7,
  now() - interval '3 hours'
);

-- 35.3 — Control Tester: 3 recent failed test_runs against AWS encryption controls (last hour)
-- Pick first 3 maybank controls that hint at encryption
WITH enc_controls AS (
  SELECT id FROM control.library
  WHERE tenant_id = 't_maybank'
    AND (title ILIKE '%encryption%' OR title ILIKE '%KMS%')
  ORDER BY id
  LIMIT 3
)
INSERT INTO control.test_runs (tenant_id, control_id, ran_at, result, notes, duration_ms)
SELECT
  't_maybank',
  id,
  now() - ((row_number() OVER ()) * interval '12 minutes'),
  'fail'::control.test_result,
  'HERO — AWS encryption control failed: KMS rotation not enforced on production buckets.',
  280 + (random() * 800)::int
FROM enc_controls;

-- 35.4 — Evidence Collector: 47 evidence.items collected in the last hour for Maybank
INSERT INTO evidence.items (tenant_id, collector_id, control_id, kind, title, source_url, blob_url, captured_at, metadata)
SELECT
  't_maybank',
  (SELECT id FROM evidence.collectors WHERE tenant_id = 't_maybank' AND kind = 'aws' LIMIT 1),
  (SELECT id FROM control.library WHERE tenant_id = 't_maybank' ORDER BY code OFFSET (g % 80) LIMIT 1),
  (ARRAY['config','log','api-response','scan-result'])[1 + (g % 4)]::evidence.kind,
  'HERO — Evidence ' || g || ' (AWS, last hour)',
  'https://evidence.example.sg/t_maybank/hero/' || g,
  's3://grc-evidence/t_maybank/hero/' || g || '.bin',
  now() - ((g) * interval '78 seconds'),
  jsonb_build_object('hero', true, 'idx', g)
FROM generate_series(1, 47) g;

-- Seal the hero evidence items too (compute chain extending tenant's prior chain)
INSERT INTO evidence.seals (item_id, prev_hash, row_hash, sealed_at)
SELECT
  i.id,
  lag(md5(i.tenant_id || i.id::text || coalesce(i.title,''))) OVER (ORDER BY i.captured_at, i.id),
  md5(coalesce(lag(md5(i.tenant_id || i.id::text || coalesce(i.title,''))) OVER (ORDER BY i.captured_at, i.id),'') || i.tenant_id || i.id::text || coalesce(i.title,'')),
  i.captured_at
FROM evidence.items i
WHERE i.tenant_id = 't_maybank'
  AND i.title LIKE 'HERO — Evidence%'
  AND NOT EXISTS (SELECT 1 FROM evidence.seals s WHERE s.item_id = i.id);

\echo ' >> HERO wow-path rows seeded'

-- =====================================================================
-- 36. Final summary
-- =====================================================================
\echo ''
\echo ' >> seed complete. Row counts:'
SELECT 'tenants'         AS table, count(*) FROM platform.tenants
UNION ALL SELECT 'users',          count(*) FROM platform.users
UNION ALL SELECT 'frameworks',     count(*) FROM compliance.frameworks
UNION ALL SELECT 'requirements',   count(*) FROM compliance.requirements
UNION ALL SELECT 'agents',         count(*) FROM agent.agents
UNION ALL SELECT 'agent_runs',     count(*) FROM agent.runs
UNION ALL SELECT 'agent_decisions',count(*) FROM agent.decisions
UNION ALL SELECT 'cost_ledger',    count(*) FROM agent.cost_ledger
UNION ALL SELECT 'risks',          count(*) FROM risk.risks
UNION ALL SELECT 'fair_runs',      count(*) FROM risk.fair_runs
UNION ALL SELECT 'controls',       count(*) FROM control.library
UNION ALL SELECT 'control_mappings',count(*) FROM control.mappings
UNION ALL SELECT 'test_runs',      count(*) FROM control.test_runs
UNION ALL SELECT 'evidence',       count(*) FROM evidence.items
UNION ALL SELECT 'evidence_seals', count(*) FROM evidence.seals
UNION ALL SELECT 'audit_engagements',count(*) FROM audit.engagements
UNION ALL SELECT 'audit_findings', count(*) FROM audit.findings
UNION ALL SELECT 'policies',       count(*) FROM policy.documents
UNION ALL SELECT 'vendors',        count(*) FROM vendor.vendors
UNION ALL SELECT 'questionnaires', count(*) FROM vendor.questionnaires
UNION ALL SELECT 'incidents',      count(*) FROM incident.incidents
UNION ALL SELECT 'issues',         count(*) FROM issue.issues
UNION ALL SELECT 'regwatch_changes',count(*) FROM regwatch.changes
UNION ALL SELECT 'connectors',     count(*) FROM integration.connectors;

\echo ' >> NTT GRC Hub seed complete.'
