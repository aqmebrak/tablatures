# Bar-Capacity-Aware Beat Insertion + Cursor Highlight — Design Spec

**Date:** 2026-09-22
**Status:** Approved for planning
**Follows:** `docs/superpowers/specs/2026-09-17-tablatures-design.md` (Phase 1)

## Context

Hands-on testing of the Phase 1 PR surfaced two real usability gaps that no
per-task or whole-branch review caught, because both only show up when a
human actually tries to write a riff:

1. **No visual cursor.** Nothing on screen indicates which beat/string is
   selected. Keyboard-driven editing with an invisible insertion point is
   barely usable.
2. **A bar can only ever hold one beat.** `createScore()` builds every bar
   as a single whole-rest beat (`'r.1'`), and no command can add a second
   beat to a bar. Setting a shorter duration (e.g. 16th note) just shrinks
   that one beat — it does not let the bar fill up with multiple notes the
   way every real tab/notation editor works (type notes until the bar's
   time-signature capacity, e.g. 4/4, is used up, then move to the next
   bar).

Both are fixed here, together, since they were found in the same testing
pass and both land in one PR.

## Goals

- A visible, animated highlight over the currently selected beat/string
- Typing notes fills a bar up to its time-signature capacity before moving
  to the next bar, matching standard tab-editor behavior
- Preserve every existing invariant from Phase 1: nothing outside
  `commands/` mutates a `Score`; `finish()` after every mutation; cursor
  navigation stays keyboard-first

## Non-Goals

- Inserting or removing *bars* (document-structure editing) — still Phase 2
- Auto-cleanup of an accidentally-created empty beat on ArrowLeft — an
  unfilled auto-created beat is just a rest; undo (already built) is the
  fix, not new tracking machinery
- Tuplets, mid-bar time signature changes, or anacrusis (pickup) bars —
  capacity math here uses alphaTab's own `MasterBar.calculateDuration()`
  and `Beat.displayDuration`, which already account for dots, but tuplet
  ratios are out of scope for this pass (no articulation command sets a
  tuplet yet, so there is nothing to test against)

## Part 1: Bar-Capacity-Aware Beat Insertion

### The core problem

`cursor.ts`'s `moveBeat` is a **pure** function: it takes a `Cursor` and a
`ScoreShape` (`{barCount, beatsPerBar, stringCount}`) and returns a new
`Cursor` — no score access, no mutation. This purity is exactly why it was
trivial to unit-test in Task 8. But "move right past the last existing beat,
creating a new one if the bar has room" is not navigation anymore — it is a
mutation, and per the Command Layer Rule, only code in `commands/` may
mutate a `Score`.

### Resolution: a new command owns forward-movement-with-insertion

`advanceOrInsertBeat(ctx: CommandContext): { cursor: Cursor }` in
`src/lib/score/commands/advanceOrInsertBeat.ts`. It is the only place that
decides whether moving right creates a beat.

```
resolve current bar's voice (via resolveBeat's same traversal, one level up)
if a beat already exists at beatIndex + 1 in this bar:
    return the cursor moved to that beat (no mutation)
else:
    usedTicks = sum of beats[i].displayDuration for all beats in this bar's voice
    capacityTicks = masterBar.calculateDuration()
    if usedTicks < capacityTicks:
        create a new Note-less Beat (a rest), duration = current beat's duration
        insert it into the voice after the current beat
        score.finish(settings)
        return cursor moved to the new beat (beatIndex + 1)
    else if a next bar exists:
        return cursor moved to { barIndex: barIndex + 1, beatIndex: 0 }
    else:
        return cursor unchanged (no next bar — adding bars is Phase 2)
```

`dispatch.ts`'s `'move'` case splits by direction: `delta < 0` (ArrowLeft)
keeps calling the existing pure `moveBeat` unchanged. `delta > 0` on the
beat axis calls `editor.run('advance', (ctx) => { editor.cursor =
advanceOrInsertBeat(ctx).cursor })` (exact wiring detail for the
implementation plan) — critically, this only pushes an undo entry when a
beat was actually inserted; pure navigation between existing beats must
**not** create undo noise. The command returns enough information (or the
call site can compare bar-voice beat-count before/after) to decide whether
to call `editor.run` (mutating path) or just reassign `editor.cursor`
directly (pure navigation path, exactly like today).

String-axis movement (ArrowUp/ArrowDown) is entirely unaffected.

### Data flow

