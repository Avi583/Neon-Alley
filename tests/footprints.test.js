import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Footprints, MARK_COUNT, MARK_LIFE } from '../src/footprints.js';

const make = () => new Footprints(null, { uMaskMap: { value: null }, uMaskXform: { value: null } }, { density: 0.01 });
const at = (x, z) => new THREE.Vector3(x, 0, z);
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
    f.add(at(0, 0), 0, true);
    f.update(4);
    f.add(at(0, 1), 0, false);
    expect(f.mesh.count).toBe(2);
    expect(f.born.getX(0)).toBe(3);
    expect(f.born.getX(1)).toBe(4);
  });

  it('reuses the oldest mark once the pool is full', () => {
    const f = make();
    for (let k = 0; k < MARK_COUNT; k++) f.add(at(0, -k), 0, k % 2 === 0);
    expect(f.mesh.count).toBe(MARK_COUNT);
    f.update(9);
    f.add(at(1, 5), 0, true);
    expect(f.mesh.count).toBe(MARK_COUNT);
    expect(f.born.getX(0)).toBe(9);
    expect(position(f, 0).z).toBeCloseTo(5);
    expect(position(f, 1).z).toBeCloseTo(-1);
  });

  it('has room for a full lifetime of running, so no mark vanishes early', () => {
    expect(MARK_COUNT).toBeGreaterThanOrEqual(3.5 * MARK_LIFE);
  });

  it('puts each mark on the point it is given, mirrored for a left boot', () => {
    const f = make();
    f.add(at(1, -2), 0, true);
    f.add(at(-0.5, 3), Math.PI / 2, false);
    expect(position(f, 0).x).toBeCloseTo(1);
    expect(position(f, 0).z).toBeCloseTo(-2);
    expect(position(f, 1).x).toBeCloseTo(-0.5);
    expect(position(f, 1).z).toBeCloseTo(3);
    const det = (i) => {
      const m = new THREE.Matrix4();
      f.mesh.getMatrixAt(i, m);
      return m.determinant();
    };
    expect(det(0)).toBeLessThan(0);
    expect(det(1)).toBeGreaterThan(0);
  });

  it('returns where the foot landed', () => {
    const f = make();
    const foot = f.add(at(1, 2), 0, false);
    expect(foot.x).toBeCloseTo(position(f, 0).x);
    expect(foot.z).toBeCloseTo(position(f, 0).z);
  });

  it('sits just above the ground', () => {
    const f = make();
    f.add(at(0, 0), 0, true);
    const y = position(f, 0).y;
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(0.01);
  });
});
