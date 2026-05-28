<script lang="ts">
  export let variant: 'light' | 'dark' = 'light';
  export let compact = false;
</script>

<a href="/" class="inline-flex items-center gap-2 select-none">
  <svg viewBox="0 0 64 64" class="h-6 w-6">
    <defs>
      <linearGradient id="logoG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#10b981"/>
        <stop offset="100%" stop-color="#047857"/>
      </linearGradient>
    </defs>
    <path d="M32 4 L56 14 V32 C56 46 44 56 32 60 C20 56 8 46 8 32 V14 Z" fill="url(#logoG)"/>
    <circle cx="32" cy="30" r="6" fill={variant === 'light' ? '#0f172a' : '#ffffff'}/>
    <path d="M32 24 V14 M32 36 V46 M26 30 H16 M38 30 H48"
          stroke={variant === 'light' ? '#0f172a' : '#ffffff'} stroke-width="2.5" stroke-linecap="round"/>
  </svg>
  {#if !compact}
    <div class="flex flex-col leading-tight">
      <span class="text-sm font-semibold tracking-tight {variant === 'light' ? 'text-white' : 'text-grc-ink'}">NTT GRC HUB</span>
      <span class="text-[10px] font-medium uppercase tracking-wider {variant === 'light' ? 'text-emerald-300' : 'text-grc-primary'}">Agentic GRC OS</span>
    </div>
  {/if}
</a>
