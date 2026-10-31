// Hand-placed shopfronts: fish market, onigiri, sushi and ramen. They sit over
// the shutters already on those stretches of wall. Nothing here may touch the
// kit's rng (that includes kit.snow and kit.icicles) or the layout shifts, so
// any variation comes from a separate seeded rng.
import * as THREE from 'three';
import { WALL } from './config.js';

const SHELL = 0.4; // far enough out to cover a shutter's housing and icicles
const COUNTER = 0.46;
const ROOF_TILT = 0.49;

// Neon outlines of the goods, as [along the wall, up] points on a unit shape.
const FISH_BODY = [[1, 0], [0.5, 0.38], [-0.2, 0.3], [-0.62, 0.06], [-1, 0.34], [-0.9, 0], [-1, -0.34], [-0.62, -0.06], [-0.2, -0.3], [0.5, -0.38], [1, 0]];
const FISH_GILL = [[0.28, 0.26], [0.18, 0], [0.28, -0.26]];
const RICE_BALL = [[0, 1], [0.85, -0.45], [0.7, -0.7], [-0.7, -0.7], [-0.85, -0.45], [0, 1]];
const NORI = [[-0.32, -0.7], [-0.32, -0.1], [0.32, -0.1], [0.32, -0.7], [-0.32, -0.7]];
const NIGIRI_RICE = [[-0.85, -0.45], [-0.95, -0.1], [-0.7, 0.1], [0.7, 0.1], [0.95, -0.1], [0.85, -0.45], [-0.85, -0.45]];
const NIGIRI_FISH = [[-1.05, 0.12], [-0.55, 0.45], [0.55, 0.45], [1.05, 0.12], [0, 0.14], [-1.05, 0.12]];
const circle = (r) => Array.from({ length: 13 }, (_, k) => [r * Math.cos(k * Math.PI / 6), r * Math.sin(k * Math.PI / 6)]);
const MAKI_NORI = circle(0.9);
const MAKI_RICE = circle(0.55);
const BOWL = [[-1, 0.2], [1, 0.2], [0.75, -0.45], [0.35, -0.7], [-0.35, -0.7], [-0.75, -0.45], [-1, 0.2]];
const NOODLES = [[-0.7, 0.36], [-0.35, 0.52], [0, 0.34], [0.35, 0.52], [0.7, 0.36]];
const CHOPSTICK = [[0.15, 0.25], [0.65, 0.65], [1.15, 1.05]];
const WISP = [[0, 0.7], [-0.14, 0.95], [0.06, 1.2], [-0.08, 1.45]];

// One neon tube in the plane of the shopfront. turn swaps the axes, so a fish hangs nose down.
function neon(ctx, mat, x, y, z, s, shape, turn = false, segs = 36) {
  const pts = shape.map(([u, v]) => (turn
    ? new THREE.Vector3(x, y - u * s, z + v * s)
    : new THREE.Vector3(x, y + v * s, z + u * s)));
  ctx.tube(pts, 0.007, mat, segs);
}

function neonFish(ctx, mat, x, y, z, s, turn = false) {
  neon(ctx, mat, x, y, z, s, FISH_BODY, turn);
  neon(ctx, mat, x, y, z, s, FISH_GILL, turn, 10);
  const r = 0.012;
  if (turn) ctx.sph(mat, x, y - 0.55 * s, z + 0.1 * s, r, r, r, true);
  else ctx.sph(mat, x, y + 0.1 * s, z + 0.55 * s, r, r, r, true);
}

// The block that hides the wall, with the lit interior on its face.
function shell(ctx, at, side, zc, w, interior) {
  const { mats, box, plane } = ctx;
  box(mats.concrete, at(SHELL - 0.375), 1.6, zc, 0.75, 3.2, w, [2, 2]);
  plane(interior, at(SHELL + 0.006), 1.75, zc, w - 0.2, 1.7, side * -Math.PI / 2);
  box(mats.metalDark, at(SHELL + 0.03), 2.62, zc, 0.06, 0.06, w - 0.1);
  for (const d of [-1, 1]) box(mats.metalDark, at(SHELL + 0.03), 1.75, zc + d * (w / 2 - 0.08), 0.06, 1.8, 0.06);
}

