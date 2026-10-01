import { stringNumberToTuningIndex } from '../strings';
import { retune } from './setTuning';
import type { CommandContext } from './types';

/** Sets one string's open pitch (stringNumber 1 = lowest), clamped to MIDI 0-127. */
export function setStringPitch(
	ctx: CommandContext,
	trackIndex: number,
	stringNumber: number,
	midi: number
): void {
	const staff = ctx.score.tracks[trackIndex]?.staves[0];
	if (!staff) return;
	const tunings = [...staff.tuning];
	const tuningIndex = stringNumberToTuningIndex(stringNumber, tunings.length);
	if (tuningIndex < 0 || tuningIndex >= tunings.length) return;
	tunings[tuningIndex] = Math.min(127, Math.max(0, Math.round(midi)));
	retune(staff, tunings);
	ctx.score.finish(ctx.settings);
}
