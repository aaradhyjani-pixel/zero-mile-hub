> **UI calls:** every money display goes through `window.ZMMoney` (`money/ui.js`, see `money/CONTRACT.md`): `enable`, `setDay`, `float` (never for medical/fuel/MAYDAY), `setPL`, `onboarding` (wire `previewBid`/`previewClose` to `money/era.js`), `boardMeeting`, `incomeStatement`, `config`. Merge `ZMMoney.terms` into `GL`.

# Hooks: every code touch point for the money wiring

This file is for **one** wiring agent working on `hub.js`, `hub3d.js`, `build.py`, `hub-body.html` and `hub-head.html`. Do the steps in order, run the gate check after each step, and make a small commit after each step.

Line numbers are from commit `940f114` and are approximate: search for the quoted code, not the number.

The maths is in `design/eras.md`, the screens are in `design/onboarding.md`, and the formulas are in `money-design.md`.

---

## 0. Rules (no exceptions)

1. **Additive only.** Every hub.js edit is a guarded one-liner, `MNY&&MNY.x(...)`, or a new branch that levels 1–4 never take. Don't change the data of `LEVELS[0..3]`. Don't rename anything or delete any code path.
2. **The ledger is passive.**
   - Money code never calls `SIMR()` or `Math.random()`.
   - It never writes to `S`, to a flight object, a runway, a gate or an incident. The one exception is the documented `I.mny` display field.
   - It never changes control flow.
   - Per-flight money state lives in the ledger's own `Map` keyed by `f.id`.
3. **Safety is never for sale.** Nothing in `money/` reads-then-writes `S.safety`, and nothing calls `hitSafety` or `stars()`, except `stars()` for display.
4. **Fail closed.**
   - If `#moneyData` is missing or a `money/*.js` file was skipped by build.py, `MNY` stays `null` and every hook is a no-op. Quick play then behaves exactly as today.
   - Wrap the ledger's own internals in try/catch, so a money bug can never stop `tick()`.
5. **Gate after every step.**
   - Fast bot: all levels × expert/handler/lazy, two runs each.
   - The table must equal `research/baseline_bots.txt`: stars, moves, OTP, connections, safety, flips and incident types.
   - Run it once with the ledger on (the quick-play default) and once with `HUB.moneyOff()`.

---

## 1. Files and build

| File | Kind | Owner |
|---|---|---|
| `money/era.js` | Pure maths: `window.VSIEra` and `module.exports`. No DOM, no randomness except a seeded mulberry for Ship B. | era agent (C2) |
| `money/ledger.js` | Closure module. It reads `T`, `LV`, `S`, `RW`, `flights`, `GATES`, `SUM`, `dustNow`, `fogF`, `HOLDDEP`, `clk` and `$`, and sets `MNY`. | wiring agent |
| `money/campaign.js` | Closure module: the era loop, `zm_campaign`, migrate/bak/best. It calls `startLevel` and `menu`. | wiring agent |
| `money/board.js` | Closure module: the results, board, cure and step-in screens in `#sheet`. | wiring agent (or a UI agent after C3) |
| `money/onboarding.js` | DOM-only: `window.ZMONB`. It never touches hub.js internals. | onboarding agent (in parallel) |

### build.py changes (additive)
- Insert `/*@@MONEY@@*/` into hub.js on its own line **just before `window.HUB=`** (line ~2380). It must sit inside the closure, so the modules can see `MNY` and `startLevel`.
- Inject these files, in this order, at that marker: `money/era.js`, `money/ledger.js`, `money/campaign.js`, `money/board.js`, `money/onboarding.js`.
  - Use the same loop as the 3D modules: `node --check`, and print `SKIPPED (syntax)` on failure.
- Embed the money data next to `specData`:
  ```
  '<script type="application/json" id="moneyData">'+json.dumps(money,separators=(',',':')).replace('</','<\\/')+'</script>'
  ```

### hub.js declaration
- Next to the state declarations (line ~144, `let flights=[]…`), add: `let MNY=null;`.
- `money/ledger.js` ends with `MNY=makeLedger(JSON.parse($('#moneyData').textContent))`, inside try/catch.

---

## 2. Ledger API (`money/ledger.js`)

