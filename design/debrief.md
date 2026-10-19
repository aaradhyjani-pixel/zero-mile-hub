# The 60-year debrief (design/debrief.md)

After the handover certificate, or after the step-in notice if the banks took control, the player reads **four pages on the desk** in the Paperwork look. It takes about 8 minutes. The debrief answers the user's own brief: what happened, what made the return, what the player is like at this kind of work, and how a hard-nosed investor would judge the business they built.

Rules:
- Plain words only.
- Only sourced benchmarks.
- No school-report scores, and no psychology beyond the evidence.
- Every claim about the player cites what they did.

Examples use **Meridian Infra** and **Asha Rao**.

---

## Page 1 · The return

**The bold moment:** one handwritten number. *"14.6% a year, for 60 years."*

Under it sits a drafting-ruler scale (the deal-desk ruler, reused) with the player's return marked in red against **sourced benchmarks only**:

| Mark on the ruler | Value | Source (in money.json) |
|---|---|---|
| What Fairfax's own valuation of Bengaluru's airport assumes it earns (the discount-rate range) | 12.2–17.5% after tax (2025) | `bial.owners.dcf_inputs`, Fairfax India annual report 2025 |
| What AERA allows Delhi's airport on its shareholders' money | 15.41% | `till.fair_return_on_equity`, AERA DIAL CP4 paper |
| What the banks charged | ~10.15% | `till.efficient_cost_of_debt`, AERA |

Two plain lines follow:
- **What you put in, what came back.** For example: "₹13,440 cr put in by Meridian Infra; ₹1,42,800 cr came back over 60 years."
- **How it ended:** handed back in year 60, or the banks took control in year *n*.

If the banks took control, page 1 says so first, in red stamp ink, and the return is "lost".

**Data:** `endOpts(state)` already returns the return, the money in and out, and the residual. Add `benchmarks()` to read the three entries above, with their sources.

---

## Page 2 · The power law: which decisions made the return

**The bold moment:** an ink bar chart, drawn like a ledger in Courier with hatched bars. One or two bars are long and the rest are short. Its plain sentences come straight from the numbers, for example:

> *"Signing Skyward for three routes made 41% of your return."*
> *"Building phase 1 lean cost you 9%."*
> *"Holding London for Lucknow made 7%."*

The page ends with one line in the adviser's hand: *"Two decisions made most of your sixty years. Most decisions barely mattered. That is how big returns work."* This is the **power law**, named on the page.

### The decision log

`s.decisions[]` is written by every `applyDecision` and `applyShift`. Each entry is `{id, chapter, label, chosen, default, alt[]}`, where `default` is the **counterfactual** (what a passive player would have done):

| Decision | Counterfactual (the "if you hadn't" run) |
|---|---|
| Ch1 bid | the median winning bid from `previewBid` (50% chance) |
| Ch1 phase 1 lean or big | the other size |
| Ch1 State loan | the opposite |
| Ch1 lender | Indian banks |
| Ch1 share borrowed | 70% |
| Ch2 the three construction calls | "pay" for each (the on-time path) |
| Ch3 opening plan | phased |
| Ch4 network | two feeders (or anchor, if Kaveri declined) |
| Ch4 bird radar | bought |
| Ch5 Skyward | decline |
| Ch5 hold London (in-shift) | let go |
| Ch6 cure | ask L5 (if the player refused, the counterfactual is to put the money in) |
| Ch7 Airport City / phase 2 / L5 buyout | reject / wait / don't buy |

Shift performance (stars, on-time, connections) is one more "decision" with the counterfactual of a **3★ expert shift** (`ops_profiles.expert`). The page can then say *"Your operations cost you 3% against an expert's"*, or *"made 2% more than an expert's"*.

### The attribution algorithm (exact Shapley values over the decisions)

1. **The value function** `v(S)` is the player's **net present value at 12.4%** (the low end of Fairfax's 2025 range, so the scale is honest). It is computed by `simulate()` with the decisions in set *S* as the player chose them, and all the others at their counterfactual.

   NPV is used, not the return per year, because Shapley needs a quantity that adds up. The page then converts the shares back into "*x*% of your return".
