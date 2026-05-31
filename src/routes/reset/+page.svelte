<script lang="ts">
  import Logo from '$lib/components/Logo.svelte';
  import { ArrowLeft, ArrowRight, Lock, AlertCircle } from 'lucide-svelte';

  export let data: { token: string; invalid: boolean; email: string };
  export let form: { error?: string; token?: string } | null = null;

  let password = '';
  let confirm = '';
  $: passwordsMatch = !confirm || password === confirm;
  $: strong = password.length >= 10;
</script>

<svelte:head><title>Set new password · NTT GRC Hub</title></svelte:head>

<div class="grid min-h-screen grid-cols-1 lg:grid-cols-2">
  <!-- Left: brand panel -->
  <div class="relative hidden overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-violet-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
    <div class="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-violet-500/15 blur-3xl"></div>
    <div class="pointer-events-none absolute -bottom-40 -right-40 h-[40rem] w-[40rem] rounded-full bg-fuchsia-500/10 blur-3xl"></div>
    <div class="relative"><Logo variant="light" /></div>
    <div class="relative space-y-6 text-white">
      <div class="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white/80 ring-1 ring-white/20">
        <span class="h-1.5 w-1.5 rounded-full bg-violet-400"></span>
        Password recovery
      </div>
      <h1 class="max-w-xl text-4xl font-bold leading-tight">Set your new password.</h1>
      <p class="max-w-xl text-base text-white/70">
        Choose a strong password. Reset events are written to the tamper-evident audit log.
      </p>
    </div>
    <div class="relative text-xs text-white/40">© {new Date().getFullYear()} NTT Singapore. Confidential.</div>
  </div>

  <!-- Right: form -->
  <div class="flex flex-col justify-center px-6 py-12 sm:px-12">
    <div class="mx-auto w-full max-w-md">
      <div class="lg:hidden mb-6"><Logo variant="dark" /></div>

      {#if data.invalid}
        <div class="rounded-lg border border-red-200 bg-red-50 p-4">
          <div class="flex items-start gap-3">
            <AlertCircle class="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
            <div class="text-sm">
              <div class="font-semibold text-grc-ink">Link invalid or expired</div>
              <div class="mt-1 text-slate-600">This reset link is no longer valid. Reset links expire after 30 minutes and can only be used once.</div>
            </div>
          </div>
        </div>
        <div class="mt-6 text-center">
          <a href="/forgot" class="text-sm text-grc-primary hover:underline">Request a new reset link</a>
        </div>
      {:else}
        <a href="/login" class="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ArrowLeft class="h-3 w-3" /> Back to sign in
        </a>
        <h2 class="text-2xl font-bold text-grc-ink">Set new password</h2>
        {#if data.email}
          <p class="mt-1 text-sm text-slate-500">Setting password for <span class="font-mono text-slate-700">{data.email}</span></p>
        {/if}

        {#if form?.error}
          <div class="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {form.error}
          </div>
        {/if}

        <form method="POST" class="mt-6 space-y-4">
          <input type="hidden" name="token" value={data.token} />

          <div>
            <label for="password" class="mb-1 block text-xs font-medium text-slate-700">New password</label>
            <div class="relative">
              <Lock class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                name="password"
                type="password"
                class="input pl-9"
                bind:value={password}
                placeholder="At least 10 characters"
                autocomplete="new-password"
                required
                minlength="10"
              />
            </div>
            {#if password && !strong}
              <p class="mt-1 text-xs text-amber-600">Use at least 10 characters.</p>
            {/if}
          </div>

          <div>
            <label for="confirm" class="mb-1 block text-xs font-medium text-slate-700">Confirm password</label>
            <div class="relative">
              <Lock class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="confirm"
                name="confirm"
                type="password"
                class="input pl-9"
                bind:value={confirm}
                placeholder="Repeat password"
                autocomplete="new-password"
                required
              />
            </div>
            {#if confirm && !passwordsMatch}
              <p class="mt-1 text-xs text-red-600">Passwords do not match.</p>
            {/if}
          </div>

          <button type="submit" class="btn-primary w-full" disabled={!strong || !passwordsMatch}>
            Set password <ArrowRight class="h-4 w-4" />
          </button>
        </form>
      {/if}
    </div>
  </div>
</div>
