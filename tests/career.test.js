import { describe, expect, it } from 'vitest';
import { careerState } from '../src/career.js';
import { newProfile, recordRace, recordTrial, recordCup, equipTitle, migrateProfile } from '../src/profile.js';

describe('career progression', () => {
  it('unlocks missions in prerequisite order and awards each medal once', () => {
    let profile = newProfile();
    expect(careerState(profile).filter((event) => event.unlocked).map((event) => event.id)).toEqual(['rookie-run']);
    profile = recordRace(profile, { place: 2, time: 100, laps: 3 }).profile;
    expect(profile.careerMedals['rookie-run']).toBe('BRONZE');
    expect(profile.careerMedals['podium-chase']).toBe('SILVER');
    expect(careerState(profile).find((event) => event.id === 'cup-crown').unlocked).toBe(false);
    profile = recordTrial(profile, { time: 100 }).profile;
    expect(profile.careerMedals.clockwork).toBe('SILVER');
    expect(careerState(profile).find((event) => event.id === 'cup-crown').unlocked).toBe(true);
    profile = recordCup(profile, { seed: 'cup-a', rank: 1, points: 50 }).profile;
    expect(profile.careerMedals['cup-crown']).toBe('GOLD');
    const second = recordCup(profile, { seed: 'cup-a', rank: 1, points: 50 });
    expect(second.rewards).toEqual([]);
    expect(second.profile.medals.gold).toBe(1);
  });

  it('only equips an earned title and filters unknown saved titles', () => {
    let profile = newProfile();
    profile = equipTitle(profile, 'RIFT CHAMPION');
    expect(profile.selectedTitle).toBe('ROOKIE RACER');
    profile = recordRace(profile, { place: 1, time: 90, laps: 1 }).profile;
    profile = equipTitle(profile, 'NOVA ACE');
    expect(profile.selectedTitle).toBe('NOVA ACE');
    profile.titles.push('<script>bad</script>');
    expect(migrateProfile(profile).titles).not.toContain('<script>bad</script>');
  });
});
