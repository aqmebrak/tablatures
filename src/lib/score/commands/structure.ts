import * as alphaTab from '@coderline/alphatab';

type Score = alphaTab.model.Score;
type Staff = alphaTab.model.Staff;
type Bar = alphaTab.model.Bar;

/**
 * Structural edits splice alphaTab's arrays directly; these helpers restore
 * the index / previous / next / owner links that alphaTab's own add* methods
 * would have set. Callers still run score.finish() afterwards.
 */
export function relinkMasterBars(score: Score): void {
	score.masterBars.forEach((mb, i) => {
		mb.index = i;
		mb.score = score;
		mb.previousMasterBar = score.masterBars[i - 1] ?? null;
		mb.nextMasterBar = score.masterBars[i + 1] ?? null;
	});
}

export function relinkBars(staff: Staff): void {
	staff.bars.forEach((bar, i) => {
		bar.index = i;
		bar.staff = staff;
		bar.previousBar = staff.bars[i - 1] ?? null;
		bar.nextBar = staff.bars[i + 1] ?? null;
	});
}

/** A bar holding one whole-rest beat, with the template's clef and key (stored per Bar). */
export function emptyBarLike(template: Bar | undefined): Bar {
	const bar = new alphaTab.model.Bar();
	if (template) {
		bar.clef = template.clef;
		bar.clefOttava = template.clefOttava;
		bar.keySignature = template.keySignature;
		bar.keySignatureType = template.keySignatureType;
	}
	const voice = new alphaTab.model.Voice();
	bar.addVoice(voice);
	const beat = new alphaTab.model.Beat();
	beat.duration = alphaTab.model.Duration.Whole;
	voice.addBeat(beat);
	return bar;
}

/** Inserts an empty bar at `index` (0..barCount) in every staff of every track. */
export function insertBarAt(score: Score, index: number): void {
	const template = score.masterBars[index - 1] ?? score.masterBars[index];
	const masterBar = new alphaTab.model.MasterBar();
	if (template) {
		masterBar.timeSignatureNumerator = template.timeSignatureNumerator;
		masterBar.timeSignatureDenominator = template.timeSignatureDenominator;
		masterBar.timeSignatureCommon = template.timeSignatureCommon;
	}
	score.masterBars.splice(index, 0, masterBar);
	relinkMasterBars(score);
	for (const track of score.tracks)
		for (const staff of track.staves) {
			staff.bars.splice(index, 0, emptyBarLike(staff.bars[index - 1] ?? staff.bars[index]));
			relinkBars(staff);
		}
}

/**
 * Removes bar `index` from every staff. The tempo lives on the first master
 * bar, so deleting bar 0 hands its tempo automations to the new first bar.
 */
export function removeBarAt(score: Score, index: number): void {
	const [removed] = score.masterBars.splice(index, 1);
	const first = score.masterBars[0];
	if (index === 0 && first && first.tempoAutomations.length === 0) {
		for (const automation of removed.tempoAutomations) first.tempoAutomations.push(automation);
	}
	relinkMasterBars(score);
	for (const track of score.tracks)
		for (const staff of track.staves) {
			staff.bars.splice(index, 1);
			relinkBars(staff);
		}
}

/** Re-indexes tracks and gives track i MIDI channels 2i / 2i+1 — the alphaTex importer's rule. */
export function assignChannels(score: Score): void {
	score.tracks.forEach((track, i) => {
		track.index = i;
		track.playbackInfo.primaryChannel = 2 * i;
		track.playbackInfo.secondaryChannel = 2 * i + 1;
	});
}
