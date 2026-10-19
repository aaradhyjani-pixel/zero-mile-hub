# Finance: the BIAL-calibrated concession model

2026-10-19. This is the detail behind the money-design.md one-pager. Model: `tools/concession_model.py`. Run it with `python3 tools/concession_model.py all` (or `backtest`, or `vsi`; `zmi` is an old alias of `vsi`). It reads `money.json` and never writes it; every table below is pasted from its output. Where `design/eras.md` §5–7 differ (the glide cap, a WACC of 12.89%, era-average tests), this file wins.

> **2026-10-19 capex recalibration.** The capex is now ₹2,00,000 cr to 260 MPPA (phase 1 ₹60,000 cr lean, ₹85,000 cr big); the stage table, the retuned levers, the charge-per-passenger comparison, the delay sensitivity and the current tables are in money-design.md (Frame and the two pasted tables). The VSI tables in §4–§7 below predate it (the BIAL back-test in §3 is unchanged): rerun `python3 tools/concession_model.py all` for the current figures.

## 1. What the player sees (binding)
- **The model stays rich; the player sees three numbers:**
  1. Today's money.
  2. The lenders' light.
  3. Their stake and its value.
- **The light** is the lender DSCR of the worst single year so far in the era:

  | Colour | DSCR | What follows |
  |---|---|---|
  | Green | 1.20 or more | Dividends allowed under `finance.distribution_lockup`: 50% below 1.40, 75% below 1.55 |
  | Amber | 1.10–1.20 | Dividends locked |
  | Red | below 1.10 | Cash swept to the lenders |
  | Red, twice | below 1.0 in two eras running | Cure board, or the lenders step in |

- **Two or three decisions per era:**
  - the payout slider (dividends or prepay);
  - accept or fight the AERA order;
  - build (phase 2), when it is on offer.
- **Close and offers:**
  - At close the player chooses the bid, gearing, phase-1 size and the state loan.
  - Refinancing and the cure are yes/no offers that appear only when they apply.
- **Never shown as inputs: true-ups, RAB, WACC, sculpting.** Each is shown only as a consequence, in one plain sentence:

| Mechanism | Sentence on the board (example) |
|---|---|
| True-up recovered | "AERA let you recover ₹X cr you were owed." |
| True-up clawed back | "AERA took back ₹X cr you collected above your allowed return." |
| Carry at 1C/1D | "AERA held back ₹X cr of your tariff until year Y. The lenders are watching." |
| Push-hard cost | "AERA disallowed ₹X cr of your expansion cost. Airlines are adding flights elsewhere." |
| Bank sizing | "The bank will lend ₹X cr (Y% of the cost). You put in the rest." |
| Sweep | "Lenders took ₹X cr of this era's cash to pay down debt." |
| Refinance offer | "Three steady years: lenders offer 8.15% for 15 years. Accept?" |
| Cure | "Put in ₹X cr to keep the airport, or hand it to the lenders." |

- If a screen needs the glossary to be understood, it is cut.
- **Worst single year, not the average.** Era tests, tags, lock-ups, cures and step-in all use the era's lowest annual DSCR (`Engine.waterfall`, step 6).
- **The expert's warning comes from the run, not the debt's shape.**
  - The bank sculpts to 1.30 and lends into no interest-only year below 1.20. So its base case never warns: its lowest year is 1.20, at opening.
  - The expert's amber light at 1C/1D appears because the expansion opens into a control period in which AERA defers 13.9% of the tariff. That follows from building for the Mumbai and Delhi move-ins and accepting the order.
  - Removing the deferral removes the warning (§5.4).

## 2. The mechanisms
- **Traffic.**
  - Demand comes from the design-day premise of each level (`game.design_day_movements_by_level` × `game.pax_per_movement_by_level` × 311), growing at `world.game_traffic_growth` plus the star bonus.
  - It is capped at `game.capacity_headroom` × capacity.
  - Above the market yield (₹606 a passenger, BIAL FY2026), demand falls with elasticity 0.8 on the average fare (`game.demand_elasticity`, `game.avg_fare`).
