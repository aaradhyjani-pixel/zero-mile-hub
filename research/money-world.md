# Money research, part 2: the world around Vikram Sarabhai International

This file covers what happens to a 60-year airport concession beyond tariffs and costs (those are in `research/money.md`): shocks, stake sales and valuation, handback, termination, incident costs, long-run traffic growth, and how other regulators set prices. All numbers are in `money.json` under `world` (same entry format). The last section, "How the game uses this", turns them into game parameters.

How the numbers were made:
- 7 research agents (shocks, valuation, handback, termination, regulation_world, incident_costs, growth, revenue_world) each made 13-16 claims. A skeptic agent then tried to refute them.
- Every correction from the skeptic has been applied below. Where a figure could not be checked it is marked **(unverified)**; where it is my own derivation or a game choice it is marked **(est.)**.
- Currency for game use: USD 88, EUR 100, GBP 115, NZD 52 INR (est., 2026 conversion). The game should keep the source currency in tooltips.

---

## 1. Shocks (what can hit traffic, costs and debt)

### 1.1 Pandemic

| Fact | Value | Source |
|---|---|---|
| Global airport pax 2020 vs **2019 actual** | **-64.6%** (ACI prelim); ACI 2024 index puts 2020 at ~39 (2019 = 100) → multiplier **0.36-0.40** | [ACI 2024](https://aci.aero/2024/02/13/the-trusted-source-for-air-travel-demand-updates/), [IAR](https://www.internationalairportreview.com/news/140149/dramatic-passenger-declines-aci-world) |
| Global recovery (share of 2019) | 2021 **0.48** (international 0.28), 2022 ~0.72, 2023 **~0.95** (8.7 bn pax), 2024 **1.06** forecast (9.7 bn) | ACI 2024 (above); [Moodie Davitt](https://www.moodiedavittreport.com/global-passenger-traffic-set-to-reach-half-of-2019-levels-in-2021-recovery-to-accelerate-in-2022/) |
| India FY21 | **-66.3%** to ~115 m (from 342.18 m FY20), a level last seen in FY08 | [Aviation Pros](https://www.aviationpros.com/airports/news/21231736/most-airports-continue-to-report-losses-amid-covid-turbulence) |
| India FY22 | ~199 m, ~0.58 of FY20 (AAI estimate); FY24 above pre-COVID **(unverified)** | [Business Standard](https://www.business-standard.com/amp/industry/news/airports-authority-of-india-plans-to-spend-rs-4-000-crore-in-fy24-123042000917_1.html) |
| Transfer/international hubs | Heathrow 22.1 m in 2020 (**-73%**, base ~80.1 m, "lowest for decades"); Dubai -70%; Delhi projected -73% FY21 | [City AM](https://www.cityam.com/heathrow-passenger-numbers-fall-nearly-75-per-cent-in-2020/), [Gulf News](https://gulfnews.com/business/aviation/dubai-airports-saw-259-million-passengers-in-2020-india-tops-in-number-of-travellers-1.1613364302190) |

**Force majeure precedent (corrected).** The case the Delhi High Court decided is **MIAL (Mumbai)**, not DIAL:
- The arbitral award of 21 Dec 2023 (corrected 16 Jan 2024) excused MIAL's Annual Fee to AAI from **13 Mar 2020 to 28 Feb 2022** (~23.5 months). It also extended the OMDA term by the same period.
- The Delhi HC dismissed AAI's challenge on **7 Mar 2025** (OMP(COMM) 185/2024). The companion petition 186/2024 has "similar facts and findings". [Delhi HC judgment](https://delhihighcourt.nic.in/app/showFileJudgment/DIS07032025OMPCOMM1852024_184404.pdf)
- DIAL's own figures (from 19 Mar 2020, refund Rs 465-500 cr) come from ICRA and press. They are consistent with the companion petition but not confirmed by this judgment. The existing `finance.covid_force_majeure` key stays as is; `world.fm_precedent_mial` holds the verified case.
- Timeline: shock Mar 2020 → award Dec 2023 (3.75 years) → High Court Mar 2025 (5 years). Relief arrives one era after the shock.

**Regulator relief after a pandemic is partial:**
- Heathrow got a targeted **£300 m** RAB uplift for COVID. The airlines wanted none. The CMA (Oct 2023) found the CAA "not wrong". [CMA summary](https://assets.publishing.service.gov.uk/media/652d19506b6fbf0014b756b7/Summary_of_the_CMA_s_FD_in_Heathrow_airport_appeals_pdfa.pdf)
- Heathrow paid no dividends for 2020-2023. The first was **£250 m** for 2024, about 12% of its £2,035 m EBITDA. [Heathrow FY24](https://mediacentre.heathrow.com/pressrelease/detail/22074)
- Chile, Santiago SCL (Feb 2026 settlement): a **36-month** extension, the state share drops from 77.56% to 73% during the extension, and a US$323 m+ ICSID claim is dropped **(unverified; pending Contraloría)**. [Emol](https://www.emol.com/noticias/Economia/2026/02/06/1190789/mop-nuevo-pudahuel-acuerdo.html)

### 1.2 Airline collapse

| Carrier | Share lost | Effect | Source |
|---|---|---|---|
| Kingfisher (stopped 20 Oct 2012) | 16.7% (Oct 2011) → 3.5% (Sep 2012) over ~12 months | India domestic CY2012 **-3.04%** (60.7 → 58.8 m), ending ~3 years of growth. Parliament blamed the slowdown, ATF-driven fares and Kingfisher | [Lok Sabha](https://eparlib.nic.in/bitstream/123456789/647095/1/146374.pdf), [CAPA](https://centreforaviation.com/news/indias-domestic-pax-numbers-down-12-to-4-million-in-sep-2012-182092) |
| Jet Airways (last flights night of 17 Apr 2019; suspension dated 18 Apr) | ~**14%** of industry capacity | Apr 2019 domestic 10.99 m (**-4.2%**). Jan-Apr growth 2.5% vs 24.6%. Fares +30-40% (Mar 2019 vs Sep 2018) | [ICRA via Devdiscourse](https://www.devdiscourse.com/article/business/535081-de-growth-in-domestic-traffic-due-to-jet-airways-grounding-icra) |
| Go First (insolvency 2 May 2023; liquidation ordered **20 Jan 2025**) | ~7% (Mar 2023), 8.8% CY22 | Rivals took slots, fares rose. Cause: P&W engine groundings | [Business Standard](https://www.business-standard.com/amp/industry/news/go-first-bankruptcy-seen-helping-rivals-boosting-airfares-in-india-123050300287_1.html), [Business Today](https://businesstoday.in/industry/aviation/story/nclt-orders-liquidation-of-budget-airline-go-first-461388-2025-01-20) |

**Unpaid airport charges:**
- Indian airlines owed AAI **INR 24 bn** overdue in Oct 2020. The Air India group owed about 83% of it (Air India 18.9 bn, Alliance Air 0.97 bn, AI Express 0.13 bn). [ch-aviation](https://www.ch-aviation.com/news/96255-indias-airlines-owe-airport-authority-328mn)
- Kingfisher owed AAI Rs 294.57 cr (Rajya Sabha, 2016), more than Rs 390 cr with penal interest.
- WOW air left Isavia (Keflavík) ISK 2 bn (~EUR 16 m) unpaid. Isavia held a leased A321 under a statutory lien. Go First owed operational creditors Rs 3,856 cr.

### 1.3 Fuel spikes

- **2008:** crude peaked at $147/bbl (11 Jul 2008). US majors cut Q4 domestic capacity 6-14%, and the industry was projected at -11.4% **(unverified)**.
- **2022:** jet fuel averaged ~$136/bbl (+75% YoY). The crack spread peaked at ~**$67/bbl in June 2022**, an all-time high. Fuel was almost **30%** of airline opex. The ~$170/bbl peak is from a secondary source, and the $222 bn extra-bill figure is unverified. [IATA](https://www.iata.org/en/iata-repository/publications/economic-reports/soaring-jet-fuel-prices-now-trending-downward), [IATA fuel fact sheet](https://www.iata.org/en/iata-repository/publications/economic-reports/fuel-fact-sheet)
- Existing key `fuel.atf_shock_multiplier` = 2.15 is the extreme case. A typical spike is ×1.5-1.75.

### 1.4 Interest rates

- RBI repo: low of **4.00%** (May 2020 to Apr 2022). It was hiked to **6.50%** by Feb 2023 (+250 bps in ~9 months).
- It was cut to **5.50% on 6 Jun 2025** (from 6.00%). The previous time it stood at 5.40% was 5 Aug 2022 (corrected). The 2019 path and the Dec 2025 / Feb 2026 moves were not checked. [DT Next](https://www.dtnext.in/news/business/rbi-cuts-repo-rate-by-50-bps-to-55-pc-third-consecutive-reduction-836121)
- Airport debt: DIAL's 2016 USD notes were 6.125%. The rupee refinancing plan was ~9.5% for 15 years **(unverified)**. So rupee debt runs at about repo + 300-450 bps.
- Investment-grade European airport debt (Aena, Jan 2026): 3.6% yield, mid-swaps +78 bp (2023: +90 bp). [Aena](https://www.aena.es/en/press/aena-issues-a-10-year-bond-for-an-amount-of-500-million-euros-with-an---annual-coupon-of-3.5.html)

### 1.5 Airspace and geopolitics

- **India, May 2025 (corrected):**
  - Closures began **7 May 2025**, with 18-27 airports at first. A later NOTAM listed 32 airports until 0529 IST on 15 May.
  - AAI lifted the closure **12 May**, so the effective closure was ~**5 days**. Indian airlines cancelled ~430 flights a day early on. [Tribune](https://www.tribuneindia.com/news/business/temporary-closure-of-32-airports-lifted-following-de-escalation-of-india-pakistan-tensions/amp)
- **Pakistan's ban on Indian aircraft** from 23 Apr 2025, extended monthly **(duration to Apr 2026 unverified)**. Air India put the cost at ~$455-600 m a year, with fuel up to 29% higher and flights up to 3 h longer. [Khaleej Times](https://www.khaleejtimes.com/world/asia/air-india-pakistani-ban-costs-pahalgam-attack)
- **Ukraine 2022:** reciprocal bans. Eurocontrol expects normal routes over Ukraine unlikely before 2029, a ~7-year structural shock. [Eurocontrol](https://www.eurocontrol.int/event/how-airspace-closures-triggered-russian-war-against-ukraine-are-impacting-european-aviation)
- **Eyjafjallajökull 2010:** 100,000+ flights cancelled over ~6 days, 313 airports closed, airline losses ~$1.7 bn, UK airports ~£80 m.

### 1.6 Compound ("hybrid") shocks

Real shocks arrive together. That is what makes them dangerous:
- **2012:** fuel high + slowdown + Kingfisher's slow death → national traffic -3%.
- **2022:** war + fuel spike + RBI +250 bps inside 9 months.
- **2020-23:** pandemic, then a weakened carrier collapsing (Go First, 2023) once the fleet came back.

The game should therefore apply correlation multipliers (section 9.1) rather than independent draws.

---

## 2. Valuation: what a stake is worth

### 2.1 Transaction multiples (EV/EBITDA)

| Deal | Multiple | Status | Source |
|---|---|---|---|
| PwC averages | ~18x (2007-08), ~16x (2009-10), ~22x (2016-18) | stated | [PwC](https://www.pwc.co.uk/transport-logistics/assets/airport-valuations-february-2019.pdf) |
| Gatwick → VINCI 50.01% (Dec 2018) | 19x (Bloomberg) | **unverified**. Confirmed: ~£2.9 bn for 50.01%, 45.7 m pax, FY18 EBITDA £411.2 m | [VINCI](https://www.vinci.com/vinci.nsf/en/press-releases/pages/20181227-0700.htm) |
| Sydney take-private (2022) | ~23-25x | est. (A$8.75 per security, ~A$32 bn EV) | [Milford](https://milfordasset.com/?p=20108) |
| Heathrow minority blocks (2023-25) | ~14x (JP Morgan, **unverified**); ~11.7x on 2023 adjusted EBITDA (est.) | 37.62% for £3,259 m, announced 14 Jun 2024, completed 12 Dec 2024 (Ferrovial 19.75% + co-sellers 17.87%). Ardian ~22.6%, PIF ~15.0%. Feb 2025: last 5.25% for ~£455 m, a flat price per share | [Ferrovial](https://newsroom.ferrovial.com/en/?p=126996) |
| Heathrow EV/RAB | ~1.2-1.31x (est.) | RAB £19,804 m (2023), £20,422 m (2024) | [Heathrow](https://mediacentre.heathrow.com/pressrelease/detail/22074) |
| ANA Portugal (2013) | not on source page | bids: VINCI €3.08 bn, Fraport €2.44 bn, Corporación América €2.41 bn, Zurich €2.0 bn. **Winner +26% over the second bid** | [CAPA](https://centreforaviation.com/news/vinci-selected-to-acquire-ana-following-eur308bn-bid-196984) |
| BIAL (India) | ~10-12x FY26 EBITDA (est.) | Derived: equity ₹21,800 cr (USD 2.55 bn) + net debt ~4x EBITDA, against EBITDA ~₹3,050 cr (₹4,239 cr × ~72%) | `benchmarks.*` |

### 2.2 The Indian stake ladders (the template for the 64 → 80% climb)

**BIAL / Fairfax (corrected):**

| Date | Block | Price | Implied 100% |
|---|---|---|---|
| 24 Mar 2017 | **38%** (33% from GVK + 5% from Flughafen Zürich, USD 48.9 m) | INR 25.22 bn (~USD 385 m) | ~USD 1.0 bn |
| 13 Jul 2017 | 10% from GVK (38 → 48%) | USD 200 m. Internal fair value ~USD 123 m; the ~USD 77 m gap was expensed | ~USD 2.0 bn |
| 2018 | 6% from Siemens | USD 67 m **(unverified)** | ~USD 1.1 bn |
| Jun / Dec 2023 | 3% + 7% from Siemens (the 7% conditional on performance) | USD 75 m + 175 m **(unverified)** | ~USD 2.5 bn |
| Dec 2024 | 10% from Siemens (64 → 74%) | USD 255 m in three instalments: at close (Q1 2025), ~31 Aug 2025 and 31 Jul 2026 | USD 2.55 bn |

- AAI and KSIIDC hold 13% each, and the concession runs to 2068. [Fairfax 2017](https://fairfaxindia.ca/wp-content/uploads/FIH-PR-March-24-2017-FAIRFAX-INDIA-ACQUIRES-38-OF-BANGALORE-INTERNATIONAL-AIRPORT-LIMITED.pdf), [Fairfax Q2 2017](https://fairfaxindia.ca/wp-content/uploads/2017-Q2-Press-Release-FIH-Final.pdf), [Fairfax Dec 2024](https://www.fairfaxindia.ca/wp-content/uploads/2024/12/2024_12_December_03-PRFIH-Acquisition-of-Additional-Interest-in-BIAL.pdf)
- Lessons:
  - The implied value grew **2.55x in ~8 years** (~12% a year in USD) as the track record built.
  - The premium for the path to control sat on **one block** (+63% over fair value), not on the whole 48%. The whole 48% cost ~USD 585 m against ~USD 591 m fair value.
  - Late blocks were paid in instalments or made conditional on performance.

**GMR-ADP (Feb 2020):**
- 49% for Rs 10,780 cr: base post-money ₹22,000 cr.
- Plus an earn-out of up to **Rs 4,475 cr (~20%)**, paid over 5 years on performance metrics and regulatory clarifications. The first tranche was Rs 5,248 cr.
- GMR kept management control. [Aviation Pros](https://www.aviationpros.com/airport-business/airport-infrastructure-operations/news/21126494/group-adp-to-pick-up-49-in-gmr-airports-limited)

**MIAL (2019):**
- Bidvest's 13.5% sold for Rs 12.48 bn at **Rs 77/share** (~Rs 95 bn for 100%).
- GVK (50.5%) exercised its **right of first refusal (ROFR)** at the same price. GVK's claimed value of ~Rs 11,200 cr was not found in the source.
- GVK later lost control through debt conversion. [Airport Technology](https://www.airport-technology.com/news/adani-group-mumbai-airport/)

**Galeão (2025, corrected):**
- TCU approved a new contract: a variable 20% of revenue replaces the fixed fee (~BRL 1.3 bn a year), and the third runway is dropped.
- Changi buys Infraero's 49% (~BRL 932.8 m) **only if no other bidder appears** in a simplified share auction. The deal also ends ~BRL 8 bn of disputes. [Panrotas](https://www.panrotas.com.br/aviacao/aeroportos/2025/06/tcu-aprova-novo-contrato-para-o-galeao-rj-e-garante-permanencia-da-changi_218228.html)

### 2.3 Premiums and life

- **Control premium:**
  - Airport data: Sydney ~15% over its pre-pandemic multiple (Kroll, **unverified**); BIAL's control-path block +63% (verified).
  - Generic M&A: 20-40%. Minority discount = 1 − 1/(1 + premium).
- **Remaining life:** an asset with N years left is worth about 1 − 1.075^−N of a perpetuity (est.):

  | Years left | 55 | 45 | 35 | 25 | 15 | 10 | 5 | 2 |
  |---|---|---|---|---|---|---|---|---|
  | Factor | 0.98 | 0.96 | 0.92 | 0.84 | 0.66 | 0.52 | 0.30 | 0.14 |

- **Fresh primary equity:** Adani Airport Holdings raised ~USD 1 bn at ~USD 18 bn pre-money (2026) **(unverified secondary source)**.

---

## 3. Handback (expiry by efflux of time)

The Indian Model Concession Agreement (MCA) template, verbatim in the NITI draft ropeway MCA. **Caveat: this is a ropeway MCA**, but airport, highway and port MCAs come from the same template family. [NITI MCA](https://www.niti.gov.in/sites/default/files/2020-02/DRAFT-ModelConcessionAgreement-for-Setting-upPassengerRopewayProjects-underPublicPrivatePartnership.pdf)

| Clause | Rule |
|---|---|
| 39.3.2 | The parties exchange operating information **9 months before** the Transfer Date. The concessionaire advises the Authority or new operator for **6 months after** it. |
| 40.2.2 | The Independent Engineer (IE) inspects **210-180 days before** Termination and can raise the retention amount and period. |
| 39.2 | The IE verifies Maintenance Requirements **90 to 15 days before** transfer. Tests and cures are at the concessionaire's cost. |
| 40.2.1 / 40.2.3 | **5% of the last year's Realisable Fee** is held in escrow for 120 days. A bank guarantee can replace it. |
| 40.1 | Defects liability lasts **120 days** after Termination, with a 15-day cure. After that the Authority repairs at the concessionaire's cost from escrow. |
| 17.8.1 | Damages for an uncured maintenance defect: the higher of **0.5% of the Average Daily Fee or 0.1% of the repair cost, per day**. |
| 17.9.1 | If the Authority does the work itself: **cost + 20%**. |
| 39.6.1 | The Authority pays stamp duty; all other divestment costs fall on the concessionaire. |

Other handback rules:
- **Ports MCA 2018:**
  - Assets are handed over free of cost, with no compensation at expiry.
  - Delaying the transfer costs liquidated damages per day equal to the **average daily profit of the last 3 years**.
  - Authority default pays Debt Due + 150% of Equity. [Shipping Ministry](https://www.shipmin.gov.in/sites/default/files/FinalMCA17012018-18610118.pdf)
- **Brazil, ANAC Nordeste 2019 (unverified):**
  - Assets revert free with no indemnity and must keep operating **≥24 months** after reversion.
  - The demobilisation plan is due 2 years before the end.
  - **20%** of the performance bond is held for 24 months after the term.
- **US-36 P3 residual life at handback (unverified):**
  - Pavement **10 years**, with ≥85% of sections above 10 years and none below 7.
  - Structures 25 years; systems 10 years.
- **Handback reserves (unverified):**
  - US P3 reserves are funded from the **5th year before** expiry, at about 2-5% of revenue.
  - The UK IPA advises preparing **≥7 years** before expiry.
- **Renewal precedents:**
  - DIAL/MIAL are 30 + 30. The CAG says the extension is unilateral; the "no default in years 20-24" condition is **unverified**.
  - Hyderabad's extension to 22 Mar 2068 was confirmed in May 2022, **~16 years before** first-term expiry (verified).
  - Newer AAI airports have a single 50-year term.
  - NAIA (Manila) is 15 + 10, with a performance review after year 8 **(unverified)**.

---

## 4. Termination and distress

- **India termination payments** (existing keys `finance.termination_*`):
  - Concessionaire default: ~90% of Debt Due (80% for the Delhi Airport Metro), equity 0.
  - Authority default: 100% of Debt Due + 130-150% of Adjusted Equity.
- **DAMEPL (Delhi Airport Metro):**
  - The concessionaire sent its termination notice on **8 Oct 2012**, citing structural defects, and handed over in 2013.
  - It won an award of ~USD 960 m, upheld in 2021. The Supreme Court then **annulled it by curative review on 10 Apr 2024**.
  - Lesson: a termination payout is a decade-long gamble. [Linklaters](https://www.linklaters.com/insights/blogs/arbitrationlinks/2024/june/indian-supreme-court-annuls-arbitral-award-by-exercising-extraordinary-power-of-curative-review)
- **Lender substitution (step-in):**
  - Done through a tripartite agreement, with a Swiss Challenge auction for the rest of the term.
  - Highway precedent: Chhapra-Hajipur 2025, anchor bid Rs 135.99 cr. No Indian airport case exists.
  - Existing keys: `finance.lender_substitution_days`.
- **Viracopos (Brazil), the overbid failure:**
  - It won in 2012 with a fixed fee of BRL 3.821 bn against ~BRL 9 bn of capex.
  - It entered judicial recovery owing **BRL 2.88 bn** (2.71 bn to financial creditors). The filing month of May 2018 is unconfirmed.
  - The plan was approved on **14 Feb 2020** with 99.9% of votes, including ANAC's, and committed the concessionaire to request relicitação (friendly re-tender) within 15 days. The proceeding closed 10 Dec 2020.
  - The relicitação then stalled. TCU set a final deadline of 2 Jun 2025, the indemnity of ~BRL 2.5 bn went into dispute, and the incumbent still operates **(unverified)**.
- **Brazil's relicitação law, Lei 13.448/2017 (unverified):**
  - 24 months, extendable once by up to 24 more.
  - Capex is frozen but service continues.
  - Holders of ≥20% are barred from re-bidding.
  - Indemnity = unamortised reversible assets − fines and unpaid fees. The state covers any gap.
- **São Gonçalo do Amarante (Natal):**
  - Indemnity BRL 554.55 m **(unverified)**.
  - Zurich won the re-auction with BRL 320,000,012 on 19 May 2023, **41% over the reserve** of BRL 226.9 m. The runner-up bid only ~BRL 1 less.
  - Contract signed 12 Sep 2023, about 3 years from the handback request to a new operator. [Mercado e Consumo](https://mercadoeconsumo.com.br/19/05/2023/noticias/zurich-airport-arremata-leilao-de-relicitacao-de-aeroporto-no-rn-por-r-320-mi-agio-e-de-41/)
- **NAICM, Mexico 2018 (unverified):**
  - Political cancellation. The cost was put at MXN 113-332 bn, depending on who counted.
  - Bondholders were bought back at par, and a covenant now bars any new airport within 70 km.

---

## 5. How other regulators set prices

| Regime | Fact | Source |
|---|---|---|
| UK CAA, H7 (Heathrow) | Vanilla WACC **2.64-3.73%, point 3.18%** (RPI-real). Post-tax cost of equity **5.59-8.32%** (8.32% is the top of the range). Equity beta 0.95-1.47, gearing 60%. | [CAP2524D](https://www.caa.co.uk/publication/download/20193) |
| H7 per-pax cap | 2023: £31.57 (holding cap; underlying £31.32). Forecast £25.43 / 25.24 / 25.28 for 2024-26. 2024 outturn £26.78. After the CMA remittal (proposal 20 Mar 2024): £23.72 / 23.70 for 2025-26, cutting the revenue reduction from ~£390 m to ~£250 m (**~£140 m less clawback**). | [CAA](https://caa.co.uk/newsroom/news/regulator-proposes-changes-to-heathrow-airport-limited-s-airline-charges-in-response-to-cma-appeal) |
| CMA appeal (Oct 2023) | 4 appellants. The CAA was "not wrong" on almost everything. **3 narrow grounds upheld**, with a small price effect. | CMA summary |
| Dublin | Final Decision **Apr 2023**. Draft caps €8.68 / 8.60 / 8.29 / 8.48 (average €8.52). The final €7.59 average is **unverified**. | [IAA](https://www.iaa.ie/media/car-news-archive/2023/04/21/final-decision-on-the-maximum-levels-of-airport-charges-at-dublin-airport-2023-2026) |
| Australia (light touch) | Sydney aero profit A$570.5 m in FY24, **20.2%** return on aero assets (inflated by back-payments). Brisbane A$194.7 m, Melbourne A$198.9 m, Perth A$70.7 m. | [iTWire/ACCC](https://itwire.com/government-tech-news/technology-regulation/airports-report-record-aeronautical-revenues-despite-slower-growth-in-passenger-numbers) |
| Singapore CAAS | A hybrid-till per-pax cap since 2009. The 4th regulatory period runs ~12 years (FY25/26-FY36/37) **(unverified)**. | CAAS |
| India TDSAT, 1 Jul 2025 | Ordered a **single till** for DIAL/MIAL's first control period (2009-14), the Hypothetical RAB back-solved, and a recompute within 12 weeks: **~13 years after** the orders. The ₹50,000 cr burden and the Supreme Court appeal are **unverified**. | [Cyril Amarchand](https://corporate.cyrilamarchandblogs.com/2025/08/tdsat-redefines-aeronautical-tariff-setting-in-indian-airports/) |
| India appeals | TDSAT mostly upheld AERA until 2025. Since 18 Oct 2024 the Supreme Court has allowed AERA itself to appeal TDSAT orders. | [LiveLaw](https://www.livelaw.in/amp/top-stories/supreme-court-upholds-maintainability-of-appeals-filed-by-airports-economic-regulatory-authority-against-orders-of-tdsat-on-tariff-imposition-272836) |

---

## 6. Revenue benchmarks (the world)

- **Non-aero share:** 36.7% worldwide (2023). Its mix: parking 24, retail 21, property 16, car rental 7, F&B 6, other 26. Retail is the largest line in Asia-Pacific (35%). [ACI](https://blog.aci.aero/airport-economics/maximizing-non-aeronautical-revenues-key-to-airport-financial-sustainability/)
- **EBITDA margins:**

  | Operator | Margin | Note |
  |---|---|---|
  | VINCI Airports 2024 | 63.7% | |
  | Aena 2024 | 60.2% | 80% payout |
  | Heathrow 2024 | ~57% | |
  | Changi FY24/25 | ~48% | est. |
  | Groupe ADP 2024 | ~34% | includes handling. €3/share dividend floor; Paris retail EBITDA €735 m includes a €50 m tax and a €35 m one-off, +5.8% excluding them |
  | Fraport 2024 | **~33%** | excluding IFRIC 12 construction revenue (€3.89 bn base). 6.4x leverage, FCF −€674.7 m, no dividend during the T3 build |

- **Per passenger:**
  - Aena: aero ~€10.3, commercial ~€5.8 (the "€5.75 in December 2024" figure is not on the source page).
  - Heathrow: commercial £11.36. Its per-pax income fell ~2% a year while absolute income grew.
  - Fraport: net retail €3.35.
  - Spend per departing passenger: ADP €32.1 (Paris), Dubai Duty Free ~USD 42 (est.).
- **Equity return expectations:**
  - Developed-market core-plus infrastructure: 8-10% net.
  - India: 12.4-17.3% (`finance.equity_irr_benchmark`).

---

## 7. Incident costs (closures and mid-level incidents)

| Incident | Duration / scale | Cost (source currency → INR est.) | Who pays | Source |
|---|---|---|---|---|
| Drone sighting, Gatwick 2018 | runway closed **33-36 h**; >1,000 flights; ~140k pax | Airport ≥£20 m lost revenue (spokesman, est. → ~₹230 cr). Counter-drone kit ~£5 m (~₹58 cr). easyJet £15 m (~£37k per cancelled flight incl. EU261) | airline mostly | [ITV](https://www.itv.com/news/2019-01-22/easyjet-takes-15m-hit-from-gatwick-drone-chaos), [IFSEC](https://www.ifsecglobal.com/drones/gatwick-airport-spends-5m-anti-drone-tech-christmas-chaos-cost-20m-lost-revenue/amp/) |
| Grid substation fire, Heathrow 2025 | **10 h** suspension; >1,400 cancellations; ≥250k pax | Airlines claimed up to £100 m. Heathrow Q1 revenue still +2.1% (£825 m); pax −1.6% | airline (claims) | [Airport World](https://airport-world.com/heathrow-on-target-for-good-2025-despite-q1-traffic-dip/) |
| Fault known 7 years before the fire | latent risk | the Kelly review followed **(unverified)** | — | Euronews |
| Hull loss on runway, SFO 2013 | that runway closed **~6 days**; adjacent runway >24 h | repair + investigation | airport/insurer | [SF Examiner](https://www.sfexaminer.com/news/sfo-runway-reopens-after-fatal-asiana-airlines-crash/article_e5aae990-4e33-521c-aa5b-0880511304e4.html) |
| Fatal accident with an airport-side hazard (Muan 2024) | single-runway airport closed **~3 years** (to late 2027). Partly works and consolidation, not only the accident | catastrophic | airport | [Wikipedia](https://en.wikipedia.org/wiki/Muan_International_Airport) |
| Diversion (per flight) | — | EUR 55k narrow-body (LCC: €40k of it EU261; mainline: €27k); wide-body €82k (€32k EU261); regional €15k. **India without EU261 ≈ half**: ~₹15-28 L narrow, ~₹50 L wide | airline | [EUROCONTROL SI 10.0.2](https://standard-inputs.netlify.app/chapters/cost_of_diversion.html) |
| IT outage (CrowdStrike, Delta 2024) | ~7,000 cancellations over 5 days; day 1: **3.9%** of global flights | ~$550 m gross (~$78.6k per cancellation) | airline | [Business Insurance](https://www.businessinsurance.com/delta-rejects-crowdstrike-criticism-sees-500-million-hit-from-cyber-outage/) |
| Fuel pipeline rupture, Auckland 2017 | **30%** of fuel uplift for 10-15 days; >100 cancellations | Fixes considered: on-site storage NZ$100-150 m (~₹520-780 cr) or a second pipeline NZ$220 m **(unverified)** | airport/supplier | NBR |
| Bird strikes (US) | 19,603 in 2023 (revised 19,628); 22,372 in 2024 **(unverified)**. ~7% cause damage (2008) | ~$90k direct damage per damaging strike (~₹79 L) **(unverified)** | airline | [FAA](https://www.faa.gov/airports/airport_safety/wildlife/wildlife-strike-report-1990-2023-USDA-FAA) |
| ATC strikes (EU) | throughput cap over several days | ~€1.4 bn a year to the EU economy **(unverified)** | pass-through | A4E |
| Regulator capacity cut, Mumbai 2024 | **46 → 44** movements an hour in peak hours; order dated 15 Feb 2024, effective 20 Feb, for "excessive slot allocation and poor slot adherence" | lost slots | airport | [100knots](https://www.100knots.com/flight-delays-at-mumbai-down-after-government-cuts-capacity/) |
| Volcanic ash, Europe 2010 | **~6 days** of total closure | UK airports ~£80 m | both | USGS / Wikipedia |

---

## 8. Long-run traffic, capacity and competition (India)

- **FY25:** 412.09 m passengers (334.70 m domestic + 77.38 m international, **~19%** international), +9.5%.
- **Forecasts:**
  - Boeing: South Asia ~7% a year to 2044 **(unverified)**.
  - Airbus: India domestic 8.9% (single secondary source) and 6.2% (2022).
  - Government: ~500 m by 2030 and ~1 bn by 2047, which implies **only ~4% a year** from FY25 (my derivation).
  - The NMIA CEO sees growth tapering to ~5.6% by 2044 **(unverified)**.
  - Global: 3.6% a year.
- **Competing airports:**
  - MoCA targets ~350 airports by 2047 (from ~160).
  - Delhi has a **150 km** ROFR, verified. The Hindon petition got notice on 17 Mar 2025. The "10% match window" is **not** in the cited source for DIAL, though Noida's ROFR within 10% is in `ppp.concession_terms`.
- **Lead times:**
  - Noida: concession to opening **4.7 years** (Oct 2021 → 15 Jun 2026), ~1.5-2 years late.
  - Navi Mumbai: signing to opening **~8 years**, ~6 years late.
  - Delhi's 4th runway opened **13 months** late; airside capacity is 140 mppa against 100 mppa of terminal.
- **Expansion trigger:** Noida's next phase starts at **80%** of phase capacity, as reported in the press **(unverified contract)**. Its later runways are tied to 30 / 50 / 70 mppa.
- **Ramp-up:** Navi Mumbai handled 109,917 pax in its first 19 days and ~0.39 m in about 4 months. It targets >1 m a month by about month 11.
- **Saturation:** Mumbai handled 55.5 m pax in 2025 against ~55 mppa of capacity, and airlines could not get slots.
- **Hub transfer share:** Delhi's transfer share rose from ~20% (May 2025) to **27%** (May 2026); transfers rose from 15.6 m to 20.3 m between FY23 and FY25.

---

## 9. How the game uses this

All values below are in `money.json → world.game_*`. Probabilities and sizes are **game estimates calibrated to the history above**, not sourced facts.

### 9.1 Shocks: one draw per era at the board meeting

| Shock | p per era (base) | First era | Size | Duration | Player levers | Basis |
|---|---|---|---|---|---|---|
| **Pandemic** | 0.06 (max 1 per concession; ~52% chance over 12 eras) | 2 | Traffic multiplier by year: domestic **[0.35, 0.60, 0.88, 1.00, 1.05]**; international **[0.20, 0.30, 0.60, 0.90, 1.00]**; transfer hub ×0.85 extra in year 1. Era average ≈0.78 domestic, ≈0.60 international | 4-5 years | **Force majeure claim**: if won, the revenue share is excused for ~23.5 months and the term extended by the same. Resolved **next era** at p = 0.65; AAI contests. Regulator RAB uplift = 10-15% of lost ARR. Dividend lock 1 era | S1-S5, MIAL FM, Heathrow £300 m |
| **Base-carrier collapse** | 0.45 | 2 | −(carrier share, 7-15%) of movements at once; rivals recover **80%** of it over 6-12 months. Fares +30% for 6 months, demand −3%. Receivable write-off = **2-4 months** of that carrier's aero billing | 1-2 years | Security deposit or credit limit per airline (cuts the write-off by 75%, but the airline's goodwill −); seize a parked aircraft (lien; p = 0.3 lessor lawsuit) | Kingfisher, Jet, Go First, AAI dues |
| **Slow death** (precursor) | — | — | The carrier's share falls ~50% over the previous era before the collapse: a visible warning | 1 era | Cut exposure early | Kingfisher 16.7 → 3.5% |
| **Fuel spike** | 0.35 | 1 | ATF ×1.5 (typical) to ×2.15 (extreme). Airline capacity −6 to −14% within 2 quarters. Airlines resist aero increases | 6-18 months | Fuel-farm storage; hold tariffs | 2008, 2022 |
| **Rate spike** | 0.30 | 1 | +150 to +250 bps on floating debt | 2-3 years | Fix or refinance when rates are low; DSRA | RBI +250 bps / 9 months |
| **Rate fall** | 0.30 | 1 | −100 to −150 bps; a refinancing window | 2-3 years | Refinance (`finance.refi_rate_after_stability`) | RBI 2019-20, 2025 |
| **Regional airspace closure** | 0.25 | 1 | Northern/western airports shut **5 days**; ZMI (central India) **gains** diversions | 5 days (one shift set piece) | Handle diversions for fees | Sindoor May 2025 |
| **Long overflight ban** | 0.12 | 2 | Westbound long-haul: fuel +29%, +3 h; widebody international −10% | 1-2 eras | Lobby; Gulf-routing partner | Pakistan 2025; Ukraine (7 years) |
| **New rival airport** | 0.25 (≥ era 3) | 3 | Announced in era N, opens in era N+1 (30%: N+2). Takes **5-10%** of ZMI's O&D LCC point-to-point traffic, ramping 50/80/100% over 3 years. Transfer traffic untouched | permanent | ROFR clause, bought at onboarding: match the bid and own it | Noida 4.7 years, NMIA 8 years, 150 km ROFR |
| **Regulatory regime shock** | 0.12 | 3 | One of: single-till ruling (till share 0.3 → 1.0 for one recompute); tariff reset −20%; WACC review ±100-150 bps | 1 era | Appeal (9.4) | TDSAT 2025, H7 −19.5%, H8 |
| **Political cancellation** | 0.0 | — | Not used (the airport is built and operating); flavour only | — | — | NAICM |

**Compound multipliers (the "hybrid" shocks):**
- Fuel spike this era → carrier collapse p ×1.6 next era (2012).
- Pandemic → carrier collapse p ×1.5 next era (Go First 2023).
- Fuel spike and rate spike are drawn together with p = 0.5 (2022).
- Cap: at most 2 negative shocks per era.

**Valuation market cycle:** each era draws a market state:

| State | p | Multiple adjustment |
|---|---|---|
| crisis | 0.15 | −2x (PwC 18 → 16) |
| normal | 0.6 | 0 |
| boom | 0.25 | +3x (2016-18 at 22x) |

### 9.2 Stake sale and stake purchase pricing

**Enterprise value:**

`EV = EBITDA_lastEra × multiple × lifeFactor`, where:
- `multiple = 12 + growthPrem + trackPrem + regPrem + marketAdj`, clamped to **8-24x**.
  - Base 12x = India's BIAL ~10-12x and Heathrow ~11.7-14x for a mature regulated hub.
  - `growthPrem` = +1x per pp of 5-year traffic CAGR above 3%, capped at +6.
  - `trackPrem` (track record): +0.5x per 3-star era in the last 3 eras (max +1.5); −2x if DSCR < 1.1 in the last era; −2x if a fatal or hull-loss event happened in the last 2 eras.
  - `regPrem` (regulatory stability): −3 to +3, from accepted versus disputed AERA orders and the outcomes of regime shocks.
  - `marketAdj`: from the market cycle (9.1).
- `lifeFactor = 1 − 1.075^−yearsLeft`. Era 1 ≈ 0.98, era 6 ≈ 0.89, era 10 ≈ 0.52, era 12 ≈ 0.30.
- Cross-check: EV/RAB should land between 1.1x and 1.4x; warn in QA if it falls outside.

**Equity value:** `equity = EV − netDebt`. The price per % of equity is `equity/100`, then adjusted for the block:

| Block type | Adjustment | Basis |
|---|---|---|
| Ordinary minority block | ×1.00 (fair value) | Heathrow blocks flat; BIAL 2018 |
| Block that takes the parent across **75%** (special-resolution control) | **×1.35** (range 1.15-1.63) | Sydney +15%; BIAL control path +63% |
| Distressed or forced seller (partner DSCR < 1, or partner shock event) | ×0.85 (range 0.80-0.90) | GVK |
| Player selling when the parent is distressed | ×0.85 | — |
| Player selling a minority block to a strategic investor | ×1.00, but up to **20%** can be structured as an earn-out paid at the next era's end if KPIs are met (OTP ≥ target, no DSCR breach) | GMR-ADP 20% |
| Large block (≥10%) | can be paid in **3 instalments** over ~1.5 years (the first at close) | BIAL Dec 2024 |

**The 64 → 80% climb:**
- The partner (16%) offers **2-10% blocks**, at most one per era, from era 3 onward. Offer probability is 0.5 per era, rising to 0.8 if the partner is under its own stress.
- If the partner tries to sell to an outsider, the player has a **ROFR match window** (one board decision) at the same price. If the player declines, a rival enters the SPV (a board seat, and it vetoes dividends above 60% payout).
- The state's 20% (AAI 10, MADC 10) is never for sale.
- The equity lock-in still applies (`finance.equity_lockin`): the lead must keep ≥51% until COD + 7 years.

**Player selling down:**
- Allowed down to 51%.
- A primary raise (new shares) dilutes everyone pro rata (the Adani 2026 template). Price it at equity value ×0.95, a new-money discount (est.).

**Benchmark line for the debrief:** "BIAL's 100% equity was worth USD 1.0 bn in 2017 and USD 2.55 bn in 2024 (2.55x in 8 years)."

### 9.3 Handback (era 12) and inspection scoring

| When | Event |
|---|---|
| Era 11 start (T − 10 y) | **Handback survey**: the Independent Engineer (IE) publishes each asset's residual life. UK IPA: start ≥7 years out. |
| Era 11 end (T − 5 y) | **Handback reserve** opens: sweeps **3%** of revenue each year (range 2-5%) until the residual-life gap is funded. It ranks after senior debt in the waterfall. |
| Era 12, T − 2 y | **Demobilisation plan** prompt (ANAC). |
| T − 9 months | Operating information handed over (MCA 39.3.2). |
| T − 210 to 180 days | IE pre-inspection: sets the retention (MCA 40.2.2). |
| T − 90 to 15 days | Final verification; cures at the player's cost (MCA 39.2). |
| Transfer | Assets handed over free, with **no compensation**. A delayed transfer costs **3-year average daily profit per day**. |
| T + 120 days | Defects liability period; retention held. |
| T + 6 months | Advisory epilogue (MCA 39.3.2). |
| T + 24 months | 20% of the performance bond is released (ANAC). |

**Asset register and thresholds** (residual life required at transfer; US-36 thresholds stretched by the ANAC 24-month floor):

| Class | Weight | Threshold |
|---|---|---|
| Runways, taxiways, aprons | 0.30 | 10 years; ≥85% of sections compliant and none below 7 years |
| Terminal and satellite structures | 0.25 | 25 years |
| Systems (baggage, AGL, IT, power, APM) | 0.25 | 10 years |
| Safety (ARFF, fire, security screening) | 0.10 | 10 years; all units operable |
| Landside and utilities | 0.10 | 10 years |

**Score:** `handbackScore = Σ weight × compliantShare`, from 0 to 100.

**Money:**
- **Retention** = 5% of last-year revenue. ×1.5 if the IE pre-inspection score is < 85; ×2 if < 70.
- **Defects found** in the defects liability period cost repair × 1.2 (MCA 17.9.1), taken from the retention.
- **Open defects** cost 0.5% of average daily revenue per day open (MCA 17.8.1).

| Band | Score | Outcome |
|---|---|---|
| Exemplary | ≥95 | Retention fully returned + reputation bonus in the score |
| Compliant | 85-95 | Retention returned less repairs × 1.2 |
| Deficient | 70-85 | Half the retention forfeited + repairs × 1.2 |
| Failed | <70 | All the retention forfeited + 20% of the bond drawn + a "handback dispute" debrief line |

**Decay hook:** deferring maintenance in early eras raises later incident probability ×1.5, because the Heathrow fault had been known for 7 years. Every deferred rehab (`costs.runway_rehab_cr`) also reduces residual life.

### 9.4 Appeals against AERA orders

- **Cost:** legal fees of 0.2% of one era's ARR (est.).
- **Odds:** 20% to win (range 15-25%), based on TDSAT's pre-2025 record and the CMA's 3 narrow wins.
- **Effect of a win:** the tariff moves toward the claim by **25%** of the gap. The CMA wins were small, but the TDSAT 2025 ruling shows a big win can arrive late.
- **Delay:** decided **1 era** later, with a 30% chance that AERA appeals on to the Supreme Court and adds another era.
- **Rare jackpot:** a single-till or HRAB-type back-recovery has p = 0.05, paid as a UDF uplift for one era.
- **True-up:** over- or under-recovery against forecast is clawed back next era. The Heathrow 2024 outturn was +5.3% over forecast.

### 9.5 Termination triggers (game over or a branch)

| Trigger | Consequence | Payout |
|---|---|---|
| DSCR < 1.0 for 2 consecutive eras (`game.dscr_thresholds`) | Lender **step-in**: notice 15 d, cure 180 d, +90 d. Substitution by Swiss Challenge auction | Player equity 0; lenders recover 90% of Debt Due |
| Phase-expansion obligation missed (9.7) by 1 era | Regulator warning; 2 eras → default notice | as above if uncured |
| Fatal accident with an airport-side hazard and handback score < 70 at the next IE check | Default notice | as above |
| Unpaid revenue share (fee arrears > 1 year) | Default | as above |
| **Authority default** (state breaks the ROFR, a political shock, a wrongful single-till recompute it refuses to compensate) | Player may terminate | **100% Debt Due + 150% Adjusted Equity** (existing key). Payment arrives after 1-2 eras at p = 0.6, and can be annulled (DAMEPL) |
| **Voluntary handback** (relicitação-style) | 24-month clock (+24 once); capex frozen | Indemnity = unamortised book value − fines and arrears. Paid late: 1 era later at p = 0.7. Re-auction clears at **~0.6x** the indemnity (320 vs 555); the state covers the gap |

### 9.6 Endgame benchmarks (year-60 debrief)

| Measure | Benchmark | Bands |
|---|---|---|
| Parent equity IRR (INR, nominal) | India 12.4-17.3%, target 15.5% (`finance.*`). Developed-market infrastructure 8-10% net. H7 cost of equity top 8.32% real | <8 fail · 8-12.4 weak · 12.4-15.5 solid · 15.5-17.3 strong · >17.3 exceptional |
| Peak equity valuation | BIAL ₹21,800 cr (USD 2.55 bn); GMR Airports ₹22,000 cr (2020); Adani Airports ~USD 18 bn (2026, unverified) | show as a ratio to BIAL |
| EBITDA margin at maturity | VINCI 63.7%, Aena 60.2%, Heathrow ~57%, BLR ~72%, DEL 37% | good ≥ 55% |
| Dividend payout | Aena 80%, ADP 60%, Heathrow 0 for 5 years after COVID, Fraport 0 in its build era | — |
| Leverage | Fraport 6.4x in its build era; covenant ≤ 5.0x (`finance.net_debt_ebitda_cap`) | — |
| Handback score | 9.3 | — |
| Debt repaid | yes or no | — |
| Safety and stars | from shifts | — |

**Score weights (est.):**

| Component | Weight |
|---|---|
| IRR | 35 |
| Handback | 20 |
| Total dividends / equity invested | 15 |
| Peak valuation | 10 |
| Safety | 10 |
| Stars | 10 |

Debt not repaid caps the grade at "weak".

### 9.7 Traffic growth per era and the phase-2 trigger

**Organic growth** (national market, applied on top of the level migrations):

| Era | Years | CAGR | Era factor | Cumulative |
|---|---|---|---|---|
| 1 | 2026-31 | 7.0% | 1.40 | 1.40 |
| 2 | 2031-36 | 6.5% | 1.37 | 1.92 |
| 3 | 2036-41 | 6.0% | 1.34 | 2.57 |
| 4 | 2041-46 | 5.5% | 1.31 | 3.36 |
| 5 | 2046-51 | 5.0% | 1.28 | 4.29 |
| 6 | 2051-56 | 4.5% | 1.25 | 5.35 |
| 7 | 2056-61 | 4.0% | 1.22 | 6.50 |
| 8 | 2061-66 | 3.5% | 1.19 | 7.72 |
| 9 | 2066-71 | 3.0% | 1.16 | 8.95 |
| 10 | 2071-76 | 2.75% | 1.15 | 10.26 |
| 11 | 2076-81 | 2.5% | 1.13 | 11.60 |
| 12 | 2081-86 | 2.5% | 1.13 | 13.13 |

- Bull scenario: +1.5 pp (Airbus 8.9%). Bear scenario: −2 pp (the government path ≈4%).
- Check: 412 m × the factors gives ~1.1 bn by 2046, consistent with "~1 bn by 2047".
- International share starts at 19% and rises +2 pp per era to a cap of 35%.
- Transfer share starts at **12%** and caps at **27%** (Delhi May 2026). It is gated on a home-carrier widebody bank.

**Capacity:**
- Phase 1 is 70 mppa (`capex.zmi_phase1_mppa`), the full build 209, and phase 2 (satellites G and H) **260**.
- Above **95%** utilisation, demand spills to rivals and delay penalties apply (Mumbai 2025).
- Slots: 44 movements per runway-hour (design.md; Mumbai 44-46). The regulator **cuts 2 slots an hour** if on-time performance (OTP) < 70% for an era (Mumbai 2024).
- Saturation: with Delhi's traffic in by year 14 (~225 m), organic growth fills 260 mppa during **era 4-5**. After that, value comes from yield (non-aero per pax, transfer mix), not volume. This is real (Heathrow, Mumbai) and is the late-game shape.

**Phase-2 trigger and the build:**
- **Trigger:** at an era end, annual pax ≥ **80%** of declared capacity (Noida). This creates an **expansion obligation**: commission the next phase within 1 era.
- **Cost:** 51 mppa × ₹275 cr = **₹14,025 cr**, plus ₹1,950 cr per runway if one is needed (existing capex keys).
- **Build time:** 1 era. There is a 30% chance of a +1 year slip (Delhi R4, +13 months). Land or environmental delay: 10% chance of +1 era (NMIA).
- **Ramp-up:** new capacity fills 55% in year 1, 85% in year 2 and 100% in year 3 (NMIA).
- **Early option:** the player may build phase 2 at the 70% trigger, at ×1.0 cost, for ahead-of-demand OTP gains.

### 9.8 Incident cost table (shift and era scale)

Incidents are drawn per shift. Routine ones are automated (see the ZMI incident feedback); only the trade-offs are surfaced.

| Incident | p per era (base) | In-shift effect | Era money (airport) | Resilience buy |
|---|---|---|---|---|
| Drone sighting | 0.30 | all runways stop for 20-40 shift-minutes (real 33-36 h scaled) | lost revenue = hours × hourly revenue × 0.7 (30% recaptured) | counter-drone kit **₹58 cr**: duration −60% |
| Grid or substation failure | 0.20 | full stop for 1 shift segment (real 10 h) | revenue pro rata + airline claims = 1.5 × the airlines' lost-flight cost (goodwill) | second feed / switchover **₹150-250 cr** (est.): duration −80% |
| IT outage (global) | 0.25 | 4% of movements cancel on day 1; −10% throughput for 3 days | small; goodwill | — |
| Fuel supply interruption | 0.15 | 30% fuel uplift for 10-15 days: long-haul departures capped | lost widebody movements | on-airport storage **₹520-780 cr**: cap removed |
| Hull loss on a runway | 0.03 × (1 + deferred maintenance) | that runway closed **6 days**; adjacent runway closed for 1 shift | repairs + investigation; reputation | — |
| Fatal accident with an airport-side hazard (non-frangible structure) | 0.005 × (non-compliant safety assets) | — | catastrophic: closure scaled by redundancy (6 runways: weeks, not years), regulator default notice | frangible-compliance audit |
| Diversion received | per shift | +1-6 inbound | earns landing and parking; airline cost ₹15-28 L narrow, ₹50 L wide | — |
| Diversion caused (ZMI closed) | — | outbound | airline cost as above → SLA and goodwill | — |
| Damaging bird strike | 7% of strikes | aircraft out of service; runway inspection 10-20 min | airline cost ~₹79 L each; ZMI goodwill | wildlife programme: strike rate −30% |
| Regulator capacity cut | when OTP < 70% | −2 slots an hour | lost growth | — |
| Volcanic or regional closure elsewhere | in 9.1 | ZMI as the alternate | diversion fees | — |

### 9.9 Level 6 (the handback era)

Suggestion for the design step: Level 6 is the **era-12 shift**:
- It plays Level 4 traffic at the grown, saturated volume with phase 2 open.
- Set pieces:
  - the IE pre-inspection walk (assets below threshold flash on the map);
  - a fuel or grid resilience test;
  - the incoming operator's shadow team (advisory 6 months after transfer).
- The shift's safety and OTP feed the final handback score and the debrief line: "*[Parent]* ran Zero Mile for 60 years. ₹X crore returned on ₹Y crore invested."
- Earlier levels stay unchanged.
