# build.md — Vikram Sarabhai International (VSI): the hub game

Read this first if you are a new Claude picking up the project. It covers what this is, why it is built this way, how the code works, how to build, test and deploy, and what to do next. `prompt.md` is the brief for the next big step (3D).

## 1. What this is
A browser airport-operations game. The player runs **Vikram Sarabhai International (VSI)**, a speculative mega-hub on a greenfield site south-west of Nagpur (between Butibori and the start of the Samruddhi Expressway), at India's geographic centre (the Zero Mile stone).

Brief from the owner, Aaradhy: **merge Ahmedabad (SVPIA), Mumbai (CSMIA) and Bengaluru (KIA) into one airport near Nagpur. The merger is the core concept: design elements from all three must show up in the new building (not done yet, see prompt.md Workstream A0).** The airport is designed "with the capabilities of a world-class parametric studio" (the Beijing Daxing kind), then simulate it with the combined traffic of Delhi, Mumbai, Bengaluru and Hyderabad. He originally named the site "Dakchung", which couldn't be found; the Nagpur greenfield site was assumed and he can correct it.

- Live, private Claude artifact: https://claude.ai/artifact/HMhKa2ib5rtPbMEpDqDNd1
- GitHub repo and Pages URL: see the README in the repo.

### Who it's for and how he likes to work
- He loves airports and operations and wants to feel like the full-day duty manager.
- He wants it **frantic, dramatic, real**: real airlines, real aircraft types (A320neo, 737-8, A350, 777-300ER, A380), real code letters, real numbers.
- **Explain every important term**: click-to-explain glossary terms and short coach toasts.
- Good design taste; must work on a laptop; plain direct English, no filler.
- He reports bugs bluntly. Fix them, and look at your own output with headless screenshots before shipping.

## 2. History (four builds, each a lesson)
1. **BLR Night Shift** (Bengaluru, 22:00 to 06:00). Storm, decision cards, live canvas map.
2. **BLR Day Shift** (06:00 to 12:00, busiest window). Timeline chart of flights due, two-way resource controls, holding-stack explainer, landing and take-off animations.
   - Bugs he reported and that were fixed: zoom and pan felt wrong (fixed with a camera module with anchor zoom, trackpad vs mouse wheel detection and clamping); black screen on reopen (zero-size canvas at load, fixed with a per-frame size check, ResizeObserver and a visibilitychange handler); the Arrivals tab froze the game (an exception killed the requestAnimationFrame loop, so rAF is now called first and draw/hud are wrapped in try/catch).
3. **BOM Monsoon Shift** (Mumbai single runway). He said it **"was not fun"**: you mostly watched and answered multiple-choice cards.
4. **VSI hub (this build)**, designed to fix that:
   - **Map-first direct actions** instead of cards: click runways to switch modes, click incident icons on the map.
   - **Short escalating levels with stars** (about 4.5 real minutes each at 1×).
   - A **bank chart** that shows the next hour's arrival and departure waves against runway capacity.

## 3. Researched numbers (with sources)
| Airport | Movements a day | Passengers a year | Source |
|---|---|---|---|
| Delhi | ~1,380 (Feb 2026: 38,680 in 28 days) | 78.7M (FY26) | GMR monthly traffic Feb 2026 (NSE filing) |
| Mumbai | ~950 (record 1,036, Nov 2025) | 55.3M | Aviation A2Z; Wikipedia list of busiest Indian airports |
| Bengaluru | ~770 average (record 837) | 44.5M | ACI Asia-Pacific |
| Hyderabad | ~530 (Feb 2026: 14,796; record 607 on 18 Jan 2025) | 30.5M | GMR; Siasat |
| **Combined** | **~3,630** | **~209M** | ≈1.7× Atlanta (~2,200 a day) |

Benchmark: Dubai's Al Maktoum plan has 5 parallel runways, 400 gates and 260M passengers (The New Arab, Apr 2024). The design peak hour is about 260 movements.

## 4. The airport (generated, not hand-drawn)
`gen_airport.py` writes `spec.json` and validates it. `gen_drawings.py` writes `masterplan.svg` and `roof.svg`.

Coordinate frame: metres, x east, y south (screen-down), origin at the centre. Compass headings: 0 is north, 90 is east.

- **Runways:** six runways, all 09/27, in two triples either side of a 3.6 km midfield.
  - North triple: R1 09L/27R at y −4200 (4,000 m, arrivals); R2 09C/27C at −2650 (3,800 m, arrivals); R3 09R/27L at −1800 (**4,500 m, longest**, departures).
  - South triple: R4 10L/28R at 1800 (departures); R5 10C/28C at 2650 (departures); R6 10R/28L at 4200 (arrivals).
  - Outer to middle spacing is 1,550 m (independent approaches need ≥1,525 m); middle to inner is 850 m (segregated operations need ≥760 m).
  - **West flow:** everything lands and departs heading 270. All thresholds line up at x = 1800 (the east end).
