# The seven chapters (design/chapters.md)

Sixty years of one airport, told as **one flight**: seven chapters named for the phases of a flight, then the **Black Box**, the debrief that reads back what happened. Every chapter uses the Chapter 5 template, which `VSIEra.ch5` already implements:

**front page → one decision on paper → a shift the decision visibly changes → the bill → "What really happened"**

The years between chapters run in the engine. They reach the player only through the next chapter's front page.

House rules (prompt-campaign.md §0–§8):
- plain words on screen;
- real history appears only on the sourced cards;
- money comes from connections, routes, land and shops, never from raw movements;
- one bold moment per screen, and at most three choices per decision;
- safety calls never show a price;
- tags never cover a runway or the terminal.

Examples use **Meridian Infra** and **Asha Rao**.

---

## 0. Names (fictional, each with a reason)

| Role | Name | Why this name |
|---|---|---|
| The feeder airline: threads 12 cities into one afternoon bank | **Sutradhar Air** | *Sūtradhāra*, Sanskrit "the one who holds the threads": the narrator of Sanskrit drama, and the master builder in Indian architectural texts. It holds the strings of the network. |
| The Bengaluru carrier that moves in on opening day | **Plateau Air** | Bengaluru sits on the Deccan Plateau, and is nicknamed the Silicon Plateau. |
| The long-haul partner: London, Singapore, Nairobi | **Haversine Airways** | The haversine formula is how navigators compute the great-circle distance between two points on the Earth. Long-haul is its whole job. |
| The rival who opens a hub in Hyderabad in year 34 | **Kármán Line Ventures** | The bidder you beat for the concession, back thirty years later. It is a callback, not a new name. |
| The land and shops district (Ch7) | **Zero Mile District** | Zero Mile is the place; the district is what grows around the marker. |
| The newspaper | **The Zero Mile Times** | (kept) |
| The debrief | **The Black Box** | A flight recorder: after the flight, it tells you what really happened and why. |

The existing names stay: VSI and VSIAL; L5 Capital: Lagrange Point Infrastructure Fund; Kármán Line Ventures, QNH Infragenesis and Thakral–Wainganga Airports (the bidders); Meridian Infra and Asha Rao (examples).

In code, Chapter 5's `Narmada Air` → **Sutradhar Air**, and `Skyward` → **Haversine Airways**. That is one constant each in `VSIEra.ch5` (`CH5.feederAirline`, `CH5.partner`). The signatory becomes "Chief Commercial Officer, Haversine Airways".

---

## 1. The shape: one flight, three sittings, about 105 minutes

We designed for the player, not for a number. Ninety minutes in one sitting asks too much on a laptop in an evening. The core shifts (Takeoff, Climb, Cruise) are the fun the playtesters replayed, so they shouldn't be cut to 7 minutes. So the flight is told in **three acts of about 35 minutes**:
- each act is one evening, and ends on a cliffhanger front page;
- the save (the concession file card) carries the player back in.

| Act | # | Chapter | Game years | Shift (data, like `CH5_LEVEL`) | Shift | Minutes |
|---|---|---|---|---|---|---|
| **I · The Deal** | 1 | **Clearance**: win the concession | 0 | none: the deal desk, 4 documents | — | 11 |
| | 2 | **Pushback**: build the airport | 1–4 | none: the construction register, 3 calls on one document | — | 7 |
| | 3 | **Takeoff**: open the doors | 5–7 | Level 1, the morning bank (06:00–09:00) | 10 | 15 |
| | | *Cliffhanger front page:* "AIRLINES ASK: WILL VSI BECOME INDIA'S CONNECTING HUB?" | | | | 2 |
| **II · The Network** | 4 | **Climb**: wire the country | 8–13 | Level 2 reshaped into the afternoon feeder bank | 10 | 15 |
| | 5 | **Cruise**: take on the Gulf | 14–18 | Level 3, the feeder bank, then the international bank (built) | 10 | 15 |
| | | *Cliffhanger front page:* written from the player's state, for example "A STORM IS COMING: RUPEE AT RECORD LOW" | | | | 2 |
| **III · The Long Game** | 6 | **Turbulence**: the crisis | 19–33 | Level 3 at half volume, with the crisis set piece | 8 | 13 |
| | 7 | **Landing**: hand it back | 34–60 | Level 4, one evening bank | 5 | 11 |
| | — | **The Black Box**: the debrief | — | 4 paper pages (design/debrief.md) | — | 10 |
| | | Saving, loading, and the "years later" pages between chapters | | | | 4 |
| | | **Total** | | | | **≈ 105** |

