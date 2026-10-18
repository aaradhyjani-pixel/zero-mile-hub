# prompt-money.md — The money layer for Zero Mile International

Paste everything below the line into a new session with the repo attached (github.com/aaradhyjani-pixel/zero-mile-hub). It is a complete brief for one workstream: money.

---

## Context (read before anything else)

You're working on Zero Mile International (ZMI): a browser game where the player is the duty manager of a six-runway mega-hub near Nagpur, formed by merging Ahmedabad, Mumbai and Bengaluru airports.

Read `build.md`, `progress.md` and the top of `hub.js` (LEVELS, resetState, buildLevel, setMode, spawnInc, stars, finish, menu, window.HUB) before you write any code. `hub.js` is about 330 KB with many interlocking systems: set pieces, voices, the 3D view in `hub3d.js` and `3d/`. Change it surgically.

**Evidence so far:** 7 people played the game, and each replayed levels at least three times to earn more stars. The core loop works: switch runways between ARR/DEP/MIX/OFF to match the arrival and departure waves on the bank chart, and handle the calls as they come.

**Your job:** add money, so every decision has a price, and the four levels become one campaign that people replay to run the airport better, not just to collect stars. Do not build a second game next to the first. Money must hang off the decisions that already exist.

**Out of scope for this session:** a hijack scenario, new set pieces, 3D work beyond showing money in the overlay, and new levels.

## Step 1 — Research real Indian airport economics (keep it short and sourced)

Use web search. Write `research/money.md` with sources, and `money.json` with every number the game uses. Each entry gets a value, a unit, a source URL, and an `estimate: true/false` flag. Verify, don't guess. Find:

- **Aeronautical charges.** AERA (Airport Economic Regulatory Authority of India) tariff orders for Delhi, Mumbai and Bengaluru. Cover landing charges by MTOW slab (maximum take-off weight), parking and housing charges per hour, and the User Development Fee (UDF) per departing passenger, domestic and international.
- **Non-aeronautical revenue.** Retail, duty-free, F&B and car parking revenue per passenger at major Indian airports, from annual reports or investor presentations of GMR, Adani Airports or BIAL. Also find what research says about how dwell time affects spend.
- **Costs.**
  - Rough operating cost per passenger.
  - What it costs to keep a runway open per hour: ARFF (fire) cover, lighting power, ATC positions, maintenance. Expect to estimate this; say so.
  - Holding fuel burn per minute for an A320neo, a 777-300ER and an A380.
  - Indian ATF (jet fuel) price per kilolitre.
- **Passenger rights.** DGCA's Civil Aviation Requirements on facilities for passengers facing denied boarding, cancellations and delays (CAR Section 3, Series M, Part IV): what airlines owe and when.
- **Benchmarks** to compare the end-of-campaign result against: revenue per passenger and EBITDA margin for Delhi, Mumbai and Bengaluru airports.

Express money in ₹ crore and ₹ lakh. Scale the numbers honestly, then apply one clearly labelled game multiplier if the real values feel too small to matter in a 90-minute shift. Document that multiplier in `money.md`.

## Step 2 — Design: five ways to earn, five ways to spend, each tied to an existing decision

Write the design into `money-design.md` first (one page), then build it. Starting design, which you may improve if your research says so:

**Revenue**
1. **Landing fee** per touchdown, by MTOW slab. Widebodies and A380s are worth much more. *Decision link:* landing capacity matters more than ever.
2. **Parking fee** per stand-hour, with remote stands cheaper. *Decision link:* towing long-stay aircraft and gate use.
3. **UDF** per departing passenger, higher for international. *Decision link:* cancelled or offloaded passengers lose it.
4. **Retail and F&B** per passenger, rising with calm airside time and falling sharply when they're stressed: a misconnect, a long delay or a cancellation. A made connection is a bonus shopping window. *Decision link:* protecting connections is now worth money, not just stars.
5. **Hub transfer incentive** from airlines per made connection (an airline partnership deal). *Decision link:* the connection-hold calls.

