import { TRACKS } from './track-data.js';
import { CHARACTERS, VEHICLES } from './config.js';
import { OnlineRace, onlineReward } from './online-sim.js';

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const validCode = (code) => /^[A-HJ-NP-Z2-9]{6}$/.test(code);
const cleanName = (value) => String(value || 'Racer').replace(/[<>\x00-\x1f]/g, '').trim().slice(0, 16) || 'Racer';
const cleanId = (value) => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value) ? value : null;
const cleanVehicle = (id) => VEHICLES.some((vehicle) => vehicle.id === id) ? id : VEHICLES[0].id;
const cleanPilot = (id) => CHARACTERS.some((pilot) => pilot.id === id) ? id : CHARACTERS[0].id;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Invalid request' }, 400); }
      const hostId = cleanId(body?.playerId);
      if (!hostId) return json({ error: 'Invalid player identity' }, 400);
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => alphabet[byte % alphabet.length]).join('');
        const stub = env.RACE_ROOMS.get(env.RACE_ROOMS.idFromName(code));
        const result = await stub.fetch(new Request(`https://room.internal/init`, { method: 'POST', body: JSON.stringify({ code, hostId }) }));
        if (result.status === 201) return json({ code, inviteUrl: `${url.origin}/?room=${code}` }, 201);
      }
      return json({ error: 'Could not create a room. Please try again.' }, 503);
    }
    const match = url.pathname.match(/^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})(?:\/(ws))?$/);
    if (!match || !validCode(match[1])) return json({ error: 'Room not found' }, 404);
    const stub = env.RACE_ROOMS.get(env.RACE_ROOMS.idFromName(match[1]));
    return stub.fetch(new Request(`https://room.internal/${match[2] || 'status'}`, request));
  },
};

