<script lang="ts">
  import { page } from "$app/state";
  import { Home } from "lucide-svelte";
</script>

<div
  class="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center"
>
  <h1 class="mb-2 text-9xl font-bold text-primary">{page.status}</h1>
  <p class="mb-8 text-2xl text-text-secondary">
    {page.error?.message || "Something went wrong"}
  </p>
  <a
    href="/home"
    class="flex items-center gap-2 rounded-lg bg-primary p-2 font-semibold text-text transition-all hover:opacity-90"
  >
    <Home size={20} />
    <span>Back to Home</span>
  </a>
</div>
