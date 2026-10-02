// Title screen, character select (with difficulty / laps options + controls help), pause menu, gamepad navigation.
import { bus } from './events.js';
import { CHARACTERS, VEHICLES, GAME_TITLE } from './config.js';
import { gsap } from 'gsap';
import { ACHIEVEMENTS } from './profile.js';
import { careerState } from './career.js';
import { TRACKS } from './track-data.js';
import { SelectionStage } from './selection-stage.js';
import { garageLevel, garageXp, vehicleUnlocked, VEHICLE_LEVELS } from './garage.js';

const hex = (c) => '#' + (c >>> 0).toString(16).padStart(6, '0').slice(-6);
const DIFFS = ['easy', 'normal', 'hard'];
const DIFF_LABEL = { easy: 'NOVA · EASY', normal: 'RIFT · NORMAL', hard: 'APEX · HARD' };
const LAPS = [1, 3, 5];
const MODES = ['race', 'time-trial', 'grand-prix', 'elimination', 'checkpoint-rush'];
const STAT_KEYS = [['speed', 'SPEED', 'SPD'], ['accel', 'ACCEL', 'ACC'], ['handling', 'HANDLING', 'HDL'], ['weight', 'WEIGHT', 'WGT']];

function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}
const statBar = (v) => `<div class="bar">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= v ? 'on' : ''}"></i>`).join('')}</div>`;

const CONTROLS_HTML = `
  <div class="ctl"><span class="kc">↑</span><span class="kc">W</span> Accelerate</div>
  <div class="ctl"><span class="kc">↓</span><span class="kc">S</span> Brake / Reverse</div>
  <div class="ctl"><span class="kc">←→</span><span class="kc">A D</span> Steer</div>
  <div class="ctl"><span class="kc wide">SPACE</span> Hop / Drift</div>
  <div class="ctl"><span class="kc">E</span><span class="kc">X</span><span class="kc wide">L-SHIFT</span> Use ability</div>
  <div class="ctl"><span class="kc">C</span> Look back</div>
  <div class="ctl"><span class="kc wide">ESC</span><span class="kc">P</span> Pause</div>
  <div class="ctl"><span class="kc">R</span> Quick restart</div>
  <div class="ctl"><span class="kc">G</span> Toggle ghost (Time Trial)</div>
  <div class="ctl"><span class="kc">M</span> Mute</div>`;

export class Menu {
  constructor(uiRoot, handlers = {}) {
    this.uiRoot = uiRoot;
    this.h = handlers; // { onStart({characterIndex, difficulty, laps}), onResume, onRestart, onQuit }
    this.screen = null; // 'title' | 'select' | 'garage' | 'pause' | null
    this.portraitFn = null;
    this.stageProvider = null;
    this.stage = null;
    this.garageStage = null;
    this.charIndex = 0;
    this.diffIndex = 1;
    this.lapsIndex = 1;
    this.modeIndex = 0;
    this.vehicleIndex = 0;
    this.trackIndex = 0;
    this.zone = 'grid';
    this.optIndex = 0;
    this.pauseIndex = 0;
    this._loadingTimer = null;
    this._loadingTween = null;
    this._loadingIntroTimeline = null;
    this._loadingPhase = 0;
    this._titleTimeline = null;
    this._previewTimeline = null;
    this._backgroundTween = null;
    this._promptTimer = null;
    this._promptGradient = 0;
    this._promptDirection = 1;
    this._pad = { prev: {}, repeatT: 0, dir: null };
    this.gameState = 'title';
    this.userSettings = { volume: 80, graphics: 'high', steerSensitivity: 100, gamepadDeadzone: 18, steeringAssist: false, touchLayout: 'right', hudScale: 100, reducedMotion: false, safeFlashes: false, autoAccelerate: false, highContrast: false, colorblindMarkers: false, cameraShake: true, cameraView: 'chase' };
    this._settingsReturn = 'title';
    try {
      const s = JSON.parse(localStorage.getItem('nrr-settings') || '{}');
      if (s.charIndex >= 0 && s.charIndex < CHARACTERS.length) this.charIndex = s.charIndex;
      if (s.diffIndex >= 0 && s.diffIndex < DIFFS.length) this.diffIndex = s.diffIndex;
      if (s.lapsIndex >= 0 && s.lapsIndex < LAPS.length) this.lapsIndex = s.lapsIndex;
      if (s.modeIndex >= 0 && s.modeIndex < MODES.length) this.modeIndex = s.modeIndex;
      if (s.vehicleIndex >= 0 && s.vehicleIndex < VEHICLES.length) this.vehicleIndex = s.vehicleIndex;
      if (s.trackIndex >= 0 && s.trackIndex < TRACKS.length) this.trackIndex = s.trackIndex;
      const u = JSON.parse(localStorage.getItem('nrr-player-settings') || '{}');
      this.userSettings = { ...this.userSettings, ...u };
    } catch (e) { /* storage unavailable */ }

    this._buildTitle();
    this._buildSelect();
    this._buildGarage();
    this._buildPause();
    this._buildSettings();
    this._buildProfile();
    this._buildCareer();
    this._buildLoading();
    this._initAmbientBackgroundMotion();

    this._onKey = (e) => this._key(e);
    window.addEventListener('keydown', this._onKey);
  }

  setPortraitProvider(fn) {
    this.portraitFn = fn;
    this._portraits = new Map();
    this.cards.forEach((c, i) => {
      const url = this.portrait(CHARACTERS[i]);
      if (url) { c.img.src = url; c.img.style.display = ''; c.initial.style.display = 'none'; }
    });
    this._refreshPreview();
  }
  portrait(ch) {
    if (!ch || !this.portraitFn) return '';
    this._portraits = this._portraits || new Map();
    if (this._portraits.has(ch.id)) return this._portraits.get(ch.id);
    let url = '';
    try { url = this.portraitFn(ch) || ''; } catch (e) { url = ''; }
    this._portraits.set(ch.id, url);
    return url;
  }

  // ------------------------------------------------------------------ build
  _buildTitle() {
    const t = this.titleEl = el('div', 'screen title-screen', this.uiRoot);
    const words = GAME_TITLE.toUpperCase().split(' ');
    const first = words.shift();
    t.innerHTML = `
      <div class="title-vignette bg"></div>
      <div class="title-orbit orbit-a"></div><div class="title-orbit orbit-b"></div>
      <div class="title-kicker"><span></span> INTERDIMENSIONAL RACING LEAGUE <span></span></div>
      <div class="logo">
        <div class="logo-sigil">N/R</div>
        <div class="logo-line l1 flip-x-text" data-text="${first}">${first}</div>
        <div class="logo-line l2 flip-x-text" data-text="${words.join(' ')}">${words.join(' ')}</div>
        <div class="logo-swoosh"></div>
      </div>
      <div class="title-tagline">BREAK THE TRACK <i></i> RULE THE RIFT</div>
      <div class="press-start"><span class="start-pulse"></span><span class="start-label">INITIALIZE RACE</span></div>
      <div class="title-status"><span>SECTOR 07</span><span>RIFT LINK // STABLE</span><span>BUILD 0.1 ALPHA</span></div>
      <div class="title-foot">
        <span>© 2026 Neon Rift Racers · Break the track. Rule the rift.</span>
        <span class="kc">M</span> mute
      </div>
      <button class="title-online" type="button">PLAY WITH FRIENDS</button>
      <button class="title-career" type="button">CAREER</button>
      <button class="title-profile" type="button">PROFILE</button>
      <button class="title-settings" type="button">SETTINGS</button>`;
    t.querySelector('.title-settings').addEventListener('click', (e) => { e.stopPropagation(); this.showSettings('title'); });
    t.querySelector('.title-online').addEventListener('click', (e) => { e.stopPropagation(); this.h.onOnline?.(); });
    t.querySelector('.title-profile').addEventListener('click', (e) => { e.stopPropagation(); this.showProfile(this.h.getProfile?.()); });
    t.querySelector('.title-career').addEventListener('click', (e) => { e.stopPropagation(); this.showCareer(this.h.getProfile?.()); });
    t.addEventListener('click', () => { if (this.screen === 'title') this._toSelect(); });
  }

  _buildSelect() {
    const s = this.selectEl = el('div', 'screen select-screen', this.uiRoot);
    s.innerHTML = `
      <div class="sel-header"><div><div class="sel-eyebrow">RACER DATABASE // 08 ACTIVE</div><div class="sel-title">SELECT YOUR PILOT</div></div><div class="sel-back">ESC · BACK</div></div>
      <div class="sel-body">
        <div class="sel-grid"></div>
        <div class="sel-side">
          <div class="preview">
            <div class="pv-showcase"><div class="pv-portrait">
              <div class="pv-content"><img alt=""><span class="pv-initial"></span></div>
              <div class="portrait-curtain curtain-left"></div>
              <div class="portrait-curtain curtain-right"></div>
            </div></div>
            <div class="pv-info">
              <div class="pv-name"></div>
              <div class="pv-kart"><span class="swatch"></span><span class="pv-kart-lbl"></span></div>
              <div class="pv-stats"></div>
            </div>
            <div class="pv-stage" aria-label="Live 3D pilot and kart preview"><span class="pv-stage-label">LIVE GARAGE // 3D</span></div>
          </div>
          <button class="btn primary continue-btn" type="button">CONTINUE TO GARAGE ❯</button>
        </div>
      </div>`;
    const grid = s.querySelector('.sel-grid');
    this.cards = CHARACTERS.map((ch, i) => {
      const card = el('div', 'card', grid);
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Race as ${ch.name}`);
      card.style.setProperty('--kc', hex(ch.color));
      card.style.setProperty('--ka', hex(ch.accent));
      card.innerHTML = `
        <div class="card-portrait"><img alt="" style="display:none"><span class="initial">${ch.name[0]}</span></div>
        <div class="card-name">${ch.name}</div>
        <div class="card-stats">${STAT_KEYS.map(([k, , sh]) => `<div class="st"><span>${sh}</span>${statBar(ch.stats[k])}</div>`).join('')}</div>`;
      card.addEventListener('mouseenter', () => { if (this.screen === 'select') { this.zone = 'grid'; this._setChar(i); } });
      card.addEventListener('click', () => {
        if (this.screen !== 'select') return;
        this.zone = 'grid';
        this._setChar(i);
      });
      card.addEventListener('dblclick', () => {
        if (this.screen !== 'select') return;
        this.zone = 'grid';
        this._setChar(i, true);
        card.classList.remove('picked'); void card.offsetWidth; card.classList.add('picked');
        this.showGarage();
      });
      return { card, img: card.querySelector('img'), initial: card.querySelector('.initial') };
    });
    this.pv = {
      img: s.querySelector('.pv-portrait img'),
      initial: s.querySelector('.pv-initial'),
      portrait: s.querySelector('.pv-portrait'),
      name: s.querySelector('.pv-name'),
      swatch: s.querySelector('.swatch'),
      kartLbl: s.querySelector('.pv-kart-lbl'),
      stats: s.querySelector('.pv-stats'),
    };
    s.querySelector('.continue-btn').addEventListener('click', () => this.showGarage());
    s.querySelector('.sel-back').addEventListener('click', () => this._toTitle());
    this._refreshPreview();
  }

  _buildGarage() {
    const s = this.garageEl = el('div', 'screen garage-screen', this.uiRoot);
    s.innerHTML = `
      <div class="sel-header"><div><div class="sel-eyebrow">RIFT GARAGE // VEHICLE BAY</div><div class="sel-title">CHOOSE YOUR KART</div></div><div class="garage-header-right"><span class="garage-brand">NEON <em>RIFT</em><small>RACERS</small></span><button class="garage-back" type="button">← PILOTS</button></div></div>
      <div class="garage-body"><div class="garage-grid"></div><div class="garage-side">
        <div class="garage-detail"><div class="garage-stage" aria-label="Live 3D kart preview"></div><div class="garage-name"></div><div class="garage-role"></div><div class="garage-stats"></div><div class="garage-lock-note"></div></div>
        <div class="opts">
          <div class="opt" data-i="1"><span class="opt-lbl">CLASS</span><span class="opt-arrow l">◀</span><span class="opt-val"></span><span class="opt-arrow r">▶</span></div>
          <div class="opt" data-i="2"><span class="opt-lbl">LAPS</span><span class="opt-arrow l">◀</span><span class="opt-val"></span><span class="opt-arrow r">▶</span></div>
          <div class="opt" data-i="3"><span class="opt-lbl">MODE</span><span class="opt-arrow l">◀</span><span class="opt-val"></span><span class="opt-arrow r">▶</span></div>
          <div class="opt" data-i="4"><span class="opt-lbl">TRACK</span><span class="opt-arrow l">◀</span><span class="opt-val"></span><span class="opt-arrow r">▶</span></div>
          <button class="btn primary race-btn" data-i="5">RACE!</button>
        </div>
      </div></div><div class="garage-footer"><span>NEON RIFT RACERS</span><i></i><span>DRIVE&nbsp; // &nbsp;DRIFT&nbsp; // &nbsp;BELONG</span></div>`;
    const grid = s.querySelector('.garage-grid');
    this.vehicleCards = VEHICLES.map((vehicle, index) => {
      const card = el('button', 'garage-card', grid);
      card.type = 'button';
      card.style.setProperty('--vc', ['#00d9ff','#ffb94f','#5cffaa','#ca75ff','#ff6757','#74acff'][index]);
      card.innerHTML = `<span class="garage-card-top"><b>${vehicle.name}</b><small>${vehicle.role}</small></span><span class="garage-card-art"><img alt="${vehicle.name} kart" loading="eager"></span><span class="garage-card-state"></span>`;
      card.addEventListener('click', () => { this.vehicleIndex = index; this._refreshGarage(); });
      return card;
    });
    this.optEls = [...s.querySelectorAll('.opts [data-i]')];
    this.optEls.forEach((o, i) => {
      o.addEventListener('mouseenter', () => { if (this.screen === 'garage') { this.zone = 'opts'; this.optIndex = i + 1; this._refreshFocus(); } });
      if (i < 4) {
        o.querySelector('.l').addEventListener('click', (e) => { e.stopPropagation(); this.zone = 'opts'; this.optIndex = i + 1; this._changeOpt(-1); });
        o.querySelector('.r').addEventListener('click', (e) => { e.stopPropagation(); this.zone = 'opts'; this.optIndex = i + 1; this._changeOpt(1); });
        o.querySelector('.opt-val').addEventListener('click', () => { this.zone = 'opts'; this.optIndex = i + 1; this._changeOpt(1); });
      } else {
        o.addEventListener('click', () => this._start());
      }
    });
    s.querySelector('.garage-back').addEventListener('click', () => this.showSelect());
    this._refreshOpts();
  }

  _buildPause() {
    const p = this.pauseEl = el('div', 'screen pause-screen', this.uiRoot);
    p.innerHTML = `
      <div class="pause-panel">
        <button class="pause-close" type="button" aria-label="Close pause menu and resume">×</button>
        <div class="pause-title">PAUSED</div>
        <button class="btn" data-a="resume">RESUME</button>
        <button class="btn" data-a="restart">RESTART</button>
        <button class="btn" data-a="settings">SETTINGS</button>
        <button class="btn" data-a="quit">QUIT TO MENU</button>
        <div class="controls-help compact">${CONTROLS_HTML}</div>
      </div>`;
    this.pauseBtns = [...p.querySelectorAll('.btn')];
    p.querySelector('.pause-close').addEventListener('click', () => this._pauseAct('resume'));
    this.pauseBtns.forEach((b, i) => {
      b.addEventListener('mouseenter', () => { if (this.pauseIndex !== i) { this.pauseIndex = i; this._refreshPause(); bus.emit('ui:move'); } });
      b.addEventListener('click', () => this._pauseAct(b.dataset.a));
    });
  }

  _buildLoading() {
    this.loadingEl = el('div', 'screen loading-screen bg', this.uiRoot, `
      <div class="load-sector">RIFT TRANSIT // SECTOR 07</div>
      <div class="load-stage" aria-hidden="true">
        <div class="load-stars near"></div><div class="load-stars far"></div>
        <div class="load-gate g1"></div><div class="load-gate g2"></div><div class="load-gate g3"></div>
        <div class="load-rift r1"></div><div class="load-rift r2"></div>
        <div class="load-trail t1"></div><div class="load-trail t2"></div><div class="load-trail t3"></div>
        <div class="load-kart-layer layer">
          <div class="load-kart">
            <div class="load-driver"><i class="helmet"></i><i class="visor"></i><i class="body"></i></div>
            <div class="load-spoiler"></div><div class="load-shell"></div><div class="load-cockpit"></div>
            <i class="load-wheel wl"></i><i class="load-wheel wr"></i>
            <i class="load-thruster a"></i><i class="load-thruster b"></i>
          </div>
        </div>
        <div class="load-shadow"></div>
        <div class="load-road"><i></i><i></i><i></i><i></i></div>
        <div class="load-telemetry"><span>VELOCITY</span><b>287</b><em>KM/H</em></div>
      </div>
      <div class="loading-copy">
        <div class="loading-heading"><div class="loading-text">SYNCING RIFT</div><span class="loading-percent">0%</span></div>
        <div class="loading-progress" role="progressbar" aria-label="Loading race" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
        <div class="loading-hint">CALIBRATING VEHICLE · MAPPING ROUTE · LINKING PILOT</div>
      </div>`);
  }

  // ------------------------------------------------------------------ screens
  _initAmbientBackgroundMotion() {
    const backgrounds = this.uiRoot.querySelectorAll('.bg');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this._backgroundTween = gsap.to(backgrounds, {
      backgroundPosition: '100% 100%',
      duration: 4,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });
  }

  _buildSettings() {
    const s = this.settingsEl = el('div', 'screen settings-screen', this.uiRoot);
    s.innerHTML = `
      <div class="settings-panel">
        <button class="settings-close" type="button" aria-label="Close settings">×</button>
        <div class="settings-eyebrow">SYSTEM CONFIGURATION</div>
        <div class="settings-title">SETTINGS</div>
        <div class="settings-controls"><div class="settings-column">
        <label class="setting-row"><span><b>MASTER VOLUME</b><small>Music, engine and effects</small></span><input data-setting="volume" type="range" min="0" max="100" step="1"><output></output></label>
        <label class="setting-row"><span><b>STEERING RESPONSE</b><small>Keyboard, touch, wheel and tilt</small></span><input data-setting="steerSensitivity" type="range" min="60" max="140" step="5"><output></output></label>
        <label class="setting-row"><span><b>GAMEPAD DEAD ZONE</b><small>Ignore small stick drift</small></span><input data-setting="gamepadDeadzone" type="range" min="5" max="35" step="1"><output></output></label>
        <label class="setting-row toggle-row"><span><b>STEERING ASSIST</b><small>Gentle help near track edges</small></span><input data-setting="steeringAssist" type="checkbox"><i></i></label>
        <label class="setting-row"><span><b>TOUCH LAYOUT</b><small>Choose steering hand</small></span><select data-setting="touchLayout"><option value="right">RIGHT STEERING</option><option value="left">LEFT STEERING</option></select></label>
        <label class="setting-row toggle-row"><span><b>AUTO ACCELERATE</b><small>Touch devices accelerate unless braking</small></span><input data-setting="autoAccelerate" type="checkbox"><i></i></label>
        <label class="setting-row"><span><b>HUD SIZE</b><small>Lap, map, speed and position</small></span><input data-setting="hudScale" type="range" min="80" max="120" step="5"><output></output></label>
        </div><div class="settings-column">
        <label class="setting-row"><span><b>GRAPHICS QUALITY</b><small>Resolution, shadows and bloom</small></span><select data-setting="graphics"><option value="low">LOW</option><option value="medium">MEDIUM</option><option value="high">HIGH</option></select></label>
        <label class="setting-row"><span><b>DEFAULT CAMERA</b><small>Starting race viewpoint</small></span><select data-setting="cameraView"><option value="chase">CHASE</option><option value="hood">FRONT</option><option value="wide">WIDE</option></select></label>
        <label class="setting-row toggle-row"><span><b>CAMERA SHAKE</b><small>Impacts, boosts and landings</small></span><input data-setting="cameraShake" type="checkbox"><i></i></label>
        <label class="setting-row toggle-row"><span><b>REDUCED MOTION</b><small>Calmer HUD effects and camera</small></span><input data-setting="reducedMotion" type="checkbox"><i></i></label>
        <label class="setting-row toggle-row"><span><b>SAFE FLASHES</b><small>Dim impact and lightning flashes</small></span><input data-setting="safeFlashes" type="checkbox"><i></i></label>
        <label class="setting-row toggle-row"><span><b>HIGH CONTRAST</b><small>Clearer panel edges and labels</small></span><input data-setting="highContrast" type="checkbox"><i></i></label>
        <label class="setting-row toggle-row"><span><b>MAP POSITION MARKERS</b><small>Identify rivals by rank, not color</small></span><input data-setting="colorblindMarkers" type="checkbox"><i></i></label>
        </div></div>
        <div class="settings-footer"><div class="settings-note">TIP: TILT STEERING RECALIBRATES WHEN TILT IS ENABLED DURING A RACE.</div>
        <button class="settings-replay" type="button">▶ &nbsp; REPLAY ROOKIE TUTORIAL</button>
        <button class="btn settings-done" type="button">✓ &nbsp; SAVE & RETURN</button></div>
      </div>`;
    this.settingInputs = [...s.querySelectorAll('[data-setting]')];
    const update = (input) => {
      const key = input.dataset.setting;
      const value = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
      this.userSettings[key] = value;
      const out = input.parentElement.querySelector('output');
      if (out) out.textContent = input.type === 'range' ? `${value}%` : String(value).toUpperCase();
      try { localStorage.setItem('nrr-player-settings', JSON.stringify(this.userSettings)); } catch (e) { /* unavailable */ }
      this.h.onSettings && this.h.onSettings({ ...this.userSettings });
    };
    this.settingInputs.forEach((input) => {
      input.addEventListener('input', () => update(input));
      input.addEventListener('change', () => update(input));
    });
    const close = () => this.closeSettings();
    s.querySelector('.settings-close').addEventListener('click', close);
    s.querySelector('.settings-done').addEventListener('click', close);
    s.querySelector('.settings-replay').addEventListener('click', () => {
      try { localStorage.removeItem('nrr-tutorial-complete'); } catch (e) { /* unavailable */ }
      bus.emit('ui:confirm');
      s.querySelector('.settings-replay').textContent = 'TUTORIAL READY FOR NEXT RACE';
    });
    this._refreshSettings();
  }

  _refreshSettings() {
    if (!this.settingInputs) return;
    for (const input of this.settingInputs) {
      const value = this.userSettings[input.dataset.setting];
      if (input.type === 'checkbox') input.checked = !!value; else input.value = value;
      const out = input.parentElement.querySelector('output');
      if (out) out.textContent = input.type === 'range' ? `${value}%` : String(value).toUpperCase();
    }
  }

  _buildProfile() {
    const screen = this.profileEl = el('div', 'screen profile-screen', this.uiRoot);
    screen.innerHTML = `<div class="profile-panel profile-dashboard">
      <header class="profile-header"><button class="profile-back" type="button">❮ &nbsp; BACK</button><div><div class="settings-eyebrow">RACER DOSSIER</div><h2>YOUR <em>PROFILE</em></h2></div><span class="profile-header-tag">RACE &nbsp;▸&nbsp; IMPROVE &nbsp;▸&nbsp; BELONG</span></header>
      <section class="profile-identity"><div class="profile-identity-art" aria-hidden="true"><span>NRR</span></div><div class="profile-identity-main"><label class="profile-title-picker">EQUIPPED TITLE <select></select></label><div class="profile-level"></div><div class="profile-xp"><i></i></div><div class="profile-xp-label"></div></div><div class="profile-level-badge"><b></b><small>RACER LEVEL</small></div></section>
      <section class="profile-stat-section"><div class="profile-section-heading"><h3>▥ &nbsp; STATS OVERVIEW</h3><span>11 KEY STATS</span></div><div class="profile-stats"></div></section>
      <div class="profile-lower"><section class="profile-achievement-section"><div class="profile-section-heading"><h3>🏆 &nbsp; ACHIEVEMENTS</h3><span class="profile-achievement-count"></span></div><div class="profile-achievements"></div></section><section class="profile-history-section"><div class="profile-section-heading"><h3>⚑ &nbsp; RECENT EVENTS</h3></div><div class="profile-history"></div></section></div>
    </div>`;
    screen.querySelector('.profile-back').addEventListener('click', () => { bus.emit('ui:back'); this.showTitle(); });
    screen.querySelector('.profile-title-picker select').addEventListener('change', (event) => {
      this.h.onEquipTitle?.(event.target.value);
    });
  }

  _buildCareer() {
    const screen = this.careerEl = el('div', 'screen career-screen', this.uiRoot);
    screen.innerHTML = `<div class="profile-panel"><button class="profile-back" type="button">← BACK</button><div class="settings-eyebrow">NOVA HARBOR // CAREER</div><h2>CAREER MISSIONS</h2><p>Complete milestones to earn medals. Your current pilot and vehicle will be used.</p><div class="career-events"></div></div>`;
    screen.querySelector('.profile-back').addEventListener('click', () => { bus.emit('ui:back'); this.showTitle(); });
  }

  showCareer(profile) {
    if (!profile) return;
    this.screen = 'career';
    const list = this.careerEl.querySelector('.career-events');
    list.textContent = '';
    for (const event of careerState(profile)) {
      const card = el('div', `career-event${event.completed ? ' complete' : ''}${event.unlocked ? '' : ' locked'}`, list);
      const medal = el('span', `career-medal career-medal-${event.medal.toLowerCase()}`, card);
      medal.setAttribute('role', 'img');
      medal.setAttribute('aria-label', `${event.medal} medal`);
      const copy = el('div', 'career-copy', card);
      el('strong', '', copy).textContent = event.name;
      el('span', '', copy).textContent = event.goal;
      el('small', '', copy).textContent = event.completed ? `${event.medal} MEDAL EARNED` : event.unlocked ? `${event.medal} MEDAL` : 'LOCKED · COMPLETE EARLIER MISSIONS';
      const button = el('button', 'career-launch', card);
      button.type = 'button';
      button.disabled = !event.unlocked;
      button.textContent = event.completed ? 'REPLAY' : event.unlocked ? 'START' : 'LOCKED';
      if (event.unlocked) button.addEventListener('click', () => { bus.emit('ui:confirm'); this.h.onStart?.({ ...this.settings, mode: event.mode }); });
    }
    this._showOnly(this.careerEl);
  }

  showProfile(profile) {
    if (!profile) return;
    this.screen = 'profile';
    const titleSelect = this.profileEl.querySelector('.profile-title-picker select');
    titleSelect.textContent = '';
    for (const title of profile.titles) {
      const option = document.createElement('option');
      option.value = title;
      option.textContent = title;
      titleSelect.appendChild(option);
    }
    titleSelect.value = profile.selectedTitle;
    const level = garageLevel(profile);
    const xp = garageXp(profile);
    this.profileEl.querySelector('.profile-level').textContent = `★  LEVEL ${level}`;
    this.profileEl.querySelector('.profile-level-badge b').textContent = level;
    this.profileEl.querySelector('.profile-xp i').style.width = `${((xp % 250) / 250) * 100}%`;
    this.profileEl.querySelector('.profile-xp-label').textContent = `${xp % 250} / 250 XP TO NEXT LEVEL`;
    const stats = this.profileEl.querySelector('.profile-stats');
    stats.textContent = '';
    const fields = [
      ['RACES', profile.stats.races + profile.stats.onlineRaces], ['WINS', profile.stats.wins + profile.stats.onlineWins], ['PODIUMS', profile.stats.podiums + profile.stats.onlinePodiums],
      ['TRIAL RUNS', profile.stats.trialRuns], ['CUPS', profile.stats.cupEntries], ['CUP WINS', profile.stats.cupWins],
      ['SURVIVAL WINS', profile.stats.eliminationWins], ['RUSH CLEARS', profile.stats.checkpointClears],
      ['GOLD', profile.medals.gold], ['SILVER', profile.medals.silver], ['BRONZE', profile.medals.bronze],
    ];
    const statIcons = ['⚑', '★', '🏆', '◷', '♛', '◆', '✦', '⚡', '●', '●', '●'];
    for (const [index, [label, value]] of fields.entries()) {
      const tile = el('div', 'profile-stat', stats);
      el('i', 'profile-stat-icon', tile).textContent = statIcons[index];
      el('strong', '', tile).textContent = value;
      el('span', '', tile).textContent = label;
    }
    const achievements = this.profileEl.querySelector('.profile-achievements');
    achievements.textContent = '';
    for (const [id, definition] of Object.entries(ACHIEVEMENTS)) {
      const unlocked = profile.achievements.includes(id);
      const tile = el('div', `profile-achievement${unlocked ? ' unlocked' : ''}`, achievements);
      el('strong', '', tile).textContent = unlocked ? definition.name : 'LOCKED';
      el('span', '', tile).textContent = definition.description;
    }
    this.profileEl.querySelector('.profile-achievement-count').textContent = `${profile.achievements.length} / ${Object.keys(ACHIEVEMENTS).length} UNLOCKED`;
    const history = this.profileEl.querySelector('.profile-history');
    history.textContent = '';
    if (!profile.history.length) el('div', 'profile-empty', history).textContent = 'Finish an event to start your racing history.';
    for (const event of profile.history.slice(0, 3)) {
      const row = el('div', 'profile-event', history);
      el('i', 'profile-event-art', row).textContent = '⚑';
      const copy = el('div', 'profile-event-copy', row);
      el('strong', '', copy).textContent = String(event.track || event.type || 'EVENT');
      el('small', '', copy).textContent = `${String(event.type || 'EVENT')}${event.pilot ? ` · ${event.pilot}` : ''}`;
      el('b', 'profile-event-place', row).textContent = event.place ? `${event.place}${event.place === 1 ? 'ST' : event.place === 2 ? 'ND' : event.place === 3 ? 'RD' : 'TH'}` : '—';
      el('span', 'profile-event-time', row).textContent = Number.isFinite(event.time) ? `${event.time.toFixed(2)}s` : `${event.points || 0} pts`;
    }
    this._showOnly(this.profileEl);
  }

  _showOnly(elm) {
    if (elm !== this.selectEl && this.stage) { this.stage.dispose(); this.stage = null; }
    if (elm !== this.garageEl && this.garageStage) { this.garageStage.dispose(); this.garageStage = null; this._garageArtReady = false; }
    if (elm !== this.loadingEl) this._stopLoadingSequence();
    if (elm !== this.titleEl) this._stopTitleAnimation();
    if (elm !== this.titleEl) this._stopPromptAnimation();
    for (const s of [this.titleEl, this.selectEl, this.garageEl, this.pauseEl, this.settingsEl, this.profileEl, this.careerEl, this.loadingEl]) s.classList.toggle('active', s === elm);
  }
  showTitle() {
    this.screen = 'title';
    this._showOnly(this.titleEl);
    this._animateTitleText();
    this._startPromptAnimation();
  }

  _startPromptAnimation() {
    this._stopPromptAnimation();
    const label = this.titleEl.querySelector('.start-label');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this._promptGradient = 0;
    this._promptDirection = 1;
    this._promptTimer = window.setInterval(() => {
      this._promptGradient += this._promptDirection;
      if (this._promptGradient >= 100 || this._promptGradient <= 0) this._promptDirection *= -1;
      gsap.set(label, { backgroundPosition: `${this._promptGradient}% ${this._promptGradient}%` });
    }, 40);
  }

  _stopPromptAnimation() {
    if (this._promptTimer != null) window.clearInterval(this._promptTimer);
    this._promptTimer = null;
    const label = this.titleEl && this.titleEl.querySelector('.start-label');
    if (label) gsap.killTweensOf(label);
  }

  _animateTitleText() {
    this._stopTitleAnimation();
    const text = this.titleEl.querySelectorAll('.flip-x-text');
    const tagline = this.titleEl.querySelector('.title-tagline');
    gsap.killTweensOf(text);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(text, { clearProps: 'transform,opacity' });
      return;
    }
    this._titleTimeline = gsap.timeline({ repeat: -1, repeatDelay: 1.15 });
    this._titleTimeline.fromTo(text,
      { rotationX: 110, y: 24, opacity: 0, filter: 'blur(8px)', transformPerspective: 800, transformOrigin: '50% 50%' },
      { rotationX: 0, y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.6, stagger: 0.24, ease: 'power3.out' });
    this._titleTimeline.fromTo(tagline,
      { rotationX: 75, y: 10, opacity: 0, transformPerspective: 800 },
      { rotationX: 0, y: 0, opacity: 1, duration: .7, ease: 'power3.out' }, '-=.65');
  }

  _stopTitleAnimation() {
    if (!this._titleTimeline) return;
    this._titleTimeline.kill();
    this._titleTimeline = null;
    gsap.set(this.titleEl.querySelectorAll('.flip-x-text, .title-tagline'), { clearProps: 'transform,opacity,filter' });
  }
  showSelect() {
    this.screen = 'select'; this.zone = 'grid';
    this._showOnly(this.selectEl);
    if (!this.stage && this.stageProvider) {
      try { this.stage = new SelectionStage(this.selectEl.querySelector('.pv-stage'), this.stageProvider); }
      catch (error) { console.warn('[menu] 3D preview unavailable', error); }
    }
    this._setChar(this.charIndex, true);
    this._refreshOpts();
  }
  showGarage() {
    this.screen = 'garage'; this.zone = 'grid';
    // A saved choice may be locked on a different/new profile. Start on a drivable kart.
    if (!vehicleUnlocked(VEHICLES[this.vehicleIndex], this.h.getProfile?.())) this.vehicleIndex = 0;
    this._showOnly(this.garageEl);
    if (!this.garageStage && this.stageProvider) {
      try { this.garageStage = new SelectionStage(this.garageEl.querySelector('.garage-stage'), this.stageProvider); }
      catch (error) { console.warn('[menu] garage preview unavailable', error); }
    }
    if (this.garageStage && !this._garageArtReady) {
      for (let i = 0; i < VEHICLES.length; i++) {
        try { this.vehicleCards[i].querySelector('img').src = this.garageStage.captureKart(CHARACTERS[this.charIndex], VEHICLES[i]); }
        catch (error) { console.warn('[menu] kart card preview unavailable', error); break; }
      }
      this._garageArtReady = true;
    }
    this._refreshGarage();
    this._refreshOpts();
    this.h.onScreen?.('garage');
  }
  showPause() { this.screen = 'pause'; this.pauseIndex = 0; this._refreshPause(); this._showOnly(this.pauseEl); }
  showSettings(from = this.screen || 'title') { this._settingsReturn = from === 'pause' ? 'pause' : 'title'; this.screen = 'settings'; this._refreshSettings(); this._showOnly(this.settingsEl); }
  closeSettings() { bus.emit('ui:back'); if (this._settingsReturn === 'pause') this.showPause(); else this.showTitle(); }
  showLoading(text = 'SYNCING RIFT') {
    this.screen = 'loading';
    this._showOnly(this.loadingEl);
    this._stopLoadingSequence();
    this._animateLoadingKart(() => {
      this._startLoadingSequence(text);
      this._startLoadingProgress();
    });
  }

  _startLoadingProgress() {
    if (this._loadingTween) this._loadingTween.kill();
    const display = this.loadingEl.querySelector('.loading-percent');
    const progress = this.loadingEl.querySelector('.loading-progress');
    const bar = progress.querySelector('i');
    const counter = { val: 0 };
    display.textContent = '0%';
    bar.style.width = '0%';
    progress.setAttribute('aria-valuenow', '0');
    this._loadingTween = gsap.to(counter, {
      val: 100,
      duration: 2.5,
      ease: 'power2.inOut',
      onUpdate: () => {
        const value = Math.round(counter.val);
        display.textContent = `${value}%`;
        bar.style.width = `${counter.val}%`;
        progress.setAttribute('aria-valuenow', String(value));
      },
      onComplete: () => { this._loadingTween = null; },
    });
  }

  _animateLoadingKart(onArrive) {
    const layer = this.loadingEl.querySelector('.load-kart-layer');
    const copy = this.loadingEl.querySelector('.loading-copy');
    gsap.killTweensOf(layer);
    gsap.killTweensOf(copy);
    if (this._loadingIntroTimeline) this._loadingIntroTimeline.kill();
    gsap.set(copy, { opacity: 0, y: 14 });
    this._loadingIntroTimeline = gsap.timeline({
      onComplete: () => {
        this._loadingIntroTimeline = null;
        onArrive && onArrive();
      },
    });
    this._loadingIntroTimeline
      .fromTo(layer,
        { yPercent: 88, scale: .8, opacity: 0, filter: 'blur(10px)' },
        { yPercent: 0, scale: 1, opacity: 1, filter: 'blur(0px)', duration: 1.25, ease: 'power3.inOut', clearProps: 'transform,opacity,filter' }, 0)
      .to(copy, { opacity: 1, y: 0, duration: .38, ease: 'power2.out' }, 1.08);
  }
  hideAll() { this.screen = null; this._showOnly(null); }

  _startLoadingSequence(initialText) {
    this._stopLoadingSequence();
    const phases = [
      [initialText, 'CALIBRATING VEHICLE · SCANNING GRID'],
      ['LINKING PILOT', 'NEURAL LINK STABLE · CONTROLS ONLINE'],
      ['OPENING RIFT', 'ROUTE LOCKED · THRUSTERS ARMED'],
      ['READY TO LAUNCH', 'NOVA HARBOR · SECTOR 07'],
    ];
    const update = () => {
      const [title, hint] = phases[this._loadingPhase % phases.length];
      this.loadingEl.querySelector('.loading-text').textContent = title;
      this.loadingEl.querySelector('.loading-hint').textContent = hint;
      this.loadingEl.dataset.phase = String(this._loadingPhase % phases.length);
      this._loadingPhase++;
    };
    this._loadingPhase = 0;
    update();
    this._loadingTimer = window.setInterval(update, 1200);
  }

  _stopLoadingSequence() {
    if (this._loadingTimer != null) window.clearInterval(this._loadingTimer);
    this._loadingTimer = null;
    if (this._loadingTween) this._loadingTween.kill();
    this._loadingTween = null;
    if (this._loadingIntroTimeline) this._loadingIntroTimeline.kill();
    this._loadingIntroTimeline = null;
  }
  get settings() {
    return { characterIndex: this.charIndex, vehicleIndex: this.vehicleIndex, difficulty: DIFFS[this.diffIndex], laps: LAPS[this.lapsIndex], mode: MODES[this.modeIndex], trackId: TRACKS[this.trackIndex].id };
  }

  _toSelect() { bus.emit('ui:confirm'); this.showSelect(); this.h.onScreen && this.h.onScreen('select'); }
  _toTitle() { bus.emit('ui:back'); this.showTitle(); this.h.onScreen && this.h.onScreen('title'); }

  _setChar(i, silent) {
    i = (i + CHARACTERS.length) % CHARACTERS.length;
    if (i !== this.charIndex && !silent) bus.emit('ui:move');
    this.charIndex = i;
    this.cards.forEach((c, j) => c.card.classList.toggle('selected', j === i));
    this._refreshPreview();
    this._refreshFocus();
  }
  _confirmChar() {
    bus.emit('ui:confirm');
    const c = this.cards[this.charIndex].card;
    c.classList.remove('picked'); void c.offsetWidth; c.classList.add('picked');
    this.showGarage();
  }
  _refreshPreview() {
    if (!this.pv) return;
    const ch = CHARACTERS[this.charIndex];
    if (this.stage) this.stage.setPilot(ch);
    const url = this.portrait(ch);
    if (url) { this.pv.img.src = url; this.pv.img.style.display = ''; this.pv.initial.style.display = 'none'; }
    else { this.pv.img.style.display = 'none'; this.pv.initial.style.display = ''; this.pv.initial.textContent = ch.name[0]; }
    this.pv.portrait.style.setProperty('--kc', hex(ch.color));
    this.pv.name.textContent = ch.name.toUpperCase();
    this.pv.swatch.style.background = `linear-gradient(135deg, ${hex(ch.color)} 60%, ${hex(ch.accent)} 60%)`;
    const vehicle = VEHICLES[this.vehicleIndex];
    this.pv.kartLbl.textContent = `${vehicle.name.toUpperCase()} // ${vehicle.role}`;
    this.pv.stats.innerHTML = STAT_KEYS.map(([k, l]) => `<div class="st big"><span>${l}</span>${statBar(ch.stats[k])}</div>`).join('');
    this._animatePortraitReveal();
  }

  _animatePortraitReveal() {
    const portrait = this.pv.portrait;
    const left = portrait.querySelector('.curtain-left');
    const right = portrait.querySelector('.curtain-right');
    const content = portrait.querySelector('.pv-content');
    if (this._previewTimeline) this._previewTimeline.kill();
    gsap.set([left, right], { xPercent: 0, opacity: 1 });
    gsap.set(content, { scale: .5, opacity: 0 });
    this._previewTimeline = gsap.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: () => { this._previewTimeline = null; },
    });
    this._previewTimeline
      .to(left, { xPercent: -112, duration: 1, ease: 'power3.inOut' }, 0)
      .to(right, { xPercent: 112, duration: 1, ease: 'power3.inOut' }, 0)
      .to(content, { scale: 1, opacity: 1, duration: .75, ease: 'back.out(1.7)' }, .5);
  }
  _refreshOpts() {
    if (!this.optEls) return;
    this.optEls[0].querySelector('.opt-val').textContent = DIFF_LABEL[DIFFS[this.diffIndex]];
    this.optEls[1].querySelector('.opt-lbl').textContent = this.modeIndex === 3 ? 'GOAL' : this.modeIndex === 4 ? 'GATES' : 'LAPS';
    this.optEls[1].querySelector('.opt-val').textContent = this.modeIndex === 3 ? 'LAST SURVIVOR' : this.modeIndex === 4 ? `${LAPS[this.lapsIndex] * 4} GATES` : `${LAPS[this.lapsIndex]} LAP${LAPS[this.lapsIndex] > 1 ? 'S' : ''}`;
    this.optEls[1].classList.toggle('locked', this.modeIndex === 3);
    this.optEls[2].querySelector('.opt-val').textContent = ['QUICK RACE', 'TIME TRIAL', 'GRAND PRIX', 'ELIMINATION', 'CHECKPOINT RUSH'][this.modeIndex];
    this.optEls[3].querySelector('.opt-val').textContent = TRACKS[this.trackIndex].name.toUpperCase();
    this.optEls[4].textContent = ['RACE!', 'START TRIAL', 'START CUP', 'SURVIVE!', 'START RUSH'][this.modeIndex];
  }
  _refreshGarage() {
    const vehicle = VEHICLES[this.vehicleIndex];
    const profile = this.h.getProfile?.();
    const level = garageLevel(profile);
    const unlocked = vehicleUnlocked(vehicle, profile);
    this.vehicleCards.forEach((card, index) => {
      const candidate = VEHICLES[index];
      const unlocked = vehicleUnlocked(candidate, profile);
      card.classList.toggle('selected', index === this.vehicleIndex);
      card.classList.toggle('is-locked', !unlocked);
      card.querySelector('.garage-card-state').textContent = unlocked ? 'READY' : `UNLOCK AT LVL ${VEHICLE_LEVELS[candidate.id]}`;
      card.setAttribute('aria-label', `${candidate.name}, ${unlocked ? 'unlocked' : `unlocks at level ${VEHICLE_LEVELS[candidate.id]}`}`);
    });
    this.garageEl.querySelector('.garage-name').textContent = vehicle.name.toUpperCase();
    this.garageEl.querySelector('.garage-role').textContent = unlocked ? `${vehicle.role} // LEVEL ${level}` : `${vehicle.role} // UNLOCK AT LEVEL ${VEHICLE_LEVELS[vehicle.id]}`;
    this.garageEl.querySelector('.garage-stats').innerHTML = STAT_KEYS.map(([key, label]) => `<div class="st big"><span>${label}</span>${statBar(vehicle.stats[key])}</div>`).join('');
    this.garageEl.querySelector('.garage-lock-note').textContent = unlocked ? 'VEHICLE READY' : `LOCKED · REACH LEVEL ${VEHICLE_LEVELS[vehicle.id]} TO DRIVE`;
    this.garageEl.querySelector('.race-btn').disabled = !unlocked;
    this.garageStage?.setPilot(CHARACTERS[this.charIndex], vehicle);
    this._refreshFocus();
  }
  _refreshFocus() {
    this.cards.forEach((c, j) => c.card.classList.toggle('focus', this.screen === 'select' && this.zone === 'grid' && j === this.charIndex));
    this.vehicleCards?.forEach((c, j) => c.classList.toggle('focus', this.screen === 'garage' && this.zone === 'grid' && j === this.vehicleIndex));
    this.optEls?.forEach((o, j) => o.classList.toggle('focus', this.screen === 'garage' && this.zone === 'opts' && j + 1 === this.optIndex));
  }
  _changeOpt(d) {
    if (this.optIndex === 1) this.diffIndex = (this.diffIndex + d + DIFFS.length) % DIFFS.length;
    else if (this.optIndex === 2) { if (this.modeIndex === 3) return; this.lapsIndex = (this.lapsIndex + d + LAPS.length) % LAPS.length; }
    else if (this.optIndex === 3) this.modeIndex = (this.modeIndex + d + MODES.length) % MODES.length;
    else if (this.optIndex === 4) this.trackIndex = (this.trackIndex + d + TRACKS.length) % TRACKS.length;
    else return;
    bus.emit('ui:move');
    this._refreshOpts(); this._refreshFocus();
    const v = this.optEls[this.optIndex - 1].querySelector('.opt-val');
    v.classList.remove('bump'); void v.offsetWidth; v.classList.add('bump');
  }
  _start() {
    if (this.screen !== 'garage' || !vehicleUnlocked(VEHICLES[this.vehicleIndex], this.h.getProfile?.())) return;
    try { localStorage.setItem('nrr-settings', JSON.stringify({ charIndex: this.charIndex, vehicleIndex: this.vehicleIndex, diffIndex: this.diffIndex, lapsIndex: this.lapsIndex, modeIndex: this.modeIndex, trackIndex: this.trackIndex })); } catch (e) { /* ignore */ }
    bus.emit('ui:confirm');
    this.h.onStart && this.h.onStart(this.settings);
  }
  _gridCols() {
    try {
      const g = this.selectEl.querySelector('.sel-grid');
      const n = getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length;
      return n >= 1 && n <= 8 ? n : 4;
    } catch (e) { return 4; }
  }
  _refreshPause() { this.pauseBtns.forEach((b, i) => b.classList.toggle('focus', i === this.pauseIndex)); }
  _pauseAct(a) {
    if (this.screen !== 'pause') return;
    bus.emit('ui:confirm');
    if (a === 'resume') this.h.onResume && this.h.onResume();
    else if (a === 'restart') this.h.onRestart && this.h.onRestart();
    else if (a === 'settings') this.showSettings('pause');
    else if (a === 'quit') this.h.onQuit && this.h.onQuit();
  }

  // ------------------------------------------------------------------ input
  _key(e) {
    if (!this.uiRoot.querySelector('.online-screen')?.hidden) return;
    const c = e.code;
    const isEnter = c === 'Enter' || c === 'NumpadEnter' || c === 'Space';
    if (this.screen === 'title') {
      if ((isEnter || c === 'KeyE') && !e.repeat) { e.preventDefault(); this._toSelect(); }
      return;
    }
    if (this.screen === 'select') {
      const up = c === 'ArrowUp' || c === 'KeyW', down = c === 'ArrowDown' || c === 'KeyS';
      const left = c === 'ArrowLeft' || c === 'KeyA', right = c === 'ArrowRight' || c === 'KeyD';
      if (up || down || left || right || isEnter) e.preventDefault();
      if (c === 'Escape' || c === 'Backspace') { this._toTitle(); return; }
      {
        const cols = this._gridCols(), i = this.charIndex, col = i % cols, row = Math.floor(i / cols), rows = Math.ceil(CHARACTERS.length / cols);
        if (left) this._setChar(col === 0 ? i + cols - 1 : i - 1);
        else if (right) this._setChar(col === cols - 1 ? i - cols + 1 : i + 1);
        else if (up) this._setChar(((row - 1 + rows) % rows) * cols + col);
        else if (down) this._setChar(((row + 1) % rows) * cols + col);
        else if (isEnter && !e.repeat) this._confirmChar();
      }
      return;
    }
    if (this.screen === 'garage') {
      const up = c === 'ArrowUp' || c === 'KeyW', down = c === 'ArrowDown' || c === 'KeyS';
      const left = c === 'ArrowLeft' || c === 'KeyA', right = c === 'ArrowRight' || c === 'KeyD';
      if (up || down || left || right || isEnter) e.preventDefault();
      if (c === 'Escape' || c === 'Backspace') { this.showSelect(); return; }
      if (this.zone === 'grid') {
        if (left) this.vehicleIndex = (this.vehicleIndex + VEHICLES.length - 1) % VEHICLES.length;
        else if (right) this.vehicleIndex = (this.vehicleIndex + 1) % VEHICLES.length;
        else if (up) this.vehicleIndex = (this.vehicleIndex + VEHICLES.length - 3) % VEHICLES.length;
        else if (down) this.vehicleIndex = (this.vehicleIndex + 3) % VEHICLES.length;
        else if (isEnter && !e.repeat) { this.zone = 'opts'; this.optIndex = 1; this._refreshFocus(); return; }
        this._refreshGarage();
      } else {
        if (up) {
          if (this.optIndex === 1) { this.zone = 'grid'; } else this.optIndex--;
          bus.emit('ui:move'); this._refreshFocus();
        } else if (down) { this.optIndex = Math.min(5, this.optIndex + 1); bus.emit('ui:move'); this._refreshFocus(); }
        else if (left) {
          if (this.optIndex === 5) { this.zone = 'grid'; bus.emit('ui:move'); this._refreshFocus(); } else this._changeOpt(-1);
        } else if (right) { if (this.optIndex < 5) this._changeOpt(1); }
        else if (isEnter && !e.repeat) { if (this.optIndex === 5) this._start(); else this._changeOpt(1); }
      }
      return;
    }
    if (this.screen === 'pause') {
      if (c === 'ArrowUp' || c === 'KeyW') { this.pauseIndex = (this.pauseIndex + this.pauseBtns.length - 1) % this.pauseBtns.length; this._refreshPause(); bus.emit('ui:move'); e.preventDefault(); }
      else if (c === 'ArrowDown' || c === 'KeyS') { this.pauseIndex = (this.pauseIndex + 1) % this.pauseBtns.length; this._refreshPause(); bus.emit('ui:move'); e.preventDefault(); }
      else if (isEnter && !e.repeat) { e.preventDefault(); this._pauseAct(this.pauseBtns[this.pauseIndex].dataset.a); }
      return;
    }
    if (this.screen === 'profile' || this.screen === 'career') {
      if (c === 'Escape' || c === 'Backspace') { e.preventDefault(); this.showTitle(); }
      return;
    }
    if (this.screen === 'settings' && (c === 'Escape' || c === 'Backspace')) { e.preventDefault(); this.closeSettings(); }
  }

  /** Poll gamepads; translate to synthetic key presses for menus (and Start -> Escape for pause). */
  update(dt, gameState) {
    this.gameState = gameState;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads || []) if (p && p.connected) { gp = p; break; }
    if (!gp) return;
    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const now = {
      up: b(12) || ay < -0.6, down: b(13) || ay > 0.6, left: b(14) || ax < -0.6, right: b(15) || ax > 0.6,
      a: b(0), b: b(1), start: b(9),
    };
    const prev = this._pad.prev;
    const inMenu = this.screen === 'title' || this.screen === 'select' || this.screen === 'garage' || this.screen === 'pause' || this.screen === 'settings' || this.screen === 'profile' || this.screen === 'career' || gameState === 'results';
    const fire = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true }));
    if (inMenu) {
      const dirs = [['up', 'ArrowUp'], ['down', 'ArrowDown'], ['left', 'ArrowLeft'], ['right', 'ArrowRight']];
      let held = null;
      for (const [k, code] of dirs) {
        if (now[k] && !prev[k]) { fire(code); this._pad.repeatT = 0.4; }
        if (now[k]) held = code;
      }
      if (held) { this._pad.repeatT -= dt; if (this._pad.repeatT <= 0) { fire(held); this._pad.repeatT = 0.14; } }
      if (now.a && !prev.a) fire('Enter');
      if (now.b && !prev.b) fire(this.screen === 'pause' ? 'Escape' : 'Backspace');
    }
    if (now.start && !prev.start) fire(this.screen === 'title' ? 'Enter' : 'Escape');
    if (gameState === 'intro' && now.a && !prev.a) fire('Enter');
    this._pad.prev = now;
  }

  dispose() {
    if (this.stage) { this.stage.dispose(); this.stage = null; }
    if (this.garageStage) { this.garageStage.dispose(); this.garageStage = null; }
    this._stopLoadingSequence();
    this._stopTitleAnimation();
    this._stopPromptAnimation();
    if (this._backgroundTween) this._backgroundTween.kill();
    window.removeEventListener('keydown', this._onKey);
    for (const s of [this.titleEl, this.selectEl, this.garageEl, this.pauseEl, this.settingsEl, this.profileEl, this.careerEl, this.loadingEl]) s.remove();
  }
}
