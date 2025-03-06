<script lang="ts">
  import { page } from "$app/state";
  import { formatDate } from "$lib/client/util";
  import Modal from "$lib/components/Modal.svelte";
  import Song from "$lib/components/Song.svelte";
  import { client } from "$lib/stores/client";
  import { player } from "$lib/stores/player";
  import type { PlaylistWithSongs } from "@vmohammad/subsonic-api";
  import {
    Clock,
    Edit,
    Hourglass,
    ListMusic,
    Lock,
    Plus,
    Search,
    Trash2,
    Unlock,
    User,
  } from "lucide-svelte";
  import { onMount } from "svelte";
  import { dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from "svelte-dnd-action";

  const playlistId = page.params.id;
  let playlist: PlaylistWithSongs;
  let isEditing = false;
  let editName = "";

  let dragItems: any[] = [];
  $: dragItems =
    playlist?.entry?.map((item) => ({
      ...item,
      [SHADOW_ITEM_MARKER_PROPERTY_NAME]: false,
    })) || [];

  let showAddSong = false;
  let searchQuery = "";
  let searchResults: any[] = [];
  let searching = false;
  let showDeleteConfirm = false;

  onMount(async () => {
    playlist = await $client!.getPlaylist(playlistId);
    editName = playlist.name;
  });

  async function refreshPlaylist() {
    playlist = await $client!.getPlaylist(playlistId);
    editName = playlist.name;
  }

  async function updatePlaylist() {
    if (editName !== playlist.name) {
      await $client!.updatePlaylist(playlistId, { name: editName });
      await refreshPlaylist();
    }
    isEditing = false;
  }

  async function removeSong(songId: string, index: number) {
    await $client!.updatePlaylist(playlistId, {
      songIndexToRemove: [index],
    });
    await refreshPlaylist();
  }

  function playPlaylist(startIndex = 0) {
    if (playlist.entry) {
      player.setPlaylist(playlist.entry, startIndex);
    }
  }

  async function deletePlaylist() {
    if (confirm("Are you sure you want to delete this playlist?")) {
      await $client!.deletePlaylist(playlistId);
      history.back();
    }
  }

  async function handleDelete() {
    await $client!.deletePlaylist(playlistId);
    history.back();
  }

  async function toggleVisibility() {
    await $client!.updatePlaylist(playlistId, {
      public: !playlist.public,
    });
    await refreshPlaylist();
  }

  function getTotalDuration() {
    if (!playlist.entry) return 0;
    return playlist.entry.reduce((acc, song) => acc + (song.duration || 0), 0);
  }

  function formatDuration(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  function handleDndConsider(e: CustomEvent<{ items: any[] }>) {
    dragItems = e.detail.items;
  }

  async function handleDndFinalize(e: CustomEvent<{ items: any[] }>) {
    const cleanItems = e.detail.items.map(
      ({ [SHADOW_ITEM_MARKER_PROPERTY_NAME]: _, ...item }) => item
    );

    const songIds = cleanItems.map((song) => song.id);
    const indices = Array.from(
      { length: playlist.entry?.length || 0 },
      (_, i) => i
    );

    await $client!.updatePlaylist(playlistId, {
      songIndexToRemove: indices,
    });

    await $client!.updatePlaylist(playlistId, {
      songIdToAdd: songIds,
    });

    await refreshPlaylist();
  }

  function debounce<T extends (...args: any[]) => void>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  const debouncedSearch = debounce(async () => {
    if (!searchQuery) {
      searchResults = [];
      return;
    }

    searching = true;
    try {
      const results = await $client!.search(searchQuery.trim(), "song");
      searchResults = results.song || [];
    } finally {
      searching = false;
    }
  }, 300);

  async function addSong(songId: string) {
    await $client!.updatePlaylist(playlistId, {
      songIdToAdd: [songId],
    });
    await refreshPlaylist();
    searchResults = searchResults.filter((s) => s.id !== songId);
  }

  function handleKeyDown(event: KeyboardEvent, callback: () => void) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      callback();
    }
  }
</script>

