-- Migration 040: Fix repetitive placeholder text in three tables.
--   1. incident.postmortems  — all 6 rows shared an S3-bucket root cause
--   2. risk.treatments       — all 367 rows had the same generic description
--   3. bcm.tests             — all 64 rows had the same lessons_md
-- Idempotent: each UPDATE is guarded by a WHERE on the original placeholder.

-- =============================================================================
-- Part 1: incident.postmortems — incident-appropriate root causes
-- =============================================================================

UPDATE incident.postmortems p
SET
  root_cause_md = CASE
    WHEN i.title ILIKE '%database%' OR i.title ILIKE '%failover%'
      THEN $pm1$## Root cause

Automated failover triggered by a sustained I/O spike on the primary database host.
Root cause: a batch analytics job was inadvertently scheduled against the production
replica, consuming I/O bandwidth beyond the failover threshold. The replica fell behind
replication lag SLA, triggering the HA controller to promote the standby.$pm1$
    WHEN i.title ILIKE '%login%' OR i.title ILIKE '%suspicious%' OR i.title ILIKE '%geo%'
      THEN $pm2$## Root cause

Credential stuffing attack originated from a botnet spanning 14 countries. Attackers
leveraged a leaked credential list from a third-party breach. MFA was not enforced on
legacy API authentication endpoints, allowing password-only login from unrecognised
geographies. SIEM alert threshold was set too high, delaying detection by 47 minutes.$pm2$
    WHEN i.title ILIKE '%AI%' OR i.title ILIKE '%hallucination%' OR i.title ILIKE '%LLM%'
      THEN $pm3$## Root cause

LLM-generated regulatory summary contained fabricated MAS circular reference numbers.
Root cause: model was prompted without grounding against verified regulatory sources,
and no human review gate was in place for AI-drafted content before distribution to
board recipients. Model temperature setting too high for deterministic compliance use.$pm3$
    WHEN i.title ILIKE '%phish%' OR i.title ILIKE '%ransomware%'
      THEN $pm4$## Root cause

Spear-phishing email bypassed email gateway due to domain-lookalike sender address
(one-character transposition). Targeted user clicked macro-enabled attachment; macro
executed PowerShell download cradle. EDR agent on endpoint was running with policy
exceptions applied during a patching window and did not block the initial payload.$pm4$
    WHEN i.title ILIKE '%data%' OR i.title ILIKE '%breach%' OR i.title ILIKE '%exfil%'
      THEN $pm5$## Root cause

Misconfigured IAM policy granted a decommissioned service account read access to the
customer PII S3 bucket. Account was not revoked during offboarding of the associated
microservice. Access was exercised by an external actor who obtained the credential
from an exposed CI/CD environment variable in a public repository fork.$pm5$
    ELSE $pm6$## Root cause

Service disruption caused by a cascading configuration change deployed without
complete CAB review. Change impacted a shared network policy enforced across multiple
dependent services. Rollback was delayed because the change was not flagged as
high-risk in the change management system, and the rollback runbook was out of date.$pm6$
  END,
  corrective_actions_md = CASE
    WHEN i.title ILIKE '%database%' OR i.title ILIKE '%failover%'
      THEN $ca1$## Corrective actions

1. Move batch analytics workloads to a dedicated read replica isolated from HA topology.
2. Reduce HA failover threshold and add lag-based pre-alert before trigger fires.
3. Update change management policy to require DBA sign-off on any production replica queries.
4. Schedule quarterly DR failover test to validate recovery time against SLA.$ca1$
    WHEN i.title ILIKE '%login%' OR i.title ILIKE '%suspicious%' OR i.title ILIKE '%geo%'
      THEN $ca2$## Corrective actions

1. Enforce MFA on all authentication endpoints, including legacy API paths, within 14 days.
2. Implement geo-velocity checks and automatic session termination for anomalous logins.
3. Lower SIEM alert threshold for failed authentication from unrecognised geographies.
4. Force password resets for all accounts in the affected credential batch.$ca2$
    WHEN i.title ILIKE '%AI%' OR i.title ILIKE '%hallucination%' OR i.title ILIKE '%LLM%'
      THEN $ca3$## Corrective actions

