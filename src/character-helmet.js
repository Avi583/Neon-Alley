// The biker's helmet: a gunmetal shell, a wraparound gold visor in a black trim band,
// vents, and a faceted mouth guard. Built by character.js, with the other parts in character-build.js.
import * as THREE from 'three';
import { HEAD_LAYER, part } from './character-build.js';

const SHELL = 0.155; // the helmet shell's radius

// A group sat on the helmet shell at (phi, theta) as SphereGeometry measures them, its y axis
// out of the surface; on the back (phi near pi / 2) its z axis runs down the shell.
function onShell(helmet, phi, theta) {
  const n = new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
  const g = new THREE.Group();
  g.position.copy(n).multiplyScalar(SHELL);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  helmet.add(g);
  return g;
}

const HELMET_SIZE = 0.86; // the whole helmet against the body, about its centre

// The visor's patch of the shell sphere: phi around from the front (-z), theta down from the top.
const VISOR = { phi: Math.PI * 1.5 - 1.15, phiLen: 2.3, theta: 1.04, thetaLen: 0.66 };

// Mouth guard cross-sections in the head's space, from just under the visor down to the jaw:
// [y, ear, cheek, corner, centre], each point an [x, z] for the right side (the left mirrors it).
// The sharp corners between the points, flat shaded, give the guard its facets.
const GUARD = [
  [-0.022, [0.148, -0.03], [0.15, -0.11], [0.092, -0.18], [0, -0.193]],
  [-0.07, [0.153, 0.005], [0.152, -0.112], [0.1, -0.205], [0, -0.236]],
  // From here down it tapers in and back, row by row, to a narrow chin.
  [-0.1, [0.146, 0.01], [0.14, -0.104], [0.088, -0.194], [0, -0.222]],
  [-0.125, [0.132, 0.012], [0.122, -0.094], [0.072, -0.178], [0, -0.204]],
  [-0.145, [0.114, 0.01], [0.1, -0.082], [0.055, -0.158], [0, -0.18]],
  [-0.16, [0.094, 0.004], [0.078, -0.068], [0.04, -0.134], [0, -0.152]],
];
const GUARD_IN = 0.92; // the inside face, shrunk towards GUARD_C to give the guard its thickness
const GUARD_C = [0, -0.07]; // [x, z]

// A point on the guard's outside at height y: point i of a row (0 ear .. 3 centre), x on this side.
function guardPoint(y, i, side) {
  let r = 0;
  while (r < GUARD.length - 2 && y < GUARD[r + 1][0]) r++;
  const [y0, ...a] = GUARD[r], [y1, ...b] = GUARD[r + 1];
  const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
  return [side * (a[i][0] + (b[i][0] - a[i][0]) * t), a[i][1] + (b[i][1] - a[i][1]) * t];
}

// The guard as one closed, faceted shell: an outside, an inside, and the edges between them.
function guardGeometry() {
  const rows = GUARD.map(([y, ear, cheek, corner, centre]) => {
    const pts = [ear, cheek, corner].map(([x, z]) => [-x, z]).concat([centre, corner, cheek, ear]);
    const at = (k) => pts.map(([x, z]) => new THREE.Vector3(
      GUARD_C[0] + (x - GUARD_C[0]) * k, y, GUARD_C[1] + (z - GUARD_C[1]) * k));
    return { out: at(1), in: at(GUARD_IN) };
  });
  const v = [];
  const quad = (a, b, c, d) => v.push(a, b, d, b, c, d); // a b across the top, d c below them
  const n = rows[0].out.length;
  for (let r = 0; r + 1 < rows.length; r++) {
    const top = rows[r], bot = rows[r + 1];
    for (let j = 0; j + 1 < n; j++) {
      quad(top.out[j], top.out[j + 1], bot.out[j + 1], bot.out[j]);
      quad(top.in[j + 1], top.in[j], bot.in[j], bot.in[j + 1]);
    }
    for (const j of [0, n - 1]) quad(top.in[j], top.out[j], bot.out[j], bot.in[j]); // the ends at the ears
  }
  const first = rows[0], last = rows[rows.length - 1];
  for (let j = 0; j + 1 < n; j++) {
    quad(first.in[j], first.in[j + 1], first.out[j + 1], first.out[j]); // top edge, under the visor
    quad(last.out[j], last.out[j + 1], last.in[j + 1], last.in[j]); // bottom edge, at the jaw
  }
  const geo = new THREE.BufferGeometry().setFromPoints(v);
  geo.computeVertexNormals(); // not indexed, so each facet keeps its own flat normal
  return geo;
}

