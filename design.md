# Zero Mile International (ZMI): design

ZMI is three airports merged into one. Ahmedabad's Sardar Vallabhbhai Patel International (SVPIA), Mumbai's Chhatrapati Shivaji Maharaj International (CSMIA) and Bengaluru's Kempegowda International (KIA) close, and their traffic, airlines and identity move to one airport south-west of Nagpur. It is sized for the combined traffic of Delhi, Mumbai, Bengaluru and Hyderabad: about 3,630 movements a day and 209 million passengers a year. Ahmedabad's 13.4 million (FY2024-25) [A4] sits on top of that, inside the phase 2 envelope of 260 million.

The site is near Nagpur's Zero Mile stone, long held to mark the centre of colonial India. The Government of India's own tourism site calls that claim "debatable" [Z4], and the game says "long held". The stone is a sandstone pillar beside a Great Trigonometrical Survey benchmark dated 1907 [Z1].

All geometry comes from `gen_airport.py`, which writes `spec.json` and validates it. Figures marked *estimate* are mine, not sourced. Sources are listed at the end, and every claim is checked in `research/notes.md`.

## 1. What the three airports give the building

**Mumbai gives the structure.** CSMIA Terminal 2 (Skidmore, Owings & Merrill, opened 2014) carries its headhouse roof, about 70,000 m², on 30 composite mega-columns on a 64 × 34 m grid, with a 40 m cantilever at the edge [M5, M6]. Its concept is the peacock: more than 4,000 moulded coffers, each with a coloured glass lens, speckle the floor with coloured light, and the columns flare into the ceiling "from the vertical to the horizontal" like a feather [M8, M9, M10]. Its Jaya He art programme, curated by Rajeev Sethi, runs along the passenger route on a wall about 3 km long [M19]. **At ZMI:** branching tree columns hold up the whole roof, and their arms open into a field of coffers. A 40 m cantilever shelters the departures kerb and forecourt. An art wall lines the transfer route through the Mall.

**Bengaluru gives the underside and the gardens.** KIA Terminal 2 (Skidmore, Owings & Merrill with Grant Associates and Abu Jani Sandeep Khosla, opened 2022 to 2023) was briefed as a "terminal in a garden" for the Garden City [B1, B7]. It has a lattice ceiling of engineered bamboo, four-post bamboo-clad columns on an 18 m grid, hanging "bells and veils" planters, and a 90 m planted forest belt between the processor and the gates [B9, B12, B13, B15]. Every gate takes either one widebody or two narrowbodies [B6]. **At ZMI:** bamboo-look soffits, gardens under the oculus and in the Hall's seven valleys, a 90 m planted "garden valley" where the Hall becomes the Mall, two open courts at every pier root, and MARS stands (multiple apron ramp system: one widebody or two narrowbodies on the same stand) throughout.

**Ahmedabad gives the edges.** Ahmedabad's walled city was India's first UNESCO World Heritage City (2017) [A9]. The Sidi Saiyyed mosque's carved jalis, including the tree-of-life window, are the city's emblem [A11]. The stepwells at Adalaj (1498 to 1499) and Rani-ki-Vav (UNESCO, 2014) descend through shaded terraces to water [A13, A15]. Adalaj is often said to be 5 to 6 °C cooler at the bottom, but no source gives a measurement [A14]. SVPIA's own terminals express the city mainly through art, such as kite installations and a jaali mural of Gandhi and Patel [A6]. Sardar Patel led the integration of more than 560 princely states into India [A19]. **At ZMI:** jaali screens stand off every sun-facing glass wall, with a branching pattern that echoes the tree columns. The forecourt is a stepwell. A unity inlay under the oculus remembers Patel.

**The merger is in the plan, not stuck on it.** The Hall keeps its seven lobes, like the segments of a Nagpur orange, but turns so one lobe flows due east into the Mall: one continuous roof. The three lobes facing the city then point home:

| Lobe | Faces | City bearing from Nagpur | Gap |
|---|---|---|---|
| S: Bengaluru gateway | 192.9° | 189.6° (896 km) | 3° |
| WSW: Mumbai gateway | 244.3° | 251.7° (689 km) | 7° |
| WNW: Ahmedabad gateway | 295.7° | 288.5° (703 km) | 7° |
| N: arrivals hall | 347.1° | Delhi 346.7° | 0.4° |

