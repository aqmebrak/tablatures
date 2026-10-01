import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex, toAlphaTex } from '../serialize';
import { insertBar } from './insertBar';

const TWO_TRACKS =
	'\\tempo 90 . \\track "A" \\tuning e4 b3 g3 d3 a2 e2 . 1.6.1 | 2.6.1 | 3.6.1 ' +
	'\\track "B" \\tuning g2 d2 a1 e1 . 1.4.1 | 2.4.1 | 3.4.1';

const ctxAt = (barIndex: number, tex = TWO_TRACKS) => ({
	score: fromAlphaTex(tex),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});

/** First fret of each bar, or 'r' for a rest bar. */
const barsOf = (score: ReturnType<typeof fromAlphaTex>, trackIndex: number) =>
	score.tracks[trackIndex].staves[0].bars.map((b) => {
		const note = b.voices[0].beats[0].notes[0];
		return note ? String(note.fret) : 'r';
	});

describe('insertBar', () => {
	it('inserts an empty bar after the cursor bar in every track and returns its index', () => {
		const ctx = ctxAt(0);
		expect(insertBar(ctx)).toBe(1);
		expect(barsOf(ctx.score, 0)).toEqual(['1', 'r', '2', '3']);
		expect(barsOf(ctx.score, 1)).toEqual(['1', 'r', '2', '3']);
	});

	it('appends when the cursor is on the last bar, and survives a round-trip', () => {
		const ctx = ctxAt(2);
		expect(insertBar(ctx)).toBe(3);
		const back = fromAlphaTex(toAlphaTex(ctx.score, ctx.settings));
		expect(barsOf(back, 0)).toEqual(['1', '2', '3', 'r']);
		expect(barsOf(back, 1)).toEqual(['1', '2', '3', 'r']);
	});

	it('copies the time signature of the cursor bar', () => {
		const ctx = ctxAt(
			0,
			'\\ts 3 4 \\tuning e4 b3 g3 d3 a2 e2 . 1.6.4 1.6.4 1.6.4 | 2.6.4 2.6.4 2.6.4'
		);
		insertBar(ctx);
		expect(ctx.score.masterBars[1].timeSignatureNumerator).toBe(3);
		expect(ctx.score.masterBars[1].timeSignatureDenominator).toBe(4);
	});
});
