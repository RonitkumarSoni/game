# Loading Cinematic Plan

## Goal

Turn the loading page into a short, repeatable vehicle showcase inspired by the motion language of premium racing-game menus, while keeping all artwork and code original to Neon Rift Racers.

## Motion Timeline (4.8 seconds)

1. **Approach (0.0–1.1s)** — the kart enters from off-screen left with motion blur, speed trails, spinning wheels, and a compressed shadow.
2. **Hero settle (1.1–3.3s)** — the kart overshoots, rebounds into the center, and continues subtle suspension and driver motion while a highlight sweeps across the body.
3. **Rift charge (3.3–3.8s)** — portal rings expand, telemetry fades, thrusters intensify, and the camera adds a brief impact shake.
4. **Launch (3.8–4.8s)** — the kart accelerates through the right edge with scale, blur, and shadow stretch; the sequence then loops without a hard cut.

## Supporting Layers

- Three perspective gates cross the scene at separate timings.
- Near and far star fields move at different speeds for parallax.
- Road dashes, energy trails, wheels, driver, thrusters, shadow, and camera animate independently.
- Loading copy cycles through vehicle calibration, pilot link, rift opening, and launch-ready states.
- `prefers-reduced-motion` disables the motion for accessibility.

## Acceptance Criteria

- The kart must visibly travel across the frame, not merely bob in place.
- The cycle must remain readable on desktop and scale down without horizontal page overflow.
- Loading text must change during longer loads and timers must stop after leaving the screen.
- No third-party game art, animation, or proprietary asset may be copied into the project.
- Typecheck, production build, and automated tests must pass.

## Status

Implemented in `src/menu.js` and `src/styles.css`. Typecheck, production build, and all 34 automated tests pass.
