// Page overlays, the title/play/paused state machine and global input.
import { PRESETS } from './quality.js';

const $ = (id) => document.getElementById(id);
const ui = {
  title: $('title'), bar: $('bar'), status: $('status'), enter: $('enter'),
  hud: $('hud'), pause: $('pause'), fps: $('fps'), sound: $('sound'), pauseButton: $('pause-button'), pills: $('qpills'),
  resume: $('resume'), pauseSound: $('pause-sound'), pausePills: $('pause-qpills'), vend: $('vend'),
  fullscreen: $('fullscreen'), lookPills: $('look-pills'), view: $('view-button'),
  keymap: $('keymap'), bag: $('bag'), bagButton: $('bag-button'), bagSlots: $('bag-slots'), bagCount: $('bag-count'),
};

const LOOK_SPEEDS = {
  slow: { label: 'Slow', speed: 0.6 },
  normal: { label: 'Normal', speed: 1 },
  fast: { label: 'Fast', speed: 1.6 },
};

// Where the player is, for carrying across a quality reload. Empty until play starts.
let currentView = () => ({});
// Mute and look speed also survive a quality reload, including one made while still loading.
const params = new URLSearchParams(location.search);
const startMuted = params.has('mute');
let isMuted = () => startMuted;
// First or third person, kept the same way.
let viewMode = () => params.get('view');
let lookKey = Object.hasOwn(LOOK_SPEEDS, params.get('look')) ? params.get('look') : 'normal';

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
        if (viewMode() === 'first') u.searchParams.set('view', 'first'); else u.searchParams.delete('view');
        if (lookKey !== 'normal') u.searchParams.set('look', lookKey); else u.searchParams.delete('look');
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
  ui.status.textContent = 'Something went wrong: ' + err.message + ' (WebGL 2 is required). Try refreshing the page, as this is often a temporary graphics hiccup.';
  ui.bar.style.background = '#ff3355';
}

export function setFps(text) {
  ui.fps.textContent = text;
}

// The key for each bag slot, in order: 1-9, 0, - and =, as along the number row.
export const SLOT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'];
const SLOT_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

// One cell per slot, filled in pick-up order, with the rest left empty. A filled cell uses its
// item when clicked or tapped (onPick gets the slot's index).
export function renderBag(inventory, onPick = null) {
  const cells = [];
  for (let i = 0; i < inventory.slots; i++) {
    const item = inventory.items[i];
    const cell = document.createElement('div');
    cell.className = item ? 'bag-slot' : 'bag-slot empty';
    if (item) {
      cell.textContent = item.name;
      if (item.color) cell.style.setProperty?.('--slot', item.color);
      if (SLOT_LABELS[i]) {
        const k = document.createElement('span');
        k.className = 'k';
        k.textContent = SLOT_LABELS[i];
        cell.appendChild(k);
      }
      if (onPick) cell.addEventListener('click', () => onPick(i));
      if (item.count > 1) {
        const n = document.createElement('span');
        n.className = 'n';
        n.textContent = `×${item.count}`;
        cell.appendChild(n);
      }
    }
    cells.push(cell);
  }
  ui.bagSlots.replaceChildren(...cells);
  ui.bagCount.textContent = `${inventory.items.length}/${inventory.slots}`;
  ui.bagButton.textContent = `BAG ${inventory.total}`;
}

