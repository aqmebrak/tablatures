import { describe, expect, it } from 'vitest';
import { midiForString, stringNumberToTuningIndex, tuningIndexToStringNumber } from './strings';

// \tuning e4 b3 g3 d3 a2 e2  -> index 0 is the HIGHEST string
const STANDARD = [64, 59, 55, 50, 45, 40];

describe('string numbering', () => {
	it('maps the top tuning entry to the highest string number', () => {
		expect(tuningIndexToStringNumber(0, 6)).toBe(6);
	});

	it('maps the bottom tuning entry to string 1', () => {
		expect(tuningIndexToStringNumber(5, 6)).toBe(1);
	});

	it('round-trips', () => {
		for (let i = 0; i < 6; i++) {
			expect(stringNumberToTuningIndex(tuningIndexToStringNumber(i, 6), 6)).toBe(i);
		}
	});

	it('handles 7 and 8 string instruments', () => {
		expect(tuningIndexToStringNumber(0, 7)).toBe(7);
		expect(tuningIndexToStringNumber(7, 8)).toBe(1);
	});

	it('computes midi pitch for an open low E', () => {
		expect(midiForString(STANDARD, 1, 0)).toBe(40);
	});

	it('computes midi pitch for the high E at the 12th fret', () => {
		expect(midiForString(STANDARD, 6, 12)).toBe(76);
	});
});
