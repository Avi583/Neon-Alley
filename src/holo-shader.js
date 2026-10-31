// The holographic billboard: rings, scan lines and chromatic text.

export const holoVert = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export const holoFrag = /* glsl */`
uniform float uTime; uniform sampler2D uText; uniform vec3 uC1; uniform vec3 uC2; uniform float uI;
varying vec2 vUv;
float h11(float x){ return fract(sin(x * 91.345) * 47453.5453); }
void main(){
  vec2 uv = vUv;
  float gl = step(0.93, h11(floor(uTime * 9.0)));
  uv.x += gl * (h11(floor(uv.y * 40.0) + floor(uTime * 30.0)) - 0.5) * 0.08;
  vec2 p = uv * 2.0 - 1.0; p.y *= 1.27;
  vec2 q = p - vec2(0.0, 0.32);
  float r = length(q), a = atan(q.y, q.x);
  float rings = 0.0;
  rings += smoothstep(0.025, 0.0, abs(r - 0.62)) * (0.55 + 0.45 * sin(a * 3.0 + uTime * 1.3));
  rings += smoothstep(0.02, 0.0, abs(r - 0.48)) * (0.5 + 0.5 * sin(a * 7.0 - uTime * 2.1));
  rings += smoothstep(0.015, 0.0, abs(r - 0.36)) * step(0.0, sin(a * 12.0 + uTime * 3.0));
  float petals = smoothstep(0.03, 0.0, abs(r - 0.2 - 0.06 * sin(a * 6.0 + uTime * 2.0)));
  float core = smoothstep(0.16, 0.0, r);
  float wave = smoothstep(0.012, 0.0, abs(p.y + 0.35 + 0.05 * sin(p.x * 9.0 + uTime * 3.0))) * 0.6;
  vec3 grad = mix(uC1, uC2, clamp(uv.y + 0.25 * sin(uTime * 0.7 + uv.x * 3.0), 0.0, 1.0));
  vec3 col = grad * (rings + petals * 1.2 + core * 1.5 + wave);
  float tr = texture2D(uText, uv + vec2(0.004, 0.0)).r;
  float tg = texture2D(uText, uv).r;
  float tb = texture2D(uText, uv - vec2(0.004, 0.0)).r;
  col += vec3(tr * uC2.r + tb * 0.2, tg * 0.9, tb * uC1.b + tr * 0.2) * 1.4;
  col *= 0.72 + 0.28 * sin(uv.y * 520.0);
  col *= 0.85 + 0.15 * step(0.85, fract(uv.y * 2.0 - uTime * 0.5));
  float edge = smoothstep(0.02, 0.0, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
  col += uC1 * edge * 1.5;
  col += grad * 0.06;
  gl_FragColor = vec4(col * uI, 1.0);
}`;
