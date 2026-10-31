// Hand-placed shopfronts: fish market, onigiri, sushi, ramen and a bar. They sit over
// the shutters already on those stretches of wall. Nothing here may touch the
// kit's rng (that includes kit.snow and kit.icicles) or the layout shifts, so
// any variation comes from a separate seeded rng.
import { WALL } from './config.js';
import { neonForm, standPart, fishParts, onigiriParts, nigiriParts, makiParts, bowlParts, beerParts, sakeParts, sojuParts } from './neon-food.js';

const SHELL = 0.4; // far enough out to cover a shutter's housing and icicles
const COUNTER = 0.46;
const ROOF_TILT = 0.49;

// Places a copy of a neon form and offers it for sale. rest is the height of the
// surface below, where the real food goes once it's bought.
function sell(ctx, form, [x, y, z], side, kind, rest) {
  form.spots.push([x, y, z]);
  ctx.foodSpots.push({ face: x, z, side, kind, rest, form, index: form.spots.length - 1 });
}

// The menu price, hung from the noren rod at eye level on two wires behind the cloth.
function priceBoard(ctx, at, side, zc, mat) {
  const { mats, box, cyl, plane } = ctx;
  for (const d of [-1, 1]) cyl(mats.cable, at(0.71), 2.245, zc + d * 0.3, 0.004, 0.63, 0, 0, 0, true);
  box(mats.metalDark, at(0.725), 1.76, zc, 0.012, 0.34, 0.74);
  plane(mat, at(0.733), 1.76, zc, 0.7, 0.3, -side * Math.PI / 2);
}

// The block that hides the wall, with the lit interior on its face.
function shell(ctx, at, side, zc, w, interior) {
  const { mats, box, plane } = ctx;
  box(mats.concrete, at(SHELL - 0.375), 1.6, zc, 0.75, 3.2, w, [2, 2]);
  plane(interior, at(SHELL + 0.006), 1.75, zc, w - 0.2, 1.7, side * -Math.PI / 2);
  box(mats.metalDark, at(SHELL + 0.03), 2.62, zc, 0.06, 0.06, w - 0.1);
  for (const d of [-1, 1]) box(mats.metalDark, at(SHELL + 0.03), 1.75, zc + d * (w / 2 - 0.08), 0.06, 1.8, 0.06);
}

// Tiled eave: a sloped base with ridges running down it, then snow.
function tiledEave(ctx, at, side, zc, w) {
  const { mats, box, cyl } = ctx;
  const roll = -side * (Math.PI / 2 - ROOF_TILT);
  box(mats.metalDark, at(0.775), 2.82, zc, 0.85, 0.03, w, null, 0, 0, side * ROOF_TILT);
  const n = Math.round(w / 0.175);
  for (let k = 0; k < n; k++) {
    cyl(mats.metalDark, at(0.775), 2.845, zc + (k - (n - 1) / 2) * 0.175, 0.04, 0.85, 0, 0, roll, true);
  }
  ctx.drift(at(0.66), 2.9075, zc, 0.5, 0.07, w - 0.14, side * ROOF_TILT);
}

// Noren on a rod in front of the counter. The rod spans the shop, the cloth is cw wide.
function norenCurtain(ctx, at, side, zc, w, cw, mat) {
  ctx.cyl(ctx.mats.wood, at(0.72), 2.56, zc, 0.014, w - 0.1, Math.PI / 2);
  ctx.plane(mat, at(0.72), 2.25, zc, cw, 0.62, -side * Math.PI / 2);
}

// A paper lantern at each end.
function lanterns(ctx, at, zc, w, mat) {
  const { mats, cyl, sph } = ctx;
  for (const d of [-1, 1]) {
    const lz = zc + d * (w / 2 - 0.15);
    cyl(mats.cable, at(1.02), 2.53, lz, 0.004, 0.14, 0, 0, 0, true);
    sph(mat, at(1.02), 2.32, lz, 0.13, 0.19, 0.13);
    cyl(mats.metalDark, at(1.02), 2.51, lz, 0.07, 0.03);
    cyl(mats.metalDark, at(1.02), 2.13, lz, 0.07, 0.03);
  }
}

