// Sky dome, falling snow (GPU particles) and steam plumes (instanced
// billboards). All animation happens in the vertex shaders.
import * as THREE from 'three';

export function createSky(fogColor) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTop: { value: new THREE.Color('#03040a') },
      uHorizon: { value: fogColor.clone() },
      uGlow: { value: new THREE.Color('#5a2266') },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uHorizon, uGlow; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 c = mix(uHorizon, uTop, pow(h, 0.5));
        c += uGlow * pow(1.0 - h, 7.0) * 0.5;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1000; // last of the opaque draws, so depth testing skips covered pixels
  return mesh;
}

export class Snow {
  constructor(count, fog) {
    const pos = new Float32Array(count * 3);
    const rnd = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random() * 5.6 - 2.8;
      pos[i * 3 + 1] = Math.random() * 26;
      pos[i * 3 + 2] = Math.random() * 60;
      for (let k = 0; k < 4; k++) rnd[i * 4 + k] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4));
    this.uniforms = {
      uTime: { value: 0 }, uCamZ: { value: 0 }, uScale: { value: 800 },
      uFogD: { value: fog.density }, uColor: { value: new THREE.Color(0.85, 0.9, 1.05) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, fog: false,
      vertexShader: /* glsl */`
        uniform float uTime, uCamZ, uScale, uFogD;
        attribute vec4 aRand;
        varying float vAlpha;
        varying vec3 vTint;
        void main(){
          vec3 p = position;
          float speed = mix(0.55, 1.3, aRand.x);
          p.y = mod(p.y - uTime * speed, 26.0);
          p.x += sin(uTime * (0.4 + aRand.y) + aRand.z * 6.28) * 0.3 + uTime * 0.15;
          p.x = mod(p.x + 2.8, 5.6) - 2.8;
          p.z += cos(uTime * 0.5 * aRand.w + aRand.x * 6.0) * 0.25;
          float zb = uCamZ - 30.0;
          p.z = zb + mod(p.z - zb, 60.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float d = max(-mv.z, 0.01);
          float size = 0.022 * mix(0.6, 1.5, aRand.w) * uScale / d;
          vAlpha = smoothstep(0.0, 0.6, p.y) * exp(-uFogD * uFogD * d * d * 0.6) * smoothstep(0.15, 0.6, d);
          if (size < 1.5) { vAlpha *= size / 1.5; size = 1.5; }
          gl_PointSize = min(size, 26.0);
          float tz = 0.5 + 0.5 * sin(p.z * 0.33 + p.x * 0.8);
          vTint = mix(vec3(0.75, 0.95, 1.15), vec3(1.15, 0.8, 1.05), tz);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        varying float vAlpha;
        varying vec3 vTint;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.05, d);
          gl_FragColor = vec4(uColor * vTint, a * vAlpha * 0.9);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  update(t, camera, heightPx) {
    this.uniforms.uTime.value = t;
    this.uniforms.uCamZ.value = camera.position.z;
    this.uniforms.uScale.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }
}

export class Steam {
  constructor(vents, perVent, cloudTex, fog) {
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('uv', quad.attributes.uv);
    const n = vents.length * perVent;
    const origin = new Float32Array(n * 3), seed = new Float32Array(n * 4), tint = new Float32Array(n * 3), scale = new Float32Array(n);
    let i = 0;
    for (const v of vents) {
      for (let k = 0; k < perVent; k++, i++) {
        origin[i * 3] = v.pos.x + (Math.random() - 0.5) * 0.6;
        origin[i * 3 + 1] = v.pos.y;
        origin[i * 3 + 2] = v.pos.z + (Math.random() - 0.5) * 0.4;
        seed[i * 4] = k / perVent + Math.random() * 0.02;
        seed[i * 4 + 1] = 0.11 + Math.random() * 0.05;
        seed[i * 4 + 2] = (Math.random() - 0.5) * (v.pos.y > 0.3 ? 0 : 1);
        seed[i * 4 + 3] = Math.random();
        tint[i * 3] = v.tint[0]; tint[i * 3 + 1] = v.tint[1]; tint[i * 3 + 2] = v.tint[2];
        scale[i] = v.scale;
      }
    }
    geo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(origin, 3));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));
    geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scale, 1));
    geo.instanceCount = n;
    this.uniforms = {
      uTime: { value: 0 }, uMap: { value: cloudTex }, uFogD: { value: fog.density },
      uFogColor: { value: fog.color }, uOpacity: { value: 0.38 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, fog: false,
      vertexShader: /* glsl */`
        uniform float uTime, uFogD;
        attribute vec3 aOrigin; attribute vec4 aSeed; attribute vec3 aTint; attribute float aScale;
        varying vec2 vUv; varying float vAlpha; varying vec3 vTint; varying float vFog;
        void main(){
          float life = fract(uTime * aSeed.y + aSeed.x);
          vec3 wp = aOrigin;
          wp.y += 0.35 + life * 3.4 * aScale;
          wp.x += sin(aSeed.w * 30.0 + uTime * 0.7) * 0.3 * life + aSeed.z * life * 0.9;
          wp.z += cos(aSeed.w * 17.0 + uTime * 0.5) * 0.3 * life;
          if (aOrigin.y > 0.3) wp.x += (aOrigin.x < 0.0 ? 1.0 : -1.0) * life * 1.4;
          float size = mix(0.45, 2.7, sqrt(life)) * (0.8 + aSeed.w * 0.4) * aScale;
          vec4 mv = viewMatrix * vec4(wp, 1.0);
          float rot = aSeed.w * 6.28 + uTime * 0.25 * (aSeed.z + 0.2);
          vec2 c = position.xy;
          c = vec2(c.x * cos(rot) - c.y * sin(rot), c.x * sin(rot) + c.y * cos(rot));
          mv.xy += c * size;
          gl_Position = projectionMatrix * mv;
          vUv = uv; vTint = aTint;
          vAlpha = smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.4, 1.0, life));
          float d = -mv.z;
          vAlpha *= smoothstep(0.4, 1.8, d);
          vFog = exp(-uFogD * uFogD * d * d);
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uMap; uniform vec3 uFogColor; uniform float uOpacity;
        varying vec2 vUv; varying float vAlpha; varying vec3 vTint; varying float vFog;
        void main(){
          vec4 t = texture2D(uMap, vUv);
          float a = t.a * vAlpha * uOpacity;
          vec3 col = vTint * (0.55 + 0.6 * t.r);
          col = mix(uFogColor, col, vFog);
          gl_FragColor = vec4(col, a);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
  }

  update(t) { this.uniforms.uTime.value = t; }
}
