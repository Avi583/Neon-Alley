import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { NeonFood, neonForm, beerParts, bowlParts, fishParts, makiParts, nigiriParts, onigiriParts, sakeParts, sojuParts } from '../src/neon-food.js';

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

  it('turns and bobs each copy without moving it sideways', () => {
    const { food, mesh } = build();
    const before = matrixAt(mesh, 0).clone();
    const heights = new Set();
    for (const t of [0, 1, 2, 3]) {
      food.update(t);
      const pos = new THREE.Vector3().setFromMatrixPosition(matrixAt(mesh, 0));
      expect(pos.x).toBe(SPOTS[0][0]);
      expect(pos.z).toBe(SPOTS[0][2]);
      expect(Math.abs(pos.y - SPOTS[0][1])).toBeLessThanOrEqual(0.015 + 1e-6);
      heights.add(pos.y);
    }
    expect(matrixAt(mesh, 0).equals(before)).toBe(false);
    expect(heights.size).toBeGreaterThan(1);
  });

  it('keeps a form on a wire at its height', () => {
    const forms = [];
    neonForm(forms, fishParts(mat, 0.15, true), false).spots.push(...SPOTS);
    const food = new NeonFood(forms, new THREE.Group());
    food.update(3);
    const pos = new THREE.Vector3().setFromMatrixPosition(matrixAt(food.forms[0].meshes[0], 0));
    expect(pos.toArray()).toEqual(SPOTS[0]);
  });

  it('starts neighbours at different angles', () => {
    const { mesh } = build();
    expect(matrixAt(mesh, 0).elements[0]).not.toBeCloseTo(matrixAt(mesh, 1).elements[0]);
  });
});

describe('neon drinks', () => {
  it.each([
    ['beer', beerParts],
    ['sake', sakeParts],
    ['soju', sojuParts],
  ])('builds %s as one instanced form that clears the back wall as it turns', (_, parts) => {
    const forms = [];
    neonForm(forms, parts(mat, mat, 0.16)).spots.push([0, 0, 0]);
    const { meshes } = new NeonFood(forms, new THREE.Group()).forms[0];
    expect(meshes).toHaveLength(2);
    for (const mesh of meshes) {
      mesh.geometry.computeBoundingBox();
      const { min, max } = mesh.geometry.boundingBox;
      const reach = Math.max(Math.hypot(min.x, min.z), Math.hypot(max.x, max.z));
      expect(reach).toBeLessThan(0.25); // the form's centre stands 0.65 m out, the wall is 0.4 m out
    }
  });
});

describe('NeonFood.hide', () => {
  it('collapses one copy and leaves the others', () => {
    const forms = [];
    const form = neonForm(forms, onigiriParts(mat, mat, 0.2));
    form.spots.push([1, 2, 3], [4, 5, 6]);
    const food = new NeonFood(forms, new THREE.Group());
    food.hide(form, 0);
    food.update(1);
    const m = new THREE.Matrix4();
    for (const mesh of food.forms[0].meshes) {
      mesh.getMatrixAt(0, m);
      expect(m.determinant()).toBeCloseTo(0);
      mesh.getMatrixAt(1, m);
      expect(m.determinant()).toBeCloseTo(1);
    }
  });
});
