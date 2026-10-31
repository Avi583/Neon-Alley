// Page overlays, the title/play/paused state machine and global input.
import { PRESETS } from './quality.js';

const $ = (id) => document.getElementById(id);
const ui = {
  title: $('title'), bar: $('bar'), status: $('status'), enter: $('enter'),
  hud: $('hud'), pause: $('pause'), fps: $('fps'), sound: $('sound'), pills: $('qpills'),
  resume: $('resume'), pauseSound: $('pause-sound'), pausePills: $('pause-qpills'), vend: $('vend'),
};

// Where the player is, for carrying across a quality reload. Empty until play starts.
let currentView = () => ({});
// Mute also survives a quality reload, including one made while still loading.
const startMuted = new URLSearchParams(location.search).has('mute');
let isMuted = () => startMuted;

export function createQualityPills(qKey) {
  for (const box of [ui.pills, ui.pausePills]) {
    for (const [k, p] of Object.entries(PRESETS)) {
      const b = document.createElement('button');
      b.textContent = p.label;
      b.className = 'pill' + (k === qKey ? ' on' : '');
      b.addEventListener('click', () => {
        if (k === qKey) return;
        const u = new URL(location.href);
        u.searchParams.set('q', k);
        for (const [key, v] of Object.entries(currentView())) u.searchParams.set(key, v.toFixed(3));
        if (isMuted()) u.searchParams.set('mute', '1'); else u.searchParams.delete('mute');
        location.href = u.toString();
      });
      box.appendChild(b);
    }
  }
}

export function progress(f, msg) {
  ui.bar.style.width = (f * 100).toFixed(1) + '%';
  ui.status.textContent = msg;
}

export function showError(err) {
  ui.status.textContent = 'Something went wrong: ' + err.message + ' (WebGL 2 is required)';
  ui.bar.style.background = '#ff3355';
}

export function setFps(text) {
  ui.fps.textContent = text;
}

export function createStates({ player, audio, canvas, auto, onUse }) {
  let state = 'title';
  const hasLock = !player.touch && 'requestPointerLock' in canvas;
  currentView = () => (state === 'title' ? {} : { x: player.pos.x, z: player.pos.y, yaw: player.yaw, pitch: player.pitch });

  function play() {
    state = 'play';
    player.enabled = !auto;
    ui.title.classList.add('hidden');
    ui.pause.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    document.body.classList.toggle('touch', player.touch);
    if (!auto) {
      audio.start();
      audio.resume();
      // Browsers can refuse the lock just after Esc. Older ones return no promise and only fire pointerlockerror.
      if (hasLock) canvas.requestPointerLock()?.catch(pause);
    }
  }
  function pause() {
    if (state !== 'play') return;
    state = 'paused';
    player.enabled = false;
    player.keys.clear();
    ui.pause.classList.remove('hidden');
    audio.suspend();
  }
  ui.enter.addEventListener('click', play);
  ui.resume.addEventListener('click', play);
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && hasLock) pause();
  });
  document.addEventListener('pointerlockerror', () => {
    if (hasLock) pause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.suspend();
    else if (state === 'play') audio.resume();
  });
  const showSound = () => {
    ui.sound.textContent = ui.pauseSound.textContent = audio.muted ? 'SOUND OFF' : 'SOUND ON';
  };
  const toggleSound = () => {
    audio.toggleMute();
    showSound();
  };
  audio.muted = startMuted;
  isMuted = () => audio.muted;
  showSound();
  let showFps = false;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') toggleSound();
    if (e.code === 'KeyF') { showFps = !showFps; ui.fps.classList.toggle('hidden', !showFps); }
    if (e.code === 'Enter' && state === 'title' && !ui.enter.disabled) play();
    if (e.code === 'KeyE' && !e.repeat && state === 'play') onUse();
  });
  ui.vend.textContent = (player.touch ? 'TAP' : 'E') + ' · BUY A DRINK ¥120';
  ui.vend.addEventListener('click', onUse);
  ui.sound.addEventListener('click', toggleSound);
  ui.pauseSound.addEventListener('click', toggleSound);

  return {
    get state() { return state; },
    showVendPrompt(show) { ui.vend.classList.toggle('hidden', !show); },
    // Loading is finished: let the player in.
    ready() {
      ui.enter.disabled = false;
      ui.enter.textContent = player.touch ? 'TAP TO ENTER' : 'ENTER THE ALLEY';
      if (auto) play();
    },
  };
}
