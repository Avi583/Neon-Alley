// Procedural PBR textures. Everything is generated on a canvas at load time,
// so the site ships with zero image downloads and has no licensing questions.
import * as THREE from 'three';
import { fbm, hash2, mulberry32 } from './noise.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const frac = (x) => x - Math.floor(x);

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export const FONT_JP = '"Noto Sans JP","Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Meiryo","Noto Sans CJK JP",sans-serif';
export const FONT_LAT = '"Orbitron","Noto Sans JP",sans-serif';
export const FONT_NEON = '"Monoton","Orbitron",sans-serif';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function arrToCanvas(data, w, h) {
  const c = makeCanvas(w, h);
  c.getContext('2d').putImageData(new ImageData(data, w, h), 0, 0);
  return c;
}

export function canvasTexture(c, { srgb = true, repeat = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

class Maps {
  constructor(w, h, emissive = false) {
    this.w = w; this.h = h;
    this.col = new Uint8ClampedArray(w * h * 4);
    this.rgh = new Uint8ClampedArray(w * h * 4);
    this.hgt = new Float32Array(w * h);
    this.emi = null;
    if (emissive) {
      this.emi = new Uint8ClampedArray(w * h * 4);
      for (let i = 3; i < this.emi.length; i += 4) this.emi[i] = 255;
    }
  }
  put(i, r, g, b, rough, height) {
    const k = i * 4;
    this.col[k] = r * 255; this.col[k + 1] = g * 255; this.col[k + 2] = b * 255; this.col[k + 3] = 255;
    const q = rough * 255;
    this.rgh[k] = q; this.rgh[k + 1] = q; this.rgh[k + 2] = q; this.rgh[k + 3] = 255;
    this.hgt[i] = height;
  }
  emit(i, r, g, b) {
    const k = i * 4;
    this.emi[k] = r * 255; this.emi[k + 1] = g * 255; this.emi[k + 2] = b * 255;
  }
}

function normalFromHeight(hgt, w, h, strength) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const yu = (y - 1 + h) % h, yd = (y + 1) % h;
    for (let x = 0; x < w; x++) {
      const xl = (x - 1 + w) % w, xr = (x + 1) % w;
      const dx = (hgt[y * w + xr] - hgt[y * w + xl]) * strength;
      const dy = (hgt[yd * w + x] - hgt[yu * w + x]) * strength;
      const nx = -dx, ny = dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const k = (y * w + x) * 4;
      out[k] = (nx / l * 0.5 + 0.5) * 255;
      out[k + 1] = (ny / l * 0.5 + 0.5) * 255;
      out[k + 2] = (nz / l * 0.5 + 0.5) * 255;
      out[k + 3] = 255;
    }
  }
  return out;
}

function finalize(m, normalStrength, aniso, extraDraw) {
  const colCanvas = arrToCanvas(m.col, m.w, m.h);
  if (extraDraw) extraDraw(colCanvas.getContext('2d'), m.w, m.h);
  const res = {
    map: canvasTexture(colCanvas, { aniso }),
    roughnessMap: canvasTexture(arrToCanvas(m.rgh, m.w, m.h), { srgb: false, aniso }),
    normalMap: canvasTexture(arrToCanvas(normalFromHeight(m.hgt, m.w, m.h, normalStrength * m.w / 512), m.w, m.h), { srgb: false, aniso }),
  };
  if (m.emi) res.emissiveMap = canvasTexture(arrToCanvas(m.emi, m.w, m.h), { aniso });
  return res;
}

// ---------------------------------------------------------------- concrete
export function genConcrete(S, aniso, seed = 3) {
  const m = new Maps(S, S);
  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      const u = x / S, i = y * S + x;
      const base = fbm(u, v, 4, 4, seed, 5);
      const fine = fbm(u, v, 48, 48, seed + 40, 2);
      const streak = fbm(u, v, 24, 2, seed + 80, 4);
      const blot = fbm(u, v, 3, 3, seed + 120, 3);
      const grime = Math.min(1, sstep(0.52, 0.75, streak) * 0.8 + sstep(0.55, 0.8, blot) * 0.5);
      const pu = frac(u * 2), pv = frac(v * 2);
      const seam = Math.min(pu, 1 - pu, pv, 1 - pv) < 0.0035 ? 1 : 0;
      const hu = (frac(u * 6) - 0.5) / 6, hv = (frac(v * 4) - 0.5) / 4;
      const hole = hu * hu + hv * hv < 0.00004 ? 1 : 0;
      let c = 0.36 + 0.18 * (base - 0.5) + 0.1 * (fine - 0.5);
      c *= 1 - 0.55 * grime;
      c *= 1 - 0.5 * seam - 0.55 * hole;
      m.put(i, c * 0.93, c * 0.96, c * 1.04, clamp01(0.86 - 0.42 * grime - 0.1 * fine),
        base * 0.6 + fine * 0.3 - seam * 0.8 - hole * 0.6);
    }
  }
  return finalize(m, 3, aniso);
}

