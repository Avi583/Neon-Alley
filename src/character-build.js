// The biker's parts: the cross-sections, the materials, and one builder per part.
// Each builder hangs its meshes and bones off the group it is given.
import * as THREE from 'three';
import { hdr } from './materials.js';
import { sstep } from './math.js';
import { createCharacterTextures } from './character-textures.js';
import { cap, sampler, frontZ, loft, sweep, frontTube, frontPatch } from './character-geometry.js';

export const HEAD_LAYER = 1; // the helmet and neck, left out of the main view in first person
const UPPER_ARM = 0.3, THIGH = 0.44; // bone lengths
const SHOULDER = [0.185, 0.475], LEG_X = 0.09; // where the limbs hang from, in the torso and hips
const N_BODY = 2.6, N_LIMB = 2.2; // superellipse exponents: higher is boxier

// Cross-sections, keyed by distance down: [d, half width, front depth, back depth, fold].
// The torso and seat are keyed by -y in the hips' space, the limbs from their pivot.
const TORSO = [
  [-0.6, 0.03, 0.03, 0.03, 0], [-0.588, 0.072, 0.066, 0.06, 0], [-0.565, 0.125, 0.075, 0.072, 0],
  [-0.535, 0.172, 0.09, 0.088, 0], [-0.495, 0.196, 0.112, 0.105, 0], [-0.445, 0.2, 0.13, 0.11, 0],
  [-0.38, 0.19, 0.135, 0.108, 0], [-0.3, 0.172, 0.125, 0.1, 0], [-0.22, 0.158, 0.11, 0.098, 0.01],
  [-0.15, 0.155, 0.105, 0.102, 0.012], [-0.1, 0.163, 0.11, 0.108, 0], [-0.075, 0.168, 0.114, 0.112, 0],
];
const SEAT = [
  [-0.1, 0.155, 0.1, 0.105, 0], [-0.05, 0.163, 0.105, 0.115, 0], [0, 0.168, 0.1, 0.125, 0],
  [0.05, 0.166, 0.095, 0.13, 0], [0.1, 0.15, 0.085, 0.115, 0], [0.14, 0.11, 0.07, 0.085, 0],
  [0.165, 0.05, 0.04, 0.045, 0], [0.175, 0.01, 0.01, 0.01, 0],
];
const SLEEVE = [
  [-0.065, 0.015, 0.015, 0.015, 0], [-0.05, 0.048, 0.048, 0.048, 0], [-0.02, 0.068, 0.066, 0.066, 0],
  [0.03, 0.074, 0.07, 0.07, 0], [0.1, 0.066, 0.064, 0.064, 0], [0.18, 0.062, 0.064, 0.06, 0.01],
  [0.26, 0.056, 0.055, 0.056, 0.02], [0.3, 0.054, 0.052, 0.058, 0.02], [0.36, 0.056, 0.054, 0.054, 0.01],
  [0.44, 0.05, 0.048, 0.048, 0], [0.5, 0.046, 0.044, 0.044, 0.02], [0.545, 0.047, 0.045, 0.045, 0.02],
];
const LEG = [
  [-0.07, 0.055, 0.055, 0.055, 0], [-0.03, 0.08, 0.084, 0.085, 0], [0.04, 0.088, 0.09, 0.092, 0],
  [0.14, 0.083, 0.085, 0.085, 0.01], [0.26, 0.072, 0.073, 0.073, 0.01], [0.38, 0.064, 0.065, 0.064, 0.015],
  [0.44, 0.062, 0.065, 0.06, 0.02], [0.52, 0.063, 0.061, 0.066, 0.01], [0.6, 0.065, 0.063, 0.067, 0.01],
  [0.7, 0.069, 0.067, 0.069, 0.03], [0.78, 0.075, 0.073, 0.075, 0.035], [0.795, 0.076, 0.074, 0.076, 0.03],
  [0.805, 0.066, 0.064, 0.066, 0],
];