<div class="min-h-screen bg-background p-8">
  {#if playlist}
    <div class="bg-surface rounded-lg shadow-md p-6 mb-6">
      <div class="flex gap-6">
        <div class="w-48 h-48 bg-background/50 rounded-lg overflow-hidden">
          {#if playlist.entry && playlist.entry[0]?.coverArt}
            <img
              src={playlist.entry[0].coverArt}
              alt={playlist.name}
              class="w-full h-full object-cover"
            />
          {:else}
            <div class="w-full h-full flex items-center justify-center">
              <ListMusic size={64} class="text-text-secondary" />
            </div>
          {/if}
        </div>

        <div class="flex-1">
          <div class="flex justify-between items-center mb-4">
            <div class="flex items-center gap-4">
              <ListMusic class="text-primary" size={32} />
              {#if isEditing}
                <input
                  type="text"
                  bind:value={editName}
                  class="text-2xl font-bold p-2 border rounded bg-background text-text"
                />
              {:else}
                <h1 class="text-2xl font-bold text-text">{playlist.name}</h1>
              {/if}
            </div>
            <div class="flex gap-2">
              {#if isEditing}
                <button
                  class="bg-primary text-surface px-4 py-2 rounded hover:opacity-90"
                  on:click={updatePlaylist}
                >
                  Save
                </button>
                <button
                  class="text-text-secondary hover:text-text px-4 py-2"
                  on:click={() => (isEditing = false)}
                >
                  Cancel
                </button>
              {:else}
                <button
                  class="text-text-secondary hover:text-text p-2"
                  on:click={() => (isEditing = true)}
                >
                  <Edit size={20} />
                </button>
                <button
                  class="text-text-secondary hover:text-red-500 p-2"
                  on:click={() => (showDeleteConfirm = true)}
                >
                  <Trash2 size={20} />
                </button>
              {/if}
            </div>
          </div>
          <div class="mt-4 space-y-2 text-text-secondary">
            <div class="flex items-center gap-2">
              <User size={16} />
              <span>Created by {playlist.owner}</span>
              <button
                class="flex items-center gap-1 ml-2 hover:text-text"
                on:click={toggleVisibility}
                on:keydown={(e) => handleKeyDown(e, toggleVisibility)}
              >
                {#if playlist.public}
                  <Unlock size={16} />
                  <span class="text-sm">Public</span>
                {:else}
                  <Lock size={16} />
                  <span class="text-sm">Private</span>
                {/if}
              </button>
            </div>
            <div class="flex items-center gap-2">
              <Clock size={16} />
              <span>Total duration: {formatDuration(getTotalDuration())}</span>
            </div>
            {#if playlist.changed}
              <p>Last updated: {formatDate(playlist.changed)}</p>
            {/if}
            {#if playlist.comment}
              <p class="italic">{playlist.comment}</p>
            {/if}
          </div>
          <div class="flex items-center gap-4 mt-4">
            <p class="text-text-secondary">{playlist.songCount || 0} songs</p>
            <div class="flex gap-2">
              {#if playlist.entry?.length}
                <button
                  class="bg-primary text-surface px-4 py-2 rounded hover:opacity-90"
                  on:click={() => playPlaylist()}
                  on:keydown={(e) => handleKeyDown(e, () => playPlaylist())}
                >
                  Play
                </button>
              {/if}
              <button
                class="bg-surface text-text-secondary px-4 py-2 rounded hover:text-primary hover:bg-surface/80 flex items-center gap-2"
                on:click={() => (showAddSong = true)}
                on:keydown={(e) => handleKeyDown(e, () => (showAddSong = true))}
              >
                <Plus size={20} />
                Add Songs
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-surface rounded-lg shadow-md">
      {#if playlist.entry}
        <section
          use:dndzone={{
            items: dragItems,
            dragDisabled: false,
            dropTargetStyle: {},
            transformDraggedElement: (draggedEl) => {
              if (!draggedEl) return;
              draggedEl.style.transform = "scale(1.02)";
              draggedEl.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
            },
          }}
          on:consider={handleDndConsider}
          on:finalize={handleDndFinalize}
          class="transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
          role="list"
        >
          {#each dragItems as song, index (`${song.id}_${index}`)}
            <Song
              {song}
              {index}
              playlist={playlist.entry}
              showTrackNumber={true}
              extraOptions={[
                {
                  label: "Remove from playlist",
                  action: () => removeSong(song.id, index),
                  icon: Trash2,
                },
              ]}
            />
          {/each}
        </section>
      {:else}
        <p class="p-4 text-text-secondary">This playlist is empty</p>
      {/if}
    </div>
  {/if}
</div>

<Modal bind:show={showAddSong} maxWidth="max-w-2xl">
  <div class="bg-surface rounded-lg">
    <div class="p-6">
      <h2 class="text-xl font-semibold mb-4">Add Songs</h2>
      <div class="flex gap-2 mb-4">
        <div class="relative flex-1">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Search songs..."
            class="w-full p-2 pr-8 rounded bg-background text-text border border-white/10"
            on:input={debouncedSearch}
          />
          {#if searching}
            <Hourglass
              size={20}
              class="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary animate-spin"
            />
          {:else}
            <Search
              size={20}
              class="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary"
            />
          {/if}
        </div>
      </div>

      <div class="max-h-[60vh] overflow-y-auto">
        {#each searchResults as song}
          <button
            class="w-full flex items-center gap-3 p-2 hover:bg-primary/10 rounded group text-left"
            on:click={() => addSong(song.id)}
          >
            <img
              src={song.coverArt}
              alt={song.title}
              class="w-12 h-12 rounded object-cover"
            />
            <div class="flex-1 min-w-0">
              <p class="truncate font-medium">{song.title}</p>
              <p class="truncate text-sm text-text-secondary">{song.artist}</p>
            </div>
            <div
              class="opacity-0 group-hover:opacity-100 p-2 hover:bg-primary/20 rounded transition-opacity"
            >
              <Plus size={20} />
            </div>
          </button>
        {/each}
      </div>
    </div>
  </div>
</Modal>

<Modal bind:show={showDeleteConfirm} maxWidth="max-w-md">
  <div class="bg-surface rounded-lg p-6">
    <h2 class="text-xl font-semibold mb-4">Delete Playlist</h2>
    <p class="text-text-secondary mb-6">
      Are you sure you want to delete this playlist? This action cannot be
      undone.
    </p>
    <div class="flex justify-end gap-4">
      <button
        class="px-4 py-2 text-text-secondary hover:text-text"
        on:click={() => (showDeleteConfirm = false)}
      >
        Cancel
      </button>
      <button
        class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        on:click={handleDelete}
      >
        Delete
      </button>
    </div>
  </div>
</Modal>
