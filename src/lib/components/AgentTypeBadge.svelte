<script lang="ts">
  import type { AgentType } from '$lib/data/types';
  export let type: AgentType;

  $: cls = type === 'deterministic'
    ? 'bg-slate-100 text-slate-700 ring-slate-200'
    : type === 'ai-powered'
      ? 'bg-violet-50 text-violet-700 ring-violet-200'
      : 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200';

  $: label = type === 'ai-powered' ? 'AI-Powered' : type === 'intelligent' ? 'Intelligent' : 'Deterministic';
</script>

<span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {cls}">{label}</span>
