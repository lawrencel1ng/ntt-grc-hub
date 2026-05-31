import type { Agent, AgentRun, AgentDecision, AgentTool, CostLedgerEntry, AgentRunStatus, AgentDecisionOutcome, AgentRunTrigger, AgentFleetSummary } from './types';
import { hashStringToInt, mulberry32 } from './rng';
import { TENANTS, TENANT_PROFILES } from './tenants';

// 10 universal agents per spec §5 / seed.sql section 4. Platform-global —
// the same fleet runs across all tenants and bills via agent.cost_ledger.
export const AGENTS: Agent[] = [
  {
    id: 'ag_evidence',
    name: 'Evidence Collector',
    slug: 'evidence-collector',
    description:
      'Pulls evidence from AWS, Azure, GCP, Okta, Jira, M365, GitHub, ServiceNow. Hashes and seals each item.',
    type: 'deterministic',
    status: 'running',
    ownerTeam: 'GRC Platform',
    costPerRunCents: 2,
    costMonthlyEstimateCents: 0,
    fteEquivalent: 0.8
  },
  {
    id: 'ag_tester',
    name: 'Control Tester',
    slug: 'control-tester',
    description: 'Continuously evaluates technical controls against live cloud config.',
    type: 'ai-powered',
    status: 'running',
    ownerTeam: 'GRC Platform',
    costPerRunCents: 4,
    costMonthlyEstimateCents: 3000,
    fteEquivalent: 0.6
  },
  {
    id: 'ag_vendor',
    name: 'Vendor Risk Analyst',
    slug: 'vendor-risk-analyst',
    description: 'Auto-fills SIG/CAIQ from vendor SOC 2 / ISO reports, scores residual risk.',
    type: 'ai-powered',
    status: 'idle',
    ownerTeam: 'TPRM',
    costPerRunCents: 12,
    costMonthlyEstimateCents: 8000,
    fteEquivalent: 0.5
  },
  {
    id: 'ag_policy',
    name: 'Policy Drafter',
    slug: 'policy-drafter',
    description: 'Drafts policy documents from framework deltas + org context.',
    type: 'ai-powered',
    status: 'idle',
    ownerTeam: 'Policy Office',
    costPerRunCents: 28,
    costMonthlyEstimateCents: 12000,
    fteEquivalent: 0.4
  },
  {
    id: 'ag_regwatch',
    name: 'Regulatory Horizon',
    slug: 'regulatory-horizon',
    description: 'Scans 40+ regulator sources, tags impact, opens assessments.',
    type: 'intelligent',
    status: 'running',
    ownerTeam: 'GRC Intelligence',
    costPerRunCents: 16,
    costMonthlyEstimateCents: 20000,
    fteEquivalent: 0.55
  },
  {
    id: 'ag_audit',
    name: 'Audit Companion',
    slug: 'audit-companion',
    description: 'Assembles auditor evidence packs, links evidence → control → requirement.',
    type: 'intelligent',
    status: 'idle',
    ownerTeam: 'Internal Audit',
    costPerRunCents: 32,
    costMonthlyEstimateCents: 15000,
    fteEquivalent: 0.45
  },
  {
    id: 'ag_fair',
    name: 'Risk Quantifier',
    slug: 'risk-quantifier',
    description: 'Runs FAIR Monte Carlo (10k trials), produces LEC + ALE.',
    type: 'ai-powered',
    status: 'idle',
    ownerTeam: 'ERM',
    costPerRunCents: 8,
    costMonthlyEstimateCents: 4000,
    fteEquivalent: 0.4
  },
  {
    id: 'ag_incident',
    name: 'Incident Investigator',
    slug: 'incident-investigator',
    description: 'Builds incident timeline + draft postmortem from logs/tickets/chat.',
    type: 'intelligent',
    status: 'idle',
    ownerTeam: 'SOC',
    costPerRunCents: 24,
    costMonthlyEstimateCents: 18000,
    fteEquivalent: 0.6
  },
  {
    id: 'ag_mapper',
    name: 'Control Mapper',
    slug: 'control-mapper',
    description: 'Maps a new/custom control into all 35+ frameworks with semantic similarity.',
    type: 'ai-powered',
    status: 'idle',
    ownerTeam: 'Compliance',
    costPerRunCents: 6,
    costMonthlyEstimateCents: 6000,
    fteEquivalent: 0.4
  },
  {
    id: 'ag_board',
    name: 'Board Narrator',
    slug: 'board-narrator',
    description: 'Generates monthly 1-page board narratives from quantitative data.',
    type: 'ai-powered',
    status: 'idle',
    ownerTeam: 'Executive Office',
    costPerRunCents: 40,
    costMonthlyEstimateCents: 9000,
    fteEquivalent: 0.3
  }
];

