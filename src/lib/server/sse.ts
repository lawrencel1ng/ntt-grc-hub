import { EventEmitter } from 'node:events';
import { AGENTS, AGENT_INPUT_SUMMARIES, AGENT_OUTPUT_SUMMARIES } from '$lib/data/agents';
import type { AgentRunStatus } from '$lib/data/types';

export interface AgentBusEvent {
  ts: string;
  agentId: string;
  agentName: string;
  status: AgentRunStatus;
  inputSummary: string;
  outputSummary: string;
  latencyMs: number;
  costCents: number;
}

const STATUS_POOL: AgentRunStatus[] = ['success','success','success','success','success','success','failed','awaiting-approval'];

/**
 * Singleton event emitter that ticks every 7 seconds and emits a synthetic
 * `agent-run` event drawn from the universal AGENTS pool. The SSE endpoint
 * subscribes to this bus and pushes each event over the wire.
 *
 * Keep ticks moderate — a bit faster than the spec's "every 10s" floor
 * so the dashboard always feels alive on demo.
 */
class AgentBus extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private cursor = 0;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 7000);
    // Unref so the timer doesn't keep the process alive in tests.
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
    const inputs = AGENT_INPUT_SUMMARIES[agent.id] ?? ['Run'];
    const outputs = AGENT_OUTPUT_SUMMARIES[agent.id] ?? ['Done'];
    const event: AgentBusEvent = {
      ts: new Date().toISOString(),
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
}

export const agentBus = new AgentBus();
// Start eagerly so the first SSE subscriber sees activity immediately.
agentBus.start();
// Allow more than 10 concurrent SSE clients without warning spam.
agentBus.setMaxListeners(64);
