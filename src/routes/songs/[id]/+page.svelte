<script lang="ts">
  import { page } from '$app/state';
  import Song from '$lib/components/Song.svelte';
  import { client } from '$lib/stores/client';
  import { player } from '$lib/stores/player';
  import type { Child, SimilarSongs } from '@vmohammad/subsonic-api';
  import { Play } from 'lucide-svelte';
  import { onMount } from "svelte";

  let loading = true;
  let error: string | null = null;
  let songData: {
    song: Child;
    similarSongs: SimilarSongs;
  };
  const { id } = page.params;

  onMount(async () => {
      try {
          songData = await $client!.getSong(id);
          loading = false;
      } catch (e) {
          error = 'Failed to load song details';
          loading = false;
      }
  });

  function playSong() {
      player.setPlaylist([songData.song], 0);
  }
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
                <div class="relative group">
                    <img src={songData.song.coverArt} alt={songData.song.title} class="rounded-lg w-full object-cover" />
                    <div class="absolute inset-0 bg-black opacity-0 group-hover:opacity-30 transition-opacity duration-200"></div>
                    <button
                        class="absolute bottom-4 right-4 p-3 rounded-full bg-primary text-background hover:opacity-90 transition-all"
                        on:click={() => playSong()}
                    >
                        <Play size={20} />
                    </button>
                </div>
                <div class="mt-4">
                    <h1 class="text-3xl font-bold">{songData.song.title}</h1>
                    <a class="text-text-secondary mt-2" href={`/artists/${songData.song.artistId}`}>{songData.song.artist}</a>
                    <p class="text-text-secondary">{songData.song.year}</p>
                </div>
            </div>
            
            <div class="md:w-2/3 bg-surface rounded-lg p-4">
                <h2 class="text-xl font-bold mb-4">Songs</h2>
                <div class="divide-y divide-primary/20">
                    {#each (songData.similarSongs.song || []).sort((a,b) => (a!.track ?? 0) - (b.track ?? 0)) as song, i}
                        <Song {song} index={i} playlist={songData.similarSongs.song || []} showTrackNumber={false} />
                    {/each}
                </div>
            </div>
        </div>
    {/if}
</div>