# The Paperwork design system (VSI money layer)

This is the design language for every money screen in Vikram Sarabhai International. The deal desk in `money/ui.js` (`M.onboarding`) is its reference build. When you design a new money screen, read this first and reuse the `zdk-` classes before inventing anything.

The user's standing rules:
- Laptop only.
- Designed from first principles (Stanford d.school: empathise, define, ideate, prototype, test).
- Push the design frontier.
- Plain words.
- No generic, templated or "vibe-coded" looks.

## 1. The idea

**Running an airport concession is paperwork with consequences.** Every big money moment is a document crossing the player's desk: incorporation, the bid, the bank's offer, the agreement, the regulator's order, the board minutes, the annual report, the handover. The player fills documents in by hand, signs them and gets them stamped. Each one joins a stack.

The game itself stays in its own identity: night black, sign yellow, airport wayfinding. The money layer is the **day-time paper world** next to it. When a money moment comes, the paper slides over the ops view. When it is done, the camera goes back to the airport.

**Point of view.** The player must feel the weight of what they are committing: ₹ thousands of crores, for 60 years, with their own name on it. Ownership is what makes the money matter.

## 2. Principles

1. **One document at a time.** Never show the steps still to come: no step list, no "2 of 4". Completed documents pile up on the left. That pile is the only sign of progress.
2. **Every decision is a mark on paper.** A tick in a box, a handwritten amount, a cursor on a drafting ruler, a signature. Never a toggle switch, a slider chip or a card grid.
3. **Consequences go on a slip, not in the form.** The yellow adviser's slip, clipped beside the document, shows what the current choice does. Use plain words, one big number, and one pencil-drawn scale where needed.
4. **Stamps confirm.** Finishing a document brings down a red rubber stamp: INCORPORATED, BID RECEIVED, SANCTIONED, EXECUTED, APPROVED, FILED. The stamp is the "success state". Never use a toast or a green tick.
5. **Real dates.** Every document is dated the day the player is playing, plus the in-game year where one applies. The concession runs 60 years from signing, ending the day before the anniversary.
6. **All parties appear.** Agreements name every party: AAI, the State (through MADC), VSIAL, the player's company with the player as director, and L5 Capital. Other parties' signatures are already on the page; the player signs last.
7. **Plain words, always.** The player never sees DSCR, RAB, WACC, true-up, EBITDA, IRR, SLA, UDF, covenant or step-in. For example:
   - Loan cover: "₹116 earned for every ₹100 due".
   - "The banks warn you", "the banks take control".
   - "Operating profit", "your return per year".
   - "Penalties to airlines", "passenger fee".
   - "AERA let you recover ₹X cr you were owed".

   If a screen needs the glossary, cut it.
8. **Spend boldness in one place per screen.** On the agreement, the moment is the signature and the stamp. On the bid, it is the ruler. Keep everything else quiet.

## 3. Tokens (scoped on `.zdk`)

| Token | Value | Use |
|---|---|---|
| `--zs` | `#e4e8e5` | the desk: engineering drawing sheet, with a cyan grid at 24px and 120px |
| `--zp` | `#fcfcf9` | document paper (white bond) |
| duty paper | `#eff4ed` with a green guilloche border | the agreement, and any statutory instrument |
| slip | `#fbf5d3` | adviser's notes, with a paperclip |
| `--zt` | `#1d2024` | typed text and rules |
| `--zi` | `#1f3a8a` | blue ballpoint: everything the player writes or signs |
| `--zr` | `#c22a2e` | red stamp ink, the drafting cursor, the serial number |
| `--zw` | `#b06d12` | amber: warnings (pencil, on slips and caps) |
| `--zg` | `#2b7a4b` | green: safe |
| `--zpe` | `#676c71` | pencil and graphite: labels, hints |
| seal | `--zr` with `mix-blend-mode:multiply` and `filter:url(#zdkInk)` | stamps and seals, with grainy rubber ink |

Do not use: the cream-and-terracotta "editorial" look, gradients as decoration, rounded cards with soft shadows, emoji, or all-caps eyebrow labels. Caps are allowed only on stamps and duty-paper legends, where real documents use them.

## 4. Type

