/**
 * Deterministic math helpers. Only IEEE-754 basic operations (+ - * / sqrt) are used,
 * which are correctly rounded on every engine. Trig functions come from lookup tables
 * built with a Taylor series (also basic ops only).
 */
export const TAU = 6.283185307179586;
export const PI = 3.141592653589793;
const TABLE_SIZE = 4096;
const SIN_TABLE = new Float64Array(TABLE_SIZE + 1);

function taylorSin(x: number): number {
  // x in [-PI, PI]
  let term = x; let sum = x; const x2 = x * x;
  for (let n = 1; n < 12; n++) { term = -term * x2 / ((2 * n) * (2 * n + 1)); sum += term; }
  return sum;
}
for (let i = 0; i <= TABLE_SIZE; i++) {
  let a = (i / TABLE_SIZE) * TAU; if (a > PI) a -= TAU;
  SIN_TABLE[i] = taylorSin(a);
}

function wrap01(a: number): number { const t = a / TAU; return t - Math.floor(t); }

export function sin(a: number): number {
  const f = wrap01(a) * TABLE_SIZE; const i = Math.floor(f); const r = f - i;
  return SIN_TABLE[i]! + (SIN_TABLE[i + 1]! - SIN_TABLE[i]!) * r;
}
export function cos(a: number): number { return sin(a + PI / 2); }

/** atan2 via an 11th-order minimax polynomial (max error ~1e-5 rad), basic ops only. */
export function atan2(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  const ax = Math.abs(x); const ay = Math.abs(y);
  const a = Math.min(ax, ay) / Math.max(ax, ay); const s = a * a;
  let r = a * (0.99997726 + s * (-0.33262347 + s * (0.19354346 + s * (-0.11643287 + s * (0.05265332 + s * -0.0117212)))));
  if (ay > ax) r = PI / 2 - r;
  if (x < 0) r = PI - r;
  if (y < 0) r = -r;
  return r;
}

export function powInt(base: number, n: number): number {
  let r = 1; let b = base; let e = Math.abs(Math.floor(n));
  while (e > 0) { if (e & 1) r *= b; b *= b; e >>= 1; }
  return n < 0 ? 1 / r : r;
}

export function dist2(ax: number, ay: number, bx: number, by: number): number { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function dist(ax: number, ay: number, bx: number, by: number): number { return Math.sqrt(dist2(ax, ay, bx, by)); }
export function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
/** Round to 1/1024 to keep accumulated state compact and stable. */
export function q(v: number): number { return Math.round(v * 1024) / 1024; }
