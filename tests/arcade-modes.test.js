import { describe, expect, it } from 'vitest';
import { ArcadeMode, ELIMINATION_INTERVAL, CHECKPOINT_BONUS } from '../src/arcade-modes.js';

const makeRace = (count = 8) => {
  const karts = Array.from({ length: count }, (_, index) => ({ index, place: index + 1, raceProgress: 1 + (count - index) / 10, object3D: { visible: true }, character: { name: `R${index}` }, lapTimes: [] }));
  return { phase: 'racing', raceTime: 1, karts, standings: karts.slice(), player: karts[0], ended: false };
};

describe('arcade modes', () => {
  it('eliminates the lowest active racer and leaves removed karts non-visible', () => {
    const race = makeRace();
    const mode = new ArcadeMode({ mode: 'elimination', race, player: race.player });
    const events = mode.update(ELIMINATION_INTERVAL);
    expect(events.find((event) => event.type === 'eliminated').kart).toBe(race.karts[7]);
    expect(race.karts[7].eliminationRank).toBe(8);
    expect(race.karts[7].object3D.visible).toBe(false);
    expect(mode.ended).toBe(false);
  });

  it('ends with the last survivor and correct placement', () => {
    const race = makeRace();
    const mode = new ArcadeMode({ mode: 'elimination', race, player: race.player });
    for (let i = 0; i < 7; i++) mode.update(ELIMINATION_INTERVAL);
    expect(mode.ended).toBe(true);
    expect(mode.success).toBe(true);
    expect(mode.results.find((row) => row.isPlayer).place).toBe(1);
    expect(race.phase).toBe('mode-done');
  });

  it('ends immediately if the player is eliminated', () => {
    const race = makeRace();
    race.player = race.karts[7];
    const mode = new ArcadeMode({ mode: 'elimination', race, player: race.player });
    mode.update(ELIMINATION_INTERVAL);
    expect(mode.success).toBe(false);
    expect(mode.results.find((row) => row.isPlayer).place).toBe(8);
  });

  it('awards only ordered checkpoint gates and stops on success', () => {
    const race = makeRace(1);
    race.player.raceProgress = 0.9;
    const mode = new ArcadeMode({ mode: 'checkpoint-rush', race, player: race.player, targetLaps: 1 });
    mode.update(0.1);
    race.player.raceProgress = 1.5;
    expect(mode.update(0.1).some((event) => event.type === 'gate')).toBe(false);
    race.player.raceProgress = 1.01;
    expect(mode.update(0.1).find((event) => event.type === 'gate').gates).toBe(1);
    expect(mode.timeLeft).toBeGreaterThan(35 + CHECKPOINT_BONUS - 1);
    for (const progress of [1.26, 1.51, 1.76]) { race.player.raceProgress = progress; mode.update(0.1); }
    expect(mode.gates).toBe(4);
    expect(mode.success).toBe(true);
  });

  it('times out without awarding success', () => {
    const race = makeRace(1);
    const mode = new ArcadeMode({ mode: 'checkpoint-rush', race, player: race.player, targetLaps: 1 });
    mode.update(36);
    expect(mode.ended).toBe(true);
    expect(mode.success).toBe(false);
    expect(mode.timeLeft).toBe(0);
  });
});
