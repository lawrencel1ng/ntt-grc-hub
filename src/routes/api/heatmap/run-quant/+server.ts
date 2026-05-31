import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';
import { checkRateLimit } from '$lib/server/rateLimit';
import { agentBus } from '$lib/server/sse';

// ── FAIR portfolio Monte Carlo ────────────────────────────────────────────
// Maps severity/likelihood enums to distribution ranges
const LM_SGD: Record<string, [number, number]> = {
  critical: [1_000_000, 10_000_000],
  high:     [100_000,   1_000_000],
  medium:   [10_000,    100_000],
  low:      [1_000,     10_000],
};
const TEF_PA: Record<string, [number, number]> = {
  critical: [12, 52],
  high:     [4, 12],
  medium:   [1, 4],
  low:      [0.1, 1],
};

function logUniform(min: number, max: number): number {
  return Math.exp(Math.log(min) + Math.random() * (Math.log(max) - Math.log(min)));
}

function portfolioMonteCarlo(
  risks: Array<{ severity: string; likelihood: string }>,
  n = 5_000
): { p10: number; p50: number; p90: number; mean: number } {
  const portfolio = new Float64Array(n); // zero-initialised
  for (const r of risks) {
    const lmRange = LM_SGD[r.severity] ?? LM_SGD.medium;
    const tefRange = TEF_PA[r.likelihood] ?? TEF_PA.medium;
    for (let i = 0; i < n; i++) {
      const tef = logUniform(tefRange[0], tefRange[1]);
      const vratio = 0.3 + Math.random() * 0.4;
      const lm = logUniform(lmRange[0], lmRange[1]);
      portfolio[i] += tef * vratio * lm;
    }
  }
  const sorted = Array.from(portfolio).sort((a, b) => a - b);
  return {
    p10:  Math.round(sorted[Math.floor(n * 0.1)]),
    p50:  Math.round(sorted[Math.floor(n * 0.5)]),
    p90:  Math.round(sorted[Math.floor(n * 0.9)]),
    mean: Math.round(sorted.reduce((s, v) => s + v, 0) / n),
  };
}

export const POST: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');
  if (!checkRateLimit('heatmap.quant', locals.user.id, 10, 5 * 60_000)) throw error(429, 'Too many quantification runs — try again in a few minutes.');

  const pool = getPool();

  // Fetch all active risks for the tenant to build the portfolio
  const { rows: risks } = await pool.query<{
    id: string; code: string;
    inherent_severity: string; inherent_likelihood: string;
  }>(
    `SELECT id::text, code, inherent_severity::text, inherent_likelihood::text
     FROM risk.risks
     WHERE tenant_id = $1 AND status NOT IN ('closed', 'archived')
     ORDER BY code LIMIT 500`,
    [locals.user.tenantId]
  );

  if (!risks.length) {
    return json({ ok: true, runId: null, ale: null, riskCount: 0,
      message: 'No active risks found — add risks to run portfolio quantification.' });
  }

  const calcStart = Date.now();
  const ale = portfolioMonteCarlo(
    risks.map(r => ({ severity: r.inherent_severity, likelihood: r.inherent_likelihood }))
  );
  const latencyMs = Date.now() - calcStart;

  const fmtSgd = (n: number) => `SGD ${n.toLocaleString('en-SG')}`;
  const outputSummary =
    `Portfolio ALE across ${risks.length} risks: ${fmtSgd(ale.p50)} median ` +
    `(P10 ${fmtSgd(ale.p10)} · P90 ${fmtSgd(ale.p90)} · mean ${fmtSgd(ale.mean)}) — ` +
    `5 000-iteration Monte Carlo`;

  // Attribution: find an enabled Risk Quantifier agent if one exists
  const { rows: agents } = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM agent.agents
     WHERE (name ILIKE '%risk quantifier%' OR name ILIKE '%fair%' OR name ILIKE '%quantif%')
       AND tenant_id = $1 AND enabled = true
     ORDER BY created_at DESC LIMIT 1`,
    [locals.user.tenantId]
  );

  let runId: string | null = null;
  if (agents.length > 0) {
    const { id: agentId, name: agentName } = agents[0];
    const { rows: run } = await pool.query<{ id: string }>(
      `INSERT INTO agent.runs
         (tenant_id, agent_id, trigger, status, input_summary, output_summary, latency_ms, cost_cents, ended_at)
       VALUES ($1, $2, 'manual', 'success', $3, $4, $5, 0, now())
       RETURNING id::text`,
      [
        locals.user.tenantId,
        agentId,
        `Portfolio FAIR Monte Carlo — ${risks.length} active risks`,
        outputSummary,
        latencyMs,
      ]
    );
    runId = run[0].id;
    agentBus.dispatch({
      ts: new Date().toISOString(),
      agentId,
      agentName,
      status: 'success',
      inputSummary: `Portfolio FAIR Monte Carlo — ${risks.length} active risks`,
      outputSummary,
      latencyMs,
      costCents: 0,
    });
  }

  writeAuditLog({
    userId: locals.user.id,
    actorEmail: locals.user.email,
    tenantId: locals.user.tenantId,
    action: 'fair.quantification.completed',
    target: `tenant:${locals.user.tenantId}`,
    result: 'success',
    metadata: { runId, riskCount: risks.length, aleP50: ale.p50 },
  });

  return json({ ok: true, runId, ale, riskCount: risks.length });
};
