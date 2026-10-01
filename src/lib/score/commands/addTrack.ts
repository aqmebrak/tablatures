import * as alphaTab from '@coderline/alphatab';
import { MAX_TRACKS, TRACK_DEFAULTS, uniqueTrackName, type InstrumentFamily } from '../instruments';
import { labelForTuning } from '../tuning';
import { assignChannels, emptyBarLike } from './structure';
import type { CommandContext } from './types';

export function canAddTrack(score: alphaTab.model.Score): boolean {
	return score.tracks.length < MAX_TRACKS;
}

/** Appends a tab-only track with the family's defaults. Returns its index, or undefined when full. */
export function addTrack(ctx: CommandContext, family: InstrumentFamily): number | undefined {
	const { score, settings } = ctx;
	if (!canAddTrack(score)) return undefined;
	const defaults = TRACK_DEFAULTS[family];

	const track = new alphaTab.model.Track();
	track.name = uniqueTrackName(
		defaults.name,
		score.tracks.map((t) => t.name)
	);
	track.shortName = track.name;
	track.playbackInfo.program = defaults.program;

	const staff = new alphaTab.model.Staff();
	track.addStaff(staff);
	staff.stringTuning = new alphaTab.model.Tuning(
		labelForTuning(defaults.tunings),
		[...defaults.tunings],
		false
	);
	staff.showTablature = true;
	staff.showStandardNotation = false;

	const template = score.tracks[0].staves[0].bars;
	for (let i = 0; i < score.masterBars.length; i++) staff.addBar(emptyBarLike(template[i]));

	score.addTrack(track);
	assignChannels(score);
	score.finish(settings);
	return track.index;
}
