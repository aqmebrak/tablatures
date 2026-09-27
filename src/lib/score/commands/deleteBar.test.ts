import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex, toAlphaTex } from '../serialize';
import { deleteBar } from './deleteBar';

const TWO_TRACKS =
	'\\tempo 90 . \\track "A" \\tuning e4 b3 g3 d3 a2 e2 . 1.6.1 | 2.6.1 | 3.6.1 ' +
	'\\track "B" \\tuning g2 d2 a1 e1 . 1.4.1 | 2.4.1 | 3.4.1';

const ctxAt = (barIndex: number, tex = TWO_TRACKS) => ({
	score: fromAlphaTex(tex),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});

const barsOf = (score: ReturnType<typeof fromAlphaTex>, trackIndex: number) =>
	score.tracks[trackIndex].staves[0].bars.map((b) => {
		const note = b.voices[0].beats[0].notes[0];
		return note ? String(note.fret) : 'r';
	});

describe('deleteBar', () => {
	it('deletes the cursor bar in every track, keeping order through a round-trip', () => {
		const ctx = ctxAt(1);
		expect(deleteBar(ctx)).toBe(true);
		const back = fromAlphaTex(toAlphaTex(ctx.score, ctx.settings));
		expect(barsOf(back, 0)).toEqual(['1', '3']);
		expect(barsOf(back, 1)).toEqual(['1', '3']);
	});

	it('keeps the tempo when the first bar is deleted (regression: tempo lived on bar 0)', () => {
		const ctx = ctxAt(0);
		deleteBar(ctx);
		expect(ctx.score.tempo).toBe(90);
		expect(fromAlphaTex(toAlphaTex(ctx.score, ctx.settings)).tempo).toBe(90);
	});

	it('refuses to delete the only bar, leaving the score untouched', () => {
		const ctx = ctxAt(0, '\\tuning e4 b3 g3 d3 a2 e2 . 1.6.1');
		const before = toAlphaTex(ctx.score, ctx.settings);
		expect(deleteBar(ctx)).toBe(false);
		expect(toAlphaTex(ctx.score, ctx.settings)).toBe(before);
	});
});
