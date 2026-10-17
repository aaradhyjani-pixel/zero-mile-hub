"""Zero Mile International (ZMI): parametric master plan generator.

Writes spec.json (geometry the simulation routes on), masterplan.svg and roof.svg.
Frame: metres, x east, y south, origin at the airport centre. Headings: degrees clockwise from north.
All runways run 09/27 (east-west). West flow: land and take off heading 270, thresholds at the EAST end.
"""
import json, math, os
D = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- runways
# Two triples either side of a 3.6 km midfield. Outer and middle runways 1,550 m apart (independent
# parallel approaches need 1,525 m); middle and inner 850 m apart (segregated / independent departures need 760 m).
X1 = 1800  # all landing thresholds line up at x = 1800 (east end)
RW = [
    # id, name, y, length, role, side (+1 north group, -1 south group)
    ('R1', '09L/27R', -4200, 4000, 'arr', 1),
    ('R2', '09C/27C', -2650, 3800, 'arr', 1),
    ('R3', '09R/27L', -1800, 4500, 'dep', 1),
    ('R4', '10L/28R',  1800, 4000, 'dep', -1),
    ('R5', '10C/28C',  2650, 3800, 'dep', -1),
    ('R6', '10R/28L',  4200, 4000, 'arr', -1),
]
EAT_W, EAT_E = -3300, 2700          # end-around taxiways, west and east
PAR = {  # parallel taxiway y between / beside runways (midfield parallels at +/-1600)
    'N12': -3425, 'N23': -2225, 'N3': -1600, 'S3': 1600, 'S45': 2225, 'S56': 3425,
}
runways, taxiways = [], []
def tw(id_, pts, oneway=False):
    taxiways.append({'id': id_, 'oneway': oneway, 'pts': [[round(x), round(y)] for x, y in pts]})

par_for = {'R1': 'N12', 'R2': 'N23', 'R3': 'N3', 'R4': 'S3', 'R5': 'S45', 'R6': 'S56'}
for rid, name, y, ln, role, side in RW:
    x0, x1 = X1 - ln, X1
    py = PAR[par_for[rid]]
    hold = (x1 + 80, y + 150 * side)      # on the midfield side of each runway's east end
    exits = []
    off = {'R1': 300, 'R2': 250, 'R3': 160, 'R4': 160, 'R5': 250, 'R6': 300}[rid]
    for ex in (-450, -850, -1250):
        exits.append({'x': ex, 'to': [ex - off, py]})
    runways.append({'id': rid, 'name': name, 'y': y, 'x0': x0, 'x1': x1, 'width': 60, 'role': role,
                    'longest': ln == 4500, 'exits': exits, 'holds': [{'x': hold[0], 'y': hold[1]}]})
    tw('H' + rid, [(hold[0], py), hold])                      # hold stub

# parallels and end-arounds
for k, y in PAR.items():
    tw('P' + k, [(EAT_W, y), (EAT_E, y)])
tw('EATWN', [(EAT_W, PAR['N12']), (EAT_W, PAR['N23']), (EAT_W, PAR['N3'])])
tw('EATWS', [(EAT_W, PAR['S3']), (EAT_W, PAR['S45']), (EAT_W, PAR['S56'])])
tw('EATEN', [(EAT_E, PAR['N3']), (EAT_E, PAR['N23']), (EAT_E, PAR['N12'])])
tw('EATES', [(EAT_E, PAR['S3']), (EAT_E, PAR['S45']), (EAT_E, PAR['S56'])])

