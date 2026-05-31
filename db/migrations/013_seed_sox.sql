-- Migration 013: Seed SOX ITGCs, KCAs, walkthroughs, and deficiencies for hero tenants
-- Without this, all SOX queries fall back to mock data in pg mode.

-- ITGCs (Key IT General Controls) — Maybank: 20, Grab: 12
INSERT INTO sox.itgcs (id, tenant_id, control_ref, title, description, objective, control_type, frequency, status, tested_at) VALUES
-- Maybank Access controls
(uuid_generate_v4(), 't_maybank', 'MAYX-ITGC-001', 'Privileged access requires approval',      'All privileged access requests must be approved by two senior managers.', 'Prevent unauthorised privileged access to production systems.',         'manual',       'monthly',     'effective',   now() - interval '15 days'),
(uuid_generate_v4(), 't_maybank', 'MAYX-ITGC-002', 'Joiners/movers/leavers reviewed monthly',   'HR access lifecycle events reviewed against AD/IdP within 30 days.',     'Ensure access rights reflect current employment status.',               'it-dependent', 'monthly',     'effective',   now() - interval '20 days'),
(uuid_generate_v4(), 't_maybank', 'MAYX-ITGC-003', 'Service accounts rotated quarterly',        'Service account credentials rotated and reviewed each quarter.',          'Reduce risk from stale or shared service credentials.',                 'automated',    'quarterly',   'effective',   now() - interval '30 days'),
(uuid_generate_v4(), 't_maybank', 'MAYX-ITGC-004', 'MFA enforced on all production access',     'TOTP or hardware key required for all production access.',                'Prevent credential stuffing and phishing-based access.',                'automated',    'continuous',  'effective',   now() - interval '5 days'),
(uuid_generate_v4(), 't_maybank', 'MAYX-ITGC-005', 'Segregation of duties enforced',            'SoD matrix maintained; conflicts reviewed and approved or compensated.',  'Prevent single actor from initiating and approving transactions.',      'manual',       'quarterly',   'effective',   now() - interval '45 days'),
(uuid_generate_v4(), 't_maybank', 'MAYX-ITGC-006', 'Vendor access tokens reviewed',             'Third-party API tokens and certificates inventoried and reviewed.',       'Limit vendor access to authorised integrations only.',                  'manual',       'quarterly',   'effective',   now() - interval '60 days'),
(uuid_generate_v4(), 't_maybank', 'MAYX-ITGC-007', 'PAM session recording active',              'Privileged sessions recorded and retained 90 days via CyberArk.',        'Provide forensic trail for all privileged actions.',                    'automated',    'continuous',  'effective',   now() - interval '3 days'),
-- Maybank Change controls
(uuid_generate_v4(), 't_maybank', 'MAYX-ITGC-008', 'Production change requires CAB approval',   'All production changes approved by Change Advisory Board.',               'Ensure changes are risk-assessed before deployment.',                   'manual',       'monthly',     'effective',   now() - interval '18 days'),
(uuid_generate_v4(), 't_maybank', 'MAYX-ITGC-009', 'Code reviewed before merge to main',        'Minimum two-reviewer rule enforced via branch protection.',               'Catch defects and unauthorised changes before production.',             'automated',    'continuous',  'effective',   now() - interval '2 days'),
(uuid_generate_v4(), 't_maybank', 'MAYX-ITGC-010', 'DB schema changes peer-reviewed',           'Database migration scripts reviewed by DBA before execution.',            'Prevent uncontrolled schema drift in production databases.',            'manual',       'monthly',     'deficiency',  now() - interval '90 days'),
(uuid_generate_v4(), 't_maybank', 'MAYX-ITGC-011', 'CI/CD pipeline tamper-protected',           'Pipeline configuration stored in SCM; changes require approval.',        'Prevent malicious code injection through build tooling.',               'automated',    'continuous',  'effective',   now() - interval '7 days'),
(uuid_generate_v4(), 't_maybank', 'MAYX-ITGC-012', 'Emergency change post-review',              'All emergency changes reviewed within 48 hours by risk owner.',           'Ensure emergency changes meet security standards post-deployment.',     'manual',       'monthly',     'effective',   now() - interval '25 days'),
-- Maybank Operations controls
(uuid_generate_v4(), 't_maybank', 'MAYX-ITGC-013', 'Backups verified weekly',                   'Backup completion and restore testing confirmed every 7 days.',           'Ensure data recovery is possible in line with RPO targets.',            'automated',    'monthly',     'effective',   now() - interval '4 days'),
(uuid_generate_v4(), 't_maybank', 'MAYX-ITGC-014', 'Capacity reviewed monthly',                 'CPU, memory and storage utilisation reviewed against thresholds.',        'Prevent performance degradation from resource exhaustion.',             'manual',       'monthly',     'effective',   now() - interval '12 days'),
(uuid_generate_v4(), 't_maybank', 'MAYX-ITGC-015', 'Patch cadence < 30 days',                   'Critical and high CVEs patched within 30 days of disclosure.',            'Reduce attack surface from known vulnerabilities.',                     'it-dependent', 'monthly',     'effective',   now() - interval '8 days'),
(uuid_generate_v4(), 't_maybank', 'MAYX-ITGC-016', 'Vulnerability scan weekly',                 'Authenticated vulnerability scans run on all production hosts weekly.',   'Maintain continuous visibility of vulnerability exposure.',             'automated',    'continuous',  'effective',   now() - interval '1 days'),
(uuid_generate_v4(), 't_maybank', 'MAYX-ITGC-017', 'Log retention 1+ year',                     'Security and application logs retained for minimum 13 months.',           'Meet regulatory log retention requirements (MAS TRM 9.4).',            'automated',    'continuous',  'effective',   now() - interval '1 days'),
(uuid_generate_v4(), 't_maybank', 'MAYX-ITGC-018', 'Disk encryption at rest enforced',          'All production storage volumes encrypted with AES-256.',                 'Protect data at rest from physical or logical unauthorised access.',    'automated',    'continuously','effective',   now() - interval '1 days'),
(uuid_generate_v4(), 't_maybank', 'MAYX-ITGC-019', 'Incident bridge < 15 min',                  'P1 incidents bridged within 15 minutes of detection.',                    'Minimise mean time to engage for critical incidents.',                  'manual',       'quarterly',   'effective',   now() - interval '30 days'),
(uuid_generate_v4(), 't_maybank', 'MAYX-ITGC-020', 'DR rehearsal annual',                       'Full disaster recovery exercise conducted annually with RTO/RPO proof.',  'Verify recovery capability meets regulatory RTO/RPO commitments.',      'manual',       'annually',    'effective',   now() - interval '180 days'),
-- Grab ITGCs (12 controls)
(uuid_generate_v4(), 't_grab',    'GRAB-ITGC-001', 'Privileged access requires approval',       'All privileged access requests require dual approval.',                   'Prevent unauthorised privileged access.',                               'manual',       'monthly',     'effective',   now() - interval '22 days'),
(uuid_generate_v4(), 't_grab',    'GRAB-ITGC-002', 'Joiners/movers/leavers reviewed monthly',   'Access lifecycle events reviewed monthly.',                               'Ensure access reflects employment status.',                             'it-dependent', 'monthly',     'effective',   now() - interval '28 days'),
(uuid_generate_v4(), 't_grab',    'GRAB-ITGC-003', 'MFA on all production systems',             'MFA required for all production access.',                                 'Prevent credential-based attacks.',                                     'automated',    'continuous',  'effective',   now() - interval '4 days'),
(uuid_generate_v4(), 't_grab',    'GRAB-ITGC-004', 'Production changes CAB-approved',           'All changes reviewed and approved by CAB.',                               'Prevent unauthorised production changes.',                              'manual',       'monthly',     'effective',   now() - interval '16 days'),
(uuid_generate_v4(), 't_grab',    'GRAB-ITGC-005', 'Code reviewed before production merge',     'All code requires peer review before merge.',                             'Catch defects before production.',                                      'automated',    'continuous',  'effective',   now() - interval '3 days'),
(uuid_generate_v4(), 't_grab',    'GRAB-ITGC-006', 'Backups verified weekly',                   'Backup verification run every 7 days.',                                   'Ensure data recovery meets RPO.',                                       'automated',    'monthly',     'effective',   now() - interval '6 days'),
(uuid_generate_v4(), 't_grab',    'GRAB-ITGC-007', 'Vulnerability scan weekly',                 'Weekly authenticated scans on all production hosts.',                     'Continuous vulnerability visibility.',                                  'automated',    'continuous',  'effective',   now() - interval '2 days'),
(uuid_generate_v4(), 't_grab',    'GRAB-ITGC-008', 'Patch cadence < 30 days',                   'Critical CVEs patched within 30 days.',                                   'Reduce known vulnerability exposure.',                                  'it-dependent', 'monthly',     'effective',   now() - interval '10 days'),
(uuid_generate_v4(), 't_grab',    'GRAB-ITGC-009', 'Log retention 1+ year',                     'Logs retained for 13 months minimum.',                                    'Meet regulatory retention requirements.',                               'automated',    'continuous',  'effective',   now() - interval '1 days'),
(uuid_generate_v4(), 't_grab',    'GRAB-ITGC-010', 'Segregation of duties enforced',            'SoD conflicts reviewed quarterly.',                                       'Prevent single-actor fraud.',                                          'manual',       'quarterly',   'effective',   now() - interval '40 days'),
(uuid_generate_v4(), 't_grab',    'GRAB-ITGC-011', 'Disk encryption at rest',                   'All volumes AES-256 encrypted.',                                          'Protect data at rest.',                                                 'automated',    'continuous',  'effective',   now() - interval '1 days'),
(uuid_generate_v4(), 't_grab',    'GRAB-ITGC-012', 'DR rehearsal annual',                       'Annual DR exercise with RTO/RPO validation.',                             'Verify recovery capability.',                                          'manual',       'annually',    'effective',   now() - interval '200 days')
ON CONFLICT (tenant_id, control_ref) DO NOTHING;

