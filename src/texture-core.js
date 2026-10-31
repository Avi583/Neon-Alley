// Shared texture plumbing: pixel maps, normal generation, canvas helpers and
// the fonts used by anything drawn on a canvas.
import * as THREE from 'three';

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export const FONT_JP = '"Noto Sans JP","Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Meiryo","Noto Sans CJK JP",sans-serif';
export const FONT_LAT = '"Orbitron","Noto Sans JP",sans-serif';
export const FONT_NEON = '"Monoton","Orbitron",sans-serif';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function arrToCanvas(data, w, h) {
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

export class Maps {
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
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const k = (y * w + x) * 4;
      out[k] = (nx / l * 0.5 + 0.5) * 255;
      out[k + 1] = (ny / l * 0.5 + 0.5) * 255;
      out[k + 2] = (nz / l * 0.5 + 0.5) * 255;
      out[k + 3] = 255;
    }
  }
  return out;
}

export function finalize(m, normalStrength, aniso, extraDraw) {
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
