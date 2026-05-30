<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import {
    currentTenantId as currentTenantIdStore,
    ALL_TENANTS_ID,
    type TenantSummary
  } from '$lib/stores/tenant';
  import { commandPaletteOpen } from '$lib/stores/commandPalette';
  import {
    Search,
    Bot,
    Bell,
    HelpCircle,
    ChevronDown,
    LogOut,
    User as UserIcon,
    Building2,
    Globe,
    Check,
    Loader2
  } from 'lucide-svelte';

  type Role = 'admin' | 'risk-owner' | 'control-owner' | 'auditor' | 'agent-operator' | 'viewer';
  type TopBarUser = {
    id: string;
    email: string;
    name: string;
    role: Role;
    tenantId: string;
  };

  export let user: TopBarUser | null = null;
  export let tenants: TenantSummary[] = [];
  export let currentTenant: TenantSummary | null = null;
  export let currentTenantId: string = ALL_TENANTS_ID;
  export let liveAgents = 0;

  let showMenu = false;
  let showNotif = false;
  let busy = '';
  let tenantFilter = '';

  // Notifications — fetched from real DB on first open
  interface Notif { id: string; title: string; body: string; href: string; severity: string; createdAt: string }
  let notifications: Notif[] = [];
  let notifLoaded = false;
  let notifLoading = false;

  async function openNotifications() {
    showNotif = !showNotif;
    showMenu = false;
    if (showNotif && !notifLoaded && !notifLoading) {
      notifLoading = true;
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          notifications = data.notifications ?? [];
        }
      } catch { /* ignore */ }
      notifLoaded = true;
      notifLoading = false;
    }
  }

  $: isAdmin = user?.role === 'admin';
  $: isAllView = currentTenantId === ALL_TENANTS_ID;
  // The user's "home" tenant comes from their session; treat it as authoritative.
  $: homeTenantId = user?.tenantId ?? null;
  $: actingAway =
    !isAllView && homeTenantId !== null && homeTenantId !== ALL_TENANTS_ID && currentTenantId !== homeTenantId;

  $: initials = (user?.name ?? 'NU')
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  $: tenantNameForLabel = isAllView
    ? 'All tenants'
    : currentTenant?.name ?? tenants.find((t) => t.id === currentTenantId)?.name ?? '';

  $: filteredTenants = tenantFilter
    ? tenants.filter(
        (t) =>
          t.name.toLowerCase().includes(tenantFilter.toLowerCase()) ||
          t.id.toLowerCase().includes(tenantFilter.toLowerCase())
      )
    : tenants;

  async function pickTenant(tenantId: string) {
    busy = tenantId;
    try {
      await fetch('/api/tenant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId: tenantId === ALL_TENANTS_ID ? '' : tenantId })
      });
      currentTenantId = tenantId;
      currentTenantIdStore.set(tenantId);
      await invalidateAll();
      showMenu = false;
      tenantFilter = '';
    } finally {
      busy = '';
    }
  }

  async function returnHome() {
    if (homeTenantId) {
      await pickTenant(homeTenantId);
    } else {
      await pickTenant(ALL_TENANTS_ID);
    }
  }

  // Close dropdowns on Escape
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      showMenu = false;
      showNotif = false;
    }
  }
</script>

<svelte:window on:keydown={onKeydown} />

<header
  class="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur"
