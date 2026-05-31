import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';
import { agentBus } from '$lib/server/sse';
import { checkRateLimit } from '$lib/server/rateLimit';
import type { AgentRunStatus } from '$lib/data/types';

const VALID_STATUSES: AgentRunStatus[] = ['success', 'failed', 'halted'];

/**
 * POST /api/agents/runs/:runId/complete
 *
 * Called by an agent executor (worker, webhook) once a queued run finishes.
 * Updates the run record in Postgres and emits the result onto the SSE bus
 * so connected dashboards update in real time.
 *
 * Body (JSON):
 *   status        — "success" | "failed" | "halted"
 *   outputSummary — human-readable result (≤2 048 chars)
 *   latencyMs     — wall-clock time the run took (integer, ≥ 0)
 *   costCents     — cost in cents (integer, ≥ 0)
 *   toolsCalled   — optional array of tool names used
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');
  if (!(await checkRateLimit('agent.run.complete', locals.user.id, 60, 5 * 60_000))) throw error(429, 'Too many completion callbacks — try again shortly.');

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') throw error(400, 'Invalid JSON body');

  const status: AgentRunStatus = body.status;
  const outputSummary: string = String(body.outputSummary ?? '').slice(0, 2048);
  const latencyMs = Math.max(0, Math.floor(Number(body.latencyMs ?? 0)));
  const costCents = Math.max(0, Math.floor(Number(body.costCents ?? 0)));
  const toolsCalled: string[] = Array.isArray(body.toolsCalled)
    ? body.toolsCalled.map(String).slice(0, 50)
    : [];

  if (!VALID_STATUSES.includes(status)) {
    throw error(400, `status must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  if (isNaN(latencyMs) || isNaN(costCents)) throw error(400, 'latencyMs and costCents must be numbers');

  const pool = getPool();

  const { rows } = await pool.query<{
    id: string; agent_id: string; tenant_id: string; name: string; input_summary: string; status: string; fte_equivalent: number;
  }>(
    `SELECT r.id, r.agent_id, r.tenant_id, a.name, r.input_summary, r.status::text AS status, a.fte_equivalent
     FROM agent.runs r JOIN agent.agents a ON a.id = r.agent_id
     WHERE r.id = $1::uuid LIMIT 1`,
    [params.runId]
  );

  if (!rows.length) throw error(404, 'Run not found');
  const run = rows[0];

  if (run.tenant_id !== locals.user.tenantId && locals.user.role !== 'admin') {
    throw error(403, 'Forbidden');
  }
  if (run.status !== 'queued' && run.status !== 'running') {
    throw error(409, `Run is already in terminal state: ${run.status}`);
  }

  await pool.query(
    `UPDATE agent.runs
     SET status = $1::agent.run_status,
         output_summary = $2,
         latency_ms = $3,
         cost_cents = $4,
         tools_called = $5,
         ended_at = now()
     WHERE id = $6::uuid`,
    [status, outputSummary || null, latencyMs, costCents, JSON.stringify(toolsCalled), params.runId]
  );

  // Record in cost ledger so fleet_summary view and cost reports reflect real usage.
  const fteHours = +(Number(run.fte_equivalent) * 0.5).toFixed(2);
  pool.query(
    `INSERT INTO agent.cost_ledger (tenant_id, agent_id, ts, runs, cost_cents, fte_saved_hours)
     VALUES ($1, $2, now(), 1, $3, $4)`,
    [run.tenant_id, run.agent_id, costCents, fteHours]
  ).catch(() => { /* best-effort — never block the response */ });

  writeAuditLog({
    userId: locals.user.id,
    actorEmail: locals.user.email,
    tenantId: locals.user.tenantId,
    action: 'agent.run.completed',
    target: `run:${params.runId}`,
    result: status === 'success' ? 'success' : 'failure',
    metadata: { agentId: run.agent_id, agentName: run.name, status, latencyMs, costCents }
  });

  agentBus.dispatch({
    ts: new Date().toISOString(),
    tenantId: run.tenant_id,
    agentId: run.agent_id,
    agentName: run.name,
    status,
    inputSummary: run.input_summary ?? '',
    outputSummary,
    latencyMs,
    costCents
  });

  return json({ ok: true });
};
