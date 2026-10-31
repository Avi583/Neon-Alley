// Neon signs: drawn on canvases (tube glow, lightboxes, bordered panels),
// mounted on brackets, and animated with per-sign flicker. Each sign also
// registers a coloured light so it actually lights the alley around it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash2, noise1 } from './noise.js';
import { makeCanvas, canvasTexture, FONT_JP, FONT_LAT, FONT_NEON } from './textures.js';

import { WALL } from './config.js';

const MAX_SIGN_PX = 2048; // longest canvas side; the 7 m banner would otherwise hit 2800 px on Ultra

// side: -1 = left wall, +1 = right wall (looking down the alley from the start).
export const SIGN_SPECS = [
  { text: 'バー', sub: 'BAR', style: 'border', color: '#c070ff', color2: '#ff4fd8', side: 1, z: -3.4, y: 2.95, w: 1.0, h: 1.1, flicker: 'steady', light: 9 },
  { text: '24H', font: 'lat', style: 'border', color: '#ff4fd8', color2: '#4fe3ff', side: 1, z: -9.5, y: 4.9, w: 1.7, h: 0.8, flicker: 'flicker', light: 10 },
  { text: '居酒屋', style: 'box', color: '#ff2d55', side: -1, z: -6.8, y: 4.6, w: 2.0, h: 0.75, light: 9 },
  { text: 'ラーメン', vertical: true, style: 'tube', color: '#ff3fb4', side: -1, z: -12.5, y: 9.0, w: 0.8, h: 3.0, light: 12 },
  { columns: ['TECH', 'SOLUTIONS'], font: 'lat', vertical: true, style: 'tube', color: '#38e8ff', side: -1, z: -16.5, y: 6.4, w: 0.8, h: 3.6, flicker: 'broken', light: 8 },
  { kind: 'holo', side: -1, z: -21, y: 9.6, w: 3.0, h: 3.8, color: '#5ef2ff', color2: '#ff4fd8', light: 14 },
  { style: 'circle', color: '#39f0ff', side: 1, z: -15.5, y: 10.5, w: 1.1, h: 1.1, flicker: 'pulse', light: 0 },
  { text: 'CYBERNETICS', font: 'lat', vertical: true, style: 'tube', color: '#b66bff', side: 1, z: -23.5, y: 8.4, w: 0.62, h: 4.4, light: 9 },
  { text: 'OPEN', font: 'neon', style: 'tube', color: '#ff3355', side: 1, z: -12.2, y: 2.35, w: 0.9, h: 0.42, mount: 'flat', flicker: 'flicker', light: 0 },
  { text: 'ラーメン', sub: 'RAMEN', style: 'box', color: '#ff7a2f', side: -1, z: -28, y: 4.8, w: 1.6, h: 0.7, light: 7 },
  { text: 'カラオケ', style: 'border', color: '#38e8ff', color2: '#ff3fa4', side: -1, z: -34, y: 5.2, w: 2.0, h: 0.7, light: 8 },
  { text: 'ホテル', vertical: true, style: 'tube', color: '#ff4fd8', side: 1, z: -36, y: 9, w: 0.8, h: 2.6, flicker: 'pulse', light: 9 },
  { text: '薬局', style: 'box', color: '#2bff88', textColor: '#ffffff', side: 1, z: -42, y: 4.4, w: 1.3, h: 0.7, light: 7 },
  { text: '電脳', vertical: true, style: 'tube', color: '#a970ff', side: -1, z: -46, y: 10, w: 0.9, h: 2.2, flicker: 'flicker', light: 8 },
  { text: '質屋', vertical: true, style: 'box', color: '#ffb340', side: -1, z: -50, y: 5.5, w: 0.8, h: 1.8, light: 7 },
  { text: 'NOODLES', font: 'neon', style: 'tube', color: '#38e8ff', side: 1, z: -55, y: 4.6, w: 2.2, h: 0.6, light: 8 },
  { text: '喫茶', sub: 'CAFE', style: 'box', color: '#fff0d0', textColor: '#3a1a10', side: -1, z: -60, y: 4.2, w: 1.2, h: 0.9, light: 6 },
  { text: 'マッサージ', vertical: true, style: 'tube', color: '#ff3fa4', side: 1, z: -64, y: 8, w: 0.7, h: 3.4, flicker: 'broken', light: 8 },
  { text: 'ゲーム', sub: 'GAME CENTER', style: 'border', color: '#5dffb4', color2: '#b66bff', side: -1, z: -70, y: 5.5, w: 1.9, h: 0.9, light: 8 },
  { text: '酒', style: 'box', color: '#ff2d55', side: 1, z: -74, y: 4.5, w: 0.8, h: 0.8, light: 6 },
  { text: 'BAR', font: 'neon', style: 'tube', color: '#ffd166', side: -1, z: -80, y: 3.7, w: 1.3, h: 0.6, flicker: 'flicker', light: 7 },
  { text: '24/7', font: 'lat', style: 'border', color: '#38e8ff', color2: '#ff3fa4', side: 1, z: -83, y: 5.0, w: 1.4, h: 0.7, light: 8 },
  { text: '夜市', sub: 'NIGHT MARKET', style: 'border', color: '#ff4fd8', color2: '#ffd166', mount: 'facing', x: 0, z: -105.7, y: 8.5, w: 7, h: 3.2, light: 0 },
  { text: '路地', sub: 'ALLEY 07', style: 'border', color: '#38e8ff', color2: '#ff3fa4', mount: 'facingBack', x: 0, z: 15.9, y: 6.2, w: 3.2, h: 1.6, light: 10 },
];

