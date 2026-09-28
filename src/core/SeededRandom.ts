/**
 * Neon Rift Racers — Seeded Random Number Generator
 *
 * Deterministic PRNG using the xoshiro128** algorithm.
 * Used for all gameplay randomness: AI decisions, ability distribution,
 * grid placement, track events, etc.
 *
 * Given the same seed, the sequence is perfectly reproducible,
 * enabling replay, deterministic testing, and bug reproduction.
 */

export class SeededRandom {
  private s: Uint32Array;

  /**
   * Create a new SeededRandom with the given seed.
   * @param seed - A number or string to seed the generator.
   */
  constructor(seed: number | string = Date.now()) {
    const hash = typeof seed === 'string' ? SeededRandom.hashString(seed) : seed >>> 0;
    // Initialize state using splitmix32 to expand a single seed into 4 words
    this.s = new Uint32Array(4);
    let z = hash;
    for (let i = 0; i < 4; i++) {
      z += 0x9e3779b9;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      this.s[i] = (z ^ (z >>> 16)) >>> 0;
    }
    // Ensure non-zero state
    if (this.s[0] === 0 && this.s[1] === 0 && this.s[2] === 0 && this.s[3] === 0) {
      this.s[0] = 1;
    }
  }

  /**
   * Hash a string into a 32-bit unsigned integer (FNV-1a).
   */
  static hashString(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  /**
   * Get the next raw 32-bit unsigned integer.
   */
  nextU32(): number {
    const s = this.s;
    const result = Math.imul(rotl(Math.imul(s[1], 5), 7), 9) >>> 0;
    const t = (s[1] << 9) >>> 0;

    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = rotl(s[3], 11) >>> 0;

    return result;
  }

  /**
   * Get a random float in [0, 1).
   */
  next(): number {
    return this.nextU32() / 0x100000000;
  }

  /**
   * Get a random float in [min, max).
   */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Get a random integer in [min, max] (inclusive).
   */
  int(min: number, max: number): number {
    return min + (this.nextU32() % (max - min + 1));
  }

  /**
   * Get a random boolean with the given probability of true.
   */
  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Pick a random element from an array.
   */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  /**
   * Shuffle an array in-place using Fisher-Yates.
   */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Select an index from a weighted probability array.
   * @param weights - Array of non-negative weights (do not need to sum to 1).
   */
  weightedIndex(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w;
    if (total <= 0) return 0;

    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
  }

  /**
   * Fork a new independent SeededRandom from the current state.
   * Useful for creating sub-streams (e.g., per-AI or per-system).
   */
  fork(): SeededRandom {
    const child = new SeededRandom(0);
    child.s[0] = this.nextU32();
    child.s[1] = this.nextU32();
    child.s[2] = this.nextU32();
    child.s[3] = this.nextU32();
    if (child.s[0] === 0 && child.s[1] === 0 && child.s[2] === 0 && child.s[3] === 0) {
      child.s[0] = 1;
    }
    return child;
  }

  /**
   * Serialize the current state so it can be restored later.
   */
  getState(): [number, number, number, number] {
    return [this.s[0], this.s[1], this.s[2], this.s[3]];
  }

  /**
   * Restore state from a previous getState() call.
   */
  setState(state: [number, number, number, number]): void {
    this.s[0] = state[0];
    this.s[1] = state[1];
    this.s[2] = state[2];
    this.s[3] = state[3];
  }
}

/** Rotate left helper for xoshiro128** */
function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}
