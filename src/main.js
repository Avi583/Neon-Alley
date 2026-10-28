import * as THREE from 'three';
import './style.css';
import { PRESETS, detectQuality } from './quality.js';
import { generateTextures, nextFrame } from './textures.js';
import { createMaterials, hdr } from './materials.js';
import { Batch, makeKit } from './batch.js';
import { buildAlley, ALLEY } from './alley.js';
import { buildSigns, SIGN_SPECS, SIGN_TEXT } from './signs.js';
import { PlanarReflection, createGround } from './ground.js';
import { createSky, Snow, Steam } from './atmosphere.js';
import { LightPool } from './lights.js';
import { createPost } from './post.js';
import { Player } from './player.js';
import { AmbientAudio } from './audio.js';

const params = new URLSearchParams(location.search);
const qKey = PRESETS[params.get('q')] ? params.get('q') : detectQuality();
const Q = PRESETS[qKey];
const AUTO = params.has('autostart'); // used for automated screenshots
const FREEZE = AUTO || params.has('freeze');
const num = (k, d) => (params.has(k) ? parseFloat(params.get(k)) : d);

const $ = (id) => document.getElementById(id);
const ui = {
  title: $('title'), bar: $('bar'), status: $('status'), enter: $('enter'),
  hud: $('hud'), pause: $('pause'), fps: $('fps'), sound: $('sound'), pills: $('qpills'),
};

for (const [k, p] of Object.entries(PRESETS)) {
  const b = document.createElement('button');
  b.textContent = p.label;
  b.className = 'pill' + (k === qKey ? ' on' : '');
  b.addEventListener('click', () => {
    if (k === qKey) return;
    const u = new URL(location.href);
    u.searchParams.set('q', k);
    location.href = u.toString();
  });
  ui.pills.appendChild(b);
}

function progress(f, msg) {
  ui.bar.style.width = (f * 100).toFixed(1) + '%';
  ui.status.textContent = msg;
}

