// The biker's legs through the walk: each boot's phase of the stride runs on from player.bob. A
// planted boot stays put (to within the leg's reach) while the hips go over it, rolling on its heel
// and ball; a swinging one lifts clear and comes through to land a little ahead of the hips. Each leg
// is solved as a two-bone chain from the hip joint to the ankle. Driven by character.js.
import * as THREE from 'three';
import { sstep, lawOfCosines, wrapAngle, damp } from './math.js';
import { stepLength, MIN_STEP } from './player.js';
import { ANKLE } from './character-build.js';

const SOLE = new THREE.Vector3(0, ANKLE - 0.225, -0.06); // the middle of the sole's tread, in the boot's frame (from the ankle)
// Along the sole from the ankle (the boot's origin), forward: the heel and ball it rolls on, and the
// middle (SOLE). The ankle sits ANKLE_UP over the tread.
const HEEL = -0.06, BALL = 0.15, MID = -SOLE.z, ANKLE_UP = -SOLE.y;
const STRAIGHT = 0.005; // the planted leg stops this short of straight
const LOCK = 0.3; // slower than this the boots follow the walk cycle rather than staying put
const TAU = Math.PI * 2;
// The furthest the boot rolls toe-up on its heel or heel-up on its ball to keep a planted leg in reach.
const ROLL_UP = 0.6, ROLL_DOWN = -0.9;
const lerp = THREE.MathUtils.lerp;
// Walking off to the side of where the body faces (first person), the legs turn at the hip toward
// the way they go, by up to TOE_MAX, easing at TOE_TURN. Past that, each boot's track is pushed out
// from the line of travel so the two boots' footprints (BOOT_L by BOOT_W, GAP apart) don't pass
// through each other. Beyond HALF_TURN + FLIP from ahead the legs walk backward instead.
const TOE_MAX = 0.6, TOE_TURN = 8, FLIP = 0.3, HALF_TURN = Math.PI / 2;
const BOOT_L = 0.26, BOOT_W = 0.114, GAP = 0.02;

export class Legs {
  // hips is the group the legs hang from, legs the two from buildLeg (left first).
  constructor(hips, legs) {
    this.hips = hips;
    this.legs = legs;
    // Each boot: planted with the middle of its sole at plant, or swinging from its ankle at from (pitched
    // fromPitch), and where its ankle was last posed.
    this.feet = [0, 1].map(() => ({
      ready: false, stance: false, plant: new THREE.Vector3(), from: new THREE.Vector3(), fromPitch: 0,
      ankle: new THREE.Vector3(), pitch: 0,
    }));
    this.landed = []; // the boots that planted on the last update, true for the left
    this.toe = 0; // how far the legs have turned at the hip from the body's facing
    this.backward = false; // whether the legs walk backward to the way they go
    this._body = new THREE.Vector3();
    this._perp = new THREE.Vector3();
    this._hipAt = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._ground = new THREE.Vector3();
    this._spot = new THREE.Vector3();
    this._end = new THREE.Vector3();
    this._v = new THREE.Vector3();
    this._w = new THREE.Vector3();
  }

  // The point on the ground under the middle of a boot's sole, from the bones as last posed.
  soleAt(left, out = new THREE.Vector3()) {
    const { boot } = this.legs[left ? 0 : 1];
    boot.updateWorldMatrix(true, false);
    out.copy(SOLE);
    boot.localToWorld(out);
    out.y = 0;
    return out;
  }

  // Where the ankle is (into out) for a boot pitched toe-up by pitch, with the point offset forward of
  // the ankle along its sole on the ground at at.
  ankleFrom(at, offset, pitch, out) {
    const c = Math.cos(pitch), s = Math.sin(pitch);
    return out.copy(at).addScaledVector(this._fwd, -(offset * c + ANKLE_UP * s)).setY(at.y + ANKLE_UP * c - offset * s);
  }

  // How far the ankle at a is from the hip joint (leaving the difference in _w).
  reach(a) {
    return this._w.subVectors(a, this._hipAt).length();
  }

  // The ankle (into out) of a boot planted at plant and pitched by pitch: on its heel toe-up, its ball heel-up.
  plantedAnkle(plant, pitch, out) {
    const offset = pitch >= 0 ? HEEL : BALL;
    this._v.copy(plant).addScaledVector(this._fwd, offset - MID);
    return this.ankleFrom(this._v, offset, pitch, out);
  }

