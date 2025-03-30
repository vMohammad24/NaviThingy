<script lang="ts">
  import { page } from "$app/state";
  import { isMobile } from "$lib/stores/sidebarOpen";
  import {
    Disc,
    Home,
    ListMusic,
    Menu,
    Music,
    Settings,
    Tag,
    Users,
    X,
  } from "lucide-svelte";
  import { onDestroy, onMount } from "svelte";

  export let isOpen = true;

  const navItems = [
    { href: "/home", label: "Home", icon: Home },
    { href: "/albums", label: "Albums", icon: Disc },
    { href: "/songs", label: "Songs", icon: Music },
    { href: "/artists", label: "Artists", icon: Users },
    { href: "/genres", label: "Genres", icon: Tag },
    { href: "/playlists", label: "Playlists", icon: ListMusic },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  function handleNavClick() {
    if ($isMobile) {
      isOpen = false;
    }
  }

  function swipe(node: HTMLElement) {
    let touchStartX: number;
    let touchEndX: number;
    const swipeThreshold = 50;

    function handleTouchStart(event: TouchEvent) {
      touchStartX = event.touches[0].clientX;
    }

    function handleTouchEnd(event: TouchEvent) {
      touchEndX = event.changedTouches[0].clientX;
      const swipeDistance = touchEndX - touchStartX;

      if (swipeDistance > swipeThreshold && !isOpen) {
        isOpen = true;
      } else if (swipeDistance < -swipeThreshold && isOpen) {
        isOpen = false;
      }
    }
    node.addEventListener("touchstart", handleTouchStart, { passive: true });
    node.addEventListener("touchend", handleTouchEnd, { passive: true });

    return {
      destroy() {
        node.removeEventListener("touchstart", handleTouchStart);
        node.removeEventListener("touchend", handleTouchEnd);
      },
    };
  }

  let documentSwipeCleanup: (() => void) | null = null;

  onMount(() => {
    if ($isMobile) {
      let touchStartX: number;
      let touchEndX: number;
      const swipeThreshold = 50;

      function handleTouchStart(event: TouchEvent) {
        touchStartX = event.touches[0].clientX;
      }

      function handleTouchEnd(event: TouchEvent) {
        touchEndX = event.changedTouches[0].clientX;
        const swipeDistance = touchEndX - touchStartX;

        if (swipeDistance > swipeThreshold && !isOpen) {
          isOpen = true;
        }
      }

      document.addEventListener("touchstart", handleTouchStart, {
        passive: true,
      });
      document.addEventListener("touchend", handleTouchEnd, { passive: true });

      documentSwipeCleanup = () => {
        document.removeEventListener("touchstart", handleTouchStart);
        document.removeEventListener("touchend", handleTouchEnd);
      };
    }
  });

  onDestroy(() => {
    if (documentSwipeCleanup) {
      documentSwipeCleanup();
    }
  });
</script>

<aside
  use:swipe
  class="pt-1.5 fixed top-0 z-30 flex h-screen flex-col
    {isOpen ? 'w-64 sm:w-72' : $isMobile ? '-translate-x-full' : 'w-[4.5rem]'} 
    {$isMobile ? 'shadow-2xl' : ''}
    transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
    before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/[0.03] before:to-transparent before:rounded-r-3xl
    bg-gradient-to-br from-surface/95 via-surface/90 to-surface/80 backdrop-blur-2xl
    border-white/[0.02] shadow-[1px_0_30px_-8px_rgba(0,0,0,0.3)]"
>
  <div class="flex flex-col p-2 relative z-10 h-full">
    <div
      class="mb-4 sm:mb-6 flex items-center justify-between {isOpen
        ? 'px-2'
        : 'justify-center relative'}"
    >
      {#if isOpen}
        <h1 class="text-xl sm:text-2xl font-bold tracking-tight">
          <span
            class="bg-gradient-to-r from-primary via-surface to-secondary bg-[200%_auto] animate-gradient bg-clip-text text-transparent"
          >
            NaviThingy
          </span>
        </h1>
      {/if}
      <button
        class="rounded-xl p-2.5 transition-all duration-300 touch-manipulation
          {isOpen ? 'hover:bg-white/5' : 'hover:bg-primary/10'}
          relative after:absolute after:inset-0 after:rounded-xl after:border after:border-white/10
          after:opacity-0 hover:after:opacity-100 after:transition-opacity
          hover:shadow-[0_0_20px_-3px_rgba(var(--color-primary-rgb),0.5)] active:scale-90"
        on:click={() => (isOpen = !isOpen)}
        aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        {#if $isMobile && isOpen}
          <X size={24} class="transition-all duration-300 ease-out" />
        {:else}
          <Menu
            size={24}
            class="transition-all duration-500 ease-out {isOpen
              ? 'rotate-180'
              : ''}"
          />
        {/if}
      </button>
    </div>

    <nav
      class="flex flex-col gap-1.5 sm:gap-2 {isOpen
        ? 'px-2'
        : '-mx-1.5'} {$isMobile ? 'pb-24' : ''}"
    >
      {#each navItems as item}
        <a
          href={item.href}
          on:click={handleNavClick}
          class="group flex items-center gap-4 rounded-xl
            {isOpen
            ? 'p-3 sm:p-3.5 hover:translate-x-1'
            : 'p-3 sm:p-4 hover:scale-105'} 
            text-base sm:text-sm
            transition-all duration-500 relative overflow-hidden isolate touch-manipulation
            hover:bg-gradient-to-r hover:from-primary/10 hover:to-transparent
            min-w-full
            active:scale-95
            {page.url.pathname === item.href
            ? 'bg-white/[0.03] shadow-lg'
            : ''}"
        >
          <div class="relative z-10 {isOpen ? '' : 'mx-auto'}">
            <div
              class="absolute -inset-2 rounded-lg bg-primary/20 blur-xl transition-opacity duration-500
              opacity-0 group-hover:opacity-100 {page.url.pathname === item.href
                ? 'opacity-50'
                : ''}"
            ></div>
            <svelte:component
              this={item.icon}
              size={24}
              class="relative transition-all duration-500 ease-out will-change-transform
                group-hover:scale-110 group-hover:-rotate-6
                {page.url.pathname === item.href ? 'text-primary' : ''}"
            />
          </div>

          {#if isOpen}
            <span
              class="font-medium tracking-wide transition-colors duration-300
              relative after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0
              after:bg-primary after:transition-all after:duration-500
              group-hover:after:w-full
              {page.url.pathname === item.href ? 'text-primary' : ''}"
            >
              {item.label}
            </span>
          {:else if !$isMobile}
            <div
              class="pointer-events-none absolute left-[120%] top-1/2 -translate-y-1/2 px-3 py-2 rounded-lg text-sm
                bg-surface/95 backdrop-blur-xl border border-white/5
                invisible opacity-0 translate-x-2 scale-95 origin-left z-50 shadow-[0_0_30px_-5px_rgba(0,0,0,0.5)]
                group-hover:visible group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100
                transition-all duration-300 ease-out whitespace-nowrap
                after:absolute after:top-1/2 after:right-full after:border-8 after:border-transparent
                after:border-r-surface/95 after:-translate-y-1/2"
            >
              {item.label}
            </div>
          {/if}

          {#if page.url.pathname === item.href}
            <div class="absolute inset-0 bg-primary/5 animate-pulse-slow"></div>
            {#if !isOpen}
              <div
                class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-1/2 bg-primary rounded-full"
              ></div>
            {/if}
          {/if}
        </a>
      {/each}
    </nav>
  </div>
</aside>