Each gateway is that city's check-in hall, in its materials and art. Their axes meet at the Zero Mile marker under the oculus. The two western lobes also frame Nagpur's sunsets, about 245° in December to 295° in June (my calculation), so the Ahmedabad lobe, the one with the densest tree-of-life jaali, faces the harshest summer sun. The west valley between them faces the equinox sunset and holds the forecourt.

**What a passenger recognises.** Someone from Mumbai walks in under a white coffered ceiling, columns flaring overhead and coloured light on the floor, with the long art wall ahead. Someone from Bengaluru finds bamboo overhead, plants hanging from the ceiling, and a garden at the end of every pier. Someone from Ahmedabad arrives down stepwell terraces in shade, through light filtered by jaali onto stone, and finds the unity marker at the centre. None of them sees a copy. They see ideas, materials and motifs from their city, joined into one building. ZMI references these airports and places; it reproduces no building, artwork or logo.

## 2. Runways and airside

- **Spacing.** Six east-west runways sit in two triples either side of a 3.6 km midfield. ICAO Annex 14 (2018) recommends 1,035 m between centre lines for independent parallel approaches and 760 m for segregated operations [P1]. Under PANS-ATM, below 1,525 m that needs high-update surveillance, which a new hub would install (multilateration or ADS-B) [P2].
  - The old plan had 850 m between the middle and inner runways. That is below even the 915 m for dependent approaches, so setting both to ARR, which the game lets you do, was not legal. **Middle to inner is now 1,035 m**, so any runway can land independently.
  - Outer to middle stays 1,550 m, which works even with standard radar.
- **Capacity.** Three arrival runways at about 40 an hour plus three departure runways at about 48 gives about 264 movements an hour, just over the 260 design peak. That is 44 per runway-hour. The FAA rates Atlanta at 250 to 252 an hour in good weather on five runways, about 50 per runway-hour [P13], so ZMI's figure is conservative. Atlanta averaged about 2,175 movements a day in 2024 [P15]; ZMI's 3,630 is 1.7 times that.
- **Heat.** ICAO's planning rule adds 7% runway length per 300 m of elevation and 1% per °C that the reference temperature exceeds standard [P7]. Nagpur is about 310 m up and its May mean maximum is 42.7 to 43.1 °C [C2], against a standard of about 13 °C, so the correction is 1.072 × 1.30 ≈ 1.39. A 777-300ER needs about 3,109 m at maximum take-off weight at sea level [P8]. Corrected, that is about 4,330 m. Hence a 4,500 m inner runway. Nagpur's record is 47.9 °C [C1]. The correction exceeds 35%, so ICAO asks for a specific study. *Estimate.*
- **Taxiways.** One-way loops replace head-on conflicts.
  - The outer parallels run west. The midfield has dual parallels 100 m apart (code F needs 91 m): west by the runway for inner-runway arrivals, east by the terminal for everyone heading to the holds.
  - The runway-side parallel is 200 m from the runway centre line (code F needs 180 m) [P4].
  - End-arounds close the loops, so nothing crosses a runway.
- **Exits.** A narrowbody rapid-exit set sits 1,550 and 1,900 m from the threshold. A second set at 2,450 and 2,800 m serves widebodies, whose landing roll is longer, so they don't brake hard or roll to the end. Rapid exits follow Annex 14: 30°, a 550 m radius and 93 km/h [P9]. The aim is an average runway occupancy under 50 s, which allows 2.5 NM spacing on final [P10].
- **Holding bays and heat pad.** Six holding bays near the west end-arounds take arrivals whose stand is still occupied, so they stop blocking taxiways. A heat pad beside the 4,500 m runway's hold is a one-way bypass where a heavy jet waits for the long runway or cooler air while lighter traffic passes.

**Stands.** There are 304 stands with 360 aircraft positions: 168 contact stands and 136 remote.
- 56 are MARS stands: one widebody or two narrowbodies, as at Dubai's C51 L/C/R [P18] and at Bengaluru.
- 128 stands (42%) take code E or F aircraft, against a target of at least 25%.
- 172 are swing stands: all of D, the first three on C's east and E's west faces, and every remote stand.
- Widebody stands sit nearest the Mall.