// Wrist end of the glove, below the elbow by 0.18: the gauntlet narrows into the hand.
const GAUNTLET = [
  [0, 0.064, 0.066, 0.066, 0], [0.025, 0.061, 0.063, 0.063, 0.01], [0.06, 0.052, 0.056, 0.056, 0.01],
  [0.085, 0.036, 0.045, 0.045, 0], [0.105, 0.022, 0.038, 0.038, 0],
];
// [z, length, radius, extra curl] for each finger, from the index (forward) to the little finger.
const FINGERS = [[-0.028, 0.074, 0.0098, 0], [-0.0095, 0.081, 0.0102, 0.03], [0.0095, 0.076, 0.0098, 0.06], [0.027, 0.06, 0.0088, 0.12]];
const PHALANGES = [[0.45, 0.25], [0.32, 0.5], [0.23, 0.4]]; // [share of the finger's length, rest bend] from the knuckle out
const FINGER_JOINTS = [0.45, 0.77]; // where the joints fall along each finger, from the shares
const GRIP = [0.95, 0.85, 0.6]; // how much more each joint bends in a fist
// Boot shaft from its top, 0.27 below the knee, down into the foot.
const SHAFT = [
  [0, 0.061, 0.063, 0.063, 0], [0.06, 0.057, 0.059, 0.06, 0.01], [0.11, 0.053, 0.054, 0.057, 0.015],
  [0.16, 0.048, 0.05, 0.056, 0], [0.19, 0.044, 0.046, 0.05, 0],
];
// Boot foot from the heel (0) to the toe (1): [t, half width, height above its line, depth below].
const FOOT = [
  [0, 0.036, 0.03, 0.02], [0.12, 0.043, 0.048, 0.021], [0.25, 0.048, 0.062, 0.021], [0.45, 0.049, 0.044, 0.021],
  [0.65, 0.052, 0.031, 0.021], [0.85, 0.047, 0.026, 0.02], [1, 0.03, 0.02, 0.016],
];

export function createMaterials() {
  const tx = createCharacterTextures();
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const leather = (t, color = 0x3a2e28) => phys({
    color, roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.4,
    map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.8, 0.8),
  });
  const denim = (t) => std({ color: 0xffffff, roughness: 0.9, map: t.map, normalMap: t.normalMap });
  return {
    jacket: leather(tx.torso),
    sleeve: leather(tx.sleeve),
    jeans: denim(tx.leg),
    seat: denim(tx.pelvis),
    leatherDark: phys({ color: 0x17110e, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.35, normalMap: tx.torso.normalMap }),
    knit: std({ color: 0x1a1a1e, roughness: 1 }),
    tape: std({ color: 0x0a0a0c, roughness: 0.8 }),
    shell: phys({ color: 0x0b0b10, roughness: 0.25, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }),
    visor: std({ color: 0x050608, roughness: 0.05, metalness: 0.95, emissive: hdr(0x38e8ff, 0.05) }),
    stripe: std({ color: 0x000000, emissive: hdr(0xff3fa4, 2.2) }),
    glove: leather(tx.glove, 0x1b1a1c),
    pad: std({ color: 0x2c2c32, roughness: 0.45, metalness: 0.15 }),
    bootFoot: leather(tx.bootFoot, 0x2a1d16),
    bootShaft: leather(tx.bootShaft, 0x2a1d16),
    sole: std({ color: 0x080808, roughness: 0.9 }),
    chrome: std({ color: 0xc8ccd4, roughness: 0.25, metalness: 1 }),
  };
}

