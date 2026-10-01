import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex, toAlphaTex } from '../serialize';
import { removeTrack } from './removeTrack';

const ctxFor = (tex: string) => ({
	score: fromAlphaTex(tex),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});
const THREE =
	'\\track "A" \\tuning e4 b3 g3 d3 a2 e2 . 1.6.1 ' +
	'\\track "B" \\tuning g2 d2 a1 e1 . 2.4.1 ' +
	'\\track "C" \\tuning e4 b3 g3 d3 a2 e2 . 3.6.1';

describe('removeTrack', () => {
	it('removes the track and re-indexes the rest with the importer channel rule', () => {
		const ctx = ctxFor(THREE);
		expect(removeTrack(ctx, 0)).toBe(true);
		expect(ctx.score.tracks.map((t) => t.name)).toEqual(['B', 'C']);
		expect(ctx.score.tracks.map((t) => t.index)).toEqual([0, 1]);
		expect(ctx.score.tracks.map((t) => t.playbackInfo.primaryChannel)).toEqual([0, 2]);
		const back = fromAlphaTex(toAlphaTex(ctx.score, ctx.settings));
		expect(back.tracks.map((t) => t.name)).toEqual(['B', 'C']);
	});

	it('refuses to remove the last remaining track', () => {
		const ctx = ctxFor('\\tuning e4 b3 g3 d3 a2 e2 . 1.6.1');
		const before = toAlphaTex(ctx.score, ctx.settings);
		expect(removeTrack(ctx, 0)).toBe(false);
		expect(toAlphaTex(ctx.score, ctx.settings)).toBe(before);
	});

	it('refuses an out-of-range index', () => {
		const ctx = ctxFor(THREE);
		expect(removeTrack(ctx, 5)).toBe(false);
		expect(ctx.score.tracks.length).toBe(3);
	});
});
