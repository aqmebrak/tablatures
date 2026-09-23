# Bar-Capacity Beat Insertion + Cursor Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Typing notes fills a bar up to its time-signature capacity before advancing to the next bar (matching Guitar Pro), and a visible, animated highlight shows the current cursor position on the rendered score.

**Architecture:** A new command, `advanceOrInsertBeat`, is the only code that decides what ArrowRight does at the boundary of existing beats — move onto an existing beat, insert a new one if the bar has capacity left, advance into the next bar if full, or no-op at the document's end. `editorStore.run()` is generalized to return the wrapped command's result and to skip recording history when the command made no actual change, so pure cursor navigation never creates undo noise. `ScoreView.svelte` gains a `cursor` prop and draws an absolutely-positioned highlight over the current beat using alphaTab's own `BoundsLookup` API.

**Tech Stack:** SvelteKit 2.70, Svelte 5 (runes), TypeScript, alphaTab 1.8.4, Vitest, Playwright — same as Phase 1, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-22-bar-capacity-and-cursor-highlight-design.md`

## Global Constraints

- Nothing outside `src/lib/score/commands/` mutates a `Score` (existing project rule — `advanceOrInsertBeat.ts` is the only new file that mutates).
- Every command that mutates the score must call `score.finish(settings)` afterward.
- `note.string`/`Cursor.stringNumber` conventions are unchanged by this plan — this work only touches beat/bar navigation, never string numbering.
- No default exports except Svelte components.
- Unit tests for anything under `src/lib/score/` run headless in Node, using alphaTex fixtures — no DOM, no jsdom.
- Backward beat movement (ArrowLeft) and string-axis movement (ArrowUp/ArrowDown) are **unchanged** by this plan — only forward beat movement (ArrowRight) routes through the new command.
- Capacity math uses alphaTab's own `Beat.displayDuration` and `MasterBar.calculateDuration()` (both in MIDI ticks) — verified empirically: a 4/4 bar is 3840 ticks; an eighth note is 480 ticks; four quarter notes (960 ticks each) sum to exactly 3840.

---

### Task 1: `advanceOrInsertBeat` command

**Files:**
- Create: `src/lib/score/commands/advanceOrInsertBeat.ts`
- Test: `src/lib/score/commands/advanceOrInsertBeat.test.ts`

**Interfaces:**
- Consumes: `CommandContext` from `src/lib/score/commands/types.ts` (`{score, settings, cursor}`), `Cursor` from `src/lib/score/cursor.ts`
- Produces: `advanceOrInsertBeat(ctx: CommandContext): Cursor` — the ONLY function later tasks import from this file

- [ ] **Step 1: Write the failing tests**

`src/lib/score/commands/advanceOrInsertBeat.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex } from '../serialize';
import { advanceOrInsertBeat } from './advanceOrInsertBeat';

const ctxFor = (tex: string, beatIndex = 0, barIndex = 0) => ({
	score: fromAlphaTex(tex),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex, voiceIndex: 0, beatIndex, stringNumber: 1 }
});

const beatsIn = (ctx: ReturnType<typeof ctxFor>, barIndex: number) =>
	ctx.score.tracks[0].staves[0].bars[barIndex].voices[0].beats;