## 3. Transfers: the main event

IATA's guidance, via the National Academies, is about 300 m for an unaided walk, 650 m with moving walkways, and an automated people mover (APM) beyond 750 m [P19]. Every ZMI pier stops with its farthest gate 658 m from the APM platform. For comparison, Daxing's farthest gate is 600 m from the centre [P20].

**Airline neighbourhoods.** Most domestic connections are on the same airline group, so each group is housed in one concourse pair (for example IndiGo in A and B), and most domestic-to-domestic transfers never ride the train.

| Journey | Walk | Processing | APM | Total (*estimate*) |
|---|---|---|---|---|
| Domestic to domestic, same pair | 2 × 380 m at 1.6 m/s ≈ 8 min | none (sterile airside) | none | **about 8 min** |
| Domestic to domestic, across the Mall | 8 min | none | 0.75 min wait + 2 min ride + 1.5 min escalators | **about 12 min** |
| International to domestic | 8 min | immigration about 8 min, re-screening about 6 min | about 4 min | **about 26 min** |

So the domestic median is about 10 minutes, and international to domestic stays under the 35-minute target. For comparison, Air India's published Mumbai transfer times are 120 minutes international to domestic [P22]. The transfer centre (immigration plus re-screening) sits where the international piers meet the Mall.

**APM.**
- Demand (*estimate*): a busy hour of about 0.03% of annual passengers gives about 62,700 passengers in the peak hour, two ways. At the Hall–A link, the peak direction carries about 18,800 departing local passengers plus about 7,500 transfers, roughly 26,000 per hour per direction.
- Supply: Atlanta's Plane Train carries 10,000 to 12,000 per hour per direction at 90 s headways [P21]. ZMI therefore runs two pinched loops (an express to D–F and a local) of six-car trains at 90 s, about 36,000 per hour per direction. Moving walkways in the Mall serve A and B on foot.
- Station capacity: 80 m platforms with separate boarding and alighting sides.

## 4. Heat first: 47 °C, then the monsoon

- **Skylights face north.** Every skylight is a coffer whose glass faces north, so direct summer sun doesn't fall through it. Density follows the roof: more on north-facing slopes, fewer on south-facing ones and on the Mall's south half.
  - 485 coffers plus the oculus total about 92,000 m², 5.6% of a 1.65 million m² roof.
  - Bengaluru's T2 uses about 12% [B16]. ZMI halves that because it is far hotter.
  - Compared with horizontal glazing at the same daylight, north-facing coffers should cut skylight solar gain by roughly 60 to 70%. *Estimate.*
- **Shading.** Jaali screens about 45% open, plus deep overhangs on the east and west faces, should halve solar gain through those walls. *Estimate.*
- **Air and mass.** A heavy stone floor (thermal mass) and displacement ventilation, with cool air supplied low and exhausted high under the 46 m shell, condition only the bottom 3 m where people are.
- **Rain.** Nagpur gets about 1,100 mm a year, 84% of it from June to September [C3]. The roof's valleys and the Hall's seven gutters feed the forecourt cisterns, harvesting about 1.45 million m³ a year at a 0.8 run-off coefficient. *Estimate.*

## 5. Landside: the forecourt as a public square

- **Forecourt.** The stepwell forecourt (250 × 340 m) steps down 9.6 m in four terraces to a shaded pool at the level of the rail concourse. It is also the family plaza: Indian families see travellers off but cannot enter terminals, which is why Bengaluru built a covered plaza for them [B, missed fact]. The 40 m roof cantilever covers the top terraces and the kerb.
- **High-speed rail.** A station below the forecourt is safeguarded for the Mumbai–Nagpur high-speed corridor. That line is still a proposal: its detailed project report (741 km, about Rs 1.7 lakh crore) is under examination [H1].
- **Metro.** A spur joins Nagpur Metro's Orange Line Phase 2, which runs from Khapri to Butibori [M-2].
- **Road.** The road comes in from the Samruddhi Mahamarg, whose Nagpur end is at Shivmadka [S1].
- **Kerbs** (*estimate*), using ACRP Report 266's method [P23]: about 18,800 departing local passengers an hour, 50% by car or taxi at 1.6 per vehicle, 3-minute dwell, 7.6 m stalls and a 1.2 factor.

  > 5,875 vehicles/h × 3/60 × 7.6 m × 1.2 ≈ **2,700 m** of departures kerb

  It runs along both sides of the three gateway lobes. Arrivals, with a 5.2-minute dwell, use the lower level and a short-stay park.

