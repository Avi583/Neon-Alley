// The alley itself: two rows of buildings with shopfronts, ledges, fire
// escapes, AC units, pipes, cables, icicles and street clutter, plus the
// cross street at the far end and a skyline of towers behind it all.
import * as THREE from 'three';
import { WALL, NEON } from './config.js';
import { buildShops } from './shops.js';
import { CAN_FLAVOURS } from './canvas-art.js';
import { shopUnit, acUnit, fireEscape } from './alley-units.js';
import { crate, trashBag, litter } from './alley-litter.js';

export const ALLEY = {
  half: WALL,
  zStart: 16,
  zEnd: -92,
  walkX: 1.75,
  walkZMin: -91,
  walkZMax: 8,
};

// ctx is the placement kit plus mats, vents, addLight, addCollider and nearSign.

// ------------------------------------------------------------ buildings
function buildBuildings(ctx) {
  const { mats, R, rng, pick, box, cyl, sph, icicles, snow, nearSign } = ctx;
  for (const side of [-1, 1]) {
    let z = ALLEY.zStart + 8;
    while (z > ALLEY.zEnd + 0.5) {
      const len = Math.min(R(7, 15), z - ALLEY.zEnd);
      const z0 = z, z1 = z - len, zc = (z0 + z1) / 2;
      const inset = R(0, 0.3);
      const xi = ALLEY.half + inset;
      const depth = 14, gf = 4.2;
      const gm = rng() < 0.55 ? mats.concrete : mats.brick;
      box(gm, side * (xi + depth / 2), gf / 2, zc, depth, gf, len, [2, 2]);
      const H = rng() < 0.28 ? R(36, 58) : R(16, 32);
      const up = Math.max(ALLEY.half - 0.12, xi + R(-0.2, 0.35));
      box(mats.facade, side * (up + depth / 2), gf + (H - gf) / 2, zc, depth, H - gf, len, [12, 12.8]);

      // ledge between ground floor and upper floors, snowed over with icicles
      const lin = Math.min(xi, up) - 0.28;
      const lw = xi + 0.1 - lin;
      box(mats.concrete, side * (lin + lw / 2), gf, zc, lw, 0.2, len, [2, 2]);
      snow(side * (lin + lw / 2), gf + 0.1, zc, lw, len - 0.02, 0.06);
      icicles(side * (lin + 0.02), gf - 0.1, z0, side * (lin + 0.02), gf - 0.1, z1, 0.55, 0.4);

      // shopfronts
      let u = z0 - 0.4;
      while (true) {
        const w = R(2.4, 3.6);
        if (u - w < z1 + 0.3) break;
        const uc = u - w / 2;
        let kind;
        const rr = rng();
        if (side === -1 && uc > -6.5 && uc < -1) kind = 'door';
        else if (side === 1 && uc > -7 && uc < 0) kind = 'window';
        else kind = rr < 0.34 ? 'shutter' : rr < 0.62 ? 'door' : rr < 0.82 ? 'window' : 'blank';
        if (uc > ALLEY.walkZMax + 2) kind = 'shutter';
        shopUnit(ctx, side, xi, uc, w, kind);
        if (rng() < 0.45) cyl(mats.metal, side * (xi - 0.08), gf / 2, u - w - 0.1, R(0.035, 0.07), gf);
        u -= w + R(0.1, 0.5);
      }
      // a horizontal service pipe under the ledge
      if (rng() < 0.6) cyl(mats.metal, side * (xi - 0.1), 3.7, zc, 0.06, len, Math.PI / 2);

      // AC units on the upper floors
      const nAC = Math.floor(len / 3.2);
      for (let k = 0; k < nAC; k++) {
        const ay = R(5.2, Math.min(H - 1.5, 17));
        const az = R(z1 + 0.6, z0 - 0.6);
        if (nearSign(side, az, 1.5)) continue;
        acUnit(ctx, side, up, ay, az);
      }
      // vertical drain pipes
      const nP = rng() < 0.6 ? 1 : 2;
      for (let k = 0; k < nP; k++) {
        const r = R(0.04, 0.09), pz = R(z1 + 0.3, z0 - 0.3);
        const blocksDoor = ctx.doors.some((d) => Math.sign(d.face) === side && Math.abs(d.z - pz) < 0.7 + r);
        if (!blocksDoor) cyl(mats.metal, side * (up - r - 0.02), H / 2, pz, r, H);
      }
      // fire escapes
      if (rng() < 0.42 && H > 14 && !nearSign(side, zc, 3.4)) fireEscape(ctx, side, up, zc, H);
      // neon accent strip running up a corner
      if (rng() < 0.32) {
        box(mats.strip(pick(NEON), 5), side * (up - 0.03), gf + (H - gf) / 2, z0 - 0.06, 0.04, H - gf, 0.04);
      }
      // roof
      ctx.drift(side * (up + depth / 2), H, zc, depth, 0.14, len);
      box(mats.concrete, side * (up + 0.1), H + 0.45, zc, 0.2, 0.9, len, [2, 2]);
      snow(side * (up + 0.1), H + 0.9, zc, 0.22, len);
      icicles(side * (up - 0.01), H, z0, side * (up - 0.01), H, z1, 0.4, 0.5);
      if (rng() < 0.4) cyl(mats.metal, side * (up + R(2.5, 5)), H + 1.4, R(z1 + 1.5, z0 - 1.5), 1.0, 2.8);
      if (rng() < 0.5) {
        const ax = side * (up + R(1, 4)), azz = R(z1 + 1, z0 - 1), ah = R(3, 6);
        cyl(mats.metalDark, ax, H + ah / 2, azz, 0.04, ah, 0, 0, 0, true);
        sph(mats.beacon, ax, H + ah + 0.05, azz, 0.09);
      }
      z = z1;
    }
  }

  // Back wall behind the start
  box(mats.facade, 0, 4.2 + 16, ALLEY.zStart + 7, 20, 32, 14, [12, 12.8]);
  box(mats.concrete, 0, 2.1, ALLEY.zStart + 7, 20, 4.2, 14, [2, 2]);
  box(mats.shutter, 0, 1.35, ALLEY.zStart - 0.03, 3.4, 2.7, 0.06, [2, 2]);
  box(mats.strip('#ff3fa4', 5), 0, 2.9, ALLEY.zStart - 0.06, 3.6, 0.04, 0.04);
}

