# VSI money design (one page)

2026-10-19. Base: the "simple" draft, plus grafts from the regulator, fun and eras drafts (judge memo). Ship B systems come from `research/money-world.md` §9. Detail lives in `design/finance.md` (the finance model, its calibration and its audit), `design/onboarding.md` (screens), `design/eras.md` (era loop, save, Level 5, Ship B systems) and `design/hooks.md` (every code hook). Every number below is a `money.json` key; (est.) means the key's `estimate` flag is true. Where this page and `design/eras.md` §5–7 differ on the finance maths, this page and `design/finance.md` win.

## The economy is "BIAL, scaled"
VSI's finances run on the mechanisms of Bengaluru's BIAL (Kempegowda), the closest real greenfield PPP, at BIAL's unit costs. The model is `tools/concession_model.py` (`python3 tools/concession_model.py all`). It first back-tests the mechanism on BIAL's own inputs, FY2009–FY2026, then runs VSI.
- **Not one ×5.** VSI is about ×8 BIAL on full-build capex (to 209 MPPA), ×12 on phase 1, ×6 on mature traffic and ×4–10 on traffic year by year. VSI reaches its mature traffic in 10 operating years; BIAL took 18.
- **No hidden revenue multiplier.** Revenue is passengers × the AERA yield, plus the Mall.

## What the player sees
The finance model stays as rich as it is. The player sees only three numbers:
1. **Today's money**: the "Today ₹X cr" chip in a shift, and cash at the board.
2. **The lenders' light**: DSCR as green (1.20 or more), amber (1.10–1.20: dividends locked) or red (below 1.10: lenders sweep the cash; below 1.0 in two eras running, they take over).
3. **Your stake and its value**: 64% at close, valued at `world.game_stake_pricing`.

Each era the player makes **two or three decisions**: how much cash to pay out (dividends or prepay), whether to accept or fight the AERA order, and when to build (phase 2). At close they also choose the bid, gearing, phase-1 size and the state loan; refinancing and the cure are yes/no offers when they arise. **True-ups, RAB, WACC and sculpting never appear as inputs.** Each shows only as a consequence, in one plain sentence, for example "AERA let you recover ₹X cr you were owed" or "AERA held back ₹X cr of your tariff until 2041; lenders are watching". If a screen needs the glossary to be understood, it is cut.

## The mechanisms (all in the model, none shown as inputs)
- **Tariff = AERA building block on VSI's own RAB.** Each 5-year control period: WACC × the average aero RAB (capex plus capitalised interest) + depreciation + allowed O&M + tax − 30% of non-aero revenue (hybrid till), grossed up for the 4% concession fee. The WACC comes from 48:52 gearing, the actual debt rate and AERA's 15.05% cost of equity. The state loan counts at 0%.
- **Smoothing and true-up.** One yield per control period is levelled over forecast traffic. At the end of the period the shortfall or surplus is carried into the next one at the plan WACC. In the period when 1C/1D enter the RAB, AERA leaves 13.9% of the ARR unrecovered until the next period, as it did with BIAL's T2.
- **Debt, BIAL style.** Interest during construction is capitalised. Repayment starts after a moratorium (1A: 2 years after opening, then 14 years; 1B: 1 + 15; 1C/1D: one T2-style close in year 9 at 80:20, repaid over 10 years from the year after 1D opens). Repayment is sculpted on forecast traffic. The DSRA holds two quarters of debt service.
- **The bank sizes the debt.** It lends the lesser of gearing × cost and what its base case can carry at DSCR 1.30, and 1.20 in interest-only years. Its base case therefore never shows a warning.
- **Costs.** O&M is BIAL's: ₹9.44 cr per mppa of capacity plus ₹134 per passenger (FY2026 ₹). It adds an opening cost for new capacity, fitted on BIAL's opening and T1 expansion. Renewals cover the yearly wear on the built assets at today's prices. Tax is 25.17%; after the first control period AERA passes through the aero share of it.
- **Lenders' tests use the worst single year of each era.** Below 1.20: dividends locked. Below 1.10: cash sweep. Below 1.0 in two eras running: cure board (the parent tops up and dilutes its IRR) or step-in. An instalment that cannot be paid is a step-in at once.