export function createStates({ player, audio, canvas, auto, onUse, inventory = null, onConsume = null }) {
  let state = 'title';
  const hasLock = 'requestPointerLock' in canvas;
  const usesLock = () => !player.touch && hasLock;
  currentView = () => (state === 'title' ? {} : { x: player.pos.x, z: player.pos.y, yaw: player.yaw, pitch: player.pitch });

  // Browsers can refuse the lock just after Esc. Older ones return no promise and only fire pointerlockerror.
  const lock = () => canvas.requestPointerLock()?.catch(pause);
  // Set before the lock is released, so that release doesn't count as a pause.
  function setTouch(touch) {
    player.touch = touch;
    document.body.classList.toggle('touch', touch);
    if (touch && document.pointerLockElement) document.exitPointerLock();
  }

  function play() {
    state = 'play';
    player.enabled = !auto;
    ui.title.classList.add('hidden');
    ui.pause.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    setTouch(player.touch);
    if (!auto) {
      audio.start();
      audio.resume();
      if (usesLock()) lock();
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
  ui.pauseButton.addEventListener('click', pause);
  // The input actually used picks the mode. In play the mouse only takes over from
  // the canvas, as the lock would swallow the click on a HUD button.
  window.addEventListener('pointerdown', (e) => {
    const touch = e.pointerType !== 'mouse' || !hasLock;
    if (state === 'play' && !touch && e.target !== canvas) return;
    setTouch(touch);
    if (state === 'play' && !touch && !auto && !document.pointerLockElement) lock();
  }, true);
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && usesLock()) pause();
  });
  document.addEventListener('pointerlockerror', () => {
    if (usesLock()) pause();
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
  const showView = () => {
    ui.view.textContent = player.view === 'first' ? '1ST PERSON' : '3RD PERSON';
  };
  const toggleView = () => {
    player.toggleView();
    showView();
  };
  viewMode = () => player.view;
  showView();
  ui.view.addEventListener('click', toggleView);
  audio.muted = startMuted;
  isMuted = () => audio.muted;
  showSound();
  let showFps = false;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') toggleSound();
    if (e.code === 'KeyV' && !e.repeat && state === 'play') toggleView();
    if (e.code === 'KeyF') { showFps = !showFps; ui.fps.classList.toggle('hidden', !showFps); }
    if (e.code === 'Enter' && state === 'title' && !ui.enter.disabled) {
      setTouch(!hasLock);
      play();
    }
    if (e.code === 'KeyE' && !e.repeat && state === 'play') onUse();
    if (e.code === 'KeyI' && !e.repeat && state === 'play') toggleBag();
    if (e.code === 'KeyH' && !e.repeat) ui.keymap.classList.toggle('hidden');
  });
  ui.vend.addEventListener('click', onUse);
  const toggleBag = () => ui.bag.classList.toggle('hidden', !ui.bag.classList.contains('hidden'));
  ui.bagButton.addEventListener('click', toggleBag);
  if (inventory) {
    let bump = 0;
    const pick = (i) => { const item = inventory.items[i]; if (item) onConsume?.(item); };
    // With the bag open, the number row uses a slot (the pointer is locked on desktop, so it can't click).
    window.addEventListener('keydown', (e) => {
      const i = SLOT_KEYS.indexOf(e.code);
      if (i >= 0 && !e.repeat && state === 'play' && !ui.bag.classList.contains('hidden')) pick(i);
    });
    inventory.onChange = () => {
      renderBag(inventory, pick);
      // A short glow on the button, so a pick-up shows even with the bag closed.
      ui.bagButton.classList.add('bump');
      clearTimeout(bump);
      bump = setTimeout(() => ui.bagButton.classList.remove('bump'), 400);
    };
    renderBag(inventory, pick);
  }
  let shownPrompt = null;
  ui.sound.addEventListener('click', toggleSound);
  ui.pauseSound.addEventListener('click', toggleSound);

  // Left out where the browser can't do it, such as iPhone Safari.
  ui.fullscreen.classList.toggle('hidden', !document.fullscreenEnabled);
  ui.fullscreen.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen()?.catch(() => {});
  });
  document.addEventListener('fullscreenchange', () => {
    ui.fullscreen.textContent = document.fullscreenElement ? 'EXIT FULL' : 'FULLSCREEN';
  });

  player.lookSpeed = LOOK_SPEEDS[lookKey].speed;
  const lookPills = Object.entries(LOOK_SPEEDS).map(([k, { label, speed }]) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = 'pill' + (k === lookKey ? ' on' : '');
    b.addEventListener('click', () => {
      lookKey = k;
      player.lookSpeed = speed;
      for (const other of lookPills) other.className = 'pill' + (other === b ? ' on' : '');
    });
    ui.lookPills.appendChild(b);
    return b;
  });

  return {
    get state() { return state; },
    // Called every frame with the action in reach, or null for none.
    showPrompt(action) {
      const label = action && (player.touch ? 'TAP' : 'E') + ' · ' + action;
      if (label === shownPrompt) return;
      shownPrompt = label;
      ui.vend.classList.toggle('hidden', !action);
      if (action) ui.vend.textContent = label;
    },
    // Loading is finished: let the player in.
    ready() {
      ui.enter.disabled = false;
      ui.enter.textContent = player.touch ? 'TAP TO ENTER' : 'ENTER THE ALLEY';
      if (auto) play();
    },
  };
}
