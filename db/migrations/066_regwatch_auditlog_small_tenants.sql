-- Migration 066: Add regwatch impact assessments and audit log entries
-- for the 5 small tenants that currently have zero rows in both tables.
-- Idempotent: WHERE NOT EXISTS on (tenant_id, change_id) for impact_assessments;
-- audit_log uses INSERT with no unique constraint (append-only), guarded by
-- checking row count first so re-running doesn't double-insert.

-- =====================================================================
-- Part 1: Regwatch impact assessments for 5 small tenants
-- Assigns relevant regulatory changes per tenant industry.
-- =====================================================================
INSERT INTO regwatch.impact_assessments
  (tenant_id, change_id, framework_id, impact, gaps_opened, assessed_by_agent_id, assessed_at, notes)
SELECT v.tenant_id, v.change_id::uuid, v.framework_id,
       v.impact::regwatch.impact, v.gaps_opened, 'ag_regwatch',
       now() - make_interval(days => v.days_ago),
       v.notes
FROM (VALUES
  -- A*STAR (Research / AI)
  ('t_astar','adc668a6-9b67-4ba4-8384-045da3575ec2','eu-ai-act','high',3,22,
   'EU AI Act Article 9 applies to A*STAR Grant Scoring Classifier (high-risk) and Research Literature LLM. ISO 42001 certification in-progress; 3 gaps opened against Article 9 technical standards.'),
  ('t_astar','af31cae4-2122-4ac5-a247-9407f7c79de6','pdpa-sg','low',0,45,
   'PDPC Research PETs publication reviewed. Current anonymisation pipeline (NER + differential privacy) meets recommended baseline. No gaps.'),
  ('t_astar','3d57ad22-7c3c-4004-a2b2-478823efb45f','eu-ai-act','medium',1,18,
   'PDPC AI recommendation guidance applicable to internal research-matching tools. One gap opened: model output explainability documentation incomplete.'),
  ('t_astar','54a01a9a-fea5-4b9b-9d25-e11dfc26eab4','pdpa-sg','medium',1,60,
   'PDPC International Data Transfers guidelines reviewed against NRF cross-border data sharing agreements. Binding Corporate Rules template gap identified.'),
  ('t_astar','d63f577c-87ce-461a-929b-4dbb96851d34','pdpa-sg','medium',0,30,
   'Mandatory DPO annual review requirement confirmed. A*STAR DPO already conducts bi-annual reviews. No additional gaps.'),

  -- GovTech (Public Sector Digital)
  ('t_govtech','8aa36abd-8ba1-4b08-b874-10bafbb38085','pdpa-sg','high',2,15,
   'Revised NRIC handling guidance impacts GovTech Singpass identity verification flows. AskGov chatbot NRIC logging policy requires update. 2 gaps opened.'),
  ('t_govtech','4f0d80a9-0040-4ca6-9999-62d0b65283de','mas-trm','high',2,8,
   'MAS Proposed AI Governance Framework directly applicable to AskGov citizen LLM and Fraud Detection Classifier. GovTech already following MAS-FEAT principles but 2 documentation gaps remain.'),
  ('t_govtech','3d57ad22-7c3c-4004-a2b2-478823efb45f','im8','medium',1,20,
   'PDPC AI advisory on recommendation systems applicable to GovTech personalised e-service delivery. AI audit trail requirement creates 1 gap.'),
  ('t_govtech','d63f577c-87ce-461a-929b-4dbb96851d34','pdpa-sg','high',0,35,
   'DPO mandatory annual review already implemented by GovTech. Statutory board exemption confirmed with PDPC. No gaps.'),
  ('t_govtech','6252d2d3-a49a-498a-8f3b-ac6fcccd7fc3','pdpa-sg','medium',1,50,
   'PDPC financial sector breach notification timeliness enforcement direction: 72h notification window. GovTech FinTech bureau incident response SLA updated; 1 documentation gap.'),

  -- Mediacorp (Media)
  ('t_mediacorp','3d57ad22-7c3c-4004-a2b2-478823efb45f','pdpa-sg','medium',1,25,
   'PDPC AI advisory on recommendation systems directly applicable to meWATCH Content Recommendation Engine. Explainability gap for ad targeting opened.'),
  ('t_mediacorp','eb73d80e-b71d-4c5f-8541-2a76fb98f7d3','gdpr','low',0,40,
   'GDPR automated decision-making guidance reviewed. Mediacorp EU audience is small (<5% of total viewers). No material gaps; monitoring only.'),
  ('t_mediacorp','54a01a9a-fea5-4b9b-9d25-e11dfc26eab4','pdpa-sg','low',0,55,
   'PDPC International Data Transfers guidelines reviewed. Mediacorp content licensing cross-border transfers already covered by SCCs. No gaps.'),
  ('t_mediacorp','d63f577c-87ce-461a-929b-4dbb96851d34','pdpa-sg','medium',0,20,
   'Mandatory DPO annual review confirmed. Mediacorp DPO review schedule aligned. No additional gaps.'),
  ('t_mediacorp','adc668a6-9b67-4ba4-8384-045da3575ec2','eu-ai-act','low',0,15,
   'EU AI Act Article 9 reviewed. News Summarisation LLM classified as limited-risk; not subject to Article 9 requirements. Monitoring status.'),

  -- SingHealth (Healthcare)
  ('t_singhealth','8aa36abd-8ba1-4b08-b874-10bafbb38085','pdpa-sg','high',2,12,
   'Revised NRIC guidance critical for SingHealth EMR patient identity verification. 2 gaps opened: NRIC logging in EPIC audit trail and consent management for NRIC in clinical notes.'),
  ('t_singhealth','d6dbffe9-7740-4f75-8558-1acc0b79aa5d','iso-42001','high',3,18,
   'APRA CPS 220 AI/ML Model Risk addendum applicable to Clinical Deterioration Predictor. MoH AIQE review pending; 3 governance gaps opened against model validation requirements.'),
  ('t_singhealth','d63f577c-87ce-461a-929b-4dbb96851d34','pdpa-sg','high',0,30,
   'Mandatory DPO annual review requirement confirmed for healthcare sector. SingHealth DPO already conducts quarterly reviews. No gaps; exemplary practice noted.'),
  ('t_singhealth','af31cae4-2122-4ac5-a247-9407f7c79de6','pdpa-sg','medium',1,22,
   'PDPC Research PETs publication reviewed against SingHealth research data-sharing programme. One gap: de-identification methodology documentation for federated learning partners.'),
  ('t_singhealth','4f0d80a9-0040-4ca6-9999-62d0b65283de','iso-42001','medium',2,8,
   'MAS AI Governance Framework reviewed for applicability to SingHealth HealthTech investments. Medical Notes Summariser governance documentation gap; ISO 42001 roadmap update required.'),

  -- Singtel (Telecommunications)
  ('t_singtel','4745f94c-c18c-4fd5-b004-27afd2be9fe5','mas-trm','high',2,10,
   'MAS Digital Resilience Obligations consultation directly applicable to Singtel (MAS-licensed ATS operator). 2 gaps: system resilience testing documentation and cloud dependency register for critical systems.'),
  ('t_singtel','539803b6-bf0f-420c-a9ef-09cdbeda92bd','mas-trm','high',1,20,
   'MAS Cyber Hygiene Notice third-party software inventory controls applicable. Singtel has 3,200 network segments; software bill of materials (SBOM) gap opened for NOC systems.'),
  ('t_singtel','fa1bb5b0-a6fc-4133-b852-3a8587d30c02','mas-trm','medium',0,35,
   'MAS TRM cryptographic standards update reviewed. AES-256 and TLS 1.3 already mandated across Singtel infrastructure. No gaps; certificate rotation automation confirmed.'),
  ('t_singtel','6252d2d3-a49a-498a-8f3b-ac6fcccd7fc3','pdpa-sg','medium',1,45,
   'PDPC financial sector breach notification enforcement applies to Singtel Financial Services. 72h notification SLA gap identified for payment platform incident response runbook.'),
  ('t_singtel','8aa36abd-8ba1-4b08-b874-10bafbb38085','pdpa-sg','medium',0,28,
   'PDPC NRIC handling guidance reviewed for Singtel digital SIM registration and identity verification. Current processes comply; no gaps.')
) AS v(tenant_id, change_id, framework_id, impact, gaps_opened, days_ago, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM regwatch.impact_assessments ia
  WHERE ia.tenant_id = v.tenant_id AND ia.change_id = v.change_id::uuid
);

