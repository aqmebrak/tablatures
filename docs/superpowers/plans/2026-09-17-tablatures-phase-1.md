# Tablatures Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running SvelteKit app that opens on a blank guitar tablature, renders it with alphaTab, and lets you write a riff with the keyboard — notes, durations, and metal articulations — with working undo/redo.

**Architecture:** alphaTab's `Score` object is the document; all mutation is funnelled through a unit-tested command layer that owns `finish()` + re-render + undo snapshots. Documents serialize to alphaTex text, which doubles as the undo-snapshot and test-fixture format.

**Tech Stack:** SvelteKit 2.70, Svelte 5 (runes), TypeScript, alphaTab 1.8.4, Tailwind CSS 4, bits-ui, Vitest, Playwright, pnpm, `@sveltejs/adapter-vercel`.

**Spec:** `docs/superpowers/specs/2026-09-17-tablatures-design.md`

## Global Constraints

- alphaTab pinned at `1.8.4`. `JsonConverter` is **unreachable at runtime** — never use it; serialize via alphaTex.
- Nothing outside `src/lib/score/commands/` may mutate a `Score`.
- Every command calls `score.finish(settings)` after mutating.
- `note.string = stringCount - tuningIndex`. All conversion goes through `src/lib/score/strings.ts`.
- The score is held in `$state.raw`, never plain `$state`.
- Unit tests run headless in Node — no DOM, no jsdom, for anything under `src/lib/score/`.
- One command per file. No default exports except Svelte components.
- Strict TDD for `src/lib/score/`: failing test first, always.

---

### Task 1: Project scaffold and tooling

**Files:**
- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`
- Create: `src/app.css`, `src/app.html`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`
- Create: `.gitignore`, `.prettierrc`, `eslint.config.js`
- Test: `src/lib/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: working `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm check`

- [ ] **Step 1: Scaffold the project non-interactively**

```bash
cd /home/aqmebrak/tablatures
pnpm dlx sv create . --template minimal --types ts --no-add-ons --install pnpm
```

If the directory-not-empty check complains about `AGENTS.md` / `docs/`, pass `--force`.

- [ ] **Step 2: Add the remaining dependencies**

```bash
pnpm add -D @sveltejs/adapter-vercel tailwindcss @tailwindcss/vite \
  vitest @playwright/test eslint prettier prettier-plugin-svelte \
  eslint-plugin-svelte typescript-eslint
pnpm add bits-ui
```

- [ ] **Step 3: Wire Tailwind 4 and the Vercel adapter**

`vite.config.ts`:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
});
```

`src/app.css`:

```css
@import 'tailwindcss';
```

`svelte.config.js` — swap `adapter-auto` for `adapter-vercel`:

```js
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: { adapter: adapter() }
};
```

- [ ] **Step 4: Add scripts to `package.json`**

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "prettier --check . && eslint ."
  }
}
```

- [ ] **Step 5: Write a smoke test proving the test runner works**

`src/lib/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Verify the toolchain**

```bash
pnpm test && pnpm check && pnpm build
```

Expected: test passes, check reports 0 errors, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold SvelteKit + Tailwind 4 + Vitest + Vercel adapter"
```

---

### Task 2: alphaTab renders a hardcoded riff

**Files:**
- Modify: `vite.config.ts`
- Create: `src/lib/components/ScoreView.svelte`
- Modify: `src/routes/+page.svelte`
- Test: `e2e/render.spec.ts`, `playwright.config.ts`

**Interfaces:**
- Consumes: Task 1 toolchain
- Produces: `ScoreView.svelte` accepting `{ tex: string }`, mounting an `AlphaTabApi`

- [ ] **Step 1: Install alphaTab and register its Vite plugin**

```bash
pnpm add @coderline/alphatab@1.8.4
```

`vite.config.ts` — add the plugin **before** `sveltekit()`:

```ts
import { alphaTab } from '@coderline/alphatab/vite';
// ...
plugins: [alphaTab(), tailwindcss(), sveltekit()],
```

This is required: it places the worker, audio worklet, soundfont and Bravura font. Do not hand-roll it.

- [ ] **Step 2: Write the ScoreView component**

`src/lib/components/ScoreView.svelte`:

```svelte
<script lang="ts">
  import * as alphaTab from '@coderline/alphatab';
  import { onMount } from 'svelte';

  let { tex }: { tex: string } = $props();
  let host: HTMLDivElement;
  let api: alphaTab.AlphaTabApi | undefined;

  onMount(() => {
    api = new alphaTab.AlphaTabApi(host, {
      core: { tex: true, fontDirectory: '/font/' },
      display: { staveProfile: 'ScoreTab' }
    });
    api.tex(tex);
    return () => api?.destroy();
  });
</script>

<div bind:this={host} data-testid="score-view" class="alphatab-host"></div>
```

- [ ] **Step 3: Render it from the index route**

`src/routes/+page.svelte`:

```svelte
<script lang="ts">
  import ScoreView from '$lib/components/ScoreView.svelte';

  const tex = `\\title "Untitled" \\tempo 180 . \\tuning e4 b3 g3 d3 a2 e2 . (0.6 0.5).8 3.6.8 5.6.16 | 7.6.4`;
</script>

<ScoreView {tex} />
```

- [ ] **Step 4: Run the dev server and confirm visually**

```bash
pnpm dev
```

Expected: a tablature staff with standard notation above it. If the notation
glyphs are missing boxes, `fontDirectory` is wrong — check what the alphaTab
Vite plugin emitted into the build output.

- [ ] **Step 5: Add the Playwright smoke test**

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  webServer: { command: 'pnpm build && pnpm preview', port: 4173, reuseExistingServer: true },
  use: { baseURL: 'http://localhost:4173' }
});
```

`e2e/render.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('renders a score', async ({ page }) => {
  await page.goto('/');
  const host = page.getByTestId('score-view');
  await expect(host).toBeVisible();
  // alphaTab injects svg once layout completes
  await expect(host.locator('svg').first()).toBeVisible({ timeout: 15_000 });
});
```

- [ ] **Step 6: Run it**

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: render a tablature with alphaTab"
```

---

### Task 3: String-numbering conversions

**Files:**
- Create: `src/lib/score/strings.ts`
- Test: `src/lib/score/strings.test.ts`

**Interfaces:**
- Produces:
  - `tuningIndexToStringNumber(tuningIndex: number, stringCount: number): number`
  - `stringNumberToTuningIndex(stringNumber: number, stringCount: number): number`
  - `midiForString(tunings: number[], stringNumber: number, fret: number): number`

- [ ] **Step 1: Write the failing test**

`src/lib/score/strings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  midiForString,
  stringNumberToTuningIndex,
  tuningIndexToStringNumber
} from './strings';

// \tuning e4 b3 g3 d3 a2 e2  -> index 0 is the HIGHEST string
const STANDARD = [64, 59, 55, 50, 45, 40];