```
M = {on, mode:'quick'|'concession', k, nar, lines:{landing,parking,udf,mall,incentive,runway,ops,sla,care,fuel},
     raw:{landing,parking,udf},           // at k=1, for cardYield
     mallPot, pax, paxArr, paxDep, made, missed, nogateMin, log:[{t,line,amt,x,y}], spark:[], byF:Map}
MNY.reset()            // in resetState
MNY.begin(LV)          // in startLevel after buildLevel (reads LV.campaign, LV.tariffK, LV.nar)
MNY.land(f) MNY.inBlock(f) MNY.push(f) MNY.cnx(link,ok,f) MNY.lift(f,late)
MNY.hold(f,dt) MNY.ga(f) MNY.divert(f) MNY.nogate(f,dt) MNY.offload(n)
MNY.tick(dt) MNY.ops(kind) MNY.price(I) MNY.hud() MNY.drawFloats(projector) MNY.renderPnl()
MNY.close() → {lines, raw, pax, Q, dis_pp, ctrl_pm, cnx_pp, cardYield, sq, nogateMin, mayday, worst:[…], ebitda}
MNY.snapshot()  // for HUB / bots
```

### Helpers
- **`isFM()`** (force majeure) is true when any of these holds:
  - `!!SUM`;
  - `dustNow`;
  - `fogF > 0.3`;
  - `HOLDDEP && T < HOLDDEP.until`;
  - the L4 Delhi summit is live (`STO.find(o=>o.k==='delhisummit')` with its running flag; find the flag when wiring).
- **`mtow(f)`**: maps TYPES to `aero.mtow_t`:

  | Type | Maps to |
  |---|---|
  | A20N | A320neo |
  | A21N | A321neo |
  | B38M | B737MAX8 |
  | A359 | A350_900 |
  | B789 | B787_9 |
  | B788 | B787_8 |
  | A333 | A330_300 |
  | B77W | B777_300ER |
  | A388 | A380 |
  | B748 | B747_8I |
  | AT76 | ATR72 |

- **`pays(f)`**: `!f.vip` (state and VIP flights pay nothing, est.).
- **`isWide(f)`**: `f.T.code !== 'C'`.

---

## 3. Simulation hooks (`hub.js`)

