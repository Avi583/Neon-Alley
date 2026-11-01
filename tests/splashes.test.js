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
