<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	interface Props {
		show?: boolean;
		maxWidth?: string;
		onClose?: () => void;
		children: Snippet;
	}

	let {
		show = $bindable(false),
		maxWidth = 'max-w-lg',
		onClose = () => {},
		children
	}: Props = $props();

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

<svelte:window onkeydown={handleKeydown} />

{#if show}
	<div
		class="fixed inset-0 flex items-center justify-center p-4 z-50"
		transition:fade={{ duration: 200 }}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="fixed inset-0 bg-black bg-opacity-50" onclick={close}></div>
		<div
			class="relative {maxWidth} w-full max-h-[90vh] overflow-y-auto rounded-lg"
			transition:scale={{ duration: 200, start: 0.5 }}
		>
			{@render children()}
		</div>
	</div>
{/if}
