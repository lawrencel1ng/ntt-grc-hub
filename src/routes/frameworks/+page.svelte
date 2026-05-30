<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import FrameworkBadge from '$lib/components/FrameworkBadge.svelte';
  import { Library, TrendingUp, Calendar, ListChecks, Search, ChevronRight } from 'lucide-svelte';
  import type { Framework, FrameworkScore } from '$lib/data/types';

  export let data;

  // ---------- Region filter ----------
  type RegionFilter = 'all' | 'Global' | 'EU' | 'Americas' | 'Singapore' | 'APAC' | 'ESG';
  let regionFilter: RegionFilter = 'all';
  let search = '';

  const REGION_FILTERS: { id: RegionFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'Global', label: 'Global' },
    { id: 'EU', label: 'EU' },
    { id: 'Americas', label: 'Americas' },
    { id: 'Singapore', label: 'Singapore' },
    { id: 'APAC', label: 'APAC' },
    { id: 'ESG', label: 'ESG' }
  ];

  // Score lookup — pick the best score per framework across hero tenants
  // when the dispatcher returns the rollup. For tenant-scoped views the
  // dispatcher already returns 1 row per framework.
  $: scoreByFw = (() => {
    const map = new Map<string, FrameworkScore>();
    for (const s of data.scores) {
      const existing = map.get(s.frameworkId);
      if (!existing || (s.score ?? 0) > (existing.score ?? 0)) map.set(s.frameworkId, s);
    }
    return map;
  })();

  // ESG tag-based grouping — a few frameworks live in `Global` region but
  // are tagged for ESG (CSRD is the EU one). We make ESG a synthetic
  // filter that matches tags.
  function inRegion(fw: Framework, r: RegionFilter): boolean {
    if (r === 'all') return true;
    if (r === 'ESG') return fw.tags.includes('esg');
    return fw.region === r;
  }

  $: filtered = data.frameworks.filter((fw) => {
    if (!inRegion(fw, regionFilter)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!fw.name.toLowerCase().includes(q) && !fw.regulator.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ---------- Sort ----------
  type SortKey = 'name' | 'region' | 'score' | 'next';
  let sortKey: SortKey = 'name';
  let sortDir: 'asc' | 'desc' = 'asc';

  function setSort(k: SortKey) {
    if (sortKey === k) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortKey = k; sortDir = 'asc'; }
  }

  $: sorted = (() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortKey === 'name')   { av = a.name;   bv = b.name; }
      if (sortKey === 'region') { av = a.region; bv = b.region; }
      if (sortKey === 'score')  { av = scoreByFw.get(a.id)?.score ?? -1; bv = scoreByFw.get(b.id)?.score ?? -1; }
      if (sortKey === 'next')   {
        av = scoreByFw.get(a.id)?.nextDueAt ?? '9999';
        bv = scoreByFw.get(b.id)?.nextDueAt ?? '9999';
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
    return arr;
  })();

  // ---------- KPIs ----------
  $: activeCount = data.frameworks.length;
  $: regionCount = new Set(data.frameworks.map((f) => f.region)).size;
  $: avgScore = (() => {
    const vals = data.scores.map((s) => s.score ?? 0).filter((v) => v > 0);
    if (!vals.length) return 0;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  })();
  $: dueIn60 = data.scores.filter((s) => {
    if (!s.nextDueAt) return false;
    const days = (new Date(s.nextDueAt).getTime() - Date.now()) / 86_400_000;
    return days > 0 && days <= 60;
  }).length;
  $: totalReqs = data.frameworks.reduce((s, f) => s + f.totalRequirements, 0);

  // ---------- Helpers ----------
  function fmtRelDue(iso?: string): { text: string; cls: string } {
    if (!iso) return { text: '—', cls: 'text-slate-400' };
    const days = (new Date(iso).getTime() - Date.now()) / 86_400_000;
    if (days < 0)  return { text: `${Math.abs(Math.floor(days))}d overdue`, cls: 'text-rose-600' };
    if (days < 30) return { text: `${Math.floor(days)}d`, cls: 'text-rose-600' };
    if (days < 90) return { text: `${Math.floor(days)}d`, cls: 'text-amber-600' };
    return { text: `${Math.floor(days)}d`, cls: 'text-slate-500' };
  }
  function fmtRelAgo(iso?: string): string {
    if (!iso) return '—';
    const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
    if (days < 1)  return 'today';
    if (days < 30) return `${Math.floor(days)}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  }
  function scoreColor(s?: number): string {
    if (s == null) return 'text-slate-400';
    if (s < 60) return 'text-rose-600';
    if (s < 80) return 'text-amber-600';
    return 'text-violet-600';
  }
</script>

<PageHeader
  title="Frameworks Library"
  subtitle="{activeCount} active · {regionCount} regions"
/>

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Kpi label="Active Frameworks" value={activeCount.toString()} hint="across all regions">
      <Library slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Avg Score" value={avgScore.toFixed(1)} suffix="%">
      <TrendingUp slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Due in 60 days" value={dueIn60.toString()} hint="assessment refresh">
      <Calendar slot="icon" class="h-4 w-4 text-amber-600" />
    </Kpi>
    <Kpi label="Requirements Tracked" value={totalReqs.toLocaleString()} hint="all frameworks">
      <ListChecks slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
  </div>

  <!-- Filter bar -->
  <div class="card flex flex-wrap items-center gap-3 px-4 py-3">
    <div class="flex flex-wrap items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Region:</span>
      {#each REGION_FILTERS as r}
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {regionFilter === r.id
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (regionFilter = r.id)}
        >
          {r.label}
        </button>
      {/each}
    </div>
    <div class="relative ml-auto w-full sm:w-64">
      <Search class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        bind:value={search}
        placeholder="Search frameworks…"
        class="input pl-8"
      />
    </div>
  </div>

  <!-- Table -->
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="cursor-pointer px-4 py-2 text-left" on:click={() => setSort('name')}>
              Framework {sortKey === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
            </th>
            <th class="px-4 py-2 text-left">Version</th>
            <th class="cursor-pointer px-4 py-2 text-left" on:click={() => setSort('region')}>
              Region {sortKey === 'region' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
            </th>
            <th class="px-4 py-2 text-left">Regulator</th>
            <th class="px-4 py-2 text-right">Reqs</th>
            <th class="cursor-pointer px-4 py-2 text-right" on:click={() => setSort('score')}>
              Score {sortKey === 'score' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
            </th>
            <th class="px-4 py-2 text-left">Last Assessed</th>
            <th class="cursor-pointer px-4 py-2 text-left" on:click={() => setSort('next')}>
              Next Due {sortKey === 'next' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
            </th>
            <th class="w-8 px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each sorted as fw (fw.id)}
            {@const score = scoreByFw.get(fw.id)}
            {@const due = fmtRelDue(score?.nextDueAt)}
            <tr class="tr">
              <td class="td">
                <a href="/frameworks/{fw.id}" class="block">
                  <FrameworkBadge name={fw.name} region={fw.region} />
                </a>
              </td>
              <td class="td text-xs text-slate-500">{fw.version}</td>
              <td class="td text-xs">{fw.region}</td>
              <td class="td text-xs text-slate-600">{fw.regulator}</td>
              <td class="td text-right font-mono text-xs">{fw.totalRequirements}</td>
              <td class="td text-right font-mono text-sm {scoreColor(score?.score)}">
                {score?.score != null ? score.score.toFixed(0) : '—'}
              </td>
              <td class="td text-xs text-slate-500">
                {score?.nextDueAt ? fmtRelAgo(new Date(new Date(score.nextDueAt).getTime() - 365 * 86_400_000).toISOString()) : '—'}
              </td>
              <td class="td text-xs {due.cls}">{due.text}</td>
              <td class="td">
                <a href="/frameworks/{fw.id}" class="text-slate-400 hover:text-grc-primary">
                  <ChevronRight class="h-4 w-4" />
                </a>
              </td>
            </tr>
          {:else}
            <tr><td colspan="9" class="px-4 py-8 text-center text-sm text-slate-500">No frameworks match those filters.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
