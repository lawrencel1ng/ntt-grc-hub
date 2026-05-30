<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import FrameworkBadge from '$lib/components/FrameworkBadge.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import { addToast } from '$lib/stores/toast';
  import { ExternalLink, Sparkles, Antenna, Calendar } from 'lucide-svelte';
  import type { RiskSeverity, RegImpact } from '$lib/data/types';

  export let data;

  $: TENANT_NAMES = data.tenantNames as Record<string, string>;

  function regColor(code?: string): string {
    switch (code) {
      case 'MAS':  return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'APRA': return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'EU':   return 'bg-indigo-50 text-indigo-700 ring-indigo-200';
      case 'OJK':  return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'RBI':  return 'bg-orange-50 text-orange-700 ring-orange-200';
      case 'HKMA': return 'bg-slate-100 text-slate-700 ring-slate-200';
      case 'BNM':  return 'bg-rose-50 text-rose-700 ring-rose-200';
      case 'PDPC': return 'bg-violet-50 text-violet-700 ring-violet-200';
      default:     return 'bg-slate-100 text-slate-700 ring-slate-200';
    }
  }
  function sevCls(s: RiskSeverity): string {
    if (s === 'critical') return 'bg-rose-100 text-rose-800 ring-rose-200';
    if (s === 'high')     return 'bg-orange-50 text-orange-700 ring-orange-200';
    if (s === 'medium')   return 'bg-amber-50 text-amber-700 ring-amber-200';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
  function impactCls(i: RegImpact): string {
    if (i === 'high')   return 'bg-rose-50 text-rose-700 ring-rose-200';
    if (i === 'medium') return 'bg-amber-50 text-amber-700 ring-amber-200';
    if (i === 'low')    return 'bg-slate-100 text-slate-600 ring-slate-200';
    return 'bg-violet-50 text-violet-700 ring-violet-200';
  }

  function fmtDate(iso?: string): string { return iso ? iso.slice(0, 10) : '—'; }
  function fmtRel(iso?: string): string {
    if (!iso) return '—';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)    return `${Math.floor(diff)}s ago`;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  // ---------- Action mapping suggestions (synthetic) ----------
  $: suggestions = (() => {
    const base = data.change.id === 'reg_hero_mas655'
      ? [
          'MAS-NOTICE-655-014 — cross-border outsourcing register',
          'MAS-NOTICE-655-022 — exit plan documentation',
          'MAS-NOTICE-655-028 — concentration risk reporting',
          'MAS-TRM-038 — KMS rotation evidence cadence'
        ]
      : [
          'ISO27001-A.5.20 — supplier relationships',
          'ISO27001-A.5.22 — monitoring of suppliers'
        ];
    return base.map((label, i) => ({ id: `sug_${data.change.id}_${i}`, label }));
  })();

  function applySuggestion(label: string) {
    addToast('success', `Mapping applied: ${label}`);
  }
</script>

<PageHeader
  title={data.change.title}
  breadcrumbs={[{ label: 'Regulatory Horizon', href: '/regwatch' }, { label: data.change.title }]}
>
  <svelte:fragment slot="actions">
    <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ring-1 ring-inset {regColor(data.change.regulatorCode)}">{data.change.regulatorCode}</span>
    <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {sevCls(data.change.severity)}">{data.change.severity}</span>
  </svelte:fragment>
</PageHeader>

<div class="space-y-6">
  <!-- Metadata card -->
  <div class="card p-5">
    <div class="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
      <div>
        <div class="section-title text-xs">Published</div>
        <div class="mt-1 font-mono text-slate-800">{fmtDate(data.change.publishedAt)} · <span class="text-xs text-slate-500">{fmtRel(data.change.publishedAt)}</span></div>
      </div>
      <div>
        <div class="section-title text-xs">Effective</div>
        <div class="mt-1 font-mono text-slate-800 flex items-center gap-1"><Calendar class="h-3 w-3" />{fmtDate(data.change.effectiveAt)}</div>
      </div>
      <div>
        <div class="section-title text-xs">Source</div>
        <div class="mt-1 flex items-center gap-2">
          {#if data.source?.sourceUrl}
            <a href={data.source.sourceUrl} target="_blank" rel="noopener" class="text-grc-primary hover:underline">
              {data.source.name}
            </a>
            <ExternalLink class="h-3 w-3 text-slate-400" />
          {:else}
            <span class="text-slate-500">{data.change.sourceName ?? '—'}</span>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Summary -->
  <div class="card p-5">
    <div class="mb-2 flex items-center gap-2">
      <Sparkles class="h-4 w-4 text-violet-600" />
      <h2 class="section-title">AI Summary</h2>
      <AgentTypeBadge type="intelligent" />
    </div>
    <p class="text-sm leading-relaxed text-slate-700">{data.change.summary}</p>
  </div>

  <!-- Impact Assessments -->
  <div class="card overflow-hidden">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <h2 class="section-title">Impact Assessments</h2>
      <span class="text-xs text-slate-400">{data.impacts.length} tenant{data.impacts.length === 1 ? '' : 's'}</span>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-2 text-left">Tenant</th>
            <th class="px-4 py-2 text-left">Framework</th>
            <th class="px-4 py-2 text-left">Impact</th>
            <th class="px-4 py-2 text-right">Gaps Opened</th>
            <th class="px-4 py-2 text-left">Assessed By</th>
            <th class="px-4 py-2 text-left">Assessed</th>
          </tr>
        </thead>
        <tbody>
          {#each data.impacts as ia (ia.id)}
            <tr class="tr">
              <td class="td font-medium">{TENANT_NAMES[ia.tenantId] ?? ia.tenantId}</td>
              <td class="td">
                {#if ia.frameworkId}
                  <FrameworkBadge name={ia.frameworkId} region="Singapore" />
                {:else}
                  <span class="text-xs text-slate-400">—</span>
                {/if}
              </td>
              <td class="td"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {impactCls(ia.impact)}">{ia.impact}</span></td>
              <td class="td text-right font-mono text-sm">{ia.gapsOpened}</td>
              <td class="td">
                {#if ia.assessedByAgentId}
                  <div class="flex items-center gap-1.5">
                    <AgentTypeBadge type="intelligent" />
                    <span class="text-[11px] text-slate-500">Reg Horizon</span>
                  </div>
                {:else}
                  <span class="text-xs text-slate-500">manual</span>
                {/if}
              </td>
              <td class="td text-xs text-slate-500">{fmtRel(ia.assessedAt)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Action mapping suggestions -->
  <div class="card p-5">
    <div class="mb-3 flex items-center gap-2">
      <Antenna class="h-4 w-4 text-violet-600" />
      <h2 class="section-title">Mapping Suggestions</h2>
    </div>
    <ul class="space-y-2">
      {#each suggestions as sug}
        <li class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <span class="font-mono text-xs text-slate-600">Map to requirement <span class="text-grc-primary">{sug.label}</span></span>
          <button class="btn-secondary py-1 text-xs" on:click={() => applySuggestion(sug.label)}>Apply</button>
        </li>
      {/each}
    </ul>
  </div>
</div>
