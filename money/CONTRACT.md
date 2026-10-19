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
- **`ZMMoney.onboarding(opts)`** runs four steps: company name → SPV ownership bar → bid → financial close. It resolves `{parent, bid:{type:'share'|'ppf', value}, gearing, repayment:'sculpted'|'equal'}`, or `null` if the player chooses "Not now". `opts` takes:
  - `capexCr`
  - `partners:[{name, pct, color, role}]`
  - `rivals`
  - `bidTypes:{share|ppf:{min, max, step, def, benchmarks:[{name, val}]}}`
  - `gearing:{min, max, def}`
  - `previewBid(bid) → {winPct, note}`
  - `previewClose({gearing, repayment, bid}) → {equityCr, debtCr, parentCr, minDscr, note}`. This is where money/era.js plugs in.
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

## Rules it follows (from prompt-money.md)
- **Safety calls never show a price.** The wiring must not call `float` for medical, fuel or MAYDAY events.
- **Additive only.** The module only appends DOM: one style tag, `#zmmFloat`, `#zmmOv`, and a hidden P&L tab button and body. It doesn't change any existing element. The P&L tab listens on the tab bar in the capture phase and leaves the existing handler alone.
