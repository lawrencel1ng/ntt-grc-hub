-- Migration 057: Add human_risk data for 5 small tenants.
-- Only Grab, Maybank, MINDEF have human_risk data; A*STAR, GovTech,
-- Mediacorp, SingHealth, Singtel have none — causing empty state in
-- all-tenant Human Risk view.
-- Adds org_scores, quant, departments, users (8 per tenant),
-- phishing_campaigns, and training_campaigns.
-- Idempotent: INSERT WHERE NOT EXISTS on unique keys.

-- =====================================================================
-- Part 1: org_scores
-- =====================================================================
INSERT INTO human_risk.org_scores
  (tenant_id, org_risk_score, org_risk_score_12m_ago, phish_prone_pct,
   phish_prone_pct_12m_ago, industry_phish_prone_pct, training_completion_pct,
   headcount, users_at_high_risk, users_at_critical_risk, campaigns_run_12m,
   reporting_rate_pct, risk_level, risk_score_history)
SELECT v.tenant_id, v.ors, v.ors12, v.ppp, v.ppp12, v.ippp, v.tcp,
       v.hc, v.uhr, v.ucr, v.crm, v.rrp, v.rl,
       to_jsonb(ARRAY[v.ors12, v.ors12 - 2, v.ors12 - 3, v.ors12 - 4,
                      v.ors, v.ors + 1, v.ors - 1, v.ors])
FROM (VALUES
  ('t_astar',    42, 54, 7.20::numeric(5,2),  12.40::numeric(5,2), 9.50::numeric(5,2),  88.00::numeric(5,2),  4200,  88,  6,  7, 31.50::numeric(5,2), 'moderate'),
  ('t_govtech',  38, 47, 6.10::numeric(5,2),  10.80::numeric(5,2), 9.50::numeric(5,2),  91.20::numeric(5,2),  8500,  72,  4,  9, 36.20::numeric(5,2), 'low'),
  ('t_mediacorp',51, 63, 9.30::numeric(5,2),  15.10::numeric(5,2), 11.00::numeric(5,2), 82.40::numeric(5,2),  3100, 110,  9,  6, 28.70::numeric(5,2), 'moderate'),
  ('t_singhealth',44,56, 7.80::numeric(5,2),  13.20::numeric(5,2), 10.50::numeric(5,2), 86.90::numeric(5,2), 14500, 198, 12,  8, 33.40::numeric(5,2), 'moderate'),
  ('t_singtel',  47, 58, 8.50::numeric(5,2),  14.00::numeric(5,2), 11.00::numeric(5,2), 85.30::numeric(5,2), 18000, 230, 15,  9, 30.10::numeric(5,2), 'moderate')
) AS v(tenant_id, ors, ors12, ppp, ppp12, ippp, tcp, hc, uhr, ucr, crm, rrp, rl)
WHERE NOT EXISTS (
  SELECT 1 FROM human_risk.org_scores s WHERE s.tenant_id = v.tenant_id
);

-- =====================================================================
-- Part 2: quant (ALE / ARO)
-- =====================================================================
INSERT INTO human_risk.quant
  (tenant_id, aro, per_incident_mean_sgd, per_incident_stdev_sgd,
   ale_sgd, ale_sgd_12m_ago, ale_reduced_sgd, risk_id, scenario_id)
SELECT v.tenant_id, v.aro, v.mean_sgd, v.stdev_sgd,
       v.ale, v.ale12, v.ale_r, v.risk_id, v.scn_id
FROM (VALUES
  ('t_astar',    0.45::numeric(10,4), 850000,  280000, 382500,  740000, 297500,
   'rsk_astar_phishing_ale',    'scn_astar_cred_exfil'),
  ('t_govtech',  0.35::numeric(10,4), 1100000, 380000, 385000,  720000, 308000,
   'rsk_govtech_phishing_ale',  'scn_govtech_cred_exfil'),
  ('t_mediacorp',0.60::numeric(10,4), 720000,  240000, 432000,  820000, 345600,
   'rsk_mediacorp_phishing_ale','scn_mediacorp_cred_exfil'),
  ('t_singhealth',0.55::numeric(10,4),980000,  320000, 539000, 1020000, 431200,
   'rsk_singhealth_phishing_ale','scn_singhealth_cred_exfil'),
  ('t_singtel',  0.62::numeric(10,4), 1350000, 450000, 837000, 1580000, 669600,
   'rsk_singtel_phishing_ale',  'scn_singtel_cred_exfil')
) AS v(tenant_id, aro, mean_sgd, stdev_sgd, ale, ale12, ale_r, risk_id, scn_id)
WHERE NOT EXISTS (
  SELECT 1 FROM human_risk.quant q WHERE q.tenant_id = v.tenant_id
);

