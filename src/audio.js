// Procedural ambience with the Web Audio API — no sound files.
// City rumble, gusting wind, neon hum that swells near signs (and stutters
// with their flicker), snowy footsteps and the odd distant siren.

export const KNOCK_RAPS = [0, 0.2, 0.4]; // s, when each rap of a knock lands

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

  // Whether one-off sounds play: started and not muted.
  get live() { return !!this.ctx && !this.muted; }

  // One oscillator note from time t: pitch from -> to (exponentially, over glide s), up to vol over
  // attack s (at once if 0; from silence, linearly or, with curve 'exp', exponentially) and down to
  // silence by decay s.
  tone(t, { type = 'sine', from, to = from, glide = 0, vol, attack = 0, curve = 'linear', decay }) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(from, t);
    if (to !== from) o.frequency.exponentialRampToValueAtTime(to, t + glide);
    const g = ctx.createGain();
    this.envelope(g.gain, t, vol, attack, decay, curve);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + decay + 0.02);
  }

  // A burst of white noise from time t, length s long, through a filter at freq (swept
  // exponentially to to over sweep s), played at rate, with the envelope as in tone.
  noise(t, { filter = 'bandpass', freq, to = freq, sweep = 0, Q = 1, rate = 1, vol, attack = 0, decay, length }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.white; src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = filter; f.Q.value = Q;
    f.frequency.setValueAtTime(freq, t);
    if (to !== freq) f.frequency.exponentialRampToValueAtTime(to, t + sweep);
    const g = ctx.createGain();
    this.envelope(g.gain, t, vol, attack, decay);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 2, length);
  }

  envelope(gain, t, vol, attack, decay, curve = 'linear') {
    if (attack <= 0) gain.setValueAtTime(vol, t);
    else if (curve === 'exp') { gain.setValueAtTime(0.001, t); gain.exponentialRampToValueAtTime(vol, t + attack); }
    else { gain.setValueAtTime(0, t); gain.linearRampToValueAtTime(vol, t + attack); }
    gain.exponentialRampToValueAtTime(0.001, t + decay);
  }

  // A boot on snow: a soft crunch of noise over a low thump.
  step(speed) {
    if (!this.live) return;
    const t = this.ctx.currentTime, vol = 0.18 + Math.min(speed / 4, 1) * 0.12;
    this.noise(t, { freq: 1500 + Math.random() * 1200, Q: 0.9, rate: 0.7 + Math.random() * 0.5, vol, attack: 0.008, decay: 0.16, length: 0.2 });
    this.tone(t, { from: 90, to: 42, glide: 0.12, vol: vol * 0.9, decay: 0.13 });
  }

  // A boot in a puddle: one slosh of water falling in pitch, over the low thump of the boot.
  splash(speed) {
    if (!this.live) return;
    const t = this.ctx.currentTime, vol = 0.3 + Math.min(speed / 4, 1) * 0.2;
    this.noise(t, { freq: 2200 + Math.random() * 600, to: 500, sweep: 0.3, Q: 0.6, rate: 0.8 + Math.random() * 0.4, vol, attack: 0.025, decay: 0.34, length: 0.36 });
    this.tone(t, { from: 110, to: 50, glide: 0.12, vol: vol * 0.6, attack: 0.015, decay: 0.14 });
  }

  // Food handed over at a shop: two soft rising notes.
  purchase() {
    if (!this.live) return;
    for (const [at, f] of [[0, 880], [0.12, 1175]]) this.tone(this.ctx.currentTime + at, { type: 'triangle', from: f, vol: 0.14, decay: 0.3 });
  }

  // A vending machine's corkscrew turning: a small geared motor that eases in and out.
  whirr(dur) {
    if (!this.live) return;
    const ctx = this.ctx, t = ctx.currentTime;
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
    if (!this.live) return;
    const t = this.ctx.currentTime;
    for (const [type, from, to, vol, dur] of [['sine', 150, 60, 0.5, 0.16], ['triangle', 1400, 900, 0.07, 0.22]]) {
      this.tone(t, { type, from, to, glide: dur, vol, decay: dur });
    }
  }

  // A can lifted out of the bin: a light, tinny tick.
  pickup() {
    if (!this.live) return;
    this.tone(this.ctx.currentTime, { type: 'triangle', from: 1900, to: 1300, glide: 0.1, vol: 0.1, decay: 0.1 });
  }

  // A can drunk from the bag: the tab's crack and hiss, then two gulps.
  sip() {
    if (!this.live) return;
    const t = this.ctx.currentTime;
    this.noise(t, { filter: 'highpass', freq: 3000, vol: 0.25, decay: 0.25, length: 0.27 });
    for (const at of [0.45, 0.8]) this.tone(t + at, { from: 320, to: 140, glide: 0.12, vol: 0.3, attack: 0.02, curve: 'exp', decay: 0.14 });
  }

  // A dish eaten from the bag: three short, soft crunches of noise.
  bite() {
    if (!this.live) return;
    for (const at of [0, 0.22, 0.44]) {
      this.noise(this.ctx.currentTime + at, { freq: 1400 + Math.random() * 600, Q: 0.9, vol: 0.3, decay: 0.08, length: 0.09 });
    }
  }

  // Three raps on a door, the first after delay seconds: a dull thump with a short slap of noise on each.
  knock(delay = 0) {
    if (!this.live) return;
    for (const at of KNOCK_RAPS) {
      const t = this.ctx.currentTime + delay + at;
      this.tone(t, { from: 190, to: 85, glide: 0.09, vol: 0.6, decay: 0.1 });
      this.noise(t, { freq: 650, Q: 1.2, vol: 0.35, decay: 0.05, length: 0.06 });
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
