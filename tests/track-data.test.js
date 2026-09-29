import { describe, expect, it } from 'vitest';
import { EMBER_CONTROL_POINTS, TRACKS, selectTrack } from '../src/track-data.js';

describe('track selection', () => {
  it('keeps Nova Harbor as the default for old saves', () => {
    expect(selectTrack(undefined).id).toBe('nova-harbor');
    expect(selectTrack('missing').id).toBe('nova-harbor');
  });

  it('exposes a separate Ember Rift route', () => {
    expect(TRACKS.map((track) => track.id)).toContain('ember-rift');
    expect(EMBER_CONTROL_POINTS).toHaveLength(24);
    expect(EMBER_CONTROL_POINTS[0]).toEqual([0, 0, -60]);
    expect(EMBER_CONTROL_POINTS[5]).not.toEqual([160, 5, 296]);
  });
});