Each chapter keeps the same beats: front page (about 1 min), decision (1.5), briefing (0.2), shift, bill (1), card (0.5). The automated test fails a shift that runs more than 2 minutes over its target at 1×. Player speed controls (2×, 4×) still work.

A player who wants it all in one go can play straight through. Act breaks are offered, never forced: "Close the file for tonight" or "Turn the page".

---

## 2. Chapters

### Chapter 1 · Clearance: win the concession (built: the deal desk)
- **Front page:** none. The deal desk is the opening: the plotter draws the masterplan.
- **The documents:**
  - Incorporation: company and founder.
  - Financial bid: type and amount on the ruler.
  - Loan offer: phase 1 lean or big, the State loan, who lends, the share borrowed (60–75%), repayment.
  - The Concession Agreement: the trackpad signature. EXECUTED, then the seal.
- **Choices that matter later:**
  - bid size, which drives cash all game;
  - phase 1 lean or big, which drives the Chapter 5 stands;
  - the lender, where dollar bonds make Chapter 6 a rupee crisis;
  - the share borrowed, which drives the banks' light all game.
- **Card:** card 1, Delhi's 45.99% and Mumbai's 38.7%.
- **From era.js:** already there (`previewBid`, `previewClose`, `newCampaign`).

### Chapter 2 · Pushback: build the airport (built: the construction register)
- **Front page:** "FOUR YEARS TO BUILD AN AIRPORT THE SIZE OF ISTANBUL'S". Sub-story: what the works chart shows (₹ drawn so far, the earthworks). Columns: the banks (money drawn, interest while building) and land (the families resettled).
- **The decision:** the register's three calls, one per year, on one document:
  - **monsoon:** pay ₹600 cr to keep the earthworks dry, or accept a 4-month slip;
  - **overrun:** pay ₹3,000 cr, or accept an 8-month slip;
  - **trials:** full airline trials, or short ones that save ₹200 cr.

  The slip shows months, plus the shareholders' extra money. The stamp is APPROVED for each year, and the DGCA aerodrome licence at the end.
- **What it changes later:**
  - Short trials: in the Chapter 3 shift, the baggage system fails once. Tag: *"Construction register, 2030: short trials. The baggage belts were never run full."*
  - A slip: Chapter 3 opens later, with less runway time, and the front page says so.
- **Shift:** none. The years run in the engine (`applyConstruction`).
- **Card:** card 2, Bengaluru's 32 months to build and the second terminal's late glass, ceiling and boarding bridges.
- **From era.js:** already there (`constructionOpts`, `applyConstruction`).

### Chapter 3 · Takeoff: open the doors
- **Front page:** "VSI OPENS: A CITY'S FLIGHTS MOVE IN OVERNIGHT".
  - Sub-story: Plateau Air moves its Bengaluru connecting bank to VSI. It is written from the construction outcome: on time, or "*n* months late".
  - Columns: the banks (the first repayment date, from the share borrowed) and the stake.
- **The decision:** an **opening plan**, signed with Plateau Air. The slip's big number is the expected day-one delay in minutes, or the risk.

  | Choice | What the slip says | The stamp |
  |---|---|---|
  | **Big bang**: every flight moves in on day one, as Bengaluru did in 2008 | the fullest first bank; every system tested on the day | SIGNED |
  | **Phased**: half the flights in week 1, the rest in week 3 | a lighter day one; Plateau Air pays its crews twice | SIGNED |
  | **Soft open**: one airline's flights first | a quiet day one; Plateau Air delays its full move by a year (traffic lost in the engine) | SIGNED |

- **The shift:** Level 1 traffic, cut to the 06:00–09:00 arrival and departure bank, with volume scaled by the plan (100 / 60 / 30%).
- **Incidents** (each caused by an earlier choice):
  - **Baggage belt failure** *(cause: short trials, Ch2)*: "Belt 3 stops at 06:40 with 900 bags." Options: send ground staff to hand-carry (crew cost, slower turns), or hold three departures. Tag as Ch2.
  - **Wrong stand plan** *(cause: big bang)*: "Two Plateau Air jets assigned the same stand." Options: tow one to a remote stand (buses, a missed connection risk), or hold it on the taxiway.
- **What it changes later:**
  - The stars and on-time record of this opening set **Plateau Air's trust**, which carries into the Chapter 4 terms.
  - Big bang with 3★: Plateau Air offers to become a second feeder (option C in Chapter 4).
  - Soft open: the traffic lost is shown on the Chapter 4 front page.