# ---------------------------------------------------------------- concourses
# Six north-south concourses, each split into a north and a south pier around the central spine (the Mall).
CX = [-1440, -1120, -800, -480, -160, 160]
NAMES = ['A', 'B', 'C', 'D', 'E', 'F']
ZONES = ['dom', 'dom', 'dom', 'swing', 'intl', 'intl']
HALF_W = 26                         # half-width of a pier building
PIER = (160, 760)                   # pier runs from |y| = 160 (spine) to 760
LANES = [-1600, -1280, -960, -640, -320, 0, 320]
GLEN = {'C': 46, 'E': 82, 'F': 92}  # stand width along the face
GOFF = {'C': 26, 'E': 40, 'F': 46}  # aircraft centre offset from the face
PATTERN = {
    'dom':   ['E'] + ['C'] * 9,
    'swing': ['F', 'E'] + ['C'] * 5 + ['E', 'F'],
    'intl':  ['F', 'E', 'E'] + ['C'] * 3 + ['E', 'E'],
}
concourses = []
gid = 0
for ci, (cx, nm, zn) in enumerate(zip(CX, NAMES, ZONES)):
    for half, sgn in (('N', -1), ('S', 1)):
        gates = []
        for face in (-1, 1):                      # west face, east face
            lane_x = cx + face * 160
            pat = PATTERN[zn]
            total = sum(GLEN[c] for c in pat)
            pos = PIER[0] + (PIER[1] - PIER[0] - total) / 2 + 10
            for code in pat:
                gid += 1
                cyy = sgn * (pos + GLEN[code] / 2)
                pos += GLEN[code]
                gx = cx + face * (HALF_W + GOFF[code])
                nose = 90 if face == -1 else 270     # nose faces the building
                gates.append({'id': f'{nm}{half}{len(gates)+1:02d}', 'x': round(gx), 'y': round(cyy), 'nose': nose,
                              'code': code, 'zone': zn, 'bridge': True, 'lane': [lane_x, round(cyy)]})
        y0, y1 = sorted((sgn * PIER[0], sgn * PIER[1]))
        # pier outline: a long capsule with a soft waist, drawn with curves
        w0, w1 = HALF_W, HALF_W + 9
        far, near = (y1, y0) if sgn > 0 else (y0, y1)
        mid = (y0 + y1) / 2
        d = (f"M{cx-w0} {near} C{cx-w0} {mid} {cx-w1} {mid} {cx-w0} {far-sgn*40} "
             f"Q{cx-w0} {far+sgn*14} {cx} {far+sgn*18} Q{cx+w0} {far+sgn*14} {cx+w0} {far-sgn*40} "
             f"C{cx+w1} {mid} {cx+w0} {mid} {cx+w0} {near} Z")
        concourses.append({'id': f'{nm}{half}', 'name': f'Concourse {nm} {"North" if half=="N" else "South"}',
                           'zone': zn, 'outline': d, 'apm': [cx, 0], 'gates': gates})

# lanes between piers: north and south legs (the Mall blocks the middle except for the outer lanes)
for lx in LANES:
    ys_n = sorted({g['lane'][1] for c in concourses for g in c['gates'] if g['lane'][0] == lx and g['lane'][1] < 0})
    ys_s = sorted({g['lane'][1] for c in concourses for g in c['gates'] if g['lane'][0] == lx and g['lane'][1] > 0})
    if lx == 320:            # only the east lane runs the full depth; the Mall blocks the rest
        tw(f'L{lx}', [(lx, PAR['N3'])] + [(lx, y) for y in ys_n] + [(lx, y) for y in ys_s] + [(lx, PAR['S3'])])
    else:
        tw(f'L{lx}N', [(lx, PAR['N3'])] + [(lx, y) for y in ys_n] + [(lx, -200)])
        tw(f'L{lx}S', [(lx, 200)] + [(lx, y) for y in ys_s] + [(lx, PAR['S3'])])

# ---------------------------------------------------------------- remote stands and east zone
remote = []
RLANE = {'N': -1000, 'S': 1000}
rid = 0
for half, ly in RLANE.items():
    x = 470
    xs = []
    seq = (['C'] * 7 + ['E']) * 6
    for i, code in enumerate(seq):
        w = 50 if code == 'C' else 86
        if x + w > 2520: break
        cx_ = x + w / 2
        for side in (-1, 1):                         # north and south of the lane
            rid += 1
            off = 64 if code == 'C' else 80
            remote.append({'id': f'R{rid:03d}', 'x': round(cx_), 'y': round(ly + side * off), 'nose': 0 if side == -1 else 180,
                           'code': code, 'zone': 'swing', 'lane': [round(cx_), ly]})
        xs.append(round(cx_))
        x += w
    tw(f'RL{half}', [(320, ly)] + [(xx, ly) for xx in xs] + [(2600, ly)])
