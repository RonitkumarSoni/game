# Improvement Roadmap

This roadmap converts the PRD into independently verifiable work packages.

## Phase A — Premium vertical slice

1. Replace the title demo background with a polished Nova Harbor attract-mode replay.
2. Build a real 3D selection stage with live racer and vehicle models.
3. Add screen transition controller and shared UI component states.
4. Complete speed-responsive audio, surface audio, mix buses, and settings.
5. Add graphics presets, HUD scale, camera shake, and reduced motion.
6. Add deterministic race seed and fixed-timestep simulation.
7. Profile and set draw-call, triangle, texture, particle, and audio budgets.

**Exit:** One Nova Harbor race looks, sounds, and plays at the final quality bar.

## Phase B — Content architecture

1. Separate driver data from vehicle data.
2. Add garage and six vehicle archetypes.
3. Convert track definitions to typed data and route graphs.
4. Implement Rift Shift event authoring and telegraphing.
5. Create Ember Rift, Skyforge Circuit, and Chromewave City.
6. Replace legacy internal item presentation with final ability models/effects.

**Exit:** Four distinct tracks, eight racers, six vehicles, and ten abilities are playable.

## Phase C — Modes and progression

1. Quick Race and track/mode selection.
2. Grand Prix points and podium.
3. Time Trial, deterministic ghost recording, splits, restart shortcut.
4. Elimination and Checkpoint Rush.
5. Career event graph, medals, unlocks, mastery, achievements.
6. Versioned save migrations and corruption recovery.

**Exit:** A returning player has meaningful goals beyond replaying one race.

## Phase D — Online multiplayer

1. Extract deterministic shared simulation package.
2. Create Colyseus authoritative race server.
3. Add lobby/invite/ready/track-vote UI.
4. Add input protocol, snapshots, interpolation, prediction, and reconciliation.
5. Validate laps, checkpoints, speed, abilities, and finishes server-side.
6. Add reconnect, spectator fallback, rematch, host migration policy, and bots.
7. Add latency/jitter/loss testing and observability.

**Exit:** Eight remote players can complete a synchronized race under realistic network conditions.

## Phase E — Input, accessibility, and mobile

1. Remapping and controller glyph system.
2. Touch layouts and auto-accelerate.
3. Assisted steering and sensitivity/dead-zone settings.
4. UI scaling, colorblind modes, high contrast, reduced motion, safe flashes.
5. Mobile GPU profiles, thermal checks, and landscape safe areas.

## Phase F — Release

1. Browser compatibility and device matrix.
2. PWA/offline caching and asset versioning.
3. CI deployment, smoke tests, error reporting, and rollback.
4. Trailer capture mode, screenshots, updated README, and credits/license inventory.

## Priority order

- **P0:** Fixed timestep, vertical slice, live selection stage, settings, deterministic simulation.
- **P1:** Content architecture, four tracks, progression, multiplayer prototype.
- **P2:** Full online reliability, mobile/accessibility, production asset pass.
- **P3:** Ranked play, cloud profiles, split-screen, replay/photo tools.

