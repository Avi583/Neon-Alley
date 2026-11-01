// Snapshot of the generated world. The layout comes from one seeded rng, so
// adding, removing or reordering a draw moves everything after it. If this
// fails after a change meant to alter the geometry, check the result in the
// browser, then update with: npx vitest run -u
import { createHash } from 'node:crypto';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { Batch, makeKit, driftGeometry } from '../src/batch.js';
import { createMaterials } from '../src/materials.js';
import { ALLEY, buildAlley } from '../src/alley.js';
import { buildSigns } from '../src/signs.js';
import { LightPool } from '../src/lights.js';
import { SIGN_SPECS } from '../src/sign-specs.js';
import { inReach } from '../src/vending.js';

const SEED = 20261028; // same seed as main.js
const SIGN_PPM = 64;
const START = { x: 0.35, z: 6 }; // same start as main.js
const PLAYER_RADIUS = 0.3; // same as player.js
const GRID = 0.1;

// Rounded so tiny floating point differences between machines don't fail the test.
const round = (v) => Math.round(v * 1e4) / 1e4 + 0;

function hashArrays(...arrays) {
  const h = createHash('sha256');
  for (const a of arrays) {
    if (a) h.update(new Uint8Array(Float64Array.from(a, round).buffer));
  }
  return h.digest('hex').slice(0, 16);
}

function hashGeometry(g) {
  const { position, normal, uv } = g.attributes;
  return hashArrays(position.array, normal.array, uv.array, g.index?.array);
}

// Canvas calls don't affect the layout, so every context method is a no-op.
function fakeCanvas() {
  const stub = () => ({ width: 1, addColorStop() {} });
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : stub) });
  return { width: 1, height: 1, getContext: () => ctx };
}

function fakeMaterials() {
  const maps = { map: null, normalMap: null, roughnessMap: null, emissiveMap: null };
  const m = createMaterials({
    concrete: maps, brick: maps, shutter: maps, facade: maps, metal: maps, grate: maps, wood: maps,
    acFront: null, acDrip: null, graffiti: null, shopRamen: null, shopBar: null, shopMart: null, shopFish: null, shopOnigiri: null, shopSushi: null, noren: null, norenSushi: null, norenRamen: null, norenBar: null, vendingHeader: null, vendingPanel: null, vendingPrice: null, priceRamen: null, priceOnigiri: null, priceSushi: null, priceBar: null, canLabels: null,
    ads: [null, null, null],
  });
  for (const [k, v] of Object.entries(m)) if (v.isMaterial) v.name = k;
  m.ads.forEach((a, i) => { a.name = `ads${i}`; });
  const strip = m.strip;
  m.strip = (hex, k) => {
    const mat = strip(hex, k);
    mat.name = `strip:${hex}:${k ?? 5}`;
    return mat;
  };
  return m;
}

function generate(extraDraws = 0) {
  const mats = fakeMaterials();
  const batch = new Batch();
  const kit = makeKit(batch, mats, SEED);
  for (let i = 0; i < extraDraws; i++) kit.rng();
  const scene = new THREE.Scene();
  const alley = buildAlley(kit, mats, SIGN_SPECS);
  const signs = buildSigns(kit, mats, null, SIGN_PPM, scene);
  const signMeshes = [...scene.children];
  const batched = batch.build(scene);

  const point = (p) => [round(p.x), round(p.y), round(p.z)];
  const light = (l) => ({ pos: point(l.pos), color: l.color.getHexString(), intensity: l.intensity, range: l.range });
  const layout = {
    nextRng: kit.rng(), // catches any change in the number of draws
    geometry: batched.map((mesh) => ({
      material: mesh.material.name,
      vertices: mesh.geometry.attributes.position.count,
      hash: hashGeometry(mesh.geometry),
    })),
    signMeshes: signMeshes.map((mesh) => ({ pos: point(mesh.position), hash: hashGeometry(mesh.geometry) })),
    colliders: alley.colliders.map((c) => [c.minX, c.maxX, c.minZ, c.maxZ].map(round)),
    vents: alley.vents.map((v) => ({ pos: point(v.pos), tint: v.tint, scale: v.scale })),
    alleyLights: alley.lights.map(light),
    signLights: signs.lights.map(light),
  };
  return { alley, layout };
}

// Every position on a grid the player can get to from the start on foot, using
// the same test as Player.collide. Keyed by grid cell, as `${column},${row}`.
function reachableCells(colliders) {
  const clear = (x, z) => colliders.every((c) => !(
    x > c.minX - PLAYER_RADIUS && x < c.maxX + PLAYER_RADIUS && z > c.minZ - PLAYER_RADIUS && z < c.maxZ + PLAYER_RADIUS
  ));
  const columns = Math.round(ALLEY.walkX * 2 / GRID), rows = Math.round((ALLEY.walkZMax - ALLEY.walkZMin) / GRID);
  const toX = (i) => -ALLEY.walkX + i * GRID, toZ = (j) => ALLEY.walkZMin + j * GRID;
  const stack = [[Math.round((START.x + ALLEY.walkX) / GRID), Math.round((START.z - ALLEY.walkZMin) / GRID)]];
  const cells = new Map();
  while (stack.length) {
    const [i, j] = stack.pop(), id = `${i},${j}`;
    if (i < 0 || j < 0 || i > columns || j > rows || cells.has(id) || !clear(toX(i), toZ(j))) continue;
    cells.set(id, { x: toX(i), z: toZ(j) });
    stack.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
  }
  return [...cells.values()];
}

