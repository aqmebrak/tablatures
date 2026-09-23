import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex } from '../serialize';
import { advanceOrInsertBeat } from './advanceOrInsertBeat';

const ctxFor = (tex: string, beatIndex = 0, barIndex = 0) => ({
	score: fromAlphaTex(tex),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex, voiceIndex: 0, beatIndex, stringNumber: 1 }
});

const beatsIn = (ctx: ReturnType<typeof ctxFor>, barIndex: number) =>
	ctx.score.tracks[0].staves[0].bars[barIndex].voices[0].beats;

describe('advanceOrInsertBeat', () => {
	it('moves onto an existing beat without mutating the score', () => {
		// bar 0 already has two quarter-note beats; bar 1 is a single whole rest.
		const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 . 0.6.4 3.6.4 | r.1');
		const before = beatsIn(ctx, 0).length;

		const cursor = advanceOrInsertBeat(ctx);

		expect(beatsIn(ctx, 0).length).toBe(before); // no mutation
		expect(cursor).toEqual({
			trackIndex: 0,
			barIndex: 0,
			voiceIndex: 0,
			beatIndex: 1,
			stringNumber: 1
		});
	});

	it('inserts a new rest beat when the bar has capacity left', () => {
		// One quarter note (960 ticks) in a 4/4 bar (3840 ticks) leaves plenty of room.
		const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 . 0.6.4 | r.1');

		const cursor = advanceOrInsertBeat(ctx);

		const beats = beatsIn(ctx, 0);
		expect(beats.length).toBe(2);
		expect(beats[1].notes.length).toBe(0); // inserted beat is a rest
		expect(beats[1].duration).toBe(beats[0].duration); // inherits the current beat's duration
		expect(cursor).toEqual({
			trackIndex: 0,
			barIndex: 0,
			voiceIndex: 0,
			beatIndex: 1,
			stringNumber: 1
		});
	});

	it('advances to the next bar once the current bar is exactly full', () => {
		// Four quarter notes (960 ticks each) exactly fill a 4/4 bar (3840 ticks).
		const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 . 0.6.4 0.6.4 0.6.4 0.6.4 | r.1', 3, 0);
		const before = beatsIn(ctx, 0).length;

		const cursor = advanceOrInsertBeat(ctx);

		expect(beatsIn(ctx, 0).length).toBe(before); // no mutation to the full bar
		expect(cursor).toEqual({
			trackIndex: 0,
			barIndex: 1,
			voiceIndex: 0,
			beatIndex: 0,
			stringNumber: 1
		});
	});

	it('is a no-op at the end of the document (last bar, full)', () => {
		// A single 4/4 bar, exactly full, and no bar after it.
		const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 . 0.6.4 0.6.4 0.6.4 0.6.4', 3, 0);
		const before = beatsIn(ctx, 0).length;

		const cursor = advanceOrInsertBeat(ctx);

		expect(beatsIn(ctx, 0).length).toBe(before);
		expect(cursor).toEqual(ctx.cursor);
	});

	it('leaves the score consistent enough to re-serialize after inserting', () => {
		const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 . 0.6.4 | r.1');
		advanceOrInsertBeat(ctx);
		expect(() => beatsIn(ctx, 0)[1].notes).not.toThrow();
	});
});