  // The ankle (into out) and toe-up pitch of a boot planted with the middle of its sole at plant, prog of
  // the way through its stance: it rolls down off the heel it landed on (pitched land) and up onto the
  // ball (by rise) to push off, and further either way where the leg couldn't otherwise reach.
  stancePose(plant, prog, land, rise, reachMax, out) {
    let pitch = land * (1 - sstep(0, 0.2, prog)) - rise * sstep(0.6, 1, prog);
    if (this.reach(this.plantedAnkle(plant, pitch, out)) > reachMax) {
      // Ahead of the hip the toe comes up, behind it the heel: between the planned pitch (out of
      // reach) and the furthest it goes (taken as in reach). Out to the side, rolling doesn't help and
      // the leg reaches as far as it goes.
      const ahead = this._w.dot(this._fwd) > 0;
      let lo = pitch, hi = ahead ? Math.max(pitch, ROLL_UP) : Math.min(pitch, ROLL_DOWN);
      for (let k = 0; k < 10; k++) {
        const mid = (lo + hi) / 2;
        if (this.reach(this.plantedAnkle(plant, mid, out)) > reachMax) lo = mid; else hi = mid;
      }
      pitch = hi;
      this.plantedAnkle(plant, pitch, out);
    }
    return pitch;
  }

  // Bends the leg so the ankle meets a (as near as it reaches), with the boot pitched toe-up from the
  // ground: the hip and knee swing it forward and back, and the hip rolls it out to the side the hips
  // have swayed from it. The boot takes out that roll and the hips' twist and tilt, so it stays
  // level and facing ahead rather than turning on its ankle. blend eases it in from standing. hang
  // (0 to 1) takes the boot off the ground's pitch and onto ankle, its angle from the shin (toe-up),
  // as a swinging boot hangs from the leg rather than staying level with the ground. yaw turns the
  // whole leg at the hip about the upright, so it's solved in the turned frame.
  poseLeg(leg, a, pitch, blend, walk, hang = 0, ankle = 0, yaw = 0) {
    const p = leg.mesh.worldToLocal(this._v.copy(a)); // the hip joint is at the mesh's origin
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    p.set(p.x * cy - p.z * sy, p.y, p.x * sy + p.z * cy);
    const thigh = -leg.knee.position.y, shin = -leg.boot.position.y;
    const roll = Math.atan2(p.x, -p.y), down = Math.hypot(p.x, p.y);
    const d = THREE.MathUtils.clamp(Math.hypot(down, p.z), 0.1, thigh + shin - 1e-4);
    const hip = Math.atan2(-p.z, down) + lawOfCosines(thigh, d, shin);
    const knee = lawOfCosines(thigh, shin, d) - Math.PI;
    leg.hip.rotation.set(lerp(0, hip, blend), yaw, lerp(0, roll, blend));
    leg.knee.rotation.x = lerp(-0.05 * walk, knee, blend);
    leg.boot.rotation.set(lerp(0, lerp(pitch - hip - knee, ankle, hang), blend), -this.hips.rotation.y, -leg.hip.rotation.z - this.hips.rotation.z);
  }

