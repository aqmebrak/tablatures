import * as alphaTab from '@coderline/alphatab';
import { resolveBeat, type CommandContext } from './types';

const Duration = alphaTab.model.Duration;

/** Ordered longest -> shortest. */
const LADDER = [
  Duration.Whole,
  Duration.Half,
  Duration.Quarter,
  Duration.Eighth,
  Duration.Sixteenth,
  Duration.ThirtySecond,
  Duration.SixtyFourth
];

export function setDuration(ctx: CommandContext, duration: alphaTab.model.Duration): void {
  resolveBeat(ctx.score, ctx.cursor).duration = duration;
  ctx.score.finish(ctx.settings);
}

/** direction 1 doubles the note length, -1 halves it. */
export function scaleDuration(ctx: CommandContext, direction: 1 | -1): void {
  const beat = resolveBeat(ctx.score, ctx.cursor);
  const index = LADDER.indexOf(beat.duration);
  if (index === -1) return;
  const next = LADDER[index - direction];
  if (next === undefined) return;
  beat.duration = next;
  ctx.score.finish(ctx.settings);
}

export function toggleDotted(ctx: CommandContext): void {
  const beat = resolveBeat(ctx.score, ctx.cursor);
  beat.dots = beat.dots === 1 ? 0 : 1;
  ctx.score.finish(ctx.settings);
}
