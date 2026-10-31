// The alley itself: two rows of buildings with shopfronts, ledges, fire
// escapes, AC units, pipes, cables, icicles and street clutter, plus the
// cross street at the far end and a skyline of towers behind it all.
import * as THREE from 'three';
import { WALL } from './config.js';

export const ALLEY = {
  half: WALL,
  zStart: 16,
  zEnd: -92,
  walkX: 1.75,
  walkZMin: -88,
  walkZMax: 8,
};

const NEON = ['#ff3fa4', '#38e8ff', '#b66bff', '#ff4d6d', '#5dffb4', '#ffd166'];

export function buildAlley(kit, mats, signSpecs) {
  const { R, rng, pick, box, cyl, sph, plane, icicles, snow, catenary, tube } = kit;
  const colliders = [];
  const vents = [];
  const lights = [];
  const addLight = (x, y, z, color, intensity, range = 10) =>
    lights.push({ pos: new THREE.Vector3(x, y, z), color: new THREE.Color(color), intensity, range });
  const addCollider = (x0, x1, z0, z1) =>
    colliders.push({ minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) });

  const signZ = { '-1': [], '1': [] };
  for (const s of signSpecs) if (s.side) signZ[s.side].push(s.z);
  const nearSign = (side, z, r) => signZ[side].some((sz) => Math.abs(sz - z) < r);

  // --------------------------------------------------- ground-floor units
  function shopUnit(side, xi, zc, w, kind) {
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
      box(mats.metalDark, fx + out * 0.03, 1.1, zc, 0.06, 2.2, 1.05);
      box(mats.strip('#9fd8ff', 1.4), fx + out * 0.065, 1.7, zc, 0.01, 0.32, 0.45);
      box(mats.strip(c, 3.5), fx + out * 0.08, 1.3, zc + 0.68, 0.035, 2.4, 0.035);
      box(mats.strip(c, 3.5), fx + out * 0.08, 1.3, zc - 0.68, 0.035, 2.4, 0.035);
      box(mats.strip(c, 3.5), fx + out * 0.08, 2.5, zc, 0.035, 0.035, 1.4);
      addLight(fx + out * 0.7, 1.6, zc, c, 3.2, 7);
      if (rng() < 0.65) {
        const aw = Math.min(w - 0.2, 2.6), tilt = side * 0.22;
        box(mats.metalDark, fx + out * 0.55, 2.95, zc, 1.1, 0.06, aw, null, 0, 0, tilt);
        box(mats.snow, fx + out * 0.55, 3.0, zc, 1.08, 0.06, aw - 0.04, null, 0, 0, tilt);
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
        acUnit(side, xi, 0.34, az, true);
      }
      addCollider(fx, fx + out * 0.55, zc - n * 0.5, zc + n * 0.5);
    }
  }

  function acUnit(side, faceX, y, z, ground = false) {
    const out = -side;
    const fx = side * faceX;
    const d = 0.34;
    box(mats.metalLight, fx + out * (d / 2 + 0.02), y, z, d, 0.62, 0.86);
    plane(mats.acFront, fx + out * (d + 0.025), y, z, 0.86, 0.62, out * Math.PI / 2);
    snow(fx + out * (d / 2 + 0.02), y + 0.31, z, d, 0.86);
    icicles(fx + out * (d + 0.02), y - 0.31, z - 0.4, fx + out * (d + 0.02), y - 0.31, z + 0.4, 0.6, ground ? 0.1 : 0.25);
    if (!ground) {
      box(mats.metalDark, fx + out * 0.2, y - 0.34, z - 0.3, 0.4, 0.04, 0.04);
      box(mats.metalDark, fx + out * 0.2, y - 0.34, z + 0.3, 0.4, 0.04, 0.04);
      cyl(mats.metalDark, fx + out * 0.05, y - 1.0, z + 0.36, 0.02, 1.4, 0, 0, 0, true);
    }
  }

  function fireEscape(side, faceX, fz, H) {
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

  // ------------------------------------------------------------ buildings
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
        shopUnit(side, xi, uc, w, kind);
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
        acUnit(side, up, ay, az);
      }
      // vertical drain pipes
      const nP = rng() < 0.6 ? 1 : 2;
      for (let k = 0; k < nP; k++) {
        const r = R(0.04, 0.09);
        cyl(mats.metal, side * (up - r - 0.02), H / 2, R(z1 + 0.3, z0 - 0.3), r, H);
      }
      // fire escapes
      if (rng() < 0.42 && H > 14 && !nearSign(side, zc, 3.4)) fireEscape(side, up, zc, H);
      // neon accent strip running up a corner
      if (rng() < 0.32) {
        box(mats.strip(pick(NEON), 5), side * (up - 0.03), gf + (H - gf) / 2, z0 - 0.06, 0.04, H - gf, 0.04);
      }
      // roof
      box(mats.snow, side * (up + depth / 2), H + 0.04, zc, depth, 0.08, len);
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

  // ---------------------------------------------------------- overhead
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

  // ------------------------------------------------------- street props
  // Paper lanterns at the izakaya
  for (const lz of [-5.6, -8.0]) {
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
    box(mats.metalRed, cx, 0.95, vz, d, 1.9, 0.95);
    plane(mats.vending, cx - side * (d / 2 + 0.005), 1.0, vz, 0.82, 1.64, -side * Math.PI / 2);
    snow(cx, 1.9, vz, d, 0.95, 0.06);
    icicles(cx - side * d / 2, 1.88, vz - 0.45, cx - side * d / 2, 1.88, vz + 0.45, 0.5, 0.25);
    addCollider(cx - d / 2, cx + d / 2, vz - 0.5, vz + 0.5);
    addLight(cx - side * 1.0, 1.2, vz, '#dff2ff', 2.5, 6);
  }

  // dumpster
  {
    const dz = -41, side = -1, d = 1.0;
    const cx = side * (WALL - d / 2 - 0.05);
    box(mats.metalGreen, cx, 0.62, dz, d, 1.24, 1.9);
    box(mats.metalGreen, cx + 0.05, 1.3, dz, d + 0.1, 0.06, 1.95, null, 0, 0, 0.08);
    snow(cx + 0.05, 1.33, dz, d, 1.9, 0.08);
    addCollider(cx - d / 2, cx + d / 2, dz - 1, dz + 1);
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
        sph(mats.trash, side * R(1.95, 2.25), 0.22 + k * 0.04, zz + R(-0.5, 0.5), R(0.26, 0.36), R(0.22, 0.3), R(0.26, 0.34), true);
      }
      addCollider(side * 1.75, side * 2.4, zz - 0.6, zz + 0.6);
    } else if (kind < 0.8) {
      const stack = 1 + Math.floor(rng() * 4);
      const mat = pick([mats.plasticBlue, mats.plasticRed, mats.plasticYellow]);
      const cx = side * 2.05;
      for (let k = 0; k < stack; k++) box(mat, cx, 0.16 + k * 0.32, zz, 0.42, 0.3, 0.56, null, R(-0.1, 0.1));
      snow(cx, stack * 0.32, zz, 0.42, 0.56, 0.05);
      addCollider(cx - 0.25, cx + 0.25, zz - 0.32, zz + 0.32);
    } else {
      const cx = side * 2.0;
      cyl(mats.metalDark, cx, 0.45, zz, 0.28, 0.9);
      snow(cx, 0.9, zz, 0.4, 0.4, 0.05);
      addCollider(cx - 0.3, cx + 0.3, zz - 0.3, zz + 0.3);
    }
  }

  // ------------------------------------------------ end of the alley
  for (const bx of [-1.6, -0.55, 0.55, 1.6]) {
    cyl(mats.plasticYellow, bx, 0.45, -89.5, 0.09, 0.9);
    snow(bx, 0.9, -89.5, 0.16, 0.16, 0.05);
  }
  box(mats.plasticRed, 0, 0.7, -89.5, 3.6, 0.18, 0.06);
  for (const bx of [-1.2, 0, 1.2]) sph(mats.blink, bx, 0.86, -89.5, 0.06);

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
  box(mats.snow, 0, 0.12, -105.3, 160, 0.24, 1.0);
  box(mats.snow, -30, 0.1, -92.6, 54, 0.2, 0.8);
  box(mats.snow, 30, 0.1, -92.6, 54, 0.2, 0.8);

  // -------------------------------------------------------- skyline
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

  return { colliders, vents, lights };
}
