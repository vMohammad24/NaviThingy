<script lang="ts">
  import { download } from "$lib/client/util";
  import ContextMenu from "$lib/components/ContextMenu.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import { mpvSettings, player } from "$lib/stores/player";
  import { selectedServer } from "$lib/stores/selectedServer";
  import { servers } from "$lib/stores/servers";
  import { isMobile } from "$lib/stores/sidebarOpen";
  import { theme } from "$lib/stores/theme";
  import type { Theme } from "$lib/types/theme";
  import { getTauriVersion, getVersion } from "@tauri-apps/api/app";
  import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
  import { platform } from "@tauri-apps/plugin-os";
  import { relaunch } from "@tauri-apps/plugin-process";
  import { check } from "@tauri-apps/plugin-updater";
  import { X } from "lucide-svelte";
  import { onMount } from "svelte";
  import toast from "svelte-french-toast";
  $: currentTheme = theme.themes.find((t) => t.id === $theme);
  $: os = platform();
  let customTheme = { ...currentTheme, name: "" };
  let showCustomThemeEditor = false;
  let importUrl = "";
  let fileInput: HTMLInputElement;
  let tauriVersion = "";
  let version = "";
  let autostartEnabled = false;
  let contextMenu = {
    show: false,
    x: 0,
    y: 0,
    theme: null as Theme | null,
  };
  let mpvPathInput = $mpvSettings.customPath;
  let mpvEnabled = $mpvSettings.enabled;
  let mpvFileInput: HTMLInputElement;
  let isCreating = false;
  let checking = false;
  let updateAvailable = false;
  let updateError: string | null = null;
  let downloadProgress = {
    downloaded: 0,
    total: 0,
    status: null as "Started" | "Progress" | "Finished" | null,
  };

  onMount(async () => {
    tauriVersion = await getTauriVersion();
    version = await getVersion();
    autostartEnabled = await isEnabled();
  });

  function handleContextMenu(event: MouseEvent, t: Theme) {
    event.preventDefault();
    contextMenu = {
      show: true,
      x: event.clientX,
      y: event.clientY,
      theme: t,
    };
  }

  async function toggleAutoStart() {
    if (autostartEnabled) {
      await disable();
      autostartEnabled = false;
      return "Disabled autostart";
    } else {
      await enable();
      autostartEnabled = true;
      return "Enabled autostart";
    }
  }

  function handleThemeClick(t: Theme) {
    theme.setTheme(t.id);
  }

  function handleCreateTheme() {
    isCreating = true;
    customTheme = {
      id: "",
      name: "",
      colors: {
        primary: "#60a5fa",
        secondary: "#34d399",
        background: "#1a1b1e",
        surface: "#2c2e33",
        text: "#e5e7eb",
        textSecondary: "#9ca3af",
      },
    };
    showCustomThemeEditor = true;
  }

  function customizeTheme(t: Theme) {
    isCreating = false;
    customTheme = { ...t, name: t.name + " (Copy)" };
    showCustomThemeEditor = true;
  }

  async function handleThemeSave() {
    if (!customTheme.name) return;
    const newThemeId = "custom_" + Date.now();
    theme.addTheme({
      ...customTheme,
      id: newThemeId,
    });
    theme.setTheme(newThemeId);
    showCustomThemeEditor = false;
    window.location.reload();
  }

  function exportTheme(t: Theme) {
    const blob = new Blob([JSON.stringify(t, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    download(url, `${t.name.toLowerCase().replace(/\s+/g, "_")}_theme.json`);
    URL.revokeObjectURL(url);
  }

  async function importThemeFromUrl() {
    try {
      const response = await fetch(importUrl);
      const themeData = await response.json();
      theme.addTheme({ ...themeData, id: "custom_" + Date.now() });
      importUrl = "";
      window.location.reload();
    } catch (error) {
      console.error("Failed to import theme:", error);
    }
  }

  function handleFileUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const themeData = JSON.parse(e.target?.result as string);
        theme.addTheme({ ...themeData, id: "custom_" + Date.now() });
        window.location.reload();
      } catch (error) {
        console.error("Failed to parse theme file:", error);
      }
    };
    reader.readAsText(file);
  }

  function removeTheme(themeId: string) {
    theme.removeTheme(themeId);
    if ($theme === themeId) {
      theme.setTheme("catppuccin-mocha");
    }
    window.location.reload();
  }

  function handleServerSwitch(serverId: string) {
    const server = $servers.find((s) => s.id === serverId);
    if (server) {
      selectedServer.select(server, true);
      window.location.reload();
    }
  }

  function handleServerRemove(serverId: string) {
    if ($selectedServer?.id === serverId) {
      selectedServer.clear();
    }
    servers.remove(serverId);
  }

  async function checkForUpdates() {
    checking = true;
    updateError = null;
    try {
      const updatePromise = check();
      const update = await toast.promise(updatePromise, {
        loading: "Checking for updates...",
        success: "Checked for updates",
        error: "Failed to check for updates",
      });
      updateAvailable = update?.available || false;
    } catch (e) {
      updateError = (e as Error).message;
    } finally {
      checking = false;
    }
  }

  async function handleUpdateClick() {
    if (updateAvailable) {
      if (confirm("Do you want to download and install the update?")) {
        try {
          const update = await check();
          if (update) {
            await update.downloadAndInstall((progress) => {
              downloadProgress.status = progress.event;
              switch (progress.event) {
                case "Started":
                  downloadProgress = {
                    downloaded: 0,
                    total: progress.data.contentLength || 0,
                    status: "Started",
                  };
                  break;
                case "Progress":
                  downloadProgress.downloaded += progress.data.chunkLength;
                  break;
                case "Finished":
                  relaunch();
                  break;
              }
            });
          }
        } catch (e) {
          updateError = (e as Error).message;
          downloadProgress = { downloaded: 0, total: 0, status: null };
        }
      }
    } else {
      checkForUpdates();
    }
  }
  function handleMpvFileSelect(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      mpvPathInput = file.name;
      player.setMpvPath(mpvPathInput);
      toast.success("MPV path updated");
    }
  }

  function saveMpvPath() {
    player.setMpvPath(mpvPathInput);
    toast.success("MPV path saved");
  }

  function toggleMpv() {
    mpvEnabled = !mpvEnabled;
    player.setMpvEnabled(mpvEnabled);
  }
