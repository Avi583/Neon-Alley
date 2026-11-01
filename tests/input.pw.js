// Regression test for an input bug that only shows in a real browser. Desktop
// mouse look is in smoke.pw.js and refused pointer lock (F2) in ui.test.js.
import { test, expect } from '@playwright/test';
import { LOAD_TIMEOUT, nextFrames, openGame, playerState } from './game-page.js';

test.setTimeout(LOAD_TIMEOUT + 60_000);

test.describe('mouse look on a touchscreen laptop (F1)', () => {
  test.use({ hasTouch: true });

  // F1 is still open. Once it's fixed this reports a failure: remove test.fail then.
  test('works when the mouse is the input used', async ({ page }) => {
    test.fail();
    await openGame(page);
    await page.locator('#enter').click();
    await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe('CANVAS');
    const { yaw } = await playerState(page);
    await page.mouse.move(400, 300);
    await page.mouse.move(500, 300);
    await nextFrames(page);
    expect((await playerState(page)).yaw).not.toBe(yaw);
  });
});
