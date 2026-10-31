import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Vending, inReach } from '../src/vending.js';
import { CAN_FLAVOURS } from '../src/canvas-art.js';

const SPOT = { face: 2.0, z: -26.5, side: 1 };
const LOOK_POS_X = -Math.PI / 2; // yaw looking down +x, towards the machine
const mats = { metalDark: new THREE.MeshBasicMaterial(), metalLight: new THREE.MeshBasicMaterial(), vendingCans: new THREE.MeshBasicMaterial() };
const make = (rng) => new Vending(SPOT, mats, new THREE.Group(), rng);
const run = (v, seconds) => { for (let t = 0; t < seconds; t += 0.05) v.update(0.05); };

describe('inReach', () => {
  it('is true close to the machine and facing it', () => {
    expect(inReach(SPOT, 1.0, -26.5, LOOK_POS_X)).toBe(true);
  });
  it('is false when looking away', () => {
    expect(inReach(SPOT, 1.0, -26.5, Math.PI / 2)).toBe(false);
  });
  it('is false when too far away', () => {
    expect(inReach(SPOT, 0, -26.5, LOOK_POS_X)).toBe(false);
  });
});

describe('Vending', () => {
  it('drops a can after a delay and rests it in the bin', () => {
    const v = make(() => 0), can = v.cans[0];
    expect(v.buy()).toBe(true);
    expect(can.group.visible).toBe(false);
    run(v, 2);
    expect(can.group.visible).toBe(true);
    expect(can.group.position.y).toBeCloseTo(0.142);
  });

  it('ignores presses during the cooldown', () => {
    const v = make(() => 0);
    expect(v.buy()).toBe(true);
    expect(v.buy()).toBe(false);
    run(v, 2);
    expect(v.buy()).toBe(true);
  });

  it('replaces the oldest can once the bin is full', () => {
    const picks = [0, 1 / CAN_FLAVOURS, 2 / CAN_FLAVOURS, 3 / CAN_FLAVOURS];
    const v = make(() => picks.shift());
    for (let k = 0; k < 4; k++) { v.buy(); run(v, 2); }
    expect(v.cans.filter((c) => c.group.visible)).toHaveLength(3);
    expect(v.cans[0].body.geometry).toBe(v.bodies[3]);
    expect(v.cans[1].body.geometry).toBe(v.bodies[1]);
  });

  it('opens the flap on the first buy', () => {
    const v = make(() => 0), closed = v.flap.rotation.z;
    v.buy();
    run(v, 1);
    expect(v.flap.rotation.z).not.toBeCloseTo(closed);
  });
});
