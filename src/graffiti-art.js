// Wall graffiti: the pieces painted on the shopfronts, side by side in one atlas.
import { mulberry32 } from './noise.js';
import { makeCanvas, canvasTexture, roundRect, FONT_JP, FONT_LAT } from './texture-core.js';
import { ART_TEXT } from './art-text.js';

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