- **AERA building block** (`Engine.plan_cp`).

  ARR = WACC × average aero RAB + depreciation + 0.66 × modelled O&M + tax − 0.30 × forecast non-aero, all ÷ (1 − 4% fee).
  - The RAB is 87.66% of capex plus interest during construction, at COD. The regulator's forecast includes renewals.
  - WACC = (52% × 15.05% + 48% × the actual debt rate) × (1 − the state loan's share), the loan counting at 0% as for BIAL.
  - Tax in the first plan is BIAL's ratio (4.0% of the return). After that it is the aero share of the tax actually paid.
- **Smoothing** (`Engine.plan_cp`).
  - One yield per control period, escalating with CPI. It is solved so that PV(yield × forecast pax) = (1 − carry) × PV(ARR) + the balance brought forward.
  - The carry is 13.9% in the control period when 1C/1D enter the RAB, as in BIAL's CP3 (`bial.aera.cp3_arr_and_shortfall`), and 0 otherwise.
  - Orders after CP1 apply 46% of the way into their first year (`bial.aera.order_lag_months`).
- **True-up** (`Engine.true_up`).
  - Each year's ARR is recalculated on actual traffic, actual non-aero, the allowed O&M (the lower of actual and benchmark), actual tax and that year's WACC, less collections.
  - The difference is discounted and carried at the plan WACC into the next period.
  - Service-quality rebates and bonuses stay out of it.
  - The last period runs from year 55 to year 60. Its true-up ends with the concession.
- **Costs.**
  - BIAL's fitted O&M plus the opening cost of new capacity (§3), and disruption above the lender base case of ₹60 a passenger.
  - Renewals = `game.renewal_share` (25%, rising to 100% over one asset life) × each built stage's cost re-priced to today ÷ 29.3 years. They are added to the RAB over a normal life.
  - Tax is 25.17%. Business losses carry forward 8 years; unabsorbed depreciation carries forward without limit.
- **Debt** (`vsi_build`, `size_debt`). Loans are drawn with spend; interest during construction is capitalised.

  | Stage | Loan | Moratorium after COD | Repayment |
  |---|---|---|---|
  | 1A | gearing × (cost − state loan) | 2 years | 14 years |
  | 1B | gearing | 1 year | 15 years |
  | 1C + 1D | 80:20, BIAL T2 | to year 14 | years 15–24 |
  | Phase 2 | 80:20 | 1 year | 10 years |

  - Repayment is sculpted on the lender base case's CFADS ÷ 1.30, each stage on the capacity the earlier ones leave. The interest-only years must cover 1.20.
  - Gearing and schedules are iterated until every year's debt service settles.
  - The DSRA holds two quarters of next year's debt service. It is funded at close and released above target.
  - Refinancing comes after 3 years at a lender DSCR of 1.20 or more past the last mandatory COD (`game.refi_trigger`), on BIAL's 2025 terms (8.15%, 15 years, 2-year moratorium).
  - The state loan is 0%, subordinated, 14.17% of 1A's built cost, repaid in 20 instalments from year 11, and deferrable by 10 years at the 1C/1D close.
- **Cash** (`Engine.waterfall`).
  1. CFADS less debt service, with the DSRA, then retained cash, covering any shortfall.
  2. The DSRA top-up or release.
  3. The sweep below 1.10, whatever the payout choice.
  4. The state loan instalment.
  5. Equity for capex, from cash first.
  6. At the era board: the test, then the cure or step-in, then the lock-up and payout.

  Retained cash and the DSRA earn the repo rate (5.5%) after tax.

## 3. Calibration on BIAL
| Parameter | Value | How | Fit |
|---|---|---|---|
| Asset life, assets before FY2018 | 16.0 years | fitted to AERA CP1 depreciation ₹789.23 cr (model 791) | in-sample |
| Asset life, assets from FY2018 (used for VSI) | 29.3 years | fitted to AERA CP3 depreciation ₹2,427.57 cr (model 2,428) | in-sample |
| RAB anchors not used in the fit | FY12 -0%, FY13 -0%, FY16 -1%, FY22 +5%, FY23 -12%, FY24 +10%, FY25 +6%, FY26 +8% | model average RAB vs AERA | out-of-sample |
| O&M fixed cost | ₹9.44 cr per mppa of capacity per year (FY2026 ₹) | least squares on BIAL opex (OI − EBITDA − 4% fee), years that are not openings | in-sample |
| O&M variable cost | ₹134 per passenger (FY2026 ₹) | same fit | in-sample |
| Opening cost of new capacity | 1.67 × the fixed O&M of the new capacity (greenfield: year 1, half in year 2, est.; expansion: years 1 and 2) | one term, least squares on the O&M residuals of FY2009 (opening) and FY2014-15 (T1) | in-sample |
| O&M model residuals | FY09 -28%, FY14 +20%, FY15 +15%, FY16 -3%, FY17 -1%, FY18 -6%, FY19 +7%, FY25 -8%, FY26 +7% | model ÷ actual − 1 | in-sample |
| O&M model residuals, T2 opening | FY23 +8%, FY24 +45% | model ÷ actual − 1 | out-of-sample |
| O&M in the ARR, shared-revenue till (pre-control, CP1) | 1.41 × modelled O&M | AERA CP1 allowed O&M ₹1,399.60 cr ÷ modelled FY2012-16 | in-sample |
| O&M in the ARR, hybrid till (CP2 on; used for VSI) | 0.66 × modelled O&M | AERA CP3 allowed O&M ₹2,669.89 cr ÷ modelled FY2022-26 | in-sample |
| Tax in the ARR | 4.0% of the return | AERA CP3 + CP4 tax ÷ return. Back-test plans and true-ups use it (BIAL's low actual tax, from its losses and the s.80-IA infrastructure deduction (est.), is not modelled). VSI uses it only for its first plan; after that AERA passes through the aero share of the tax VSI actually pays | in-sample |
| Non-aero FY2017-21 scale | ×1.00 | interpolated NAR scaled so OI − NAR = CP2 aero total ₹4,263 cr | input |
| T1 expansion debt (derived) | ₹727 cr | 2016 refinancing ₹1,813.74 cr less the phase-1 loan left at FY2016 | input |

### Back-test: BIAL actual vs the mechanism on BIAL inputs
| FY | Op yr | Pax (m) | Yield act | Yield model | err | EBITDA act | EBITDA model | err | Margin act | Margin model | DSCR act | DSCR model | Int act | Int model | Prin act | Prin model |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2009 | 1 | 7.2 | 333 | 333 | input | 144 E | 191 | +33% | 44% | 59% | 1.07 E | 1.42 | 135 E | 134 | 0 E | 0 |
| 2010 | 2 | 9.9 | 391 | 391 | input | — | 356 | — | — | 70% | — | 2.65 | — | 134 | 0 E | 0 |
| 2011 | 3 | 11.6 | 379 | 379 | input | — | 443 | — | — | 76% | — | 3.30 | — | 134 | 96 E | 0 |
| 2012 | 4 | 12.7 | 383 | 383 | input | — | 481 | — | — | 75% | — | 3.46 | — | 134 | — | 5 |
| 2013 | 5 | 12.0 | 396 | 396 | input | — | 453 | — | — | 73% | — | 3.13 | — | 134 | — | 11 |
| 2014 | 6 | 12.9 | 387 | 387 | input | 385 R | 338 | -12% | 60% | 52% | — | 1.52 | — | 186 | — | 37 |
| 2015 | 7 | 15.4 | 465 | 532 | +14% | 602 R | 659 | +9% | 66% | 65% | — | 2.31 | — | 200 | — | 86 |
| 2016 | 8 | 19.0 | 460 | 554 | +20% | 804 R | 984 | +22% | 71% | 75% | — | 2.82 | 187 E | 192 | — | 157 |
| 2017 | 9 | 22.9 | 427 D | 427 | input | 932 R | 935 | +0% | 71% | 71% | — | 5.24 | 172 E | 178 | — | 0 |
| 2018 | 10 | 26.9 | 425 D | 425 | input | 1,098 D | 1,123 | +2% | 70% | 72% | — | 6.30 | 183 E | 178 | — | 0 |
| 2019 | 11 | 33.3 | 284 D | 229 | -19% | 975 D | 764 | -22% | 65% | 58% | 5.60 | 4.15 | 168 E | 178 | 6 E | 6 |
| 2020 | 12 | 32.4 | 263 D | 244 | -7% | — | 793 | — | — | 59% | 3.90 E | 3.95 | 196 E | 164 | 37 E | 37 |
| 2021 | 13 | 10.9 | 317 D | 327 | +3% | — | 228 | — | — | 40% | 0.45 E | 1.64 | — | 139 | — | 0 |
| 2022 | 14 | 16.3 | 332 | 336 | +1% | — | 410 | — | — | 49% | 1.15 E | 2.27 | — | 181 | — | 0 |
| 2023 | 15 | 31.9 | 359 | 391 | +9% | 1,110 D | 1,151 | +4% | 60% | 59% | 2.00 E | 2.88 | 483 E | 400 | — | 0 |
| 2024 | 16 | 37.6 | 477 | 449 | -6% | 1,749 D | 1,245 | -29% | 64% | 47% | 1.45 E | 1.05 | 920 E | 1,163 | 320 E | 18 |
| 2025 | 17 | 41.9 | 581 | 516 | -11% | 2,720 D | 2,552 | -6% | 68% | 69% | 1.65 E | 1.96 | 1,088 E | 1,162 | 513 E | 139 |
| 2026 | 18 | 44.5 | 606 | 593 | -2% | 3,052 D | 2,932 | -4% | 72% | 70% | 2.10 E | 2.09 | 1,050 E | 1,150 | 380 E | 254 |

**Back-test honesty** (in-sample lines validate nothing; the true-ups are the test):
- Aero yield: mean absolute error **9%** over the 10 years the model calculates; 8 years are "input" (copied) and excluded.
- EBITDA: 13% over 11 years with a BIAL figure (11% over the 4 reported years, FY2014-17; FY2009 is in-sample through the opening term).
- DSCR: 57% over 9 years, but 8 of them are BIAL estimates; the one reported year, FY2019, is off -26%. The DSCR path is not reproduced year by year.
- True-ups (the real out-of-sample test of the regulator mechanism), model vs AERA, ₹ cr: pre-control (FY09-11) +73 vs +54.87; CP1 (FY12-16) -133 vs -313.62; CP2 (FY17-21) -301 vs -974.14; CP3 (FY22-26) +738 vs +603.38. Signs match in every period; sizes miss by up to 3.2×.
- Margin arc, BIAL vs model: FY09 44/59%, FY14 60/52%, FY15 66/65%, FY16 71/75%, FY17 71/71%, FY18 70/72%, FY19 65/58%, FY23 60/59%, FY24 64/47%, FY25 68/69%, FY26 72/70%. The plateau near 70%, the dip at T2 and the recovery are followed. Two misses: the opening is less tight than BIAL's (one opening term fits three openings, so it under-fits FY2009), and FY2024 is too low (the same term adds an opening cost to T2 that BIAL's accounts do not show: O&M +45% out of sample).

| CP start | WACC | Model YPP (ARR ÷ forecast pax) | True-up carried out of the CP (model) | AERA true-up |
|---|---|---|---|---|
| FY2009 | 10.97% | ₹388 | 72.5 | +54.87 at Mar 2011 (→ +179.76 by 2022) |
| FY2012 | 11.55% | ₹448 | -133.1 | −313.62 at Mar 2016 |
| FY2017 | 11.93% | ₹353 | -301.0 | −974.14 at Mar 2022 |
| FY2022 | 11.59% | ₹562 | 738.5 | +603.38 at Mar 2027 |

| CP | Basis | Avg RAB (sum) | Return | Depreciation | O&M | Tax | NAR deduction | ARR | Collections |
|---|---|---|---|---|---|---|---|---|---|
| CP1 | model plan | 9,544 | 1,102 | 791 | 1,353 | 44 | -367 | 3,045 | |
| CP1 | model true-up | 9,544 | 1,047 | 791 | 1,400 | 42 | -272 | 3,132 | 3,328 |
| CP1 | AERA order | 9,586 | 1,107 | 789 | 1,419 | 33 | -367 | 2,981 | 2,950 (planned) |
| CP2 | model plan | 22,034 | 2,629 | 1,601 | 1,483 | 106 | -752 | 5,278 | |
| CP2 | model true-up | 16,223 | 1,908 | 1,400 | 1,323 | 77 | -622 | 4,255 | 4,028 |
| CP2 | AERA order / true-up | | | | | | | 5,444 / 3,906 | 4,263 |
| CP3 | model plan | 42,297 | 4,902 | 2,428 | 2,676 | 197 | -875 | 9,717 | |
| CP3 | model true-up | 40,778 | 4,800 | 2,369 | 2,670 | 193 | -1,512 | 8,874 | 8,285 |
| CP3 | AERA order | 42,703 | 4,951 | 2,428 | 2,670 | 126 | -875 | 9,634 | 8,612 |

## 4. VSI results
Re-run 2026-10-19 (capex branch): ₹2,00,000 cr full build, bank sizing fixed (§5.4), Airport City added (§5.5).

### 4.1 Side by side, by operating year (also in money-design.md)
| Op yr | BIAL FY | BIAL pax m | VSI yr | VSI pax m | BIAL yield ₹ | VSI yield ₹ | BIAL EBITDA | VSI EBITDA | BIAL margin | VSI margin | BIAL DSCR | VSI DSCR | VSI lender DSCR | VSI event |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 2009 | 7.2 | 5 | 37 | 952 | 1,498 | 144 E | 5,291 | 44% | 71% | 1.07 E | 1.40 | 1.24 | opens (1A); BLR moves in (L1); CP1 |
| 2 | 2010 | 9.9 | 6 | 40 | 994 | 1,498 | — | 6,484 | — | 77% | — | 1.71 | 1.53 | opening costs (half year) |
| 3 | 2011 | 11.6 | 7 | 43 | 872 | 1,498 | — | 7,809 | — | 83% | — | 1.48 | 1.29 |  |
| 4 | 2012 | 12.7 | 8 | 79 | 812 | 1,498 | — | 14,327 | — | 77% | — | 1.52 | 1.28 | AMD+HYD move in (L2); 1B opens |
| 5 | 2013 | 12.0 | 9 | 86 | 762 | 1,498 | — | 16,276 | — | 78% | — | 1.59 | 1.30 | T2-style close for 1C+1D (80:20) |
| 6 | 2014 | 12.9 | 10 | 97 | 681 | 1,147 | 385 R | 15,940 | 60% | 80% | — | 1.56 | 1.25 | CP2: AERA carries 13.9% of PV ARR |
| 7 | 2015 | 15.4 | 11 | 146 | 773 | 898 | 602 R | 19,186 | 66% | 72% | — | 1.40 | 1.15 | BOM moves in (L3); 1C opens |
| 8 | 2016 | 19.0 | 12 | 157 | 729 | 898 | 804 R | 21,713 | 71% | 73% | — | 1.46 | 1.16 |  |
| 9 | 2017 | 22.9 | 13 | 165 | 647 D | 898 | 932 R | 25,350 | 71% | 78% | — | 1.50 | 1.16 |  |
| 10 | 2018 | 26.9 | 14 | 223 | 621 D | 898 | 1,098 D | 34,989 | 70% | 75% | — | 1.48 | 1.15 | DEL moves in (L4); 1D opens |
| 11 | 2019 | 33.3 | 15 | 230 | 403 D | 947 | 975 D | 39,506 | 65% | 76% | 5.60 R | 1.68 | 1.27 | CP3: CP2 true-up recovered; 1C/1D repaying; phase 2 build |
| 12 | 2020 | 32.4 | 16 | 230 | 355 D | 1,017 | — | 45,547 | — | 80% | 3.90 E | 1.89 | 1.40 |  |
| 13 | 2021 | 10.9 | 17 | 261 | 404 D | 1,017 | — | 52,900 | — | 79% | 0.45 E | 1.82 | 1.34 | phase 2 opens |
| 14 | 2022 | 16.3 | 18 | 278 | 401 | 1,017 | — | 58,153 | — | 78% | 1.15 E | 5.00 | 3.56 | refinanced (8.15%, 15 yrs) |
| 15 | 2023 | 31.9 | 19 | 286 | 406 | 1,017 | 1,110 D | 64,106 | 60% | 79% | 2.00 E | 5.51 | 3.89 |  |
| 16 | 2024 | 37.6 | 20 | 286 | 512 | 854 | 1,749 D | 57,771 | 64% | 78% | 1.45 E | 2.97 | 2.05 | CP4 |
| 17 | 2025 | 41.9 | 21 | 286 | 595 | 750 | 2,720 D | 54,067 | 68% | 76% | 1.65 E | 3.02 | 2.03 |  |
| 18 | 2026 | 44.5 | 22 | 286 | 606 | 750 | 3,052 D | 56,230 | 72% | 76% | 2.10 E | 3.09 | 2.04 |  |

### 4.2 Aligned on the second terminal (BIAL T2 ↔ VSI 1D)
| k | BIAL FY | BIAL pax m | VSI yr | VSI pax m | BIAL yield ₹ | VSI yield ₹ | BIAL margin | VSI margin | BIAL DSCR | VSI DSCR | VSI lender DSCR |
|---|---|---|---|---|---|---|---|---|---|---|---|
| -3 | 2020 | 32.4 | 11 | 146 | 355 | 898 | — | 72% | 3.90 E | 1.40 | 1.15 |
| -2 | 2021 | 10.9 | 12 | 157 | 404 | 898 | — | 73% | 0.45 E | 1.46 | 1.16 |
| -1 | 2022 | 16.3 | 13 | 165 | 401 | 898 | — | 78% | 1.15 E | 1.50 | 1.16 |
| +0 | 2023 | 31.9 | 14 | 223 | 406 | 898 | 60% | 75% | 2.00 E | 1.48 | 1.15 |
| +1 | 2024 | 37.6 | 15 | 230 | 512 | 947 | 64% | 76% | 1.45 E | 1.68 | 1.27 |
| +2 | 2025 | 41.9 | 16 | 230 | 595 | 1,017 | 68% | 80% | 1.65 E | 1.89 | 1.40 |
| +3 | 2026 | 44.5 | 17 | 261 | 606 | 1,017 | 72% | 79% | 2.10 E | 1.82 | 1.34 |

### 4.3 After BIAL's data ends
| Era | Years | Pax m (end) | Aero yield ₹ FY26 (avg) | Aero share of revenue | EBITDA ₹cr (end yr) | Margin (avg) | Lender DSCR (worst year) | Debt end ₹cr |
|---|---|---|---|---|---|---|---|---|
| E4 | 14-18 | 278 | 979 | 73% | 58,153 | 78% | 1.14 | 142,829 |
| E5 | 19-23 | 286 | 824 | 68% | 58,479 | 77% | 2.02 | 116,368 |
| E6 | 24-28 | 286 | 636 | 62% | 59,815 | 75% | 1.61 | 97,981 |
| E7 | 29-33 | 286 | 537 | 57% | 66,470 | 73% | 1.47 | 20,371 |
| E8 | 34-38 | 286 | 519 | 56% | 82,287 | 72% | 1.45 | 0 |
| E9 | 39-43 | 286 | 518 | 56% | 100,354 | 72% | repaid | 0 |
| E10 | 44-48 | 286 | 504 | 55% | 119,628 | 72% | repaid | 0 |
| E11 | 49-53 | 286 | 499 | 54% | 145,992 | 72% | repaid | 0 |
| E12 | 54-60 | 286 | 503 | 54% | 194,239 | 72% | repaid | 0 |

## 5. Scenarios and levers
### 5.1 Levers per scenario
| Scenario | Gearing asked (1A, 1B) | Phase 1 | State loan (0%, 14.2% of 1A) | Defer state loan at 1C/1D | AERA stance (carry in the 1C/1D CP / escalation / capex disallowed / airline drag) | Repayment | Refinance | Equity cure | Retain cash to | Phase 2 | Ops profile |
|---|---|---|---|---|---|---|---|---|---|---|---|
| EXPERT | 75% (1C/1D at 80%) | lean | yes | yes | normal (13.9% / CPI / 0.0% / +0 pp a year) | sculpt | yes | yes | no | years 15-16 | expert |
| BAD | 75% (1C/1D at 80%) | lean | no | no | hard (0.0% / flat nominal / 13.5% / -1 pp a year) | sculpt | no | no | no | no | poor |
| LAZY | 70% (1C/1D at 80%) | lean | no | no | normal (13.9% / CPI / 0.0% / +0 pp a year) | sculpt | no | no | no | no | lazy |

### 5.2 Lender DSCR by era (also in money-design.md)
Worst single year per era. W warning (< 1.20), C covenant breach (< 1.10), D below 1.0.

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

### 5.3 One lever at a time
| Run | E1 (5-7) | E2 (8-10) | E3 (11-13) | E4 (14-18) | E5 (19-23) | E6 (24-28) | E7 (29-33) | E8 (34-38) | E9 (39-43) | E10 (44-48) | E11 (49-53) | E12 (54-60) | Bank gearing 1A/1B/1C-1D | Outcome | Equity IRR |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| EXPERT | 1.23 | 1.25 | 1.14 W | 1.14 W | 2.02 | 1.61 | 1.47 | 1.45 | repaid | repaid | repaid | repaid | 63%/75%/80% | debt repaid | 12.5% |
| EXPERT, big phase 1 (70 mppa) | 1.24 | 1.25 | 1.14 W | 1.26 | 2.37 | 2.14 | 3.30 | repaid | repaid | repaid | repaid | repaid | 47%/75%/80% | debt repaid | 11.5% |
| EXPERT, no state loan | 1.23 | 1.25 | 1.14 W | 1.14 W | 2.12 | 1.68 | 1.54 | 1.52 | repaid | repaid | repaid | repaid | 61%/75%/80% | debt repaid | 12.2% |
| EXPERT, 75% gearing | 1.23 | 1.25 | 1.14 W | 1.14 W | 2.02 | 1.61 | 1.47 | 1.45 | repaid | repaid | repaid | repaid | 63%/75%/80% | debt repaid | 12.5% |
| EXPERT, 60% gearing | 1.28 | 1.25 | 1.14 W | 1.14 W | 2.36 | 1.84 | 1.71 | 1.69 | repaid | repaid | repaid | repaid | 60%/60%/80% | debt repaid | 12.1% |
| EXPERT, pushes AERA hard (appeals the back-loaded order) | 1.16 W | 1.10 W | 1.10 W | 1.07 C | 1.15 W | 4.27 | 4.08 | 3.99 | repaid | repaid | repaid | repaid | 63%/75%/80% | debt repaid | 10.5% |
| EXPERT, soft (25% carried) | 1.23 | 1.20 | 1.02 C | 1.03 C | 2.13 | 1.62 | 1.44 | 1.42 | repaid | repaid | repaid | repaid | 63%/75%/80% | debt repaid | 12.4% |
| EXPERT, equal instalments | 1.34 | 1.47 | 1.27 | 1.33 | 1.96 | 1.81 | 2.03 | repaid | repaid | repaid | repaid | repaid | 58%/69%/67% | debt repaid | 12.4% |
| EXPERT, no refinancing | 1.23 | 1.25 | 1.14 W | 1.14 W | 1.44 | 2.64 | repaid | repaid | repaid | repaid | repaid | repaid | 63%/75%/80% | debt repaid | 12.2% |
| EXPERT, prepay instead of dividends | 1.23 | 1.25 | 1.14 W | 1.14 W | 2.02 | repaid | repaid | repaid | repaid | repaid | repaid | repaid | 63%/75%/80% | debt repaid | 12.1% |
| EXPERT, keeps cash to year 15, then prepays what the lock-up traps | 1.23 | 1.25 | 1.14 W | 1.14 W | 3.27 | 2.72 | 2.46 | 2.44 | repaid | repaid | repaid | repaid | 63%/75%/80% | debt repaid | 12.4% |
| EXPERT, no phase 2 | 1.23 | 1.25 | 1.14 W | 1.14 W | 2.61 | 2.35 | 2.24 | 2.21 | repaid | repaid | repaid | repaid | 63%/75%/80% | debt repaid | 12.1% |
| EXPERT, Airport City on BIAL's land share (11% of the site) | 1.23 | 1.25 | 1.14 W | 1.14 W | 2.09 | 1.82 | 1.72 | 1.71 | repaid | repaid | repaid | repaid | 63%/75%/80% | debt repaid | 12.8% |
| EXPERT, COVID-type years 16-17 (BIAL FY21-22) | 1.23 | 1.25 | 1.14 W | 0.34 D | 1.49 | 3.17 | 2.34 | 2.17 | repaid | repaid | repaid | repaid | 63%/75%/80% | debt repaid | 12.3% |
| EXPERT, Nagpur-level fee 14.49% | 1.23 | 1.25 | 1.14 W | 1.14 W | 1.84 | 1.49 | 1.34 | 1.32 | repaid | repaid | repaid | repaid | 60%/75%/80% | debt repaid | 11.4% |
| EXPERT, land at a BIAL-style cost-recovery rent | 1.23 | 1.25 | 1.14 W | 1.14 W | 2.01 | 1.60 | 1.45 | 1.43 | repaid | repaid | repaid | repaid | 61%/75%/80% | debt repaid | 12.2% |

### 5.4 Where the expert's warning comes from
| Run | E2 (8-10) | E3 (11-13) | E4 (14-18) | Worst year |
|---|---|---|---|---|
| Lender base case (what the bank sized on) | 1.24 | 1.25 | 1.24 | year 8: 1.24 |
| EXPERT | 1.25 | 1.14 W | 1.14 W | year 11: 1.14 |
| EXPERT, AERA does not back-load the 1C/1D control period (no 13.9% carry) | 1.27 | 1.27 | 1.27 | year 8: 1.27 |
| EXPERT, no opening cost at the 1B/1C/1D expansions | 1.25 | 1.16 W | 1.20 | year 13: 1.16 |
| EXPERT, 60% gearing | 1.25 | 1.14 W | 1.14 W | year 11: 1.14 |
| EXPERT, pushes AERA hard | 1.10 W | 1.10 W | 1.07 C | year 14: 1.07 |

| Year-20 fix | |
|---|---|
| Symptom | Lender base case dipped to 1.18 in year 17 and year 20 (mandatory stages only). |
| Cause | Each stage is sculpted on the capacity the earlier stages leave, read from the previous sizing pass. In the year one stage finishes (1B→1C in year 17, 1C→1D in year 20) its last payment is a part-sized remainder that moved every pass, so the solve oscillated (30 passes, not converged) and the hand-over years were over-filled. Phase 2 did not overlap the 1A sculpt: 1A is repaid in year 15, phase 2 pays only interest from year 17. |
| Change | `size_debt` now sculpts each stage on what the earlier stages pay in the same pass (`Tranche.ds_at`); the interest-only cover is sized just inside 1.20. Converges in 10 passes; base case 1.20 in year 5, 1.25 in every repaying year. |

### 5.5 Airport City
| Year | Income ₹ cr | AERA counts ₹ cr (30%) | Aero charge per passenger ₹ |
|---|---|---|---|
| 16 | 316 | 95 | 1,801 |
| 18 | 1,024 | 307 | 1,948 |
| 20 | 1,846 | 554 | 1,757 |
| 21 | 2,303 | 691 | 1,590 |
| 26 | 5,139 | 1,542 | 1,489 |
| 30 | 8,205 | 2,462 | 1,574 |
| 40 | 12,146 | 3,644 | 2,167 |
| 50 | 17,979 | 5,394 | 3,083 |
| 60 | 26,613 | 7,984 | 4,714 |

Your land earns ₹8,205 cr a year; AERA counts ₹2,462 of it against your airline charges. (year 30) (year 30, expert who builds it.)

### 5.6 IRR basis


| Run | Equity IRR |
|---|---|
| EXPERT | 12.5% |
| EXPERT, builds Airport City | 12.7% |
| BAD | equity lost |
| BAD, builds Airport City | equity lost |
| LAZY | equity lost |
| LAZY, builds Airport City | equity lost |
| EXPERT, big phase 1 (70 mppa) | 11.5% |
| EXPERT, no state loan | 12.2% |
| EXPERT, 75% gearing | 12.5% |
| EXPERT, 60% gearing | 12.1% |
| EXPERT, pushes AERA hard (appeals the back-loaded order) | 10.5% |
| EXPERT, soft (25% carried) | 12.4% |
| EXPERT, equal instalments | 12.4% |
| EXPERT, no refinancing | 12.2% |
| EXPERT, prepay instead of dividends | 12.1% |
| EXPERT, keeps cash to year 15, then prepays what the lock-up traps | 12.4% |
| EXPERT, no phase 2 | 12.1% |
| EXPERT, Airport City on BIAL's land share (11% of the site) | 12.8% |
| EXPERT, COVID-type years 16-17 (BIAL FY21-22) | 12.3% |
| EXPERT, Nagpur-level fee 14.49% | 11.4% |
| EXPERT, land at a BIAL-style cost-recovery rent | 12.2% |

## 6. Scale
There is no single ×5. VSI is its own premise (design-day traffic, the capex stages in money-design.md) run on BIAL's unit costs and mechanisms. Capex (FY2026 ₹): phase 1 ₹60,000 cr vs BIAL ~₹5,100 cr = ×11.8; full build ₹168,000 cr vs ~₹20,500 cr = ×8.2. Traffic by operating year: ×3.7 to ×9.5 (×24 against BIAL's COVID year). Mature traffic (op year 18): VSI 286 m vs BIAL 44.5 m = ×6.4. So VSI is ×8 on full-build capex, ×12 on phase 1 and ×4-10 on traffic; it reaches its mature traffic in 10 operating years where BIAL took 18, so it carries fewer passengers per rupee of capex than BIAL did, which is why its charge per passenger is higher.

