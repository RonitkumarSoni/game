const VERSION = 1;
const INTERVAL = 0.1;
const MAX_SAMPLES = 12000;

export function ghostKey(trialKey) { return `${trialKey}:ghost:v${VERSION}`; }

const round = (n, scale) => Math.round(n * scale) / scale;

export class GhostRecorder {
  constructor() { this.samples = []; }

  capture(time, kart, progress, force = false) {
    if (!kart || !Number.isFinite(time) || time < 0 || this.samples.length >= MAX_SAMPLES) return;
    const p = kart.position;
    if (![p?.x, p?.y, p?.z, kart.heading, progress].every(Number.isFinite)) return;
    const last = this.samples.at(-1);
    if (!force && last && time - last[0] < INTERVAL) return;
    const sample = [round(time, 100), round(p.x, 100), round(p.y, 100), round(p.z, 100), round(kart.heading, 1000), round(Math.max(progress, last?.[5] ?? progress), 10000)];
    if (last && sample[0] <= last[0]) this.samples[this.samples.length - 1] = sample;
    else this.samples.push(sample);
  }

  finish(duration) {
    if (!Number.isFinite(duration) || duration <= 0 || this.samples.length < 2) return null;
    return { version: VERSION, duration: round(duration, 100), samples: this.samples };
  }
}

export function validGhost(ghost) {
  if (ghost?.version !== VERSION || !Number.isFinite(ghost.duration) || ghost.duration <= 0 ||
      !Array.isArray(ghost.samples) || ghost.samples.length < 2 || ghost.samples.length > MAX_SAMPLES) return false;
  let lastTime = -1, lastProgress = -Infinity;
  for (const s of ghost.samples) {
    if (!Array.isArray(s) || s.length !== 6 || !s.every(Number.isFinite) || s[0] <= lastTime || s[5] < lastProgress) return false;
    lastTime = s[0];
    lastProgress = s[5];
  }
  return lastTime <= ghost.duration + 0.02;
}

export function readGhost(key, storage) {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(key);
    const ghost = raw ? JSON.parse(raw) : null;
    return validGhost(ghost) ? ghost : null;
  } catch { return null; }
}

export function saveGhost(key, ghost, storage) {
  if (!validGhost(ghost)) return false;
  try {
    const target = storage ?? globalThis.localStorage;
    if (!target) return false;
    target.setItem(key, JSON.stringify(ghost));
    return true;
  }
  catch { return false; }
}

function interpolate(a, b, ratio) {
  const angle = Math.atan2(Math.sin(b[4] - a[4]), Math.cos(b[4] - a[4]));
  return {
    x: a[1] + (b[1] - a[1]) * ratio,
    y: a[2] + (b[2] - a[2]) * ratio,
    z: a[3] + (b[3] - a[3]) * ratio,
    heading: a[4] + angle * ratio,
  };
}

export function sampleGhost(ghost, time) {
  const samples = ghost?.samples;
  if (!samples?.length || !Number.isFinite(time) || time < 0 || time > ghost.duration) return null;
  if (time <= samples[0][0]) return interpolate(samples[0], samples[0], 0);
  let lo = 0, hi = samples.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid][0] <= time) lo = mid; else hi = mid;
  }
  const a = samples[lo], b = samples[hi];
  return interpolate(a, b, Math.min(1, Math.max(0, (time - a[0]) / (b[0] - a[0]))));
}

export function ghostDelta(ghost, progress, raceTime) {
  const samples = ghost?.samples;
  if (!samples?.length || !Number.isFinite(progress) || !Number.isFinite(raceTime) ||
      progress < samples[0][5] || progress > samples.at(-1)[5]) return null;
  let lo = 0, hi = samples.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid][5] <= progress) lo = mid; else hi = mid;
  }
  const a = samples[lo], b = samples[hi];
  const ratio = b[5] === a[5] ? 0 : Math.min(1, Math.max(0, (progress - a[5]) / (b[5] - a[5])));
  return raceTime - (a[0] + (b[0] - a[0]) * ratio);
}