function fishMarket(ctx) {
  const { mats, box, cyl, addLight, addCollider } = ctx;
  const side = -1, zc = -44.7, w = 2.6;
  const at = (d) => side * (WALL - d);
  const cyan = mats.strip('#7fd8ff', 1.8), coral = mats.strip('#ff6a5a', 2.2);
  shell(ctx, at, side, zc, w, mats.shopFish);

  // steel counter with a lit edge
  const cd = SHELL + COUNTER / 2;
  box(mats.metalLight, at(cd), 0.4, zc, COUNTER, 0.8, w - 0.1);
  box(cyan, at(SHELL + COUNTER + 0.005), 0.78, zc, 0.01, 0.03, w - 0.1);

  // neon fish on stands along the counter, far enough out to clear the back wall as they turn
  const fx = cd + 0.02;
  const standing = [cyan, coral].map((mat) => neonForm(ctx.neonForms, fishParts(mat, 0.24)));
  for (let k = 0; k < 4; k++) {
    const bz = zc + (k - 1.5) * 0.61;
    box(mats.metalDark, at(fx), 0.82, bz, 0.2, 0.04, 0.3);
    cyl(mats.metalDark, at(fx), 0.91, bz, 0.006, 0.14, 0, 0, 0, true);
    standing[k % 2].spots.push([at(fx), 1.07, bz]);
  }

  // neon fish hanging from a rail under the awning
  cyl(mats.metalDark, at(0.8), 2.4, zc, 0.012, w - 0.3, Math.PI / 2);
  const hanging = [cyan, coral].map((mat) => neonForm(ctx.neonForms, fishParts(mat, 0.15, true)));
  for (let k = 0; k < 6; k++) {
    const hz = zc + (k - 2.5) * 0.4;
    cyl(mats.metalDark, at(0.8), 2.34, hz, 0.004, 0.12, 0, 0, 0, true);
    hanging[k % 3 === 1 ? 1 : 0].spots.push([at(0.8), 2.13, hz]);
  }

  // striped awning with a valance, snowed over
  const tilt = side * ROOF_TILT, n = 8, sw = w / n;
  for (let k = 0; k < n; k++) {
    const mat = k % 2 ? mats.foam : mats.awningBlue, sz = zc + (k - (n - 1) / 2) * sw;
    box(mat, at(0.775), 2.82, sz, 0.85, 0.025, sw, null, 0, 0, tilt);
    box(mat, at(1.15), 2.56, sz, 0.02, 0.14, sw);
  }
  ctx.drift(at(0.68), 2.885, zc, 0.5, 0.07, w - 0.14, tilt);
  box(mats.strip('#dff6ff', 3), at(SHELL + 0.08), 2.7, zc, 0.04, 0.04, w - 0.5);

  addLight(at(1.6), 1.3, zc, '#bfe8ff', 3, 8);
  addCollider(at(SHELL + COUNTER + 0.02), at(-0.35), zc - w / 2, zc + w / 2);
}

function onigiriShop(ctx) {
  const { mats, box, addLight, addCollider } = ctx;
  const side = 1, zc = -18.5, w = 2.6;
  const at = (d) => side * (WALL - d);
  shell(ctx, at, side, zc, w, mats.shopOnigiri);

  // wooden counter
  const cd = SHELL + COUNTER / 2, wood = [0.8, 0.8];
  box(mats.woodDark, at(cd), 0.4, zc, COUNTER, 0.8, w - 0.1, wood);
  box(mats.wood, at(cd + 0.01), 0.82, zc, COUNTER + 0.06, 0.04, w, wood);

  // a row of neon onigiri on a riser, each with a strip of nori
  const rice = mats.strip('#fff1d6', 1.5), nori = mats.strip('#5dffb4', 2);
  box(mats.woodDark, at(cd + 0.08), 0.92, zc, 0.12, 0.16, w - 0.3, wood);
  const onigiri = neonForm(ctx.neonForms, onigiriParts(rice, nori, 0.17));
  for (let k = 0; k < 5; k++) sell(ctx, onigiri, [at(cd + 0.08), 1.13, zc + (k - 2) * 0.46], side, 'onigiri', 1);

  tiledEave(ctx, at, side, zc, w);
  box(mats.strip('#ffd9a0', 2.5), at(SHELL + 0.08), 2.7, zc, 0.04, 0.04, w - 0.5);
  norenCurtain(ctx, at, side, zc, w, w - 0.3, mats.noren);
  priceBoard(ctx, at, side, zc, mats.priceOnigiri);
  lanterns(ctx, at, zc, w, mats.lantern);

  addLight(at(1.4), 1.7, zc, '#ffb070', 3, 8);
  addCollider(at(SHELL + COUNTER + 0.04), at(-0.35), zc - w / 2, zc + w / 2);
}

