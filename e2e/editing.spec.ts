import { expect, test } from '@playwright/test';

test('types a note and undoes it', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('score-view').locator('svg').first()).toBeVisible({
		timeout: 15_000
	});

	await page.keyboard.press('7');
	await expect(page.getByTestId('score-view')).toContainText('7');

	await page.keyboard.press('Control+z');
	await expect(page.getByTestId('score-view')).not.toContainText('7');
});

test('ArrowRight moves the cursor to a distinct beat (regression: shipped score had only one beat)', async ({
	page
}) => {
	await page.goto('/');
	const scoreView = page.getByTestId('score-view');
	await expect(scoreView.locator('svg').first()).toBeVisible({ timeout: 15_000 });

	// Type a fret at the first beat, move to the next beat, type a different
	// fret there. If ArrowRight were a no-op (only one beat in the score),
	// the second keystroke would overwrite/combine with the first instead of
	// producing two independent, simultaneously-visible values. Frets 9 and 0
	// are used because they can't collide with the 1-8 bar-number labels the
	// 8-bar shipped score also renders.
	await page.keyboard.press('9');
	await expect(scoreView).toContainText('9');

	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('0');

	await expect(scoreView).toContainText('9');
	await expect(scoreView).toContainText('0');
});

test('Undo/Redo buttons in TransportBar work when clicked', async ({ page }) => {
	await page.goto('/');
	const scoreView = page.getByTestId('score-view');
	await expect(scoreView.locator('svg').first()).toBeVisible({ timeout: 15_000 });

	const undoButton = page.getByRole('button', { name: 'Undo' });
	const redoButton = page.getByRole('button', { name: 'Redo' });

	await expect(undoButton).toBeDisabled();
	await expect(redoButton).toBeDisabled();

	// Use a fret value that can't collide with the bar-number labels (1-8,
	// from the 8-bar shipped score) rendered alongside the tab.
	await page.keyboard.press('9');
	await expect(scoreView).toContainText('9');
	await expect(undoButton).toBeEnabled();

	await undoButton.click();
	await expect(scoreView).not.toContainText('9');
	await expect(redoButton).toBeEnabled();

	await redoButton.click();
	await expect(scoreView).toContainText('9');
});

test('two eighth notes fill the current bar: ArrowRight inserts a beat instead of jumping to the next bar', async ({
	page
}) => {
	await page.goto('/');
	const scoreView = page.getByTestId('score-view');
	await expect(scoreView.locator('svg').first()).toBeVisible({ timeout: 15_000 });

	await page.getByRole('button', { name: '8', exact: true }).click();
	await page.keyboard.press('9');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('0');

	// Exact-text matches on rendered SVG <text> nodes: the tempo marking
	// ("= 120") and bar numbers ("1 ", "2 ") never equal "9" or "0" exactly.
	const nine = scoreView.locator('svg text', { hasText: /^9$/ });
	const zero = scoreView.locator('svg text', { hasText: /^0$/ });
	await expect(nine).toHaveCount(1);
	await expect(zero).toHaveCount(1);

	const a = await nine.boundingBox();
	const b = await zero.boundingBox();
	expect(a).not.toBeNull();
	expect(b).not.toBeNull();

	// Same system and string line, one eighth-note apart. Measured gap: 30.9px
	// with the fix; 55.7px when ArrowRight jumps to the next bar (old
	// behavior). 44 is the midpoint.
	expect(Math.abs(b!.y - a!.y)).toBeLessThan(2);
	const gap = b!.x - a!.x;
	expect(gap).toBeGreaterThan(0);
	expect(gap).toBeLessThan(44);
});

test.describe('cursor highlight geometry (pins tab-staff placement)', () => {
	// Measured tolerance for |highlight centre - fret text centre| is logged in
	// the task report; 4px is well under the ~110px offset of the notation staff.
	const CENTER_TOLERANCE = 4;

	type Box = { x: number; y: number; width: number; height: number };
	const centerY = (b: Box) => b.y + b.height / 2;
	const centerX = (b: Box) => b.x + b.width / 2;

	function expectHighlightOnText(hl: Box, text: Box) {
		// Vertical overlap of ranges.
		expect(hl.y).toBeLessThan(text.y + text.height);
		expect(hl.y + hl.height).toBeGreaterThan(text.y);
		expect(Math.abs(centerY(hl) - centerY(text))).toBeLessThan(CENTER_TOLERANCE);
		// Text's horizontal centre lies inside the highlight.
		expect(centerX(text)).toBeGreaterThanOrEqual(hl.x);
		expect(centerX(text)).toBeLessThanOrEqual(hl.x + hl.width);
	}

	async function load(page: import('@playwright/test').Page) {
		await page.goto('/');
		const scoreView = page.getByTestId('score-view');
		await expect(scoreView.locator('svg').first()).toBeVisible({ timeout: 15_000 });
		return scoreView;
	}

	async function box(loc: import('@playwright/test').Locator): Promise<Box> {
		const b = await loc.boundingBox();
		expect(b).not.toBeNull();
		return b!;
	}

	test('highlight sits on the tab staff over the typed fret', async ({ page }) => {
		const scoreView = await load(page);
		const highlight = page.getByTestId('cursor-highlight');

		await page.keyboard.press('9');
		const nine = scoreView.locator('svg text', { hasText: /^9$/ });
		await expect(nine).toHaveCount(1);
		await expect(highlight).toBeVisible();

		await expect(async () => {
			const hl = await box(highlight);
			const text = await box(nine);
			expectHighlightOnText(hl, text);
		}).toPass({ timeout: 3000 });
	});

	test('highlight tracks the string and moves up with ArrowUp', async ({ page }) => {
		const scoreView = await load(page);
		const highlight = page.getByTestId('cursor-highlight');

		await page.keyboard.press('9');
		const nine = scoreView.locator('svg text', { hasText: /^9$/ });
		await expect(nine).toHaveCount(1);
		let low!: Box;
		await expect(async () => {
			low = await box(highlight);
			expectHighlightOnText(low, await box(nine));
		}).toPass({ timeout: 3000 });

		for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowUp');
		await page.keyboard.press('7');
		const seven = scoreView.locator('svg text', { hasText: /^7$/ });
		await expect(seven).toHaveCount(1);

		await expect(async () => {
			const hl = await box(highlight);
			const text = await box(seven);
			expectHighlightOnText(hl, text);
			expect(hl.y).toBeLessThan(low.y - 5);
		}).toPass({ timeout: 3000 });
	});

	test('highlight moves with ArrowRight', async ({ page }) => {
		await load(page);
		const highlight = page.getByTestId('cursor-highlight');
		await expect(highlight).toBeVisible();
		const before = await box(highlight);

		await page.keyboard.press('ArrowRight');

		await expect(async () => {
			const after = await box(highlight);
			expect(after.x !== before.x || after.y !== before.y).toBe(true);
		}).toPass({ timeout: 3000 });
	});
});