async function loadFonts() {
  if (!document.fonts) return;
  const text = SIGN_TEXT + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/.';
  const faces = ['900 64px "Noto Sans JP"', '700 64px "Noto Sans JP"', '900 64px "Orbitron"', '700 64px "Orbitron"', '500 64px "Orbitron"', '400 64px "Monoton"'];
  await Promise.race([
    Promise.all(faces.map((f) => document.fonts.load(f, text).catch(() => null))),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
}

// A tiny neon "room" baked into an environment map, so metal, glass, ice
// and wet surfaces pick up coloured highlights from every angle.
function buildEnvironment(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: 0x07060e, side: THREE.BackSide })));
  const panel = (hex, k, x, y, z, w, h, ry, rx = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: hdr(hex, k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m);
  };
  panel('#ff3fa4', 6, -9.5, 2, -3, 4, 1.4, Math.PI / 2);
  panel('#38e8ff', 6, 9.5, 3, -5, 3, 1.2, -Math.PI / 2);
  panel('#b66bff', 4, -9.5, 5, 5, 2, 3, Math.PI / 2);
  panel('#ffd08a', 3, 9.5, 1, 4, 4, 1, -Math.PI / 2);
  panel('#ff4d6d', 5, 0, 4, -9.5, 6, 1, 0);
  panel('#5dffb4', 3, 0, 2, 9.5, 3, 0.8, Math.PI);
  panel('#2a3260', 0.8, 0, 9.5, 0, 20, 20, 0, Math.PI / 2);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.03).texture;
  pm.dispose();
  return tex;
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
  $('app').appendChild(renderer.domElement);
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

  const refl = new PlanarReflection(Q.reflScale);
  const ground = createGround(tx, Q, refl);
  scene.add(ground.mesh, ground.street);

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
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    post.setSize(w, h, renderer.getPixelRatio());
    renderer.getDrawingBufferSize(size);
    refl.setSize(size.x, size.y);
  }
  resize();
  window.addEventListener('resize', resize);

  const audio = new AmbientAudio();
  const start = { x: num('x', 0.35), z: num('z', 6), yaw: num('yaw', 0), pitch: num('pitch', 0.04) };
  const player = new Player(camera, renderer.domElement, {
    bounds: ALLEY, colliders: alley.colliders, start, onStep: (v) => audio.step(v),
  });

  progress(0.9, 'Compiling shaders');
  await nextFrame();
  pool.update(camera);
  try { await renderer.compileAsync(scene, camera); } catch { renderer.compile(scene, camera); }

  // ------------------------------------------------------------ states
  let state = 'title';
  const hasLock = !player.touch && 'requestPointerLock' in renderer.domElement;

  function play() {
    state = 'play';
    player.enabled = !AUTO;
    ui.title.classList.add('hidden');
    ui.pause.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    document.body.classList.toggle('touch', player.touch);
    if (!AUTO) {
      audio.start();
      audio.resume();
      if (hasLock) renderer.domElement.requestPointerLock();
    }
  }
  ui.enter.addEventListener('click', play);
  ui.pause.addEventListener('click', play);
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && state === 'play' && hasLock) {
      state = 'paused';
      player.enabled = false;
      player.keys.clear();
      ui.pause.classList.remove('hidden');
      audio.suspend();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.suspend();
    else if (state === 'play') audio.resume();
  });
  let showFps = false;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') ui.sound.textContent = audio.toggleMute() ? 'SOUND OFF' : 'SOUND ON';
    if (e.code === 'KeyF') { showFps = !showFps; ui.fps.classList.toggle('hidden', !showFps); }
    if (e.code === 'Enter' && state === 'title' && !ui.enter.disabled) play();
  });
  ui.sound.addEventListener('click', () => { ui.sound.textContent = audio.toggleMute() ? 'SOUND OFF' : 'SOUND ON'; });

  // -------------------------------------------------------------- loop
  let last = performance.now();
  let t = num('t', 0), frames = 0, fpsFrames = 0, fpsTime = 0;
  function frame() {
    if (FREEZE && frames >= 12) { window.__ready = true; return; } // freeze for screenshots
    requestAnimationFrame(frame);
    const dt = FREEZE ? 1 / 60 : Math.min((performance.now() - last) / 1000, 0.05);
    last = performance.now();
    t += dt;
    if (state === 'title') {
      player.yaw = start.yaw + Math.sin(t * 0.15) * 0.1;
      player.pitch = start.pitch + 0.04 + Math.sin(t * 0.11) * 0.03;
    }
    player.update(dt);
    sky.position.copy(camera.position);
    signs.update(t);
    mats.blink.color.copy(mats.blinkBase).multiplyScalar(Math.sin(t * 4) > 0 ? 1 : 0.05);
    pool.update(camera);
    renderer.getDrawingBufferSize(size);
    snow.update(t, camera, size.y);
    steam.update(t);
    ground.uniforms.uTime.value = t;
    refl.update(renderer, scene, camera, [ground.mesh, ground.street]);
    post.render(t);

    if (audio.ctx) {
      let hum = 0;
      for (const s of signs.lights) {
        const d2 = s.pos.distanceToSquared(camera.position);
        hum += s.spec.factor * 3 / (1 + d2);
      }
      audio.setHum(hum);
    }
    fpsFrames++; fpsTime += dt;
    if (fpsTime > 0.5) { ui.fps.textContent = `${Math.round(fpsFrames / fpsTime)} FPS · ${Q.label}`; fpsFrames = 0; fpsTime = 0; }
    frames++;
  }
  frame();

  progress(1, 'Ready');
  ui.enter.disabled = false;
  ui.enter.textContent = player.touch ? 'TAP TO ENTER' : 'ENTER THE ALLEY';
  if (AUTO) play();
}

init().catch((err) => {
  console.error(err);
  ui.status.textContent = 'Something went wrong: ' + err.message + ' (WebGL 2 is required)';
  ui.bar.style.background = '#ff3355';
});
