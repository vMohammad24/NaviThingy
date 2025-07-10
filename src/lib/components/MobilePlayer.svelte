<script lang="ts">
  import { browser } from "$app/environment";
  import { formatTime } from "$lib/client/util";
  import { setupMediaSession } from "$lib/mediaSession";
  import { client } from "$lib/stores/client";
  import { player } from "$lib/stores/player";
  import type { SyncedLyric } from "$lib/types/navidrome";
  import {
    ChevronDown,
    ListMusic,
    Pause,
    Play,
    Repeat,
    Repeat1,
    Shuffle,
    SkipBack,
    SkipForward,
  } from "@lucide/svelte";
  import { cubicOut, quartInOut } from "svelte/easing";
  import { crossfade, fade, slide } from "svelte/transition";
  import Queue from "./Queue.svelte";

  let isFullscreen = $state(false);
  let progress = $state(0);
  let duration = $state(0);
  let isProgressDragging = $state(false);
  let dragProgress = $state(0);
  let progressInterval: number;
  let currentTrackId = $state<string | null>(null);
  let lyrics = $state<
    { synced: boolean; plain: string; lines: SyncedLyric[] } | undefined
  >();
  let currentLyricIndex = $state(-1);
  let lyricsContainer: HTMLDivElement | null = $state(null);
  let currentLyricElement: HTMLParagraphElement | null = $state(null);
  let showQueueInFullscreen = $state(false);
  let showLyrics = $state(false);
  let isFavorite = $state(false);

  let touchStartY = $state(0);
  let touchStartX = $state(0);
  let initialTranslateY = $state(0);
  let currentTranslateY = $state(0);
  let isDraggingPanel = $state(false);
  let swipeThreshold = 50;

  const animateProgressBar = true;

  const [send, receive] = crossfade({
    duration: 300,
    easing: quartInOut,
    fallback(node) {
      return {
        duration: 200,
        easing: cubicOut,
        css: (t) => `opacity: ${t}`,
      };
    },
  });

  $effect(() => {
    if ($player.currentTrack && $client && $player.isPlaying) {
      if (currentTrackId !== $player.currentTrack.id) {
        currentTrackId = $player.currentTrack.id;
        scrollToCurrentLyric();
      }
    }
  });

  $effect(() => {
    if ($player.currentTrack) {
      isFavorite = !!$player.currentTrack.starred;
    }
  });

  $effect(() => {
    if (isFullscreen && $player.currentTrack) {
      fetchLyrics();
    }
  });

  function handleProgressDragStart(e: TouchEvent) {
    isProgressDragging = true;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(e.touches[0].clientX - rect.left, rect.width),
    );
    const percentage = x / rect.width;
    dragProgress = percentage * duration;
    progress = dragProgress;
  }

  function handleProgressDragMove(e: TouchEvent) {
    if (!isProgressDragging) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(e.touches[0].clientX - rect.left, rect.width),
    );
    const percentage = x / rect.width;
    dragProgress = percentage * duration;
    progress = dragProgress;
  }

  function handleProgressDragEnd() {
    if (!isProgressDragging) return;
    isProgressDragging = false;
    if (duration) {
      player.seek(dragProgress);
      progress = dragProgress;
    }
  }

  function handleTouchStart(e: TouchEvent) {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    initialTranslateY = currentTranslateY;
    isDraggingPanel = true;
  }

  function handleTouchMove(e: TouchEvent) {
    if (isDraggingPanel) {
      const touchY = e.touches[0].clientY;
      const deltaY = touchY - touchStartY;
      currentTranslateY = Math.max(0, initialTranslateY + deltaY);
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (isDraggingPanel) {
      const touchEndY = e.changedTouches[0].clientY;
      const touchEndX = e.changedTouches[0].clientX;
      const deltaY = touchEndY - touchStartY;
      const deltaX = touchEndX - touchStartX;

      if (deltaY > swipeThreshold) {
        closeFullscreen();
      } else if (isFullscreen && Math.abs(deltaX) > swipeThreshold) {
        if (deltaX > 0) {
          player.previous();
        } else {
          player.next();
        }
      } else if (Math.abs(deltaY) < 10 && Math.abs(deltaX) < 10) {
        if (!isFullscreen) {
          openFullscreen();
        }
      }

      isDraggingPanel = false;
      currentTranslateY = 0;
    }
  }

  function openFullscreen() {
    isFullscreen = true;
    fetchLyrics();
  }

  function closeFullscreen() {
    isFullscreen = false;
    showQueueInFullscreen = false;
  }

  function toggleFullscreen() {
    if (isFullscreen) {
      closeFullscreen();
    } else {
      openFullscreen();
    }
  }

  function toggleQueue() {
    showQueueInFullscreen = !showQueueInFullscreen;
  }

  async function toggleFavorite() {
    if (!$player.currentTrack || !$client) return;

    if (isFavorite) {
      await $client.unstar($player.currentTrack.id, "track");
      $player.currentTrack.starred = undefined;
    } else {
      await $client.star($player.currentTrack.id, "track");
      $player.currentTrack.starred = new Date();
    }

    isFavorite = !isFavorite;
  }

  async function fetchLyrics() {
    if ($client && $player.currentTrack) {
      lyrics = await $client.getLyrics($player.currentTrack);
      currentLyricIndex = -1;
      scrollToCurrentLyric();
    }
  }

  function updateCurrentLyric() {
    if (!lyrics?.synced) return;

    const newIndex = lyrics.lines.findIndex((line, i) => {
      const nextTime = lyrics!.lines[i + 1]?.time ?? Infinity;
      return progress >= line.time && progress < nextTime;
    });

    if (newIndex !== -1 && newIndex !== currentLyricIndex) {
      currentLyricIndex = newIndex;
      scrollToCurrentLyric();
    }
  }

  function scrollToCurrentLyric() {
    if (!lyricsContainer || !lyrics?.lines?.length) return;

    setTimeout(() => {
      try {
        const elements = lyricsContainer?.querySelectorAll("p");
        if (
          currentLyricIndex >= 0 &&
          elements &&
          elements.length > currentLyricIndex
        ) {
          currentLyricElement = elements[
            currentLyricIndex
          ] as HTMLParagraphElement;

          if (currentLyricElement && lyricsContainer) {
            const containerHeight = lyricsContainer.clientHeight;
            const lyricTop = currentLyricElement.offsetTop;
            const lyricHeight = currentLyricElement.clientHeight;

            lyricsContainer.scrollTo({
              top: lyricTop - containerHeight / 2 + lyricHeight / 2,
              behavior: "smooth",
            });
          }
        }
      } catch (error) {
        console.warn("Failed to scroll to current lyric:", error);
      }
    }, 100);
  }

  function seekToLyric(time: number) {
    if ($player) {
      player.seek(time);
    }
  }

  function startProgressTracking() {
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = window.setInterval(() => {
      if (!isProgressDragging) {
        progress = player.getProgress();
        duration = player.getDuration();
      }
      updateCurrentLyric();
    }, 16);
  }

  $effect(() => {
    if (browser) {
      setupMediaSession();
      startProgressTracking();
    }

    return () => {
      if (progressInterval) clearInterval(progressInterval);
    };
  });
</script>

{#if $player.currentTrack}
  {#if isFullscreen}
    <div class="fixed inset-0 z-40" transition:fade={{ duration: 200 }}>
      <div
        class="absolute inset-0 bg-cover bg-center"
        style="background-image: url('{$player.currentTrack.coverArt}');"
      ></div>
      <div
        class="absolute inset-0 bg-gradient-to-b from-black/80 to-black/70 backdrop-blur-lg"
      ></div>

      <div
        class="absolute inset-0 bg-gradient-radial from-accent/5 via-transparent to-transparent opacity-30"
      ></div>
    </div>
  {/if}

  <div
    class={`fixed left-0 right-0 z-50 ${
      isFullscreen
        ? "bottom-full opacity-0 pointer-events-none"
        : "bottom-0 opacity-100"
    } transition-all duration-300 ease-out`}
    style={isDraggingPanel && !isFullscreen
      ? `transform: translateY(${currentTranslateY}px)`
      : ""}
  >
    <button
      class="absolute -top-8 right-3 p-1.5 rounded-t-lg bg-surface/90 text-white/70 hover:text-white/90 active:bg-white/10 transition-colors"
      onclick={() => player.stop()}
      aria-label="Close player"
    >
      <ChevronDown size={16} />
    </button>

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute inset-0 z-0"
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
      onclick={openFullscreen}
    ></div>

    <div
      class="bg-surface/95 backdrop-blur-md border-t border-white/5 shadow-up relative z-10"
    >
      {#if duration > 0}
        <div class="relative h-[3px] bg-white/5">
          <!-- Larger touch target area for better mobile interaction -->
          <div
            class="absolute inset-0 w-full h-8 -top-3"
            ontouchstart={handleProgressDragStart}
            ontouchmove={handleProgressDragMove}
            ontouchend={handleProgressDragEnd}
          ></div>

          <!-- Progress bar fill element with gradient instead of knob -->
          <div
            class="absolute inset-y-0 left-0 bg-gradient-to-r from-accent to-accent/80 transition-all {isProgressDragging
              ? 'duration-0'
              : animateProgressBar
                ? 'duration-75'
                : 'duration-300'} ease-linear"
            style="width: {(progress / duration) * 100}%"
          ></div>
        </div>
      {/if}

      <div class="flex items-center p-3.5 px-4">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="flex items-center gap-4 flex-1 min-w-0"
          onclick={openFullscreen}
        >
          <div class="relative h-12 w-12 rounded-lg overflow-hidden shadow-md">
            <img
              src={$player.currentTrack.coverArt}
              alt="Album cover"
              class="h-full w-full object-cover"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"
            ></div>
          </div>

          <div class="flex-1 min-w-0 py-0.5">
            <p class="text-sm font-semibold truncate text-white/95 mb-0.5">
              {$player.currentTrack.title}
            </p>
            <p class="text-xs truncate text-white/70">
              {$player.currentTrack.artist}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            class="p-2 rounded-full text-white/70 hover:text-white/90 active:bg-white/10 transition-colors"
            onclick={() => player.previous()}
            aria-label="Previous track"
          >
            <SkipBack size={20} />
          </button>

          <button
            class="p-2.5 rounded-full bg-accent text-white/80 hover:text-white active:bg-accent/80 transition-colors shadow-sm"
            onclick={() => player.togglePlay()}
            aria-label={$player.isPlaying ? "Pause" : "Play"}
          >
            {#if $player.isPlaying}
              <Pause size={20} />
            {:else}
              <Play size={20} class="ml-0.5" />
            {/if}
          </button>

          <button
            class="p-2 rounded-full text-white/70 hover:text-white/90 active:bg-white/10 transition-colors"
            onclick={() => player.next()}
            aria-label="Next track"
          >
            <SkipForward size={20} />
          </button>
        </div>
      </div>
    </div>
  </div>

  {#if isFullscreen}
    <div
      class="fixed inset-0 z-50 flex flex-col"
      transition:fade={{ duration: 300 }}
    >
      <div class="pt-safe sticky top-0 z-10">
        <div class="flex items-center justify-between p-4">
          <button
            class="p-2 rounded-full bg-black/20 backdrop-blur-md hover:bg-black/30 active:bg-black/40 transition"
            onclick={closeFullscreen}
            aria-label="Close player"
          >
            <ChevronDown size={20} class="stroke-white/90" />
          </button>

          <div class="text-center">
            <h2
              class="text-sm font-medium uppercase tracking-wider text-white/80"
            >
              Now Playing
            </h2>
          </div>

          <button
            class={`p-2 rounded-full backdrop-blur-md transition ${
              showQueueInFullscreen
                ? "bg-accent text-black"
                : "bg-black/20 hover:bg-black/30 active:bg-black/40"
            }`}
            onclick={toggleQueue}
            aria-label="Toggle queue"
          >
            <ListMusic size={18} />
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-hidden">
        {#if showQueueInFullscreen}
          <div class="h-full">
            <Queue minimal={true} />
          </div>
        {:else}
          <div class="flex flex-col h-full p-4 pt-0">
            <div class="flex-1 flex items-center justify-center">
              <div
                class="w-full max-w-xs"
                in:fade={{ duration: 200, delay: 100 }}
              >
                <div
                  class="relative w-full aspect-square rounded-xl overflow-hidden shadow-2xl"
                >
                  <img
                    src={$player.currentTrack.coverArt}
                    alt={$player.currentTrack.title}
                    class="w-full h-full object-cover"
                  />
                  <div
                    class="absolute inset-0 ring-1 ring-white/20 rounded-xl"
                  ></div>
                </div>
              </div>
            </div>

            <div class="mt-6 mb-4" in:fade={{ duration: 200, delay: 200 }}>
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <h1
                    class="text-xl font-bold text-white leading-tight truncate"
                  >
                    {$player.currentTrack.title}
                  </h1>
                  <div class="flex items-center mt-1">
                    <a
                      href={$player.currentTrack
                        ? `/artists/${$player.currentTrack.artistId}`
                        : "#"}
                      class="text-base text-white/80 hover:text-white transition truncate"
                      onclick={() => {
                        closeFullscreen();
                        if ($player.currentTrack) {
                          const artistId = $player.currentTrack.artistId;
                          setTimeout(
                            () =>
                              (window.location.href = `/artists/${artistId}`),
                            100,
                          );
                        }
                      }}
                    >
                      {$player.currentTrack.artist}
                    </a>
                    {#if $player.currentTrack.album}
                      <span class="mx-2 text-white/40">•</span>
                      <a
                        href={$player.currentTrack
                          ? `/albums/${$player.currentTrack.albumId}`
                          : "#"}
                        class="text-sm text-white/70 hover:text-white/90 transition truncate"
                        onclick={() => {
                          closeFullscreen();
                          if ($player.currentTrack) {
                            const albumId = $player.currentTrack.albumId;
                            setTimeout(
                              () =>
                                (window.location.href = `/albums/${albumId}`),
                              100,
                            );
                          }
                        }}
                      >
                        {$player.currentTrack.album}
                      </a>
                    {/if}
                  </div>
                </div>
              </div>
            </div>

            {#if duration > 0}
              <div class="mt-2" in:fade={{ duration: 200, delay: 300 }}>
                <div
                  class="relative h-1 bg-white/10 rounded-full overflow-hidden"
                  ontouchstart={handleProgressDragStart}
                  ontouchmove={handleProgressDragMove}
                  ontouchend={handleProgressDragEnd}
                >
                  <div
                    class="absolute inset-y-0 left-0 bg-accent transition-all {isProgressDragging
                      ? ''
                      : animateProgressBar
                        ? 'duration-75'
                        : 'duration-300'} ease-linear rounded-full"
                    style:width="{(progress / duration) * 100}%"
                  >
                    <div
                      class="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow-sm"
                    ></div>
                  </div>
                </div>
                <div class="flex justify-between mt-2 text-xs text-white/60">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            {/if}

            <div class="mt-6 mb-6" in:fade={{ duration: 200, delay: 400 }}>
              <div class="flex items-center justify-between mb-4">
                <button
                  class={`p-2 rounded-full transition ${
                    $player.shuffle
                      ? "text-accent"
                      : "text-white/60 hover:text-white/80"
                  }`}
                  onclick={() => player.toggleShuffle()}
                  aria-label="Toggle shuffle"
                >
                  <Shuffle size={20} />
                </button>

                <button
                  class={`p-2 rounded-full transition ${
                    $player.repeat !== "none"
                      ? "text-accent"
                      : "text-white/60 hover:text-white/80"
                  }`}
                  onclick={() => player.toggleRepeat()}
                  aria-label="Toggle repeat"
                >
                  {#if $player.repeat === "one"}
                    <Repeat1 size={20} />
                  {:else}
                    <Repeat size={20} />
                  {/if}
                </button>
              </div>

              <div class="flex items-center justify-center gap-8">
                <button
                  class="p-3 rounded-full text-white/80 hover:text-white active:bg-white/10 transition"
                  onclick={() => player.previous()}
                  aria-label="Previous track"
                >
                  <SkipBack size={28} />
                </button>

                <button
                  class="p-4 rounded-full bg-accent text-white/80 hover:text-white active:bg-accent/80 transition shadow-lg"
                  onclick={() => player.togglePlay()}
                  aria-label={$player.isPlaying ? "Pause" : "Play"}
                >
                  {#if $player.isPlaying}
                    <Pause size={32} />
                  {:else}
                    <Play size={32} class="ml-1" />
                  {/if}
                </button>

                <button
                  class="p-3 rounded-full text-white/80 hover:text-white active:bg-white/10 transition"
                  onclick={() => player.next()}
                  aria-label="Next track"
                >
                  <SkipForward size={28} />
                </button>
              </div>
            </div>

            {#if lyrics}
              <div class="mt-auto mb-4 w-full">
                <button
                  class="w-full py-3.5 px-4 flex items-center justify-center gap-2 text-sm font-medium rounded-xl bg-accent/10 hover:bg-accent/15 active:bg-accent/20 transition-colors text-accent border border-accent/20"
                  onclick={() => (showLyrics = !showLyrics)}
                >
                  <span class="tracking-wide">
                    {showLyrics ? "HIDE LYRICS" : "VIEW LYRICS"}
                  </span>
                  <span
                    class="transform transition-transform duration-300"
                    class:rotate-180={showLyrics}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </span>
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      {#if !showQueueInFullscreen && lyrics && showLyrics}
        <div
          class="fixed inset-x-0 bottom-0 top-auto z-50 bg-black/60 backdrop-blur-xl border-t border-white/10 pb-safe transition-all duration-300"
          style="height: {showLyrics ? '60vh' : '0'}"
          transition:slide={{ duration: 400, easing: cubicOut }}
        >
          <div class="w-full flex justify-center py-2 touch-none">
            <div class="w-10 h-1 bg-white/20 rounded-full"></div>
          </div>

          <div
            class="px-6 py-2 flex items-center justify-between border-b border-white/10"
          >
            <h3
              class="text-base font-medium text-white/90 uppercase tracking-wider"
            >
              Lyrics
            </h3>
            <button
              class="p-2 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors"
              onclick={() => (showLyrics = !showLyrics)}
              aria-label="Close lyrics"
            >
              <ChevronDown size={18} class="text-white/70" />
            </button>
          </div>

          <div
            class="h-[calc(60vh-78px)] overflow-y-auto px-6 py-4 scrollbar-thin"
            bind:this={lyricsContainer}
          >
            {#if lyrics}
              {#if lyrics.synced}
                <div class="flex flex-col">
                  {#each lyrics.lines as line, i}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                    <p
                      class={`py-2.5 text-base transition-all duration-300 ${
                        i === currentLyricIndex
                          ? "bg-accent/10 px-4 py-3 rounded-lg text-accent font-medium text-lg"
                          : "text-white/70 hover:text-white/90"
                      }`}
                      onclick={() => seekToLyric(line.time)}
                      style="transition: transform 0.2s ease-out; transform: scale({i ===
                      currentLyricIndex
                        ? 1.02
                        : 1})"
                    >
                      {line.text}
                    </p>
                  {/each}
                </div>
              {:else if lyrics.plain}
                <div class="px-2">
                  <p
                    class="text-base text-white/80 whitespace-pre-wrap leading-relaxed"
                  >
                    {lyrics.plain}
                  </p>
                </div>
              {:else}
                <div class="flex flex-col items-center justify-center h-full">
                  <div class="bg-white/5 rounded-xl p-8 text-center">
                    <p class="text-white/60 mb-2">No lyrics found</p>
                    <p class="text-xs text-white/40">
                      Try searching online for lyrics to "{$player.currentTrack
                        .title}"
                    </p>
                  </div>
                </div>
              {/if}
            {:else}
              <div class="flex flex-col items-center justify-center h-full">
                <div class="animate-pulse flex flex-col items-center">
                  <div class="h-2 w-20 bg-white/20 rounded mb-3"></div>
                  <div class="h-2 w-32 bg-white/20 rounded mb-3"></div>
                  <div class="h-2 w-24 bg-white/20 rounded mb-3"></div>
                  <div class="h-2 w-28 bg-white/20 rounded"></div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}
{/if}

<style>
  .bg-gradient-radial {
    background-image: radial-gradient(circle, var(--tw-gradient-stops));
  }

  .shadow-up {
    box-shadow: 0 -8px 20px rgba(0, 0, 0, 0.15);
  }

  .scrollbar-thin::-webkit-scrollbar {
    width: 4px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
</style>
