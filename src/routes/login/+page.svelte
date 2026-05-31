<script lang="ts">
  import { page } from '$app/stores';
  import Logo from '$lib/components/Logo.svelte';
  import { DEMO_LOGINS } from '$lib/data/demo-logins';
  import {
    ShieldCheck,
    KeyRound,
    Eye,
    EyeOff,
    ArrowRight,
    Lock,
    Fingerprint
  } from 'lucide-svelte';

  export let data: { next: string; frameworkCount: number; agentCount: number; pgMode: boolean };
  export let form: { error?: string } | null = null;

  let email = '';
  let password = '';
  let remember = true;
  let showPw = false;
  let loading = false;

  $: nextDest = (() => {
    const n = $page.url.searchParams.get('next') ?? data.next ?? '/';
    return n.startsWith('/') && !n.startsWith('//') ? n : '/';
  })();

  $: ssoUnavailable = $page.url.searchParams.get('sso_unavailable');
  $: passwordReset = $page.url.searchParams.get('reset') === '1';

  const PROVIDER_LABEL: Record<string, string> = {
    okta: 'Okta',
    'azure-ad': 'Microsoft Entra',
    ping: 'Ping Identity',
    singpass: 'Singpass'
  };

  function sso(provider: 'okta' | 'azure-ad' | 'ping' | 'singpass') {
    loading = true;
    const next = encodeURIComponent(nextDest);
    window.location.href = `/login?sso_unavailable=${provider}&next=${next}`;
  }

  function useDemo(d: (typeof DEMO_LOGINS)[number]) {
    email = d.email;
    password = d.password;
  }
</script>