## 7. What the model does and doesn't reproduce
- **Reproduces:**
  - The building block (in-sample).
  - The sign of all four BIAL true-ups.
  - BIAL's aero yield within 9% over the 10 calculated years.
  - EBITDA within 11% over the 4 reported years.
  - The ~70% margin plateau, the dip at T2 and the recovery.
  - VSI's own arc: a tight but bankable opening, a plateau, an amber light at 1C/1D, then recovery.
- **Doesn't reproduce:**
  - The size of the true-ups. CP2 is −301 against −974: the model's clawback for T2's late capitalisation is about a third of AERA's. CP3 is +738 against +603: the true-up deducts 30% of actual non-aero, −1,512 against AERA's −875, including FY2025's one-off land income.
  - BIAL's year-by-year DSCR. Only FY2019 is reported, and it is 26% off.
  - FY2024 interest (1,163 against about 920) and principal (18 against about 320). BIAL's T2 schedule isn't published; the model sculpts on traffic.
  - The tightness of BIAL's opening year.
  - FY2024's EBITDA: the opening term adds a T2 opening cost BIAL didn't show.
- **The margin arc.** BIAL ran 44% → 60–71% → 65% (FY19) → 60% (T2) → 72%. VSI runs 61% → 69–77% → 64–65% (1C) → 67–74% → 68% (phase 2) → 66% late. The shape follows except the opening. Two honest fits for the opening, with no fudge factor:

  | Opening term | VSI margin, years 5 / 6 / 7 | Bank gearing on 1A | E1 worst year | Expert lowest year | Expert IRR |
