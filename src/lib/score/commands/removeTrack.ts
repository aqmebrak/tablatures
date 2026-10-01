import { assignChannels } from './structure';
import type { CommandContext } from './types';

/** Removes a track. Refuses (returns false) for the last track or a bad index. */
export function removeTrack(ctx: CommandContext, trackIndex: number): boolean {
	const { score } = ctx;
	if (score.tracks.length <= 1 || !score.tracks[trackIndex]) return false;
	score.tracks.splice(trackIndex, 1);
	assignChannels(score);
	score.finish(ctx.settings);
	return true;
}
