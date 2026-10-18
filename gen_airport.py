"""Zero Mile International (ZMI): parametric master plan generator.

Writes spec.json: the geometry the simulation routes on, plus the architecture (one continuous roof,
the merger DNA of Ahmedabad, Mumbai and Bengaluru, landside, phase 2) for drawings and the 3D build.
Frame: metres, x east, y south, origin at the airport centre. Headings: degrees clockwise from north.
All runways run 09/27 (east-west). West flow: land and take off heading 270, thresholds at the EAST end.
Sources for every planning number are in design.md and research/notes.md.
"""
import json, math, os
D = os.path.dirname(os.path.abspath(__file__))
PI = math.pi

# ---------------------------------------------------------------- runways
# Two triples either side of a 3.6 km midfield. ICAO Annex 14 (2018) Rec 3.1.12: independent parallel approaches
# need 1,035 m between centre lines (with high-update surveillance), segregated operations 760 m. Inner to middle
# is 1,035 m so ANY runway can land independently: the game's runway desk lets you flip freely, and the airfield
# must allow it. Middle to outer is 1,550 m, which also works with standard SSR (PANS-ATM 6.7.3: 1,525 m).
X1 = 1800  # all landing thresholds line up at x = 1800 (east end)
INNER, MID, OUTER = 1800, 1800 + 1035, 1800 + 1035 + 1550
RW = [
    # id, name, y, length, role, side (+1 north triple, -1 south triple)
    ('R1', '09L/27R', -OUTER, 4000, 'arr', 1),
    ('R2', '09C/27C', -MID, 3800, 'arr', 1),
    ('R3', '09R/27L', -INNER, 4500, 'dep', 1),
    ('R4', '10L/28R', INNER, 4000, 'dep', -1),
    ('R5', '10C/28C', MID, 3800, 'dep', -1),
    ('R6', '10R/28L', OUTER, 4000, 'arr', -1),
]
EAT_W, EAT_E = -3300, 2700          # end-around taxiways, west and east
# Parallel taxiways. Outer parallels (between the runways of a triple) run one way WEST: arrivals roll out west and
# loop round the west end. The midfield has a dual parallel: the runway-side one runs WEST (inner-runway arrivals
# leaving the rapid exits), the terminal-side one runs EAST (everyone heading for the holds at the east end, and
# arrivals coming round the west end to their gates). Annex 14 Table 3-1, code F: taxiway to instrument runway
# 180 m, taxiway to taxiway 91 m.
PAR = {'N12': -(MID + OUTER) / 2, 'N23': -(INNER + MID) / 2, 'N3o': -1600, 'N3i': -1500,
       'S3i': 1500, 'S3o': 1600, 'S45': (INNER + MID) / 2, 'S56': (MID + OUTER) / 2}
WESTBOUND = {'N12', 'N23', 'N3o', 'S3o', 'S45', 'S56'}
runways, taxiways = [], []
def tw(id_, pts, oneway=False, kind='taxiway'):
    taxiways.append({'id': id_, 'oneway': oneway, 'kind': kind, 'pts': [[round(x), round(y)] for x, y in pts]})

# Rapid exits, by distance from the threshold: a narrowbody set and a second, later set for widebodies
# (Annex 14 3.9: 30 deg, 550 m turn-off radius, 93 km/h wet). Then a final exit near the end.
EXITS = [(1550, 'rapid'), (1900, 'rapid'), (2450, 'rapid-wide'), (2800, 'rapid-wide'), (3300, 'final')]
exit_par = {'R1': 'N12', 'R2': 'N23', 'R3': 'N3o', 'R4': 'S3o', 'R5': 'S45', 'R6': 'S56'}
for rid, name, y, ln, role, side in RW:
    x0, x1 = X1 - ln, X1
    py = PAR[exit_par[rid]]
    off = round(abs(py - y) / math.tan(math.radians(60)))   # the exit leg's run-out toward the west
    exits = [{'x': X1 - d, 'to': [X1 - d - off, round(py)], 'kind': k} for d, k in EXITS if X1 - d - off > x0]
    hold = (x1 + 80, y + 150 * side)        # on the midfield side of each runway's east end, 150 m off the centre line
    rwy = {'id': rid, 'name': name, 'y': y, 'x0': x0, 'x1': x1, 'width': 60, 'role': role,
           'longest': ln == 4500, 'exits': exits, 'holds': [{'x': hold[0], 'y': hold[1]}]}
    if rid in ('R3', 'R4'):                 # inner runways: the stub crosses the westbound parallel from the eastbound one
        pin = PAR['N3i'] if rid == 'R3' else PAR['S3i']
        tw('H' + rid, [(hold[0], pin), (hold[0], py), hold])
    else:
        tw('H' + rid, [(hold[0], py), hold])
    runways.append(rwy)

# Heat pads: a one-way bypass loop off the eastbound parallel next to the 4,500 m runway's hold, where heavy
# jets waiting for the long runway (or for cooler air) step aside and let the queue pass.
LONG = next(r for r in runways if r['longest'])
pad_y = LONG['y'] + 400
tw('PAD27L', [(1640, PAR['N3i']), (1690, pad_y), (1990, pad_y), (2040, PAR['N3i'])], oneway=True, kind='pad')
LONG['pads'] = [{'x': x, 'y': round(pad_y), 'kind': 'heat'} for x in (1740, 1840, 1940)]