export const AGENT_TOOLS: AgentTool[] = [
  { agentId: 'ag_evidence',  toolName: 'aws.s3.list',                  toolKind: 'api',    description: 'List S3 buckets and bucket policies' },
  { agentId: 'ag_evidence',  toolName: 'okta.users.list',              toolKind: 'api',    description: 'Pull Okta user inventory' },
  { agentId: 'ag_evidence',  toolName: 'github.repos.security_config', toolKind: 'api',    description: 'Read GitHub security & branch protection config' },
  { agentId: 'ag_evidence',  toolName: 'evidence.seal',                toolKind: 'db',     description: 'Compute hash-chain seal' },
  { agentId: 'ag_tester',    toolName: 'aws.config.eval',              toolKind: 'api',    description: 'Evaluate AWS Config managed rules' },
  { agentId: 'ag_tester',    toolName: 'azure.policy.eval',            toolKind: 'api',    description: 'Evaluate Azure Policy compliance' },
  { agentId: 'ag_tester',    toolName: 'llm.interpret',                toolKind: 'llm',    description: 'Interpret raw config into pass/fail with rationale' },
  { agentId: 'ag_vendor',    toolName: 'sig.parse',                    toolKind: 'script', description: 'Parse SIG questionnaire' },
  { agentId: 'ag_vendor',    toolName: 'soc2.extract',                 toolKind: 'llm',    description: 'Extract controls from SOC 2 PDF' },
  { agentId: 'ag_policy',    toolName: 'policy.draft',                 toolKind: 'llm',    description: 'Generate policy markdown' },
  { agentId: 'ag_regwatch',  toolName: 'web.fetch',                    toolKind: 'api',    description: 'Fetch regulator publication feed' },
  { agentId: 'ag_regwatch',  toolName: 'regulator.diff',               toolKind: 'script', description: 'Diff against last snapshot' },
  { agentId: 'ag_regwatch',  toolName: 'llm.summarise',                toolKind: 'llm',    description: 'Summarise regulatory change' },
  { agentId: 'ag_audit',     toolName: 'evidence.search',              toolKind: 'db',     description: 'Semantic search over evidence vault' },
  { agentId: 'ag_audit',     toolName: 'pack.assemble',                toolKind: 'script', description: 'Bundle evidence into auditor pack' },
  { agentId: 'ag_fair',      toolName: 'fair.simulate',                toolKind: 'script', description: 'Monte Carlo simulation (10k trials)' },
  { agentId: 'ag_incident',  toolName: 'logs.fetch',                   toolKind: 'api',    description: 'Pull logs from observability stack' },
  { agentId: 'ag_incident',  toolName: 'timeline.build',               toolKind: 'script', description: 'Construct incident timeline' },
  { agentId: 'ag_incident',  toolName: 'llm.draft-postmortem',         toolKind: 'llm',    description: 'Draft postmortem narrative' },
  { agentId: 'ag_mapper',    toolName: 'embed.similarity',             toolKind: 'llm',    description: 'Compute semantic similarity to existing controls' },
  { agentId: 'ag_board',     toolName: 'kpi.aggregate',                toolKind: 'db',     description: 'Aggregate KPIs across modules' },
  { agentId: 'ag_board',     toolName: 'llm.narrative',                toolKind: 'llm',    description: 'Generate executive narrative' }
];

