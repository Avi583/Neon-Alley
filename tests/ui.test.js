import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let listeners, elements;

function eventTarget() {
  const own = {};
  return {
    addEventListener(type, fn) { (own[type] ||= []).push(fn); },
    fire(type, event = {}) { for (const fn of own[type] || []) fn(event); },
  };
}

function fakeElement() {
  const classes = new Set();
  return {
    ...eventTarget(),
    style: {},
    textContent: '',
    className: '',
    children: [],
    disabled: true,
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)),
    },
    appendChild(child) { this.children.push(child); },
    replaceChildren(...nodes) { this.children = nodes; },
  };
}

const el = (id) => (elements[id] ||= fakeElement());

// ui.js looks up its elements and reads the URL on import, so each test imports it afresh.
async function loadUi(search = '') {
  vi.resetModules();
  listeners = { window: eventTarget(), document: eventTarget() };
  elements = {};
  vi.stubGlobal('window', listeners.window);
  vi.stubGlobal('document', { ...listeners.document, hidden: false, pointerLockElement: null, getElementById: el, createElement: fakeElement, body: fakeElement() });
  vi.stubGlobal('location', { search, href: `https://x.test/alley/${search}` });
  return import('../src/ui.js');
}

function fakes({ touch = false, lock = () => Promise.resolve() } = {}) {
  return {
    player: { touch, enabled: false, keys: new Set(['KeyW']), pos: { x: 1.5, y: -2.25 }, yaw: 0.5, pitch: 0.125 },
    audio: {
      muted: false,
      start: vi.fn(), resume: vi.fn(), suspend: vi.fn(),
      toggleMute() { this.muted = !this.muted; },
    },
    canvas: lock ? { requestPointerLock: vi.fn(lock) } : {},
    onUse: vi.fn(),
  };
}

async function startStates(options, { search, auto = false } = {}) {
  const ui = await loadUi(search);
  const f = fakes(options);
  return { ...f, ui, states: ui.createStates({ ...f, auto }) };
}

const key = (code, extra = {}) => listeners.window.fire('keydown', { code, ...extra });

async function playing(options) {
  const game = await startStates(options);
  game.states.ready();
  el('enter').fire('click');
  return game;
}

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('starting', () => {
  it('Enter does nothing until loading has finished', async () => {
    const { states } = await startStates();
    key('Enter');
    expect(states.state).toBe('title');
  });

  it('Enter starts the game once ready, with sound and pointer lock', async () => {
    const { states, audio, canvas, player } = await startStates();
    states.ready();
    expect(el('enter').disabled).toBe(false);
    key('Enter');
    expect(states.state).toBe('play');
    expect(player.enabled).toBe(true);
    expect(audio.start).toHaveBeenCalled();
    expect(canvas.requestPointerLock).toHaveBeenCalled();
    expect(el('title').classList.contains('hidden')).toBe(true);
  });

  it('auto mode starts without input, sound, control or pointer lock', async () => {
    const { states, audio, canvas, player } = await startStates({}, { auto: true });
    states.ready();
    expect(states.state).toBe('play');
    expect(player.enabled).toBe(false);
    expect(audio.start).not.toHaveBeenCalled();
    expect(canvas.requestPointerLock).not.toHaveBeenCalled();
  });

  it('names the button for the device', async () => {
    (await startStates()).states.ready();
    expect(el('enter').textContent).toBe('ENTER THE ALLEY');
    (await startStates({ touch: true })).states.ready();
    expect(el('enter').textContent).toBe('TAP TO ENTER');
  });

  it('touch devices play without pointer lock', async () => {
    const { states, canvas } = await playing({ touch: true });
    expect(states.state).toBe('play');
    expect(canvas.requestPointerLock).not.toHaveBeenCalled();
  });
});