// Tiled eave: a sloped base with ridges running down it, then snow.
function tiledEave(ctx, at, side, zc, w) {
  const { mats, box, cyl } = ctx;
  const roll = -side * (Math.PI / 2 - ROOF_TILT);
  box(mats.metalDark, at(0.775), 2.82, zc, 0.85, 0.03, w, null, 0, 0, side * ROOF_TILT);
  const n = Math.round(w / 0.175);
  for (let k = 0; k < n; k++) {
    cyl(mats.metalDark, at(0.775), 2.845, zc + (k - (n - 1) / 2) * 0.175, 0.04, 0.85, 0, 0, roll, true);
  }
  box(mats.snow, at(0.66), 2.92, zc, 0.5, 0.025, w - 0.14, null, 0, 0, side * ROOF_TILT);
}

// Noren on a rod in front of the counter. The rod spans the shop, the cloth is cw wide.
function norenCurtain(ctx, at, side, zc, w, cw, mat) {
  ctx.cyl(ctx.mats.wood, at(0.72), 2.56, zc, 0.014, w - 0.1, Math.PI / 2);
  ctx.plane(mat, at(0.72), 2.25, zc, cw, 0.62, -side * Math.PI / 2);
}

// A paper lantern at each end.
function lanterns(ctx, at, zc, w, mat) {
  const { mats, cyl, sph } = ctx;
  for (const d of [-1, 1]) {
    const lz = zc + d * (w / 2 - 0.15);
    cyl(mats.cable, at(1.02), 2.53, lz, 0.004, 0.14, 0, 0, 0, true);
    sph(mat, at(1.02), 2.32, lz, 0.13, 0.19, 0.13);
    cyl(mats.metalDark, at(1.02), 2.51, lz, 0.07, 0.03);
    cyl(mats.metalDark, at(1.02), 2.13, lz, 0.07, 0.03);
  }
}

function fishMarket(ctx) {
  const { mats, box, cyl, addLight, addCollider } = ctx;
  const side = -1, zc = -44.7, w = 2.6;
  const at = (d) => side * (WALL - d);
  const cyan = mats.strip('#7fd8ff', 3), coral = mats.strip('#ff6a5a', 3.5);
  shell(ctx, at, side, zc, w, mats.shopFish);

  // steel counter with a lit edge
  const cd = SHELL + COUNTER / 2;
  box(mats.metalLight, at(cd), 0.4, zc, COUNTER, 0.8, w - 0.1);
  box(cyan, at(SHELL + COUNTER + 0.005), 0.78, zc, 0.01, 0.03, w - 0.1);

  // neon fish on stands along the counter
  for (let k = 0; k < 4; k++) {
    const bz = zc + (k - 1.5) * 0.61;
    box(mats.metalDark, at(cd), 0.82, bz, 0.2, 0.04, 0.3);
    cyl(mats.metalDark, at(cd), 0.91, bz, 0.006, 0.14, 0, 0, 0, true);
    neonFish(ctx, k % 2 ? coral : cyan, at(cd), 1.07, bz, 0.24);
  }

  // neon fish hanging from a rail under the awning
  cyl(mats.metalDark, at(0.8), 2.4, zc, 0.012, w - 0.3, Math.PI / 2);
  for (let k = 0; k < 6; k++) {
    const hz = zc + (k - 2.5) * 0.4;
    cyl(mats.metalDark, at(0.8), 2.34, hz, 0.004, 0.12, 0, 0, 0, true);
    neonFish(ctx, k % 3 === 1 ? coral : cyan, at(0.8), 2.13, hz, 0.15, true);
  }

  // striped awning with a valance, snowed over
  const tilt = side * ROOF_TILT, n = 8, sw = w / n;
  for (let k = 0; k < n; k++) {
    const mat = k % 2 ? mats.foam : mats.awningBlue, sz = zc + (k - (n - 1) / 2) * sw;
    box(mat, at(0.775), 2.82, sz, 0.85, 0.025, sw, null, 0, 0, tilt);
    box(mat, at(1.15), 2.56, sz, 0.02, 0.14, sw);
  }
  box(mats.snow, at(0.68), 2.885, zc, 0.5, 0.025, w - 0.14, null, 0, 0, tilt);
  box(mats.strip('#dff6ff', 3), at(SHELL + 0.08), 2.7, zc, 0.04, 0.04, w - 0.5);

  addLight(at(1.6), 1.3, zc, '#bfe8ff', 3, 8);
  addCollider(at(SHELL + COUNTER + 0.02), at(-0.35), zc - w / 2, zc + w / 2);
}

