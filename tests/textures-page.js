// Runs in the browser, since the textures need a real canvas. Web fonts are left
// out on purpose: text falls back to system fonts, so no network is involved.
import { generateTextures } from '../src/textures.js';
import { genCloud } from '../src/pbr-textures.js';

const SIZES = { groundTex: 64, wallTex: 64, facadeTex: 64 };

async function hashTexture(tex) {
  const { width, height } = tex.image;
  const { data } = tex.image.getContext('2d').getImageData(0, 0, width, height);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${width}x${height} ${hex.slice(0, 16)}`;
}

// An entry is one texture, a list of them (ads) or a set of PBR maps.
async function collect(out, name, entry) {
  if (entry.isTexture) out[name] = await hashTexture(entry);
  else for (const [k, v] of Object.entries(entry)) await collect(out, `${name}.${k}`, v);
}

// Highest alpha outside the puff's circle. Anything above 0 shows the billboard's square.
window.cloudAlphaOutsideCircle = () => {
  const S = 64, { image } = genCloud(S);
  const { data } = image.getContext('2d').getImageData(0, 0, S, S);
  let max = 0;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (Math.hypot(x / S - 0.5, y / S - 0.5) * 2 >= 1) max = Math.max(max, data[(y * S + x) * 4 + 3]);
    }
  }
  return max;
};

window.hashTextures = async () => {
  const tx = await generateTextures(SIZES, 1, () => {});
  const out = {};
  for (const [name, entry] of Object.entries(tx)) await collect(out, name, entry);
  return out;
};
