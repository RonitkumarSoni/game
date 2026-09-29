// Neon Rift Racers — bootstrap, renderer, post-processing, game state machine and main loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { bus } from './events.js';
import { CHARACTERS, VEHICLES, RACE, PHYSICS } from './config.js';
import { RaceManager } from './race.js';
import { HUD } from './hud.js';
import { Menu } from './menu.js';
import { AudioEngine } from './audio.js';
import { TutorialCoach } from './tutorial.js';
import { RaceRandom } from './random.js';
import { RiftEventManager } from './rift-events.js';
import { lapRecordKey, trialRecordKey, readBestLap, saveBestLap } from './lap-records.js';
import { GhostRecorder, ghostKey, readGhost, saveGhost, ghostDelta } from './ghost.js';
import { GhostVisual } from './ghost-visual.js';
import { GrandPrix, GRAND_PRIX_ROUNDS } from './grand-prix.js';
import { loadProfile, saveProfile, recordRace, recordTrial, recordCup, recordArcade, equipTitle } from './profile.js';
import { ArcadeMode } from './arcade-modes.js';

// ---------------------------------------------------------------------------------------------
// Error isolation: one failing subsystem must never freeze the loop. Log once per error type.
// ---------------------------------------------------------------------------------------------
const seenErrors = new Set();
function report(tag, err) {
  const key = tag + '|' + (err && err.message);
  if (seenErrors.has(key)) return;
  seenErrors.add(key);
  console.error(`[${tag}]`, err);
}
function safe(tag, fn) {
  try { return fn(); } catch (err) { report(tag, err); return undefined; }
}

// ---------------------------------------------------------------------------------------------
// Renderer / camera / post
// ---------------------------------------------------------------------------------------------
const canvas = document.getElementById('game-canvas');
const uiRoot = document.getElementById('ui-root');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.position.set(0, 30, 60);

const fallbackScene = new THREE.Scene();
fallbackScene.background = new THREE.Color(0x2a6fdb);

const composer = new EffectComposer(renderer);
composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
composer.setSize(window.innerWidth, window.innerHeight);
const renderPass = new RenderPass(fallbackScene, camera);
composer.addPass(renderPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.32, 0.45, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());

let selectedPixelCap = 2;
let adaptivePixelCap = 2;
function applyPixelRatio() {
  const ratio = Math.min(window.devicePixelRatio || 1, selectedPixelCap, adaptivePixelCap);
  renderer.setPixelRatio(ratio);
  composer.setPixelRatio(ratio);
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
}
window.addEventListener('resize', onResize);

// ---------------------------------------------------------------------------------------------
// Modules from other agents are loaded dynamically so a broken file degrades instead of killing the game.
// ---------------------------------------------------------------------------------------------
const mods = {};
async function loadModules() {
  // Literal import paths let Vite emit these modules as production chunks.
  const loaders = {
    track: () => import('./track.js'), kart: () => import('./kart.js'),
    ai: () => import('./ai.js'), input: () => import('./input.js'),
    items: () => import('./items.js'), effects: () => import('./effects.js'),
    models: () => import('./models.js'), camera: () => import('./camera.js'),
  };
  await Promise.all(Object.entries(loaders).map(async ([name, load]) => {
    try { mods[name] = await load(); } catch (error) { console.error(`[main] failed to load ${name}`, error); }
  }));
}

// ---- fallbacks -------------------------------------------------------------------------------
function fallbackKartModel(character) {
  const root = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: character ? character.color : 0xff0000 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.4), mat);
  body.position.y = 0.5; body.castShadow = true; root.add(body);
  const anchors = {};
  for (const [n, x, y, z] of [['exhaustL', 0.4, 0.5, -1.3], ['exhaustR', -0.4, 0.5, -1.3], ['wheelRL', 0.8, 0.3, -0.8], ['wheelRR', -0.8, 0.3, -0.8],
    ['wheelFL', 0.8, 0.3, 0.8], ['wheelFR', -0.8, 0.3, 0.8], ['itemHold', 0, 0.6, -1.8]]) {
    const o = new THREE.Object3D(); o.position.set(x, y, z); root.add(o); anchors[n] = o;
  }
  return { root, anchors, animate() {}, setShrunk(s) { root.scale.setScalar(s); }, dispose() { body.geometry.dispose(); mat.dispose(); } };
}
function makeKartModel(character) {
  if (mods.models && mods.models.createKartModel) {
    try { return mods.models.createKartModel(character); } catch (e) { report('models.createKartModel', e); }
  }
  return fallbackKartModel(character);
}

class FallbackAI {
  constructor(kart, track, random = Math.random) { this.kart = kart; this.track = track; this.random = random; }
  update() {
    const k = this.kart, tr = this.track;
    const p = tr.getPointAt(((k.trackT || 0) + 25 / (tr.length || 2000)) % 1);
    const dx = p.x - k.position.x, dz = p.z - k.position.z;
    const want = Math.atan2(dx, dz);
    let d = want - k.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
    k.input = { throttle: 1, brake: 0, steer: THREE.MathUtils.clamp(-d * 2, -1, 1), drift: false, item: !!k.item && this.random() < 0.01, lookBack: false };
  }
}

