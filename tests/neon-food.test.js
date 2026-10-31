import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { NeonFood, neonForm, bowlParts, fishParts, makiParts, nigiriParts, onigiriParts } from '../src/neon-food.js';

const mat = new THREE.MeshBasicMaterial();
const SPOTS = [[1, 2, 3], [-4, 1, -8]];

function build(parts = fishParts(mat, 0.24)) {
  const forms = [];
  neonForm(forms, parts).spots.push(...SPOTS);
  const food = new NeonFood(forms, new THREE.Group());
  return { food, mesh: food.forms[0].meshes[0] };
}

const matrixAt = (mesh, i) => {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(i, m);
  return m;
};

describe('NeonFood', () => {
  it('builds every form with real depth', () => {
    const forms = [fishParts(mat, 0.2), fishParts(mat, 0.2, true), onigiriParts(mat, mat, 0.2), nigiriParts(mat, mat, 0.2), makiParts(mat, mat, mat, 0.2), bowlParts(mat, mat, mat, 0.2)];
    for (const parts of forms) {
      const { food } = build(parts);
      const box = new THREE.Box3();
      for (const m of food.forms[0].meshes) {
        m.geometry.computeBoundingBox();
        box.union(m.geometry.boundingBox);
      }
      expect(box.max.x - box.min.x).toBeGreaterThan(0.03);
      expect(box.max.z - box.min.z).toBeGreaterThan(0.03);
    }
  });

  it('turns each copy without moving it', () => {
    const { food, mesh } = build();
    const before = matrixAt(mesh, 0).clone();
    food.update(3);
    const after = matrixAt(mesh, 0);
    expect(after.equals(before)).toBe(false);
    expect(new THREE.Vector3().setFromMatrixPosition(after).toArray()).toEqual(SPOTS[0]);
  });

  it('starts neighbours at different angles', () => {
    const { mesh } = build();
    expect(matrixAt(mesh, 0).elements[0]).not.toBeCloseTo(matrixAt(mesh, 1).elements[0]);
  });
});
