<script lang="ts">
  import { browser } from '$app/environment';
  import { setupMediaSession, updateMediaMetadata, updateMediaPlaybackState } from '$lib/mediaSession';
  import { client } from '$lib/stores/client';
  import { player } from '$lib/stores/player';
  import { queueActions } from '$lib/stores/queueStore';
  import { sidebarHidden } from '$lib/stores/sidebarOpen';
  import type { SyncedLyric } from '$lib/types/navidrome';
  import {
    ListMusic, Maximize2,
    Pause, Play, Repeat, Repeat1, Shuffle,
    SkipBack, SkipForward, Volume, Volume1, Volume2, VolumeX
  } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Queue from './Queue.svelte';
  
  let audio: HTMLAudioElement;
  let progress = 0;
  let duration = 0;
  let volume = Number(localStorage.getItem('volume') ?? '1');
  let previousVolume = volume;
  let showVolume = false;
  let volumeTimeout: ReturnType<typeof setTimeout> | undefined;  
  let currentTrackId: string | null = null;
  let hoveredTime = 0;
  let isHovering = false;
  let tooltipX = 0;
  let isFullscreen = false;
  let lyrics: { synced: boolean; plain: string; lines: SyncedLyric[] } | undefined;
  let currentLyricIndex = -1;
  let lyricsContainer: HTMLDivElement;
  let currentLyricElement: HTMLParagraphElement | null = null;

  if(browser) {
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
      if(document.activeElement instanceof HTMLInputElement) return;
      if(e.key === ' ') {
        e.preventDefault();
        player.togglePlay();
      }
      if(e.key === 'F11' || (e.key === 'f' && e.ctrlKey)) {
        e.preventDefault();
        toggleFullscreen();
      }

      if(e.key === 'ArrowRight') {
        e.preventDefault();
        player.next();
      }

      if(e.key === 'ArrowLeft') {
        e.preventDefault();
        player.previous();
      }

      if(e.key === 'ArrowUp') {
        e.preventDefault();
        updateVolume(volume + 0.05);
        showVolume = true;
        resetVolumeTimeout();
      }

      if(e.key === 'ArrowDown') {
        e.preventDefault();
        updateVolume(volume - 0.05);
        showVolume = true;
        resetVolumeTimeout();
      }

      if(e.key === 'm') {
        e.preventDefault();
        toggleMute();
      }

      if(e.key === 'r') {
        e.preventDefault();
        player.toggleRepeat();
      }

      if(e.key === 's') {
        e.preventDefault();
        player.toggleShuffle();
      }

      if(e.key === 'q') {
        e.preventDefault();
        queueActions.toggle();
      }
    });

    
  }

  $: if ($player.currentTrack && $client && $player.isPlaying) {
    
    if (currentTrackId !== $player.currentTrack.id) {
      currentTrackId = $player.currentTrack.id;
      playStream($player.currentTrack.id);
      scrollToCurrentLyric();
      updateMediaMetadata($player.currentTrack);
    } else if (audio && audio.paused) {
      audio.play();
    }
    updateMediaPlaybackState(true);
  }

  $: if (!$player.isPlaying && audio) {
    audio.pause();
    updateMediaPlaybackState(false);
  }

   async function playStream(id: string) {
    if (!$client) return;
    $client.scrobble(id, true);
    if($player.scrobble) $client.scrobble(id);
    const stream = await $client.getSongStreamURL(id);
    if (!audio) audio = new Audio();
    audio.src = stream;
    audio.volume = volume;
    audio.play();
    $client.saveQueue({
      current: id,
      position: audio.currentTime,
      id: $player.playlist.map(track => track.id).toString()
    })
  }

  

  function updateVolume(value: number) {
    volume = Math.max(0, Math.min(1, value));
    if (audio) audio.volume = volume;
    localStorage.setItem('volume', volume.toString());
  }

  function toggleMute() {
    if (volume === 0) {
      updateVolume(previousVolume || 1);
    } else {
      previousVolume = volume;
      updateVolume(0);
    }
  }

  function getVolumeIcon() {
    if (volume === 0) return VolumeX;
    if (volume < 0.3) return Volume;
    if (volume < 0.7) return Volume1;
    return Volume2;
  }

  function handleVolumeScroll(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    updateVolume(volume + delta);
    showVolume = true;
    resetVolumeTimeout();
  }

  function handleVolumeChange(e: Event) {
    const value = +(e.target as HTMLInputElement).value;
    updateVolume(value);
  }

  function resetVolumeTimeout() {
    if (volumeTimeout) clearTimeout(volumeTimeout);
    volumeTimeout = setTimeout(() => {
      showVolume = false;
    }, 300);
  }

  function handleVolumeHover() {
    showVolume = true;
    if (volumeTimeout) clearTimeout(volumeTimeout);
  }

  function handleVolumeLeave() {
    resetVolumeTimeout();
  }

  
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function handleProgressClick(e: MouseEvent) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    if (audio && duration) {
      audio.currentTime = percentage * duration;
    }
  }

  function handleProgressHover(e: MouseEvent) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    hoveredTime = percentage * duration;
    tooltipX = x;
    isHovering = true;
  }

  function handleProgressLeave() {
    isHovering = false;
  }

  async function toggleFullscreen() {
    isFullscreen = !isFullscreen;
    sidebarHidden.set(isFullscreen);
    if (isFullscreen && $player.currentTrack) {
      if($client)
        lyrics = await $client.getLyrics($player.currentTrack!);
      scrollToCurrentLyric();
    }
  }

  $: if ($player.currentTrack && isFullscreen) {
      (async () => {
          lyrics = await $client?.getLyrics($player.currentTrack!);
      })();
  }

  function updateCurrentLyric() {
    if (!lyrics?.synced) return;
    
    const newIndex = lyrics.lines.findIndex((line, i) => {
      const nextTime = lyrics!.lines[i + 1]?.time ?? Infinity;
      return progress >= line.time && progress < nextTime;
    });

    if (newIndex !== -1 && newIndex !== currentLyricIndex) {
      currentLyricIndex = newIndex;
    }
  }

  function seekToLyric(time: number) {
    if (audio) {
      audio.currentTime = time;
    }
  }

  function scrollToCurrentLyric() {
    if (!lyricsContainer) return;
    if(!currentLyricElement) {
      if(currentLyricIndex == -1) currentLyricIndex = 0;
      currentLyricElement = lyricsContainer.childNodes[currentLyricIndex] as HTMLParagraphElement;
    }
    const containerHeight = lyricsContainer.clientHeight;
    const lyricTop = currentLyricElement.offsetTop;
    const lyricHeight = currentLyricElement.clientHeight;
    
    lyricsContainer.scrollTo({
      top: lyricTop - containerHeight / 2 + lyricHeight / 2,
      behavior: 'smooth'
    });
  }

  $: if (currentLyricIndex !== -1) {
    scrollToCurrentLyric();
  }

  onMount(() => {
    setupMediaSession();
    audio = new Audio();
    audio.addEventListener('timeupdate', () => {
      progress = audio.currentTime;
      duration = audio.duration;
      updateCurrentLyric();
    });
    
    audio.addEventListener('ended', () => {
      if ($player.repeat === 'one') {
        audio.play();
      } else {
        player.next();
      }
    });

    (async () => {
      if(!$client) return;
      const queue = await $client.getQueue();
      if(!queue) return;
      if(queue.entry) {
        player.setPlaylist(queue.entry, queue.entry.findIndex(t => t.id === queue.current) ?? 0, false);
        if(queue.position) {
          audio.currentTime = queue.position;
        }
      }
    })()

    return () => {
      if (audio) {
        audio.pause();
        audio.src = '';
      }
      if (volumeTimeout) clearTimeout(volumeTimeout);  
    };
  });
