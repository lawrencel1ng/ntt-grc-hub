<script lang="ts">
  import { enhance } from '$app/forms';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import { addToast } from '$lib/stores/toast';
  import { AlertTriangle, ShieldCheck, CheckCircle2, ListChecks, Activity, Search, ChevronRight, Plus, User as UserIcon, X } from 'lucide-svelte';
  import type { Risk, RiskSeverity, RiskLikelihood, RiskStatus, RiskTreatmentStrategy } from '$lib/data/types';

  export let data;
  export let form: { created?: boolean; error?: string } | null = null;

  // ---------- Scoring (sev × lik on 1..5 each, scale 0..25) ----------
  const SEV_RANK: Record<RiskSeverity, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
  const LIK_RANK: Record<RiskLikelihood, number> = { 'almost-certain': 5, likely: 4, possible: 3, unlikely: 2, rare: 1 };

  function inherentScore(r: Risk): number {
    return SEV_RANK[r.inherentSeverity] * LIK_RANK[r.inherentLikelihood];
  }
  function residualScore(r: Risk): number {
    return SEV_RANK[r.residualSeverity] * LIK_RANK[r.residualLikelihood];
  }

  function scoreCellColor(score: number): string {
    // 0..25 single-hue amber → rose ramp; matches Heatmap5x5 palette.
    if (score >= 20) return 'bg-rose-600 text-white';
    if (score >= 15) return 'bg-orange-500 text-white';
    if (score >= 10) return 'bg-amber-300 text-amber-900';
    if (score >= 5)  return 'bg-amber-100 text-amber-900';
    return 'bg-amber-50 text-amber-900';
  }

  // ---------- KPIs ----------
  $: total = data.risks.length;
  $: critical = data.risks.filter((r) => r.residualSeverity === 'critical').length;
  $: mitigated30d = data.risks.filter((r) => {
    if (r.status !== 'treated' && r.status !== 'monitoring') return false;
    if (!r.lastAssessedAt) return false;
    return (Date.now() - new Date(r.lastAssessedAt).getTime()) < 30 * 86_400_000;
  }).length;
  $: accepted = data.risks.filter((r) => r.treatmentStrategy === 'accept').length;
  $: avgResidualScore = total > 0
    ? +(data.risks.reduce((s, r) => s + residualScore(r), 0) / total).toFixed(1)
    : 0;

  // ---------- Filter state ----------
  let categoryFilter = 'all';
  type StatusF = 'all' | RiskStatus;
  type TreatF = 'all' | RiskTreatmentStrategy;
  let statusFilter: StatusF = 'all';
  let treatmentFilter: TreatF = 'all';
  let search = '';

  $: categories = Array.from(new Set(data.risks.map((r) => r.category))).sort();

  const STATUS_FILTERS: { id: StatusF; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'identified', label: 'Identified' },
    { id: 'assessed', label: 'Assessed' },
    { id: 'treated', label: 'Treated' },
    { id: 'monitoring', label: 'Monitoring' },
    { id: 'closed', label: 'Closed' }
  ];
  const TREATMENT_FILTERS: { id: TreatF; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'mitigate', label: 'Mitigate' },
    { id: 'accept', label: 'Accept' },
    { id: 'transfer', label: 'Transfer' },
    { id: 'avoid', label: 'Avoid' }
  ];

  // ---------- Sort state ----------
  type SortKey = 'code' | 'title' | 'category' | 'inherent' | 'residual' | 'nextReview';
  let sortKey: SortKey = 'residual';
  let sortDir: 'asc' | 'desc' = 'desc';
  function toggleSort(k: SortKey) {
    if (sortKey === k) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortKey = k; sortDir = k === 'residual' || k === 'inherent' ? 'desc' : 'asc'; }
  }

  $: filtered = data.risks.filter((r) => {
    if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (treatmentFilter !== 'all' && r.treatmentStrategy !== treatmentFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!r.code.toLowerCase().includes(q) && !r.title.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  $: sorted = (() => {
    const arr = filtered.slice();
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'code':       cmp = a.code.localeCompare(b.code); break;
        case 'title':      cmp = a.title.localeCompare(b.title); break;
        case 'category':   cmp = a.category.localeCompare(b.category); break;
        case 'inherent':   cmp = inherentScore(a) - inherentScore(b); break;
        case 'residual':   cmp = residualScore(a) - residualScore(b); break;
        case 'nextReview': cmp = (a.nextReviewAt ?? '').localeCompare(b.nextReviewAt ?? ''); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  })();

  // ---------- Pagination ----------
  const PAGE = 25;
  let page = 1;
  $: pageCount = Math.max(1, Math.ceil(sorted.length / PAGE));
  $: pageRows = sorted.slice((page - 1) * PAGE, page * PAGE);
  $: if (page > pageCount) page = 1;

  // ---------- Formatters ----------
  function fmtRel(iso?: string): string {
    if (!iso) return '—';
    const diff = (new Date(iso).getTime() - Date.now()) / 1000;
    const ad = Math.abs(diff);
    if (ad < 60) return diff > 0 ? 'soon' : 'now';
    if (ad < 3600) return `${Math.floor(ad / 60)}m ${diff > 0 ? '' : 'ago'}`;
    if (ad < 86400) return `${Math.floor(ad / 3600)}h ${diff > 0 ? '' : 'ago'}`;
    const days = Math.floor(ad / 86400);
    return `${days}d ${diff > 0 ? '' : 'ago'}`;
  }

  function nextReviewColor(iso?: string): string {
    if (!iso) return 'text-slate-400';
    const ms = new Date(iso).getTime() - Date.now();
    if (ms < 0) return 'text-rose-600 font-medium';
    if (ms < 14 * 86_400_000) return 'text-amber-600 font-medium';
    return 'text-slate-500';
  }

  function categoryCls(cat: string): string {
    const m: Record<string, string> = {
      cyber:        'bg-rose-50 text-rose-700 ring-rose-200',
      technology:   'bg-blue-50 text-blue-700 ring-blue-200',
      'third-party':'bg-violet-50 text-violet-700 ring-violet-200',
      regulatory:   'bg-amber-50 text-amber-700 ring-amber-200',
      financial:    'bg-violet-50 text-violet-700 ring-violet-200',
      operational:  'bg-slate-100 text-slate-700 ring-slate-200',
      people:       'bg-pink-50 text-pink-700 ring-pink-200',
      privacy:      'bg-indigo-50 text-indigo-700 ring-indigo-200',
      ai:           'bg-violet-50 text-violet-700 ring-violet-200',
      climate:      'bg-violet-50 text-violet-700 ring-violet-200'
    };
    return m[cat] ?? 'bg-slate-100 text-slate-700 ring-slate-200';
  }

  function treatmentCls(t: RiskTreatmentStrategy): string {
    switch (t) {
      case 'mitigate': return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'accept':   return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'transfer': return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'avoid':    return 'bg-rose-50 text-rose-700 ring-rose-200';
    }
  }

  // ---------- Create Risk form ----------
  let showCreateForm = false;

  $: if (form?.created) {
    addToast('success', 'Risk created.');
    showCreateForm = false;
  }

  function newRisk() {
    showCreateForm = !showCreateForm;
  }
</script>

<PageHeader
  title="Enterprise Risk Register"
  subtitle="{total.toLocaleString()} risks · avg residual score {avgResidualScore} / 25 {data.isAll ? '· aggregated view' : ''}"
>
  <svelte:fragment slot="actions">
    <button class="btn-primary" on:click={newRisk}>
      <Plus class="h-4 w-4" />
      <span>New Risk</span>
    </button>
  </svelte:fragment>
</PageHeader>

{#if showCreateForm}
  <div class="card mt-4 p-5 space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-base font-semibold text-slate-800">New Risk</h2>
      <button type="button" class="text-slate-400 hover:text-slate-600" on:click={() => (showCreateForm = false)}>
        <X class="h-4 w-4" />
      </button>
    </div>

    {#if form?.error}
      <p class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{form.error}</p>
    {/if}

    <form method="POST" action="?/createRisk" use:enhance class="space-y-4">
      <!-- Row 1: Title + Category -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label for="cr-title" class="block text-xs font-semibold text-slate-600 mb-1">Title <span class="text-rose-500">*</span></label>
          <input id="cr-title" name="title" type="text" required class="input w-full" placeholder="e.g. SQL injection on customer portal" />
        </div>
        <div>
          <label for="cr-category" class="block text-xs font-semibold text-slate-600 mb-1">Category <span class="text-rose-500">*</span></label>
          <select id="cr-category" name="category" required class="input w-full">
            <option value="">Select…</option>
            <option value="Cyber">Cyber</option>
            <option value="Operational">Operational</option>
            <option value="Compliance">Compliance</option>
            <option value="Third-party">Third-party</option>
            <option value="Strategic">Strategic</option>
            <option value="Financial">Financial</option>
          </select>
        </div>
      </div>

      <!-- Description -->
      <div>
        <label for="cr-description" class="block text-xs font-semibold text-slate-600 mb-1">Description</label>
        <textarea id="cr-description" name="description" rows="2" class="input w-full resize-none" placeholder="Optional context…"></textarea>
      </div>

      <!-- Inherent scores -->
      <fieldset class="rounded-lg border border-slate-200 px-4 py-3 space-y-3">
        <legend class="px-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Inherent Risk</legend>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="cr-inh-sev" class="block text-xs font-semibold text-slate-600 mb-1">Severity <span class="text-rose-500">*</span></label>
            <select id="cr-inh-sev" name="inherentSeverity" required class="input w-full">
              <option value="">Select…</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
          </div>
          <div>
            <label for="cr-inh-lik" class="block text-xs font-semibold text-slate-600 mb-1">Likelihood <span class="text-rose-500">*</span></label>
            <select id="cr-inh-lik" name="inherentLikelihood" required class="input w-full">
              <option value="">Select…</option>
              <option value="almost-certain">Almost Certain</option>
              <option value="likely">Likely</option>
              <option value="possible">Possible</option>
              <option value="unlikely">Unlikely</option>
              <option value="rare">Rare</option>
            </select>
          </div>
        </div>
      </fieldset>

      <!-- Residual scores -->
      <fieldset class="rounded-lg border border-slate-200 px-4 py-3 space-y-3">
        <legend class="px-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Residual Risk</legend>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="cr-res-sev" class="block text-xs font-semibold text-slate-600 mb-1">Severity <span class="text-rose-500">*</span></label>
            <select id="cr-res-sev" name="residualSeverity" required class="input w-full">
              <option value="">Select…</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
          </div>
          <div>
            <label for="cr-res-lik" class="block text-xs font-semibold text-slate-600 mb-1">Likelihood <span class="text-rose-500">*</span></label>
            <select id="cr-res-lik" name="residualLikelihood" required class="input w-full">
              <option value="">Select…</option>
              <option value="almost-certain">Almost Certain</option>
              <option value="likely">Likely</option>
              <option value="possible">Possible</option>
              <option value="unlikely">Unlikely</option>
              <option value="rare">Rare</option>
            </select>
          </div>
        </div>
      </fieldset>

      <!-- Treatment Strategy -->
      <div>
        <label for="cr-treatment" class="block text-xs font-semibold text-slate-600 mb-1">Treatment Strategy</label>
        <select id="cr-treatment" name="treatmentStrategy" class="input w-64">
          <option value="mitigate">Mitigate</option>
          <option value="accept">Accept</option>
          <option value="transfer">Transfer</option>
          <option value="avoid">Avoid</option>
        </select>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3 pt-1">
        <button type="submit" class="btn-primary">Create Risk</button>
        <button type="button" class="btn-ghost" on:click={() => (showCreateForm = false)}>Cancel</button>
      </div>
    </form>
  </div>
{/if}

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
    <Kpi label="Total Risks" value={total.toLocaleString()}>
      <AlertTriangle slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
    <Kpi label="Critical (residual)" value={critical.toString()} tone="bad">
      <AlertTriangle slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
    <Kpi label="Mitigated (30d)" value={mitigated30d.toString()}>
      <CheckCircle2 slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Accepted" value={accepted.toString()}>
      <ShieldCheck slot="icon" class="h-4 w-4 text-amber-600" />
    </Kpi>
    <Kpi label="Avg Residual Score" value={avgResidualScore.toString()} suffix="/ 25" hint="sev × lik">
      <Activity slot="icon" class="h-4 w-4 text-grc-primary" />
    </Kpi>
  </div>

  <!-- Filter bar -->
  <div class="card flex flex-wrap items-center gap-3 px-4 py-3">
    <select bind:value={categoryFilter} class="input w-44 py-1.5">
      <option value="all">All categories</option>
      {#each categories as c}
        <option value={c}>{c}</option>
      {/each}
    </select>
    <span class="text-slate-300">·</span>
    <div class="flex items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status:</span>
      {#each STATUS_FILTERS as f}
        <button type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {statusFilter === f.id
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (statusFilter = f.id)}>{f.label}</button>
      {/each}
    </div>
    <span class="text-slate-300">·</span>
    <div class="flex items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Treatment:</span>
      {#each TREATMENT_FILTERS as f}
        <button type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {treatmentFilter === f.id
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (treatmentFilter = f.id)}>{f.label}</button>
      {/each}
    </div>
    <div class="relative ml-auto w-full sm:w-64">
      <Search class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input type="search" bind:value={search} placeholder="Search risks…" class="input pl-8" />
    </div>
  </div>

  <!-- Table -->
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="cursor-pointer px-4 py-2 text-left" on:click={() => toggleSort('code')}>Code</th>
            <th class="cursor-pointer px-4 py-2 text-left" on:click={() => toggleSort('title')}>Title</th>
            <th class="cursor-pointer px-4 py-2 text-left" on:click={() => toggleSort('category')}>Category</th>
            <th class="px-4 py-2 text-left">Owner</th>
            <th class="cursor-pointer px-4 py-2 text-left" on:click={() => toggleSort('inherent')}>Inherent</th>
            <th class="px-2 py-2 text-center"></th>
            <th class="cursor-pointer px-4 py-2 text-left" on:click={() => toggleSort('residual')}>Residual</th>
            <th class="px-4 py-2 text-left">Treatment</th>
            <th class="cursor-pointer px-4 py-2 text-left" on:click={() => toggleSort('nextReview')}>Next Review</th>
            <th class="w-8 px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each pageRows as r (r.id)}
            {@const inh = inherentScore(r)}
            {@const res = residualScore(r)}
            <tr class="tr">
              <td class="td num text-xs">
                <a href="/risk/{r.id}" class="text-grc-primary hover:underline">{r.code}</a>
              </td>
              <td class="td max-w-md truncate">
                <a href="/risk/{r.id}" class="hover:underline">{r.title}</a>
                {#if r.tags && (r.tags as Record<string, unknown>).hero}
                  <span class="ml-2 inline-flex items-center rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-rose-700 ring-1 ring-rose-200">HERO</span>
                {/if}
              </td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {categoryCls(r.category)}">{r.category}</span>
              </td>
              <td class="td">
                <div class="flex items-center gap-1.5 text-xs text-slate-500">
                  <UserIcon class="h-3 w-3" />
                  <span>{r.ownerEmail ?? '—'}</span>
                </div>
              </td>
              <td class="td">
                <div class="flex items-center gap-1.5">
                  <span class="num inline-flex h-6 w-6 items-center justify-center rounded text-[11px] font-semibold {scoreCellColor(inh)}">{inh}</span>
                  <span class="text-[10px] text-slate-400">{r.inherentSeverity[0].toUpperCase()}/{r.inherentLikelihood[0].toUpperCase()}</span>
                </div>
              </td>
              <td class="td text-center text-slate-300">→</td>
              <td class="td">
                <div class="flex items-center gap-1.5">
                  <span class="num inline-flex h-6 w-6 items-center justify-center rounded text-[11px] font-semibold {scoreCellColor(res)}">{res}</span>
                  <span class="text-[10px] text-slate-400">{r.residualSeverity[0].toUpperCase()}/{r.residualLikelihood[0].toUpperCase()}</span>
                </div>
              </td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {treatmentCls(r.treatmentStrategy)}">{r.treatmentStrategy}</span>
              </td>
              <td class="td text-xs {nextReviewColor(r.nextReviewAt)}">{fmtRel(r.nextReviewAt)}</td>
              <td class="td">
                <a href="/risk/{r.id}" class="text-slate-400 hover:text-grc-primary">
                  <ChevronRight class="h-4 w-4" />
                </a>
              </td>
            </tr>
          {:else}
            <tr><td colspan="10" class="px-4 py-8 text-center text-sm text-slate-500">No risks match.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if sorted.length > 0}
      <div class="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        <span>Showing {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, sorted.length)} of {sorted.length.toLocaleString()}</span>
        <div class="flex items-center gap-2">
          <button class="btn-ghost py-1 text-xs" on:click={() => page = Math.max(1, page - 1)} disabled={page === 1}>Prev</button>
          <span class="num">{page} / {pageCount}</span>
          <button class="btn-ghost py-1 text-xs" on:click={() => page = Math.min(pageCount, page + 1)} disabled={page === pageCount}>Next</button>
        </div>
      </div>
    {/if}
  </div>

  <div class="text-[11px] text-slate-400">
    <ListChecks class="inline h-3 w-3" /> Linked: {data.issues.length} open issues across this tenant. <a href="/issues" class="text-grc-primary hover:underline">View issues →</a>
  </div>
</div>
