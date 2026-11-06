import * as THREE from 'three';
import './style.css';
import { PRESETS, detectQuality } from './quality.js';
import { generateTextures } from './textures.js';
import { nextFrame } from './texture-core.js';
import { createMaterials } from './materials.js';
import { Batch, makeKit } from './batch.js';
import { buildAlley, ALLEY } from './alley.js';
import { buildSigns } from './signs.js';
import { SIGN_SPECS, SIGN_TEXT } from './sign-specs.js';
import { PlanarReflection, createGround } from './ground.js';
import { Footprints } from './footprints.js';
import { Splashes } from './splashes.js';
import { Vending, VEND_TURN, inReach } from './vending.js';
import { NeonFood } from './neon-food.js';
import { FOOD, FoodShop, FOOD_LIFT, foodLabel } from './food-shop.js';
import { Inventory } from './inventory.js';
import { CAN_LABELS } from './canvas-art.js';
import { createSky, Snow, Steam } from './atmosphere.js';
import { buildEnvironment } from './environment.js';
import { LightPool } from './lights.js';
import { createPost } from './post.js';
import { Player, CLOSE_UP } from './player.js';
import { Character, HEAD_LAYER, KNOCK_LEAD, KNOCK_REACH, PICK_STAND } from './character.js';
import { AmbientAudio } from './audio.js';
import { AdaptiveScale } from './adaptive-scale.js';
import { createBench } from './bench.js';
import { FpsCounter } from './fps-counter.js';
import { createQualityPills, createStates, progress, setFps, showError } from './ui.js';

const params = new URLSearchParams(location.search);
const qKey = PRESETS[params.get('q')] ? params.get('q') : detectQuality();
const Q = PRESETS[qKey];
const AUTO = params.has('autostart'); // used for automated screenshots
const FREEZE = AUTO || params.has('freeze');
const BENCH = params.has('bench'); // used for the performance baseline
const num = (k, d) => (params.has(k) ? parseFloat(params.get(k)) : d);
const BUY = 'BUY A DRINK ¥120', TAKE = 'TAKE THE DRINK', KNOCK = 'KNOCK', BAG_FULL = 'BAG FULL', KNOCK_COOLDOWN = 1000; // ms, no shorter than a knock (KNOCK_TIME in character.js)
const FOOD_COOLDOWN = 400; // ms, so a held key can't clear a counter

createQualityPills(qKey);

