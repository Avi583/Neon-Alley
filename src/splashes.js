// Water kicked up by a step in a puddle: a spreading boot-shaped ring on the surface
// and a few droplets thrown clear of it. Fixed pools, reused oldest first, with the motion in
// the shaders, so the only per-frame cost is a couple of uniforms. Built only on the
// presets that ask for it.
import * as THREE from 'three';
import { RUN_SPEED } from './player.js';

export const SPLASH_LIFE = 0.7; // seconds
export const SPLASH_COUNT = 4; // running takes about 3.5 steps a second
export const DROPS_PER_SPLASH = 12;
const RING_Y = 0.006; // above the footprints
const RING_MIN = 0.38, RING_RUN = 0.22; // width of the ring's quad: standing still, plus at a run
const DROP_SIZE = 0.016;
const GRAVITY = 6;
const FAN = 1.2; // half-width of the forward fan of droplets, in radians
const CROWN_EVERY = 4; // one droplet in this many may go any way
const CARRY = 0.07; // share of the walking speed the boot gives the fan's droplets

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
    this._up = new THREE.Vector3(0, 1, 0);
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
        float box(vec2 p, vec2 b, float r) {
          vec2 q = abs(p) - b + r;
          return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
        }
        // Distance to a sole one unit long with the toe up, in the proportions of genBootPrint.
        float sole(vec2 p) {
          vec2 r = vec2(0.152, 0.27), f = p - vec2(0.016, 0.2);
          float k = length(f / r);
          float fore = k * (k - 1.0) / max(length(f / (r * r)), 0.001);
          float waist = box(p - vec2(0.004, -0.08), vec2(0.1, 0.2), 0.02);
          float heel = box(p - vec2(-0.008, -0.31), vec2(0.112, 0.15), 0.08);
          return min(min(fore, waist), heel);
        }
        float ring(vec2 p, float s, float w) {
          s = max(s, 0.001);
          return 1.0 - smoothstep(0.0, w, abs(sole(p / s) * s));
        }
        void main() {
          vec2 p = vUv - 0.5;
          float grow = 1.0 - (1.0 - vAge) * (1.0 - vAge);
          float a = ring(p, grow * 0.9, 0.045) + 0.5 * ring(p, grow * 0.5, 0.035);
          float f = distance(vWPos, cameraPosition) * uFog;
          gl_FragColor = vec4(vec3(0.62, 0.68, 0.8), a * 0.55 * (1.0 - vAge) * exp(-f * f));
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide, // left boots are mirrored
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
    // Only changes with a resize or a new field of view.
    if (heightPx !== this._h || camera.fov !== this._fov) {
      this._h = heightPx;
      this._fov = camera.fov;
      this.scale.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    }
  }

  // foot is the point on the ground that the step landed on, yaw the way the boot
  // points, side -1 for a left boot, which is mirrored, and vel the walker's velocity
  // (x, and z as y), which the droplets are thrown along; without it, the way the boot points.
  add(foot, speed, yaw = 0, side = 1, vel = null) {
    const k = strength(speed);
    const width = RING_MIN + RING_RUN * k;
    this._s.set(width * side, 1, width);
    this._q.setFromAxisAngle(this._up, yaw);
    this._m.compose(new THREE.Vector3(foot.x, RING_Y, foot.z), this._q, this._s);
    this.rings.setMatrixAt(this.next, this._m);
    this.rings.instanceMatrix.needsUpdate = true;
    this.ringBorn.setX(this.next, this.time.value);
    this.ringBorn.needsUpdate = true;
    this.rings.count = Math.min(this.rings.count + 1, SPLASH_COUNT);

    // Most droplets fly forward and out in a fan along the walk, carried on by the boot;
    // every CROWN_EVERY-th one goes any way, for the crown round the heel.
    const moving = vel && vel.lengthSq() > 0.01;
    const heading = moving ? Math.atan2(vel.y, vel.x) : Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
    const pos = this.drops.geometry.attributes.position;
    for (let i = 0; i < DROPS_PER_SPLASH; i++) {
      const d = this.next * DROPS_PER_SPLASH + i;
      const crown = i % CROWN_EVERY === 0;
      const a = heading + (Math.random() * 2 - 1) * (crown ? Math.PI : FAN);
      const out = (0.12 + Math.random() * 0.3) * (0.5 + k * 1.1) + (crown ? 0 : CARRY * speed);
      pos.setXYZ(d, foot.x, RING_Y, foot.z);
      this.dropVel.setXYZ(d, Math.cos(a) * out, (0.45 + Math.random() * 0.5) * (0.7 + k * 0.6), Math.sin(a) * out);
      this.dropBorn.setX(d, this.time.value);
    }
    pos.needsUpdate = this.dropVel.needsUpdate = this.dropBorn.needsUpdate = true;
    this.next = (this.next + 1) % SPLASH_COUNT;
  }
}
