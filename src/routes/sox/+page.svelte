<script lang="ts">
  import { enhance } from '$app/forms';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import { addToast } from '$lib/stores/toast';
  import {
    ShieldCheck, ClipboardCheck, AlertTriangle, TrendingUp,
    Network, Plus, BookOpen
  } from 'lucide-svelte';
  import type { ControlTestResult, RiskSeverity } from '$lib/data/types';

  export let data;
  export let form: {
    itgcError?: string; itgcUpdated?: boolean; itgcId?: string; newStatus?: string;
    deficiencyError?: string; deficiencyCreated?: boolean; deficiencyId?: string;
  } | undefined = undefined;

  let showDeficiencyForm = false;

  $: if (form?.itgcUpdated)       { addToast('success', 'ITGC status updated.'); }
  $: if (form?.deficiencyCreated) { addToast('success', 'Deficiency reported.'); showDeficiencyForm = false; }

  // ---------- KPIs ----------
  $: itgcCount = data.itgcs.length;
  $: kcaCount = data.kcas.length;
  $: walkComplete = data.walkthroughs.filter((w: { status: string }) => w.status === 'complete').length;
  $: walkPct = data.walkthroughs.length > 0
    ? Math.round((walkComplete / data.walkthroughs.length) * 100)
    : 0;
  $: openDeficiencies = data.deficiencies.length;
  $: remediationOnTrack = data.deficiencies.filter((d: { onTrack: boolean }) => d.onTrack).length;
  $: remediationPct = openDeficiencies > 0
    ? Math.round((remediationOnTrack / openDeficiencies) * 100)
    : 100;

  // ---------- Tabs ----------
  type Tab = 'itgcs' | 'kcas' | 'walkthroughs' | 'deficiencies';
  let tab: Tab = 'itgcs';
  const TABS: { id: Tab; label: string; icon: typeof BookOpen; count: number }[] = [];
  $: TABS.length = 0;
  $: TABS.push(
    { id: 'itgcs',        label: 'ITGCs',         icon: ShieldCheck,    count: itgcCount },
    { id: 'kcas',         label: 'KCAs',          icon: Network,        count: kcaCount },
    { id: 'walkthroughs', label: 'Walkthroughs',  icon: ClipboardCheck, count: data.walkthroughs.length },
    { id: 'deficiencies', label: 'Deficiencies',  icon: AlertTriangle,  count: data.deficiencies.length }
  );

  // ---------- Helpers ----------
  function resultCls(r: ControlTestResult): string {
    switch (r) {
      case 'pass':    return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'partial': return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'fail':    return 'bg-rose-50 text-rose-700 ring-rose-200';
      case 'na':      return 'bg-slate-100 text-slate-500 ring-slate-200';
    }
  }
  function sevCls(s: RiskSeverity): string {
    if (s === 'critical') return 'bg-rose-100 text-rose-800 ring-rose-200';
    if (s === 'high')     return 'bg-orange-50 text-orange-700 ring-orange-200';
    if (s === 'medium')   return 'bg-amber-50 text-amber-700 ring-amber-200';
    if (s === 'low')      return 'bg-yellow-50 text-yellow-700 ring-yellow-200';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
  function domainCls(d: string): string {
    switch (d) {
      case 'Access':     return 'bg-rose-50 text-rose-700 ring-rose-200';
      case 'Change':     return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'Operations': return 'bg-violet-50 text-violet-700 ring-violet-200';
      default:           return 'bg-slate-100 text-slate-600 ring-slate-200';
    }
  }
  function walkStatusCls(s: string): string {
    switch (s) {
      case 'complete':    return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'in-progress': return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'planned':     return 'bg-slate-100 text-slate-700 ring-slate-200';
      default:            return 'bg-slate-100 text-slate-600 ring-slate-200';
    }
  }
  function fmtDate(iso: string): string {
    return iso.slice(0, 10);
  }
</script>

<PageHeader title="SOX & Financial Controls" subtitle="Sarbanes-Oxley §302/404 · PCAOB AS 2201 · COSO 2013 {data.isAll ? '· aggregated view' : ''}" />

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
    <Kpi label="ITGCs" value={itgcCount.toString()} hint="IT general controls">
      <ShieldCheck slot="icon" class="h-4 w-4 text-grc-primary" />
    </Kpi>
    <Kpi label="KCAs" value={kcaCount.toString()} hint="key control activities">
      <Network slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Walkthroughs Complete" value={walkPct.toString()} suffix="%" hint="{walkComplete}/{data.walkthroughs.length}">
      <ClipboardCheck slot="icon" class="h-4 w-4 text-blue-600" />
    </Kpi>
    <Kpi label="Open Deficiencies" value={openDeficiencies.toString()} tone="bad">
      <AlertTriangle slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
    <Kpi label="Remediation On Track" value={remediationPct.toString()} suffix="%" hint="{remediationOnTrack}/{openDeficiencies}">
      <TrendingUp slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
  </div>

  <!-- Tabs -->
  <div class="card overflow-hidden">
    <div class="flex flex-wrap border-b border-slate-100 px-2">
      {#each TABS as t}
        {@const Icon = t.icon}
        <button type="button"
          class="-mb-px flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors {tab === t.id
            ? 'border-grc-primary text-grc-primary'
            : 'border-transparent text-slate-500 hover:text-slate-700'}"
          on:click={() => (tab = t.id)}>
          <Icon class="h-4 w-4" />
          {t.label}
          <span class="rounded-full bg-slate-100 px-1.5 text-[10px] font-mono text-slate-600">{t.count}</span>
        </button>
      {/each}
    </div>

    <!-- ITGCs -->
    {#if tab === 'itgcs'}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Code</th>
              <th class="px-4 py-2 text-left">Name</th>
              <th class="px-4 py-2 text-left">Domain</th>
              <th class="px-4 py-2 text-left">Owner</th>
              <th class="px-4 py-2 text-left">Frequency</th>
              <th class="px-4 py-2 text-left">Last Test</th>
              <th class="px-4 py-2 text-left">Result</th>
              {#if !data.isAll}<th class="px-4 py-2 text-left">Update Status</th>{/if}
            </tr>
          </thead>
          <tbody>
            {#each data.itgcs as c (c.id)}
              <tr class="tr">
                <td class="td font-mono text-xs">{c.code}</td>
                <td class="td font-medium">{c.name}</td>
                <td class="td">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {domainCls(c.domain)}">{c.domain}</span>
                </td>
                <td class="td text-xs text-slate-600">{c.owner}</td>
                <td class="td text-xs text-slate-500">{c.frequency}</td>
                <td class="td font-mono text-xs">{fmtDate(c.lastTestedAt)}</td>
                <td class="td">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {resultCls(c.result)}">{c.result}</span>
                </td>
                {#if !data.isAll}
                  <td class="td">
                    <form method="POST" action="?/updateItgcStatus" use:enhance>
                      <input type="hidden" name="itgcId" value={c.id} />
                      <select
                        name="status"
                        class="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-grc-primary"
                        on:change={(e) => e.currentTarget.form?.requestSubmit()}
                      >
                        <option value="effective"         selected={c.result === 'pass'}>Effective</option>
                        <option value="deficiency"        selected={c.result === 'partial'}>Deficiency</option>
                        <option value="material_weakness" selected={c.result === 'fail'}>Material Weakness</option>
                      </select>
                    </form>
                  </td>
                {/if}
              </tr>
            {:else}
              <tr><td colspan={data.isAll ? 7 : 8} class="px-4 py-8 text-center text-sm text-slate-500">No ITGCs recorded.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- KCAs -->
    {:else if tab === 'kcas'}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Code</th>
              <th class="px-4 py-2 text-left">Name</th>
              <th class="px-4 py-2 text-left">Process</th>
              <th class="px-4 py-2 text-left">Owner</th>
              <th class="px-4 py-2 text-left">Frequency</th>
              <th class="w-40 px-4 py-2 text-left">Automation</th>
              <th class="px-4 py-2 text-left">Last Test</th>
              <th class="px-4 py-2 text-left">Result</th>
            </tr>
          </thead>
          <tbody>
            {#each data.kcas.slice(0, 80) as c (c.id)}
              <tr class="tr">
                <td class="td font-mono text-xs">{c.code}</td>
                <td class="td font-medium">{c.name}</td>
                <td class="td"><span class="tag tag-slate">{c.process}</span></td>
                <td class="td text-xs text-slate-600">{c.owner}</td>
                <td class="td text-xs text-slate-500">{c.frequency}</td>
                <td class="td">
                  <div class="flex items-center gap-2">
                    <ProgressBar value={c.automationPct} color={c.automationPct >= 70 ? 'bg-violet-500' : c.automationPct >= 40 ? 'bg-amber-500' : 'bg-rose-500'} />
                    <span class="font-mono text-[10px] text-slate-500 w-8 text-right">{c.automationPct}%</span>
                  </div>
                </td>
                <td class="td font-mono text-xs">{fmtDate(c.lastTestedAt)}</td>
                <td class="td">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {resultCls(c.result)}">{c.result}</span>
                </td>
              </tr>
            {:else}
              <tr><td colspan="8" class="px-4 py-8 text-center text-sm text-slate-500">No KCAs recorded.</td></tr>
            {/each}
          </tbody>
        </table>
        {#if data.kcas.length > 80}
          <div class="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
            Showing first 80 of {data.kcas.length} KCAs.
          </div>
        {/if}
      </div>

    <!-- Walkthroughs -->
    {:else if tab === 'walkthroughs'}
      <div class="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 lg:grid-cols-3">
        {#each data.walkthroughs as w (w.id)}
          <div class="rounded-lg bg-white ring-1 ring-inset ring-slate-200/70 p-4">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="truncate font-semibold text-grc-ink">{w.process}</div>
                <div class="mt-0.5 text-xs text-slate-500">FY {w.year}</div>
              </div>
              <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {walkStatusCls(w.status)}">{w.status}</span>
            </div>
            <div class="mt-3 space-y-1.5 text-xs">
              <div class="flex items-center justify-between">
                <span class="text-slate-500">Conducted by</span>
                <span class="font-medium text-slate-700">{w.conductedBy}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-500">Dated</span>
                <span class="font-mono text-slate-700">{fmtDate(w.conductedAt)}</span>
              </div>
            </div>
          </div>
        {:else}
          <div class="col-span-3 px-4 py-8 text-center text-sm text-slate-500">No walkthroughs scheduled.</div>
        {/each}
      </div>

    <!-- Deficiencies -->
    {:else if tab === 'deficiencies'}
      {#if !data.isAll}
        <div class="border-b border-slate-100 px-5 py-3">
          <button class="btn-secondary text-sm" on:click={() => (showDeficiencyForm = !showDeficiencyForm)}>
            <Plus class="h-4 w-4" />
            Report Deficiency
          </button>
          {#if showDeficiencyForm}
            <div class="mt-4">
              {#if form?.deficiencyError}
                <p class="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-inset ring-rose-200">{form.deficiencyError}</p>
              {/if}
              <form method="POST" action="?/createDeficiency" use:enhance class="grid gap-4 sm:grid-cols-2">
                <label class="form-label sm:col-span-2">
                  Description <span class="text-rose-500">*</span>
                  <textarea name="description" required maxlength="2048" rows="2"
                    class="input mt-1 w-full resize-none" placeholder="Describe the deficiency…"></textarea>
                </label>
                <label class="form-label">
                  Severity
                  <select name="severity" class="input mt-1 w-full">
                    <option value="significant">Significant Deficiency</option>
                    <option value="material">Material Weakness</option>
                  </select>
                </label>
                <label class="form-label">
                  ITGC
                  <select name="itgcId" required class="input mt-1 w-full">
                    <option value="">— select ITGC —</option>
                    {#each data.itgcs as c (c.id)}
                      <option value={c.id}>{c.code} — {c.name}</option>
                    {/each}
                  </select>
                </label>
                <label class="form-label">
                  Root Cause
                  <textarea name="rootCause" maxlength="2048" rows="2"
                    class="input mt-1 w-full resize-none" placeholder="Optional…"></textarea>
                </label>
                <label class="form-label">
                  Remediation Plan
                  <textarea name="remediationPlan" maxlength="2048" rows="2"
                    class="input mt-1 w-full resize-none" placeholder="Optional…"></textarea>
                </label>
                <div class="flex items-center gap-2 sm:col-span-2">
                  <button type="submit" class="btn-primary text-sm">Submit</button>
                  <button type="button" class="btn-ghost text-sm" on:click={() => (showDeficiencyForm = false)}>Cancel</button>
                </div>
              </form>
            </div>
          {/if}
        </div>
      {/if}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Severity</th>
              <th class="px-4 py-2 text-left">Description</th>
              <th class="px-4 py-2 text-left">Root Cause</th>
              <th class="px-4 py-2 text-left">Remediation</th>
              <th class="px-4 py-2 text-left">Target Date</th>
              <th class="px-4 py-2 text-center">On Track</th>
            </tr>
          </thead>
          <tbody>
            {#each data.deficiencies as d (d.id)}
              <tr class="tr">
                <td class="td">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {sevCls(d.severity)}">{d.severity}</span>
                </td>
                <td class="td max-w-md font-medium">{d.description}</td>
                <td class="td max-w-xs text-xs text-slate-600">{d.rootCause}</td>
                <td class="td max-w-xs text-xs text-slate-600">{d.remediation}</td>
                <td class="td font-mono text-xs">{d.targetDate}</td>
                <td class="td text-center">
                  {#if d.onTrack}
                    <span class="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">on-track</span>
                  {:else}
                    <span class="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">at-risk</span>
                  {/if}
                </td>
              </tr>
            {:else}
              <tr><td colspan="6" class="px-4 py-8 text-center text-sm text-slate-500">No deficiencies — all controls operating effectively.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