- **Taxiways:**
  - Parallels at y ±1600, ±2225 and ±3425.
  - **End-around taxiways** at x −3300 (west) and x 2700 (east), so there are no runway crossings.
  - One-way loop: arrivals go west and around, departures go east.
- **Rapid exits** at x −450, −850 and −1250.
- **Holds** at (1880, runway y ± 150) on short stubs.
- **Terminal:**
  - **Zero Mile Hall**, the landside processor: a seven-lobed "Nagpur orange" shell centred at (−2380, 0), with an oculus over the Zero Mile marker.
  - **The Mall**: a waisted spine from x −1860 to 280, with the APM underneath.
  - Six concourses (A to F) at x −1440, −1120, −800, −480, −160 and 160. Each has a north and a south pier from |y| 160 to 760.
  - A, B and C are domestic; D is swing; E and F are international, with code F gates at the pier ends.
- **Stands:** 372 in total (220 contact, 152 remote, all remote stands swing). By code: 288 C, 68 E, 16 F.
- **East zone:** remote stand rows at y ±1000, cargo, MRO, the ATC tower at (1000, 0), and three fire stations.
- **spec.json schema:**
  - `runways[]`: `{id, name, y, x0, x1, width, role, longest, exits:[{x, to}], holds:[{x, y}]}`
  - `taxiways[]`: `{id, oneway, pts}`
  - `concourses[]`: `{id, name, zone, outline (SVG path), apm, gates:[{id, x, y, nose, code, zone, bridge, lane}]}`
  - `remote[]`
  - `buildings[]`: `{kind, outline, label}`
  - `apm`, `landside`, `aprons`, `extent`
  - Gate `lane` points and hold/exit `to` points must lie on taxiway segments. The engine auto-splits T-junctions and crossings, and the validator checks connectivity.

Note: the original plan was a separate "architect" subagent. It stalled (no files after about 40 minutes) and a container restart killed it, so the geometry was generated directly with these scripts.

## 5. Code layout
| File | What it is |
|---|---|
| `hub-head.html` | `<title>`, Google Fonts (Barlow Condensed, Barlow, JetBrains Mono), all CSS. One dark "ops console" look by design. |
| `hub-body.html` | Markup: map canvas, top KPI strip, bank chart, right rail (runway desk, incidents, tabs), toast, popover, overlay sheet. |
| `hub.js` | The whole engine (about 1,000 dense lines). |
| `build.py` | Assembles `hub.html`: head + body + `<template id="planTpl">` (masterplan.svg) + `<script type="application/json" id="specData">` + `window.__DESIGN` (design-section.html with roof.svg inlined) + hub.js. |
| `design-section.html` | The "The airport" tab content. |
| `run.py` | Headless Playwright playtest: `python3 run.py <level 1-4> <expert\|lazy>`. Prints KPIs and a RESULT JSON, saves screenshots `L{n}{e\|l}_{T}.png`. The expert autopilot enumerates runway configs to match the next 20 minutes of demand and resolves incidents. |
| `tools/fastbot.py` | Faster bot with the same planner: `python3 tools/fastbot.py hub.html <expert\|handler\|lazy>`. It always plays level 3 (`startLevel(3)` is hard-coded), so make a copy and change that call to bot any other level. One run takes about a minute. |
| `gen_airport.py` / `gen_drawings.py` | Geometry, validator and drawings. |
| `prompt.md` | Brief for the 3D version. |

Bots in a cloud container: Chromium is already in `/opt/pw-browsers` (chromium-1194), and `python -m playwright install` can't replace it. If a plain `pip install playwright` pulls a newer version, the bots exit with "Executable doesn't exist". Pin the matching version instead: `pip install playwright==1.56.0`.

Build: `python3 gen_airport.py && python3 gen_drawings.py && python3 build.py` produces `hub.html`. Copy it to `site/index.html` for deployment.

### Engine map (`hub.js`)
- **Geometry:** builds a graph from taxiway polylines (`gnode`/`gedge`, T-junction and crossing splits), `ensureNode` for gate lanes, holds and exits. `route(a, b)` is Dijkstra with a binary heap, cached.
- **Time:** `BASE = 20` sim-seconds per real second, speeds 1/2/4×, fixed 1-second substeps. A level is `LEN = 5400` s (90 sim minutes).
- **Levels:** `LEVELS[]` holds clock, `arr`/`dep` hourly base, `amp` (bank strength), `rwOpen` (runway → default mode), `concs` (open concourse letters), share of international, widebody and A380 traffic, incident rate, `target` movements, lighting (`dawn`/`day`/`heat`/`dusk`), and `dust` window.
  - Bank shape: `wv(t)` = sign(sin) × |sin|^0.45 with a 60-minute period. Arrivals peak 25 minutes in; departures are in antiphase.
  - The starting setups give lazy players trouble. Expert players flip runways to match the waves.
