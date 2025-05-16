<script lang="ts">
  import { setupMediaSession } from "$lib/mediaSession";
  import { client } from "$lib/stores/client";
  import { player } from "$lib/stores/player";
  import { queueActions } from "$lib/stores/queueStore";
  import { sidebarHidden } from "$lib/stores/sidebarOpen";
  import type { SyncedLyric } from "$lib/types/navidrome";
  import {
    Heart,
    ListMusic,
    Maximize2,
    Pause,
    Play,
    Repeat,
    Repeat1,
    Shuffle,
    SkipBack,
    SkipForward,
    Volume,
    Volume1,
    Volume2,
    VolumeX,
  } from "lucide-svelte";
  import { onMount } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fade, fly, scale, slide } from "svelte/transition";
  import Queue from "./Queue.svelte";
  import Rating from "./Rating.svelte";

  let progress = 0;
  let duration = 0;
  let volume = player.getVolume();
  let previousVolume = volume;
  let showVolume = false;
  let volumeTimeout: ReturnType<typeof setTimeout> | undefined;
  let currentTrackId: string | null = null;
  let hoveredTime = 0;
  let isHovering = false;
  let tooltipX = 0;
  let isFullscreen = false;
  let lyrics:
    | { synced: boolean; plain: string; lines: SyncedLyric[] }
    | undefined;
  let currentLyricIndex = -1;
  let lyricsContainer: HTMLDivElement;
  let currentLyricElement: HTMLParagraphElement | null = null;
  let progressInterval: number;
  let isDragging = false;
  let dragProgress = 0;
  let lastFetchedLyricsId: string | null = null;

  const transactionDuration = 600;
  const bgTransitionDuration = 700;
  const containerDelay = 100;
  const contentDelay = 250;

  $: {
    if ($player.currentTrack) {
      const newTrackId = $player.currentTrack.id;
      if (currentTrackId !== newTrackId) {
        currentTrackId = newTrackId;
        lyrics = undefined;
        currentLyricIndex = -1;
      }
      if (
        isFullscreen &&
        $client &&
        $player.currentTrack.id &&
        $player.currentTrack.id !== lastFetchedLyricsId
      ) {
        (async () => {
          lyrics = await $client.getLyrics($player.currentTrack!);
          lastFetchedLyricsId = $player.currentTrack?.id || null;
          currentLyricIndex = -1;
          updateCurrentLyric();
          scrollToCurrentLyric();
        })();
      } else if (
        isFullscreen &&
        lyrics &&
        currentTrackId === lastFetchedLyricsId
      ) {
        scrollToCurrentLyric();
      }
    } else {
      currentTrackId = null;
      lyrics = undefined;
      currentLyricIndex = -1;
      lastFetchedLyricsId = null;
    }
  }

  function updateVolume(value: number) {
    volume = Math.max(0, Math.min(1, value));
    player.setVolume(volume);
  }

  function toggleMute() {
    if (volume === 0) {
      updateVolume(previousVolume || 1);
    } else {
      previousVolume = volume;
      updateVolume(0);
    }
  }

  function getVolumeIcon() {
    if (volume === 0) return VolumeX;
    if (volume < 0.3) return Volume;
    if (volume < 0.7) return Volume1;
    return Volume2;
  }

  function handleVolumeScroll(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    updateVolume(volume + delta);
    showVolume = true;
    resetVolumeTimeout();
  }

  function handleVolumeChange(e: Event) {
    const value = +(e.target as HTMLInputElement).value;
    updateVolume(value);
  }

  function resetVolumeTimeout() {
    if (volumeTimeout) clearTimeout(volumeTimeout);
    volumeTimeout = setTimeout(() => {
      showVolume = false;
    }, 300);
  }

  function handleVolumeHover() {
    showVolume = true;
    if (volumeTimeout) clearTimeout(volumeTimeout);
  }

  function handleVolumeLeave() {
    resetVolumeTimeout();
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  async function toggleFullscreen() {
    setTimeout(() => {
      isFullscreen = !isFullscreen;
      sidebarHidden.set(isFullscreen);
      if (
        isFullscreen &&
        lyrics &&
        $player.currentTrack &&
        $player.currentTrack.id === lastFetchedLyricsId
      ) {
        scrollToCurrentLyric();
      }
      updateCurrentLyric();
    }, 50);
  }
  function updateCurrentLyric() {
    if (!lyrics?.synced || !lyrics.lines.length) {
      currentLyricIndex = -1;
      return;
    }

    const newIndex = lyrics.lines.findIndex((line, i) => {
      const nextTime = lyrics!.lines[i + 1]?.time ?? Infinity;
      return progress >= line.time && progress < nextTime;
    });

    if (newIndex !== currentLyricIndex) {
      currentLyricIndex = newIndex;
    }
  }

  function scrollToCurrentLyric() {
    if (
      !lyricsContainer ||
      !lyrics?.lines?.length ||
      currentLyricIndex < 0 ||
      !currentLyricElement
    ) {
      return;
    }
    setTimeout(() => {
      try {
        if (currentLyricElement) {
          const containerHeight = lyricsContainer.clientHeight;
          const lyricTop = currentLyricElement.offsetTop;
          const lyricHeight = currentLyricElement.clientHeight;

          lyricsContainer.scrollTo({
            top: lyricTop - containerHeight / 2 + lyricHeight / 2,
            behavior: "smooth",
          });
        }
      } catch (error) {
        console.warn("Failed to scroll to current lyric:", error);
      }
    }, 0);
  }

  $: if (currentLyricIndex !== -1 && lyrics?.lines?.length) {
    scrollToCurrentLyric();
  }

  onMount(() => {
    setupMediaSession();
    startProgressTracking();

    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleProgressMouseUp();
      }
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      if (progressInterval) clearInterval(progressInterval);
      if (volumeTimeout) clearTimeout(volumeTimeout);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  });

  function startProgressTracking() {
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = window.setInterval(() => {
      if (!isDragging) {
        progress = player.getProgress();
        duration = player.getDuration();
      }
      updateCurrentLyric();
    }, 16); // 60fps $$$$
  }

  function handleProgressMouseDown(e: MouseEvent) {
    isDragging = true;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    dragProgress = percentage * duration;
    progress = dragProgress;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && isFullscreen) {
      toggleFullscreen();
    }
    if (document.activeElement instanceof HTMLInputElement) return;
    if (e.key === " ") {
      e.preventDefault();
      player.togglePlay();
    }
    if (e.key === "F11" || (e.key === "f" && e.ctrlKey)) {
      e.preventDefault();
      toggleFullscreen();
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      player.next();
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      player.previous();
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      updateVolume(volume + 0.05);
      showVolume = true;
      resetVolumeTimeout();
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      updateVolume(volume - 0.05);
      showVolume = true;
      resetVolumeTimeout();
    }

    if (e.key === "m") {
      e.preventDefault();
      toggleMute();
    }

    if (e.key === "r") {
      e.preventDefault();
      player.toggleRepeat();
    }

    if (e.key === "s") {
      e.preventDefault();
      player.toggleShuffle();
    }

    if (e.key === "q") {
      e.preventDefault();
      queueActions.toggle();
    }
  }

  function handleProgressMouseUp() {
    isDragging = false;
    if (duration) {
      player.seek(dragProgress);
    }
  }

  function handleProgressMove(e: MouseEvent) {
    if (!isDragging && !isHovering) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    tooltipX = x;

    if (isDragging) {
      dragProgress = percentage * duration;
      progress = dragProgress;
    } else {
      hoveredTime = percentage * duration;
    }
  }

  function toggleFavorite() {
    if (!$player.currentTrack || !$client) return;

    const trackId = $player.currentTrack.id;
    const isCurrentlyStarred = !!$player.currentTrack.starred;

    if (isCurrentlyStarred) {
      $client.unstar(trackId, "track");
    } else {
      $client.star(trackId, "track");
    }

    // sometimes i hate svelte
    player.update((p) => {
      if (p.currentTrack && p.currentTrack.id === trackId) {
        return {
          ...p,
          currentTrack: {
            ...p.currentTrack,
            starred: isCurrentlyStarred ? undefined : new Date(),
          },
        };
      }
      return p;
    });
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $player.currentTrack}
  {#if isFullscreen}
    <div
      class="fixed inset-0 bg-cover bg-center bg-no-repeat z-20"
      style="background-image: url('{$player.currentTrack.coverArt}');"
      transition:fade={{ duration: bgTransitionDuration, easing: cubicOut }}
    >
      <div
        class="absolute inset-0 bg-gradient-to-b from-black/70 to-black/60 backdrop-blur-sm"
        transition:fade={{ duration: bgTransitionDuration + 200 }}
      ></div>
    </div>
  {/if}

  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class={`fixed z-30 border-primary/20 p-4 ${
      isFullscreen ? "top-0 h-screen" : "bottom-0"
    } left-0 right-0 ${
      isFullscreen ? "backdrop-blur-2xl" : "backdrop-blur-md border-t"
    }`}
    transition:slide={{
      duration: transactionDuration,
      easing: cubicOut,
      axis: "y",
      delay: containerDelay,
    }}
  >
    {#if duration > 0}
      <div
        class="absolute top-0 left-0 right-0"
        transition:fade={{ duration: 300, delay: isFullscreen ? 300 : 0 }}
      >
        <div
          class="relative group"
          on:mousedown={handleProgressMouseDown}
          on:mouseup={handleProgressMouseUp}
          on:mousemove={handleProgressMove}
          on:mouseleave={() => {
            isHovering = false;
            if (isDragging) handleProgressMouseUp();
          }}
          on:mouseenter={() => (isHovering = true)}
        >
          <div
            class="h-1 bg-primary/20 cursor-pointer transition-all duration-300 group-hover:h-2"
          >
            <div
              class="absolute h-full bg-primary transition-all duration-300 ease-in-out rounded-full"
              style:width="{(progress / duration) * 100}%"
            >
              <div
                class="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full scale-0 group-hover:scale-100 transition-transform duration-200 shadow-lg"
              ></div>
            </div>
            {#if isHovering}
              <div
                class="absolute h-full bg-primary/30 transition-[width] duration-75 ease-linear"
                style:width="{((isDragging ? progress : hoveredTime) /
                  duration) *
                  100}%"
              ></div>
              <div
                class="absolute bottom-full py-1 px-2 rounded bg-surface shadow-lg text-xs transform -translate-x-1/2 mb-2 pointer-events-none"
                style="left: {tooltipX}px"
              >
                {formatTime(isDragging ? progress : hoveredTime)}
              </div>
            {/if}
          </div>
        </div>
        <div class="flex justify-between px-4 text-xs text-text-secondary mt-1">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    {/if}

    <div class="container mx-auto h-full">
      {#if isFullscreen}
        <div
          class="h-full flex flex-col gap-4 p-4 bg-surface/40 rounded-lg shadow-2xl"
          in:fly={{
            y: 40,
            duration: transactionDuration,
            delay: contentDelay,
            easing: cubicOut,
          }}
          out:fly={{
            y: 40,
            duration: transactionDuration * 0.6,
            easing: cubicOut,
          }}
        >
          <div
            class="w-full flex items-center gap-4 p-4 bg-surface/50 rounded-lg"
            in:fly={{
              y: 20,
              duration: transactionDuration,
              delay: contentDelay + 100,
              easing: cubicOut,
            }}
            out:fly={{ y: 10, duration: transactionDuration * 0.5 }}
          >
            <div class="relative">
              <!-- Add a container for better animation coordination -->
              <div
                class="w-24 h-24 rounded-lg shadow-xl overflow-hidden"
                in:scale={{
                  start: 0.9,
                  duration: transactionDuration,
                  delay: contentDelay,
                  easing: cubicOut,
                }}
              >
                <img
                  src={$player.currentTrack.coverArt}
                  alt={$player.currentTrack.title}
                  class="w-full h-full object-cover transform transition-all duration-500 hover:scale-105 hover:rotate-2"
                />
              </div>
            </div>

            <div class="flex flex-col flex-1">
              <div class="flex items-center gap-2">
                <a
                  class="text-2xl font-bold text-text-secondary hover:text-primary"
                  href="/songs/{$player.currentTrack.id}"
                  on:click={toggleFullscreen}>{$player.currentTrack.title}</a
                >
                {#key $player.currentTrack.id}
                  {#key $player.currentTrack.starred}
                    <button
                      class="p-1 hover:scale-110 transition-transform text-primary"
                      on:click={toggleFavorite}
                      aria-label={$player.currentTrack.starred
                        ? "Remove from favorites"
                        : "Add to favorites"}
                    >
                      {#if $player.currentTrack.starred}
                        <Heart size={20} class="animate-pulse-slow" />
                      {:else}
                        <Heart size={20} class="opacity-60" />
                      {/if}
                    </button>
                  {/key}
                {/key}
              </div>
              <a
                class="text-xl text-text-secondary hover:text-primary"
                href="/artists/{$player.currentTrack.artistId}"
                on:click={toggleFullscreen}>{$player.currentTrack.artist}</a
              >
              {#if $player.currentTrack.album}
                <a
                  class="text-lg text-text-secondary hover:text-primary mt-1"
                  href="/albums/{$player.currentTrack.albumId}"
                  on:click={toggleFullscreen}>{$player.currentTrack.album}</a
                >
              {/if}
            </div>
            <div
              class="flex items-center"
              in:fly={{ x: 20, duration: transactionDuration, delay: 600 }}
            >
              {#key $player.currentTrack.id}
                <Rating
                  id={$player.currentTrack.id}
                  rating={$player.currentTrack.userRating ?? 0}
                />
              {/key}
            </div>
          </div>

          <div class="flex-1 flex gap-4 min-h-0">
            <div
              class="flex-1 bg-surface/50 rounded-lg overflow-hidden flex flex-col"
              in:fly={{ x: -30, duration: transactionDuration, delay: 600 }}
              out:fly={{ x: -30, duration: 300 }}
            >
              <h3 class="text-lg font-semibold p-4 border-b border-primary/20">
                Lyrics
              </h3>
              <div
                class="flex-1 overflow-y-auto p-4 scrollbar-none"
                bind:this={lyricsContainer}
              >
                {#if lyrics}
                  {#if lyrics.synced}
                    <div class="flex flex-col gap-4">
                      {#each lyrics.lines as line, i}
                        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                        {#if i === currentLyricIndex}
                          <p
                            class={`text-2xl transition-all duration-300 whitespace-pre-wrap cursor-pointer hover:text-primary ${
                              i === currentLyricIndex
                                ? "bg-primary/10 p-4 rounded-lg"
                                : "hover:bg-primary/5 p-4 rounded-lg"
                            }`}
                            class:text-primary={i === currentLyricIndex}
                            class:opacity-50={i !== currentLyricIndex}
                            bind:this={currentLyricElement}
                            on:click={() => player.seek(line.time)}
                            in:scale={{
                              start: 0.95,
                              duration: 300,
                            }}
                          >
                            {line.text}
                          </p>
                        {:else}
                          <p
                            class={`text-xl transition-all duration-300 whitespace-pre-wrap cursor-pointer hover:text-primary ${
                              i === currentLyricIndex
                                ? "bg-primary/10 p-4 rounded-lg"
                                : "hover:bg-primary/5 p-4 rounded-lg"
                            }`}
                            class:text-primary={i === currentLyricIndex}
                            class:opacity-50={i !== currentLyricIndex}
                            on:click={() => player.seek(line.time)}
                          >
                            {line.text}
                          </p>
                        {/if}
                      {/each}
                    </div>
                  {:else}
                    <p
                      class="text-xl whitespace-pre-wrap p-4"
                      in:fade={{ duration: 500, delay: 700 }}
                    >
                      {lyrics.plain}
                    </p>
                  {/if}
                {:else}
                  <div
                    class="h-full flex flex-col items-center justify-center text-text-secondary"
                    in:fade={{ duration: 500, delay: 600 }}
                  >
                    <p class="text-xl mb-2">No lyrics available</p>
                    <p class="text-sm opacity-75">
                      Try searching online for "{$player.currentTrack.title} by {$player
                        .currentTrack.artist}" lyrics
                    </p>
                  </div>
                {/if}
              </div>
            </div>

            <div
              class="w-96 bg-surface/50 rounded-lg overflow-hidden flex flex-col"
              in:fly={{ x: 30, duration: 500, delay: 700 }}
              out:fly={{ x: 30, duration: 300 }}
            >
              <Queue minimal={true} />
            </div>
          </div>

          <div
            class="w-full p-4 bg-surface/50 rounded-lg flex justify-center"
            in:fly={{ y: 30, duration: 500, delay: 800 }}
            out:fly={{ y: 30, duration: 300 }}
          >
            <div class="flex items-center gap-6">
              <button
                class={`p-2 rounded-full hover:bg-primary/20 transition-colors ${
                  $player.shuffle ? "text-primary" : ""
                }`}
                on:click={() => player.toggleShuffle()}
              >
                <Shuffle size={24} />
              </button>

              <button
                class="p-2 rounded-full hover:bg-primary/20 transition-colors"
                on:click={() => player.previous()}
              >
                <SkipBack size={32} />
              </button>

              <button
                class="p-4 rounded-full bg-primary text-background hover:opacity-90 transition-all hover:scale-105 active:scale-95"
                on:click={() => player.togglePlay()}
              >
                {#if $player.isPlaying}
                  <Pause size={40} />
                {:else}
                  <Play size={40} />
                {/if}
              </button>

              <button
                class="p-2 rounded-full hover:bg-primary/20 transition-colors"
                on:click={() => player.next()}
              >
                <SkipForward size={32} />
              </button>

              <button
                class={`p-2 rounded-full hover:bg-primary/20 transition-colors ${
                  $player.repeat !== "none" ? "text-primary" : ""
                }`}
                on:click={() => player.toggleRepeat()}
              >
                {#if $player.repeat === "one"}
                  <Repeat1 size={24} />
                {:else}
                  <Repeat size={24} />
                {/if}
              </button>
            </div>
          </div>
        </div>
      {:else}
        <div
          class="flex items-center justify-between mt-4"
          in:fly={{
            y: 20,
            duration: transactionDuration * 0.6,
            easing: cubicOut,
          }}
          out:fly={{ y: 20, duration: transactionDuration * 0.5, delay: 100 }}
        >
          <div class="flex items-center gap-4">
            {#if $player.currentTrack}
              <div class="relative">
                <img
                  src={$player.currentTrack.coverArt}
                  alt={$player.currentTrack.title}
                  class="w-12 h-12 rounded shadow-lg transition-transform hover:scale-105"
                  in:scale={{
                    start: 0.9,
                    duration: transactionDuration * 0.7,
                    easing: cubicOut,
                  }}
                />
              </div>
              <div class="min-w-0 flex flex-col">
                <div class="flex items-center gap-2">
                  <a
                    class="font-medium truncate"
                    href="/songs/{$player.currentTrack.id}"
                    >{$player.currentTrack.title}</a
                  >
                  {#key $player.currentTrack.id}
                    {#key $player.currentTrack.starred}
                      <button
                        class="p-1 hover:scale-110 transition-transform text-primary"
                        on:click={toggleFavorite}
                        aria-label={$player.currentTrack.starred
                          ? "Remove from favorites"
                          : "Add to favorites"}
                      >
                        {#if $player.currentTrack.starred}
                          <Heart
                            size={16}
                            fill="red"
                            class="animate-pulse-slow"
                          />
                        {:else}
                          <Heart size={16} class="opacity-60" />
                        {/if}
                      </button>
                    {/key}
                  {/key}
                </div>
                <a
                  class="text-sm text-text-secondary truncate"
                  href="/artists/{$player.currentTrack.artistId}"
                  >{$player.currentTrack.artist}</a
                >
              </div>
            {/if}
          </div>

          <div class="flex items-center gap-6">
            <div class="hidden sm:flex mr-2">
              {#key $player.currentTrack.id}
                <Rating
                  id={$player.currentTrack.id}
                  rating={$player.currentTrack.userRating ?? 0}
                  compact={true}
                />
              {/key}
            </div>

            <button
              class={`p-2 rounded-full hover:bg-primary/20 transition-colors ${
                $player.shuffle ? "text-primary" : ""
              }`}
              on:click={() => player.toggleShuffle()}
            >
              <Shuffle size={20} />
            </button>

            <button
              class="p-2 rounded-full hover:bg-primary/20 transition-colors"
              on:click={() => player.previous()}
            >
              <SkipBack size={24} />
            </button>

            <button
              class="p-3 rounded-full bg-primary text-background hover:opacity-90 transition-all hover:scale-105 active:scale-95"
              on:click={() => player.togglePlay()}
            >
              {#if $player.isPlaying}
                <Pause size={24} />
              {:else}
                <Play size={24} />
              {/if}
            </button>

            <button
              class="p-2 rounded-full hover:bg-primary/20 transition-colors"
              on:click={() => player.next()}
            >
              <SkipForward size={24} />
            </button>

            <button
              class={`p-2 rounded-full hover:bg-primary/20 transition-colors ${
                $player.repeat !== "none" ? "text-primary" : ""
              }`}
              on:click={() => player.toggleRepeat()}
            >
              {#if $player.repeat === "one"}
                <Repeat1 size={20} />
              {:else if $player.repeat === "all"}
                <Repeat size={20} />
              {:else}
                <Repeat size={20} style="opacity: 0.5;" />
              {/if}
            </button>

            <button
              class="p-2 rounded-full hover:bg-primary/20 transition-colors flex items-center gap-2"
              on:click={queueActions.toggle}
            >
              <ListMusic size={20} />
            </button>

            <div class="relative group">
              <button
                class="p-2 rounded-full hover:bg-primary/20 transition-colors"
                on:click={toggleMute}
                on:wheel|preventDefault={handleVolumeScroll}
                on:mouseenter={handleVolumeHover}
                on:mouseleave={handleVolumeLeave}
              >
                <svelte:component this={getVolumeIcon()} size={20} />
              </button>

              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 rounded-lg bg-surface shadow-lg transition-opacity duration-200 ${
                  !showVolume ? "opacity-0 pointer-events-none" : ""
                }`}
                on:mouseenter={handleVolumeHover}
                on:mouseleave={handleVolumeLeave}
              >
                <div class="w-32 flex items-center gap-2">
                  <div class="relative flex-1 h-1 bg-primary/20 rounded-full">
                    <div
                      class="absolute h-1 bg-primary rounded-full transition-all"
                      style:width="{volume * 100}%"
                    ></div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume}
                      class="absolute inset-0 w-full opacity-0 cursor-pointer"
                      on:input={handleVolumeChange}
                    />
                  </div>
                  <span class="text-xs text-text-secondary w-8 text-right">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              </div>
            </div>
            <button
              class={`p-2 rounded-full hover:bg-primary/20 transition-colors ${
                isFullscreen ? "text-primary" : ""
              }`}
              on:click={toggleFullscreen}
              class:animate-pulse={!isFullscreen}
            >
              <Maximize2 size={20} />
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
