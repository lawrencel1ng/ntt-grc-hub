<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import Sparkline from '$lib/components/Sparkline.svelte';
  import { addToast } from '$lib/stores/toast';
  import { Building, AlertTriangle, Calendar, Gauge as GaugeIcon, Search, ChevronRight, Plus } from 'lucide-svelte';
  import type { Vendor, VendorTier, VendorCriticality, VendorStatus } from '$lib/data/types';
  import { hashStringToInt, mulberry32 } from '$lib/data/rng';

  export let data;

  // ---------- KPIs ----------
  $: total = data.vendors.length;
  $: critical = data.vendors.filter((v) => v.tier === '1').length;
  // Renewals within 90 days: synthesise an ends_at from the vendor id so
  // the demo stays believable without backing-store columns.
  function endsAtDays(v: Vendor): number {
    // 0–540 day pseudo-window
    return Math.abs(hashStringToInt(`ends:${v.id}`) % 540) - 90;
  }
  $: renewalsLt90 = data.vendors.filter((v) => {
    const d = endsAtDays(v);
    return d >= 0 && d < 90;
  }).length;

  // Residual risk score: invert the questionnaire score (lower questionnaire => higher residual).
  function residualScore(v: Vendor): number {
    const q = v.lastQuestionnaireScore ?? 70;
    const tierWeight = { '1': 1.0, '2': 0.85, '3': 0.7, '4': 0.55 }[v.tier];
    return Math.round((100 - q) * tierWeight + 25);
  }
  $: avgResidual = total > 0
    ? Math.round(data.vendors.reduce((s, v) => s + residualScore(v), 0) / total)
    : 0;

  // ---------- Filters ----------
  type TierF = 'all' | VendorTier;
  type CritF = 'all' | VendorCriticality;
  type StatF = 'all' | VendorStatus;
  let tierFilter: TierF = 'all';
  let critFilter: CritF = 'all';
  let statusFilter: StatF = 'all';
  let countryFilter = 'all';
  let search = '';

  const TIERS: { id: TierF; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: '1', label: 'Tier 1' },
    { id: '2', label: 'Tier 2' },
    { id: '3', label: 'Tier 3' },
    { id: '4', label: 'Tier 4' }
  ];
  const CRITS: { id: CritF; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'critical', label: 'Critical' },
    { id: 'high', label: 'High' },
    { id: 'medium', label: 'Medium' },
    { id: 'low', label: 'Low' }
  ];
  const STATUSES: { id: StatF; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'onboarding', label: 'Onboarding' },
    { id: 'offboarded', label: 'Offboarded' }
  ];

  $: countries = Array.from(new Set(data.vendors.map((v) => v.hqCountry))).sort();

  $: filtered = data.vendors.filter((v) => {
    if (tierFilter !== 'all' && v.tier !== tierFilter) return false;
    if (critFilter !== 'all' && v.criticality !== critFilter) return false;
    if (statusFilter !== 'all' && v.status !== statusFilter) return false;
    if (countryFilter !== 'all' && v.hqCountry !== countryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!v.name.toLowerCase().includes(q) && !v.category.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ---------- Sort ----------
  type SortKey = 'name' | 'category' | 'tier' | 'criticality' | 'country' | 'contract' | 'status' | 'score';
  let sortKey: SortKey = 'tier';
  let sortDir: 'asc' | 'desc' = 'asc';
  function toggleSort(k: SortKey) {
    if (sortKey === k) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortKey = k; sortDir = k === 'contract' || k === 'score' ? 'desc' : 'asc'; }
  }

  $: sorted = (() => {
    const arr = filtered.slice();
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':        cmp = a.name.localeCompare(b.name); break;
        case 'category':    cmp = a.category.localeCompare(b.category); break;
        case 'tier':        cmp = a.tier.localeCompare(b.tier); break;
        case 'criticality': cmp = a.criticality.localeCompare(b.criticality); break;
        case 'country':     cmp = a.hqCountry.localeCompare(b.hqCountry); break;
        case 'contract':    cmp = (a.contractValueSgd ?? 0) - (b.contractValueSgd ?? 0); break;
        case 'status':      cmp = a.status.localeCompare(b.status); break;
        case 'score':       cmp = (a.lastQuestionnaireScore ?? 0) - (b.lastQuestionnaireScore ?? 0); break;
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

  // ---------- Helpers ----------
  function tierCls(t: VendorTier): string {
    switch (t) {
      case '1': return 'bg-rose-100 text-rose-800 ring-rose-200';
      case '2': return 'bg-orange-50 text-orange-700 ring-orange-200';
      case '3': return 'bg-amber-50 text-amber-700 ring-amber-200';
      case '4': return 'bg-slate-100 text-slate-600 ring-slate-200';
    }
  }
  function critCls(c: VendorCriticality): string {
    switch (c) {
      case 'critical': return 'bg-rose-100 text-rose-800 ring-rose-200';
      case 'high':     return 'bg-orange-50 text-orange-700 ring-orange-200';
      case 'medium':   return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'low':      return 'bg-violet-50 text-violet-700 ring-violet-200';
    }
  }
  function statusCls(s: VendorStatus): string {
    switch (s) {
      case 'active':     return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'onboarding': return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'offboarded': return 'bg-slate-100 text-slate-500 ring-slate-200';
    }
  }
  function scoreCls(score?: number): string {
    if (score === undefined) return 'text-slate-400';
    if (score < 60) return 'text-rose-700';
    if (score < 80) return 'text-amber-700';
    return 'text-violet-700';
  }
  function fmtMoney(n?: number): string {
    if (n === undefined) return '—';
    if (n >= 1e6) return `S$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `S$${(n / 1e3).toFixed(0)}K`;
    return `S$${n}`;
  }
  // 12-pt sparkline of questionnaire score trend, deterministic per vendor.
  function trendFor(v: Vendor): number[] {
    const rng = mulberry32(hashStringToInt(`trend:${v.id}`));
    const last = v.lastQuestionnaireScore ?? 70;
    // Walk backwards from `last` with mild drift so the curve ends at `last`.
    const out: number[] = [last];
    for (let i = 1; i < 12; i++) {
      const drift = (rng() - 0.5) * 6;
      const next = Math.max(40, Math.min(100, out[out.length - 1] - drift));
      out.push(Math.round(next));
    }
    return out.reverse();
  }
  function flag(c: string): string {
    const map: Record<string, string> = {
      SG: '🇸🇬', MY: '🇲🇾', ID: '🇮🇩', TH: '🇹🇭', IN: '🇮🇳',
      US: '🇺🇸', EU: '🇪🇺', HK: '🇭🇰', JP: '🇯🇵', CN: '🇨🇳'
    };
    return map[c] ?? '🌐';
  }

  function newVendor() {
    addToast('info', 'Vendor onboarding form would open here (demo).');
  }
</script>

<PageHeader
  title="Vendors / TPRM"
  subtitle="{total.toLocaleString()} vendors · {critical} Tier 1 · {renewalsLt90} renewals within 90 days {data.isAll ? '· showing Maybank register (MSSP fallback)' : ''}"
>
  <svelte:fragment slot="actions">
    <button class="btn-primary" on:click={newVendor}>
      <Plus class="h-4 w-4" />
      <span>New Vendor</span>
    </button>
  </svelte:fragment>
</PageHeader>

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Kpi label="Total Vendors" value={total.toLocaleString()}>
      <Building slot="icon" class="h-4 w-4 text-grc-primary" />
    </Kpi>
    <Kpi label="Critical (Tier 1)" value={critical.toString()} tone="bad">
      <AlertTriangle slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
    <Kpi label="Renewals < 90d" value={renewalsLt90.toString()} tone="bad">
      <Calendar slot="icon" class="h-4 w-4 text-amber-600" />
    </Kpi>
    <Kpi label="Avg Residual Risk" value={avgResidual.toString()} suffix="/ 100" hint="lower is better">
      <GaugeIcon slot="icon" class="h-4 w-4 text-grc-primary" />
    </Kpi>
  </div>

  <!-- Filter bar -->
  <div class="card flex flex-wrap items-center gap-3 px-4 py-3">
    <div class="flex items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tier:</span>
      {#each TIERS as f}
        <button type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {tierFilter === f.id
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (tierFilter = f.id)}>{f.label}</button>
      {/each}
    </div>
    <span class="text-slate-300">·</span>
    <div class="flex items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Crit:</span>
      {#each CRITS as f}
        <button type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {critFilter === f.id
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (critFilter = f.id)}>{f.label}</button>
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
    <select bind:value={countryFilter} class="input w-36 py-1.5">
      <option value="all">All countries</option>
      {#each countries as c}
        <option value={c}>{flag(c)} {c}</option>
      {/each}
    </select>
    <div class="relative ml-auto w-full sm:w-64">
      <Search class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input type="search" bind:value={search} placeholder="Search vendors…" class="input pl-8" />
    </div>
  </div>

  <!-- Table -->
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="cursor-pointer px-4 py-2 text-left" on:click={() => toggleSort('name')}>Vendor</th>
            <th class="cursor-pointer px-4 py-2 text-left" on:click={() => toggleSort('category')}>Category</th>
            <th class="cursor-pointer px-4 py-2 text-left" on:click={() => toggleSort('tier')}>Tier</th>
            <th class="cursor-pointer px-4 py-2 text-left" on:click={() => toggleSort('criticality')}>Criticality</th>
            <th class="cursor-pointer px-4 py-2 text-left" on:click={() => toggleSort('country')}>HQ</th>
            <th class="cursor-pointer px-4 py-2 text-right" on:click={() => toggleSort('contract')}>Contract</th>
            <th class="cursor-pointer px-4 py-2 text-left" on:click={() => toggleSort('status')}>Status</th>
            <th class="cursor-pointer px-4 py-2 text-left" on:click={() => toggleSort('score')}>Last Q-Score</th>
            <th class="w-8 px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each pageRows as v (v.id)}
            <tr class="tr">
              <td class="td max-w-xs truncate font-medium">
                <a href="/vendors/{v.id}" class="text-grc-primary hover:underline">{v.name}</a>
              </td>
              <td class="td">
                <span class="tag tag-slate">{v.category}</span>
              </td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {tierCls(v.tier)}">Tier {v.tier}</span>
              </td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {critCls(v.criticality)}">{v.criticality}</span>
              </td>
              <td class="td">
                <span class="inline-flex items-center gap-1 font-mono text-xs">{flag(v.hqCountry)} {v.hqCountry}</span>
              </td>
              <td class="td text-right font-mono text-xs">{fmtMoney(v.contractValueSgd)}</td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {statusCls(v.status)}">{v.status}</span>
              </td>
              <td class="td">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-sm font-semibold {scoreCls(v.lastQuestionnaireScore)}">{v.lastQuestionnaireScore ?? '—'}</span>
                  <div class="w-20">
                    <Sparkline data={trendFor(v)} stroke={v.lastQuestionnaireScore && v.lastQuestionnaireScore >= 80 ? '#6d28d9' : v.lastQuestionnaireScore && v.lastQuestionnaireScore >= 60 ? '#d97706' : '#e11d48'} />
                  </div>
                </div>
              </td>
              <td class="td">
                <a href="/vendors/{v.id}" class="text-slate-400 hover:text-grc-primary">
                  <ChevronRight class="h-4 w-4" />
                </a>
              </td>
            </tr>
          {:else}
            <tr><td colspan="9" class="px-4 py-8 text-center text-sm text-slate-500">No vendors match.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if sorted.length > 0}
      <div class="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        <span>Showing {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, sorted.length)} of {sorted.length.toLocaleString()}</span>
        <div class="flex items-center gap-2">
          <button class="btn-ghost py-1 text-xs" on:click={() => page = Math.max(1, page - 1)} disabled={page === 1}>Prev</button>
          <span class="font-mono">{page} / {pageCount}</span>
          <button class="btn-ghost py-1 text-xs" on:click={() => page = Math.min(pageCount, page + 1)} disabled={page === pageCount}>Next</button>
        </div>
      </div>
    {/if}
  </div>
</div>