- **Schedule (`buildLevel`):**
  - Seeded RNG, real airline and type mix, domestic and international city lists.
  - Pairs departures with arrivals as turnarounds (same airline and type, min turn by type). Unpaired departures start parked at gates; unpaired arrivals are towed to long-stay parking about 25 minutes after landing.
  - Transfer links: each arrival feeds 1 to 3 later departures. Transfer time is 26 minutes domestic and 40 international, +5 minutes from a remote stand.
- **Flight state machine:**
  - Arrivals: sched → inbound → holding (3 racetrack stacks east of the field) → approach (time-based, touchdown at `td`) → rollout → taxi_in or nogate → dock.
  - Then either: at_gate → push → start → taxi_out → hp → lineup → roll → gone; or: parked → tow → towed.
  - Other states: goaround, divert, stuck.
- **Runways:**
  - Modes ARR/DEP/MIX/OFF; `setMode` starts a 2-minute changeover.
  - Separations: arrivals 88 s (+25 after a heavy, +55 after an A380); departures 72 s (+30 after a heavy, +90 after an A380); MIX adds a 58 s gap between arrivals when departures are waiting.
  - Dust storm: arrival separation ×1.4. Heat (Level 3): A380s and 777s need the longest runway (`needsLong`).
- **Incidents** (map icon with a countdown ring, a popover and a rail list; each has actions and a timeout): `fod`, `birds`, `medical`, `breakdown` (scripted plus random), `fuel` (minimum fuel in the stack), `nogate`, `heavy` (heat), `connex` (hold a departure for late connecting passengers).
- **Scoring:**
  - Movements against the target, OTP (airborne ≤ STD + 25 min), connections made %, safety.
  - Stars: 1 = safety ≥ 70; 2 = target reached, OTP ≥ 65 and connections ≥ 80; 3 = OTP ≥ 87, connections ≥ 90 and safety ≥ 90.
  - Best stars are saved in localStorage key `zm_stars`, inside try/catch.
- **Rendering:**
  - A low-resolution terrain raster (farmland, orange orchards, villages).
  - Airfield drawn as vectors each frame in world transform (aprons, taxiways, runways with markings, buildings from SVG Path2D, stands when zoomed in).
  - Aircraft drawn procedurally. Exaggeration `EXs` shrinks as you zoom in so parked aircraft don't overlap.
  - Lights at dusk, dust storm particles, heat haze.
- **Debug hook:** `window.HUB` exposes `T`, `S`, `LV`, `flights()`, `RW`, `incidents()`, `setMode(id, mode)`, `startLevel(n)`, `resolveAll()` and `speed(s)`. `window.__hubResult` is set at the end of a level.

## 6. Calibration at hand-off (headless runs)
| Level | Expert | Lazy (touches nothing) |
|---|---|---|
| 1 Opening day (BLR) | 3★, 95/82 movements, OTP 100% | 0★ (safety 60, OTP 75%) |
| 2 + Hyderabad | 3★, 199/165, OTP 96% | 0★ (OTP 77%) |
| 3 + Mumbai, heat | 3★, 272/245, OTP 90% | 0★ |
| 4 Full hub, dust | 3★, 321/310, OTP 90%, connections 94% | 0★ (296/310, safety 34) |

The lazy runs fail mostly because incidents time out. A player who handles incidents but never flips runways should land around 2★.

## 7. Known gaps / next steps (in priority order)
1. **Polish:**
   - Approach paths from the stacks look like spaghetti at full zoom-out.
   - The bank chart's "due now" labels can overlap the time labels.
   - The heat tint is a little heavy.
   - Departure runway choice sometimes piles everyone onto 27L. Tune the `assignDep` cost.
2. Lineup/hold geometry is simplified (a straight line from the hold to the threshold). Taxiways can carry head-on traffic (`blocked()` only stops same-direction followers).
3. Mobile layout is basic (the rail stacks below the map; the bank chart is hidden).
4. **Top design priority:** the current geometry does not yet express the merger of SVPIA, CSMIA and KIA. prompt.md Workstream A0 says how (Mumbai's peacock coffered columns and art spine; Bengaluru's terminal-in-a-garden and bamboo; Ahmedabad's jaali screens, stepwell forecourt and Sardar Patel unity story).
5. Ideas in `prompt.md`: 3D, build mode, weather radar, ATC voice, terminal crowd simulation.

## 8. Deploy
- **Claude artifact:** publish `hub.html` with the Artifact tool. Republishing the same file path keeps the URL.
- **GitHub Pages:** the repo serves `site/index.html` (a copy of `hub.html`) through the Pages workflow / branch config described in the README.
- **Vercel:** import the GitHub repo on vercel.com. `vercel.json` serves `site/` as a static output directory, so no build step runs on Vercel. The file is self-contained except for Google Fonts.
