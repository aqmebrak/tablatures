<script lang="ts">
	import type { createEditor } from '$lib/score/editorStore.svelte';

	let { editor }: { editor: ReturnType<typeof createEditor> } = $props();
</script>

<header
	class="flex h-10 shrink-0 items-center gap-3 border-b border-neutral-800 bg-neutral-900 px-3"
>
	<div class="flex items-center gap-1">
		<button class="rounded bg-neutral-800 px-2 py-1 text-sm hover:bg-neutral-700" aria-label="Play"
			>▶</button
		>
		<button class="rounded bg-neutral-800 px-2 py-1 text-sm hover:bg-neutral-700" aria-label="Stop"
			>■</button
		>
	</div>

	<div class="h-4 w-px bg-neutral-800"></div>

	<span class="text-xs tabular-nums text-neutral-400">{editor.score.tempo} BPM</span>

	<div class="h-4 w-px bg-neutral-800"></div>

	<div class="ml-auto flex items-center gap-1">
		<button
			class="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
			aria-label="Undo"
			disabled={!editor.canUndo}
			onclick={() => editor.undo()}>Undo</button
		>
		<button
			class="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
			aria-label="Redo"
			disabled={!editor.canRedo}
			onclick={() => editor.redo()}>Redo</button
		>
	</div>
</header>
