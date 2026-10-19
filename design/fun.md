# The Fun Engine (design/fun.md): how we find what to add next

**Why this exists:** the concession plays like a stack of forms. You sign, the engine plays the years, and a number comes back. You skim because nothing happens *to you* and nothing you did *comes back to you* while you're watching. This file is the method every session uses before building anything for the concession or Level 5. It has five steps: **audit → generate → filter → score → card**.

Owner: any session. Update it when a rule proves wrong.

---

## Step 1 · Audit: the five tests every chapter must pass

Play the chapter yourself, or read its screenshots in order, and score each test 0, 1 or 2.

| Test | Passes (2) when… | Fails (0) when… |
|---|---|---|
| **Decide** | the player makes a real choice at least every 90 seconds, and the options are genuinely different | the engine decides for them, or every option leads to the same result |
| **Feel** | the result of a choice shows up *on the map or the paper within a minute*: a plane, a queue, a stamp, a person reacting | the result is a number on the next bill |
| **Surprise** | once per chapter, something happens the player couldn't have predicted but can explain afterwards ("oh, because I…") | everything that happens was announced |
| **Story** | the player could tell a friend about the chapter in one sentence ("I held London for 380 people and Air India added Frankfurt") | they'd say "I clicked through some papers" |
| **Mastery** | a second play would go differently, because the player learned how something works | there's nothing to learn; any choice is fine |

**A chapter under 7 out of 10 gets rebuilt before anything new is added to it.** Put the score table in `progress.md` with the date.

## Step 2 · Generate: ten lenses for crazy ideas

For each test a chapter fails, generate **at least 10 ideas**, using at least 4 of these lenses. Crazy is welcome at this step; filtering comes later.

1. **History rhyme.** What really happened to an Indian or world airport that we can stage? Examples:
   - Bengaluru moving overnight in 2008;
   - Mumbai closed by floods for two days in 2005;
   - Kochi shut by the Kerala floods in 2018;
   - Delhi's winter fog and its CAT III diversions;
   - Jet Airways and Go First stopping overnight;
   - the 2010 volcanic ash cloud;
   - Heathrow shut by a substation fire in 2025.

   A sourced card goes with it.
2. **The decision comes back as a person.** A past choice returns as a named character who remembers it, such as Plateau Air's operations chief, the lender partner, the AERA officer or the SPG officer. People are more memorable than percentages.
3. **The jackpot twin.** Every kind of trouble has an upside of the same size. If fog can hurt you, fog elsewhere can send you sixty diverted jets at 4 a.m. Upsides are earned by earlier choices: spare stands, a cargo terminal, trust.
4. **The flipped constraint.** Give the player far too little (one runway for a day) or far too much (double the traffic tonight), then let them choose how to cope.
5. **Indian calendar.** Monsoon, Diwali and wedding season, Holi, the Kumbh Mela, an IPL or World Cup final, election season (the model code of conduct), Nagpur's orange harvest, and Haj season.
6. **The clock on the paper.** Paper screens get real time pressure: the banks' letter expires when the shift ends; an airline's offer is open for one bank only.
7. **Founder moments.** You speak, negotiate or bet: a press conference after a bad day, a board vote with named directors, a double-or-nothing pitch, a rival poaching your COO mid-crisis.
8. **Second-order chain.** One choice → a visible effect → someone else's reaction → a new choice, all inside one chapter.
9. **Scale shock.** Show the size: a whole city's flights moving overnight, 30 jets parked on your pier, one night of freight filling a field with orange crates.
10. **The unfair rival.** Dubai, Doha or Hyderabad does something aggressive and the player must answer in one move.

## Step 3 · Filter: every idea must pass all six

1. **Credible:** it could happen at an Indian airport. Name a source, or mark it "(est.)" with the reasoning.
2. **Caused:** it's triggered by, or changes the outcome of, something the player chose. Random weather alone doesn't count, unless the player's earlier choices decide how badly it hurts or how much it pays.
3. **Felt in 60 seconds:** the player sees it on the map or the paper within a minute.
4. **At most 3 choices.** Safety calls never show a price.
5. **Plain words**, no finance jargon. No jokes about a community, religion, caste, diet or luck. Real companies only in factual roles; no real person mocked or quoted.
6. **Fits the flight:** it lives in one chapter's shift or paper, and the rest of the 60 years can carry its effect.

## Step 4 · Score: build the top three, not the top thirty

| Score | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| **Wow** (would they tell a friend?) | no | mildly | yes | they'd screenshot it |
| **Agency** (does the choice matter?) | no | a little | clearly | it changes the next chapter |
| **Link** (does it pay off a past decision?) | no | loosely | directly, with its paper pin | — |
| **Cost** to build | — | S (≤1 h) | M (≤3 h) | L (a day) |

**Priority = (Wow + Agency + Link) ÷ Cost.** Build the three highest per chapter, then audit again.

## Step 5 · The card (one per idea, in `design/ideas/`)

```
TITLE:          (5 words, newspaper style)
CHAPTER, WHEN:  Climb · 2034, 04:10
CAUSE:          which past choice makes it happen, or decides how big it is (and its paper pin)
ON SCREEN:      what the player sees in the first 10 seconds
CHOICES (≤3):   each with its effect now, and its echo later
ECHO:           where it comes back (chapter, front page, Black Box line)
TRUTH:          source URL, or (est.) with reasoning
SCORE:          Wow / Agency / Link / Cost → priority
```