describe('refused pointer lock (F2)', () => {
  it('a rejected promise opens the pause menu', async () => {
    const refuse = () => Promise.reject(new Error('Refused'));
    const { states, player } = await playing({ lock: refuse });
    await vi.waitFor(() => expect(states.state).toBe('paused'));
    expect(player.enabled).toBe(false);
    expect(el('pause').classList.contains('hidden')).toBe(false);
  });

  it('a pointerlockerror event opens the pause menu', async () => {
    const { states, player } = await playing({ lock: () => undefined });
    listeners.document.fire('pointerlockerror');
    expect(states.state).toBe('paused');
    expect(player.enabled).toBe(false);
    expect(el('pause').classList.contains('hidden')).toBe(false);
  });

  it('a pointerlockerror on a touch device changes nothing', async () => {
    const { states } = await playing({ touch: true });
    listeners.document.fire('pointerlockerror');
    expect(states.state).toBe('play');
  });
});

describe('pausing', () => {
  it('losing the pointer lock pauses, clears held keys and suspends audio', async () => {
    const { states, player, audio } = await playing();
    listeners.document.fire('pointerlockchange');
    expect(states.state).toBe('paused');
    expect(player.keys.size).toBe(0);
    expect(audio.suspend).toHaveBeenCalled();
  });

  it('gaining the pointer lock does not pause', async () => {
    const { states } = await playing();
    document.pointerLockElement = {};
    listeners.document.fire('pointerlockchange');
    expect(states.state).toBe('play');
  });

  it('losing the lock on the title screen stays there', async () => {
    const { states } = await startStates();
    listeners.document.fire('pointerlockchange');
    expect(states.state).toBe('title');
  });

  it('Resume plays again and asks for the lock again', async () => {
    const { states, canvas, player } = await playing();
    listeners.document.fire('pointerlockchange');
    el('resume').fire('click');
    expect(states.state).toBe('play');
    expect(player.enabled).toBe(true);
    expect(el('pause').classList.contains('hidden')).toBe(true);
    expect(canvas.requestPointerLock).toHaveBeenCalledTimes(2);
  });

  it('hiding the page suspends audio, and showing it resumes only in play', async () => {
    const { audio } = await playing();
    audio.resume.mockClear();
    document.hidden = true;
    listeners.document.fire('visibilitychange');
    expect(audio.suspend).toHaveBeenCalledTimes(1);
    document.hidden = false;
    listeners.document.fire('visibilitychange');
    expect(audio.resume).toHaveBeenCalledTimes(1);

    listeners.document.fire('pointerlockchange');
    audio.resume.mockClear();
    listeners.document.fire('visibilitychange');
    expect(audio.resume).not.toHaveBeenCalled();
  });
});

describe('keys', () => {
  it('E only uses things during play', async () => {
    const { states, onUse } = await startStates();
    states.ready();
    key('KeyE');
    expect(onUse).not.toHaveBeenCalled();
    key('Enter');
    key('KeyE');
    expect(onUse).toHaveBeenCalledTimes(1);
    listeners.document.fire('pointerlockchange');
    key('KeyE');
    expect(onUse).toHaveBeenCalledTimes(1);
  });

  it('holding E only uses once', async () => {
    const { onUse } = await playing();
    key('KeyE');
    key('KeyE', { repeat: true });
    expect(onUse).toHaveBeenCalledTimes(1);
  });

  it('F toggles the FPS counter', async () => {
    await playing();
    el('fps').classList.add('hidden');
    key('KeyF');
    expect(el('fps').classList.contains('hidden')).toBe(false);
    key('KeyF');
    expect(el('fps').classList.contains('hidden')).toBe(true);
  });
});

describe('mute', () => {
  it('M and both sound buttons toggle it and update the labels', async () => {
    const { audio } = await startStates();
    expect(el('sound').textContent).toBe('SOUND ON');
    key('KeyM');
    expect(audio.muted).toBe(true);
    expect(el('sound').textContent).toBe('SOUND OFF');
    expect(el('pause-sound').textContent).toBe('SOUND OFF');
    el('sound').fire('click');
    expect(audio.muted).toBe(false);
    el('pause-sound').fire('click');
    expect(audio.muted).toBe(true);
  });

  it('starts muted from ?mute', async () => {
    const { audio } = await startStates({}, { search: '?mute=1' });
    expect(audio.muted).toBe(true);
    expect(el('sound').textContent).toBe('SOUND OFF');
  });
});

