export type Cursor = {
  trackIndex: number;
  barIndex: number;
  voiceIndex: number;
  beatIndex: number;
  /** 1-based from the lowest-pitched string, matching alphaTab's note.string. */
  stringNumber: number;
};

export type ScoreShape = {
  barCount: number;
  beatsPerBar: (barIndex: number) => number;
  stringCount: number;
};

export function moveBeat(cursor: Cursor, delta: number, shape: ScoreShape): Cursor {
  let { barIndex, beatIndex } = cursor;
  let remaining = delta;

  while (remaining > 0) {
    if (beatIndex + 1 < shape.beatsPerBar(barIndex)) beatIndex++;
    else if (barIndex + 1 < shape.barCount) {
      barIndex++;
      beatIndex = 0;
    } else return { ...cursor, barIndex, beatIndex };
    remaining--;
  }

  while (remaining < 0) {
    if (beatIndex > 0) beatIndex--;
    else if (barIndex > 0) {
      barIndex--;
      beatIndex = shape.beatsPerBar(barIndex) - 1;
    } else return { ...cursor, barIndex, beatIndex };
    remaining++;
  }

  return { ...cursor, barIndex, beatIndex };
}

export function moveString(cursor: Cursor, delta: number, shape: ScoreShape): Cursor {
  const stringNumber = Math.min(shape.stringCount, Math.max(1, cursor.stringNumber + delta));
  return { ...cursor, stringNumber };
}

export function clampCursor(cursor: Cursor, shape: ScoreShape): Cursor {
  const barIndex = Math.min(shape.barCount - 1, Math.max(0, cursor.barIndex));
  const beatIndex = Math.min(shape.beatsPerBar(barIndex) - 1, Math.max(0, cursor.beatIndex));
  const stringNumber = Math.min(shape.stringCount, Math.max(1, cursor.stringNumber));
  return { ...cursor, barIndex, beatIndex, stringNumber };
}
