<script lang="ts">
  import '../app.css';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import ClassifiedBanner from '$lib/components/ClassifiedBanner.svelte';
  import { currentTenantId } from '$lib/stores/tenant';
  export let data;

  // Keep the client store in sync with the cookie-derived tenant id so that
  // the TenantSwitcher label and chip render the right value after every
  // navigation (including the initial SSR render).
  $: if (data.currentTenantId) currentTenantId.set(data.currentTenantId);
</script>

<div class="flex h-full flex-col">
  {#if data.currentTenant?.classified}
    <ClassifiedBanner />
  {/if}
  <div class="flex flex-1 overflow-hidden">
    <Sidebar />
    <div class="flex flex-1 flex-col overflow-hidden">
      <TopBar tenants={data.tenants} liveAgents={data.liveAgents} />
      <main class="flex-1 overflow-y-auto px-6 py-6">
        <slot />
      </main>
    </div>
  </div>
</div>
