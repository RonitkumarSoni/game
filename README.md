# Neon Rift Racers

An original browser-based 3D arcade kart racer by **RonitkumarSoni**.

Race through Nova Harbor, Ember Rift, Skyforge Circuit, and Chromewave City with eight distinct pilots, procedural vehicles, responsive arcade handling, tactical abilities, dynamic camera views, synthesized audio, and a premium neon interface.

## Highlights

- Eight pilots with different speed, acceleration, handling, and weight stats
- Live 3D pilot-and-kart showroom alongside the character portraits
- Arcade kart physics with hop, drift, mini-turbo, boost, ramps, and collisions
- Seven AI opponents with racing lines, tactical abilities, and adaptive pace
- CHASE, FRONT, WIDE, and hold-to-rear camera views
- Keyboard, gamepad, on-screen buttons, and analog steering-wheel input
- Click-to-expand tactical minimap
- Context-aware ability interface and responsive touch HUD
- Ten tactical abilities, including a one-hit Phase Shield and close-range Shockwave Pulse
- Procedurally generated 3D models, track visuals, effects, and Web Audio soundtrack
- Responsive neon UI with GSAP transitions
- Quick Race, solo Time Trial with best-run ghost, and a four-round Nova Harbor Cup
- Elimination survival races and timed Checkpoint Rush with ordered gates
- Four selectable circuits, each with its own route and atmosphere
- Local racer profile with race history, achievements, medals, earned titles, and starter career missions
- Private 2–4 player rooms with invite links, ready-up, server-owned race positions, and online XP

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Accelerate | W / Up | A / Right trigger |
| Brake or reverse | S / Down | B / Left trigger |
| Steer | A/D or Left/Right | Left stick |
| Hop or drift | Space | RB / X |
| Use ability | E, X, or Left Shift | LB / Y |
| Rear view | C | Stick click |
| Pause | Esc / P | Start |
| Mute | M | — |
| Quick restart | R | — |
| Toggle Time Trial ghost | G | — |

Touch players can switch between directional steering and an analog steering wheel while keeping accelerator, brake, drift, camera, and contextual ability controls available.

## Local Development

Requirements: Node.js 20 or newer.

```bash
git clone https://github.com/RonitkumarSoni/game.git
cd game
npm install
npm run dev
```

To test private multiplayer locally, build the game and run the Cloudflare Worker emulator in a second terminal:

```bash
npm run build
npm run dev:server
```

Open `http://localhost:8787`, choose **Play with Friends**, create a room, and share its invite link. Use another browser profile or device for the second guest. The host selects a track and laps; everyone must ready up before the host starts. Online rooms require the Cloudflare Worker and Durable Object configuration in `wrangler.jsonc` when deployed. The ordinary Vite dev server at port 3000 also needs the Worker emulator at port 8787 for `/api` and WebSocket proxying.

Career missions remain solo. Online finish XP contributes to each browser's local garage level and kart unlocks, but this guest-profile MVP has no login, cross-device synchronization, or tamper-resistant account progression.

Production verification:

```bash
npm run typecheck
npm test
npm run build
```

## Project Structure

```text
src/               game source and UI
tests/             unit tests
docs/              product and implementation specifications
public/            public application assets
```

## Documentation

- [Product requirements](PRD.md)
- [Technical requirements](REQUIREMENTS.md)
- [Improvement roadmap](docs/IMPROVEMENT_ROADMAP.md)
- [Touch controls plan](docs/TOUCH_CONTROLS_PLAN.md)
- [Animation and audio specification](docs/ANIMATION_AUDIO_SPEC.md)
- [Multiplayer architecture](docs/MULTIPLAYER_ARCHITECTURE.md)

## Author

**RonitkumarSoni**

## License

Licensed under the MIT License. See [LICENSE](LICENSE).
