<script lang="ts">
  import type { AgentDecision } from '$lib/data/types';
  import ConfidenceBar from './ConfidenceBar.svelte';
  import { ArrowRight, ShieldCheck, ShieldX, UserCheck, Clock } from 'lucide-svelte';

  export let decision: AgentDecision;
  export let approverName: string = '';

  function truncate(s: string, n: number): string {
    if (!s) return '';
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  function summarize(v: Record<string, unknown> | undefined): string {
    if (!v) return '—';
    try {
      const s = JSON.stringify(v);
      return truncate(s.replace(/[{}"]/g, ''), 60);
    } catch {
      return '—';
    }
  }

  function relativeTs(ts: string): string {
    try {
      const d = new Date(ts).getTime();
      const diff = (Date.now() - d) / 1000;
      if (diff < 60) return `${Math.floor(diff)}s ago`;
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    } catch {
      return ts;
    }
  }

  $: outcomeCls = decision.outcome === 'auto-approved'
    ? 'bg-slate-100 text-slate-700 ring-slate-200'
    : decision.outcome === 'hitl-approved'
      ? 'bg-violet-50 text-violet-700 ring-violet-200'
      : decision.outcome === 'hitl-rejected'
        ? 'bg-rose-50 text-rose-700 ring-rose-200'
        : 'bg-amber-50 text-amber-700 ring-amber-200';

  $: outcomeLabel = decision.outcome === 'auto-approved'
    ? 'Auto'
    : decision.outcome === 'hitl-approved'
      ? 'HITL Approved'
      : decision.outcome === 'hitl-rejected'
        ? 'HITL Rejected'
        : 'Awaiting HITL';
</script>

<div class="flex items-center gap-3 border-t border-slate-100 px-4 py-3 text-sm">
  <div class="min-w-0 flex-1">
    <div class="flex items-center gap-2 text-xs text-slate-500">
      <span class="font-medium text-slate-700">{decision.agentName ?? decision.agentId}</span>
      <span class="text-slate-300">·</span>
      <span>{decision.decisionType}</span>
    </div>
    <div class="mt-1 flex items-center gap-2 text-xs text-slate-600">
      <span class="truncate font-mono">{summarize(decision.input)}</span>
      <ArrowRight class="h-3 w-3 flex-shrink-0 text-slate-400" />
      <span class="truncate font-mono">{summarize(decision.output)}</span>
    </div>
  </div>

  <div class="flex-shrink-0">
    <ConfidenceBar value={decision.confidence} />
  </div>

  <span class="flex-shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {outcomeCls}">
    {#if decision.outcome === 'auto-approved'}
      <ShieldCheck class="h-3 w-3" />
    {:else if decision.outcome === 'hitl-approved'}
      <UserCheck class="h-3 w-3" />
    {:else if decision.outcome === 'hitl-rejected'}
      <ShieldX class="h-3 w-3" />
    {:else}
      <Clock class="h-3 w-3" />
    {/if}
    {outcomeLabel}
  </span>

  <div class="hidden w-32 flex-shrink-0 text-right text-xs text-slate-500 sm:block">
    {#if approverName}<div class="truncate font-medium text-slate-700">{approverName}</div>{/if}
    <div>{relativeTs(decision.decidedAt)}</div>
  </div>
</div>
