import { CAREER_EVENTS, claimCareer } from './career.js';

export const PROFILE_KEY = 'nrr-profile-v2';
export const LEGACY_PROFILE_KEY = 'nrr-profile-v1';
export const PROFILE_VERSION = 2;

export const ACHIEVEMENTS = {
  firstRace: { name: 'FIRST GRID', description: 'Finish your first race' },
  firstWin: { name: 'NOVA ACE', description: 'Win a race' },
  podium: { name: 'PODIUM HUNTER', description: 'Finish in the top three' },
  tenRaces: { name: 'ROAD VETERAN', description: 'Finish ten races' },
  firstTrial: { name: 'CLOCK CHASER', description: 'Complete a Time Trial' },
  trialRecord: { name: 'TIME BENDER', description: 'Set a new Time Trial best' },
  cupChampion: { name: 'RIFT CHAMPION', description: 'Win the Nova Harbor Cup' },
  lastStanding: { name: 'LAST STANDING', description: 'Survive an Elimination race' },
  gateRunner: { name: 'GATE RUNNER', description: 'Clear a Checkpoint Rush' },
};

const number = (value) => Number.isFinite(value) && value >= 0 ? value : 0;
const idList = (value) => Array.isArray(value) ? [...new Set(value.filter((id) => typeof id === 'string'))] : [];
const ALLOWED_TITLES = new Set(['ROOKIE RACER', ...Object.values(ACHIEVEMENTS).map((item) => item.name)]);

export function newProfile() {
  return {
    version: PROFILE_VERSION,
    stats: { races: 0, wins: 0, podiums: 0, onlineRaces: 0, onlineWins: 0, onlinePodiums: 0, onlineXp: 0, trialRuns: 0, cupEntries: 0, cupWins: 0, eliminationRuns: 0, eliminationWins: 0, checkpointRuns: 0, checkpointClears: 0, totalLaps: 0, totalRaceTime: 0, bestFinish: null },
    medals: { gold: 0, silver: 0, bronze: 0 },
    achievements: [], titles: ['ROOKIE RACER'], selectedTitle: 'ROOKIE RACER', careerMedals: {}, history: [], completedCupSeeds: [], completedOnlineRaces: [],
  };
}

export function migrateProfile(value) {
  const base = newProfile();
  if (!value || typeof value !== 'object' || (value.version !== 1 && value.version !== PROFILE_VERSION)) return base;
  for (const key of Object.keys(base.stats)) {
    if (key === 'bestFinish') {
      const place = value.stats?.bestFinish;
      base.stats[key] = Number.isInteger(place) && place >= 1 && place <= 8 ? place : null;
    } else base.stats[key] = number(value.stats?.[key]);
  }
  for (const key of Object.keys(base.medals)) base.medals[key] = number(value.medals?.[key]);
  base.achievements = idList(value.achievements).filter((id) => id in ACHIEVEMENTS);
  base.titles = idList(value.titles).filter((title) => ALLOWED_TITLES.has(title));
  if (!base.titles.includes('ROOKIE RACER')) base.titles.unshift('ROOKIE RACER');
  base.selectedTitle = base.titles.includes(value.selectedTitle) ? value.selectedTitle : 'ROOKIE RACER';
  for (const event of CAREER_EVENTS) if (value.careerMedals?.[event.id] === event.medal) base.careerMedals[event.id] = event.medal;
  base.history = Array.isArray(value.history) ? value.history.filter((row) => row && typeof row === 'object').slice(0, 20) : [];
  base.completedCupSeeds = idList(value.completedCupSeeds).slice(0, 20);
  base.completedOnlineRaces = idList(value.completedOnlineRaces).slice(0, 30);
  return base;
}

export function loadProfile(storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    const raw = target?.getItem(PROFILE_KEY) ?? target?.getItem(LEGACY_PROFILE_KEY);
    if (!raw) return { profile: newProfile(), status: 'new' };
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
    if (!parsed || ![1, PROFILE_VERSION].includes(parsed.version)) {
      try { target?.setItem(`${PROFILE_KEY}:corrupt:${Date.now()}`, raw); } catch { /* backup best effort */ }
      return { profile: newProfile(), status: 'recovered' };
    }
    const profile = migrateProfile(parsed);
    claimCareer(profile);
    return { profile, status: parsed.version === PROFILE_VERSION ? 'loaded' : 'migrated' };
  } catch { return { profile: newProfile(), status: 'unavailable' }; }
}

export function saveProfile(profile, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    if (!target) return false;
    target.setItem(PROFILE_KEY, JSON.stringify(migrateProfile(profile)));
    return true;
  } catch { return false; }
}

function unlock(profile, id, rewards) {
  if (profile.achievements.includes(id)) return;
  profile.achievements.push(id);
  rewards.push(ACHIEVEMENTS[id].name);
  const title = ACHIEVEMENTS[id].name;
  if (!profile.titles.includes(title)) profile.titles.push(title);
}

function addHistory(profile, row) { profile.history.unshift(row); profile.history.length = Math.min(profile.history.length, 20); }

