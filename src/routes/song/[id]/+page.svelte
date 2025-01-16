<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { download } from '$lib/client/util';
  import ContextMenu from '$lib/components/ContextMenu.svelte';
  import { client } from '$lib/stores/client';
  import { player } from '$lib/stores/player';
  import { selectedServer } from '$lib/stores/selectedServer';
  import { Pause, Play } from 'lucide-svelte';
  import type { Child, SimilarSongs } from 'subsonic-api';
  import { onMount } from "svelte";
  let loading = true;
  let error: string | null = null;
  let songData: {
    song: Child;
    similarSongs: SimilarSongs;
};
  const { id } = page.params;
  let hoveredIndex = -1;
  let showContextMenu = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let selectedSong: Child | null = null;


    onMount(async () => {
        if (!$selectedServer) {
            goto('/');
            return;
        }

        try {
            songData = await $client!.getSong(id);
            loading = false;
        } catch (e) {
            error = 'Failed to load song details';
            loading = false;
        }
    });

   function formatDuration(duration: number): string {
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  function playSong(index = 0, fromSimilar = false) {
      if (fromSimilar) {
          player.setPlaylist(songData.similarSongs.song!, index);
      } else {
          player.setPlaylist([songData.song], 0);
      }
  }

  function isCurrentlyPlaying(song: Child) {
      return $player.currentTrack?.id === song.id && $player.isPlaying;
  }

  function togglePlay(song: Child, index: number) {
      if (isCurrentlyPlaying(song)) {
          player.pause();
      } else if ($player.currentTrack?.id === song.id) {
          player.play();
      } else {
          playSong(index, true);
      }
  }

  function handleContextMenu(event: MouseEvent, song: Child) {
      event.preventDefault();
      showContextMenu = true;
      contextMenuX = event.clientX;
      contextMenuY = event.clientY;
      selectedSong = song;
  }

  function closeContextMenu() {
    showContextMenu = false;
    selectedSong = null;
}

function handlePlayNow() {
    if (selectedSong && songData.similarSongs.song) {
        const index = selectedSong ? songData.similarSongs.song.findIndex(s => s.id === selectedSong!.id) : -1;
        if (index !== -1) {
            playSong(index);
        }
    }
    closeContextMenu();
}

function handlePlayNext() {
    if (selectedSong) {
        player.addToQueueNext(selectedSong);
    }
    closeContextMenu();
}

function handleAddToQueue() {
    if (selectedSong) {
        player.addToQueue(selectedSong);
    }
    closeContextMenu();
}

function handleGoToArtist() {
    if (selectedSong?.artistId) {
        goto(`/artist/${selectedSong.artistId}`);
    }
    closeContextMenu();
}

function handleGoToSong() {
    if (selectedSong) {
        goto(`/song/${selectedSong.id}`);
    }
    closeContextMenu();
}

function handleGoToAlbum() {
    if (selectedSong?.albumId) {
        goto(`/album/${selectedSong.albumId}`);
    }
    closeContextMenu();
}

function handleDownload() {
    if (selectedSong) {
        download($client!.download(selectedSong.id), `${selectedSong.artist} - ${selectedSong.title}`);
    }
    closeContextMenu();
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
                    <a class="text-text-secondary mt-2" href={`/artist/${songData.song.artistId}`}>{songData.song.artist}</a>
                    <p class="text-text-secondary">{songData.song.year}</p>
                </div>
            </div>
            
            <div class="md:w-2/3 bg-surface rounded-lg p-4">
                <h2 class="text-xl font-bold mb-4">Songs</h2>
                <div class="divide-y divide-primary/20">
                    {#each (songData.similarSongs.song || []).sort((a,b) => (a!.track ?? 0) - (b.track ?? 0)) as song, i}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div 
                            class="p-3 rounded transition-colors flex items-center gap-4 border-none cursor-pointer relative"
                            on:click={() => playSong(i, true)}
                            on:mouseenter={() => hoveredIndex = i}
                            on:mouseleave={() => hoveredIndex = -1}
                            on:contextmenu={(e) => handleContextMenu(e, song)}
                        >
                            <div 
                                class="absolute inset-0 bg-black transition-opacity duration-200"
                                style:opacity={hoveredIndex === i ? "0.3" : "0"}
                            ></div>
                                {#if isCurrentlyPlaying(song) || $player.currentTrack?.id === song.id}
                                    <button
                                        class="hover:text-primary transition-colors w-6 h-6 flex items-center justify-start"
                                        on:click|stopPropagation={() => togglePlay(song, i)}
                                    >
                                        {#if isCurrentlyPlaying(song)}
                                            <Pause size={20} />
                                        {:else}
                                            <Play size={20} />
                                        {/if}
                                    </button>
                                {:else}
                                    <span class="w-6 text-right">{i + 1}</span>
                                {/if}
                            {#if song.coverArt}
                                <img src={song.coverArt} alt={song.title} class="w-12 h-12 rounded object-cover" />
                            {/if}
                            <span class="flex-grow relative z-10">{song.title}</span>
                            <span class="text-text-secondary text-sm w-20 text-right relative z-10">{song.bitRate ?? 'unknown'} kbps</span>
                            <span class="text-text-secondary w-16 text-right relative z-10">{formatDuration(song.duration!)}</span>
                        </div>
                    {/each}
                </div>
            </div>
        </div>
    {/if}
</div>

<ContextMenu
    bind:show={showContextMenu}
    x={contextMenuX}
    y={contextMenuY}
    items={[
        { label: 'Play Now', action: handlePlayNow },
        { label: 'Play Next', action: handlePlayNext },
        { label: 'Add to Queue', action: handleAddToQueue },
        { type: 'separator' },
        { label: 'Go to Artist', action: handleGoToArtist },
        {label: 'Go to song', action: handleGoToSong},
        {label: 'Go to album', action: handleGoToAlbum},
        {type: 'separator'},
        { label: 'Download', action: handleDownload }
      ]}
/>