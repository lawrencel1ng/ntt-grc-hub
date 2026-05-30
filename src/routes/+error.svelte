<script lang="ts">
  import { page } from '$app/stores';
  import { AlertTriangle, Home, ArrowLeft } from 'lucide-svelte';
</script>

<svelte:head>
  <title>{$page.status} — NTT GRC Hub</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
  <div class="w-full max-w-md text-center">
    <div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600">
      <AlertTriangle class="h-8 w-8" />
    </div>

    <p class="text-5xl font-bold tabular-nums text-slate-800">{$page.status}</p>

    <h1 class="mt-3 text-xl font-semibold text-slate-700">
      {#if $page.status === 404}
        Page not found
      {:else if $page.status === 403}
        Access denied
      {:else if $page.status === 401}
        Authentication required
      {:else if $page.status === 503}
        Service unavailable
      {:else}
        Something went wrong
      {/if}
    </h1>

    {#if $page.error?.message}
      <p class="mt-2 text-sm text-slate-500">{$page.error.message}</p>
    {/if}

    <div class="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      <a
        href="/"
        class="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
      >
        <Home class="h-4 w-4" /> Go to dashboard
      </a>
      <button
        on:click={() => history.back()}
        class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
      >
        <ArrowLeft class="h-4 w-4" /> Go back
      </button>
    </div>

    <p class="mt-8 text-xs text-slate-400">
      NTT GRC Hub · If this persists, contact your platform administrator.
    </p>
  </div>
</div>
