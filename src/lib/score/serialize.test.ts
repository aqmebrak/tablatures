import { describe, expect, it } from 'vitest';
import { AlphaTexParseError, fromAlphaTex, toAlphaTex } from './serialize';

const RIFF = `\\title "Riff" \\tempo 180 . \\tuning e4 b3 g3 d3 a2 e2 . (0.6 0.5).8 3.6.8 5.6.16 | 7.6.4`;

describe('alphaTex serialization', () => {
	it('parses a riff', () => {
		const score = fromAlphaTex(RIFF);
		expect(score.title).toBe('Riff');
		expect(score.tempo).toBe(180);
		expect(score.masterBars.length).toBe(2);
		expect(score.tracks[0].staves[0].stringTuning.tunings).toEqual([64, 59, 55, 50, 45, 40]);
	});

	it('round-trips notes, duration, tuning and effects', () => {
		const score = fromAlphaTex(RIFF);
		const beat = score.tracks[0].staves[0].bars[0].voices[0].beats[0];
		beat.notes[0].isPalmMute = true;
		beat.notes[0].isGhost = true;

		const back = fromAlphaTex(toAlphaTex(score));
		const rt = back.tracks[0].staves[0].bars[0].voices[0].beats[0];

		expect(back.title).toBe('Riff');
		expect(back.tempo).toBe(180);
		expect(back.masterBars.length).toBe(2);
		expect(back.tracks[0].staves[0].stringTuning.tunings).toEqual([64, 59, 55, 50, 45, 40]);
		expect(rt.duration).toBe(beat.duration);
		expect(rt.notes.map((n) => [n.string, n.fret])).toEqual(
			beat.notes.map((n) => [n.string, n.fret])
		);
		expect(rt.notes[0].isPalmMute).toBe(true);
		expect(rt.notes[0].isGhost).toBe(true);
	});

	it('reports parser diagnostics instead of an opaque error', () => {
		try {
			fromAlphaTex(`\\title "Broken" . 0.6.8{pm}`);
			throw new Error('should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(AlphaTexParseError);
			expect((err as AlphaTexParseError).diagnostics.join(' ')).toContain('pm');
		}
	});
});
