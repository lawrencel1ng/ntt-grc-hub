-- Migration 064: Add AI governance models/risks, workflow definitions, and vendor
-- questionnaires for the 5 small tenants and 4 tenants without workflows.
-- Idempotent: INSERT WHERE NOT EXISTS (matching tenant + name/vendor).

-- =====================================================================
-- Part 1: AI governance models (2 per small tenant, industry-appropriate)
-- =====================================================================
WITH new_models AS (
  INSERT INTO ai_gov.models
    (tenant_id, name, kind, risk_tier, jurisdiction, eu_ai_act_class,
     iso_42001_status, training_data_summary, created_at)
  SELECT v.tenant_id, v.name, v.kind,
         v.risk_tier::ai_gov.risk_tier,
         v.jurisdiction,
         v.eu_class,
         v.iso_status::ai_gov.iso_42001_status,
         v.training_data,
         now() - make_interval(days => v.age_days)
  FROM (VALUES
    -- A*STAR (Research)
    ('t_astar','Research Literature LLM','llm','limited','SG','Limited','in-progress',
     'Fine-tuned on 2.1M scientific abstracts (2018-2025) from PubMed and NRF grant reports. PII removed. Sovereign deployment on on-prem HPC cluster.',
     110),
    ('t_astar','Grant Scoring Classifier','classifier','limited','SG','Limited','compliant',
     '38,000 historical grant applications (2015-2024) labelled by outcomes. Stratified train/test split. Reviewed for demographic bias quarterly.',
     180),

    -- GovTech (Public Sector)
    ('t_govtech','Askgov Citizen LLM','llm','high','SG','High-Risk','in-progress',
     'Fine-tuned on 4.8M anonymised citizen service interactions and 12,000 government policy documents. RAG over government knowledge base. On-prem GovCloud deployment.',
     95),
    ('t_govtech','Fraud Detection Classifier','classifier','high','SG','High-Risk','in-progress',
     '6.2M transaction records (2021-2025) with fraud labels from FICA. Stratified by transaction type. Class balance: pos 2.1% / neg 97.9%. Bias audit by IMDA.',
     140),

    -- Mediacorp (Media)
    ('t_mediacorp','Content Recommendation Engine','recommender','limited','SG','Limited','compliant',
     '180M viewer interaction events (clicks, watch time, completions) across meWATCH (2023-2025). Collaborative filtering + content embeddings. PII consent-filtered.',
     200),
    ('t_mediacorp','News Summarisation LLM','llm','limited','SG','Limited','in-progress',
     'Fine-tuned on 1.4M CNA, TODAY, and Straits Times articles (2020-2025). Licensed corpus. Used for internal editorial summaries only — not public-facing.',
     130),

    -- SingHealth (Healthcare)
    ('t_singhealth','Clinical Deterioration Predictor','classifier','high','SG','High-Risk','in-progress',
     '2.1M inpatient episodes (2018-2024) from SingHealth EPIC EMR. Labels: 48h deterioration flag. Validated on NUH cohort. MoH AIQE review pending.',
     75),
    ('t_singhealth','Medical Notes Summariser','llm','limited','SG','Limited','in-progress',
     'Fine-tuned on 890,000 de-identified clinical encounter notes. Base: Med-PaLM architecture. Deployment: on-prem SingHealth private cloud. Output reviewed by clinician.',
     120),

    -- Singtel (Telecommunications)
    ('t_singtel','Network Anomaly Detector','classifier','limited','SG','Limited','compliant',
     '14 months of NetFlow telemetry (Jan 2025-Feb 2026) from 3,200 network segments. Labelled by NOC incidents. Retrained nightly. False-positive rate: 0.3%.',
     95),
    ('t_singtel','Product Recommendation Engine','recommender','limited','SG','Limited','compliant',
     '42M customer interaction signals (app, web, call centre) from SingTel consumer and enterprise portfolios (2024-2025). Consent-filtered. PDPA impact assessment complete.',
     160)
  ) AS v(tenant_id, name, kind, risk_tier, jurisdiction, eu_class, iso_status, training_data, age_days)
  WHERE NOT EXISTS (
    SELECT 1 FROM ai_gov.models m WHERE m.tenant_id = v.tenant_id AND m.name = v.name
  )
  RETURNING id, tenant_id, name
)
-- Part 1b: model_risk entries for each new model (all 5 risk types)
INSERT INTO ai_gov.model_risk (tenant_id, model_id, risk_type, severity, mitigation, created_at)
SELECT m.tenant_id, m.id, r.risk_type, r.severity::risk.severity, r.mitigation,
       now() - make_interval(days => abs(hashtext(m.id::text || r.risk_type)) % 60)
