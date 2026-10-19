# VSI money design (one page)

2026-10-19. Base: the "simple" draft, plus grafts from the regulator, fun and eras drafts (judge memo). Ship B systems come from `research/money-world.md` §9. Detail lives in `design/onboarding.md` (screens), `design/eras.md` (era maths, save, Level 5, Ship B systems) and `design/hooks.md` (every code hook). Every number below is a `money.json` key; (est.) means the key's `estimate` flag is true.

## Frame
- **You are the parent company.** You form VSIAL (Vikram Sarabhai International Airport Limited), which holds a 60-year concession.
  - At financial close you hold 64%. **L5 Capital: Lagrange Point Infrastructure Fund** holds 16%, AAI 10%, and MADC ("the State of Maharashtra's airport and MIHAN developer", `ppp.madc_role`) 10%.
  - The state leases the land at a nominal rent. AAI and MADC pay cash for their 10% each.
  - From the year-14 board you may buy L5 Capital's stake, 4% per era, up to 80%. Dividends follow the stake.
- **The bid** is a revenue share (10–50%) or a per-passenger fee (₹100–450), placed against three fictional consortia. The highest bid wins. The fee is not a pass-through, so a high bid thins margins for 60 years.
- **Capex in stages** (`capex.stages`, est.). Each stage is financed at the gearing chosen at close (60–75%), at 9.5% over 20 years after a 1-year moratorium. Repayment is sculpted (the default) or in equal instalments.

| Stage | ₹ cr | Built | Capacity | Level |
|---|---|---|---|---|
| 1A | 36,000 | years 1–4 | 45 MPPA | L1 |
| 1B | 20,000 | year 7 | 95 | L2 |
| 1C | 24,000 | year 10 | 150 | L3 |
| 1D | 24,000 | year 13 | 209 | L4 |
| Phase 2 G/H (an option) | 14,025 | one era after it is ordered | 260 | L5 |

- **The bank sizes the debt:** Debt = min(gearing × cost, PV(lender base-case CFADS ÷ 1.30)).
- **Eras:**

| Era | Years | Played on |
|---|---|---|
| E0 | 1–4 | Onboarding and construction |
| E1 | 5–7 | L1 |
| E2 | 8–10 | L2 |
| E3 | 11–13 | L3 |
| E4 | 14–18 | L4 |
| E5–E11 | 19–53 | Level 5, five years each |
| E12 | 54–60 | Level 5 (Level 6 "Handback" in Ship B), then handback |

  - AERA control periods run every 5 years from opening (CP1 is years 5–9), independently of eras.
  - Quick concession: L1, L2, L3, L4 (years 14–25), L5 (26–43), L5 (44–60).
- **Level 5, "Zero Mile, grown"** is `LEVELS[4]` with `concessionOnly:true`. Levels 1–4 are not edited.
- **Quick play** is today's game plus a "Today ₹X cr" chip. **Concession mode** has everything else.

## Per-shift ledger: 5 revenue lines and 5 cost lines
| Line | Hook | Formula |
|---|---|---|
| Landing | `touchdown` | max(₹8,000, MTOW × `aero.landing_*_per_t`) × k. Domestic ATR: ₹0. VIP/state flights: ₹0 |
| Parking | pushback | (pushT − inBlock − 150 min) × MTOW × ₹36 contact / ₹18 remote × `aero.parking_multipliers` × k |
| UDF | `depart` | departing pax × ₹620 domestic / ₹1,225 international (`game.opening_tariff`) × k |
| Retail & F&B | dock, then `depart` | arrivals: 0.3 × nar_pp. Departures: 1.7 × nar_pp × M(late). Made transfers at 0.75×; missed ones pay 0 |
| Hub incentive | `settleLinks` | ₹250 per made connection (est.) |
| Runways open | `tick` | ₹26,000 per runway-hour, for every runway that is not OFF (`costs.runway_open_per_hour`; ATC excluded) |
| Ops teams | `opsSpawn` | ₹15k per sweep, ₹8k per patrol, ₹20k per tow (est.) |
| SLA fuel credits | `depart`, `'nogate'` | minutes beyond 15 late, or beyond 5 waiting for a stand, × taxi burn: ₹1,460/min narrowbody, ₹3,225/min widebody |
| Passenger care | miss, divert, offload | ₹1,900 per missed connection; ₹400 per diverted passenger; ₹10,000 per offloaded passenger (`rights.*`) |
| Fuel claims | `'holding'`, `goAround` | `fuel.hold_cost_per_min` after 5 minutes in the stack; 5 minutes' worth per go-around |

