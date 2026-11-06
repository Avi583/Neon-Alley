// The biker the player walks as: full-face helmet, leather biker jacket, biker
// gloves, jeans and boots. The body, sleeves and jean legs are lofted from
// cross-sections, and each sleeve and leg is one skinned mesh that bends at the
// elbow or knee, so no joints show. The bones are the pivots the walk cycle
// swings, in step with player.bob: each boot stays where it lands while the body
// walks over it, and swings through to land again a step ahead.
// The geometry helpers are in character-geometry.js and the parts in character-build.js.
import * as THREE from 'three';
import { sstep } from './math.js';
import { KNOCK_RAPS } from './audio.js';
import { stepLength } from './player.js';
import { HEAD_LAYER, ANKLE, createMaterials, part, buildArm, buildLeg, buildHelmet, buildJacket, buildSeat, grip } from './character-build.js';

export { HEAD_LAYER };
const HIP = 0.955; // hip height, so the boot soles sit on the ground
const TURN = 10; // how fast the body turns to face where it walks
const HEAD_TURN = 8; // how fast the head eases round to the look
const NECK_UP = 0.6; // from the hips to the base of the neck
const FIRST_BACK = 0.12; // in first person the body sits this far behind the eye, so looking down shows the chest and boots
const SOLE = new THREE.Vector3(0, ANKLE - 0.225, -0.06); // the middle of the sole's tread, in the boot's frame (from the ankle)
// Along the sole from the ankle (the boot's origin), forward: the heel and ball it rolls on, and the
// middle (SOLE). The ankle sits ANKLE_UP over the tread.
const HEEL = -0.06, BALL = 0.15, MID = -SOLE.z, ANKLE_UP = -SOLE.y;
const STRAIGHT = 0.005; // the planted leg stops this short of straight
const MIN_WALK = 0.6; // slower than this, as in player.js, no step lands
const LOCK = 0.3; // slower than this the boots follow the walk cycle rather than staying put
const TAU = Math.PI * 2;
// The furthest the boot rolls toe-up on its heel or heel-up on its ball to keep a planted leg in reach.
const ROLL_UP = 0.6, ROLL_DOWN = -0.9;
// Knocking: the right arm comes up over KNOCK_LEAD, raps on each of KNOCK_RAPS after it, and is
// back at rest by KNOCK_TIME, inside the 1 s knock cooldown in main.js.
export const KNOCK_LEAD = 0.3, KNOCK_TIME = 0.95;
export const KNOCK_REACH = 0.8; // how far from a door's face the glove reaches it; main.js walks the biker in from further
const KNOCK_OUT = 0.75; // when the arm starts down again, after the last rap
const KNOCK_SHOULDER = [1.15, -0.2], KNOCK_ELBOW = [1.75, 1.05]; // shoulder [forward, out]; elbow [cocked, on the door]
const KNOCK_LIFT = 0.012; // how far the shoulder joint rises with the knocking arm
const KNOCK_TWIST = -Math.PI / 2; // the glove turns palm to the biker, so the knuckles meet the door
// Picking something up out of a low bin: the biker crouches (the hips drop and the knees fold), leans
// in and reaches down with the right glove, closes it on the thing at PICK_GRAB, brings it up in front
// of the chest while standing, and puts it away at PICK_DONE.
export const PICK_GRAB = 0.62, PICK_DONE = 1.45, PICK_TIME = 1.7;
export const PICK_STAND = 0.45; // how far from the thing (along the ground) the biker stands to reach it
const PICK_DROP = 0.45, PICK_LEAN = 0.8; // how far the hips drop and the torso leans in, at the lowest
const PICK_EYE = 0.62, PICK_DIP = 0.95; // first person: how far the eye drops and the view tips down
const PICK_EASE = 20; // how fast the pose follows its timeline, so walking off mid-crouch doesn't snap
const UPPER = 0.3, LOWER = 0.36; // shoulder to elbow, and elbow to the middle of a closed glove

