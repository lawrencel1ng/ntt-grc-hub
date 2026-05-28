import type { Incident, TimelineEvent, Postmortem, Issue, IssueAction, IncidentSeverity, IncidentStatus, IssueSource, IssueStatus, RiskSeverity, ActionStatus, BCMPlan, BCMTest, BCMDependency, BCMTestKind, BCMTestResult, BCMDependencyKind, VendorCriticality } from './types';
import { TENANT_PROFILES } from './tenants';
import { hashStringToInt, mulberry32 } from './rng';

// =====================================================================
// Incidents
// =====================================================================

const INCIDENT_TITLES = [
  'Payments gateway latency spike',
  'Suspicious login attempts from new geo',
  'Public S3 bucket misconfiguration',
  'DDoS on customer portal',
  'Database failover triggered',
  'Privileged role escalation alert',
  'AI assistant hallucination report',
  'Vendor outage propagated'
];

const INC_SEVS: IncidentSeverity[] = ['sev1','sev2','sev2','sev3','sev3','sev4'];
const INC_STATUSES: IncidentStatus[] = ['open','contained','resolved','resolved','postmortem-done'];

export function incidentsForTenant(tenantId: string): Incident[] {
  const profile = TENANT_PROFILES[tenantId];
  if (!profile) return [];
  const prefix = tenantId.substring(2, 6).toUpperCase();
  const out: Incident[] = [];
  for (let g = 1; g <= profile.incidentCount; g++) {
    const opened = Date.now() - g * 6 * 86_400_000;
    const status = INC_STATUSES[g % INC_STATUSES.length];
    out.push({
      id: `inc_${tenantId}_${g}`,
      tenantId,
      code: `${prefix}-INC-${String(g).padStart(4, '0')}`,
      severity: INC_SEVS[g % INC_SEVS.length],
      title: `${INCIDENT_TITLES[g % INCIDENT_TITLES.length]} #${g}`,
      status,
      openedAt: new Date(opened).toISOString(),
      containedAt: g % 5 > 0 ? new Date(opened + 86_400_000).toISOString() : undefined,
      resolvedAt: g % 5 > 1 ? new Date(opened + 2 * 86_400_000).toISOString() : undefined
    });
  }
  return out;
}

const TIMELINE_ACTORS = ['SOC analyst','Incident Investigator agent','Control Tester agent','On-call SRE','Risk owner'];
const TIMELINE_EVENTS = [
  'Detected anomaly via SIEM rule SR-247',
  'Contained: revoked compromised credentials',
  'Engaged vendor support — ticket #12345',
  'Failover to DR region executed',
  'Investigation: pulled relevant logs (last 24h)',
  'Postmortem draft auto-generated',
  'Notified MAS via Notice 644 reporting'
];
const TIMELINE_SOURCES: ('agent' | 'human' | 'system')[] = ['agent','human','system','agent','human'];

export function timelineForIncident(incidentId: string): TimelineEvent[] {
  const parts = incidentId.split('_');
  const tenantId = `${parts[1]}_${parts[2]}`;
  // Resolve opened-at by re-running the generator slice.
  const all = incidentsForTenant(tenantId);
  const inc = all.find((i) => i.id === incidentId);
  if (!inc) return [];
  const opened = new Date(inc.openedAt).getTime();
  return [1, 2, 3, 4].map((e) => ({
    id: hashStringToInt(`${incidentId}:${e}`),
    tenantId,
    incidentId,
    ts: new Date(opened + e * 15 * 60 * 1000).toISOString(),
    actor: TIMELINE_ACTORS[e % TIMELINE_ACTORS.length],
    event: TIMELINE_EVENTS[e % TIMELINE_EVENTS.length],
    source: TIMELINE_SOURCES[e % TIMELINE_SOURCES.length]
  }));
}

