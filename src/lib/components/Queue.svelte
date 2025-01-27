<script lang="ts">
  import { player } from '$lib/stores/player';
  import { history, queueActions, queueVisible, upcoming } from '$lib/stores/queueStore';
  import { GripVertical, X } from 'lucide-svelte';
  import { dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
  import { fade } from 'svelte/transition';

  export let minimal = false;
  
  let dragItems: any[] = [];
  $: dragItems = $upcoming.map(item => ({
    ...item,
    [SHADOW_ITEM_MARKER_PROPERTY_NAME]: false
  }));

  function handleDndConsider(e: CustomEvent<{items: any[]}>) {
    dragItems = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<{items: any[]}>) {
    
    const cleanItems = e.detail.items.map(({ [SHADOW_ITEM_MARKER_PROPERTY_NAME]: _, ...item }) => item);
    
    const newPlaylist = [
      ...$player.playlist.slice(0, $player.currentIndex + 1),
      ...cleanItems
    ];
    
    player.update(state => ({ ...state, playlist: newPlaylist }));
  }

  function removeFromQueue(index: number) {
    const actualIndex = index + $player.currentIndex + 1;
    const newPlaylist = [...$player.playlist];
    newPlaylist.splice(actualIndex, 1);
    player.update(state => ({
      ...state,
      playlist: newPlaylist
    }));
  }

  function playTrack(index: number) {
    const actualIndex = index + $player.currentIndex + 1;
    player.setPlaylist($player.playlist, actualIndex);
  }

  function playHistoryTrack(index: number) {
    // Keep the full playlist but just change the current index
    player.setPlaylist($player.playlist, index);
  }
</script>

<div 
  class="flex flex-col transition-all duration-300 ease-out"
  class:fixed={!minimal}
  class:right-0={!minimal}
  class:top-0={!minimal}
  class:bottom-0={!minimal}
  class:w-80={!minimal}
  class:bg-surface={!minimal}
  class:shadow-lg={!minimal}
  class:transform={!minimal}
  class:translate-x-full={!minimal && !$queueVisible}
  class:z-40={!minimal}
  class:max-h-full={minimal}
  class:overflow-y-auto={minimal}
>
  {#if !minimal}
    <header class="p-4 border-b border-primary/20 flex justify-between items-center">
      <h2 class="text-lg font-semibold">Queue</h2>
      <button 
        class="p-2 rounded-full hover:bg-primary/20"
        on:click={queueActions.hide}
      >
        <X size={20} />
      </button>
    </header>
  {/if}
  
  <div class="flex-1 overflow-y-auto transition-all scroll-smooth">
    {#if $history.length > 0}
      <div class="p-2 text-sm text-text-secondary font-medium" in:fade={{duration: 150}}>History</div>
      <div class="opacity-50" in:fade={{duration: 150}}>
        {#each $history as track, i}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div 
            class="flex items-center gap-2 p-2 hover:bg-primary/10 cursor-pointer"
            on:click={() => playHistoryTrack(i)}
          >
            <img src={track.coverArt} alt={track.title} class="w-10 h-10 rounded object-cover"/>
            <div class="flex-1 min-w-0">
              <p class="truncate font-medium">{track.title}</p>
              <p class="truncate text-sm text-text-secondary">{track.artist}</p>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    {#if $player.currentTrack}
      <div class="p-2 text-sm text-text-secondary font-medium" in:fade={{duration: 150}}>Now Playing</div>
      <div class="bg-primary/10" in:fade={{duration: 150}}>
        <div class="flex items-center gap-2 p-2">
          <img src={$player.currentTrack.coverArt} alt={$player.currentTrack.title} class="w-10 h-10 rounded object-cover"/>
          <div class="flex-1 min-w-0">
            <p class="truncate font-medium">{$player.currentTrack.title}</p>
            <p class="truncate text-sm text-text-secondary">{$player.currentTrack.artist}</p>
          </div>
        </div>
      </div>
    {/if}

    {#if dragItems.length > 0}
      <div class="p-2 text-sm text-text-secondary font-medium" in:fade={{duration: 150}}>Up Next</div>
      <section
        use:dndzone={{
          items: dragItems,
          dragDisabled: false,
          dropTargetStyle: {},
          transformDraggedElement: (draggedEl) => {
            if(!draggedEl) return;
            draggedEl.style.transform = 'scale(1.02)';
            draggedEl.style.boxShadow = '0 5px 15px rgba(0,0,0,0.1)';
          }
        }}
        on:consider={handleDndConsider}
        on:finalize={handleDndFinalize}
      >
        {#each dragItems as track, i (track.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div class="flex items-center gap-2 p-2 hover:bg-primary/10 group">
            <button class="cursor-move p-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical size={16} />
            </button>
            
            <img src={track.coverArt} alt={track.title} class="w-10 h-10 rounded object-cover"/>
            
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="flex-1 min-w-0 cursor-pointer" on:click={() => playTrack(i)}>
              <p class="truncate font-medium">{track.title}</p>
              <p class="truncate text-sm text-text-secondary">{track.artist}</p>
            </div>
            
            <button 
              class="p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary"
              on:click={() => removeFromQueue(i)}
            >
              <X size={16} />
            </button>
          </div>
        {/each}
      </section>
    {/if}
  </div>
</div>

<style>
  :global(.dndzone .item-dragged) {
    transition: transform 0.2s ease-out !important;
  }
  
  section {
    transition: transform 0.2s ease-out;
  }
  
  section > div {
    transition: background-color 0.2s ease-out;
  }
  
  button {
    transition: all 0.2s ease-out;
  }
</style>