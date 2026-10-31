// Procedural ambience with the Web Audio API — no sound files.
// City rumble, gusting wind, neon hum that swells near signs (and stutters
// with their flicker), snowy footsteps and the odd distant siren.

function noiseBuffer(ctx, seconds, brown = false) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
  }
  return buf;
}

export class AmbientAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(comp);
    this.white = noiseBuffer(ctx, 3);
    const brown = noiseBuffer(ctx, 5, true);

    // low city rumble
    const rumble = ctx.createBufferSource(); rumble.buffer = brown; rumble.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
    const rg = ctx.createGain(); rg.gain.value = 0.5;
    rumble.connect(lp).connect(rg).connect(this.master); rumble.start();

    // gusting wind
    const wind = ctx.createBufferSource(); wind.buffer = this.white; wind.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.7;
    const wg = ctx.createGain(); wg.gain.value = 0.045;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 300;
    lfo.connect(lfoAmt).connect(bp.frequency);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.11;
    const lfo2Amt = ctx.createGain(); lfo2Amt.gain.value = 0.025;
    lfo2.connect(lfo2Amt).connect(wg.gain);
    wind.connect(bp).connect(wg).connect(this.master);
    wind.start(); lfo.start(); lfo2.start();

    // neon transformer hum
    this.hum = ctx.createGain(); this.hum.gain.value = 0;
    const hlp = ctx.createBiquadFilter(); hlp.type = 'lowpass'; hlp.frequency.value = 900;
    for (const [type, f, g] of [['sawtooth', 120, 0.5], ['sine', 60, 0.8], ['square', 240, 0.12]]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = g;
      o.connect(og).connect(hlp); o.start();
    }
    hlp.connect(this.hum).connect(this.master);

    this.scheduleSiren();
  }

  scheduleSiren() {
    setTimeout(() => { this.siren(); this.scheduleSiren(); }, 30000 + Math.random() * 50000);
  }

  siren() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime, dur = 10;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 780;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.9;
    const amt = ctx.createGain(); amt.gain.value = 160;
    lfo.connect(amt).connect(o.frequency);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.018, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.6 - 0.8;
    o.connect(lp).connect(g).connect(pan).connect(this.master);
    o.start(t); lfo.start(t); o.stop(t + dur); lfo.stop(t + dur);
  }

  setHum(level) {
    if (!this.ctx) return;
    this.hum.gain.setTargetAtTime(Math.min(level, 1) * 0.05, this.ctx.currentTime, 0.04);
  }

  step(speed) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    const vol = 0.18 + Math.min(speed / 4, 1) * 0.12;
    const src = ctx.createBufferSource(); src.buffer = this.white;
    src.playbackRate.value = 0.7 + Math.random() * 0.5;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500 + Math.random() * 1200; bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t, Math.random() * 2, 0.2);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const og = ctx.createGain();
    og.gain.setValueAtTime(vol * 0.9, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    o.connect(og).connect(this.master);
    o.start(t); o.stop(t + 0.15);
  }

  // A boot in a puddle: one slosh of water falling in pitch, over the low thump of the boot.
  splash(speed) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    const vol = 0.3 + Math.min(speed / 4, 1) * 0.2;
    const src = ctx.createBufferSource(); src.buffer = this.white;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.6;
    bp.frequency.setValueAtTime(2200 + Math.random() * 600, t);
    bp.frequency.exponentialRampToValueAtTime(500, t + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t, Math.random() * 2, 0.36);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(vol * 0.6, t + 0.015);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(og).connect(this.master);
    o.start(t); o.stop(t + 0.16);
  }

  // Food handed over at a shop: two soft rising notes.
  purchase() {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    for (const [at, f] of [[0, 880], [0.12, 1175]]) {
      const t = ctx.currentTime + at;
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.14, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.32);
    }
  }

  // A vending machine's corkscrew turning: a small geared motor that eases in and out.
  whirr(dur) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 95;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.1, t + dur * 0.2);
    g.gain.linearRampToValueAtTime(0.1, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t); o.stop(t + dur);
  }

  // A can dropping into the vending machine's bin: a low thud and a tinny ring.
  clunk() {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    for (const [type, from, to, vol, dur] of [['sine', 150, 60, 0.5, 0.16], ['triangle', 1400, 900, 0.07, 0.22]]) {
      const o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    }
  }

  // Three raps on a door: a dull thump with a short slap of noise on each.
  knock() {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    for (const at of [0, 0.2, 0.4]) {
      const t = ctx.currentTime + at;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(85, t + 0.09);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.6, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.connect(og).connect(this.master);
      o.start(t); o.stop(t + 0.12);
      const src = ctx.createBufferSource(); src.buffer = this.white;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.connect(bp).connect(g).connect(this.master);
      src.start(t, Math.random() * 2, 0.06);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  suspend() { if (this.ctx) this.ctx.suspend(); }
  resume() { if (this.ctx) this.ctx.resume(); }
}