# Parallels: point order is the direction of travel for one-way taxiways
for k, y in PAR.items():
    pts = [(EAT_E, y), (EAT_W, y)] if k in WESTBOUND else [(EAT_W, y), (EAT_E, y)]
    tw('P' + k, pts, oneway=True)
# End-arounds close the loops: north side runs south at the west end and north at the east end; the south mirrors it
tw('EATWN', [(EAT_W, PAR['N12']), (EAT_W, PAR['N23']), (EAT_W, PAR['N3o']), (EAT_W, PAR['N3i'])], oneway=True)
tw('EATEN', [(EAT_E, PAR['N3i']), (EAT_E, PAR['N3o']), (EAT_E, PAR['N23']), (EAT_E, PAR['N12'])], oneway=True)
tw('EATWS', [(EAT_W, PAR['S56']), (EAT_W, PAR['S45']), (EAT_W, PAR['S3o']), (EAT_W, PAR['S3i'])], oneway=True)
tw('EATES', [(EAT_E, PAR['S3i']), (EAT_E, PAR['S3o']), (EAT_E, PAR['S45']), (EAT_E, PAR['S56'])], oneway=True)

# Remote holding bays: aircraft that land before their stand is free wait here instead of blocking a taxiway.
bays = []
for half, sg in (('N', -1), ('S', 1)):
    pin, by = PAR['N3i'] if sg < 0 else PAR['S3i'], sg * 1380
    tw(f'BAY{half}', [(-3200, pin), (-3150, by), (-2650, by), (-2600, pin)], oneway=True, kind='bay')
    for i, x in enumerate((-3050, -2900, -2750)):
        bays.append({'id': f'HB{half}{i+1}', 'x': x, 'y': round(by), 'code': 'F', 'lane': [x, round(by)], 'nose': 90})

# ---------------------------------------------------------------- the Hall, the Mall, the piers: one roof
HALL_C = (-2380, 0)
HRX, HRY, HAMP = 440, 490, 0.10
def hall_r(t):  # radius of the seven-lobed Hall at angle t (SVG angle: 0 = east, +pi/2 = south)
    rx, ry = HRX, HRY
    k = 1 + HAMP * math.cos(7 * t)      # phase 0: a lobe points due east and flows into the Mall
    return k * rx * ry / math.hypot(ry * math.cos(t), rx * math.sin(t))
def hall_pt(t, f=1.0):
    r = hall_r(t) * f
    return (HALL_C[0] + r * math.cos(t), HALL_C[1] + r * math.sin(t))
hall_outline = 'M' + ' L'.join(f'{x:.0f} {y:.0f}' for x, y in (hall_pt(2 * PI * i / 168) for i in range(168))) + ' Z'
MALL_X0, MALL_X1 = -1900, 300
def mall_hw(x):  # half-width of the Mall: waisted, widest where each concourse meets it
    return 120 + 26 * math.cos((x + 1440) / 320 * 2 * PI)
mall_top = [(x, -mall_hw(x)) for x in range(MALL_X0, MALL_X1 + 1, 36)]
mall_outline = 'M' + ' L'.join(f'{x:.0f} {y:.0f}' for x, y in mall_top) + ' L' + ' L'.join(f'{x:.0f} {-y:.0f}' for x, y in reversed(mall_top)) + ' Z'

# ---------------------------------------------------------------- concourses
# Six north-south concourses, each with a north and a south pier off the Mall. Lead identity: the domestic piers
# carry Bengaluru's garden calm, the international piers Mumbai's ceremonial white and gold, D blends both.
# Ahmedabad's jaali screens wrap every east and west face (the low-sun faces). Stands follow the ADRM walking
# guidance: the farthest gate is about 650 m from the APM platform, the limit for a walk with moving walkways.
CX = [-1440, -1120, -800, -480, -160, 160]
NAMES = ['A', 'B', 'C', 'D', 'E', 'F']
ZONES = ['dom', 'dom', 'dom', 'swing', 'intl', 'intl']
DNA_C = {'A': 'BLR', 'B': 'BLR', 'C': 'BLR', 'D': 'blend', 'E': 'BOM', 'F': 'BOM'}
HALF_W = 26                         # half-width of a pier along the stands
STAND0 = 208                        # first stand starts here (|y|); the root above it flares into the Mall
LANES = [-1600, -1280, -960, -640, -320, 0, 320]
GLEN = {'C': 46, 'E': 82, 'F': 92, 'M': 92}   # stand width along the face; M = MARS (1 widebody or 2 narrowbodies)
GOFF = {'C': 26, 'E': 40, 'F': 46, 'M': 40}   # aircraft centre offset from the face
PATTERN = {                                   # from the root outward: widebody stands near the Mall
    'dom':   ['E', 'M', 'C', 'C', 'C', 'C', 'C', 'M'],
    'swing': ['F', 'E', 'M', 'C', 'M', 'E'],
    'intl':  ['F', 'E', 'E', 'M', 'C', 'E'],
}
SWING_EXTRA = {('C', 1): 3, ('E', -1): 3}     # first stands on C's east face and E's west face also swing
def pier_hw(d, tip):  # half-width at distance d from the Mall centre line: flared root, slim body, rounded tip lounge
    root = 26 + 49 * max(0.0, 1 - (d - 130) / 78) ** 2 if d < STAND0 else 26
    if d > tip - 70:
        u = (d - (tip - 70)) / 70
        return 26 + 9 * math.sin(min(1, u * 1.6) * PI / 2) * (1 if u < 0.6 else (1 - (u - 0.6) / 0.4) ** 0.5 * 1.0)
    return root
