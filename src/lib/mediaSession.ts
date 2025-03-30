import type { Child } from '@vmohammad/subsonic-api';
import { player } from './stores/player';

export function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => player.togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => player.togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => player.previous());
    navigator.mediaSession.setActionHandler('nexttrack', () => player.next());
    navigator.mediaSession.setActionHandler('stop', () => player.stop());
}

export function updateMediaMetadata({
    track,
    duration,
    position
}: {
    track: Child;
    duration: number;
    position: number;
}) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork: [
            { src: track.coverArt! },
        ]
    });

    if (duration && !isNaN(duration) && !isNaN(position)) {
        navigator.mediaSession.setPositionState({
            playbackRate: 1,
            position,
            duration
        });
    }
}

export function updateMediaPlaybackState(isPlaying: boolean) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
}