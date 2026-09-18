<script lang="ts">
	import { onMount } from 'svelte';
	import ScoreView from '$lib/components/ScoreView.svelte';
	import TransportBar from '$lib/components/TransportBar.svelte';
	import NotationPalette from '$lib/components/panels/NotationPalette.svelte';
	import InstrumentInspector from '$lib/components/panels/InstrumentInspector.svelte';
	import TrackList from '$lib/components/panels/TrackList.svelte';
	import { applyAction } from '$lib/editor/dispatch';
	import { resolveKey } from '$lib/editor/keymap';
	import { createEditor } from '$lib/score/editorStore.svelte';

	const editor = createEditor();

	function handleKeydown(event: KeyboardEvent) {
		const action = resolveKey(event);
		if (!action) return;
		event.preventDefault();
		applyAction(editor, action);
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

<div class="flex h-screen flex-col bg-neutral-900 text-neutral-100">
	<TransportBar />
	<div class="flex min-h-0 flex-1">
		<aside class="w-56 shrink-0 overflow-y-auto border-r border-neutral-800" data-testid="palette">
			<NotationPalette {editor} />
		</aside>
		<main class="min-w-0 flex-1 overflow-auto bg-neutral-100" data-testid="score-pane">
			<ScoreView score={editor.score} revision={editor.revision} />
		</main>
		<aside
			class="w-72 shrink-0 overflow-y-auto border-l border-neutral-800"
			data-testid="inspector"
		>
			<InstrumentInspector />
		</aside>
	</div>
	<footer class="h-32 shrink-0 overflow-y-auto border-t border-neutral-800" data-testid="tracks">
		<TrackList />
	</footer>
</div>
