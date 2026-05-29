<script lang="ts">
  export let title: string;
  export let subtitle: string = '';
  export let breadcrumbs: { label: string; href?: string }[] = [];
</script>

<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
  <div class="min-w-0">
    {#if breadcrumbs.length}
      <nav class="mb-1 flex items-center gap-1 text-xs text-slate-500">
        {#each breadcrumbs as crumb, i}
          {#if crumb.href}
            <a href={crumb.href} class="hover:text-grc-primary">{crumb.label}</a>
          {:else}
            <span>{crumb.label}</span>
          {/if}
          {#if i < breadcrumbs.length - 1}<span class="text-slate-300">/</span>{/if}
        {/each}
      </nav>
    {/if}
    <h1 class="h-page">{title}</h1>
    {#if subtitle}
      <p class="subtle mt-1 max-w-3xl">{subtitle}</p>
    {/if}
  </div>
  <div class="flex items-center gap-2">
    <slot name="actions" />
  </div>
</div>
