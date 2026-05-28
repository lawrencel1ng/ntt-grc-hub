import type { Risk, RiskSeverity, RiskLikelihood, FAIRRun, FAIRScenario, AppetiteStatement, HeatmapCell } from './types';
import { TENANT_PROFILES } from './tenants';
import { hashStringToInt, mulberry32, pick } from './rng';

const RISK_TITLES = [
  'Ransomware on customer-facing systems',           'Insider data exfiltration',
  'Third-party cloud concentration risk',            'Regulatory non-compliance — MAS Notice 655',
  'Cross-border data transfer breach',               'Privileged account misuse',
  'AI model bias in credit scoring',                 'Hallucination in AI customer assistant',
  'Vendor SaaS supplier insolvency',                 'Patch backlog on internet-facing servers',
  'Misconfigured cloud storage exposing PII',        'Key staff attrition (CISO office)',
  'Phishing-led credential compromise',              'Loss of primary datacentre',
  'Cyber attack on payment gateway',                 'Lack of segregation of duties in payments',
  'Inadequate logging on critical systems',          'BCM plan stale (>12 months)',
  'Privacy: subject request SLA breach',             'Encryption key rotation overdue',
  'Compromise of CI/CD pipeline',                    'Quantum-vulnerable cryptography in flight',
  'Open-source dependency vulnerability',            'Excessive cloud admin entitlements',
  'Concentration risk on AWS ap-southeast-1',        'Inadequate vendor exit plan',
  'Anti-money-laundering rule gap',                  'Cross-jurisdiction conflict (PIPL vs GDPR)',
  'Climate transition risk in lending book',         'ESG disclosure misstatement risk',
  'Lack of monitoring on shadow IT',                 'Inadequate IAM joiner/mover/leaver process',
  'Outdated DR runbook for Tier-1 service',          'Insufficient red-team coverage',
  'Manual control fatigue / drift',                  'Regulator change unmonitored',
  'Sanctions screening false-negative',              'Trade surveillance gap',
  'Model risk not registered (shadow AI)',           'Customer data retention overrun'
] as const;

const CATEGORIES = ['cyber','technology','third-party','regulatory','financial','operational','people','privacy','ai','climate'] as const;
const SEVERITIES_INHERENT: RiskSeverity[] = ['critical','high','high','high','medium','medium','medium','low'];
const SEVERITIES_RESIDUAL: RiskSeverity[] = ['high','high','medium','medium','medium','low','low','info','critical'];
const LIKELIHOOD_INHERENT: RiskLikelihood[] = ['likely','possible','possible','likely','almost-certain','unlikely','possible','rare'];
const LIKELIHOOD_RESIDUAL: RiskLikelihood[] = ['possible','possible','unlikely','possible','rare','possible','unlikely','rare','likely'];
const STATUSES = ['identified','assessed','treated','monitoring','assessed','treated'] as const;
const TREATMENTS = ['mitigate','mitigate','mitigate','accept','transfer','mitigate','avoid'] as const;
const SERVICES = ['Core Banking','Payments','Trading','Retail','Wealth','Treasury','Lending','Onboarding','Mobile App','Internet Banking'] as const;

// Tenant ID prefix used for risk code suffix (first 4 chars after 't_').
function tenantCodePrefix(tid: string): string {
  return tid.substring(2, 6).toUpperCase();
}

