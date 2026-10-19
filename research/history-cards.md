# "What really happened" cards, one per chapter (all facts sourced)

The campaign shows one of these at the end of each chapter (see prompt-campaign.md §6). Each card is two or three sentences on paper, with the source in small type. Do not add facts that are not listed here with a source. Rewrite them in the card voice if needed, but keep every number exactly as sourced.

## 1. Win it: what the real winners agreed to pay
**Card:** Delhi's airport operator pays the Airports Authority of India 45.99% of its revenue, and Mumbai's pays 38.7%. Those bids won the concessions, and they are paid on every rupee for the whole term.
**Sources:** AERA consultation paper on DIAL, Table 6 (https://www.aera.gov.in/uploads/consultations/17383225584994.pdf); CRISIL rating rationale for MIAL, 20 Aug 2025 (https://www.crisilratings.com/mnt/winshare/Ratings/RatingList/RatingDocs/MumbaiInternationalAirportLimited_August%2020_%202025_RR_371019.html). Both are in `money.json` under ppp.rev_share_dial and ppp.rev_share_mial.

## 2. Build it: Bengaluru built fast, then slow
**Card:** Bengaluru's airport, the third greenfield airport in India built as a public-private partnership, was finished 32 months after construction began in July 2005. It took nearly a decade before that to acquire the land. Its second terminal was due in March 2021. The domestic side opened in January 2023, and AERA's order traces part of the delay to the glass panels, the bamboo ceiling and the boarding bridges arriving late.
**Sources:** Kempegowda International Airport, Wikipedia (https://en.wikipedia.org/wiki/BIAL): "Construction commenced on 2 July 2005, and was completed in 32 months"; "the third greenfield airport to open under a public–private partnership". The T2 dates come from `money.json` bial.t2.timeline (cod_target 2021-03-31, t2_domestic 2023-01-15; sources listed there). The delay causes come from AERA's order, paras 5.2.12–5.2.15 (https://aera.gov.in/uploads/airports/16466592165337.pdf).

## 3. Open it: the day Bengaluru moved
**Card:** Bengaluru's new airport opened in May 2008: the first commercial flight landed on 23 May, and it launched officially the next day. It replaced the congested HAL airport overnight, so a whole city's flights moved in a single night.
**Source:** Kempegowda International Airport, Wikipedia (https://en.wikipedia.org/wiki/BIAL): "The airport opened in May 2008, as an alternative to the increasingly congested HAL Airport."

## 4. Wire the country: how Atlanta became the busiest airport on earth
**Card:** Since 1998, Atlanta has been the world's busiest airport by passengers, every year except 2020. It is Delta's main hub: Delta and its regional partners carry about 80% of its passengers, on just over 1,000 flights a day to 225 destinations. Atlanta is not a giant city. Its airport is busy because it is the place where the network connects.
**Source:** Hartsfield–Jackson Atlanta International Airport, Wikipedia (https://en.wikipedia.org/wiki/Hartsfield%E2%80%93Jackson_Atlanta_International_Airport): "Since 1998, Hartsfield–Jackson has been the world's busiest airport by passenger traffic, except 2020"; Delta's share is 80.16% (Sep 2025–Aug 2026); "just over 1,000 flights a day to 225 domestic and international destinations".

## 5. Take on the Gulf
Use lane C's Dubai card (research file drafted 09:33). Keep to sourced facts only.

## 6. The crisis: when airlines stop flying, and when the world does
Three cards; the game uses the one that matches the player's crisis.
- **Airline collapse:** "On 17 April 2019, Jet Airways suspended all flight operations after lenders spurned an emergency funding request." Indian Oil had already stopped its fuel over unpaid dues. Source: Jet Airways, Wikipedia (https://en.wikipedia.org/wiki/Jet_Airways).
- **Airline collapse, again:** Go First filed for insolvency on 2 May 2023 and stopped flying the next day. It blamed engine supply problems: 28 of its aircraft were grounded. Source: Go First, Wikipedia (https://en.wikipedia.org/wiki/Go_First).
- **Pandemic:** after a 2023 arbitration award, which the Delhi High Court upheld in March 2025, Mumbai's airport was excused its fee to AAI from 13 March 2020 to 28 February 2022 (23.5 months), and its concession was extended by the same period. Source: `money.json` world.fm_precedent_mial (Delhi High Court judgment OMP(COMM) 185/2024, https://delhihighcourt.nic.in/app/showFileJudgment/DIS07032025OMPCOMM1852024_184404.pdf).

## 7. Harvest: airports are landlords
**Card:** In FY2026, Delhi's airport earned more from shops, duty-free, property and parking (₹3,607 crore) than from airlines and passengers' airport charges (₹3,011 crore). Under AERA's rules, 30% of that non-airline income is used to lower what airlines and passengers pay.
**Sources:** ICRA rating rationale for DIAL (https://www.icra.in/Rating/ShowRationalReportFilePdfViewer/145648), in `money.json` benchmarks.dial_revenue_fy26_cr. The 30% hybrid till comes from AERA's consultation paper, paras 3.1–3.5 (https://www.aera.gov.in/uploads/consultations/59a940532d01fFinalCPNagurAirport1stSept17.pdf), in `money.json` till.hybrid_till_nar_share.

## Also usable (for the "Who owns it" moment at a board meeting)
Fairfax Financial holds about 54% of Bengaluru's airport, and Siemens Project Ventures about 20%. Source: Kempegowda International Airport, Wikipedia (https://en.wikipedia.org/wiki/BIAL): "74% is held by private companies Fairfax Financial (54%)".