// Per-agent narrative pools — used by both the run generator and the
// SSE bus so summaries stay believable across the demo.
export const AGENT_INPUT_SUMMARIES: Record<string, string[]> = {
  ag_evidence:  ['Pull S3 inventory snapshot',  'Sync Okta user roster',   'Capture GitHub branch protections', 'Snapshot AWS Config compliance', 'Pull M365 admin role audit'],
  ag_tester:    ['Eval AWS Config rule: ENC-1', 'Eval Azure Policy: SOC-2','Test KMS rotation cadence',          'Validate TLS posture',           'Test MFA-on-admin coverage'],
  ag_vendor:    ['Parse vendor SIG response',   'Extract SOC 2 controls', 'Score residual vendor risk',        'Map CAIQ to MAS TRM',            'Run vendor concentration check'],
  ag_policy:    ['Generate Outsourcing Policy v2','Draft AI Acceptable Use','Update Data Retention Policy',     'Draft DORA readiness policy',    'Refresh Incident Response Policy'],
  ag_regwatch:  ['Scan MAS feed (10 items)',   'Scan APRA + ENISA',       'Diff EU AI Act technical standard', 'Pull RBI cyber circulars',       'Diff PIPC publications'],
  ag_audit:     ['Assemble ISO 27001 audit pack','Bundle SOC 2 evidence', 'Compile MAS TRM samples',           'Generate PCI ROC bundle',        'Build BCM workpaper'],
  ag_fair:      ['Run FAIR scenario: ransomware','Quantify outsourcing risk','Simulate AWS region outage',     'Reprice loan AI risk',           'Quantify breach exposure'],
  ag_incident:  ['Build timeline INC-0042',    'Draft postmortem INC-0031','Pull logs for INC-0039',            'Correlate alerts INC-0044',      'Summarise INC-0033 chat thread'],
  ag_mapper:    ['Map new control to 14 frameworks','Map CT-0892 → SOC 2','Map CT-1100 → MAS TRM',              'Map CT-0712 → NIST CSF',         'Embed-similarity new admin control'],
  ag_board:     [`Aggregate KPIs for ${new Date().toLocaleString('en-SG', { month: 'long', year: 'numeric' })}`,'Draft 1-page Board summary','Build CRO board appendix',         'Generate ESG board callout',     'Compose Agent ROI section']
};

export const AGENT_OUTPUT_SUMMARIES: Record<string, string[]> = {
  ag_evidence:  ['Pulled 247 buckets',           '124 users in scope',     '38 repos audited',                 'Compliance: 96.4%',              'M365 audit captured'],
  ag_tester:    ['Eval: 38 pass / 2 fail',       'Policy compliant',       'KMS rotation overdue on 3',        'TLS 1.2+ everywhere',            'MFA at 98.2%'],
  ag_vendor:    ['SIG auto-filled (82% conf)',   'SOC 2 mapped (47 ctrls)','Residual: medium',                 'CAIQ mapping complete',          'Concentration alert: AWS x18'],
  ag_policy:    ['Drafted v2 (3,400 tokens)',    'AAU draft complete',     'Retention amended',                'DORA draft v1 ready',            'IR policy refresh queued'],
  ag_regwatch:  ['Detected 3 new items',         'No material change',     'AI Act diff: 7 changes',           '1 new RBI circular',             'PIPC: 0 changes'],
  ag_audit:     ['Pack assembled (8s)',          'Bundle (124 items)',     'Sample set captured',              'ROC ready for QA',               'Workpaper drafted'],
  ag_fair:      ['ALE = $1.4M, P95 = $3.2M',     'ALE = $4.2M',            'ALE = $890K',                      'ALE = $3.1M',                    'ALE = $2.7M, P99 = $11M'],
  ag_incident:  ['Timeline reconstructed (148 evts)','Postmortem drafted','Logs fetched (24h)',                'Correlated 18 alerts',           'Chat summary ready'],
  ag_mapper:    ['Mapped to 14 frameworks',      'Confidence 91%',         '7 mappings, 92% avg',              'Mapped to NIST CSF SC.1',        'Top-5 similar controls'],
  ag_board:     ['Generated 1-page summary',     '4 paragraphs ready',     'Appendix attached',                'ESG callout drafted',            'ROI: $1.2M/yr']
};

