/**
 * alphaTab uses three colliding string conventions:
 *  - `stringTuning.tunings[0]` is the HIGHEST pitched string (top tab line)
 *  - alphaTex `fret.N` counts N from the top line
 *  - `note.string` is 1-based from the LOWEST pitched string
 * Everything converting between them lives here.
 */
export function tuningIndexToStringNumber(tuningIndex: number, stringCount: number): number {
	return stringCount - tuningIndex;
}

export function stringNumberToTuningIndex(stringNumber: number, stringCount: number): number {
	return stringCount - stringNumber;
}

export function midiForString(tunings: number[], stringNumber: number, fret: number): number {
	return tunings[stringNumberToTuningIndex(stringNumber, tunings.length)] + fret;
}