describe('advanceOrInsertBeat', () => {
	it('moves onto an existing beat without mutating the score', () => {
		// bar 0 already has two quarter-note beats; bar 1 is a single whole rest.
		const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 . 0.6.4 3.6.4 | r.1');
		const before = beatsIn(ctx, 0).length;

		const cursor = advanceOrInsertBeat(ctx);

		expect(beatsIn(ctx, 0).length).toBe(before); // no mutation
		expect(cursor).toEqual({ trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 1, stringNumber: 1 });
	});

	it('inserts a new rest beat when the bar has capacity left', () => {
		// One quarter note (960 ticks) in a 4/4 bar (3840 ticks) leaves plenty of room.
		const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 . 0.6.4 | r.1');

		const cursor = advanceOrInsertBeat(ctx);

		const beats = beatsIn(ctx, 0);
		expect(beats.length).toBe(2);
		expect(beats[1].notes.length).toBe(0); // inserted beat is a rest
		expect(beats[1].duration).toBe(beats[0].duration); // inherits the current beat's duration
		expect(cursor).toEqual({ trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 1, stringNumber: 1 });
	});

	it('advances to the next bar once the current bar is exactly full', () => {
		// Four quarter notes (960 ticks each) exactly fill a 4/4 bar (3840 ticks).
		const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 . 0.6.4 0.6.4 0.6.4 0.6.4 | r.1', 3, 0);
		const before = beatsIn(ctx, 0).length;

		const cursor = advanceOrInsertBeat(ctx);

		expect(beatsIn(ctx, 0).length).toBe(before); // no mutation to the full bar
		expect(cursor).toEqual({ trackIndex: 0, barIndex: 1, voiceIndex: 0, beatIndex: 0, stringNumber: 1 });
	});

	it('is a no-op at the end of the document (last bar, full)', () => {
		// A single 4/4 bar, exactly full, and no bar after it.
		const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 . 0.6.4 0.6.4 0.6.4 0.6.4', 3, 0);
		const before = beatsIn(ctx, 0).length;

		const cursor = advanceOrInsertBeat(ctx);

		expect(beatsIn(ctx, 0).length).toBe(before);
		expect(cursor).toEqual(ctx.cursor);
	});

	it('leaves the score consistent enough to re-serialize after inserting', () => {
		const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 . 0.6.4 | r.1');
		advanceOrInsertBeat(ctx);
		expect(() => beatsIn(ctx, 0)[1].notes).not.toThrow();
	});
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
pnpm vitest run src/lib/score/commands/advanceOrInsertBeat.test.ts
```

Expected: FAIL — cannot find module `./advanceOrInsertBeat`.

- [ ] **Step 3: Implement**

`src/lib/score/commands/advanceOrInsertBeat.ts`:

```ts
import * as alphaTab from '@coderline/alphatab';
import type { Cursor } from '../cursor';
import type { CommandContext } from './types';

/**
 * Decides what ArrowRight should do at the boundary of existing beats:
 *  - if a beat already exists at beatIndex + 1, just move onto it (no mutation)
 *  - else if the current bar still has time-signature capacity left, insert a
 *    new rest beat (inheriting the current beat's duration) and move onto it
 *  - else if a next bar exists, move to its first beat
 *  - else (end of the document), the cursor is unchanged
 *
 * Never mutates unless it inserts a beat. `editorStore.run()` only records
 * an undo entry when the resulting score text actually differs (see Task 2),
 * so the pure-navigation and end-of-document cases here never create undo
 * noise even though every caller routes through `run()` uniformly.
 */
export function advanceOrInsertBeat(ctx: CommandContext): Cursor {
	const { score, settings, cursor } = ctx;
	const staff = score.tracks[cursor.trackIndex].staves[0];
	const bar = staff.bars[cursor.barIndex];
	const voice = bar.voices[cursor.voiceIndex];
	const currentBeat = voice.beats[cursor.beatIndex];
	if (!currentBeat) throw new Error(`No beat at ${JSON.stringify(cursor)}`);

	if (voice.beats[cursor.beatIndex + 1]) {
		return { ...cursor, beatIndex: cursor.beatIndex + 1 };
	}

	const masterBar = score.masterBars[cursor.barIndex];
	const usedTicks = voice.beats.reduce((sum, b) => sum + b.displayDuration, 0);
	const capacityTicks = masterBar.calculateDuration();

	if (usedTicks < capacityTicks) {
		const newBeat = new alphaTab.model.Beat();
		newBeat.duration = currentBeat.duration;
		voice.insertBeat(currentBeat, newBeat);
		score.finish(settings);
		return { ...cursor, beatIndex: cursor.beatIndex + 1 };
	}

	if (cursor.barIndex + 1 < staff.bars.length) {
		return { ...cursor, barIndex: cursor.barIndex + 1, beatIndex: 0 };
	}

	return cursor;
}
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
pnpm vitest run src/lib/score/commands/advanceOrInsertBeat.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/score/commands/advanceOrInsertBeat.ts src/lib/score/commands/advanceOrInsertBeat.test.ts
git commit -m "feat: advanceOrInsertBeat command for bar-capacity-aware navigation"
```

---

### Task 2: `editorStore.run()` returns a value and skips no-op history entries

**Files:**
- Modify: `src/lib/score/editorStore.svelte.ts`
- Modify: `src/lib/score/editorStore.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `run<T = void>(label: string, fn: (ctx: CommandContext) => T, opts?: { coalesceKey?: string }): T` — the return-value capability Task 3's dispatch wiring depends on

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/score/editorStore.test.ts` (append inside the existing `describe('editor store', ...)` block, alongside the existing tests — do not remove any existing test):

```ts
	it('returns the value produced by the command', () => {
		const editor = createEditor();
		const result = editor.run('compute', () => 42);
		expect(result).toBe(42);
	});

	it('does not record history when the command makes no actual change', () => {
		const editor = createEditor();
		const before = editor.revision;

		editor.run('noop', () => {});

		expect(editor.revision).toBe(before);
		expect(editor.canUndo).toBe(false);
	});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
pnpm vitest run src/lib/score/editorStore.test.ts
```

Expected: the new "returns the value produced by the command" test FAILs (current `run` has no return statement, so it returns `undefined`, not `42`). The "does not record history" test currently FAILs too, since today's `run` unconditionally pushes history and bumps revision.

- [ ] **Step 3: Implement**

In `src/lib/score/editorStore.svelte.ts`, replace the existing `run` method (leave every other method — `undo`, `redo`, `breakCoalesce`, the getters — exactly as they are):

```ts
		run<T = void>(
			label: string,
			fn: (ctx: CommandContext) => T,
			opts: { coalesceKey?: string } = {}
		): T {
			const before = toAlphaTex(score, settings);
			const result = fn({ score, settings, cursor });
			const after = toAlphaTex(score, settings);
			if (after !== before) {
				history.push({ tex: after, label }, opts);
				revision++;
				syncHistoryFlags();
			}
			return result;
		},
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
pnpm vitest run src/lib/score/editorStore.test.ts
```

Expected: PASS (all 7 tests — 5 existing + 2 new). Then run the full suite to confirm nothing else regressed:

```bash
pnpm test
```

Expected: PASS, same count as before plus 2.

- [ ] **Step 5: Commit**

```bash
git add src/lib/score/editorStore.svelte.ts src/lib/score/editorStore.test.ts
git commit -m "feat: run() returns its command's result and skips no-op history entries"
```

---

### Task 3: Wire `advanceOrInsertBeat` into keyboard dispatch

**Files:**
- Modify: `src/lib/editor/dispatch.ts`
- Modify: `src/lib/editor/dispatch.test.ts`

**Interfaces:**
- Consumes: `advanceOrInsertBeat` from Task 1, `run<T>` from Task 2
- Produces: nothing new for later tasks — this is where the feature becomes reachable from the keyboard

- [ ] **Step 1: Write the failing test**

Add to `src/lib/editor/dispatch.test.ts` (append inside the existing `describe('dispatch multi-digit fret buffering', ...)` block — this file's `describe` name predates this task; leave it as-is rather than renaming, to avoid an unrelated diff). You will need `alphaTab` imported for `Duration.Eighth`:

Add this import alongside the existing ones at the top of the file:

```ts
import * as alphaTab from '@coderline/alphatab';
```

Then add the test:

```ts
	it('ArrowRight inserts a new beat within the bar when a shorter duration leaves capacity (regression: bars could only ever hold one beat)', async () => {
		const applyAction = await freshApplyAction();
		const editor = createEditor(); // single bar, one whole-rest beat by default

		// Shrink the current beat to an eighth note, leaving most of the bar's capacity unused.
		applyAction(editor, {
			kind: 'setDuration',
			duration: alphaTab.model.Duration.Eighth
		} satisfies EditorAction);
		applyAction(editor, { kind: 'fret', digit: 5 } satisfies EditorAction);

		const barBeatsBefore = editor.score.tracks[0].staves[0].bars[0].voices[0].beats.length;
		applyAction(editor, { kind: 'move', axis: 'beat', delta: 1 } satisfies EditorAction);
		const barBeatsAfter = editor.score.tracks[0].staves[0].bars[0].voices[0].beats.length;

		expect(barBeatsAfter).toBe(barBeatsBefore + 1); // a new beat was inserted, still in bar 0
		expect(editor.cursor.barIndex).toBe(0);
		expect(editor.cursor.beatIndex).toBe(1);

		applyAction(editor, { kind: 'fret', digit: 7 } satisfies EditorAction);
		expect(currentFret(editor)).toBe(7);
	});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
pnpm vitest run src/lib/editor/dispatch.test.ts
```

Expected: FAIL — `barBeatsAfter` equals `barBeatsBefore` (today's `moveBeat` just wraps to a nonexistent next bar/beat via the default single-bar document, or is a no-op; either way no beat gets inserted, since `advanceOrInsertBeat` doesn't exist in the dispatch path yet).

- [ ] **Step 3: Implement**

In `src/lib/editor/dispatch.ts`, add the import:

```ts
import { advanceOrInsertBeat } from '$lib/score/commands/advanceOrInsertBeat';
```

Then replace the `case 'move':` block with:

```ts
		case 'move':
			resetDigitBuffer();
			// 'move' never pushes to history (except the forward-beat case just
			// below, which routes through run()), so without this History's
			// coalescing key would keep pointing at the position we're leaving —
			// letting a later fret edit at the same position wrongly merge with
			// one made before this move (see the 'fret' case's own guard, which
			// also covers the case where the buffer simply times out).
			editor.breakCoalesce();
			if (action.axis === 'beat' && action.delta > 0) {
				// Forward beat movement may need to insert a new beat (bar not
				// yet full) or advance into the next bar — decided by the
				// command, never by pure cursor arithmetic. action.delta is
				// always 1 here (see keymap.ts); advanceOrInsertBeat only ever
				// moves one slot at a time.
				editor.cursor = editor.run('advance', (ctx) => advanceOrInsertBeat(ctx));
			} else {
				editor.cursor =
					action.axis === 'beat'
						? moveBeat(editor.cursor, action.delta, editor.shape())
						: moveString(editor.cursor, action.delta, editor.shape());
			}
			break;
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
pnpm vitest run src/lib/editor/dispatch.test.ts
```

Expected: PASS (all tests in the file — the new one plus every existing multi-digit/coalescing regression test, which must still pass unchanged since the default document's whole-note beats are always exactly at bar capacity, so `advanceOrInsertBeat` takes the "advance to next bar" branch for them, matching the old `moveBeat`'s behavior exactly).

Then run the full suite:

```bash
pnpm test && pnpm check && pnpm lint
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/editor/dispatch.ts src/lib/editor/dispatch.test.ts
git commit -m "feat: wire advanceOrInsertBeat into ArrowRight"
```

---

### Task 4: e2e proof that a bar fills before advancing

**Files:**
- Modify: `e2e/editing.spec.ts`

**Interfaces:**
- Consumes: the running app (no new exports)

- [ ] **Step 1: Write the test**

Digits are always interpreted as frets by `keymap.ts` (`resolveKey` maps every `[0-9]` key to `{kind: 'fret', digit}`) — there is no bare-digit duration shortcut. Duration is set by clicking a button in `NotationPalette.svelte`, which renders plain `<button>8</button>` elements (text content only, no `aria-label`) for each duration in `['1', '2', '4', '8', '16', '32', '.', '3']`. Use `page.getByRole('button', { name: '8', exact: true })` to click the eighth-note button unambiguously.

Add to `e2e/editing.spec.ts`:

```ts
test('typing several short-duration notes fills the current bar before ArrowRight advances to the next one', async ({
	page
}) => {
	await page.goto('/');
	const scoreView = page.getByTestId('score-view');
	await expect(scoreView.locator('svg').first()).toBeVisible({ timeout: 15_000 });

	// Set the current beat to an eighth note via the palette, then type three
	// distinct frets, moving right between each. If ArrowRight always
	// advanced to the next bar (the old behavior), the third fret would land
	// in bar 2 instead of alongside the first two in bar 1. Frets 9/0/2 avoid
	// the 1-8 bar-number labels the 8-bar shipped score also renders.
	await page.getByRole('button', { name: '8', exact: true }).click();
	await page.keyboard.press('9');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('0');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('2');

	await expect(scoreView).toContainText('9');
	await expect(scoreView).toContainText('0');
	await expect(scoreView).toContainText('2');
});
```

- [ ] **Step 2: Run it**

```bash
pnpm test:e2e
```

Expected: PASS. If the duration-setting step doesn't do what's expected, re-check Task 3's `EditorAction` variant name (`'setDuration'`) and how `NotationPalette.svelte` dispatches it, and adjust the test's interaction to match reality rather than guessing.

- [ ] **Step 3: Commit**

```bash
git add e2e/editing.spec.ts
git commit -m "test: e2e coverage for bar-capacity beat insertion"
```

---

### Task 5: Cursor highlight overlay

**Files:**
- Modify: `src/lib/components/ScoreView.svelte`
- Modify: `src/routes/+page.svelte`

**Interfaces:**
- Consumes: `resolveBeat` from `src/lib/score/commands/types.ts`, `Cursor` from `src/lib/score/cursor.ts`, alphaTab's `api.boundsLookup.findBeats(beat)` (pick the tab staff = largest `visualBounds.y`; narrow to the cursor's string row via `cursorGeometry.ts`), `api.postRenderFinished` event (superseded by the fix round: the code below is the original draft; see the design spec Part 2)
- Produces: `ScoreView` now requires a `cursor: Cursor` prop in addition to `score`/`revision`; a `data-testid="cursor-highlight"` element in the DOM for Task 6's e2e test

- [ ] **Step 1: Implement `ScoreView.svelte`**

Replace the full contents of `src/lib/components/ScoreView.svelte`:

```svelte
<script lang="ts">
	import * as alphaTab from '@coderline/alphatab';
	import { onMount } from 'svelte';
	import { resolveBeat } from '$lib/score/commands/types';
	import type { Cursor } from '$lib/score/cursor';

	let {
		score,
		revision,
		cursor
	}: { score: alphaTab.model.Score; revision: number; cursor: Cursor } = $props();
	let host: HTMLDivElement;
	let api: alphaTab.AlphaTabApi | undefined;
	let highlightStyle = $state('display: none;');

	function updateHighlight() {
		if (!api?.boundsLookup) {
			highlightStyle = 'display: none;';
			return;
		}
		let beat: alphaTab.model.Beat;
		try {
			beat = resolveBeat(score, cursor);
		} catch {
			highlightStyle = 'display: none;';
			return;
		}
		const bounds = api.boundsLookup.findBeat(beat);
		if (!bounds) {
			highlightStyle = 'display: none;';
			return;
		}
		const { x, y, w, h } = bounds.visualBounds;
		highlightStyle = `left: ${x}px; top: ${y}px; width: ${w}px; height: ${h}px;`;
	}

	onMount(() => {
		api = new alphaTab.AlphaTabApi(host, {
			core: { fontDirectory: '/font/' },
			display: { staveProfile: 'ScoreTab' }
		});
		api.renderScore(score, [0]);
		// Reposition the highlight after every (re-)layout — a revision-driven
		// re-render, or a window resize that alphaTab re-lays-out on its own.
		api.renderFinished.on(() => updateHighlight());
		return () => api?.destroy();
	});

	// alphaTab does not observe mutations to the score object graph; every
	// command bumps `revision`, and this effect is what actually triggers a
	// re-render in response (AGENTS.md rule #4).
	$effect(() => {
		void revision;
		api?.renderScore(score, [0]);
	});

	// Pure cursor movement (no score mutation, so no revision bump — see
	// editorStore.run()) still needs the highlight to move, so this is
	// tracked independently of `revision`.
	$effect(() => {
		void cursor;
		updateHighlight();
	});
</script>

<div class="relative">
	<div bind:this={host} data-testid="score-view" class="alphatab-host"></div>
	<div class="cursor-highlight" style={highlightStyle} data-testid="cursor-highlight"></div>
</div>

<style>
	.cursor-highlight {
		position: absolute;
		pointer-events: none;
		border-radius: 2px;
		background: rgba(250, 204, 21, 0.35);
		border: 2px solid rgba(250, 204, 21, 0.9);
		animation: cursor-pulse 1s ease-in-out infinite;
	}

	@keyframes cursor-pulse {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 1;
		}
	}
</style>
```

Note the highlight `<div>` is a **sibling** of the alphaTab-managed `host` div, not a child of it — alphaTab replaces `host`'s contents on every render, which would wipe out the overlay if it lived inside that same container.

- [ ] **Step 2: Wire the new prop in `+page.svelte`**

In `src/routes/+page.svelte`, change:

```svelte
			<ScoreView score={editor.score} revision={editor.revision} />
```

to:

```svelte
			<ScoreView score={editor.score} revision={editor.revision} cursor={editor.cursor} />
```

- [ ] **Step 3: Verify visually**

```bash
pnpm dev
```

Open the app, confirm a pulsing highlight box appears over the first beat, and moves when you press arrow keys. If the highlight's position looks offset from the actual beat (e.g. consistently shifted by a fixed amount, or scaled wrong), check `node_modules/@coderline/alphatab/dist/alphaTab.d.ts` for `Settings.display.scale` — the default `AlphaTabApi` config in this file doesn't set one, so bounds should already be in unscaled CSS pixels matching the rendered SVG's own coordinate space; if they aren't, multiply by whatever scale factor the running settings report and note the fix in your report.

- [ ] **Step 4: Run the full suite**

```bash
pnpm test && pnpm check && pnpm lint && pnpm test:e2e
```

Expected: all green — Task 2/13/14's existing e2e tests must still pass unchanged, since `data-testid="score-view"` stays on the same element.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ScoreView.svelte src/routes/+page.svelte
git commit -m "feat: animated cursor highlight overlay"
```

---

### Task 6: e2e proof the highlight moves

> Addendum: the test must also assert the highlight's vertical range overlaps the typed fret number's SVG `<text>` node on the tab staff (not the notation staff).

**Files:**
- Modify: `e2e/editing.spec.ts`

- [ ] **Step 1: Write the test**

Add to `e2e/editing.spec.ts`:

```ts
test('the cursor highlight is visible and moves after ArrowRight', async ({ page }) => {
	await page.goto('/');
	const scoreView = page.getByTestId('score-view');
	await expect(scoreView.locator('svg').first()).toBeVisible({ timeout: 15_000 });

	const highlight = page.getByTestId('cursor-highlight');
	await expect(highlight).toBeVisible();
	const initialStyle = await highlight.getAttribute('style');

	await page.keyboard.press('ArrowRight');

	await expect(async () => {
		const nextStyle = await highlight.getAttribute('style');
		expect(nextStyle).not.toBe(initialStyle);
	}).toPass({ timeout: 2000 });
});
```

- [ ] **Step 2: Run it**

```bash
pnpm test:e2e
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/editing.spec.ts
git commit -m "test: e2e coverage for the cursor highlight moving"
```

---

## Done When

- `pnpm test`, `pnpm check`, `pnpm lint`, and `pnpm test:e2e` all pass
- Typing a short-duration note and pressing ArrowRight inserts a new beat in the same bar instead of jumping to the next bar, until the bar's time-signature capacity is used up
- A visible, pulsing highlight box tracks the current cursor position and moves correctly with arrow keys
