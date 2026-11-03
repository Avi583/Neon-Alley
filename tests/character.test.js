import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Character, HEAD_LAYER } from '../src/character.js';

function makeWalker(over = {}) {
  return { pos: new THREE.Vector2(), vel: new THREE.Vector2(), yaw: 0, pitch: 0, bob: 0, lastStep: 0, view: 'third', ...over };
}

function make() {
  const scene = new THREE.Scene();
  return { scene, character: new Character(scene) };
}

describe('model', () => {
  it('adds itself to the scene with two arms and two legs', () => {
    const { scene, character } = make();
    expect(scene.children).toContain(character.root);
    expect(character.arms).toHaveLength(2);
    expect(character.legs).toHaveLength(2);
    for (const { shoulder, elbow } of character.arms) expect(shoulder.children).toContain(elbow);
    for (const { hip, knee } of character.legs) expect(hip.children).toContain(knee);
  });

  it('stands on the ground, about 1.8 m tall', () => {
    const { character } = make();
    character.update(0, makeWalker());
    character.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(character.root);
    expect(box.min.y).toBeGreaterThan(-0.02);
    expect(box.min.y).toBeLessThan(0.02);
    expect(box.max.y).toBeGreaterThan(1.74);
    expect(box.max.y).toBeLessThan(1.86);
  });

  it('makes each sleeve and jean leg one skinned mesh bent by its bones', () => {
    const { character } = make();
    for (const limb of [...character.arms, ...character.legs]) {
      expect(limb.mesh.isSkinnedMesh).toBe(true);
      expect(limb.mesh.skeleton.bones).toHaveLength(3);
    }
    for (const { shoulder, elbow } of character.arms) expect([shoulder.isBone, elbow.isBone]).toEqual([true, true]);
    for (const { hip, knee } of character.legs) expect([hip.isBone, knee.isBone]).toEqual([true, true]);
  });

  it.each([['knee', (c) => c.legs[0], 'knee', -1.3], ['elbow', (c) => c.arms[1], 'elbow', 1.3]])(
    'leaves no gap at a bent %s', (_name, limb, joint, angle) => {
      const { character } = make();
      limb(character)[joint].rotation.x = angle;
      character.root.updateMatrixWorld(true);
      const m = limb(character).mesh, pos = m.geometry.attributes.position, seg = 19; // 18 segments, plus the shared seam column
      const a = new THREE.Vector3(), b = new THREE.Vector3();
      let worst = 0;
      for (let i = 0; i + seg < pos.count; i++) {
        m.getVertexPosition(i, a);
        m.getVertexPosition(i + seg, b);
        worst = Math.max(worst, a.distanceTo(b));
      }
      expect(worst).toBeLessThan(0.04); // neighbouring rings stay close all the way round
    });

  it('gives each glove four fingers and a thumb, curled in towards the palm', () => {
    const { character } = make();
    character.root.updateMatrixWorld(true);
    for (const arm of character.arms) {
      expect(arm.fingers).toHaveLength(5);
      const index = arm.fingers[0].geometry.attributes.position;
      const tipX = index.getX(index.count - 1), baseX = index.getX(0);
      expect(Math.sign(tipX - baseX)).toBe(-arm.side); // palms face the legs
    }
  });

  it('winds every swept and lofted surface outwards', () => {
    const { character } = make();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), centre = new THREE.Vector3();
    character.root.traverse((o) => {
      if (!o.isMesh || !o.geometry.index || !o.geometry.attributes.uv || o.geometry.type !== 'BufferGeometry') return;
      const pos = o.geometry.attributes.position, idx = o.geometry.index;
      o.geometry.computeBoundingBox();
      o.geometry.boundingBox.getCenter(centre);
      let out = 0, total = 0;
      for (let i = 0; i < idx.count; i += 3) {
        a.fromBufferAttribute(pos, idx.getX(i));
        b.fromBufferAttribute(pos, idx.getX(i + 1));
        c.fromBufferAttribute(pos, idx.getX(i + 2));
        const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
        if (n.lengthSq() < 1e-14) continue;
        total++;
        if (n.dot(a.clone().sub(centre)) > 0) out++;
      }
      expect(out / total).toBeGreaterThan(0.7);
    });
  });

  it('puts only the helmet and neck on the head layer', () => {
    const { character } = make();
    const meshes = [];
    character.root.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const head = new Set();
    character.neck.traverse((o) => head.add(o));
    for (const m of meshes) expect(m.layers.isEnabled(HEAD_LAYER)).toBe(head.has(m));
    expect(head.size).toBeGreaterThan(1);
  });
});

