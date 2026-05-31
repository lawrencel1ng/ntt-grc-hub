-- Migration 038: Replace generic compliance gap remediation plans with
-- requirement-specific text, and diversify policy exception justifications.

-- =============================================================================
-- Part 1: compliance.gaps — specific remediation plans based on requirement title
-- =============================================================================

UPDATE compliance.gaps g
SET remediation_plan =
  CASE
    WHEN r.title ILIKE '%encryption at rest%'
      THEN 'Enable AES-256 encryption for all in-scope data stores. Validate key management via KMS audit. Submit encryption attestation to Control Tester agent within 30 days.'
    WHEN r.title ILIKE '%encryption in transit%'
      THEN 'Enforce TLS 1.2+ on all internal and external API endpoints. Disable legacy cipher suites. Conduct cipher-scan via vulnerability management tooling and remediate within 21 days.'
    WHEN r.title ILIKE '%privileged access%'
      THEN 'Implement quarterly privileged access review via PAM vault reports. Assign review owner (CISO Office). Complete first review cycle within 45 days and retain evidence in GRC platform.'
    WHEN r.title ILIKE '%change management%'
      THEN 'Enforce CAB approval gate in Jira/ServiceNow for all production changes. Update change management policy to reflect two-reviewer minimum. Evidence collector agent to capture change tickets monthly.'
    WHEN r.title ILIKE '%logging and monitoring%'
      THEN 'Configure Splunk/SIEM retention to 12 months for in-scope systems. Validate log completeness via quarterly log audit. Enable alerting for critical log gaps within 30 days.'
    WHEN r.title ILIKE '%disaster recovery%' OR r.title ILIKE '%RTO%' OR r.title ILIKE '%RPO%'
      THEN 'Schedule full DR failover test within 60 days. Document RTO/RPO results against contractual thresholds. Update BCP if thresholds are not met. Evidence to be captured in BCM module.'
    WHEN r.title ILIKE '%penetration testing%'
      THEN 'Engage approved penetration testing vendor (CREST-certified). Scope to cover in-scope systems per MAS TRM Annex B. Complete test and remediate critical findings within 90 days.'
    WHEN r.title ILIKE '%configuration baseline%'
      THEN 'Deploy CIS hardening benchmarks (Level 1) via configuration management tooling. Run baseline compliance scan and remediate critical deviations within 30 days.'
    WHEN r.title ILIKE '%vendor risk%'
      THEN 'Complete SIG or CAIQ questionnaire for all Tier-1 and Tier-2 vendors. Review SOC 2 Type II reports. Close questionnaire gaps within the vendor''s next contractual review cycle.'
    WHEN r.title ILIKE '%backup%' OR r.title ILIKE '%recovery testing%'
      THEN 'Conduct backup restore test for all critical systems within 30 days. Document RPO/RTO results. Store test evidence in BCM module and schedule next test at 6-month intervals.'
    WHEN r.title ILIKE '%incident response%'
      THEN 'Review and update IRP to align with MAS Notice 655 and ISO 27035. Conduct tabletop exercise within 60 days. Update contact trees and escalation paths. Retain exercise evidence in GRC platform.'
    WHEN r.title ILIKE '%data retention%'
      THEN 'Document data retention schedules for all in-scope data categories under PDPA and applicable regulations. Automate deletion workflows for data beyond retention thresholds. Complete review within 45 days.'
    WHEN r.title ILIKE '%audit log%'
      THEN 'Extend audit log retention to 12 months for financial systems and 7 years for regulated transaction records. Validate log integrity controls. Submit audit log retention attestation within 30 days.'
    WHEN r.title ILIKE '%risk assessment%'
      THEN 'Formalise quarterly risk assessment cycle with documented risk register updates. Assign risk register owner. Complete next risk assessment cycle within 60 days.'
    WHEN r.title ILIKE '%security awareness%' OR r.title ILIKE '%training%'
      THEN 'Achieve minimum 95% training completion for all staff on mandatory security awareness modules. Launch targeted phishing simulation for departments below 90% within 30 days.'
    WHEN r.title ILIKE '%personnel security%'
      THEN 'Implement pre-employment screening for all roles with access to regulated data. Review current onboarding/offboarding procedures against MAS TRM Chapter 9. Close process gaps within 60 days.'
    WHEN r.title ILIKE '%MFA%' OR r.title ILIKE '%multi-factor%'
      THEN 'Enforce MFA on all administrative and remote-access interfaces within 30 days. Disable password-only access for privileged accounts. Validate coverage via Okta/Azure AD audit report.'
    WHEN r.title ILIKE '%patch management%'
      THEN 'Achieve patch SLA compliance: critical patches within 14 days, high within 30 days. Generate Qualys/Tenable patch compliance report and remediate overdue items within the compliance window.'
    WHEN r.title ILIKE '%network segmentation%'
      THEN 'Review firewall rules and VLAN segmentation for in-scope environments. Implement micro-segmentation for PCI and regulated data zones. Conduct network segmentation test within 45 days.'
    WHEN r.title ILIKE '%cryptographic key%'
      THEN 'Implement automated KMS key rotation at 12-month intervals. Review key custody procedures. Validate HSM controls for keys protecting regulated data. Complete review within 30 days.'
    WHEN r.title ILIKE '%AI model%' OR r.title ILIKE '%model risk%'
      THEN 'Establish AI model risk management framework per MAS TRM Chapter 12. Register all production AI/ML models in AI Governance module. Complete model validation for high-risk models within 90 days.'
    WHEN r.title ILIKE '%cross-border%' OR r.title ILIKE '%transfer%'
      THEN 'Review cross-border data transfer arrangements against MAS Notice 655 and PDPA Part IX. Obtain Binding Corporate Rules or data transfer agreements where required. Complete review within 60 days.'
    WHEN r.title ILIKE '%data classification%'
      THEN 'Implement data classification labelling for all data stores per the data classification policy. Train data owners on classification procedures. Complete initial classification sweep within 60 days.'
    WHEN r.title ILIKE '%subject access%'
      THEN 'Implement automated DSAR handling workflow to meet 30-day response obligation under PDPA. Assign DPO oversight role. Complete SAR process review and update procedures within 45 days.'
    WHEN r.title ILIKE '%cloud workload%' OR r.title ILIKE '%isolation%'
      THEN 'Implement workload isolation controls (dedicated VPCs, network policies) for regulated cloud workloads. Conduct cloud architecture review with approved CSP against MAS TRM cloud guidelines within 45 days.'
    WHEN r.title ILIKE '%access control policy%'
      THEN 'Review and update the access control policy to cover RBAC, least-privilege, and periodic recertification requirements. Obtain board approval and communicate to all access owners within 60 days.'
    WHEN r.title ILIKE '%endpoint protection%'
      THEN 'Deploy EDR solution (CrowdStrike/SentinelOne) to 100% of managed endpoints. Verify agent coverage via dashboard and remediate gaps within 21 days. Enable threat hunting for high-risk user segments.'
    WHEN r.title ILIKE '%vulnerability management%'
      THEN 'Establish continuous vulnerability scanning cycle using Qualys/Tenable. Define SLAs: critical CVEs within 7 days, high within 30 days. Generate first full scan report within 14 days.'
    ELSE
      'Conduct gap assessment, assign control owner, develop remediation plan and evidence schedule. Target closure within 60 days of plan approval.'
  END