// ---------------------------------------------------------- overhead
function buildOverhead(ctx) {
  const { mats, R, rng, pick, sph, catenary, tube } = ctx;
  for (let i = 0; i < 30; i++) {
    const zz = R(ALLEY.zEnd + 3, ALLEY.zStart - 3);
    const y1 = R(5, 13.5), y2 = y1 + R(-1.5, 1.5);
    const dz = R(-3, 3);
    const n = rng() < 0.35 ? 3 : 1;
    for (let k = 0; k < n; k++) {
      const a = new THREE.Vector3(-WALL - 0.05, y1 + k * 0.12, zz + k * 0.1);
      const b = new THREE.Vector3(WALL + 0.05, y2 + k * 0.1, zz + dz + k * 0.15);
      tube(catenary(a, b, R(0.3, 1.2)), R(0.012, 0.022), mats.cable, 20);
    }
    if (i % 7 === 3) {
      // string of little bulbs
      const a = new THREE.Vector3(-WALL, y1 - 0.8, zz), b = new THREE.Vector3(WALL, y1 - 0.6, zz + dz * 0.5);
      const pts = catenary(a, b, 0.5, 30);
      tube(pts, 0.008, mats.cable, 30);
      const bulb = mats.strip(pick(['#ffd08a', '#ff8ad8', '#8ae8ff']), 2.5);
      for (let k = 1; k < pts.length - 1; k++) sph(bulb, pts[k].x, pts[k].y - 0.05, pts[k].z, 0.035, 0.035, 0.035, true);
    }
  }
  // cables running along the walls
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const za = ALLEY.zStart - k * 26, zb = za - 26;
      const a = new THREE.Vector3(side * (WALL - 0.05), 3.85 + k * 0.05, za);
      const b = new THREE.Vector3(side * (WALL - 0.05), 3.9, zb);
      tube(catenary(a, b, 0.25, 16), 0.018, mats.cable, 24);
    }
  }
}

