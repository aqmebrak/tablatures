import { describe, expect, it } from 'vitest';
import { addTrack } from './commands/addTrack';
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
});