describe('string numbering', () => {
  it('maps the top tuning entry to the highest string number', () => {
    expect(tuningIndexToStringNumber(0, 6)).toBe(6);
  });

  it('maps the bottom tuning entry to string 1', () => {
    expect(tuningIndexToStringNumber(5, 6)).toBe(1);
  });

  it('round-trips', () => {
    for (let i = 0; i < 6; i++) {
      expect(stringNumberToTuningIndex(tuningIndexToStringNumber(i, 6), 6)).toBe(i);
    }
  });

  it('handles 7 and 8 string instruments', () => {
    expect(tuningIndexToStringNumber(0, 7)).toBe(7);
    expect(tuningIndexToStringNumber(7, 8)).toBe(1);
  });

  it('computes midi pitch for an open low E', () => {
    expect(midiForString(STANDARD, 1, 0)).toBe(40);
  });

  it('computes midi pitch for the high E at the 12th fret', () => {
    expect(midiForString(STANDARD, 6, 12)).toBe(76);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
pnpm vitest run src/lib/score/strings.test.ts
```

Expected: FAIL — cannot find module `./strings`.

- [ ] **Step 3: Implement**

`src/lib/score/strings.ts`:

```ts
/**
 * alphaTab uses three colliding string conventions:
 *  - `stringTuning.tunings[0]` is the HIGHEST pitched string (top tab line)
 *  - alphaTex `fret.N` counts N from the top line
 *  - `note.string` is 1-based from the LOWEST pitched string
 * Everything converting between them lives here.
 */
export function tuningIndexToStringNumber(tuningIndex: number, stringCount: number): number {
  return stringCount - tuningIndex;
}

export function stringNumberToTuningIndex(stringNumber: number, stringCount: number): number {
  return stringCount - stringNumber;
}

export function midiForString(tunings: number[], stringNumber: number, fret: number): number {
  return tunings[stringNumberToTuningIndex(stringNumber, tunings.length)] + fret;
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run src/lib/score/strings.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/score/strings.ts src/lib/score/strings.test.ts
git commit -m "feat: string-numbering conversion helpers"
```

---

### Task 4: alphaTex serialization

**Files:**
- Create: `src/lib/score/serialize.ts`
- Test: `src/lib/score/serialize.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `fromAlphaTex(tex: string, settings?: Settings): Score`
  - `toAlphaTex(score: Score, settings?: Settings): string`
  - `defaultSettings(): Settings`
  - `AlphaTexParseError` (carries `diagnostics: string[]`)

- [ ] **Step 1: Write the failing test**

`src/lib/score/serialize.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AlphaTexParseError, fromAlphaTex, toAlphaTex } from './serialize';

const RIFF = `\\title "Riff" \\tempo 180 . \\tuning e4 b3 g3 d3 a2 e2 . (0.6 0.5).8 3.6.8 5.6.16 | 7.6.4`;

describe('alphaTex serialization', () => {
  it('parses a riff', () => {
    const score = fromAlphaTex(RIFF);
    expect(score.title).toBe('Riff');
    expect(score.tempo).toBe(180);
    expect(score.masterBars.length).toBe(2);
    expect(score.tracks[0].staves[0].stringTuning.tunings).toEqual([64, 59, 55, 50, 45, 40]);
  });

  it('round-trips notes, duration, tuning and effects', () => {
    const score = fromAlphaTex(RIFF);
    const beat = score.tracks[0].staves[0].bars[0].voices[0].beats[0];
    beat.notes[0].isPalmMute = true;
    beat.notes[0].isGhost = true;

    const back = fromAlphaTex(toAlphaTex(score));
    const rt = back.tracks[0].staves[0].bars[0].voices[0].beats[0];

    expect(back.title).toBe('Riff');
    expect(back.tempo).toBe(180);
    expect(back.masterBars.length).toBe(2);
    expect(back.tracks[0].staves[0].stringTuning.tunings).toEqual([64, 59, 55, 50, 45, 40]);
    expect(rt.duration).toBe(beat.duration);
    expect(rt.notes.map((n) => [n.string, n.fret])).toEqual(
      beat.notes.map((n) => [n.string, n.fret])
    );
    expect(rt.notes[0].isPalmMute).toBe(true);
    expect(rt.notes[0].isGhost).toBe(true);
  });

  it('reports parser diagnostics instead of an opaque error', () => {
    try {
      fromAlphaTex(`\\title "Broken" . 0.6.8{pm}`);
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AlphaTexParseError);
      expect((err as AlphaTexParseError).diagnostics.join(' ')).toContain('pm');
    }
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
pnpm vitest run src/lib/score/serialize.test.ts
```

Expected: FAIL — cannot find module `./serialize`.

- [ ] **Step 3: Implement**

`src/lib/score/serialize.ts`:

```ts
import * as alphaTab from '@coderline/alphatab';

type Score = alphaTab.model.Score;
type Settings = alphaTab.Settings;

export class AlphaTexParseError extends Error {
  constructor(
    message: string,
    readonly diagnostics: string[]
  ) {
    super(message);
    this.name = 'AlphaTexParseError';
  }
}

export function defaultSettings(): Settings {
  return new alphaTab.Settings();
}

export function fromAlphaTex(tex: string, settings: Settings = defaultSettings()): Score {
  const importer = new alphaTab.importer.AlphaTexImporter();
  importer.initFromString(tex, settings);
  try {
    return importer.readScore();
  } catch (err) {
    // The useful detail is nested; the outer error is just "check diagnostics".
    const cause = (err as { cause?: { parserDiagnostics?: { items: { message: string }[] } } })
      .cause;
    const diagnostics = cause?.parserDiagnostics?.items.map((i) => i.message) ?? [];
    throw new AlphaTexParseError(
      diagnostics[0] ?? (err as Error).message,
      diagnostics
    );
  }
}

export function toAlphaTex(score: Score, settings: Settings = defaultSettings()): string {
  const bytes = new alphaTab.exporter.AlphaTexExporter().export(score, settings);
  return new TextDecoder().decode(bytes);
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run src/lib/score/serialize.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/score/serialize.ts src/lib/score/serialize.test.ts
git commit -m "feat: alphaTex serialization with diagnostic-carrying errors"
```

---

### Task 5: Tuning catalogue

**Files:**
- Create: `src/lib/score/tuning.ts`
- Test: `src/lib/score/tuning.test.ts`

**Interfaces:**
- Consumes: `strings.ts`
- Produces:
  - `type TuningPreset = { name: string; tunings: number[] }`
  - `presetsFor(stringCount: number): TuningPreset[]`
  - `METAL_PRESETS: Record<number, TuningPreset[]>`
  - `describeTuning(tunings: number[]): string`
  - `parseTuningNames(names: string[]): number[]`

- [ ] **Step 1: Write the failing test**

`src/lib/score/tuning.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { describeTuning, parseTuningNames, presetsFor } from './tuning';

describe('tunings', () => {
  it('offers presets for 6 strings including drop tunings', () => {
    const names = presetsFor(6).map((p) => p.name);
    expect(names).toContain('Drop D');
    expect(names).toContain('Drop C');
    expect(names).toContain('Drop B');
  });

  it('offers presets for extended range instruments', () => {
    expect(presetsFor(7).length).toBeGreaterThan(0);
    expect(presetsFor(8).length).toBeGreaterThan(0);
  });

  it('offers bass presets for 4 and 5 strings', () => {
    expect(presetsFor(4).length).toBeGreaterThan(0);
    expect(presetsFor(5).length).toBeGreaterThan(0);
  });

  it('drop D lowers only the lowest string by a tone', () => {
    const dropD = presetsFor(6).find((p) => p.name === 'Drop D')!;
    expect(dropD.tunings).toEqual([64, 59, 55, 50, 45, 38]);
  });

  it('describes a tuning as note names, highest string first', () => {
    expect(describeTuning([64, 59, 55, 50, 45, 40])).toBe('E4 B3 G3 D3 A2 E2');
  });

  it('parses note names back into midi values', () => {
    expect(parseTuningNames(['E4', 'B3', 'G3', 'D3', 'A2', 'E2'])).toEqual([
      64, 59, 55, 50, 45, 40
    ]);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
pnpm vitest run src/lib/score/tuning.test.ts
```

Expected: FAIL — cannot find module `./tuning`.

- [ ] **Step 3: Implement**

`src/lib/score/tuning.ts`:

```ts
import * as alphaTab from '@coderline/alphatab';

export type TuningPreset = { name: string; tunings: number[] };

/** Metal-oriented tunings alphaTab does not ship as presets. */
export const METAL_PRESETS: Record<number, TuningPreset[]> = {
  4: [
    { name: 'Bass Standard', tunings: [43, 38, 33, 28] },
    { name: 'Bass Drop D', tunings: [43, 38, 33, 26] },
    { name: 'Bass Drop C', tunings: [41, 36, 31, 24] }
  ],
  5: [{ name: 'Bass 5 Standard', tunings: [43, 38, 33, 28, 23] }],
  6: [
    { name: 'Drop D', tunings: [64, 59, 55, 50, 45, 38] },
    { name: 'D Standard', tunings: [62, 57, 53, 48, 43, 38] },
    { name: 'Drop C', tunings: [62, 57, 53, 48, 43, 36] },
    { name: 'C# Standard', tunings: [63, 58, 54, 49, 44, 39] },
    { name: 'Drop B', tunings: [61, 56, 52, 47, 42, 35] },
    { name: 'Drop A', tunings: [59, 54, 50, 45, 40, 33] }
  ],
  7: [
    { name: '7-String Standard', tunings: [64, 59, 55, 50, 45, 40, 35] },
    { name: '7-String Drop A', tunings: [64, 59, 55, 50, 45, 38, 33] },
    { name: '7-String Drop G', tunings: [62, 57, 53, 48, 43, 36, 31] }
  ],
  8: [
    { name: '8-String Standard', tunings: [64, 59, 55, 50, 45, 40, 35, 30] },
    { name: '8-String Drop E', tunings: [64, 59, 55, 50, 45, 40, 33, 28] }
  ]
};

/** alphaTab's built-in presets, plus our metal catalogue, de-duplicated by name. */
export function presetsFor(stringCount: number): TuningPreset[] {
  alphaTab.model.Tuning.initialize();
  const builtin: TuningPreset[] = alphaTab.model.Tuning.getPresetsFor(stringCount).map((t) => ({
    name: t.name,
    tunings: [...t.tunings]
  }));
  const seen = new Set(builtin.map((p) => p.name));
  const extra = (METAL_PRESETS[stringCount] ?? []).filter((p) => !seen.has(p.name));
  return [...builtin, ...extra];
}

export function describeTuning(tunings: number[]): string {
  return tunings.map((t) => alphaTab.model.Tuning.getTextForTuning(t, true)).join(' ');
}

const NOTE_OFFSETS: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4,
  F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11
};

export function parseTuningNames(names: string[]): number[] {
  return names.map((raw) => {
    const match = /^([A-G][#b]?)(-?\d+)$/.exec(raw.trim());
    if (!match) throw new Error(`Unparseable note name: ${raw}`);
    const [, note, octave] = match;
    return (Number(octave) + 1) * 12 + NOTE_OFFSETS[note];
  });
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run src/lib/score/tuning.test.ts
```

Expected: PASS (6 tests). If `describeTuning` formats differently than `E4 B3 ...`, adjust the assertion to alphaTab's actual output rather than reimplementing note naming.

- [ ] **Step 5: Commit**

```bash
git add src/lib/score/tuning.ts src/lib/score/tuning.test.ts
git commit -m "feat: tuning presets including metal and extended-range catalogue"
```

---

### Task 6: Document creation

**Files:**
- Create: `src/lib/score/document.ts`
- Test: `src/lib/score/document.test.ts`

**Interfaces:**
- Consumes: `serialize.ts`, `tuning.ts`
- Produces:
  - `type NewScoreOptions = { title?: string; tempo?: number; stringCount?: number; tuning?: number[]; bars?: number }`
  - `createScore(options?: NewScoreOptions): Score`

- [ ] **Step 1: Write the failing test**

`src/lib/score/document.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createScore } from './document';
import { toAlphaTex, fromAlphaTex } from './serialize';

describe('createScore', () => {
  it('creates a default 6-string guitar score in standard tuning', () => {
    const score = createScore();
    const staff = score.tracks[0].staves[0];
    expect(score.tracks.length).toBe(1);
    expect(staff.stringTuning.tunings).toEqual([64, 59, 55, 50, 45, 40]);
    expect(score.masterBars.length).toBeGreaterThanOrEqual(1);
  });

  it('honours title, tempo and bar count', () => {
    const score = createScore({ title: 'Bolt Thrower', tempo: 200, bars: 4 });
    expect(score.title).toBe('Bolt Thrower');
    expect(score.tempo).toBe(200);
    expect(score.masterBars.length).toBe(4);
  });

  it('creates a 7-string score when asked', () => {
    const score = createScore({ stringCount: 7 });
    expect(score.tracks[0].staves[0].stringTuning.tunings.length).toBe(7);
  });

  it('produces a score that survives serialization', () => {
    const score = createScore({ title: 'Roundtrip', bars: 2 });
    const back = fromAlphaTex(toAlphaTex(score));
    expect(back.title).toBe('Roundtrip');
    expect(back.masterBars.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
pnpm vitest run src/lib/score/document.test.ts
```

Expected: FAIL — cannot find module `./document`.

- [ ] **Step 3: Implement**

Build the score *through alphaTex* rather than by hand-assembling the object
graph — it is far less error-prone and exercises the same path the rest of
the app uses.

`src/lib/score/document.ts`:

```ts
import * as alphaTab from '@coderline/alphatab';
import { fromAlphaTex } from './serialize';
import { describeTuning, presetsFor } from './tuning';

type Score = alphaTab.model.Score;

export type NewScoreOptions = {
  title?: string;
  tempo?: number;
  stringCount?: number;
  tuning?: number[];
  bars?: number;
};

function defaultTuningFor(stringCount: number): number[] {
  alphaTab.model.Tuning.initialize();
  const preset = alphaTab.model.Tuning.getDefaultTuningFor(stringCount);
  if (preset) return [...preset.tunings];
  return presetsFor(stringCount)[0].tunings;
}

export function createScore(options: NewScoreOptions = {}): Score {
  const {
    title = 'Untitled',
    tempo = 120,
    stringCount = 6,
    tuning = defaultTuningFor(stringCount),
    bars = 1
  } = options;

  const emptyBars = Array.from({ length: bars }, () => 'r.1').join(' | ');
  const tex =
    `\\title "${title.replace(/"/g, '\\"')}" \\tempo ${tempo} . ` +
    `\\tuning ${describeTuning(tuning)} . ${emptyBars}`;

  return fromAlphaTex(tex);
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run src/lib/score/document.test.ts
```

Expected: PASS (4 tests). If `\tuning` rejects the note-name casing produced by
`describeTuning`, lowercase it — alphaTex accepts `e4 b3 g3`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/score/document.ts src/lib/score/document.test.ts
git commit -m "feat: create new tablature documents"
```

---

### Task 7: Undo/redo history

**Files:**
- Create: `src/lib/score/history.ts`
- Test: `src/lib/score/history.test.ts`

**Interfaces:**
- Consumes: nothing (operates on opaque snapshot strings)
- Produces:
  - `type Snapshot = { tex: string; label: string }`
  - `class History` with `push(snapshot, opts?: { coalesceKey?: string }): void`, `undo(): Snapshot | undefined`, `redo(): Snapshot | undefined`, `canUndo: boolean`, `canRedo: boolean`, `constructor(initial: Snapshot, depth?: number)`

- [ ] **Step 1: Write the failing test**

`src/lib/score/history.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { History } from './history';

const snap = (tex: string, label = 'edit') => ({ tex, label });

describe('History', () => {
  let history: History;
  beforeEach(() => {
    history = new History(snap('v0', 'init'));
  });

  it('starts with nothing to undo or redo', () => {
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });

  it('undoes back to the previous snapshot', () => {
    history.push(snap('v1'));
    expect(history.canUndo).toBe(true);
    expect(history.undo()?.tex).toBe('v0');
  });

  it('redoes forward again', () => {
    history.push(snap('v1'));
    history.undo();
    expect(history.redo()?.tex).toBe('v1');
  });

  it('drops the redo branch once a new edit is pushed', () => {
    history.push(snap('v1'));
    history.undo();
    history.push(snap('v2'));
    expect(history.canRedo).toBe(false);
    expect(history.undo()?.tex).toBe('v0');
  });

  it('coalesces consecutive edits sharing a key', () => {
    history.push(snap('v1'), { coalesceKey: 'fret' });
    history.push(snap('v2'), { coalesceKey: 'fret' });
    expect(history.undo()?.tex).toBe('v0');
    expect(history.canUndo).toBe(false);
  });

  it('does not coalesce across different keys', () => {
    history.push(snap('v1'), { coalesceKey: 'fret' });
    history.push(snap('v2'), { coalesceKey: 'duration' });
    expect(history.undo()?.tex).toBe('v1');
  });

  it('caps depth, discarding the oldest entries', () => {
    const capped = new History(snap('v0'), 3);
    for (let i = 1; i <= 5; i++) capped.push(snap(`v${i}`));
    let last: string | undefined;
    while (capped.canUndo) last = capped.undo()?.tex;
    expect(last).toBe('v2');
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
pnpm vitest run src/lib/score/history.test.ts
```

Expected: FAIL — cannot find module `./history`.

- [ ] **Step 3: Implement**

`src/lib/score/history.ts`:

```ts
export type Snapshot = { tex: string; label: string };

export class History {
  private entries: Snapshot[];
  private index = 0;
  private lastCoalesceKey: string | undefined;

  constructor(initial: Snapshot, private readonly depth = 100) {
    this.entries = [initial];
  }

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index < this.entries.length - 1;
  }

  push(snapshot: Snapshot, opts: { coalesceKey?: string } = {}): void {
    const { coalesceKey } = opts;
    // Drop any redo branch.
    this.entries.length = this.index + 1;

    if (coalesceKey && coalesceKey === this.lastCoalesceKey) {
      this.entries[this.index] = snapshot;
      return;
    }

    this.entries.push(snapshot);
    this.index++;
    this.lastCoalesceKey = coalesceKey;

    if (this.entries.length > this.depth) {
      const overflow = this.entries.length - this.depth;
      this.entries.splice(0, overflow);
      this.index -= overflow;
    }
  }

  undo(): Snapshot | undefined {
    if (!this.canUndo) return undefined;
    this.index--;
    this.lastCoalesceKey = undefined;
    return this.entries[this.index];
  }

  redo(): Snapshot | undefined {
    if (!this.canRedo) return undefined;
    this.index++;
    this.lastCoalesceKey = undefined;
    return this.entries[this.index];
  }
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run src/lib/score/history.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/score/history.ts src/lib/score/history.test.ts
git commit -m "feat: snapshot-based undo/redo with coalescing and depth cap"
```

---

### Task 8: Cursor and keyboard navigation

**Files:**
- Create: `src/lib/score/cursor.ts`
- Test: `src/lib/score/cursor.test.ts`

**Interfaces:**
- Consumes: `strings.ts`
- Produces:
  - `type Cursor = { trackIndex: number; barIndex: number; voiceIndex: number; beatIndex: number; stringNumber: number }`
  - `type ScoreShape = { barCount: number; beatsPerBar: (barIndex: number) => number; stringCount: number }`
  - `moveBeat(cursor, delta, shape): Cursor`
  - `moveString(cursor, delta, shape): Cursor`
  - `clampCursor(cursor, shape): Cursor`

- [ ] **Step 1: Write the failing test**

`src/lib/score/cursor.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { clampCursor, moveBeat, moveString, type Cursor, type ScoreShape } from './cursor';

const shape: ScoreShape = { barCount: 3, beatsPerBar: () => 4, stringCount: 6 };
const at = (barIndex: number, beatIndex: number, stringNumber = 6): Cursor => ({
  trackIndex: 0,
  voiceIndex: 0,
  barIndex,
  beatIndex,
  stringNumber
});

describe('cursor navigation', () => {
  it('moves forward within a bar', () => {
    expect(moveBeat(at(0, 0), 1, shape).beatIndex).toBe(1);
  });

  it('wraps forward into the next bar', () => {
    const next = moveBeat(at(0, 3), 1, shape);
    expect(next.barIndex).toBe(1);
    expect(next.beatIndex).toBe(0);
  });

  it('wraps backward into the previous bar', () => {
    const prev = moveBeat(at(1, 0), -1, shape);
    expect(prev.barIndex).toBe(0);
    expect(prev.beatIndex).toBe(3);
  });

  it('stops at the start of the score', () => {
    expect(moveBeat(at(0, 0), -1, shape)).toEqual(at(0, 0));
  });

  it('stops at the end of the score', () => {
    expect(moveBeat(at(2, 3), 1, shape)).toEqual(at(2, 3));
  });

  it('moves up and down strings without wrapping', () => {
    // string 6 is the highest-pitched; "down" visually means a lower number
    expect(moveString(at(0, 0, 6), -1, shape).stringNumber).toBe(5);
    expect(moveString(at(0, 0, 6), 1, shape).stringNumber).toBe(6);
    expect(moveString(at(0, 0, 1), -1, shape).stringNumber).toBe(1);
  });

  it('clamps an out-of-range cursor back into the score', () => {
    const clamped = clampCursor(at(9, 9, 99), shape);
    expect(clamped.barIndex).toBe(2);
    expect(clamped.beatIndex).toBe(3);
    expect(clamped.stringNumber).toBe(6);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
pnpm vitest run src/lib/score/cursor.test.ts
```

Expected: FAIL — cannot find module `./cursor`.

- [ ] **Step 3: Implement**

`src/lib/score/cursor.ts`:

```ts
export type Cursor = {
  trackIndex: number;
  barIndex: number;
  voiceIndex: number;
  beatIndex: number;
  /** 1-based from the lowest-pitched string, matching alphaTab's note.string. */
  stringNumber: number;
};

export type ScoreShape = {
  barCount: number;
  beatsPerBar: (barIndex: number) => number;
  stringCount: number;
};

export function moveBeat(cursor: Cursor, delta: number, shape: ScoreShape): Cursor {
  let { barIndex, beatIndex } = cursor;
  let remaining = delta;

  while (remaining > 0) {
    if (beatIndex + 1 < shape.beatsPerBar(barIndex)) beatIndex++;
    else if (barIndex + 1 < shape.barCount) {
      barIndex++;
      beatIndex = 0;
    } else return { ...cursor, barIndex, beatIndex };
    remaining--;
  }

  while (remaining < 0) {
    if (beatIndex > 0) beatIndex--;
    else if (barIndex > 0) {
      barIndex--;
      beatIndex = shape.beatsPerBar(barIndex) - 1;
    } else return { ...cursor, barIndex, beatIndex };
    remaining++;
  }

  return { ...cursor, barIndex, beatIndex };
}

export function moveString(cursor: Cursor, delta: number, shape: ScoreShape): Cursor {
  const stringNumber = Math.min(shape.stringCount, Math.max(1, cursor.stringNumber + delta));
  return { ...cursor, stringNumber };
}

export function clampCursor(cursor: Cursor, shape: ScoreShape): Cursor {
  const barIndex = Math.min(shape.barCount - 1, Math.max(0, cursor.barIndex));
  const beatIndex = Math.min(shape.beatsPerBar(barIndex) - 1, Math.max(0, cursor.beatIndex));
  const stringNumber = Math.min(shape.stringCount, Math.max(1, cursor.stringNumber));
  return { ...cursor, barIndex, beatIndex, stringNumber };
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run src/lib/score/cursor.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/score/cursor.ts src/lib/score/cursor.test.ts
git commit -m "feat: cursor model with pure keyboard navigation"
```

---

### Task 9: First command — set a fret

**Files:**
- Create: `src/lib/score/commands/types.ts`, `src/lib/score/commands/setFret.ts`
- Test: `src/lib/score/commands/setFret.test.ts`

**Interfaces:**
- Consumes: `cursor.ts`, `strings.ts`, `serialize.ts`
- Produces:
  - `type CommandContext = { score: Score; settings: Settings; cursor: Cursor }`
  - `setFret(ctx: CommandContext, fret: number): void`
  - `resolveBeat(score, cursor): Beat` (in `types.ts`, reused by every later command)

- [ ] **Step 1: Write the failing test**

`src/lib/score/commands/setFret.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fromAlphaTex, defaultSettings } from '../serialize';
import type { Cursor } from '../cursor';
import { setFret } from './setFret';

const RIFF = `\\tuning e4 b3 g3 d3 a2 e2 . 0.6.8 3.6.8 5.6.8 7.6.8`;
const cursorAt = (beatIndex: number, stringNumber: number): Cursor => ({
  trackIndex: 0,
  barIndex: 0,
  voiceIndex: 0,
  beatIndex,
  stringNumber
});

function ctxFor(tex = RIFF, cursor = cursorAt(0, 1)) {
  return { score: fromAlphaTex(tex), settings: defaultSettings(), cursor };
}

const notesAt = (ctx: ReturnType<typeof ctxFor>, beatIndex: number) =>
  ctx.score.tracks[0].staves[0].bars[0].voices[0].beats[beatIndex].notes.map((n) => [
    n.string,
    n.fret
  ]);

describe('setFret', () => {
  it('changes the fret of an existing note', () => {
    const ctx = ctxFor();
    setFret(ctx, 9);
    expect(notesAt(ctx, 0)).toEqual([[1, 9]]);
  });

  it('adds a note on an empty string, forming a chord', () => {
    const ctx = ctxFor(RIFF, cursorAt(0, 2));
    setFret(ctx, 5);
    expect(notesAt(ctx, 0).sort()).toEqual([
      [1, 0],
      [2, 5]
    ]);
  });

  it('rejects a negative fret', () => {
    const ctx = ctxFor();
    expect(() => setFret(ctx, -1)).toThrow(/fret/i);
  });

  it('leaves the score consistent enough to re-serialize', () => {
    const ctx = ctxFor();
    setFret(ctx, 12);
    expect(() => ctx.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].realValue).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
pnpm vitest run src/lib/score/commands/setFret.test.ts
```

Expected: FAIL — cannot find module `./setFret`.

- [ ] **Step 3: Implement the shared command context**

`src/lib/score/commands/types.ts`:

```ts
import type * as alphaTab from '@coderline/alphatab';
import type { Cursor } from '../cursor';

export type CommandContext = {
  score: alphaTab.model.Score;
  settings: alphaTab.Settings;
  cursor: Cursor;
};

export function resolveBeat(
  score: alphaTab.model.Score,
  cursor: Cursor
): alphaTab.model.Beat {
  const beat = score.tracks[cursor.trackIndex]?.staves[0]?.bars[cursor.barIndex]
    ?.voices[cursor.voiceIndex]?.beats[cursor.beatIndex];
  if (!beat) throw new Error(`No beat at ${JSON.stringify(cursor)}`);
  return beat;
}
```

- [ ] **Step 4: Implement the command**

`src/lib/score/commands/setFret.ts`:

```ts
import * as alphaTab from '@coderline/alphatab';
import { resolveBeat, type CommandContext } from './types';

export function setFret(ctx: CommandContext, fret: number): void {
  if (!Number.isInteger(fret) || fret < 0 || fret > 36) {
    throw new Error(`Invalid fret: ${fret}`);
  }

  const beat = resolveBeat(ctx.score, ctx.cursor);
  const existing = beat.notes.find((n) => n.string === ctx.cursor.stringNumber);

  if (existing) {
    existing.fret = fret;
  } else {
    const note = new alphaTab.model.Note();
    note.string = ctx.cursor.stringNumber;
    note.fret = fret;
    beat.addNote(note);
  }

  ctx.score.finish(ctx.settings);
}
```

- [ ] **Step 5: Run the tests**

```bash
pnpm vitest run src/lib/score/commands/setFret.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/score/commands src/lib/score/commands/setFret.test.ts
git commit -m "feat: setFret command and shared command context"
```

---

### Task 10: Clear-note and set-duration commands

**Files:**
- Create: `src/lib/score/commands/clearNote.ts`, `src/lib/score/commands/setDuration.ts`
- Test: `src/lib/score/commands/clearNote.test.ts`, `src/lib/score/commands/setDuration.test.ts`

**Interfaces:**
- Consumes: `types.ts` from Task 9
- Produces:
  - `clearNote(ctx: CommandContext): void`
  - `setDuration(ctx: CommandContext, duration: alphaTab.model.Duration): void`
  - `scaleDuration(ctx: CommandContext, direction: 1 | -1): void`
  - `toggleDotted(ctx: CommandContext): void`

- [ ] **Step 1: Write the failing tests**

`src/lib/score/commands/clearNote.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import * as alphaTab from '@coderline/alphatab';
import { defaultSettings, fromAlphaTex } from '../serialize';
import { clearNote } from './clearNote';

const ctxFor = (stringNumber: number) => ({
  score: fromAlphaTex(`\\tuning e4 b3 g3 d3 a2 e2 . (0.6 0.5).8 3.6.8`),
  settings: defaultSettings(),
  cursor: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber }
});

const beat0 = (ctx: ReturnType<typeof ctxFor>) =>
  ctx.score.tracks[0].staves[0].bars[0].voices[0].beats[0];

describe('clearNote', () => {
  it('removes the note on the cursor string', () => {
    const ctx = ctxFor(1);
    clearNote(ctx);
    expect(beat0(ctx).notes.map((n) => n.string)).toEqual([2]);
  });

  it('turns the beat into a rest when the last note is removed', () => {
    const ctx = ctxFor(1);
    clearNote(ctx);
    ctx.cursor.stringNumber = 2;
    clearNote(ctx);
    expect(beat0(ctx).notes.length).toBe(0);
    expect(beat0(ctx).isRest).toBe(true);
  });

  it('is a no-op when the string is already empty', () => {
    const ctx = ctxFor(4);
    expect(() => clearNote(ctx)).not.toThrow();
    expect(beat0(ctx).notes.length).toBe(2);
  });
});
```

`src/lib/score/commands/setDuration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import * as alphaTab from '@coderline/alphatab';
import { defaultSettings, fromAlphaTex } from '../serialize';
import { scaleDuration, setDuration, toggleDotted } from './setDuration';

const ctxFor = () => ({
  score: fromAlphaTex(`\\tuning e4 b3 g3 d3 a2 e2 . 0.6.8 3.6.8`),
  settings: defaultSettings(),
  cursor: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});

const beat0 = (ctx: ReturnType<typeof ctxFor>) =>
  ctx.score.tracks[0].staves[0].bars[0].voices[0].beats[0];

describe('setDuration', () => {
  it('sets an explicit duration', () => {
    const ctx = ctxFor();
    setDuration(ctx, alphaTab.model.Duration.Sixteenth);
    expect(beat0(ctx).duration).toBe(alphaTab.model.Duration.Sixteenth);
  });

  it('halves the duration', () => {
    const ctx = ctxFor();
    scaleDuration(ctx, -1);
    expect(beat0(ctx).duration).toBe(alphaTab.model.Duration.Sixteenth);
  });

  it('doubles the duration', () => {
    const ctx = ctxFor();
    scaleDuration(ctx, 1);
    expect(beat0(ctx).duration).toBe(alphaTab.model.Duration.Quarter);
  });

  it('does not scale past the extremes', () => {
    const ctx = ctxFor();
    setDuration(ctx, alphaTab.model.Duration.Whole);
    scaleDuration(ctx, 1);
    expect(beat0(ctx).duration).toBe(alphaTab.model.Duration.Whole);
  });

  it('toggles a dot on and off', () => {
    const ctx = ctxFor();
    toggleDotted(ctx);
    expect(beat0(ctx).dots).toBe(1);
    toggleDotted(ctx);
    expect(beat0(ctx).dots).toBe(0);
  });
});
```

- [ ] **Step 2: Run them and verify they fail**

```bash
pnpm vitest run src/lib/score/commands/
```

Expected: FAIL — cannot find modules `./clearNote`, `./setDuration`.

- [ ] **Step 3: Implement `clearNote`**

`src/lib/score/commands/clearNote.ts`:

```ts
import { resolveBeat, type CommandContext } from './types';

export function clearNote(ctx: CommandContext): void {
  const beat = resolveBeat(ctx.score, ctx.cursor);
  const note = beat.notes.find((n) => n.string === ctx.cursor.stringNumber);
  if (!note) return;

  beat.removeNote(note);
  if (beat.notes.length === 0) beat.isEmpty = false; // an explicit rest, not an empty slot

  ctx.score.finish(ctx.settings);
}
```

If `beat.isRest` does not become `true` automatically once the last note is
removed, set the beat's rest state explicitly here — check the `Beat` typings
in `node_modules/@coderline/alphatab/dist/alphaTab.d.ts` for the exact
property before guessing.

- [ ] **Step 4: Implement `setDuration`**

`src/lib/score/commands/setDuration.ts`:

```ts
import * as alphaTab from '@coderline/alphatab';
import { resolveBeat, type CommandContext } from './types';

const Duration = alphaTab.model.Duration;

/** Ordered longest -> shortest. */
const LADDER = [
  Duration.Whole,
  Duration.Half,
  Duration.Quarter,
  Duration.Eighth,
  Duration.Sixteenth,
  Duration.ThirtySecond,
  Duration.SixtyFourth
];

export function setDuration(ctx: CommandContext, duration: alphaTab.model.Duration): void {
  resolveBeat(ctx.score, ctx.cursor).duration = duration;
  ctx.score.finish(ctx.settings);
}

/** direction 1 doubles the note length, -1 halves it. */
export function scaleDuration(ctx: CommandContext, direction: 1 | -1): void {
  const beat = resolveBeat(ctx.score, ctx.cursor);
  const index = LADDER.indexOf(beat.duration);
  if (index === -1) return;
  const next = LADDER[index - direction];
  if (next === undefined) return;
  beat.duration = next;
  ctx.score.finish(ctx.settings);
}

export function toggleDotted(ctx: CommandContext): void {
  const beat = resolveBeat(ctx.score, ctx.cursor);
  beat.dots = beat.dots === 1 ? 0 : 1;
  ctx.score.finish(ctx.settings);
}
```

- [ ] **Step 5: Run the tests**

```bash
pnpm vitest run src/lib/score/commands/
```

Expected: PASS (all of Task 9 and Task 10 — 12 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/score/commands
git commit -m "feat: clearNote and duration commands"
```

---

### Task 11: Metal articulation commands

**Files:**
- Create: `src/lib/score/commands/toggleArticulation.ts`
- Test: `src/lib/score/commands/toggleArticulation.test.ts`

**Interfaces:**
- Consumes: `types.ts`
- Produces:
  - `type NoteArticulation = 'palmMute' | 'deadNote' | 'ghost' | 'letRing' | 'staccato' | 'vibrato' | 'hammerPullOff'`
  - `type BeatArticulation = 'tremoloPicking'`
  - `toggleNoteArticulation(ctx: CommandContext, kind: NoteArticulation): void`
  - `toggleBeatArticulation(ctx: CommandContext, kind: BeatArticulation): void`

- [ ] **Step 1: Write the failing test**

`src/lib/score/commands/toggleArticulation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex } from '../serialize';
import { toAlphaTex } from '../serialize';
import { toggleNoteArticulation } from './toggleArticulation';

const ctxFor = () => ({
  score: fromAlphaTex(`\\tuning e4 b3 g3 d3 a2 e2 . 0.6.8 3.6.8`),
  settings: defaultSettings(),
  cursor: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});

const note0 = (ctx: ReturnType<typeof ctxFor>) =>
  ctx.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0];

describe('toggleNoteArticulation', () => {
  it('toggles palm mute on and off', () => {
    const ctx = ctxFor();
    toggleNoteArticulation(ctx, 'palmMute');
    expect(note0(ctx).isPalmMute).toBe(true);
    toggleNoteArticulation(ctx, 'palmMute');
    expect(note0(ctx).isPalmMute).toBe(false);
  });

  it('toggles dead note, ghost and let ring', () => {
    const ctx = ctxFor();
    toggleNoteArticulation(ctx, 'deadNote');
    toggleNoteArticulation(ctx, 'ghost');
    toggleNoteArticulation(ctx, 'letRing');
    expect(note0(ctx).isDead).toBe(true);
    expect(note0(ctx).isGhost).toBe(true);
    expect(note0(ctx).isLetRing).toBe(true);
  });

  it('survives a serialization round trip', () => {
    const ctx = ctxFor();
    toggleNoteArticulation(ctx, 'palmMute');
    const back = fromAlphaTex(toAlphaTex(ctx.score));
    expect(back.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].isPalmMute).toBe(true);
  });

  it('does nothing when the cursor string has no note', () => {
    const ctx = ctxFor();
    ctx.cursor.stringNumber = 4;
    expect(() => toggleNoteArticulation(ctx, 'palmMute')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
pnpm vitest run src/lib/score/commands/toggleArticulation.test.ts
```

Expected: FAIL — cannot find module `./toggleArticulation`.

- [ ] **Step 3: Implement**

`src/lib/score/commands/toggleArticulation.ts`:

```ts
import * as alphaTab from '@coderline/alphatab';
import { resolveBeat, type CommandContext } from './types';

export type NoteArticulation =
  | 'palmMute'
  | 'deadNote'
  | 'ghost'
  | 'letRing'
  | 'staccato'
  | 'vibrato'
  | 'hammerPullOff';

export type BeatArticulation = 'tremoloPicking';

export function toggleNoteArticulation(ctx: CommandContext, kind: NoteArticulation): void {
  const beat = resolveBeat(ctx.score, ctx.cursor);
  const note = beat.notes.find((n) => n.string === ctx.cursor.stringNumber);
  if (!note) return;

  switch (kind) {
    case 'palmMute':
      note.isPalmMute = !note.isPalmMute;
      break;
    case 'deadNote':
      note.isDead = !note.isDead;
      break;
    case 'ghost':
      note.isGhost = !note.isGhost;
      break;
    case 'letRing':
      note.isLetRing = !note.isLetRing;
      break;
    case 'staccato':
      note.isStaccato = !note.isStaccato;
      break;
    case 'vibrato':
      note.vibrato =
        note.vibrato === alphaTab.model.VibratoType.Slight
          ? alphaTab.model.VibratoType.None
          : alphaTab.model.VibratoType.Slight;
      break;
    case 'hammerPullOff':
      note.isHammerPullOrigin = !note.isHammerPullOrigin;
      break;
  }

  ctx.score.finish(ctx.settings);
}

export function toggleBeatArticulation(ctx: CommandContext, kind: BeatArticulation): void {
  const beat = resolveBeat(ctx.score, ctx.cursor);
  if (kind === 'tremoloPicking') {
    beat.tremoloSpeed =
      beat.tremoloSpeed === null ? alphaTab.model.Duration.ThirtySecond : null;
  }
  ctx.score.finish(ctx.settings);
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run src/lib/score/commands/toggleArticulation.test.ts
```

Expected: PASS (4 tests). If a property name differs, grep the real name out of
`node_modules/@coderline/alphatab/dist/alphaTab.d.ts` — do not guess:

```bash
grep -n "isPalmMute\|isLetRing\|isHammerPullOrigin\|tremoloSpeed" node_modules/@coderline/alphatab/dist/alphaTab.d.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/score/commands
git commit -m "feat: metal articulation toggles"
```

---

### Task 12: The editor store

**Files:**
- Create: `src/lib/score/editorStore.svelte.ts`
- Test: `src/lib/score/editorStore.test.ts`

**Interfaces:**
- Consumes: every module above
- Produces: `createEditor(options?: NewScoreOptions)` returning an object with
  `score`, `cursor`, `revision`, `canUndo`, `canRedo`, `run(label, fn, opts?)`,
  `undo()`, `redo()`, `shape()`

- [ ] **Step 1: Write the failing test**

`src/lib/score/editorStore.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { setFret } from './commands/setFret';
import { createEditor } from './editorStore.svelte';

describe('editor store', () => {
  it('starts with a blank score and no undo', () => {
    const editor = createEditor({ title: 'Test', bars: 2 });
    expect(editor.score.title).toBe('Test');
    expect(editor.canUndo).toBe(false);
  });

  it('runs a command and bumps the revision', () => {
    const editor = createEditor();
    const before = editor.revision;
    editor.run('set fret', (ctx) => setFret(ctx, 5));
    expect(editor.revision).toBeGreaterThan(before);
    expect(editor.canUndo).toBe(true);
  });

  it('undoes a command, restoring the previous score', () => {
    const editor = createEditor();
    editor.run('set fret', (ctx) => setFret(ctx, 5));
    editor.undo();
    const beat = editor.score.tracks[0].staves[0].bars[0].voices[0].beats[0];
    expect(beat.notes.length).toBe(0);
  });

  it('redoes it again', () => {
    const editor = createEditor();
    editor.run('set fret', (ctx) => setFret(ctx, 5));
    editor.undo();
    editor.redo();
    const beat = editor.score.tracks[0].staves[0].bars[0].voices[0].beats[0];
    expect(beat.notes[0].fret).toBe(5);
  });

  it('reports the score shape for cursor navigation', () => {
    const editor = createEditor({ bars: 3, stringCount: 7 });
    expect(editor.shape().barCount).toBe(3);
    expect(editor.shape().stringCount).toBe(7);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
pnpm vitest run src/lib/score/editorStore.test.ts
```

Expected: FAIL — cannot find module `./editorStore.svelte`.

- [ ] **Step 3: Implement**

`src/lib/score/editorStore.svelte.ts`:

```ts
import type * as alphaTab from '@coderline/alphatab';
import type { CommandContext } from './commands/types';
import { clampCursor, type Cursor, type ScoreShape } from './cursor';
import { createScore, type NewScoreOptions } from './document';
import { History } from './history';
import { defaultSettings, fromAlphaTex, toAlphaTex } from './serialize';

export function createEditor(options: NewScoreOptions = {}) {
  const settings = defaultSettings();

  // $state.raw: never let Svelte deep-proxy alphaTab's object graph.
  let score = $state.raw(createScore(options));
  let cursor = $state<Cursor>({
    trackIndex: 0,
    barIndex: 0,
    voiceIndex: 0,
    beatIndex: 0,
    stringNumber: 1
  });
  let revision = $state(0);

  const history = new History({ tex: toAlphaTex(score, settings), label: 'new' });
  let canUndo = $state(false);
  let canRedo = $state(false);

  function syncHistoryFlags() {
    canUndo = history.canUndo;
    canRedo = history.canRedo;
  }

  function shape(): ScoreShape {
    const staff = score.tracks[cursor.trackIndex].staves[0];
    return {
      barCount: staff.bars.length,
      beatsPerBar: (barIndex) => staff.bars[barIndex]?.voices[0]?.beats.length ?? 0,
      stringCount: staff.stringTuning.tunings.length
    };
  }

  function restore(tex: string) {
    score = fromAlphaTex(tex, settings);
    cursor = clampCursor(cursor, shape());
    revision++;
    syncHistoryFlags();
  }

  return {
    get score() {
      return score;
    },
    get cursor() {
      return cursor;
    },
    set cursor(next: Cursor) {
      cursor = next;
    },
    get revision() {
      return revision;
    },
    get canUndo() {
      return canUndo;
    },
    get canRedo() {
      return canRedo;
    },
    shape,
    run(label: string, fn: (ctx: CommandContext) => void, opts: { coalesceKey?: string } = {}) {
      fn({ score, settings, cursor });
      history.push({ tex: toAlphaTex(score, settings), label }, opts);
      revision++;
      syncHistoryFlags();
    },
    undo() {
      const snapshot = history.undo();
      if (snapshot) restore(snapshot.tex);
    },
    redo() {
      const snapshot = history.redo();
      if (snapshot) restore(snapshot.tex);
    }
  };
}
```

- [ ] **Step 4: Enable rune compilation in Vitest**

Runes in a `.svelte.ts` file need the Svelte plugin. In `vite.config.ts`, the
`sveltekit()` plugin already handles this; confirm the test run picks it up:

```bash
pnpm vitest run src/lib/score/editorStore.test.ts
```

Expected: PASS (5 tests). If runes are not compiled, add
`resolve: { conditions: ['browser'] }` to the `test` block, or move the store
to plain closures with getters (no runes) — the public interface stays identical.

- [ ] **Step 5: Commit**

```bash
git add src/lib/score/editorStore.svelte.ts src/lib/score/editorStore.test.ts
git commit -m "feat: editor store wiring commands, history and cursor"
```

---

### Task 13: App shell layout

**Files:**
- Create: `src/lib/components/panels/NotationPalette.svelte`, `src/lib/components/panels/InstrumentInspector.svelte`, `src/lib/components/panels/TrackList.svelte`, `src/lib/components/TransportBar.svelte`
- Modify: `src/routes/+page.svelte`, `src/app.css`
- Test: `e2e/shell.spec.ts`

**Interfaces:**
- Consumes: nothing yet — panels render static content in this task
- Produces: the three-pane layout every later task plugs into

- [ ] **Step 1: Build the layout**

`src/routes/+page.svelte`:

```svelte
<script lang="ts">
  import ScoreView from '$lib/components/ScoreView.svelte';
  import TransportBar from '$lib/components/TransportBar.svelte';
  import NotationPalette from '$lib/components/panels/NotationPalette.svelte';
  import InstrumentInspector from '$lib/components/panels/InstrumentInspector.svelte';
  import TrackList from '$lib/components/panels/TrackList.svelte';

  const tex = `\\title "Untitled" \\tempo 120 . \\tuning e4 b3 g3 d3 a2 e2 . r.1`;
</script>

<div class="flex h-screen flex-col bg-neutral-900 text-neutral-100">
  <TransportBar />
  <div class="flex min-h-0 flex-1">
    <aside class="w-56 shrink-0 overflow-y-auto border-r border-neutral-800" data-testid="palette">
      <NotationPalette />
    </aside>
    <main class="min-w-0 flex-1 overflow-auto bg-neutral-100" data-testid="score-pane">
      <ScoreView {tex} />
    </main>
    <aside class="w-72 shrink-0 overflow-y-auto border-l border-neutral-800" data-testid="inspector">
      <InstrumentInspector />
    </aside>
  </div>
  <footer class="h-32 shrink-0 overflow-y-auto border-t border-neutral-800" data-testid="tracks">
    <TrackList />
  </footer>
</div>
```

- [ ] **Step 2: Stub the four panel components**

Each is a titled section with placeholder buttons — real behaviour arrives in
Task 14. Example, `src/lib/components/panels/NotationPalette.svelte`:

```svelte
<section class="p-3">
  <h2 class="mb-2 text-xs font-semibold tracking-wide text-neutral-400 uppercase">Duration</h2>
  <div class="grid grid-cols-4 gap-1">
    {#each ['1', '2', '4', '8', '16', '32', '.', '3'] as label}
      <button class="rounded bg-neutral-800 px-2 py-1 text-sm hover:bg-neutral-700">{label}</button>
    {/each}
  </div>

  <h2 class="mt-4 mb-2 text-xs font-semibold tracking-wide text-neutral-400 uppercase">Articulation</h2>
  <div class="grid grid-cols-2 gap-1">
    {#each ['P.M.', 'Dead', 'Ghost', 'Let ring', 'H/P', 'Slide', 'Bend', 'Vibrato', 'Tremolo'] as label}
      <button class="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700">{label}</button>
    {/each}
  </div>
</section>
```

Build `InstrumentInspector.svelte` (instrument, string count, tuning selects),
`TrackList.svelte` (one row per track) and `TransportBar.svelte` (play/stop,
tempo, undo/redo buttons) in the same shape.

- [ ] **Step 3: Write the layout e2e test**

`e2e/shell.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('shows the three-pane editor shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('palette')).toBeVisible();
  await expect(page.getByTestId('score-pane')).toBeVisible();
  await expect(page.getByTestId('inspector')).toBeVisible();
  await expect(page.getByTestId('tracks')).toBeVisible();
});
```

- [ ] **Step 4: Run it**

```bash
pnpm test:e2e
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: three-pane editor shell"
```

---

### Task 14: Keyboard editing, end to end

**Files:**
- Create: `src/lib/editor/keymap.ts`, `src/lib/editor/dispatch.ts`
- Test: `src/lib/editor/keymap.test.ts`, `e2e/editing.spec.ts`
- Modify: `src/routes/+page.svelte`, `src/lib/components/ScoreView.svelte`, `src/lib/components/panels/NotationPalette.svelte`

**Interfaces:**
- Consumes: `editorStore.svelte.ts`, all commands
- Produces:
  - `type EditorAction = { kind: 'fret'; digit: number } | { kind: 'move'; axis: 'beat' | 'string'; delta: number } | { kind: 'clear' } | { kind: 'scaleDuration'; direction: 1 | -1 } | { kind: 'dotted' } | { kind: 'articulation'; name: NoteArticulation } | { kind: 'undo' } | { kind: 'redo' }`
  - `resolveKey(event: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): EditorAction | undefined`
  - `applyAction(editor, action): void`

- [ ] **Step 1: Write the failing keymap test**

`src/lib/editor/keymap.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveKey } from './keymap';

const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {}) =>
  resolveKey({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, ...mods });

describe('keymap', () => {
  it('maps digits to frets', () => {
    expect(key('7')).toEqual({ kind: 'fret', digit: 7 });
  });

  it('maps arrows to movement', () => {
    expect(key('ArrowRight')).toEqual({ kind: 'move', axis: 'beat', delta: 1 });
    expect(key('ArrowUp')).toEqual({ kind: 'move', axis: 'string', delta: 1 });
  });

  it('maps backspace and delete to clear', () => {
    expect(key('Backspace')).toEqual({ kind: 'clear' });
    expect(key('Delete')).toEqual({ kind: 'clear' });
  });

  it('maps +/- to duration scaling', () => {
    expect(key('+')).toEqual({ kind: 'scaleDuration', direction: 1 });
    expect(key('-')).toEqual({ kind: 'scaleDuration', direction: -1 });
  });

  it('maps articulation letters', () => {
    expect(key('p')).toEqual({ kind: 'articulation', name: 'palmMute' });
    expect(key('x')).toEqual({ kind: 'articulation', name: 'deadNote' });
  });

  it('maps undo and redo', () => {
    expect(key('z', { ctrlKey: true })).toEqual({ kind: 'undo' });
    expect(key('z', { ctrlKey: true, shiftKey: true })).toEqual({ kind: 'redo' });
  });

  it('ignores unmapped keys', () => {
    expect(key('F5')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
pnpm vitest run src/lib/editor/keymap.test.ts
```

Expected: FAIL — cannot find module `./keymap`.

- [ ] **Step 3: Implement the keymap**

`src/lib/editor/keymap.ts`:

```ts
import type { NoteArticulation } from '$lib/score/commands/toggleArticulation';

export type EditorAction =
  | { kind: 'fret'; digit: number }
  | { kind: 'move'; axis: 'beat' | 'string'; delta: number }
  | { kind: 'clear' }
  | { kind: 'scaleDuration'; direction: 1 | -1 }
  | { kind: 'dotted' }
  | { kind: 'articulation'; name: NoteArticulation }
  | { kind: 'undo' }
  | { kind: 'redo' };

const ARTICULATIONS: Record<string, NoteArticulation> = {
  p: 'palmMute',
  x: 'deadNote',
  g: 'ghost',
  l: 'letRing',
  h: 'hammerPullOff',
  v: 'vibrato'
};

export function resolveKey(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): EditorAction | undefined {
  const { key, ctrlKey, metaKey, shiftKey } = event;
  const mod = ctrlKey || metaKey;

  if (mod && key.toLowerCase() === 'z') return shiftKey ? { kind: 'redo' } : { kind: 'undo' };
  if (mod && key.toLowerCase() === 'y') return { kind: 'redo' };
  if (mod) return undefined;

  if (/^[0-9]$/.test(key)) return { kind: 'fret', digit: Number(key) };

  switch (key) {
    case 'ArrowRight': return { kind: 'move', axis: 'beat', delta: 1 };
    case 'ArrowLeft': return { kind: 'move', axis: 'beat', delta: -1 };
    case 'ArrowUp': return { kind: 'move', axis: 'string', delta: 1 };
    case 'ArrowDown': return { kind: 'move', axis: 'string', delta: -1 };
    case 'Backspace':
    case 'Delete': return { kind: 'clear' };
    case '+': return { kind: 'scaleDuration', direction: 1 };
    case '-': return { kind: 'scaleDuration', direction: -1 };
    case '.': return { kind: 'dotted' };
  }

  const articulation = ARTICULATIONS[key.toLowerCase()];
  return articulation ? { kind: 'articulation', name: articulation } : undefined;
}
```

- [ ] **Step 4: Run the keymap tests**

```bash
pnpm vitest run src/lib/editor/keymap.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: Implement the dispatcher**

`src/lib/editor/dispatch.ts` translates an `EditorAction` into `editor.run(...)`
calls. Multi-digit frets (typing `1` then `2` for fret 12) are handled with a
short-lived pending-digit buffer, and consecutive fret edits pass
`{ coalesceKey: 'fret' }` so they collapse into one undo entry:

```ts
import { clearNote } from '$lib/score/commands/clearNote';
import { scaleDuration, toggleDotted } from '$lib/score/commands/setDuration';
import { setFret } from '$lib/score/commands/setFret';
import { toggleNoteArticulation } from '$lib/score/commands/toggleArticulation';
import { moveBeat, moveString } from '$lib/score/cursor';
import type { createEditor } from '$lib/score/editorStore.svelte';
import type { EditorAction } from './keymap';

type Editor = ReturnType<typeof createEditor>;

let pendingDigits = '';
let pendingTimer: ReturnType<typeof setTimeout> | undefined;

export function applyAction(editor: Editor, action: EditorAction): void {
  switch (action.kind) {
    case 'fret': {
      clearTimeout(pendingTimer);
      const candidate = pendingDigits + String(action.digit);
      const fret = Number(candidate) <= 36 && candidate.length <= 2 ? Number(candidate) : action.digit;
      pendingDigits = candidate.length < 2 && Number(candidate) <= 2 ? candidate : '';
      pendingTimer = setTimeout(() => (pendingDigits = ''), 700);
      editor.run('fret', (ctx) => setFret(ctx, fret), { coalesceKey: 'fret' });
      break;
    }
    case 'move':
      pendingDigits = '';
      editor.cursor =
        action.axis === 'beat'
          ? moveBeat(editor.cursor, action.delta, editor.shape())
          : moveString(editor.cursor, action.delta, editor.shape());
      break;
    case 'clear':
      editor.run('clear note', clearNote);
      break;
    case 'scaleDuration':
      editor.run('duration', (ctx) => scaleDuration(ctx, action.direction));
      break;
    case 'dotted':
      editor.run('dotted', toggleDotted);
      break;
    case 'articulation':
      editor.run(action.name, (ctx) => toggleNoteArticulation(ctx, action.name));
      break;
    case 'undo':
      editor.undo();
      break;
    case 'redo':
      editor.redo();
      break;
  }
}
```

- [ ] **Step 6: Wire the store, keyboard and re-render into the page**

`ScoreView.svelte` gains `score` and `revision` props; an `$effect` calls
`api.renderScore(score)` whenever `revision` changes. alphaTab does **not**
observe model mutations, so this explicit re-render is required.

```svelte
<script lang="ts">
  import * as alphaTab from '@coderline/alphatab';
  import { onMount } from 'svelte';

  let { score, revision }: { score: alphaTab.model.Score; revision: number } = $props();
  let host: HTMLDivElement;
  let api: alphaTab.AlphaTabApi | undefined;

  onMount(() => {
    api = new alphaTab.AlphaTabApi(host, {
      core: { fontDirectory: '/font/' },
      display: { staveProfile: 'ScoreTab' }
    });
    api.renderScore(score, [0]);
    return () => api?.destroy();
  });

  $effect(() => {
    revision;
    api?.renderScore(score, [0]);
  });
</script>

<div bind:this={host} data-testid="score-view" class="alphatab-host"></div>
```

In `+page.svelte`, create the editor, attach a `window` keydown listener that
calls `resolveKey` then `applyAction`, and `preventDefault()` on a match.
Wire the palette buttons to the same `applyAction` calls.

- [ ] **Step 7: Write the editing e2e test**

`e2e/editing.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('types a note and undoes it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('score-view').locator('svg').first()).toBeVisible({
    timeout: 15_000
  });

  await page.keyboard.press('7');
  await expect(page.getByTestId('score-view')).toContainText('7');

  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('score-view')).not.toContainText('7');
});
```

- [ ] **Step 8: Run the full suite**

```bash
pnpm test && pnpm check && pnpm test:e2e
```

Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: keyboard-driven tablature editing with undo"
```

---

### Task 15: Deploy to Vercel

**Files:**
- Create: `vercel.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: the working app
- Produces: a live preview deployment

- [ ] **Step 1: Add the typed Vercel config**

```bash
pnpm add -D @vercel/config
```

`vercel.ts`:

```ts
import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'sveltekit',
  buildCommand: 'pnpm build'
};
```

- [ ] **Step 2: Confirm the production build is clean**

```bash
pnpm build
```

Expected: success, with alphaTab's worker/worklet/font/soundfont assets present in the build output.

- [ ] **Step 3: Deploy a preview**

```bash
pnpm dlx vercel@latest deploy
```

- [ ] **Step 4: Verify the deployed app**

Open the preview URL. Confirm the score renders (fonts loaded — no missing-glyph
boxes) and that typing a fret number works. Font or worker 404s here mean the
alphaTab Vite plugin's assets were not emitted; fix the plugin ordering in
`vite.config.ts` rather than copying files by hand.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: vercel deployment config"
```

---

## Phase 1 Done When

- `pnpm test`, `pnpm check` and `pnpm test:e2e` all pass
- The app opens directly on a blank guitar tablature in the three-pane shell
- Arrow keys move a cursor; digits write frets; `+`/`-` change durations
- Palm mute, dead note, ghost, let ring, hammer/pull and vibrato toggle
- Ctrl+Z / Ctrl+Shift+Z undo and redo
- A preview deployment renders and edits correctly

## Next Phases

Each gets its own spec-derived plan document:

- **Phase 2** — Instrument panel: string count, tuning presets and custom tunings, MIDI program, capo; bass tracks
- **Phase 3** — Playback: alphaSynth transport, cursor follow, looping, metronome, count-in, custom soundfont upload
- **Phase 4** — Persistence: `ScoreStore` + IndexedDB, autosave, document list
- **Phase 5** — Drums: percussion staff, drum map palette, drum-specific editing
- **Phase 6** — Interop: Guitar Pro import, `.gp` / MIDI / alphaTex export
- **Phase 7** — v2 tone: Web Audio amp-sim chain
