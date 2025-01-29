<script lang="ts">
    import { page } from '$app/state';
    import { formatDate } from '$lib/client/util';
    import Song from '$lib/components/Song.svelte';
    import { client } from '$lib/stores/client';
    import { player } from '$lib/stores/player';
    import type { PlaylistWithSongs } from '@vmohammad/subsonic-api';
    import { Clock, Edit, ListMusic, Lock, Trash2, Unlock, User } from 'lucide-svelte';
    import { onMount } from 'svelte';

    const playlistId = page.params.id;
    let playlist: PlaylistWithSongs;
    let isEditing = false;
    let editName = '';

    onMount(async () => {
        playlist = await $client!.getPlaylist(playlistId);
        editName = playlist.name;
    });

    async function updatePlaylist() {
        if (editName !== playlist.name) {
            await $client!.updatePlaylist(playlistId, { name: editName });
            playlist.name = editName;
        }
        isEditing = false;
    }

    async function removeSong(songId: string, index: number) {
        await $client!.updatePlaylist(playlistId, { 
            songIndexToRemove: [index] 
        });
        playlist.entry = playlist.entry?.filter((_, i) => i !== index);
    }

    function playPlaylist(startIndex = 0) {
        if (playlist.entry) {
            player.setPlaylist(playlist.entry, startIndex);
        }
    }

    async function deletePlaylist() {
        if (confirm('Are you sure you want to delete this playlist?')) {
            await $client!.deletePlaylist(playlistId);
            history.back();
        }
    }

    async function toggleVisibility() {
        const res = await $client!.updatePlaylist(playlistId, { 
            public: !playlist.public 
        });
        playlist = {
            ...playlist,
            ...res.playlist
        };
    }

    function getTotalDuration() {
        if (!playlist.entry) return 0;
        return playlist.entry.reduce((acc, song) => acc + (song.duration || 0), 0);
    }

    function formatDuration(seconds: number) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }
</script>

<div class="min-h-screen bg-background p-8">
    {#if playlist}
        <div class="bg-surface rounded-lg shadow-md p-6 mb-6">
            <div class="flex gap-6">
                <div class="w-48 h-48 bg-background/50 rounded-lg overflow-hidden">
                    {#if playlist.entry && playlist.entry[0]?.coverArt}
                        <img 
                            src={playlist.entry[0].coverArt} 
                            alt={playlist.name}
                            class="w-full h-full object-cover"
                        />
                    {:else}
                        <div class="w-full h-full flex items-center justify-center">
                            <ListMusic size={64} class="text-text-secondary" />
                        </div>
                    {/if}
                </div>
                
                <div class="flex-1">
                    <div class="flex justify-between items-center mb-4">
                        <div class="flex items-center gap-4">
                            <ListMusic class="text-primary" size={32} />
                            {#if isEditing}
                                <input
                                    type="text"
                                    bind:value={editName}
                                    class="text-2xl font-bold p-2 border rounded bg-background text-text"
                                />
                            {:else}
                                <h1 class="text-2xl font-bold text-text">{playlist.name}</h1>
                            {/if}
                        </div>
                        <div class="flex gap-2">
                            {#if isEditing}
                                <button 
                                    class="bg-primary text-surface px-4 py-2 rounded hover:opacity-90"
                                    on:click={updatePlaylist}
                                >
                                    Save
                                </button>
                                <button 
                                    class="text-text-secondary hover:text-text px-4 py-2"
                                    on:click={() => isEditing = false}
                                >
                                    Cancel
                                </button>
                            {:else}
                                <button 
                                    class="text-text-secondary hover:text-text p-2"
                                    on:click={() => isEditing = true}
                                >
                                    <Edit size={20} />
                                </button>
                                <button 
                                    class="text-text-secondary hover:text-red-500 p-2"
                                    on:click={deletePlaylist}
                                >
                                    <Trash2 size={20} />
                                </button>
                            {/if}
                        </div>
                    </div>
                    <div class="mt-4 space-y-2 text-text-secondary">
                        <div class="flex items-center gap-2">
                            <User size={16} />
                            <span>Created by {playlist.owner}</span>
                            <button 
                                class="flex items-center gap-1 ml-2 hover:text-text"
                                on:click={toggleVisibility}
                            >
                                {#if playlist.public}
                                    <Unlock size={16} />
                                    <span class="text-sm">Public</span>
                                {:else}
                                    <Lock size={16} />
                                    <span class="text-sm">Private</span>
                                {/if}
                            </button>
                        </div>
                        <div class="flex items-center gap-2">
                            <Clock size={16} />
                            <span>Total duration: {formatDuration(getTotalDuration())}</span>
                        </div>
                        {#if playlist.changed}
                            <p>Last updated: {formatDate(playlist.changed)}</p>
                        {/if}
                        {#if playlist.comment}
                            <p class="italic">{playlist.comment}</p>
                        {/if}
                    </div>
                    <div class="flex items-center gap-4 mt-4">
                        <p class="text-text-secondary">{playlist.songCount || 0} songs</p>
                        {#if playlist.entry?.length}
                            <button 
                                class="bg-primary text-surface px-4 py-2 rounded hover:opacity-90"
                                on:click={() => playPlaylist()}
                            >
                                Play
                            </button>
                        {/if}
                    </div>
                </div>
            </div>
        </div>

        <div class="bg-surface rounded-lg shadow-md">
            {#if playlist.entry}
                {#each playlist.entry as song, index}
                    <Song {song} {index} playlist={playlist.entry} showTrackNumber={true} extraOptions={[
                        {
                            label: 'Remove from playlist',
                            action: () => removeSong(song.id, index),
                            icon: Trash2,
                        }
                    ]} />
                {/each}
            {:else}
                <p class="p-4 text-text-secondary">This playlist is empty</p>
            {/if}
        </div>
    {/if}
</div>
