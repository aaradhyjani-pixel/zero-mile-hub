# prompt-money.md — The money layer for Zero Mile International

Paste everything below the line into a new session with the repo attached (github.com/aaradhyjani-pixel/zero-mile-hub). It is a complete brief for one workstream: money.

---

## Context (read before anything else)

You're working on Zero Mile International (ZMI): a browser game where the player is the duty manager of a six-runway mega-hub near Nagpur, formed by merging Ahmedabad, Mumbai and Bengaluru airports.

Read `build.md`, `progress.md` and the top of `hub.js` (LEVELS, resetState, buildLevel, setMode, spawnInc, stars, finish, menu, window.HUB) before you write any code. `hub.js` is about 330 KB with many interlocking systems: set pieces, voices, the 3D view in `hub3d.js` and `3d/`. Change it surgically.

**Evidence so far:** 7 people played the game, and each replayed levels at least three times to earn more stars. The core loop works: switch runways between ARR/DEP/MIX/OFF to match the arrival and departure waves on the bank chart, and handle the calls as they come.

**Your job:** add money, so every decision has a price, and the four levels become a 60-year concession that people replay to run the airport better, not just to collect stars. Step 0 sets the frame. Do not build a second game next to the first. Money must hang off the decisions that already exist.

**Out of scope for this session:** a hijack scenario, new set pieces, 3D work beyond showing money in the overlay, and new levels.

## Read this first: two rules for this session

### Rule 1 — Money is ADDED. Nothing is removed.
This session adds a layer on top of a game people already replay. Keep everything that exists today, working exactly as it does now:
- All 4 levels.
- Every set piece: the summit, Pakistan One, the wedding, the dabbawalas, kites, fog and the rest.
- The voices and music hooks.
- The 3D view and the 2D map.
- Incidents and ops teams, stars, the bank chart, the runway desk, quick play from the menu, and the `zm_stars` / `zm_cfg` saves.

Specifically:
- **Do not delete, rename or simplify** any existing feature, file, level, set piece or setting to make room for money. If something gets in the way, wrap it or add a hook beside it. Don't rewrite it.
- **Money is off by default in quick play.** Quick play from the menu stays exactly as today, with at most a small money chip. The full economy and the 60-year concession live in a new **Concession** mode.
- **Regression gate:** run `run_all.py` for every level and bot before you start, and again after each ship. Operational results (stars, OTP, connections, safety, movements) must stay the same within noise when money is off. Report both tables side by side. If something regresses, fix it before moving on.
- Run the existing 3D and set-piece checks (shots.py, the ff runs from progress.md) after each ship: no new page errors, and every set piece still plays end to end.

### Rule 2 — Ultracode is on for the whole session: decide deliberately when to run in parallel
Ultracode makes you plan workflows (many sub-agents) for every substantive task. That is powerful and expensive, and on this codebase it can be destructive: many agents editing `hub.js` at once will collide. Follow this split.

**Run as parallel workflows (fan out, then cross-check):**
1. **Step 1 research.** One agent per topic: AERA tariffs and the till; UDF and parking; non-aero revenue per passenger; costs and runway-open cost; fuel burn and ATF price; DGCA passenger rights; concession finance (gearing, tenor, rates, DSCR); capex benchmarks; PPP bids. Give each topic a skeptic agent that tries to refute the claims, then merge everything into `research/money.md` and `money.json`. Cap it at about 10 to 16 agents.
2. **Design options before committing.** Draft the economy from 3 independent angles (a regulator-realistic one, a fun-first one, and the simplest one that still teaches the lesson), have one judge agent compare them, then write `money-design.md`. About 4 agents.
3. **Balancing runs (Step 5).** Bot games are independent: run levels × bots × 2 seeds in parallel, collect one table, then a single agent decides the tuning changes. Repeat the round until acceptance passes or two rounds in a row make no progress.
4. **Visual QA.** One agent per screen (top strip, P&L tab, floaters, board meeting, AERA order, income statement, onboarding, bid, handback) takes headless screenshots in 2D and 3D and reports problems. One agent fixes them afterwards.
5. **New, self-contained files.** Things that don't touch `hub.js` can be written in parallel, each agent owning one file: `money.json`, the onboarding and bid screens as a separate module (for example `money/onboarding.js` injected by build.py, the way `3d/` modules are), the glossary entries, `music/SOURCES.md`, and the audio replacements.

