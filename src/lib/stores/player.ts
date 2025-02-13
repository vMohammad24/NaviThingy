import { updateMediaMetadata, updateMediaPlaybackState } from '$lib/mediaSession';
import { NavidromeClient } from '$lib/navidrome';
import type { Child } from '@vmohammad/subsonic-api';
import toast from 'svelte-french-toast';
import { writable } from 'svelte/store';
import { client as cl } from './client';

export type RepeatMode = 'none' | 'one' | 'all';

class AudioPlayer {
    private audio: HTMLAudioElement;
    private preloadedAudio: HTMLAudioElement | null = null;
    private client: NavidromeClient | null = null;
    private state: PlayerState | null = null;
    public volume: number;
    public progress = 0;
    public duration = 0;
    private onEndedCallback?: () => void;

    constructor(initialState: PlayerState) {
        this.audio = new Audio();
        this.volume = Number(localStorage.getItem('volume') ?? '1');
        this.audio.volume = this.volume;
        this.state = initialState;

        this.audio.addEventListener('timeupdate', () => {
            this.progress = this.audio.currentTime;
            this.duration = this.audio.duration;

            if (this.duration - this.progress <= 10 && !this.preloadedAudio) {
                this.preloadNext();
            }
        });

        this.audio.addEventListener('ended', () => {
            if (this.onEndedCallback) {
                this.onEndedCallback();
            }
        });


        this.audio.addEventListener('error', () => {
            console.error('Audio playback error:', this.audio.error);
            if (this.state?.isPlaying) {
                this.state.isPlaying = false;
            }
        });


        this.audio.addEventListener('playing', () => {
            if (this.state && !this.state.isPlaying) {
                this.state.isPlaying = true;
            }
        });


        this.audio.addEventListener('pause', () => {
            if (this.state?.isPlaying) {
                this.state.isPlaying = false;
            }
        });
    }

