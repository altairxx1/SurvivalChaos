/**
 * Deterministic PRNG (xoshiro128**), 32-bit integer arithmetic only.
 * Identical output on every JS engine, so it is safe for lockstep multiplayer.
 */
export class Rng {
  private s0: number; private s1: number; private s2: number; private s3: number;

  constructor(seed: number) {
    // splitmix32 to expand the seed
    let z = seed >>> 0;
    const next = () => {
      z = (z + 0x9e3779b9) >>> 0;
      let t = z;
      t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
      t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
      return (t ^ (t >>> 15)) >>> 0;
    };
    this.s0 = next(); this.s1 = next(); this.s2 = next(); this.s3 = next();
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) this.s0 = 1;
  }

  /** Uniform uint32. */
  nextU32(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5), 7), 9) >>> 0;
    const t = this.s1 << 9;
    this.s2 ^= this.s0; this.s3 ^= this.s1; this.s1 ^= this.s2; this.s0 ^= this.s3;
    this.s2 ^= t; this.s3 = rotl(this.s3, 11);
    return result;
  }
  /** Uniform float in [0, 1). */
  next(): number { return this.nextU32() / 4294967296; }
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]!; }
  state(): [number, number, number, number] { return [this.s0, this.s1, this.s2, this.s3]; }
  setState(s: readonly number[]): void { this.s0 = s[0]! >>> 0; this.s1 = s[1]! >>> 0; this.s2 = s[2]! >>> 0; this.s3 = s[3]! >>> 0; }
}

function rotl(x: number, k: number): number { return ((x << k) | (x >>> (32 - k))) >>> 0; }

/** Independent named streams so e.g. bot decisions never shift combat rolls. */
export class RngStreams {
  readonly combat: Rng; readonly drops: Rng; readonly bots: Rng; readonly misc: Rng;
  constructor(seed: number) {
    this.combat = new Rng(seed ^ 0x1234567);
    this.drops = new Rng(seed ^ 0x2345678);
    this.bots = new Rng(seed ^ 0x3456789);
    this.misc = new Rng(seed ^ 0x4567891);
  }
  state() { return { combat: this.combat.state(), drops: this.drops.state(), bots: this.bots.state(), misc: this.misc.state() }; }
  setState(s: ReturnType<RngStreams['state']>) {
    this.combat.setState(s.combat); this.drops.setState(s.drops); this.bots.setState(s.bots); this.misc.setState(s.misc);
  }
}
