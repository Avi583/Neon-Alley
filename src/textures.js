// Generates every texture at load time. The generators live in pbr-textures.js
// and canvas-art.js; shared helpers are in texture-core.js.
import { nextFrame } from './texture-core.js';
import { clearNoiseCache } from './noise.js';
import { genConcrete, genBrick, genShutter, genAsphalt, genMetal, genFacade, genGrate, genWood, genCloud } from './pbr-textures.js';
import { genACFront, genACDrip, genGraffiti, genBootPrint, genVendingHeader, genVendingPanel, genVendingPrice, genCanLabels, genShopInterior, genNoren, genAd, genHoloText } from './canvas-art.js';
import { ART_TEXT } from './art-text.js';

// Generate everything with progress callbacks, yielding to the browser
// between textures so the loading bar can animate.
export async function generateTextures(Q, aniso, progress) {
  const tx = {};
  const steps = [
    ['asphalt', () => genAsphalt(Q.groundTex, aniso)],
    ['concrete', () => genConcrete(Q.wallTex, aniso)],
    ['brick', () => genBrick(Q.wallTex, aniso)],
    ['shutter', () => genShutter(Q.wallTex, aniso)],
    ['facade', () => genFacade(Q.facadeTex, aniso)],
    ['metal', () => genMetal(512, aniso)],
    ['grate', () => genGrate(256, aniso)],
    ['wood', () => genWood(256, aniso)],
    ['acFront', () => genACFront(256)],
    ['acDrip', () => genACDrip()],
    ['graffiti', () => genGraffiti(aniso)],
    ['bootPrint', () => genBootPrint(aniso)],
    ['cloud', () => genCloud(128)],
    ['vendingHeader', () => genVendingHeader()],
    ['vendingPanel', () => genVendingPanel()],
    ['vendingPrice', () => genVendingPrice()],
    ['canLabels', () => genCanLabels()],
    ['shopRamen', () => genShopInterior('ramen')],
    ['shopBar', () => genShopInterior('bar')],
    ['shopMart', () => genShopInterior('mart')],
    ['shopFish', () => genShopInterior('fish')],
    ['shopOnigiri', () => genShopInterior('onigiri')],
    ['shopSushi', () => genShopInterior('sushi')],
    ['noren', () => genNoren(ART_TEXT.onigiri)],
    ['norenSushi', () => genNoren(ART_TEXT.sushi, '#16245c', '#f0ead8')],
    ['norenRamen', () => genNoren(ART_TEXT.ramen, '#8c1a1a', '#f6e6c8')],
    ['holoText', () => genHoloText()],
    ['ads', () => [
      genAd('NEXA', ART_TEXT.ads[0], '#ff2d8a', '#3a0b5e', 1),
      genAd('SOLACE', ART_TEXT.ads[1], '#14d8ff', '#14204f', 2),
      genAd('ORBITAL', ART_TEXT.ads[2], '#ffb21f', '#7a0b3a', 3),
    ]],
  ];
  for (let i = 0; i < steps.length; i++) {
    progress(i / steps.length, `Generating ${steps[i][0]} texture`);
    await nextFrame();
    tx[steps[i][0]] = steps[i][1]();
  }
  clearNoiseCache();
  return tx;
}
