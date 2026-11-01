// Plays every sound in a real AudioContext, where an invalid parameter throws. This
// says nothing about how they sound, which is on the manual checklist.
import { test, expect } from '@playwright/test';

// Runs in the page. Returns the context's state and any sound that threw.
const playAll = async (setup) => {
  const { AmbientAudio } = await import('/src/audio.js');
  const audio = new AmbientAudio();
  audio.start();
  await audio.ctx.resume();

  const sounds = {
    siren: () => audio.siren(),
    hum: () => { audio.setHum(0); audio.setHum(1); audio.setHum(50); },
    walk: () => audio.step(2),
    run: () => audio.step(4.2),
    splashWalk: () => audio.splash(2),
    splashRun: () => audio.splash(4.2),
    purchase: () => audio.purchase(),
    whirr: () => audio.whirr(0.9),
    clunk: () => audio.clunk(),
    pickup: () => audio.pickup(),
    knock: () => audio.knock(),
  };
  const play = () => {
    const thrown = [];
    for (const [name, sound] of Object.entries(sounds)) {
      // Several rounds, as these pick some of their values at random.
      for (let i = 0; i < 20; i++) {
        try { sound(); } catch (e) { thrown.push(`${name}: ${e.message}`); }
      }
    }
    return [...new Set(thrown)];
  };

  if (setup === 'muted') audio.toggleMute();
  if (setup === 'unmuted') { audio.toggleMute(); audio.toggleMute(); }
  if (setup === 'resumed') {
    audio.suspend();
    await audio.ctx.suspend();
    audio.resume();
    await audio.ctx.resume();
  }
  const thrown = play();
  const state = audio.ctx.state;
  await audio.ctx.close();
  return { state, muted: audio.muted, thrown };
};

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/textures.html');
  await page.mouse.click(10, 10); // browsers only start audio after an input
});

for (const [setup, muted] of [['fresh', false], ['muted', true], ['unmuted', false], ['resumed', false]]) {
  test(`every sound plays without error: ${setup}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const result = await page.evaluate(playAll, setup);
    expect(result).toEqual({ state: 'running', muted, thrown: [] });
    expect(errors).toEqual([]);
  });
}

test('sounds are silently skipped before the audio has started', async ({ page }) => {
  const thrown = await page.evaluate(async () => {
    const { AmbientAudio } = await import('/src/audio.js');
    const audio = new AmbientAudio();
    const out = [];
    for (const name of ['siren', 'setHum', 'step', 'splash', 'purchase', 'whirr', 'clunk', 'pickup', 'knock', 'toggleMute', 'suspend', 'resume']) {
      try { audio[name](1); } catch (e) { out.push(`${name}: ${e.message}`); }
    }
    return out;
  });
  expect(thrown).toEqual([]);
});
