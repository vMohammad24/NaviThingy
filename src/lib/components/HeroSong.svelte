<script lang="ts">
  import { client } from "$lib/stores/client";
  import { player } from "$lib/stores/player";
  import type { Child } from "@vmohammad/subsonic-api";
  import {
    CalendarRange,
    Clock1,
    Gauge,
    Music,
    Pause,
    Play,
    SkipForward,
  } from "lucide-svelte";
  import { onMount } from "svelte";
  import { quintInOut } from "svelte/easing";
  import { blur, fly } from "svelte/transition";

  let song: Child | null = null;
  let loading = true;
  let error: string | null = null;
  let containerRef: HTMLDivElement;

  $: isPlaying = $player.currentTrack?.id === song?.id && $player.isPlaying;

  async function loadRandomSong() {
    if (!$client) return;
    try {
      loading = true;
      error = null;
      const result = await $client.getRandomSongs(1);
      song = result.song?.[0] || null;
    } catch (e) {
      error = "Failed to load song";
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function togglePlay() {
    if (!song) return;
    if (isPlaying) {
      player.pause();
    } else if ($player.currentTrack?.id === song.id) {
      player.play();
    } else {
      const extraSongs = await $client?.getRandomSongs(23);
      player.setPlaylist([song, ...(extraSongs?.song ?? [])], 0);
    }
  }

  function onNext() {
    loadRandomSong();
  }

  function formatDuration(duration: number): string {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  onMount(() => {
    loadRandomSong();
  });
</script>

{#if loading}
  <div
    class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-surface/40 to-surface/95 p-12 backdrop-blur-2xl shadow-2xl border border-white/5"
  >
    <div class="flex flex-col md:flex-row gap-10">
      <div
        class="md:w-1/3 aspect-square bg-surface/30 rounded-2xl shadow-inner"
      ></div>
      <div class="md:w-2/3 space-y-8">
        <div class="h-10 bg-surface/30 rounded-xl w-3/4"></div>
        <div class="h-8 bg-surface/30 rounded-xl w-1/2"></div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {#each Array(4) as _}
            <div class="h-14 bg-surface/30 rounded-xl"></div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{:else if error}
  <div
    class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/5 to-surface/90 p-10 backdrop-blur-xl shadow-2xl"
  >
    <p class="text-text-secondary text-center text-lg">{error}</p>
    <button
      class="mt-6 px-8 py-3 bg-primary/15 hover:bg-primary/25 rounded-xl transition-all duration-300 mx-auto block font-medium hover:scale-105"
      on:click={loadRandomSong}
    >
      Retry
    </button>
  </div>
{:else if song}
  <div
    bind:this={containerRef}
    class="relative overflow-hidden rounded-3xl p-12 shadow-2xl border border-white/5 bg-gradient-to-br from-primary/10 via-surface/40 to-surface/95"
    in:fly={{ y: 30, duration: 800, easing: quintInOut }}
  >
    <div class="absolute inset-0 backdrop-blur-2xl"></div>

    <div class="relative z-10">
      <div class="flex flex-col md:flex-row gap-12">
        <div class="relative group md:w-1/3">
          <img
            src={song.coverArt}
            alt={song.title}
            class="w-full aspect-square object-cover rounded-3xl shadow-2xl transition-all duration-500 group-hover:scale-[1.02] group-hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] hover:rotate-1"
          />
          <div
            class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-3xl"
          ></div>
          <button
            class="absolute bottom-8 right-8 p-6 rounded-full bg-primary/90 backdrop-blur-sm text-background hover:scale-110 hover:bg-primary-light active:scale-95 transition-all duration-300 shadow-xl opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0"
            on:click={togglePlay}
          >
            {#if isPlaying}
              <Pause size={36} />
            {:else}
              <Play size={36} />
            {/if}
          </button>
        </div>

        <div class="md:w-2/3 space-y-10">
          <div class="flex justify-between items-start">
            <div class="space-y-6">
              <h2
                class="text-6xl font-bold leading-tight line-clamp-2 bg-gradient-to-br from-white via-white/90 to-primary/90 bg-clip-text text-transparent"
                in:blur={{ duration: 300, delay: 200 }}
              >
                {song.title}
              </h2>
              <div class="space-y-3">
                <a
                  href={`/artists/${song.artistId}`}
                  class="text-3xl font-medium text-text-secondary hover:text-primary transition-all inline-block hover:translate-x-2 duration-300"
                >
                  {song.artist}
                </a>
                <a
                  href={`/albums/${song.albumId}`}
                  class="block text-2xl text-text-secondary/60 hover:text-primary transition-all hover:translate-x-2 duration-300"
                >
                  {song.album}
                </a>
              </div>
            </div>
            <button
              class="p-5 rounded-full bg-surface/40 backdrop-blur-md text-text-primary hover:scale-110 hover:bg-surface/60 active:scale-95 transition-all duration-300 shadow-lg hover:rotate-12"
              on:click={onNext}
            >
              <SkipForward size={32} />
            </button>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {#each [{ label: "Duration", value: formatDuration(song.duration!), icon: Clock1 }, { label: "Bitrate", value: `${song.bitRate ?? "Unknown"} kbps`, icon: Gauge }, ...(song.year ? [{ label: "Year", value: song.year, icon: CalendarRange }] : []), ...(song.genre ? [{ label: "Genre", value: song.genre.toLowerCase(), icon: Music }] : [])] as item}
              <div
                class="space-y-3 p-6 rounded-2xl bg-surface/20 backdrop-blur-sm hover:bg-surface/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg border border-white/5"
              >
                <div
                  class="text-sm uppercase tracking-wider text-text-secondary/60 font-medium flex items-center gap-2"
                >
                  <svelte:component this={item.icon} size={16} />
                  {item.label}
                </div>
                <div class="font-semibold capitalize text-lg">{item.value}</div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
