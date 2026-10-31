// The shopfronts' neon goods: 3D wireframes that turn slowly on the spot. They
// move, so they stay out of the static batch. Each form is one instanced mesh per
// material, and nothing here draws from the kit's rng.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TUBE = 0.007;
const SPEED = 0.35; // radians per second
const PHASE_STEP = 2.4; // so neighbours are never lined up
const BOUNDS_MARGIN = 0.3; // the bounding sphere is measured once, but the forms keep turning

// Outlines as [along, up] points on a unit shape, with depth added by each form.
const FISH_BODY = [[1, 0], [0.5, 0.38], [-0.2, 0.3], [-0.62, 0.06], [-1, 0.34], [-0.9, 0], [-1, -0.34], [-0.62, -0.06], [-0.2, -0.3], [0.5, -0.38], [1, 0]];
const FISH_TOP = [[1, 0], [0.5, 0.2], [-0.2, 0.16], [-0.62, 0.03], [-0.2, -0.16], [0.5, -0.2], [1, 0]];
const FISH_RIBS = [[0.5, 0.36, 0.2], [0.28, 0.36, 0.2], [-0.2, 0.28, 0.15]]; // along, half height, half width
const RICE_BALL = [[0, 1], [0.85, -0.45], [0.7, -0.7], [-0.7, -0.7], [-0.85, -0.45], [0, 1]];
const NORI = [[-0.32, -0.7], [-0.32, -0.1], [0.32, -0.1], [0.32, -0.7], [-0.32, -0.7]];
const NIGIRI_RICE = [[-0.85, -0.45], [-0.95, -0.1], [-0.7, 0.1], [0.7, 0.1], [0.95, -0.1], [0.85, -0.45], [-0.85, -0.45]];
const NIGIRI_FISH = [[-1.05, 0.12], [-0.55, 0.45], [0.55, 0.45], [1.05, 0.12], [0, 0.14], [-1.05, 0.12]];
const circle = (r) => Array.from({ length: 13 }, (_, k) => [r * Math.cos(k * Math.PI / 6), r * Math.sin(k * Math.PI / 6)]);
const BOWL_PROFILE = [[1, 0.2], [0.75, -0.45], [0.35, -0.7]]; // radius, up
const CHOPSTICK = [[0.15, 0.25], [1.15, 1.05]];
const WISP = [[0, 0.7], [-0.14, 0.95], [0.06, 1.2], [-0.08, 1.45]];

// Maps a form's (along, up, depth) to model space. turn hangs a fish nose down.
const mapper = (s, turn = false) => (u, v, d = 0) => (turn
  ? new THREE.Vector3(d * s, -u * s, v * s)
  : new THREE.Vector3(d * s, v * s, u * s));

function wire(points, segs = 24) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segs, TUBE, 5, false);
}

// An outline on both faces, joined by straight rungs at the given points.
function extrude(p, shape, depth, rungs, segs = 32) {
  const out = [];
  for (const d of [-depth, depth]) out.push(wire(shape.map(([u, v]) => p(u, v, d)), segs));
  for (const k of rungs) out.push(wire([p(shape[k][0], shape[k][1], -depth), p(shape[k][0], shape[k][1], depth)], 1));
  return out;
}

export function fishParts(mat, s, turn = false) {
  const p = mapper(s, turn), geos = [
    wire(FISH_BODY.map(([u, v]) => p(u, v)), 44),
    wire(FISH_TOP.map(([u, d]) => p(u, 0, d)), 32),
  ];
  for (const [u, h, w] of FISH_RIBS) geos.push(wire(circle(1).map(([a, b]) => p(u, b * h, a * w)), 18));
  for (const e of [-1, 1]) {
    const eye = p(0.62, 0.1, e * 0.13);
    geos.push(new THREE.SphereGeometry(0.012, 8, 6).translate(eye.x, eye.y, eye.z));
  }
  return [[mat, geos]];
}

export function onigiriParts(rice, nori, s) {
  const p = mapper(s);
  return [
    [rice, extrude(p, RICE_BALL, 0.34, [0, 1, 2, 3, 4], 36)],
    [nori, extrude(p, NORI, 0.36, [0, 3], 16)],
  ];
}

export function nigiriParts(rice, fish, s) {
  const p = mapper(s);
  return [
    [rice, extrude(p, NIGIRI_RICE, 0.42, [1, 2, 3, 4])],
    [fish, extrude(p, NIGIRI_FISH, 0.5, [0, 1, 2, 3])],
  ];
}

export function makiParts(nori, rice, fish, s) {
  const p = mapper(s);
  return [
    [nori, extrude(p, circle(0.9), 0.55, [0, 3, 6, 9], 24)],
    [rice, extrude(p, circle(0.55), 0.57, [], 16)],
    [fish, [wire([p(0, 0, -0.57), p(0, 0, 0.57)], 1)]],
  ];
}

export function bowlParts(bowl, noodle, steam, s) {
  const p = mapper(s);
  // Rings of the same circle, so a meridian can run down through every ring.
  const around = (r, up, k) => p(r * Math.cos(k * Math.PI / 6), up, r * Math.sin(k * Math.PI / 6));
  const shell = BOWL_PROFILE.map(([r, up]) => wire(circle(1).map((_, k) => around(r, up, k)), 28));
  for (let k = 0; k < 12; k += 2) shell.push(wire(BOWL_PROFILE.map(([r, up]) => around(r, up, k)), 8));
  const strands = Array.from({ length: 25 }, (_, k) => {
    const a = k * Math.PI / 12;
    return p(0.72 * Math.cos(a), 0.4 + 0.1 * Math.sin(a * 6), 0.72 * Math.sin(a));
  });
  const noodles = [wire(strands, 50)];
  for (const d of [-0.05, 0.05]) noodles.push(wire(CHOPSTICK.map(([u, v]) => p(u, v, d)), 1));
  const wisps = [[-0.35, 0.18], [0.3, -0.18]].map(([u, d]) => wire(WISP.map(([a, v]) => p(a + u, v, d)), 14));
  return [[bowl, shell], [noodle, noodles], [steam, wisps]];
}

// Adds a form to the alley's list. Push [x, y, z] onto spots to place a copy.
export function neonForm(forms, parts) {
  const form = { parts, spots: [] };
  forms.push(form);
  return form;
}

export class NeonFood {
  constructor(forms, parent) {
    this.forms = [];
    let phase = 0;
    for (const { parts, spots } of forms) {
      const meshes = parts.map(([mat, geos]) => {
        const geo = mergeGeometries(geos, false);
        geos.forEach((g) => g.dispose());
        const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        parent.add(mesh);
        return mesh;
      });
      const form = { meshes, spots, phases: spots.map(() => (phase += PHASE_STEP)) };
      this.forms.push(form);
      this.pose(form, 0);
      for (const mesh of meshes) {
        mesh.computeBoundingSphere();
        mesh.boundingSphere.radius += BOUNDS_MARGIN;
      }
    }
  }

  pose({ meshes, spots, phases }, t) {
    const m = new THREE.Matrix4();
    spots.forEach(([x, y, z], i) => {
      m.makeRotationY(t * SPEED + phases[i]).setPosition(x, y, z);
      for (const mesh of meshes) mesh.setMatrixAt(i, m);
    });
    for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
  }

  update(t) {
    for (const form of this.forms) this.pose(form, t);
  }
}
