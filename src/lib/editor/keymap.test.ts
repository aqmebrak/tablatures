import { describe, expect, it } from 'vitest';
import { resolveKey } from './keymap';

const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {}) =>
	resolveKey({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, ...mods });

describe('keymap', () => {
	it('maps digits to frets', () => {
		expect(key('7')).toEqual({ kind: 'fret', digit: 7 });
	});

	it('maps arrows to movement', () => {
		expect(key('ArrowRight')).toEqual({ kind: 'move', axis: 'beat', delta: 1 });
		expect(key('ArrowUp')).toEqual({ kind: 'move', axis: 'string', delta: 1 });
	});

	it('maps backspace and delete to clear', () => {
		expect(key('Backspace')).toEqual({ kind: 'clear' });
		expect(key('Delete')).toEqual({ kind: 'clear' });
	});

	it('maps +/- to duration scaling', () => {
		expect(key('+')).toEqual({ kind: 'scaleDuration', direction: 1 });
		expect(key('-')).toEqual({ kind: 'scaleDuration', direction: -1 });
	});

	it('maps articulation letters', () => {
		expect(key('p')).toEqual({ kind: 'articulation', name: 'palmMute' });
		expect(key('x')).toEqual({ kind: 'articulation', name: 'deadNote' });
	});

	it('maps undo and redo', () => {
		expect(key('z', { ctrlKey: true })).toEqual({ kind: 'undo' });
		expect(key('z', { ctrlKey: true, shiftKey: true })).toEqual({ kind: 'redo' });
	});

	it('ignores unmapped keys', () => {
		expect(key('F5')).toBeUndefined();
	});
});