1. Implement mandatory human review gate for all AI-generated regulatory content.
2. Ground regulatory summaries against a verified MAS/MAS circular source index.
3. Reduce model temperature for compliance-use prompts and add citation requirement.
4. Register AI use case in AI Governance module and complete model risk assessment.$ca3$
    ELSE $ca4$## Corrective actions

1. Conduct post-incident IAM audit — revoke all decommissioned service account credentials.
2. Implement automated account deprovisioning pipeline linked to service offboarding workflow.
3. Scan all CI/CD pipelines for exposed secrets and rotate any credentials found.
4. Add S3 bucket access logging and alert on access from non-approved service identities.$ca4$
  END
FROM incident.incidents i
WHERE p.incident_id = i.id
  AND p.root_cause_md LIKE '%Misconfigured S3 bucket policy%';

-- =============================================================================
-- Part 2: risk.treatments — strategy × category specific descriptions
-- =============================================================================

UPDATE risk.treatments t
SET description = CASE t.strategy
  WHEN 'mitigate' THEN CASE r.category
    WHEN 'cyber'
      THEN 'Deploy technical controls: enforce MFA, achieve patch SLA (critical ≤14 days, high ≤30 days), and enable continuous vulnerability scanning. Assign CISO team as remediation owner with monthly progress reviews. Target: residual likelihood reduced to low within 90 days.'
    WHEN 'operational'
      THEN 'Strengthen operational controls: update procedures, implement dual-authorisation for high-risk transactions, and schedule quarterly process reviews. Assign COO office. Target: operational resilience score improved within 60 days.'
    WHEN 'regulatory'
      THEN 'Implement compliance controls: conduct gap assessment against regulatory requirements, assign compliance owner, and build evidence schedule. Engage Legal & Compliance for regulatory liaison. Target: full compliance posture within 90 days.'
    WHEN 'third-party'
      THEN 'Strengthen vendor controls: complete enhanced due diligence, obtain updated SOC 2 reports, and insert contractual remediation clauses. Quarterly vendor review cadence. Target: concentration risk reduced within 60 days.'
    WHEN 'technology'
      THEN 'Implement technical hardening: deploy CIS configuration baseline, enable automated drift detection, and schedule architecture review. Assign Technology Risk owner. Target: hardening complete within 45 days.'
    WHEN 'financial'
      THEN 'Deploy financial risk controls: enforce transactional limits, increase reconciliation frequency, and strengthen monitoring thresholds. Assign Finance Risk owner. Target: exposure reduced within 30 days.'
    WHEN 'privacy'
      THEN 'Implement privacy controls: conduct DPIA, enforce data minimisation and retention schedules, and update ROPA. Assign DPO as remediation owner. Target: PDPA alignment confirmed within 60 days.'
    WHEN 'people'
      THEN 'Deploy people risk controls: implement enhanced background screening, launch targeted security awareness training, and restrict access for high-risk roles. Assign HR and Security as co-owners. Target: risk posture improved within 45 days.'
    WHEN 'climate'
      THEN 'Deploy climate risk controls: assess physical asset exposure, diversify data centre footprint, and update BCM plans to include climate scenarios. Assign BCM/Resilience owner. Target: BCM coverage enhanced within 90 days.'
    WHEN 'ai'
      THEN 'Implement AI risk controls: conduct model validation, enforce human-in-the-loop review for high-impact outputs, and register model in AI Governance module. Assign Model Risk Officer. Target: model risk posture compliant within 60 days.'
    ELSE 'Mitigate residual risk: implement compensating control, assign remediation owner, and track to closure within 60 days of approval.'
  END
  WHEN 'transfer' THEN CASE r.category
    WHEN 'cyber'
      THEN 'Transfer residual cyber risk via cyber liability insurance policy. Engage broker to validate coverage adequacy against FAIR-modelled loss exposure. Review coverage at next annual insurance renewal.'
    WHEN 'operational'
      THEN 'Transfer operational risk via contractual indemnities and service provider SLAs including liquidated damages for breach. Review contractual protections at next vendor renewal cycle.'
    WHEN 'regulatory'
      THEN 'Transfer compliance obligations to outsourced compliance service provider under formal SLA with retained oversight. Review arrangement at next annual audit and regulatory change cycle.'
    WHEN 'third-party'
      THEN 'Transfer third-party concentration risk via contractual exit rights, multi-vendor strategy, and insurance indemnity clauses. Document and test exit plan annually.'
    WHEN 'technology'
      THEN 'Transfer technology risk via cloud provider SLAs and technology insurance. Validate SLA coverage against RTO/RPO requirements at next contract renewal.'
    WHEN 'financial'
      THEN 'Transfer financial risk via fidelity bond or trade credit insurance. Engage treasury to validate coverage limits against modelled maximum loss exposure.'
    WHEN 'privacy'
      THEN 'Transfer privacy risk via data processing agreements with vendor indemnities and breach notification obligations. Ensure DPA includes liability caps. Review annually.'
    WHEN 'people'
      THEN 'Transfer people risk via fidelity insurance and professional liability cover. HR to include restrictive covenants in employment contracts for high-risk roles.'
    WHEN 'climate'
      THEN 'Transfer climate risk via property and infrastructure insurance. Engage risk broker to validate coverage against MAS climate risk guidance at annual insurance renewal.'
    WHEN 'ai'
      THEN 'Transfer AI model risk via vendor SLAs for third-party AI services and model output disclaimers. Ensure vendor contracts include liability for AI-generated errors. Review at contract renewal.'
    ELSE 'Transfer residual risk via insurance or contractual indemnity. Engage relevant broker or legal counsel. Review coverage at next annual renewal.'
  END
  WHEN 'accept' THEN CASE r.category
    WHEN 'cyber'
      THEN 'Formally accept residual cyber risk. CISO sign-off obtained; compensating controls in place and residual exposure within approved risk appetite. Formal acceptance documented. Re-assess at next annual risk review.'
    WHEN 'operational'
      THEN 'Formally accept residual operational risk. COO sign-off obtained; cost of additional controls exceeds residual impact within tolerance. Compensating controls documented. Re-assess at next quarterly risk review.'
    WHEN 'regulatory'
      THEN 'Formally accept regulatory risk with documented legal opinion. CRO and General Counsel sign-off obtained; risk within tolerance given regulatory ambiguity. Re-assess at next regulatory update.'
    WHEN 'third-party'
      THEN 'Formally accept third-party concentration risk. CRO sign-off obtained; alternative supplier options limited. Compensating control: enhanced exit planning maintained. Re-assess annually.'
    WHEN 'technology'
      THEN 'Formally accept technology risk. CTO sign-off obtained; legacy platform constraints prevent full remediation before planned migration. Re-assess at migration completion.'
    WHEN 'financial'
      THEN 'Formally accept financial risk within board-approved risk appetite. Finance Risk Committee sign-off obtained. Compensating control: enhanced daily reconciliation in place. Re-assess quarterly.'
    WHEN 'privacy'
      THEN 'Formally accept privacy risk with DPO sign-off. DPIA completed; residual risk acceptable within PDPA regulatory tolerance. Re-assess at next DPIA review cycle.'
    WHEN 'people'
      THEN 'Formally accept people risk. CHRO sign-off obtained; enhanced background screening serves as compensating control. Residual risk within appetite. Re-assess at annual HR risk review.'
    WHEN 'climate'
      THEN 'Formally accept climate risk. CRO sign-off obtained; asset exposure within insurance coverage and BCM plans updated. Re-assess at next climate risk scenario exercise.'
    WHEN 'ai'
      THEN 'Formally accept AI model risk with Model Risk Officer sign-off. Human review gates in place for high-impact outputs. Risk within AI governance tolerance. Re-assess at next model validation cycle.'
    ELSE 'Formally accept residual risk. Risk owner sign-off obtained; risk within board-approved appetite. Compensating controls documented. Re-assess at next risk review cycle.'
  END
  WHEN 'avoid' THEN CASE r.category
    WHEN 'cyber'
      THEN 'Avoid cyber risk by decommissioning the at-risk system or disabling the vulnerable feature. CAB approval obtained. Replacement controls or system migration to be completed within 60 days.'
    WHEN 'operational'
      THEN 'Avoid operational risk by discontinuing the at-risk process or outsourcing to a qualified third party with appropriate SLAs. Process owner to execute transition plan within 90 days.'
    WHEN 'regulatory'
      THEN 'Avoid regulatory risk by exiting the non-compliant activity or jurisdiction. Legal & Compliance to document regulatory rationale. Target: activity cessation within 60 days.'
    WHEN 'third-party'
      THEN 'Avoid third-party concentration risk by exiting the vendor relationship and redistributing workloads to alternative suppliers. Vendor manager to execute transition within contractual notice period.'
    WHEN 'technology'
      THEN 'Avoid technology risk by decommissioning the legacy component and migrating to a compliant architecture. Technology team to execute approved migration plan and timeline.'
    WHEN 'financial'
      THEN 'Avoid financial risk by ceasing the at-risk product or transaction type. Finance and Legal to communicate changes to clients within regulatory timelines.'
    WHEN 'privacy'
      THEN 'Avoid privacy risk by discontinuing the at-risk data processing activity. DPO to update ROPA and notify affected data subjects if required. Effective immediately upon approval.'
    WHEN 'people'
      THEN 'Avoid people risk by removing the at-risk role from scope or restricting access for identified high-risk individuals. HR and Security to execute access revocation within 24 hours of approval.'
    WHEN 'climate'
      THEN 'Avoid climate risk by relocating or decommissioning assets in high-exposure climate zones. BCM team to update recovery plans to reflect revised asset footprint within 45 days.'
    WHEN 'ai'
      THEN 'Avoid AI model risk by withdrawing the at-risk model from production. Model Risk Officer to archive documentation and notify impacted business units upon MRRO approval.'
    ELSE 'Avoid residual risk by discontinuing the at-risk activity. Risk owner to execute cessation plan and confirm closure to Risk & Compliance within 30 days.'
  END
  ELSE t.description
