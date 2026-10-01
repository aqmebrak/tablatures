export type InstrumentFamily = 'guitar' | 'bass';
export type ProgramOption = { family: InstrumentFamily; program: number; label: string };

/** Curated General MIDI programs (0-based) for metal. */
export const PROGRAMS: readonly ProgramOption[] = [
	{ family: 'guitar', program: 30, label: 'Distortion Guitar' },
	{ family: 'guitar', program: 29, label: 'Overdriven Guitar' },
	{ family: 'guitar', program: 27, label: 'Clean Guitar' },
	{ family: 'guitar', program: 28, label: 'Muted Guitar' },
	{ family: 'guitar', program: 25, label: 'Steel Acoustic' },
	{ family: 'guitar', program: 24, label: 'Nylon Acoustic' },
	{ family: 'bass', program: 34, label: 'Picked Bass' },
	{ family: 'bass', program: 33, label: 'Finger Bass' },
	{ family: 'bass', program: 35, label: 'Fretless Bass' },
	{ family: 'bass', program: 38, label: 'Synth Bass' }
];

/** GM programs 32-39 are the bass family; everything else is treated as guitar. */
export function familyOf(program: number): InstrumentFamily {
	return program >= 32 && program <= 39 ? 'bass' : 'guitar';
}

export const TRACK_DEFAULTS: Record<
	InstrumentFamily,
	{ name: string; program: number; tunings: number[] }
> = {
	guitar: { name: 'Guitar', program: 30, tunings: [64, 59, 55, 50, 45, 40] },
	bass: { name: 'Bass', program: 34, tunings: [43, 38, 33, 28] }
};

/** Track i uses MIDI channels 2i and 2i+1; 8 tracks fill channels 0-15. */
export const MAX_TRACKS = 8;

export function uniqueTrackName(base: string, existing: string[]): string {
	if (!existing.includes(base)) return base;
	let n = 2;
	while (existing.includes(`${base} ${n}`)) n++;
	return `${base} ${n}`;
}
