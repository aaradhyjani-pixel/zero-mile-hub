# BIAL: the reference airport for the VSI money model

2026-10-19. Bengaluru International Airport Ltd (BIAL, Kempegowda International, BLR) is the closest real analog to ZMI:
- a greenfield PPP, with a private majority plus AAI and the state at 13% each;
- state-provided land, a State Support Agreement and an interest-free state loan;
- a 30+30-year concession, a hybrid till;
- a second greenfield terminal (T2) built as an expansion and brought into the regulated asset base (RAB).

ZMI's money model is calibrated on BIAL. Delhi (DIAL) and Navi Mumbai (NMIA) appear only as comparison rows (section 8). All numbers are in `money.json` under `bial`, in the same entry format as the rest of the file.

How the numbers were made:
- Five research agents (financial close, AERA orders, the actual path, T2, owners) made 114 claims.
- A skeptic checked each claim against the primary source text: AERA orders and consultation papers, ICRA and CRISIL rationales, Fairfax India annual reports and press releases.
- All corrections are applied below.
- Notation used throughout:
  - **(est.)** marks my derivation or an estimate; the matching JSON key has `estimate: true`.
  - **(unverified)** marks a figure that could not be checked against a primary source.
  - "Derived" means the figure is computed from reported ratios.
- Money is in ₹ crore, nominal, for the year shown, unless stated otherwise. FY2009 is the year from 1 Apr 2008 to 31 Mar 2009.

---

## 1. Financial close and the State Support Agreement

### 1.1 Timeline