END
FROM risk.risks r
WHERE t.risk_id = r.id
  AND t.description = 'Treatment plan: implement compensating control and reduce residual likelihood. Owner accountable; monthly cadence.';

-- =============================================================================
-- Part 3: bcm.tests — kind × result specific lessons
-- =============================================================================

UPDATE bcm.tests
SET lessons_md = CASE
  WHEN kind = 'walkthrough' AND result = 'pass'
    THEN $bcm1$## Lessons learned

- All participants confirmed familiarity with recovery procedures and escalation contacts.
- No significant gaps in the runbook were identified during the walkthrough.
- Minor clarification added to database recovery sequence (step 7) — updated in BCP documentation.
- Next walkthrough scheduled in 6 months. BCP owner to distribute updated version within 5 business days.$bcm1$
  WHEN kind = 'simulation' AND result = 'partial'
    THEN $bcm2$## Lessons learned

- Recovery procedures executed successfully for Tier-1 systems; Tier-2 systems exceeded RTO targets by 35 minutes.
- Escalation contact list contained two outdated mobile numbers — directory updated post-exercise.
- Backup restoration from secondary site completed within RPO; primary site failover script timed out.
- Action items: (1) Fix primary-site failover script within 14 days. (2) Schedule targeted Tier-2 re-test within 90 days. (3) Quarterly contact list refresh to be added to BCP maintenance cycle.$bcm2$
  WHEN kind = 'full-failover' AND result = 'fail'
    THEN $bcm3$## Lessons learned

- Full failover test did not meet RTO/RPO targets. Replication lag exceeded RPO budget by 18 minutes during peak I/O; database cluster recovery script failed at step 4 due to stale volume snapshot reference.
- CTO and CISO notified; MAS incident reporting threshold not met.
- Critical action items: (1) Fix replication configuration and reduce snapshot interval within 7 days. (2) Update and regression-test database recovery script within 14 days. (3) Re-run full failover test within 30 days before scheduling next regulatory inspection.$bcm3$
  ELSE lessons_md
END
WHERE lessons_md = $old$## Lessons learned

- Update DR runbook
- Re-test in 90 days$old$;
