import { describe, expect, it } from 'vitest';
import { createScore } from './document';
import { toAlphaTex, fromAlphaTex } from './serialize';

describe('createScore', () => {
	it('creates a default 6-string guitar score in standard tuning', () => {
		const score = createScore();
		const staff = score.tracks[0].staves[0];
		expect(score.tracks.length).toBe(1);
		expect(staff.stringTuning.tunings).toEqual([64, 59, 55, 50, 45, 40]);
		expect(score.masterBars.length).toBeGreaterThanOrEqual(1);
	});

	it('honours title, tempo and bar count', () => {
		const score = createScore({ title: 'Bolt Thrower', tempo: 200, bars: 4 });
		expect(score.title).toBe('Bolt Thrower');
		expect(score.tempo).toBe(200);
		expect(score.masterBars.length).toBe(4);
	});

	it('creates a 7-string score when asked', () => {
		const score = createScore({ stringCount: 7 });
		expect(score.tracks[0].staves[0].stringTuning.tunings.length).toBe(7);
	});

	it('produces a score that survives serialization', () => {
		const score = createScore({ title: 'Roundtrip', bars: 2 });
		const back = fromAlphaTex(toAlphaTex(score));
		expect(back.title).toBe('Roundtrip');
		expect(back.masterBars.length).toBe(2);
	});

	it('names the default track Guitar with a distortion sound, on the track and its first beat', () => {
		const score = createScore();
		const track = score.tracks[0];
		expect(track.name).toBe('Guitar');
		expect(track.playbackInfo.program).toBe(30);
		const automations = track.staves[0].bars[0].voices[0].beats[0].automations;
		expect(automations.filter((a) => a.type === 2).map((a) => a.value)).toEqual([30]);
	});
});
