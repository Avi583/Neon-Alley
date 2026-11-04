import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Character, HEAD_LAYER, KNOCK_LEAD, KNOCK_TIME } from '../src/character.js';
import { KNOCK_RAPS } from '../src/audio.js';
import { grip } from '../src/character-build.js';

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

  it('closes the fingers into a fist with grip, in towards the palm, and opens them again', () => {
    const { character } = make();
    for (const arm of character.arms) {
      const finger = arm.fingers[1], last = finger.geometry.attributes.position.count - 1;
      const tip = () => { character.root.updateMatrixWorld(true); return finger.getVertexPosition(last, new THREE.Vector3()); };
      const rest = tip();
      grip(arm, 1);
      const fist = tip();
      // The tip curls back up under the knuckles (the palm ends at y = -0.094), on the palm side, outside it.
      expect(fist.y).toBeGreaterThan(-0.07);
      expect(fist.y - rest.y).toBeGreaterThan(0.05);
      expect(-arm.side * fist.x).toBeGreaterThan(0.016 + 0.01);
      grip(arm, 0);
      expect(tip().distanceTo(rest)).toBeLessThan(1e-6);
    }
  });

  it('knocks with a fist, and opens the hand again after', () => {
    const { character } = make();
    const walker = makeWalker();
    character.knock({ face: 0, z: -1.2 });
    for (let t = 0; t < KNOCK_LEAD; t += 1 / 60) character.update(1 / 60, walker);
    expect(Math.abs(character.arms[1].fingers[0].userData.bones[1].rotation.z)).toBeGreaterThan(0.5);
    expect(character.arms[0].fingers[0].userData.bones[1].rotation.z).toBeCloseTo(0);
    for (let t = 0; t < KNOCK_TIME; t += 1 / 60) character.update(1 / 60, walker);
    expect(character.arms[1].fingers[0].userData.bones[1].rotation.z).toBeCloseTo(0);
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

  // Walks towards -z at speed v for the given time, as player.js and main.js do, noting each
  // landing: where the boot was, how far ahead of the body, and how far it moves in the next 0.1 s.
  const walk = (character, v, time) => {
    const walker = makeWalker({ vel: new THREE.Vector2(0, -v) });
    const landings = [];
    for (let f = 0; f < time * 60; f++) {
      walker.bob += (1 / 60) * v * 2.6;
      walker.pos.y -= v / 60;
      character.update(1 / 60, walker);
      for (const l of landings) if (f - l.f === 6) l.moved = character.soleAt(l.left).distanceTo(l.at);
      for (const left of character.landed) {
        const at = character.soleAt(left);
        landings.push({ left, f, at, ahead: walker.pos.y - at.z, hip: character.legs[left ? 0 : 1].hip.rotation.x });
      }
    }
    return landings;
  };

  it.each([['walk', 2], ['run', 4.2]])('lands each boot once a stride at a %s, alternately', (_name, v) => {
    const landings = walk(make().character, v, 4);
    const steps = (4 * v * 2.6) / Math.PI;
    expect(landings.length).toBeGreaterThanOrEqual(Math.floor(steps) - 2);
    expect(landings.length).toBeLessThanOrEqual(Math.ceil(steps));
    for (let k = 1; k < landings.length; k++) expect(landings[k].left).toBe(!landings[k - 1].left);
  });

  // At a run the planted boot still skates back by about half the body's speed (A90).
  it.each([['walk', 2, 0.3], ['run', 4.2, 0.6]])('lands each %s step ahead of the body, where the boot then stays', (_name, v, skate) => {
    const landings = walk(make().character, v, 3).filter((l) => l.moved !== undefined);
    expect(landings.length).toBeGreaterThan(2);
    for (const l of landings) {
      expect(l.at.y).toBe(0);
      expect(Math.sign(l.at.x)).toBe(l.left ? -1 : 1);
      expect(l.ahead).toBeGreaterThan(0.2);
      expect(l.hip).toBeGreaterThan(0.2); // the leg still out in front
      expect(l.moved).toBeLessThan(skate * v * 0.1); // while the body walks on
    }
  });

  it('lands no step when standing still', () => {
    const { character } = make();
    for (let k = 0; k < 120; k++) character.update(1 / 60, makeWalker({ bob: k * 0.05 }));
    expect(character.landed).toHaveLength(0);
  });

  it('lands the left foot on even steps and the right on odd ones', () => {
    expect(Character.leftFootDown({ lastStep: 0 })).toBe(true);
    expect(Character.leftFootDown({ lastStep: 3 })).toBe(false);
    expect(Character.leftFootDown({ lastStep: 4 })).toBe(true);
  });
});

