import { describe, it, expect } from 'vitest';
import { puddleLookup } from '../src/ground.js';

const W = 8, L = 20, Z1 = -15, COLS = 4, ROWS = 10;

function lookup(wet) {
  const pixels = new Uint8Array(COLS * ROWS * 4);
  for (const [col, row] of wet) pixels[(row * COLS + col) * 4 + 1] = 255;
  return puddleLookup(pixels, COLS, ROWS, W, L, Z1);
}

describe('puddleLookup', () => {
  it('finds a puddle from world position, with x centred and row 0 at the far end', () => {
    const inWater = lookup([[2, 0]]);
    expect(inWater(1, -14)).toBe(true);
    expect(inWater(-1, -14)).toBe(false);
    expect(inWater(1, -12)).toBe(false);
  });

  it('ignores the snow in the red channel', () => {
    const pixels = new Uint8Array(COLS * ROWS * 4).fill(255);
    for (let k = 1; k < pixels.length; k += 4) pixels[k] = 0;
    expect(puddleLookup(pixels, COLS, ROWS, W, L, Z1)(0, 0)).toBe(false);
  });

  it('treats a soft edge as dry below half strength', () => {
    const pixels = new Uint8Array(COLS * ROWS * 4);
    pixels[1] = 100;
    pixels[5] = 200;
    const inWater = puddleLookup(pixels, COLS, ROWS, W, L, Z1);
    expect(inWater(-3, -14)).toBe(false);
    expect(inWater(-1, -14)).toBe(true);
  });

  it('is dry off the ground plane', () => {
    const inWater = lookup([[0, 0], [3, 9]]);
    for (const [x, z] of [[-4.1, -14], [4, 4], [0, -15.1], [0, 5]]) expect(inWater(x, z)).toBe(false);
  });
});