| Event | Date | Source |
|---|---|---|
| Concession awarded | Oct 2001 | [IJGlobal/greenstreet](https://infrastructure.greenstreet.com/articles/114711/bial-setting-the-template) |
| GoI Concession Agreement (CA) signed | 5 Jul 2004 | [AERA Order 11/2021-22](https://aera.gov.in/uploads/airports/16466592165337.pdf) para 1.1.2 |
| **Financial close** | **June 2005** (28 Jun 2005 per GVK) | [iupindia](https://www.iupindia.in/1005/PB_Airport_Privatization_29.html); [infrapppworld](https://www.infrapppworld.com/update/gvk-infrastructure-inaugurates-bangalore-airport-new-terminal) |
| Construction | 30 months planned, from July 2005 | IJGlobal |
| Airport opening date (AOD) | **24 May 2008** | AERA para 1.1.5 |
| HAL airport closed to commercial traffic | May 2008 | [Deccan Herald](https://www.deccanherald.com/amp/story/india/karnataka/bengaluru/reopening-hal-airport-viable-but-is-bial-keen-897321.html) |

The airport opened about 3 years after financial close. ZMI's 4 construction years (`capex.zmi_construction_years`) are a fair scaled match.

### 1.2 Project cost and capital structure at close

| Item | Value | Source |
|---|---|---|
| Phase-1 cost at close | **₹1,411.79 cr** for 4.5 mppa | AERA para 1.1.4 |
| Redesign mid-build | 4.5 → 11.4 mppa, cost ₹1,930.29 cr; the increase was funded by extra lender debt | AERA para 1.1.4 |
| Extension works | +₹540 cr (equity plus debt) | AERA para 1.1.4 |
| **Total initial project cost** | **₹2,470.29 cr** (+75% on the close cost, 2.5x the capacity) | AERA para 1.1.4 |
| Senior debt | **₹736 cr**, a 12-year rupee commercial loan. ICICI was arranger and sole lender, intending to syndicate. Fully non-recourse, no completion guarantees. A further ~USD 20 m loan was sized to the final cost | IJGlobal; iupindia |
| GoK state support loan | **₹350 cr, interest-free, subordinated.** Not fully drawn on day one. SBI issued a letter of credit guaranteeing the state's commitment, at ICICI's request | AERA para 1.1.3; IJGlobal |
| Equity | **₹326 cr** | IJGlobal |
| Mix at close | senior debt **52%** / state loan **25%** / equity **23%**. Debt including the state loan was 77%. Senior debt ÷ (senior debt + equity) = **69%** | IJGlobal; iupindia |
| Interest rate, moratorium, DSRA at close | **Not disclosed** in any source found | — |

Shareholding at close was Siemens Project Ventures 40%, Unique (Flughafen Zürich) 17% and L&T 17%, so private 74%. KSIIDC (GoK) held 13% and AAI 13%.

**The capital stack and the balance sheet in the early years**, from [B.PAC's reproduction of BIAL's MYTP balance sheet](https://aera.gov.in/uploads/stack_holder/16523840693125.pdf), Table 4:

| | FY2010 | FY2011 |
|---|---|---|
| Secured loans (incl. ECB FX restatement) | ₹1,381.6 cr | ₹1,285.7 cr |
| State support loan (unsecured, 0%) | ₹333.5 cr | ₹333.5 cr |
| Share capital | ₹384.6 cr | ₹384.6 cr |
| Gross block | ₹1,974 cr | ₹1,987 cr |
| Profit after tax | ₹77.7 cr | ₹132.1 cr |
| Accumulated P&L | (151.1) at the start of FY2010 | +58.8 at the end of FY2011 |

Senior debt was 1.9x equity plus the state loan (1.92 in FY2010, 1.79 in FY2011). The fall in secured loans in FY2011 (about ₹96 cr) is the first principal repayment, mixed with FX restatement. That fits a moratorium of about 2 years after opening.

### 1.3 State Support Agreement (SSA) and the Concession Agreement (CA)

| Term | Value | Source |
|---|---|---|
| **Interest-free state loan** | ₹350 cr soft loan under the SSA, subordinated, 0% | AERA para 1.1.3 |
| Original repayment | Over 30 years in **20 equal instalments starting in the 11th year after financial close**. Surplus cash can accelerate it | IJGlobal |
| **Deferral at the expansion** | GoK (Cabinet, 22 Jun 2018) deferred repayment of the ₹332.5 cr outstanding by **10 years, 2018 → 2028**. ICRA: "additional cushion for debt servicing in second and third control periods" (the T2 build) | [ICRA Nov 2019](https://www.icra.in/Rating/GetRationalReportFilePdf?id=89665) |
| How AERA treats it | In the WACC at **0% cost**: average ₹333 cr, a 6.40% weight in the CP2 true-up. It lowers the allowed return and the tariff | AERA Order 11/2021-22 Table 26 |
| Land | **4,008 acres** on rent under a Land Lease Agreement. The rent amount was not found. In 2024 GoK extended the lease to run with the concession to 2068. It raised the "site cost" cap from about ₹212 cr to a maximum of ₹302.15 cr. "Token rent" is **not** confirmed. The 6% annual escalation from May 2038 is **(unverified)**. The rent appears to recover the state's land cost (HUDCO acquisition loan), not to be nominal | AERA para 1.1.3; [Indian Infrastructure 2024](https://indianinfrastructure.com/2024/04/05/state-approves-extension-of-concession-agreement-for-bengaluru-kempegowda-airport/) |
| Concession fee to GoI | **4% of gross revenue**, from CA clause 3.3. In tariff setting, AERA puts only 4% of aero revenue into the ARR | AERA paras 1.1.2, 3.7.13, 7.2.59-60 |
| Term | 30 years from AOD, extendable 30 at BIAL's option. **Extended to 24 May 2068** (MoCA letter) | AERA 1.1.2; [ICRA May 2026](https://www.icra.in/Rating/ShowRationalReportFilePdf/143328) |
| Exclusivity | No new airport within **150 km** before the 25th anniversary of opening (May 2033) | ICRA May 2026 |
| AAI role | 13% equity plus a board nominee. AAI provides CNS/ATM. Government agencies do customs, immigration, security and met | AERA 1.1.2; ICRA |

**For ZMI:** the state support lever has three real parts: land, an interest-free subordinated loan with a 10-year grace, and a deferral at the expansion. Compared with ZMI's 20% state share, the BIAL loan was **25% of the close cost**. The 4% concession fee is far below DIAL's 45.99% revenue share. That is why BIAL's margin can reach ~72% (section 3).

### 1.4 Debt after opening

| Event | Terms | Source |
|---|---|---|
| T1 expansion (FY2014) | ₹1,547 cr, capacity to 20 mppa | [ICRA Aug 2017](https://www.icra.in/Rating/ShowRationalReportFilePdf/39406) |
| **Refinancing, Q3 FY2017** (14 Nov 2016) | Term loan of **₹1,813.74 cr at 9.83%** to 30 Sep 2033, which lengthened the maturity. 9.05% by Nov 2019; 7.85% (SBI RTL) from 21 Aug 2020 | ICRA 2017, 2019; AERA para 6.2.7 |
| Rating response | AA- (Jun 2017) → AA (Aug 2017) | ICRA 2017 |
| T2 close (6 Aug 2019) | ₹10,206 cr (section 4) | — |
| NCDs 2021-22 | ₹1,653.5 cr at **8.35%**: ₹1,000 cr (Jun 2021, maturing 2027-31) and ₹653.5 cr (Jun 2022, maturing 2028-32) | [CRISIL Nov 2024](https://www.crisilratings.com/mnt/winshare/Ratings/RatingList/RatingDocs/BangaloreInternationalAirportLimited_November%2006_%202024_RR_355170.html) |
| **Refinancing after T2, FY2026** | ₹8,069 cr of bank loans replaced by **₹9,000 cr of AAA NCDs**: 15 years to 25 Jul 2040, 2-year moratorium, back-ended. Coupon **~8.15%** (Reuters, Fairfax AR 2025). Tranches: ₹4,362 cr on 25 Jul 2025 and ₹4,638 cr in Oct 2025. Fixed vs "variable, index-linked" conflicts between BIAL's release and ICRA's annexure | ICRA May 2026; [CRISIL May 2026](https://www.crisilratings.com/mnt/winshare/Ratings/RatingList/RatingDocs/BangaloreInternationalAirportLimited_May%2022_%202026_RR_395809.html); [Fairfax AR 2025](https://www.fairfaxindia.ca/wp-content/uploads/2026/03/Fairfax-India-2025-Annual-Report-WEBSITE.pdf) p.14 |
| Moratorium in the refinancing plan | 7 years in Sep 2024, cut to 2 years by May 2025 | [ICRA Sep 2024](https://www.icra.in/Rating/GetRationalReportFilePdf?id=130057); [ICRA May 2025](https://www.icra.in/Rating/GetRationalReportFilePdf?id=134917) |
| Repayment after the refinancing | about ₹200 cr (FY2027) and ₹331 cr (FY2028), against ₹462 cr (FY2026) and ₹660 cr (FY2027) before it | ICRA May 2025, May 2026 |
| DSRA | **Two quarters of debt service** on the NCDs (CRISIL: six months). DSR plus margin money was ₹459 cr at 31 Mar 2026, against ₹3,603 cr of unencumbered cash | ICRA May 2026 |
| Covenants | Ring-fenced cash flow; restrictive covenants on dividends. ICRA's downgrade trigger is **cumulative DSCR < 1.40x sustained**. ICRA expects DSCR **> 1.50x** over the tenure | ICRA May 2026 |
| Rating arc | [ICRA]A (Mar 2015) → A+ (2016) → AA- (Jun 2017) → AA (Aug 2017) → AA watch-negative (Apr 2020) → AA Negative and withdrawn (Oct 2020) → CRISIL AA → **ICRA AAA (Sep 2024 to May 2026)** | ICRA rationales (keys `bial.debt.rating_arc`) |

**For ZMI's refinance lever:** BIAL refinanced twice, each time once traffic was proven: in 2016, eight years after opening, and in 2025, two years after T2. Both times it bought a longer tenor and a lower rate (9.83% → 7.85%, then about 8.15% fixed for 15 years). That is the "refinance after 3 stable years" lever.

---

## 2. AERA tariff orders, every control period

### 2.1 Control-period table

| | Pre-control (AOD to FY11) | CP1 (FY12-16) | CP2 (FY17-21) | CP3 (FY22-26) | CP4 (FY27-31) |
|---|---|---|---|---|---|
| Order | MoCA ad hoc; trued up later | 08/2014-15, 10 Jun 2014 (3 years late) | 18/2018-19, 31 Aug 2018 (~2.4 years late) | 11/2021-22, 28 Aug 2021 | 14/2026-27, 20 Aug 2026 |
| Till | 30% shared till (on TDSAT remand) | **40% shared revenue till** (trued up on 30%) | **30% hybrid** | 30% hybrid | 30% hybrid |
| Allowed return | 10.97% (in the true-up) | FRoR **11.55%** (CoE 16%, CoD 9.73%, 70.92% debt). Trued up to 10.97% | FRoR **11.93%**; true-up WACC **11.76%** (CoE 16.00, CoD 9.06, 47.24% E / 46.36% D / 6.40% state loan at 0%) | FRoR **11.59%** (CoE 15.05, CoD 7.85, D:E 48:52). Trued up to **11.77%** | WACC **11.99%** (CoE 15.05, CoD 8.68, 48:52) |
| Average aero RAB | Opening 1,359.39 at 1 Apr 2011 | 1,308.22 / 1,207.93 / 1,835.48 / 2,608.42 / **2,626.07** | 2,236.67 → **7,707.87** (ordered; T2 assumed in FY21) | Ordered 4,768.61 / 7,849.78 / **10,383.66** / 10,006.68 / 9,694.08. Actual 4,507.11 / 6,898.43 / 9,358.51 / 9,367.07 / 8,982.32 | 9,080.70 (FY27) → 11,977.20 (FY31) |
| Target revenue (ARR) | AERA's FY2009 ARR (40% SRT) ₹308.06 cr | **2,980.94** (PV 2,318.40) | **5,443.98** as ordered; 5,130.37 after netting CP1; trued up to **3,906.08** | gross 10,201.15; **net 8,840.09** (FY22 only 392.04 because of the clawback); trued up to 8,961.95 | **net 14,604.31** (PV 11,751.55) over 301 m pax |
| Yield per pax (YPP) | ~₹333 actual FY2009 | **₹376.34** | — | **₹447.53** (BIAL asked ₹1,546.55) | **₹390.42** baseline (BIAL asked ARR ₹41,398.93 cr) |
| Domestic / intl UDF per departing pax | 260 / 1,070 (incl. tax). Domestic from Jan 2009 only; intl from AOD | 342 / 1,368 (from 1 Jul 2014); 306 / 1,226 (FY16) | 100 / 400 from 16 Sep 2018 (BPAC summary; see note); 139 / 558 (Apr 2019); 179 / 716 (Apr 2020). TDSAT interim 306 / 1,226 for 16 Apr-15 Aug 2019 | 184 / 839 (Oct 2021) → 350 / 1,200 (FY23) → 450 / 1,400 (FY24) → **550 / 1,500** (FY25 to Dec 2025) → 385 / 1,050 (Jan-Mar 2026) | 300 / 997 departing + 125 / 426 arriving (1 Sep 2026 to 30 Apr 2030), then 160 / 854 + 65 / 366 |
| Landing (≤100 MT), dom / intl per MT | 187.90 / 250.50 | — | — | 207 / 410 → 260 / 440 → 365 / 660 → **510 / 685** → 510 / 715 → 355 / 500 | flat **442 / 652** (no slab) → 295 / 374 from May 2030 |
| True-up carried to the next CP | **+₹54.87 cr** under-recovery at Mar 2011. Indexed at 10.97%, then 11.74%, to **+₹179.76 cr** at Mar 2022 (×3.3) | **−₹313.62 cr** over-recovery at Mar 2016 (30% till, 10.97%). The consultation paper had ₹407.29 cr (₹476.78 with carrying cost) | **−₹974.14 cr** at Mar 2022. Collections 4,263.12 vs trued-up ARR 3,906.08; FY17 alone −597.25. Cause: late capitalisation of T2 | Planned shortfall **+₹940.63 cr** PV (13.9% of PV ARR), carried by design. True-up in CP4: **+₹603.38 cr** at Mar 2027 (net ARR 8,961.95 vs actual 8,612.22) | Incremental ARR for T2 Ph2, apron and ECT, from commissioning |

Sources:
- CP1: [AERA Order 08/2014-15](https://aera.gov.in/uploads/airports/5b1f90079005ao081415.pdf), Decisions 1, 6, 10 and 11; Tables 32, 59, 101, 104 and 110.
- CP2 and CP3: [AERA Order 11/2021-22](https://aera.gov.in/uploads/airports/16466592165337.pdf), Tables 3, 5, 12, 26, 53, 55, 57, 102, 106, 108, 181 and 182; Annexure 17.1. The CP2 UDF schedule is from the [BPAC summary](https://bpac.in/wp-content/uploads/2018/10/Summary-of-AERA-order_2018_BPAC.pdf).
- CP4: [AERA Order 14/2026-27](https://www.aera.gov.in/uploads/airports/17872763073873.pdf), Tables 118, 210-211 and 284-288; Annexure I.
- Pre-control and CP1 actuals: [AERA CP 05/2018-19](https://www.aera.gov.in/uploads/consultations/5afeb1d1b2109FinalConsultationPaperBIALV9100518.pdf), Tables 2, 7 and 12.

Notes on conflicts:
- **CP2 UDF cut size.** BPAC and AERA give 100 / 400 from 16 Sep 2018, a 67% cut from 306 / 1,226. ICRA and the Deccan Herald describe a 55% cut, to 139 / 558. The 139 / 558 rate certainly applied from 1 Apr 2019. The first-year rate is in dispute between sources.
- **TDSAT interim UDF collections.** AERA says about ₹101.91 cr; ICRA says about ₹75 cr held in escrow.
- **CP1 opening RAB.** 1,359.39 is the 40% SRT figure. The single-till RAB was 1,538.09.

### 2.2 What the control periods teach (the mechanisms VSI copies)

1. **The building block is the tariff.** CP4 baseline, ₹ cr over 5 years:

   | Return on RAB | Depreciation | O&M + concession fee | Tax | 30% of non-aero | CP3 true-up | Net ARR |
   |---|---|---|---|---|---|---|
   | 6,517.14 | +3,901.58 | +6,127.80 | +334.24 | −2,879.82 | +603.38 | = **14,604.31** |

   CP3 has the same structure: return 4,950.96, depreciation 2,427.57, opex 2,669.89, tax 126.44, working-capital interest 26.30, less non-aero 874.75, plus concession fee 308.07, plus pre-control +179.76, less the CP2 clawback −974.14.
2. **Smoothing with true-up is real and deliberate.** AERA's CP3 tariff plan collected ₹7,740 cr nominal (PV 5,849.29) against an ARR PV of 6,789.92. It carried the **₹940.63 cr gap (13.9% of PV ARR)** to CP4 at the allowed return.
   - The carrying cost is visible in the pre-control item: a ₹54.87 cr shortfall in 2011 became ₹179.76 cr in 2022 (×3.3 over 11 years).
   - The PV factors are 1.00 / 0.90 / 0.80 / 0.72 / 0.64, which is discounting at the FRoR.
3. **True-ups run both ways.**
   - Late capitalisation leads to a clawback (CP2: −₹974 cr).
   - Planned smoothing plus a traffic shortfall leads to a top-up (CP3: +₹603 cr).
   - CP1's 40% till left an over-recovery of ₹313.62 cr, netted off FY17.
4. **The regulator pays far less than the airport asks.** In CP3 AERA allowed a YPP of ₹447.53 against BIAL's ₹1,546.55 (3.5x). In CP4 it allowed an ARR of ₹14,604 cr against ₹41,399 cr (2.8x). The asked-vs-allowed gap is a good basis for an "appeal" probability.
5. **Late orders.** CP1 came 3 years late and CP2 2.4 years late. Meanwhile BIAL kept charging the old rates, and the difference was trued up afterwards.
6. **The allowed return is stable at about 11.6-12.0%.** The cost of equity fell from 16% to 15.05% (IIM Bangalore CAPM: beta 0.93, Rf 7.56%, ERP 8.06%). The cost of debt follows actual debt: 9.73 → 9.06 → 7.85 → 8.68%. From CP4 it is trued up at the lower of actual or SBI 1-yr MCLR + 50 bps.

### 2.3 How T2 entered the RAB

| Step | What happened | Source |
|---|---|---|
| CP2 (2018) | AERA approved ₹10,342.4 cr of T2 and expansion capex, with a ₹1,616.8 cr gap to BIAL's estimate (incl. a 10% allowance) to be reviewed on actuals. **T2 was assumed capitalised in FY2021**, on BIAL's promise of COD by 31 Mar 2021 | ICRA Nov 2019 |
| Penalty rule | 1% of project cost off the ARR, and no further IDC, if capitalisation slips. TDSAT upheld it (16 Dec 2020). In CP3 the penalty was waived to 31 Mar 2022 for COVID, and T2 capitalisation moved to Dec 2022. About ₹50 cr of extra PMC cost after Mar 2021 was disallowed | AERA Order 11/2021-22 paras 5.2.10-5.2.18, 5.5.6-5.5.9 |
| Consequence | T2 came late, so the CP2 tariff had included a return on an asset that did not exist: **−₹974.14 cr clawback** in FY22 | Table 182 line L |
| CP3 capitalisation | The deferred package (T2 Ph1, landside Ph1b, MMTH, apron, runway Ph2, utilities, maintenance) was approved at **₹7,458.57 cr incl. ₹1,044.83 cr IDC**. IDC is 14.0% of the total, 16.3% on top of the ex-IDC cost. Aero RAB additions were ₹5,912.17 cr in FY23. T2 Ph1 alone was ₹4,579.32 cr, of which 87.66% (₹4,014.23 cr) was aero | Tables 69, 94, 100, 102 |
| RAB step | Average aero RAB rose **2.2x in two years**: 4,768.61 (FY22) to 10,383.66 cr (FY24) | Table 102 |
| Tariff step | Domestic UDF rose **×3.0 in 30 months** (184 to 550); landing ×2.5 | Annexure 17.1 |
| CP3 total capex | approved ₹8,883.44 cr incl. IDC, against ₹10,645.14 cr claimed (−₹1,761 cr). Actual ~₹8,524.81 cr | Table 100; [IATA CP4 response](https://www.aera.gov.in/uploads/stack_holder/17841244347199.pdf) |
| Phase-2 overall | Of the ₹11,403 cr completed, AERA approved **90%** in earlier orders. The balance is expected in the CP4 RAB | ICRA May 2026 |
| CP4 (new rule) | **Incremental ARR from commissioning**, for T2 Ph2 (₹6,030.30 cr, aero ₹5,291.67 cr; capitalised 31 Mar 2030; ARR ₹1,009.70 cr; YPP +₹22.19), the T2 Ph2 apron (₹760 cr, ARR 145.26, +₹3.19) and the ECT (₹1,600 cr, aero ₹480 cr, +₹2.37). Nothing is pre-funded during construction | AERA Order 14/2026-27 Tables 284-288 |

**For ZMI:** expansion capex enters the RAB at COD, with IDC capitalised (~14-16%). The tariff steps up only after that, and late completion brings a clawback plus a 1% haircut. So the squeeze falls on the construction years and the first year after COD, when depreciation and interest arrive before the tariff step and the true-up.

---

## 3. BIAL's actual path, FY2009 to FY2026

### 3.1 The table

Units:
- Traffic in million passengers.
- Money in ₹ crore, nominal.
- Aero yield in ₹ per passenger: aero revenue ÷ traffic (derived).
- Margin = EBITDA ÷ operating income.
- DSCR = EBITDA ÷ (interest + scheduled principal), pre-tax. This is not the lender's CFADS definition, which deducts tax and maintenance capex.

Basis letters: R = reported, D = derived from reported ratios, E = estimate. "—" = not published in any source found.

| FY | Pax (m) | Aero rev | Aero yield ₹/pax | Non-aero | Op. income | EBITDA | Margin | Interest | Principal | Int. cover | DSCR | Event |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2009 | 7.23 (312 days; 8.45 full year) R | 241.04 R | 333 D | ~83 E | ~324 E | ~128-160 E | ~40-46% E | ~130-140 E | 0 (moratorium) E | ~1.0-1.15 E | **~1.0-1.15 E** | Opening. ₹97.03 cr loss. Domestic UDF only from Jan 2009. ARR shortfall −₹67.03 cr (22%) |
| 2010 | 9.93 R | 388.46 R | 391 D | — | — | — | — | — | — | — | — | PAT ₹77.7 cr R; senior debt ₹1,381.6 cr R |
| 2011 | 11.63 R | 440.70 R | 379 D | — | — | — | — | — | ~96 (incl. FX) D | — | — | PAT ₹132.1 cr R; losses wiped out |
| 2012 | 12.71 R | 486.30 R | 383 D | — | — | — | — | — | — | — | — | CP1 starts; no order until 2014 |
| 2013 | 11.99 R | 474.28 R | 396 D | — | — | — | — | — | — | — | — | Traffic −5.7% (domestic −8.1%; Kingfisher collapse, inferred) |
| 2014 | 12.86 R | 497.38 R | 387 D | 149 D | 646.44 R | 385.34 R | 60% R | — | — | — | — | T1 expansion ₹1,547 cr, to 20 mppa |
| 2015 | 15.40 R | 715.96 R | 465 D | 200 D | 915.51 R | 601.6 R | 66% R | — | — | — | — | CP1 UDF from Jul 2014. Q1 loss of ₹30 cr on new depreciation and interest |
| 2016 | 18.98 R | 873.45 R | 460 D | 265 D | 1,137.97 R | 803.58 R | 71% R | ~187 D | — | 4.30 R | ≤4.3 | Debt ~₹1,905 cr D |
| 2017 | 22.88 R | — | — | — | 1,314.35 R | 931.54 R | 71% R | ~172 D | — | 5.43 R | ≤5.4 | Refinanced at 9.83%. Traffic exceeds the 20 mppa capacity. Fairfax enters |
| 2018 | 26.91 R | — | — | — | 1,561.7 R | ~1,098 D | 70.3% R | ~183 D | — | 6.0 R | ≤6.0 | PAT ₹800 cr. T2 works under way |
| 2019 | 33.31 R | — | — | — | 1,493.0 R | ~975 D | 65.3% R | ~168 D | ~6 D | 5.8 R | **5.6 R** | CP2 UDF cut (Sep 2018). T2 close Aug 2019 |
| 2020 | 32.36 R | — | — | — | 1,415 R | — | — | ~196 E | ~37 R | 4.69 R | ~3.9 E | Second runway opens |
| 2021 | 10.92 R | — | — | — | 552 R | — | — | — | — | **0.47 R** | **<0.5 E** | COVID. PAT −₹543 cr. Rating on Negative and withdrawn |
| 2022 | 16.3 R | 541.94 R | 332 D | 284 D | 826 R | — | — | — | — | 1.22 R | ~1.1-1.2 E | PAT −₹357 cr. CP3 starts with the −₹974 cr clawback |
| 2023 | 31.9 R | 1,145.54 R | 359 D | 699 D | 1,844.7 R | ~1,110 D | 60.2% R | ~483 D | — | 2.3 R | ~2.0 E | T2 opens (dom Jan 2023). Debt/OPBDIT **9.4x** (peak leverage) |
| 2024 | ~37.6 D | 1,794.81 R | 477 D | 954 D | 2,749.3 R | ~1,749 D | 63.6% R | ~920 D | ~250-400 E | **1.9 R** | **~1.3-1.5 E** | **T2 repayment starts. Coverage trough.** PAT −₹56.8 cr |
| 2025 | 41.9 R | 2,433.29 R | 581 D | 1,561 D | 3,994.5 R | ~2,720 D | 68.1% R | ~1,088 D | ~513 R | 2.5 R | **~1.6-1.7 E** | CP3 tariff step. Includes ~₹272 cr one-off land income (ex that, DSCR ~1.55) |
| 2026 | 44.5 R | 2,696.64 R | 606 D | 1,542 D | ~4,239 R | ~3,052 D | **~72% R** | ~1,050 E | ~300-460 E | — | **~2.0-2.25 E** | Refinanced into ₹9,000 cr NCDs. AAA. ICRA expects DSCR >1.5x |

Sources by period:
- **Traffic FY2009-17:** [AERA CP 05/2018-19](https://www.aera.gov.in/uploads/consultations/5afeb1d1b2109FinalConsultationPaperBIALV9100518.pdf) Table 13.
- **Traffic FY2018-21:** AERA Order 11/2021-22 Tables 19 and 21. FY2021 uses AAI actuals; BIAL had submitted 8.00 m.
- **Traffic FY2022-26:** [CRISIL Oct 2022](https://www.crisil.com/mnt/winshare/Ratings/RatingList/RatingDocs/BangaloreInternationalAirportLimited_October%2028,%202022_RR_302681.html); ICRA Sep 2024 (FY2024 is +18% on 31.9); ICRA May 2026.
- **Aero revenue FY2009-16:** AERA CP 05/2018-19 Tables 7 and 12. These are the proposed true-up figures. They include cargo, ground handling and fuel, so "non-aero" for FY14-16 is only roughly comparable.
- **Aero revenue FY2022-26:** AERA Order 14/2026-27 Table 118, actuals.
- **CP2 aero revenue by year:** not published. The five-year total is ₹4,263.12 cr.
- **P&L FY2014-17:** [B.PAC](https://aera.gov.in/uploads/stack_holder/16523840693125.pdf) Table 2.
- **FY2016-17 ratios:** ICRA Aug 2017.
- **FY2018-19:** ICRA Nov 2019. The DSCR of 5.6x is ICRA's reported figure.
- **FY2020-22:** CRISIL Nov 2020 and Oct 2022.
- **FY2023-25:** ICRA Sep 2024 and May 2026 (consolidated). Interest is derived as OPBDIT ÷ interest cover.
- **FY2025 principal:** ICRA Sep 2024.
- **FY2026:** ICRA May 2026.

Derivations and estimates:
- **FY2009 EBITDA.** Non-aero ≈ AERA's 40% deduction ₹33.33 cr ÷ 0.4 ≈ 83. Depreciation ≈ 110-115. EBITDA = interest + depreciation − 97. Taking interest at 130-140 gives EBITDA ≈ 145-160. BIAL's own aero opex (176.45) gives a lower bound of ~128.
- **FY2020.** IC 4.69 at a FY2019-like margin gives interest ≈ 196. With ₹37 cr of principal, DSCR ≈ 4.69 × 196 ÷ 233 ≈ 3.9.
- **FY2024 principal.** CRISIL shows the T2 term loans down from ₹10,206 cr to ₹9,718 cr by Nov 2024 (about ₹490 cr repaid over FY24 and H1 FY25). Adding the 2016 term loan's amortisation gives an estimated ₹250-400 cr. So DSCR = 1,749 ÷ (920 + 250 to 400) = 1.32-1.49.
- **FY2025.** 2,720 ÷ (1,088 + 513) = 1.70. On ICRA's text OI of ₹3,699 cr, or excluding the land one-off, it is ~1.55-1.6.
- **FY2026.** EBITDA 72% × 4,239 = 3,052. Interest is assumed near FY2025 (~₹1,050 cr; refinancing at 8.15%). Principal is between the post-refinancing and pre-refinancing schedules. DSCR = 3,052 ÷ (1,050 + 300 to 460) = 2.0-2.25.
- **FY2024 operating income.** ICRA's text quotes ₹2,539 cr and its table ₹2,749.3 cr. The table is used.
- **FY2024 PAT.** −56.8 (May 2026) or −55.7 (Sep 2024).

### 3.2 The arc in one paragraph (what the game should feel like)

- **Opening (FY2009-11).** BIAL opened into a tight first year: ~₹100 cr loss, the domestic UDF ad hoc and 7 months late, EBITDA roughly equal to interest, and principal on a moratorium. It turned profitable in year 2, and the first principal was repaid in year 3.
- **First plateau (FY2012-19).** Traffic stalled for three years (FY12-14) while CP1 sat unordered. Then the T1 expansion and a traffic boom (+78% FY14-17) lifted the margin from 60% to 71% on a fixed cost base. Coverage peaked at **DSCR 5.6x (FY2019)** at low leverage.
- **The expansion squeeze (FY2019-24).**
  - The regulator cut the UDF just as the ₹13,352 cr T2 programme closed.
  - The state deferred its loan, and a TDSAT interim order let BIAL keep the old UDF for 4 months.
  - COVID took cover to 0.47x in FY2021.
  - T2 opened at **9.4x debt/OPBDIT (FY2023)**, and repayment started in FY2024 with interest cover at **1.9x**. This is ICRA's flagged "suppressed debt coverage", and BIAL told AERA that under-recovery could breach its expansion-loan covenants.
- **Recovery (FY2025-26).** CP3's tariff ramp and traffic of 44.5 m brought the margin back to **~72%**. BIAL refinanced into 15-year AAA bonds at ~8.15%, with ICRA expecting DSCR **>1.5x**.
- **Two plateaus.** The ~70% margin was reached twice: before T2 at low leverage (DSCR 5.6x) and after T2 at high leverage (DSCR ~1.6-2.2x).

**Lender-warning points in the real path:**
1. FY2009 (est. ~1.0-1.15x, under moratorium).
2. FY2021-22 (COVID, <0.5x then ~1.15x).
3. FY2024 (T2, est. ~1.3-1.5x).

Only FY2021 was below 1.0, and it came with liquidity cover and a rating withdrawal. No covenant default was reported.

---

## 4. T2: the template for VSI's phase 1B

| Item | Value | Source |
|---|---|---|
| Programme at close (6 Aug 2019) | **₹13,352 cr** (T2 Ph1, second runway, associated works), 80:20 debt:equity | [ITLN](https://www.itln.in/bial-raises-rs10206-crore-through-banks-achieves-financial-closure-aviation); ICRA Nov 2019 |
| Debt | **₹10,206 cr**: SBI ₹5,100 cr, Axis ₹5,106 cr. **1-year moratorium after completion, 10-year repayment, ~14.25 years door to door**. Floating (1-yr MCLR, 7.85% in 2020). Later syndicated to SBI, Canara, Union, Axis and BoM, all to 30 Sep 2034 | ITLN; CRISIL Nov 2024; AERA para 6.2.7 |
| Funding of the balance | ₹2,368 cr spent FY17-19. The ₹10,984 cr balance (FY20-23) was funded by ₹10,206 cr of debt plus ₹778 cr of internal accruals. 70% of the equity was in by Mar 2019. ~65% of the hard cost was let at fixed cost and time | ICRA Nov 2019 |
| **Actual cost** | **₹11,403 cr**, 15% under the close budget. Capacity rose from 26.5 to **51.5 mppa** | ICRA May 2026 |
| Unit costs (derived) | ₹456 cr/mppa all-in incl. runway; ₹183 cr/mppa for the T2 Ph1 asset alone (4,579.32 ÷ 25); terminal building ₹116,092/sqm ex-GST at 2018-19 prices (255,645 sqm), ₹150,105/sqm WPI-indexed to FY25 | ICRA; AERA Table 100; [MECON](https://aera.gov.in/uploads/stack_holder/17813314277439.pdf) p.111 |
| Phasing | Phase II works from FY2017. South runway: departures from Dec 2019, first landing **19 Mar 2020**. SOM design unveiled 2 Apr 2019. T2 inaugurated 11 Nov 2022. Domestic from 15 Jan 2023. International from 12 Sep 2023. **COD target Mar 2021, so a ~21-month slip** | [The News Minute](https://www.thenewsminute.com/karnataka/second-runway-bengaluru-airport-marks-first-landing-120673); [SOM](https://www.som.com/news/soms-design-for-new-garden-terminal-at-kempegowda-international-airport-in-bengaluru-india-unveiled/); [Indian Infrastructure](https://indianinfrastructure.com/2022/11/12/terminal-2-of-kempegowda-airport-gets-inaugurated/); [Live from a Lounge](https://livefromalounge.com/bengaluru-airport-transition-september-12-2023/) |
| Delay causes (accepted by AERA) | COVID labour shortages and imported long-lead items: glass units at 6% delivered against 89% planned (6.5 months), bamboo ceilings 12% against 98%, boarding bridges 0% against 77%. No passenger inconvenience, because traffic had collapsed | AERA paras 5.2.12-5.2.15 |
| During the build | UDF cut to 139 / 558; TDSAT interim UDF (₹75-102 cr, held for capex); state loan deferred 10 years; DSCR 5.6x falling toward ICRA's "substantial moderation" | ICRA Nov 2019 |
| T2 Phase 2 (CP4) | 25 → 45 mppa in T2, 243,855 sqm allowed. MECON assessed ₹5,713 cr (claimed ₹7,176 cr); AERA approved ₹6,030.30 cr. **₹286 cr/mppa**. Apron (40 stands) ₹755 cr | MECON; AERA Order 14/2026-27 |
| Next programme | Claimed ₹18,635 cr; MECON assessed ₹13,598 cr (IDC at 70:30, 9%). ICRA: ~₹21,000 cr incl. IDC and sustaining capex, 80:20, to 75-80 mppa, beyond FY2029 | MECON; ICRA May 2026 |
| Press round number (Jan 2019) | "~₹13,000 cr" was for T2 Ph1, the runway and connectivity (the same programme as the ₹13,352 cr close), not both T2 phases | [Business Today](https://www.businesstoday.in/amp/industry/aviation/story/bial-set-to-spend-13000-cr-on-terminal-2-2nd-runway-be-operational-from-october-155948-2019-01-10) |

**Template for ZMI 1B** (est.):
- Debt at 80:20, 1-year moratorium after COD, 10-year repayment, ~14 years door to door.
- IDC capitalised at ~14-16% of the RAB addition.
- RAB entry at COD, with a 1% ARR haircut and no extra IDC if late.
- A back-loaded tariff with a carried-forward PV shortfall (~14% of PV ARR).
- An optional state loan deferral.
- A ~21-month slip event (long-lead imports), whose penalty is softened if traffic is also down.
- Unit cost: ₹286 cr/mppa for terminal only, or ₹456 cr/mppa with a runway. These are in different price bases (FY2025 vs FY2017-24 nominal), so they are not directly comparable.

---

## 5. Ownership history: stake-sale precedents and valuation

| Date | Block | Buyer ← seller | Price | Implied 100% equity | Lesson |
|---|---|---|---|---|---|
| 2005-08 | 40 / 17 / 17 / 13 / 13 | Siemens / Zurich / L&T / AAI / KSIIDC | equity ₹326 cr at close (₹384.6 cr capital by FY2010) | — | Private 74%, state 26%: unchanged at the state end since |
| Dec 2009 | 17% | GVK ← L&T | ₹686 cr at ₹105/share (face ₹10) | ~₹4,040 cr; CAPA USD 877 m | 10.5x face value 1.5 years after opening |
| Oct-Dec 2009 | 12% | GVK ← Zurich | ₹484.6 cr at ₹105 (completed 29 Dec 2009) | same | Zurich kept 5% and its board seat, and stayed as operator to 2015 |
| Aug 2011 | 14% | GVK ← Siemens (**ROFR**) | ₹114/share, ~₹614-620 cr (USD 134-136 m) | ~₹4,385-4,440 cr; ~USD 972 m | Possible once Siemens's lock-in ended (Jun 2011, ~3 years after COD). GVK's 43% made it the largest holder, not the majority |
| Mar 2017 | 38% (33% GVK + 5% Zurich) | Fairfax | INR 25.22 bn (~USD 385 m) | ~USD 1.0 bn | Zurich's 5% agreed Apr 2016 at USD 48.9 m |
| Jul 2017 | 10% | Fairfax ← GVK (38 → 48%) | ~USD 200 m against a fair value of ~USD 123 m; ~USD 77 m expensed | ~USD 2.0 bn on this block | **Premium to buy out an exiting sponsor**, not a control premium |
| May 2018 | 6% | Fairfax ← Siemens (48 → **54%, majority**) | ~USD 67 m | ~USD 1.12 bn | The **majority block priced at about fair value** |
| Sep 2021 | 11.5% of Anchorage (holds 43.6% of BIAL) | OMERS | INR 9.5 bn (USD 129 m) | **INR 189.7 bn (~USD 2.6 bn)** | Held its value mid-pandemic. A down-round ratchet takes OMERS to 15% if the Anchorage IPO values Anchorage below USD 1.0 bn (long-stop 16 Sep 2026) |
| 2023 | 10% | Fairfax ← Siemens (54 → 64%) | USD 250 m (INR 20.7 bn) | ~USD 2.5 bn | A single block (the "3% + 7%" split is unconfirmed) |
| Feb 2025 | 10% | Fairfax ← Siemens (64 → **74%**) | USD 255 m in 3 instalments (84.15 / 94.35 / 76.5, the last backed by a letter of credit) | **USD 2.55 bn** (Fairfax) | Siemens fully out 20 years after close, 17 after COD |
| 31 Dec 2025 | 74% at fair value | — | USD 2,187.4 m | **~USD 3.0 bn** | Fairfax cost USD 1,158.0 m. **11.0% a year in USD** since Mar 2017. Cumulative dividends **USD 2.2 m** |

Sources:
- [Business Today 2011](https://www.businesstoday.in/story/gvk-buys-14percent-siemens-stake-in-bangalore-airport/1/18126.html).
- CAPA: [2009](https://centreforaviation.com/analysis/reports/gvk-seeking-bigger-slice-of-bangalore-and-mumbai-airports-16670) and [2011](https://centreforaviation.com/analysis/reports/gvk-power-raises-stake-in-profitable-bengaluru-airport-committed-to-domestic-airport-sector-57687).
- [Zurich newsroom](https://newsroom.flughafen-zuerich.ch/en/zurich-airport-divests-12-in-bangalore-and-keeps-5-in-preparation-for-further-growth-in-india/).
- Fairfax press releases:
  - [24 Mar 2017](https://fairfaxindia.ca/wp-content/uploads/FIH-PR-March-24-2017-FAIRFAX-INDIA-ACQUIRES-38-OF-BANGALORE-INTERNATIONAL-AIRPORT-LIMITED.pdf)
  - [Q2 2017](https://fairfaxindia.ca/wp-content/uploads/2017-Q2-Press-Release-FIH-Final.pdf)
  - [16 May 2018](https://www.fairfaxindia.ca/wp-content/uploads/May-16-2018-FIH-BIAL-54-l-Interest.pdf)
  - [16 Sep 2021](https://fairfaxindia.ca/wp-content/uploads/PR-Completion-of-Sale-of-Minority-Position-of-Anchorage-Infrastructure.pdf)
  - [3 Dec 2024](https://www.fairfaxindia.ca/wp-content/uploads/2024/12/2024_12_December_03-PRFIH-Acquisition-of-Additional-Interest-in-BIAL.pdf)
- Fairfax annual reports: [AR 2024](https://fairfaxindia.ca/wp-content/uploads/2025/03/Fairfax-India-Annual-Report-2024.pdf) and [AR 2025](https://www.fairfaxindia.ca/wp-content/uploads/2026/03/Fairfax-India-2025-Annual-Report-WEBSITE.pdf).

**Fairfax's valuation of BIAL** (AR 2025):

| Measure | Value |
|---|---|
| DCF | 5 business units; after-tax discount rates 12.2-17.5%; long-term growth 3.5% (2024: 12.4-17.3%; 2023: 12.4-16.9%) |
| What the valuation assumes | Higher CP4/CP5 capex (T2 Ph2, T3) and higher UDFs from CP5 "on a higher regulatory asset base". **The valuer models capex recovery through the RAB building block** |
| P / normalised FCF, ex Airport City | **13.8x** (10.1x in 2024) |
| P/E | 28.3x |
| P/B | 6.7x |
| Net debt / equity | 1.6x |
| ROE | 24% (2025); 18% 3-year average; 14% average in CP2 |
| Implied EV/EBITDA | **~9.9x** (est.): (3.0 + 1.6 × 0.439) ÷ 0.3742 |
| BIAL CY2025 (Fairfax) | revenue USD 532.1 m; EBITDA **USD 374.2 m (70%)**; net income USD 107.8 m; aero USD 237.1 m; non-aero plus other USD 295.1 m (now above aero); 43.8 m pax, 16% international |
| Airport City (BACL) | ~460 acres, 128 developed or under way (hotel, business park, arena, convention centre, Air India and IndiGo MROs). The value was cut in 2025 because land went to airport capex |

**Valuation ladder** (USD bn, 100% equity):

| 2009 | 2011 | Mar 2017 | Jul 2017 block | May 2018 | Sep 2021 | 2023 | Dec 2024 | Dec 2025 |
|---|---|---|---|---|---|---|---|---|
| 0.86 | 0.96 | 1.0 | 2.0 | 1.12 | 2.6 | 2.5 | 2.55 | **3.0** |

- Mar 2017 to Dec 2025 is **~13.3% a year** (8.75 years).
- Value was roughly flat in USD for the first ~9 years (thin cash flows, low CP1 tariffs).
- It re-rated when T2 was approved and built (Sep 2021, before T2 opened), not when T2 entered the RAB.

**For ZMI's stake-sale lever:**
- Founding sponsors sell in staged blocks once a lock-in ends, about 3 years after COD.
- An existing holder has a ROFR.
- A premium is paid to clear out an exiting sponsor; the majority block itself priced at about fair value.
- A real sponsor return is ~11% a year in USD with almost no dividends. That sits below the game's 15.5% target, so the target is generous.

---

## 6. BIAL, scaled: the factor for VSI (est.)

| Measure | BIAL | ZMI (design) | Factor |
|---|---|---|---|
| Traffic at opening | 9.93 m (year 2, FY2010); 8.45 m annualised in year 1 | ~44.5 m (BLR moves in, L1) | **4.5-5.3x** |
| Mature traffic | 44.5 m (FY2026) | L4 design day 4,194 movements, 5.0x L1's 837 (`game.design_day_movements_by_level`), so ~220 m | **~5.0x** |
| Capacity, phase 1 | 11.4 mppa | 45 mppa (stage 1A) | 3.9x |
| Capacity, full build | 51.5 mppa (after T2) | 209 mppa (1D) | 4.1x |
| Capex, phase 1 (2025-26 ₹) | ₹2,470 cr nominal (2005-08) × WPI ~2.07 ≈ ₹5,100 cr | ₹36,000 cr (1A) | ~7x |
| Capex, full build to "mature" (2025-26 ₹) | Phase 1 ~5,100 + T1 1,547 × ~1.45 ≈ 2,250 + Phase 2 11,403 × ~1.15 ≈ 13,100, giving **~₹20,500 cr** | ₹1,04,000 cr (`capex.zmi_full_build_capex_cr`) | **~5.1x** |
| Capex per mppa (2025-26 ₹) | ~₹450 cr/mppa phase 1; ~₹400 full | ₹800 (1A); ~₹500 full | 1.25-1.8x |

**The factor: 5x on traffic and on full-build capex.** Phase 1 is more capital-heavy per passenger than BIAL's was, about 1.8x per mppa. The real benchmarks are NMIA at ₹983 cr/mppa and Noida at ₹933.

WPI deflators are approximate (all-commodity WPI, 2011-12 = 100: FY2008 ~75, FY2013 ~107, FY2021 ~123-135, FY2025 ~154). They are my estimates, not fetched from the Office of the Economic Adviser (eaindustry.nic.in).

**A calibration warning for the modeller:**
- Opening aero RAB per passenger. BIAL had ₹2,470 cr ÷ ~9.9 m = ₹2,500 nominal, or ~₹5,100 in 2025 rupees. ZMI 1A has ~₹41,000 cr (incl. ~14% IDC) ÷ 44.5 m ≈ **₹9,200**.
- Opening ARR per passenger. BIAL's AERA-recomputed FY2009 ARR was ₹365/pax, about ₹755 in 2025 rupees. ZMI's building block will give roughly **₹1,300-1,500/pax** before smoothing.
- So "BIAL, scaled" needs one of three things:
  - heavier smoothing (a carried-forward shortfall above BIAL's 14% of PV ARR);
  - a smaller 1A;
  - the state support lever (a ~25%-of-cost interest-free loan, as BIAL had, lowers the WACC by about 0.5-1 point).

No hidden multiplier is needed; this is a design choice for `tools/concession_model.py`.

**Suggested time alignment** (est.). BIAL operating year *n* maps to ZMI game year *n + 4* for the opening arc. The T2 arc is compressed, because ZMI's BOM and DEL arrive by year 14:

| BIAL | BIAL operating years | ZMI equivalent |
|---|---|---|
| Opening squeeze, FY2009-11 | 1-3 | game years 5-7 (E1, L1) |
| First plateau and T1 expansion, FY2014-19 | 6-11 | years 8-10 (E2, L2), shortened |
| T2 build and squeeze, FY2017-24 | 9-16 | 1B/1C build for BOM/DEL, years 10-16 (E3-E4). Lender warning near year 15-16 |
| Recovery at ~70% margin, FY2025-26 | 17-18 | E5 onward (Level 5) |

---

## 7. What goes into the VSI model (mechanisms only; the numbers are keys under `bial`)

| Mechanism | BIAL fact | Key(s) |
|---|---|---|
| Building block on ZMI's own RAB | CP3/CP4 ARR structure; hybrid till 30%; WACC 11.6-12.0% | `bial.aera.cp4_baseline_arr`, `bial.aera.cp3_wacc`, `bial.aera.cp4_wacc` |
| Smoothing plus true-up with carrying cost | 940.63 PV carried (13.9%); 54.87 → 179.76 (×3.3) | `bial.aera.cp3_arr_and_shortfall`, `bial.aera.precp_shortfall` |
| Clawback on late capitalisation; 1% penalty | −974.14; 1% of cost | `bial.aera.cp2_trueup_over_recovery`, `bial.t2.delay_penalty_rule` |
| Debt at opening | 12-year non-recourse rupee loan, ~52% of cost; moratorium ~2 years after COD (est.) | `bial.close.*` |
| Debt at expansion | 80:20; 1-year post-COD moratorium; 10-year repayment; 14.25 years door to door | `bial.t2.financial_close` |
| DSRA and covenants | 2 quarters; 1.40x cumulative downgrade trigger; dividend restriction | `bial.debt.dsra`, `bial.debt.covenants` |
| State support lever | 0% subordinated loan of 25% of the close cost; repayment from year 11; 10-year deferral at the expansion; 0% in the WACC | `bial.ssa.*` |
| Refinancing after stable years | 2016 (9.83% → 7.85%), 2025 (15-year AAA at ~8.15%) | `bial.debt.refi_2016`, `bial.debt.refi_2025_ncd` |
| Dividends vs prepayment | USD 2.2 m of dividends in 9 years; cash to capex and deleveraging | `bial.owners.dividends` |
| Stake sales | ladder, ROFR, lock-in ~3 years, exit premium | `bial.owners.*` |
| Real DSCR path | arrays FY2009-26 | `bial.path.*` |

---

## 8. Comparison rows only: Delhi and Navi Mumbai

| | BIAL | DIAL (Delhi) | NMIA (Navi Mumbai) |
|---|---|---|---|
| Revenue share or fee | 4% concession fee to GoI | 45.99% (`ppp.rev_share_dial`) | 12.6% to CIDCO (`ppp.rev_share_nmia`) |
| WACC / FRoR, latest CP | 11.99% (CP4) | 12.89% (`till.wacc_dial_cp4`) | — |
| Average aero RAB | ₹9,080.70 cr (FY27) | ₹14,072.69 cr (FY25, `till.dial_rab_fy25_cr`) | — |
| EBITDA margin | ~72% (FY26) | 37% (FY26) | — |
| Phase-1 capex per mppa | ~₹450 cr (2025 ₹, est.) | — (brownfield) | ₹983 cr (`capex.nmia_phase1`) |

**Why Delhi was the wrong card:** DIAL's tariff is a return on an old, depreciated RAB (₹14,073 cr for ~79 m pax, ~₹1,780 per pax), after a 46% revenue share. Pricing a new ₹56,000 cr airport on that card under-recovers its capital several times over. That is the source of the earlier DSCR ~0.3-0.5.

---

## 9. Gaps (not found)

- BIAL's interest rate, moratorium length and DSRA at the 2005 close.
- The land lease rent amount.
- Per-year aero revenue for FY2017-21 (only the CP2 total).
- Interest and principal by year for FY2010-15 and FY2020-22.
- A published DSCR for any year except FY2019 (5.6x).
