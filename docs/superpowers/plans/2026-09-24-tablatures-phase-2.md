# Phase 2: Instruments, Tracks and Bars — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multiple guitar and bass tracks, each with its own sound, string
count (4–8) and tuning (presets or per-string semitone steppers), plus
inserting and deleting bars. Everything is undoable.

**Architecture:**
- Every change is a command in `src/lib/score/commands/`. The Command Layer
  Rule in AGENTS.md is unchanged.
- Structural edits (bars, tracks) splice alphaTab's arrays in place and
  restore the model's links with shared helpers in `commands/structure.ts`.
- `cursor.trackIndex` is the selected track, and `ScoreView` renders only
  that track.
- UI panels call `editor.run(label, cmd)`. The existing history makes
  everything undoable.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, TypeScript, alphaTab 1.8.4,
Tailwind 4, bits-ui 2 (`DropdownMenu`), Vitest (headless Node), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-24-tablatures-phase-2-design.md`

## Global Constraints

- Nothing outside `src/lib/score/commands/` mutates a `Score`. Every
  command calls `score.finish(settings)` after mutating (AGENTS.md rule 1).
- A command that refuses an edit returns **without mutating anything**.
  `editor.run` then records no history, because it compares the alphaTex
  before and after.
- String-number arithmetic goes through `src/lib/score/strings.ts`
  (AGENTS.md rule 3). `note.string` is 1 for the **lowest** string. Strings
  are added and removed at the low end.
- Hold the score in `$state.raw` and never deep-proxy it (AGENTS.md rule 4).
  Commands mutate the score **in place**, so the `editor.score` reference
  does not change after `run`. A UI `$derived` that reads score data must
  also read `editor.revision`, or it will never update.
- alphaTex is the test-fixture format (AGENTS.md rule 5). Write fixtures as
  alphaTex text.
- `MAX_TRACKS = 8`. Track `i` gets MIDI channels `2i` and `2i + 1` (the
  importer's rule).
- Default tracks:
  - guitar: name `"Guitar"`, program `30`, tunings `[64, 59, 55, 50, 45, 40]`
  - bass: name `"Bass"`, program `34`, tunings `[43, 38, 33, 28]`
- Curated programs:
  - guitar: 30 Distortion, 29 Overdriven, 27 Clean, 28 Muted, 25 Steel
    Acoustic, 24 Nylon Acoustic
  - bass: 34 Picked, 33 Finger, 35 Fretless, 38 Synth
- String count range: 4–8.
- Shortcuts: `Ctrl/Cmd+Insert` inserts a bar, `Ctrl/Cmd+Delete` deletes the
  current bar.
- No default exports except Svelte components. Tabs for indentation
  (prettier). Commit per task with `pnpm test`, `pnpm check` and `pnpm lint`
  passing.
- End every commit message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Undo after adding or removing the selected track.** The cursor's
   `trackIndex` must be clamped before `shape()` reads the track, or undo
   crashes. Pinned in Task 5.
2. **Deleting the first bar keeps the song's tempo** (spec fact 8). Pinned
   in Task 2.
3. **Changing the string count keeps the cursor on the same physical
   string,** so the highlight doesn't jump to another string. Pinned in
   Task 10 by the pure helper `shiftCursorString`, with a unit test.
4. **Calling `presetsFor()` repeatedly must not grow or duplicate the
   list,** because the inspector calls it on every render (spec fact 7).
   Pinned in Task 1.
5. **Deleting the last bar while the cursor is on it** moves the cursor to
   the new last bar, beat 0, with no crash. Pinned in Task 8.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/score/tuning.ts` (modify) | Initialise presets once; filter, de-duplicate and rename; `labelForTuning` |
| `src/lib/score/instruments.ts` (new) | `PROGRAMS`, `familyOf`, `TRACK_DEFAULTS`, `MAX_TRACKS`, `uniqueTrackName` |
| `src/lib/score/document.ts` (modify) | Default track is "Guitar", program 30 |
| `src/lib/score/commands/structure.ts` (new) | `relinkMasterBars`, `relinkBars`, `emptyBarLike`, `insertBarAt`, `removeBarAt`, `assignChannels` |
| `src/lib/score/commands/insertBar.ts` / `deleteBar.ts` (new) | Bar commands |
| `src/lib/score/commands/advanceOrInsertBeat.ts` (modify) | Append a bar at the end of the score |
| `src/lib/score/commands/addTrack.ts` / `removeTrack.ts` / `renameTrack.ts` (new) | Track commands (`canAddTrack` lives in `addTrack.ts`) |
| `src/lib/score/commands/setProgram.ts` / `setTuning.ts` / `setStringPitch.ts` / `setStringCount.ts` (new) | Instrument commands |
| `src/lib/score/cursor.ts` (modify) | `trackCount` in `ScoreShape`; clamp `trackIndex`; `shiftCursorString` |
| `src/lib/score/editorStore.svelte.ts` (modify) | `shape()` safe for any `trackIndex`; `selectTrack` |
| `src/lib/editor/keymap.ts` / `dispatch.ts` (modify) | `insertBar` / `deleteBar` actions |
| `src/lib/components/ScoreView.svelte` (modify) | Render the selected track; `'Default'` stave profile |
| `src/lib/components/panels/TrackList.svelte` (rewrite) | Real track list: select, add (dropdown), remove |
| `src/lib/components/panels/InstrumentInspector.svelte` (rewrite) | Name, sound, strings, tuning, per-string steppers |
| `src/lib/components/panels/NotationPalette.svelte` (modify) | "Bar" group |
| `src/routes/+page.svelte` (modify) | Pass `editor` to `TrackList`; fix the stale comment |
| `e2e/instruments.spec.ts` (new) | Tracks, strings and bars end to end |
| `AGENTS.md` (modify) | Architecture tree and gotchas |

Test files sit next to their sources (`foo.ts` → `foo.test.ts`), as they do
today.

---

### Task 1: Tuning presets fix + instrument catalogue

**Files:**
- Modify: `src/lib/score/tuning.ts`, `src/lib/score/tuning.test.ts`, `src/lib/score/document.ts`, `src/lib/score/document.test.ts`
- Create: `src/lib/score/instruments.ts`, `src/lib/score/instruments.test.ts`

**Interfaces:**
- Produces:
  - `ensureTuningsInitialized(): void`
  - `presetsFor(n: number): TuningPreset[]` (fixed)
  - `labelForTuning(tunings: number[]): string`, which returns the preset
    name or `'Custom'`
  - `type InstrumentFamily = 'guitar' | 'bass'`
  - `type ProgramOption = { family: InstrumentFamily; program: number; label: string }`
  - `PROGRAMS: readonly ProgramOption[]`
  - `familyOf(program: number): InstrumentFamily`
  - `TRACK_DEFAULTS: Record<InstrumentFamily, { name: string; program: number; tunings: number[] }>`
  - `MAX_TRACKS = 8`
  - `uniqueTrackName(base: string, existing: string[]): string`
  - `createScore()`'s single track is named `"Guitar"` with program `30`

- [ ] **Step 1: Write failing tuning tests.** Append these inside the
  `describe('tunings', ...)` block of `src/lib/score/tuning.test.ts`, and add
  `labelForTuning` to its import:

```ts
	it('returns the same presets on every call (regression: initialize() appended duplicates)', () => {
		const first = presetsFor(6);
		const second = presetsFor(6);
		expect(second.length).toBe(first.length);
		const names = second.map((p) => p.name);
		expect(new Set(names).size).toBe(names.length);
		const pitches = second.map((p) => p.tunings.join(','));
		expect(new Set(pitches).size).toBe(pitches.length);
	});

	it('only offers guitar and bass presets', () => {
		for (const n of [4, 5, 6, 7, 8]) {
			for (const p of presetsFor(n)) {
				expect(p.name).not.toMatch(/ukulele|mandolin|banjo|viola|cello|lute|violin/i);
			}
		}
	});

	it('names a built-in preset after the metal catalogue entry with the same pitches', () => {
		const names = presetsFor(6).map((p) => p.name);
		expect(names).not.toContain('Guitar Dropped D Tuning');
		expect(names[0]).toBe('Guitar Standard Tuning'); // standard stays first
		expect(presetsFor(7)[0].name).toBe('7-String Standard');
	});

	it('labels a tuning with its preset name, or Custom', () => {
		expect(labelForTuning([64, 59, 55, 50, 45, 38])).toBe('Drop D');
		expect(labelForTuning([62, 57, 53, 48, 43, 36])).toBe('Drop C');
		expect(labelForTuning([43, 38, 33, 28])).toBe('Bass Standard');
		expect(labelForTuning([64, 59, 55, 50, 45, 39])).toBe('Custom');
	});
```

- [ ] **Step 2: Write failing instrument tests** in `src/lib/score/instruments.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { familyOf, MAX_TRACKS, PROGRAMS, TRACK_DEFAULTS, uniqueTrackName } from './instruments';

describe('instruments', () => {
	it('classifies GM bass programs 32-39 as bass, everything else as guitar', () => {
		expect(familyOf(33)).toBe('bass');
		expect(familyOf(39)).toBe('bass');
		expect(familyOf(30)).toBe('guitar');
		expect(familyOf(40)).toBe('guitar');
	});

	it('offers the curated list, each program in its own family', () => {
		expect(PROGRAMS.map((p) => p.program)).toEqual([30, 29, 27, 28, 25, 24, 34, 33, 35, 38]);
		for (const p of PROGRAMS) expect(familyOf(p.program)).toBe(p.family);
	});

	it('defaults guitar to distortion in E standard and bass to pick bass in E1 A1 D2 G2', () => {
		expect(TRACK_DEFAULTS.guitar).toEqual({
			name: 'Guitar',
			program: 30,
			tunings: [64, 59, 55, 50, 45, 40]
		});
		expect(TRACK_DEFAULTS.bass).toEqual({ name: 'Bass', program: 34, tunings: [43, 38, 33, 28] });
		expect(MAX_TRACKS).toBe(8);
	});

	it('suffixes a number to keep track names unique', () => {
		expect(uniqueTrackName('Bass', ['Guitar'])).toBe('Bass');
		expect(uniqueTrackName('Guitar', ['Guitar'])).toBe('Guitar 2');
		expect(uniqueTrackName('Guitar', ['Guitar', 'Guitar 2'])).toBe('Guitar 3');
	});
});
```

