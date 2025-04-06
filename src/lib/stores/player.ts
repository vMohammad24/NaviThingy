import { updateMediaMetadata, updateMediaPlaybackState } from '$lib/mediaSession';
import { NavidromeClient } from '$lib/navidrome';
import { invoke } from '@tauri-apps/api/core';
import type { Child } from '@vmohammad/subsonic-api';
import toast from 'svelte-french-toast';
import { writable } from 'svelte/store';
import { client as cl } from './client';

export type RepeatMode = 'none' | 'one' | 'all';

export const mpvSettings = writable({
    enabled: localStorage.getItem('mpvEnabled') === 'true',
    customPath: localStorage.getItem('mpvCustomPath') || '',
    initialized: false,
    autoInit: true,
    preciseSeek: localStorage.getItem('mpvPreciseSeek') === 'true' || true as boolean,
    cacheSize: parseInt(localStorage.getItem('mpvCacheSize') || '10'),
    keepOpen: true,
    nativePlaylist: localStorage.getItem('mpvUseNativePlaylist') !== 'false',
});

export const mpvStatus = writable({
    initialized: false,
    position: 0,
    duration: 0,
    volume: 1,
    state: 'idle',
    playlist_pos: -1,
    playlist_count: 0,
    media_title: null as string | null,
    playback_time: null as number | null,
    pause: null as boolean | null,
    chapter: null as number | null,
    chapter_count: null as number | null
});

async function initMpv() {
    try {
        const mpvConfig = get(mpvSettings);
        if (!mpvConfig.enabled) return false;

        const customPath = mpvConfig.customPath.trim() || undefined;
        const result = await invoke<boolean>('mpv_init', { customPath });

        if (result) {
            mpvSettings.update(s => ({ ...s, initialized: true }));
            console.log("MPV initialized successfully");

            startMpvStatusPolling();
            return true;
        } else {
            console.error("MPV initialization returned false");
            mpvSettings.update(s => ({ ...s, initialized: false }));
            return false;
        }
    } catch (error: any) {
        console.error('Failed to initialize MPV:', error);
        toast.error('Failed to initialize MPV player. Check settings.');
        mpvSettings.update(s => ({ ...s, initialized: false }));
        return false;
    }
}

let mpvStatusInterval: NodeJS.Timeout | null = null;
let mpvStatusThrottle = {
    lastPoll: 0,
    minInterval: 100,
    isPolling: false,
    activeInterval: 250,
    idleInterval: 1000
};

function startMpvStatusPolling() {
    if (mpvStatusInterval) clearInterval(mpvStatusInterval);

    const updatePoll = async () => {
        const now = Date.now();
        if (mpvStatusThrottle.isPolling || (now - mpvStatusThrottle.lastPoll < mpvStatusThrottle.minInterval)) {
            return;
        }

        try {
            mpvStatusThrottle.isPolling = true;
            mpvStatusThrottle.lastPoll = now;

            if (invoke) {
                const status = await invoke<{
                    initialized: boolean;
                    position: number;
                    duration: number;
                    volume: number;
                    state: string;
                    playlist_pos: number;
                    playlist_count: number;
                    media_title?: string | null;
                    playback_time?: number | null;
                    pause?: boolean | null;
                    chapter?: number | null;
                    chapter_count?: number | null;
                }>('mpv_get_status');

                if (status.playlist_pos < 0 && status.playlist_count > 0) {
                    status.playlist_pos = 0;
                }

                mpvStatus.set({
                    initialized: status.initialized,
                    position: status.position,
                    duration: status.duration,
                    volume: status.volume,
                    state: status.state,
                    playlist_pos: status.playlist_pos,
                    playlist_count: status.playlist_count,
                    media_title: null,
                    playback_time: null,
                    pause: null,
                    chapter: null,
                    chapter_count: null
                });

                const isActive = status.state === 'playing';
                mpvStatusThrottle.activeInterval = isActive ? 250 : 1000;

                if (mpvStatusInterval) {
                    clearInterval(mpvStatusInterval);
                    mpvStatusInterval = setInterval(updatePoll, mpvStatusThrottle.activeInterval);
                }
            }
        } catch (error: any) {
            console.error('Failed to get MPV status:', error);
        } finally {
            mpvStatusThrottle.isPolling = false;
        }
    };

    mpvStatusInterval = setInterval(updatePoll, mpvStatusThrottle.activeInterval);
}

function stopMpvStatusPolling() {
    if (mpvStatusInterval) {
        clearInterval(mpvStatusInterval);
        mpvStatusInterval = null;
    }
}

class AudioPlayer {
    private audio: HTMLAudioElement;
    private preloadedAudio: HTMLAudioElement | null = null;
    private client: NavidromeClient | null = null;
    private state: PlayerState | null = null;
    public volume: number;
    public progress = 0;
    public duration = 0;
    private onEndedCallback?: () => void;
    private useMpv = false;
    private mpvInitialized = false;
    private trackEndTriggered = false;
    private mpvPlaylistLoaded = false;
    private lastMpvPlaylistPos = -1;
    private useNativeMpvPlaylist = true;
    public isMpvEnabled(): boolean {
        return this.useMpv && this.mpvInitialized;
    }

    public hasMpvPlaylistLoaded(): boolean {
        return this.mpvPlaylistLoaded;
    }

