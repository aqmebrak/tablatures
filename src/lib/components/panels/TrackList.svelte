<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { addTrack, canAddTrack } from '$lib/score/commands/addTrack';
	import { removeTrack } from '$lib/score/commands/removeTrack';
	import type { createEditor } from '$lib/score/editorStore.svelte';
	import { familyOf, type InstrumentFamily } from '$lib/score/instruments';

	let { editor }: { editor: ReturnType<typeof createEditor> } = $props();

	const FAMILY_LABEL: Record<InstrumentFamily, string> = { guitar: 'Guitar', bass: 'Bass' };

	// Commands mutate the score in place; read revision so these re-derive.
	const tracks = $derived.by(() => {
		void editor.revision;
		return editor.score.tracks.map((t) => ({
			name: t.name,
			family: familyOf(t.playbackInfo.program)
		}));
	});
	const canAdd = $derived.by(() => {
		void editor.revision;
		return canAddTrack(editor.score);
	});

	/** Give the keyboard back to the tab editor after a panel interaction. */
	function release(target: EventTarget | null) {
		(target as HTMLElement | null)?.blur();
	}

	function add(family: InstrumentFamily) {
		const index = editor.run('add track', (ctx) => addTrack(ctx, family));
		if (index !== undefined) editor.selectTrack(index);
	}

	function select(event: Event, i: number) {
		editor.selectTrack(i);
		release(event.currentTarget);
	}

	function remove(event: Event, trackIndex: number) {
		const selected = editor.cursor.trackIndex;
		if (editor.run('remove track', (ctx) => removeTrack(ctx, trackIndex))) {
			if (trackIndex < selected) editor.selectTrack(selected - 1);
			else if (trackIndex === selected)
				editor.selectTrack(Math.min(selected, editor.score.tracks.length - 1));
		}
		release(event.currentTarget);
	}
</script>

<section class="flex h-full items-center gap-2 p-3">
	{#each tracks as track, i (i)}
		<div class="flex shrink-0 items-center">
			<button
				class="rounded-l px-3 py-1.5 text-xs font-medium {i === editor.cursor.trackIndex
					? 'bg-neutral-700 text-neutral-100'
					: 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100'}"
				onclick={(e) => select(e, i)}
			>
				{track.name} — {FAMILY_LABEL[track.family]}
			</button>
			{#if tracks.length > 1}
				<button
					class="rounded-r bg-neutral-800 px-2 py-1.5 text-xs text-neutral-500 hover:bg-red-900 hover:text-neutral-100"
					aria-label="Remove {track.name}"
					onclick={(e) => remove(e, i)}>×</button
				>
			{/if}
		</div>
	{/each}

	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			class="shrink-0 rounded border border-dashed border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 disabled:opacity-40"
			disabled={!canAdd}
		>
			+ Add track
		</DropdownMenu.Trigger>
		<DropdownMenu.Portal>
			<DropdownMenu.Content
				class="z-50 min-w-32 rounded border border-neutral-700 bg-neutral-800 p-1 text-sm text-neutral-100 shadow-lg"
				side="top"
			>
				<DropdownMenu.Item
					class="cursor-pointer rounded px-2 py-1 data-highlighted:bg-neutral-700"
					onSelect={() => add('guitar')}>Guitar</DropdownMenu.Item
				>
				<DropdownMenu.Item
					class="cursor-pointer rounded px-2 py-1 data-highlighted:bg-neutral-700"
					onSelect={() => add('bass')}>Bass</DropdownMenu.Item
				>
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	</DropdownMenu.Root>
</section>
