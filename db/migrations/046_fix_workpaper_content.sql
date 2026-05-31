-- Migration 046: Replace identical workpaper procedures with engagement-type-appropriate,
-- workpaper-number-varied content. Uses row_number per engagement to assign different
-- focus areas to each workpaper. Idempotent: WHERE matches original procedure text.

-- Use a CTE to assign row number per engagement, then update with varied content.

WITH ranked AS (
  SELECT
    w.id,
    w.title,
    e.name AS engagement_name,
    e.framework_id,
    row_number() OVER (PARTITION BY w.engagement_id ORDER BY w.title) AS wp_num,
    COUNT(*) OVER (PARTITION BY w.engagement_id) AS wp_total
  FROM audit.workpapers w
  JOIN audit.engagements e ON e.id = w.engagement_id
  WHERE w.content_md LIKE '%Sampled 25 evidence items%'
)
UPDATE audit.workpapers wp
SET content_md = (
  SELECT
    '# Workpaper' || chr(10) || chr(10) ||
    '* Engagement: ' || r.engagement_name || chr(10) ||
    '* Auditor: ' || (SELECT lead_auditor FROM audit.engagements WHERE id = wp.engagement_id) || chr(10) ||
    '* Workpaper ' || r.wp_num::text || ' of ' || r.wp_total::text || chr(10) ||
    chr(10) ||
    CASE
      WHEN r.framework_id IN ('mas-trm', 'mas-notice-655') THEN
        CASE r.wp_num
          WHEN 1 THEN
            '## Focus area: Access and Identity Controls' || chr(10) || chr(10) ||
            '## Procedures performed' || chr(10) ||
            '- Reviewed IAM policy configuration for in-scope systems' || chr(10) ||
            '- Sampled 20 privileged account entries against approved access list' || chr(10) ||
            '- Verified MFA enforcement on critical administrative interfaces' || chr(10) ||
            '- Inspected quarterly access review evidence for completeness' || chr(10) || chr(10) ||
            '## Conclusion' || chr(10) ||
            'Privileged access controls are operating effectively. One exception: 3 service accounts flagged for MFA enforcement — owner notified.'
          WHEN 2 THEN
            '## Focus area: Change Management and Release Controls' || chr(10) || chr(10) ||
            '## Procedures performed' || chr(10) ||
            '- Sampled 25 production change tickets against CAB approval requirements' || chr(10) ||
            '- Verified dual-sign-off on all emergency changes in scope period' || chr(10) ||
            '- Inspected post-implementation review evidence for high-risk changes' || chr(10) ||
            '- Reviewed rollback documentation completeness' || chr(10) || chr(10) ||
            '## Conclusion' || chr(10) ||
            'Change management controls effective. 2 of 25 sampled changes lacked complete post-implementation review — root cause confirmed as training gap; remediation plan in place.'
          ELSE
            '## Focus area: Logging, Monitoring and Incident Response' || chr(10) || chr(10) ||
            '## Procedures performed' || chr(10) ||
            '- Reviewed SIEM log retention configuration against 12-month policy' || chr(10) ||
            '- Sampled 15 security alert escalations for timeliness of response' || chr(10) ||
            '- Verified incident reporting SLA compliance against MAS Notice 655 obligations' || chr(10) ||
            '- Inspected last 3 incident postmortems for completeness and action closure' || chr(10) || chr(10) ||
            '## Conclusion' || chr(10) ||
            'Logging and monitoring controls effective. All sampled incidents reported within MAS 1-hour notification SLA. One postmortem action item overdue — escalated to control owner.'
        END
      WHEN r.framework_id IN ('iso-27001', 'iso-22301') THEN
        CASE r.wp_num
          WHEN 1 THEN
            '## Focus area: Information Classification and Asset Management' || chr(10) || chr(10) ||
            '## Procedures performed' || chr(10) ||
            '- Reviewed asset register completeness and classification accuracy for 30 sampled assets' || chr(10) ||
            '- Verified data labelling on sampled data stores against classification policy' || chr(10) ||
            '- Confirmed data owner assignment for all in-scope data categories' || chr(10) ||
            '- Inspected disposal records for decommissioned assets' || chr(10) || chr(10) ||
            '## Conclusion' || chr(10) ||
            'Asset management controls effective. Classification coverage 94% of in-scope assets. 6 assets pending classification update — owner notified.'
          WHEN 2 THEN
            '## Focus area: Cryptography and Encryption Controls' || chr(10) || chr(10) ||
            '## Procedures performed' || chr(10) ||
            '- Reviewed KMS key rotation schedule and confirmed completion within policy' || chr(10) ||
            '- Sampled TLS configuration on 15 public-facing endpoints via cipher scan' || chr(10) ||
            '- Verified AES-256 encryption at rest for all in-scope data stores' || chr(10) ||
            '- Inspected key custody procedures and HSM access logs' || chr(10) || chr(10) ||
            '## Conclusion' || chr(10) ||
            'Cryptographic controls effective. All endpoints confirmed TLS 1.2+. One KMS key rotation completed 8 days past schedule — management accepted with compensating control.'
          ELSE
            '## Focus area: Business Continuity and Resilience Testing' || chr(10) || chr(10) ||
            '## Procedures performed' || chr(10) ||
            '- Reviewed BCP documentation for currency and completeness' || chr(10) ||
            '- Confirmed DR test was conducted and results met RTO/RPO targets' || chr(10) ||
            '- Sampled 10 business impact assessment entries for accuracy' || chr(10) ||
            '- Verified escalation contact lists are current and tested' || chr(10) || chr(10) ||
            '## Conclusion' || chr(10) ||
            'BCM controls effective. Last DR test achieved RTO of 52 minutes against 60-minute target. Contact list refreshed post-exercise. No material gaps identified.'
        END
      WHEN r.framework_id IN ('soc2', 'pci-dss-4') THEN
        CASE r.wp_num
          WHEN 1 THEN
            '## Focus area: Logical Access and Availability Controls' || chr(10) || chr(10) ||
            '## Procedures performed' || chr(10) ||
            '- Reviewed user access provisioning and deprovisioning records for 25 sampled accounts' || chr(10) ||
            '- Confirmed SOD conflicts were identified and remediated or accepted' || chr(10) ||
            '- Inspected uptime monitoring data and SLA performance for in-scope services' || chr(10) ||
            '- Reviewed load balancing and redundancy configuration for critical systems' || chr(10) || chr(10) ||
            '## Conclusion' || chr(10) ||
            'Access and availability controls effective. SOD matrix current. 2 deprovisioning delays noted — average 3.2 days beyond policy threshold; HR process update in progress.'
          WHEN 2 THEN
            '## Focus area: Data Integrity and Backup Controls' || chr(10) || chr(10) ||
            '## Procedures performed' || chr(10) ||
            '- Verified backup completion logs for all Tier-1 systems in scope period' || chr(10) ||
            '- Confirmed restore test was completed and met RPO targets' || chr(10) ||
            '- Inspected data integrity check outputs for primary databases' || chr(10) ||
            '- Reviewed backup encryption and offsite replication configuration' || chr(10) || chr(10) ||
            '## Conclusion' || chr(10) ||
            'Data integrity and backup controls effective. All Tier-1 backups completed successfully. Restore test RTO 41 minutes vs 60-minute target. Offsite replication lag within 15-minute policy threshold.'
          WHEN 3 THEN
            '## Focus area: Vulnerability Management and Patching' || chr(10) || chr(10) ||
            '## Procedures performed' || chr(10) ||
            '- Reviewed vulnerability scan report for in-scope systems' || chr(10) ||
            '- Sampled 20 critical and high CVEs against patch SLA compliance' || chr(10) ||
            '- Confirmed penetration test was completed within the required annual cycle' || chr(10) ||
            '- Inspected remediation tracking for findings from last pentest' || chr(10) || chr(10) ||
            '## Conclusion' || chr(10) ||
            'Vulnerability management effective. 97.4% patch SLA compliance for critical CVEs. 3 findings from last pentest remediated; 1 high-severity finding open with approved exception.'
          WHEN 4 THEN
            '## Focus area: Vendor and Third-Party Controls' || chr(10) || chr(10) ||
            '## Procedures performed' || chr(10) ||
            '- Reviewed third-party vendor register and tiering classification' || chr(10) ||
            '- Sampled 10 Tier-1 vendor files for due diligence evidence currency' || chr(10) ||
            '- Confirmed security questionnaire completion for critical vendors' || chr(10) ||
            '- Inspected contractual data protection terms for in-scope vendors' || chr(10) || chr(10) ||
            '## Conclusion' || chr(10) ||
            'Third-party controls effective. SOC 2 reports obtained for all critical vendors. One vendor questionnaire overdue by 12 days — vendor manager follow-up in progress.'
          ELSE
            '## Focus area: Security Monitoring and Incident Response' || chr(10) || chr(10) ||
            '## Procedures performed' || chr(10) ||
            '- Reviewed security event monitoring configuration and alert thresholds' || chr(10) ||
            '- Sampled 10 security alerts from in-scope period for investigation quality' || chr(10) ||
            '- Verified incident response plan is current and tested' || chr(10) ||
            '- Inspected 3 closed incident tickets for completeness and root cause documentation' || chr(10) || chr(10) ||
            '## Conclusion' || chr(10) ||
            'Security monitoring and IR controls effective. All sampled alerts investigated and closed within SLA. IRP last tested 4 months ago; next tabletop exercise scheduled.'
        END
      WHEN r.framework_id IN ('gdpr', 'pdpa') THEN
        CASE r.wp_num
          WHEN 1 THEN
            '## Focus area: Data Subject Rights and DSAR Process' || chr(10) || chr(10) ||
            '## Procedures performed' || chr(10) ||
            '- Reviewed DSAR register and confirmed 30-day response SLA compliance' || chr(10) ||
            '- Sampled 15 completed DSARs for process adherence and completeness' || chr(10) ||
            '- Verified DPO oversight and sign-off on complex requests' || chr(10) ||
            '- Inspected consent records and withdrawal processing for marketing data' || chr(10) || chr(10) ||
            '## Conclusion' || chr(10) ||
            'Data subject rights process effective. 100% of sampled DSARs responded within 30-day SLA. Consent withdrawal processing confirmed within 72 hours. No material exceptions.'
          WHEN 2 THEN
            '## Focus area: Data Transfers and DPA Compliance' || chr(10) || chr(10) ||
            '## Procedures performed' || chr(10) ||
            '- Reviewed cross-border data transfer register against PDPA Part IX requirements' || chr(10) ||
            '- Confirmed valid legal transfer mechanism (DPA or BCR) for each listed transfer' || chr(10) ||
            '- Sampled 10 vendor DPAs for adequacy of data protection clauses' || chr(10) ||
            '- Inspected ROPA for completeness and currency' || chr(10) || chr(10) ||
            '## Conclusion' || chr(10) ||
            'Data transfer and DPA controls effective. All cross-border transfers have valid legal basis. 1 vendor DPA under renegotiation; interim compensating control approved by DPO.'
          ELSE
            '## Focus area: DPIA Process and High-Risk Processing' || chr(10) || chr(10) ||
            '## Procedures performed' || chr(10) ||
            '- Reviewed DPIA register for completeness against in-scope processing activities' || chr(10) ||
            '- Sampled 5 DPIAs for quality of risk assessment and mitigations' || chr(10) ||
            '- Confirmed DPO consultation and sign-off for high-risk processing' || chr(10) ||
            '- Verified data minimisation compliance for sampled data categories' || chr(10) || chr(10) ||
            '## Conclusion' || chr(10) ||
            'DPIA process effective. All high-risk processing activities have current DPIAs. One DPIA refresh overdue for updated AI feature — DPO notified; review scheduled within 14 days.'
        END
      ELSE
        CASE r.wp_num
          WHEN 1 THEN
            '## Focus area: Governance and Policy Framework' || chr(10) || chr(10) ||
            '## Procedures performed' || chr(10) ||
            '- Reviewed policy register for currency and completeness of in-scope policies' || chr(10) ||
            '- Confirmed board and senior management sign-off within required review cycle' || chr(10) ||
            '- Sampled staff awareness records for mandatory policy acknowledgement' || chr(10) ||
            '- Inspected exception register for open policy exceptions' || chr(10) || chr(10) ||
            '## Conclusion' || chr(10) ||
            'Governance and policy framework effective. All in-scope policies current and approved. 94% staff acknowledgement rate; remaining 6% completing within 30-day window.'
          WHEN 2 THEN
            '## Focus area: Risk Management and Control Testing' || chr(10) || chr(10) ||
            '## Procedures performed' || chr(10) ||
            '- Reviewed risk register for completeness and recency of risk assessments' || chr(10) ||
            '- Confirmed quarterly risk committee meeting and risk appetite review completed' || chr(10) ||
            '- Sampled 20 control test results for evidence of effective operation' || chr(10) ||
            '- Inspected treatment plan progress for high-rated risks' || chr(10) || chr(10) ||
            '## Conclusion' || chr(10) ||
            'Risk management controls effective. Risk register complete and current. 2 high-rated risks with treatment plans on track. Quarterly risk committee minutes confirm board oversight.'
          ELSE
            '## Focus area: Evidence Collection and Audit Support' || chr(10) || chr(10) ||
            '## Procedures performed' || chr(10) ||
            '- Reviewed evidence inventory for completeness and coverage of in-scope controls' || chr(10) ||
            '- Confirmed evidence collection schedule was followed during assessment period' || chr(10) ||
            '- Sampled 25 evidence items for integrity, currency, and relevance' || chr(10) ||
            '- Verified chain of custody and evidence seal validation in platform' || chr(10) || chr(10) ||
            '## Conclusion' || chr(10) ||
            'Evidence collection effective. 97% of in-scope controls have current evidence. 3 evidence items require refresh within 14 days; owners notified. No integrity exceptions detected.'
        END
    END
  FROM ranked r
  WHERE r.id = wp.id
)
WHERE content_md LIKE '%Sampled 25 evidence items%';