**Keep sequential: one agent, one writer, no parallel edits:**
1. **Every edit to `hub.js`, `hub3d.js`, `build.py` and `spec.json`.** One agent at a time, in small commits. If a workflow must touch `hub.js`, give each agent its own git worktree or branch, and merge them one by one with the regression gate between merges. Never have two agents edit the same file in the same checkout.
2. **Wiring the economy into the simulation** (revenue and cost hooks on touchdown, lift-off, pushback, stand-hours, incidents, runway modes, ops teams). It's one coherent change, so one agent reads the code and makes it.
3. **The era loop and the save format** (`zm_campaign`): one agent, because the schema has to be consistent.
4. **Decisions on balancing numbers.** Agents run the games in parallel, but exactly one agent changes the numbers in `money.json`.
5. **Commits and pushes to `main`.** One agent, after the regression gate passes.

**Sizing and cost:**
- Keep `/config` workflow size at `medium` (under 10 agents) for everything except research and balancing runs, where `large` is fine.
- Use smaller models for the mechanical agents (screenshot QA, running bot games, collecting tables) and keep the session's model for design, the wiring and the judging.
- Before any workflow over 25 agents, write one line in `progress.md` saying why it needs that many.
- If a task is small (a typo, a CSS tweak, one function), just do it directly. No workflow.

## Step 0 — The frame: you are a concessionaire, not a manager (this changes everything below)

The money layer lives inside a **public-private partnership (PPP) concession**, the way India's private airports really work. It is modelled on two real plays:
- **Adani:** bid aggressively, win big, grow fast. Adani won six AAI airports on 50-year leases, paying a per-passenger fee to AAI plus an upfront fee, and bought 74% of Mumbai's MIAL.
- **Fairfax:** buy in patiently and compound. Fairfax India built its BIAL stake step by step to 74%, with AAI and Karnataka's KSIIDC holding 13% each.

Benchmarks to verify and cite:
- Delhi's DIAL shares 45.99% of revenue with AAI, and Mumbai's MIAL 38.7%.
- AAI holds 26% of each.
- Those concessions run 30 years, extendable by 30.

**Onboarding (first launch, about 90 seconds, skippable later):**
1. **Name your company.** The player types a parent company name (for example "Jani Infra"), which is stored as `zm_campaign.parent`.
2. **The SPV.** The parent forms **Zero Mile International Airport Limited (ZMIAL)**, a special-purpose company that holds the concession. Ownership is 80% the player's parent and 20% the state: AAI 10% and MADC (Maharashtra Airport Development Company, which runs Nagpur's MIHAN today) 10%. Verify MADC's role before using its name; otherwise use "the State of Maharashtra". The state contributes the **land** on a nominal lease. You pay for everything else.
3. **The bid.** This is the first strategic decision, and the whole 60 years depends on it. Three rival consortia (fictional names; no real companies) bid for the concession. The player chooses the bid type and level:
   - **Revenue share** to AAI (Delhi-style, 30 to 50%), or
   - **Per-passenger fee** (the Adani-style model).

   Bid high and you win, but the margin is squeezed for decades. Bid low and you may lose the concession. A rival's winning bid and a short "what this means" explainer show either way.
4. **Financial close.**
   - The phase 1 capex comes from research. Benchmarks: Navi Mumbai and Noida (Jewar) costs per million passengers of capacity, and Al Maktoum's ~$35bn terminal. Write the number used, and its derivation, into `money.json`.
   - Fund it about 30% equity (80% of that from your parent) and about 70% debt: a rupee term loan from an infrastructure lender consortium, tenor and rate researched (expect around 15 to 20 years at a high single-digit to low double-digit rate; verify).
   - The player picks a gearing level and a repayment profile (sculpted vs equal instalments), with the trade-off explained: more debt means a higher return on equity and higher default risk.
5. **The 60-year clock starts.** Construction years follow, with a few quick decisions: a cost overrun, a monsoon delay, an early phase 2 option. Then opening day.

