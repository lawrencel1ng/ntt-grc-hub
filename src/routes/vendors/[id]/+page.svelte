<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import Gauge from '$lib/components/Gauge.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import EvidenceChip from '$lib/components/EvidenceChip.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import { addToast } from '$lib/stores/toast';
  import {
    Send, BookOpen, FileText, FileQuestion,
    GitFork, AlertTriangle, ShieldCheck, Mail, Tag as TagIcon, Layers, DollarSign, Pencil, Plus
  } from 'lucide-svelte';
  import type { Vendor, VendorContract, VendorTier, VendorCriticality, VendorStatus, Questionnaire } from '$lib/data/types';
  import { enhance } from '$app/forms';

  export let data;
  export let form: {
    statusUpdated?: boolean; newStatus?: string; statusError?: string;
    editSuccess?: boolean; editError?: string;
    contractAdded?: boolean; contractError?: string;
    fpAdded?: boolean; fpError?: string;
  } | null = null;

  $: if (form?.statusUpdated && form.newStatus) {
    data = { ...data, vendor: { ...data.vendor, status: form.newStatus as VendorStatus } };
    addToast('success', `Vendor status updated to "${form.newStatus}".`);
  }
  $: if (form?.statusError) addToast('error', form.statusError);
  $: if (form?.editSuccess) { addToast('success', 'Vendor updated.'); showEditForm = false; }
  $: if (form?.editError) addToast('error', form.editError);
  $: if (form?.contractAdded) { addToast('success', 'Contract added.'); showContractForm = false; }
  $: if (form?.contractError) addToast('error', form.contractError);
  $: if (form?.fpAdded) { addToast('success', '4th party added.'); showFourthPartyForm = false; }
  $: if (form?.fpError) addToast('error', form.fpError);

  let showEditForm = false;
  let showContractForm = false;
  let showFourthPartyForm = false;

  // ---------- Computed ----------
  function residualScore(v: Vendor): number {
    const q = v.lastQuestionnaireScore ?? 70;
    const tierWeight = { '1': 1.0, '2': 0.85, '3': 0.7, '4': 0.55 }[v.tier];
    return Math.round((100 - q) * tierWeight + 25);
  }
  $: residual = residualScore(data.vendor);

  // Real questionnaire score history, oldest-first, at most 12 entries.
  $: scoredQuestionnaires = data.questionnaires
    .filter((q) => q.score !== undefined)
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt))
    .slice(-12);
  $: trend = scoredQuestionnaires.length > 1
    ? scoredQuestionnaires.map((q) => q.score as number)
    : [data.vendor.lastQuestionnaireScore ?? 70];
  $: MONTHS = scoredQuestionnaires.length > 1
    ? scoredQuestionnaires.map((q) => q.sentAt.slice(0, 7))
    : ['Latest'];

  $: facts = {
    industry: data.vendor.category === 'cloud' ? 'Hyperscale Cloud' :
              data.vendor.category === 'saas' ? 'SaaS / Platform' :
              data.vendor.category === 'consulting' ? 'Professional Services' :
              data.vendor.category === 'security' ? 'Cyber Security' : 'Technology',
    region: data.vendor.hqCountry === 'SG' ? 'APAC' : data.vendor.hqCountry === 'US' ? 'Americas' : 'EMEA',
    employees: data.vendor.employeeCount ?? null
  };
  $: contractValue = contracts.reduce((s, c) => s + (c.valueSgd ?? 0), 0);

  $: contracts = data.contracts as VendorContract[];

  // ---------- Tabs ----------
  type Tab = 'overview' | 'contracts' | 'questionnaires' | 'fourth' | 'risks' | 'evidence';
  let tab: Tab = 'overview';
  const TABS: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: 'overview',       label: 'Overview',         icon: BookOpen },
    { id: 'contracts',      label: 'Contracts',        icon: FileText },
    { id: 'questionnaires', label: 'Questionnaires',   icon: FileQuestion },
    { id: 'fourth',         label: '4th Parties',      icon: GitFork },
    { id: 'risks',          label: 'Risk Findings',    icon: AlertTriangle },
    { id: 'evidence',       label: 'Evidence',         icon: ShieldCheck }
  ];

  // ---------- Helpers ----------
  function tierCls(t: VendorTier): string {
    switch (t) {
      case '1': return 'bg-rose-100 text-rose-800 ring-rose-200';
      case '2': return 'bg-orange-50 text-orange-700 ring-orange-200';
      case '3': return 'bg-amber-50 text-amber-700 ring-amber-200';
      case '4': return 'bg-slate-100 text-slate-600 ring-slate-200';
    }
  }
  function critCls(c: VendorCriticality): string {
    switch (c) {
      case 'critical': return 'bg-rose-100 text-rose-800 ring-rose-200';
      case 'high':     return 'bg-orange-50 text-orange-700 ring-orange-200';
      case 'medium':   return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'low':      return 'bg-violet-50 text-violet-700 ring-violet-200';
    }
  }
  function statusCls(s: VendorStatus): string {
    switch (s) {
      case 'active':     return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'onboarding': return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'offboarded': return 'bg-slate-100 text-slate-500 ring-slate-200';
    }
  }
  function qStatusCls(s: string): string {
    switch (s) {
      case 'complete':    return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'in-progress': return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'sent':        return 'bg-amber-50 text-amber-700 ring-amber-200';
      default:            return 'bg-slate-100 text-slate-600 ring-slate-200';
    }
  }
  function templateCls(t: 'SIG' | 'CAIQ' | 'Custom'): string {
    switch (t) {
      case 'SIG':    return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'CAIQ':   return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'Custom': return 'bg-slate-100 text-slate-600 ring-slate-200';
    }
  }
  function sevCls(s: string): string {
    if (s === 'critical') return 'bg-rose-100 text-rose-800 ring-rose-200';
    if (s === 'high')     return 'bg-orange-50 text-orange-700 ring-orange-200';
    if (s === 'medium')   return 'bg-amber-50 text-amber-700 ring-amber-200';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
  function fpTypeCls(t: 'cloud' | 'saas' | 'processor'): string {
    switch (t) {
      case 'cloud':     return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'saas':      return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'processor': return 'bg-amber-50 text-amber-700 ring-amber-200';
    }
  }

  function fmtMoney(n: number): string {
    if (n >= 1e6) return `S$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `S$${(n / 1e3).toFixed(0)}K`;
    return `S$${n}`;
  }
  function fmtDate(iso?: string): string {
    return iso ? iso.slice(0, 10) : '—';
  }
  function daysUntil(iso: string): number {
    return Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  }
  function renewalCls(days: number): string {
    if (days < 0) return 'bg-rose-100 text-rose-800 ring-rose-200';
    if (days < 30) return 'bg-rose-50 text-rose-700 ring-rose-200';
    if (days < 90) return 'bg-amber-50 text-amber-700 ring-amber-200';
    return 'bg-violet-50 text-violet-700 ring-violet-200';
  }
  function renewalLabel(days: number): string {
    if (days < 0) return `expired ${-days}d ago`;
    return `renews in ${days}d`;
  }

  async function sendQuestionnaire() {
    try {
      const res = await fetch(`/api/vendors/${data.vendor.id}/questionnaire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: 'SIG' })
      });
      if (res.ok) {
        addToast('success', `SIG questionnaire queued for ${data.vendor.name}.`);
      } else {
        const msg = await res.text().catch(() => '');
        addToast('error', msg || 'Failed to send questionnaire.');
      }
    } catch {
      addToast('error', 'Network error — check your connection and try again.');
    }
  }
