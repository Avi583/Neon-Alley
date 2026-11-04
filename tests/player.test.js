import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Player, clearFraction } from '../src/player.js';

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

describe('walkTo', () => {
  it('walks to the spot at walking pace and calls back once there', () => {
    const player = makePlayer();
    const onArrive = vi.fn();
    player.walkTo(0.6, 0, onArrive);
    let fastest = 0;
    for (let i = 0; i < 120 && !onArrive.mock.calls.length; i++) {
      player.update(1 / 60);
      fastest = Math.max(fastest, player.vel.length());
    }
    expect(onArrive).toHaveBeenCalledTimes(1);
    expect(player.pos.x).toBeCloseTo(0.6, 1);
    expect(fastest).toBeLessThanOrEqual(2);
    walk(player, 1 / 60, 10);
    expect(onArrive).toHaveBeenCalledTimes(1);
  });

  it('is called off by the player moving', () => {
    const player = makePlayer();
    const onArrive = vi.fn();
    player.walkTo(0.6, 0, onArrive);
    walk(player, 1 / 60, 5);
    player.keys.add('KeyS');
    walk(player, 1 / 60, 5);
    player.keys.clear();
    walk(player, 1 / 60, 120);
    expect(onArrive).not.toHaveBeenCalled();
    expect(player.walking).toBeNull();
  });

  it('gives up on a spot behind a collider, and still calls back', () => {
    const player = makePlayer({ start: { x: -2, z: 0 }, colliders: [BOX] });
    const onArrive = vi.fn();
    player.walkTo(0, 0, onArrive);
    walk(player, 1 / 60, 150);
    expect(onArrive).toHaveBeenCalledTimes(1);
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

describe('touch', () => {
  const WIDTH = 1000;
  let joy, knob;

  const fakePart = () => {
    const classes = new Set();
    return { style: {}, classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) } };
  };
  const touches = (...list) => ({ changedTouches: list.map(([identifier, clientX, clientY]) => ({ identifier, clientX, clientY })) });

  function touchPlayer(enabled = true) {
    navigator.maxTouchPoints = 1;
    window.innerWidth = WIDTH;
    joy = fakePart();
    knob = fakePart();
    document.getElementById = (id) => (id === 'joy' ? joy : knob);
    const camera = { position: { set() {} }, rotation: { set() {} } };
    const player = new Player(camera, target(), { bounds: BOUNDS, colliders: [], start: { x: 0, z: 0 } });
    player.enabled = enabled;
    return player;
  }

  it('sets up no touch controls without a touchscreen', () => {
    makePlayer();
    expect(listeners.touchstart).toBeUndefined();
  });

  it('keeps touch controls but starts in mouse mode with a fine pointer (F1)', () => {
    window.matchMedia = () => ({ matches: true });
    const player = touchPlayer();
    expect(player.touch).toBe(false);
    expect(listeners.touchstart).toHaveLength(1);
  });

  it('scales a drag by the look speed (A72)', () => {
    const player = touchPlayer();
    player.lookSpeed = 2;
    fire('touchstart', touches([1, 800, 300]));
    fire('touchmove', touches([1, 810, 300]));
    expect(player.yaw).toBeCloseTo(-0.1, 10);
  });

  it('does not look around while paused', () => {
    const player = touchPlayer();
    fire('touchstart', touches([1, 800, 300]));
    player.enabled = false;
    fire('touchmove', touches([1, 840, 280]));
    expect(player.yaw).toBe(0);
    expect(player.pitch).toBe(0);
  });

  it('shows the joystick where a left-side touch lands', () => {
    touchPlayer();
    fire('touchstart', touches([1, 100, 300]));
    expect(joy.style).toEqual({ left: '100px', top: '300px' });
    expect(joy.classList.contains('on')).toBe(true);
  });

  it('walks in the direction the joystick is pushed', () => {
    const player = touchPlayer();
    fire('touchstart', touches([1, 100, 300]));
    fire('touchmove', touches([1, 100, 300 - 27.5]));
    expect(player.joy.y).toBeCloseTo(-0.5);
    walk(player, 1 / 60, 60);
    expect(player.pos.y).toBeLessThan(-0.5); // forward is -z
    expect(player.pos.x).toBeCloseTo(0);
  });

  it('turns a sideways push into a sideways walk', () => {
    const player = touchPlayer();
    fire('touchstart', touches([1, 100, 300]));
    fire('touchmove', touches([1, 100 + 27.5, 300]));
    walk(player, 1 / 60, 60);
    expect(player.pos.x).toBeGreaterThan(0.5);
    expect(player.pos.y).toBeCloseTo(0);
  });

  it('clamps the joystick to its rim, in any direction', () => {
    const player = touchPlayer();
    fire('touchstart', touches([1, 100, 300]));
    fire('touchmove', touches([1, 100 + 300, 300 + 400]));
    expect(player.joy.x).toBeCloseTo(0.6);
    expect(player.joy.y).toBeCloseTo(0.8);
    expect(knob.style.transform).toBe(`translate(${player.joy.x * 40}px, ${player.joy.y * 40}px)`);
  });

  it('runs only at full tilt', () => {
    const speedAt = (pixels) => {
      const player = touchPlayer();
      fire('touchstart', touches([1, 100, 300]));
      fire('touchmove', touches([1, 100, 300 - pixels]));
      walk(player, 1 / 60, 120);
      listeners = {};
      return player.vel.length();
    };
    expect(speedAt(500)).toBeCloseTo(4.2, 1);
    expect(speedAt(0.9 * 55)).toBeCloseTo(1.8, 1);
  });

  it('looks by dragging on the right side, without moving', () => {
    const player = touchPlayer();
    fire('touchstart', touches([1, 800, 300]));
    fire('touchmove', touches([1, 840, 280]));
    expect(player.yaw).toBeCloseTo(-40 * 0.005);
    expect(player.pitch).toBeCloseTo(20 * 0.005);
    expect(player.joy).toEqual({ x: 0, y: 0 });
    expect(joy.classList.contains('on')).toBe(false);
  });

  it('measures each drag step from the last, not from where the touch began', () => {
    const player = touchPlayer();
    fire('touchstart', touches([1, 800, 300]));
    fire('touchmove', touches([1, 810, 300]));
    fire('touchmove', touches([1, 820, 300]));
    expect(player.yaw).toBeCloseTo(-20 * 0.005);
  });

  it('walks and looks with two thumbs at once', () => {
    const player = touchPlayer();
    fire('touchstart', touches([1, 100, 300], [2, 800, 300]));
    fire('touchmove', touches([1, 100, 250], [2, 820, 300]));
    expect(player.joy.y).toBeLessThan(0);
    expect(player.yaw).toBeCloseTo(-20 * 0.005);
  });

  it('gives a second left-side touch to looking', () => {
    const player = touchPlayer();
    fire('touchstart', touches([1, 100, 300]));
    fire('touchstart', touches([2, 200, 300]));
    fire('touchmove', touches([2, 220, 300]));
    expect(player.joy).toEqual({ x: 0, y: 0 });
    expect(player.yaw).toBeCloseTo(-20 * 0.005);
  });

  it.each(['touchend', 'touchcancel'])('%s lets go of the joystick and the player stops', (type) => {
    const player = touchPlayer();
    fire('touchstart', touches([1, 100, 300]));
    fire('touchmove', touches([1, 100, 200]));
    walk(player, 1 / 60, 30);
    fire(type, touches([1, 100, 200]));
    expect(player.joy).toEqual({ x: 0, y: 0 });
    expect(knob.style.transform).toBe('');
    expect(joy.classList.contains('on')).toBe(false);
    walk(player, 1 / 60, 120);
    expect(player.vel.length()).toBeLessThan(0.01);
  });

  it('stops looking on release, and the next touch can take the joystick', () => {
    const player = touchPlayer();
    fire('touchstart', touches([1, 800, 300]));
    fire('touchend', touches([1, 800, 300]));
    fire('touchmove', touches([1, 900, 300]));
    expect(player.yaw).toBe(0);
    fire('touchstart', touches([2, 100, 300]));
    expect(joy.classList.contains('on')).toBe(true);
  });

  it('ignores new touches while disabled', () => {
    const player = touchPlayer(false);
    fire('touchstart', touches([1, 100, 300]));
    fire('touchmove', touches([1, 100, 200]));
    expect(joy.classList.contains('on')).toBe(false);
    expect(player.joy).toEqual({ x: 0, y: 0 });
  });

  it('stops the page scrolling or zooming', () => {
    touchPlayer();
    for (const type of ['touchstart', 'touchmove']) {
      const preventDefault = vi.fn();
      fire(type, { ...touches([1, 100, 300]), preventDefault });
      expect(preventDefault).toHaveBeenCalled();
    }
  });
});

describe('clearFraction', () => {
  const NONE = {};

  it('is 1 for a clear segment', () => {
    expect(clearFraction(0, 0, 0, 3, [], NONE, 0.2)).toBe(1);
  });

  it('stops short of a collider in the way, by the pad', () => {
    expect(clearFraction(0, 3, 0, -3, [BOX], NONE, 0.2)).toBeCloseTo((3 - 1.2) / 6, 10);
  });

  it('ignores a collider beside the segment', () => {
    expect(clearFraction(2, 3, 2, -3, [BOX], NONE, 0.2)).toBe(1);
  });

  it('ignores a collider the segment starts inside', () => {
    expect(clearFraction(0, 0, 0, 3, [BOX], NONE, 0.2)).toBe(1);
  });

  it('stops at the alley walls and ends', () => {
    const bounds = { half: 2, zStart: 10, zEnd: -10 };
    expect(clearFraction(0, 0, 4, 0, [], bounds, 0.2)).toBeCloseTo(1.8 / 4, 10);
    expect(clearFraction(0, 0, -4, 0, [], bounds, 0.2)).toBeCloseTo(1.8 / 4, 10);
    expect(clearFraction(0, 8, 0, 12, [], bounds, 0.2)).toBeCloseTo(1.8 / 4, 10);
  });
});

describe('view', () => {
  function withCamera(opts) {
    const camera = { pos: {}, position: { set(x, y, z) { camera.pos = { x, y, z }; } }, rotation: { set() {} } };
    const player = new Player(camera, {}, { bounds: BOUNDS, colliders: [], start: { x: 0, z: 0 }, ...opts });
    return { camera, player };
  }

  it('starts in third person, behind and above the player', () => {
    const { camera, player } = withCamera();
    expect(player.view).toBe('third');
    expect(camera.pos.z).toBeGreaterThan(2); // yaw 0 looks down -z, so behind is +z
    expect(camera.pos.x).toBeGreaterThan(0.3); // over the right shoulder
    expect(player.camDist).toBeGreaterThan(2);
  });

  it('can start in first person', () => {
    const { camera, player } = withCamera({ start: { x: 0, z: 0, view: 'first' } });
    expect(player.view).toBe('first');
    expect(camera.pos).toEqual({ x: 0, y: player.eye, z: 0 });
  });

  it('toggles to first person at the eye and back out', () => {
    const { camera, player } = withCamera();
    player.toggleView();
    expect(player.view).toBe('first');
    expect(camera.pos.y).toBe(player.eye);
    expect(player.camDist).toBe(0);
    player.toggleView();
    expect(player.view).toBe('third');
    walk(player, MAX_DT, 60);
    expect(camera.pos.z).toBeGreaterThan(2);
  });

  it('pulls in when a collider is behind the player', () => {
    const wall = { minX: -5, maxX: 5, minZ: 1, maxZ: 2 };
    const { camera, player } = withCamera({ colliders: [wall] });
    expect(camera.pos.z).toBeLessThan(1);
    expect(player.camDist).toBeLessThan(1.2);
  });
});
