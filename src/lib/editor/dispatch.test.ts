import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEditor } from '$lib/score/editorStore.svelte';
import type { EditorAction } from './keymap';

// dispatch.ts keeps its multi-digit fret buffer as module-level state (no
// reset hook is exported), so each test re-imports a fresh module instance
// via vi.resetModules() to avoid leaking pendingDigits/pendingTimer between
// cases.
async function freshApplyAction() {
	vi.resetModules();
	const mod = await import('./dispatch');
	return mod.applyAction;
}

function currentFret(editor: ReturnType<typeof createEditor>): number | undefined {
	const { barIndex, voiceIndex, beatIndex, stringNumber } = editor.cursor;
	const beat = editor.score.tracks[0].staves[0].bars[barIndex].voices[voiceIndex].beats[beatIndex];
	return beat.notes.find((n) => n.string === stringNumber)?.fret;
}

describe('dispatch multi-digit fret buffering', () => {
	beforeEach(() => {
		vi.useRealTimers();
	});

	it('typing [1, 2] resolves the second keystroke to fret 12', async () => {
		const applyAction = await freshApplyAction();
		const editor = createEditor();

		applyAction(editor, { kind: 'fret', digit: 1 } satisfies EditorAction);
		expect(currentFret(editor)).toBe(1);

		applyAction(editor, { kind: 'fret', digit: 2 } satisfies EditorAction);
		expect(currentFret(editor)).toBe(12);
	});

	it('typing [3, 6] resolves the second keystroke to fret 36 (regression: brief used <= 2, missing 30-36)', async () => {
		const applyAction = await freshApplyAction();
		const editor = createEditor();

		applyAction(editor, { kind: 'fret', digit: 3 } satisfies EditorAction);
		expect(currentFret(editor)).toBe(3);

		applyAction(editor, { kind: 'fret', digit: 6 } satisfies EditorAction);
		expect(currentFret(editor)).toBe(36);
	});

	it('typing 9 alone resolves immediately to fret 9 with no buffering artifact', async () => {
		const applyAction = await freshApplyAction();
		const editor = createEditor();

		applyAction(editor, { kind: 'fret', digit: 9 } satisfies EditorAction);
		expect(currentFret(editor)).toBe(9);

		// A following digit must NOT combine with the un-buffered 9 (9x > 36).
		applyAction(editor, { kind: 'fret', digit: 1 } satisfies EditorAction);
		expect(currentFret(editor)).toBe(1);
	});

	it('typing [4, 0] does not buffer (40 > 36): second keystroke is a fresh fret 0', async () => {
		const applyAction = await freshApplyAction();
		const editor = createEditor();

		applyAction(editor, { kind: 'fret', digit: 4 } satisfies EditorAction);
		expect(currentFret(editor)).toBe(4);

		applyAction(editor, { kind: 'fret', digit: 0 } satisfies EditorAction);
		expect(currentFret(editor)).toBe(0);
	});

	it('coalesces the buffered digits into a single undo entry', async () => {
		const applyAction = await freshApplyAction();
		const editor = createEditor();
		const before = editor.revision;

		applyAction(editor, { kind: 'fret', digit: 1 } satisfies EditorAction);
		applyAction(editor, { kind: 'fret', digit: 2 } satisfies EditorAction);

		expect(editor.revision).toBe(before + 2); // revision bumps each run() call...
		editor.undo();
		expect(currentFret(editor)).toBeUndefined(); // ...but one undo clears both digits
	});

	it('does NOT coalesce fret edits made at different cursor positions (regression: undo granularity)', async () => {
		const applyAction = await freshApplyAction();
		// Two bars (one beat each) so ArrowRight actually moves the cursor to a
		// distinct position — the default single-bar score has only one beat.
		const editor = createEditor({ bars: 2 });

		// Type a fret at the initial cursor position (bar 0, beat 0).
		applyAction(editor, { kind: 'fret', digit: 5 } satisfies EditorAction);
		expect(currentFret(editor)).toBe(5);

		// Move the cursor to a different bar/beat.
		applyAction(editor, { kind: 'move', axis: 'beat', delta: 1 } satisfies EditorAction);

		// Type a fret at the new cursor position.
		applyAction(editor, { kind: 'fret', digit: 7 } satisfies EditorAction);
		expect(currentFret(editor)).toBe(7);

		// One undo should only revert the SECOND edit, not both.
		expect(editor.canUndo).toBe(true);
		editor.undo();
		expect(currentFret(editor)).toBeUndefined(); // second beat's fret is gone

		// Move back to the first beat to check its fret survived the first undo.
		applyAction(editor, { kind: 'move', axis: 'beat', delta: -1 } satisfies EditorAction);
		expect(currentFret(editor)).toBe(5);

		// A second undo is required to revert the first edit too.
		expect(editor.canUndo).toBe(true);
		editor.undo();
		expect(currentFret(editor)).toBeUndefined();
	});

	it('resets the stale digit buffer on an intervening non-fret, non-move action', async () => {
		const applyAction = await freshApplyAction();
		const editor = createEditor();

		applyAction(editor, { kind: 'fret', digit: 3 } satisfies EditorAction);
		expect(currentFret(editor)).toBe(3);

		// An intervening action that is neither 'fret' nor 'move' must clear the buffer.
		applyAction(editor, { kind: 'articulation', name: 'palmMute' } satisfies EditorAction);

		// Within the buffering window, a fresh digit must NOT combine with the stale '3'.
		applyAction(editor, { kind: 'fret', digit: 6 } satisfies EditorAction);
		expect(currentFret(editor)).toBe(6);
	});
});
