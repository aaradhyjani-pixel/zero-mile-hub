# Eras: the loop, the maths, the save, Level 5, and the Ship B systems

This is the reference for `money/era.js` (pure maths, which also runs in node), `money/campaign.js` (the loop and the save) and `money/board.js` (the screens). The sources are `money.json`, `research/money.md` and `research/money-world.md`.
- Keys are written `section.key`.
- **(est.)** marks a game estimate, which must carry `estimate:true` in money.json.
- **(new)** marks a key that does not exist yet; see the last section.

---

## 1. Clock, eras and control periods

**Clock.** Year 1 is 2026, the year of financial close, so calendar year = 2025 + y. Year 60 is 2085.

**Prices.** Every money.json rupee is in 2025-26 prices. The price index is P(y) = 1.04^(y−1), from `game.cpi` (new, est.; the RBI's 4% target). Debt is nominal and is never indexed.

### Full concession: 12 eras plus construction

| Era | Years | Shift played | Traffic in force |
|---|---|---|---|
| E0 | 1–4 | none (onboarding S1–S6) | construction |
| E1 | 5–7 | L1 | BLR from year 5 |
| E2 | 8–10 | L2 | + AMD and HYD from year 8 |
| E3 | 11–13 | L3 | + BOM from year 11 |
| E4 | 14–18 | L4 | + DEL from year 14 |
| E5–E11 | 19–23, 24–28, 29–33, 34–38, 39–43, 44–48, 49–53 | Level 5 with the era patch | full hub, capped by capacity |
| E12 | 54–60 (7 years) | Level 5 (Level 6 "Handback" in Ship B) | then handback |

### Quick concession: 6 eras

| Era | Years | Shift |
|---|---|---|
| Q1 | 5–7 | L1 |
| Q2 | 8–10 | L2 |
| Q3 | 11–13 | L3 |
| Q4 | 14–25 | L4 |
| Q5 | 26–43 | L5 |
| Q6 | 44–60 | L5 (L6 in Ship B) |

- Step-in comes after **one** era below 1.0, because quick eras are long.
- A quick concession is 6 shifts plus 6 boards, about 60–70 minutes.

**AERA control periods.** CP1 runs years 5–9, CP2 10–14, CP3 15–19, and so on up to CP11 (55–59), with CP12 as a 1-year stub in year 60.
- They are set at the start of each control-period year inside era.js, whatever the era.
- In Ship A the order is silent. In Ship B, the board shows every order issued since the last board.

---

## 2. The loop (`money/campaign.js`)

```
menu → Concession card → [Continue | New campaign (confirm)]
New: ZMONB.run() → ZMERA.close(camp) → phase 'board' (E1 board: 1B notice, "opening day")
loop per era e:
  board(e)    → decisions → save → phase 'shift'
  shift(e)    → startLevel(L(e), ZMERA.eraPatch(camp,e))  (the existing engine, no replays)
  finish()    → __hubResult.money → "Close the books" → ZMERA.resolve(camp, result) → save → phase 'results'
  results(e)  → if cure needed → phase 'cure' (inject | step-in → 'terminated')
             → if e is last → phase 'done' (end line; Ship B: handback) else board(e+1)
```

- **Phases:** `'onboard' | 'board' | 'shift' | 'results' | 'cure' | 'done' | 'terminated'`.
- **Resume:** resuming in `'shift'` restarts that era's shift with the same patch and seed.
- **Replays:** a campaign shift has no Replay button. A 0★ shift still counts; it takes the 0★ growth penalty and the full service-quality rebate.
- **Results first:** each board opens with the results of the era just played. The dividend decided at board e+1 pays out era e's cash.

---

## 3. Demand, capacity and passengers

### Design-day movements
From `game.design_day_movements_by_level`: L1 837, L2 1,744, L3 2,780, L4 4,194.

These are the **whole hub's** peak day **on that level's move-in date**. That is the premise of each level. So growth compounds only from the latest move-in:

```
D(y) = DD[L(y)] × Π_{t=y_move(L)+1..y} (1 + g_t)      for y < 14   (y_move: 5, 8, 11)
D(y) = 4194     × Π_{t=15..y}         (1 + g_t)       for y ≥ 14
g_t  = world.game_traffic_growth.cagr_by_era[min(11, floor((t−1)/5))] + starBonus(era of t) + shock terms
starBonus = game.star_growth_bonus {0:−0.03, 1:−0.01, 2:+0.005, 3:+0.015}   (new, est.)
```

Here **g** is the national market growth: 7% at first, falling to 2.5%. The star bonus comes from the era's own shift, which is its sample day.

### Passengers per movement
ppm(L) = 153 × (1 − wide) + 280 × wide (`game.pax_per_movement`), with **wide** taken from LV (or the L5 patch). The values are L1 160.6, L2 165.7, L3 175.9 and L4 178.4.

### Capacity and passengers served
- Capacity is `capex.stages` in MPPA (45, 95, 150, 209) plus phase 2 (+51 → 260). Phase 2 ramps up at 55%, 85% and 100% in its first three years (`world.game_capacity.ramp`).
- **Annual passengers:** pax(y) = min(D(y) × ppm × 311, 1.1 × cap(y) × 1e6). The 311 is `game.peak_day_to_annual`; the 1.1 is `game.capacity_headroom` (new, est.).
- **Spill** = demand − served. Spill shows on the results screen; in Ship B it drives the rival airport.
- **Movements served:** M(y) = pax(y) ÷ (ppm × 311).

### Check at 7% growth, before star bonuses (model)

| Year | Demand (M pax) | Cap × 1.1 | Spill |
|---|---|---|---|
| 5 | 41.8 | 49.5 | 0 |
| 7 | 47.9 | 49.5 | 0 |
| 8 | 89.9 | 104.5 | 0 |
| 10 | 102 | 104.5 | 0 |
| 13 | 171 | 165 | 3.5% |
| 14 | 233 | 230 | 1% |
| 18 (no phase 2) | 288 | 230 | 20% |

From year 14, phase 2 is the pressing decision. After about year 20, VSI is capacity-bound and value comes from yield (the Mall maturing, service quality, efficiency), not volume. `money-world.md` §9.7 calls this the real late-game shape.

---

## 4. Annualisation (shift to year)

```
annual_line(y) = shift_line × (M(y) / S.sched) × 311 × P(y) / P(shift year)
```

- **S.sched** is set in `startLevel` right after `buildLevel`. It is the count of scheduled movements that fall inside the shift:
  - arrivals with `eta ≤ LEN`;
  - departures with `std ≤ LEN`;
  - turnarounds with `turn.std ≤ LEN`.
- **Why `S.sched` and not `LV.target`:** an expert who beats the target (744 against 720 on L4) must not inflate annual volume. Volume comes from demand and capacity; the shift supplies **ratios**.
- This replaces the text of `game.annualise`. The live chip's "at this pace" uses the same formula.

### What era.js reads from `__hubResult.money`
All per-passenger values are in 2025 ₹ at k = 1.

| Field | Meaning |
|---|---|
| `Q` | Mall realised ÷ Mall potential. Potential = every passenger spends at M = 1 and every connection is made. |
| `dis_pp` | (SLA + care + fuel claims) ÷ shift passengers |
| `ctrl_pm` | (runways open + ops teams) ÷ movements |
| `cnx_pp` | made connections ÷ shift passengers (drives the incentive) |
| `cardYield` | (landing + parking + UDF at k = 1) ÷ shift passengers |
| `sq` | `{arr, dep, cnx, nogate, subj, bonus}`, each a boolean (§6) |
| shift results | stars, safety, otp, cx, moves, `S.sched` |

---

## 5. One year in era.js (pure function, no DOM, no `Math.random`)

```
P      = 1.04^(y−1)
pax    = served(y)                                   (§3)
nar_pp = camp.fin.nar × P × (camp.kit.mall ? 1.15 : 1)   (nar in 2025 ₹, starts at nonaero.zmi_per_pax_start 250)
NAR    = pax × nar_pp × Q  +  pax × cnx_pp × 250 × P     (nonaero.hub_incentive_per_cnx, new, est.)
Aero   = Y_cp × (P / P_cp0) × pax × (1 − rebate + bonus) (Y_cp set at the CP start, §6)
Rev    = Aero + NAR
OM     = costs.opex_per_pax 199 × P × pax
CTRL   = ctrl_pm × M(y) × 311 × P
DIS    = dis_pp × pax × P × game.disruption_scale
FEE    = bid.type=='share' ? bid.v × Rev : bid.v × P × (pax_dom + 2·pax_intl)   (ppf: intl pays 2×)
EBITDA = Rev − OM − CTRL − DIS − FEE
DEP    = Σ_stage stageCost / life_s,  life_s = min(30, 60 − y_commission)  (book = regulatory, simplification)
INT    = Σ_tranche balance × rate
PBT    = EBITDA − DEP − INT;  tax = 25.17% × max(0, PBT − lossCF)  (finance.tax_rate, new, est.; losses carried forward)
REN    = game.renewal_share 0.25 × DEP                    (new, est.; capitalised into RAB)
CFADS  = EBITDA − tax − REN
DS     = Σ_tranche DS_y;  DSCR = DS>0 ? CFADS/DS : ∞
```

### The waterfall
This follows `finance.waterfall`, reduced to the steps the game models:
1. O&M and the fee are already inside EBITDA. Tax comes next.
2. Senior debt service.
3. The DSRA, topped up to 6 months of next year's debt service (`finance.dsra_months`).
4. If DSCR < 1.10, a cash sweep: everything left goes to prepayment.
5. Whatever remains is **distributable cash**. It is added to `fin.cash`, and the next board decides what to do with it.

### Shortfalls
- If CFADS < DS, the gap is drawn first from the DSRA and then from `fin.cash`.
- If both are empty, the results screen opens an **immediate cure board**. This is a real payment default.

### Era DSCR
The era DSCR is the minimum annual DSCR within the era.

---

## 6. AERA, run silently in Ship A

At the first year of each control period (y0):
```
pax_fcst_y = last actual pax × Π(1 + g_market) for the CP years, capped at committed capacity
RAB_y      = RAB_open + commissioned capex + REN − regulatory depreciation (= DEP)
OMallow_y  = 199 × P × pax_fcst_y + min(ctrl_pm_lastCP, game.om_benchmark_pm) × M_fcst × 311 × P   (the ratchet, new est. benchmark)
ARR_y      = 12.89% × RAB_y + DEP_y + OMallow_y + tax_lastCP_y − 0.30 × NAR_fcst_y
need       = PV(ARR) / PV(pax_fcst)                       (levelised over the CP at WACC)
cap        = till.glide_cap {cp1: 900, cp2: 850, cp3plus: 800} × P(y0)   (new, est.: THE labelled game assumption)
Y_cp       = min(need, cap);  if need < cap: Y_cp = min(cap, need + URA_recovery_per_pax)
URA       += (need − Y_cp) × pax_fcst each year, accruing at WACC 12.89%   (the under-recovery account, i.e. the receivable)
```

### Volume true-up
At the next CP start, the URA takes Σ Y × (pax_fcst − pax_actual). This entry can be positive or negative.
- Over time, aero is **volume-neutral**: landing more aircraft doesn't earn more aero.
- In the short run the cash gap still lands on the current DSCR.
- The anchor for this is Navi Mumbai, which carried 11.32% of its ARR forward (`aero.udf_greenfield_opening_nmia`, money.md §1).

### Service quality: four objective groups and one subjective
Each group is worth 1% of ARR. The rebate is capped at 5% (`till.sq_rebate_max_of_arr`).

| Group | Measure | Fails when |
|---|---|---|
| arr | `S.arrOnTime / S.arr` | below `starLines(LV).otp2` |
| dep | `S.depOnTime / S.dep` | below `otp2` |
| cnx | `cnxMade / (made + miss)` | below `cx2` |
| nogate | the ledger's stand-wait minutes per arrival | above 3 |
| subjective | — | safety < 90, or any `f.mayday` |

- **Bonus:** +1.25% (`till.sq_incentive_max`) when arrivals and departures are both at or above `otp3`, connections are at or above `cx3`, stand-wait is no more than 1 minute per arrival, and the subjective group passes.
- **Honesty note in the glossary:** AERA's real targets are security, check-in and baggage times (`till.sq_targets`). Airside timeliness stands in for them.

### The O&M ratchet
- AERA allows only efficient costs. Spending below the allowance is yours for the whole CP. Spending above it is never recovered.
- `game.om_benchmark_pm` is the expert bot's `ctrl_pm`, measured in Step 5. This is the honest reason the spender earns less.

### Tariff factor
`tariffK = clamp((Y_cp/P) / cardYield_lastShift, 0.5, 3)`. On the first shift, `cardYield` defaults to `game.card_yield_per_pax` 400 (new, est.).
- It goes into the era patch, so landing and UDF floaters show the era's tariff.
- **Display only:** era aero always comes from Y_cp.

### Worked CP1 example (model)
- RAB ₹36,000 cr and 44 M passengers give an ARR of about ₹6,386 cr, which is ₹1,451 per passenger.
- AERA orders ₹900, so about ₹2,400 cr a year goes into the URA.
- By CP3–CP4, with Delhi's banks in (about 230 M passengers), the need falls below the cap and the URA unwinds.
- **Lesson:** scale, not tariffs, pays for the airport.

---

## 7. Debt, equity and IRR

### Stages
`capex.stages` (new, est.):

| Stage | Cost (₹ cr) | Capacity | Spent | Commissioned |
|---|---|---|---|---|
| 1A | 36,000 | 45 | years 1–4, evenly | year 5 |
| 1B | 20,000 | 95 | year 7 | year 8 |
| 1C | 24,000 | 150 | year 10 | year 11 |
| 1D | 24,000 | 209 | year 13 | year 14 |
| Phase 2 | 14,025 (`world.game_capacity.phase2_cost_cr`) | 260 | the year it is ordered | next era start |

- Phase 2 can be ordered from the year-14 board.
- It has a 30% chance of a 1-year slip, or 0% with the S5 enabling-works option.
- Interest during construction is inside the stage cost (the regulator draft).
- Costs are in 2025 ₹ × P(spend year).

### Lender base case
`game.lender_base_case` (new, est.):
- Q 0.95, dis_pp ₹60, ctrl_pm at the benchmark, service-quality rebate 1%, star bonus 0, market growth, all mandatory stages on time, no phase 2.

### Sizing
- **Bank cap:** PV at 9.5% of (CFADS_base ÷ 1.30) over years 6–60 (`game.lbc_dscr_target`, new, est.) must cover the PV of all the mandatory tranches' debt service.
- **1A debt** = min(gearing × 36,000, the residual cap). This gives effective gearing **g_eff** = 1A debt ÷ 36,000.
- **Later stages** borrow at g_eff.
- **Each tranche:** 9.5% (`finance.loan_rate_base`), 1-year interest-only moratorium after commissioning, then 20 years (`finance.loan_tenor_years`).

### Repayment profiles
- **Sculpted:** DS_y = D × w_y ÷ Σ_t w_t·v^t, with w = CFADS_base and v = 1/1.095. DS is floored at the interest due.
- **Equal:** the annuity, D·r/(1−(1+r)^−20).
- **Model checks:**
  - 70% gearing, equal profile: about ₹2,860 cr a year, and the first repayment year's base-case DSCR is about 0.98.
  - The bank caps an equal-profile loan at about 53% gearing. Sculpted is about 1.30 by construction.

### Equity
- **At close:** 1A equity at 70% is ₹10,800 cr: parent ₹6,912 cr, L5 Capital ₹1,728 cr, AAI ₹1,080 cr, MADC ₹1,080 cr. It is called evenly over years 1–4.
- **Later stages, upgrades and overruns:** paid first from `fin.cash`, with the rest called pro rata by stake.
- The parent's IRR flow records −stake × (the call not covered by cash).

### Lock-up
`finance.distribution_lockup`, applied to the era DSCR:

| Era DSCR | Share of `fin.cash` that can be paid out |
|---|---|
| below 1.20 | 0% |
| below 1.40 | 50% |
| below 1.55 | 75% |
| 1.55 or above | 100% |

### Board cash slider
- **Dividend:** paid pro rata by stake. The parent's flow is stake × dividend.
- **Prepay:** cuts every tranche pro rata. The sculpted shape is scaled down.
- **Retain:** stays in `fin.cash`, which earns nothing (a stated simplification).

### Cure and step-in
- **Trigger:** era DSCR below 1.0 for 2 consecutive eras (1 in quick), or an unfunded shortfall.
- **Cure board:** the parent injects enough to restore the base-case DSCR to 1.10 (a negative IRR flow), or declines.
- **If declined, the lenders step in:** `finance.termination_concessionaire_default` (lenders get 90% of the debt due; **equity gets ₹0**). Phase becomes `'terminated'`.

### IRR
- The parent's yearly flows: −equity calls, −cures, +dividends, and in Ship B −stake buys and +stake sales.
- Solved by bisection between −50% and +100%. With no sign change, the result is "n/a".
- **End line (Ship A):** "{NAME} ran Zero Mile for 60 years. ₹X crore returned on ₹Y crore invested. Equity IRR Z%."

---

## 8. Feedback between eras
- **Growth:** `starBonus` (§3). The card reads "Airlines add flights where they leave on time."
- **Mall maturity:** NAR(e+1) = NAR + (450 − NAR) × 0.3 × Q, heading toward `nonaero.zmi_per_pax_mature` 450 (2025 ₹). Stressed passengers slow the Mall's maturing.
- **Service quality and the ratchet:** §6.
- **Upgrades:**

| Upgrade | Cost | Effect |
|---|---|---|
| Mall | ₹1,500 cr × P, once (`game.mall_upgrade`, new, est.) | ×1.15 on nar_pp from the next era |
| Runway rehab | ₹106.84 cr × P per runway (`costs.runway_rehab_cr`), due every 10 years from commissioning | capitalised into RAB. Deferring it adds to `kit.rehabDeferred` (no Ship A effect; Ship B uses it in §11) |

---

## 9. The `zm_campaign` save, v1

One localStorage key, written through `store.set` (try/catch), under 100 KB.

```
{v:1, id, created, updated, mode:'full'|'quick', eraMap:[{e,y0,y1,L}], seed,
 parent:{name,font,color},
 spv:{name:'VSIAL', fund:'L5 Capital: Lagrange Point Infrastructure Fund', nominee:'Meera Kesar',
      own:{parent:.64,fund:.16,AAI:.10,MADC:.10}, lockinEndYr:12, buyOpensYr:14},
 bid:{type:'share'|'ppf', v, rivals:[{name,type,v,eq}], won:true, rofr:false},
 close:{gearing, gEff, profile:'sculpted'|'equal', rate:9.5, tenor:20, moratorium:1, bankCapPct},
 construction:{overrun:'pay'|'slip', monsoon:'pay'|'slip', p2option:false, slipMonths},
 year, era, cp, phase,
 kit:{mall:false, p2:{ordered:null, ready:null}, rehab:{R1:yr,…}, rehabDeferred:{}, inv:[]},
 fin:{cash, dsra, rab, ura, taxLoss, nar, Ycp, Ycp0, P_cp0, tariffK, cardYield, omAllowPM,
      tranches:[{stage, bal, rate, start, profile, sched:[[y,ds]]}]},
 eras:[{e, years:[y0,y1], L, seed, patch, shift:{stars,safety,otp,cx,moves,sched,Q,dis_pp,ctrl_pm,cnx_pp,cardYield,sq,lines},
        annual:[{y,pax,spill,rev:{aero,nar},cost:{om,ctrl,dis,fee},ebitda,tax,cfads,ds,dscr,cash}],
        dscrMin, decisions:{div,prepay,retain,inv:[]}, aera:null, shocks:null}],
 owner:{flows:[[y,amt]], divs, invested, stakeLog:[]},
 flags:{lowEras:0, cures:0},
 result:null}
```

- **Saving:** after onboarding, after each board, and after each set of results.
- **Migration:**
  - `migrate(o)` steps through the versions one at a time.
  - Before any write, the previous good save is copied to `zm_campaign_bak`.
  - If parsing fails, the game offers "Restore the last good save".
  - A save with a higher `v` than the game knows opens read-only.
- **`zm_campaign_best`:** the top 5 results, each `{parent, irr, grade, date}`.
- **Ship B fields** (`aera`, `shocks`, `stakeLog`, `handback`) are stored as `null` in Ship A.

---

## 10. Level 5, "Zero Mile, grown" (`LEVELS[4]`)

### Definition
Appended after Level 4. Levels 1–4 are not edited.

```
{n:5, name:'Zero Mile, grown', sub:'The hub at full stretch', from:'VSI · YEAR 19+', concessionOnly:true,
 clock:'16:00', len:9000, windDown:true, arr:118, dep:118, amp:0.7, rw:6,
 rwOpen:{R1:'ARR',R2:'ARR',R3:'DEP',R4:'DEP',R5:'DEP',R6:'MIX'}, concs:'ABCDEF', phase2:false,
 intl:0.27, wide:0.22, a380:8, target:TBD, starsAt:TBD, light:'day', seed:55,
 blurb:'Every city is in, and the hub is full. Growth now comes from bigger aircraft, longer flights and a calmer Mall.',
 last:{t:'Zero Mile, grown',d:'…'},
 script:[[900,'medical'],[2000,'lane'],[3300,'strike'],[4600,'vvip'],[6200,'lights']],
 ops:[[500,'birds'],[1400,'tug'],[3000,'fod'],[4400,'birds'],[7000,'fod']]}
```

- `target` and `starsAt` are set from the expert bot in Step 5. `EXPERT[5]` and `NEXT_TIP[5]` are added at the same time.
- **Generic calls only in Ship A.** There are no `st_` set pieces. `connex`, `fuel`, `heavy` and `nogate` arise by themselves; `shear` appears only in dust eras.
- **Growth is by gauge, not movements.** The runways were already full at L4: an ARR runway handles about 41 arrivals an hour, a DEP runway about 50. So arr/dep stays at or below 120, and the widebody and international shares rise.

### Era patches (`ZMERA.eraPatch(camp, e)`, e = 5..12)

| Field | Value |
|---|---|
| intl | min(0.35, 0.27 + 0.02(e−5)) (`world.game_traffic_growth.intl_share_*`) |
| wide | min(0.36, 0.22 + 0.02(e−5)) |
| a380 | min(14, 8 + (e−5)) |
| arr = dep | min(120, 118 + floor((e−5)/3)) |
| seed | 50 + e |
| phase2 | `kit.p2.ready ≤ y0` |

- **Weather alternates:**
  - Odd eras are "summer": clock '16:00', `dust:[2400,3300]`. `dustNow` is generic, in `tick`.
  - Even eras are "winter": clock '06:30', `fog:[1800,2700]`. `fogF` is generic too; `sepF` and `tick` read only `LV.fog`, so the fog window doesn't need the `st_fog` story.
- `last.d` changes by era, for example: "Year 19. Phase 2 opens: satellites G and H" or "Year 34. The hub at thirty".
- **Patches for L1–L4 in Concession:** only `{campaign:true, era, tariffK, years}`. No sim fields change in Ship A.

### Phase 2 without new geometry
- 160 of the 168 east remote stands (x ≥ 560, y ±900/±1100; 128 code C, 32 code E) sit exactly under `SPEC.phase2.satellites` G (y −1000) and H (y +1000).
- **At boot:** tag each one with `g.p2 = g.y<0 ? 'G' : 'H'`.
- **In `startLevel`**, after the gate-open line:
  - if `LV.phase2`: `remote=false, bridge=true, conc=p2, open=true`;
  - otherwise restore `remote=true, bridge=false, conc='REM'`.
  - Levels 1–4 always take the restore branch.
- **`settleLinks`:** +120 s APM ride when the arrival's gate is a live p2 stand, instead of +300 s for a remote stand.
- **Not built:** the stands stay remote. That costs connections and Mall spend, which is the case for building phase 2.
- **Drawing:** in 2D, the satellite outlines are drawn when `LV.phase2` is set. The 3D satellites are Ship B.

### Checklist
- `menu()` filters out `concessionOnly`.
- In quick play, `finish()`'s `next` and its "Before level N" label ignore `concessionOnly`.
- The star-note ternary gains an L5 branch: "This level allows for the weather."
- `buildLevel` uses `mulberry(1000 + (L.seed || L.n)*17)`. L1–L4 have no `seed`, so they are identical.
- `run.py` accepts level 5 (and 6 in Ship B). `run_all.py` keeps its default levels as `1234`; add `5` explicitly in balance runs.

---

## 11. Ship B systems (designed now, from `research/money-world.md` §9 and `money.json → world.game_*`)

### 11.1 Shocks: one draw per era at the board, from E2
- Drawn from the seeded `mulberry(camp.seed + 97e)`, never `SIMR`.
- Shocks change money, traffic and era patches only. They never change sim code paths in L1–L4.

| Shock | p per era | Effect in era.js | Player levers |
|---|---|---|---|
| Pandemic (max 1) | 0.06 | Yearly traffic multipliers: domestic [0.35, 0.60, 0.88, 1.00, 1.05], international [0.20, 0.30, 0.60, 0.90, 1.00]; transfers ×0.85 in year 1; dividends locked for 1 era | Force-majeure claim, resolved next era at p = 0.65. If won: fee holiday of 23.5 months, concession extended by 23.5 months (handback moves to year 62), RAB uplift of 10–15% of the lost ARR (`finance.covid_force_majeure`) |
| Base-carrier collapse | 0.45 | −7 to −15% of movements; 80% recaptured over 6–12 months; fares +30% and demand −3% for 6 months; write-off of 2–4 months of that carrier's aero billing | Security deposits (write-off −75%, growth −0.5 pp, est.); a lien (p = 0.3 of a lessor lawsuit) |
| Slow death | — | Shown in the newsfeed during the era before a collapse: that carrier's share halves | Cut exposure early |
| Fuel spike | 0.35 | ATF ×1.5–1.75, extreme ×2.15 (`fuel.atf_shock_multiplier`); applied to fuel claims and SLA rates in shift patches; capacity −6 to −14% for 6–18 months | Fuel-farm storage (Ship B card) |
| Rate spike / fall | 0.30 / 0.30 | ±(100–250) bps on all tranches for 2–3 years. Rupee term debt is MCLR-linked, so all of it floats. | Refinance at 9.0% (`finance.refi_rate_after_stability`) after two eras at 1.40 or above, or in a rate-fall window |
| Regional closure | 0.25 | VSI **gains** diversions for one shift (11.4) | Accept them, or not |
| Overflight ban | 0.12 | Widebody international −10%; westbound fuel +29%, for 1–2 eras | — |
| Rival airport | 0.25, from E3 | Announced in era N, opens in N+1 (30%: N+2). Takes 5–10% of O&D LCC traffic, ramping 50/80/100%. Grows faster with spill. | The S3 ROFR clause: own the rival instead |
| Regulatory regime | 0.12, from E3 | One of: till 0.30 → 1.0 for one recompute; tariff reset −20%; WACC ±100–150 bps | Appeal (11.3) |

- **Hybrid shocks** (`world.game_shock_correlations`):
  - A fuel spike multiplies next era's collapse chance by 1.6.
  - A pandemic multiplies next era's collapse chance by 1.5.
  - Fuel and rate spikes are drawn together with p = 0.5.
  - At most 2 negative shocks per era.
- **Market cycle per era** for valuation: crisis (p 0.15, −2×), normal (0.6, 0), boom (0.25, +3×).
- **Presentation:** a newsroom card at the board. During the shift, a breaking-news banner (`vipBanner`) shows money effects only.

### 11.2 Stake: the 64 → 80% climb, and selling down
- **Opens** at the first board after year 12, which is year 14 (memo, binding; labelled a game rule).
- **One 4% block per era** at most (memo). L5 Capital can offer blocks of 2–10% to outsiders when it is stressed. When it does, the player has a ROFR match window. If the player declines, the outsider takes a board seat and vetoes payouts above 60% (`world.game_stake_pricing`).
- **Price:**

```
EV        = avg EBITDA (last era) × multiple × (1 − 1.075^−yearsLeft)
multiple  = clamp(12 + growthPrem + dscr/safety penalties + regPrem + marketAdj, 8, 24)
            (the star part of trackPrem is left out: stars enter through the memo's factor)
Equity    = EV − net debt
Block     = 4% × Equity × (0.9 + 0.2 × avgStars/3) × adj
adj       = ×1.35 for the block that crosses 75% (special-resolution control: L5 Capital's vote is no longer
            needed for phase 2 or refinancing); ×0.90 if L5 Capital is impatient (two eras with no dividend);
            ×0.85 if it is distressed
```

- **Checks:**
  - EV/RAB should fall between 1.1 and 1.4; warn in QA if not.
  - Cross-check against BIAL ₹21,800 cr (`benchmarks.bial_valuation`).
- **Payment:** a block of 10% or more can be paid in 3 instalments over 1.5 years.
- **At 80%:** the share certificate is re-stamped in `--brass`.
- **Selling down:** allowed down to 51% (`finance.equity_lockin.lead_min`).
  - A secondary sale is priced at ×1.00, with up to 20% as an earn-out paid at the end of the next era if KPIs are met.
  - A primary raise is priced at ×0.95 and dilutes everyone.

### 11.3 AERA order card and appeal
The order card shows Y_cp, RAB, WACC, the NAR offset, URA recovery and service quality (onboarding.md §3).
- **Appeal** (`world.game_appeal`):
  - It costs 0.2% of one era's ARR.
  - The win chance is 0.20. A win moves the tariff 25% of the way toward the claim.
  - It is decided one era later. There is a 30% chance AERA appeals to the Supreme Court, adding one more era.
  - Jackpot: a 5% chance of a back-recovery, paid as a one-era UDF uplift.
- **Refinancing:** see 11.1.
- **Regulator slot cut:** if the era's OTP is below 70%, the regulator removes 2 slots an hour per runway, so capacity falls 4.5% next era (`world.game_capacity`).

### 11.4 Mid-level incidents (L5 and L6 only; levels 1–4 are never touched)
- **Draws:** made at the board from `world.game_incidents`. They are scheduled into the era patch as `inc5:[[t,type]]` and run through existing mechanics.
- **Few cards:** routine events are automated (see the incident feedback in memory). A card appears only for a real trade-off.

| Incident | p per era | How it runs | Card? | Resilience buy |
|---|---|---|---|---|
| Drone | 0.30 | `r.blocks` on every runway for 20–40 shift-minutes | No: a safety stop, with a banner | Counter-drone, ₹58 cr: duration −60% |
| Grid failure | 0.20 | One segment of 10–15 minutes | Yes: "Switch over now: everything stops for 12 min" vs "Run on backup: 3 runways at ×1.3 spacing for 30 min". Airline claims ×1.5. | Second feed, ₹150–250 cr: duration −80% |
| IT outage | 0.25 | 4% of departures cancelled at T=0; `sepK` 1.1 on every runway | No | — |
| Fuel supply | 0.15 | Uplift falls to 30% | Yes: "Cancel long-haul" vs "Tech stop via BOM" (+₹ per flight) | Storage, ₹520–780 cr: no cap |
| Hull loss | 0.03 × (1 + deferred rehabs) | One runway closed for the shift; the next runway closed 40 min | No (safety) | — |
| Diversions received | with regional closure | +1–6 `specialArr` inbounds; each earns landing and parking | Yes: "Accept 6" vs "Accept 2" (stands against revenue) | — |
| Damaging bird strike | 7% of strikes | Inspection of 10–20 min via `closeRw` | No | Wildlife programme: strikes −30% |

### 11.5 Level 6, "Handback" (`LEVELS[5]`, concessionOnly, E12 / Q6)
- **Build:** the final L5 era patch, plus three set pieces built on the existing `startStory` / `MARKS` / `storyCard` engine:
  1. **The Independent Engineer's (IE) pre-inspection walk.** Assets below their threshold flash on the map.
  2. **A grid-resilience test.** A scheduled grid incident (11.4).
  3. **The incoming operator's shadow team.** A coach card that scores your OTP. At the end comes the "Last flight under {NAME}" moment.
- **Score:** the shift's stars, safety and OTP feed the handback score, at 20% of its weight (est.).
- **Numbering:** this is the user's "sixth level". Confirm with the user. The onboarding stages may be what they meant.

### 11.6 Handback (`world.game_handback`)

**Timeline:**

| When | Event |
|---|---|
| E11 board | Survey: the IE publishes each asset's residual life |
| Year 55 onward | Handback reserve sweeps 3% of revenue a year (range 2–5%), after senior debt |
| Year 58 | Demobilisation plan |
| Year 60 | Pre-inspection, verification, transfer for nothing |

**Asset classes:**

| Class | Weight | Required residual life |
|---|---|---|
| Airside pavement | 0.30 | 10 years; ≥85% of sections compliant, none below 7 |
| Terminals | 0.25 | 25 years |
| Systems | 0.25 | 10 years |
| Safety | 0.10 | 10 years |
| Landside | 0.10 | 10 years |

- **Residual life** comes from era.js's asset register. Each class tracks its last-renewal year. Renewal cards (est.): pavement = runway rehab × 1.5 for taxiways and aprons; a terminal refurbishment at 8% of the stage cost; systems at 12% of the stage cost every 15 years.
- **Retention:** 5% of the last year's revenue, ×1.5 below 85 and ×2 below 70.

**Bands:**

| Band | Score | Outcome |
|---|---|---|
| Exemplary | ≥ 95 | Retention back, plus a bonus |
| Compliant | 85–95 | Retention back, less repairs × 1.2 |
| Deficient | 70–85 | Half the retention forfeited, plus repairs × 1.2 |
| Failed | < 70 | All the retention forfeited, plus 20% of the bond drawn |

- **Leftovers:** any unrecovered URA at year 60 is written off. This is a stated simplification.

### 11.7 Termination triggers (`world.game_termination`)
- **Step-in** (§7).
- **Missed phase-2 obligation.** The obligation arises when passengers reach 80% of capacity, and phase 2 must be commissioned within 1 era. One era late brings a warning; two brings a default notice.
- **Fatal accident with an airport-side hazard**, followed by a handback score below 70: a default notice.
- **Fee arrears over 1 year:** default.
- **Authority default.** The player may terminate and is paid 100% of the debt plus 150% of adjusted equity, with p = 0.6, 1–2 eras later.
- **Voluntary handback.** A 24-month clock. The indemnity is book value less fines, paid with p = 0.7, one era later.

### 11.8 Endgame score (`world.game_endgame`)

| Component | Weight | How points are scored |
|---|---|---|
| IRR | 35 | Bands: below 8 = 0; 8–12.4 = 25; 12.4–15.5 = 60; 15.5–17.3 = 85; above 17.3 = 100; linear inside each band |
| Handback | 20 | The handback score |
| Dividends ÷ equity invested | 15 | 100 at 4×, est. |
| Peak valuation ÷ BIAL ₹21,800 cr | 10 | 100 at 2×, est. |
| Safety (average) | 10 | — |
| Stars (average ÷ 3) | 10 | — |

- **Grades:** A ≥ 85 ("Fairfax-grade"), B 70–85, C 55–70, D below 55. Unpaid debt caps the grade at C ("weak").
- **Benchmark lines:**
  - "BIAL's equity was worth USD 1.0 bn in 2017 and USD 2.55 bn in 2024."
  - Margin is shown against VINCI 63.7%, Aena 60.2% and DEL 37%.

---

## 12. `money.json` fixes and new keys (one owner: the era.js agent, at C2)

### Fixes
1. `game.ownership` → `{parent:.64, fund:.16, AAI:.10, MADC:.10}`.
2. `game.financial_close` → a 1A basis of `capex_cr 36000, debt_cr 25200, equity_cr 10800, parent 6912, fund 1728, aai 1080, madc 1080`. Drop parent 13,440.
3. `game.annualise` → "annual = shift_line × (M(y)/S.sched) × 311 × P(y)/P(shift)".

### New keys
All are `estimate: true` unless a source is given.

| Area | Keys |
|---|---|
| capex | `capex.stages` (§7) |
| till | `till.glide_cap` {900, 850, 800} |
| finance | `finance.tax_rate` 0.2517 (source: the Income Tax Act s.115BAA rate) |
| game | `game.cpi` 0.04; `game.star_growth_bonus`; `game.capacity_headroom` 1.1; `game.lbc_dscr_target` 1.30; `game.lender_base_case` {Q .95, dis_pp 60, sq .01}; `game.disruption_scale` 1.0; `game.ev_ebitda` 12 (alias of `world.game_stake_pricing.base_multiple`); `game.card_yield_per_pax` 400; `game.renewal_share` 0.25; `game.om_benchmark_pm` (set in Step 5); `game.mall_upgrade` {cost_cr 1500, k 1.15} |
| shift ledger | `nonaero.hub_incentive_per_cnx` 250; `costs.ops_job_inr` {sweep 15000, patrol 8000, tow 20000}; `fuel.hold_grace_min` 5; `fuel.taxi_burn_kg_min` {narrow 11.7, wide 25.8} (from the `fuel.burn_arrival_*` notes); `rights.care_per_missed_cnx` 1900 (meal 400 + ⅓ × hotel 4,500) |
| MTOW | `aero.mtow_t` += B787_8 227.9, A330_300 242, ATR72 23 (manufacturer figures; source them) |

`game.market_growth` from the memo is superseded by `world.game_traffic_growth`.