// ------------------------------------------------------- street props
function buildStreetProps(ctx) {
  const { mats, R, rng, pick, box, cyl, sph, plane, icicles, snow, tube, vents, addLight, addCollider } = ctx;
  // Paper lanterns at the izakaya
  for (const lz of [-4.15, -8.0]) { // -4.15 is the gap between two door awnings
    const lx = -WALL + 0.45;
    tube([new THREE.Vector3(lx, 3.6, lz), new THREE.Vector3(lx, 3.35, lz)], 0.006, mats.cable, 2);
    sph(mats.lantern, lx, 3.05, lz, 0.2, 0.3, 0.2);
    cyl(mats.metalDark, lx, 3.36, lz, 0.11, 0.05);
    cyl(mats.metalDark, lx, 2.74, lz, 0.11, 0.05);
    snow(lx, 3.38, lz, 0.18, 0.18, 0.04);
    addLight(lx + 0.3, 3.0, lz, '#ff5a2a', 2.5, 6);
  }

  // Steam vents (grates in the ground) — steam is spawned from these
  const ventDefs = [
    { x: 0.9, z: -9.4, tint: [1.0, 0.78, 0.95], scale: 1.1 },
    { x: -0.9, z: -31, tint: [0.72, 0.95, 1.1], scale: 1 },
    { x: 0.5, z: -53, tint: [0.92, 0.75, 1.1], scale: 1 },
    { x: -0.6, z: -76, tint: [1.0, 0.8, 0.9], scale: 0.9 },
    { x: 0, z: -97, tint: [1.1, 0.75, 0.95], scale: 1.6 },
  ];
  for (const v of ventDefs) {
    box(mats.grate, v.x, 0.012, v.z, 0.9, 0.024, 0.6);
    vents.push({ pos: new THREE.Vector3(v.x, 0.05, v.z), tint: v.tint, scale: v.scale });
  }
  // wall vent
  box(mats.metalDark, -WALL + 0.04, 0.55, -20.5, 0.1, 0.5, 0.7);
  vents.push({ pos: new THREE.Vector3(-WALL + 0.4, 0.5, -20.5), tint: [0.75, 0.95, 1.1], scale: 0.7 });

  // manhole covers
  cyl(mats.metalDark, -0.3, 0.008, -17, 0.38, 0.016);
  cyl(mats.metalDark, 0.4, 0.008, -44, 0.38, 0.016);

  // vending machine
  {
    const vz = -26.5, side = 1, d = 0.75;
    const cx = side * (WALL + 0.05 - d / 2);
    const face = cx - side * d / 2, ry = -side * Math.PI / 2;
    const inset = (depth) => face + side * depth;
    // Cabinet: hollow between y = 0.72 and 1.62, with the back wall at depth 0.46.
    for (const e of [-1, 1]) box(mats.metalRed, cx, 0.95, vz + e * 0.46, d, 1.9, 0.03);
    box(mats.metalRed, cx, 1.76, vz, d, 0.28, 0.89);
    box(mats.metalRed, cx, 0.48, vz, d, 0.48, 0.89);
    box(mats.metalRed, inset(0.605), 1.17, vz, 0.29, 0.9, 0.89);
    plane(mats.strip('#bcd8ff', 0.4), inset(0.455), 1.17, vz, 0.89, 0.9, ry);
    box(mats.strip('#eaf6ff', 2.2), inset(0.2), 1.6, vz, 0.04, 0.02, 0.76);
    // Pickup bin: a real recess in the base. Its flap and cans move, so vending.js builds them.
    box(mats.metalRed, inset(0.46), 0.12, vz, 0.58, 0.24, 0.89);
    box(mats.metalDark, inset(0.085), 0.05, vz, 0.17, 0.1, 0.89);
    for (const e of [-1, 1]) box(mats.metalRed, inset(0.085), 0.17, vz + e * 0.345, 0.17, 0.14, 0.19);
    box(mats.cable, inset(0.166), 0.17, vz, 0.008, 0.14, 0.5);
    box(mats.metalLight, inset(0.008), 0.243, vz, 0.016, 0.012, 0.52);
    box(mats.metalLight, inset(0.008), 0.097, vz, 0.016, 0.012, 0.52);
    // Door frame around the glass, with a dark gasket inside it
    for (const e of [-1, 1]) {
      box(mats.metalRed, inset(0.02), 1.17, vz + e * 0.4175, 0.04, 0.9, 0.055);
      box(mats.metalDark, inset(0.025), 1.17, vz + e * 0.385, 0.03, 0.9, 0.01);
    }
    for (const y of [0.725, 1.615]) box(mats.metalDark, inset(0.025), y, vz, 0.03, 0.01, 0.78);
    // Shelves with price rails, set back to leave a drop channel behind the glass, then
    // a price tag and button per slot. The coils and cans move, so vending.js builds them.
    const slots = [];
    for (let row = 0; row < 4; row++) {
      const base = 0.745 + row * 0.22;
      box(mats.metalLight, inset(0.32), base - 0.008, vz, 0.26, 0.016, 0.89);
      box(mats.metalDark, inset(0.185), base - 0.02, vz, 0.012, 0.04, 0.76);
      for (let k = 0; k < 6; k++) {
        const z = vz + (k - 2.5) * 0.125;
        slots.push({ z, base, flavour: (k * (row % 2 ? 5 : 1) + row * 2) % CAN_FLAVOURS });
        plane(mats.vendingPrice, inset(0.178), base - 0.02, z - 0.016, 0.08, 0.036, ry);
        box(mats.strip('#ff3d5a', 0.9), inset(0.177), base - 0.02, z + 0.044, 0.006, 0.018, 0.018);
      }
    }
    // Hatch in the channel floor that falling cans pass through on the way to the bin
    box(mats.metalDark, inset(0.11), 0.721, vz, 0.13, 0.002, 0.78);
    plane(mats.vendingGlass, inset(0.03), 1.17, vz, 0.78, 0.9, ry);
    // Header sign and control panel, with a coin plate and return button on it
    plane(mats.vendingHeader, face - side * 0.002, 1.76, vz, 0.89, 0.24, ry);
    plane(mats.vendingPanel, face - side * 0.002, 0.48, vz, 0.89, 0.48, ry);
    const hardwareZ = vz + 0.27;
    box(mats.metalLight, face - side * 0.008, 0.55, hardwareZ, 0.016, 0.16, 0.12);
    box(mats.cable, face - side * 0.017, 0.585, hardwareZ, 0.002, 0.05, 0.008);
    box(mats.cable, face - side * 0.017, 0.52, hardwareZ, 0.002, 0.012, 0.06);
    cyl(mats.plasticRed, face - side * 0.012, 0.425, hardwareZ, 0.022, 0.024, 0, 0, Math.PI / 2);
    snow(cx, 1.9, vz, d, 0.95, 0.06);
    icicles(cx - side * d / 2, 1.88, vz - 0.45, cx - side * d / 2, 1.88, vz + 0.45, 0.5, 0.25);
    addCollider(cx - d / 2, cx + d / 2, vz - 0.5, vz + 0.5);
    addLight(cx - side * 1.0, 1.2, vz, '#dff2ff', 2.5, 6);
    ctx.vending = { face, z: vz, side, slots };
  }

  // dumpster
  {
    const dz = -41, side = -1, d = 1.0;
    const cx = side * (WALL - d / 2 - 0.05);
    box(mats.metalGreen, cx, 0.69, dz, d, 1.1, 1.9);
    box(mats.metalGreen, cx + 0.05, 1.3, dz, d + 0.1, 0.06, 1.95, null, 0, 0, 0.08);
    snow(cx + 0.05, 1.33, dz, d, 1.9, 0.08);
    addCollider(cx - d / 2, cx + d / 2, dz - 1, dz + 1);
    // ribs, top rim, lift bar, end sleeves and casters
    const face = cx - side * d / 2;
    for (let k = -2; k <= 2; k++) box(mats.metalGreen, face - side * 0.015, 0.69, dz + k * 0.42, 0.03, 1.08, 0.07);
    box(mats.metalGreen, face - side * 0.025, 1.18, dz, 0.05, 0.08, 1.92);
    cyl(mats.metal, face - side * 0.07, 0.95, dz, 0.018, 1.5, Math.PI / 2);
    for (const e of [-1, 1]) {
      box(mats.metalDark, cx, 0.8, dz + e * 0.965, 0.2, 0.14, 0.03);
      for (const dx of [-0.34, 0.34]) {
        box(mats.metalDark, cx + dx, 0.13, dz + e * 0.75, 0.1, 0.03, 0.1);
        cyl(mats.cable, cx + dx, 0.065, dz + e * 0.75, 0.065, 0.05, Math.PI / 2);
      }
    }
  }

  // trash bags, crates and barrels along the walls
  const busy = (z) => Math.abs(z + 26.5) < 1.5 || Math.abs(z + 41) < 2 || vents.some((v) => Math.abs(v.pos.z - z) < 1.2);
  for (let i = 0; i < 22; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    const zz = R(ALLEY.zEnd + 4, 6);
    if (busy(zz)) continue;
    const kind = rng();
    if (kind < 0.5) {
      const n = 2 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const bx = side * R(1.95, 2.25), by = 0.22 + k * 0.04, bz = zz + R(-0.5, 0.5);
        const sx = R(0.26, 0.36), sy = R(0.22, 0.3), sz = R(0.26, 0.34);
        trashBag(ctx, k % 3 === 2 ? mats.trashBlue : mats.trash, bx, by, bz, sx, sy, sz, k);
      }
      litter(ctx, side, zz);
      addCollider(side * 1.75, side * 2.4, zz - 0.6, zz + 0.6);
    } else if (kind < 0.8) {
      const stack = 1 + Math.floor(rng() * 4);
      const mat = pick([mats.wood, mats.woodDark, mats.woodWorn]);
      const cx = side * 2.05;
      for (let k = 0; k < stack; k++) crate(ctx, mat, cx, 0.16 + k * 0.32, zz, 0.42, 0.3, 0.56, R(-0.1, 0.1));
      snow(cx, stack * 0.32 - 0.012, zz, 0.24, 0.3, 0.03);
      addCollider(cx - 0.25, cx + 0.25, zz - 0.32, zz + 0.32);
    } else {
      const cx = side * 2.0;
      cyl(mats.metalDark, cx, 0.45, zz, 0.28, 0.9);
      for (const hy of [0.22, 0.45, 0.68]) cyl(mats.metal, cx, hy, zz, 0.288, 0.025);
      cyl(mats.metal, cx, 0.895, zz, 0.295, 0.02);
      snow(cx, 0.9, zz, 0.4, 0.4, 0.05);
      addCollider(cx - 0.3, cx + 0.3, zz - 0.3, zz + 0.3);
    }
  }
}

