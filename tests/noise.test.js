import { describe, it, expect } from 'vitest';
import { mulberry32, hash2, fbm, noise1 } from '../src/noise.js';

// Pinned outputs: textures and the whole layout depend on these staying identical.
describe('noise', () => {
  it('mulberry32 sequence is fixed', () => {
    const r = mulberry32(123);
    expect([r(), r(), r()]).toEqual([0.7872516233474016, 0.1785435655619949, 0.49531551403924823]);
  });

  it('hash2 is fixed', () => {
    expect(hash2(0, 0)).toBe(0);
    expect(hash2(5, 7, 3)).toBe(0.12836682121269405);
    expect(hash2(-2, 9, 1)).toBe(0.5289832437410951);
  });

  it('fbm is fixed', () => {
    expect(fbm(0.25, 0.75, 4, 4, 3)).toBe(0.6799922310822313);
    expect(fbm(0.5, 0.5, 2, 3, 9, 3, 0.6)).toBe(0.7270112990054814);
  });

  it('noise1 is fixed', () => {
    expect(noise1(0.5)).toBe(0.2540622304659337);
    expect(noise1(3.25, 2)).toBe(0.5614217759502935);
  });

  it('fbm tiles across u/v = 0 and 1', () => {
    for (const t of [0, 0.3, 0.77]) {
      expect(fbm(0, t, 4, 3, 5)).toBeCloseTo(fbm(1, t, 4, 3, 5), 10);
      expect(fbm(t, 0, 4, 3, 5)).toBeCloseTo(fbm(t, 1, 4, 3, 5), 10);
    }
  });

  it('outputs stay in [0,1]', () => {
    for (let i = 0; i < 500; i++) {
      const u = (i * 0.618034) % 1, v = (i * 0.414213) % 1;
      for (const x of [fbm(u, v, 4, 4, i), noise1(i * 0.37, i), hash2(i, -i, 2)]) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
      }
    }
  });
});
