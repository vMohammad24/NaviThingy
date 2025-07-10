<script lang="ts">
	import Album from '$lib/components/Album.svelte';
	import HeroSong from '$lib/components/HeroSong.svelte';
	import { client } from '$lib/stores/client';
	import { isMobile } from '$lib/stores/sidebarOpen';
	import type { Child } from '@vmohammad/subsonic-api';
	import { onMount } from 'svelte';
	import { quintOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';

	let loading = $state(true);
	let error: string | null = $state(null);
	let username: string = $state('');
	let recentAlbums: Child[] = $state([]);
	let mostPlayed: Child[] = $state([]);
	let recentlyPlayed: Child[] = $state([]);

	let loadingRecent = $state(true);
	let loadingMostPlayed = $state(true);
	let loadingRecentlyPlayed = $state(true);
	let loadingUserData = $state(true);

	async function loadData() {
		if (!$client) return;

		loading = true;
		loadingRecent = true;
		loadingMostPlayed = true;
		loadingRecentlyPlayed = true;
		loadingUserData = true;
		error = null;

		try {
			$client
				.getAlbums('newest', { size: 12 })
				.then((recent) => {
					recentAlbums = recent.album || [];
					loadingRecent = false;
					checkLoadingComplete();
				})
				.catch(handleError);

			$client
				.getAlbums('frequent', { size: 12 })
				.then((top) => {
					mostPlayed = top.album || [];
					loadingMostPlayed = false;
					checkLoadingComplete();
				})
				.catch(handleError);

			$client
				.getAlbums('recent', { size: 12 })
				.then((played) => {
					recentlyPlayed = played.album || [];
					loadingRecentlyPlayed = false;
					checkLoadingComplete();
				})
				.catch(handleError);

			$client
				.getUserData()
				.then((user) => {
					username = user.username;
					loadingUserData = false;
					checkLoadingComplete();
				})
				.catch(handleError);
		} catch (e) {
			handleError(e);
		}
	}

	function handleError(e: any) {
		console.error('Error loading data:', e);
		error = 'Failed to load data';
		loading = false;
	}

	function checkLoadingComplete() {
		if (!loadingRecent || !loadingMostPlayed || !loadingRecentlyPlayed || !loadingUserData) {
			loading = false;
		}
	}

	onMount(async () => {
		await loadData();
	});
</script>

<div class="container mx-auto px-4 py-6 space-y-8">
	{#if loading && loadingUserData && loadingRecent && loadingMostPlayed && loadingRecentlyPlayed}
		<div class="grid gap-8">
			<div class="h-48 bg-surface/30 animate-pulse rounded-2xl"></div>
			{#each Array(3) as _}
				<div class="space-y-4">
					<div class="h-8 w-48 bg-surface/30 animate-pulse rounded-lg"></div>
					<div
						class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
					>
						{#each Array(6) as _}
							<div class="aspect-square bg-surface/30 animate-pulse rounded-xl"></div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{:else if error}
		<div
			in:fade={{ duration: 300 }}
			class="text-center p-6 sm:p-12 rounded-2xl bg-surface/50 backdrop-blur"
		>
			<p class="text-text-secondary text-lg">{error}</p>
			<button
				class="mt-4 px-6 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
				onclick={loadData}
			>
				Retry
			</button>
		</div>
	{:else}
		<header
			in:fly={{ y: 20, duration: 500, delay: 0 }}
			class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 to-surface p-4 sm:p-8"
		>
			<h1 class="text-xl sm:text-4xl font-bold mb-2">
				{loadingUserData ? 'Welcome Back' : `Welcome Back, ${username}`}
			</h1>
		</header>

		<div in:fly={{ y: 20, duration: 500, delay: 100 }}>
			<HeroSong />
		</div>

		<section
			in:fly={{
				y: 20,
				duration: 500,
				delay: 200,
				easing: quintOut
			}}
		>
			<div class="flex justify-between items-center mb-4">
				<h2 class="text-xl sm:text-2xl font-bold">Most Played</h2>
				<a
					href="/albums/?activeTab=frequent"
					class="text-sm text-text-secondary hover:text-primary transition-colors"
				>
					View All
				</a>
			</div>
			{#if loadingMostPlayed}
				<div
					class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
				>
					{#each Array(6) as _}
						<div class="aspect-square bg-surface/30 animate-pulse rounded-xl"></div>
					{/each}
				</div>
			{:else}
				<div
					class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
				>
					{#each $isMobile ? mostPlayed.slice(0, 6) : mostPlayed as album, i}
						{#if i < 6 || window.innerWidth >= 768}
							<Album {album} showMetadata />
						{/if}
					{/each}
				</div>
			{/if}
		</section>

		<section
			in:fly={{
				y: 20,
				duration: 500,
				delay: 300,
				easing: quintOut
			}}
		>
			<div class="flex justify-between items-center mb-4">
				<h2 class="text-xl sm:text-2xl font-bold">Recently Added</h2>
				<a
					href="/albums/?activeTab=newest"
					class="text-sm text-text-secondary hover:text-primary transition-colors"
				>
					View All
				</a>
			</div>
			{#if loadingRecent}
				<div
					class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
				>
					{#each Array(6) as _}
						<div class="aspect-square bg-surface/30 animate-pulse rounded-xl"></div>
					{/each}
				</div>
			{:else}
				<div
					class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
				>
					{#each $isMobile ? recentAlbums.slice(0, 6) : recentAlbums as album, i}
						{#if i < 6 || window.innerWidth >= 768}
							<Album {album} showMetadata />
						{/if}
					{/each}
				</div>
			{/if}
		</section>

		<section
			in:fly={{
				y: 20,
				duration: 500,
				delay: 400,
				easing: quintOut
			}}
		>
			<div class="flex justify-between items-center mb-4">
				<h2 class="text-xl sm:text-2xl font-bold">Recently Played</h2>
				<a
					href="/albums/?activeTab=recent"
					class="text-sm text-text-secondary hover:text-primary transition-colors"
				>
					View All
				</a>
			</div>
			{#if loadingRecentlyPlayed}
				<div
					class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
				>
					{#each Array(6) as _}
						<div class="aspect-square bg-surface/30 animate-pulse rounded-xl"></div>
					{/each}
				</div>
			{:else}
				<div
					class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
				>
					{#each $isMobile ? recentlyPlayed.slice(0, 6) : recentlyPlayed as album, i}
						{#if i < 6 || window.innerWidth >= 768}
							<Album {album} showMetadata />
						{/if}
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</div>
