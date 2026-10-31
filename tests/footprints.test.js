import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Footprints, MARK_COUNT, MARK_LIFE } from '../src/footprints.js';

const make = () => new Footprints(null, { uMaskMap: { value: null }, uMaskXform: { value: null } }, { density: 0.01 });
const at = (x, z) => new THREE.Vector2(x, z);
const position = (f, i) => {
  const m = new THREE.Matrix4();
  f.mesh.getMatrixAt(i, m);
  return new THREE.Vector3().setFromMatrixPosition(m);
};

describe('Footprints', () => {
  it('draws nothing until the first step', () => {
    expect(make().mesh.count).toBe(0);
  });

  it('records when each mark was left', () => {
    const f = make();
    f.update(3);
    f.add(at(0, 0), 0);
    f.update(4);
    f.add(at(0, 1), 0);
    expect(f.mesh.count).toBe(2);
    expect(f.born.getX(0)).toBe(3);
    expect(f.born.getX(1)).toBe(4);
  });

  it('reuses the oldest mark once the pool is full', () => {
    const f = make();
    for (let k = 0; k < MARK_COUNT; k++) f.add(at(0, -k), 0);
    expect(f.mesh.count).toBe(MARK_COUNT);
    f.update(9);
    f.add(at(1, 5), 0);
    expect(f.mesh.count).toBe(MARK_COUNT);
    expect(f.born.getX(0)).toBe(9);
    expect(position(f, 0).z).toBeCloseTo(5);
    expect(position(f, 1).z).toBeCloseTo(-1);
  });

  it('has room for a full lifetime of running, so no mark vanishes early', () => {
    expect(MARK_COUNT).toBeGreaterThanOrEqual(3.5 * MARK_LIFE);
  });

  it('alternates feet either side of the walker, across the facing direction', () => {
    const f = make();
    f.add(at(0, 0), 0);
    f.add(at(0, 0), 0);
    expect(position(f, 0).x).toBeLessThan(0);
    expect(position(f, 1).x).toBeGreaterThan(0);
    f.add(at(0, 0), Math.PI / 2); // facing -x, so the feet separate along z
    expect(Math.abs(position(f, 2).x)).toBeLessThan(1e-6);
    expect(Math.abs(position(f, 2).z)).toBeGreaterThan(0.01);
  });

  it('sits just above the ground', () => {
    const f = make();
    f.add(at(0, 0), 0);
    const y = position(f, 0).y;
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(0.01);
  });
});
