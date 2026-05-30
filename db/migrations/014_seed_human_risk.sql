-- Migration 014: Seed human_risk tables for hero tenants
-- Without this, all human risk queries fall back to mock data in pg mode.

-- Org-level risk scores
INSERT INTO human_risk.org_scores
  (tenant_id, org_risk_score, org_risk_score_12m_ago, phish_prone_pct, phish_prone_pct_12m_ago,
   industry_phish_prone_pct, training_completion_pct, headcount,
   users_at_high_risk, users_at_critical_risk, campaigns_run_12m, reporting_rate_pct,
   risk_level, risk_score_history)
VALUES
  ('t_maybank', 45, 58, 8.4, 14.2, 11.0, 87.3, 22400,  420, 38, 8, 34.1, 'moderate',
   '[58,55,52,50,49,47,46,45]'::jsonb),
  ('t_grab',    38, 49, 6.1, 10.8,  9.5, 91.2, 8500,   140, 12, 6, 41.8, 'low',
   '[49,46,44,42,40,39,38,38]'::jsonb),
  ('t_mindef',  22, 31, 3.2,  5.9,  8.0, 96.8, 3200,    42,  4, 12, 58.3, 'low',
   '[31,28,26,25,24,23,22,22]'::jsonb)
ON CONFLICT (tenant_id) DO UPDATE SET
  org_risk_score           = EXCLUDED.org_risk_score,
  org_risk_score_12m_ago   = EXCLUDED.org_risk_score_12m_ago,
  phish_prone_pct          = EXCLUDED.phish_prone_pct,
  phish_prone_pct_12m_ago  = EXCLUDED.phish_prone_pct_12m_ago,
  industry_phish_prone_pct = EXCLUDED.industry_phish_prone_pct,
  training_completion_pct  = EXCLUDED.training_completion_pct,
  headcount                = EXCLUDED.headcount,
  users_at_high_risk       = EXCLUDED.users_at_high_risk,
  users_at_critical_risk   = EXCLUDED.users_at_critical_risk,
  campaigns_run_12m        = EXCLUDED.campaigns_run_12m,
  reporting_rate_pct       = EXCLUDED.reporting_rate_pct,
  risk_level               = EXCLUDED.risk_level,
  risk_score_history       = EXCLUDED.risk_score_history,
  synced_at                = now();

-- FAIR quantification
INSERT INTO human_risk.quant
  (tenant_id, aro, per_incident_mean_sgd, per_incident_stdev_sgd, ale_sgd, ale_sgd_12m_ago,
   ale_reduced_sgd, risk_id, scenario_id)
VALUES
  ('t_maybank', 0.78, 1250000, 420000, 975000, 1840000, 865000,
   'rsk_maybank_phishing_ale', 'scn_cred_exfil'),
  ('t_grab',    0.52, 680000,  210000, 353600,  820000,  466400,
   'rsk_grab_phishing_ale',    'scn_cred_exfil'),
  ('t_mindef',  0.21, 2100000, 650000, 441000, 1050000,  609000,
   'rsk_mindef_phishing_ale',  'scn_insider_threat')
ON CONFLICT (tenant_id) DO UPDATE SET
  aro                    = EXCLUDED.aro,
  per_incident_mean_sgd  = EXCLUDED.per_incident_mean_sgd,
  per_incident_stdev_sgd = EXCLUDED.per_incident_stdev_sgd,
  ale_sgd                = EXCLUDED.ale_sgd,
  ale_sgd_12m_ago        = EXCLUDED.ale_sgd_12m_ago,
  ale_reduced_sgd        = EXCLUDED.ale_reduced_sgd,
  computed_at            = now();

-- Departments (6 per hero tenant)
INSERT INTO human_risk.departments
  (tenant_id, department, headcount, avg_risk_score, risk_level, phish_prone_pct, training_completion_pct, high_risk_users)
