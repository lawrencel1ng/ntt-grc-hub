<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import Heatmap5x5 from '$lib/components/Heatmap5x5.svelte';
  import AgentRunLog from '$lib/components/AgentRunLog.svelte';
  import Radar from '$lib/components/Radar.svelte';
  import BarChart from '$lib/components/BarChart.svelte';
  import ConfidenceBar from '$lib/components/ConfidenceBar.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import { toCsv } from '$lib/utils/csv';
  import type {
    AgentRun,
    AgentDecision,
    HeatmapCell,
    RiskSeverity,
    RiskLikelihood
  } from '$lib/data/types';
  import {
    AlertTriangle,
    Bot,
    Cpu,
    DollarSign,
    Download,
    FileBarChart,
    Sparkles,
    ShieldCheck,
    UserCheck,
    ShieldX,
    Clock as ClockIcon,
    ArrowRight,
    Antenna,
    BookOpen
  } from 'lucide-svelte';

  export let data;

  // ---------- Local UI state ----------
  type TimeRange = '24h' | '7d' | '30d' | 'qtd';
  let timeRange: TimeRange = '30d';

  // Local copy of runs so SSE can prepend without mutating the loader value.
  let liveRuns: AgentRun[] = [...data.runs];
  let sseConnected = false;
  let es: EventSource | null = null;

  // ---------- Derived numbers for the hero strip ----------
  $: liveAgents = data.agents.filter((a) => a.status === 'running').length;
  $: lastRun = liveRuns[0];
  $: lastRunSeconds = lastRun
    ? Math.max(1, Math.floor((Date.now() - new Date(lastRun.startedAt).getTime()) / 1000))
    : 47;
  $: fteSaved = +(
    data.fleetSummary.reduce((s, x) => s + x.fteHours30d, 0) / 160
  ).toFixed(1);
  $: annualSavings = (() => {
    // 30d cost vs avoided cost (heuristic: each FTE-hour saved ≈ S$120 fully loaded).
    const fteHours = data.fleetSummary.reduce((s, x) => s + x.fteHours30d, 0);
    const avoided30d = fteHours * 120;
    return (avoided30d * 12) / 30;
  })();

  // ---------- Sev → label helpers ----------
  const SEV_RANK: Record<RiskSeverity, number> = {
    info: 1,
    low: 2,
    medium: 3,
    high: 4,
    critical: 5
  };
  const LIK_RANK: Record<RiskLikelihood, number> = {
    rare: 1,
    unlikely: 2,
    possible: 3,
    likely: 4,
    'almost-certain': 5
  };

  function sevChipCls(sev: RiskSeverity): string {
    switch (sev) {
      case 'critical':
        return 'bg-rose-50 text-rose-700 ring-rose-200';
      case 'high':
        return 'bg-orange-50 text-orange-700 ring-orange-200';
      case 'medium':
        return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'low':
        return 'bg-violet-50 text-violet-700 ring-violet-200';
      default:
        return 'bg-slate-100 text-slate-700 ring-slate-200';
    }
  }

  function residualScore(sev: RiskSeverity, lik: RiskLikelihood): number {
    return SEV_RANK[sev] * LIK_RANK[lik];
  }

  // Heatmap5x5 expects numeric sev/lik (1..5). Convert the string-typed cells.
  $: numericHeatmap = data.heatmap.map((c: HeatmapCell) => ({
    sev: SEV_RANK[c.sev],
    lik: LIK_RANK[c.lik],
    n: c.n
  }));

  // ---------- Radar series for Framework Posture (top 8) ----------
  $: radarAxes = data.frameworks.slice(0, 8).map((f) => shortFwName(f.name));
  $: radarSeries = [
    {
      name: 'Current',
      color: '#6d28d9',
      values: data.frameworks.slice(0, 8).map((f) => f.score ?? 0)
    },
    {
      name: 'Target',
      color: '#d946ef',
      values: data.frameworks.slice(0, 8).map(() => 90)
    }
  ];

  function shortFwName(name: string): string {
    return name.length > 16 ? name.slice(0, 14) + '…' : name;
  }

  // ---------- BarChart — Agent cost vs FTE saved (30d, per agent) ----------
  $: costByAgent = (() => {
    const map = new Map<string, { cost: number; fte: number }>();
    for (const e of data.cost30d) {
      const prev = map.get(e.agentId) ?? { cost: 0, fte: 0 };
      map.set(e.agentId, {
        cost: prev.cost + e.costCents,
        fte: prev.fte + e.fteSavedHours
      });
    }
    const rows = data.agents.map((a) => {
      const v = map.get(a.id) ?? { cost: 0, fte: 0 };
      return {
        name: shortAgentName(a.name),
        costDollars: +(v.cost / 100).toFixed(0),
        fteHours: +v.fte.toFixed(0)
      };
    });
    // Sort by cost desc and take top 8 so bars stay legible.
    return rows.sort((a, b) => b.costDollars - a.costDollars).slice(0, 8);
  })();

  function shortAgentName(name: string): string {
    return name.length > 14 ? name.split(' ')[0] : name;
  }

  $: barLabels = costByAgent.map((r) => r.name);
  $: barSeries = [
    { name: 'Cost (USD)', color: '#6d28d9', data: costByAgent.map((r) => r.costDollars) },
    { name: 'FTE-hours', color: '#d946ef', data: costByAgent.map((r) => r.fteHours) }
  ];

  // ---------- Reg horizon formatting ----------
  function relativeTs(ts: string): string {
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function regulatorBadgeCls(code: string | undefined): string {
    const c = (code ?? '').toUpperCase();
    if (c === 'MAS') return 'bg-violet-50 text-violet-700 ring-violet-200';
    if (c === 'EU') return 'bg-indigo-50 text-indigo-700 ring-indigo-200';
    if (c === 'APRA') return 'bg-amber-50 text-amber-700 ring-amber-200';
    if (c === 'OJK') return 'bg-rose-50 text-rose-700 ring-rose-200';
    if (c === 'RBI') return 'bg-violet-50 text-violet-700 ring-violet-200';
    return 'bg-slate-100 text-slate-700 ring-slate-200';
  }

  // ---------- Decision row helpers (compact in-page table) ----------
  function decisionOutcomeCls(o: AgentDecision['outcome']): string {
    switch (o) {
      case 'auto-approved':
        return 'bg-slate-100 text-slate-700 ring-slate-200';
      case 'hitl-approved':
        return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'hitl-rejected':
        return 'bg-rose-50 text-rose-700 ring-rose-200';
      default:
        return 'bg-amber-50 text-amber-700 ring-amber-200';
    }
  }
  function decisionOutcomeLabel(o: AgentDecision['outcome']): string {
    if (o === 'auto-approved') return 'Auto';
    if (o === 'hitl-approved') return 'HITL Approved';
    if (o === 'hitl-rejected') return 'HITL Rejected';
    return 'Awaiting HITL';
  }

  // ---------- Board narrative split into paragraphs ----------
  $: narrativeParagraphs = data.narrative
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('**'));

  // ---------- CSV export of decisions table ----------
  function downloadDecisionsCsv() {
    const rows = data.decisions.map((d) => ({
      agent: d.agentName ?? d.agentId,
      decisionType: d.decisionType,
      confidence: d.confidence,
      outcome: d.outcome,
      approver: d.approverUserId ?? '',
      decidedAt: d.decidedAt
    }));
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recent-decisions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---------- SSE wiring ----------
  let nextSseId = -1; // negative ids so we don't collide with seeded mock ids
  onMount(() => {
    es = new EventSource('/api/events');
    es.addEventListener('hello', () => {
      sseConnected = true;
    });
    es.addEventListener('agent-run', (ev) => {
      try {
        const payload = JSON.parse((ev as MessageEvent).data);
        const run: AgentRun = {
          id: nextSseId--,
          agentId: payload.agentId,
          agentName: payload.agentName,
          trigger: 'cron',
          startedAt: payload.ts,
          status: payload.status,
          inputSummary: payload.inputSummary,
          outputSummary: payload.outputSummary,
          toolsCalled: [],
          costCents: payload.costCents,
          latencyMs: payload.latencyMs
        };
        liveRuns = [run, ...liveRuns].slice(0, 20);
      } catch {
        /* malformed event — ignore */
      }
    });
    es.onerror = () => {
      sseConnected = false;
    };
    es.onopen = () => {
      sseConnected = true;
    };
  });

  onDestroy(() => {
    if (es) {
      es.close();
      es = null;
    }
  });

  const TIME_RANGES: { id: TimeRange; label: string }[] = [
    { id: '24h', label: '24h' },
    { id: '7d', label: '7d' },
    { id: '30d', label: '30d' },
    { id: 'qtd', label: 'QTD' }
  ];
</script>

<PageHeader
  title="Risk Cockpit"
  subtitle={data.isAll
    ? 'MSSP Rollup — All Tenants'
    : `${data.currentTenant?.name ?? 'Tenant'} — ${data.currentTenant?.industry ?? ''}`}
>
  <svelte:fragment slot="actions">
    <div class="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs">
      {#each TIME_RANGES as r}
        <button
          type="button"
          class="rounded-md px-2.5 py-1 font-medium transition-colors {timeRange === r.id
            ? 'bg-grc-primary text-white'
            : 'text-slate-600 hover:bg-slate-100'}"
          on:click={() => (timeRange = r.id)}
        >
          {r.label}
        </button>
      {/each}
    </div>
    <button class="btn-secondary" on:click={downloadDecisionsCsv}>
      <Download class="h-4 w-4" />
      <span>Download CSV</span>
    </button>
  </svelte:fragment>
</PageHeader>

<div class="space-y-6">
  <!-- ============================================================ -->
  <!-- 1. Hero strip                                                 -->
  <!-- ============================================================ -->
  <div
    class="flex flex-wrap items-center gap-4 rounded-xl bg-gradient-to-r from-violet-50 via-violet-100/50 to-violet-50 px-5 py-4 ring-1 ring-inset ring-violet-200"
  >
    <div class="flex items-center gap-2">
      <span class="relative flex h-2.5 w-2.5">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75"></span>
        <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-violet-500"></span>
      </span>
      <Bot class="h-4 w-4 text-violet-700" />
      <span class="text-sm font-semibold text-violet-900">{liveAgents} agents online</span>
    </div>
    <span class="text-violet-300">·</span>
    <span class="text-sm text-violet-900">
      Last decision <span class="font-mono font-semibold">{lastRunSeconds}s</span> ago
    </span>
    <span class="text-violet-300">·</span>
    <span class="text-sm text-violet-900">
      <span class="font-mono font-semibold">{fteSaved}</span> FTE replaced
    </span>
    <span class="text-violet-300">·</span>
    <span class="text-sm text-violet-900">
      <span class="font-mono font-semibold">${(annualSavings / 1_000_000).toFixed(1)}M</span> saved annually
    </span>
    <div class="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-violet-700 ring-1 ring-inset ring-violet-300">
      <Cpu class="h-3 w-3" />
      Agentic GRC OS
    </div>
  </div>

  <!-- ============================================================ -->
  <!-- 2. KPI strip                                                  -->
  <!-- ============================================================ -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
    <Kpi
      label="Open Critical Risks"
      value={String(data.kpis.openCriticalRisks)}
      delta={-12}
      hint="vs last 30d"
      tone="bad"
    >
      <AlertTriangle slot="icon" class="h-4 w-4 text-rose-500" />
    </Kpi>
    <Kpi
      label="Avg Compliance Score"
      value={data.kpis.avgComplianceScore.toFixed(1)}
      suffix="%"
      delta={3}
      hint="8 frameworks"
    >
      <ShieldCheck slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi
      label="Open Findings"
      value={String(data.kpis.openFindings)}
      delta={-8}
      hint="closing fast"
      tone="bad"
    >
      <FileBarChart slot="icon" class="h-4 w-4 text-slate-500" />
    </Kpi>
    <Kpi
      label="Vendor Risk Index"
      value={String(data.kpis.vendorRiskIndex)}
      suffix="/100"
      delta={2}
      hint="of 47 vendors"
    >
      <BookOpen slot="icon" class="h-4 w-4 text-slate-500" />
    </Kpi>
    <Kpi
      label="Agent FTE Saved (30d)"
      value={fteSaved.toFixed(1)}
      suffix="FTE"
      delta={18}
      hint="160 h/FTE"
    >
      <Bot slot="icon" class="h-4 w-4 text-violet-500" />
    </Kpi>
    <Kpi
      label="Evidence Items (30d)"
      value={data.evidenceStats.total.toLocaleString()}
      delta={6}
      hint={data.evidenceStats.chainOk ? 'hash-chain OK' : 'chain broken'}
    >
      <DollarSign slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
  </div>

  <!-- ============================================================ -->
  <!-- 3. Heatmap + Top Risks  |  Live Agent Stream                  -->
  <!-- ============================================================ -->
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <div class="card p-5 lg:col-span-2">
      <div class="mb-3 flex items-baseline justify-between">
        <h2 class="section-title">Risk Heatmap — Residual</h2>
        <span class="text-xs text-slate-400">{data.topRisks.length} top risks · 5×5 residual matrix</span>
      </div>
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <Heatmap5x5 cells={numericHeatmap} />
          <p class="mt-2 text-center text-[11px] text-slate-400">Click any cell to drill down</p>
        </div>
        <div>
          <div class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Top Risks (residual)</div>
          <ul class="space-y-1.5">
            {#each data.topRisks as r}
              {@const score = residualScore(r.residualSeverity, r.residualLikelihood)}
              <li>
                <a
                  href="/risk/{r.id}"
                  class="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-sm hover:border-slate-200 hover:bg-slate-50"
                >
                  <span class="font-mono text-[11px] text-slate-400">{r.code}</span>
                  <span class="min-w-0 flex-1 truncate text-slate-700">{r.title}</span>
                  <span
                    class="flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset {sevChipCls(
                      r.residualSeverity
                    )}"
                  >
                    {r.residualSeverity} · {score}
                  </span>
                </a>
              </li>
            {/each}
          </ul>
        </div>
      </div>
    </div>

    <div class="card flex flex-col p-5">
      <div class="mb-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <h2 class="section-title">Live Agent Stream</h2>
          <span class="relative flex h-2 w-2">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75"></span>
            <span class="relative inline-flex h-2 w-2 rounded-full bg-violet-500"></span>
          </span>
        </div>
        <span
          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset {sseConnected
            ? 'bg-violet-50 text-violet-700 ring-violet-200'
            : 'bg-slate-100 text-slate-600 ring-slate-200'}"
        >
          <span class="h-1.5 w-1.5 rounded-full {sseConnected ? 'bg-violet-500' : 'bg-slate-400'}"></span>
          {sseConnected ? 'SSE connected' : 'connecting…'}
        </span>
      </div>
      <div class="flex-1 overflow-hidden">
        <AgentRunLog runs={liveRuns} />
      </div>
      <a
        href="/stream"
        class="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-grc-primary hover:underline"
      >
        Open full stream
        <ArrowRight class="h-3 w-3" />
      </a>
    </div>
  </div>

  <!-- ============================================================ -->
  <!-- 4. Framework Posture | Cost vs FTE | Regulatory Horizon       -->
  <!-- ============================================================ -->
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <div class="card p-5">
      <h2 class="section-title mb-3">Framework Posture</h2>
      <Radar axes={radarAxes} series={radarSeries} maxValue={100} />
      <p class="mt-2 text-[11px] text-slate-400">Current (violet) vs Target 90 (fuchsia) across top 8 frameworks.</p>
    </div>

    <div class="card p-5">
      <h2 class="section-title mb-3">Agent Cost vs FTE Saved (30d)</h2>
      <BarChart labels={barLabels} series={barSeries} stacked={false} height={240} />
      <p class="mt-2 text-[11px] text-slate-400">Top 8 agents by spend. Hover any bar for raw values.</p>
    </div>

    <div class="card p-5">
      <h2 class="section-title mb-3 flex items-center gap-2">
        <Antenna class="h-3.5 w-3.5 text-grc-primary" />
        Regulatory Horizon — Latest
      </h2>
      <ul class="space-y-3">
        {#each data.recentReg as c}
          <li class="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
            <div class="mb-1 flex items-center gap-2">
              <span
                class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset {regulatorBadgeCls(
                  c.regulatorCode
                )}"
              >
                {c.regulatorCode ?? 'REG'}
              </span>
              <span class="text-[11px] text-slate-400">{relativeTs(c.publishedAt)}</span>
            </div>
            <div class="text-sm font-medium leading-snug text-slate-800">{c.title}</div>
            <div class="mt-0.5 text-[11px] text-slate-500">
              Detected by <span class="font-semibold text-violet-700">Regulatory Horizon</span> agent
            </div>
          </li>
        {/each}
      </ul>
      <a
        href="/regwatch"
        class="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-grc-primary hover:underline"
      >
        View regulatory feed
        <ArrowRight class="h-3 w-3" />
      </a>
    </div>
  </div>

  <!-- ============================================================ -->
  <!-- 5. Recent Decisions table                                     -->
  <!-- ============================================================ -->
  <div class="card overflow-hidden">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <h2 class="section-title">Recent Decisions</h2>
      <a
        href="/decisions"
        class="inline-flex items-center gap-1 text-xs font-semibold text-grc-primary hover:underline"
      >
        All decisions
        <ArrowRight class="h-3 w-3" />
      </a>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-2 text-left">Agent</th>
            <th class="px-4 py-2 text-left">Decision Type</th>
            <th class="px-4 py-2 text-left">Confidence</th>
            <th class="px-4 py-2 text-left">Outcome</th>
            <th class="px-4 py-2 text-left">Approver</th>
            <th class="px-4 py-2 text-right">Time</th>
          </tr>
        </thead>
        <tbody>
          {#each data.decisions as d}
            {@const agent = data.agents.find((a) => a.id === d.agentId)}
            <tr class="tr">
              <td class="td">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-slate-800">{d.agentName ?? agent?.name ?? d.agentId}</span>
                  {#if agent}<AgentTypeBadge type={agent.type} />{/if}
                </div>
              </td>
              <td class="td">{d.decisionType}</td>
              <td class="td"><ConfidenceBar value={d.confidence} /></td>
              <td class="td">
                <span
                  class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {decisionOutcomeCls(
                    d.outcome
                  )}"
                >
                  {#if d.outcome === 'auto-approved'}
                    <ShieldCheck class="h-3 w-3" />
                  {:else if d.outcome === 'hitl-approved'}
                    <UserCheck class="h-3 w-3" />
                  {:else if d.outcome === 'hitl-rejected'}
                    <ShieldX class="h-3 w-3" />
                  {:else}
                    <ClockIcon class="h-3 w-3" />
                  {/if}
                  {decisionOutcomeLabel(d.outcome)}
                </span>
              </td>
              <td class="td text-slate-600">{d.approverUserId ?? '—'}</td>
              <td class="td text-right text-slate-500">{relativeTs(d.decidedAt)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- ============================================================ -->
  <!-- 6. Board Narrative Preview                                    -->
  <!-- ============================================================ -->
  <div class="card-elevated relative overflow-hidden bg-gradient-to-br from-violet-50 via-white to-violet-50/40 p-6">
    <div class="mb-3 flex items-center gap-2">
      <Sparkles class="h-4 w-4 text-violet-600" />
      <span class="text-xs font-semibold uppercase tracking-wider text-violet-700">
        Generated by Board Narrator agent
      </span>
      <span class="text-xs text-slate-400">· 11 min ago</span>
    </div>
    <div class="prose prose-sm max-w-none text-slate-700">
      {#each narrativeParagraphs.slice(0, 4) as para}
        <p class="mb-3 leading-relaxed">{para}</p>
      {/each}
    </div>
    <a
      href="/board"
      class="mt-2 inline-flex items-center gap-1 rounded-lg bg-grc-primary px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-grc-primary-dark"
    >
      Read full Board Pack
      <ArrowRight class="h-4 w-4" />
    </a>
  </div>
</div>
