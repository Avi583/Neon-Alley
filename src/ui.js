// Page overlays, the title/play/paused state machine and global input.
import { PRESETS } from './quality.js';

const $ = (id) => document.getElementById(id);
const ui = {
  title: $('title'), bar: $('bar'), status: $('status'), enter: $('enter'),
  hud: $('hud'), pause: $('pause'), fps: $('fps'), sound: $('sound'), pills: $('qpills'),
};

export function createQualityPills(qKey) {
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

export function createStates({ player, audio, canvas, auto }) {
  let state = 'title';
  const hasLock = !player.touch && 'requestPointerLock' in canvas;

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
      if (hasLock) canvas.requestPointerLock();
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

  return {
    get state() { return state; },
    // Loading is finished: let the player in.
    ready() {
      ui.enter.disabled = false;
      ui.enter.textContent = player.touch ? 'TAP TO ENTER' : 'ENTER THE ALLEY';
      if (auto) play();
    },
  };
}
