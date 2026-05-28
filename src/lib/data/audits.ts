import type { AuditEngagement, AuditFinding, EngagementType, RiskSeverity, FindingStatus } from './types';
import { hashStringToInt, mulberry32 } from './rng';

interface EngagementSpec {
  tenantId: string;
  name: string;
  type: EngagementType;
  leadAuditor: string;
  daysOpen: number;
  closed: boolean;
  daysClosed: number | null;
  scope: string;
  frameworkId: string;
}

// Mirrors db/seed.sql section 20.
const ENGAGEMENT_SPECS: EngagementSpec[] = [
  // Maybank — 12 engagements
  { tenantId: 't_maybank', name: 'ISO 27001 Surveillance 2026', type: 'external',  leadAuditor: 'BDO Singapore', daysOpen: 120, closed: false, daysClosed: null, scope: 'Information Security Mgmt System', frameworkId: 'iso-27001' },
  { tenantId: 't_maybank', name: 'SOC 2 Type II — H1 2026',     type: 'external',  leadAuditor: 'EY',            daysOpen: 95,  closed: true,  daysClosed: 20,   scope: 'Trust Services Criteria (Sec/Conf)', frameworkId: 'soc2' },
  { tenantId: 't_maybank', name: 'MAS TRM Inspection 2026',     type: 'regulatory',leadAuditor: 'MAS Examiner',  daysOpen: 60,  closed: false, daysClosed: null, scope: 'MAS TRM scope', frameworkId: 'mas-trm' },
  { tenantId: 't_maybank', name: 'PCI DSS 4.0 ROC',             type: 'external',  leadAuditor: 'TrustWave',     daysOpen: 150, closed: true,  daysClosed: 30,   scope: 'Cardholder Data Environment', frameworkId: 'pci-dss-4' },
  { tenantId: 't_maybank', name: 'Internal Audit — Cloud',      type: 'internal',  leadAuditor: 'Internal Audit Q1', daysOpen: 80, closed: true, daysClosed: 10, scope: 'AWS production accounts', frameworkId: 'iso-27001' },
  { tenantId: 't_maybank', name: 'Internal Audit — Vendors',    type: 'internal',  leadAuditor: 'Internal Audit Q2', daysOpen: 45, closed: false, daysClosed: null, scope: 'TPRM program review', frameworkId: 'iso-27001' },
  { tenantId: 't_maybank', name: 'DORA Readiness 2026',         type: 'internal',  leadAuditor: 'Internal Audit',daysOpen: 30,  closed: false, daysClosed: null, scope: 'EU DORA readiness', frameworkId: 'dora' },
  { tenantId: 't_maybank', name: 'Customer Audit — DBS Pty',    type: 'customer',  leadAuditor: 'DBS Procurement',daysOpen: 25, closed: true,  daysClosed: 5,    scope: 'Customer security review', frameworkId: 'soc2' },
  { tenantId: 't_maybank', name: 'MAS Notice 655 Spot Check',   type: 'regulatory',leadAuditor: 'MAS Spot Team', daysOpen: 7,   closed: false, daysClosed: null, scope: 'Outsourcing Notice spot inspection', frameworkId: 'mas-notice-655' },
  { tenantId: 't_maybank', name: 'BCM Audit 2026',              type: 'internal',  leadAuditor: 'Internal Audit',daysOpen: 65,  closed: true,  daysClosed: 20,   scope: 'BCM plan + tests', frameworkId: 'iso-27001' },
  { tenantId: 't_maybank', name: 'AI Model Audit',              type: 'internal',  leadAuditor: 'Model Risk',    daysOpen: 50,  closed: false, daysClosed: null, scope: 'AI/ML model risk review', frameworkId: 'eu-ai-act' },
  { tenantId: 't_maybank', name: 'Privacy Audit',               type: 'internal',  leadAuditor: 'DPO',           daysOpen: 40,  closed: true,  daysClosed: 15,   scope: 'PDPA + GDPR readiness', frameworkId: 'gdpr' },
  // Grab — 10
  { tenantId: 't_grab',    name: 'SOC 2 Type II — H1 2026',     type: 'external',  leadAuditor: 'KPMG',          daysOpen: 100, closed: true,  daysClosed: 18,   scope: 'Trust Services Criteria', frameworkId: 'soc2' },
  { tenantId: 't_grab',    name: 'MAS Inspection 2026',         type: 'regulatory',leadAuditor: 'MAS Examiner',  daysOpen: 50,  closed: false, daysClosed: null, scope: 'GrabPay scope', frameworkId: 'mas-trm' },
  { tenantId: 't_grab',    name: 'OJK Spot Check ID',           type: 'regulatory',leadAuditor: 'OJK',           daysOpen: 15,  closed: false, daysClosed: null, scope: 'GrabPay Indonesia', frameworkId: 'ojk-1103' },
  { tenantId: 't_grab',    name: 'RBI Cyber Audit India',       type: 'regulatory',leadAuditor: 'RBI',           daysOpen: 22,  closed: false, daysClosed: null, scope: 'Grab India platform', frameworkId: 'rbi-cyber' },
  { tenantId: 't_grab',    name: 'BNM RMiT Malaysia',           type: 'regulatory',leadAuditor: 'BNM',           daysOpen: 12,  closed: false, daysClosed: null, scope: 'GrabPay Malaysia', frameworkId: 'bnm-rmit' },
  { tenantId: 't_grab',    name: 'PCI DSS 4.0 ROC',             type: 'external',  leadAuditor: 'Trustwave',     daysOpen: 80,  closed: true,  daysClosed: 15,   scope: 'CDE — all regions', frameworkId: 'pci-dss-4' },
  { tenantId: 't_grab',    name: 'Internal Cloud Audit',        type: 'internal',  leadAuditor: 'Internal Audit',daysOpen: 30,  closed: false, daysClosed: null, scope: 'AWS multi-region', frameworkId: 'iso-27001' },
  { tenantId: 't_grab',    name: 'EU AI Act Readiness',         type: 'internal',  leadAuditor: 'Model Risk',    daysOpen: 20,  closed: false, daysClosed: null, scope: 'High-risk AI inventory', frameworkId: 'eu-ai-act' },
  { tenantId: 't_grab',    name: 'Privacy — multi-jurisdiction',type: 'internal',  leadAuditor: 'DPO',           daysOpen: 40,  closed: true,  daysClosed: 10,   scope: 'PDPA / PIPL / GDPR', frameworkId: 'gdpr' },
  { tenantId: 't_grab',    name: 'Vendor Concentration Audit',  type: 'internal',  leadAuditor: 'Internal Audit',daysOpen: 25,  closed: true,  daysClosed: 8,    scope: 'Tier-1 vendor concentration', frameworkId: 'iso-27001' },
  // MINDEF — 4
  { tenantId: 't_mindef',  name: 'IM8 Compliance Audit',        type: 'regulatory',leadAuditor: 'GovTech',       daysOpen: 45,  closed: false, daysClosed: null, scope: 'IM8 v9.0 scope', frameworkId: 'im8' },
  { tenantId: 't_mindef',  name: 'ITSG-33 Sovereign Review',    type: 'internal',  leadAuditor: 'Internal Audit',daysOpen: 30,  closed: true,  daysClosed: 10,   scope: 'Sovereign cloud controls', frameworkId: 'nist-80053' },
  { tenantId: 't_mindef',  name: 'BCM Sovereign Test',          type: 'internal',  leadAuditor: 'BCM Team',      daysOpen: 60,  closed: true,  daysClosed: 20,   scope: 'Sovereign DR test', frameworkId: 'iso-22301' },
  { tenantId: 't_mindef',  name: 'ISO 27001 Sovereign',         type: 'external',  leadAuditor: 'BSI',           daysOpen: 120, closed: true,  daysClosed: 30,   scope: 'Sovereign ISMS scope', frameworkId: 'iso-27001' },
  // Shallow — one each
  { tenantId: 't_singhealth', name: 'HIPAA + ISO Internal',     type: 'internal',  leadAuditor: 'Internal Audit',daysOpen: 60, closed: true, daysClosed: 20, scope: 'Combined audit', frameworkId: 'iso-27001' },
  { tenantId: 't_govtech',    name: 'IM8 Audit',                type: 'regulatory',leadAuditor: 'GovTech',       daysOpen: 45, closed: false, daysClosed: null, scope: 'IM8 scope', frameworkId: 'im8' },
  { tenantId: 't_astar',      name: 'Research Data Audit',      type: 'internal',  leadAuditor: 'Internal Audit',daysOpen: 40, closed: true, daysClosed: 15, scope: 'Research data', frameworkId: 'iso-27001' },
  { tenantId: 't_mediacorp',  name: 'Privacy Audit',            type: 'internal',  leadAuditor: 'DPO',           daysOpen: 40, closed: true, daysClosed: 10, scope: 'PDPA', frameworkId: 'pdpa-sg' },
  { tenantId: 't_singtel',    name: 'SOC 2 + ISO',              type: 'external',  leadAuditor: 'EY',            daysOpen: 80, closed: true, daysClosed: 20, scope: 'Combined audit', frameworkId: 'soc2' }
];

