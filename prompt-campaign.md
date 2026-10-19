# prompt-campaign.md: the Concession campaign, rebuilt around the experience

This file is the brief for the session that builds the money layer. It overrides any earlier plan where the two conflict. Read all of it before writing code. Then read `money/DESIGN.md`, the Paperwork design system, which still holds.

The user's verdict on the current build: the pieces are good, but they are not joined. The risk is a mindless game where the player pushes arrivals and departures and watches a revenue graph go up. **That must not happen.** If it doesn't, everything else will be fine.

---

## 0. Rules for this pass

1. **Do not touch the 3D view, the maps or the art.** Not now.
2. **Quick play (Levels 1–4) stays exactly as it is.** The gate is still the expert at 3★ on L1–L4 with money off, matching the baseline. Run it after every merge.
3. **Pause the breadth branches** (construction, story, menu restyle, extra board options). Nothing new is merged unless it serves the vertical slice in §9.
4. **Plain words** (as in `money/DESIGN.md` §2.7): no DSCR, RAB, WACC, true-up, EBITDA, IRR, SLA, UDF, covenant or step-in on screen.
5. **Fictional airlines.** Real history appears only on the factual "what really happened" cards (§6). In play, airlines are invented. Real places are fine, for example Dubai or Doha as rival hubs.
6. Work in parallel lanes with separate file ownership. Timebox each lane to 40 minutes. Ship what works, and log the rest.

---

## 1. The thesis: VSI is India's transfer hub, the Atlanta of India

This replaces the "Delhi stops and its traffic reroutes here" story. Cities keep their own airports. VSI wins because of **geography and connections**:
- Nagpur is the centre of India. Almost every Indian city is within about two hours of it.
- Today, millions of Indians flying abroad change planes in Dubai, Doha or Istanbul.
- A hub at the centre can connect any Indian city to the world with one stop on Indian soil.

**This is the business.** VSI makes money when passengers **connect** through it: a feeder flight from Indore lands, the passenger walks to a flight for London, and VSI earns from both legs and the shops in between. It loses money when a connection is missed and the passenger books via Doha next time.

