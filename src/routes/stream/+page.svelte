<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { Pause, Play, AlertTriangle, Trash2 } from 'lucide-svelte';
  import type { AgentRun, AgentType, AgentStatus } from '$lib/data/types';

  export let data;

  // ---------- Bounded buffer ----------
  // Cap at 500 events to stop the DOM from growing without bound; we render
  // the 200 most recent for snappy scroll perf.
  const MAX_EVENTS = 500;
  const RENDER_WINDOW = 200;

  let buffer: AgentRun[] = [...data.runs];
  let paused = false;
  let sseConnected = false;
  let nextSseId = -1;
  let es: EventSource | null = null;
  let scrollEl: HTMLDivElement | null = null;

  // ---------- Filters ----------
  type TypeFilter = 'all' | AgentType;
  let typeFilter: TypeFilter = 'all';
  let agentIdFilter: string = 'all';
  let hitlOnly = false;

  $: agentsById = new Map(data.agents.map((a) => [a.id, a]));
  $: visible = (() => {
    const out: AgentRun[] = [];
    for (const r of buffer) {
      const agent = agentsById.get(r.agentId);
      if (typeFilter !== 'all' && agent?.type !== typeFilter) continue;
      if (agentIdFilter !== 'all' && r.agentId !== agentIdFilter) continue;
      if (hitlOnly && r.status !== 'awaiting-approval') continue;
      out.push(r);
      if (out.length >= RENDER_WINDOW) break;
    }
    return out;
  })();

  function typeColor(type: AgentType | undefined): string {
    if (type === 'deterministic') return 'text-slate-300';
    if (type === 'ai-powered') return 'text-violet-300';
    if (type === 'intelligent') return 'text-violet-300';
    return 'text-slate-400';
  }
  function statusColor(s: AgentStatus | string): string {
    if (s === 'success') return 'text-violet-300';
    if (s === 'failed') return 'text-rose-300';
    if (s === 'awaiting-approval') return 'text-amber-300';
    if (s === 'running') return 'text-blue-300';
    return 'text-slate-400';
  }
  function fmtTs(ts: string): string {
    return new Date(ts).toISOString().slice(11, 19);
  }
  function fmtCost(c: number): string {
    return `$${(c / 100).toFixed(2)}`;
  }

  // ---------- SSE wiring ----------
  onMount(() => {
    es = new EventSource('/api/events');
    es.addEventListener('hello', () => { sseConnected = true; });
    es.addEventListener('agent-run', async (ev) => {
      if (paused) return;
      try {
        const payload = JSON.parse((ev as MessageEvent).data);
        const run: AgentRun = {
          id: nextSseId--,
          agentId: payload.agentId,
          agentName: payload.agentName,
          trigger: 'cron',
          startedAt: payload.ts,
          status: payload.status,
          inputSummary: payload.inputSummary,
          outputSummary: payload.outputSummary,
          toolsCalled: [],
          costCents: payload.costCents,
          latencyMs: payload.latencyMs
        };
        buffer = [run, ...buffer].slice(0, MAX_EVENTS);
        // Auto-scroll to the top (newest) unless the user has scrolled away.
        await tick();
        if (scrollEl && scrollEl.scrollTop < 50) {
          scrollEl.scrollTop = 0;
        }
      } catch { /* malformed event */ }
    });
    es.onerror = () => { sseConnected = false; };
    es.onopen = () => { sseConnected = true; };
  });

  onDestroy(() => { es?.close(); es = null; });

  function clearBuffer() { buffer = []; }
  function togglePause() { paused = !paused; }

  const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'deterministic', label: 'Deterministic' },
    { id: 'ai-powered', label: 'AI-Powered' },
    { id: 'intelligent', label: 'Intelligent' }
  ];
</script>

<PageHeader title="Agent Activity Stream" subtitle="Live SSE feed — every run from every agent, in real time.">
  <svelte:fragment slot="actions">
    <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {sseConnected
      ? 'bg-violet-50 text-violet-700 ring-violet-200'
      : 'bg-slate-100 text-slate-600 ring-slate-200'}">
      <span class="h-1.5 w-1.5 rounded-full {sseConnected ? 'bg-violet-500' : 'bg-slate-400'}"></span>
      {sseConnected ? 'SSE connected' : 'connecting…'}
    </span>
    <button class="btn-secondary" on:click={togglePause}>
      {#if paused}
        <Play class="h-4 w-4" /> Resume
      {:else}
        <Pause class="h-4 w-4" /> Pause
      {/if}
    </button>
    <button class="btn-ghost" on:click={clearBuffer} title="Clear buffer">
      <Trash2 class="h-4 w-4" />
    </button>
  </svelte:fragment>
</PageHeader>

<div class="space-y-4">
  <!-- Filter bar -->
  <div class="card flex flex-wrap items-center gap-3 px-4 py-3">
    <div class="flex items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Type:</span>
      {#each TYPE_FILTERS as f}
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {typeFilter === f.id
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (typeFilter = f.id)}
        >
          {f.label}
        </button>
      {/each}
    </div>
    <span class="text-slate-300">·</span>
    <div class="flex items-center gap-2">
      <label for="stream-agent" class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Agent</label>
      <select id="stream-agent" bind:value={agentIdFilter} class="input w-48 py-1.5 text-xs">
        <option value="all">All agents</option>
        {#each data.agents as a}
          <option value={a.id}>{a.name}</option>
        {/each}
      </select>
    </div>
    <label class="flex items-center gap-2 text-xs text-slate-700">
      <input type="checkbox" bind:checked={hitlOnly} class="rounded border-slate-300 text-grc-primary focus:ring-grc-primary" />
      <span class="inline-flex items-center gap-1"><AlertTriangle class="h-3.5 w-3.5 text-amber-500" /> Show only HITL events</span>
    </label>
    <span class="ml-auto text-xs text-slate-500">
      {visible.length} shown · {buffer.length} buffered (cap {MAX_EVENTS})
    </span>
  </div>

  <!-- Terminal -->
  <div class="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-lg">
    <div class="flex items-center gap-2 border-b border-slate-800 bg-slate-900/70 px-3 py-2 font-mono text-[11px] text-slate-400">
      <span class="h-2.5 w-2.5 rounded-full bg-rose-500/70"></span>
      <span class="h-2.5 w-2.5 rounded-full bg-amber-500/70"></span>
      <span class="h-2.5 w-2.5 rounded-full bg-violet-500/70"></span>
      <span class="ml-2">ntt-grc-hub /agent-stream {paused ? '(paused)' : ''}</span>
    </div>
    <div bind:this={scrollEl} class="h-[64vh] overflow-y-auto px-3 py-2 font-mono text-[12px] leading-relaxed text-slate-200 scrollbar-thin">
      {#each visible as r (r.id)}
        {@const agent = agentsById.get(r.agentId)}
        <div class="flex items-start gap-2 whitespace-pre-wrap py-0.5">
          <span class="text-slate-500">[{fmtTs(r.startedAt)}]</span>
          <span class="rounded bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider {typeColor(agent?.type)}">{agent?.type ?? 'agent'}</span>
          <span class="text-violet-300">{r.agentName ?? r.agentId}:</span>
          <span class="flex-1 text-slate-200">{r.outputSummary || r.inputSummary}</span>
          <span class="text-slate-500">({r.latencyMs}ms · {fmtCost(r.costCents)})</span>
          <span class="{statusColor(r.status)}">[{r.status}]</span>
        </div>
      {:else}
        <div class="py-6 text-center text-slate-500">No events match the active filters.</div>
      {/each}
    </div>
  </div>
</div>