2. **The Shapley value** of decision *i* is the average, over all orderings, of `v(S ∪ {i}) − v(S)`. With *n* decisions this needs 2ⁿ runs of `simulate()`.
3. **Grouping keeps *n* small.** There are 11 groups:
   1. how you financed it (the five Ch1 loan-offer choices)
   2. the bid
   3. how you built it (the three construction calls)
   4. the opening plan
   5. the network
   6. the bird radar
   7. Skyward
   8. holding London
   9. the crisis cure
   10. the thirty-year plan (the three Ch7 resolutions)
   11. your shifts

   Exact Shapley over 11 groups needs 2¹¹ = 2,048 runs.
4. **Cost.** `simulate()` takes **~4 ms** for 60 years (measured: 4.0 ms in Node on the build container), so the whole set is ≈ **8 s**. It is spread out and run in a Web Worker, never on the page:
   - **Coalitions are computed as their groups become known.** By the end of Chapter 6, groups 1–9 and 11 are known: 2¹⁰ = 1,024 coalitions ≈ 4 s, spread over Chapters 3–6 at a few hundred runs each.
   - **Chapter 7 adds group 10:** 1,024 new runs ≈ **4 s**, done while the years 34–60 pass and the handover certificate is on screen (about 10 s).
   - Results are cached in `zm_campaign.attr`, so reopening the debrief is instant.
   - **Fallback** if a Worker isn't available: **leave-one-out**, 11 runs ≈ 45 ms, labelled honestly on the page as "a quick estimate".
5. **Rounding and wording.**
   - Shares under 3% are pooled into "everything else".
   - A negative share reads "cost you".
   - At most 5 bars are shown.
   - The two largest get the sentence form, plus the power-law line.

