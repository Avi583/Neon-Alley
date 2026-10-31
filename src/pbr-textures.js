// Procedural PBR textures, generated per texel from noise, so the site ships
// with zero image downloads and has no licensing questions.
import { fbm, hash2, mulberry32 } from './noise.js';
import { clamp01, sstep, frac } from './math.js';
import { Maps, finalize, arrToCanvas, canvasTexture } from './texture-core.js';

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

// ----------------------------------------------- crate wood, grain along u
export function genWood(S, aniso, seed = 51) {
  const m = new Maps(S, S);
  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      const u = x / S, i = y * S + x;
      const grain = fbm(u, v, 3, 40, seed, 4);
      const fine = fbm(u, v, 8, 128, seed + 7, 2);
      const blot = fbm(u, v, 3, 3, seed + 13, 3);
      const c = (0.68 + 0.6 * (grain - 0.5) + 0.2 * (fine - 0.5)) * (1 - 0.3 * sstep(0.5, 0.75, blot));
      m.put(i, c, c * 0.72, c * 0.46, clamp01(0.82 - 0.2 * grain), grain * 0.7 + fine * 0.3);
    }
  }
  return finalize(m, 2, aniso);
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
      const fade = Math.max(0, 1 - r); // zero past the circle, or squaring brings the quad's corners back
      const a = clamp01(fade * fade * (0.35 + 0.9 * n));
      const k = (y * S + x) * 4;
      const lum = 200 + 55 * n;
      data[k] = lum; data[k + 1] = lum; data[k + 2] = lum; data[k + 3] = a * 255;
    }
  }
  const t = canvasTexture(arrToCanvas(data, S, S), { repeat: false });
  return t;
}