export function part(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function bone(parent, y = 0) {
  const b = new THREE.Bone();
  b.position.y = y;
  parent.add(b);
  return b;
}

// One limb as a skinned tube: an anchor bone that stays with the body (so the
// top doesn't swing out of it), the swinging bone, and the one below the joint.
function limb(parent, x, y, keys, mat, rows, upper, joint) {
  const sample = sampler(keys);
  const weight = (d) => (d < upper * 0.6
    ? [0, 1, sstep(joint[0], joint[1], d)]
    : [1, 2, sstep(upper - 0.05, upper + 0.05, d)]);
  const geo = loft({ sample, from: keys[0][0], to: keys[keys.length - 1][0], rows, seg: 18, n: N_LIMB, weight });
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.position.set(x, y, 0);
  mesh.frustumCulled = false; // its bounds move with the bones
  parent.add(mesh);
  const anchor = bone(mesh);
  const top = bone(anchor);
  const lower = bone(top, -upper);
  mesh.userData.bones = [anchor, top, lower];
  return { mesh, sample, top, lower };
}

// side is +1 for the right (+x, as the model faces -z) and -1 for the left.
export function buildArm(chest, m, side) {
  const { mesh, sample, top: shoulder, lower: elbow } = limb(chest, side * SHOULDER[0], SHOULDER[1], SLEEVE, m.sleeve, 44, UPPER_ARM, [-0.02, 0.12]);
  // A zip up the back of each cuff.
  const zip = [];
  for (let d = 0.43; d <= 0.52; d += 0.015) zip.push(new THREE.Vector3(0, UPPER_ARM - d, sample(d)[2] + 0.003));
  part(elbow, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(zip), 8, 0.0035, 5), m.chrome);
  // Gauntlet over the sleeve end, narrowing to the wrist, with a rolled rim and a snapped strap.
  const gauntlet = new THREE.Group();
  gauntlet.position.y = -0.18;
  elbow.add(gauntlet);
  const cuff = sampler(GAUNTLET);
  part(gauntlet, loft({ sample: cuff, from: 0, to: GAUNTLET[GAUNTLET.length - 1][0], rows: 16, seg: 20, n: N_LIMB }), m.glove);
  part(gauntlet, loft({ sample: cuff, from: 0, to: 0.012, rows: 2, seg: 20, n: N_LIMB, grow: 0.004 }), m.pad);
  part(gauntlet, loft({ sample: cuff, from: 0.045, to: 0.062, rows: 2, seg: 20, n: N_LIMB, grow: 0.005 }), m.pad);
  part(gauntlet, new THREE.CylinderGeometry(0.007, 0.007, 0.005, 10), m.chrome, side * (cuff(0.054)[0] + 0.008), -0.054).rotation.z = Math.PI / 2;
  const fingers = buildHand(elbow, m, side);
  return { mesh, shoulder, elbow, side, fingers, hand: fingers[0].parent };
}