export class Character {
  constructor(scene) {
    const m = (this.materials = createMaterials());
    this.root = new THREE.Group();
    this.hips = new THREE.Group();
    this.hips.position.y = HIP;
    this.root.add(this.hips);
    buildSeat(this.hips, m);
    this.torso = new THREE.Group();
    this.hips.add(this.torso);
    this.chest = new THREE.Group();
    this.torso.add(this.chest);
    buildJacket(this.chest, m);
    this.arms = [buildArm(this.chest, m, -1), buildArm(this.chest, m, 1)];
    this.legs = [buildLeg(this.hips, m, -1), buildLeg(this.hips, m, 1)];
    this.neck = new THREE.Group();
    this.neck.position.y = 0.57;
    this.chest.add(this.neck);
    part(this.neck, new THREE.CylinderGeometry(0.05, 0.056, 0.12, 14), m.knit, 0, 0.03);
    this.head = buildHelmet(this.neck, m);
    this.neck.traverse((o) => o.layers.set(HEAD_LAYER));

    // Bind every limb and finger in the rest pose; update hangs the arms a little out from the body.
    this.root.updateMatrixWorld(true);
    this.root.traverse((o) => { if (o.isSkinnedMesh) o.bind(new THREE.Skeleton(o.userData.bones)); });

    this.facing = 0;
    this.headYaw = 0;
    this.time = 0;
    this.knocking = null; // { t, x, z }: time into the knock and where the door is
    this.picking = null; // { t, target, onGrab, onDone, grabbed, done }: see pickUp
    this.held = null; // what the right glove is holding
    this.crouch = 0; // 0 standing to 1 at the bottom of a pick-up
    this.reachK = 0; // how far the right arm is reaching for the pick-up
    this.showK = 0; // how far the right arm is bringing it up in front of the chest
    this.duck = 0; // first person: how far the eye should drop (m), and the view tip down (rad)
    this.dip = 0;
    // Each boot: planted with the middle of its sole at plant, or swinging from its ankle at from (pitched
    // fromPitch), and where its ankle was last posed.
    this.feet = [0, 1].map(() => ({
      ready: false, stance: false, plant: new THREE.Vector3(), from: new THREE.Vector3(), fromPitch: 0,
      ankle: new THREE.Vector3(), pitch: 0,
    }));
    this.landed = []; // the boots that planted on the last update, true for the left
    this._hipAt = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._ground = new THREE.Vector3();
    this._spot = new THREE.Vector3();
    this._end = new THREE.Vector3();
    this._v = new THREE.Vector3();
    this._w = new THREE.Vector3();
    scene.add(this.root);
  }

  // Starts a knock on a door ({ face, z }, as alley.js lists them).
  knock(door) {
    this.knocking = { t: 0, x: door.face, z: door.z };
  }

  // Starts picking up the thing at target (a world point). At PICK_GRAB, onGrab() is called and may
  // return an Object3D to show in the glove (or null if the thing has gone); at PICK_DONE that's taken
  // out of the glove and onDone() is called. Walking off before the grab calls it off (onDone is never
  // called); after the grab it's put away at once. Returns false if already knocking or picking.
  pickUp(target, { onGrab = null, onDone = null } = {}) {
    if (this.picking || this.knocking) return false;
    this.picking = { t: 0, target: target.clone(), onGrab, onDone, grabbed: false, got: false, done: false };
    return true;
  }

  // Puts obj in the right glove, across the palm, replacing anything held.
  hold(obj) {
    this.drop();
    obj.position.set(-0.035, -0.075, -0.01);
    obj.rotation.set(Math.PI / 2, 0, 0);
    this.arms[1].hand.add(obj);
    this.held = obj;
  }

  drop() {
    this.held?.removeFromParent();
    this.held = null;
  }

  // Runs the pick-up timeline on by dt and returns the wanted [crouch, reach, show, grip].
  pickPose(dt, player) {
    const p = this.picking;
    if (!p) return [0, 0, 0, 0];
    p.t += dt;
    if (player.moving && p.t < PICK_DONE) {
      p.t = PICK_DONE; // walking off: put away whatever's held now, or give up before the grab
      p.grabbed = true;
    }
    if (!p.grabbed && p.t >= PICK_GRAB) {
      p.grabbed = true;
      const obj = p.onGrab?.();
      if (obj) { this.hold(obj); p.got = true; }
    }
    if (!p.done && p.t >= PICK_DONE) {
      p.done = true;
      this.drop();
      if (p.got) p.onDone?.();
    }
    const t = p.t;
    if (t >= PICK_TIME) this.picking = null;
    return [
      sstep(0, 0.5, t) * (1 - sstep(0.85, 1.35, t)),
      sstep(0.1, 0.5, t) * (1 - sstep(0.8, 1.15, t)),
      sstep(0.8, 1.15, t) * (1 - sstep(PICK_DONE, PICK_TIME, t)),
      p.got || t < PICK_GRAB ? sstep(0.45, PICK_GRAB, t) * (1 - sstep(PICK_DONE, PICK_DONE + 0.15, t)) : 0,
    ];
  }

