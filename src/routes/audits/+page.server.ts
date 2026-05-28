// =====================================================================
//  /audits — Audit Management. We need findings counts per engagement so
//  the kanban cards can show the severity split; loaded in parallel.
// =====================================================================

import type { PageServerLoad } from './$types';
import { getAudits, getAuditFindings } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import type { AuditFinding } from '$lib/data/types';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? 't_maybank' : tenantId;
  const audits = await getAudits(effective);
  const pairs = await Promise.all(audits.map((a) => getAuditFindings(a.id).then((f) => ({ id: a.id, f }))));
  const findingsByAudit: Record<string, AuditFinding[]> = {};
  for (const p of pairs) findingsByAudit[p.id] = p.f;
  return { audits, findingsByAudit, isAll: tenantId === ALL_TENANTS_ID };
};
