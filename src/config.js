// Shared tuning + roster. Every module reads from here; do not duplicate these values.

export const GAME_TITLE = 'Neon Rift Racers';

export const RACE = {
  laps: 3,
  racers: 8,
  countdownSeconds: 3,
};

// World scale: 1 unit = 1 meter. Y is up. Track lies roughly in the XZ plane.
export const PHYSICS = {
  gravity: 38,
  kartRadius: 1.3,          // collision radius (kart vs kart / wall / items)
  maxSpeed: 38,             // base top speed on road (units/s) before stat modifiers
  reverseMaxSpeed: 12,
  accel: 22,
  brakeDecel: 45,
  coastDecel: 8,
  offroadMaxSpeedFactor: 0.45,
  boostSpeedBonus: 16,      // added to max speed while boosting
  miniTurboTimes: [0.55, 0.45, 0.5], // blue, orange, purple boost durations (s)
  driftChargeThresholds: [0.9, 1.9, 3.0], // seconds of drifting needed to reach each level
  mushroomBoostTime: 1.3,
  starTime: 7.5,
  spinOutTime: 1.1,
  tumbleTime: 1.6,
  lightningShrinkTime: 5,
};

// stats are 1..5. speed -> top speed, accel -> acceleration, handling -> turn rate/drift,
// weight -> bump resolution (heavier pushes lighter).
export const CHARACTERS = [
  { id: 'kael',   name: 'Kael',   title: 'Rift Vanguard', archetype: 'Balanced', color: 0x00d9ff, accent: 0xffffff, skin: 0xc98f6b, hat: 'cap',      stats: { speed: 3, accel: 3, handling: 3, weight: 3 } },
  { id: 'echo',   name: 'Echo',   title: 'Velocity Savant', archetype: 'Acceleration', color: 0x39ff88, accent: 0x071c18, skin: 0xe8b58d, hat: 'cap', stats: { speed: 3, accel: 5, handling: 3, weight: 1 } },
  { id: 'nyra',   name: 'Nyra',   title: 'Quantum Tactician', archetype: 'Technical', color: 0xff3cac, accent: 0xffe7f6, skin: 0x8f5d45, hat: 'crown', stats: { speed: 2, accel: 4, handling: 5, weight: 2 } },
  { id: 'glitch', name: 'Glitch', title: 'System Wildcard', archetype: 'Experimental', color: 0x8b5cff, accent: 0x00f5ff, skin: 0xd6a57d, hat: 'mushroom', stats: { speed: 2, accel: 5, handling: 4, weight: 1 } },
  { id: 'brakk',  name: 'Brakk',  title: 'Iron Comet', archetype: 'Heavy', color: 0xff5a36, accent: 0xffc857, skin: 0x7f503d, hat: 'horns', stats: { speed: 5, accel: 1, handling: 2, weight: 5 } },
  { id: 'solara', name: 'Solara', title: 'Solar Apex', archetype: 'Speed', color: 0xffc400, accent: 0x351600, skin: 0xb97952, hat: 'cap', stats: { speed: 5, accel: 2, handling: 2, weight: 4 } },
  { id: 'rook',   name: 'Rook',   title: 'Aegis Runner', archetype: 'Defense', color: 0x2b7cff, accent: 0xbbe6ff, skin: 0x98b8aa, hat: 'shell', stats: { speed: 3, accel: 3, handling: 4, weight: 3 } },
  { id: 'vex',    name: 'Vex',    title: 'Drift Phantom', archetype: 'Drift', color: 0xc62cff, accent: 0xffd6ff, skin: 0xa76d53, hat: 'bow', stats: { speed: 3, accel: 4, handling: 5, weight: 1 } },
];

export const ITEMS = ['mushroom', 'triple_mushroom', 'banana', 'green_shell', 'red_shell', 'star', 'lightning', 'blue_shell'];

// Legacy simulation ids stay stable during migration; all player-facing copy uses the original NRR names.
export const ABILITY_LABELS = {
  mushroom: 'Pulse Boost',
  triple_mushroom: 'Tri-Pulse',
  banana: 'Arc Mine',
  green_shell: 'Shock Disc',
  red_shell: 'Rift Missile',
  star: 'Overdrive Core',
  lightning: 'EMP Storm',
  blue_shell: 'Hunter Drone',
};

export const DIFFICULTY = {
  easy:   { aiSpeedFactor: 0.86, aiSkill: 0.55, rubberBand: 0.08 },
  normal: { aiSpeedFactor: 0.94, aiSkill: 0.75, rubberBand: 0.12 },
  hard:   { aiSpeedFactor: 1.00, aiSkill: 0.95, rubberBand: 0.16 },
};

export const KEYS = {
  accelerate: ['ArrowUp', 'KeyW'],
  brake: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  drift: ['Space', 'ShiftRight'],
  item: ['KeyE', 'ShiftLeft', 'KeyX'],
  lookBack: ['KeyC'],
  pause: ['Escape', 'KeyP'],
};
