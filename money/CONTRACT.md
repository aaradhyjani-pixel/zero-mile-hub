# money/ui.js: contract

This is a self-contained UI module for the money layer. It is built separately so the wiring session only has to call it.

- It **never reads game state**. The economy pushes numbers in, and the dialogs hand decisions back as Promises. With money switched off, nothing appears: no chip, no P&L tab.
- `build.py` appends `money/*.js` after the game script, so `hub.js` doesn't change at all.
- All amounts are in **₹ crore** (floats). `ZMMoney.fmt(v)` prints crore at ₹1 cr and above, and lakh below that.
- Try it with `site/index.html?moneymock` (the live chip, floaters and P&L tab during Level 1). Each dialog has its own URL: `?moneymock=onboarding`, `?moneymock=board` and `?moneymock=income`.

## Names (one place, so a rename is one call)
`ZMMoney.config({airportName, spvName, spvShort, years, coinvestor:{name,blurb}, rivals:[{name,blurb}x3]})`

The defaults are:
- Vikram Sarabhai International Airport (code VSI). SPV: Vikram Sarabhai International Airport Limited (VSIAL), with a 60-year concession.
- Co-investor: L5 Capital: Lagrange Point Infrastructure Fund.
- Rivals: Kármán Line Ventures, QNH Infragenesis and Thakral–Wainganga Airports.

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

  Each completed document is stamped in red and joins the stack on the left. It resolves `{parent, founder, bid:{type:'share'|'ppf', value}, gearing, repayment:'sculpted'|'equal', signature, signedOn, endsOn, quick?}`, or `null` for "Not now":
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
  - `previewClose({gearing, repayment, bid}) → {equityCr, debtCr, parentCr, minDscr, note}`. `minDscr` is shown in rupees: "₹120 for every ₹100 due". Write the `note` in plain words, never in ratios.
- **`ZMMoney.boardMeeting(opts)`** resolves `{bought:[ids], appeal, dividendCr, prepayCr}`. `opts` takes:
  - `{era, years, parent, cashCr, debtCr}`
  - `dscr:{value, warn, covenant}`
  - `aera:{title, text, canAppeal, appealText}`
  - `investments:[{id, name, costCr, effect, why, payback, owned, disabled, reason}]`
  - `dividend:{maxCr}` and `prepay:{maxCr}`

  It blocks overspending.
- **`ZMMoney.incomeStatement(opts)`** works for a shift, an era or the 60-year handback. It resolves `'cta'` or `'cta2'`. `opts` takes:
  - `{band, title}`
  - `hero` (HTML string)
  - `sections:[{title, rows:[{label, amount (number or string), kind:'rev'|'cost'|'total'|'good'|'bad'}]}]`
  - `compare:[{name, value, me}]`, `compareLabel`
  - `moments:[text]`
  - `cta`, `cta2`

## Glossary
`ZMMoney.terms` holds new glossary entries in hub.js's `GL` format. Merge them into `GL` so `.term[data-k]` links work:
- aero, nonaero, mtow, udf, aera, rab, till, trueup, dscr, stepin, sla, ebitda, irr, spv, concession

## Plain words (the user's rule)
Players never see finance jargon. Loan cover is shown in rupees ("₹116 earned for every ₹100 due"), not as a DSCR ratio. True-ups, the RAB, WACC and sculpting appear only as a consequence, in one sentence. Any `text`, `note` or `why` you pass in must follow this too. The mock data in `ui.js` shows the tone.

## Rules it follows (from prompt-money.md)
- **Safety calls never show a price.** The wiring must not call `float` for medical, fuel or MAYDAY events.
- **Additive only.** The module only appends DOM: one style tag, `#zmmFloat`, `#zmmOv`, and a hidden P&L tab button and body. It doesn't change any existing element. The P&L tab listens on the tab bar in the capture phase and leaves the existing handler alone.
