// Leather and denim for the biker: colour and normal maps with grain, seams,
// stitching, quilting and wear, drawn into data textures (no canvas, so they
// also build under the unit tests). u runs round each part from the back
// (0.25 the -x side, 0.5 the front, 0.75 the +x side) and v down its length.
import * as THREE from 'three';
import { fbm } from './noise.js';
import { clamp01, sstep } from './math.js';
import { normalFromHeight } from './texture-core.js';

const DASH = 5, DASH_ON = 3; // stitch length plus gap, and stitch length, in texels
const ROW = 2.8; // a seam's stitch rows sit this many texels either side of it
const NEAR = 8; // texels: past this from a line its groove and stitches are too faint to show
const THREAD_LEATHER = [0.95, 0.95, 0.95], THREAD_DENIM = [0.86, 0.6, 0.27];

// A polyline in uv. A 'seam' is a groove stitched along both sides, 'stitch' is topstitching alone.
const line = (kind, ...pts) => pts.slice(1).map((b, i) => ({ kind, a: pts[i], b }));
const mirror = (segs) => segs.map(({ kind, a, b }) => ({ kind, a: [1 - a[0], a[1]], b: [1 - b[0], b[1]] }));
const near = (u, c, w) => Math.exp(-((Math.min(Math.abs(u - c), 1 - Math.abs(u - c)) / w) ** 2));

// How far each texel is into a seam's groove and onto a stitch, both 0 to 1.
function stitching(W, H, segs) {
  const groove = new Float32Array(W * H), stitch = new Float32Array(W * H);
  const px = segs.map(({ kind, a, b }) => ({ kind, ax: a[0] * W, ay: a[1] * H, dx: (b[0] - a[0]) * W, dy: (b[1] - a[1]) * H }));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let g = 0, s = 0;
      for (const p of px) {
        let rx = x + 0.5 - p.ax;
        if (Math.abs(p.dx) < W / 2) rx -= W * Math.round(rx / W); // the nearest copy round the wrap
        const ry = y + 0.5 - p.ay;
        // Nothing to add away from the segment's bounding box.
        if (rx < Math.min(0, p.dx) - NEAR || rx > Math.max(0, p.dx) + NEAR || ry < Math.min(0, p.dy) - NEAR || ry > Math.max(0, p.dy) + NEAR) continue;
        const len2 = p.dx * p.dx + p.dy * p.dy || 1;
        const t = clamp01((rx * p.dx + ry * p.dy) / len2);
        const d = Math.hypot(rx - t * p.dx, ry - t * p.dy);
        const dash = (t * Math.sqrt(len2)) % DASH < DASH_ON ? 1 : 0;
        if (p.kind === 'seam') {
          g = Math.max(g, Math.exp(-((d / 1.3) ** 2)));
          s = Math.max(s, dash * clamp01(1 - Math.abs(d - ROW) / 0.9));
        } else s = Math.max(s, dash * clamp01(1 - d / 0.9));
      }
      groove[y * W + x] = g;
      stitch[y * W + x] = s;
    }
  }
  return { groove, stitch };
}

// texel(u, v, groove, stitch) returns [height, r, g, b] with colour 0 to 1 (sRGB).
function paint(W, H, segs, strength, texel) {
  const { groove, stitch } = stitching(W, H, segs);
  const h = new Float32Array(W * H), rgba = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const [height, r, g, b] = texel((x + 0.5) / W, (y + 0.5) / H, groove[i], stitch[i]);
      h[i] = height;
      const k = i * 4;
      rgba[k] = r * 255; rgba[k + 1] = g * 255; rgba[k + 2] = b * 255; rgba[k + 3] = 255;
    }
  }
  // Wrapping round the part but not along it, and unflipped, as DataTextures upload.
  const nrm = normalFromHeight(h, W, H, strength, { wrapY: false, flipY: true, out: new Uint8Array(W * H * 4) });
  const tex = (data, srgb) => {
    const t = new THREE.DataTexture(data, W, H);
    t.wrapS = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { map: tex(rgba, true), normalMap: tex(nrm, false) };
}