-- KCAs (Key Control Attributes) — 3 per ITGC for Maybank's first 10, 2 per ITGC for Grab
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT
  i.tenant_id,
  i.id,
  a.attr,
  a.val,
  i.tested_at
FROM sox.itgcs i
CROSS JOIN LATERAL (VALUES
  ('design_effectiveness',     'Satisfactory'),
  ('operating_effectiveness',  CASE WHEN i.status = 'effective' THEN 'Satisfactory' ELSE 'Needs Improvement' END),
  ('evidence_quality',         'Adequate')
) AS a(attr, val)
WHERE i.tenant_id IN ('t_maybank', 't_grab')
ON CONFLICT DO NOTHING;

-- Walkthroughs — one completed walkthrough per ITGC
INSERT INTO sox.walkthroughs (tenant_id, itgc_id, description, completed_at, evidence_link)
SELECT
  i.tenant_id,
  i.id,
  'Walkthrough of ' || i.title || ' — evidence obtained from ' ||
    CASE i.control_type
      WHEN 'automated'    THEN 'system logs and configuration exports'
      WHEN 'it-dependent' THEN 'system outputs and manual confirmation'
      ELSE 'management review and sign-off documentation'
    END,
  i.tested_at,
  'https://grc.internal/sox/evidence/' || i.control_ref
FROM sox.itgcs i
WHERE i.tenant_id IN ('t_maybank', 't_grab')
ON CONFLICT DO NOTHING;

-- Deficiencies — for the two 'deficient' controls (MAYX-ITGC-010 and any others)
INSERT INTO sox.deficiencies (tenant_id, itgc_id, severity, description, remediation_plan, root_cause)
SELECT
  i.tenant_id,
  i.id,
  'significant'::sox.deficiency_sev,
  'Control operating effectiveness rated as Needs Improvement. Peer review of database schema changes not consistently performed; 3 of 12 sampled changes lacked reviewer sign-off.',
  'Enforce branch protection rule requiring DBA review before schema migration merges. Track compliance in monthly CAB report.',
  'Review process relies on informal communication; no automated gate in CI/CD pipeline enforced DBA approval before schema migrations could proceed.'
FROM sox.itgcs i
WHERE i.status = 'deficiency'
  AND i.tenant_id IN ('t_maybank', 't_grab')
ON CONFLICT DO NOTHING;

\echo ' >> sox seed data inserted'