// Street helmet after a two-in-one style: matte gunmetal shell, a wide wraparound gold visor
// framed by a black trim band, a top vent, and a removable-look faceted mouth guard with
// three tiers of vents a side and a hex release button over each ear. No logo.
export function buildHelmet(neck, m) {
  const head = new THREE.Group();
  head.position.y = 0.12;
  neck.add(head);
  // Everything but the neck rim, scaled about the shell's centre so the rim still meets the collar.
  const body = new THREE.Group();
  body.scale.setScalar(HELMET_SIZE);
  head.add(body);
  const helmet = new THREE.Group();
  helmet.scale.set(0.95, 1.05, 1.12);
  body.add(helmet);
  part(helmet, new THREE.SphereGeometry(SHELL, 40, 28), m.shell);
  const { phi, phiLen, theta, thetaLen } = VISOR;
  part(helmet, new THREE.SphereGeometry(0.161, 36, 12, phi, phiLen, theta, thetaLen), m.visor);
  // Trim band round the eye port: a brow across the top and a strip down each side to the guard.
  part(helmet, new THREE.SphereGeometry(0.1635, 40, 2, phi - 0.06, phiLen + 0.12, theta - 0.08, 0.09), m.trim);
  part(helmet, new THREE.SphereGeometry(0.1625, 40, 1, phi - 0.04, phiLen + 0.08, theta - 0.12, 0.05), m.trim); // brow lip
  for (const p of [phi - 0.06, phi + phiLen - 0.01]) {
    part(helmet, new THREE.SphereGeometry(0.1635, 2, 10, p, 0.07, theta - 0.02, thetaLen + 0.12), m.trim);
  }
  for (const side of [-1, 1]) {
    // Visor pivot at each temple, in the trim.
    const pivot = onShell(helmet, Math.PI * 1.5 + side * (phiLen / 2 + 0.02), theta + 0.06);
    part(pivot, new THREE.CylinderGeometry(0.011, 0.012, 0.006, 16), m.trim, 0, 0.004);
    part(pivot, new THREE.CylinderGeometry(0.005, 0.005, 0.003, 12), m.pad, 0, 0.008);
    // Exhaust slot low on the back, under a lip.
    const exhaust = onShell(helmet, Math.PI / 2 + side * 0.32, 1.42);
    part(exhaust, new THREE.BoxGeometry(0.03, 0.007, 0.012), m.trim, 0, 0.001);
    part(exhaust, new THREE.BoxGeometry(0.024, 0.003, 0.004), m.vent, 0, 0.004, 0.002);
  }
  // Top vent: a low black scoop on the crown with two slots across it.
  const vent = onShell(helmet, Math.PI * 1.5, 0.42);
  part(vent, new THREE.BoxGeometry(0.046, 0.008, 0.036), m.trim, 0, 0.002);
  for (const z of [-0.007, 0.007]) part(vent, new THREE.BoxGeometry(0.034, 0.003, 0.004), m.vent, 0, 0.0065, z);
  buildMouthGuard(body, m);
  part(head, new THREE.CylinderGeometry(0.1, 0.11, 0.06, 16), m.trim, 0, -0.145, 0.005); // the rim at the neck
  head.traverse((o) => o.layers.set(HEAD_LAYER));
  return head;
}

// The mouth guard, in the head's (unscaled) space so its facets stay sharp.
function buildMouthGuard(head, m) {
  part(head, guardGeometry(), m.guard);
  for (const side of [-1, 1]) {
    // Two tiers of vents on the front corner facet, each a dark slot of mesh between two low lips, near flush.
    for (const y of [-0.05, -0.085]) {
      // A point 0.45 of the way from the corner to the cheek, at height h.
      const at = (h) => {
        const [cx, cz] = guardPoint(h, 2, side), [kx, kz] = guardPoint(h, 1, side);
        return new THREE.Vector3(cx + (kx - cx) * 0.45, h, cz + (kz - cz) * 0.45);
      };
      const [cx, cz] = guardPoint(y, 2, side), [kx, kz] = guardPoint(y, 1, side);
      const len = Math.hypot(kx - cx, kz - cz);
      // Lie flat on the facet, which leans as well as turns: x along it, z out of it.
      const x = new THREE.Vector3(kx - cx, 0, kz - cz).normalize();
      const down = at(y - 0.004).sub(at(y + 0.004));
      const z = new THREE.Vector3().crossVectors(x, down).normalize();
      if (z.x * side < 0) z.negate();
      const vent = new THREE.Group();
      vent.position.copy(at(y));
      vent.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, new THREE.Vector3().crossVectors(z, x), z));
      head.add(vent);
      const w = len * 0.62;
      part(vent, new THREE.BoxGeometry(w, 0.013, 0.003), m.vent);
      for (let i = -1; i <= 1; i++) part(vent, new THREE.BoxGeometry(0.0016, 0.012, 0.0026), m.pad, i * w * 0.25, 0, 0.0004);
      for (const ly of [-0.0085, 0.0085]) part(vent, new THREE.BoxGeometry(w + 0.004, 0.004, 0.004), m.guard, 0, ly, 0.0005);
    }
    // Side pod over the ear with a raised hex release button.
    const [px, pz] = guardPoint(-0.07, 0, side), [qx, qz] = guardPoint(-0.07, 1, side);
    const pod = new THREE.Group();
    pod.position.set((px + qx) / 2, -0.07, (pz + qz) / 2);
    pod.rotation.z = -side * Math.PI / 2; // y out of the side
    head.add(pod);
    part(pod, new THREE.CylinderGeometry(0.025, 0.028, 0.008, 6), m.guard, 0, 0.004);
    part(pod, new THREE.CylinderGeometry(0.013, 0.015, 0.006, 6), m.pad, 0, 0.011).rotation.y = Math.PI / 6;
  }
}
