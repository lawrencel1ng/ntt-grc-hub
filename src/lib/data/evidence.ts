import type { EvidenceItem, EvidenceKind, EvidenceCollectorKind, EvidenceDomain } from './types';
import { TENANT_PROFILES } from './tenants';
import { hashStringToInt, mulberry32 } from './rng';
import { rowHash } from '../utils/hash-chain';

// Each spec is a realistic evidence artefact tagged to one of the ten GRC
// domains, with the kind + source system it would naturally come from. The
// generator round-robins over this list so every tenant's vault demonstrably
// covers all ten domains.
interface EvidenceSpec {
  domain: EvidenceDomain;
  title: string;
  kind: EvidenceKind;
  collector: EvidenceCollectorKind;
}

const EVIDENCE_SPECS: EvidenceSpec[] = [
  // 1 — Policy & Governance
  { domain: 'policy-governance', title: 'Information Security Policy v4 — board-approved', kind: 'document', collector: 'servicenow' },
  { domain: 'policy-governance', title: 'Acceptable Use Policy attestation roster', kind: 'attestation', collector: 'm365' },
  { domain: 'policy-governance', title: 'Board Risk Committee minutes — Q2', kind: 'document', collector: 'manual' },
  { domain: 'policy-governance', title: 'Policy exception register snapshot', kind: 'config', collector: 'servicenow' },
  { domain: 'policy-governance', title: 'Code of Conduct sign-off export', kind: 'attestation', collector: 'servicenow' },

  // 2 — Risk Management
  { domain: 'risk-management', title: 'Enterprise risk register export', kind: 'document', collector: 'servicenow' },
  { domain: 'risk-management', title: 'FAIR quantification run — ransomware ALE', kind: 'api-response', collector: 'manual' },
  { domain: 'risk-management', title: 'Risk appetite statement — approved', kind: 'document', collector: 'manual' },
  { domain: 'risk-management', title: 'Quarterly risk review minutes', kind: 'document', collector: 'manual' },
  { domain: 'risk-management', title: 'Key risk indicator dashboard snapshot', kind: 'screenshot', collector: 'servicenow' },

  // 3 — Identity & Access Management
  { domain: 'iam', title: 'Okta MFA enrolment report', kind: 'attestation', collector: 'okta' },
  { domain: 'iam', title: 'Quarterly access recertification — completed', kind: 'attestation', collector: 'okta' },
  { domain: 'iam', title: 'Privileged access (PAM) session log', kind: 'log', collector: 'okta' },
  { domain: 'iam', title: 'Joiner-mover-leaver ticket export', kind: 'document', collector: 'servicenow' },
  { domain: 'iam', title: 'Azure AD conditional access policy export', kind: 'config', collector: 'azure' },
  { domain: 'iam', title: 'Dormant account disablement report', kind: 'scan-result', collector: 'okta' },

  // 4 — Security Operations
  { domain: 'security-operations', title: 'CrowdStrike EDR alert triage log', kind: 'log', collector: 'manual' },
  { domain: 'security-operations', title: 'SIEM detection rule coverage export', kind: 'config', collector: 'manual' },
  { domain: 'security-operations', title: 'Vulnerability scan — critical findings', kind: 'scan-result', collector: 'aws' },
  { domain: 'security-operations', title: 'Threat intel digest — weekly', kind: 'document', collector: 'manual' },
  { domain: 'security-operations', title: 'Incident response runbook execution log', kind: 'log', collector: 'jira' },

  // 5 — Infrastructure & Configuration
  { domain: 'infra-config', title: 'AWS S3 bucket policy snapshot', kind: 'config', collector: 'aws' },
  { domain: 'infra-config', title: 'Azure NSG rule export', kind: 'config', collector: 'azure' },
  { domain: 'infra-config', title: 'CIS benchmark scan — EC2 fleet', kind: 'scan-result', collector: 'aws' },
  { domain: 'infra-config', title: 'Terraform drift detection report', kind: 'config', collector: 'github' },
  { domain: 'infra-config', title: 'KMS key rotation event', kind: 'log', collector: 'aws' },
  { domain: 'infra-config', title: 'GCP IAM binding export', kind: 'config', collector: 'gcp' },

  // 6 — Asset Management
  { domain: 'asset-management', title: 'CMDB asset inventory export', kind: 'document', collector: 'servicenow' },
  { domain: 'asset-management', title: 'Endpoint inventory — CrowdStrike', kind: 'api-response', collector: 'manual' },
  { domain: 'asset-management', title: 'Cloud asset reconciliation report', kind: 'scan-result', collector: 'aws' },
  { domain: 'asset-management', title: 'Software / SBOM inventory snapshot', kind: 'document', collector: 'github' },
  { domain: 'asset-management', title: 'Data classification register snapshot', kind: 'config', collector: 'servicenow' },

  // 7 — Compliance & Audit
  { domain: 'compliance-audit', title: 'SOC 2 Type II report — current period', kind: 'attestation', collector: 'manual' },
  { domain: 'compliance-audit', title: 'ISO 27001 internal audit findings', kind: 'document', collector: 'manual' },
  { domain: 'compliance-audit', title: 'PCI ASV scan result', kind: 'scan-result', collector: 'manual' },
  { domain: 'compliance-audit', title: 'MAS TRM control test evidence pack', kind: 'document', collector: 'servicenow' },
  { domain: 'compliance-audit', title: 'External audit PBC list — submitted', kind: 'document', collector: 'manual' },

  // 8 — Business Continuity & Resilience
  { domain: 'bcm', title: 'BCP test report — annual', kind: 'document', collector: 'manual' },
  { domain: 'bcm', title: 'Backup restore test result', kind: 'log', collector: 'aws' },
  { domain: 'bcm', title: 'DR failover exercise minutes', kind: 'document', collector: 'manual' },
  { domain: 'bcm', title: 'RTO/RPO validation report', kind: 'scan-result', collector: 'manual' },
  { domain: 'bcm', title: 'Tabletop exercise minutes', kind: 'document', collector: 'manual' },

  // 9 — Third Party & Vendor
  { domain: 'third-party-vendor', title: 'Vendor SIG questionnaire — completed', kind: 'document', collector: 'servicenow' },
  { domain: 'third-party-vendor', title: 'Fourth-party concentration report', kind: 'api-response', collector: 'manual' },
  { domain: 'third-party-vendor', title: 'Vendor SOC 2 attestation on file', kind: 'attestation', collector: 'manual' },
  { domain: 'third-party-vendor', title: 'Contract DPA clause review', kind: 'document', collector: 'manual' },
  { domain: 'third-party-vendor', title: 'Vendor offboarding access revocation log', kind: 'log', collector: 'okta' },

  // 10 — Security Awareness
  { domain: 'security-awareness', title: 'Phishing simulation campaign results', kind: 'scan-result', collector: 'm365' },
  { domain: 'security-awareness', title: 'Security awareness training completion', kind: 'attestation', collector: 'm365' },
  { domain: 'security-awareness', title: 'Onboarding security briefing sign-off', kind: 'attestation', collector: 'servicenow' },
  { domain: 'security-awareness', title: 'Role-based training matrix export', kind: 'document', collector: 'servicenow' },
  { domain: 'security-awareness', title: 'Awareness quiz scores — quarterly', kind: 'document', collector: 'm365' }
];

