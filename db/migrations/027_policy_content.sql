-- Migration 027: Replace auto-seeded placeholder policy content with realistic markdown.
-- Targets policy.versions rows whose content_md still contains the seeding placeholder.
-- Uses $pol$ dollar-quoting so markdown (with backticks, asterisks, etc.) embeds cleanly.

UPDATE policy.versions v
SET content_md = CASE

  -- 1. Information Security Policy
  WHEN d.title = 'Information Security Policy' AND v.version_no = 'v1' THEN $pol$
# Information Security Policy

**Version:** v1 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2025-09-14

## 1. Purpose
Establish the baseline controls that protect the confidentiality, integrity, and availability of information assets in line with ISO/IEC 27001:2022 and the MAS Technology Risk Management (TRM) Guidelines 2021.

## 2. Scope
Applies to all employees, contractors, and third parties processing organisational data, across on-premises, cloud, and end-user environments. Covers all information classifications and all jurisdictions in which the entity operates, with primary regulatory anchoring in Singapore.

## 3. Policy Statements
- An Information Security Management System (ISMS) shall be maintained and independently audited at least annually.
- All information assets must be inventoried, owned, and classified per the Data Classification Policy.
- Risk assessments are performed at least annually and prior to material system changes.
- Security controls follow defence-in-depth across people, process, and technology layers.
- Security exceptions require documented risk acceptance by the CISO and review every 6 months.

## 4. Roles & Responsibilities
- Board / Risk Committee: approves the policy and tolerates residual risk levels.
- Chief Information Security Officer (CISO): owns the ISMS and policy lifecycle.
- Information Asset Owners: classify assets and approve access.
- All Staff: comply with policy and report incidents within 1 hour of detection.

## 5. Compliance
Aligned with ISO/IEC 27001:2022, MAS TRM Guidelines 2021, and Cyber Hygiene Notice (MAS Notice 655 / FAA-N18). Non-compliance may result in disciplinary action up to termination and, where applicable, regulatory reporting.
$pol$

  WHEN d.title = 'Information Security Policy' AND v.version_no = 'v2' THEN $pol$
# Information Security Policy

**Version:** v2 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2026-04-22

## 1. Purpose
Establish the baseline controls that protect the confidentiality, integrity, and availability of information assets, aligned with ISO/IEC 27001:2022, the MAS Technology Risk Management (TRM) Guidelines 2021, and MAS Cyber Hygiene Notice obligations.

## 2. Scope
Applies to all employees, contractors, interns, and third parties (including outsourced service providers) that store, process, or transmit organisational data. Covers production, non-production, cloud, SaaS, and end-user computing environments globally, with Singapore as the primary regulatory jurisdiction.

## 3. Policy Statements
- An ISO 27001-certified ISMS is maintained, with management review at least twice per year.
- All information assets are inventoried in the CMDB, assigned an owner, and classified within 30 days of acquisition.
- Risk assessments are conducted annually, before material changes, and after any Severity 1 or 2 incident.
- Defence-in-depth controls span identity, network, endpoint, application, and data layers.
- Threat intelligence is consumed continuously and mapped to MITRE ATT&CK for detection coverage gaps.
- Security exceptions require CISO approval, are time-bound (max 12 months), and are reviewed quarterly.

## 4. Roles & Responsibilities
- Board / Risk Committee: approves the policy, sets risk appetite, and reviews the ISMS scorecard each quarter.
- CISO: owns the ISMS, the policy library, and the security exception register.
- Information Asset Owners: classify assets, approve access, and attest to controls annually.
- Internal Audit: performs independent assurance over ISMS effectiveness at least annually.
- All Staff: complete annual security training and report suspected incidents within 1 hour.

## 5. Compliance
Aligned with ISO/IEC 27001:2022, ISO/IEC 27002:2022, MAS TRM Guidelines 2021, MAS Notice 655 / FAA-N18 Cyber Hygiene, and the Cybersecurity Act 2018 (SG). Breaches may trigger disciplinary action, contractual penalties, and MAS notification obligations.

## 6. Change History
v2 (2026-04-22): Added threat intelligence and MITRE ATT&CK mapping requirements; introduced time-bound security exceptions; clarified Internal Audit assurance frequency.
$pol$

  -- 2. Acceptable Use Policy
  WHEN d.title = 'Acceptable Use Policy' AND v.version_no = 'v1' THEN $pol$
# Acceptable Use Policy

**Version:** v1 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2025-08-30

## 1. Purpose
Define acceptable and prohibited use of organisational IT resources to protect data, reputation, and regulatory standing.

## 2. Scope
Applies to all staff, contractors, and authorised third parties using corporate devices, networks, email, collaboration tools, and SaaS applications, whether on-premises or remote.

## 3. Policy Statements
- Corporate accounts and devices are provided for legitimate business purposes; limited personal use is permitted if it does not impair work or violate this policy.
- Users shall not bypass security controls, install unapproved software, or disable endpoint protection.
- Sharing of credentials, MFA tokens, or session cookies is strictly prohibited.
- Internet and email use is logged; users have no expectation of privacy on corporate systems.
- Generative AI tools may only be used via approved enterprise instances; uploading Confidential or Restricted data to public AI services is prohibited.

## 4. Roles & Responsibilities
- IT Operations: provisions and monitors approved tools.
- Line Managers: ensure their teams complete acceptable use training annually.
- Users: comply with this policy and report misuse.

## 5. Compliance
Violations may lead to disciplinary action, loss of access, and reporting to authorities where laws (e.g., Computer Misuse Act, PDPA) are breached.
$pol$

  WHEN d.title = 'Acceptable Use Policy' AND v.version_no = 'v2' THEN $pol$
# Acceptable Use Policy

**Version:** v2 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2026-03-18

## 1. Purpose
Define acceptable and prohibited use of organisational IT resources, including AI services, to protect data, reputation, and regulatory standing.

## 2. Scope
Applies to all staff, contractors, interns, and authorised third parties using corporate or BYOD devices, networks, email, collaboration platforms, SaaS, and AI assistants - whether on-premises, in office, or remote.

## 3. Policy Statements
- Corporate accounts and devices are provided for legitimate business purposes; incidental personal use is allowed only when it does not impair work, consume material resources, or violate any policy.
- Users shall not bypass security controls, install unapproved software, alter endpoint configurations, or use personal cloud storage for corporate data.
- Sharing of credentials, MFA tokens, biometric profiles, or active session cookies is strictly prohibited.
- All internet, email, and SaaS activity is logged and may be reviewed by authorised personnel; users have no expectation of privacy on corporate systems.
- Generative AI usage is restricted to the approved enterprise tenant. Confidential or Restricted data must never be entered into public AI services.
- Use of corporate resources for cryptocurrency mining, gambling, or unauthorised commercial activity is prohibited.

## 4. Roles & Responsibilities
- IT Operations: maintains the approved software and AI tool catalogue.
- Line Managers: enforce training completion and acknowledge user attestations.
- HR: administers disciplinary process for violations.
- Users: comply with this policy and report misuse via the integrity hotline.

## 5. Compliance
Violations may result in disciplinary action up to termination, loss of access, civil recovery, and reporting under the Computer Misuse Act 1993 (SG), PDPA, and Official Secrets Act where applicable.

## 6. Change History
v2 (2026-03-18): Added explicit rules on generative AI usage, prohibited cryptocurrency mining on corporate resources, and clarified BYOD applicability.
$pol$

  -- 3. Access Control Policy
  WHEN d.title = 'Access Control Policy' AND v.version_no = 'v1' THEN $pol$
# Access Control Policy

**Version:** v1 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2025-09-02

## 1. Purpose
Ensure that access to information systems is granted on the principle of least privilege and aligned with MAS TRM access control expectations.

## 2. Scope
Applies to all identities (human and non-human) accessing organisational systems, including production, non-production, cloud, and third-party connections.