class FallbackCamera {
  constructor(cam) { this.cam = cam; this.pos = new THREE.Vector3(); this.look = new THREE.Vector3(); }
  snap(k) { this._target(k, this.pos, this.look); this.cam.position.copy(this.pos); this.cam.lookAt(this.look); }
  _target(k, pos, look) {
    const h = k.heading || 0;
    pos.set(k.position.x - Math.sin(h) * 9, k.position.y + 4, k.position.z - Math.cos(h) * 9);
    look.set(k.position.x + Math.sin(h) * 4, k.position.y + 1.2, k.position.z + Math.cos(h) * 4);
  }
  update(dt, k) {
    const p = new THREE.Vector3(), l = new THREE.Vector3();
    this._target(k, p, l);
    const a = 1 - Math.exp(-dt * 6);
    this.pos.lerp(p, a); this.look.lerp(l, a);
    this.cam.position.copy(this.pos); this.cam.lookAt(this.look);
  }
}

// ---------------------------------------------------------------------------------------------
// UI + audio
// ---------------------------------------------------------------------------------------------
const audio = new AudioEngine();
const hud = new HUD(uiRoot);
const tutorial = new TutorialCoach(uiRoot);
const profileLoad = loadProfile();
let profile = profileLoad.profile;
const menu = new Menu(uiRoot, {
  onStart: (settings) => startRace(settings),
  onResume: () => resume(),
  onRestart: () => { menu.hideAll(); startRace(lastSettings, { continuation: true, retry: true }); },
  onQuit: () => goToTitle(),
  onSettings: (settings) => applySettings(settings),
  getProfile: () => profile,
  onEquipTitle: (title) => { profile = equipTitle(profile, title); saveProfile(profile); },
  onScreen: (s) => { setState(s === 'select' ? 'select' : 'title'); },
});
let input = null;

function applySettings(settings = menu.userSettings) {
  const quality = settings.graphics || 'high';
  const pixelCap = quality === 'low' ? 1 : quality === 'medium' ? 1.5 : 2;
  selectedPixelCap = pixelCap;
  adaptivePixelCap = pixelCap;
  applyPixelRatio();
  renderer.shadowMap.enabled = quality !== 'low';
  bloom.strength = quality === 'low' ? 0.12 : quality === 'medium' ? 0.24 : 0.32;
  audio.setVolume((Number(settings.volume) || 0) / 100);
  input?.setSteeringSensitivity?.((Number(settings.steerSensitivity) || 100) / 100);
  input?.setGamepadDeadzone?.((Number(settings.gamepadDeadzone) || 18) / 100);
  input?.setTouchLayout?.(settings.touchLayout);
  input?.setAutoAccelerate?.(settings.autoAccelerate === true);
  const hudScale = Math.min(120, Math.max(80, Number(settings.hudScale) || 100));
  document.body.style.setProperty('--hud-scale', String(hudScale / 100));
  document.body.classList.toggle('reduced-motion', settings.reducedMotion === true);
  document.body.classList.toggle('safe-flashes', settings.safeFlashes === true);
  document.body.classList.toggle('high-contrast', settings.highContrast === true);
  hud.colorblindMarkers = settings.colorblindMarkers === true;
  if (world?.chase) {
    world.chase.shakeEnabled = settings.cameraShake !== false && settings.reducedMotion !== true;
    if (['chase', 'hood', 'wide'].includes(settings.cameraView)) world.chase.viewMode = settings.cameraView;
  }
}

// ---------------------------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------------------------
let state = 'boot';
let prevState = null;
let world = null;
let lastSettings = { characterIndex: 0, vehicleIndex: 0, difficulty: 'normal', laps: RACE.laps, mode: 'race', trackId: 'nova-harbor' };
let bestLapKey = null;
let personalBest = null;
let recordThisRace = false;
let bestTrialKey = null;
let bestTrialTime = null;
let trialRecordThisRun = false;
let trialGhostKey = null;
let championship = null;

function recordPlayerLap(lapTime) {
  if (!bestLapKey || !Number.isFinite(lapTime) || lapTime <= 0) return;
  const previous = personalBest;
  const improved = previous === null || lapTime < previous;
  if (improved) {
    saveBestLap(bestLapKey, lapTime);
    personalBest = lapTime;
    recordThisRace = true;
  }
  hud.showLapFeedback(lapTime, previous, improved);
}
let introTimer = 0;
let resultsShown = false;
let time = 0;
applySettings(menu.userSettings);
const clock = new THREE.Clock();
const NEUTRAL = Object.freeze({ throttle: 0, brake: 0, steer: 0, drift: false, item: false, lookBack: false });

function setState(s) {
  if (state === s) return;
  state = s;
  document.body.dataset.state = s;
  bus.emit('game:state', { state: s });
}

const RACE_STATES = new Set(['intro', 'countdown', 'racing', 'finished']);
const PLAYABLE_MODES = new Set(['race', 'time-trial', 'grand-prix', 'elimination', 'checkpoint-rush']);