VALUES
  ('t_maybank', 'Technology',           3800, 41, 'moderate', 7.2,  89.1, 68),
  ('t_maybank', 'Retail Banking',       6200, 48, 'moderate', 9.8,  84.5, 112),
  ('t_maybank', 'Risk & Compliance',     420, 28, 'low',      4.1,  96.2,  8),
  ('t_maybank', 'Finance',              1100, 44, 'moderate', 8.3,  88.0, 22),
  ('t_maybank', 'Operations',           4800, 51, 'moderate', 10.2, 82.3, 98),
  ('t_maybank', 'Human Resources',       380, 38, 'low',      6.9,  92.0, 12),
  ('t_grab',    'Engineering',          2800, 33, 'low',      5.4,  93.4, 42),
  ('t_grab',    'Operations',           3100, 42, 'moderate', 7.1,  89.8, 68),
  ('t_grab',    'Finance',               620, 36, 'low',      5.8,  92.1, 10),
  ('t_grab',    'People & Culture',      380, 29, 'low',      3.9,  95.2,  6),
  ('t_grab',    'Product',               900, 35, 'low',      5.1,  91.7, 14),
  ('t_grab',    'Risk & Compliance',     220, 24, 'low',      2.8,  97.8,  0),
  ('t_mindef',  'IT & Cyber',            480, 18, 'low',      2.1,  98.4,  4),
  ('t_mindef',  'Operations',           1200, 24, 'low',      3.8,  96.2, 16),
  ('t_mindef',  'Intelligence',          280, 20, 'low',      2.4,  97.9,  6),
  ('t_mindef',  'Logistics',             640, 26, 'low',      4.2,  95.8, 12),
  ('t_mindef',  'Finance & Procurement', 360, 22, 'low',      3.1,  97.1,  4),
  ('t_mindef',  'Legal & Compliance',    240, 17, 'low',      1.8,  99.2,  0)
ON CONFLICT (tenant_id, department) DO UPDATE SET
  headcount               = EXCLUDED.headcount,
  avg_risk_score          = EXCLUDED.avg_risk_score,
  risk_level              = EXCLUDED.risk_level,
  phish_prone_pct         = EXCLUDED.phish_prone_pct,
  training_completion_pct = EXCLUDED.training_completion_pct,
  high_risk_users         = EXCLUDED.high_risk_users,
  synced_at               = now();

-- Phishing campaigns (last 12 months, 2 per tenant)
INSERT INTO human_risk.phishing_campaigns
  (id, tenant_id, name, template, difficulty, sent_at, recipients, delivered,
   opened, clicked, data_entered, reported, phish_prone_pct, status)
VALUES
  ('phish_maybank_q4_2025', 't_maybank', 'Q4 2025 Credential Harvest Simulation', 'Bank login page replica', 3,
   now() - interval '60 days',  22400, 21980, 8120, 1884, 312, 7410, 8.4,  'closed'),
  ('phish_maybank_q1_2026', 't_maybank', 'Q1 2026 CEO Gift Card Scam',             'Executive impersonation', 2,
   now() - interval '10 days',  22400, 22100, 6420, 1420, 180, 8200, 6.4,  'closed'),
  ('phish_grab_q4_2025',    't_grab',    'Q4 2025 IT Security Alert',               'Fake IT helpdesk alert', 2,
   now() - interval '55 days',  8500,  8390, 2900,  518,  74, 3220, 6.1,  'closed'),
  ('phish_grab_q1_2026',    't_grab',    'Q1 2026 DocuSign Link',                   'E-signature phish',      3,
   now() - interval '8 days',   8500,  8440, 2100,  380,  44, 3580, 4.5,  'closed'),
  ('phish_mindef_q4_2025',  't_mindef',  'Q4 2025 Security Awareness Check',        'Classified doc lure',    4,
   now() - interval '50 days',  3200,  3180,  640,   98,  10, 1920, 3.1,  'closed'),
  ('phish_mindef_q1_2026',  't_mindef',  'Q1 2026 MFA Fatigue Simulation',          'Push notification spam', 4,
   now() - interval '5 days',   3200,  3190,  520,   68,   6, 1980, 2.1,  'closed')
ON CONFLICT (id) DO NOTHING;

-- Training campaigns
INSERT INTO human_risk.training_campaigns
  (id, tenant_id, name, content_type, framework_ref, enrolled, completed,
   completion_pct, pass_rate, due_at, status)
