import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex } from '../serialize';
import { toAlphaTex } from '../serialize';
import { toggleNoteArticulation } from './toggleArticulation';

const ctxFor = () => ({
	score: fromAlphaTex(`\\tuning e4 b3 g3 d3 a2 e2 . 0.6.8 3.6.8`),
	settings: defaultSettings(),
	cursor: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber: 1 }
});

const note0 = (ctx: ReturnType<typeof ctxFor>) =>
	ctx.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0];

describe('toggleNoteArticulation', () => {
	it('toggles palm mute on and off', () => {
		const ctx = ctxFor();
		toggleNoteArticulation(ctx, 'palmMute');
		expect(note0(ctx).isPalmMute).toBe(true);
		toggleNoteArticulation(ctx, 'palmMute');
		expect(note0(ctx).isPalmMute).toBe(false);
	});

	it('toggles dead note, ghost and let ring', () => {
		const ctx = ctxFor();
		toggleNoteArticulation(ctx, 'deadNote');
		toggleNoteArticulation(ctx, 'ghost');
		toggleNoteArticulation(ctx, 'letRing');
		expect(note0(ctx).isDead).toBe(true);
		expect(note0(ctx).isGhost).toBe(true);
		expect(note0(ctx).isLetRing).toBe(true);
	});

	it('survives a serialization round trip', () => {
		const ctx = ctxFor();
		toggleNoteArticulation(ctx, 'palmMute');
		const back = fromAlphaTex(toAlphaTex(ctx.score));
		expect(back.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].isPalmMute).toBe(true);
	});

	it('does nothing when the cursor string has no note', () => {
		const ctx = ctxFor();
		ctx.cursor.stringNumber = 4;
		expect(() => toggleNoteArticulation(ctx, 'palmMute')).not.toThrow();
	});
});
