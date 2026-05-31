-- Migration 036: Replace repetitive agent run summaries with agent-appropriate text.
-- Uses modulo on run ID to add variety within each agent's realistic action set.

UPDATE agent.runs
SET
  input_summary = CASE agent_id
    WHEN 'ag_evidence' THEN (ARRAY[
      'Scan MAS TRM feed for new guidance',
      'Collect ISO 27001 control evidence',
      'Harvest PDPA compliance artefacts',
      'Pull penetration test report evidence',
      'Collect quarterly access review artefacts',
      'Gather cloud configuration audit evidence',
      'Harvest vendor SOC 2 attestations',
      'Collect change management evidence'
    ])[((id % 8) + 1)::int]
    WHEN 'ag_regwatch' THEN (ARRAY[
      'Scan MAS regulatory feed',
      'Monitor BNM policy updates',
      'Check PDPC advisory publications',
      'Scan HKMA circular repository',
      'Monitor OJK regulatory gazette',
      'Check RBI master directions feed',
      'Scan APRA prudential standards',
      'Monitor EU DORA technical standards'
    ])[((id % 8) + 1)::int]
    WHEN 'ag_tester' THEN (ARRAY[
      'Run automated access review test',
      'Execute change management control test',
      'Test privileged access monitoring control',
      'Run backup and recovery verification test',
      'Execute encryption-at-rest control check',
      'Test MFA enforcement on critical systems',
      'Run SOD conflict detection check',
      'Execute patch management compliance test'
    ])[((id % 8) + 1)::int]
    WHEN 'ag_mapper' THEN (ARRAY[
      'Map controls to MAS TRM framework',
      'Align controls to ISO 27001:2022',
      'Map controls to MAS Notice 655',
      'Align SOX ITGCs to PCAOB standards',
      'Map controls to PDPA obligations',
      'Align controls to NIST CSF 2.0',
      'Map controls to CIS Controls v8',
      'Align evidence to audit requirements'
    ])[((id % 8) + 1)::int]
    WHEN 'ag_fair' THEN (ARRAY[
      'Run FAIR quantification for cyber risk',
      'Quantify third-party concentration risk',
      'Model ransomware scenario loss exposure',
      'Run Monte Carlo for insider threat risk',
      'Quantify cloud outage financial impact',
      'Model data breach regulatory fine exposure',
      'Run FAIR analysis for supply chain risk',
      'Quantify privileged access misuse scenario'
    ])[((id % 8) + 1)::int]
    WHEN 'ag_board' THEN (ARRAY[
      'Generate board risk committee narrative',
      'Draft executive cyber risk summary',
      'Prepare audit committee GRC brief',
      'Generate quarterly risk dashboard narrative',
      'Draft MAS regulatory update summary',
      'Prepare board ESG risk overview',
      'Generate annual compliance status report',
      'Draft risk appetite statement update'
    ])[((id % 8) + 1)::int]
    WHEN 'ag_audit' THEN (ARRAY[
      'Prepare audit fieldwork documentation',
      'Generate control walkthrough pack',
      'Assemble evidence for external auditor',
      'Draft audit finding remediation tracker',
      'Prepare workpaper for MAS examination',
      'Generate PCAOB audit pack for SOX',
      'Assemble ISO 27001 certification evidence',
      'Draft audit committee status report'
    ])[((id % 8) + 1)::int]
    WHEN 'ag_policy' THEN (ARRAY[
      'Draft information security policy update',
      'Review and refresh outsourcing policy',
      'Update PDPA data retention policy',
      'Draft AI governance policy framework',
      'Review business continuity policy',
      'Update access control policy',
      'Draft incident response policy revision',
      'Review risk appetite policy statement'
    ])[((id % 8) + 1)::int]
    WHEN 'ag_incident' THEN (ARRAY[
      'Investigate privileged account anomaly',
      'Reconstruct phishing incident timeline',
      'Analyse cloud misconfiguration incident',
      'Investigate data exfiltration alert',
      'Reconstruct ransomware attack chain',
      'Analyse failed MFA bypass attempt',
      'Investigate insider threat indicator',
      'Reconstruct supply chain compromise alert'
    ])[((id % 8) + 1)::int]
    WHEN 'ag_vendor' THEN (ARRAY[
      'Assess Tier-1 cloud vendor risk posture',
      'Review SOC 2 Type II for critical vendor',
      'Analyse fourth-party concentration risk',
      'Score vendor cybersecurity questionnaire',
      'Assess vendor business continuity plan',
      'Review vendor PDPA data processing terms',
      'Analyse vendor penetration test results',
      'Score vendor incident response capability'
    ])[((id % 8) + 1)::int]
    ELSE input_summary
  END,
  output_summary = CASE agent_id
    WHEN 'ag_evidence' THEN (ARRAY[
      'Collected 7 artefacts, 2 gaps flagged',
      'Evidence complete — 12 items mapped to controls',
      'Collected 9 PDPA artefacts, coverage 94%',
      'Pentest report ingested, 3 findings linked',
      'Access review evidence complete, 1 exception noted',
      'Cloud config snapshot taken, 4 deviations detected',
      'SOC 2 report processed, 2 exceptions flagged',
      'Change log evidence complete, 8 controls satisfied'
    ])[((id % 8) + 1)::int]
    WHEN 'ag_regwatch' THEN (ARRAY[
      'Detected 3 new MAS guidance items',
      'BNM circular flagged as high severity',
      'PDPC advisory — 2 action items raised',
      'HKMA circular mapped to 6 controls',
      'OJK regulation — impact assessment queued',
      'RBI directive — 3 policy gaps identified',
      'APRA standard — gap assessment initiated',
      'DORA RTS — 11 requirements mapped'
    ])[((id % 8) + 1)::int]
    WHEN 'ag_tester' THEN (ARRAY[
      'Control pass — all 14 test steps verified',
      'Change management control — partial pass, 1 gap',
      'PAM control passed, 0 exceptions detected',
      'Backup test pass — RTO 47 min, within threshold',
      'Encryption control pass — all volumes verified',
      'MFA pass — 3 service accounts flagged for review',
      'SOD pass — 2 conflicts identified for remediation',
      'Patch compliance — 97.3% within SLA, 4 exceptions'
    ])[((id % 8) + 1)::int]
    WHEN 'ag_mapper' THEN (ARRAY[
      'Mapped to 14 MAS TRM requirements',
      'Aligned to 22 ISO 27001:2022 controls',
      'Mapped to 8 Notice 655 obligations',
      'SOX ITGCs mapped to 36 PCAOB sub-controls',
      'Mapped to 7 PDPA obligations, 2 gaps noted',
      'Aligned to 18 NIST CSF 2.0 subcategories',
      'Mapped to 15 CIS Controls v8 safeguards',
      'Evidence indexed across 11 audit requirements'
    ])[((id % 8) + 1)::int]
    WHEN 'ag_fair' THEN (ARRAY[
      'ALE: S$2.4M (95th pct S$8.1M)',
      'Third-party concentration ALE: S$5.7M',
      'Ransomware ALE: S$12.3M, top driver: recovery cost',
      'Insider threat ALE: S$1.8M — low frequency, high impact',
      'Cloud outage ALE: S$3.2M across 10,000 simulations',
      'Data breach regulatory fine ALE: S$4.1M',
      'Supply chain ALE: S$6.9M — vendor dependency primary driver',
      'PAM misuse ALE: S$2.2M — access controls reduce by 68%'
    ])[((id % 8) + 1)::int]
    WHEN 'ag_board' THEN (ARRAY[
      'Board narrative ready — 2-page summary',
      'Exec cyber brief generated — 5 key risks highlighted',
      'Audit committee pack ready — 18 pages',
      'Q3 risk dashboard narrative complete',
      'MAS regulatory summary — 4 action items flagged',
      'ESG risk overview complete — 3 emerging risks noted',
      'Annual compliance report generated — 94% controls effective',
      'Risk appetite statement draft ready for board review'
    ])[((id % 8) + 1)::int]
    WHEN 'ag_audit' THEN (ARRAY[
      'Fieldwork pack complete — 34 workpapers',
      'Walkthrough documentation ready for auditor',
      'External audit evidence pack — 147 items mapped',
      'Remediation tracker updated — 8 findings, 3 overdue',
      'MAS examination pack ready — 22 document index',
      'PCAOB pack complete — 40 SOX ITGCs evidenced',
      'ISO 27001 certification pack — gap score 4.2%',
      'Audit committee status complete — 12 open findings'
    ])[((id % 8) + 1)::int]
    WHEN 'ag_policy' THEN (ARRAY[
      'Policy draft complete — 3 sections updated',
      'Outsourcing policy revised — MAS 655 aligned',
      'PDPA retention policy updated — 4 schedules revised',
      'AI governance policy draft — pending review',
      'BCP policy refreshed — test schedule updated',
      'Access control policy v2.3 — approved for circulation',
      'IRP policy revision — 2 new playbooks added',
      'Risk appetite statement draft — 6 metrics revised'
    ])[((id % 8) + 1)::int]
    WHEN 'ag_incident' THEN (ARRAY[
      'Incident root cause: stale service account credential',
      'Timeline reconstructed — 14 events, 3 IOCs identified',
      'Misconfiguration root cause: IAM policy overpermission',
      'Exfiltration alert: false positive confirmed, evidence retained',
      'Ransomware chain reconstructed — 148 events mapped',
      'MFA bypass blocked — attack origin traced to SG IP',
      'Insider threat: behavioural anomaly, access quarantined',
      'Supply chain alert: vendor binary hash mismatch — escalated'
    ])[((id % 8) + 1)::int]
    WHEN 'ag_vendor' THEN (ARRAY[
      'Vendor score: 78/100 — 3 high-risk gaps identified',
      'SOC 2 Type II clean — no exceptions noted',
      'Fourth-party risk: 2 critical sub-processors flagged',
      'Questionnaire score: 82/100 — 4 open findings',
      'BCP assessment: recovery time meets contractual SLA',
      'PDPA DPA terms reviewed — 2 clauses require renegotiation',
      'Pentest findings: 1 critical CVE, patch plan required',
      'IR capability score: 71/100 — tabletop exercise recommended'
    ])[((id % 8) + 1)::int]
    ELSE output_summary
  END;