- [ ] **Step 3: Write a failing default-track test.** Add to `src/lib/score/document.test.ts`:

```ts
	it('names the default track Guitar with a distortion sound, on the track and its first beat', () => {
		const score = createScore();
		const track = score.tracks[0];
		expect(track.name).toBe('Guitar');
		expect(track.playbackInfo.program).toBe(30);
		const automations = track.staves[0].bars[0].voices[0].beats[0].automations;
		expect(automations.filter((a) => a.type === 2).map((a) => a.value)).toEqual([30]);
	});
```

- [ ] **Step 4: Run and confirm the failures.** Run
  `pnpm vitest run src/lib/score/tuning.test.ts src/lib/score/instruments.test.ts src/lib/score/document.test.ts`.
  Expected: the new tests FAIL. The duplicates test fails on length or the
  Set size, `instruments` fails with a module-not-found error, and the
  document test gets `''` and `25`.

- [ ] **Step 5: Implement the `tuning.ts` changes.** Replace `presetsFor`
  and add the two new exports. Keep `METAL_PRESETS`, `describeTuning` and
  `parseTuningNames` as they are.

```ts
/**
 * alphaTab's Tuning.initialize() APPENDS its preset list every time it runs,
 * so it must run at most once. (It is also triggered lazily inside
 * alphaTab when the list is empty; the length check covers that.)
 */
export function ensureTuningsInitialized(): void {
	if (alphaTab.model.Tuning.getPresetsFor(6).length === 0) alphaTab.model.Tuning.initialize();
}

const pitchKey = (tunings: number[]) => tunings.join(',');

/**
 * Guitar/bass presets for a string count: alphaTab's built-ins (non-fretted
 * instruments filtered out), then our metal catalogue. Where a built-in has
 * the same pitches as a catalogue entry, the catalogue's name wins
 * ("Drop D", not "Guitar Dropped D Tuning"). De-duplicated by pitches.
 */
export function presetsFor(stringCount: number): TuningPreset[] {
	ensureTuningsInitialized();
	const metal = METAL_PRESETS[stringCount] ?? [];
	const metalName = new Map(metal.map((p) => [pitchKey(p.tunings), p.name]));
	const builtin: TuningPreset[] = alphaTab.model.Tuning.getPresetsFor(stringCount)
		.filter((t) => /^(Guitar|Bass)\b/.test(t.name))
		.map((t) => ({
			name: metalName.get(pitchKey(t.tunings)) ?? t.name,
			tunings: [...t.tunings]
		}));
	const seen = new Set<string>();
	return [...builtin, ...metal].filter((p) => {
		const key = pitchKey(p.tunings);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/** The preset name for these exact pitches, or 'Custom'. */
export function labelForTuning(tunings: number[]): string {
	const key = pitchKey(tunings);
	return presetsFor(tunings.length).find((p) => pitchKey(p.tunings) === key)?.name ?? 'Custom';
}
```

  In `src/lib/score/document.ts`, replace the
  `alphaTab.model.Tuning.initialize();` call inside `defaultTuningFor` with
  `ensureTuningsInitialized();`, and import it from `./tuning`.

- [ ] **Step 6: Implement `src/lib/score/instruments.ts`.**

```ts
export type InstrumentFamily = 'guitar' | 'bass';
export type ProgramOption = { family: InstrumentFamily; program: number; label: string };

/** Curated General MIDI programs (0-based) for metal. */
export const PROGRAMS: readonly ProgramOption[] = [
	{ family: 'guitar', program: 30, label: 'Distortion Guitar' },
	{ family: 'guitar', program: 29, label: 'Overdriven Guitar' },
	{ family: 'guitar', program: 27, label: 'Clean Guitar' },
	{ family: 'guitar', program: 28, label: 'Muted Guitar' },
	{ family: 'guitar', program: 25, label: 'Steel Acoustic' },
	{ family: 'guitar', program: 24, label: 'Nylon Acoustic' },
	{ family: 'bass', program: 34, label: 'Picked Bass' },
	{ family: 'bass', program: 33, label: 'Finger Bass' },
	{ family: 'bass', program: 35, label: 'Fretless Bass' },
	{ family: 'bass', program: 38, label: 'Synth Bass' }
];

/** GM programs 32-39 are the bass family; everything else is treated as guitar. */
export function familyOf(program: number): InstrumentFamily {
	return program >= 32 && program <= 39 ? 'bass' : 'guitar';
}

export const TRACK_DEFAULTS: Record<
	InstrumentFamily,
	{ name: string; program: number; tunings: number[] }
> = {
	guitar: { name: 'Guitar', program: 30, tunings: [64, 59, 55, 50, 45, 40] },
	bass: { name: 'Bass', program: 34, tunings: [43, 38, 33, 28] }
};

/** Track i uses MIDI channels 2i and 2i+1; 8 tracks fill channels 0-15. */
export const MAX_TRACKS = 8;

export function uniqueTrackName(base: string, existing: string[]): string {
	if (!existing.includes(base)) return base;
	let n = 2;
	while (existing.includes(`${base} ${n}`)) n++;
	return `${base} ${n}`;
}
```

- [ ] **Step 7: Update `createScore` in `src/lib/score/document.ts`.**
  Emit the track header in the alphaTex. Import `TRACK_DEFAULTS` from
  `./instruments`, then replace the `const tex = ...` expression with:

```ts
	const tex =
		`\\title "${title.replace(/"/g, '\\"')}" \\tempo ${tempo} . ` +
		`\\track "${TRACK_DEFAULTS.guitar.name}" \\instrument ${TRACK_DEFAULTS.guitar.program} ` +
		`\\tuning ${tuningText} . ${emptyBars}`;
```

- [ ] **Step 8: Run the tests.** Run `pnpm test`. Expected: all PASS,
  including the existing tuning tests (`Drop D` / `Drop C` / `Drop B` are
  still offered, and Drop D is still `[64, 59, 55, 50, 45, 38]`).

- [ ] **Step 9: Commit.** Run `pnpm check && pnpm lint` first.

```bash
git add src/lib/score/tuning.ts src/lib/score/tuning.test.ts src/lib/score/instruments.ts src/lib/score/instruments.test.ts src/lib/score/document.ts src/lib/score/document.test.ts
git commit -m "feat: instrument catalogue, de-duplicated tuning presets, distortion default track"
```

---

### Task 2: Structure helpers + insertBar / deleteBar commands

**Files:**
- Create: `src/lib/score/commands/structure.ts`, `structure.test.ts`, `insertBar.ts`, `insertBar.test.ts`, `deleteBar.ts`, `deleteBar.test.ts` (all in `src/lib/score/commands/`)

**Interfaces:**
- Consumes: `CommandContext` from `./types`
- Produces:
  - `relinkMasterBars(score: Score): void`
  - `relinkBars(staff: Staff): void`
  - `emptyBarLike(template: Bar | undefined): Bar`
  - `insertBarAt(score: Score, index: number): void`
  - `removeBarAt(score: Score, index: number): void`
  - `assignChannels(score: Score): void`
  - `insertBar(ctx: CommandContext): number` returns the new bar's index
  - `deleteBar(ctx: CommandContext): boolean` returns false when refused

- [ ] **Step 1: Write failing structure tests** in `structure.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex } from '../serialize';
import { assignChannels, insertBarAt, removeBarAt } from './structure';

const TWO_TRACKS =
	'\\track "A" \\tuning e4 b3 g3 d3 a2 e2 . 1.6.1 | 2.6.1 | 3.6.1 ' +
	'\\track "B" \\tuning g2 d2 a1 e1 . 1.4.1 | 2.4.1 | 3.4.1';

function expectLinked(score: ReturnType<typeof fromAlphaTex>) {
	score.masterBars.forEach((mb, i) => {
		expect(mb.index).toBe(i);
		expect(mb.score).toBe(score);
		expect(mb.previousMasterBar).toBe(score.masterBars[i - 1] ?? null);
		expect(mb.nextMasterBar).toBe(score.masterBars[i + 1] ?? null);
	});
	for (const track of score.tracks)
		for (const staff of track.staves) {
			expect(staff.bars.length).toBe(score.masterBars.length);
			staff.bars.forEach((bar, i) => {
				expect(bar.index).toBe(i);
				expect(bar.staff).toBe(staff);
				expect(bar.previousBar).toBe(staff.bars[i - 1] ?? null);
				expect(bar.nextBar).toBe(staff.bars[i + 1] ?? null);
			});
		}
}

describe('structure helpers', () => {
	it('insertBarAt splices an empty bar into every staff and relinks everything', () => {
		const score = fromAlphaTex(TWO_TRACKS);
		insertBarAt(score, 1);
		score.finish(defaultSettings());
		expectLinked(score);
		const inserted = score.tracks[1].staves[0].bars[1].voices[0].beats;
		expect(inserted.length).toBe(1);
		expect(inserted[0].notes.length).toBe(0);
		expect(score.masterBars.map((m) => m.start)).toEqual([0, 3840, 7680, 11520]);
	});

	it('removeBarAt removes the bar from every staff and relinks everything', () => {
		const score = fromAlphaTex(TWO_TRACKS);
		removeBarAt(score, 1);
		score.finish(defaultSettings());
		expectLinked(score);
		expect(score.masterBars.length).toBe(2);
	});

	it('assignChannels gives track i the channels 2i and 2i+1, like the importer', () => {
		const score = fromAlphaTex(TWO_TRACKS);
		score.tracks.reverse();
		assignChannels(score);
		expect(score.tracks.map((t) => t.index)).toEqual([0, 1]);
		expect(
			score.tracks.map((t) => [t.playbackInfo.primaryChannel, t.playbackInfo.secondaryChannel])
		).toEqual([
			[0, 1],
			[2, 3]
		]);
	});
});
```

- [ ] **Step 2: Write failing command tests.** In `insertBar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex, toAlphaTex } from '../serialize';
import { insertBar } from './insertBar';

const TWO_TRACKS =
	'\\tempo 90 . \\track "A" \\tuning e4 b3 g3 d3 a2 e2 . 1.6.1 | 2.6.1 | 3.6.1 ' +
	'\\track "B" \\tuning g2 d2 a1 e1 . 1.4.1 | 2.4.1 | 3.4.1';

const ctxAt = (barIndex: number, tex = TWO_TRACKS) => ({
	score: fromAlphaTex(tex),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});

