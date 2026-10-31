// Canvas-drawn art: AC units, the vending machine, shop interiors, the noren
// curtain, billboards and the holographic text.
import { mulberry32 } from './noise.js';
import { makeCanvas, canvasTexture, roundRect, FONT_JP, FONT_LAT, FONT_NEON } from './texture-core.js';
import { ART_TEXT } from './art-text.js';

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

// ------------------------------------------------------- wall graffiti
function paintDrips(ctx, rng, x0, x1, y, color, n) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const x = x0 + rng() * (x1 - x0);
    ctx.lineWidth = 1.5 + rng() * 2.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 12 + rng() * 44); ctx.stroke();
  }
}

// Soft dots of paint around a shape, as a spray can leaves.
function overspray(ctx, rng, cx, cy, rx, ry, color, n) {
  ctx.fillStyle = color;
  for (let k = 0; k < n; k++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng());
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, 0.5 + rng() * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function bubbleText(ctx, text, x, y, size, fill, line) {
  ctx.font = `900 ${size}px ${FONT_LAT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (const [w, col, dx] of [[size * 0.34, 'rgba(8, 8, 14, 0.9)', 5], [size * 0.22, line, 0]]) {
    ctx.lineWidth = w; ctx.strokeStyle = col;
    ctx.strokeText(text, x + dx, y + dx);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

// A standing cat facing dir, with its feet at (x, y).
function catFighter(ctx, x, y, dir, fur, band) {
  const INK = '#0a0a12';
  ctx.save();
  ctx.translate(x, y); ctx.scale(dir, 1);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const limbs = () => {
    ctx.beginPath();
    ctx.moveTo(-26, -34); ctx.bezierCurveTo(-62, -40, -66, -80, -46, -96); // tail
    ctx.moveTo(-12, -24); ctx.lineTo(-30, -6);
    ctx.moveTo(12, -24); ctx.lineTo(28, -6);
    ctx.moveTo(12, -72); ctx.lineTo(44, -78); // sword arm
    ctx.stroke();
  };
  ctx.strokeStyle = INK; ctx.lineWidth = 20; limbs();
  ctx.strokeStyle = fur; ctx.lineWidth = 12; limbs();
  ctx.fillStyle = fur; ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(0, -52, 26, 38, 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // ears, then the head over them
  for (const ex of [-8, 30]) {
    ctx.beginPath(); ctx.moveTo(ex - 14, -124); ctx.lineTo(ex, -152); ctx.lineTo(ex + 14, -124); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(11, -108, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // headband, its tails flying out behind
  ctx.strokeStyle = band; ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-18, -116); ctx.lineTo(40, -120);
  ctx.moveTo(-18, -116); ctx.quadraticCurveTo(-38, -130, -58, -118);
  ctx.moveTo(-18, -116); ctx.quadraticCurveTo(-38, -112, -54, -98);
  ctx.stroke();
  // a narrowed eye and a snarl
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.moveTo(14, -108); ctx.lineTo(34, -112); ctx.lineTo(30, -100); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(20, -90); ctx.lineTo(36, -92); ctx.stroke();
  ctx.restore();
}

// A katana in the hand of a catFighter stood at the same (x, y), angled up to the middle of the piece.
function katana(ctx, x, y, dir) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(dir, 1);
  ctx.lineCap = 'round';
  const blade = () => { ctx.beginPath(); ctx.moveTo(46, -80); ctx.quadraticCurveTo(100, -106, 146, -158); ctx.stroke(); };
  ctx.strokeStyle = '#0a0a12'; ctx.lineWidth = 9; blade();
  ctx.strokeStyle = '#f4f7ff'; ctx.lineWidth = 4; blade();
  ctx.strokeStyle = '#0a0a12'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(32, -72); ctx.lineTo(50, -82); ctx.stroke(); // grip
  ctx.strokeStyle = '#f9f871'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(46, -90); ctx.lineTo(54, -74); ctx.stroke(); // guard
  ctx.restore();
}

// The GitHub mark, in a 16 x 16 box.
const GITHUB_MARK = 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z';

// A stencilled GitHub mark with a username.
function stencilledGithub(ctx, W, H, rng) {
  const s = 10.5, cx = W / 2, cy = H * 0.38;
  overspray(ctx, rng, cx, cy, 112, 106, 'rgba(235, 238, 245, 0.45)', 180);
  ctx.save();
  ctx.translate(cx - 8 * s, cy - 8 * s); ctx.scale(s, s);
  ctx.fillStyle = '#eceff5';
  ctx.fill(new Path2D(GITHUB_MARK), 'evenodd');
  ctx.restore();
  ctx.fillStyle = '#eceff5';
  ctx.font = `700 42px ${FONT_LAT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('avi583', cx, H * 0.87);
}

// One piece each, drawn in a W x H cell.
const GRAFFITI = [
  // a bubble-letter throw-up
  (ctx, W, H, rng) => {
    paintDrips(ctx, rng, W * 0.14, W * 0.86, H * 0.68, '#ff3fa4', 9);
    bubbleText(ctx, 'NEON', W / 2, H * 0.46, 92, '#ff3fa4', '#f4f7ff');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(W * 0.12, H * 0.34, W * 0.76, 5);
  },
  // a fast marker tag
  (ctx, W, H) => {
    ctx.save();
    ctx.translate(W / 2, H * 0.5); ctx.transform(1, -0.12, -0.35, 1, 0, 0);
    ctx.font = `italic 700 72px ${FONT_LAT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = '#33e1ff';
    ctx.strokeText('NIGHT', 0, -44);
    ctx.strokeText('CITY', 0, 24);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-150, 74); ctx.bezierCurveTo(-40, 104, 70, 56, 160, 82); ctx.lineTo(120, 96); ctx.stroke();
    ctx.restore();
  },
  stencilledGithub,
  // a kanji over a spray-can halo
  (ctx, W, H, rng) => {
    const g = ctx.createRadialGradient(W / 2, H / 2, 16, W / 2, H / 2, H * 0.47);
    g.addColorStop(0, 'rgba(93, 255, 180, 0.95)');
    g.addColorStop(0.75, 'rgba(93, 255, 180, 0.72)');
    g.addColorStop(1, 'rgba(93, 255, 180, 0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    paintDrips(ctx, rng, W * 0.3, W * 0.7, H * 0.72, 'rgba(93, 255, 180, 0.8)', 6);
    ctx.font = `900 150px ${FONT_JP}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0a0a12';
    ctx.fillText(ART_TEXT.graffiti[0], W / 2, H / 2 + 6);
  },
  // two headbanded cats crossing katanas
  (ctx, W, H) => {
    const feet = H * 0.94;
    catFighter(ctx, W * 0.24, feet, 1, '#ff8a2a', '#ff2d55');
    catFighter(ctx, W * 0.76, feet, -1, '#d8dce6', '#33e1ff');
    katana(ctx, W * 0.24, feet, 1);
    katana(ctx, W * 0.76, feet, -1);
    const sx = W / 2, sy = feet - 121;
    ctx.fillStyle = '#f9f871'; ctx.strokeStyle = '#0a0a12'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8, r = k % 2 ? 7 : 22;
      ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  },
  // a robot with an antenna and a glowing visor
  (ctx, W, H) => {
    const cx = W / 2, INK = '#0a0a12', STEEL = '#33e1ff';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // arms and legs, inked then painted
    const limbs = () => {
      ctx.beginPath();
      ctx.moveTo(cx - 52, H * 0.6); ctx.lineTo(cx - 92, H * 0.74); ctx.lineTo(cx - 84, H * 0.5);
      ctx.moveTo(cx + 52, H * 0.6); ctx.lineTo(cx + 92, H * 0.74); ctx.lineTo(cx + 104, H * 0.52);
      ctx.moveTo(cx - 24, H * 0.82); ctx.lineTo(cx - 24, H * 0.94);
      ctx.moveTo(cx + 24, H * 0.82); ctx.lineTo(cx + 24, H * 0.94);
      ctx.stroke();
    };
    ctx.strokeStyle = STEEL; ctx.lineWidth = 12; limbs();
    // body and chest panel, with a neck up to the head
    ctx.fillStyle = STEEL;
    ctx.fillRect(cx - 18, H * 0.44, 36, H * 0.08);
    roundRect(ctx, cx - 54, H * 0.5, 108, H * 0.34, 12); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = INK;
    ctx.fillStyle = '#ff3fa4';
    ctx.beginPath(); ctx.arc(cx, H * 0.66, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // antenna, then the head over it
    ctx.strokeStyle = '#d8dce6'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(cx, H * 0.2); ctx.lineTo(cx, H * 0.07); ctx.stroke();
    ctx.fillStyle = '#ff3fa4';
    ctx.beginPath(); ctx.arc(cx, H * 0.06, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8dce6';
    roundRect(ctx, cx - 64, H * 0.16, 128, H * 0.3, 16); ctx.fill();
    // visor with two eyes, and a grille of a mouth
    ctx.fillStyle = INK;
    roundRect(ctx, cx - 50, H * 0.21, 100, 28, 12); ctx.fill();
    ctx.fillStyle = '#f9f871';
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + d * 24, H * 0.21 + 14, 8, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath();
    for (let k = -2; k <= 2; k++) { ctx.moveTo(cx + k * 12, H * 0.37); ctx.lineTo(cx + k * 12, H * 0.42); }
    ctx.stroke();
  },
  // a torn paste-up poster of an eye
  (ctx, W, H, rng) => {
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.rotate(-0.05);
    const w = W * 0.72, h = H * 0.84, steps = 16;
    ctx.fillStyle = '#d9d4c3';
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2, h / 2 - 20);
    for (let k = 1; k <= steps; k++) ctx.lineTo(w / 2 - k * w / steps, h / 2 - rng() * 34);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#14141c';
    ctx.beginPath();
    ctx.moveTo(-110, -14); ctx.quadraticCurveTo(0, -94, 110, -14); ctx.quadraticCurveTo(0, 62, -110, -14); ctx.fill();
    ctx.fillStyle = '#d9d4c3'; ctx.beginPath(); ctx.arc(0, -16, 33, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff2d55'; ctx.beginPath(); ctx.arc(0, -16, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#14141c';
    ctx.font = `700 22px ${FONT_LAT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('THEY WATCH', 0, 66);
    ctx.restore();
  },
  // a dripping heart
  (ctx, W, H, rng) => {
    const cx = W * 0.5, cy = H * 0.42, s = 3.1;
    ctx.fillStyle = '#ff2d55'; ctx.strokeStyle = '#f4f7ff'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy + 46 * s / 2);
    ctx.bezierCurveTo(cx - 52 * s / 2, cy + 8 * s / 2, cx - 40 * s / 2, cy - 30 * s / 2, cx, cy - 10 * s / 2);
    ctx.bezierCurveTo(cx + 40 * s / 2, cy - 30 * s / 2, cx + 52 * s / 2, cy + 8 * s / 2, cx, cy + 46 * s / 2);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    paintDrips(ctx, rng, cx - 44, cx + 44, cy + 28, '#ff2d55', 7);
  },
  stencilledGithub,
];

// Old paint: colours washed towards the wall, thinned, then rubbed away in patches and flecks.
function fadeGraffiti(ctx, W, H, rng) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(92, 92, 100, 0.38)';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(0, 0, W, H);
  for (let k = 0, n = GRAFFITI_CELLS * 60; k < n; k++) {
    const x = rng() * W, y = rng() * H, r = 20 + rng() * 50;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0, 0, 0, ${0.2 + rng() * 0.35})`);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  for (let k = 0, n = GRAFFITI_CELLS * 1200; k < n; k++) {
    ctx.beginPath();
    ctx.arc(rng() * W, rng() * H, 0.4 + rng() * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Pieces side by side in one transparent atlas. Placed by graffitiPiece in alley.js.
export const GRAFFITI_CELLS = GRAFFITI.length;
export const GRAFFITI_ROBOT = 5, GRAFFITI_GITHUB = 8;
export function genGraffiti(aniso) {
  const CW = 384, H = 256;
  const c = makeCanvas(CW * GRAFFITI_CELLS, H), ctx = c.getContext('2d');
  const rng = mulberry32(214);
  GRAFFITI.forEach((draw, cell) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(cell * CW, 0, CW, H); ctx.clip();
    ctx.translate(cell * CW, 0);
    draw(ctx, CW, H, rng);
    ctx.restore();
  });
  fadeGraffiti(ctx, c.width, H, rng);
  return canvasTexture(c, { repeat: false, aniso });
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
  ctx.font = `700 38px ${FONT_LAT}`; ctx.fillText('¥ 120', 214, 60);
  // poster
  const ad = ctx.createLinearGradient(28, 0, 300, 0);
  ad.addColorStop(0, '#1a6dff'); ad.addColorStop(1, '#14d8ff');
  ctx.fillStyle = ad; roundRect(ctx, 28, 110, 272, 136, 8); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
  ctx.font = `900 50px ${FONT_JP}`; ctx.fillText(ART_TEXT.vending, 164, 160);
  ctx.font = `700 20px ${FONT_LAT}`; ctx.fillText('COLD · ¥120', 164, 214);
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
  ctx.font = `900 50px ${FONT_LAT}`; ctx.fillText('¥120', W / 2, H / 2 + 2, W - 12);
  return canvasTexture(c, { repeat: false });
}

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

// One label per cell. u = 0.5 of a cell faces the viewer, so the can's round
// shading is painted in: the sides fall away to dark, with a highlight left of centre.
export const CAN_FLAVOURS = 6;
export function genCanLabels() {
  const S = 128, W = S * CAN_FLAVOURS, H = 256;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const flavours = [
    ['#e0162e', '#ffffff', 'COLA'],
    ['#1a5cff', '#d8f4ff', 'SODA'],
    ['#ffc21f', '#c81e32', 'LEMON'],
    ['#14b866', '#f4fff0', 'MATCHA'],
    ['#8a35e0', '#ffe0ff', 'GRAPE'],
    ['#ff7a14', '#fff4d8', 'MIKAN'],
  ];
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