describe('motion', () => {
  it('follows the walker', () => {
    const { character } = make();
    character.update(0.016, makeWalker({ pos: new THREE.Vector2(1, -5) }));
    expect(character.root.position.x).toBeCloseTo(1);
    expect(character.root.position.z).toBeCloseTo(-5);
  });

  it('turns to face where it walks in third person', () => {
    const { character } = make();
    const walker = makeWalker({ vel: new THREE.Vector2(2, 0) }); // walking towards +x
    for (let i = 0; i < 120; i++) character.update(1 / 60, walker);
    expect(character.facing).toBeCloseTo(-Math.PI / 2, 2);
  });

  it('keeps its facing when standing still', () => {
    const { character } = make();
    character.facing = 1;
    character.update(1 / 60, makeWalker({ yaw: -1 }));
    expect(character.facing).toBe(1);
  });

  it('faces the look in first person, set back from the eye', () => {
    const { character } = make();
    character.update(1 / 60, makeWalker({ view: 'first', yaw: 0.5, vel: new THREE.Vector2(2, 0) }));
    expect(character.facing).toBe(0.5);
    const p = character.root.position;
    expect(Math.hypot(p.x, p.z)).toBeGreaterThan(0.05);
    expect(p.x * -Math.sin(0.5) + p.z * -Math.cos(0.5)).toBeLessThan(0); // behind, not in front
  });

  it('keeps the collar behind the eye while sprinting in first person', () => {
    const { character } = make();
    character.update(1 / 60, makeWalker({ view: 'first', vel: new THREE.Vector2(0, -4.2) }));
    character.root.updateMatrixWorld(true);
    const collar = character.neck.getWorldPosition(new THREE.Vector3());
    expect(collar.z).toBeGreaterThan(0.05); // facing -z from the eye at the origin
  });

  it('keeps the head still when looked at from the front', () => {
    const { character } = make();
    for (const yaw of [Math.PI - 0.05, -Math.PI + 0.05, Math.PI - 0.05, -Math.PI + 0.05]) {
      character.update(1 / 60, makeWalker({ yaw }));
      expect(Math.abs(character.head.rotation.y)).toBeLessThan(0.01);
    }
  });

  it('turns the head towards a look over the shoulder', () => {
    const { character } = make();
    for (let i = 0; i < 60; i++) character.update(1 / 60, makeWalker({ yaw: 0.9 }));
    expect(character.head.rotation.y).toBeGreaterThan(0.5);
  });

  it('swings the legs and arms in opposition while walking', () => {
    const { character } = make();
    character.update(1 / 60, makeWalker({ vel: new THREE.Vector2(0, -2), bob: 0 }));
    const [left, right] = character.legs;
    const [leftArm] = character.arms;
    expect(left.hip.rotation.x).toBeGreaterThan(0.3); // left foot forward at cos(bob) = 1
    expect(right.hip.rotation.x).toBeLessThan(-0.3);
    expect(leftArm.shoulder.rotation.x).toBeLessThan(0); // left arm back
  });

  it('stands straight when still', () => {
    const { character } = make();
    character.update(1 / 60, makeWalker({ bob: 1 }));
    for (const leg of character.legs) expect(leg.hip.rotation.x).toBeCloseTo(0, 10);
  });

  it('lands the left foot on even steps and the right on odd ones', () => {
    expect(Character.leftFootDown({ lastStep: 0 })).toBe(true);
    expect(Character.leftFootDown({ lastStep: 3 })).toBe(false);
    expect(Character.leftFootDown({ lastStep: 4 })).toBe(true);
  });
});