```
ArrowRight pressed
  → dispatch.ts: kind='move', axis='beat', delta=1
  → does beatIndex+1 already exist in this bar? (cheap check against score, read-only)
      yes → editor.cursor = moveBeat(...)              [pure, no undo entry]
      no  → editor.run('advance', ctx => advanceOrInsertBeat(ctx))  [may mutate + finish(), pushes undo entry only if it inserted]
```

### Error handling / edge cases

- **Bar has zero remaining capacity, no next bar:** no-op, cursor stays
  put. (Same as Phase 1's current end-of-document behavior.)
- **Dotted/odd durations that don't evenly divide capacity:** not a new
  problem — `displayDuration` and `calculateDuration()` are both real
  tick counts from alphaTab, so "does the next note fit" is a plain
  integer comparison. If a user's last note would overflow by inserting
  at its inherited duration... this spec does not attempt partial-fit
  logic (e.g. auto-shrinking a note to fit remaining space). If
  `usedTicks < capacityTicks` but the *inherited* duration's ticks would
  overflow past capacity, we still insert it (alphaTab bars can display
  slightly over during editing; Guitar Pro allows this transiently too) —
  refining this is a fast-follow if it proves annoying in practice, not a
  blocker for this pass.
- **Undo:** inserting a beat is a real, separate command execution, so it
  gets its own undo entry (no coalescing with the fret/duration edits that
  precede it) — this falls out naturally from routing through `editor.run`.

### Testing

- Unit tests for `advanceOrInsertBeat` (headless, alphaTex fixtures, same
  pattern as every other command): moving within existing beats is a
  no-op mutation-wise; moving past the last beat in a non-full bar inserts
  a beat and advances; moving past the last beat in a full bar advances to
  the next bar's first beat; moving past the last beat of the last bar
  with no capacity is a true no-op.
- One e2e test: type a fret, ArrowRight repeatedly with a short duration
  set, confirm the bar visibly holds multiple distinct notes before moving
  to the next bar.

## Part 2: Cursor Highlight

### Approach

`ScoreView.svelte` already owns the `AlphaTabApi` instance and receives
`score`/`revision` as props. It will additionally receive the current
`Beat` (resolved by the caller via `resolveBeat`, the same helper commands
already use) — or, to avoid leaking a `commands/` internal into a
component, `+page.svelte` resolves the beat once and passes it down, OR
`ScoreView` receives `cursor` directly and does its own tiny lookup. (Left
to the implementation plan to pick the cleaner wiring — both are small.)

After each render (`$effect` keyed on `revision` and the resolved beat),
call `api.boundsLookup?.findBeat(beat)` → `BeatBounds.visualBounds` (a
`Bounds` with x/y/w/h, canvas-relative). Position an absolutely-positioned
overlay `<div>` inside `ScoreView`'s host container at those coordinates,
sized to match, with a CSS pulse animation.

### Edge cases

- `boundsLookup` is `null` until the first render finishes, and `findBeat`
  can return `null` if the beat isn't part of the currently rendered
  layout (shouldn't happen in practice since we always render the full
  score, but defend anyway) — hide the overlay (`display: none` /
  `visibility: hidden`) rather than rendering at a stale or zero position.
- Window resize / re-layout changes bounds — re-run the lookup on
  alphaTab's own `renderFinished`/`postRenderFinished` event (whichever
  fires after layout is stable) rather than only on `revision` change, so
  the highlight doesn't drift after a resize.

### Testing

- One e2e check: the highlight element is visible after initial load, and
  its inline position style changes after an ArrowRight press.

## File Structure

```
src/lib/score/commands/
  advanceOrInsertBeat.ts      NEW — the only command that inserts a beat
  advanceOrInsertBeat.test.ts NEW
src/lib/editor/
  dispatch.ts                 MODIFY — split move-beat handling by direction
  dispatch.test.ts            MODIFY — new coverage for the insertion path
src/lib/components/
  ScoreView.svelte            MODIFY — cursor highlight overlay
e2e/
  editing.spec.ts             MODIFY — bar-filling + highlight-moves checks
```

## Spec Self-Review

- **Placeholders:** none — every section has concrete values (tick math
  verified empirically against real alphaTab output: a 4/4 bar is 3840
  ticks, an eighth note is 480 ticks).
- **Internal consistency:** the Command Layer Rule is preserved (only
  `advanceOrInsertBeat.ts` mutates); undo semantics follow directly from
  routing insertion through `editor.run`, consistent with every other
  command.
- **Scope:** focused enough for one implementation plan — two related
  parts, ~5 files touched, no cross-cutting architecture beyond the
  pure/command split already described.
- **Ambiguity:** the "which component resolves the Beat for ScoreView"
  question is explicitly left open for the plan to decide (both options
  are small and don't affect behavior) rather than papered over.
