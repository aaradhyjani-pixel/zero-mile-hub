> **Built already:** the onboarding, chip, floaters, P&L tab, board meeting, income statement and handback screens are implemented by the review session in `money/ui.js` (contract: `money/CONTRACT.md`, driven through `window.ZMMoney`). This file is the design reference; the wiring calls `ZMMoney.*` and does not build a second UI. Names come from `ZMMoney.config`; never hard-code "Zero Mile" in new code (the airport will be renamed in one sweep).

# Onboarding and money UI: the screen-by-screen spec

This spec is the onboarding draft, reconciled with the judge memo. Its numbers come from `money.json`, with keys cited as `section.key`. Era maths are in `design/eras.md`; code hooks are in `design/hooks.md`.

**Owner (Ship A):** one agent writes `money/onboarding.js`. It runs alongside the hub.js wiring and never edits hub.js.

**Changes from the draft:**
- **Phase 1A figures:** ₹36,000 cr and 45 MPPA. Every equity figure is recomputed from them.
- **Rival bids** are rebanded.
- **Opening** is in Year 5.
- **Stake purchases** open at the year-14 board.
- **AAI and MADC** pay cash for their stakes. The land is a nominal lease.
- **Live readouts** come from `money/era.js`'s lender base case, not from rules of thumb.
- **Runway cost** is ₹26k/h, with no ATC.
- **In-game money UI** in quick play is limited to one chip.

---

## 0. Shared look

### Base tokens
These already exist in `hub-head.html`:
- `--sign #f4c430` / `--sign-ink`
- `--go`, `--stop`, `--warn`
- `--panel`, `--panel-edge`, `--ink`
- `--dep` / `--arr` / `--cool`

Headings use `--f-sign` (Barlow Condensed) and every number uses `--f-mono` (JetBrains Mono).

### New tokens
Add these to `hub-head.html` `:root`. The change is additive.

| Token | Value | Used for |
|---|---|---|
| `--paper` | #ece7da | AERA order, share certificate |
| `--paper-ink` | #17130c | text on paper |
| `--brass` | #c9a227 | seals, the 80% re-stamp |
| `--kraft` | #c8a46a | bid envelopes |
| `--wax` | #b3261e | wax seals, the COD stamp |
| `--fund` | #6aa3ff | L5 Capital (same as `--cool`) |
| `--aai` | var(--dep) | AAI |
| `--madc` | #ff8a2b | MADC (Nagpur orange) |

### Money formatting
- `fmtR(inr)` lives in `money/era.js` so it can be shared:
  - below 1e5 → "₹42k";
  - below 1e7 → "₹4.2 L";
  - otherwise → "₹1.42 cr".
- Onboarding and board screens use Indian grouping for crore figures, for example "₹25,200 cr" or "₹1,04,000 cr".
- Negative amounts show as "−₹4.2 L" with a true minus sign, in `--stop`.

### Motion
- Ease-out, 200–900 ms.
- Under `prefers-reduced-motion`, every animation jumps straight to its end state.
- Every animated screen has a "Skip ›" in the top-right corner.
- Keyboard:
  - Tab order follows the reading order.
  - Enter presses the primary button.
  - ←/→ move dials and sliders by 1 step; Shift+←/→ moves them by 5.

### Module contract
- **Injection:** `money/onboarding.js` is injected by build.py at `/*@@MONEY@@*/`. It gets the same `node --check` and the same skip-on-fail rule as `3d/` modules.
- **Data:** build.py also embeds `money.json` as `<script type="application/json" id="moneyData">`.
- **API:** `window.ZMONB.run({money, era: window.ZMERA, seed, resume}) → Promise<{parent, font, color, bid, rivals, close, construction}>`.
  - The promise rejects if the player quits to the menu.
