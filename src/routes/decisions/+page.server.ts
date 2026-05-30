// =====================================================================
//  /decisions — Global agent-decisions feed. We pull a generous 500-row
//  window so the front-end can offer paging + outcome filtering without
//  more server round trips.
// =====================================================================

import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getAgents, getAgentDecisions } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const scoped = tenantId === ALL_TENANTS_ID ? undefined : tenantId;

  const [agents, decisions] = await Promise.all([
    getAgents(),
    getAgentDecisions({ tenantId: scoped, limit: 500 })
  ]);

  return { agents, decisions };
};

export const actions: Actions = {
  resolveDecision: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { decisionError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { decisionError: 'Requires Postgres mode' });

    const data = await request.formData();
    const decisionId = String(data.get('decisionId') ?? '').trim();
    const approve = data.get('approve') === 'true';

    if (!decisionId || isNaN(Number(decisionId))) return fail(400, { decisionError: 'Invalid decision ID' });

    const pool = getPool();
    const newOutcome = approve ? 'hitl-approved' : 'hitl-rejected';

    const { rowCount } = await pool.query(
      `UPDATE agent.decisions
       SET outcome = $1::agent.decision_outcome,
           approver_user_id = $2,
           decided_at = now()
       WHERE id = $3::bigint
         AND tenant_id = $4
         AND outcome = 'awaiting-hitl'`,
      [newOutcome, locals.user.id, decisionId, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { decisionError: 'Decision not found, not awaiting HITL, or access denied' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: approve ? 'agent.decision.hitl_approved' : 'agent.decision.hitl_rejected',
      target: `decision:${decisionId}`,
      result: 'success'
    });

    return { resolved: true, decisionId, newOutcome };
  }
};