// ---------------------------------------------------------------------------------------------
// World lifecycle
// ---------------------------------------------------------------------------------------------
function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = rng.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function buildWorld({ mode, characterIndex = 0, vehicleIndex = 0, difficulty = 'normal', laps = RACE.laps, seed = 'attract', trackId = 'nova-harbor' }) {
  if (!mods.track || !mods.track.createTrack) throw new Error('track.js unavailable');
  if (!mods.kart || !mods.kart.Kart) throw new Error('kart.js unavailable');
  const w = { mode, difficulty, laps, seed, rng: new RaceRandom(seed), karts: [], ais: [], playerAI: null, player: null, scene: new THREE.Scene() };
  w.track = mods.track.createTrack(w.scene, renderer, trackId);

  // roster: attract mode = every character in order (kart index == character index)
  let chars;
  const playable = PLAYABLE_MODES.has(mode);
  if (playable) {
    if (mode === 'grand-prix' && championship) chars = championship.racerIds.map((id) => CHARACTERS.find((c) => c.id === id));
    else {
      const others = shuffle(CHARACTERS.filter((_, i) => i !== characterIndex), w.rng.fork('roster'));
      chars = [CHARACTERS[characterIndex], ...others];
    }
  } else chars = CHARACTERS.slice();

  const { Kart } = mods.kart;
  const racerCount = mode === 'time-trial' || mode === 'checkpoint-rush' ? 1 : RACE.racers;
  for (let i = 0; i < racerCount; i++) {
    const character = chars[i % chars.length];
    const isPlayer = playable && i === 0;
    const vehicle = VEHICLES[isPlayer ? vehicleIndex % VEHICLES.length : i % VEHICLES.length];
    const model = makeKartModel(character);
    const kart = new Kart({ scene: w.scene, track: w.track, character, vehicle, isPlayer, index: i, model });
    w.karts.push(kart);
    if (isPlayer) w.player = kart;
  }

  // grid order: player mid-pack (slot 4 or 5), others shuffled
  const gridOrder = new Array(racerCount);
  const gridRng = w.rng.fork('grid');
  const rest = shuffle(w.karts.filter((k) => k !== w.player), gridRng);
  if (w.player) {
    const slot = mode === 'time-trial' || mode === 'checkpoint-rush' ? 0 : 4 + gridRng.int(2);
    gridOrder[slot] = w.player;
  }
  for (let i = 0; i < gridOrder.length; i++) if (!gridOrder[i]) gridOrder[i] = rest.shift();

  w.race = new RaceManager({ track: w.track, karts: w.karts, player: w.player, laps: ['elimination', 'checkpoint-rush'].includes(mode) ? 999 : laps, silent: !playable, random: () => w.rng.next() });
  w.race.placeOnGrid(gridOrder);
  if (mode === 'elimination' || mode === 'checkpoint-rush') w.arcade = new ArcadeMode({ mode, race: w.race, player: w.player, targetLaps: laps });

  const AIClass = (mods.ai && mods.ai.AIDriver) || null;
  for (const k of w.karts) {
    if (k === w.player) continue;
    let ai = null;
    const aiRng = w.rng.fork(`ai-${k.index}`);
    if (AIClass) ai = safe('ai.ctor', () => new AIClass(k, w.track, { difficulty: playable ? difficulty : 'hard', random: () => aiRng.next() }));
    w.ais.push(ai || new FallbackAI(k, w.track, () => aiRng.next()));
  }

  const itemRng = w.rng.fork('items');
  if ((mode === 'race' || mode === 'grand-prix') && mods.items && mods.items.ItemSystem) w.items = safe('items.ctor', () => new mods.items.ItemSystem({ scene: w.scene, track: w.track, karts: w.karts, random: () => itemRng.next() }));
  const eventRng = w.rng.fork('rift-events');
  w.riftEvents = new RiftEventManager({ scene: w.scene, track: w.track, karts: w.karts, random: () => eventRng.next(), enabled: mode === 'race' || mode === 'grand-prix' });
  if (mods.effects && mods.effects.Effects) w.effects = safe('effects.ctor', () => new mods.effects.Effects(w.scene, camera));
  w.chase = (mods.camera && mods.camera.ChaseCamera && safe('camera.ctor', () => new mods.camera.ChaseCamera(camera))) || new FallbackCamera(camera);
  w.chase.shakeEnabled = menu.userSettings.cameraShake !== false && menu.userSettings.reducedMotion !== true;
  if (['chase', 'hood', 'wide'].includes(menu.userSettings.cameraView)) w.chase.viewMode = menu.userSettings.cameraView;
  w.ctx = { karts: w.karts, player: w.player || w.karts[0], itemSystem: w.items || null, riftEvents: w.riftEvents || null, time: 0 };
  if (w.player) safe('camera.snap', () => w.chase.snap(w.player));

  renderPass.scene = w.scene;
  return w;
}

function disposeWorld() {
  const w = world;
  world = null;
  renderPass.scene = fallbackScene;
  if (!w) return;
  safe('dispose.items', () => w.items && w.items.dispose && w.items.dispose());
  safe('dispose.effects', () => w.effects && w.effects.dispose && w.effects.dispose());
  safe('dispose.riftEvents', () => w.riftEvents && w.riftEvents.dispose());
  for (const k of w.karts) safe('dispose.kart', () => k.dispose && k.dispose());
  safe('dispose.track', () => w.track && w.track.dispose && w.track.dispose());
  safe('dispose.race', () => w.race && w.race.dispose());
  safe('dispose.ai', () => { for (const a of [...w.ais, w.playerAI]) a && a.dispose && a.dispose(); });
  safe('dispose.chase', () => w.chase && w.chase.dispose && w.chase.dispose());
  safe('dispose.ghost', () => w.ghostVisual?.dispose());
  // sweep anything left in the scene graph
  safe('dispose.scene', () => {
    const seen = new Set();
    const dispTex = (m) => {
      for (const key in m) {
        const v = m[key];
        if (v && v.isTexture && !seen.has(v)) { seen.add(v); v.dispose(); }
      }
    };
    w.scene.traverse((o) => {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) if (!seen.has(m)) { seen.add(m); dispTex(m); m.dispose(); }
      if (o.isLight && o.shadow && o.shadow.map) o.shadow.map.dispose();
    });
    if (w.scene.background && w.scene.background.isTexture) w.scene.background.dispose();
    if (w.scene.environment && w.scene.environment.isTexture) w.scene.environment.dispose();
    w.scene.clear();
  });
  renderer.renderLists.dispose();
}

