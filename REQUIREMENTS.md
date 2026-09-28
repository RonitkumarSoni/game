# Neon Rift Racers — Production Requirements

**Status:** Active implementation contract  
**Product:** Browser-first 3D arcade combat racer  
**Source of truth:** This file defines the minimum production requirements. `PRD.md` defines the broader product vision.

## 1. Experience target

Neon Rift Racers must feel like a premium original game, not a reskin of Turbo Kart Rally. Every player-facing system must support the same futuristic racing identity: fast motion, readable competition, dark technical surfaces, cyan telemetry, restrained magenta energy, original racers and vehicles, and responsive audio.

## 2. Current implementation status

### Implemented

- Neon Rift Racers title, tagline, colors, fonts, and favicon.
- Eight renamed racers with new profiles and visual mappings.
- Nova Harbor track name, gantry, and trackside branding.
- Premium title, racer select, pause, HUD, minimap, ability slot, and results styling.
- Original player-facing ability names while legacy simulation identifiers remain stable.
- Animated kart-and-driver loading sequence.
- Layered procedural engine, hover whine, speed wind, reverb, new countdown, and revised synthwave score.
- Vite, strict TypeScript bridge, core utilities, build, and unit-test foundation.
- Production build and 34 passing unit tests.

### Not implemented

- Four production tracks and the complete Rift Shift system.
- Separate selectable vehicle roster and garage.
- Grand Prix, Time Trial ghosts, Elimination, Checkpoint Rush, career, achievements, and mastery.
- Touch driving, remapping, full accessibility settings, and graphics settings UI.
- Production external models, textures, character animation clips, voice, and mastered music.
- Online multiplayer backend, lobby, matchmaking, reconciliation, reconnect, and deployment.
- Full server-authoritative deterministic simulation.

## 3. Opening experience

### 3.1 Boot and loading

- First visible response within 500 ms on a normal cached load.
- Loading screen must show an animated vehicle and racer, not a generic spinner.
- Loading presentation must contain motion in the vehicle, wheels, driver, road, energy trails, and progress indicator.
- Loading copy must report real stages when the asset pipeline exists: core, track, vehicles, audio, shaders, ready.
- Reduced-motion mode must replace continuous animation with a static high-quality composition.

### 3.2 Title screen

- Live gameplay remains the visual hero; logo may not obscure more than 45% of the useful scene.
- Logo entrance, environmental motion, live demo racers, and CTA pulse prevent a static first impression.
- Primary action: Start Race.
- Future primary navigation: Career, Quick Race, Online, Garage, Settings.
- All actions must support keyboard, gamepad, pointer, and touch.
- Focused actions require a visible non-color-only state.

### 3.3 Transitions

- Screen changes use 250–500 ms transitions with direction and continuity.
- Racer or vehicle changes animate the featured model instead of instantly replacing it.
- Long operations use loading state; short operations use local skeleton/transition state.
- Avoid full-screen white flashes.

## 4. Typography

- Display font: Orbitron or a bundled alternative with an appropriate redistribution license.
- Body font: Inter or bundled system fallback.
- Minimum body size: 14 px desktop, 15 px touch UI.
- Technical microcopy: minimum 9 px only for nonessential decoration.
- Maximum three font weights per screen.
- Uppercase is limited to titles, labels, and short actions; paragraphs use normal case.
- HUD numbers use tabular numerals.
- Text contrast must meet WCAG AA where it communicates actions or gameplay state.
- Game title must remain legible at 1280×720 without dominating the live scene.

## 5. Buttons and interaction assets

Every interactive control requires:

- Default, hover, focus, pressed, disabled, and loading states.
- Pointer target of at least 44×44 CSS pixels for touch-capable layouts.
- Text label for primary actions; icons alone are reserved for universal secondary actions.
- Keyboard and gamepad focus order.
- UI move, confirm, back, disabled, and error sounds.
- Optional controller vibration for confirm/error.

Required reusable components:

- Primary CTA
- Secondary CTA
- Danger/back action
- Icon button
- Segmented option selector
- Slider
- Toggle
- Tabs
- Modal confirmation
- Toast
- Tooltip/control hint
- Loading button
- Lobby ready button

## 6. Vehicle and character presentation

- Racer selection must show a live 3D vehicle and character when production models are available.
- Switching selection triggers a 350–650 ms authored transition: outgoing slide/drive, light sweep, incoming settle, driver reaction.
- Vehicle idle contains suspension movement, wheel correction, engine vibration, emissive pulse, and driver breathing/head motion.
- Acceleration contains chassis squat, front lift, wheel speed, exhaust energy, camera lag, and speed-line response.
- Drift contains chassis yaw, counter-steer, driver lean, tire/energy trails, sparks, and charge-state color.
- Landing contains suspension compression, driver reaction, dust/sparks, and camera impulse.
- Animations must be original, licensed, or produced from owned source assets.

## 7. Vehicle audio

- Engine is layered into sub motor, mechanical/hover body, high-speed whine, and aerodynamic wind.
- Pitch and gain respond to actual speed, throttle, slip, surface, airborne state, and boost.
- Acceleration must be audible without relying on the HUD.
- Wind becomes meaningful above approximately 25% top speed.
- Boost changes both timbre and stereo width.
- Drift adds surface-dependent friction and charge tones.
- Collision sounds scale by impact energy and material.
- Mix buses: master, music, vehicle, abilities, ambience, voice, UI.
- Audio must not clip after compressor/limiter processing.

## 8. Race UI

- Position, lap/objective, held ability, incoming threat, route, and speed state remain readable at a glance.
- Nonessential decoration must not cover the racing line.
- HUD safe-area support is required for ultrawide and mobile devices.
- Ability names shown to users must use Neon Rift terminology.
- Warning signals combine shape, motion, sound, and color.
- HUD scale and camera shake must be configurable.

## 9. Asset requirements

- Maintain `docs/ASSET_PLAN.md` and an asset manifest containing source URL, author, license, modification notes, and shipped path.
- Allowed: original work, commissioned work, CC0, or explicitly purchased/licensed assets compatible with distribution.
- Prohibited: ripping or copying assets, animation clips, sounds, music, UI, or models from commercial games.
- Every external asset must have a stored license record before integration.
- Production 3D assets use glTF/GLB, compressed textures, sensible LODs, and tested disposal.

## 10. Online multiplayer

- Use a server-authoritative model; clients send inputs, not trusted positions or race results.
- Target 2–8 players per room for Version 1.
- Required flows: guest identity, create/join lobby, invite code, ready state, track vote, synchronized countdown, race, results, rematch, leave, reconnect.
- Server validates checkpoints, lap order, speed, ability use, cooldowns, and finish results.
- Local prediction and server reconciliation are required for the owning vehicle.
- Remote vehicles use interpolation with a bounded buffer.
- Network simulation must be testable with latency, jitter, loss, and disconnect conditions.
- Detailed design is in `docs/MULTIPLAYER_ARCHITECTURE.md`.

## 11. Performance

- 60 FPS target desktop; scalable 30–60 FPS mobile.
- Approximately 10 ms or less average application work per 60 Hz frame.
- Dynamic pixel ratio and Low/Medium/High/Ultra presets.
- Repeated props use instancing.
- High-frequency effects use pools.
- No meaningful persistent memory increase after ten race restarts.
- Initial compressed download and per-track budgets must be defined after asset selection.

## 12. Quality gates

A feature is complete only when:

- It works with keyboard and gamepad; touch when applicable.
- It has loading, error, empty, focus, and disabled states where applicable.
- It passes its automated tests.
- It creates no new console errors.
- It remains usable at 1280×720 and 1920×1080.
- It respects reduced motion and audio settings.
- It meets the relevant frame-time and memory budget.
- Any third-party asset has a verified license entry.