function sushiShop(ctx) {
  const { mats, box, cyl, addLight, addCollider } = ctx;
  const side = -1, zc = -57.3, w = 3.4;
  const at = (d) => side * (WALL - d);
  shell(ctx, at, side, zc, w, mats.shopSushi);

  // pale wooden counter with a lit edge
  const cd = SHELL + COUNTER / 2, wood = [0.8, 0.8];
  box(mats.woodDark, at(cd), 0.4, zc, COUNTER, 0.8, w - 0.1, wood);
  box(mats.wood, at(cd + 0.01), 0.82, zc, COUNTER + 0.06, 0.04, w, wood);
  box(mats.strip('#ffe6c0', 1.6), at(SHELL + COUNTER + 0.045), 0.78, zc, 0.01, 0.03, w);

  // conveyor belt with rails, carrying plates of neon sushi
  const salmon = mats.strip('#ff7a5a', 2.2), rice = mats.strip('#fff1d6', 1.5), nori = mats.strip('#5dffb4', 2);
  box(mats.metalDark, at(cd), 0.85, zc, 0.2, 0.02, w - 0.2);
  for (const d of [-1, 1]) box(mats.metalLight, at(cd + d * 0.11), 0.86, zc, 0.02, 0.04, w - 0.2);
  const maki = neonForm(ctx.neonForms, [...makiParts(nori, rice, salmon, 0.12), standPart(mats.metalDark, 0.16, 0.08)]);
  const nigiri = neonForm(ctx.neonForms, [...nigiriParts(rice, salmon, 0.15), standPart(mats.metalDark, 0.12, 0.08)]);
  for (let k = 0; k < 6; k++) {
    const pz = zc + (k - 2.5) * 0.52;
    cyl(k % 2 ? mats.metalRed : mats.foam, at(cd), 0.87, pz, 0.085, 0.012);
    if (k % 3 === 2) sell(ctx, maki, [at(cd), 1.07, pz], side, 'maki', 0.876);
    else sell(ctx, nigiri, [at(cd), 1.03, pz], side, 'nigiri', 0.876);
  }

  // plain indigo awning, snowed over
  box(mats.awningBlue, at(0.775), 2.82, zc, 0.85, 0.03, w, null, 0, 0, side * ROOF_TILT);
  ctx.drift(at(0.68), 2.885, zc, 0.5, 0.07, w - 0.14, side * ROOF_TILT);
  box(mats.strip('#fff0d8', 1.6), at(SHELL + 0.08), 2.7, zc, 0.04, 0.04, w - 0.5);

  norenCurtain(ctx, at, side, zc, w, 1.66, mats.norenSushi);
  lanterns(ctx, at, zc, w, mats.strip('#ffe2b8', 1.2));

  addLight(at(1.5), 1.5, zc, '#ffe6c0', 3, 8);
  addCollider(at(SHELL + COUNTER + 0.04), at(-0.35), zc - w / 2, zc + w / 2);
}

function ramenShop(ctx) {
  const { mats, box, cyl, addLight, addCollider } = ctx;
  const side = 1, zc = -8.3, w = 3.3;
  const at = (d) => side * (WALL - d);
  shell(ctx, at, side, zc, w, mats.shopRamenFront);

  // dark wooden counter with a lit edge
  const cd = SHELL + COUNTER / 2, wood = [0.8, 0.8];
  box(mats.woodDark, at(cd), 0.4, zc, COUNTER, 0.8, w - 0.1, wood);
  box(mats.woodDark, at(cd + 0.01), 0.82, zc, COUNTER + 0.06, 0.04, w, wood);
  box(mats.strip('#ff6a3a', 3), at(SHELL + COUNTER + 0.045), 0.78, zc, 0.01, 0.03, w);

  // neon bowls on a riser, each with noodles, chopsticks and steam
  const bowl = mats.strip('#ff4a3a', 2.6), noodle = mats.strip('#ffd166', 2.2), pale = mats.strip('#f4f8ff', 1.6);
  box(mats.woodDark, at(cd + 0.06), 0.9, zc, 0.14, 0.12, w - 0.3, wood);
  const bowls = neonForm(ctx.neonForms, bowlParts(bowl, noodle, pale, 0.19));
  for (let k = 0; k < 3; k++) sell(ctx, bowls, [at(cd + 0.06), 1.14, zc + (k - 1) * 0.98], side, 'ramen', 0.96);

  // stools in front of the counter
  const sd = SHELL + COUNTER + 0.22;
  for (let k = 0; k < 4; k++) {
    const sz = zc + (k - 1.5) * 0.72;
    cyl(mats.metalDark, at(sd), 0.015, sz, 0.1, 0.03);
    cyl(mats.metalDark, at(sd), 0.27, sz, 0.018, 0.5, 0, 0, 0, true);
    cyl(mats.metalRed, at(sd), 0.53, sz, 0.13, 0.05);
  }

  tiledEave(ctx, at, side, zc, w);
  box(mats.strip('#ffb070', 2.5), at(SHELL + 0.08), 2.7, zc, 0.04, 0.04, w - 0.5);
  norenCurtain(ctx, at, side, zc, w, w - 0.3, mats.norenRamen);
  priceBoard(ctx, at, side, zc, mats.priceRamen);
  lanterns(ctx, at, zc, w, mats.lantern);

  addLight(at(1.5), 1.6, zc, '#ff9a5a', 3, 8);
  addCollider(at(sd + 0.15), at(-0.35), zc - w / 2, zc + w / 2);
}

