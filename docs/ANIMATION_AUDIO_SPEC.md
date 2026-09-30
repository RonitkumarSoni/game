# Animation and Audio Specification

## Animation principles

- Motion must communicate mass, speed, input, and game state.
- Use anticipation, impact, and settle rather than constant decorative movement.
- UI and 3D motion share timing: 120 ms micro response, 250–350 ms navigation, 450–650 ms hero transition.
- Never copy animation clips from another shipped game. Recreate the interaction principle with original keyframes or licensed clips.

## Front-end sequences

### Title

- Live attract-mode race.
- Logo resolves from blur/offset in 1.05 seconds.
- CTA pulses slowly; environmental exposure breathes.
- Demo camera changes composition every 6–10 seconds without abrupt cuts.

### Loading

- Kart floats on suspension.
- Wheels spin; driver bobs; visor and emissives pulse.
- Thrusters flicker and speed trails move rearward.
- Road markers accelerate toward camera.
- Real loading stages replace generic text when the asset manager lands.

### Racer/vehicle selection

- Old selection exits toward previous navigation direction.
- New vehicle drives/slides into the stage, overshoots slightly, suspension settles.
- Driver performs a short archetype-specific reaction.
- Stats count/animate only after the model settles.

## Gameplay animation matrix

| State | Vehicle | Driver | Camera/VFX |
| --- | --- | --- | --- |
| Idle | subtle vibration, wheel correction | breathing/head scan | quiet emissive pulse |
| Accelerate | rear squat, front lift | torso braces | FOV and wind rise |
| Brake | nose compression | forward lean | brake glow |
| Drift | chassis yaw, counter-steer | inside lean | trails, sparks, lateral camera offset |
| Boost | suspension load then release | head/torso kick | FOV punch, chromatic energy edge |
| Jump | suspension extension | trick prep | camera look-ahead |
| Land | compression and rebound | impact reaction | dust/sparks and short shake |
| Hit | directional recoil | hit pose | warning flash and controlled shake |
| Victory | vehicle flourish | unique celebration | podium camera |

## Audio mix

### Vehicle layers

1. **Sub motor:** low sine/triangle energy tied to speed.
2. **Drive body:** filtered saw/square tied to throttle and load.
3. **Electric whine:** high harmonic tied to speed and boost.
4. **Aerodynamic wind:** filtered noise rising above low speed.
5. **Surface:** tire/hover texture selected by road material and slip.

### Required parameters

- `speedNormalized`
- `throttle`
- `brake`
- `longitudinalAcceleration`
- `lateralSlip`
- `surface`
- `airborne`
- `boostStrength`
- `cameraDistance`

### Mix targets

- Engine readable but not fatiguing.
- Wind communicates speed without masking ability warnings.
- UI feedback stays audible over music.
- Incoming attacks temporarily duck nonessential layers.
- Final lap increases musical intensity without increasing master loudness.
- Provide master/music/vehicle/SFX/voice/UI sliders and mute.

## Acceptance tests

- Blindfolded testers can distinguish idle, half speed, top speed, drift, and boost.
- A player can identify selected surface from tire/hover audio.
- Every critical warning remains audible during maximum music/engine activity.
- Rapid selection changes never overlap unlimited audio voices.
- Leaving/restarting a race stops all old loops and nodes.

