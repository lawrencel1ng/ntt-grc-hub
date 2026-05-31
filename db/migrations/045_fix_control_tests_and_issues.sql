-- Migration 045: Fix identical procedure_md in control.tests and
-- identical description in issue.issues.
-- Idempotent: WHERE clauses match original placeholder text.

-- =============================================================================
-- Part 1: control.tests — procedure_md varied by kind × control type
-- Uses array selection for variety within each kind+type bucket.
-- =============================================================================

UPDATE control.tests ct
SET procedure_md = CASE ct.kind
  WHEN 'automated' THEN CASE c.type
    WHEN 'technical' THEN (ARRAY[
      $p$## Procedure

1. Connect to target system via compliance agent API or native integration.
2. Query control configuration endpoint and retrieve current state.
3. Evaluate response against approved policy assertion (baseline config, version, or flag).
4. Record PASS/FAIL/PARTIAL result with JSON evidence artifact.
5. Trigger automated alert to control owner if result is FAIL or PARTIAL.$p$,
      $p$## Procedure

1. Invoke automated scanner against target host or service inventory.
2. Pull configuration telemetry via agent or cloud provider API.
3. Compare retrieved state against CIS benchmark or approved hardening standard.
4. Log deviation count and severity; record test result.
5. Auto-assign remediation ticket to control owner on FAIL.$p$,
      $p$## Procedure

1. Query SIEM or monitoring platform for control activity log.
2. Assess whether required events have been generated within test window.
3. Validate log completeness against expected baseline volume.
4. Record PASS/FAIL with evidence reference to log query output.
5. Page on-call SOC if evidence of control gap or log absence.$p$
    ])[abs(hashtext(ct.id::text)) % 3 + 1]
    WHEN 'process' THEN (ARRAY[
      $p$## Procedure

1. Query workflow engine or approval system for control executions in scope period.
2. Sample recent process runs against control requirement (approval obtained, steps completed).
3. Evaluate sample for completeness, timeliness, and evidence retention.
4. Record PASS/FAIL/PARTIAL with sample reference.
5. Escalate to process owner if FAIL; note root cause if known.$p$,
      $p$## Procedure

1. Pull process execution log from GRC platform or ITSM ticket system.
2. Confirm that required dual-authorisation or review step is recorded.
3. Check evidence artefact is attached and within retention period.
4. Calculate exception rate for sampled set; record result.
5. Notify compliance team if exception rate exceeds 5% threshold.$p$
    ])[abs(hashtext(ct.id::text)) % 2 + 1]
    WHEN 'admin' THEN (ARRAY[
      $p$## Procedure

1. Query policy register for current version, review date, and approver list.
2. Verify document was reviewed and approved within required 12-month cycle.
3. Confirm attestation records or distribution evidence exists.
4. Record PASS/FAIL with policy document reference.
5. Notify compliance owner if review is overdue or sign-off absent.$p$,
      $p$## Procedure

1. Retrieve governance artefact from document management system.
2. Confirm effective date, version, and board/executive sign-off.
3. Check staff acknowledgement or training completion record where required.
4. Record PASS/FAIL/PARTIAL with document ID.
5. Flag to Risk & Compliance if policy is past review date.$p$
    ])[abs(hashtext(ct.id::text)) % 2 + 1]
    ELSE procedure_md
  END
  WHEN 'manual' THEN CASE c.type
    WHEN 'technical' THEN (ARRAY[
      $p$## Procedure

1. Log into target system or console with appropriate privileged credentials.
2. Navigate to control configuration section and document current state.
3. Sample 10–15 system instances, log entries, or configuration items.
4. Compare findings against approved baseline or control requirement.
5. Record test steps, exceptions found, and overall conclusion in workpaper.$p$,
      $p$## Procedure

1. Request access to target environment configuration from system owner.
2. Review technical control settings against CIS benchmark or policy standard.
3. Interview control owner to confirm understanding and operating cadence.
4. Inspect evidence artefacts (screenshots, reports, or export files).
5. Document findings and assign PASS/FAIL/PARTIAL with supporting evidence reference.$p$,
      $p$## Procedure

1. Obtain list of in-scope systems from asset register.
2. Sample 10 systems and verify control configuration via remote session or API.
3. Compare to approved baseline; note deviations with severity assessment.
4. Request control owner attestation for any exceptions.
5. Conclude test with documented findings and remediation timeline for failures.$p$
    ])[abs(hashtext(ct.id::text)) % 3 + 1]
    WHEN 'process' THEN (ARRAY[
      $p$## Procedure

1. Request process execution records for the last 30 days from the control owner.
2. Sample 15–20 transactions or workflow events for completeness review.
3. Verify required approvals, dual-authorisation, and evidence retention for each sample.
4. Document exceptions, assess materiality, and determine root cause.
5. Issue test conclusion with supporting workpaper reference.$p$,
      $p$## Procedure

1. Pull sample of process completions from ITSM or GRC workflow log.
2. Verify each sample item has required sign-offs and evidence attached.
3. Interview process owner to understand any informal exceptions or workarounds.
4. Assess consistency of control operation across sample set.
5. Record PASS/FAIL/PARTIAL; recommend remediation for exceptions above tolerance.$p$
    ])[abs(hashtext(ct.id::text)) % 2 + 1]
    WHEN 'admin' THEN (ARRAY[
      $p$## Procedure

1. Obtain current governance document from the policy register or document management system.
2. Confirm review date, version number, and approving authorities.
3. Verify staff acknowledgement records and training completion statistics.
4. Cross-check against applicable regulatory requirement or internal policy standard.
5. Record conclusion, exceptions found, and recommended follow-up actions.$p$,
      $p$## Procedure

1. Request policy artefact and approval evidence from Compliance team.
2. Confirm document is current version with valid board or executive sign-off.
3. Assess whether communication to relevant stakeholders has been documented.
4. Check that exception register references this policy where applicable.
5. Issue test conclusion with policy document ID and approval date reference.$p$
    ])[abs(hashtext(ct.id::text)) % 2 + 1]
    ELSE procedure_md
  END
  ELSE procedure_md