FROM compliance.requirements r
WHERE g.requirement_id = r.id
  AND g.remediation_plan = 'Remediation: implement control, run test, capture evidence. ETA 30-60 days.';

-- =============================================================================
-- Part 2: policy.exceptions — diversify justifications (all currently identical)
-- =============================================================================

UPDATE policy.exceptions
SET justification = (ARRAY[
  'Legacy system constraint prevents full compliance; compensating control (enhanced monitoring) approved by CRO. Expires 90 days pending upgrade project delivery.',
  'Project timeline conflict with Q2 release freeze; exception granted pending post-release remediation sprint. Risk accepted by CISO with enhanced logging in place.',
  'Third-party integration dependency requires vendor patch; exception approved pending vendor''s next quarterly release cycle. Vendor escalation tracked in issue register.',
  'Operational constraint during core banking migration window; exception covers freeze period only. Full compliance to be restored within 14 days of migration completion.',
  'Resource constraint in small-entity subsidiary; central IT team assigned to remediate. Exception approved by Group CRO for 60 days with monthly status review.',
  'Regulatory interpretation ambiguity pending MAS guidance clarification; exception approved by Legal & Compliance pending official MAS response.',
  'Technical limitation of on-premises HSM model; upgrade approved in capital plan for Q3 2026. Compensating control: manual key custody procedures with dual sign-off.',
  'Staff shortage in Risk & Compliance team during year-end close; exception covers 30-day period with enhanced management sign-off on all in-scope transactions.'
])[(abs(hashtext(id::text)) % 8 + 1)]
WHERE justification = 'Compensating control in place. Approved by CRO for 90 days.';