describe('knocking', () => {
  const ahead = { face: 0, z: -1.2 }; // a door straight in front of a walker at the origin facing 0
  const glove = (c) => {
    c.root.updateMatrixWorld(true);
    return c.arms[1].fingers[0].parent.getWorldPosition(new THREE.Vector3());
  };
  // Runs the character on to time t into the knock, in 1/100 s steps.
  const runTo = (c, walker, t) => {
    while ((c.knocking?.t ?? Infinity) < t - 1e-6) c.update(0.01, walker);
  };

  it('turns to face the door in third person by the first rap', () => {
    const { character } = make();
    const walker = makeWalker();
    character.update(0, walker);
    character.knock({ face: 1.2, z: 0 }); // off to the right (+x)
    runTo(character, walker, KNOCK_LEAD);
    expect(Math.abs(character.facing + Math.PI / 2)).toBeLessThan(0.1);
  });

  it('raises the right glove and drives it onto the door on each rap', () => {
    const { character } = make();
    const walker = makeWalker();
    character.update(0, walker);
    const rest = glove(character);
    character.knock(ahead);
    for (const at of KNOCK_RAPS) {
      runTo(character, walker, KNOCK_LEAD + at);
      const hit = glove(character);
      expect(hit.y).toBeGreaterThan(rest.y + 0.3); // the shoulder up
      runTo(character, walker, KNOCK_LEAD + at + 0.1);
      expect(-hit.z).toBeGreaterThan(-glove(character).z + 0.05); // furthest forward on the rap
    }
  });

  it('meets the door with the front of the knuckles, not the back of the hand', () => {
    const { character } = make();
    const walker = makeWalker();
    character.update(0, walker);
    character.knock(ahead);
    const hand = character.arms[1].hand;
    for (const at of KNOCK_RAPS) {
      runTo(character, walker, KNOCK_LEAD + at);
      character.root.updateMatrixWorld(true);
      const q = hand.getWorldQuaternion(new THREE.Quaternion());
      // The knuckle row is where the back of the hand (+x on the right glove) meets the fingers (-y).
      const knuckles = new THREE.Vector3(1, -1, 0).normalize().applyQuaternion(q);
      const back = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
      expect(-knuckles.z).toBeGreaterThan(0.9); // facing the door, straight ahead
      expect(-back.z).toBeLessThan(0.7);
    }
  });

  it('is over and back at rest within the 1 s cooldown', () => {
    const { character } = make();
    const idle = make().character;
    const walker = makeWalker();
    character.update(0, walker);
    character.knock(ahead);
    expect(KNOCK_TIME).toBeLessThanOrEqual(1);
    expect(KNOCK_LEAD + KNOCK_RAPS[KNOCK_RAPS.length - 1]).toBeLessThan(KNOCK_TIME);
    runTo(character, walker, KNOCK_TIME);
    character.update(0.01, walker);
    expect(character.knocking).toBeNull();
    idle.update(0, walker);
    const pose = (c) => [c.arms[1].shoulder.rotation.x, c.arms[1].shoulder.rotation.z, c.arms[1].elbow.rotation.x, c.arms[1].hand.rotation.y];
    expect(pose(character)).toEqual(pose(idle));
  });

  it('puts the arm down when the walker moves off', () => {
    const { character } = make();
    const walker = makeWalker();
    character.update(0, walker);
    character.knock(ahead);
    runTo(character, walker, KNOCK_LEAD);
    walker.vel.set(1.5, 0);
    walker.moving = true;
    for (let i = 0; i < 25; i++) character.update(0.01, walker);
    expect(character.knocking).toBeNull();
  });

  it('still raises the arm when the knock starts while the walker coasts to a stop', () => {
    const { character } = make();
    const walker = makeWalker({ vel: new THREE.Vector2(0, -1.5) });
    character.update(0, walker);
    const rest = glove(character);
    character.knock(ahead);
    while (character.knocking.t < KNOCK_LEAD - 1e-6) {
      walker.vel.multiplyScalar(Math.exp(-0.09)); // easing off as player.js does with no input
      character.update(0.01, walker);
    }
    expect(glove(character).y).toBeGreaterThan(rest.y + 0.3);
  });
});
