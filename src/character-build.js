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
    // Helmet: matte gunmetal shell, an iridescent gold visor, matte black trim and mouth guard.
    shell: phys({ color: 0x3f3d3a, roughness: 0.6, metalness: 0.35, clearcoat: 0.15, clearcoatRoughness: 0.6 }),
    visor: phys({
      color: 0xd6a22a, roughness: 0.06, metalness: 1, emissive: hdr(0xffb238, 0.04),
      iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [260, 620],
    }),
    trim: std({ color: 0x0e0e10, roughness: 0.78, side: THREE.DoubleSide }),
    guard: std({ color: 0x141416, roughness: 0.72, metalness: 0.05, flatShading: true, side: THREE.DoubleSide }),
    vent: std({ color: 0x040405, roughness: 0.95 }),
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
// The shaft stays with the shin, and the foot (boot) pivots at the ankle, ANKLE below the shaft's top.
export const SHIN = 0.27, ANKLE = 0.155; // from the knee to the top of the shaft, and on down to the ankle
export function buildLeg(hips, m, side) {
  const { mesh, top: hip, lower: knee } = limb(hips, side * LEG_X, -0.02, LEG, m.jeans, 48, THIGH, [-0.04, 0.1]);
  hip.rotation.order = 'ZXY'; // the walk swings the leg forward, then out to the side
  const shin = new THREE.Group();
  shin.position.y = -SHIN;
  knee.add(shin);
  const boot = new THREE.Group();
  boot.position.y = -SHIN - ANKLE;
  knee.add(boot);
  const shaft = sampler(SHAFT);
  part(shin, loft({ sample: shaft, from: 0, to: SHAFT[SHAFT.length - 1][0], rows: 14, seg: 20, n: N_LIMB }), m.bootShaft);
  part(shin, loft({ sample: shaft, from: 0.135, to: 0.155, rows: 2, seg: 20, n: N_LIMB, grow: 0.004 }), m.leatherDark);
  part(shin, new THREE.TorusGeometry(0.012, 0.0025, 4, 4), m.chrome, side * (shaft(0.145)[0] + 0.006), -0.145, 0)
    .rotation.set(0, Math.PI / 2, Math.PI / 4);
  const X = new THREE.Vector3(1, 0, 0);
  const up = ANKLE; // the foot's parts, laid out from the shaft's top, sit this much higher from the ankle
  const curve = path([0, up - 0.182, 0.058], [0, up - 0.184, -0.03], [0, up - 0.186, -0.1], [0, up - 0.178, -0.182]);
  const foot = sampler(FOOT);
  const shape = (t) => { const k = cap(t, 0.05, 0.08); return foot(t).map((v) => v * k); };
  part(boot, sweep({ curve, side: X, rows: 40, seg: 24, n: 2.6, shape }), m.bootFoot);
  part(boot, sweep({ curve, side: X, rows: 3, seg: 24, n: 2.6, shape, t0: 0.4, t1: 0.46, grow: 0.004 }), m.leatherDark);
  const p = curve.getPointAt(0.43);
  part(boot, new THREE.TorusGeometry(0.011, 0.0025, 4, 4), m.chrome, side * (foot(0.43)[0] + 0.006), p.y + 0.012, p.z)
    .rotation.set(0, Math.PI / 2, Math.PI / 4);
  // Sole and heel block, extruded down from the footprint.
  const bevel = (t) => ({ bevelEnabled: true, bevelThickness: t, bevelSize: t, bevelSegments: 2, curveSegments: 6 });
  part(boot, new THREE.ExtrudeGeometry(footprint(0.054, 0.046, 0.19, 0.066), { depth: 0.012, ...bevel(0.003) }), m.sole, 0, up - 0.205)
    .rotation.x = Math.PI / 2;
  part(boot, new THREE.ExtrudeGeometry(footprint(0.044, 0.04, -0.005, 0.064), { depth: 0.01, ...bevel(0.002) }), m.sole, 0, up - 0.213)
    .rotation.x = Math.PI / 2;
  return { mesh, hip, knee, shin, boot };
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