## 3. Policy Statements
- Access is granted only on a need-to-know, need-to-use basis with documented approval.
- Multi-factor authentication (MFA) is mandatory for all remote, privileged, and externally exposed access.
- Privileged access is brokered through the Privileged Access Management (PAM) platform with session recording.
- User access is reviewed at least every 6 months; privileged access every 3 months.
- Joiner/mover/leaver processes complete within 1 business day of HR notification.

## 4. Roles & Responsibilities
- IAM Team: operates identity stores, PAM, and access certification tooling.
- System Owners: approve access requests and perform access reviews.
- Line Managers: initiate access changes for their reports.

## 5. Compliance
Aligned with MAS TRM Guidelines 2021 (Section 9), ISO/IEC 27001:2022 Annex A.5.15-A.5.18. Violations may result in account suspension and disciplinary action.
$pol$

  WHEN d.title = 'Access Control Policy' AND v.version_no = 'v2' THEN $pol$
# Access Control Policy

**Version:** v2 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2026-05-05

## 1. Purpose
Ensure that access to information systems is granted on the principle of least privilege, with strong authentication and continuous verification, aligned with MAS TRM Guidelines 2021 and Zero Trust principles.

## 2. Scope
Applies to all identities (human, service, machine, and AI agent) accessing organisational systems, including production, non-production, cloud workloads, SaaS, and third-party integrations.

## 3. Policy Statements
- Access is granted on a need-to-know, need-to-use basis with documented business justification and approval.
- Phishing-resistant MFA (FIDO2 / WebAuthn) is mandatory for all privileged access and externally exposed administrative consoles.
- Privileged access is brokered exclusively through the PAM platform with just-in-time elevation and full session recording.
- Service accounts use short-lived credentials (e.g., workload identity, OIDC federation); long-lived static keys are prohibited except where documented and risk-accepted.
- User access is recertified every 6 months; privileged and high-risk access every 3 months.
- Joiner / mover / leaver actions complete within 1 business day; leaver access revocation within 4 hours for sensitive roles.
- Break-glass accounts are sealed, monitored, and tested quarterly.

## 4. Roles & Responsibilities
- IAM Team: operates identity stores, PAM, federation, and certification tooling.
- System Owners: approve access, define role models, and complete recertifications.
- CISO: approves break-glass usage and reviews access exceptions.
- Line Managers: initiate joiner / mover / leaver requests promptly.

## 5. Compliance
Aligned with MAS TRM Guidelines 2021 (Section 9), MAS Notice 655 Cyber Hygiene (admin account controls), ISO/IEC 27001:2022 Annex A.5.15-A.5.18, and NIST SP 800-207 (Zero Trust). Violations trigger account suspension and may be reported to the regulator.

## 6. Change History
v2 (2026-05-05): Mandated phishing-resistant MFA for privileged access; added workload identity requirements; tightened leaver SLA for sensitive roles.
$pol$

  -- 4. Cryptography Policy
  WHEN d.title = 'Cryptography Policy' AND v.version_no = 'v1' THEN $pol$
# Cryptography Policy

**Version:** v1 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2025-08-12

## 1. Purpose
Define minimum cryptographic standards to protect data in transit and at rest in accordance with MAS TRM Guidelines and industry best practice.

## 2. Scope
Applies to all systems, applications, and data stores that handle Internal, Confidential, or Restricted data, including encryption in databases, file stores, backups, and network communications.

## 3. Policy Statements
- Data at rest must be encrypted with AES-256 or stronger.
- Data in transit must use TLS 1.2 or higher; TLS 1.0 / 1.1 and SSL are prohibited.
- Cryptographic keys are generated, stored, and rotated within an approved Key Management Service (KMS) or Hardware Security Module (HSM).
- Production keys are rotated at least annually or immediately upon suspected compromise.
- Use of deprecated algorithms (MD5, SHA-1, DES, RC4) is prohibited for security-relevant functions.

## 4. Roles & Responsibilities
- CISO: approves cryptographic standards and exceptions.
- Platform Engineering: operates the KMS / HSM and enforces baseline configurations.
- Application Owners: implement encryption in line with this policy.

## 5. Compliance
Aligned with MAS TRM Guidelines 2021 (Section 11), NIST SP 800-57, and ISO/IEC 27002:2022 Control 8.24. Non-compliance must be remediated within 30 days of detection.
$pol$

  WHEN d.title = 'Cryptography Policy' AND v.version_no = 'v2' THEN $pol$
# Cryptography Policy

**Version:** v2 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2026-04-10

## 1. Purpose
Define minimum cryptographic standards to protect data in transit and at rest, prepare for post-quantum cryptography (PQC) transition, and align with MAS TRM Guidelines 2021 and NIST cryptographic standards.

## 2. Scope
Applies to all systems, applications, APIs, data stores, backups, and network communications handling Internal, Confidential, or Restricted data, across on-premises, cloud, and SaaS environments.

## 3. Policy Statements
- Data at rest is encrypted with AES-256-GCM (or equivalent FIPS 140-3 validated algorithm).
- Data in transit uses TLS 1.2 minimum, with TLS 1.3 preferred. TLS 1.0 / 1.1, SSL, and weak ciphers (RC4, 3DES, export-grade) are prohibited.
- Cryptographic keys are generated, stored, and rotated within an approved KMS / HSM (FIPS 140-3 Level 2 or higher).
- Production data-encryption keys (DEKs) are rotated at least annually; key-encryption keys (KEKs) every 2 years or upon suspected compromise.
- Deprecated algorithms (MD5, SHA-1, DES, RC4) are prohibited for security functions; legacy hashes are permitted only for non-security identifiers with documented justification.
- Crypto agility shall be designed into new systems to enable PQC migration once NIST-finalised algorithms (e.g., ML-KEM, ML-DSA) are approved internally.
- Customer-managed keys (CMK) are offered for Restricted data in multi-tenant SaaS deployments.

## 4. Roles & Responsibilities
- CISO: approves cryptographic standards, the PQC roadmap, and exceptions.
- Platform Engineering: operates the enterprise KMS / HSM, monitors key health, and publishes baseline configurations.
- Application Owners: implement encryption per this policy and attest annually.
- Internal Audit: tests cryptographic control effectiveness during the annual ISMS audit.

## 5. Compliance
Aligned with MAS TRM Guidelines 2021 (Section 11), NIST SP 800-57, NIST SP 800-131A, ISO/IEC 27002:2022 Control 8.24, and FIPS 140-3. Findings must be remediated within 30 days; critical findings within 7 days.

## 6. Change History
v2 (2026-04-10): Added PQC readiness clause, customer-managed key option for Restricted data, and explicit FIPS 140-3 Level 2 baseline for KMS / HSM.
$pol$

  -- 5. Incident Response Policy
  WHEN d.title = 'Incident Response Policy' AND v.version_no = 'v1' THEN $pol$
# Incident Response Policy

**Version:** v1 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2025-09-20

## 1. Purpose
Establish a consistent process to detect, contain, eradicate, and recover from cyber and IT incidents while meeting MAS notification obligations.

## 2. Scope
Applies to all incidents affecting organisational information systems, data, or services, including those operated by outsourced service providers on behalf of the entity.

## 3. Policy Statements
- A 24x7 Security Operations Centre (SOC) monitors for security events.
- Incidents are triaged using a documented severity matrix (Sev-1 to Sev-4).
- Containment actions begin within 30 minutes of Sev-1 declaration.
- MAS-relevant incidents (system malfunction, security breach with customer impact) are reported to MAS within 1 hour of discovery and full report within 14 days per MAS Notice 644.
- Post-incident reviews (PIRs) are conducted within 10 business days of incident closure.

## 4. Roles & Responsibilities
- SOC / CSIRT: detects and coordinates incident response.
- Incident Commander: leads response and external communications.
- Legal & Compliance: manages regulatory notifications.
- Business Owners: support customer communications and recovery validation.

