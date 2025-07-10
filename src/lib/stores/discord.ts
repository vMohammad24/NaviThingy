import { browser } from '$app/environment';
import { getAlbumInfo } from '$lib/lastfm';
import { invoke } from '@tauri-apps/api/core';
import { writable } from 'svelte/store';
import { player } from './player';

export interface DiscordRPCOptions {
	appId?: string;
	details?: string;
	state?: string;
	largeImage?: string;
	smallImage?: string;
	startTime?: number | string;
	endTime?: number | string;
}

async function updatePresence(options: DiscordRPCOptions): Promise<void> {
	const rpcPayload = {
		app_id: options.appId || '1360628417254658159',
		details: options.details,
		state: options.state,
		large_image: options.largeImage,
		small_image: options.smallImage,
		start_time: options.startTime?.toString(),
		end_time: options.endTime?.toString()
	};
	return invoke<void>('update_rpc', { rpc: rpcPayload });
}

async function setPresence({
	artist,
	endTime,
	startTime,
	album,
	track
}: {
	track: string;
	album: string;
	artist?: string;
	startTime?: number;
	endTime?: number;
}): Promise<void> {
	const lastfmApiKey =
		typeof localStorage !== 'undefined' ? localStorage.getItem('lastfm_api_key') : null;
	const options: DiscordRPCOptions = {};
	if (lastfmApiKey && artist) {
		const albumInfo = await getAlbumInfo(album, artist, lastfmApiKey);
		if (albumInfo && albumInfo.album) {
			options.details = track;
			options.state = `by ${albumInfo.album.artist}`;
			options.largeImage = albumInfo.album.image.pop()['#text'] || 'navithingy';
		} else {
			options.details = track;
			options.state = `by ${artist || 'Unknown'}`;
			options.largeImage = 'navithingy';
		}
	} else {
		options.details = track;
		options.state = `by ${artist || 'Unknown'}`;
		options.largeImage = 'navithingy';
	}

	options.startTime = startTime
		? startTime > 9999999999
			? Math.floor(startTime / 1000)
			: startTime
		: Math.floor(Date.now() / 1000);
	options.endTime = endTime
		? endTime > 9999999999
			? Math.floor(endTime / 1000)
			: endTime
		: undefined;
	await updatePresence(options);
}

async function clearPresence(): Promise<void> {
	return updatePresence({});
}

function createLastFmStore() {
	const storedValue =
		typeof localStorage !== 'undefined' ? localStorage.getItem('lastfm_api_key') : null;
	const { subscribe, set } = writable<string>(storedValue || '');

	return {
		subscribe,
		set: (value: string) => {
			localStorage.setItem('lastfm_api_key', value);
			set(value);
			return value;
		},
		clear: () => {
			localStorage.removeItem('lastfm_api_key');
			set('');
		}
	};
}

export const lastfm = createLastFmStore();

function createDiscordRPCStore() {
	const storedValue =
		typeof localStorage !== 'undefined'
			? localStorage.getItem('discord_rpc_enabled') === 'true'
			: false;
	const { subscribe, set } = writable<boolean>(storedValue);

	let lastTrack: string | undefined = undefined;
	let lastTrackTime: number = 0;
	let lastisPlaying: boolean = false;
	let unsub: () => void = () => {};
	const sub = () => {
		unsub = player.subscribe((state) => {
			const currentTrack = state.currentTrack;
			const progress = player.getProgress();
			if (
				currentTrack &&
				(currentTrack.id !== lastTrack ||
					(lastTrackTime && currentTrack.id === lastTrack && progress > lastTrackTime + 5) ||
					lastisPlaying !== state.isPlaying)
			) {
				lastTrack = currentTrack.id;
				lastTrackTime = progress;
				lastisPlaying = state.isPlaying;
				if (!state.isPlaying) {
					clearPresence();
					return;
				}
				const { artist, album, duration } = currentTrack;
				setPresence({
					artist: artist!,
					track: currentTrack.title,
					album: album!,
					startTime: Date.now() - progress * 1000,
					endTime: duration ? Date.now() + (duration - progress) * 1000 : undefined
				});
			}
		});
	};

	function initialize() {
		if (browser && storedValue) {
			console.log('Initializing Discord RPC store');
			sub();
		}
	}

	const store = {
		subscribe,
		enable: () => {
			localStorage.setItem('discord_rpc_enabled', 'true');
			set(true);
			sub();
		},
		disable: () => {
			localStorage.setItem('discord_rpc_enabled', 'false');
			set(false);
			unsub();
			lastTrack = undefined;
			lastTrackTime = 0;
			clearPresence();
		},
		toggle: () => {
			const newValue = !(typeof localStorage !== 'undefined'
				? localStorage.getItem('discord_rpc_enabled') === 'true'
				: false);
			localStorage.setItem('discord_rpc_enabled', newValue.toString());
			set(newValue);
			if (newValue) {
				sub();
			} else {
				clearPresence();
				unsub();
			}
			return newValue;
		},
		initialize
	};

	initialize();

	return store;
}

export const discordRPC = createDiscordRPCStore();
