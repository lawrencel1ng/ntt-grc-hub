<script lang="ts">
  import Logo from '$lib/components/Logo.svelte';
  import { ArrowLeft, ArrowRight, Mail, CheckCircle2 } from 'lucide-svelte';

  export let data: { email: string };
  export let form: { success?: boolean; email?: string } | null = null;

  let email = data.email ?? '';
</script>

<svelte:head><title>Reset password · NTT GRC Hub</title></svelte:head>

<div class="grid min-h-screen grid-cols-1 lg:grid-cols-2">
  <!-- Left: brand panel -->
  <div
    class="relative hidden overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-violet-900 lg:flex lg:flex-col lg:justify-between lg:p-12"
  >
    <div class="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-violet-500/15 blur-3xl"></div>
    <div class="pointer-events-none absolute -bottom-40 -right-40 h-[40rem] w-[40rem] rounded-full bg-fuchsia-500/10 blur-3xl"></div>

    <div class="relative">
      <Logo variant="light" />
    </div>

    <div class="relative space-y-6 text-white">
      <div class="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white/80 ring-1 ring-white/20">
        <span class="h-1.5 w-1.5 rounded-full bg-violet-400"></span>
        Password recovery
      </div>
      <h1 class="max-w-xl text-4xl font-bold leading-tight">
        Lost the keys? We'll mint a fresh set.
      </h1>
      <p class="max-w-xl text-base text-white/70">
        Reset links are one-time and expire in 30 minutes. All reset events are written to the
        immutable audit log and visible to your tenant admin.
      </p>
    </div>

    <div class="relative text-xs text-white/40">© 2026 NTT Singapore. Confidential.</div>
  </div>

  <!-- Right: form -->
  <div class="flex flex-col justify-center px-6 py-12 sm:px-12">
    <div class="mx-auto w-full max-w-md">
      <div class="lg:hidden">
        <Logo variant="dark" />
      </div>

      <div class="mt-8 lg:mt-0">
        <a href="/login" class="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ArrowLeft class="h-3 w-3" /> Back to sign in
        </a>
        <h2 class="text-2xl font-bold text-grc-ink">Reset your password</h2>
        <p class="mt-1 text-sm text-slate-500">
          Enter the work email tied to your NTT GRC Hub account. We'll send a single-use reset link.
        </p>
      </div>

      {#if form?.success}
        <div class="mt-8 rounded-lg border border-violet-200 bg-violet-50 p-4">
          <div class="flex items-start gap-3">
            <CheckCircle2 class="mt-0.5 h-5 w-5 flex-shrink-0 text-violet-600" />
            <div class="text-sm text-slate-700">
              <div class="font-semibold text-grc-ink">Check your inbox</div>
              <div class="mt-1 text-slate-600">
                If <span class="font-mono">{form.email}</span> is in our directory, a reset link is on
                its way. The link is valid for 30 minutes.
              </div>
            </div>
          </div>
        </div>
        <div class="mt-6 text-center text-xs text-slate-500">
          Didn't get it?
          <a href="/forgot?email={encodeURIComponent(form.email ?? '')}" class="text-grc-primary hover:underline">Send again</a>
          or
          <a href="/login" class="text-grc-primary hover:underline">return to sign in</a>.
        </div>
      {:else}
        <form method="POST" class="mt-8 space-y-4">
          <div>
            <label for="email" class="mb-1 block text-xs font-medium text-slate-700">Work email</label>
            <div class="relative">
              <Mail class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="email"
                name="email"
                type="email"
                class="input pl-9"
                bind:value={email}
                placeholder="you@company.com"
                autocomplete="username"
                required
              />
            </div>
          </div>

          <button type="submit" class="btn-primary w-full">
            Send reset link <ArrowRight class="h-4 w-4" />
          </button>

          <p class="text-center text-[11px] text-slate-400">
            Need help? Contact your tenant admin — all reset attempts are logged for audit.
          </p>
        </form>
      {/if}
    </div>
  </div>
</div>
