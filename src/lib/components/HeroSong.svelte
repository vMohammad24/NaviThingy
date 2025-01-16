
<script lang="ts">
    import { player } from "$lib/stores/player";
    import { Pause, Play, SkipForward } from 'lucide-svelte';
    import type { Child } from "subsonic-api";

    export let song: Child;
    export let onNext: () => void;

    $: isPlaying = $player.currentTrack?.id === song.id && $player.isPlaying;

    function togglePlay() {
        if (isPlaying) {
            player.pause();
        } else if ($player.currentTrack?.id === song.id) {
            player.play();
        } else {
            player.setPlaylist([song], 0);
        }
    }

    function formatDuration(duration: number): string {
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
</script>

<div class="bg-surface rounded-lg p-6 mb-8">
    <div class="flex flex-col md:flex-row gap-8">
        <div class="relative group md:w-1/3">
            <img 
                src={song.coverArt} 
                alt={song.title} 
                class="w-full aspect-square object-cover rounded-lg shadow-lg"
            />
            <div class="absolute inset-0 bg-black opacity-0 group-hover:opacity-30 transition-opacity duration-200 rounded-lg"></div>
            <div class="absolute bottom-4 right-4 flex gap-2">
                <button
                    class="p-3 rounded-full bg-primary text-background hover:opacity-90 transition-all"
                    on:click={togglePlay}
                >
                    {#if isPlaying}
                        <Pause size={24} />
                    {:else}
                        <Play size={24} />
                    {/if}
                </button>
                <button
                    class="p-3 rounded-full bg-primary text-background hover:opacity-90 transition-all"
                    on:click={onNext}
                >
                    <SkipForward size={24} />
                </button>
            </div>
        </div>
        <div class="md:w-2/3 space-y-4">
            <h2 class="text-4xl font-bold">{song.title}</h2>
            <div class="space-y-2">
                <a href={`/artist/${song.artistId}`} class="text-2xl text-text-secondary hover:text-primary">
                    {song.artist}
                </a>
                <a href={`/album/${song.albumId}`} class="block text-xl text-text-secondary hover:text-primary">
                    {song.album}
                </a>
            </div>
            <div class="text-text-secondary space-y-1">
                <p>Duration: {formatDuration(song.duration!)}</p>
                <p>Bitrate: {song.bitRate ?? 'Unknown'} kbps</p>
                {#if song.year}<p>Year: {song.year}</p>{/if}
                {#if song.genre}<p>Genre: {song.genre}</p>{/if}
            </div>
        </div>
    </div>
</div>