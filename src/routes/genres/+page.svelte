<script lang="ts">
  import { client } from "$lib/stores/client";
  import { Tag } from "@lucide/svelte";
  import type { Genre } from "@vmohammad/subsonic-api";
  import { onMount } from "svelte";

  let genres = $state<Genre[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state("");
  let sortDirection = $state<"asc" | "desc">("desc");
  let sortBy = $state<"name" | "songCount" | "albumCount">("songCount");

  let filteredGenres = $derived(
    genres
      .filter(
        (genre) =>
          !searchQuery ||
          genre.value.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      .sort((a, b) => {
        let comparison: number;
        switch (sortBy) {
          case "songCount":
            comparison = a.songCount - b.songCount;
            break;
          case "albumCount":
            comparison = a.albumCount - b.albumCount;
            break;
          default:
            comparison = a.value.localeCompare(b.value);
        }
        return sortDirection === "asc" ? comparison : -comparison;
      }),
  );

  async function loadGenres() {
    try {
      loading = true;
      error = null;
      const result = await $client!.getGenres();
      genres = result || [];
    } catch (e) {
      error = "Failed to load genres";
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function handleSort(newSortBy: typeof sortBy) {
    if (sortBy === newSortBy) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortBy = newSortBy;
      sortDirection = "asc";
    }
  }

  onMount(() => {
    if ($client) {
      loadGenres();
    }
  });
</script>

<div class="container mx-auto px-4 py-6">
  <div class="flex items-center gap-2 mb-6">
    <Tag class="text-primary" size={32} />
    <h1 class="text-2xl font-bold">Genres</h1>
  </div>

  <div class="flex flex-col sm:flex-row gap-4 mb-6">
    <input
      type="text"
      placeholder="Search genres..."
      class="flex-1 px-4 py-2 rounded-lg bg-surface"
      bind:value={searchQuery}
    />
    <div class="flex flex-wrap gap-2">
      <button
        class="px-4 py-2 rounded-lg bg-surface hover:bg-surface-hover whitespace-nowrap"
        onclick={() => handleSort("name")}
      >
        Name {sortBy === "name" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
      </button>
      <button
        class="px-4 py-2 rounded-lg bg-surface hover:bg-surface-hover whitespace-nowrap"
        onclick={() => handleSort("songCount")}
      >
        Songs {sortBy === "songCount"
          ? sortDirection === "asc"
            ? "↑"
            : "↓"
          : ""}
      </button>
      <button
        class="px-4 py-2 rounded-lg bg-surface hover:bg-surface-hover whitespace-nowrap"
        onclick={() => handleSort("albumCount")}
      >
        Albums {sortBy === "albumCount"
          ? sortDirection === "asc"
            ? "↑"
            : "↓"
          : ""}
      </button>
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center items-center h-64">
      <div
        class="animate-spin rounded-full h-12 w-12 border-4 border-primary"
      ></div>
    </div>
  {:else if error}
    <div class="text-red-500 text-center py-8">{error}</div>
  {:else if filteredGenres.length === 0}
    <div class="text-center py-8 text-text-secondary">No genres found</div>
  {:else}
    <div
      class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4"
    >
      {#each filteredGenres as genre}
        <a
          href="/albums?genre={genre.value}"
          class="p-4 rounded-lg bg-surface hover:bg-surface-hover transition-colors"
        >
          <div class="font-medium">{genre.value}</div>
          <div class="text-sm text-text-secondary">{genre.songCount} songs</div>
          <div class="text-sm text-text-secondary">
            {genre.albumCount} albums
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