## 5. Compliance
Aligned with MAS Notice 644 (Technology Risk Management - Incident Notification), MAS TRM Guidelines 2021 (Section 13), and ISO/IEC 27035. Failure to notify in time may result in regulatory action.
$pol$

  WHEN d.title = 'Incident Response Policy' AND v.version_no = 'v2' THEN $pol$
# Incident Response Policy

**Version:** v2 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2026-05-12

## 1. Purpose
Establish a consistent process to detect, contain, eradicate, and recover from cyber and IT incidents, meeting MAS notification obligations and supporting PDPA breach notification requirements.

## 2. Scope
Applies to all incidents affecting organisational information systems, data, or services, including those operated by outsourced service providers, cloud platforms, and AI systems acting on behalf of the entity.

## 3. Policy Statements
- A 24x7 SOC monitors using SIEM, EDR, and threat intelligence feeds aligned to MITRE ATT&CK.
- Incidents are triaged using a documented severity matrix (Sev-1 to Sev-4) with defined response SLAs.
- Containment begins within 30 minutes for Sev-1, 2 hours for Sev-2.
- MAS-relevant incidents are reported within 1 hour of discovery; written follow-up within 14 days, per MAS Notice 644.
- Personal data breaches are assessed within 24 hours; if of significant scale or significant harm, notified to PDPC within 72 hours per PDPA s.26D.
- Post-incident reviews are conducted within 10 business days; corrective actions tracked to closure.
- Tabletop exercises are conducted at least twice per year, including a ransomware scenario.

## 4. Roles & Responsibilities
- SOC / CSIRT: detects, contains, and coordinates technical response.
- Incident Commander: leads response, decisions, and communications.
- Legal & Compliance: manages MAS and PDPC notifications and external counsel.
- Corporate Comms / Investor Relations: coordinates public messaging for Sev-1 incidents.
- Business Owners: validate recovery and customer remediation.

## 5. Compliance
Aligned with MAS Notice 644, MAS TRM Guidelines 2021 (Section 13), PDPA s.26A-26D Data Breach Notification, NIST SP 800-61r2, and ISO/IEC 27035. Late or omitted regulatory notification may attract financial penalties and supervisory action.

## 6. Change History
v2 (2026-05-12): Added PDPA breach notification workflow, mandatory ransomware tabletop exercise, and AI-system incident scope.
$pol$

  -- 6. Business Continuity Policy
  WHEN d.title = 'Business Continuity Policy' AND v.version_no = 'v1' THEN $pol$
# Business Continuity Policy

**Version:** v1 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2025-07-22

## 1. Purpose
Maintain the resilience of critical business services through structured business continuity and disaster recovery planning, aligned with ISO 22301 and MAS Business Continuity Management Guidelines.

## 2. Scope
Applies to all business units, supporting technology, and material outsourced services that underpin critical business services (CBS) delivered to customers and counterparties in Singapore.

## 3. Policy Statements
- A Business Impact Analysis (BIA) is conducted at least annually for all CBS.
- Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO) are defined and approved by the Risk Committee.
- BCP and DR plans are tested at least annually; results reported to the Board.
- Alternate work arrangements and DR sites are maintained for all Tier 1 services.
- Crisis management procedures are documented and rehearsed.

## 4. Roles & Responsibilities
- Chief Operating Officer: accountable for BCM programme.
- BCM Manager: maintains BIA, plans, and test schedule.
- Business Unit Heads: own their unit's BCP and recovery procedures.

## 5. Compliance
Aligned with ISO 22301:2019 and MAS Business Continuity Management Guidelines 2022. Inability to recover within stated RTO may trigger regulatory notification.
$pol$

  WHEN d.title = 'Business Continuity Policy' AND v.version_no = 'v2' THEN $pol$
# Business Continuity Policy

**Version:** v2 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2026-04-29

## 1. Purpose
Maintain the resilience of critical business services and meet operational resilience expectations under ISO 22301:2019 and the MAS Business Continuity Management Guidelines 2022.

## 2. Scope
Applies to all business units, supporting technology, third-party services, and intra-group dependencies that underpin Critical Business Services (CBS) delivered to customers, counterparties, and regulators in Singapore and offshore booking centres.

## 3. Policy Statements
- A BIA is performed annually and after any material change to CBS, with concentration risk reviewed for third parties and cloud regions.
- RTO and RPO are defined per CBS and approved by the Risk Committee; Tier 1 RTO does not exceed 4 hours and RPO does not exceed 15 minutes.
- BCP and DR plans are tested at least annually, including at least one unannounced failover for a Tier 1 service.
- Severe-but-plausible scenarios (e.g., regional cloud outage, ransomware, key-person loss) are tested over a 3-year rolling cycle.
- Alternate work arrangements, DR sites, and offline runbooks are maintained for all Tier 1 services.
- Crisis management is rehearsed semi-annually with executive participation.

## 4. Roles & Responsibilities
- COO: accountable owner of the BCM programme.
- BCM Manager: maintains BIA, plan library, scenario calendar, and lessons-learned register.
- Business Unit Heads: own unit BCPs and validate test results.
- CISO: aligns cyber resilience with BCM scenarios.
- Internal Audit: reviews BCM effectiveness annually.

## 5. Compliance
Aligned with ISO 22301:2019, MAS Business Continuity Management Guidelines 2022, MAS Notice 658 (Notice on Cyber Hygiene where applicable), and MAS Guidelines on Outsourcing. Failure to meet RTO / RPO must be reported per MAS Notice 644 timelines.

## 6. Change History
v2 (2026-04-29): Added severe-but-plausible scenario testing, explicit Tier 1 RTO / RPO caps, and concentration risk review for third parties and cloud regions.
$pol$

  -- 7. Vendor Risk Management Policy
  WHEN d.title = 'Vendor Risk Management Policy' AND v.version_no = 'v1' THEN $pol$
# Vendor Risk Management Policy

**Version:** v1 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2025-08-05

## 1. Purpose
Manage risks arising from third-party relationships throughout the vendor lifecycle, aligned with the MAS Guidelines on Outsourcing and MAS Notice 655.

## 2. Scope
Applies to all third parties providing goods or services to the entity, with enhanced controls for material outsourcing arrangements and providers that access Confidential or Restricted data.

## 3. Policy Statements
- All vendors are risk-tiered (Tier 1 - Material, Tier 2 - Significant, Tier 3 - Standard) at onboarding.
- Due diligence is performed pre-contract, including financial, cyber, and operational reviews.
- Material outsourcing requires CIO and CRO approval and is notified to MAS where required.
- Contracts include rights to audit, data location, sub-contracting controls, and exit provisions.
- Vendor performance and risk posture is reviewed at least annually.

## 4. Roles & Responsibilities
- Procurement: owns the vendor lifecycle process.
- Vendor Risk Team: performs due diligence and ongoing monitoring.
- Business Owners: maintain the relationship and validate service delivery.

## 5. Compliance
Aligned with MAS Guidelines on Outsourcing (revised 2018), MAS Notice 655, and ISO/IEC 27036. Material breaches in vendor controls must be reported to the Risk Committee.
$pol$

  WHEN d.title = 'Vendor Risk Management Policy' AND v.version_no = 'v2' THEN $pol$
# Vendor Risk Management Policy

**Version:** v2 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2026-05-08

## 1. Purpose
Manage risks arising from third-party and Nth-party relationships throughout the vendor lifecycle, aligned with the MAS Guidelines on Outsourcing, MAS Notice 655, and emerging operational resilience expectations.

## 2. Scope
Applies to all third parties providing goods, services, or data processing to the entity, including SaaS, cloud, AI / ML providers, intra-group service providers, and material sub-contractors (Nth parties).