## The levers
| Lever | Range | What it trades |
|---|---|---|
| Gearing (1A, 1B) | 60–75% (expert asks 75%) | Return on equity against coverage. The bank caps 1A near 63%, because the opening year must cover interest 1.20 times. 60%: IRR 12.1% |
| Phase-1 size, and 1B | lean 45 mppa (₹60,000 cr) + 1B, or big 70 mppa (₹85,000 cr) | Big phase 1 costs more equity up front and cuts IRR to 11.5% |
| State support | BIAL's 0% subordinated loan, 14.2% of 1A, deferrable at 1C/1D | Less senior debt, but AERA counts it at 0%, so the tariff falls too (+0.2 pt IRR) |
| AERA stance | accept, or push hard | Pushing removes the 13.9% carry but costs capex disallowance (13.5%) and airline growth (−1 pt a year): IRR 10.4% and a covenant breach |
| Equity cure | yes/no when red twice | Saves the concession and dilutes IRR |
| Refinance | offered after 3 stable years (lender DSCR ≥ 1.20) | BIAL's 2025 terms: 8.15%, 15 years, 2-year moratorium |
| Dividends or prepay | slider each board | Dividends lift IRR; prepaying lifts the light |

## BIAL actual vs VSI modelled (expert), by operating year
Pasted from the model output. BIAL year n = FY(2008+n); VSI year n+4. Yields are in FY2026 rupees; EBITDA is nominal ₹ crore.

| Op yr | BIAL FY | BIAL pax m | VSI yr | VSI pax m | BIAL yield ₹ | VSI yield ₹ | BIAL EBITDA | VSI EBITDA | BIAL margin | VSI margin | BIAL DSCR | VSI DSCR | VSI lender DSCR | VSI event |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 2009 | 7.2 | 5 | 37 | 952 | 1,498 | 144 E | 5,291 | 44% | 71% | 1.07 E | 1.40 | 1.24 | opens (1A); BLR moves in (L1); CP1 |
| 2 | 2010 | 9.9 | 6 | 40 | 994 | 1,498 | — | 6,484 | — | 77% | — | 1.71 | 1.53 | opening costs (half year) |
| 3 | 2011 | 11.6 | 7 | 43 | 872 | 1,498 | — | 7,809 | — | 83% | — | 1.48 | 1.29 |  |
| 4 | 2012 | 12.7 | 8 | 79 | 812 | 1,498 | — | 14,327 | — | 77% | — | 1.52 | 1.28 | AMD+HYD move in (L2); 1B opens |
| 5 | 2013 | 12.0 | 9 | 86 | 762 | 1,498 | — | 16,277 | — | 78% | — | 1.59 | 1.30 | T2-style close for 1C+1D (80:20) |
| 6 | 2014 | 12.9 | 10 | 97 | 681 | 1,147 | 385 R | 15,940 | 60% | 80% | — | 1.56 | 1.25 | CP2: AERA carries 13.9% of PV ARR |
| 7 | 2015 | 15.4 | 11 | 146 | 773 | 898 | 602 R | 19,184 | 66% | 72% | — | 1.40 | 1.15 | BOM moves in (L3); 1C opens |
| 8 | 2016 | 19.0 | 12 | 157 | 729 | 898 | 804 R | 21,712 | 71% | 73% | — | 1.46 | 1.16 |  |
| 9 | 2017 | 22.9 | 13 | 165 | 647 D | 898 | 932 R | 25,348 | 71% | 78% | — | 1.50 | 1.16 |  |
| 10 | 2018 | 26.9 | 14 | 223 | 621 D | 898 | 1,098 D | 34,987 | 70% | 75% | — | 1.48 | 1.15 | DEL moves in (L4); 1D opens |
| 11 | 2019 | 33.3 | 15 | 230 | 403 D | 946 | 975 D | 39,457 | 65% | 76% | 5.60 R | 1.68 | 1.27 | CP3: CP2 true-up recovered; 1C/1D repaying; phase 2 build |
| 12 | 2020 | 32.4 | 16 | 230 | 355 D | 1,015 | — | 45,455 | — | 80% | 3.90 E | 1.89 | 1.40 |  |
| 13 | 2021 | 10.9 | 17 | 261 | 404 D | 1,015 | — | 52,792 | — | 79% | 0.45 E | 1.81 | 1.32 | phase 2 opens |
| 14 | 2022 | 16.3 | 18 | 278 | 401 | 1,015 | — | 58,034 | — | 78% | 1.15 E | 5.56 | 3.94 | refinanced (8.15%, 15 yrs) |
| 15 | 2023 | 31.9 | 19 | 286 | 406 | 1,015 | 1,110 D | 63,978 | 60% | 79% | 2.00 E | 6.13 | 4.30 |  |
| 16 | 2024 | 37.6 | 20 | 286 | 512 | 855 | 1,749 D | 57,805 | 64% | 78% | 1.45 E | 3.42 | 2.35 | CP4 |
| 17 | 2025 | 41.9 | 21 | 286 | 595 | 753 | 2,720 D | 54,247 | 68% | 77% | 1.65 E | 3.48 | 2.32 |  |