// Skins a swept finger to its three phalanx bones (FINGER_JOINTS along it), blending across each joint.
function skinFinger(geo) {
  const uv = geo.attributes.uv, skinIndex = [], skinWeight = [];
  const [a, b] = FINGER_JOINTS;
  for (let i = 0; i < uv.count; i++) {
    const t = uv.getY(i), j = t < (a + b) / 2 ? 0 : 1;
    const w = sstep(FINGER_JOINTS[j] - 0.06, FINGER_JOINTS[j] + 0.06, t);
    skinIndex.push(j, j + 1, 0, 0);
    skinWeight.push(1 - w, w, 0, 0);
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
}

// Closes a glove's four fingers by k, from 0 (their rest curl) to 1 (a fist). The thumb stays put.
export function grip(arm, k) {
  for (const finger of arm.fingers.slice(0, 4)) {
    finger.userData.bones.forEach((b, j) => { b.rotation.z = -arm.side * GRIP[j] * k; });
  }
}

const path = (...pts) => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');

// The hand hangs palm in towards the leg (-side x), fingers down, thumb forward (-z).
function buildHand(elbow, m, side) {
  const hand = new THREE.Group();
  hand.position.y = -0.28;
  elbow.add(hand);
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  // Palm and back of the hand, widening to the knuckles and rounding off there.
  part(hand, sweep({
    curve: path([0, 0.012, 0], [0, -0.04, 0], [0, -0.094, 0]), side: Z, rows: 14, seg: 20, n: 2.8,
    shape: (t) => { const k = 0.45 + 0.55 * cap(t, 0, 0.22); return [(0.036 + 0.008 * t) * k, 0.016 * k, 0.016 * k]; },
  }), m.glove);
  // Fingers, each one curved tube curling in towards the palm.
  const fingers = [];
  for (const [z, len, r, curl] of FINGERS) {
    let p = new THREE.Vector3(side * 0.002, -0.078, z), a = 0;
    const pts = [p];
    for (const [share, bend] of PHALANGES) {
      a += bend + curl;
      p = p.clone().add(new THREE.Vector3(-side * Math.sin(a), -Math.cos(a), 0).multiplyScalar(len * share));
      pts.push(p);
    }
    const geo = sweep({
      curve: new THREE.CatmullRomCurve3(pts, false, 'centripetal'), side: Z, rows: 16, seg: 12, n: N_LIMB,
      shape: (t) => { const k = (1 - 0.18 * t) * cap(t, 0, 0.14); return [r * 1.08 * k, r * k, r * k]; },
    });
    skinFinger(geo);
    const finger = new THREE.SkinnedMesh(geo, m.glove);
    finger.frustumCulled = false; // its bounds move with the bones
    hand.add(finger);
    // A bone at the knuckle and at each joint after it, so grip() can bend them.
    let parent = finger;
    finger.userData.bones = pts.slice(0, 3).map((q, j) => {
      const b = bone(parent);
      b.position.copy(j ? q.clone().sub(pts[j - 1]) : q);
      return (parent = b);
    });
    fingers.push(finger);
    // A padded knuckle over the first joint, and a smaller pad over the second that bends with it.
    part(hand, new THREE.SphereGeometry(r * 0.9, 10, 8), m.pad, pts[0].x + side * 0.014, -0.086, z).scale.set(0.55, 0.9, 1);
    part(finger.userData.bones[1], new THREE.SphereGeometry(r * 0.75, 8, 6), m.pad, side * r * 0.85).scale.set(0.5, 1, 1);
  }
  fingers.push(part(hand, sweep({
    curve: path([-side * 0.004, -0.02, -0.022], [-side * 0.016, -0.048, -0.046], [-side * 0.022, -0.074, -0.056], [-side * 0.026, -0.096, -0.05]),
    side: X, rows: 16, seg: 12, n: N_LIMB,
    shape: (t) => { const k = (1.15 - 0.3 * t) * cap(t, 0, 0.16) * 0.0105; return [k, k, k]; },
  }), m.glove));
  part(hand, new THREE.SphereGeometry(0.02, 12, 8), m.glove, -side * 0.008, -0.034, -0.026).scale.set(0.7, 1.2, 0.9); // the ball of the thumb
  // Hard knuckle guard across the back of the hand, and a padded plate above it.
  part(hand, sweep({
    curve: path([side * 0.017, -0.08, -0.04], [side * 0.019, -0.081, 0], [side * 0.017, -0.08, 0.04]), side: Y,
    rows: 12, seg: 12, n: 4, shape: (t) => { const k = cap(t, 0.12, 0.12); return [0.011 * k, 0.006 * k, 0.006 * k]; },
  }), m.pad);
  part(hand, sweep({
    curve: path([side * 0.016, -0.018, 0], [side * 0.017, -0.064, 0]), side: Z, rows: 8, seg: 12, n: 4,
    shape: (t) => { const k = cap(t, 0.2, 0.2); return [0.024 * k, 0.004 * k, 0.004 * k]; },
  }), m.pad);
  return fingers;
}

// A footprint in (x, z) for an extruded sole: widest at the ball, round at the heel and toe.
function footprint(ball, heel, toe, back) {
  const s = new THREE.Shape();
  s.moveTo(0, back);
  s.bezierCurveTo(heel * 1.1, back, heel, back - 0.04, heel * 0.95, back - 0.07);
  s.bezierCurveTo(heel * 0.9, -0.03, ball, -0.08, ball * 0.95, -toe * 0.7);
  s.bezierCurveTo(ball * 0.85, -toe * 0.95, ball * 0.3, -toe, 0, -toe);
  s.bezierCurveTo(-ball * 0.3, -toe, -ball * 0.85, -toe * 0.95, -ball * 0.95, -toe * 0.7);
  s.bezierCurveTo(-ball, -0.08, -heel * 0.9, -0.03, -heel * 0.95, back - 0.07);
  s.bezierCurveTo(-heel, back - 0.04, -heel * 1.1, back, 0, back);
  return s;
}

// Boot: a shaft under the jeans down to the ankle, the foot from the heel to a rounded
// toe, a welted sole and heel, a buckled strap at the ankle and another over the instep.
export function buildLeg(hips, m, side) {
  const { mesh, top: hip, lower: knee } = limb(hips, side * LEG_X, -0.02, LEG, m.jeans, 48, THIGH, [-0.04, 0.1]);
  const boot = new THREE.Group();
  boot.position.y = -0.27;
  knee.add(boot);
  const shaft = sampler(SHAFT);
  part(boot, loft({ sample: shaft, from: 0, to: SHAFT[SHAFT.length - 1][0], rows: 14, seg: 20, n: N_LIMB }), m.bootShaft);
  part(boot, loft({ sample: shaft, from: 0.135, to: 0.155, rows: 2, seg: 20, n: N_LIMB, grow: 0.004 }), m.leatherDark);
  part(boot, new THREE.TorusGeometry(0.012, 0.0025, 4, 4), m.chrome, side * (shaft(0.145)[0] + 0.006), -0.145, 0)
    .rotation.set(0, Math.PI / 2, Math.PI / 4);
  const X = new THREE.Vector3(1, 0, 0);
  const curve = path([0, -0.182, 0.058], [0, -0.184, -0.03], [0, -0.186, -0.1], [0, -0.178, -0.182]);
  const foot = sampler(FOOT);
  const shape = (t) => { const k = cap(t, 0.05, 0.08); return foot(t).map((v) => v * k); };
  part(boot, sweep({ curve, side: X, rows: 40, seg: 24, n: 2.6, shape }), m.bootFoot);
  part(boot, sweep({ curve, side: X, rows: 3, seg: 24, n: 2.6, shape, t0: 0.4, t1: 0.46, grow: 0.004 }), m.leatherDark);
  const p = curve.getPointAt(0.43);
  part(boot, new THREE.TorusGeometry(0.011, 0.0025, 4, 4), m.chrome, side * (foot(0.43)[0] + 0.006), p.y + 0.012, p.z)
    .rotation.set(0, Math.PI / 2, Math.PI / 4);
  // Sole and heel block, extruded down from the footprint.
  const bevel = (t) => ({ bevelEnabled: true, bevelThickness: t, bevelSize: t, bevelSegments: 2, curveSegments: 6 });
  part(boot, new THREE.ExtrudeGeometry(footprint(0.054, 0.046, 0.19, 0.066), { depth: 0.012, ...bevel(0.003) }), m.sole, 0, -0.205)
    .rotation.x = Math.PI / 2;
  part(boot, new THREE.ExtrudeGeometry(footprint(0.044, 0.04, -0.005, 0.064), { depth: 0.01, ...bevel(0.002) }), m.sole, 0, -0.213)
    .rotation.x = Math.PI / 2;
  return { mesh, hip, knee, boot };
}

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

// One half of the rear spoiler, sideways from x = 0 to -width: flush at the front, kicking up to a lip at the back.
function spoilerHalf(width) {
  const s = new THREE.Shape();
  s.moveTo(-0.032, -0.008);
  s.lineTo(0.026, -0.008);
  s.lineTo(0.03, 0.014);
  s.quadraticCurveTo(0, 0.006, -0.032, 0.001);
  const geo = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 6 });
  geo.rotateY(-Math.PI / 2); // the profile along z, extruded along -x
  return geo;
}