- **Rendering:** the module renders into its own root `<div id="onb">` at z-index 30, so it never fights `menu()` for `#sheet`. It removes the root when it is done.
- **Saving:** hub.js (`money/campaign.js`) writes the result into `zm_campaign`. The module itself never touches localStorage, except `zm_onb_draft`, a crash-safe draft of the half-finished onboarding.
- **If the module is missing** (skipped by build.py), the Concession card shows "Concession mode unavailable in this build". Quick play is unaffected.
- **Bots** never load it. Balance runs call `ZMERA.quickClose(defaults)` directly.

---

## 1. Onboarding: 6 screens, about 90 seconds

Progress pips run along the top: Company · Partners · Bid · Close · Build · Open.

### S1. Name your company

**Left side**
- **Input:** a big field, 54px `--f-sign`, with the caret in `--sign`.
  - At most 32 characters; the placeholder is "Meridian Infra".
  - The text is trimmed and collapsed. Empty → the button is disabled.
- **Font tiles:** 8 tiles under the input. Each tile shows the typed name in its font, plus a one-word personality.

| Font (Google) | Personality | Note |
|---|---|---|
| Rozha One | Old House | ledger serif; Latin and Devanagari |
| Cinzel | Empire | Roman capitals |
| Unbounded | New Money | wide geometric |
| Fraunces 700 (soft) | Family Firm | |
| Teko 600 | Engineering Group | |
| Yatra One | Highway Swagger | truck-art brush |
| Bungee | Signage | |
| Syne 800 | Design-led | |

  A ninth tile, "House", uses Barlow Condensed. It is already loaded and costs nothing, and it is the fallback.
- **Brand colour:** a row of 6 swatches. The first is `--sign`; the others are deep red, teal, ink blue, saffron and white. The colour is used on the terminal sign and the share ring.

**Font loading** happens only in Concession, so bots never fetch fonts.
- When S1 opens, one `<link href="https://fonts.googleapis.com/css2?family=…&display=swap">` is injected. Google splits fonts by `unicode-range`, so only the Latin woff2 files download: about 25 KB each, roughly 200 KB in total.
- Each tile shows the fallback until `document.fonts.load('48px "Rozha One"', name)` resolves, with a 2.5 s timeout. It then cross-fades over 150 ms.
- If a font fails, its tile says "(offline: House)" and still works with the fallback.
- On later boots only the chosen family loads, with `&text=` set to the company name, which is a few KB.

**Right side: live preview.** A carousel of 3 previews advances every 3.5 s; clicking a dot pins it.
1. **Terminal sign.**
   - A `--sign` slab, 560×120. The name is in the chosen font, uppercase, in `--sign-ink`.
   - A Barlow line underneath reads "ZERO MILE INTERNATIONAL · A {NAME} COMPANY".
   - A light sweep (a gradient mask) crosses it every 2.4 s.
2. **Boarding pass.**
   - A white stub with a perforation, "ZMI → BLR", seat 1A.
   - It reads "OPERATED AT ZERO MILE BY {NAME}" in the chosen font.
   - The barcode is SVG bars generated from a hash of the name.
3. **Share certificate.**
   - `--paper` background, with a guilloche border (an SVG of 12 rotated ellipses at 4% opacity) and a `--brass` seal.
   - It reads "This certifies that {NAME} holds 64% of the equity of Zero Mile International Airport Limited". The certificate number is the campaign seed.

**Button:** "Form the company ›".

**Saved as:** `zm_campaign.parent = {name, font, color}`.

### S2. The SPV reveal

**Ring.** A centred SVG donut, r=120 with stroke 30, drawn segment by segment with `stroke-dashoffset`:
1. **{NAME}**, 64% (`--sign`, or the brand colour). It draws over 900 ms.
2. **L5 Capital: Lagrange Point Infrastructure Fund**, 16% (`--fund`), 400 ms.
3. **AAI**, 10% (`--aai`), 300 ms.
4. **MADC**, 10% (`--madc`), 300 ms. Its label reads "MADC, the State of Maharashtra's airport and MIHAN developer" (`ppp.madc_role`, verified).

