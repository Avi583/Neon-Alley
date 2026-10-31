import { describe, it, expect } from 'vitest';
import { AdaptiveScale, SCALE_STEPS } from '../src/adaptive-scale.js';

// Feed frames of one duration, returning every scale change.
function run(a, ms, seconds) {
  const changes = [];
  for (let i = 0; i < (seconds * 1000) / ms; i++) {
    const s = a.sample(ms);
    if (s !== null) changes.push(s);
  }
  return changes;
}

describe('AdaptiveScale', () => {
  it('stays at full scale when frames are fast', () => {
    const a = new AdaptiveScale();
    expect(run(a, 16.7, 60)).toEqual([]);
    expect(a.scale).toBe(1);
  });

  it('holds in the band between slow and fast', () => {
    const a = new AdaptiveScale();
    expect(run(a, 21, 60)).toEqual([]);
  });

  it('drops one step at a time and stops at the lowest', () => {
    const a = new AdaptiveScale();
    expect(run(a, 40, 2.5)).toEqual(SCALE_STEPS.slice(1, 3));
    run(a, 40, 30);
    expect(a.scale).toBe(SCALE_STEPS.at(-1));
  });

  it('waits before rising again', () => {
    const a = new AdaptiveScale();
    run(a, 40, 1.1);
    expect(a.scale).toBe(SCALE_STEPS[1]);
    expect(run(a, 16.7, 6)).toEqual([]);
    expect(run(a, 16.7, 4)).toEqual([1]);
  });

  it('doubles the wait when a rise does not hold', () => {
    const a = new AdaptiveScale();
    run(a, 40, 1.1);
    run(a, 16.7, 9); // rises back to 1
    expect(a.scale).toBe(1);
    run(a, 40, 1.1); // the rise failed
    expect(a.scale).toBe(SCALE_STEPS[1]);
    expect(run(a, 16.7, 12)).toEqual([]); // the old 8 s wait is no longer enough
    expect(run(a, 16.7, 6)).toEqual([1]);
  });

  it('still drops on a machine far too slow for the preset', () => {
    const a = new AdaptiveScale();
    run(a, 800, 60);
    expect(a.scale).toBe(SCALE_STEPS.at(-1));
  });

  it('does not drop for a single hitch', () => {
    const a = new AdaptiveScale();
    expect(a.sample(900)).toBe(null);
    expect(run(a, 16.7, 10)).toEqual([]);
  });

  it('ignores stalls such as a hidden tab', () => {
    const a = new AdaptiveScale();
    expect(run(a, 5000, 60)).toEqual([]);
    expect(a.scale).toBe(1);
  });

  it('reset discards a partial window', () => {
    const a = new AdaptiveScale();
    run(a, 40, 0.9);
    a.reset();
    expect(run(a, 40, 0.9)).toEqual([]);
    expect(a.scale).toBe(1);
  });
});