// ---------------------------------------------------------------------------------------------
// Flow
// ---------------------------------------------------------------------------------------------
function buildAttract() {
  disposeWorld();
  try {
    world = buildWorld({ mode: 'attract' });
    world.race.startImmediately();
    // stagger: let them drive for a few seconds instantly so the title shows a spread-out pack
    attractCam.targetIndex = 0; attractCam.switchT = 0;
    uiRoot.classList.remove('no-world');
  } catch (e) {
    report('attract', e);
    disposeWorld();
    uiRoot.classList.add('no-world');
  }
}

function goToTitle() {
  championship = null;
  tutorial.hide();
  hud.hide(); hud.hideResults();
  audio.setPaused(false);
  audio.setGameplayActive(false);
  resultsShown = false;
  menu.showLoading('LOADING');
  setTimeout(() => {
    buildAttract();
    menu.showTitle();
    setState('title');
    audio.playMusic('menu');
  }, 30);
}

function startRace(settings, { continuation = false, retry = false } = {}) {
  const requested = { ...settings };
  if (requested.seed === undefined || requested.seed === null) requested.seed = `${Date.now()}-${Math.floor(performance.now())}`;
  lastSettings = { ...lastSettings, ...requested };
  if (lastSettings.mode === 'grand-prix') {
    if (!championship || !continuation) {
      const playerId = CHARACTERS[lastSettings.characterIndex % CHARACTERS.length].id;
      championship = new GrandPrix({ racerIds: [playerId, ...CHARACTERS.filter((c) => c.id !== playerId).map((c) => c.id)], playerId, seed: requested.seed });
    } else if (retry && resultsShown) championship.retryLastRound();
    lastSettings.seed = championship.roundSeed;
  } else championship = null;
  hud.hide(); hud.hideResults();
  menu.showLoading('GET READY!');
  audio.setPaused(false);
  audio.stopMusic();
  setState('loading');
  setTimeout(() => {
    disposeWorld();
    try {
      world = buildWorld({ ...lastSettings, mode: PLAYABLE_MODES.has(lastSettings.mode) ? lastSettings.mode : 'race' });
    } catch (e) {
      report('buildWorld', e);
      menu.showLoading('RACE FAILED TO LOAD — SEE CONSOLE');
      setTimeout(goToTitle, 2500);
      return;
    }
    resultsShown = false;
    introTimer = 0;
    seenErrors.clear();
    hud.reset({ player: world.player, track: world.track, laps: lastSettings.laps, mode: world.mode, cupRound: championship?.roundIndex });
    bestLapKey = lapRecordKey(world.mode === 'time-trial' ? `${world.track.name}:trial` : world.track.name, lastSettings.difficulty, world.player.vehicle.id);
    personalBest = readBestLap(bestLapKey);
    recordThisRace = false;
    bestTrialKey = world.mode === 'time-trial' ? trialRecordKey(world.track.name, lastSettings.difficulty, world.player.vehicle.id, lastSettings.laps) : null;
    bestTrialTime = bestTrialKey ? readBestLap(bestTrialKey) : null;
    trialRecordThisRun = false;
    trialGhostKey = bestTrialKey ? ghostKey(bestTrialKey) : null;
    if (trialGhostKey) {
      world.ghostRecorder = new GhostRecorder();
      world.ghostRecording = readGhost(trialGhostKey);
      if (world.ghostRecording && (!Number.isFinite(bestTrialTime) || Math.abs(world.ghostRecording.duration - bestTrialTime) > 0.05)) world.ghostRecording = null;
      if (world.ghostRecording) world.ghostVisual = new GhostVisual(world.scene, world.ghostRecording);
    }
    hud.setTrialBest(bestTrialTime);
    hud.setGhostState(!!world.ghostVisual, true);
    hud.show();
    tutorial.start();
    menu.hideAll();
    audio.setGameplayActive(true);
    uiRoot.classList.remove('no-world');
    setState('intro');
    showIntroCard();
  }, 3900);
}

