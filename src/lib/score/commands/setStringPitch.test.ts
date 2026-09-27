import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex } from '../serialize';
import { setStringPitch } from './setStringPitch';

const ctxFor = () => ({
	score: fromAlphaTex('\\tuning e4 b3 g3 d3 a2 e2 . 0.6.1'),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});

describe('setStringPitch', () => {
	it('changes one string (string 1 = lowest) and relabels the tuning', () => {
		const ctx = ctxFor();
		setStringPitch(ctx, 0, 1, 38);
		const staff = ctx.score.tracks[0].staves[0];
		expect(staff.tuning).toEqual([64, 59, 55, 50, 45, 38]);
		expect(staff.stringTuning.name).toBe('Drop D');
	});

	it('clamps the pitch to the MIDI range', () => {
		const ctx = ctxFor();
		setStringPitch(ctx, 0, 6, 200);
		expect(ctx.score.tracks[0].staves[0].tuning[0]).toBe(127);
		setStringPitch(ctx, 0, 1, -5);
		expect(ctx.score.tracks[0].staves[0].tuning[5]).toBe(0);
	});

	it('ignores a string number that does not exist', () => {
		const ctx = ctxFor();
		setStringPitch(ctx, 0, 7, 30);
		expect(ctx.score.tracks[0].staves[0].tuning).toEqual([64, 59, 55, 50, 45, 40]);
	});
});
