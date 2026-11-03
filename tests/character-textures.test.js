import { describe, it, expect } from 'vitest';
import { createCharacterTextures } from '../src/character-textures.js';

const tx = createCharacterTextures();
const avg = (data, c) => {
  let sum = 0;
  for (let i = c; i < data.length; i += 4) sum += data[i];
  return sum / (data.length / 4);
};

describe('character textures', () => {
  it.each(['torso', 'sleeve', 'leg', 'pelvis'])('%s has matching colour and normal maps', (name) => {
    const { map, normalMap } = tx[name];
    expect(map.image.width).toBe(normalMap.image.width);
    expect(map.image.height).toBe(normalMap.image.height);
    expect(map.colorSpace).toBe('srgb');
    expect(normalMap.colorSpace).not.toBe('srgb');
    expect(avg(normalMap.image.data, 2)).toBeGreaterThan(200); // mostly facing out
  });

  it('draws the leather near black and the jeans indigo', () => {
    const leather = tx.torso.map.image.data, jeans = tx.leg.map.image.data;
    expect(avg(leather, 0)).toBeCloseTo(avg(leather, 2), -1); // grey, tinted by the material
    expect(avg(jeans, 2)).toBeGreaterThan(avg(jeans, 0) + 20);
  });

  it('stitches the jeans in amber thread', () => {
    const d = tx.pelvis.map.image.data;
    let amber = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i] > d[i + 2] + 60) amber++;
    expect(amber).toBeGreaterThan(200);
  });
});
