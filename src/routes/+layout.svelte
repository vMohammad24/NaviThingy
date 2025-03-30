<script lang="ts">
  import Queue from "$lib/components/Queue.svelte";
  import Search from "$lib/components/Search.svelte";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import { selectedServer } from "$lib/stores/selectedServer";
  import {
    isMobile,
    sidebarHidden,
    sidebarOpen,
  } from "$lib/stores/sidebarOpen";
  import { theme } from "$lib/stores/theme";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { Maximize, Menu, Minimize, X } from "lucide-svelte";
  import { onMount } from "svelte";
  import { Toaster } from "svelte-french-toast";

  import AudioPlayer from "$lib/components/AudioPlayer.svelte";
  import MobilePlayer from "$lib/components/MobilePlayer.svelte";
  import Navigation from "$lib/components/Navigation.svelte";
  import "../app.css";

  let showSearch = false;
  const appWindow = getCurrentWindow();
  let touchStartX = 0;
  let touchEndX = 0;

  onMount(() => {
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  });

  function checkMobile() {
    $isMobile = window.innerWidth < 768;
    if ($isMobile && $sidebarOpen) {
      $sidebarOpen = false;
    }
  }

  $: currentTheme =
    theme.themes.find((t) => t.id === $theme) || theme.themes[0];
  $: if (currentTheme && typeof document !== "undefined") {
    document.documentElement.style.setProperty(
      "--color-primary",
      currentTheme.colors.primary,
    );
    document.documentElement.style.setProperty(
      "--color-secondary",
      currentTheme.colors.secondary,
    );
    document.documentElement.style.setProperty(
      "--color-background",
      currentTheme.colors.background,
    );
    document.documentElement.style.setProperty(
      "--color-surface",
      currentTheme.colors.surface,
    );
    document.documentElement.style.setProperty(
      "--color-text",
      currentTheme.colors.text,
    );
    document.documentElement.style.setProperty(
      "--color-text-secondary",
      currentTheme.colors.textSecondary,
    );
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === "k") {
      event.preventDefault();
      showSearch = true;
    }
  }

  async function minimize() {
    await appWindow.minimize();
  }

  async function maximize() {
    await appWindow.toggleMaximize();
  }

  async function close() {
    await appWindow.close();
  }

  function toggleSidebar() {
    $sidebarOpen = !$sidebarOpen;
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if !$isMobile}
  <div
    class="fixed top-0 right-0 z-50 h-8 flex w-screen justify-end {$sidebarHidden
      ? 'hidden'
      : ''}"
    data-tauri-drag-region
  >
    <button
      class="h-full w-10 flex items-center justify-center text-text-secondary/70 hover:bg-surface/90 hover:text-text transition-all duration-200 hover:scale-110"
      on:click={minimize}
      aria-label="Minimize"
    >
      <Minimize size={16} />
    </button>
    <button
      class="h-full w-10 flex items-center justify-center text-text-secondary/70 hover:bg-surface/90 hover:text-text transition-all duration-200 hover:scale-110"
      on:click={maximize}
      aria-label="Maximize"
    >
      <Maximize size={16} />
    </button>
    <button
      class="h-full w-10 flex items-center justify-center text-text-secondary/70 hover:bg-red-500 hover:text-text transition-colors"
      on:click={close}
      aria-label="Close"
    >
      <X size={16} />
    </button>
  </div>
{/if}

<div
  class="flex min-h-screen bg-background text-text duration-200 transition-all"
>
  {#if $selectedServer && !$sidebarHidden}
    <Sidebar bind:isOpen={$sidebarOpen} />

    {#if $isMobile && $sidebarOpen}
      <div
        class="fixed inset-0 bg-black/50 z-20 backdrop-blur-sm transition-opacity duration-300"
        on:click={() => ($sidebarOpen = false)}
        aria-hidden="true"
      ></div>
    {/if}
  {/if}

  <div class="flex-1 flex flex-col">
    {#if $isMobile && $selectedServer && !$sidebarHidden}
      <div
        class="sticky top-0 z-20 p-4 flex items-center justify-between bg-surface/90 backdrop-blur-md"
      >
        <button
          class="rounded-xl p-2.5 hover:bg-primary/10 transition-all
            relative after:absolute after:inset-0 after:rounded-xl after:border after:border-white/10
            after:opacity-0 hover:after:opacity-100 after:transition-opacity active:scale-95"
          on:click={toggleSidebar}
          aria-label="Toggle menu"
        >
          <Menu size={24} />
        </button>
        <a class="text-xl font-bold tracking-tight" href="/home">
          <span
            class="bg-gradient-to-r from-primary via-surface to-secondary bg-[200%_auto] animate-gradient bg-clip-text text-transparent"
          >
            NaviThingy
          </span>
        </a>
        <div class="w-10"></div>
      </div>
    {/if}

    <Search bind:show={showSearch} />
    <main class="flex-1 p-4 mb-20 {$isMobile ? 'pt-2' : ''}">
      <slot />
    </main>
    <Queue />
    {#if $isMobile}
      <MobilePlayer />
    {:else}
      <AudioPlayer />
    {/if}
  </div>
</div>

<Toaster
  position="bottom-center"
  toastOptions={{
    style: "background-color: var(--color-surface); color: var(--color-text);",
    duration: 5000,
  }}
/>
<Navigation />
