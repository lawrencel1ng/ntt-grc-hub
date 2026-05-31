-- Migration 035: Seed SOX IT General Controls data for Maybank Singapore and Grab Fintech APAC
-- Idempotent: ITGCs use ON CONFLICT (tenant_id, control_ref) DO NOTHING.
-- KCAs, walkthroughs and deficiencies use WHERE NOT EXISTS guards scoped to
-- the specific control_ref so re-runs are safe.
--
-- Control taxonomy:
--   User Access Management        MBBK-ITGC-001 to 004  /  GRAB-ITGC-001 to 003
--   Privileged Access Controls    MBBK-ITGC-005 to 007  /  GRAB-ITGC-004 to 005
--   Change Management             MBBK-ITGC-008 to 011  /  GRAB-ITGC-006 to 008
--   Incident & Problem Mgmt       MBBK-ITGC-012 to 013  /  GRAB-ITGC-009
--   Backup & Recovery             MBBK-ITGC-014 to 015  /  GRAB-ITGC-010
--   Computer Operations           MBBK-ITGC-016         /  GRAB-ITGC-011
--   Data Centre Security          MBBK-ITGC-017         /  GRAB-ITGC-012
--   Financial Close Process       MBBK-ITGC-018
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- PART 1 — ITGCs
-- ===========================================================================

INSERT INTO sox.itgcs
  (id, tenant_id, control_ref, title, description, objective,
   control_type, frequency, status, tested_at)
VALUES

-- -----------------------------------------------------------------------
-- MAYBANK SINGAPORE (18 controls)
-- -----------------------------------------------------------------------

-- User Access Management (4)
(uuid_generate_v4(), 't_maybank', 'MBBK-ITGC-001',
 'User Access Provisioning and Approval',
 'All new user access requests to in-scope financial systems must be approved by the system owner and the user''s direct manager before provisioning. Requests are logged in the Identity Governance platform with a reference number and linked to the HR joiner record.',
 'Ensure that access to systems processing financial data is granted only to authorised personnel with a valid business need, in line with the principle of least privilege.',
 'manual', 'per-event', 'effective',
 now() - interval '18 days'),

(uuid_generate_v4(), 't_maybank', 'MBBK-ITGC-002',
 'Periodic User Access Review — In-Scope Financial Systems',
 'Quarterly access recertification is performed by system owners for all accounts with access to general ledger, accounts payable, treasury and core banking systems. Reviewers confirm, revoke or modify access; results are documented and retained for audit.',
 'Detect and remediate inappropriate or excessive access rights on a timely basis, ensuring access remains aligned with current job responsibilities.',
 'itdm', 'quarterly', 'effective',
 now() - interval '22 days'),

(uuid_generate_v4(), 't_maybank', 'MBBK-ITGC-003',
 'Timely Revocation of Access for Terminated Employees',
 'Upon receipt of an HR termination notification, the Identity Governance platform triggers an automated workflow to disable all active accounts within four business hours. Physical access cards and VPN tokens are decommissioned within the same window. Compliance is measured via a daily exception report reviewed by the IAM team.',
 'Prevent former employees from retaining access to financial systems after employment ends, reducing the risk of unauthorised transactions or data exfiltration.',
 'automated', 'per-event', 'effective',
 now() - interval '10 days'),

(uuid_generate_v4(), 't_maybank', 'MBBK-ITGC-004',
 'Role-Based Access Control and Segregation of Duties Matrix',
 'An SoD matrix is maintained for all in-scope financial applications. Conflicting role combinations (e.g., payment initiation and payment approval within the same user account) are blocked at the system level. Residual conflicts escalated as compensating controls are reviewed and approved by the Chief Risk Officer on a quarterly basis.',
 'Prevent a single individual from executing conflicting transactions that could result in fraud or material misstatement of financial statements.',
 'itdm', 'quarterly', 'effective',
 now() - interval '35 days'),

-- Privileged Access Controls (3)
(uuid_generate_v4(), 't_maybank', 'MBBK-ITGC-005',
 'Privileged Access Management via PAM Vault',
 'All privileged accounts (database administrators, system administrators, cloud infrastructure engineers) are managed through the CyberArk Privileged Access Management vault. Passwords are rotated automatically after each use. Sessions are fully recorded and retained for 12 months. Privileged access outside the vault is prohibited and detected via SIEM alerting.',
 'Ensure that privileged access to production systems is controlled, monitored and auditable to prevent unauthorised configuration changes or data access.',
 'automated', 'continuous', 'effective',
 now() - interval '5 days'),

(uuid_generate_v4(), 't_maybank', 'MBBK-ITGC-006',
 'Dual Authorisation for Privileged Standing Access',
 'Requests to grant standing (non-just-in-time) privileged access require approval from both the system owner and the Information Security Officer. Approvals are documented with a stated business justification and expire after 90 days unless explicitly renewed.',
 'Limit standing privileged access to exceptional, audited cases and ensure that any grant has appropriate dual-control oversight.',
 'manual', 'quarterly', 'effective',
 now() - interval '42 days'),

(uuid_generate_v4(), 't_maybank', 'MBBK-ITGC-007',
 'Service Account Inventory and Credential Rotation',
 'All service accounts used by in-scope applications are registered in the service account register. Credentials are rotated at least quarterly via the PAM vault secrets manager. Unregistered service accounts detected by the automated discovery scan are flagged for remediation within 10 business days.',
 'Reduce the risk from stale, shared or undocumented service account credentials that could be exploited to gain persistent access to financial systems.',
 'automated', 'quarterly', 'effective',
 now() - interval '28 days'),

-- Change Management (4)
(uuid_generate_v4(), 't_maybank', 'MBBK-ITGC-008',
 'Change Advisory Board Approval for Production Changes',
 'All normal production changes to in-scope systems must be approved by the Change Advisory Board (CAB) prior to deployment. CAB meets weekly and reviews risk assessments, test evidence and rollback plans. Emergency changes follow the expedited approval process and are ratified at the next CAB meeting.',
 'Ensure that production changes are appropriately risk-assessed, tested and authorised to prevent system instability, unauthorised modifications or financial misstatement.',
 'manual', 'weekly', 'effective',
 now() - interval '14 days'),

(uuid_generate_v4(), 't_maybank', 'MBBK-ITGC-009',
 'Code Review and Branch Protection Enforcement',
 'Branch protection rules in the source code management platform require a minimum of two reviewer approvals (including one senior engineer) before any code can be merged to the main branch. Status checks must pass before merging. Direct pushes to main are blocked for all users including administrators.',
 'Prevent unauthorised or untested code from reaching production and provide a peer-review gate that can identify logic errors, security vulnerabilities or malicious changes.',
 'automated', 'continuous', 'effective',
 now() - interval '3 days'),

(uuid_generate_v4(), 't_maybank', 'MBBK-ITGC-010',
 'Database Schema Change Control and DBA Review',
 'All database schema migration scripts must be reviewed and approved by a designated Database Administrator (DBA) before execution in production. Scripts are submitted via pull request and must pass automated syntax and impact analysis checks. DBA sign-off is recorded in the change management system.',
 'Prevent uncontrolled or erroneous schema changes that could corrupt financial data, break application integrity checks, or bypass audit trail mechanisms.',
 'manual', 'per-event', 'deficiency',
 now() - interval '95 days'),

(uuid_generate_v4(), 't_maybank', 'MBBK-ITGC-011',
 'CI/CD Pipeline Integrity and Tamper Protection',
 'CI/CD pipeline configuration files are stored in the source code management system and subject to the same branch protection controls as application code. Pipeline build artefacts are signed and the signature is verified before deployment. Any changes to pipeline configuration generate an alert to the Security Operations Centre.',
 'Prevent malicious actors from altering the build and deployment pipeline to inject unauthorised code or bypass security controls during the delivery process.',
 'automated', 'continuous', 'effective',
 now() - interval '7 days'),