    private async preloadNext() {
        if (!this.client || !this.state) return;

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
        if (!this.client) return;
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

    private async saveProgress() {
        if (!this.client || !this.state || !this.state.currentTrack) return;
        await this.client?.saveQueue({
            current: this.state?.currentTrack.id,
            position: this.audio.currentTime,
            id: this.state.playlist.map(t => t.id).join(',')
        });
    }

    private applyReplayGain(track: Child) {
        if (!this.state?.replayGain.enabled || !track.replayGain) {
            this.audio.volume = this.volume;
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


        this.audio.volume = Math.min(1.0, this.volume * gain);
    }

    async playStream(track: Child) {
        if (!this.client || !this.state) return;

        try {
            this.client.scrobble(track.id, true);
            if (this.state.scrobble) this.client.scrobble(track.id, false);

            if (this.preloadedAudio) {
                const oldAudio = this.audio;
                this.audio = this.preloadedAudio;
                this.preloadedAudio = null;
                oldAudio.src = '';

                this.applyReplayGain(track);
                await this.audio.play();
            } else {
                const stream = await this.client.getSongStreamURL(track.id);
                this.audio.src = stream;
                this.applyReplayGain(track);
                await this.audio.play();
            }

            this.audio.currentTime = 0;
            this.progress = 0;

            this.saveProgress();

            this.audio.addEventListener('loadedmetadata', () => {
                updateMediaMetadata({
                    track,
                    duration: this.audio.duration,
                    position: this.audio.currentTime
                });
            }, { once: true });

        } catch (error) {
            console.error('Playback failed:', error);
            toast.error(`Failed to play: ${track.title}`);
            if (this.state.isPlaying) {
                this.state.isPlaying = false;
            }
        }
    }

    setClient(client: NavidromeClient | null) {
        this.client = client;
    }

    pause() {
        if (this.audio.readyState >= 2) {
            this.audio.pause();
            this.saveProgress();
        }
    }

    async resume() {
        if (this.audio.readyState >= 2) {
            try {
                await this.audio.play();
                this.saveProgress();
            } catch (error) {
                console.error('Resume failed:', error);
                toast.error('Failed to resume playback');
                if (this.state?.isPlaying) {
                    this.state.isPlaying = false;
                }
            }
        }
    }

    seek(time: number) {
        if (this.audio.readyState < 2) {
            this.audio.addEventListener('play', () => {
                this.seek(time);
            }, { once: true });
        }
        this.audio.currentTime = time;
        this.saveProgress();
    }

    setVolume(value: number) {
        this.volume = Math.max(0, Math.min(1, value));
        if (this.state?.currentTrack) {
            this.applyReplayGain(this.state.currentTrack);
        } else {
            this.audio.volume = this.volume;
        }
        localStorage.setItem('volume', this.volume.toString());
    }

    onEnded(callback: () => void) {
        this.onEndedCallback = callback;
    }

    reset() {
        this.progress = 0;
        this.duration = 0;
        if (this.preloadedAudio) {
            this.preloadedAudio.src = '';
            this.preloadedAudio = null;
        }
    }

    setSource(src: string) {
        this.audio.src = src;
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
            const stream = await newClient.getSongStreamURL(currentTrack.id);
            audioPlayer.setSource(stream);

            update(state => ({
                ...state,
                originalPlaylist: queueEntry,
                playlist: queueEntry,
                currentIndex: startIndex,
                currentTrack: currentTrack,
                isPlaying: false
            }));


            if (queue.position) {
                audioPlayer.seek(queue.position);
            }
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

    audioPlayer.onEnded(() => {
        update(state => {
            if (state.repeat === 'one') {
                audioPlayer.playStream(state.currentTrack!);
                return state;
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
            audioPlayer.playStream(nextTrack);
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
                    audioPlayer.playStream(newState.currentTrack);
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
                        return { ...state, isPlaying: false };
                    }
                }

                const nextTrack = state.playlist[nextIndex];
                const newState = {
                    ...state,
                    currentIndex: nextIndex,
                    currentTrack: nextTrack
                };

                if (state.isPlaying) {
                    audioPlayer.reset();
                    audioPlayer.playStream(nextTrack);
                    updateMediaMetadata({
                        track: nextTrack,
                        duration: audioPlayer.duration,
                        position: audioPlayer.progress
                    });
                }

                return newState;
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
                        prevIndex = 0;
                    }
                }

                const prevTrack = state.playlist[prevIndex];
                const newState = {
                    ...state,
                    currentIndex: prevIndex,
                    currentTrack: prevTrack
                };

                if (state.isPlaying) {
                    audioPlayer.reset();
                    audioPlayer.playStream(prevTrack);
                    updateMediaMetadata({
                        track: prevTrack,
                        duration: audioPlayer.duration,
                        position: audioPlayer.progress
                    });
                }

                return newState;
            });
        },
        togglePlay: () => update(state => {
            const newState = { ...state, isPlaying: !state.isPlaying };
            if (newState.isPlaying) {
                audioPlayer.resume().catch(() => {
                    update(s => ({ ...s, isPlaying: false }));
                });
            } else {
                audioPlayer.pause();
            }
            updateMediaPlaybackState(newState.isPlaying);
            return newState;
        }),
        play: () => update(state => ({ ...state, isPlaying: true })),
        pause: () => update(state => ({ ...state, isPlaying: false })),
        playAlbum: async (album: Child, shuffle = false) => {
            if (!client) return;

            const songs = await getSongsFromAlbum(album.id);
            if (!songs.length) return;

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
        seek: (time: number) => {
            audioPlayer.seek(time);
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
                    audioPlayer.playStream(newState.currentTrack);
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
                    audioPlayer.playStream(newState.currentTrack);
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
                    audioPlayer.playStream(newState.currentTrack);
                }
                return newState;
            });
        },
    };
}

export const player = createPlayerStore();