/** First fret of each bar, or 'r' for a rest bar. */
const barsOf = (score: ReturnType<typeof fromAlphaTex>, trackIndex: number) =>
	score.tracks[trackIndex].staves[0].bars.map((b) => {
		const note = b.voices[0].beats[0].notes[0];
		return note ? String(note.fret) : 'r';
	});

describe('insertBar', () => {
	it('inserts an empty bar after the cursor bar in every track and returns its index', () => {
		const ctx = ctxAt(0);
		expect(insertBar(ctx)).toBe(1);
		expect(barsOf(ctx.score, 0)).toEqual(['1', 'r', '2', '3']);
		expect(barsOf(ctx.score, 1)).toEqual(['1', 'r', '2', '3']);
	});

	it('appends when the cursor is on the last bar, and survives a round-trip', () => {
		const ctx = ctxAt(2);
		expect(insertBar(ctx)).toBe(3);
		const back = fromAlphaTex(toAlphaTex(ctx.score, ctx.settings));
		expect(barsOf(back, 0)).toEqual(['1', '2', '3', 'r']);
		expect(barsOf(back, 1)).toEqual(['1', '2', '3', 'r']);
	});

	it('copies the time signature of the cursor bar', () => {
		const ctx = ctxAt(0, '\\ts 3 4 \\tuning e4 b3 g3 d3 a2 e2 . 1.6.4 1.6.4 1.6.4 | 2.6.4 2.6.4 2.6.4');
		insertBar(ctx);
		expect(ctx.score.masterBars[1].timeSignatureNumerator).toBe(3);
		expect(ctx.score.masterBars[1].timeSignatureDenominator).toBe(4);
	});
});
```

  In `deleteBar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex, toAlphaTex } from '../serialize';
import { deleteBar } from './deleteBar';

const TWO_TRACKS =
	'\\tempo 90 . \\track "A" \\tuning e4 b3 g3 d3 a2 e2 . 1.6.1 | 2.6.1 | 3.6.1 ' +
	'\\track "B" \\tuning g2 d2 a1 e1 . 1.4.1 | 2.4.1 | 3.4.1';

const ctxAt = (barIndex: number, tex = TWO_TRACKS) => ({
	score: fromAlphaTex(tex),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});

const barsOf = (score: ReturnType<typeof fromAlphaTex>, trackIndex: number) =>
	score.tracks[trackIndex].staves[0].bars.map((b) => {
		const note = b.voices[0].beats[0].notes[0];
		return note ? String(note.fret) : 'r';
	});

describe('deleteBar', () => {
	it('deletes the cursor bar in every track, keeping order through a round-trip', () => {
		const ctx = ctxAt(1);
		expect(deleteBar(ctx)).toBe(true);
		const back = fromAlphaTex(toAlphaTex(ctx.score, ctx.settings));
		expect(barsOf(back, 0)).toEqual(['1', '3']);
		expect(barsOf(back, 1)).toEqual(['1', '3']);
	});

	it('keeps the tempo when the first bar is deleted (regression: tempo lived on bar 0)', () => {
		const ctx = ctxAt(0);
		deleteBar(ctx);
		expect(ctx.score.tempo).toBe(90);
		expect(fromAlphaTex(toAlphaTex(ctx.score, ctx.settings)).tempo).toBe(90);
	});

	it('refuses to delete the only bar, leaving the score untouched', () => {
		const ctx = ctxAt(0, '\\tuning e4 b3 g3 d3 a2 e2 . 1.6.1');
		const before = toAlphaTex(ctx.score, ctx.settings);
		expect(deleteBar(ctx)).toBe(false);
		expect(toAlphaTex(ctx.score, ctx.settings)).toBe(before);
	});
});
```

- [ ] **Step 3: Run and confirm the failures.** Run
  `pnpm vitest run src/lib/score/commands/structure.test.ts src/lib/score/commands/insertBar.test.ts src/lib/score/commands/deleteBar.test.ts`.
  Expected: FAIL (modules not found).

- [ ] **Step 4: Implement `structure.ts`.**

```ts
import * as alphaTab from '@coderline/alphatab';

type Score = alphaTab.model.Score;
type Staff = alphaTab.model.Staff;
type Bar = alphaTab.model.Bar;

/**
 * Structural edits splice alphaTab's arrays directly; these helpers restore
 * the index / previous / next / owner links that alphaTab's own add* methods
 * would have set. Callers still run score.finish() afterwards.
 */
export function relinkMasterBars(score: Score): void {
	score.masterBars.forEach((mb, i) => {
		mb.index = i;
		mb.score = score;
		mb.previousMasterBar = score.masterBars[i - 1] ?? null;
		mb.nextMasterBar = score.masterBars[i + 1] ?? null;
	});
}

export function relinkBars(staff: Staff): void {
	staff.bars.forEach((bar, i) => {
		bar.index = i;
		bar.staff = staff;
		bar.previousBar = staff.bars[i - 1] ?? null;
		bar.nextBar = staff.bars[i + 1] ?? null;
	});
}

/** A bar holding one whole-rest beat, with the template's clef and key (stored per Bar). */
export function emptyBarLike(template: Bar | undefined): Bar {
	const bar = new alphaTab.model.Bar();
	if (template) {
		bar.clef = template.clef;
		bar.clefOttava = template.clefOttava;
		bar.keySignature = template.keySignature;
		bar.keySignatureType = template.keySignatureType;
	}
	const voice = new alphaTab.model.Voice();
	bar.addVoice(voice);
	const beat = new alphaTab.model.Beat();
	beat.duration = alphaTab.model.Duration.Whole;
	voice.addBeat(beat);
	return bar;
}

/** Inserts an empty bar at `index` (0..barCount) in every staff of every track. */
export function insertBarAt(score: Score, index: number): void {
	const template = score.masterBars[index - 1] ?? score.masterBars[index];
	const masterBar = new alphaTab.model.MasterBar();
	if (template) {
		masterBar.timeSignatureNumerator = template.timeSignatureNumerator;
		masterBar.timeSignatureDenominator = template.timeSignatureDenominator;
		masterBar.timeSignatureCommon = template.timeSignatureCommon;
	}
	score.masterBars.splice(index, 0, masterBar);
	relinkMasterBars(score);
	for (const track of score.tracks)
		for (const staff of track.staves) {
			staff.bars.splice(index, 0, emptyBarLike(staff.bars[index - 1] ?? staff.bars[index]));
			relinkBars(staff);
		}
}

/**
 * Removes bar `index` from every staff. The tempo lives on the first master
 * bar, so deleting bar 0 hands its tempo automations to the new first bar.
 */
export function removeBarAt(score: Score, index: number): void {
	const [removed] = score.masterBars.splice(index, 1);
	const first = score.masterBars[0];
	if (index === 0 && first && first.tempoAutomations.length === 0) {
		for (const automation of removed.tempoAutomations) first.tempoAutomations.push(automation);
	}
	relinkMasterBars(score);
	for (const track of score.tracks)
		for (const staff of track.staves) {
			staff.bars.splice(index, 1);
			relinkBars(staff);
		}
}

/** Re-indexes tracks and gives track i MIDI channels 2i / 2i+1 — the alphaTex importer's rule. */
export function assignChannels(score: Score): void {
	score.tracks.forEach((track, i) => {
		track.index = i;
		track.playbackInfo.primaryChannel = 2 * i;
		track.playbackInfo.secondaryChannel = 2 * i + 1;
	});
}
```

- [ ] **Step 5: Implement the two commands.** `insertBar.ts`:

```ts
import { insertBarAt } from './structure';
import type { CommandContext } from './types';

/** Inserts an empty bar after the cursor's bar, in every track. Returns the new bar index. */
export function insertBar(ctx: CommandContext): number {
	const index = ctx.cursor.barIndex + 1;
	insertBarAt(ctx.score, index);
	ctx.score.finish(ctx.settings);
	return index;
}
```

  `deleteBar.ts`:

```ts
import { removeBarAt } from './structure';
import type { CommandContext } from './types';

/** Deletes the cursor's bar in every track. Refuses (returns false) on the only bar. */
export function deleteBar(ctx: CommandContext): boolean {
	if (ctx.score.masterBars.length <= 1) return false;
	removeBarAt(ctx.score, ctx.cursor.barIndex);
	ctx.score.finish(ctx.settings);
	return true;
}
```

- [ ] **Step 6: Run the tests.** Run `pnpm test`. Expected: all PASS. If
  `score.tempo` in the tempo test is not 90, check the returned alphaTex
  before changing anything; a lost `\tempo` means the automation hand-off
  did not happen.

- [ ] **Step 7: Commit.** Run `pnpm check && pnpm lint` first.

```bash
git add src/lib/score/commands/structure.ts src/lib/score/commands/structure.test.ts src/lib/score/commands/insertBar.ts src/lib/score/commands/insertBar.test.ts src/lib/score/commands/deleteBar.ts src/lib/score/commands/deleteBar.test.ts
git commit -m "feat: insert and delete bars across all tracks"
```

---

### Task 3: ArrowRight appends a bar at the end of the score

**Files:**
- Modify: `src/lib/score/commands/advanceOrInsertBeat.ts`, `advanceOrInsertBeat.test.ts`

**Interfaces:**
- Consumes: `insertBarAt(score, index)` from `./structure` (Task 2)
- Produces: `advanceOrInsertBeat` never returns an unchanged cursor for a
  full last bar. It appends a bar and moves to it.

- [ ] **Step 1: Replace the end-of-document test.** In
  `advanceOrInsertBeat.test.ts`, replace the test
  `'is a no-op at the end of the document (last bar, full)'` with:

```ts
	it('appends a bar at the end of the score and moves onto it, carrying the duration', () => {
		// A single 4/4 bar, exactly full with quarters, and no bar after it.
		const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 . 0.6.4 0.6.4 0.6.4 0.6.4', 3, 0);

		const cursor = advanceOrInsertBeat(ctx);

		expect(ctx.score.masterBars.length).toBe(2);
		expect(ctx.score.tracks[0].staves[0].bars.length).toBe(2);
		expect(beatsIn(ctx, 1).length).toBe(1);
		expect(beatsIn(ctx, 1)[0].notes.length).toBe(0);
		expect(beatsIn(ctx, 1)[0].duration).toBe(alphaTab.model.Duration.Quarter);
		expect(cursor).toEqual({ ...ctx.cursor, barIndex: 1, beatIndex: 0 });
	});

	it('appends the new bar to every track', () => {
		const ctx = ctxFor(
			'\\track "A" \\tuning e4 b3 g3 d3 a2 e2 . 0.6.1 \\track "B" \\tuning g2 d2 a1 e1 . 0.4.1'
		);
		advanceOrInsertBeat(ctx);
		expect(ctx.score.tracks[1].staves[0].bars.length).toBe(2);
	});
