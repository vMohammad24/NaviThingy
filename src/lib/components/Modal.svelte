<script lang="ts">
    import { fade, scale } from 'svelte/transition';
    
    export let show = false;
    export let maxWidth = 'max-w-lg';
    export let onClose: () => void = () => {};

    function close() {
        show = false;
        onClose();
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            close();
        }
    }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
    <div
        class="fixed inset-0 flex items-center justify-center p-4 z-50"
        transition:fade={{ duration: 200 }}
    >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
            class="fixed inset-0 bg-black bg-opacity-50"
            on:click={close}
        ></div>
        <div
            class="relative {maxWidth} w-full max-h-[90vh] overflow-y-auto rounded-lg"
            transition:scale={{ duration: 200, start: 0.95 }}
        >
            <slot />
        </div>
    </div>
{/if}