// The ground-floor units along each wall: shopfronts, doors, graffiti, AC units
// and fire escapes. Placed by buildBuildings in alley.js.
import * as THREE from 'three';
import { NEON } from './config.js';
import { mulberry32 } from './noise.js';
import { GRAFFITI_CELLS, GRAFFITI_ROBOT, GRAFFITI_GITHUB } from './graffiti-art.js';

// ctx is the placement kit plus mats, vents, addLight, addCollider and nearSign.

export function shopUnit(ctx, side, xi, zc, w, kind) {
  const { mats, rng, pick, box, plane, icicles, snow, addLight, addCollider } = ctx;
  const out = -side;
  const fx = side * xi; // signed x of this wall face
  const faceRot = out * Math.PI / 2; // plane rotation so it faces into the alley

  if (kind === 'shutter') {
    const sw = w - 0.5, sh = 2.7;
    box(mats.shutter, fx + out * 0.03, sh / 2, zc, 0.06, sh, sw, [2, 2]);
    box(mats.metalDark, fx + out * 0.17, sh + 0.18, zc, 0.34, 0.36, sw + 0.12);
    snow(fx + out * 0.17, sh + 0.36, zc, 0.34, sw + 0.1);
    icicles(fx + out * 0.33, sh, zc - sw / 2, fx + out * 0.33, sh, zc + sw / 2, 0.55, 0.4);
    for (const d of [-1, 1]) box(mats.metalDark, fx + out * 0.05, sh / 2, zc + d * (sw / 2 + 0.04), 0.1, sh, 0.08);
  } else if (kind === 'door') {
    const c = pick(NEON);
    ctx.doors.push({ face: fx + out * 0.1, z: zc });
    box(mats.metalDark, fx + out * 0.03, 1.1, zc, 0.06, 2.2, 1.05);
    box(mats.strip('#9fd8ff', 1.4), fx + out * 0.065, 1.7, zc, 0.01, 0.32, 0.45);
    doorFrame(ctx, fx, out, zc);
    doorHinges(ctx, fx, out, zc);
    doorHandle(ctx, fx, out, zc);
    box(mats.strip(c, 3.5), fx + out * 0.08, 1.3, zc + 0.68, 0.035, 2.4, 0.035);
    box(mats.strip(c, 3.5), fx + out * 0.08, 1.3, zc - 0.68, 0.035, 2.4, 0.035);
    box(mats.strip(c, 3.5), fx + out * 0.08, 2.5, zc, 0.035, 0.035, 1.4);
    addLight(fx + out * 0.7, 1.6, zc, c, 3.2, 7);
    if (rng() < 0.65) {
      const aw = Math.min(w - 0.2, 2.6), tilt = side * 0.22;
      box(mats.metalDark, fx + out * 0.55, 2.95, zc, 1.1, 0.06, aw, null, 0, 0, tilt);
      ctx.drift(fx + out * 0.55, 2.97, zc, 1.08, 0.1, aw - 0.04, tilt);
      icicles(fx + out * 1.08, 2.82, zc - aw / 2, fx + out * 1.08, 2.82, zc + aw / 2, 0.75, 0.5);
      box(mats.strip('#dff6ff', 3), fx + out * 0.3, 2.86, zc, 0.05, 0.04, aw - 0.4);
      addLight(fx + out * 0.6, 2.4, zc, '#cfeaff', 4, 8);
    }
  } else if (kind === 'window') {
    const shop = pick([mats.shopRamen, mats.shopBar, mats.shopMart]);
    const ww = w - 0.8;
    plane(shop, fx + out * 0.035, 1.5, zc, ww, 1.6, faceRot);
    box(mats.metalDark, fx + out * 0.06, 0.66, zc, 0.12, 0.08, ww + 0.1);
    box(mats.metalDark, fx + out * 0.06, 2.34, zc, 0.12, 0.08, ww + 0.1);
    for (const d of [-1, 1]) box(mats.metalDark, fx + out * 0.06, 1.5, zc + d * (ww / 2 + 0.02), 0.12, 1.75, 0.06);
    box(mats.concrete, fx + out * 0.12, 0.6, zc, 0.24, 0.08, ww + 0.2, [2, 2]);
    snow(fx + out * 0.12, 0.64, zc, 0.24, ww + 0.15, 0.04);
    const col = shop === mats.shopRamen ? '#ffb36b' : shop === mats.shopBar ? '#ff6ad5' : '#d8f1ff';
    addLight(fx + out * 0.9, 1.6, zc, col, 3, 7);
  } else {
    // blank wall with ground-level AC units and junk
    const n = rng() < 0.5 ? 1 : 2;
    for (let k = 0; k < n; k++) {
      const az = zc + (k - (n - 1) / 2) * 0.95;
      acUnit(ctx, side, xi, 0.34, az, true);
    }
    addCollider(fx, fx + out * 0.55, zc - n * 0.5, zc + n * 0.5);
  }
  unitGraffiti(ctx, side, fx, out, zc, w, kind);
}

