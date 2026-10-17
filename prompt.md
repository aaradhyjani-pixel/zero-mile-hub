# prompt.md — Taking the Nagpur mega-hub to 3D

Paste everything below the line into a new Claude conversation, together with `build.md` and the current `hub.html`. It is written as a brief for Claude, so it carries the vision, the constraints and the order of work.

---

## The brief

You are taking over a browser game I've been building with Claude. Read `build.md` first: it explains the project, the decisions so far and how the current 2D version works. `hub.html` is the current playable build, a single self-contained file.

**The project.** A speculative mega-airport near Nagpur, at India's geographic centre (the Zero Mile stone). It merges Ahmedabad, Mumbai and Bengaluru airports into one hub. It carries the combined traffic of Delhi, Mumbai, Bengaluru and Hyderabad: about 3,630 movements a day and 209 million passengers a year, roughly 1.7 times Atlanta. The airport was designed in a fluid, parametric language (one continuous roof, daylight deep inside, short transfer walks). The geometry lives in `spec.json`, which is embedded in `hub.html`.

**What I want now:** make it 3D, much more fun and much more interesting, without losing what already works: the runway desk, the bank chart, map incidents with countdown rings, and levels that build up as cities migrate in.

I am the player: an airport operations manager who loves airports. I want it frantic, dramatic and real, with every important term explained in plain words. Real airlines, real aircraft types, real numbers. Good design taste. It has to run on a laptop in a browser.

### Hard constraints
- **Deliverable:** a single HTML file published as a Claude artifact. External scripts only from cdnjs.cloudflare.com, cdn.jsdelivr.net/npm, unpkg.com, with exact pinned versions (for example `three@0.160.0`). Fonts only from Google Fonts. No other network access, so models and textures must be procedural or embedded as data URIs (keep the file under about 15 MB).
- **Performance:** 60 fps on a 2022 MacBook Air with about 400 aircraft on the field and 30 in the air. Use instanced meshes, level of detail and a fixed-step simulation decoupled from rendering. Consider running the simulation in a Web Worker created from a Blob.
- **No regressions:** the 2D sim's runway logic, separation, wake rules, gate logic and incidents are the source of truth. Port them, don't reinvent them.
- **Robustness:** never let one exception kill the render loop. Call requestAnimationFrame first and wrap draw and update in try/catch. Handle a zero-size canvas at load, tab switching, and the window resizing.

### Work in this order, and ship a playable build after each phase

**Phase 0 — Polish sprint on the 2D game (do this first, ship it within the first session)**

The bar: someone who has never heard of the game opens it, understands it within 60 seconds, has their heart rate up by minute 3, and wants to replay a level to get the third star. Everything below serves that. For each item, check the result in a headless screenshot before you move on.

1. **First 60 seconds.** Replace the wall of text with a 20-second interactive tutorial inside Level 1:
   - "This is the bank chart. See the purple wave coming? Set runway 28R to ARR now." The chart pulses, the button glows.
   - Then FOD appears: "Click the red icon."
   - Then the player is free.
   - Skippable, and never shown again after the first completion.
2. **Make the core loop feel physical.**
   - When you flip a runway, its colour wash sweeps along it, and the changeover is a draining bar on the runway itself.
   - The aircraft on final for that runway visibly break off to another runway.
   - Approach paths show as clean curved arcs from stack to final (no spaghetti): draw only the next 2 arrivals per runway, as a glowing ribbon.
   - Taxi routes draw as fading trails.
3. **Juice.**
   - A floating "+1" when an arrival vacates or a departure lifts off, colour-coded.
   - A combo counter for consecutive on-time departures ("7× on time"), with a subtle sound tick (WebAudio, mute toggle).
   - A screen-edge red vignette that grows with the stack size.
   - The movements-per-hour KPI ticks up like an odometer and turns gold above the Atlanta record pace.
4. **Readability at 400 aircraft.**
   - Three zoom tiers with different symbology:
     - Zoomed out: dots coloured by state (arriving, departing, at gate, late), plus flow arrows on taxiways.
     - Mid zoom: silhouettes.
     - Close: full aircraft with tags.
   - Hovering a concourse shows its gate occupancy as a ring chart.
   - Late departures get a pulsing red halo you can see from fully zoomed out.