function onigiriShop(ctx) {
  const { mats, box, addLight, addCollider } = ctx;
  const side = 1, zc = -18.5, w = 2.6;
  const at = (d) => side * (WALL - d);
  shell(ctx, at, side, zc, w, mats.shopOnigiri);

  // wooden counter
  const cd = SHELL + COUNTER / 2, wood = [0.8, 0.8];
  box(mats.woodDark, at(cd), 0.4, zc, COUNTER, 0.8, w - 0.1, wood);
  box(mats.wood, at(cd + 0.01), 0.82, zc, COUNTER + 0.06, 0.04, w, wood);

  // a row of neon onigiri on a riser, each with a strip of nori
  const rice = mats.strip('#fff1d6', 3.5), nori = mats.strip('#5dffb4', 3.5);
  box(mats.woodDark, at(cd + 0.08), 0.92, zc, 0.12, 0.16, w - 0.3, wood);
  for (let k = 0; k < 5; k++) {
    const oz = zc + (k - 2) * 0.46;
    neon(ctx, rice, at(cd + 0.08), 1.13, oz, 0.17, RICE_BALL);
    neon(ctx, nori, at(cd + 0.08), 1.13, oz, 0.17, NORI, false, 16);
  }

  tiledEave(ctx, at, side, zc, w);
  box(mats.strip('#ffd9a0', 2.5), at(SHELL + 0.08), 2.7, zc, 0.04, 0.04, w - 0.5);
  norenCurtain(ctx, at, side, zc, w, w - 0.3, mats.noren);
  lanterns(ctx, at, zc, w, mats.lantern);

  addLight(at(1.4), 1.7, zc, '#ffb070', 3, 8);
  addCollider(at(SHELL + COUNTER + 0.04), at(-0.35), zc - w / 2, zc + w / 2);
}

function sushiShop(ctx) {
  const { mats, box, cyl, sph, addLight, addCollider } = ctx;
  const side = -1, zc = -57.3, w = 3.4;
  const at = (d) => side * (WALL - d);
  shell(ctx, at, side, zc, w, mats.shopSushi);

  // pale wooden counter with a lit edge
  const cd = SHELL + COUNTER / 2, wood = [0.8, 0.8];
  box(mats.woodDark, at(cd), 0.4, zc, COUNTER, 0.8, w - 0.1, wood);
  box(mats.wood, at(cd + 0.01), 0.82, zc, COUNTER + 0.06, 0.04, w, wood);
  box(mats.strip('#ffe6c0', 1.6), at(SHELL + COUNTER + 0.045), 0.78, zc, 0.01, 0.03, w);

  // conveyor belt with rails, carrying plates of neon sushi
  const salmon = mats.strip('#ff7a5a', 3.5), rice = mats.strip('#fff1d6', 3.5), nori = mats.strip('#5dffb4', 3.5);
  box(mats.metalDark, at(cd), 0.85, zc, 0.2, 0.02, w - 0.2);
  for (const d of [-1, 1]) box(mats.metalLight, at(cd + d * 0.11), 0.86, zc, 0.02, 0.04, w - 0.2);
  for (let k = 0; k < 6; k++) {
    const pz = zc + (k - 2.5) * 0.52;
    cyl(k % 2 ? mats.metalRed : mats.foam, at(cd), 0.87, pz, 0.085, 0.012);
    cyl(mats.metalDark, at(cd), 0.91, pz, 0.005, 0.08, 0, 0, 0, true);
    if (k % 3 === 2) {
      neon(ctx, nori, at(cd), 1.07, pz, 0.12, MAKI_NORI, false, 24);
      neon(ctx, rice, at(cd), 1.07, pz, 0.12, MAKI_RICE, false, 16);
      sph(salmon, at(cd), 1.07, pz, 0.018, 0.018, 0.018, true);
    } else {
      neon(ctx, rice, at(cd), 1.03, pz, 0.15, NIGIRI_RICE);
      neon(ctx, salmon, at(cd), 1.03, pz, 0.15, NIGIRI_FISH);
    }
  }

  // plain indigo awning, snowed over
  box(mats.awningBlue, at(0.775), 2.82, zc, 0.85, 0.03, w, null, 0, 0, side * ROOF_TILT);
  box(mats.snow, at(0.68), 2.885, zc, 0.5, 0.025, w - 0.14, null, 0, 0, side * ROOF_TILT);
  box(mats.strip('#fff0d8', 1.6), at(SHELL + 0.08), 2.7, zc, 0.04, 0.04, w - 0.5);

  norenCurtain(ctx, at, side, zc, w, 1.66, mats.norenSushi);
  lanterns(ctx, at, zc, w, mats.strip('#ffe2b8', 1.2));

  addLight(at(1.5), 1.5, zc, '#ffe6c0', 3, 8);
  addCollider(at(SHELL + COUNTER + 0.04), at(-0.35), zc - w / 2, zc + w / 2);
}