FROM new_models m
CROSS JOIN (VALUES
  ('bias','medium','Quarterly bias audit against protected characteristics. Training data stratified by demographic. Outcome disparity threshold: <5% across cohorts.'),
  ('hallucination','medium','RAG grounding with source verification. Human review gate on high-stakes outputs. Citation enforcement in response template.'),
  ('drift','low','Monthly data drift monitoring via KS-test on feature distributions. Automated retraining trigger if PSI > 0.2.'),
  ('explainability','medium','SHAP feature importance explanations surfaced to reviewers. Lime-based local explanations for individual decisions. Audit trail maintained.'),
  ('privacy','low','PII removed from training data via NER pipeline. Differential privacy noise applied. PDPA data minimisation principles applied throughout.')
) AS r(risk_type, severity, mitigation)
ON CONFLICT (model_id, risk_type) DO NOTHING;

-- =====================================================================
-- Part 2: Workflow definitions for tenants that have none
-- (A*STAR, GovTech, Mediacorp, Singtel — SingHealth already has 4)
-- =====================================================================
INSERT INTO workflow.definitions (tenant_id, name, description, steps, enabled)
SELECT v.tenant_id, v.name, v.description, v.steps::jsonb, true
FROM (VALUES
  ('t_astar','Vendor onboarding',
   'New vendor: parse SIG/CAIQ, score, route for approval',
   '[{"ref":"ag_vendor","kind":"agent","label":"Auto-fill SIG"},{"kind":"decision","label":"Risk score gate","requires_approval":true},{"kind":"manual","label":"Procurement signoff"}]'),
  ('t_astar','Regulatory change triage',
   'On regulator change: tag impact, open gaps, notify owners',
   '[{"ref":"ag_regwatch","kind":"agent","label":"Assess impact"},{"kind":"decision","label":"Materiality gate","requires_approval":true},{"kind":"manual","label":"Notify control owners"}]'),
  ('t_astar','Audit pack assembly',
   'On audit event: assemble evidence pack',
   '[{"ref":"ag_auditor","kind":"agent","label":"Collect evidence"},{"kind":"manual","label":"Auditor review"},{"kind":"manual","label":"Director signoff"}]'),
  ('t_astar','Quarterly access review',
   'Pull entitlements; flag stale; route to managers',
   '[{"ref":"ag_iam","kind":"agent","label":"Enumerate access"},{"kind":"decision","label":"Stale access gate","requires_approval":true},{"kind":"manual","label":"Manager attestation"}]'),

  ('t_govtech','Vendor onboarding',
   'New vendor: parse SIG/CAIQ, score, route for approval',
   '[{"ref":"ag_vendor","kind":"agent","label":"Auto-fill SIG"},{"kind":"decision","label":"Risk score gate","requires_approval":true},{"kind":"manual","label":"Procurement signoff"}]'),
  ('t_govtech','Regulatory change triage',
   'On regulator change: tag impact, open gaps, notify owners',
   '[{"ref":"ag_regwatch","kind":"agent","label":"Assess impact"},{"kind":"decision","label":"Materiality gate","requires_approval":true},{"kind":"manual","label":"Notify control owners"}]'),
  ('t_govtech','Audit pack assembly',
   'On audit event: assemble evidence pack',
   '[{"ref":"ag_auditor","kind":"agent","label":"Collect evidence"},{"kind":"manual","label":"Auditor review"},{"kind":"manual","label":"Director signoff"}]'),
  ('t_govtech','Quarterly access review',
   'Pull entitlements; flag stale; route to managers',
   '[{"ref":"ag_iam","kind":"agent","label":"Enumerate access"},{"kind":"decision","label":"Stale access gate","requires_approval":true},{"kind":"manual","label":"Manager attestation"}]'),

  ('t_mediacorp','Vendor onboarding',
   'New vendor: parse SIG/CAIQ, score, route for approval',
   '[{"ref":"ag_vendor","kind":"agent","label":"Auto-fill SIG"},{"kind":"decision","label":"Risk score gate","requires_approval":true},{"kind":"manual","label":"Procurement signoff"}]'),
  ('t_mediacorp','Regulatory change triage',
   'On regulator change: tag impact, open gaps, notify owners',
   '[{"ref":"ag_regwatch","kind":"agent","label":"Assess impact"},{"kind":"decision","label":"Materiality gate","requires_approval":true},{"kind":"manual","label":"Notify control owners"}]'),
  ('t_mediacorp','Audit pack assembly',
   'On audit event: assemble evidence pack',
   '[{"ref":"ag_auditor","kind":"agent","label":"Collect evidence"},{"kind":"manual","label":"Auditor review"},{"kind":"manual","label":"Director signoff"}]'),
  ('t_mediacorp','Quarterly access review',
   'Pull entitlements; flag stale; route to managers',
   '[{"ref":"ag_iam","kind":"agent","label":"Enumerate access"},{"kind":"decision","label":"Stale access gate","requires_approval":true},{"kind":"manual","label":"Manager attestation"}]'),

  ('t_singtel','Vendor onboarding',
   'New vendor: parse SIG/CAIQ, score, route for approval',
   '[{"ref":"ag_vendor","kind":"agent","label":"Auto-fill SIG"},{"kind":"decision","label":"Risk score gate","requires_approval":true},{"kind":"manual","label":"Procurement signoff"}]'),
  ('t_singtel','Regulatory change triage',
   'On regulator change: tag impact, open gaps, notify owners',
   '[{"ref":"ag_regwatch","kind":"agent","label":"Assess impact"},{"kind":"decision","label":"Materiality gate","requires_approval":true},{"kind":"manual","label":"Notify control owners"}]'),
  ('t_singtel','Audit pack assembly',
   'On audit event: assemble evidence pack',
   '[{"ref":"ag_auditor","kind":"agent","label":"Collect evidence"},{"kind":"manual","label":"Auditor review"},{"kind":"manual","label":"Director signoff"}]'),
  ('t_singtel','Quarterly access review',
   'Pull entitlements; flag stale; route to managers',
   '[{"ref":"ag_iam","kind":"agent","label":"Enumerate access"},{"kind":"decision","label":"Stale access gate","requires_approval":true},{"kind":"manual","label":"Manager attestation"}]')
) AS v(tenant_id, name, description, steps)
WHERE NOT EXISTS (
  SELECT 1 FROM workflow.definitions d WHERE d.tenant_id = v.tenant_id AND d.name = v.name
);

