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
import { Vending, inReach } from './vending.js';
import { NeonFood } from './neon-food.js';
import { createSky, Snow, Steam } from './atmosphere.js';
import { buildEnvironment } from './environment.js';
import { LightPool } from './lights.js';
import { createPost } from './post.js';
import { Player } from './player.js';
import { AmbientAudio } from './audio.js';
import { AdaptiveScale } from './adaptive-scale.js';
import { createBench } from './bench.js';
import { createQualityPills, createStates, progress, setFps, showError } from './ui.js';

const params = new URLSearchParams(location.search);
const qKey = PRESETS[params.get('q')] ? params.get('q') : detectQuality();
const Q = PRESETS[qKey];
const AUTO = params.has('autostart'); // used for automated screenshots
const FREEZE = AUTO || params.has('freeze');
const BENCH = params.has('bench'); // used for the performance baseline
const num = (k, d) => (params.has(k) ? parseFloat(params.get(k)) : d);
const BUY = 'BUY A DRINK ¥120', KNOCK = 'KNOCK', KNOCK_COOLDOWN = 1000; // ms, the length of three raps

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

  const refl = new PlanarReflection(Q.reflScale);
  const ground = createGround(tx, Q, refl, renderer);
  scene.add(ground.mesh, ground.street);
  const footprints = new Footprints(tx.bootPrint, ground.uniforms, scene.fog);
  scene.add(footprints.mesh);

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
  const start = { x: num('x', 0.35), z: num('z', 6), yaw: num('yaw', 0), pitch: num('pitch', 0.04) };
  const player = new Player(camera, renderer.domElement, {
    bounds: ALLEY, colliders: alley.colliders, start,
    onStep: (v) => {
      audio.step(v);
      footprints.add(player.pos, player.yaw);
    },
  });

  progress(0.9, 'Compiling shaders');
  await nextFrame();
  pool.update(camera);
  try { await renderer.compileAsync(scene, camera); } catch { renderer.compile(scene, camera); }

  const reaches = (spot) => inReach(spot, player.pos.x, player.pos.y, player.yaw);
  const useAction = () => {
    if (!player.enabled) return null;
    if (reaches(alley.vending)) return BUY;
    return alley.doors.some(reaches) ? KNOCK : null;
  };
  let nextKnock = 0;
  const states = createStates({
    player, audio, canvas: renderer.domElement, auto: AUTO || BENCH,
    onUse: () => {
      const action = useAction();
      if (action === BUY && vending.buy()) audio.clunk();
      if (action === KNOCK && performance.now() >= nextKnock) {
        nextKnock = performance.now() + KNOCK_COOLDOWN;
        audio.knock();
      }
    },
  });
  const bench = BENCH ? createBench(renderer, player, ALLEY, num('bench', 600)) : null;

  // -------------------------------------------------------------- loop
  const adaptive = new AdaptiveScale();
  let last = performance.now(), lastHum = 0;
  let t = num('t', 0), frames = 0, fpsFrames = 0, fpsTime = 0;
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
    player.update(dt);
    vending.update(dt);
    neonFood.update(t);
    states.showPrompt(useAction());
    sky.position.copy(camera.position);
    signs.update(t);
    mats.blink.color.copy(mats.blinkBase).multiplyScalar(Math.sin(t * 4) > 0 ? 1 : 0.05);
    pool.update(camera);
    snow.update(t, camera, size.y);
    steam.update(t);
    ground.uniforms.uTime.value = t;
    refl.update(renderer, scene, camera, [ground.mesh, ground.street, footprints.mesh]);
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
    fpsFrames++; fpsTime += elapsed / 1000;
    if (fpsTime > 0.5) {
      const res = adaptive.scale < 1 ? ` · ${Math.round(adaptive.scale * 100)}%` : '';
      setFps(`${Math.round(fpsFrames / fpsTime)} FPS · ${Q.label}${res}`);
      fpsFrames = 0; fpsTime = 0;
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
