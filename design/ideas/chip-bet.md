# The chip bet (idea #3, design/fun.md)

```
TITLE:          A chip plant asks VSI to invest
CHAPTER, WHEN:  Climb · the fundraising board, 2035 (game year 10)
CAUSE:          offered only while you raise money (the board after Climb, or the private-capital page, if a
                deal is open). Its size and payoff depend on your cash, whether VSI has a cargo terminal
                (Sanchori's cargo clause, or one ordered at a board), and your lender.
ON SCREEN:      a prospectus on the desk: "MIHAN Semiconductor Park: chip assembly and test, 2 km from your
                cargo apron. Co-investors wanted." A small map draws the line from the plant to VSI's cargo
                apron, then a dotted line to Singapore, Frankfurt and Dallas.
CHOICES (≤3):   1. Co-invest big: ₹1,500 cr (today's money) for 10% of the plant (est.)
                2. Co-invest small: ₹500 cr for 3% (est.)
                3. Pass
                Each slip shows: the money out now, "your stake on the 25-year sale: about ₹X cr", and
                "chip cargo from 2050: about ₹Y cr a year", all in plain words.
EFFECT NOW:     the money leaves VSIAL's cash (a call on the shareholders if cash is short), and the bill
                says so. Nothing else for a while: this is a patient bet.
ECHO:           - 2039 (Cruise): the plant opens. Front-page column: "MIHAN chip plant ships its first wafer lots".
                - 2050 (15 years on, Turbulence/Landing): high-value chip cargo starts at VSI: a new stream,
                  growing with the plant. With a cargo terminal it flies from VSI; without one, half of it
                  trucks to Mumbai (shown on the front page: "Nagpur's chips fly from Mumbai").
                - 2060 (25 years on, Landing): the stake is sold. The sale value arrives as cash, stamped SOLD
                  on the prospectus in the pile.
                - The Black Box: a new attribution group, "the chip bet". A Thiel answer under Secret ("You
                  backed chips in Nagpur when few did"). A profile line under Patient, if it paid.
OUTCOMES:       seeded from the save, so a reload never changes it (est.):
                - 60%: the plant grows. Sale at about 6× the money in; chip cargo as planned.
                - 25%: it struggles, then steadies. Sale at about 1.5×; half the cargo.
                - 15%: it fails in year 8. Sale at 0.3×; no chip cargo. The front page says so, and the
                  Black Box names it plainly ("The chip bet cost you X%").
                Expected value is clearly positive, but the bad outcome must be possible, or it isn't a bet.
ENGINE:         (era.js) a new keyed `s.bets.chips = {year, cr, pct, outcome, exitYear: year + 25, multiple}`,
                paid as an equity call in its year and returned as an equity inflow at exit (NOT through
                extra_pay, because it is not an airport asset and not in AERA's base). Cargo as
                `s.streams.chips` from year + 15, priced per tonne of high-value cargo (est.), x0.5 without a
                cargo terminal. Add an era_test check: the passive player never has it; the money in, the
                exit and the cargo all show in the player's flows; the attribution sums still close.
TRUTH:          India's semiconductor push is real: the India Semiconductor Mission approved Micron's
                assembly-and-test plant at Sanand (2023) and Tata's fab at Dholera (2024). MIHAN is Nagpur's
                real SEZ, beside the airport. Sources to add to research/ before the card goes live. The
                plant, its stake prices, outcomes and cargo values are game estimates (est.).
SCORE:          Wow 3 / Agency 3 / Link 2 / Cost M → 4.0
```

## Built (branch `chips`, 20 Oct 2026)

All numbers below are game estimates (est.), in `money/era.js` (`CHIPS`, `VSIEra.chips`).
- Offered once, after Climb's bill, as the 2035 fundraising board's prospectus (hub.js `flChipBet`). Big: ₹1,500 cr (today's money) for 10%; small: ₹500 cr for 3%; pass.
- The plant opens in 2039; chip cargo from 2050; the stake is sold in 2060 (a failed plant is sold for what is left in 2043, year 8).
- Outcomes, seeded from the save (its seed, company, director and signing day): 60% grows (6× in today's money, the cargo as planned), 25% struggles (1.5×, half the cargo), 15% fails (0.3×, no cargo).
- Chip cargo (est.): 1,20,000 tonnes a year by air at full stride (about what Penang's chip cluster flies), at about ₹20,000 a tonne to VSI (secure handling, freighter landings, forwarders' rents), 30% of it in costs, growing 3% a year. Big routes all of it through VSI, small 40%; ×0.5 without a cargo terminal (Sanchori's cargo clause: lender `sanchore+`; or `s.cargoTerminal`, for a board item still to be built). So big: ₹240 cr a year with a terminal, ₹120 cr without; small ₹96 / ₹48 cr.
- Finding: at the Black Box's yardstick (12.2% a year, Fairfax's low mark) a 6× sale 25 years out is about break-even, so the bet's expected value there is slightly negative (big, no terminal: grows +₹76 cr, struggles −₹341 cr, fails −₹406 cr to the player; expected −₹100 cr), though it is 4.0× the money in plain multiples. To make it clearly positive at 12.2%, the good case needs a sale nearer 10× or an earlier sale.

