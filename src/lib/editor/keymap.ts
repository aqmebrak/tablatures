import type { NoteArticulation } from '$lib/score/commands/toggleArticulation';

export type EditorAction =
	| { kind: 'fret'; digit: number }
	| { kind: 'move'; axis: 'beat' | 'string'; delta: number }
	| { kind: 'clear' }
	| { kind: 'scaleDuration'; direction: 1 | -1 }
	| { kind: 'dotted' }
	| { kind: 'articulation'; name: NoteArticulation }
	| { kind: 'undo' }
	| { kind: 'redo' };

const ARTICULATIONS: Record<string, NoteArticulation> = {
	p: 'palmMute',
	x: 'deadNote',
	g: 'ghost',
	l: 'letRing',
	h: 'hammerPullOff',
	v: 'vibrato'
};

export function resolveKey(event: {
	key: string;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
}): EditorAction | undefined {
	const { key, ctrlKey, metaKey, shiftKey } = event;
	const mod = ctrlKey || metaKey;

	if (mod && key.toLowerCase() === 'z') return shiftKey ? { kind: 'redo' } : { kind: 'undo' };
	if (mod && key.toLowerCase() === 'y') return { kind: 'redo' };
	if (mod) return undefined;

	if (/^[0-9]$/.test(key)) return { kind: 'fret', digit: Number(key) };

	switch (key) {
		case 'ArrowRight':
			return { kind: 'move', axis: 'beat', delta: 1 };
		case 'ArrowLeft':
			return { kind: 'move', axis: 'beat', delta: -1 };
		case 'ArrowUp':
			return { kind: 'move', axis: 'string', delta: 1 };
		case 'ArrowDown':
			return { kind: 'move', axis: 'string', delta: -1 };
		case 'Backspace':
		case 'Delete':
			return { kind: 'clear' };
		case '+':
			return { kind: 'scaleDuration', direction: 1 };
		case '-':
			return { kind: 'scaleDuration', direction: -1 };
		case '.':
			return { kind: 'dotted' };
	}

	const articulation = ARTICULATIONS[key.toLowerCase()];
	return articulation ? { kind: 'articulation', name: articulation } : undefined;
}
