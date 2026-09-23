<script lang="ts">
	import type { createEditor } from '$lib/score/editorStore.svelte';

	let { editor }: { editor: ReturnType<typeof createEditor> } = $props();

	// Read-only display of the active staff's real string count. Editing the
	// instrument/tuning is Phase 2 scope (full tuning-editing UI); for Phase 1
	// this just needs to stop lying about the score's actual shape.
	const stringCount = $derived(
		editor.score.tracks[editor.cursor.trackIndex]?.staves[0]?.stringTuning.tunings.length ?? 6
	);
</script>

<section class="p-3">
	<h2 class="mb-2 text-xs font-semibold tracking-wide text-neutral-400 uppercase">Instrument</h2>
	<div class="flex flex-col gap-3">
		<label class="flex flex-col gap-1 text-xs text-neutral-400">
			Instrument
			<select class="rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100">
				<option>Guitar</option>
				<option>Bass</option>
				<option>Drums</option>
			</select>
		</label>

		<label class="flex flex-col gap-1 text-xs text-neutral-400">
			Strings
			<select
				class="rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100 disabled:opacity-60"
				value={stringCount}
				disabled
				title="Read-only in Phase 1 — tuning editing is Phase 2 scope"
			>
				{#if ![4, 5, 6, 7, 8].includes(stringCount)}
					<option value={stringCount}>{stringCount}</option>
				{/if}
				{#each [4, 5, 6, 7, 8] as count (count)}
					<option value={count}>{count}</option>
				{/each}
			</select>
		</label>

		<label class="flex flex-col gap-1 text-xs text-neutral-400">
			Tuning
			<select class="rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100">
				<option>Standard</option>
			</select>
		</label>
	</div>
</section>
