<script lang="ts">
  import { goto } from "$app/navigation";
  import { client } from "$lib/stores/client";
  import type { SearchResult3 } from "@vmohammad/subsonic-api";
  import { createEventDispatcher } from "svelte";
  import Modal from "./Modal.svelte";

  const dispatch = createEventDispatcher();
  export let show = false;

  let searchQuery = "";
  let searchResults: SearchResult3 | null = null;
  let loading = false;

  function debounce<T extends (...args: any[]) => void>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  const debouncedSearch = debounce(async () => {
    if (!searchQuery) {
      searchResults = null;
      return;
    }

    loading = true;
    try {
      searchResults = await $client!.search(searchQuery);
    } catch (e) {
      console.error("Search failed:", e);
    }
    loading = false;
  }, 300);

  async function handleSearch() {
    debouncedSearch();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      close();
    }
  }

  function close() {
    show = false;
    dispatch("close");
  }

  function navigateToAlbum(id: string) {
    goto(`/albums/${id}`);
    close();
  }
</script>

<Modal bind:show maxWidth="max-w-2xl" onClose={close}>
  <div class="p-4 z-50 bg-surface rounded-lg">
    <div class="flex flex-col sm:flex-row gap-3 mb-4">
      <!-- svelte-ignore a11y_autofocus -->
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search for albums, artists, or songs..."
        class="w-full flex-grow p-3 rounded-lg bg-background text-text"
        on:input={handleSearch}
        autofocus
      />
      <button
        on:click={close}
        class="px-4 py-2 rounded-lg bg-primary text-background w-full sm:w-auto"
      >
        Close
      </button>
    </div>

    {#if loading}
      <div class="text-center p-4 flex items-center justify-center">
        <div
          class="animate-spin rounded-full h-8 w-8 border-4 border-primary"
        ></div>
      </div>
    {:else if searchResults}
      <div class="space-y-6 max-h-[60vh] overflow-y-auto p-1">
        {#if searchResults.artist?.length}
          <div>
            <h3 class="font-bold mb-3 text-lg">Artists</h3>
            <div class="space-y-2">
              {#each searchResults.artist as artist}
                <a
                  class="p-2 rounded-lg hover:bg-primary/10 flex items-center gap-3 transition-colors"
                  href={`/artists/${artist.id}`}
                  on:click={close}
                >
                  <div
                    class="w-12 h-12 rounded-full bg-surface-hover flex-shrink-0 overflow-hidden"
                  >
                    {#if artist.artistImageUrl}
                      <img
                        src={artist.artistImageUrl}
                        alt={artist.name}
                        class="w-full h-full object-cover"
                      />
                    {:else}
                      <div
                        class="w-full h-full flex items-center justify-center text-text-secondary"
                      >
                        🎵
                      </div>
                    {/if}
                  </div>
                  <span class="font-medium truncate">{artist.name}</span>
                </a>
              {/each}
            </div>
          </div>
        {/if}

        {#if searchResults.album?.length}
          <div>
            <h3 class="font-bold mb-3 text-lg">Albums</h3>
            <div class="space-y-2">
              {#each searchResults.album as album}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="p-2 rounded-lg hover:bg-primary/10 cursor-pointer flex items-center gap-3 transition-colors"
                  on:click={() => navigateToAlbum(album.id)}
                >
                  <div
                    class="w-12 h-12 rounded bg-surface-hover flex-shrink-0 overflow-hidden"
                  >
                    {#if album.coverArt}
                      <img
                        src={album.coverArt}
                        alt={album.name}
                        class="w-full h-full object-cover"
                      />
                    {:else}
                      <div
                        class="w-full h-full flex items-center justify-center text-text-secondary"
                      >
                        💿
                      </div>
                    {/if}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-medium truncate">{album.name}</div>
                    <div class="text-sm text-text-secondary truncate">
                      {album.artist}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if searchResults.song?.length}
          <div>
            <h3 class="font-bold mb-3 text-lg">Songs</h3>
            <div class="space-y-2">
              {#each searchResults.song as song}
                <a
                  class="p-2 rounded-lg hover:bg-primary/10 flex items-center gap-3 transition-colors"
                  href={`/songs/${song.id}`}
                  on:click={close}
                >
                  <div
                    class="w-12 h-12 rounded bg-surface-hover flex-shrink-0 overflow-hidden"
                  >
                    {#if song.coverArt}
                      <img
                        src={song.coverArt}
                        alt={song.title}
                        class="w-full h-full object-cover"
                      />
                    {:else}
                      <div
                        class="w-full h-full flex items-center justify-center text-text-secondary"
                      >
                        🎵
                      </div>
                    {/if}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-medium truncate">{song.title}</div>
                    <div class="text-sm text-text-secondary truncate">
                      {song.artist}
                    </div>
                  </div>
                </a>
              {/each}
            </div>
          </div>
        {/if}

        {#if !searchResults.artist?.length && !searchResults.album?.length && !searchResults.song?.length}
          <div class="text-center py-8 text-text-secondary">
            No results found for "{searchQuery}"
          </div>
        {/if}
      </div>
    {/if}
  </div>
</Modal>
