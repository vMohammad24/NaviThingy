import { NavidromeClient } from '$lib/navidrome';
import { derived } from 'svelte/store';
import { selectedServer } from './selectedServer';

export const client = derived(selectedServer, ($selectedServer) => {
	if (!$selectedServer) return null;
	return new NavidromeClient($selectedServer);
});