## Lender DSCR by era: expert, bad, lazy, and the comparison cards
Pasted from the model output. Each cell is the era's worst single year. W = warning (< 1.20), C = covenant breach (< 1.10), D = below 1.0.

| Run | E1 (5-7) | E2 (8-10) | E3 (11-13) | E4 (14-18) | E5 (19-23) | E6 (24-28) | E7 (29-33) | E8 (34-38) | E9 (39-43) | E10 (44-48) | E11 (49-53) | E12 (54-60) | Bank gearing 1A/1B/1C-1D | Outcome | Equity IRR |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| EXPERT | 1.23 | 1.25 | 1.14 W | 1.14 W | 2.02 | 1.61 | 1.47 | 1.45 | repaid | repaid | repaid | repaid | 63%/75%/80% | debt repaid | 12.5% |
| EXPERT, builds Airport City | 1.23 | 1.25 | 1.14 W | 1.14 W | 2.05 | 1.71 | 1.58 | 1.57 | repaid | repaid | repaid | repaid | 63%/75%/80% | debt repaid | 12.7% |
| BAD | 1.09 C | 0.98 D | 0.89 D | — | — | — | — | — | — | — | — | — | 61%/75%/80% | step-in, year 13: era DSCR below 1.0 for two eras | equity lost |
| BAD, builds Airport City | 1.09 C | 0.98 D | 0.89 D | — | — | — | — | — | — | — | — | — | 61%/75%/80% | step-in, year 13: era DSCR below 1.0 for two eras | equity lost |
| LAZY | 1.04 C | 0.97 D | 0.83 D | — | — | — | — | — | — | — | — | — | 61%/70%/80% | step-in, year 13: era DSCR below 1.0 for two eras (and a debt-service payment it could not fund) | equity lost |
| LAZY, builds Airport City | 1.04 C | 0.97 D | 0.83 D | — | — | — | — | — | — | — | — | — | 61%/70%/80% | step-in, year 13: era DSCR below 1.0 for two eras (and a debt-service payment it could not fund) | equity lost |
| Comparison: Delhi card (DIAL FY26 aero yield, 45.99% revenue share) | -0.25 D | -0.10 D | -0.03 D | 0.01 D | 0.05 D | 0.00 D | repaid | repaid | repaid | repaid | repaid | repaid | 63%/75%/80% | would breach; cash short from year 5 | n/a |
| Comparison: Navi Mumbai card (opening UDF, 12.6% revenue share) | 0.53 D | 0.68 D | 1.00 C | 1.01 C | 1.14 W | 5.90 | 5.88 | 6.62 | repaid | repaid | repaid | repaid | 63%/75%/80% | would breach; cash short from year 6 | n/a |

