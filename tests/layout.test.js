// Snapshot of the generated world. The layout comes from one seeded rng, so
// adding, removing or reordering a draw moves everything after it. If this
// fails after a change meant to alter the geometry, check the result in the
// browser, then update with: npx vitest run -u
import { createHash } from 'node:crypto';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { Batch, makeKit } from '../src/batch.js';
import { createMaterials } from '../src/materials.js';
import { buildAlley } from '../src/alley.js';
import { buildSigns } from '../src/signs.js';
import { LightPool } from '../src/lights.js';
import { SIGN_SPECS } from '../src/sign-specs.js';

const SEED = 20261028; // same seed as main.js
const SIGN_PPM = 64;

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
    acFront: null, acDrip: null, graffiti: null, shopRamen: null, shopBar: null, shopMart: null, shopFish: null, shopOnigiri: null, shopSushi: null, noren: null, norenSushi: null, norenRamen: null, vendingHeader: null, vendingPanel: null, vendingPrice: null, canLabels: null,
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
  return {
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
}

describe('generated layout', () => {
  beforeAll(() => {
    vi.stubGlobal('document', { createElement: fakeCanvas });
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('matches the snapshot', () => {
    expect(generate()).toMatchSnapshot();
  });

  it('is deterministic', () => {
    expect(generate()).toEqual(generate());
  });

  it('changes when the rng draw order shifts', () => {
    const a = generate(), b = generate(1);
    expect(b.nextRng).not.toBe(a.nextRng);
    expect(b.geometry).not.toEqual(a.geometry);
  });

  it('keeps sign runtime state out of SIGN_SPECS', () => {
    generate();
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
});