</script>

<PageHeader
  title={data.vendor.name}
  breadcrumbs={[{ label: 'Vendors', href: '/vendors' }, { label: data.vendor.name }]}
>
  <svelte:fragment slot="actions">
    <span class="tag tag-slate">{data.vendor.category}</span>
    <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset {tierCls(data.vendor.tier)}">Tier {data.vendor.tier}</span>
    <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset {critCls(data.vendor.criticality)}">{data.vendor.criticality}</span>
    <form method="POST" action="?/updateStatus" use:enhance class="flex items-center gap-1">
      <select name="status" class="input py-1 text-xs" value={data.vendor.status}>
        <option value="active">active</option>
        <option value="onboarding">onboarding</option>
        <option value="offboarded">offboarded</option>
      </select>
      <button type="submit" class="btn-secondary py-1 text-xs">Update</button>
    </form>
    <button class="btn-secondary" on:click={() => (showEditForm = !showEditForm)}>
      <Pencil class="h-4 w-4" />
      <span>Edit</span>
    </button>
    <button class="btn-primary" on:click={sendQuestionnaire}>
      <Send class="h-4 w-4" />
      <span>Send Questionnaire</span>
    </button>
  </svelte:fragment>
</PageHeader>

{#if showEditForm}
  <div class="card p-5">
    <h3 class="mb-4 text-sm font-semibold text-grc-ink">Edit Vendor</h3>
    <form method="POST" action="?/updateVendor" use:enhance class="space-y-4">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Name</span>
          <input name="name" class="input" value={data.vendor.name} required maxlength="256" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Category</span>
          <input name="category" class="input" value={data.vendor.category} maxlength="128" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Tier</span>
          <select name="tier" class="input" value={data.vendor.tier}>
            <option value="1">Tier 1</option>
            <option value="2">Tier 2</option>
            <option value="3">Tier 3</option>
            <option value="4">Tier 4</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Criticality</span>
          <select name="criticality" class="input" value={data.vendor.criticality}>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">HQ Country</span>
          <input name="hqCountry" class="input" value={data.vendor.hqCountry} maxlength="128" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Primary Contact Email</span>
          <input name="primaryContactEmail" type="email" class="input" value={data.vendor.primaryContactEmail} maxlength="254" />
        </label>
      </div>
      <div class="flex gap-2">
        <button type="submit" class="btn-primary">Save changes</button>
        <button type="button" class="btn-secondary" on:click={() => (showEditForm = false)}>Cancel</button>
      </div>
    </form>
  </div>
{/if}

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Kpi label="Residual Risk Score" value={residual.toString()} suffix="/ 100" hint="lower is better" tone={residual > 60 ? 'bad' : 'default'}>
      <AlertTriangle slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
    <Kpi label="Tier" value={`Tier ${data.vendor.tier}`}>
      <Layers slot="icon" class="h-4 w-4 text-grc-primary" />
    </Kpi>
    <Kpi label="4th-Parties" value={data.fourthParties.length.toString()}>
      <GitFork slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Contract Value" value={fmtMoney(contractValue)}>
      <DollarSign slot="icon" class="h-4 w-4 text-violet-600" />
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
        </button>
      {/each}
    </div>

    <!-- Overview -->
    {#if tab === 'overview'}
      <div class="grid grid-cols-1 gap-6 p-5 text-sm lg:grid-cols-3">
        <div class="space-y-4 lg:col-span-2">
          <div>
            <div class="section-title text-xs">Description</div>
            <p class="mt-1 text-slate-700">
              {data.vendor.name} is a Tier {data.vendor.tier} {facts.industry.toLowerCase()} provider supporting our
              {data.vendor.category} workloads. Headquartered in {data.vendor.hqCountry}, the vendor is classified
              <span class="font-semibold">{data.vendor.criticality}</span> for business impact and is currently
              <span class="font-semibold">{data.vendor.status}</span>.
            </p>
          </div>
          <div>
            <div class="section-title text-xs">Risk score history (12 months)</div>
            <div class="mt-2 rounded-lg border border-slate-100 bg-slate-50/40 p-3">
              <LineChart
                labels={MONTHS}
                series={[{ name: 'Questionnaire Score', color: '#7c3aed', data: trend, area: true }]}
                yMin={0}
                yMax={100}
                unit=""
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="section-title text-xs">HQ Country</div>
              <div class="mt-1 font-medium text-slate-800">{data.vendor.hqCountry}</div>
            </div>
            <div>
              <div class="section-title text-xs">Primary Contact</div>
              <div class="mt-1 flex items-center gap-1.5 text-slate-700">
                <Mail class="h-3.5 w-3.5 text-slate-400" />
                <a class="text-grc-primary hover:underline" href="mailto:{data.vendor.primaryContactEmail}">{data.vendor.primaryContactEmail}</a>
              </div>
            </div>
          </div>
        </div>
        <div class="space-y-4">
          <div class="card p-4">
            <div class="section-title text-xs">Key facts</div>
            <dl class="mt-2 space-y-2 text-sm">
              <div class="flex justify-between"><dt class="text-slate-500">Industry</dt><dd class="font-medium">{facts.industry}</dd></div>
              <div class="flex justify-between"><dt class="text-slate-500">Region</dt><dd class="font-medium">{facts.region}</dd></div>
              <div class="flex justify-between"><dt class="text-slate-500">Employees</dt><dd class="font-mono">{facts.employees !== null ? facts.employees.toLocaleString() : '—'}</dd></div>
            </dl>
          </div>
          <div>
            <div class="section-title text-xs">Tier</div>
            <div class="mt-2">
              <span class="tag tag-slate">Tier {data.vendor.tier}</span>
            </div>
          </div>
        </div>
      </div>

    <!-- Contracts -->
    {:else if tab === 'contracts'}
      <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <span class="text-xs text-slate-500">{contracts.length} contract{contracts.length !== 1 ? 's' : ''}</span>
        <button class="btn-ghost text-xs" on:click={() => (showContractForm = !showContractForm)}>
          <Plus class="h-3.5 w-3.5" />
          Add contract
        </button>
      </div>
      {#if showContractForm}
        <div class="border-b border-slate-100 bg-slate-50 px-5 py-4">
          <form method="POST" action="?/addContract" use:enhance class="space-y-3">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-700">Contract No.</span>
                <input name="contractNo" type="text" class="input" placeholder="CTR-2026-001" required maxlength="128" />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-700">Value (S$)</span>
                <input name="valueSgd" type="number" min="0" step="1000" class="input" placeholder="0" />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-700">Start date</span>
                <input name="startsAt" type="date" class="input" required />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-700">End date (optional)</span>
                <input name="endsAt" type="date" class="input" />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-700">Renewal window (days)</span>
                <input name="renewalWindowDays" type="number" min="0" max="365" class="input" value="90" />
              </label>
            </div>
            <div class="flex gap-2">
              <button type="submit" class="btn-primary">Add contract</button>
              <button type="button" class="btn-secondary" on:click={() => (showContractForm = false)}>Cancel</button>
            </div>
          </form>
        </div>
      {/if}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Contract No.</th>
              <th class="px-4 py-2 text-right">Value</th>
              <th class="px-4 py-2 text-left">Starts</th>
              <th class="px-4 py-2 text-left">Ends</th>
              <th class="px-4 py-2 text-left">Renewal Window</th>
            </tr>
          </thead>
          <tbody>
            {#each contracts as c (c.id)}
              {@const d = c.endsAt ? daysUntil(c.endsAt) : null}
              <tr class="tr">
                <td class="td font-mono text-xs">{c.contractNo}</td>
                <td class="td text-right font-mono">{fmtMoney(c.valueSgd)}</td>
                <td class="td font-mono text-xs">{fmtDate(c.startsAt)}</td>
                <td class="td font-mono text-xs">{fmtDate(c.endsAt)}</td>
                <td class="td">
                  {#if d !== null}
                    <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {renewalCls(d)}">{renewalLabel(d)}</span>
                  {:else}
                    <span class="text-slate-400 text-xs">open-ended</span>
                  {/if}
                </td>
              </tr>
            {:else}
              <tr><td colspan="5" class="px-4 py-6 text-center text-sm text-slate-500">No contracts on record.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
      </div>

    <!-- Questionnaires -->
    {:else if tab === 'questionnaires'}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Template</th>
              <th class="px-4 py-2 text-left">Status</th>
              <th class="px-4 py-2 text-left">Sent</th>
              <th class="px-4 py-2 text-left">Completed</th>
              <th class="px-4 py-2 text-left">Score</th>
              <th class="px-4 py-2 text-left">Completed By</th>
              <th class="w-8 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {#each data.questionnaires as q (q.id)}
              <tr class="tr">
                <td class="td">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {templateCls(q.template)}">{q.template}</span>
                </td>
                <td class="td">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {qStatusCls(q.status)}">{q.status}</span>
                </td>
                <td class="td font-mono text-xs text-slate-500">{fmtDate(q.sentAt)}</td>
                <td class="td font-mono text-xs text-slate-500">{fmtDate(q.completedAt)}</td>
                <td class="td">
                  {#if q.score !== undefined}
                    <div class="w-24"><Gauge value={q.score} width={120} height={70} /></div>
                  {:else}
                    <span class="text-slate-400">—</span>
                  {/if}
                </td>
                <td class="td">
                  {#if q.completedByAgentId}
                    <div class="flex items-center gap-1.5">
                      <AgentTypeBadge type="intelligent" />
                      <span class="text-xs text-slate-500">Vendor Risk Analyst</span>
                    </div>
                  {:else if q.status === 'complete'}
                    <span class="text-xs text-slate-600">Risk Analyst (human)</span>
                  {:else}
                    <span class="text-xs text-slate-400">—</span>
                  {/if}
                </td>
                <td class="td">
                  <a href="/questionnaires/{q.id}" class="text-slate-400 hover:text-grc-primary">→</a>
                </td>
              </tr>
            {:else}
              <tr><td colspan="7" class="px-4 py-8 text-center text-sm text-slate-500">No questionnaires sent yet.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- 4th Parties -->
    {:else if tab === 'fourth'}
      <div class="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <span class="text-sm text-slate-500">{data.fourthParties.length} sub-processor{data.fourthParties.length !== 1 ? 's' : ''}</span>
        <button class="btn-secondary text-xs py-1 px-3 flex items-center gap-1" on:click={() => (showFourthPartyForm = !showFourthPartyForm)}>
          <Plus class="h-3.5 w-3.5" /> Add 4th party
        </button>
      </div>

      {#if showFourthPartyForm}
        <form method="POST" action="?/addFourthParty" use:enhance class="border-b border-slate-100 bg-slate-50 p-5 space-y-3">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label class="block text-[11px] text-slate-500 mb-0.5" for="fp-name">Name</label>
              <input id="fp-name" name="name" type="text" class="input" placeholder="AWS S3 / Stripe" required maxlength="256" />
            </div>
            <div>
              <label class="block text-[11px] text-slate-500 mb-0.5" for="fp-type">Type</label>
              <select id="fp-type" name="type" class="input">
                <option value="cloud">Cloud</option>
                <option value="saas">SaaS</option>
                <option value="processor">Processor</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] text-slate-500 mb-0.5" for="fp-region">Region</label>
              <input id="fp-region" name="region" type="text" class="input" placeholder="us-east-1" maxlength="128" />
            </div>
            <div>
              <label class="block text-[11px] text-slate-500 mb-0.5" for="fp-criticality">Criticality</label>
              <select id="fp-criticality" name="criticality" class="input">
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div class="flex gap-2">
            <button type="submit" class="btn-primary text-xs py-1 px-3">Add</button>
            <button type="button" class="btn-secondary text-xs py-1 px-3" on:click={() => (showFourthPartyForm = false)}>Cancel</button>
          </div>
        </form>
      {/if}

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">4th-Party Name</th>
              <th class="px-4 py-2 text-left">Type</th>
              <th class="px-4 py-2 text-left">Region</th>
              <th class="px-4 py-2 text-left">Criticality</th>
            </tr>
          </thead>
          <tbody>
            {#each data.fourthParties as fp (fp.id)}
              <tr class="tr">
                <td class="td font-medium">{fp.name}</td>
                <td class="td">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {fpTypeCls(fp.type)}">{fp.type}</span>
                </td>
                <td class="td font-mono text-xs">{fp.region}</td>
                <td class="td">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {critCls(fp.criticality)}">{fp.criticality}</span>
                </td>
              </tr>
            {:else}
              <tr><td colspan="4" class="px-4 py-8 text-center text-sm text-slate-500">No 4th parties declared.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- Risk Findings -->
    {:else if tab === 'risks'}
      <div class="divide-y divide-slate-100">
        {#each data.riskFindings as f (f.id)}
          <div class="flex items-start justify-between px-5 py-4">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {sevCls(f.severity)}">{f.severity}</span>
                <a href="/issues/{f.id}" class="font-semibold text-grc-ink hover:underline">{f.title}</a>
              </div>
              <div class="mt-1 text-xs text-slate-500">Source: {f.source} · Due {fmtDate(f.dueAt)}</div>
            </div>
            <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset bg-rose-50 text-rose-700 ring-rose-200">{f.status}</span>
          </div>
        {:else}
          <div class="px-5 py-8 text-center text-sm text-slate-500">No risk findings raised against this vendor.</div>
        {/each}
      </div>

    <!-- Evidence -->
    {:else if tab === 'evidence'}
      <div class="space-y-4 p-5">
        <div class="text-xs text-slate-500">Vendor-specific evidence: SOC 2 reports, ISO certifications, third-party attestations.</div>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {#each data.vendorEvidence as e (e.id)}
            <div class="rounded-lg bg-white ring-1 ring-inset ring-slate-200/70 p-3 text-xs">
              <div class="truncate font-medium text-slate-800">{e.title}</div>
              <div class="mt-1 flex items-center justify-between gap-2">
                <span class="text-slate-500">{e.kind}</span>
                <EvidenceChip hash={e.rowHash ?? ''} />
              </div>
            </div>
          {:else}
            <div class="col-span-full py-8 text-center text-sm text-slate-500">No vendor evidence on file.</div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>