## 3. Policy Statements
- All vendors are risk-tiered (Tier 1 - Material, Tier 2 - Significant, Tier 3 - Standard) at onboarding and re-tiered annually.
- Due diligence covers financial viability, cyber posture (incl. SOC 2 / ISO 27001), data protection, geopolitical / sanctions, and concentration risk.
- Material outsourcing requires CIO, CRO, and Board Risk Committee approval; notification to MAS per the Guidelines on Outsourcing.
- Contracts include rights to audit, sub-contracting consent, data residency (SG primary), exit / portability clauses, and service-level credits.
- Continuous monitoring uses external attack surface, breach feeds, and adverse media; Tier 1 vendors are reassessed annually with on-site or virtual audit.
- AI / ML vendors are additionally assessed under the AI Governance Policy (FEAT principles, model risk).

## 4. Roles & Responsibilities
- Procurement: owns the vendor master and lifecycle workflow.
- Vendor Risk Team: performs tiering, due diligence, and ongoing monitoring.
- CISO: signs off on cyber risk acceptance for Tier 1 vendors.
- Business Owners: validate service delivery and report performance issues.
- Internal Audit: reviews vendor risk effectiveness biennially.

## 5. Compliance
Aligned with MAS Guidelines on Outsourcing (revised 2018), MAS Notice 655 / FAA-N18, MAS TRM Guidelines 2021 (Section 5), and ISO/IEC 27036. Material control failures must be escalated to the Risk Committee within 5 business days.

## 6. Change History
v2 (2026-05-08): Added Nth-party scope, AI / ML vendor assessment requirement, continuous monitoring via external feeds, and explicit data-residency clause.
$pol$

  -- 8. Privacy Policy
  WHEN d.title = 'Privacy Policy' AND v.version_no = 'v1' THEN $pol$
# Privacy Policy

**Version:** v1 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2025-09-08

## 1. Purpose
Define how personal data is collected, used, disclosed, and protected in line with the Singapore Personal Data Protection Act (PDPA).

## 2. Scope
Applies to all personal data of customers, employees, and third parties processed by the entity, including data hosted by service providers acting on its behalf.

## 3. Policy Statements
- Personal data is collected only for purposes notified to the individual, with valid consent or other lawful basis.
- Data subject rights (access, correction, withdrawal of consent) are honoured within 30 days.
- Personal data is retained only as long as necessary and securely disposed at end of life.
- Cross-border transfers require comparable protection arrangements (e.g., contractual safeguards).
- A Data Protection Officer (DPO) is registered with the PDPC.

## 4. Roles & Responsibilities
- DPO: owns PDPA compliance and is the point of contact for individuals and PDPC.
- Business Units: maintain accurate records of processing activities.
- IT / Security: implement technical safeguards.

## 5. Compliance
Aligned with the PDPA (2012, amended 2020) and PDPC Advisory Guidelines. Breach may result in financial penalties up to S$1m or 10% of annual turnover (whichever is higher).
$pol$

  WHEN d.title = 'Privacy Policy' AND v.version_no = 'v2' THEN $pol$
# Privacy Policy

**Version:** v2 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2026-04-15

## 1. Purpose
Define how personal data is collected, used, disclosed, transferred, and protected, in line with the Singapore Personal Data Protection Act (PDPA, as amended 2020) and the PDPC Advisory Guidelines.

## 2. Scope
Applies to all personal data of customers, prospects, employees, contractors, and counterparties processed by the entity in any format (digital or physical), including data hosted or processed by service providers, intra-group entities, and AI systems.

## 3. Policy Statements
- Personal data is collected only for purposes notified to the individual, supported by valid consent, deemed consent by notification, or another lawful basis.
- Data subject rights (access, correction, withdrawal of consent, data portability) are honoured within 30 days; refusals are documented with justification.
- Personal data retention is governed by the Retention Schedule; secure disposal is verified.
- Cross-border transfers require comparable protection per PDPA s.26 (e.g., model contractual clauses, binding corporate rules, or transfer impact assessments).
- Data breaches of significant scale or significant harm are notified to the PDPC within 72 hours and to affected individuals where required.
- AI and automated decision-making involving personal data is subject to a DPIA and aligned with the AI Governance Policy.
- A registered DPO leads PDPA compliance and is reachable via dpo@entity.com.sg.

## 4. Roles & Responsibilities
- DPO: owns PDPA compliance, DPIAs, breach assessment, and PDPC liaison.
- Business Units: maintain Records of Processing Activities (RoPA) and execute purpose limitation.
- IT / Security: implement and monitor technical safeguards.
- HR: governs employee data processing.

## 5. Compliance
Aligned with the PDPA (2012, amended 2020), PDPC Advisory Guidelines, and the ASEAN Model Contractual Clauses for cross-border transfers. Maximum financial penalty is S$1m or 10% of annual turnover in Singapore (whichever is higher) for organisations with turnover above S$10m.

## 6. Change History
v2 (2026-04-15): Added 72-hour PDPC breach notification workflow, data portability handling, AI / automated decision DPIA requirement, and ASEAN MCC reference for cross-border transfers.
$pol$

  -- 9. AI Governance Policy
  WHEN d.title = 'AI Governance Policy' AND v.version_no = 'v1' THEN $pol$
# AI Governance Policy

**Version:** v1 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2025-09-25

## 1. Purpose
Govern the responsible development, procurement, deployment, and use of AI systems, anchored on the MAS FEAT principles (Fairness, Ethics, Accountability, Transparency).

## 2. Scope
Applies to all AI / ML systems built, bought, or used by the entity to support customer-facing or internal decisions, including generative AI and third-party models.

## 3. Policy Statements
- All AI use cases are registered in the AI Inventory and risk-tiered (High / Medium / Low).
- High-risk use cases require model risk assessment, bias testing, and human-in-the-loop controls.
- Customers materially impacted by AI decisions are informed and have access to human review.
- Training data lineage is documented; personal data use complies with PDPA and the Privacy Policy.
- Generative AI is restricted to approved enterprise tools; outputs are reviewed before client-facing use.

## 4. Roles & Responsibilities
- AI Governance Committee: approves high-risk use cases and policy exceptions.
- Model Owners: maintain documentation, monitoring, and retraining.
- CISO / DPO: assess security and privacy risks of AI systems.

## 5. Compliance
Aligned with MAS FEAT Principles (2018) and the IMDA Model AI Governance Framework. Misuse may result in disciplinary action and customer remediation.
$pol$

  WHEN d.title = 'AI Governance Policy' AND v.version_no = 'v2' THEN $pol$
# AI Governance Policy

**Version:** v2 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2026-05-20

## 1. Purpose
Govern the responsible development, procurement, deployment, and use of AI systems and AI agents, anchored on the MAS FEAT principles and the IMDA Model AI Governance Framework (2nd edition, including Generative AI).

## 2. Scope
Applies to all AI / ML systems and autonomous AI agents built, bought, fine-tuned, or used by the entity, including generative AI, foundation models, RAG systems, and agentic workflows acting on internal or customer data.

## 3. Policy Statements
- All AI use cases and agents are registered in the AI Inventory with model card, data card, and risk tier (High / Medium / Low).
- High-risk use cases require Model Risk Assessment, fairness / bias testing, explainability artefacts, and human-in-the-loop checkpoints.
- Customers materially impacted by AI decisions receive a plain-language notice and a path to human review.
- Training and fine-tuning data lineage is documented; personal data use complies with PDPA and is supported by a DPIA.
- Generative AI is restricted to approved enterprise tenants; outputs influencing client decisions require human attestation.
- AI agents that take real-world actions must have scoped permissions, audit logging, rate limits, and a kill switch.
- Continuous monitoring covers drift, hallucination rate, prompt-injection signals, and unsafe outputs; material drift triggers retraining or rollback.

## 4. Roles & Responsibilities
- AI Governance Committee: approves high-risk use cases, exceptions, and agent action scopes.
- Model Owners: maintain documentation, monitoring dashboards, and incident response for their models.
- CISO: governs AI security (model supply chain, prompt injection, secret leakage).
- DPO: governs personal data use and DPIA sign-off.
- Internal Audit: reviews AI governance effectiveness annually.

