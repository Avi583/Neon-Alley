// Canvas-drawn art: AC units, the vending machine, shop interiors, billboards
// and the holographic text.
import { mulberry32 } from './noise.js';
import { makeCanvas, canvasTexture, FONT_JP, FONT_LAT, FONT_NEON } from './texture-core.js';

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

// One function per shop. Each draws in the same order on a W x H canvas.
function drawRamen(ctx, W, H) {
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
}

function drawBar(ctx, W, H, rng) {
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
}

function drawMart(ctx, W, H, rng) {
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

const SHOPS = { ramen: drawRamen, bar: drawBar, mart: drawMart };

export function genShopInterior(kind) {
  const W = 512, H = 320;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const rng = mulberry32(kind.length * 31);
  SHOPS[kind](ctx, W, H, rng);
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
