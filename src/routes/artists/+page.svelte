<script lang="ts">
    import { client } from '$lib/stores/client';
    import type { ArtistID3, IndexID3 } from '@vmohammad/subsonic-api';
    import { onMount } from 'svelte';

    interface ArtistViewSettings {
        sortBy: 'name' | 'albumCount';
        sortDirection: 'asc' | 'desc';
    }

    const STORAGE_KEY = 'artist_view_settings';

    function loadSettings(): ArtistViewSettings {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
        return {
            sortBy: 'name',
            sortDirection: 'asc'
        };
    }

    function saveSettings() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ sortBy, sortDirection }));
    }

    let loading = true;
    let error: string | null = null;
    let indices: IndexID3[] = [];
    let artists: ArtistID3[] = [];
    let filteredArtists: ArtistID3[] = [];
    let searchQuery = '';

    const stored = loadSettings();
    let sortBy = stored.sortBy;
    let sortDirection = stored.sortDirection;

    
    $: {
        if (sortBy && sortDirection) {
            saveSettings();
        }
    }

    async function loadArtists() {
        if (!$client) return;
        loading = true;
        error = null;
        try {
            const result = await $client.getArtists();
            indices = result.index || [];
            artists = indices.flatMap(index => index.artist || []);
            filterAndSortArtists();
            loading = false;
        } catch (e) {
            error = 'Failed to load artists';
            loading = false;
        }
    }

    function filterAndSortArtists() {
        filteredArtists = [...artists];
        
        
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filteredArtists = filteredArtists.filter(artist => 
                artist.name.toLowerCase().includes(query)
            );
        }

        filteredArtists.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'albumCount':
                    comparison = a.albumCount - b.albumCount;
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }

    function handleSort(newSortBy: typeof sortBy) {
        if (sortBy === newSortBy) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortBy = newSortBy;
            sortDirection = 'asc';
        }
        filterAndSortArtists();
    }

    $: if (searchQuery !== undefined) {
        filterAndSortArtists();
    }

    onMount(async () => {
        await loadArtists();
    });
</script>

<div class="container mx-auto p-4 space-y-6">
    <div class="flex flex-col sm:flex-row gap-4 mb-4">
        <input
            type="text"
            placeholder="Search artists..."
            class="flex-1 px-4 py-2 rounded-lg bg-surface"
            bind:value={searchQuery}
        />
        <div class="flex gap-2">
            <button
                class="px-4 py-2 rounded-lg bg-surface hover:bg-surface-hover"
                on:click={() => handleSort('name')}
            >
                Name {sortBy === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
            </button>
            <button
                class="px-4 py-2 rounded-lg bg-surface hover:bg-surface-hover"
                on:click={() => handleSort('albumCount')}
            >
                Albums {sortBy === 'albumCount' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
            </button>
        </div>
    </div>

    {#if loading}
        <div class="flex justify-center items-center h-64">
            <div class="animate-spin rounded-full h-12 w-12 border-4 border-primary"></div>
        </div>
    {:else if error}
        <div class="text-center p-8 rounded-lg bg-surface">
            <p class="text-text-secondary">{error}</p>
        </div>
    {:else}
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {#each filteredArtists as artist}
                <a 
                    href="/artists/{artist.id}" 
                    class="block p-4 rounded-lg bg-surface hover:bg-surface-hover transition-colors"
                >
                    <div class="aspect-square mb-2 bg-surface-hover rounded-lg overflow-hidden">
                        {#if artist.artistImageUrl}
                            <img 
                                src={artist.artistImageUrl} 
                                alt={artist.name}
                                class="w-full h-full object-cover"
                            />
                        {:else}
                            <div class="w-full h-full flex items-center justify-center text-4xl text-text-secondary">
                                🎵
                            </div>
                        {/if}
                    </div>
                    <h3 class="font-medium truncate">{artist.name}</h3>
                    <p class="text-sm text-text-secondary">{artist.albumCount} album{artist.albumCount === 1 ? '' : 's'}</p>
                </a>
            {/each}
        </div>
    {/if}
</div>