END
FROM control.library c
WHERE ct.control_id = c.id
  AND ct.procedure_md = $old$## Procedure
1. Query data source
2. Apply rule
3. Record result$old$;

-- =============================================================================
-- Part 2: issue.issues — title-specific descriptions
-- =============================================================================

UPDATE issue.issues
SET description = CASE title
  WHEN 'Logging gap on internal CRM'
    THEN 'Audit logging is not enabled for the internal CRM system, creating a visibility gap for privileged user actions and potential data access events. This prevents forensic investigation and fails MAS TRM logging requirements.'
  WHEN 'Backup restore not tested in 9 months'
    THEN 'Backup restore tests for core banking data stores have not been conducted in over 9 months, exceeding the quarterly test schedule. Untested backups create unquantified RPO/RTO risk in the event of a ransomware or data corruption incident.'
  WHEN 'Vendor SOC 2 missing for Tier-1 vendor'
    THEN 'A current SOC 2 Type II report has not been obtained from a Tier-1 cloud vendor. This prevents independent assurance over the vendor''s security and availability controls as required under MAS Notice 655 TPRM obligations.'
  WHEN 'KMS rotation overdue'
    THEN 'Encryption key rotation for the KMS key protecting regulated data stores is overdue by 45 days beyond the 12-month policy threshold. Overdue key rotation increases exposure if keys are compromised and violates cryptographic key management policy.'
  WHEN 'Branch protection disabled on critical repo'
    THEN 'Branch protection rules have been disabled on the main branch of a critical application repository, allowing direct pushes without peer review. This bypasses the change management control and creates a code integrity risk.'
  WHEN 'AI DPIA missing for new feature'
    THEN 'A Data Protection Impact Assessment has not been conducted for a new AI-powered feature processing customer personal data. The DPIA is required under PDPA before deployment of any new high-risk data processing activity.'
  WHEN 'Incident postmortem action overdue'
    THEN 'A corrective action item from the previous quarter''s security incident postmortem is 30 days overdue. Overdue postmortem actions increase residual risk and indicate potential weakness in incident response follow-through.'
  WHEN 'Vendor exit plan not documented'
    THEN 'A formal exit plan has not been documented for a Tier-1 vendor, in violation of MAS Notice 655 material outsourcing requirements. Without an exit plan, the organisation cannot demonstrate orderly exit capability to the regulator.'
  WHEN 'Regulator change impact not assessed'
    THEN 'A new regulatory update has not been assessed for impact on controls and compliance posture within the required 30-day assessment window. Unassessed regulatory changes create unquantified compliance gap exposure.'
  WHEN 'Privileged access review overdue'
    THEN 'The quarterly privileged access review has not been completed within the required cycle. Unreviewed privileged access increases the risk of excessive permissions, dormant accounts, and insider threat exposure.'
  ELSE 'Issue identified through control testing or audit observation. Owner accountable for remediation; tracked to closure per risk appetite.'
END
WHERE description = 'Issue auto-seeded for demo. Owner accountable; tracked to closure.';