// ------------------------------------------------------------------- brick
export function genBrick(S, aniso, seed = 7) {
  const m = new Maps(S, S);
  const cols = 8, rows = 28;
  for (let y = 0; y < S; y++) {
    const v = y / S;
    const rowF = v * rows, ri = Math.floor(rowF), fy = rowF - ri;
    const off = (ri % 2) * 0.5;
    for (let x = 0; x < S; x++) {
      const u = x / S, i = y * S + x;
      const colF = u * cols + off, ci = Math.floor(colF), fx = colF - ci;
      const ciw = ((ci % cols) + cols) % cols;
      const mx = Math.min(fx, 1 - fx) / cols, my = Math.min(fy, 1 - fy) / rows;
      const mortar = 1 - sstep(0.0016, 0.0032, Math.min(mx, my));
      const hb = hash2(ciw, ri, seed);
      let tone = 0.72 + 0.5 * hb;
      if (hb > 0.9) tone *= 0.55;
      const n = fbm(u, v, 32, 32, seed + 3, 3);
      const grime = sstep(0.5, 0.76, fbm(u, v, 24, 2, seed + 7, 4));
      let r = 0.36 * tone, g = 0.15 * tone, b = 0.12 * tone;
      r = r * (1 - mortar) + 0.27 * mortar; g = g * (1 - mortar) + 0.26 * mortar; b = b * (1 - mortar) + 0.27 * mortar;
      const k = (0.85 + 0.3 * (n - 0.5)) * (1 - 0.5 * grime);
      m.put(i, r * k, g * k, b * k, clamp01((0.78 + 0.14 * mortar) - grime * 0.35),
        (1 - mortar) * (0.8 + 0.2 * n));
    }
  }
  return finalize(m, 4, aniso);
}

// ---------------------------------------------------- roll-up shop shutter
function drawGraffiti(ctx, W, H, seed) {
  const rng = mulberry32(seed);
  const colors = ['#ff3fa4', '#33e1ff', '#f9f871', '#a45cff', '#5dffb4'];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let t = 0; t < 3; t++) {
    const cx = rng() * W, cy = H * (0.45 + rng() * 0.4);
    const col = colors[Math.floor(rng() * colors.length)];
    const pts = [];
    let x = cx, y = cy;
    for (let k = 0; k < 7; k++) {
      pts.push([x, y]);
      x += (rng() * 0.09 + 0.02) * W;
      y += (rng() - 0.5) * 0.12 * H;
    }
    for (const pass of [[W * 0.03, 'rgba(10,10,14,0.85)'], [W * 0.018, col]]) {
      ctx.lineWidth = pass[0];
      ctx.strokeStyle = pass[1];
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length - 1; k++) {
        const mx = (pts[k][0] + pts[k + 1][0]) / 2, my = (pts[k][1] + pts[k + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[k][0], pts[k][1] - H * 0.06, mx, my);
      }
      ctx.stroke();
    }
    // drips
    ctx.strokeStyle = col;
    ctx.lineWidth = W * 0.004;
    for (let d = 0; d < 6; d++) {
      const p = pts[Math.floor(rng() * pts.length)];
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(p[0], p[1] + rng() * H * 0.08);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function genShutter(S, aniso, seed = 11) {
  const m = new Maps(S, S);
  for (let y = 0; y < S; y++) {
    const v = y / S;
    const s = frac(v * 20);
    const prof = Math.pow(Math.sin(s * Math.PI), 0.6);
    const groove = s < 0.06 || s > 0.94 ? 1 : 0;
    for (let x = 0; x < S; x++) {
      const u = x / S, i = y * S + x;
      const n = fbm(u, v, 8, 8, seed, 4);
      const rust = sstep(0.6, 0.76, fbm(u, v, 6, 6, seed + 3, 5));
      const grime = sstep(0.5, 0.78, fbm(u, v, 24, 2, seed + 9, 4));
      let c = (0.40 + 0.1 * (n - 0.5)) * (0.75 + 0.25 * prof);
      if (groove) c *= 0.45;
      c *= 1 - 0.45 * grime;
      const r = c * (1 - rust) + 0.30 * rust, g = c * (1 - rust) + 0.14 * rust, b = c * 1.04 * (1 - rust) + 0.07 * rust;
      m.put(i, r, g, b, clamp01(0.4 + 0.45 * rust + 0.1 * n + 0.15 * grime), prof * 0.8 - groove * 0.4);
    }
  }
  return finalize(m, 3, aniso, (ctx, W, H) => drawGraffiti(ctx, W, H, seed));
}

// ----------------------------------------------------------------- asphalt
export function genAsphalt(S, aniso, seed = 21) {
  const m = new Maps(S, S);
  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      const u = x / S, i = y * S + x;
      const grain = fbm(u, v, 96, 96, seed, 2);
      const agg = hash2(x, y, seed) > 0.982 ? 1 : 0;
      const large = fbm(u, v, 3, 3, seed + 5, 4);
      const cn = fbm(u, v, 5, 5, seed + 9, 5);
      const crack = 1 - sstep(0.0, 0.012, Math.abs(cn - 0.5));
      let c = 0.16 + 0.06 * (large - 0.5) + 0.07 * (grain - 0.5) + 0.07 * agg;
      c *= 1 - 0.6 * crack;
      m.put(i, c, c * 1.0, c * 1.06, clamp01(0.58 + 0.28 * (grain - 0.5) - 0.18 * (1 - large)),
        grain * 0.6 + agg * 0.35 - crack * 0.9);
    }
  }
  return finalize(m, 2.2, aniso);
}