concourses, mars_groups = [], 0
gid = 0
for ci, (cx, nm, zn) in enumerate(zip(CX, NAMES, ZONES)):
    total = sum(GLEN[c] for c in PATTERN[zn])
    tip = STAND0 + total + 50
    for half, sgn in (('N', -1), ('S', 1)):
        gates = []
        for face in (-1, 1):                      # west face, east face
            lane_x = cx + face * 160
            pos = STAND0
            for si, code in enumerate(PATTERN[zn]):
                cyy = sgn * (pos + GLEN[code] / 2)
                pos += GLEN[code]
                zone = 'swing' if si < SWING_EXTRA.get((nm, face), 0) else zn
                nose = 90 if face == -1 else 270     # nose faces the building
                base = f'{nm}{half}{len([g for g in gates if not g.get("marsOf")])+1:02d}'
                if code == 'M':
                    mars_groups += 1
                    grp = f'M{mars_groups:03d}'
                    gx = cx + face * (HALF_W + GOFF['M'])
                    gates.append({'id': base, 'x': round(gx), 'y': round(cyy), 'nose': nose, 'code': 'E', 'zone': zone,
                                  'bridge': True, 'lane': [lane_x, round(cyy)], 'mars': grp, 'marsRole': 'wide'})
                    for k, dy in (('L', -23), ('R', 23)):
                        gates.append({'id': base + k, 'x': round(cx + face * (HALF_W + GOFF['C'])), 'y': round(cyy + dy), 'nose': nose,
                                      'code': 'C', 'zone': zone, 'bridge': True, 'lane': [lane_x, round(cyy + dy)],
                                      'mars': grp, 'marsRole': k, 'marsOf': base})
                else:
                    gx = cx + face * (HALF_W + GOFF[code])
                    gates.append({'id': base, 'x': round(gx), 'y': round(cyy), 'nose': nose, 'code': code, 'zone': zone,
                                  'bridge': True, 'lane': [lane_x, round(cyy)]})
        # pier outline from the half-width profile: one surface with the Mall's roof
        ds = [100 + i * 6 for i in range(int((tip - 100) / 6) + 1)] + [tip]
        west = [(cx - pier_hw(d, tip), sgn * d) for d in ds]
        east = [(cx + pier_hw(d, tip), sgn * d) for d in reversed(ds)]
        cap = [(cx + 35 * math.cos(a), sgn * (tip + 14 * math.sin(a))) for a in [PI * i / 12 for i in range(13)]]
        pts = west + [p for p in reversed(cap)] + east if sgn > 0 else west + cap + east
        d_ = 'M' + ' L'.join(f'{x:.0f} {y:.0f}' for x, y in pts) + ' Z'
        concourses.append({'id': f'{nm}{half}', 'name': f'Concourse {nm} {"North" if half=="N" else "South"}',
                           'zone': zn, 'dna': DNA_C[nm], 'outline': d_, 'apm': [cx, 0], 'tip': sgn * tip, 'gates': gates})

# lanes between piers (stand taxilanes, two-way, served by ATC): they cross both midfield parallels
for lx in LANES:
    ys_n = sorted({g['lane'][1] for c in concourses for g in c['gates'] if g['lane'][0] == lx and g['lane'][1] < 0})
    ys_s = sorted({g['lane'][1] for c in concourses for g in c['gates'] if g['lane'][0] == lx and g['lane'][1] > 0})
    if lx == 320:            # only the east lane runs the full depth; the Mall blocks the rest
        tw(f'L{lx}', [(lx, PAR['N3o']), (lx, PAR['N3i'])] + [(lx, y) for y in ys_n] + [(lx, y) for y in ys_s] + [(lx, PAR['S3i']), (lx, PAR['S3o'])], kind='taxilane')
    else:
        tw(f'L{lx}N', [(lx, PAR['N3o']), (lx, PAR['N3i'])] + [(lx, y) for y in ys_n] + [(lx, -200)], kind='taxilane')
        tw(f'L{lx}S', [(lx, 200)] + [(lx, y) for y in ys_s] + [(lx, PAR['S3i']), (lx, PAR['S3o'])], kind='taxilane')

# ---------------------------------------------------------------- remote stands and east zone
remote = []
RLANE = {'N': -1000, 'S': 1000}
RW_ = {'C': 50, 'E': 86, 'M': 100}
rid = 0
for half, ly in RLANE.items():
    xs = []
    for side in (-1, 1):                             # north and south of the lane
        x = 470
        seq = (['C', 'C', 'C', 'M', 'C', 'C', 'C', 'E'] * 6)
        for code in seq:
            w = RW_[code]
            if x + w > 2520: break
            cx_ = x + w / 2
            nose = 0 if side == -1 else 180
            if code == 'M':
                rid += 1; mars_groups += 1; grp = f'M{mars_groups:03d}'; base = f'R{rid:03d}'
                remote.append({'id': base, 'x': round(cx_), 'y': round(ly + side * 80), 'nose': nose, 'code': 'E', 'zone': 'swing',
                               'lane': [round(cx_), ly], 'mars': grp, 'marsRole': 'wide'})
                for k, dx in (('L', -25), ('R', 25)):
                    remote.append({'id': base + k, 'x': round(cx_ + dx), 'y': round(ly + side * 64), 'nose': nose, 'code': 'C', 'zone': 'swing',
                                   'lane': [round(cx_ + dx), ly], 'mars': grp, 'marsRole': k, 'marsOf': base})
                    xs.append(round(cx_ + dx))
            else:
                rid += 1
                remote.append({'id': f'R{rid:03d}', 'x': round(cx_), 'y': round(ly + side * (64 if code == 'C' else 80)), 'nose': nose,
                               'code': code, 'zone': 'swing', 'lane': [round(cx_), ly]})
            xs.append(round(cx_))
            x += w
    tw(f'RL{half}', [(320, ly)] + [(xx, ly) for xx in sorted(set(xs))] + [(2600, ly)], kind='taxilane')
