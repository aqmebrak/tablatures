import { resolveBeat, type CommandContext } from './types';

export function clearNote(ctx: CommandContext): void {
  const beat = resolveBeat(ctx.score, ctx.cursor);
  const note = beat.notes.find((n) => n.string === ctx.cursor.stringNumber);
  if (!note) return;

  beat.removeNote(note);
  if (beat.notes.length === 0) beat.isEmpty = false; // an explicit rest, not an empty slot

  ctx.score.finish(ctx.settings);
}
