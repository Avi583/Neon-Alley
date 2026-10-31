// Dynamic light pool. The alley has ~50 light sources (signs, doors,
// lanterns...) but only N real point lights. Every frame the N most
// relevant sources near the camera borrow a light. Weights fade to zero as
// a source approaches the cut-off, so swaps never pop.
import * as THREE from 'three';

export class LightPool {
  constructor(scene, n, candidates) {
    this.c = candidates;
    this.lights = [];
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 12, 2);
      scene.add(l);
      this.lights.push(l);
    }
    this.fwd = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
    this.order = candidates.map((_, i) => i);
    this.scores = new Float32Array(candidates.length);
  }

  update(camera) {
    const cp = camera.position;
    camera.getWorldDirection(this.fwd);
    const { c, scores } = this;
    for (let i = 0; i < c.length; i++) {
      this.tmp.subVectors(c[i].pos, cp);
      const d = this.tmp.length();
      const facing = d > 0.001 ? this.tmp.dot(this.fwd) / d : 1;
      scores[i] = d * (1 + 0.6 * Math.max(0, -facing)) / Math.sqrt(Math.max(c[i].intensity, 0.5) / 8);
    }
    this.order.sort((a, b) => scores[a] - scores[b]);
    const n = this.lights.length;
    const cutoff = c.length > n ? scores[this.order[n]] : Infinity;
    for (let i = 0; i < n; i++) {
      const l = this.lights[i];
      if (i >= c.length) { l.intensity = 0; continue; }
      const src = c[this.order[i]];
      const s = scores[this.order[i]];
      const w = cutoff === Infinity ? 1 : THREE.MathUtils.clamp((cutoff - s) / (cutoff * 0.3), 0, 1);
      const f = src.state ? src.state.factor : 1;
      l.position.copy(src.pos);
      l.color.copy(src.color);
      l.distance = src.range || 12;
      l.intensity = src.intensity * f * w;
    }
  }
}
