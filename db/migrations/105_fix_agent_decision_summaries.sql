-- Migration 105: Replace generic/mismatched agent decision input/output summaries
-- with agent-appropriate, realistic values.
--
-- All 3366 decisions had wrong agent↔task pairings seeded at migration time:
--   - Evidence Collector had "Scan MAS feed" (wrong)
--   - Control Tester had "Generate board narrative" (wrong)
--   - Risk Quantifier had "Build incident timeline" (wrong)
--   etc.
-- This migration corrects each agent's input/output to reflect what that agent
-- actually does, with realistic variety via MOD arithmetic on the bigint id.

-- ── Evidence Collector (ids 1-1205) ─────────────────────────────────────────
-- Pulls evidence from cloud connectors and seals/hashes each item
UPDATE agent.decisions
SET
  input  = jsonb_build_object('summary',
    CASE (id % 6)
      WHEN 0 THEN 'Collect evidence: AWS Cloud Infrastructure'
      WHEN 1 THEN 'Pull evidence: Okta IAM connector'
      WHEN 2 THEN 'Harvest GitHub commit attestations'
      WHEN 3 THEN 'Collect evidence: Azure AD & Defender'
      WHEN 4 THEN 'Pull evidence: ServiceNow change records'
      ELSE       'Collect evidence: GCP Security Command Center'
    END
  ),
  output = jsonb_build_object(
    'summary',
    CASE (id % 7)
      WHEN 0 THEN '12 items collected, hashed, sealed'
      WHEN 1 THEN '7 evidence items ingested and signed'
      WHEN 2 THEN '9 items sealed — 0 integrity failures'
      WHEN 3 THEN '15 items collected, hashed, sealed'
      WHEN 4 THEN '6 evidence items ingested and signed'
      WHEN 5 THEN '11 items sealed — 0 integrity failures'
      ELSE       '8 items collected, hashed, sealed'
    END,
    'confidence', confidence
  )
WHERE agent_id = 'ag_evidence';

-- ── Control Tester (ids 1206-2385) ──────────────────────────────────────────
-- Evaluates technical controls against live cloud config
UPDATE agent.decisions
SET
  input  = jsonb_build_object('summary',
    CASE (id % 8)
      WHEN 0 THEN 'Test encryption-at-rest control'
      WHEN 1 THEN 'Evaluate patch management compliance'
      WHEN 2 THEN 'Verify MFA enforcement policy'
      WHEN 3 THEN 'Test privileged access review process'
      WHEN 4 THEN 'Evaluate backup and recovery verification'
      WHEN 5 THEN 'Test public S3 bucket detection'
      WHEN 6 THEN 'Verify secrets rotation compliance'
      ELSE       'Test SOD conflict detection'
    END
  ),
  output = jsonb_build_object(
    'summary',
    CASE (id % 6)
      WHEN 0 THEN 'Control pass — all 14 test steps verified'
      WHEN 1 THEN 'Control pass — all volumes verified'
      WHEN 2 THEN 'Partial — 2 of 12 tests flagged for review'
      WHEN 3 THEN 'Control pass — 97.3% within SLA, 4 exceptions'
      WHEN 4 THEN 'Control pass — RTO 47 min, within threshold'
      ELSE       'SOD pass — 2 conflicts identified for remediation'
    END,
    'confidence', confidence
  )
WHERE agent_id = 'ag_tester';

-- ── Vendor Risk Analyst (ids 2386-2541) ─────────────────────────────────────
-- Auto-fills SIG/CAIQ, scores residual risk from SOC 2 / ISO reports
UPDATE agent.decisions
SET
  input  = jsonb_build_object('summary',
    CASE (id % 8)
      WHEN 0 THEN 'Assess AWS SOC 2 Type II report'
      WHEN 1 THEN 'Review Okta compliance posture'
      WHEN 2 THEN 'Evaluate Cloudflare security controls'
      WHEN 3 THEN 'Assess Microsoft Azure ISO 27001 cert'
      WHEN 4 THEN 'Review Cisco PSIRT security posture'
      WHEN 5 THEN 'Evaluate Palo Alto Networks SOC 2'
      WHEN 6 THEN 'Assess Deloitte Cyber engagement risk'
      ELSE       'Review vendor BCP and continuity SLAs'
    END
  ),
  output = jsonb_build_object(
    'summary',
    CASE (id % 5)
      WHEN 0 THEN 'Low risk — 0 critical gaps identified'
      WHEN 1 THEN 'Medium risk — 2 control gaps identified'
      WHEN 2 THEN 'BCP assessment: recovery time meets SLA'
      WHEN 3 THEN 'Low risk — SIG/CAIQ auto-filled, 1 gap'
      ELSE       'High risk — 4 gaps require remediation'
    END,
    'confidence', confidence
  )
