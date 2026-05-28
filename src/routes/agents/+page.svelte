<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import AgentCard from '$lib/components/AgentCard.svelte';
  import type { Agent, AgentType, AgentStatus } from '$lib/data/types';
  import { Bot, DollarSign, Clock, ShieldCheck, UserCheck, Gauge, Search, Sparkles, Cpu } from 'lucide-svelte';

  export let data;

  // ---------- Derived numbers across the whole 30d window ----------
  $: totalRuns30d = data.fleetSummary.reduce((s, x) => s + x.runs30d, 0);
  $: totalCostCents30d = data.fleetSummary.reduce((s, x) => s + x.costCents30d, 0);
  $: totalFteHours30d = data.fleetSummary.reduce((s, x) => s + x.fteHours30d, 0);
  // 160h/mo per FTE — keeps the math sane against an industry-standard
  // working month.
  $: totalFte = +(totalFteHours30d / 160).toFixed(1);

  // 30d decision economics — drives HITL Approval Rate + Auto-Approved %.
  $: decisionStats = (() => {
    const decisions = data.decisions;
    const total = decisions.length || 1;
    const auto = decisions.filter((d) => d.outcome === 'auto-approved').length;
    const hitlReviewed = decisions.filter(
      (d) => d.outcome === 'hitl-approved' || d.outcome === 'hitl-rejected'
    ).length;
    const hitlApproved = decisions.filter((d) => d.outcome === 'hitl-approved').length;
    const avgConfidence = decisions.reduce((s, d) => s + d.confidence, 0) / total;
    const hitlApprovalRate = hitlReviewed === 0 ? 1 : hitlApproved / hitlReviewed;
    return {
      total,
      auto,
      autoPct: auto / total,
      hitlApprovalRate,
      avgConfidence
    };
  })();

  // 30d savings story — FTE-hour × fully-loaded analyst cost ($120/h).
  $: annualSavings = (() => {
    const avoided30d = totalFteHours30d * 120;
    return (avoided30d * 12) / 30;
  })();
  $: fleetMonthlyCost = data.agents.reduce((s, a) => s + a.costMonthlyEstimateCents, 0) / 100;
  $: humanMonthlyEquivalent = (totalFteHours30d * 120 * 30) / 30;

  // ---------- Filter state ----------
  type TypeFilter = 'all' | AgentType;
  type StatusFilter = 'all' | AgentStatus;
  let typeFilter: TypeFilter = 'all';
  let statusFilter: StatusFilter = 'all';
  let search = '';

  $: filteredAgents = data.agents.filter((a: Agent) => {
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  $: statsById = new Map(data.fleetSummary.map((s) => [s.id, s]));

  function fmtMoney(dollars: number): string {
    if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
    if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
    return `$${dollars.toFixed(0)}`;
  }

  const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'deterministic', label: 'Deterministic' },
    { id: 'ai-powered', label: 'AI-Powered' },
    { id: 'intelligent', label: 'Intelligent' }
  ];
  const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'running', label: 'Running' },
    { id: 'idle', label: 'Idle' },
    { id: 'paused', label: 'Paused' }
  ];
</script>

<PageHeader
  title="Agent Fleet"
  subtitle="10 agents · {totalFte} FTE replaced · {fmtMoney(annualSavings)} saved annually"
/>