async function loadFonts() {
  if (!document.fonts) return;
  const text = SIGN_TEXT + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/.';
  const faces = ['900 64px "Noto Sans JP"', '700 64px "Noto Sans JP"', '900 64px "Orbitron"', '700 64px "Orbitron"', '500 64px "Orbitron"', '400 64px "Monoton"'];
  await Promise.race([
    Promise.all(faces.map((f) => document.fonts.load(f, text).catch(() => null))),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
}

async function init() {
  progress(0.01, 'Loading fonts');
  await loadFonts();

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, Q.maxDPR) * Q.renderScale;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = num('exposure', 1.05);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.getElementById('app').appendChild(renderer.domElement);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const fogColor = new THREE.Color('#100d1e');
  scene.fog = new THREE.FogExp2(fogColor, 0.0125);
  scene.background = fogColor;
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 700);

  const tx = await generateTextures(Q, aniso, (f, m) => progress(0.05 + f * 0.6, m));

  progress(0.68, 'Building the alley');
  await nextFrame();
  const mats = createMaterials(tx);
  const batch = new Batch();
  const kit = makeKit(batch, mats, 20261028);
  const alley = buildAlley(kit, mats, SIGN_SPECS);

  progress(0.76, 'Wiring the neon');
  await nextFrame();
  const signs = buildSigns(kit, mats, tx.holoText, Q.signPPM, scene);
  batch.build(scene);
  const vending = new Vending(alley.vending, mats, scene);
  const neonFood = new NeonFood(alley.neonForms, scene);
  renderer.localClippingEnabled = true; // the dishes rise through the counters
  const foodShop = new FoodShop(alley.foodSpots, mats, scene);

  const refl = new PlanarReflection(Q.reflScale);
  const ground = createGround(tx, Q, refl, renderer);
  scene.add(ground.mesh, ground.street);
  const footprints = new Footprints(tx.bootPrint, ground.uniforms, scene.fog);
  scene.add(footprints.mesh);
  const splashes = Q.splash ? new Splashes(scene.fog) : null;
  if (splashes) scene.add(splashes.rings, splashes.drops);

  const sky = createSky(fogColor);
  scene.add(sky);
  const snow = new Snow(Q.snow, scene.fog);
  scene.add(snow.points);
  const steam = new Steam(alley.vents, Q.steamPer, tx.cloud, scene.fog);
  scene.add(steam.mesh);

  scene.add(new THREE.HemisphereLight(0x6a72a8, 0x141018, 0.45));
  const pool = new LightPool(scene, Q.lights, [...signs.lights, ...alley.lights]);

  progress(0.84, 'Baking reflections');
  await nextFrame();
  scene.environment = buildEnvironment(renderer);
  scene.environmentIntensity = 0.5;

  const post = createPost(renderer, scene, camera, Q);
  const size = new THREE.Vector2();
  let redraw = false; // resizing clears the canvas, so a paused frame must be drawn again
  function resize() {
    redraw = true;
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    post.setSize(w, h, renderer.getPixelRatio());
    renderer.getDrawingBufferSize(size);
    refl.setSize(size.x, size.y);
  }
  resize();
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  const audio = new AmbientAudio();
  const start = { x: num('x', 0.35), z: num('z', 6), yaw: num('yaw', 0), pitch: num('pitch', 0.04), view: params.get('view') };
  vending.onLand = () => audio.clunk();
  foodShop.onLand = () => audio.clunk();
  const player = new Player(camera, renderer.domElement, { bounds: ALLEY, colliders: alley.colliders, start });
  // Each boot leaves its print, sound and splash as it plants, where it plants.
  const sole = new THREE.Vector3();
  const land = (left, v) => {
    character.soleAt(left, sole);
    footprints.add(sole, character.facing, left);
    if (ground.inWater(sole.x, sole.z)) {
      audio.splash(v);
      splashes?.add(sole, v, character.facing, left ? -1 : 1, player.vel);
    } else audio.step(v);
  };
  const character = new Character(scene);
  refl.cam.layers.enable(HEAD_LAYER); // the helmet always shows in puddles
  const showHead = () => {
    if (player.camDist > CLOSE_UP) camera.layers.enable(HEAD_LAYER); else camera.layers.disable(HEAD_LAYER);
  };

  if (params.has('test')) Object.assign(window, { __land: land, __player: player, __character: character, __alley: alley, __audio: audio, __ground: ground, __splashes: splashes }); // for the browser tests

  progress(0.9, 'Compiling shaders');
  await nextFrame();
  pool.update(camera);
  camera.layers.enable(HEAD_LAYER); // so the helmet's shaders compile too
  try { await renderer.compileAsync(scene, camera); } catch { renderer.compile(scene, camera); }

  const reaches = (spot) => inReach(spot, player.pos.x, player.pos.y, player.yaw);
  const inventory = new Inventory();
  const canItem = (flavour) => ({ id: `can:${CAN_LABELS[flavour][2]}`, name: CAN_LABELS[flavour][2], color: CAN_LABELS[flavour][0] });
  const foodItem = ({ name }) => ({ id: `food:${name}`, name });
  let nextKnock = 0, nextFood = 0;
  const knockAt = (door) => {
    if (performance.now() < nextKnock || character.picking) return;
    nextKnock = performance.now() + KNOCK_COOLDOWN;
    const knock = () => {
      nextKnock = performance.now() + KNOCK_COOLDOWN;
      character.knock(door);
      audio.knock(KNOCK_LEAD);
    };
    // The prompt shows from further back than the glove reaches, so the biker first walks up
    // to stand square in front of the door, as near as the walk bounds allow.
    if (Math.hypot(door.face - player.pos.x, door.z - player.pos.y) <= KNOCK_REACH) knock();
    else {
      const x = THREE.MathUtils.clamp(door.face - Math.sign(door.face) * KNOCK_REACH * 0.9, -ALLEY.walkX, ALLEY.walkX);
      player.walkTo(x, door.z, knock);
    }
  };
  // Taking a can: the biker walks up square to the bin if not there already, crouches and reaches in.
  // The can leaves the bin as the glove closes on it, and goes in the bag once the biker has stood up.
  const pickCan = () => {
    if (character.picking || character.knocking) return;
    const at = vending.nextPosition();
    if (!at) return;
    let item = null;
    const pick = () => character.pickUp(at, {
      onGrab: () => {
        const flavour = vending.take();
        if (flavour === null) return null;
        item = canItem(flavour);
        audio.pickup();
        return vending.heldCan(flavour);
      },
      onDone: () => inventory.add(item),
    });
    const { side } = alley.vending; // side points into the wall, so the biker stands out from the can the other way
    const x = THREE.MathUtils.clamp(at.x - side * PICK_STAND, -ALLEY.walkX, ALLEY.walkX);
    if (Math.hypot(x - player.pos.x, at.z - player.pos.y) <= 0.12) pick();
    else player.walkTo(x, at.z, pick);
  };
  // The action in reach as { label, use }, or null. A full bag still shows, so the player knows why.
  const full = { label: BAG_FULL, use: () => {} };
  const useAction = () => {
    if (!player.enabled) return null;
    const { x, y: z } = player.pos, yaw = player.yaw;
    if (reaches(alley.vending)) {
      const flavour = vending.nextFlavour();
      if (flavour === null) return { label: BUY, use: () => { if (vending.buy()) audio.whirr(VEND_TURN); } };
      const item = canItem(flavour);
      if (!inventory.canAdd(item.id)) return full;
      return { label: TAKE, use: pickCan };
    }
    const dish = foodShop.takeTarget(x, z, yaw);
    if (dish) {
      const item = foodItem(FOOD[dish.kind]);
      if (!inventory.canAdd(item.id)) return full;
      return { label: `TAKE ${item.name}`, use: () => { if (foodShop.take(dish)) { inventory.add(item); audio.pickup(); } } };
    }
    const food = foodShop.target(x, z, yaw);
    if (food) {
      return {
        label: foodLabel(food),
        use: () => {
          if (performance.now() < nextFood) return;
          nextFood = performance.now() + FOOD_COOLDOWN;
          foodShop.buy(food);
          neonFood.hide(food.form, food.index);
          audio.purchase();
          audio.whirr(FOOD_LIFT);
        },
      };
    }
    const door = alley.doors.find(reaches);
    return door ? { label: KNOCK, use: () => knockAt(door) } : null;
  };
  const states = createStates({
    player, audio, canvas: renderer.domElement, auto: AUTO || BENCH, inventory,
    onUse: () => useAction()?.use(),
    // Drinks a can or eats a dish from the bag.
    onConsume: (item) => { if (inventory.remove(item.id)) (item.id.startsWith('can:') ? audio.sip() : audio.bite()); },
  });
  const bench = BENCH ? createBench(renderer, player, ALLEY, num('bench', 600)) : null;

  // -------------------------------------------------------------- loop
  const adaptive = new AdaptiveScale();
  let last = performance.now(), lastHum = 0;
  const fpsCounter = new FpsCounter();
  let t = num('t', 0), frames = 0;
  function frame(now) {
    if (FREEZE && frames >= 12) { window.__ready = true; return; } // freeze for screenshots
    if (bench?.done) return;
    requestAnimationFrame(frame);
    const elapsed = Math.max(now - last, 0); // the first timestamp can be older than last
    last = now;
    if (!FREEZE && !BENCH && states.state === 'paused' && !redraw) {
      adaptive.reset();
      return;
    }
    redraw = false;
    const dt = FREEZE || BENCH ? 1 / 60 : Math.min(elapsed / 1000, 0.05);
    t += dt;
    bench?.begin();
    if (!FREEZE && !BENCH && states.state === 'play') {
      const scale = adaptive.sample(elapsed);
      if (scale !== null) {
        renderer.setPixelRatio(pixelRatio * scale);
        resize();
      }
    } else adaptive.reset();
    if (states.state === 'title') {
      player.yaw = start.yaw + Math.sin(t * 0.15) * 0.1;
      player.pitch = start.pitch + 0.04 + Math.sin(t * 0.11) * 0.03;
    }
    footprints.update(t);
    splashes?.update(t, camera, size.y);
    player.duck = character.duck; // a crouch from the last frame drops the camera
    const pick = character.picking;
    if (pick && !pick.done && player.view === 'first' && !player.moving) {
      // In first person the look eases round to the bin, as the body turns to it in third, so the
      // glove and the can show coming up from below.
      const want = Math.atan2(-(pick.target.x - player.pos.x), -(pick.target.z - player.pos.y));
      player.yaw += Math.atan2(Math.sin(want - player.yaw), Math.cos(want - player.yaw)) * (1 - Math.exp(-dt * 6));
    }
    player.dip = player.view === 'first' ? character.dip : 0;
    player.update(dt);
    character.update(dt, player);
    for (const left of character.landed) land(left, player.vel.length());
    showHead();
    vending.update(dt);
    neonFood.update(t);
    foodShop.update(dt);
    states.showPrompt(useAction()?.label ?? null);
    sky.position.copy(camera.position);
    signs.update(t);
    mats.blink.color.copy(mats.blinkBase).multiplyScalar(Math.sin(t * 4) > 0 ? 1 : 0.05);
    pool.update(camera);
    snow.update(t, camera, size.y);
    steam.update(t);
    ground.uniforms.uTime.value = t;
    refl.update(renderer, scene, camera, splashes
      ? [ground.mesh, ground.street, footprints.mesh, splashes.rings]
      : [ground.mesh, ground.street, footprints.mesh]);
    post.render(t);
    bench?.end();

    // About 30 Hz: often enough to keep the flicker's stutter in the hum.
    if (audio.ctx?.state === 'running' && now - lastHum >= 30) {
      lastHum = now;
      let hum = 0;
      for (const s of signs.lights) {
        const d2 = s.pos.distanceToSquared(camera.position);
        hum += s.state.factor * 3 / (1 + d2);
      }
      audio.setHum(hum);
    }
    const fps = fpsCounter.sample(elapsed);
    if (fps !== null) {
      const res = adaptive.scale < 1 ? ` · ${Math.round(adaptive.scale * 100)}%` : '';
      setFps(`${Math.round(fps)} FPS · ${Q.label}${res}`);
    }
    frames++;
  }
  progress(1, 'Ready');
  states.ready();
  bench?.loaded();
  requestAnimationFrame(frame);
}

init().catch((err) => {
  console.error(err);
  showError(err);
});