// Paint on a ground-floor unit, from its own rng so the kit's draws don't change.
// Pieces keep to bare wall and shutters, clear of doors, glass and AC units.
const ASPECT = 1.5; // of one atlas cell
const graffitiRng = (side, zc) => mulberry32(Math.round(Math.abs(zc) * 100) * 2 + (side > 0 ? 1 : 0) + 31);
function unitGraffiti(ctx, side, fx, out, zc, w, kind) {
  const r = graffitiRng(side, zc);
  // The robot lands on three walls. The one on the right, near the vending machine, shows the GitHub mark instead.
  const pickCell = () => {
    const cell = Math.floor(r() * GRAFFITI_CELLS);
    return cell === GRAFFITI_ROBOT && side > 0 ? GRAFFITI_GITHUB : cell;
  };
  const piece = (depth, y, z, pw) => ctx.atlasPlane(ctx.mats.graffiti, fx + out * depth, y, z, pw, pw / ASPECT,
    pickCell(), GRAFFITI_CELLS, out * Math.PI / 2);
  if (kind === 'shutter') {
    if (r() < 0.55) {
      const pw = Math.min(1.3 + r() * 0.9, w - 0.8);
      piece(0.066, 0.55 + pw / ASPECT / 2 + r() * 0.5, zc + (r() - 0.5) * (w - 0.8 - pw), pw);
    }
  } else if (kind === 'door') {
    // on the wall beside the door, outside its neon strips
    const room = w / 2 - 0.82;
    if (room > 0.4 && r() < 0.7) {
      const pw = Math.min(0.55 + r() * 0.5, room), d = r() < 0.5 ? -1 : 1;
      piece(0.008, 0.9 + r() * 0.8, zc + d * (0.75 + room / 2), pw);
    }
  } else if (kind === 'window') {
    // a small tag under the sill
    if (r() < 0.45) piece(0.008, 0.3, zc + (r() - 0.5) * (w - 1.6), 0.55 + r() * 0.15);
  } else if (r() < 0.9) {
    // blank wall: the big pieces, above the AC units
    const pw = Math.min(1.7 + r() * 0.9, w - 0.3);
    piece(0.008, 0.85 + pw / ASPECT / 2 + r() * 0.3, zc, pw);
  }
}

// Which edge of the door the handle is on. The hinges go on the other one.
const doorHand = (zc) => (Math.floor(Math.abs(zc) * 10) % 2 ? 1 : -1);

// Two posts, a head and a threshold, between the door and its neon strips.
function doorFrame(ctx, fx, out, zc) {
  const { mats, box } = ctx;
  const at = (d) => fx + out * d;
  for (const d of [-1, 1]) box(mats.metal, at(0.045), 1.13, zc + d * 0.575, 0.09, 2.26, 0.1);
  box(mats.metal, at(0.045), 2.25, zc, 0.09, 0.1, 1.25);
  box(mats.concrete, at(0.07), 0.015, zc, 0.14, 0.03, 1.25, [2, 2]);
}

