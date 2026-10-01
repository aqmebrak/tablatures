import { retune } from './setTuning';
import type { CommandContext } from './types';

/**
 * Adds or removes strings at the LOW end, keeping every note on its physical
 * string. note.string counts from the lowest string (AGENTS.md rule 3), so
 * adding k low strings shifts every note up by k; removing k deletes notes on
 * the k lowest strings and shifts the rest down. New strings sit a fourth
 * (5 semitones) below the current lowest.
 */
export function setStringCount(
	ctx: CommandContext,
	trackIndex: number,
	count: number
): { removedNotes: number } {
	const staff = ctx.score.tracks[trackIndex]?.staves[0];
	const current = staff?.tuning.length ?? 0;
	if (!staff || !Number.isInteger(count) || count < 4 || count > 8 || count === current) {
		return { removedNotes: 0 };
	}

	const delta = count - current;
	const tunings = [...staff.tuning];
	if (delta > 0) {
		for (let i = 0; i < delta; i++) tunings.push(Math.max(0, tunings[tunings.length - 1] - 5));
	} else {
		tunings.length = count; // tunings[0] is the highest string: drop from the end
	}

	let removedNotes = 0;
	for (const bar of staff.bars)
		for (const voice of bar.voices)
			for (const beat of voice.beats)
				for (const note of [...beat.notes]) {
					if (note.string + delta < 1) {
						beat.removeNote(note);
						removedNotes++;
					} else {
						note.string += delta;
					}
				}

	retune(staff, tunings);
	ctx.score.finish(ctx.settings);
	return { removedNotes };
}
