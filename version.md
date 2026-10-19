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

## 5. The craziness (the game fights back)

Things go wrong **because of what you built and when**, never at random:

- **Construction chaos:** a crane strays into a runway's approach path, so that runway is restricted for the day. The monsoon floods the dig for the new pier. A contractor cuts a power cable, and half the stands lose jet bridges.
- **What you skipped comes back:** no backup power, a grid failure. No fog system, December diversions. No people mover, the far piers miss their connections.
- **Success makes its own mess:** too many airlines want the same morning slots. IndiGo threatens to move its bank to Delhi unless you cut charges. A cricket final brings 60 charter flights in one evening.
- **The rivals move:** GMR's Hyderabad hub cuts its charges to steal your transfer passengers. Dubai adds flights to every Indian city you don't connect.
- **The banks watch:** spend too fast and the banks warn you, then freeze new building until you put in more money.

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
5. **Which three decisions matter most to you for step 1?** My suggestion: remote stands, a new pier, the people mover.
