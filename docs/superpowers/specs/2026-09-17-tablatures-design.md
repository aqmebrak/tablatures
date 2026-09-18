# Tablatures — Design Spec

**Date:** 2026-09-17
**Status:** Approved for phase 1 planning

## Context

Writing metal tablature on the web today means either paying for Guitar Pro
(desktop only) or fighting Songsterr's read-only reader. Nothing web-native
lets you *write* a riff with the articulations metal actually depends on —
palm mutes, dead notes, tremolo picking, pinch harmonics, extended-range
tunings — and hear it back.

**Tablatures** is a browser-based tablature editor in the spirit of Guitar
Pro, scoped deliberately at metal: guitar, bass and drums, arbitrary string
counts, arbitrary tunings, and playback through a MIDI soundbank.

The app opens directly on a new, empty tablature — no landing page, no
project picker. A left panel holds the notation palette, a right panel
configures the selected instrument, and the score sits between them.

## Goals

- Write and edit guitar and bass tablature with a keyboard-first workflow
- Full tuning control: presets per string count (4–8), plus custom tunings
- Metal articulation coverage as a first-class requirement, not an add-on
- Playback through a SoundFont synth, with cursor follow and looping
- Documents survive a reload; storage boundary ready for later cloud sync
- Deployable to Vercel as a static/SSR SvelteKit app

## Non-Goals (v1)

- Accounts, sharing, collaboration
- Guitar Pro / MusicXML import and export (deliberately late — see Roadmap)
- Realistic amp-modelled guitar tone (v2; see "Playback")
- Mobile-first editing (responsive viewing is fine; editing targets desktop)
- Printing and page layout polish

## Technology Decisions

### Framework: SvelteKit 2.70 / Svelte 5.57 (runes) + TypeScript

Chosen because the author is fluent in Svelte. Svelte 5 runes give explicit,
fine-grained reactivity, which matters here: the score is a large mutable
object graph that must *not* be deeply proxied. `$state.raw` is used for the
score reference so Svelte never walks into alphaTab's model.

Vercel deployment via `@sveltejs/adapter-vercel`.

### Notation engine: alphaTab 1.8.4 (`@coderline/alphatab`, MPL-2.0)

alphaTab is the load-bearing dependency. Verified capabilities (all probed
directly against 1.8.4 during design, in Node):

| Capability | API |
| --- | --- |
| Render tab + standard notation | `AlphaTabApi`, Bravura font bundled |
| Playback | `alphaSynth` — SoundFont2/SF3, Worker + AudioWorklet |
| Bundled soundfont | `sonivox.sf3` (954 KB) / `sonivox.sf2` (1.3 MB) |
| Data model | `Score > Track > Staff > Bar > Voice > Beat > Note` |
| Model consolidation | `score.finish(settings)` |
| Tunings | `Tuning.getPresetsFor(n)`, `Tuning.findTuning()`, custom ctor |
| Hit-testing | `beatMouseDown` / `noteMouseDown` / `beatMouseUp` events |
| Text format | `AlphaTexImporter` / `AlphaTexExporter` |
| Binary export | `Gp7Exporter` (writes real `.gp` files) |
| Import | Guitar Pro 3–7, MusicXML, alphaTex via `ScoreLoader` |
| Build integration | first-party **Vite plugin** (`@coderline/alphatab/vite`) |

The library imports and runs **headless in Node**, which is what makes
test-driven development of the editing core possible without a browser.

### Rejected alternatives

- **VexFlow / VexTab** — renders notation but has no playback, no Guitar Pro
  interop, and no score model to edit. We would build three quarters of
  alphaTab ourselves.
- **OpenSheetMusicDisplay** — standard notation via MusicXML; tablature is
  not its purpose.
- **Hand-rolled SVG renderer** — total control, but engraving tablature and
  rhythm notation well is a multi-year problem on its own.

## Architecture

### The central decision: alphaTab's `Score` is the document

The `Score` object *is* the source of truth. There is no parallel document
model. Everything the app can express is something alphaTab can render,
play and export — no mapping layer, no divergence, no feature modelled twice.

alphaTab's docs warn that ad-hoc mutation of the model "might fully break the
rendering pipeline due to inconsistencies". We accept the model as our
document but **never mutate it ad hoc**. Instead:

> **The Command Layer Rule.** Nothing outside `src/lib/score/commands/`
> mutates a `Score`. UI components dispatch commands; commands are the only
> code that touches model internals, and each one is unit-tested headlessly.

Each command is a pure-ish function over the score that: applies its edit,
calls `score.finish(settings)` to re-consolidate derived state (tie
resolution, timing, element linking), and returns so the caller can
re-render and push an undo snapshot. Measured cost of `finish()` on a
120-bar / 1920-beat score: **2.1 ms** — cheap enough to run after every
keystroke.

```
  Svelte UI  ──dispatch──▶  Command Layer  ──mutate + finish()──▶  Score
      ▲                           │                                  │
      │                           └──snapshot──▶ History (alphaTex)   │
      └──────────────── api.renderScore(score) ◀────────────────────  ┘
```

### Persistence and undo: alphaTex, not JSON

The obvious choice was `JsonConverter.scoreToJsObject`. **It does not exist
at runtime.** It is declared in `alphaTab.d.ts` and used internally for
Worker `postMessage`, but the public `json` namespace is exported *empty*
in 1.8.4 — verified by direct probe. Building on it would have failed
silently, well into implementation.