// ------------------------------------------------------------ brushed metal
export function genMetal(S, aniso, seed = 31) {
  const m = new Maps(S, S);
  for (let y = 0; y < S; y++) {
    const v = y / S;
    const scratch = hash2(Math.floor(v * S * 0.5), 0, seed) > 0.97 ? 0.08 : 0;
    for (let x = 0; x < S; x++) {
      const u = x / S, i = y * S + x;
      const n = fbm(u, v, 2, 64, seed, 4);
      const spots = sstep(0.6, 0.8, fbm(u, v, 5, 5, seed + 3, 4));
      let c = 0.5 + 0.15 * (n - 0.5) + scratch;
      c *= 1 - 0.45 * spots;
      m.put(i, c, c, c * 1.03, clamp01(0.3 + 0.25 * n + 0.35 * spots), n * 0.3);
    }
  }
  return finalize(m, 1, aniso);
}

// ------------------------------------------- upper floors: windows facade
export function genFacade(S, aniso, seed = 41) {
  const m = new Maps(S, S, true);
  const cols = 4, rows = 4;
  const wx0 = 0.18, wx1 = 0.82, wy0 = 0.2, wy1 = 0.8, fr = 0.025;
  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      const u = x / S, i = y * S + x;
      const cu = u * cols, cv = v * rows;
      const ci = Math.floor(cu), ri = Math.floor(cv);
      const lu = cu - ci, lv = cv - ri;
      const n = fbm(u, v, 8, 8, seed, 4);
      const fine = fbm(u, v, 64, 64, seed + 9, 2);
      const streak = sstep(0.55, 0.8, fbm(u, v, 32, 4, seed + 21, 3));
      let w = (0.21 + 0.1 * (n - 0.5) + 0.05 * (fine - 0.5)) * (1 - 0.4 * streak);
      let r = w * 0.92, g = w * 0.95, b = w * 1.06, rough = 0.85 - 0.3 * streak, h = 0.5 + 0.2 * n;
      if (lv > 0.9) { r *= 1.25; g *= 1.25; b *= 1.25; h = 0.75; }
      if (lv > 0.885 && lv <= 0.9) { r *= 0.4; g *= 0.4; b *= 0.4; h = 0.2; }
      const inWin = lu > wx0 && lu < wx1 && lv > wy0 && lv < wy1;
      const inFrame = lu > wx0 - fr && lu < wx1 + fr && lv > wy0 - fr && lv < wy1 + fr * 1.6;
      if (inFrame && !inWin) { r = g = b = lv > wy1 ? 0.5 : 0.4; rough = 0.4; h = 0.95; }
      if (inWin) {
        const st = hash2(ci, ri, seed * 13 + 777);
        const wu = (lu - wx0) / (wx1 - wx0), wv = (lv - wy0) / (wy1 - wy0);
        if (Math.abs(wu - 0.5) < 0.012) { r = g = b = 0.35; rough = 0.4; h = 0.8; }
        else if (st < 0.3) {
          const t = hash2(ci, ri, seed + 5);
          let cr, cg, cb;
          if (t < 0.55) { cr = 1.0; cg = 0.72; cb = 0.42; }
          else if (t < 0.8) { cr = 0.55; cg = 0.8; cb = 1.0; }
          else if (t < 0.92) { cr = 0.95; cg = 0.4; cb = 0.9; }
          else { cr = 0.6; cg = 1.0; cb = 0.8; }
          let k = 0.55 + 0.45 * (1 - wv);
          if (hash2(ci, ri, seed + 6) > 0.5) k *= frac(wv * 16) > 0.35 ? 1 : 0.25;
          const cur = hash2(ci, ri, seed + 8) * 0.4;
          if (wu < cur || wu > 1 - cur * 0.6) k *= 0.22;
          if (wv > 0.75 && hash2(ci, ri, seed + 11) > 0.5 && Math.abs(wu - 0.3) < 0.14) k *= 0.15;
          m.emit(i, cr * k, cg * k, cb * k);
          r = cr * k * 0.4; g = cg * k * 0.4; b = cb * k * 0.4; rough = 0.15; h = 0;
        } else {
          const refl = 0.03 + 0.05 * (1 - wv) * (0.5 + n);
          r = refl * 0.8; g = refl * 0.9; b = refl * 1.25; rough = 0.06; h = 0;
        }
      }
      m.put(i, r, g, b, rough, h);
    }
  }
  return finalize(m, 2.5, aniso);
}

