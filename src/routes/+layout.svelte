<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import ClassifiedBanner from '$lib/components/ClassifiedBanner.svelte';
  import CommandPalette from '$lib/components/CommandPalette.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { currentTenantId } from '$lib/stores/tenant';
  export let data;

  // Keep the client store in sync with the cookie-derived tenant id so that
  // the TenantSwitcher label and chip render the right value after every
  // navigation (including the initial SSR render).
  $: if (data.currentTenantId) currentTenantId.set(data.currentTenantId);

  // Auth-style pages (login, forgot, reset) render full-bleed without the
  // sidebar / topbar chrome. Match by path so future auth routes inherit.
  const CHROMELESS = ['/login', '/forgot', '/reset'];
  $: chromeless = CHROMELESS.some((p) => $page.url.pathname.startsWith(p));
</script>

{#if chromeless}
  <slot />
{:else}
  <div class="flex h-full flex-col">
    {#if data.currentTenant?.classified}
      <ClassifiedBanner />
    {/if}
    <div class="flex flex-1 overflow-hidden">
      <Sidebar navBadges={data.navBadges} />
      <div class="flex flex-1 flex-col overflow-hidden">
        <TopBar
          user={data.user}
          tenants={data.tenants}
          currentTenant={data.currentTenant}
          currentTenantId={data.currentTenantId}
          liveAgents={data.liveAgents}
        />
        <main class="flex-1 overflow-y-auto px-6 py-6">
          <slot />
        </main>
      </div>
    </div>
  </div>
  <CommandPalette />
  <Toast />
{/if}
