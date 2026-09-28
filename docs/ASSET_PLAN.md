# Asset Plan and License Policy

## Rule

Do not copy or extract art, animations, music, sound, UI, logos, or models from commercial games. References may inform pacing, hierarchy, camera language, and interaction principles; shipped assets must be original or properly licensed.

## Approved source categories

- Original procedural assets already in the repository.
- Original assets created specifically for Neon Rift Racers.
- Commissioned assets with written commercial rights.
- CC0 assets with the license verified at download time.
- Purchased marketplace assets whose license permits browser-game redistribution in compiled form.

Recommended low-risk libraries:

- Kenney — public-domain/CC0 game assets: https://kenney.nl/assets
- Poly Haven — CC0 HDRIs, textures, and selected models: https://polyhaven.com

## Asset manifest fields

Every imported asset must record:

| Field | Requirement |
| --- | --- |
| ID | Stable internal identifier |
| File | Repository-relative shipped path |
| Type | Model, texture, animation, audio, font, icon, VFX |
| Source | Original source URL or commission record |
| Author | Creator or organization |
| License | Exact license name/version |
| License proof | Local license file or archived receipt/reference |
| Modifications | Compression, retopology, recolor, edit, remix |
| Attribution | Required credit text, if any |
| Budget | Triangles, texture size, duration, sample rate, file size |

## Required production assets

### Brand and UI

- Vector master logo and monochrome mark.
- Button corner/slice motifs and focus indicators.
- 20–30 original ability, mode, warning, settings, and controller icons.
- Loading illustrations/stages for four tracks.
- Racer portraits and podium variants.
- Original licensed display/body font files for offline bundling.

### Vehicles

- Six base vehicle GLBs.
- Three LOD levels per vehicle.
- Wheel/hover modules, spoilers, paint masks, decals, emissive masks.
- Collision proxy and selection-stage turntable metadata.
- Animations or procedural rigs for suspension, steering, wheels, thrusters, damage response.

### Racers

- Eight character GLBs with consistent skeleton.
- Idle, select, ready, steering, drift lean, hit, trick, victory, defeat, and podium clips.
- Helmet/face/visor variants and color masks.

### Tracks

- Modular road and barrier kit.
- Nova Harbor city/port kit.
- Ember Rift volcanic kit.
- Skyforge floating/anti-gravity kit.
- Chromewave neon city/rain kit.
- Track-specific signage, hazards, portals, crowds, and background silhouettes.
- CC0 HDRI candidates and baked environment maps.

### Audio

- Four adaptive music suites with stems.
- Vehicle motor layers across RPM/speed ranges.
- Wind, tire/surface, drift, landing, collision, UI, ambience, and ten ability families.
- Racer voice sets with consistent loudness and subtitle identifiers.

## Import requirements

- glTF/GLB for 3D.
- KTX2/Basis for production GPU textures where supported.
- Meshopt or Draco only after measured load/runtime tradeoff.
- OGG/Opus or browser-compatible compressed audio plus required fallbacks.
- Avoid textures larger than required by visible screen size.
- Validate colorspace, mipmaps, pivots, scale, and disposal before acceptance.