```

- [ ] **Step 2: Run and confirm the failures.** Run
  `pnpm vitest run src/lib/score/commands/advanceOrInsertBeat.test.ts`.
  Expected: the two new tests FAIL (the bar count stays 1).

- [ ] **Step 3: Implement.** In `advanceOrInsertBeat.ts`, add
  `import { insertBarAt } from './structure';`. Replace the final
  `return cursor;` with the code below, and update the doc comment's last
  bullet to "else (end of the document), append a bar to every track (see
  structure.ts) and move onto it, carrying the duration".

```ts
	// End of the document: grow the score (in every track) instead of stopping.
	insertBarAt(score, staff.bars.length);
	staff.bars[cursor.barIndex + 1].voices[cursor.voiceIndex].beats[0].duration =
		currentBeat.duration;
	score.finish(settings);
	return { ...cursor, barIndex: cursor.barIndex + 1, beatIndex: 0 };
```

- [ ] **Step 4: Run the tests.** Run `pnpm test`. Expected: all PASS. The
  existing `dispatch.test.ts` tests still pass, because none of them
  depended on the no-op.

- [ ] **Step 5: Commit.** Run `pnpm check && pnpm lint` first.

```bash
git add src/lib/score/commands/advanceOrInsertBeat.ts src/lib/score/commands/advanceOrInsertBeat.test.ts
git commit -m "feat: ArrowRight past a full last bar appends a new bar"
```

---

### Task 4: Track commands (add, remove, rename)

**Files:**
- Create: `src/lib/score/commands/addTrack.ts`, `addTrack.test.ts`, `removeTrack.ts`, `removeTrack.test.ts`, `renameTrack.ts`, `renameTrack.test.ts`

**Interfaces:**
- Consumes:
  - `emptyBarLike` and `assignChannels` from `./structure` (Task 2)
  - `TRACK_DEFAULTS`, `MAX_TRACKS`, `uniqueTrackName` and `InstrumentFamily`
    from `../instruments` (Task 1)
  - `labelForTuning` from `../tuning` (Task 1)
- Produces:
  - `canAddTrack(score: Score): boolean`
  - `addTrack(ctx: CommandContext, family: InstrumentFamily): number | undefined`
    returns the new track index, or `undefined` when refused
  - `removeTrack(ctx: CommandContext, trackIndex: number): boolean`
  - `renameTrack(ctx: CommandContext, trackIndex: number, name: string): void`

- [ ] **Step 1: Write failing tests.** In `addTrack.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex, toAlphaTex } from '../serialize';
import { addTrack, canAddTrack } from './addTrack';

const ctxFor = (tex: string) => ({
	score: fromAlphaTex(tex),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});
const GUITAR = '\\track "Guitar" \\instrument 30 \\tuning e4 b3 g3 d3 a2 e2 . 1.6.1 | 2.6.1 | 3.6.1';

describe('addTrack', () => {
	it('appends a bass track with one empty bar per master bar and returns its index', () => {
		const ctx = ctxFor(GUITAR);
		expect(addTrack(ctx, 'bass')).toBe(1);
		const bass = ctx.score.tracks[1];
		expect(bass.name).toBe('Bass');
		expect(bass.playbackInfo.program).toBe(34);
		expect(bass.staves[0].tuning).toEqual([43, 38, 33, 28]);
		expect(bass.staves[0].bars.length).toBe(3);
		expect(bass.staves[0].bars.every((b) => b.voices[0].beats[0].notes.length === 0)).toBe(true);
	});

	it('gives a second guitar a unique name and the next channel pair', () => {
		const ctx = ctxFor(GUITAR);
		addTrack(ctx, 'guitar');
		const t = ctx.score.tracks[1];
		expect(t.name).toBe('Guitar 2');
		expect([t.playbackInfo.primaryChannel, t.playbackInfo.secondaryChannel]).toEqual([2, 3]);
	});

	it('survives a round-trip with a tab-only staff, name, program and tuning', () => {
		const ctx = ctxFor(GUITAR);
		addTrack(ctx, 'bass');
		const back = fromAlphaTex(toAlphaTex(ctx.score, ctx.settings));
		const bass = back.tracks[1];
		expect(bass.name).toBe('Bass');
		expect(bass.playbackInfo.program).toBe(34);
		expect(bass.staves[0].tuning).toEqual([43, 38, 33, 28]);
		expect(bass.staves[0].showStandardNotation).toBe(false);
		expect(bass.staves[0].showTablature).toBe(true);
		expect(bass.staves[0].bars.length).toBe(3);
	});

	it('refuses once MAX_TRACKS tracks exist, leaving the score untouched', () => {
		const ctx = ctxFor(GUITAR);
		for (let i = 1; i < 8; i++) addTrack(ctx, 'guitar');
		expect(ctx.score.tracks.length).toBe(8);
		expect(canAddTrack(ctx.score)).toBe(false);
		const before = toAlphaTex(ctx.score, ctx.settings);
		expect(addTrack(ctx, 'bass')).toBeUndefined();
		expect(toAlphaTex(ctx.score, ctx.settings)).toBe(before);
	});
});
```

  In `removeTrack.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex, toAlphaTex } from '../serialize';
import { removeTrack } from './removeTrack';

const ctxFor = (tex: string) => ({
	score: fromAlphaTex(tex),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});
const THREE =
	'\\track "A" \\tuning e4 b3 g3 d3 a2 e2 . 1.6.1 ' +
	'\\track "B" \\tuning g2 d2 a1 e1 . 2.4.1 ' +
	'\\track "C" \\tuning e4 b3 g3 d3 a2 e2 . 3.6.1';

describe('removeTrack', () => {
	it('removes the track and re-indexes the rest with the importer channel rule', () => {
		const ctx = ctxFor(THREE);
		expect(removeTrack(ctx, 0)).toBe(true);
		expect(ctx.score.tracks.map((t) => t.name)).toEqual(['B', 'C']);
		expect(ctx.score.tracks.map((t) => t.index)).toEqual([0, 1]);
		expect(ctx.score.tracks.map((t) => t.playbackInfo.primaryChannel)).toEqual([0, 2]);
		const back = fromAlphaTex(toAlphaTex(ctx.score, ctx.settings));
		expect(back.tracks.map((t) => t.name)).toEqual(['B', 'C']);
	});

	it('refuses to remove the last remaining track', () => {
		const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 . 1.6.1');
		const before = toAlphaTex(ctx.score, ctx.settings);
		expect(removeTrack(ctx, 0)).toBe(false);
		expect(toAlphaTex(ctx.score, ctx.settings)).toBe(before);
	});

	it('refuses an out-of-range index', () => {
		const ctx = ctxFor(THREE);
		expect(removeTrack(ctx, 5)).toBe(false);
		expect(ctx.score.tracks.length).toBe(3);
	});
});
```

  In `renameTrack.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex, toAlphaTex } from '../serialize';
import { renameTrack } from './renameTrack';

const ctxFor = () => ({
	score: fromAlphaTex('\\track "Guitar" \\tuning e4 b3 g3 d3 a2 e2 . 1.6.1'),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});

describe('renameTrack', () => {
	it('sets the trimmed name, which survives a round-trip', () => {
		const ctx = ctxFor();
		renameTrack(ctx, 0, '  Rhythm L  ');
		expect(ctx.score.tracks[0].name).toBe('Rhythm L');
		expect(fromAlphaTex(toAlphaTex(ctx.score, ctx.settings)).tracks[0].name).toBe('Rhythm L');
	});

	it('refuses an empty or whitespace name', () => {
		const ctx = ctxFor();
		const before = toAlphaTex(ctx.score, ctx.settings);
		renameTrack(ctx, 0, '   ');
		expect(toAlphaTex(ctx.score, ctx.settings)).toBe(before);
	});
});
```

- [ ] **Step 2: Run and confirm the failures.** Run
  `pnpm vitest run src/lib/score/commands/addTrack.test.ts src/lib/score/commands/removeTrack.test.ts src/lib/score/commands/renameTrack.test.ts`.
  Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `addTrack.ts`.**

```ts
import * as alphaTab from '@coderline/alphatab';
import { MAX_TRACKS, TRACK_DEFAULTS, uniqueTrackName, type InstrumentFamily } from '../instruments';
import { labelForTuning } from '../tuning';
import { assignChannels, emptyBarLike } from './structure';
import type { CommandContext } from './types';

export function canAddTrack(score: alphaTab.model.Score): boolean {
	return score.tracks.length < MAX_TRACKS;
}

/** Appends a tab-only track with the family's defaults. Returns its index, or undefined when full. */
export function addTrack(ctx: CommandContext, family: InstrumentFamily): number | undefined {
	const { score, settings } = ctx;
	if (!canAddTrack(score)) return undefined;
	const defaults = TRACK_DEFAULTS[family];

	const track = new alphaTab.model.Track();
	track.name = uniqueTrackName(
		defaults.name,
		score.tracks.map((t) => t.name)
	);
	track.shortName = track.name;
	track.playbackInfo.program = defaults.program;

	const staff = new alphaTab.model.Staff();
	track.addStaff(staff);
	staff.stringTuning = new alphaTab.model.Tuning(
		labelForTuning(defaults.tunings),
		[...defaults.tunings],
		false
	);
	staff.showTablature = true;
	staff.showStandardNotation = false;

	const template = score.tracks[0].staves[0].bars;
	for (let i = 0; i < score.masterBars.length; i++) staff.addBar(emptyBarLike(template[i]));

	score.addTrack(track);
	assignChannels(score);
	score.finish(settings);
	return track.index;
}
```

- [ ] **Step 4: Implement `removeTrack.ts` and `renameTrack.ts`.**

```ts
import { assignChannels } from './structure';
import type { CommandContext } from './types';

/** Removes a track. Refuses (returns false) for the last track or a bad index. */
export function removeTrack(ctx: CommandContext, trackIndex: number): boolean {
	const { score } = ctx;
	if (score.tracks.length <= 1 || !score.tracks[trackIndex]) return false;
	score.tracks.splice(trackIndex, 1);
	assignChannels(score);
	score.finish(ctx.settings);
	return true;
}
```

```ts
import type { CommandContext } from './types';

