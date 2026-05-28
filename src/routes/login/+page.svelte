<script lang="ts">
  import Logo from '$lib/components/Logo.svelte';
  export let data: { next: string };
  export let form: { error?: string } | null = null;
  let email = 'demo@ntt.com';
  let password = '';
</script>

<div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-violet-900 p-6">
  <div class="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
    <div class="mb-6 flex justify-center">
      <Logo variant="dark" />
    </div>
    <h1 class="mb-1 text-center text-lg font-semibold text-grc-ink">Sign in</h1>
    {#if form?.error}
      <p class="text-sm text-red-600 text-center">{form.error}</p>
    {/if}
    <form method="POST" class="space-y-3">
      <input type="hidden" name="next" value={data.next ?? '/'} />
      <label class="block text-sm">
        <span class="mb-1 block text-slate-600">Email</span>
        <input class="input" type="email" name="email" autocomplete="email" bind:value={email} required />
      </label>
      <label class="block text-sm">
        <span class="mb-1 block text-slate-600">Password</span>
        <input class="input" type="password" name="password" autocomplete="current-password" bind:value={password} />
      </label>
      <button class="btn-primary w-full" type="submit">Continue</button>
    </form>
    <p class="mt-6 text-center text-[11px] text-slate-400">© 2026 NTT Singapore</p>
  </div>
</div>
