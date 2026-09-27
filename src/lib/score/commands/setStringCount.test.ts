import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex, toAlphaTex } from '../serialize';
import { setStringCount } from './setStringCount';

const ctxFor = (tex: string) => ({
	score: fromAlphaTex(tex),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});
const notes = (score: ReturnType<typeof fromAlphaTex>) =>
	score.tracks[0].staves[0].bars[0].voices[0].beats.map((b) =>
		b.notes.map((n) => ({ string: n.string, fret: n.fret, pitch: n.realValue }))
	);

describe('setStringCount', () => {
	it('6 -> 7 adds a low B and keeps every note on its physical string', () => {
		const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 . 3.6.4 5.1.4 r.2');
		const before = notes(ctx.score);

		expect(setStringCount(ctx, 0, 7)).toEqual({ removedNotes: 0 });

		const staff = ctx.score.tracks[0].staves[0];
		expect(staff.tuning).toEqual([64, 59, 55, 50, 45, 40, 35]);
		expect(staff.stringTuning.name).toBe('7-String Standard');
		const after = notes(ctx.score);
		expect(after[0][0]).toEqual({ ...before[0][0], string: 2 }); // low E is now string 2
		expect(after[1][0]).toEqual({ ...before[1][0], string: 7 }); // high E is now string 7
		expect(after.flat().map((n) => n.pitch)).toEqual(before.flat().map((n) => n.pitch));
	});

	it('6 -> 8 adds two strings a fourth apart (B1, F#1)', () => {
		const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 . 3.6.1');
		setStringCount(ctx, 0, 8);
		expect(ctx.score.tracks[0].staves[0].tuning).toEqual([64, 59, 55, 50, 45, 40, 35, 30]);
		expect(notes(ctx.score)[0][0].string).toBe(3);
	});

	it('7 -> 6 removes notes on the lowest string, reports them, and shifts the rest', () => {
		const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 b1 . 2.7.4 (3.6 0.7).4 5.1.2');
		const pitchesKept = [notes(ctx.score)[1][0].pitch, notes(ctx.score)[2][0].pitch];

		expect(setStringCount(ctx, 0, 6)).toEqual({ removedNotes: 2 });

		expect(ctx.score.tracks[0].staves[0].tuning).toEqual([64, 59, 55, 50, 45, 40]);
		const after = notes(ctx.score);
		expect(after[0]).toEqual([]); // the beat became a rest
		expect(after[1].map((n) => [n.string, n.fret])).toEqual([[1, 3]]);
		expect(after[2].map((n) => [n.string, n.fret])).toEqual([[6, 5]]);
		expect([after[1][0].pitch, after[2][0].pitch]).toEqual(pitchesKept);
		expect(() => fromAlphaTex(toAlphaTex(ctx.score, ctx.settings))).not.toThrow();
	});

	it('refuses counts outside 4-8 or equal to the current count', () => {
		for (const count of [3, 9, 6, 6.5]) {
			const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 . 3.6.1');
			const before = toAlphaTex(ctx.score, ctx.settings);
			expect(setStringCount(ctx, 0, count)).toEqual({ removedNotes: 0 });
			expect(toAlphaTex(ctx.score, ctx.settings)).toBe(before);
		}
	});
});