<svelte:head><title>Sign in · NTT GRC Hub</title></svelte:head>

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
        NTT GRC Hub · v1.0
      </div>
      <h1 class="max-w-xl text-4xl font-bold leading-tight">
        Continuous risk reduction — not annual audits.
      </h1>
      <p class="max-w-xl text-base text-white/70">
        An agentic GRC platform for regulated APAC enterprises. 10 named agents continuously test
        controls, collect evidence, scan regulators, and quantify risk.
      </p>
      <div class="grid grid-cols-3 gap-4 pt-2">
        <div>
          <div class="font-mono text-2xl font-semibold">{data.agentCount || 10}</div>
          <div class="text-xs uppercase tracking-wider text-white/50">Named agents</div>
        </div>
        <div>
          <div class="font-mono text-2xl font-semibold">{data.frameworkCount || 35}</div>
          <div class="text-xs uppercase tracking-wider text-white/50">Frameworks</div>
        </div>
        <div>
          <div class="font-mono text-2xl font-semibold">S$1.2M</div>
          <div class="text-xs uppercase tracking-wider text-white/50">FTE saved / yr</div>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 pt-3">
        <span class="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/80 ring-1 ring-white/15">MAS TRM</span>
        <span class="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/80 ring-1 ring-white/15">IM8</span>
        <span class="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/80 ring-1 ring-white/15">ITSG-33</span>
        <span class="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/80 ring-1 ring-white/15">PCI DSS 4.0</span>
        <span class="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/80 ring-1 ring-white/15">ISO 27001</span>
        <span class="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/80 ring-1 ring-white/15">GDPR</span>
        <span class="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/80 ring-1 ring-white/15">DORA</span>
        <span class="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/80 ring-1 ring-white/15">EU AI Act</span>
      </div>
    </div>

    <div class="relative text-xs text-white/40">© {new Date().getFullYear()} NTT Singapore. Confidential.</div>
  </div>

  <!-- Right: login -->
  <div class="flex flex-col justify-center px-6 py-12 sm:px-12">
    <div class="mx-auto w-full max-w-md">
      <div class="lg:hidden">
        <Logo variant="dark" />
      </div>

      {#if passwordReset}
        <div class="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
          Password updated successfully. Sign in with your new credentials.
        </div>
      {/if}

      {#if ssoUnavailable}
        <div class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <strong>{PROVIDER_LABEL[ssoUnavailable] ?? ssoUnavailable}</strong> SSO isn't configured
          in this environment. Sign in with your work email below{#if !data.pgMode}, or pick a demo account{/if}.
        </div>
      {/if}

      <div class="mt-8 lg:mt-0">
        <h2 class="text-2xl font-bold text-grc-ink">Sign in</h2>
        <p class="mt-1 text-sm text-slate-500">
          Access the agentic GRC operating system.
        </p>
      </div>

      <form method="POST" class="mt-8 space-y-4">
        <input type="hidden" name="next" value={nextDest} />

        <div>
          <label for="email" class="mb-1 block text-xs font-medium text-slate-700">Work email</label>
          <input
            id="email"
            name="email"
            type="email"
            class="input"
            bind:value={email}
            placeholder="you@company.com"
            autocomplete="username"
            required
          />
        </div>

        <div>
          <div class="mb-1 flex items-center justify-between">
            <label for="pw" class="text-xs font-medium text-slate-700">Password</label>
            <a
              href="/forgot?email={encodeURIComponent(email)}"
              class="text-xs text-grc-primary hover:underline"
            >
              Forgot password?
            </a>
          </div>
          <div class="relative">
            <input
              id="pw"
              name="password"
              type={showPw ? 'text' : 'password'}
              class="input pr-10"
              bind:value={password}
              autocomplete="current-password"
              required
            />
            <button
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
              on:click={() => (showPw = !showPw)}
              aria-label="Toggle password visibility"
            >
              {#if showPw}
                <EyeOff class="h-4 w-4" />
              {:else}
                <Eye class="h-4 w-4" />
              {/if}
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between text-xs">
          <label class="inline-flex items-center gap-2 text-slate-600">
            <input
              type="checkbox"
              bind:checked={remember}
              class="rounded border-slate-300 text-grc-primary focus:ring-grc-primary"
            />
            Keep me signed in (8h)
          </label>
          <span class="inline-flex items-center gap-1 text-slate-500">
            <ShieldCheck class="h-3.5 w-3.5 text-slate-500" /> MFA when enrolled
          </span>
        </div>

        {#if form?.error}
          <div role="alert" class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {form.error}
          </div>
        {/if}

        <button type="submit" class="btn-primary w-full" disabled={loading}>
          {#if loading}Signing in…{:else}Sign in <ArrowRight class="h-4 w-4" />{/if}
        </button>
      </form>

      <div class="relative my-6">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-slate-200"></div>
        </div>
        <div class="relative flex justify-center text-xs">
          <span class="bg-white px-2 text-slate-400">Or continue with SSO</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <button type="button" class="btn-secondary" disabled={loading} on:click={() => sso('okta')}>
          <KeyRound class="h-4 w-4" /> Okta
        </button>
        <button type="button" class="btn-secondary" disabled={loading} on:click={() => sso('azure-ad')}>
          <Lock class="h-4 w-4" /> Microsoft Entra
        </button>
        <button type="button" class="btn-secondary" disabled={loading} on:click={() => sso('ping')}>
          <Lock class="h-4 w-4" /> Ping Identity
        </button>
        <button type="button" class="btn-secondary" disabled={loading} on:click={() => sso('singpass')}>
          <Fingerprint class="h-4 w-4" /> Singpass
        </button>
      </div>

      {#if !data.pgMode}
      <div class="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div class="mb-2 flex items-center justify-between">
          <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Demo accounts</div>
          <span class="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200">Click to fill</span>
        </div>
        <div class="space-y-1">
          {#each DEMO_LOGINS as d}
            <button
              type="button"
              class="flex w-full items-center justify-between gap-2 rounded p-1.5 text-left text-xs hover:bg-white"
              on:click={() => useDemo(d)}
            >
              <div class="min-w-0">
                <div class="truncate font-medium text-slate-700">{d.email}</div>
                <div class="truncate text-[11px] text-slate-500">{d.name} · {d.tenantName}</div>
              </div>
              <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-600">{d.role}</span>
            </button>
          {/each}
        </div>
      </div>
      {/if}

      <div class="mt-6 text-center text-[11px] text-slate-400">
        By signing in you agree to NTT Singapore's
        <a href="/" class="underline">acceptable use policy</a>. All sessions are logged and
        subject to audit under MAS TRM, IM8 and ITSG-33.
      </div>
    </div>
  </div>
</div>
