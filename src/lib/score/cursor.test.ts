import { describe, expect, it } from 'vitest';
import { clampCursor, moveBeat, moveString, type Cursor, type ScoreShape } from './cursor';

const shape: ScoreShape = { barCount: 3, beatsPerBar: () => 4, stringCount: 6 };
const at = (barIndex: number, beatIndex: number, stringNumber = 6): Cursor => ({
  trackIndex: 0,
  voiceIndex: 0,
  barIndex,
  beatIndex,
  stringNumber
});

describe('cursor navigation', () => {
  it('moves forward within a bar', () => {
    expect(moveBeat(at(0, 0), 1, shape).beatIndex).toBe(1);
  });

  it('wraps forward into the next bar', () => {
    const next = moveBeat(at(0, 3), 1, shape);
    expect(next.barIndex).toBe(1);
    expect(next.beatIndex).toBe(0);
  });

  it('wraps backward into the previous bar', () => {
    const prev = moveBeat(at(1, 0), -1, shape);
    expect(prev.barIndex).toBe(0);
    expect(prev.beatIndex).toBe(3);
  });

  it('stops at the start of the score', () => {
    expect(moveBeat(at(0, 0), -1, shape)).toEqual(at(0, 0));
  });

  it('stops at the end of the score', () => {
    expect(moveBeat(at(2, 3), 1, shape)).toEqual(at(2, 3));
  });

  it('moves up and down strings without wrapping', () => {
    // string 6 is the highest-pitched; "down" visually means a lower number
    expect(moveString(at(0, 0, 6), -1, shape).stringNumber).toBe(5);
    expect(moveString(at(0, 0, 6), 1, shape).stringNumber).toBe(6);
    expect(moveString(at(0, 0, 1), -1, shape).stringNumber).toBe(1);
  });

  it('clamps an out-of-range cursor back into the score', () => {
    const clamped = clampCursor(at(9, 9, 99), shape);
    expect(clamped.barIndex).toBe(2);
    expect(clamped.beatIndex).toBe(3);
    expect(clamped.stringNumber).toBe(6);
  });
});
