// Graphics presets. Picked on the title screen or pause menu; changing one reloads the page
// with ?q=<key> so everything is rebuilt at the new resolution.

export const PRESETS = {
  low: {
    label: 'Low', renderScale: 0.75, maxDPR: 1, reflScale: 0.25, reflLod: 4,
    lights: 6, snow: 1500, steamPer: 14, wallTex: 512, groundTex: 1024, facadeTex: 512,
    msaa: 0, fxaa: true, signPPM: 160, bloomStrength: 0.5,
  },
  medium: {
    label: 'Medium', renderScale: 1, maxDPR: 1.25, reflScale: 0.35, reflLod: 5,
    lights: 10, snow: 3000, steamPer: 20, wallTex: 1024, groundTex: 1024, facadeTex: 1024,
    msaa: 2, fxaa: false, signPPM: 220, bloomStrength: 0.55,
  },
  high: {
    label: 'High', renderScale: 1, maxDPR: 2, reflScale: 0.5, reflLod: 5,
    lights: 14, snow: 5000, steamPer: 28, wallTex: 1024, groundTex: 2048, facadeTex: 1024,
    msaa: 4, fxaa: false, signPPM: 300, bloomStrength: 0.6,
  },
  ultra: {
    label: 'Ultra', renderScale: 1, maxDPR: 3, reflScale: 0.75, reflLod: 6,
    lights: 18, snow: 8000, steamPer: 36, wallTex: 2048, groundTex: 2048, facadeTex: 2048,
    msaa: 4, fxaa: false, signPPM: 400, bloomStrength: 0.65,
  },
};

export function detectQuality() {
  const ua = navigator.userAgent || '';
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  if (mobile) return 'low';
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 8;
  if (cores <= 4 || mem <= 4) return 'medium';
  return 'high';
}