// Three butt hinges: a leaf on the door and on the post, either side of the knuckle.
function doorHinges(ctx, fx, out, zc) {
  const { mats, box, cyl } = ctx;
  const at = (d) => fx + out * d;
  const edge = -doorHand(zc);
  for (const y of [0.32, 1.1, 1.88]) {
    box(mats.metalLight, at(0.064), y, zc + edge * 0.495, 0.008, 0.1, 0.05);
    box(mats.metalLight, at(0.094), y, zc + edge * 0.55, 0.008, 0.1, 0.04);
    cyl(mats.metalLight, at(0.094), y, zc + edge * 0.525, 0.012, 0.11, 0, 0, 0, true);
  }
}

// A knob, lever or pull bar. No rng draws: the door's position picks the style
// and which edge it sits on.
function doorHandle(ctx, fx, out, zc) {
  const { mats, box, cyl, sph } = ctx;
  const hand = doorHand(zc), style = Math.floor(Math.abs(zc) * 10) % 3;
  const hz = zc + hand * 0.42, y = 1.02, at = (d) => fx + out * d;
  if (style === 2) {
    cyl(mats.metalLight, at(0.115), y + 0.08, hz, 0.012, 0.42, 0, 0, 0, true);
    for (const dy of [-0.08, 0.24]) cyl(mats.metalLight, at(0.085), y + dy, hz, 0.008, 0.05, 0, 0, Math.PI / 2, true);
    return;
  }
  box(mats.metal, at(0.065), y, hz, 0.01, 0.17, 0.055);
  box(mats.cable, at(0.071), y - 0.055, hz, 0.003, 0.022, 0.01);
  cyl(mats.metalLight, at(0.085), y + 0.02, hz, 0.011, 0.04, 0, 0, Math.PI / 2, true);
  if (style === 0) sph(mats.metalLight, at(0.11), y + 0.02, hz, 0.028);
  else box(mats.metalLight, at(0.105), y + 0.02, hz - hand * 0.045, 0.016, 0.018, 0.11);
}

export function acUnit(ctx, side, faceX, y, z, ground = false) {
  const { mats, box, cyl, plane, icicles, snow, tube } = ctx;
  const out = -side;
  const fx = side * faceX;
  const d = 0.34;
  const at = (k) => fx + out * k;
  box(mats.metalLight, fx + out * (d / 2 + 0.02), y, z, d, 0.62, 0.86);
  plane(mats.acFront, fx + out * (d + 0.025), y, z, 0.86, 0.62, out * Math.PI / 2);
  snow(fx + out * (d / 2 + 0.02), y + 0.31, z, d, 0.86);
  icicles(fx + out * (d + 0.02), y - 0.31, z - 0.4, fx + out * (d + 0.02), y - 0.31, z + 0.4, 0.6, ground ? 0.1 : 0.25);

  // raised casing around the front
  for (const dy of [-0.3, 0.3]) box(mats.metal, at(d + 0.03), y + dy, z, 0.02, 0.02, 0.86);
  for (const dz of [-0.42, 0.42]) box(mats.metal, at(d + 0.03), y, z + dz, 0.02, 0.62, 0.02);

  // fan guard over the fan painted on acFront: rim and hub
  const fz = z + out * 0.12, fr = 0.26, rim = [];
  for (let k = 0; k <= 16; k++) {
    const a = k / 16 * Math.PI * 2;
    rim.push(new THREE.Vector3(at(d + 0.04), y + Math.cos(a) * fr, fz + Math.sin(a) * fr));
  }
  tube(rim, 0.009, mats.metalDark, 16);
  cyl(mats.metalDark, at(d + 0.04), y, fz, 0.035, 0.03, 0, 0, Math.PI / 2, true);

  // Only seen up close at street level: guard spokes, and louvres over the painted vent.
  if (ground) {
    for (let k = 0; k < 4; k++) box(mats.metalDark, at(d + 0.04), y, fz, 0.007, fr * 2, 0.007, null, 0, k * Math.PI / 4);
    const vz = z - out * 0.3225;
    for (let k = -3; k <= 3; k++) box(mats.metalDark, at(d + 0.035), y + k * 0.055, vz, 0.012, 0.012, 0.11);
  }

  // coolant lines: out of the side of the casing and up the wall
  const lz = z - out * 0.45;
  for (const [ly, r, mat] of [[y + 0.1, 0.011, mats.copper], [y - 0.02, 0.018, mats.cable]]) {
    cyl(mat, at(0.13), ly, lz, r, 0.18, 0, 0, Math.PI / 2, true);
  }
  cyl(mats.copper, at(0.045), y + 0.48, lz - 0.02, 0.011, 0.76, 0, 0, 0, true);
  cyl(mats.cable, at(0.045), y + 0.42, lz + 0.02, 0.018, 0.88, 0, 0, 0, true);

  if (ground) {
    for (const dz of [-0.3, 0.3]) box(mats.metalDark, at(d / 2 + 0.02), 0.015, z + dz, d, 0.03, 0.07);
  } else {
    box(mats.metalDark, fx + out * 0.2, y - 0.34, z - 0.3, 0.4, 0.04, 0.04);
    box(mats.metalDark, fx + out * 0.2, y - 0.34, z + 0.3, 0.4, 0.04, 0.04);
    cyl(mats.metalDark, fx + out * 0.05, y - 1.0, z + 0.36, 0.02, 1.4, 0, 0, 0, true);
    acDrip(ctx, fx, out, y - 0.3, z);
  }
}

