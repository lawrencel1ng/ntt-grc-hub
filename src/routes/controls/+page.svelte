<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import StatusDot from '$lib/components/StatusDot.svelte';
  import FrameworkBadge from '$lib/components/FrameworkBadge.svelte';
  import { ShieldCheck, Bot, CheckCircle2, AlertTriangle, Search, ChevronRight, User as UserIcon, Plus } from 'lucide-svelte';
  import type { Control, ControlMapping, ControlType, ControlTestResult } from '$lib/data/types';
  import { enhance } from '$app/forms';
  import { addToast } from '$lib/stores/toast';

  export let data;
  export let form: { created?: boolean; code?: string; createError?: string } | null = null;

  $: if (form?.created) { addToast('success', `Control ${form.code} created.`); showAddForm = false; }
  $: if (form?.createError) addToast('error', form.createError);

  let showAddForm = false;

  // ---------- KPIs ----------
  $: total = data.controls.length;
  $: automatedCount = data.controls.filter((c) => c.automated).length;
  $: automatedPct = total > 0 ? (automatedCount / total) * 100 : 0;

  // Last-result heuristic: pick the most-recent run per control from the runs feed.
  $: lastResultByControl = (() => {
    const map = new Map<string, ControlTestResult>();
    for (const r of data.runs) {
      if (!map.has(r.controlId)) map.set(r.controlId, r.result);
    }
    return map;
  })();
  $: passRate30d = (() => {
    if (data.runs.length === 0) return 0;
    const pass = data.runs.filter((r) => r.result === 'pass').length;
    return (pass / data.runs.length) * 100;
  })();
  $: failingNow = [...lastResultByControl.values()].filter((r) => r === 'fail').length;

  // ---------- Filter state ----------
  type TypeFilter = 'all' | ControlType;
  type StatusFilter = 'all' | ControlTestResult;
  type AutomationFilter = 'all' | 'auto' | 'manual';
  let typeFilter: TypeFilter = 'all';
  let statusFilter: StatusFilter = 'all';
  let automationFilter: AutomationFilter = 'all';
  let frameworkFilter = 'all';
  let search = '';

  const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'technical', label: 'Technical' },
    { id: 'process', label: 'Process' },
    { id: 'admin', label: 'Admin' }
  ];
  const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'pass', label: 'Pass' },
    { id: 'fail', label: 'Fail' },
    { id: 'partial', label: 'Partial' },
    { id: 'na', label: 'N/A' }
  ];
  const AUTOMATION_FILTERS: { id: AutomationFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'auto', label: 'Automated' },
    { id: 'manual', label: 'Manual' }
  ];

  // Real framework mapping from control.mappings (keyed by controlId).
  $: mappingsByControl = (() => {
    const map = new Map<string, string[]>();
    for (const m of data.mappings as ControlMapping[]) {
      const existing = map.get(m.controlId) ?? [];
      if (!existing.includes(m.frameworkId)) existing.push(m.frameworkId);
      map.set(m.controlId, existing);
    }
    return map;
  })();

  $: filtered = data.controls.filter((c) => {
    if (typeFilter !== 'all' && c.type !== typeFilter) return false;
    if (automationFilter !== 'all') {
      if (automationFilter === 'auto' && !c.automated) return false;
      if (automationFilter === 'manual' && c.automated) return false;
    }
    if (statusFilter !== 'all') {
      const last = lastResultByControl.get(c.id);
      if (last !== statusFilter) return false;
    }
    if (frameworkFilter !== 'all' && !(mappingsByControl.get(c.id) ?? []).includes(frameworkFilter)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!c.code.toLowerCase().includes(q) && !c.title.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Show 50 rows at a time; "Load more" expands.
  let visible = 50;
  $: visibleRows = filtered.slice(0, visible);

  function fmtRel(iso?: string): string {
    if (!iso) return '—';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)   return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }
  $: lastRunByControl = (() => {
    const map = new Map<string, string>();
    for (const r of data.runs) {
      if (!map.has(r.controlId)) map.set(r.controlId, r.ranAt);
    }
    return map;
  })();
  function fwById(id: string) {
    return data.frameworks.find((f) => f.id === id);
  }
</script>

<PageHeader title="Controls Library" subtitle="{total.toLocaleString()} controls · {automatedPct.toFixed(0)}% automated">
  <svelte:fragment slot="actions">
    <button class="btn-primary" on:click={() => (showAddForm = !showAddForm)}>
      <Plus class="h-4 w-4" />
      <span>Add Control</span>
    </button>
  </svelte:fragment>
</PageHeader>

{#if showAddForm}
  <div class="card p-5">
    <h3 class="mb-4 text-sm font-semibold text-grc-ink">New Control</h3>
    <form method="POST" action="?/createControl" use:enhance class="space-y-4">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-xs font-medium text-slate-700">Title</span>
          <input name="title" class="input" placeholder="e.g. Multi-factor Authentication Enforcement" required maxlength="256" />
        </label>
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-xs font-medium text-slate-700">Description</span>
          <textarea name="description" class="input h-20 resize-none" placeholder="Optional" maxlength="2048"></textarea>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Type</span>
          <select name="type" class="input">
            <option value="technical">Technical</option>
            <option value="process">Process</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Maturity</span>
          <select name="maturity" class="input">
            <option value="initial">Initial</option>
            <option value="developing">Developing</option>
            <option value="defined">Defined</option>
            <option value="managed">Managed</option>
            <option value="optimised">Optimised</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Frequency</span>
          <input name="frequency" class="input" value="annual" maxlength="64" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Automated</span>
          <select name="automated" class="input">
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </label>
      </div>
      <div class="flex gap-2">
        <button type="submit" class="btn-primary">Create control</button>
        <button type="button" class="btn-secondary" on:click={() => (showAddForm = false)}>Cancel</button>
      </div>
    </form>
  </div>
{/if}

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Kpi label="Total Controls" value={total.toLocaleString()}>
      <ShieldCheck slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Automated" value={automatedPct.toFixed(0)} suffix="%" hint="{automatedCount.toLocaleString()} controls">
      <Bot slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Pass Rate (30d)" value={passRate30d.toFixed(1)} suffix="%">
      <CheckCircle2 slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Failing Now" value={failingNow.toString()} tone="bad">
      <AlertTriangle slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
  </div>

  <!-- Filter bar -->
  <div class="card flex flex-wrap items-center gap-3 px-4 py-3">
    <div class="flex items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Type:</span>
      {#each TYPE_FILTERS as f}
        <button type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {typeFilter === f.id
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (typeFilter = f.id)}>{f.label}</button>
      {/each}
    </div>
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
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Automation:</span>
      {#each AUTOMATION_FILTERS as f}
        <button type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {automationFilter === f.id
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (automationFilter = f.id)}>{f.label}</button>
      {/each}
    </div>
    <select bind:value={frameworkFilter} class="input w-44 py-1.5">
      <option value="all">All frameworks</option>
      {#each data.frameworks.slice(0, 12) as f}
        <option value={f.id}>{f.name}</option>
      {/each}
    </select>
    <div class="relative ml-auto w-full sm:w-64">
      <Search class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input type="search" bind:value={search} placeholder="Search controls…" class="input pl-8" />
    </div>
  </div>

  <!-- Table -->
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-2 text-left">Code</th>
            <th class="px-4 py-2 text-left">Title</th>
            <th class="px-4 py-2 text-left">Type</th>
            <th class="px-4 py-2 text-left">Frameworks</th>
            <th class="px-4 py-2 text-left">Owner</th>
            <th class="px-4 py-2 text-left">Last Tested</th>
            <th class="px-4 py-2 text-left">Last Result</th>
            <th class="px-4 py-2 text-center">Auto</th>
            <th class="w-8 px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each visibleRows as c (c.id)}
            {@const last = lastResultByControl.get(c.id)}
            {@const lastTs = lastRunByControl.get(c.id)}
            {@const fwIds = mappingsByControl.get(c.id) ?? []}
            <tr class="tr">
              <td class="td font-mono text-xs text-slate-500">
                <a href="/controls/{c.id}" class="text-grc-primary hover:underline">{c.code}</a>
              </td>
              <td class="td max-w-md truncate">{c.title}</td>
              <td class="td"><span class="tag tag-slate">{c.type}</span></td>
              <td class="td">
                <div class="flex flex-wrap gap-1">
                  {#each fwIds as fid}
                    {@const fw = fwById(fid)}
                    {#if fw}
                      <FrameworkBadge name={fw.name} region={fw.region} />
                    {/if}
                  {/each}
                </div>
              </td>
              <td class="td">
                <div class="flex items-center gap-1.5 text-xs text-slate-500">
                  <UserIcon class="h-3 w-3" />
                  <span>{c.ownerEmail ?? '—'}</span>
                </div>
              </td>
              <td class="td text-xs text-slate-500">{fmtRel(lastTs)}</td>
              <td class="td">
                {#if last}
                  <StatusDot status={last} withLabel />
                {:else}
                  <span class="text-xs text-slate-400">no runs</span>
                {/if}
              </td>
              <td class="td text-center">
                {#if c.automated}
                  <Bot class="mx-auto h-4 w-4 text-violet-600" />
                {:else}
                  <span class="text-xs text-slate-400">—</span>
                {/if}
              </td>
              <td class="td">
                <a href="/controls/{c.id}" class="text-slate-400 hover:text-grc-primary">
                  <ChevronRight class="h-4 w-4" />
                </a>
              </td>
            </tr>
          {:else}
            <tr><td colspan="9" class="px-4 py-8 text-center text-sm text-slate-500">No controls match.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if filtered.length > visible}
      <div class="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        <span>Showing {visibleRows.length} of {filtered.length.toLocaleString()}</span>
        <button class="btn-ghost py-1 text-xs" on:click={() => (visible += 50)}>Load 50 more</button>
      </div>
    {:else}
      <div class="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">{filtered.length.toLocaleString()} controls</div>
    {/if}
  </div>
</div>