// ------------------------------------------------ end of the alley
function buildCrossStreet(ctx) {
  const { mats, box, cyl, sph, plane, snow, addLight } = ctx;
  // The barrier across the mouth of the alley, just past where the walker stops.
  const bz = -91.6, RAIL_SEGMENTS = 9, RAIL_SPAN = 4.3;
  for (const px of [-2.15, 2.15]) {
    box(mats.concrete, px, 0.07, bz, 0.45, 0.14, 0.45, [2, 2]);
    box(mats.metalDark, px, 0.65, bz, 0.1, 1.3, 0.1);
    snow(px, 1.3, bz, 0.16, 0.16, 0.05);
  }
  for (const [row, y] of [0.5, 1].entries()) {
    for (let i = 0; i < RAIL_SEGMENTS; i++) {
      const w = RAIL_SPAN / RAIL_SEGMENTS, x = -RAIL_SPAN / 2 + (i + 0.5) * w;
      box((i + row) % 2 ? mats.plasticYellow : mats.plasticRed, x, y, bz, w, 0.16, 0.04);
    }
  }
  for (const lx of [-1.55, 1.55]) {
    cyl(mats.metalDark, lx, 1.11, bz, 0.05, 0.06);
    sph(mats.blink, lx, 1.18, bz, 0.07);
  }
  snow(-1, 1.08, bz, 0.7, 0.07, 0.03);
  // The sign, on its own pair of posts in front of the rails.
  for (const px of [-0.3, 0.3]) box(mats.metalDark, px, 0.675, bz + 0.03, 0.05, 1.35, 0.02);
  box(mats.metalDark, 0, 1.35, bz + 0.05, 0.84, 1.04, 0.02);
  plane(mats.noEntry, 0, 1.35, bz + 0.065, 0.8, 1);
  snow(0, 1.87, bz + 0.05, 0.84, 0.06, 0.04);

  // cross street
  addLight(0, 4, -99, '#ff4fd8', 28, 22);
  addLight(-14, 3, -103, '#38e8ff', 18, 18);
  addLight(14, 3, -103, '#ffd166', 16, 18);
  box(mats.facade, 0, 20, -113, 160, 40, 14, [12, 12.8]);
  for (let sx = -30; sx <= 30; sx += 5) {
    const shop = [mats.shopRamen, mats.shopBar, mats.shopMart][(sx / 5 + 30) % 3];
    plane(shop, sx, 1.6, -105.95, 4, 2.4, 0);
    box(mats.strip(NEON[(sx / 5 + 30) % NEON.length], 5), sx, 3.0, -105.9, 4.2, 0.05, 0.05);
  }
  ctx.drift(0, 0, -105.3, 160, 0.3, 1.0);
  ctx.drift(-30, 0, -92.6, 54, 0.26, 0.8);
  ctx.drift(30, 0, -92.6, 54, 0.26, 0.8);
}