## 5. Compliance
Aligned with MAS FEAT Principles (2018), MAS Information Paper on Generative AI Risks (2024), IMDA Model AI Governance Framework, and ISO/IEC 42001:2023 (AI management systems). Violations may result in suspension of the AI use case, disciplinary action, and customer remediation.

## 6. Change History
v2 (2026-05-20): Extended scope to AI agents and generative AI; added kill-switch, drift / hallucination monitoring, and ISO/IEC 42001:2023 alignment.
$pol$

  -- 10. Data Classification Policy
  WHEN d.title = 'Data Classification Policy' AND v.version_no = 'v1' THEN $pol$
# Data Classification Policy

**Version:** v1 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2025-08-19

## 1. Purpose
Establish a consistent scheme for classifying and handling information based on sensitivity and business impact.

## 2. Scope
Applies to all information created, received, or processed by the entity in any format (electronic, paper, verbal), regardless of storage location.

## 3. Policy Statements
- Information is classified into four tiers: Public, Internal, Confidential, Restricted.
- Information Asset Owners assign classification at creation and review annually.
- Handling rules (storage, transmission, sharing, disposal) are defined per tier in the Data Handling Standard.
- Confidential and Restricted data must be encrypted at rest and in transit.
- Misclassification is a security incident and must be reported.

## 4. Roles & Responsibilities
- Information Asset Owners: assign and maintain classification.
- Data Stewards: enforce handling rules in their domain.
- All Staff: handle information according to its classification.

## 5. Compliance
Aligned with ISO/IEC 27001:2022 Annex A.5.12 and MAS TRM Guidelines 2021 (Section 8). Misclassification may lead to regulatory or contractual breach.
$pol$

  WHEN d.title = 'Data Classification Policy' AND v.version_no = 'v2' THEN $pol$
# Data Classification Policy

**Version:** v2 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2026-04-03

## 1. Purpose
Establish a consistent scheme for classifying and handling information based on sensitivity and business impact, and to drive automated data protection controls (DLP, IRM, encryption).

## 2. Scope
Applies to all information created, received, generated (including AI outputs), or processed by the entity in any format (electronic, paper, verbal), regardless of storage location, including third-party hosted environments.

## 3. Policy Statements
- Information is classified into four tiers: Public, Internal, Confidential, Restricted.
- Restricted includes regulated customer data, authentication secrets, source code for security-critical systems, and material non-public information.
- Information Asset Owners assign classification at creation, review annually, and tag systems for automated DLP / IRM enforcement.
- Handling rules (storage, transmission, sharing, retention, disposal) are defined per tier in the Data Handling Standard.
- Confidential and Restricted data must be encrypted at rest and in transit; Restricted data additionally requires logged access.
- AI-generated content inherits the classification of its source data; outputs derived from Restricted data are Restricted by default.
- Misclassification, especially over-permissioning of Restricted data, is a reportable security incident.

## 4. Roles & Responsibilities
- Information Asset Owners: assign and maintain classification; approve declassification.
- Data Stewards: enforce handling rules and operate DLP exceptions.
- CISO: maintains the classification scheme and DLP policy.
- All Staff: handle information according to its classification.

## 5. Compliance
Aligned with ISO/IEC 27001:2022 Annex A.5.12-A.5.13, MAS TRM Guidelines 2021 (Section 8), and PDPA data protection obligations. Repeated misclassification may result in disciplinary action.

## 6. Change History
v2 (2026-04-03): Clarified Restricted tier scope, added AI-output inheritance rule, and linked classification to DLP / IRM automation.
$pol$

  -- 11. Change Management Policy
  WHEN d.title = 'Change Management Policy' AND v.version_no = 'v1' THEN $pol$
# Change Management Policy

**Version:** v1 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2025-08-26

## 1. Purpose
Ensure that changes to production systems are introduced in a controlled manner that minimises risk to availability, integrity, and confidentiality.

## 2. Scope
Applies to all changes to production infrastructure, applications, configurations, and security controls, regardless of who performs the change.

## 3. Policy Statements
- All production changes are raised as Change Requests (CR) in the ITSM system and follow the documented workflow.
- Standard, Normal, and Emergency change types are defined with distinct approval paths.
- A Change Advisory Board (CAB) meets weekly to review Normal changes.
- Emergency changes require post-implementation review within 5 business days.
- Backout plans are mandatory for all Normal and Emergency changes.

## 4. Roles & Responsibilities
- Change Manager: chairs the CAB and maintains the change calendar.
- Change Implementers: execute changes and document outcomes.
- Service Owners: approve changes to their services.

## 5. Compliance
Aligned with ITIL 4 and MAS TRM Guidelines 2021 (Section 10). Unauthorised changes are reportable security incidents.
$pol$

  WHEN d.title = 'Change Management Policy' AND v.version_no = 'v2' THEN $pol$
# Change Management Policy

**Version:** v2 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2026-03-30

## 1. Purpose
Ensure that changes to production systems, including CI/CD-driven deployments and infrastructure-as-code, are introduced in a controlled manner that minimises risk to availability, integrity, and confidentiality.

## 2. Scope
Applies to all changes to production infrastructure, applications, configurations, security controls, and AI model deployments, whether implemented manually or via automated pipelines, by employees or third parties.

## 3. Policy Statements
- All production changes are tracked via Change Requests (CR) or auditable pipeline records in the ITSM / DevOps tooling.
- Change types - Standard (pre-approved), Normal, and Emergency - have distinct approval and risk-assessment paths.
- Pre-approved Standard changes (e.g., low-risk patches, IaC merges with required reviews) bypass CAB but are reviewed in aggregate monthly.
- CAB meets weekly to review Normal changes; high-impact changes require CISO concurrence.
- Emergency changes follow an expedited approval and require post-implementation review within 5 business days.
- Backout plans, test evidence, and monitoring hooks are mandatory for all Normal and Emergency changes.
- A change freeze is enforced during defined sensitive periods (e.g., financial reporting, peak trading windows).

## 4. Roles & Responsibilities
- Change Manager: chairs CAB, maintains calendar, and reports change KPIs.
- Service Owners: approve changes to their services and validate post-deployment.
- Platform / DevOps Leads: govern Standard change automation and IaC policy-as-code.
- CISO: approves changes that materially alter the security posture.

## 5. Compliance
Aligned with ITIL 4, MAS TRM Guidelines 2021 (Section 10), and ISO/IEC 27001:2022 Annex A.8.32. Unauthorised or undocumented changes are reportable security incidents.

## 6. Change History
v2 (2026-03-30): Recognised CI/CD pipelines and IaC as auditable change vectors, added pre-approved Standard change category, and introduced change-freeze windows.
$pol$

  -- 12. Vulnerability Management Policy
  WHEN d.title = 'Vulnerability Management Policy' AND v.version_no = 'v1' THEN $pol$
# Vulnerability Management Policy

**Version:** v1 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2025-08-15

## 1. Purpose
Identify, assess, and remediate technical vulnerabilities in a timely manner to reduce the entity's exposure to cyber threats.

## 2. Scope
Applies to all production and non-production systems, including infrastructure, applications, containers, and cloud workloads.

## 3. Policy Statements
- Authenticated vulnerability scans are run at least weekly for production systems.
- Vulnerabilities are prioritised using CVSS v3.1 scores adjusted for exploitability and asset criticality.
- Patch SLAs: Critical - 7 days; High - 30 days; Medium - 90 days; Low - best effort.
- Internet-facing critical vulnerabilities (CVSS >= 9.0) must be remediated within 48 hours or compensating controls applied.
- Penetration tests are conducted at least annually for Tier 1 systems.

## 4. Roles & Responsibilities
- CISO: owns the vulnerability management programme and SLA reporting.
- Asset Owners: remediate vulnerabilities on their systems.
- SOC: monitors exploitation attempts for known vulnerabilities.

## 5. Compliance
Aligned with MAS TRM Guidelines 2021 (Section 12) and MAS Notice 655. SLA breaches must be risk-accepted by the CISO.
$pol$

  WHEN d.title = 'Vulnerability Management Policy' AND v.version_no = 'v2' THEN $pol$
