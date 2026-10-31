// Hashes the raw pixels of every generated texture, so a change to the noise or
// a generator fails here. Canvas text and gradients differ between browsers and
// machines, so the snapshot is per platform and meant for one known machine.
// If a change is meant to alter a texture, check it in the browser, then update
// with: npm run test:textures -- -u
import { test, expect } from '@playwright/test';

test('generated textures are unchanged', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tests/textures.html');
  await page.waitForFunction(() => window.hashTextures);
  const hashes = await page.evaluate(() => window.hashTextures());
  expect(errors).toEqual([]);
  expect(Object.keys(hashes).length).toBeGreaterThan(0);
  expect(JSON.stringify(hashes, null, 2)).toMatchSnapshot('textures.json');
});

test('steam puffs fade out before the edge of their quad', async ({ page }) => {
  await page.goto('/tests/textures.html');
  await page.waitForFunction(() => window.cloudAlphaOutsideCircle);
  expect(await page.evaluate(() => window.cloudAlphaOutsideCircle())).toBe(0);
});
