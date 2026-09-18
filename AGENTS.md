# AGENTS.md — Tablatures

Web-based tablature editor for metal, in the spirit of Guitar Pro.
Guitar, bass and drums; arbitrary string counts and tunings; SoundFont playback.

## Stack

| | |
| --- | --- |
| Framework | SvelteKit 2.70 / **Svelte 5 (runes)** / TypeScript |
| Notation + audio | **alphaTab 1.8.4** (`@coderline/alphatab`, MPL-2.0) |
| Styling | Tailwind CSS 4 + `bits-ui` (headless primitives only) |
| Tests | Vitest (unit, headless Node) + Playwright (smoke) |
| Package manager | pnpm |
| Deploy | Vercel (`@sveltejs/adapter-vercel`) |

## Commands

```bash
pnpm dev            # dev server
pnpm build          # production build
pnpm check          # svelte-check + tsc
pnpm test           # vitest run
pnpm test:watch     # vitest watch
pnpm test:e2e       # playwright
pnpm lint           # eslint + prettier check
```

## Architecture in one paragraph

alphaTab's `Score` object **is** the document. There is no parallel model.
Everything the app can express is something alphaTab can render, play and
export. To keep that safe, all mutation is funnelled through a command layer
that owns the `finish()` + re-render + undo-snapshot discipline. Documents
are serialized as **alphaTex** (alphaTab's text markup), which doubles as the
undo-snapshot format and the test-fixture format.

```
src/lib/
  score/
    document.ts     create/describe a ScoreDoc
    strings.ts      string-numbering conversions  ← read the footgun below
    tuning.ts       presets + custom tunings + metal catalogue
    serialize.ts    toAlphaTex / fromAlphaTex
    history.ts      snapshot stack, coalescing, depth cap
    cursor.ts       cursor position + pure keyboard navigation
    commands/       ONE FILE PER COMMAND — the only code that mutates a Score
  player/           alphaSynth wiring, transport state
  storage/          ScoreStore interface + IndexedDB implementation
  components/
    ScoreView.svelte  mounts AlphaTabApi, owns re-render
    panels/           NotationPalette, InstrumentInspector, TrackList
    transport/        playback controls
```

## Rules

### 1. The Command Layer Rule

**Nothing outside `src/lib/score/commands/` mutates a `Score`.**

Components dispatch commands. Commands are the only code touching model
internals. Every command is unit-tested headlessly before it is wired to UI.
alphaTab's own docs warn that ad-hoc mutation "might fully break the
rendering pipeline"; this rule is what makes using their model as our
document safe.

Every command must call `score.finish(settings)` after mutating. This
re-consolidates derived state (tie resolution, timing, element linking).
Measured at **2.1 ms** on a 120-bar score — cheap, so never skip it as an
optimisation.

### 2. `JsonConverter` does not exist at runtime

`alphaTab.d.ts` declares `JsonConverter.scoreToJsObject` / `jsObjectToScore`.
**They are not reachable.** The public `json` namespace is exported empty in
1.8.4; the class exists only for internal Worker `postMessage`. Verified by
probe — `typeof at.json.JsonConverter === 'undefined'`.

Use `serialize.ts` (alphaTex) instead. Do not reintroduce `JsonConverter`
because the typings suggest it works.

### 3. String numbering is inverted — always use `strings.ts`

Three conventions collide, and getting it wrong silently writes notes to the
wrong string:

- `staff.stringTuning.tunings[0]` → the **highest**-pitched string (top line)
- alphaTex `fret.N` → N counts from the **top line** (`0.1` = high E)
- `note.string` → 1-based from the **lowest**-pitched string (`1` = low E)

```
note.string = stringCount - tuningIndex
```

Verified: with `\tuning e4 b3 g3 d3 a2 e2`, alphaTex `0.1` yields
`note.string === 6` (E4), and `0.6` yields `note.string === 1` (E2).

Never do this arithmetic inline in a component. `strings.ts` owns it.

### 4. Svelte 5: never deep-proxy the score

The score is a large mutable object graph with circular references. Hold it
in `$state.raw`, never plain `$state`, or Svelte's proxy will walk into
alphaTab's internals and destroy performance and correctness. Re-render is
triggered explicitly via `api.renderScore(...)` after a command runs —
alphaTab does not observe model changes.

### 5. alphaTex is the test-fixture format

Write test scores as alphaTex text, not hand-built object graphs:

```ts
const score = fromAlphaTex(
  `\\tuning e4 b3 g3 d3 a2 e2 . (0.6 0.5).8 3.6.8 5.6.16 | 7.6.4`
);
```

Gotchas found the hard way:
- Metadata block ends with ` . ` — a stray or missing `.` is a parse error
- Effects use `{...}` after the note; `{pm}` is **not** valid for palm mute.
  Setting `note.isPalmMute = true` programmatically always works.
- Parse errors surface as `UnsupportedFormatError`; the useful detail is in
  `err.cause.parserDiagnostics.items[].message` — log that, not the wrapper.

## Testing

- **Strict TDD** for `score/`, `storage/`. Failing test first, always.
  These layers are where bugs silently corrupt a user's document.
- Tests run **headless in Node** — alphaTab imports cleanly without a DOM.
- **Playwright** covers only the end-to-end skeleton: app loads, a note can
  be typed, playback starts, reload restores.
- Do **not** write tests for alphaTab's rendering. That is their library's job.

## Conventions

- Small, single-purpose files. One command per file. If a file is getting
  hard to hold in your head, split it.
- No default exports except Svelte components.
- Keyboard shortcuts live in one keymap module, not scattered across handlers.
- Commit per completed task with a passing test suite.

## Gotchas

- `AlphaTabApi` needs the first-party Vite plugin
  (`@coderline/alphatab/vite`) to place the worker, worklet, soundfont and
  Bravura font correctly. Do not hand-roll this wiring.
- The bundled soundfont is `sonivox.sf3` (954 KB) — a general-MIDI bank. Its
  distorted guitar is mediocre; that is expected and addressed by custom
  soundfont loading, not by fighting the synth.
- Audio requires a user gesture before it will start (browser autoplay
  policy). The transport must handle "not yet unlocked".
