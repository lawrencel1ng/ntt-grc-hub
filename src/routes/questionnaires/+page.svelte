<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import Gauge from '$lib/components/Gauge.svelte';
  import ConfidenceBar from '$lib/components/ConfidenceBar.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import { FileQuestion, CheckCircle2, Clock, Bot, ChevronRight, Search } from 'lucide-svelte';
  import type { Questionnaire, QuestionnaireStatus } from '$lib/data/types';
  import { hashStringToInt } from '$lib/data/rng';

  export let data;

  // ---------- KPIs ----------
  $: total = data.questionnaires.length;
  $: completed = data.questionnaires.filter((q) => q.status === 'complete').length;
  $: inProgress = data.questionnaires.filter((q) => q.status === 'in-progress').length;
  $: autoCompleted = data.questionnaires.filter((q) => q.completedByAgentId).length;
  $: autoPct = total > 0 ? Math.round((autoCompleted / total) * 100) : 0;
  $: hoursSaved = autoCompleted * 8;

  // ---------- Filters ----------
  type TmplF = 'all' | 'SIG' | 'CAIQ' | 'Custom';
  type StatF = 'all' | QuestionnaireStatus;
  let tmplFilter: TmplF = 'all';
  let statusFilter: StatF = 'all';
  let agentOnly = false;
  let search = '';

  const TMPLS: { id: TmplF; label: string }[] = [
    { id: 'all',    label: 'All' },
    { id: 'SIG',    label: 'SIG' },
    { id: 'CAIQ',   label: 'CAIQ' },
    { id: 'Custom', label: 'Custom' }
  ];
  const STATUSES: { id: StatF; label: string }[] = [
    { id: 'all',         label: 'All' },
    { id: 'sent',        label: 'Sent' },
    { id: 'in-progress', label: 'In Progress' },
    { id: 'complete',    label: 'Complete' }
  ];

  $: filtered = data.questionnaires.filter((q) => {
    if (tmplFilter !== 'all' && q.template !== tmplFilter) return false;
    if (statusFilter !== 'all' && q.status !== statusFilter) return false;
    if (agentOnly && !q.completedByAgentId) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!(q.vendorName ?? '').toLowerCase().includes(s)) return false;
    }
    return true;
  });

  // ---------- Pagination ----------
  const PAGE = 25;
  let page = 1;
  $: pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  $: pageRows = filtered.slice((page - 1) * PAGE, page * PAGE);
  $: if (page > pageCount) page = 1;

  // ---------- Helpers ----------
  function templateCls(t: 'SIG' | 'CAIQ' | 'Custom'): string {
    switch (t) {
      case 'SIG':    return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'CAIQ':   return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'Custom': return 'bg-slate-100 text-slate-600 ring-slate-200';
    }
  }
  function statusCls(s: QuestionnaireStatus): string {
    switch (s) {
      case 'complete':    return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'in-progress': return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'sent':        return 'bg-amber-50 text-amber-700 ring-amber-200';
    }
  }
  function fmtDate(iso?: string): string {
    return iso ? iso.slice(0, 10) : '—';
  }
  // Deterministic per-questionnaire confidence (only meaningful when agent-completed).
  function avgConfidence(q: Questionnaire): number {
    const seed = hashStringToInt(q.id);
    return 78 + (seed % 18); // 78–95
  }
</script>

<PageHeader
  title="Vendor Questionnaires"
  subtitle="{total} questionnaires · Vendor Risk Analyst agent auto-completed {autoCompleted} of {total} ({autoPct}%) — saved ~{hoursSaved} analyst hours {data.isAll ? '· Maybank fallback' : ''}"
/>