// =====================================================================
// Generators (deterministic via seeded RNG)
// =====================================================================

const RUN_STATUS_POOL: AgentRunStatus[] = ['success','success','success','success','success','success','failed','halted','awaiting-approval'];
const TRIGGER_POOL: AgentRunTrigger[] = ['cron','cron','cron','manual','event'];

/**
 * Generates a synthetic stream of agent.runs anchored at "now". Determinism
 * comes from a seeded RNG, so two consecutive page loads see the same
 * trailing-window data.
 */
export function recentAgentRuns(limit: number, tenantId?: string): AgentRun[] {
  const seedKey = `runs:${tenantId ?? 'all'}:${limit}`;
  const rng = mulberry32(hashStringToInt(seedKey));
  const out: AgentRun[] = [];
  const candidateTenants = tenantId
    ? [tenantId]
    : TENANTS.map((t) => t.id);
  let id = 100_000;
  // Spread the most recent `limit` runs across the last 6 hours.
  for (let i = 0; i < limit; i++) {
    const agent = AGENTS[Math.floor(rng() * AGENTS.length)];
    const tid = candidateTenants[Math.floor(rng() * candidateTenants.length)];
    const ageSec = Math.floor(rng() * 6 * 3600) + i * 30;
    const startedAt = new Date(Date.now() - ageSec * 1000).toISOString();
    const latency = 200 + Math.floor(rng() * 9800);
    const inputs = AGENT_INPUT_SUMMARIES[agent.id];
    const outputs = AGENT_OUTPUT_SUMMARIES[agent.id];
    out.push({
      id: id--,
      tenantId: tid,
      agentId: agent.id,
      agentName: agent.name,
      trigger: TRIGGER_POOL[Math.floor(rng() * TRIGGER_POOL.length)],
      startedAt,
      endedAt: new Date(Date.now() - ageSec * 1000 + latency).toISOString(),
      status: RUN_STATUS_POOL[Math.floor(rng() * RUN_STATUS_POOL.length)],
      inputSummary: inputs[Math.floor(rng() * inputs.length)],
      outputSummary: outputs[Math.floor(rng() * outputs.length)],
      toolsCalled: ['aws.api','llm','db.write'].slice(0, 1 + Math.floor(rng() * 3)),
      costCents: agent.costPerRunCents,
      latencyMs: latency
    });
  }
  return out.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

const DECISION_TYPES = ['auto-evaluate', 'auto-fill', 'auto-tag', 'recommend', 'assess'];
const DECISION_OUTCOMES: AgentDecisionOutcome[] = ['auto-approved','auto-approved','auto-approved','awaiting-hitl','hitl-approved','hitl-rejected'];

export function recentDecisions(limit: number, tenantId?: string): AgentDecision[] {
  const seedKey = `decisions:${tenantId ?? 'all'}:${limit}`;
  const rng = mulberry32(hashStringToInt(seedKey));
  const out: AgentDecision[] = [];
  const candidateTenants = tenantId ? [tenantId] : TENANTS.map((t) => t.id);
  let id = 200_000;
  for (let i = 0; i < limit; i++) {
    const agent = AGENTS[Math.floor(rng() * AGENTS.length)];
    const tid = candidateTenants[Math.floor(rng() * candidateTenants.length)];
    const ageSec = Math.floor(rng() * 12 * 3600) + i * 60;
    const inputs = AGENT_INPUT_SUMMARIES[agent.id];
    const outputs = AGENT_OUTPUT_SUMMARIES[agent.id];
    const decisionType = DECISION_TYPES[Math.floor(rng() * DECISION_TYPES.length)];
    out.push({
      id: id--,
      tenantId: tid,
      agentId: agent.id,
      agentName: agent.name,
      runId: 300_000 + i,
      decisionType,
      input: { summary: inputs[Math.floor(rng() * inputs.length)] },
      output: { summary: outputs[Math.floor(rng() * outputs.length)] },
      confidence: 0.6 + rng() * 0.4,
      outcome: DECISION_OUTCOMES[Math.floor(rng() * DECISION_OUTCOMES.length)],
      decidedAt: new Date(Date.now() - ageSec * 1000).toISOString()
    });
  }
  return out.sort((a, b) => (a.decidedAt < b.decidedAt ? 1 : -1));
}

const RUNS_PER_DAY: Record<string, number> = {
  ag_evidence: 24, ag_tester: 24, ag_vendor: 3, ag_policy: 1,
  ag_regwatch: 4, ag_audit: 2, ag_fair: 6, ag_incident: 1,
  ag_mapper: 2, ag_board: 1
};

const TENANT_SCALES: Record<string, number> = {
  t_maybank: 1.0, t_grab: 0.9, t_mindef: 0.45,
  t_singhealth: 0.10, t_govtech: 0.15, t_astar: 0.08,
  t_mediacorp: 0.06, t_singtel: 0.20
};

/**
 * Generates 30 days of cost ledger entries (one row per tenant×agent×day)
 * scaled by the tenant profile. Deterministic via the seeded RNG so the
 * Agent ROI dashboard numbers don't shift between reloads.
 */
export function agentCostLedger30d(tenantId?: string): CostLedgerEntry[] {
  const out: CostLedgerEntry[] = [];
  const tenants = tenantId ? [tenantId] : TENANTS.map((t) => t.id);
  const rng = mulberry32(hashStringToInt(`ledger:${tenantId ?? 'all'}`));
  for (const tid of tenants) {
    const scale = TENANT_SCALES[tid] ?? 0.1;
    for (const agent of AGENTS) {
      const baseRuns = RUNS_PER_DAY[agent.id] ?? 1;
      for (let d = 0; d < 30; d++) {
        const jitter = (rng() * 4 - 2);
        const runs = Math.max(0, Math.round(baseRuns * scale + jitter));
        out.push({
          tenantId: tid,
          agentId: agent.id,
          ts: new Date(Date.now() - d * 86_400_000).toISOString(),
          runs,
          costCents: runs * agent.costPerRunCents,
          fteSavedHours: +(agent.fteEquivalent * scale * 8 / 30).toFixed(2)
        });
      }
    }
  }
  return out;
}

export function agentFleetSummary(): AgentFleetSummary[] {
  // Aggregate 30d ledger numbers across all tenants per agent.
  const ledger = agentCostLedger30d();
  const totals = new Map<string, { runs: number; costCents: number; fteHours: number }>();
  for (const e of ledger) {
    const prev = totals.get(e.agentId) ?? { runs: 0, costCents: 0, fteHours: 0 };
    totals.set(e.agentId, {
      runs: prev.runs + e.runs,
      costCents: prev.costCents + e.costCents,
      fteHours: prev.fteHours + e.fteSavedHours
    });
  }
  return AGENTS.map((a) => {
    const t = totals.get(a.id) ?? { runs: 0, costCents: 0, fteHours: 0 };
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      status: a.status,
      runs30d: t.runs,
      costCents30d: t.costCents,
      fteHours30d: +t.fteHours.toFixed(1)
    };
  });
}

export function liveAgentCount(): number {
  return AGENTS.filter((a) => a.status === 'running').length;
}

// Sanity check: TENANT_PROFILES used here to keep the import live (also
// helps tree-shaking pick up the profile when generators import it).
export const _tenantProfileSample = TENANT_PROFILES;
