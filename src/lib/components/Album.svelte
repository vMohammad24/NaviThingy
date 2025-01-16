<script lang="ts">
  import { download } from '$lib/client/util';
  import { client } from '$lib/stores/client';
  import { player } from "$lib/stores/player";
  import { Pause, Play } from 'lucide-svelte';
  import type { Child } from "subsonic-api";
  import ContextMenu from './ContextMenu.svelte';

  export let album: Child;  
  export let showMetadata = true;
  $: isPlaying = $player.currentTrack?.id === album.id && $player.isPlaying;

  let contextMenu = {
    show: false,
    x: 0,
    y: 0
  };
  
  let isHovered = false;

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    contextMenu = {
      show: true,
      x: e.clientX,
      y: e.clientY
    };
  }

  async function handleMenuAction(action: string) {
    if (!$client) return;
    
    switch (action) {
        case 'play':
            player.playAlbum(album);
            break;
            
        case 'playShuffled':
            player.playAlbum(album, true);
            break;
            
        case 'download':
            const response = $client.download(album.id);
            download(response, `${album.artist} - ${album.album}.zip`);
            break;
        case 'queue':
            const albumDetails = await $client.getAlbumDetails(album.id);
            if(albumDetails.song)
            player.addToQueue(albumDetails.song);
    }
    
    contextMenu.show = false;
  }

  function togglePlay(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isPlaying) {
      player.pause();
    } else if ($player.currentTrack?.id === album.id) {
      player.play();
    } else {
      
      player.playAlbum(album);
    }
  }
</script>

<a 
    class="rounded-lg overflow-hidden shadow-md transition-all duration-200 hover:shadow-xl relative group bg-surface"
    on:contextmenu={handleContextMenu}
    href="/album/{album.id}"
    on:mouseenter={() => isHovered = true}
    on:mouseleave={() => isHovered = false}
>
    {#if album.coverArt}
        <div class="relative">
            <img
                src={album.coverArt}
                alt={album.album}
                id="album"
                class="w-full aspect-square object-cover"
            />
            <div 
                class="absolute inset-0 bg-black transition-opacity duration-200"
                style:opacity={isHovered ? "0.3" : "0"}
            ></div>
            {#if isPlaying || ($player.currentTrack?.id === album.id)}
                <button
                    class="absolute bottom-2 right-2 p-2 rounded-full bg-primary text-background hover:opacity-90 transition-all"
                    on:click={togglePlay}
                >
                    {#if isPlaying}
                        <Pause size={20} />
                    {:else}
                        <Play size={20} />
                    {/if}
                </button>
            {/if}
        </div>
    {/if}
    {#if showMetadata}
        <div class="p-4">
            <h3 class="font-semibold text-lg">{album.album}</h3>
            <p class="text-text-secondary">
                {album.artist}
                {#if album.year}
                    • {album.year}
                {/if}
            </p>
        </div>
    {/if}
</a>

<ContextMenu
    bind:show={contextMenu.show}
    x={contextMenu.x}
    y={contextMenu.y}
    items={[
        { label: 'Play', action: () => handleMenuAction('play') },
        { label: 'Play shuffled', action: () => handleMenuAction('playShuffled') },
        {label: 'Add to queue', action: () => handleMenuAction('queue')},
        { type: 'separator' },
        { label: 'Download', action: () => handleMenuAction('download') },
    ]}
    on:close={() => contextMenu.show = false}
/>
