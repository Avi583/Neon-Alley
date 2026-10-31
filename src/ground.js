// Wet ground: asphalt with procedural puddles and slush, and a planar
// reflection blurred by roughness so puddles mirror the neon sharply while
// damp asphalt smears it into long glowing streaks.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export class PlanarReflection {
  constructor(scale) {
    this.scale = scale;
    this.rt = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.cam = new THREE.PerspectiveCamera();
    this.matrix = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._u = new THREE.Vector3();
    this._r = new THREE.Matrix4();
  }

  setSize(w, h) {
    this.rt.setSize(Math.max(2, Math.floor(w * this.scale)), Math.max(2, Math.floor(h * this.scale)));
  }

  update(renderer, scene, camera, hide) {
    const cam = this.cam;
    camera.updateMatrixWorld();
    const cp = this._p.setFromMatrixPosition(camera.matrixWorld);
    this._r.extractRotation(camera.matrixWorld);
    const look = this._t.set(0, 0, -1).applyMatrix4(this._r).add(cp);
    const up = this._u.set(0, 1, 0).applyMatrix4(this._r);
    // mirror across the ground plane y = 0
    cam.position.set(cp.x, -cp.y, cp.z);
    look.y = -look.y;
    up.y = -up.y;
    cam.up.copy(up);
    cam.lookAt(look);
    cam.near = camera.near;
    cam.far = camera.far;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);
    cam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);

    this.matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.matrix.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);

    for (const o of hide) o.visible = false;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.setRenderTarget(prev);
    for (const o of hide) o.visible = true;
  }
}

const NOISE = /* glsl */`
float gh21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float gvn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gh21(i), gh21(i + vec2(1.0, 0.0)), f.x), mix(gh21(i + vec2(0.0, 1.0)), gh21(i + vec2(1.0, 1.0)), f.x), f.y); }
`;

const FRAG_HEAD = /* glsl */`
varying vec3 vWPos;
varying vec4 vRefl;
uniform sampler2D uReflMap;
uniform sampler2D uMaskMap;
uniform vec4 uMaskXform;
uniform float uReflStrength;
uniform float uLodMax;
uniform float uTime;
float gSnow;
float gPuddle;
${NOISE}
`;

const FRAG_MASKS = /* glsl */`
{
  vec2 gm = texture2D(uMaskMap, vWPos.xz * uMaskXform.xy + uMaskXform.zw).rg;
  gSnow = gm.r;
  gPuddle = gm.g;
}
`;

// Snow in red, puddles in green, in world space across the ground plane.
const BAKE_FRAG = /* glsl */`
varying vec2 vWorld;
${NOISE}
float gfbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * gvn(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  vec2 gp = vWorld;
  float edge = abs(gp.x);
  float sn = gfbm(gp * vec2(1.3, 0.7));
  float snow = smoothstep(1.45, 2.0, edge + (sn - 0.5) * 1.0);
  snow = max(snow, smoothstep(0.74, 0.8, gfbm(gp * 0.5 + 7.3)) * 0.7);
  float pn = gfbm(gp * vec2(0.42, 0.24) + 3.1);
  float puddle = smoothstep(0.47, 0.53, pn) * (1.0 - smoothstep(0.2, 0.6, snow));
  gl_FragColor = vec4(snow, puddle, 0.0, 1.0);
}
`;

// The masks never change, so they are drawn once into a texture 8 times as long as
// it is wide, which matches the plane's proportions and the noise's finer x detail.
const WATER_W = 128, WATER_H = 1024; // the CPU's copy of the puddle mask, for footsteps

// Is (x, z) in a puddle? pixels is an RGBA bake with puddles in green, row 0 at z1.
export function puddleLookup(pixels, w, h, W, L, z1) {
  return (x, z) => {
    const u = x / W + 0.5, v = (z - z1) / L;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
    return pixels[(Math.floor(v * h) * w + Math.floor(u * w)) * 4 + 1] > 127;
  };
}

