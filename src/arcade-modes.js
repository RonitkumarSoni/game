export const ELIMINATION_INTERVAL = 22;
export const CHECKPOINT_START_TIME = 35;
export const CHECKPOINT_BONUS = 18;
export const CHECKPOINT_TIME_CAP = 60;

export class ArcadeMode {
  constructor({ mode, race, player, targetLaps = 3 }) {
    if (!['elimination', 'checkpoint-rush'].includes(mode)) throw new Error('Unknown arcade mode');
    this.mode = mode;
    this.race = race;
    this.player = player;
    this.targetGates = Math.max(1, targetLaps | 0) * 4;
    this.timeLeft = mode === 'checkpoint-rush' ? CHECKPOINT_START_TIME : ELIMINATION_INTERVAL;
    this.gates = 0;
    this.nextGate = null;
    this.started = false;
    this.ended = false;
    this.success = false;
    this.warningShown = false;
  }

  update(dt) {
    if (this.ended || this.race.phase !== 'racing' || !Number.isFinite(dt) || dt <= 0) return [];
    if (!this.started) {
      this.started = true;
      if (this.mode === 'checkpoint-rush') this.nextGate = (Math.floor((this.player.raceProgress || 0) * 4) + 1) / 4;
    }
    return this.mode === 'elimination' ? this._updateElimination(dt) : this._updateCheckpoint(dt);
  }

  _updateElimination(dt) {
    const events = [];
    this.timeLeft -= dt;
    if (this.timeLeft <= 5 && !this.warningShown) { this.warningShown = true; events.push({ type: 'warning' }); }
    if (this.timeLeft > 0) return events;
    const active = this.race.standings.filter((kart) => !kart.eliminated);
    if (active.length <= 1) return events;
    const last = active.at(-1);
    last.eliminated = true;
    last.eliminationRank = active.length;
    last.controlsLocked = true;
    if (last.object3D) last.object3D.visible = false;
    events.push({ type: 'eliminated', kart: last, rank: last.eliminationRank });
    this.timeLeft = ELIMINATION_INTERVAL;
    this.warningShown = false;
    if (last === this.player || active.length === 2) {
      this.success = last !== this.player;
      this._finish();
      events.push({ type: 'end', success: this.success, results: this.results });
    }
    return events;
  }

  _updateCheckpoint(dt) {
    const events = [];
    const progress = this.player.raceProgress || 0;
    // Only the next ordered gate counts; a respawn/teleport cannot collect skipped gates.
    if (this.gates < this.targetGates && progress >= this.nextGate && progress < this.nextGate + 0.25) {
      this.gates++;
      this.nextGate += 0.25;
      this.timeLeft = Math.min(CHECKPOINT_TIME_CAP, this.timeLeft + CHECKPOINT_BONUS);
      events.push({ type: 'gate', gates: this.gates, target: this.targetGates });
    }
    if (this.gates >= this.targetGates) {
      this.success = true;
      this._finish();
      events.push({ type: 'end', success: true, results: this.results });
      return events;
    }
    this.timeLeft -= dt;
    if (this.timeLeft <= 5 && !this.warningShown) { this.warningShown = true; events.push({ type: 'warning' }); }
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this._finish();
      events.push({ type: 'end', success: false, results: this.results });
    } else if (this.timeLeft > 5) this.warningShown = false;
    return events;
  }

  _finish() {
    this.ended = true;
    this.race.ended = true;
    this.race.phase = 'mode-done';
    this.player.controlsLocked = true;
    const active = this.race.standings.filter((kart) => !kart.eliminated);
    const activeRanks = new Map(active.map((kart, index) => [kart, index + 1]));
    const placeOf = (kart) => kart.eliminationRank || activeRanks.get(kart) || 8;
    const order = this.mode === 'elimination' ? this.race.karts.slice().sort((a, b) => placeOf(a) - placeOf(b)) : [this.player];
    this.results = order.map((kart, index) => ({
      place: this.mode === 'elimination' ? placeOf(kart) : this.success ? 1 : 2,
      kart, character: kart.character, name: kart.character?.name || 'Racer', isPlayer: kart === this.player,
      time: this.race.raceTime, estimated: kart !== this.player,
      bestLap: kart.lapTimes?.length ? Math.min(...kart.lapTimes) : null,
      success: kart === this.player ? this.success : false,
      gates: this.gates, targetGates: this.targetGates,
    }));
  }
}