let introCard = null;
function showIntroCard() {
  if (!introCard) introCard = Object.assign(document.createElement('div'), { className: 'intro-card' });
  uiRoot.appendChild(introCard);
  const name = (world && world.track && world.track.name) || 'Grand Circuit';
  const d = { easy: 'NOVA', normal: 'RIFT', hard: 'APEX' }[lastSettings.difficulty] || '';
  const vehicle = world?.player?.vehicle?.name || 'Nova GT';
  const objective = world.mode === 'elimination' ? 'LAST RACER STANDING · 22s DROPS' : world.mode === 'checkpoint-rush' ? `${lastSettings.laps * 4} GATES · BEAT THE CLOCK` : `${lastSettings.laps} LAP${lastSettings.laps > 1 ? 'S' : ''}`;
  introCard.innerHTML = `<div class="ic-sub">${world.mode === 'time-trial' ? 'TIME TRIAL · ' : world.mode === 'grand-prix' ? `NOVA HARBOR CUP · ROUND ${championship.roundIndex + 1}/4 · ` : world.mode === 'elimination' ? 'ELIMINATION · ' : world.mode === 'checkpoint-rush' ? 'CHECKPOINT RUSH · ' : ''}${d} · ${vehicle.toUpperCase()} · ${objective}</div><div class="ic-name">${world.mode === 'grand-prix' ? GRAND_PRIX_ROUNDS[championship.roundIndex] : name}</div><div class="ic-skip">ENTER · SKIP</div>`;
  introCard.classList.remove('show'); void introCard.offsetWidth; introCard.classList.add('show');
}
function hideIntroCard() { if (introCard) introCard.classList.remove('show'); }

function beginCountdown() {
  if (state !== 'intro' || !world) return;
  hideIntroCard();
  world.race.startCountdown();
  setState('countdown');
  safe('camera.snap', () => world.chase.snap(world.player));
}

function pause() {
  if (!RACE_STATES.has(state) || resultsShown) return;
  prevState = state;
  setState('paused');
  menu.showPause();
  audio.setPaused(true);
}
function resume() {
  if (state !== 'paused') return;
  menu.hideAll();
  setState(prevState || 'racing');
  audio.setPaused(false);
  clock.getDelta();
}

bus.on('race:go', () => {
  if (state === 'countdown' || (state === 'paused' && prevState === 'countdown')) {
    if (state === 'paused') prevState = 'racing'; else setState('racing');
    audio.playMusic('race');
    if (world?.mode === 'time-trial') world.ghostRecorder?.capture(0, world.player, world.player.raceProgress, true);
  }
});
bus.on('race:lap', (d) => {
  if (world && d?.kart === world.player) recordPlayerLap(d.lapTime);
});
bus.on('race:finish', (d) => {
  if (!world || !d || !d.kart || !d.kart.isPlayer) return;
  recordPlayerLap(d.kart.lapTimes.at(-1));
  if (world.mode === 'time-trial') world.ghostRecorder?.capture(d.time, world.player, world.race.laps + 1, true);
  if (world.mode === 'time-trial' && bestTrialKey && Number.isFinite(d.time) && d.time > 0 && (bestTrialTime === null || d.time < bestTrialTime)) {
    saveBestLap(bestTrialKey, d.time);
    if (trialGhostKey) saveGhost(trialGhostKey, world.ghostRecorder?.finish(d.time));
    bestTrialTime = d.time;
    trialRecordThisRun = true;
    hud.setTrialBest(bestTrialTime);
    hud.toast('NEW TIME TRIAL RECORD!');
  }
  setState('finished');
  // hand the player's kart to an AI so it keeps cruising during the finish camera
  const AIClass = mods.ai && mods.ai.AIDriver;
  world.playerAI = (AIClass && safe('ai.player', () => new AIClass(world.player, world.track, { difficulty: 'easy' }))) || new FallbackAI(world.player, world.track);
});
bus.on('race:end', (d) => {
  if (!world || !PLAYABLE_MODES.has(world.mode)) return;
  resultsShown = true;
  const results = (d && d.results) || world.race.computeResults();
  if (world.mode === 'grand-prix' && !championship?.award(results)) { report('grand-prix.award', new Error('Invalid or duplicate round results')); return; }
  const playerResult = results.find((row) => row.isPlayer);
  let rewards = [];
  if (playerResult) {
    const update = world.mode === 'time-trial'
      ? recordTrial(profile, { time: playerResult.time, pilot: playerResult.character?.name, newBest: trialRecordThisRun })
      : world.arcade
        ? recordArcade(profile, { mode: world.mode, success: world.arcade.success, place: playerResult.place, time: playerResult.time, gates: world.arcade.gates, pilot: playerResult.character?.name })
        : recordRace(profile, { mode: world.mode, place: playerResult.place, time: playerResult.time, laps: world.race.laps, pilot: playerResult.character?.name, round: championship?.roundIndex ?? null });
    profile = update.profile;
    rewards.push(...update.rewards);
    if (world.mode === 'grand-prix' && championship?.complete) {
      const cupResult = championship.standings().find((row) => row.isPlayer);
      const cupUpdate = recordCup(profile, { seed: championship.seed, rank: cupResult?.rank, points: cupResult?.points });
      profile = cupUpdate.profile;
      rewards.push(...cupUpdate.rewards);
    }
    saveProfile(profile);
  }
  if (state === 'paused') resume();
  setTimeout(() => {
    if (!world || !resultsShown) return;
    audio.playMusic('menu');
    if (world.mode === 'grand-prix') {
      hud.showGrandPrix(results, championship, {
        rewards,
        playerTitle: profile.selectedTitle,
        onNext: () => startRace(lastSettings, { continuation: true }),
        onRetry: () => startRace(lastSettings, { continuation: true, retry: true }),
        onRestartCup: () => startRace({ ...lastSettings, seed: null }, { continuation: false }),
        onMenu: () => goToTitle(),
      });
      return;
    }
    hud.showResults(results, {
      laps: world.race.laps,
      personalBest,
      recordThisRace,
      mode: world.mode,
      bestTrialTime,
      trialRecordThisRun,
      arcade: world.arcade,
      rewards,
      playerTitle: profile.selectedTitle,
      onRestart: () => startRace(lastSettings, { continuation: true, retry: true }),
      onMenu: () => goToTitle(),
    });
  }, 200);
});

