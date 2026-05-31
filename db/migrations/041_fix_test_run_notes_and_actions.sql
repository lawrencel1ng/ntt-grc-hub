-- Migration 041: Replace auto-seeded placeholder text in control test run notes
-- and issue action descriptions with realistic, varied content.
-- Idempotent: WHERE clauses match original placeholder values only.

-- =============================================================================
-- Part 1: control.test_runs — 9900 "Auto-seeded test run." notes
-- Updated to realistic notes based on control type × result
-- =============================================================================

UPDATE control.test_runs tr
SET notes = CASE c.type
  WHEN 'technical' THEN CASE tr.result
    WHEN 'pass' THEN (ARRAY[
      'Automated scan confirmed control is operating effectively. All technical assertions satisfied.',
      'Tool-based verification complete. Control configuration matches approved baseline.',
      'Continuous monitoring data reviewed; no deviations detected since last test cycle.',
      'Agent-executed control test passed. Evidence logged and linked to this run.',
      'API-level assertion confirmed. Service returned expected compliance posture.',
      'Configuration snapshot compared to CIS benchmark — no critical deviations.'
    ])[abs(hashtext(tr.id::text)) % 6 + 1]
    WHEN 'fail' THEN (ARRAY[
      'Technical control failed automated assertion. Configuration drift detected from approved baseline.',
      'Control test failed: required system setting absent or overridden. Ticket raised for remediation.',
      'Agent-executed test returned non-compliant status. Evidence of control failure captured.',
      'Automated scan detected gap in technical enforcement. Escalated to control owner.',
      'API assertion failed — service configuration does not meet control requirement.',
      'Patch SLA breach detected: critical CVE unpatched beyond policy threshold.'
    ])[abs(hashtext(tr.id::text)) % 6 + 1]
    WHEN 'partial' THEN (ARRAY[
      'Technical control partially effective. Core function operating but coverage incomplete.',
      'Control operating on primary systems; legacy environment excluded. Scope gap noted.',
      'Automated assertion: 87% of assets compliant. Outliers flagged for remediation.',
      'Partial pass: control logic correct but missing enforcement on two subsystems.',
      'Core control assertion passed; supplementary monitoring alert not yet configured.',
      'Coverage gap identified on non-standard port range. Partial remediation in progress.'
    ])[abs(hashtext(tr.id::text)) % 6 + 1]
    WHEN 'na' THEN (ARRAY[
      'Control not applicable to current technology stack for this tenant.',
      'NA — control designed for on-premises infrastructure; workload is cloud-native.',
      'Control excluded from scope: system decommissioned before test window.',
      'Not applicable — control applies to production tier only; test run on staging.',
      'Control scoped to regulated data environment; this system holds no in-scope data.',
      'NA — control superseded by alternative compensating control in current architecture.'
    ])[abs(hashtext(tr.id::text)) % 6 + 1]
    ELSE 'Technical control test completed.'
  END
  WHEN 'process' THEN CASE tr.result
    WHEN 'pass' THEN (ARRAY[
      'Process walkthrough confirmed: control procedure followed as documented. Evidence complete.',
      'Sample of process executions reviewed — all within defined tolerance. Control effective.',
      'Interview with control owner confirmed process is operating as designed.',
      'Process control test passed: documented steps followed, approvals obtained, evidence retained.',
      'Quarterly process review completed. No exceptions to control procedure observed.',
      'Control Tester agent verified process output against expected artefact set. Pass.'
    ])[abs(hashtext(tr.id::text)) % 6 + 1]
    WHEN 'fail' THEN (ARRAY[
      'Process control failed: required approval step not completed for sampled transactions.',
      'Evidence of control execution not retained as required by procedure. Finding raised.',
      'Process not followed for 3 of 15 sampled cases. Control ineffective in this period.',
      'Control owner unable to provide evidence of process execution. Remediation required.',
      'Process control failure: segregation of duties violated in sampled transactions.',
      'Documented procedure not followed; compensating control not in place. Escalated.'
    ])[abs(hashtext(tr.id::text)) % 6 + 1]
    WHEN 'partial' THEN (ARRAY[
      'Process control partially effective. Procedure followed inconsistently across teams.',
      'Partial pass: control operating for standard cases; exception handling process missing.',
      '11 of 15 sampled items compliant. 4 exceptions noted; root cause under investigation.',
      'Core process steps executed; evidence retention incomplete for 2 sampled instances.',
      'Process control effective for regulated transactions; informal approvals in edge cases.',
      'Partial effectiveness confirmed. Training gap identified as root cause of inconsistency.'
    ])[abs(hashtext(tr.id::text)) % 6 + 1]
    WHEN 'na' THEN (ARRAY[
      'Process control not applicable — function outsourced to third party under SLA.',
      'NA — process control applies to specific product line not operated by this tenant.',
      'Control excluded from scope: process retired and replaced by automated equivalent.',
      'Not applicable for current assessment period — process under redesign.',
      'NA — control applies to APAC operations; tenant is EMEA-only for this control domain.',
      'Process control not triggered in test period — no in-scope transactions processed.'
    ])[abs(hashtext(tr.id::text)) % 6 + 1]
    ELSE 'Process control test completed.'
  END
  WHEN 'admin' THEN CASE tr.result
    WHEN 'pass' THEN (ARRAY[
      'Administrative control confirmed effective. Policy acknowledged and documented approvals in place.',
      'Management review completed. Governance documentation current and appropriately signed off.',
      'Policy compliance verified through document review and owner attestation.',
      'Administrative control test passed: roles assigned, responsibilities documented, reviews completed.',
      'Board/senior management sign-off confirmed for in-scope governance artefact.',
      'Attestation review complete. All required sign-offs obtained within SLA.'
    ])[abs(hashtext(tr.id::text)) % 6 + 1]
    WHEN 'fail' THEN (ARRAY[
      'Administrative control failed: policy not reviewed within required 12-month cycle.',
      'Required management sign-off not obtained for in-scope governance artefact. Finding raised.',
      'Policy gap identified: documented procedure does not cover in-scope scenario.',
      'Administrative review overdue by 45 days. Control owner notified. Remediation required.',
      'Governance artefact missing required approver sign-off. Escalated to Compliance team.',
      'Policy version not communicated to staff within required timeframe. Finding logged.'
    ])[abs(hashtext(tr.id::text)) % 6 + 1]
    WHEN 'partial' THEN (ARRAY[
      'Administrative control partially effective. Policy current but staff acknowledgement incomplete.',
      'Partial pass: governance document approved but distribution not confirmed for all stakeholders.',
      'Management review completed; action items from last cycle not fully closed. Partial pass.',
      'Policy signed off at divisional level; group-level ratification outstanding.',
      'Partial effectiveness: control operates at department level; enterprise rollout pending.',
      'Attestation 87% complete. Outstanding sign-offs escalated to business unit heads.'
    ])[abs(hashtext(tr.id::text)) % 6 + 1]
    WHEN 'na' THEN (ARRAY[
      'Administrative control not applicable — governance structure handled at group level.',
      'NA — control applies to listed entities; this subsidiary is unlisted.',
      'Control excluded from scope: administrative function centralised at HoldCo.',
      'Not applicable for this tenant classification — control applies to Tier-1 FIs only.',
      'NA — administrative control replaced by automated workflow; manual step removed.',
      'Control not applicable for current assessment period — entity below threshold.'
    ])[abs(hashtext(tr.id::text)) % 6 + 1]
    ELSE 'Administrative control test completed.'
  END
  ELSE 'Control test completed.'