-- =====================================================================
-- Part 3: departments
-- =====================================================================
INSERT INTO human_risk.departments
  (tenant_id, department, headcount, avg_risk_score, risk_level,
   phish_prone_pct, training_completion_pct, high_risk_users)
SELECT v.tenant_id, v.dept, v.hc, v.avg_rs, v.rl,
       v.ppp::numeric(5,2), v.tcp::numeric(5,2), v.hru
FROM (VALUES
  ('t_astar','Research & Technology',     2800, 39, 'low',      6.80, 91.20, 42),
  ('t_astar','Administration',             620, 46, 'moderate', 8.40, 84.50, 16),
  ('t_astar','Finance & Grants',           380, 33, 'low',      5.20, 93.00,  8),
  ('t_astar','HR & Corporate Services',    280, 41, 'moderate', 7.60, 88.70, 10),

  ('t_govtech','Engineering & Products', 4200, 35, 'low',      5.50, 93.80, 55),
  ('t_govtech','Operations & Support',   2400, 42, 'moderate', 7.90, 88.20, 72),
  ('t_govtech','Policy & Partnerships',   620, 31, 'low',      4.80, 95.10, 12),
  ('t_govtech','Corporate',               480, 37, 'low',      6.20, 91.50, 10),

  ('t_mediacorp','Content & Production', 1200, 54, 'moderate', 10.20, 79.60, 52),
  ('t_mediacorp','Technology',            680, 44, 'moderate',  8.10, 86.40, 28),
  ('t_mediacorp','Sales & Marketing',     520, 58, 'moderate', 11.30, 76.90, 38),
  ('t_mediacorp','Corporate Services',    380, 41, 'moderate',  7.50, 88.20, 14),

  ('t_singhealth','Clinical Operations', 9200, 42, 'moderate',  7.30, 88.60, 120),
  ('t_singhealth','Nursing',             3800, 46, 'moderate',  8.80, 84.20,  58),
  ('t_singhealth','Information Technology',680, 37, 'low',      6.10, 92.40,  14),
  ('t_singhealth','Admin & Finance',      680, 41, 'moderate',  7.40, 87.10,  18),

  ('t_singtel','Network & Technology',   7200, 43, 'moderate',  7.60, 87.20, 108),
  ('t_singtel','Enterprise Sales',       3600, 52, 'moderate', 10.10, 82.30, 92),
  ('t_singtel','Customer Operations',    4200, 49, 'moderate',  9.20, 83.50, 82),
  ('t_singtel','Corporate',              1400, 38, 'low',       6.30, 91.80, 28)
) AS v(tenant_id, dept, hc, avg_rs, rl, ppp, tcp, hru)
WHERE NOT EXISTS (
  SELECT 1 FROM human_risk.departments d
  WHERE d.tenant_id = v.tenant_id AND d.department = v.dept
);

-- =====================================================================
-- Part 4: users (8 per small tenant)
-- =====================================================================
INSERT INTO human_risk.users
  (id, tenant_id, name, email, department, job_title,
   risk_score, risk_level, risk_score_30d_delta,
   phishing_sent, phishing_clicked, phishing_reported, phishing_data_entered,
   last_phish_result, training_assigned, training_completed, training_completion_pct,
   mfa_enabled, privileged_access)
