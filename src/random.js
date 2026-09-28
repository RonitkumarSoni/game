// Deterministic gameplay random stream. Forks keep subsystems independent from each other.
export class RaceRandom {
  constructor(seed = Date.now()) { this.state = RaceRandom.hash(seed) || 0x6d2b79f5; }
  static hash(seed) {
    if (typeof seed === 'number') return seed >>> 0;
    const text = String(seed);
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  nextU32() {
    let x = this.state = (this.state + 0x6d2b79f5) >>> 0;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return (x ^ (x >>> 14)) >>> 0;
  }
  next() { return this.nextU32() / 0x100000000; }
  int(maxExclusive) { return Math.floor(this.next() * Math.max(1, maxExclusive)); }
  fork(label = '') { return new RaceRandom(this.nextU32() ^ RaceRandom.hash(label)); }
}
