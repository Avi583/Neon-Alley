// Canvas-drawn art: AC units, the boot print, the vending machine, the barrier sign,
// billboards and the holographic text. Graffiti is in graffiti-art.js, shop art in shop-art.js.
import { mulberry32 } from './noise.js';
import { makeCanvas, canvasTexture, roundRect, FONT_JP, FONT_LAT } from './texture-core.js';
import { ART_TEXT } from './art-text.js';
import { CAN_LABELS, CAN_FLAVOURS, CAN_PRICE, yen } from './items.js';

// --------------------------------------------------- outdoor AC unit front
// Four streak patterns side by side in the alpha channel, heaviest at the top, for
// the stains below the AC units. Dirt with a little rust, so it darkens the wall.
export function genACDrip() {
  const CELLS = 4, CW = 64, H = 256;
  const c = makeCanvas(CW * CELLS, H), ctx = c.getContext('2d');
  const rng = mulberry32(95);
  for (let cell = 0; cell < CELLS; cell++) {
    ctx.save();
    ctx.beginPath(); ctx.rect(cell * CW, 0, CW, H); ctx.clip();
    const n = 7 + Math.floor(rng() * 5);
    for (let k = 0; k < n; k++) {
      const x = (cell + 0.12 + rng() * 0.76) * CW, len = H * (0.3 + rng() * 0.7), w = 2 + rng() * 7;
      const dirt = rng() < 0.5 ? '128, 74, 38' : '26, 24, 24', a = 0.35 + rng() * 0.45;
      const g = ctx.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, `rgba(${dirt}, ${a})`);
      g.addColorStop(1, `rgba(${dirt}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, 0); ctx.lineTo(x + w / 2, 0);
      ctx.lineTo(x + w * 0.1, len); ctx.lineTo(x - w * 0.1, len);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  return canvasTexture(c, { repeat: false });
}

// One boot sole in the alpha channel, toe at the top, with the tread cut out.
export function genBootPrint(aniso) {
  const W = 64, H = 160;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(W * 0.54, H * 0.3, W * 0.38, H * 0.27, 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(W * 0.26, H * 0.34, W * 0.5, H * 0.2);
  roundRect(ctx, W * 0.2, H * 0.66, W * 0.56, H * 0.3, W * 0.2); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  for (let y = H * 0.07; y < H; y += H * 0.065) ctx.fillRect(0, y, W, H * 0.022);
  return canvasTexture(c, { srgb: false, repeat: false, aniso });
}

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
export function genVendingHeader() {
  const W = 512, H = 138;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const top = ctx.createLinearGradient(0, 0, W, 0);
  top.addColorStop(0, '#ff3d7f'); top.addColorStop(1, '#ff8a3d');
  ctx.fillStyle = top; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 62px ${FONT_JP}`; ctx.fillText(ART_TEXT.vending, W / 2, 52);
  ctx.font = `700 26px ${FONT_LAT}`; ctx.fillText('ICE COLD DRINKS', W / 2, 112);
  return canvasTexture(c, { repeat: false });
}

// The control panel between the glass and the pickup bin.
export function genVendingPanel() {
  const W = 512, H = 276;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a2d36'); g.addColorStop(1, '#16181e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'middle';
  // price display
  ctx.fillStyle = '#050608'; roundRect(ctx, 28, 28, 200, 62, 6); ctx.fill();
  ctx.fillStyle = '#3dff9a'; ctx.textAlign = 'right';
  ctx.font = `700 38px ${FONT_LAT}`; ctx.fillText(`¥ ${CAN_PRICE}`, 214, 60);
  // poster
  const ad = ctx.createLinearGradient(28, 0, 300, 0);
  ad.addColorStop(0, '#1a6dff'); ad.addColorStop(1, '#14d8ff');
  ctx.fillStyle = ad; roundRect(ctx, 28, 110, 272, 136, 8); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
  ctx.font = `900 50px ${FONT_JP}`; ctx.fillText(ART_TEXT.vending, 164, 160);
  ctx.font = `700 20px ${FONT_LAT}`; ctx.fillText(`COLD · ${yen(CAN_PRICE)}`, 164, 214);
  // labels above the coin plate and the return button
  ctx.fillStyle = '#c4c8d0'; ctx.font = `700 16px ${FONT_LAT}`;
  ctx.fillText('COINS', 410, 24);
  ctx.fillText('RETURN', 410, 206);
  return canvasTexture(c, { repeat: false });
}

// The price tag on the rail under each can.
export function genVendingPrice() {
  const W = 160, H = 72;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f7ff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#0a0a12'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 50px ${FONT_LAT}`; ctx.fillText(yen(CAN_PRICE), W / 2, H / 2 + 2, W - 12);
  return canvasTexture(c, { repeat: false });
}

// The barrier's sign: a no-entry disc over the words.
export function genNoEntry(aniso) {
  const W = 512, H = 640;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#e8ebf0'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#c81e32'; ctx.lineWidth = 14; ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.fillStyle = '#c81e32';
  ctx.beginPath(); ctx.arc(W / 2, 250, 180, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(W / 2 - 130, 250 - 36, 260, 72);
  ctx.fillStyle = '#14141c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 72px ${FONT_LAT}`; ctx.fillText('NO ENTRY', W / 2, 530, W - 70);
  return canvasTexture(c, { repeat: false, aniso });
}

// One label per cell. u = 0.5 of a cell faces the viewer, so the can's round
// shading is painted in: the sides fall away to dark, with a highlight left of centre.
// The flavours are CAN_LABELS in items.js.
export function genCanLabels() {
  const S = 128, W = S * CAN_FLAVOURS, H = 256;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const flavours = CAN_LABELS;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  flavours.forEach(([base, ink, name], i) => {
    const x = i * S, mid = x + S / 2;
    ctx.fillStyle = base; ctx.fillRect(x, 0, S, H);
    // Only the middle of a cell faces the viewer, so the name runs up the can.
    ctx.save(); ctx.translate(mid, H / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = ink; ctx.font = `900 30px ${FONT_LAT}`;
    ctx.fillText(name, 0, 0, H - 64);
    ctx.restore();
    // bare metal shoulders at the top and bottom
    for (const [y, h] of [[0, 18], [H - 14, 14]]) {
      const m = ctx.createLinearGradient(0, y, 0, y + h);
      m.addColorStop(0, '#f0f3f8'); m.addColorStop(1, '#868c96');
      ctx.fillStyle = m; ctx.fillRect(x, y, S, h);
    }
    const shade = ctx.createLinearGradient(x, 0, x + S, 0);
    shade.addColorStop(0.2, 'rgba(0,0,0,0.8)');
    shade.addColorStop(0.42, 'rgba(255,255,255,0.28)');
    shade.addColorStop(0.5, 'rgba(255,255,255,0)');
    shade.addColorStop(0.8, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = shade; ctx.fillRect(x, 0, S, H);
  });
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
  ctx.font = `900 46px ${FONT_JP}`; ctx.fillText(ART_TEXT.holo, W / 2, H * 0.86);
  ctx.font = `500 26px ${FONT_LAT}`; ctx.fillText('DREAM ENGINE  //  V.07', W / 2, H * 0.94);
  return canvasTexture(c, { repeat: false });
}