// Full-face helmet: shell, visor on side hinges, neon stripe, chin bar with a grille,
// brow intakes, exhaust slots and a split spoiler at the back.
export function buildHelmet(neck, m) {
  const head = new THREE.Group();
  head.position.y = 0.12;
  neck.add(head);
  const helmet = new THREE.Group();
  helmet.scale.set(0.95, 1.05, 1.12);
  head.add(helmet);
  part(helmet, new THREE.SphereGeometry(SHELL, 28, 18), m.shell);
  // Visor across the front (-z): phi around the sphere, theta down from the top.
  part(helmet, new THREE.SphereGeometry(0.159, 28, 10, Math.PI * 1.5 - 0.95, 1.9, 1.08, 0.62), m.visor);
  const stripe = part(helmet, new THREE.TorusGeometry(0.157, 0.006, 6, 32, Math.PI), m.stripe);
  stripe.rotation.y = Math.PI / 2; // a neon line from the brow over to the back
  const chin = part(helmet, new THREE.SphereGeometry(0.1, 16, 10, Math.PI * 1.5 - 0.8, 1.6, 1.9, 0.7), m.shell, 0, 0.01, -0.06);
  chin.scale.set(1.25, 1, 1.1); // the chin bar, standing out from the shell
  // Breathing grille on the front of the chin bar: three dark slots.
  const grille = new THREE.Group();
  grille.position.set(0, -0.049, -0.149);
  grille.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -0.59, -0.81));
  helmet.add(grille);
  for (const z of [-0.008, 0, 0.008]) part(grille, new THREE.BoxGeometry(0.03, 0.006, 0.0035), m.tape, 0, 0, z);
  for (const side of [-1, 1]) {
    // Visor hinge just behind each end of the visor: a base plate and a chrome pivot.
    const hinge = onShell(helmet, Math.PI * 1.5 + side * 1.06, 1.39);
    part(hinge, new THREE.CylinderGeometry(0.019, 0.021, 0.008, 16), m.shell, 0, 0.002);
    part(hinge, new THREE.CylinderGeometry(0.008, 0.008, 0.006, 12), m.chrome, 0, 0.008);
    // Brow intake either side of the stripe: a raised scoop with two slots across it.
    const intake = onShell(helmet, Math.PI * 1.5 + side * 0.3, 0.75);
    part(intake, new THREE.BoxGeometry(0.03, 0.009, 0.024), m.shell, 0, 0.002);
    for (const z of [-0.005, 0.005]) part(intake, new THREE.BoxGeometry(0.022, 0.003, 0.0035), m.tape, 0, 0.0065, z);
    // Exhaust slot low on the back, under a lip.
    const exhaust = onShell(helmet, Math.PI / 2 + side * 0.32, 1.42);
    part(exhaust, new THREE.BoxGeometry(0.03, 0.007, 0.012), m.shell, 0, 0.001);
    part(exhaust, new THREE.BoxGeometry(0.024, 0.003, 0.004), m.tape, 0, 0.004, 0.002);
  }
  // Spoiler across the back of the crown, split so the stripe runs through it.
  const spoiler = onShell(helmet, Math.PI / 2, 1.0);
  part(spoiler, spoilerHalf(0.034), m.shell, 0.043);
  part(spoiler, spoilerHalf(0.034), m.shell, -0.009);
  part(head, new THREE.CylinderGeometry(0.11, 0.12, 0.05, 16), m.shell, 0, -0.15, 0.005); // the rim at the neck
  head.traverse((o) => o.layers.set(HEAD_LAYER));
  return head;
}

