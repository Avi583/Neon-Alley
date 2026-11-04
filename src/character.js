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
import { HEAD_LAYER, createMaterials, part, buildArm, buildLeg, buildHelmet, buildJacket, buildSeat, grip } from './character-build.js';

export { HEAD_LAYER };
const HIP = 0.955; // hip height, so the boot soles sit on the ground
const TURN = 10; // how fast the body turns to face where it walks
const HEAD_TURN = 8; // how fast the head eases round to the look
const NECK_UP = 0.6; // from the hips to the base of the neck
const FIRST_BACK = 0.12; // in first person the body sits this far behind the eye, so looking down shows the chest and boots
const SOLE = new THREE.Vector3(0, -0.225, -0.06); // the middle of the sole's tread, in the boot's frame
// Along the sole from the ankle (the boot's origin), forward: the heel and ball it rolls on, and the
// middle (SOLE). The ankle sits ANKLE_UP over the tread.
const HEEL = -0.06, BALL = 0.15, MID = -SOLE.z, ANKLE_UP = -SOLE.y;
const STRAIGHT = 0.005; // the planted leg stops this short of straight
const MIN_WALK = 0.6; // slower than this, as in player.js, no step lands
const LOCK = 0.3; // slower than this the boots follow the walk cycle rather than staying put
const TAU = Math.PI * 2;
// Knocking: the right arm comes up over KNOCK_LEAD, raps on each of KNOCK_RAPS after it, and is
// back at rest by KNOCK_TIME, inside the 1 s knock cooldown in main.js.
export const KNOCK_LEAD = 0.3, KNOCK_TIME = 0.95;
export const KNOCK_REACH = 0.8; // how far from a door's face the glove reaches it; main.js walks the biker in from further
const KNOCK_OUT = 0.75; // when the arm starts down again, after the last rap
const KNOCK_SHOULDER = [1.15, -0.2], KNOCK_ELBOW = [1.75, 1.05]; // shoulder [forward, out]; elbow [cocked, on the door]
const KNOCK_TWIST = -Math.PI / 2; // the glove turns palm to the biker, so the knuckles meet the door

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
      let lo = pitch, hi = ahead ? 0.9 : -1.2;
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
  // level and facing ahead rather than turning on its ankle. blend eases it in from standing.
  poseLeg(leg, a, pitch, blend, walk) {
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
    leg.boot.rotation.set(lerp(0, pitch - hip - knee, blend), -this.hips.rotation.y, -leg.hip.rotation.z - this.hips.rotation.z);
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
    const lift = 0.07 * walk + 0.1 * run;
    const blend = sstep(0.05, 0.5, v);
    for (let i = 0; i < 2; i++) {
      const foot = this.feet[i], leg = this.legs[i];
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
        foot.ankle.lerpVectors(foot.from, this._end, e).y += lift * Math.sin(Math.PI * q);
        foot.pitch = THREE.MathUtils.lerp(foot.fromPitch, endPitch, e);
      }
      foot.stance = down;
      foot.ready = true;
      this.poseLeg(leg, foot.ankle, foot.pitch, blend, walk);
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
    if (first) this.facing = player.yaw;
    else if (v > 0.3 || this.knocking) {
      const want = this.knocking && !player.moving
        ? Math.atan2(-(k.x - player.pos.x), -(k.z - player.pos.y)) // turn to the door
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
    const back = first ? FIRST_BACK + Math.sin(lean) * NECK_UP : 0;
    this.root.position.set(player.pos.x + Math.sin(this.facing) * back, 0, player.pos.y + Math.cos(this.facing) * back);
    this.root.rotation.y = this.facing;
    const b = player.bob;
    const c = Math.cos(b), s = Math.sin(b);
    const armAmp = 0.24 * walk + 0.41 * run;
    // The left heel strikes at cos(bob) = 1, the right at -1, as player.js counts each step; each arm
    // swings against its leg.
    const swing = [c, -c];
    for (let i = 0; i < 2; i++) {
      const arm = this.arms[i];
      arm.shoulder.rotation.x = -swing[i] * armAmp;
      arm.elbow.rotation.x = 0.2 + 0.25 * walk + 0.5 * run + Math.max(0, -swing[i]) * armAmp * 0.4;
      arm.shoulder.rotation.z = arm.side * 0.08;
      arm.hand.rotation.y = 0;
      grip(arm, 0);
    }
    // Knocking: the right shoulder up, the elbow bent, and the forearm swinging from it onto the door.
    const [blend, rap] = this.knockPose();
    if (blend > 0) {
      const { shoulder, elbow, hand } = this.arms[1], lerp = THREE.MathUtils.lerp;
      shoulder.rotation.x = lerp(shoulder.rotation.x, KNOCK_SHOULDER[0] + 0.08 * rap, blend);
      shoulder.rotation.z = lerp(shoulder.rotation.z, KNOCK_SHOULDER[1], blend);
      elbow.rotation.x = lerp(elbow.rotation.x, lerp(KNOCK_ELBOW[0], KNOCK_ELBOW[1], rap), blend);
      hand.rotation.y = KNOCK_TWIST * blend;
      grip(this.arms[1], blend); // knocks with a fist
    }
    // The hips turn with the leg coming forward, drop on the side swinging through, and shift over the
    // planted boot (less at a run, where the boots land closer under the body). They sit lower while
    // walking so the planted leg reaches its boot, rising over it mid-stride at a walk. The torso undoes the
    // hips, so the shoulders turn and tilt against them, in step with the arms, and the chest turns on
    // further, spreading the twist up the spine.
    const hipYaw = 0.08 * walk + 0.06 * run, hipRoll = 0.04 * walk + 0.02 * run;
    const shoulderYaw = 0.07 * walk + 0.08 * run, shoulderRoll = 0.025 * walk + 0.015 * run;
    const chestYaw = 0.05 * walk + 0.03 * run;
    this.hips.position.set(-s * (0.015 * walk - 0.008 * run), HIP - 0.035 * (walk + run) + Math.abs(s) * 0.02 * walk * (1 - run), 0);
    this.hips.rotation.set(0, -c * hipYaw, -s * hipRoll);
    this.torso.rotation.set(-lean, c * (hipYaw + shoulderYaw), s * (hipRoll + shoulderRoll));
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
      THREE.MathUtils.clamp(player.pitch * 0.5, -0.35, 0.45) - this.torso.rotation.x,
      this.headYaw - c * (shoulderYaw + chestYaw),
      -s * shoulderRoll,
    );
    this.stride(player, v, walk, run, first);
  }
}