export const SIGN_TEXT = SIGN_SPECS.map((s) => (s.text || '') + (s.columns || []).join('') + (s.sub || '')).join('') +
  'らーめんつめた〜い夢を見る機械未来はここに眠らない街宇宙ラーメン';

const lighten = (hex, t) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), t).getHexString();
const famOf = (spec) => (spec.font === 'lat' ? FONT_LAT : spec.font === 'neon' ? FONT_NEON : FONT_JP);

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Neon-tube text: wide glow, the coloured tube, then a white-hot core.
function glowText(ctx, text, x, y, color, size, mode) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  const core = lighten(color, 0.72);
  if (mode === 'stroke') {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.6; ctx.lineWidth = size * 0.11; ctx.shadowBlur = size * 0.5; ctx.strokeText(text, x, y);
    ctx.globalAlpha = 1; ctx.lineWidth = size * 0.07; ctx.shadowBlur = size * 0.18; ctx.strokeText(text, x, y);
    ctx.shadowBlur = 0; ctx.strokeStyle = core; ctx.lineWidth = size * 0.03; ctx.strokeText(text, x, y);
  } else {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7; ctx.shadowBlur = size * 0.45; ctx.fillText(text, x, y);
    ctx.globalAlpha = 1; ctx.shadowBlur = size * 0.15; ctx.fillText(text, x, y);
    ctx.shadowBlur = 0; ctx.fillStyle = core; ctx.fillText(text, x, y);
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, size * 0.035); ctx.strokeText(text, x, y);
  }
  ctx.restore();
}

function tubeRect(ctx, x, y, w, h, r, color, lw) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.globalAlpha = 0.6; ctx.lineWidth = lw * 1.8; ctx.shadowBlur = lw * 6; ctx.stroke();
  ctx.globalAlpha = 1; ctx.lineWidth = lw; ctx.shadowBlur = lw * 2; ctx.stroke();
  ctx.shadowBlur = 0; ctx.strokeStyle = lighten(color, 0.72); ctx.lineWidth = lw * 0.4; ctx.stroke();
  ctx.restore();
}

function fitFont(ctx, text, fam, weight, maxW, maxH) {
  let size = maxH;
  ctx.font = `${weight} ${size}px ${fam}`;
  const w = ctx.measureText(text).width;
  if (w > maxW) size *= maxW / w;
  return Math.floor(size);
}

