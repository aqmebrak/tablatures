import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex, toAlphaTex } from '../serialize';
import { addTrack, canAddTrack } from './addTrack';

const ctxFor = (tex: string) => ({
	score: fromAlphaTex(tex),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});
const GUITAR =
	'\\track "Guitar" \\instrument 30 \\tuning e4 b3 g3 d3 a2 e2 . 1.6.1 | 2.6.1 | 3.6.1';

describe('addTrack', () => {
	it('appends a bass track with one empty bar per master bar and returns its index', () => {
		const ctx = ctxFor(GUITAR);
		expect(addTrack(ctx, 'bass')).toBe(1);
		const bass = ctx.score.tracks[1];
		expect(bass.name).toBe('Bass');
		expect(bass.playbackInfo.program).toBe(34);
		expect(bass.staves[0].tuning).toEqual([43, 38, 33, 28]);
		expect(bass.staves[0].bars.length).toBe(3);
		expect(bass.staves[0].bars.every((b) => b.voices[0].beats[0].notes.length === 0)).toBe(true);
	});

	it('gives a second guitar a unique name and the next channel pair', () => {
		const ctx = ctxFor(GUITAR);
		addTrack(ctx, 'guitar');
		const t = ctx.score.tracks[1];
		expect(t.name).toBe('Guitar 2');
		expect([t.playbackInfo.primaryChannel, t.playbackInfo.secondaryChannel]).toEqual([2, 3]);
	});

	it('survives a round-trip with a tab-only staff, name, program and tuning', () => {
		const ctx = ctxFor(GUITAR);
		addTrack(ctx, 'bass');
		const back = fromAlphaTex(toAlphaTex(ctx.score, ctx.settings));
		const bass = back.tracks[1];
		expect(bass.name).toBe('Bass');
		expect(bass.playbackInfo.program).toBe(34);
		expect(bass.staves[0].tuning).toEqual([43, 38, 33, 28]);
		expect(bass.staves[0].showStandardNotation).toBe(false);
		expect(bass.staves[0].showTablature).toBe(true);
		expect(bass.staves[0].bars.length).toBe(3);
	});

	it('refuses once MAX_TRACKS tracks exist, leaving the score untouched', () => {
		const ctx = ctxFor(GUITAR);
		for (let i = 1; i < 8; i++) addTrack(ctx, 'guitar');
		expect(ctx.score.tracks.length).toBe(8);
		expect(canAddTrack(ctx.score)).toBe(false);
		const before = toAlphaTex(ctx.score, ctx.settings);
		expect(addTrack(ctx, 'bass')).toBeUndefined();
		expect(toAlphaTex(ctx.score, ctx.settings)).toBe(before);
	});
});
