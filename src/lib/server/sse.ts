import { EventEmitter } from 'node:events';
import { AGENTS, AGENT_INPUT_SUMMARIES, AGENT_OUTPUT_SUMMARIES } from '$lib/data/agents';
import { getPool, isPgMode } from '$lib/server/pg';
import type { AgentRunStatus } from '$lib/data/types';

export interface AgentBusEvent {
  ts: string;
  tenantId: string;
  agentId: string;
  agentName: string;
  status: AgentRunStatus;
  inputSummary: string;
  outputSummary: string;
  latencyMs: number;
  costCents: number;
}

const STATUS_POOL: AgentRunStatus[] = ['success','success','success','success','success','success','failed','awaiting-approval'];

class AgentBus extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private pgTimer: NodeJS.Timeout | null = null;
  private cursor = 0;
  private lastSeenAt: string | null = null;

  /** Start synthetic event loop (mock/dev mode only). */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 7000);
    this.timer.unref?.();
  }

  /** Start DB poller that dispatches real agent.runs events (pg mode). */
  startPgPoller(): void {
    if (this.pgTimer) return;
    this.lastSeenAt = new Date().toISOString();
    this.pgTimer = setInterval(() => { void this.pgTick(); }, 10_000);
    this.pgTimer.unref?.();
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.pgTimer) { clearInterval(this.pgTimer); this.pgTimer = null; }
  }

  /**
   * Dispatch a real agent-run event from production job completion.
   * Call this from any server route or background job that finishes
   * an agent task, e.g. after writing to agent.runs in Postgres.
   */
  dispatch(event: AgentBusEvent): void {
    this.emit('agent-run', event);
  }

  private tick(): void {
    const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
    const inputs = AGENT_INPUT_SUMMARIES[agent.id] ?? ['Run'];
    const outputs = AGENT_OUTPUT_SUMMARIES[agent.id] ?? ['Done'];
    const event: AgentBusEvent = {
      ts: new Date().toISOString(),
      tenantId: '',
      agentId: agent.id,
      agentName: agent.name,
      status: STATUS_POOL[this.cursor++ % STATUS_POOL.length],
      inputSummary: inputs[this.cursor % inputs.length],
      outputSummary: outputs[this.cursor % outputs.length],
      latencyMs: 200 + Math.floor(Math.random() * 9_800),
      costCents: agent.costPerRunCents
    };
    this.emit('agent-run', event);
  }

  private async pgTick(): Promise<void> {
    try {
      const pool = getPool();
      const { rows } = await pool.query<{
        tenantId: string | null; agentId: string; agentName: string; status: string;
        inputSummary: string | null; outputSummary: string | null;
        latencyMs: number | null; costCents: number | null; startedAt: string;
      }>(
        `SELECT r.tenant_id AS "tenantId", r.agent_id AS "agentId", a.name AS "agentName",
                r.status::text AS status, r.input_summary AS "inputSummary",
                r.output_summary AS "outputSummary", r.latency_ms AS "latencyMs",
                r.cost_cents AS "costCents", r.started_at AS "startedAt"
         FROM agent.runs r JOIN agent.agents a ON a.id = r.agent_id
         WHERE r.started_at > $1
         ORDER BY r.started_at ASC LIMIT 10`,
        [this.lastSeenAt]
      );
      for (const row of rows) {
        this.dispatch({
          ts: row.startedAt,
          tenantId: row.tenantId ?? '',
          agentId: row.agentId,
          agentName: row.agentName,
          status: row.status as AgentRunStatus,
          inputSummary: row.inputSummary ?? '',
          outputSummary: row.outputSummary ?? '',
          latencyMs: row.latencyMs ?? 0,
          costCents: row.costCents ?? 0,
        });
        this.lastSeenAt = row.startedAt;
      }
    } catch {
      // DB unreachable — silently skip this tick
    }
  }
}

export const agentBus = new AgentBus();

// In pg mode, poll agent.runs for real events. In mock dev mode, fire synthetic events.
if (isPgMode()) {
  agentBus.startPgPoller();
} else if (process.env.NODE_ENV !== 'production') {
  agentBus.start();
}
agentBus.setMaxListeners(64);
