import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Splashes, SPLASH_COUNT, SPLASH_LIFE, DROPS_PER_SPLASH } from '../src/splashes.js';

const make = () => new Splashes({ density: 0.01 });
const at = (x, z) => new THREE.Vector3(x, 0.004, z);
const ring = (s, i) => {
  const m = new THREE.Matrix4();
  s.rings.getMatrixAt(i, m);
  return {
    pos: new THREE.Vector3().setFromMatrixPosition(m),
    width: new THREE.Vector3().setFromMatrixScale(m).x,
  };
};

describe('Splashes', () => {
  it('draws no ring until the first splash', () => {
    expect(make().rings.count).toBe(0);
  });

  it('keeps unused droplets past the end of their life', () => {
    const s = make();
    s.update(0, new THREE.PerspectiveCamera(), 720);
    for (let i = 0; i < s.dropBorn.count; i++) expect(0 - s.dropBorn.getX(i)).toBeGreaterThan(SPLASH_LIFE);
  });

  it('places the ring and all its droplets at the foot, from the current time', () => {
    const s = make();
    s.update(3, new THREE.PerspectiveCamera(), 720);
    s.add(at(1, -4), 2);
    expect(s.rings.count).toBe(1);
    expect(s.ringBorn.getX(0)).toBe(3);
    expect(ring(s, 0).pos.x).toBeCloseTo(1);
    expect(ring(s, 0).pos.z).toBeCloseTo(-4);
    const pos = s.drops.geometry.attributes.position;
    for (let i = 0; i < DROPS_PER_SPLASH; i++) {
      expect(pos.getX(i)).toBeCloseTo(1);
      expect(pos.getZ(i)).toBeCloseTo(-4);
      expect(s.dropBorn.getX(i)).toBe(3);
      expect(s.dropVel.getY(i)).toBeGreaterThan(0);
    }
    expect(s.dropBorn.getX(DROPS_PER_SPLASH)).toBeLessThan(0);
  });

  it('splashes wider at a run than at a walk', () => {
    const s = make();
    s.add(at(0, 0), 2);
    s.add(at(0, 0), 4.2);
    expect(ring(s, 1).width).toBeGreaterThan(ring(s, 0).width);
  });

  it('points the ring the way the boot does and mirrors a left boot', () => {
    const s = make();
    s.add(at(0, 0), 2, Math.PI / 2, 1);
    s.add(at(0, 0), 2, Math.PI / 2, -1);
    const toe = (i) => {
      const m = new THREE.Matrix4();
      s.rings.getMatrixAt(i, m);
      return new THREE.Vector3(0, 0, -1).transformDirection(m);
    };
    const det = (i) => {
      const m = new THREE.Matrix4();
      s.rings.getMatrixAt(i, m);
      return m.determinant();
    };
    expect(toe(0).x).toBeCloseTo(-1);
    expect(det(0)).toBeGreaterThan(0);
    expect(det(1)).toBeLessThan(0);
  });

  // The mean of a splash's droplet velocities over the ground, and their mean speed out.
  const throwOf = (s, i) => {
    const sum = new THREE.Vector2();
    let out = 0;
    for (let d = i * DROPS_PER_SPLASH; d < (i + 1) * DROPS_PER_SPLASH; d++) {
      const v = new THREE.Vector2(s.dropVel.getX(d), s.dropVel.getZ(d));
      sum.add(v);
      out += v.length();
    }
    return { mean: sum.divideScalar(DROPS_PER_SPLASH), out: out / DROPS_PER_SPLASH };
  };

  it('throws the droplets mostly along the walk', () => {
    const s = make();
    for (let k = 0; k < SPLASH_COUNT; k++) s.add(at(0, 0), 2, 0, 1, new THREE.Vector2(2, 0)); // walking +x, boot pointing -z
    for (let k = 0; k < SPLASH_COUNT; k++) {
      const { mean, out } = throwOf(s, k);
      expect(mean.x).toBeGreaterThan(0.4 * out);
      expect(Math.abs(mean.y)).toBeLessThan(mean.x);
    }
  });

  it('throws along the boot when standing still', () => {
    const s = make();
    s.add(at(0, 0), 0.7, Math.PI / 2, 1, new THREE.Vector2()); // boot pointing -x
    expect(throwOf(s, 0).mean.x).toBeLessThan(0);
  });

  it('throws the droplets further at a run', () => {
    const s = make();
    s.add(at(0, 0), 2, 0, 1, new THREE.Vector2(0, -2));
    s.add(at(0, 0), 4.2, 0, 1, new THREE.Vector2(0, -4.2));
    expect(throwOf(s, 1).out).toBeGreaterThan(throwOf(s, 0).out * 1.3);
  });

  it('reuses the oldest splash once the pool is full', () => {
    const s = make();
    for (let k = 0; k < SPLASH_COUNT; k++) s.add(at(0, -k), 2);
    s.update(9, new THREE.PerspectiveCamera(), 720);
    s.add(at(0, 5), 2);
    expect(s.rings.count).toBe(SPLASH_COUNT);
    expect(s.ringBorn.getX(0)).toBe(9);
    expect(ring(s, 0).pos.z).toBeCloseTo(5);
    expect(ring(s, 1).pos.z).toBeCloseTo(-1);
  });

  it('has room for a full lifetime of running, so no splash vanishes early', () => {
    expect(SPLASH_COUNT).toBeGreaterThanOrEqual(3.5 * SPLASH_LIFE);
  });
});
