<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Album from "$lib/components/Album.svelte";
  import Song from "$lib/components/Song.svelte";
  import { client } from "$lib/stores/client";
  import { player } from "$lib/stores/player";
  import { selectedServer } from "$lib/stores/selectedServer";
  import { Play } from "@lucide/svelte";
  import type { AlbumWithSongsID3, Child } from "@vmohammad/subsonic-api";
  import { onMount } from "svelte";
  let loading = true;
  let error: string | null = null;
  let album: AlbumWithSongsID3;
  const { id } = page.params;
  let hoveredIndex = -1;
  let showContextMenu = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let selectedSong: Child | null = null;

  onMount(async () => {
    if (!$selectedServer) {
      goto("/");
      return;
    }

    try {
      album = await $client!.getAlbumDetails(id);
      loading = false;
    } catch (e) {
      error = "Failed to load recent albums";
      loading = false;
    }
  });

  function formatDuration(duration: number): string {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  function playAlbum(startIndex = 0) {
    if (!album?.song) return;
    player.setPlaylist(album.song, startIndex);
  }

  function isCurrentlyPlaying(song: Child) {
    return $player.currentTrack?.id === song.id && $player.isPlaying;
  }
</script>

<div class="container mx-auto px-4 py-4 sm:py-6">
  {#if loading}
    <div class="flex justify-center items-center h-64">
      <div
        class="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-primary"
      ></div>
    </div>
  {:else if error}
    <div class="text-center p-4 sm:p-8 rounded-lg bg-surface">
      <p class="text-text-secondary">{error}</p>
    </div>
  {:else}
    <div class="flex flex-col gap-4 sm:gap-6 mb-6 sm:mb-8">
      <div class="w-full flex flex-col sm:flex-row lg:flex-row gap-4 sm:gap-6">
        <div
          class="relative group w-full sm:w-1/3 lg:w-1/4 max-w-[280px] mx-auto sm:mx-0"
        >
          <Album
            album={{ ...album, isDir: false, title: album.name }}
            showMetadata={false}
          />
          <div
            class="absolute inset-0 bg-black opacity-0 group-hover:opacity-30 transition-opacity duration-200"
          ></div>
          <button
            class="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 p-2 sm:p-3 rounded-full bg-primary text-background hover:opacity-90 transition-all"
            onclick={() => playAlbum()}
          >
            <Play size={16} class="sm:hidden" />
            <Play size={20} class="hidden sm:block" />
          </button>
        </div>
        <div class="w-full sm:flex-1 text-center sm:text-left mt-4 sm:mt-0">
          <h1 class="text-xl sm:text-2xl md:text-3xl font-bold">
            {album.name}
          </h1>
          <a
            class="text-text-secondary mt-1 sm:mt-2 hover:text-primary block sm:inline-block"
            href={`/artists/${album.artistId}`}>{album.artist}</a
          >
          <p class="text-text-secondary text-sm sm:text-base">{album.year}</p>
        </div>
      </div>

      <div class="w-full bg-surface rounded-lg p-3 sm:p-4">
        <h2 class="text-lg sm:text-xl font-bold mb-2 sm:mb-4">Songs</h2>
        <div class="divide-y divide-primary/20">
          {#each album.song?.sort( (a, b) => (a.track && b.track ? a.track - b.track : 0), )! as song, i}
            <Song {song} index={i} playlist={album.song!} />
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>