export function recordRace(profile, { mode = 'race', place, time, laps, pilot, track, round = null } = {}) {
  const p = migrateProfile(profile), rewards = [];
  if (!Number.isInteger(place) || place < 1 || place > 8 || !Number.isFinite(time) || time <= 0) return { profile: p, rewards };
  p.stats.races++;
  p.stats.wins += place === 1 ? 1 : 0;
  p.stats.podiums += place <= 3 ? 1 : 0;
  p.stats.totalLaps += Math.max(0, laps | 0);
  p.stats.totalRaceTime += time;
  p.stats.bestFinish = p.stats.bestFinish === null ? place : Math.min(p.stats.bestFinish, place);
  addHistory(p, { type: mode === 'grand-prix' ? 'CUP ROUND' : 'QUICK RACE', pilot: String(pilot || ''), track: String(track || ''), place, time, round, at: Date.now() });
  unlock(p, 'firstRace', rewards);
  if (place === 1) unlock(p, 'firstWin', rewards);
  if (place <= 3) unlock(p, 'podium', rewards);
  if (p.stats.races >= 10) unlock(p, 'tenRaces', rewards);
  rewards.push(...claimCareer(p));
  return { profile: p, rewards };
}

// Private online results are separate from solo Career mission counters.
export function recordOnlineRace(profile, { place, time, xp, pilot, track, matchId } = {}) {
  const p = migrateProfile(profile);
  if (matchId && p.completedOnlineRaces.includes(matchId)) return { profile: p, rewards: [] };
  if (!Number.isInteger(place) || place < 1 || place > 4 || !Number.isFinite(time) || time <= 0 || !Number.isFinite(xp) || xp < 0 || xp > 175) return { profile: p, rewards: [] };
  p.stats.onlineRaces++;
  p.stats.onlineWins += place === 1 ? 1 : 0;
  p.stats.onlinePodiums += place <= 3 ? 1 : 0;
  p.stats.onlineXp += xp;
  if (matchId) p.completedOnlineRaces = [String(matchId), ...p.completedOnlineRaces].slice(0, 30);
  addHistory(p, { type: 'ONLINE RACE', pilot: String(pilot || ''), track: String(track || ''), place, time, at: Date.now() });
  return { profile: p, rewards: [`+${xp} XP · ONLINE RACE`] };
}

export function recordTrial(profile, { time, pilot, track, newBest = false } = {}) {
  const p = migrateProfile(profile), rewards = [];
  if (!Number.isFinite(time) || time <= 0) return { profile: p, rewards };
  p.stats.trialRuns++;
  addHistory(p, { type: 'TIME TRIAL', pilot: String(pilot || ''), track: String(track || ''), time, at: Date.now() });
  unlock(p, 'firstTrial', rewards);
  if (newBest) unlock(p, 'trialRecord', rewards);
  rewards.push(...claimCareer(p));
  return { profile: p, rewards };
}

export function recordCup(profile, { seed, rank, points } = {}) {
  const p = migrateProfile(profile), rewards = [];
  if (!seed || !Number.isInteger(rank) || rank < 1 || rank > 8 || p.completedCupSeeds.includes(String(seed))) return { profile: p, rewards };
  p.completedCupSeeds.unshift(String(seed));
  p.completedCupSeeds.length = Math.min(p.completedCupSeeds.length, 20);
  p.stats.cupEntries++;
  if (rank === 1) { p.stats.cupWins++; p.medals.gold++; unlock(p, 'cupChampion', rewards); }
  else if (rank === 2) p.medals.silver++;
  else if (rank === 3) p.medals.bronze++;
  addHistory(p, { type: 'NOVA HARBOR CUP', place: rank, points: number(points), at: Date.now() });
  if (rank <= 3) rewards.push(`${['GOLD', 'SILVER', 'BRONZE'][rank - 1]} CUP MEDAL`);
  rewards.push(...claimCareer(p));
  return { profile: p, rewards };
}

export function recordArcade(profile, { mode, success, place, time, gates = 0, pilot, track } = {}) {
  const p = migrateProfile(profile), rewards = [];
  if (!['elimination', 'checkpoint-rush'].includes(mode) || !Number.isFinite(time) || time <= 0) return { profile: p, rewards };
  if (mode === 'elimination') {
    p.stats.eliminationRuns++;
    if (success) { p.stats.eliminationWins++; unlock(p, 'lastStanding', rewards); }
  } else {
    p.stats.checkpointRuns++;
    if (success) { p.stats.checkpointClears++; unlock(p, 'gateRunner', rewards); }
  }
  addHistory(p, { type: mode === 'elimination' ? 'ELIMINATION' : 'CHECKPOINT RUSH', pilot: String(pilot || ''), track: String(track || ''), place, time, gates: number(gates), success: !!success, at: Date.now() });
  return { profile: p, rewards };
}

export function equipTitle(profile, title) {
  const p = migrateProfile(profile);
  if (p.titles.includes(title)) p.selectedTitle = title;
  return p;
}
