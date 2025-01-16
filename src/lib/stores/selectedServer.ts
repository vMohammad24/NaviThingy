
import { writable } from 'svelte/store';
import type { NavidromeServer } from '../types/navidrome';

const STORAGE_KEY = 'selected_server';

function createSelectedServerStore() {
    const storedServer = typeof localStorage !== 'undefined'
        ? JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
        : null;

    const { subscribe, set } = writable<NavidromeServer | null>(storedServer);

    return {
        subscribe,
        select: (server: NavidromeServer, remember: boolean = false) => {
            if (remember) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(server));
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
            set(server);
        },
        clear: () => {
            localStorage.removeItem(STORAGE_KEY);
            set(null);
        }
    };
}

export const selectedServer = createSelectedServerStore();