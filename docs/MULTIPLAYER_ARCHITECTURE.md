# Online Multiplayer Architecture

## Recommendation

Use **Colyseus with a server-authoritative race room** for the first online release. Colyseus supplies rooms, typed/schema state synchronization, matchmaking primitives, and WebSocket transport while allowing the game to own its deterministic simulation.

Do not use pure peer-to-peer or a relay-only room for competitive results. The server must own race state and validation.

## Target

- 2–8 human racers per room.
- Optional AI fills empty slots.
- Region-aware lobby selection.
- Guest sessions first; optional accounts later.
- Invite code and public matchmaking.
- Reconnect window of 20–30 seconds.

## Repository layout

```text
packages/
  simulation/       deterministic shared race logic and protocol types
  client/           current Vite/Three.js game
  server/           Colyseus authoritative rooms
```

The shared simulation package must not import Three.js, DOM, WebAudio, or rendering code.

## Authoritative model

Client sends timestamped/numbered inputs:

```ts
type InputFrame = {
  seq: number;
  clientTick: number;
  throttle: number;
  brake: number;
  steer: number;
  drift: boolean;
  abilityPressed: boolean;
};
```

Server owns:

- Position, velocity, heading, surface, laps, checkpoints, finish.
- Ability allocation, spawn, cooldown, collision, and damage state.
- Rift Shift schedule and active routes.
- Race countdown, clock, standings, results, and reward eligibility.

## Simulation rates

- Server simulation: begin testing at 30 ticks/second.
- Client input send: 30 packets/second, batched when useful.
- State patch/snapshot: 10–20 per second based on measured bandwidth.
- Render: display refresh rate with interpolation.

Rates are starting points and must be profiled under eight-player load.

## Client presentation

- Local vehicle: immediate prediction from local input.
- Server acknowledgment: last processed input sequence.
- Reconciliation: rewind to authoritative state and replay unacknowledged inputs.
- Remote vehicles: 100–150 ms interpolation buffer, Hermite/velocity-aware smoothing.
- Large correction: masked with a short energy/rift correction effect rather than a long slide.
- Abilities: server-confirmed spawn with local anticipation animation where safe.

## Room lifecycle

1. Authenticate guest/profile.
2. Create or join lobby.
3. Select racer/vehicle and ready.
4. Vote/select track and mode.
5. Server locks configuration and distributes seed/content hash.
6. Clients preload and report ready.
7. Server starts synchronized countdown.
8. Authoritative race loop runs.
9. Server validates finish and publishes results.
10. Players vote rematch, return to lobby, or leave.

## State schema

Minimum synchronized room state:

- Phase and server tick.
- Track, mode, seed, lap count, Rift schedule version.
- Player identity, cosmetics, ready/connected flags.
- Vehicle transform and gameplay state.
- Race progress, checkpoint, lap, place, finish time.
- Active abilities, hazards, projectiles, and track events.

Cosmetic-only effects are reconstructed locally from authoritative events rather than continuously synchronized.

## Validation and anti-cheat

- Clamp and validate all inputs.
- Rate-limit messages and ability requests.
- Reject impossible acceleration, checkpoint order, lap transitions, cooldowns, and item ownership.
- Never accept client-submitted position, place, lap time, reward, or finish as truth.
- Content/version hash must match the server before race start.
- Record compact input/event history for dispute and desync diagnosis.

## Disconnect behavior

- Keep the vehicle under safe AI control during the reconnect window.
- Restore the player to the server-owned vehicle on reconnect.
- If reconnect fails, preserve results as DNF and allow remaining players to finish.
- A server process failure ends the match safely; client-host migration is not part of the authoritative architecture.

## Deployment

- Run race servers close to players.
- HTTPS/WSS only in production.
- Add health checks, room counts, tick time, bandwidth, disconnect rate, reconciliation error, and exception monitoring.
- Autoscale by active room count and measured CPU, not only connection count.
- Store only durable profile/results data; transient room state stays in memory.

## Test matrix

- 0/50/100/200/350 ms round-trip latency.
- 0/1/3/5% packet loss.
- Jitter bursts and reordered input sequences.
- Mid-countdown, mid-race, and finish-line disconnects.
- Background tab and mobile suspension.
- Eight-player ability stress.
- Malformed/rapid messages and checkpoint spoof attempts.
- Server tick overrun and process restart behavior.

## Delivery milestones

1. Two-client lobby and synchronized transforms.
2. Shared deterministic lap without abilities.
3. Prediction/reconciliation and remote interpolation.
4. Server-owned abilities and Rift events.
5. Eight-player race, reconnect, results, and bots.
6. Deployment, matchmaking, observability, and abuse protections.

