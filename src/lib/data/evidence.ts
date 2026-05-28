import type { EvidenceItem, EvidenceKind } from './types';
import { TENANT_PROFILES } from './tenants';
import { hashStringToInt, mulberry32 } from './rng';
import { rowHash } from '../utils/hash-chain';

const TITLES = [
  'AWS S3 bucket policy snapshot',         'Okta MFA enrolment report',
  'GitHub branch protection config',       'Azure NSG rule export',
  'Jira change ticket — approved',         'CrowdStrike agent inventory',
  'AWS Config compliance summary',         'KMS key rotation event',
  'IAM access review — quarterly',         'M365 conditional access report',
  'PCI ASV scan result',                   'Endpoint patch report',
  'Backup restore test result',            'DLP policy hit summary',
  'Tabletop exercise minutes',             'SOC 2 vendor attestation',
  'Penetration test exec summary',         'Threat intel digest',
  'BCP test report',                       'Privacy impact assessment'
];

const KINDS: EvidenceKind[] = ['screenshot','log','config','attestation','document','scan-result','api-response'];
const COLLECTOR_KINDS = ['aws','azure','gcp','okta','jira','m365','github','servicenow','slack','manual'];

export function evidenceForTenant(tenantId: string, limit?: number): EvidenceItem[] {
  const profile = TENANT_PROFILES[tenantId];
  if (!profile) return [];
  // Cap visible rows in mock mode to keep page loads snappy.
  const total = Math.min(profile.evidenceCount, limit ?? 200);
  const rng = mulberry32(hashStringToInt(`evidence:${tenantId}`));
  const out: EvidenceItem[] = [];
  let prev: string | null = null;
  for (let g = 1; g <= total; g++) {
    const captured = new Date(Date.now() - Math.floor(rng() * 90 * 86_400_000)).toISOString();
    const collectorKind = COLLECTOR_KINDS[g % COLLECTOR_KINDS.length];
    const item: EvidenceItem = {
      id: hashStringToInt(`${tenantId}:${g}`),
      tenantId,
      collectorId: `col_${tenantId}_${collectorKind}`,
      kind: KINDS[g % KINDS.length],
      title: `${TITLES[g % TITLES.length]} #${g}`,
      sourceUrl: `https://evidence.example.sg/${tenantId}/${g}`,
      blobUrl: `s3://grc-evidence/${tenantId}/${g}.bin`,
      capturedAt: captured,
      metadata: { source: 'seed', batch: g % 50, idx: g }
    };
    const hash = rowHash(prev, { tenantId, id: item.id, title: item.title });
    item.prevHash = prev ?? undefined;
    item.rowHash = hash;
    prev = hash;
    out.push(item);
  }
  // Hero for Maybank: 47 fresh items in last hour. Matches seed §35.4.
  if (tenantId === 't_maybank') {
    for (let g = 1; g <= 47; g++) {
      const captured = new Date(Date.now() - g * 78 * 1000).toISOString();
      const item: EvidenceItem = {
        id: 9_000_000 + g,
        tenantId,
        collectorId: 'col_t_maybank_aws',
        kind: (['config','log','api-response','scan-result'] as EvidenceKind[])[g % 4],
        title: `HERO — Evidence ${g} (AWS, last hour)`,
        sourceUrl: `https://evidence.example.sg/t_maybank/hero/${g}`,
        blobUrl: `s3://grc-evidence/t_maybank/hero/${g}.bin`,
        capturedAt: captured,
        metadata: { hero: true, idx: g }
      };
      const hash = rowHash(prev, { tenantId, id: item.id, title: item.title });
      item.prevHash = prev ?? undefined;
      item.rowHash = hash;
      prev = hash;
      out.unshift(item);
    }
  }
  return out.sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
}

export function evidenceCount24h(tenantId: string): number {
  const profile = TENANT_PROFILES[tenantId];
  if (!profile) return 0;
  // Rough estimate: total/90 per day, plus hero injection for Maybank.
  const base = Math.round(profile.evidenceCount / 90);
  return tenantId === 't_maybank' ? base + 47 : base;
}

export function evidenceHashChainOk(tenantId: string): { ok: boolean; total: number } {
  const items = evidenceForTenant(tenantId);
  // The chain is computed at generation, so it's always intact by
  // construction. The shape mirrors the dispatcher API.
  return { ok: true, total: items.length };
}
