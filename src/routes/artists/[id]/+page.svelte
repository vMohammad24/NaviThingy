<script lang="ts">
    import { page } from '$app/state';
    import Album from '$lib/components/Album.svelte';
    import { client } from '$lib/stores/client';
    import type { ArtistInfo, ArtistWithAlbumsID3 } from '@vmohammad/subsonic-api';
    import { onMount } from "svelte";

    let loading = true;
    let error: string | null = null;
    let artist: {
    artist: ArtistWithAlbumsID3;
    artistInfo: ArtistInfo;
    };
    const { id } = page.params;

    onMount(async () => {
        try {
            artist = await $client!.getArtist(id);
            loading = false;
        } catch (e) {
            error = 'Failed to load artist details';
            loading = false;
        }
    });
</script>

<div class="container mx-auto p-4">
    {#if loading}
        <div class="flex justify-center items-center h-64">
            <div class="animate-spin rounded-full h-12 w-12 border-4 border-primary"></div>
        </div>
    {:else if error}
        <div class="text-center p-8 rounded-lg bg-surface">
            <p class="text-text-secondary">{error}</p>
        </div>
    {:else}
        <div class="flex flex-col md:flex-row gap-8 mb-8">
            <div class="md:w-1/3">
                {#if artist.artist.artistImageUrl}
                    <img 
                        src={artist.artist.artistImageUrl} 
                        alt={artist.artist.name} 
                        class="rounded-lg w-full shadow-lg sticky top-4" 
                    />
                {/if}
                <div class="mt-4">
                    <h1 class="text-3xl font-bold">{artist.artist.name}</h1>
                    {#if artist.artist.albumCount}
                        <p class="text-text-secondary mt-2">{artist.artist.albumCount} albums</p>
                    {/if}
                </div>
            {#if artist.artistInfo.biography}
                <div class="mt-4">
                    <h2 class="text-xl font-bold">Biography</h2>
                    {@html artist.artistInfo.biography}
                </div>
            {/if}
            </div>
            
            <div class="md:w-2/3 bg-surface rounded-lg p-4">
                <h2 class="text-xl font-bold mb-4">Albums</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {#each artist.artist.album?.reverse() || [] as album}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <Album album={{ ...album, isDir: false, title: album.name }} />
                    {/each}
                </div>
            </div>
        </div>
    {/if}
</div>