// ---------------------------------------------------------------------------------------------
// Keyboard (global)
// ---------------------------------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyG' && !e.repeat && state === 'racing' && world?.mode === 'time-trial') {
    e.preventDefault();
    if (world.ghostVisual) {
      world.ghostVisual.setEnabled(!world.ghostVisual.enabled);
      hud.setGhostState(true, world.ghostVisual.enabled);
      hud.toast(world.ghostVisual.enabled ? 'GHOST ON' : 'GHOST OFF');
    } else hud.toast('SET A BEST RUN TO UNLOCK GHOST');
    return;
  }
  if (e.code === 'KeyR' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey &&
      (RACE_STATES.has(state) || state === 'paused' || state === 'finished') && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
    e.preventDefault();
    startRace(lastSettings, { continuation: true, retry: true });
    return;
  }
  if (menu.screen === 'settings' && (e.code === 'Escape' || e.code === 'Backspace')) return;
  if (e.code === 'KeyM' && !e.repeat) {
    const muted = audio.toggleMute();
    hud.toast(muted ? 'SOUND OFF' : 'SOUND ON');
    return;
  }
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
    if (state === 'paused') { if (e.code === 'Escape' || e.code === 'KeyP') { bus.emit('ui:back'); resume(); } }
    else if (RACE_STATES.has(state)) pause();
    return;
  }
  if (state === 'intro' && (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') && !e.repeat) {
    beginCountdown();
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && state !== 'boot') e.preventDefault();
});
canvas.addEventListener('click', () => { if (state === 'intro') beginCountdown(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && (state === 'racing' || state === 'countdown')) pause(); });

// ---------------------------------------------------------------------------------------------
// Attract-mode camera (title / select): cinematic orbit around a kart, or around the track centre
// ---------------------------------------------------------------------------------------------
const attractCam = {
  targetIndex: 0, switchT: 0, angle: 0,
  pos: new THREE.Vector3(0, 40, 80), look: new THREE.Vector3(), init: false,
  _p: new THREE.Vector3(), _l: new THREE.Vector3(),
};
function updateAttractCamera(dt) {
  const w = world;
  const ac = attractCam;
  ac.angle += dt * (state === 'select' ? 0.28 : 0.16);
  let target = null;
  if (w && w.karts.length) {
    if (state === 'select') target = w.karts[menu.charIndex] || w.karts[0];
    else {
      ac.switchT -= dt;
      if (ac.switchT <= 0) {
        ac.switchT = 9;
        const st = w.race.standings;
        const pick = st[(Math.random() * Math.min(4, st.length)) | 0];
        ac.targetIndex = w.karts.indexOf(pick);
      }
      target = w.karts[ac.targetIndex] || w.karts[0];
    }
  }
  if (target) {
    const close = state === 'select';
    const r = close ? 7.5 : 14 + Math.sin(ac.angle * 0.7) * 3;
    const h = target.heading || 0;
    const a = h + (close ? Math.PI * 0.75 + Math.sin(ac.angle) * 0.5 : ac.angle);
    ac._p.set(target.position.x + Math.sin(a) * r, target.position.y + (close ? 2.6 : 5 + Math.sin(ac.angle * 0.5) * 2), target.position.z + Math.cos(a) * r);
    ac._l.set(target.position.x, target.position.y + (close ? 1.1 : 1.5), target.position.z);
    // lead by velocity so the exponential smoothing below has no steady-state lag behind a moving kart
    const v = target.velocity;
    if (v) { const lead = 1 / 2.5; ac._p.addScaledVector(v, lead); ac._l.addScaledVector(v, lead); }
  } else {
    let cx = 0, cz = 0, span = 200;
    const mm = w && w.track && w.track.minimap && w.track.minimap.bounds;
    if (mm) { cx = (mm.minX + mm.maxX) / 2; cz = (mm.minZ + mm.maxZ) / 2; span = Math.max(mm.maxX - mm.minX, mm.maxZ - mm.minZ); }
    ac._p.set(cx + Math.cos(ac.angle) * span * 0.6, span * 0.3, cz + Math.sin(ac.angle) * span * 0.6);
    ac._l.set(cx, 0, cz);
  }
  const k = ac.init ? 1 - Math.exp(-dt * 2.5) : 1;
  ac.init = true;
  ac.pos.lerp(ac._p, k); ac.look.lerp(ac._l, k);
  camera.position.copy(ac.pos);
  camera.lookAt(ac.look);
  if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
}

