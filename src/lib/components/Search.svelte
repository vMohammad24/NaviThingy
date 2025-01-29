<script lang="ts">
    import { goto } from '$app/navigation';
    import { client } from '$lib/stores/client';
    import type { SearchResult3 } from '@vmohammad/subsonic-api';
    import { createEventDispatcher } from 'svelte';
    import Modal from './Modal.svelte';

    const dispatch = createEventDispatcher();
    export let show = false;

    let searchQuery = '';
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
            console.error('Search failed:', e);
        }
        loading = false;
    }, 300);

    async function handleSearch() {
        debouncedSearch();
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            close();
        }
    }

    function close() {
        show = false;
        dispatch('close');
    }

    function navigateToAlbum(id: string) {
        goto(`/albums/${id}`);
        close();
    }
</script>

<Modal 
    bind:show 
    maxWidth="max-w-2xl"
    onClose={close}
>
    <div 
        class="p-4 z-50 bg-surface"
    >
        <div class="flex gap-2 mb-4">
            <!-- svelte-ignore a11y_autofocus -->
            <input
                type="text"
                bind:value={searchQuery}
                placeholder="Search for albums, artists, or songs..."
                class="flex-grow p-2 rounded bg-background text-text"
                on:input={handleSearch}
                autofocus
            />
            <button 
                on:click={close}
                class="px-4 rounded bg-primary text-background"
            >
                Close
            </button>
        </div>

        {#if loading}
            <div class="text-center p-4">Loading...</div>
        {:else if searchResults}
            <div class="space-y-4 max-h-[60vh] overflow-y-auto">
                {#if searchResults.artist?.length}
                    <div>
                        <h3 class="font-bold mb-2">Artists</h3>
                        <div class="space-y-2">
                            {#each searchResults.artist as artist}
                                <a class="p-2 rounded hover:bg-primary/10 flex items-center gap-3" href={`/artists/${artist.id}`}>
                                    {#if artist.artistImageUrl}
                                        <img 
                                            src={artist.artistImageUrl} 
                                            alt={artist.name}
                                            class="w-12 h-12 rounded-full object-cover"
                                        />
                                    {/if}
                                    <span>{artist.name}</span>
                                </a>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if searchResults.album?.length}
                    <div>
                        <h3 class="font-bold mb-2">Albums</h3>
                        <div class="space-y-2">
                            {#each searchResults.album as album}
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <div 
                                    class="p-2 rounded hover:bg-primary/10 cursor-pointer flex items-center gap-3"
                                    on:click={() => navigateToAlbum(album.id)}
                                >
                                    {#if album.coverArt}
                                        <img 
                                            src={album.coverArt} 
                                            alt={album.name}
                                            class="w-12 h-12 rounded object-cover"
                                        />
                                    {/if}
                                    <div>
                                        <div>{album.name}</div>
                                        <div class="text-sm opacity-75">{album.artist}</div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if searchResults.song?.length}
                    <div>
                        <h3 class="font-bold mb-2">Songs</h3>
                        <div class="space-y-2">
                            {#each searchResults.song as song}
                                <a class="p-2 rounded hover:bg-primary/10 flex items-center gap-3" href={`/songs/${song.id}`}>
                                    {#if song.coverArt}
                                        <img 
                                            src={song.coverArt} 
                                            alt={song.title}
                                            class="w-12 h-12 rounded object-cover"
                                        />
                                    {/if}
                                    <div>
                                        <div>{song.title}</div>
                                        <div class="text-sm opacity-75">{song.artist}</div>
                                    </div>
                                </a>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</Modal>