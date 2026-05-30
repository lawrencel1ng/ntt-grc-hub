import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getWorkflows, getWorkflowExecutions } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const isAll = tenantId === ALL_TENANTS_ID;
  const effective = isAll ? undefined : tenantId;
  const [workflows, executions] = await Promise.all([
    getWorkflows(effective),
    getWorkflowExecutions(effective, 40)
  ]);
  return { workflows, executions, isAll };
};

export const actions: Actions = {
  createWorkflow: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { workflowError: 'Not authenticated.' });
    if (!isPgMode()) return fail(400, { workflowError: 'Requires Postgres mode.' });

    const data = await request.formData();
    const name = String(data.get('name') ?? '').trim();
    const description = String(data.get('description') ?? '').trim() || null;

    if (!name) return fail(400, { workflowError: 'Workflow name is required.' });
    if (name.length > 256) return fail(400, { workflowError: 'Workflow name must be 256 characters or fewer.' });
    if (description && description.length > 2048) return fail(400, { workflowError: 'Description must be 2 048 characters or fewer.' });

    const pool = getPool();
    await pool.query(
      `INSERT INTO workflow.definitions (tenant_id, name, description, steps, last_modified_by)
       VALUES ($1, $2, $3, '[]'::jsonb, $4)`,
      [locals.user.tenantId, name, description, locals.user.id]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'workflow.created',
      target: `workflow:${name}`,
      result: 'success'
    });

    return { workflowCreated: true, workflowName: name };
  }
};
