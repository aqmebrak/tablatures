<script lang="ts">
	import { renameTrack } from '$lib/score/commands/renameTrack';
	import { setProgram } from '$lib/score/commands/setProgram';
	import { setStringCount } from '$lib/score/commands/setStringCount';
	import { setStringPitch } from '$lib/score/commands/setStringPitch';
	import { setTuning } from '$lib/score/commands/setTuning';
	import { shiftCursorString } from '$lib/score/cursor';
	import type { createEditor } from '$lib/score/editorStore.svelte';
	import { PROGRAMS } from '$lib/score/instruments';
	import { tuningIndexToStringNumber } from '$lib/score/strings';
	import { describeTuning, presetsFor } from '$lib/score/tuning';

	let { editor }: { editor: ReturnType<typeof createEditor> } = $props();

	const STRING_COUNTS = [4, 5, 6, 7, 8];

	// Plain values, re-derived on every command (the score is mutated in place,
	// so its reference alone would never change) and on track selection.
	const info = $derived.by(() => {
		void editor.revision;
		const trackIndex = editor.cursor.trackIndex;
		const track = editor.score.tracks[trackIndex];
		const staff = track.staves[0];
		return {
			trackIndex,
			name: track.name,
			program: track.playbackInfo.program,
			tunings: [...staff.tuning]
		};
	});
	const presets = $derived(presetsFor(info.tunings.length));
	const presetName = $derived(
		presets.find((p) => p.tunings.join() === info.tunings.join())?.name ?? 'Custom'
	);
	const knownProgram = $derived(PROGRAMS.some((p) => p.program === info.program));

	let notice = $state('');
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;
	function showNotice(text: string) {
		notice = text;
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (notice = ''), 4000);
	}

	/** Give the keyboard back to the tab editor after a panel interaction. */
	function release(target: EventTarget | null) {
		(target as HTMLElement | null)?.blur();
	}

	function commitName(input: HTMLInputElement) {
		if (input.value.trim() === '') input.value = info.name;
		else editor.run('rename track', (ctx) => renameTrack(ctx, info.trackIndex, input.value));
	}

	function onNameKeydown(event: KeyboardEvent) {
		const input = event.currentTarget as HTMLInputElement;
		if (event.key === 'Enter') input.blur(); // blur commits
		if (event.key === 'Escape') {
			input.value = info.name;
			input.blur();
		}
	}

	function onSound(event: Event) {
		const program = Number((event.currentTarget as HTMLSelectElement).value);
		editor.run('sound', (ctx) => setProgram(ctx, info.trackIndex, program));
		release(event.currentTarget);
	}

	function onStrings(event: Event) {
		const count = Number((event.currentTarget as HTMLSelectElement).value);
		const delta = count - info.tunings.length;
		const { removedNotes } = editor.run('strings', (ctx) =>
			setStringCount(ctx, info.trackIndex, count)
		);
		editor.cursor = shiftCursorString(editor.cursor, delta, editor.shape());
		if (removedNotes > 0)
			showNotice(`${removedNotes} note${removedNotes === 1 ? '' : 's'} removed · Ctrl+Z to undo`);
		release(event.currentTarget);
	}

	function onPreset(event: Event) {
		const preset = presets.find((p) => p.name === (event.currentTarget as HTMLSelectElement).value);
		if (preset) editor.run('tuning', (ctx) => setTuning(ctx, info.trackIndex, preset.tunings));
		release(event.currentTarget);
	}

	function step(event: Event, tuningIndex: number, delta: number) {
		const stringNumber = tuningIndexToStringNumber(tuningIndex, info.tunings.length);
		const midi = info.tunings[tuningIndex] + delta;
		editor.run('string pitch', (ctx) => setStringPitch(ctx, info.trackIndex, stringNumber, midi), {
			coalesceKey: `pitch:${info.trackIndex}:${stringNumber}`
		});
		release(event.currentTarget);
	}
</script>

<section class="p-3">
	<h2 class="mb-2 text-xs font-semibold tracking-wide text-neutral-400 uppercase">Instrument</h2>
	<div class="flex flex-col gap-3">
		<label class="flex flex-col gap-1 text-xs text-neutral-400">
			Name
			<!-- Keyed on the track so switching tracks resets the uncontrolled value. -->
			{#key info.trackIndex}
				<input
					class="rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100"
					value={info.name}
					onblur={(e) => commitName(e.currentTarget)}
					onkeydown={onNameKeydown}
				/>
			{/key}
		</label>

		<!--
			These three <select>s use explicit for/id, not label-wrapping: a
			wrapping <label> folds the select's OWN option text into its
			accessible name (e.g. an option literally named "Bass 6 Strings
			Tuning" made the Tuning select match getByLabel('Strings') too).
			Explicit association keeps the accessible name to the label text.
		-->
		<div class="flex flex-col gap-1 text-xs text-neutral-400">
			<label for="inspector-sound">Sound</label>
			<select
				id="inspector-sound"
				class="rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100"
				value={String(info.program)}
				onchange={onSound}
			>
				{#if !knownProgram}
					<option value={String(info.program)}>Program {info.program}</option>
				{/if}
				<optgroup label="Guitar">
					{#each PROGRAMS.filter((p) => p.family === 'guitar') as p (p.program)}
						<option value={String(p.program)}>{p.label}</option>
					{/each}
				</optgroup>
				<optgroup label="Bass">
					{#each PROGRAMS.filter((p) => p.family === 'bass') as p (p.program)}
						<option value={String(p.program)}>{p.label}</option>
					{/each}
				</optgroup>
				<option disabled>Drums (coming later)</option>
			</select>
		</div>

		<div class="flex flex-col gap-1 text-xs text-neutral-400">
			<label for="inspector-strings">Strings</label>
			<select
				id="inspector-strings"
				class="rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100"
				value={String(info.tunings.length)}
				onchange={onStrings}
			>
				{#each STRING_COUNTS as count (count)}
					<option value={String(count)}>{count}</option>
				{/each}
			</select>
		</div>
		{#if notice}
			<p role="status" class="text-xs text-amber-400">{notice}</p>
		{/if}

		<div class="flex flex-col gap-1 text-xs text-neutral-400">
			<label for="inspector-tuning">Tuning</label>
			<select
				id="inspector-tuning"
				class="rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100"
				value={presetName}
				onchange={onPreset}
			>
				{#each presets as preset (preset.name)}
					<option value={preset.name}>{preset.name}</option>
				{/each}
				<option value="Custom" disabled>Custom</option>
			</select>
		</div>

		<ol class="flex flex-col gap-1">
			{#each info.tunings as midi, tuningIndex (tuningIndex)}
				<li
					data-testid="string-row"
					class="flex items-center gap-2 rounded bg-neutral-800/60 px-2 py-1 text-sm"
				>
					<span class="w-4 text-xs text-neutral-500">{tuningIndex + 1}</span>
					<span class="flex-1 font-mono">{describeTuning([midi])}</span>
					<button
						class="rounded px-1.5 hover:bg-neutral-700"
						aria-label="Raise string {tuningIndex + 1}"
						onclick={(e) => step(e, tuningIndex, 1)}>▲</button
					>
					<button
						class="rounded px-1.5 hover:bg-neutral-700"
						aria-label="Lower string {tuningIndex + 1}"
						onclick={(e) => step(e, tuningIndex, -1)}>▼</button
					>
				</li>
			{/each}
		</ol>
	</div>
</section>
