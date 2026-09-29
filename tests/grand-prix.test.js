import { describe, expect, it } from 'vitest';
import { GrandPrix, GRAND_PRIX_ROUNDS } from '../src/grand-prix.js';

const racerIds = ['kael', 'echo', 'nyra', 'glitch', 'brakk', 'solara', 'rook', 'vex'];
const result = (order) => order.map((id, index) => ({ place: index + 1, character: { id } }));

describe('Nova Harbor Cup scoring', () => {
  it('uses distinct deterministic round seeds and four rounds', () => {
    const cup = new GrandPrix({ racerIds, playerId: 'kael', seed: 'abc' });
    expect(cup.roundSeed).toBe('abc:cup:0');
    for (let i = 0; i < GRAND_PRIX_ROUNDS.length; i++) {
      expect(cup.award(result(racerIds))).toBe(true);
      expect(cup.roundIndex).toBe(i + 1);
      expect(cup.roundSeed).toBe(`abc:cup:${i + 1}`);
    }
    expect(cup.complete).toBe(true);
    expect(cup.award(result(racerIds))).toBe(false);
  });

  it('totals points and breaks ties by wins then finishing places', () => {
    const cup = new GrandPrix({ racerIds, playerId: 'kael', seed: 'abc' });
    cup.award(result(racerIds));
    cup.award(result(['echo', 'kael', ...racerIds.slice(2)]));
    const standings = cup.standings();
    expect(standings[0].id).toBe('kael');
    expect(standings[0].points).toBe(27);
    expect(standings[1].points).toBe(27);
    expect(standings[0].wins).toBe(1);
    expect(standings[0].isPlayer).toBe(true);
  });

  it('retry removes only the just-completed round', () => {
    const cup = new GrandPrix({ racerIds, playerId: 'kael', seed: 'abc' });
    cup.award(result(racerIds));
    cup.award(result([...racerIds].reverse()));
    cup.retryLastRound();
    expect(cup.roundIndex).toBe(1);
    expect(cup.standings().find((r) => r.id === 'kael').points).toBe(15);
    expect(cup.roundSeed).toBe('abc:cup:1');
  });

  it('rejects duplicate or missing racers', () => {
    const cup = new GrandPrix({ racerIds, playerId: 'kael', seed: 'abc' });
    const bad = result(racerIds);
    bad[1].character.id = 'kael';
    expect(cup.award(bad)).toBe(false);
    expect(cup.roundIndex).toBe(0);
  });
});
