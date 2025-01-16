import { NavidromeClient } from '$lib/navidrome';
import { client as cl } from '$lib/stores/client';
import type { Child } from 'subsonic-api';
import { derived, writable } from 'svelte/store';
import { player } from './player';

function createQueueStore() {
    const { subscribe, update } = writable<Child[]>([]);

    const upcoming = derived([player], ([$player]) => {
        if (!$player.playlist.length) return [];
        const nextSongs: Child[] = [];
        let idx = $player.currentIndex + 1;

        for (let i = 0; i < 3 && idx < $player.playlist.length; i++) {
            nextSongs.push($player.playlist[idx++]);
        }

        return nextSongs;
    });

    let client: NavidromeClient | null = null;

    cl.subscribe(cl => {
        if (cl) {
            client = cl;
        } else {
            client = null;
        }
    });

    return {
        subscribe,
        add: (tracks: Child[]) => update(queue => [...queue, ...tracks]),
        remove: (index: number) => update(queue => queue.filter((_, i) => i !== index)),
        clear: () => update(() => []),
        move: (from: number, to: number) => update(queue => {
            const newQueue = [...queue];
            const [item] = newQueue.splice(from, 1);
            newQueue.splice(to, 0, item);
            return newQueue;
        }),
    };
}

export const queue = createQueueStore();