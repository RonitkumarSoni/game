import { describe, expect, it } from 'vitest';
import { PROFILE_KEY, LEGACY_PROFILE_KEY, newProfile, loadProfile, saveProfile, recordRace, recordTrial, recordCup, recordArcade } from '../src/profile.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
}

describe('versioned racer profile', () => {
  it('saves and restores stats safely', () => {
    const storage = memoryStorage();
    const updated = recordRace(newProfile(), { place: 1, time: 80, laps: 3, pilot: 'Kael' });
    expect(updated.rewards).toContain('NOVA ACE');
    expect(saveProfile(updated.profile, storage)).toBe(true);
    const loaded = loadProfile(storage);
    expect(loaded.status).toBe('loaded');
    expect(loaded.profile.stats.wins).toBe(1);
    expect(loaded.profile.history[0].pilot).toBe('Kael');
  });

  it('migrates v1 data and backs up an invalid raw save', () => {
    const storage = memoryStorage();
    storage.setItem(LEGACY_PROFILE_KEY, JSON.stringify({ version: 1, stats: { races: 5 }, achievements: ['firstRace'] }));
    const migrated = loadProfile(storage);
    expect(migrated.status).toBe('migrated');
    expect(migrated.profile.version).toBe(2);
    expect(migrated.profile.stats.races).toBe(5);
    storage.setItem(PROFILE_KEY, '{broken');
    const recovered = loadProfile(storage);
    expect(recovered.status).toBe('recovered');
    expect(recovered.profile.stats.races).toBe(0);
    expect([...storage.values.keys()].some((key) => key.startsWith(`${PROFILE_KEY}:corrupt:`))).toBe(true);
  });

  it('awards trial achievements and prevents duplicate cup medals', () => {
    let profile = recordTrial(newProfile(), { time: 93, pilot: 'Echo', newBest: true }).profile;
    expect(profile.achievements).toContain('trialRecord');
    const cup = recordCup(profile, { seed: 'cup-1', rank: 1, points: 60 });
    profile = cup.profile;
    expect(cup.rewards).toContain('GOLD CUP MEDAL');
    expect(profile.medals.gold).toBe(1);
    expect(recordCup(profile, { seed: 'cup-1', rank: 1, points: 60 }).profile.medals.gold).toBe(1);
  });

  it('retains only twenty recent events', () => {
    let profile = newProfile();
    for (let i = 0; i < 25; i++) profile = recordRace(profile, { place: 5, time: 90, laps: 1, pilot: 'Vex' }).profile;
    expect(profile.history).toHaveLength(20);
    expect(profile.stats.races).toBe(25);
    expect(profile.achievements).toContain('tenRaces');
  });

  it('tracks survival and checkpoint clears separately from regular race stats', () => {
    let profile = recordArcade(newProfile(), { mode: 'elimination', success: true, place: 1, time: 150 }).profile;
    profile = recordArcade(profile, { mode: 'checkpoint-rush', success: true, place: 1, time: 100, gates: 12 }).profile;
    expect(profile.stats.races).toBe(0);
    expect(profile.stats.eliminationWins).toBe(1);
    expect(profile.stats.checkpointClears).toBe(1);
    expect(profile.achievements).toContain('lastStanding');
    expect(profile.achievements).toContain('gateRunner');
  });
});
