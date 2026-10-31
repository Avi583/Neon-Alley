// Neon signs: mounted on brackets and animated with per-sign flicker. Each sign
// also registers a coloured light so it actually lights the alley around it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash2, noise1 } from './noise.js';
import { canvasTexture } from './texture-core.js';
import { WALL } from './config.js';
import { SIGN_SPECS } from './sign-specs.js';
import { drawSign } from './sign-canvas.js';
import { holoVert, holoFrag } from './holo-shader.js';

function flicker(type, t, s) {
  switch (type) {
    case 'pulse': return 0.78 + 0.22 * Math.sin(t * 1.7 + s * 6.28);
    case 'flicker': {
      const n = noise1(t * 0.35, s);
      if (n > 0.72) return hash2(Math.floor(t * 24), 3, s) > 0.45 ? 1 : 0.06;
      return 0.97 + 0.03 * Math.sin(t * 90);
    }
    case 'broken': {
      const n = noise1(t * 0.6, s);
      if (n > 0.5) return hash2(Math.floor(t * 18), 7, s) > 0.3 ? 0.95 : 0.03;
      return n < 0.12 ? 0.04 : 0.95;
    }
    default: return 0.97 + 0.03 * Math.sin(t * 120 + s);
  }
}

export function buildSigns(kit, mats, holoText, ppm, scene) {
  const { box, snow, icicles, R } = kit;
  const items = [];
  const lights = [];
  const unitPlane = new THREE.PlaneGeometry(1, 1);
  let holo = null;

  SIGN_SPECS.forEach((spec, idx) => {
    const seed = idx * 7 + 3;
    const state = { factor: 1 };
    const side = spec.side || 1;
    const { w, h, y, z } = spec;

    if (spec.kind === 'holo') {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 }, uText: { value: holoText }, uI: { value: 2.4 },
          uC1: { value: new THREE.Color(spec.color) }, uC2: { value: new THREE.Color(spec.color2) },
        },
        vertexShader: holoVert, fragmentShader: holoFrag,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      const rotY = -side * (Math.PI / 2 - 0.55);
      const ax = Math.abs(Math.cos(rotY));
      const cx = side * (WALL - 0.12) - side * ax * w / 2;
      mesh.position.set(cx, y, z);
      mesh.rotation.y = rotY;
      scene.add(mesh);
      // frame + brackets
      const off = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY)).multiplyScalar(-0.06);
      box(mats.metalDark, cx + off.x, y + h / 2 + 0.05, z + off.z, w + 0.1, 0.08, 0.1, null, rotY);
      box(mats.metalDark, cx + off.x, y - h / 2 - 0.05, z + off.z, w + 0.1, 0.08, 0.1, null, rotY);
      box(mats.metalDark, side * (WALL + 0.1), y, z - 0.4, 0.6, h * 0.9, 0.08);
      snow(cx + off.x, y + h / 2 + 0.09, z + off.z, 0.1, 0.1);
      holo = { mesh, mat, state };
      lights.push({ pos: new THREE.Vector3(cx + side * -0.6, y - 0.5, z + 0.8), color: new THREE.Color('#9a7bff'), intensity: spec.light, range: 16, state });
      return;
    }

    const tex = canvasTexture(drawSign(spec, ppm), { repeat: false });
    const base = spec.style === 'box' ? 1.7 : 2.6;
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(base, base, base) });
    let geo, pos = new THREE.Vector3(), lightPos;
    const T = 0.1;

    if (spec.mount === 'flat') {
      const x = side * (WALL - 0.16);
      geo = unitPlane.clone().scale(w, h, 1).rotateY(-side * Math.PI / 2);
      pos.set(x, y, z);
      box(mats.metalDark, side * (WALL + 0.1), y, z, 0.5, h + 0.06, w + 0.06);
      lightPos = new THREE.Vector3(x - side * 0.7, y, z);
    } else if (spec.mount === 'facing' || spec.mount === 'facingBack') {
      const back = spec.mount === 'facingBack';
      geo = unitPlane.clone().scale(w, h, 1);
      if (back) geo.rotateY(Math.PI);
      pos.set(spec.x, y, z);
      box(mats.metalDark, spec.x, y, z + (back ? 0.12 : -0.12), w + 0.2, h + 0.2, 0.2);
      lightPos = new THREE.Vector3(spec.x, y - h * 0.4, z + (back ? -1.5 : 1.5));
    } else {
      // perpendicular sign projecting from the wall into the alley
      const cx = side * (WALL - 0.13 - w / 2);
      const front = unitPlane.clone().scale(w, h, 1).translate(0, 0, T / 2 + 0.003);
      const back = unitPlane.clone().scale(w, h, 1).rotateY(Math.PI).translate(0, 0, -T / 2 - 0.003);
      geo = mergeGeometries([front, back]);
      pos.set(cx, y, z);
      box(mats.metalDark, cx, y, z, w + 0.07, h + 0.07, T);
      for (const dy of [h * 0.32, -h * 0.32]) box(mats.metalDark, side * (WALL + 0.1), y + dy, z, 0.6, 0.05, 0.05);
      snow(cx, y + h / 2 + 0.035, z, w + 0.05, T + 0.04);
      if (R(0, 1) < 0.6) icicles(cx - w / 2 + 0.05, y - h / 2 - 0.035, z, cx + w / 2 - 0.05, y - h / 2 - 0.035, z, 0.35, 0.22);
      lightPos = new THREE.Vector3(cx, y - h * 0.3, z);
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    scene.add(mesh);
    items.push({ spec, seed, state, mat, base });
    if (spec.light > 0) lights.push({ pos: lightPos, color: new THREE.Color(spec.color), intensity: spec.light, range: 13, state });
  });

  return {
    lights,
    update(t) {
      for (const it of items) {
        it.state.factor = flicker(it.spec.flicker, t, it.seed);
        it.mat.color.setScalar(it.base * it.state.factor);
      }
      if (holo) {
        holo.mat.uniforms.uTime.value = t;
        holo.state.factor = 0.9 + 0.1 * Math.sin(t * 3);
      }
    },
  };
}