</script>

{#if $player.currentTrack}
  {#if isFullscreen}
    <div
      class="fixed inset-0 bg-cover bg-center bg-no-repeat z-20"
      style="background-image: url('{$player.currentTrack.coverArt}');"
        >
      <div class="absolute inset-0 bg-black/50"></div>
      style="background-image: url('{$player.currentTrack.coverArt}')"
      in:fade={{ duration: 1000 }}
    ></div>
  {/if}

  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div 
    class="fixed transition-all duration-300 z-30 border-primary/20"
    class:bottom-0={!isFullscreen}
    class:top-0={isFullscreen}
    class:left-0={true}
    class:right-0={true}
    class:h-screen={isFullscreen}
    class:p-4={true}
    class:border-t={!isFullscreen}
    class:backdrop-blur-2xl={isFullscreen}
    class:backdrop-blur-md={!isFullscreen}
  >
    {#if duration > 0}
      <div class="absolute top-0 left-0 right-0">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
          class="relative h-1 bg-primary/20 cursor-pointer group"
          on:click={handleProgressClick}
          on:mousemove={handleProgressHover}
          on:mouseleave={handleProgressLeave}
        >
          <div 
            class="absolute h-1 bg-primary transition-all duration-300"
            style:width="{(progress / duration) * 100}%"
          ></div>
          {#if isHovering}
            <div 
              class="absolute h-1 bg-primary/30"
              style="view-transition-name: active;"
              style:width="{(hoveredTime / duration) * 100}%"
            ></div>
            <div 
              class="absolute bottom-4 py-1 px-2 rounded bg-surface shadow text-xs transform -translate-x-1/2"
              style="left: {tooltipX}px"
            >
              {formatTime(hoveredTime)}
            </div>
          {/if}
        </div>
        <div class="flex justify-between px-4 text-xs text-text-secondary mt-1">
          <span>{formatTime(progress)}</span>
          <span>{isHovering ? formatTime(hoveredTime) : formatTime(duration)}</span>
        </div>
      </div>
    {/if}

    <div class="container mx-auto h-full">
      {#if isFullscreen}
        <div class="h-full flex flex-col gap-4 p-4 bg-surface/40" transition:fade>
          <div class="w-full flex items-center gap-4 p-4 bg-surface/50 rounded-lg">
            <img 
              src={$player.currentTrack.coverArt} 
              alt={$player.currentTrack.title}
              class="w-24 h-24 rounded-lg shadow-xl object-cover"
            />
            <div class="flex flex-col flex-1">
              <a class="text-2xl font-bold text-text-secondary hover:text-primary" 
                href="/songs/{$player.currentTrack.id}" 
                on:click={toggleFullscreen}
              >{$player.currentTrack.title}</a>
              <a class="text-xl text-text-secondary hover:text-primary" 
                href="/artists/{$player.currentTrack.artistId}" 
                on:click={toggleFullscreen}
              >{$player.currentTrack.artist}</a>
              {#if $player.currentTrack.album}
                <a class="text-lg text-text-secondary hover:text-primary mt-1" 
                  href="/albums/{$player.currentTrack.albumId}" 
                  on:click={toggleFullscreen}
                >{$player.currentTrack.album}</a>
              {/if}
            </div>
          
          </div>

          <div class="flex-1 flex gap-4 min-h-0">
            <div class="flex-1 bg-surface/50 rounded-lg overflow-hidden flex flex-col">
              <h3 class="text-lg font-semibold p-4 border-b border-primary/20">Lyrics</h3>
              <div 
                class="flex-1 overflow-y-auto p-4 lyrics-container"
                bind:this={lyricsContainer}
              >
                {#if lyrics}
                  {#if lyrics.synced}
                    <div class="flex flex-col gap-4">
                      {#each lyrics.lines as line, i}
                        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                        {#if i === currentLyricIndex}
                          <p
                            class="text-2xl transition-all duration-300 whitespace-pre-wrap cursor-pointer hover:text-primary bg-primary/10 p-4 rounded-lg"
                            class:text-primary={i === currentLyricIndex}
                            class:opacity-50={i !== currentLyricIndex}
                            bind:this={currentLyricElement}
                            on:click={() => seekToLyric(line.time)}
                          >
                            {line.text}
                          </p>
                        {:else}
                          <p
                            class="text-xl transition-all duration-300 whitespace-pre-wrap cursor-pointer hover:text-primary hover:bg-primary/5 p-4 rounded-lg"
                            class:text-primary={i === currentLyricIndex}
                            class:opacity-50={i !== currentLyricIndex}
                            on:click={() => seekToLyric(line.time)}
                          >
                            {line.text}
                          </p>
                        {/if}
                      {/each}
                    </div>
                  {:else}
                    <p class="text-xl whitespace-pre-wrap p-4">{lyrics.plain}</p>
                  {/if}
                {:else}
                  <div class="h-full flex flex-col items-center justify-center text-text-secondary">
                    <p class="text-xl mb-2">No lyrics available</p>
                    <p class="text-sm opacity-75">Try searching online for "{$player.currentTrack.title} by {$player.currentTrack.artist}" lyrics</p>
                  </div>
                {/if}
              </div>
            </div>

            <div class="w-96 bg-surface/50 rounded-lg overflow-hidden flex flex-col">
              <Queue minimal={true} />
            </div>
          </div>

          <div class="w-full p-4 bg-surface/50 rounded-lg flex justify-center">
            <div class="flex items-center gap-6">
              <button 
                class="p-2 rounded-full hover:bg-primary/20 transition-colors"
                class:text-primary={$player.shuffle}
                on:click={() => player.toggleShuffle()}
              >
                <Shuffle size={24} />
              </button>

              <button 
                class="p-2 rounded-full hover:bg-primary/20 transition-colors"
                on:click={() => player.previous()}
              >
                <SkipBack size={32} />
              </button>
              
              <button 
                class="p-4 rounded-full bg-primary text-background hover:opacity-90 transition-all hover:scale-105"
                on:click={() => player.togglePlay()}
              >
                {#if $player.isPlaying}
                  <Pause size={40} />
                {:else}
                  <Play size={40} />
                {/if}
              </button>
              
              <button 
                class="p-2 rounded-full hover:bg-primary/20 transition-colors"
                on:click={() => player.next()}
              >
                <SkipForward size={32} />
              </button>
              
              <button 
                class="p-2 rounded-full hover:bg-primary/20 transition-colors"
                class:text-primary={$player.repeat !== 'none'}
                on:click={() => player.toggleRepeat()}
              >
                {#if $player.repeat === 'one'}
                  <Repeat1 size={24} />
                {:else}
                  <Repeat size={24} />
                {/if}
              </button>
            </div>
          </div>
        </div>
      {:else}
        <div class="flex items-center justify-between mt-4">
          <div class="flex items-center gap-4">
            {#if $player.currentTrack}
              <img 
                src={$player.currentTrack.coverArt} 
                alt={$player.currentTrack.title}
                class="w-12 h-12 rounded shadow-lg transition-transform hover:scale-105"
                in:fade
              />
              <div class="min-w-0 flex flex-col">
                <a class="font-medium truncate" href="/songs/{$player.currentTrack.id}">{$player.currentTrack.title}</a>
                <a class="text-sm text-text-secondary truncate" href="/artists/{$player.currentTrack.artistId}">{$player.currentTrack.artist}</a>
              </div>
            {/if}
          </div>
          
          <div class="flex items-center gap-6">
            <button 
              class="p-2 rounded-full hover:bg-primary/20 transition-colors"
              class:text-primary={$player.shuffle}
              on:click={() => player.toggleShuffle()}
            >
              <Shuffle size={20} />
            </button>

            <button 
              class="p-2 rounded-full hover:bg-primary/20 transition-colors"
              on:click={() => player.previous()}
            >
              <SkipBack size={24} />
            </button>
            
            <button 
              class="p-3 rounded-full bg-primary text-background hover:opacity-90 transition-all hover:scale-105"
              on:click={() => player.togglePlay()}
            >
              {#if $player.isPlaying}
                <Pause size={24} />
              {:else}
                <Play size={24} />
              {/if}
            </button>
            
            <button 
              class="p-2 rounded-full hover:bg-primary/20 transition-colors"
              on:click={() => player.next()}
            >
              <SkipForward size={24} />
            </button>
            
            <button 
              class="p-2 rounded-full hover:bg-primary/20 transition-colors"
              class:text-primary={$player.repeat !== 'none'}
              on:click={() => player.toggleRepeat()}
            >
              {#if $player.repeat === 'one'}
                <Repeat1 size={20} />
              {:else if $player.repeat === 'all'}
                <Repeat size={20} />
              {:else}
                <Repeat size={20} style="opacity: 0.5;" />
              {/if}
            </button>

            <button 
              class="p-2 rounded-full hover:bg-primary/20 transition-colors flex items-center gap-2"
              on:click={queueActions.toggle}
            >
              <ListMusic size={20} />
            </button>

            <div class="relative group">
              <button 
                class="p-2 rounded-full hover:bg-primary/20 transition-colors"
                on:click={toggleMute}
                on:wheel|preventDefault={handleVolumeScroll}
                on:mouseenter={handleVolumeHover}
                on:mouseleave={handleVolumeLeave}
              >
                <svelte:component this={getVolumeIcon()} size={20} />
              </button>
              
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div 
                class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 rounded-lg bg-surface shadow-lg transition-opacity duration-200"
                class:opacity-0={!showVolume}
                class:pointer-events-none={!showVolume}
                on:mouseenter={handleVolumeHover}
                on:mouseleave={handleVolumeLeave}
              >
                <div class="w-32 flex items-center gap-2">
                  <div class="relative flex-1 h-1 bg-primary/20 rounded-full">
                    <div 
                      class="absolute h-1 bg-primary rounded-full transition-all"
                      style:width="{volume * 100}%"
                    ></div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01"
                      value={volume}
                      class="absolute inset-0 w-full opacity-0 cursor-pointer"
                      on:input={handleVolumeChange}
                    />
                  </div>
                  <span class="text-xs text-text-secondary w-8 text-right">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              </div>
            </div>
            <button 
              class="p-2 rounded-full hover:bg-primary/20 transition-colors"
              class:text-primary={isFullscreen}
              on:click={toggleFullscreen}
            >
              <Maximize2 size={20} />
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>

  .lyrics-container {
    scrollbar-width: none;  /* Firefox */
    -ms-overflow-style: none;  /* IE and Edge */
  }
  
  .lyrics-container::-webkit-scrollbar {
    display: none;  /* Chrome, Safari and Opera */
  }

  @media (orientation: portrait) {
    .lyrics-container {
      max-height: 40vh;
    }
  }

  @media (min-width: 1024px) {
    .lyrics-container {
      max-height: none;
    }
  }
</style>