WHERE agent_id = 'ag_vendor';

-- ── Policy Drafter (ids 2542-2589) ──────────────────────────────────────────
-- Drafts policy documents from framework deltas + org context
UPDATE agent.decisions
SET
  input  = jsonb_build_object('summary',
    CASE (id % 6)
      WHEN 0 THEN 'Draft MFA enforcement policy update'
      WHEN 1 THEN 'Generate BYOD & mobile device policy v3'
      WHEN 2 THEN 'Update data retention and disposal policy'
      WHEN 3 THEN 'Draft AI ethics and responsible use policy'
      WHEN 4 THEN 'Update vendor risk management policy'
      ELSE       'Draft incident response and recovery policy'
    END
  ),
  output = jsonb_build_object(
    'summary',
    CASE (id % 4)
      WHEN 0 THEN 'Draft: 8 sections, 23 requirements mapped'
      WHEN 1 THEN 'Policy draft ready for review (11 sections)'
      WHEN 2 THEN 'Draft: 6 sections, 18 MAS obligations mapped'
      ELSE       'Draft: 9 sections, 31 requirements mapped'
    END,
    'confidence', confidence
  )
WHERE agent_id = 'ag_policy';

-- ── Regulatory Horizon (ids 2590-2783) ──────────────────────────────────────
-- Scans 40+ regulator sources, tags impact, opens assessments
UPDATE agent.decisions
SET
  input  = jsonb_build_object('summary',
    CASE (id % 8)
      WHEN 0 THEN 'Scan MAS regulatory feed'
      WHEN 1 THEN 'Scan PDPC advisory updates'
      WHEN 2 THEN 'Scan MOM workplace compliance feed'
      WHEN 3 THEN 'Scan OJK digital banking circulars'
      WHEN 4 THEN 'Scan HKMA supervisory circulars'
      WHEN 5 THEN 'Scan APRA prudential standards'
      WHEN 6 THEN 'Scan BNM financial policy updates'
      ELSE       'Scan RBI digital banking guidelines'
    END
  ),
  output = jsonb_build_object(
    'summary',
    CASE (id % 7)
      WHEN 0 THEN '3 new regulatory items detected'
      WHEN 1 THEN '1 new item detected — impact assessment opened'
      WHEN 2 THEN '5 new items detected — 2 high impact'
      WHEN 3 THEN '2 new items detected'
      WHEN 4 THEN '0 new items — no action required'
      WHEN 5 THEN '4 new items detected — policy gap opened'
      ELSE       '1 new item detected'
    END,
    'confidence', confidence
  )
WHERE agent_id = 'ag_regwatch';

-- ── Audit Companion (ids 2784-2880) ─────────────────────────────────────────
-- Assembles auditor evidence packs, links evidence → control → requirement
UPDATE agent.decisions
SET
  input  = jsonb_build_object('summary',
    CASE (id % 5)
      WHEN 0 THEN 'Assemble pack: MAS TRM Inspection 2026'
      WHEN 1 THEN 'Build evidence pack for SOX review'
      WHEN 2 THEN 'Prepare pack: OJK Spot Check ID'
      WHEN 3 THEN 'Assemble pack: ITSG-33 Sovereign Review'
      ELSE       'Build evidence pack for internal audit'
    END
  ),
  output = jsonb_build_object(
    'summary',
    CASE (id % 4)
      WHEN 0 THEN 'Pack assembled (8s, 47 evidence items)'
      WHEN 1 THEN 'Pack assembled (12s, 63 items linked)'
      WHEN 2 THEN 'Pack assembled (6s, 31 items mapped)'
      ELSE       'Pack assembled (10s, 55 evidence items)'
    END,
    'confidence', confidence
  )
WHERE agent_id = 'ag_audit';

