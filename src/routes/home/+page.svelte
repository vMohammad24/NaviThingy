<script lang="ts">
  import Album from "$lib/components/Album.svelte";
  import HeroSong from "$lib/components/HeroSong.svelte";
  import { client } from "$lib/stores/client";
  import { isMobile } from "$lib/stores/sidebarOpen";
  import type { Child } from "@vmohammad/subsonic-api";
  import { onMount } from "svelte";
  import { quintOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";

  let loading = $state(true);
  let error: string | null = $state(null);
  let username: string = $state("");
  let recentAlbums: Child[] = $state([]);
  let mostPlayed: Child[] = $state([]);
  let recentlyPlayed: Child[] = $state([]);

  async function loadData() {
    if (!$client) return;
    loading = true;
    error = null;
    try {
      const [recent, top, played, user] = await Promise.all([
        $client.getAlbums("newest", {
          size: 12,
        }),
        $client.getAlbums("frequent", {
          size: 12,
        }),
        $client.getAlbums("recent", {
          size: 12,
        }),
        $client.getUserData(),
      ]);

      recentAlbums = recent.album || [];
      mostPlayed = top.album || [];
      recentlyPlayed = played.album || [];
      username = user.username;
      loading = false;
    } catch (e) {
      error = "Failed to load data";
      loading = false;
    }
  }

  onMount(async () => {
    await loadData();
  });
</script>

<div class="container mx-auto px-4 py-6 space-y-8">
  {#if loading}
    <div class="grid gap-8">
      <div class="h-48 bg-surface/30 animate-pulse rounded-2xl"></div>
      {#each Array(3) as _}
        <div class="space-y-4">
          <div class="h-8 w-48 bg-surface/30 animate-pulse rounded-lg"></div>
          <div
            class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
          >
            {#each Array(6) as _}
              <div
                class="aspect-square bg-surface/30 animate-pulse rounded-xl"
              ></div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {:else if error}
    <div
      in:fade={{ duration: 300 }}
      class="text-center p-6 sm:p-12 rounded-2xl bg-surface/50 backdrop-blur"
    >
      <p class="text-text-secondary text-lg">{error}</p>
      <button
        class="mt-4 px-6 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
        onclick={loadData}
      >
        Retry
      </button>
    </div>
  {:else}
    <header
      in:fly={{ y: 20, duration: 500, delay: 0 }}
      class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 to-surface p-4 sm:p-8"
    >
      <h1 class="text-xl sm:text-4xl font-bold mb-2">
        Welcome Back, {username}
      </h1>
    </header>

    <div in:fly={{ y: 20, duration: 500, delay: 100 }}>
      <HeroSong />
    </div>
    {#each [{ title: "Most Played", albums: mostPlayed, link: "frequent" }, { title: "Recently Added", albums: recentAlbums, link: "newest" }, { title: "Recently Played", albums: recentlyPlayed, link: "recent" }] as section, i}
      <section
        in:fly={{
          y: 20,
          duration: 500,
          delay: 200 + i * 100,
          easing: quintOut,
        }}
      >
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl sm:text-2xl font-bold">{section.title}</h2>
          <a
            href="/albums/?activeTab={section.link}"
            class="text-sm text-text-secondary hover:text-primary transition-colors"
          >
            View All
          </a>
        </div>
        <div
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
        >
          {#each $isMobile ? section.albums.slice(0, 6) : section.albums as album, i}
            {#if i < 6 || window.innerWidth >= 768}
              <Album {album} showMetadata />
            {/if}
          {/each}
        </div>
      </section>
    {/each}
  {/if}
</div>
