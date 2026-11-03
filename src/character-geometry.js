// Geometry for the biker: cross-section samplers, and the lofts and sweeps that
// build skinned tubes and patches from them.
import * as THREE from 'three';

// Rounds a tube's ends shut: 0 at an end, 1 once a share a (start) or b (end) of the way in.
export function cap(t, a, b) {
  const k = Math.min(1, a > 0 ? t / a : 1, b > 0 ? (1 - t) / b : 1);
  return Math.sqrt(Math.max(0, 1 - (1 - k) ** 2));
}

const catmull = (p0, p1, p2, p3, t) =>
  0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);

// The cross-section at distance d, curving smoothly through the keys.
export function sampler(keys) {
  return (d) => {
    let i = 0;
    while (i < keys.length - 2 && d > keys[i + 1][0]) i++;
    const k0 = keys[Math.max(i - 1, 0)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(i + 2, keys.length - 1)];
    const t = THREE.MathUtils.clamp((d - k1[0]) / (k2[0] - k1[0]), 0, 1);
    return k1.slice(1).map((_, j) => Math.max(0, catmull(k0[j + 1], k1[j + 1], k2[j + 1], k3[j + 1], t)));
  };
}

// A point on a superellipse with different depths in front (-z) and behind.
function section(theta, rx, rf, rb, n) {
  const c = Math.cos(theta), s = Math.sin(theta);
  return [rx * Math.sign(c) * Math.abs(c) ** (2 / n), (s < 0 ? rf : rb) * Math.sign(s) * Math.abs(s) ** (2 / n)];
}

// How far in front of the middle a lofted surface is at (x, y), as a negative z.
export function frontZ(sample, n, x, y) {
  const [rx, rf] = sample(-y);
  const k = Math.min(Math.abs(x) / rx, 1);
  return -rf * (1 - k ** n) ** (1 / n);
}

// A tube down the y axis through cross-sections from d = from to to, grown by grow.
// u runs round from the back and v down. weight(d) gives skin weights as [bone a, bone b, share of b].
export function loft({ sample, from, to, rows, seg, n, grow = 0, weight }) {
  const pos = [], uv = [], index = [], skinIndex = [], skinWeight = [];
  for (let r = 0; r <= rows; r++) {
    const d = from + (to - from) * (r / rows);
    const [rx, rf, rb, fold] = sample(d);
    for (let i = 0; i <= seg; i++) {
      const th = Math.PI / 2 + (i / seg) * Math.PI * 2;
      const k = 1 + fold * Math.sin(th * 5 + d * 37); // loose folds in the cloth
      const [x, z] = section(th, rx * k + grow, rf * k + grow, rb * k + grow, n);
      pos.push(x, -d, z);
      uv.push(i / seg, r / rows);
      if (weight) {
        const [a, b, w] = weight(d);
        skinIndex.push(a, b, 0, 0);
        skinWeight.push(1 - w, w, 0, 0);
      }
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < seg; i++) {
      const a = r * (seg + 1) + i, b = a + seg + 1;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (weight) {
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  }
  geo.setIndex(index);
  geo.computeVertexNormals();
  // The first and last column are the same place: share their normal so the seam doesn't show.
  const nrm = geo.attributes.normal, v = new THREE.Vector3();
  for (let r = 0; r <= rows; r++) {
    const a = r * (seg + 1), b = a + seg;
    v.fromBufferAttribute(nrm, a).add(new THREE.Vector3().fromBufferAttribute(nrm, b)).normalize();
    nrm.setXYZ(a, v.x, v.y, v.z);
    nrm.setXYZ(b, v.x, v.y, v.z);
  }
  return geo;
}

// A tube along a curve. shape(t) gives [half width along side, front, back], front being
// the way side x tangent points. u runs round and v along, as in loft.
export function sweep({ curve, side, rows, seg, n, shape, grow = 0, t0 = 0, t1 = 1 }) {
  const pos = [], uv = [], index = [], centre = [];
  const P = new THREE.Vector3(), T = new THREE.Vector3(), D = new THREE.Vector3(), S = new THREE.Vector3();
  for (let r = 0; r <= rows; r++) {
    const t = t0 + (t1 - t0) * (r / rows);
    curve.getPointAt(t, P);
    curve.getTangentAt(t, T);
    D.crossVectors(side, T).normalize();
    S.crossVectors(T, D).normalize();
    centre.push(P.clone());
    const [w, f, b] = shape(t);
    for (let i = 0; i <= seg; i++) {
      const [x, z] = section(Math.PI / 2 + (i / seg) * Math.PI * 2, w + grow, f + grow, b + grow, n);
      pos.push(P.x + S.x * x - D.x * z, P.y + S.y * x - D.y * z, P.z + S.z * x - D.z * z);
      uv.push(i / seg, r / rows);
    }
  }
  // Wind the faces outwards, whichever way the frame turned out.
  const r = Math.floor(rows / 2), q = r * (seg + 1);
  const v = (i) => new THREE.Vector3().fromArray(pos, i * 3);
  const a = v(q), face = v(q + 1).sub(a).cross(v(q + seg + 1).sub(a));
  const out = face.dot(a.clone().sub(centre[r])) > 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < seg; i++) {
      const k = j * (seg + 1) + i, w = k + seg + 1;
      if (out) index.push(k, k + 1, w, k + 1, w + 1, w);
      else index.push(k, w, k + 1, k + 1, w, w + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

// A path drawn on the front of a lofted surface, lifted off it, as a tube.
export function frontTube(sample, n, pts, lift, radius) {
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k < 8; k++) {
      const t = k / 8;
      dense.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]);
    }
  }
  dense.push(pts[pts.length - 1]);
  const curve = new THREE.CatmullRomCurve3(dense.map(([x, y]) => new THREE.Vector3(x, y, frontZ(sample, n, x, y) - lift)));
  return new THREE.TubeGeometry(curve, dense.length * 2, radius, 6);
}

// A flat panel with the outline given, laid on the front of a lofted surface.
export function frontPatch(sample, n, outline, lift) {
  const tris = THREE.ShapeUtils.triangulateShape(outline.map(([x, y]) => new THREE.Vector2(x, y)), []);
  const index = [];
  for (const [a, b, c] of tris) {
    const [ax, ay] = outline[a], [bx, by] = outline[b], [cx, cy] = outline[c];
    const ccw = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax) > 0;
    index.push(...(ccw ? [a, c, b] : [a, b, c])); // facing forward, down -z
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(outline.flatMap(([x, y]) => [x, y, frontZ(sample, n, x, y) - lift]), 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}