// ------------------------------------------------------------ steam grate
export function genGrate(S, aniso) {
  const m = new Maps(S, S);
  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      const u = x / S, i = y * S + x;
      const border = u < 0.06 || u > 0.94 || v < 0.08 || v > 0.92;
      const slot = !border && frac(u * 12) < 0.55;
      const n = fbm(u, v, 8, 8, 5, 3);
      const c = slot ? 0.012 : 0.2 + 0.08 * (n - 0.5);
      m.put(i, c, c, c * 1.05, slot ? 0.9 : 0.4 + 0.2 * n, slot ? 0 : 1);
    }
  }
  return finalize(m, 6, aniso);
}

// --------------------------------------------------- outdoor AC unit front
export function genACFront(S) {
  const W = S, H = Math.round(S * 0.72);
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#c3c7cf'); g.addColorStop(1, '#8e939b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const cx = W * 0.36, cy = H * 0.5, r = H * 0.42;
  ctx.fillStyle = '#121418';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3d4249';
  for (let k = 0; k < 3; k++) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(k * Math.PI * 2 / 3 + 0.4);
    ctx.beginPath(); ctx.ellipse(r * 0.45, 0, r * 0.45, r * 0.18, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = '#a3a8b0'; ctx.lineWidth = Math.max(1, W / 160);
  for (let rr = r * 0.12; rr < r; rr += r / 7) { ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke(); }
  for (let a = 0; a < 8; a++) {
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a * Math.PI / 4) * r, cy + Math.sin(a * Math.PI / 4) * r); ctx.stroke();
  }
  ctx.strokeStyle = '#6f747c'; ctx.lineWidth = Math.max(1, W / 128);
  for (let y = H * 0.12; y < H * 0.88; y += H / 18) {
    ctx.beginPath(); ctx.moveTo(W * 0.8, y); ctx.lineTo(W * 0.95, y); ctx.stroke();
  }
  const dirt = ctx.createLinearGradient(0, H * 0.6, 0, H);
  dirt.addColorStop(0, 'rgba(40,30,20,0)'); dirt.addColorStop(1, 'rgba(40,30,20,0.45)');
  ctx.fillStyle = dirt; ctx.fillRect(0, 0, W, H);
  return canvasTexture(c, { repeat: false });
}

