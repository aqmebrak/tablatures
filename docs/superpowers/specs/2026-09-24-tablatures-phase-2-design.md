# Phase 2: Instruments, Tracks and Bars — Design Spec

**Date:** 2026-09-24
**Status:** Approved in conversation; awaiting written-spec review
**Follows:** `docs/superpowers/specs/2026-09-17-tablatures-design.md` (roadmap Phase 2)

## Context

Phase 1 shipped a single guitar track with a fixed 8 bars, a fixed E Standard
tuning and a mock instrument panel. The roadmap's Phase 2 is "Instrument
panel: tunings, string counts, MIDI program; bass". In brainstorming, the
scope grew to include multiple tracks and adding or removing bars. Both
change the score's structure, and bars are shared across tracks, so they
belong together.

## Goals

- **Multiple tracks.** Add guitar or bass tracks, select one, rename or
  remove it.
- **Tuning per track.** Pick a preset for the current string count, or edit
  each string by a semitone at a time. Existing notes keep their frets.
- **String count per track, from 4 to 8.** Strings are added and removed at
  the low end, and notes stay on their physical strings.
- **Sound per track.** A MIDI program from a curated metal list. It is
  stored now and heard in Phase 3.
- **Bars.** Insert a bar after the cursor and delete the current bar, in all
  tracks. ArrowRight at the end of a full last bar appends a new bar.
- **Undo.** Everything is undoable through the existing `editor.run` and
  history.

## Non-Goals

- Drums and percussion tracks (Phase 5). "Drums" appears in the Sound select
  but is disabled.
- Hearing anything (Phase 3).
- A "keep pitch" retune that re-frets notes.
- Reordering tracks, editing time signatures, or showing several tracks on
  screen at once.
- The full 128-program General MIDI list.

## Decisions (from brainstorming)

| Question | Decision |
| --- | --- |
| Multi-track in this phase? | Yes |
| Notes when the tuning changes | Keep frets; the sounding pitch moves |
| Notes on a string that is removed | Deleted. This is undoable, and a notice shows the count |
| Custom tuning editor | One row per string with ▲/▼ semitone steppers |
| Bar insert/delete | Included |
| MIDI program list | Curated metal list |
| Structural mutation approach | In-place mutation with a shared `relink` helper (see Architecture) |
| Tracks shown on screen | Only the selected track, like Guitar Pro |

## Verified alphaTab facts (probed on 1.8.4)

1. **Multi-track alphaTex round-trips.** Track name, `playbackInfo.program`,
   `staff.stringTuning.tunings` and `showStandardNotation` all survive
   `toAlphaTex` followed by `fromAlphaTex`.
2. **The program lives in two places.** The importer and exporter keep the
   program on the track (`playbackInfo.program`) and also as an `Instrument`
   automation (`AutomationType` value `2`) on the track's first beat, which
   is exported as `{instrument distortionguitar}`. Changing only
   `playbackInfo.program` leaves the stale automation in place, and playback
   would use it. `setProgram` must update both.
3. **A string-count change moves notes unless they are renumbered.**
   `note.string` counts from the lowest string. Appending a low string
   (6→7) without renumbering moved a note from alphaTex `0.6` (low E) to
   `0.7`, onto the new low string. To keep a note on its physical string,
   `note.string` must shift by the number of strings added or removed.
4. **Mid-score bar insertion works in place.** It takes these steps:
   - Splice a new `MasterBar` into `score.masterBars`, and a new `Bar` (one
     `Voice`, one whole-rest `Beat`) into every staff's `bars`.
   - Re-index and relink (`index`, `previousMasterBar`/`nextMasterBar`,
     `previousBar`/`nextBar`, and `masterBar.score` / `bar.staff`).
   - Call `score.finish()`.

   Bar contents keep their order through a round-trip, and
   `masterBar.start` is recomputed (0, 3840, 7680, …).
5. **A track can be added in code.** The steps are `new Track()`, set
   `playbackInfo.program` and the primary/secondary channels, then
   `addStaff`. Set its `stringTuning`, then add one bar per existing master
   bar, then `score.addTrack` and `finish()`. This round-trips.
6. **The Phase 1 default score has program 25 (Acoustic Steel).** The
   default track should be Distortion Guitar.

## Architecture

### Structural commands mutate in place

Every change still goes through `src/lib/score/commands/`, as the Command
Layer Rule requires. Structural edits splice arrays, then call one helper
that restores the model's links.

`src/lib/score/commands/structure.ts` holds helpers, not commands:

- `relinkMasterBars(score)`: re-indexes master bars and relinks their
  previous/next pointers and `score`.
- `relinkBars(staff)`: does the same for a staff's bars, plus `staff`.
- `emptyBar(staff)`: builds a `Bar` holding one `Voice` with one whole-rest
  `Beat`.

The helpers get their own unit tests. The model graph could be broken in
other ways, and each was rejected:

- Editing the exported alphaTex text is fragile, because the exporter's
  output is verbose and changes between versions.
- Rebuilding the score from our own description would bring back a parallel
  model.

### Selected track

`cursor.trackIndex`, which already exists, is the selected track.

- `clampCursor` now also clamps `trackIndex` to `score.tracks.length - 1`.
- `ScoreShape` gains `trackCount`.
- Selecting a track sets the cursor to `{ trackIndex, barIndex: 0,
  beatIndex: 0, stringNumber: 1 }`. This is navigation, not a command, so it
  creates no undo entry.

`ScoreView` renders only the selected track with
`api.renderScore(score, [cursor.trackIndex])`. It re-renders when
`revision` or `cursor.trackIndex` changes. The cursor-highlight geometry is
unchanged, because only one track is on screen.

### Instrument = sound

Guitar and bass are not a separate property. The family follows from the
MIDI program: GM programs 32–39 are bass, 24–31 are guitar. The new module
`src/lib/score/instruments.ts` holds:

```ts
export type InstrumentFamily = 'guitar' | 'bass';
export const PROGRAMS: { family: InstrumentFamily; program: number; label: string }[];
//  guitar: 30 Distortion, 29 Overdriven, 27 Clean, 28 Muted, 25 Steel, 24 Nylon
//  bass:   34 Pick, 33 Finger, 35 Fretless, 38 Synth
export function familyOf(program: number): InstrumentFamily;
export const TRACK_DEFAULTS: Record<InstrumentFamily, { name: string; program: number; tunings: number[] }>;
//  guitar: "Guitar", 30, [64, 59, 55, 50, 45, 40]  (E Standard)
//  bass:   "Bass",   34, [43, 38, 33, 28]          (E1 A1 D2 G2)
```

When a track is added, it gets a unique name by suffixing a number
("Guitar 2").

### MIDI channels

Each track needs a primary and a secondary channel. Channel 9 is reserved
for percussion.

- `addTrack` allocates channels the same way the alphaTex importer does, so
  the allocation survives the re-import that happens on undo.
- The plan must verify that rule by probe.
- `canAddTrack(score)` is false once no free pair is left. With 16 channels
  and one reserved, that is 7 tracks. The plan confirms the exact number by
  probe.

### New commands (one file each)

| Command | Behavior | Refuses (no change) when |
| --- | --- | --- |
| `addTrack(ctx, family)` | Appends a track with the family defaults, one empty bar per master bar, and a tab-only staff (`showStandardNotation = false`). Returns the new track index. | `!canAddTrack` |
| `removeTrack(ctx, trackIndex)` | Removes the track, then re-indexes the remaining tracks (`track.index`). | Only one track is left |
| `renameTrack(ctx, trackIndex, name)` | Sets the name, trimmed. | The trimmed name is empty |
| `setProgram(ctx, trackIndex, program)` | Sets `playbackInfo.program` and rewrites every `Instrument` automation on the track's first beat to the new program (fact 2). | The program is not in `PROGRAMS` |
| `setTuning(ctx, trackIndex, tunings)` | Replaces `stringTuning` with the same string count. Frets stay. The label is the name of the matching preset from `presetsFor(n)` if the tuning matches one exactly, otherwise "Custom". | The length differs from the current string count |
| `setStringPitch(ctx, trackIndex, stringNumber, midi)` | Changes one string. It computes `tuningIndex` through `strings.ts`, clamps `midi` to 0–127, then relabels as in `setTuning`. | — |
| `setStringCount(ctx, trackIndex, n)` | See below. Returns `{ removedNotes }`. | `n` is outside 4–8 or equal to the current count |
| `insertBar(ctx)` | Inserts an empty bar after `cursor.barIndex` in every staff of every track. The new master bar copies the time signature of the cursor's bar. Returns the new bar index. | — |
| `deleteBar(ctx)` | Removes the master bar at `cursor.barIndex` and that bar in every staff. | Only one bar is left |

**How `setStringCount` works.** Strings are added and removed at the
low-pitched end. That is the end with the highest alphaTex string number and
`note.string` 1.