**Costs**
1. **Runway open cost** per hour for each runway not OFF: fire cover, lights, ATC staffing. This makes OFF a real choice and makes MIX vs two dedicated runways an economic decision too.
2. **Ops teams and overtime:** sweepers, bird patrol, tugs and buses already exist as ops teams, so they get a cost per hour. Calling extra teams costs overtime.
3. **Airline SLA penalties** (service level agreements): a charge when the airport causes a departure delay beyond a threshold, and when an aircraft waits for a stand.
4. **Passenger care and compensation:** meals, hotels and rebooking for misconnects, cancellations and long delays, following DGCA rules. Note in-game whether the airline or the airport would really pay; the game can charge the airport through its airline contracts. Say so honestly in the glossary.
5. **Incident and closure costs:** burst-tyre repair, bird-strike inspection, diversions handled and holding fuel claims (airlines invoice the hub when the stack is the hub's fault).

**Hard rules**
- **Safety is never for sale.** Safety below 70 still fails the level, whatever the bank balance. No purchase can lift safety directly.
- **Good ops must equal good money.** If a stingy strategy (closing runways, skipping crews) beats the expert on profit, the economy is wrong. Fix it until the expert bot earns the most.
- **Every money number has a "why".** Hovering a line shows its formula in plain words and links to its glossary term.

## Step 3 — The campaign: a treasury that carries over, and a board meeting between levels

- **Treasury.** The campaign starts with seed capital, and each level's profit or loss carries over. Store it in localStorage (key `zm_campaign`, wrapped in try/catch like `zm_stars`). Add a "new campaign" reset with a confirm step.
- **Board meeting screen** between levels: spend the treasury on 8 to 12 investments. Each one changes a real sim parameter, and each card shows cost, effect, payback estimate and a one-line explanation. Examples to wire into existing code:
  - **A-CDM system** (airport collaborative decision making): departures leave the gate only when the runway can take them. Shorter taxi queues; uses the existing hold logic.
  - **Faster changeover drills:** `CHANGE` drops from 120 s to 75 s.
  - **Bird radar:** fewer bird events and no closure surprises.
  - **Second sweeper truck:** FOD sweeps fit smaller gaps.
  - **Extra rapid-exit taxiway** on one runway: arrival runway occupancy down, so arrival separation can shrink a little.
  - **Remote stand expansion** (+12 stands), or open the phase 2 satellite early.
  - **APM train upgrade:** transfer times −15%, so more connections are made.
  - **Retail upgrade** in the Mall: higher spend per passenger.
  - **Heat-resistant pavement and an extra heat pad** for Level 3.
  - **Dust-storm ILS upgrade** for Level 4: smaller separation penalty in the andhi.
- **Gating.** Keep every level playable from the menu without the campaign (quick play, default kit). Investments apply only in campaign mode.
- **Ending.** At the end of Level 4, show a campaign income statement: revenue, costs, EBITDA and margin, compared with the real Delhi, Mumbai and Bengaluru benchmarks you found, plus "your hub's valuation". One satisfying final number.

## Step 4 — UI: money must feel alive, not like a spreadsheet

- **Top strip:** one live chip, "Today ₹X.X cr", ticking up and down with a small sparkline, plus one line for the rate per hour.
- **Floaters on the map:** "+₹" in green at touchdown (bigger for an A380) and at lift-off; "−₹" in red when a penalty hits, at the place it happened. Keep them subtle when zoomed out and aggregate them so there are never more than about 6 on screen.
- **Runway desk:** each row shows its open cost per hour, and hovering a mode button previews the change in capacity and cost per hour.
- **P&L tab** in the right rail: the 10 lines with running totals, colour-coded, each with a "why" tooltip.
- **Calls (incidents)** show the money on each option, for example "Hold 10 min: saves ₹4.2 L in transfers, costs ₹1.1 L in SLA penalty". This is the most important UI change, because it turns every call into a real trade-off.
- **End-of-level debrief:** a short income statement, the 2 most expensive moments ("At 19:22 the stack peaked at 17: ₹38 L in fuel claims and misconnects"), and best profit per level saved.
- **Glossary terms** to add, with click-to-explain: aeronautical vs non-aeronautical revenue, MTOW, UDF, AERA, SLA, A-CDM, EBITDA, valuation.

## Step 5 — Balance with bots, and prove the economy rewards good operations

Extend `run.py` / `run_all.py`:
- Add bot **`miser`**: the expert, but it keeps the minimum runways open and never calls extra teams.
- Add bot **`spender`**: the expert, but it overreacts by opening everything and always calling teams.
- In campaign mode, have the expert buy a sensible fixed investment set between levels.

Acceptance (report the table):
- Expert has the highest profit on every level **and** still earns 3★.
- `miser` earns less than the expert, because penalties and lost revenue beat the savings.
- `spender` earns less than the expert, because costs beat its gains.
- `handler` and `lazy` lose money on Levels 3 and 4.
- Campaign: the expert finishes with a positive treasury, and its investments visibly pay back by Level 4.
- Zero console errors across all runs, in both the 2D and 3D views.
- Screenshots of the top strip, P&L tab, floaters, board meeting and income statement. Look at each one yourself and fix what looks off.

## Working rules
- Update `progress.md` after every step and commit often, so a restart loses nothing.
- Don't break the set pieces, voices or 3D. Run the full bot table before and after.
- Rebuild with `python3 build.py`, push to `main` so GitHub Pages and Vercel redeploy, and update `build.md` (add a "Money" section: the formulas, `money.json`, the board meeting and how to tune).
- Plain direct English everywhere, explain every term, and use real numbers with sources.
- **Housekeeping (15 minutes, do it first):** `site/music/` has tracks with no recorded source, including what sounds like a commercial song (rasputin.mp3) and an anthem recording. Replace any track you can't prove is royalty-free with generated or royalty-free audio, and record each track's source in `music/SOURCES.md`.

**Your first reply:** the baseline bot table, the money research plan, and the one-page design. Then start building. Don't wait for approval unless something is genuinely irreversible.
