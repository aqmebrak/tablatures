import * as alphaTab from '@coderline/alphatab';
import { fromAlphaTex } from './serialize';
import { describeTuning, presetsFor } from './tuning';

type Score = alphaTab.model.Score;

export type NewScoreOptions = {
	title?: string;
	tempo?: number;
	stringCount?: number;
	tuning?: number[];
	bars?: number;
};

function defaultTuningFor(stringCount: number): number[] {
	alphaTab.model.Tuning.initialize();
	const preset = alphaTab.model.Tuning.getDefaultTuningFor(stringCount);
	if (preset) return [...preset.tunings];
	return presetsFor(stringCount)[0].tunings;
}

export function createScore(options: NewScoreOptions = {}): Score {
	const {
		title = 'Untitled',
		tempo = 120,
		stringCount = 6,
		tuning = defaultTuningFor(stringCount),
		bars = 1
	} = options;

	const emptyBars = Array.from({ length: bars }, () => 'r.1').join(' | ');
	// alphaTex source text requires LOWERCASE note names in a \tuning directive
	// (e.g. "e4 b3 g3 d3 a2 e2"), but describeTuning() returns UPPERCASE note
	// names (matching alphaTab's Tuning.getTextForTuning output). Lowercase it
	// here or the generated alphaTex fails to parse.
	const tuningText = describeTuning(tuning).toLowerCase();
	const tex =
		`\\title "${title.replace(/"/g, '\\"')}" \\tempo ${tempo} . ` +
		`\\tuning ${tuningText} . ${emptyBars}`;

	return fromAlphaTex(tex);
}