- **The bill:**
  - The paragraph covers opening day, then years 5–7 in the engine.
  - Three lines: earned, spent, connections made and missed.
  - Margin note: *"Day one ran at 88% on time. Plateau Air's chief told the paper VSI 'opened like an airport that had been open for years'. Belt 3 cost ₹4 cr in hand-carried bags."*
- **Card:** card 3, Bengaluru opening in May 2008 and replacing HAL overnight.
- **"Every moment happens once":** opening day plays once per concession. There is no replay inside a concession. The debrief names it.
- **From era.js:** `ch3.{script, frontPage, decision, applyDecision, briefing, shiftPlan, applyShift, card}`. `applyShift` sets `s.plateauTrust` (0–1) and, for a soft open, `s.ch3TrafficLag`.
- **hub.js:** `CH3_LEVEL` (data: the Level 1 schedule, the 06:00–08:30 window, a volume factor); two incident definitions with `cause` keys.

### Chapter 4 · Climb: wire the country
- **Front page:** "TWELVE CITIES, ONE AFTERNOON: VSI BIDS TO BE INDIA'S CONNECTING HUB".
  - Sub-story: Sutradhar Air offers to time 12 cities into one bank. Dubai's charges column: "Doha and Dubai cut transfer charges again".
  - Column: the stake.