5. **The bank chart is the hero. Make it smarter.**
   - Draw the projected backlog curve: if you keep this setup, the holding stack will hit N at time X.
   - Add a ghost line showing what the capacity would be if you flipped one runway now (hover a runway's mode button to preview).
   - Make it drag-scrubbable: hover a bar to see exactly which flights are in it.
6. **Smarter traffic.**
   - Fix the departure runway choice: balance by queue length and taxi time with lookahead, so 27L doesn't hoard aircraft.
   - Model the hold point as a proper queue of 3 to 4 aircraft lined up on the stub, not overlapping.
   - Taxiways become directional where the loop design says so (west on the outer parallels, east on the midfield ones), and the routing respects it.
7. **Incidents with stakes and variety.** Give each incident a mini decision with a real trade-off rather than one button:
   - Medical: priority land on the nearest runway (costs a go-around for the next aircraft), or land in sequence.
   - Bird strike: sweep now (lose 90 s of capacity) or keep going with risk.
   - Escalation: an ignored minimum-fuel aircraft becomes MAYDAY, gets a red beacon on the map and the coach shouts.
   - Add 4 new incidents:
     - Runway lighting failure at dusk.
     - Tug breakdown in a concourse lane (that pier is blocked).
     - A VVIP movement that closes a runway for 6 minutes with 3 minutes' warning.
     - A go-around cascade in the dust storm.
8. **Sound design (WebAudio, no files):** a soft ATC chatter bed, a chime for new incidents, a jet whoosh on take-off at close zoom, and a rising tension drone as the stack grows. Everything mutable, off by default on mobile.
9. **End-of-level debrief that teaches.**
   - A replayable timeline: scrub the 90 minutes and watch the stack, queues and your runway flips as a compact chart.
   - Highlight the 2 decisions that cost the most: "At 19:22 you kept 3 runways on DEP while 41 arrivals were due. The stack peaked at 17."
   - Compare with the expert autopilot's score on the same seed.
10. **Mobile:** a playable portrait layout. The map is full screen, the runway desk is a bottom sheet, incidents are swipeable cards, and touch targets are at least 44 px.
11. **Performance target:** 60 fps at Level 4 on a mid laptop. Profile with the Performance API:
    - Cache aircraft sprites per type, livery and zoom bucket on offscreen canvases.
    - Cull aircraft that are off screen.
    - Throttle `renderLate()` and the DOM writes.

Acceptance for Phase 0, with numbers reported:
- Run `run.py` on all 4 levels, expert and lazy. Expert gets 3★ and lazy gets 0 to 1★.
- Add a "handles incidents but never flips runways" bot. It should land at 1 to 2★, which proves the runway desk is the skill.
- Take a screenshot set of every level at 3 zoom levels.
- Get zero console errors across a 4-level run.

**Phase 1 — The airport in 3D (the "wow" moment)**
- Three.js scene built from `spec.json`:
  - Extruded runways with real markings: threshold piano keys, touchdown zone and aiming points, designators, edge and centreline lights.
  - Taxiways with yellow centrelines and blue edge lights.
  - Aprons and stand lead-in lines.
- The terminal as the hero. Build the processor and concourse roofs as procedural parametric surfaces lofted from the outline paths, with a skylight pattern (Voronoi or a hexagonal lattice) that throws dappled light patches onto the floor. Glass curtain walls. The APM guideway with trains running.
- Terrain: Nagpur farmland (black cotton soil, orange orchards in rows, villages, nallahs), the Samruddhi Expressway and the rail line. Instanced trees.
- A time-of-day lighting rig that matches each level:
  - Dawn: warm, low sun, long shadows.
  - Afternoon heat: bleached light with heat shimmer done as a screen-space distortion near the asphalt.
  - Dusk to night: sodium apron floodlights, runway lights, approach light strobes ("the rabbit"), terminal glow.
- Cameras:
  - The default strategic three-quarter view, with smooth zoom and orbit.
  - The tower cab view from the ATC tower.
  - Follow-cam on any clicked aircraft.
  - A cinematic "approach cam" that rides an arrival down the glide path.
  - Press C to cycle cameras.

**Phase 2 — Aircraft and life on the ground**
- Low-poly aircraft families: A320neo/A321neo, 737-8, ATR 72, A330, 787, 777-300ER, A350, A380. Each is a merged BufferGeometry with an airline livery done as a tail colour plus a simple fuselage stripe through instanced vertex colours. Accurate relative sizes. Engines, gear down below 1,500 ft, landing lights, strobes and beacons.
- Real motion:
  - Flare and touchdown with a tyre-smoke puff.
  - Reverse-thrust haze.
  - Rotation at Vr, gear retraction and climb-out banking toward the departure corridor.
  - Taxi turns that follow centreline arcs, not corners.
- Ground vehicles as instanced meshes: pushback tugs, fuel bowsers, catering trucks, buses to remote stands, follow-me cars, fire tenders racing to incidents, bird-patrol jeeps.
- Aerobridges that extend and dock.

**Phase 3 — Make it more fun**
- **Campaign: "The Migration".** The current 4 levels become a campaign across opening year. Each city's move-in is a chapter with a cutscene-style briefing.
  - Unlock a runway, concourse or tool after each chapter.
  - Persistent progress and stars in localStorage, with try/catch around every read and write.
- **Build mode.** Before a level, spend a budget in crores on capacity:
  - Open a concourse.
  - Add remote stands.
  - Build a rapid-exit taxiway.
  - Extend the long runway.
  - Add an APM train.
  - Hire a bird-control team.

  Choices persist, and real trade-offs matter (an end-around taxiway saves runway crossings but adds taxi time).
- **More incidents.** Each needs a spatial decision on the map, never a modal:
  - A VVIP movement that freezes a runway.
  - An Air India A350 with a hydraulic failure that needs the longest runway and fire tenders positioned.
  - A pre-monsoon squall line visible on weather radar sweeping across the field.
  - A cyber outage of the check-in system that floods security.
  - A bomb threat that needs an isolated stand.
  - A Kumbh Mela charter surge.
  - A heatwave runway-lighting failure.
- **Weather as a system.** A radar overlay of moving cells. Wind that changes the runway direction: switching the whole airport from west flow to east flow is a big, dramatic decision with a 10-minute changeover.
- **Voice.** ATC readbacks and tower calls through the Web Speech API (speechSynthesis), with an Indian English voice where available and a mute toggle.
- **Scoring that feels good.**
  - Combo multipliers for chains of on-time departures.
  - A big end-of-level "movements per hour" number compared with Atlanta, Dubai and Delhi.
  - A replay of the busiest 5 minutes from the tower cam.
- **Daily challenge** from a seeded random day, so the same schedule can be replayed and compared.

**Phase 4 — Ambitious extras (pick what's feasible)**
- **Passenger flow inside the terminal.** A crowd simulation (agents as instanced dots or capsules) through check-in, security, immigration, the APM and gates. You can cut away the roof to see queues building, and transfer passengers visibly running for connections.
- **Baggage system.** A visualisation of the baggage hall's tilt-tray sorter, with misrouted-bag incidents.
- **Co-op mode for two players** sharing state: one runs runways (tower), one runs the ground (AOCC). Only attempt this if the artifact platform offers shared state; otherwise skip it.
- **Airport designer sandbox.** Drag runways (enforcing 1,525 m spacing for independent approaches), lay taxiways, place concourses and gates, then stress-test the design with the Level 4 schedule. Export your layout as JSON.
- **Real-traffic flavour.** Airline mixes and city pairs that match real Indian schedules. Flight numbers that look right (6E 2xxx to 6xxx, AI 4xx to 2xxx, and so on).

### Quality bar
- Every term a newcomer might not know (bank, wake turbulence, rapid exit, swing gate, FOD, MCT, ILS, flare, Vr) gets a click-to-explain tooltip.
- Look at your own output: take screenshots with headless Chromium (Playwright is in the environment) at each level and in each lighting state, and fix what looks off before you hand it over.
- Run automated playtests: an "expert" autopilot that flips runways to match the banks and resolves incidents, and a "lazy" run that does nothing. Expert should get 2 to 3 stars, lazy 0 to 1. Report the numbers.
- Keep the 2D map as a toggle (key M) for strategic overview, because it is genuinely useful when 400 aircraft are moving.

### First reply I expect from you
A short plan for Phase 1 with the scene graph, the performance approach and the risks. Then start building straight away. Don't wait for my approval unless something is genuinely ambiguous.
