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
		expect(
			() => ctx.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].realValue
		).not.toThrow();
	});
});
