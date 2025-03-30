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
    class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-surface/40 to-surface/95 p-4 sm:p-8 md:p-12 backdrop-blur-2xl shadow-2xl border border-white/5"
  >
    <div
      class="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.1)_0%,transparent_50%)]"
    ></div>
    <div class="flex flex-col md:flex-row gap-6 sm:gap-10 relative">
      <div
        class="w-2/3 mx-auto md:w-1/3 max-w-[250px] aspect-square bg-surface/30 rounded-2xl shadow-inner animate-pulse"
      ></div>
      <div class="md:w-2/3 space-y-6 sm:space-y-8">
        <div
          class="h-8 sm:h-10 bg-surface/30 rounded-xl w-3/4 animate-pulse"
        ></div>
        <div
          class="h-6 sm:h-8 bg-surface/30 rounded-xl w-1/2 animate-pulse"
        ></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {#each Array(4) as _}
            <div
              class="h-12 sm:h-14 bg-surface/30 rounded-xl animate-pulse"
            ></div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{:else if error}
  <div
    class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/5 to-surface/90 p-4 sm:p-8 md:p-10 backdrop-blur-xl shadow-2xl"
  >
    <div
      class="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,0,0,0.05)_0%,transparent_60%)]"
    ></div>
    <p class="text-text-secondary text-center text-lg relative">
      <span class="block mb-2 text-4xl">😢</span>
      {error}
    </p>
    <button
      class="mt-6 px-6 sm:px-8 py-2 sm:py-3 bg-primary/15 hover:bg-primary/25 rounded-xl transition-all duration-300 mx-auto block font-medium hover:scale-105 relative"
      on:click={loadRandomSong}
    >
      Retry
    </button>
  </div>
{:else if song}
  <div
    bind:this={containerRef}
    class="relative overflow-hidden rounded-3xl p-4 sm:p-8 md:p-12 shadow-2xl border border-white/5 bg-gradient-to-br from-primary/10 via-surface/40 to-surface/95"
    in:fly={{ y: 30, duration: 800, easing: quintInOut }}
  >
    <div class="absolute inset-0 backdrop-blur-2xl"></div>
    <div
      class="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1)_0%,transparent_60%)]"
    ></div>
    <div
      class="absolute -top-[250px] -right-[150px] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] opacity-70"
    ></div>

    <div class="relative z-10">
      <div class="flex flex-col md:flex-row gap-8 md:gap-10 lg:gap-14">
        <div class="md:w-1/3 flex flex-col items-center gap-6">
          <div
            class="relative group w-full max-w-[320px] min-w-[280px] mx-auto"
          >
            <div
              class="absolute -inset-1 rounded-[2rem] bg-gradient-to-br from-primary/20 via-primary/10 to-transparent blur-sm opacity-0 group-hover:opacity-100 transition-all duration-700"
            ></div>
            <img
              src={song.coverArt}
              alt={song.title}
              class="w-full aspect-square object-cover rounded-3xl shadow-2xl transition-all duration-500 group-hover:scale-[1.02] group-hover:shadow-[0_25px_80px_-15px_rgba(0,0,0,0.6)] group-hover:rotate-1 relative"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-3xl"
            ></div>
          </div>

          <div class="flex items-center justify-center gap-6 w-full">
            <button
              class="p-4 sm:p-5 rounded-full bg-gradient-to-br from-primary/80 to-primary backdrop-blur-sm text-background hover:scale-110 hover:from-primary hover:to-primary-light active:scale-95 transition-all duration-300 shadow-lg hover:shadow-primary/30 hover:shadow-xl group"
              on:click={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              <div
                class="transform transition-transform duration-500 ease-out group-hover:scale-110"
              >
                {#if isPlaying}
                  <Pause size={24} class="sm:w-7 sm:h-7" />
                {:else}
                  <Play size={24} class="sm:w-7 sm:h-7 relative left-[2px]" />
                {/if}
              </div>
            </button>

            <button
              class="p-3 sm:p-4 rounded-full bg-surface/40 backdrop-blur-md text-text-primary hover:scale-110 hover:bg-surface/60 active:scale-95 transition-all duration-300 shadow-lg hover:shadow-xl"
              on:click={onNext}
              aria-label="Skip to next song"
            >
              <SkipForward size={20} class="sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        <div class="md:w-2/3 space-y-5 sm:space-y-7 md:space-y-9">
          <div class="space-y-3 sm:space-y-5">
            <h2
              class="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight line-clamp-2 bg-gradient-to-br from-white via-white/90 to-primary-light bg-clip-text text-transparent drop-shadow-sm"
              in:blur={{ duration: 300, delay: 200 }}
            >
              {song.title}
            </h2>
            <div class="space-y-1 sm:space-y-2">
              <a
                href={`/artists/${song.artistId}`}
                class="text-lg sm:text-xl md:text-2xl font-medium text-text-secondary hover:text-primary transition-all inline-block hover:translate-x-2 duration-300 group"
              >
                <span
                  class="group-hover:bg-gradient-to-r group-hover:from-text-secondary group-hover:to-primary group-hover:bg-clip-text group-hover:text-transparent transition-all duration-500"
                  >{song.artist}</span
                >
              </a>
              <a
                href={`/albums/${song.albumId}`}
                class="block text-base sm:text-lg md:text-xl text-text-secondary/60 hover:text-primary transition-all hover:translate-x-2 duration-300 group"
              >
                <span
                  class="group-hover:bg-gradient-to-r group-hover:from-text-secondary/60 group-hover:to-primary/80 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-500"
                  >{song.album}</span
                >
              </a>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
            {#each [{ label: "Duration", value: formatDuration(song.duration!), icon: Clock1 }, { label: "Bitrate", value: `${song.bitRate ?? "Unknown"} kbps`, icon: Gauge }, ...(song.year ? [{ label: "Year", value: song.year, icon: CalendarRange }] : []), ...(song.genre ? [{ label: "Genre", value: song.genre.toLowerCase(), icon: Music }] : [])] as item, i}
              <div
                class="space-y-1 sm:space-y-2 p-4 sm:p-5 md:p-6 rounded-xl md:rounded-2xl bg-surface/20 backdrop-blur-sm hover:bg-surface/30 transition-all duration-500 hover:scale-[1.02] hover:shadow-lg border border-white/5 hover:border-white/10 group"
                in:fly={{
                  y: 20,
                  delay: 100 + i * 50,
                  duration: 600,
                  easing: quintInOut,
                }}
              >
                <div
                  class="text-xs uppercase tracking-wider text-text-secondary/60 group-hover:text-text-secondary/90 font-medium flex items-center gap-2 sm:gap-3 transition-all duration-500"
                >
                  <svelte:component
                    this={item.icon}
                    size={14}
                    class="sm:w-4 sm:h-4 opacity-60 group-hover:opacity-100 transition-all duration-500 group-hover:text-primary"
                  />
                  {item.label}
                </div>
                <div
                  class="font-semibold capitalize text-sm sm:text-base md:text-lg truncate group-hover:text-primary-light transition-all duration-500"
                >
                  {item.value}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
