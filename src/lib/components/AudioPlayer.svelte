<script lang="ts">
  import { browser } from "$app/environment";
  import { setupMediaSession } from "$lib/mediaSession";
  import { client } from "$lib/stores/client";
  import { player } from "$lib/stores/player";
  import { queueActions } from "$lib/stores/queueStore";
  import { sidebarHidden } from "$lib/stores/sidebarOpen";
  import type { SyncedLyric } from "$lib/types/navidrome";
  import {
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
  import { fade } from "svelte/transition";
  import Queue from "./Queue.svelte";

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

  if (browser) {
    addEventListener("keydown", (e) => {
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
    });
  }

  $: if ($player.currentTrack && $client && $player.isPlaying) {
    if (currentTrackId !== $player.currentTrack.id) {
      currentTrackId = $player.currentTrack.id;
      scrollToCurrentLyric();
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
    isFullscreen = !isFullscreen;
    sidebarHidden.set(isFullscreen);
    if (isFullscreen && $player.currentTrack) {
      if ($client) lyrics = await $client.getLyrics($player.currentTrack!);
      scrollToCurrentLyric();
    }
  }

  $: if ($player.currentTrack && isFullscreen) {
    (async () => {
      lyrics = await $client?.getLyrics($player.currentTrack!);
    })();
  }

  function updateCurrentLyric() {
    if (!lyrics?.synced) return;

    const newIndex = lyrics.lines.findIndex((line, i) => {
      const nextTime = lyrics!.lines[i + 1]?.time ?? Infinity;
      return progress >= line.time && progress < nextTime;
    });

    if (newIndex !== -1 && newIndex !== currentLyricIndex) {
      currentLyricIndex = newIndex;
    }
  }

  function scrollToCurrentLyric() {
    if (!lyricsContainer || !lyrics?.lines?.length) return;
    setTimeout(() => {
      try {
        if (!currentLyricElement && currentLyricIndex >= 0) {
          const elements = lyricsContainer.querySelectorAll("p");
          currentLyricElement = elements[
            currentLyricIndex
          ] as HTMLParagraphElement;
        }

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
</script>

{#if $player.currentTrack}
  {#if isFullscreen}
    <div
      class="fixed inset-0 bg-cover bg-center bg-no-repeat z-20"
      style="background-image: url('{$player.currentTrack.coverArt}');"
    >
      <div class="absolute inset-0 bg-black/50"></div>
    </div>
  {/if}

  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class={`fixed transition-all duration-300 z-30 border-primary/20 p-4 ${
      isFullscreen ? "top-0 h-screen" : "bottom-0"
    } left-0 right-0 ${
      isFullscreen ? "backdrop-blur-2xl" : "backdrop-blur-md border-t"
    }`}
  >
    {#if duration > 0}
      <div class="absolute top-0 left-0 right-0">
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
          class="h-full flex flex-col gap-4 p-4 bg-surface/40"
          transition:fade
        >
          <div
            class="w-full flex items-center gap-4 p-4 bg-surface/50 rounded-lg"
          >
            <img
              src={$player.currentTrack.coverArt}
              alt={$player.currentTrack.title}
              class="w-24 h-24 rounded-lg shadow-xl object-cover"
            />
            <div class="flex flex-col flex-1">
              <a
                class="text-2xl font-bold text-text-secondary hover:text-primary"
                href="/songs/{$player.currentTrack.id}"
                on:click={toggleFullscreen}>{$player.currentTrack.title}</a
              >
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
          </div>

          <div class="flex-1 flex gap-4 min-h-0">
            <div
              class="flex-1 bg-surface/50 rounded-lg overflow-hidden flex flex-col"
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
                    <p class="text-xl whitespace-pre-wrap p-4">
                      {lyrics.plain}
                    </p>
                  {/if}
                {:else}
                  <div
                    class="h-full flex flex-col items-center justify-center text-text-secondary"
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
            >
              <Queue minimal={true} />
            </div>
          </div>

          <div class="w-full p-4 bg-surface/50 rounded-lg flex justify-center">
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
                class="p-4 rounded-full bg-primary text-background hover:opacity-90 transition-all hover:scale-105"
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
        <div class="flex items-center justify-between mt-4">
          <div class="flex items-center gap-4">
            {#if $player.currentTrack}
              <img
                src={$player.currentTrack.coverArt}
                alt={$player.currentTrack.title}
                class="w-12 h-12 rounded shadow-lg transition-transform hover:scale-105"
                in:fade
              />
              <div class="min-w-0 flex flex-col">
                <a
                  class="font-medium truncate"
                  href="/songs/{$player.currentTrack.id}"
                  >{$player.currentTrack.title}</a
                >
                <a
                  class="text-sm text-text-secondary truncate"
                  href="/artists/{$player.currentTrack.artistId}"
                  >{$player.currentTrack.artist}</a
                >
              </div>
            {/if}
          </div>

          <div class="flex items-center gap-6">
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
              class="p-3 rounded-full bg-primary text-background hover:opacity-90 transition-all hover:scale-105"
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
            >
              <Maximize2 size={20} />
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
