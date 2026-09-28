# Neon Rift Racers

An original browser-based 3D arcade kart racer by **RonitkumarSoni**.

Race through Nova Harbor with eight distinct pilots, procedural vehicles, responsive arcade handling, tactical abilities, dynamic camera views, synthesized audio, and a premium neon interface.

## Highlights

- Eight pilots with different speed, acceleration, handling, and weight stats
- Arcade kart physics with hop, drift, mini-turbo, boost, ramps, and collisions
- Seven AI opponents with racing lines, tactical abilities, and adaptive pace
- CHASE, FRONT, WIDE, and hold-to-rear camera views
- Keyboard, gamepad, on-screen buttons, and analog steering-wheel input
- Click-to-expand tactical minimap
- Context-aware ability interface and responsive touch HUD
- Procedurally generated 3D models, track visuals, effects, and Web Audio soundtrack
- Responsive neon UI with GSAP transitions

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

Touch players can switch between directional steering and an analog steering wheel while keeping accelerator, brake, drift, camera, and contextual ability controls available.

## Local Development

Requirements: Node.js 20 or newer.

```bash
git clone https://github.com/RonitkumarSoni/game.git
cd game
npm install
npm run dev
```

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
