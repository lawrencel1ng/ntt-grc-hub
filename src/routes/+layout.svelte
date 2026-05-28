<script lang="ts">
  import '../app.css';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  export let data;
</script>

<div class="flex h-full">
  <Sidebar />
  <div class="flex flex-1 flex-col overflow-hidden">
    <TopBar tenants={data.tenants} liveAgents={data.liveAgents} />
    <main class="flex-1 overflow-y-auto px-6 py-6">
      <slot />
    </main>
  </div>
</div>