VALUES
  -- A*STAR
  ('hru_t_astar_1','t_astar','Lim Wei Jie','wjlim@astar.edu.sg','Research & Technology','Principal Research Scientist',35,'low',-3,6,1,2,0,'no-action',3,3,100,true,false),
  ('hru_t_astar_2','t_astar','Priya Nair','pnair@astar.edu.sg','Research & Technology','Research Engineer',41,'moderate',-2,5,2,1,0,'clicked',3,2,67,true,false),
  ('hru_t_astar_3','t_astar','Chen Mei Ling','mlchen@astar.edu.sg','Administration','Executive Director',28,'low',-5,4,0,1,0,'reported',2,2,100,true,true),
  ('hru_t_astar_4','t_astar','Rajesh Kumar','rkumar@astar.edu.sg','Finance & Grants','Grants Manager',38,'low',-2,5,1,1,0,'no-action',3,3,100,true,false),
  ('hru_t_astar_5','t_astar','Sarah Tan','stan@astar.edu.sg','Research & Technology','Lab Technician',55,'moderate',4,6,3,0,1,'data-entered',3,2,67,true,false),
  ('hru_t_astar_6','t_astar','David Ong','dong@astar.edu.sg','HR & Corporate Services','HR Business Partner',43,'moderate',1,5,2,1,0,'no-action',3,3,100,true,false),
  ('hru_t_astar_7','t_astar','Nurul Huda','nhuda@astar.edu.sg','Research & Technology','Senior Research Scientist',32,'low',-4,4,1,2,0,'reported',2,2,100,true,false),
  ('hru_t_astar_8','t_astar','Marcus Lee','mlee@astar.edu.sg','Administration','IT Manager',62,'moderate',6,7,3,0,0,'clicked',4,3,75,true,true),

  -- GovTech
  ('hru_t_govtech_1','t_govtech','Tan Jia Hui','jiahui.tan@tech.gov.sg','Engineering & Products','Senior Software Engineer',32,'low',-4,5,1,2,0,'no-action',3,3,100,true,false),
  ('hru_t_govtech_2','t_govtech','Amirul Hakeem','amirul@tech.gov.sg','Engineering & Products','Product Manager',38,'low',-2,5,1,1,0,'reported',3,3,100,true,false),
  ('hru_t_govtech_3','t_govtech','Chua Shui Ling','sling.chua@tech.gov.sg','Operations & Support','Operations Engineer',46,'moderate',2,6,2,1,0,'clicked',3,2,67,true,false),
  ('hru_t_govtech_4','t_govtech','Nadia Ismail','nismail@tech.gov.sg','Policy & Partnerships','Senior Policy Analyst',29,'low',-6,4,0,2,0,'reported',2,2,100,true,true),
  ('hru_t_govtech_5','t_govtech','Wu Junxian','jxwu@tech.gov.sg','Engineering & Products','DevSecOps Engineer',35,'low',-3,5,1,2,0,'no-action',3,3,100,true,true),
  ('hru_t_govtech_6','t_govtech','Fatimah Zahra','fzahra@tech.gov.sg','Operations & Support','Incident Response',42,'moderate',1,6,2,1,0,'no-action',3,3,100,true,false),
  ('hru_t_govtech_7','t_govtech','Lee Hsien Wei','hwlee@tech.gov.sg','Corporate','Finance Manager',34,'low',-2,5,1,1,0,'reported',2,2,100,true,false),
  ('hru_t_govtech_8','t_govtech','Rajan Subramaniam','rsubramaniam@tech.gov.sg','Engineering & Products','Cloud Architect',44,'moderate',3,6,2,0,0,'clicked',4,3,75,true,true),

  -- Mediacorp
  ('hru_t_mediacorp_1','t_mediacorp','Kevin Ng','kng@mediacorp.com.sg','Content & Production','Head of Digital',54,'moderate',3,7,3,0,0,'clicked',3,2,67,true,false),
  ('hru_t_mediacorp_2','t_mediacorp','Angela Sim','asim@mediacorp.com.sg','Technology','IT Security Manager',41,'moderate',-2,5,2,1,0,'no-action',3,3,100,true,true),
  ('hru_t_mediacorp_3','t_mediacorp','Hidayat Bin Ahmad','hidayat@mediacorp.com.sg','Sales & Marketing','Digital Sales Manager',63,'moderate',7,8,4,0,1,'data-entered',3,2,67,true,false),
  ('hru_t_mediacorp_4','t_mediacorp','Clara Ho','cho@mediacorp.com.sg','Content & Production','News Editor',48,'moderate',1,6,2,1,0,'no-action',3,3,100,true,false),
  ('hru_t_mediacorp_5','t_mediacorp','Darren Loh','dloh@mediacorp.com.sg','Technology','System Administrator',52,'moderate',4,6,3,0,0,'clicked',3,2,67,true,true),
  ('hru_t_mediacorp_6','t_mediacorp','Siti Rahimah','srahimah@mediacorp.com.sg','Corporate Services','HR Director',39,'low',-3,5,1,2,0,'reported',2,2,100,true,false),
  ('hru_t_mediacorp_7','t_mediacorp','Ethan Chan','echan@mediacorp.com.sg','Content & Production','Broadcast Engineer',58,'moderate',5,7,3,0,0,'no-action',3,2,67,true,false),
  ('hru_t_mediacorp_8','t_mediacorp','Michelle Teo','mteo@mediacorp.com.sg','Sales & Marketing','Account Director',67,'high',8,8,4,0,1,'data-entered',4,2,50,true,false),

  -- SingHealth
  ('hru_t_singhealth_1','t_singhealth','Dr Yeo Beng Huat','bh.yeo@singhealth.com.sg','Clinical Operations','Senior Consultant',38,'low',-3,5,1,2,0,'reported',2,2,100,true,true),
  ('hru_t_singhealth_2','t_singhealth','Lily Tan','lily.tan@singhealth.com.sg','Nursing','Head Nurse',44,'moderate',1,6,2,1,0,'clicked',3,2,67,true,false),
  ('hru_t_singhealth_3','t_singhealth','James Png','james.png@singhealth.com.sg','Information Technology','IT Director',36,'low',-5,5,1,2,0,'no-action',3,3,100,true,true),
  ('hru_t_singhealth_4','t_singhealth','Priya Rajaram','priya.r@singhealth.com.sg','Clinical Operations','Registrar',52,'moderate',4,6,3,0,0,'clicked',3,2,67,true,false),
  ('hru_t_singhealth_5','t_singhealth','Alan Koh','alan.koh@singhealth.com.sg','Admin & Finance','Finance Controller',40,'moderate',-1,5,2,1,0,'no-action',2,2,100,true,false),
  ('hru_t_singhealth_6','t_singhealth','Grace Lim','grace.lim@singhealth.com.sg','Nursing','Staff Nurse',56,'moderate',5,7,3,0,1,'data-entered',3,2,67,true,false),
  ('hru_t_singhealth_7','t_singhealth','Mohan Dass','mohan.dass@singhealth.com.sg','Information Technology','Systems Analyst',43,'moderate',2,5,2,1,0,'no-action',3,3,100,true,false),
  ('hru_t_singhealth_8','t_singhealth','Sandra Wee','sandra.wee@singhealth.com.sg','Clinical Operations','Medical Social Worker',47,'moderate',1,6,2,1,0,'reported',3,3,100,true,false),

  -- Singtel
  ('hru_t_singtel_1','t_singtel','Roy Tan','roy.tan@singtel.com','Network & Technology','Network Architect',40,'moderate',-2,6,2,1,0,'no-action',3,3,100,true,true),
  ('hru_t_singtel_2','t_singtel','Vanessa Chua','v.chua@singtel.com','Enterprise Sales','Enterprise Account Manager',58,'moderate',5,7,3,0,0,'clicked',3,2,67,true,false),
  ('hru_t_singtel_3','t_singtel','Ali Hassan','ali.hassan@singtel.com','Customer Operations','Customer Solutions Lead',51,'moderate',2,6,2,1,0,'no-action',3,2,67,true,false),
  ('hru_t_singtel_4','t_singtel','Nina Wong','nina.wong@singtel.com','Network & Technology','Cybersecurity Engineer',34,'low',-6,5,1,2,0,'reported',3,3,100,true,true),
  ('hru_t_singtel_5','t_singtel','Bernard Seah','b.seah@singtel.com','Enterprise Sales','Regional Sales Director',71,'high',9,8,5,0,1,'data-entered',4,2,50,true,false),
  ('hru_t_singtel_6','t_singtel','Jasmine Ho','j.ho@singtel.com','Corporate','Group CISO',29,'low',-7,4,0,2,0,'reported',2,2,100,true,true),
  ('hru_t_singtel_7','t_singtel','Kelvin Phua','k.phua@singtel.com','Customer Operations','Contact Centre Manager',55,'moderate',3,7,3,0,0,'clicked',3,2,67,true,false),
  ('hru_t_singtel_8','t_singtel','Nora Hamidah','n.hamidah@singtel.com','Network & Technology','IT Project Manager',46,'moderate',1,6,2,1,0,'no-action',3,3,100,true,false)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- Part 5: phishing_campaigns
