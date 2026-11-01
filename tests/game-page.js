// Shared by the browser tests that run the built game (see playwright.config.js).
import { expect } from '@playwright/test';

const GAME_URL = 'http://localhost:5200/Neon-Alley/';
export const LOAD_TIMEOUT = 180_000; // Ultra's textures take a while under software rendering

// Collects page errors, console errors (which include shader compile errors) and
// failed requests (which include assets at a wrong base path).
export function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r) => errors.push(`${r.failure()?.errorText} ${r.url()}`));
  return errors;
}

// Opens the game and waits until it can be entered, failing at the first error
// in the list from watchErrors, as a broken page would never finish loading.
export async function openGame(page, q = 'low', errors = []) {
  // Answer locally so the tests need no network: text falls back to system fonts.
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.goto(`${GAME_URL}?q=${q}&test`);
  const deadline = Date.now() + LOAD_TIMEOUT;
  while (!(await page.locator('#enter').isEnabled())) {
    expect(errors).toEqual([]);
    expect(Date.now(), 'game still loading').toBeLessThan(deadline);
    await page.waitForTimeout(250);
  }
}

// Resolves after the page has run a few more animation frames.
export async function nextFrames(page, count = 3) {
  await page.evaluate((n) => new Promise((done) => {
    const tick = () => (n-- > 0 ? requestAnimationFrame(tick) : done());
    tick();
  }), count);
}

// The range of brightness (0-255) in the drawn picture, shrunk to average out noise.
// Read inside an animation frame, straight after the game's own, as the canvas is
// cleared once it has been shown.
export const pictureContrast = (page) => page.evaluate(() => new Promise((done) => {
  requestAnimationFrame(() => {
    const ctx = new OffscreenCanvas(320, 180).getContext('2d');
    ctx.drawImage(document.querySelector('#app canvas'), 0, 0, 320, 180);
    const { data } = ctx.getImageData(0, 0, 320, 180);
    let min = 255, max = 0;
    for (let i = 0; i < data.length; i += 4) {
      const brightness = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      min = Math.min(min, brightness);
      max = Math.max(max, brightness);
    }
    done(max - min);
  });
}));

export const playerState = (page) => page.evaluate(() => ({
  x: window.__player.pos.x,
  z: window.__player.pos.y,
  yaw: window.__player.yaw,
  enabled: window.__player.enabled,
}));