- **M(late):** 1.0 up to 15 minutes late, 1.05 at 15–60, 0.6 beyond 60.
- **k:** 1 in quick play; in Concession, the era's AERA yield ÷ the card yield (display only).
- **Force majeure:** SLA and fuel claims are waived during the summit, dust or fog (`rights.extraordinary_exempt`).

## Shift to era (`money/era.js`, pure, runs in node)
The shift supplies Q (Mall realised ÷ potential), dis_pp (disruption cost per passenger, × `game.disruption_scale`), controllable cost per movement, the four service-quality groups and stars. Then, for each year:
```
pax    = min(demand, 1.1·capacity)        demand grows by world.game_traffic_growth + star bonus
ARR    = 12.89%·RAB + depreciation + O&M allowance + tax − 0.30·NAR_fcst   (set at each CP start)
Yield  = min(ARR/pax_fcst, glide cap ₹900/850/800 × CPI); shortfall → receivable at WACC
Aero   = Yield·pax·(1 − SQ rebate + bonus);  NAR = pax·nar_pp·Q + incentive
EBITDA = Aero + NAR − ₹199·pax − controllables − disruption − concession fee
CFADS  = EBITDA − tax 25.17% − renewals;  DSCR = CFADS ÷ debt service
```
- **The O&M ratchet:** the next allowance is min(actual, efficient benchmark).
- **Volume variance** is trued up at the next control period.
- **Lesson:** aero is the fair return whatever you land. Profit comes from the Mall and from delays you avoid.

## Lenders
- **Dividend lock-up:** below DSCR 1.55, 1.40 or 1.20, dividends are capped at 75%, 50% or 0%.
- **Below 1.10:** a cash sweep, and the debt service reserve (DSRA) is topped up to 6 months.
- **Below 1.0 for two eras** (one in quick concession): a cure board. The parent puts in cash, or the lenders step in and equity gets ₹0.

## Board meeting
- **Ship A:** results; the mandatory stage; a dividend / prepay / retain slider; the Mall upgrade (₹1,500 cr, ×1.15); runway rehab (₹106.84 cr per runway); phase 2 (from year 14); a cure.
- **Ship B adds:**
  - the AERA order card (accept, or appeal: 20% chance to win, closing 25% of the gap, decided next era);
  - L5 Capital's 4% blocks, or selling down to 51%;
  - sim upgrades;
  - the draw for shocks, market cycle and mid-level incidents (L5 and L6 only).

## Endgame (Ship B)
- **Score weights:** IRR 35, handback 20 (`world.game_handback`), dividends ÷ equity 15, peak value ÷ BIAL ₹21,800 cr 10, safety 10, stars 10. Unpaid debt caps the grade at "weak".
- **Last line:** "*[Parent]* ran Zero Mile for 60 years. ₹X crore returned on ₹Y crore invested."

## Hard rules
1. **Safety is never for sale.** No money code writes `S.safety`. Medical, fuel and MAYDAY cards say "Safety call: no price shown".
2. **The expert earns the most.**
3. **The ledger never calls `SIMR()` and never writes sim state.**
4. **Every line has a formula tooltip and a glossary term.**
5. **One labelled assumption, the glide cap; one knob, `disruption_scale`.** `shift_money_multiplier` stays at 1.0.

## Scope
- **Ship A:** ledger and chip; Concession mode, onboarding and eras; silent ARR, receivable and service quality; debt, cure and step-in; Level 5; `zm_campaign`; the end line.
- **Ship B:** the order screen, shocks (including hybrid ones), stake buy and sell, mid-level incidents, Level 6, handback and scoring.

## Acceptance tests
1. With money off, and with the quick-play ledger on, bots are identical to `research/baseline_bots.txt`.
2. Expert has the highest shift EBITDA on L3 and L4 (two seeds). Miser and spender earn less. Handler and lazy lose money on L3 and L4.
3. Quick concession:
   - Expert: lowest DSCR about 1.10–1.20, with at least one lender warning (below 1.20) around stages 1C/1D (Mumbai and Delhi) and a recovery; debt repaid, highest IRR, IRR within 12.4–17.3% at a winning bid. (The bank still sizes the debt on its own base case at 1.30; the realised path is lower.)
   - Lazy: triggers lender step-in.
   - Lazy: lenders step in.
4. Code and data:
   - No console errors in 2D or 3D.
   - Diff of `LEVELS[0..3]` is empty.
   - `zm_stars` is untouched.
   - A corrupt `zm_campaign` restores from `_bak`.

## GitHub checkpoints
| # | What |
|---|---|
| C1 | This design |
| C2 | `money.json` fixes, `era.js` and a node balance table |
| C3 | Ledger hooks and chip, gate green |
| C4 | Concession loop, onboarding, board and L5 (Ship A live, push to `main`) |
| C5 | Ship B |
