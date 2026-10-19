# Build plan: from Chapter 5 to the full flight (design/build-plan.md)

The goal is to reach **one complete play-through (about 105 minutes, in three acts) as soon as possible**, then deepen it. Every chapter is stubbed first: a front page, a decision, an engine-run shift and a bill. Real shifts replace the stubs lane by lane.

Quick play (Levels 1–4) never changes. The **money-off gate** runs after every merge.

---

## 1. Lanes and file ownership (one writer per file)

| Lane | Owns (only writer) | Builds |
|---|---|---|
| **E: engine** | `money/era.js`, `money.json`, `tools/era_test.js` | the names in design/chapters.md §0 (Narmada Air → Sutradhar Air, Skyward → Haversine Airways; Airport City shows as Zero Mile District; the id `airport_city` stays), then `VSIEra.ch3/ch4/ch6/ch7` in the `ch5` shape; `chapter(state)`; `bridge(state, n)`; the `s.decisions[]` log; `VSIEra.debrief.*` (benchmarks, the attribution with its Worker steps, the profile, the Thiel questions, the papers); the acceptance tests in §3 |
| **U: paper screens** | `money/ui.js`, `money/DESIGN.md`, `money/CONTRACT.md` | `ZMMoney.minutes` (Ch7), `ZMMoney.letter` (Ch6), `ZMMoney.debrief` (4 pages), the save file card (design/chapters.md and the user's save brief), and tags as margin pins that never cover a runway or the terminal |
| **H: hub and flow** | `hub.js`, `build.py` | `HUB.startChapter(n, plan, hooks)` and the `CHF` registry (generalising `CH5F`); `CH3_LEVEL`, `CH4_LEVEL`, `CH6_LEVEL`, `CH7_LEVEL` as data; incident firing from `plan.incidents` with `cause`; the attribution Worker; the Concession tab's chapter flow and save |
| **R: review** | nothing (read-only) | runs the gate, plays the chapter flows in a browser, screenshots at 1440×900 with real fonts, scans for jargon, and runs the §8 review |

Lanes E, U and H run **in parallel**. Each merges to `money` the moment its piece passes, and the gate runs after each merge.

**Merge order inside a stage:** E → U → H. The engine data comes first, then the screens that show it, then the flow that drives both.

---

## 2. The order that reaches a full run-through soonest

| Stage | What | Lanes | Time (realistic) | Done when |
|---|---|---|---|---|
| **0 · Skeleton** | `CHF` runs Chapters 1→7 and the debrief in order, on the player's own save. Chapters 3, 4, 6 and 7 are **stubs**: a real front page and decision, with the **shift auto-played by the engine** (an expert 2★ result, no map). Debrief pages 1 and 3 are real; page 2 uses leave-one-out; page 4 shows the first three profile lines. | E + U + H | **3 h** | A bot plays all seven chapters and the debrief end to end with no errors, in under 40 minutes of bot time. Screenshots of every screen. |
| **1 · Chapter 3 shift** | `CH3_LEVEL` (the opening bank); the belt-failure and stand-clash incidents; Plateau Air's trust | H + E | **2 h** | §3 tests for Ch3 pass |
| **1 · Chapter 4 shift** | `CH4_LEVEL` (the feeder bank, the cut-charges traffic); 2 incidents; the bird-radar tick on the bill | H + E | **2.5 h** | §3 tests for Ch4 pass |
| **1 · Chapter 6** | `ch6.pick`; the cure letter; `CH6_LEVEL` with 3 crisis variants; the step-in ending | E + U + H | **3 h** | §3 tests for Ch6 pass |
| **1 · Chapter 7** | The minutes; `CH7_LEVEL`; the Kármán Line last-mover test; handover | E + U + H | **2.5 h** | §3 tests for Ch7 pass |
| **2 · Debrief, full** | Exact Shapley in a Worker, incremental after each chapter; profile rules; Thiel questions | E + U + H | **3 h** | §3 debrief tests pass |
| **3 · Polish and time** | Real-time timing of a human-speed run; hold the act targets in §5; the §8 review; screenshots | R + all | **2 h** | The timing table in §4 holds |

Stage 0 runs alone (about 3 hours). The four Stage 1 chapters then run **in parallel** across the three lanes, two at a time per lane, about 5–6 hours of wall time. Stage 2 overlaps Stage 1's second half.

**Realistic total: about 1.5 working days** to the full, deep flight. A playable full run-through (Stage 0) arrives in about **3 hours**.

---

## 3. Acceptance tests (automated, in `tools/era_test.js` and the browser bot)

Every chapter gets a **smart vs blind** pair, like Chapter 5's hub-smart vs hub-blind, plus structural checks. The engine tests run in Node in seconds. The browser bot runs the flow and takes screenshots.

| Chapter | Smart play | Blind play | Must hold |
|---|---|---|---|
| 1 | Bid near the median, lean phase 1, Indian banks, 70% borrowed, State loan accepted | Highest bid, 75% borrowed, dollar bonds, State loan declined | Smart's year-60 return ≥ blind's + 2 points; blind's banks' light is amber or red in at least 2 eras |
| 2 | Pay the monsoon and the overrun; full trials | Accept both slips; short trials | Blind opens ≥ 12 months later; blind's Ch3 plan includes the belt-failure incident and smart's doesn't |
| 3 | Phased plan, 3★ shift | Big bang, the belt incident ignored (ops default), 1★ | Smart's Plateau Air trust ≥ 0.7 and blind's < 0.7; Ch4 option C is open for smart and shows "Plateau Air declined" for blind |
| 4 | Two feeders (or anchor), radar bought | Cut charges 30%, radar skipped | Smart's connections a day ≥ blind's × 1.5; blind's yield is lower for 10 years; blind's Ch5 front page reports Dubai's matching cut; blind's page 2 bar for "cut charges" is negative |
| 5 | (built) Three routes, hold London | Decline | The existing Ch5 asserts, plus: the feeder bank comes from the Ch4 state, not the fixture |
| 6 | Cure with own money (or L5) | Refuse | Refusal produces the step-in notice and goes straight to the debrief; smart reaches Ch7. `pick()` returns rupee for dollar bonds, airline for anchor, otherwise pandemic. |
| 7 | Zero Mile District, phase 2 committed, buy L5 to 80% | Reject all three | Smart's handover value ≥ blind's × 1.3; the last-mover test: Kármán Line's Hyderabad hub fails to take smart's banks and takes some of blind's |
| Debrief | the smart run end to end | the blind run end to end | Shapley shares plus "everything else" sum to the NPV difference within 1%; the top 2 groups hold ≥ 50% of the attribution in the smart run (the power law, checked); every profile line has evidence; no line appears without its rule; benchmarks show only sourced values |

**Structural checks on every chapter:**
- **Jargon:** zero hits in visible strings (DSCR, RAB, WACC, true-up, EBITDA, IRR, SLA, UDF, covenant, step-in, CFADS).
- **Paper trail:** every decision has at least one later tag or visible effect (design/chapters.md §4).
- **Safety calls:** no rupee shown on them.
- **Tags:** at 1440×900, no tag bounding box intersects a runway, taxiway or terminal polygon (`hub.js` geometry).
- **Choices:** at most 3 per decision.
- **Timing:** each shift plays within 2 minutes of its target at 1× (§5).
- **Save:** reload mid-chapter, and the save file card shows the right company, signature and year, and the chapter resumes.

**The whole game:** the blind run's year-60 return is at least 3 points below the smart run's (Thiel review question 5).

---

## 4. The money-off gate (after every merge)

- `python3 build.py`; then syntax-check every script in `site/index.html`.
- `node tools/era_test.js`: all chapter tests plus the debrief tests.
- **Quick play with money off:** the expert autopilot keeps **3★ on Levels 1–4**, within noise of the baseline (moves and on-time, as logged in `progress.md`). Run the gate alone, not alongside screenshot jobs. Concurrent headless runs time out.
- If any check fails, the merge is reverted before anything else lands.

---

## 5. Timing target (checked in Stage 3 with a human-speed bot: reading time per word plus decision time)

The flight is told in three acts of about 35 minutes (design/chapters.md §1).

| Segment | Target | Fails above |
|---|---|---|
| Act I: Clearance 11, Pushback 7, Takeoff 15, cliffhanger 2 | 35 min | 42 |
| Act II: Climb 15, Cruise 15, cliffhanger 2 | 32 | 38 |
| Act III: Turbulence 13, Landing 11, the Black Box 10 | 34 | 40 |
| Saving, loading, the years-later pages | 4 | 6 |
| Total | **≈ 105** | 120 |

Each shift's target: Takeoff, Climb and Cruise 10 min; Turbulence 8; Landing 5. A shift fails if it runs more than 2 minutes over its target at 1×.

## 6. Risks and how they're handled

| Risk | Handling |
|---|---|
| hub.js gets two writers | Only lane H edits it. Others request changes in `progress.md` → "H requests". |
| Shifts run long | `plan.window` caps each chapter's level to one bank. The 9-minute test fails the build. |
| The attribution is slow on a weak laptop | Worker plus incremental coalitions; the leave-one-out fallback is labelled honestly. |
| The fixture leaks into a real save | Fixtures are only for `?chapterN=` test URLs, and the save writer rejects a state without a signature. |
| Unsourced facts on cards | Cards come only from `research/history-cards.md`. Chapter 6's rupee variant shows no card until one is sourced. |
