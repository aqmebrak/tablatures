import { beforeEach, describe, expect, it } from 'vitest';
import { History } from './history';

const snap = (tex: string, label = 'edit') => ({ tex, label });

describe('History', () => {
  let history: History;
  beforeEach(() => {
    history = new History(snap('v0', 'init'));
  });

  it('starts with nothing to undo or redo', () => {
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });

  it('undoes back to the previous snapshot', () => {
    history.push(snap('v1'));
    expect(history.canUndo).toBe(true);
    expect(history.undo()?.tex).toBe('v0');
  });

  it('redoes forward again', () => {
    history.push(snap('v1'));
    history.undo();
    expect(history.redo()?.tex).toBe('v1');
  });

  it('drops the redo branch once a new edit is pushed', () => {
    history.push(snap('v1'));
    history.undo();
    history.push(snap('v2'));
    expect(history.canRedo).toBe(false);
    expect(history.undo()?.tex).toBe('v0');
  });

  it('coalesces consecutive edits sharing a key', () => {
    history.push(snap('v1'), { coalesceKey: 'fret' });
    history.push(snap('v2'), { coalesceKey: 'fret' });
    expect(history.undo()?.tex).toBe('v0');
    expect(history.canUndo).toBe(false);
  });

  it('does not coalesce across different keys', () => {
    history.push(snap('v1'), { coalesceKey: 'fret' });
    history.push(snap('v2'), { coalesceKey: 'duration' });
    expect(history.undo()?.tex).toBe('v1');
  });

  it('caps depth, discarding the oldest entries', () => {
    const capped = new History(snap('v0'), 3);
    for (let i = 1; i <= 5; i++) capped.push(snap(`v${i}`));
    let last: string | undefined;
    while (capped.canUndo) last = capped.undo()?.tex;
    expect(last).toBe('v2');
  });
});
