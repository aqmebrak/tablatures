import { expect, test } from '@playwright/test';

async function load(page: import('@playwright/test').Page) {
	await page.goto('/');
	const scoreView = page.getByTestId('score-view');
	await expect(scoreView.locator('svg').first()).toBeVisible({ timeout: 15_000 });
	return scoreView;
}

test('Ctrl+Insert adds a bar and Ctrl+Delete removes it', async ({ page }) => {
	const scoreView = await load(page);
	// alphaTab labels each bar with its number; the 8-bar default has no bar 9.
	const barNine = scoreView.locator('svg text', { hasText: /^\s*9\s*$/ });
	await expect(barNine).toHaveCount(0);

	await page.keyboard.press('Control+Insert');
	await expect(barNine).toHaveCount(1);

	await page.keyboard.press('Control+Delete');
	await expect(barNine).toHaveCount(0);
});
