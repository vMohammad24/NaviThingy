import { writable } from 'svelte/store';
import type { NavidromeServer } from '../types/navidrome';

const STORAGE_KEY = 'navidrome_servers';

function createServersStore() {
    const storedServers = typeof localStorage !== 'undefined'
        ? JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
        : [];

    const { subscribe, set, update } = writable<NavidromeServer[]>(storedServers);

    return {
        subscribe,
        add: (server: NavidromeServer) => update(servers => {
            const newServers = [...servers, server];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newServers));
            return newServers;
        }),
        remove: (id: string) => update(servers => {
            const newServers = servers.filter(s => s.id !== id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newServers));
            return newServers;
        }),
        update: (server: NavidromeServer) => update(servers => {
            const newServers = servers.map(s => s.id === server.id ? server : s);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newServers));
            return newServers;
        }),
        edit: (id: string, updates: Partial<NavidromeServer>) => update(servers => {
            const newServers = servers.map(s => s.id === id ? { ...s, ...updates } : s);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newServers));
            return newServers;
        })
    };
}

export const servers = createServersStore();