The replacement is better. **alphaTex — alphaTab's own text markup — is the
canonical serialization format**, via `AlphaTexExporter` / `AlphaTexImporter`,
both reachable at runtime.

Round-trip fidelity was verified: title, tempo, tuning array, string/fret
assignments, note duration, bar count, `isPalmMute` and `isGhost` all
survive export → import unchanged.

Performance on a 120-bar metal song:

| Operation | Cost |
| --- | --- |
| alphaTex export (undo snapshot) | **5.3 ms** (26.7 KB) |
| alphaTex import (undo restore) | **8.0 ms** |
| `score.finish()` | **2.1 ms** |

Snapshot-based undo/redo is therefore viable with no diffing machinery.
Snapshots are coalesced (rapid same-kind edits collapse into one entry) and
the stack is depth-capped.

Being plain text, the format is diffable, git-friendly, human-readable and
trivially debuggable — strictly better than an opaque JSON blob.

### Storage

Local-first. An IndexedDB-backed store sits behind a `ScoreStore` interface:

```ts
interface ScoreStore {
  list(): Promise<ScoreMeta[]>;
  load(id: string): Promise<StoredScore>;
  save(doc: StoredScore): Promise<void>;
  delete(id: string): Promise<void>;
}

interface StoredScore {
  id: string;          // uuid
  rev: number;         // monotonic, bumped per save
  updatedAt: number;   // epoch ms
  alphaTex: string;    // the document
}
```

`id` / `rev` / `updatedAt` exist from day one specifically so a server-backed
implementation can be swapped in later without touching the editor.

### Playback

v1 uses alphaSynth with the bundled `sonivox.sf3`, with custom SoundFont
upload so a better metal soundbank can be dropped in. v2 ("real emulated
instruments") replaces the guitar channel with a Web Audio chain — DI
samples → waveshaper distortion → convolution cab IR → EQ. v2 is explicitly
out of scope and does not constrain v1.

### String numbering (a documented footgun)

Three different conventions collide, and getting this wrong silently writes
notes to the wrong string:

- `staff.stringTuning.tunings[0]` is the **highest-pitched** string (top line)
- alphaTex `fret.N` counts N from the **top line** (`0.1` = high E)
- `note.string` is 1-based from the **lowest-pitched** string (`1` = low E)

The relationship, verified by probe: **`note.string = stringCount - tuningIndex`**

A single `stringIndex` helper module owns all conversion. No component does
this arithmetic inline.

## Component Structure

```
src/lib/
  score/
    document.ts        create/describe a ScoreDoc
    strings.ts         string-numbering conversions (the footgun above)
    tuning.ts          presets, custom tunings, metal tuning catalogue
    serialize.ts       toAlphaTex / fromAlphaTex
    history.ts         snapshot stack, coalescing, depth cap
    cursor.ts          cursor position + pure keyboard navigation
    commands/          ONE FILE PER COMMAND — the only mutators
  player/              alphaSynth wiring, transport state
  storage/             ScoreStore interface + IndexedDB implementation
  components/
    ScoreView.svelte   mounts AlphaTabApi, owns re-render
    panels/            NotationPalette, InstrumentInspector, TrackList
    transport/         playback controls
```

Files stay small and single-purpose. One command per file keeps each unit
holdable in context and independently reviewable.

## Editing Model

Keyboard-first, mirroring Guitar Pro. The left palette shows the same
actions as buttons and reflects cursor state, so nothing is keyboard-only.

```
← →   move beat            ↑ ↓   move string
0-9   type fret            ⌫     delete note
+ -   halve/double duration
.     dotted               p     palm mute
x     dead note            h     hammer-on / pull-off
b     bend                 s     slide
```

The cursor is plain data — `{ trackIndex, barIndex, voiceIndex, beatIndex,
stringNumber }` — and navigation is pure functions over it, so all movement
and boundary behaviour is unit-tested without a DOM.

## Testing Strategy

- **Vitest, strict TDD, headless Node** for everything in `src/lib/score/`,
  `storage/` — the layers where a bug silently corrupts a document.
- **alphaTex as the test-fixture format.** Tests express real riffs as text
  rather than hand-building object graphs, e.g.
  `` `\tuning e4 b3 g3 d3 a2 e2 . (0.6 0.5).8 3.6.8 5.6.16 | 7.6.4` ``
  This is internal only — it ships no import UI.
- **Playwright smoke tests** for the end-to-end path: app loads, a note can
  be typed, playback starts, a reload restores the document.
- Rendering correctness is alphaTab's responsibility and is not re-tested.

## Roadmap

Each phase is its own plan document and produces working software.

| Phase | Deliverable |
| --- | --- |
| **1** | Foundation, document core, app shell, fretted editing (guitar) |
| **2** | Instrument panel: tunings, string counts, MIDI program; bass |
| **3** | Playback: transport, cursor follow, looping, custom soundfont |
| **4** | Persistence: IndexedDB store, autosave, document list |
| **5** | Drums: percussion staff, drum map palette, drum editing |
| **6** | Interop: Guitar Pro import, `.gp` / MIDI / alphaTex export |
| **7** | v2 tone: Web Audio amp-sim chain |

Phase 1 is planned in detail in `docs/superpowers/plans/2026-09-17-tablatures-phase-1.md`.
