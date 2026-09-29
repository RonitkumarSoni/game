const PREFIX = 'nrr:best-lap:v1';
const RUN_PREFIX = 'nrr:best-trial:v1';

export function lapRecordKey(track, difficulty, vehicle) {
  return `${PREFIX}:${encodeURIComponent(track || 'track')}:${encodeURIComponent(difficulty || 'normal')}:${encodeURIComponent(vehicle || 'standard')}`;
}

export function trialRecordKey(track, difficulty, vehicle, laps) {
  return `${RUN_PREFIX}:${encodeURIComponent(track || 'track')}:${encodeURIComponent(difficulty || 'normal')}:${encodeURIComponent(vehicle || 'standard')}:${Math.max(1, laps | 0)}`;
}

export function readBestLap(key, storage) {
  try {
    storage ??= globalThis.localStorage;
    const value = Number(storage?.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function saveBestLap(key, lapTime, storage) {
  const previous = readBestLap(key, storage);
  if (!Number.isFinite(lapTime) || lapTime <= 0) return { previous, best: previous, improved: false };
  const improved = previous === null || lapTime < previous;
  if (improved) {
    try { (storage ?? globalThis.localStorage)?.setItem(key, String(lapTime)); } catch { /* private mode can deny storage */ }
  }
  return { previous, best: improved ? lapTime : previous, improved };
}
