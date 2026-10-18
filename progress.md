# progress.md — session log (newest at the bottom)

Keep this current so a restart loses nothing. Working copy: `~/zero-mile-hub` (git clone of github.com/aaradhyjani-pixel/zero-mile-hub). Playwright venv: `.venv/` (gitignored).

## 2026-10-18 — session start

### Baseline (before any change; commit a635bbe)
Build OK (`gen_airport.py` VALID: 6 runways, 309 taxi nodes all reachable, 372 stands: 288 C / 68 E / 16 F). `site/index.html` rebuilt byte-identical.

| Level | Expert | Lazy |
|---|---|---|
| 1 | 3★ 98/82 moves, OTP 98, cnx 100, safety 100, 14 incidents | 0★ 85/82, OTP 75, safety 60 (4 timed out) |
| 2 | 3★ 199/165, OTP 94, cnx 99, 17 incidents | 0★ 179/165, OTP 81, safety 56 |
| 3 | 2★ 269/245, OTP 89, cnx 88, 17 incidents | 0★ 260/245, OTP 82, safety 42 |
| 4 | 2★ 315/310, OTP 85, cnx 90, 33 incidents | 0★ 272/310, OTP 77, safety 40 |

Zero console errors on all 8 runs.

### User feedback mid-session (top priority)
"Constantly asking me to sweep this runway / send bird patrol" wastes the player's time; cut it ≥10× or remove it. Cause found: `incSpawner` rolls every 60 sim-s (3 real s at 1×) with 10–30% odds; FOD+birds ≈ 60% of the pool; one-button chores; timeouts cost 8–12 safety, so chores decided the stars.

Plan: routine ops automated + visible; player incidents = consequences of runway decisions + a few scripted two-sided choices with a stated default; pacing governor; "Incidents: Standard / Off" switch; retune stars so the runway desk is the skill.

### Incident overhaul — DONE (commit 30843f6 on branch session-2026-10-18)
- Ops teams (`ops[]`, `opsSpawn`, `opsTick`, `drawOps`): birds (perimeter patrol, no closure), fod (sweeper waits for a natural gap / changeover; requests a gap after 5 min via `r.gapReq`), tug (aircraft stuck 3.5 min). Per-level `LV.ops` schedule + 3%/min ambient birds. Logged to ticker only.
- Decisions (`spawnInc`): medical (priority → `priorityLand` bumps conflicting finals | sequence, >8 min wait = −4 safety), fuel (one aggregated card, sim-time fuse, escalates to MAYDAY with red beacon + alarm coach), heavy (aggregated; long runway | offload), nogate (swing | wait), connex (≥40 pax, throttled), strike (inspect 4 min | keep going 1/3 risk of burst-tyre 15-min closure; changeover clears risk), vvip (pick runway; `r.blocks` booked closure 3 min ahead), lights (repair 6 min | degraded ×1.6 sep until next changeover), lane (pier lane shut 4 min | +3 min per pushback 15 min), shear (keep landing → `r.shear` 30% GA | to DEP). Each has `def` + `defText`; `expire()` applies the default. `CFG.inc` = std/off (localStorage zm_cfg).
- Scoring: On time = arrivals (≤15 min late landing) + departures (≤25 min). Stars: 1 = safety ≥70; 2 = target + OTP ≥84 + cnx ≥88; 3 = OTP ≥88 + cnx ≥92 + safety ≥90.
- Levels: L1 42/42 amp .9 target 110; L2 76/76 amp .9 (R2 ARR,R3 DEP,R4 DEP,R5 MIX) target 205; L3 94/94 amp .85 (R1 ARR,R2 MIX,R3 DEP,R4 DEP,R5 MIX) target 260; L4 116/116 amp .75 (… R6 MIX) target 315.
- Results (tune7): expert 3/3/3/3★ (OTP 90/93/93/89), handler 1/1/1/1★, lazy 1/1/1/1★. 0 errors.
- Tools: `run_all.py <outdir>` (12 runs in parallel + table), `shots.py <outdir> name:level:secs:cam[|js]`, HUB.ff/look/spawn/opsSpawn/pause test hooks.
- Head now has doctype + meta charset + viewport (fixed mojibake).

### Fast ship (user asked at 06:20 to ship now, rest later this week)
User feedback: 7-9 h too long; ship a faster version now, keep the rest in files. Deploy is via Git → Vercel (`vercel.json` serves `site/` from `main`).

