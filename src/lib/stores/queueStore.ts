import type { Child } from 'subsonic-api';
import { derived, writable } from 'svelte/store';
import { player } from './player';

// History of played tracks
export const history = derived<typeof player, Child[]>(player, ($player) => {
    if (!$player.playlist.length) return [];
    return $player.playlist.slice(0, $player.currentIndex);
});

// Upcoming tracks in queue
export const upcoming = derived<typeof player, Child[]>(player, ($player) => {
    if (!$player.playlist.length) return [];
    return $player.playlist.slice($player.currentIndex + 1);
});

// Queue visibility state
export const queueVisible = writable(false);

// Queue actions for UI interaction
export const queueActions = {
    toggle: () => queueVisible.update(v => !v),
    show: () => queueVisible.set(true),
    hide: () => queueVisible.set(false),
    add: (tracks: Child[]) => {
        player.update(p => ({
            ...p,
            playlist: [...p.playlist, ...tracks]
        }));
    },
    addNext: (tracks: Child[]) => {
        player.update(p => ({
            ...p,
            playlist: [
                ...p.playlist.slice(0, p.currentIndex + 1),
                ...tracks,
                ...p.playlist.slice(p.currentIndex + 1)
            ]
        }));
    },
    remove: (index: number) => {
        player.update(p => ({
            ...p,
            playlist: p.playlist.filter((_, i) => i !== index + p.currentIndex + 1)
        }));
    },
    clear: () => {
        player.update(p => ({
            ...p,
            playlist: p.playlist.slice(0, p.currentIndex + 1)
        }));
    },
    move: (from: number, to: number) => {
        player.update(p => {
            const actualFrom = from + p.currentIndex + 1;
            const actualTo = to + p.currentIndex + 1;
            const newPlaylist = [...p.playlist];
            const [item] = newPlaylist.splice(actualFrom, 1);
            newPlaylist.splice(actualTo, 0, item);
            return { ...p, playlist: newPlaylist };
        });
    }
};