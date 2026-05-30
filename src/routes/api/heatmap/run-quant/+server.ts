import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';
import { checkRateLimit } from '$lib/server/rateLimit';
import { agentBus } from '$lib/server/sse';

export const POST: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');
  if (!checkRateLimit('heatmap.quant', locals.user.id, 10, 5 * 60_000)) throw error(429, 'Too many quantification runs — try again in a few minutes.');

  const pool = getPool();

  // Queue the Risk Quantifier agent if available
  const { rows: agents } = await pool.query<{ id: string; name: string; enabled: boolean }>(
    `SELECT id, name, enabled FROM agent.agents
     WHERE (name ILIKE '%risk quantifier%' OR name ILIKE '%fair%' OR name ILIKE '%quantif%')
       AND tenant_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [locals.user.tenantId]
  );

  let runId: string | null = null;
  if (agents.length > 0 && agents[0].enabled) {
    const { rows: run } = await pool.query<{ id: string }>(
      `INSERT INTO agent.runs (tenant_id, agent_id, trigger, status, input_summary)
       VALUES ($1, $2, 'manual', 'queued', 'FAIR Monte Carlo quantification triggered via heatmap')
       RETURNING id::text`,
      [locals.user.tenantId, agents[0].id]
    );
    runId = run[0].id;
    agentBus.dispatch({
      ts: new Date().toISOString(),
      agentId: agents[0].id,
      agentName: agents[0].name,
      status: 'queued',
      inputSummary: 'FAIR Monte Carlo quantification — all scenarios',
      outputSummary: 'Run queued — 10k-trial simulation starting',
      latencyMs: 0,
      costCents: 0
    });
  }

  writeAuditLog({
    userId: locals.user.id,
    actorEmail: locals.user.email,
    tenantId: locals.user.tenantId,
    action: 'fair.quantification.queued',
    target: `tenant:${locals.user.tenantId}`,
    result: 'success',
    metadata: { runId, scope: 'all-scenarios' }
  });

  return json({ ok: true, runId });
};
