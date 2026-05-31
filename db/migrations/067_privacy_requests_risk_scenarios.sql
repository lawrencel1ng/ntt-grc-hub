-- Migration 067: Fill privacy.subject_requests, risk.appetite_statements,
-- risk.scenarios, and risk.fair_runs for the 5 small tenants.
-- Idempotent: appetite_statements has UNIQUE(tenant_id,category);
-- subject_requests, scenarios, and fair_runs use WHERE NOT EXISTS.

-- =====================================================================
-- Part 1: Risk appetite statements (5 per tenant)
-- =====================================================================
INSERT INTO risk.appetite_statements
  (tenant_id, category, statement, threshold_sgd, severity_cap)
SELECT v.tenant_id, v.category, v.statement, v.threshold_sgd::numeric(14,2),
       v.severity_cap::risk.severity
FROM (VALUES
  -- A*STAR (Research)
  ('t_astar','Cyber Security',
   'We accept low to medium cyber risk arising from collaborative research network access, provided critical HPC and research data assets are protected by mandatory MFA and encryption.',
   500000.00,'high'),
  ('t_astar','Data & Privacy',
   'We tolerate low residual privacy risk in research data processing, subject to NRF data governance policy compliance and PDPC consent requirements.',
   200000.00,'medium'),
  ('t_astar','AI & Model Governance',
   'We accept limited risk in AI research systems. All AI models deployed in grant scoring or public-facing roles must be registered and undergo quarterly bias review.',
   300000.00,'medium'),
  ('t_astar','Vendor & Third-Party',
   'We accept low third-party risk in cloud research infrastructure, with all tier-1 and tier-2 vendors subject to annual SIG questionnaire.',
   400000.00,'medium'),
  ('t_astar','Operational Resilience',
   'We accept planned downtime up to 4h per quarter for HPC maintenance, with critical research deadlines excluded from maintenance windows.',
   250000.00,'low'),

  -- GovTech (Public Sector Digital)
  ('t_govtech','Cyber Security',
   'We accept zero tolerance for undetected breaches of citizen data. All systems handling Singpass or NRIC data must comply with IM8 controls and undergo annual red team exercise.',
   1000000.00,'medium'),
  ('t_govtech','Data & Privacy',
   'We tolerate no misuse of citizen personal data. All processing activities require PDPC DPIA and must be reviewed by the statutory DPO.',
   500000.00,'low'),
  ('t_govtech','AI & Model Governance',
   'We accept medium risk in AI-powered citizen services, provided all high-risk models are reviewed under MAS-FEAT and PDPC advisory guidelines, with human oversight mandated.',
   700000.00,'high'),
  ('t_govtech','Vendor & Third-Party',
   'We accept low third-party concentration risk. No single cloud provider may host more than 40% of critical government digital services.',
   800000.00,'medium'),
  ('t_govtech','Operational Resilience',
   'We accept no sustained outage of Singpass or MyInfo exceeding 30 minutes. Disaster recovery for critical services must achieve RTO of 1 hour.',
   600000.00,'medium'),

  -- Mediacorp (Media)
  ('t_mediacorp','Cyber Security',
   'We accept low cyber risk on content delivery infrastructure. CDN and streaming systems must maintain DDoS protection and certificate management to prevent public-facing outages.',
   400000.00,'high'),
  ('t_mediacorp','Data & Privacy',
   'We accept low residual privacy risk in viewer data processing for personalisation, with consent-based filtering and annual PDPC DPIA review for recommendation models.',
   300000.00,'medium'),
  ('t_mediacorp','AI & Model Governance',
   'We accept limited risk in AI-driven content recommendation. Recommendation models must be audited for editorial bias annually and must not surface prohibited content.',
   250000.00,'medium'),
  ('t_mediacorp','Vendor & Third-Party',
   'We accept medium CDN and broadcast technology vendor risk, with failover mechanisms tested quarterly and SLA uptime commitments of 99.9% for meWATCH.',
   350000.00,'medium'),
  ('t_mediacorp','Operational Resilience',
   'We accept brief CDN failover delays of up to 10 minutes during non-peak hours. Live broadcast outages exceeding 5 minutes are unacceptable during scheduled programming.',
   200000.00,'medium'),

  -- SingHealth (Healthcare)
  ('t_singhealth','Cyber Security',
   'We accept zero tolerance for patient data breaches. All clinical systems must comply with MoH cybersecurity guidelines and undergo annual penetration testing.',
   1500000.00,'medium'),
  ('t_singhealth','Data & Privacy',
   'We accept zero privacy risk in patient health records. All PDPA obligations are mandatory; de-identification is required for research datasets before external sharing.',
   800000.00,'low'),
  ('t_singhealth','AI & Model Governance',
   'We accept limited AI risk in clinical decision support, provided all high-risk models receive MoH AIQE approval and are overseen by qualified clinicians at point of care.',
   600000.00,'high'),
  ('t_singhealth','Vendor & Third-Party',
   'We accept low third-party risk in medical device and EMR vendor ecosystem. Critical system vendors must maintain ISO 27001 certification and annual SIG assessment.',
   700000.00,'medium'),
  ('t_singhealth','Operational Resilience',
   'We accept no EMR downtime exceeding 2 hours during clinical operations. Downtime procedures must support clinical care for up to 4 hours without electronic systems.',
   1000000.00,'high'),

  -- Singtel (Telecommunications)
  ('t_singtel','Cyber Security',
   'We accept low cyber risk on core network infrastructure. BGP and routing configurations require peer review, and SOC must achieve mean time to detect of under 30 minutes.',
   2000000.00,'high'),
  ('t_singtel','Data & Privacy',
   'We accept low privacy risk in customer data processing. PDPA obligations are mandatory for all consumer and enterprise products, with PDPC breach notification within 72 hours.',
   1000000.00,'medium'),
  ('t_singtel','AI & Model Governance',
   'We accept limited risk in AI-driven network operations. Network Anomaly Detector must maintain false-positive rate below 1% and be retrained monthly.',
   800000.00,'medium'),
  ('t_singtel','Vendor & Third-Party',
   'We accept medium third-party risk in network equipment and CDN vendors. Critical equipment vendors must provide 24/7 support and software bill of materials (SBOM).',
   1500000.00,'high'),
  ('t_singtel','Operational Resilience',
   'We accept no core network outage exceeding 15 minutes in the central region. MAS-compliant business continuity testing must be conducted annually.',
   3000000.00,'critical')
) AS v(tenant_id, category, statement, threshold_sgd, severity_cap)
ON CONFLICT (tenant_id, category) DO NOTHING;