/** Renames a track. An empty or whitespace-only name is refused. */
export function renameTrack(ctx: CommandContext, trackIndex: number, name: string): void {
	const track = ctx.score.tracks[trackIndex];
	const trimmed = name.trim();
	if (!track || !trimmed) return;
	track.name = trimmed;
	track.shortName = trimmed;
	ctx.score.finish(ctx.settings);
}
```

- [ ] **Step 5: Run the tests.** Run `pnpm test`. Expected: all PASS. If
  `showStandardNotation` does not survive the round-trip, print
  `toAlphaTex(...)` and check that the bass `\staff { tabs }` block is
  there before changing anything.

- [ ] **Step 6: Commit.** Run `pnpm check && pnpm lint` first.

```bash
git add src/lib/score/commands/addTrack.ts src/lib/score/commands/addTrack.test.ts src/lib/score/commands/removeTrack.ts src/lib/score/commands/removeTrack.test.ts src/lib/score/commands/renameTrack.ts src/lib/score/commands/renameTrack.test.ts
git commit -m "feat: add, remove and rename tracks"
```

---

### Task 5: Track-aware cursor and editor (selectTrack, safe undo)

**Files:**
- Modify: `src/lib/score/cursor.ts`, `cursor.test.ts`, `editorStore.svelte.ts`, `editorStore.test.ts`
- Modify: any other `ScoreShape` object literal. Find them with
  `grep -rn "beatsPerBar:" src`.

**Interfaces:**
- Consumes: `addTrack` from `./commands/addTrack` (Task 4, used in tests)
- Produces:
  - `ScoreShape` gains `trackCount: number`
  - `clampCursor` clamps `trackIndex` too
  - `editor.selectTrack(trackIndex: number): void`
  - `editor.shape()` never throws for an out-of-range `cursor.trackIndex`

- [ ] **Step 1: Write failing cursor tests.** In `cursor.test.ts`, add
  `trackCount: 1` to the shared `shape` literal, then add:

```ts
	it('clamps the track index to the existing tracks', () => {
		const twoTracks: ScoreShape = { ...shape, trackCount: 2 };
		expect(clampCursor({ ...at(0, 0), trackIndex: 5 }, twoTracks).trackIndex).toBe(1);
		expect(clampCursor({ ...at(0, 0), trackIndex: -1 }, twoTracks).trackIndex).toBe(0);
	});
```

- [ ] **Step 2: Write failing editor tests.** In `editorStore.test.ts`, add
  `import { addTrack } from './commands/addTrack';` and:

```ts
	it('selects a track: cursor moves to its first beat, no undo entry', () => {
		const editor = createEditor({ bars: 2 });
		editor.run('add track', (ctx) => addTrack(ctx, 'bass'));
		const revision = editor.revision;
		editor.cursor = { ...editor.cursor, barIndex: 1, stringNumber: 5 };

		editor.selectTrack(1);

		expect(editor.cursor).toEqual({
			trackIndex: 1,
			barIndex: 0,
			voiceIndex: 0,
			beatIndex: 0,
			stringNumber: 1
		});
		expect(editor.revision).toBe(revision);
		expect(editor.shape().stringCount).toBe(4);
	});

	it('ignores selecting a track that does not exist', () => {
		const editor = createEditor();
		editor.selectTrack(3);
		expect(editor.cursor.trackIndex).toBe(0);
	});

	it('undoing an added track while it is selected moves the cursor back to a real track', () => {
		const editor = createEditor();
		const index = editor.run('add track', (ctx) => addTrack(ctx, 'bass'));
		editor.selectTrack(index!);

		editor.undo();

		expect(editor.score.tracks.length).toBe(1);
		expect(editor.cursor.trackIndex).toBe(0);
		expect(editor.shape().trackCount).toBe(1);
	});
```

- [ ] **Step 3: Run and confirm the failures.** Run
  `pnpm vitest run src/lib/score/cursor.test.ts src/lib/score/editorStore.test.ts`.
  Expected: FAIL. `selectTrack` doesn't exist, and undo throws in `shape()`
  because `score.tracks[1]` is undefined.

- [ ] **Step 4: Implement `cursor.ts`.** Add `trackCount: number;` to
  `ScoreShape`. Replace `clampCursor` with:

```ts
export function clampCursor(cursor: Cursor, shape: ScoreShape): Cursor {
	const trackIndex = Math.min(shape.trackCount - 1, Math.max(0, cursor.trackIndex));
	const barIndex = Math.min(shape.barCount - 1, Math.max(0, cursor.barIndex));
	const beatIndex = Math.min(shape.beatsPerBar(barIndex) - 1, Math.max(0, cursor.beatIndex));
	const stringNumber = Math.min(shape.stringCount, Math.max(1, cursor.stringNumber));
	return { ...cursor, trackIndex, barIndex, beatIndex, stringNumber };
}
```

- [ ] **Step 5: Implement the `editorStore.svelte.ts` changes.** Replace
  `shape()` so it describes a clamped track:

```ts
	function shape(): ScoreShape {
		// cursor.trackIndex can point past the end right after an undo removes
		// a track; describe the track clampCursor will land on.
		const trackIndex = Math.min(Math.max(0, cursor.trackIndex), score.tracks.length - 1);
		const staff = score.tracks[trackIndex].staves[0];
		return {
			trackCount: score.tracks.length,
			barCount: staff.bars.length,
			beatsPerBar: (barIndex) => staff.bars[barIndex]?.voices[cursor.voiceIndex]?.beats.length ?? 0,
			stringCount: staff.stringTuning.tunings.length
		};
	}
```

  Add this method to the returned object, after `breakCoalesce`:

```ts
		/** Navigation, not an edit: no history entry. */
		selectTrack(trackIndex: number) {
			if (!score.tracks[trackIndex]) return;
			history.breakCoalesce();
			cursor = { trackIndex, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber: 1 };
		}
```

  Update every other `ScoreShape` literal that `grep -rn "beatsPerBar:" src`
  finds (in tests) by adding `trackCount: 1`.

- [ ] **Step 6: Run the tests.** Run `pnpm test`. Expected: all PASS.

- [ ] **Step 7: Commit.** Run `pnpm check && pnpm lint` first.

```bash
git add src/lib/score/cursor.ts src/lib/score/cursor.test.ts src/lib/score/editorStore.svelte.ts src/lib/score/editorStore.test.ts
git add -u src
git commit -m "feat: track-aware cursor clamping and selectTrack"
```

---

### Task 6: Sound and tuning commands (setProgram, setTuning, setStringPitch)

**Files:**
- Create: `src/lib/score/commands/setProgram.ts`, `setProgram.test.ts`, `setTuning.ts`, `setTuning.test.ts`, `setStringPitch.ts`, `setStringPitch.test.ts`

**Interfaces:**
- Consumes:
  - `PROGRAMS` from `../instruments` (Task 1)
  - `labelForTuning` from `../tuning` (Task 1)
  - `stringNumberToTuningIndex` from `../strings`
- Produces:
  - `setProgram(ctx, trackIndex: number, program: number): void`
  - `setTuning(ctx, trackIndex: number, tunings: number[]): void`
  - `retune(staff: Staff, tunings: number[]): void`, an exported helper that
    Task 7 reuses
  - `setStringPitch(ctx, trackIndex: number, stringNumber: number, midi: number): void`

- [ ] **Step 1: Write failing tests.** In `setProgram.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex, toAlphaTex } from '../serialize';
import { setProgram } from './setProgram';

const ctxFor = () => ({
	score: fromAlphaTex('\\track "G" \\instrument 30 \\tuning e4 b3 g3 d3 a2 e2 . 0.6.4 r.2. | r.1'),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});
const INSTRUMENT = 2; // alphaTab.model.AutomationType.Instrument
const firstBeatPrograms = (score: ReturnType<typeof fromAlphaTex>) =>
	score.tracks[0].staves[0].bars[0].voices[0].beats[0].automations
		.filter((a) => a.type === INSTRUMENT)
		.map((a) => a.value);

describe('setProgram', () => {
	it('updates the track program and the first-beat instrument automation (fact 2)', () => {
		const ctx = ctxFor();
		expect(firstBeatPrograms(ctx.score)).toEqual([30]); // precondition: stored twice
		setProgram(ctx, 0, 29);
		expect(ctx.score.tracks[0].playbackInfo.program).toBe(29);
		expect(firstBeatPrograms(ctx.score)).toEqual([29]);
	});

	it('survives a round-trip with no stale instrument', () => {
		const ctx = ctxFor();
		setProgram(ctx, 0, 34);
		const tex = toAlphaTex(ctx.score, ctx.settings);
		expect(tex).not.toMatch(/distortionguitar/);
		const back = fromAlphaTex(tex);
		expect(back.tracks[0].playbackInfo.program).toBe(34);
		expect(firstBeatPrograms(back)).toEqual([34]);
	});

	it('refuses a program outside the curated list', () => {
		const ctx = ctxFor();
		const before = toAlphaTex(ctx.score, ctx.settings);
		setProgram(ctx, 0, 0);
		expect(toAlphaTex(ctx.score, ctx.settings)).toBe(before);
	});
});
```

  In `setTuning.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex, toAlphaTex } from '../serialize';
import { setTuning } from './setTuning';

const ctxFor = () => ({
	score: fromAlphaTex('\\tuning e4 b3 g3 d3 a2 e2 . 0.6.4 3.5.4 r.2'),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});
const notes = (score: ReturnType<typeof fromAlphaTex>) =>
	score.tracks[0].staves[0].bars[0].voices[0].beats.flatMap((b) =>
		b.notes.map((n) => [n.string, n.fret])
	);

