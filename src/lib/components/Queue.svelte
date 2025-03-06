<script lang="ts">
  import { player } from "$lib/stores/player";
  import {
    history,
    queueActions,
    queueVisible,
    upcoming,
  } from "$lib/stores/queueStore";
  import { GripVertical, X } from "lucide-svelte";
  import { dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from "svelte-dnd-action";
  import { fade } from "svelte/transition";

  export let minimal = false;

  let dragItems: any[] = [];
  $: dragItems = $upcoming.map((item) => ({
    ...item,
    [SHADOW_ITEM_MARKER_PROPERTY_NAME]: false,
  }));

  function handleDndConsider(e: CustomEvent<{ items: any[] }>) {
    dragItems = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<{ items: any[] }>) {
    const cleanItems = e.detail.items.map(
      ({ [SHADOW_ITEM_MARKER_PROPERTY_NAME]: _, ...item }) => item
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
</script>

<div
  class={`flex flex-col transition-all duration-300 ease-out ${
    !minimal
      ? "fixed right-0 top-0 bottom-0 w-80 bg-surface/95 backdrop-blur-xl shadow-2xl border-l border-white/[0.02] z-40 transform"
      : "max-h-full overflow-y-auto scrollbar-none"
  } ${!minimal && !$queueVisible ? "translate-x-full" : ""}`}
>
  {#if !minimal}
    <header
      class="p-4 border-b border-white/[0.02] backdrop-blur-md bg-surface/30 flex justify-between items-center sticky top-0 z-10"
    >
      <h2
        class="text-lg font-semibold bg-gradient-to-r from-primary/90 to-primary bg-clip-text text-transparent"
      >
        Queue
      </h2>
      <button
        class="p-2 rounded-full hover:bg-primary/15 transition-colors duration-200"
        on:click={queueActions.hide}
        aria-label="Close queue"
      >
        <X size={20} />
      </button>
    </header>
  {/if}

  <div
    class="flex-1 overflow-y-auto transition-all scroll-smooth scrollbar-none"
  >
    {#if $history.length > 0}
      <div
        class="px-4 py-3 text-sm font-medium bg-gradient-to-r from-primary/5 to-transparent"
        in:fade={{ duration: 150 }}
      >
        History
      </div>
      <div class="opacity-50" in:fade={{ duration: 150 }}>
        {#each $history as track, i}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <div
            class="group flex items-center gap-3 px-4 py-2 hover:bg-primary/10 cursor-pointer transition-colors duration-200"
            on:click={() => playHistoryTrack(i)}
            on:keydown={(e) => handleKeyDown(e, () => playHistoryTrack(i))}
            role="button"
            tabindex="0"
            aria-label={`Play ${track.title} by ${track.artist} from history`}
          >
            <img
              src={track.coverArt}
              alt={track.title}
              class="w-12 h-12 rounded-lg object-cover shadow-lg shadow-black/10 group-hover:scale-105 transition-transform duration-200"
            />
            <div class="flex-1 min-w-0">
              <p
                class="truncate font-medium group-hover:text-primary transition-colors duration-200"
              >
                {track.title}
              </p>
              <p class="truncate text-sm text-text-secondary/75">
                {track.artist}
              </p>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    {#if $player.currentTrack}
      <div
        class="px-4 py-3 text-sm font-medium bg-gradient-to-r from-primary/5 to-transparent mt-2"
        in:fade={{ duration: 150 }}
      >
        Now Playing
      </div>
      <div class="bg-primary/10 backdrop-blur-sm" in:fade={{ duration: 150 }}>
        <div class="flex items-center gap-3 px-4 py-3">
          <img
            src={$player.currentTrack.coverArt}
            alt={$player.currentTrack.title}
            class="w-14 h-14 rounded-lg object-cover shadow-lg shadow-primary/20"
          />
          <div class="flex-1 min-w-0">
            <p class="truncate font-medium text-primary">
              {$player.currentTrack.title}
            </p>
            <p class="truncate text-sm text-text-secondary/90">
              {$player.currentTrack.artist}
            </p>
          </div>
        </div>
      </div>
    {/if}

    {#if dragItems.length > 0}
      <div
        class="px-4 py-3 text-sm font-medium bg-gradient-to-r from-primary/5 to-transparent mt-2"
        in:fade={{ duration: 150 }}
      >
        Up Next
      </div>
      <section
        use:dndzone={{
          items: dragItems,
          dragDisabled: false,
          dropTargetStyle: {},
          transformDraggedElement: (draggedEl) => {
            if (!draggedEl) return;
            draggedEl.style.transform = "scale(1.02)";
            draggedEl.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
          },
        }}
        on:consider={handleDndConsider}
        on:finalize={handleDndFinalize}
        class="pb-4 transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
        aria-label="Queue of upcoming tracks"
        role="list"
      >
        {#each dragItems as track, i (track.id)}
          <div
            class="group flex items-center gap-3 px-4 py-2 hover:bg-primary/10 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
            role="listitem"
            aria-label={`${track.title} by ${track.artist}`}
          >
            <button
              class="cursor-move p-1.5 rounded-md opacity-0 group-hover:opacity-60 hover:opacity-100 hover:bg-primary/15 transition-all duration-200"
              aria-label="Drag to reorder"
            >
              <GripVertical size={16} />
            </button>

            <img
              src={track.coverArt}
              alt={track.title}
              class="w-12 h-12 rounded-lg object-cover shadow-lg shadow-black/10 group-hover:scale-105 transition-transform duration-200"
            />

            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div
              class="flex-1 min-w-0 cursor-pointer"
              on:click={() => playTrack(i)}
              on:keydown={(e) => handleKeyDown(e, () => playTrack(i))}
              role="button"
              tabindex="0"
              aria-label={`Play ${track.title} by ${track.artist}`}
            >
              <p
                class="truncate font-medium group-hover:text-primary transition-colors duration-200"
              >
                {track.title}
              </p>
              <p class="truncate text-sm text-text-secondary/75">
                {track.artist}
              </p>
            </div>

            <button
              class="p-1.5 rounded-md opacity-0 group-hover:opacity-60 hover:opacity-100 hover:bg-primary/15 hover:text-primary transition-all duration-200"
              on:click={() => removeFromQueue(i)}
              aria-label={`Remove ${track.title} from queue`}
            >
              <X size={16} />
            </button>
          </div>
        {/each}
      </section>
    {/if}
  </div>
</div>