// ------------------------------------------------------- soft steam puff
export function genCloud(S = 128) {
  const data = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      const dx = u - 0.5, dy = v - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const n = fbm(u, v, 4, 4, 99, 5);
      const a = clamp01((1 - r) * (1 - r) * (0.35 + 0.9 * n));
      const k = (y * S + x) * 4;
      const lum = 200 + 55 * n;
      data[k] = lum; data[k + 1] = lum; data[k + 2] = lum; data[k + 3] = a * 255;
    }
  }
  const t = canvasTexture(arrToCanvas(data, S, S), { repeat: false });
  return t;
}

// ----------------------------------------------------- emissive canvases
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function genVending() {
  const W = 256, H = 512;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#e9f3ff'; ctx.fillRect(0, 0, W, H);
  const top = ctx.createLinearGradient(0, 0, W, 0);
  top.addColorStop(0, '#ff3d7f'); top.addColorStop(1, '#ff8a3d');
  ctx.fillStyle = top; ctx.fillRect(0, 0, W, 70);
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 30px ${FONT_JP}`; ctx.fillText('つめた〜い', W / 2, 26);
  ctx.font = `700 16px ${FONT_LAT}`; ctx.fillText('ICE COLD DRINKS', W / 2, 54);
  const cans = ['#ff3355', '#2d7dff', '#ffd23f', '#2bd47d', '#b25cff', '#ff8a2b', '#1ad4ff', '#ffffff'];
  const rng = mulberry32(5);
  for (let row = 0; row < 4; row++) {
    const y0 = 90 + row * 70;
    ctx.fillStyle = '#cfe6ff'; ctx.fillRect(10, y0 - 4, W - 20, 62);
    for (let k = 0; k < 6; k++) {
      const x0 = 18 + k * 38;
      ctx.fillStyle = cans[Math.floor(rng() * cans.length)];
      roundRect(ctx, x0, y0 + 2, 28, 44, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x0 + 5, y0 + 6, 5, 36);
      ctx.fillStyle = '#ff2a4a'; ctx.fillRect(x0 + 6, y0 + 50, 16, 6);
    }
  }
  ctx.fillStyle = '#20232b'; ctx.fillRect(0, 380, W, 132);
  ctx.fillStyle = '#0a0b0f'; roundRect(ctx, 30, 430, 196, 56, 6); ctx.fill();
  ctx.fillStyle = '#3dff9a'; ctx.fillRect(196, 392, 40, 20);
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(150, 392, 30, 20);
  return canvasTexture(c, { repeat: false });
}

export function genShopInterior(kind) {
  const W = 512, H = 320;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const rng = mulberry32(kind.length * 31);
  if (kind === 'ramen') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#ffcf8a'); g.addColorStop(1, '#b8501f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 9; k++) {
      ctx.fillStyle = '#fff6e0'; ctx.fillRect(40 + k * 50, 120, 34, 70);
      ctx.fillStyle = '#7a2a12';
      for (let l = 0; l < 4; l++) ctx.fillRect(46 + k * 50 + l * 7, 128, 3, 54);
    }
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(70 + k * 125, 112, 16, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#2a120a'; ctx.fillRect(0, 240, W, 80);
    for (let k = 0; k < 6; k++) { ctx.fillStyle = '#140805'; ctx.fillRect(30 + k * 82, 262, 40, 58); }
    ctx.fillStyle = '#1b2a6b'; ctx.fillRect(0, 0, W, 104);
    ctx.fillStyle = '#0d1640';
    for (let k = 1; k < 4; k++) ctx.fillRect(k * W / 4 - 3, 20, 6, 84);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 64px ${FONT_JP}`;
    ['ら', 'ー', 'め', 'ん'].forEach((ch, k) => ctx.fillText(ch, W / 8 + k * W / 4, 58));
  } else if (kind === 'bar') {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#5a0f4a'); g.addColorStop(1, '#170828');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let s = 0; s < 3; s++) {
      ctx.fillStyle = '#ff9be8'; ctx.fillRect(20, 60 + s * 60, W - 40, 4);
      for (let k = 0; k < 16; k++) {
        const bx = 30 + k * 29 + rng() * 6, bh = 26 + rng() * 22;
        ctx.fillStyle = ['#ffcc66', '#66ffd9', '#ff6699', '#99aaff', '#ffffff'][Math.floor(rng() * 5)];
        ctx.globalAlpha = 0.85;
        ctx.fillRect(bx, 60 + s * 60 - bh, 12, bh);
        ctx.fillRect(bx + 4, 60 + s * 60 - bh - 10, 4, 10);
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = '#0c0410'; ctx.fillRect(0, 250, W, 70);
    ctx.shadowColor = '#ff3fa4'; ctx.shadowBlur = 20;
    ctx.fillStyle = '#ffb3e0'; ctx.font = `700 40px ${FONT_NEON}`;
    ctx.textAlign = 'center'; ctx.fillText('OPEN', W * 0.75, 228);
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = '#eaf7ff'; ctx.fillRect(0, 0, W, H);
    for (let s = 0; s < 4; s++) {
      const y = 40 + s * 62;
      ctx.fillStyle = '#b9d4e6'; ctx.fillRect(10, y + 44, W - 20, 6);
      for (let k = 0; k < 26; k++) {
        ctx.fillStyle = `hsl(${Math.floor(rng() * 360)},80%,${45 + rng() * 25}%)`;
        ctx.fillRect(14 + k * 19, y + 44 - (18 + rng() * 22), 15, 40);
      }
    }
    ctx.fillStyle = '#2bd47d'; ctx.fillRect(0, 0, W, 26);
    ctx.fillStyle = '#ff3355'; ctx.fillRect(0, 26, W, 8);
    ctx.fillStyle = '#ffffff'; ctx.font = `900 20px ${FONT_LAT}`; ctx.textAlign = 'center';
    ctx.textBaseline = 'middle'; ctx.fillText('24 MART', W / 2, 14);
  }
  // window glare
  const gl = ctx.createLinearGradient(0, 0, W, H);
  gl.addColorStop(0.3, 'rgba(255,255,255,0)'); gl.addColorStop(0.45, 'rgba(255,255,255,0.12)');
  gl.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
  return canvasTexture(c, { repeat: false });
}

