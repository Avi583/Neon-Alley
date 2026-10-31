import { describe, it, expect, vi, afterEach } from 'vitest';
import { PRESETS, detectQuality } from './quality.js';

function stub({ ua = '', touch = 0, cores = 8, mem = 8 }) {
  vi.stubGlobal('navigator', { userAgent: ua, maxTouchPoints: touch, hardwareConcurrency: cores, deviceMemory: mem });
}
afterEach(() => vi.unstubAllGlobals());

describe('detectQuality', () => {
  const cases = [
    ['android phone', { ua: 'Mozilla/5.0 (Linux; Android 14) Mobile', touch: 5 }, 'low'],
    ['iPhone', { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', touch: 5 }, 'low'],
    ['iPad posing as Mac', { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', touch: 5 }, 'low'],
    ['real Mac', { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', touch: 0 }, 'high'],
    ['4-core desktop', { ua: 'Windows', cores: 4 }, 'medium'],
    ['low-memory desktop', { ua: 'Windows', cores: 16, mem: 4 }, 'medium'],
    ['strong desktop', { ua: 'Windows', cores: 12, mem: 8 }, 'high'],
    ['unknown cores/memory', { ua: 'Windows', cores: undefined, mem: undefined }, 'high'],
  ];
  it.each(cases)('%s', (_n, env, expected) => {
    stub(env);
    expect(detectQuality()).toBe(expected);
  });

  it('always returns a known preset', () => {
    stub({});
    expect(PRESETS).toHaveProperty(detectQuality());
  });
});

describe('PRESETS', () => {
  const order = ['low', 'medium', 'high', 'ultra'];
  const keys = (p) => Object.keys(p).sort();

  it('has the four presets with identical keys', () => {
    expect(Object.keys(PRESETS)).toEqual(order);
    for (const k of order) expect(keys(PRESETS[k])).toEqual(keys(PRESETS.low));
  });

  it('values never decrease from low to ultra', () => {
    for (const key of ['renderScale', 'maxDPR', 'reflScale', 'reflLod', 'lights', 'snow', 'steamPer',
      'wallTex', 'groundTex', 'facadeTex', 'msaa', 'signPPM', 'bloomStrength']) {
      const vals = order.map((k) => PRESETS[k][key]);
      for (let i = 1; i < vals.length; i++) expect(vals[i], key).toBeGreaterThanOrEqual(vals[i - 1]);
    }
  });
});
