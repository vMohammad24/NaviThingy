import { updateMediaMetadata, updateMediaPlaybackState } from '$lib/mediaSession';
import { NavidromeClient } from '$lib/navidrome';
import type { Child } from '@vmohammad/subsonic-api';
import { writable } from 'svelte/store';
import { client as cl } from './client';

export type RepeatMode = 'none' | 'one' | 'all';

class AudioPlayer {
    private audio: HTMLAudioElement;
    private client: NavidromeClient | null = null;
    public volume: number;
    public progress = 0;
    public duration = 0;
    private onEndedCallback?: () => void;

    constructor() {
        this.audio = new Audio();
        this.volume = Number(localStorage.getItem('volume') ?? '1');
        this.audio.volume = this.volume;

        this.audio.addEventListener('timeupdate', () => {
            this.progress = this.audio.currentTime;
            this.duration = this.audio.duration;
        });


        this.audio.addEventListener('ended', () => {
            if (this.onEndedCallback) {
                this.onEndedCallback();
            }
        });
    }

    async playStream(track: Child) {
        if (!this.client) return;
        this.client.scrobble(track.id, true);
        const stream = await this.client.getSongStreamURL(track.id);
        this.audio.src = stream;
        this.audio.volume = this.volume;
        return this.audio.play();
    }

    setClient(client: NavidromeClient | null) {
        this.client = client;
    }

    pause() {
        this.audio.pause();
    }

    resume() {
        return this.audio.play();
    }

    seek(time: number) {
        this.audio.currentTime = time;
    }

    setVolume(value: number) {
        this.volume = Math.max(0, Math.min(1, value));
        this.audio.volume = this.volume;
        localStorage.setItem('volume', this.volume.toString());
    }

    onEnded(callback: () => void) {
        this.onEndedCallback = callback;
    }

    reset() {
        this.progress = 0;
        this.duration = 0;
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
}

function createPlayerStore() {
    const audioPlayer = new AudioPlayer();
    let client: NavidromeClient | null = null;

    cl.subscribe(cl => {
        audioPlayer.setClient(cl);
        client = cl;
    });

    const { subscribe, update, set } = writable<PlayerState>({
        currentTrack: null,
        currentIndex: -1,
        originalPlaylist: [],
        playlist: [],
        isPlaying: false,
        shuffle: false,
        repeat: 'none',
        scrobble: localStorage.getItem('scrobble') === 'true'
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
            updateMediaMetadata(nextTrack);

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
                    updateMediaMetadata(newState.currentTrack);
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
                    updateMediaMetadata(nextTrack);
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
                    updateMediaMetadata(prevTrack);
                }

                return newState;
            });
        },
        togglePlay: () => update(state => {
            const newState = { ...state, isPlaying: !state.isPlaying };
            if (newState.isPlaying) {
                audioPlayer.resume();
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

            update(state => ({
                ...state,
                originalPlaylist: songs,
                playlist: shuffledSongs,
                currentIndex: 0,
                currentTrack: shuffledSongs[0],
                isPlaying: true,
                shuffle
            }));
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
    };
}

export const player = createPlayerStore();