function ramenShop(ctx) {
  const { mats, box, cyl, addLight, addCollider } = ctx;
  const side = 1, zc = -8.3, w = 3.3;
  const at = (d) => side * (WALL - d);
  shell(ctx, at, side, zc, w, mats.shopRamenFront);

  // dark wooden counter with a lit edge
  const cd = SHELL + COUNTER / 2, wood = [0.8, 0.8];
  box(mats.woodDark, at(cd), 0.4, zc, COUNTER, 0.8, w - 0.1, wood);
  box(mats.woodDark, at(cd + 0.01), 0.82, zc, COUNTER + 0.06, 0.04, w, wood);
  box(mats.strip('#ff6a3a', 3), at(SHELL + COUNTER + 0.045), 0.78, zc, 0.01, 0.03, w);

  // neon bowls on a riser, each with noodles, chopsticks and steam
  const bowl = mats.strip('#ff4a3a', 3.5), noodle = mats.strip('#ffd166', 3.5), pale = mats.strip('#f4f8ff', 2.5);
  box(mats.woodDark, at(cd + 0.06), 0.9, zc, 0.14, 0.12, w - 0.3, wood);
  for (let k = 0; k < 3; k++) {
    const bz = zc + (k - 1) * 0.98, by = 1.14, s = 0.19;
    neon(ctx, bowl, at(cd + 0.06), by, bz, s, BOWL);
    neon(ctx, noodle, at(cd + 0.06), by, bz, s, NOODLES, false, 20);
    neon(ctx, noodle, at(cd + 0.06), by, bz, s, CHOPSTICK, false, 6);
    for (const u of [-0.35, 0.3]) neon(ctx, pale, at(cd + 0.06), by, bz + u * s, s, WISP, false, 14);
  }

  // stools in front of the counter
  const sd = SHELL + COUNTER + 0.22;
  for (let k = 0; k < 4; k++) {
    const sz = zc + (k - 1.5) * 0.72;
    cyl(mats.metalDark, at(sd), 0.015, sz, 0.1, 0.03);
    cyl(mats.metalDark, at(sd), 0.27, sz, 0.018, 0.5, 0, 0, 0, true);
    cyl(mats.metalRed, at(sd), 0.53, sz, 0.13, 0.05);
  }

  tiledEave(ctx, at, side, zc, w);
  box(mats.strip('#ffb070', 2.5), at(SHELL + 0.08), 2.7, zc, 0.04, 0.04, w - 0.5);
  norenCurtain(ctx, at, side, zc, w, w - 0.3, mats.norenRamen);
  lanterns(ctx, at, zc, w, mats.lantern);

  addLight(at(1.5), 1.6, zc, '#ff9a5a', 3, 8);
  addCollider(at(sd + 0.15), at(-0.35), zc - w / 2, zc + w / 2);
}

export function buildShops(ctx) {
  fishMarket(ctx);
  onigiriShop(ctx);
  sushiShop(ctx);
  ramenShop(ctx);
}