| # | Where (search for) | Line | Insert | Event → money line |
|---|---|---|---|---|
| 1 | `resetState()`, after `RC.clear();SIMR=mulberry(11);` | 154 | `MNY&&MNY.reset();` | new ledger per level |
| 2 | `startLevel`, after `buildLevel(LV);` | 2311 | `S.sched=flights.filter(f=>(f.kind==='arr'&&f.eta<=LEN)\|\|(f.kind==='dep'&&f.std<=LEN)).length+flights.filter(f=>f.turn&&f.turn.std<=LEN).length;MNY&&MNY.begin(LV);` | annualisation denominator (eras.md §4) |
| 3 | `touchdown(f)`, last statement | 452–458 | `MNY&&MNY.land(f);` | **Landing**: max(8000, mtow × rate[dom/intl][narrow/wide]) × k; domestic AT76 = 0; `pays(f)`; green floater |
| 4 | `case 'dock'`, right after `f.inBlock=T;` | 497 | `MNY&&MNY.inBlock(f);` | **Mall (arrivals)**: arriving O&D pax × 0.3 × nar; +paxArr |
| 5 | `case 'at_gate'`, after `f.pushT=T;`, **before** `settleLinks(f)` (f.gate is still set) | 504 | `MNY&&MNY.push(f);` | **Parking**: max(0, pushT − inBlock − 9000 s) h × mtow × (gate.remote ? 18 : 36) × multiplier(hours) × k. Departures that started at a gate (no inBlock) use `max(T0, appear)`; skip if not known. |
| 6 | `settleLinks(f)`, in each branch: `if(ok){S.cnxMade+=l.n;MNY&&MNY.cnx(l,true,f);}else{S.cnxMiss+=l.n;MNY&&MNY.cnx(l,false,f);}` | 480 | (rewrite the ternary as an if/else with identical effect) | **Incentive** ₹250 × n if made; made n is remembered for `lift`. **Care** ₹1,900 × n if missed; red floater at the gate |
| 7 | `finish()`'s leftover-links loop, same pattern | 2327 | `MNY&&MNY.cnx(l,ok,f)` | end-of-day misses and makes |
| 8 | `depart(f)`, at the end | 465 | `MNY&&MNY.lift(f,late);` | **UDF**: depPax × (intl ? 1225 : 620) × k. **Mall (departures)**: (depPax − madeIn) × 1.7 × nar × M(late) + madeIn × 1.7 × nar × 0.75. **SLA**: if late > 15 and !isFM(): (late − 15) × burnRate(wide) (₹1,460 narrowbody / ₹3,225 widebody). depPax = f.pax − (f.offloaded ? 40 : 0). Teal floater. |
| 9 | `case 'holding'`, after `S.holdMin+=dt/60;` | 486 | `MNY&&MNY.hold(f,dt);` | **Fuel claims**: if T − f.holdSince > 300 and !isFM(): hold_cost_per_min[wake M/H/J → A320neo/B777/A380] × dt/60. Stack label and a floater every 60 s. |
| 10 | `goAround(f,why)`, at the end | 451 | `MNY&&MNY.ga(f);` | **Fuel claims**: 5 × hold cost/min (waived under isFM) |
| 11 | `divert(f,why,o)`, at the end | 533 | `MNY&&MNY.divert(f);` | **Care**: pax × ₹400. The lost landing, UDF and Mall are implicit (they never happen). |
| 12 | `case 'nogate'`, at the start of the block | 495 | `MNY&&MNY.nogate(f,dt);` | **SLA**: after 300 s (`T−f.nogateSince`) and !isFM(): burnRate × dt/60. Every second goes to `nogateMin` (the service-quality group). |
| 13 | `tick(dt)`, after `runways();` | 2202 | `MNY&&MNY.tick(dt);` | **Runways open**: for each r in RW with `!r.locked&&r.mode!=='OFF'`: 26000 × dt/3600. Sparkline sample every 60 sim-s. |
| 14 | `opsSpawn`, before each of its 3 `return true` (tug, birds, fod) | 543–564 | `MNY&&MNY.ops('tug'\|'birds'\|'fod');` | **Ops teams**: tow ₹20k, patrol ₹8k, sweep ₹15k |
| 15 | `spawnInc`, heavy act "Offload and go": inside `for(const g of I.fs){g.offloaded=true;S.cnxMiss+=40;}` | 604 | append `MNY&&MNY.offload(40);` in the loop body | **Care**: 40 × ₹10,000 (`rights.denied_boarding_comp_inr.alt_within_24h`) |
| 16 | `spawnInc`, just before `S.incTypes[type]=…` | 629 | `MNY&&MNY.price(I);` | display only (§4) |

Every money value above is × P(y) in Concession only. Shift rupees are in 2025 prices. Quick play uses k = 1 and P = 1.

### Not hooked, by design
- `setMode`: no changeover cost. It is added in Step 5 only if the spender ends within noise of the expert.
- `closeRw`: no closure penalties; closures cost money through their consequences.
- `hitSafety`, `fuelCheck`: no money on safety. MAYDAY is read at `close()` as `flights.some(f=>f.mayday)`.

---

## 4. UI hooks

| # | Where | Line | Change |
|---|---|---|---|
| U1 | `hub-body.html` `#kpis` | 17 | Append `<div class="kpi" id="kCash" title="…"><div class="k">Today</div><div class="v">—</div><canvas class="spark" width="64" height="18"></canvas><div class="sub"></div></div>` |
| U2 | `hud()`, at the end | 2164 | `MNY&&MNY.hud();` writes the chip (the existing `kpi()` helper, plus the spark canvas) |
| U3 | 2D `draw()`, after `drawFloats(q=>({X:sx(q.x),Y:sy(q.y)}));` | 2077 | `MNY&&MNY.drawFloats(q=>({X:sx(q.x),Y:sy(q.y)}));` |
| U4 | `hub3d.js`, after `drawFloats(q=>proj(q.x,q.y,q.alt*AIR_K+40));` | 599 | `MNY&&MNY.drawFloats(q=>proj(q.x,q.y,q.alt*AIR_K+40));` (floaters show in Concession only) |
| U5 | `renderInc()` template, after the `.acts` div | 1857 | `${I.mny?`<div class="mny">${I.mny.map(m=>`<span class="${m.tone}">${m.txt}</span>`).join('')}</div>`:''}` |
| U6 | `renderRw()` / `rwStatus()` | 2139 / 2144 | In Concession, append `<span class="cost">₹26k/h</span>` to each row's `.st` |
| U7 | `previewOn(b,r)`, `onmouseenter` | 2138 | `MNY&&MNY.preview(r,b.dataset.m)` adds a line under the desk ("OFF: saves ₹26k/h · ≈ ₹53 L/h at risk") |
| U8 | `hub-body.html` `.tabbar` | 49–56 | Add `<button data-tab="pnl" hidden>P&L</button>` and `<div class="tabbody" id="tabPnl" hidden></div>` |
| U9 | tab switch handler | 2192 | Add `;$('#tabPnl').hidden=b.dataset.tab!=='pnl'` (same pattern). `MNY.begin` sets the button's `hidden` to `!LV.campaign`. |
| U10 | `GL` (coach glossary) | 236 | Add the terms in onboarding.md §2. The Terms tab picks them up by itself (line 300). |
| U11 | `hub-head.html` `:root` | 16–35 | The new tokens from onboarding.md §0, plus `.kpi .spark`, `.inc .mny`, `.rw .cost` and `#onb` styles |