Shipped in this pass:
- A0 research: `research/a0_research.json` (5 topics x researcher + skeptic: 115 claims, 73 confirmed, 42 corrected, 0 refuted, +40 missed facts) and `research/notes.md` digest.
- New geometry (`gen_airport.py` v2, VALID): runway spacing 1,035/1,550 (old 850 m middle-inner was below even dependent-approach minima); dual midfield parallels + one-way loops; narrowbody + widebody RET sets; 6 holding bays; heat pad by 27L; 304 stands / 360 positions / 56 MARS / 42% E-F / 172 swing; farthest gate 658 m from the APM; Hall rotated (lobe due east into the Mall) and refined to 0.68 km2; roof loft (centrelines/widths/heights), 485 north-light coffers (5.6%), 172 tree columns, 33 gardens, 29 jaali runs, 40 m forecourt cantilever, stepwell forecourt, HSR/metro landside, phase 2 satellites G/H; `dna` block (gateway lobes S=BLR 193 deg, WSW=BOM 244, WNW=AMD 296; N lobe points at Delhi).
- Game: MARS exclusivity (`marsBusy`), roof details on the map (coffers, gardens, oculus, jaali), merger text (menu, band, level blurbs, L2 = Ahmedabad + Hyderabad), "last flight out" coach moment at each level start, Zero Mile wording "long held to mark the centre".
- `design-section.html` (The airport tab) rewritten; `design.md` written (body ~2,400 words: over the 1,800 target; trim later).
- Stars: 2 = target + OTP>=87 + cnx>=88; 3 = OTP>=90 + cnx>=92 + safety>=90.
- Final runs (geo2): expert 3/3/3/3 (OTP 95/94/92/93), handler 1/1/1/1, lazy 1/1/1/1, 0 errors.
- Drawings: background agent rewriting `gen_drawings.py` (masterplan with phase 1/2, transfer path, DNA labels; roof plan from spec.roof).

### PARKED for later this week (not started unless noted)
- [ ] `section.svg` (Hall + one pier: shell, coffers, APM tunnel, forecourt, heat/air arrows) and `axo.svg` (exploded axo of the Hall structure); add both to the airport tab.
- [ ] Trim design.md to 1,200-1,800 words; add a transfer-path figure.
- [ ] Game use of holding bays (`spec.bays`) for no-stand arrivals and of the heat pad (`runways[].pads`) for heavies; hold-point queue of 3-4 on the stub (Phase 0 #6); departure runway balancing (assignDep lookahead).
- [ ] Phase 0 #1 tutorial (L1: "set 28R to ARR", then a call; skippable, once ever); #2 runway flip wash + changeover drain bar, broken-off finals, approach ribbons (next 2 per runway), fading taxi trails; #3 juice (+1 floaters, on-time combo + WebAudio tick, red vignette with stack size, odometer KPI gold above Atlanta pace); #4 zoom tiers (dots/silhouettes/full), concourse occupancy ring on hover, late halo; #5 bank chart: projected backlog curve, ghost line on mode-button hover, scrub tooltip with flights; #8 sound (ATC bed, chime, whoosh, tension drone; mute; off on mobile); #9 debrief timeline + 2 costliest decisions + autopilot comparison; #10 mobile portrait layout; #11 perf (sprite cache, culling, throttle renderLate).
- [ ] Bank chart "due now" labels overlap time labels; approach spaghetti at full zoom-out (known since build.md).
- [ ] Screenshot set: every level x 3 zooms.
- [ ] Phase 1+ (3D) per prompt.md.
- Sensitivity note: AI171 (Air India 787, Ahmedabad, 12 Jun 2025) - never script an Ahmedabad departure accident or use an AI 787 for the AMD last-flight moment.

### 3D (started 06:45, user: "make it 3d, improve animations heavily")
- Core `hub3d.js` (inside hub.js's closure via build.py marker `/*@@3D@@*/`): Three.js r160 via dynamic import from jsDelivr (2D fallback if it fails), sky dome, real solar position for Nagpur per level clock, hemi + shadowed sun, fog, cameras (map orbit / tower cab / follow / approach; C cycles, M map, Q/E rotate, right-drag orbit), picking via projection (f.sx/f.sy), overlay (signs, incidents, tags, MAYDAY, dust), approach ribbons + stack racetracks, fly-in at level start, menu orbit, adaptive quality, HUB.view/ready3d/cam3d/stats3d.
- Modules by 3 parallel agents (one file each): `3d/field.js`, `3d/terminal.js`, `3d/aircraft.js`; contract in `3d/CONTRACT.md`. build.py skips a module that fails `node --check`.
- Sim animation upgrades: curved approach/go-around/exit/lineup paths (`smoothPath`), climb-out state 'climb' with a banked turn to the destination (movement counted at lift-off), break-off (arrivals >40 s out sidestep when their runway leaves ARR/MIX). Taxi smoothing tried and reverted (TAXI_R=0): cut corners trip blocked() and slowed departures (expert L4 dep OTP 87->73).
- Runs after sim changes (sim4): expert 3/3/3/3, handler 1/1/1/1, lazy 1/1/1/1, 0 errors. run.py forces the 2D view.
- shots.py: `c3=tx,ty,dist,pitch,yaw` or `c3=tower|follow|approach`, GPU (Metal) rendering.

### Work queue
- [x] Incident overhaul (Phase 0 item 7 + user feedback)
- [x] run.py: handler bot, per-run outdir, incident counting
- [ ] A0 research (workflow wf_a1b74a77-581 running) → design.md
- [ ] Workstream A: roof, stands/MARS, airside, landside, phase 2, drawings (masterplan, roof, section, axo)
- [ ] Merger in the game: menu, "The airport" tab, level briefings, last-flight-out moments
- [ ] Phase 0 items 1–6, 8–11
- [ ] Final acceptance runs, screenshots, publish