export class RaceRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Map();
    this.players = new Map();
    this.race = null;
    this.interval = null;
    this.tickCount = 0;
    this.meta = null;
  }

  async _load() { this.meta ??= await this.state.storage.get('meta') || null; }
  _send(socket, payload) { try { socket.send(JSON.stringify(payload)); } catch { /* closed */ } }
  _broadcast(payload) { for (const socket of this.clients.keys()) this._send(socket, payload); }
  _lobby() {
    return { type: 'lobby', code: this.meta.code, hostId: this.meta.hostId, trackId: this.meta.trackId, laps: this.meta.laps,
      phase: this.race?.phase || 'lobby', players: [...this.players.values()].map(({ id, name, pilotId, vehicleId, ready, connected }) => ({ id, name, pilotId, vehicleId, ready, connected })) };
  }
  _stop() { if (this.interval != null) clearInterval(this.interval); this.interval = null; }
  _tick() {
    if (!this.race) return;
    this.race.step(Date.now());
    this.tickCount++;
    this._broadcast({ type: 'snapshot', ...this.race.snapshot() });
    if (this.race.phase === 'done') {
      const rows = this.race.players.map((player) => ({ id: player.id, name: player.name, pilotId: player.pilotId, place: player.place,
        finished: player.finishTime != null, time: player.finishTime, xp: onlineReward(player.place, player.finishTime != null) }));
      this.results = { type: 'results', matchId: `${this.meta.code}-${this.race.startsAt}`, rows, trackId: this.meta.trackId, trackName: this.race.track.name, laps: this.meta.laps };
      this._broadcast(this.results);
      this._stop();
    }
  }

  async fetch(request) {
    await this._load();
    const path = new URL(request.url).pathname;
    if (path === '/init' && request.method === 'POST') {
      if (this.meta) return json({ error: 'Room code already in use' }, 409);
      const { code, hostId } = await request.json();
      this.meta = { code, hostId, trackId: 'nova-harbor', laps: 1, createdAt: Date.now() };
      await this.state.storage.put('meta', this.meta);
      return json({ code }, 201);
    }
    if (!this.meta || Date.now() - this.meta.createdAt > 6 * 60 * 60 * 1000) return json({ error: 'Room expired' }, 404);
    if (path === '/status' && request.method === 'GET') return json(this._lobby());
    if (path !== '/ws' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'WebSocket required' }, 426);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.clients.set(server, null);
    server.addEventListener('message', (event) => this._message(server, event.data));
    server.addEventListener('close', () => this._close(server));
    server.addEventListener('error', () => this._close(server));
    this._send(server, { type: 'connected', code: this.meta.code });
    return new Response(null, { status: 101, webSocket: client });
  }

  _message(socket, raw) {
    if (typeof raw !== 'string' || raw.length > 2048) return;
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    if (message.type === 'join') {
      const id = cleanId(message.playerId);
      if (!id) return this._send(socket, { type: 'error', message: 'Invalid player identity' });
      const existing = this.players.get(id);
      if (existing?.connected && existing.socket !== socket) return this._send(socket, { type: 'error', message: 'This player is already in the room' });
      if (!existing && (this.players.size >= 4 || this.race)) return this._send(socket, { type: 'error', message: 'Room is full or race has started' });
      const player = existing || { id, ready: false };
      player.name = cleanName(message.name);
      if (!this.race) {
        player.pilotId = cleanPilot(message.pilotId);
        player.vehicleId = cleanVehicle(message.vehicleId);
      }
      player.socket = socket; player.connected = true;
      this.players.set(id, player);
      // Recover lobby ownership after the last host left or the local server restarted.
      if (!this.race && !this.players.get(this.meta.hostId)?.connected) {
        this.meta.hostId = id;
        this.state.storage.put('meta', this.meta);
      }
      this.clients.set(socket, id);
      const racer = this.race?.players.find((entry) => entry.id === id);
      if (racer) { racer.connected = true; racer.disconnectAt = null; this._send(socket, { type: 'snapshot', ...this.race.snapshot() }); if (this.results) this._send(socket, this.results); }
      this._broadcast(this._lobby());
      return;
    }
    const id = this.clients.get(socket);
    if (!id) return this._send(socket, { type: 'error', message: 'Join the room first' });
    const player = this.players.get(id);
    if (message.type === 'ready' && !this.race) { player.ready = message.ready === true; this._broadcast(this._lobby()); }
    else if (message.type === 'configure' && id === this.meta.hostId && !this.race) {
      if (TRACKS.some((track) => track.id === message.trackId)) this.meta.trackId = message.trackId;
      if ([1, 3, 5].includes(message.laps)) this.meta.laps = message.laps;
      this.state.storage.put('meta', this.meta);
      for (const entry of this.players.values()) entry.ready = false;
      this._broadcast(this._lobby());
    } else if (message.type === 'start' && id === this.meta.hostId && !this.race) {
      if (this.players.size < 2 || ![...this.players.values()].every((entry) => entry.ready && entry.connected)) return this._send(socket, { type: 'error', message: 'At least two connected racers must be ready' });
      this.race = new OnlineRace({ trackId: this.meta.trackId, laps: this.meta.laps, players: [...this.players.values()] });
      this.tickCount = 0;
      this._broadcast({ type: 'snapshot', ...this.race.snapshot() });
      this.interval = setInterval(() => this._tick(), 1000 / 30);
    } else if (message.type === 'input' && this.race) this.race.setInput(id, message);
  }

  _close(socket) {
    const id = this.clients.get(socket);
    this.clients.delete(socket);
    if (!id) return;
    const player = this.players.get(id);
    if (!player || player.socket !== socket) return;
    player.connected = false; player.socket = null; player.ready = false;
    const racer = this.race?.players.find((entry) => entry.id === id);
    if (racer) { racer.connected = false; racer.disconnectAt = Date.now(); }
    else {
      this.players.delete(id);
      if (id === this.meta.hostId) {
        this.meta.hostId = this.players.keys().next().value || null;
        this.state.storage.put('meta', this.meta);
      }
    }
    this._broadcast(this._lobby());
    if (this.clients.size === 0 && !this.race) this._stop();
  }
}
