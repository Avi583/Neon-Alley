// The wiring in main.js between what is in reach, the prompt and pressing E. Each
// place to stand comes from the generated layout, so moving a shop doesn't break this.
import { test, expect } from '@playwright/test';
import { ALLEY } from '../src/alley.js';
import { foodLabel } from '../src/food-shop.js';
import { inReach } from '../src/vending.js';
import { LOAD_TIMEOUT, nextFrames, openGame, watchErrors } from './game-page.js';

const PLAYER_RADIUS = 0.3; // same as player.js
const KNOCK_REACH = 0.8; // same as character.js
const FOOD_COOLDOWN = 450; // ms, just over the one in main.js
const REACH = 1.6, YAW_STEPS = 48;

test.setTimeout(LOAD_TIMEOUT + 120_000);

// Starts the game and returns what's needed from the alley, as plain data.
async function enterGame(page, errors) {
  await openGame(page, 'low', errors);
  await page.locator('#enter').click();
  await expect.poll(() => page.evaluate(() => window.__player.enabled)).toBe(true);
  return page.evaluate(() => {
    const spot = ({ face, z, kind }) => ({ face, z, kind });
    const { vending, doors, foodSpots, colliders } = window.__alley;
    return { vending: spot(vending), doors: doors.map(spot), food: foodSpots.map(spot), colliders };
  });
}

const reaches = (spot, { x, z, yaw }) => inReach(spot, x, z, yaw);

// A clear place to stand and a way to face, with everything in `wanted` in reach
// and nothing in `unwanted`, that `ok` accepts, or null if there is none.
function findStand({ colliders }, wanted, unwanted = [], ok = () => true) {
  const clear = (x, z) => colliders.every((c) => !(
    x > c.minX - PLAYER_RADIUS && x < c.maxX + PLAYER_RADIUS && z > c.minZ - PLAYER_RADIUS && z < c.maxZ + PLAYER_RADIUS
  ));
  for (let x = -ALLEY.walkX; x <= ALLEY.walkX; x += 0.1) {
    for (let z = wanted[0].z - REACH; z <= wanted[0].z + REACH; z += 0.1) {
      if (!clear(x, z)) continue;
      for (let k = 0; k < YAW_STEPS; k++) {
        const stand = { x, z, yaw: (k / YAW_STEPS) * Math.PI * 2 };
        if (wanted.every((s) => reaches(s, stand)) && !unwanted.some((s) => reaches(s, stand)) && ok(stand)) return stand;
      }
    }
  }
  return null;
}

async function standAt(page, { x, z, yaw }) {
  await page.evaluate(([px, pz, pyaw]) => {
    const p = window.__player;
    p.pos.set(px, pz);
    p.vel.set(0, 0);
    p.yaw = pyaw;
  }, [x, z, yaw]);
  await nextFrames(page);
}

const expectPrompt = (page, text) => expect(page.locator('#vend')).toHaveText(`E · ${text}`, { timeout: 60_000 });

