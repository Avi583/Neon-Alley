import { describe, it, expect } from 'vitest';
import { SIGN_SPECS, SIGN_TEXT } from '../src/sign-specs.js';
import { ART_TEXT } from '../src/art-text.js';

const STYLES = ['border', 'box', 'tube', 'circle'];
const FLICKER = ['steady', 'flicker', 'broken', 'pulse'];
const MOUNTS = ['flat', 'facing', 'facingBack'];
const FONTS = ['lat', 'neon'];

describe('SIGN_SPECS', () => {
  it.each(SIGN_SPECS.map((s, i) => [i, s]))('sign %i is valid', (_i, s) => {
    expect(s.w).toBeGreaterThan(0);
    expect(s.h).toBeGreaterThan(0);
    expect(s.y).toBeGreaterThan(0);
    expect(typeof s.z).toBe('number');
    expect(s.color).toMatch(/^#[0-9a-f]{6}$/i);
    if (s.color2) expect(s.color2).toMatch(/^#[0-9a-f]{6}$/i);
    if (s.light !== undefined) expect(s.light).toBeGreaterThanOrEqual(0);
    if (s.flicker) expect(FLICKER).toContain(s.flicker);
    if (s.mount) expect(MOUNTS).toContain(s.mount);
    if (s.font) expect(FONTS).toContain(s.font);
    if (s.kind !== 'holo') {
      expect(STYLES).toContain(s.style);
      if (s.style !== 'circle') expect(Boolean(s.text || s.columns)).toBe(true);
    }
    if (s.mount === 'facing' || s.mount === 'facingBack') expect(typeof s.x).toBe('number');
    else expect([-1, 1]).toContain(s.side);
  });

  it('SIGN_TEXT covers all sign text', () => {
    for (const s of SIGN_SPECS) {
      for (const ch of (s.text || '') + (s.columns || []).join('') + (s.sub || '')) {
        expect(SIGN_TEXT).toContain(ch);
      }
    }
  });

  it('SIGN_TEXT covers all texture text', () => {
    for (const ch of Object.values(ART_TEXT).flat().join('')) {
      expect(SIGN_TEXT).toContain(ch);
    }
  });
});
