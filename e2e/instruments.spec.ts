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

test('inspector: 7 strings keeps a typed note, presets and steppers retune', async ({ page }) => {
	const scoreView = await load(page);
	const inspector = page.getByTestId('inspector');

	await page.keyboard.press('9'); // low E, bar 1
	const nine = scoreView.locator('svg text', { hasText: /^9$/ });
	await expect(nine).toHaveCount(1);

	await inspector.getByLabel('Strings').selectOption('7');
	await expect(inspector.getByTestId('string-row')).toHaveCount(7);
	await expect(inspector.getByLabel('Tuning')).toHaveValue('7-String Standard');
	await expect(nine).toHaveCount(1); // the note survived

	await inspector.getByLabel('Lower string 7').click();
	// describeTuning renders flats in this alphaTab build (Bb1, not A#1).
	await expect(inspector.getByTestId('string-row').nth(6)).toContainText('Bb1');
	await expect(inspector.getByLabel('Tuning')).toHaveValue('Custom');

	await inspector.getByLabel('Tuning').selectOption('7-String Drop A');
	await expect(inspector.getByTestId('string-row').nth(6)).toContainText('A1');

	// The cursor followed low E to string 2; ArrowDown reaches the new lowest
	// string. A note there is the one that 7 -> 6 must remove.
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('0');
	const zero = scoreView.locator('svg text', { hasText: /^0$/ });
	await expect(zero).toHaveCount(1);

	await inspector.getByLabel('Strings').selectOption('6');
	await expect(inspector.getByRole('status')).toContainText('1 note removed');
	await expect(zero).toHaveCount(0);
	await expect(nine).toHaveCount(1); // low E note kept
	await page.keyboard.press('Control+z');
	await expect(zero).toHaveCount(1);
});

test('inspector: rename and change sound', async ({ page }) => {
	await load(page);
	const inspector = page.getByTestId('inspector');
	const tracks = page.getByTestId('tracks');

	const name = inspector.getByLabel('Name');
	await name.fill('Rhythm L');
	await name.press('Enter');
	await expect(tracks.getByRole('button', { name: /^Rhythm L — Guitar$/ })).toBeVisible();

	await inspector.getByLabel('Sound').selectOption({ label: 'Picked Bass' });
	await expect(tracks.getByRole('button', { name: /^Rhythm L — Bass$/ })).toBeVisible();
});
