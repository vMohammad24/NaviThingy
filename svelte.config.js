// Tauri doesn't have a Node.js server to do proper SSR
// so we will use adapter-static to prerender the app (SSG)
// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		prerender: {
			entries: [
				'/',
				'/home/',
				'/settings',
				'/albums/123',
				'/artists/123',
				'/songs/123',
				'/albums',
				'/artists',
				'/songs',
				'/playlists',
				'/playlists/123',
				'/genres'
			]
		}
	}
};

export default config;