-- Incident & Problem Management (2)
(uuid_generate_v4(), 't_maybank', 'MBBK-ITGC-012',
 'Critical Incident Response and Escalation Procedure',
 'Priority 1 and Priority 2 incidents affecting in-scope financial systems are managed under the Major Incident Response Procedure. An incident bridge is convened within 15 minutes of P1 detection. The Incident Manager provides status updates every 30 minutes to senior management and the Chief Information Officer. Post-Incident Reviews are completed within five business days.',
 'Ensure that critical incidents impacting the availability or integrity of financial processing systems are responded to in a timely, coordinated and documented manner.',
 'manual', 'per-event', 'effective',
 now() - interval '30 days'),

(uuid_generate_v4(), 't_maybank', 'MBBK-ITGC-013',
 'Problem Management and Root Cause Elimination',
 'Recurring incidents are escalated to the Problem Management process. Problem records are raised within two business days of the third recurrence of the same incident category. Root cause analyses (RCAs) are completed within 15 business days and include a permanent fix plan with tracked remediation milestones.',
 'Address underlying causes of recurring IT incidents to reduce the frequency and impact of disruptions to financial systems and maintain data integrity.',
 'manual', 'monthly', 'effective',
 now() - interval '45 days'),

-- Backup & Recovery (2)
(uuid_generate_v4(), 't_maybank', 'MBBK-ITGC-014',
 'Automated Backup and Integrity Verification',
 'Production databases and critical application configurations are backed up daily using automated jobs. Backup completion status is reported to the Operations Monitoring dashboard. A restore test is performed every 30 days on a randomly selected backup set to verify data integrity and recoverability. Failures trigger an immediate alert to the Infrastructure Manager.',
 'Ensure that financial data can be recovered to a known good state in the event of corruption, accidental deletion or a ransomware attack, meeting the mandated Recovery Point Objective of four hours.',
 'automated', 'daily', 'effective',
 now() - interval '8 days'),

(uuid_generate_v4(), 't_maybank', 'MBBK-ITGC-015',
 'Disaster Recovery Testing and RTO/RPO Validation',
 'A full disaster recovery exercise is conducted at least annually, with a tabletop simulation each half-year. The exercise validates recovery to the DR site within the mandated Recovery Time Objective of six hours and Recovery Point Objective of four hours. Results, including any gaps, are reported to the Board Risk Committee.',
 'Validate that the disaster recovery capability for in-scope financial systems meets the regulatory and business continuity requirements stipulated under MAS Notice 644 and the Board-approved Business Continuity Policy.',
 'manual', 'annually', 'effective',
 now() - interval '160 days'),

-- Computer Operations (1)
(uuid_generate_v4(), 't_maybank', 'MBBK-ITGC-016',
 'Patch Management — Critical and High Severity Vulnerabilities',
 'Critical (CVSS 9.0+) and high (CVSS 7.0–8.9) vulnerabilities identified in production systems must be remediated within 14 and 30 days of vendor disclosure respectively. Patch compliance is tracked in the vulnerability management platform and reported monthly to the Information Security Steering Committee. Exceptions require documented risk acceptance from the CISO.',
 'Reduce the attack surface of in-scope financial systems by ensuring known vulnerabilities are patched within risk-based timelines, consistent with MAS Technology Risk Management Guidelines Section 12.',
 'itdm', 'monthly', 'effective',
 now() - interval '12 days'),

-- Data Centre Security (1)
(uuid_generate_v4(), 't_maybank', 'MBBK-ITGC-017',
 'Data Centre Physical Access Control and Visitor Management',
 'Access to Maybank''s Tier-3 primary data centre and the co-location DR site is restricted to authorised personnel only. Access is granted via multi-factor biometric and proximity card control. All visitor access is escorted by an authorised staff member. The access log is reviewed monthly by the Facilities Security Manager and any anomalies are reported to Information Security.',
 'Prevent unauthorised physical access to IT infrastructure hosting financial systems, protecting against hardware tampering, theft of storage media or disruption of critical systems.',
 'manual', 'monthly', 'effective',
 now() - interval '20 days'),

-- Financial Close Process (1)
(uuid_generate_v4(), 't_maybank', 'MBBK-ITGC-018',
 'Financial Close — IT Automated Controls and Interface Reconciliation',
 'Automated interface reconciliation jobs run nightly during the monthly financial close period to confirm that all journal entries and sub-ledger postings transmitted to the general ledger have been received and posted without discrepancy. Exception reports are reviewed by the Financial Controller within one business day. Unreconciled items exceeding SGD 10,000 are escalated to the CFO.',
 'Ensure the completeness and accuracy of financial data flowing through automated interfaces between operational systems and the general ledger, reducing the risk of undetected processing errors during the financial reporting cycle.',
 'automated', 'monthly', 'effective',
 now() - interval '16 days'),

-- -----------------------------------------------------------------------
-- GRAB FINTECH APAC (12 controls)
-- -----------------------------------------------------------------------

-- User Access Management (3)
(uuid_generate_v4(), 't_grab', 'GRAB-ITGC-001',
 'User Access Provisioning and Joiner-Mover-Leaver Process',
 'Access to in-scope fintech systems (payment processing, lending ledger, e-money float management) is provisioned via the ServiceNow-integrated Identity Governance workflow. All requests require manager and system owner approval. Quarterly access reviews are performed; leavers'' access is revoked within two business hours of HR notification.',
 'Ensure that access to financial processing systems is granted only to personnel with a legitimate business need, and that access changes are reflected promptly to minimise the window of inappropriate access.',
 'itdm', 'quarterly', 'effective',
 now() - interval '25 days'),

(uuid_generate_v4(), 't_grab', 'GRAB-ITGC-002',
 'Segregation of Duties — Payment Initiation and Approval',
 'The payment platform enforces system-level controls that prevent any single user from both creating and approving payment transactions. The SoD ruleset is reviewed quarterly. Conflicts identified through automated SoD monitoring are resolved within 15 business days; approved compensating controls are documented and reviewed by the Internal Audit function.',
 'Prevent a single individual from unilaterally initiating and approving outbound payments, reducing the risk of fraudulent or erroneous fund transfers.',
 'automated', 'quarterly', 'effective',
 now() - interval '38 days'),

(uuid_generate_v4(), 't_grab', 'GRAB-ITGC-003',
 'Multi-Factor Authentication Enforcement on Production Systems',
 'MFA is enforced for all production system access including cloud management consoles, core banking adapters, and CI/CD tooling. Hardware security keys (FIDO2) are required for privileged access. Compliance is measured via the identity provider policy report reviewed weekly by the IAM team. Non-compliant accounts are disabled automatically after a 48-hour grace period.',
 'Reduce the risk of account compromise through credential theft or phishing by requiring a second factor for all production access, consistent with MAS TRM Guidelines Section 11.2.',
 'automated', 'continuous', 'effective',
 now() - interval '6 days'),

-- Privileged Access Controls (2)
(uuid_generate_v4(), 't_grab', 'GRAB-ITGC-004',
 'Just-in-Time Privileged Access and Session Recording',
 'Privileged access to cloud production environments is granted on a just-in-time basis through the HashiCorp Vault-integrated PAM solution. Sessions are recorded and stored for 12 months. Approved access windows are limited to a maximum of four hours. Anomalous privileged session behaviour triggers an automated SIEM alert within five minutes.',
 'Eliminate standing privileged access to production infrastructure, ensuring that all administrative activity is time-bounded, justified and fully auditable.',
 'automated', 'continuous', 'effective',
 now() - interval '4 days'),

