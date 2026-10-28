// Small deterministic noise toolkit used by the procedural textures and the
// neon flicker. Everything is seeded so the alley looks the same every visit.

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const sm = (t) => t * t * (3 - 2 * t);

// Tileable value noise: px/py are the integer lattice periods.
export function vnoise(x, y, px, py, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py;
  const x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
  const a = hash2(x0, y0, s), b = hash2(x1, y0, s), c = hash2(x0, y1, s), d = hash2(x1, y1, s);
  const u = sm(fx), v = sm(fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Tileable fBm over u,v in [0,1). px/py = base frequency (integer) per axis.
export function fbm(u, v, px, py, s, oct = 5, gain = 0.5) {
  let sum = 0, amp = 0.5, norm = 0, fx = px, fy = py;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(u * fx, v * fy, fx, fy, s + i * 17);
    norm += amp;
    amp *= gain;
    fx *= 2;
    fy *= 2;
  }
  return sum / norm;
}

// Smooth 1D noise in [0,1].
export function noise1(t, s = 0) {
  const i = Math.floor(t), f = t - i;
  const a = hash2(i, 0, s), b = hash2(i + 1, 0, s);
  return a + (b - a) * sm(f);
}
