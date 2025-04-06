<script lang="ts">
  import { client } from "$lib/stores/client";
  import { Star } from "lucide-svelte";

  export let id: string;
  export let rating = 0;
  export let compact = false;

  let hoverRating = 0;

  async function setRating(value: number) {
    if (!$client) return;
    if (value === rating) value = 0;

    try {
      await $client.setRating(id, value);
      rating = value;
    } catch (error) {
      console.error("Failed to set rating:", error);
    }
  }
</script>

<div
  class={`flex justify-center w-full ${compact ? "py-1" : "px-2 sm:px-4 py-2"} text-left hover:bg-primary/10 transition-colors text-text group`}
>
  <div class="flex gap-1">
    {#each Array(5) as _, i}
      <button
        class="text-primary hover:scale-110 transition-transform p-1.5 sm:p-0.5 touch-manipulation"
        on:mouseenter={() => (hoverRating = i + 1)}
        on:mouseleave={() => (hoverRating = 0)}
        on:click={(e) => {
          e.stopPropagation();
          setRating(i + 1);
        }}
      >
        <Star
          size={compact ? 16 : 20}
          class="transition-all duration-200"
          fill={(hoverRating ? i < hoverRating : i < rating)
            ? "currentColor"
            : "none"}
          stroke={(hoverRating ? i < hoverRating : i < rating)
            ? "currentColor"
            : "currentColor"}
          strokeWidth={2}
        />
      </button>
    {/each}
  </div>
</div>