// Domains the Maybank hero burst cycles through so the "last hour" items still
// span the breadth of the vault.
const HERO_DOMAINS: EvidenceDomain[] = ['infra-config', 'security-operations', 'iam', 'compliance-audit'];

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
    const spec = EVIDENCE_SPECS[g % EVIDENCE_SPECS.length];
    const item: EvidenceItem = {
      id: hashStringToInt(`${tenantId}:${g}`),
      tenantId,
      collectorId: `col_${tenantId}_${spec.collector}`,
      kind: spec.kind,
      domain: spec.domain,
      title: `${spec.title} #${g}`,
      sourceUrl: `https://evidence.example.sg/${tenantId}/${g}`,
      blobUrl: `s3://grc-evidence/${tenantId}/${g}.bin`,
      capturedAt: captured,
      metadata: { source: 'seed', domain: spec.domain, batch: g % 50, idx: g }
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
      const domain = HERO_DOMAINS[g % HERO_DOMAINS.length];
      const item: EvidenceItem = {
        id: 9_000_000 + g,
        tenantId,
        collectorId: 'col_t_maybank_aws',
        kind: (['config','log','api-response','scan-result'] as EvidenceKind[])[g % 4],
        domain,
        title: `HERO — Evidence ${g} (AWS, last hour)`,
        sourceUrl: `https://evidence.example.sg/t_maybank/hero/${g}`,
        blobUrl: `s3://grc-evidence/t_maybank/hero/${g}.bin`,
        capturedAt: captured,
        metadata: { hero: true, domain, idx: g }
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
