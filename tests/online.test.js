import { describe, expect, it } from 'vitest';
import { OnlineRace, makeOnlineTrack, onlineReward, advanceOnlineMotion } from '../src/online-sim.js';
import { newProfile, recordOnlineRace } from '../src/profile.js';
import { garageLevel } from '../src/garage.js';

const players = [
  { id: 'a', name: 'Alpha', pilotId: 'vex', vehicleId: 'nova' },
  { id: 'b', name: 'Bravo', pilotId: 'vex', vehicleId: 'nova' },
];

describe('private online race', () => {
  it('predicts controls immediately and stops stale acceleration', () => {
    const race = new OnlineRace({ players, now: 0 });
    race.step(3500);
    const predicted = { ...race.players[0] };
    advanceOnlineMotion(predicted, { throttle: 1, brake: 0, steer: 1, drift: false }, 1 / 60, race.track);
    expect(predicted.speed).toBeGreaterThan(0);
    expect(predicted.heading).not.toBe(race.players[0].heading);
    race.setInput('a', { throttle: 1, brake: 0, steer: 0 });
    race.step(3533);
    const speed = race.players[0].speed;
    race.step(4100);
    expect(race.players[0].speed).toBeLessThan(speed);
  });

  it('does not award the same match twice after reconnection', () => {
    const result = { place: 1, time: 65, xp: 175, matchId: 'ABCDEF-123' };
    const once = recordOnlineRace(newProfile(), result).profile;
    const twice = recordOnlineRace(once, result).profile;
    expect(twice.stats.onlineXp).toBe(175);
    expect(twice.stats.onlineRaces).toBe(1);
  });

  it('coasts smoothly in reverse and reverses steering direction', () => {
    const race = new OnlineRace({ players, now: 0 });
    race.step(3500);
    const player = race.players[0];
    player.speed = -6;
    race.setInput('a', { throttle: 0, brake: 0, steer: 1 });
    const heading = player.heading;
    race.step(3533);
    expect(player.speed).toBeLessThan(-5);
    expect(player.heading).toBeGreaterThan(heading);
  });

  it('finishes a driven lap and ends after the remaining-racer deadline', () => {
    const race = new OnlineRace({ players, now: 0 });
    let now = 3500;
    for (; now < 180000 && race.players[0].finishTime == null; now += 1000 / 30) {
      race.step(now);
      const player = race.players[0];
      const target = race.track.pointAt(player.t + 14 / race.track.length);
      const angle = Math.atan2(target.x - player.x, target.z - player.z) - player.heading;
      const steer = -2 * Math.atan2(Math.sin(angle), Math.cos(angle));
      race.setInput('a', { throttle: 1, brake: 0, steer });
    }
    expect(race.players[0].finishTime).toBeGreaterThan(0);
    expect(race.players[0].place).toBe(1);
    race.step(now + 31000);
    expect(race.phase).toBe('done');
    expect(race.players[1].finishTime).toBeNull();
  });

  it('uses the same track route and starts with two distinct racers', () => {
    const track = makeOnlineTrack('nova-harbor');
    const race = new OnlineRace({ players, now: 1000 });
    expect(track.length).toBeGreaterThan(1000);
    expect(race.snapshot().players).toHaveLength(2);
    expect(race.players[0].x).not.toBe(race.players[1].x);
    expect(race.setInput('a', { throttle: 1, brake: 0, steer: 0 })).toBe(false);
    race.step(4500);
    expect(race.phase).toBe('racing');
    expect(race.setInput('a', { throttle: 1, brake: 0, steer: Number.NaN })).toBe(false);
    expect(race.setInput('a', { throttle: 1, brake: 0, steer: 0 })).toBe(true);
    race.step(4533);
    expect(race.players[0].speed).toBeGreaterThan(0);
    expect(race.players[1].speed).toBe(0);
  });

  it('awards online XP without advancing solo Career missions', () => {
    const before = newProfile();
    const result = recordOnlineRace(before, { place: 1, time: 95, xp: onlineReward(1, true), pilot: 'vex', track: 'Nova Harbor' });
    expect(result.profile.stats.onlineRaces).toBe(1);
    expect(result.profile.stats.onlineWins).toBe(1);
    expect(result.profile.stats.races).toBe(0);
    expect(result.profile.careerMedals).toEqual(before.careerMedals);
    expect(garageLevel(result.profile)).toBeGreaterThanOrEqual(garageLevel(before));
    expect(onlineReward(2, false)).toBe(0);
  });
});