  // Swings the right shoulder and elbow so the glove reaches the world point target, as far as the arm
  // goes, blended in by k. The elbow bends forward, as an arm does.
  reachFor(target, k) {
    const { shoulder, elbow } = this.arms[1];
    shoulder.parent.updateWorldMatrix(true, false);
    const p = shoulder.parent.worldToLocal(this._w.copy(target)).sub(shoulder.position);
    const d = THREE.MathUtils.clamp(p.length(), 0.05, UPPER + LOWER - 1e-4);
    p.normalize();
    const acos = (x) => Math.acos(THREE.MathUtils.clamp(x, -1, 1));
    const roll = Math.asin(THREE.MathUtils.clamp(p.x, -1, 1));
    const aim = Math.atan2(-p.z, -p.y);
    const open = acos((UPPER * UPPER + d * d - LOWER * LOWER) / (2 * UPPER * d));
    const bend = Math.PI - acos((UPPER * UPPER + LOWER * LOWER - d * d) / (2 * UPPER * LOWER));
    const lerp = THREE.MathUtils.lerp;
    shoulder.rotation.x = lerp(shoulder.rotation.x, aim - open, k);
    shoulder.rotation.z = lerp(shoulder.rotation.z, roll, k);
    elbow.rotation.x = lerp(elbow.rotation.x, bend, k);
  }

  // How far the knock pose is blended in, and how far the forearm is driven onto the door (1 at each rap).
  knockPose() {
    const k = this.knocking;
    if (!k) return [0, 0];
    const blend = sstep(0, 0.2, k.t) * (1 - sstep(KNOCK_OUT, KNOCK_TIME, k.t));
    let rap = 0;
    for (const at of KNOCK_RAPS) {
      const x = k.t - KNOCK_LEAD - at; // quick in, a little slower back off the door
      rap = Math.max(rap, x < 0 ? sstep(-0.09, 0, x) : 1 - sstep(0, 0.08, x));
    }
    return [blend, rap];
  }

  // Which foot lands on the step player.js has just counted: the left on even steps.
  static leftFootDown(player) {
    return ((player.lastStep % 2) + 2) % 2 === 0;
  }

  // The point on the ground under the middle of a boot's sole, from the bones as update last posed them.
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

  // The ankle (into out) and toe-up pitch of a boot planted with the middle of its sole at plant, prog of
  // the way through its stance: it rolls down off the heel it landed on (pitched land) and up onto the
  // ball (by rise) to push off, and further either way where the leg couldn't otherwise reach.
  stancePose(plant, prog, land, rise, reachMax, out) {
    const at = (pitch) => {
      const offset = pitch >= 0 ? HEEL : BALL;
      this._v.copy(plant).addScaledVector(this._fwd, offset - MID);
      return this.ankleFrom(this._v, offset, pitch, out);
    };
    let pitch = land * (1 - sstep(0, 0.2, prog)) - rise * sstep(0.6, 1, prog);
    if (this.reach(at(pitch)) > reachMax) {
      // Ahead of the hip the toe comes up, behind it the heel: between the planned pitch (out of
      // reach) and the furthest it goes (taken as in reach). Out to the side, rolling doesn't help and
      // the leg reaches as far as it goes.
      const ahead = this._w.dot(this._fwd) > 0;
      let lo = pitch, hi = ahead ? Math.max(pitch, ROLL_UP) : Math.min(pitch, ROLL_DOWN);
      for (let k = 0; k < 10; k++) {
        const mid = (lo + hi) / 2;
        if (this.reach(at(mid)) > reachMax) lo = mid; else hi = mid;
      }
      pitch = hi;
      at(pitch);
    }
    return pitch;
  }

