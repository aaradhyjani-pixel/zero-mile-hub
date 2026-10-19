# money/ui.js: contract

This is a self-contained UI module for the money layer. It is built separately so the wiring session only has to call it.

- It **never reads game state**. The economy pushes numbers in, and the dialogs hand decisions back as Promises. With money switched off, nothing appears: no chip, no P&L tab.
- `build.py` appends `money/*.js` after the game script, so `hub.js` doesn't change at all.
- All amounts are in **₹ crore** (floats). `ZMMoney.fmt(v)` prints crore at ₹1 cr and above, and lakh below that.
- Try it with `site/index.html?moneymock` (the live chip, floaters and P&L tab during Level 1). Each dialog has its own URL: `?moneymock=onboarding`, `?moneymock=board` and `?moneymock=income`.
- Shared paper helpers now live at module scope in `ui.js` (not inside `onboarding`): `H`, `stampHtml(word, cls, date?)`, `ruler(...)`, `guilTile()`, `INK_DEFS`, plus `vsiLogo`, `sealSvg`, `scribble`, `sigPad`, `rosette`.

## Names (one place, so a rename is one call)
`ZMMoney.config({airportName, spvName, spvShort, years, coinvestor:{name,blurb}, rivals:[{name,blurb}x3]})`

The defaults are:
- Vikram Sarabhai International Airport (code VSI). SPV: Vikram Sarabhai International Airport Limited (VSIAL), with a 60-year concession.
- Co-investor: L5 Capital: Lagrange Point Infrastructure Fund.
- Rivals: Kármán Line Ventures, QNH Infragenesis and Thakral–Wainganga Airports.

## Signatories (fictional people, each with their own hand)
`M.cfg.signatories` names everyone who signs for another party. Override any of them with `ZMMoney.config({signatories:{aai:{name, sign, title, hand:{...}}}})`; the merge is per key, so you can change one person and keep the rest.

| Key | Person | Title | Signs | Hand (script face, slant, flourish) |
|---|---|---|---|---|
| `aai` | Meenakshi Raghavan | Regional Executive Director, Western Region, AAI | the concession | Mrs Saint Delafield, black ink, sweeping underline |
| `state` | Shirish V. Bhonsle | Vice-Chairman and Managing Director, MADC | the concession | Homemade Apple, blue ballpoint, upright, double dash |
| `coinvestor` | Naomi Fernandes | Managing Partner, L5 Capital | the concession | Monsieur La Doulaise, navy fountain pen, loop back under the name |
| `dgca` | Rajeshwari Natarajan | Joint Director General (Aerodromes), DGCA | the aerodrome licence | La Belle Aurore, black, tilted, zigzag paraph |
| `aai60` | Kabir Sethna | Regional Executive Director, Western Region, AAI | the handback | Herr Von Muellerhoff, black, fast and steep |
| `state60` | Tanvi Patwardhan | Managing Director, MADC | the handback | Allura, blue, round, a full stop |

`signSvg(person)` (also `ZMMoney.signSvg`) draws the person's signing name (`sign`, for example "M. Raghavan") in their own script face. It applies their slant, tilt and weight, adds a flourish seeded from their name, and fixes the width with `textLength`, so the same person always signs the same way. The six faces load from Google Fonts in a second link (`#zdkSigFonts`, `display=block`, so a signature never shows in a fallback face); the screenshot harness serves them from `@fontsource` and checks that they have loaded. **Year 60:** nobody holds the same office for sixty years, so the handback is received by successor officials (`aai60`, `state60`), each in their own hand. The player's own day-one signature still appears beside their new one.