// Pebbled grain and mottling, with extra(u, v) for folds and quilting.
function leather(W, H, segs, seed, extra) {
  return paint(W, H, segs, 2.2, (u, v, groove, stitch) => {
    const grain = 1 - Math.abs(2 * fbm(u, v, W / 4, H / 4, seed, 2) - 1);
    const height = grain * 0.35 + extra(u, v) - groove + stitch * 0.5;
    const shade = (0.8 + 0.3 * fbm(u, v, 6, 6, seed + 5, 3) + grain * 0.06) * (1 - groove * 0.3);
    const c = shade * (1 - stitch) + stitch * 0.9;
    return [height, c * THREAD_LEATHER[0], c * THREAD_LEATHER[1], c * THREAD_LEATHER[2]];
  });
}

// Indigo twill, faded by fade(u, v), with extra(u, v) for creases.
function denim(W, H, segs, seed, fade, extra) {
  return paint(W, H, segs, 1.6, (u, v, groove, stitch) => {
    const x = u * W, y = v * H;
    const twill = Math.sin((x + y) * Math.PI * 0.7) * 0.5 + 0.5;
    const slub = fbm(u, v, 4, 64, seed, 2); // the uneven yarn of real denim runs down the leg
    const f = clamp01(fade(u, v) * (0.7 + 0.6 * fbm(u, v, 8, 16, seed + 3, 3)) + groove * 0.15);
    const height = twill * 0.15 + extra(u, v) - groove * 0.8 + stitch * 0.45;
    const k = (0.9 + twill * 0.12 + (slub - 0.5) * 0.2) * (1 - groove * 0.25);
    const base = [0.17 + 0.3 * f, 0.23 + 0.32 * f, 0.36 + 0.3 * f].map((c) => c * k);
    return [height, ...base.map((c, i) => c * (1 - stitch) + THREAD_DENIM[i] * stitch)];
  });
}

const ribs = (v, v0, v1, period) => sstep(v0, v0 + 0.01, v) * (1 - sstep(v1 - 0.01, v1, v)) * Math.abs(Math.sin(v * Math.PI / period)) * 0.7;