-- =====================================================================
-- Part 2: Privacy subject requests (4 per small tenant)
-- =====================================================================
INSERT INTO privacy.subject_requests
  (tenant_id, kind, requester_email, received_at, due_at, status, resolved_at, metadata, created_at)
SELECT v.tenant_id,
       v.kind::privacy.request_kind,
       v.email,
       now() - make_interval(days => v.recv_days_ago),
       now() - make_interval(days => v.recv_days_ago) + interval '30 days',
       v.status::privacy.request_status,
       CASE WHEN v.status = 'resolved'
         THEN now() - make_interval(days => v.recv_days_ago - 18) ELSE NULL END,
       v.meta::jsonb,
       now() - make_interval(days => v.recv_days_ago)
FROM (VALUES
  -- A*STAR
  ('t_astar','access','researcher01@nus.edu.sg',45,'resolved','{"activity":"ASTAR-ROPA-001","note":"Provided copy of grant application data held by A*STAR"}'),
  ('t_astar','erasure','postdoc.applicant@gmail.com',30,'resolved','{"activity":"ASTAR-ROPA-001","note":"Data erased from recruitment CRM. Retention hold not applicable."}'),
  ('t_astar','portability','phd.student@ntu.edu.sg',15,'in-progress','{"activity":"ASTAR-ROPA-004","note":"Export of research participation data in CSV format in progress"}'),
  ('t_astar','rectification','lab.technician@example.sg',60,'resolved','{"activity":"ASTAR-ROPA-001","note":"Name and contact corrected in HR system. Data propagated to 3 downstream systems."}'),

  -- GovTech
  ('t_govtech','access','citizen.user@gmail.com',50,'resolved','{"activity":"GTSG-ROPA-001","note":"Full access report issued covering Singpass linked data across 12 government agencies."}'),
  ('t_govtech','erasure','ex.employee@govtech.gov.sg',35,'resolved','{"activity":"GTSG-ROPA-002","note":"Employee data erased from HR systems post-retention period. Audit log retained per IM8 requirements."}'),
  ('t_govtech','objection','resident@example.sg',20,'in-progress','{"activity":"GTSG-ROPA-001","note":"Objection to use of MyInfo for automated government e-service personalisation under review."}'),
  ('t_govtech','portability','startup.founder@example.sg',10,'received','{"activity":"GTSG-ROPA-002","note":"Request for portability of CorpPass-linked business data received. DPO review required."}'),

  -- Mediacorp
  ('t_mediacorp','access','viewer@gmail.com',40,'resolved','{"activity":"MEDI-ROPA-001","note":"meWATCH viewing history and personalisation data report issued."}'),
  ('t_mediacorp','erasure','cancelled.subscriber@gmail.com',25,'resolved','{"activity":"MEDI-ROPA-001","note":"Account and viewing data erased. Anonymised analytics retained."}'),
  ('t_mediacorp','objection','privacy.conscious@gmail.com',18,'resolved','{"activity":"MEDI-ROPA-002","note":"User opted out of personalised ad targeting. Confirmed in preference centre."}'),
  ('t_mediacorp','portability','data.rights@example.sg',8,'in-progress','{"activity":"MEDI-ROPA-001","note":"Export of subscription and viewing history in machine-readable format in progress."}'),

  -- SingHealth
  ('t_singhealth','access','patient.001@gmail.com',55,'resolved','{"activity":"SHIN-ROPA-001","note":"Full medical record summary provided to patient via HealthHub portal. 42-page report generated."}'),
  ('t_singhealth','rectification','patient.002@yahoo.sg',38,'resolved','{"activity":"SHIN-ROPA-001","note":"Allergy record corrected in EPIC EMR. Clinician review and sign-off obtained."}'),
  ('t_singhealth','erasure','ex.patient@gmail.com',22,'in-progress','{"activity":"SHIN-ROPA-001","note":"Erasure request under legal review. MOH retention schedule (10 years) may supersede."}'),
  ('t_singhealth','portability','patient.advocate@example.sg',12,'received','{"activity":"SHIN-ROPA-003","note":"Request for FHIR-format export of clinical data for specialist referral. DPO and clinical review initiated."}'),

  -- Singtel
  ('t_singtel','access','mobile.customer@gmail.com',48,'resolved','{"activity":"STEL-ROPA-001","note":"Account data, call records, and billing history for past 12 months provided in PDF."}'),
  ('t_singtel','erasure','former.customer@gmail.com',32,'resolved','{"activity":"STEL-ROPA-001","note":"Post-contract data erased. Billing records retained for 5 years per statutory requirement."}'),
  ('t_singtel','objection','enterprise.dpo@example.sg',16,'resolved','{"activity":"STEL-ROPA-003","note":"Objection to network analytics profiling for enterprise recommendation. Opted out of analytics programme."}'),
  ('t_singtel','portability','switching.customer@gmail.com',6,'received','{"activity":"STEL-ROPA-001","note":"Request for ported account history data in advance of MNP. Assigned to data ops team."}')
) AS v(tenant_id, kind, email, recv_days_ago, status, meta)
WHERE NOT EXISTS (
  SELECT 1 FROM privacy.subject_requests sr
  WHERE sr.tenant_id = v.tenant_id AND sr.requester_email = v.email
    AND sr.kind = v.kind::privacy.request_kind
);

