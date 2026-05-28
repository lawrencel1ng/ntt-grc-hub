import type { Policy, PolicyVersion } from './types';
import { TENANT_PROFILES } from './tenants';

const POLICY_TITLES = [
  'Information Security Policy',         'Acceptable Use Policy',
  'Access Control Policy',               'Cryptography Policy',
  'Incident Response Policy',            'Business Continuity Policy',
  'Vendor Risk Management Policy',       'Privacy Policy',
  'AI Governance Policy',                'Data Classification Policy',
  'Change Management Policy',            'Vulnerability Management Policy',
  'Logging & Monitoring Policy',         'Backup & Recovery Policy',
  'Cloud Security Policy',               'Mobile Device Policy',
  'Outsourcing Policy (MAS 655)',        'ESG Reporting Policy'
];

export function policiesForTenant(tenantId: string): Policy[] {
  const profile = TENANT_PROFILES[tenantId];
  if (!profile) return [];
  const n = profile.policyCount;
  const prefix = tenantId.substring(2, 6).toUpperCase();
  const out: Policy[] = [];
  for (let g = 1; g <= n; g++) {
    const docId = `pol_${tenantId}_${g}`;
    out.push({
      id: docId,
      tenantId,
      code: `${prefix}-POL-${String(g).padStart(3, '0')}`,
      title: POLICY_TITLES[(g - 1) % POLICY_TITLES.length],
      jurisdiction: tenantId === 't_grab' ? 'APAC' : 'SG',
      currentVersionId: `${docId}_v2`,
      status: 'approved'
    });
  }
  return out;
}

export function policyVersions(policyId: string): PolicyVersion[] {
  const parts = policyId.split('_');
  if (parts.length < 4) return [];
  const tenantId = `${parts[1]}_${parts[2]}`;
  const policy = policiesForTenant(tenantId).find((p) => p.id === policyId);
  if (!policy) return [];
  return [
    {
      id: `${policyId}_v1`,
      tenantId,
      documentId: policyId,
      versionNo: 'v1',
      contentMd: `# ${policy.title}\n\nVersion v1 — auto-seeded content.\n\n## Scope\n\nApplies to all in-scope systems and personnel.`,
      status: 'retired',
      effectiveAt: new Date(Date.now() - 365 * 86_400_000).toISOString()
    },
    {
      id: `${policyId}_v2`,
      tenantId,
      documentId: policyId,
      versionNo: 'v2',
      contentMd: `# ${policy.title}\n\nVersion v2 — auto-seeded content. Revised after the most recent framework refresh.\n\n## Scope\n\nApplies to all in-scope systems and personnel.\n\n## Roles & responsibilities\n\nOwner is the policy office; control owners execute.`,
      status: 'approved',
      effectiveAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      draftedByAgentId: policy.title.includes('Outsourcing') ? 'ag_policy' : undefined
    }
  ];
}

/** Return % acks for a policy version. Maybank/Grab/MINDEF have ~25%. */
export function policyAcksRate(policyId: string): number {
  const parts = policyId.split('_');
  if (parts.length < 4) return 0;
  const tenantId = `${parts[1]}_${parts[2]}`;
  return ['t_maybank','t_grab','t_mindef'].includes(tenantId) ? 0.78 : 0.92;
}
