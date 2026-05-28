<script lang="ts">
  import type { Agent } from '$lib/data/types';
  import AgentTypeBadge from './AgentTypeBadge.svelte';
  import StatusDot from './StatusDot.svelte';
  import { Bot, ArrowRight } from 'lucide-svelte';

  export let agent: Agent;
  export let stats: { runs30d: number; costCents30d: number; fteHours30d: number } = { runs30d: 0, costCents30d: 0, fteHours30d: 0 };

  function fmtMoney(cents: number): string {
    const dollars = cents / 100;
    if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
    return `$${dollars.toFixed(0)}`;
  }
</script>

<div class="agent-card p-4 pl-5">
  <div class="flex items-start justify-between gap-3">
    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <Bot class="h-4 w-4 flex-shrink-0 text-grc-agent" />
        <h3 class="truncate text-sm font-semibold text-grc-ink">{agent.name}</h3>
      </div>
      <p class="mt-1 line-clamp-2 text-xs text-slate-500">{agent.description}</p>
    </div>
    <StatusDot status={agent.status} withLabel={false} />
  </div>

  <div class="mt-3 flex flex-wrap items-center gap-2">
    <AgentTypeBadge type={agent.type} />
    <span class="text-[11px] text-slate-400">·</span>
    <span class="text-[11px] text-slate-500">{agent.ownerTeam}</span>
  </div>

  <div class="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
    <div>
      <div class="text-[10px] uppercase tracking-wider text-slate-400">Runs 30d</div>
      <div class="font-mono text-sm font-semibold text-grc-ink">{stats.runs30d}</div>
    </div>
    <div>
      <div class="text-[10px] uppercase tracking-wider text-slate-400">Cost 30d</div>
      <div class="font-mono text-sm font-semibold text-grc-ink">{fmtMoney(stats.costCents30d)}</div>
    </div>
    <div>
      <div class="text-[10px] uppercase tracking-wider text-slate-400">FTE hrs</div>
      <div class="font-mono text-sm font-semibold text-violet-700">{stats.fteHours30d.toFixed(0)}</div>
    </div>
  </div>

  <div class="mt-3 flex justify-end">
    <a
      href="/agents/{agent.id}"
      class="inline-flex items-center gap-1 text-xs font-semibold text-grc-primary hover:text-grc-primary-dark"
    >
      View <ArrowRight class="h-3 w-3" />
    </a>
  </div>
</div>
