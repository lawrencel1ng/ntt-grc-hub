<script lang="ts">
  import type { AgentRun } from '$lib/data/types';
  import { ChevronRight, ChevronDown, CheckCircle2, XCircle, Loader2, Clock, AlertTriangle } from 'lucide-svelte';

  export let runs: AgentRun[] = [];
  export let initiallyExpanded: number[] = [];

  let expanded = new Set<number>(initiallyExpanded);

  function toggle(id: number) {
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
    expanded = new Set(expanded);
  }

  function fmtTs(ts: string): string {
    try {
      const d = new Date(ts);
      // HH:MM:SS — compact, log-style
      return d.toISOString().slice(11, 19);
    } catch {
      return ts;
    }
  }

  function fmtCost(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  function fmtLatency(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }
</script>

<div class="overflow-hidden rounded-lg bg-white ring-1 ring-inset ring-slate-200/70">
  {#each runs as run}
    <div class="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        class="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50"
        on:click={() => toggle(run.id)}
      >
        <span class="flex-shrink-0 text-slate-300">
          {#if expanded.has(run.id)}
            <ChevronDown class="h-3 w-3" />
          {:else}
            <ChevronRight class="h-3 w-3" />
          {/if}
        </span>
        <span class="flex-shrink-0">
          {#if run.status === 'success'}
            <CheckCircle2 class="h-3.5 w-3.5 text-violet-500" />
          {:else if run.status === 'failed'}
            <XCircle class="h-3.5 w-3.5 text-rose-500" />
          {:else if run.status === 'running'}
            <Loader2 class="h-3.5 w-3.5 animate-spin text-slate-400" />
          {:else if run.status === 'queued'}
            <Clock class="h-3.5 w-3.5 text-slate-400" />
          {:else if run.status === 'awaiting-approval'}
            <AlertTriangle class="h-3.5 w-3.5 text-amber-500" />
          {:else}
            <Clock class="h-3.5 w-3.5 text-slate-400" />
          {/if}
        </span>
        <span class="flex-shrink-0 font-mono text-[11px] tabular-nums text-slate-500">{fmtTs(run.startedAt)}</span>
        <span class="flex-shrink-0 truncate text-[13px] font-medium text-slate-700">{run.agentName ?? run.agentId}</span>
        <span class="truncate text-[13px] text-slate-600">{run.outputSummary || run.inputSummary}</span>
        <span class="ml-auto flex-shrink-0 font-mono text-[11px] tabular-nums text-slate-400">{fmtLatency(run.latencyMs)}</span>
      </button>
      {#if expanded.has(run.id)}
        <div class="space-y-1 bg-slate-50/60 px-3 py-2 pl-9 text-[11px] text-slate-600">
          <div><span class="text-slate-400">trigger</span> <span class="font-mono text-slate-700">{run.trigger}</span></div>
          <div><span class="text-slate-400">input</span> <span class="text-slate-700">{run.inputSummary}</span></div>
          <div><span class="text-slate-400">output</span> <span class="text-slate-700">{run.outputSummary}</span></div>
          {#if run.toolsCalled.length}
            <div>
              <span class="text-slate-400">tools</span>
              {#each run.toolsCalled as t, i}
                <span class="font-mono text-violet-700">{t}</span>{#if i < run.toolsCalled.length - 1}<span class="text-slate-300">, </span>{/if}
              {/each}
            </div>
          {/if}
          <div class="flex gap-4 pt-1 font-mono tabular-nums text-[11px] text-slate-500">
            <span>latency <span class="text-slate-700">{fmtLatency(run.latencyMs)}</span></span>
            <span>cost <span class="text-slate-700">{fmtCost(run.costCents)}</span></span>
            <span>status <span class="text-slate-700">{run.status}</span></span>
          </div>
        </div>
      {/if}
    </div>
  {/each}
  {#if !runs.length}
    <div class="px-3 py-6 text-center text-xs text-slate-400">No runs recorded.</div>
  {/if}
</div>