(uuid_generate_v4(), 't_grab', 'GRAB-ITGC-005',
 'Service Account Lifecycle Management and Secret Rotation',
 'All service accounts and API keys used by in-scope applications are registered in the secrets management platform. Secrets are rotated automatically every 90 days or immediately upon suspected compromise. Unregistered secrets detected by automated scanning are escalated as P2 security incidents. The service account register is reviewed quarterly by the Security Engineering lead.',
 'Ensure that service account credentials are managed in a controlled manner and rotated regularly to limit the exposure window from compromised credentials.',
 'automated', 'quarterly', 'effective',
 now() - interval '32 days'),

-- Change Management (3)
(uuid_generate_v4(), 't_grab', 'GRAB-ITGC-006',
 'Production Change Approval via Change Advisory Board',
 'All production deployments to in-scope fintech systems require CAB approval documented in Jira Service Management. Risk assessments, test plans and rollback procedures are mandatory inputs. Emergency changes follow a streamlined approval by the on-call Engineering Director and are ratified at the next weekly CAB.',
 'Ensure that changes to production systems are assessed for risk, tested and properly authorised before deployment to prevent system failures or financial data integrity issues.',
 'manual', 'weekly', 'effective',
 now() - interval '17 days'),

(uuid_generate_v4(), 't_grab', 'GRAB-ITGC-007',
 'Automated Code Review Gates and Static Analysis',
 'All code merged to the main branch must pass automated static analysis (SAST) and dependency vulnerability checks in addition to peer review by a minimum of two engineers. Branch protection rules block merges that fail quality or security gates. Results are reported to the Engineering Security Dashboard weekly.',
 'Prevent introduction of security vulnerabilities or logic defects into production code through automated pre-merge quality gates and mandatory peer review.',
 'automated', 'continuous', 'effective',
 now() - interval '2 days'),

(uuid_generate_v4(), 't_grab', 'GRAB-ITGC-008',
 'Environment Separation and Production Access Restriction',
 'Development, staging and production environments are strictly separated at the network and identity layer. Developer access to production data is prohibited; exceptions require CISO approval, are time-limited to four hours and are fully logged. Production configuration changes are deployed only via the approved CI/CD pipeline; direct SSH access to production hosts is blocked.',
 'Prevent accidental or deliberate misuse of production financial data during development activities and ensure all production changes go through formal release controls.',
 'automated', 'continuous', 'deficiency',
 now() - interval '80 days'),

-- Incident & Problem Management (1)
(uuid_generate_v4(), 't_grab', 'GRAB-ITGC-009',
 'Major Incident Management and Post-Incident Review',
 'Severity-1 incidents affecting payment processing, e-money float or lending systems trigger automatic PagerDuty escalation and an incident bridge within 10 minutes. Status updates are communicated every 20 minutes to stakeholders. Post-Incident Reviews are mandatory for all S1 and S2 incidents and must be completed within seven business days with documented corrective actions.',
 'Ensure critical incidents impacting financial operations are managed in a structured, transparent and timely manner, minimising disruption and capturing lessons learned to prevent recurrence.',
 'manual', 'per-event', 'effective',
 now() - interval '33 days'),

-- Backup & Recovery (1)
(uuid_generate_v4(), 't_grab', 'GRAB-ITGC-010',
 'Backup Verification and Recovery Testing',
 'Production databases supporting payment processing and the e-money float ledger are backed up hourly (transaction logs) and daily (full snapshots) to a geographically separate cloud region. Automated restore tests run weekly against the previous day''s backup. Recovery metrics (RTO and RPO actuals) are reviewed by the Head of Infrastructure monthly.',
 'Ensure financial transaction data can be recovered completely and accurately within the mandated RPO of one hour following a data loss event.',
 'automated', 'daily', 'effective',
 now() - interval '9 days'),

-- Computer Operations (1)
(uuid_generate_v4(), 't_grab', 'GRAB-ITGC-011',
 'Vulnerability Management and Patch Compliance Reporting',
 'Authenticated vulnerability scans are run weekly against all production hosts and cloud workloads. Critical vulnerabilities (CVSS 9.0+) must be remediated within seven days; high (CVSS 7.0–8.9) within 21 days. Patch compliance rates are reported to the Security Steering Committee monthly. Overdue items require written risk acceptance from the CISO.',
 'Maintain a current understanding of vulnerability exposure and ensure timely remediation to reduce the risk of exploitation of known weaknesses in financial system infrastructure.',
 'automated', 'weekly', 'effective',
 now() - interval '3 days'),

-- Data Centre Security (1)
(uuid_generate_v4(), 't_grab', 'GRAB-ITGC-012',
 'Cloud Infrastructure Security Baseline and CIS Benchmark Compliance',
 'All cloud accounts hosting in-scope fintech workloads are subject to continuous compliance monitoring against the CIS Benchmark (Level 2) and the Grab Cloud Security Standard. Deviations are flagged in the Cloud Security Posture Management (CSPM) tool and assigned to the relevant workload owner for remediation within 30 days. Compliance posture is reviewed monthly by the Cloud Security team.',
 'Ensure that cloud infrastructure hosting financial data is configured securely and consistently, reducing the attack surface and meeting MAS TRM cloud security requirements.',
 'automated', 'continuous', 'effective',
 now() - interval '11 days')

ON CONFLICT (tenant_id, control_ref) DO NOTHING;


-- ===========================================================================
-- PART 2 — KCA attributes (Key Control Attributes)
-- 2–3 attributes per ITGC, specific to each control''s nature
-- Uses WHERE NOT EXISTS scoped to (itgc_id, attribute) to be idempotent.
-- ===========================================================================