function bakeMasks(renderer, Q, W, L, z1) {
  const h = Math.min(Q.groundMask, renderer.capabilities.maxTextureSize), w = h / 8;
  const rt = new THREE.WebGLRenderTarget(w, h, {
    format: THREE.RGFormat,
    depthBuffer: false,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    anisotropy: renderer.capabilities.getMaxAnisotropy(),
  });
  const material = new THREE.ShaderMaterial({
    uniforms: { uSize: { value: new THREE.Vector3(W, L, z1) } },
    vertexShader: /* glsl */`
      uniform vec3 uSize;
      varying vec2 vWorld;
      void main() {
        vWorld = vec2((uv.x - 0.5) * uSize.x, uv.y * uSize.y + uSize.z);
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: BAKE_FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new FullScreenQuad(material);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  quad.render(renderer);
  // RGBA, as RG isn't a format every browser can read back. The noise can't be run in
  // JS instead, since GLSL's 32-bit floats give different results.
  const readable = new THREE.WebGLRenderTarget(WATER_W, WATER_H, { depthBuffer: false });
  const pixels = new Uint8Array(WATER_W * WATER_H * 4);
  renderer.setRenderTarget(readable);
  quad.render(renderer);
  renderer.readRenderTargetPixels(readable, 0, 0, WATER_W, WATER_H, pixels);
  renderer.setRenderTarget(prev);
  readable.dispose();
  quad.dispose();
  material.dispose();
  return { rt, inWater: puddleLookup(pixels, WATER_W, WATER_H, W, L, z1) };
}

const FRAG_COLOR = /* glsl */`
{
  vec3 snowCol = vec3(0.80, 0.84, 0.94) * (0.86 + 0.14 * gvn(vWPos.xz * 18.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, snowCol, gSnow);
  diffuseColor.rgb *= mix(1.0, 0.3, gPuddle);
}
`;

const FRAG_ROUGH = /* glsl */`
roughnessFactor = mix(roughnessFactor, 0.015, gPuddle);
roughnessFactor = mix(roughnessFactor, 0.55, gSnow);
`;

const FRAG_NORMAL = /* glsl */`
normal = normalize(mix(normal, normalize(vNormal), max(gPuddle * 0.92, gSnow * 0.6)));
`;

const FRAG_REFL = /* glsl */`
{
  vec3 V = normalize(vViewPosition);
  float NdV = clamp(dot(normal, V), 0.0, 1.0);
  float F = 0.03 + 0.97 * pow(1.0 - NdV, 5.0);
  F = mix(F, max(F, 0.6), gPuddle);
  vec3 dn = normal - normalize(vNormal);
  vec2 ruv = vRefl.xy / vRefl.w + dn.xy * 0.012;
  ruv += gPuddle * 0.0004 * vec2(sin(vWPos.z * 9.0 + uTime * 1.5), cos(vWPos.x * 8.0 - uTime * 1.2));
  float lod = clamp(roughnessFactor * 1.4, 0.0, 1.0) * uLodMax;
  vec3 refl = textureLod(uReflMap, ruv, lod).rgb;
  float wet = mix(0.45, 1.0, gPuddle) * (1.0 - gSnow * 0.85);
  outgoingLight += refl * F * wet * uReflStrength;
}
`;

const repeated = (t, x, y) => { const c = t.clone(); c.repeat.set(x, y); c.needsUpdate = true; return c; };

export function createGround(tx, Q, refl, renderer) {
  const W = 7.2, z0 = 20, z1 = -93;
  const L = z0 - z1;
  const geo = new THREE.PlaneGeometry(W, L, 1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, (z0 + z1) / 2);

  const tile = 2.2;
  const mat = new THREE.MeshStandardMaterial({
    map: repeated(tx.asphalt.map, W / tile, L / tile),
    normalMap: repeated(tx.asphalt.normalMap, W / tile, L / tile),
    roughnessMap: repeated(tx.asphalt.roughnessMap, W / tile, L / tile),
    roughness: 1, metalness: 0, envMapIntensity: 0.2,
    normalScale: new THREE.Vector2(0.9, 0.9),
  });
  const masks = bakeMasks(renderer, Q, W, L, z1);
  const uniforms = {
    uReflMap: { value: refl.rt.texture },
    uMaskMap: { value: masks.rt.texture },
    uMaskXform: { value: new THREE.Vector4(1 / W, 1 / L, 0.5, -z1 / L) },
    uReflMatrix: { value: refl.matrix },
    uReflStrength: { value: 1.0 },
    uLodMax: { value: Q.reflLod },
    uTime: { value: 0 },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec4 vRefl;\nuniform mat4 uReflMatrix;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvec4 gwp = modelMatrix * vec4(transformed, 1.0);\nvWPos = gwp.xyz;\nvRefl = uReflMatrix * gwp;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + FRAG_MASKS)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + FRAG_ROUGH)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FRAG_NORMAL)
      .replace('#include <opaque_fragment>', FRAG_REFL + '\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => 'wet-ground-v1';
  const mesh = new THREE.Mesh(geo, mat);

  // the cross street at the far end (not mirrored, just damp)
  const sW = 160, sL = 16;
  const sgeo = new THREE.PlaneGeometry(sW, sL);
  sgeo.rotateX(-Math.PI / 2);
  sgeo.translate(0, -0.002, -98.5);
  const street = new THREE.Mesh(sgeo, new THREE.MeshStandardMaterial({
    map: repeated(tx.asphalt.map, sW / 3, sL / 3), normalMap: repeated(tx.asphalt.normalMap, sW / 3, sL / 3),
    roughness: 0.35, metalness: 0, color: 0x9a9aa8, envMapIntensity: 0.8,
  }));
  return { mesh, street, uniforms, inWater: masks.inWater };
}
