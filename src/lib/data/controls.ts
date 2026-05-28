import type { Control, ControlTestRun, ControlType, ControlMaturity, ControlTestResult } from './types';
import { TENANT_PROFILES } from './tenants';
import { hashStringToInt, mulberry32 } from './rng';

const TITLES = [
  'MFA enforced on all admin accounts',         'Encryption at rest using KMS',
  'Encryption in transit (TLS 1.2+)',           'Quarterly privileged access review',
  'Vulnerability scanning weekly',              'Patch SLA 30 days for criticals',
  'Centralised audit logging',                  'Backup tested quarterly',
  'Change approval gate in CI/CD',              'Anti-malware on endpoints',
  'Network segmentation between tiers',         'Data classification labels enforced',
  'Subject-request workflow within 30 days',    'Vendor SOC 2 review on onboarding',
  'Joiner/mover/leaver process',                'Time-bound break-glass access',
  'Secrets rotated every 90 days',              'PII tokenisation in non-prod',
  'Public-bucket detection blocks deployment',  'Identity federation via Okta',
  'IAM root account locked & monitored',        'Cloud config drift alarm',
  'Penetration test annually',                  'Tabletop BCM exercise twice a year',
  'Threat intel feed integration',              'Privileged session recording',
  'Container image vulnerability scan',         'Infrastructure-as-Code policy gate',
  'Data loss prevention on email',              'Mobile device management'
];

const FAMILIES: string[][] = [
  ['access-control', 'identity'],
  ['cryptography', 'data'],
  ['network', 'segmentation'],
  ['logging', 'monitoring'],
  ['vulnerability', 'patch'],
  ['change-management'],
  ['privacy', 'data'],
  ['third-party', 'vendor'],
  ['bcm', 'resilience'],
  ['ai', 'model-risk']
];

const TYPES: ControlType[] = ['technical', 'technical', 'technical', 'process', 'process', 'admin'];
const FREQUENCIES = ['continuous', 'daily', 'weekly', 'monthly', 'quarterly', 'annual'];
const MATURITY: ControlMaturity[] = ['defined', 'managed', 'managed', 'optimised', 'developing', 'defined'];

export function controlsForTenant(tenantId: string): Control[] {
  const profile = TENANT_PROFILES[tenantId];
  if (!profile) return [];
  // For perf in mock mode we cap the visible rows; the DB-backed
  // dispatcher will return all 1200 when wired up via SQL.
  const cap = Math.min(profile.controlCount, 250);
  const prefix = tenantId.substring(2, 6).toUpperCase();
  const out: Control[] = [];
  for (let g = 1; g <= cap; g++) {
    out.push({
      id: `ctl_${tenantId}_${String(g).padStart(5, '0')}`,
      tenantId,
      code: `${prefix}-CTL-${String(g).padStart(5, '0')}`,
      title: TITLES[g % TITLES.length],
      description: 'Auto-seeded control description. Owner accountable; evidence captured by Evidence Collector agent.',
      type: TYPES[g % TYPES.length],
      family: FAMILIES[g % FAMILIES.length],
      frequency: FREQUENCIES[g % FREQUENCIES.length],
      automated: g % 3 === 0,
      maturity: MATURITY[g % MATURITY.length]
    });
  }
  return out;
}

const TEST_RESULTS: ControlTestResult[] = ['pass','pass','pass','pass','pass','pass','pass','partial','fail','na'];

export function recentControlTestRuns(tenantId: string, limit: number): ControlTestRun[] {
  const controls = controlsForTenant(tenantId);
  if (!controls.length) return [];
  const rng = mulberry32(hashStringToInt(`testruns:${tenantId}`));
  const out: ControlTestRun[] = [];
  let id = 50_000;
  for (let i = 0; i < limit; i++) {
    const c = controls[Math.floor(rng() * controls.length)];
    out.push({
      id: id++,
      tenantId,
      controlId: c.id,
      controlCode: c.code,
      controlTitle: c.title,
      ranAt: new Date(Date.now() - Math.floor(rng() * 30 * 86_400_000)).toISOString(),
      result: TEST_RESULTS[Math.floor(rng() * TEST_RESULTS.length)],
      durationMs: 120 + Math.floor(rng() * 12_000),
      notes: 'Auto-seeded test run.'
    });
  }
  // Inject hero failing AWS encryption test runs for Maybank — matches seed §35.3.
  if (tenantId === 't_maybank') {
    const encCtrls = controls.filter((c) => /encryption|KMS/i.test(c.title)).slice(0, 3);
    for (let i = 0; i < encCtrls.length; i++) {
      out.unshift({
        id: id++,
        tenantId,
        controlId: encCtrls[i].id,
        controlCode: encCtrls[i].code,
        controlTitle: encCtrls[i].title,
        ranAt: new Date(Date.now() - (i + 1) * 12 * 60 * 1000).toISOString(),
        result: 'fail',
        durationMs: 280 + Math.floor(rng() * 800),
        notes: 'HERO — AWS encryption control failed: KMS rotation not enforced on production buckets.'
      });
    }
  }
  return out.sort((a, b) => (a.ranAt < b.ranAt ? 1 : -1));
}

export function getControlById(controlId: string): Control | undefined {
  // The id encodes tenant; cheap lookup.
  const parts = controlId.split('_');
  if (parts.length < 3) return undefined;
  const tid = `${parts[1]}_${parts[2]}`;
  return controlsForTenant(tid).find((c) => c.id === controlId);
}
