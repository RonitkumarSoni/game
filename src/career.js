export const CAREER_EVENTS = [
  { id: 'rookie-run', name: 'ROOKIE RUN', mode: 'race', medal: 'BRONZE', needs: [], goal: 'Finish one race', complete: (p) => p.stats.races >= 1 },
  { id: 'podium-chase', name: 'PODIUM CHASE', mode: 'race', medal: 'SILVER', needs: ['rookie-run'], goal: 'Reach a race podium', complete: (p) => p.stats.podiums >= 1 },
  { id: 'clockwork', name: 'CLOCKWORK', mode: 'time-trial', medal: 'SILVER', needs: ['rookie-run'], goal: 'Finish a Time Trial', complete: (p) => p.stats.trialRuns >= 1 },
  { id: 'cup-crown', name: 'CUP CROWN', mode: 'grand-prix', medal: 'GOLD', needs: ['podium-chase', 'clockwork'], goal: 'Win the Nova Harbor Cup', complete: (p) => p.stats.cupWins >= 1 },
];

export function careerState(profile) {
  const earned = profile.careerMedals || {};
  return CAREER_EVENTS.map((event) => ({
    ...event,
    unlocked: event.needs.every((id) => !!earned[id]),
    completed: !!earned[event.id],
  }));
}

export function claimCareer(profile) {
  profile.careerMedals ||= {};
  const rewards = [];
  for (const event of CAREER_EVENTS) {
    if (profile.careerMedals[event.id]) continue;
    if (!event.needs.every((id) => profile.careerMedals[id])) continue;
    if (!event.complete(profile)) continue;
    profile.careerMedals[event.id] = event.medal;
    rewards.push(`${event.name} · ${event.medal}`);
  }
  return rewards;
}
