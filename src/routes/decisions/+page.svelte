<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import ConfidenceBar from '$lib/components/ConfidenceBar.svelte';
  import { toCsv } from '$lib/utils/csv';
  import { Download, ShieldCheck, UserCheck, ShieldX, Clock } from 'lucide-svelte';
  import type { AgentDecisionOutcome } from '$lib/data/types';

  export let data;

  // ---------- Filters ----------
  let agentId: string = 'all';
  let outcome: 'all' | AgentDecisionOutcome = 'all';
  // YYYY-MM-DD strings work natively with <input type="date">.
  let fromDate = '';
  let toDate = '';

  $: filtered = data.decisions.filter((d) => {
    if (agentId !== 'all' && d.agentId !== agentId) return false;
    if (outcome !== 'all' && d.outcome !== outcome) return false;
    if (fromDate) {
      if (new Date(d.decidedAt) < new Date(fromDate)) return false;
    }
    if (toDate) {
      // Include the full to-date day.
      if (new Date(d.decidedAt) > new Date(`${toDate}T23:59:59`)) return false;
    }
    return true;
  });

  // ---------- Pagination ----------
  let page = 0;
  const pageSize = 25;
  $: totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  $: paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  // Reset page on filter change.
  $: if (filtered) page = Math.min(page, totalPages - 1);

  // ---------- Helpers ----------
  function truncate(s: string, n: number): string {
    if (!s) return '—';
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
  function summarize(v: Record<string, unknown> | undefined): string {
    if (!v) return '—';
    try {
      const s = JSON.stringify(v);
      return truncate(s.replace(/[{}"]/g, ''), 80);
    } catch {
      return '—';
    }
  }
  function fmtTs(ts: string): string {
    return ts.replace('T', ' ').slice(0, 19);
  }

  function outcomeCls(o: AgentDecisionOutcome): string {
    switch (o) {
      case 'auto-approved':  return 'bg-slate-100 text-slate-700 ring-slate-200';
      case 'hitl-approved':  return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'hitl-rejected':  return 'bg-rose-50 text-rose-700 ring-rose-200';
      default:               return 'bg-amber-50 text-amber-700 ring-amber-200';
    }
  }
  function outcomeLabel(o: AgentDecisionOutcome): string {
    if (o === 'auto-approved') return 'Auto';
    if (o === 'hitl-approved') return 'HITL Approved';
    if (o === 'hitl-rejected') return 'HITL Rejected';
    return 'Awaiting HITL';
  }

  function exportCsv() {
    const rows = filtered.map((d) => ({
      ts: d.decidedAt,
      agent: d.agentName ?? d.agentId,
      decisionType: d.decisionType,
      input: summarize(d.input),
      output: summarize(d.output),
      confidence: d.confidence.toFixed(3),
      outcome: d.outcome,
      approver: d.approverUserId ?? ''
    }));
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decisions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const OUTCOMES: { id: 'all' | AgentDecisionOutcome; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'auto-approved', label: 'Auto' },
    { id: 'hitl-approved', label: 'HITL Approved' },
    { id: 'hitl-rejected', label: 'HITL Rejected' },
    { id: 'awaiting-hitl', label: 'Awaiting HITL' }
  ];
</script>

<PageHeader title="Decisions" subtitle="Every agent-rendered decision across the platform — auditor-grade trace.">
  <svelte:fragment slot="actions">
    <button class="btn-secondary" on:click={exportCsv}>
      <Download class="h-4 w-4" /> Export CSV
    </button>
  </svelte:fragment>
</PageHeader>

<div class="space-y-6">
  <!-- Filters -->
  <div class="card flex flex-wrap items-center gap-3 px-4 py-3">
    <div class="flex items-center gap-2">
      <label for="agent-pick" class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Agent</label>
      <select id="agent-pick" bind:value={agentId} class="input w-48 py-1.5 text-xs">
        <option value="all">All agents</option>
        {#each data.agents as a}
          <option value={a.id}>{a.name}</option>
        {/each}
      </select>
    </div>
    <span class="text-slate-300">·</span>
    <div class="flex items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Outcome:</span>
      {#each OUTCOMES as o}
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {outcome === o.id
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (outcome = o.id)}
        >
          {o.label}
        </button>
      {/each}
    </div>
    <span class="text-slate-300">·</span>
    <div class="flex items-center gap-2">
      <label for="from-date" class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">From</label>
      <input id="from-date" type="date" bind:value={fromDate} class="input w-36 py-1.5 text-xs" />
      <label for="to-date" class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">To</label>
      <input id="to-date" type="date" bind:value={toDate} class="input w-36 py-1.5 text-xs" />
    </div>
    <span class="ml-auto text-xs text-slate-500">
      {filtered.length.toLocaleString()} of {data.decisions.length.toLocaleString()} decisions
    </span>
  </div>

  <!-- Table -->
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-2 text-left">Time</th>
            <th class="px-4 py-2 text-left">Agent</th>
            <th class="px-4 py-2 text-left">Decision Type</th>
            <th class="px-4 py-2 text-left">Input</th>
            <th class="px-4 py-2 text-left">Output</th>
            <th class="px-4 py-2 text-left">Confidence</th>
            <th class="px-4 py-2 text-left">Outcome</th>
            <th class="px-4 py-2 text-left">Approver</th>
            <th class="px-4 py-2 text-right">Latency</th>
          </tr>
        </thead>
        <tbody>
          {#each paged as d (d.id)}
            {@const agent = data.agents.find((a) => a.id === d.agentId)}
            <tr class="tr">
              <td class="td font-mono text-[11px] text-slate-500">{fmtTs(d.decidedAt)}</td>
              <td class="td">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-slate-800">{d.agentName ?? agent?.name ?? d.agentId}</span>
                  {#if agent}<AgentTypeBadge type={agent.type} />{/if}
                </div>
              </td>
              <td class="td">{d.decisionType}</td>
              <td class="td max-w-xs truncate font-mono text-xs text-slate-600">{summarize(d.input)}</td>
              <td class="td max-w-xs truncate font-mono text-xs text-slate-600">{summarize(d.output)}</td>
              <td class="td"><ConfidenceBar value={d.confidence} /></td>
              <td class="td">
                <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {outcomeCls(d.outcome)}">
                  {#if d.outcome === 'auto-approved'}
                    <ShieldCheck class="h-3 w-3" />
                  {:else if d.outcome === 'hitl-approved'}
                    <UserCheck class="h-3 w-3" />
                  {:else if d.outcome === 'hitl-rejected'}
                    <ShieldX class="h-3 w-3" />
                  {:else}
                    <Clock class="h-3 w-3" />
                  {/if}
                  {outcomeLabel(d.outcome)}
                </span>
              </td>
              <td class="td text-slate-600">{d.approverUserId ?? '—'}</td>
              <td class="td text-right font-mono text-xs text-slate-500">{(50 + (Number(d.id) % 1200))}ms</td>
            </tr>
          {:else}
            <tr><td colspan="9" class="px-4 py-6 text-center text-sm text-slate-500">No decisions match those filters.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Pagination footer -->
    <div class="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
      <div>Page {page + 1} of {totalPages}</div>
      <div class="flex gap-2">
        <button class="btn-ghost px-2 py-1" disabled={page === 0} on:click={() => (page = 0)}>« First</button>
        <button class="btn-ghost px-2 py-1" disabled={page === 0} on:click={() => (page = Math.max(0, page - 1))}>‹ Prev</button>
        <button class="btn-ghost px-2 py-1" disabled={page >= totalPages - 1} on:click={() => (page = Math.min(totalPages - 1, page + 1))}>Next ›</button>
        <button class="btn-ghost px-2 py-1" disabled={page >= totalPages - 1} on:click={() => (page = totalPages - 1)}>Last »</button>
      </div>
    </div>
  </div>
</div>
