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

	// Phase 1 ships a fixed-length score: 8 bars gives arrow-key navigation
	// and fret typing something real to move across out of the box. Beats
	// within a bar insert automatically via ArrowRight; adding or removing
	// whole bars (document structure editing) is Phase 2 scope.
	const editor = createEditor({ bars: 8 });

	function isEditableTarget(target: EventTarget | null): boolean {
		return (
			target instanceof HTMLInputElement ||
			target instanceof HTMLSelectElement ||
			target instanceof HTMLTextAreaElement ||
			(target instanceof HTMLElement && target.isContentEditable)
		);
	}

	function handleKeydown(event: KeyboardEvent) {
		// Don't hijack keystrokes meant for a focused form control (e.g. the
		// <select> elements in InstrumentInspector) — only intercept keys when
		// the editor canvas itself has focus.
		if (isEditableTarget(event.target)) return;
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
	<TransportBar {editor} />
	<div class="flex min-h-0 flex-1">
		<aside class="w-56 shrink-0 overflow-y-auto border-r border-neutral-800" data-testid="palette">
			<NotationPalette {editor} />
		</aside>
		<main class="min-w-0 flex-1 overflow-auto bg-neutral-100" data-testid="score-pane">
			<ScoreView score={editor.score} revision={editor.revision} cursor={editor.cursor} />
		</main>
		<aside
			class="w-72 shrink-0 overflow-y-auto border-l border-neutral-800"
			data-testid="inspector"
		>
			<InstrumentInspector {editor} />
		</aside>
	</div>
	<footer class="h-32 shrink-0 overflow-y-auto border-t border-neutral-800" data-testid="tracks">
		<TrackList />
	</footer>
</div>