// The biker jacket's body: lofted torso, wide lapels with snaps, an asymmetric
// zip under a raised front edge, zipped pockets, epaulettes, stand collar and belt.
export function buildJacket(chest, m) {
  const sample = sampler(TORSO);
  const n = N_BODY;
  part(chest, loft({ sample, from: TORSO[0][0], to: TORSO[TORSO.length - 1][0], rows: 56, seg: 40, n }), m.jacket);
  for (const side of [-1, 1]) {
    const outline = [[0.025, 0.565], [0.075, 0.55], [0.1, 0.508], [0.145, 0.492], [0.168, 0.445], [0.122, 0.43], [0.072, 0.452], [0.036, 0.5]]
      .map(([x, y]) => [x * side, y]);
    part(chest, frontPatch(sample, n, outline, 0.008), m.leatherDark);
    part(chest, frontTube(sample, n, [...outline, outline[0]], 0.007, 0.0045), m.leatherDark); // rolled edge
    const snap = part(chest, new THREE.CylinderGeometry(0.008, 0.008, 0.006, 12), m.chrome, side * 0.15, 0.448, frontZ(sample, n, 0.15, 0.448) - 0.014);
    snap.rotation.x = Math.PI / 2;
    // Epaulette along the top of the shoulder, with its snap.
    let y = 0.6;
    while (y > 0.4 && sample(-y)[0] < 0.13) y -= 0.002;
    const ep = part(chest, new THREE.BoxGeometry(0.11, 0.008, 0.036), m.leatherDark, side * 0.13, y + 0.006, 0);
    ep.rotation.z = -side * 0.42;
    part(chest, new THREE.CylinderGeometry(0.006, 0.006, 0.006, 10), m.chrome, side * 0.175, y - 0.012, 0).rotation.z = -side * 0.42;
  }
  // The diagonal main zip: dark tape, chrome teeth, the leather edge of the front that laps over it, and the pull.
  const zip = [[0.03, 0.095], [0.0, 0.27], [-0.062, 0.452]];
  part(chest, frontTube(sample, n, zip, 0.002, 0.008), m.tape);
  part(chest, frontTube(sample, n, zip, 0.006, 0.0042), m.chrome);
  part(chest, frontTube(sample, n, zip.map(([x, y]) => [x + 0.016, y + 0.003]), 0.006, 0.0085), m.jacket);
  part(chest, new THREE.BoxGeometry(0.01, 0.026, 0.004), m.chrome, -0.055, 0.425, frontZ(sample, n, -0.055, 0.425) - 0.012).rotation.z = 0.3;
  for (const pocket of [[[0.065, 0.34], [0.15, 0.395]], [[-0.155, 0.225], [-0.085, 0.172]], [[0.085, 0.172], [0.155, 0.225]]]) {
    part(chest, frontTube(sample, n, pocket, 0.001, 0.0055), m.tape);
    part(chest, frontTube(sample, n, pocket, 0.004, 0.0032), m.chrome);
    const [x, y] = pocket[0];
    part(chest, new THREE.BoxGeometry(0.008, 0.02, 0.003), m.chrome, x, y - 0.012, frontZ(sample, n, x, y - 0.012) - 0.008);
  }
  // Stand collar round the back and sides, open at the front.
  const collarRing = new THREE.Group();
  collarRing.position.y = 0.592;
  collarRing.rotation.y = Math.PI / 4;
  chest.add(collarRing);
  const collar = part(collarRing, new THREE.TorusGeometry(0.074, 0.02, 8, 28, Math.PI * 1.5), m.leatherDark);
  collar.rotation.x = Math.PI / 2;
  collar.scale.z = 1.7;
  // Belt round the hem, buckled on the left.
  part(chest, loft({ sample, from: -0.118, to: -0.088, rows: 2, seg: 40, n, grow: 0.006 }), m.leatherDark);
  const buckle = part(chest, new THREE.TorusGeometry(0.017, 0.0035, 4, 4), m.chrome, -0.105, 0.103, frontZ(sample, n, -0.105, 0.103) - 0.012);
  buckle.rotation.z = Math.PI / 4;
  return sample;
}

export function buildSeat(hips, m) {
  const sample = sampler(SEAT);
  part(hips, loft({ sample, from: SEAT[0][0], to: SEAT[SEAT.length - 1][0], rows: 24, seg: 40, n: N_BODY }), m.seat);
  part(hips, loft({ sample, from: -0.07, to: -0.035, rows: 2, seg: 40, n: N_BODY, grow: 0.006 }), m.leatherDark);
  const buckle = part(hips, new THREE.TorusGeometry(0.022, 0.004, 4, 4), m.chrome, 0, 0.052, frontZ(sample, N_BODY, 0, 0.052) - 0.012);
  buckle.rotation.z = Math.PI / 4;
  for (const x of [-0.13, -0.06, 0.06, 0.13]) {
    part(hips, new THREE.BoxGeometry(0.012, 0.045, 0.006), m.seat, x, 0.06, frontZ(sample, N_BODY, x, 0.06) - 0.008); // belt loop
  }
}
