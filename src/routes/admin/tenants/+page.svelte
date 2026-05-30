<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import StatusDot from '$lib/components/StatusDot.svelte';
  import { addToast } from '$lib/stores/toast';
  import { formatIsoSgt } from '$lib/utils/dates';
  import {
    Building2, Plus, ChevronDown, ChevronRight, ShieldAlert, Users, Plug, Calendar
  } from 'lucide-svelte';

  export let data;
  export let form;

  $: if (form?.tenantCreated) { addToast('success', `Tenant "${form.createdName}" onboarded.`); showOnboardForm = false; }
  $: if (form?.tenantError) addToast('error', form.tenantError);

  let showOnboardForm = false;

  // ---------- KPIs ----------
  $: total = data.rows.length;
  $: active = data.rows.filter((r) => true).length;
  $: totalMrr = data.rows.reduce((s, r) => s + r.tenant.mrrSgd, 0);
  $: sovereign = data.rows.filter((r) => r.tenant.classified || r.tenant.slaTier === 'sovereign').length;

  // ---------- Expand row state ----------
  let openId: string | null = null;
  function toggle(id: string) { openId = openId === id ? null : id; }

  // ---------- Helpers ----------
  function tierCls(tier: string): string {
    if (tier === 'sovereign') return 'bg-violet-50 text-violet-700 ring-violet-200';
    if (tier === 'platinum')  return 'bg-amber-50 text-amber-700 ring-amber-200';
    if (tier === 'gold')      return 'bg-yellow-50 text-yellow-700 ring-yellow-200';
    return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
  function regionCls(region: string): string {
    if (region === 'SG') return 'bg-violet-50 text-violet-700 ring-violet-200';
    if (region === 'APAC') return 'bg-blue-50 text-blue-700 ring-blue-200';
    return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
  function dataResidency(tenantId: string): string {
    // Hard-coded for the demo; aligns with /admin/settings dropdown.
    if (tenantId === 't_mindef') return 'SG (sovereign · NTT Tsuzumi)';
    return 'SG';
  }

</script>

<PageHeader title="Tenants" subtitle="Platform-level tenant operations · {total} on-platform">
  <svelte:fragment slot="actions">
    <button class="btn-primary" on:click={() => (showOnboardForm = !showOnboardForm)}>
      <Plus class="h-4 w-4" />
      <span>Onboard Tenant</span>
    </button>
  </svelte:fragment>
</PageHeader>

{#if showOnboardForm}
  <div class="card p-5">
    <h3 class="mb-3 text-sm font-semibold text-grc-ink">Onboard new tenant</h3>
    <form method="POST" action="?/createTenant" class="flex flex-wrap items-end gap-3">
      <label class="block flex-1 min-w-[160px]">
        <span class="mb-1 block text-xs font-medium text-slate-700">Organisation name</span>
        <input name="name" type="text" class="input" placeholder="Acme Bank Pte Ltd" required />
      </label>
      <label class="block flex-1 min-w-[140px]">
        <span class="mb-1 block text-xs font-medium text-slate-700">Industry</span>
        <input name="industry" type="text" class="input" placeholder="Banking" required />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-700">Region</span>
        <select name="region" class="input">
          <option value="SG">SG</option>
          <option value="APAC">APAC</option>
          <option value="MY">MY</option>
          <option value="AU">AU</option>
          <option value="HK">HK</option>
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-700">SLA Tier</span>
        <select name="slaTier" class="input">
          <option value="standard">Standard</option>
          <option value="gold">Gold</option>
          <option value="platinum">Platinum</option>
          <option value="sovereign">Sovereign</option>
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-700">Primary Framework</span>
        <select name="primaryFramework" class="input">
          <option value="">None</option>
          <option value="MAS TRM">MAS TRM</option>
          <option value="ISO 27001">ISO 27001</option>
          <option value="PCI DSS 4.0">PCI DSS 4.0</option>
          <option value="NIST CSF 2.0">NIST CSF 2.0</option>
          <option value="IM8">IM8</option>
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-700">MRR (S$)</span>
        <input name="mrrSgd" type="number" class="input w-32" placeholder="0" min="0" step="100" />
      </label>
      <div class="flex gap-2">
        <button type="submit" class="btn-primary">Create</button>
        <button type="button" class="btn-secondary" on:click={() => (showOnboardForm = false)}>Cancel</button>
      </div>
    </form>
  </div>
{/if}

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
    <Kpi label="Total Tenants" value={total.toString()} hint="across APAC">
      <Building2 slot="icon" class="h-4 w-4 text-grc-primary" />
    </Kpi>
    <Kpi label="Active" value={active.toString()} hint="paying">
      <StatusDot slot="icon" status="connected" withLabel={false} />
    </Kpi>
    <Kpi label="Total MRR (S$)" value={(totalMrr / 1000).toFixed(0)} suffix="K">
      <Calendar slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Sovereign-only" value={sovereign.toString()} hint="classified / sovereign tier">
      <ShieldAlert slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
  </div>

  <!-- Tenants table -->
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="w-8 px-2 py-2"></th>
            <th class="px-4 py-2 text-left">Tenant</th>
            <th class="px-4 py-2 text-left">ID</th>
            <th class="px-4 py-2 text-left">Industry</th>
            <th class="px-4 py-2 text-left">Region</th>
            <th class="px-4 py-2 text-left">Primary Framework</th>
            <th class="px-4 py-2 text-left">SLA Tier</th>
            <th class="px-4 py-2 text-right">MRR (S$)</th>
            <th class="px-4 py-2 text-left">Classified</th>
            <th class="px-4 py-2 text-left">Status</th>
            <th class="w-8 px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each data.rows as row}
            {@const t = row.tenant}
            {@const open = openId === t.id}
            <tr class="tr cursor-pointer" on:click={() => toggle(t.id)}>
              <td class="px-2 py-3 text-slate-400">
                {#if open}<ChevronDown class="h-4 w-4" />{:else}<ChevronRight class="h-4 w-4" />{/if}
              </td>
              <td class="td font-medium text-grc-ink">{t.name}</td>
              <td class="td font-mono text-[11px] text-slate-500">{t.id}</td>
              <td class="td text-slate-600">{t.industry}</td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset {regionCls(t.region)}">
                  {t.region}
                </span>
              </td>
              <td class="td">
                <span class="tag tag-emerald">{t.primaryFramework.toUpperCase()}</span>
              </td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset {tierCls(t.slaTier)}">
                  {t.slaTier}
                </span>
              </td>
              <td class="td text-right font-mono text-violet-700">{(t.mrrSgd / 1000).toFixed(0)}K</td>
              <td class="td">
                {#if t.classified}
                  <span class="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                    <ShieldAlert class="h-3 w-3" /> classified
                  </span>
                {:else}
                  <span class="text-xs text-slate-400">—</span>
                {/if}
              </td>
              <td class="td">
                <StatusDot status="connected" withLabel={true} />
              </td>
              <td class="px-2 py-3 text-right text-slate-400">
                <ChevronRight class="h-4 w-4" />
              </td>
            </tr>
            {#if open}
              <tr class="bg-slate-50/60">
                <td colspan="11" class="px-6 py-4">
                  <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <div class="rounded-lg bg-white p-3 ring-1 ring-inset ring-slate-200">
                      <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Onboarded</div>
                      <div class="mt-1 text-sm font-medium text-slate-800">{formatIsoSgt(t.createdAt).slice(0, 10)}</div>
                    </div>
                    <div class="rounded-lg bg-white p-3 ring-1 ring-inset ring-slate-200">
                      <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Plug class="h-3 w-3" /> Connectors
                      </div>
                      <div class="mt-1 text-sm font-medium text-slate-800">
                        {row.connectorCount}
                        <span class="text-xs text-violet-700">· {row.connectedCount} connected</span>
                      </div>
                    </div>
                    <div class="rounded-lg bg-white p-3 ring-1 ring-inset ring-slate-200">
                      <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Users class="h-3 w-3" /> Users
                      </div>
                      <div class="mt-1 text-sm font-medium text-slate-800">{row.userCount}</div>
                    </div>
                    <div class="rounded-lg bg-white p-3 ring-1 ring-inset ring-slate-200">
                      <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Data Residency</div>
                      <div class="mt-1 text-sm font-medium text-slate-800">{dataResidency(t.id)}</div>
                    </div>
                  </div>
                  <div class="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <span class="font-semibold uppercase tracking-wider text-slate-400">HQ:</span>
                    <span>{t.headquarteredIn}</span>
                    <span class="text-slate-300">·</span>
                    <span class="font-mono text-[11px]">{t.id}</span>
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
