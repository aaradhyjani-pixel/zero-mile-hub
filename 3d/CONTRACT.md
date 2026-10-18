# 3D module contract (read this first)

The game (`hub.js`) is a 2D airport-operations sim. `hub3d.js` (the core) draws the same sim in Three.js r160.
Three modules plug into the core: `3d/field.js`, `3d/terminal.js`, `3d/aircraft.js`. `build.py` concatenates
`hub3d.js` and `3d/*.js` INSIDE hub.js's closure, so a module can only define ONE top-level statement:

```js
Z3MOD.field = function (Z) {   // or terminal / aircraft
  const THREE = Z.THREE;       // everything else lives inside this function: no top-level helpers or names
  // ... build meshes, add them to Z.scene ...
  return { update(dt, now) { /* per frame: dt = real seconds since last frame, now = performance.now()/1000 */ } };
};
```
No `import`/`export`. A module that throws during build is skipped; one that throws in update() stops updating.
A module with a syntax error is left out of the build (build.py prints SKIPPED), so run `node --check` on your file.

## Coordinates
- World (spec.json, sim): metres, x east, y SOUTH, origin at airport centre.
- Three.js: X = x, Z = y, Y = up (altitude, metres). North is -Z.
- Flat shapes from spec paths: build a `THREE.Shape` with points (x, -y), make `ShapeGeometry`/`ExtrudeGeometry`, then
  `geometry.rotateX(-Math.PI/2)`: (x,-y) maps to (X=x, Z=y) with normals pointing up. Spec outlines are SVG path strings
  using M, L, H, V, Q, C, Z (absolute): write a tiny parser.
- Headings (`f.heading`, gate `g.a`): radians in the 2D screen frame, 0 = east (+x), +PI/2 = south (+y).
  A model built nose along +X gets `rotation.y = -heading`.
- Aircraft altitude: `Z.altM(f)` metres (0 on the ground).

## The shared context Z
- `Z.THREE, Z.scene, Z.camera, Z.renderer`; lights `Z.sun` (DirectionalLight, casts shadows), `Z.hemi`; `Z.sunDir` (unit vector to the sun).
- `Z.SPEC`: the full spec.json (runways, taxiways, concourses with gates, remote, bays, buildings, aprons, landside, roof, forecourt, dna, phase2, extent).
- Live sim (read only): `Z.T` (sim seconds into the level), `Z.LV` (level: `LV.light` is 'dawn'|'day'|'heat'|'dusk', may be null on the menu),
  `Z.nightF` (0 day .. 1 full night), `Z.dustNow`, `Z.heatNow`, `Z.flights()`, `Z.incidents()`, `Z.ops()`, `Z.RW` (runways, see below),
  `Z.GATES` (stands: `{id,x,y,a,code,zone,remote,bridge,conc,occ,res,open,mars,marsRole}`; `occ` = the flight parked there),
  `Z.CONC` (piers: `{id,name,cx,cy,lx,ly,open,laneShut,slowUntil,gates}`), `Z.TYPES`, `Z.AL` (airlines: `.tail` colour), `Z.EXT`,
  `Z.STACKS`, `Z.LONGEST`, `Z.CHANGE` (runway changeover seconds, 120), `Z.OPSW` (sweep seconds), `Z.terrain()` (the 2D farmland
  raster canvas) and `Z.terrainBounds` `{x0,y0,w,h}` (world rect it covers).
- Camera state: `Z.camDist` (metres from camera to its focus), `Z.kEx` (aircraft size exaggeration, 1 close up .. 3.4 far out).
- Runway object `r`: `{id,name,short,y,x0,x1,len,width,exits:[{x,to}],holds,mode:'ARR'|'DEP'|'MIX'|'OFF',locked,changeUntil,closedUntil,blocks:[{from,to}],degraded,occ}`.
  Landing direction is west (heading 270); thresholds are at the EAST end x1; approach lights run east of x1.
- Flight `f`: `{id,x,y,heading,alt,state,type,al,T:{len,span,code,wake,eng,prop},A:{tail},v,td,landT,gate,res,rwy,kind}`.
  States: sched inbound holding approach rollout taxi_in dock at_gate parked push start taxi_out hp lineup roll climb goaround divert tow nogate stuck gone diverted towed cancelled.
  Skip sched, gone, diverted, towed, cancelled.

## Budgets (430 aircraft on the field must hold 60 fps on a 2022 MacBook Air)
- Draw calls: field <= 60, terminal <= 80, aircraft <= 60. Use InstancedMesh, merged geometry, one material per look.
- No allocations in update loops (reuse Object3D / Matrix4 / Vector3 / Color). Canvas textures only, total < 120 MB.
- Ground and terminal receive shadows; aircraft, terminal and tall buildings cast them.
- The stepwell forecourt (`SPEC.forecourt`, x0..x1, y0..y1) is sunk 9.6 m below ground: every ground surface the FIELD module
  draws must leave a hole there (THREE.Shape holes); the TERMINAL module builds the terraces and pool inside it.

## Testing
```
cd ~/zero-mile-hub && python3 build.py
.venv/bin/python shots.py /tmp/zmh/<you> "wide:4:1500:c3=-700,0,10500,53,0" "close:4:1500:c3=-1500,-300,1600,38,25"
```
Scenario = name:level:sim_seconds:camera, camera `c3=tx,ty,dist,pitch_deg,yaw_deg` or `c3=tower` / `c3=follow` / `c3=approach`.
It prints `stats3d` (fps, draw calls, triangles) and writes PNGs: Read them and fix what looks wrong.
Level 1 is dawn, 2 day, 3 heat (46 °C), 4 dusk into night with a dust storm from sim second 2400 to 3300.
Other agents are building the other modules at the same time; ignore their failures. Edit only your own file.