- **The decision:** a **network agreement**. This is where the Thiel ideas start (design/debrief.md §5).

  | Choice | What the slip says (one big number) | Later |
  |---|---|---|
  | **Anchor Sutradhar Air**: an exclusive afternoon bank, 40-minute connections, 10 years of lower charges for Sutradhar | +2,900 connections a day | The network grows fastest. One airline carries the bank, so if it fails, the bank fails (Ch6). |
  | **Cut charges 30% for every airline**, to pull flights from the Gulf | +18% flights next year | **The trap:** flights come, but they don't connect, and Dubai matches within a year. Revenue stays down for the 10-year term. |
  | **Two feeders share the bank**: Sutradhar Air plus Plateau Air (only if Plateau Air's trust from Ch3 is at least 0.7; otherwise this line reads "Plateau Air declined: day one went badly") | +2,100 connections a day | Slower, but no single point of failure. |

  Stamps: SIGNED / APPROVED / SIGNED.
- **The shift:** Level 2 traffic reshaped. The feeders arrive 12:40–13:40 (anchor) or 12:40–14:10 (two feeders, a looser bank). Domestic onward departures leave 14:20–15:10. Under "cut charges", traffic runs at Level 2 +18% with no bank shape, so connection floaters barely fire.
- **Incidents:**
  - **Tight connection** *(cause: anchor's 40-minute connections)*: "Indore flight 15 minutes late: 140 for Kochi and Guwahati." Hold the two departures, or let them go.
  - **Ramp congestion** *(cause: cut charges, more uncoordinated flights)*: "Eleven departures queued for push-back." Open the remote stands (buses), or meter the queue.
- **What it changes later:**
  - The bank shape becomes Chapter 5's feeder bank.
  - "Anchor" means Chapter 6 can be the airline collapse.
  - "Cut charges" lowers yield for the term (`s.chargeCut`), shows on the Chapter 5 front page, and the debrief names it the competition trap.
- **The bill:**
  - Margin note (anchor): *"Twelve cities now reach each other through VSI in one afternoon. Sutradhar Air carries 74% of your connecting passengers: if it stumbles, so do you."*
  - Margin note (cut charges): *"Flights up 18%. Connections up 2%. Dubai matched your cut in March. You are now paying airlines to fly past each other."*
- **Card:** card 4, Atlanta and Delta's hub.
- **From era.js:** `ch4.*`, with `s.network = {anchor|two|cut}`, `s.chargeCut` and `s.anchorShare`.
- **hub.js:** `CH4_LEVEL` (the bank schedule from `ch4.shiftPlan`).

### Chapter 5 · Cruise: take on the Gulf (built)
As built in `VSIEra.ch5`, with these additions:
- **Feeders come from Chapter 4:** the bank and its cities come from `s.network`. Two feeders means a looser bank, and the Lucknow call also checks Plateau Air.
- **Under "cut charges":** the slip numbers fall (lower yield) and the front page carries Dubai's matching cut.
- **Fixture:** used only for the `?chapter5=` test URLs. In play, the state comes from the player's own save.

### Chapter 6 · Turbulence: the crisis (chosen by the player's past)
- **Which crisis**, chosen by `ch6.pick(state)`, first match wins:

  | Past choice | Crisis | Front page |
  |---|---|---|
  | Borrowed in **dollar bonds** (Ch1) | The rupee falls 25% in a year | "RUPEE AT RECORD LOW: VSI'S DOLLAR DEBT JUMPS ₹X CR OVERNIGHT" |
  | **Anchored** one airline (Ch4) | Sutradhar Air stops flying | "NARMADA AIR GROUNDED: 30 JETS PARKED AT VSI, ₹X CR UNPAID" |
  | Otherwise | A pandemic | "PASSENGERS DOWN 62%: AIRPORTS ASK FOR RELIEF" |

- **The decision:** the **equity cure**, as a letter from the banks with three replies.

  | Choice | Slip | Stamp |
  |---|---|---|
  | **Put in your own money**: ₹X cr from Meridian Infra | Your stake stays 64%; your return falls by *n* points | CURED |
  | **Ask L5 Capital to put it in** | Your stake falls to *m*%, and L5's rises | AGREED |
  | **Refuse** | The banks take control. The game ends with the step-in notice. | REFUSED |

  ₹X comes from the engine: the cash needed to bring the worst year back to ₹110 for every ₹100 due.
- **The shift:** Level 3 at half volume.
  - **Airline collapse:** Sutradhar's 30 aircraft sit on stands for the whole shift, so stands are short. The incident: "Sutradhar's crews have not been paid; 4 jets block the international pier." Tow them to the remote apron (crew cost), or leave them (Haversine Airways waits).
  - **Rupee crisis:** fuel and lease costs jump. The incident: "Haversine Airways asks to cut London to once a day." Offer a charges discount for a year, or accept the cut.
  - **Pandemic:** a health-screening queue at arrivals is the incident. Open a second screening hall (₹ cost), or keep one. This is a safety-adjacent call, so the screening itself shows no price; only the hall does.
- **What it changes later:**
  - The cure decides the stake carried into Chapter 7 (64% or *m*%), which sets the L5 buyout price.
  - **Refusing ends the game:** the step-in notice on duty paper, the pile sliding off the desk, then the debrief.
- **The bill:** margin note: *"You put in ₹2,400 cr of your own when the banks asked. It cost you 1.1 points of return. Without it, the banks would own the airport today."*
- **Card:** card 6, the variant that matches the crisis: Jet Airways (2019) or Go First (2023) for a collapse, and Mumbai's pandemic relief for a pandemic. The rupee crisis has no sourced card yet. Until one is added to research/history-cards.md, it shows no card rather than an unrelated one.
- **From era.js:** `ch6.pick`, `ch6.*`, `s.shock = {kind, year}`, and the cure via the existing `cure` and `extra_pay`.
- **hub.js:** `CH6_LEVEL` (half volume and the parked-aircraft stand block).

### Chapter 7 · Landing: hand it back
- **Front page:** "THIRTY YEARS ON: [company] RUNS INDIA'S CONNECTING HUB". Sub-story from state: connections a year, routes, the stake's value. Column: "Kármán Line Ventures opens a rival hub at Hyderabad". The **last-mover** test (design/debrief.md §5).
- **The decision:** **board minutes with three resolutions**. Each is one tick: adopt or reject. The slip shows one number per resolution.
  1. **Build Zero Mile District** (land and shops; AERA counts 30% of its income against airline charges). Slip: ₹ a year by year 50.
  2. **Phase 2 satellites G and H: commit to a date now, with the airlines' letters signed, or wait and see.** Slip: routes added if committed.

     This is **definite optimism**: committing turns the plan into routes the airlines can sell.
  3. **Buy L5 Capital's stake, up to 80%**, priced on the airport's value now. Slip: the cost, and your share of the handover value.

  Stamp: APPROVED.
- **The shift:** Level 4, one 5-minute evening bank, with a scaled-up international bank. Incident *(cause: Zero Mile District)*: "Evening jam on the access road; 40 crew late for the 21:00 bank." Run buses from the city, or delay the bank.
- **Then:** the engine runs years 34–60, followed by the **handover certificate** (built, `ZMMoney.handback`). The day-one signature sits beside today's, with "60 years" in the stamp.
- **Card:** card 7, Delhi's ₹3,607 cr from shops and property against ₹3,011 cr from charges, and the 30% rule.
- **From era.js:** `ch7.*`, with `s.airportCity`, `s.p2year` (already in `s`) and `s.stake`, then `handbackOpts`.
- **hub.js:** `CH7_LEVEL`.

---

## 3. How the chapters connect (promises that pay off later)

| Made in | Promise | Pays off or bites in | How the player sees it |
|---|---|---|---|
| Ch1 bid size | cash all game | every bill | the bill's "spent" line; the Ch5 slip |
| Ch1 lean or big | 4 or 6 widebody stands | Ch5 | the stands tag; widebodies on taxiways |
| Ch1 dollar bonds | cheaper money | Ch6 | the rupee crisis front page |
| Ch1 share borrowed | the banks' light | Ch3–Ch6 | the light on every bill; the Ch6 cure size |
| Ch2 short trials | ₹200 cr saved | Ch3 | the belt failure tag |
| Ch2 slips | months late | Ch3 | the front page, "opened *n* months late" |
| Ch3 day-one record | Plateau Air's trust | Ch4 | option C open or "Plateau Air declined" |
| Ch4 network | the bank's shape | Ch5, Ch6 | the feeder bank; the airline collapse |
| Ch4 cut charges | flights now | Ch5–Ch7 | Dubai matches (front page); yield down on every bill |
| Ch5 hold or let go | Haversine's goodwill | Ch7 | routes added; the Frankfurt line |
| Ch6 cure | your stake | Ch7 | the L5 buyout price |
| Ch7 phase 2 committed | routes | years 34–60 | the handover's route count |

---

## 4. The paper-trail map (decision → later effect → tag text)

Tags are pins with at most 2 short lines. The full note opens on hover or click. Tags sit in the map margins with a leader line, never over a runway or the terminal, with at most 2 slips open at once.

| Decision | Later effect | Tag text |
|---|---|---|
| Ch1 phase 1 lean | Ch5: 4 stands for 6 widebodies | **Phase 1 choice, 2026** · Built lean: 4 widebody stands for 6. |
| Ch1 dollar bonds | Ch6: repayments jump | **Loan offer, 2026** · Borrowed in dollars. |
| Ch2 short trials | Ch3: belt 3 fails | **Construction register, 2030** · Short trials: belts never run full. |
| Ch2 monsoon accepted | Ch3: opening months later | **Construction register, 2028** · Accepted the monsoon slip. |
| Ch3 big bang | Ch3: the stand clash | **Opening plan, 2030** · Every flight on day one. |
| Ch3 day one, 3★ | Ch4: Plateau Air offers to feed | **Opening plan, 2030** · Plateau Air: "opened like it had been open for years." |
| Ch4 anchor Sutradhar | Ch5 bank; Ch6 collapse | **Network agreement, 2033** · Sutradhar carries 74% of connections. |
| Ch4 cut charges | Ch5–7 lower yield | **Network agreement, 2033** · Charges cut 30% for 10 years. |
| Ch4 40-minute connections | Ch4–5 tight transfers | **Network agreement, 2033** · 40-minute connections promised. |
| Bird radar skipped (Ch4 bill) | Ch5: birds close runway 3 | **Capital budget, 2034** · Skipped the bird radar. |
| Ch5 held London | Ch7 routes | **Haversine Airways agreement, 2039** · Held London for Lucknow. |
| Ch6 L5 put in the cure | Ch7 stake | **Banks' letter, 2046** · L5 put in the cure: you own 52%. |
| Ch7 Zero Mile District | Ch7 access-road jam | **Board minutes, 2059** · Zero Mile District built. |

The bird radar is the capital-budget line at the end of Chapter 4: one tick on the Chapter 4 bill page ("Approve the 2034 capital budget: bird radar, ₹45 cr"). It isn't a separate decision screen.

---

## 5. Incidents (each has a cause; one or two per shift)

| Chapter | Incident | Cause | Options (2–3) | Price shown? |
|---|---|---|---|---|
| 3 | Belt 3 stops with 900 bags | Ch2 short trials | hand-carry / hold 3 departures | yes |
| 3 | Two jets, one stand | Ch3 big bang | tow to remote / hold on taxiway | yes |
| 4 | Indore 15 min late, 140 connecting | Ch4 40-minute connections | hold 2 departures / let go | yes |
| 4 | 11 departures queued for push-back | Ch4 cut charges | open remote stands / meter the queue | yes |
| 5 | Lucknow 25 min late, 380 for London | Ch5 signed London (built) | hold 20 min / let go | yes |
| 5 | Birds off the lakes close runway 3 | radar skipped | close the runway / reduce rate. This is safety: **no price**. | no |
| 5 | Widebodies wait for stands | Ch1 lean | remote stands and buses / hold on taxiway | yes |
| 6 | Sutradhar jets block the pier | Ch4 anchor and collapse | tow to remote / leave them | yes |
| 6 | Haversine Airways wants London once a day | Ch1 dollars and the rupee fall | a year's discount / accept the cut | yes |
| 6 | The screening queue at arrivals | pandemic | open a second hall / keep one. The screening itself is safety: no price; the hall is shown. | hall only |
| 7 | Access-road jam, 40 crew late | Ch7 Zero Mile District | buses from the city / delay the bank | yes |

The medical, fuel and MAYDAY calls that already exist stay as they are and never show a price.

---

## 6. Data and API needs

**era.js** (one writer). Each chapter gets `VSIEra.chN` with the Chapter 5 shape:
- `script`
- `frontPage(state)`
- `decision(state)` → `{docType, title, date, dateWords, body[], choices[{id, label, terms, slip:{big, money, stake, line}}], stamps}`
- `applyDecision(state, id)`
- `briefing(state)`
- `shiftPlan(state)` → `{level, window, volume, banks, incidents[{id, cause, docId, lines}], tags[], rates}`
- `applyShift(state, result)` → `{state, bill, card}`
- `card(variant)`

Plus:
- **`VSIEra.chapter(state)`**: which chapter is next.
- **`VSIEra.bridge(state, n)`**: runs the engine years between chapters and returns the "years later" front-page facts.
- **New `s` fields:** `plateauTrust`, `ch3TrafficLag`, `network`, `chargeCut`, `anchorShare`, `shock`, `airportCity`, plus `decisions[]`, the log the debrief reads (design/debrief.md §2).

**hub.js** (one writer):
- Generalise `HUB.startChapter5` and `CH5F` into `HUB.startChapter(n, plan, hooks)` and `CHF`, a registry keyed by chapter.
- Add `CH3_LEVEL`, `CH4_LEVEL`, `CH6_LEVEL` and `CH7_LEVEL` as data: a schedule window, a volume factor, bank shapes and stand blocks.
- Incidents are declared in the plan, with `cause` and `docId`, and fired by time or condition.
- Quick play (Levels 1–4) is untouched.

**ui.js** (one writer):
- `frontPage`, `decision`, `briefing`, `tag`, `bill` and `whatHappened` are already built.
- Add three things:
  - `ZMMoney.minutes(o)`: board minutes with up to 3 resolutions, for Chapter 7;
  - `ZMMoney.letter(o)`: the banks' letter with 3 replies, for Chapter 6;
  - `ZMMoney.debrief(o)`: the 4 debrief pages, design/debrief.md.
- Make tags pins, kept in the margins.

---

## 7. The §8 review applied

| Question | Answer | Why, and what changed |
|---|---|---|
| Jobs 1: can a first-timer say what each chapter is about in one sentence? | yes | Each front-page lead is that sentence ("A city's flights move in overnight"). |
| Jobs 2: anything to delete? | yes, deleted | Chapter 7's three separate documents became one set of minutes. Chapter 2 stays one register, not three screens. The bird radar is a tick on the Ch4 bill, not a screen. |
| Jobs 3: does every decision show physically in a shift? | yes | §4 map. The Ch7 phase 2 call shows on the handover's route count and the Ch7 bank size. |
| Jobs 4: one moment worth telling a friend? | yes | Signing (Ch1), opening day (Ch3), holding London (Ch5), the cure letter (Ch6), the handover with both signatures (Ch7). |
| Jobs 5: experience first, model second? | yes | Each chapter starts from the feeling (opening day, the network, the crisis) and asks the engine only for numbers. |
| Thiel 1: does it teach that the network is the moat? | yes | Ch4 → Ch5 compounding; the connection stream; the debrief's attribution. |
| Thiel 2: compounding, or repetition? | compounding | Chapter by chapter, the shift changes shape because of earlier documents. No chapter repeats a task for a bigger number. |
| Thiel 3: is the competition real, and does the player win by being different? | yes | Doha and Dubai, the charges trap (Ch4), Kármán Line's Hyderabad hub (Ch7). |
| Thiel 4: does the player own the result? | yes | Name, signature and stake are on every front page, bill and certificate. Ch6 can cost the stake. |
| Thiel 5: does the player who skips hub logic do clearly worse? | yes | Acceptance tests (design/build-plan.md §3): the blind run must end at least 3 points of return below the smart one. |
