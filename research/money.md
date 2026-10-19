# Money research: Indian airport economics for Zero Mile International

Compiled 19 Oct 2026. Step 1 of `prompt-money.md`: 9 topic researchers, each checked by a skeptic, then merged here. The merge uses only figures the skeptic **confirmed** or **corrected** (with the corrections applied). Refuted or unverifiable figures were either re-sourced or are marked **(est.)** with the reasoning given. A few benchmark, PPP-bid and MADC figures were added by the merger, from the primary sources cited next to them. Every number the game uses is in `money.json` (value, unit, source, period, `estimate` flag).

1 crore (cr) = ₹10^7, 1 lakh (L) = ₹10^5. Tariffs exclude GST. "CP" means an AERA control period.

---

## 1. Aeronautical charges (AERA orders)

**Landing charges have no MTOW slabs.** None of the current Delhi, Mumbai or Bengaluru orders uses weight slabs. Delhi (DIAL) splits narrow-bodies (ICAO Code A/B/C) from wide-bodies (D/E/F), while Mumbai (MIAL) and Bengaluru (BIAL) charge one flat rate per tonne, domestic or international. The old "up to / above 100 MT" wording survives only in DIAL's parking table, where both rates are equal, and in BIAL's variable-tariff tables.

| ₹ per tonne MTOW per landing | Dom narrow | Dom wide | Intl narrow | Intl wide | Min/landing | Source |
|---|---|---|---|---|---|---|
| DIAL CP4 (16 Apr 2025 to Mar 2029) | 347 | 564 | 570 | 785 | ₹8,000 | [Order 20/2024-25 p.419](https://www.aera.gov.in/uploads/airports/17431676123962.pdf) |
| MIAL CP4 (16 May 2025 to Mar 2029) | 402 | 402 | 603 | 603 | ₹8,000 | [Order 01/2025-26 p.501](https://www.aera.gov.in/uploads/airports/17466350622028.pdf) |
| BIAL CP4 (1 Sep 2026 to Apr 2030) | 442 | 442 | 652 | 652 | – | [Order 14/2026-27 p.618](https://www.aera.gov.in/uploads/airports/17872763073873.pdf) |

- Domestic scheduled aircraft with under 80 seats pay no landing charge, at all three airports.
- New-route waivers differ by airport:
  - DIAL: wide-body routes of 5,000 km or more, until Mar 2029.
  - MIAL: any new international destination, for 1 year.
  - BIAL: routes over 4,500 km pay 0x for years 1 to 3.

**Parking (DIAL), ₹ per tonne per hour:**
- Rates: contact stands **36**, remote stands **18**.
- Free time: **2 h, plus 15 min taxi-in and 15 min taxi-out**.
- After the free time, rates are multiplied by 1x for 0–4 h, 2x for 4–12 h, 4x for 12–24 h, and 5x beyond 24 h.
- MIAL charges 27/13.5, with 2 h free measured on-blocks to off-blocks and no multipliers.

**UDF (user development fee), ₹ per passenger:**

| Airport | Dom dep | Dom arr | Intl eco dep | Intl eco arr | Intl biz dep | Intl biz arr |
|---|---|---|---|---|---|---|
| DIAL CP4 | 129 | 56 | 650 | 275 | 810 | 345 |
| MIAL CP4 | 175 | 75 | 615 | 260 | 695 | 304 |
| BIAL CP4 | 300 | 125 | 997 | 426 | 997 | 426 |
| NMIA (greenfield, ad-hoc order of 20 Jun 2025) | **620** | – | **1,225** | – | – | – |

- Transit passengers within 24 h on the same ticket, children under 2 and crew on duty are exempt.
- The NMIA rates come from [Business Standard, 23 Jun 2025](https://www.business-standard.com/industry/aviation/navi-mumbai-airport-rs-57000-cr-capex-aera-approves-interim-udf-125062301003_1.html). The CP1 order kept the same UDF and carried 11.32% of the ARR (aggregate revenue requirement) forward to CP2.
- The lesson: a greenfield airport's UDF opens far above a mature airport's.

**Aero mix and yield:**
- DIAL's FY26 aero revenue is projected at ₹2,981.52 cr: landing 46%, UDF 43%, parking 4.6%.
- AERA's yield is ₹432.14 per departing passenger (present-value basis) ([Tables 348–349](https://www.aera.gov.in/uploads/airports/17431676123962.pdf)).
- The nominal yield rose from ₹145 to **₹360 per passenger** (+148%) ([GMR, 29 Mar 2025](https://nsearchives.nseindia.com/corporate/GMRINFRA_29032025210341_29032025PRESS_RELEASE.pdf)).
- TDSAT has since allowed DIAL's appeal against the CP4 order ([GMR filing, 20 Sep 2026](https://nsearchives.nseindia.com/corporate/GMRINFRA_20092026204537_20092026-DIALTDSATORDER.pdf)).

**Maximum MTOW, tonnes:**
- Narrow-bodies: A320neo 79; 737 MAX 8 82.6; A321neo 97.
- Wide-bodies: 787-9 259.2 (older airframes 254.7); A350-900 283; 777-300ER 351.5; 747-8I 447.7; A380 575.
- Sources: [Airbus](https://aircraft.airbus.com/en/aircraft/a320-the-most-successful-aircraft-family-ever/a320neo) and [Boeing](https://www.boeing.com/commercial/777). The A321neo, A350 and A380 figures are secondary sources.
- Worked examples at DIAL rates (est., arithmetic):
  - A320neo domestic landing: ₹27,413.
  - 777-300ER international landing: ₹2.76 L.
  - A380 international landing: ₹4.51 L.
  - A320neo on a contact stand for 1 h past the free time: ₹2,844.

## 2. The till and AERA regulation

- **Hybrid till: 30%.** Only 30% of non-aero revenue reduces the aero revenue requirement (ARR); the operator keeps 70%.
  - Source: AERA Order 14/2016-17 of 12 Jan 2017 ([Nagpur CP 16/2017-18 paras 3.1–3.5](https://www.aera.gov.in/uploads/consultations/59a940532d01fFinalCPNagurAirport1stSept17.pdf)).
  - Formula: `ARR = FRoR × RAB + depreciation + O&M + tax − 0.30 × NAR`.
  - Before 2017, AERA used a single till (100%).
  - DIAL and MIAL follow the same 30% through the "S factor" in their State Support Agreements.
  - A Jul 2026 news report of a move back toward a single till is **unverified** (one secondary source). Treat it only as a possible future policy shock.
- **Control period: 5 years** (AERA Act s.13). Tariffs can be reviewed mid-period in the public interest. A "major airport" is one with more than 35 lakh passengers a year.
- **Fair return**, from DIAL CP4 ([CP 07/2024-25](https://www.aera.gov.in/uploads/consultations/17383225584994.pdf), consultation stage; the final order may differ):
  - Cost of equity **15.41%** (IIM Bangalore CAPM study).
  - Efficient cost of debt **10.15%** (SBI 1-year MCLR 8.65% + 150 bps).
  - Notional gearing 48:52 debt:equity.
  - **WACC 12.89%**.
  - The cost-of-equity range in AERA practice is 15.17% (Hyderabad CP3, upheld by TDSAT; [TDSAT](https://indiankanoon.org/doc/32317059/)) to 16% (DIAL CP1/CP2).
  - The 14% Hyderabad figure comes from an IndiGo letter, not from AERA, so it is not used.
- **Scale and true-up (DIAL CP4):**
  - RAB (regulated asset base) ₹14,072.69 cr in FY25.
  - Target revenue after true-up ₹13,655.41 cr over 5 years; DIAL had asked for ₹41,921 cr.
  - The CP3 true-up found a **₹852.04 cr over-recovery**, refunded to users in FY25.
  - AERA deducts 1% of project cost for projects not capitalised on time.
- **Service-quality rebates** (draft [AERA CP 03/2025-26](https://aera.gov.in/uploads/topics/17555315227226.pdf); no final order yet):
  - Maximum rebate: 5% of ARR (4% objective + 1% subjective), up from 4% (1.5 + 2.5).
  - Each parameter group missed in a month costs **0.25%**.
  - Maximum incentive: 1.25%.
  - Targets: 95% of passengers wait under 10 min at security and under 20 min at check-in; first bag in 15 min, last bag in 35 min (Code C).
  - This is the airport's only regulated exposure to service failures.

## 3. Non-aeronautical revenue

| ₹ per passenger | Value | Period | Source |
|---|---|---|---|
| Delhi, total | **417** | FY25 | [CRISIL](https://www.crisilratings.com/mnt/winshare/Ratings/RatingList/RatingDocs/DelhiInternationalAirportLimited_August%2005_%202025_RR_374914.html) |
| Delhi, by line (est., derived) | retail 116 · F&B 42 · advertising 29 | FY25 | [Moodie Davitt](https://moodiedavittreport.com/food-beverage-a-star-performer-as-gmr-airports-reports-strong-fy2024-25-results) |
| Hyderabad (est., derived) | 214 (retail 68, F&B 44, parking 27, ads 27) | FY25 | same |
| Bengaluru (est., derived) | 246 | FY25 | [CRISIL BIAL](https://www.crisil.com/mnt/winshare/Ratings/RatingList/RatingDocs/BangaloreInternationalAirportLimited_April%2029_%202025_RR_366830.html) |
| Mumbai (est., derived) | ~515 | FY25 | [CRISIL MIAL](https://www.crisilratings.com/mnt/winshare/Ratings/RatingList/RatingDocs/MumbaiInternationalAirportLimited_August%2020_%202025_RR_371019.html) |
| Adani network | 672 | FY26 | [Moodie Davitt](https://moodiedavittreport.com/adani-airports-buoyed-by-strong-commercial-performance-in-financial-year/) |
| Duty-free spend per passenger, DEL / HYD | 1,026 / 784 | 9M FY25 | [Moodie Davitt](https://moodiedavittreport.com/?p=438451) |

- The full-year FY25 duty-free figures (1,010 and 727) could not be verified and are not used.

**Behaviour:**
- **Dwell elasticity:** non-aero revenue rises 0.5% for each 1% more dwell time (F&B 0.8, retail 0.6) ([Wu et al., JATM 2024](https://ideas.repec.org/a/eee/jaitra/v118y2024ics0969699724000851.html)).
- **Delay:** spend follows an inverted U, rising with modest delay and falling with excessive delay ([Choi & Park 2022](https://ideas.repec.org/a/eee/joreco/v66y2022ics0969698922000066.html)). No threshold is published, so the game uses a 60-minute peak (est.).
- **Time near outlets:** each 10 minutes of delay adds only 20 s near shops and 8 s near dining ([AMCIS 2024](https://aisel.aisnet.org/treos_amcis2024/39)).
- **Satisfaction:** the most satisfied passengers are twice as likely to shop ([DKMA 2013](https://moodiedavittreport.com/dwell-time-choice-and-value-key-to-driving-commercial-says-dkma-survey)).
- **Transfer passengers spend about 0.75× an O&D passenger** (est.; range 0.6–0.9). They generate no parking or landside spend. Delhi's transfer share is about 26%.

**Game values (est.):**
- ZMI opens at **₹250 per passenger**, anchored on Hyderabad and Bengaluru.
- It matures to **₹450 per passenger** (between Delhi and Mumbai) once international traffic reaches at least 20%.
- Mix: duty-free 32%, retail 25%, F&B 15%, advertising 10%, car parking 12%, other 6%.

## 4. Costs

- **Operating cost: ₹199 per passenger** (est.). Derived from DIAL's FY24 O&M of ₹1,467.01 cr over 73.67 m passengers ([CP 07/2024-25 Table 77](https://www.aera.gov.in/uploads/consultations/17383225584994.pdf)).
  - Manpower ~₹40, repairs and maintenance ~₹33, power ~₹34 gross (~₹9 net of recoveries).
  - The cost excludes the 45.99% revenue share paid to AAI, which works out to about ₹333 per passenger. At Delhi that is more than all O&M combined.
- **Electricity:** ₹10.01 per kWh (DIAL, FY24).
- **Cost of keeping a runway open: ₹26,000 per runway-hour (est.; range 24,000–29,000).** No published figure exists. The build-up:

| Component | ₹ per hour | Basis |
|---|---|---|
| ARFF (fire cover) | ~12,200 | 90 staff × ₹10 L CTC, plus 5 crash fire tenders × ₹5 cr over 15 yr. Minimum 3 vehicles at Cat 9/10 ([ICAO Annex 14 via AIP](https://aim.rlp.cz/eaip/html/eAIP/LK-AD-1.2-en-GB.html)) |
| Airfield lighting power | 1,500–2,500 | 150–250 kW at ₹10/kWh |
| Pavement and lighting renewal | 11,000–14,000 | ₹106.84 cr runway rehab every 10–12 yr, plus routine repairs (DIAL RWY 10/28, Table 64) |
| ATC | not the operator's cost | AAI provides ATC and bills airlines. Notional ₹3,000–5,000 per hour if the game charges it |

- About ₹23 cr per year per runway at 24×7. Crash fire tenders cost about ₹7.6 cr each at FY25–29 prices (Table 219).

## 5. Fuel

- **Arrival-management burn** ([EUROCONTROL Standard Inputs 10.0.2, Table 6.1](https://standard-inputs.netlify.app/chapters/rate_of_fuel_burn.html)): narrow-body 35.2 kg/min, wide-body 85.2 kg/min.
- **Holding burn per type (est., ±20%):**
  - A320neo 33 kg/min.
  - 777-300ER 100 kg/min.
  - A380 160 kg/min.
- **ATF prices, ₹ per kL:**
  - Delhi, 1 Oct 2025: 93,766.02 ([PTI via Swarajya](https://swarajyamag.com/amp/story/news-brief/aviation-fuel-prices-raised-by-over-3-per-cent-commercial-lpg-becomes-costlier-domestic-cooking-gas-unchanged)).
  - Delhi, 1 Apr 2026, domestic scheduled: 1,04,927.18 ([Angel One](https://oga-prod.angelone.in/news/commodities/atf-prices-raised-across-metros-from-april-1-hike-moderated-for-domestic-airlines)).
  - Foreign carriers' international uplift and non-scheduled flights paid 2,07,341 (+114.5%) during the West Asia crisis. This is the **fuel-shock** reference, at 2.15× the domestic price.
- **Nagpur price: no published figure.** The game uses **₹1,00,000 per kL** (est.): the Mumbai price plus inland freight.
  - Maharashtra cut VAT on ATF from 18% to 7% from 15 May to 14 Nov 2026 ([TaxTMI](https://www.taxtmi.com/news?id=72825)), which makes fuel about 9% cheaper in that window.
- **Holding cost (est.)** at a density of 0.80 kg/L and ₹100/L:
  - A320neo about ₹4,125 per minute.
  - 777-300ER about ₹12,500 per minute.
  - A380 about ₹20,000 per minute.
  - The **airline** pays this, not the airport.

## 6. Passenger rights (DGCA CAR Section 3, Series M, Part IV)

Source: CAR Rev. 3, 27 Feb 2019 ([mirror PDF](https://livefromalounge.com/wp-content/uploads/2023/12/D3M-M4-1.pdf)), plus the 2023 amendment on downgrades.

**The airline owes everything below; the airport owes nothing under the CAR.** The airline may recover costs from third parties under contract law. Weather, ATC, strikes and government orders are extraordinary circumstances: they remove cancellation compensation and delay facilities, but not the duty to refund or rebook.

| Trigger | What is owed |
|---|---|
| Delay ≥ 2 h (block time ≤ 2.5 h) / ≥ 3 h (2.5–5 h) / ≥ 4 h (longer flights) | Meals and refreshments |
| Domestic delay > 6 h | Alternate flight within 6 h, or full refund |
| Delay > 24 h, or > 6 h for flights scheduled to depart 20:00–03:00 | Hotel, including transfers |
| Cancellation with < 24 h notice | Refund or alternate flight, plus up to ₹5,000 / 7,500 / 10,000 (block time ≤ 1 h / 1–2 h / > 2 h) |
| Denied boarding | ₹0 if rebooked within 1 h; 200% of fare, capped at ₹10,000, within 24 h; 400%, capped at ₹20,000, beyond 24 h |
| Involuntary downgrade | Refund of 75% of the ticket (domestic); 30 / 50 / 75% (international, by distance) |

- The CAR sets no rupee amount for meals or hotels. Game estimates: **₹400 per meal voucher** and **₹4,500 per hotel room-night** (est., Nagpur).
- Fog SOP (15 Jan 2024): airlines *may* cancel in advance if a delay of more than 3 h is expected ([Business Today](https://www.businesstoday.in/amp/india/story/share-real-time-information-dgca-issues-sops-for-airlines-amid-flight-delays-cancellations-due-to-fog-413367-2024-01-15)).

## 7. Concession finance

**Gearing:**
- Noida Phase 1: **65:35** debt:equity. SBI lent ₹3,725 cr for 20 years with a 1-year moratorium after completion; Zurich put in ₹2,005 cr of equity ([Business Today](https://www.businesstoday.in/amp/industry/aviation/story/noida-airports-first-phase-funding-signed-with-rs-3725-cr-loan-from-sbi-303859-2021-08-11)).
- The Noida concession agreement caps the Debt Due recognised on termination at 70% of total project cost.
- Expansions: Hyderabad and Delhi at 70:30; Bengaluru CP4 at 80:20.
- Navi Mumbai: ₹12,770 cr from 8 lenders over 23 years, implying about 80:20.
- **Game default: 70:30, with a 60–80% slider.**

**Rates:**
- Observed rupee debt costs **8.7–10.2%**:
  - Delhi Airport Parking Services (rated A): 9.0%.
  - GMR Hyderabad NCDs (AA+): 8.9–9.1% ([ICRA](https://www.icra.in/Rating/GetRationalReportFilePdf?id=133609)).
  - GMR Goa NCDs after opening (A): 10% ([The Goan](https://www.thegoan.net/goa-news/%EF%BB%BFgmr-goa-international-airport-raises-rs-2400-crore/106117.html)).
  - AERA's efficient-debt benchmark: 10.15%.
- Game rates (est.): **9.5% base, ±1% by rating**; **10.5% during construction**, since Goa's pre-opening debentures cost 13.25–13.9%; **9.0% refinance** once traffic is proven.

**Tenor:**
- 20 years after a 1-year moratorium (Noida).
- RBI's 5/25 rule (2014) caps amortisation at 80% of the concession period; the RBI Project Finance Directions 2025 cap it at 85% of economic life.

**DSCR covenants** (MIAL USD bond, [CareEdge Aug 2025](https://www.careedgeglobal.com/upload/RatingReportPDF/Rating_Rationale_Mumbai_International_Airport_Limited_13Aug2025.pdf)):
- Minimum DSCR **1.10x**, tested every six months.
- Distributions: **none below 1.20x**, 50% below 1.40x, 75% below 1.55x, 100% above 1.55x.
- Reserves: a 6-month debt service reserve; net debt/EBITDA capped at 5.0x.
- A GMR bank loan carries a 1.15x minimum ([ICRA](https://www.icra.in/Rating/GetRationalReportFilePdf?id=113591)). ICRA's downgrade trigger for BIAL is a sustained cumulative DSCR below 1.40x.
- **Game:**
  - Warning at **1.20** (sourced).
  - Covenant breach at **1.10** (sourced).
  - Step-in at **1.0 for two eras** (est.). Below 1.0, operating cash cannot cover debt service at all; real loans default earlier, at the covenant.

**Termination and lenders** ([Noida concession agreement](https://www.civilaviation.gov.in/sites/default/files/2023-07/1%20Concession%20Agreement_1.pdf)):
- Before terminating, the authority gives lenders 15 days' notice, then a 180-day substitution window, extendable by 90 days.
- On concessionaire default, the authority pays 90% of Debt Due and 70% of the Additional Termination Payment; **equity gets nothing**.
- On authority default, it pays 100% of debt plus 150% of Adjusted Equity.
- Equity lock-in: the lead member must hold 51% until 7 years after opening.
- Cash waterfall: taxes → O&M → concession fee → senior debt → sub-debt → reserves → equity.

**Pandemic shock precedent:**
- An arbitral tribunal excused DIAL's Annual Fee to AAI from 19 Mar 2020 to 28 Feb 2022, ordered a refund of about ₹465 cr, and **extended the concession by 23 months**.
- The Delhi High Court upheld the award on 7 Mar 2025; AAI's appeal is pending ([ICRA DIAL, Sep 2026](https://www.icra.in/Rating/ShowRationalReportFilePdfViewer/145648)).

**Equity returns:**
- Fairfax India values BIAL using after-tax discount rates of **12.4–17.3%**, implying **USD 2.55 bn for 100% of the equity** (31 Dec 2024; [Fairfax India AR 2024](https://fairfaxindia.ca/wp-content/uploads/2025/03/Fairfax-India-Annual-Report-2024.pdf)). That is about ₹21,800 cr at ~₹85.5/USD (est., my conversion).
- **Game target equity IRR: 15.5%** (est.), the middle of the regulated cost of equity and Fairfax's range.

## 8. Capex benchmarks

| Project | ₹ cr | MPPA | ₹ cr per MPPA | Source |
|---|---|---|---|---|
| Navi Mumbai Phase 1 (2025) | 19,650 | 20 | 983 | [IANS](https://ianslive.in/pm-inaugurates-navi-mumbai-international-airport--20251008154555) |
| Noida Phase 1 (2026) | 11,200 | 12 | 933 | [WION](https://www.wionews.com/photos/what-makes-noida-s-new-airport-unique-flight-every-2-minutes-3-900m-all-weather-runway-10-min-check-in-and-more-1774695191502) |
| Noida full master plan | 29,561 | 70 | 422 (bid-era prices) | [Knight Frank](https://content.knightfrank.com/research/3090/documents/en/the-jewar-turning-point-2026-12780.pdf) |
| Navi Mumbai full build (verbal estimate) | ~1,00,000 | 90 | ~1,110 (est.) | [FPJ](https://www.freepressjournal.in/amp/mumbai/first-flight-from-navi-mumbai-international-airport-set-for-december-2025-confirms-cidco-chief) |
| Al Maktoum terminal | AED 128 bn ≈ 2,89,000 | 260 | ~1,112 (est. FX) | [Dubai Media Office](https://www.mediaoffice.ae/en/news/2024/april/28-04/al-maktoum-international-airport) |
| Delhi Phase 3A (brownfield, incl. 4th runway) | 9,800 | +34 | 288 | [Gulf News](https://gulfnews.com/business/aviation/new-delhi-airport-plans-expansion-to-increase-annual-passenger-capacity-to-100-m-by-2022-1.1565078334090) |
| Bengaluru south parallel runway (L&T EPC, 2017) | 1,358 | – | – | [Deccan Herald](https://www.deccanherald.com/amp/story/india%2Fkarnataka%2Fbengaluru%2Fbengaluru-airport-mandates-lt-695973.html) |

**ZMI phase 1 (est., the number the game uses): ₹56,000 cr.**
- **Assumption:** phase 1 is sized for **70 MPPA** (the brief gives 60–80). That covers Bengaluru's ~44.5 m passengers at opening plus growth. Hyderabad and Ahmedabad (~44 m) arrive in year 8 and trigger the first expansion. The full build is 209 MPPA (`design.md`).
- **Rate: ₹800 cr per MPPA**, excluding land, which the state contributes.
  - That is below single-runway phase 1s (₹930–983), because a 70 MPPA phase spreads fixed site cost.
  - It is above Noida's full-plan ₹422, which in 2019–21 prices is about ₹600 today.
- **70 × 800 = ₹56,000 cr.** Cross-check: Navi Mumbai's operator filed ₹57,333 cr of capex to FY30.
- **Later expansions** (est.): ₹275 cr per added MPPA (brownfield, range 200–300) and **₹1,950 cr per new hub runway** (Bengaluru's ₹1,358 cr from 2017, inflated at ~5% a year). The full build comes to about ₹1.04 lakh cr.

**Financial close at 70:30:**
- Debt ₹39,200 cr.
- Equity ₹16,800 cr: parent ₹13,440 cr, AAI ₹1,680 cr, MADC ₹1,680 cr.
- Construction takes 4 years: Navi Mumbai and Noida each took about 4 years from financial close to opening.

## 9. PPP bids and the state partner

| Concession | Bid type | Winning bid | Rivals | Source |
|---|---|---|---|---|
| Delhi (2006) | Revenue share to AAI | **45.99%** | – | [CP 07/2024-25](https://www.aera.gov.in/uploads/consultations/17383225584994.pdf) |
| Mumbai (2006) | Revenue share to AAI | **38.7%** | – | [CRISIL MIAL](https://www.crisilratings.com/mnt/winshare/Ratings/RatingList/RatingDocs/MumbaiInternationalAirportLimited_August%2020_%202025_RR_371019.html) |
| Mopa, Goa (2016) | Revenue share to state | **36.99%** | AAI 32.31%, Essel 27% | [Goa DCA](https://dca.goa.gov.in/about-us/) |
| Nagpur (2019, taken over 25 Jun 2026) | Revenue share to MIHAN India | **14.49%** (raised from 5.76%) | – | [Indian Infrastructure](https://indianinfrastructure.com/2019/04/03/gmr-receives-loa-for-nagpur-international-airport/), [SC judgment 9 May 2022](https://www.advocatekhoj.com/library/judgments/announcement.php?WID=15060) |
| Navi Mumbai (2017) | Revenue share to CIDCO | **12.6%** | GMR 10.44% | [Indian Infrastructure](https://indianinfrastructure.com/2017/11/05/cidco-issued-loa-to-mial-for-navi-mumbai-international-airport-project-phase-i/) |
| AAI six airports (2019) | Per-passenger fee | **₹115–177** (AMD 177, JAI 174, LKO 171, TRV 168, GAU 160, IXE 115) | – | [Indian Infrastructure](https://indianinfrastructure.com/2019/03/08/adani-emerges-highest-bidder-for-all-six-airports-on-ppp/) |
| Noida (2019) | Per-passenger fee | **₹400.97** | Adani 360, DIAL 351, Anchorage 205 | [PTI via Udayavani](https://www.udayavani.com/english-news/swiss-firm-to-develop-indias-biggest-airport-near-delhi-outbids-adani) |

- For the AAI six airports, international passengers pay 2× the per-passenger fee, indexed to CPI-IW, on 50-year leases ([ITLN](https://www.itln.in/adani-to-takeover-ahmedabad-lucknow-and-mangaluru-airports-for-50-years-aviation)).
- The ppp-03 claim (cumulative per-passenger fees of ₹2,032 cr and upfront fees of ₹2,758 cr) had no skeptic verdict and is **not used**.
- Bid ranges for the game: revenue share **12.6–46%** (slider 10–50%); per-passenger fee **₹115–401** (slider ₹100–450).
- The pattern: greenfield concessions (Navi Mumbai, Nagpur) go for 12–15%. The 37–46% shares sit on old, cheap asset bases (Delhi, Mumbai) or small projects (Mopa).

**Concession terms:**
- Delhi: 30 years plus a right to seek 30 more.
- **Bengaluru: 30 + 30, extension exercised, to 2068** ([CRISIL BIAL](https://www.crisil.com/mnt/winshare/Ratings/RatingList/RatingDocs/BangaloreInternationalAirportLimited_April%2029_%202025_RR_366830.html)).
- Noida: 40 years plus 30 by re-bid.
- Mopa: 40 + 20.
- ZMI's 60 years matches the Delhi/Bengaluru 30 + 30 structure.
- The state holds 26% in Delhi, Mumbai, Navi Mumbai (CIDCO) and Bengaluru (AAI + KSIIDC). ZMI's 20% is a game choice.

**MADC's role is verified, so the name can be used.**
- The Maharashtra Airport Development Company is the Government of Maharashtra's company that spearheads MIHAN ([mihanindia.in](https://mihanindia.in/)).
- It holds **51% of MIHAN India Ltd**, with AAI holding 49% (Supreme Court judgment, 9 May 2022).
- MIHAN India ran Nagpur airport and awarded GMR its 30-year concession. GMR took over on 25 Jun 2026.
- So MADC does not "run" the airport. Suggested wording: *"MADC, the State of Maharashtra's airport and MIHAN developer"*.

## 10. Benchmarks for the endgame

| | Revenue per passenger (₹) | EBITDA margin | Debt/EBITDA | Source |
|---|---|---|---|---|
| Delhi FY26 | 962 (₹7,568 cr / 78.7 m) | **37.0%** (26.7% FY25) | 5.8x | [ICRA Sep 2026](https://www.icra.in/Rating/ShowRationalReportFilePdfViewer/145648) |
| Bengaluru FY26 | 953 (₹4,239 cr / 44.5 m) | **~72%** (68.1% FY25) | 4.1x (FY25) | [ICRA May 2026](https://www.icra.in/Rating/GetRationalReportFilePdf?id=143328) |
| Mumbai FY25 / FY24 | 831 (₹4,571 cr / 55 m) | **39.8%** (FY24: ₹1,599 / ₹4,021 cr) | 3.6x net | [CRISIL](https://www.crisilratings.com/mnt/winshare/Ratings/RatingList/RatingDocs/MumbaiInternationalAirportLimited_August%2020_%202025_RR_371019.html), [CARE](https://www.careratings.com/upload/CompanyFiles/PR/202412141202_Mumbai_International_Airport_Limited.pdf) |

- Revenue per passenger is derived (est.).
- Delhi and Mumbai margins are struck after their 46% and 38.7% revenue shares. Bengaluru's revenue share is modest, which is why its margin is about 70%.
- Use **Bengaluru's USD 2.55 bn equity value** and the 12.4–17.3% discount rates as the "real investor" comparison.

---

## Game multiplier (explicit, the only scaling)

**1. Peak day to year: ×311 (sourced, derived).**
- Delhi handled 78.7 m passengers in FY26 ([ICRA](https://www.icra.in/Rating/ShowRationalReportFilePdfViewer/145648)) and set a record of ~2.53 lakh passengers on 30 Nov 2025 ([GMR traffic, Nov 2025](https://nsearchives.nseindia.com/corporate/GMRINFRA_15122025214736_15122025-monthlytrafficdataNov.pdf)).
- 78.7 m / 2.53 L = **311**, so the peak day is 1.17× the average day. The aircraft-movement equivalent is 327.

**2. Shift to day: design-day movements ÷ shift movements (est.).**
- A shift is a slice of the peak day. Design-day movements for each level are the sum of the source airports' record days: L1 837; L2 1,744; L3 2,780; L4 4,194.
- Ahmedabad's ~300 is an estimate; the rest are records (BLR 837, HYD 607, BOM 1,036, DEL 1,414).
- Level 1 example: 837 / 110 = 7.6.

**`annual = shift money × (design_day / shift_moves) × 311`; an era is 5 years of that, with growth.**

**3. Per-shift money multiplier: 1.0 (no inflation).**
- Real rupees already matter at shift scale. A Level-1 shift has ~110 movements and ~17,700 passengers, and earns about ₹1.3 crore in real terms: UDF ~₹59 L, landing ~₹17 L, non-aero ~₹44 L.
- Individual calls swing ₹0.3–5 lakh. Examples:
  - One delayed A320 owes ~₹72,000 in meals (airline-borne; airport-side only through service-quality rebates and goodwill).
  - Ten minutes of holding burns ~₹41,000 per A320neo (airline-borne).
  - One runway-hour costs ₹26,000.
- If tuning later needs more bite, change `game.shift_money_multiplier` alone and show "×N game scale" in the UI. Never edit the real values.

**Balance warning for the design step. This is real, not a bug.**
- At real prices, phase 1 does not pay its debt in era 1. Take opening traffic (44.5 m passengers), Navi Mumbai-style UDF, Delhi landing rates, ₹250 non-aero and ₹199 opex:
  - Revenue is about **₹3,200 cr a year** and EBITDA about **₹2,300 cr** before revenue share (~₹1,300 cr at a 30% share).
  - Debt service on ₹39,200 cr at 9.5% over 20 years is about **₹4,450 cr a year**; interest alone is ₹3,720 cr. Era-1 DSCR is about 0.3–0.5.
- The AERA formula would allow an ARR of about ₹9,400 cr, roughly ₹4,200 per departing passenger, about 10× Delhi's ₹432. The reason: ZMI's asset base per annual passenger is about ₹12,600, against Delhi's ₹1,775.
- Real projects survive this through:
  - phasing to traffic (Navi Mumbai 20 MPPA, Noida 12);
  - AERA carrying under-recovery forward (Navi Mumbai carried 11.32% of ARR to CP2);
  - long sculpted or ballooning debt;
  - low revenue-share bids (12–15% at greenfields).
- The design step should choose among these, for example a regulatory receivable and sculpted debt, rather than inflate revenue. A phase 1 nearer 45 MPPA (~₹36,000 cr) narrows the gap but does not close it.

## What the game uses

Every value is in `money.json`; this is the index.

- **aero:**
  - Landing ₹347/564 (domestic narrow/wide) and ₹570/785 (international narrow/wide) per tonne; minimum ₹8,000.
  - Parking ₹36 contact / ₹18 remote per tonne-hour after 150 free minutes, with multipliers 1/2/4/5.
  - UDF (Delhi card) 129/56, 650/275, 810/345. Opening UDF (Navi Mumbai precedent) ₹620 domestic / ₹1,225 international departing.
  - MTOW table; Mumbai and Bengaluru cards for reference.
- **till:**
  - Hybrid till 0.30; control period 5 years.
  - Cost of equity 15.41% (range 15.17–16); WACC 12.89%; efficient cost of debt 10.15%.
  - Delhi RAB ₹14,072.69 cr; 1% penalty for uncapitalised projects.
  - Service-quality rebate up to 5% of ARR (0.25% per group), incentive up to 1.25%, and the target thresholds.
- **nonaero:**
  - ZMI ₹250 → ₹450 per passenger, with the 6-line mix and its per-category rupees.
  - Dwell elasticity 0.5 (F&B 0.8, retail 0.6); delay peak 60 min (est.); transfer passengers 0.75×; satisfied passengers 2× as likely to shop.
  - Delhi, Hyderabad, Bengaluru, Mumbai and Adani anchors.
- **costs:**
  - Opex ₹199 per passenger; runway ₹26,000 per hour; notional ATC ₹4,000 per hour (off by default).
  - Power ₹10.01/kWh; crash fire tender ₹5–7.6 cr; runway rehab ₹106.84 cr; revenue share at Delhi ₹333 per passenger.
- **fuel:**
  - Holding burn 33/100/160 kg/min (A320neo / 777-300ER / A380); EUROCONTROL 35.2/85.2.
  - ATF ₹1,00,000 per kL (Nagpur, est.); Delhi Oct 2025 and Apr 2026 prices; shock factor ×2.15.
  - Holding cost ₹4,125/12,500/20,000 per minute; density 0.80.
- **rights:**
  - Meal thresholds 2/3/4 h; hotel after 24 h (or 6 h for 20:00–03:00 departures); refund option at 6 h.
  - Cancellation ₹5,000/7,500/10,000; denied boarding ₹0/10,000/20,000; downgrade refunds.
  - Meal ₹400 and hotel ₹4,500 (est.).
- **finance:**
  - Gearing 0.70 (0.60–0.80); tenor 20 years plus 1-year moratorium; 80% tenor cap.
  - Rates 9.5% base, 10.5% construction, 9.0% refinance.
  - DSCR covenant 1.10, warning/lock-up 1.20, step-in 1.0 (est.); 6-month reserve; net debt/EBITDA ≤ 5.0.
  - Termination payouts, lender windows, equity lock-in and waterfall.
  - Pandemic precedent (23-month extension); IRR benchmark 12.4–17.3%, target 15.5%.
- **capex:**
  - Benchmarks above; ZMI phase 1 **70 MPPA × ₹800 cr = ₹56,000 cr**.
  - ₹275 cr per added MPPA; ₹1,950 cr per runway; 4 construction years.
- **ppp:**
  - Revenue-share precedents 12.6–45.99%; per-passenger fee ₹115–400.97.
  - Concession terms; state-stake precedents; MADC role; Fairfax/BIAL stakes.
- **benchmarks:**
  - Revenue per passenger: Delhi ₹962, Bengaluru ₹953, Mumbai ₹831.
  - EBITDA margin: Delhi 37%, Bengaluru ~72%, Mumbai ~40%.
  - Bengaluru equity USD 2.55 bn (~₹21,800 cr); debt/EBITDA.
- **game:**
  - Peak-day-to-annual 311; design-day movements by level; shift money multiplier 1.0.
  - 153/280 passengers per narrow/wide movement (est.).
  - Concession 60 years in 5-year eras; ownership 80/10/10.
  - Financial-close numbers; DSCR thresholds; opening tariff.
