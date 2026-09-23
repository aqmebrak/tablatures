import * as alphaTab from '@coderline/alphatab';
import type { Cursor } from '../cursor';
import type { CommandContext } from './types';

/**
 * Decides what ArrowRight should do at the boundary of existing beats:
 *  - if a beat already exists at beatIndex + 1, just move onto it (no mutation)
 *  - else if the current bar still has time-signature capacity left, insert a
 *    new rest beat (inheriting the current beat's duration) and move onto it
 *  - else if a next bar exists, move to its first beat; if that bar is
 *    untouched (a single beat with no notes) it first adopts the current
 *    beat's duration, so the duration carries across bars as in Guitar Pro
 *  - else (end of the document), the cursor is unchanged
 *
 * Never mutates unless it inserts a beat or retimes an untouched next bar. `editorStore.run()` only records
 * an undo entry when the resulting score text actually differs (see Task 2),
 * so the pure-navigation and end-of-document cases here never create undo
 * noise even though every caller routes through `run()` uniformly.
 */
export function advanceOrInsertBeat(ctx: CommandContext): Cursor {
	const { score, settings, cursor } = ctx;
	const staff = score.tracks[cursor.trackIndex].staves[0];
	const bar = staff.bars[cursor.barIndex];
	const voice = bar.voices[cursor.voiceIndex];
	const currentBeat = voice.beats[cursor.beatIndex];
	if (!currentBeat) throw new Error(`No beat at ${JSON.stringify(cursor)}`);

	if (voice.beats[cursor.beatIndex + 1]) {
		return { ...cursor, beatIndex: cursor.beatIndex + 1 };
	}

	const masterBar = score.masterBars[cursor.barIndex];
	const usedTicks = voice.beats.reduce((sum, b) => sum + b.displayDuration, 0);
	const capacityTicks = masterBar.calculateDuration();

	if (usedTicks < capacityTicks) {
		const newBeat = new alphaTab.model.Beat();
		newBeat.duration = currentBeat.duration;
		voice.insertBeat(currentBeat, newBeat);
		score.finish(settings);
		return { ...cursor, beatIndex: cursor.beatIndex + 1 };
	}

	if (cursor.barIndex + 1 < staff.bars.length) {
		const nextVoice = staff.bars[cursor.barIndex + 1].voices[cursor.voiceIndex];
		if (nextVoice.beats.length === 1 && nextVoice.beats[0].notes.length === 0) {
			// Duration only, not dots: inserted beats don't copy dots either, and
			// copying a dot could overflow the bar.
			nextVoice.beats[0].duration = currentBeat.duration;
			score.finish(settings);
		}
		return { ...cursor, barIndex: cursor.barIndex + 1, beatIndex: 0 };
	}

	return cursor;
}