-- =====================================================================
-- Part 3: Vendor questionnaires for 5 small tenants
-- (2 per tenant — SIG for tier-2 vendor, CAIQ for another tier-2)
-- =====================================================================
INSERT INTO vendor.questionnaires
  (tenant_id, vendor_id, template, status, sent_at, completed_at, score)
SELECT v.tenant_id, v.vid::uuid, v.template,
       v.status::vendor.questionnaire_status,
       now() - make_interval(days => v.sent_days_ago),
       CASE WHEN v.status = 'complete' THEN
         now() - make_interval(days => v.sent_days_ago - 21)
       ELSE NULL END,
       CASE WHEN v.status = 'complete' THEN v.score ELSE NULL END
FROM (VALUES
  ('t_astar',    'f17cd7d6-55ac-4de4-b9e1-96e09fcdd3ce','SIG','complete',60,72.50),
  ('t_astar',    'b846b7be-756c-46f9-91b3-4e043dd71231','CAIQ','in-progress',30,NULL),
  ('t_govtech',  '6cac7a7d-2a37-4554-a37b-9e54121ff670','SIG','complete',90,81.00),
  ('t_govtech',  '21ed3c58-cf7e-4ffe-bbfe-fb761fabc8a6','CAIQ','complete',75,68.50),
  ('t_mediacorp','30fadef8-33c6-4322-893d-8aea7ca70367','SIG','complete',45,74.00),
  ('t_mediacorp','cf421d80-a358-4be1-8520-790167e8a83b','CAIQ','in-progress',20,NULL),
  ('t_singhealth','f2ab4451-6910-46a0-b907-f355f058878e','SIG','complete',80,78.50),
  ('t_singhealth','cd426ae1-8908-4e8e-a178-d719319aa42b','CAIQ','complete',60,71.00),
  ('t_singtel',  '29cb9c63-ddda-4fea-8a03-e5c01fe48ea6','SIG','complete',70,83.00),
  ('t_singtel',  'bf5f76a9-f6e1-4486-9d28-78f2c7fc51d5','CAIQ','in-progress',25,NULL)
) AS v(tenant_id, vid, template, status, sent_days_ago, score)
WHERE NOT EXISTS (
  SELECT 1 FROM vendor.questionnaires q
  WHERE q.tenant_id = v.tenant_id AND q.vendor_id = v.vid::uuid AND q.template = v.template
);