Shift results enter `simulate()` the way they do now: through `eraOps` (the shift ops profile) and `s.hub` (Chapter 5's connections). The counterfactual swaps in the expert values.

**Check:** the shares plus "everything else" add up to the total NPV difference between the player's run and the all-counterfactual run. The acceptance test asserts this to within 1%.

---

## Page 3 · What happened (your front pages)

**The bold moment:** the player's own seven front pages, laid as a strip of overlapping newspapers across the desk, each at its lead headline. Under each sits one line in the adviser's hand:
- linking it to the decision that caused it, for example *"Because you anchored Narmada Air"*;
- the year, and the banks' light at that moment.

Clicking a paper opens it full size; clicking a document in the pile opens that document.

At the right end of the strip is the **"Every moment happens once"** line, naming the one moment with the biggest Shapley share that happened inside a shift. For example: *"Opening day happened once. You ran it at 88% on time."*

**Data:** each chapter's `frontPage(state)` output is saved in `state.papers[]` when shown.

---

## Page 4 · How you work, and how an investor would judge your airport

### 4a · How you work (inferred only from what you did)

Seven lines at most. Each is one sentence plus its **evidence in small type**. A line appears only when its evidence threshold is met; otherwise it is left out. There are no scores, no grades and no personality labels beyond the line itself.

| Line (shown when) | Evidence rule (from `s.decisions[]` and the shift results) | Evidence shown, for example |
|---|---|---|
| **A capital allocator.** You put money where it compounded. | Ch7 Airport City or phase 2 has a positive Shapley share, AND dividends were taken only after year 20 | "Built Airport City in 2059 (+6%); took no dividends before 2045." |
| **An operator.** Your shifts made money. | The shift group's Shapley share is ≥ 0 (at or above the expert) and on-time averaged ≥ 85% | "3★ in 4 of 5 shifts; 91% connections made." |
| **A risk-taker, and right about it.** | Bid above the median, or borrowed ≥ 72%, or dollar bonds, AND that group's share > 0 | "Bid 34% when 30% would have won; it still made 4%." |
| **A risk-taker, and it cost you.** | The same choices with a share < 0 | "Dollar bonds: the rupee fell in 2046 and cost 7%." |
| **Patient.** You paid now for later. | Held London (a cost today), OR committed phase 2 early, AND that share > 0 | "Held London twice at ₹10 cr; kept 11,400 passengers a year off Doha." |
| **A negotiator.** | Won the bid within 2 points of the median and kept Kaveri's trust ≥ 0.7, OR the AERA appeal won | "Won the concession at 31%, 1 point above the median." |
| **A network builder.** | Ch4 anchor or two feeders, AND the Ch5 three routes, AND connections ≥ 88% | "12 cities × 3 destinations; 6.2 lakh connections a year." |
| **A crisis leader.** | Ch6 cure chosen (own money or L5), AND the crisis shift ≥ 2★ | "Put in ₹2,400 cr in 2046 and ran the crisis shift at 2★." |

If none of these apply (a very passive game), the page says plainly: *"The airport mostly ran on its defaults. Next time, try a decision that scares you."*

### 4b · Peter Thiel's seven questions, answered from your concession

These are from *Zero to One*, chapter 13, "Seeing Green". Each answer is one line computed from state, with a ✓ or ✗ in stamp ink.

| Question | Answered from |
|---|---|
| **Engineering:** is your hub 10× better than the alternative? | Your connection time (40 min) against Doha's (60), and the one-stop routes you opened (cities × destinations) |
| **Timing:** did you build when the traffic came? | Construction slips, widebody stand shortages in Ch5, and the phase 2 timing against demand |
| **Monopoly:** do you own a big share of a small market first? | Your share of India's connecting passengers in the game's hub market by year 30 (connections ÷ the game's total India–world transfer pool) |
| **People:** did your partners stay? | Skyward, Narmada and Kaveri still flying at year 60; L5's stake path |
| **Distribution:** how many cities feed you? | The feeder cities signed (Ch4) and those still feeding at year 60 |
| **Durability:** will this still be your market in year 60? | Whether the Ch7 Hyderabad rival hub failed to take your banks (the last-mover test) |
| **Secret:** did you act on something few believed? | Whether you built banks and held connections when cutting charges was the obvious move (Ch4, Ch5) |

---

## 5. Thiel in play (mechanics, not lectures)

Each idea is felt in play first and named only in the debrief. The citations are to *Zero to One* and only for ideas that are in it.

| Idea | Chapter | The mechanic | How the player feels it | How the debrief names it |
|---|---|---|---|---|
| **The secret: the network is the moat** (*Zero to One*, ch. 8 "Secrets") | 4–5 | Connections earn money and missed ones go to Doha; routes grow with the connection rate (`growth` in `ch5.applyShift`) | The connection stream: passengers walking to London, or drifting off to "DOHA" | Thiel Q7 (Secret); the Ch5 Shapley bar |
| **Competition is for losers** (ch. 3–4) | 4 | "Cut charges 30%" brings flights that don't connect, and Dubai matches the cut on the next front page | Traffic goes up while the bill's connections line barely moves; the margin note says so | Page 2's bar for "cut charges" (usually negative); a line on page 4 |
| **Monopoly characteristics**: network effects, economies of scale, brand (ch. 5) | 4, 5, 7 | Network: more feeders → more routes → more feeders. Scale: phase 2 lowers cost per passenger. Brand: your connection rate is quoted on the front pages and in Skyward's terms | Each front page quotes your record; better records get better route offers | Thiel Q3 (Monopoly) |
| **Last-mover advantage** (ch. 5) | 7 | Hyderabad opens a rival hub; it takes banks from you only if your network score at year 30 is below a threshold | The Ch7 front page: "Hyderabad's hub struggles to fill its banks", or "takes Narmada's evening bank" | Thiel Q6 (Durability) |
| **Definite vs indefinite optimism** (ch. 6) | 7 | Phase 2: commit to a date now, with airlines' letters signed (definite), or wait and see (indefinite). Committing adds routes, because airlines can sell a dated plan | The slip's route count; the handover's route total | A page 4 line ("Patient"); page 2's phase 2 bar |
| **The power law** (ch. 7) | debrief | Shapley attribution over the decisions | One or two long bars; most short | Page 2's closing line |
| **"Every moment in business happens only once"** (ch. 1) | 3 | Opening day plays once per concession, with no in-concession replay | Opening day's stars are permanent on every later front page | Page 3's last line |

---

## 6. Data and API (era.js, one writer)

- `VSIEra.debrief.benchmarks()` → the three sourced marks.
- `VSIEra.debrief.attribution(state)` → `[{group, label, sharePct, npvCr}]`, and `checkSum`. It uses the cached coalitions in `state.attr`, and computes the rest.
- `VSIEra.debrief.attrStep(state, chapter)` → the coalitions that become computable after each chapter. hub.js runs them in a Worker.
- `VSIEra.debrief.profile(state)` → `[{line, evidence}]`, following §4a's rules.
- `VSIEra.debrief.thiel(state)` → `[{q, answer, mark}]`.
- `VSIEra.debrief.papers(state)` → `state.papers[]` with the causal line for each.

**ui.js:** `ZMMoney.debrief({return, attribution, papers, profile, thiel})` shows the four pages, reusing the ruler, the ledger table, the slip, the stamp and the pile.