export function risksForTenant(tenantId: string): Risk[] {
  const profile = TENANT_PROFILES[tenantId];
  if (!profile) return [];
  const rng = mulberry32(hashStringToInt(`risks:${tenantId}`));
  const out: Risk[] = [];
  const prefix = tenantCodePrefix(tenantId);
  for (let g = 1; g <= profile.riskCount; g++) {
    out.push({
      id: `risk_${tenantId}_${g}`,
      tenantId,
      registerId: `reg_${tenantId}`,
      code: `R-${prefix}-${String(g).padStart(4, '0')}`,
      title: `${RISK_TITLES[(g - 1) % RISK_TITLES.length]} #${g}`,
      description: 'Auto-generated demo risk for showcase. Inherent → residual scoring reflects mitigation maturity.',
      category: CATEGORIES[g % CATEGORIES.length],
      inherentSeverity: SEVERITIES_INHERENT[g % SEVERITIES_INHERENT.length],
      inherentLikelihood: LIKELIHOOD_INHERENT[g % LIKELIHOOD_INHERENT.length],
      residualSeverity: SEVERITIES_RESIDUAL[g % SEVERITIES_RESIDUAL.length],
      residualLikelihood: LIKELIHOOD_RESIDUAL[g % LIKELIHOOD_RESIDUAL.length],
      status: STATUSES[g % STATUSES.length],
      treatmentStrategy: TREATMENTS[g % TREATMENTS.length],
      lastAssessedAt: new Date(Date.now() - (g % 90) * 86_400_000).toISOString(),
      nextReviewAt: new Date(Date.now() + (30 + (g % 120)) * 86_400_000).toISOString(),
      businessService: SERVICES[g % SERVICES.length],
      tags: { source: 'seed', batch: g % 12 }
    });
  }
  // Inject hero risk for Maybank (matches seed §35.2) — placed at index 0.
  if (tenantId === 't_maybank') {
    out.unshift({
      id: 'risk_t_maybank_hero',
      tenantId,
      registerId: 'reg_t_maybank',
      code: 'R-MAYB-HERO',
      title: 'HERO — Cross-border outsourcing concentration risk',
      description: 'Concentration on Tier-1 cloud provider in single region creates regulatory and resilience exposure. Residual elevated after MAS Notice 655 update.',
      category: 'regulatory',
      inherentSeverity: 'critical',
      inherentLikelihood: 'likely',
      residualSeverity: 'high',
      residualLikelihood: 'possible',
      status: 'assessed',
      treatmentStrategy: 'mitigate',
      lastAssessedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      businessService: 'Core Banking',
      tags: { hero: true, elevated_in_last_24h: true }
    });
  }
  // Note: rng kept for parity with the seeded-jitter style — used later.
  void rng;
  return out;
}

// Compute residual-axis severity ranking for ordering "top risks".
const SEV_RANK: Record<RiskSeverity, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
const LIK_RANK: Record<RiskLikelihood, number> = { 'almost-certain': 5, likely: 4, possible: 3, unlikely: 2, rare: 1 };

export function riskScore(r: Risk): number {
  return SEV_RANK[r.residualSeverity] * LIK_RANK[r.residualLikelihood];
}

export function topRisks(tenantId: string | undefined, n: number): Risk[] {
  let pool: Risk[] = [];
  if (tenantId) {
    pool = risksForTenant(tenantId);
  } else {
    // MSSP rollup: collect from hero tenants only (shallow tenants too small to matter).
    for (const tid of ['t_maybank', 't_grab', 't_mindef']) {
      pool = pool.concat(risksForTenant(tid));
    }
  }
  return pool
    .slice()
    .sort((a, b) => riskScore(b) - riskScore(a))
    .slice(0, n);
}

export function heatmapCells(tenantId?: string): HeatmapCell[] {
  const pool = tenantId
    ? risksForTenant(tenantId)
    : (['t_maybank', 't_grab', 't_mindef'] as const).flatMap((tid) => risksForTenant(tid));
  const grid = new Map<string, number>();
  for (const r of pool) {
    const key = `${r.residualSeverity}|${r.residualLikelihood}`;
    grid.set(key, (grid.get(key) ?? 0) + 1);
  }
  const out: HeatmapCell[] = [];
  for (const [k, n] of grid.entries()) {
    const [sev, lik] = k.split('|') as [RiskSeverity, RiskLikelihood];
    out.push({ sev, lik, n });
  }
  return out;
}

// ---------------- FAIR scenarios + runs ----------------

const SCENARIO_NAMES = [
  'Ransomware on core banking',            'PII breach via misconfigured S3',
  'Insider trading misuse',                'Payments outage > 4h',
  'Vendor SaaS supplier failure',          'Cross-border transfer breach',
  'AI credit scoring bias claim',          'Cloud region outage',
  'AML rule failure',                      'Subject access request mass event',
  'CI/CD pipeline compromise',             'OSS supply chain compromise',
  'Datacentre loss',                       'Regulatory fine — MAS Notice 655',
  'Phishing-led credential theft',         'Quantum-decrypt of long-lived secrets',
  'API abuse (credential stuffing)',       'Insider data exfiltration',
  'DDoS on consumer portal',               'Wire fraud via BEC'
] as const;