## The loop

Audit all chapters → generate per failing test → filter → score → write the cards → **the user picks** → build the top three → audit again. One loop per working session. Never build an idea that hasn't got a card.

---

## First pass (19–20 October 2026): the concession as it stands

**Audit, from the flight run and the build session's own table:**

| Chapter | Decide | Feel | Surprise | Story | Mastery | Total |
|---|---|---|---|---|---|---|
| Clearance (deal desk) | 2 | 1 | 1 | 1 | 2 | 7 |
| Pushback (construction) | 1 | 0 | 0 | 0 | 1 | **2** |
| Takeoff (stub) | 1 | 0 | 0 | 0 | 1 | **2** |
| Climb (stub) | 2 | 0 | 0 | 1 | 1 | **4** |
| Cruise (live) | 2 | 2 | 1 | 2 | 2 | 9 |
| Turbulence (stub plus letter) | 2 | 0 | 1 | 1 | 1 | **5** |
| Landing (stub plus minutes) | 1 | 0 | 0 | 0 | 1 | **2** |

Cruise works because it's the only chapter where a decision is felt live (hold London, watch 380 people walk). **So the first fix isn't more paper. It's putting a live moment like Cruise's into every chapter.**

**Twelve ideas that passed the filter, ranked by priority:**

| # | Idea | Chapter | Lenses | Cause | Wow / Agency / Link / Cost | Priority |
|---|---|---|---|---|---|---|
| 1 | **Fog windfall:** Delhi is fogged in at 04:00; 60 northbound jets ask to divert to VSI within 20 minutes. Open the remote stands and earn a night's fees, or refuse and protect the morning bank. | Climb | 3, 1, 9 | the stands you built (Pushback) and your trust with airlines | 3 / 3 / 2 / M | **4.0** |
| 2 | **Orange night freight:** Nagpur's orange harvest; 40 freighters a night to the Gulf, if your cargo terminal exists. | Climb/Cruise | 5, 3, 9 | Sanchori's cargo clause, or a cargo terminal built at a board | 3 / 2 / 2 / M | **3.5** |
| 3 | **The chip bet:** while you raise money, a chip assembly-and-test plant in MIHAN, next to your cargo apron, asks VSIAL to co-invest. Fifteen years later its chips fly out as high-value cargo, and in year 25 the stake is sold. Full card: `design/ideas/chip-bet.md`. | Climb (the fundraising board) | 7, 3, 2 | your cash, the cargo terminal (Sanchori's clause or a board), your lender | 3 / 3 / 2 / M | **4.0** |
| 4 | **Overnight move, live:** Takeoff becomes the real Bengaluru-style night move, with aircraft ferrying in, a belt failure and a stand clash, using the incidents that already exist. | Takeoff | 1, 9, 4 | phased vs big bang; short trials | 3 / 3 / 2 / L | 2.7 |
| 5 | **The collapse auction:** when an airline stops flying, its slots and parked jets go to auction tonight; bid for the evening bank. | Turbulence | 3, 7 | your cash, and whether you cured with your own money | 3 / 3 / 2 / M | **4.0** |
| 6 | **Press conference after a bad day:** three questions from The Zero Mile Times; your answers move airline trust. | any | 7, 2 | the worst number on your last bill | 2 / 2 / 2 / S | **6.0** |
| 7 | **Mumbai floods divert to you (2005-style):** two days of Mumbai's flights; capacity test. | Cruise | 1, 4 | lean vs big phase 1 | 3 / 2 / 2 / M | 3.5 |
| 8 | **Election inauguration:** officials want phase 2 opened before the model code of conduct, half-finished. Open early, or wait. | Landing | 5, 7 | phase 2 timing | 3 / 3 / 2 / M | **4.0** |
| 9 | **The rival poaches your COO** in the middle of the crisis; match the offer, let them go, or counter-poach. | Turbulence | 7, 10 | Kármán Line's return | 2 / 2 / 1 / S | **5.0** |
| 10 | **World Cup final at Nagpur's cricket stadium:** 90 charters in 6 hours. | Landing | 5, 9 | stands, the access road (Zero Mile District) | 3 / 2 / 2 / M | 3.5 |
| 11 | **Double-or-nothing A380 base pitch:** stake half a year's fees to win Air India's widebody base. | Cruise | 7, 3 | your connection record (the hold-London call) | 3 / 3 / 2 / M | **4.0** |
| 12 | **Private-capital conditions bite back:** the audit-committee seat questions a bill; the cargo clause triggers #2; the test strip runs its first drone inspection mid-shift. | various | 2, 8 | the lender you chose | 2 / 2 / 2 / M | 3.0 |

**Recommended build order:**
1. **Wire the 8 incidents that already exist** (the build session's step 1). Every chapter gets live Decide and Feel at once. It's cheap and it's all in the engine already.
2. **#6 Press conference:** cheap, high priority.
3. **#3 The chip bet, #1 Fog windfall, #5 Collapse auction, #8 Election inauguration, #11 A380 pitch:** the jackpots and the long bets.
4. **#4 Overnight move, live:** the big one, part of Level 5.
