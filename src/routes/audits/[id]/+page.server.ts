// =====================================================================
//  /audits/[id] — Engagement detail. Loads findings + evidence for the
//  Evidence Pack tab (which dramatises Audit Companion's 8-second
//  assembly time per the hero scenario).
// =====================================================================

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAudit, getAuditFindings, getEvidence } from '$lib/server/data';

export const load: PageServerLoad = async ({ params }) => {
  const audit = await getAudit(params.id);
  if (!audit) throw error(404, 'Engagement not found');

  const [findings, evidence] = await Promise.all([
    getAuditFindings(audit.id),
    getEvidence(audit.tenantId, 36)
  ]);

  return { audit, findings, evidence };
};