-- MBBK-ITGC-001: User Access Provisioning
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '18 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('Approval workflow configuration',         'Dual-approval rule active in IGA platform; no single-approver bypass permitted'),
  ('Evidence of approvals in population',     '100% of sampled provisioning requests (n=25) carried documented manager and system owner approval'),
  ('Linkage to HR joiner event',              'IGA platform API integration with HR system confirmed; provisioning blocked without active HR record')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-001'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- MBBK-ITGC-002: Periodic Access Review
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '22 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('Population completeness',                 'Access review population reconciled to Active Directory export; no accounts excluded without documented justification'),
  ('Reviewer response rate',                  '98.4% of accounts certified within the 30-day review window in the most recent quarterly cycle'),
  ('Timely revocation of rejected accounts',  'All rejected accounts (n=12) confirmed disabled within 48 hours per exception report reviewed by IAM lead')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-002'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- MBBK-ITGC-003: Termination Revocation
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '10 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('Automated trigger from HR system',        'HR termination event confirmed to fire IGA workflow within 15 minutes via integration log review'),
  ('Four-hour SLA compliance rate',           '99.1% of terminations processed within 4 business hours over trailing 90 days per SIEM report'),
  ('Physical access decommission evidence',   'Physical access card deactivation confirmed by Facilities log within same window for 100% of Q2 sample')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-003'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- MBBK-ITGC-004: SoD Matrix
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '35 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('SoD ruleset coverage',                    'SoD matrix covers 100% of in-scope financial applications; last reviewed and approved by CRO on 2026-04-15'),
  ('System-level enforcement of conflicts',   'Conflicting role assignments blocked at provisioning layer for 14 of 14 defined conflict pairs; confirmed via penetration test'),
  ('Compensating control approval',           'Residual SoD exceptions (n=3) reviewed and signed off by CRO; compensating controls documented and tested')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-004'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- MBBK-ITGC-005: PAM Vault
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '5 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('PAM vault coverage of privileged accounts',  'CyberArk vault manages 100% of 47 inventoried privileged accounts; confirmed via AD privileged group reconciliation'),
  ('Session recording retention',                'Recording retention policy set to 365 days; spot-check confirmed recordings accessible for 3 randomly selected sessions from 12 months prior'),
  ('Out-of-vault privileged access alerting',    'SIEM rule MBK-PAM-001 fires within 3 minutes of any direct privileged login; zero unacknowledged alerts in trailing 30 days')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-005'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- MBBK-ITGC-006: Dual Authorisation for Standing Privileged Access
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '42 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('Dual-approval evidence',                  'All 4 standing privileged access grants in current period carried system owner and ISO sign-off; verified in change management system'),
  ('90-day expiry enforcement',               'Automated expiry confirmed active; 2 grants expired and were renewed with fresh justification per IGA audit log')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-006'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- MBBK-ITGC-007: Service Account Rotation
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '28 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('Service account register completeness',   'PAM discovery scan identified 62 service accounts; all 62 confirmed in register; 0 unregistered accounts outstanding'),
  ('Quarterly rotation compliance rate',      '100% of service accounts rotated within the quarter; last rotation batch completed 2026-04-28 per secrets manager audit log'),
  ('Rotation failure alerting',               'Failed rotation jobs trigger PagerDuty P2 alert; 1 failure in quarter resolved within 4 hours with root cause documented')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-007'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- MBBK-ITGC-008: CAB Approval
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '14 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('CAB approval rate for production changes', '100% of 38 sampled production changes carried a CAB-approved RFC record; no deployments without RFC detected in ITSM system'),
  ('Risk assessment completeness',            'All sampled RFCs included completed risk assessment and rollback plan; no exceptions noted'),
  ('Emergency change post-ratification',      '3 emergency changes in the period; all ratified at subsequent CAB within 5 business days with post-implementation review attached')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-008'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- MBBK-ITGC-009: Code Review
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '3 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('Branch protection rule configuration',    'Branch protection confirmed active on main branch of all 11 in-scope repositories; administrator bypass disabled'),
  ('Two-reviewer compliance in sample',       '100% of 30 sampled pull requests carried two distinct approvals including one senior engineer designation; no self-approvals detected'),
  ('Status check enforcement',                'All required status checks (build, SAST, unit tests) must pass before merge; confirmed via GitHub repository settings export')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-009'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- MBBK-ITGC-010: DB Schema Review (DEFICIENCY)
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '95 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('DBA review enforcement mechanism',        'DEFICIENCY: No automated gate enforces DBA approval; review relies on informal process; 3 of 12 sampled migrations lacked documented DBA sign-off'),
  ('Impact analysis completeness',            'Automated syntax and impact analysis checks are in place but do not gate deployment when DBA review is absent; control is partially effective'),
  ('Remediation status',                      'Remediation in progress: branch protection rule requiring DBA review label targeted for implementation by 2026-06-30 per CAB RFC-2026-0447')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-010'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- MBBK-ITGC-011: CI/CD Integrity
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '7 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('Pipeline configuration in SCM',           'All 11 in-scope pipeline definitions stored in source-controlled repositories subject to branch protection; confirmed via CI platform API audit'),
  ('Artefact signing and verification',       'Build artefacts signed with Cosign; signature verification step confirmed present and mandatory in all production deployment pipelines'),
  ('Pipeline change alerting',                'SOC alert MBK-CICD-001 fires on any pipeline config change; 2 alerts in trailing 30 days, both investigated and closed as authorised')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-011'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- MBBK-ITGC-012: Critical Incident Response
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '30 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('Bridge convene time SLA compliance',      '100% of 4 P1 incidents in the period had bridge convened within 15 minutes; evidence from PagerDuty timeline reports'),
  ('Status update cadence compliance',        'Update cadence met for all P1 incidents; documented in incident management system with timestamp evidence'),
  ('Post-Incident Review completion rate',    '100% of P1 and P2 incidents (n=11) had PIR completed within 5 business days; no overdue PIRs at time of testing')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-012'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- MBBK-ITGC-013: Problem Management
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '45 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('Problem record raising timeliness',       'All 3 problem records raised in the period were opened within 2 business days of third incident recurrence; confirmed in ITSM tool'),
  ('RCA completion within 15 business days',  '2 of 3 RCAs completed on time; 1 extended by 5 days with documented justification approved by IT Risk Manager')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-013'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- MBBK-ITGC-014: Backup and Verification
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '8 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('Backup job completion monitoring',        '100% backup job success rate in trailing 30 days per Operations Dashboard; 1 transient failure auto-retried and completed within 30 minutes'),
  ('Monthly restore test evidence',           'Restore test performed 2026-05-15 on randomly selected backup; full data integrity confirmed by DBA sign-off within 4-hour window'),
  ('Offsite or secondary-region copy',        'Daily backups replicated to secondary AWS region (ap-southeast-1 to ap-east-1) within 2-hour SLA; replication lag report reviewed monthly')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-014'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- MBBK-ITGC-015: DR Testing
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '160 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('Annual DR exercise completion',           'Full DR exercise conducted 2025-12-10; RTO achieved in 4 hours 22 minutes against 6-hour target; RPO validated at 47 minutes against 4-hour target'),
  ('Board Risk Committee reporting',          'DR exercise results presented to BRC on 2026-01-15; 2 gaps identified with remediation plans accepted by BRC'),
  ('Gap remediation tracking',               'Both gaps (network failover latency, DNS TTL configuration) resolved by 2026-03-31 and confirmed via targeted re-test')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-015'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- MBBK-ITGC-016: Patch Management
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '12 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('Critical patch SLA compliance (14 days)', '97% of critical CVEs remediated within 14 days in FY2026 Q2; 1 exception with CISO-approved risk acceptance due to application compatibility testing'),
  ('High patch SLA compliance (30 days)',     '99% of high CVEs remediated within 30 days; monthly report reviewed and signed by ISSC Chair'),
  ('ISSC monthly reporting',                  'Patch compliance dashboard presented at ISSC meeting 2026-05-20; meeting minutes and report retained as audit evidence')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-016'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- MBBK-ITGC-017: Data Centre Physical Access
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '20 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('Access log monthly review evidence',      'Facilities Security Manager review sign-off confirmed for April and May 2026 access logs; 1 anomaly investigated and closed as authorised contractor visit'),
  ('Visitor escort policy compliance',        'CCTV spot-check confirmed 100% of visitor access in sampled period was escorted by authorised staff member'),
  ('Biometric and proximity card dual-factor','Physical access control system configuration confirmed requiring both biometric and proximity card for server room entry; last verified 2026-05-11')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-017'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- MBBK-ITGC-018: Financial Close Reconciliation
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '16 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('Reconciliation job completion monitoring', 'All 14 interface reconciliation jobs completed successfully in the April 2026 close; zero failures; Operations log reviewed by Financial Controller'),
  ('Exception report review timeliness',      'Financial Controller reviewed and signed exception report within 1 business day for all 14 jobs; documented sign-off retained'),
  ('CFO escalation threshold compliance',     'No items exceeding SGD 10,000 threshold unresolved at close; 2 items investigated and resolved within same business day per GL reconciliation records')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-018'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- GRAB-ITGC-001: JML Process
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '25 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('Quarterly access review completion rate', '96% of accounts certified in Q2 2026 within the 30-day window; 24 overdue accounts escalated and resolved within 5 business days'),
  ('Leaver revocation within 2-hour SLA',    '100% of 18 leavers in the period had access revoked within 2 business hours; IGA workflow timestamps verified against HR termination records')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_grab' AND i.control_ref = 'GRAB-ITGC-001'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- GRAB-ITGC-002: SoD Enforcement
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '38 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('System-level SoD enforcement evidence',   'Payment platform configuration confirmed blocking initiation and approval roles for same user; validated via test transaction in UAT with production config'),
  ('Quarterly SoD conflict resolution',       'Zero unresolved SoD conflicts at quarter-end; 5 conflicts identified and remediated within 15 business days with documented approvals'),
  ('Internal Audit review of compensating controls', 'IA reviewed all 2 approved compensating controls in Q2 2026; both rated adequate; review documented in IA workpaper GF-SOX-2026-007')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_grab' AND i.control_ref = 'GRAB-ITGC-002'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- GRAB-ITGC-003: MFA Enforcement
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '6 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('MFA policy enforcement scope',            'Identity provider policy report confirms MFA enforced for 100% of 312 production user accounts; no policy exceptions in current config'),
  ('FIDO2 key requirement for privileged access', 'Privileged role assignment in IDP blocked without registered FIDO2 hardware key; 47 privileged accounts all confirmed with registered keys'),
  ('Non-compliant account auto-disable SLA',  'Automated disable after 48-hour grace period confirmed active; 0 accounts breached the policy threshold in trailing 30-day period')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_grab' AND i.control_ref = 'GRAB-ITGC-003'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- GRAB-ITGC-004: JIT Privileged Access
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '4 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('JIT access window enforcement',           'Vault policy confirmed maximum 4-hour session window; 3 randomly sampled sessions all auto-expired within the window per Vault audit log'),
  ('Session recording completeness',          '100% of privileged sessions in trailing 90 days have corresponding recording; confirmed via completeness check in session recording platform'),
  ('Anomalous session SIEM alerting',         'SIEM rule GRB-PAM-002 fires within 5 minutes of anomalous privileged activity; 1 alert in period investigated and closed as authorised')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_grab' AND i.control_ref = 'GRAB-ITGC-004'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- GRAB-ITGC-005: Service Account Rotation
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '32 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('Secrets register completeness',           'Automated secret discovery scan confirms 89 secrets in register; 0 unregistered secrets detected in most recent scan run 2026-05-03'),
  ('90-day rotation compliance',              '100% of secrets rotated within the 90-day window; last full rotation cycle completed 2026-05-01 per secrets manager event log')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_grab' AND i.control_ref = 'GRAB-ITGC-005'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- GRAB-ITGC-006: Production Change CAB
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '17 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('CAB approval in deployment pipeline gate', 'Deployment pipeline requires Jira RFC in approved state before production deploy; confirmed via pipeline configuration audit'),
  ('Emergency change ratification timeliness', '2 emergency changes in period; both ratified within 5 business days with post-implementation reviews attached to RFC records')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_grab' AND i.control_ref = 'GRAB-ITGC-006'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- GRAB-ITGC-007: Automated Code Review Gates
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '2 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('SAST gate pass rate and blocker findings', 'SAST critical findings block merge; 4 critical findings detected and resolved before merge in trailing 30 days; no bypasses recorded'),
  ('Two-engineer review compliance',          '100% of 45 sampled pull requests carried two distinct engineer approvals; confirmed via GitHub audit log export'),
  ('Dependency vulnerability gate',           'Dependency check (Snyk) configured as required status check; 3 high-severity dependency alerts resolved in period with ticket evidence')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_grab' AND i.control_ref = 'GRAB-ITGC-007'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- GRAB-ITGC-008: Environment Separation (DEFICIENCY)
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '80 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('Production data access restriction',      'DEFICIENCY: Audit log review identified 2 developer accounts with read access to production payment database without CISO approval; access not time-limited'),
  ('Network separation verification',         'Dev-to-prod network policy configured but internal penetration test identified a misconfigured security group allowing lateral movement path; remediation in progress'),
  ('CI/CD-only deployment enforcement',       'Deployment pipeline enforcement confirmed effective; SSH access blocked via host-based firewall; this control attribute operating effectively')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_grab' AND i.control_ref = 'GRAB-ITGC-008'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- GRAB-ITGC-009: Major Incident Management
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '33 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('Bridge convene time SLA (10 minutes)',    '100% of 3 S1 incidents in the period had bridge active within 10 minutes; PagerDuty escalation timestamps verified'),
  ('PIR completion within 7 business days',   '5 of 6 S1/S2 PIRs completed within 7 business days; 1 extended by 2 days with Engineering Director approval; all corrective actions tracked in Jira')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_grab' AND i.control_ref = 'GRAB-ITGC-009'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- GRAB-ITGC-010: Backup Verification
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '9 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('Hourly transaction log backup replication lag', 'Replication lag report confirms average 8-minute replication to secondary region; maximum observed lag 22 minutes, within 1-hour RPO'),
  ('Weekly restore test evidence',            'Automated restore test run 2026-05-25; restore completed in 43 minutes; data integrity hash comparison passed; results logged to backup management dashboard'),
  ('Monthly RTO/RPO actuals review',          'Head of Infrastructure reviewed RTO/RPO actuals on 2026-05-02; all metrics within thresholds; review documented in Infrastructure Monthly Report')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_grab' AND i.control_ref = 'GRAB-ITGC-010'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- GRAB-ITGC-011: Vulnerability Management
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '3 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('Critical 7-day remediation compliance',   '100% of 3 critical CVEs in the period remediated within 7 days; evidence from vulnerability management platform ticket timestamps'),
  ('Monthly ISSC patch compliance report',    'Compliance report presented at ISSC 2026-05-20; overall patch compliance rate 98.7%; 2 exceptions with CISO-approved risk acceptances')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_grab' AND i.control_ref = 'GRAB-ITGC-011'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );

