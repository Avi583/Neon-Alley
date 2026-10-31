// Two hand-placed shopfronts: a fish market and an onigiri shop. They sit over
// the shutters already on those stretches of wall. Nothing here may touch the
// kit's rng (that includes kit.snow and kit.icicles) or the layout shifts, so
// any variation comes from a separate seeded rng.
import { WALL } from './config.js';
import { mulberry32 } from './noise.js';

const SHELL = 0.4; // far enough out to cover a shutter's housing and icicles
const COUNTER = 0.46;
const ROOF_TILT = 0.49;

// The block that hides the wall, with the lit interior on its face.
function shell(ctx, at, side, zc, w, interior) {
  const { mats, box, plane } = ctx;
  box(mats.concrete, at(SHELL - 0.375), 1.6, zc, 0.75, 3.2, w, [2, 2]);
  plane(interior, at(SHELL + 0.006), 1.75, zc, w - 0.2, 1.7, side * -Math.PI / 2);
  box(mats.metalDark, at(SHELL + 0.03), 2.62, zc, 0.06, 0.06, w - 0.1);
  for (const d of [-1, 1]) box(mats.metalDark, at(SHELL + 0.03), 1.75, zc + d * (w / 2 - 0.08), 0.06, 1.8, 0.06);
}

function fishMarket(ctx) {
  const { mats, box, sph, cyl, addLight, addCollider } = ctx;
  const side = -1, zc = -44.7, w = 2.6;
  const at = (d) => side * (WALL - d);
  const rng = mulberry32(44);
  shell(ctx, at, side, zc, w, mats.shopFish);

  // steel counter with a lit edge
  const cd = SHELL + COUNTER / 2;
  box(mats.metalLight, at(cd), 0.4, zc, COUNTER, 0.8, w - 0.1);
  box(mats.strip('#7fd8ff', 3), at(SHELL + COUNTER + 0.005), 0.78, zc, 0.01, 0.03, w - 0.1);

  // foam boxes of ice and fish on the counter
  for (let k = 0; k < 4; k++) {
    const bz = zc + (k - 1.5) * 0.61;
    box(mats.foam, at(cd), 0.86, bz, 0.42, 0.12, 0.56);
    box(mats.snow, at(cd), 0.925, bz, 0.36, 0.015, 0.5);
    const mat = k % 2 ? mats.fishRed : mats.fishSilver;
    for (let f = 0; f < 5; f++) {
      const fz = bz + (f - 2) * 0.1, fd = cd + (rng() - 0.5) * 0.05;
      sph(mat, at(fd), 0.955, fz, 0.13, 0.024, 0.04, true);
      box(mat, at(fd + 0.14), 0.955, fz, 0.05, 0.012, 0.05, null, Math.PI / 4);
      sph(mats.cable, at(fd - 0.09), 0.968, fz + 0.012, 0.008, 0.008, 0.008, true);
    }
  }

  // fish hanging from a rail under the awning
  cyl(mats.metalDark, at(0.8), 2.4, zc, 0.012, w - 0.3, Math.PI / 2);
  for (let k = 0; k < 6; k++) {
    const hz = zc + (k - 2.5) * 0.4, len = 0.17 + rng() * 0.06;
    cyl(mats.metalDark, at(0.8), 2.34, hz, 0.004, 0.12, 0, 0, 0, true);
    sph(k % 3 === 1 ? mats.fishRed : mats.fishSilver, at(0.8), 2.28 - len, hz, 0.018, len, 0.05, true);
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
  const { mats, box, sph, cyl, plane, prism, addLight, addCollider } = ctx;
  const side = 1, zc = -18.5, w = 2.6;
  const at = (d) => side * (WALL - d);
  const out = -side;
  shell(ctx, at, side, zc, w, mats.shopOnigiri);

  // wooden counter
  const cd = SHELL + COUNTER / 2, wood = [0.8, 0.8];
  box(mats.woodDark, at(cd), 0.4, zc, COUNTER, 0.8, w - 0.1, wood);
  box(mats.wood, at(cd + 0.01), 0.82, zc, COUNTER + 0.06, 0.04, w, wood);

  // two tiers of onigiri, apex up, with a strip of nori on the side facing the alley
  box(mats.woodDark, at(cd + 0.08), 0.92, zc, 0.12, 0.16, w - 0.3, wood);
  for (const [fd, y] of [[cd - 0.05, 1.07], [cd + 0.1, 0.9]]) {
    for (let k = 0; k < 11; k++) {
      const oz = zc + (k - 5) * 0.21;
      prism(mats.rice, at(fd), y, oz, 0.075, 0.07, -Math.PI / 2, 0, Math.PI / 2);
      box(mats.cable, at(fd) + out * 0.037, y - 0.016, oz, 0.004, 0.05, 0.05);
    }
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
