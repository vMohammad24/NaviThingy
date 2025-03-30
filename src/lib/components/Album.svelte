<script lang="ts">
  import { download } from "$lib/client/util";
  import { client } from "$lib/stores/client";
  import { player } from "$lib/stores/player";
  import type { Child } from "@vmohammad/subsonic-api";
  import {
    ArrowUpWideNarrow,
    Download,
    Heart,
    HeartCrack,
    Pause,
    Play,
  } from "lucide-svelte";
  import { createEventDispatcher } from "svelte";
  import { quintOut } from "svelte/easing";
  import { scale } from "svelte/transition";
  import ContextMenu from "./ContextMenu.svelte";

  export let album: Child;
  export let showMetadata = true;
  $: isPlaying = $player.currentTrack?.id === album.id && $player.isPlaying;

  let contextMenu = {
    show: false,
    x: 0,
    y: 0,
  };

  const dispatch = createEventDispatcher();

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    contextMenu = {
      show: true,
      x: e.clientX,
      y: e.clientY,
    };
  }
  let show = true;

  function reloadComponent() {
    show = false;
    setTimeout(() => (show = true), 0);
  }

  async function handleMenuAction(action: string) {
    if (!$client) return;

    switch (action) {
      case "play":
        player.playAlbum(album);
        break;

      case "playShuffled":
        player.playAlbum(album, true);
        break;

      case "download":
        const response = await $client.download(album.id);
        download(response, `${album.artist} - ${album.album}.zip`);
        break;
      case "queue":
        const albumDetails = await $client.getAlbumDetails(album.id);
        if (albumDetails.song) player.addToQueue(albumDetails.song);
        break;
      case "favorite":
        if (album.starred) {
          await $client.unstar(album.id, "track");
          dispatch("update", { ...album, starred: null });
        } else {
          await $client.star(album.id, "album");
          dispatch("update", { ...album, starred: new Date() });
        }
        break;
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

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="group relative" on:contextmenu={handleContextMenu}>
  <div
    class="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-90 -z-10 transition-all duration-500 opacity-0 group-hover:opacity-100 group-hover:scale-110"
  ></div>

  <a
    class="block relative overflow-hidden rounded-2xl bg-surface/30 backdrop-blur-sm border border-white/5 shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-primary/20"
    href="/albums/{album.id}"
  >
    {#if album.coverArt}
      <div class="relative aspect-square">
        <img
          src={album.coverArt}
          alt={album.album}
          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
          in:scale|local={{ duration: 300, easing: quintOut, start: 0.95 }}
        />
        <div
          class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300"
        >
          {#if isPlaying || $player.currentTrack?.id === album.id}
            <button
              class="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 p-2 sm:p-4 rounded-full bg-primary text-background hover:scale-110 active:scale-95 transition-all shadow-lg"
              on:click={togglePlay}
            >
              {#if isPlaying}
                <Pause class="w-5 h-5 sm:w-6 sm:h-6" />
              {:else}
                <Play class="w-5 h-5 sm:w-6 sm:h-6" />
              {/if}
            </button>
          {/if}
        </div>
      </div>
    {/if}

    {#if showMetadata}
      <div class="p-3 sm:p-4 md:p-6 space-y-1 sm:space-y-2">
        <h3
          class="font-bold text-base sm:text-lg md:text-xl line-clamp-1 group-hover:text-primary transition-colors"
        >
          {album.album}
        </h3>
        <div class="flex items-center justify-between">
          <p
            class="text-sm sm:text-base text-text-secondary group-hover:text-text-primary transition-colors line-clamp-1"
          >
            {album.artist}
          </p>
          {#if album.year}
            <span
              class="text-xs sm:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-surface/50 text-text-secondary"
            >
              {album.year}
            </span>
          {/if}
        </div>
        {#if isPlaying}
          <div
            class="h-1 w-full bg-surface/30 rounded-full overflow-hidden mt-2 sm:mt-4"
          >
            <div
              class="h-full bg-primary rounded-full w-1/2 animate-progress"
            ></div>
          </div>
        {/if}
      </div>
    {/if}
  </a>
</div>

<ContextMenu
  bind:show={contextMenu.show}
  x={contextMenu.x}
  y={contextMenu.y}
  items={[
    { label: "Play", action: () => handleMenuAction("play"), icon: Play },
    {
      label: "Play shuffled",
      action: () => handleMenuAction("playShuffled"),
      icon: Play,
    },
    {
      label: "Add to queue",
      action: () => handleMenuAction("queue"),
      icon: ArrowUpWideNarrow,
    },
    { type: "separator" },
    {
      label: album.starred ? "Remove from favorites" : "Favorite",
      action: () => handleMenuAction("favorite"),
      icon: album.starred ? HeartCrack : Heart,
    },
    {
      label: "Download",
      action: () => handleMenuAction("download"),
      icon: Download,
    },
  ]}
  on:close={() => (contextMenu.show = false)}
/>
