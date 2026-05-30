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

export const load: PageServerLoad = async ({ params, locals }) => {
  const workflow = await getWorkflow(params.id);
  if (!workflow) throw error(404, 'Workflow not found');
  if (locals.user && workflow.tenantId !== locals.user.tenantId && locals.user.tenantId !== '__all__') {
    throw error(403, 'Access denied');
  }

  const executions = await getWorkflowExecutions(workflow.tenantId, 100, workflow.id);
  return { workflow, executions };
};

export const actions: Actions = {
  updateWorkflow: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { editError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { editError: 'Requires Postgres mode' });

    const fd = await request.formData();
    const name = String(fd.get('name') ?? '').trim();
    const description = String(fd.get('description') ?? '').trim() || null;

    if (!name) return fail(400, { editError: 'Name is required.' });
    if (name.length > 256) return fail(400, { editError: 'Name must be 256 characters or fewer.' });
    if (description && description.length > 2048) return fail(400, { editError: 'Description must be 2048 characters or fewer.' });

    const pool = getPool();
    const { rowCount } = await pool.query(
      `UPDATE workflow.definitions SET name = $1, description = $2
       WHERE id = $3::uuid AND tenant_id = $4`,
      [name, description, params.id, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { editError: 'Workflow not found or access denied.' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'workflow.updated',
      target: `workflow:${params.id}`,
      result: 'success',
      metadata: { name }
    });

    return { editSuccess: true };
  },

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
