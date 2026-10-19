# version.md: the next version of VSI (for discussion, nothing built yet)

## 1. What went wrong

The paperwork looks good, but the concession is something you **read, not play**. Five chapters have a shift, but four of them (Takeoff, Climb, Turbulence, Landing) are played by the engine, not by you. A decision is a tick on a document, and its consequence is a number on the next page. There is no pressure, no mess, nothing that fights back. A player can skim from the deal desk to the Black Box in a few minutes and never feel the airport.

## 2. What stays

| Keep | Why |
|---|---|
| Quick play, Levels 1 to 4, exactly as they are | They work, and `main` serves them |
| The concession's front door: the start menu, the deal desk (incorporation, bid, loan, signing), the concession file | The design is good; you said so |
| The money engine (`era.js`) and the Black Box | It already turns 60 years of decisions into a return, and shows which decisions mattered |
| The paper style (DESIGN.md) for documents, bills and the debrief | Paper is for the moments you sign something, not for the playing |

## 3. The idea: Level 5, "Build VSI"

**You run the airport live, and you build it while it runs.** Level 5 is one long, playable level that is the heart of the concession. After the deal desk, you are dropped onto the airfield on opening day with two runways and two concourses, the money you raised, and traffic that grows every season. The airport you end up with is the one you chose to build: where, when, and how you paid for it.

The loop, every season (one playable day of operations, about 8 to 10 minutes):

1. **Plan (paused):** open the build menu, choose infrastructure, see what it costs, how long it takes, and what it will disrupt while it is being built.
2. **Run the day (live):** the shift plays as it does today (runway desk, bank chart, calls), but on *your* airport: the gates you built, the runways you have, the construction sites you opened.
3. **Feel it:** the building work gets in the way. A crane near a runway lowers its arrival rate, a dug-up taxiway forces long taxi routes, a half-built pier has no jet bridges. What you skipped hurts: no backup power means a grid failure, no fog landing system means diversions.
4. **The books (one paper page):** what the day earned, what the building cost, the banks' light, your stake. Then the next season, with more traffic, airlines asking for more, and a rival hub watching.

Time moves in seasons: about 12 to 15 seasons cover 60 years. Early seasons are 2 to 3 years each (the build-out); later ones are 5 years each.

## 4. The infrastructure decisions (each one is real, costs real money, takes real time, and changes the simulation)

Costs are ₹ crore at today's prices, from money.json's stage costs where they exist; "(est.)" means a game estimate to be checked.

### A. Runways and taxiways

| Decision | Cost | Build time | What changes in play | The catch |
|---|---|---|---|---|
| **New runway** (R3 to R6, each a parallel pair) | ~₹6,000 to 9,000 (est.) | 2 to 3 seasons | +30 to 40 movements an hour | While it is being built, the cranes cap the next runway's arrivals and a taxiway closes |
| **Rapid-exit taxiways** on a runway | ~₹300 (est.) | 1 season | Landings clear faster: +4 to 6 arrivals an hour on that runway | That runway closes at night for the works |
| **End-around taxiway** | ~₹900 (est.) | 1 season | Aircraft stop crossing active runways: no crossing holds | It eats apron space you might want for stands |
| **Fog landing system (CAT IIIB)** on one runway | ~₹250 (est.) | 1 season | Winter fog no longer forces diversions on that runway | Without it, December mornings divert flights to other airports |
| **Runway resurfacing** (it wears out with traffic) | ~₹400 (est.) | must close the runway for part of a season | Skip it and the runway gets speed limits, then closes for emergency repairs |

### B. Stands and apron