**The secret the player discovers** (Peter Thiel's question: what important truth do few people agree with you on?): an airport's value is not its runways. **It is its network.** More Indian cities feeding the hub means more international routes are worth flying. More international routes make more cities want to feed it. Once that flywheel turns, no rival can copy it. That is how Atlanta and Dubai work, and the player should *feel* it happen.

The existing game already has the bones of this: bank waves, the bank chart, the connections percentage. The campaign makes **connections the heart of the money**.

---

## 2. The one rule of money: no money for mindless movements

| Earns money | Does not earn money by itself |
|---|---|
| **Connections made**: each transfer passenger who makes their onward flight | Raw movement count |
| **New routes** that airlines open, because the player made their connections work | Flipping runway modes faster for its own sake |
| **Land and shops**: Airport City, the Mall | |
| **Airport charges**, set by AERA every five years. The player can't game them; they can only argue for them. | |

Change the in-shift feedback to match:
- **Floaters show connections, not landings.** For example "+46 connections · ₹0.4 cr" over the transfer area, and "−18 missed · Doha wins them" in red when a feeder is late.
- **The "Today" chip** shows money with one line under it: connections made versus missed.
- **Landing fees are still counted** in the books, quietly. They are not shown as a reward on the map.

If a player could raise their score by playing the ops game without thinking about connections, the design has failed.

---

## 3. The shape: seven chapters, about 90 minutes

Sixty years are told in seven chapters, not twelve identical eras. Each chapter is 8–15 minutes. Quick play is untouched.

| # | Chapter | Years | The question | The shift |
|---|---|---|---|---|
| 1 | **Win it** | 0 | Can you win the concession without bidding yourself broke? | the deal desk, already built |
| 2 | **Build it** | 1–4 | Can you open on time? | none: three construction decisions on paper (§5) |
| 3 | **Open it** | 5–7 | Can you survive opening day? | Level 1 traffic, plus opening-day incidents |
| 4 | **Wire the country** | 8–13 | Which cities do you sign as feeders, and which airline do you back? | Level 2, with the first real connection banks |
| 5 | **Take on the Gulf** | 14–20 | Do you sign a long-haul partner and run international banks? | Level 3–4 traffic shaped as international banks. **This is the vertical slice.** |
| 6 | **The crisis** | 21–35 | A pandemic, or the rupee falls (if you borrowed in dollars), or your biggest airline collapses. Do you put in your own money to keep the airport? | a crisis shift: half the traffic, and every decision costs |
| 7 | **Harvest and hand back** | 36–60 | Three big calls over three decades, then the handover | a short final shift, then the certificate |

Each chapter has the same rhythm:

1. **The front page.** A newspaper page whose headlines are written from the player's own past choices.
2. **One decision on paper.** One document with at most three choices.
3. **The shift.** The decision *visibly changes* the shift.
4. **The bill.** One page: what the decision cost or earned, and why.
5. **What really happened.** One card: how Bengaluru, Delhi, Dubai or Atlanta faced the same moment.

---

## 4. The paper trail: every decision shows up on the airfield

**This is the core mechanic.** When something in a shift happens *because* of an earlier decision, a small paper tag is pinned to it on the map. It is in the Paperwork look, about 120px wide: the name of the document that caused it, plus one line. For example: *"Capital budget, 2034: you skipped the bird radar."* Clicking the tag opens that document from the pile. The player sees cause and effect with their own eyes.

| Decision (chapter) | What changes in the shift | What changes in the books |
|---|---|---|
| Phase 1 lean or big (1) | Lean: a stand shortage when the Ch.5 international banks arrive; widebodies hold on taxiways | Penalties to airlines; an angry partner at the next board |
| Bid size to AAI (1) | A high bid means a thin budget: one fire crew instead of two, so incidents take longer | Every rupee of revenue carries the share for 60 years |
| Borrowed in dollar bonds (1) | The Ch.6 crisis can be "the rupee falls 15%" | Repayments jump overnight |
| Monsoon earthworks: pay to speed up, or accept delay (2) | Delay: Ch.3 opens with half of concourse B closed | The extra cash needed if late (from the delay table) |
| Feeder cities signed (4) | Which spokes appear in the arrival bank, and how many connections are possible | Transfer passengers and route growth |
| Minimum connection time: 45 min (bold) or 60 min (safe) (4) | 45: more connections sold, but tight transfers miss when the feeder bank runs late | Connection revenue against missed-connection costs |
| Long-haul partner signed (5) | International departure banks appear (London, Singapore, Nairobi, Frankfurt) | The biggest money in the game, if connections hold |
| Bird radar bought or skipped (any board) | Skipped: a flock off the nearby lakes closes a runway mid-wave | Delays, penalties, safety |
| Airport City built (5–7) | Evening access-road jams delay crews and late passengers | Land income, partly offset by AERA |
| Fight AERA or accept (any) | Fight and lose: airlines cut a wave for a period | Fees now against goodwill later |
| Equity cure in the crisis (6) | Without it the banks take control, and the game ends with the step-in notice | The player's own money, or the airport |

**The test:** every board or chapter decision must have at least one visible effect in a later shift, with a paper tag. If a decision changes only a number, cut it or give it a visible effect.

---

## 5. Weird incidents, drawn from what the player set up

Incidents never feel random, because each one has a cause in the paper trail, a place on the map and a choice. Use the existing incident card system. Each incident is a call with two or three options. One or two incidents per shift is enough.

- **The hub incident (build this first):** the feeder bank from Lucknow runs 25 minutes late, and 380 passengers are connecting to the London departure. Hold London for 20 minutes (it misses its slot at Heathrow, costing ₹X), or let it go (they miss, Doha wins them, and the airline is furious).
- A cloudburst floods the access underpass, so crews arrive late.
- 47°C afternoon heat: heavy jets can't carry full loads, so the A380 to London must leave cargo behind.
- A VIP movement closes the airspace for 40 minutes in the middle of a bank.
- An IPL final: 60 charter flights in one evening.
- A drone over runway 3.
- A fictional airline collapses and leaves 30 aircraft parked on your stands, with unpaid fees. (This is real history: Jet Airways in 2019, Go First in 2023. Put the history on the card, not in the game's airline names.)
- The biggest airline demands lower charges or it moves its hub to Delhi: a hard choice about buyer power.
- A viral video of a long immigration queue costs the international banks.
- A grid failure, with an hour on backup power.
- A wedding-season charter wave (the existing Chambani wedding event is the right spirit).
- A medical emergency on a long-haul flight. Like every safety call, it never shows a price.

---

## 6. The learning: one card per chapter, never a lecture

At the end of each chapter, show a small paper card titled **"What really happened"**: two or three sentences of real history that rhymes with what the player just lived through. Each one must be sourced and checked; use `research/` and `money.json` sources. If a fact is not verified, leave it out. Examples of themes:
- **Build it:** Bengaluru's second terminal opened about 21 months late.
- **Wire the country:** how Atlanta became the world's busiest airport through Delta's hub banks.
- **Take on the Gulf:** how Dubai and its home airline turned a desert airport into a transfer hub.
- **The crisis:** what happened to Indian airports when Jet Airways stopped flying, or in the pandemic.
- **Harvest:** why Delhi's Aerocity and Bengaluru's land earn more than landing fees, and why AERA counts part of that against your charges.

The player learns because it just happened to them, not because a glossary told them.

---

## 7. The design: replace the screens that come after the onboarding

The screens after the deal desk are, in the user's words, "the shittiest thing that appears". These are the dark sheets with a yellow band and boxed cards: the income statement, the board meeting, the era screens and anything in the old `zmm-sheet` style. **Replace them all with the Paperwork system** (`money/DESIGN.md`), using these four screen types and no others:

### 7.1 The front page (opens every chapter)
A newspaper on the desk. Its masthead is fictional: **The Zero Mile Times**, dated with the in-game year.
- **Lead headline:** Libre Caslon Text 700, about 44px. It is written from the player's choices: "LONDON IN 9 HOURS FROM INDORE: VSI SIGNS SKYWARD". It reports facts; it does not judge the player.
- **One sub-story and two short columns**, all from the player's state: the banks, AERA, an airline, the rival hubs.
- **One photo box:** a pen-and-ink drawing of the masterplan detail that matters this chapter, for example the international pier. Re-use the masterplan SVG, cropped.
- The page lands on the desk with a paper slap (it drops and settles). The player reads it and turns it over, which opens the decision.
- Words: newspaper voice, short, concrete, with ₹ figures from `era.js`.

### 7.2 The decision (one document, at most three choices)
Use the deal-desk document exactly: typed body, handwritten fills, tick boxes or a drafting ruler, and the adviser's slip beside it showing the consequence in one big plain number. The document type matches the decision:
- a route agreement with an airline;
- the capital budget;
- AERA's order, with an appeal letter;
- a letter from the banks;
- a feeder-city list as a map with ticks.

It closes with a red stamp: SIGNED, APPROVED, FILED, DECLINED.

### 7.3 The shift briefing (before the shift) and the paper trail (during it)
Before the shift, the duty manager's handover is **one torn notepad sheet pinned to the top-left of the ops view**, not a modal. It holds:
- three lines of what is different today, each one linked to a document (for example "Skyward's London bank departs 14:10 · 380 connecting");
- the one thing to watch.

It starts the shift on its own after 6 seconds, or on click.

During the shift, the paper tags of §4 appear on the map wherever a past decision touches the present. The HUD shows only the game's existing night and sign-yellow look, plus the connections line under the money chip.

### 7.4 The bill (after the shift)
One page of the **annual report**, on white bond:
- a single typed paragraph in plain words;
- a three-line table: earned, spent, and connections made and missed;
- one handwritten margin note from the adviser linking cause and effect: "You held London twice. It cost ₹38 cr in slots and kept 760 passengers off Doha. Skyward is adding a Frankfurt flight."
- one number for the banks' health: "₹118 earned for every ₹100 due", with a pencil scale.

No glossary links. If the page needs one, rewrite it.

### Design rules for all four
- Laptop only (1280×800 to 1920). Real fonts in every screenshot review (DESIGN.md §9).
- One bold moment per screen: the headline, the stamp, the tag, the margin note.
- No yellow-banded dark sheets, no grids of boxed cards, no pill buttons, no step counters, no gradient glows.
- Motion only when the player acts, plus the newspaper drop and the stamp.
- Every number comes from `money/era.js`. Never hard-code figures in the UI.

---

## 8. The Steve Jobs and Peter Thiel review (run it before merging any chapter)

Answer each question in `progress.md`, in one line each. A "no" blocks the merge.

**Steve Jobs (the experience):**
1. Could a first-time player say what this chapter is about in one sentence after playing it?
2. Is there anything on screen we could delete without losing the decision? If yes, delete it.
3. Does the decision show up physically in the shift, with a paper tag?
4. Is there one moment a player would describe to a friend: the stamp, the held London flight, the headline with their own company in it?
5. Did we start from what the player feels and work back to the model, not the other way round?

**Peter Thiel (the thesis):**
1. Does the chapter teach the secret: the network is the moat, and connections make the money?
2. Is the player building something that compounds, or just repeating a task for a bigger number?
3. Is the competition real and specific (Dubai, Doha, a dominant airline, the banks), and does the player win by being different, not by grinding?
4. Does the player own the result? Is their name, signature and stake visible at the moments that matter?
5. Would a smart player who skipped the hub logic do clearly worse than one who understood it?

---

## 9. What to build now: the vertical slice, Chapter 5 "Take on the Gulf"

Build one chapter end to end, playable in about 15 minutes from a saved state at year 14. Build nothing else until it has been playtested.

1. **The front page:** "DUBAI, DOHA OR NAGPUR? THE RACE FOR INDIA'S TRAVELLERS". Write the rest from state. Use a statistic only if it is sourced in `research/`.
2. **The decision:** a route agreement with a fictional long-haul airline ("Skyward"). There are three choices:
   - sign for international banks to London, Singapore and Nairobi;
   - sign for London only;
   - decline.

   The adviser's slip shows connections and the money for each.
3. **The briefing sheet** pinned to the ops view.
4. **The shift:** Level 3 traffic reshaped as one domestic feeder bank followed by one international departure bank. It has:
   - connection floaters (§2);
   - the hub incident (§5): hold London or let it go;
   - one paper-trail incident: either the stand shortage (if phase 1 was lean) or the bird flock (if radar was skipped).
5. **The bill:** the annual-report page with the margin note.
6. **What really happened:** the Dubai hub story, sourced.

**Done means:**
- three playtesters can play it without help;
- each can explain afterwards why holding (or not holding) London mattered;
- the gate still passes.

**Then stop and report** with screenshots of each screen at 1440×900, real fonts. The user and the review session decide whether to scale it to all seven chapters.

### Lanes (parallel, separate files)
- **A. Hub traffic:** feeder and international bank schedules for Chapter 5, connection scoring, connection floaters. Files: `hub.js` (one writer), schedule data.
- **B. The four screen types** in `money/ui.js` (front page, decision, briefing sheet and paper tags, the bill), following §7 and DESIGN.md. Add a `?moneymock=` entry for each.
- **C. Chapter 5 script and state** in `money/era.js`: front-page text, the decision effects, the incident triggers, the bill numbers, and the "what really happened" card with sources.

Merge order: C, then B, then A. Run the gate after each merge.