</script>

<div class="max-w-2xl mx-auto px-4">
  <h1 class="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Settings</h1>

  <div class="rounded-lg p-4 sm:p-6 mb-6 sm:mb-8 shadow-lg bg-surface">
    <h2 class="text-xl font-semibold mb-4">Global Settings</h2>
    <div class="space-y-4">
      {#if !$isMobile}
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
        >
          <div>
            <h3 class="font-medium">Auto Start</h3>
            <p class="text-sm text-text-secondary">
              Start the application automatically when you log in
            </p>
          </div>
          <button
            class="px-3 py-1 rounded-lg text-sm font-medium transition-all w-full sm:w-auto {autostartEnabled
              ? 'bg-primary text-background'
              : 'bg-surface'}"
            on:click={async () => {
              toast.promise(toggleAutoStart(), {
                loading: "Updating autostart...",
                success: (msg) => msg,
                error: (error) => error,
              });
            }}
          >
            {autostartEnabled ? "Enabled" : "Disabled"}
          </button>
        </div>
      {/if}
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
      >
        <div>
          <h3 class="font-medium">Scrobbling</h3>
          <p class="text-sm text-text-secondary">
            Track your listening history on last.fm (requires linking in
            navidrome)
          </p>
        </div>
        <button
          class="px-3 py-1 rounded-lg text-sm font-medium transition-all w-full sm:w-auto {$player.scrobble
            ? 'bg-primary text-background'
            : 'bg-surface'}"
          on:click={() => player.toggleScrobble()}
        >
          {$player.scrobble ? "Enabled" : "Disabled"}
        </button>
      </div>

      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
      >
        <div>
          <h3 class="font-medium">ReplayGain</h3>
          <p class="text-sm text-text-secondary">
            Volume normalization using ReplayGain metadata
          </p>
        </div>
        <button
          class="px-3 py-1 rounded-lg text-sm font-medium transition-all w-full sm:w-auto {$player
            .replayGain.enabled
            ? 'bg-primary text-background'
            : 'bg-surface'}"
          on:click={() =>
            player.setReplayGainEnabled(!$player.replayGain.enabled)}
        >
          {$player.replayGain.enabled ? "Enabled" : "Disabled"}
        </button>
      </div>

      {#if $player.replayGain.enabled}
        <div class="space-y-2">
          <div class="flex items-center gap-4">
            <label for="replaygain-mode" class="text-sm">Mode:</label>
            <select
              id="replaygain-mode"
              class="px-2 py-1 rounded-lg bg-background"
              bind:value={$player.replayGain.mode}
              on:change={(e) =>
                player.setReplayGainMode(e.currentTarget.value as any)}
            >
              <option value="track">Track Gain</option>
              <option value="album">Album Gain</option>
              <option value="queue">Queue Average</option>
            </select>
          </div>

          <div class="flex items-center gap-4">
            <label for="replaygain-preamp" class="text-sm">Pre-amp:</label>
            <input
              id="replaygain-preamp"
              type="range"
              min="-15"
              max="15"
              step="0.1"
              class="flex-1"
              bind:value={$player.replayGain.preAmp}
              on:change={(e) =>
                player.setReplayGainPreAmp(Number(e.currentTarget.value))}
            />
            <span class="text-sm w-12 text-right"
              >{$player.replayGain.preAmp}dB</span
            >
          </div>
        </div>
      {/if}
    </div>
  </div>

  <div class="rounded-lg p-4 sm:p-6 mb-6 sm:mb-8 shadow-lg bg-surface">
    <h2 class="text-xl font-semibold mb-4">Audio Player Settings</h2>
    <div class="space-y-4">
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
      >
        <div>
          <h3 class="font-medium">MPV Player</h3>
          <p class="text-sm text-text-secondary">
            Use MPV as audio backend (may provide better performance and format
            support) (EXPERIMENTAL)
          </p>
        </div>
        <button
          class="px-3 py-1 rounded-lg text-sm font-medium transition-all w-full sm:w-auto {mpvEnabled
            ? 'bg-primary text-background'
            : 'bg-surface'}"
          on:click={toggleMpv}
        >
          {mpvEnabled ? "Enabled" : "Disabled"}
        </button>
      </div>

      {#if mpvEnabled}
        <div class="space-y-2 p-4 bg-background/50 rounded-lg">
          <p class="text-sm mb-2">
            {#if os === "windows"}
              Specify the path to mpv.exe if not in system PATH:
            {:else if os === "macos"}
              Specify the path to mpv if not in system PATH:
            {:else}
              Specify the path to mpv executable if not in system PATH:
            {/if}
          </p>

          <div class="flex gap-2">
            <input
              type="text"
              class="flex-1 p-2 rounded-lg bg-background text-text"
              placeholder="Path to MPV executable"
              bind:value={mpvPathInput}
            />
            <input
              type="file"
              class="hidden"
              accept={os === "windows" ? ".exe" : ""}
              bind:this={mpvFileInput}
              on:change={handleMpvFileSelect}
            />
            <button
              class="px-3 py-1 rounded-lg text-sm font-medium bg-primary text-background"
              on:click={() => mpvFileInput.click()}
            >
              Browse
            </button>
            <button
              class="px-3 py-1 rounded-lg text-sm font-medium bg-primary text-background"
              on:click={saveMpvPath}
            >
              Save
            </button>
          </div>

          <p class="text-xs text-text-secondary mt-2">
            {#if os === "windows"}
              If MPV is in your system PATH, you can leave this field empty.
            {:else if os === "macos"}
              On macOS, you can install MPV using Homebrew: <code
                >brew install mpv</code
              >
            {:else}
              On Linux, install MPV using your distribution's package manager.
            {/if}
          </p>

          {#if $mpvSettings.initialized}
            <p class="text-xs text-green-500 mt-1">
              MPV successfully initialized
            </p>
          {:else if mpvEnabled}
            <p class="text-xs text-yellow-500 mt-1">MPV not initialized yet</p>
          {/if}

          <div class="mt-4 pt-4 border-t border-surface">
            <h3 class="font-medium mb-3">Advanced MPV Settings</h3>

            <div class="space-y-4">
              <div
                class="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <h4 class="text-sm font-medium">Precise Seeking</h4>
                  <p class="text-xs text-text-secondary">
                    Enable more precise seeking for better accuracy
                  </p>
                </div>
                <button
                  class="px-3 py-1 rounded-lg text-xs font-medium transition-all w-full sm:w-auto {$mpvSettings.preciseSeek
                    ? 'bg-primary text-background'
                    : 'bg-surface'}"
                  on:click={() =>
                    player.setPreciseSeek(!$mpvSettings.preciseSeek)}
                >
                  {$mpvSettings.preciseSeek ? "Enabled" : "Disabled"}
                </button>
              </div>

              <div
                class="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <h4 class="text-sm font-medium">Native Playlist Support</h4>
                  <p class="text-xs text-text-secondary">
                    Use MPV's native playlist features for better performance
                  </p>
                </div>
                <button
                  class="px-3 py-1 rounded-lg text-xs font-medium transition-all w-full sm:w-auto {$mpvSettings.nativePlaylist
                    ? 'bg-primary text-background'
                    : 'bg-surface'}"
                  on:click={() =>
                    player.setMpvPlaylistOptions(!$mpvSettings.nativePlaylist)}
                >
                  {$mpvSettings.nativePlaylist ? "Enabled" : "Disabled"}
                </button>
              </div>

              <div class="flex flex-col gap-2">
                <div>
                  <h4 class="text-sm font-medium">Cache Size (seconds)</h4>
                  <p class="text-xs text-text-secondary">
                    Amount of audio to buffer in advance (higher values reduce
                    stuttering)
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="60"
                    step="1"
                    class="flex-1"
                    value={$mpvSettings.cacheSize}
                    on:change={(e) => {
                      const value = parseInt(e.currentTarget.value);
                      localStorage.setItem("mpvCacheSize", value.toString());
                      mpvSettings.update((s) => ({ ...s, cacheSize: value }));
                    }}
                  />
                  <span class="text-sm w-12 text-right"
                    >{$mpvSettings.cacheSize}s</span
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
  <div class="rounded-lg p-4 sm:p-6 mb-6 sm:mb-8 shadow-lg bg-surface">
    <h2 class="text-xl font-semibold mb-4">Server Settings</h2>
    <div class="space-y-4">
      {#each $servers as server}
        <div
          class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg bg-background gap-4"
        >
          <div>
            <h3 class="font-medium">{server.name}</h3>
            <p class="text-sm text-text-secondary break-all">{server.url}</p>
          </div>
          <div class="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              class="px-3 py-1 rounded-lg text-sm font-medium w-full sm:w-auto {$selectedServer?.id ===
              server.id
                ? 'bg-primary text-background'
                : 'bg-surface'}"
              on:click={() => handleServerSwitch(server.id)}
              disabled={$selectedServer?.id === server.id}
            >
              {$selectedServer?.id === server.id ? "Current" : "Switch"}
            </button>
            <button
              class="px-3 py-1 rounded-lg text-sm font-medium bg-surface hover:bg-red-500/20 w-full sm:w-auto"
              on:click={() => handleServerRemove(server.id)}
            >
              Remove
            </button>
          </div>
        </div>
      {/each}

      <a
        href="/"
        class="block text-center px-4 py-2 rounded-lg bg-primary text-background hover:opacity-90"
      >
        Add New Server
      </a>
    </div>
  </div>

  <div class="rounded-lg p-4 sm:p-6 mb-6 sm:mb-8 shadow-lg bg-surface">
    <div
      class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3"
    >
      <h2 class="text-xl font-semibold">Theme Settings</h2>
      <div class="flex gap-2 w-full sm:w-auto">
        <button
          class="px-3 py-1 rounded-lg text-sm font-medium bg-primary text-background hover:opacity-90 w-1/2 sm:w-auto"
          on:click={handleCreateTheme}
        >
          Create Theme
        </button>
        <button
          class="px-3 py-1 rounded-lg text-sm font-medium bg-surface border border-primary hover:opacity-90 w-1/2 sm:w-auto"
          on:click={() => fileInput.click()}
        >
          Import File
        </button>
      </div>
    </div>

    <input
      type="file"
      accept=".json"
      class="hidden"
      bind:this={fileInput}
      on:change={handleFileUpload}
    />

    <div class="mb-4">
      <div class="flex flex-col sm:flex-row gap-2">
        <input
          type="url"
          bind:value={importUrl}
          placeholder="Import theme from URL"
          class="flex-1 p-2 rounded-lg bg-background text-text"
        />
        <button
          class="px-3 py-1 rounded-lg text-sm font-medium bg-primary text-background hover:opacity-90 w-full sm:w-auto"
          on:click={importThemeFromUrl}
        >
          Import
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {#each theme.themes as t}
        <button
          class="p-4 rounded-lg relative group text-left"
          style:background-color={t.colors.surface}
          style:color={t.colors.text}
          style:border={t.id === $theme
            ? `2px solid ${t.colors.primary}`
            : "none"}
          on:click={() => handleThemeClick(t)}
          on:contextmenu={(e) => handleContextMenu(e, t)}
        >
          <div class="flex flex-col gap-2">
            <span class="font-medium truncate">{t.name}</span>
            <div class="grid grid-cols-3 gap-1">
              {#each Object.entries(t.colors) as [key, color]}
                <div
                  class="w-4 h-4 rounded tooltip"
                  style:background-color={color as any}
                  data-tip={key}
                ></div>
              {/each}
            </div>
          </div>
        </button>
      {/each}
    </div>

    <ContextMenu
      bind:show={contextMenu.show}
      x={contextMenu.x}
      y={contextMenu.y}
      items={contextMenu.theme
        ? [
            {
              label: "Export Theme",
              action: () => exportTheme(contextMenu.theme!),
            },
            {
              label: "Customize",
              action: () => customizeTheme(contextMenu.theme!),
            },
            ...(contextMenu.theme.id.startsWith("custom_")
              ? [
                  {
                    label: "Delete",
                    action: () => removeTheme(contextMenu.theme!.id),
                  },
                ]
              : []),
          ]
        : []}
      on:close={() => (contextMenu.show = false)}
    />

    <Modal
      show={showCustomThemeEditor}
      maxWidth="max-w-4xl"
      onClose={() => (showCustomThemeEditor = false)}
    >
      <div class="bg-surface p-4 sm:p-6">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl sm:text-2xl font-semibold">
            {isCreating ? "Create Theme" : "Customize Theme"}
          </h3>
          <button
            class="p-2 hover:bg-background/50 rounded-full"
            on:click={() => (showCustomThemeEditor = false)}
          >
            <X size={24} />
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          <div class="space-y-6">
            <div>
              <label for="theme-name" class="block text-sm font-medium mb-2"
                >Theme Name</label
              >
              <input
                id="theme-name"
                type="text"
                bind:value={customTheme.name}
                class="w-full p-3 rounded-lg bg-background text-text border border-background focus:border-primary outline-none"
                placeholder="Enter theme name"
              />
            </div>

            <div class="space-y-4">
              <h4 class="font-medium">Colors</h4>
              {#each Object.entries(customTheme.colors) as [key, value]}
                <div>
                  <label
                    for={key}
                    class="block text-sm font-medium mb-2 capitalize"
                    >{key}</label
                  >
                  <div class="flex gap-3">
                    <div class="relative">
                      <input
                        id={`${key}-color`}
                        type="color"
                        bind:value={customTheme.colors[key]}
                        class="w-12 h-10 rounded cursor-pointer border-0"
                      />
                      <div
                        class="absolute inset-0 rounded pointer-events-none"
                        style="background-color: {value}"
                      ></div>
                    </div>
                    <input
                      type="text"
                      bind:value={customTheme.colors[key]}
                      class="flex-1 p-3 rounded-lg bg-background text-text border border-background focus:border-primary outline-none font-mono"
                      placeholder="Enter color value"
                    />
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <div class="rounded-lg overflow-hidden shadow-lg">
            <div
              class="p-6"
              style="background-color: {customTheme.colors
                .background}; color: {customTheme.colors.text}"
            >
              <h4 class="text-lg font-semibold mb-4">Theme Preview</h4>

              <div class="space-y-4">
                <div class="space-y-2">
                  <button
                    class="px-4 py-2 rounded-lg w-full"
                    style="background-color: {customTheme.colors
                      .primary}; color: {customTheme.colors.background}"
                  >
                    Primary Button
                  </button>
                  <button
                    class="px-4 py-2 rounded-lg w-full"
                    style="background-color: {customTheme.colors
                      .secondary}; color: {customTheme.colors.background}"
                  >
                    Secondary Button
                  </button>
                </div>

                <div
                  class="rounded-lg p-4"
                  style="background-color: {customTheme.colors.surface}"
                >
                  <h5 class="font-medium mb-2">Surface Example</h5>
                  <p
                    style="color: {customTheme.colors.textSecondary}"
                    class="text-sm"
                  >
                    This is how secondary text will look in your theme.
                  </p>
                </div>

                <div class="space-y-2">
                  <p>Regular text on background</p>
                  <p style="color: {customTheme.colors.textSecondary}">
                    Secondary text on background
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          class="flex justify-end gap-3 mt-6 pt-4 border-t"
          style="border-color: {customTheme.colors.surface}"
        >
          <button
            class="px-4 py-2 rounded-lg text-sm font-medium hover:bg-background/50"
            on:click={() => (showCustomThemeEditor = false)}
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 rounded-lg text-sm font-medium"
            style="background-color: {customTheme.colors
              .primary}; color: {customTheme.colors.background}"
            on:click={handleThemeSave}
            disabled={!customTheme.name}
          >
            Save Theme
          </button>
        </div>
      </div>
    </Modal>
  </div>

  <div class="rounded-lg p-4 sm:p-6 shadow-lg bg-surface">
    <h2 class="text-xl font-semibold mb-4">Build Information</h2>
    <div class="space-y-4">
      <div
        class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      >
        <div>
          <h3 class="font-medium">Version</h3>
          <p class="text-sm text-text-secondary">App: {version}</p>
          <p class="text-sm text-text-secondary">Tauri: {tauriVersion}</p>
          <p class="text-sm text-text-secondary">Platform: {os}</p>
        </div>
        <button
          class="px-3 py-1 rounded-lg text-sm font-medium transition-all w-full sm:w-auto {checking
            ? 'bg-surface'
            : updateAvailable
              ? 'bg-green-500 text-background'
              : 'bg-primary text-background'}"
          on:click={handleUpdateClick}
          disabled={checking || downloadProgress.status !== null}
        >
          {#if downloadProgress.status === "Started"}
            Starting Download...
          {:else if downloadProgress.status === "Progress"}
            Downloading... ({Math.round(
              (downloadProgress.downloaded / downloadProgress.total) * 100,
            )}%)
          {:else if downloadProgress.status === "Finished"}
            Restarting...
          {:else if checking}
            Checking...
          {:else if updateAvailable}
            Install Update
          {:else}
            Check for Updates
          {/if}
        </button>
      </div>
      {#if downloadProgress.status}
        <div class="w-full h-2 bg-surface rounded-full overflow-hidden">
          <div
            class="h-full bg-primary transition-all duration-300"
            style="width: {downloadProgress.status === 'Finished'
              ? 100
              : downloadProgress.status === 'Progress'
                ? (downloadProgress.downloaded / downloadProgress.total) * 100
                : 0}%"
          ></div>
        </div>
      {/if}
      {#if updateError}
        <p class="text-sm text-red-500">{updateError}</p>
      {/if}
    </div>
  </div>
</div>