**Centre text:**
- "ZMIAL", in the player's font;
- "Phase 1A · ₹36,000 cr · 45 MPPA" (`capex.stages[0]`).

**Path to 80%:**
- After 600 ms, a dashed `--sign` ghost arc creeps over the fund's segment from 64 to 80.
- The label reads: "Grow to 80%: buy L5 Capital out, 4% an era, at a price set by the airport's value and your track record."
- A small line reads: "Stake purchases open at the year-14 board." The lock-in ends at opening + 7 years (`finance.equity_lockin.years_after_cod`), which is year 12; the first board after that is in year 14. This is labelled a game rule, because the real lock-in binds the lead seller.

**Partner cards.** Four small cards sit under the ring:
- you, the chair;
- L5 Capital: board nominee **Meera Kesar**, "patient money, wants steady dividends";
- the AAI nominee;
- the MADC nominee.

**Footnote:**
- Precedents: Fairfax holds BIAL at 64/13/13 (`ppp.fairfax_bial_stake`); AAI holds 26% of DIAL and MIAL (`ppp.state_stake_precedent`).
- "The state leases the land at a nominal rent; AAI and MADC pay cash for their shares, as AAI did for its stake in DIAL."

**Button:** "To the tender room ›".

### S3. The bid board (an AAI tender room)

**Bid type.** A two-way toggle:
- **Revenue share** to the grantor: a slider from 10–50%, in 0.1 steps. The research range is 12.6–46% (`ppp.rev_share_bid_range`).
- **Per-passenger fee:** a slider from ₹100–450, in ₹1 steps (`ppp.ppf_bid_range` is 115–401). International passengers pay 2× and the fee is indexed to CPI (`ppp.ppf_aai_2019` note).

**Live readouts.** These come from `ZMERA.baseCase({bid, gearing: 0.70, profile: 'sculpted'})`, recomputed on input and debounced to 60 ms.
- **₹ per passenger to AAI in CP1.** For a revenue share this is share × base-case revenue per passenger (about ₹1,150 in CP1).
- **Thinnest-year DSCR** (lender base case), as a needle with marks at 1.0, 1.2 and 1.3.
- **Expected equity IRR** for an expert-like operator, with the band 12.4–17.3% (`finance.equity_irr_benchmark`) shaded.
- **Bank's lending cap** at this bid, as a % of the cost.

**Rivals.** Three fictional rivals, each drawn once per seed from inside its band:

| Consortium | Personality | Band (memo, rebanded) |
|---|---|---|
| Kármán Line Ventures | aggressive, "win everything" | 16–21% share |
| QNH Infragenesis | Indo-European operator JV | 12–16% share |
| Thakral–Wainganga Airports | patient pension money | ₹140–190 per passenger |

- **Comparing bids.** A per-passenger bid is converted to a share equivalent: the PV of its fee divided by the PV of base-case gross revenue over 60 years. The highest equivalent wins, and a tie goes to the player.
- **Final bands** are set in Step 5 balance so that a win needs about 14–18%, which keeps the expert's IRR inside 12.4–17.3%.
- **Clash check before shipping.** Search each fictional name (L5 Capital: Lagrange Point Infrastructure Fund, Meera Kesar, Kármán Line Ventures, QNH Infragenesis, Thakral–Wainganga Airports) for real companies or people in infrastructure and aviation. Rename on any close hit and log the result in `progress.md`.

**Reveal.**
- Four `--kraft` envelopes with `--wax` seals sit on a dark panel, one of them yours, and open in ascending order:
  - the flap rotates on X from 0 to 180° over 400 ms;
  - the card slides up over 300 ms;
  - the number counts up over 600 ms;
  - there is a 900 ms gap before the next envelope.
