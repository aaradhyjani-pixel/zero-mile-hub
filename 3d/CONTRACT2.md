# 3D visual upgrade, round 2: contract (read 3d/CONTRACT.md first, then this)

The user's verdict on round 1: "no one will call this 3D in today's day and age", and the andhi (dust storm) looks very
bad. Goal: a 10x better-looking real-time airport, as close to a modern AAA/Flight-Simulator look as WebGL2 allows,
still 60 fps on a 2022 MacBook Air. DAYTIME ONLY (no night work): levels 1, 2, 4 use a mid-morning sun, level 3 a 14:00 sun
at 46 °C; level 4 has the andhi from sim second 2400 to 3300 (`Z.LV.dust = [2400, 3300]`, `Z.dustNow`).

## Who owns what (edit ONLY your file)
| Role | File |
|---|---|
| Rendering engineer | `hub3d.js` (the core) and the `<script type="importmap">` in `hub-head.html` |
| VFX artist (weather, andhi, clouds, wind) | NEW `3d/weather.js` (registers `Z3MOD.weather`) |
| Environment artist (ground, runways, trees, water) | `3d/field.js` |
| Architecture artist (terminal, glass, buildings) | `3d/terminal.js` |
| Vehicle artist (aircraft, ground vehicles) | `3d/aircraft.js` |

## Three.js loading (rendering engineer sets this up; everyone else uses what Z provides)
An import map in `hub-head.html` maps `three` -> `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js` and
`three/addons/` -> `https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/`. The core does `import('three')` and imports the
addons it needs (Sky, EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, OutputPass, SMAAPass/FXAA, GTAOPass or SAOPass,
RGBELoader not needed). It exposes them as `Z.addons` (an object of classes). Modules may also `await import('three/addons/...')`
inside their builder if they need something else (do it inside an async IIFE; never at top level).

## Image-based lighting
The core renders its sky into a PMREM environment and sets `Z.scene.environment`. Every MeshStandardMaterial /
MeshPhysicalMaterial then gets real reflections and sky light. Material artists: use Standard/Physical materials (not Lambert or
Basic) for anything that should look real, and tune `roughness`, `metalness`, `envMapIntensity`, normal and roughness maps.
Glass, wet-looking water, aircraft paint and metal should visibly reflect the sky.

## Bloom
The core runs UnrealBloom with a threshold of about 1.0 in linear HDR. Anything meant to glow (lights, strobes, lightning,
the sun glint) needs luminance > 1: use `emissiveIntensity` 2-6 or a `MeshBasicMaterial` with `color.multiplyScalar(3)` and
`toneMapped: true`. Ordinary surfaces must stay below 1 so they do not bloom.

## Atmosphere: `Z.atmo` (written by weather.js every frame, read by the core)
```js
Z.atmo = {
  fogColor: THREE.Color, fogDensity: Number,   // FogExp2 density (clear day ~0.000035; inside the andhi ~0.0009-0.0016)
  hazeHeight: Number,                          // metres: height fog thickens below this (core may implement as height fog)
  skyTint: THREE.Color, skyTintK: 0..1,        // blend the sky toward this colour (andhi: dusty ochre/brown)
  sunDim: 0..1,                                // 1 = full sun; the andhi dims the sun to a pale disc
  sunTint: THREE.Color,                        // andhi: orange
  ambientK: Number,                            // multiplier on the hemisphere/env light (andhi ~0.6-0.8)
  grade: { exposure, contrast, saturation, warmth, vignette, grain },   // read by the core's colour-grade pass
  bloom: Number,                               // bloom strength multiplier
  lightning: 0..1,                             // a flash this frame: the core lifts ambient and the sky
  wind: { dir: radians (2D heading frame), speed: m/s, gust: 0..1 },
  visibility: metres,                          // informational
};
```
The core initialises `Z.atmo` with sensible clear-day values before modules build and resets anything the weather module
does not set. If `Z.mods.weather` exists, the core stops drawing its old 2D dust streaks in the overlay.
Field/terminal/aircraft may read `Z.atmo.wind` (tree sway, windsock, aircraft crab angle) and `Z.atmo.lightning`.

## Performance budget for the whole scene (60 fps, MacBook Air M2, 1440x900 at device pixel ratio 2)
- Draw calls: total <= 120 (field 40, terminal 25, aircraft 40, weather 15). Triangles <= 1.2 M.
- Post-processing at most ~5 ms GPU at high quality; the core must auto-drop quality (AO first, then bloom, then pixel ratio)
  if frame time sags, and offer a manual toggle (key G cycles High / Medium / Low).
- No per-frame allocations; textures procedural (canvas/DataTexture), total < 200 MB.

## Testing (same as before)
```
cd ~/zero-mile-hub && python3 build.py
.venv/bin/python shots.py /tmp/zmh/<you> "andhi:4:2800:c3=-1500,-500,1800,22,25" "day:2:1500:c3=-700,0,10500,53,0"
```
Compare against the BEFORE shots in `/tmp/zmh/before/` (andhi_wide, andhi_close, andhi_low, day_wide, terminal, stands,
tower, approach). Also check WebKit: `.venv/bin/python /tmp/zmh/tools/wk.py "file://$HOME/zero-mile-hub/hub.html" /tmp/zmh/<you>/wk.png`
(it opens level 4 at 12:00). Other specialists are editing their files at the same time: ignore their transient failures.
