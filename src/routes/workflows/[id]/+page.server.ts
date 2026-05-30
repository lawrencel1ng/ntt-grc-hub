// =====================================================================
//  /workflows/[id] — Workflow detail with visual diagram. Tenant id is
//  encoded in the workflow id (wf_<tenant>_<n>), matching the dispatcher's
//  decoding convention.
// =====================================================================

import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getWorkflow, getWorkflowExecutions } from '$lib/server/data';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ params }) => {
  const workflow = await getWorkflow(params.id);
  if (!workflow) throw error(404, 'Workflow not found');

  const allExecs = await getWorkflowExecutions(workflow.tenantId, 100);
  const executions = allExecs.filter((x) => x.workflowId === workflow.id);
  return { workflow, executions };
};

export const actions: Actions = {
  toggleEnabled: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { toggleError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { toggleError: 'Requires Postgres mode' });

    const data = await request.formData();
    const enabled = data.get('enabled') === 'true';

    const pool = getPool();
    const { rowCount } = await pool.query(
      `UPDATE workflow.definitions SET enabled = $1
       WHERE id = $2::uuid AND tenant_id = $3`,
      [enabled, params.id, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { toggleError: 'Workflow not found or access denied' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: enabled ? 'workflow.enabled' : 'workflow.disabled',
      target: `workflow:${params.id}`,
      result: 'success'
    });

    return { toggled: true, enabled };
  }
};