function barShop(ctx) {
  const { mats, box, cyl, addLight, addCollider } = ctx;
  const side = 1, zc = -45, w = 5.4;
  const at = (d) => side * (WALL - d);
  shell(ctx, at, side, zc, w, mats.shopBarFront);

  // dark wooden counter with a lit edge
  const cd = SHELL + COUNTER / 2, wood = [0.8, 0.8];
  box(mats.woodDark, at(cd), 0.4, zc, COUNTER, 0.8, w - 0.1, wood);
  box(mats.woodDark, at(cd + 0.01), 0.82, zc, COUNTER + 0.06, 0.04, w, wood);
  box(mats.strip('#ff6ad5', 3), at(SHELL + COUNTER + 0.045), 0.78, zc, 0.01, 0.03, w);

  // three of each neon drink on a riser, far enough out to clear the back wall as they turn
  box(mats.woodDark, at(cd + 0.02), 0.89, zc, 0.2, 0.1, w - 0.3, wood);
  const amber = mats.strip('#ffb020', 2.4), froth = mats.strip('#fff6e0', 1.6);
  const pale = mats.strip('#a8d0ff', 1), pink = mats.strip('#ff6a9a', 2.2);
  const green = mats.strip('#3dff9a', 1.3), mint = mats.strip('#e0fff0', 1.2);
  const range = [
    ['beer', neonForm(ctx.neonForms, beerParts(amber, froth, 0.15)), 1.07],
    ['sake', neonForm(ctx.neonForms, sakeParts(pale, pink, 0.15)), 1.1],
    ['soju', neonForm(ctx.neonForms, sojuParts(green, mint, 0.16)), 1.11],
  ];
  for (let k = 0; k < 9; k++) {
    const [kind, form, y] = range[Math.floor(k / 3)];
    sell(ctx, form, [at(cd + 0.02), y, zc + (k - 4) * 0.56], side, kind, 0.94);
  }

  // stools in front of the counter
  const sd = SHELL + COUNTER + 0.22;
  for (let k = 0; k < 6; k++) {
    const sz = zc + (k - 2.5) * 0.8;
    cyl(mats.metalDark, at(sd), 0.015, sz, 0.1, 0.03);
    cyl(mats.metalDark, at(sd), 0.27, sz, 0.018, 0.5, 0, 0, 0, true);
    cyl(mats.metalRed, at(sd), 0.53, sz, 0.13, 0.05);
  }

  tiledEave(ctx, at, side, zc, w);
  box(mats.strip('#ff9ae0', 2.5), at(SHELL + 0.08), 2.7, zc, 0.04, 0.04, w - 0.5);
  norenCurtain(ctx, at, side, zc, w, 3.2, mats.norenBar);
  priceBoard(ctx, at, side, zc, mats.priceBar);
  lanterns(ctx, at, zc, w, mats.lantern);

  for (const d of [-1, 1]) addLight(at(1.5), 1.6, zc + d * 1.4, '#ff6ad5', 3, 8);
  addCollider(at(sd + 0.15), at(-0.35), zc - w / 2, zc + w / 2);
}

export function buildShops(ctx) {
  fishMarket(ctx);
  onigiriShop(ctx);
  sushiShop(ctx);
  ramenShop(ctx);
  barShop(ctx);
}
