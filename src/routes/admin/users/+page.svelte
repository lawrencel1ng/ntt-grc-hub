<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import { addToast } from '$lib/stores/toast';
  import { formatRelative } from '$lib/utils/dates';
  import { enhance } from '$app/forms';
  import {
    Users, Plus, ShieldCheck, KeyRound, ShieldAlert, Check, X, UserMinus, UserCheck2
  } from 'lucide-svelte';
  import type { Role, UserStatus, User } from '$lib/data/types';

  export let data;
  export let form: {
    inviteSuccess?: boolean; invitedEmail?: string; inviteError?: string;
    deactivateSuccess?: boolean; deactivatedEmail?: string; deactivateError?: string;
    reactivateSuccess?: boolean; reactivatedEmail?: string; reactivateError?: string;
  } | null = null;

  $: if (form?.inviteSuccess) { addToast('success', `Invitation sent to ${form.invitedEmail}.`); showInviteForm = false; }
  $: if (form?.inviteError) addToast('error', form.inviteError);
  $: if (form?.deactivateSuccess) addToast('success', `${form.deactivatedEmail} deactivated and sessions revoked.`);
  $: if (form?.deactivateError) addToast('error', form.deactivateError);
  $: if (form?.reactivateSuccess) addToast('success', `${form.reactivatedEmail} reactivated.`);
  $: if (form?.reactivateError) addToast('error', form.reactivateError);

  let showInviteForm = false;

  // ---------- Filters ----------
  type RoleF = 'all' | Role;
  let roleFilter: RoleF = 'all';
  let tenantFilter = 'all';

  const ROLES: { id: RoleF; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'admin', label: 'Admin' },
    { id: 'risk-owner', label: 'Risk Owner' },
    { id: 'control-owner', label: 'Control Owner' },
    { id: 'auditor', label: 'Auditor' },
    { id: 'agent-operator', label: 'Agent Operator' },
    { id: 'viewer', label: 'Viewer' }
  ];

  $: filtered = data.users.filter((u: User) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (tenantFilter !== 'all' && u.tenantId !== tenantFilter) return false;
    return true;
  });

  // ---------- KPIs ----------
  $: total = data.users.length;
  $: activeCount = data.users.filter((u) => u.status === 'active').length;
  $: mfaCount = data.users.filter((u) => u.mfaEnabled).length;
  $: mfaPct = total ? Math.round((mfaCount / total) * 100) : 0;
  $: adminCount = data.users.filter((u) => u.role === 'admin').length;

  // ---------- Helpers ----------
  function roleCls(r: Role): string {
    switch (r) {
      case 'admin':         return 'bg-rose-50 text-rose-700 ring-rose-200';
      case 'risk-owner':    return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'control-owner': return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'auditor':       return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'agent-operator': return 'bg-violet-50 text-violet-700 ring-violet-200';
      default:              return 'bg-slate-100 text-slate-700 ring-slate-200';
    }
  }
  function statusCls(s: UserStatus): string {
    switch (s) {
      case 'active':   return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'invited':  return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'disabled': return 'bg-slate-100 text-slate-500 ring-slate-200';
      case 'locked':   return 'bg-rose-50 text-rose-700 ring-rose-200';
    }
  }
  function tenantName(id: string): string {
    return data.tenants.find((t) => t.id === id)?.name ?? id;
  }
  function initials(name: string): string {
    return name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  }
  function capLabel(c: string): string {
    return c.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

</script>

<PageHeader title="Users & RBAC" subtitle="{total} users across {data.tenants.length} tenants · 6 platform roles">
  <svelte:fragment slot="actions">
    <button class="btn-primary" on:click={() => (showInviteForm = !showInviteForm)}>
      <Plus class="h-4 w-4" />
      <span>Invite User</span>
    </button>
  </svelte:fragment>
</PageHeader>

{#if showInviteForm}
  <div class="card p-5">
    <h3 class="mb-3 text-sm font-semibold text-grc-ink">Invite a new user</h3>
    <form method="POST" action="?/inviteUser" class="flex flex-wrap items-end gap-3">
      <label class="block flex-1 min-w-[160px]">
        <span class="mb-1 block text-xs font-medium text-slate-700">Email</span>
        <input name="email" type="email" class="input" placeholder="user@company.com" required />
      </label>
      <label class="block flex-1 min-w-[140px]">
        <span class="mb-1 block text-xs font-medium text-slate-700">Full name</span>
        <input name="name" type="text" class="input" placeholder="Given name" required />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-700">Role</span>
        <select name="role" class="input">
          <option value="viewer">Viewer</option>
          <option value="auditor">Auditor</option>
          <option value="control-owner">Control Owner</option>
          <option value="risk-owner">Risk Owner</option>
          <option value="agent-operator">Agent Operator</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <div class="flex gap-2">
        <button type="submit" class="btn-primary">Send invite</button>
        <button type="button" class="btn-secondary" on:click={() => (showInviteForm = false)}>Cancel</button>
      </div>
    </form>
  </div>
{/if}

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
    <Kpi label="Total Users" value={total.toString()}>
      <Users slot="icon" class="h-4 w-4 text-grc-primary" />
    </Kpi>
    <Kpi label="Active" value={activeCount.toString()} hint="logged in last 30d">
      <ShieldCheck slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="MFA Enabled" value={mfaPct.toString()} suffix="%" hint="{mfaCount}/{total} users">
      <KeyRound slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Admin Users" value={adminCount.toString()} hint="elevated privileges" tone="bad">
      <ShieldAlert slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
  </div>

  <!-- Filters -->
  <div class="card flex flex-wrap items-center gap-3 px-4 py-3">
    <div class="flex flex-wrap items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Role:</span>
      {#each ROLES as f}
        <button type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {roleFilter === f.id
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (roleFilter = f.id)}>{f.label}</button>
      {/each}
    </div>
    <span class="text-slate-300">·</span>
    <select bind:value={tenantFilter} class="input w-56 py-1.5">
      <option value="all">All tenants</option>
      {#each data.tenants as t}
        <option value={t.id}>{t.name}</option>
      {/each}
    </select>
    <span class="ml-auto text-xs text-slate-500">{filtered.length} of {total} users</span>
  </div>

  <!-- Users table -->
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-2 text-left">User</th>
            <th class="px-4 py-2 text-left">Email</th>
            <th class="px-4 py-2 text-left">Role</th>
            <th class="px-4 py-2 text-left">Tenant</th>
            <th class="px-4 py-2 text-left">Last Login</th>
            <th class="px-4 py-2 text-center">MFA</th>
            <th class="px-4 py-2 text-left">Status</th>
            <th class="px-4 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each filtered as u (u.id)}
            <tr class="tr">
              <td class="td">
                <div class="flex items-center gap-2">
                  <div class="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-center font-mono text-[11px] font-semibold leading-7 text-white">
                    {initials(u.name)}
                  </div>
                  <span class="font-medium text-grc-ink">{u.name}</span>
                </div>
              </td>
              <td class="td font-mono text-[11px] text-slate-500">{u.email}</td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset {roleCls(u.role)}">
                  {u.role}
                </span>
              </td>
              <td class="td">
                <span class="tag tag-slate">{tenantName(u.tenantId)}</span>
              </td>
              <td class="td text-xs text-slate-500">{u.lastLoginAt ? formatRelative(u.lastLoginAt) : '—'}</td>
              <td class="td text-center">
                {#if u.mfaEnabled}
                  <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-50 text-violet-700" title="MFA enabled">
                    <Check class="h-3 w-3" />
                  </span>
                {:else}
                  <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-50 text-rose-700" title="MFA not enabled">
                    <X class="h-3 w-3" />
                  </span>
                {/if}
              </td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset {statusCls(u.status)}">
                  {u.status}
                </span>
              </td>
              <td class="td">
                {#if u.status !== 'disabled'}
                  <form method="POST" action="?/deactivateUser" use:enhance
                    on:submit={(e) => { if (!confirm(`Deactivate ${u.name}? This will immediately revoke all active sessions.`)) e.preventDefault(); }}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button type="submit" class="btn-ghost p-1 text-rose-600 hover:text-rose-800" title="Deactivate user">
                      <UserMinus class="h-3.5 w-3.5" />
                    </button>
                  </form>
                {:else}
                  <form method="POST" action="?/reactivateUser" use:enhance>
                    <input type="hidden" name="userId" value={u.id} />
                    <button type="submit" class="btn-ghost p-1 text-violet-600 hover:text-violet-800" title="Reactivate user">
                      <UserCheck2 class="h-3.5 w-3.5" />
                    </button>
                  </form>
                {/if}
              </td>
            </tr>
          {:else}
            <tr><td colspan="8" class="px-4 py-8 text-center text-sm text-slate-500">No users match.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- RBAC matrix -->
  <div class="card overflow-hidden">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <h2 class="section-title">Role-Permission Matrix</h2>
      <span class="text-xs text-slate-400">6 roles · 10 capabilities</span>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="sticky left-0 z-10 bg-surface-muted px-4 py-2 text-left">Capability</th>
            {#each Object.keys(data.rbac) as role}
              <th class="px-3 py-2 text-center">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset {roleCls(role as Role)}">
                  {role}
                </span>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each data.capabilities as cap}
            <tr class="tr">
              <td class="td sticky left-0 z-10 bg-white font-medium text-slate-700">{capLabel(cap)}</td>
              {#each Object.keys(data.rbac) as role}
                {@const allow = data.rbac[role as Role][cap as keyof typeof data.rbac[Role]]}
                <td class="td text-center">
                  {#if allow}
                    <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-50 text-violet-700">
                      <Check class="h-3.5 w-3.5" />
                    </span>
                  {:else}
                    <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <X class="h-3.5 w-3.5" />
                    </span>
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
