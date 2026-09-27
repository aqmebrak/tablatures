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

test('adds a bass track, edits it, and switching tracks shows each track’s own notes', async ({
	page
}) => {
	const scoreView = await load(page);
	const tracks = page.getByTestId('tracks');

	await tracks.getByRole('button', { name: '+ Add track' }).click();
	await page.getByRole('menuitem', { name: 'Bass' }).click();

	// The new track is selected: typing goes onto the bass.
	await expect(tracks.getByRole('button', { name: /^Bass — Bass$/ })).toBeVisible();
	await page.keyboard.press('9');
	const nine = scoreView.locator('svg text', { hasText: /^9$/ });
	await expect(nine).toHaveCount(1);

	// Back on the guitar, the bass note is not rendered.
	await tracks.getByRole('button', { name: /^Guitar — Guitar$/ }).click();
	await expect(nine).toHaveCount(0);

	// Removing the bass track leaves only the guitar.
	await tracks.getByRole('button', { name: 'Remove Bass' }).click();
	await expect(tracks.getByRole('button', { name: /^Bass — Bass$/ })).toHaveCount(0);
	await expect(tracks.getByRole('button', { name: /^Remove / })).toHaveCount(0);
});
