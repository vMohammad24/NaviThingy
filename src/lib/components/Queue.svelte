<script lang="ts">
  import { browser } from "$app/environment";
  import { player } from "$lib/stores/player";
  import {
    history,
    queueActions,
    queueVisible,
    upcoming,
  } from "$lib/stores/queueStore";
  import { isMobile } from "$lib/stores/sidebarOpen";
  import { GripVertical, Play, X } from "@lucide/svelte";
  import { dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from "svelte-dnd-action";
  import { backOut, cubicOut } from "svelte/easing";
  import { fly, scale, slide } from "svelte/transition";

  interface Props {
    minimal?: boolean;
  }

  let { minimal = false }: Props = $props();

  let dragItems = $derived(
    $upcoming.map((item) => ({
      ...item,
      [SHADOW_ITEM_MARKER_PROPERTY_NAME]: false,
    })),
  );

  function handleDndConsider(e: CustomEvent<{ items: any[] }>) {
    dragItems = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<{ items: any[] }>) {
    const cleanItems = e.detail.items.map(
      ({ [SHADOW_ITEM_MARKER_PROPERTY_NAME]: _, ...item }) => item,
    );

    const newPlaylist = [
      ...$player.playlist.slice(0, $player.currentIndex + 1),
      ...cleanItems,
    ];

    player.update((state) => ({ ...state, playlist: newPlaylist }));
  }

  function removeFromQueue(index: number) {
    const actualIndex = index + $player.currentIndex + 1;
    const newPlaylist = [...$player.playlist];
    newPlaylist.splice(actualIndex, 1);
    player.update((state) => ({
      ...state,
      playlist: newPlaylist,
    }));
  }

  function playTrack(index: number) {
    const actualIndex = index + $player.currentIndex + 1;
    player.setPlaylist($player.playlist, actualIndex);
  }

  function playHistoryTrack(index: number) {
    player.setPlaylist($player.playlist, index);
  }

  function handleKeyDown(event: KeyboardEvent, callback: () => void) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      callback();
    }
  }

  let isTouchDevice = $state(false);

  if (browser) {
    isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  let touchStartY = $state(0);
  let initialTranslateY = $state(0);
  let currentTranslateY = $state(0);
  let isDraggingPanel = $state(false);

  function handleTouchStart(e: TouchEvent) {
    if (!minimal) {
      touchStartY = e.touches[0].clientY;
      initialTranslateY = currentTranslateY;
      isDraggingPanel = true;
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (isDraggingPanel) {
      const touchY = e.touches[0].clientY;
      const deltaY = touchY - touchStartY;
      currentTranslateY = Math.max(0, initialTranslateY + deltaY);
    }
  }

  function handleTouchEnd() {
    if (isDraggingPanel) {
      isDraggingPanel = false;
      if (currentTranslateY > window.innerHeight * 0.5) {
        queueActions.hide();
        setTimeout(() => {
          currentTranslateY = 0;
        }, 300);
      } else {
        currentTranslateY = 0;
      }
    }
  }

  function getStaggeredDelay(index: number) {
    return Math.min(index * 50, 300);
  }
</script>

<div
  class={`flex flex-col transition-all duration-300 ease-out ${
    !minimal
      ? "fixed inset-0 bg-surface/95 backdrop-blur-xl shadow-2xl z-40 transform md:max-w-[480px] md:right-0 md:left-auto md:rounded-l-2xl md:border-l md:border-white/10"
      : "max-h-full overflow-y-auto scrollbar-none"
  } ${!minimal && !$queueVisible ? "translate-y-full md:translate-y-0 md:translate-x-full" : ""}`}
  style={isDraggingPanel ? `transform: translateY(${currentTranslateY}px)` : ""}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  in:fly={{ y: !minimal ? 30 : 0, duration: 400, easing: cubicOut }}
  out:fly={{ y: !minimal ? 30 : 0, duration: 300, easing: cubicOut }}
>
  {#if !minimal}
    <header
      class="p-4 backdrop-blur-md bg-surface/30 border-b border-white/10 flex items-center justify-between sticky top-0 z-10 md:px-6"
      in:slide={{ duration: 300, delay: 100, easing: cubicOut }}
    >
      <div class="w-10 md:hidden"></div>
      <div
        class="flex flex-col items-center md:items-start md:flex-row md:gap-3"
      >
        <div
          class="w-12 h-1 bg-white/20 rounded-full mb-3 md:hidden"
          in:scale={{ duration: 400, delay: 250, easing: backOut, start: 0.5 }}
        ></div>
        <h2
          class="text-lg font-semibold bg-gradient-to-r from-primary/90 to-primary bg-clip-text text-transparent md:text-xl"
          in:scale={{ duration: 400, delay: 250, start: 0.9, easing: backOut }}
        >
          Queue
        </h2>
      </div>
      <button
        class="p-2 rounded-full hover:bg-primary/15 transition-colors duration-200 hover:scale-105 active:scale-95"
        onclick={queueActions.hide}
        aria-label="Close queue"
      >
        <X size={20} />
      </button>
    </header>
  {/if}

  <div
    class="flex-1 overflow-y-auto transition-all scroll-smooth scrollbar-none md:pb-20"
  >
    <div class={!$isMobile && !minimal ? "md:px-2" : ""}>
      {#if $history.length > 0}
        <div
          class="px-4 py-3 text-sm font-medium bg-gradient-to-r from-primary/5 to-transparent md:px-6 md:pt-4"
          in:fly={{ y: 10, duration: 300, delay: 150, easing: cubicOut }}
        >
          History
        </div>
        <div class="opacity-60">
          {#each $history as track, i}
            <div
              class="group flex items-center gap-3 px-4 py-2 hover:bg-primary/10 cursor-pointer transition-all duration-200 active:bg-primary/20 hover:scale-[1.01] active:scale-[0.99] md:px-6 md:py-3"
              onclick={() => playHistoryTrack(i)}
              onkeydown={(e) => handleKeyDown(e, () => playHistoryTrack(i))}
              role="button"
              tabindex="0"
              aria-label={`Play ${track.title} by ${track.artist} from history`}
              in:fly={{
                y: 15,
                duration: 300,
                delay: getStaggeredDelay(i) + 200,
                easing: cubicOut,
              }}
            >
              <div
                class="relative w-12 h-12 rounded-lg overflow-hidden shadow-md md:w-14 md:h-14"
              >
                <img
                  src={track.coverArt}
                  alt={track.title}
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div
                  class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <Play size={24} class="text-white" />
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <p
                  class="truncate font-medium text-sm group-hover:text-primary transition-colors duration-200 md:text-base"
                >
                  {track.title}
                </p>
                <p class="truncate text-xs text-text-secondary/75 md:text-sm">
                  {track.artist}
                </p>
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if $player.currentTrack}
        <div
          class="px-4 py-3 text-sm font-medium bg-gradient-to-r from-primary/5 to-transparent mt-2 md:px-6 md:pt-4"
          in:fly={{ y: 10, duration: 300, delay: 250, easing: cubicOut }}
        >
          Now Playing
        </div>
        <div
          class="bg-primary/10 backdrop-blur-sm"
          in:scale={{
            duration: 400,
            delay: 300,
            start: 0.95,
            easing: cubicOut,
            opacity: 0,
          }}
        >
          <div class="flex items-center gap-3 px-4 py-3 md:px-6 md:py-4">
            <div
              class="relative w-14 h-14 rounded-lg overflow-hidden shadow-lg md:w-16 md:h-16 animate-pulse-slow"
            >
              <img
                src={$player.currentTrack.coverArt}
                alt={$player.currentTrack.title}
                class="w-full h-full object-cover"
              />
              {#if $player.isPlaying}
                <div
                  class="absolute inset-0 flex items-center justify-center bg-black/30"
                >
                  <div class="w-8 h-8 flex items-center justify-center">
                    <div
                      class="w-1 h-5 bg-white/80 mx-0.5 animate-eq-bar1"
                    ></div>
                    <div
                      class="w-1 h-5 bg-white/80 mx-0.5 animate-eq-bar2"
                    ></div>
                    <div
                      class="w-1 h-5 bg-white/80 mx-0.5 animate-eq-bar3"
                    ></div>
                  </div>
                </div>
              {/if}
            </div>
            <div class="flex-1 min-w-0">
              <p class="truncate font-medium text-sm text-primary md:text-base">
                {$player.currentTrack.title}
              </p>
              <p class="truncate text-xs text-text-secondary/90 md:text-sm">
                {$player.currentTrack.artist}
              </p>
            </div>
          </div>
        </div>
      {/if}

      {#if dragItems.length > 0}
        <div
          class="px-4 py-3 text-sm font-medium bg-gradient-to-r from-primary/5 to-transparent mt-2 flex justify-between items-center md:px-6 md:pt-4"
          in:fly={{ y: 10, duration: 300, delay: 350, easing: cubicOut }}
        >
          <span>Up Next</span>
          {#if isTouchDevice && !minimal}
            <span
              class="text-xs text-text-secondary px-2 py-1 bg-primary/10 rounded-full animate-pulse-fade"
            >
              Press and hold to reorder
            </span>
          {/if}
        </div>
        <section
          use:dndzone={{
            items: dragItems,
            dragDisabled: false,
            dropTargetStyle: {},
            transformDraggedElement: (draggedEl) => {
              if (!draggedEl) return;
              draggedEl.style.transform = "scale(1.03)";
              draggedEl.style.boxShadow = "0 10px 25px rgba(0,0,0,0.15)";
              draggedEl.style.opacity = "0.97";
              draggedEl.style.background = "rgba(var(--color-primary), 0.15)";
              draggedEl.style.borderRadius = "0.75rem";
              draggedEl.style.transition = "background-color 0.2s ease";
            },
          }}
          onconsider={handleDndConsider}
          onfinalize={handleDndFinalize}
          class="pb-6 transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] {!$isMobile &&
          !minimal
            ? 'md:grid md:grid-cols-1 md:gap-1'
            : ''}"
          aria-label="Queue of upcoming tracks"
          role="list"
        >
          {#each dragItems as track, i (track.id)}
            <div
              class="group flex items-center gap-3 px-4 py-2 hover:bg-primary/10 active:bg-primary/20 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] md:px-6 md:py-3 md:rounded-lg hover:scale-[1.01] active:scale-[0.99]"
              role="listitem"
              aria-label={`${track.title} by ${track.artist}`}
              in:fly={{
                y: 20,
                duration: 300,
                delay: getStaggeredDelay(i) + 400,
                easing: cubicOut,
              }}
            >
              <button
                class="cursor-move p-1.5 rounded-md {isTouchDevice
                  ? 'opacity-70 animate-pulse-subtle'
                  : 'opacity-0 group-hover:opacity-60'} hover:opacity-100 hover:bg-primary/15 transition-all duration-200 touch-manipulation md:opacity-60 hover:scale-110 active:scale-90"
                aria-label="Drag to reorder"
              >
                <GripVertical size={16} class="md:w-5 md:h-5" />
              </button>

              <div
                class="relative w-12 h-12 rounded-lg overflow-hidden shadow-md md:w-14 md:h-14"
              >
                <img
                  src={track.coverArt}
                  alt={track.title}
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div
                  class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <Play
                    size={20}
                    class="text-white md:w-6 md:h-6 group-hover:animate-scale-in"
                  />
                </div>
              </div>

              <div
                class="flex-1 min-w-0 cursor-pointer"
                onclick={() => playTrack(i)}
                onkeydown={(e) => handleKeyDown(e, () => playTrack(i))}
                role="button"
                tabindex="0"
                aria-label={`Play ${track.title} by ${track.artist}`}
              >
                <p
                  class="truncate font-medium text-sm group-hover:text-primary transition-colors duration-200 md:text-base"
                >
                  {track.title}
                </p>
                <p class="truncate text-xs text-text-secondary/75 md:text-sm">
                  {track.artist}
                </p>
              </div>

              <button
                class="p-1.5 rounded-md {isTouchDevice
                  ? 'opacity-70'
                  : 'opacity-0 group-hover:opacity-60'} hover:opacity-100 hover:bg-primary/15 hover:text-primary transition-all duration-200 touch-manipulation md:opacity-60 md:p-2 hover:rotate-90 hover:scale-110 active:scale-90"
                onclick={() => removeFromQueue(i)}
                aria-label={`Remove ${track.title} from queue`}
              >
                <X size={16} class="md:w-5 md:h-5" />
              </button>
            </div>
          {/each}
        </section>
      {/if}
    </div>
  </div>
</div>

<style>
  /* Custom animation classes */
  :global(.animate-pulse-slow) {
    animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  :global(.animate-pulse-fade) {
    animation: pulse-fade 2s ease-in-out infinite;
  }

  :global(.animate-pulse-subtle) {
    animation: pulse-subtle 2s ease-in-out infinite;
  }

  :global(.animate-scale-in) {
    animation: scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  :global(.animate-eq-bar1) {
    animation: eq-bar 0.8s ease-in-out infinite alternate;
  }

  :global(.animate-eq-bar2) {
    animation: eq-bar 0.8s ease-in-out 0.2s infinite alternate;
  }

  :global(.animate-eq-bar3) {
    animation: eq-bar 0.8s ease-in-out 0.4s infinite alternate;
  }

  @keyframes pulse-slow {
    0%,
    100% {
      transform: scale(1);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    }
    50% {
      transform: scale(1.02);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    }
  }

  @keyframes pulse-fade {
    0%,
    100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }

  @keyframes pulse-subtle {
    0%,
    100% {
      opacity: 0.7;
    }
    50% {
      opacity: 1;
    }
  }

  @keyframes scale-in {
    from {
      transform: scale(0);
    }
    to {
      transform: scale(1);
    }
  }

  @keyframes eq-bar {
    0% {
      height: 30%;
    }
    100% {
      height: 90%;
    }
  }
</style>
