// The walker: WASD/arrows + mouse look (pointer lock) on desktop, virtual
// joystick + drag-to-look on touch screens. Head bob, footsteps and simple
// circle-vs-box collision keep it grounded in the alley. The camera either sits
// at eye height (first person) or over the shoulder (third person), pulled in
// when a wall or shopfront would come between it and the player.
import * as THREE from 'three';
import { damp } from './math.js';

const CAM_BACK = 2.4, CAM_SIDE = 0.45, CAM_HEIGHT = 1.62; // third-person camera, from the player
const CAM_PAD = 0.18; // the camera keeps this far from walls
const CAM_OUT = 3; // how fast the camera eases back out once clear
export const CLOSE_UP = 0.6; // nearer than this the helmet would fill the view
export const WALK_SPEED = 2, RUN_SPEED = 4.2; // m/s; a full run is also where stepLength stops growing
export const MIN_STEP = 0.6; // slower than this no step lands
// 0 standing to 1 at walking pace, and 0 walking to 1 at a full run.
export const walkShare = (v) => Math.min(v / WALK_SPEED, 1);
export const runShare = (v) => THREE.MathUtils.clamp((v - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1);
const ARRIVE = 0.05, WALK_GIVE_UP = 2; // walkTo: m from the spot that counts as there; s before it stops trying

// How far each step carries the walker at speed v: short quick steps at a walk, lengthening into a
// run's stride, and shorter again stepping sideways (side, from 0 going ahead or back to 1 straight
// sideways), as far as a leg reaches out. bob turns half a turn a step, and the biker's boots plant
// in time with it.
export function stepLength(v, side = 0) {
  return (0.45 + 0.23 * walkShare(v) + 0.52 * runShare(v)) * (1 - 0.4 * side);
}

// How far along the ground segment (x0, z0) -> (x1, z1) is clear, from 0 to 1,
// against the collider boxes and the alley's walls and ends grown by pad.
export function clearFraction(x0, z0, x1, z1, colliders, bounds, pad) {
  const dx = x1 - x0, dz = z1 - z0;
  let t = 1;
  // Stops a segment heading past min or max along one axis.
  const keepWithin = (o, d, min, max) => {
    const limit = d > 0 ? max : min;
    if ((o + d - limit) * d > 0) t = Math.min(t, Math.max(0, (limit - o) / d));
  };
  if (bounds.half !== undefined) keepWithin(x0, dx, -bounds.half + pad, bounds.half - pad);
  if (bounds.zStart !== undefined) keepWithin(z0, dz, bounds.zEnd + pad, bounds.zStart - pad);
  for (const c of colliders) {
    let lo = -Infinity, hi = Infinity;
    for (const [o, d, min, max] of [[x0, dx, c.minX - pad, c.maxX + pad], [z0, dz, c.minZ - pad, c.maxZ + pad]]) {
      if (Math.abs(d) < 1e-9) {
        if (o < min || o > max) { lo = Infinity; break; }
        continue;
      }
      const a = (min - o) / d, b = (max - o) / d;
      lo = Math.max(lo, Math.min(a, b));
      hi = Math.min(hi, Math.max(a, b));
    }
    // Only boxes the segment runs into: one it starts inside can't be helped.
    if (lo <= hi && lo > 0 && lo < t) t = lo;
  }
  return t;
}

export class Player {
  constructor(camera, dom, { bounds, colliders, start }) {
    this.cam = camera;
    this.dom = dom;
    this.bounds = bounds;
    this.colliders = colliders;
    this.pos = new THREE.Vector2(start.x, start.z);
    this.vel = new THREE.Vector2();
    this.yaw = start.yaw || 0;
    this.pitch = start.pitch || 0;
    this.lookSpeed = 1;
    this.keys = new Set();
    this.joy = { x: 0, y: 0 };
    this.bob = 0;
    this.walking = null; // { x, z, onArrive, t } while walkTo has the player walking somewhere
    this.moving = false; // whether the player's own input is moving them this frame
    this.enabled = false;
    this.radius = 0.3;
    this.eye = 1.68;
    this.duck = 0; // how far a crouch (set from character.js) drops the camera, and tips the first-person view down
    this.dip = 0;
    this.view = start.view === 'first' ? 'first' : 'third';
    this.camReach = 1; // the clear share of the third-person camera's distance
    this.camDist = CAM_BACK; // how far the camera is from the player's head
    // A touchscreen laptop has both, so touch is only the mode until ui.js sees which input is used.
    const touchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.touch = touchScreen && !window.matchMedia?.('(pointer: fine)').matches;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || document.pointerLockElement !== this.dom) return;
      this.look(e.movementX * 0.0022, e.movementY * 0.0022);
    });
    if (touchScreen) this.setupTouch();
    this.apply(0);
  }

  look(dx, dy) {
    this.yaw -= dx * this.lookSpeed;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * this.lookSpeed, -1.35, 1.35);
  }

  setupTouch() {
    const base = document.getElementById('joy');
    const knob = document.getElementById('joy-knob');
    let joyId = null, lookId = null, ox = 0, oy = 0, lx = 0, ly = 0;
    const el = this.dom;
    el.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth * 0.45 && joyId === null) {
          joyId = t.identifier; ox = t.clientX; oy = t.clientY;
          base.style.left = ox + 'px'; base.style.top = oy + 'px';
          base.classList.add('on');
        } else if (lookId === null) {
          lookId = t.identifier; lx = t.clientX; ly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    el.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          let dx = (t.clientX - ox) / 55, dy = (t.clientY - oy) / 55;
          const l = Math.hypot(dx, dy);
          if (l > 1) { dx /= l; dy /= l; }
          this.joy.x = dx; this.joy.y = dy;
          knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
        } else if (t.identifier === lookId) {
          if (this.enabled) this.look((t.clientX - lx) * 0.005, (t.clientY - ly) * 0.005);
          lx = t.clientX; ly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          joyId = null; this.joy.x = this.joy.y = 0;
          knob.style.transform = ''; base.classList.remove('on');
        } else if (t.identifier === lookId) lookId = null;
      }
    };
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
  }

  update(dt) {
    let f = 0, r = 0, run = false;
    if (this.enabled) {
      const k = this.keys;
      f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      r = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      f -= this.joy.y; r += this.joy.x;
      run = k.has('ShiftLeft') || k.has('ShiftRight') || Math.hypot(this.joy.x, this.joy.y) > 0.95;
    }
    const len = Math.hypot(f, r);
    const speed = run ? RUN_SPEED : WALK_SPEED;
    const sx = -Math.sin(this.yaw), sz = -Math.cos(this.yaw); // forward
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw); // right
    let tx = 0, tz = 0;
    this.moving = len > 0.01; // steered by the player's own input, not just still coasting
    if (this.moving || !this.enabled) this.walking = null; // any move of their own, or a pause, calls off a walkTo
    if (this.moving) {
      const n = Math.min(len, 1) / len;
      tx = (sx * f + rx * r) * n * speed;
      tz = (sz * f + rz * r) * n * speed;
    } else if (this.walking) {
      const w = this.walking, dx = w.x - this.pos.x, dz = w.z - this.pos.y, d = Math.hypot(dx, dz);
      w.t += dt;
      if (d < ARRIVE || w.t > WALK_GIVE_UP) {
        this.walking = null;
        this.vel.set(0, 0); // stands where it got to, rather than coasting (or still pushing at a collider)
        w.onArrive();
      } else {
        const s = Math.min(WALK_SPEED, d * 4) / d; // walking pace, easing in over the last half metre
        tx = dx * s;
        tz = dz * s;
      }
    }
    const a = damp(9, dt);
    this.vel.x += (tx - this.vel.x) * a;
    this.vel.y += (tz - this.vel.y) * a;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.collide();

    const v = this.vel.length();
    // Only first person walks other than the way the biker faces (the third-person body turns to it).
    const side = this.view === 'first' && v > 1e-3 ? Math.abs(this.vel.x * Math.cos(this.yaw) - this.vel.y * Math.sin(this.yaw)) / v : 0;
    this.bob += (dt * v * Math.PI) / stepLength(v, side);
    this.apply(v, dt);
  }

  // Walks to (x, z) at walking pace while there's no input, then calls onArrive. Moving calls it off;
  // a spot it can't reach (behind a collider) gives up after WALK_GIVE_UP and arrives anyway.
  walkTo(x, z, onArrive) {
    this.walking = { x, z, onArrive, t: 0 };
  }

  toggleView() {
    this.view = this.view === 'first' ? 'third' : 'first';
    this.camReach = 0; // ease out from the head rather than jump
    this.apply(this.vel.length());
  }

  apply(v, dt = 0) {
    // The bob grows with the pace, and with the step: a walk's shorter steps bob less than a run's.
    const amp = Math.min(v / WALK_SPEED, 1.5) * (stepLength(v) / stepLength(RUN_SPEED));
    if (this.view === 'first') {
      this.camDist = 0;
      this.cam.position.set(
        this.pos.x + Math.cos(this.bob) * 0.025 * amp,
        this.eye - this.duck + Math.abs(Math.sin(this.bob)) * 0.05 * amp,
        this.pos.y,
      );
      this.cam.rotation.set(this.pitch - this.dip, this.yaw, Math.sin(this.bob) * 0.004 * amp, 'YXZ');
      return;
    }
    // Over the right shoulder, swung round the head by the look.
    const cp = Math.cos(this.pitch);
    const fx = -Math.sin(this.yaw) * cp, fy = Math.sin(this.pitch), fz = -Math.cos(this.yaw) * cp;
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const hx = this.pos.x, hy = CAM_HEIGHT - this.duck * 0.4 + Math.abs(Math.sin(this.bob)) * 0.02 * amp, hz = this.pos.y;
    const wx = -fx * CAM_BACK + rx * CAM_SIDE, wz = -fz * CAM_BACK + rz * CAM_SIDE;
    const clear = clearFraction(hx, hz, hx + wx, hz + wz, this.colliders, this.bounds, CAM_PAD);
    // In at once so walls never show through, back out gently.
    this.camReach = clear < this.camReach ? clear : this.camReach + (clear - this.camReach) * damp(CAM_OUT, dt);
    const k = this.camReach;
    const y = Math.max(0.25, hy - fy * CAM_BACK * k);
    this.cam.position.set(hx + wx * k, y, hz + wz * k);
    this.camDist = Math.hypot(wx * k, y - hy, wz * k);
    this.cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  collide() {
    const b = this.bounds, r = this.radius, p = this.pos;
    p.x = THREE.MathUtils.clamp(p.x, -b.walkX, b.walkX);
    p.y = THREE.MathUtils.clamp(p.y, b.walkZMin, b.walkZMax);
    for (const c of this.colliders) {
      const x0 = c.minX - r, x1 = c.maxX + r, z0 = c.minZ - r, z1 = c.maxZ + r;
      if (p.x > x0 && p.x < x1 && p.y > z0 && p.y < z1) {
        const dl = p.x - x0, dr = x1 - p.x, db = p.y - z0, df = z1 - p.y;
        const m = Math.min(dl, dr, db, df);
        if (m === dl) p.x = x0; else if (m === dr) p.x = x1; else if (m === db) p.y = z0; else p.y = z1;
      }
    }
  }
}
