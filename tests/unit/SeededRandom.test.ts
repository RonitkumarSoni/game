import { describe, it, expect } from 'vitest';
import { SeededRandom } from '@core/SeededRandom';

describe('SeededRandom', () => {
  it('should produce deterministic sequences from the same seed', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(42);
    const seq1 = Array.from({ length: 100 }, () => rng1.next());
    const seq2 = Array.from({ length: 100 }, () => rng2.next());
    expect(seq1).toEqual(seq2);
  });

  it('should produce different sequences from different seeds', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(99);
    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());
    expect(seq1).not.toEqual(seq2);
  });

  it('should produce values in [0, 1)', () => {
    const rng = new SeededRandom(123);
    for (let i = 0; i < 10000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('range() should produce values in [min, max)', () => {
    const rng = new SeededRandom(456);
    for (let i = 0; i < 1000; i++) {
      const v = rng.range(10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
    }
  });

  it('int() should produce integers in [min, max]', () => {
    const rng = new SeededRandom(789);
    const results = new Set<number>();
    for (let i = 0; i < 10000; i++) {
      const v = rng.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
      results.add(v);
    }
    // Should eventually produce all values 1-6
    expect(results.size).toBe(6);
  });

  it('bool() with probability 1 should always return true', () => {
    const rng = new SeededRandom(111);
    for (let i = 0; i < 100; i++) {
      expect(rng.bool(1)).toBe(true);
    }
  });

  it('bool() with probability 0 should always return false', () => {
    const rng = new SeededRandom(222);
    for (let i = 0; i < 100; i++) {
      expect(rng.bool(0)).toBe(false);
    }
  });

  it('pick() should return elements from the array', () => {
    const rng = new SeededRandom(333);
    const arr = ['a', 'b', 'c', 'd'];
    const results = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      results.add(rng.pick(arr));
    }
    expect(results.size).toBe(4);
  });

  it('shuffle() should produce a permutation', () => {
    const rng = new SeededRandom(444);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const original = [...arr];
    rng.shuffle(arr);
    expect(arr.sort()).toEqual(original.sort());
  });

  it('shuffle() should be deterministic', () => {
    const arr1 = [1, 2, 3, 4, 5, 6, 7, 8];
    const arr2 = [1, 2, 3, 4, 5, 6, 7, 8];
    new SeededRandom(555).shuffle(arr1);
    new SeededRandom(555).shuffle(arr2);
    expect(arr1).toEqual(arr2);
  });

  it('weightedIndex() should respect weights', () => {
    const rng = new SeededRandom(666);
    const counts = [0, 0, 0];
    const weights = [1, 0, 0]; // only index 0 should be selected
    for (let i = 0; i < 1000; i++) {
      counts[rng.weightedIndex(weights)]++;
    }
    expect(counts[0]).toBe(1000);
    expect(counts[1]).toBe(0);
    expect(counts[2]).toBe(0);
  });

  it('weightedIndex() should distribute proportionally', () => {
    const rng = new SeededRandom(777);
    const counts = [0, 0];
    const weights = [3, 1]; // ~75% / ~25%
    const N = 10000;
    for (let i = 0; i < N; i++) {
      counts[rng.weightedIndex(weights)]++;
    }
    expect(counts[0] / N).toBeGreaterThan(0.7);
    expect(counts[0] / N).toBeLessThan(0.8);
  });

  it('should accept string seeds', () => {
    const rng1 = new SeededRandom('race-seed-alpha');
    const rng2 = new SeededRandom('race-seed-alpha');
    expect(rng1.next()).toBe(rng2.next());
  });

  it('fork() should create an independent stream', () => {
    const parent = new SeededRandom(888);
    parent.next(); // advance parent
    const child = parent.fork();
    const parentNext = parent.next();
    const childNext = child.next();
    // Parent and child should diverge
    expect(parentNext).not.toBe(childNext);
  });

  it('getState/setState should allow saving and restoring', () => {
    const rng = new SeededRandom(999);
    rng.next(); rng.next(); rng.next();
    const state = rng.getState();
    const expected = [rng.next(), rng.next(), rng.next()];

    rng.setState(state);
    const actual = [rng.next(), rng.next(), rng.next()];
    expect(actual).toEqual(expected);
  });

  it('hashString should produce consistent hashes', () => {
    expect(SeededRandom.hashString('hello')).toBe(SeededRandom.hashString('hello'));
    expect(SeededRandom.hashString('hello')).not.toBe(SeededRandom.hashString('world'));
  });
});
