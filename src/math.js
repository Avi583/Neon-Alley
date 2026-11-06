// Small math helpers shared across modules.
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
// Smoothstep of t already in 0..1 (no clamp, for hot loops).
export const smooth01 = (t) => t * t * (3 - 2 * t);
export const sstep = (a, b, x) => smooth01(clamp01((x - a) / (b - a)));
export const frac = (x) => x - Math.floor(x);

// An angle brought into -pi..pi, so turning by it takes the short way round.
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// The yaw that looks from (x, z) to (tx, tz), with yaw 0 looking down -z.
export const yawTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
// The share of the way to a target that frame-rate independent easing at rate k covers in dt.
export const damp = (k, dt) => 1 - Math.exp(-dt * k);

// The angle between sides a and b of a triangle whose third side is c (law of cosines), clamped
// so a triangle that can't close comes out straight or folded rather than NaN.
export const lawOfCosines = (a, b, c) => Math.acos(Math.min(1, Math.max(-1, (a * a + b * b - c * c) / (2 * a * b))));

const REACH = 1.6, FACING = 0.6;
// Is spot ({ face, z }) close enough and in front of someone at (x, z) looking along yaw?
// yaw 0 looks down -z, as in player.js.
export function inReach(spot, x, z, yaw) {
  const dx = spot.face - x, dz = spot.z - z, dist = Math.hypot(dx, dz);
  if (dist > REACH) return false;
  return dist === 0 || (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / dist > FACING;
}
