// Shop art: menu boards, the interiors seen through the windows, and the noren curtain.
import { mulberry32 } from './noise.js';
import { makeCanvas, canvasTexture, FONT_JP, FONT_LAT, FONT_NEON } from './texture-core.js';
import { ART_TEXT } from './art-text.js';

// A shop's menu board: the dish in Japanese over its price.
export function genShopPrice(name, price) {
  const W = 420, H = 180;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#160a08'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#ffb36b'; ctx.lineWidth = 5; ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe9c8'; ctx.font = `900 44px ${FONT_JP}`; ctx.fillText(name, W / 2, 56, W - 40);
  ctx.fillStyle = '#ffd166'; ctx.font = `900 70px ${FONT_LAT}`; ctx.fillText(price, W / 2, 124, W - 40);
  return canvasTexture(c, { repeat: false });
}

// The bar's menu board: one row per drink, as [name, price].
export function genBarMenu(rows) {
  const W = 420, H = 180;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#12081a'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#ff6ad5'; ctx.lineWidth = 5; ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.textBaseline = 'middle'; ctx.font = `900 42px ${FONT_LAT}`;
  rows.forEach(([name, price], k) => {
    const y = 42 + k * 48;
    ctx.fillStyle = '#ffe6fa'; ctx.textAlign = 'left'; ctx.fillText(name, 32, y);
    ctx.fillStyle = '#ffd166'; ctx.textAlign = 'right'; ctx.fillText(price, W - 32, y);
  });
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
  [...ART_TEXT.ramen].forEach((ch, k) => ctx.fillText(ch, W / 8 + k * W / 4, 58));
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

function drawFish(ctx, W, H, rng) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#d4f1f2'); g.addColorStop(1, '#6fb4c2');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(40,90,110,0.35)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // fish hanging from a rail, each with a price tag below
  ctx.fillStyle = '#39424c'; ctx.fillRect(0, 98, W, 6);
  for (let k = 0; k < 9; k++) {
    const x = 32 + k * 56, len = 44 + rng() * 22;
    ctx.fillStyle = '#39424c'; ctx.fillRect(x - 1, 104, 2, 12);
    ctx.fillStyle = ['#8fa3b5', '#c7d3dd', '#d9654f', '#6b7f96'][Math.floor(rng() * 4)];
    ctx.beginPath(); ctx.ellipse(x, 116 + len / 2, 13, len / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, 110 + len); ctx.lineTo(x - 14, 132 + len); ctx.lineTo(x + 14, 132 + len); ctx.fill();
    ctx.fillStyle = '#12161c';
    ctx.beginPath(); ctx.arc(x + 4, 126, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe14d'; ctx.fillRect(x - 15, 204, 30, 18);
    ctx.fillStyle = '#c21f2e'; ctx.font = `900 13px ${FONT_LAT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${(2 + Math.floor(rng() * 8)) * 100}`, x, 213);
  }
  // crushed ice along the bottom
  ctx.fillStyle = '#7fa4b6'; ctx.fillRect(0, 240, W, 80);
  for (let k = 0; k < 160; k++) {
    ctx.fillStyle = rng() < 0.5 ? '#6d93a6' : '#9dbdcb';
    ctx.beginPath(); ctx.arc(rng() * W, 240 + rng() * 80, 2 + rng() * 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#0f3a66'; ctx.fillRect(0, 0, W, 84);
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 50px ${FONT_JP}`; ctx.fillText(ART_TEXT.fish, W / 2, 34);
  ctx.font = `700 18px ${FONT_LAT}`; ctx.fillText('FISH MARKET', W / 2, 69);
}

function drawOnigiri(ctx, W, H, rng) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#ffd698'); g.addColorStop(1, '#a8622a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // shelves of rice balls wrapped in nori
  for (let s = 0; s < 3; s++) {
    const y = 148 + s * 64;
    ctx.fillStyle = '#5a3216'; ctx.fillRect(10, y, W * 0.72, 8);
    for (let k = 0; k < 8; k++) {
      const x = 40 + k * 44, r = 16 + rng() * 3;
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath(); ctx.moveTo(x, y - r * 2.2); ctx.lineTo(x - r * 1.2, y); ctx.lineTo(x + r * 1.2, y); ctx.fill();
      ctx.fillStyle = '#10140f'; ctx.fillRect(x - r * 0.55, y - r * 0.95, r * 1.1, r * 0.95);
    }
  }
  // wooden menu tags
  for (let k = 0; k < 4; k++) {
    const x = W * 0.78 + k * 27;
    ctx.fillStyle = '#f4e5c4'; ctx.fillRect(x, 100, 22, 150 + rng() * 40);
    ctx.fillStyle = '#3a1a10'; ctx.font = `900 18px ${FONT_JP}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [...ART_TEXT.onigiri].forEach((ch, j) => ctx.fillText(ch, x + 11, 118 + j * 26));
  }
  ctx.fillStyle = '#6e1620'; ctx.fillRect(0, 0, W, 84);
  ctx.fillStyle = '#fff3d8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 48px ${FONT_JP}`; ctx.fillText(ART_TEXT.onigiri, W / 2, 34);
  ctx.font = `700 18px ${FONT_LAT}`; ctx.fillText('ONIGIRI', W / 2, 69);
}

function drawSushi(ctx, W, H, rng) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#f2e2c0'); g.addColorStop(1, '#a87c4c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // a shelf of sake bottles
  ctx.fillStyle = '#4a2a14'; ctx.fillRect(10, 196, W * 0.62, 8);
  for (let k = 0; k < 11; k++) {
    const x = 26 + k * 27, bh = 44 + rng() * 14;
    ctx.fillStyle = ['#1f4a34', '#f4efe2', '#5a2f10', '#22365c'][Math.floor(rng() * 4)];
    ctx.fillRect(x - 8, 196 - bh, 16, bh);
    ctx.fillRect(x - 3, 196 - bh - 14, 6, 14);
    ctx.fillStyle = '#f4e5c4'; ctx.fillRect(x - 6, 196 - bh * 0.7, 12, bh * 0.4);
  }
  // wooden menu tags
  for (let k = 0; k < 5; k++) {
    const x = W * 0.68 + k * 32;
    ctx.fillStyle = '#f4e5c4'; ctx.fillRect(x, 100, 26, 96 + rng() * 40);
    ctx.fillStyle = '#3a1a10'; ctx.font = `900 22px ${FONT_JP}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [...ART_TEXT.sushi].forEach((ch, j) => ctx.fillText(ch, x + 13, 122 + j * 30));
  }
  // chefs' counter along the bottom
  ctx.fillStyle = '#3a2214'; ctx.fillRect(0, 240, W, 80);
  ctx.fillStyle = '#d8c49a'; ctx.fillRect(0, 240, W, 8);
  ctx.fillStyle = '#16245c'; ctx.fillRect(0, 0, W, 84);
  ctx.fillStyle = '#f6f1e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 50px ${FONT_JP}`; ctx.fillText(ART_TEXT.sushi, W / 2, 34);
  ctx.font = `700 18px ${FONT_LAT}`; ctx.fillText('SUSHI', W / 2, 69);
}

const SHOPS = { ramen: drawRamen, bar: drawBar, mart: drawMart, fish: drawFish, onigiri: drawOnigiri, sushi: drawSushi };

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

// Split shop curtain: one cloth panel per character, with see-through gaps.
export function genNoren(text, cloth = '#1c2452', ink = '#c9c2b2') {
  const W = 512, H = 192;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const chars = [...text], pw = W / chars.length;
  ctx.fillStyle = cloth; ctx.fillRect(0, 0, W, 20);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 84px ${FONT_JP}`;
  chars.forEach((ch, k) => {
    ctx.fillStyle = cloth; ctx.fillRect(k * pw + 3, 0, pw - 6, H);
    ctx.fillStyle = ink; ctx.fillText(ch, (k + 0.5) * pw, H * 0.56);
  });
  return canvasTexture(c, { repeat: false });
}