    constructor(initialState: PlayerState) {
        this.audio = new Audio();
        this.volume = Number(localStorage.getItem('volume') ?? '1');
        this.audio.volume = this.volume;
        this.state = initialState;


        this.useMpv = localStorage.getItem('mpvEnabled') === 'true';


        if (this.useMpv) {
            const mpvConfig = get(mpvSettings);
            if (mpvConfig.autoInit) {
                initMpv().then(success => {
                    this.mpvInitialized = success as boolean;
                    if (success) {
                        this.syncMpvVolume();
                        if (this.state?.isPlaying) {
                            startMpvStatusPolling();
                        }
                    }
                });
            }


            const unsubscribe = mpvStatus.subscribe(status => {
                this.progress = status.position;
                this.duration = status.duration;
                if (this.state && status.pause !== null) {
                    const shouldBePlaying = !status.pause;
                    if (this.state.isPlaying !== shouldBePlaying) {
                        console.log(`Syncing player playing state to MPV: ${shouldBePlaying}`);
                        this.state.isPlaying = shouldBePlaying;
                    }
                }

                if (status.playlist_pos !== undefined &&
                    status.playlist_pos !== this.lastMpvPlaylistPos &&
                    status.playlist_pos >= 0 &&
                    this.mpvPlaylistLoaded &&
                    this.state?.playlist &&
                    this.state?.playlist.length > 0) {

                    this.lastMpvPlaylistPos = status.playlist_pos;

                    if (this.state && this.state.currentIndex !== status.playlist_pos) {
                        console.log(`MPV changed track to playlist index: ${status.playlist_pos}`);

                        if (this.onPlaylistPositionChanged) {
                            this.onPlaylistPositionChanged(status.playlist_pos);
                        }
                    }
                }

                if ((status.state === 'ended' ||
                    (status.duration > 0 && status.position >= status.duration - 0.5)) &&
                    this.state?.isPlaying) {

                    if (!this.trackEndTriggered) {
                        this.trackEndTriggered = true;
                        if ((this.state.currentIndex === this.state.playlist.length - 1 && this.state.repeat !== 'all') ||
                            this.state.repeat === 'one') {

                            if (this.onEndedCallback) {
                                console.log('MPV final track ended or repeat-one active, triggering callback');
                                this.onEndedCallback();
                            }
                        }
                    }
                } else {
                    this.trackEndTriggered = false;
                }
            });
        }

        this.audio.addEventListener('timeupdate', () => {
            if (this.useMpv && this.mpvInitialized) return;

            this.progress = this.audio.currentTime;
            this.duration = this.audio.duration;

            if (this.duration - this.progress <= 10 && !this.preloadedAudio) {
                this.preloadNext();
            }
        });

        this.audio.addEventListener('ended', () => {
            if (this.useMpv && this.mpvInitialized) return;

            if (this.onEndedCallback) {
                this.onEndedCallback();
            }
        });

        this.audio.addEventListener('error', () => {
            if (this.useMpv && this.mpvInitialized) return;

            console.error('Audio playback error:', this.audio.error);
            if (this.state?.isPlaying) {
                this.state.isPlaying = false;
            }
        });

        this.audio.addEventListener('playing', () => {
            if (this.useMpv && this.mpvInitialized) return;

            if (this.state && !this.state.isPlaying) {
                this.state.isPlaying = true;
            }
        });

        this.audio.addEventListener('pause', () => {
            if (this.useMpv && this.mpvInitialized) return;

            if (this.state?.isPlaying) {
                this.state.isPlaying = false;
            }
        });
    }

    private syncMpvVolume() {
        if (this.useMpv && this.mpvInitialized && invoke) {
            console.log(`Syncing MPV volume to ${this.volume}`);
            invoke('mpv_set_volume', { volume: this.volume }).catch(console.error);
        }
    }

    private onPlaylistPositionChanged?: (index: number) => void;
    onPlaylistPositionChange(callback: (index: number) => void) {
        this.onPlaylistPositionChanged = callback;
    }

    private async preloadNext() {
        if (!this.client || !this.state || this.useMpv) return;

        const nextIndex = this.state.currentIndex + 1;
        if (nextIndex >= this.state.playlist.length) {
            if (this.state.repeat !== 'all') return;

            const nextTrack = this.state.playlist[0];
            await this.preloadTrack(nextTrack);
        } else {
            const nextTrack = this.state.playlist[nextIndex];
            await this.preloadTrack(nextTrack);
        }
    }

    private async preloadTrack(track: Child) {
        if (!this.client || this.useMpv) return;

        try {
            const stream = await this.client.getSongStreamURL(track.id);
            this.preloadedAudio = new Audio(stream);
            this.preloadedAudio.preload = 'auto';
            this.preloadedAudio.volume = this.volume;
        } catch (error) {
            console.error('Preload failed:', error);
            toast.error(`Failed to preload next track: ${track.title}`);
            this.preloadedAudio = null;
        }
    }

    setState(state: PlayerState) {
        this.state = state;
    }

    setMpvEnabled(enabled: boolean) {
        this.useMpv = enabled;

        if (enabled && !this.mpvInitialized) {
            initMpv().then(success => {
                this.mpvInitialized = success as boolean;
                if (success) {
                    this.syncMpvVolume();

                    if (this.state?.isPlaying && this.state.currentTrack) {

                        this.audio.pause();
                        this.playStream(this.state.currentTrack);
                        startMpvStatusPolling();
                    }
                }
            });
        } else if (!enabled && this.state?.isPlaying && this.state.currentTrack) {

            if (invoke) {
                invoke('mpv_stop').catch(console.error);
            }
            stopMpvStatusPolling();
            this.playStream(this.state.currentTrack);
        }

        if (!enabled) {
            stopMpvStatusPolling();
        }
    }

