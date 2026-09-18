import { expect, test } from '@playwright/test';

test('shows the three-pane editor shell', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('palette')).toBeVisible();
	await expect(page.getByTestId('score-pane')).toBeVisible();
	await expect(page.getByTestId('inspector')).toBeVisible();
	await expect(page.getByTestId('tracks')).toBeVisible();
});
