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
// Connectors — 40+ specs grouped by category. Each kind is the slug used
// by the UI to pick a Lucide icon; category drives the connector page's
// group headings (Cloud / Identity / ITSM / Comms / SaaS / Security /
// GRC / Custom).
// =====================================================================

export type ConnectorCategory = 'Cloud' | 'Identity' | 'ITSM/DevOps' | 'Comms' | 'SaaS' | 'Security/Obs' | 'GRC/Audit' | 'Custom';

interface ConnectorSpec { kind: string; name: string; category: ConnectorCategory; }

const CONNECTOR_SPECS: ConnectorSpec[] = [
  // ---- Cloud (6) ----
  { kind: 'aws',          name: 'AWS',           category: 'Cloud' },
  { kind: 'azure',        name: 'Azure',         category: 'Cloud' },
  { kind: 'gcp',          name: 'GCP',           category: 'Cloud' },
  { kind: 'oci',          name: 'OCI',           category: 'Cloud' },
  { kind: 'alibaba',      name: 'Alibaba Cloud', category: 'Cloud' },
  { kind: 'ntt-cloud',    name: 'NTT Cloud',     category: 'Cloud' },

  // ---- Identity (5) ----
  { kind: 'okta',         name: 'Okta',          category: 'Identity' },
  { kind: 'entra',        name: 'Entra ID',      category: 'Identity' },
  { kind: 'ping',         name: 'Ping',          category: 'Identity' },
  { kind: 'auth0',        name: 'Auth0',         category: 'Identity' },
  { kind: 'onelogin',     name: 'OneLogin',      category: 'Identity' },

  // ---- ITSM/DevOps (7) ----
  { kind: 'jira',         name: 'Jira',          category: 'ITSM/DevOps' },
  { kind: 'servicenow',   name: 'ServiceNow',    category: 'ITSM/DevOps' },
  { kind: 'github',       name: 'GitHub',        category: 'ITSM/DevOps' },
  { kind: 'gitlab',       name: 'GitLab',        category: 'ITSM/DevOps' },
  { kind: 'bitbucket',    name: 'Bitbucket',     category: 'ITSM/DevOps' },
  { kind: 'jenkins',      name: 'Jenkins',       category: 'ITSM/DevOps' },
  { kind: 'circleci',     name: 'CircleCI',      category: 'ITSM/DevOps' },

  // ---- Comms (4) ----
  { kind: 'slack',        name: 'Slack',         category: 'Comms' },
  { kind: 'teams',        name: 'MS Teams',      category: 'Comms' },
  { kind: 'pagerduty',    name: 'PagerDuty',     category: 'Comms' },
  { kind: 'opsgenie',     name: 'Opsgenie',      category: 'Comms' },

  // ---- SaaS (6) ----
  { kind: 'm365',         name: 'M365',                 category: 'SaaS' },
  { kind: 'google-workspace', name: 'Google Workspace', category: 'SaaS' },
  { kind: 'salesforce',   name: 'Salesforce',           category: 'SaaS' },
  { kind: 'box',          name: 'Box',                  category: 'SaaS' },
  { kind: 'dropbox',      name: 'Dropbox',              category: 'SaaS' },
  { kind: 'workday',      name: 'Workday',              category: 'SaaS' },

  // ---- Security / Observability (7) ----
  { kind: 'datadog',      name: 'Datadog',      category: 'Security/Obs' },
  { kind: 'splunk',       name: 'Splunk',       category: 'Security/Obs' },
  { kind: 'crowdstrike',  name: 'CrowdStrike',  category: 'Security/Obs' },
  { kind: 'wiz',          name: 'Wiz',          category: 'Security/Obs' },
  { kind: 'snyk',         name: 'Snyk',         category: 'Security/Obs' },
  { kind: 'tenable',      name: 'Tenable',      category: 'Security/Obs' },
  { kind: 'qualys',       name: 'Qualys',       category: 'Security/Obs' },

  // ---- GRC/Audit (3) — for migration scenarios ----
  { kind: 'servicenow-irm', name: 'ServiceNow IRM', category: 'GRC/Audit' },
  { kind: 'archer',         name: 'Archer',         category: 'GRC/Audit' },
  { kind: 'onetrust',       name: 'OneTrust',       category: 'GRC/Audit' },

  // ---- Custom (3) ----
  { kind: 'webhook',      name: 'Generic Webhook', category: 'Custom' },
  { kind: 'rest-api',     name: 'REST API',        category: 'Custom' },
  { kind: 'jdbc',         name: 'JDBC',            category: 'Custom' }
];

export function getConnectorSpecs(): ConnectorSpec[] {
  return CONNECTOR_SPECS;
}

export function connectorsForTenant(tenantId: string): Connector[] {
  // Hero tenants get the full inventory; long-tail tenants get the first 18
  // (cloud + identity + itsm) so the page never reads as empty for them.
  const isHero = ['t_maybank','t_grab','t_mindef'].includes(tenantId);
  const specs = isHero ? CONNECTOR_SPECS : CONNECTOR_SPECS.slice(0, 18);
  const rng = mulberry32(hashStringToInt(`conn:${tenantId}`));
  // Bias toward "connected" so the page tells the success story by default.
  const statusPool: IntegrationStatus[] = [
    'connected','connected','connected','connected','connected','connected',
    'connected','connected','degraded','disconnected'
  ];
  return specs.map((c, i) => ({
    id: `conn_${tenantId}_${c.kind}`,
    tenantId,
    kind: c.kind,
    name: c.name,
    status: statusPool[Math.floor(rng() * statusPool.length)],
    lastSyncAt: new Date(Date.now() - Math.floor(rng() * 720 * 60 * 1000)).toISOString(),
    recordsIngested24h: 100 + (i * 47) % 2400
  }));
}