// A drip stain down the wall, stopping above the ledge. No rng draws: the unit's
// position picks the streak pattern, width and length.
function acDrip(ctx, fx, out, top, z) {
  const { mats, atlasPlane } = ctx;
  const n = Math.floor(Math.abs(z) * 10);
  const w = 0.6 + (n % 3) * 0.1, h = Math.min(1.1 + (n % 5) * 0.3, top - 4.4);
  atlasPlane(mats.acDrip, fx + out * 0.008, top - h / 2, z, w, h, n % 4, 4, out * Math.PI / 2);
}

export function fireEscape(ctx, side, faceX, fz, H) {
  const { mats, box, icicles, snow } = ctx;
  const out = -side;
  const fx = side * faceX;
  for (let fy = 6.0; fy < Math.min(H - 1.5, 16); fy += 3.2) {
    box(mats.metalDark, fx + out * 0.55, fy, fz, 1.1, 0.06, 3.2);
    snow(fx + out * 0.55, fy + 0.03, fz, 1.06, 3.15, 0.04);
    for (const ry of [0.5, 1.0]) box(mats.metalDark, fx + out * 1.08, fy + ry, fz, 0.04, 0.04, 3.2);
    for (let pz = fz - 1.6; pz <= fz + 1.61; pz += 0.4) box(mats.metalDark, fx + out * 1.08, fy + 0.5, pz, 0.03, 1.0, 0.03);
    for (const ez of [-1.6, 1.6]) box(mats.metalDark, fx + out * 0.55, fy + 1.0, fz + ez, 1.1, 0.04, 0.04);
    icicles(fx + out * 1.1, fy - 0.03, fz - 1.6, fx + out * 1.1, fy - 0.03, fz + 1.6, 0.6, 0.35);
    // ladder up to the next platform
    const lz = fz + 1.2;
    for (const dz of [-0.18, 0.18]) box(mats.metalDark, fx + out * 0.85, fy + 1.6, lz + dz, 0.03, 3.2, 0.03);
    for (let ly = fy + 0.3; ly < fy + 3.2; ly += 0.3) box(mats.metalDark, fx + out * 0.85, ly, lz, 0.025, 0.025, 0.36);
  }
}