function drawSign(spec, ppm) {
  ppm = Math.min(ppm, MAX_SIGN_PX / Math.max(spec.w, spec.h));
  const W = Math.max(64, Math.round(spec.w * ppm)), H = Math.max(64, Math.round(spec.h * ppm));
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const color = spec.color, color2 = spec.color2 || spec.color;
  const m = Math.min(W, H);
  const pad = m * 0.12;
  const fam = famOf(spec);
  const isBox = spec.style === 'box';

  if (isBox) {
    ctx.fillStyle = '#05050a'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = color;
    roundRectPath(ctx, m * 0.03, m * 0.03, W - m * 0.06, H - m * 0.06, m * 0.06); ctx.fill();
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6);
    g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = m * 0.02;
    roundRectPath(ctx, m * 0.08, m * 0.08, W - m * 0.16, H - m * 0.16, m * 0.04); ctx.stroke();
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0a12'); g.addColorStop(1, '#050409');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  if (spec.style === 'border') tubeRect(ctx, pad * 0.45, pad * 0.45, W - pad * 0.9, H - pad * 0.9, m * 0.08, color2, m * 0.035);

  if (spec.style === 'circle') {
    const cx = W / 2, cy = H / 2, r = m * 0.4;
    ctx.save();
    ctx.shadowColor = color; ctx.strokeStyle = color; ctx.lineCap = 'round';
    for (const [lw, blur, a] of [[m * 0.06, m * 0.15, 0.6], [m * 0.035, m * 0.05, 1]]) {
      ctx.lineWidth = lw; ctx.shadowBlur = blur; ctx.globalAlpha = a;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(cx, cy, r * (0.25 + k * 0.17), k * 2.1, k * 2.1 + Math.PI * 1.25);
        ctx.stroke();
      }
    }
    ctx.restore();
    return c;
  }

  const mode = isBox ? 'plain' : (spec.font === 'lat' ? 'stroke' : 'fill');
  const drawGlyph = (t, x, y, size, f = fam) => {
    ctx.font = `900 ${size}px ${f}`;
    if (mode === 'plain') {
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = spec.textColor || '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = size * 0.08;
      ctx.fillText(t, x, y);
      ctx.restore();
    } else {
      glowText(ctx, t, x, y, color, size, mode);
    }
  };

  if (spec.vertical) {
    const cols = spec.columns || [spec.text];
    const colW = (W - pad * 2) / cols.length;
    const maxLen = Math.max(...cols.map((s) => [...s].length));
    const cellH = (H - pad * 2) / maxLen;
    const size = Math.floor(Math.min(cellH * 0.9, colW * 0.86));
    cols.forEach((col, ci) => {
      const chars = [...col];
      const x = pad + colW * (ci + 0.5);
      const y0 = pad + (H - pad * 2 - chars.length * cellH) / 2 + cellH / 2;
      chars.forEach((ch, j) => drawGlyph(ch === 'ー' ? '｜' : ch, x, y0 + j * cellH, size));
    });
  } else {
    const innerW = W - pad * 2, innerH = H - pad * 2;
    const mainH = spec.sub ? innerH * 0.66 : innerH;
    const size = fitFont(ctx, spec.text, fam, 900, innerW, mainH * 0.95);
    const yMain = pad + mainH / 2;
    drawGlyph(spec.text, W / 2, yMain, size);
    if (spec.sub) {
      const subSize = fitFont(ctx, spec.sub, FONT_LAT, 700, innerW * 0.9, (innerH - mainH) * 0.8);
      ctx.save();
      ctx.font = `700 ${subSize}px ${FONT_LAT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (isBox) { ctx.fillStyle = spec.textColor || '#ffffff'; ctx.fillText(spec.sub, W / 2, pad + mainH + (innerH - mainH) / 2); }
      else glowText(ctx, spec.sub, W / 2, pad + mainH + (innerH - mainH) / 2, color2, subSize, 'fill');
      ctx.restore();
    }
  }
  return c;
}

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

const holoVert = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const holoFrag = /* glsl */`
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

export function buildSigns(kit, mats, holoText, ppm, scene) {
  const { box, snow, icicles, R } = kit;
  const items = [];
  const lights = [];
  const unitPlane = new THREE.PlaneGeometry(1, 1);
  let holo = null;

  SIGN_SPECS.forEach((spec, idx) => {
    spec.seed = idx * 7 + 3;
    spec.factor = 1;
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
      holo = { mesh, mat, spec };
      lights.push({ pos: new THREE.Vector3(cx + side * -0.6, y - 0.5, z + 0.8), color: new THREE.Color('#9a7bff'), intensity: spec.light, range: 16, spec });
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
    items.push({ spec, mat, base });
    if (spec.light > 0) lights.push({ pos: lightPos, color: new THREE.Color(spec.color), intensity: spec.light, range: 13, spec });
  });

  return {
    lights,
    update(t) {
      for (const it of items) {
        it.spec.factor = flicker(it.spec.flicker, t, it.spec.seed);
        it.mat.color.setScalar(it.base * it.spec.factor);
      }
      if (holo) {
        holo.mat.uniforms.uTime.value = t;
        holo.spec.factor = 0.9 + 0.1 * Math.sin(t * 3);
      }
    },
  };
}