  // Bends the leg so the ankle meets a (as near as it reaches), with the boot pitched toe-up from the
  // ground: the hip and knee swing it forward and back, and the hip rolls it out to the side the hips
  // have swayed from it. The boot takes out that roll and the hips' twist and tilt, so it stays
  // level and facing ahead rather than turning on its ankle. blend eases it in from standing. hang
  // (0 to 1) takes the boot off the ground's pitch and onto ankle, its angle from the shin (toe-up),
  // as a swinging boot hangs from the leg rather than staying level with the ground.
  poseLeg(leg, a, pitch, blend, walk, hang = 0, ankle = 0) {
    const p = leg.mesh.worldToLocal(this._v.copy(a)); // the hip joint is at the mesh's origin
    const thigh = -leg.knee.position.y, shin = -leg.boot.position.y;
    const roll = Math.atan2(p.x, -p.y), down = Math.hypot(p.x, p.y);
    const d = THREE.MathUtils.clamp(Math.hypot(down, p.z), 0.1, thigh + shin - 1e-4);
    const acos = (x) => Math.acos(THREE.MathUtils.clamp(x, -1, 1));
    const hip = Math.atan2(-p.z, down) + acos((thigh * thigh + d * d - shin * shin) / (2 * thigh * d));
    const knee = acos((thigh * thigh + shin * shin - d * d) / (2 * thigh * shin)) - Math.PI;
    const lerp = THREE.MathUtils.lerp;
    leg.hip.rotation.set(lerp(0, hip, blend), 0, lerp(0, roll, blend));
    leg.knee.rotation.x = lerp(-0.05 * walk, knee, blend);
    leg.boot.rotation.set(lerp(0, lerp(pitch - hip - knee, ankle, hang), blend), -this.hips.rotation.y, -leg.hip.rotation.z - this.hips.rotation.z);
  }

