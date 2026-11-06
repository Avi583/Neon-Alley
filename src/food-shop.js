// Buying food at the shops: the neon copy goes, a metal hatch under it slides open
// and a round base lifts a solid dish up through the counter. Each spot sells once.
// The dishes are built hidden at load, so a purchase needs no new geometry, and
// nothing here touches the kit's rng.
import * as THREE from 'three';
import { inReach, sstep } from './math.js';
import { DISHES } from './food-dishes.js';
import { FOOD } from './items.js';

const OPEN_TIME = 0.4, RISE_TIME = 1; // seconds
export const FOOD_LIFT = OPEN_TIME + RISE_TIME;
const BASE_H = 0.016, BASE_R = 0.94, COLLAR_H = 0.012, COLLAR_R = 1.08; // radii as a share of the hatch's
const WELL_Y = 0.002, LEAF_Y = 0.004, LEAF_H = 0.006;
const BOUNDS_MARGIN = 0.3; // the bounding spheres are measured once, but the hatches keep moving

const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3();
const facing = new THREE.Quaternion(), behind = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

// A half disc of unit radius on the -z side, with its straight edge along the x axis.
function leafGeometry() {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 1, 0, Math.PI, false);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: LEAF_H, bevelEnabled: false, curveSegments: 16 }).rotateX(-Math.PI / 2);
}

// One kind's dish on its base, with the depth that hides it all below the surface.
// The clip stops it showing through the sides of a riser narrower than the hatch.
// Each kind sits at one height, so its plane never has to move.
function liftKit(kind, rest, baseMat) {
  const clip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -rest)];
  const parts = DISHES[kind]();
  // Parts painted alike share one material.
  const shared = new Map();
  for (const part of parts) {
    const m = part[1], key = `${m.color.getHex()}:${m.roughness}:${m.side}`;
    if (shared.has(key)) part[1] = shared.get(key);
    else shared.set(key, m);
  }
  let top = 0;
  for (const [geo, mat] of parts) {
    geo.computeBoundingBox();
    top = Math.max(top, geo.boundingBox.max.y);
    mat.clippingPlanes = clip;
  }
  const r = FOOD[kind].radius * BASE_R;
  return {
    parts,
    base: new THREE.CylinderGeometry(r, r, BASE_H, 28).translate(0, BASE_H / 2, 0),
    baseMat: Object.assign(baseMat.clone(), { clippingPlanes: clip }),
    depth: BASE_H + top,
  };
}

export class FoodShop {
  constructor(spots, mats, parent) {
    this.spots = spots;
    this.onLand = null; // called as a base reaches the top
    const kits = {};
    this.items = spots.map((spot) => {
      const kit = kits[spot.kind] ??= liftKit(spot.kind, spot.rest, mats.metalLight);
      const group = new THREE.Group();
      group.position.set(spot.face, spot.rest - kit.depth, spot.z);
      if (spot.kind === 'onigiri') group.rotation.y = -spot.side * Math.PI / 2; // front towards the alley
      group.visible = false;
      group.add(new THREE.Mesh(kit.base, kit.baseMat));
      for (const [geo, mat] of kit.parts) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = BASE_H;
        group.add(mesh);
      }
      parent.add(group);
      return { spot, group, depth: kit.depth, sold: false, taken: false, time: 0 };
    });

    // The hatches show all the time, so they're instanced to stay cheap to draw.
    const collar = new THREE.LatheGeometry([[COLLAR_R, 0], [COLLAR_R, COLLAR_H], [1, COLLAR_H], [1, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
    const well = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2).translate(0, WELL_Y, 0);
    this.collars = new THREE.InstancedMesh(collar, mats.metal, spots.length);
    this.wells = new THREE.InstancedMesh(well, new THREE.MeshBasicMaterial({ color: 0x050506 }), spots.length);
    this.leaves = new THREE.InstancedMesh(leafGeometry(), mats.metalLight, spots.length * 2);
    this.leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.items.forEach((item, i) => {
      const { face, rest, z, kind } = item.spot, r = FOOD[kind].radius;
      matrix.makeScale(r, 1, r).setPosition(face, rest, z);
      this.collars.setMatrixAt(i, matrix);
      this.wells.setMatrixAt(i, matrix);
      item.index = i;
      this.poseLeaves(item, 0);
    });
    for (const mesh of [this.collars, this.wells, this.leaves]) {
      mesh.computeBoundingSphere();
      mesh.boundingSphere.radius += BOUNDS_MARGIN;
      parent.add(mesh);
    }
  }

  // Slides a hatch's two halves along the counter, with open running from 0 to 1.
  poseLeaves({ spot, index }, open) {
    const r = FOOD[spot.kind].radius;
    scale.set(r, 1, r);
    for (const e of [0, 1]) {
      position.set(spot.face, spot.rest + LEAF_Y, spot.z + (e ? 1 : -1) * open * r);
      this.leaves.setMatrixAt(index * 2 + e, matrix.compose(position, e ? behind : facing, scale));
    }
    this.leaves.instanceMatrix.needsUpdate = true;
  }

  // The spot in reach that's closest to the centre of the view among those that pass test, or null.
  nearest(x, z, yaw, test) {
    let best = null, bestFacing = -Infinity;
    for (const item of this.items) {
      const { spot } = item;
      if (!test(item) || !inReach(spot, x, z, yaw)) continue;
      const dx = spot.face - x, dz = spot.z - z;
      const facing = (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / (Math.hypot(dx, dz) || 1);
      if (facing > bestFacing) { best = spot; bestFacing = facing; }
    }
    return best;
  }

  // The unsold spot in reach that's closest to the centre of the view, or null.
  target(x, z, yaw) {
    return this.nearest(x, z, yaw, (it) => !it.sold);
  }

  // A bought dish that has finished rising and is still on the counter, or null.
  takeTarget(x, z, yaw) {
    return this.nearest(x, z, yaw, (it) => it.sold && !it.taken && it.time >= FOOD_LIFT);
  }

  buy(spot) {
    this.items.find((it) => it.spot === spot).sold = true;
  }

  // Lifts the dish off the counter and shuts the hatch behind it. Returns its FOOD entry, or null.
  take(spot) {
    const item = this.items.find((it) => it.spot === spot);
    if (!item || !item.sold || item.taken || item.time < FOOD_LIFT) return null;
    item.taken = true;
    item.group.visible = false;
    this.poseLeaves(item, 0);
    return FOOD[spot.kind];
  }

  update(dt) {
    for (const item of this.items) {
      if (!item.sold || item.time >= FOOD_LIFT) continue;
      item.time = Math.min(item.time + dt, FOOD_LIFT);
      this.poseLeaves(item, sstep(0, OPEN_TIME, item.time));
      if (item.time >= OPEN_TIME) {
        item.group.visible = true;
        item.group.position.y = item.spot.rest - item.depth * (1 - sstep(OPEN_TIME, FOOD_LIFT, item.time));
      }
      if (item.time >= FOOD_LIFT && this.onLand) this.onLand();
    }
  }
}