END
FROM control.library c
WHERE tr.control_id = c.id
  AND tr.notes = 'Auto-seeded test run.';

-- =============================================================================
-- Part 2: issue.actions — 319 rows with only 3 distinct descriptions
-- Vary by status using hash-based array selection (8 options per status)
-- =============================================================================

UPDATE issue.actions
SET description = CASE status
  WHEN 'in-progress' THEN (ARRAY[
    'Collecting and uploading evidence artefacts to the GRC platform',
    'Implementing remediation steps per approved treatment plan',
    'Running automated control test to verify fix effectiveness',
    'Coordinating with control owner to execute compensating control',
    'Conducting root-cause analysis and documenting interim fix',
    'Scheduling control walkthrough with Internal Audit to validate remediation',
    'Deploying configuration change and monitoring for regression',
    'Engaging vendor to obtain outstanding SOC 2 report and security questionnaire'
  ])[abs(hashtext(id::text)) % 8 + 1]
  WHEN 'done' THEN (ARRAY[
    'Remediation implemented and verified by Control Tester agent. Evidence retained.',
    'Compensating control deployed. Evidence uploaded and linked to this issue.',
    'Root cause resolved. Control re-tested and confirmed passing. Issue ready for closure review.',
    'Fix applied and peer-reviewed. Evidence pack submitted to External Auditor.',
    'Control gap closed. Updated policy communicated to all stakeholders.',
    'Remediation completed within SLA. Post-fix monitoring confirms no recurrence.',
    'Vendor deliverable received and reviewed. Gap formally closed in register.',
    'Technical fix deployed to production. Automated test passing with no exceptions.'
  ])[abs(hashtext(id::text)) % 8 + 1]
  WHEN 'not-started' THEN (ARRAY[
    'Assign remediation owner and agree timeline with Risk & Compliance',
    'Schedule control gap review with CISO and process owner',
    'Request evidence from vendor for outstanding security questionnaire',
    'Plan technical remediation sprint — identify engineer and test criteria',
    'Raise change request for required configuration update',
    'Book tabletop exercise to validate proposed compensating control',
    'Draft remediation plan for review by Control Owner',
    'Initiate procurement process for tooling required to close this gap'
  ])[abs(hashtext(id::text)) % 8 + 1]
  ELSE description
END
WHERE description IN (
  'Capture evidence in vault',
  'Update remediation plan',
  'Review at next risk meeting'
);
