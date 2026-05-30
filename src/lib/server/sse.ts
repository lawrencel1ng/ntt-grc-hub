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

class AgentBus extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private cursor = 0;

  /** Start synthetic event loop (development only). */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 7000);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
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
// Only run synthetic events in development — production relies on real
// agent.runs rows dispatched via agentBus.dispatch().
if (process.env.NODE_ENV !== 'production') {
  agentBus.start();
}
agentBus.setMaxListeners(64);
