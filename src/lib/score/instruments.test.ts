import { describe, expect, it } from 'vitest';
import { familyOf, MAX_TRACKS, PROGRAMS, TRACK_DEFAULTS, uniqueTrackName } from './instruments';

describe('instruments', () => {
	it('classifies GM bass programs 32-39 as bass, everything else as guitar', () => {
		expect(familyOf(33)).toBe('bass');
		expect(familyOf(39)).toBe('bass');
		expect(familyOf(30)).toBe('guitar');
		expect(familyOf(40)).toBe('guitar');
	});

	it('offers the curated list, each program in its own family', () => {
		expect(PROGRAMS.map((p) => p.program)).toEqual([30, 29, 27, 28, 25, 24, 34, 33, 35, 38]);
		for (const p of PROGRAMS) expect(familyOf(p.program)).toBe(p.family);
	});

	it('defaults guitar to distortion in E standard and bass to pick bass in E1 A1 D2 G2', () => {
		expect(TRACK_DEFAULTS.guitar).toEqual({
			name: 'Guitar',
			program: 30,
			tunings: [64, 59, 55, 50, 45, 40]
		});
		expect(TRACK_DEFAULTS.bass).toEqual({ name: 'Bass', program: 34, tunings: [43, 38, 33, 28] });
		expect(MAX_TRACKS).toBe(8);
	});

	it('suffixes a number to keep track names unique', () => {
		expect(uniqueTrackName('Bass', ['Guitar'])).toBe('Bass');
		expect(uniqueTrackName('Guitar', ['Guitar'])).toBe('Guitar 2');
		expect(uniqueTrackName('Guitar', ['Guitar', 'Guitar 2'])).toBe('Guitar 3');
	});
});
