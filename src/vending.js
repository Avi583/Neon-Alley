// The vending machine's moving parts. Buying turns a random slot's corkscrew, whose
// front can tips off the shelf, falls behind the glass and lands in the pickup bin.
// Slots are picked with Math.random, so the seeded world layout never changes.
import * as THREE from 'three';
import { CAN_FLAVOURS } from './canvas-art.js';

const REACH = 1.6, FACING = 0.6;
export const VEND_TURN = 0.9; // seconds for one turn of a corkscrew
const CAN_Y = 0.075, COIL_Y = 0.056, COIL_R = 0.05, COIL_TUBE = 0.004;
const SHELF_EDGE = 0.19, SHELF_BACK = 0.45; // depths into the cabinet from its face
const FRONT = 0.25, PITCH = 0.1; // one turn moves the cans along by one pitch
const STOCK = 4; // per slot. The last sits behind the back wall, ready to come through it.
const CHANNEL = 0.11, FALL_TO = 0.63, FALL_GRAVITY = 7, TUMBLE = 25; // TUMBLE in rad/s²
const DROP_DELAY = 0.2, DROP_FROM = 0.3, REST_Y = 0.142, GRAVITY = 5;
const FLAP_OPEN = -1.45, FLAP_CLOSED = -0.22;
const BIN_SLOTS = [-0.16, 0, 0.16]; // along the bin, relative to the machine's centre

const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(1, 1, 1);
const turned = new THREE.Quaternion(), X_AXIS = new THREE.Vector3(1, 0, 0);

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

// A helix around the x axis. Turning it by a positive angle about x moves whatever sits
// in it towards the front of the shelf, on either side of the alley.
function coilGeometry(side) {
  const length = SHELF_BACK - SHELF_EDGE, points = [];
  for (let k = 0; k <= 32; k++) {
    const depth = SHELF_EDGE + length * k / 32, a = Math.PI * 2 * depth / PITCH;
    points.push(new THREE.Vector3(side * depth, COIL_R * Math.cos(a), COIL_R * Math.sin(a)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 42, COIL_TUBE, 5, false);
}

function smoothstep(k) { return k * k * (3 - 2 * k); }

export class Vending {
  constructor(spot, mats, parent, rng = Math.random) {
    this.spot = spot;
    this.rng = rng;
    this.job = null; // the purchase in progress, from the coil turning until the can leaves the channel
    this.onLand = null; // called as a can reaches the bottom of the bin
    this.sold = 0;
    this.labelTurn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spot.side * Math.PI / 2);
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
    const makeCan = () => {
      const group = new THREE.Group();
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
      return { group, body };
    };
    // One can per bin slot. The newest replaces the oldest once the bin is full.
    this.cans = BIN_SLOTS.map((dz) => {
      const can = makeCan();
      can.group.position.set(x, REST_Y, spot.z + dz);
      can.group.rotation.x = Math.PI / 2; // lying along the bin
      return { ...can, delay: 0, fall: 0, speed: 0 };
    });
    this.falling = makeCan();
    this.bodies = bodies;

    // Shelf stock and coils, instanced so the 24 slots stay cheap to draw
    this.slots = spot.slots.map((slot) => ({ ...slot }));
    const counts = new Array(CAN_FLAVOURS).fill(0);
    this.slots.forEach((slot, s) => {
      slot.index = s;
      slot.first = counts[slot.flavour];
      counts[slot.flavour] += STOCK;
    });
    this.stock = bodies.map((g, cell) => new THREE.InstancedMesh(g, mats.vendingCans, counts[cell]));
    this.stockCaps = new THREE.InstancedMesh(capGeo, mats.metalLight, this.slots.length * STOCK);
    this.coils = new THREE.InstancedMesh(coilGeometry(spot.side), mats.metalLight, this.slots.length);
    for (const mesh of [...this.stock, this.stockCaps, this.coils]) parent.add(mesh);
    for (const slot of this.slots) this.poseSlot(slot, 0);
  }

  // Places a slot's coil and cans, with turn running from 0 to 1 over one purchase.
  poseSlot(slot, turn) {
    const { face, side } = this.spot;
    for (let k = 0; k < STOCK; k++) {
      position.set(face + side * (FRONT + (k - turn) * PITCH), slot.base + CAN_Y, slot.z);
      this.stock[slot.flavour].setMatrixAt(slot.first + k, matrix.compose(position, this.labelTurn, scale));
      position.y = slot.base + CAN_Y + 0.077;
      this.stockCaps.setMatrixAt(slot.index * STOCK + k, matrix.makeTranslation(position));
    }
    position.set(face, slot.base + COIL_Y, slot.z);
    turned.setFromAxisAngle(X_AXIS, turn * Math.PI * 2);
    this.coils.setMatrixAt(slot.index, matrix.compose(position, turned, scale));
    this.stock[slot.flavour].instanceMatrix.needsUpdate = true;
    this.stockCaps.instanceMatrix.needsUpdate = true;
    this.coils.instanceMatrix.needsUpdate = true;
  }

  // Returns true if a can was bought.
  buy() {
    if (this.job) return false;
    this.job = { slot: this.slots[Math.floor(this.rng() * this.slots.length)], time: 0, falling: false, speed: 0, spin: 0, angle: 0 };
    return true;
  }

  // The front can leaves the coil as a separate object, and the stock steps back into place.
  release(job) {
    const { face, side } = this.spot;
    this.poseSlot(job.slot, 0);
    this.falling.body.geometry = this.bodies[job.slot.flavour];
    this.falling.group.position.set(face + side * (FRONT - PITCH), job.slot.base + CAN_Y, job.slot.z);
    this.falling.group.rotation.z = 0;
    this.falling.group.visible = true;
    job.falling = true;
  }

  // Tips over the shelf edge and tumbles down the channel, out of sight through the hatch.
  fall(job, dt) {
    const { face, side } = this.spot, group = this.falling.group;
    job.speed += FALL_GRAVITY * dt;
    job.spin += TUMBLE * dt;
    job.angle += job.spin * dt;
    group.position.y -= job.speed * dt;
    group.position.x += (face + side * CHANNEL - group.position.x) * (1 - Math.exp(-dt * 12));
    group.rotation.z = side * job.angle;
    if (group.position.y > FALL_TO) return;
    group.visible = false;
    this.job = null;
    // Inside the base, then into the bin behind the flap
    const can = this.cans[this.sold++ % this.cans.length];
    can.body.geometry = this.bodies[job.slot.flavour];
    can.group.visible = false;
    can.delay = DROP_DELAY;
    can.fall = DROP_FROM - REST_Y;
    can.speed = 0;
    can.group.position.y = DROP_FROM;
    this.flapOpen = true;
  }

  update(dt) {
    const job = this.job;
    if (job && job.falling) {
      this.fall(job, dt);
    } else if (job) {
      job.time += dt;
      if (job.time < VEND_TURN) this.poseSlot(job.slot, smoothstep(job.time / VEND_TURN));
      else this.release(job);
    }
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
        if (can.fall === 0 && this.onLand) this.onLand();
      }
    }
  }
}
