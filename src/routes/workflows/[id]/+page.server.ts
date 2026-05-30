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

  // Load approval decisions for all running executions so the UI can show pending steps.
  let decidedApprovals: { executionId: string; stepNo: number; approved: boolean }[] = [];
  if (isPgMode()) {
    const runningIds = executions.filter((e) => e.status === 'running').map((e) => e.id);
    if (runningIds.length > 0) {
      const pool = getPool();
      const { rows } = await pool.query<{ execution_id: string; step_no: number; approved: boolean }>(
        `SELECT execution_id::text, step_no, approved
         FROM workflow.approvals
         WHERE execution_id = ANY($1::bigint[])`,
        [runningIds]
      ).catch(() => ({ rows: [] as never[] }));
      decidedApprovals = rows.map((r) => ({ executionId: r.execution_id, stepNo: r.step_no, approved: r.approved }));
    }
  }

  return { workflow, executions, decidedApprovals };
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

  approveStep: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { approveError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { approveError: 'Requires Postgres mode' });

    const fd = await request.formData();
    const executionId = Number(fd.get('executionId'));
    const stepNo = Number(fd.get('stepNo'));
    const approved = fd.get('approved') === 'true';

    if (!Number.isInteger(executionId) || executionId <= 0) return fail(400, { approveError: 'Invalid execution ID' });
    if (!Number.isInteger(stepNo) || stepNo < 0) return fail(400, { approveError: 'Invalid step number' });

    const pool = getPool();

    // Verify the execution belongs to this tenant and is still running.
    const { rows: exec } = await pool.query<{ id: string; status: string; tenant_id: string }>(
      `SELECT id::text, status, tenant_id FROM workflow.executions WHERE id = $1 LIMIT 1`,
      [executionId]
    );
    if (!exec.length) return fail(404, { approveError: 'Execution not found' });
    if (exec[0].tenant_id !== locals.user.tenantId) return fail(403, { approveError: 'Access denied' });
    if (exec[0].status !== 'running') return fail(409, { approveError: `Execution is not running (status: ${exec[0].status})` });

    // Prevent duplicate decisions for the same step.
    const { rows: existing } = await pool.query(
      `SELECT id FROM workflow.approvals WHERE execution_id = $1 AND step_no = $2 LIMIT 1`,
      [executionId, stepNo]
    );
    if (existing.length) return fail(409, { approveError: `Step ${stepNo} has already been decided` });

    const { rows: approval } = await pool.query<{ id: string }>(
      `INSERT INTO workflow.approvals
         (tenant_id, execution_id, step_no, approver_user_id, approved, decided_at)
       VALUES ($1, $2, $3, $4::uuid, $5, now())
       RETURNING id::text`,
      [locals.user.tenantId, executionId, stepNo, locals.user.id, approved]
    );

    if (!approved) {
      await pool.query(
        `UPDATE workflow.executions SET status = 'halted'::workflow.execution_status, ended_at = now() WHERE id = $1`,
        [executionId]
      );
    }

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: approved ? 'workflow.step.approved' : 'workflow.step.rejected',
      target: `execution:${executionId}:step:${stepNo}`,
      result: 'success',
      metadata: { approvalId: approval[0].id, workflowId: params.id, stepNo }
    });

    return { approveSuccess: true, executionId, stepNo, approved };
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