- The highest bid gets a red "H1" stamp.
- **Win:** a `--go` flash and "ZMIAL is the concessionaire".
- **Loss:** the winning rival's crest, then the explainer, for example: "Kármán Line pays AAI 19.4% of every rupee for 60 years. You bid 15.2%. Bid closer, or accept a thinner company." Then "Re-tender ›", which re-seeds the rivals and keeps the player's name. Re-tendering is unlimited.
- **Either way:** two lines of "What this means". DIAL pays 45.99% on an old, cheap asset base; Navi Mumbai pays 12.6% on a greenfield (`ppp.rev_share_*`). "Greenfields win at 12–18% because the asset base is new and expensive."

**Ship B addition.** A small toggle, "ROFR within 150 km: +1 pp on your bid (est.)", from `world.mial_rofr_2019` and `world.rofr_radius_dial`. It decides who owns the rival airport if the new-rival shock fires.

### S4. Financial close

**Left side: the gearing dial.**
- A 240° arc covering 60–75% debt (`finance.gearing_range`), with a needle.
  - It is draggable; ←/→ move it 1%.
- **The bank's cap** shows as a red tick on the arc, at min(75%, PV(lender base-case CFADS ÷ 1.30) ÷ cost). The needle cannot pass it.
  - When the needle hits the cap, it shakes and reads: "The banks won't lend more on these cash flows."

Readouts for Phase 1A, ₹36,000 cr:

| Item | 60% | 70% | 75% |
|---|---|---|---|
| Debt | ₹21,600 cr | ₹25,200 cr | ₹27,000 cr |
| Equity (100%) | ₹14,400 cr | ₹10,800 cr | ₹9,000 cr |
| Your equity (64%) | ₹9,216 cr | ₹6,912 cr | ₹5,760 cr |
| L5 Capital (16%) | ₹2,304 cr | ₹1,728 cr | ₹1,440 cr |
| AAI / MADC (10% each) | ₹1,440 cr | ₹1,080 cr | ₹900 cr |
| Equal instalment (9.5%, 20 years) | ₹2,451 cr/yr | ₹2,860 cr/yr | ₹3,064 cr/yr |

- A footnote says that later stages 1B–1D (₹68,000 cr) are financed at the same gearing when they are built.
- A "Default risk" bar shades from `--go` to `--stop` as the thinnest-year base-case DSCR approaches 1.0.

**Right side: the repayment chart.**
- 21 bars, one per year after opening. Year 5 is the moratorium (interest only), followed by a 20-year tenor at 9.5% (`finance.loan_tenor_years`, `loan_rate_base`).
- Overlays:
  - the CFADS line from the lender base case, which steps up at years 8, 11 and 14 as the cities move in;
  - a dashed floor at DSCR 1.20 (`finance.dscr_warning`);
  - a dotted line at 1.30, the sculpting target.
- **Sculpted** (the default): DS_y = CFADS_base_y ÷ k, where k ≥ 1.30 is solved so that the PV of debt service at 9.5% equals the debt.
- **Equal instalments:** A = D·r/(1−(1+r)^−20).
  - Early bars turn red where they cross CFADS/1.2. At 70% gearing the first repayment year comes in at about 0.98: that is the lesson.
  - The bank's cap drops to about 53% for an equal profile, and the dial's red tick moves visibly.
- **Toggle animation:** the bars morph over 500 ms. A caption reads "Thinnest year: Y{n}, DSCR {x}".
- **Copy:** "More debt: a higher return on your rupee, and less room for a bad year. Sculpted repayments follow your cash; equal ones bite in the thin early years."

**Button:** "Sign financial close ›". A pen-stroke animation draws the player's name under "for {NAME}".

### S5. Construction, years 1–4 (`capex.zmi_construction_years`)

A horizontal strip of years 1–4, with a crane glyph that advances along it. There are three decision cards; each runs for 15 s and then takes its default. Each card shows the ₹ cost, the months of delay and the change in thinnest DSCR, all from era.js.
1. **Year 2: an 8% overrun on the roof steel, ₹2,880 cr.**
   - **(a)** Shareholders pay it pro rata. Your share is ₹1,843 cr, an extra equity outflow in year 2.
   - **(b)** Slip opening by 4 months. Interest during construction at 10.5% (`finance.loan_rate_construction`) adds about ₹880 cr to the cost, financed at your gearing, and year-5 revenue × 8/12.
   - Default: (a).
