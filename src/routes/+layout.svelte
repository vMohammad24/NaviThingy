<script lang="ts">
  import AudioPlayer from '$lib/components/AudioPlayer.svelte';
  import Queue from '$lib/components/Queue.svelte';
  import Search from '$lib/components/Search.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import { selectedServer } from '$lib/stores/selectedServer';
  import { sidebarHidden, sidebarOpen } from '$lib/stores/sidebarOpen';
  import { theme } from '$lib/stores/theme';
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { Maximize, Minimize, X } from 'lucide-svelte';
  import "../app.css";
  
  let showSearch = false;
  const appWindow = getCurrentWindow();
  $: currentTheme = theme.themes.find(t => t.id === $theme) || theme.themes[0];
  $: if (currentTheme && typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--color-primary', currentTheme.colors.primary);
    document.documentElement.style.setProperty('--color-secondary', currentTheme.colors.secondary);
    document.documentElement.style.setProperty('--color-background', currentTheme.colors.background);
    document.documentElement.style.setProperty('--color-surface', currentTheme.colors.surface);
    document.documentElement.style.setProperty('--color-text', currentTheme.colors.text);
    document.documentElement.style.setProperty('--color-text-secondary', currentTheme.colors.textSecondary);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === 'k') {
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
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="fixed top-0 right-0 z-50 h-8 flex w-screen justify-end" data-tauri-drag-region>
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
        class="h-full w-10 flex items-center justify-center text-text-secondary/70 hover:bg-red-500 hover:text-white transition-colors"
        on:click={close}
        aria-label="Close"
      >
        <X size={16} />
      </button>
</div>

<div class="flex min-h-screen bg-background text-text duration-200 transition-all">
  {#if $selectedServer && !$sidebarHidden}
    <Sidebar bind:isOpen={$sidebarOpen} />
  {/if}
  <div class="flex-1 flex flex-col">
    <Search bind:show={showSearch} />
    <main class="flex-1 p-4 mb-20">
      <slot />
    </main>
    <Queue />
    <AudioPlayer />
  </div>
</div>