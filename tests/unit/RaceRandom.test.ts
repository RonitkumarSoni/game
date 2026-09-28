import { describe, expect, it } from 'vitest';
import { RaceRandom } from '../../src/random.js';

describe('RaceRandom', () => {
  it('repeats the same sequence for the same race seed', () => {
    const a = new RaceRandom('nova-42');
    const b = new RaceRandom('nova-42');
    expect(Array.from({ length: 20 }, () => a.nextU32()))
      .toEqual(Array.from({ length: 20 }, () => b.nextU32()));
  });

  it('keeps named subsystem streams reproducible', () => {
    const a = new RaceRandom(1234).fork('items');
    const b = new RaceRandom(1234).fork('items');
    expect(Array.from({ length: 10 }, () => a.next()))
      .toEqual(Array.from({ length: 10 }, () => b.next()));
  });

  it('returns bounded integer indexes', () => {
    const rng = new RaceRandom(9);
    for (let i = 0; i < 1000; i++) expect(rng.int(8)).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < 1000; i++) expect(rng.int(8)).toBeLessThan(8);
  });
});