|---|---|---|---|---|---|
| one term, three openings (default) | 61% / 69% / 77% | 65% | 1.23 | 1.16 (year 14) | 13.5% |
| greenfield term on FY2009 alone | 47% / 63% / 77% | 49% | 1.25 | 1.16 (year 14) | 12.6% |

  - **Option A (default):** one term on three openings. VSI opens at 61%; IRR 13.5%.
  - **Option B:** fit FY2009 alone (`greenfield_alone`). VSI opens at 47% like BIAL; the bank lends 49% on 1A; IRR 12.6%, still in the band. It rests on one estimated point.
  - **Option C (not built):** an opening tariff lag like BIAL's late domestic UDF, a 7-month ARR shortfall of 22%, played as an opening shock. This is the closest to what really squeezed BIAL in FY2009, but it is an event, not a calibration.
- **Hand-set.** The ops profiles behind BAD and LAZY are estimates until the Step 5 bots report real shift results.

## 8. The audit (`/tmp/zmh/bial_audit.md`): every finding and what was done

| # | Finding | Status |
|---|---|---|
| A1 | Yield error counted copied years | **Fixed.** Error over the 10 calculated years only (9%); the 8 copied years are marked "input" |
| A2 | Tariff match mostly fitted; true-ups left out | **Fixed.** Every fitted line is labelled in-sample. All four true-ups are in the summary. The CP3 plan uses AERA's own non-aero (nar_30pct ÷ 0.3) |
| A3 | DSCR path not reproduced; estimates unflagged | **Fixed / left.** DSCR error reported (57%), E flags in every table, 2016 refi at ₹1,813.74 cr on its actual FY2019–20 schedule. FY2024 interest and principal still miss (BIAL's T2 schedule isn't published) |
| A4 | No opening squeeze; margin arc inverted | **Fixed / left.** One opening term (FY2009 + FY2014–15), applied to VSI years 5–6 and to each expansion's first two years. The arc is no longer inverted. The opening is less tight than BIAL's (options in §7) |
| A5 | Back-test inputs not BIAL's or hard-coded | **Fixed.** T1 debt derived from the 2016 refinancing, not the game's 70%. Every assumed input is in `bial.backtest_inputs` with `estimate:true` |
| B1 | True-up re-priced at end-of-CP WACC | **Fixed.** Each year at its own WACC, carried at the plan WACC |
| B2 | No target DSCR; warning from the sculpt | **Fixed.** Sized to 1.30 (1.20 in interest-only years); phase 2 out of the base case; 1A pays principal from year 7. The base case never warns, and the warning comes from the 1C/1D carry |
| B3 | Era average instead of worst year | **Fixed.** Tests, tags, lock-up, cure and step-in all on the worst single year |
| B4 | Sweep switched off by the retain lever | **Fixed** |
| B5 | Cure money vanished; sized to 1.0 | **Fixed.** Cure goes to prepayment, sized to restore 1.10. An unfundable payment is funded at once if the player cures |
| B6 | DSRA never released | **Fixed** |
| B7 | Tags understated severity | **Fixed.** Tags come from the worst year |
| C1 | State loan 1.8× too generous; gearing; land | **Fixed / left.** Loan at 14.17% of built cost. Land is a lever (nominal, or BIAL-style cost-recovery rent ₹154 cr a year: IRR −0.4 pt). BIAL's ~78% gearing is outside the user's 60–75% range, so it is left |
| C2 | Pushing AERA hard had no cost | **Fixed.** 13.5% capex disallowance plus −1 pt airline growth: IRR 12.2% against 13.5%, and a covenant breach |
| C3 | Late-game yield collapse | **Fixed.** Renewals at replacement cost; real yield steady at ~₹305 from E9; era table to E12 |
| D1 | No single ×5 | **Fixed.** Stated as a range (§6), with a T2-aligned table. Scaling demand to BIAL × 5 was not chosen: VSI keeps its premise |
| D2 | IRR currencies mixed | **Fixed.** Every IRR is nominal rupees, and the basis is stated |
| E1 | Expert's warning from the sculpt; IRR 12.4% after B1 | **Met.** Lowest year 1.16 (year 14), amber in E3–E4 from the carry, recovery to 2.3+, IRR 13.5% |
| E2 | Bad stepped in by running out of cash | **Met.** Opens at 1.11; D in E2 (0.96) and E3 (0.88); the two-era rule fires at year 13. That year's instalment is also unfunded, and both are reported |
| E3 | Lazy | **Met.** 0.95 and 0.92; the two-era rule fires at year 10 |
| E4 | Delhi card | **Fixed.** Run on the expert's bank-sized debt with no step-in: −0.30 to 0.23 through E5 |
| F1 | Hard-coded numbers | **Fixed.** Moved to `money.json` (§9). What is left in code are solver settings (sizing damping 0.7, room clamp 0.3–1.5, weight floor 1e-6) and numbers derived from other keys |
| F2 | money-design.md said "20 years after a 1-year moratorium" | **Fixed.** The stage terms are restated |
| F3 | Unlimited tax-loss carry | **Fixed.** 8 years for business losses; no limit for unabsorbed depreciation |

## 9. money.json keys added (same entry format, sourced or `estimate:true`)
- **game:** `cpi`, `demand_elasticity`, `avg_fare`, `airline_relations_drag`, `soft_push_carry`, `renewal_share`, `lbc_dscr_target`, `lbc_interest_only_cover`, `refi_trigger`, `ops_profiles`, `pax_per_movement_by_level`, `move_in_years`, `capacity_headroom`, `nar_convergence`, `covid_sensitivity_years`, `state_loan_defer_from_year`, `land_rent`.
- **capex:** `stages`.
- **finance:** `tax_rate`, `loss_carry_years`, `stage_loan_terms`.
- **world:** `inr_usd_depreciation`.
- **bial:**
  - `cpi_india_fy`, `opening_cost_fit`, `backtest_inputs.*` (8 entries);
  - `aera.cp1_order_building_block`, `aera.useful_life_rule`, `aera.order_lag_months`;
  - `path.ebitda_basis`, `ssa.land_site_cost_cap`.
- The model reads all of them from `money.json` (`MOVED` in the code). The literal in `PARAMS` is only a fallback.