-- ── Risk Quantifier / FAIR (ids 2881-3163) ───────────────────────────────────
-- Runs FAIR Monte Carlo (10k trials), produces LEC + ALE
UPDATE agent.decisions
SET
  input  = jsonb_build_object('summary',
    CASE (id % 7)
      WHEN 0 THEN 'Run FAIR: ransomware on payment systems'
      WHEN 1 THEN 'Quantify AML rule failure exposure'
      WHEN 2 THEN 'Run FAIR: third-party cloud concentration'
      WHEN 3 THEN 'Quantify MAS Notice 655 non-compliance risk'
      WHEN 4 THEN 'Run FAIR: insider trading misuse scenario'
      WHEN 5 THEN 'Quantify data breach — PII exfiltration'
      ELSE       'Run FAIR: CBDC interoperability attack'
    END
  ),
  output = jsonb_build_object(
    'summary',
    CASE (id % 6)
      WHEN 0 THEN 'ALE: S$2.4M (95th pct S$8.1M)'
      WHEN 1 THEN 'ALE: S$890K (95th pct S$3.2M)'
      WHEN 2 THEN 'ALE: S$4.1M (95th pct S$12.5M)'
      WHEN 3 THEN 'ALE: S$640K (95th pct S$1.9M)'
      WHEN 4 THEN 'ALE: S$1.7M (95th pct S$5.4M)'
      ELSE       'ALE: S$3.2M (95th pct S$9.8M)'
    END,
    'confidence', confidence
  )
WHERE agent_id = 'ag_fair';

-- ── Incident Investigator (ids 3164-3216) ────────────────────────────────────
-- Builds incident timeline + draft postmortem from logs/tickets/chat
UPDATE agent.decisions
SET
  input  = jsonb_build_object('summary',
    CASE (id % 5)
      WHEN 0 THEN 'Build timeline: SEC-2025-047 phishing campaign'
      WHEN 1 THEN 'Reconstruct INC-2025-012 API credential leak'
      WHEN 2 THEN 'Build timeline: ransomware attempted intrusion'
      WHEN 3 THEN 'Reconstruct P1 payment outage incident'
      ELSE       'Build timeline: insider threat investigation'
    END
  ),
  output = jsonb_build_object(
    'summary',
    CASE (id % 4)
      WHEN 0 THEN 'Timeline reconstructed (148 events, 3 actors)'
      WHEN 1 THEN 'Timeline reconstructed (73 events, 2 actors)'
      WHEN 2 THEN 'Timeline reconstructed (211 events, 5 actors)'
      ELSE       'Timeline reconstructed (94 events, 1 actor)'
    END,
    'confidence', confidence
  )
WHERE agent_id = 'ag_incident';

-- ── Control Mapper (ids 3217-3311) ──────────────────────────────────────────
-- Maps a new/custom control into all 35+ frameworks with semantic similarity
UPDATE agent.decisions
SET
  input  = jsonb_build_object('summary',
    CASE (id % 5)
      WHEN 0 THEN 'Map MFA enforcement control to frameworks'
      WHEN 1 THEN 'Map encryption-at-rest control'
      WHEN 2 THEN 'Map patch management SLA to 35+ frameworks'
      WHEN 3 THEN 'Map privileged access review control'
      ELSE       'Map BYOD security control to frameworks'
    END
  ),
  output = jsonb_build_object(
    'summary',
    CASE (id % 4)
      WHEN 0 THEN 'Mapped to 14 frameworks (avg 89% similarity)'
      WHEN 1 THEN 'Mapped to 19 frameworks (avg 92% similarity)'
      WHEN 2 THEN 'Mapped to 11 frameworks (avg 84% similarity)'
      ELSE       'Mapped to 22 frameworks (avg 87% similarity)'
    END,
    'confidence', confidence
  )
WHERE agent_id = 'ag_mapper';

-- ── Board Narrator (ids 3312-3366) ──────────────────────────────────────────
-- Generates monthly 1-page board narratives from quantitative data
UPDATE agent.decisions
SET
  input  = jsonb_build_object('summary',
    CASE (id % 6)
      WHEN 0 THEN 'Generate May 2026 board risk narrative'
      WHEN 1 THEN 'Draft Q1 2026 board pack narrative'
      WHEN 2 THEN 'Generate April 2026 board narrative'
      WHEN 3 THEN 'Draft Q4 2025 board pack narrative'
      WHEN 4 THEN 'Generate March 2026 board narrative'
      ELSE       'Draft Q3 2025 board pack narrative'
    END
  ),
  output = jsonb_build_object(
    'summary',
    CASE (id % 3)
      WHEN 0 THEN '1-page narrative generated (5 risk themes)'
      WHEN 1 THEN 'Narrative generated — 3 critical items escalated'
      ELSE       '1-page narrative generated (7 risk themes)'
    END,
    'confidence', confidence
  )
WHERE agent_id = 'ag_board';

\echo ' >> 3366 agent decision input/output summaries updated with agent-appropriate content'
