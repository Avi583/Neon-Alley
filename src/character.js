// The biker the player walks as: full-face helmet, leather biker jacket, biker
// gloves, jeans and boots. The body, sleeves and jean legs are lofted from
// cross-sections, and each sleeve and leg is one skinned mesh that bends at the
// elbow or knee, so no joints show. The bones are the pivots the walk cycle
// swings, in step with player.bob: each boot stays where it lands while the body
// walks over it, and swings through to land again a step ahead.
// The legs' stride is in character-legs.js, the geometry helpers in character-geometry.js, the
// parts in character-build.js and the helmet in character-helmet.js.
import * as THREE from 'three';
import { sstep, wrapAngle, yawTo, damp, lawOfCosines } from './math.js';
import { KNOCK_RAPS } from './audio.js';
import { walkShare, runShare } from './player.js';
import { Legs } from './character-legs.js';
import { HEAD_LAYER, createMaterials, part, buildArm, buildLeg, buildJacket, buildSeat, grip } from './character-build.js';
import { buildHelmet } from './character-helmet.js';

export { HEAD_LAYER };
const HIP = 0.955; // hip height, so the boot soles sit on the ground
const TURN = 10; // how fast the body turns to face where it walks
const HEAD_TURN = 8; // how fast the head eases round to the look
const NECK_UP = 0.6; // from the hips to the base of the neck
const FIRST_BACK = 0.12; // in first person the body sits this far behind the eye, so looking down shows the chest and boots
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
const lerp = THREE.MathUtils.lerp;

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
    this.legRig = new Legs(this.hips, this.legs);
    this._v = new THREE.Vector3();
    this._w = new THREE.Vector3();
    scene.add(this.root);
  }

  // Each boot's stride state, and the boots (true for the left) that planted on the last update.
  get feet() { return this.legRig.feet; }
  get landed() { return this.legRig.landed; }

  // The point on the ground under the middle of a boot's sole, from the bones as update last posed them.
  soleAt(left, out) {
    return this.legRig.soleAt(left, out);
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
    const roll = Math.asin(THREE.MathUtils.clamp(p.x, -1, 1));
    const aim = Math.atan2(-p.z, -p.y);
    const open = lawOfCosines(UPPER, d, LOWER);
    const bend = Math.PI - lawOfCosines(UPPER, LOWER, d);
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
    const ease = damp(PICK_EASE, dt);
    this.crouch += (crouchTo - this.crouch) * ease;
    this.reachK += (reachTo - this.reachK) * ease;
    this.showK += (showTo - this.showK) * ease;
    this.duck = PICK_EYE * this.crouch;
    this.dip = PICK_DIP * this.crouch;
    if (first) this.facing = player.yaw;
    else if (v > 0.3 || this.knocking || this.picking) {
      const focus = this.knocking ?? (this.picking && !this.picking.done ? { x: target.x, z: target.z } : null);
      const want = focus && !player.moving
        ? yawTo(player.pos.x, player.pos.y, focus.x, focus.z) // turn to the door, or the pick-up
        : Math.atan2(-player.vel.x, -player.vel.y);
      this.facing += wrapAngle(want - this.facing) * damp(TURN, dt);
    }
    // walk: 0 standing to 1 at walking pace; run: 0 walking to 1 at full run.
    const walk = walkShare(v), run = runShare(v);
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
      const { shoulder, elbow, hand } = this.arms[1];
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
    const turn = wrapAngle(player.yaw - this.facing);
    const wantYaw = THREE.MathUtils.clamp(turn, -1.1, 1.1) * 0.7 * (1 - sstep(1.5, 2.4, Math.abs(turn)));
    this.headYaw += (wantYaw - this.headYaw) * damp(HEAD_TURN, dt);
    // The head takes out the body's lean, rock, twist and tilt, so the helmet stays on the look.
    this.head.rotation.set(
      THREE.MathUtils.clamp(player.pitch * 0.5, -0.35, 0.45) - this.torso.rotation.x - 0.45 * this.crouch, // and down at a pick-up
      this.headYaw - c * (shoulderYaw + chestYaw),
      -s * shoulderRoll,
    );
    this.legRig.stride(player, v, walk, run, first, this.facing, this.crouch, dt);

    // Picking up: the left forearm comes forward over the knee, and the right reaches down to the
    // thing, then brings it up in front of the chest.
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
