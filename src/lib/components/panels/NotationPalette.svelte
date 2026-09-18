<script lang="ts">
	import * as alphaTab from '@coderline/alphatab';
	import { applyAction } from '$lib/editor/dispatch';
	import { setDuration } from '$lib/score/commands/setDuration';
	import type { NoteArticulation } from '$lib/score/commands/toggleArticulation';
	import type { createEditor } from '$lib/score/editorStore.svelte';

	let { editor }: { editor: ReturnType<typeof createEditor> } = $props();

	const Duration = alphaTab.model.Duration;

	const DURATIONS: Record<string, alphaTab.model.Duration> = {
		'1': Duration.Whole,
		'2': Duration.Half,
		'4': Duration.Quarter,
		'8': Duration.Eighth,
		'16': Duration.Sixteenth,
		'32': Duration.ThirtySecond
	};

	const ARTICULATIONS: Record<string, NoteArticulation> = {
		'P.M.': 'palmMute',
		Dead: 'deadNote',
		Ghost: 'ghost',
		'Let ring': 'letRing',
		'H/P': 'hammerPullOff',
		Vibrato: 'vibrato'
	};

	function pressDuration(label: string) {
		if (label === '.') {
			applyAction(editor, { kind: 'dotted' });
			return;
		}
		const duration = DURATIONS[label];
		if (duration === undefined) return; // '3' (triplets): no command yet
		editor.run('duration', (ctx) => setDuration(ctx, duration));
	}

	function pressArticulation(label: string) {
		const name = ARTICULATIONS[label];
		if (!name) return; // Slide/Bend/Tremolo: no matching NoteArticulation yet
		applyAction(editor, { kind: 'articulation', name });
	}
</script>

<section class="p-3">
	<h2 class="mb-2 text-xs font-semibold tracking-wide text-neutral-400 uppercase">Duration</h2>
	<div class="grid grid-cols-4 gap-1">
		{#each ['1', '2', '4', '8', '16', '32', '.', '3'] as label (label)}
			<button
				class="rounded bg-neutral-800 px-2 py-1 text-sm hover:bg-neutral-700"
				onclick={() => pressDuration(label)}>{label}</button
			>
		{/each}
	</div>

	<h2 class="mt-4 mb-2 text-xs font-semibold tracking-wide text-neutral-400 uppercase">
		Articulation
	</h2>
	<div class="grid grid-cols-2 gap-1">
		{#each ['P.M.', 'Dead', 'Ghost', 'Let ring', 'H/P', 'Slide', 'Bend', 'Vibrato', 'Tremolo'] as label (label)}
			<button
				class="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
				onclick={() => pressArticulation(label)}>{label}</button
			>
		{/each}
	</div>
</section>
