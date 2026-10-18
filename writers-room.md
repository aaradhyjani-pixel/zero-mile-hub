# Writers' room: mid-level set pieces

Five writers pitched mid-level incidents in the summit's style (2026-10-18):
- a viral internet-culture writer;
- a thriller writer;
- a satirist;
- a systems designer;
- an aviation insider.

The rule for all of them: the jokes aim at systems and situations, never at real people. Each set piece has a character popup, a cinematic or banner, and a real trade-off. Set pieces are defined in `STORY` in `hub.js` and started from a level's `script` as `st_<key>`.

## Shipped

| Level | Key | When | Set piece | The call |
|---|---|---|---|---|
| L1 | `ribbon` | 06:05 | **Bas Paanch Minute.** A ribbon across the departure runway; the Chief Guest is always "five minutes away". | Cut it now, and Protocol re-stages the ceremony on the arrivals runway 10 min later, for 4 min. Or wait an unknown 5–11 min. |
| L1 | `tiger` | 06:45 | **Madam Has Right of Way.** A tigress from the Umred-Karhandla corridor walks onto 28R. | Wait for the dart team (8–14 min, unknown). Or herd her off, and she walks onto the arrivals runway 15 min later, mid-wave. |
| L2 | `kites` | 09:12 | **Kai Po Che.** Uttarayan kites over the busiest arrival runway's final, then drifting south to the next runway. | Flip that runway to DEP, or keep landing with a 1-in-4 go-around chance. |
| L2 | `lastball` | 10:07 | **Last Ball.** India need six off the last ball of the World Cup final. | PA (pushbacks freeze for 3 min, then the six makes turnarounds 4 min quicker). Or back to work (pushbacks slow for 6 min). |
| L3 | `dabba` | 14:25 | **A380 Gives Way to Tiffin.** The dabbawalas cross Concourse D; the mukadam quotes your live on-time %. | Let them cross (D stops for 3 min). Or hold them, and the hungry tower makes changeovers 3 min for 15 min. |
| L4 | `whatsapp` | 12:10 | **Good Afternoon to All.** Five ops WhatsApp groups merge into one, 1,400 members. | Admin-only (pushbacks +2 min for 10 min). Or ride it out (4-min changeovers for 10 min); the radio fills with forwards. |
| L4 | `trophy` | 13:12 | **The Champions Are Home.** "Trophy One", an Air India A350, lands with the L2 team. | Water salute and parade (the runway closes 6 min). Or straight to the motorcade (slow pushbacks at A and B for 10 min). |

## Parked: the best pitches not yet built

**L1**
- **Golden Hour:** a pre-wedding drone on final. Stop landings 3–7 min, or double spacing and safety −3.
- **Peak Bengaluru:** KIA's ground fleet arrives as one convoy at the R4 crossing.
- **Fog doesn't wear a watch:** CAT IIIB dawn fog; three crews can't autoland, so divert or hold.
- **One (1) good boy:** a stray dog causes a rejected take-off and heads for the other runway.
- **Shubh Muhurat:** a pandit breaks a coconut on 27L at the auspicious minute.

**L2**
- **Ahmedabad Weds Hyderabad / Mama ji's Baraat:** wedding charters and a dhol in security. "The horse does not fit in the tray."
- **One Follower:** a hoax bomb threat on X. Isolation bay vs a security-lane shutdown.

**L3**
- **One More Take / Ja Simran Ja:** a film climax on a runway. "Take 47"; "Picture abhi baaki hai".
- **Page 11, Bottom Corner:** a power cut at 46 °C. Terminal AC vs D–E airbridges.
- **Nagpur is flat:** GPS spoofing. ILS-only runways vs false "PULL UP" go-arounds.
- **The guest list has its own airline:** 14 wedding bizjets just after the summit.
- **Three engines over Vidarbha:** an A380 engine failure at rotation. Dump fuel or land overweight.

**L4**
- **Pier F is under new management:** Delhi's macaques take the airbridges. Langur-call men vs nets.
- **One pen:** the flight-plan computer fails, so one clearance every 45 s. Gate-hold vs push and queue.
- **Hardik Swagat / Shaadi Mein Zaroor Aana:** a flex banner or wedding tent blown onto a runway in the andhi.
- **It Is Always in the Lavatory:** a DRI gold tip on a Dubai 787.

**From the systems designer** (each one is built around a bank-chart decision):
- **Surya Kiran flypast (L1):** you choose the 4-minute all-runway freeze slot. Hovering a slot previews the cost on the forecast. Beat it by putting the freeze on the wave turn and hiding a changeover inside it.
- **Fire NOC pending (L1):** Concourse B has no fire certificate, so it is closed for 10 minutes. You choose now or "after the rush".
- **Hyderabad bank, 20 late (L2):** a storm slides the southern arrival wave onto the departure peak. Hold 24 departures, or run both waves together.
- **Kai Po Che, rolling version (L2):** an arrivals-only closure rolls north to south across the runways, 4 minutes each. Beat it by "chasing the kites", flipping each runway just ahead of them. The shipped kites already drift to a second runway; this is the full version.
- **27L is melting (L3):** asphalt at 62 °C on the only runway hot heavies can use. Patch now, or at 14:40 with offloads.
- **Big Fat Wedding (L3):** 12 Gulfstreams have to land before the muhurat. That's up to +12 movements, but they arrive in the arrival peak.
- **#JCBKiKhudai (L4):** a metro JCB cuts the north radar's fibre, so the north runways land at 2.5× spacing. Ride it out, or swap the whole field.
- **Super Over at Jamtha (L4):** 16 charters leave when a nearby match ends, and a score ticker narrows the time band. Then the match ties and goes to a Super Over, pushing them 10 minutes later.
