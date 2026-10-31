import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Vending, VEND_TURN, inReach } from '../src/vending.js';

const SLOTS = [0, 1, 2, 3, 4, 5].map((flavour) => ({ z: -26.5 + flavour * 0.125, base: 0.745 + flavour * 0.1, flavour }));
const SPOT = { face: 2.0, z: -26.5, side: 1, slots: SLOTS };
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
  it('turns the coil, drops the front can down the channel and rests it in the bin', () => {
    const v = make(() => 0), can = v.cans[0];
    expect(v.buy()).toBe(true);
    run(v, VEND_TURN / 2);
    expect(v.falling.group.visible).toBe(false);
    expect(can.group.visible).toBe(false);
    run(v, VEND_TURN / 2 + 0.1);
    expect(v.falling.group.visible).toBe(true);
    expect(v.falling.group.position.y).toBeLessThan(SLOTS[0].base + 0.075 + 0.001);
    run(v, 2);
    expect(v.falling.group.visible).toBe(false);
    expect(can.group.visible).toBe(true);
    expect(can.group.position.y).toBeCloseTo(0.142);
  });

  it('moves the slot\'s cans forward with the coil, then steps them back', () => {
    const v = make(() => 0), depth = () => {
      const m = new THREE.Matrix4();
      v.stock[SLOTS[0].flavour].getMatrixAt(v.slots[0].first, m);
      return new THREE.Vector3().setFromMatrixPosition(m).x;
    }, rest = depth();
    v.buy();
    run(v, VEND_TURN * 0.9);
    expect(depth()).toBeLessThan(rest); // towards the glass, as side is 1
    run(v, 2);
    expect(depth()).toBeCloseTo(rest);
  });

  it('sits the coil around the cans, and its thread travels with them', () => {
    const v = make(() => 0), slot = v.slots[0];
    // Mean depth of the middle thread where it crosses the top of the coil
    const threadDepth = () => {
      const m = new THREE.Matrix4(), p = new THREE.Vector3(), pos = v.coils.geometry.attributes.position;
      v.coils.getMatrixAt(0, m);
      let sum = 0, n = 0;
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i).applyMatrix4(m);
        const depth = p.x - SPOT.face;
        if (p.y > slot.base + 0.056 && Math.abs(p.z - slot.z) < 0.012 && depth > 0.25 && depth < 0.34) { sum += depth; n++; }
      }
      return sum / n;
    };
    const rest = threadDepth();
    expect(rest).toBeCloseTo(0.3, 1);
    v.buy();
    run(v, VEND_TURN * 0.25);
    expect(threadDepth()).toBeLessThan(rest);
  });

  it('gives the can from the chosen slot', () => {
    const v = make(() => 0.99), last = SLOTS[SLOTS.length - 1];
    v.buy();
    run(v, 3);
    expect(v.cans[0].body.geometry).toBe(v.bodies[last.flavour]);
  });

  it('ignores presses until the can has left the channel', () => {
    const v = make(() => 0);
    expect(v.buy()).toBe(true);
    expect(v.buy()).toBe(false);
    run(v, 3);
    expect(v.buy()).toBe(true);
  });

  it('replaces the oldest can once the bin is full', () => {
    const picks = [0, 1, 2, 3].map((s) => s / SLOTS.length);
    const v = make(() => picks.shift());
    for (let k = 0; k < 4; k++) { v.buy(); run(v, 3); }
    expect(v.cans.filter((c) => c.group.visible)).toHaveLength(3);
    expect(v.cans[0].body.geometry).toBe(v.bodies[3]);
    expect(v.cans[1].body.geometry).toBe(v.bodies[1]);
  });

  it('calls onLand once per can, and opens the flap', () => {
    const v = make(() => 0), closed = v.flap.rotation.z;
    let lands = 0;
    v.onLand = () => lands++;
    v.buy();
    run(v, 3);
    expect(lands).toBe(1);
    expect(v.flap.rotation.z).not.toBeCloseTo(closed);
  });
});