### `MNY.price(I)`
This sets `I.mny`, Concession only.
- **Rates:** every estimate uses the same rates as the hooks.
  - avgRev = shift revenue so far ÷ movements so far, or the card estimate before 10 movements.
  - closureCost(r, min) = r's moves per minute (`capNow`) × min × (₹4,125 × an expected 4 minutes of holding for arrivals, or ₹1,460 × 4 for departures).
- **By incident type:**

| Type | Price shown |
|---|---|
| connex | Hold: "saves n × (1,900 + 1.7·nar·0.75 + 250)"; SLA ≈ max(0, (std + 600 − now)/60 − 15) × burn. Go now: the negative of the same saving. |
| heavy | Offload: −(40 × 10,000 + 40 × (UDF + 1.7·nar)) per jet. Taxi: ≈ ₹0. |
| nogate | Swing: ₹0. Wait: "₹1,460/min after 5 min". |
| strike | Inspect: −closureCost(r, 4). Keep going: "1 in 3: −closureCost(r, 15)", tagged `tone:'risk'` ("safety risk"). |
| lights | Repair: −closureCost(r, 6). Keep open: −0.6 × closureCost(r, minutes to the next changeover, est. 20). |
| lane | Clear: 4 min × departures due × ₹1,460. Work around: 3 min × departures due × ₹1,460. |
| vvip | Each runway: −closureCost(r, 6). |
| shear | Keep landing: "more go-arounds × ₹20k", tagged risk. To DEP: −closureCost(r, storm minutes) × 0.5. |
| medical, fuel, summit, any `st_` | `I.mny=[{txt:'Safety call: no price shown',tone:'safe'}]` for medical and fuel; nothing for the rest |

---

## 5. Campaign hooks

