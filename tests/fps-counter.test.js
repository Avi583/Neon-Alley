import { describe, expect, it } from 'vitest';
import { FpsCounter } from '../src/fps-counter.js';

function run(counter, elapsedMs, count) {
  let fps = null;
  for (let i = 0; i < count; i++) fps = counter.sample(elapsedMs) ?? fps;
  return fps;
}

describe('FpsCounter', () => {
  it('reads below 20 FPS on slow frames (F3)', () => {
    expect(run(new FpsCounter(), 200, 3)).toBeCloseTo(5);
  });

  it('reads the frame rate on fast frames', () => {
    expect(run(new FpsCounter(), 1000 / 60, 40)).toBeCloseTo(60);
  });

  it('waits for half a second before reporting', () => {
    const counter = new FpsCounter();
    expect(counter.sample(100)).toBeNull();
    expect(counter.sample(100)).toBeNull();
  });

  it('starts again after reporting', () => {
    const counter = new FpsCounter();
    expect(run(counter, 200, 3)).toBeCloseTo(5);
    expect(counter.sample(100)).toBeNull();
    expect(run(counter, 100, 5)).toBeCloseTo(10);
  });
});
