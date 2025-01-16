<script lang="ts">
  import AudioPlayer from '$lib/components/AudioPlayer.svelte';
  import Navigation from '$lib/components/Navigation.svelte';
  import Queue from '$lib/components/Queue.svelte';
  import Search from '$lib/components/Search.svelte';
  import { selectedServer } from '$lib/stores/selectedServer';
  import { theme } from '$lib/stores/theme';
  import "../app.css";
  
  let showSearch = false;
  
  $: currentTheme = theme.themes.find(t => t.id === $theme);
  $: if(!currentTheme) {
    theme.setTheme(theme.themes[0].id);
  }
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
</script>

<svelte:window on:keydown={handleKeydown} />
<Navigation />
<div class="min-h-screen bg-background text-text transition-colors duration-200">
  <Search bind:show={showSearch} />
  
  <nav class="p-4 bg-surface">
    <div class="container mx-auto flex justify-between items-center">
      <a class="text-xl font-bold" href="/home">NaviThingy</a>
      {#if $selectedServer}
        <div class="flex items-center gap-4">
          <a
            href="/settings"
            class="p-2 rounded-lg transition-colors duration-200 hover:opacity-80 bg-primary text-background"
          >
            Settings
          </a>
          <a class="text-sm" href="/">Connected to {$selectedServer.name}</a>
        </div>
      {/if}
    </div>
  </nav>
  
  <main class="container mx-auto p-4 mb-20">
    <slot />
  </main>

  <Queue />
  <AudioPlayer />
</div>