tw('CNE', [(2600, PAR['N3']), (2600, RLANE['N']), (2600, 0), (2600, RLANE['S']), (2600, PAR['S3'])])
tw('TC', [(320, 0), (2600, 0), (EAT_E, 0)])
tw('TCE', [(EAT_E, PAR['N3']), (EAT_E, 0), (EAT_E, PAR['S3'])])

# ---------------------------------------------------------------- buildings
def rect(x0, y0, x1, y1, r=0):
    if not r: return f"M{x0} {y0} H{x1} V{y1} H{x0} Z"
    return (f"M{x0+r} {y0} H{x1-r} Q{x1} {y0} {x1} {y0+r} V{y1-r} Q{x1} {y1} {x1-r} {y1} H{x0+r} "
            f"Q{x0} {y1} {x0} {y1-r} V{y0+r} Q{x0} {y0} {x0+r} {y0} Z")
def blob(cx, cy, rx, ry, n=7, amp=0.12, phase=0.3, steps=96):
    pts = []
    for i in range(steps):
        t = 2 * math.pi * i / steps
        k = 1 + amp * math.cos(n * t + phase)
        pts.append((cx + rx * k * math.cos(t), cy + ry * k * math.sin(t)))
    return 'M' + ' L'.join(f'{x:.0f} {y:.0f}' for x, y in pts) + ' Z'
# the processor: seven-lobed "orange" plan, the Zero Mile Hall
proc = blob(-2380, 0, 600, 720, n=7, amp=0.09, phase=math.pi)
# the Mall: a long fluid spine joining every pier, waisted between concourses
spine_top, spine_bot = [], []
for i in range(0, 61):
    x = -1860 + i * (2140 / 60)
    w = 120 + 26 * math.cos((x + 1440) / 320 * 2 * math.pi)
    spine_top.append((x, -w)); spine_bot.append((x, w))
mall = 'M' + ' L'.join(f'{x:.0f} {y:.0f}' for x, y in spine_top) + ' L' + ' L'.join(f'{x:.0f} {y:.0f}' for x, y in reversed(spine_bot)) + ' Z'
buildings = [
    {'id': 'ZMH', 'kind': 'processor', 'label': 'Zero Mile Hall', 'outline': proc},
    {'id': 'MALL', 'kind': 'processor', 'label': 'The Mall', 'outline': mall},
    {'id': 'TWR', 'kind': 'tower', 'label': 'ATC tower', 'outline': blob(1000, 0, 38, 38, n=6, amp=0.05)},
    {'id': 'F1', 'kind': 'fire', 'label': 'Fire 1', 'outline': rect(1050, -1460, 1230, -1360, 8)},
    {'id': 'F2', 'kind': 'fire', 'label': 'Fire 2', 'outline': rect(1050, 1360, 1230, 1460, 8)},
    {'id': 'F3', 'kind': 'fire', 'label': 'Fire 3', 'outline': rect(-3900, -260, -3720, -160, 8)},
    {'id': 'CGO', 'kind': 'cargo', 'label': 'Cargo', 'outline': rect(1350, -720, 2450, -260, 20)},
    {'id': 'MRO', 'kind': 'mro', 'label': 'MRO hangars', 'outline': rect(1350, 260, 2450, 720, 20)},
    {'id': 'FUEL', 'kind': 'fuel', 'label': 'Fuel farm', 'outline': rect(3300, -900, 3900, -400, 30)},
    {'id': 'RAIL', 'kind': 'rail', 'label': 'High-speed rail', 'outline': rect(-4000, 500, -3150, 640, 30)},
    {'id': 'PARK', 'kind': 'other', 'label': 'Car park', 'outline': rect(-3700, -700, -3150, -360, 20)},
]
aprons = [
    rect(-1720, -1560, 420, 1560, 30),
    rect(420, -1180, 2650, -820, 20), rect(420, 820, 2650, 1180, 20),
    rect(1300, -800, 2560, -180, 20), rect(1300, 180, 2560, 800, 20),
]
apm = {'pts': [[-2380, 0], [160, 0]], 'stations': [{'id': 'ZMH', 'x': -2380, 'y': 0}] + [{'id': n, 'x': x, 'y': 0} for n, x in zip(NAMES, CX)]}
landside = [
    {'kind': 'road', 'pts': [[-9000, -60], [-5200, -60], [-3600, -40], [-2980, 0]]},
    {'kind': 'road', 'pts': [[-5200, -60], [-6400, -2600], [-8200, -5600]]},
    {'kind': 'rail', 'pts': [[-9000, 600], [-4000, 600], [-2600, 580]]},
    {'kind': 'road', 'pts': [[3300, -650], [5200, -900], [9000, -1400]]},
]
spec = {
    'name': 'Zero Mile International Airport', 'short_title': 'Zero Mile Hub', 'code': 'ZMI',
    'tagline': 'Every journey in India passes through its centre. Six runways, one roof, 372 stands, built at the Zero Mile in Nagpur.',
    'extent': {'x0': -4300, 'x1': 3300, 'y0': -4700, 'y1': 4700},
    'runways': runways, 'taxiways': taxiways, 'concourses': concourses, 'remote': remote,
    'buildings': buildings, 'apm': apm, 'landside': landside, 'aprons': aprons, 'stacks': [],
}
json.dump(spec, open(os.path.join(D, 'spec.json'), 'w'), separators=(',', ':'))

