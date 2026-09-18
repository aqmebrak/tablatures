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