  // Poses the legs for the walk: each boot's phase of the stride runs on from player.bob, the left
  // landing at cos(bob) = 1 and the right half a stride later. A planted boot stays put (to within the
  // leg's reach) while the hips go over it; a swinging one lifts clear and comes through to land where
  // the hips will have carried it, a little ahead of them, whichever way they go. Fills this.landed
  // with the boots (true for the left) that planted this frame.
  stride(player, v, walk, run, first) {
    this.landed.length = 0;
    this._fwd.set(-Math.sin(this.facing), 0, -Math.cos(this.facing));
    if (v > 1e-3) this._dir.set(player.vel.x / v, 0, player.vel.y / v);
    else this._dir.copy(this._fwd);
    const step = stepLength(v, first ? Math.abs(this._dir.x * this._fwd.z - this._dir.z * this._fwd.x) : 0); // as player.js
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
    let blend = sstep(0.05, 0.5, v);
    // Crouching, the boots stand a little apart under the hips (the right a little ahead), and the legs
    // fold to reach them as the hips drop.
    const crouching = this.crouch > 1e-3 && v < LOCK;
    if (crouching) blend = 1;
    for (let i = 0; i < 2; i++) {
      const foot = this.feet[i], leg = this.legs[i];
      let hang = 0, ankle = 0;
      leg.mesh.getWorldPosition(this._hipAt);
      const ground = this._ground.copy(this._hipAt).setY(0);
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
        if (v >= MIN_WALK) this.landed.push(i === 0);
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
        foot.pitch = THREE.MathUtils.lerp(foot.fromPitch, endPitch, e);
        // Off the ground the boot hangs from the shin: the toe still pointed from the push-off, coming
        // up level with the shin by mid-swing and a little past it to meet the ground heel first.
        hang = sstep(0, 0.25, q) * (1 - sstep(0.75, 1, q));
        ankle = -0.35 * (1 - sstep(0.05, 0.55, q)) + 0.1 * sstep(0.5, 0.9, q);
      }
      foot.stance = down;
      foot.ready = true;
      if (crouching) {
        // Flat on the ground under the hip joint, a little out, the right a little ahead of the left.
        this._spot.copy(ground).addScaledVector(this._fwd, i === 1 ? 0.1 : -0.04);
        this._spot.x += Math.cos(this.facing) * leg.mesh.position.x * 0.4; // out to the side (x, turned)
        this._spot.z -= Math.sin(this.facing) * leg.mesh.position.x * 0.4;
        this.ankleFrom(this._spot, MID, 0, this._end);
        this.poseLeg(leg, this._end, 0, blend, walk);
        continue;
      }
      this.poseLeg(leg, foot.ankle, foot.pitch, blend, walk, hang, ankle);
    }
  }

  update(dt, player) {
    this.time += dt;
    const v = player.vel.length();
    const first = player.view === 'first';
    const k = this.knocking;
    if (k) {
      k.t += dt;
      // Walking off puts the arm down; only the player's own input counts, as the biker can still be
      // coasting to a stop when the knock starts.
      if (player.moving) k.t = Math.max(k.t, KNOCK_OUT);
      if (k.t >= KNOCK_TIME) this.knocking = null;
    }
    const target = this.picking?.target;
    const [crouchTo, reachTo, showTo, gripK] = this.pickPose(dt, player);
    const ease = 1 - Math.exp(-dt * PICK_EASE);
    this.crouch += (crouchTo - this.crouch) * ease;
    this.reachK += (reachTo - this.reachK) * ease;
    this.showK += (showTo - this.showK) * ease;
    this.duck = PICK_EYE * this.crouch;
    this.dip = PICK_DIP * this.crouch;
    if (first) this.facing = player.yaw;
    else if (v > 0.3 || this.knocking || this.picking) {
      const focus = this.knocking ?? (this.picking && !this.picking.done ? { x: target.x, z: target.z } : null);
      const want = focus && !player.moving
        ? Math.atan2(-(focus.x - player.pos.x), -(focus.z - player.pos.y)) // turn to the door, or the pick-up
        : Math.atan2(-player.vel.x, -player.vel.y);
      const d = Math.atan2(Math.sin(want - this.facing), Math.cos(want - this.facing));
      this.facing += d * (1 - Math.exp(-dt * TURN));
    }
    // walk: 0 standing to 1 at walking pace; run: 0 walking to 1 at full run.
    const walk = Math.min(v / 2, 1);
    const run = THREE.MathUtils.clamp((v - 2) / 2.2, 0, 1);
    // The lean, plus a rock forward as each boot lands (cos(2 bob) = 1) and back up over the planted one.
    const lean = 0.06 * walk + 0.14 * run + Math.cos(2 * player.bob) * (0.02 * walk + 0.02 * run);
    // In first person the lean would carry the collar up under the eye, so the body steps back by as much.
    const bend = lean + PICK_LEAN * this.crouch; // and further, leaning in to pick something up
    const back = first ? FIRST_BACK + Math.sin(bend) * NECK_UP : 0;
    this.root.position.set(player.pos.x + Math.sin(this.facing) * back, 0, player.pos.y + Math.cos(this.facing) * back);
    this.root.rotation.y = this.facing;
    const b = player.bob;
    const c = Math.cos(b), s = Math.sin(b);
    const armAmp = 0.24 * walk + 0.41 * run;
    // The left heel strikes at cos(bob) = 1, the right at -1, as player.js counts each step; each arm
    // swings against its leg. The shoulder joint goes with it: forward as the arm comes forward and
    // back as it goes back, lifting a little at each end of the swing, and the arm swings in a little
    // across the body going forward and out going back. The elbow bends further at a run.
    const swing = [c, -c];
    const reach = 0.012 * walk + 0.01 * run, shrug = 0.006 * walk + 0.008 * run;
    for (let i = 0; i < 2; i++) {
      const arm = this.arms[i];
      arm.shoulder.rotation.x = -swing[i] * armAmp;
      arm.shoulder.position.set(0, shrug * swing[i] * swing[i], swing[i] * reach);
      arm.elbow.rotation.x = 0.2 + 0.25 * walk + 0.8 * run + Math.max(0, -swing[i]) * armAmp * 0.4;
      arm.shoulder.rotation.z = arm.side * (0.08 + 0.04 * swing[i] * walk);
      arm.hand.rotation.y = 0;
      grip(arm, 0);
    }
    // Knocking: the right shoulder up, the elbow bent, and the forearm swinging from it onto the door.
    const [blend, rap] = this.knockPose();
    if (blend > 0) {
      const { shoulder, elbow, hand } = this.arms[1], lerp = THREE.MathUtils.lerp;
      shoulder.rotation.x = lerp(shoulder.rotation.x, KNOCK_SHOULDER[0] + 0.08 * rap, blend);
      shoulder.rotation.z = lerp(shoulder.rotation.z, KNOCK_SHOULDER[1], blend);
      shoulder.position.lerp(this._v.set(0, KNOCK_LIFT, 0), blend); // the shoulder comes up with the arm
      elbow.rotation.x = lerp(elbow.rotation.x, lerp(KNOCK_ELBOW[0], KNOCK_ELBOW[1], rap), blend);
      hand.rotation.y = KNOCK_TWIST * blend;
      grip(this.arms[1], blend); // knocks with a fist
    }
    // The hips turn with the leg coming forward, drop on the side swinging through, and shift over the
    // planted boot (less at a run, where the boots land closer under the body). They sit lower while
    // walking so the planted leg reaches its boot, rising over it mid-stride at a walk. The torso undoes the
    // hips, so the shoulders turn and tilt against them, in step with the arms, and the chest turns on
    // further, spreading the twist up the spine.
    const hipYaw = 0.045 * walk + 0.035 * run, hipRoll = 0.02 * walk + 0.01 * run;
    const shoulderYaw = 0.04 * walk + 0.05 * run, shoulderRoll = 0.01 * walk + 0.008 * run;
    const chestYaw = 0.025 * walk + 0.02 * run;
    this.hips.position.set(-s * (0.006 * walk - 0.003 * run), HIP - 0.035 * (walk + run) + Math.abs(s) * 0.02 * walk * (1 - run) - PICK_DROP * this.crouch, 0);
    this.hips.rotation.set(0, -c * hipYaw, -s * hipRoll);
    this.torso.rotation.set(-bend, c * (hipYaw + shoulderYaw), s * (hipRoll + shoulderRoll));
    this.chest.rotation.y = c * chestYaw;
    const breath = Math.sin(this.time * 1.7) * (1 - walk);
    this.chest.scale.set(1 + breath * 0.012, 1 + breath * 0.008, 1 + breath * 0.02);
    this.chest.position.y = breath * 0.004;

    // The head follows the look a little: up and down, and side to side while walking another way.
    // Looked at from the front the look is near half a turn away, where it flips side, so the head
    // eases back to face ahead there rather than snapping from shoulder to shoulder.
    const turn = Math.atan2(Math.sin(player.yaw - this.facing), Math.cos(player.yaw - this.facing));
    const wantYaw = THREE.MathUtils.clamp(turn, -1.1, 1.1) * 0.7 * (1 - sstep(1.5, 2.4, Math.abs(turn)));
    this.headYaw += (wantYaw - this.headYaw) * (1 - Math.exp(-dt * HEAD_TURN));
    // The head takes out the body's lean, rock, twist and tilt, so the helmet stays on the look.
    this.head.rotation.set(
      THREE.MathUtils.clamp(player.pitch * 0.5, -0.35, 0.45) - this.torso.rotation.x - 0.45 * this.crouch, // and down at a pick-up
      this.headYaw - c * (shoulderYaw + chestYaw),
      -s * shoulderRoll,
    );
    this.stride(player, v, walk, run, first);

    // Picking up: the left forearm comes forward over the knee, and the right reaches down to the
    // thing, then brings it up in front of the chest.
    const lerp = THREE.MathUtils.lerp;
    if (this.crouch > 1e-3) {
      const { shoulder, elbow } = this.arms[0];
      shoulder.rotation.x = lerp(shoulder.rotation.x, 0.55, this.crouch);
      elbow.rotation.x = lerp(elbow.rotation.x, 0.9, this.crouch);
    }
    if (this.showK > 1e-3) {
      const { shoulder, elbow, hand } = this.arms[1];
      shoulder.rotation.x = lerp(shoulder.rotation.x, 0.45, this.showK);
      shoulder.rotation.z = lerp(shoulder.rotation.z, -0.25, this.showK);
      elbow.rotation.x = lerp(elbow.rotation.x, 1.75, this.showK);
      hand.rotation.y = lerp(hand.rotation.y, -0.9, this.showK); // the can turned up to look at
    }
    if (target && this.reachK > 1e-3) this.reachFor(target, this.reachK);
    if (gripK > 0) grip(this.arms[1], gripK);
  }
}
