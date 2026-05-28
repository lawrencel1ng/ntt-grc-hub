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
      return d.toISOString().replace('T', ' ').slice(0, 19);
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

<div class="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 font-mono text-xs text-slate-200">
  {#each runs as run}
    <div class="border-b border-slate-800 last:border-b-0">
      <button
        type="button"
        class="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-900"
        on:click={() => toggle(run.id)}
      >
        <span class="flex-shrink-0 text-slate-500">
          {#if expanded.has(run.id)}
            <ChevronDown class="h-3.5 w-3.5" />
          {:else}
            <ChevronRight class="h-3.5 w-3.5" />
          {/if}
        </span>
        <span class="flex-shrink-0">
          {#if run.status === 'success'}
            <CheckCircle2 class="h-3.5 w-3.5 text-emerald-400" />
          {:else if run.status === 'failed'}
            <XCircle class="h-3.5 w-3.5 text-rose-400" />
          {:else if run.status === 'running'}
            <Loader2 class="h-3.5 w-3.5 animate-spin text-blue-400" />
          {:else if run.status === 'queued'}
            <Clock class="h-3.5 w-3.5 text-slate-400" />
          {:else if run.status === 'awaiting-approval'}
            <AlertTriangle class="h-3.5 w-3.5 text-amber-400" />
          {:else}
            <Clock class="h-3.5 w-3.5 text-slate-400" />
          {/if}
        </span>
        <span class="flex-shrink-0 text-slate-500">{fmtTs(run.startedAt)}</span>
        <span class="flex-shrink-0 truncate text-emerald-300">{run.agentName ?? run.agentId}</span>
        <span class="truncate text-slate-300">{run.outputSummary || run.inputSummary}</span>
        <span class="ml-auto flex-shrink-0 text-slate-500">{fmtLatency(run.latencyMs)}</span>
      </button>
      {#if expanded.has(run.id)}
        <div class="space-y-1 bg-slate-900/60 px-3 py-2 pl-9 text-[11px]">
          <div class="text-slate-400"><span class="text-slate-500">trigger</span> = {run.trigger}</div>
          <div class="text-slate-400"><span class="text-slate-500">input</span>   = {run.inputSummary}</div>
          <div class="text-slate-400"><span class="text-slate-500">output</span>  = {run.outputSummary}</div>
          {#if run.toolsCalled.length}
            <div class="text-slate-400">
              <span class="text-slate-500">tools</span>   =
              {#each run.toolsCalled as t, i}
                <span class="text-violet-300">{t}</span>{#if i < run.toolsCalled.length - 1}, {/if}
              {/each}
            </div>
          {/if}
          <div class="flex gap-4 pt-1 text-slate-500">
            <span>latency=<span class="text-slate-300">{fmtLatency(run.latencyMs)}</span></span>
            <span>cost=<span class="text-emerald-300">{fmtCost(run.costCents)}</span></span>
            <span>status=<span class="text-slate-300">{run.status}</span></span>
          </div>
        </div>
      {/if}
    </div>
  {/each}
  {#if !runs.length}
    <div class="px-3 py-6 text-center text-slate-500">No runs recorded.</div>
  {/if}
</div>
