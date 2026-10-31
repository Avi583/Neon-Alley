// Buying food at the shops: the neon copy goes and a solid dish takes its place on
// the counter. Each spot sells once. The dishes are built hidden at load, so a
// purchase needs no new geometry, and nothing here touches the kit's rng.
import * as THREE from 'three';
import { inReach } from './vending.js';

export const FOOD = {
  onigiri: { name: 'ONIGIRI', price: 180 },
  nigiri: { name: 'SUSHI', price: 240 },
  maki: { name: 'SUSHI', price: 240 },
  ramen: { name: 'RAMEN', price: 980 },
  beer: { name: 'BEER', price: 600 },
  sake: { name: 'SAKE', price: 800 },
  soju: { name: 'SOJU', price: 500 },
};

export const foodLabel = (spot) => `BUY ${FOOD[spot.kind].name} ¥${FOOD[spot.kind].price}`;

// A little self-glow, or the food is lost in the dark, as with wood in materials.js.
const food = (color, roughness = 0.75) => new THREE.MeshStandardMaterial({ color, roughness, emissive: color, emissiveIntensity: 0.25 });

function ball(rx, ry, rz, y, z = 0) {
  return new THREE.SphereGeometry(1, 16, 10).scale(rx, ry, rz).translate(0, y, z);
}

function onigiriDish() {
  const w = 0.07, h = 0.12;
  const shape = new THREE.Shape();
  shape.moveTo(-w * 0.25, h * 0.8);
  shape.quadraticCurveTo(0, h, w * 0.25, h * 0.8);
  shape.lineTo(w, h * 0.16);
  shape.quadraticCurveTo(w * 1.1, 0, w * 0.8, 0);
  shape.lineTo(-w * 0.8, 0);
  shape.quadraticCurveTo(-w * 1.1, 0, -w, h * 0.16);
  shape.closePath();
  const rice = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 3, curveSegments: 8 });
  rice.translate(0, 0.012, -0.02);
  return [
    [rice, food(0xf4efe2)],
    [new THREE.BoxGeometry(0.058, 0.066, 0.07).translate(0, 0.033, 0), food(0x14241c, 0.55)],
  ];
}

function nigiriDish() {
  return [
    [ball(0.033, 0.026, 0.06, 0.026), food(0xf4efe2)],
    [ball(0.04, 0.012, 0.072, 0.054), food(0xf0704c, 0.4)],
  ];
}

function makiDish() {
  const parts = [[], [], []];
  for (const z of [-0.04, 0.04]) {
    parts[0].push(new THREE.CylinderGeometry(0.036, 0.036, 0.05, 16).translate(0, 0.025, z));
    parts[1].push(new THREE.CylinderGeometry(0.03, 0.03, 0.002, 16).translate(0, 0.051, z));
    parts[2].push(new THREE.CylinderGeometry(0.011, 0.011, 0.003, 10).translate(0, 0.052, z));
  }
  return [food(0x14241c, 0.55), food(0xf4efe2), food(0xf0704c, 0.4)].flatMap((mat, k) => parts[k].map((g) => [g, mat]));
}

function ramenDish() {
  // Up the outside from the foot, over the rim and back down the inside.
  const profile = [[0, 0], [0.05, 0], [0.052, 0.012], [0.09, 0.05], [0.12, 0.11], [0.112, 0.11], [0.08, 0.055], [0, 0.03]];
  const bowl = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 24);
  const noodles = [0.03, 0.055, 0.08].map((r, k) => new THREE.TorusGeometry(r, 0.006, 6, 24).rotateX(Math.PI / 2).translate(0, 0.098 + k * 0.001, 0));
  const noodle = food(0xe8c25a, 0.5);
  const chopstick = food(0x6a3a20, 0.5);
  return [
    [bowl, Object.assign(food(0xa81e24, 0.3), { side: THREE.DoubleSide })],
    [new THREE.CircleGeometry(0.108, 24).rotateX(-Math.PI / 2).translate(0, 0.096, 0), food(0xb87a34, 0.2)],
    ...noodles.map((g) => [g, noodle]),
    [ball(0.024, 0.012, 0.024, 0.104, 0.045), food(0xf6f0e0, 0.4)], // half an egg
    [ball(0.011, 0.005, 0.011, 0.114, 0.045), food(0xf0a020, 0.4)],
    [new THREE.BoxGeometry(0.05, 0.004, 0.06).translate(0.04, 0.105, -0.04), food(0xb07a60)], // pork
    [new THREE.BoxGeometry(0.004, 0.06, 0.05).translate(-0.085, 0.13, 0), food(0x14241c, 0.55)], // nori
    ...[-0.012, 0.012].map((d) => [new THREE.CylinderGeometry(0.0035, 0.0035, 0.27, 6).rotateX(Math.PI / 2).translate(-0.02 + d, 0.122, 0), chopstick]),
  ];
}

