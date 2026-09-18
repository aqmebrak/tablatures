import * as alphaTab from '@coderline/alphatab';
import { resolveBeat, type CommandContext } from './types';

export function setFret(ctx: CommandContext, fret: number): void {
  if (!Number.isInteger(fret) || fret < 0 || fret > 36) {
    throw new Error(`Invalid fret: ${fret}`);
  }

  const beat = resolveBeat(ctx.score, ctx.cursor);
  const existing = beat.notes.find((n) => n.string === ctx.cursor.stringNumber);

  if (existing) {
    existing.fret = fret;
  } else {
    const note = new alphaTab.model.Note();
    note.string = ctx.cursor.stringNumber;
    note.fret = fret;
    beat.addNote(note);
  }

  ctx.score.finish(ctx.settings);
}