tw('CNE', [(2600, PAR['N3i']), (2600, RLANE['N']), (2600, 0), (2600, RLANE['S']), (2600, PAR['S3i'])])
tw('TC', [(320, 0), (2600, 0), (EAT_E, 0)])
tw('TCE', [(EAT_E, PAR['N3i']), (EAT_E, 0), (EAT_E, PAR['S3i'])])

# ---------------------------------------------------------------- buildings
def rect(x0, y0, x1, y1, r=0):
    if not r: return f"M{x0} {y0} H{x1} V{y1} H{x0} Z"
    return (f"M{x0+r} {y0} H{x1-r} Q{x1} {y0} {x1} {y0+r} V{y1-r} Q{x1} {y1} {x1-r} {y1} H{x0+r} "
            f"Q{x0} {y1} {x0} {y1-r} V{y0+r} Q{x0} {y0} {x0+r} {y0} Z")
def blob(cx, cy, rx, ry, n=7, amp=0.12, phase=0.3, steps=96):
    pts = []
    for i in range(steps):
        t = 2 * PI * i / steps
        k = 1 + amp * math.cos(n * t + phase)
        pts.append((cx + rx * k * math.cos(t), cy + ry * k * math.sin(t)))
    return 'M' + ' L'.join(f'{x:.0f} {y:.0f}' for x, y in pts) + ' Z'
# The stepwell forecourt sits in the Hall's west valley, under the roof's 40 m leading-edge cantilever.
FC = {'x0': -3060, 'x1': -2810, 'y0': -170, 'y1': 170}
buildings = [
    {'id': 'ZMH', 'kind': 'processor', 'label': 'Zero Mile Hall', 'outline': hall_outline},
    {'id': 'MALL', 'kind': 'processor', 'label': 'The Mall', 'outline': mall_outline},
    {'id': 'TWR', 'kind': 'tower', 'label': 'ATC tower', 'outline': blob(1000, 0, 38, 38, n=6, amp=0.05)},
    {'id': 'F1', 'kind': 'fire', 'label': 'Fire 1', 'outline': rect(1050, -1460 + 120, 1230, -1360 + 120, 8)},
    {'id': 'F2', 'kind': 'fire', 'label': 'Fire 2', 'outline': rect(1050, 1360 - 120, 1230, 1460 - 120, 8)},
    {'id': 'F3', 'kind': 'fire', 'label': 'Fire 3', 'outline': rect(-3900, -260, -3720, -160, 8)},
    {'id': 'CGO', 'kind': 'cargo', 'label': 'Cargo', 'outline': rect(1350, -720, 2450, -260, 20)},
    {'id': 'MRO', 'kind': 'mro', 'label': 'MRO hangars', 'outline': rect(1350, 260, 2450, 720, 20)},
    {'id': 'FUEL', 'kind': 'fuel', 'label': 'Fuel farm', 'outline': rect(3300, -900, 3900, -400, 30)},
    {'id': 'FC', 'kind': 'court', 'label': 'Stepwell forecourt', 'outline': rect(FC['x0'], FC['y0'], FC['x1'], FC['y1'], 40)},
    {'id': 'CPN', 'kind': 'other', 'label': 'Car park north', 'outline': rect(-3600, -700, -3160, -380, 20)},
    {'id': 'CPS', 'kind': 'other', 'label': 'Car park south', 'outline': rect(-3600, 380, -3160, 700, 20)},
    {'id': 'HSR', 'kind': 'rail', 'label': 'Rail station (below)', 'outline': rect(-3010, -260, -2950, 260, 10)},
]
aprons = [
    rect(-1720, -1450, 420, 1450, 30),
    rect(420, -1180, 2650, -820, 20), rect(420, 820, 2650, 1180, 20),
    rect(1300, -800, 2560, -180, 20), rect(1300, 180, 2560, 800, 20),
    rect(-3260, -1440, -2560, -1330, 30), rect(-3260, 1330, -2560, 1440, 30),     # holding bays
    rect(1620, LONG['y'] + 350, 2060, LONG['y'] + 450, 30),                        # heat pad
]
apm = {'pts': [[-2380, 0], [160, 0]], 'stations': [{'id': 'ZMH', 'x': -2380, 'y': 0}] + [{'id': n, 'x': x, 'y': 0} for n, x in zip(NAMES, CX)],
       'headway_s': 90, 'cars': 6, 'note': 'double-track pinched loop under the Mall'}
