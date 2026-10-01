import * as alphaTab from '@coderline/alphatab';
import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex, toAlphaTex } from '../serialize';
import { setProgram } from './setProgram';

const ctxFor = () => ({
	score: fromAlphaTex('\\track "G" \\instrument 30 \\tuning e4 b3 g3 d3 a2 e2 . 0.6.4 r.2. | r.1'),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});
const firstBeatPrograms = (score: ReturnType<typeof fromAlphaTex>) =>
	score.tracks[0].staves[0].bars[0].voices[0].beats[0].automations
		.filter((a) => a.type === alphaTab.model.AutomationType.Instrument)
		.map((a) => a.value);

describe('setProgram', () => {
	it('updates the track program and the first-beat instrument automation (fact 2)', () => {
		const ctx = ctxFor();
		expect(firstBeatPrograms(ctx.score)).toEqual([30]); // precondition: stored twice
		setProgram(ctx, 0, 29);
		expect(ctx.score.tracks[0].playbackInfo.program).toBe(29);
		expect(firstBeatPrograms(ctx.score)).toEqual([29]);
	});

	it('survives a round-trip with no stale instrument', () => {
		const ctx = ctxFor();
		setProgram(ctx, 0, 34);
		const tex = toAlphaTex(ctx.score, ctx.settings);
		expect(tex).not.toMatch(/distortionguitar/);
		const back = fromAlphaTex(tex);
		expect(back.tracks[0].playbackInfo.program).toBe(34);
		expect(firstBeatPrograms(back)).toEqual([34]);
	});

	it('refuses a program outside the curated list', () => {
		const ctx = ctxFor();
		const before = toAlphaTex(ctx.score, ctx.settings);
		setProgram(ctx, 0, 0);
		expect(toAlphaTex(ctx.score, ctx.settings)).toBe(before);
	});
});
