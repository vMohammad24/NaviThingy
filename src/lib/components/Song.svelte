<script lang="ts">
    import { goto } from '$app/navigation';
    import { download } from '$lib/client/util';
    import { client } from '$lib/stores/client';
    import { player } from '$lib/stores/player';
    import type { Child } from '@vmohammad/subsonic-api';
    import { AlbumIcon, ArrowUpWideNarrow, Download, Forward, Heart, HeartCrack, Music, Pause, Play, User } from 'lucide-svelte';
    import ContextMenu from './ContextMenu.svelte';

    let { song, index, playlist, showTrackNumber = true, extraOptions = [] } = $props<{
        song: Child;
        index: number;
        playlist: Child[];
        showTrackNumber?: boolean;
        extraOptions?: Array<{
            label: string;
            action: () => void;
            icon?: any;
            type?: 'separator';
        }>;
    }>();

    let isHovered = $state(false);
    let contextMenu = $state({
        show: false,
        x: 0,
        y: 0
    });

    function formatDuration(duration: number): string {
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    function isCurrentlyPlaying(song: Child) {
        return $player.currentTrack?.id === song.id && $player.isPlaying;
    }

    function playSong(index: number) {
        player.setPlaylist(playlist, index);
    }

    function togglePlay(e: MouseEvent) {
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
            y: event.clientY
        };
    }

    function handleMenuAction(action: string) {
        switch (action) {
            case 'playNow':
                playSong(index);
                break;
            case 'playNext':
                player.addToQueueNext(song);
                break;
            case 'addToQueue':
                player.addToQueue(song);
                break;
            case 'goToArtist':
                if (song.artistId) goto(`/artists/${song.artistId}`);
                break;
            case 'goToSong':
                goto(`/songs/${song.id}`);
                break;
            case 'goToAlbum':
                if (song.albumId) goto(`/albums/${song.albumId}`);
                break;
            case 'download':
                (async () => download(await $client!.download(song.id), `${song.artist} - ${song.title}`))();
                break;
            case 'favorite':
                if(song.starred) {
                    $client!.unstar(song.id, 'track');
                    song.starred = null;
                } else {
                    $client!.star(song.id, 'track');
                    song.starred = Date.now();
                }
                break;
        }
        contextMenu.show = false;
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
    class="p-3 rounded transition-colors flex items-center gap-4 border-none cursor-pointer relative"
    onclick={() => playSong(index)}
    onmouseenter={() => isHovered = true}
    onmouseleave={() => isHovered = false}
    oncontextmenu={handleContextMenu}
>
    <div 
        class="absolute inset-0 bg-black transition-opacity duration-200"
        style:opacity={isHovered ? "0.3" : "0"}
    ></div>
    {#if isCurrentlyPlaying(song) || $player.currentTrack?.id === song.id}
        <button
            class="hover:text-primary transition-colors w-6 h-6 flex items-center justify-start"
            onclick={togglePlay}
        >
            {#if isCurrentlyPlaying(song)}
                <Pause size={24} />
            {:else}
                <Play size={24} />
            {/if}
        </button>
    {:else if showTrackNumber}
        <span class="w-6 text-right">{(index + 1)}</span>
    {/if}
    {#if song.coverArt}
        <img src={song.coverArt} alt={song.title} class="w-12 h-12 rounded object-cover" />
    {/if}
    <div class="flex-grow flex flex-col relative z-10">
        <div class="flex items-center gap-2">
            <span class="font-medium">{song.title}</span>
            {#if song.starred}
                <Heart class="text-primary" size={16} />
            {/if}
        </div>
        <div class="flex items-center text-sm text-text-secondary">
            <span>{song.artist}</span>
            {#if song.album}
                <span class="mx-1">•</span>
                <span>{song.album}</span>
            {/if}
        </div>
    </div>
    <span class="text-text-secondary text-sm w-20 text-right relative z-10">{song.bitRate ?? 'unknown'} kbps</span>
    <span class="text-text-secondary w-16 text-right relative z-10">{formatDuration(song.duration!)}</span>
</div>

<ContextMenu
    bind:show={contextMenu.show}
    x={contextMenu.x}
    y={contextMenu.y}
    items={[
        { label: 'Play Now', action: () => handleMenuAction('playNow'), icon: Play },
        { label: 'Play Next', action: () => handleMenuAction('playNext'), icon: Forward },
        { label: 'Add to Queue', action: () => handleMenuAction('addToQueue'), icon: ArrowUpWideNarrow },
        { type: 'separator' },
        { label: 'Go to Artist', action: () => handleMenuAction('goToArtist'), icon: User },
        { label: 'Go to Song', action: () => handleMenuAction('goToSong'), icon: Music },
        { label: 'Go to Album', action: () => handleMenuAction('goToAlbum'), icon: AlbumIcon },
        { type: 'separator' },
        ...(extraOptions && extraOptions.length > 0 ? [...extraOptions, { type: 'separator' as const }] : []),
        { label: song.starred ? 'Remove from favorites' : 'Favorite', action: () => handleMenuAction('favorite'), icon: song.starred ? HeartCrack : Heart },
        { label: 'Download', action: () => handleMenuAction('download'), icon: Download }
    ]}
    on:close={() => contextMenu.show = false}
/>