# Landside: Samruddhi spur from the north-west (its Nagpur end is at Shivmadka), the airport loop road, the
# Mumbai-Nagpur high-speed line (a proposal under examination) north-south below the forecourt, and a spur off
# Nagpur Metro's Orange Line Phase 2 (Khapri to Butibori).
landside = [
    {'kind': 'road', 'label': 'Airport boulevard', 'pts': [[-9000, -60], [-5200, -60], [-3800, -40], [-3300, 0]]},
    {'kind': 'road', 'label': 'Samruddhi Expressway spur', 'pts': [[-5200, -60], [-6400, -2600], [-8200, -5600]]},
    {'kind': 'road', 'label': 'Kerb loop', 'pts': [[-3300, 0], [-3200, -260], [-2980, -430], [-2740, -520], [-2520, -560]]},
    {'kind': 'road', 'label': 'Kerb loop', 'pts': [[-3300, 0], [-3200, 260], [-2980, 430], [-2740, 520], [-2520, 560]]},
    {'kind': 'rail', 'label': 'Mumbai-Nagpur high-speed line (proposed), in tunnel', 'pts': [[-2980, 6500], [-2980, -6500]]},
    {'kind': 'rail', 'label': 'Metro spur to the Orange Line', 'pts': [[-9000, 520], [-4200, 420], [-3060, 120]]},
    {'kind': 'road', 'label': 'East service road', 'pts': [[3300, -650], [5200, -900], [9000, -1400]]},
]

# ---------------------------------------------------------------- the roof as one gesture
# Centre lines with widths and heights (a loft the 3D build extrudes), the skylight field, the structure and the
# three cities' details. Heights are metres above the departures floor.
roof = {'centrelines': [], 'widths': [], 'heights': [], 'kinds': [], 'ids': [], 'skylights': [], 'columns': [],
        'gardens': [], 'jaali': [], 'valleys': [], 'cantilevers': [], 'oculus': {'x': HALL_C[0], 'y': HALL_C[1], 'r': 48}}
def add_cl(id_, kind, pts, ws, hs):
    roof['ids'].append(id_); roof['kinds'].append(kind)
    roof['centrelines'].append([[round(x), round(y)] for x, y in pts])
    roof['widths'].append([round(w, 1) for w in ws]); roof['heights'].append([round(h, 1) for h in hs])
LOBE_NAMES = ['E', 'SE', 'S', 'WSW', 'WNW', 'N', 'NE']
LOBE_ROLE = {'E': 'Mall root', 'SE': 'international departures processing', 'S': 'Bengaluru gateway',
             'WSW': 'Mumbai gateway', 'WNW': 'Ahmedabad gateway', 'N': 'arrivals hall and meeters\' garden',
             'NE': 'domestic security'}
lobes = []
for k in range(7):
    t = 2 * PI * k / 7
    R = hall_r(t)
    rs = [60 + (R - 60) * i / 9 for i in range(10)]
    pts = [(HALL_C[0] + r * math.cos(t), HALL_C[1] + r * math.sin(t)) for r in rs]
    ws = [2 * r * math.sin(PI / 7) * 0.92 for r in rs]
    hs = [24 + 22 * (1 - (r / R) ** 1.6) for r in rs]           # 46 m at the oculus rim, 24 m at the lobe tip
    add_cl(f'LOBE-{LOBE_NAMES[k]}', 'lobe', pts, ws, hs)
    lobes.append({'id': LOBE_NAMES[k], 'compass': round((math.degrees(t) + 90) % 360, 1), 'role': LOBE_ROLE[LOBE_NAMES[k]],
                  'tip': [round(pts[-1][0]), round(pts[-1][1])]})
    tv = t + PI / 7                                          # the valley between this lobe and the next: gutters, gardens
    Rv = hall_r(tv)
    roof['valleys'].append({'pts': [[round(HALL_C[0] + r * math.cos(tv)), round(HALL_C[1] + r * math.sin(tv))] for r in (90, Rv * 0.55, Rv)],
                            'heights': [44, 33, 21]})
xs = list(range(MALL_X0, MALL_X1 + 1, 50))
add_cl('MALL', 'spine', [(x, 0) for x in xs], [2 * mall_hw(x) for x in xs],
       [31 - 5 * (x - MALL_X0) / (MALL_X1 - MALL_X0) + 2.5 * max(0, math.cos((x + 1440) / 320 * 2 * PI)) for x in xs])
for c in concourses:
    sgn = 1 if c['tip'] > 0 else -1; tipd = abs(c['tip']); cx = c['apm'][0]
    ds = [120] + list(range(160, int(tipd) - 20, 40)) + [tipd - 10]
    add_cl(f'PIER-{c["id"]}', 'pier', [(cx, sgn * d) for d in ds], [2 * pier_hw(d, tipd) for d in ds],
           [27 - 8 * (d - 120) / (tipd - 120) + (2 if d > tipd - 60 else 0) for d in ds])
# Skylights: north light only. Every opening is a coffer whose glazed face looks north, so no direct summer sun
# falls through it. Density follows the roof's slope: dense on north-facing slopes, sparse on south-facing ones.
def keep(p, salt):  # deterministic thinning without randomness
    return (math.sin(salt * 12.9898 + 78.233) * 43758.5453) % 1 < p
sk = roof['skylights']
for ring in range(7):
    r = 110 + ring * 62
    n = int(2 * PI * r / 46)
    for i in range(n):
        t = 2 * PI * i / n + ring * 0.21
        if r > hall_r(t) * 0.86: continue
        north = max(0.0, -math.sin(t))                     # slope faces north where the radial direction points north
        if not keep(0.38 + 0.6 * north, ring * 1000 + i): continue
        x, y = HALL_C[0] + r * math.cos(t), HALL_C[1] + r * math.sin(t)
        sk.append({'x': round(x), 'y': round(y), 'w': 12, 'l': 18, 'a': round(math.degrees(t) % 360), 'kind': 'coffer', 'face': 'N'})
