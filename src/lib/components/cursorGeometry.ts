import { stringNumberToTuningIndex } from '$lib/score/strings';

export type Rect = { x: number; y: number; w: number; h: number };

/** Structural subset of alphaTab's BeatBounds, so this is testable without alphaTab. */
export type BeatBoundsLike = {
	visualBounds: Rect;
	barBounds: { visualBounds: Rect };
	notes: { note: { string: number }; noteHeadBounds: Rect }[] | null;
};

/**
 * `findBeats` returns one entry per rendered staff, top to bottom. The tab
 * staff is the lowest one on screen (largest y); don't rely on array order.
 */
export function pickTabBeatBounds<T extends BeatBoundsLike>(
	list: T[] | null | undefined
): T | null {
	if (!list || list.length === 0) return null;
	return list.reduce((best, b) => (b.visualBounds.y > best.visualBounds.y ? b : best));
}

/** Box for the cursor's string row within a tab-staff beat column. */
export function cursorBox(tab: BeatBoundsLike, stringNumber: number, stringCount: number): Rect {
	const { x, w } = tab.visualBounds;
	const hit = tab.notes?.find((n) => n.note.string === stringNumber);
	if (hit) return { x, y: hit.noteHeadBounds.y, w, h: hit.noteHeadBounds.h };

	const bar = tab.barBounds.visualBounds;
	const spacing = bar.h / (stringCount - 1);
	const tuningIndex = stringNumberToTuningIndex(stringNumber, stringCount);
	const centerY = bar.y + tuningIndex * spacing;
	return { x, y: centerY - spacing / 2, w, h: spacing };
}