export function auditsForTenant(tenantId: string): AuditEngagement[] {
  return ENGAGEMENT_SPECS
    .filter((s) => s.tenantId === tenantId)
    .map((s, i) => ({
      id: `eng_${tenantId}_${i}`,
      tenantId: s.tenantId,
      name: s.name,
      type: s.type,
      leadAuditor: s.leadAuditor,
      openedAt: new Date(Date.now() - s.daysOpen * 86_400_000).toISOString(),
      closedAt: s.closed && s.daysClosed != null ? new Date(Date.now() - s.daysClosed * 86_400_000).toISOString() : undefined,
      scope: s.scope,
      frameworkId: s.frameworkId
    }));
}

const FINDING_TITLES = [
  'Privileged access review evidence stale (>120d)',
  'KMS key rotation overdue on prod buckets',
  'IAM policies overly permissive on prod role',
  'Branch protection disabled on critical repos',
  'No segregation of duties in payment release',
  'Tabletop exercise lessons not actioned',
  'Vendor SOC 2 missing for 4 Tier-1 vendors',
  'Logging gap on internal CRM',
  'Backup restore not tested in 9 months',
  'Privacy DPIA missing for new AI assistant'
];

const FINDING_SEVERITIES: RiskSeverity[] = ['high','high','medium','medium','medium','low','critical'];
const FINDING_STATUSES: FindingStatus[] = ['open','open','open','closed','accepted-risk'];

export function auditFindings(engagementId: string): AuditFinding[] {
  const rng = mulberry32(hashStringToInt(`findings:${engagementId}`));
  const parts = engagementId.split('_');
  const tenantId = `${parts[1]}_${parts[2]}`;
  const findingCount = { t_maybank: 7, t_grab: 6, t_mindef: 4 }[tenantId] ?? 2;
  const out: AuditFinding[] = [];
  for (let g = 1; g <= findingCount; g++) {
    out.push({
      id: `fnd_${engagementId}_${g}`,
      tenantId,
      engagementId,
      severity: FINDING_SEVERITIES[g % FINDING_SEVERITIES.length],
      title: FINDING_TITLES[g % FINDING_TITLES.length],
      description: 'Auto-seeded finding. Owner accountable; remediation tracked via issue.',
      dueAt: new Date(Date.now() + (30 + g * 7) * 86_400_000).toISOString(),
      status: FINDING_STATUSES[g % FINDING_STATUSES.length]
    });
    void rng;
  }
  return out;
}
