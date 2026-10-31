// Two hand-placed shopfronts: a fish market and an onigiri shop. They sit over
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
  const { mats, box, sph, cyl, plane, addLight, addCollider } = ctx;
  const side = 1, zc = -18.5, w = 2.6;
  const at = (d) => side * (WALL - d);
  const out = -side;
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

  // tiled eave: a sloped base with ridges running down it, then snow
  const roll = -side * (Math.PI / 2 - ROOF_TILT);
  box(mats.metalDark, at(0.775), 2.82, zc, 0.85, 0.03, w, null, 0, 0, side * ROOF_TILT);
  for (let k = 0; k < 15; k++) {
    cyl(mats.metalDark, at(0.775), 2.845, zc + (k - 7) * 0.175, 0.04, 0.85, 0, 0, roll, true);
  }
  box(mats.snow, at(0.66), 2.92, zc, 0.5, 0.025, w - 0.14, null, 0, 0, side * ROOF_TILT);
  box(mats.strip('#ffd9a0', 2.5), at(SHELL + 0.08), 2.7, zc, 0.04, 0.04, w - 0.5);

  // noren on a rod in front of the counter
  cyl(mats.wood, at(0.72), 2.56, zc, 0.014, w - 0.1, Math.PI / 2);
  plane(mats.noren, at(0.72), 2.25, zc, w - 0.3, 0.62, out * Math.PI / 2);

  // paper lanterns at each end
  for (const d of [-1, 1]) {
    const lz = zc + d * (w / 2 - 0.15);
    cyl(mats.cable, at(1.02), 2.53, lz, 0.004, 0.14, 0, 0, 0, true);
    sph(mats.lantern, at(1.02), 2.32, lz, 0.13, 0.19, 0.13);
    cyl(mats.metalDark, at(1.02), 2.51, lz, 0.07, 0.03);
    cyl(mats.metalDark, at(1.02), 2.13, lz, 0.07, 0.03);
  }

  addLight(at(1.4), 1.7, zc, '#ffb070', 3, 8);
  addCollider(at(SHELL + COUNTER + 0.04), at(-0.35), zc - w / 2, zc + w / 2);
}

export function buildShops(ctx) {
  fishMarket(ctx);
  onigiriShop(ctx);
}
