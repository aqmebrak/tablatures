import { expect, test } from '@playwright/test';

test('renders a score', async ({ page }) => {
	await page.goto('/');
	const host = page.getByTestId('score-view');
	await expect(host).toBeVisible();
	// alphaTab injects svg once layout completes
	await expect(host.locator('svg').first()).toBeVisible({ timeout: 15_000 });
});
