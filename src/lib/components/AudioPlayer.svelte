<script lang="ts">
  import { setupMediaSession } from "$lib/mediaSession";
  import { client } from "$lib/stores/client";
  import { player } from "$lib/stores/player";
  import { queueActions } from "$lib/stores/queueStore";
  import { sidebarHidden } from "$lib/stores/sidebarOpen";
  import type {
    EnhancedSyncedLyric,
    SyncedLyric,
    SyncedWord,
  } from "$lib/types/navidrome";
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
    | {
        synced: boolean;
        plain: string;
        lines: SyncedLyric[];
        enhanced?: boolean;
        enhancedLines?: EnhancedSyncedLyric[];
      }
    | undefined;
  let currentLyricIndex = -1;
  let currentWordIndex = -1;
  let lyricsContainer: HTMLDivElement;
  let currentLyricElement: HTMLParagraphElement | null = null;
  let progressInterval: number;
  let isDragging = false;
  let dragProgress = 0;
  let lastFetchedLyricsId: string | null = null;

  const transactionDuration = 600;
  const bgTransitionDuration = 800;
  const containerDelay = 50;
  const contentDelay = 200;
  const controlsDelay = 400;

  const getControlDelay = (index: number) => controlsDelay + index * 50;

  $: {
    if ($player.currentTrack) {
      const newTrackId = $player.currentTrack.id;
      if (currentTrackId !== newTrackId) {
        currentTrackId = newTrackId;
        lyrics = undefined;
        currentLyricIndex = -1;
        currentWordIndex = -1;
      }
      if (
        isFullscreen &&
        $client &&
        $player.currentTrack.id &&
        $player.currentTrack.id !== lastFetchedLyricsId
      ) {
        (async () => {
          const lyricsResult = await $client.getLyrics($player.currentTrack!);
          if (lyricsResult?.synced && lyricsResult.lines.length) {
            lyricsResult.enhanced = true;
            lyricsResult.enhancedLines = parseWordTimings(lyricsResult.lines);
          }
          lyrics = lyricsResult;
          lastFetchedLyricsId = $player.currentTrack?.id || null;
          currentLyricIndex = -1;
          currentWordIndex = -1;
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
    if (isFullscreen) {
      setTimeout(() => {
        isFullscreen = false;
        sidebarHidden.set(false);
      }, 100);
    } else {
      setTimeout(() => {
        isFullscreen = true;
        sidebarHidden.set(true);
        if (
          lyrics &&
          $player.currentTrack &&
          $player.currentTrack.id === lastFetchedLyricsId
        ) {
          scrollToCurrentLyric();
        }
        updateCurrentLyric();
      }, 50);
    }
  }
  function parseWordTimings(lines: SyncedLyric[]): EnhancedSyncedLyric[] {
    function estimateSyllables(word: string): number {
      word = word.toLowerCase().replace(/[^a-z0-9]/g, "");

      if (word.length <= 3) return 1;

      const vowelGroups = word.match(/[aeiouy]+/g);
      if (!vowelGroups) return 1;

      let count = vowelGroups.length;
      if (word.endsWith("e") && count > 1) count--;

      return Math.max(1, count);
    }

    function extractParentheses(text: string): {
      cleanText: string;
      parentheticals: Array<{
        content: string;
        startPos: number;
        endPos: number;
      }>;
    } {
      const parentheticals: Array<{
        content: string;
        startPos: number;
        endPos: number;
      }> = [];
      let depth = 0;
      let startIndex = -1;

      for (let i = 0; i < text.length; i++) {
        if (text[i] === "(" && (i === 0 || text[i - 1] !== "\\")) {
          if (depth === 0) {
            startIndex = i;
          }
          depth++;
        } else if (text[i] === ")" && (i === 0 || text[i - 1] !== "\\")) {
          if (depth > 0) depth--;
          if (depth === 0 && startIndex !== -1) {
            const content = text.substring(startIndex, i + 1);

            parentheticals.push({
              content,
              startPos: startIndex,
              endPos: i + 1,
            });

            startIndex = -1;
          }
        }
      }
      return { cleanText: text, parentheticals };
    }

    return lines.map((line, lineIndex) => {
      const { cleanText, parentheticals } = extractParentheses(line.text);
      const wordMatches = [
        ...cleanText.matchAll(
          /([a-zA-Z0-9]+['']*[a-zA-Z0-9]*[.,!?;:]*)|([\p{P}]+)/gu,
        ),
      ];

      const wordsWithInfo = wordMatches
        .map((m) => {
          const word = m[0];
          const position = m.index || 0;
          const endPosition = position + word.length;
          const isInParentheses = parentheticals.some(
            (p) => position >= p.startPos && endPosition <= p.endPos,
          );

          return {
            word,
            position,
            isParenthetical: isInParentheses,
          };
        })
        .filter(({ word }) => word.trim());
      parentheticals.forEach((p) => {
        const isAlreadyCovered = wordsWithInfo.some(
          (w) =>
            w.position >= p.startPos && w.position + w.word.length <= p.endPos,
        );

        if (!isAlreadyCovered) {
          wordsWithInfo.push({
            word: p.content,
            position: p.startPos,
            isParenthetical: true,
          });
        }
      });

      wordsWithInfo.sort((a, b) => a.position - b.position);

      const words = wordsWithInfo.map((w) => w.word);

      const nextLineTime = lines[lineIndex + 1]?.time ?? line.time + 5;
      const lineDuration = nextLineTime - line.time;

      const syllableCounts = words.map((word) => {
        if (word.startsWith("(") && word.endsWith(")")) {
          const innerContent = word.slice(1, -1);
          return estimateSyllables(innerContent) * 0.8;
        }
        return estimateSyllables(word);
      });

      const totalSyllables = syllableCounts.reduce(
        (sum, count) => sum + count,
        0,
      );

      const hasPunctuation = (word: string) => /[.,:;!?]$/.test(word);
      const isParenthetical = (word: string) =>
        word.startsWith("(") && word.endsWith(")");

      let currentTime = line.time;
      const syncedWords: SyncedWord[] = [];

      words.forEach((word, i) => {
        if (!word.trim()) return;

        const syllableRatio = syllableCounts[i] / totalSyllables;

        let wordDuration = lineDuration * syllableRatio;

        if (hasPunctuation(word)) {
          wordDuration *= 1.2;
        }

        if (isParenthetical(word)) {
          wordDuration *= 0.8;
        }

        if (i === words.length - 1) {
          wordDuration *= 1.15;
        }

        wordDuration = Math.max(
          0.1,
          Math.min(wordDuration, lineDuration * 0.5),
        );

        const wordTiming = {
          time: currentTime,
          word,
          endTime: currentTime + wordDuration,
          isParenthetical: isParenthetical(word),
        };

        syncedWords.push(wordTiming);

        const overlapFactor = hasPunctuation(word) ? 0.8 : 0.9;
        const parentheticalOverlapAdjustment = isParenthetical(word)
          ? 0.7
          : 1.0;
        currentTime +=
          wordDuration * overlapFactor * parentheticalOverlapAdjustment;
      });

      return {
        time: line.time,
        text: line.text,
        words: syncedWords,
      };
    });
  }

  function updateCurrentWord() {
    if (!lyrics?.enhanced || currentLyricIndex === -1 || !lyrics.enhancedLines)
      return;

    const currentLine = lyrics.enhancedLines[currentLyricIndex];
    if (!currentLine?.words?.length) return;

    const newWordIndex = currentLine.words.findIndex((word, i) => {
      const endTime =
        word.endTime || (currentLine.words[i + 1]?.time ?? Infinity);
      return progress >= word.time && progress < endTime;
    });

    if (newWordIndex !== currentWordIndex) {
      currentWordIndex = newWordIndex;
    }
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
      currentWordIndex = -1;
    }

    if (lyrics.enhanced) {
      updateCurrentWord();
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
      in:fade={{ duration: bgTransitionDuration, easing: cubicOut }}
      out:fade={{ duration: bgTransitionDuration * 0.8, easing: cubicOut }}
    >
      <div
        class="absolute inset-0 bg-gradient-to-b from-black/70 to-black/60 backdrop-blur-sm"
        in:fade={{ duration: bgTransitionDuration + 200, delay: 100 }}
        out:fade={{ duration: bgTransitionDuration * 0.6 }}
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
    in:slide={{
      duration: transactionDuration,
      easing: cubicOut,
      axis: "y",
      delay: containerDelay,
    }}
    out:slide={{
      duration: transactionDuration * 0.8,
      easing: cubicOut,
      axis: "y",
    }}
  >
    {#if duration > 0}
      <div
        class="absolute top-0 left-0 right-0"
        in:fade={{ duration: 300, delay: isFullscreen ? 300 : 0 }}
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
          in:scale={{
            start: 0.95,
            opacity: 0,
            duration: transactionDuration,
            delay: contentDelay,
            easing: cubicOut,
          }}
          out:scale={{
            start: 0.95,
            opacity: 0,
            duration: transactionDuration * 0.7,
            easing: cubicOut,
          }}
        >
          <div
            class="w-full flex items-center gap-4 p-4 bg-surface/50 rounded-lg"
            in:fly={{
              y: 10,
              x: 0,
              opacity: 0,
              duration: transactionDuration,
              delay: contentDelay + 100,
              easing: cubicOut,
            }}
            out:fly={{
              y: 10,
              opacity: 0,
              duration: transactionDuration * 0.5,
            }}
          >
            <div class="relative">
              <div
                class="w-24 h-24 rounded-lg shadow-xl overflow-hidden"
                in:scale={{
                  start: 0.85,
                  opacity: 0.6,
                  duration: transactionDuration,
                  delay: contentDelay + 150,
                  easing: cubicOut,
                }}
                out:scale={{
                  start: 0.85,
                  opacity: 0,
                  duration: transactionDuration * 0.6,
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
              in:fly={{
                x: -20,
                opacity: 0,
                duration: transactionDuration,
                delay: contentDelay + 200,
              }}
              out:fly={{
                x: -20,
                opacity: 0,
                duration: transactionDuration * 0.6,
              }}
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
                    <div class="flex flex-col gap-6 pb-8">
                      {#each lyrics.lines as line, i}
                        {#if lyrics.enhanced && lyrics.enhancedLines && i === currentLyricIndex}
                          <div
                            class="text-2xl leading-relaxed min-h-[60px] p-5 rounded-xl bg-gradient-to-r from-primary/20 to-primary/5 shadow-lg transform transition-all duration-300"
                            bind:this={currentLyricElement}
                            in:fade={{
                              duration: 300,
                            }}
                          >
                            {#each lyrics.enhancedLines[i].words as word, wordIndex}
                              {#if word.isParenthetical}
                                <span
                                  class="inline-block mr-1 opacity-70 text-text-secondary font-light italic transition-all duration-300 ease-out hover:text-primary/80 cursor-pointer {wordIndex ===
                                  currentWordIndex
                                    ? 'text-primary scale-105'
                                    : 'scale-100'}"
                                  on:click={() => player.seek(word.time)}
                                >
                                  {word.word}
                                </span>
                              {:else}
                                <span
                                  class="inline-block mr-1 transition-all duration-300 ease-out hover:text-primary cursor-pointer
                                    {wordIndex <= currentWordIndex
                                    ? 'text-primary'
                                    : ''} 
                                    {wordIndex === currentWordIndex
                                    ? 'font-semibold text-shadow-primary scale-105 animate-word-highlight'
                                    : 'font-normal text-shadow-none scale-100'}"
                                  on:click={() => player.seek(word.time)}
                                >
                                  {word.word}
                                </span>
                              {/if}
                            {/each}
                          </div>
                        {:else}
                          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                          {#if i === currentLyricIndex}
                            <p
                              class="text-2xl leading-relaxed min-h-[60px] p-5 rounded-xl bg-gradient-to-r from-primary/20 to-primary/5 shadow-lg text-primary font-medium tracking-wide transform transition-all duration-300"
                              bind:this={currentLyricElement}
                              on:click={() => player.seek(line.time)}
                              in:fade={{
                                duration: 300,
                              }}
                            >
                              {line.text}
                            </p>
                          {:else}
                            <div class="min-h-[60px] relative">
                              <p
                                class="text-xl leading-relaxed whitespace-pre-wrap cursor-pointer hover:text-primary p-4 rounded-lg hover:bg-primary/5
                                       transition-all duration-300 absolute inset-0
                                       {i < currentLyricIndex
                                  ? 'opacity-40'
                                  : 'opacity-60'} 
                                       hover:opacity-90 hover:scale-[1.02] hover:pl-5"
                                on:click={() => player.seek(line.time)}
                              >
                                {line.text}
                              </p>
                            </div>
                          {/if}
                        {/if}
                      {/each}
                    </div>
                  {:else}
                    <p
                      class="text-xl leading-relaxed whitespace-pre-wrap p-6 font-light tracking-wide"
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
                    <p class="text-xl mb-3 font-medium">No lyrics available</p>
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
              in:fly={{
                x: 20,
                opacity: 0,
                duration: transactionDuration,
                delay: contentDelay + 250,
              }}
              out:fly={{
                x: 20,
                opacity: 0,
                duration: transactionDuration * 0.6,
              }}
            >
              <Queue minimal={true} />
            </div>
          </div>

          <div
            class="w-full p-4 bg-surface/50 rounded-lg flex justify-center"
            in:fly={{
              y: 20,
              opacity: 0,
              duration: transactionDuration,
              delay: contentDelay + 300,
            }}
            out:fly={{
              y: 20,
              opacity: 0,
              duration: transactionDuration * 0.5,
            }}
          >
            <div class="flex items-center gap-6">
              {#each [{ action: () => player.toggleShuffle(), icon: Shuffle, active: $player.shuffle, size: 24 }, { action: () => player.previous(), icon: SkipBack, size: 32 }, { action: () => player.togglePlay(), icon: $player.isPlaying ? Pause : Play, size: 40, primary: true }, { action: () => player.next(), icon: SkipForward, size: 32 }, { action: () => player.toggleRepeat(), icon: $player.repeat === "one" ? Repeat1 : Repeat, active: $player.repeat !== "none", size: 24 }] as btn, i}
                <button
                  class={`p-${btn.primary ? 4 : 2} rounded-full ${
                    btn.primary
                      ? "bg-primary text-background hover:opacity-90"
                      : "hover:bg-primary/20"
                  } transition-all ${btn.active ? "text-primary" : ""} ${
                    btn.primary ? "hover:scale-105 active:scale-95" : ""
                  }`}
                  on:click={btn.action}
                  in:scale={{
                    start: 0.8,
                    opacity: 0,
                    duration: 400,
                    delay: getControlDelay(i),
                    easing: cubicOut,
                  }}
                  out:scale={{
                    start: 0.8,
                    opacity: 0,
                    duration: 300,
                    delay: i * 30,
                  }}
                >
                  <svelte:component this={btn.icon} size={btn.size} />
                </button>
              {/each}
            </div>
          </div>
        </div>
      {:else}
        <div
          class="flex items-center justify-between mt-4"
          in:fly={{
            y: 10,
            opacity: 0,
            duration: transactionDuration * 0.6,
            easing: cubicOut,
          }}
          out:fly={{
            y: 10,
            opacity: 0,
            duration: transactionDuration * 0.5,
            delay: 100,
          }}
        >
          <div class="flex items-center gap-4">
            {#if $player.currentTrack}
              <div class="relative">
                <img
                  src={$player.currentTrack.coverArt}
                  alt={$player.currentTrack.title}
                  class="w-12 h-12 rounded shadow-lg transition-transform hover:scale-105"
                  in:scale={{
                    start: 0.85,
                    opacity: 0.6,
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
                <Repeat size={20} class="opacity-50" />
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
              in:scale={{
                start: 0.9,
                duration: 300,
                delay: 400,
              }}
            >
              <Maximize2 size={20} />
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
