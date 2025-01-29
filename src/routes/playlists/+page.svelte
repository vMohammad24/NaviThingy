<script lang="ts">
    import { goto } from '$app/navigation';
    import { formatDate } from '$lib/client/util';
    import { client } from '$lib/stores/client';
    import type { Playlist } from '@vmohammad/subsonic-api';
    import { ListMusic, Lock, Unlock } from 'lucide-svelte';
    import { onMount } from 'svelte';

    let playlists: Playlist[] = [];
    let filteredPlaylists: Playlist[] = [];
    let loading = true;
    let error: string | null = null;
    let newPlaylistName = '';
    let showCreateDialog = false;
    let searchQuery = '';

    onMount(async () => {
        loading = true;
        error = null;
        try {
            playlists = await $client!.getPlaylists() || [];
            filterPlaylists();
            loading = false;
        } catch (e) {
            error = 'Failed to load playlists';
            loading = false;
        }
    });

    function filterPlaylists() {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filteredPlaylists = playlists.filter(playlist => 
                playlist.name.toLowerCase().includes(query) ||
                playlist.owner?.toLowerCase().includes(query)
            );
        } else {
            filteredPlaylists = [...playlists];
        }
    }

    async function createPlaylist() {
        if (newPlaylistName) {
            try {
                await $client!.createPlaylist(newPlaylistName);
                playlists = await $client!.getPlaylists() || [];
                filterPlaylists();
                newPlaylistName = '';
                showCreateDialog = false;
            } catch (e) {
                error = 'Failed to create playlist';
            }
        }
    }

    $: if (searchQuery !== undefined) {
        filterPlaylists();
    }
</script>

<div class="container mx-auto p-4 space-y-6">
    <div class="flex items-center gap-2 mb-6 w-full justify-between">
        <div class="flex items-center gap-2">
            <ListMusic class="text-primary" size={32} />
            <h1 class="text-2xl font-bold">Playlists</h1>
        </div>
        <button 
            class="bg-primary text-surface px-4 py-2 rounded-lg hover:opacity-90"
            on:click={() => showCreateDialog = true}
        >
            Create Playlist
        </button>
    </div>

    <div class="flex flex-col sm:flex-row gap-4 mb-4">
        <input
            type="text"
            placeholder="Search playlists..."
            class="flex-1 px-4 py-2 rounded-lg bg-surface"
            bind:value={searchQuery}
        />
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
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {#each filteredPlaylists as playlist}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div 
                    class="bg-surface rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all cursor-pointer hover:scale-[1.02]"
                    on:click={() => goto(`/playlists/${playlist.id}`)}
                >
                    <div class="aspect-square bg-background/50">
                        {#if playlist.songCount && playlist.songCount > 0}
                            <img 
                                src={`${$client?.getCoverURL(playlist.id)}`} 
                                alt={playlist.name}
                                class="w-full h-full object-cover"
                            />
                        {:else}
                            <div class="w-full h-full flex items-center justify-center">
                                <ListMusic size={48} class="text-text-secondary" />
                            </div>
                        {/if}
                    </div>
                    <div class="p-4">
                        <div class="flex items-center justify-between mb-1">
                            <h3 class="font-semibold text-lg text-text">{playlist.name}</h3>
                            {#if playlist.public !== undefined}
                                {#if playlist.public}
                                    <Unlock size={16} class="text-text-secondary" />
                                {:else}
                                    <Lock size={16} class="text-text-secondary" />
                                {/if}
                            {/if}
                        </div>
                        <p class="text-text-secondary text-sm space-y-1">
                            <span class="block">{playlist.songCount || 0} songs • By {playlist.owner}</span>
                            {#if playlist.changed}
                                <span class="block">Updated {formatDate(playlist.changed)}</span>
                            {/if}
                            {#if playlist.comment}
                                <span class="block italic">{playlist.comment}</span>
                            {/if}
                        </p>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>

{#if showCreateDialog}
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
        <div class="bg-surface p-6 rounded-lg w-96 shadow-xl">
            <h2 class="text-xl font-bold mb-4 text-text">Create New Playlist</h2>
            <input
                type="text"
                bind:value={newPlaylistName}
                class="w-full p-2 border rounded mb-4 bg-background text-text"
                placeholder="Playlist name"
            />
            <div class="flex justify-end gap-2">
                <button 
                    class="px-4 py-2 text-text-secondary hover:text-text"
                    on:click={() => showCreateDialog = false}
                >
                    Cancel
                </button>
                <button 
                    class="bg-primary text-surface px-4 py-2 rounded hover:opacity-90"
                    on:click={createPlaylist}
                >
                    Create
                </button>
            </div>
        </div>
    </div>
{/if}
