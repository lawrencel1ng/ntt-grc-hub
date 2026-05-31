-- Migration 056: Add BCM plans and tests for 5 small tenants.
-- Only Grab, Maybank, MINDEF have BCM plans; A*STAR, GovTech, Mediacorp,
-- SingHealth, Singtel have none. Adds 3 plans per tenant with 2 tests each.
-- Idempotent: INSERT WHERE NOT EXISTS (matching tenant + name).

WITH new_plans AS (
  INSERT INTO bcm.plans
    (tenant_id, name, business_service, rto_minutes, rpo_minutes,
     last_tested_at, next_test_at, created_at, description)
  SELECT v.tenant_id, v.name, v.business_service,
         v.rto_minutes, v.rpo_minutes,
         v.last_tested_at, v.next_test_at, v.created_at, v.description
  FROM (VALUES
    ('t_astar','BCP — Research IT Systems','Research Compute & Data',240,60,
     now() - interval '45 days', now() + interval '45 days',
     now() - interval '180 days',
     'Continuity plan for HPC clusters and research data repositories supporting active grants.'),
    ('t_astar','BCP — Grant Administration','Grant Management Portal',480,120,
     now() - interval '60 days', now() + interval '30 days',
     now() - interval '150 days',
     'Ensures uninterrupted grant submission and disbursement workflows.'),
    ('t_astar','BCP — Laboratory Information Systems','LIMS / Lab Operations',720,240,
     now() - interval '90 days', now() + interval '10 days',
     now() - interval '200 days',
     'Covers LIMS, instrument data capture, and biosafety reporting.'),

    ('t_govtech','BCP — Government Digital Services','Citizen-Facing Portals',60,15,
     now() - interval '20 days', now() + interval '70 days',
     now() - interval '120 days',
     'Critical path recovery for Singpass, MyInfo, and CorpPass integrations.'),
    ('t_govtech','BCP — Developer Platform','SHIP-HATS / CI-CD',240,60,
     now() - interval '35 days', now() + interval '55 days',
     now() - interval '100 days',
     'Continuity for centralised DevSecOps platform serving 140+ government agencies.'),
    ('t_govtech','BCP — Data Exchange Infrastructure','Apex API Gateway',120,30,
     now() - interval '55 days', now() + interval '35 days',
     now() - interval '140 days',
     'API gateway and whole-of-government data exchange backbone continuity.'),

    ('t_mediacorp','BCP — Broadcast Transmission','Linear TV / Radio Broadcast',30,5,
     now() - interval '25 days', now() + interval '65 days',
     now() - interval '110 days',
     'Covers terrestrial TV and radio transmission failover to redundant transmitters.'),
    ('t_mediacorp','BCP — Digital Publishing','meWatch / Digital Platforms',240,60,
     now() - interval '40 days', now() + interval '50 days',
     now() - interval '130 days',
     'Streaming platform continuity and content delivery network failover procedures.'),
    ('t_mediacorp','BCP — Production Systems','Post-Production & Playout',480,120,
     now() - interval '70 days', now() + interval '20 days',
     now() - interval '160 days',
     'Newsroom systems, editing suites, and broadcast playout continuity.'),

    ('t_singhealth','BCP — Clinical Information Systems','Electronic Medical Records',30,5,
     now() - interval '15 days', now() + interval '75 days',
     now() - interval '90 days',
     'EMR, patient administration, and clinical decision support continuity per MAS 655 T1.'),
    ('t_singhealth','BCP — Pharmacy and Dispensing','Pharmacy Operations',60,15,
     now() - interval '45 days', now() + interval '45 days',
     now() - interval '120 days',
     'Medication dispensing, drug interaction checks, and e-prescription continuity.'),
    ('t_singhealth','BCP — Medical Imaging','PACS / Radiology Systems',120,30,
     now() - interval '80 days', now() + interval '10 days',
     now() - interval '150 days',
     'PACS, RIS, and teleradiology network continuity for cluster-wide imaging.'),

    ('t_singtel','BCP — Network Operations Centre','Core Network Infrastructure',15,5,
     now() - interval '10 days', now() + interval '80 days',
     now() - interval '80 days',
     'Continuity for NOC, backbone switching, and international gateway links.'),
    ('t_singtel','BCP — Customer Services Platform','Customer Portal & BSS',240,60,
     now() - interval '50 days', now() + interval '40 days',
     now() - interval '140 days',
     'Billing, CRM, and self-service portal continuity for consumer and enterprise customers.'),
    ('t_singtel','BCP — Managed Security Services','SOC & MSSP Operations',60,15,
     now() - interval '35 days', now() + interval '55 days',
     now() - interval '110 days',
     'Security operations centre and managed services continuity for enterprise clients.')
  ) AS v(tenant_id, name, business_service, rto_minutes, rpo_minutes,
         last_tested_at, next_test_at, created_at, description)
  WHERE NOT EXISTS (
    SELECT 1 FROM bcm.plans p WHERE p.tenant_id = v.tenant_id AND p.name = v.name
  )
  RETURNING id, tenant_id
)
INSERT INTO bcm.tests (tenant_id, plan_id, kind, conducted_at, result, lessons_md)
SELECT p.tenant_id, p.id,
  (ARRAY['tabletop','walkthrough','simulation'])[abs(hashtext(p.id::text || t.n::text)) % 3 + 1],
  now() - make_interval(days => 15 + (abs(hashtext(p.id::text || 'day' || t.n::text)) % 60)),
  ((ARRAY['pass','pass','partial','fail'])[abs(hashtext(p.id::text || 'res' || t.n::text)) % 4 + 1])::bcm.test_result,
  (ARRAY[
    'Exercise completed successfully. RTO/RPO objectives met within tolerance.',
    'Walkthrough identified 2 gaps in notification tree. Owner assigned remediation tasks.',
    'Simulation revealed dependency on single vendor for remote access. DR site validated.',
    'Full tabletop completed. All critical roles performed expected actions within timeline.',
    'Partial failure mode observed in data replication. Failover DNS TTL reduction recommended.'
  ])[abs(hashtext(p.id::text || 'note' || t.n::text)) % 5 + 1]
FROM new_plans p
CROSS JOIN generate_series(1, 2) AS t(n);
