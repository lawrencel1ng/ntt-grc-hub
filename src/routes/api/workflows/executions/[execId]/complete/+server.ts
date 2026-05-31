// =====================================================================
//  POST /api/workflows/executions/[execId]/complete
//  Called by workflow executors to mark a run terminal.
//  Accepts: { status: 'success'|'failed'|'halted', error?: string }
// =====================================================================

import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';
import { checkRateLimit } from '$lib/server/rateLimit';

const TERMINAL_STATUSES = ['success', 'failed', 'halted'] as const;
type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');
  if (!(await checkRateLimit('workflow.complete', locals.user.id, 60, 5 * 60_000))) throw error(429, 'Too many completion callbacks — try again shortly.');

  const execId = Number(params.execId);
  if (!Number.isInteger(execId) || execId <= 0) throw error(400, 'Invalid execution ID');

  const body = await request.json().catch(() => ({})) as { status?: string; error?: string };
  const newStatus = body.status as TerminalStatus;
  if (!TERMINAL_STATUSES.includes(newStatus)) {
    throw error(400, `status must be one of: ${TERMINAL_STATUSES.join(', ')}`);
  }

  const pool = getPool();

  // Verify execution exists and belongs to caller's tenant; reject if already terminal.
  const { rows } = await pool.query<{
    id: string; status: string; workflow_id: string; tenant_id: string
  }>(
    `SELECT id::text, status, workflow_id::text, tenant_id
     FROM workflow.executions WHERE id = $1 LIMIT 1`,
    [execId]
  );
  if (!rows.length) throw error(404, 'Execution not found');
  if (rows[0].tenant_id !== locals.user.tenantId) throw error(403, 'Forbidden');
  if (rows[0].status !== 'running') {
    throw error(409, `Execution already in terminal state: ${rows[0].status}`);
  }

  await pool.query(
    `UPDATE workflow.executions
     SET status = $1::workflow.execution_status, ended_at = now()
     WHERE id = $2`,
    [newStatus, execId]
  );

  writeAuditLog({
    userId: locals.user.id,
    actorEmail: locals.user.email,
    tenantId: locals.user.tenantId,
    action: `workflow.execution.${newStatus}`,
    target: `execution:${execId}`,
    result: newStatus === 'success' ? 'success' : 'failure',
    metadata: { workflowId: rows[0].workflow_id, ...(body.error ? { error: body.error } : {}) }
  });

  return json({ ok: true, execId, status: newStatus });
};
