import { advanceOrInsertBeat } from '$lib/score/commands/advanceOrInsertBeat';
import { clearNote } from '$lib/score/commands/clearNote';
import { scaleDuration, setDuration, toggleDotted } from '$lib/score/commands/setDuration';
import { setFret } from '$lib/score/commands/setFret';
import { toggleNoteArticulation } from '$lib/score/commands/toggleArticulation';
import { moveBeat, moveString } from '$lib/score/cursor';
import type { createEditor } from '$lib/score/editorStore.svelte';
import type { EditorAction } from './keymap';

type Editor = ReturnType<typeof createEditor>;

let pendingDigits = '';
// The cursor position the buffered digit(s) above were typed at. A digit only
// "continues" the buffer (and is allowed to coalesce with it in undo history)
// when this still matches the cursor's current position — see the 'fret' case.
let pendingPosition: string | undefined;
let pendingTimer: ReturnType<typeof setTimeout> | undefined;

function resetDigitBuffer() {
	pendingDigits = '';
	pendingPosition = undefined;
	clearTimeout(pendingTimer);
}

export function applyAction(editor: Editor, action: EditorAction): void {
	if (action.kind !== 'fret') {
		resetDigitBuffer();
	}
	switch (action.kind) {
		case 'fret': {
			clearTimeout(pendingTimer);
			const { trackIndex, barIndex, voiceIndex, beatIndex, stringNumber } = editor.cursor;
			const position = `fret:${trackIndex}:${barIndex}:${voiceIndex}:${beatIndex}:${stringNumber}`;

			// True only when this keystroke genuinely completes a multi-digit
			// buffer left behind by the *immediately preceding* keystroke at this
			// exact cursor position. Moving the cursor away (the 'move' case
			// below) or letting the 700ms window lapse both clear
			// pendingDigits/pendingPosition, so this is false whenever the user
			// has stepped away — even briefly, even back to the same spot — and
			// come back, or has simply waited.
			const wasBuffering = pendingDigits !== '' && pendingPosition === position;

			const candidate = (wasBuffering ? pendingDigits : '') + String(action.digit);
			const fret =
				Number(candidate) <= 36 && candidate.length <= 2 ? Number(candidate) : action.digit;
			// A single leading digit of 0-3 can still start a valid two-digit fret
			// (30-36), so buffer it; 4+ can never lead a valid two-digit fret (40+
			// exceeds the max of 36) and must resolve immediately.
			pendingDigits = candidate.length < 2 && Number(candidate) <= 3 ? candidate : '';
			pendingPosition = pendingDigits ? position : undefined;
			pendingTimer = setTimeout(() => {
				pendingDigits = '';
				pendingPosition = undefined;
			}, 700);

			// Only a genuine buffer continuation may coalesce into the previous
			// undo entry. Anything else — the very first digit typed, or a fresh
			// edit at a position that merely *looks* the same as a stale
			// coalescing session left behind by History — must start its own
			// undo entry. Explicitly break any dangling session before pushing.
			if (!wasBuffering) editor.breakCoalesce();
			editor.run('fret', (ctx) => setFret(ctx, fret), { coalesceKey: position });
			break;
		}
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
		case 'clear':
			editor.run('clear note', clearNote);
			break;
		case 'scaleDuration':
			editor.run('duration', (ctx) => scaleDuration(ctx, action.direction));
			break;
		case 'setDuration':
			editor.run('duration', (ctx) => setDuration(ctx, action.duration));
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