// ---------------------------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------------------------
let playerInput = null;
const debug = { autopilot: false };
// Gameplay always advances in equal slices. This keeps steering, acceleration, collision response
// and AI decisions consistent on 30 Hz phones, 60 Hz laptops and high-refresh gaming displays.
const SIM_STEP = 1 / 60;
const MAX_SIM_STEPS = 6;
let simAccumulator = 0;
const performanceGuard = {
  fps: 60, lowFor: 0, stableFor: 0, noticeCooldown: 0,
  update(frameDt, active) {
    if (!active || frameDt <= 0 || document.hidden) {
      this.lowFor = 0; this.stableFor = 0;
      return;
    }
    const sampleFps = 1 / Math.min(frameDt, 0.25);
    this.fps += (sampleFps - this.fps) * (1 - Math.exp(-frameDt * 2));
    this.noticeCooldown = Math.max(0, this.noticeCooldown - frameDt);
    if (this.fps < 44) { this.lowFor += frameDt; this.stableFor = 0; }
    else if (this.fps > 57) { this.stableFor += frameDt; this.lowFor = 0; }
    else { this.lowFor = Math.max(0, this.lowFor - frameDt); this.stableFor = Math.max(0, this.stableFor - frameDt); }

    if (this.lowFor > 3 && adaptivePixelCap > 1) {
      adaptivePixelCap = adaptivePixelCap > 1.5 ? 1.5 : 1;
      applyPixelRatio();
      bloom.strength = Math.min(bloom.strength, adaptivePixelCap === 1 ? 0.12 : 0.22);
      this.lowFor = 0; this.stableFor = 0;
      if (this.noticeCooldown <= 0) { hud.toast('PERFORMANCE MODE'); this.noticeCooldown = 8; }
    } else if (this.stableFor > 12 && adaptivePixelCap < selectedPixelCap) {
      adaptivePixelCap = Math.min(selectedPixelCap, adaptivePixelCap === 1 ? 1.5 : 2);
      applyPixelRatio();
      const quality = menu.userSettings.graphics || 'high';
      bloom.strength = quality === 'low' ? 0.12 : quality === 'medium' ? 0.24 : 0.32;
      this.lowFor = 0; this.stableFor = 0;
    }
  },
};
function simulate(w, dt) {
  time += dt;
  w.ctx.time = time;
  const racing = PLAYABLE_MODES.has(w.mode);
  const player = w.player;

  // player input (always drain the controller so edge-triggered presses don't queue up)
  if (racing && player) {
    let raw = null;
    if (input) raw = safe('input.getInput', () => input.getInput());
    if (input) safe('input.pause', () => input.consumePressed && input.consumePressed('pause'));
    if (input && input.consumePressed && input.consumePressed('cameraView')) {
      const view = w.chase?.cycleView?.();
      if (view) {
        input.setCameraView?.(view);
        hud.toast(`${view === 'hood' ? 'FRONT' : view.toUpperCase()} VIEW`);
      }
    }
    playerInput = raw || NEUTRAL;
    if (debug.autopilot && !w.playerAI && !player.controlsLocked) {
      const AIClass = mods.ai && mods.ai.AIDriver;
      const debugRng = w.rng.fork('player-autopilot');
      w.playerAI = (AIClass && safe('ai.player', () => new AIClass(player, w.track, { difficulty: 'hard', random: () => debugRng.next() }))) || new FallbackAI(player, w.track, () => debugRng.next());
    }
    if ((player.finished || debug.autopilot) && w.playerAI) {
      safe('ai.player', () => w.playerAI.update(dt, w.ctx));
    } else if (player.controlsLocked) {
      player.input = { ...NEUTRAL };
    } else {
      player.input = raw || { ...NEUTRAL };
      if (menu.userSettings.steeringAssist === true && player.speed > 8 && !player.airborne && !player.drifting) {
        const edge = (w.track.roadWidth || 24) * 0.5;
        const lateral = Number(player.lateral) || 0;
        const pressure = Math.min(1, Math.max(0, (Math.abs(lateral) - edge * 0.65) / (edge * 0.25)));
        // Track lateral and steering share the same sign; pull gently toward center.
        const correction = -Math.sign(lateral) * pressure * 0.28;
        if (Math.sign(player.input.steer) !== -Math.sign(correction)) {
          player.input.steer = THREE.MathUtils.clamp(player.input.steer + correction, -1, 1);
        }
      }
    }
  }

  for (let i = 0; i < w.ais.length; i++) {
    const ai = w.ais[i];
    if (ai.kart?.eliminated) continue;
    try { ai.update(dt, w.ctx); } catch (e) { report('ai.update', e); }
  }
  for (let i = 0; i < w.karts.length; i++) {
    if (w.karts[i].eliminated) continue;
    try { w.karts[i].update(dt); } catch (e) { report('kart.update', e); }
  }
  if (mods.kart && mods.kart.resolveKartCollisions) safe('resolveKartCollisions', () => mods.kart.resolveKartCollisions(w.karts.filter((kart) => !kart.eliminated)));
  if (w.items) safe('items.update', () => w.items.update(dt, time));
  safe('race.update', () => w.race.update(dt));
  if (w.arcade) for (const event of w.arcade.update(dt)) {
    if (event.type === 'warning') hud.toast(w.mode === 'elimination' ? 'LAST PLACE OUT IN 5!' : 'CLOCK CRITICAL!');
    else if (event.type === 'eliminated') hud.toast(`${event.kart.character?.name || 'RACER'} ELIMINATED`);
    else if (event.type === 'gate') hud.toast(`CHECKPOINT ${event.gates}/${event.target} · +18s`);
    else if (event.type === 'end') {
      setState('finished');
      hud.banner(event.success ? w.mode === 'elimination' ? 'LAST RACER STANDING!' : 'CHECKPOINTS CLEARED!' : w.mode === 'elimination' ? 'ELIMINATED!' : 'TIME UP!');
      bus.emit('race:end', { results: event.results });
    }
  }
  if (w.mode === 'time-trial') {
    if (w.race.phase === 'racing' && !w.player.finished) w.ghostRecorder?.capture(w.race.raceTime, w.player, w.player.raceProgress);
    if (state === 'racing' || state === 'finished') w.ghostVisual?.update(w.race.raceTime);
    else if (w.ghostVisual) w.ghostVisual.root.visible = false;
    if (w.ghostRecording && state === 'racing' && w.ghostVisual?.enabled) {
      hud.setGhostDelta(ghostDelta(w.ghostRecording, w.player.raceProgress, w.race.raceTime));
    }
  }
  safe('riftEvents.update', () => w.riftEvents?.update(dt, w.race.raceTime, w.race.phase));
  if (w.effects) safe('effects.update', () => w.effects.update(dt, w.karts));
  safe('track.update', () => w.track.update && w.track.update(dt, time));
  // keep the sun's shadow frustum centred on whatever the camera is following
  const focus = racing ? player : (w.karts[attractCam.targetIndex] || w.karts[0]);
  if (focus && w.track.setShadowFocus) safe('track.setShadowFocus', () => w.track.setShadowFocus(focus.position));

  if (racing && state === 'intro') {
    introTimer += dt;
    if (introTimer > 4.0) beginCountdown();
  }
}