2. **Year 3: monsoon delay.**
   - **(a)** Pay for night shifts: ₹600 cr (est.), pro rata.
   - **(b)** Slip 2 months: about ₹440 cr of interest during construction, and year-5 revenue × 10/12.
   - Default: (b).
   - If both slips are taken, they add up to 6 months.
3. **Year 4: phase 2 enabling works for satellites G and H.**
   - **(a)** Buy the option now: ₹1,400 cr (est., 10% of `world.game_capacity.phase2_cost_cr` ₹14,025 cr). Phase 2 then costs ₹12,622 cr in today's money and has no slip risk (`world.game_capacity.slip_p` → 0).
   - **(b)** Defer it to the Level 5 eras.
   - Default: (b).

All three choices are saved in `zm_campaign.construction`.

### S6. Opening day
- A "COD" (commercial operation date) certificate stamps on screen in `--wax`, scaling in from 1.15 to 1.
- The clock flips to **"Year 5 · 05:55"**, then to "Year 5 · 06:00".
- `startLevel(1, eraPatch(E1))` runs, and its existing "Last flight out of Kempegowda" coach moment plays unchanged.

### Re-entry and skipping
- On the second and later campaigns, S1 is prefilled from the last campaign, and every screen offers "Same as last time ›".
- S3 and S4 can never be skipped: they are the decisions.

---

## 2. In-game money UI

### Top-strip chip (quick play and Concession)
- A new `.kpi#kCash` is appended to `#kpis` in `hub-body.html`, with the same markup as the existing KPIs.
- **Value:** "Today ₹1.42 cr", in `--f-mono` at 17px.
  - In Concession the label reads "ZMIAL", and hovering shows "at this pace: ₹2,610 cr/yr". The pace is (M(y)/S.sched) × 311.
- **Sparkline:** a 64×18 canvas showing the last 30 sim-minutes, sampled every 60 sim-seconds. The line is `--go`, or `--stop` while the last 10 minutes are net negative.
- **Second line:** "+₹38 L/h" at 11px.
- **Quick play shows only this chip** (no tab, no floaters, no prices on calls). Its tooltip says: "Full books in Concession mode." Quick play uses the card tariff (k = 1).

### Map floaters (Concession only)
- A separate `MFLOATS` list, drawn by `MNY.drawFloats(projector)` in the 2D `draw()` (next to `drawFloats`) and in `hub3d.js` line ~599. The existing "+1" floaters are unchanged.
- **Sources:**
  - **Landing:** green, at touchdown. A widebody gets gold; an A380 gets gold at 19px with a `tickSound` coin tick.
  - **UDF plus retail:** teal, at lift-off.
  - **Care cost:** red, at the gate when a connection is missed.
  - **Stack fuel claims:** red, at the stack centre once per 60 sim-s. The stack also shows a live label, "STACK −₹61k/min".
- **Aggregation:**
  - Floaters are bucketed on a 160px screen grid in 1 s windows, with same-sign amounts summed.
  - At most 6 show at once, and the smallest are dropped first.
  - When zoomed out (cam scale < 0.5 × fit), only amounts of ₹1 L or more show.
  - Money floaters sit 16px above the "+1" and start 0.3 s after it.

### Runway desk (Concession only)
- Each row's `.st` line gets a right-aligned "₹26k/h" (`costs.runway_open_per_hour`), greyed when the runway is OFF.
- Hovering a mode button (`previewOn`) adds one line, for example: "OFF: saves ₹26k/h · −38 deps/h ≈ ₹53 L/h at risk".
  - **At risk** = the capacity lost × the demand on the bank chart over the next 30 minutes × the average revenue per movement for this shift.
  - It is shown only when the hover changes capacity.

