import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex, toAlphaTex } from '../serialize';
import { renameTrack } from './renameTrack';

const ctxFor = () => ({
	score: fromAlphaTex('\\track "Guitar" \\tuning e4 b3 g3 d3 a2 e2 . 1.6.1'),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});

describe('renameTrack', () => {
	it('sets the trimmed name, which survives a round-trip', () => {
		const ctx = ctxFor();
		renameTrack(ctx, 0, '  Rhythm L  ');
		expect(ctx.score.tracks[0].name).toBe('Rhythm L');
		expect(fromAlphaTex(toAlphaTex(ctx.score, ctx.settings)).tracks[0].name).toBe('Rhythm L');
	});

	it('refuses an empty or whitespace name', () => {
		const ctx = ctxFor();
		const before = toAlphaTex(ctx.score, ctx.settings);
		renameTrack(ctx, 0, '   ');
		expect(toAlphaTex(ctx.score, ctx.settings)).toBe(before);
	});
});
