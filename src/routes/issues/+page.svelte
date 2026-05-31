<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import { addToast } from '$lib/stores/toast';
  import { downloadCsv } from '$lib/utils/csv';
  import { enhance } from '$app/forms';
  import { ListChecks, AlertTriangle, CheckCircle2, Clock, Search, ChevronRight, Download, Plus, User as UserIcon, Siren, ShieldOff } from 'lucide-svelte';
  import type { Issue, IssueSource, RiskSeverity, IssueStatus, Incident, IncidentSeverity, IncidentStatus } from '$lib/data/types';

  export let data;
  export let form: {
    issueCreated?: boolean; issueError?: string;
    incidentCreated?: boolean; incidentError?: string; code?: string;
    incStatusUpdated?: boolean; incStatusError?: string; incidentId?: string; newStatus?: string;
  } | undefined = undefined;

  $: if (form?.issueCreated) { addToast('success', 'Issue created.'); showIssueForm = false; }
  $: if (form?.issueError) addToast('error', form.issueError);
  $: if (form?.incidentCreated) { addToast('success', `Incident ${form.code} opened.`); showIncidentForm = false; }
  $: if (form?.incidentError) addToast('error', form.incidentError);
  $: if (form?.incStatusUpdated) addToast('success', `Incident status → ${form.newStatus}.`);
  $: if (form?.incStatusError) addToast('error', form.incStatusError);

  let showIssueForm = false;
  let showIncidentForm = false;
  let activeTab: 'issues' | 'incidents' = 'issues';

  // ---------- Issue KPIs ----------
  $: open = data.issues.filter((i) => i.status === 'open' || i.status === 'in-progress').length;
  $: critical = data.issues.filter((i) => i.severity === 'critical').length;
  $: overdue = data.issues.filter((i) => i.dueAt && new Date(i.dueAt).getTime() < Date.now() && i.status !== 'resolved').length;
  $: resolved30d = data.issues.filter((i) => i.status === 'resolved' && i.dueAt && (Date.now() - new Date(i.dueAt).getTime()) < 30 * 86_400_000).length;

  // ---------- Incident KPIs ----------
  $: openInc = data.incidents.filter((i) => i.status === 'open' || i.status === 'contained').length;
  $: sev1Inc = data.incidents.filter((i) => i.status !== 'resolved' && i.status !== 'postmortem-done' && i.severity === 'sev1').length;
  $: resolvedInc = data.incidents.filter((i) => i.status === 'resolved' || i.status === 'postmortem-done').length;

  // ---------- Issue Filters ----------
  type SourceF = 'all' | IssueSource;
  type SevF = 'all' | RiskSeverity;
  type StatF = 'all' | IssueStatus;
  let sourceFilter: SourceF = 'all';
  let sevFilter: SevF = 'all';
  let statusFilter: StatF = 'all';
  let search = '';
  let incSearch = '';
  let incSevFilter: 'all' | IncidentSeverity = 'all';
  let incStatFilter: 'all' | IncidentStatus = 'all';

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
  const INC_SEVS: { id: 'all' | IncidentSeverity; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'sev1', label: 'Sev1' },
    { id: 'sev2', label: 'Sev2' },
    { id: 'sev3', label: 'Sev3' },
    { id: 'sev4', label: 'Sev4' }
  ];
  const INC_STATUSES: { id: 'all' | IncidentStatus; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'Open' },
    { id: 'contained', label: 'Contained' },
    { id: 'resolved', label: 'Resolved' },
    { id: 'postmortem-done', label: 'Postmortem' }
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

  $: filteredInc = data.incidents.filter((i) => {
    if (incSevFilter !== 'all' && i.severity !== incSevFilter) return false;
    if (incStatFilter !== 'all' && i.status !== incStatFilter) return false;
    if (incSearch.trim()) {
      const q = incSearch.toLowerCase();
      if (!i.code.toLowerCase().includes(q) && !i.title.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ---------- Pagination ----------
  const PAGE = 25;
  let page = 1;
  $: pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  $: pageRows = filtered.slice((page - 1) * PAGE, page * PAGE);
  $: if (page > pageCount) page = 1;

  let incPage = 1;
  $: incPageCount = Math.max(1, Math.ceil(filteredInc.length / PAGE));
  $: incPageRows = filteredInc.slice((incPage - 1) * PAGE, incPage * PAGE);
  $: if (incPage > incPageCount) incPage = 1;

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
  function incSevCls(s: IncidentSeverity): string {
    if (s === 'sev1') return 'bg-rose-100 text-rose-800 ring-rose-200';
    if (s === 'sev2') return 'bg-orange-50 text-orange-700 ring-orange-200';
    if (s === 'sev3') return 'bg-amber-50 text-amber-700 ring-amber-200';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
  function incStatCls(s: IncidentStatus): string {
    if (s === 'open')            return 'bg-rose-50 text-rose-700 ring-rose-200';
    if (s === 'contained')       return 'bg-amber-50 text-amber-700 ring-amber-200';
    if (s === 'resolved')        return 'bg-violet-50 text-violet-700 ring-violet-200';
    if (s === 'postmortem-done') return 'bg-green-50 text-green-700 ring-green-200';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
  function statusCls(s: IssueStatus): string {
    switch (s) {
      case 'open':          return 'bg-rose-50 text-rose-700 ring-rose-200';
      case 'in-progress':   return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'resolved':      return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'accepted-risk': return 'bg-amber-50 text-amber-700 ring-amber-200';
    }
  }
  function sourceCls(s: IssueSource): string {
    switch (s) {
      case 'audit':          return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'risk-treatment': return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'incident':       return 'bg-rose-50 text-rose-700 ring-rose-200';
      case 'control-test':   return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'regulatory':     return 'bg-amber-50 text-amber-700 ring-amber-200';
    }
  }

  function escapeCsv(s: string): string {
    if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }
  function exportCsv() {
    const headers = ['id','source','source_id','title','severity','status','owner','due_at'];
    const rows = filtered.map((i) => [i.id, i.source, i.sourceId, i.title, i.severity, i.status, i.ownerEmail ?? '', i.dueAt ?? '']);
    const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
    downloadCsv(`issues-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    addToast('success', `Issues CSV exported (${rows.length} rows).`);
  }
  function exportIncCsv() {
    const headers = ['code','title','severity','status','opened_at','contained_at','resolved_at'];
    const rows = filteredInc.map((i) => [i.code, i.title, i.severity, i.status, i.openedAt, i.containedAt ?? '', i.resolvedAt ?? '']);
    const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
    downloadCsv(`incidents-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    addToast('success', `Incidents CSV exported (${rows.length} rows).`);
  }
</script>

<PageHeader
  title="Issues & Incidents"
  subtitle="{activeTab === 'issues' ? `${data.issues.length.toLocaleString()} issues · ${open} open · ${overdue} overdue` : `${data.incidents.length.toLocaleString()} incidents · ${openInc} active`}{data.isAll ? ' · aggregated view' : ''}"
>
  <svelte:fragment slot="actions">
    {#if activeTab === 'issues'}
      <button class="btn-primary" on:click={() => { showIssueForm = !showIssueForm; showIncidentForm = false; }}>
        <Plus class="h-4 w-4" />
        <span>New Issue</span>
      </button>
      <button class="btn-secondary" on:click={exportCsv}>
        <Download class="h-4 w-4" />
        <span>Export CSV</span>
      </button>
    {:else}
      <button class="btn-primary" on:click={() => { showIncidentForm = !showIncidentForm; showIssueForm = false; }}>
        <Plus class="h-4 w-4" />
        <span>New Incident</span>
      </button>
      <button class="btn-secondary" on:click={exportIncCsv}>
        <Download class="h-4 w-4" />
        <span>Export CSV</span>
      </button>
    {/if}
  </svelte:fragment>
</PageHeader>

<!-- Tab switcher -->
<div class="flex gap-1 border-b border-slate-200 mb-6">
  <button
    class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'issues' ? 'border-grc-primary text-grc-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}"
    on:click={() => activeTab = 'issues'}>
    <ListChecks class="inline h-4 w-4 mr-1" />
    Issues ({data.issues.length})
  </button>
  <button
    class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'incidents' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-700'}"
    on:click={() => activeTab = 'incidents'}>
    <Siren class="inline h-4 w-4 mr-1" />
    Incidents ({data.incidents.length})
    {#if sev1Inc > 0}
      <span class="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white">{sev1Inc}</span>
    {/if}
  </button>
</div>

{#if activeTab === 'issues'}
  {#if showIssueForm}
    <div class="card p-5 mb-6">
      <h3 class="mb-3 text-sm font-semibold text-grc-ink">New issue</h3>
      <form method="POST" action="?/createIssue" use:enhance class="flex flex-wrap items-end gap-3">
        <label class="block flex-1 min-w-[260px]">
          <span class="mb-1 block text-xs font-medium text-slate-700">Title</span>
          <input name="title" type="text" class="input" placeholder="Describe the issue…" required maxlength="256" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Source</span>
          <select name="source" class="input">
            <option value="audit">Audit</option>
            <option value="risk-treatment">Risk Treatment</option>
            <option value="incident">Incident</option>
            <option value="control-test">Control Test</option>
            <option value="regulatory">Regulatory</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Severity</span>
          <select name="severity" class="input">
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium" selected>Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Due date (optional)</span>
          <input name="dueAt" type="date" class="input" />
        </label>
        <div class="flex gap-2">
          <button type="submit" class="btn-primary">Create</button>
          <button type="button" class="btn-secondary" on:click={() => (showIssueForm = false)}>Cancel</button>
        </div>
      </form>
    </div>
  {/if}

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
        <CheckCircle2 slot="icon" class="h-4 w-4 text-violet-600" />
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
                  <a href="/issues/{i.id}" class="text-grc-primary hover:underline">{i.id.slice(0, 8)}</a>
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
                    <span>{i.ownerEmail ?? '—'}</span>
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

{:else}
  <!-- Incidents tab -->

  {#if showIncidentForm}
    <div class="card p-5 mb-6">
      <h3 class="mb-3 text-sm font-semibold text-grc-ink">Open new incident</h3>
      <form method="POST" action="?/createIncident" use:enhance class="flex flex-wrap items-end gap-3">
        <label class="block flex-1 min-w-[260px]">
          <span class="mb-1 block text-xs font-medium text-slate-700">Title</span>
          <input name="title" type="text" class="input" placeholder="Describe the incident…" required maxlength="256" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Severity</span>
          <select name="severity" class="input">
            <option value="sev1">Sev1 — Critical</option>
            <option value="sev2">Sev2 — High</option>
            <option value="sev3" selected>Sev3 — Medium</option>
            <option value="sev4">Sev4 — Low</option>
          </select>
        </label>
        <div class="flex gap-2">
          <button type="submit" class="btn-primary">Open Incident</button>
          <button type="button" class="btn-secondary" on:click={() => (showIncidentForm = false)}>Cancel</button>
        </div>
      </form>
    </div>
  {/if}

  <div class="space-y-6">
    <!-- Incident KPI strip -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Kpi label="Active Incidents" value={openInc.toString()} tone={openInc > 0 ? 'bad' : 'default'}>
        <Siren slot="icon" class="h-4 w-4 text-rose-600" />
      </Kpi>
      <Kpi label="Sev1 Open" value={sev1Inc.toString()} tone={sev1Inc > 0 ? 'bad' : 'default'}>
        <ShieldOff slot="icon" class="h-4 w-4 text-rose-600" />
      </Kpi>
      <Kpi label="Resolved / Postmortem" value={resolvedInc.toString()}>
        <CheckCircle2 slot="icon" class="h-4 w-4 text-violet-600" />
      </Kpi>
    </div>

    <!-- Incident filter bar -->
    <div class="card flex flex-wrap items-center gap-3 px-4 py-3">
      <div class="flex items-center gap-1">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Severity:</span>
        {#each INC_SEVS as f}
          <button type="button"
            class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {incSevFilter === f.id
              ? 'bg-rose-500 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
            on:click={() => (incSevFilter = f.id)}>{f.label}</button>
        {/each}
      </div>
      <span class="text-slate-300">·</span>
      <div class="flex items-center gap-1">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status:</span>
        {#each INC_STATUSES as f}
          <button type="button"
            class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {incStatFilter === f.id
              ? 'bg-rose-500 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
            on:click={() => (incStatFilter = f.id)}>{f.label}</button>
        {/each}
      </div>
      <div class="relative ml-auto w-full sm:w-64">
        <Search class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type="search" bind:value={incSearch} placeholder="Search incidents…" class="input pl-8" />
      </div>
    </div>

    <!-- Incident table -->
    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Code</th>
              <th class="px-4 py-2 text-left">Title</th>
              <th class="px-4 py-2 text-left">Severity</th>
              <th class="px-4 py-2 text-left">Status</th>
              <th class="px-4 py-2 text-left">Opened</th>
              <th class="px-4 py-2 text-left">Update Status</th>
            </tr>
          </thead>
          <tbody>
            {#each incPageRows as inc (inc.id)}
              <tr class="tr">
                <td class="td font-mono text-xs font-semibold">
                  <a href="/issues/incidents/{inc.id}" class="text-rose-700 hover:underline">{inc.code}</a>
                </td>
                <td class="td max-w-md truncate">
                  <a href="/issues/incidents/{inc.id}" class="hover:underline">{inc.title}</a>
                </td>
                <td class="td">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {incSevCls(inc.severity)}">{inc.severity.toUpperCase()}</span>
                </td>
                <td class="td">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {incStatCls(inc.status)}">{inc.status}</span>
                </td>
                <td class="td text-xs text-slate-500">{fmtRel(inc.openedAt)}</td>
                <td class="td">
                  {#if inc.status !== 'postmortem-done'}
                    <form method="POST" action="?/updateIncidentStatus" use:enhance class="flex items-center gap-1">
                      <input type="hidden" name="incidentId" value={inc.id} />
                      <select name="status" class="input py-0.5 text-xs">
                        {#each INC_STATUSES.filter(s => s.id !== 'all') as s}
                          <option value={s.id} selected={s.id === inc.status}>{s.label}</option>
                        {/each}
                      </select>
                      <button type="submit" class="btn-ghost py-0.5 text-xs">Save</button>
                    </form>
                  {:else}
                    <span class="text-xs text-slate-400">Closed</span>
                  {/if}
                </td>
              </tr>
            {:else}
              <tr><td colspan="6" class="px-4 py-8 text-center text-sm text-slate-500">No incidents match.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if filteredInc.length > 0}
        <div class="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          <span>Showing {(incPage - 1) * PAGE + 1}–{Math.min(incPage * PAGE, filteredInc.length)} of {filteredInc.length.toLocaleString()}</span>
          <div class="flex items-center gap-2">
            <button class="btn-ghost py-1 text-xs" on:click={() => incPage = Math.max(1, incPage - 1)} disabled={incPage === 1}>Prev</button>
            <span class="font-mono">{incPage} / {incPageCount}</span>
            <button class="btn-ghost py-1 text-xs" on:click={() => incPage = Math.min(incPageCount, incPage + 1)} disabled={incPage === incPageCount}>Next</button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