test('the vending machine sells a drink, then offers it to take into the bag', async ({ page }) => {
  const errors = watchErrors(page);
  const world = await enterGame(page, errors);
  await standAt(page, findStand(world, [world.vending], [...world.doors, ...world.food]));
  await expectPrompt(page, 'BUY A DRINK ¥120');
  await page.keyboard.press('KeyE');
  await expectPrompt(page, 'TAKE THE DRINK');
  await page.keyboard.press('KeyE');
  await expectPrompt(page, 'BUY A DRINK ¥120');
  await expect(page.locator('#bag-button')).toHaveText('BAG 1');
  await page.keyboard.press('KeyI');
  await expect(page.locator('#bag')).toBeVisible();
  await expect(page.locator('.bag-slot:not(.empty)')).toHaveCount(1);
  await page.keyboard.press('Digit1'); // drinks it
  await expect(page.locator('#bag-button')).toHaveText('BAG 0');
  await expect(page.locator('.bag-slot:not(.empty)')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a door offers a knock, and still does after one', async ({ page }) => {
  const errors = watchErrors(page);
  const world = await enterGame(page, errors);
  const door = world.doors.find((d) => findStand(world, [d], [world.vending, ...world.food]));
  await standAt(page, findStand(world, [door], [world.vending, ...world.food]));
  await expectPrompt(page, 'KNOCK');
  await page.keyboard.press('KeyE');
  await nextFrames(page);
  await expectPrompt(page, 'KNOCK');
  expect(errors).toEqual([]);
});

test('a door beyond the glove is walked up to, then knocked on with the arm and the sound', async ({ page }) => {
  const errors = watchErrors(page);
  const world = await enterGame(page, errors);
  const others = [world.vending, ...world.food];
  const farFrom = (door) => (s) => Math.hypot(door.face - s.x, door.z - s.z) > KNOCK_REACH + 0.2;
  const door = world.doors.find((d) => findStand(world, [d], others, farFrom(d)));
  expect(door, 'no door can be stood back from').toBeDefined();
  await standAt(page, findStand(world, [door], others, farFrom(door)));
  await expectPrompt(page, 'KNOCK');
  // Notes where the biker is when each knock starts, whether the arm took it up, and each knock sound.
  await page.evaluate(() => {
    const { __player: p, __character: c, __audio: a } = window;
    const knock = c.knock.bind(c), sound = a.knock.bind(a);
    window.__knocks = { arm: [], sounds: 0 };
    c.knock = (d) => { knock(d); window.__knocks.arm.push({ x: p.pos.x, z: p.pos.y, raised: !!c.knocking }); };
    a.knock = (...args) => { window.__knocks.sounds++; return sound(...args); };
  });
  await page.keyboard.press('KeyE');
  await expect.poll(() => page.evaluate(() => window.__knocks.arm.length), { timeout: 30_000 }).toBe(1);
  const { arm: [at], sounds } = await page.evaluate(() => window.__knocks);
  expect(Math.hypot(door.face - at.x, door.z - at.z)).toBeLessThanOrEqual(KNOCK_REACH);
  expect(at.raised).toBe(true);
  expect(sounds).toBe(1);
  expect(errors).toEqual([]);
});

test('each food spot in reach sells once, the dish is taken into the bag, then the prompt goes', async ({ page }) => {
  const errors = watchErrors(page);
  const world = await enterGame(page, errors);
  const others = [world.vending, ...world.doors];
  const first = world.food.find((s) => findStand(world, [s], others));
  const stand = findStand(world, [first], others);
  const inReachNow = world.food.filter((s) => reaches(s, stand));
  await standAt(page, stand);
  // Each spot is bought once, and each dish taken once it has risen, in whatever order the prompt offers.
  const prompt = page.locator('#vend');
  let bought = 0, taken = 0;
  while (bought + taken < inReachNow.length * 2) {
    await expect(prompt).toBeVisible({ timeout: 60_000 });
    const text = await prompt.textContent();
    expect(text).toMatch(/^E · (BUY|TAKE) /);
    if (text.startsWith('E · BUY ')) bought++; else taken++;
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(FOOD_COOLDOWN);
    await nextFrames(page);
  }
  expect([bought, taken]).toEqual([inReachNow.length, inReachNow.length]);
  await expect(prompt).toBeHidden({ timeout: 60_000 });
  await expect(page.locator('#bag-button')).toHaveText(`BAG ${inReachNow.length}`);
  expect(errors).toEqual([]);
});

test('nothing is offered out of reach', async ({ page }) => {
  const errors = watchErrors(page);
  const world = await enterGame(page, errors);
  await standAt(page, findStand(world, [{ face: 0, z: 7 }], [world.vending, ...world.doors, ...world.food]));
  await expect(page.locator('#vend')).toBeHidden();
  await page.keyboard.press('KeyE');
  await nextFrames(page);
  await expect(page.locator('#vend')).toBeHidden();
  expect(errors).toEqual([]);
});

test.describe('with several things in reach', () => {
  // Each wants a stand with one of each kind in reach, wherever the layout allows it.
  const firstStand = (world, as, bs, unwanted = []) => {
    for (const a of as) {
      for (const b of bs) {
        if (Math.abs(a.z - b.z) > REACH * 2) continue;
        const stand = findStand(world, [a, b], unwanted);
        if (stand) return stand;
      }
    }
    return null;
  };

  test('the vending machine wins over a door or food', async ({ page }) => {
    const world = await enterGame(page, watchErrors(page));
    const stand = firstStand(world, [world.vending], [...world.doors, ...world.food]);
    expect(stand, 'nothing stands near the vending machine').not.toBeNull();
    await standAt(page, stand);
    await expectPrompt(page, 'BUY A DRINK ¥120');
  });

  test('food wins over a door', async ({ page }) => {
    const world = await enterGame(page, watchErrors(page));
    const stand = firstStand(world, world.food, world.doors, [world.vending]);
    expect(stand, 'no door stands near any food').not.toBeNull();
    const best = world.food.filter((s) => reaches(s, stand));
    await standAt(page, stand);
    await expect(page.locator('#vend')).toHaveText(new RegExp(best.map((s) => `E · ${foodLabel(s)}`).join('|')));
  });
});
