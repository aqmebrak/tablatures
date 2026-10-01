import * as alphaTab from '@coderline/alphatab';

export type TuningPreset = { name: string; tunings: number[] };

/** Metal-oriented tunings alphaTab does not ship as presets. */
export const METAL_PRESETS: Record<number, TuningPreset[]> = {
	4: [
		{ name: 'Bass Standard', tunings: [43, 38, 33, 28] },
		{ name: 'Bass Drop D', tunings: [43, 38, 33, 26] },
		{ name: 'Bass Drop C', tunings: [41, 36, 31, 24] }
	],
	5: [{ name: 'Bass 5 Standard', tunings: [43, 38, 33, 28, 23] }],
	6: [
		{ name: 'Drop D', tunings: [64, 59, 55, 50, 45, 38] },
		{ name: 'D Standard', tunings: [62, 57, 53, 48, 43, 38] },
		{ name: 'Drop C', tunings: [62, 57, 53, 48, 43, 36] },
		{ name: 'C# Standard', tunings: [61, 56, 52, 47, 42, 37] },
		{ name: 'Drop B', tunings: [61, 56, 52, 47, 42, 35] },
		{ name: 'Drop A', tunings: [59, 54, 50, 45, 40, 33] }
	],
	7: [
		{ name: '7-String Standard', tunings: [64, 59, 55, 50, 45, 40, 35] },
		{ name: '7-String Drop A', tunings: [64, 59, 55, 50, 45, 40, 33] },
		{ name: '7-String Drop G', tunings: [62, 57, 53, 48, 43, 38, 31] }
	],
	8: [
		{ name: '8-String Standard', tunings: [64, 59, 55, 50, 45, 40, 35, 30] },
		{ name: '8-String Drop E', tunings: [64, 59, 55, 50, 45, 40, 35, 28] }
	]
};

/**
 * alphaTab's Tuning.initialize() APPENDS its preset list every time it runs,
 * so it must run at most once. (It is also triggered lazily inside
 * alphaTab when the list is empty; the length check covers that.)
 */
export function ensureTuningsInitialized(): void {
	if (alphaTab.model.Tuning.getPresetsFor(6).length === 0) alphaTab.model.Tuning.initialize();
}

const pitchKey = (tunings: number[]) => tunings.join(',');

/**
 * Guitar/bass presets for a string count: alphaTab's built-ins (non-fretted
 * instruments filtered out), then our metal catalogue. Where a built-in has
 * the same pitches as a catalogue entry, the catalogue's name wins
 * ("Drop D", not "Guitar Dropped D Tuning"). De-duplicated by pitches.
 */
export function presetsFor(stringCount: number): TuningPreset[] {
	ensureTuningsInitialized();
	const metal = METAL_PRESETS[stringCount] ?? [];
	const metalName = new Map(metal.map((p) => [pitchKey(p.tunings), p.name]));
	const builtin: TuningPreset[] = alphaTab.model.Tuning.getPresetsFor(stringCount)
		.filter((t) => /^(Guitar|Bass)\b/.test(t.name))
		.map((t) => ({
			name: metalName.get(pitchKey(t.tunings)) ?? t.name,
			tunings: [...t.tunings]
		}));
	const seen = new Set<string>();
	return [...builtin, ...metal].filter((p) => {
		const key = pitchKey(p.tunings);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/** The preset name for these exact pitches, or 'Custom'. */
export function labelForTuning(tunings: number[]): string {
	const key = pitchKey(tunings);
	return presetsFor(tunings.length).find((p) => pitchKey(p.tunings) === key)?.name ?? 'Custom';
}

export function describeTuning(tunings: number[]): string {
	return tunings.map((t) => alphaTab.model.Tuning.getTextForTuning(t, true)).join(' ');
}

const NOTE_OFFSETS: Record<string, number> = {
	C: 0,
	'C#': 1,
	Db: 1,
	D: 2,
	'D#': 3,
	Eb: 3,
	E: 4,
	F: 5,
	'F#': 6,
	Gb: 6,
	G: 7,
	'G#': 8,
	Ab: 8,
	A: 9,
	'A#': 10,
	Bb: 10,
	B: 11
};

export function parseTuningNames(names: string[]): number[] {
	return names.map((raw) => {
		const match = /^([A-G][#b]?)(-?\d+)$/.exec(raw.trim());
		if (!match) throw new Error(`Unparseable note name: ${raw}`);
		const [, note, octave] = match;
		return (Number(octave) + 1) * 12 + NOTE_OFFSETS[note];
	});
}