// A lathe from [radius, up] points, up the outside from the foot.
function turned(profile, z = 0) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 20).translate(0, 0, z);
}

const double = (mat) => Object.assign(mat, { side: THREE.DoubleSide });

function beerDish() {
  return [
    [new THREE.CylinderGeometry(0.052, 0.048, 0.14, 20).translate(0, 0.075, 0), food(0xd98a1c, 0.25)],
    [new THREE.CylinderGeometry(0.052, 0.052, 0.01, 20).translate(0, 0.005, 0), food(0xc8d8d8, 0.15)],
    [ball(0.054, 0.026, 0.054, 0.15), food(0xfff6e0, 0.9)],
    [new THREE.TorusGeometry(0.032, 0.008, 8, 16, Math.PI).rotateZ(-Math.PI / 2).rotateY(-Math.PI / 2).translate(0, 0.08, 0.052), food(0xc8d8d8, 0.15)],
  ];
}

function sakeDish() {
  const flask = [[0, 0], [0.05, 0], [0.07, 0.06], [0.068, 0.12], [0.028, 0.175], [0.024, 0.21], [0.04, 0.235]];
  const cup = [[0, 0], [0.018, 0], [0.04, 0.04], [0.036, 0.04], [0.014, 0.008]];
  return [
    [turned(flask, -0.05), double(food(0xe8ecf0, 0.35))],
    [new THREE.CylinderGeometry(0.0705, 0.0705, 0.012, 20, 1, true).translate(0, 0.1, -0.05), double(food(0x204a8c, 0.35))],
    [turned(cup, 0.08), double(food(0xe8ecf0, 0.35))],
    [new THREE.CircleGeometry(0.03, 16).rotateX(-Math.PI / 2).translate(0, 0.03, 0.08), food(0xf0e8c8, 0.1)],
  ];
}

function sojuDish() {
  const bottle = [[0, 0], [0.034, 0], [0.036, 0.008], [0.036, 0.13], [0.014, 0.18], [0.014, 0.225]];
  const glass = [[0, 0], [0.02, 0], [0.028, 0.05], [0.025, 0.05], [0.018, 0.006]];
  return [
    [turned(bottle, -0.04), double(food(0x1f9a5c, 0.12))],
    [new THREE.CylinderGeometry(0.0375, 0.0375, 0.055, 20, 1, true).translate(0, 0.075, -0.04), double(food(0xe8f4ec, 0.6))],
    [new THREE.CylinderGeometry(0.0155, 0.0155, 0.022, 12).translate(0, 0.232, -0.04), food(0x2e7d4f, 0.3)],
    [turned(glass, 0.07), double(food(0xd4ecdf, 0.1))],
    [new THREE.CircleGeometry(0.023, 16).rotateX(-Math.PI / 2).translate(0, 0.036, 0.07), food(0xf4faf6, 0.1)],
  ];
}

const DISHES = { onigiri: onigiriDish, nigiri: nigiriDish, maki: makiDish, ramen: ramenDish, beer: beerDish, sake: sakeDish, soju: sojuDish };

export class FoodShop {
  constructor(spots, parent) {
    this.spots = spots;
    const dishes = {};
    this.items = spots.map((spot) => {
      dishes[spot.kind] ??= DISHES[spot.kind]();
      const group = new THREE.Group();
      group.position.set(spot.face, spot.rest, spot.z);
      if (spot.kind === 'onigiri') group.rotation.y = -spot.side * Math.PI / 2; // front towards the alley
      group.visible = false;
      for (const [geo, mat] of dishes[spot.kind]) group.add(new THREE.Mesh(geo, mat));
      parent.add(group);
      return { spot, group, sold: false };
    });
  }

  // The unsold spot in reach that's closest to the centre of the view, or null.
  target(x, z, yaw) {
    let best = null, bestFacing = -Infinity;
    for (const { spot, sold } of this.items) {
      if (sold || !inReach(spot, x, z, yaw)) continue;
      const dx = spot.face - x, dz = spot.z - z;
      const facing = (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / (Math.hypot(dx, dz) || 1);
      if (facing > bestFacing) { best = spot; bestFacing = facing; }
    }
    return best;
  }

  buy(spot) {
    const item = this.items.find((it) => it.spot === spot);
    item.sold = true;
    item.group.visible = true;
  }
}