## HUD
| Call | What it does |
|---|---|
| `ZMMoney.enable(true/false)` | Shows or hides the top-strip chip and the P&L tab. Call it with `true` only in Concession mode (or when money is on). |
| `ZMMoney.setDay({total, ratePerHr, history?})` | Updates the "Today" chip. It shows a ±tick on each change and a sparkline (it keeps its own history if none is passed). |
| `ZMMoney.float(sx, sy, amountCr, {label, bigAt, max})` | Shows a floater at screen coordinates relative to `#app`, for example `(f.sx, f.sy)` from hub.js. Floaters of the same sign within 44 × 28 px in 0.9 s merge into one, and no more than `max` (default 6) show at once. |
| `ZMMoney.setPL(lines, {title, note})` | Fills the P&L tab. `lines = [{label, kind:'rev'|'cost', amount, sub?, why?, term?}]`. Costs are positive numbers and display as negative. `term` links to a glossary key. |

## Dialogs (each returns a Promise)
- **`ZMMoney.onboarding(opts)`** is the deal desk: a full-screen takeover for laptops. Four documents cross an engineering drawing of VSI, one at a time, and the next one appears only when the current one is done:
  1. Incorporation: the company name and the player's own name, as the director who signs.
  2. The financial bid.
  3. The banks' loan offer.
  4. The Concession Agreement on duty paper, where all five parties are named. AAI, the State (MADC) and L5 Capital have already signed; the player signs last with the trackpad.

  Each completed document is stamped in red and joins the stack on the left. It resolves `{lender, phase1, stateLoan, parent, founder, bid:{type:'share'|'ppf', value}, gearing, repayment:'sculpted'|'equal', signature, signedOn, endsOn, quick?}`, or `null` for "Not now":
  - `signature` is a PNG data URL. Show it again at the handback.
  - `signedOn` and `endsOn` are YYYY-MM-DD. The agreement is dated the day the player signs, and the concession ends the day before its 60th anniversary.
  - `quick` is true when the player took "Skip to signing, on standard terms". They still sign.

  `opts` takes:
  - `defaultName` and `founderName`
  - `capexCr`
  - `partners:[{name, pct, role}]`. `partners[0]` is the player's company, and its `pct` drives every "you own" line.
  - `rivals`
  - `bidTypes:{share|ppf:{min, max, step, def, benchmarks:[{name, val}]}}`
  - `gearing:{min, max, def}`
  - `previewBid(bid) → {winPct, note}`
  - Optional close choices, each shown only if passed:
    - `phase1:{def, options:[{id, label, small, capexCr}]}`: the size of phase 1. The chosen `capexCr` replaces `opts.capexCr`.
    - `stateLoan:{pct | amountCr, def, text}`: the State's interest-free loan, accept or decline.
    - `lenders:{def, options:[{id, who, label, small}]}`: who lends, for example Indian banks, dollar bonds or the infrastructure bank. `who` is the name used in the agreement.
  - `previewClose({gearing, repayment, bid, phase1, stateLoan, lender}) → {equityCr, debtCr, parentCr, minDscr, stateLoanCr?, note}`. If `debtCr` is below what the player asked for, the loan document says the banks will lend only what the forecast can repay. `minDscr` is shown in rupees: "₹120 for every ₹100 due". Write the `note` in plain words, never in ratios.