VALUES
  ('train_maybank_aw_2025',  't_maybank', 'Annual Security Awareness 2025',      'interactive', 'MAS-TRM-10',    22400, 19530, 87.2, 92.1, now() - interval '30 days',  'completed'),
  ('train_maybank_phi_2025', 't_maybank', 'Phishing Simulation Debrief Q4 2025', 'video',       NULL,            1884,  1720,  91.3, 88.4, now() - interval '45 days',  'completed'),
  ('train_maybank_pri_2026', 't_maybank', 'PDPA Refresher 2026',                 'assessment',  'PDPA-2012',     22400, 18940, 84.6, 89.3, now() + interval '30 days',  'active'),
  ('train_grab_aw_2025',     't_grab',    'Annual Security Awareness 2025',      'interactive', 'MAS-TRM-10',    8500,  7750,  91.2, 93.8, now() - interval '25 days',  'completed'),
  ('train_grab_phi_2025',    't_grab',    'Phishing Debrief Q4 2025',            'video',       NULL,            518,   490,   94.6, 90.2, now() - interval '40 days',  'completed'),
  ('train_mindef_sec_2025',  't_mindef',  'Annual Cyber Security Training 2025', 'interactive', 'ISO-27001',     3200,  3098,  96.8, 98.1, now() - interval '20 days',  'completed'),
  ('train_mindef_class_2026','t_mindef',  'Classified Data Handling 2026',       'policy-ack',  'OFFSEC-2024',   3200,  3010,  94.1, 99.2, now() + interval '60 days',  'active')
ON CONFLICT (id) DO NOTHING;

-- High-risk user samples (20 per hero tenant)
INSERT INTO human_risk.users
  (id, tenant_id, name, email, department, job_title, risk_score, risk_level,
   risk_score_30d_delta, phishing_sent, phishing_clicked, phishing_reported,
   phishing_data_entered, last_phish_result, training_assigned, training_completed,
   training_completion_pct, mfa_enabled, privileged_access)
SELECT
  'hru_' || t.tid || '_' || g.n,
  t.tid,
  (ARRAY['Ahmad Bin','Wei Ling','Priya','Ravi','Sarah','James','Maria','Kevin','Nurul','Tan Ah'])[((g.n-1) % 10) + 1] || ' ' ||
  (ARRAY['Hassan','Lim','Sharma','Kumar','Chen','Wong','Santos','Ng','Binte','Koh'])[((g.n + 3) % 10) + 1],
  'user' || g.n || '@' || t.domain,
  (ARRAY['Technology','Retail Banking','Operations','Finance','Human Resources'])[((g.n-1) % 5) + 1],
  (ARRAY['Analyst','Senior Analyst','Manager','Senior Manager','Director'])[((g.n-1) % 5) + 1],
  45 + ((g.n * 7) % 50),
  CASE WHEN (45 + ((g.n * 7) % 50)) > 75 THEN 'critical'
       WHEN (45 + ((g.n * 7) % 50)) > 60 THEN 'high'
       ELSE 'moderate' END,
  -(2 + (g.n % 8)),
  4 + (g.n % 4),
  1 + (g.n % 3),
  0 + (g.n % 2),
  CASE WHEN g.n % 5 = 0 THEN 1 ELSE 0 END,
  CASE WHEN g.n % 3 = 0 THEN 'data-entered' WHEN g.n % 2 = 0 THEN 'clicked' ELSE 'no-action' END,
  3, 2 + (g.n % 2), (66 + (g.n % 34))::int,
  CASE WHEN g.n % 8 = 0 THEN FALSE ELSE TRUE END,
  CASE WHEN g.n % 10 = 0 THEN TRUE ELSE FALSE END
FROM (VALUES ('t_maybank', 'maybank.com'), ('t_grab', 'grab.com'), ('t_mindef', 'mindef.gov.sg')) AS t(tid, domain)
CROSS JOIN generate_series(1, 20) AS g(n)
ON CONFLICT (id) DO NOTHING;

\echo ' >> human_risk seed data inserted'