### P&L tab (Concession only)
- A fourth `.tabbar` button, "P&L", is added in Concession, with the pane `#tabPnl`.
- **Lines:**
  - 5 revenue lines in `--go`: landing, parking, UDF, retail & F&B, hub incentive;
  - 5 cost lines in `--stop`: runways open, ops teams, SLA credits, passenger care, fuel claims.
- **Each row:** the term as a glossary link (`data-term`), a running total in mono, and a 40px bar.
  - The row's `title` holds the formula in words, for example "Landing: ₹347 per tonne × MTOW, minimum ₹8,000, from Delhi's AERA order".
  - A row flashes for 300 ms when it moves by ₹1 L or more.
- **Bottom:** a bold "Shift EBITDA" row and a grey "Era aero is set by AERA, not by this shift" note with a glossary link.
- **Glossary terms added:** aeronautical vs non-aeronautical revenue, MTOW, UDF, AERA, hybrid till, RAB, SLA, A-CDM, EBITDA, DSCR, valuation, force majeure.

### Money on calls (Concession only)
- `MNY.price(I)` runs at the end of `spawnInc`. It sets `I.mny = [{i, txt, tone}]`, and `renderInc` prints an 11px line under each button. Examples:
  - **connex:** "Hold 10 min: saves ₹3.0 L in care, transfer spend and incentive · about ₹15k in SLA credits" against "Go now: −₹3.0 L".
  - **heavy:** "Offload and go: −₹4.0 L (40 × ₹10,000)" against "Taxi to 27L: about ₹0".
  - **lights, lane, vvip:** the expected lost movements × the average revenue per movement.
  - **nogate:** "Wait: ₹1,460/min after 5 min".
- **Safety calls:** medical, fuel and any MAYDAY get no money line. They show "Safety call: no price shown".
- **Strike "Keep going":** the money line appears with a red "safety risk" tag.
- **Incidents switched off** (`CFG.inc==='off'`): there are no cards, but the default acts' consequences still post to the P&L through the hooks.

### Income statement after the shift
`finish()` inserts a block after `.score`.
- **Concession:**
  - the 10 lines and EBITDA;
  - the 2 costliest moments: the largest ₹ clusters within 10-minute windows of the money log, for example "19:22 stack peaked at 17: ₹38 L in fuel claims and misconnects";
  - the bridge to the era: "This shift × 311 × (peak day ÷ shift) → ₹X cr a year. Aero is set by AERA; your Mall and your delays are yours."
  - Then a "Close the books for years {a}–{b} ›" button, which replaces Replay/Next.
- **Quick play:** one line ("Today's books: ₹1.4 cr in, ₹0.3 cr out"). A best-profit record is kept per level in `zm_money_best[L]`.

---

## 3. Era screens (`money/board.js`, rendered into `#sheet`)

### Era results (after each shift)
- **Band:** "ZMIAL · YEARS 8–10 · RESULTS".
- **Content:**
  - A 3-to-7-year mini P&L table with revenue, EBITDA, CFADS, debt service and DSCR per year.
  - A sparkline of DSCR against the 1.0 / 1.1 / 1.2 / 1.3 marks.
  - Passengers and spill.
  - The airline verdict, for example: "IndiGo adds 14 daily departures: airlines add flights where they leave on time." It comes from the star growth bonus.
- **Button:** "To the board ›".