describe('prompts', () => {
  it('shows the key and the action, and hides with none', async () => {
    const { states } = await playing();
    states.showPrompt('KNOCK');
    expect(el('vend').classList.contains('hidden')).toBe(false);
    expect(el('vend').textContent).toBe('E · KNOCK');
    states.showPrompt(null);
    expect(el('vend').classList.contains('hidden')).toBe(true);
  });

  it('says TAP on touch devices, and tapping uses the action', async () => {
    const { states, onUse } = await playing({ touch: true });
    states.showPrompt('KNOCK');
    expect(el('vend').textContent).toBe('TAP · KNOCK');
    el('vend').fire('click');
    expect(onUse).toHaveBeenCalledTimes(1);
  });
});

describe('input mode (F1)', () => {
  const down = (pointerType, target) => listeners.window.fire('pointerdown', { pointerType, target });

  it('a mouse click on ENTER uses the lock on a touchscreen', async () => {
    const { states, canvas, player } = await startStates({ touch: true });
    states.ready();
    down('mouse', el('enter'));
    el('enter').fire('click');
    expect(player.touch).toBe(false);
    expect(canvas.requestPointerLock).toHaveBeenCalledTimes(1);
  });

  it('a tap on ENTER plays without the lock, even if the mouse was the guess', async () => {
    const { states, canvas, player } = await startStates();
    states.ready();
    down('touch', el('enter'));
    el('enter').fire('click');
    expect(player.touch).toBe(true);
    expect(document.body.classList.contains('touch')).toBe(true);
    expect(canvas.requestPointerLock).not.toHaveBeenCalled();
  });

  it('the Enter key uses the lock on a touchscreen', async () => {
    const { states, canvas, player } = await startStates({ touch: true });
    states.ready();
    key('Enter');
    expect(player.touch).toBe(false);
    expect(canvas.requestPointerLock).toHaveBeenCalledTimes(1);
  });

  it('a touch during mouse play releases the lock without pausing', async () => {
    const { states, player } = await playing();
    document.pointerLockElement = {};
    document.exitPointerLock = vi.fn(() => { document.pointerLockElement = null; });
    down('touch', el('sound'));
    expect(document.exitPointerLock).toHaveBeenCalledTimes(1);
    listeners.document.fire('pointerlockchange');
    expect(states.state).toBe('play');
    expect(player.touch).toBe(true);
  });

  it('a mouse click on the canvas during touch play takes the lock', async () => {
    const { canvas, player } = await playing({ touch: true });
    down('mouse', canvas);
    expect(player.touch).toBe(false);
    expect(canvas.requestPointerLock).toHaveBeenCalledTimes(1);
  });

  it('a mouse click on a HUD button during touch play stays in touch mode', async () => {
    const { canvas, player } = await playing({ touch: true });
    down('mouse', el('sound'));
    expect(player.touch).toBe(true);
    expect(canvas.requestPointerLock).not.toHaveBeenCalled();
  });

  it('the mouse takes no lock in auto mode', async () => {
    const { states, canvas } = await startStates({}, { auto: true });
    states.ready();
    down('mouse', canvas);
    expect(canvas.requestPointerLock).not.toHaveBeenCalled();
  });

  it('a browser without pointer lock stays in touch mode', async () => {
    const { states, player } = await startStates({ touch: true, lock: null });
    states.ready();
    down('mouse', el('enter'));
    el('enter').fire('click');
    expect(states.state).toBe('play');
    expect(player.touch).toBe(true);
  });

  it('the prompt follows the mode while the action stays the same', async () => {
    const { states, canvas } = await playing({ touch: true });
    states.showPrompt('KNOCK');
    expect(el('vend').textContent).toBe('TAP · KNOCK');
    down('mouse', canvas);
    states.showPrompt('KNOCK');
    expect(el('vend').textContent).toBe('E · KNOCK');
  });
});

