import { describe, expect, it } from 'vitest';
import { GhostRecorder, ghostKey, readGhost, saveGhost, sampleGhost, ghostDelta, validGhost } from '../src/ghost.js';

const kart = (x, heading = 0) => ({ position: { x, y: 2, z: 0 }, heading });
const storage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

describe('time-trial ghost', () => {
  it('records at a bounded rate and keeps the finish sample', () => {
    const recorder = new GhostRecorder();
    recorder.capture(0, kart(0), 1);
    recorder.capture(0.04, kart(1), 1.01);
    recorder.capture(0.12, kart(2), 1.02);
    recorder.capture(0.15, kart(3), 2, true);
    const ghost = recorder.finish(0.15);
    expect(ghost.samples).toHaveLength(3);
    expect(ghost.samples.at(-1)[5]).toBe(2);
    expect(validGhost(ghost)).toBe(true);
  });

  it('interpolates position, shortest heading and progress-based delta', () => {
    const recorder = new GhostRecorder();
    recorder.capture(0, kart(0, Math.PI - 0.1), 1);
    recorder.capture(2, kart(10, -Math.PI + 0.1), 2);
    const ghost = recorder.finish(2);
    const pose = sampleGhost(ghost, 1);
    expect(pose.x).toBe(5);
    expect(Math.abs(pose.heading)).toBeCloseTo(Math.PI, 1);
    expect(ghostDelta(ghost, 1.5, 0.8)).toBeCloseTo(-0.2, 2);
    expect(ghostDelta(ghost, 1.5, 1.4)).toBeCloseTo(0.4, 2);
  });

  it('rejects corrupt records and round-trips a valid one', () => {
    const key = ghostKey('trial-key');
    const store = storage();
    expect(readGhost(key, store)).toBeNull();
    const recorder = new GhostRecorder();
    recorder.capture(0, kart(0), 1);
    recorder.capture(1, kart(1), 2);
    const ghost = recorder.finish(1);
    expect(saveGhost(key, ghost, store)).toBe(true);
    expect(readGhost(key, store)).toEqual(ghost);
    store.setItem(key, '{bad');
    expect(readGhost(key, store)).toBeNull();
    expect(validGhost({ ...ghost, samples: [ghost.samples[1], ghost.samples[0]] })).toBe(false);
  });
});
