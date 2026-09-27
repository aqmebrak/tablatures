import { removeBarAt } from './structure';
import type { CommandContext } from './types';

/** Deletes the cursor's bar in every track. Refuses (returns false) on the only bar. */
export function deleteBar(ctx: CommandContext): boolean {
	if (ctx.score.masterBars.length <= 1) return false;
	removeBarAt(ctx.score, ctx.cursor.barIndex);
	ctx.score.finish(ctx.settings);
	return true;
}
