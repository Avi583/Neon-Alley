// Post-processing: HDR render (with MSAA on higher presets) -> bloom ->
// chromatic aberration + colour grade -> ACES tone mapping -> optional FXAA
// -> vignette + film grain.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

const vert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uCA: { value: 0.006 } },
  vertexShader: vert,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uCA; varying vec2 vUv;
    void main(){
      vec2 d = vUv - 0.5;
      vec2 off = d * dot(d, d) * uCA * 4.0;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col += vec3(0.006, 0.003, 0.016) * (1.0 - smoothstep(0.0, 0.2, l));
      col *= mix(vec3(0.94, 0.97, 1.1), vec3(1.05, 0.98, 1.02), smoothstep(0.05, 1.2, l));
      gl_FragColor = vec4(col, 1.0);
    }`,
};

const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uGrain: { value: 0.035 } },
  vertexShader: vert,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; uniform float uGrain; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec2 d = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      float v = smoothstep(1.15, 0.35, length(d));
      c *= mix(0.45, 1.0, v);
      float g = fract(sin(dot(floor(vUv * uRes) + fract(uTime * 7.13) * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
      c += (g - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export function createPost(renderer, scene, camera, Q) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: Q.msaa });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), Q.bloomStrength, 0.38, 1.0);
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  let fxaa = null;
  if (Q.fxaa) {
    fxaa = new ShaderPass(FXAAShader);
    composer.addPass(fxaa);
  }
  const final = new ShaderPass(FinalShader);
  composer.addPass(final);

  function setSize(w, h, pr) {
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    final.uniforms.uRes.value.set(w * pr, h * pr);
    if (fxaa) fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
  }
  return {
    setSize,
    render(t) { final.uniforms.uTime.value = t; composer.render(); },
  };
}
