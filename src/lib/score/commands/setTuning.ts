import * as alphaTab from '@coderline/alphatab';
import { labelForTuning } from '../tuning';
import type { CommandContext } from './types';

/** Replaces a staff's tuning (frets untouched), labelled with its preset name or 'Custom'. */
export function retune(staff: alphaTab.model.Staff, tunings: number[]): void {
	staff.stringTuning = new alphaTab.model.Tuning(labelForTuning(tunings), [...tunings], false);
}

/** Retunes a track, keeping every fret (the sounding pitch moves). Same string count only. */
export function setTuning(ctx: CommandContext, trackIndex: number, tunings: number[]): void {
	const staff = ctx.score.tracks[trackIndex]?.staves[0];
	if (!staff || tunings.length !== staff.tuning.length) return;
	retune(staff, tunings);
	ctx.score.finish(ctx.settings);
}
