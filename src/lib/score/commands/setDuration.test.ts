import { describe, expect, it } from 'vitest';
import * as alphaTab from '@coderline/alphatab';
import { defaultSettings, fromAlphaTex } from '../serialize';
import { scaleDuration, setDuration, toggleDotted } from './setDuration';

const ctxFor = () => ({
	score: fromAlphaTex(`\\tuning e4 b3 g3 d3 a2 e2 . 0.6.8 3.6.8`),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});

const beat0 = (ctx: ReturnType<typeof ctxFor>) =>
	ctx.score.tracks[0].staves[0].bars[0].voices[0].beats[0];

describe('setDuration', () => {
	it('sets an explicit duration', () => {
		const ctx = ctxFor();
		setDuration(ctx, alphaTab.model.Duration.Sixteenth);
		expect(beat0(ctx).duration).toBe(alphaTab.model.Duration.Sixteenth);
	});

	it('halves the duration', () => {
		const ctx = ctxFor();
		scaleDuration(ctx, -1);
		expect(beat0(ctx).duration).toBe(alphaTab.model.Duration.Sixteenth);
	});

	it('doubles the duration', () => {
		const ctx = ctxFor();
		scaleDuration(ctx, 1);
		expect(beat0(ctx).duration).toBe(alphaTab.model.Duration.Quarter);
	});

	it('does not scale past the extremes', () => {
		const ctx = ctxFor();
		setDuration(ctx, alphaTab.model.Duration.Whole);
		scaleDuration(ctx, 1);
		expect(beat0(ctx).duration).toBe(alphaTab.model.Duration.Whole);
	});

	it('toggles a dot on and off', () => {
		const ctx = ctxFor();
		toggleDotted(ctx);
		expect(beat0(ctx).dots).toBe(1);
		toggleDotted(ctx);
		expect(beat0(ctx).dots).toBe(0);
	});
});