- **`ZMMoney.boardMeeting(opts)`** is the board minutes: a full-screen desk like the deal desk. The page is the minutes of a VSIAL board meeting on white bond (numbered minutes, the four owners present). AERA's order is clipped on top on duty paper with an accept / appeal tick. The investments are a capital budget with tick boxes; the dividend and early repayment are set on drafting rulers. The slip shows three numbers: today's money, the banks' mood in words, your stake. "Approve the minutes" initials each minute, brings down a red APPROVED stamp and files the minutes on the stack. It blocks overspending. Try it standalone at `money/test_board.html?moneymock=board` (serve the repo root).

  | Field | Shape | Notes |
  |---|---|---|
  | `era, years` | number, `'2041–46'` | minute numbers are `era.n` |
  | `parent, parentPct` | string, number | the player's company, first among those present (default 64%) |
  | `cashCr, debtCr` | ₹ cr | today's money; "after these decisions" updates live |
  | `dscr` | `{value, warn:1.2, covenant:1.1}` | shown only as words and "₹116 for every ₹100 due" |
  | `aera` | `{title, text, canAppeal, appealText}` | the clipped order; without `canAppeal` it is noted, not decided |
  | `investments[]` | `{id, name, costCr, effect, why, payback, owned, disabled, reason}` | one budget line each; `owned` is struck through, `disabled` shows `reason` in amber pencil |
  | `dividend, prepay` | `{maxCr}` | one ruler each |
  | new, optional: `founder` | string | the chair; their initials go on each minute (else the company's) |
  | new, optional: `year`, `stakeValueCr` | number, ₹ cr | "year 16 of the concession"; "worth about ₹X" on the slip |
  | new, optional: `partners[]` | `[{name, pct}]` | replaces the default four owners (you, L5 Capital 16, AAI 10, State through MADC 10) |
  | new, optional: `aera.acceptText, aera.orderNo` | string | the consequence sentence under "accept"; the order's serial |
  | new, optional: `investments[].opens` | number or string | "Opens" column: `19` prints "year 19" |
  | new, optional: `investments[].land` | `{earnCr, aeraCr}` | adds "Your land earns ₹X cr a year; AERA counts ₹Y cr of it against your airline charges." (Airport City) |
  | new, optional: `dividend.lastCr, .blocked, .reason` | | a pencilled "last era" mark; the dividend ruler locks when blocked or when loan cover is under `covenant` |
  | new, optional: `prepay.savesPct` | % a year | "Saves about ₹X cr of interest a year" |
  | new, optional: `pile[]` | `[{title, stamp}]` | documents already on file (default: the agreement and earlier minutes) |

  It resolves `{bought:[ids], appeal, dividendCr, prepayCr, approvedOn}`. `approvedOn` (YYYY-MM-DD) is new; the rest is unchanged. There is no cancel: the board always decides.
- **`ZMMoney.incomeStatement(opts)`** is now a wrapper around `ZMMoney.bill`, so the old dark yellow-banded sheet can never appear again. It takes the old shape (`band`, `title`, `hero` (HTML; its text becomes the lead), `sections:[{title, rows:[{label, amount (number or string), kind, period?}]}]`, `compare`, `compareLabel`, `moments`, `cta`, `cta2`) plus any `bill` field (`paragraph`, `cover`, `stake`, `margin`, `year`), and resolves `'cta'` or `'cta2'`. Use `bill` directly in new code.
- **`ZMMoney.handback(opts)`** is the year-60 handover certificate on duty paper (DESIGN.md §10). The player's day-one signature sits beside an empty pad, and they sign again. A "60 years" stamp and the VSIAL seal come down. Try it with `?moneymock=handback`, or open `money/test_handback.html` (a standalone harness, served from the repo root).

  | opts field | Meaning |
  |---|---|
  | `founder`, `parent` | The director's name and their company, as in onboarding. |
  | `signature` | The PNG data URL from onboarding. It is trimmed to its ink and shown as "Day one". |
  | `signedOn`, `endsOn` | YYYY-MM-DD from onboarding. The certificate is dated `endsOn`. |
  | `stakePct`, `stakeValueCr` | The player's stake at handback and what it is worth (₹ cr). The slip shows it only if `stakeValueCr` is set. |
  | `returnPct` | Your return per year, in %. |
  | `paxTotalM` | Passengers served over 60 years, in millions. 1,000 or more prints as billions. |
  | `paidToStateCr` | Total paid to the State and AAI (₹ cr). |
  | `condition` | `'excellent'`, `'good'` or `'poor'`. AAI's inspector ticks it, in black ink. |
  | `assets` | Short plain phrases ("four runways", "Zero Mile Tower"), joined into one sentence. |
  | `owners` | `[{name, pct}]` at handback, with the player's company first. |
  | `lines` | Plain sentences listed under "The record also shows that". |

  All fields are optional. It resolves `{signature (PNG data URL), signedOn (the real day the player signed, YYYY-MM-DD), handedBackOn (= endsOn)}`, or `null` from "Close".

## Glossary
`ZMMoney.terms` holds new glossary entries in hub.js's `GL` format. Merge them into `GL` so `.term[data-k]` links work:
- aero, nonaero, mtow, udf, aera, rab, till, trueup, dscr, stepin, sla, ebitda, irr, spv, concession

## Plain words (the user's rule)
Players never see finance jargon. Loan cover is shown in rupees ("₹116 earned for every ₹100 due"), not as a DSCR ratio. True-ups, the RAB, WACC and sculpting appear only as a consequence, in one sentence. Any `text`, `note` or `why` you pass in must follow this too. The mock data in `ui.js` shows the tone.

## Rules it follows (from prompt-money.md)
- **Safety calls never show a price.** The wiring must not call `float` for medical, fuel or MAYDAY events.
- **Additive only.** The module only appends DOM: one style tag, `#zmmFloat`, `#zmmOv`, and a hidden P&L tab button and body. It doesn't change any existing element. The P&L tab listens on the tab bar in the capture phase and leaves the existing handler alone.

## Construction (E0, years 1–4): `ZMMoney.construction(opts)`
This is the site progress register, on drafting paper: a schedule of the works for years 1 to 6, with a red playhead at the end of the current year and a dashed **Opening day** line. Under the schedule, the money drawn each year is written on a ledger strip, followed by the year's register entry. A letter from the site, clipped on, asks for the year's decision with tick boxes; the player cannot turn the page until they tick one. "Turn to year N" moves the playhead, then the page turns. After year 4 the register is stamped WORKS COMPLETE and filed. The **DGCA aerodrome licence** then arrives on duty paper, signed by `dgca`. "Open the airport" brings down LICENSED and then a large OPENING DAY stamp, and the promise resolves. The slip shows the three numbers. Try it with `?moneymock=construction` or `money/test_construction.html`.

| opts field | Shape | Notes |
|---|---|---|
| `founder, parent` | string | optional; printed on the licence |
| `signedOn, opensOn` | YYYY-MM-DD | the planned opening, before any slip |
| `capexCr, debtCr, equityCr, stateLoanCr?, lenderName` | ₹ cr, string | the opening sentence of the register |
| `works[]` | `{id, name, start, end, note?}` | years after signing (floats); `note` is a tooltip |
| `years[]` | `{year, drawnCr, cumDrawnCr, line}` | one register page per year; `line` is a plain sentence |
| `events[]` | `{id, year, title, text, from?, options:[{id, label, effect, slipMonths?, numbers?}]}` | at most one per year. `effect` is one sentence with ₹ and months. New, optional: `slipMonths` moves Opening day and extends the unfinished works in amber; `numbers` (partial) replaces slip numbers once ticked |
| `numbers` | `{todayCr, light:'green'\|'amber'\|'red', coverWords, stakePct, stakeValueCr}` | `light` shows as Relaxed, Watching closely or Warning you |
| `atYear?, choices?` | number, `{eventId: optionId}` | resume a construction left with "Not now" |

It resolves `{choices:{[eventId]: optionId}, finishedOn, slipMonths}`. `finishedOn` is Opening day (YYYY-MM-DD) after any slip, and `slipMonths` is the total slip. It resolves `null` for "Not now".


## Chapter 5, "Take on the Gulf" (prompt-campaign.md §7)
Every figure comes in from `VSIEra.ch5`; ui.js invents no numbers. Mocks: `?moneymock=bill|frontpage|decision|briefing|tags|card` (briefing and tags over the live game in site/index.html; the rest also in `money/test_ch5_ui.html`).
- `ZMMoney.frontPage(VSIEra.ch5.frontPage(state))` → Promise. Newsprint dropped on the desk; "Turn it over" resolves. Optional `company`, `founder`, `signature` (PNG data URL) print a "from our files" signature line; `edition`, `price` fill the ears.
- `ZMMoney.decision(VSIEra.ch5.decision(state))` → Promise<{choice, signedOn}>. The deal-desk document: tick a line, the adviser's slip shows `slip.big/money/line`, sign, the stamp lands (`stamps[id]`) with a short thud. Optional `founder`, `parent`, `signature`, `date`, `docId`, `docType`.
- `ZMMoney.briefing(VSIEra.ch5.briefing(state))` → Promise. A torn notepad sheet pinned top-left over the live game, not a modal. `lines:[{text, doc}]` (doc = a document title in the pile, or `docId`), `watch`, `autoStartSec` (the countdown pauses while a document is open). Resolves after the countdown or on a click.
- `ZMMoney.setPile(docs)`: the documents the player has signed, `[{id, title, year, kind, summary, stamp?}]`. Tags, briefing lines and `openDoc` look documents up here by id or title.
- `ZMMoney.openDoc(docOrTitleOrId)` → Promise. A read-only page from the pile. Fires window `zmm-doc` `{detail:{open, doc}}` so the game can pause.
- `ZMMoney.tag(x, y, docTitle, line)` → `{el, move(x, y), remove()}`. A small pinned paper tag at a point relative to #app; call `move` every frame to follow an aircraft. Click opens the document. (The older `tag(id, {doc, line, docId})` + `tagAt(id, x, y)` + `tagRemove(id)` form also works.)
- `ZMMoney.connFloat(x, y, {made, cr})` → "+46 connections · ₹0.4 cr" in green; `{missed, rival}` → "−18 missed · Doha wins them" in red. Nearby floaters of the same kind merge.
- `ZMMoney.setConnections({made, missed})`: the one line under the money chip (replaces the rate line from then on).
- `ZMMoney.bill(bill)` → Promise. One annual-report page: paragraph, the Earned/Spent/Connections table, "Can the airport pay the banks?" with `cover.words` on a pencil scale (`cover.light` optional; else red under 1.1, amber under 1.3), the stake line and one handwritten margin note.
- `ZMMoney.whatHappened(card)` → Promise. A small index card: 2–3 sentences, numbered sources in small type.

- `ZMMoney.bill` rows (new, optional): `{head}` is a section heading; `{label, text}` prints a string; `kind:'cost'|'total'|'good'|'bad'` (costs print negative); `period` labels the row's period in small type ("this afternoon", "a year", "2040–43"), so every money figure on the page is either in the same period or labelled. `head` replaces the "VSIAL · Annual report" header line, `list:{title, items}` adds a short list under the table, `cta2` adds a second button. It now resolves `'cta'` or `'cta2'`.
- `ZMMoney.setConnections({made, missed})` should be called every time a passenger makes or misses a connection, not only when a departure settles; the chip line reprints at once. `setConnections(null)` ends it: the rate line comes back on the next `setDay`. (The CONNECTIONS box in the top strip, `#kCnx`, belongs to hub.js.)

## Dates
`ZMMoney.fmtDate(iso)` turns `'2039-04-01'` (or a Date) into "1 April 2039". Anything else passes through unchanged. Every screen in ui.js writes dates this way, and an ISO day inside any text passed in (paragraphs, briefing dates, tag lines, margin notes) is rewritten the same way. Stamps keep "01 APR 2039".

## Paper tags never cover a runway or the terminal (F7)
- `ZMMoney.tagAvoid(rects, {region}?)`: hub.js calls it **every frame**, with the screen rectangles (relative to `#app`) of every runway and the terminal, plus any HUD panel rectangles it knows. A rect may be `{l,t,r,b}`, `{left,top,right,bottom}`, `{x,y,w,h}`, `{x0,y0,x1,y1}` or `[x,y,w,h]`, with an optional `kind` (`'runway'`, `'terminal'`, `'panel'`; `kind:'region'` or `opt.region` is the free map area the cards must stay inside). Pass `[]` to clear.
- A tag starts **folded**: the red pin on its aircraft, a thread, and the card's first line (the document's title). Hovering or clicking the line opens the whole card in the same place; clicking the open card opens the document; clicking the pin folds it. `tagFlash` pulses the pin and no longer opens the card.
- ui.js places every card, folded or open, sized as if open, so that it never overlaps a `tagAvoid` rectangle, the HUD panels it can see in the page (`#top`, `#rail`, `#wave`, `#zoomBox`, `#toast`, `#pop`, the chips, `#z5Brief`, `#zmmChip`), another card, or another tag's pin. It tries, in order: where the card already is (if that place is still clear and near), the `cx, cy` hub.js passes to `move`, then beside the airfield (the union of the rectangles) on the side nearest the pin, then rings around the pin. A card stays put while its place stays clear, so it does not jump. If nowhere is clear, only the pin shows, and clicking it opens the document.
- `ZMMoney.tagBox(id)` returns the card's current box (or null), for tests. `?moneymock=tags` in the live game feeds `tagAvoid` from the map (`window.__zmmAvoid` holds the rects it used).

