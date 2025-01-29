<script lang="ts">
    import { player } from "$lib/stores/player";
    import type { Child } from '@vmohammad/subsonic-api';
    import { Pause, Play, SkipForward } from 'lucide-svelte';
    import { fly } from 'svelte/transition';

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

<div 
    class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-surface to-surface/80 p-8 backdrop-blur-sm"
    in:fly={{ y: 20, duration: 500 }}
>
    <div class="flex flex-col md:flex-row gap-8">
        <div class="relative group md:w-1/3">
            <img 
                src={song.coverArt} 
                alt={song.title} 
                class="w-full aspect-square object-cover rounded-xl shadow-xl transition-transform duration-300 group-hover:scale-[1.02]"
            />
            <div 
                class="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl"
            ></div>
            <button
                class="absolute bottom-4 right-4 p-4 rounded-full bg-primary text-background hover:scale-105 hover:bg-primary-light active:scale-95 transition-all shadow-lg opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0"
                on:click={togglePlay}
            >
                {#if isPlaying}
                    <Pause size={28} />
                {:else}
                    <Play size={28} />
                {/if}
            </button>
        </div>
        
        <div class="md:w-2/3 space-y-6">
            <div class="flex justify-between items-start">
                <div>
                    <h2 class="text-4xl font-bold mb-2 line-clamp-2">{song.title}</h2>
                    <div class="space-y-1">
                        <a 
                            href={`/artists/${song.artistId}`} 
                            class="text-2xl text-text-secondary hover:text-primary transition-colors inline-block"
                        >
                            {song.artist}
                        </a>
                        <a 
                            href={`/albums/${song.albumId}`} 
                            class="block text-xl text-text-secondary/80 hover:text-primary transition-colors"
                        >
                            {song.album}
                        </a>
                    </div>
                </div>
                <button
                    class="p-3 rounded-full bg-surface/80 backdrop-blur-sm text-text-primary hover:scale-105 hover:bg-surface active:scale-95 transition-all shadow-lg"
                    on:click={onNext}
                >
                    <SkipForward size={24} />
                </button>
            </div>
            
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-text-secondary/80">
                <div class="space-y-1">
                    <div class="text-sm uppercase tracking-wider opacity-75">Duration</div>
                    <div>{formatDuration(song.duration!)}</div>
                </div>
                <div class="space-y-1">
                    <div class="text-sm uppercase tracking-wider opacity-75">Bitrate</div>
                    <div>{song.bitRate ?? 'Unknown'} kbps</div>
                </div>
                {#if song.year}
                    <div class="space-y-1">
                        <div class="text-sm uppercase tracking-wider opacity-75">Year</div>
                        <div>{song.year}</div>
                    </div>
                {/if}
                {#if song.genre}
                    <div class="space-y-1">
                        <div class="text-sm uppercase tracking-wider opacity-75">Genre</div>
                        <div class="capitalize">{song.genre.toLowerCase()}</div>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>