| # | Where | Line | Change |
|---|---|---|---|
| C1 | `function startLevel(n)` | 2305 | Signature `startLevel(n,patch)`. The first line becomes `LV=Object.assign({},LEVELS[n-1],patch\|\|{});`. Quick play passes no patch, so nothing changes. |
| C2 | `startLevel`, after `GATES.forEach(g=>{g.open=…})` | 2310 | Phase-2 toggle: `GATES.forEach(g=>{if(!g.p2)return;const on=!!LV.phase2;g.remote=!on;g.bridge=on;g.conc=on?g.p2:'REM';if(on)g.open=true;});` |
| C2 (3D note) | `3d/aircraft.js:1154` reads `g.remote` live, so stairs and buses follow the toggle. `3d/terminal.js:532` builds bridges once and skips them, because `pierById['G']` is undefined. | — | The 3D satellites are Ship B; no 3D change in Ship A. |
| C3 | boot, after the `SPEC.remote` push | 62 | `GATES.forEach(g=>{if(g.remote&&g.x>=560)g.p2=g.y<0?'G':'H';});` (160 stands) |
| C4 | `settleLinks` | 480 | Inside the `ok` sum: `+(l.arr.gate&&l.arr.gate.p2&&LV.phase2?120:0)`. With phase 2 off, `remote` is still true, so the +300 applies as today. |
| C5 | `drawAirfield` | 1972 | If `LV.phase2`, stroke the `SPEC.phase2.satellites[].outline` paths (Path2D) in the concourse style |
| C6 | `buildLevel` | 162 | `mulberry(1000+(L.seed\|\|L.n)*17)` |
| C7 | `LEVELS` | after the L4 entry, line ~141 | Append the Level 5 object (eras.md §10). Ship B appends L6. |
| C8 | `EXPERT`, `NEXT_TIP` | 2256–2257 | Add `5:` entries (after Step 5) |
| C9 | `finish()` | 2322–2345 | (a) `const money=MNY?MNY.close():null;` after the leftover-links loop. (b) `const next=LEVELS[LV.n]&&!LEVELS[LV.n].concessionOnly&&!LV.campaign?LEVELS[LV.n]:null;`, and the "Before level N" label uses the same test. (c) Star note: add `LV.n===5?' This level allows for the weather.'`. (d) After `.score`, add `${money?MNY.statementHtml(money,LV.campaign):''}`. (e) If `LV.campaign`: don't render `#again`/`#nextL`; render `<button class="go" id="books">Close the books for years a–b ›</button>`, wired to `CAMPAIGN.afterShift(window.__hubResult)`. (f) `__hubResult` gains `money` and `sched:S.sched`. (g) Quick play: if this level's EBITDA beats `zm_money_best[L]`, store it. `zm_stars` logic is unchanged. |
| C10 | `menu()` | 2351 | `LEVELS.filter(L=>!L.concessionOnly).map(...)`. Add a Concession card above `.levels`: "Run Zero Mile for 60 years", with Continue (if `zm_campaign` exists) and New campaign (with a confirm step), wired to `CAMPAIGN.open()` |
| C11 | `window.HUB` | 2380 | Add `money:()=>MNY&&MNY.snapshot()`, `moneyOff:()=>{if(MNY)MNY.on=false;}`, `campaign:()=>CAMPAIGN&&CAMPAIGN.state()`, `era:()=>window.VSIEra`. `startLevel` already passes `patch` through. |

### `CAMPAIGN` (`money/campaign.js`)
- `open()`, `newGame()`, `resume()`, `afterShift(res)`, `state()`, `save()`, `load()`, `migrate(o)`.
- Every screen renders into `#sheet` through `board.js`. `#overlay` is shown and hidden exactly as `menu()` does it.

---

## 6. Bots and balance (Step 5 hooks)

- **`run.py`:** two new modes. They change only the bot's runway policy, never the game.
  - **`miser`**: the expert, but with the fewest runways open (OFF whenever forecast demand allows) and never "Clear it now" or "Inspect".
  - **`spender`**: the expert, but every unlocked runway is always on, and it always takes the closure options.
- **Output:** each run prints `MONEY {json of HUB.money()}` next to `RESULT`. `run_all.py` adds an EBITDA column.
- **Quick concession in node:** `node tools/concession.js <bot>`. It feeds `VSIEra.quickRun(policy, shiftRatios[L])` with the ratios measured from the bot runs, and prints the DSCR per era, IRR and step-in.
  - A browser check drives the same path through `HUB.campaign()` once per ship.
- **Gate commands:**
  - The fast bot from the baseline (`/tmp/zmh/l3v2/tools/fastbot.py`) as the main measure, twice.
  - The real-time `run_all.py` as the secondary check.
  - `shots.py` for the money screens in 2D and 3D.

---

## 7. Wiring order (one agent, one commit per step)

| Step | What | Gate |
|---|---|---|
| W1 | build.py markers, `moneyData`, `let MNY=null`, empty `ledger.js` | Bots identical |
| W2 | Hooks 1–16 and the chip (U1, U2) in quick play | Bots identical, with the ledger on and off. Sanity check: an L1 shift earns about ₹1.1–1.3 cr gross. |
| W3 | Floaters, calls, P&L, desk, income statement (U3–U11, C9d), Concession-gated | No console errors in 2D or 3D. Screenshots. |
| W4 | `startLevel(n,patch)`, phase 2 (C1–C6), L5 (C7, C8), `finish`/`menu` guards (C9, C10), HUB (C11) | Bots on L1–L4 identical. L5 runs end to end with the expert, handler and lazy bots. |
| W5 | `campaign.js` + `board.js` + `era.js` integration + onboarding mount | A full quick concession by hand and by bot. Resume works. A corrupted save restores from `_bak`. |
| — | Push at C4 (Ship A live), after the gate and screenshot QA | — |