-- =====================================================================
-- Part 2: Platform audit log entries for 5 small tenants
-- Adds realistic login/action entries so the audit log page is non-empty.
-- Guard: only insert if these tenants currently have 0 rows.
-- =====================================================================
INSERT INTO platform.audit_log
  (ts, tenant_id, user_id, actor_email, action, target, ip_address, user_agent, result, metadata)
SELECT
  now() - make_interval(secs => abs(hashtext(v.actor_email || v.action || v.target || v.tenant_id)) % 2592000),
  v.tenant_id,
  u.id,
  v.actor_email,
  v.action,
  v.target,
  v.ip::inet,
  v.ua,
  v.result,
  v.meta::jsonb
FROM (VALUES
  -- A*STAR
  ('t_astar','a*star.admin@example.sg','login','session:login','203.116.12.45','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36','success','{"mfa":true}'),
  ('t_astar','a*star.admin@example.sg','settings.update','tenant:t_astar','203.116.12.45','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36','success','{"field":"sso_provider","value":"saml-nrf"}'),
  ('t_astar','a*star.risk@example.sg','login','session:login','203.116.12.46','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','success','{"mfa":true}'),
  ('t_astar','a*star.risk@example.sg','risk.update','risk:ASTAR-RISK-003','203.116.12.46','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','success','{"field":"residual_severity","from":"high","to":"medium"}'),
  ('t_astar','a*star.auditor@example.sg','login','session:login','203.116.12.47','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36','success','{"mfa":true}'),
  ('t_astar','a*star.auditor@example.sg','audit.create','engagement:ASTAR-AUD-2026','203.116.12.47','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36','success','{"name":"ISO 27001 Annual Audit 2026"}'),
  ('t_astar','a*star.control@example.sg','login','session:login','203.116.12.48','Mozilla/5.0 (iPad; CPU OS 17_4) AppleWebKit/605.1.15','success','{"mfa":false}'),
  ('t_astar','a*star.control@example.sg','control.test','control:CTRL-ASTAR-007','203.116.12.48','Mozilla/5.0 (iPad; CPU OS 17_4) AppleWebKit/605.1.15','success','{"result":"pass","automated":false}'),
  ('t_astar','a*star.ops@example.sg','login','session:login','203.116.12.49','Mozilla/5.0 (iPhone; CPU iPhone OS 17_4) AppleWebKit/605.1.15','success','{"mfa":true}'),
  ('t_astar','a*star.admin@example.sg','user.invite','user:new','203.116.12.45','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36','success','{"email":"astar.researcher@example.sg","role":"viewer"}'),

  -- GovTech
  ('t_govtech','govtech.singapore.admin@example.sg','login','session:login','202.72.168.10','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36','success','{"mfa":true}'),
  ('t_govtech','govtech.singapore.admin@example.sg','settings.update','tenant:t_govtech','202.72.168.10','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36','success','{"field":"mfa_required","value":true}'),
  ('t_govtech','govtech.singapore.risk@example.sg','login','session:login','202.72.168.11','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','success','{"mfa":true}'),
  ('t_govtech','govtech.singapore.risk@example.sg','risk.create','risk:GTSG-RISK-NEW','202.72.168.11','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','success','{"title":"AI Chatbot Hallucination — Citizen Misinformation Risk"}'),
  ('t_govtech','govtech.singapore.auditor@example.sg','login','session:login','202.72.168.12','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36','success','{"mfa":true}'),
  ('t_govtech','govtech.singapore.auditor@example.sg','audit.finding.create','finding:GTSG-AUD-F001','202.72.168.12','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36','success','{"severity":"high","title":"AI model governance documentation incomplete"}'),
  ('t_govtech','govtech.singapore.control@example.sg','login','session:login','202.72.168.13','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','success','{"mfa":true}'),
  ('t_govtech','govtech.singapore.control@example.sg','policy.acknowledge','policy:GTSG-POL-003','202.72.168.13','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','success','{"policy":"AI Governance Policy v1.2"}'),
  ('t_govtech','govtech.singapore.ops@example.sg','login','session:login','202.72.168.14','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36','success','{"mfa":true}'),
  ('t_govtech','govtech.singapore.admin@example.sg','login','session:login','10.15.20.5','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36','denied','{"reason":"ip_not_in_allowlist"}'),

  -- Mediacorp
  ('t_mediacorp','mediacorp.admin@example.sg','login','session:login','116.14.28.70','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36','success','{"mfa":true}'),
  ('t_mediacorp','mediacorp.admin@example.sg','vendor.create','vendor:MEDI-VND-NEW','116.14.28.70','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36','success','{"name":"Akamai Technologies","tier":2}'),
  ('t_mediacorp','mediacorp.risk@example.sg','login','session:login','116.14.28.71','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','success','{"mfa":true}'),
  ('t_mediacorp','mediacorp.risk@example.sg','risk.update','risk:MEDI-RISK-002','116.14.28.71','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','success','{"field":"treatment_plan","status":"approved"}'),
  ('t_mediacorp','mediacorp.auditor@example.sg','login','session:login','116.14.28.72','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36','success','{"mfa":true}'),
  ('t_mediacorp','mediacorp.control@example.sg','login','session:login','116.14.28.73','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','success','{"mfa":false}'),
  ('t_mediacorp','mediacorp.control@example.sg','control.exception.create','control:CTRL-MEDI-012','116.14.28.73','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','success','{"justification":"Legacy DRM system cannot support AES-256 until Q4 2026 upgrade"}'),
  ('t_mediacorp','mediacorp.ops@example.sg','login','session:login','116.14.28.74','Mozilla/5.0 (iPhone; CPU iPhone OS 17_4) AppleWebKit/605.1.15','success','{"mfa":true}'),
  ('t_mediacorp','mediacorp.admin@example.sg','policy.publish','policy:MEDI-POL-AI','116.14.28.70','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36','success','{"name":"AI Content Moderation Policy v1.0","version":"1.0"}'),
  ('t_mediacorp','mediacorp.risk@example.sg','login','session:login','116.14.28.71','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','failure','{"reason":"invalid_mfa_token","attempts":2}'),

  -- SingHealth
  ('t_singhealth','singhealth.admin@example.sg','login','session:login','168.95.24.18','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36','success','{"mfa":true}'),
  ('t_singhealth','singhealth.admin@example.sg','settings.update','tenant:t_singhealth','168.95.24.18','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36','success','{"field":"session_timeout_min","from":60,"to":30}'),
  ('t_singhealth','singhealth.risk@example.sg','login','session:login','168.95.24.19','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','success','{"mfa":true}'),
  ('t_singhealth','singhealth.risk@example.sg','risk.create','risk:SHIN-RISK-NEW','168.95.24.19','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','success','{"title":"Clinical AI Model Regulatory Non-Compliance Risk (MoH AIQE)"}'),
  ('t_singhealth','singhealth.auditor@example.sg','login','session:login','168.95.24.20','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36','success','{"mfa":true}'),
  ('t_singhealth','singhealth.auditor@example.sg','audit.workpaper.create','workpaper:SHIN-WP-003','168.95.24.20','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36','success','{"title":"PDPA DPO Annual Review 2026 — Clinical Data Processing"}'),
  ('t_singhealth','singhealth.control@example.sg','login','session:login','168.95.24.21','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','success','{"mfa":true}'),
  ('t_singhealth','singhealth.control@example.sg','compliance.gap.remediate','gap:SHIN-GAP-001','168.95.24.21','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','success','{"gap":"NRIC logging in EPIC audit trail","status":"remediated"}'),
  ('t_singhealth','singhealth.ops@example.sg','login','session:login','168.95.24.22','Mozilla/5.0 (iPad; CPU OS 17_4) AppleWebKit/605.1.15','success','{"mfa":true}'),
  ('t_singhealth','singhealth.admin@example.sg','user.deactivate','user:SHIN-USR-EXT-04','168.95.24.18','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36','success','{"reason":"vendor_offboarded","email":"contractor@example.sg"}'),

  -- Singtel
  ('t_singtel','singtel.admin@example.sg','login','session:login','123.136.96.25','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36','success','{"mfa":true}'),
  ('t_singtel','singtel.admin@example.sg','settings.update','tenant:t_singtel','123.136.96.25','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36','success','{"field":"connector.aws_security_hub","enabled":true}'),
  ('t_singtel','singtel.risk@example.sg','login','session:login','123.136.96.26','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','success','{"mfa":true}'),
  ('t_singtel','singtel.risk@example.sg','risk.quantify','risk:STEL-RISK-005','123.136.96.26','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','success','{"agent":"ag_risk","lef":0.65,"lm_sgd":4200000}'),
  ('t_singtel','singtel.auditor@example.sg','login','session:login','123.136.96.27','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36','success','{"mfa":true}'),
  ('t_singtel','singtel.auditor@example.sg','audit.finding.resolve','finding:STEL-AUD-F002','123.136.96.27','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36','success','{"resolution":"Third-party software inventory (SBOM) tooling deployed to all 3,200 network segments"}'),
  ('t_singtel','singtel.control@example.sg','login','session:login','123.136.96.28','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','success','{"mfa":true}'),
  ('t_singtel','singtel.control@example.sg','control.test','control:CTRL-STEL-019','123.136.96.28','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','success','{"result":"pass","automated":true,"runs":3200}'),
  ('t_singtel','singtel.ops@example.sg','login','session:login','123.136.96.29','Mozilla/5.0 (iPhone; CPU iPhone OS 17_4) AppleWebKit/605.1.15','success','{"mfa":true}'),
  ('t_singtel','singtel.admin@example.sg','vendor.questionnaire.send','questionnaire:STEL-Q-007','123.136.96.25','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36','success','{"vendor":"Akamai Technologies","template":"SIG"}')
) AS v(tenant_id, actor_email, action, target, ip, ua, result, meta)
JOIN platform.users u ON u.email = v.actor_email
WHERE NOT EXISTS (
  SELECT 1 FROM platform.audit_log al
  WHERE al.tenant_id = v.tenant_id LIMIT 1
);
