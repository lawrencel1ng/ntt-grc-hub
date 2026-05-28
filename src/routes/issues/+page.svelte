<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import { addToast } from '$lib/stores/toast';
  import { ListChecks, AlertTriangle, CheckCircle2, Clock, Search, ChevronRight, Download, User as UserIcon } from 'lucide-svelte';
  import type { Issue, IssueSource, RiskSeverity, IssueStatus } from '$lib/data/types';

  export let data;

  // ---------- KPIs ----------
  $: open = data.issues.filter((i) => i.status === 'open' || i.status === 'in-progress').length;
  $: critical = data.issues.filter((i) => i.severity === 'critical').length;
  $: overdue = data.issues.filter((i) => i.dueAt && new Date(i.dueAt).getTime() < Date.now() && i.status !== 'resolved').length;
  $: resolved30d = data.issues.filter((i) => i.status === 'resolved' && i.dueAt && (Date.now() - new Date(i.dueAt).getTime()) < 30 * 86_400_000).length;

  // ---------- Filters ----------
  type SourceF = 'all' | IssueSource;
  type SevF = 'all' | RiskSeverity;
  type StatF = 'all' | IssueStatus;
  let sourceFilter: SourceF = 'all';
  let sevFilter: SevF = 'all';
  let statusFilter: StatF = 'all';
  let search = '';

  const SOURCES: { id: SourceF; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'audit', label: 'Audit' },
    { id: 'risk-treatment', label: 'Risk Tx' },
    { id: 'incident', label: 'Incident' },
    { id: 'control-test', label: 'Control' },
    { id: 'regulatory', label: 'Regulatory' }
  ];
  const SEVS: { id: SevF; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'critical', label: 'Critical' },
    { id: 'high', label: 'High' },
    { id: 'medium', label: 'Medium' },
    { id: 'low', label: 'Low' }
  ];
  const STATUSES: { id: StatF; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'Open' },
    { id: 'in-progress', label: 'In Progress' },
    { id: 'resolved', label: 'Resolved' },
    { id: 'accepted-risk', label: 'Accepted' }
  ];

  $: filtered = data.issues.filter((i) => {
    if (sourceFilter !== 'all' && i.source !== sourceFilter) return false;
    if (sevFilter !== 'all' && i.severity !== sevFilter) return false;
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!i.id.toLowerCase().includes(q) && !i.title.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ---------- Pagination ----------
  const PAGE = 25;
  let page = 1;
  $: pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  $: pageRows = filtered.slice((page - 1) * PAGE, page * PAGE);
  $: if (page > pageCount) page = 1;

  // ---------- Formatters ----------
  function fmtRel(iso?: string): string {
    if (!iso) return '—';
    const diff = (new Date(iso).getTime() - Date.now()) / 1000;
    const ad = Math.abs(diff);
    if (ad < 60) return diff > 0 ? 'soon' : 'now';
    if (ad < 3600) return `${Math.floor(ad / 60)}m ${diff > 0 ? '' : 'ago'}`;
    if (ad < 86400) return `${Math.floor(ad / 3600)}h ${diff > 0 ? '' : 'ago'}`;
    return `${Math.floor(ad / 86400)}d ${diff > 0 ? '' : 'ago'}`;
  }

  function dueCls(i: Issue): string {
    if (!i.dueAt) return 'text-slate-400';
    const ms = new Date(i.dueAt).getTime() - Date.now();
    if (ms < 0 && i.status !== 'resolved') return 'text-rose-600 font-medium';
    if (ms < 7 * 86_400_000) return 'text-amber-600';
    return 'text-slate-500';
  }
  function sevCls(s: RiskSeverity): string {
    if (s === 'critical') return 'bg-rose-100 text-rose-800 ring-rose-200';
    if (s === 'high')     return 'bg-orange-50 text-orange-700 ring-orange-200';
    if (s === 'medium')   return 'bg-amber-50 text-amber-700 ring-amber-200';
    if (s === 'low')      return 'bg-yellow-50 text-yellow-700 ring-yellow-200';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
  function statusCls(s: IssueStatus): string {
    switch (s) {
      case 'open':          return 'bg-rose-50 text-rose-700 ring-rose-200';
      case 'in-progress':   return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'resolved':      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
      case 'accepted-risk': return 'bg-amber-50 text-amber-700 ring-amber-200';
    }
  }
  function sourceCls(s: IssueSource): string {
    switch (s) {
      case 'audit':          return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'risk-treatment': return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'incident':       return 'bg-rose-50 text-rose-700 ring-rose-200';
      case 'control-test':   return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
      case 'regulatory':     return 'bg-amber-50 text-amber-700 ring-amber-200';
    }
  }

  function escapeCsv(s: string): string {
    if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }
  function exportCsv() {
    const headers = ['id','source','source_id','title','severity','status','owner','due_at'];
    const rows = filtered.map((i) => [i.id, i.source, i.sourceId, i.title, i.severity, i.status, i.ownerUserId ?? '', i.dueAt ?? '']);
    const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
    // eslint-disable-next-line no-console
    console.log(`[issues] CSV (${rows.length} rows):\n`, csv);
    addToast('success', `Issues CSV exported (${rows.length} rows).`);
  }
</script>

<PageHeader title="Issues & Incidents" subtitle="{data.issues.length.toLocaleString()} issues · {open} open · {overdue} overdue {data.isAll ? '· Maybank fallback' : ''}">
  <svelte:fragment slot="actions">
    <button class="btn-secondary" on:click={exportCsv}>
      <Download class="h-4 w-4" />
      <span>Export CSV</span>
    </button>
  </svelte:fragment>
</PageHeader>

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Kpi label="Open Issues" value={open.toString()}>
      <ListChecks slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
    <Kpi label="Critical" value={critical.toString()} tone="bad">
      <AlertTriangle slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
    <Kpi label="Overdue" value={overdue.toString()} tone="bad">
      <Clock slot="icon" class="h-4 w-4 text-amber-600" />
    </Kpi>
    <Kpi label="Resolved (30d)" value={resolved30d.toString()}>
      <CheckCircle2 slot="icon" class="h-4 w-4 text-emerald-600" />
    </Kpi>
  </div>

  <!-- Filter bar -->
  <div class="card flex flex-wrap items-center gap-3 px-4 py-3">
    <div class="flex items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Source:</span>
      {#each SOURCES as f}
        <button type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {sourceFilter === f.id
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (sourceFilter = f.id)}>{f.label}</button>
      {/each}
    </div>
    <span class="text-slate-300">·</span>
    <div class="flex items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Severity:</span>
      {#each SEVS as f}
        <button type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {sevFilter === f.id
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (sevFilter = f.id)}>{f.label}</button>
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
    <div class="relative ml-auto w-full sm:w-64">
      <Search class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input type="search" bind:value={search} placeholder="Search issues…" class="input pl-8" />
    </div>
  </div>

  <!-- Table -->
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-2 text-left">ID</th>
            <th class="px-4 py-2 text-left">Source</th>
            <th class="px-4 py-2 text-left">Title</th>
            <th class="px-4 py-2 text-left">Severity</th>
            <th class="px-4 py-2 text-left">Owner</th>
            <th class="px-4 py-2 text-left">Due</th>
            <th class="px-4 py-2 text-left">Status</th>
            <th class="w-8 px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each pageRows as i (i.id)}
            <tr class="tr">
              <td class="td font-mono text-xs">
                <a href="/issues/{i.id}" class="text-grc-primary hover:underline">{i.id.split('_').pop()}</a>
              </td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {sourceCls(i.source)}">{i.source}</span>
              </td>
              <td class="td max-w-md truncate">
                <a href="/issues/{i.id}" class="hover:underline">{i.title}</a>
              </td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {sevCls(i.severity)}">{i.severity}</span>
              </td>
              <td class="td">
                <div class="flex items-center gap-1.5 text-xs text-slate-500">
                  <UserIcon class="h-3 w-3" />
                  <span>{i.ownerUserId ?? 'unassigned'}</span>
                </div>
              </td>
              <td class="td text-xs {dueCls(i)}">{fmtRel(i.dueAt)}</td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {statusCls(i.status)}">{i.status}</span>
              </td>
              <td class="td">
                <a href="/issues/{i.id}" class="text-slate-400 hover:text-grc-primary">
                  <ChevronRight class="h-4 w-4" />
                </a>
              </td>
            </tr>
          {:else}
            <tr><td colspan="8" class="px-4 py-8 text-center text-sm text-slate-500">No issues match.</td></tr>
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
