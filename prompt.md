# prompt.md — Taking the Nagpur mega-hub to 3D

Paste everything below the line into a new Claude conversation, together with `build.md` and the current `hub.html`. It is written as a brief for Claude, so it carries the vision, the constraints and the order of work.

---

## The brief

You are taking over a browser game I've been building with Claude. Read `build.md` first: it explains the project, the decisions so far and how the current 2D version works. `hub.html` is the current playable build, a single self-contained file.

**The project.** A speculative mega-airport near Nagpur, at India's geographic centre (the Zero Mile stone). **Its core concept is a merger: Ahmedabad (SVPIA), Mumbai (CSMIA) and Bengaluru (KIA) close and combine into this one airport, and their design DNA must live inside the new building (see Workstream A0).** It carries the combined traffic of Delhi, Mumbai, Bengaluru and Hyderabad: about 3,630 movements a day and 209 million passengers a year, roughly 1.7 times Atlanta. The airport was designed in a fluid, parametric language (one continuous roof, daylight deep inside, short transfer walks). The geometry lives in `spec.json`, which is embedded in `hub.html`.

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

---

## Workstream A — The architecture pass (originally given to a design subagent; do it yourself, in this session)

The current airport (`spec.json`) was generated quickly by `gen_airport.py` after the design subagent stalled. It works and it validates, but it is a planner's layout, not yet a piece of architecture. Do this pass **before or alongside Phase 1** so the 3D build has a design worth rendering. Keep `spec.json`'s schema (section 4 of build.md) so the game keeps working: regenerate with the scripts, never hand-edit thousands of coordinates.

### A0. Design DNA: this airport is a merger, and the building has to show it (most important design change)

ZMI is not a generic mega-hub sized for four cities' traffic. **It is three airports merged into one: Ahmedabad's Sardar Vallabhbhai Patel International (SVPIA, AMD), Mumbai's Chhatrapati Shivaji Maharaj International (CSMIA, BOM) and Bengaluru's Kempegowda International (KIA, BLR).** The traffic of Delhi, Mumbai, Bengaluru and Hyderabad is only the capacity target. The *identity* comes from the three merged airports. A passenger who knew any of them should walk into ZMI and recognise something of home.

First research each airport's architecture properly with web search: who designed which terminal, the roof and column ideas, the materials, the art programme, the landscape, the regional references. Verify every claim and cite sources in `design.md`. Then weave the three into one design, so the result reads as a single building rather than three themed zones bolted together. Starting points to verify and build on:

- **Mumbai (CSMIA Terminal 2):**
  - The peacock-inspired roof, with coffered columns that open into the roof like feathers and skylights in the coffers.
  - The huge art programme along the departures route (the "Jaya He" museum).
  - A white-and-gold, ceremonial interior.
  - *Carry into ZMI:* the column and coffer language of the Mall, where the column heads branch into the roof's skylight field, and an art spine along the transfer route.
- **Bengaluru (KIA Terminal 2):**
  - The "terminal in a garden" idea: indoor-outdoor planting, hanging gardens, bamboo-clad ceilings, green walls, a calm and soft material palette, the Garden City reference.
  - *Carry into ZMI:* gardens under the oculus of the Zero Mile Hall and in the valleys of the roof, and courtyard gardens at each concourse junction. Bamboo or timber-look soffits soften the roof and help with heat.
- **Ahmedabad (SVPIA):**
  - Ahmedabad is India's first UNESCO World Heritage City.
  - Carved stone jaali screens: the Sidi Saiyyed tree-of-life window is the city's emblem.
  - Gujarat's stepwells (Adalaj, Rani ki Vav), with water, shade and descending terraces.
  - The pols, Uttarayan kites, and Sardar Patel's legacy as the unifier of India.

  That last one is a *strong* story for an airport whose whole idea is unification at the country's centre.
  - *Carry into ZMI:* jaali-patterned shading screens on every sun-facing curtain wall, which double as the heat strategy.
  - A stepwell-like sunken forecourt and arrivals court that collects monsoon water and stays cool.
  - A Sardar Patel "unity" reference at the Zero Mile marker.

**How to merge them, not collage them:**
- The roof is one continuous shell (A1). Its *structure* speaks Mumbai: branching columns and coffers. Its *underside and gardens* speak Bengaluru. Its *edges and screens* speak Ahmedabad: jaali, shade, water.
- Map the merger onto the plan:
  - Three of the seven lobes of the Zero Mile Hall become the "gateways" of the three merged airports.
  - Each lobe's check-in hall carries that city's materials and art.
  - All three meet under the oculus at the Zero Mile marker: three cities joined at India's centre.
