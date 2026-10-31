// Picks a render scale from recent frame times. Pure logic, so it can be tested
// without a renderer. Each change reallocates the HDR, bloom and reflection
// targets, so it drops quickly but rises slowly, and backs off if a rise fails.

export const SCALE_STEPS = [1, 0.85, 0.7, 0.6];

const WINDOW_MS = 1000; // time covered by each decision
const MIN_FRAMES = 3; // so the median of a window can't be one stalled frame
const SLOW_MS = 24; // below about 42 FPS: drop a step
const FAST_MS = 18; // about 60 FPS or better: a step up may fit
const MAX_FRAME_MS = 3000; // longer means a hidden tab, not GPU load
const DROP_WAIT_MS = 1000;
const RAISE_WAIT_MS = 8000;
const MAX_RAISE_WAIT_MS = 64000;

export class AdaptiveScale {
  constructor() {
    this.step = 0;
    this.raiseWait = RAISE_WAIT_MS;
    this.sinceChange = RAISE_WAIT_MS;
    this.justRaised = false;
    this.reset();
  }

  get scale() { return SCALE_STEPS[this.step]; }

  // Forget the current window, for when frame times don't reflect play.
  reset() {
    this.windowMs = 0;
    this.frames = [];
  }

  // Feed one frame's real duration. Returns the new scale when it changes, else null.
  sample(ms) {
    if (ms > MAX_FRAME_MS) { this.reset(); return null; }
    this.windowMs += ms;
    this.frames.push(ms);
    this.sinceChange += ms;
    if (this.windowMs < WINDOW_MS || this.frames.length < MIN_FRAMES) return null;

    // The median, so a single hitch doesn't cost resolution.
    const median = this.frames.sort((a, b) => a - b)[this.frames.length >> 1];
    this.reset();
    if (median > SLOW_MS && this.sinceChange >= DROP_WAIT_MS && this.step < SCALE_STEPS.length - 1) {
      // The last rise didn't hold, so wait longer before trying it again.
      if (this.justRaised) this.raiseWait = Math.min(this.raiseWait * 2, MAX_RAISE_WAIT_MS);
      this.justRaised = false;
      return this.change(this.step + 1);
    }
    if (median < FAST_MS && this.sinceChange >= this.raiseWait && this.step > 0) {
      this.justRaised = true;
      return this.change(this.step - 1);
    }
    // A rise that has held for a full wait counts as a success.
    if (this.justRaised && this.sinceChange >= RAISE_WAIT_MS) {
      this.justRaised = false;
      this.raiseWait = RAISE_WAIT_MS;
    }
    return null;
  }

  change(step) {
    this.step = step;
    this.sinceChange = 0;
    return this.scale;
  }
}
