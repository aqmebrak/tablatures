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
	if (action.kind !== 'fret') {
		pendingDigits = '';
		clearTimeout(pendingTimer);
	}
	switch (action.kind) {
		case 'fret': {
			clearTimeout(pendingTimer);
			const candidate = pendingDigits + String(action.digit);
			const fret =
				Number(candidate) <= 36 && candidate.length <= 2 ? Number(candidate) : action.digit;
			// A single leading digit of 0-3 can still start a valid two-digit fret
			// (30-36), so buffer it; 4+ can never lead a valid two-digit fret (40+
			// exceeds the max of 36) and must resolve immediately.
			pendingDigits = candidate.length < 2 && Number(candidate) <= 3 ? candidate : '';
			pendingTimer = setTimeout(() => (pendingDigits = ''), 700);
			const { trackIndex, barIndex, voiceIndex, beatIndex, stringNumber } = editor.cursor;
			const coalesceKey = `fret:${trackIndex}:${barIndex}:${voiceIndex}:${beatIndex}:${stringNumber}`;
			editor.run('fret', (ctx) => setFret(ctx, fret), { coalesceKey });
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
