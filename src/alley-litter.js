// Street clutter: crates, trash bags and litter. Placed by buildStreetProps in alley.js.
import { mulberry32 } from './noise.js';

// ctx is the placement kit plus mats, vents, addLight, addCollider and nearSign.

// A slatted wooden crate over a dark core, turned ry around its centre. No rng
// draws in here: the caller supplies ry, so the draw order stays the same.
export function crate(ctx, mat, cx, cy, cz, sx, sy, sz, ry) {
  const { mats, box } = ctx;
  const c = Math.cos(ry), s = Math.sin(ry), uv = [0.8, 0.8];
  const part = (dx, dy, dz, w, h, d, rx = 0) =>
    box(mat, cx + dx * c + dz * s, cy + dy, cz - dx * s + dz * c, w, h, d, uv, ry, rx);
  box(mats.cable, cx, cy, cz, sx - 0.04, sy - 0.02, sz - 0.04, null, ry);
  const t = 0.016, hx = sx / 2 - t / 2, hz = sz / 2 - t / 2;
  for (let k = -1; k <= 1; k++) {
    const dy = k * sy / 3, h = sy / 3 - 0.009;
    for (const d of [-1, 1]) {
      part(d * hx, dy, 0, t, h, sz - 0.01);
      part(0, dy, d * hz, sx - 0.01, h, t);
    }
  }
  // lid boards, corner posts and a diagonal brace on each long side
  for (let k = -2; k <= 2; k++) part(0, sy / 2 - 0.008, k * sz / 5, sx, 0.016, sz / 5 - 0.016);
  for (const dx of [-1, 1]) {
    for (const dz of [-1, 1]) part(dx * (sx / 2 - 0.012), 0, dz * (sz / 2 - 0.012), 0.036, sy, 0.036);
    part(dx * (hx + 0.012), 0, 0, 0.012, Math.hypot(sy, sz) - 0.05, 0.04, dx * Math.atan2(sz, sy));
  }
}

// A lumpy bag with a tied neck. The caller draws its size, so no rng draws here.
export function trashBag(ctx, mat, x, y, z, sx, sy, sz, k) {
  const { sph, cyl } = ctx;
  const a = k * 2.4 + x * 5;
  sph(mat, x, y, z, sx, sy, sz, true);
  sph(mat, x + Math.cos(a) * sx * 0.45, y - sy * 0.25, z + Math.sin(a) * sz * 0.45, sx * 0.62, sy * 0.68, sz * 0.62, true);
  const top = y + sy * 0.92;
  cyl(mat, x, top + 0.03, z, 0.028, 0.08, 0, 0, 0, true);
  sph(mat, x, top + 0.05, z, 0.04, 0.018, 0.04, true);
  for (const e of [-1, 1]) sph(mat, x + e * 0.03, top + 0.095, z - e * 0.012, 0.042, 0.016, 0.022, true);
}

// Loose rubbish on the ground, from its own rng so the kit's draws don't change.
const litterRng = (z) => mulberry32(Math.round(Math.abs(z) * 100) + 7);
export function litter(ctx, side, zz) {
  const { mats, box, cyl, sph } = ctx;
  const r = litterRng(zz);
  const px = () => side * (1.45 + r() * 0.7), pz = () => zz + (r() - 0.5) * 1.5;

  // a flattened box
  if (r() < 0.6) {
    const x = px(), z = pz();
    box(mats.cardboard, x, 0.008, z, 0.34 + r() * 0.16, 0.012, 0.42 + r() * 0.2, null, r() * 3);
  }
  // cans on their sides
  const cans = 1 + Math.floor(r() * 3);
  for (let k = 0; k < cans; k++) {
    const x = px(), z = pz(), ry = r() * 3;
    cyl(k % 2 ? mats.plasticRed : mats.metal, x, 0.033, z, 0.033, 0.12, 0, ry, Math.PI / 2, true);
  }
  // balled-up paper
  const paper = 1 + Math.floor(r() * 3);
  for (let k = 0; k < paper; k++) {
    const x = px(), z = pz(), s = 0.03 + r() * 0.03;
    sph(mats.foam, x, s * 0.7, z, s, s * 0.75, s * 1.1, true);
  }
  // Draws below come after the ones above, so the older litter stays where it was.
  const crushed = Math.floor(r() * 3);
  for (let k = 0; k < crushed; k++) crushedCan(ctx, k % 2 ? mats.plasticRed : mats.metal, px(), pz(), r() * 3, 0.2 + r() * 0.35);
  if (r() < 0.55) brokenBottle(ctx, r() < 0.5 ? mats.glassGreen : mats.glassBrown, px(), pz(), r);
  const caps = Math.floor(r() * 4);
  for (let k = 0; k < caps; k++) cyl(mats.metalLight, px(), 0.003, pz(), 0.013, 0.005, 0, 0, 0, true);
  if (r() < 0.35) {
    // a noodle cup on its side, with its lid beside it
    const x = px(), z = pz(), ry = r() * 3, lx = px(), lz = pz();
    cyl(mats.foam, x, 0.042, z, 0.042, 0.1, 0, ry, Math.PI / 2, true);
    cyl(mats.plasticRed, lx, 0.002, lz, 0.044, 0.003, 0, 0, 0, true);
  }
}

// A can stamped flat, bent in the middle. The caller draws the values.
function crushedCan(ctx, mat, x, z, ry, bend) {
  const { squashedCyl } = ctx;
  const ax = Math.cos(ry), az = -Math.sin(ry), off = 0.024 * Math.cos(bend), y = 0.014 + 0.024 * Math.sin(bend);
  for (const d of [-1, 1]) {
    squashedCyl(mat, x + d * ax * off, y, z + d * az * off, 0.013, 0.05, 0.036, 0, ry, Math.PI / 2 + d * bend);
  }
}

// The base and neck of a bottle, and shards lying flat around them.
function brokenBottle(ctx, mat, x, z, r) {
  const { cyl, prism } = ctx;
  const ry = r() * 3, ax = Math.cos(ry), az = -Math.sin(ry);
  cyl(mat, x, 0.032, z, 0.032, 0.08, 0, ry, Math.PI / 2);
  // jagged teeth around the broken end
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * Math.PI * 2, len = 0.02 + r() * 0.03;
    const ox = -ax * (0.04 + len / 2) - az * Math.cos(a) * 0.025, oz = -az * (0.04 + len / 2) + ax * Math.cos(a) * 0.025;
    prism(mat, x + ox, 0.032 + Math.sin(a) * 0.025, z + oz, 0.012, len, 0, ry, Math.PI / 2);
  }
  // the neck lies a little way off, turned its own way
  const nx = x + (r() - 0.5) * 0.4, nz = z + (r() - 0.5) * 0.4, nry = r() * 3;
  cyl(mat, nx, 0.016, nz, 0.016, 0.075, 0, nry, Math.PI / 2, true);
  const shards = 4 + Math.floor(r() * 5);
  for (let k = 0; k < shards; k++) {
    const a = r() * Math.PI * 2, d = 0.06 + r() * 0.22;
    prism(mat, x + Math.cos(a) * d, 0.002, z + Math.sin(a) * d, 0.01 + r() * 0.022, 0.004, 0, r() * 3);
  }
}