export function createCharacterTextures() {
  // Jacket body: shoulder line, side and back panel seams, yoke across the back, the hem.
  const torso = leather(256, 256, [
    ...line('seam', [0, 0.12], [1, 0.12]),
    ...line('seam', [0.25, 0.12], [0.25, 1]), ...line('seam', [0.75, 0.12], [0.75, 1]),
    ...line('seam', [0, 0.32], [0.2, 0.32]), ...line('seam', [0.8, 0.32], [1, 0.32]),
    ...line('seam', [0.1, 0.32], [0.12, 1]), ...line('seam', [0.9, 0.32], [0.88, 1]),
    ...line('seam', [0.36, 0.3], [0.38, 0.62]), ...line('seam', [0.64, 0.3], [0.62, 0.62]),
    ...line('stitch', [0, 0.95], [1, 0.95]),
  ], 11, (u, v) => {
    // Compression folds at the waist, mostly at the sides.
    const sides = Math.max(near(u, 0.25, 0.09), near(u, 0.75, 0.09));
    return 0.35 * sides * sstep(0.6, 0.72, v) * (1 - sstep(0.86, 0.92, v)) * Math.sin(v * 140 + 8 * fbm(u, v, 4, 4, 19, 2));
  });
  // Sleeves: set-in seam at the top, quilted shoulder, seams down both sides, ribbed elbow, creased inner elbow, cuff.
  const sleeve = leather(128, 256, [
    ...line('seam', [0, 0.1], [1, 0.1]),
    ...line('seam', [0.25, 0.1], [0.25, 1]), ...line('seam', [0.75, 0.1], [0.75, 1]),
    ...line('seam', [0, 0.84], [1, 0.84]), ...line('stitch', [0, 0.97], [1, 0.97]),
  ], 23, (u, v) => {
    const quilt = ribs(v, 0.12, 0.3, 0.022) * (1 - near(u, 0.5, 0.12));
    const elbowRibs = ribs(v, 0.52, 0.64, 0.014) * near(u, 0, 0.14);
    const crease = 0.45 * near(u, 0.5, 0.16) * Math.exp(-(((v - 0.6) / 0.05) ** 2)) * Math.sin(v * 220 + Math.abs(u - 0.5) * 30);
    return quilt + elbowRibs + crease;
  });
  // Jean legs: flat-felled seams inside and out, a double hem, fades on the thigh and knee, creases behind the knee and stacked at the ankle.
  const leg = denim(128, 256, [
    ...line('seam', [0.25, 0], [0.25, 1]), ...line('seam', [0.75, 0], [0.75, 1]),
    ...line('stitch', [0, 0.955], [1, 0.955]), ...line('stitch', [0, 0.975], [1, 0.975]),
  ], 31, (u, v) => near(u, 0.5, 0.16) * sstep(0.03, 0.14, v) * (1 - sstep(0.3, 0.42, v)) * 0.55
    + near(u, 0.5, 0.11) * Math.exp(-(((v - 0.53) / 0.05) ** 2)) * 0.6,
  (u, v) => near(u, 0, 0.15) * Math.exp(-(((v - 0.52) / 0.04) ** 2)) * Math.sin(v * 260) * 0.4
    + sstep(0.78, 0.86, v) * (1 - sstep(0.93, 0.95, v)) * Math.sin(v * 160 + 6 * fbm(u, v, 3, 4, 37, 2)) * 0.45);
  // Jean seat and fly: waistband, back yoke and pockets, front pocket curves, J-stitched fly.
  const backPocket = line('stitch', [0.05, 0.52], [0.17, 0.48], [0.19, 0.82], [0.12, 0.92], [0.06, 0.85], [0.05, 0.52]);
  const frontPocket = line('stitch', [0.39, 0.2], [0.36, 0.34], [0.31, 0.44], [0.25, 0.48]);
  const pelvis = denim(256, 128, [
    ...line('stitch', [0, 0.05], [1, 0.05]), ...line('seam', [0, 0.2], [1, 0.2]),
    ...line('seam', [0.25, 0.2], [0.25, 1]), ...line('seam', [0.75, 0.2], [0.75, 1]),
    ...line('seam', [0, 0.2], [0, 1]), ...line('seam', [0.5, 0.2], [0.5, 1]),
    ...line('seam', [0, 0.46], [0.22, 0.32]), ...mirror(line('seam', [0, 0.46], [0.22, 0.32])),
    ...backPocket, ...mirror(backPocket), ...frontPocket, ...mirror(frontPocket),
    ...line('stitch', [0.535, 0.2], [0.535, 0.55], [0.52, 0.65], [0.5, 0.68]),
  ], 41, (u, v) => near(u, 0.5, 0.16) * sstep(0.45, 0.85, v) * 0.55, () => 0); // the crotch fades as the thigh fronts do
  // Gloves: seams down both sides of every finger and the palm, and a stitched band near the end.
  const glove = leather(128, 128, [
    ...line('seam', [0.25, 0], [0.25, 1]), ...line('seam', [0.75, 0], [0.75, 1]),
    ...line('stitch', [0, 0.08], [1, 0.08]),
  ], 51, (u, v) => 0.12 * (fbm(u, v, 2, 6, 53, 2) - 0.5)); // soft unevenness, no ribbing on the small finger tubes
  // Boot foot, from the heel (v = 0) to the toe, sole side at u = 0: welt stitching low on both
  // sides, the heel counter, the vamp seam over the instep, the toe cap, and creases where the foot flexes.
  const counter = line('seam', [0.12, 0.34], [0.26, 0.27], [0.36, 0.14], [0.4, 0.02]);
  const bootFoot = leather(128, 256, [
    ...line('stitch', [0.13, 0], [0.13, 1]), ...line('stitch', [0.87, 0], [0.87, 1]),
    ...counter, ...mirror(counter),
    ...line('seam', [0.3, 0.44], [0.4, 0.4], [0.5, 0.39], [0.6, 0.4], [0.7, 0.44]),
    ...line('seam', [0.18, 0.76], [0.32, 0.71], [0.5, 0.7], [0.68, 0.71], [0.82, 0.76]),
  ], 61, (u, v) => 0.12 * near(u, 0.5, 0.14) * Math.exp(-(((v - 0.6) / 0.035) ** 2)) * Math.sin(v * 140 + (u - 0.5) * 12));
  // Boot shaft: seams down the sides and stitching round the top.
  const bootShaft = leather(128, 128, [
    ...line('seam', [0.25, 0], [0.25, 1]), ...line('seam', [0.75, 0], [0.75, 1]),
    ...line('stitch', [0, 0.05], [1, 0.05]),
  ], 71, (u, v) => 0.3 * sstep(0.6, 0.85, v) * Math.sin(v * 120 + 6 * fbm(u, v, 3, 3, 73, 2)));
  return { torso, sleeve, leg, pelvis, glove, bootFoot, bootShaft };
}