<div class="space-y-6">
  <!-- Hero badge / agent ROI panel -->
  <div class="card flex items-center gap-3 bg-white px-5 py-3 ring-1 ring-inset ring-violet-200">
    <div class="rounded-md bg-violet-50 p-2 text-violet-700">
      <Bot class="h-5 w-5" />
    </div>
    <div class="flex-1">
      <div class="flex items-center gap-2 text-sm font-semibold text-slate-800">
        Vendor Risk Analyst agent — {autoPct}% auto-completion rate
        <AgentTypeBadge type="intelligent" />
      </div>
      <div class="mt-0.5 text-xs text-slate-600">
        {autoCompleted} of {total} questionnaires pre-filled from evidence corpus · ~{hoursSaved} analyst hours saved this month.
      </div>
    </div>
  </div>

  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Kpi label="Total Sent" value={total.toString()}>
      <FileQuestion slot="icon" class="h-4 w-4 text-grc-primary" />
    </Kpi>
    <Kpi label="Completed" value={completed.toString()}>
      <CheckCircle2 slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="In Progress" value={inProgress.toString()}>
      <Clock slot="icon" class="h-4 w-4 text-amber-600" />
    </Kpi>
    <Kpi label="Auto-Completed" value={autoCompleted.toString()} suffix="by agent">
      <Bot slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
  </div>

  <!-- Filter bar -->
  <div class="card flex flex-wrap items-center gap-3 px-4 py-3">
    <div class="flex items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Template:</span>
      {#each TMPLS as f}
        <button type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {tmplFilter === f.id
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (tmplFilter = f.id)}>{f.label}</button>
      {/each}
    </div>
    <span class="text-slate-300">·</span>
    <div class="flex items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status:</span>
      {#each STATUSES as f}
        <button type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {statusFilter === f.id
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (statusFilter = f.id)}>{f.label}</button>
      {/each}
    </div>
    <label class="ml-1 inline-flex items-center gap-1.5 text-xs text-slate-600">
      <input type="checkbox" bind:checked={agentOnly} class="rounded border-slate-300" />
      Agent-completed only
    </label>
    <div class="relative ml-auto w-full sm:w-64">
      <Search class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input type="search" bind:value={search} placeholder="Search by vendor…" class="input pl-8" />
    </div>
  </div>

  <!-- Table -->
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-2 text-left">Vendor</th>
            <th class="px-4 py-2 text-left">Template</th>
            <th class="px-4 py-2 text-left">Status</th>
            <th class="px-4 py-2 text-left">Sent</th>
            <th class="px-4 py-2 text-left">Completed</th>
            <th class="px-4 py-2 text-left">Score</th>
            <th class="px-4 py-2 text-left">Completed By</th>
            <th class="px-4 py-2 text-left">Confidence</th>
            <th class="w-8 px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each pageRows as q (q.id)}
            <tr class="tr">
              <td class="td max-w-xs truncate font-medium">
                <a href="/vendors/{q.vendorId}" class="text-grc-primary hover:underline">{q.vendorName ?? q.vendorId}</a>
              </td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {templateCls(q.template)}">{q.template}</span>
              </td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {statusCls(q.status)}">{q.status}</span>
              </td>
              <td class="td font-mono text-xs text-slate-500">{fmtDate(q.sentAt)}</td>
              <td class="td font-mono text-xs text-slate-500">{fmtDate(q.completedAt)}</td>
              <td class="td">
                {#if q.score !== undefined}
                  <div class="w-20"><Gauge value={q.score} width={100} height={60} /></div>
                {:else}
                  <span class="text-slate-400">—</span>
                {/if}
              </td>
              <td class="td">
                {#if q.completedByAgentId}
                  <div class="flex items-center gap-1.5">
                    <AgentTypeBadge type="intelligent" />
                    <span class="text-xs text-slate-500">Vendor Risk Analyst</span>
                  </div>
                {:else if q.status === 'complete'}
                  <span class="text-xs text-slate-600">Risk Analyst (human)</span>
                {:else}
                  <span class="text-xs text-slate-400">—</span>
                {/if}
              </td>
              <td class="td">
                {#if q.completedByAgentId}
                  <ConfidenceBar value={avgConfidence(q)} />
                {:else}
                  <span class="text-xs text-slate-400">—</span>
                {/if}
              </td>
              <td class="td">
                <a href="/questionnaires/{q.id}" class="text-slate-400 hover:text-grc-primary">
                  <ChevronRight class="h-4 w-4" />
                </a>
              </td>
            </tr>
          {:else}
            <tr><td colspan="9" class="px-4 py-8 text-center text-sm text-slate-500">No questionnaires match.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if filtered.length > 0}
      <div class="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        <span>Showing {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, filtered.length)} of {filtered.length.toLocaleString()}</span>
        <div class="flex items-center gap-2">
          <button class="btn-ghost py-1 text-xs" on:click={() => page = Math.max(1, page - 1)} disabled={page === 1}>Prev</button>
          <span class="font-mono">{page} / {pageCount}</span>
          <button class="btn-ghost py-1 text-xs" on:click={() => page = Math.min(pageCount, page + 1)} disabled={page === pageCount}>Next</button>
        </div>
      </div>
    {/if}
  </div>
</div>
