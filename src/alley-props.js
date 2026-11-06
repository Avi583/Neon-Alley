// Street furniture placed once by buildStreetProps in alley.js: the vending machine's cabinet
// (its moving parts are in vending.js) and the dumpster. Both draw from the kit's rng (snow and
// icicles do), so they must keep their place in the build order.
import { WALL } from './config.js';
import { CAN_FLAVOURS } from './items.js';

// The vending machine's cabinet, glass, shelves and bin. Sets ctx.vending for vending.js.
export function vendingMachine(ctx) {
  const { mats, box, cyl, plane, icicles, snow, addLight, addCollider } = ctx;
  const vz = -26.5, side = 1, d = 0.75;
  const cx = side * (WALL + 0.05 - d / 2);
  const face = cx - side * d / 2, ry = -side * Math.PI / 2;
  const inset = (depth) => face + side * depth;
  // Cabinet: hollow between y = 0.72 and 1.62, with the back wall at depth 0.46.
  for (const e of [-1, 1]) box(mats.metalRed, cx, 0.95, vz + e * 0.46, d, 1.9, 0.03);
  box(mats.metalRed, cx, 1.76, vz, d, 0.28, 0.89);
  box(mats.metalRed, cx, 0.48, vz, d, 0.48, 0.89);
  box(mats.metalRed, inset(0.605), 1.17, vz, 0.29, 0.9, 0.89);
  plane(mats.strip('#bcd8ff', 0.4), inset(0.455), 1.17, vz, 0.89, 0.9, ry);
  box(mats.strip('#eaf6ff', 2.2), inset(0.2), 1.6, vz, 0.04, 0.02, 0.76);
  // Pickup bin: a real recess in the base. Its flap and cans move, so vending.js builds them.
  box(mats.metalRed, inset(0.46), 0.12, vz, 0.58, 0.24, 0.89);
  box(mats.metalDark, inset(0.085), 0.05, vz, 0.17, 0.1, 0.89);
  for (const e of [-1, 1]) box(mats.metalRed, inset(0.085), 0.17, vz + e * 0.345, 0.17, 0.14, 0.19);
  box(mats.cable, inset(0.166), 0.17, vz, 0.008, 0.14, 0.5);
  box(mats.metalLight, inset(0.008), 0.243, vz, 0.016, 0.012, 0.52);
  box(mats.metalLight, inset(0.008), 0.097, vz, 0.016, 0.012, 0.52);
  // Door frame around the glass, with a dark gasket inside it
  for (const e of [-1, 1]) {
    box(mats.metalRed, inset(0.02), 1.17, vz + e * 0.4175, 0.04, 0.9, 0.055);
    box(mats.metalDark, inset(0.025), 1.17, vz + e * 0.385, 0.03, 0.9, 0.01);
  }
  for (const y of [0.725, 1.615]) box(mats.metalDark, inset(0.025), y, vz, 0.03, 0.01, 0.78);
  // Shelves with price rails, set back to leave a drop channel behind the glass, then
  // a price tag and button per slot. The coils and cans move, so vending.js builds them.
  const slots = [];
  for (let row = 0; row < 4; row++) {
    const base = 0.745 + row * 0.22;
    box(mats.metalLight, inset(0.32), base - 0.008, vz, 0.26, 0.016, 0.89);
    box(mats.metalDark, inset(0.185), base - 0.02, vz, 0.012, 0.04, 0.76);
    for (let k = 0; k < 6; k++) {
      const z = vz + (k - 2.5) * 0.125;
      slots.push({ z, base, flavour: (k * (row % 2 ? 5 : 1) + row * 2) % CAN_FLAVOURS });
      plane(mats.vendingPrice, inset(0.178), base - 0.02, z - 0.016, 0.08, 0.036, ry);
      box(mats.strip('#ff3d5a', 0.9), inset(0.177), base - 0.02, z + 0.044, 0.006, 0.018, 0.018);
    }
  }
  // Hatch in the channel floor that falling cans pass through on the way to the bin
  box(mats.metalDark, inset(0.11), 0.721, vz, 0.13, 0.002, 0.78);
  plane(mats.vendingGlass, inset(0.03), 1.17, vz, 0.78, 0.9, ry);
  // Header sign and control panel, with a coin plate and return button on it
  plane(mats.vendingHeader, face - side * 0.002, 1.76, vz, 0.89, 0.24, ry);
  plane(mats.vendingPanel, face - side * 0.002, 0.48, vz, 0.89, 0.48, ry);
  const hardwareZ = vz + 0.27;
  box(mats.metalLight, face - side * 0.008, 0.55, hardwareZ, 0.016, 0.16, 0.12);
  box(mats.cable, face - side * 0.017, 0.585, hardwareZ, 0.002, 0.05, 0.008);
  box(mats.cable, face - side * 0.017, 0.52, hardwareZ, 0.002, 0.012, 0.06);
  cyl(mats.plasticRed, face - side * 0.012, 0.425, hardwareZ, 0.022, 0.024, 0, 0, Math.PI / 2);
  snow(cx, 1.9, vz, d, 0.95, 0.06);
  icicles(cx - side * d / 2, 1.88, vz - 0.45, cx - side * d / 2, 1.88, vz + 0.45, 0.5, 0.25);
  addCollider(cx - d / 2, cx + d / 2, vz - 0.5, vz + 0.5);
  addLight(cx - side * 1.0, 1.2, vz, '#dff2ff', 2.5, 6);
  ctx.vending = { face, z: vz, side, slots };
}

// A dumpster against the left wall, with its ribs, lid, bar and casters.
export function dumpster(ctx) {
  const { mats, box, cyl, snow, addCollider } = ctx;
  const dz = -41, side = -1, d = 1.0;
  const cx = side * (WALL - d / 2 - 0.05);
  box(mats.metalGreen, cx, 0.69, dz, d, 1.1, 1.9);
  box(mats.metalGreen, cx + 0.05, 1.3, dz, d + 0.1, 0.06, 1.95, null, 0, 0, 0.08);
  snow(cx + 0.05, 1.33, dz, d, 1.9, 0.08);
  addCollider(cx - d / 2, cx + d / 2, dz - 1, dz + 1);
  // ribs, top rim, lift bar, end sleeves and casters
  const face = cx - side * d / 2;
  for (let k = -2; k <= 2; k++) box(mats.metalGreen, face - side * 0.015, 0.69, dz + k * 0.42, 0.03, 1.08, 0.07);
  box(mats.metalGreen, face - side * 0.025, 1.18, dz, 0.05, 0.08, 1.92);
  cyl(mats.metal, face - side * 0.07, 0.95, dz, 0.018, 1.5, Math.PI / 2);
  for (const e of [-1, 1]) {
    box(mats.metalDark, cx, 0.8, dz + e * 0.965, 0.2, 0.14, 0.03);
    for (const dx of [-0.34, 0.34]) {
      box(mats.metalDark, cx + dx, 0.13, dz + e * 0.75, 0.1, 0.03, 0.1);
      cyl(mats.cable, cx + dx, 0.065, dz + e * 0.75, 0.065, 0.05, Math.PI / 2);
    }
  }
}
