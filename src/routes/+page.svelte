<script lang="ts">
  import { goto } from "$app/navigation";
  import { v4 as uuidv4 } from "uuid";
  import { selectedServer } from "../lib/stores/selectedServer";
  import { servers } from "../lib/stores/servers";
  import type { NavidromeServer } from "../lib/types/navidrome";

  let newServer = $state<NavidromeServer>({
    id: "",
    name: "",
    url: "",
    username: "",
    password: "",
  });
  let rememberSelection = $state(false);

  function handleSubmit() {
    if (
      newServer.name &&
      newServer.url &&
      newServer.username &&
      newServer.password
    ) {
      servers.add({
        ...newServer,
        id: uuidv4(),
      });
      newServer = {
        id: "",
        name: "",
        url: "",
        username: "",
        password: "",
      };
    }
  }

  function removeServer(id: string) {
    servers.remove(id);
  }

  function selectServer(server: NavidromeServer) {
    selectedServer.select(server, rememberSelection);
    goto("/home");
  }
</script>

<div class="max-w-2xl mx-auto">
  <h1 class="text-3xl font-bold mb-8">Navidrome Server Manager</h1>

  <div class="rounded-lg p-6 mb-8 shadow-lg bg-surface">
    <h2 class="text-xl font-semibold mb-4">Add New Server</h2>
    <form onsubmit={handleSubmit} class="space-y-4">
      <input
        type="text"
        bind:value={newServer.name}
        placeholder="Server Name"
        class="w-full p-3 rounded-lg transition-colors duration-200 bg-background text-text"
      />
      <input
        type="url"
        bind:value={newServer.url}
        placeholder="Server URL"
        class="w-full p-3 rounded-lg transition-colors duration-200 bg-background text-text"
      />
      <input
        type="text"
        bind:value={newServer.username}
        placeholder="Username"
        class="w-full p-3 rounded-lg transition-colors duration-200 bg-background text-text"
      />
      <input
        type="password"
        bind:value={newServer.password}
        placeholder="Password"
        class="w-full p-3 rounded-lg transition-colors duration-200 bg-background text-text"
      />
      <button
        type="submit"
        class="w-full p-3 rounded-lg font-medium transition-colors duration-200 bg-primary text-background"
      >
        Add Server
      </button>
    </form>
  </div>

  <div class="space-y-4">
    {#each $servers as server}
      <div
        class="rounded-lg p-4 shadow-md transition-all duration-200 hover:shadow-lg bg-surface"
      >
        <div>
          <h3 class="font-bold">{server.name}</h3>
          <p class="text-sm text-text-secondary">{server.url}</p>
        </div>
        <div class="flex gap-3">
          <button
            onclick={() => selectServer(server)}
            class="px-4 py-2 rounded-lg font-medium transition-colors duration-200 text-background"
            class:bg-secondary={$selectedServer?.id === server.id}
            class:bg-primary={$selectedServer?.id !== server.id}
          >
            {$selectedServer?.id === server.id ? "Selected" : "Select"}
          </button>
          <button
            onclick={() => removeServer(server.id)}
            class="px-4 py-2 rounded-lg font-medium transition-colors duration-200 bg-red-600 text-text hover:bg-red-700"
          >
            Remove
          </button>
        </div>
      </div>
    {/each}
  </div>

  <div class="mt-4 flex items-center">
    <label class="flex items-center space-x-2">
      <input
        type="checkbox"
        bind:checked={rememberSelection}
        class="form-checkbox"
      />
      <span>Remember selected server</span>
    </label>
  </div>
</div>
