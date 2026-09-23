import { describe, expect, it } from 'vitest';
import { cursorBox, pickTabBeatBounds, type BeatBoundsLike } from './cursorGeometry';

function fake(overrides: Partial<BeatBoundsLike> = {}): BeatBoundsLike {
	return {
		visualBounds: { x: 100, y: 300, w: 20, h: 100 },
		barBounds: { visualBounds: { x: 0, y: 300, w: 500, h: 100 } },
		notes: null,
		...overrides
	};
}

describe('cursorBox', () => {
	it('uses the matching note head row when the string has a note', () => {
		const b = fake({
			notes: [
				{ note: { string: 6 }, noteHeadBounds: { x: 101, y: 390, w: 8, h: 12 } },
				{ note: { string: 3 }, noteHeadBounds: { x: 101, y: 340, w: 8, h: 12 } }
			]
		});
		expect(cursorBox(b, 3, 6)).toEqual({ x: 100, y: 340, w: 20, h: 12 });
	});

	it('interpolates string 6 (highest pitch) to the top line', () => {
		// spacing = 100 / 5 = 20 ; tuningIndex 0 -> center 300 ; top 290
		expect(cursorBox(fake(), 6, 6)).toEqual({ x: 100, y: 290, w: 20, h: 20 });
	});

	it('interpolates string 1 (lowest pitch) to the bottom line', () => {
		// tuningIndex 5 -> center 400 ; top 390
		expect(cursorBox(fake(), 1, 6)).toEqual({ x: 100, y: 390, w: 20, h: 20 });
	});

	it('falls back to interpolation when notes exist but not on this string', () => {
		const b = fake({
			notes: [{ note: { string: 2 }, noteHeadBounds: { x: 101, y: 380, w: 8, h: 12 } }]
		});
		expect(cursorBox(b, 6, 6)).toEqual({ x: 100, y: 290, w: 20, h: 20 });
	});
});

describe('pickTabBeatBounds', () => {
	it('returns null for null/empty input', () => {
		expect(pickTabBeatBounds(null)).toBeNull();
		expect(pickTabBeatBounds([])).toBeNull();
	});

	it('picks the entry with the largest visualBounds.y regardless of order', () => {
		const score = fake({ visualBounds: { x: 0, y: 173, w: 1, h: 1 } });
		const tab = fake({ visualBounds: { x: 0, y: 300, w: 1, h: 1 } });
		expect(pickTabBeatBounds([tab, score])).toBe(tab);
		expect(pickTabBeatBounds([score, tab])).toBe(tab);
	});
});
