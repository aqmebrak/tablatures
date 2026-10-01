import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex, toAlphaTex } from '../serialize';
import { setTuning } from './setTuning';

const ctxFor = () => ({
	score: fromAlphaTex('\\tuning e4 b3 g3 d3 a2 e2 . 0.6.4 3.5.4 r.2'),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});
const notes = (score: ReturnType<typeof fromAlphaTex>) =>
	score.tracks[0].staves[0].bars[0].voices[0].beats.flatMap((b) =>
		b.notes.map((n) => [n.string, n.fret])
	);

describe('setTuning', () => {
	it('retunes, keeping frets, and labels a known preset by name', () => {
		const ctx = ctxFor();
		setTuning(ctx, 0, [62, 57, 53, 48, 43, 36]);
		const staff = ctx.score.tracks[0].staves[0];
		expect(staff.tuning).toEqual([62, 57, 53, 48, 43, 36]);
		expect(staff.stringTuning.name).toBe('Drop C');
		expect(notes(ctx.score)).toEqual([
			[1, 0],
			[2, 3]
		]);
		const back = fromAlphaTex(toAlphaTex(ctx.score, ctx.settings));
		expect(back.tracks[0].staves[0].tuning).toEqual([62, 57, 53, 48, 43, 36]);
	});

	it('labels an unknown tuning Custom', () => {
		const ctx = ctxFor();
		setTuning(ctx, 0, [64, 59, 55, 50, 45, 39]);
		expect(ctx.score.tracks[0].staves[0].stringTuning.name).toBe('Custom');
	});

	it('refuses a tuning with a different string count', () => {
		const ctx = ctxFor();
		const before = toAlphaTex(ctx.score, ctx.settings);
		setTuning(ctx, 0, [64, 59, 55, 50, 45, 40, 35]);
		expect(toAlphaTex(ctx.score, ctx.settings)).toBe(before);
	});
});
