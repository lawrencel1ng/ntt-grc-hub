<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import { addToast } from '$lib/stores/toast';
  import { ScrollText, FileEdit, UserCheck, Calendar, Plus, ChevronRight } from 'lucide-svelte';
  import type { PolicyVersionStatus, Policy } from '$lib/data/types';

  export let data;

  type StatusBucket = 'approved' | 'in-review' | 'draft' | 'retired';

  // ---------- Synthesise the per-policy status from the current version ----------
  function policyStatus(p: Policy): StatusBucket {
    const ver = data.currentByPolicy[p.id];
    if (!ver) return 'draft';
    if (ver.status === 'approved') return 'approved';
    if (ver.status === 'in-review') return 'in-review';
    if (ver.status === 'retired') return 'retired';
    return 'draft';
  }

  // Inject demo variety: rotate a few policies into other buckets so all
  // four columns are populated.
  $: bucketed = (() => {
    const out: Record<StatusBucket, Policy[]> = { approved: [], 'in-review': [], draft: [], retired: [] };
    data.policies.forEach((p, i) => {
      let s = policyStatus(p);
      if (i % 11 === 3) s = 'in-review';
      else if (i % 13 === 5) s = 'draft';
      else if (i % 17 === 7) s = 'retired';
      out[s].push(p);
    });
    return out;
  })();

  // ---------- KPIs ----------
  $: totalPolicies = data.policies.length;
  $: inReview = bucketed['in-review'].length;
  $: pendingAcks = Math.round(totalPolicies * 12.4); // ~12 pending acks per policy avg
  $: recentUpdates = data.policies.filter((p) => {
    const v = data.currentByPolicy[p.id];
    if (!v?.effectiveAt) return false;
    return (Date.now() - new Date(v.effectiveAt).getTime()) / 86_400_000 <= 30;
  }).length;

  // ---------- Filter ----------
  let jurisdictionFilter = 'all';
  let statusFilter: 'all' | StatusBucket = 'all';
  const STATUS_FILTERS: { id: 'all' | StatusBucket; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'approved', label: 'Approved' },
    { id: 'in-review', label: 'In Review' },
    { id: 'draft', label: 'Drafting' },
    { id: 'retired', label: 'Retired' }
  ];
  $: jurisdictions = ['all', ...new Set(data.policies.map((p) => p.jurisdiction))];

  // Apply filters to bucketed view
  $: visibleBuckets = (() => {
    const filter = (p: Policy) => {
      if (jurisdictionFilter !== 'all' && p.jurisdiction !== jurisdictionFilter) return false;
      return true;
    };
    return {
      approved: bucketed.approved.filter(filter),
      'in-review': bucketed['in-review'].filter(filter),
      draft: bucketed.draft.filter(filter),
      retired: bucketed.retired.filter(filter)
    };
  })();

  function ackRate(p: Policy): number {
    // Light heuristic: 0.78 for hero tenants, 0.92 otherwise; vary slightly per policy.
    const base = ['t_maybank','t_grab','t_mindef'].includes(p.tenantId) ? 0.78 : 0.92;
    return Math.min(1, base + ((p.id.length % 7) - 3) * 0.02);
  }

  function jurisdictionCls(_j: string): string {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }

  function newPolicy() {
    addToast('info', 'Policy Drafter agent ready — request queued.');
  }

  const COLUMNS: { id: StatusBucket; title: string; dot: string }[] = [
    { id: 'approved',  title: 'Approved',   dot: 'bg-emerald-500' },
    { id: 'in-review', title: 'In Review',  dot: 'bg-amber-500' },
    { id: 'draft',     title: 'Drafting',   dot: 'bg-blue-500' },
    { id: 'retired',   title: 'Retired',    dot: 'bg-slate-400' }
  ];
</script>

<PageHeader title="Policy Management" subtitle="{totalPolicies} policies tracked — drafted, reviewed, acknowledged.">
  <svelte:fragment slot="actions">
    <button class="btn-primary" on:click={newPolicy}>
      <Plus class="h-4 w-4" />
      <span>New Policy</span>
    </button>
  </svelte:fragment>
</PageHeader>

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Kpi label="Total Policies" value={totalPolicies.toString()}>
      <ScrollText slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="In Review" value={inReview.toString()} hint="awaiting approver">
      <FileEdit slot="icon" class="h-4 w-4 text-amber-600" />
    </Kpi>
    <Kpi label="Pending Acks" value={pendingAcks.toLocaleString()}>
      <UserCheck slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Updated (30d)" value={recentUpdates.toString()}>
      <Calendar slot="icon" class="h-4 w-4 text-slate-500" />
    </Kpi>
  </div>

  <!-- Filter -->
  <div class="card flex flex-wrap items-center gap-3 px-4 py-3">
    <select bind:value={jurisdictionFilter} class="input w-44 py-1.5">
      {#each jurisdictions as j}
        <option value={j}>{j === 'all' ? 'All jurisdictions' : j}</option>
      {/each}
    </select>
    <div class="flex items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status:</span>
      {#each STATUS_FILTERS as s}
        <button type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {statusFilter === s.id
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (statusFilter = s.id)}>{s.label}</button>
      {/each}
    </div>
  </div>

  <!-- Kanban -->
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-4">
    {#each COLUMNS as col}
      {#if statusFilter === 'all' || statusFilter === col.id}
        {@const items = visibleBuckets[col.id]}
        <div class="card overflow-hidden">
          <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full {col.dot}"></span>
              <h2 class="section-title">{col.title}</h2>
            </div>
            <span class="text-xs text-slate-400">{items.length}</span>
          </div>
          <div class="divide-y divide-slate-100">
            {#each items as p (p.id)}
              {@const ver = data.currentByPolicy[p.id]}
              {@const rate = ackRate(p)}
              <a href="/policies/{p.id}" class="block px-4 py-3 hover:bg-slate-50">
                <div class="flex items-start justify-between">
                  <div class="min-w-0 flex-1">
                    <div class="font-mono text-xs text-slate-500">{p.code}</div>
                    <div class="mt-0.5 truncate font-semibold text-grc-ink">{p.title}</div>
                    <div class="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset {jurisdictionCls(p.jurisdiction)}">{p.jurisdiction}</span>
                      {#if ver}
                        <span>v{ver.versionNo.replace(/^v/, '')}</span>
                      {/if}
                    </div>
                    <div class="mt-2 flex items-center gap-2">
                      <ProgressBar value={rate * 100} />
                      <span class="font-mono text-xs text-slate-500 w-10 text-right">{Math.round(rate * 100)}%</span>
                    </div>
                    {#if ver?.draftedByAgentId}
                      <div class="mt-1.5 flex items-center gap-1.5">
                        <AgentTypeBadge type="intelligent" />
                        <span class="text-[10px] text-slate-500">Drafted by Policy Drafter</span>
                      </div>
                    {/if}
                  </div>
                  <ChevronRight class="ml-2 mt-1 h-4 w-4 flex-none text-slate-400" />
                </div>
              </a>
            {:else}
              <div class="px-4 py-8 text-center text-xs text-slate-400">Empty</div>
            {/each}
          </div>
        </div>
      {/if}
    {/each}
  </div>
</div>