export function postmortemForIncident(incidentId: string): Postmortem | null {
  const parts = incidentId.split('_');
  const tenantId = `${parts[1]}_${parts[2]}`;
  const inc = incidentsForTenant(tenantId).find((i) => i.id === incidentId);
  if (!inc || inc.status !== 'postmortem-done') return null;
  return {
    id: `pm_${incidentId}`,
    tenantId,
    incidentId,
    rootCauseMd: '## Root cause\n\nMisconfigured S3 bucket policy allowed list-objects from any principal.',
    correctiveActionsMd: '## Corrective actions\n\n1. Enable account-wide block-public-access\n2. Add CI/CD policy gate to fail on public ACL.',
    draftedByAgentId: 'ag_incident',
    signedOffAt: new Date(Date.now() - 2 * 86_400_000).toISOString()
  };
}

// =====================================================================
// Issues + actions
// =====================================================================

const ISSUE_TITLES = [
  'Privileged access review overdue',
  'Logging gap on internal CRM',
  'Backup restore not tested in 9 months',
  'Vendor SOC 2 missing for Tier-1 vendor',
  'KMS rotation overdue',
  'Branch protection disabled on critical repo',
  'AI DPIA missing for new feature',
  'Incident postmortem action overdue',
  'Vendor exit plan not documented',
  'Regulator change impact not assessed'
];

const ISSUE_SOURCES: IssueSource[] = ['audit','risk-treatment','incident','control-test','regulatory'];
const ISSUE_SEVS: RiskSeverity[] = ['high','medium','medium','low','critical','high'];
const ISSUE_STATUSES: IssueStatus[] = ['open','open','in-progress','resolved','accepted-risk'];

export function issuesForTenant(tenantId: string): Issue[] {
  const profile = TENANT_PROFILES[tenantId];
  if (!profile) return [];
  const prefix = tenantId.substring(2, 6).toUpperCase();
  const out: Issue[] = [];
  for (let g = 1; g <= profile.issueCount; g++) {
    out.push({
      id: `iss_${tenantId}_${g}`,
      tenantId,
      source: ISSUE_SOURCES[g % ISSUE_SOURCES.length],
      sourceId: `${prefix}-SRC-${String(g).padStart(4, '0')}`,
      title: `${ISSUE_TITLES[g % ISSUE_TITLES.length]} (${tenantId} #${g})`,
      severity: ISSUE_SEVS[g % ISSUE_SEVS.length],
      status: ISSUE_STATUSES[g % ISSUE_STATUSES.length],
      dueAt: new Date(Date.now() + (30 + g * 5) * 86_400_000).toISOString()
    });
  }
  return out;
}

const ACTION_DESCS = [
  'Engage control owner',
  'Capture evidence in vault',
  'Update remediation plan',
  'Review at next risk meeting',
  'Escalate to CRO',
  'Run agent-assisted check'
];
const ACTION_STATUSES: ActionStatus[] = ['not-started','in-progress','done'];

export function actionsForIssue(issueId: string): IssueAction[] {
  const parts = issueId.split('_');
  const tenantId = `${parts[1]}_${parts[2]}`;
  const perIssue = { t_maybank: 3, t_grab: 2, t_mindef: 2 }[tenantId] ?? 1;
  return Array.from({ length: perIssue }).map((_, i) => {
    const g = i + 1;
    return {
      id: `act_${issueId}_${g}`,
      tenantId,
      issueId,
      description: ACTION_DESCS[g % ACTION_DESCS.length],
      dueAt: new Date(Date.now() + (10 + g * 3) * 86_400_000).toISOString(),
      status: ACTION_STATUSES[g % ACTION_STATUSES.length]
    };
  });
}

// =====================================================================
// BCM (lives here for compactness — same shape as the seed §28)
// =====================================================================

const BCM_SERVICES = [
  'Core Banking','Payments','Mobile App','Internet Banking',
  'Treasury','Trading','Customer Support','Data Warehouse'
];
const RTO_BUCKETS = [15, 60, 240, 720];
const RPO_BUCKETS = [5, 15, 60, 240];