export function genAd(title, sub, c1, c2, seed) {
  const W = 512, H = 768;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.35;
  for (let k = 0; k < 12; k++) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 + rng() * 6;
    ctx.beginPath(); ctx.arc(W * 0.5, H * 0.4, 40 + k * 26, rng() * 6, rng() * 6 + 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 110px ${FONT_LAT}`; ctx.fillText(title, W / 2, H * 0.74);
  ctx.font = `900 54px ${FONT_JP}`; ctx.fillText(sub, W / 2, H * 0.86);
  return canvasTexture(c, { repeat: false });
}

export function genHoloText() {
  const W = 512, H = 640;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 120px ${FONT_LAT}`; ctx.fillText('NEXA', W / 2, H * 0.74);
  ctx.font = `900 46px ${FONT_JP}`; ctx.fillText('夢を見る機械', W / 2, H * 0.86);
  ctx.font = `500 26px ${FONT_LAT}`; ctx.fillText('DREAM ENGINE  //  V.07', W / 2, H * 0.94);
  return canvasTexture(c, { repeat: false });
}

// Generate everything with progress callbacks, yielding to the browser
// between textures so the loading bar can animate.
export async function generateTextures(Q, aniso, progress) {
  const tx = {};
  const steps = [
    ['asphalt', () => genAsphalt(Q.groundTex, aniso)],
    ['concrete', () => genConcrete(Q.wallTex, aniso)],
    ['brick', () => genBrick(Q.wallTex, aniso)],
    ['shutter', () => genShutter(Q.wallTex, aniso)],
    ['facade', () => genFacade(Q.facadeTex, aniso)],
    ['metal', () => genMetal(512, aniso)],
    ['grate', () => genGrate(256, aniso)],
    ['acFront', () => genACFront(256)],
    ['cloud', () => genCloud(128)],
    ['vending', () => genVending()],
    ['shopRamen', () => genShopInterior('ramen')],
    ['shopBar', () => genShopInterior('bar')],
    ['shopMart', () => genShopInterior('mart')],
    ['holoText', () => genHoloText()],
    ['ads', () => [
      genAd('NEXA', '未来はここに', '#ff2d8a', '#3a0b5e', 1),
      genAd('SOLACE', '眠らない街', '#14d8ff', '#14204f', 2),
      genAd('ORBITAL', '宇宙ラーメン', '#ffb21f', '#7a0b3a', 3),
    ]],
  ];
  for (let i = 0; i < steps.length; i++) {
    progress(i / steps.length, `Generating ${steps[i][0]} texture`);
    await nextFrame();
    tx[steps[i][0]] = steps[i][1]();
  }
  return tx;
}
