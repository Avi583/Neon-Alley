// Water kicked up by a step in a puddle: a spreading ring on the surface and a few
// droplets thrown clear of it. Fixed pools, reused oldest first, with the motion in
// the shaders, so the only per-frame cost is a couple of uniforms. Built only on the
// presets that ask for it.
import * as THREE from 'three';

export const SPLASH_LIFE = 0.7; // seconds
export const SPLASH_COUNT = 4; // running takes about 3.5 steps a second
export const DROPS_PER_SPLASH = 12;
const RUN_SPEED = 4.2; // same as player.js
const RING_Y = 0.006; // above the footprints
const RING_MIN = 0.45, RING_RUN = 0.45; // width of the ring's quad: standing still, plus at a run
const DROP_SIZE = 0.022;
const GRAVITY = 6;

const strength = (speed) => Math.min(speed / RUN_SPEED, 1);

export class Splashes {
  constructor(fog) {
    this.time = { value: 0 };
    this.scale = { value: 1 };
    const fogDensity = { value: fog.density };
    this.rings = this.makeRings(fogDensity);
    this.drops = this.makeDrops(fogDensity);
    this.next = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
  }

  makeRings(fogDensity) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    this.ringBorn = new THREE.InstancedBufferAttribute(new Float32Array(SPLASH_COUNT), 1);
    geo.setAttribute('aBorn', this.ringBorn);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: this.time, uLife: { value: SPLASH_LIFE }, uFog: fogDensity },
      vertexShader: /* glsl */`
        attribute float aBorn;
        uniform float uTime;
        uniform float uLife;
        varying vec2 vUv;
        varying vec3 vWPos;
        varying float vAge;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vWPos = wp.xyz;
          vAge = (uTime - aBorn) / uLife;
          gl_Position = vAge < 1.0 ? projectionMatrix * viewMatrix * wp : vec4(2.0, 2.0, 2.0, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uFog;
        varying vec2 vUv;
        varying vec3 vWPos;
        varying float vAge;
        float ring(float d, float r, float w) { return 1.0 - smoothstep(0.0, w, abs(d - r)); }
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float grow = 1.0 - (1.0 - vAge) * (1.0 - vAge);
          float a = ring(d, grow * 0.9, 0.09) + 0.5 * ring(d, grow * 0.5, 0.07);
          float f = distance(vWPos, cameraPosition) * uFog;
          gl_FragColor = vec4(vec3(0.62, 0.68, 0.8), a * 0.55 * (1.0 - vAge) * exp(-f * f));
        }`,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, SPLASH_COUNT);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.renderOrder = -0.5; // straight after the footprints
    return mesh;
  }

  makeDrops(fogDensity) {
    const n = SPLASH_COUNT * DROPS_PER_SPLASH;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.dropVel = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    geo.setAttribute('aVel', this.dropVel);
    this.dropBorn = new THREE.BufferAttribute(new Float32Array(n).fill(-SPLASH_LIFE * 2), 1);
    geo.setAttribute('aBorn', this.dropBorn);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.time, uLife: { value: SPLASH_LIFE }, uFog: fogDensity,
        uScale: this.scale, uSize: { value: DROP_SIZE }, uGravity: { value: GRAVITY },
      },
      vertexShader: /* glsl */`
        attribute vec3 aVel;
        attribute float aBorn;
        uniform float uTime;
        uniform float uLife;
        uniform float uFog;
        uniform float uScale;
        uniform float uSize;
        uniform float uGravity;
        varying float vAlpha;
        void main() {
          float age = uTime - aBorn;
          vec3 p = position + aVel * age;
          p.y -= 0.5 * uGravity * age * age;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = age < uLife && p.y > 0.0 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
          gl_PointSize = max(uSize * uScale / -mv.z, 1.5);
          float f = -mv.z * uFog;
          vAlpha = (1.0 - age / uLife) * exp(-f * f);
        }`,
      fragmentShader: /* glsl */`
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          gl_FragColor = vec4(vec3(0.75, 0.8, 0.92), (1.0 - smoothstep(0.5, 1.0, d)) * vAlpha);
        }`,
      transparent: true,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    return points;
  }

  update(t, camera, heightPx) {
    this.time.value = t;
    this.scale.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }

  // foot is the point on the ground that the step landed on.
  add(foot, speed) {
    const k = strength(speed);
    const width = RING_MIN + RING_RUN * k;
    this._s.set(width, 1, width);
    this._m.compose(new THREE.Vector3(foot.x, RING_Y, foot.z), this._q, this._s);
    this.rings.setMatrixAt(this.next, this._m);
    this.rings.instanceMatrix.needsUpdate = true;
    this.ringBorn.setX(this.next, this.time.value);
    this.ringBorn.needsUpdate = true;
    this.rings.count = Math.min(this.rings.count + 1, SPLASH_COUNT);

    const pos = this.drops.geometry.attributes.position;
    for (let i = 0; i < DROPS_PER_SPLASH; i++) {
      const d = this.next * DROPS_PER_SPLASH + i;
      const a = Math.random() * Math.PI * 2, out = (0.2 + Math.random() * 0.5) * (0.6 + k);
      pos.setXYZ(d, foot.x, RING_Y, foot.z);
      this.dropVel.setXYZ(d, Math.cos(a) * out, (0.6 + Math.random() * 0.7) * (0.7 + k * 0.6), Math.sin(a) * out);
      this.dropBorn.setX(d, this.time.value);
    }
    pos.needsUpdate = this.dropVel.needsUpdate = this.dropBorn.needsUpdate = true;
    this.next = (this.next + 1) % SPLASH_COUNT;
  }
}