<div class="space-y-6">
  <!-- ============================================================== -->
  <!-- KPI strip (6)                                                   -->
  <!-- ============================================================== -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
    <Kpi label="Total Runs (30d)" value={totalRuns30d.toLocaleString()} delta={14} hint="across fleet">
      <Bot slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Total Cost (30d)" value={fmtMoney(totalCostCents30d / 100)} delta={6} hint="run rate">
      <DollarSign slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="FTE Hours (30d)" value={totalFteHours30d.toFixed(0)} delta={22} hint="≈ {totalFte} FTE">
      <Clock slot="icon" class="h-4 w-4 text-violet-500" />
    </Kpi>
    <Kpi
      label="HITL Approval Rate"
      value={(decisionStats.hitlApprovalRate * 100).toFixed(1)}
      suffix="%"
      hint="reviewed decisions"
    >
      <UserCheck slot="icon" class="h-4 w-4 text-emerald-600" />
    </Kpi>
    <Kpi
      label="Auto-Approved"
      value={(decisionStats.autoPct * 100).toFixed(1)}
      suffix="%"
      hint="{decisionStats.auto}/{decisionStats.total}"
    >
      <ShieldCheck slot="icon" class="h-4 w-4 text-emerald-600" />
    </Kpi>
    <Kpi label="Avg Confidence" value={(decisionStats.avgConfidence * 100).toFixed(1)} suffix="%" hint="fleet-wide">
      <Gauge slot="icon" class="h-4 w-4 text-slate-500" />
    </Kpi>
  </div>

  <!-- ============================================================== -->
  <!-- Filter bar                                                      -->
  <!-- ============================================================== -->
  <div class="card flex flex-wrap items-center gap-3 px-4 py-3">
    <div class="flex items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Type:</span>
      {#each TYPE_FILTERS as f}
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {typeFilter === f.id
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (typeFilter = f.id)}
        >
          {f.label}
        </button>
      {/each}
    </div>
    <span class="text-slate-300">·</span>
    <div class="flex items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status:</span>
      {#each STATUS_FILTERS as f}
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {statusFilter === f.id
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (statusFilter = f.id)}
        >
          {f.label}
        </button>
      {/each}
    </div>
    <div class="relative ml-auto w-full sm:w-64">
      <Search class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        bind:value={search}
        placeholder="Search agents…"
        class="input pl-8"
      />
    </div>
  </div>

  <!-- ============================================================== -->
  <!-- Agent grid                                                      -->
  <!-- ============================================================== -->
  {#if filteredAgents.length === 0}
    <div class="card p-8 text-center text-sm text-slate-500">No agents match those filters.</div>
  {:else}
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {#each filteredAgents as a (a.id)}
        {@const s = statsById.get(a.id) ?? { runs30d: 0, costCents30d: 0, fteHours30d: 0 }}
        <AgentCard agent={a} stats={{ runs30d: s.runs30d, costCents30d: s.costCents30d, fteHours30d: s.fteHours30d }} />
      {/each}
    </div>
  {/if}

  <!-- ============================================================== -->
  <!-- ROI banner                                                      -->
  <!-- ============================================================== -->
  <div
    class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 via-violet-600 to-violet-700 p-6 text-white shadow-lg"
  >
    <div class="absolute -right-8 -top-8 opacity-10">
      <Cpu class="h-48 w-48" />
    </div>
    <div class="relative">
      <div class="mb-1 flex items-center gap-2">
        <Sparkles class="h-5 w-5 text-violet-100" />
        <span class="text-xs font-semibold uppercase tracking-wider text-violet-100">Agent Fleet ROI</span>
      </div>
      <div class="text-3xl font-bold leading-tight">{fmtMoney(annualSavings)} saved annually</div>
      <div class="mt-1 max-w-2xl text-sm text-violet-50">
        10 agents replaced <span class="font-semibold">{totalFte} FTE</span> across the
        fleet — equivalent to <span class="font-semibold">{totalFteHours30d.toFixed(0)} analyst hours</span>
        of work in the last 30 days.
      </div>

      <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="rounded-xl bg-white/10 p-4 backdrop-blur-sm ring-1 ring-inset ring-white/20">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-violet-100">Fleet cost</div>
          <div class="mt-1 font-mono text-2xl font-bold">{fmtMoney(fleetMonthlyCost)}<span class="text-sm font-medium text-violet-100">/mo</span></div>
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
            <div class="h-full rounded-full bg-violet-200" style="width: {Math.max(1, Math.min(100, (fleetMonthlyCost / Math.max(1, humanMonthlyEquivalent)) * 100))}%"></div>
          </div>
        </div>
        <div class="rounded-xl bg-white/10 p-4 backdrop-blur-sm ring-1 ring-inset ring-white/20">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-violet-100">Human equivalent</div>
          <div class="mt-1 font-mono text-2xl font-bold">{fmtMoney(humanMonthlyEquivalent)}<span class="text-sm font-medium text-violet-100">/mo</span></div>
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
            <div class="h-full rounded-full bg-white" style="width: 100%"></div>
          </div>
        </div>
      </div>

      <div class="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-inset ring-white/30">
        <Sparkles class="h-3 w-3" />
        {(humanMonthlyEquivalent / Math.max(1, fleetMonthlyCost)).toFixed(0)}× ROI · zero-headcount scaling
      </div>
    </div>
  </div>
</div>