# Vulnerability Management Policy

**Version:** v2 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2026-05-02

## 1. Purpose
Identify, assess, and remediate technical vulnerabilities in a risk-prioritised, threat-informed manner to reduce the entity's exposure to cyber threats and meet MAS Notice 655 obligations.

## 2. Scope
Applies to all production and non-production systems, including on-premises infrastructure, cloud workloads, containers, serverless functions, SaaS, mobile apps, and AI / ML model dependencies.

## 3. Policy Statements
- Authenticated vulnerability scans are performed at least weekly for production; daily for internet-facing assets.
- Software composition analysis (SCA) and container image scanning are integrated into CI/CD; builds with Critical vulnerabilities fail by default.
- Prioritisation uses CVSS v3.1 / v4.0 adjusted by exploitability (e.g., CISA KEV, EPSS) and asset criticality.
- Patch SLAs: Critical - 7 days; High - 30 days; Medium - 90 days; Low - best effort. Internet-facing Critical (CVSS >= 9.0) - 48 hours.
- Zero-day vulnerabilities under active exploitation trigger the incident response process; emergency patching is authorised.
- External penetration tests cover Tier 1 systems annually; red-team exercises every 2 years.
- SLA breaches require documented risk acceptance by the CISO and are reported to the Risk Committee quarterly.

## 4. Roles & Responsibilities
- CISO: owns the programme, KPIs, and risk acceptance register.
- Vulnerability Management Team: operates scanners, triages findings, and publishes dashboards.
- Asset / Application Owners: remediate within SLA and provide evidence.
- SOC: monitors exploitation, KEV updates, and threat intelligence overlays.

## 5. Compliance
Aligned with MAS TRM Guidelines 2021 (Section 12), MAS Notice 655 / FAA-N18 Cyber Hygiene, NIST SP 800-40, and ISO/IEC 27001:2022 Annex A.8.8. Persistent SLA breaches may attract regulatory attention.

## 6. Change History
v2 (2026-05-02): Added SCA / container scanning in CI/CD, EPSS / KEV-informed prioritisation, zero-day emergency patching path, and red-team cadence.
$pol$

  -- 13. Logging & Monitoring Policy
  WHEN d.title = 'Logging & Monitoring Policy' AND v.version_no = 'v1' THEN $pol$
# Logging & Monitoring Policy

**Version:** v1 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2025-09-01

## 1. Purpose
Ensure adequate logging, monitoring, and alerting are in place to detect security and operational events, and to support forensic investigation.

## 2. Scope
Applies to all production systems, security devices, identity providers, and applications handling Confidential or Restricted data.

## 3. Policy Statements
- Security-relevant events (authentication, privileged access, configuration change, data access) are logged centrally to the SIEM.
- Log integrity is protected (append-only, hash-chained, or write-once storage).
- Logs related to regulated data are retained for at least 7 years; security logs for at least 1 year hot / 7 years cold.
- Time synchronisation uses authoritative NTP sources; clock drift > 5 seconds is alerted.
- High-severity SIEM alerts are triaged within 15 minutes by the SOC.

## 4. Roles & Responsibilities
- SOC: monitors SIEM and responds to alerts.
- Platform Engineering: maintains log pipelines and storage.
- Application Owners: ensure their applications emit required events.

## 5. Compliance
Aligned with MAS TRM Guidelines 2021 (Section 13), MAS Notice 655, and PDPA logging expectations.
$pol$

  WHEN d.title = 'Logging & Monitoring Policy' AND v.version_no = 'v2' THEN $pol$
# Logging & Monitoring Policy

**Version:** v2 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2026-04-25

## 1. Purpose
Ensure adequate logging, monitoring, alerting, and detection engineering are in place to detect security and operational events, support forensic investigation, and meet MAS record-keeping expectations.

## 2. Scope
Applies to all production systems, security devices, identity providers, network infrastructure, SaaS administrative consoles, cloud control planes, and applications handling Confidential or Restricted data.

## 3. Policy Statements
- Security-relevant events (authentication, MFA prompts, privileged access, configuration change, data access, code deployment) are logged centrally to the SIEM.
- Log integrity is protected using append-only / WORM storage; log tampering attempts trigger high-severity alerts.
- Retention: regulated data logs - 7 years; security logs - 1 year hot / 7 years cold; access logs to Restricted data - 7 years.
- Detection content is maintained as code, version-controlled, and mapped to MITRE ATT&CK; coverage gaps are reviewed quarterly.
- Time synchronisation uses authoritative NTP sources (stratum 1 / 2); clock drift > 1 second is alerted on critical systems.
- High-severity SIEM alerts are triaged within 15 minutes; mean time to detect (MTTD) and respond (MTTR) are reported monthly.
- User activity monitoring for privileged sessions includes keystroke / command recording per the Access Control Policy.

## 4. Roles & Responsibilities
- SOC: monitors SIEM, executes playbooks, and reports KPIs.
- Detection Engineering: maintains rules-as-code and ATT&CK coverage.
- Platform Engineering: maintains log pipelines, parsers, and storage tiers.
- Application Owners: ensure required events are emitted and structured (JSON, OpenTelemetry).
- DPO: reviews logs that include personal data for proportionality.

## 5. Compliance
Aligned with MAS TRM Guidelines 2021 (Section 13), MAS Notice 655, PDPA, the Securities and Futures Act record-keeping obligations, and ISO/IEC 27001:2022 Annex A.8.15-A.8.17.

## 6. Change History
v2 (2026-04-25): Added detection-as-code, ATT&CK coverage reviews, MTTD / MTTR KPIs, and structured logging requirement.
$pol$

  -- 14. Backup & Recovery Policy
  WHEN d.title = 'Backup & Recovery Policy' AND v.version_no = 'v1' THEN $pol$
# Backup & Recovery Policy

**Version:** v1 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2025-08-08

## 1. Purpose
Ensure data and systems can be restored after corruption, loss, or destructive cyber events, supporting RTO / RPO commitments.

## 2. Scope
Applies to all production data and systems supporting critical business services, including databases, file shares, configuration, and code repositories.

## 3. Policy Statements
- Backups follow the 3-2-1 rule: 3 copies on 2 different media with 1 off-site.
- All backups are encrypted at rest with AES-256 and in transit with TLS 1.2+.
- At least one backup copy is immutable / air-gapped to defend against ransomware.
- Restore tests are conducted quarterly for Tier 1 systems and annually for others.
- Backup failures are alerted and resolved within 24 hours.

## 4. Roles & Responsibilities
- Platform Engineering: operates backup infrastructure.
- Application Owners: validate restore tests and RPO sufficiency.
- BCM Manager: aligns backup posture with BCP requirements.

## 5. Compliance
Aligned with MAS TRM Guidelines 2021 (Section 10) and ISO 22301:2019.
$pol$

  WHEN d.title = 'Backup & Recovery Policy' AND v.version_no = 'v2' THEN $pol$
# Backup & Recovery Policy

**Version:** v2 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2026-05-15

## 1. Purpose
Ensure data and systems can be restored after corruption, loss, accidental deletion, or destructive cyber events (including ransomware), supporting RTO / RPO commitments and MAS operational resilience expectations.

## 2. Scope
Applies to all production data and systems supporting Critical Business Services, including relational and NoSQL databases, object stores, file shares, configuration, secrets, source code, and SaaS data (Microsoft 365, Salesforce, etc.).

## 3. Policy Statements
- Backups follow the 3-2-1-1-0 rule: 3 copies on 2 media, 1 off-site, 1 immutable / air-gapped, 0 errors after verification.
- All backups are encrypted at rest (AES-256) and in transit (TLS 1.2+); keys are managed in a separate trust zone from primary data.
- Immutable / WORM backups are retained per the Retention Schedule and protected from administrative deletion (object-lock, retention lock).
- Restore tests are conducted quarterly for Tier 1, semi-annually for Tier 2, and annually for Tier 3, with documented evidence.
- An annual full DR / cyber recovery exercise simulates restoration of a Tier 1 service from immutable backups.
- Backup failures alert within 1 hour; unresolved failures > 24 hours are escalated to the CISO.
- SaaS data is protected by an independent backup tool, not solely the vendor's native retention.