- Concourses can take a lead identity (for example, the international piers carry Mumbai's ceremonial language and the domestic piers Bengaluru's garden calm). The connective tissue (the Mall, the APM stations, the transfer route) blends all three.
- Write a one-paragraph "what a passenger from Ahmedabad, Mumbai or Bengaluru recognises" note in `design.md`.
- **Respect the originals.** Reference ideas, motifs and materials; don't copy any specific building, artwork or logo. Credit the original architects in `design.md` (as context, not branding).

**Reflect the merger in the game too:**
- The menu and "The airport" tab say plainly that ZMI merges AMD, BOM and BLR.
- Level briefings mention which old airport is closing as its airlines move in. Add a short "last flight out of the old airport" moment at the start of the relevant level.
- The drawings (masterplan, roof, section, axo) label where each airport's DNA lives.
- In Phase 1 (3D), the jaali screens, the branching coffered columns, the garden courts and the stepwell forecourt are the hero details to model.

**Your role:** lead architect and airport planner. Combine the rigour of a top airport planning consultancy (ICAO Annex 14 geometry, runway capacity, stand planning, taxi flows) with the formal ambition of the best parametric studio in the world: fluid continuous forms, one sweeping roof, daylight brought deep inside, structure and circulation as one gesture. The design is original. Put no real firm's name, logo or branding in any output.

**Hold these (already decided):**
- Site south-west of Nagpur; six parallel 09/27 runways in two triples; west flow; end-around taxiways with no runway crossings.
- The traffic numbers in build.md §3; the design peak of about 260 movements an hour.
- The name Zero Mile International (ZMI), and the "seven-lobed Nagpur orange" hall with an oculus over the Zero Mile marker. Refine it, don't replace it.

**Improve these:**
1. **(A1) The roof as one gesture.** The Hall, the Mall and all six concourses currently read as separate shapes. Design a single continuous roof surface that flows from the Hall lobes into the spine and out along each pier, like a river delta or the veins of a leaf. Express it as a parametric surface: a height field or NURBS-like lofts along the circulation centrelines. Write it to `spec.json` as `roof: {centrelines, widths, heights, skylights[]}` so Phase 1 can extrude it in Three.js.
2. **Heat-first environmental design for 47 °C.**
   - Skylight density tuned by orientation (north light only).
   - Deep shading overhangs on the east and west curtain walls.
   - A thermal-mass floor, a displacement ventilation strategy, and monsoon rainwater harvesting in the valleys of the roof.
   - Put the numbers in `design.md`: roof area, skylight ratio, estimated solar gain reduction. Mark estimates as estimates.
3. **Transfers as the main event.**
   - Re-plan the Mall so a domestic-to-domestic transfer is under 12 minutes door to door and international-to-domestic is under 35, including immigration.
   - Draw the transfer journey as a coloured path on the masterplan.
   - Check the walking distances, APM headways and station capacities with a short calculation in `design.md`.
4. **Pier length vs walking distance.** Today's piers are 600 m with reserve apron beyond. Decide the phase 2 extension (or satellite concourses linked by the APM) that takes the airport to 260M passengers. Show phase 1 and phase 2 on the masterplan.
5. **Stand mix.** Push code E/F capability to at least 25% of stands. Add MARS stands (one stand that takes either one widebody or two narrowbodies). Mark swing gates explicitly. Re-run the validator.
6. **Airside smarts.** Write each of these up with its capacity effect:
   - Dual parallel taxiways on the midfield sides, with explicit one-way flags.
   - De-icing is not needed here, but heat-related hold pads near the 4,500 m runway are.
   - Remote holding bays for aircraft that have no gate yet.
   - A second rapid-exit set for widebodies.
7. **Landside.** Integrate high-speed rail (a Mumbai–Nagpur corridor station under the Hall), a Nagpur Metro extension, Samruddhi Expressway ramps, kerbs sized for peak-hour passengers, and a "forecourt as a public square" under the leading edge of the roof.
8. **Deliverables:**
   - An updated `gen_airport.py` and `spec.json`, with the validator passing (print its output).
   - `design.md`: 1,200 to 1,800 words, plain direct English, no hype, with the capacity maths shown and the phasing story told as the game's four levels (Bengaluru moves in, then Hyderabad, then Mumbai, then Delhi).
   - Drawings for a dark UI (`#0f1417` background, Barlow Condensed / Barlow): a new `masterplan.svg` (phase 1 and 2, transfer path, north arrow, scale bar, legend) and `roof.svg` (roof plan with skylight field and structure).
   - A **section drawing** `section.svg` through the Hall and one pier, showing the roof shell, skylights, the APM tunnel and the forecourt, with heat and air flow arrows.
   - An **exploded axonometric** `axo.svg` of the Hall's structure.
   - Then rebuild with `build.py`, check every drawing in the game's "The airport" tab with a headless screenshot, and commit.

**Working rules:**
- Save files as you produce them. Never sit on unsaved work.
- Keep a `progress.md` updated as you go, so a restart loses nothing.
- If a decision is genuinely ambiguous, pick the option that makes the game better and say so in `design.md`.
