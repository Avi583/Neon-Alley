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
    canvas: { requestPointerLock: vi.fn(lock) },
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