-- =====================================================================
INSERT INTO human_risk.phishing_campaigns
  (id, tenant_id, name, template, difficulty, sent_at,
   recipients, delivered, opened, clicked, data_entered, reported,
   phish_prone_pct, status)
SELECT v.id, v.tenant_id, v.name, v.template, v.diff, v.sent_at,
       v.rec, v.del, v.opn, v.clk, v.de, v.rep,
       round((v.clk::numeric * 100 / NULLIF(v.rec, 0)), 2),
       v.status::human_risk.campaign_status
FROM (VALUES
  ('phish_astar_q1_2026',    't_astar',    'Q1 2026 Credential Harvest',
   'Research portal login',     2, now() - interval '90 days',
   800, 790, 280, 96, 22, 144, 'closed'),
  ('phish_astar_q2_2026',    't_astar',    'Q2 2026 CEO Impersonation',
   'Executive email lure',       3, now() - interval '30 days',
   820, 812, 295, 82, 14, 148, 'closed'),
  ('phish_govtech_q1_2026',  't_govtech',  'Q1 2026 QR Code Phish',
   'Helpdesk QR code',           2, now() - interval '80 days',
   2400, 2380, 860, 192, 36, 384, 'closed'),
  ('phish_govtech_q2_2026',  't_govtech',  'Q2 2026 IT Helpdesk Lure',
   'Password reset email',       2, now() - interval '25 days',
   2450, 2430, 888, 172, 24, 441, 'closed'),
  ('phish_mediacorp_q1_2026','t_mediacorp','Q1 2026 DocuSign Lure',
   'E-signature request',        3, now() - interval '95 days',
   900, 888, 320, 117, 31, 135, 'closed'),
  ('phish_mediacorp_q2_2026','t_mediacorp','Q2 2026 LinkedIn Credential',
   'Social media credential',    2, now() - interval '35 days',
   920, 910, 330, 101, 18, 138, 'closed'),
  ('phish_singhealth_q1_2026','t_singhealth','Q1 2026 MedPortal Password Reset',
   'Healthcare portal lure',     3, now() - interval '70 days',
   4500, 4455, 1620, 540, 96, 630, 'closed'),
  ('phish_singhealth_q2_2026','t_singhealth','Q2 2026 HR Benefits Update',
   'Benefits portal phish',      2, now() - interval '20 days',
   4600, 4554, 1656, 506, 74, 644, 'closed'),
  ('phish_singtel_q1_2026',  't_singtel',  'Q1 2026 IT Security Alert',
   'Security alert notification', 3, now() - interval '85 days',
   5400, 5346, 1944, 702, 138, 756, 'closed'),
  ('phish_singtel_q2_2026',  't_singtel',  'Q2 2026 VPN Renewal',
   'VPN credential renewal',     2, now() - interval '28 days',
   5500, 5445, 1980, 660, 110, 770, 'closed')
) AS v(id, tenant_id, name, template, diff, sent_at, rec, del, opn, clk, de, rep, status)
WHERE NOT EXISTS (
  SELECT 1 FROM human_risk.phishing_campaigns c WHERE c.id = v.id
);