for x in range(MALL_X0 + 40, MALL_X1 - 20, 36):
    hw = mall_hw(x)
    for j, yy in enumerate((-hw * 0.55, -hw * 0.18, hw * 0.18, hw * 0.55)):
        if yy > 0 and keep(0.55, x * 7 + j): continue           # the Mall's south half is thinner: it faces the sun
        sk.append({'x': x, 'y': round(yy), 'w': 12, 'l': 16, 'a': 0, 'kind': 'coffer', 'face': 'N'})
for c in concourses:
    sgn = 1 if c['tip'] > 0 else -1; cx = c['apm'][0]
    for d in range(STAND0 + 12, int(abs(c['tip'])) - 30, 30):
        sk.append({'x': cx, 'y': sgn * d, 'w': 10, 'l': 14, 'a': 90, 'kind': 'strip', 'face': 'N'})
# Structure: branching tree columns (Mumbai) whose heads open into the coffer field. The Hall rings, the Mall's
# 72 m bays, a single row down each pier. Each column's arms meet the coffers around it.
cols = roof['columns']
for k in range(7):
    t = 2 * PI * k / 7
    for r, arms in ((72, 6), (210, 6), (360, 6)):
        for dt in ((0,) if r < 300 else (-0.15, 0.15)):
            cols.append({'x': round(HALL_C[0] + r * math.cos(t + dt)), 'y': round(HALL_C[1] + r * math.sin(t + dt)), 'kind': 'tree', 'arms': arms, 'span': 36 if r > 100 else 24})
for x in range(MALL_X0 + 46, MALL_X1 - 30, 72):
    for yy in (-62, 62):
        cols.append({'x': x, 'y': yy, 'kind': 'tree', 'arms': 4, 'span': 36})
for c in concourses:
    sgn = 1 if c['tip'] > 0 else -1; cx = c['apm'][0]
    for d in range(250, int(abs(c['tip'])) - 40, 72):
        cols.append({'x': cx, 'y': sgn * d, 'kind': 'tree', 'arms': 3, 'span': 30})
# Gardens (Bengaluru): under the oculus, in the Hall's seven valleys, a planted valley where the Hall becomes the
# Mall (Bengaluru T2's forest belt, here under the roof), and two open-to-sky courts at every pier root.
gd = roof['gardens']
gd.append({'kind': 'oculus', 'x': HALL_C[0], 'y': HALL_C[1], 'r': 62})
for v in roof['valleys']:
    p = v['pts'][1]; gd.append({'kind': 'valley', 'x': p[0], 'y': p[1], 'r': 34})
gd.append({'kind': 'belt', 'x': -1930, 'y': 0, 'w': 90, 'l': 230})
for c in concourses:
    sgn = 1 if c['tip'] > 0 else -1; cx = c['apm'][0]
    for dx in (-36, 36):
        gd.append({'kind': 'court', 'x': cx + dx, 'y': sgn * 168, 'r': 13})
# Jaali (Ahmedabad): perforated stone-look screens on every sun-facing glass wall, standing off the facade under the
# roof edge. Piers run north-south, so both long faces take low sun (morning east, afternoon west).
ja = roof['jaali']
for c in concourses:
    sgn = 1 if c['tip'] > 0 else -1; cx = c['apm'][0]; tipd = abs(c['tip'])
    for face, nm in ((-1, 'W'), (1, 'E')):
        ja.append({'face': nm, 'pts': [[cx + face * (HALF_W + 3), sgn * STAND0], [cx + face * (HALF_W + 3), round(sgn * (tipd - 60))]], 'pattern': 'tree'})
for k in range(7):      # Hall facade arcs facing east, south or west (the north light needs no screen)
    t0 = 2 * PI * k / 7 - PI / 7; seg = [t0 + (2 * PI / 7) * i / 8 for i in range(9)]
    mid = 2 * PI * k / 7
    facing = (math.degrees(mid) + 90) % 360
    if 300 < facing or facing < 60 or LOBE_NAMES[k] == 'E': continue
    ja.append({'face': LOBE_NAMES[k], 'pts': [[round(hall_pt(t, 1.015)[0]), round(hall_pt(t, 1.015)[1])] for t in seg],
               'pattern': 'tree-of-life' if LOBE_NAMES[k] == 'WNW' else 'tree'})
ja.append({'face': 'S', 'pts': [[x, round(mall_hw(x) + 3)] for x in range(MALL_X0 + 100, MALL_X1 + 1, 100)], 'pattern': 'tree'})
# Mumbai's 40 m cantilever, here over the departures kerb and the stepwell forecourt
roof['cantilevers'] = [{'id': 'forecourt', 'depth': 40, 'pts': [[round(hall_pt(t, 1.0)[0]), round(hall_pt(t, 1.0)[1])] for t in [PI - 0.9 + 1.8 * i / 12 for i in range(13)]]}]
# Stepwell forecourt (Ahmedabad's vav + Bengaluru's family plaza): four terraces down to a shaded pool at the level
# of the rail and metro concourse. Families who see travellers off gather on the steps.
forecourt = dict(FC, levels=[0, -2.4, -4.8, -7.2, -9.6], pool={'x': -2935, 'y': 0, 'w': 70, 'l': 140, 'level': -9.6},
                 harvest_m3=None)
