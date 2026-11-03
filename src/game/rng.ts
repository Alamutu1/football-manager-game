/**
 * Small deterministic RNG (mulberry32) plus helpers.
 *
 * Determinism is a design requirement, not a gimmick: the same seed must
 * always generate the same league and the same match result, so saves can
 * store a seed instead of a world, and (later) two players can replay the
 * same match and agree on the outcome without trusting each other.
 */

/** Create an RNG stream from any 32-bit integer seed. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = ReturnType<typeof createRng>;

/** Integer in [min, max], inclusive. */
export function int(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Random element of a non-empty array. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/** True with probability p (0-1). */
export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

/**
 * Roughly bell-shaped value in [min, max], centred on the midpoint.
 * Averaging three uniforms is cheaper than a real normal distribution
 * and plenty for attribute generation.
 */
export function bell(rng: Rng, min: number, max: number): number {
  const mid = (min + max) / 2;
  const spread = (max - min) / 2;
  const avg = (rng() + rng() + rng()) / 3; // 0..1, centred on 0.5
  return Math.round(mid + (avg - 0.5) * 2 * spread);
}

/** Clamp a number into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