-- =====================================================================
-- Part 6: training_campaigns
-- =====================================================================
INSERT INTO human_risk.training_campaigns
  (id, tenant_id, name, content_type, enrolled, completed, completion_pct, pass_rate, due_at, status)
SELECT v.id, v.tenant_id, v.name,
       v.ct::human_risk.training_content_type,
       v.enrolled, v.completed,
       round((v.completed::numeric * 100 / NULLIF(v.enrolled, 0)), 1),
       v.pass_rate::numeric(5,2),
       v.due_at,
       v.status::human_risk.training_status
FROM (VALUES
  ('train_astar_aw_2026',        't_astar',    'Cybersecurity Awareness 2026',
   'interactive', 4000, 3520, 89.5, now() + interval '30 days', 'active'),
  ('train_astar_ai_2026',        't_astar',    'AI Ethics & Responsible Use',
   'video',       3800, 2964, 91.2, now() + interval '60 days', 'active'),
  ('train_govtech_dp_2026',      't_govtech',  'Data Protection Fundamentals 2026',
   'interactive', 8300, 7555, 93.8, now() + interval '40 days', 'active'),
  ('train_govtech_zt_2026',      't_govtech',  'Zero Trust Security Principles',
   'video',       7200, 5976, 88.4, now() + interval '75 days', 'active'),
  ('train_mediacorp_aw_2026',    't_mediacorp','Information Security Awareness 2026',
   'interactive', 3000, 2460, 86.1, now() + interval '45 days', 'active'),
  ('train_mediacorp_se_2026',    't_mediacorp','Social Engineering & Insider Threats',
   'video',       2800, 1988, 83.7, now() + interval '80 days', 'active'),
  ('train_singhealth_cds_2026',  't_singhealth','Clinical Data Security 2026',
   'interactive', 14000,12166, 91.5, now() + interval '35 days', 'active'),
  ('train_singhealth_pdpa_2026', 't_singhealth','PDPA for Healthcare Workers',
   'video',       13000, 9724, 87.3, now() + interval '70 days', 'active'),
  ('train_singtel_cr_2026',      't_singtel',  'Cyber Resilience Training 2026',
   'interactive', 17500,14945, 89.9, now() + interval '30 days', 'active'),
  ('train_singtel_byod_2026',    't_singtel',  'Secure Remote Access & BYOD',
   'video',       16000,11840, 85.2, now() + interval '65 days', 'active')
) AS v(id, tenant_id, name, ct, enrolled, completed, pass_rate, due_at, status)
WHERE NOT EXISTS (
  SELECT 1 FROM human_risk.training_campaigns c WHERE c.id = v.id
);
