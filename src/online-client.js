import { CHARACTERS, VEHICLES } from './config.js';
import { TRACKS } from './track-data.js';
import { garageLevel, vehicleUnlocked, VEHICLE_LEVELS } from './garage.js';
import './online.css';

const PROFILE_ID_KEY = 'nrr-online-guest-id';
const NAME_KEY = 'nrr-online-name';
const ROOM_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
const option = (value, label) => { const node = document.createElement('option'); node.value = value; node.textContent = label; return node; };

export class OnlineClient {
  constructor(parent, handlers) {
    this.handlers = handlers;
    this.id = localStorage.getItem(PROFILE_ID_KEY);
    if (!/^[a-f0-9-]{36}$/.test(this.id || '')) {
      this.id = crypto.randomUUID();
      localStorage.setItem(PROFILE_ID_KEY, this.id);
    }
    this.roomCode = null;
    this.room = null;
    this.socket = null;
    this.started = false;
    this.manualClose = false;
    this.lastInputAt = 0;
    this.retryUntil = 0;
    this.root = document.createElement('section');
    this.root.className = 'online-screen';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="online-shell">
        <header class="online-header"><div><small>NEON RIFT RACERS // ONLINE</small><h1>RACE WITH FRIENDS</h1></div><button class="online-close" type="button" aria-label="Close online racing">✕</button></header>
        <div class="online-connect">
          <label>YOUR RACER NAME <input class="online-name" maxlength="16" autocomplete="nickname" placeholder="Racer"></label>
          <div class="online-grid"><label>PILOT <select class="online-pilot"></select></label><label>KART <select class="online-kart"></select></label></div>
          <div class="online-entry"><button class="online-create" type="button">CREATE PRIVATE ROOM</button><span>OR</span><input class="online-code" maxlength="6" spellcheck="false" aria-label="Six-character invite code" placeholder="INVITE CODE"><button class="online-join" type="button">JOIN</button></div>
          <p class="online-help">Share the invite link with 1–3 friends. Career missions stay solo; each racer keeps their own level and kart unlocks.</p>
        </div>
        <div class="online-lobby" hidden>
          <div class="online-room-line"><span>ROOM <strong class="online-room-code"></strong></span><button class="online-copy" type="button">COPY INVITE LINK</button></div>
          <div class="online-grid online-config"><label>TRACK <select class="online-track"></select></label><label>LAPS <select class="online-laps"><option value="1">1 LAP</option><option value="3">3 LAPS</option><option value="5">5 LAPS</option></select></label></div>
          <div class="online-roster"></div>
          <div class="online-footer"><button class="online-ready" type="button">READY</button><button class="online-start" type="button">START RACE</button></div>
        </div>
        <div class="online-results" hidden></div>
        <p class="online-status" role="status"></p>
      </div>`;
    parent.append(this.root);
    this.raceExit = document.createElement('button');
    this.raceExit.className = 'online-race-exit';
    this.raceExit.type = 'button';
    this.raceExit.textContent = 'LEAVE ONLINE RACE';
    this.raceExit.hidden = true;
    parent.append(this.raceExit);
    this.finishEffect = document.createElement('div');
    this.finishEffect.className = 'online-finish-effect';
    this.finishEffect.hidden = true;
    parent.append(this.finishEffect);
    this.raceExit.onclick = () => this.close();
    this.root.querySelector('.online-close').onclick = () => this.close();
    this.root.querySelector('.online-create').onclick = () => this.create();
    this.root.querySelector('.online-join').onclick = () => this.join(this.root.querySelector('.online-code').value);
    this.root.querySelector('.online-code').addEventListener('keydown', (event) => { if (event.key === 'Enter') this.join(event.target.value); });
    this.root.querySelector('.online-copy').onclick = () => this.copyInvite();
    this.root.querySelector('.online-ready').onclick = () => this.send({ type: 'ready', ready: !this.room?.players.find((player) => player.id === this.id)?.ready });
    this.root.querySelector('.online-start').onclick = () => this.send({ type: 'start' });
    this.root.querySelector('.online-track').onchange = () => this.configure();
    this.root.querySelector('.online-laps').onchange = () => this.configure();
    this.root.querySelector('.online-name').value = localStorage.getItem(NAME_KEY) || 'Racer';
    this.root.querySelector('.online-pilot').replaceChildren(...CHARACTERS.map((pilot) => option(pilot.id, pilot.name)));
    this.root.querySelector('.online-track').replaceChildren(...TRACKS.map((track) => option(track.id, track.name)));
    this.root.querySelector('.online-pilot').onchange = () => this._rejoinSelection();
    this.root.querySelector('.online-kart').onchange = () => this._rejoinSelection();
  }

  _status(message) { this.root.querySelector('.online-status').textContent = message; }
  _name() {
    const value = this.root.querySelector('.online-name').value.replace(/[<>\x00-\x1f]/g, '').trim().slice(0, 16) || 'Racer';
    localStorage.setItem(NAME_KEY, value);
    return value;
  }
  _selection() { return { name: this._name(), pilotId: this.root.querySelector('.online-pilot').value, vehicleId: this.root.querySelector('.online-kart').value }; }
  _rejoinSelection() { if (this.room && !this.started) this.send({ type: 'join', playerId: this.id, ...this._selection() }); }
  _refreshKarts() {
    const profile = this.handlers.getProfile();
    const picker = this.root.querySelector('.online-kart');
    const previous = picker.value;
    picker.replaceChildren(...VEHICLES.map((vehicle) => {
      const unlocked = vehicleUnlocked(vehicle, profile);
      const item = option(vehicle.id, unlocked ? vehicle.name : `${vehicle.name} · LVL ${VEHICLE_LEVELS[vehicle.id]}`);
      item.disabled = !unlocked;
      return item;
    }));
    picker.value = VEHICLES.some((vehicle) => vehicle.id === previous && vehicleUnlocked(vehicle, profile)) ? previous : 'nova';
  }
  open(inviteCode = null) {
    this._refreshKarts();
    this.root.hidden = false;
    this.root.querySelector('.online-results').hidden = true;
    this._status(`YOUR LEVEL ${garageLevel(this.handlers.getProfile())} · Choose a pilot and kart to join.`);
    if (inviteCode) {
      this.root.querySelector('.online-code').value = inviteCode.toUpperCase();
      this.join(inviteCode);
    }
  }
  async create() {
    this._status('Creating your private room…');
    try {
      const response = await fetch('/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ playerId: this.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Room unavailable');
      this.connect(data.code);
    } catch (error) { this._status(`${error.message}. Start the online server if testing locally.`); }
  }
  async join(value) {
    const code = String(value || '').trim().toUpperCase();
    if (!ROOM_PATTERN.test(code)) { this._status('Enter a valid 6-character invite code.'); return; }
    this._status('Finding room…');
    try {
      const response = await fetch(`/api/rooms/${code}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Room unavailable');
      this.connect(code);
    } catch (error) { this._status(error.message); }
  }
  connect(code) {
    this.manualClose = false;
    this.roomCode = code;
    this.socket?.close();
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = this.socket = new WebSocket(`${protocol}//${location.host}/api/rooms/${code}/ws`);
    socket.onopen = () => { this.retryUntil = 0; this.send({ type: 'join', playerId: this.id, ...this._selection() }); this._status('Connected. Waiting for racers…'); };
    socket.onmessage = (event) => {
      if (this.socket !== socket || this.manualClose) return;
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === 'error') return this._status(data.message);
      if (data.type === 'lobby') { this.room = data; if (!this.started) this.renderLobby(); }
      if (data.type === 'snapshot') {
        if (!this.started) { this.started = true; this.root.hidden = true; this.raceExit.hidden = false; this.handlers.onStart?.(data); }
        this.handlers.onSnapshot?.(data);
      }
      if (data.type === 'results') {
        this.raceExit.hidden = true;
        this.handlers.onResults?.(data);
        this.showResults(data);
      }
    };
    socket.onclose = () => {
      if (this.socket !== socket || this.manualClose) return;
      if (this.started) {
        if (!this.retryUntil) this.retryUntil = Date.now() + 30000;
      }
      if (this.started && Date.now() < this.retryUntil) {
        this._status('Connection lost. Rejoining race…');
        setTimeout(() => { if (!this.manualClose) this.connect(code); }, 1500);
      } else {
        this.root.hidden = false; this.raceExit.hidden = true;
        this._status('Disconnected. Join again with the same code.');
      }
    };
  }
  send(data) { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(data)); }
  sendInput(input) {
    if (!this.started || this.socket?.readyState !== WebSocket.OPEN || performance.now() - this.lastInputAt < 30) return;
    this.lastInputAt = performance.now();
    this.send({ type: 'input', throttle: input.throttle || 0, brake: input.brake || 0, steer: input.steer || 0, drift: !!input.drift });
  }
  configure() { this.send({ type: 'configure', trackId: this.root.querySelector('.online-track').value, laps: Number(this.root.querySelector('.online-laps').value) }); }
  async copyInvite() {
    const url = `${location.origin}/?room=${this.roomCode}`;
    try { await navigator.clipboard.writeText(url); this._status('Invite link copied. Send it to your friends.'); }
    catch { this._status(url); }
  }
  renderLobby() {
    if (!this.room) return;
    if (this.room.phase !== 'lobby') return;
    this.root.hidden = false;
    this.root.querySelector('.online-connect').hidden = true;
    this.root.querySelector('.online-lobby').hidden = false;
    this.root.querySelector('.online-room-code').textContent = this.room.code;
    const isHost = this.room.hostId === this.id;
    const track = this.root.querySelector('.online-track');
    const laps = this.root.querySelector('.online-laps');
    track.value = this.room.trackId; laps.value = String(this.room.laps);
    track.disabled = !isHost; laps.disabled = !isHost;
    const roster = this.root.querySelector('.online-roster');
    roster.replaceChildren(...this.room.players.map((player) => {
      const row = document.createElement('div'); row.className = 'online-racer';
      const name = document.createElement('strong'); name.textContent = `${player.name}${player.id === this.id ? ' (YOU)' : ''}${player.id === this.room.hostId ? ' · HOST' : ''}`;
      const details = document.createElement('span'); details.textContent = `${CHARACTERS.find((pilot) => pilot.id === player.pilotId)?.name || 'Pilot'} · ${VEHICLES.find((vehicle) => vehicle.id === player.vehicleId)?.name || 'Kart'}`;
      const ready = document.createElement('b'); ready.textContent = player.connected ? player.ready ? 'READY' : 'WAITING' : 'OFFLINE';
      row.append(name, details, ready); return row;
    }));
    const self = this.room.players.find((player) => player.id === this.id);
    this.root.querySelector('.online-ready').textContent = self?.ready ? 'CANCEL READY' : 'READY';
    const start = this.root.querySelector('.online-start');
    const allReady = this.room.players.length >= 2 && this.room.players.every((player) => player.ready && player.connected);
    const host = this.room.players.find((player) => player.id === this.room.hostId);
    start.hidden = false;
    start.textContent = isHost ? 'START RACE' : 'WAITING FOR HOST';
    start.disabled = !isHost || !allReady;
    const hint = this.room.players.length < 2 ? 'Invite at least one friend.' : !allReady ? 'Every racer must press READY.' : isHost ? 'Everyone is ready. Press START RACE.' : `Everyone is ready. ${host?.name || 'The host'} must press START RACE.`;
    this._status(`ROOM ${this.room.code} · ${this.room.players.length}/4 racers · ${hint}`);
  }
  showResults(data) {
    this.started = false;
    this.finishEffect.hidden = true;
    this.root.hidden = false;
    this.root.querySelector('.online-connect').hidden = true;
    this.root.querySelector('.online-lobby').hidden = true;
    const panel = this.root.querySelector('.online-results'); panel.hidden = false;
    panel.replaceChildren();
    const own = data.rows.find((row) => row.id === this.id);
    const won = own?.finished && own.place === 1;
    panel.classList.toggle('victory', !!won);
    const title = document.createElement('h2'); title.textContent = won ? '🏆 VICTORY!' : own?.finished ? 'RACE COMPLETE' : 'RACE OVER'; panel.append(title);
    const summary = document.createElement('p'); summary.className = 'online-result-summary';
    summary.textContent = own?.finished ? `${own.place === 1 ? 'You won the race!' : `You finished ${own.place}${own.place === 2 ? 'nd' : own.place === 3 ? 'rd' : 'th'}.`} +${own.xp} XP · ${data.trackName || 'Private race'}` : 'You did not finish this race. Try again!';
    panel.append(summary);
    for (const row of [...data.rows].sort((a, b) => a.place - b.place)) {
      const line = document.createElement('div'); line.className = 'online-result-line';
      line.textContent = `${row.place}. ${row.name}${row.id === this.id ? ' (YOU)' : ''} — ${row.finished ? `${row.time.toFixed(1)}s · +${row.xp} XP` : 'DNF'}`;
      panel.append(line);
    }
    const back = document.createElement('button'); back.textContent = 'BACK TO MENU'; back.onclick = () => this.close(); panel.append(back);
    this._status('Each racer earned progress on their own profile.');
  }
  showFinish(row) {
    const won = row.place === 1;
    this.finishEffect.replaceChildren();
    this.finishEffect.classList.toggle('victory', won);
    const title = document.createElement('strong');
    title.textContent = won ? '🏆 YOU WIN!' : `FINISHED ${row.place}${row.place === 2 ? 'ND' : row.place === 3 ? 'RD' : 'TH'}`;
    const detail = document.createElement('span');
    detail.textContent = won ? 'FIRST ACROSS THE LINE' : 'RACE COMPLETE · RESULTS COMING UP';
    this.finishEffect.append(title, detail);
    if (won) for (let i = 0; i < 24; i++) {
      const confetti = document.createElement('i');
      confetti.style.setProperty('--x', `${(i * 37) % 100}%`);
      confetti.style.setProperty('--delay', `${(i % 8) * 0.12}s`);
      confetti.style.setProperty('--spin', `${i * 47}deg`);
      this.finishEffect.append(confetti);
    }
    this.finishEffect.hidden = false;
  }
  close() {
    this.manualClose = true;
    this.socket?.close(); this.socket = null;
    this.room = null; this.roomCode = null; this.started = false; this.retryUntil = 0;
    this.root.hidden = true; this.raceExit.hidden = true;
    this.finishEffect.hidden = true;
    if (new URLSearchParams(location.search).has('room')) {
      const url = new URL(location.href); url.searchParams.delete('room');
      history.replaceState(null, '', url);
    }
    this.root.querySelector('.online-connect').hidden = false;
    this.root.querySelector('.online-lobby').hidden = true;
    this.handlers.onLeave?.();
  }
}
