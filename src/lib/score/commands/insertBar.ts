import { insertBarAt } from './structure';
import type { CommandContext } from './types';

/** Inserts an empty bar after the cursor's bar, in every track. Returns the new bar index. */
export function insertBar(ctx: CommandContext): number {
	const index = ctx.cursor.barIndex + 1;
	insertBarAt(ctx.score, index);
	ctx.score.finish(ctx.settings);
	return index;
}
