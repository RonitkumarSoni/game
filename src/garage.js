// Garage progression is derived from the existing versioned race profile so old
// saves retain all earned progress without another migration or storage key.
export const VEHICLE_LEVELS = Object.freeze({
  nova: 1,
  volt: 2,
  phantom: 3,
  comet: 4,
  aegis: 5,
  vector: 6,
});

export function garageXp(profile) {
  const stats = profile?.stats || {};
  return Math.max(0,
    (stats.races || 0) * 75 +
    (stats.wins || 0) * 100 +
    (stats.trialRuns || 0) * 30 +
    (stats.cupWins || 0) * 150 +
    (stats.eliminationWins || 0) * 100 +
    (stats.checkpointClears || 0) * 80 +
    (stats.onlineXp || 0),
  );
}

export function garageLevel(profile) {
  return 1 + Math.floor(garageXp(profile) / 250);
}

export function vehicleUnlocked(vehicle, profile) {
  return garageLevel(profile) >= (VEHICLE_LEVELS[vehicle?.id] || Infinity);
}