>
  <div class="flex flex-1 items-center gap-4">
    <div class="relative w-full max-w-lg">
      <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        placeholder="Search risks, controls, evidence, agents…"
        class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-12 text-sm text-slate-700 placeholder:text-slate-400 focus:border-grc-primary focus:bg-white focus:ring-1 focus:ring-grc-primary"
        readonly
        on:click={() => commandPaletteOpen.set(true)}
        on:focus={() => commandPaletteOpen.set(true)}
      />
      <kbd class="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">⌘K</kbd>
    </div>
  </div>

  <div class="flex items-center gap-2">
    <div class="hidden items-center gap-2 rounded-md bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200 lg:flex">
      <span class="h-1.5 w-1.5 rounded-full bg-violet-500"></span>
      <Bot class="h-3.5 w-3.5 text-slate-500" />
      <span>{liveAgents} agents live</span>
    </div>

    <button class="btn-ghost rounded-full p-2" title="Help" aria-label="Help">
      <HelpCircle class="h-4 w-4" />
    </button>

    <div class="relative">
      <button
        class="btn-ghost relative rounded-full p-2"
        on:click={openNotifications}
        aria-label="Notifications"
      >
        <Bell class="h-4 w-4" />
        {#if notifications.length > 0 || !notifLoaded}
          <span class="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500"></span>
        {/if}
      </button>
      {#if showNotif}
        <div class="absolute right-0 top-full mt-2 w-96 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <div class="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Notifications</div>
          {#if notifLoading}
            <div class="px-3 py-4 text-center text-xs text-slate-400">Loading…</div>
          {:else if notifications.length === 0}
            <div class="px-3 py-4 text-center text-xs text-slate-400">No recent notifications.</div>
          {:else}
            {#each notifications as n (n.id)}
              <a href={n.href} class="block rounded p-2 hover:bg-slate-50" on:click={() => (showNotif = false)}>
                <div class="text-sm font-medium {n.severity === 'critical' ? 'text-rose-800' : n.severity === 'warning' ? 'text-amber-800' : 'text-slate-800'}">{n.title}</div>
                <div class="text-xs text-slate-500">{n.body}</div>
              </a>
            {/each}
          {/if}
        </div>
      {/if}
    </div>

    <div class="mx-1 h-6 w-px bg-slate-200"></div>

    <div class="relative">
      <button
        class="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 {actingAway || isAllView ? 'ring-1 ring-amber-300' : ''}"
        on:click={() => {
          showMenu = !showMenu;
          showNotif = false;
          tenantFilter = '';
        }}
      >
        <div class="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-xs font-bold text-white">
          {initials}
        </div>
        <div class="hidden text-left md:block">
          <div class="text-sm font-medium text-slate-800">{user?.name ?? 'Guest'}</div>
          <div class="text-[11px] {actingAway || isAllView ? 'font-semibold text-amber-700' : 'text-slate-500'}">
            {user?.role ?? ''}{user?.role ? ' · ' : ''}{isAllView ? 'All tenants' : tenantNameForLabel}
          </div>
        </div>
        <ChevronDown class="h-4 w-4 text-slate-400" />
      </button>

      {#if showMenu}
        <div class="absolute right-0 top-full mt-2 w-80 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          <div class="border-b border-slate-100 px-3 py-2">
            <div class="text-sm font-semibold text-slate-800">{user?.name ?? 'Guest'}</div>
            <div class="text-xs text-slate-500">{user?.email ?? ''}</div>
          </div>

          <!-- Tenant section -->
          <div class="border-b border-slate-100 px-1 py-2">
            <div class="flex items-center justify-between px-2 pb-1">
              <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {isAdmin ? 'Switch tenant' : 'Tenant'}
              </div>
              {#if actingAway || isAllView}
                <button
                  type="button"
                  class="text-[10px] font-medium text-amber-700 hover:underline"
                  on:click={returnHome}
                >
                  Return home
                </button>
              {/if}
            </div>

            {#if tenants.length > 6}
              <div class="relative px-1 pb-1.5">
                <Search class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  bind:value={tenantFilter}
                  class="input pl-7 text-xs"
                  placeholder="Filter…"
                />
              </div>
            {/if}

            <div class="max-h-60 space-y-0.5 overflow-y-auto px-0.5">
              {#if isAdmin}
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-50 {isAllView ? 'bg-amber-50 text-amber-800' : ''}"
                  on:click={() => pickTenant(ALL_TENANTS_ID)}
                  disabled={busy === ALL_TENANTS_ID}
                >
                  <div class="flex min-w-0 items-center gap-2">
                    <Globe class="h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
                    <div class="min-w-0">
                      <div class="truncate font-medium">All tenants</div>
                      <div class="truncate text-[10px] text-slate-500">Platform-wide aggregate</div>
                    </div>
                  </div>
                  {#if busy === ALL_TENANTS_ID}
                    <Loader2 class="h-3.5 w-3.5 flex-shrink-0 animate-spin text-slate-400" />
                  {:else if isAllView}
                    <Check class="h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
                  {/if}
                </button>
                <div class="my-0.5 h-px bg-slate-100"></div>
              {/if}

              {#each filteredTenants as t}
                {@const active = currentTenantId === t.id && !isAllView}
                {@const isHome = t.id === homeTenantId}
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-50 {active ? 'bg-slate-100' : ''}"
                  on:click={() => pickTenant(t.id)}
                  disabled={busy === t.id || active}
                >
                  <div class="flex min-w-0 items-center gap-2">
                    <div class="grid h-5 w-5 flex-shrink-0 place-items-center rounded bg-gradient-to-br from-violet-500 to-violet-700 text-[9px] font-bold text-white">
                      {t.name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="truncate font-medium">{t.name}</span>
                        {#if isHome}
                          <span class="rounded bg-violet-50 px-1 py-0 text-[9px] font-semibold uppercase tracking-wider text-violet-700">home</span>
                        {/if}
                      </div>
                      <div class="truncate text-[10px] text-slate-500">{t.id}{#if t.industry} · {t.industry}{/if}</div>
                    </div>
                  </div>
                  {#if busy === t.id}
                    <Loader2 class="h-3.5 w-3.5 flex-shrink-0 animate-spin text-slate-400" />
                  {:else if active}
                    <Check class="h-3.5 w-3.5 flex-shrink-0 text-violet-600" />
                  {/if}
                </button>
              {/each}

              {#if filteredTenants.length === 0}
                <div class="px-2 py-3 text-center text-xs text-slate-400">No matches</div>
              {/if}
            </div>
          </div>

          <a
            href="/admin/settings"
            class="flex items-center gap-2 rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            on:click={() => (showMenu = false)}
          >
            <UserIcon class="h-4 w-4" /> Profile &amp; preferences
          </a>
          {#if isAdmin}
            <a
              href="/admin/tenants"
              class="flex items-center gap-2 rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              on:click={() => (showMenu = false)}
            >
              <Building2 class="h-4 w-4" /> Manage tenants
            </a>
          {/if}
          <form method="POST" action="/logout" class="block">
            <button
              type="submit"
              class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
            >
              <LogOut class="h-4 w-4" /> Sign out
            </button>
          </form>
        </div>
      {/if}
    </div>
  </div>
</header>

{#if actingAway || isAllView}
  <div class="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-6 py-1.5 text-xs">
    <div class="text-amber-800">
      {#if isAllView}
        <strong>All-tenant view</strong> — aggregated across every tenant. Writes still target your
        home tenant unless you switch into a specific one.
      {:else}
        <strong>Acting as {tenantNameForLabel}</strong> — all reads and writes target tenant
        <code class="font-mono">{currentTenantId}</code>.
      {/if}
    </div>
    <button type="button" class="font-medium text-amber-700 underline hover:text-amber-900" on:click={returnHome}>
      Return to home tenant
    </button>
  </div>
{/if}
