// Static geometry batching. Thousands of props (pipes, icicles, AC units,
// railings...) are merged into one mesh per material so the whole alley
// renders in a few dozen draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './noise.js';

const KEEP = new Set(['position', 'normal', 'uv']);

// World-space box projection so textures keep a constant physical scale
// no matter how a piece was stretched.
function worldUV(g, tu, tv) {
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    let u, v;
    if (ax >= ay && ax >= az) { u = (nx > 0 ? -z : z) / tu; v = y / tv; }
    else if (az >= ay) { u = (nz > 0 ? x : -x) / tu; v = y / tv; }
    else { u = x / tu; v = z / tv; }
    uv.setXY(i, u, v);
  }
}

const DRIFT_SKIRT = 0.02; // the rim sinks this far below the base, so it never floats on a sloped surface
const DRIFT_CAP = [80, 55, 30].map((deg) => THREE.MathUtils.degToRad(deg));

// A mound of snow inside an sx by sz footprint: rounded ends, wavy sides and a
// lumpy top, with its base at y = 0. The shape comes from its own seed, never
// the kit's rng, so it can't shift the layout.
export function driftGeometry(sx, h, sz, seed) {
  const rand = mulberry32(seed);
  const phase = () => rand() * Math.PI * 2;
  const p1 = phase(), p2 = phase(), p3 = phase(), p4 = phase();
  const long = Math.max(sx, sz), short = Math.min(sx, sz);
  const r = Math.min(short / 2, 0.35), mid = long / 2 - r;
  const step = Math.max(0.4, short / 8);

  // Stations along the length: x, half width and height factor.
  const capEnd = Math.sin(DRIFT_CAP[0]);
  const station = (a, sign) => ({
    x: sign * (mid + r * Math.sin(a)),
    half: short / 2 - r + r * Math.cos(a),
    fade: Math.sqrt(1 - (Math.sin(a) / capEnd) ** 2),
  });
  const stations = DRIFT_CAP.map((a) => station(a, -1));
  const nMid = Math.max(1, Math.ceil(2 * mid / step));
  for (let i = 0; i <= nMid; i++) stations.push({ x: -mid + 2 * mid * i / nMid, half: short / 2, fade: 1 });
  stations.push(...[...DRIFT_CAP].reverse().map((a) => station(a, 1)));

  const nb = THREE.MathUtils.clamp(Math.ceil(short / step), 4, 8);
  const inset = Math.min(short * 0.15, 0.12) / (short / 2);
  const wave = (x, p) => 1 - inset * (0.5 + 0.3 * Math.sin(x * 2.1 + p) + 0.2 * Math.sin(x * 5.3 + p * 2));
  const pos = [], idx = [];
  const push = (x, y, z) => pos.push(...(sz > sx ? [z, y, -x] : [x, y, z])); // along whichever side is longer

  for (const s of stations) {
    const lo = s.half * wave(s.x, p1), hi = s.half * wave(s.x, p2);
    for (let j = 0; j <= nb; j++) {
      const b = Math.sin(Math.PI / 2 * (2 * j / nb - 1));
      const z = b * (b < 0 ? lo : hi);
      const lump = 0.85 + 0.15 * Math.sin(1.3 * s.x + 2 * z + p3) + 0.1 * Math.sin(3.1 * s.x - 1.7 * z + p4);
      const dome = Math.sqrt(Math.max(0, 1 - b ** 4)) * s.fade;
      push(s.x, -DRIFT_SKIRT + (h + DRIFT_SKIRT) * dome * lump, z);
    }
  }
  const row = nb + 1;
  for (let i = 0; i < stations.length - 1; i++) {
    for (let j = 0; j < nb; j++) {
      const a = i * row + j, c = a + row;
      idx.push(a, a + 1, c, a + 1, c + 1, c);
    }
  }
  // Flat underside, for the piles that overhang their surface.
  const under = pos.length / 3;
  for (const s of stations) {
    push(s.x, -DRIFT_SKIRT, -s.half * wave(s.x, p1));
    push(s.x, -DRIFT_SKIRT, s.half * wave(s.x, p2));
  }
  for (let i = 0; i < stations.length - 1; i++) {
    const a = under + i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class Batch {
  constructor() { this.groups = new Map(); }

  add(geo, mat, matrix = null, uv = null) {
    const g = geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (uv) worldUV(g, uv[0], uv[1]);
    for (const k of Object.keys(g.attributes)) if (!KEEP.has(k)) g.deleteAttribute(k);
    if (!this.groups.has(mat)) this.groups.set(mat, []);
    this.groups.get(mat).push(g);
  }

  build(parent) {
    const meshes = [];
    for (const [mat, list] of this.groups) {
      const merged = mergeGeometries(list, false);
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      meshes.push(mesh);
      list.forEach((g) => g.dispose());
    }
    this.groups.clear();
    return meshes;
  }
}

// A small kit of placement helpers shared by the alley and sign builders.
export function makeKit(batch, mats, seed = 1) {
  const rng = mulberry32(seed);
  const R = (a, b) => a + (b - a) * rng();
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const G = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 12, 1),
    cylLo: new THREE.CylinderGeometry(1, 1, 1, 6, 1),
    cylOpen: new THREE.CylinderGeometry(1, 1, 1, 12, 1, true),
    prism: new THREE.CylinderGeometry(1, 1, 1, 3, 1),
    cone: new THREE.ConeGeometry(1, 1, 6, 1, true),
    sph: new THREE.SphereGeometry(1, 14, 10),
    sphLo: new THREE.SphereGeometry(1, 8, 6),
    plane: new THREE.PlaneGeometry(1, 1),
  };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const p = new THREE.Vector3(), s = new THREE.Vector3();

  function put(geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, uv = null) {
    e.set(rx, ry, rz); q.setFromEuler(e); p.set(x, y, z); s.set(sx, sy, sz);
    m4.compose(p, q, s);
    batch.add(geo, mat, m4, uv);
  }
  const box = (mat, x, y, z, sx, sy, sz, uv = null, ry = 0, rx = 0, rz = 0) =>
    put(G.box, mat, x, y, z, sx, sy, sz, rx, ry, rz, uv);
  const cyl = (mat, x, y, z, r, h, rx = 0, ry = 0, rz = 0, lo = false) =>
    put(lo ? G.cylLo : G.cyl, mat, x, y, z, r, h, r, rx, ry, rz);
  const squashedCyl = (mat, x, y, z, rx, h, rz, ax = 0, ay = 0, az = 0) =>
    put(G.cylLo, mat, x, y, z, rx, h, rz, ax, ay, az);
  const prism = (mat, x, y, z, r, h, rx = 0, ry = 0, rz = 0) =>
    put(G.prism, mat, x, y, z, r, h, r, rx, ry, rz);
  const sph = (mat, x, y, z, sx, sy = sx, sz = sx, lo = false) =>
    put(lo ? G.sphLo : G.sph, mat, x, y, z, sx, sy, sz);
  const plane = (mat, x, y, z, w, h, ry = 0) => put(G.plane, mat, x, y, z, w, h, 1, 0, ry, 0);
  // An open cylinder wrapped in one cell of a horizontal texture atlas.
  function atlasCyl(mat, x, y, z, r, h, cell, cells, ry = 0) {
    const g = G.cylOpen.clone(), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (cell + uv.getX(i)) / cells);
    put(g, mat, x, y, z, r, h, r, 0, ry, 0);
  }
  // A plane showing one cell of a horizontal texture atlas.
  function atlasPlane(mat, x, y, z, w, h, cell, cells, ry = 0) {
    const g = G.plane.clone(), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (cell + uv.getX(i)) / cells);
    put(g, mat, x, y, z, w, h, 1, 0, ry, 0);
  }

  // A row of icicles hanging from the line a -> b.
  function icicles(ax, ay, az, bx, by, bz, density = 0.6, maxLen = 0.45) {
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    let d = R(0, 0.12);
    while (d < len) {
      const t = d / len;
      if (rng() < density) {
        const L = 0.04 + maxLen * Math.pow(rng(), 1.6);
        const r = 0.008 + L * 0.07;
        put(G.cone, mats.ice, ax + (bx - ax) * t, ay + (by - ay) * t - L / 2, az + (bz - az) * t,
          r, L, r, Math.PI, R(0, 3), 0);
      }
      d += R(0.06, 0.22);
    }
  }
  // A mound with its base at y, optionally tilted about z. Makes no rng draws.
  const drift = (x, y, z, sx, h, sz, rz = 0) => {
    const seed = Math.round(x * 1009 + y * 503 + z * 2003);
    const g = driftGeometry(sx, h, sz, seed);
    put(g, mats.snow, x, y, z, 1, 1, 1, 0, 0, rz);
    g.dispose();
  };
  const snow = (x, y, z, sx, sz, th = 0.05) => drift(x, y, z, sx, th * R(0.8, 1.3) * 1.6, sz);
  function catenary(a, b, sag, n = 12) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const v = a.clone().lerp(b, t);
      v.y -= sag * 4 * t * (1 - t);
      pts.push(v);
    }
    return pts;
  }
  function tube(points, radius, mat, segs = 24) {
    const curve = new THREE.CatmullRomCurve3(points);
    batch.add(new THREE.TubeGeometry(curve, segs, radius, 5, false), mat);
    return curve;
  }
  return { rng, R, pick, box, cyl, squashedCyl, prism, sph, plane, atlasCyl, atlasPlane, icicles, drift, snow, catenary, tube };
}