## The concession file (the Concession tab's saved game)
- **`ZMMoney.concessionFile(container, opts)`** renders the saved concession into the Concession tab's container (no modal) and returns its root element. `opts = {company, founder, signature (PNG data URL), signedOn ('YYYY-MM-DD'), year, era, stake:{pct, valueCr}, cover:{words, light}, cashCr, docs:[{id, title, date, stamp?, kind?, summary}], record:[...], onContinue(), onNew(arg), onOpenDoc(doc)}`.
  - It shows the company name and "<founder>, director" with the player's own signature image, "Signed 1 April 2039 · now year 17 of 60 · era 3", three numbers (your stake and what it is worth; the banks' light as `cover.words` with "The banks are relaxed / watching closely / warning you" from `cover.light`; cash in hand), the last six documents signed as small cards (a click calls `onOpenDoc(doc)`, or `ZMMoney.openDoc(doc)` if none is given), and two buttons: "Continue as <Company>" (`onContinue()`) and "Start a new concession".
  - "Start a new concession" asks once with `confirmTear(company)` and calls `onNew({confirmed:true})` only after "Tear it up and start again". hub.js then moves the torn concession to `zm_record`, clears `zm_campaign`, and opens the deal desk. (If hub.js calls `confirmTear` again inside `onNew`, it resolves `true` at once without asking a second time.)
  - `opts` null, or without `company`: only the "Start the concession" button, which calls `opts.onNew({confirmed:false})` (always open the deal desk). Pass `{onNew, record}` to list the earlier concessions under it.
  - `record` (oldest first; the file shows the last four, newest on top): `[{company, founder, signature, years, ended:'handback'|'banks'|'torn', returnPct, endedOn}]`, one line each under **Earlier concessions**, with the signature: "Meridian Infra · Asha Rao · 17 years · torn up in 2026 · returned 9.6% a year".
- **`ZMMoney.confirmTear(company)`** → `Promise<boolean>`. A paper memo over the menu: "This tears up <Company>'s concession. Start again?" with [Tear it up and start again] and [Keep it] (focused; Escape and a click outside keep it). On "Tear it up" the memo tears in two and falls apart, then it resolves `true`.
- Mocks: `money/test_file.html?moneymock=file` (a saved company, three documents, two earlier concessions), `?moneymock=file0` (no save) and `?moneymock=tear` (the memo; "Tear it up" moves the company to the record and opens the deal desk). The same mocks run in the game page and render into `#tConc` when the Concession tab is open.
