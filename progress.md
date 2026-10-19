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
- [x] Art-direction fixes from `art-review.md`: all 8 items plus the skylights, done on branch `3d-polish` (9 commits) and merged.
- [ ] Re-measure 3D fps on an idle machine; the AO pass redraws the whole scene (~463k extra tris), and the low storm camera is at 1.53M tris against a 1.2M budget.
- [ ] Build more set pieces from `writers-room.md`. Top picks: Pier F macaques (L4), Nagpur is flat / GPS spoofing (L3), Surya Kiran flypast slot choice (L1), Hyderabad bank 20 late (L2), the rolling kites (L2).
- Sensitivity note: AI171 (Air India 787, Ahmedabad, 12 Jun 2025) - never script an Ahmedabad departure accident or use an AI 787 for the AMD last-flight moment.

### 3D (started 06:45, user: "make it 3d, improve animations heavily")
- Core `hub3d.js` (inside hub.js's closure via build.py marker `/*@@3D@@*/`): Three.js r160 via dynamic import from jsDelivr (2D fallback if it fails), sky dome, real solar position for Nagpur per level clock, hemi + shadowed sun, fog, cameras (map orbit / tower cab / follow / approach; C cycles, M map, Q/E rotate, right-drag orbit), picking via projection (f.sx/f.sy), overlay (signs, incidents, tags, MAYDAY, dust), approach ribbons + stack racetracks, fly-in at level start, menu orbit, adaptive quality, HUB.view/ready3d/cam3d/stats3d.
- Modules by 3 parallel agents (one file each): `3d/field.js`, `3d/terminal.js`, `3d/aircraft.js`; contract in `3d/CONTRACT.md`. build.py skips a module that fails `node --check`.
- Sim animation upgrades: curved approach/go-around/exit/lineup paths (`smoothPath`), climb-out state 'climb' with a banked turn to the destination (movement counted at lift-off), break-off (arrivals >40 s out sidestep when their runway leaves ARR/MIX). Taxi smoothing tried and reverted (TAXI_R=0): cut corners trip blocked() and slowed departures (expert L4 dep OTP 87->73).
- Runs after sim changes (sim4): expert 3/3/3/3, handler 1/1/1/1, lazy 1/1/1/1, 0 errors. run.py forces the 2D view.
- shots.py: `c3=tx,ty,dist,pitch,yaw` or `c3=tower|follow|approach`, GPU (Metal) rendering.

### 3D round 2 (user: "no one will call this 3D in today's day and age"; andhi looks very bad)
- User calls: daytime only, green landscape, type-accurate aircraft + liveries, shadows. Pushed so far: 4e1ea0e (3D), 8a488fb (black-at-sunset fix, daylight), 638d8fe (A380 decks).
- Round 2 contract: `3d/CONTRACT2.md` (Z.atmo written by weather.js and read by the core; IBL via scene.environment; bloom > 1; budgets 120 calls / 1.2M tris).
- 5 specialists in parallel: rendering engineer (hub3d.js + importmap: Sky, PMREM, EffectComposer AO/bloom/grade/AA, FogExp2 + height fog, shadow stability, quality tiers G), VFX (new 3d/weather.js: haboob wall, front passage, in-storm dust, lightning, rain tail, clouds + cloud shadows, wind), environment (field.js PBR, trees, water, signs, windsocks), architecture (terminal.js roof/glass/interior/columns/people), vehicles (aircraft.js PBR, fans, gear, liveries, crab/buffet).
- Before shots: /tmp/zmh/before/. Then an art-director QA pass, verify Chromium + WebKit, push.

### Work queue
- [x] Incident overhaul (Phase 0 item 7 + user feedback)
- [x] run.py: handler bot, per-run outdir, incident counting
- [ ] A0 research (workflow wf_a1b74a77-581 running) → design.md
- [ ] Workstream A: roof, stands/MARS, airside, landside, phase 2, drawings (masterplan, roof, section, axo)
- [ ] Merger in the game: menu, "The airport" tab, level briefings, last-flight-out moments
- [ ] Phase 0 items 1–6, 8–11
- [ ] Final acceptance runs, screenshots, publish

### Set pieces + clear view + 3D polish (evening, user: "clouds hide the field at the perfect zoom"; "more incidents like the summit in every level"; "remove all lag")
- Clouds never sit between a high camera and the field. A high camera sees less day haze, the sky is clearer, and the grade is less milky (a80eee5, live).
- Writers' room: 5 writers (viral, thriller, satire, systems, aviation insider), 40 pitches, all in `writers-room.md`. Seven are shipped as `STORY` set pieces: ribbon and tigress (L1), kites and last ball (L2), dabbawalas (L3), WhatsApp merge and trophy (L4).
- Engine: `startStory` / `storyTick`, `cinema()` (a generic cinematic queue), `guard(lines, who)` with any character, `vipBanner(..., icons)`, `takeRunways`, `specialArr`, `storyCard`, and `MARKS` emoji on the 2D map and in the 3D overlay. Each story can add a debrief `lesson`.
- Sim hooks: `FX` (slower changeovers, pushback freeze or slowdown), `r.sepK/sepUntil`, `r.kiteUntil`, and open-ended blocks (`open:true`).
- The expert bot now treats closures on the bank chart as lost capacity. L1 has its own star lines (otp3 86, cx3 90) for the opening-day surprises.
- 3D polish (branch 3d-polish, merged):
  - shader prewarm (storm-onset hitch 617 ms to 183 ms or less) and earlier, smoother quality steps;
  - a cheaper storm, runway readability, the halo fix and storm draw order;
  - the haboob wall at 1.9 km, storm light, wet pavement, distant clouds for low cameras, ground detail and reflective skylights.

### Level 4 v2: the Delhi summit, live, and the evening rush (branch l4v2)
- Diagnosis: only 18 slots for ~36 delegations (two SPG runways 75 s apart minus the big-three windows), so half never spawned; only 6 had cinematics; a queued cinematic played after its aircraft had landed (or was skipped); "all three at once" landed three in 16 s with one camera.
- The summit is a running order (`DELEG`, `RUN`, `sumPlan`): 50 aircraft from 38 delegations plus Mexico (commercial, in the stack). Each item is laid out in real seconds around its touchdown so calls, lower-thirds, banners and shots never overlap; a runway takes a landing at most every 60 sim-s. While they land the clock runs at 0.3x (`PACE`, `SUMP=6`), so voice and pictures stay in sync; the speed buttons dim and say why.
- Every delegation: a pilot call in its own accent via `say()`, the lower-third (`#delegLT`: flag, aircraft, runway, ON FINAL/LANDED, the quote, the previous delegation) and the counter (`#delegChip`). Ceremonies (announcer, then a cinematic of the landing): the US motorcade C-17s, UAE A380, Japan (both 777s, two shots), China, Germany, Russia (An-124, then both Il-96s in two shots, `music('rasputin')` over the three and faded before anything else), UK, Saudi, France, Korea, and Air Force One (announcer, US call, tower, then the SPG takes 27L as well: "The spare aircraft needs a spare runway"). "All three at once" (`trio`) lands China/Russia/US together on 27R/27C/27L in one wide shot; then the An-124 and the second Il-96, then the spare 747.
- SPG: `spgStaged` (from vinfra) returns 27L, 27C, 27R; finale after a 4 s pause with 1.8/2.3 s gaps. Lines that can't start on time are dropped; a stalled clip is cut by a watchdog.
- Evening (`STORY.eve4`): every airline departure is held at its gate through the summit (`HOLDDEP`, shown on the bank chart at its release) and all release with the staged return; support aircraft leave empty from the VIP apron (REACH 1/2, the An-124, EMIRATES 2, SAUDI 2/3, AIR CHINA 2, the press charter); family photo, red carpet, stack-empty beats. LEN 12200 (about 70 game-minutes after the finale), `evening` rate shaping, `lateDeps` (late departures are towed to a stand an hour before instead of being dropped at the start).
- Generic: `LV.windDown` ends the level once every departure with std <= LEN is airborne (cap LEN+1800), with "Last departures: N to go"; cinema `o.until` (sim-time shots), forced shots keep the camera to return to, stale queued shots are dropped; `say(..,{valid})`; `guard(..,{gap,gaps,valid})`; cinematics no longer un-pause; HUB.ff ages real-time cinematics and clears the voice queue; NOTAM fuel (+25 min, planned diversions instead of MAYDAY); water-salute close-up (`archView`, Trophy One slows to a taxi through the arch).
- Voice: `voice/lines/l4.json`, 84 lines (generated from the game by HUB.voiceL4()), not yet rendered (voice2 has no manifest pipeline yet).
- Balance (target/starsAt/EXPERT[4]) moved to the balance agent.
### Level 3 v2 (branch l3v2): longer shift, a summit that matches the ground, a visible wedding, no SPG in the crash
- Timeline (len 9300, 14:00-16:35, `windDown:true` for the shared end logic, wave `phase:3000`, `taper` on arrivals 8300-8900 and departures 8500-9200): dabbawalas 1500, GPS 2100, summit 3000 (four landings E+200..E+680, handshake, then the synced SPG return), medical 4700, wedding 5100 (40 jets from 5400, muhurat about 6535), fog 6600-7500 (collision about 6850 if the chain completes), evening/recovery beats 7700, wind-down.
- Summit (L3 only; `SUMT`, `startSummit`, `vipCine`, `summitTick`): titles only. Air India One lands on 27L, then the An-124 and two Il-96s land on 28R. Each is announced as it turns final (SPG ceremonial `announcer` text, or `ru_announcer` for Russia) and shown landing; the last 45 s run in slow motion until the announcement has finished. music('india') plays for the PM's landing and 'rasputin' only for the three Russian approaches. Airlines cancel part of the window and flow control holds the rest, releasing them around the reopening. The red-carpet stands are the free gates nearest each exit. Then the handshake cut, the motorcade, and `spgStaged` (blocks end at its open times; it starts at the actual time). The summit holds 1x while anyone speaks; then the APP stack lines.
- Wedding: the fleet always comes (the dedicated runway prefers a DEP runway, or "fit into traffic"; the card defaults before Baraat 1 is due), with a fleet chip, cuts on jets 1/21/30 (groom + water salute)/36, music('dj'), count-driven lines and the muhurat.
- Fog/collision: the bright button is the Backtrack trap (botPick and the default stay safe); stale SPG voice is dropped. Met officer, tower supervisor (`WHO.sup`) and fire chief (`WHO.arff`) replace the SPG; the collision sting plays at impact. Departures re-route off the crashed runway. The runway desk shows "closed · accident site" for any closure over 12 h, and the heavy card is honest when 27L is closed.
- Voice: `voice/lines/l3.json` (the l3voice script merged); voiced lines use say(); guard() speaks for any character whose lines all have clips.
- Checked: ff runs reach the end screen with no page errors (only the 404s for india.mp3/dj.mp3, not supplied yet). 3D shots in /tmp/zmh/l3v2/shots (summit_*, wedding_*, fog_*, crash_*). WebKit pass (wk_*): no page errors.
- Tools: /tmp/zmh/l3v2/tools/fastbot.py (synchronous expert/handler/lazy, within about 2 OTP points of run.py), probe.py (a real-time event log), cine.py and crash3.py (3D shots on events), wkst3.py.

### Money: design decisions (2026-10-19)
- Design written: `money-design.md` (one page), `design/onboarding.md` (screens), `design/eras.md` (era maths, `zm_campaign` v1, Level 5, Ship B systems from `research/money-world.md` §9), `design/hooks.md` (every hub.js / hub3d.js / build.py touch point, in wiring order W1–W5).
- Base: the "simple" draft (passive per-shift ledger, pure `money/era.js`), with the regulator, fun and eras grafts from the judge memo.
- SPV 64/16/10/10: the parent, L5 Capital: Lagrange Point Infrastructure Fund (nominee Meera Kesar), AAI, MADC. The climb to 80% is 4% per era from the year-14 board (Ship B).
- Capex in stages: 1A ₹36,000 cr / 45 MPPA at close; 1B ₹20,000 cr (yr 7), 1C ₹24,000 cr (yr 10), 1D ₹24,000 cr (yr 13); phase 2 G/H ₹14,025 cr (option, from the yr-14 board). The bank sizes debt at min(gearing × cost, PV(base-case CFADS ÷ 1.30)).
- Eras: E0 construction; E1–E4 on L1–L4 (Delhi stays at yr 14); E5–E12 on the new concession-only Level 5. Quick concession: 6 eras. Levels 1–4 are not edited.
- AERA runs silently in Ship A: hybrid till 0.30, WACC 12.89%, glide cap ₹900/850/800 per pax (the one labelled game assumption), shortfall to a receivable at WACC, volume true-up, O&M ratchet, service-quality rebate (4 airside groups + safety). Shift aero is display only (tariffK).
- Ledger: 5 revenue lines (landing, parking, UDF, Mall, hub incentive) and 5 cost lines (runways open ₹26k/h, ops jobs, SLA fuel credits, passenger care, fuel claims). It never calls SIMR and never writes sim state, so money off equals the baseline.
- Ship B, designed now from money-world: shocks with hybrid correlations and market cycle, stake pricing (EV multiple × life factor, ×1.35 control block), appeals (20% win), mid-level incidents on L5/L6 only, Level 6 "Handback", the handback asset classes and the endgame score weights.
- Open question for the user: "sixth level". It is L5 here (`LEVELS[4]`), plus L6 "Handback" in Ship B. Confirm the numbering.
- GitHub checkpoints: C1 design (this), C2 money.json fixes + era.js + node balance table, C3 ledger hooks + chip (gate green), C4 Ship A live (push), C5 Ship B.

- 2026-10-19 · Ownership at financial close confirmed by the user: parent 64%, L5 Capital 16%, AAI 10%, MADC 10%; the player can grow to 80% by buying L5 Capital out (4% an era from the year-14 board). The wiring passes `partners` 64/16/10/10 to `ZMMoney.onboarding(opts)`, so money/ui.js needs no change (its 80/10/10 is only the mock default). Review note #1 (80/10/10) is superseded by the user's decision.
- 2026-10-19 · Merged main (rename to Vikram Sarabhai International, VSI) into money and swept the money docs (ZMI→VSI, ZMIAL→VSIAL). Merged assist/money-ui d82a98f (VSI/VSIAL defaults). **For the review session:** money/ui.js's SPV step still says "owns 80%" in its copy; the user confirmed 64% at close growing to 80%, so that sentence should read from the `partners` passed in (the wiring passes 64/16/10/10).
- 2026-10-19 · **Checkpoint 1: research, design, BIAL-calibrated model.**
  - `tools/concession_model.py` is finished from the WIP. Every audit finding (A1–F3) is fixed or stated as left, in `design/finance.md` §8.
  - Results: the expert's worst year is 1.16 (amber at 1C/1D, from AERA's 13.9% carry, not the debt's shape), then it recovers to 2.3+, with an IRR of 13.5%. Bad play and lazy play are both taken over under the two-era rule (years 13 and 10).
  - The Delhi card gives −0.30 to 0.23 on the expert's debt.
  - `money-design.md` is rewritten: "BIAL, scaled", what the player sees (three numbers; two or three decisions an era; no true-up, RAB, WACC or sculpting as inputs), the side-by-side and DSCR-by-era tables. `design/finance.md` is new.
  - The PARAMS numbers are moved to new `money.json` keys.

## 2026-10-19 — Year-60 handback screen (branch handback)
| Item | Status |
|---|---|
| `ZMMoney.handback(opts)` in money/ui.js (new code and an `@hb` CSS block only) | done |
| Harness `money/test_handback.html` and `?moneymock=handback` | done |
| WebKit shots at 1440×900 and 1280×800, with real fonts asserted | done: /tmp/zmh/paper/handback_*.png |
| Not wired: the economy must call it at year 60 with the real numbers | open (hub.js lane) |

The certificate reuses the duty paper, ticks, signature pad, seal and stamp from the deal desk. The day-one signature is trimmed to its ink so both hands sit at the same size. Found while doing this: `.zmm-sheet p` (the old dark-sheet style) greys out and shrinks the paragraphs on every `.zdk-note` slip, including onboarding's. It is fixed for the handback slip only; the ui.js owner should add `.zdk .zdk-note p{color:#26292c;font-size:16.5px}`.
- 2026-10-19 capex recalibration (branch capex): VSI capex Rs 2,00,000 cr to 260 MPPA (1A 60,000 lean / 85,000 big; 1B 32,000; 1C 38,000; 1D 38,000; P2 32,000), peers Istanbul and Al Maktoum in money.json; expert lowest DSCR 1.14 (year 11), IRR 12.4 percent; bad and lazy taken over in year 13 by the two-era rule; VSI must charge about Rs 1,500 a passenger against Bengaluru's 606 and Delhi's 379.

## 2026-10-19 capex decisions (lane C)
| Item | Status |
|---|---|
| ₹2,00,000 cr kept; Istanbul caveat kept; peer line in money-design.md | done |
| Lender base-case dip (1.18, years 17 and 20) | fixed at the cause: stages sculpted on the same pass (`Tranche.ds_at`); base case ≥ 1.20 every year |
| Airport City (`airport_city` in money.json, model scenario rows, screen text) | done; expert 12.7% (12.8% at 11% land), not 14–15% |
| 14–15% target | not met honestly: needs ~₹30 cr/acre/yr licence. Needs the user's call |
| design/finance.md §4–6 tables | regenerated; §7 prose not touched |
| money-design.md side-by-side year table | not refreshed (rows from year 17 shift slightly: phase 2 now 80% geared) |
| Merge origin/assist/capex-ui | not done in this lane (timebox) |

## 2026-10-19 — Checkpoint 3: era.js integrated, money-on concession through era 2 (branch money)
| Item | Status |
|---|---|
| Merge `origin/era` (era.js, era_test.js) | done, clean |
| Stand-in `ERA_STUB` removed; `CAMP` uses `window.VSIEra` fed `MONEY_DATA`; the Concession tab says "not available" if either is missing | done |
| `VSIEra.isOver` checked before every shift (resume or next era) → the end page, never another shift | done |
| era.js caught up with the capex-lane model (it was ported before it): `Tranche.ds_at` stage sculpting, the 1e-3 sizing margin, phase 2 built on money.json's plan (years 15–16, open 17), expert terms at 75% gearing in the test | done: `node tools/era_test.js` ALL PASS, every era exact vs Python (expert 1.23/1.25/1.14/1.14/2.02/1.61/1.47/1.45, then repaid, 12.5%; bad and lazy: banks take control in year 13) |
| Board minutes numbered and dated for the era they precede ("before era 2 (2033–2035), in year 8") | done (era.js `boardOptions`) |
| "Pays for itself in about —/Immediate/Pays back…" on board items | fixed: era.js passes no `payback` for those three |
| Zero lines in the era books (₹0.0 L tax or penalties) | hidden |
| The State's loan in the deal desk's agreement line | hub.js passes `stateLoanCr` = cost − debt − equity (0 for phase 1 on these numbers) |
| build.md §9 Money (formulas, money.json, the loop, how to tune); design/hooks.md says `VSIEra` | done |

**Money-off gate (expert fastbot, 2 at a time, nice -n 10):** L1 124/89 ★★★, L2 238/94 ★★★, L3 480/72 ★★★, L4 744/80 ★★★, 0 errors (baseline 123/88, 238/94, 480/72, 744/80; L1 ±1 is the known run-to-run noise). Money-on L1 fastbot: 123/88 ★★★, identical to money off.

**Money-on concession run** (`/tmp/zmwire/cp3/camp3.py`, log `/tmp/zmwire/cp3/log.txt`, shots in `/tmp/zmwire/cp3/`): the deal desk filled by hand (Meridian Infra, Asha Rao; bid 15%, 70% asked, banks lend ₹36,303 cr of ₹60,000 cr), signature drawn, EXECUTED → era 1 on Level 1 → books → board (accept AERA; dividend ruler at ₹0 because cash in hand is ₹0) → era 2 on Level 2 → books → board → era 3 started on Level 3.
- Era 1: shift ₹1.2 cr; amber, ₹119 earned for every ₹100 due (2030); stake 64% worth ₹9,067 cr. (An earlier run with a 3★ shift: green at ₹123, stake ₹11,770 cr. Good ops = good money.)
- Era 2: shift ₹2.4 cr; amber, ₹112 for every ₹100 due (2035); stake worth ₹37,203 cr; debt ₹1,01,381 cr.
- Jargon scan of the rendered page at 16 stages (menu, every deal-desk document, mid-shift chip, P&L tab, score sheets, books, minutes): none of DSCR, RAB, WACC, true-up, EBITDA, IRR, SLA, UDF, covenant, step-in.
- WebKit smoke (`/tmp/zmwire/cp3/wk.py`): quick play money off, chip hidden; a handler-bot concession shift (1★) → red, ₹95 for every ₹100 due, stake worth ₹0 → board → era 2 on Level 2; 0 errors.

**Open (for balance / the user):**
- Cash in hand is ₹0 after eras 1–2 even when green, so the dividend and prepay rulers are at ₹0 and the board's real decisions are the AERA appeal and "promise the banks fresh money". Check `payoutShare`/cash sweep at balance.
- The deal desk shows "Your odds 22%" at the default 15% bid, then the player wins anyway.
- The term sheet: ₹36,303 cr loan + ₹24,900 cr shareholders = ₹61,203 cr against a ₹60,000 cr project cost (era.js counts interest during construction and inflation; the desk prints today's cost).
- The era-1 warning's "why" names the opening cost even when the shift was 2★; the ops reason is added only for a negative growth bonus or above-base disruption.
- Airport City and a late phase 1 (`airport_city`, `delay` in the model) are not in era.js (Ship B).
- An income-statement "moments" list shows at most 3 of the sentences.

**For the review session (money/ui.js, not edited here):**
- The board minutes show the investments' `why` text; fine. No banned words were found on any rendered screen in this run, including the board minutes (the old "DSCR is below the covenant" board copy is no longer reached).
- Money amounts that round to zero print as "₹0.0 L" (e.g. Cash in hand); "₹0" would read better.

## 2026-10-19 — Era engine follow-up: recalibrated close, lenders, construction years, Airport City, handback (branch money, lane W)
| Step | What changed | Status |
|---|---|---|
| 1. Recalibrated model | era.js fallback stages are money.json's (1A ₹60,000 lean / ₹85,000 big, 1B 32/16k, 1C/1D 38k, P2 32k); `phase1Options()` from `capex.stages`; hub.js passes `capexCr` and `phase1.options[].capexCr`. The old stand-in (`CAMP.close`, which priced the State's loan as cost − debt − equity on the lean cost) is gone. `Tranche.ds_at`, the sizing fix and phase 2's plan were already ported (checkpoint 3) | done |
| 2. previewClose | sized per phase 1, State loan (the desk's `stateLoan` was ignored before: now read) and lender; returns debt/equity/parent/stateLoan in today's money so they add up to the price on the agreement, and the note names the full bill (inflation and interest while building). Lenders: banks 9.5%/14 yrs; dollar bonds 7.5% with a 15% rupee fall in year 12; infrastructure bank 10%/20 yrs repaid over the whole term (`finance.lenders`). `lenders` is passed to the desk | done |
| 3. Board | Airport City from the era-3 board (`land:{earnCr, aeraCr}`, `opens`), `partners`, `founder`, `year`, `stakeValueCr`, `aera.acceptText/orderNo`, `dividend.lastCr/blocked/reason`, `prepay.savesPct`, `pile` | done |
| 4. Construction | `constructionOpts/applyConstruction/needsConstruction`; monsoon (pay ₹600 cr / slip 4 months), steel overrun (pay ₹3,000 cr / slip 8 months), trials (full ₹400 cr / short: rough first year), `game.construction_events`. hub.js `CAMP.build()` calls `ZMMoney.construction` if present, else builds as planned; "Not now" saves; Continue resumes mid-build | done (screen is agent S's) |
| 5. Handback | `handbackOpts` → `ZMMoney.handback` at year 60 (guarded), after `endOpts` (the old closing statement) | done |
| 6. Tests | era_test Parts A2 (Airport City) and A3 (12-month slip) added; ALL PASS | done |

**era_test vs `python3 tools/concession_model.py vsi`** (worst year of loan cover per era, E1–E4 … ending, return):
| Run | era.js | python |
|---|---|---|
| EXPERT | 1.23 / 1.25 / 1.14 / 1.14 … repaid, 12.5% | same |
| EXPERT, Airport City | 1.23 / 1.25 / 1.14 / 1.14 / 2.05 / 1.71 / 1.58 / 1.57, 12.7% | same |
| BAD (± Airport City) | 1.09 / 0.98 / 0.89, banks year 13 | same |
| LAZY (± Airport City) | 1.04 / 0.97 / 0.83, banks year 13 | same |
| EXPERT, 12 months late (monsoon + steel slips) | 0.00 / 1.25 / 1.07 / 1.08, top-up ₹1,873 cr, 11.9% | same |

The construction choices are a real trade-off on the expert's return: none 12.45%, monsoon pay 12.40 / slip 12.38, steel pay 12.25 / slip 12.32 (but year 5 at ₹7 for every ₹100 due), both slips 11.93, short trials 12.37. Lenders on the expert: banks 12.5%, dollar bonds 13.1% (eras 3–4 fall to ₹104–106 after the rupee falls), infrastructure bank 13.0% (eras 2–4 at ₹173/141/127): the banks are the weakest choice; a balance call for the user.

**Open:** Python has no lenders yet (era.js only; the test checks them for plain words, not against the model). A slip under 12 months is a part-year opening in era.js only (the model has whole years). Eras 5–12 still play Level 4.

**Money-off gate (expert fastbot, one at a time, nice -n 10):**
| Level | Result | Baseline | Stars | Errors |
|---|---|---|---|---|
| L1 | 123/88 | 123/88 | ★★★ | 0 |
| L2 | 234/93 | 234/93 | ★★★ | 0 |
| L3 | 480/74, rerun 480/73 | 480/72 | ★★★ | 0 |
| L4 | 744/80 | 744/80 | ★★★ | 0 |

L3's on-time figure moves by 1–2 points from run to run: the previous commit (6883a78, before this lane) also gives 480/73 on the same bot, so it is not from this change (quick play never reaches era.js or CAMP). Browser smoke (`/tmp/zmw/smoke.py`): the desk's agreement reads "Phase 1 (45 million passengers a year) costs ₹60,000 cr: ₹30,938 cr from Indian banks, ₹7,843 cr as an interest-free loan from the State, and ₹21,220 cr from shareholders"; no ₹56,000 / ₹36,960 anywhere; signing with no construction screen in this build goes straight to era 1 on Level 1; 0 page errors.

## Chapter 5, lane A (hub.js), branch ch5-hub
Works: `?chapter5[=lean|big][&radar=bought][&choice=three|london|decline][&brief=0]` and `HUB.startChapter5(plan, hooks)`; `CH5_LEVEL` data entry (Level 3 airfield, feeder bank then international bank); the late Lucknow pair (380 for London) is deterministic, `HUB.ch5.answer('hold'|'go')`; hold saves them, go loses them ("380 missed · Doha wins them"); connection floaters only (no landing/take-off floaters in Chapter 5, fees still booked); `ZMMoney.setConnections`; the paper-trail tag via `ZMMoney.tag(x,y,doc,line)` handle, moved every frame (canvas stand-in without ui.js); the 2D connection stream (white dots walk gate → Mall → international gate; made fade in sign yellow; missed turn red and drift to a "◀ DOHA" label). Screenshot /tmp/zmh/ch5/hub_stream.png.
Open: the two plan tags at the international pier and the stands overlap on the map (anchor offsets); the stream is 2D only (3D shows the floaters and tags); not yet run against lane B's ui.js or lane C's era.js (both absent on money at merge time, so the TODO stubs CH5_STUB / canvas tag ran); the hold call is Chapter 5's own 'hubhold' card, not the generic f.cnxAsked card (generic cards are off in Chapter 5).
