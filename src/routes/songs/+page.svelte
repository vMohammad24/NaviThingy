<script lang="ts">
    import Song from '$lib/components/Song.svelte';
    import { client } from '$lib/stores/client';
    import type { Child } from '@vmohammad/subsonic-api';
    import { Heart } from 'lucide-svelte';

    let songs: Child[] = $state([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    async function loadStarredSongs() {
        try {
            loading = true;
            error = null;
            const starred = await $client!.getStarred();
            songs = starred.song || [];
        } catch (e) {
            error = 'Failed to load starred songs';
            console.error(e);
        } finally {
            loading = false;
        }
    }

    $effect(() => {
        if ($client) {
            loadStarredSongs();
        }
    });
</script>

<div class="container mx-auto p-4">
    <div class="flex items-center gap-2 mb-6">
        <Heart class="text-primary" size={32} />
        <h1 class="text-2xl font-bold">Favorites Songs</h1>
    </div>

    {#if loading}
        <div class="text-center py-8">Loading...</div>
    {:else if error}
        <div class="text-red-500 text-center py-8">{error}</div>
    {:else if songs.length === 0}
        <div class="text-center py-8 text-text-secondary">
            No starred songs found. Star some songs to see them here!
        </div>
    {:else}
        <div class="flex flex-col gap-1">
            {#each songs as song, i}
                <Song {song} index={i} playlist={songs} />
            {/each}
        </div>
    {/if}
</div>
