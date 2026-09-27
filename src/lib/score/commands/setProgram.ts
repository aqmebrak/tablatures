import * as alphaTab from '@coderline/alphatab';
import { PROGRAMS } from '../instruments';
import type { CommandContext } from './types';

/**
 * alphaTab stores a track's program twice: playbackInfo.program AND an
 * Instrument automation on the track's first beat (which playback obeys).
 * Both must change together or the old sound wins.
 */
export function setProgram(ctx: CommandContext, trackIndex: number, program: number): void {
	const track = ctx.score.tracks[trackIndex];
	if (!track || !PROGRAMS.some((p) => p.program === program)) return;
	track.playbackInfo.program = program;
	for (const staff of track.staves) {
		const firstBeat = staff.bars[0]?.voices[0]?.beats[0];
		for (const automation of firstBeat?.automations ?? []) {
			if (automation.type === alphaTab.model.AutomationType.Instrument) automation.value = program;
		}
	}
	ctx.score.finish(ctx.settings);
}