// Can any of these positions use the spot, turned to face it?
function usableFrom(cells, spot) {
  return cells.some(({ x, z }) => inReach(spot, x, z, Math.atan2(x - spot.face, z - spot.z)));
}

describe('snow drifts', () => {
  const FOOTPRINTS = [[0.1, 0.1], [0.16, 0.16], [0.5, 2.46], [2.46, 0.5], [1, 160], [14, 11]];

  it.each(FOOTPRINTS)('stays inside a %f by %f footprint with valid normals', (sx, sz) => {
    const g = driftGeometry(sx, 0.1, sz, 42);
    const { position: p, normal: n } = g.attributes;
    for (let i = 0; i < p.count; i++) {
      expect(Math.abs(p.getX(i))).toBeLessThanOrEqual(sx / 2 + 1e-5);
      expect(Math.abs(p.getZ(i))).toBeLessThanOrEqual(sz / 2 + 1e-5);
      expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1);
    }
  });

  it.each(FOOTPRINTS)('fills most of a %f by %f footprint', (sx, sz) => {
    const g = driftGeometry(sx, 0.1, sz, 42);
    g.computeBoundingBox();
    const size = g.boundingBox.getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(sx * 0.7);
    expect(size.z).toBeGreaterThan(sz * 0.7);
  });

  it('leaves the corners of the footprint empty', () => {
    const { position: p } = driftGeometry(0.5, 0.1, 2.46, 42).attributes;
    for (let i = 0; i < p.count; i++) {
      const cornerX = Math.abs(p.getX(i)) > 0.2, cornerZ = Math.abs(p.getZ(i)) > 1.2;
      expect(cornerX && cornerZ).toBe(false);
    }
  });

  it('faces its top surface upwards along either axis', () => {
    for (const [sx, sz] of [[0.5, 2.46], [2.46, 0.5]]) {
      const g = driftGeometry(sx, 0.1, sz, 42);
      const { position: p, normal: n } = g.attributes;
      for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.05) expect(n.getY(i)).toBeGreaterThan(0);
    }
  });

  it('makes exactly one rng draw per kit.snow call', () => {
    const mats = { snow: new THREE.MeshBasicMaterial() };
    const a = makeKit(new Batch(), mats, SEED), b = makeKit(new Batch(), mats, SEED);
    a.snow(1, 2, 3, 0.5, 2);
    b.rng();
    expect(a.rng()).toBe(b.rng());
  });
});

describe('generated layout', () => {
  let world;
  beforeAll(() => {
    vi.stubGlobal('document', { createElement: fakeCanvas });
    world = generate();
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('matches the snapshot', () => {
    expect(world.layout).toMatchSnapshot();
  });

  it('is deterministic', () => {
    expect(generate().layout).toEqual(world.layout);
  });

  it('changes when the rng draw order shifts', () => {
    const shifted = generate(1).layout;
    expect(shifted.nextRng).not.toBe(world.layout.nextRng);
    expect(shifted.geometry).not.toEqual(world.layout.geometry);
  });

  it('keeps sign runtime state out of SIGN_SPECS', () => {
    for (const spec of SIGN_SPECS) {
      expect(spec).not.toHaveProperty('seed');
      expect(spec).not.toHaveProperty('factor');
    }
  });

  it('drives sign lights from their runtime state', () => {
    const mats = fakeMaterials();
    const scene = new THREE.Scene();
    const signs = buildSigns(makeKit(new Batch(), mats, SEED), mats, null, SIGN_PPM, scene);
    signs.update(1);
    expect(signs.lights.some((l) => l.state.factor !== 1)).toBe(true);

    const src = signs.lights[0];
    src.state.factor = 0.5;
    const pool = new LightPool(scene, 1, [src]);
    pool.update(new THREE.PerspectiveCamera());
    expect(pool.lights[0].intensity).toBeCloseTo(src.intensity * 0.5);
  });

  describe('makes sense to walk', () => {
    let cells;
    beforeAll(() => {
      cells = reachableCells(world.alley.colliders);
    });

    it('starts the player clear of every collider', () => {
      expect(cells.length).toBeGreaterThan(0);
    });

    it('can be walked from end to end', () => {
      const zs = cells.map((c) => c.z);
      expect(Math.max(...zs)).toBeCloseTo(ALLEY.walkZMax);
      expect(Math.min(...zs)).toBeCloseTo(ALLEY.walkZMin);
    });

    it('can use the vending machine', () => {
      expect(usableFrom(cells, world.alley.vending)).toBe(true);
    });

    it('can use every door and food spot', () => {
      const stuck = [...world.alley.doors, ...world.alley.foodSpots].filter((spot) => !usableFrom(cells, spot));
      expect(stuck).toEqual([]);
    });

    it('notices a wall across the alley, and a spot only reachable beyond it', () => {
      const wall = { minX: -ALLEY.walkX - 1, maxX: ALLEY.walkX + 1, minZ: -10, maxZ: -9 };
      const blocked = reachableCells([wall]);
      expect(Math.min(...blocked.map((c) => c.z))).toBeGreaterThan(-9);
      expect(usableFrom(blocked, { face: 2, z: -30 })).toBe(false);
      expect(usableFrom(blocked, { face: 2, z: 0 })).toBe(true);
    });
  });
});