describe('setTuning', () => {
	it('retunes, keeping frets, and labels a known preset by name', () => {
		const ctx = ctxFor();
		setTuning(ctx, 0, [62, 57, 53, 48, 43, 36]);
		const staff = ctx.score.tracks[0].staves[0];
		expect(staff.tuning).toEqual([62, 57, 53, 48, 43, 36]);
		expect(staff.stringTuning.name).toBe('Drop C');
		expect(notes(ctx.score)).toEqual([
			[1, 0],
			[2, 3]
		]);
		const back = fromAlphaTex(toAlphaTex(ctx.score, ctx.settings));
		expect(back.tracks[0].staves[0].tuning).toEqual([62, 57, 53, 48, 43, 36]);
	});

	it('labels an unknown tuning Custom', () => {
		const ctx = ctxFor();
		setTuning(ctx, 0, [64, 59, 55, 50, 45, 39]);
		expect(ctx.score.tracks[0].staves[0].stringTuning.name).toBe('Custom');
	});

	it('refuses a tuning with a different string count', () => {
		const ctx = ctxFor();
		const before = toAlphaTex(ctx.score, ctx.settings);
		setTuning(ctx, 0, [64, 59, 55, 50, 45, 40, 35]);
		expect(toAlphaTex(ctx.score, ctx.settings)).toBe(before);
	});
});
```

  In `setStringPitch.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex } from '../serialize';
import { setStringPitch } from './setStringPitch';

const ctxFor = () => ({
	score: fromAlphaTex('\\tuning e4 b3 g3 d3 a2 e2 . 0.6.1'),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});

describe('setStringPitch', () => {
	it('changes one string (string 1 = lowest) and relabels the tuning', () => {
		const ctx = ctxFor();
		setStringPitch(ctx, 0, 1, 38);
		const staff = ctx.score.tracks[0].staves[0];
		expect(staff.tuning).toEqual([64, 59, 55, 50, 45, 38]);
		expect(staff.stringTuning.name).toBe('Drop D');
	});

	it('clamps the pitch to the MIDI range', () => {
		const ctx = ctxFor();
		setStringPitch(ctx, 0, 6, 200);
		expect(ctx.score.tracks[0].staves[0].tuning[0]).toBe(127);
		setStringPitch(ctx, 0, 1, -5);
		expect(ctx.score.tracks[0].staves[0].tuning[5]).toBe(0);
	});

	it('ignores a string number that does not exist', () => {
		const ctx = ctxFor();
		setStringPitch(ctx, 0, 7, 30);
		expect(ctx.score.tracks[0].staves[0].tuning).toEqual([64, 59, 55, 50, 45, 40]);
	});
});
```

- [ ] **Step 2: Run and confirm the failures.** Run
  `pnpm vitest run src/lib/score/commands/setProgram.test.ts src/lib/score/commands/setTuning.test.ts src/lib/score/commands/setStringPitch.test.ts`.
  Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `setProgram.ts`.**

```ts
import * as alphaTab from '@coderline/alphatab';
import { PROGRAMS } from '../instruments';
import type { CommandContext } from './types';

/**
 * alphaTab stores a track's program twice: playbackInfo.program AND an
 * Instrument automation on the track's first beat (which playback obeys).
 * Both must change together or the old sound wins.
 */
export function setProgram(ctx: CommandContext, trackIndex: number, program: number): void {
	const track = ctx.score.tracks[trackIndex];
	if (!track || !PROGRAMS.some((p) => p.program === program)) return;
	track.playbackInfo.program = program;
	for (const staff of track.staves) {
		const firstBeat = staff.bars[0]?.voices[0]?.beats[0];
		for (const automation of firstBeat?.automations ?? []) {
			if (automation.type === alphaTab.model.AutomationType.Instrument) automation.value = program;
		}
	}
	ctx.score.finish(ctx.settings);
}
```

- [ ] **Step 4: Implement `setTuning.ts` and `setStringPitch.ts`.**

```ts
import * as alphaTab from '@coderline/alphatab';
import { labelForTuning } from '../tuning';
import type { CommandContext } from './types';

/** Replaces a staff's tuning (frets untouched), labelled with its preset name or 'Custom'. */
export function retune(staff: alphaTab.model.Staff, tunings: number[]): void {
	staff.stringTuning = new alphaTab.model.Tuning(labelForTuning(tunings), [...tunings], false);
}

/** Retunes a track, keeping every fret (the sounding pitch moves). Same string count only. */
export function setTuning(ctx: CommandContext, trackIndex: number, tunings: number[]): void {
	const staff = ctx.score.tracks[trackIndex]?.staves[0];
	if (!staff || tunings.length !== staff.tuning.length) return;
	retune(staff, tunings);
	ctx.score.finish(ctx.settings);
}
```

```ts
import { stringNumberToTuningIndex } from '../strings';
import { retune } from './setTuning';
import type { CommandContext } from './types';

/** Sets one string's open pitch (stringNumber 1 = lowest), clamped to MIDI 0-127. */
export function setStringPitch(
	ctx: CommandContext,
	trackIndex: number,
	stringNumber: number,
	midi: number
): void {
	const staff = ctx.score.tracks[trackIndex]?.staves[0];
	if (!staff) return;
	const tunings = [...staff.tuning];
	const tuningIndex = stringNumberToTuningIndex(stringNumber, tunings.length);
	if (tuningIndex < 0 || tuningIndex >= tunings.length) return;
	tunings[tuningIndex] = Math.min(127, Math.max(0, Math.round(midi)));
	retune(staff, tunings);
	ctx.score.finish(ctx.settings);
}
```

- [ ] **Step 5: Run the tests.** Run `pnpm test`. Expected: all PASS.

- [ ] **Step 6: Commit.** Run `pnpm check && pnpm lint` first.

```bash
git add src/lib/score/commands/setProgram.ts src/lib/score/commands/setProgram.test.ts src/lib/score/commands/setTuning.ts src/lib/score/commands/setTuning.test.ts src/lib/score/commands/setStringPitch.ts src/lib/score/commands/setStringPitch.test.ts
git commit -m "feat: set track sound, tuning and per-string pitch"
```

---

### Task 7: setStringCount

**Files:**
- Create: `src/lib/score/commands/setStringCount.ts`, `setStringCount.test.ts`

**Interfaces:**
- Consumes: `retune(staff, tunings)` from `./setTuning` (Task 6)
- Produces: `setStringCount(ctx, trackIndex: number, count: number): { removedNotes: number }`

- [ ] **Step 1: Write failing tests.** `note.realValue` is the sounding MIDI
  pitch, so an unchanged `realValue` proves a note stayed on its physical
  string.

```ts
import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex, toAlphaTex } from '../serialize';
import { setStringCount } from './setStringCount';

const ctxFor = (tex: string) => ({
	score: fromAlphaTex(tex),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});
const notes = (score: ReturnType<typeof fromAlphaTex>) =>
	score.tracks[0].staves[0].bars[0].voices[0].beats.map((b) =>
		b.notes.map((n) => ({ string: n.string, fret: n.fret, pitch: n.realValue }))
	);

describe('setStringCount', () => {
	it('6 -> 7 adds a low B and keeps every note on its physical string', () => {
		const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 . 3.6.4 5.1.4 r.2');
		const before = notes(ctx.score);

		expect(setStringCount(ctx, 0, 7)).toEqual({ removedNotes: 0 });

		const staff = ctx.score.tracks[0].staves[0];
		expect(staff.tuning).toEqual([64, 59, 55, 50, 45, 40, 35]);
		expect(staff.stringTuning.name).toBe('7-String Standard');
		const after = notes(ctx.score);
		expect(after[0][0]).toEqual({ ...before[0][0], string: 2 }); // low E is now string 2
		expect(after[1][0]).toEqual({ ...before[1][0], string: 7 }); // high E is now string 7
		expect(after.flat().map((n) => n.pitch)).toEqual(before.flat().map((n) => n.pitch));
	});

	it('6 -> 8 adds two strings a fourth apart (B1, F#1)', () => {
		const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 . 3.6.1');
		setStringCount(ctx, 0, 8);
		expect(ctx.score.tracks[0].staves[0].tuning).toEqual([64, 59, 55, 50, 45, 40, 35, 30]);
		expect(notes(ctx.score)[0][0].string).toBe(3);
	});

	it('7 -> 6 removes notes on the lowest string, reports them, and shifts the rest', () => {
		const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 b1 . 2.7.4 (3.6 0.7).4 5.1.2');
		const pitchesKept = [notes(ctx.score)[1][0].pitch, notes(ctx.score)[2][0].pitch];

		expect(setStringCount(ctx, 0, 6)).toEqual({ removedNotes: 2 });

		expect(ctx.score.tracks[0].staves[0].tuning).toEqual([64, 59, 55, 50, 45, 40]);
		const after = notes(ctx.score);
		expect(after[0]).toEqual([]); // the beat became a rest
		expect(after[1].map((n) => [n.string, n.fret])).toEqual([[1, 3]]);
		expect(after[2].map((n) => [n.string, n.fret])).toEqual([[6, 5]]);
		expect([after[1][0].pitch, after[2][0].pitch]).toEqual(pitchesKept);
		expect(() => fromAlphaTex(toAlphaTex(ctx.score, ctx.settings))).not.toThrow();
	});

	it('refuses counts outside 4-8 or equal to the current count', () => {
		for (const count of [3, 9, 6, 6.5]) {
			const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 . 3.6.1');
			const before = toAlphaTex(ctx.score, ctx.settings);
			expect(setStringCount(ctx, 0, count)).toEqual({ removedNotes: 0 });
			expect(toAlphaTex(ctx.score, ctx.settings)).toBe(before);
		}
	});
});
```

- [ ] **Step 2: Run and confirm the failures.** Run
  `pnpm vitest run src/lib/score/commands/setStringCount.test.ts`.
  Expected: FAIL (module not found).

- [ ] **Step 3: Implement `setStringCount.ts`.**

```ts
import { retune } from './setTuning';
import type { CommandContext } from './types';

/**
 * Adds or removes strings at the LOW end, keeping every note on its physical
 * string. note.string counts from the lowest string (AGENTS.md rule 3), so
 * adding k low strings shifts every note up by k; removing k deletes notes on
 * the k lowest strings and shifts the rest down. New strings sit a fourth
 * (5 semitones) below the current lowest.
 */
