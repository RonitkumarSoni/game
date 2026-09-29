import { describe, expect, it } from 'vitest';
import { lapRecordKey, trialRecordKey, readBestLap, saveBestLap } from '../src/lap-records.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe('personal-best laps', () => {
  it('separates records by track, difficulty and vehicle', () => {
    expect(lapRecordKey('Nova', 'easy', 'gt')).not.toBe(lapRecordKey('Nova', 'hard', 'gt'));
    expect(lapRecordKey('Nova', 'easy', 'gt')).not.toBe(lapRecordKey('Nova', 'easy', 'buggy'));
  });

  it('separates trial records by lap count and mode', () => {
    const one = trialRecordKey('Nova', 'easy', 'gt', 1);
    const three = trialRecordKey('Nova', 'easy', 'gt', 3);
    expect(one).not.toBe(three);
    expect(one).not.toBe(lapRecordKey('Nova', 'easy', 'gt'));
  });

  it('only saves faster valid laps', () => {
    const storage = memoryStorage();
    const key = lapRecordKey('Nova', 'easy', 'gt');
    expect(readBestLap(key, storage)).toBeNull();
    expect(saveBestLap(key, 70.5, storage).improved).toBe(true);
    expect(saveBestLap(key, 75, storage).improved).toBe(false);
    expect(saveBestLap(key, -1, storage).improved).toBe(false);
    expect(saveBestLap(key, 68, storage).improved).toBe(true);
    expect(readBestLap(key, storage)).toBe(68);
  });

  it('keeps gameplay working when storage is blocked', () => {
    const storage = { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); } };
    expect(readBestLap('key', storage)).toBeNull();
    expect(saveBestLap('key', 60, storage).improved).toBe(true);
  });
});
