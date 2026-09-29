export const GRAND_PRIX_ROUNDS = ['OPENING SPRINT', 'NEON CHASE', 'RIFT RUN', 'FINAL SHOWDOWN'];
export const GRAND_PRIX_POINTS = [15, 12, 10, 8, 6, 4, 2, 1];

export class GrandPrix {
  constructor({ racerIds, playerId, seed }) {
    if (!Array.isArray(racerIds) || racerIds.length !== 8 || new Set(racerIds).size !== 8 || !racerIds.includes(playerId)) {
      throw new Error('Grand Prix requires eight distinct racers including the player');
    }
    this.racerIds = racerIds.slice();
    this.playerId = playerId;
    this.seed = String(seed);
    this.history = [];
  }

  get roundIndex() { return this.history.length; }
  get complete() { return this.roundIndex >= GRAND_PRIX_ROUNDS.length; }
  get roundName() { return GRAND_PRIX_ROUNDS[Math.min(this.roundIndex, GRAND_PRIX_ROUNDS.length - 1)]; }
  get roundSeed() { return `${this.seed}:cup:${this.roundIndex}`; }

  award(results) {
    if (this.complete || !Array.isArray(results) || results.length !== this.racerIds.length) return false;
    const ordered = results.slice().sort((a, b) => a.place - b.place);
    if (ordered.some((r, i) => r.place !== i + 1)) return false;
    const ids = ordered.map((r) => r.character?.id);
    if (new Set(ids).size !== this.racerIds.length || ids.some((id) => !this.racerIds.includes(id))) return false;
    this.history.push(ids);
    return true;
  }

  standings() {
    const rows = this.racerIds.map((id, grid) => ({ id, grid, points: 0, wins: 0, placeSum: 0, places: [] }));
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const order of this.history) order.forEach((id, place) => {
      const row = byId.get(id);
      row.points += GRAND_PRIX_POINTS[place] || 0;
      row.wins += place === 0 ? 1 : 0;
      row.placeSum += place + 1;
      row.places.push(place + 1);
    });
    rows.sort((a, b) => b.points - a.points || b.wins - a.wins || a.placeSum - b.placeSum || a.grid - b.grid);
    return rows.map((row, index) => ({ ...row, rank: index + 1, isPlayer: row.id === this.playerId }));
  }

  retryLastRound() {
    if (this.history.length) this.history.pop();
  }
}
