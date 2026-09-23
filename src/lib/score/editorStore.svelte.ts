import type { CommandContext } from './commands/types';
import { clampCursor, type Cursor, type ScoreShape } from './cursor';
import { createScore, type NewScoreOptions } from './document';
import { History } from './history';
import { defaultSettings, fromAlphaTex, toAlphaTex } from './serialize';

export function createEditor(options: NewScoreOptions = {}) {
	const settings = defaultSettings();

	// $state.raw: never let Svelte deep-proxy alphaTab's object graph.
	let score = $state.raw(createScore(options));
	let cursor = $state<Cursor>({
		trackIndex: 0,
		barIndex: 0,
		voiceIndex: 0,
		beatIndex: 0,
		stringNumber: 1
	});
	let revision = $state(0);

	const history = new History({ tex: toAlphaTex(score, settings), label: 'new' });
	let canUndo = $state(false);
	let canRedo = $state(false);

	function syncHistoryFlags() {
		canUndo = history.canUndo;
		canRedo = history.canRedo;
	}

	function shape(): ScoreShape {
		const staff = score.tracks[cursor.trackIndex].staves[0];
		return {
			barCount: staff.bars.length,
			beatsPerBar: (barIndex) => staff.bars[barIndex]?.voices[cursor.voiceIndex]?.beats.length ?? 0,
			stringCount: staff.stringTuning.tunings.length
		};
	}

	function restore(tex: string) {
		score = fromAlphaTex(tex, settings);
		cursor = clampCursor(cursor, shape());
		revision++;
		syncHistoryFlags();
	}

	return {
		get score() {
			return score;
		},
		get cursor() {
			return cursor;
		},
		set cursor(next: Cursor) {
			cursor = next;
		},
		get revision() {
			return revision;
		},
		get canUndo() {
			return canUndo;
		},
		get canRedo() {
			return canRedo;
		},
		shape,
		run<T = void>(
			label: string,
			fn: (ctx: CommandContext) => T,
			opts: { coalesceKey?: string } = {}
		): T {
			const before = toAlphaTex(score, settings);
			const result = fn({ score, settings, cursor });
			const after = toAlphaTex(score, settings);
			if (after !== before) {
				history.push({ tex: after, label }, opts);
				revision++;
				syncHistoryFlags();
			}
			return result;
		},
		undo() {
			const snapshot = history.undo();
			if (snapshot) restore(snapshot.tex);
		},
		redo() {
			const snapshot = history.redo();
			if (snapshot) restore(snapshot.tex);
		},
		breakCoalesce() {
			history.breakCoalesce();
		}
	};
}
