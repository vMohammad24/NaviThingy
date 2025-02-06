<script lang="ts">
  import { client } from "$lib/stores/client";
  import { Star } from "lucide-svelte";

  export let id: string;
  export let rating = 0;

  let hoverRating = 0;

  async function setRating(value: number) {
    if (!$client) return;

    try {
      await $client.setRating(id, value);
      rating = value;
    } catch (error) {
      console.error("Failed to set rating:", error);
    }
  }
</script>

<div
  class="flex gap-1 w-full px-4 text-left hover:opacity-80 transition-opacity text-text"
>
  {#each Array(5) as _, i}
    <button
      class="text-primary hover:scale-110 transition-transform"
      on:mouseenter={() => (hoverRating = i + 1)}
      on:mouseleave={() => (hoverRating = 0)}
      on:click={(e) => {
        e.stopPropagation();
        setRating(i + 1);
      }}
    >
      <Star
        size={16}
        fill={(hoverRating ? i < hoverRating : i < rating)
          ? "currentColor"
          : "none"}
      />
    </button>
  {/each}
</div>
