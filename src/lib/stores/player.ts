import { NavidromeClient } from '$lib/navidrome';
import type { Child } from '@vmohammad/subsonic-api';
import { writable } from 'svelte/store';
import { client as cl } from './client';
export type RepeatMode = 'none' | 'one' | 'all';

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
    let client: NavidromeClient | null = null;
    cl.subscribe(cl => {
        if (cl) {
            client = cl;
        } else {
            client = null;
        }
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

                return {
                    ...state,
                    currentIndex: nextIndex,
                    currentTrack: state.playlist[nextIndex]
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
                        prevIndex = 0;
                    }
                }

                return {
                    ...state,
                    currentIndex: prevIndex,
                    currentTrack: state.playlist[prevIndex]
                };
            });
        },
        togglePlay: () => update(state => ({ ...state, isPlaying: !state.isPlaying })),
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
        }
    };
}

export const player = createPlayerStore();