## 6. Phasing: the game's four levels

1. **Bengaluru moves in** (Level 1). KIA closes; two runways, concourses A and B.
2. **Ahmedabad and Hyderabad** (Level 2). SVPIA closes and Hyderabad's connecting banks arrive; four runways and concourse C. The original brief put Hyderabad alone here. Ahmedabad's closure has to happen somewhere in the story, and pairing it with Hyderabad keeps the level traffic unchanged.
3. **Mumbai** (Level 3). CSMIA closes, the Gulf wave arrives and widebodies fill D and E; five runways.
4. **Delhi's banks** (Level 4). Delhi's own airport stays open for its city; its connecting banks move here. All six runways and concourse F.

**Phase 2: 260 million passengers.**
- Two linear satellites, G and H, replace the east remote rows, each served by an APM branch with two stations, so no gate is more than about 500 m from a platform.
- Remote stands move to aprons beyond the pier tips.
- Piers stay at their walking-limit length rather than being stretched.

## Sources

Shortened. Full list with quotes in `research/notes.md`.

- [M5] SOM, CSMIA T2 project page, som.com. [M6] TRB ACRP web resource, crp.trb.org/acrpwebresource2/?p=195. [M8, M10] MGS Architecture (GVK design head on the peacock brief). [M9] e-architect, Mumbai T2. [M19] CSIA, Jaya He GVK New Museum, csia.in.
- [B1, B6, B9, B15, B16] Architectural Record, "A new airport terminal in Bengaluru brings nature inside", 9 Jan 2024. [B7] Grant Associates, T2 project page. [B12, B13] SOM, KIA T2 project page. Family plaza: Architectural Record.
- [A4] Adani Airports / SVPIA traffic FY2024-25. [A6] AviationPros, 12 Jan 2022; IndianEagle, Sep 2025. [A9] UNESCO WHC/17/41.COM/18; PIB, 10 Jul 2017. [A11] IIMA Archives, "The story of our logo"; AMC Heritage City, Sidi Saiyyed. [A13, A14] Athens Journal of Architecture 7(2), 2021. [A15] UNESCO WHC-14/38.COM/16. [A19] PIB backgrounder, 30 Oct 2025.
- [Z1] The Better India; The Hitavada, 11 Jan 2023. [Z4] Incredible India, Zero Mile Marker. [C1] IMD Pune extremes to 2012; Al Jazeera, 23 May 2013. [C2, C3] IMD climatological normals 1981-2010, Nagpur (Sonegaon). [S1] The Metro Rail Guy, Samruddhi. [H1] India Infra Hub, 7 Sep 2023. [M-2] The Metro Rail Guy, Nagpur Metro Phase 2.
- [P1, P4, P9] ICAO Annex 14 Vol I, 8th ed. (2018). [P2] PANS-ATM 6.7.3 (via CASA CD 1903AS). [P7] ICAO Doc 9157 Part 1 (2020), 3.5. [P8] LAX take-off length analysis, Ricondo & Associates (2010). [P10] FAA JO 7210.3 10-4-9. [P13] FAA Airport Capacity Profile, ATL (2018). [P15] ATL 2024 traffic, AviationPros, Feb 2025. [P18] UAE GCAA AIP OMDB AD 2-22C. [P19] National Academies (2025), citing IATA ADRM. [P20] Beijing Daxing project page; China Daily, 1 Jul 2019. [P21] Alstom, 8 Jun 2026. [P22] Network Thoughts, 23 May 2025. [P23] ACRP Research Report 266 (2024).
- Traffic baseline (build.md §3): GMR Airports Feb 2026, Aviation A2Z, ACI Asia-Pacific.
