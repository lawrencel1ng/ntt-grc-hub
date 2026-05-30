<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import Sparkline from '$lib/components/Sparkline.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import { addToast } from '$lib/stores/toast';
  import {
    GraduationCap, ShieldAlert, Target, Users as UsersIcon, Calculator,
    TrendingDown, ChevronRight, Search, RefreshCw, FileBarChart, Mail,
    AlertTriangle, CheckCircle2, BookOpen
  } from 'lucide-svelte';
  import type {
    HumanRiskUser, HumanRiskLevel, HumanRiskDepartment,
    PhishingCampaign, TrainingCampaign, PhishResult
  } from '$lib/data/types';

  export let data;

  $: s = data.summary;

  // ---------- formatters ----------
  function fmtMoney(n: number, currency = 'SGD'): string {
    if (n >= 1e9) return `${currency} ${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${currency} ${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${currency} ${(n / 1e3).toFixed(0)}K`;
    return `${currency} ${n.toFixed(0)}`;
  }
  function fmtDate(iso?: string): string {
    return iso ? iso.slice(0, 10) : '—';
  }

  // ---------- risk-level styling ----------
  function levelCls(l: HumanRiskLevel): string {
    switch (l) {
      case 'critical': return 'bg-rose-100 text-rose-800 ring-rose-200';
      case 'high':     return 'bg-orange-50 text-orange-700 ring-orange-200';
      case 'moderate': return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'low':      return 'bg-violet-50 text-violet-700 ring-violet-200';
    }
  }
  function scoreCls(score: number): string {
    if (score >= 65) return 'bg-rose-600 text-white';
    if (score >= 45) return 'bg-orange-500 text-white';
    if (score >= 25) return 'bg-amber-300 text-amber-900';
    return 'bg-violet-100 text-violet-800';
  }
  function phishCls(r: PhishResult): string {
    switch (r) {
      case 'reported':     return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'no-action':    return 'bg-slate-100 text-slate-600 ring-slate-200';
      case 'opened':       return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'clicked':      return 'bg-orange-50 text-orange-700 ring-orange-200';
      case 'data-entered': return 'bg-rose-50 text-rose-700 ring-rose-200';
    }
  }

  // ---------- trend chart ----------
  $: trendLabels = s ? s.riskScoreHistory.map((h) => h.period) : [];
  $: trendSeries = s ? [
    { name: 'Org Human Risk Score', color: '#6d28d9', data: s.riskScoreHistory.map((h) => h.score), area: true },
    { name: 'Phish-prone %', color: '#e11d48', data: s.riskScoreHistory.map((h) => h.ppp) }
  ] : [];

  // ---------- tabs ----------
  type Tab = 'users' | 'phishing' | 'training';
  let tab: Tab = 'users';

  // ---------- user search ----------
  let search = '';
  let levelFilter: 'all' | HumanRiskLevel = 'all';
  $: filteredUsers = data.users.filter((u: HumanRiskUser) => {
    if (levelFilter !== 'all' && u.riskLevel !== levelFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !u.department.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const LEVEL_FILTERS: { id: 'all' | HumanRiskLevel; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'critical', label: 'Critical' },
    { id: 'high', label: 'High' },
    { id: 'moderate', label: 'Moderate' },
    { id: 'low', label: 'Low' }
  ];

  function pppDelta(): number {
    if (!s) return 0;
    return +(s.phishPronePct - s.phishPronePct12mAgo).toFixed(1);
  }

  let syncing = false;
  async function sync() {
    if (syncing) return;
    syncing = true;
    addToast('info', 'Pulling latest risk scores from KnowBe4 Virtual Risk Officer…');
    try {
      const res = await fetch('/api/human-risk/sync', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        addToast('error', `Sync failed: ${body.message ?? res.statusText}`);
      } else {
        const { usersSync } = await res.json();
        addToast('success', `Synced ${usersSync} user risk profiles · org score refreshed. Reload to see updated data.`);
      }
    } catch {
      addToast('error', 'Network error — could not reach the sync endpoint.');
    } finally {
      syncing = false;
    }
  }
  function pushToRegister() {
    // Status indicator — the register entry and FAIR scenario links above provide navigation.
    addToast('info', 'Human-risk exposure is linked to the ERM register entry and FAIR scenario shown above.');
  }
</script>

<PageHeader
  title="Human Risk Management"
  subtitle="KnowBe4 Virtual Risk Officer · per-user scoring → org Human Risk Score → quantified FAIR ALE {data.isAll ? '· aggregated view' : ''}"
>
  <svelte:fragment slot="actions">
    <span class="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
      <GraduationCap class="h-3.5 w-3.5" /> KnowBe4
    </span>
    <button class="btn-secondary" on:click={sync} disabled={syncing}>
      <RefreshCw class="h-4 w-4 {syncing ? 'animate-spin' : ''}" />
      {syncing ? 'Syncing…' : 'Sync KnowBe4'}
    </button>
  </svelte:fragment>
</PageHeader>

{#if !s}
  <div class="card p-8 text-center text-sm text-slate-500">
    <AlertTriangle class="mx-auto mb-2 h-5 w-5 text-amber-500" />
    No KnowBe4 connection configured for this tenant.
  </div>
{:else}
  <div class="space-y-6">
    <!-- KPI strip -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Kpi label="Org Human Risk Score" value={`${s.orgRiskScore}`} suffix="/ 100"
           delta={s.orgRiskScore - s.orgRiskScore12mAgo} tone="bad" hint="vs 12m ago">
        <Target slot="icon" class="h-4 w-4 text-grc-primary" />
      </Kpi>
      <Kpi label="Phish-prone %" value={`${s.phishPronePct}%`}
           delta={pppDelta()} tone="bad" hint="industry {s.industryPhishPronePct}%">
        <ShieldAlert slot="icon" class="h-4 w-4 text-rose-600" />
      </Kpi>
      <Kpi label="Training Completion" value={`${s.trainingCompletionPct}%`}>
        <BookOpen slot="icon" class="h-4 w-4 text-violet-600" />
      </Kpi>
      <Kpi label="Users at High/Critical" value={(s.usersAtHighRisk + s.usersAtCriticalRisk).toLocaleString()}
           tone="bad" hint="{s.usersAtCriticalRisk.toLocaleString()} critical">
        <UsersIcon slot="icon" class="h-4 w-4 text-orange-600" />
      </Kpi>
      <Kpi label="Quantified ALE" value={fmtMoney(s.quant.aleSgd)} hint="FAIR · feeds register">
        <Calculator slot="icon" class="h-4 w-4 text-grc-primary" />
      </Kpi>
    </div>

    <!-- Quantification banner — the human-risk → register/FAIR bridge -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="card relative overflow-hidden p-5 lg:col-span-2">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="section-title">Human Risk Score &amp; Phish-prone Trend (12 months)</h2>
          <span class="text-xs text-slate-400">{s.headcount.toLocaleString()} staff scored</span>
        </div>
        <LineChart labels={trendLabels} series={trendSeries} height={240} yMin={0} />
        <p class="mt-2 text-[11px] text-slate-500">
          Awareness programme drove the org score from <span class="font-semibold text-slate-700">{s.orgRiskScore12mAgo}</span>
          to <span class="font-semibold text-slate-700">{s.orgRiskScore}</span>, and phish-prone rate from
          <span class="font-semibold text-slate-700">{s.phishPronePct12mAgo}%</span> to
          <span class="font-semibold text-slate-700">{s.phishPronePct}%</span> (industry {s.industryPhishPronePct}%).
        </p>
      </div>

      <div class="space-y-4">
        <div class="rounded-xl border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-white p-4">
          <div class="text-[11px] uppercase tracking-wider text-rose-700">Annualised Loss Expectancy (Human Risk)</div>
          <div class="mt-1 font-mono text-3xl font-bold text-rose-700">{fmtMoney(s.quant.aleSgd)}</div>
          <div class="mt-1 text-[11px] text-rose-700/80">
            ARO {s.quant.aro.toFixed(2)}/yr · S${(s.quant.perIncidentMeanSgd / 1e3).toFixed(0)}K mean impact
          </div>
        </div>
        <div class="rounded-xl border border-violet-200 bg-violet-50 p-4">
          <div class="flex items-center gap-1.5 text-[11px] font-semibold text-violet-700">
            <TrendingDown class="h-3.5 w-3.5" /> Avoided loss from training
          </div>
          <div class="mt-1 font-mono text-2xl font-bold text-violet-700">{fmtMoney(s.quant.aleReducedSgd)}</div>
          <div class="mt-0.5 text-[11px] text-violet-700/80">year-on-year reduction in quantified ALE</div>
        </div>
        <div class="flex flex-col gap-2">
          <a href="/risk/{s.quant.riskId}" class="btn-secondary justify-start text-xs">
            <FileBarChart class="h-4 w-4" /> View register entry
          </a>
          <a href="/heatmap?scenario={s.quant.scenarioId}" class="btn-secondary justify-start text-xs">
            <Calculator class="h-4 w-4" /> Open FAIR scenario
          </a>
          <button class="btn-ghost justify-start text-xs" on:click={pushToRegister}>
            <CheckCircle2 class="h-4 w-4 text-violet-600" /> Linked to ERM &amp; quant reporting
          </button>
        </div>
      </div>
    </div>

    <!-- Department risk breakdown -->
    <div class="card p-5">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="section-title">Risk by Department</h2>
        <span class="text-xs text-slate-400">{data.departments.length} functions</span>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Department</th>
              <th class="px-4 py-2 text-right">Headcount</th>
              <th class="px-4 py-2 text-left">Avg Risk Score</th>
              <th class="px-4 py-2 text-left">Level</th>
              <th class="px-4 py-2 text-right">Phish-prone</th>
              <th class="w-48 px-4 py-2 text-left">Training</th>
              <th class="px-4 py-2 text-right">High-risk users</th>
            </tr>
          </thead>
          <tbody>
            {#each data.departments as d (d.department)}
              <tr class="tr">
                <td class="td font-medium">{d.department}</td>
                <td class="td num text-right text-slate-500">{d.headcount.toLocaleString()}</td>
                <td class="td">
                  <span class="num inline-flex h-6 w-8 items-center justify-center rounded text-[11px] font-semibold {scoreCls(d.avgRiskScore)}">{d.avgRiskScore}</span>
                </td>
                <td class="td">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {levelCls(d.riskLevel)}">{d.riskLevel}</span>
                </td>
                <td class="td num text-right">{d.phishPronePct}%</td>
                <td class="td">
                  <div class="flex items-center gap-2">
                    <ProgressBar value={d.trainingCompletionPct} color={d.trainingCompletionPct >= 90 ? 'bg-violet-500' : d.trainingCompletionPct >= 75 ? 'bg-amber-500' : 'bg-rose-500'} />
                    <span class="num text-[10px] text-slate-500">{d.trainingCompletionPct}%</span>
                  </div>
                </td>
                <td class="td num text-right font-semibold text-slate-700">{d.highRiskUsers.toLocaleString()}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tabbed detail -->
    <div class="card overflow-hidden">
      <div class="flex flex-wrap border-b border-slate-100 px-2">
        <button type="button"
          class="-mb-px flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors {tab === 'users' ? 'border-grc-primary text-grc-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}"
          on:click={() => (tab = 'users')}>
          <UsersIcon class="h-4 w-4" /> Top At-risk Users
          <span class="rounded-full bg-slate-100 px-1.5 text-[10px] font-mono text-slate-600">{data.users.length}</span>
        </button>
        <button type="button"
          class="-mb-px flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors {tab === 'phishing' ? 'border-grc-primary text-grc-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}"
          on:click={() => (tab = 'phishing')}>
          <Mail class="h-4 w-4" /> Phishing Campaigns
          <span class="rounded-full bg-slate-100 px-1.5 text-[10px] font-mono text-slate-600">{data.phishing.length}</span>
        </button>
        <button type="button"
          class="-mb-px flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors {tab === 'training' ? 'border-grc-primary text-grc-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}"
          on:click={() => (tab = 'training')}>
          <BookOpen class="h-4 w-4" /> Training Campaigns
          <span class="rounded-full bg-slate-100 px-1.5 text-[10px] font-mono text-slate-600">{data.training.length}</span>
        </button>
      </div>

      {#if tab === 'users'}
        <div class="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
          <div class="flex items-center gap-1">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Level:</span>
            {#each LEVEL_FILTERS as f}
              <button type="button"
                class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {levelFilter === f.id ? 'bg-grc-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                on:click={() => (levelFilter = f.id)}>{f.label}</button>
            {/each}
          </div>
          <div class="relative ml-auto w-full sm:w-64">
            <Search class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="search" bind:value={search} placeholder="Search users…" class="input pl-8" />
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-sm">
            <thead class="thead">
              <tr>
                <th class="px-4 py-2 text-left">User</th>
                <th class="px-4 py-2 text-left">Department</th>
                <th class="px-4 py-2 text-left">Risk Score</th>
                <th class="px-4 py-2 text-left">Level</th>
                <th class="px-4 py-2 text-left">12m Trend</th>
                <th class="px-4 py-2 text-left">Last Phish</th>
                <th class="px-4 py-2 text-right">Training</th>
                <th class="px-4 py-2 text-center">MFA</th>
                <th class="w-8 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {#each filteredUsers.slice(0, 40) as u (u.id)}
                <tr class="tr">
                  <td class="td">
                    <a href="/human-risk/{u.id}" class="font-medium text-grc-primary hover:underline">{u.name}</a>
                    {#if u.privilegedAccess}<span class="ml-1.5 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 ring-1 ring-amber-200">PRIV</span>{/if}
                    <div class="text-[11px] text-slate-400">{u.email}</div>
                  </td>
                  <td class="td text-xs text-slate-500">{u.department}</td>
                  <td class="td">
                    <span class="num inline-flex h-6 w-8 items-center justify-center rounded text-[11px] font-semibold {scoreCls(u.riskScore)}">{u.riskScore}</span>
                  </td>
                  <td class="td"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {levelCls(u.riskLevel)}">{u.riskLevel}</span></td>
                  <td class="td"><div class="w-24"><Sparkline data={u.riskHistory} stroke={u.riskScore >= 45 ? '#e11d48' : '#6d28d9'} /></div></td>
                  <td class="td"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {phishCls(u.lastPhishResult)}">{u.lastPhishResult}</span></td>
                  <td class="td num text-right text-xs {u.trainingCompletionPct >= 90 ? 'text-violet-600' : u.trainingCompletionPct < 60 ? 'text-rose-600' : 'text-slate-500'}">{u.trainingCompletionPct}%</td>
                  <td class="td text-center">
                    {#if u.mfaEnabled}<CheckCircle2 class="mx-auto h-4 w-4 text-violet-500" />{:else}<AlertTriangle class="mx-auto h-4 w-4 text-rose-500" />{/if}
                  </td>
                  <td class="td"><a href="/human-risk/{u.id}" class="text-slate-400 hover:text-grc-primary"><ChevronRight class="h-4 w-4" /></a></td>
                </tr>
              {:else}
                <tr><td colspan="9" class="px-4 py-8 text-center text-sm text-slate-500">No users match.</td></tr>
              {/each}
            </tbody>
          </table>
        </div>

      {:else if tab === 'phishing'}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-sm">
            <thead class="thead">
              <tr>
                <th class="px-4 py-2 text-left">Campaign</th>
                <th class="px-4 py-2 text-center">Difficulty</th>
                <th class="px-4 py-2 text-left">Sent</th>
                <th class="px-4 py-2 text-right">Recipients</th>
                <th class="px-4 py-2 text-right">Clicked</th>
                <th class="px-4 py-2 text-right">Data Entered</th>
                <th class="px-4 py-2 text-right">Reported</th>
                <th class="px-4 py-2 text-right">Phish-prone</th>
                <th class="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {#each data.phishing as c (c.id)}
                <tr class="tr">
                  <td class="td font-medium">{c.name}</td>
                  <td class="td text-center">
                    <span class="num text-[11px] text-slate-500">{'★'.repeat(c.difficulty)}<span class="text-slate-300">{'★'.repeat(5 - c.difficulty)}</span></span>
                  </td>
                  <td class="td num text-xs text-slate-500">{fmtDate(c.sentAt)}</td>
                  <td class="td num text-right text-slate-500">{c.recipients.toLocaleString()}</td>
                  <td class="td num text-right text-orange-600">{c.clicked.toLocaleString()}</td>
                  <td class="td num text-right text-rose-600">{c.dataEntered.toLocaleString()}</td>
                  <td class="td num text-right text-violet-600">{c.reported.toLocaleString()}</td>
                  <td class="td num text-right font-semibold {c.phishPronePct >= 20 ? 'text-rose-600' : c.phishPronePct >= 10 ? 'text-amber-600' : 'text-violet-600'}">{c.phishPronePct}%</td>
                  <td class="td">
                    <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {c.status === 'in-progress' ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}">{c.status}</span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

      {:else if tab === 'training'}
        <div class="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 lg:grid-cols-3">
          {#each data.training as t (t.id)}
            <div class="rounded-lg bg-white p-4 ring-1 ring-inset ring-slate-200/70">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="truncate font-semibold text-grc-ink">{t.name}</div>
                  <div class="mt-0.5 text-xs text-slate-500">{t.contentType} · {t.frameworkRef ?? '—'}</div>
                </div>
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {t.status === 'completed' ? 'bg-violet-50 text-violet-700 ring-violet-200' : t.status === 'overdue' ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}">{t.status}</span>
              </div>
              <div class="mt-3">
                <div class="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Completion</span><span class="num">{t.completionPct}%</span>
                </div>
                <ProgressBar value={t.completionPct} color={t.completionPct >= 90 ? 'bg-violet-500' : t.completionPct >= 75 ? 'bg-amber-500' : 'bg-rose-500'} />
              </div>
              <div class="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                <div><div class="num font-semibold text-slate-700">{t.enrolled.toLocaleString()}</div><div class="text-slate-400">enrolled</div></div>
                <div><div class="num font-semibold text-slate-700">{t.completed.toLocaleString()}</div><div class="text-slate-400">completed</div></div>
                <div><div class="num font-semibold text-slate-700">{t.passRate}%</div><div class="text-slate-400">pass rate</div></div>
              </div>
              <div class="mt-3 text-[11px] text-slate-400">Due {fmtDate(t.dueAt)}</div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
