
<script lang="ts">
    import { page } from '$app/state';
    import { Disc, Home, ListMusic, Music, Settings, Tag, Users } from 'lucide-svelte';

    export let isOpen = true;

    const navItems = [
        { href: '/home', label: 'Home', icon: Home },
        { href: '/albums', label: 'Albums', icon: Disc },
        { href: '/songs', label: 'Songs', icon: Music },
        { href: '/artists', label: 'Artists', icon: Users },
        { href: '/genres', label: 'Genres', icon: Tag },
        { href: '/playlists', label: 'Playlists', icon: ListMusic },
        { href: '/settings', label: 'Settings', icon: Settings },
    ];
</script>

<aside class="pt-1.5 sticky top-0 z-30 flex h-screen flex-col border-r border-surface {isOpen ? 'w-64' : 'w-20'} bg-surface transition-all duration-200 ease-in-out">
    <div class="flex flex-col p-4">
        <div class="mb-6 flex items-center justify-between">
            {#if isOpen}
                <span class="text-xl font-bold">NaviThingy</span>
            {/if}
            <button
                class="rounded-lg p-2 transition-colors hover:bg-primary/10"
                on:click={() => (isOpen = !isOpen)}
                aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
            >
                <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
            </button>
        </div>

        <nav class="flex flex-col gap-1">
            {#each navItems as item}
                <a
                    href={item.href}
                    class="group flex items-center gap-3 rounded-lg p-3 transition-all duration-200 hover:bg-primary/10 {page.url.pathname === item.href ? 'bg-background' : ''} relative"
                >
                    <svelte:component
                        this={item.icon}
                        size={20}
                        class="flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                    />
                    {#if isOpen}
                        <span class="text-sm font-medium">{item.label}</span>
                    {:else}
                        <div class="absolute left-full ml-2 px-2 py-1 bg-gradient-to-r from-surface to-background rounded-md text-sm invisible group-hover:visible whitespace-nowrap">
                            {item.label}
                        </div>
                    {/if}
                </a>
            {/each}
        </nav>
    </div>
</aside>