| Decision | Cost | Build time | What changes in play | The catch |
|---|---|---|---|---|
| **Contact stands** (with jet bridges) on a pier | ~₹120 each (est.) | 1 season | Passengers walk on; turnarounds are faster | They need the pier first |
| **Remote stands** | ~₹40 each (est.) | quick | Cheap capacity | Buses: turnarounds are 5 minutes slower and connections more often missed |
| **Widebody stands** (Code E and F, A380-ready) | ~₹250 each (est.) | 1 season | The long-haul banks (Air India's London and Singapore flights) can park at a contact stand | Without them, widebodies wait on taxiways, as today in Cruise |
| **Apron expansion** | ~₹1,500 (est.) | 1 to 2 seasons | Room for more stands | The construction zone blocks a taxi route while it is built |

### C. Terminal and passenger flow

| Decision | Cost | Build time | What changes in play | The catch |
|---|---|---|---|---|
| **A new pier**: concourse C, D, E, F (then satellites G and H) | money.json stages: 1B ₹32,000; 1C and 1D ₹38,000 each; phase 2 ₹32,000 | 2 to 3 seasons | More gates; the next airlines move in | Build too early and you pay for empty gates; too late and flights are turned away |
| **People mover** (the train under the apron) | ~₹4,000 (est.) | 2 seasons | The connection time falls from 60 to 40 minutes: more passengers make their connections | Until it opens, the far piers miss connections |
| **Security lanes** | ~₹15 a lane (est.) | quick | Shorter queues | Too few, and passengers miss departures at the morning peak |
| **Immigration counters** (international) | ~₹20 a counter (est.) | quick | International transfers keep moving | Too few, and a viral queue video costs you the international banks |
| **Transfer baggage system** | ~₹1,200 (est.) | 1 season | Bags make the connection with the passenger | Without it, short connections leave bags behind (penalties to airlines) |

### D. Systems that decide your bad days

| Decision | Cost | What changes in play | If you skip it |
|---|---|---|---|
| **Backup power** | ~₹350 (est.) | The airport keeps running through a grid failure | A grid failure blacks out a concourse for an hour, mid-wave |
| **Bird radar** | ~₹60 | Bird strikes are warned early | A flock from the lakes closes a runway |
| **Collaborative planning** (A-CDM: airlines, ATC and the airport share one timetable) | ~₹80 (est.) | Departures leave on time more often | Pushback queues build at every peak |
| **Fire stations** | ~₹150 each (est.) | Faster emergency response | A slow response closes the runway longer after any incident |
| **Fuel hydrant** | ~₹700 (est.) | Faster widebody turnarounds | Fuel trucks crowd the apron |

### E. Land and money

| Decision | Cost | What changes |
|---|---|---|
| **Zero Mile District** (hotels, offices, shops) | money.json `airport_city` | Rent and retail income; AERA counts 30% of it against your airline charges |
| **Metro link** | ~₹2,500 (est.) | More passengers choose VSI; less road traffic |
| **Cargo terminal** | ~₹1,000 (est.) | Freight income at night, when the runways are quiet |
| **Maintenance hangar** | ~₹800 (est.) | An airline bases aircraft here: more early-morning departures |

### F. Design and experience: how beautiful is your terminal?

**Beauty is a revenue decision, not decoration.** A calm, beautiful terminal keeps passengers longer and in a better mood, and people in that state spend far more on food, shops, lounges and duty-free: their spending is very sensitive to how the place makes them feel. Under the hybrid till, AERA counts only **30% of shop and food income** against your airline charges, so **about 70% of every extra rupee a passenger spends stays with the owner**. That is how Bengaluru's "terminal in a garden" became a margin story for BIAL and for Fairfax, its owner.

Every new terminal or pier asks you to choose its grade:

| Grade | Cost | What it does in play |
|---|---|---|
| **A plain shed** | the base cost | Cheapest. Passengers pass through; spending per passenger stays low; airlines see no reason to prefer you |
| **Standard** | about +8% (est.) | Average spending |
| **A terminal in a garden** (natural light, gardens inside, local art, a calm layout) | about +20% and a little longer to build (est.) | Spending per passenger climbs season by season; airlines and passengers choose you when they have a choice; it can earn the jackpot below |

What makes the experience in play (the "calm" the ledger already tracks): short security and immigration queues, short walks (the people mover), no crowding at peaks, the garden grade, and **what you charge in the shops**. Price the coffee too high and spending falls, because spending is elastic. So "keep airport prices close to city prices" is a real lever too.

**The catch:** AERA reviews what you spend on the building. If it decides part of the garden grade was more than an efficient airport needed, it leaves that part out of the costs your airline charges recover. That money then has to come back through the shops. The beautiful terminal is a bet that passengers will spend; if traffic doesn't come, it is an expensive, empty garden.

**What really happened (the card for this decision):** Bengaluru's Terminal 2, designed by SOM with gardens by Grant Associates, opened to domestic flights on 15 January 2023 and to international flights on 12 September 2023 (research/notes.md, blr-01 and blr-02). BIAL's shop, food and other non-airline income per passenger rose from about **₹219 in FY2023** to about **₹308 in FY2025** (excluding a one-off land sale) and about **₹347 in FY2026** (derived from research/bial.md: non-aero income ÷ passengers). That is roughly 40–60% in three years. T2 also added a lot of shop space, and prices rose meanwhile, so the card says what happened, not that beauty alone caused it.

## 5. The craziness, both ways

**The rule:** every big choice carries a **jackpot** as well as a downside. The game rewards a bet that pays off far beyond the plan, and it lets success **snowball**: one win makes the next one more likely, because the network compounds. Wild things happen *because of what you built and when*, never at random, and the upside should feel as dramatic as the trouble.

### Crazy success (earned)

| You did this | So this can happen | What you get |
|---|---|---|
| Built the **fog landing system** before anyone else in central and north India | A December fog closes Delhi, Lucknow and Jaipur for three days. **The whole north diverts to you** | A record day: 2 to 3 times your normal traffic, every diverted airline sees your airport, and some of them stay |
| Built **widebody stands and the people mover** early | **Air India moves its entire international transfer bank** from Delhi to VSI | A new long-haul wave every evening; the network effect starts: each new route makes every feeder city worth more |
| Held your connections at a 95%+ success rate for a few seasons | Airlines **bid against each other** for your morning and evening slots | Slot premiums, and AERA lets you keep more of the charges because your service is measurably better |
| Built the **cargo terminal** and a night-capable runway | A pharma maker and a phone maker pick Nagpur, at the centre of India, as their export hub | **Night freight** fills the quiet hours: income at 2 a.m. |
| Built **Zero Mile District** before the crowds came | The land around VSI becomes the place to be: hotels full, offices taken | Land income jumps, and a global hotel group pays for the next phase |
| Chose **50% spare capacity** in a pier everyone said was too big | A rival hub's runway closes for repairs for a season (or Dubai is shut by a storm) | **You are the only one with room**: you absorb their traffic overnight, and some of it never goes back |
| Kept fees low and service high on opening day | **IndiGo makes VSI its main hub**, not just a bank | Feeder flights from 30 cities, and each new international route fills itself |
| Ran a flawless **cricket final** or **state visit** day | The world watches the airport work | A one-day revenue spike, and an international airline signs because it saw the day |
| Built the **terminal in a garden** and kept shop prices near city prices | It is named among the world's most beautiful airports; people choose to connect here; they arrive early and stay longer | Spending per passenger climbs every season, and 70% of it is yours: the margin that makes your stake jump |
| Bought **NIIF's stake** cheaply during the crisis | The crisis ends and the airport recovers fast | You own 80% of a company worth far more: the single biggest jump in your return |

When a jackpot lands it gets its own big moment: a front page ("THE NORTH LANDS AT NAGPUR"), a record on the bank chart, a stamp in the file, and a bar on Black Box page 2.

### Crazy trouble (also earned)

| You did this | So this can happen |
|---|---|
| Opened a construction site next to a live runway | A crane strays into the approach path: that runway is restricted for the day |
| Dug a pier through the monsoon without paying for pumps | The dig floods; the pier opens a season late |
| Skipped **backup power** | A grid failure blacks out a concourse for an hour, mid-wave |
| Skipped the **fog system** | December mornings divert *your* flights to someone else's airport |
| Skipped the **people mover** | The far piers miss their connections, and passengers rebook through Doha |
| Grew one airline too big | IndiGo threatens to move its bank to Delhi unless you cut charges |
| Built the garden grade where traffic never came, or priced the shops too high | AERA leaves the extra out of your charges, and the shops don't make it back: a beautiful, expensive, quiet terminal |
| Spent too fast | The banks warn you, then freeze new building until you put in more money |
| Left a gap in your network | GMR's Hyderabad hub, or Dubai, cuts prices to take the routes you don't serve |

### Why both matter

Without the jackpots, the best a player can do is avoid disaster, which is a chore. With them, the same choice is both a bet and a risk: the big pier can be an empty-gate bill **or** the reason you swallow a rival's traffic. That is the game Thiel describes: a few bold bets make most of the return, and the Black Box shows exactly which ones did.

## 6. How it fits the concession

| Step | What the player does |
|---|---|
| The deal desk (built) | Win the concession, raise the money, sign |
| **Level 5: Build VSI** (new) | Season after season: plan the infrastructure, run the day, read one page of books. The front pages and the big paper decisions (Air India's route deal, the banks' crisis letter, the year-60 handover) appear **between seasons**, when they are due |
| The Black Box (built) | The 60-year return, which decisions made it, how you work |

The current flight (the chapters, the years-later boards) becomes the frame between seasons. The four engine-played shifts go away: every season is played by the player.

## 7. How I would build it (each step playable and checked before the next)

| Step | What | Playable when done |
|---|---|---|
| 1. The build menu and three decisions, end to end | Pause, open the menu, build **remote stands**, a **new pier** and the **people mover**; they take seasons, cost money, and change the live shift (more gates, a construction zone that blocks a taxi route, the 40-minute connection time) | One season loop you can play and feel |
| 2. Seasons and growth | Traffic grows each season; airlines move in when you have gates, and leave when you fail them | Several seasons in a row |
| 3. Craziness | The construction events and the "you skipped it" events | Bad days that come from your own choices |
| 4. The full catalogue | All decisions in section 4 | The whole Level 5 |
| 5. The frame | Front pages, the big paper decisions between seasons, the Black Box at the end | The whole concession |

## 8. Questions for you before I start

1. **How hands-on is building?** (a) Pick from a build menu, and the game places it where the masterplan says. (b) You place it yourself on the map (choose which pier, which stands). (b) is more fun and more work.
2. **How long is a season?** A full 8 to 10 minute day each time, or a shorter 4 to 5 minute peak with the rest simulated?
3. **2D or 3D for building?** Building in 2D only is much faster to make well; the 3D view would show what you built.
4. **Can you lose?** If the banks take control, does the concession end there (as today), or do you get one rescue?
5. **Which three decisions matter most to you for step 1?** My suggestion now: a new pier **with its beauty grade**, remote stands, and the people mover. Together they show capacity, cost, connections and spending per passenger in one season.

## 9. Added on 20 October (the user's notes, for Level 5)

| Item | Note |
|---|---|
| **The tender interview** | Make the bid a scene, not a slider: before the envelopes open, AAI's tender committee interviews you (three questions on traffic, money and the plan), your answers move the committee's score, and a rival's pitch is overheard in the corridor. The sealed-bid simulation (built 20 October: three rivals valuing VSI from the engine at their own cost of capital) stays underneath. |
| **Game estimates to verify** | The rivals' cost of capital, traffic views and shading (Adani 7.5% / ×1.08 / 0.62, GMR 8% / ×1.0 / 0.86, Zurich 8.5% / ×0.96 / 0.95); the market study's ₹25 cr (shown, not yet charged in the books); the private houses' rate and tenor changes; every "(est.)" cost in section 4. Cross-check each against a source before Level 5 ships. |
| **First "crazy success" to build: the cargo terminal** | The fastest jackpot: a cargo terminal plus a night-capable runway lets a phone maker and a pharma exporter pick Nagpur, at the centre of India, as their export hub: night freight income at 2 a.m., its own front page, and its own bar on Black Box page 2. Not built yet. |
| **Private capital** (built 20 October) | Five family networks on the loan page (Devakottai Chettiar Capital Network, the Nagarathar Ledger House; Sanchori Jain Samaj Capital; Palanpuri Jain Samaj Capital; Negev Runway Partners; Kongsi Bamboo Capital). You pitch one with one of three angles, watch their network move the money, and get approved, negotiated down, or a better deal on a condition about the deal (a 25-year loan against the passenger-fee account and an audit-committee seat, a cargo-terminal clause, approval of the chief executive and a retail lease, a drone test zone, Gate 8). Next: make each accepted condition appear in the game (the corridor, the vault, Gate 8). |