    private async saveProgress() {
        if (!this.client || !this.state || !this.state.currentTrack) return;
        await this.client?.saveQueue({
            current: this.state?.currentTrack.id,
            position: Number(((this.useMpv ? this.progress : this.audio.currentTime) * 1000).toFixed()),
            id: this.state.playlist.map(t => t.id).join(',')
        });
    }


    public applyReplayGain(track: Child) {
        if (!this.state?.replayGain.enabled || !track.replayGain) {
            this.audio.volume = this.volume;
            if (this.useMpv && this.mpvInitialized && invoke) {
                invoke('mpv_set_volume', { volume: this.volume }).catch(console.error);
            }
            return;
        }

        const rg = track.replayGain;
        let gain = 1.0;

        if (this.state.replayGain.mode === 'track' && rg.trackGain !== undefined) {
            gain = Math.pow(10, rg.trackGain / 20);
        } else if (this.state.replayGain.mode === 'album' && rg.albumGain !== undefined) {
            gain = Math.pow(10, rg.albumGain / 20);
        } else if (rg.fallbackGain !== undefined) {
            gain = Math.pow(10, rg.fallbackGain / 20);
        }

        gain *= Math.pow(10, this.state.replayGain.preAmp / 20);

        if (rg.baseGain !== undefined) {
            gain *= Math.pow(10, rg.baseGain / 20);
        }

        const peak = rg.trackPeak ?? rg.albumPeak ?? 1.0;
        gain = Math.min(gain, 1.0 / peak);

        const adjustedVolume = Math.min(1.0, this.volume * gain);

        this.audio.volume = adjustedVolume;

        if (this.useMpv && this.mpvInitialized && invoke) {
            invoke('mpv_set_volume', { volume: adjustedVolume }).catch(console.error);
        }
    }