// -------------------------------------------------------- skyline
function buildSkyline(ctx) {
  const { mats, R, rng, pick, box, sph, plane } = ctx;
  let adIdx = 0;
  for (let i = 0; i < 70; i++) {
    let x, z;
    const back = rng() < 0.22;
    do {
      x = R(-110, 110);
      z = back ? R(40, 200) : R(-280, -30);
    } while ((Math.abs(x) < 22 && z > -125 && z < 60));
    const w = R(14, 30), d = R(14, 30), h = R(60, 220);
    box(mats.tower, x, h / 2, z, w, h, d, [8, 8.5]);
    if (rng() < 0.35) box(mats.strip(pick(NEON), 4), x - w / 2, h / 2, z + (back ? -d / 2 : d / 2), 0.4, h, 0.4);
    if (rng() < 0.6) sph(mats.beacon, x, h + 1.2, z, 0.5, 0.5, 0.5, true);
    if (!back && adIdx < 6 && rng() < 0.3 && Math.abs(x) < 70) {
      const aw = w * 0.75;
      plane(mats.ads[adIdx % mats.ads.length], x, h * R(0.45, 0.7), z + d / 2 + 0.3, aw, aw * 1.5, 0);
      adIdx++;
    }
  }
}

export function buildAlley(kit, mats, signSpecs) {
  const colliders = [];
  const vents = [];
  const lights = [];
  const addLight = (x, y, z, color, intensity, range = 10) =>
    lights.push({ pos: new THREE.Vector3(x, y, z), color: new THREE.Color(color), intensity, range });
  const addCollider = (x0, x1, z0, z1) =>
    colliders.push({ minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) });

  const signZ = { '-1': [], '1': [] };
  // Shopfront signs stay out: nearSign decides what gets built, which changes the rng draws.
  for (const s of signSpecs) if (s.side && !s.shopfront) signZ[s.side].push(s.z);
  const nearSign = (side, z, r) => signZ[side].some((sz) => Math.abs(sz - z) < r);
  const ctx = { ...kit, mats, vents, addLight, addCollider, nearSign, doors: [], neonForms: [], foodSpots: [] };

  // All of these draw from one rng, so this order fixes the layout.
  buildBuildings(ctx);
  buildOverhead(ctx);
  buildStreetProps(ctx);
  buildCrossStreet(ctx);
  buildSkyline(ctx);
  buildShops(ctx);

  return { colliders, vents, lights, vending: ctx.vending, doors: ctx.doors, neonForms: ctx.neonForms, foodSpots: ctx.foodSpots };
}
