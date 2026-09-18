import type * as alphaTab from '@coderline/alphatab';
import type { Cursor } from '../cursor';

export type CommandContext = {
	score: alphaTab.model.Score;
	settings: alphaTab.Settings;
	cursor: Cursor;
};

export function resolveBeat(score: alphaTab.model.Score, cursor: Cursor): alphaTab.model.Beat {
	const beat =
		score.tracks[cursor.trackIndex]?.staves[0]?.bars[cursor.barIndex]?.voices[cursor.voiceIndex]
			?.beats[cursor.beatIndex];
	if (!beat) throw new Error(`No beat at ${JSON.stringify(cursor)}`);
	return beat;
}
