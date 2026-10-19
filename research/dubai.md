# Dubai: how a desert airport became a transfer hub (Chapter 5, "Take on the Gulf")

Research for the Chapter 5 front page and the "What really happened" card. Every figure the game uses is listed here with its source. Figures that could not be checked against at least one solid source are listed at the end and are **not used**.

## Facts used in the game

| Fact | Figure | Source |
|---|---|---|
| Emirates' first flight | EK600, Dubai to Karachi, 25 October 1985 | Gulf News, "40 years of UAE: the launch of Emirates Airline": https://gulfnews.com/news/uae/government/40-years-of-uae-the-launch-of-emirates-airline-1.920215 |
| Emirates' start-up money from Dubai's government | US$10 million (Dh36.7 million), the only state money it was given | Gulf News (above); Gulf Business, "Timeline: Dubai's Emirates completes 30 years": https://gulfbusiness.com/en/2015/10/timeline-dubais-emirates-completes-30-years |
| Aircraft at launch | two leased aircraft (a Boeing 727 and an Airbus A300B4; the A300 wet-leased from Pakistan International Airlines) | Gulf News (above); AirlineGeeks, "Looking back at the history of Emirates": https://airlinegeeks.com/2017/05/10/looking-back-at-the-history-of-emirates/ |
| Dubai International, 2024 | 92.3 million passengers, a record; ahead of London Heathrow "for a decade" as the world's busiest airport for international travel | AP, via Yahoo News, "Dubai International Airport, busiest for world travel, sees record 92.3 million passengers in 2024": https://www.yahoo.com/news/dubai-international-airport-busiest-world-081648847.html |
| India is Dubai International's biggest market | about 12 million passengers in 2024 (AP later quoted 11.9 million), ahead of Saudi Arabia (7.6 million) and the UK (6.2 million) | AP (above); Dubai Airports' 2024 release as reported |

### How it is used
- **Front page** (`VSIEra.ch5.frontPage`): one sourced line in a column: "Dubai's airport alone handled about 12 million passengers to and from India in 2024, more than any other country." The rest of the page is written from the player's state (the game's own numbers).
- **What really happened** card (`VSIEra.ch5.applyShift(...).card`): Emirates' 1985 start (US$10 million, two leased aircraft, first flight to Karachi) and Dubai International's 92.3 million passengers in 2024, with India as its biggest market.

## Checked but not used (sources disagree or are secondary)
- **Share of Indian international travellers who connect through Gulf hubs.** Published figures range from about 25% (Gulf airlines' share of India's international seats) through about 41% and "about 50%" to "more than 70% of long-haul travellers": Dataful (https://insights.dataful.in/articles/how-gulf-hubs-continue-to-anchor-indias-global-air-traffic), American Bazaar citing Aviation Business (https://americanbazaaronline.com/2026/02/28/middle-east-airspace-closures-after-iran-strikes-disrupt-india-us-travel-route-476070/), OAG (https://www.oag.com/blog/incredible-india-friend-or-foe). They measure different things, and none is DGCA's own published table, so **the game uses no share figure**. The front page says only what Dubai's own airport reports.
- Emirates' exact founding date: sources give 25 March or 15 March 1985. Not used. The first flight date (25 October 1985) is consistent across sources.
- Dubai's "open skies" policy is widely described but was not pinned to a dated primary source in the time available. Not used.

## Game assumptions (not history: estimates, labelled as such in `money/era.js` `CH5`)
- What VSI earns per connection: international passenger fee premium over domestic + the widebody landing fee per seat + transfer shopping, from `money.json` (`aero.udf_greenfield_opening_nmia`, `aero.landing_intl_wide_per_t`, `nonaero.zmi_per_pax_start`, `nonaero.transfer_vs_od_spend`), at year-14 prices.
- Passenger care per missed connection: `money.json` `rights.meal_cost_inr` plus rebooking, the same ₹1,900 the shift ledger uses.
- The cost of holding London 20 minutes at Heathrow: an estimate of crew, fuel and a missed arrival slot, ₹ per minute for an A380 from `money.json` `fuel.hold_cost_per_min`, plus the knock-on cost (est.).