-- =====================================================================
-- Part 3: Risk scenarios (3 per small tenant) and fair_runs (2 per scenario)
-- =====================================================================
WITH new_scenarios AS (
  INSERT INTO risk.scenarios
    (tenant_id, name, description, frequency_dist, magnitude_dist, created_at)
  SELECT v.tenant_id, v.name, v.description,
         v.freq_dist::jsonb, v.mag_dist::jsonb,
         now() - make_interval(days => abs(hashtext(v.tenant_id || v.name)) % 120)
  FROM (VALUES
    -- A*STAR
    ('t_astar','Ransomware on HPC research cluster',
     'Threat actor encrypts HPC nodes via phishing; research data unavailable for 5-10 days.',
     '{"kind":"beta-pert","min":0.1,"mode":0.4,"max":2.0}',
     '{"kind":"lognormal","mean":320000,"stdev":95000}'),
    ('t_astar','Research data exfiltration via misconfigured S3',
     'PII-containing research dataset exposed via misconfigured S3 bucket.',
     '{"kind":"beta-pert","min":0.2,"mode":0.6,"max":2.5}',
     '{"kind":"lognormal","mean":180000,"stdev":62000}'),
    ('t_astar','AI model training data poisoning',
     'Adversarial actor injects biased data into grant scoring classifier training pipeline.',
     '{"kind":"beta-pert","min":0.05,"mode":0.2,"max":1.0}',
     '{"kind":"lognormal","mean":140000,"stdev":48000}'),

    -- GovTech
    ('t_govtech','Singpass identity API compromise',
     'Targeted attack on Singpass API gateway exposes citizen identity tokens.',
     '{"kind":"beta-pert","min":0.1,"mode":0.3,"max":1.5}',
     '{"kind":"lognormal","mean":4200000,"stdev":1800000}'),
    ('t_govtech','AskGov chatbot disinformation via prompt injection',
     'Adversarial prompt causes AskGov LLM to serve incorrect government policy information to citizens.',
     '{"kind":"beta-pert","min":0.3,"mode":1.2,"max":5.0}',
     '{"kind":"lognormal","mean":650000,"stdev":220000}'),
    ('t_govtech','GovCloud availability degradation during national event',
     'GovCloud service degradation during National Day or NDP causing multi-agency portal outage.',
     '{"kind":"beta-pert","min":0.1,"mode":0.5,"max":2.0}',
     '{"kind":"lognormal","mean":950000,"stdev":310000}'),

    -- Mediacorp
    ('t_mediacorp','meWATCH CDN outage during major live event',
     'CDN provider failure causes streaming outage during National Day Parade broadcast.',
     '{"kind":"beta-pert","min":0.2,"mode":0.8,"max":3.0}',
     '{"kind":"lognormal","mean":420000,"stdev":140000}'),
    ('t_mediacorp','Viewer PII breach via recommendation engine log exposure',
     'Recommendation engine logs containing viewer PII exposed via misconfigured logging pipeline.',
     '{"kind":"beta-pert","min":0.1,"mode":0.4,"max":1.5}',
     '{"kind":"lognormal","mean":280000,"stdev":95000}'),
    ('t_mediacorp','DRM bypass enabling content piracy',
     'Adversary exploits DRM vulnerability enabling large-scale piracy of licensed Mediacorp content.',
     '{"kind":"beta-pert","min":0.3,"mode":1.0,"max":4.0}',
     '{"kind":"lognormal","mean":1800000,"stdev":650000}'),

    -- SingHealth
    ('t_singhealth','EMR ransomware attack',
     'Ransomware targeting EPIC EMR causes clinical data unavailability across SGH cluster.',
     '{"kind":"beta-pert","min":0.05,"mode":0.2,"max":0.8}',
     '{"kind":"lognormal","mean":8500000,"stdev":3200000}'),
    ('t_singhealth','Patient data breach via third-party integration',
     'Vendor API integration exposes patient demographic and appointment data.',
     '{"kind":"beta-pert","min":0.1,"mode":0.5,"max":2.0}',
     '{"kind":"lognormal","mean":2100000,"stdev":780000}'),
    ('t_singhealth','Clinical AI model producing incorrect deterioration alerts',
     'Clinical Deterioration Predictor model drift causes missed alerts or false positives in ICU.',
     '{"kind":"beta-pert","min":0.2,"mode":0.8,"max":3.0}',
     '{"kind":"lognormal","mean":1200000,"stdev":450000}'),

    -- Singtel
    ('t_singtel','Core network BGP route manipulation',
     'Adversary manipulates BGP advertisements causing widespread network disruption.',
     '{"kind":"beta-pert","min":0.1,"mode":0.4,"max":1.5}',
     '{"kind":"lognormal","mean":12000000,"stdev":4500000}'),
    ('t_singtel','Customer PII breach via billing system',
     'SQL injection on billing portal exposes 500K+ customer records.',
     '{"kind":"beta-pert","min":0.2,"mode":0.7,"max":2.5}',
     '{"kind":"lognormal","mean":3800000,"stdev":1400000}'),
    ('t_singtel','Network operations DDoS attack',
     'Sustained DDoS targeting network management plane causes NOC visibility degradation.',
     '{"kind":"beta-pert","min":0.4,"mode":1.5,"max":6.0}',
     '{"kind":"lognormal","mean":2200000,"stdev":820000}')
  ) AS v(tenant_id, name, description, freq_dist, mag_dist)
  WHERE NOT EXISTS (
    SELECT 1 FROM risk.scenarios s WHERE s.tenant_id = v.tenant_id AND s.name = v.name
  )
  RETURNING id, tenant_id
)
INSERT INTO risk.fair_runs
  (tenant_id, scenario_id, trials, lec_percentiles, ale_sgd, aro, run_at)
SELECT ns.tenant_id, ns.id, 10000,
  jsonb_build_object(
    'p10', round((random() * 200000 + 50000)::numeric, -3),
    'p25', round((random() * 400000 + 200000)::numeric, -3),
    'p50', round((random() * 800000 + 500000)::numeric, -3),
    'p75', round((random() * 1500000 + 1000000)::numeric, -3),
    'p90', round((random() * 3000000 + 2000000)::numeric, -3),
    'p95', round((random() * 5000000 + 3500000)::numeric, -3)
  ),
  round((random() * 600000 + 200000)::numeric, -3),
  round((random() * 0.8 + 0.2)::numeric, 4),
  now() - make_interval(days => abs(hashtext(ns.id::text)) % 45)
FROM new_scenarios ns;