    async loadPlaylist(tracks: Child[], startIndex = 0) {
        if (!this.client || !this.state) return false;

        try {
            this.mpvPlaylistLoaded = false;
            this.lastMpvPlaylistPos = -1;

            if (this.useMpv && (this.mpvInitialized || (await initMpv())) && invoke) {
                if (this.useNativeMpvPlaylist) {
                    const trackUrlMap = new Map<string, string>();
                    const streamUrls: string[] = [];
                    const trackIds: string[] = [];

                    console.log(`Loading playlist with ${tracks.length} tracks`);
                    const urlPromises = tracks.map(async (track) => {
                        try {
                            const url = await this.client!.getSongStreamURL(track.id);
                            return { id: track.id, url };
                        } catch (error) {
                            console.error(`Failed to get stream URL for track ${track.title}:`, error);
                            return null;
                        }
                    });

                    const results = await Promise.all(urlPromises);

                    for (const result of results) {
                        if (result) {
                            trackUrlMap.set(result.id, result.url);
                        }
                    }

                    for (const track of tracks) {
                        const url = trackUrlMap.get(track.id);
                        if (url) {
                            streamUrls.push(url);
                            trackIds.push(track.id);
                        }
                    }

                    if (streamUrls.length === 0) {
                        console.error('No valid stream URLs found for playlist');
                        return false;
                    }

                    console.log(`Prepared ${streamUrls.length} valid URLs for playlist`);

                    await invoke('mpv_stop');

                    await invoke('mpv_load_playlist_optimized', { urls: streamUrls });

                    await new Promise(resolve => setTimeout(resolve, 150));

                    const status = await invoke<{ playlist_count: number, playlist_pos: number }>('mpv_get_status');

                    if (status.playlist_count !== streamUrls.length) {
                        console.warn(`Playlist length mismatch: expected ${streamUrls.length}, got ${status.playlist_count}`);
                    }

                    console.log(`Initial playlist position: ${status.playlist_pos}`);


                    if (startIndex > 0 && startIndex < streamUrls.length) {
                        console.log(`Setting playlist position to ${startIndex}`);
                        await invoke('mpv_playlist_jump_to_index', { index: startIndex });


                        const posStatus = await invoke<{ playlist_pos: number }>('mpv_get_status');
                        console.log(`Playlist position after jump: ${posStatus.playlist_pos}`);

                        if (posStatus.playlist_pos !== startIndex) {
                            await invoke('mpv_set_playlist_position', { index: startIndex });
                        }
                    } else {
                        await invoke('mpv_playlist_jump_to_index', { index: 0 });
                    }

                    this.mpvPlaylistLoaded = true;
                    this.lastMpvPlaylistPos = startIndex;

                    this.syncMpvVolume();

                    await invoke('mpv_play');

                    if (this.state.currentTrack) {
                        this.applyReplayGain(this.state.currentTrack);
                    }

                    console.log(`Playlist loaded and playing at index ${startIndex}`);
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error('Failed to load MPV playlist:', error);
            toast.error('Failed to initialize MPV playlist');
            return false;
        }
    }

    async playStream(track: Child) {
        if (!this.client || !this.state) return;

        this.trackEndTriggered = false;

        try {
            this.client.scrobble(track.id, true);
            if (this.state.scrobble) this.client.scrobble(track.id, false);

            if (this.useMpv && this.mpvInitialized && invoke) {
                const targetIndex = this.state.playlist.findIndex(t => t.id === track.id);

                if (this.useNativeMpvPlaylist && targetIndex >= 0) {
                    if (this.mpvPlaylistLoaded) {
                        try {
                            console.log(`Navigating to playlist index ${targetIndex} for track ${track.title}`);
                            await invoke('mpv_playlist_jump_to_index', { index: targetIndex });
                            this.lastMpvPlaylistPos = targetIndex;
                            this.state.isPlaying = true;
                            this.applyReplayGain(track);

                            updateMediaMetadata({
                                track,
                                duration: this.duration,
                                position: this.progress
                            });

                            await invoke('mpv_play');

                            return;
                        } catch (error) {
                            console.error('Failed to navigate MPV playlist:', error);
                        }
                    }
                    else {
                        const success = await this.loadPlaylist(this.state.playlist, targetIndex);
                        if (success) {
                            return;
                        }
                    }
                }

                try {
                    const stream = await this.client.getSongStreamURL(track.id);
                    await invoke('mpv_load', { url: stream });
                    this.applyReplayGain(track);
                    await invoke('mpv_play');
                    this.state.isPlaying = true;
                    startMpvStatusPolling();

                    updateMediaMetadata({
                        track,
                        duration: this.duration,
                        position: this.progress
                    });
                } catch (error) {
                    console.error('MPV playback failed:', error);
                    toast.error(`MPV failed: ${error}. Falling back to browser audio.`);
                    this.useMpv = false;
                    mpvSettings.update(s => ({ ...s, enabled: false }));
                    localStorage.setItem('mpvEnabled', 'false');
                    const stream = await this.client.getSongStreamURL(track.id);
                    this.audio.src = stream;
                    this.applyReplayGain(track);
                    await this.audio.play();
                }
            } else {
                const stream = await this.client.getSongStreamURL(track.id);

                if (this.preloadedAudio) {
                    const oldAudio = this.audio;
                    this.audio = this.preloadedAudio;
                    this.preloadedAudio = null;
                    oldAudio.src = '';

                    this.applyReplayGain(track);
                    await this.audio.play();
                    this.state.isPlaying = true;
                } else {
                    this.audio.src = stream;
                    this.applyReplayGain(track);
                    await this.audio.play();
                    this.state.isPlaying = true;
                }

                this.audio.currentTime = 0;
                this.progress = 0;

                this.audio.addEventListener('loadedmetadata', () => {
                    updateMediaMetadata({
                        track,
                        duration: this.audio.duration,
                        position: this.audio.currentTime
                    });
                }, { once: true });
            }

            this.saveProgress();
        } catch (error) {
            console.error('Playback failed:', error);
            toast.error(`Failed to play: ${track.title}`);
            this.state.isPlaying = false;
        }
    }

    setClient(client: NavidromeClient | null) {
        this.client = client;
    }

    pause() {
        if (this.useMpv && this.mpvInitialized && invoke) {
            invoke('mpv_pause').catch(console.error);
        } else if (this.audio.readyState >= 2) {
            this.audio.pause();
        }
        this.saveProgress();
    }

    async resume() {
        if (this.useMpv && this.mpvInitialized && invoke) {
            try {
                await invoke('mpv_play');
            } catch (error) {
                console.error('MPV resume failed:', error);
                toast.error('Failed to resume MPV playback');
                if (this.state?.isPlaying) {
                    this.state.isPlaying = false;
                }
            }
            return;
        }

        if (this.audio.readyState >= 2) {
            try {
                await this.audio.play();
            } catch (error) {
                console.error('Resume failed:', error);
                toast.error('Failed to resume playback');
                if (this.state?.isPlaying) {
                    this.state.isPlaying = false;
                }
            }
        } else {
            try {
                await new Promise<void>((resolve, reject) => {
                    const canPlay = () => {
                        this.audio.removeEventListener('canplay', canPlay);
                        resolve();
                    };

                    const errorHandler = (e: Event) => {
                        this.audio.removeEventListener('error', errorHandler);
                        reject(new Error('Audio failed to load'));
                    };

                    this.audio.addEventListener('canplay', canPlay);
                    this.audio.addEventListener('error', errorHandler);

                    if (this.audio.readyState >= 3) {
                        resolve();
                    }
                });

                await this.audio.play();
            } catch (error) {
                console.error('Resume failed while waiting for audio to load:', error);
                toast.error('Failed to resume playback');
                if (this.state?.isPlaying) {
                    this.state.isPlaying = false;
                }
            }
        }
    }

    async seek(time: number) {
        if (this.useMpv && this.mpvInitialized && invoke) {
            const mpvConfig = get(mpvSettings);
            if (mpvConfig.preciseSeek) {
                return invoke('mpv_seek_precise', { position: time })
                    .then(() => this.progress = time)
                    .catch((error: any) => {
                        console.error('MPV precise seek failed:', error);
                        return invoke('mpv_seek', { position: time })
                            .then(() => this.progress = time)
                            .catch((error: any) => {
                                console.error('MPV seek fallback failed:', error);
                                toast.error('Failed to seek');
                                return Promise.reject(error);
                            });
                    });
            } else {
                return invoke('mpv_seek', { position: time })
                    .then(() => this.progress = time)
                    .catch((error: any) => {
                        console.error('MPV seek failed:', error);
                        toast.error('Failed to seek MPV playback');
                        return Promise.reject(error);
                    });
            }
        }

        return new Promise<void>((resolve, reject) => {
            const doSeek = () => {
                this.audio.currentTime = time;
                let retries = 0;
                const maxRetries = 3;
                const verifySeek = () => {
                    if (Math.abs(this.audio.currentTime - time) < 0.5 || retries >= maxRetries) {
                        this.progress = this.audio.currentTime;
                        resolve();
                    } else {
                        retries++;
                        this.audio.currentTime = time;
                        setTimeout(verifySeek, 100);
                    }
                };

                setTimeout(verifySeek, 100);
            };

            if (this.audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
                doSeek();
            } else {
                const loadedHandler = () => {
                    this.audio.removeEventListener('canplay', loadedHandler);
                    doSeek();
                };

                const errorHandler = (error: Event) => {
                    this.audio.removeEventListener('error', errorHandler);
                    console.error('Audio error while seeking:', error);
                    reject(new Error('Audio failed to load for seeking'));
                };

                this.audio.addEventListener('canplay', loadedHandler);
                this.audio.addEventListener('error', errorHandler);
            }
        });
    }

    setVolume(value: number) {
        this.volume = Math.max(0, Math.min(1, value));

        if (this.state?.currentTrack) {
            this.applyReplayGain(this.state.currentTrack);
        } else {
            this.audio.volume = this.volume;
            this.syncMpvVolume();
        }

        localStorage.setItem('volume', this.volume.toString());
    }

    onEnded(callback: () => void) {
        this.onEndedCallback = callback;
    }

    reset() {
        this.progress = 0;
        this.duration = 0;
        this.trackEndTriggered = false;
        this.mpvPlaylistLoaded = false;
        this.lastMpvPlaylistPos = -1;
        if (this.preloadedAudio) {
            this.preloadedAudio.src = '';
            this.preloadedAudio = null;
        }

        if (this.useMpv && this.mpvInitialized && invoke) {
            invoke('mpv_stop').catch(console.error);
        }
    }

    setSource(src: string) {
        if (this.useMpv && this.mpvInitialized && invoke) {
            invoke('mpv_load', { url: src }).catch(console.error);
        } else {
            this.audio.src = src;
            this.audio.load();
        }
    }

    prepareTrack(track: Child) {
        return new Promise<void>(async (resolve, reject) => {
            if (!this.client || !this.state) {
                reject(new Error('Client or state not available'));
                return;
            }

            try {
                const stream = await this.client.getSongStreamURL(track.id);

                if (this.useMpv && this.mpvInitialized) {

                    resolve();
                    return;
                }

                this.audio.src = stream;
                this.applyReplayGain(track);
                this.audio.load();

                const loadHandler = () => {
                    this.audio.removeEventListener('canplaythrough', loadHandler);
                    resolve();
                };

                const errorHandler = () => {
                    this.audio.removeEventListener('error', errorHandler);
                    reject(new Error('Failed to load audio'));
                };

                this.audio.addEventListener('canplaythrough', loadHandler);
                this.audio.addEventListener('error', errorHandler);

                if (this.audio.readyState >= 4) {
                    this.audio.removeEventListener('canplaythrough', loadHandler);
                    resolve();
                }
            } catch (error) {
                console.error('Failed to prepare track:', error);
                reject(error);
            }
        });
    }
    setUseNativeMpvPlaylist(useNative: boolean) {
        this.useNativeMpvPlaylist = useNative;
    }
}

interface PlayerState {
    currentTrack: Child | null;
    currentIndex: number;
    originalPlaylist: Child[];
    playlist: Child[];
    isPlaying: boolean;
    shuffle: boolean;
    repeat: RepeatMode;
    scrobble: boolean;
    replayGain: {
        enabled: boolean;
        mode: 'track' | 'album' | 'queue';
        preAmp: number;
    }
}

function createPlayerStore() {
    const initialState: PlayerState = {
        currentTrack: null,
        currentIndex: -1,
        originalPlaylist: [],
        playlist: [],
        isPlaying: false,
        shuffle: false,
        repeat: 'none',
        scrobble: localStorage.getItem('scrobble') === 'true',
        replayGain: {
            enabled: localStorage.getItem('replayGainEnabled') === 'true',
            mode: (localStorage.getItem('replayGainMode') as 'track' | 'album' | 'queue') || 'track',
            preAmp: Number(localStorage.getItem('replayGainPreAmp')) || 0
        }
    };

    const audioPlayer = new AudioPlayer(initialState);
    let client: NavidromeClient | null = null;

    const { subscribe, update, set } = writable<PlayerState>(initialState);

    subscribe(state => {
        audioPlayer.setState(state);
    });

    cl.subscribe(async (newClient) => {
        audioPlayer.setClient(newClient);
        client = newClient;

        if (newClient) {
            const queue = await newClient.getQueue();
            if (!queue?.entry?.length) return;

            const queueEntry = queue.entry;
            const startIndex = queue.current ?
                queueEntry.findIndex(t => t.id === queue.current) :
                0;

            const currentTrack = queueEntry[startIndex];


            const initialPosition = queue.position ? queue.position / 1000 : 0;


            if (get(mpvSettings).enabled && invoke) {
                try {

                    const mpvInitialized = await initMpv();
                    if (mpvInitialized) {
                        const stream = await newClient.getSongStreamURL(currentTrack.id);


                        await invoke('mpv_load', { url: stream });
                        await invoke('mpv_pause');

                        startMpvStatusPolling();


                        if (initialPosition > 0) {
                            let seekAttempts = 0;
                            const maxSeekAttempts = 30;

                            const attemptSeek = async () => {
                                const status = await invoke<{
                                    initialized: boolean;
                                    position: number;
                                    duration: number;
                                    volume: number;
                                    state: string;
                                    playlist_count: number;
                                }>('mpv_get_status');


                                if (status.duration > 0) {
                                    await invoke('mpv_seek', { position: initialPosition });


                                    await invoke('mpv_pause');
                                    return true;
                                }

                                seekAttempts++;
                                if (seekAttempts >= maxSeekAttempts) {
                                    console.warn('Failed to get duration after multiple attempts, seeking anyway');
                                    await invoke('mpv_seek', { position: initialPosition });


                                    await invoke('mpv_pause');
                                    return true;
                                }


                                return new Promise<boolean>(resolve => {
                                    setTimeout(async () => {
                                        const result = await attemptSeek();
                                        resolve(result);
                                    }, 100);
                                });
                            };


                            attemptSeek().catch(err => {
                                console.error('Error during seek attempts:', err);
                            });
                        }
                    } else {

                        const stream = await newClient.getSongStreamURL(currentTrack.id);
                        audioPlayer.setSource(stream);
                        if (initialPosition > 0) {
                            audioPlayer.seek(initialPosition);
                        }
                    }
                } catch (err) {
                    console.error('Error preparing MPV playback:', err);

                    const stream = await newClient.getSongStreamURL(currentTrack.id);
                    audioPlayer.setSource(stream);
                    if (initialPosition > 0) {
                        audioPlayer.seek(initialPosition);
                    }
                }
            } else {

                const stream = await newClient.getSongStreamURL(currentTrack.id);
                audioPlayer.setSource(stream);
                if (initialPosition > 0) {
                    audioPlayer.seek(initialPosition);
                }
            }

            update(state => ({
                ...state,
                originalPlaylist: queueEntry,
                playlist: queueEntry,
                currentIndex: startIndex,
                currentTrack: currentTrack,
                isPlaying: false
            }));
        }
    });

    cl.subscribe(cl => {
        audioPlayer.setClient(cl);
        client = cl;
    });

    function shuffleArray(array: Child[]): Child[] {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    async function getSongsFromAlbum(albumId: string): Promise<Child[]> {
        if (!client) return [];
        const album = await client.getAlbumDetails(albumId);
        return album.song || [];
    }

    audioPlayer.onPlaylistPositionChange((index) => {
        update(state => {
            if (index < 0 || index >= state.playlist.length) {
                console.warn(`Invalid playlist index from MPV: ${index}`);
                return state;
            }

            const nextTrack = state.playlist[index];

            if (state.currentIndex === index) {
                return state;
            }

            console.log(`Updating player state for MPV playlist change to track: ${nextTrack.title}`);

            updateMediaMetadata({
                track: nextTrack,
                duration: audioPlayer.duration,
                position: audioPlayer.progress
            });

            return {
                ...state,
                currentIndex: index,
                currentTrack: nextTrack,
                isPlaying: true
            };
        });
    });

    audioPlayer.onEnded(() => {
        update(state => {
            if (state.repeat === 'one') {
                audioPlayer.playStream(state.currentTrack!).catch(() => {
                    update(s => ({ ...s, isPlaying: false }));
                });
                return { ...state, isPlaying: true };
            }

            let nextIndex = state.currentIndex + 1;
            if (nextIndex >= state.playlist.length) {
                if (state.repeat === 'all') {
                    nextIndex = 0;
                } else {
                    return { ...state, isPlaying: false };
                }
            }

            const nextTrack = state.playlist[nextIndex];
            audioPlayer.reset();


            if (!(audioPlayer.isMpvEnabled() && audioPlayer.hasMpvPlaylistLoaded() &&
                !(nextIndex === 0 && state.repeat === 'all'))) {
                audioPlayer.playStream(nextTrack).catch(() => {
                    update(s => ({ ...s, isPlaying: false }));
                });
            }

            updateMediaMetadata({
                track: nextTrack,
                duration: audioPlayer.duration,
                position: audioPlayer.progress
            });

            return {
                ...state,
                currentIndex: nextIndex,
                currentTrack: nextTrack,
                isPlaying: true
            };
        });
    });

    mpvSettings.subscribe(settings => {
        if (settings.initialized && settings.enabled) {
            setTimeout(() => {
                audioPlayer.setVolume(audioPlayer.volume);
            }, 100);
        }
    });

    mpvStatus.subscribe(status => {
        if (audioPlayer.isMpvEnabled()) {
            update(state => {
                if (!state.currentTrack) return state;

                audioPlayer.progress = status.position;
                audioPlayer.duration = status.duration;
                if (status.pause !== null) {
                    const shouldBePlaying = !status.pause;
                    if (state.isPlaying !== shouldBePlaying) {
                        console.log(`Syncing store playing state to MPV pause=${status.pause}`);
                        updateMediaPlaybackState(shouldBePlaying);
                        return {
                            ...state,
                            isPlaying: shouldBePlaying
                        };
                    }
                }

                if (status.playlist_pos !== undefined &&
                    status.playlist_pos >= 0 &&
                    status.playlist_pos !== state.currentIndex &&
                    status.playlist_count > 0) {

                    if (status.playlist_pos < state.playlist.length) {
                        const nextTrack = state.playlist[status.playlist_pos];
                        updateMediaMetadata({
                            track: nextTrack,
                            duration: status.duration,
                            position: status.position
                        });

                        return {
                            ...state,
                            currentIndex: status.playlist_pos,
                            currentTrack: nextTrack,
                            isPlaying: status.state === 'playing'
                        };
                    }
                }

                if ((status.state === 'paused' && state.isPlaying) ||
                    (status.state === 'playing' && !state.isPlaying)) {
                    updateMediaPlaybackState(status.state === 'playing');

                    return {
                        ...state,
                        isPlaying: status.state === 'playing'
                    };
                }

                if (status.state === 'ended' || status.state === 'idle') {
                    if (state.currentIndex === state.playlist.length - 1 &&
                        state.repeat !== 'all') {
                        return {
                            ...state,
                            isPlaying: false
                        };
                    }
                }

                return state;
            });
        }
    });

    return {
        subscribe,
        update,
        setPlaylist: (tracks: Child[], startIndex = 0, autoplay = true) => {
            update(state => {
                const newState = {
                    ...state,
                    originalPlaylist: tracks,
                    playlist: state.shuffle ? shuffleArray(tracks) : tracks,
                    currentIndex: startIndex,
                    currentTrack: tracks[startIndex],
                    isPlaying: autoplay
                };

                if (autoplay && newState.currentTrack) {
                    audioPlayer.reset();

                    if (get(mpvSettings).enabled && get(mpvSettings).nativePlaylist) {
                        audioPlayer.loadPlaylist(newState.playlist, startIndex).then(success => {
                            if (!success) {
                                audioPlayer.playStream(newState.currentTrack!);
                            }
                        });
                    } else {
                        audioPlayer.playStream(newState.currentTrack);
                    }

                    updateMediaMetadata({
                        track: newState.currentTrack,
                        duration: audioPlayer.duration,
                        position: audioPlayer.progress
                    });
                }

                return newState;
            });
        },
        toggleShuffle: () => {
            update(state => {
                const newShuffle = !state.shuffle;
                return {
                    ...state,
                    shuffle: newShuffle,
                    playlist: newShuffle ? shuffleArray(state.originalPlaylist) : [...state.originalPlaylist],
                    currentIndex: 0,
                    currentTrack: state.originalPlaylist[0]
                };
            });
        },
        toggleRepeat: () => {
            update(state => {
                const modes: RepeatMode[] = ['none', 'all', 'one'];
                const currentIndex = modes.indexOf(state.repeat);
                const newRepeat = modes[(currentIndex + 1) % modes.length];
                return { ...state, repeat: newRepeat };
            });
        },
        next: () => {
            update(state => {
                if (!state.playlist.length) return state;

                let nextIndex = state.currentIndex + 1;
                if (nextIndex >= state.playlist.length) {
                    if (state.repeat === 'all') {
                        nextIndex = 0;
                    } else {
                        return state;
                    }
                }

                const nextTrack = state.playlist[nextIndex];

                if (audioPlayer.isMpvEnabled() && get(mpvSettings).nativePlaylist && audioPlayer.hasMpvPlaylistLoaded()) {
                    if (invoke) {
                        try {
                            console.log(`Moving to next track (index ${nextIndex}): ${nextTrack.title}`);

                            if (nextIndex === 0 && state.repeat === 'all') {
                                invoke('mpv_playlist_jump_to_index', { index: 0 })
                                    .catch(error => console.error('Failed to jump to first track:', error));
                            } else {
                                invoke('mpv_playlist_jump_to_index', { index: nextIndex })
                                    .catch(error => console.error('Failed to navigate to next track:', error));
                            }

                            invoke('mpv_play').catch(console.error);
                        } catch (error) {
                            console.error('MPV next track navigation failed:', error);
                        }
                    }

                    return {
                        ...state,
                        currentIndex: nextIndex,
                        currentTrack: nextTrack,
                        isPlaying: true
                    };
                }

                audioPlayer.reset();

                if (state.isPlaying) {
                    audioPlayer.playStream(nextTrack);
                } else if (client) {
                    audioPlayer.prepareTrack(nextTrack).catch(console.error);
                }

                updateMediaMetadata({
                    track: nextTrack,
                    duration: audioPlayer.duration,
                    position: audioPlayer.progress
                });

                return {
                    ...state,
                    currentIndex: nextIndex,
                    currentTrack: nextTrack
                };
            });
        },
        previous: () => {
            update(state => {
                if (!state.playlist.length) return state;

                let prevIndex = state.currentIndex - 1;
                if (prevIndex < 0) {
                    if (state.repeat === 'all') {
                        prevIndex = state.playlist.length - 1;
                    } else {
                        return state;
                    }
                }

                const prevTrack = state.playlist[prevIndex];

                if (audioPlayer.isMpvEnabled() && get(mpvSettings).nativePlaylist && audioPlayer.hasMpvPlaylistLoaded()) {
                    if (invoke) {
                        try {
                            console.log(`Moving to previous track (index ${prevIndex}): ${prevTrack.title}`);

                            invoke('mpv_playlist_jump_to_index', { index: prevIndex })
                                .catch(error => console.error('Failed to navigate to previous track:', error));

                            invoke('mpv_play').catch(console.error);
                        } catch (error) {
                            console.error('MPV previous track navigation failed:', error);
                        }
                    }

                    return {
                        ...state,
                        currentIndex: prevIndex,
                        currentTrack: prevTrack,
                        isPlaying: true
                    };
                }

                audioPlayer.reset();

                if (state.isPlaying) {
                    audioPlayer.playStream(prevTrack);
                } else if (client) {
                    audioPlayer.prepareTrack(prevTrack).catch(console.error);
                }

                updateMediaMetadata({
                    track: prevTrack,
                    duration: audioPlayer.duration,
                    position: audioPlayer.progress
                });

                return {
                    ...state,
                    currentIndex: prevIndex,
                    currentTrack: prevTrack
                };
            });
        },
        togglePlay: () => update(state => {
            const newState = { ...state, isPlaying: !state.isPlaying };

            if (newState.isPlaying) {

                if (state.currentTrack && audioPlayer.progress === 0 && audioPlayer.duration === 0) {


                    audioPlayer.playStream(state.currentTrack).catch(() => {
                        update(s => ({ ...s, isPlaying: false }));
                    });
                } else {

                    audioPlayer.resume().catch(() => {
                        update(s => ({ ...s, isPlaying: false }));
                    });
                }
            } else {
                audioPlayer.pause();
            }

            updateMediaPlaybackState(newState.isPlaying);
            return newState;
        }),
        play: () => update(state => ({ ...state, isPlaying: true })),
        pause: () => update(state => ({ ...state, isPlaying: false })),
        playAlbum: async (album: Child | Child[], shuffle = false) => {
            if (!client) return;

            const songs: Child[] = [];
            if (Array.isArray(album)) {
                await Promise.all(album.map(async a => {
                    const albumSongs = await getSongsFromAlbum(a.id);
                    songs.push(...albumSongs);
                }));
            } else {
                const albumSongs = await getSongsFromAlbum(album.id);
                songs.push(...albumSongs);
            }
            if (!songs.length) songs.push(album as Child);

            const shuffledSongs = shuffle ? shuffleArray([...songs]) : songs;

            update(state => {
                const newState = {
                    ...state,
                    originalPlaylist: songs,
                    playlist: shuffledSongs,
                    currentIndex: 0,
                    currentTrack: shuffledSongs[0],
                    isPlaying: true,
                    shuffle
                };

                audioPlayer.reset();
                audioPlayer.playStream(shuffledSongs[0]);
                updateMediaMetadata({
                    track: shuffledSongs[0],
                    duration: audioPlayer.duration,
                    position: audioPlayer.progress
                });

                return newState;
            });
        },
        addToQueue: (track: Child | Child[]) => {
            update(state => {
                const newTracks = Array.isArray(track) ? track : [track];
                const newPlaylist = [...state.playlist, ...newTracks];
                const newOriginalPlaylist = [...state.originalPlaylist, ...newTracks];
                return {
                    ...state,
                    playlist: newPlaylist,
                    originalPlaylist: newOriginalPlaylist
                };
            });
        },
        addToQueueNext: (track: Child) => {
            update(state => {
                const newPlaylist = [...state.playlist];
                const newOriginalPlaylist = [...state.originalPlaylist];

                newPlaylist.splice(state.currentIndex + 1, 0, track);
                newOriginalPlaylist.splice(state.currentIndex + 1, 0, track);

                return {
                    ...state,
                    playlist: newPlaylist,
                    originalPlaylist: newOriginalPlaylist
                };
            });
        },
        toggleScrobble: () => {
            update(state => {
                const newScrobble = !state.scrobble;
                localStorage.setItem('scrobble', newScrobble.toString());
                return { ...state, scrobble: newScrobble };
            });
        },
        setScrobble: (value: boolean) => {
            update(state => {
                localStorage.setItem('scrobble', value.toString());
                return { ...state, scrobble: value };
            });
        },
        stop: () => {
            update(state => ({ ...state, isPlaying: false }));
        },
        seek: async (time: number) => {
            try {
                await audioPlayer.seek(time);
            } catch (error) {
                console.error('Seek failed:', error);
                toast.error('Failed to seek to position');
            }
        },
        setVolume: (volume: number) => {
            audioPlayer.setVolume(volume);
        },
        getVolume: () => audioPlayer.volume,
        getProgress: () => audioPlayer.progress,
        getDuration: () => audioPlayer.duration,
        setReplayGainEnabled: (enabled: boolean) => {
            update(state => {
                localStorage.setItem('replayGainEnabled', enabled.toString());
                const newState = {
                    ...state,
                    replayGain: {
                        ...state.replayGain,
                        enabled
                    }
                };
                if (newState.currentTrack) {
                    audioPlayer.applyReplayGain(newState.currentTrack);
                }
                return newState;
            });
        },
        setReplayGainMode: (mode: 'track' | 'album' | 'queue') => {
            update(state => {
                localStorage.setItem('replayGainMode', mode);
                const newState = {
                    ...state,
                    replayGain: {
                        ...state.replayGain,
                        mode
                    }
                };
                if (newState.currentTrack) {
                    audioPlayer.applyReplayGain(newState.currentTrack);
                }
                return newState;
            });
        },
        setReplayGainPreAmp: (preAmp: number) => {
            update(state => {
                localStorage.setItem('replayGainPreAmp', preAmp.toString());
                const newState = {
                    ...state,
                    replayGain: {
                        ...state.replayGain,
                        preAmp
                    }
                };
                if (newState.currentTrack) {
                    audioPlayer.applyReplayGain(newState.currentTrack);
                }
                return newState;
            });
        },

        setMpvEnabled: (enabled: boolean) => {
            localStorage.setItem('mpvEnabled', enabled.toString());
            mpvSettings.update(s => ({ ...s, enabled }));
            audioPlayer.setMpvEnabled(enabled);
        },
        setMpvPath: (path: string) => {
            localStorage.setItem('mpvCustomPath', path);
            mpvSettings.update(s => ({ ...s, customPath: path, initialized: false }));
            if (get(mpvSettings).enabled) {
                initMpv().then(success => {
                    if (success && get(player).isPlaying && get(player).currentTrack) {
                        audioPlayer.reset();
                        audioPlayer.playStream(get(player).currentTrack!);
                    }
                });
            }
        },
        setMpvPlaylistOptions: (useNative: boolean) => {
            audioPlayer.setUseNativeMpvPlaylist(useNative);
            localStorage.setItem('mpvUseNativePlaylist', useNative.toString());
            mpvSettings.update(s => ({ ...s, nativePlaylist: useNative }));
        },
        setPreciseSeek: (enabled: boolean) => {
            localStorage.setItem('mpvPreciseSeek', enabled.toString());
            mpvSettings.update(s => ({
                ...s,
                preciseSeek: enabled
            }));
        }
    };
}


function get<T>(store: { subscribe: (callback: (value: T) => void) => any }): T {
    let value: T;
    const unsubscribe = store.subscribe(v => value = v);
    unsubscribe();
    return value!;
}

export const player = createPlayerStore();