<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import { addToast } from '$lib/stores/toast';
  import { enhance } from '$app/forms';
  import { ClipboardCheck, FileBarChart, CheckCircle2, AlertTriangle, Plus, ChevronRight, User as UserIcon } from 'lucide-svelte';
  import type { AuditEngagement, AuditFinding, EngagementType } from '$lib/data/types';

  export let data;
  export let form;
  $: if (form?.engagementCreated) { addToast('success', 'Engagement created.'); showForm = false; }
  $: if (form?.engagementError) addToast('error', form.engagementError);
  let showForm = false;

  // ---------- KPIs ----------
  $: active = data.audits.filter((a) => !a.closedAt);
  $: closed90d = data.audits.filter((a) => {
    if (!a.closedAt) return false;
    return (Date.now() - new Date(a.closedAt).getTime()) / 86_400_000 <= 90;
  });
  // Synthesise an "in planning" bucket from the most recently opened audits.
  $: inPlanning = active.filter((a) => (Date.now() - new Date(a.openedAt).getTime()) / 86_400_000 <= 21);
  $: activeOngoing = active.filter((a) => (Date.now() - new Date(a.openedAt).getTime()) / 86_400_000 > 21);
  $: openFindings = (() => {
    let n = 0;
    for (const id in data.findingsByAudit) {
      n += data.findingsByAudit[id].filter((f) => f.status === 'open').length;
    }
    return n;
  })();

  function typeCls(t: EngagementType): string {
    switch (t) {
      case 'external':   return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'internal':   return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'regulatory': return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'customer':   return 'bg-violet-50 text-violet-700 ring-violet-200';
    }
  }

  function severitySplit(findings: AuditFinding[]) {
    return {
      critical: findings.filter((f) => f.severity === 'critical').length,
      high:     findings.filter((f) => f.severity === 'high').length,
      medium:   findings.filter((f) => f.severity === 'medium').length,
      low:      findings.filter((f) => f.severity === 'low').length
    };
  }

  function fmtDate(iso: string): string {
    return iso.slice(0, 10);
  }
</script>

<PageHeader title="Audit Management" subtitle="External, internal, regulatory and customer engagements — orchestrated end-to-end.">
  <svelte:fragment slot="actions">
    <button class="btn-primary" on:click={() => (showForm = !showForm)}>
      <Plus class="h-4 w-4" />
      <span>New Engagement</span>
    </button>
  </svelte:fragment>
</PageHeader>

{#if showForm}
  <div class="card p-5">
    <h3 class="mb-3 text-sm font-semibold text-grc-ink">New engagement</h3>
    <form method="POST" action="?/createEngagement" use:enhance class="flex flex-wrap items-end gap-3">
      <label class="block flex-1 min-w-[200px]">
        <span class="mb-1 block text-xs font-medium text-slate-700">Engagement name</span>
        <input name="name" type="text" class="input" placeholder="MAS TRM Annual Review 2026" required maxlength="256" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-700">Type</span>
        <select name="type" class="input">
          <option value="internal">Internal</option>
          <option value="external">External</option>
          <option value="regulatory">Regulatory</option>
          <option value="customer">Customer</option>
        </select>
      </label>
      <label class="block flex-1 min-w-[160px]">
        <span class="mb-1 block text-xs font-medium text-slate-700">Lead auditor</span>
        <input name="leadAuditor" type="text" class="input" placeholder="Auditor name or firm" required maxlength="256" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-700">Opening date</span>
        <input name="openedAt" type="date" class="input" value={new Date().toISOString().slice(0, 10)} />
      </label>
      <label class="block flex-1 min-w-[200px]">
        <span class="mb-1 block text-xs font-medium text-slate-700">Scope (optional)</span>
        <input name="scope" type="text" class="input" placeholder="Scope of engagement…" maxlength="2048" />
      </label>
      <div class="flex gap-2">
        <button type="submit" class="btn-primary">Create</button>
        <button type="button" class="btn-secondary" on:click={() => (showForm = false)}>Cancel</button>
      </div>
    </form>
  </div>
{/if}

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Kpi label="Active" value={active.length.toString()}>
      <ClipboardCheck slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="In Planning" value={inPlanning.length.toString()} hint="opened <21d">
      <FileBarChart slot="icon" class="h-4 w-4 text-amber-600" />
    </Kpi>
    <Kpi label="Closed (90d)" value={closed90d.length.toString()}>
      <CheckCircle2 slot="icon" class="h-4 w-4 text-slate-500" />
    </Kpi>
    <Kpi label="Open Findings" value={openFindings.toString()} tone="bad">
      <AlertTriangle slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
  </div>

  <!-- Kanban -->
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
    {#each [
      { title: 'Active', items: activeOngoing, color: 'border-violet-200', dot: 'bg-violet-500' },
      { title: 'In Planning', items: inPlanning, color: 'border-amber-200', dot: 'bg-amber-500' },
      { title: 'Recently Closed', items: closed90d, color: 'border-slate-200', dot: 'bg-slate-400' }
    ] as col}
      <div class="card overflow-hidden">
        <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full {col.dot}"></span>
            <h2 class="section-title">{col.title}</h2>
          </div>
          <span class="text-xs text-slate-400">{col.items.length}</span>
        </div>
        <div class="divide-y divide-slate-100">
          {#each col.items as a (a.id)}
            {@const splits = severitySplit(data.findingsByAudit[a.id] ?? [])}
            <a href="/audits/{a.id}" class="block px-4 py-3 hover:bg-slate-50">
              <div class="flex items-start justify-between">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-grc-ink">{a.name}</span>
                  </div>
                  <div class="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset {typeCls(a.type)}">{a.type}</span>
                    <span class="flex items-center gap-1"><UserIcon class="h-3 w-3" /> {a.leadAuditor}</span>
                  </div>
                  <div class="mt-1 text-xs text-slate-500 font-mono">
                    {fmtDate(a.openedAt)}{a.closedAt ? ` → ${fmtDate(a.closedAt)}` : ' → present'}
                  </div>
                  <div class="mt-2 flex items-center gap-2 text-[11px]">
                    {#if splits.critical > 0}
                      <span class="rounded-full bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-700">{splits.critical} crit</span>
                    {/if}
                    {#if splits.high > 0}
                      <span class="rounded-full bg-orange-50 px-1.5 py-0.5 font-semibold text-orange-700">{splits.high} high</span>
                    {/if}
                    {#if splits.medium > 0}
                      <span class="rounded-full bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">{splits.medium} med</span>
                    {/if}
                    {#if splits.low > 0}
                      <span class="rounded-full bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">{splits.low} low</span>
                    {/if}
                  </div>
                </div>
                <ChevronRight class="ml-2 mt-1 h-4 w-4 text-slate-400" />
              </div>
            </a>
          {:else}
            <div class="px-4 py-8 text-center text-xs text-slate-400">No engagements in this column.</div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>
