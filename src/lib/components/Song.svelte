<script lang="ts">
  import { goto } from "$app/navigation";
  import { download } from "$lib/client/util";
  import { client } from "$lib/stores/client";
  import { player } from "$lib/stores/player";
  import {
    AlbumIcon,
    ArrowUpWideNarrow,
    Download,
    Forward,
    Heart,
    HeartCrack,
    Music,
    Pause,
    Play,
    User,
  } from "@lucide/svelte";
  import type { Child } from "@vmohammad/subsonic-api";
  import ContextMenu from "./ContextMenu.svelte";

  let {
    song,
    index,
    playlist,
    showTrackNumber = true,
    extraOptions = [],
  } = $props<{
    song: Child;
    index: number;
    playlist: Child[];
    showTrackNumber?: boolean;
    extraOptions?: Array<{
      label: string;
      action: () => void;
      icon?: any;
      type?: "separator";
    }>;
  }>();

  let isHovered = $state(false);
  let contextMenu = $state({
    show: false,
    x: 0,
    y: 0,
  });

  function formatDuration(duration: number): string {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  function isCurrentlyPlaying(song: Child) {
    return $player.currentTrack?.id === song.id && $player.isPlaying;
  }

  function playSong(index: number) {
    player.setPlaylist(playlist, index);
  }

  function togglePlay(e: Event) {
    e.stopPropagation();
    if (isCurrentlyPlaying(song)) {
      player.pause();
    } else if ($player.currentTrack?.id === song.id) {
      player.play();
    } else {
      playSong(index);
    }
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    contextMenu = {
      show: true,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handleMenuAction(action: string) {
    switch (action) {
      case "playNow":
        playSong(index);
        break;
      case "playNext":
        player.addToQueueNext(song);
        break;
      case "addToQueue":
        player.addToQueue(song);
        break;
      case "goToArtist":
        if (song.artistId) goto(`/artists/${song.artistId}`);
        break;
      case "goToSong":
        goto(`/songs/${song.id}`);
        break;
      case "goToAlbum":
        if (song.albumId) goto(`/albums/${song.albumId}`);
        break;
      case "download":
        (async () =>
          download(
            await $client!.download(song.id),
            `${song.artist} - ${song.title}`,
          ))();
        break;
      case "favorite":
        if (song.starred) {
          $client!.unstar(song.id, "track");
          song.starred = null;
        } else {
          $client!.star(song.id, "track");
          song.starred = Date.now();
        }
        break;
    }
    contextMenu.show = false;
  }
</script>

<button
  type="button"
  class="group w-full text-left p-2 sm:p-3.5 rounded-xl transition-all duration-300 flex items-center gap-2 sm:gap-4 border-none cursor-pointer relative
    hover:bg-surface/40 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]
    before:absolute before:inset-0 before:rounded-xl before:transition-opacity before:duration-300
    before:opacity-0 group-hover:before:opacity-100 before:bg-gradient-to-r before:from-primary/5 before:to-transparent"
  aria-label="Play {song.title} by {song.artist}"
  onclick={() => playSong(index)}
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => (isHovered = false)}
  oncontextmenu={handleContextMenu}
>
  <div class="relative z-10 flex items-center gap-2 sm:gap-4 w-full">
    <div class="w-8 sm:w-12 flex items-center justify-start">
      {#if isCurrentlyPlaying(song) || $player.currentTrack?.id === song.id}
        <div
          role="button"
          tabindex="0"
          class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/10 hover:bg-primary/20 transition-all duration-300
            flex items-center justify-center group/btn hover:scale-110 active:scale-95"
          onclick={togglePlay}
          aria-label={isCurrentlyPlaying(song) ? "Pause" : "Play"}
          onkeydown={(e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") togglePlay(e);
          }}
        >
          {#if isCurrentlyPlaying(song)}
            <Pause
              size={16}
              class="text-primary group-hover/btn:scale-90 transition-transform"
            />
          {:else}
            <Play
              size={16}
              class="text-primary group-hover/btn:scale-110 transition-transform ml-0.5"
            />
          {/if}
        </div>
      {:else if showTrackNumber}
        <span
          class="w-6 sm:w-8 text-center text-xs sm:text-sm text-text-secondary/60 font-medium"
        >
          {index + 1}
        </span>
      {/if}
    </div>

    {#if song.coverArt}
      <img
        src={song.coverArt}
        alt={song.title}
        loading="lazy"
        class="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover shadow-md transition-transform duration-300 group-hover:scale-105 group-hover:shadow-xl"
      />
    {/if}

    <div class="flex-grow flex flex-col min-w-0 max-w-[50%] sm:max-w-none">
      <div class="flex items-center gap-2">
        <span class="font-medium truncate text-sm sm:text-base"
          >{song.title}</span
        >
        {#if song.starred}
          <Heart class="text-primary animate-pulse-slow" size={12} />
        {/if}
      </div>
      <div class="flex items-center text-xs sm:text-sm text-text-secondary/70">
        <span class="truncate">{song.artist}</span>
        {#if song.album}
          <span class="mx-1.5 text-[8px] sm:text-[10px]">•</span>
          <span class="truncate hidden sm:inline">{song.album}</span>
        {/if}
      </div>
    </div>

    <div class="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm ml-auto">
      <span class="text-text-secondary/60 font-medium hidden lg:block"
        >{song.bitRate ?? "unknown"} kbps</span
      >
      <span class="text-text-secondary/80 font-medium w-12 sm:w-16 text-right"
        >{formatDuration(song.duration!)}</span
      >
    </div>
  </div>
</button>

<ContextMenu
  bind:show={contextMenu.show}
  x={contextMenu.x}
  y={contextMenu.y}
  items={[
    {
      label: "Play Now",
      action: () => handleMenuAction("playNow"),
      icon: Play,
    },
    {
      label: "Play Next",
      action: () => handleMenuAction("playNext"),
      icon: Forward,
    },
    {
      label: "Add to Queue",
      action: () => handleMenuAction("addToQueue"),
      icon: ArrowUpWideNarrow,
    },
    { type: "separator" },
    {
      label: "Go to Artist",
      action: () => handleMenuAction("goToArtist"),
      icon: User,
    },
    {
      label: "Go to Song",
      action: () => handleMenuAction("goToSong"),
      icon: Music,
    },
    {
      label: "Go to Album",
      action: () => handleMenuAction("goToAlbum"),
      icon: AlbumIcon,
    },
    { type: "separator" },
    ...(extraOptions && extraOptions.length > 0
      ? [...extraOptions, { type: "separator" as const }]
      : []),
    {
      label: song.starred ? "Remove from favorites" : "Favorite",
      action: () => handleMenuAction("favorite"),
      icon: song.starred ? HeartCrack : Heart,
    },
    // {
    //   item: Rating,
    //   props: {
    //     id: song.id,
    //     rating: song.userRating ?? 0,
    //   },
    // },
    {
      label: "Download",
      action: () => handleMenuAction("download"),
      icon: Download,
    },
  ]}
  onclose={() => (contextMenu.show = false)}
/>