-- GRAB-ITGC-012: Cloud Security Baseline
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT i.tenant_id, i.id,
  kca.attribute, kca.value,
  now() - interval '11 days'
FROM sox.itgcs i
CROSS JOIN (VALUES
  ('CIS Benchmark compliance score',          'CSPM tool reports 94.3% compliance against CIS Benchmark Level 2 across all in-scope cloud accounts; reviewed by Cloud Security team 2026-05-20'),
  ('Deviation remediation within 30 days',    '97% of deviations remediated within 30 days in Q2 2026; 4 overdue items with documented risk acceptances approved by CISO'),
  ('Monthly Cloud Security team review',      'Cloud Security monthly review meeting held 2026-05-20; CSPM report reviewed and signed; minutes retained as audit evidence')
) AS kca(attribute, value)
WHERE i.tenant_id = 't_grab' AND i.control_ref = 'GRAB-ITGC-012'
  AND NOT EXISTS (
    SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id AND k.attribute = kca.attribute
  );


-- ===========================================================================
-- PART 3 — Walkthroughs
-- Maybank: 6 walkthroughs; Grab: 4 walkthroughs
-- Each walkthrough is for a specific ITGC identified by control_ref.
-- ===========================================================================

-- Maybank walkthrough 1: MBBK-ITGC-001 User Access Provisioning
INSERT INTO sox.walkthroughs (tenant_id, itgc_id, description, completed_at, evidence_link)
SELECT i.tenant_id, i.id,
  'Walkthrough of User Access Provisioning control. Auditor selected a sample of 5 access provisioning requests from the IGA platform event log for Q2 2026. For each request, the auditor confirmed: (1) a valid manager approval email or workflow record; (2) system owner approval record; (3) HR joiner record linked; (4) provisioning completed within the requested access level with no additional privileges. All 5 samples evidenced complete dual-approval and correct provisioning. Evidence retained: IGA audit log export MBK-AUD-IAM-2026-Q2-001.',
  now() - interval '19 days',
  'https://grc.internal/sox/evidence/MBBK-ITGC-001/walkthrough-Q2-2026'
FROM sox.itgcs i
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-001'
  AND NOT EXISTS (
    SELECT 1 FROM sox.walkthroughs w WHERE w.itgc_id = i.id
  );

-- Maybank walkthrough 2: MBBK-ITGC-005 PAM Vault
INSERT INTO sox.walkthroughs (tenant_id, itgc_id, description, completed_at, evidence_link)
SELECT i.tenant_id, i.id,
  'Walkthrough of Privileged Access Management via PAM Vault control. Auditor obtained the CyberArk vault account inventory and reconciled it against the Active Directory privileged groups export dated 2026-05-01. All 47 privileged accounts confirmed to be managed within the vault. Auditor requested and viewed 3 session recordings selected at random; recordings were complete and accessible. SIEM alert rule MBK-PAM-001 was reviewed in the SIEM console and confirmed active with correct threshold settings. Evidence retained: CyberArk account report, AD privileged group export, SIEM rule configuration screenshot MBK-AUD-PAM-2026-Q2-001.',
  now() - interval '6 days',
  'https://grc.internal/sox/evidence/MBBK-ITGC-005/walkthrough-Q2-2026'