- **Growing by k:** each new lowest string is 5 semitones below the current
  lowest (E2→B1→F#1). Every note gets `note.string += k`.
- **Shrinking by k:** notes with `note.string <= k` are removed from their
  beats, and every other note gets `note.string -= k`. A beat left with no
  notes is a rest.
- The new tuning is labelled as in `setTuning`.

**Commands that change.**

- `advanceOrInsertBeat`: in the "bar full, no next bar" case, it appends a
  bar (in every track, through the shared structure helpers), moves the
  cursor there, and carries the duration over as in the existing
  untouched-next-bar rule. It never fails to advance now.
- `createScore`: the single default track gets `TRACK_DEFAULTS.guitar`,
  meaning the name "Guitar" and program 30.

**The cursor after structural edits.** Callers set the cursor from the
command's result:

- `addTrack` selects the new track.
- `removeTrack` and `deleteBar` clamp the cursor.
- `insertBar` moves the cursor to the new bar at beat 0.

### Editor and dispatch

- `editorStore.run` is unchanged, and undo covers every command.
- `restore()` already calls `clampCursor`, which now also clamps
  `trackIndex`.
- `EditorAction` gains `insertBar` and `deleteBar`.
- `keymap.ts` maps **Ctrl/Cmd+Insert** to `insertBar` and
  **Ctrl/Cmd+Delete** to `deleteBar`. Today every Ctrl key except Z and Y
  returns `undefined`, so the new checks go before that return.
- The inspector and track list call `editor.run(...)` directly, the way the
  palette calls `applyAction` today. No keyboard action is needed for them.

## UI

### InstrumentInspector (right panel, the selected track)

- **Name:** a text input. It commits `renameTrack` on blur or Enter;
  Escape reverts it. The existing form-control guard in `+page.svelte`
  keeps keystrokes out of the editor.
- **Sound:** a `<select>` with `<optgroup>` Guitar and Bass from `PROGRAMS`,
  plus a disabled "Drums (coming later)" group. On change it runs
  `setProgram`.
- **Strings:** a `<select>` from 4 to 8, now enabled. On change it runs
  `setStringCount`. If `removedNotes > 0`, an inline notice shows "N notes
  removed · Ctrl+Z to undo" and fades after about 4 s.
- **Tuning:** a `<select>` of `presetsFor(n)`, plus a disabled "Custom"
  option that shows as selected when no preset matches exactly. On change it
  runs `setTuning`.
- **String rows:** top line first, the same order as the tab. Each row
  shows the string number, the note name (`describeTuning`) and ▲/▼
  buttons. They run `setStringPitch` with coalesce key
  `pitch:<trackIndex>:<stringNumber>`, so repeated clicks on one string
  make one undo entry.
- **Focus:** after a change from a select or a stepper, focus goes back to
  `document.body`, so the arrow keys keep editing the tab.

### TrackList (bottom)

- One button per real track, labelled `<name> — Guitar|Bass`. The selected
  track is highlighted. Clicking a button selects that track.
- Each track has a small × that runs `removeTrack`. It is hidden when only
  one track exists.
- **+ Add track** opens a bits-ui `DropdownMenu` with Guitar and Bass. It is
  disabled when `!canAddTrack`.

### NotationPalette

A new "Bar" group with **Insert bar** and **Delete bar** buttons. They
dispatch the same actions as the shortcuts. Delete is disabled on the last
remaining bar.

## Error handling

- Commands refuse impossible edits by returning without mutating anything.
  `run` compares the alphaTex before and after, so a refused edit records no
  undo entry and doesn't bump `revision`.
- The UI disables controls that would be refused: remove on the last track,
  delete on the last bar, and add when no channels are left. It shows no
  error dialogs.
- Removing notes by reducing the string count is the one destructive edit.
  It is covered by undo and the notice.

## Testing

**Unit tests (strict TDD, headless, alphaTex fixtures)**

- `structure.ts`: the relink helpers keep indexes and pointers consistent
  after a splice.
- `instruments.ts`: `familyOf` and the defaults.
- `addTrack`: the bar count matches the master bars, channels are unique and
  skip 9, it round-trips, and it refuses at the cap.
- `removeTrack`: the remaining indexes are consistent, and it refuses the
  last track.
- `renameTrack`: the trimmed name is set, and an empty name is refused.
- `setProgram`: the program and the first-beat automation both change and
  survive a round-trip.
- `setTuning` and `setStringPitch`: frets are unchanged, the label is the
  preset name or "Custom", and the pitch is clamped.
- `setStringCount`:
  - 6→7: a low-E note (`note.string` 1, alphaTex `.6`) becomes
    `note.string` 2 and still exports as `.6`, because alphaTex counts from
    the top line.
  - 7→6 removes notes on the lowest string, reports the count, and shifts
    the rest.
  - It refuses counts outside 4–8.
- `insertBar` and `deleteBar`: run over two tracks, and bar contents keep
  their order through a round-trip. Delete refuses the last bar.
- `advanceOrInsertBeat`: appends a bar at the end of the score.
- `clampCursor`: clamps `trackIndex`.
- `keymap` and `dispatch`: Ctrl+Insert and Ctrl+Delete.

**e2e (small)**

1. Add a bass track: the track list shows it, the tab has 4 string lines,
   and typing `3` puts a fret on it.
2. Set Strings to 7 on the guitar: a note typed earlier is still on the same
   string row.
3. Ctrl+Insert increases the number of rendered bars.

## Documentation

Update the architecture tree in `AGENTS.md` to add `instruments.ts`,
`commands/structure.ts` and the new commands. Add a gotcha for fact 2
(program stored twice) and fact 3 (renumber notes on a string-count change).