export function setStringCount(
	ctx: CommandContext,
	trackIndex: number,
	count: number
): { removedNotes: number } {
	const staff = ctx.score.tracks[trackIndex]?.staves[0];
	const current = staff?.tuning.length ?? 0;
	if (!staff || !Number.isInteger(count) || count < 4 || count > 8 || count === current) {
		return { removedNotes: 0 };
	}

	const delta = count - current;
	const tunings = [...staff.tuning];
	if (delta > 0) {
		for (let i = 0; i < delta; i++) tunings.push(Math.max(0, tunings[tunings.length - 1] - 5));
	} else {
		tunings.length = count; // tunings[0] is the highest string: drop from the end
	}

	let removedNotes = 0;
	for (const bar of staff.bars)
		for (const voice of bar.voices)
			for (const beat of voice.beats)
				for (const note of [...beat.notes]) {
					if (note.string + delta < 1) {
						beat.removeNote(note);
						removedNotes++;
					} else {
						note.string += delta;
					}
				}

	retune(staff, tunings);
	ctx.score.finish(ctx.settings);
	return { removedNotes };
}
```

- [ ] **Step 4: Run the tests.** Run `pnpm test`. Expected: all PASS.

- [ ] **Step 5: Commit.** Run `pnpm check && pnpm lint` first.

```bash
git add src/lib/score/commands/setStringCount.ts src/lib/score/commands/setStringCount.test.ts
git commit -m "feat: change string count at the low end, keeping notes on their strings"
```

---

### Task 8: Bar shortcuts, dispatch and palette buttons

**Files:**
- Modify: `src/lib/editor/keymap.ts`, `keymap.test.ts`, `dispatch.ts`, `dispatch.test.ts`
- Modify: `src/lib/components/panels/NotationPalette.svelte`, `src/routes/+page.svelte` (comment only)
- Create: `e2e/instruments.spec.ts`

**Interfaces:**
- Consumes:
  - `insertBar` and `deleteBar` (Task 2)
  - `clampCursor` from `$lib/score/cursor` (Task 5)
- Produces: `EditorAction` variants `{ kind: 'insertBar' }` and
  `{ kind: 'deleteBar' }`

- [ ] **Step 1: Write failing keymap tests.** Add to `keymap.test.ts`:

```ts
	it('maps Ctrl/Cmd+Insert and Ctrl/Cmd+Delete to bar insert/delete', () => {
		expect(key('Insert', { ctrlKey: true })).toEqual({ kind: 'insertBar' });
		expect(key('Insert', { metaKey: true })).toEqual({ kind: 'insertBar' });
		expect(key('Delete', { ctrlKey: true })).toEqual({ kind: 'deleteBar' });
		expect(key('Delete')).toEqual({ kind: 'clear' }); // plain Delete still clears a note
	});
```

- [ ] **Step 2: Write failing dispatch tests.** Add to `dispatch.test.ts`
  (it already has the `freshApplyAction` helper and imports):

```ts
describe('dispatch bar actions', () => {
	it('insertBar adds a bar after the cursor and moves onto it', async () => {
		const applyAction = await freshApplyAction();
		const editor = createEditor({ bars: 2 });

		applyAction(editor, { kind: 'insertBar' });

		expect(editor.score.masterBars.length).toBe(3);
		expect(editor.cursor.barIndex).toBe(1);
		expect(editor.cursor.beatIndex).toBe(0);
		expect(editor.canUndo).toBe(true);
	});

	it('deleteBar on the last bar leaves the cursor on the new last bar', async () => {
		const applyAction = await freshApplyAction();
		const editor = createEditor({ bars: 3 });
		editor.cursor = { ...editor.cursor, barIndex: 2 };

		applyAction(editor, { kind: 'deleteBar' });

		expect(editor.score.masterBars.length).toBe(2);
		expect(editor.cursor.barIndex).toBe(1);
		expect(editor.cursor.beatIndex).toBe(0);
	});

	it('deleteBar on the only bar changes nothing and records no undo', async () => {
		const applyAction = await freshApplyAction();
		const editor = createEditor({ bars: 1 });

		applyAction(editor, { kind: 'deleteBar' });

		expect(editor.score.masterBars.length).toBe(1);
		expect(editor.canUndo).toBe(false);
	});
});
```

- [ ] **Step 3: Run and confirm the failures.** Run
  `pnpm vitest run src/lib/editor`. Expected: the new tests FAIL.

- [ ] **Step 4: Implement `keymap.ts`.** Add
  `| { kind: 'insertBar' } | { kind: 'deleteBar' }` to `EditorAction`. In
  `resolveKey`, insert these lines **before** `if (mod) return undefined;`:

```ts
	if (mod && key === 'Insert') return { kind: 'insertBar' };
	if (mod && key === 'Delete') return { kind: 'deleteBar' };
```

- [ ] **Step 5: Implement `dispatch.ts`.** Import `insertBar`, `deleteBar`
  and `clampCursor` (from `$lib/score/cursor`). Add these cases to the
  switch:

```ts
		case 'insertBar': {
			const barIndex = editor.run('insert bar', insertBar);
			editor.cursor = { ...editor.cursor, barIndex, beatIndex: 0 };
			break;
		}
		case 'deleteBar':
			editor.run('delete bar', deleteBar);
			editor.cursor = clampCursor({ ...editor.cursor, beatIndex: 0 }, editor.shape());
			break;
```

- [ ] **Step 6: Add the palette's "Bar" group.** In
  `NotationPalette.svelte`, add to the script:

```ts
	// The score is mutated in place (same reference); reading revision makes
	// this re-derive after every command.
	const barCount = $derived.by(() => {
		void editor.revision;
		return editor.score.masterBars.length;
	});
```

  Append this markup inside the `<section>`, after the articulation grid:

```svelte
	<h2 class="mt-4 mb-2 text-xs font-semibold tracking-wide text-neutral-400 uppercase">Bar</h2>
	<div class="grid grid-cols-2 gap-1">
		<button
			class="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
			title="Ctrl+Insert"
			onclick={() => applyAction(editor, { kind: 'insertBar' })}>Insert bar</button
		>
		<button
			class="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700 disabled:opacity-40"
			title="Ctrl+Delete"
			disabled={barCount <= 1}
			onclick={() => applyAction(editor, { kind: 'deleteBar' })}>Delete bar</button
		>
	</div>
```

  In `src/routes/+page.svelte`, replace the four-line comment above
  `createEditor({ bars: 8 })` with:

```ts
	// Start with 8 empty bars. Bars can be inserted/deleted (Ctrl+Insert /
	// Ctrl+Delete, or the palette), and ArrowRight past the last full bar
	// appends one.
```

- [ ] **Step 7: Write the e2e test** in `e2e/instruments.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

async function load(page: import('@playwright/test').Page) {
	await page.goto('/');
	const scoreView = page.getByTestId('score-view');
	await expect(scoreView.locator('svg').first()).toBeVisible({ timeout: 15_000 });
	return scoreView;
}

test('Ctrl+Insert adds a bar and Ctrl+Delete removes it', async ({ page }) => {
	const scoreView = await load(page);
	// alphaTab labels each bar with its number; the 8-bar default has no bar 9.
	const barNine = scoreView.locator('svg text', { hasText: /^\s*9\s*$/ });
	await expect(barNine).toHaveCount(0);

	await page.keyboard.press('Control+Insert');
	await expect(barNine).toHaveCount(1);

	await page.keyboard.press('Control+Delete');
	await expect(barNine).toHaveCount(0);
});
```

  **Check that the test can fail.** Temporarily comment out the
  `Control+Insert` press. The first `toHaveCount(1)` must FAIL. Restore the
  line.

- [ ] **Step 8: Run all the gates.** Run
  `pnpm test && pnpm check && pnpm lint && pnpm test:e2e`. Expected: all
  PASS. Playwright's `reuseExistingServer: true` can serve a stale build,
  so stop any running `pnpm preview` first.

- [ ] **Step 9: Commit.**

```bash
git add src/lib/editor src/lib/components/panels/NotationPalette.svelte src/routes/+page.svelte e2e/instruments.spec.ts
git commit -m "feat: bar insert/delete shortcuts and palette buttons"
```

---

### Task 9: Selected-track rendering + real TrackList

**Files:**
- Modify: `src/lib/components/ScoreView.svelte`, `src/routes/+page.svelte`
- Rewrite: `src/lib/components/panels/TrackList.svelte`
- Modify: `e2e/instruments.spec.ts`

**Interfaces:**
- Consumes:
  - `addTrack` and `canAddTrack` (Task 4), `removeTrack` (Task 4)
  - `editor.selectTrack` (Task 5)
  - `familyOf` (Task 1)
- Produces: `<TrackList {editor} />`, which takes the editor as a prop (it
  used to take no props)

- [ ] **Step 1: Write the failing e2e test.** Append to
  `e2e/instruments.spec.ts`:

```ts
test('adds a bass track, edits it, and switching tracks shows each track’s own notes', async ({
	page
}) => {
	const scoreView = await load(page);
	const tracks = page.getByTestId('tracks');

	await tracks.getByRole('button', { name: '+ Add track' }).click();
	await page.getByRole('menuitem', { name: 'Bass' }).click();

	// The new track is selected: typing goes onto the bass.
	await expect(tracks.getByRole('button', { name: /^Bass — Bass$/ })).toBeVisible();
	await page.keyboard.press('9');
	const nine = scoreView.locator('svg text', { hasText: /^9$/ });
	await expect(nine).toHaveCount(1);

	// Back on the guitar, the bass note is not rendered.
	await tracks.getByRole('button', { name: /^Guitar — Guitar$/ }).click();
	await expect(nine).toHaveCount(0);

	// Removing the bass track leaves only the guitar.
	await tracks.getByRole('button', { name: 'Remove Bass' }).click();
	await expect(tracks.getByRole('button', { name: /^Bass — Bass$/ })).toHaveCount(0);
	await expect(tracks.getByRole('button', { name: /^Remove / })).toHaveCount(0);
});
```

- [ ] **Step 2: Run and confirm the failure.** Run
  `pnpm test:e2e -g "bass track"`. Expected: FAIL (no "+ Add track" menu).

- [ ] **Step 3: Update `ScoreView.svelte`.**
  - Change `display: { staveProfile: 'ScoreTab' }` to
    `display: { staveProfile: 'Default' }`. `'Default'` respects each
    staff's own `showStandardNotation` / `showTablature`, and `'ScoreTab'`
    would force notation onto the tab-only bass.
  - In `onMount`, change `api.renderScore(score, [0]);` to
    `api.renderScore(score, [cursor.trackIndex]);`.
  - Replace the revision effect with:

```ts
	// alphaTab does not observe mutations to the score object graph; every
	// command bumps `revision`, and this effect is what actually triggers a
	// re-render in response (AGENTS.md rule #4). Only the selected track is
	// rendered, so selecting another track re-renders too.
	const trackIndex = $derived(cursor.trackIndex);
	$effect(() => {
		void revision;
		api?.renderScore(score, [trackIndex]);
	});
