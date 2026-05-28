// =====================================================================
//  /admin/settings — Profile + tenant settings page. Loader returns the
//  tenant list + a stubbed list of API tokens for the table.
// =====================================================================

import type { PageServerLoad } from './$types';
import { getTenantSummaries } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenants = await getTenantSummaries();
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? 't_maybank' : tenantId;
  const tenant = tenants.find((t) => t.id === effective);

  // ---------- Stubbed API tokens ----------
  const apiTokens = [
    { id: 'tok_1', name: 'Evidence Collector CI', scope: 'evidence:write', prefix: 'ntt_grc_', lastUsedAt: new Date(Date.now() - 12 * 60_000).toISOString(),  expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString() },
    { id: 'tok_2', name: 'Board Pack Exporter',   scope: 'report:read',    prefix: 'ntt_grc_', lastUsedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),  expiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString() },
    { id: 'tok_3', name: 'Auditor (external)',    scope: 'evidence:read',  prefix: 'ntt_grc_', lastUsedAt: new Date(Date.now() - 9 * 86_400_000).toISOString(), expiresAt: new Date(Date.now() + 180 * 86_400_000).toISOString() },
    { id: 'tok_4', name: 'Servicedesk webhook',   scope: 'issue:write',    prefix: 'ntt_grc_', lastUsedAt: new Date(Date.now() - 31 * 60_000).toISOString(),   expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString() }
  ];

  return { tenants, tenant, apiTokens };
};
