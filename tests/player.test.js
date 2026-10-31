import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Player } from '../src/player.js';

const BOUNDS = { walkX: 10, walkZMin: -10, walkZMax: 10 };
const BOX = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
const MAX_DT = 0.05; // the largest step main.js passes to update

let listeners;

function target() {
  return {
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
  };
}

function fire(type, event = {}) {
  for (const fn of listeners[type] || []) fn({ preventDefault() {}, ...event });
}

function makePlayer({ start = { x: 0, z: 0 }, colliders = [], onStep, enabled = true } = {}) {
  const camera = { position: { set() {} }, rotation: { set() {} } };
  const player = new Player(camera, {}, { bounds: BOUNDS, colliders, start, onStep });
  player.enabled = enabled;
  return player;
}

function walk(player, dt, frames) {
  for (let i = 0; i < frames; i++) player.update(dt);
}

beforeEach(() => {
  listeners = {};
  vi.stubGlobal('window', target());
  vi.stubGlobal('document', { ...target(), pointerLockElement: null });
  vi.stubGlobal('navigator', { maxTouchPoints: 0 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('collision', () => {
  it.each([
    ['left', -1.25, 0, -1.3, 0],
    ['right', 1.25, 0, 1.3, 0],
    ['back', 0, -1.25, 0, -1.3],
    ['front', 0, 1.25, 0, 1.3],
  ])('pushes out of the %s side of a collider', (_side, x, z, wantX, wantZ) => {
    const player = makePlayer({ start: { x, z }, colliders: [BOX] });
    player.collide();
    expect(player.pos.x).toBeCloseTo(wantX, 10);
    expect(player.pos.y).toBeCloseTo(wantZ, 10);
  });

  it('leaves a player clear of the collider alone', () => {
    const player = makePlayer({ start: { x: 1.31, z: 0 }, colliders: [BOX] });
    player.collide();
    expect(player.pos.x).toBe(1.31);
    expect(player.pos.y).toBe(0);
  });

  it.each([
    ['right', 0, 0, 1],
    ['left', 0, 0, -1],
  ])('stops running through a wall of no thickness at the largest dt (%s)', (_name, x, z, side) => {
    // Facing the wall from either side of x = 0.
    const wall = { minX: 0, maxX: 0, minZ: -5, maxZ: 5 };
    const player = makePlayer({ start: { x: x + side * 5, z }, colliders: [wall] });
    player.yaw = side * Math.PI / 2; // forward is -sin(yaw), so this faces the wall
    player.keys.add('KeyW').add('ShiftLeft');
    walk(player, MAX_DT, 200);
    expect(player.pos.x).toBeCloseTo(side * player.radius, 10);
  });
});

describe('walk bounds', () => {
  it.each([
    [50, 0, 10, 0],
    [-50, 0, -10, 0],
    [0, 50, 0, 10],
    [0, -50, 0, -10],
  ])('clamps a player at (%d, %d)', (x, z, wantX, wantZ) => {
    const player = makePlayer({ start: { x, z } });
    player.collide();
    expect(player.pos.x).toBe(wantX);
    expect(player.pos.y).toBe(wantZ);
  });
});

describe('movement', () => {
  const distance = (...keys) => {
    const player = makePlayer();
    for (const k of keys) player.keys.add(k);
    walk(player, 1 / 60, 120);
    return player.pos.length();
  };

  it('moves forward along -z at zero yaw', () => {
    const player = makePlayer();
    player.keys.add('KeyW');
    walk(player, 1 / 60, 60);
    expect(player.pos.y).toBeLessThan(-1);
    expect(player.pos.x).toBeCloseTo(0, 10);
  });

  it('covers the same distance diagonally and straight', () => {
    expect(distance('KeyW', 'KeyD')).toBeCloseTo(distance('KeyW'), 10);
  });

  it('runs faster with shift', () => {
    expect(distance('KeyW', 'ShiftLeft')).toBeGreaterThan(distance('KeyW') * 1.5);
  });

  it('does not move while disabled', () => {
    const player = makePlayer({ start: { x: 1, z: 2 }, enabled: false });
    player.keys.add('KeyW');
    walk(player, 1 / 60, 60);
    expect(player.pos.x).toBe(1);
    expect(player.pos.y).toBe(2);
  });

  it('clears held keys on blur', () => {
    const player = makePlayer();
    fire('keydown', { code: 'KeyW' });
    expect(player.keys.has('KeyW')).toBe(true);
    fire('blur');
    expect(player.keys.size).toBe(0);
  });
});

describe('look', () => {
  it('clamps the pitch', () => {
    const player = makePlayer();
    player.look(0, -100);
    expect(player.pitch).toBe(1.35);
    player.look(0, 100);
    expect(player.pitch).toBe(-1.35);
  });
});

describe('footsteps', () => {
  it('fires onStep with the speed while walking', () => {
    const onStep = vi.fn();
    const player = makePlayer({ onStep });
    player.keys.add('KeyW');
    walk(player, 1 / 60, 120);
    expect(onStep).toHaveBeenCalled();
    expect(onStep.mock.calls[0][0]).toBeGreaterThan(0.6);
  });

  it('stays quiet while standing still', () => {
    const onStep = vi.fn();
    const player = makePlayer({ onStep });
    walk(player, 1 / 60, 120);
    expect(onStep).not.toHaveBeenCalled();
  });
});
