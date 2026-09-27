import { describe, expect, it } from 'vitest';
import { defaultSettings, fromAlphaTex } from '../serialize';
import { assignChannels, insertBarAt, removeBarAt } from './structure';

const TWO_TRACKS =
	'\\track "A" \\tuning e4 b3 g3 d3 a2 e2 . 1.6.1 | 2.6.1 | 3.6.1 ' +
	'\\track "B" \\tuning g2 d2 a1 e1 . 1.4.1 | 2.4.1 | 3.4.1';

function expectLinked(score: ReturnType<typeof fromAlphaTex>) {
	score.masterBars.forEach((mb, i) => {
		expect(mb.index).toBe(i);
		expect(mb.score).toBe(score);
		expect(mb.previousMasterBar).toBe(score.masterBars[i - 1] ?? null);
		expect(mb.nextMasterBar).toBe(score.masterBars[i + 1] ?? null);
	});
	for (const track of score.tracks)
		for (const staff of track.staves) {
			expect(staff.bars.length).toBe(score.masterBars.length);
			staff.bars.forEach((bar, i) => {
				expect(bar.index).toBe(i);
				expect(bar.staff).toBe(staff);
				expect(bar.previousBar).toBe(staff.bars[i - 1] ?? null);
				expect(bar.nextBar).toBe(staff.bars[i + 1] ?? null);
			});
		}
}

describe('structure helpers', () => {
	it('insertBarAt splices an empty bar into every staff and relinks everything', () => {
		const score = fromAlphaTex(TWO_TRACKS);
		insertBarAt(score, 1);
		score.finish(defaultSettings());
		expectLinked(score);
		const inserted = score.tracks[1].staves[0].bars[1].voices[0].beats;
		expect(inserted.length).toBe(1);
		expect(inserted[0].notes.length).toBe(0);
		expect(score.masterBars.map((m) => m.start)).toEqual([0, 3840, 7680, 11520]);
	});

	it('removeBarAt removes the bar from every staff and relinks everything', () => {
		const score = fromAlphaTex(TWO_TRACKS);
		removeBarAt(score, 1);
		score.finish(defaultSettings());
		expectLinked(score);
		expect(score.masterBars.length).toBe(2);
	});

	it('assignChannels gives track i the channels 2i and 2i+1, like the importer', () => {
		const score = fromAlphaTex(TWO_TRACKS);
		score.tracks.reverse();
		assignChannels(score);
		expect(score.tracks.map((t) => t.index)).toEqual([0, 1]);
		expect(
			score.tracks.map((t) => [t.playbackInfo.primaryChannel, t.playbackInfo.secondaryChannel])
		).toEqual([
			[0, 1],
			[2, 3]
		]);
	});
});
