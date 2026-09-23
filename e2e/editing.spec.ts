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
