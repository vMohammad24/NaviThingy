<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    
    type MenuItem = {
        label?: string;
        action?: () => void;
        type?: 'separator';
    };

    export let show = false;
    export let x = 0;
    export let y = 0;
    export let items: MenuItem[] = [];

    const dispatch = createEventDispatcher();

    function handleClickOutside(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (show && !target.closest('.context-menu')) {
            show = false;
            dispatch('close');
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape' && show) {
            show = false;
            dispatch('close');
        }
    }

    $: if (show) {
        document.addEventListener('click', handleClickOutside);
        document.addEventListener('keydown', handleKeydown);
    } else {
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('keydown', handleKeydown);
    }

    $: menuStyle = calculateMenuPosition(x, y);

    function calculateMenuPosition(x: number, y: number): string {
        const padding = 5;
        let posX = x;
        let posY = y;

        
        if (typeof window !== 'undefined') {
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
        style="{menuStyle}"
    >
        {#each items as item}
            {#if item.type === 'separator'}
                <div class="h-px my-1 bg-primary opacity-20"></div>
            {:else}
                <button
                    class="w-full px-4 py-2 text-left hover:opacity-80 transition-opacity text-text"
                    on:click={() => {
                        item.action?.();
                        show = false;
                        dispatch('close');
                    }}
                >
                    {item.label}
                </button>
            {/if}
        {/each}
    </div>
{/if}

<style>
    .context-menu {
        animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: scale(0.95);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
</style>