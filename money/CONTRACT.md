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
- **`ZMMoney.incomeStatement(opts)`** works for a shift, an era or the 60-year handback. It resolves `'cta'` or `'cta2'`. `opts` takes:
  - `{band, title}`
  - `hero` (HTML string)
  - `sections:[{title, rows:[{label, amount (number or string), kind:'rev'|'cost'|'total'|'good'|'bad'}]}]`
  - `compare:[{name, value, me}]`, `compareLabel`
  - `moments:[text]`
  - `cta`, `cta2`

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
