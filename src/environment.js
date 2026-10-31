import * as THREE from 'three';
import { hdr } from './materials.js';

// A tiny neon "room" baked into an environment map, so metal, glass, ice
// and wet surfaces pick up coloured highlights from every angle.
export function buildEnvironment(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: 0x07060e, side: THREE.BackSide })));
  const panel = (hex, k, x, y, z, w, h, ry, rx = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: hdr(hex, k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m);
  };
  panel('#ff3fa4', 6, -9.5, 2, -3, 4, 1.4, Math.PI / 2);
  panel('#38e8ff', 6, 9.5, 3, -5, 3, 1.2, -Math.PI / 2);
  panel('#b66bff', 4, -9.5, 5, 5, 2, 3, Math.PI / 2);
  panel('#ffd08a', 3, 9.5, 1, 4, 4, 1, -Math.PI / 2);
  panel('#ff4d6d', 5, 0, 4, -9.5, 6, 1, 0);
  panel('#5dffb4', 3, 0, 2, 9.5, 3, 0.8, Math.PI);
  panel('#2a3260', 0.8, 0, 9.5, 0, 20, 20, 0, Math.PI / 2);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.03).texture;
  pm.dispose();
  s.traverse((o) => {
    if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
  });
  return tex;
}
