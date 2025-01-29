<script lang="ts">
    import Album from '$lib/components/Album.svelte';
    import HeroSong from '$lib/components/HeroSong.svelte';
    import { client } from '$lib/stores/client';
    import type { Child } from '@vmohammad/subsonic-api';
    import { onMount } from 'svelte';
    import { quintOut } from 'svelte/easing';
    import { fade, fly } from 'svelte/transition';

    let loading = $state(true);
    let error: string | null = $state(null);
    let username: string = $state('');
    let randomSong: Child | null = $state(null);
    let recentAlbums: Child[] = $state([]);
    let mostPlayed: Child[] = $state([]);
    let recentlyPlayed: Child[] = $state([]);

    async function loadData() {
        if (!$client) return;
        loading = true;
        error = null;
        try {
            const [random, recent, top, played, user] = await Promise.all([
                $client.getRandomSongs(1),
                $client.getAlbums('newest', {
                    size: 12
                }),
                $client.getAlbums('frequent', {
                    size: 12
                }),
                $client.getAlbums('recent', {
                    size: 12
                }),
                $client.getUserData()
            ]);
            
            randomSong = random.song![0];
            recentAlbums = recent.album || [];
            mostPlayed = top.album || [];
            recentlyPlayed = played.album || [];
            username = user.username;
            loading = false;
        } catch (e) {
            error = 'Failed to load data';
            loading = false;
        }
    }

    onMount(async () => {
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

<div class="container mx-auto p-4 space-y-8">
    {#if loading}
        <div class="grid gap-8">
            <div class="h-48 bg-surface/30 animate-pulse rounded-2xl"></div>
            {#each Array(3) as _}
                <div class="space-y-4">
                    <div class="h-8 w-48 bg-surface/30 animate-pulse rounded-lg"></div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {#each Array(6) as _}
                            <div class="aspect-square bg-surface/30 animate-pulse rounded-xl"></div>
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
    {:else if error}
        <div in:fade={{ duration: 300 }} class="text-center p-12 rounded-2xl bg-surface/50 backdrop-blur">
            <p class="text-text-secondary text-lg">{error}</p>
            <button 
                class="mt-4 px-6 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                onclick={loadData}
            >
                Retry
            </button>
        </div>
    {:else}
        <header 
            in:fly={{ y: 20, duration: 500, delay: 0 }}
            class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 to-surface p-8"
        >
            <h1 class="text-4xl font-bold mb-2">Welcome Back {username}</h1>
            <!-- <div class="mt-6 flex gap-8 text-sm text-text-secondary">
                <div>
                    <div class="font-medium text-xl text-text-primary">Some stats title</div>
                    <div>Some stats</div>
                </div>
                <div>
                    <div class="font-medium text-xl text-text-primary">Some stats title</div>
                    <div>Some stats</div>
                </div>
            </div> -->
        </header>

        {#if randomSong}
            <div in:fly={{ y: 20, duration: 500, delay: 100 }}>
                <HeroSong song={randomSong} onNext={getNewRandomSong} />
            </div>
        {/if}

        {#each [
            { title: 'Most Played', albums: mostPlayed, link: 'frequent' },
            { title: 'Recently Added', albums: recentAlbums, link: 'newest' },
            { title: 'Recently Played', albums: recentlyPlayed, link: 'recent' }
        ] as section, i}
            <section 
                in:fly={{ 
                    y: 20, 
                    duration: 500, 
                    delay: 200 + (i * 100),
                    easing: quintOut
                }}
            >
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-2xl font-bold">{section.title}</h2>
                    <a href="/albums/?activeTab={section.link}" 
                       class="text-sm text-text-secondary hover:text-primary transition-colors">
                        View All
                    </a>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {#each section.albums as album, albumIndex}
                        <Album 
                            {album}
                            showMetadata
                        />
                    {/each}
                </div>
            </section>
        {/each}
    {/if}
</div>