export function fairScenariosForTenant(tenantId: string): FAIRScenario[] {
  const counts: Record<string, number> = { t_maybank: 20, t_grab: 20, t_mindef: 10 };
  const n = counts[tenantId] ?? 0;
  const rng = mulberry32(hashStringToInt(`scenarios:${tenantId}`));
  const out: FAIRScenario[] = [];
  for (let g = 1; g <= n; g++) {
    out.push({
      id: `scn_${tenantId}_${g}`,
      tenantId,
      riskId: `risk_${tenantId}_${g}`,
      name: `${SCENARIO_NAMES[(g - 1) % SCENARIO_NAMES.length]} (${tenantId} #${g})`,
      description: 'FAIR scenario auto-seeded. Frequency and magnitude calibrated to industry benchmarks.',
      frequencyDist: { kind: 'beta-pert', min: 0.1 + (g % 5) * 0.2, mode: 1.0 + (g % 7), max: 4.0 + (g % 9) },
      magnitudeDist: { kind: 'lognormal', mean: 200_000 + g * 18_000, stdev: 80_000 + g * 4_500 }
    });
    void rng;
  }
  // Hero scenario for Maybank — $4.2M ALE
  if (tenantId === 't_maybank') {
    out.unshift({
      id: 'scn_t_maybank_hero',
      tenantId,
      riskId: 'risk_t_maybank_hero',
      name: 'HERO — Cross-border outsourcing failure (MAS 655 trigger)',
      description: 'FAIR scenario aligned to MAS Notice 655 update. Loss = regulatory fine + remediation + reputational.',
      frequencyDist: { kind: 'beta-pert', min: 0.4, mode: 1.2, max: 3.6 },
      magnitudeDist: { kind: 'lognormal', mean: 2_200_000, stdev: 1_100_000 }
    });
  }
  return out;
}

export function fairRunForRisk(riskId: string): FAIRRun | null {
  // Hero: Maybank cross-border outsourcing risk ⇒ $4.2M ALE.
  if (riskId === 'risk_t_maybank_hero') {
    return {
      id: 'fair_t_maybank_hero',
      tenantId: 't_maybank',
      scenarioId: 'scn_t_maybank_hero',
      trials: 10_000,
      lecPercentiles: { p10: 380_000, p25: 1_100_000, p50: 2_200_000, p75: 4_800_000, p90: 8_200_000, p95: 12_400_000, p99: 24_000_000 },
      aleSgd: 4_200_000,
      aro: 1.7,
      runAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString()
    };
  }
  const rng = mulberry32(hashStringToInt(`fair:${riskId}`));
  return {
    id: `fair_${riskId}`,
    tenantId: riskId.split('_').slice(1, 3).join('_'),
    scenarioId: `scn_${riskId}`,
    trials: 10_000,
    lecPercentiles: {
      p10: Math.round(80_000 + rng() * 50_000),
      p25: Math.round(220_000 + rng() * 100_000),
      p50: Math.round(480_000 + rng() * 220_000),
      p75: Math.round(1_100_000 + rng() * 400_000),
      p90: Math.round(2_400_000 + rng() * 800_000),
      p95: Math.round(3_800_000 + rng() * 900_000),
      p99: Math.round(6_800_000 + rng() * 1_400_000)
    },
    aleSgd: Math.round(520_000 + rng() * 1_400_000),
    aro: +(0.4 + rng() * 4.2).toFixed(4),
    runAt: new Date(Date.now() - Math.floor(rng() * 45) * 86_400_000).toISOString()
  };
}

// ---------------- Appetite statements ----------------

const APPETITE_CATEGORIES = [
  { cat: 'cyber',       threshold: 5_000_000,  cap: 'high' as RiskSeverity },
  { cat: 'regulatory',  threshold: 1_000_000,  cap: 'high' as RiskSeverity },
  { cat: 'third-party', threshold: 2_000_000,  cap: 'high' as RiskSeverity },
  { cat: 'privacy',     threshold: 500_000,    cap: 'medium' as RiskSeverity },
  { cat: 'financial',   threshold: 10_000_000, cap: 'critical' as RiskSeverity }
];

export function appetiteStatementsForTenant(tenantId: string): AppetiteStatement[] {
  if (!['t_maybank', 't_mindef', 't_grab'].includes(tenantId)) return [];
  return APPETITE_CATEGORIES.map((s, i) => ({
    id: `app_${tenantId}_${i}`,
    tenantId,
    category: s.cat,
    statement: `No appetite for ${s.cat} incidents that exceed the stated threshold. Board-approved.`,
    thresholdSgd: s.threshold,
    severityCap: s.cap
  }));
}

// Keep the picker import live (used internally by other generators).
export const _samplePick = pick;
