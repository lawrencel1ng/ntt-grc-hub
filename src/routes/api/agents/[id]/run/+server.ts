import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';
import { checkRateLimit } from '$lib/server/rateLimit';
import { agentBus } from '$lib/server/sse';

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');
  if (!(await checkRateLimit('agent.run', locals.user.id, 10, 5 * 60_000))) throw error(429, 'Too many agent runs — try again in a few minutes.');

  const pool = getPool();

  const { rows } = await pool.query<{ id: string; name: string; enabled: boolean }>(
    `SELECT id, name, enabled FROM agent.agents WHERE id = $1 LIMIT 1`,
    [params.id]
  );
  if (!rows.length) throw error(404, 'Agent not found');
  const agent = rows[0];
  if (!agent.enabled) throw error(400, 'Agent is disabled');

  const { rows: run } = await pool.query<{ id: string }>(
    `INSERT INTO agent.runs (tenant_id, agent_id, trigger, status, input_summary)
     VALUES ($1, $2, 'manual', 'queued', 'Manual execution triggered via GRC Hub')
     RETURNING id::text`,
    [locals.user.tenantId, params.id]
  );

  writeAuditLog({
    userId: locals.user.id,
    actorEmail: locals.user.email,
    tenantId: locals.user.tenantId,
    action: 'agent.run.queued',
    target: `agent:${params.id}`,
    result: 'success',
    metadata: { runId: run[0].id, agentName: agent.name }
  });

  agentBus.dispatch({
    ts: new Date().toISOString(),
    tenantId: locals.user.tenantId,
    agentId: params.id,
    agentName: agent.name,
    status: 'queued',
    inputSummary: 'Manual execution triggered via GRC Hub',
    outputSummary: 'Run queued — awaiting agent pickup',
    latencyMs: 0,
    costCents: 0
  });

  return json({ ok: true, runId: run[0].id });
};
