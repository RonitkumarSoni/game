import * as THREE from 'three';
import { VEHICLES } from './config.js';
import { selectTrack, NOVA_CONTROL_POINTS, EMBER_CONTROL_POINTS, SKYFORGE_CONTROL_POINTS, CHROMEWAVE_CONTROL_POINTS } from './track-data.js';

const POINTS = { harbor: NOVA_CONTROL_POINTS, ember: EMBER_CONTROL_POINTS, skyforge: SKYFORGE_CONTROL_POINTS, chromewave: CHROMEWAVE_CONTROL_POINTS };
const SCALE = 1.15;
const SAMPLE_COUNT = 720;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value) => (value % 1 + 1) % 1;

export function makeOnlineTrack(id) {
  const definition = selectTrack(id);
  const points = POINTS[definition.theme].map(([x, y, z]) => new THREE.Vector3(x * SCALE, y, z * SCALE));
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5);
  curve.arcLengthDivisions = 3000;
  curve.updateArcLengths();
  const length = curve.getLength();
  const samples = Array.from({ length: SAMPLE_COUNT }, (_, index) => curve.getPointAt(index / SAMPLE_COUNT));
  const nearest = (x, z, hint = null) => {
    let best = -1, distance = Infinity;
    const scan = (start, count) => {
      for (let offset = 0; offset < count; offset++) {
        const index = (start + offset + SAMPLE_COUNT) % SAMPLE_COUNT;
        const point = samples[index], next = samples[(index + 1) % SAMPLE_COUNT];
        const dx = next.x - point.x, dz = next.z - point.z;
        const f = clamp(((x - point.x) * dx + (z - point.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
        const squared = (point.x + dx * f - x) ** 2 + (point.z + dz * f - z) ** 2;
        if (squared < distance) { distance = squared; best = index + f; }
      }
    };
    if (hint == null) scan(0, SAMPLE_COUNT);
    else {
      scan(Math.round(hint * SAMPLE_COUNT) - 32, 65);
      if (distance > 70 ** 2) scan(0, SAMPLE_COUNT);
    }
    const index = Math.floor(best), f = best - index;
    return { t: wrap(best / SAMPLE_COUNT), point: samples[index % SAMPLE_COUNT].clone().lerp(samples[(index + 1) % SAMPLE_COUNT], f), distance: Math.sqrt(distance) };
  };
  return { id: definition.id, name: definition.name, curve, length, nearest, pointAt: (t) => curve.getPointAt(wrap(t)), tangentAt: (t) => curve.getTangentAt(wrap(t)).normalize() };
}

export function onlineLevel(xp) { return 1 + Math.floor(Math.max(0, Number(xp) || 0) / 250); }
export function onlineReward(place, finished) { return finished ? 75 + (place === 1 ? 100 : place <= 3 ? 40 : 0) : 0; }

// The browser predicts the same movement that the room validates on the server.
export function advanceOnlineMotion(player, input, dt, track) {
  const stats = (VEHICLES.find((entry) => entry.id === player.vehicleId) || VEHICLES[0]).stats;
  const maxSpeed = 34 + (stats.speed - 3) * 1.3;
  player.speed += ((20 + (stats.accel - 3) * 1.6) * input.throttle - 40 * input.brake) * dt;
  if (input.throttle === 0 && input.brake === 0) player.speed = Math.sign(player.speed) * Math.max(0, Math.abs(player.speed) - 7 * dt);
  if (input.drift && Math.abs(player.speed) > 12) player.driftCharge = (player.driftCharge || 0) + dt;
  else if (player.driftCharge > 0) {
    if (player.driftCharge > 0.7) player.boostFor = 0.5;
    player.driftCharge = 0;
  }
  player.boostFor = Math.max(0, (player.boostFor || 0) - dt);
  player.speed = clamp(player.speed, -8, maxSpeed + (player.boostFor > 0 ? 8 : 0));
  player.steerValue = (player.steerValue || 0) + (input.steer - (player.steerValue || 0)) * (1 - Math.exp(-dt * 12));
  const turn = 1.75 + (stats.handling - 3) * 0.12;
  player.heading -= player.steerValue * Math.sign(player.speed) * turn * clamp(Math.abs(player.speed) / 18, 0, 1.1) * (input.drift ? 1.2 : 1) * dt;
  player.x += Math.sin(player.heading) * player.speed * dt;
  player.z += Math.cos(player.heading) * player.speed * dt;
  const projected = track.nearest(player.x, player.z, player.t);
  if (projected.distance > 17) {
    const factor = 17 / projected.distance;
    player.x = projected.point.x + (player.x - projected.point.x) * factor;
    player.z = projected.point.z + (player.z - projected.point.z) * factor;
    player.speed *= Math.max(0, 1 - dt * 2);
  } else if (projected.distance > 11) player.speed *= Math.max(0, 1 - dt * 1.5);
  player.y = projected.point.y;
  player.prevT = player.t;
  player.t = projected.t;
}

export class OnlineRace {
  constructor({ trackId = 'nova-harbor', laps = 1, players = [], now = Date.now() }) {
    this.track = makeOnlineTrack(trackId);
    this.laps = [1, 3, 5].includes(laps) ? laps : 1;
    this.startsAt = now + 3500;
    this.phase = 'countdown';
    this.elapsed = 0;
    this.firstFinishAt = null;
    this.lastStepAt = now;
    this.players = players.map((entry, index) => {
      const t = wrap(1 - (8 + index * 5.2) / this.track.length);
      const point = this.track.pointAt(t), tangent = this.track.tangentAt(t);
      const side = index % 2 ? 4.5 : -4.5;
      const heading = Math.atan2(tangent.x, tangent.z);
      return {
        id: entry.id, name: entry.name, pilotId: entry.pilotId, vehicleId: entry.vehicleId,
        x: point.x - tangent.z * side, y: point.y, z: point.z + tangent.x * side,
        heading, speed: 0, t, prevT: t, lap: 1, checkpoint: false,
        finished: false, finishTime: null, place: index + 1, input: { throttle: 0, brake: 0, steer: 0, drift: false },
        connected: true, disconnectAt: null, driftCharge: 0, boostFor: 0,
      };
    });
  }

  setInput(id, input) {
    const player = this.players.find((entry) => entry.id === id);
    if (!player || !player.connected || this.phase !== 'racing' || player.finished) return false;
    const steer = Number(input?.steer), throttle = Number(input?.throttle), brake = Number(input?.brake);
    if (![steer, throttle, brake].every(Number.isFinite)) return false;
    player.input = { steer: clamp(steer, -1, 1), throttle: clamp(throttle, 0, 1), brake: clamp(brake, 0, 1), drift: input?.drift === true };
    player.inputAt = this.lastStepAt;
    return true;
  }

  step(now = Date.now()) {
    const dt = clamp((now - this.lastStepAt) / 1000, 0, 0.05);
    this.lastStepAt = now;
    if (this.phase === 'countdown' && now >= this.startsAt) this.phase = 'racing';
    if (this.phase !== 'racing') return;
    this.elapsed += dt;
    for (const player of this.players) {
      if (player.finished) continue;
      if (!player.connected && now - player.disconnectAt > 30000) { player.finished = true; continue; }
      const input = player.connected && now - (player.inputAt || 0) < 500 ? player.input : { throttle: 0, brake: 0, steer: 0, drift: false };
      advanceOnlineMotion(player, input, dt, this.track);
      if (player.t > 0.4 && player.t < 0.62) player.checkpoint = true;
      if (player.t - player.prevT < -0.5 && player.checkpoint) {
        player.checkpoint = false;
        if (player.lap >= this.laps) {
          player.finished = true;
          player.finishTime = this.elapsed;
          this.firstFinishAt ??= now;
          player.speed = 0;
        } else player.lap++;
      }
    }
    const sorted = [...this.players].sort((a, b) => {
      if (a.finished && a.finishTime != null && b.finished && b.finishTime != null) return a.finishTime - b.finishTime;
      if (a.finished && a.finishTime != null) return -1;
      if (b.finished && b.finishTime != null) return 1;
      return (b.lap + b.t) - (a.lap + a.t);
    });
    sorted.forEach((player, index) => { player.place = index + 1; });
    if (this.players.every((player) => player.finished) || (this.firstFinishAt && now - this.firstFinishAt > 30000) || this.elapsed > 600) this.phase = 'done';
  }

  snapshot() {
    return {
      phase: this.phase, startsAt: this.startsAt, elapsed: this.elapsed, laps: this.laps,
      trackId: this.track.id,
      players: this.players.map(({ id, name, pilotId, vehicleId, x, y, z, heading, speed, t, lap, place, finished, finishTime, connected }) =>
        ({ id, name, pilotId, vehicleId, x, y, z, heading, speed, t, lap, place, finished, finishTime, connected })),
    };
  }
}