  // Poses the legs for the walk: the left boot lands at cos(bob) = 1 and the right half a stride later,
  // wherever the hips will have carried it, whichever way they go. facing is the body's yaw, and crouch
  // (0 to 1) folds the legs to boots set flat under the hips. Fills landed with the boots (true for the
  // left) that planted this frame.
  stride(player, v, walk, run, first, facing, crouch, dt = 0) {
    this.landed.length = 0;
    const body = this._body.set(-Math.sin(facing), 0, -Math.cos(facing));
    if (v > 1e-3) this._dir.set(player.vel.x / v, 0, player.vel.y / v);
    else this._dir.copy(body);
    const step = stepLength(v, first ? Math.abs(this._dir.x * body.z - this._dir.z * body.x) : 0); // as player.js
    let blend = sstep(0.05, 0.5, v);
    // Crouching, the boots stand a little apart under the hips (the right a little ahead), and the legs
    // fold to reach them as the hips drop.
    const crouching = crouch > 1e-3 && v < LOCK;
    // The way the legs go from the body's facing, and from the way they point (ahead or behind).
    const travel = v > 1e-3 ? wrapAngle(Math.atan2(-this._dir.x, -this._dir.z) - facing) : 0;
    if (Math.abs(travel) > HALF_TURN + FLIP) this.backward = true;
    else if (Math.abs(travel) < HALF_TURN - FLIP) this.backward = false;
    const off = this.backward ? wrapAngle(travel - Math.PI) : travel;
    const toeTo = crouching ? 0 : THREE.MathUtils.clamp(off, -TOE_MAX, TOE_MAX) * blend;
    this.toe = dt > 0 ? this.toe + (toeTo - this.toe) * damp(TOE_TURN, dt) : toeTo;
    this._fwd.copy(body).applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.toe); // the way the boots point
    // How far each boot's track sits out from the line of travel: the hip joint's own offset across
    // it, pushed out to clear the other boot's footprint, turned off the line by what's left of off.
    const rest = off - this.toe;
    const clear = (BOOT_L * Math.abs(Math.sin(rest)) + BOOT_W * Math.abs(Math.cos(rest)) + GAP) / 2;
    const across = Math.cos(off); // of the hip joints' spread, the share across the line of travel (the right way round)
    this._perp.set(-this._dir.z, 0, this._dir.x).multiplyScalar(this.backward ? -1 : 1); // to the right of the line
    const stance = 0.58 - 0.22 * run; // of the stride with the boot down: a run has a flight between
    const sweep = stance * 2 * step; // how far the hips go over a planted boot
    const lead = 0.46 * sweep; // and how far ahead of them it lands
    const swingLength = (1 - stance) * 2 * step; // how far the hips go while a boot swings
    // Heel first going forward, the ball first going backward (in first person), flat sideways.
    const ahead = this._dir.dot(this._fwd);
    const land = (0.25 * walk - 0.13 * run) * ahead, rise = (0.25 * walk + 0.2 * run) * ahead;
    const lift = 0.08 * walk + 0.08 * run;
    // Early in the swing the knee folds and the heel comes up behind (a kick at a run), so the boot
    // clears the ground well before it reaches forward.
    const tuck = 0.04 * walk + 0.14 * run;
    if (crouching) blend = 1;
    for (let i = 0; i < 2; i++) {
      const foot = this.feet[i], leg = this.legs[i];
      let hang = 0, ankle = 0;
      leg.mesh.getWorldPosition(this._hipAt);
      const hipX = leg.mesh.position.x;
      const push = Math.max(0, clear - Math.abs(hipX) * across) * blend;
      const ground = this._ground.copy(this._hipAt).setY(0).addScaledVector(this._perp, Math.sign(hipX) * push);
      const reachMax = -leg.knee.position.y - leg.boot.position.y - STRAIGHT;
      const phase = THREE.MathUtils.euclideanModulo(player.bob - i * Math.PI, TAU) / TAU;
      const down = phase < stance;
      const prog = phase / stance, q = (phase - stance) / (1 - stance);
      // Off the walk (just started, or barely moving) each boot is where the cycle has it.
      const locked = foot.ready && v >= LOCK;
      if (locked && down && !foot.stance) {
        // Landing: the boot is planted where the swing brought it.
        const c = Math.cos(foot.pitch), s = Math.sin(foot.pitch);
        foot.plant.copy(foot.ankle).addScaledVector(this._fwd, MID * c + ANKLE_UP * s).setY(0);
        if (v >= MIN_STEP) this.landed.push(i === 0);
      } else if (locked && !down && foot.stance) {
        foot.from.copy(foot.ankle);
        foot.fromPitch = foot.pitch;
      }
      if (down) {
        if (!locked) foot.plant.copy(ground).addScaledVector(this._dir, lead - prog * sweep);
        foot.pitch = this.stancePose(foot.plant, prog, land, rise, reachMax, foot.ankle);
      } else {
        if (!locked) {
          this._spot.copy(ground).addScaledVector(this._dir, lead - sweep - q * swingLength);
          foot.fromPitch = this.stancePose(this._spot, 1, land, rise, reachMax, foot.from);
        }
        // Coming through to land where the hips will be at the end of the swing, a little ahead of them.
        this._spot.copy(ground).addScaledVector(this._dir, lead + (1 - q) * swingLength);
        const endPitch = this.stancePose(this._spot, 0, land, rise, reachMax, this._end);
        const e = q * q * (3 - 2 * q);
        const fold = Math.sin(Math.PI * Math.sqrt(q)) ** 2; // the most at a quarter of the way through
        foot.ankle.lerpVectors(foot.from, this._end, e).addScaledVector(this._dir, -0.4 * tuck * fold).y += lift * Math.sin(Math.PI * q) + tuck * fold;
        foot.pitch = lerp(foot.fromPitch, endPitch, e);
        // Off the ground the boot hangs from the shin: the toe still pointed from the push-off, coming
        // up level with the shin by mid-swing and a little past it to meet the ground heel first.
        hang = sstep(0, 0.25, q) * (1 - sstep(0.75, 1, q));
        ankle = -0.35 * (1 - sstep(0.05, 0.55, q)) + 0.1 * sstep(0.5, 0.9, q);
      }
      foot.stance = down;
      foot.ready = true;
      if (crouching) {
        // Flat on the ground under the hip joint, a little out, the right a little ahead of the left.
        this._spot.copy(this._hipAt).setY(0).addScaledVector(this._fwd, i === 1 ? 0.1 : -0.04);
        this._spot.x += Math.cos(facing) * leg.mesh.position.x * 0.4; // out to the side (x, turned)
        this._spot.z -= Math.sin(facing) * leg.mesh.position.x * 0.4;
        this.ankleFrom(this._spot, MID, 0, this._end);
        this.poseLeg(leg, this._end, 0, blend, walk);
        continue;
      }
      this.poseLeg(leg, foot.ankle, foot.pitch, blend, walk, hang, ankle, this.toe);
    }
  }
}