| Role | Face | Where |
|---|---|---|
| Typed legal text, labels, tables | **Courier Prime** (`--ft`) | document body, 14–14.5px, line-height 1.6 |
| Handwriting: fills, amounts, ticks, slips | **Kalam** (`--fh`), blue `--zi`, or pencil on slips | inputs at 30px; amounts at 32–54px; slip text at 16.5px |
| Document titles | **Libre Caslon Text** 700 (`--fd`) | h2 at 30px; the agreement title at 30px with the logo |
| Hindi titles | **Tiro Devanagari Hindi** (`--fhi`) | under the English title on statutory papers (रियायत करार) |
| Stamps and buttons | **Barlow Condensed** 700 (the game's `--f-sign`) | stamp words uppercase with letter-spacing .07em; the primary button at 19px |

The fonts load once through `loadDeskFonts()` (a Google Fonts link added beside the game's own). For screenshots in the sandbox, serve them from `@fontsource` (see §9).

## 5. Layout (laptop: 1280×800 up to 1920)

```
┌─ desk: grid paper + the masterplan plotted in drafting ink ──── title block ┐
│ VSI logo · airport name                                          Not now    │
│                                                                             │
│  ┌pile┐     ┌──────────── current document ─────────┐   ┌ adviser's slip ┐  │
│  │done│     │ header: form no. · date                │   │ one question   │  │
│  │docs│     │ h2 title                               │   │ big number     │  │
│  │+red│     │ typed body, handwritten fills          │   │ pencil scale   │  │
│  │stmp│     │ tick boxes · drafting ruler            │   │ one line why   │  │
│  └────┘     │ signature line                         │   └────────────────┘  │
│             └────────────────────────────────────────┘                       │
│             [Primary action]  secondary link  Back                           │
└─────────────────────────────────────────────────────────────────────────────┘
```
- The grid is `minmax(250px,1fr) minmax(560px,640px) minmax(250px,1fr)`. Duty paper widens to 760px.
- The document scrolls inside itself. When the action is below the fold (a signature), the document scrolls itself there smoothly, the way a clerk would show you where to sign, and a yellow **SIGN HERE** flag appears.
- Actions sit on the desk under the document:
  - the primary is a black plate (`.zdk-go`);
  - secondaries are underlined Courier links (`.zdk-q`);
  - Back is always available until the final signature.

## 6. Components (all in `money/ui.js`)

| Component | Class or function | Notes |
|---|---|---|
| Desk shell | `.zdk`, `.zdk-sheet`, `.zdk-plan`, `.zdk-tb` | The masterplan is cloned from `#planTpl` and inverted to drafting ink. Its opacity rises with `--ink` as the deal firms up. |
| Document | `.zdk-doc` (`.duty` for statutory paper) | Header `.zdk-dh` with the form name and date (`.dt`). |
| Handwritten field | `.zdk-f` with an `input` | Kalam in blue on a dotted line; the line turns solid blue on focus. |
| Handwritten fill in text | `H(text)`, giving `span.h` | Any value the player decided, inside typed text. |
| Tick boxes | `.zdk-ticks` with `button[role=radio]` holding `i`, a label and `small` | The tick is a Kalam ✓ that overshoots the box. Wrap mixed inline content in one `span` (the grid needs one label item). |
| Drafting ruler | `ruler(id,min,max,step,val,label,marks,fmt)` | Real benchmarks pencilled above, in two lanes when crowded. Red cursor. |
| Adviser's slip | `.zdk-note` | h3 question, a big Kalam number, an optional pencil scale (`.zdk-dscr`), and one or two short paragraphs. |
| Rubber stamp | `stampHtml(word, cls)` | `down` animates, `big` is for the finale, `mini` is used on the pile card. Always dated, with "· VSIAL". |
| Company seal | `sealSvg()` | Round, red, with the logo in the centre and the SPV name on the arc. |
| Countersignatures | `signSvg(M.cfg.signatories[key])` | Each fictional official signs their own name in their own script face, slant, ink and flourish (aai, state, coinvestor, dgca, aai60, state60). Never imitate a real person's signature. |
| Signature pad | `sigPad(canvas, onChange)` | Pointer events with blue ballpoint ink that thins with speed. `png()` returns the image for later screens. |
| Pile card | `.zdk-card` | Title, fake text lines and a mini stamp. It flies in from the document. |
| VSI logo | `vsiLogo(size)` | A ring, an orbit and a satellite around a V, for Vikram Sarabhai. |
| Guilloche | `rosette()`, used as the `--guil` tile | The duty-paper security border. |

## 7. Motion (each one answers an action, except the plot)

- **Open:** the masterplan is plotted in left to right over 2.6s, with a red plotter line. This is the one ambient moment.
- **A document arrives:** it slides up 70px and settles from a 1.4° tilt (0.55s). The slip slides in from the right 150ms later.
- **A choice changes a value:** the value changes in place, and meters ease over 0.3s. Do not re-animate the whole document when a tick box changes.
- **Finish a document:** the stamp comes down (0.3s, scale 2.3 → 1, with overshoot), the document thuds, then flies to the pile while a new pile card lands.
- **Finale:** EXECUTED and the seal come down, the paperwork drops away, the camera pushes into the masterplan (scale 1.9 over 1.5s), and the game appears.
- **Reduced motion:** every animation has a static fallback.

## 8. Writing

- **The document voice** is typed, formal and short: "This agreement is made at Nagpur on the 19th day of October 2026, between:".
- **The slip voice** is the player's adviser, plain and direct: "Can VSIAL pay the banks? In its hardest year, the airport earns ₹114 for every ₹100 due."
- **Buttons name the act:** "File for incorporation", "Seal and submit the bid", "Accept the term sheet", "Sign the concession". The stamp then echoes it.
- **Numbers** are in ₹ crore, Indian grouping (₹1,04,000 cr), through `fmt()`.
- **Names** come from `M.cfg`: the airport is **Vikram Sarabhai International (VSI)**, the SPV is **VSIAL**, and **Zero Mile** is only the place (Zero Mile Tower, Hall, marker, district). The rivals are Kármán Line Ventures, QNH Infragenesis and Thakral–Wainganga Airports. The co-investor is L5 Capital: Lagrange Point Infrastructure Fund.

## 9. Testing (a screen is not done until you have looked at it)

- Build: `python3 build.py`, then open `site/index.html?moneymock=onboarding`. Each screen has, or gets, a `?moneymock=` entry.
- Screenshot it with Playwright at **1440×900 and 1280×800**, using the real fonts. In the sandbox the font CDN is blocked, so:
  - `npm i @fontsource/{kalam,courier-prime,libre-caslon-text,tiro-devanagari-hindi,barlow-condensed,barlow,jetbrains-mono}`;
  - route `fonts.googleapis.com` to a local `@font-face` CSS;
  - route `fonts.gstatic.com/local/*` to the woff2 files.

  Screenshots taken with fallback fonts are not valid design reviews.
- Click through every document. Draw a signature with mouse moves. Confirm the promise resolves and the overlay closes.
- Keys typed in money dialogs must not reach the game: Space, 1, 2 and 3 are game shortcuts. The overlay already stops their propagation.

## 10. The next screens, in this system

| Screen | Document | The bold moment |
|---|---|---|
| Board meeting (between eras) | **Board minutes** on white bond, with numbered agenda items. AERA's order is a separate **regulator's order** on duty paper, clipped on top. The investments are a **capital budget** with tick boxes. Dividends and prepaying are handwritten amounts on a ruler. | The player initials each resolution. A red **APPROVED** stamp appears on the minutes. |
| AERA appeal | A **letter of appeal** the player signs, with a pencilled note giving the odds | **FILED** stamp |
| Lenders' warning | A **letter from the banks**, one paragraph long, with the amber number circled in pencil | none: it should feel cold |
| Banks take control | A **notice of step-in** on duty paper; the pile of earlier documents slides off the desk | the whole desk goes grey |
| Buying out L5 Capital | A **share transfer form**, then a new share certificate with the player's stake re-stamped (64% → 68% …) | the new percentage written in |
| End of shift or era | The **annual report** page: a typed statement in plain words, with one handwritten margin note | none: it is a reading moment |
| Handback (year 60) | The **handover certificate** on duty paper. The player's original signature from day one (`signature` from onboarding) appears beside today's. | "60 years" in the stamp |

The in-game HUD (the "Today" chip, floaters and the P&L tab) stays in the game's night and sign-yellow look. Paper is reserved for decisions.

## 11. What the user rejected (do not do these again)

- A floating dark modal card with pill buttons, a "01 / 03" counter and a gradient glow. The user called it "basic, lovable-coded, vibe-coded".
- Showing the upcoming steps in a header ("Company / Bid / Funding / Signature").
- A typed "type it instead" signature. The player signs by hand.
- Finance jargon on screen (DSCR and the rest).
- Mobile layouts: this is a laptop game.
- Under-priced numbers. VSI is the size of Istanbul's airport: about ₹2 lakh crore for the full build, and about ₹60,000 crore for phase 1.

---

# Part II · The Flight: how the whole game behaves

Part I is the Paperwork system for single documents. Part II covers the whole 60-year game, told as one flight in seven chapters plus the Black Box (design/chapters.md). The 3D view, the maps and the ops mechanics don't change. What changes is how the game moves between worlds, shows progress, pauses, passes time and tells you what happened.

## 12. Three surfaces, and the objects that cross between them

| Surface | When | Look |
|---|---|---|
| **Night**: the ops game | every shift | The game's own: night black, sign yellow, Barlow Condensed (unchanged) |
| **Day**: the desk | every decision, front page, bill and card | Part I: drafting paper, Courier, Kalam, red stamps |
| **Recorder**: the Black Box | only after Landing (or after the banks take control) | Flight-recorder orange casing around graph-paper readouts |

Three **bridge objects** belong to more than one surface. They keep the game feeling like one thing:
1. **The flight progress strip** (§14.1): the chapter header in both Night and Day.
2. **The pin** (§14.5): a document from the desk, pinned onto the map in the shift.
3. **The file** (§14.3): the concession itself, closed between sittings and opened again.

## 13. New tokens

| Token | Value | Use, and only this use |
|---|---|---|
| `--rec` | `#ff5a1f` (international orange) | The Black Box casing and its stencil. Never anywhere else, so the orange always means "the record". |
| `--buff` | `#d8c393` | The concession file folder (an Indian office file) |
| `--tape` | `#b8232f` | The red tape that ties the file shut between sittings |
| `--strip` | `#efe6c8`, with a `#c9b98a` holder edge | Flight progress strips |
| `--flap` | `#16191c` background, `#ece7da` digits | The split-flap year counter |
| `--trace` | `#c22a2e` on `--zs` graph paper | Black Box readout traces |

Type is unchanged: Courier Prime, Kalam, Libre Caslon, Tiro Devanagari and Barlow Condensed. The split-flap digits use **JetBrains Mono 500**, the game's existing number face.

## 14. Components

### 14.1 The flight progress strip (the chapter header)
Air traffic controllers track every flight on a paper strip in a holder. Here, each chapter is a strip.

```
┌──────────┬──────────────┬──────────────┬───────────────────────────────┬──────────┐
│ VSI 60Y  │ CLIMB        │ 2033 → 2038  │ Network agreement · SIGNED    │ 64% ₹    │
│ VSIAL    │ wire the     │ year 8–13    │ (the deciding document, with  │ stake    │
│          │ country      │              │  its red stamp, once signed)  │          │
└──────────┴──────────────┴──────────────┴───────────────────────────────┴──────────┘
```
- **Night:** the strip replaces the level title at the top left of the ops HUD, in its holder. **Day:** it sits at the top of the desk.
- **Past strips** stack under the current one in a **strip bay**, collapsed to 6px edges with their phase name; hover to read one. **Future phases are never shown**, which keeps Part I principle 1 (no step lists).
- **Voice:** terse ATC capitals for the callsign and the phase only (real strip vernacular). Everything else is in sentence case.

### 14.2 The split-flap years (between chapters)
The engine runs the years between chapters. The player sees them pass in about **3 seconds**:
- a split-flap counter, like an airport departures board, flips the year (2033 → 2034 → … → 2039), one flap per year at 80 ms;
- behind it, that period's front-page headlines riffle past like a flipbook, one per year at 250 ms, each written by the engine from state;
- it lands on the next chapter's front page.

Clicking skips it. With reduced motion, it shows the final year and the first headline only.

### 14.3 The concession file (the save, made physical)
The save is an Indian office file: a buff folder tied with red tape.
- **On the cover:** the file number (`VSIAL/2026/001`), the company and "<founder>, director", with the player's signature in blue ink, and "Year *n* of 60 · Act *k*".
- **Three plain numbers on a pasted slip:** your stake and what it's worth, the banks' light in rupees, and cash in hand.
- **Opening it:** the tape slides off (0.4 s) and the folder opens onto the desk at the right document.
- **Closing for tonight** (an act break, "Close the file for tonight"): the papers slide back in, the tape ties (0.6 s), and the desk dims.
- **Earlier concessions** sit as thinner files beneath, each with its ending stamped on the cover: HANDED BACK, TAKEN BY THE BANKS or TORN UP.

### 14.4 The cliffhanger (the end of an act)
The act's last front page is the **Late City edition** (stamped in the masthead corner). As the player reads, the page folds in half, leaving the lead headline readable above the fold. In pencil across the fold: "Act II · The Network". The player can turn the page or close the file.

### 14.5 Pins (the paper trail on the map, Night)
- **The pin:** a **12px pushpin** on the exact spot (the stands, the lakes, the transfer area).
- **The slip:** a paper slip of at most **2 lines**, 110px wide, Courier 10px, the document's short name in bold. It is joined to the pin by a **1px dashed pencil leader**.
- **Placement:** candidate slots run along the map's margins, nearest first. A slot is rejected if its box meets a runway, taxiway, terminal or apron polygon, a moving aircraft's next 60 s path, or another slip.
- At most **2 slips open**. A new tag pushes the oldest back to a bare pin. Slips collapse to pins after **6 s** unless hovered. Hover or click opens the full document from the pile.

### 14.6 The connection stream (Night)
Connecting passengers are 2px dots walking the Mall from the feeder gate to the departure gate.
- **Made:** they reach the gate and fade in **sign yellow**.
- **Missed:** they turn **stop red** and drift off the map edge toward a small "DOHA ↗" label (or "DUBAI ↗").
- **Density cap:** 1 dot for 10 passengers, at most 300 dots on screen.
- This is the thesis drawn: the network is the business.

### 14.7 The Black Box (the debrief)
- **The casing:** the four pages slide out of a **flight-recorder casing** in `--rec` orange. Real recorders are painted bright orange so they can be found after a flight. It is stencilled in black: "FLIGHT RECORDER · DO NOT OPEN", and under it, in small Kalam: "*open it*".
- **The pages** are readouts on graph paper (`--zs` grid) with red traces:

  | Page | Readout |
  |---|---|
  | 1 · The return | One handwritten number, plus the drafting ruler with the sourced benchmark marks |
  | 2 · The power law | A ledger: Courier labels, hatched ink bars (long ones bold, short ones pencil), and the sentences in Kalam |
  | 3 · What happened | The player's seven front pages as an overlapping strip across the page, each with its causal line |
  | 4 · How you work | Typed lines, each with its evidence in pencil underneath; then Thiel's seven questions with ✓ in blue ink or ✗ in stamp red |

- **The tone is an accident report's:** "Findings", factual, no blame. The page turns with a paper slide; the casing stays visible at the edge.

## 15. The motion grammar (every motion has a name, a trigger and a fallback)

| Name | Trigger | Duration | Reduced motion |
|---|---|---|---|
| **Plot** | the desk opens for the first time | 2.6 s | the drawing appears whole |
| **Arrive** | a document is shown | 0.55 s | none |
| **Stamp** | a document is finished | 0.3 s, with overshoot | the stamp appears |
| **File** | a stamped document joins the pile | 0.45 s | it appears in the pile |
| **Strip** | a chapter starts: its strip slides into the holder, and the last one drops into the bay | 0.5 s | it appears |
| **Flip** | the years between chapters | ≈ 3 s, skippable | the final year only |
| **Fold** | the cliffhanger | 0.8 s | a static folded page |
| **Tie / untie** | an act break / resuming | 0.6 s / 0.4 s | instant |
| **Pin drop** | a tag appears in a shift | 0.25 s | instant |
| **Stream** | a connection is made or missed | continuous, capped | dots without drift |
| **Pull** | a Black Box page comes out | 0.5 s | instant |
| **Push-in** | the end of Clearance: the camera into the masterplan | 1.5 s | a cross-fade |

Only Plot and Flip happen without the player acting. Everything else answers something they did.

## 16. Sound (follows the game's existing Sound on/off; off means silent)

| Sound | When | How loud |
|---|---|---|
| A stamp thud | Stamp | short and low |
| Split-flap clatter | Flip | one soft clatter per flap, fading |
| A paper slide | Arrive, Pull | very quiet |
| Tape | Tie / untie | very quiet |

There is no music under paper screens. Shifts keep the game's own sound.

## 17. The voices

| Voice | Where | Like |
|---|---|---|
| The newspaper | front pages | "VSI OPENS: A CITY'S FLIGHTS MOVE IN OVERNIGHT." Facts, never judging the player. |
| The document | decisions, agreements | typed and formal, short clauses |
| The adviser | slips, margin notes | handwritten, plain, cause then effect |
| The strip | flight progress strips | terse ATC capitals: callsign and phase only |
| The recorder | the Black Box | "Findings." Factual, evidence first, no blame, no grades |

## 18. The surfaces map

| Moment | Surface | Main component |
|---|---|---|
| Concession tab, with a save | Day | the concession file |
| Clearance and Pushback | Day | the deal desk, the construction register |
| Chapter start | Day, then Night | the strip, the front page, the decision, the briefing |
| Shift | Night | the strip in its holder, pins, the connection stream |
| After the shift | Day | the bill, the card |
| Between chapters | Day | Flip |
| Act break | Day | Fold, then Tie |
| After Landing | Recorder | the Black Box |
| Banks take control | Day, greyed | the step-in notice, the pile sliding off, then the Black Box |

## 19. Tests (added to §9)

- **Pins:** at 1440×900, no slip's box meets a runway, taxiway, terminal or apron polygon in any chapter's shift. At most 2 slips are open.
- **No future steps:** the strip bay never shows a phase after the current one.
- **Orange:** `--rec` appears only inside the Black Box.
- **The file:** reload mid-act, and the file's cover shows the right company, signature, year and act; untying it resumes at the right document.
- **Flip:** skippable with one click; under 3.5 s.
- **Reduced motion:** every row in §15 has its fallback.

## 20. Also rejected, for the flight (add to §11)

- A chapter progress bar or "3 of 7": the strip bay shows only the past.
- Badges, trophies, confetti or score animations. The stamp is the only celebration.
- Grades or personality labels in the Black Box: only lines backed by evidence.
- Orange anywhere except the recorder.

## 21. Decisions made while building Stage 0 (lane U), where Part II was silent or could not be followed exactly

- **Pin slips are 110–232px wide**, sized to their text. §14.5 says 110px, but at Courier 10px that holds 16 characters, less than the shortest document name in chapters.md §4 ("Capital budget, 2034" is 20). Everything else in §14.5 holds: a 12px pushpin, two lines (the short name in bold, then the line), a 1px dashed leader, at most 2 open, folding after 6 s.
- **The leader is light pencil** (`#e2e4e0`, dashed, with a dark hairline shadow): graphite would vanish on the night map.
- **Hover holds a slip open and shows its full text as a tooltip; a click opens the document.** Opening a document on hover would stop a shift every time the mouse crosses a pin.
- **Aircraft paths:** `tagAvoid` now takes polylines (`{line:[...]}`), so hub.js can pass each moving aircraft's next 60 s.
- **The strip sits at the top right of the desk** (the airport's name holds the top left), and the desk's content moves down by the depth of the bay. Bay edges are 6px with a 4px gap, so the phase names (9.5px) can be read; hovering an edge shows the whole strip just below it.
- **The strip's second line** ("wire the country") is a fixed list in ui.js: words, not numbers. Calendar years are 2025 + game year, as in era.js; year 0 reads "signing".
- **Flip pacing:** one year every 80–320 ms (about 2.5 s in all, whatever the span), headlines at most every 250 ms. With fewer headlines than years, each one holds for its share of the years.
- **The fold is the player's act:** a click on the paper, or either choice, folds it (§15 allows only Plot and Flip to run unprompted). With reduced motion it arrives folded.
- **Closing the file** ends on the dimmed desk with one line ("Meridian Infra's file is closed for tonight. It waits in the Concession tab, at year 7.") and "Back to the menu".
- **The file's cover:** the number is `VSIAL/<signing year>/<concessions on record + 1>`; the act comes from the chapter (1–3 → I, 4–5 → II, 6–8 → III); "Opened <date>" and the EXECUTED stamp sit right of the tape.
- **The minutes have one tick box per resolution:** ticked is adopted, blank is rejected, and the button says the count ("2 adopted, 1 rejected"), so a blank box is never an accident. Those present are one typed sentence, to keep all three resolutions near the fold on a 1280×800 screen.
- **The letter:** the lenders' agent is a new fictional signatory, Prakash Venugopal. The reply is a slip below a tear line on the same page, and the stamps are chapters.md's CURED / AGREED / REFUSED.
- **The notice that the banks take control** carries no stamp (the grey desk is its moment) and only the lenders' agent signs: the officials of 2026 would not still be in office twenty years later. Its Hindi line is "नियंत्रण की सूचना" (notice of control).
- **The Black Box:** the casing sits to the left, with its pages pulled out to the right. The buttons say "Pull the next page" and "Back". Page 2 is titled "What made the return". Its power-law line appears only when the two largest bars hold at least half of the total. Page 3 enlarges a paper in place rather than leaving the Black Box.
