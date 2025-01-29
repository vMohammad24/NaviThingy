<script lang="ts">
  import { page } from '$app/state';
  import Album from '$lib/components/Album.svelte';
  import { client } from '$lib/stores/client';
  import type { Child } from '@vmohammad/subsonic-api';
  import { Disc } from 'lucide-svelte';
  import { onMount } from 'svelte';

    interface AlbumViewSettings {
        activeTab: 'newest' | 'highest' | 'frequent' | 'recent' | 'favorites';
        sortBy: 'name' | 'artist' | 'year';
        sortDirection: 'asc' | 'desc';
        pageSize: number;
    }

    const STORAGE_KEY = 'album_view_settings';
    const genre = page.url.searchParams.get('genre') ?? undefined;
    function loadSettings(): AlbumViewSettings {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
        return {
            activeTab: 'favorites',
            sortBy: 'name',
            sortDirection: 'asc',
            pageSize: 50
        };
    }

    function saveSettings() {
        const settings: AlbumViewSettings = {
            activeTab,
            sortBy,
            sortDirection,
            pageSize
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    let loading = true;
    let error: string | null = null;
    
    let albums: Child[] = [];
    let filteredAlbums: Child[] = [];
    let currentPage = 0;
    let totalAlbums = 0;
    let searchQuery = '';

    
    const stored = loadSettings();
    let activeTab = page.url.searchParams.get('activeTab') as "newest" | "highest" | "frequent" | "recent" | "favorites"  ?? stored.activeTab;
    let sortBy = stored.sortBy;
    let sortDirection = stored.sortDirection;
    let pageSize = stored.pageSize;

    
    $: {
        if (activeTab && sortBy && sortDirection && pageSize) {
            saveSettings();
        }
    }

    const tabs = [
        { id: 'favorites', label: 'Favorites' },
        { id: 'newest', label: 'New Releases' },
        { id: 'highest', label: 'Highest Rated' },
        { id: 'frequent', label: 'Most Played' },
        { id: 'recent', label: 'Recently Played' },
    ];

    async function loadAlbums() {
        if (!$client) return;
        loading = true;
        error = null;
        try {
            const result = await $client.getAlbums(activeTab, {
                size: pageSize,
                offset: currentPage * pageSize,
                genre
            });
            albums = result.album || [];
            totalAlbums = albums.length === pageSize ? 
                (currentPage + 2) * pageSize : 
                (currentPage * pageSize) + albums.length;
            filterAndSortAlbums();
            loading = false;
        } catch (e) {
            error = 'Failed to load albums';
            loading = false;
        }
    }

    function filterAndSortAlbums() {
        filteredAlbums = [...albums];
        
        
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filteredAlbums = filteredAlbums.filter(album => 
                album.title?.toLowerCase().includes(query) ||
                album.artist?.toLowerCase().includes(query)
            );
        }

        
        filteredAlbums.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'name':
                    comparison = (a.title || '').localeCompare(b.title || '');
                    break;
                case 'artist':
                    comparison = (a.artist || '').localeCompare(b.artist || '');
                    break;
                case 'year':
                    comparison = (a.year || 0) - (b.year || 0);
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
        filterAndSortAlbums();
    }

    function changePage(delta: number) {
        currentPage = Math.max(0, currentPage + delta);
        loadAlbums();
    }

    function changePageSize(newSize: number) {
        pageSize = newSize;
        currentPage = 0;
        loadAlbums();
    }

    $: if (searchQuery !== undefined) {
        filterAndSortAlbums();
    }

    onMount(async () => {
        await loadAlbums();
    });
</script>

<div class="container mx-auto p-4 space-y-6">
    
    <div class="flex items-center gap-2 mb-6 w-full justify-between">
        <div class="flex items-center gap-2 mb-6">
            <Disc class="text-primary" size={32} />
            <h1 class="text-2xl font-bold">Albums</h1>
        </div>
        <div class="flex flex-wrap gap-2 mb-4">
        {#each tabs as tab}
            <button
                class="px-4 py-2 rounded-lg {activeTab === tab.id ? 'bg-primary text-white' : 'bg-surface hover:bg-surface-hover'}"
                on:click={() => {
                    activeTab = tab.id as typeof activeTab;
                    loadAlbums();
                }}
            >
                {tab.label}
            </button>
        {/each}
    </div>
    </div>

    <div class="flex flex-col sm:flex-row gap-4 mb-4">
        <input
            type="text"
            placeholder="Search albums..."
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
                on:click={() => handleSort('artist')}
            >
                Artist {sortBy === 'artist' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
            </button>
            <button
                class="px-4 py-2 rounded-lg bg-surface hover:bg-surface-hover"
                on:click={() => handleSort('year')}
            >
                Year {sortBy === 'year' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
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
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {#each filteredAlbums as album}
                <Album {album} />
            {/each}
        </div>

        <div class="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 bg-surface p-4 rounded-lg">
            <div class="flex items-center gap-4">
                <span class="text-text-secondary">
                    Showing {currentPage * pageSize + 1} - {Math.min((currentPage + 1) * pageSize, totalAlbums)} of {totalAlbums}
                </span>
                <select 
                    class="bg-surface-hover rounded px-2 py-1"
                    bind:value={pageSize}
                    on:change={() => changePageSize(pageSize)}
                >
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                    <option value={200}>200 per page</option>
                </select>
            </div>
            
            <div class="flex gap-2">
                <button
                    class="px-4 py-2 rounded-lg bg-surface-hover disabled:opacity-50"
                    on:click={() => changePage(-1)}
                    disabled={currentPage === 0}
                >
                    Previous
                </button>
                <button
                    class="px-4 py-2 rounded-lg bg-surface-hover disabled:opacity-50"
                    on:click={() => changePage(1)}
                    disabled={albums.length < pageSize}
                >
                    Next
                </button>
            </div>
        </div>
    {/if}
</div>