**Mapping 60 years to playable time (the key design call):**
- **One era is five years**, matching AERA's real five-year tariff **control periods**. That makes 12 eras across the concession, preceded by construction.
- **Each era has two halves:**
  - **Board meeting** (strategic, 2 to 4 minutes): financing, investments, tariff filing, dividend or debt-prepayment choice, stake sales.
  - **One peak shift** (operational, one of the existing levels, about 5 to 8 real minutes).
- **The shift drives the era.** A real planner turns a design day into annual numbers, so the shift is the *sample day* for the whole era. Its OTP, connections, safety and profit per passenger are annualised (peak day → year, using a researched peak-day-to-annual factor) and set airline growth and retail yield for the next five years.
- **Traffic migration maps onto the eras.** These are the existing levels with years attached:
  - Years 5 to 7: opening and Bengaluru moving in (Level 1).
  - Year 8: Ahmedabad and Hyderabad (Level 2).
  - Year 11: Mumbai (Level 3).
  - Year 14: Delhi (Level 4).
  - Later eras replay Level 4 with traffic growth, the phase 2 decision (satellites G and H), new set pieces and rising competition.
- **Real-time length:** a full concession is about 12 shifts plus 12 board meetings, so roughly 1.5 to 2 hours, saved after every era (localStorage `zm_campaign`, wrapped in try/catch). Also offer a "quick concession" setting with 6 eras of 10 years.

**The regulator (the lesson that makes this an airport game, not a shop game):**
- **AERA sets aeronautical tariffs each control period** from your **regulated asset base (RAB)** and a fair rate of return, under a **hybrid till**: part of non-aeronautical revenue is used to lower aeronautical charges. Research the current AERA till policy and percentage, and model it.
- The result is the real truth of Indian airports: you can't get rich on landing fees, which the regulator caps. **You make your money in the Mall** (retail, F&B, duty-free, parking, the hotel, cargo) and through efficiency.
- **Every board meeting shows the AERA order:** "Your aero tariff for 2041–46: ₹X per passenger, because your RAB is ₹Y and the allowed return is Z%." The player can appeal (a gamble) or accept.

**Debt and survival:**
- **Lenders track DSCR** (debt service coverage ratio: cash available ÷ loan payments due).
  - Below 1.2, a covenant warning.
  - Below 1.0 for two eras, the lenders exercise **step-in rights**, and AAI can **terminate** the concession. That's game over, with a debrief.
- **Shocks:** an interest-rate spike, a pandemic year (like FY21, when Delhi airport invoked force majeure on revenue sharing; cite it), a fuel shock, a new competing airport.
- **Options:**
  - Refinance once traffic is proven.
  - Sell part of your 80% (the Siemens → Fairfax or GVK → Adani play) to raise cash, at a price that depends on your track record.
  - Prepay debt or pay dividends.

**Endgame, year 60: handback.** The airport returns to the state in the condition the concession requires (a maintenance-standard check). Score the concession like a real investor would:
- **Equity IRR** (internal rate of return on your parent's money).
- **Total dividends.**
- **Peak valuation.**
- **Debt fully repaid**, yes or no.
- **Safety record** and **operational stars** across all eras.

Compare with real benchmarks you can cite: infrastructure equity return expectations in India, and Fairfax's reported BIAL valuation. Then end on one line: "*[Parent name]* ran Zero Mile for 60 years. ₹X crore returned on ₹Y crore invested."

**What this means for Steps 1 to 5 below:**
- Per-shift money (Steps 2 and 4) stays as designed. It becomes the *sample day* that drives each era.
- The board meeting (Step 3) becomes the era screen: financing, AERA order, investments, dividends.
- The bots (Step 5) also play a full quick concession. The expert must finish with debt repaid and a positive equity IRR. `miser` and `spender` must end lower. `lazy` should trigger the lenders' step-in.
- Build it in two ships:
  - **Ship A:** onboarding, the bid, financial close, per-shift money, and eras with annualisation and debt.
  - **Ship B:** AERA orders with the hybrid till, shocks, stake sales, handback and endgame scoring.

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
- **Concession finance:** AERA control periods and the till policy (single, dual or hybrid, and the current percentage); typical Indian airport project gearing, loan tenor and interest rate; DSCR covenants; capex per million passengers of capacity at Navi Mumbai and Noida; and the revenue-share and per-passenger-fee bids in recent airport PPPs.
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
