import type { CommandContext } from './types';

/** Renames a track. An empty or whitespace-only name is refused. */
export function renameTrack(ctx: CommandContext, trackIndex: number, name: string): void {
	const track = ctx.score.tracks[trackIndex];
	const trimmed = name.trim();
	if (!track || !trimmed) return;
	track.name = trimmed;
	track.shortName = trimmed;
	ctx.score.finish(ctx.settings);
}
