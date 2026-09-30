import { describe, expect, it } from 'vitest';
import { EMBER_CONTROL_POINTS, SKYFORGE_CONTROL_POINTS, CHROMEWAVE_CONTROL_POINTS, TRACKS, selectTrack } from '../src/track-data.js';
import { surfaceParticleKind } from '../src/effects.js';

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

  it('offers four distinct playable circuits with a consistent starting grid', () => {
    expect(TRACKS.map((track) => track.id)).toEqual([
      'nova-harbor', 'ember-rift', 'skyforge-circuit', 'chromewave-city',
    ]);
    for (const route of [EMBER_CONTROL_POINTS, SKYFORGE_CONTROL_POINTS, CHROMEWAVE_CONTROL_POINTS]) {
      expect(route).toHaveLength(24);
      expect(route[0]).toEqual([0, 0, -60]);
      expect(route[1]).toEqual([0, 0, 60]);
      expect(route.every((point) => point.length === 3 && point.every(Number.isFinite))).toBe(true);
    }
    expect(SKYFORGE_CONTROL_POINTS[5]).not.toEqual(EMBER_CONTROL_POINTS[5]);
    expect(CHROMEWAVE_CONTROL_POINTS[5]).not.toEqual(SKYFORGE_CONTROL_POINTS[5]);
  });

  it('uses snow particles on the Skyforge ice circuit', () => {
    expect(selectTrack('skyforge-circuit').theme).toBe('skyforge');
    expect(surfaceParticleKind(selectTrack('skyforge-circuit').theme)).toBe('snow');
    expect(surfaceParticleKind(selectTrack('nova-harbor').theme)).toBe('grass');
  });
});
