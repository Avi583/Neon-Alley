// Draws a sign onto a canvas: tube glow, lightboxes and bordered panels.
import * as THREE from 'three';
import { makeCanvas, FONT_JP, FONT_LAT, FONT_NEON } from './texture-core.js';

const MAX_SIGN_PX = 2048; // longest canvas side; the 7 m banner would otherwise hit 2800 px on Ultra

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

export function drawSign(spec, ppm) {
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