```

- [ ] **Step 4: Rewrite `TrackList.svelte`.** Check the bits-ui 2
  `DropdownMenu` API in `node_modules/bits-ui` (the `Root`, `Trigger`,
  `Portal`, `Content` and `Item` parts, and `Item`'s `onSelect`) before
  writing this. Adjust the part names only if the installed version
  differs.

```svelte
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

	function add(family: InstrumentFamily) {
		const index = editor.run('add track', (ctx) => addTrack(ctx, family));
		if (index !== undefined) editor.selectTrack(index);
	}

	function remove(trackIndex: number) {
		const selected = editor.cursor.trackIndex;
		if (!editor.run('remove track', (ctx) => removeTrack(ctx, trackIndex))) return;
		if (trackIndex < selected) editor.selectTrack(selected - 1);
		else if (trackIndex === selected)
			editor.selectTrack(Math.min(selected, editor.score.tracks.length - 1));
	}
</script>

<section class="flex h-full items-center gap-2 p-3">
	{#each tracks as track, i (i)}
		<div class="flex shrink-0 items-center">
			<button
				class="rounded-l px-3 py-1.5 text-xs font-medium {i === editor.cursor.trackIndex
					? 'bg-neutral-700 text-neutral-100'
					: 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100'}"
				onclick={() => editor.selectTrack(i)}
			>
				{track.name} — {FAMILY_LABEL[track.family]}
			</button>
			{#if tracks.length > 1}
				<button
					class="rounded-r bg-neutral-800 px-2 py-1.5 text-xs text-neutral-500 hover:bg-red-900 hover:text-neutral-100"
					aria-label="Remove {track.name}"
					onclick={() => remove(i)}>×</button
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
```

  In `src/routes/+page.svelte`, change `<TrackList />` to
  `<TrackList {editor} />`.

- [ ] **Step 5: Run all the gates.** Run
  `pnpm test && pnpm check && pnpm lint && pnpm test:e2e`. Expected: all
  PASS. That includes the existing cursor-highlight geometry e2e tests: the
  guitar staff still shows notation and tab under `'Default'`. If those
  tests fail, check that the default guitar staff has `showStandardNotation`
  set to true before changing geometry code.

- [ ] **Step 6: Commit.**

```bash
git add src/lib/components/ScoreView.svelte src/lib/components/panels/TrackList.svelte src/routes/+page.svelte e2e/instruments.spec.ts
git commit -m "feat: track list with add/select/remove; render the selected track"
```

---

### Task 10: Instrument inspector + docs

**Files:**
- Modify: `src/lib/score/cursor.ts`, `cursor.test.ts` (the `shiftCursorString` helper)
- Rewrite: `src/lib/components/panels/InstrumentInspector.svelte`
- Modify: `e2e/instruments.spec.ts`, `AGENTS.md`

**Interfaces:**
- Consumes:
  - `renameTrack` (Task 4); `setProgram`, `setTuning` and `setStringPitch`
    (Task 6); `setStringCount` (Task 7)
  - `PROGRAMS` and `familyOf` (Task 1)
  - `presetsFor` and `describeTuning` (from `tuning.ts`)
  - `tuningIndexToStringNumber` (from `strings.ts`)
  - `clampCursor` and `ScoreShape` (Task 5)
- Produces: `shiftCursorString(cursor: Cursor, delta: number, shape: ScoreShape): Cursor`

- [ ] **Step 1: Write a failing cursor test.** Add to `cursor.test.ts`, and
  add `shiftCursorString` to the import:

```ts
	it('shifts the cursor string with a string-count change so it stays on the same physical string', () => {
		const seven: ScoreShape = { ...shape, stringCount: 7 };
		expect(shiftCursorString(at(0, 0, 1), 1, seven).stringNumber).toBe(2); // 6 -> 7
		const five: ScoreShape = { ...shape, stringCount: 5 };
		expect(shiftCursorString(at(0, 0, 1), -1, five).stringNumber).toBe(1); // removed string: clamp
		expect(shiftCursorString(at(0, 0, 6), -1, five).stringNumber).toBe(5);
	});
```

- [ ] **Step 2: Run and confirm the failure.** Run
  `pnpm vitest run src/lib/score/cursor.test.ts`. Expected: FAIL (the
  export doesn't exist).

- [ ] **Step 3: Implement it in `cursor.ts`.**

```ts
/**
 * After a string-count change of `delta` (strings added/removed at the low
 * end), keep the cursor on the same physical string: note.string numbering
 * shifts by delta, so the cursor must too.
 */
export function shiftCursorString(cursor: Cursor, delta: number, shape: ScoreShape): Cursor {
	return clampCursor({ ...cursor, stringNumber: cursor.stringNumber + delta }, shape);
}
```

  Run `pnpm vitest run src/lib/score/cursor.test.ts`. Expected: PASS.

- [ ] **Step 4: Write the failing e2e tests.** Append to
  `e2e/instruments.spec.ts`:

```ts
test('inspector: 7 strings keeps a typed note, presets and steppers retune', async ({ page }) => {
	const scoreView = await load(page);
	const inspector = page.getByTestId('inspector');

	await page.keyboard.press('9'); // low E, bar 1
	const nine = scoreView.locator('svg text', { hasText: /^9$/ });
	await expect(nine).toHaveCount(1);

	await inspector.getByLabel('Strings').selectOption('7');
	await expect(inspector.getByTestId('string-row')).toHaveCount(7);
	await expect(inspector.getByLabel('Tuning')).toHaveValue('7-String Standard');
	await expect(nine).toHaveCount(1); // the note survived

	await inspector.getByLabel('Lower string 7').click();
	await expect(inspector.getByTestId('string-row').nth(6)).toContainText('A#1');
	await expect(inspector.getByLabel('Tuning')).toHaveValue('Custom');

	await inspector.getByLabel('Tuning').selectOption('7-String Drop A');
	await expect(inspector.getByTestId('string-row').nth(6)).toContainText('A1');

	// The cursor followed low E to string 2; ArrowDown reaches the new lowest
	// string. A note there is the one that 7 -> 6 must remove.
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('0');
	const zero = scoreView.locator('svg text', { hasText: /^0$/ });
	await expect(zero).toHaveCount(1);

	await inspector.getByLabel('Strings').selectOption('6');
	await expect(inspector.getByRole('status')).toContainText('1 note removed');
	await expect(zero).toHaveCount(0);
	await expect(nine).toHaveCount(1); // low E note kept
	await page.keyboard.press('Control+z');
	await expect(zero).toHaveCount(1);
});

test('inspector: rename and change sound', async ({ page }) => {
	await load(page);
	const inspector = page.getByTestId('inspector');
	const tracks = page.getByTestId('tracks');

	const name = inspector.getByLabel('Name');
	await name.fill('Rhythm L');
	await name.press('Enter');
	await expect(tracks.getByRole('button', { name: /^Rhythm L — Guitar$/ })).toBeVisible();

	await inspector.getByLabel('Sound').selectOption({ label: 'Picked Bass' });
	await expect(tracks.getByRole('button', { name: /^Rhythm L — Bass$/ })).toBeVisible();
});
```

  (`B1` lowered one semitone is `A#1`: `describeTuning` uses sharps, as in
  `'E4 B3 …'`. If it renders flats, match the rendered note name.)

- [ ] **Step 5: Run and confirm the failures.** Run
  `pnpm test:e2e -g inspector`. Expected: FAIL (no Strings / Name
  controls wired up).

- [ ] **Step 6: Rewrite `InstrumentInspector.svelte`.**

```svelte
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

		<label class="flex flex-col gap-1 text-xs text-neutral-400">
			Sound
			<select
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
		</label>

		<label class="flex flex-col gap-1 text-xs text-neutral-400">
			Strings
			<select
				class="rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100"
				value={String(info.tunings.length)}
				onchange={onStrings}
			>
				{#each STRING_COUNTS as count (count)}
					<option value={String(count)}>{count}</option>
				{/each}
			</select>
		</label>
		{#if notice}
			<p role="status" class="text-xs text-amber-400">{notice}</p>
		{/if}

		<label class="flex flex-col gap-1 text-xs text-neutral-400">
			Tuning
			<select
				class="rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100"
				value={presetName}
				onchange={onPreset}
			>
				{#each presets as preset (preset.name)}
					<option value={preset.name}>{preset.name}</option>
				{/each}
				<option value="Custom" disabled>Custom</option>
			</select>
		</label>

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
```

  The row number (`tuningIndex + 1`) is the guitarist's convention (1 = the
  highest string, the top line of the tab). It is a display label only.
  Every call into a command converts through `tuningIndexToStringNumber`.

- [ ] **Step 7: Update AGENTS.md.** In the architecture tree:
  - under `score/`, add
    `instruments.ts   curated MIDI programs, family, track defaults, MAX_TRACKS`
  - under `commands/`, add
    `(structure.ts: shared relink/insert/remove helpers — not a command)`

  Append these bullets to **Gotchas**:

```markdown
- **A track's MIDI program is stored twice**: `track.playbackInfo.program`
  and an `Instrument` automation on the track's first beat (which playback
  obeys). Change both — `commands/setProgram.ts` does.
- **Changing a staff's string count must renumber notes.** `note.string`
  counts from the lowest string, so adding k low strings means
  `note.string += k` or every note silently moves down k strings.
  `commands/setStringCount.ts` owns this.
- **`Tuning.initialize()` appends duplicates on every call.** Always go
  through `ensureTuningsInitialized()` / `presetsFor()` in `tuning.ts`.
- **Structural edits (bars, tracks) splice arrays**, so relink afterwards
  with `commands/structure.ts`. Deleting bar 0 must hand its tempo
  automation to the new first bar (the score tempo lives there).
- **UI `$derived` over score data must read `editor.revision`.** Commands
  mutate the score in place; its reference only changes on undo/redo.
```

- [ ] **Step 8: Run all the gates.** Run
  `pnpm test && pnpm check && pnpm lint && pnpm test:e2e`. Expected: all
  PASS (stop any stale `pnpm preview` first).

- [ ] **Step 9: Commit.**

```bash
git add src/lib/score/cursor.ts src/lib/score/cursor.test.ts src/lib/components/panels/InstrumentInspector.svelte e2e/instruments.spec.ts AGENTS.md
git commit -m "feat: instrument inspector — name, sound, strings, tuning presets and steppers"
```