## 4. Roles & Responsibilities
- Platform Engineering: operates backup, immutable storage, and orchestration tooling.
- Application Owners: validate restore tests, RPO sufficiency, and data integrity.
- BCM Manager: aligns backup posture with BCP and BIA.
- CISO: approves backup architecture for ransomware resilience.

## 5. Compliance
Aligned with MAS TRM Guidelines 2021 (Section 10), MAS Business Continuity Management Guidelines 2022, ISO 22301:2019, and ISO/IEC 27001:2022 Annex A.8.13.

## 6. Change History
v2 (2026-05-15): Adopted 3-2-1-1-0 rule, added immutable backup retention lock, independent SaaS backup requirement, and annual cyber recovery exercise.
$pol$

  -- 15. Cloud Security Policy
  WHEN d.title = 'Cloud Security Policy' AND v.version_no = 'v1' THEN $pol$
# Cloud Security Policy

**Version:** v1 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2025-09-12

## 1. Purpose
Govern the secure adoption and operation of public, private, and hybrid cloud services, including SaaS, in line with MAS Guidelines on Outsourcing and Cloud Computing.

## 2. Scope
Applies to all use of cloud services that store, process, or transmit organisational data, irrespective of whether the cloud is procured by IT or directly by a business unit.

## 3. Policy Statements
- Only Cloud Service Providers (CSPs) that have passed enterprise due diligence may be used.
- The shared responsibility model is documented for each CSP, with control ownership clearly mapped.
- Restricted and customer-sensitive data is hosted in Singapore regions unless an explicit exception is approved.
- Cloud workloads follow a hardened baseline (CIS Benchmarks, CSP security best practices).
- Cloud configuration is monitored continuously via CSPM; high-severity misconfigurations are remediated within 7 days.

## 4. Roles & Responsibilities
- CISO: owns cloud security architecture and exceptions.
- Cloud Platform Team: operates landing zones, guardrails, and CSPM.
- Application Owners: deploy within approved guardrails.

## 5. Compliance
Aligned with MAS Guidelines on Outsourcing (Cloud Annex), MAS TRM Guidelines 2021 (Section 7), and the CSA Cloud Controls Matrix.
$pol$

  WHEN d.title = 'Cloud Security Policy' AND v.version_no = 'v2' THEN $pol$
# Cloud Security Policy

**Version:** v2 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2026-04-18

## 1. Purpose
Govern the secure adoption and operation of public, private, hybrid, and edge cloud services (IaaS, PaaS, SaaS, FaaS) in line with MAS Guidelines on Outsourcing (Cloud Annex), MAS TRM Guidelines 2021, and the Cyber Hygiene Notice.

## 2. Scope
Applies to all use of cloud services - including AI / ML platforms and managed databases - that store, process, or transmit organisational data, regardless of procurement channel.

## 3. Policy Statements
- Only CSPs assessed under the Vendor Risk Management Policy and approved by the CISO are permitted; SaaS via "shadow IT" is prohibited.
- The shared responsibility model is documented per service tier; customer-side controls are owned, tested, and evidenced.
- Restricted and customer-sensitive data resides in Singapore regions; cross-region replication requires explicit approval and Transfer Impact Assessment.
- Landing zones enforce baseline guardrails (encryption, logging, IAM, network segmentation) via policy-as-code; drift is auto-remediated where safe.
- CSPM and CIEM monitor configuration and entitlements continuously; Critical misconfigurations remediated within 24 hours, High within 7 days.
- Egress from production to the internet is brokered and monitored; admin actions on cloud control planes require MFA and PAM.
- Concentration risk across CSPs is assessed annually; exit and portability plans are maintained for Tier 1 workloads.

## 4. Roles & Responsibilities
- CISO: owns cloud security architecture, guardrails, and risk acceptance.
- Cloud Platform Team: operates landing zones, IaC modules, CSPM / CIEM, and policy-as-code.
- Application Owners: deploy within approved guardrails and respond to drift findings.
- Procurement: gates SaaS purchases to ensure vendor approval.

## 5. Compliance
Aligned with MAS Guidelines on Outsourcing (Cloud Annex), MAS TRM Guidelines 2021 (Section 7), MAS Notice 655 / FAA-N18, CSA Cloud Controls Matrix v4, and ISO/IEC 27017 / 27018.

## 6. Change History
v2 (2026-04-18): Added CIEM, policy-as-code guardrails, concentration risk review, and exit / portability plan for Tier 1 workloads.
$pol$

  -- 16. Mobile Device Policy
  WHEN d.title = 'Mobile Device Policy' AND v.version_no = 'v1' THEN $pol$
# Mobile Device Policy

**Version:** v1 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2025-09-05

## 1. Purpose
Govern the secure use of corporate-owned and personal mobile devices accessing organisational data and services.

## 2. Scope
Applies to all smartphones and tablets, whether corporate-issued or under a BYOD arrangement, that access corporate email, collaboration tools, or business applications.

## 3. Policy Statements
- All devices accessing corporate data must be enrolled in the Mobile Device Management (MDM) platform.
- Devices must enforce passcode / biometrics, device encryption, and automatic lock within 5 minutes.
- Lost or stolen devices must be reported within 1 hour to enable remote wipe.
- Jailbroken / rooted devices are blocked from accessing corporate resources.
- Corporate data on BYOD devices is containerised and remotely wipeable.

## 4. Roles & Responsibilities
- IT Operations: manages MDM and device baselines.
- Users: comply with MDM enrolment and reporting requirements.
- HR: communicates BYOD terms during onboarding.

## 5. Compliance
Aligned with MAS TRM Guidelines 2021 (Section 14) and ISO/IEC 27001:2022 Annex A.6.7.
$pol$

  WHEN d.title = 'Mobile Device Policy' AND v.version_no = 'v2' THEN $pol$
# Mobile Device Policy

**Version:** v2 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2026-03-22

## 1. Purpose
Govern the secure use of corporate-owned and personal mobile devices, including wearables and tablets, accessing organisational data, services, and AI assistants.

## 2. Scope
Applies to all smartphones, tablets, and wearables - corporate-issued (COPE) or BYOD - that access corporate email, collaboration, business applications, or authentication apps.

## 3. Policy Statements
- All devices accessing corporate data must be enrolled in MDM / UEM with attestation of device posture (OS version, encryption, jailbreak / root status).
- Devices must enforce passcode / biometrics, full-device encryption, and automatic lock within 5 minutes; failed unlock attempts trigger lockout.
- OS updates must be applied within 14 days of vendor release; devices > 30 days out of date lose access until updated.
- Lost or stolen devices are reported within 1 hour via the Service Desk to trigger remote wipe of the corporate container.
- Jailbroken / rooted / developer-mode devices are blocked from accessing corporate resources.
- Corporate data on BYOD devices resides in a managed container with no copy / paste to personal apps and selective wipe on offboarding.
- Use of public USB charging ports for corporate devices is discouraged; data-blocker cables are provided.

## 4. Roles & Responsibilities
- IT Operations: operates MDM / UEM, baselines, and conditional access.
- CISO: approves OS / device exception list.
- Users: comply with enrolment, updates, and incident reporting.
- HR: communicates BYOD terms and offboarding flows.

## 5. Compliance
Aligned with MAS TRM Guidelines 2021 (Section 14), MAS Notice 655, ISO/IEC 27001:2022 Annex A.6.7 / A.8.1, and PDPA (for personal data on devices).