# roof areas and the skylight ratio
def poly_area(pts):
    return abs(sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))) / 2
def path_pts(d):
    toks = d.replace('M', ' ').replace('L', ' ').replace('Z', ' ').split()
    return [(float(toks[i]), float(toks[i + 1])) for i in range(0, len(toks) - 1, 2)]
A_hall = poly_area(path_pts(hall_outline)); A_mall = poly_area(path_pts(mall_outline))
A_piers = sum(poly_area(path_pts(c['outline'])) for c in concourses)
overlap = sum(2 * 75 * 30 for c in concourses) * 0.6 + 2 * mall_hw(MALL_X0) * 110
A_roof = A_hall + A_mall + A_piers - overlap
A_sky = sum(s['w'] * s['l'] for s in sk) + PI * 48 ** 2
forecourt['harvest_m3'] = round(A_roof * 1.1003 * 0.8)        # 1,100 mm/yr normal rainfall, 0.8 runoff coefficient
roof['areas'] = {'hall_m2': round(A_hall), 'mall_m2': round(A_mall), 'piers_m2': round(A_piers), 'roof_m2': round(A_roof),
                 'skylight_m2': round(A_sky), 'skylight_ratio': round(A_sky / A_roof, 4)}

dna = {
    'merged': [
        {'code': 'AMD', 'name': 'Sardar Vallabhbhai Patel International', 'city': 'Ahmedabad', 'bearing': 288.5, 'km': 703, 'lobe': 'WNW',
         'carries': 'edges and screens: jaali, shade, water; the stepwell forecourt; the unity marker'},
        {'code': 'BOM', 'name': 'Chhatrapati Shivaji Maharaj International', 'city': 'Mumbai', 'bearing': 251.7, 'km': 689, 'lobe': 'WSW',
         'carries': 'structure: branching columns, coffers with coloured lenses, the 40 m cantilever, the art spine'},
        {'code': 'BLR', 'name': 'Kempegowda International', 'city': 'Bengaluru', 'bearing': 189.6, 'km': 896, 'lobe': 'S',
         'carries': 'the underside: bamboo soffits, hanging gardens, the garden valley and courts, MARS stands'},
    ],
    'lobes': lobes,
    'concourses': DNA_C,
    'transfer_centre': {'x': -320, 'y': 0, 'note': 'immigration and re-screening where the international piers meet the Mall (D/E junction)'},
    'note': 'Each gateway lobe points within 8 degrees of its city. The two western lobes frame the June and December sunset azimuths (295 and 245 degrees); the west valley between them faces the equinox sunset.',
}
phase2 = {
    'note': 'Phase 2 (to 260 million passengers): two linear satellites, G and H, replace the east remote rows; remote stands move to the pier-tip aprons.',
    'satellites': [{'id': s, 'outline': rect(560, y - 22, 2440, y + 22, 22), 'y': y} for s, y in (('G', -1000), ('H', 1000))],
    'apm': [{'id': s + '-line', 'pts': [[160, 0], [560, 0], [560, y], [2300, y]], 'stations': [[1100, y], [1900, y]]} for s, y in (('G', -1000), ('H', 1000))],
    'remote_aprons': [rect(-1700, -1420, 400, -1150, 30), rect(-1700, 1150, 400, 1420, 30)],
}

spec = {
    'name': 'Zero Mile International Airport', 'short_title': 'Zero Mile Hub', 'code': 'ZMI',
    'tagline': "Ahmedabad, Mumbai and Bengaluru, merged under one roof near Nagpur's Zero Mile. Six runways, one continuous roof, and a Hall whose three gateway lobes each point home.",
    'extent': {'x0': -4300, 'x1': 3300, 'y0': -OUTER - 500, 'y1': OUTER + 500},
    'runways': runways, 'taxiways': taxiways, 'concourses': concourses, 'remote': remote, 'bays': bays,
    'buildings': buildings, 'apm': apm, 'landside': landside, 'aprons': aprons, 'stacks': [],
    'roof': roof, 'forecourt': forecourt, 'dna': dna, 'phase2': phase2,
}
json.dump(spec, open(os.path.join(D, 'spec.json'), 'w', encoding='utf-8'), separators=(',', ':'))

