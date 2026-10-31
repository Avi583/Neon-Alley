// Boot marks left behind the walker. A fixed pool of flat decals, reused oldest
// first. The fade runs in the shader from each mark's birth time, so the only
// per-frame cost is one uniform: dark imprints in snow, pale slush tracked onto the
// asphalt (which is too dark to darken further), and almost nothing in water.
import * as THREE from 'three';

export const MARK_LIFE = 20; // seconds
export const MARK_COUNT = 72; // running leaves about 3.5 marks a second
const MARK_W = 0.12, MARK_L = 0.3;
const STANCE = 0.09, TOE_OUT = 0.08;

export class Footprints {
  constructor(map, ground, fog) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    this.born = new THREE.InstancedBufferAttribute(new Float32Array(MARK_COUNT), 1);
    geo.setAttribute('aBorn', this.born);
    this.time = { value: 0 };
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: map },
        uMaskMap: ground.uMaskMap,
        uMaskXform: ground.uMaskXform,
        uTime: this.time,
        uLife: { value: MARK_LIFE },
        uFog: { value: fog.density },
      },
      vertexShader: /* glsl */`
        attribute float aBorn;
        uniform float uTime;
        uniform float uLife;
        varying vec2 vUv;
        varying vec3 vWPos;
        varying float vFade;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vWPos = wp.xyz;
          vFade = 1.0 - smoothstep(0.3, 1.0, (uTime - aBorn) / uLife);
          gl_Position = vFade > 0.0 ? projectionMatrix * viewMatrix * wp : vec4(2.0, 2.0, 2.0, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uMap;
        uniform sampler2D uMaskMap;
        uniform vec4 uMaskXform;
        uniform float uFog;
        varying vec2 vUv;
        varying vec3 vWPos;
        varying float vFade;
        void main() {
          vec2 gm = texture2D(uMaskMap, vWPos.xz * uMaskXform.xy + uMaskXform.zw).rg;
          float depth = mix(0.6, 0.65, gm.r) * (1.0 - gm.g * 0.9);
          float d = distance(vWPos, cameraPosition) * uFog;
          vec3 col = mix(vec3(0.05, 0.055, 0.07), vec3(0.0), smoothstep(0.1, 0.5, gm.r));
          gl_FragColor = vec4(col, texture2D(uMap, vUv).a * depth * vFade * exp(-d * d));
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide, // left boots are mirrored
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MARK_COUNT);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1; // on the ground, so before any other transparent object
    this.next = 0;
    this.left = false;
    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
  }

  update(t) {
    this.time.value = t;
  }

  // pos is the walker's position on the ground: x, and z as pos.y.
  add(pos, yaw) {
    this.left = !this.left;
    const foot = this.left ? -1 : 1;
    this._p.set(pos.x + Math.cos(yaw) * STANCE * foot, 0.004, pos.y - Math.sin(yaw) * STANCE * foot);
    this._q.setFromAxisAngle(this._up, yaw - foot * TOE_OUT);
    this._s.set(MARK_W * foot, 1, MARK_L);
    this.mesh.setMatrixAt(this.next, this._m.compose(this._p, this._q, this._s));
    this.mesh.instanceMatrix.needsUpdate = true;
    this.born.setX(this.next, this.time.value);
    this.born.needsUpdate = true;
    this.next = (this.next + 1) % MARK_COUNT;
    this.mesh.count = Math.min(this.mesh.count + 1, MARK_COUNT);
  }
}