## 6. Change History
v2 (2026-03-22): Added OS update SLA, posture attestation, BYOD container restrictions, and wearable / tablet scope.
$pol$

  -- 17. Outsourcing Policy (MAS 655)
  WHEN d.title = 'Outsourcing Policy (MAS 655)' AND v.version_no = 'v1' THEN $pol$
# Outsourcing Policy (MAS 655)

**Version:** v1 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2025-08-22

## 1. Purpose
Govern outsourcing arrangements in accordance with the MAS Guidelines on Outsourcing and MAS Notice 655 / FAA-N18 Cyber Hygiene obligations.

## 2. Scope
Applies to all outsourcing arrangements, with enhanced controls for material outsourcing as defined by MAS (those that, if disrupted, would materially affect business operations, reputation, or ability to manage risks).

## 3. Policy Statements
- Material outsourcing is approved by the Board or its delegated committee.
- Pre-engagement due diligence covers financial standing, operational capability, cyber posture, and country risk.
- Contracts include MAS-mandated clauses: right to audit, access to MAS, sub-contracting controls, data confidentiality, BCP, exit.
- Material outsourcing arrangements are notified to MAS as required and recorded in the Outsourcing Register.
- Ongoing monitoring includes annual review, KPI tracking, and incident reporting from the service provider.

## 4. Roles & Responsibilities
- Board / Risk Committee: approves material outsourcing.
- CIO / CRO: jointly assess material outsourcing risk.
- Business Owners: manage day-to-day service delivery.
- Procurement / Legal: ensure contracts meet MAS requirements.

## 5. Compliance
Aligned with MAS Guidelines on Outsourcing (revised 2018) and MAS Notice 655. Non-compliance may result in supervisory action.
$pol$

  WHEN d.title = 'Outsourcing Policy (MAS 655)' AND v.version_no = 'v2' THEN $pol$
# Outsourcing Policy (MAS 655)

**Version:** v2 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2026-05-18

## 1. Purpose
Govern outsourcing arrangements in accordance with the MAS Guidelines on Outsourcing, MAS Notice 655 / FAA-N18 Cyber Hygiene, and emerging operational resilience expectations, including cloud and intra-group arrangements.

## 2. Scope
Applies to all outsourcing arrangements (including cloud, SaaS, intra-group, and material sub-contracts), with enhanced controls for material outsourcing as defined under the MAS Guidelines on Outsourcing.

## 3. Policy Statements
- Material outsourcing requires Board (or delegated committee) approval and a self-assessment against the MAS Guidelines.
- Pre-engagement due diligence covers financial, operational, cyber, data protection, country, ESG, and concentration risk.
- Contracts include MAS-mandated clauses: right to audit (including MAS access), sub-contracting consent, data confidentiality and residency, BCP / DR obligations, security incident notification, exit and portability.
- Material outsourcing arrangements are notified to MAS as required and maintained in the Outsourcing Register with annual attestation.
- Cyber Hygiene baseline controls (admin accounts, security patches, malware protection, secure standards, network perimeter, MFA) are evidenced by service providers under Notice 655.
- Ongoing monitoring includes annual reassessment, on-site or virtual audits for Tier 1, KPI / SLA dashboards, and incident reporting from the service provider within agreed timelines.
- Exit and stressed-exit plans are maintained and tested every 2 years for material outsourcing.

## 4. Roles & Responsibilities
- Board / Risk Committee: approves material outsourcing and reviews concentration risk.
- CIO / CRO: jointly own material outsourcing risk assessments.
- CISO: validates Notice 655 baseline control evidence from providers.
- Business Owners: manage service delivery and SLA performance.
- Procurement / Legal: ensure contracts and exit clauses meet MAS expectations.

## 5. Compliance
Aligned with MAS Guidelines on Outsourcing (revised 2018), MAS Notice 655 / FAA-N18 Cyber Hygiene, MAS TRM Guidelines 2021, and MAS Business Continuity Management Guidelines 2022. Material breaches must be reported to MAS within prescribed timelines.

## 6. Change History
v2 (2026-05-18): Added stressed-exit plan testing, explicit Notice 655 baseline evidence requirement, ESG due diligence, and concentration risk review at Board level.
$pol$

  -- 18. ESG Reporting Policy
  WHEN d.title = 'ESG Reporting Policy' AND v.version_no = 'v1' THEN $pol$
# ESG Reporting Policy

**Version:** v1 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2025-09-18

## 1. Purpose
Govern the collection, assurance, and disclosure of Environmental, Social, and Governance (ESG) information in line with SGX listing rules and globally recognised frameworks.

## 2. Scope
Applies to all ESG-related data and disclosures across the group, including operational, financed, and supply-chain emissions where in scope.

## 3. Policy Statements
- Annual sustainability reports are prepared in line with the SGX Sustainability Reporting Guide and reference GRI Standards.
- Climate-related disclosures follow TCFD recommendations and the ISSB / IFRS S2 baseline.
- Scope 1 and Scope 2 greenhouse gas emissions are measured annually; material Scope 3 categories are estimated.
- ESG data sources, calculation methodologies, and emission factors are documented.
- Material ESG disclosures are subject to independent external assurance (limited assurance minimum).

## 4. Roles & Responsibilities
- Head of Sustainability: owns the ESG reporting programme.
- Finance: integrates ESG data into financial and management reporting.
- Internal Audit: reviews controls over ESG data.

## 5. Compliance
Aligned with the SGX Sustainability Reporting Guide, GRI Standards, and TCFD recommendations.
$pol$

  WHEN d.title = 'ESG Reporting Policy' AND v.version_no = 'v2' THEN $pol$
# ESG Reporting Policy

**Version:** v2 | **Status:** Active | **Owner:** Risk & Compliance | **Last Reviewed:** 2026-05-25

## 1. Purpose
Govern the collection, assurance, and disclosure of Environmental, Social, and Governance (ESG) information in line with SGX listing rules, the ISSB / IFRS S1 and S2 standards, and globally recognised frameworks, supporting Singapore's transition to mandatory climate disclosures.

## 2. Scope
Applies to all ESG-related data and disclosures across the group, including operational (Scope 1 and 2), value-chain (Scope 3) emissions, financed emissions where in scope, and social / governance metrics for listed and material non-listed entities.

## 3. Policy Statements
- Annual sustainability reports reference GRI Standards and disclose climate-related information per IFRS S2 / TCFD recommendations.
- Scope 1 and 2 GHG emissions are measured annually using the GHG Protocol; material Scope 3 categories are quantified with documented methodology and uncertainty.
- ESG data is captured in an auditable system of record with versioning, source traceability, and approval workflow comparable to financial controls.
- Climate scenario analysis (at least one orderly and one disorderly transition) is performed at least every 2 years and informs strategy.
- Material climate and broader ESG disclosures receive independent external assurance (limited assurance minimum; reasonable assurance for Scope 1 / 2 where required).
- Greenwashing risk is reviewed by Legal and Compliance prior to publication of ESG claims.

## 4. Roles & Responsibilities
- Head of Sustainability: owns the ESG reporting programme, methodology, and data governance.
- CFO: ensures ESG data controls meet financial-grade rigour and integrates with management reporting.
- Risk & Compliance: reviews disclosures for accuracy and greenwashing risk.
- Internal Audit: provides assurance over ESG data and controls annually.
- Board Sustainability Committee: approves the annual sustainability report.

## 5. Compliance
Aligned with the SGX Sustainability Reporting Guide (incl. mandatory climate disclosures roadmap), GRI Standards, IFRS S1 / S2 (ISSB), TCFD recommendations, and the GHG Protocol. Misleading disclosures may attract enforcement under the Securities and Futures Act and SGX rules.

## 6. Change History
v2 (2026-05-25): Added IFRS S1 / S2 alignment, climate scenario analysis cadence, greenwashing review step, and financial-grade data controls.
$pol$

  ELSE v.content_md  -- leave non-seeded content untouched
END
FROM policy.documents d
WHERE d.id = v.document_id
  AND v.content_md LIKE '%auto-seeded%';