# ---------------------------------------------------------------- validation
def validate():
    from collections import defaultdict, deque
    def key(p): return (round(p[0]), round(p[1]))
    pts = [p for t in taxiways for p in t['pts']]
    allg = [g for c in concourses for g in c['gates']] + remote
    extra = [g['lane'] for g in allg] + [b['lane'] for b in bays]
    extra += [[h['x'], h['y']] for r in runways for h in r['holds']] + [e['to'] for r in runways for e in r['exits']]
    adj = defaultdict(set)      # directed, as the game builds it
    und = defaultdict(set)
    def on(p, a, b):
        dx, dy = b[0]-a[0], b[1]-a[1]; L2 = dx*dx+dy*dy
        t = ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / L2
        if t <= 0.0005 or t >= 0.9995: return None
        return t if math.hypot(a[0]+dx*t-p[0], a[1]+dy*t-p[1]) < 1.6 else None
    segs = [(a, b, t['oneway']) for t in taxiways for a, b in zip(t['pts'], t['pts'][1:])]
    cuts = defaultdict(list)
    for i, (a, b, _) in enumerate(segs):
        for p in pts + extra:
            u = on(p, a, b)
            if u is not None: cuts[i].append((u, p))
    for i in range(len(segs)):            # true crossings
        a, b, _ = segs[i]
        for j in range(i + 1, len(segs)):
            c, d, _ = segs[j]
            r1, r2 = (b[0]-a[0], b[1]-a[1]), (d[0]-c[0], d[1]-c[1]); den = r1[0]*r2[1]-r1[1]*r2[0]
            if abs(den) < 1e-6: continue
            t = ((c[0]-a[0])*r2[1]-(c[1]-a[1])*r2[0]) / den; u = ((c[0]-a[0])*r1[1]-(c[1]-a[1])*r1[0]) / den
            if 0.0005 < t < 0.9995 and 0.0005 < u < 0.9995:
                x, y = a[0]+r1[0]*t, a[1]+r1[1]*t
                cuts[i].append((t, [x, y])); cuts[j].append((u, [x, y]))
    for i, (a, b, one) in enumerate(segs):
        chain = [a] + [p for _, p in sorted(cuts[i], key=lambda q: q[0])] + [b]
        for u, v in zip(chain, chain[1:]):
            if key(u) == key(v): continue
            adj[key(u)].add(key(v)); und[key(u)].add(key(v)); und[key(v)].add(key(u))
            if not one: adj[key(v)].add(key(u))
    for p in extra: assert key(p) in und, f'point {p} not on any taxiway'
    def reach(s):
        seen = {s}; q = deque([s])
        while q:
            u = q.popleft()
            for v in adj[u]:
                if v not in seen: seen.add(v); q.append(v)
        return seen
    holds = [key([h['x'], h['y']]) for r in runways for h in r['holds']]
    lanes = [key(g['lane']) for g in allg] + [key(b['lane']) for b in bays]
    for r in runways:                     # every exit reaches every stand and bay
        for e in r['exits']:
            R = reach(key(e['to'])); miss = [l for l in lanes if l not in R]
            assert not miss, f'{r["id"]} exit {e["x"]}: {len(miss)} stands unreachable, e.g. {miss[:3]}'
    sample = lanes[::7] + [key(b['lane']) for b in bays]
    for l in sample:                      # stands reach every hold, and holds reach every hold (re-routes)
        R = reach(l); miss = [h for h in holds if h not in R]
        assert not miss, f'stand lane {l}: holds unreachable {miss}'
    for h in holds:
        R = reach(h); miss = [k for k in holds + lanes[::11] if k not in R]
        assert not miss, f'hold {h}: {len(miss)} unreachable'
    # stand overlaps: same face/row stands must not overlap (MARS siblings excepted)
    for i, g in enumerate(allg):
        for h in allg[i+1:]:
            if g.get('mars') and g.get('mars') == h.get('mars'): continue
            if g['nose'] != h['nose'] or abs(g['x'] - h['x']) > 30: continue
            if g in remote or h in remote:
                lim = (RW_.get(g['code'], 50) + RW_.get(h['code'], 50)) / 2 - 1
                if abs(g['y'] - h['y']) < 30 and abs(g['x'] - h['x']) < lim - 50: raise AssertionError(f'overlap {g["id"]} {h["id"]}')
            elif abs(g['y'] - h['y']) < (GLEN[g['code']] + GLEN[h['code']]) / 2 - 1:
                raise AssertionError(f'overlap {g["id"]} {h["id"]}')
    for g in allg + bays:
        for r in runways:
            assert abs(g['y'] - r['y']) > 280, f'{g["id"]} too close to {r["id"]}'
    # runway spacing against Annex 14 Rec 3.1.12
    ys = sorted(r['y'] for r in runways)
    gaps = [ys[i+1] - ys[i] for i in range(len(ys) - 1)]
    assert min(gaps) >= 1035, f'runway spacing {gaps} below 1,035 m'
    for k, y in PAR.items():
        for r in runways:
            assert abs(y - r['y']) >= 180 or abs(y - r['y']) < 1, f'parallel {k} within 180 m of {r["id"]}'
    phys = [g for g in allg if not g.get('marsOf')]
    wide = [g for g in phys if g['code'] in 'EF']
    pos = sum(2 if g.get('marsRole') == 'wide' else 1 for g in phys)
    contact = [g for c in concourses for g in c['gates'] if not g.get('marsOf')]
    far = max(abs(g['y']) for g in contact)
    print('runways', len(runways), '| spacing', gaps, '| taxiway nodes', len(und), '| one-way segments', sum(1 for s in segs if s[2]))
    print('stands', len(phys), f'(contact {len(contact)}, remote {len([g for g in remote if not g.get("marsOf")])})',
          '| aircraft positions', pos, '| MARS', sum(1 for g in phys if g.get('marsRole') == 'wide'),
          f'| E/F capable {len(wide)} = {100*len(wide)/len(phys):.0f}%', '| swing', sum(1 for g in phys if g['zone'] == 'swing'),
          '| holding bays', len(bays), '| farthest contact stand', far, 'm from the Mall centre line')
    for code in 'CEF':
        print(' code', code, sum(1 for g in phys if g['code'] == code), {z: sum(1 for g in phys if g['code'] == code and g['zone'] == z) for z in ('dom', 'intl', 'swing')})
    print('roof', roof['areas'], '| skylights', len(sk), '| columns', len(cols), '| gardens', len(gd), '| jaali runs', len(ja))
    print('lobes', [(l['id'], l['compass']) for l in lobes])
    print('VALID')
validate()
