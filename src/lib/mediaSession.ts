
import type { Child } from '@vmohammad/subsonic-api';
import { player } from './stores/player';

export function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => player.play());
    navigator.mediaSession.setActionHandler('pause', () => player.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => player.previous());
    navigator.mediaSession.setActionHandler('nexttrack', () => player.next());
    navigator.mediaSession.setActionHandler('stop', () => player.stop());
}

export function updateMediaMetadata(track: Child) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork: [
            { src: track.coverArt!, sizes: '512x512', type: 'image/jpeg' }
        ]
    });
}

export function updateMediaPlaybackState(isPlaying: boolean) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
}