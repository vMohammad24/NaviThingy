<script lang="ts">
    import { goto } from '$app/navigation';
    import Album from '$lib/components/Album.svelte';
    import HeroSong from '$lib/components/HeroSong.svelte';
    import { client } from '$lib/stores/client';
    import { selectedServer } from '$lib/stores/selectedServer';
    import type { Child } from 'subsonic-api';
    import { onMount } from 'svelte';

    let loading = true;
    let error: string | null = null;
    
    let randomSong: Child;
    let recentAlbums: Child[] = [];
    let mostPlayed: Child[] = [];
    let recentlyPlayed: Child[] = [];

    async function loadData() {
        if (!$client) return;
        loading = true;
        error = null;
        try {
            const [random, recent, top, played] = await Promise.all([
                $client.getRandomSongs(1),
                $client.getRecentAlbums(12),
                $client.getMostPlayed(12),
                $client.getRecentlyPlayed(12)
            ]);
            
            randomSong = random.song![0];
            recentAlbums = recent.album || [];
            mostPlayed = top.album || [];
            recentlyPlayed = played.album || [];
            loading = false;
        } catch (e) {
            error = 'Failed to load data';
            loading = false;
        }
    }

    onMount(async () => {
        if (!$selectedServer) {
            goto('/');
            return;
        }
        await loadData();
    });

    function getNewRandomSong() {
        if ($client) {
            $client.getRandomSongs(1).then(res => {
                randomSong = res.song![0];
            });
        }
    }

</script>

<div class="container mx-auto p-4 space-y-6">
    {#if loading}
        <div class="flex justify-center items-center h-64">
            <div class="animate-spin rounded-full h-12 w-12 border-4 border-primary"></div>
        </div>
    {:else if error}
        <div class="text-center p-8 rounded-lg bg-surface">
            <p class="text-text-secondary">{error}</p>
        </div>
    {:else}
        {#if randomSong}
            <HeroSong song={randomSong} onNext={getNewRandomSong} />
        {/if}

        <section>
            <h2 class="text-2xl font-bold mb-3">Most Played</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {#each mostPlayed as album}
                    <Album {album} />
                {/each}
            </div>
        </section>

        <section>
            <h2 class="text-2xl font-bold mb-3">New Releases</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {#each recentAlbums as album}
                    <Album {album} />
                {/each}
            </div>
        </section>

        <section>
            <h2 class="text-2xl font-bold mb-3">Recently Played</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {#each recentlyPlayed as album}
                    <Album {album} />
                {/each}
            </div>
        </section>
    {/if}
</div>