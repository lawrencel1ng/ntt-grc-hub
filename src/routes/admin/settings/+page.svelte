<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { addToast } from '$lib/stores/toast';
  import { formatRelative, formatIsoSgt } from '$lib/utils/dates';
  import {
    User, Settings as SettingsIcon, KeyRound, Lock, Palette, ShieldCheck, Cpu, ShieldAlert
  } from 'lucide-svelte';

  export let data;
  export let form;

  $: if (form?.profileSuccess) addToast('success', 'Profile updated.');
  $: if (form?.pwSuccess) addToast('success', 'Password changed successfully.');

  // ---------- Tenant settings local state ----------
  // Default the AI provider to NTT Tsuzumi (sovereign) for MINDEF.
  $: defaultProvider = data.tenant?.id === 't_mindef' ? 'tsuzumi' : 'anthropic';
  $: defaultResidency = data.tenant?.id === 't_mindef' ? 'SG' : 'SG';
  let residency: string;
  let provider: string;
  // Sync local state when the tenant changes (e.g. via TenantSwitcher).
  $: { residency = defaultResidency; provider = defaultProvider; }

  // ---------- Actions ----------
  function toast(msg: string) { addToast('info', msg); }
  function revoke(name: string) { addToast('warn', `Token "${name}" would be revoked (demo).`); }
  function saveTenant() { addToast('success', `Tenant settings saved for ${data.tenant?.name ?? 'tenant'}.`); }
</script>

<PageHeader title="Settings" subtitle="Profile · tenant settings · API tokens · MFA · branding" />

