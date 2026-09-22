import * as alphaTab from '@coderline/alphatab';
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

	it('toggles hammer-on/pull-off origin on and off', () => {
		// isHammerPullOrigin requires a following note to "stick" — score.finish()
		// resets it back to false if the origin note has no next note in the beat
		// sequence to hammer on/pull off to. The ctxFor() fixture has two beats
		// (0.6.8 3.6.8) specifically so beat 0's note has a beat-1 note to link to.
		const ctx = ctxFor();
		toggleNoteArticulation(ctx, 'hammerPullOff');
		expect(note0(ctx).isHammerPullOrigin).toBe(true);
		toggleNoteArticulation(ctx, 'hammerPullOff');
		expect(note0(ctx).isHammerPullOrigin).toBe(false);
	});

	it('survives a serialization round trip for hammer-on/pull-off', () => {
		const ctx = ctxFor();
		toggleNoteArticulation(ctx, 'hammerPullOff');
		const back = fromAlphaTex(toAlphaTex(ctx.score));
		expect(back.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].isHammerPullOrigin).toBe(
			true
		);
	});

	it('toggles vibrato on and off', () => {
		const ctx = ctxFor();
		expect(note0(ctx).vibrato).toBe(alphaTab.model.VibratoType.None);
		toggleNoteArticulation(ctx, 'vibrato');
		expect(note0(ctx).vibrato).toBe(alphaTab.model.VibratoType.Slight);
		toggleNoteArticulation(ctx, 'vibrato');
		expect(note0(ctx).vibrato).toBe(alphaTab.model.VibratoType.None);
	});

	it('survives a serialization round trip for vibrato', () => {
		const ctx = ctxFor();
		toggleNoteArticulation(ctx, 'vibrato');
		const back = fromAlphaTex(toAlphaTex(ctx.score));
		expect(back.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].vibrato).toBe(
			alphaTab.model.VibratoType.Slight
		);
	});
});
