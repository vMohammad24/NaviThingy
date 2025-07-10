<script lang="ts">
  import type { Icon } from "@lucide/svelte";
  import { fade } from "svelte/transition";

  type MenuItem = {
    label?: string;
    action?: () => void;
    type?: "separator";
    icon?: typeof Icon | string;
    item?: typeof Icon | string;
    props?: Record<string, any>;
  };

  interface Props {
    show?: boolean;
    x?: number;
    y?: number;
    items?: MenuItem[];
    onclose?: () => void;
  }

  let {
    show = $bindable(false),
    x = 0,
    y = 0,
    items = [],
    onclose,
  }: Props = $props();

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (show && !target.closest(".context-menu")) {
      show = false;
      onclose?.();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && show) {
      show = false;
      onclose?.();
    }
  }

  $effect(() => {
    if (show) {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("keydown", handleKeydown);
      return () => {
        document.removeEventListener("click", handleClickOutside);
        document.removeEventListener("keydown", handleKeydown);
      };
    } else {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeydown);
    }
  });

  let menuStyle = $derived(calculateMenuPosition(x, y));

  function calculateMenuPosition(x: number, y: number): string {
    const padding = 5;
    let posX = x;
    let posY = y;

    if (typeof window !== "undefined") {
      const menuWidth = 200;
      const menuHeight = items.length * 36;

      if (x + menuWidth > window.innerWidth) {
        posX = window.innerWidth - menuWidth - padding;
      }

      if (y + menuHeight > window.innerHeight) {
        posY = window.innerHeight - menuHeight - padding;
      }
    }

    return `left: ${posX}px; top: ${posY}px;`;
  }
</script>

{#if show}
  <div
    class="context-menu fixed z-50 min-w-[160px] rounded-lg shadow-lg py-1 bg-surface border border-primary max-w-fit"
    style={menuStyle}
    in:fade={{ delay: 0, duration: 200 }}
  >
    {#each items as item}
      {#if item.type === "separator"}
        <div class="h-px my-1 bg-primary opacity-20"></div>
      {:else if item.item}
        {#if typeof item.item === "string"}
          <div class="p-2 bg-primary text-primary rounded-lg">
            {item.item}
          </div>
        {:else}
          <div class="w-full px-4 py-2 text-text flex items-center">
            <item.item {...item.props || {}} />
          </div>
        {/if}
      {:else}
        <button
          class="w-full px-4 py-2 text-left hover:opacity-80 transition-opacity text-text flex items-center gap-2"
          onclick={() => {
            item.action?.();
            show = false;
            onclose?.();
          }}
        >
          {#if item.icon}
            {#if typeof item.icon === "string"}
              <img src={item.icon} alt={item.label} class="w-5 h-5" />
            {:else}
              <item.icon size={18} />
            {/if}
          {/if}
          {item.label}
        </button>
      {/if}
    {/each}
  </div>
{/if}