<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
  <!-- Profile -->
  <div class="card p-6">
    <div class="mb-4 flex items-center gap-2">
      <User class="h-4 w-4 text-grc-primary" />
      <h2 class="section-title">Profile</h2>
    </div>
    <form method="POST" action="?/updateProfile" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label class="block">
        <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Name</span>
        <input name="name" value={data.user?.name ?? ''} required class="input" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Email</span>
        <input value={data.user?.email ?? ''} readonly class="input bg-slate-50" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Role</span>
        <input value={data.user?.role ?? ''} readonly class="input bg-slate-50" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Language</span>
        <select name="language" class="input">
          <option value="en-SG">English (en-SG)</option>
          <option value="en-US">English (en-US)</option>
          <option value="ja-JP">Japanese (ja-JP)</option>
          <option value="zh-SG">Chinese (zh-SG)</option>
        </select>
      </label>
      <label class="block sm:col-span-2">
        <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Timezone</span>
        <select name="timezone" class="input">
          <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+8)</option>
          <option value="Asia/Tokyo">Asia/Tokyo (JST, UTC+9)</option>
          <option value="Australia/Sydney">Australia/Sydney (AEST, UTC+10)</option>
          <option value="Europe/London">Europe/London (GMT, UTC+0)</option>
          <option value="America/New_York">America/New_York (ET, UTC-5)</option>
        </select>
      </label>
      {#if form?.profileError}
        <p class="sm:col-span-2 text-xs text-red-600">{form.profileError}</p>
      {/if}
      <div class="sm:col-span-2 flex justify-end">
        <button type="submit" class="btn-primary">Save Profile</button>
      </div>
    </form>
  </div>

  <!-- Change Password -->
  <div class="card p-6">
    <div class="mb-4 flex items-center gap-2">
      <Lock class="h-4 w-4 text-grc-primary" />
      <h2 class="section-title">Change Password</h2>
    </div>
    <form method="POST" action="?/changePassword" class="grid grid-cols-1 gap-3">
      <label class="block">
        <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Current Password</span>
        <input type="password" name="currentPassword" required class="input" autocomplete="current-password" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">New Password</span>
        <input type="password" name="newPassword" required minlength="8" class="input" autocomplete="new-password" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Confirm New Password</span>
        <input type="password" name="confirmPassword" required minlength="8" class="input" autocomplete="new-password" />
      </label>
      {#if form?.pwError}
        <p class="text-xs text-red-600">{form.pwError}</p>
      {/if}
      <div class="flex justify-end">
        <button type="submit" class="btn-primary">Change Password</button>
      </div>
    </form>
  </div>

  <!-- Tenant Settings -->
  <div class="card p-6">
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <SettingsIcon class="h-4 w-4 text-grc-primary" />
        <h2 class="section-title">Tenant Settings</h2>
      </div>
      {#if data.tenant?.classified}
        <span class="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
          <ShieldAlert class="h-3 w-3" /> classified
        </span>
      {/if}
    </div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label class="block sm:col-span-2">
        <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Current Tenant</span>
        <input value={data.tenant?.name ?? '—'} readonly class="input bg-slate-50" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Data Residency</span>
        <select bind:value={residency} class="input">
          <option value="SG">Singapore (SG)</option>
          <option value="JP">Japan (JP)</option>
          <option value="AU">Australia (AU)</option>
          <option value="US">United States (US)</option>
          <option value="EU">European Union (EU)</option>
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">AI Provider</span>
        <select bind:value={provider} class="input" disabled={data.tenant?.id === 't_mindef'}>
          <option value="tsuzumi">NTT Tsuzumi (sovereign)</option>
          <option value="anthropic">Anthropic Claude</option>
          <option value="openai">OpenAI</option>
        </select>
        {#if data.tenant?.id === 't_mindef'}
          <p class="mt-1 text-[11px] text-rose-700">Sovereign tenant — provider locked to NTT Tsuzumi.</p>
        {/if}
      </label>
    </div>
    <div class="mt-4 flex items-center justify-between">
      <p class="text-[11px] text-slate-500">Tenant settings apply to all users in <span class="font-medium">{data.tenant?.name ?? '—'}</span>.</p>
      <button class="btn-primary" on:click={saveTenant}>Save</button>
    </div>
  </div>

  <!-- API Tokens -->
  <div class="card overflow-hidden p-0 lg:col-span-2">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <div class="flex items-center gap-2">
        <KeyRound class="h-4 w-4 text-grc-primary" />
        <h2 class="section-title">API Tokens</h2>
      </div>
      <button class="btn-secondary" on:click={() => toast('Token creation flow would open (demo).')}>+ New Token</button>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-2 text-left">Name</th>
            <th class="px-4 py-2 text-left">Scope</th>
            <th class="px-4 py-2 text-left">Prefix</th>
            <th class="px-4 py-2 text-left">Last Used</th>
            <th class="px-4 py-2 text-left">Expires</th>
            <th class="px-4 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {#each data.apiTokens as tok}
            <tr class="tr">
              <td class="td font-medium text-grc-ink">{tok.name}</td>
              <td class="td"><span class="tag tag-violet">{tok.scope}</span></td>
              <td class="td font-mono text-[11px] text-slate-500">{tok.prefix}••••••••••</td>
              <td class="td text-xs text-slate-500">{formatRelative(tok.lastUsedAt)}</td>
              <td class="td text-xs text-slate-500">{formatIsoSgt(tok.expiresAt).slice(0, 10)}</td>
              <td class="td text-right">
                <button class="text-xs font-semibold text-rose-600 hover:underline" on:click={() => revoke(tok.name)}>Revoke</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- MFA -->
  <div class="card p-6">
    <div class="mb-4 flex items-center gap-2">
      <Lock class="h-4 w-4 text-grc-primary" />
      <h2 class="section-title">Multi-Factor Authentication</h2>
    </div>
    <div class="rounded-xl bg-emerald-50/70 p-4 ring-1 ring-inset ring-emerald-200">
      <div class="flex items-center gap-2">
        <ShieldCheck class="h-5 w-5 text-emerald-700" />
        <span class="font-semibold text-emerald-900">MFA enabled</span>
      </div>
      <p class="mt-1 text-xs text-emerald-800">TOTP authenticator app · last enrolled 18 Apr 2026 · 2 backup codes remaining.</p>
    </div>
    <button class="btn-secondary mt-3" on:click={() => toast('MFA management dialog would open (demo).')}>Manage MFA</button>
  </div>

  <!-- Branding -->
  <div class="card p-6">
    <div class="mb-4 flex items-center gap-2">
      <Palette class="h-4 w-4 text-grc-primary" />
      <h2 class="section-title">Branding</h2>
    </div>
    <div class="flex items-center gap-3">
      <div class="h-12 w-12 rounded-lg shadow-card ring-1 ring-inset ring-slate-200" style="background:#6d28d9"></div>
      <div>
        <div class="text-sm font-medium text-grc-ink">Primary colour</div>
        <div class="font-mono text-xs text-slate-500">#6d28d9 · NTT Violet</div>
      </div>
      <button class="btn-secondary ml-auto" on:click={() => toast('Branding customiser would open (demo).')}>Customise</button>
    </div>
    <p class="mt-3 text-[11px] text-slate-400">Branding tokens (logo, accent colour, dark-mode toggle) apply tenant-wide.</p>
  </div>

  <!-- Footer -->
  <div class="lg:col-span-2 rounded-xl bg-gradient-to-r from-slate-50 via-white to-violet-50/40 px-5 py-4 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
    <Cpu class="-mt-1 mr-1 inline h-4 w-4 text-grc-primary" />
    Platform settings sync to <span class="font-mono text-xs">platform.tenants</span> and propagate to the agent fleet within 30 seconds.
  </div>
</div>