describe('pause button (F6)', () => {
  it('opens the pause menu and Resume plays again without the lock', async () => {
    const { states, canvas, player, audio } = await playing({ touch: true });
    el('pause-button').fire('click');
    expect(states.state).toBe('paused');
    expect(player.enabled).toBe(false);
    expect(audio.suspend).toHaveBeenCalled();
    expect(el('pause').classList.contains('hidden')).toBe(false);
    el('resume').fire('click');
    expect(states.state).toBe('play');
    expect(el('pause').classList.contains('hidden')).toBe(true);
    expect(canvas.requestPointerLock).not.toHaveBeenCalled();
  });

  it('does nothing before play has started', async () => {
    const { states } = await startStates({ touch: true });
    el('pause-button').fire('click');
    expect(states.state).toBe('title');
  });
});

describe('fullscreen button (A71)', () => {
  it('is hidden where the browser has no fullscreen', async () => {
    await startStates();
    expect(el('fullscreen').classList.contains('hidden')).toBe(true);
  });

  async function withFullscreen() {
    await loadUi();
    document.fullscreenEnabled = true;
    document.documentElement = { requestFullscreen: vi.fn(() => Promise.reject(new Error('Refused'))) };
    document.exitFullscreen = vi.fn();
    const f = fakes({ touch: true });
    const { createStates } = await import('../src/ui.js');
    return { ...f, states: createStates({ ...f, auto: false }) };
  }

  it('shows where it can work, and enters, even if refused without an error', async () => {
    await withFullscreen();
    expect(el('fullscreen').classList.contains('hidden')).toBe(false);
    el('fullscreen').fire('click');
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('leaves when already fullscreen, and the label follows without pausing', async () => {
    const { states } = await withFullscreen();
    states.ready();
    el('enter').fire('click');
    document.fullscreenElement = {};
    listeners.document.fire('fullscreenchange');
    expect(el('fullscreen').textContent).toBe('EXIT FULL');
    el('fullscreen').fire('click');
    expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
    document.fullscreenElement = null;
    listeners.document.fire('fullscreenchange');
    expect(el('fullscreen').textContent).toBe('FULLSCREEN');
    expect(states.state).toBe('play');
  });
});

describe('look speed (A72)', () => {
  const pick = (label) => el('look-pills').children.find((b) => b.textContent === label);

  it('starts at normal with one pill per speed', async () => {
    const { player } = await startStates();
    expect(player.lookSpeed).toBe(1);
    expect(el('look-pills').children.map((b) => b.textContent)).toEqual(['Slow', 'Normal', 'Fast']);
    expect(pick('Normal').className).toContain('on');
  });

  it('a pill sets the speed and moves the mark', async () => {
    const { player } = await startStates();
    pick('Fast').fire('click');
    expect(player.lookSpeed).toBe(1.6);
    expect(pick('Fast').className).toContain('on');
    expect(pick('Normal').className).not.toContain('on');
  });

  it('starts from ?look, and ignores a value that is not a speed', async () => {
    expect((await startStates({}, { search: '?look=slow' })).player.lookSpeed).toBe(0.6);
    expect(pick('Slow').className).toContain('on');
    expect((await startStates({}, { search: '?look=constructor' })).player.lookSpeed).toBe(1);
  });

  it('carries across a quality reload, and drops it back at normal', async () => {
    const { ui } = await startStates();
    ui.createQualityPills('high');
    const quality = (label) => el('qpills').children.find((b) => b.textContent === label);
    pick('Fast').fire('click');
    quality('Low').fire('click');
    expect(new URL(location.href).searchParams.get('look')).toBe('fast');
    pick('Normal').fire('click');
    quality('Medium').fire('click');
    expect(new URL(location.href).searchParams.has('look')).toBe(false);
  });
});

describe('quality pills', () => {
  const pill = (box, label) => el(box).children.find((b) => b.textContent === label);
  const reloadUrl = () => new URL(location.href).searchParams;

  it('adds one pill per preset to both menus and marks the current one', async () => {
    (await loadUi()).createQualityPills('high');
    for (const box of ['qpills', 'pause-qpills']) {
      expect(el(box).children.map((b) => b.textContent)).toEqual(['Low', 'Medium', 'High', 'Ultra']);
      expect(pill(box, 'High').className).toContain('on');
      expect(pill(box, 'Low').className).not.toContain('on');
    }
  });

  it('does nothing for the current preset', async () => {
    (await loadUi()).createQualityPills('high');
    const before = location.href;
    pill('qpills', 'High').fire('click');
    expect(location.href).toBe(before);
  });

  it('on the title screen reloads with only the preset', async () => {
    const { ui } = await startStates();
    ui.createQualityPills('high');
    pill('qpills', 'Low').fire('click');
    expect(reloadUrl().get('q')).toBe('low');
    expect(reloadUrl().has('x')).toBe(false);
    expect(reloadUrl().has('mute')).toBe(false);
  });

  it('during play carries the position across the reload', async () => {
    const { ui } = await playing();
    ui.createQualityPills('high');
    pill('pause-qpills', 'Ultra').fire('click');
    const url = reloadUrl();
    expect(url.get('q')).toBe('ultra');
    expect(url.get('x')).toBe('1.500');
    expect(url.get('z')).toBe('-2.250');
    expect(url.get('yaw')).toBe('0.500');
    expect(url.get('pitch')).toBe('0.125');
  });

  it('carries mute across the reload, and drops it once unmuted', async () => {
    const { ui } = await startStates();
    ui.createQualityPills('high');
    key('KeyM');
    pill('qpills', 'Low').fire('click');
    expect(reloadUrl().get('mute')).toBe('1');
    key('KeyM');
    pill('qpills', 'Medium').fire('click');
    expect(reloadUrl().has('mute')).toBe(false);
  });

  it('carries mute even before the game has finished loading', async () => {
    (await loadUi('?mute=1')).createQualityPills('high');
    pill('qpills', 'Low').fire('click');
    expect(reloadUrl().get('mute')).toBe('1');
  });
});

describe('inventory bag', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('draws a cell per slot, stacks counts, and toggles with I in play', async () => {
    const ui = await loadUi();
    const { Inventory } = await import('../src/inventory.js');
    const f = fakes(), inventory = new Inventory(4);
    ui.createStates({ ...f, auto: false, inventory });
    const slots = el('bag-slots');
    expect(slots.children.length).toBe(4);
    expect(el('bag-button').textContent).toBe('BAG 0');
    inventory.add({ id: 'can:COLA', name: 'COLA', color: '#e0162e' });
    inventory.add({ id: 'can:COLA', name: 'COLA', color: '#e0162e' });
    inventory.add({ id: 'food:RAMEN', name: 'RAMEN' });
    expect(slots.children.map((c) => c.className)).toEqual(['bag-slot', 'bag-slot', 'bag-slot empty', 'bag-slot empty']);
    expect(slots.children[0].children[0].textContent).toBe('×2');
    expect(slots.children[1].children.length).toBe(0);
    expect(el('bag-button').textContent).toBe('BAG 3');
    expect(el('bag-count').textContent).toBe('2/4');

    el('bag').classList.add('hidden');
    listeners.window.fire('keydown', { code: 'KeyI' });
    expect(el('bag').classList.contains('hidden')).toBe(true); // not in play yet
    el('enter').fire('click');
    listeners.window.fire('keydown', { code: 'KeyI' });
    expect(el('bag').classList.contains('hidden')).toBe(false);
    el('bag-button').fire('click');
    expect(el('bag').classList.contains('hidden')).toBe(true);
  });
});
