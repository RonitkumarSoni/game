# Touch Controls and Camera Plan

## Goal

Make Neon Rift Racers fully playable with on-screen controls while preserving keyboard and gamepad input.

## Implemented Controls

- Hold accelerator
- Hold brake / reverse
- Hold left and right steering buttons
- Toggle to an analog drag steering wheel
- Hold hop / drift
- Tap ability
- Hold rear view
- Cycle CHASE, HOOD, and WIDE camera presets

## Interaction Model

- Pointer Events provide a shared mouse, pen, and multi-touch path.
- Pointer capture keeps a held control active even when the finger moves outside its original button.
- `touch-action: none` prevents browser panning/zoom gestures from interrupting driving.
- Held controls merge with keyboard and gamepad values; tap controls use the existing edge-triggered input latch.
- The steering wheel is isolated from the kart's spring animation and returns smoothly to center on release.

## Visual Direction

- Original CSS/vector cockpit assets use the existing cyan, indigo, and magenta visual system.
- Controls use large targets, clear labels, pressed feedback, safe-area insets, and responsive scaling.
- Controls are visible only during intro, countdown, and racing states.

## Camera Presets

- **CHASE** — balanced default follow camera.
- **HOOD** — low forward-facing view from the kart.
- **WIDE** — elevated view with greater track awareness.
- **REAR** — temporary hold-to-look-back override available in race mode.

## References

- MDN Pointer Events: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
- W3C Pointer Events: https://www.w3.org/TR/pointerevents2/
- Three.js PerspectiveCamera: https://threejs.org/docs/pages/PerspectiveCamera.html
- Three.js camera guide: https://threejs.org/manual/pages/cameras.html