FROM sox.itgcs i
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-005'
  AND NOT EXISTS (
    SELECT 1 FROM sox.walkthroughs w WHERE w.itgc_id = i.id
  );

-- Maybank walkthrough 3: MBBK-ITGC-008 CAB Approval
INSERT INTO sox.walkthroughs (tenant_id, itgc_id, description, completed_at, evidence_link)
SELECT i.tenant_id, i.id,
  'Walkthrough of Change Advisory Board Approval control. Auditor selected the CAB meeting minutes and change log for the week of 2026-05-05. Auditor obtained a list of all production deployments from the CI/CD platform during the week and cross-referenced each deployment against a CAB-approved RFC record in ServiceNow. All 8 deployments matched an approved RFC. Auditor reviewed 3 selected RFCs in detail and confirmed risk assessments, test evidence and rollback plans were present and complete. Evidence retained: CAB minutes 2026-05-07, ServiceNow RFC extract, CI/CD deployment log MBK-AUD-CHG-2026-Q2-001.',
  now() - interval '15 days',
  'https://grc.internal/sox/evidence/MBBK-ITGC-008/walkthrough-Q2-2026'
FROM sox.itgcs i
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-008'
  AND NOT EXISTS (
    SELECT 1 FROM sox.walkthroughs w WHERE w.itgc_id = i.id
  );

-- Maybank walkthrough 4: MBBK-ITGC-010 DB Schema Change (DEFICIENCY)
INSERT INTO sox.walkthroughs (tenant_id, itgc_id, description, completed_at, evidence_link)
SELECT i.tenant_id, i.id,
  'Walkthrough of Database Schema Change Control. Auditor selected 12 database migration pull requests merged to main between 2026-02-01 and 2026-04-30. For each pull request, auditor inspected the review history for evidence of DBA approval (designated DBA reviewer label or comment). Finding: 3 of 12 pull requests (PRs #1847, #1923, #2011) did not carry a documented DBA reviewer approval prior to merge; the standard developer peer review was present but the specific DBA designation was absent. Automated syntax and impact analysis checks were confirmed present and passing on all 12. This constitutes a control deficiency. Evidence retained: GitHub PR audit export, DBA reviewer label configuration screenshot MBK-AUD-CHG-2026-DBR-001.',
  now() - interval '96 days',
  'https://grc.internal/sox/evidence/MBBK-ITGC-010/walkthrough-Q2-2026'
FROM sox.itgcs i
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-010'
  AND NOT EXISTS (
    SELECT 1 FROM sox.walkthroughs w WHERE w.itgc_id = i.id
  );

-- Maybank walkthrough 5: MBBK-ITGC-014 Backup Verification
INSERT INTO sox.walkthroughs (tenant_id, itgc_id, description, completed_at, evidence_link)
SELECT i.tenant_id, i.id,
  'Walkthrough of Automated Backup and Integrity Verification control. Auditor reviewed the Operations Monitoring dashboard for the period 2026-04-01 to 2026-05-15 and confirmed all nightly backup jobs completed successfully with zero failures (excluding 1 auto-retried failure that completed within 30 minutes). Auditor inspected the restore test record for 2026-05-15: DBA sign-off, data integrity hash comparison results and restore duration (2 hours 18 minutes) were all present and within target parameters. Offsite replication configuration and lag report reviewed and confirmed within 2-hour SLA. Evidence retained: Operations Dashboard export, restore test record MBK-AUD-BKP-2026-Q2-001.',
  now() - interval '9 days',
  'https://grc.internal/sox/evidence/MBBK-ITGC-014/walkthrough-Q2-2026'
FROM sox.itgcs i
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-014'
  AND NOT EXISTS (
    SELECT 1 FROM sox.walkthroughs w WHERE w.itgc_id = i.id
  );

-- Maybank walkthrough 6: MBBK-ITGC-018 Financial Close Reconciliation
INSERT INTO sox.walkthroughs (tenant_id, itgc_id, description, completed_at, evidence_link)
SELECT i.tenant_id, i.id,
  'Walkthrough of Financial Close IT Automated Controls and Interface Reconciliation. Auditor reviewed the April 2026 financial close reconciliation jobs. Obtained Operations log showing all 14 nightly reconciliation jobs completing successfully with zero failures. Inspected exception report for the April close: Financial Controller sign-off timestamp confirmed within 1 business day of report generation for all 14 jobs. Confirmed no items exceeded SGD 10,000 threshold without same-day resolution. GL reconciliation records reviewed for completeness. Evidence retained: Operations close log April 2026, Financial Controller sign-off email chain, GL reconciliation extract MBK-AUD-FC-2026-APR-001.',
  now() - interval '17 days',
  'https://grc.internal/sox/evidence/MBBK-ITGC-018/walkthrough-Q2-2026'
FROM sox.itgcs i
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-018'
  AND NOT EXISTS (
    SELECT 1 FROM sox.walkthroughs w WHERE w.itgc_id = i.id
  );

-- Grab walkthrough 1: GRAB-ITGC-003 MFA Enforcement
INSERT INTO sox.walkthroughs (tenant_id, itgc_id, description, completed_at, evidence_link)
SELECT i.tenant_id, i.id,
  'Walkthrough of Multi-Factor Authentication Enforcement. Auditor obtained the identity provider MFA policy report for all production user accounts as of 2026-05-25. Report confirmed MFA enforced for 312 of 312 active production accounts (100% compliance). Auditor reviewed the privileged role configuration and confirmed FIDO2 hardware key requirement active for all 47 privileged accounts. Auto-disable policy configuration exported and confirmed 48-hour grace period active. Auditor queried IDP event log for auto-disable events in trailing 30 days: 0 accounts breached the threshold. Evidence retained: IDP MFA compliance report, privileged role policy export, IDP event log extract GRB-AUD-IAM-2026-Q2-002.',
  now() - interval '7 days',
  'https://grc.internal/sox/evidence/GRAB-ITGC-003/walkthrough-Q2-2026'
FROM sox.itgcs i
WHERE i.tenant_id = 't_grab' AND i.control_ref = 'GRAB-ITGC-003'
  AND NOT EXISTS (
    SELECT 1 FROM sox.walkthroughs w WHERE w.itgc_id = i.id
  );

-- Grab walkthrough 2: GRAB-ITGC-006 Production Change CAB
INSERT INTO sox.walkthroughs (tenant_id, itgc_id, description, completed_at, evidence_link)
SELECT i.tenant_id, i.id,
  'Walkthrough of Production Change Approval via CAB. Auditor obtained a CI/CD deployment log for the two-week period 2026-05-01 to 2026-05-14 showing 22 production deployments to in-scope systems. Cross-referenced each deployment against Jira RFC tickets: all 22 deployments matched an RFC in approved state at time of deployment (confirmed via Jira status history). Auditor selected 5 RFCs and verified presence of risk assessment, test plan and rollback procedure. 2 emergency change RFCs reviewed and confirmed ratified at subsequent CAB within 5 business days with post-implementation reviews. Evidence retained: CI/CD deployment log, Jira RFC export GRB-AUD-CHG-2026-Q2-001.',
  now() - interval '18 days',
  'https://grc.internal/sox/evidence/GRAB-ITGC-006/walkthrough-Q2-2026'
FROM sox.itgcs i
WHERE i.tenant_id = 't_grab' AND i.control_ref = 'GRAB-ITGC-006'
  AND NOT EXISTS (
    SELECT 1 FROM sox.walkthroughs w WHERE w.itgc_id = i.id
  );