- **Expert:** the lowest year is 1.14, in year 11. It warns in E3–E4, when Mumbai and Delhi move in and 1C/1D open, then recovers to 1.45+. Debt is repaid; equity IRR is 12.5% (12.45%, at the floor of Fairfax's 12.4–17.3%).
- **Why it warns.** The bank's own base case sits at 1.24–1.25 through E2–E3. The dip comes from the expansion: 1C/1D bring interest and depreciation, while AERA defers 13.9% of that period's tariff. That deferral is the consequence of building on the move-in dates and accepting the order. Without it the expert stays at 1.27. Fighting the order makes it worse (1.07).
- **Bad play** (75% gearing, no state loan, pushing AERA, slipping operations) opens at 1.09, falls below 1.0 in E2 and E3, and the lenders step in at year 13 under the two-era rule.
- **Lazy play** falls below 1.0 in E2 and E3 and is taken over at year 13 under the two-era rule.
- **Airport City** (board choice from E3; `airport_city`): 877 acres (5% of the site) in three phases, ₹4 cr an acre of roads and services, ₹3 cr an acre a year in licence fees at full occupancy after a 5-year ramp. The expert who builds it gets 12.7%; on BIAL's 11% land share, 12.8%. Bad and lazy are taken over before it pays. Screen line: "Your land earns ₹8,205 cr a year; AERA counts ₹2,462 of it against your airline charges." (year 30).
- **Return target not met.** 14–15% needs about ₹30 cr an acre a year (a third of a Delhi Aerocity plot's value every year), so it is not shipped. Airport City income starts in year 16 and the till takes 30% of it, so it moves a 60-year equity return by tenths of a point.

**Why the Delhi card was wrong.** The earlier draft priced VSI on Delhi's tariff card: DIAL's FY26 aero revenue per passenger (₹379) and its 45.99% revenue share to AAI. That card is a return on an old, largely depreciated RAB of about ₹1,780 per passenger. VSI's new ₹60,000 cr phase 1 needs a building-block yield of about ₹1,500 per passenger. On the expert's own debt, the Delhi card gives a lender DSCR of −0.25 to 0.06 through E5. That is where the old "DSCR 0.3–0.5" came from: the card, not the airport. Navi Mumbai's opening UDF card is closer but still breaches (0.52 at opening, 1.00–1.18 to E5).

**What the model does and doesn't reproduce.**
- **Reproduces:**
  - BIAL's building block, with the RAB, depreciation, O&M and tax in-sample.
  - The sign of every BIAL true-up (+73/−133/−301/+738 against AERA's +55/−314/−974/+603).
  - BIAL's aero yield within 9% over the 10 years the model calculates (8 more are copied inputs and excluded).
  - BIAL's margin plateau near 70%, its dip at T2 and the recovery.
- **Doesn't reproduce:**
  - The size of the true-ups (up to 3.2× off).
  - BIAL's year-by-year DSCR path (57% mean error, almost all against estimated BIAL values; the one reported year, FY2019, is off 26%).
  - The tightness of BIAL's opening year: the model has 59% margin against 44%, and VSI opens at 71%.
  - BIAL's FY2024: the opening-cost term adds a T2 opening cost BIAL didn't show, so O&M is +45% out of sample.
- **A BIAL-tight opening is possible without a fudge factor, but it rests on one point.** A greenfield term fitted on FY2009 alone (one estimated point) opens VSI at 61% (BIAL: 44%). The bank then lends only 53% on 1A, and the expert IRR is 12.0%, below the band. The default uses one term for all three openings instead. Both options are in `design/finance.md` §7.
- **The shift outcomes behind bad and lazy are hand-set estimates** until the bots report real ones.

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
- **Shift to era:** the shift is the era's sample day. It supplies the Mall's realised share (Q), disruption cost per passenger, controllable cost per movement, the service-quality groups and stars. Disruption up to the lender base case (₹60 a passenger) is already inside BIAL's fitted O&M; only the excess is charged.

## Frame
- **You are the parent company.** You form VSIAL (Vikram Sarabhai International Airport Limited), which holds a 60-year concession.
  - At financial close you hold 64%, L5 Capital (Lagrange Point Infrastructure Fund) 16%, AAI 10% and MADC 10%.
  - The state leases the land at a nominal rent.
  - From the year-14 board you may buy L5 Capital's stake, 4% an era, up to 80%.
- **The bid:** a revenue share (10–50%) or a per-passenger fee (₹100–450). The highest bid wins and thins margins for 60 years.
- **Capex in stages** (`capex.stages`, est.). Recalibrated 2026-10-19: VSI is a ~7,100 ha site with six runways, one continuous roof and 209–260 MPPA, so it is priced against Istanbul (€22 bn, 7,600 ha, 200 MPPA ≈ ₹1,100 cr/MPPA) and Al Maktoum ($35 bn, 260 MPPA ≈ ₹1,185 cr/MPPA), less about a third for Indian costs and free land: **₹2,00,000 cr to 260 MPPA** (₹769 cr/MPPA; sensitivity 1.8–2.3 lakh cr; `capex.vsi_capex_frame`, `capex.peer_*`). The roof cannot be phased, so most of the premium is in 1A. Spend inside each stage is back-loaded, as BIAL's T2 was.

| Stage | ₹ cr (FY2026) | Built | Opens | Capacity | Traffic | What is built | BIAL analog |
|---|---|---|---|---|---|---|---|
| 1A | 60,000 (big: 85,000 for 70 MPPA) | years 1–4 (10/20/30/40%) | year 5 | 45 MPPA | BLR, L1 | 2 runways, the whole Hall and Mall roof, concourses A and B, people mover, tower, site works, access | phase 1 |
| 1B | 32,000 (after big: 16,000) | years 6–7 | year 8 | 95 | AMD+HYD, L2 | runways 3–4, concourse C | T1 expansion |
| 1C | 38,000 | years 9–10 | year 11 | 150 | BOM, L3 | runway 5, concourses D and E | T2 (one close, year 9) |
| 1D | 38,000 | years 11–13 | year 14 | 209 | DEL, L4 | runway 6, concourse F | T2 |
| Phase 2 G/H (option) | 32,000 | 2 years after it is ordered (expert: ordered at the year-14 board, built 15–16) | expert: year 17 | 260 | L5 | satellites G and H | T2 phase 2 |

- **What it means for the charge.** VSI must charge about ₹1,500 per passenger (FY2026 ₹, AERA building block, first control period; ₹1,060 averaged over years 5–23) to pay for itself. Bengaluru charges ₹606 and Delhi ₹379, because their airports were built far cheaper and long ago, and much of their cost is already paid off. The high charge costs VSI about a tenth of its passengers (demand elasticity). That is the lesson: a new giant airport is expensive to use.
- **Construction delay** (BIAL's T2 opened 21 months late). Phase 1 opening 12 months late: no revenue in year 5, interest falls due, the expert cures ₹1,875 cr, E3–E4 fall to 1.07–1.08 (covenant breach) and IRR drops to 11.8%. 21 months (modelled as 2 years): cure ₹5,666 cr, E3–E4 at 1.04, IRR 11.4%. A bad player 12 months late is taken over in year 5.
- **Retuned for the new capex** (documented levers only): back-loaded spend (BIAL T2: 18% of its spend in the first 3 of 7 years); the bank sculpts at 1.25 instead of 1.30 (at 1.30 bad and lazy fell by an unfunded instalment before the two-era rule); the expert asks 75% gearing and orders phase 2 at the year-14 board. No revenue multipliers. The bank's own base case never warns: 1.20 in year 5, 1.25 in every repaying year (fixed 2026-10-19: stages were sculpted on the previous sizing pass, so the year one stage hands over to the next oscillated; see `design/finance.md` §5.4). Peers on building cost: ₹510 (Istanbul, construction only, €10.2 bn ÷ 200 MPPA) to ₹1,150–1,185 (Al Maktoum) cr per MPPA; VSI's ₹769 is mid-range.
- **Wiring note (era.js, onboarding).** Pass the new figures to `ZMMoney.onboarding` as `capexCr` (60,000, `capex.stages.1A_lean.cost`) and as `phase1.options[].capexCr` (lean 60,000 for 45 MPPA; big 85,000 for 70 MPPA, `capex.stages.1A_big`), read from `money.json` through the era engine, not hard-coded. `game.financial_close` now holds the 1A basis (60,000; 42,000 debt at 70%; 18,000 equity) plus `capex_big_cr` and `full_build_cr`. `money/ui.js` still defaults `capexCr` to 56,000 and its `previewClose` uses 56,000; both should read these keys.

- **Eras:** E0 (years 1–4) is construction. E1–E4 are played on L1–L4 (years 5–7, 8–10, 11–13, 14–18). E5–E12 are played on Level 5, "Zero Mile, grown". AERA control periods run every 5 years from opening; the last runs from year 55 to year 60.

## Board meeting, endgame, hard rules
- **Board (Ship A):** results; the mandatory stage; the payout slider; the Mall upgrade (₹1,500 cr, ×1.15); runway rehab; phase 2 (from year 14); a cure.
- **Board (Ship B) adds:** the AERA order as one sentence with accept/fight; L5 Capital's blocks; shocks.
- **Endgame score:** IRR 35, handback 20, dividends ÷ equity 15, peak value 10, safety 10, stars 10. The last line reads: "*[Parent]* ran Zero Mile for 60 years. ₹X crore returned on ₹Y crore invested."
- **Hard rules:**
  1. Safety is never for sale.
  2. The expert earns the most.
  3. The ledger never calls `SIMR()` or writes sim state.
  4. Every line has a one-line "why".
  5. No revenue multiplier: `shift_money_multiplier` stays 1.0, and the old glide cap is gone (smoothing and true-up replace it).

## Acceptance (model, then bots)
1. With money off, bots are identical to `research/baseline_bots.txt`.
2. Expert has the highest shift EBITDA on L3 and L4; miser and spender earn less; handler and lazy lose money on L3 and L4.
3. Concession: expert lowest DSCR 1.10–1.20 with a warning at 1C/1D from the run (not the debt's shape) and a recovery; debt repaid; IRR within 12.4–17.3%. Bad play breaches 1.10 by E3 and is taken over. Lazy is taken over. **Model: met at ₹2 lakh cr capex** (1.14; 12.5%, at the floor; 12.7% with Airport City; bad and lazy taken over in year 13 by the two-era rule; the bank's base case never warns).
4. No console errors; `LEVELS[0..3]` unchanged; `zm_stars` untouched; a corrupt `zm_campaign` restores from `_bak`.

## GitHub checkpoints
| # | What |
|---|---|
| C1 | Research, design and the BIAL-calibrated model (`tools/concession_model.py`) |
| C2 | `era.js` from the model, and a node balance table |
| C3 | Ledger hooks and chip, gate green |
| C4 | Concession loop, onboarding, board and L5 (Ship A live, push to `main`) |
| C5 | Ship B |
