// The biker the player walks as: full-face helmet, leather biker jacket, biker
// gloves, jeans and boots. The body, sleeves and jean legs are lofted from
// cross-sections, and each sleeve and leg is one skinned mesh that bends at the
// elbow or knee, so no joints show. The bones are the pivots the walk cycle
// swings, in step with the footsteps from player.js.
// The geometry helpers are in character-geometry.js and the parts in character-build.js.
import * as THREE from 'three';
import { sstep } from './math.js';
import { KNOCK_RAPS } from './audio.js';
import { HEAD_LAYER, createMaterials, part, buildArm, buildLeg, buildHelmet, buildJacket, buildSeat, grip } from './character-build.js';

export { HEAD_LAYER };
const HIP = 0.955; // hip height, so the boot soles sit on the ground
const TURN = 10; // how fast the body turns to face where it walks
const HEAD_TURN = 8; // how fast the head eases round to the look
const NECK_UP = 0.6; // from the hips to the base of the neck
const FIRST_BACK = 0.12; // in first person the body sits this far behind the eye, so looking down shows the chest and boots
const SOLE = new THREE.Vector3(0, -0.225, -0.06); // the middle of the sole's tread, in the boot's frame
// A boot swinging through faster than SWING times the walking speed lands once it slows under PLANT
// times it: the walk is too low-stepped at a walk to tell landing from the boot's height.
const SWING = 1.2, PLANT = 0.3;
const MIN_WALK = 0.6; // slower than this, as in player.js, no step lands
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
    this.feet = [0, 1].map(() => ({ at: new THREE.Vector3(), seen: false, swing: false }));
    this.landed = []; // the boots that planted on the last update, true for the left
    this._sole = new THREE.Vector3();
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

  // Fills this.landed with the boots (true for the left) that planted this frame: each one's
  // sole is followed along the walk, and lands as it slows from swinging through to standing.
  findLandings(dt, player, v) {
    this.landed.length = 0;
    const dx = player.vel.x / (v || 1), dz = player.vel.y / (v || 1);
    for (let i = 0; i < 2; i++) {
      const foot = this.feet[i], left = i === 0;
      this.soleAt(left, this._sole);
      const ahead = foot.seen && dt > 0 ? ((this._sole.x - foot.at.x) * dx + (this._sole.z - foot.at.z) * dz) / dt : 0;
      foot.at.copy(this._sole);
      foot.seen = true;
      if (v < MIN_WALK) foot.swing = false;
      else if (ahead > SWING * v) foot.swing = true;
      else if (foot.swing && ahead < PLANT * v) {
        foot.swing = false;
        this.landed.push(left);
      }
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
    const legAmp = 0.42 * walk + 0.28 * run;
    const armAmp = 0.3 * walk + 0.35 * run;
    // The left heel strikes at cos(bob) = 1, the right at -1, as player.js counts each step.
    const swing = [c, -c];
    for (let i = 0; i < 2; i++) {
      const leg = this.legs[i], arm = this.arms[i];
      leg.hip.rotation.x = swing[i] * legAmp;
      // The knee bends while the leg comes forward.
      leg.knee.rotation.x = -Math.max(0, i === 0 ? -s : s) * (legAmp * 1.6) - 0.05 * walk;
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
    // planted boot (less at a run, where the boots land closer under the body). The torso undoes the
    // hips, so the shoulders turn and tilt against them, in step with the arms, and the chest turns on
    // further, spreading the twist up the spine.
    const hipYaw = 0.08 * walk + 0.06 * run, hipRoll = 0.04 * walk + 0.02 * run;
    const shoulderYaw = 0.07 * walk + 0.08 * run, shoulderRoll = 0.025 * walk + 0.015 * run;
    const chestYaw = 0.05 * walk + 0.03 * run;
    this.hips.position.set(-s * (0.015 * walk - 0.008 * run), HIP - 0.02 * walk + Math.abs(s) * (0.025 * walk + 0.02 * run), 0);
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
    this.findLandings(dt, player, v);
  }
}