-- Grab walkthrough 3: GRAB-ITGC-008 Environment Separation (DEFICIENCY)
INSERT INTO sox.walkthroughs (tenant_id, itgc_id, description, completed_at, evidence_link)
SELECT i.tenant_id, i.id,
  'Walkthrough of Environment Separation and Production Access Restriction. Auditor reviewed the cloud IAM policy for production AWS accounts and compared against the production access control standard. Finding 1: IAM policy review identified 2 developer identities (user IDs GRB-DEV-0147 and GRB-DEV-0219) with read-only access to the production payment database; neither had a CISO approval record on file and access was not time-limited as required by policy. Finding 2: Internal penetration test report (GRB-PENTEST-2026-003) identified a misconfigured EC2 security group permitting east-west traffic from the staging VPC to the production payment service on port 5432. SSH access block confirmed effective (all 3 tested connection attempts blocked). This control is rated as deficient. Evidence retained: IAM policy export, pentest report GRB-PENTEST-2026-003, host-based firewall rule output GRB-AUD-ENV-2026-Q2-001.',
  now() - interval '81 days',
  'https://grc.internal/sox/evidence/GRAB-ITGC-008/walkthrough-Q2-2026'
FROM sox.itgcs i
WHERE i.tenant_id = 't_grab' AND i.control_ref = 'GRAB-ITGC-008'
  AND NOT EXISTS (
    SELECT 1 FROM sox.walkthroughs w WHERE w.itgc_id = i.id
  );

-- Grab walkthrough 4: GRAB-ITGC-010 Backup Verification
INSERT INTO sox.walkthroughs (tenant_id, itgc_id, description, completed_at, evidence_link)
SELECT i.tenant_id, i.id,
  'Walkthrough of Backup Verification and Recovery Testing. Auditor reviewed the backup management dashboard for the period 2026-04-25 to 2026-05-25. Confirmed hourly transaction log backup jobs and daily full snapshot jobs completing without failure across both production database clusters. Reviewed replication lag report: average 8 minutes to secondary region, maximum 22 minutes, within the 1-hour RPO. Inspected automated weekly restore test results for 2026-05-25: restore completed in 43 minutes, data integrity hash comparison result was PASS. Head of Infrastructure sign-off on May Infrastructure Monthly Report confirmed. Evidence retained: backup dashboard export, replication lag report, restore test result log, Infrastructure Monthly Report May 2026 GRB-AUD-BKP-2026-Q2-001.',
  now() - interval '10 days',
  'https://grc.internal/sox/evidence/GRAB-ITGC-010/walkthrough-Q2-2026'
FROM sox.itgcs i
WHERE i.tenant_id = 't_grab' AND i.control_ref = 'GRAB-ITGC-010'
  AND NOT EXISTS (
    SELECT 1 FROM sox.walkthroughs w WHERE w.itgc_id = i.id
  );


-- ===========================================================================
-- PART 4 — Deficiencies
-- Maybank: 5 deficiencies; Grab: 2 deficiencies
-- Severity: all significant (matching status 'deficiency' on the ITGC)
-- Also seed deficiencies for one additional effective control per tenant to
-- represent a historical deficiency that has since been remediated.
-- ===========================================================================

-- Maybank deficiency 1: MBBK-ITGC-010 DB Schema Change (open deficiency)
INSERT INTO sox.deficiencies (tenant_id, itgc_id, severity, description, remediation_plan, root_cause)
SELECT i.tenant_id, i.id,
  'significant'::sox.deficiency_sev,
  'Database schema migration pull requests were merged to production without documented Database Administrator (DBA) review in 3 of 12 sampled instances (25% exception rate). Pull requests #1847, #1923 and #2011, all merged between February and April 2026, carried standard developer peer review but lacked the mandatory DBA reviewer label or explicit DBA approval comment. Automated syntax and impact analysis gates were passing, but the control relies on a human DBA review step that is not enforced by a system gate. The exception rate exceeds the 5% tolerable deviation rate; the control is rated as a significant deficiency.',
  'Implement a mandatory DBA reviewer label requirement as a branch protection required check in the GitHub repository settings for all repositories with schema migration scripts. The CI/CD pipeline will be updated to block merge if the DBA-approved label is absent. A runbook will be published and DBA team briefed. Target implementation date: 2026-06-30. Responsible owner: Head of Database Operations. Progress tracked in CAB RFC-2026-0447.',
  'The DBA review requirement was documented in the change management policy but was not enforced by a technical control gate. The process relied on informal communication and developer awareness. During a period of increased release velocity in Q1 2026, three migrations bypassed the informal DBA review step without detection, as there was no automated check or exception alerting to surface the gap.'
FROM sox.itgcs i
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-010'
  AND NOT EXISTS (
    SELECT 1 FROM sox.deficiencies d WHERE d.itgc_id = i.id
  );

-- Maybank deficiency 2: MBBK-ITGC-002 Periodic Access Review — historical, remediated
INSERT INTO sox.deficiencies (tenant_id, itgc_id, severity, description, remediation_plan, root_cause, remediated_at)
SELECT i.tenant_id, i.id,
  'significant'::sox.deficiency_sev,
  'Quarterly access review for Q4 2025 was completed 18 days beyond the 30-day window for the core banking system (CBS-PROD). Of the 847 accounts subject to review, 94 were certified after the deadline. Additionally, 7 accounts flagged for revocation were not disabled within the required 48-hour window (average delay: 6.2 business days). Exception rate for timely revocation was 0.8% against a tolerable deviation of 0.1%, constituting a significant deficiency.',
  'IAM team implemented automated 7-day and 3-day reminder notifications to reviewers via the IGA platform, escalating to reviewer managers on day 28. The revocation workflow was reconfigured to auto-disable flagged accounts after 48 hours without requiring a separate IAM analyst step. These changes were implemented in January 2026 and effectiveness confirmed in Q1 2026 access review cycle.',
  'The IGA platform lacked automated escalation reminders; reviewer engagement depended on a manual email process managed by the IAM team. During the Q4 2025 period, the IAM analyst responsible for managing the review was on extended leave and the backup process was not activated, resulting in delayed escalation and missed revocations.',
  now() - interval '90 days'
FROM sox.itgcs i
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-002'
  AND NOT EXISTS (
    SELECT 1 FROM sox.deficiencies d WHERE d.itgc_id = i.id
  );

-- Maybank deficiency 3: MBBK-ITGC-007 Service Account Rotation — historical, remediated
INSERT INTO sox.deficiencies (tenant_id, itgc_id, severity, description, remediation_plan, root_cause, remediated_at)
SELECT i.tenant_id, i.id,
  'significant'::sox.deficiency_sev,
  'Service account credential rotation audit for Q3 2025 identified 8 service accounts (13% of the 62-account population) that had not been rotated within the required 90-day window. The maximum observed credential age was 187 days for a service account (SVC-BATCH-GL-004) used by the general ledger batch processing job. A further 3 service accounts were found not registered in the service account register at the time of testing, indicating that the service account discovery scan had not been running correctly for a 6-week period.',
  'PAM vault auto-rotation policy was reapplied to all 62 service accounts with rotation failure alerting configured to PagerDuty P2. The discovery scan was repaired and its schedule validated. All 3 unregistered accounts were onboarded to the register within 5 business days. Remediation verified by ISO in October 2025 and confirmed effective in Q4 2025 rotation cycle.',
  'The PAM vault auto-rotation policy had been inadvertently disabled for a subset of accounts during a vault upgrade in June 2025. The upgrade runbook did not include a post-upgrade validation step to verify that rotation policies remained active for all accounts. The discovery scan failure was caused by an expired API credential for the PAM vault integration account, which was itself subject to the rotation failure.',
  now() - interval '120 days'
FROM sox.itgcs i
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-007'
  AND NOT EXISTS (
    SELECT 1 FROM sox.deficiencies d WHERE d.itgc_id = i.id
  );

