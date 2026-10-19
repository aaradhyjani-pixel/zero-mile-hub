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
| Countersignatures | `scribble(seed, ink)` | Seeded and different per party. Never imitate a real person's signature. |
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