### Board meeting
- **Band:** "ZMIAL BOARD · ERA 3 · YEARS 11–13".
- **Left side: a 5-step agenda.**
  1. **Results.** A recap and the nominees' one-line reactions:
     - Chair (you).
     - Meera Kesar (L5 Capital) cares about dividends.
     - The AAI nominee cares about the fee and service quality.
     - The MADC nominee cares about jobs and phase 2.
     - The lenders' agent observes and does not vote.
  2. **AERA order.** Ship A shows one silent line: "Aero tariff this period: ₹X per passenger (set by AERA)". Ship B adds the paper order card below.
  3. **Lenders.**
     - A DSCR gauge marked at 1.0, 1.1 and 1.2, with the lock-up tiers at 1.2, 1.4 and 1.55 (`finance.distribution_lockup`).
     - The DSRA balance.
     - If a cure is needed, the cure card replaces this step.
  4. **Investments.** Cards, each showing cost, effect, payback and a "why" line:
     - **Ship A cards:** the mandatory stage (informational, plus the equity call); the Mall upgrade; runway rehab (per runway, with a "deferred" counter); phase 2 G/H (from the year-14 board).
     - **Ship B cards:** sim upgrades (changeover drills, APM, A-CDM, bird radar, counter-drone, second grid feed, fuel storage, wildlife programme) and buying or selling stake.
  5. **Cash.** A three-way split slider for dividend / prepay / retain.
     - The dividend part is capped by the lock-up.
     - A preview shows next era's thinnest DSCR and the parent's IRR so far.
- **Right side: the company card.**
  - Treasury (retained cash), debt outstanding, RAB and the receivable.
  - Valuation, with a BIAL ₹21,800 cr bar (`benchmarks.bial_valuation`). Ship A shows it greyed with "estimate"; Ship B uses the full pricing.
  - "Dividend to {NAME} = stake × distribution".
  - The ownership ring at 120px.
- **Era beads:** 12 beads across the top, labelled E1 L1 · E2 L2 · E3 L3 · E4 L4 · E5–E12 L5. In Ship B, E12 is labelled L6 "Handback". The current bead pulses.
- **Button:** "Adjourn: play years {a}–{b} ›". This saves the campaign and then calls `startLevel(L, eraPatch(e))`.

### Cure board (DSCR below 1.0 for 2 eras; 1 in quick)
- Styled as a red band: "LENDERS' NOTICE · 15 DAYS" (`finance.lender_substitution_days`).
- **Options:**
  - Inject ₹X cr of parent cash: the amount that restores the base-case DSCR to 1.10. It is booked as a negative IRR flow.
  - Decline, and the lenders step in.

### Step-in screen
- The handback screen layout in `--stop`.
- It reads: "The lenders have stepped in. Under the termination clause, equity is paid 0% (`finance.termination_concessionaire_default`)."
- It shows the parent's IRR and the money in and out, and offers a "New campaign" button.

### AERA order card (Ship B)
- **Look:** `--paper` background, `--paper-ink` text, a Fraunces heading, mono figures, "Order No. {cp}/{year}" and a round seal.
- **Body:** "Your aero tariff for 2041–46: ₹X per passenger, because your RAB is ₹Y cr and the allowed return is 12.89% (WACC; equity 15.41%). 30% of your Mall income (₹Z cr) was used to lower it. ₹R cr of earlier shortfall is being recovered."
- **Service-quality line:** four ticks or crosses for arrivals, departures, transfers and stands, plus the safety tick, giving "rebate −2% / bonus +1.25%".
- **Buttons:**
  - "Accept".
  - "Appeal to TDSAT": costs 0.2% of the era's ARR, with a 20% chance of moving the tariff 25% of the way to the claim, decided next era (`world.game_appeal`).

### Handback (Ship B, year 60)
- **Opening:** a night shot of the field and a 4 s fade. The asset checklist ticks through in 5 classes (`world.game_handback.classes`), 200 ms apart, each showing its residual life against its threshold.
- **Scorecard:**
  - IRR, drawn on a band chart with marks at 8, 12.4, 15.5 and 17.3%;
  - handback score and band;
  - total dividends ÷ equity invested;
  - peak valuation ÷ BIAL;
  - debt repaid, yes or no;
  - safety and stars across eras;
  - the weighted grade (`world.game_endgame.weights`).
- **Final line**, typed in the player's font: "{NAME} ran Zero Mile for 60 years. ₹X crore returned on ₹Y crore invested."
- **Leaderboard:** `zm_campaign_best` keeps the top 5 results.
