import { describe, expect, it } from 'vitest';
import * as alphaTab from '@coderline/alphatab';
import { defaultSettings, fromAlphaTex } from '../serialize';
import { clearNote } from './clearNote';

const ctxFor = (stringNumber: number) => ({
  score: fromAlphaTex(`\\tuning e4 b3 g3 d3 a2 e2 . (0.6 0.5).8 3.6.8`),
  settings: defaultSettings(),
  cursor: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringNumber }
});

const beat0 = (ctx: ReturnType<typeof ctxFor>) =>
  ctx.score.tracks[0].staves[0].bars[0].voices[0].beats[0];

describe('clearNote', () => {
  it('removes the note on the cursor string', () => {
    const ctx = ctxFor(1);
    clearNote(ctx);
    expect(beat0(ctx).notes.map((n) => n.string)).toEqual([2]);
  });

  it('turns the beat into a rest when the last note is removed', () => {
    const ctx = ctxFor(1);
    clearNote(ctx);
    ctx.cursor.stringNumber = 2;
    clearNote(ctx);
    expect(beat0(ctx).notes.length).toBe(0);
    expect(beat0(ctx).isRest).toBe(true);
  });

  it('is a no-op when the string is already empty', () => {
    const ctx = ctxFor(4);
    expect(() => clearNote(ctx)).not.toThrow();
    expect(beat0(ctx).notes.length).toBe(2);
  });
});
