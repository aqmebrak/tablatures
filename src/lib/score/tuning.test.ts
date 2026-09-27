import { describe, expect, it } from 'vitest';
import { describeTuning, labelForTuning, parseTuningNames, presetsFor } from './tuning';

describe('tunings', () => {
	it('offers presets for 6 strings including drop tunings', () => {
		const names = presetsFor(6).map((p) => p.name);
		expect(names).toContain('Drop D');
		expect(names).toContain('Drop C');
		expect(names).toContain('Drop B');
	});

	it('offers presets for extended range instruments', () => {
		expect(presetsFor(7).length).toBeGreaterThan(0);
		expect(presetsFor(8).length).toBeGreaterThan(0);
	});

	it('offers bass presets for 4 and 5 strings', () => {
		expect(presetsFor(4).length).toBeGreaterThan(0);
		expect(presetsFor(5).length).toBeGreaterThan(0);
	});

	it('drop D lowers only the lowest string by a tone', () => {
		const dropD = presetsFor(6).find((p) => p.name === 'Drop D')!;
		expect(dropD.tunings).toEqual([64, 59, 55, 50, 45, 38]);
	});

	it('describes a tuning as note names, highest string first', () => {
		expect(describeTuning([64, 59, 55, 50, 45, 40])).toBe('E4 B3 G3 D3 A2 E2');
	});

	it('parses note names back into midi values', () => {
		expect(parseTuningNames(['E4', 'B3', 'G3', 'D3', 'A2', 'E2'])).toEqual([
			64, 59, 55, 50, 45, 40
		]);
	});

	it('returns the same presets on every call (regression: initialize() appended duplicates)', () => {
		const first = presetsFor(6);
		const second = presetsFor(6);
		expect(second.length).toBe(first.length);
		const names = second.map((p) => p.name);
		expect(new Set(names).size).toBe(names.length);
		const pitches = second.map((p) => p.tunings.join(','));
		expect(new Set(pitches).size).toBe(pitches.length);
	});

	it('only offers guitar and bass presets', () => {
		for (const n of [4, 5, 6, 7, 8]) {
			for (const p of presetsFor(n)) {
				expect(p.name).not.toMatch(/ukulele|mandolin|banjo|viola|cello|lute|violin/i);
			}
		}
	});

	it('names a built-in preset after the metal catalogue entry with the same pitches', () => {
		const names = presetsFor(6).map((p) => p.name);
		expect(names).not.toContain('Guitar Dropped D Tuning');
		expect(names[0]).toBe('Guitar Standard Tuning'); // standard stays first
		expect(presetsFor(7)[0].name).toBe('7-String Standard');
	});

	it('labels a tuning with its preset name, or Custom', () => {
		expect(labelForTuning([64, 59, 55, 50, 45, 38])).toBe('Drop D');
		expect(labelForTuning([62, 57, 53, 48, 43, 36])).toBe('Drop C');
		expect(labelForTuning([43, 38, 33, 28])).toBe('Bass Standard');
		expect(labelForTuning([64, 59, 55, 50, 45, 39])).toBe('Custom');
	});
});