-- Maybank deficiency 4: MBBK-ITGC-012 Incident Response — historical, remediated
INSERT INTO sox.deficiencies (tenant_id, itgc_id, severity, description, remediation_plan, root_cause, remediated_at)
SELECT i.tenant_id, i.id,
  'significant'::sox.deficiency_sev,
  'Post-Incident Review (PIR) completion rate for P1 and P2 incidents in Q3 2025 was 73% within the mandated 5-business-day window (8 of 11 PIRs completed on time). Three PIRs were completed between 9 and 17 business days after incident closure. One P1 incident (INC-2025-08-1142, online banking platform outage affecting 240,000 customers) did not have a PIR completed until 17 business days after resolution, significantly exceeding the policy requirement. This control gap represents a risk that lessons learned from critical incidents are not captured and acted upon in a timely manner.',
  'Incident Management process was updated to trigger an automatic Jira ticket for each P1/P2 PIR with a hard due date 5 business days after incident closure, escalating to the Head of IT Operations and CIO if not completed by day 4. Updated process was effective from October 2025; Q4 2025 PIR completion rate was 100% within the window.',
  'The PIR scheduling process was manual and depended on the Incident Manager remembering to book PIR sessions. During August 2025, the organisation experienced an unusually high volume of P2 incidents (7 in a single month) which overloaded the Incident Management team and led to PIR scheduling being deprioritised in favour of active incident work.',
  now() - interval '105 days'
FROM sox.itgcs i
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-012'
  AND NOT EXISTS (
    SELECT 1 FROM sox.deficiencies d WHERE d.itgc_id = i.id
  );

-- Maybank deficiency 5: MBBK-ITGC-016 Patch Management — historical, remediated
INSERT INTO sox.deficiencies (tenant_id, itgc_id, severity, description, remediation_plan, root_cause, remediated_at)
SELECT i.tenant_id, i.id,
  'significant'::sox.deficiency_sev,
  'Patch management compliance review for Q3 2025 found that 4 of 31 in-scope production servers (13%) had critical vulnerabilities (CVSS 9.0+) outstanding beyond the 14-day remediation SLA, with the oldest overdue critical patch being 41 days past the vendor disclosure date. The affected systems included two nodes in the payment processing cluster (CVE-2025-21298, kernel vulnerability with public exploit code available) which posed an elevated risk of exploitation. Two overdue patches lacked any documented risk acceptance from the CISO, representing a process compliance gap as well as a technical exposure.',
  'Vulnerability management platform was reconfigured to auto-escalate critical CVEs to the CISO and Head of Infrastructure at day 10 (4 days before SLA breach). A dedicated patching sprint was introduced into the release calendar for the last week of each month. CISO risk acceptance documentation was made a mandatory workflow step in the exception process. Remediation effectiveness confirmed in Q4 2025 patch compliance review.',
  'The patch management process lacked automated escalation for approaching SLA breaches. The Q3 2025 period coincided with a major infrastructure migration project that consumed the majority of the Infrastructure team''s capacity, leading to normal operational patching being deprioritised. The absence of an automated escalation mechanism meant that SLA breaches were not surfaced to leadership until the monthly compliance report, by which time breaches had already occurred.',
  now() - interval '95 days'
FROM sox.itgcs i
WHERE i.tenant_id = 't_maybank' AND i.control_ref = 'MBBK-ITGC-016'
  AND NOT EXISTS (
    SELECT 1 FROM sox.deficiencies d WHERE d.itgc_id = i.id
  );

-- Grab deficiency 1: GRAB-ITGC-008 Environment Separation (open deficiency)
INSERT INTO sox.deficiencies (tenant_id, itgc_id, severity, description, remediation_plan, root_cause)
SELECT i.tenant_id, i.id,
  'significant'::sox.deficiency_sev,
  'Testing of the environment separation control identified two significant exceptions. First, an IAM policy review dated 2026-03-12 found two developer accounts (GRB-DEV-0147 and GRB-DEV-0219) with standing read-only access to the production payment database (PROD-PAYMENT-DB-01) without a CISO approval record on file and without a time limit, contrary to the production access control standard requirement for CISO-approved, time-limited exceptions. The accounts had been provisioned during an incident investigation in January 2026 and were not revoked after the incident concluded. Second, an internal penetration test (GRB-PENTEST-2026-003, conducted March 2026) identified a misconfigured EC2 security group (sg-0a4f1b2c3d) allowing inbound traffic from the staging VPC (10.10.0.0/16) to the production payment service on port 5432 (PostgreSQL), creating a lateral movement path from staging to production. The combination of these two exceptions constitutes a significant deficiency in the environment separation control.',
  'Immediate remediation actions taken: both developer accounts (GRB-DEV-0147, GRB-DEV-0219) revoked within 24 hours of finding; security group sg-0a4f1b2c3d corrected to remove the staging VPC ingress rule within 48 hours. Longer-term remediation: implement quarterly automated IAM drift detection comparing production access against the approved exception register; implement Infrastructure-as-Code policy-as-code check to block security group rules permitting cross-environment access. Target completion: 2026-07-31. Owner: Head of Cloud Security. Tracked in Jira SECOPS-2026-0892.',
  'The two exceptions share a common root cause: the absence of automated detection for policy drift in production IAM and network configuration. The developer accounts were provisioned as an expedient during an incident and relied on a manual revocation follow-up that was not completed. The security group misconfiguration was introduced during a Terraform refactoring sprint in February 2026 where a module variable defaulted to an overly permissive ingress rule; the terraform plan review did not flag the cross-environment exposure because the reviewer was unfamiliar with the VPC CIDR allocation scheme.'
FROM sox.itgcs i
WHERE i.tenant_id = 't_grab' AND i.control_ref = 'GRAB-ITGC-008'
  AND NOT EXISTS (
    SELECT 1 FROM sox.deficiencies d WHERE d.itgc_id = i.id
  );

-- Grab deficiency 2: GRAB-ITGC-001 JML Process — historical, remediated
INSERT INTO sox.deficiencies (tenant_id, itgc_id, severity, description, remediation_plan, root_cause, remediated_at)
SELECT i.tenant_id, i.id,
  'significant'::sox.deficiency_sev,
  'Quarterly access review for Q3 2025 identified that 4 former employees who left the organisation in July and August 2025 retained active accounts in the lending ledger system (LEND-PROD) for between 11 and 23 days after their HR termination date. The maximum retention period (23 days for user GRB-EXIT-20250814) significantly exceeded the 2-business-hour SLA. Additionally, 6 accounts belonging to employees who had changed roles (movers) retained legacy role assignments from their previous positions for more than 30 days in the payment processing system, contrary to the access control policy. The combined exception rate for the JML process was 4.1% against a tolerable rate of 0.5%.',
  'The IGA platform''s integration with the HR system was audited and a configuration defect identified: the automated termination trigger was failing silently for a subset of termination types (voluntary resignation category code 05) due to an API schema mismatch introduced during an HR system upgrade in June 2025. The defect was corrected and the integration tested end-to-end in September 2025. Movers workflow was reconfigured to automatically trigger a targeted access review for the new role within 5 business days of the role change event. Effectiveness confirmed in Q4 2025 JML testing.',
  'The HR system upgrade in June 2025 introduced a breaking change to the termination event API payload structure (field ''termination_category'' renamed to ''exit_reason_code'') that was not communicated to the IAM team. The IGA platform integration consumed the old field name, causing silent failures for voluntary resignation termination events. The IGA vendor''s monitoring for API integration failures was configured to only alert on HTTP 5xx errors, not on missing field matches, masking the failure for approximately 8 weeks until the Q3 2025 access review surfaced the stale accounts.',
  now() - interval '110 days'
FROM sox.itgcs i
WHERE i.tenant_id = 't_grab' AND i.control_ref = 'GRAB-ITGC-001'
  AND NOT EXISTS (
    SELECT 1 FROM sox.deficiencies d WHERE d.itgc_id = i.id
  );


\echo ' >> Migration 035: SOX seed data inserted (Maybank 18 ITGCs, Grab 12 ITGCs)'
