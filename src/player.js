// First-person walker: WASD/arrows + mouse look (pointer lock) on desktop,
// virtual joystick + drag-to-look on touch screens. Head bob, footsteps and
// simple circle-vs-box collision keep it grounded in the alley.
import * as THREE from 'three';

export class Player {
  constructor(camera, dom, { bounds, colliders, start, onStep }) {
    this.cam = camera;
    this.dom = dom;
    this.bounds = bounds;
    this.colliders = colliders;
    this.onStep = onStep;
    this.pos = new THREE.Vector2(start.x, start.z);
    this.vel = new THREE.Vector2();
    this.yaw = start.yaw || 0;
    this.pitch = start.pitch || 0;
    this.keys = new Set();
    this.joy = { x: 0, y: 0 };
    this.bob = 0;
    this.lastStep = 0;
    this.enabled = false;
    this.radius = 0.3;
    this.eye = 1.68;
    this.touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

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
    if (this.touch) this.setupTouch();
    this.apply(0);
  }

  look(dx, dy) {
    this.yaw -= dx;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy, -1.35, 1.35);
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
          this.look((t.clientX - lx) * 0.005, (t.clientY - ly) * 0.005);
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
    const speed = run ? 4.2 : 2.0;
    const sx = -Math.sin(this.yaw), sz = -Math.cos(this.yaw); // forward
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw); // right
    let tx = 0, tz = 0;
    if (len > 0.01) {
      const n = Math.min(len, 1) / len;
      tx = (sx * f + rx * r) * n * speed;
      tz = (sz * f + rz * r) * n * speed;
    }
    const a = 1 - Math.exp(-dt * 9);
    this.vel.x += (tx - this.vel.x) * a;
    this.vel.y += (tz - this.vel.y) * a;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.collide();

    const v = this.vel.length();
    this.bob += dt * v * 2.6;
    const stepIdx = Math.floor(this.bob / Math.PI);
    if (stepIdx !== this.lastStep) {
      this.lastStep = stepIdx;
      if (v > 0.6 && this.onStep) this.onStep(v);
    }
    this.apply(v);
  }

  apply(v) {
    const amp = Math.min(v / 2, 1.5);
    this.cam.position.set(
      this.pos.x + Math.cos(this.bob) * 0.025 * amp,
      this.eye + Math.abs(Math.sin(this.bob)) * 0.05 * amp,
      this.pos.y,
    );
    this.cam.rotation.set(this.pitch, this.yaw, Math.sin(this.bob) * 0.004 * amp, 'YXZ');
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
