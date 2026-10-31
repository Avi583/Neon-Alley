import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FOOD, FoodShop, foodLabel } from '../src/food-shop.js';
import { NeonFood, neonForm, standPart, onigiriParts, beerParts, sakeParts, sojuParts } from '../src/neon-food.js';

const LOOK_POS_X = -Math.PI / 2; // yaw looking down +x, towards the counter
const spot = (kind, z, index = 0) => ({ face: 2, z, side: 1, kind, rest: 1, form: null, index });
const KINDS = Object.keys(FOOD);

describe('FoodShop', () => {
  it('builds a hidden dish for every kind on sale', () => {
    const shop = new FoodShop(KINDS.map((kind, k) => spot(kind, k * 3)), new THREE.Group());
    for (const item of shop.items) {
      expect(item.group.visible).toBe(false);
      expect(item.group.children.length).toBeGreaterThan(1);
    }
  });

  it('shows the dish where the neon stood, at the height of the surface below', () => {
    const shop = new FoodShop([spot('ramen', -8)], new THREE.Group());
    shop.buy(shop.spots[0]);
    const { group } = shop.items[0];
    expect(group.visible).toBe(true);
    expect(group.position.toArray()).toEqual([2, 1, -8]);
  });

  it('offers the spot closest to the centre of the view, even when another is nearer', () => {
    const shop = new FoodShop([spot('onigiri', -0.5), spot('onigiri', 0.1)], new THREE.Group());
    expect(shop.target(1, 0, LOOK_POS_X)).toBe(shop.spots[1]);
    const toward = Math.atan2(0.5, 1) - Math.PI / 2; // yaw aimed down +x and towards -z
    expect(shop.target(1, 0, toward)).toBe(shop.spots[0]);
  });

  it('sells each spot once, then offers the next', () => {
    const shop = new FoodShop([spot('onigiri', 0), spot('onigiri', 0.4)], new THREE.Group());
    shop.buy(shop.target(1, 0, LOOK_POS_X));
    expect(shop.target(1, 0, LOOK_POS_X)).toBe(shop.spots[1]);
    shop.buy(shop.target(1, 0, LOOK_POS_X));
    expect(shop.target(1, 0, LOOK_POS_X)).toBeNull();
  });

  it('offers nothing out of reach or behind the player', () => {
    const shop = new FoodShop([spot('nigiri', 0)], new THREE.Group());
    expect(shop.target(0, 0, LOOK_POS_X)).toBeNull();
    expect(shop.target(1, 0, -LOOK_POS_X)).toBeNull();
  });

  it('labels food by name and price', () => {
    expect(foodLabel(spot('onigiri', 0))).toBe('BUY ONIGIRI ¥180');
    expect(foodLabel(spot('maki', 0))).toBe('BUY SUSHI ¥240');
    expect(foodLabel(spot('ramen', 0))).toBe('BUY RAMEN ¥980');
    expect(foodLabel(spot('beer', 0))).toBe('BUY BEER ¥600');
    expect(foodLabel(spot('sake', 0))).toBe('BUY SAKE ¥800');
    expect(foodLabel(spot('soju', 0))).toBe('BUY SOJU ¥500');
  });
});

describe('neon drinks', () => {
  const mat = new THREE.MeshBasicMaterial();

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
  it('collapses one copy, its stand included, and leaves the others', () => {
    const mat = new THREE.MeshBasicMaterial();
    const forms = [];
    const form = neonForm(forms, [...onigiriParts(mat, mat, 0.2), standPart(mat, 0.1, 0.08)]);
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
