// =====================================================================
//  POST /api/workflows/executions/[execId]/approve
//  Record a step-level approval or rejection from an authorised user.
//  Accepts: { stepNo: number, approved: boolean, notes?: string }
//  Rejecting (approved=false) also transitions the execution to 'halted'.
// =====================================================================

import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');

  const execId = Number(params.execId);
  if (!Number.isInteger(execId) || execId <= 0) throw error(400, 'Invalid execution ID');

  const body = await request.json().catch(() => ({})) as {
    stepNo?: unknown; approved?: unknown; notes?: unknown;
  };

  const stepNo = Number(body.stepNo);
  if (!Number.isInteger(stepNo) || stepNo < 0) throw error(400, 'stepNo must be a non-negative integer');

  if (typeof body.approved !== 'boolean') throw error(400, 'approved must be a boolean');
  const approved = body.approved;
  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 2000) : null;

  const pool = getPool();

  // Verify execution exists, belongs to caller's tenant, and is still running.
  const { rows: exec } = await pool.query<{
    id: string; status: string; workflow_id: string; tenant_id: string;
  }>(
    `SELECT id::text, status, workflow_id::text, tenant_id
     FROM workflow.executions WHERE id = $1 LIMIT 1`,
    [execId]
  );
  if (!exec.length) throw error(404, 'Execution not found');
  if (exec[0].tenant_id !== locals.user.tenantId) throw error(403, 'Forbidden');
  if (exec[0].status !== 'running') {
    throw error(409, `Execution is not running (status: ${exec[0].status})`);
  }

  // Prevent duplicate decisions for the same step.
  const { rows: existing } = await pool.query(
    `SELECT id FROM workflow.approvals WHERE execution_id = $1 AND step_no = $2 LIMIT 1`,
    [execId, stepNo]
  );
  if (existing.length) throw error(409, `Step ${stepNo} has already been decided`);

  // Record the approval decision.
  const { rows: approval } = await pool.query<{ id: string }>(
    `INSERT INTO workflow.approvals
       (tenant_id, execution_id, step_no, approver_user_id, approved, decided_at)
     VALUES ($1, $2, $3, $4::uuid, $5, now())
     RETURNING id::text`,
    [locals.user.tenantId, execId, stepNo, locals.user.id, approved]
  );

  // If rejected, halt the execution immediately.
  if (!approved) {
    await pool.query(
      `UPDATE workflow.executions
       SET status = 'halted'::workflow.execution_status, ended_at = now()
       WHERE id = $1`,
      [execId]
    );
  }

  writeAuditLog({
    userId: locals.user.id,
    actorEmail: locals.user.email,
    tenantId: locals.user.tenantId,
    action: approved ? 'workflow.step.approved' : 'workflow.step.rejected',
    target: `execution:${execId}:step:${stepNo}`,
    result: 'success',
    metadata: {
      approvalId: approval[0].id,
      workflowId: exec[0].workflow_id,
      stepNo,
      ...(notes ? { notes } : {})
    }
  });

  return json({
    ok: true,
    approvalId: approval[0].id,
    execId,
    stepNo,
    approved,
    ...((!approved) ? { executionStatus: 'halted' } : {})
  });
};
