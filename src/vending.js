// The vending machine's pickup bin: buying drops a random can in and swings the
// flap open. Cans use Math.random, so the seeded world layout never changes.
import * as THREE from 'three';
import { CAN_FLAVOURS } from './canvas-art.js';

const REACH = 1.6, FACING = 0.6, COOLDOWN = 1.2;
const DROP_DELAY = 0.3, DROP_FROM = 0.3, REST_Y = 0.142, GRAVITY = 5;
const FLAP_OPEN = -1.45, FLAP_CLOSED = -0.22;
const SLOTS = [-0.16, 0, 0.16]; // along the bin, relative to the machine's centre

// Close enough to the machine and looking towards it? yaw 0 looks down -z, as in player.js.
export function inReach(spot, x, z, yaw) {
  const dx = spot.face - x, dz = spot.z - z, dist = Math.hypot(dx, dz);
  if (dist > REACH) return false;
  return dist === 0 || (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / dist > FACING;
}

function canGeometry(cell) {
  const g = new THREE.CylinderGeometry(0.042, 0.042, 0.15, 16, 1, true), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (cell + uv.getX(i)) / CAN_FLAVOURS);
  return g;
}

export class Vending {
  constructor(spot, mats, parent, rng = Math.random) {
    this.spot = spot;
    this.rng = rng;
    this.cooldown = 0;
    this.sold = 0;
    const x = spot.face + spot.side * 0.045; // at the front of the bin, in view from standing height

    // Hinged along the top of the opening. It swings inwards and up, so it can't hide the cans.
    this.flap = new THREE.Group();
    this.flap.position.set(spot.face + spot.side * 0.02, 0.24, spot.z);
    this.flap.rotation.z = -spot.side * FLAP_CLOSED;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.13, 0.48), mats.metalDark);
    plate.position.y = -0.065;
    this.flap.add(plate);
    parent.add(this.flap);
    this.flapOpen = false;
    this.flapAngle = FLAP_CLOSED;

    const bodies = Array.from({ length: CAN_FLAVOURS }, (_, cell) => canGeometry(cell));
    const capGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.004, 12);
    // One can per slot. The newest replaces the oldest once the bin is full.
    this.cans = SLOTS.map((dz) => {
      const group = new THREE.Group();
      group.position.set(x, REST_Y, spot.z + dz);
      group.rotation.x = Math.PI / 2; // lying along the bin
      group.visible = false;
      const body = new THREE.Mesh(bodies[0], mats.vendingCans);
      body.rotation.y = spot.side * Math.PI / 2; // label towards the alley
      group.add(body);
      for (const e of [-1, 1]) {
        const cap = new THREE.Mesh(capGeo, mats.metalLight);
        cap.position.y = e * 0.076;
        group.add(cap);
      }
      parent.add(group);
      return { group, body, delay: 0, fall: 0, speed: 0 };
    });
    this.bodies = bodies;
  }

  // Returns true if a can was bought.
  buy() {
    if (this.cooldown > 0) return false;
    this.cooldown = COOLDOWN;
    const can = this.cans[this.sold++ % this.cans.length];
    can.body.geometry = this.bodies[Math.floor(this.rng() * CAN_FLAVOURS)];
    can.group.visible = false;
    can.delay = DROP_DELAY;
    can.fall = DROP_FROM - REST_Y;
    can.speed = 0;
    this.flapOpen = true;
    return true;
  }

  update(dt) {
    this.cooldown = Math.max(this.cooldown - dt, 0);
    const target = this.flapOpen ? FLAP_OPEN : FLAP_CLOSED;
    this.flapAngle += (target - this.flapAngle) * (1 - Math.exp(-dt * 10));
    this.flap.rotation.z = -this.spot.side * this.flapAngle;
    for (const can of this.cans) {
      if (can.delay > 0) {
        can.delay -= dt;
        if (can.delay <= 0) can.group.visible = true;
        else continue;
      }
      if (can.fall > 0) {
        can.speed += GRAVITY * dt;
        can.fall = Math.max(can.fall - can.speed * dt, 0);
        can.group.position.y = REST_Y + can.fall;
      }
    }
  }
}