export function bcmPlansForTenant(tenantId: string): BCMPlan[] {
  if (!['t_maybank','t_grab','t_mindef'].includes(tenantId)) {
    const profile = TENANT_PROFILES[tenantId];
    if (!profile || profile.bcmPlanCount === 0) return [];
    return Array.from({ length: profile.bcmPlanCount }).map((_, i) => ({
      id: `bcm_${tenantId}_${i}`,
      tenantId,
      name: `BCP — ${BCM_SERVICES[i % BCM_SERVICES.length]}`,
      businessService: BCM_SERVICES[i % BCM_SERVICES.length],
      rtoMinutes: RTO_BUCKETS[i % RTO_BUCKETS.length],
      rpoMinutes: RPO_BUCKETS[i % RPO_BUCKETS.length]
    }));
  }
  return BCM_SERVICES.map((svc, i) => {
    const g = i + 1;
    return {
      id: `bcm_${tenantId}_${g}`,
      tenantId,
      name: `BCP — ${svc}`,
      businessService: svc,
      rtoMinutes: RTO_BUCKETS[g % RTO_BUCKETS.length],
      rpoMinutes: RPO_BUCKETS[g % RPO_BUCKETS.length],
      lastTestedAt: new Date(Date.now() - (30 + g * 5) * 86_400_000).toISOString(),
      nextTestAt: new Date(Date.now() + (90 - g * 3) * 86_400_000).toISOString()
    };
  });
}

const DEP_KINDS: BCMDependencyKind[] = ['people','tech','site','vendor'];
const DEP_NAMES = ['CISO Team','AWS Region','Changi-S DC','Stripe','Okta','Splunk','Cloudflare'];
const DEP_CRITS: VendorCriticality[] = ['critical','high','medium','low'];
const DEP_TOLERANCES = [1, 4, 8, 24];

export function bcmDependenciesForPlan(planId: string): BCMDependency[] {
  const parts = planId.split('_');
  const tenantId = `${parts[1]}_${parts[2]}`;
  const per = { t_maybank: 4, t_grab: 4, t_mindef: 3 }[tenantId] ?? 1;
  return Array.from({ length: per }).map((_, i) => {
    const g = i + 1;
    return {
      id: `dep_${planId}_${g}`,
      tenantId,
      planId,
      dependencyKind: DEP_KINDS[g % DEP_KINDS.length],
      name: DEP_NAMES[g % DEP_NAMES.length],
      criticality: DEP_CRITS[g % DEP_CRITS.length],
      downtimeToleranceHours: DEP_TOLERANCES[g % DEP_TOLERANCES.length]
    };
  });
}

const BCM_TEST_KINDS: BCMTestKind[] = ['tabletop','walkthrough','simulation','full-failover'];
const BCM_TEST_RESULTS: BCMTestResult[] = ['pass','pass','partial','fail'];

export function bcmTestsForPlan(planId: string): BCMTest[] {
  const parts = planId.split('_');
  const tenantId = `${parts[1]}_${parts[2]}`;
  const per = { t_maybank: 3, t_grab: 3, t_mindef: 2 }[tenantId] ?? 0;
  const rng = mulberry32(hashStringToInt(`bcmtest:${planId}`));
  return Array.from({ length: per }).map((_, i) => {
    const g = i + 1;
    return {
      id: `bcmtest_${planId}_${g}`,
      tenantId,
      planId,
      kind: BCM_TEST_KINDS[g % BCM_TEST_KINDS.length],
      conductedAt: new Date(Date.now() - (30 + g * 12) * 86_400_000).toISOString(),
      result: BCM_TEST_RESULTS[g % BCM_TEST_RESULTS.length],
      lessonsMd: '## Lessons learned\n\n- Update DR runbook\n- Re-test in 90 days'
    };
    void rng;
  });
}
