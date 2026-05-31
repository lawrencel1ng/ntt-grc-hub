import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';
import { checkRateLimit } from '$lib/server/rateLimit';
import { agentBus } from '$lib/server/sse';

// ── FAIR Monte Carlo helpers ──────────────────────────────────────────────
// Loss Magnitude ranges (SGD) mapped from risk severity
const LM_SGD: Record<string, [number, number]> = {
  critical: [1_000_000, 10_000_000],
  high:     [100_000,   1_000_000],
  medium:   [10_000,    100_000],
  low:      [1_000,     10_000],
};

// Threat Event Frequency ranges (events/year) mapped from likelihood
const TEF_PA: Record<string, [number, number]> = {
  critical: [12, 52],
  high:     [4, 12],
  medium:   [1, 4],
  low:      [0.1, 1],
};

function logUniform(min: number, max: number): number {
  return Math.exp(Math.log(min) + Math.random() * (Math.log(max) - Math.log(min)));
}

function fairMonteCarlo(
  severity: string,
  likelihood: string,
  n = 10_000
): { p10: number; p50: number; p90: number; mean: number } {
  const lmRange = LM_SGD[severity] ?? LM_SGD.medium;
  const tefRange = TEF_PA[likelihood] ?? TEF_PA.medium;
  const ales: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const tef = logUniform(tefRange[0], tefRange[1]);
    const vratio = 0.3 + Math.random() * 0.4; // vulnerability 30–70%
    const lm = logUniform(lmRange[0], lmRange[1]);
    ales[i] = tef * vratio * lm;
  }
  ales.sort((a, b) => a - b);
  return {
    p10:  Math.round(ales[Math.floor(n * 0.1)]),
    p50:  Math.round(ales[Math.floor(n * 0.5)]),
    p90:  Math.round(ales[Math.floor(n * 0.9)]),
    mean: Math.round(ales.reduce((s, v) => s + v, 0) / n),
  };
}

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');
  if (!checkRateLimit('fair.run', locals.user.id, 10, 5 * 60_000)) throw error(429, 'Too many FAIR runs — try again in a few minutes.');

  const pool = getPool();

  // Verify the risk exists and belongs to this tenant; fetch rating fields for FAIR inputs
  const { rows: riskRows } = await pool.query<{
    id: string; code: string; tenant_id: string;
    inherent_severity: string; inherent_likelihood: string;
  }>(
    `SELECT id, code, tenant_id, inherent_severity::text, inherent_likelihood::text
     FROM risk.risks WHERE id = $1::uuid LIMIT 1`,
    [params.id]
  );
  if (!riskRows.length) throw error(404, 'Risk not found');
  if (riskRows[0].tenant_id !== locals.user.tenantId) throw error(403, 'Forbidden');

  const risk = riskRows[0];
  const calcStart = Date.now();
  const ale = fairMonteCarlo(risk.inherent_severity, risk.inherent_likelihood);
  const latencyMs = Date.now() - calcStart;

  const fmtSgd = (n: number) => `SGD ${n.toLocaleString('en-SG')}`;
  const outputSummary =
    `FAIR ALE for ${risk.code}: ${fmtSgd(ale.p50)} median ` +
    `(P10 ${fmtSgd(ale.p10)} · P90 ${fmtSgd(ale.p90)} · mean ${fmtSgd(ale.mean)}) — ` +
    `10 000-iteration Monte Carlo, ${risk.inherent_severity} severity / ${risk.inherent_likelihood} likelihood`;

  // Attribution: find an enabled Risk Quantifier / FAIR agent if one exists
  const { rows: agents } = await pool.query<{ id: string }>(
    `SELECT id FROM agent.agents
     WHERE (name ILIKE '%risk quantifier%' OR name ILIKE '%fair%' OR name ILIKE '%quantif%')
       AND tenant_id = $1 AND enabled = true
     ORDER BY created_at DESC LIMIT 1`,
    [locals.user.tenantId]
  );

  let runId: string | null = null;
  if (agents.length > 0) {
    const agentId = agents[0].id;
    const { rows: run } = await pool.query<{ id: string }>(
      `INSERT INTO agent.runs
         (tenant_id, agent_id, trigger, status, input_summary, output_summary, latency_ms, cost_cents, ended_at)
       VALUES ($1, $2, 'manual', 'success', $3, $4, $5, 0, now())
       RETURNING id::text`,
      [
        locals.user.tenantId,
        agentId,
        `FAIR Monte Carlo for ${risk.code} (${risk.inherent_severity}/${risk.inherent_likelihood})`,
        outputSummary,
        latencyMs,
      ]
    );
    runId = run[0].id;
    agentBus.dispatch({
      ts: new Date().toISOString(),
      agentId,
      agentName: 'Risk Quantifier',
      status: 'success',
      inputSummary: `FAIR analysis for ${risk.code}`,
      outputSummary,
      latencyMs,
      costCents: 0,
    });
  }

  writeAuditLog({
    userId: locals.user.id,
    actorEmail: locals.user.email,
    tenantId: locals.user.tenantId,
    action: 'fair.analysis.completed',
    target: `risk:${params.id}`,
    result: 'success',
    metadata: { riskCode: risk.code, runId, aleP10: ale.p10, aleP50: ale.p50, aleP90: ale.p90 },
  });

  return json({ ok: true, runId, ale });
};
