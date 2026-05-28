import type { Workflow, WorkflowExecution, Connector, IntegrationStatus } from './types';
import { hashStringToInt, mulberry32 } from './rng';

const WORKFLOW_DEFS = [
  {
    name: 'Vendor onboarding',
    description: 'New vendor: parse SIG/CAIQ, score, route for approval',
    steps: [
      { kind: 'agent' as const,    ref: 'ag_vendor', label: 'Auto-fill SIG' },
      { kind: 'decision' as const, label: 'Risk score gate', requiresApproval: true },
      { kind: 'manual' as const,   label: 'Procurement signoff' }
    ]
  },
  {
    name: 'Regulatory change triage',
    description: 'On regulator change: tag impact, open gaps, notify owners',
    steps: [
      { kind: 'agent' as const,  ref: 'ag_regwatch', label: 'Tag impact' },
      { kind: 'agent' as const,  ref: 'ag_mapper',   label: 'Map controls' },
      { kind: 'manual' as const, label: 'CRO review', requiresApproval: true }
    ]
  },
  {
    name: 'Audit pack assembly',
    description: 'On audit event: assemble evidence pack',
    steps: [
      { kind: 'agent' as const,  ref: 'ag_audit', label: 'Assemble pack' },
      { kind: 'manual' as const, label: 'Lead auditor signoff', requiresApproval: true }
    ]
  },
  {
    name: 'Quarterly access review',
    description: 'Pull entitlements; flag stale; route to managers',
    steps: [
      { kind: 'agent' as const,  ref: 'ag_evidence', label: 'Pull entitlements' },
      { kind: 'manual' as const, label: 'Manager review', requiresApproval: true },
      { kind: 'agent' as const,  ref: 'ag_evidence', label: 'Seal evidence' }
    ]
  }
];

export function workflowsForTenant(tenantId: string): Workflow[] {
  if (!['t_maybank','t_grab','t_mindef','t_singhealth'].includes(tenantId)) return [];
  const rng = mulberry32(hashStringToInt(`wf:${tenantId}`));
  return WORKFLOW_DEFS.map((d, i) => ({
    id: `wf_${tenantId}_${i}`,
    tenantId,
    name: d.name,
    description: d.description,
    steps: d.steps,
    version: 1,
    enabled: true,
    lastExecutionStatus: (['success','success','running','failed'] as const)[i % 4],
    successRate30d: +(0.85 + rng() * 0.13).toFixed(2)
  }));
}

export function workflowExecutionsForTenant(tenantId: string, limit = 20): WorkflowExecution[] {
  const wfs = workflowsForTenant(tenantId);
  if (!wfs.length) return [];
  const rng = mulberry32(hashStringToInt(`wfx:${tenantId}`));
  const out: WorkflowExecution[] = [];
  let id = 700_000;
  for (let i = 0; i < limit; i++) {
    const wf = wfs[Math.floor(rng() * wfs.length)];
    const started = Date.now() - i * 8 * 3600 * 1000;
    out.push({
      id: id++,
      tenantId,
      workflowId: wf.id,
      workflowName: wf.name,
      trigger: (['cron','manual','event'] as const)[i % 3],
      startedAt: new Date(started).toISOString(),
      endedAt: new Date(started + 60 * 1000).toISOString(),
      status: (['success','success','success','running','failed','halted'] as const)[i % 6]
    });
  }
  return out;
}

// =====================================================================
// Connectors
// =====================================================================

const CONNECTOR_SPECS = [
  { kind: 'aws',        name: 'AWS' },
  { kind: 'azure',      name: 'Azure' },
  { kind: 'gcp',        name: 'GCP' },
  { kind: 'okta',       name: 'Okta' },
  { kind: 'jira',       name: 'Jira' },
  { kind: 'm365',       name: 'M365' },
  { kind: 'github',     name: 'GitHub' },
  { kind: 'servicenow', name: 'ServiceNow' },
  { kind: 'slack',      name: 'Slack' },
  { kind: 'splunk',     name: 'Splunk' }
];

export function connectorsForTenant(tenantId: string): Connector[] {
  if (!['t_maybank','t_grab','t_mindef'].includes(tenantId)) return [];
  const rng = mulberry32(hashStringToInt(`conn:${tenantId}`));
  return CONNECTOR_SPECS.map((c, i) => {
    const statusPool: IntegrationStatus[] = ['connected','connected','connected','degraded','disconnected'];
    return {
      id: `conn_${tenantId}_${c.kind}`,
      tenantId,
      kind: c.kind,
      name: `${c.name} — ${tenantId}`,
      status: statusPool[Math.floor(rng() * statusPool.length)],
      lastSyncAt: new Date(Date.now() - Math.floor(rng() * 720 * 60 * 1000)).toISOString(),
      recordsIngested24h: 100 + (i * 47) % 1500
    };
  });
}
