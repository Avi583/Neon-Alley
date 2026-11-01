// Runs the production build, served under a subpath as on GitHub Pages: every
// preset loads and draws a picture without errors, and the game can be played
// and paused. Low is covered by the play test, which loads it anyway.
import { test, expect } from '@playwright/test';
import { LOAD_TIMEOUT, nextFrames, openGame, pictureContrast, playerState, watchErrors } from './game-page.js';

// A black picture with film grain reads about 4, a real view of the alley far more.
const MIN_CONTRAST = 32;

test.setTimeout(LOAD_TIMEOUT + 60_000);

for (const q of ['medium', 'high', 'ultra']) {
  test(`${q} preset loads and draws without errors`, async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page, q, errors);
    expect(await pictureContrast(page)).toBeGreaterThan(MIN_CONTRAST);
    expect(errors).toEqual([]);
  });
}

// A step taken straight at a puddle found from the mask, so no walking is needed.
const stepInPuddle = (page) => page.evaluate(() => {
  for (let z = 6; z > -90; z -= 0.25) {
    if (window.__ground.inWater(0, z)) {
      window.__player.pos.set(0, z);
      window.__player.onStep(2);
      return window.__splashes ? window.__splashes.rings.count : null;
    }
  }
  throw new Error('no puddle on the centre line');
});

for (const [q, expected] of [['medium', null], ['high', 1]]) {
  test(`a step in a puddle on ${q} ${expected ? 'splashes' : 'has no splash'}`, async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page, q, errors);
    expect(await stepInPuddle(page)).toBe(expected);
    await nextFrames(page);
    expect(errors).toEqual([]);
  });
}

test('the game starts, walks, looks, pauses and resumes', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page, 'low', errors);
  expect(await pictureContrast(page)).toBeGreaterThan(MIN_CONTRAST);
  await page.locator('#enter').click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect.poll(() => playerState(page).then((p) => p.enabled)).toBe(true);

  const before = await playerState(page);
  await page.keyboard.down('KeyW');
  await expect.poll(() => playerState(page).then((p) => before.z - p.z), { timeout: 30_000 }).toBeGreaterThan(0.2);
  await page.keyboard.up('KeyW');

  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe('CANVAS');
  const { yaw } = await playerState(page);
  await page.mouse.move(400, 300);
  await page.mouse.move(500, 300);
  await nextFrames(page);
  expect((await playerState(page)).yaw).not.toBe(yaw);

  // Playwright's Esc never reaches the browser's own pointer lock handling, so leave it from the page.
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator('#pause')).toBeVisible();
  expect((await playerState(page)).enabled).toBe(false);

  await page.locator('#resume').click();
  await expect(page.locator('#pause')).toBeHidden();
  expect((await playerState(page)).enabled).toBe(true);
  expect(errors).toEqual([]);
});