# ---------------------------------------------------------------- validation
def validate():
    from collections import defaultdict
    nodes = {}
    def key(p): return (round(p[0]), round(p[1]))
    segs = []
    for t in taxiways:
        for a, b in zip(t['pts'], t['pts'][1:]): segs.append((a, b))
    pts = [p for t in taxiways for p in t['pts']]
    extra = [g['lane'] for c in concourses for g in c['gates']] + [g['lane'] for g in remote]
    extra += [[h['x'], h['y']] for r in runways for h in r['holds']] + [e['to'] for r in runways for e in r['exits']]
    adj = defaultdict(set)
    def on(p, a, b):
        dx, dy = b[0]-a[0], b[1]-a[1]; L2 = dx*dx+dy*dy
        t = ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / L2
        if t <= 0 or t >= 1: return None
        return t if math.hypot(a[0]+dx*t-p[0], a[1]+dy*t-p[1]) < 1.6 else None
    for a, b in segs:
        cuts = sorted([(on(p, a, b), p) for p in pts + extra if on(p, a, b) is not None])
        chain = [a] + [p for _, p in cuts] + [b]
        for u, v in zip(chain, chain[1:]): adj[key(u)].add(key(v)); adj[key(v)].add(key(u))
    for p in extra: assert key(p) in adj, f'point {p} not on any taxiway'
    start = key(runways[0]['holds'][0]['x'], ) if False else key([runways[0]['holds'][0]['x'], runways[0]['holds'][0]['y']])
    seen = {start}; stack = [start]
    while stack:
        u = stack.pop()
        for v in adj[u]:
            if v not in seen: seen.add(v); stack.append(v)
    missing = [p for p in extra if key(p) not in seen]
    assert not missing, f'{len(missing)} points unreachable, e.g. {missing[:3]}'
    allg = [g for c in concourses for g in c['gates']] + remote
    # overlaps: same face/row stands must not overlap
    for i, g in enumerate(allg):
        for h in allg[i+1:]:
            if abs(g['x']-h['x']) < 20 and abs(g['y']-h['y']) < (GLEN[g['code']]+GLEN[h['code']])/2 - 1 and g['nose'] == h['nose']:
                raise AssertionError(f'overlap {g["id"]} {h["id"]}')
    for g in allg:
        for r in runways:
            assert abs(g['y']-r['y']) > 300, f'{g["id"]} too close to {r["id"]}'
    by = defaultdict(int)
    for g in allg: by[(g['code'], g['zone'], 'contact' if g in remote and False or 'bridge' in g else 'remote')] += 1
    contact = sum(1 for c in concourses for g in c['gates'])
    print('runways', len(runways), '| taxiway nodes', len(adj), '| reachable', len(seen))
    print('stands', len(allg), '| contact', contact, '| remote', len(remote))
    for code in 'CEF':
        print(' code', code, sum(1 for g in allg if g['code'] == code), {z: sum(1 for g in allg if g['code'] == code and g['zone'] == z) for z in ('dom', 'intl', 'swing')})
    print('VALID')
validate()
