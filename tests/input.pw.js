// Regression tests for input bugs that only show in a real browser. Desktop
// mouse look is in smoke.pw.js and refused pointer lock (F2) in ui.test.js.
import { test, expect } from '@playwright/test';
import { LOAD_TIMEOUT, nextFrames, openGame, playerState } from './game-page.js';

test.setTimeout(LOAD_TIMEOUT + 60_000);

const lockedTag = (page) => page.evaluate(() => document.pointerLockElement?.tagName ?? null);

test.describe('touchscreen laptop (F1)', () => {
  test.use({ hasTouch: true });

  test('mouse look works when the mouse is the input used', async ({ page }) => {
    await openGame(page);
    await page.locator('#enter').click();
    await expect.poll(() => lockedTag(page)).toBe('CANVAS');
    const { yaw } = await playerState(page);
    await page.mouse.move(400, 300);
    await page.mouse.move(500, 300);
    await nextFrames(page);
    expect((await playerState(page)).yaw).not.toBe(yaw);
  });

  test('a touch releases the lock without pausing, and a click takes it back', async ({ page }) => {
    await openGame(page);
    await page.locator('#enter').click();
    await expect.poll(() => lockedTag(page)).toBe('CANVAS');
    await page.touchscreen.tap(600, 300);
    await expect.poll(() => lockedTag(page)).toBe(null);
    await expect(page.locator('#pause')).toBeHidden();
    await expect(page.locator('#pause-button')).toBeVisible();
    await page.mouse.click(600, 300);
    await expect.poll(() => lockedTag(page)).toBe('CANVAS');
    await expect(page.locator('#pause')).toBeHidden();
    await expect(page.locator('#pause-button')).toBeHidden();
  });
});

test.describe('view (character)', () => {
  test('V switches between third and first person, and the button follows', async ({ page }) => {
    await openGame(page);
    await page.locator('#enter').click();
    await expect.poll(() => page.evaluate(() => window.__player.view)).toBe('third');
    expect(await page.evaluate(() => window.__character.root.parent !== null)).toBe(true);
    await page.keyboard.press('KeyV');
    await expect.poll(() => page.evaluate(() => window.__player.view)).toBe('first');
    await expect(page.locator('#view-button')).toHaveText('1ST PERSON');
    await page.keyboard.press('KeyV');
    await expect.poll(() => page.evaluate(() => window.__player.view)).toBe('third');
  });
});

test.describe('landscape phone', () => {
  test.use({ hasTouch: true, viewport: { width: 640, height: 360 } });

  test('ENTER is fully on screen and can be tapped (F4)', async ({ page }) => {
    await openGame(page);
    const box = await page.locator('#enter').boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(360);
    await page.locator('#enter').tap();
    await expect(page.locator('#hud')).toBeVisible();
    expect(await lockedTag(page)).toBe(null);
  });

  test('HUD buttons are big enough to tap and do not overlap (A70, A71)', async ({ page }) => {
    await openGame(page);
    await page.locator('#enter').tap();
    const boxes = [];
    for (const id of ['#sound', '#pause-button', '#view-button', '#fullscreen']) {
      await expect(page.locator(id)).toBeVisible();
      boxes.push(await page.locator(id).boundingBox());
    }
    let bottom = 0;
    for (const box of boxes) {
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.y).toBeGreaterThanOrEqual(bottom);
      bottom = box.y + box.height;
    }
    expect(bottom).toBeLessThanOrEqual(360);
    await page.locator('#fullscreen').tap();
    await expect(page.locator('#fullscreen')).toHaveText('EXIT FULL');
    await expect(page.locator('#pause')).toBeHidden();
  });

  test('the pause menu opens by touch, with quality and sound in reach (F6)', async ({ page }) => {
    await openGame(page);
    await page.locator('#enter').tap();
    await page.locator('#pause-button').tap();
    await expect(page.locator('#pause')).toBeVisible();
    for (const id of ['#pause-sound', '#pause-qpills', '#look-pills', '#resume']) {
      const box = await page.locator(id).boundingBox();
      expect(box.y + box.height).toBeLessThanOrEqual(360);
    }
    await page.locator('#pause-sound').tap();
    await expect(page.locator('#pause-sound')).toHaveText('SOUND OFF');
    await page.locator('#resume').tap();
    await expect(page.locator('#pause')).toBeHidden();
    expect((await playerState(page)).enabled).toBe(true);
  });
});
