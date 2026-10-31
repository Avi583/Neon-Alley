// Runs in the browser, since the textures need a real canvas. Web fonts are left
// out on purpose: text falls back to system fonts, so no network is involved.
import { generateTextures } from '../src/textures.js';

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

window.hashTextures = async () => {
  const tx = await generateTextures(SIZES, 1, () => {});
  const out = {};
  for (const [name, entry] of Object.entries(tx)) await collect(out, name, entry);
  return out;
};
