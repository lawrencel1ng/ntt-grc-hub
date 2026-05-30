<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import { addToast } from '$lib/stores/toast';
  import {
    ArrowLeft, GraduationCap, ShieldAlert, Target, Mail, BookOpen,
    CheckCircle2, AlertTriangle, KeyRound, ShieldCheck, TrendingUp,
    TrendingDown, Send, ChevronRight
  } from 'lucide-svelte';
  import type { HumanRiskLevel, PhishResult } from '$lib/data/types';

  export let data;
  $: u = data.user;

  function levelCls(l: HumanRiskLevel): string {
    switch (l) {
      case 'critical': return 'bg-rose-100 text-rose-800 ring-rose-200';
      case 'high':     return 'bg-orange-50 text-orange-700 ring-orange-200';
      case 'moderate': return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'low':      return 'bg-violet-50 text-violet-700 ring-violet-200';
    }
  }
  function scoreRingCls(score: number): string {
    if (score >= 65) return 'border-rose-500 text-rose-600';
    if (score >= 45) return 'border-orange-500 text-orange-600';
    if (score >= 25) return 'border-amber-400 text-amber-600';
    return 'border-violet-400 text-violet-600';
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
  function fmtDate(iso?: string): string {
    return iso ? iso.slice(0, 10) : '—';
  }

  $: trendLabels = u.riskHistory.map((_, i) => `M${i - 11 === 0 ? '' : i - 11}`);
  $: trendSeries = [
    { name: 'Risk Score', color: '#6d28d9', data: u.riskHistory, area: true }
  ];

  // Score drivers — explains what the Virtual Risk Officer rolled up.
  $: failRate = u.phishingSent ? Math.round(((u.phishingClicked + u.phishingDataEntered) / u.phishingSent) * 100) : 0;
  $: reportRate = u.phishingSent ? Math.round((u.phishingReported / u.phishingSent) * 100) : 0;

  $: drivers = [
    {
      label: 'Phishing failures',
      detail: `${u.phishingClicked + u.phishingDataEntered} of ${u.phishingSent} simulations failed`,
      impact: failRate >= 25 ? 'high' : failRate >= 10 ? 'moderate' : 'low',
      icon: Mail
    },
    {
      label: 'Training completion',
      detail: `${u.trainingCompleted}/${u.trainingAssigned} assigned modules complete`,
      impact: u.trainingCompletionPct < 60 ? 'high' : u.trainingCompletionPct < 90 ? 'moderate' : 'low',
      icon: BookOpen
    },
    {
      label: 'MFA enrolment',
      detail: u.mfaEnabled ? 'MFA enabled on all critical apps' : 'MFA not enrolled — account-takeover booster',
      impact: u.mfaEnabled ? 'low' : 'high',
      icon: KeyRound
    },
    {
      label: 'Privileged access',
      detail: u.privilegedAccess ? 'Holds privileged/admin entitlements — higher blast radius' : 'Standard user entitlements',
      impact: u.privilegedAccess ? 'high' : 'low',
      icon: ShieldCheck
    }
  ];

  function driverCls(impact: string): string {
    if (impact === 'high') return 'bg-rose-50 text-rose-700 ring-rose-200';
    if (impact === 'moderate') return 'bg-amber-50 text-amber-700 ring-amber-200';
    return 'bg-violet-50 text-violet-700 ring-violet-200';
  }

  async function enroll() {
    const res = await fetch('/api/human-risk/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.id, userEmail: u.email })
    });
    if (res.ok) {
      addToast('success', `${u.name} enrolled in remedial training · audit log updated.`);
    } else {
      const msg = await res.text().catch(() => '');
      addToast('error', msg || 'Failed to enroll user in training.');
    }
  }

  async function simulate() {
    const res = await fetch('/api/human-risk/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.id, userEmail: u.email })
    });
    if (res.ok) {
      addToast('info', `Targeted phishing simulation queued for ${u.name}.`);
    } else {
      const msg = await res.text().catch(() => '');
      addToast('error', msg || 'Failed to queue phishing simulation.');
    }
  }
</script>

