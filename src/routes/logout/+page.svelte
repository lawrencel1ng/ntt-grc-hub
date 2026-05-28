<script lang="ts">
  import { onMount } from 'svelte';
  onMount(() => {
    (document.getElementById('logout-form') as HTMLFormElement).submit();
  });
</script>

<form id="logout-form" method="POST" action="/logout">
  <p>Logging out…</p>
</form>
