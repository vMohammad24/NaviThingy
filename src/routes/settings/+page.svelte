<script lang="ts">
  import { download } from '$lib/client/util';
  import ContextMenu from '$lib/components/ContextMenu.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { selectedServer } from '$lib/stores/selectedServer';
  import { servers } from '$lib/stores/servers';
  import { theme } from '$lib/stores/theme';
  import type { Theme } from '$lib/types/theme';
    
    $: currentTheme = theme.themes.find(t => t.id === $theme);
    let customTheme = { ...currentTheme, name: '' };
    let showCustomThemeEditor = false;
    let importUrl = '';
    let fileInput: HTMLInputElement;

    let contextMenu = {
        show: false,
        x: 0,
        y: 0,
        theme: null as Theme | null
    };

    let isCreating = false;

    function handleContextMenu(event: MouseEvent, t: Theme) {
        event.preventDefault();
        contextMenu = {
            show: true,
            x: event.clientX,
            y: event.clientY,
            theme: t
        };
    }

    function handleThemeClick(t: Theme) {
        theme.setTheme(t.id);
    }

    function handleCreateTheme() {
        isCreating = true;
        customTheme = {
            id: '',
            name: '',
            colors: {
                primary: '#60a5fa',
                secondary: '#34d399',
                background: '#1a1b1e',
                surface: '#2c2e33',
                text: '#e5e7eb',
                textSecondary: '#9ca3af'
            }
        };
        showCustomThemeEditor = true;
    }

    function customizeTheme(t: Theme) {
        isCreating = false;
        customTheme = { ...t, name: t.name + ' (Copy)' };
        showCustomThemeEditor = true;
    }

    async function handleThemeSave() {
        if (!customTheme.name) return;
        const newThemeId = 'custom_' + Date.now();
        theme.addTheme({
            ...customTheme,
            id: newThemeId
        });
        theme.setTheme(newThemeId);
        showCustomThemeEditor = false;
        window.location.reload();
    }

    function exportTheme(t: Theme) {
        const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        download(url, `${t.name.toLowerCase().replace(/\s+/g, '_')}_theme.json`);
        URL.revokeObjectURL(url);
    }

    async function importThemeFromUrl() {
        try {
            const response = await fetch(importUrl);
            const themeData = await response.json();
            theme.addTheme({ ...themeData, id: 'custom_' + Date.now() });
            importUrl = '';
            window.location.reload();
        } catch (error) {
            console.error('Failed to import theme:', error);
        }
    }

    function handleFileUpload(event: Event) {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const themeData = JSON.parse(e.target?.result as string);
                theme.addTheme({ ...themeData, id: 'custom_' + Date.now() });
                window.location.reload();
            } catch (error) {
                console.error('Failed to parse theme file:', error);
            }
        };
        reader.readAsText(file);
    }

    function removeTheme(themeId: string) {
        theme.removeTheme(themeId);
        if ($theme === themeId) {
            theme.setTheme('catppuccin-mocha');
        }
        window.location.reload();
    }

    function handleServerSwitch(serverId: string) {
        const server = $servers.find(s => s.id === serverId);
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
</script>

<div class="max-w-2xl mx-auto">
    <h1 class="text-3xl font-bold mb-8">Settings</h1>

    <div class="rounded-lg p-6 mb-8 shadow-lg bg-surface">
        <h2 class="text-xl font-semibold mb-4">Server Settings</h2>
        <div class="space-y-4">
            {#each $servers as server}
                <div class="flex items-center justify-between p-4 rounded-lg bg-background">
                    <div>
                        <h3 class="font-medium">{server.name}</h3>
                        <p class="text-sm text-text-secondary">{server.url}</p>
                    </div>
                    <div class="flex gap-2">
                        <button
                            class="px-3 py-1 rounded-lg text-sm font-medium {$selectedServer?.id === server.id ? 'bg-primary text-background' : 'bg-surface'}"
                            on:click={() => handleServerSwitch(server.id)}
                            disabled={$selectedServer?.id === server.id}
                        >
                            {$selectedServer?.id === server.id ? 'Current' : 'Switch'}
                        </button>
                        <button
                            class="px-3 py-1 rounded-lg text-sm font-medium bg-surface hover:bg-red-500/20"
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

    <div class="rounded-lg p-6 mb-8 shadow-lg bg-surface">
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-semibold">Theme Settings</h2>
            <div class="flex gap-2">
                <button
                    class="px-3 py-1 rounded-lg text-sm font-medium bg-primary text-background hover:opacity-90"
                    on:click={handleCreateTheme}
                >
                    Create Theme
                </button>
                <button
                    class="px-3 py-1 rounded-lg text-sm font-medium bg-surface border border-primary hover:opacity-90"
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
            <div class="flex gap-2">
                <input
                    type="url"
                    bind:value={importUrl}
                    placeholder="Import theme from URL"
                    class="flex-1 p-2 rounded-lg bg-background text-text"
                />
                <button
                    class="px-3 py-1 rounded-lg text-sm font-medium bg-primary text-background hover:opacity-90"
                    on:click={importThemeFromUrl}
                >
                    Import
                </button>
            </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {#each theme.themes as t}
                <button
                    class="p-4 rounded-lg relative group text-left"
                    style:background-color={t.colors.surface}
                    style:color={t.colors.text}
                    style:border={t.id === $theme ? `2px solid ${t.colors.primary}` : 'none'}
                    on:click={() => handleThemeClick(t)}
                    on:contextmenu={(e) => handleContextMenu(e, t)}
                >
                    <div class="flex flex-col gap-2">
                        <span class="font-medium">{t.name}</span>
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
            items={contextMenu.theme ? [
                {
                    label: 'Export Theme',
                    action: () => exportTheme(contextMenu.theme!)
                },
                {
                    label: 'Customize',
                    action: () => customizeTheme(contextMenu.theme!)
                },
                ...(contextMenu.theme.id.startsWith('custom_') ? [{
                    label: 'Delete',
                    action: () => removeTheme(contextMenu.theme!.id)
                }] : [])
            ] : []}
            on:close={() => contextMenu.show = false}
        />

    </div>

    <Modal bind:show={showCustomThemeEditor}>
        <div class="p-6 bg-background">
            <h3 class="text-lg font-semibold mb-4">
                {isCreating ? 'Create New Theme' : 'Customize Theme'}
            </h3>
            <div class="space-y-4">
                <div>
                    <label class="block mb-1">Theme Name
                        <input
                            type="text"
                            bind:value={customTheme.name}
                            class="w-full p-2 rounded color-text bg-surface"
                        />
                    </label>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    {#each Object.entries(customTheme.colors) as [key, value]}
                        <div>
                            <label class="block mb-1 capitalize">{key}
                                <div class="relative">
                                    <input
                                        type="color"
                                        bind:value={customTheme.colors[key]}
                                        class="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                    />
                                    <div class="flex gap-2 p-2 rounded bg-surface">
                                        <div class="w-6 h-6 rounded" style:background-color={value as any}></div>
                                        <input
                                            type="text"
                                            bind:value={customTheme.colors[key]}
                                            class="flex-1 bg-transparent"
                                        />
                                    </div>
                                </div>
                            </label>
                        </div>
                    {/each}
                </div>
                <div class="flex justify-end gap-2 mt-4">
                    <button
                        class="px-4 py-2 rounded-lg font-medium bg-surface hover:opacity-90"
                        on:click={() => showCustomThemeEditor = false}
                    >
                        Cancel
                    </button>
                    <button
                        class="px-4 py-2 rounded-lg font-medium bg-primary text-background hover:opacity-90"
                        disabled={!customTheme.name}
                        on:click={handleThemeSave}
                    >
                        Save Theme
                    </button>
                </div>
            </div>
        </div>
    </Modal>
</div>

<style>
    .tooltip {
        position: relative;
    }
    .tooltip:hover::after {
        content: attr(data-tip);
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        padding: 0.25rem 0.5rem;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        white-space: nowrap;
    }
</style>