<PageHeader title={u.name} subtitle="{u.jobTitle} · {u.email}">
  <svelte:fragment slot="actions">
    <button class="btn-secondary" on:click={simulate}>
      <Send class="h-4 w-4" /> Send simulation
    </button>
    <button class="btn-primary" on:click={enroll}>
      <GraduationCap class="h-4 w-4" /> Enroll in training
    </button>
  </svelte:fragment>
</PageHeader>

<a href="/human-risk" class="mb-4 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-grc-primary">
  <ArrowLeft class="h-3.5 w-3.5" /> Back to Human Risk
</a>

<div class="space-y-6">
  <!-- Hero: score + context -->
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <div class="card flex items-center gap-5 p-6">
      <div class="flex h-24 w-24 flex-shrink-0 flex-col items-center justify-center rounded-full border-4 {scoreRingCls(u.riskScore)}">
        <span class="num text-3xl font-bold leading-none">{u.riskScore}</span>
        <span class="text-[10px] uppercase tracking-wider text-slate-400">/ 100</span>
      </div>
      <div class="min-w-0">
        <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset {levelCls(u.riskLevel)}">{u.riskLevel} risk</span>
        <div class="mt-2 flex items-center gap-1.5 text-sm">
          {#if u.riskScore30dDelta < 0}
            <TrendingDown class="h-4 w-4 text-violet-600" />
            <span class="font-semibold text-violet-700">{u.riskScore30dDelta}</span>
          {:else if u.riskScore30dDelta > 0}
            <TrendingUp class="h-4 w-4 text-rose-600" />
            <span class="font-semibold text-rose-700">+{u.riskScore30dDelta}</span>
          {:else}
            <span class="font-semibold text-slate-500">±0</span>
          {/if}
          <span class="text-slate-400">over 30 days</span>
        </div>
        {#if u.privilegedAccess}
          <div class="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200">
            <ShieldAlert class="h-3 w-3" /> Privileged access
          </div>
        {/if}
      </div>
    </div>

    <div class="card p-6">
      <div class="text-[11px] uppercase tracking-wider text-slate-400">Department</div>
      <div class="mt-1 font-semibold text-grc-ink">{u.department}</div>
      <div class="mt-4 grid grid-cols-2 gap-4">
        <div>
          <div class="num text-2xl font-bold {u.riskScore > data.deptAvg ? 'text-rose-600' : 'text-violet-600'}">{u.riskScore}</div>
          <div class="text-[11px] text-slate-400">this user</div>
        </div>
        <div>
          <div class="num text-2xl font-bold text-slate-500">{data.deptAvg}</div>
          <div class="text-[11px] text-slate-400">dept avg</div>
        </div>
      </div>
      <p class="mt-3 text-[11px] text-slate-500">
        {u.riskScore > data.deptAvg
          ? `Scores ${u.riskScore - data.deptAvg} points above the ${u.department} average.`
          : `At or below the ${u.department} average — good standing.`}
      </p>
    </div>

    <div class="card p-6">
      <div class="text-[11px] uppercase tracking-wider text-slate-400">Triage rank</div>
      <div class="mt-1 flex items-baseline gap-1">
        <span class="num text-3xl font-bold text-grc-ink">#{data.rank}</span>
        <span class="text-sm text-slate-400">of {data.sampleSize} scored</span>
      </div>
      <a href="/risk/{data.summary?.quant.riskId}" class="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100">
        <span class="inline-flex items-center gap-1.5"><Target class="h-3.5 w-3.5 text-grc-primary" /> Contributes to ERM human-risk entry</span>
        <ChevronRight class="h-3.5 w-3.5" />
      </a>
    </div>
  </div>

  <!-- Trend + drivers -->
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <div class="card p-5 lg:col-span-2">
      <h2 class="section-title mb-3">Risk Score Trend (12 months)</h2>
      <LineChart labels={trendLabels} series={trendSeries} height={220} yMin={0} yMax={100} />
    </div>

    <div class="card p-5">
      <h2 class="section-title mb-3">Score Drivers</h2>
      <div class="space-y-3">
        {#each drivers as d}
          <div class="flex items-start gap-3">
            <span class="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <svelte:component this={d.icon} class="h-4 w-4" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium text-slate-700">{d.label}</span>
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ring-1 ring-inset {driverCls(d.impact)}">{d.impact}</span>
              </div>
              <div class="text-[11px] text-slate-500">{d.detail}</div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Phishing + training detail -->
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <div class="card p-5">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="section-title">Phishing Simulation History</h2>
        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset {phishCls(u.lastPhishResult)}">
          last: {u.lastPhishResult}
        </span>
      </div>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div class="rounded-lg bg-slate-50 p-3 text-center">
          <div class="num text-2xl font-bold text-slate-700">{u.phishingSent}</div>
          <div class="text-[11px] text-slate-400">sent</div>
        </div>
        <div class="rounded-lg bg-orange-50 p-3 text-center">
          <div class="num text-2xl font-bold text-orange-600">{u.phishingClicked}</div>
          <div class="text-[11px] text-orange-700/70">clicked</div>
        </div>
        <div class="rounded-lg bg-rose-50 p-3 text-center">
          <div class="num text-2xl font-bold text-rose-600">{u.phishingDataEntered}</div>
          <div class="text-[11px] text-rose-700/70">data entered</div>
        </div>
        <div class="rounded-lg bg-violet-50 p-3 text-center">
          <div class="num text-2xl font-bold text-violet-600">{u.phishingReported}</div>
          <div class="text-[11px] text-violet-700/70">reported</div>
        </div>
      </div>
      <div class="mt-4 space-y-3">
        <div>
          <div class="mb-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>Fail rate</span><span class="num">{failRate}%</span>
          </div>
          <ProgressBar value={failRate} color={failRate >= 25 ? 'bg-rose-500' : failRate >= 10 ? 'bg-amber-500' : 'bg-violet-500'} />
        </div>
        <div>
          <div class="mb-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>Report rate</span><span class="num">{reportRate}%</span>
          </div>
          <ProgressBar value={reportRate} color="bg-violet-500" />
        </div>
      </div>
      <div class="mt-3 text-[11px] text-slate-400">Last simulation {fmtDate(u.lastPhishAt)}</div>
    </div>

    <div class="card p-5">
      <h2 class="section-title mb-3">Training &amp; Controls</h2>
      <div class="mb-4">
        <div class="mb-1 flex items-center justify-between text-sm">
          <span class="text-slate-600">Module completion</span>
          <span class="num font-semibold {u.trainingCompletionPct >= 90 ? 'text-violet-600' : u.trainingCompletionPct < 60 ? 'text-rose-600' : 'text-amber-600'}">{u.trainingCompletionPct}%</span>
        </div>
        <ProgressBar value={u.trainingCompletionPct} color={u.trainingCompletionPct >= 90 ? 'bg-violet-500' : u.trainingCompletionPct >= 60 ? 'bg-amber-500' : 'bg-rose-500'} />
        <div class="mt-1 text-[11px] text-slate-400">{u.trainingCompleted} of {u.trainingAssigned} assigned modules · last activity {fmtDate(u.lastTrainingAt)}</div>
      </div>
      <div class="space-y-2">
        <div class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span class="inline-flex items-center gap-2 text-slate-600"><KeyRound class="h-4 w-4 text-slate-400" /> Multi-factor authentication</span>
          {#if u.mfaEnabled}
            <span class="inline-flex items-center gap-1 text-xs font-semibold text-violet-600"><CheckCircle2 class="h-4 w-4" /> Enabled</span>
          {:else}
            <span class="inline-flex items-center gap-1 text-xs font-semibold text-rose-600"><AlertTriangle class="h-4 w-4" /> Not enrolled</span>
          {/if}
        </div>
        <div class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span class="inline-flex items-center gap-2 text-slate-600"><ShieldCheck class="h-4 w-4 text-slate-400" /> Privileged access</span>
          {#if u.privilegedAccess}
            <span class="inline-flex items-center gap-1 text-xs font-semibold text-amber-600"><ShieldAlert class="h-4 w-4" /> Yes — elevated</span>
          {:else}
            <span class="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">Standard</span>
          {/if}
        </div>
      </div>
      <div class="mt-4 flex gap-2">
        <button class="btn-primary flex-1 justify-center text-xs" on:click={enroll}>
          <GraduationCap class="h-4 w-4" /> Enroll remedial path
        </button>
        <button class="btn-secondary flex-1 justify-center text-xs" on:click={simulate}>
          <Send class="h-4 w-4" /> Re-test
        </button>
      </div>
    </div>
  </div>
</div>