function frame() {
  requestAnimationFrame(frame);
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 1 / 30);
  safe('menu.update', () => menu.update(rawDt, resultsShown ? 'results' : state));
  performanceGuard.update(Math.min(rawDt, 0.25), state === 'racing');

  const w = world;
  if (w) {
    const running = state !== 'paused' && state !== 'loading' && state !== 'boot';
    if (running) {
      // Cap accumulated time so returning from a suspended/background tab cannot create a
      // multi-second physics catch-up spiral. Any remainder is retained for the next frame.
      simAccumulator = Math.min(simAccumulator + Math.min(rawDt, 0.1), SIM_STEP * MAX_SIM_STEPS);
      let steps = 0;
      while (simAccumulator >= SIM_STEP && steps < MAX_SIM_STEPS) {
        simulate(w, SIM_STEP);
        simAccumulator -= SIM_STEP;
        steps++;
      }
    } else {
      // Pausing must freeze time completely rather than replaying the paused duration on resume.
      simAccumulator = 0;
    }

    if (PLAYABLE_MODES.has(w.mode) && w.player) {
      if (state !== 'paused') {
        const mode = state === 'intro' ? 'intro' : state === 'countdown' ? 'countdown' : state === 'finished' ? 'finish' : 'race';
        const lookBack = !!(state === 'racing' && playerInput && playerInput.lookBack);
        safe('camera.update', () => w.chase.update(dt, w.player, { lookBack, mode }));
      }
      safe('hud.update', () => hud.update(dt, { player: w.player, karts: w.karts, race: w.race, itemSystem: w.items, track: w.track, time }));
      if (w.arcade) hud.setArcadeStatus(w.arcade);
      safe('tutorial.update', () => tutorial.update(dt, { state, input: playerInput, player: w.player }));
    } else {
      updateAttractCamera(dt);
    }
    safe('audio.update', () => audio.update(dt, { player: w.player, karts: w.karts, camera }));
  } else {
    simAccumulator = 0;
    updateAttractCamera(dt);
    safe('audio.update', () => audio.update(dt, { camera }));
  }

  try { composer.render(dt); } catch (e) { report('render', e); }
}

// ---------------------------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------------------------
async function boot() {
  document.body.dataset.state = 'boot';
  menu.showLoading('LOADING');
  requestAnimationFrame(frame);
  await Promise.all([
    loadModules(),
    new Promise((resolve) => setTimeout(resolve, 3900)),
  ]);
  if (mods.input && mods.input.InputController) input = safe('input.ctor', () => new mods.input.InputController());
  applySettings(menu.userSettings);
  if (mods.models && mods.models.createCharacterPortrait) {
    const fn = (c) => mods.models.createCharacterPortrait(c);
    safe('portraits', () => menu.setPortraitProvider(fn));
    hud.setPortraitProvider(fn);
  }
  buildAttract();
  menu.showTitle();
  if (profileLoad.status === 'recovered') hud.toast('PROFILE RECOVERED · ORIGINAL BACKUP SAVED');
  setState('title');
  audio.playMusic('menu');
}
boot();

// ---------------------------------------------------------------------------------------------
// Debug / test hook
// ---------------------------------------------------------------------------------------------
window.__game = {
  get state() { return state; },
  get world() { return world; },
  get mods() { return mods; },
  audio, hud, menu, renderer, camera, bus,
  startRace: (s = {}) => startRace({ ...lastSettings, ...s }),
  goToTitle,
  skipIntro: () => beginCountdown(),
  errors: () => [...seenErrors],
  /** Put the player on its final lap just behind the line; drive on to finish. */
  toFinalLap() {
    const w = world; if (!w || !w.player) return;
    w.race.debugSetLap(w.player, w.race.laps);
    if (w.race.laps > 1) bus.emit('race:finalLap', {});
  },
  /** Instantly finish the player's race in the current place. */
  finishPlayer() {
    const w = world; if (!w || !w.player) return;
    w.race.debugSetLap(w.player, w.race.laps + 1);
    w.race._finish(w.player);
  },
  PHYSICS,
  debug,
};
