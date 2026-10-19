"""Draws masterplan.svg and roof.svg for Vikram Sarabhai International from spec.json."""
import json, math, os, random
D = os.path.dirname(os.path.abspath(__file__))
S = json.load(open(os.path.join(D, 'spec.json')))
F = "Barlow Condensed, Barlow, sans-serif"
FB = "Barlow, sans-serif"
ARR, DEP, SAND, INK, INK2, INK3, SIGN = '#8a7cff', '#2fd3c6', '#e4dccb', '#ece7da', '#a6afb4', '#6f7a80', '#f4c430'
APM_C, MARS_C, XFER, GARDEN, JAALI, STONE, WATER = '#6aa3ff', '#ff8a5c', '#ff5fa2', '#6fbf73', '#d9894a', '#b8925f', '#5fb7d9'
ROOF_EDGE = '#6e5c3b'

def poly(pts): return 'M' + ' L'.join(f'{x:.0f} {y:.0f}' for x, y in pts)
def rd(v): return int(math.floor(v + .5))
def bearing_dir(b):          # compass bearing -> unit vector in the drawing frame (x east, y south)
    r = math.radians(b); return math.sin(r), -math.cos(r)
def txt(x, y, s, size, fill=INK2, weight=None, anchor=None, fam=F, extra=''):
    w = f' font-weight="{weight}"' if weight else ''
    a = f' text-anchor="{anchor}"' if anchor else ''
    return f'<text x="{x:.0f}" y="{y:.0f}" fill="{fill}" font-family="{fam}" font-size="{size}"{w}{a}{extra}>{s}</text>'

# ------------------------------------------------------------------ counts from the spec
gates = [g for c in S['concourses'] for g in c['gates']]
def stand_counts(lst):
    phys = [g for g in lst if not g.get('marsOf')]
    mars = [g for g in lst if g.get('marsRole') == 'wide']
    return len(phys), len(mars), len(phys) + len(mars)       # stands, MARS, max aircraft (a MARS takes two narrowbodies)
c_st, c_m, c_pos = stand_counts(gates)
r_st, r_m, r_pos = stand_counts(S['remote'])
n_bays = len(S['bays'])
DNA = {m['lobe']: m for m in S['dna']['merged']}
LOBES = {l['id']: l for l in S['dna']['lobes']}
hall = next(b for b in S['buildings'] if b['id'] == 'ZMH')
mall = next(b for b in S['buildings'] if b['id'] == 'MALL')
OC = S['roof']['oculus']

# ------------------------------------------------------------------ master plan
VB = (-5000, -5750, 12600, 11550)
PX = 4350                                         # right-hand panel
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VB[0]} {VB[1]} {VB[2]} {VB[3]}" role="img" '
     f'aria-label="Master plan of Vikram Sarabhai International: six east-west runways in two triples, the seven-lobed Zero Mile Hall to the west with three gateway lobes pointing at Ahmedabad, Mumbai and Bengaluru, one continuous roof over the Hall, the Mall and twelve piers, remote stands, cargo and maintenance to the east, and phase 2 satellites shown dashed.">']
o.append('<defs>'
         '<linearGradient id="roofg" gradientUnits="userSpaceOnUse" x1="-2900" y1="-700" x2="300" y2="700"><stop offset="0" stop-color="#f6ecd5"/><stop offset=".45" stop-color="#eadbb8"/><stop offset="1" stop-color="#d6c49d"/></linearGradient>'
         '<marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1 L9 5 L1 9" fill="none" stroke="context-stroke" stroke-width="1.8"/></marker>'
         f'<marker id="ahs" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="{SIGN}"/></marker>'
         f'<pattern id="p2" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="60" height="60" fill="none"/><path d="M0 0 V60" stroke="{SAND}" stroke-width="8" opacity=".22"/></pattern>'
         '</defs>')
o.append(f'<rect x="{VB[0]}" y="{VB[1]}" width="{VB[2]}" height="{VB[3]}" fill="#0f1417"/>')
# farmland texture, quiet, kept out of the field and the panel
rnd = random.Random(4)
for _ in range(300):
    x, y = rnd.uniform(VB[0], VB[0] + VB[2]), rnd.uniform(VB[1], VB[1] + VB[3])
    if -4700 < x < 4000 and -5300 < y < 5300: continue
    if x > PX - 200: continue
    w, h = rnd.uniform(250, 800), rnd.uniform(200, 600)
    c = rnd.choice(['#141b1d', '#161d1a', '#13191c', '#18201b'])
    o.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="{w:.0f}" height="{h:.0f}" fill="{c}" transform="rotate({rnd.uniform(-12,12):.1f} {x:.0f} {y:.0f})"/>')
# boundary
E = S['extent']
o.append(f'<rect x="{E["x0"]-200}" y="{E["y0"]-200}" width="{E["x1"]-E["x0"]+400}" height="{E["y1"]-E["y0"]+400}" rx="120" fill="#161e1f" stroke="#2c3a3c" stroke-width="16" stroke-dasharray="80 50"/>')
# landside: roads, then rail (both rail lines run below ground near the terminal)
for l in S['landside']:
    if l['kind'] == 'road':
        o.append(f'<path d="{poly(l["pts"])}" fill="none" stroke="#3b4247" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>')
for l in S['landside']:
    if l['kind'] == 'rail':
        o.append(f'<path d="{poly(l["pts"])}" fill="none" stroke="#9aa3ad" stroke-width="18" stroke-opacity=".18" stroke-linejoin="round"/>'
                 f'<path d="{poly(l["pts"])}" fill="none" stroke="#c3cad1" stroke-opacity=".55" stroke-width="6" stroke-dasharray="50 34"/>')
for a in S['aprons']: o.append(f'<path d="{a}" fill="#262d31"/>')
# phase 2 remote aprons at the pier tips (ghosted)
for a in S['phase2']['remote_aprons']:
    o.append(f'<path d="{a}" fill="url(#p2)" stroke="{SAND}" stroke-opacity=".5" stroke-width="10" stroke-dasharray="60 40"/>')
# taxiways
TW_W = {'taxiway': 30, 'taxilane': 22, 'pad': 26, 'bay': 26}
for t in S['taxiways']:
    o.append(f'<path d="{poly(t["pts"])}" fill="none" stroke="#353c41" stroke-width="{TW_W.get(t["kind"], 30)}" stroke-linecap="round" stroke-linejoin="round"/>')
for r in S['runways']:
    for e in r['exits']:
        o.append(f'<path d="M{e["x"]+260} {r["y"]} L{e["x"]} {r["y"]} L{e["to"][0]} {e["to"][1]}" fill="none" stroke="#353c41" stroke-width="30" stroke-linejoin="round"/>')
for t in S['taxiways']:
    o.append(f'<path d="{poly(t["pts"])}" fill="none" stroke="#b98f1c" stroke-opacity=".55" stroke-width="5"/>')
# one-way arrows (point order is direction of travel)
def chevron(cx, cy, ux, uy, L=130, col=SIGN):
    nx, ny = -uy, ux
    p = [(cx + ux * L / 2, cy + uy * L / 2), (cx - ux * L / 2 + nx * L * .42, cy - uy * L / 2 + ny * L * .42),
         (cx - ux * L * .2, cy - uy * L * .2), (cx - ux * L / 2 - nx * L * .42, cy - uy * L / 2 - ny * L * .42)]
    return f'<path d="{poly(p)} Z" fill="{col}" opacity=".9"/>'
for t in S['taxiways']:
    if not t['oneway']: continue
    step = 1100 if t['kind'] == 'taxiway' else 250
    for (x0, y0), (x1, y1) in zip(t['pts'], t['pts'][1:]):
        d = math.hypot(x1 - x0, y1 - y0)
        if d < 90: continue
        ux, uy = (x1 - x0) / d, (y1 - y0) / d
        n = max(1, int(d // step))
        for i in range(n):
            s = (i + .5) * d / n
            o.append(chevron(x0 + ux * s, y0 + uy * s, ux, uy, 130 if t['kind'] == 'taxiway' else 90))
# runways
for r in S['runways']:
    x0, x1, y, w = r['x0'], r['x1'], r['y'], r['width']
    col = ARR if r['role'] == 'arr' else DEP
    o.append(f'<rect x="{x0}" y="{y-w/2-14}" width="{x1-x0}" height="{w+28}" fill="#3d4246"/><rect x="{x0}" y="{y-w/2}" width="{x1-x0}" height="{w}" fill="#2b2e31"/>')
    for x in range(int(x0) + 250, int(x1) - 250, 120): o.append(f'<rect x="{x}" y="{y-3}" width="60" height="6" fill="#e9e6dd" opacity=".85"/>')
    for xx in (x0 + 10, x1 - 70):
        for i in range(6): o.append(f'<rect x="{xx}" y="{y-w/2+4+i*9.2}" width="60" height="5" fill="#e9e6dd" opacity=".9"/>')
    o.append(f'<rect x="{x0}" y="{y-w/2-14}" width="{x1-x0}" height="{w+28}" fill="{col}" opacity=".16"/>')
    lab = r['name'].split('/')
    o.append(txt(x0 - 90, y + 30, lab[0], 110, INK2, 600, 'end'))
    o.append(txt(x1 + 90, y + 30, lab[1], 110, INK, 700))
    tag = ('ARRIVALS' if r['role'] == 'arr' else 'DEPARTURES') + f' · {x1-x0:,} m'
    o.append(txt((x0 + x1) / 2, y - w / 2 - 50, tag, 96, col, 600, 'middle', extra=' letter-spacing="6"'))
    o.append(f'<path d="M{x1+1650} {y} L{x1+260} {y}" stroke="{ARR}" stroke-width="16" fill="none" marker-end="url(#ah)" opacity=".8"/>')
    for p in r.get('pads') or []:     # heat pads beside the long runway's hold
        o.append(f'<rect x="{p["x"]-40}" y="{p["y"]-34}" width="80" height="68" rx="10" fill="#e0703a" opacity=".85"/>')
lr = next(r for r in S['runways'] if r.get('pads'))
pp = lr['pads']
o.append(txt(pp[-1]['x'] + 160, pp[-1]['y'] + 24, 'HEAT PADS', 64, '#f09a6a', 600))
o.append(txt(pp[-1]['x'] + 160, pp[-1]['y'] + 90, f'step-aside loop, {lr["name"].split("/")[1]}', 52, INK3))
# end-around labels
o.append(txt(-3420, -2700, 'END-AROUND', 80, SIGN, 600, 'end') + txt(-3420, -2610, 'no runway crossings', 62, INK2, None, 'end'))
o.append(txt(-3420, 2700, 'END-AROUND', 80, SIGN, 600, 'end') + txt(-3420, 2790, 'no runway crossings', 62, INK2, None, 'end'))
# holding bays
for b in S['bays']:
    o.append(f'<rect x="{b["x"]-46}" y="{b["y"]-40}" width="92" height="80" rx="8" fill="none" stroke="{SIGN}" stroke-width="7" opacity=".8"/>')
for sgn in (-1, 1):
    o.append(txt(-3330, sgn * 1385 + 22, 'HOLDING BAYS', 60, SIGN, 600, 'end'))
# buildings other than the roof
for b in S['buildings']:
    k = b['kind']
    if b['id'] in ('ZMH', 'MALL'): continue
    if k == 'court':      # stepwell forecourt: stepped terraces down to a pool
        fc = S['forecourt']; n = len(fc['levels'])
        for i in range(n):
            ins = i * 22
            o.append(f'<rect x="{fc["x0"]+ins}" y="{fc["y0"]+ins}" width="{fc["x1"]-fc["x0"]-2*ins}" height="{fc["y1"]-fc["y0"]-2*ins}" rx="{max(6,40-ins)}" '
                     f'fill="{STONE}" fill-opacity="{0.35+0.12*i:.2f}" stroke="#d8b483" stroke-width="5"/>')
        pl = fc['pool']
        o.append(f'<rect x="{pl["x"]-pl["w"]/2}" y="{pl["y"]-pl["l"]/2}" width="{pl["w"]}" height="{pl["l"]}" rx="8" fill="{WATER}"/>')
    elif k == 'rail':
        o.append(f'<path d="{b["outline"]}" fill="#9aa3ad" fill-opacity=".45" stroke="#c3cad1" stroke-width="8" stroke-dasharray="30 20"/>')
    else:
        fill = {'tower': '#c9cfd4', 'fire': '#b8423a', 'cargo': '#5b5f63', 'mro': '#4f5559', 'fuel': '#55524c', 'other': '#2f3639'}.get(k, '#3d4448')
        o.append(f'<path d="{b["outline"]}" fill="{fill}"/>')
# phase 2: satellites G and H and their APM lines (ghosted)
for s in S['phase2']['satellites']:
    o.append(f'<path d="{s["outline"]}" fill="{SAND}" fill-opacity=".18" stroke="{SAND}" stroke-opacity=".7" stroke-width="10" stroke-dasharray="50 30"/>')
for ln in S['phase2']['apm']:
    o.append(f'<path d="{poly(ln["pts"])}" stroke="{APM_C}" stroke-opacity=".55" stroke-width="12" stroke-dasharray="30 40" fill="none"/>')
    for x, y in ln['stations']: o.append(f'<circle cx="{x}" cy="{y}" r="28" fill="#0f1417" stroke="{APM_C}" stroke-opacity=".6" stroke-width="8" stroke-dasharray="12 8"/>')
for s in S['phase2']['satellites']:
    o.append(txt(520, s['y'] + 38, s['id'], 110, SAND, 700, 'end', extra=' opacity=".75"'))
# ---- one continuous roof: Hall + Mall + piers. Thick dark stroke under all fills, then the fills on top.
ROOF = [hall['outline'], mall['outline']] + [c['outline'] for c in S['concourses']]
cant = S['roof']['cantilevers'][0]
o.append(f'<path d="{poly(cant["pts"])}" fill="none" stroke="{ROOF_EDGE}" stroke-width="{2*cant["depth"]+24}" stroke-linejoin="round" stroke-linecap="round"/>')
for d in ROOF: o.append(f'<path d="{d}" fill="none" stroke="{ROOF_EDGE}" stroke-width="24" stroke-linejoin="round"/>')
o.append(f'<path d="{poly(cant["pts"])}" fill="none" stroke="#f3e9d2" stroke-width="{2*cant["depth"]}" stroke-linejoin="round" stroke-linecap="round"/>')
for d in ROOF: o.append(f'<path d="{d}" fill="url(#roofg)"/>')
# roof valleys and gardens, quietly
for v in S['roof']['valleys']:
    o.append(f'<path d="{poly(v["pts"])}" stroke="#a88e5c" stroke-width="9" fill="none" opacity=".7"/>')
for g in S['roof']['gardens']:
    if g['kind'] == 'belt':
        o.append(f'<rect x="{g["x"]-g["w"]/2}" y="{g["y"]-g["l"]/2}" width="{g["w"]}" height="{g["l"]}" rx="20" fill="{GARDEN}" opacity=".85"/>')
    elif g['kind'] in ('valley', 'court'):
        o.append(f'<circle cx="{g["x"]}" cy="{g["y"]}" r="{g["r"]}" fill="{GARDEN}" opacity=".85"/>')
    elif g['kind'] == 'oculus':
        o.append(f'<circle cx="{g["x"]}" cy="{g["y"]}" r="{g["r"]}" fill="none" stroke="{GARDEN}" stroke-width="16" opacity=".85"/>')
# gateway axes: from the oculus through the gateway tips, then an arrow on the city's bearing
GW = [('WNW', -1, 900), ('WSW', 1, 900), ('S', 1, 470)]
for lid, sgn, L in GW:
    tip = LOBES[lid]['tip']; m = DNA[lid]
    o.append(f'<path d="M{OC["x"]} {OC["y"]} L{tip[0]} {tip[1]}" stroke="{SIGN}" stroke-width="10" stroke-dasharray="36 22" fill="none"/>')
    ux, uy = bearing_dir(m['bearing'])
    ex, ey = tip[0] + ux * L, tip[1] + uy * L
    o.append(f'<path d="M{tip[0]} {tip[1]} L{ex:.0f} {ey:.0f}" stroke="{SIGN}" stroke-width="18" fill="none" marker-end="url(#ah)"/>')
    if lid == 'S':
        lx, ly, an = ex, ey + 150, 'middle'
        o.append(txt(lx, ly, f'{m["city"].upper()} · {m["code"]} → {rd(m["bearing"])}°', 84, SIGN, 700, an))
        o.append(txt(lx, ly + 75, f'{lid} lobe faces {rd(LOBES[lid]["compass"])}°, {m["km"]} km', 56, INK2, None, an))
    else:
        lx, ly = ex - 50, ey + (-60 if sgn < 0 else 80)
        o.append(txt(lx, ly, m['city'].upper(), 96, SIGN, 700, 'end'))
        o.append(txt(lx, ly + 90, f'{m["code"]} → {rd(m["bearing"])}°', 84, SIGN, 600, 'end'))
        o.append(txt(lx, ly + 160, f'{lid} lobe faces {rd(LOBES[lid]["compass"])}°, {m["km"]} km', 56, INK2, None, 'end'))
o.append(f'<circle cx="{OC["x"]}" cy="{OC["y"]}" r="{OC["r"]+20}" fill="#fff8e6" stroke="#a88e5c" stroke-width="10"/><circle cx="{OC["x"]}" cy="{OC["y"]}" r="22" fill="{SIGN}"/>')
# the other lobes, small
for lid, dx, dy, l1, l2 in (('N', 0, -150, 'N · arrivals hall', 'points at Delhi'), ('NE', 90, -190, 'NE · domestic', 'security'),
                           ('SE', 90, 150, 'SE · international', 'departures')):
    t = LOBES[lid]['tip']
    o.append(txt(t[0] + dx, t[1] + dy, l1, 52, INK2, None, 'middle') + txt(t[0] + dx, t[1] + dy + 55, l2, 52, INK2, None, 'middle'))
# stands: MARS outlines and parked aircraft (scale feel)
def plane(x, y, nose, code):
    L = {'C': 38, 'E': 66, 'F': 73}[code]; Sp = {'C': 36, 'E': 64, 'F': 80}[code]
    a = nose - 90
    return (f'<g transform="translate({x} {y}) rotate({a})" fill="#dfe4e7" opacity=".9">'
            f'<rect x="{-L/2}" y="-3" width="{L}" height="6" rx="3"/><path d="M{L*0.1} -3 L{-L*0.12} {-Sp/2} L{-L*0.2} {-Sp/2} L{-L*0.12} 0 L{-L*0.2} {Sp/2} L{-L*0.12} {Sp/2} L{L*0.1} 3 Z"/>'
            f'<path d="M{-L*0.36} -2 L{-L*0.46} {-Sp*0.18} L{-L*0.5} {-Sp*0.18} L{-L*0.5} {Sp*0.18} L{-L*0.46} {Sp*0.18} L{-L*0.36} 2 Z"/></g>')
def mars_box(g):
    L, W = 74, 92
    return (f'<g transform="translate({g["x"]} {g["y"]}) rotate({g["nose"]-90})" fill="none" stroke="{MARS_C}">'
            f'<rect x="{-L/2}" y="{-W/2}" width="{L}" height="{W}" stroke-width="6"/><path d="M{-L/2} 0 H{L/2}" stroke-width="5" stroke-dasharray="10 7"/></g>')
rnd = random.Random(9)
for lst, p in ((gates, .72), (S['remote'], .45)):
    kids = {}
    for g in lst:
        if g.get('marsOf'): kids.setdefault(g['marsOf'], []).append(g)
    for g in lst:
        if g.get('marsOf'): continue
        if g.get('marsRole') == 'wide':
            o.append(mars_box(g))
            u = rnd.random()
            if u < .4: o.append(plane(g['x'], g['y'], g['nose'], g['code']))
            elif u < .8: o.extend(plane(k['x'], k['y'], k['nose'], k['code']) for k in kids.get(g['id'], []))
        elif rnd.random() < p:
            o.append(plane(g['x'], g['y'], g['nose'], g['code']))
for b in S['bays']:
    if rnd.random() < .5: o.append(plane(b['x'], b['y'], b['nose'], b['code']))
# APM (phase 1)
ap = S['apm']
o.append(f'<path d="{poly(ap["pts"])}" stroke="{APM_C}" stroke-width="14" stroke-dasharray="70 40" fill="none"/>')
for st in ap['stations']: o.append(f'<circle cx="{st["x"]}" cy="{st["y"]}" r="30" fill="#0f1417" stroke="{APM_C}" stroke-width="10"/>')
# transfer journey: international arrival at F north -> walk to the Mall -> transfer centre at the D/E junction -> APM -> B south
CN = {c['id']: c for c in S['concourses']}
fg = next(g for g in CN['FN']['gates'] if g['id'] == 'FN12') if any(g['id'] == 'FN12' for g in CN['FN']['gates']) else CN['FN']['gates'][-1]
bg = next(g for g in CN['BS']['gates'] if g['id'] == 'BS14') if any(g['id'] == 'BS14' for g in CN['BS']['gates']) else CN['BS']['gates'][-1]
fx, bx = CN['FN']['apm'][0], CN['BS']['apm'][0]
st = {s['id']: s for s in ap['stations']}
TC = ((st['D']['x'] + st['E']['x']) / 2, -55)
walk1 = [(fg['x'], fg['y']), (fx, fg['y']), (fx, -55), TC]
ride = [TC, (st['D']['x'], 0), (st['B']['x'], 0)]
walk2 = [(st['B']['x'], 0), (bx, 60), (bx, bg['y']), (bg['x'], bg['y'])]
for seg, dash, wdt in ((walk1, '', 22), (ride, ' stroke-dasharray="60 28"', 30), (walk2, '', 22)):
    o.append(f'<path d="{poly(seg)}" stroke="#0f1417" stroke-width="{wdt+16}" fill="none" stroke-linejoin="round" stroke-linecap="round" opacity=".55"/>')
    o.append(f'<path d="{poly(seg)}" stroke="{XFER}" stroke-width="{wdt}" fill="none" stroke-linejoin="round"{dash}/>')
o.append(f'<circle cx="{fg["x"]}" cy="{fg["y"]}" r="40" fill="{XFER}"/><circle cx="{bg["x"]}" cy="{bg["y"]}" r="40" fill="{XFER}"/>')
o.append(f'<rect x="{TC[0]-62}" y="{TC[1]-62}" width="124" height="124" rx="16" fill="#0f1417" stroke="{XFER}" stroke-width="14" transform="rotate(45 {TC[0]} {TC[1]})"/>'
         + txt(TC[0], TC[1] + 30, 'T', 86, XFER, 700, 'middle'))
for i, (x, y) in enumerate(((fg['x'], fg['y']), TC, (st['D']['x'], 0), (bg['x'], bg['y']))):
    pass
# labels: concourses, identities, Hall, Mall
for c in S['concourses']:
    if c['id'].endswith('N'):
        o.append(txt(c['apm'][0], -850, c['id'][0], 120, INK, 700, 'middle'))
groups = {}
for k_, v in S['dna']['concourses'].items(): groups.setdefault(v, []).append(k_)
ID_TXT = {'BLR': ('BENGALURU GARDEN', GARDEN), 'BOM': ('MUMBAI CEREMONIAL', '#e8b04a'), 'blend': ('BLEND', INK2)}
for key, ids in groups.items():
    xs = [CN[i + 'N']['apm'][0] for i in ids]
    lab, col = ID_TXT.get(key, (key.upper(), INK2))
    o.append(f'<path d="M{min(xs)-70} -975 H{max(xs)+70}" stroke="{col}" stroke-width="8" opacity=".8"/>')
    o.append(txt((min(xs) + max(xs)) / 2 + (40 if key == 'BOM' else 0), -1010, lab, 54, col, 600, 'middle', extra=' letter-spacing="2"'))
o.append(txt(OC['x'], -1020, 'ZERO MILE HALL', 96, INK, 700, 'middle', extra=' letter-spacing="4"'))
o.append(txt(OC['x'], -935, 'seven lobes; three gateways point home', 60, INK2, None, 'middle'))
o.append(txt(-1740, -240, 'THE MALL', 66, INK, 700, 'middle', extra=' letter-spacing="3"'))
o.append(txt(-1740, -175, 'garden valley', 50, GARDEN, None, 'middle'))
o.append(txt(-640, -1265, 'PHASE 2 · REMOTE STANDS AT THE PIER TIPS', 58, SAND, 600, 'middle', extra=' letter-spacing="3" opacity=".75"'))
o.append(txt(-640, 1320, 'PHASE 2 · REMOTE STANDS AT THE PIER TIPS', 58, SAND, 600, 'middle', extra=' letter-spacing="3" opacity=".75"'))
# transfer label block, south of the piers
o.append(txt(-1680, 900, 'TRANSFER: INTERNATIONAL TO DOMESTIC, ABOUT 25 MIN', 72, XFER, 700))
o.append(txt(-1680, 975, 'Arrive at an F north stand, walk to the Mall, clear the transfer centre (T) at the D/E junction:', 52, INK2))
o.append(txt(-1680, 1040, 'immigration and re-screening. Then the APM to B and a short walk to a B south stand.', 52, INK2))
for x, y, t in ((1900, -1240, 'REMOTE STANDS'), (1900, 1290, 'REMOTE STANDS'), (1900, -480, 'CARGO'), (1900, 500, 'MRO'), (3600, -1000, 'FUEL'), (1000, 140, 'TOWER')):
    o.append(txt(x, y, t, 70, INK2, 600, 'middle', extra=' letter-spacing="3"'))
# landside labels
o.append(txt(-3050, -4930, 'Mumbai–Nagpur high-speed rail (proposed), in tunnel under the field', 66, '#c3cad1'))
o.append(txt(S['forecourt']['x0'] - 190, -110, 'STEPWELL FORECOURT', 52, '#d8b483', 600, 'end'))
o.append(txt(S['forecourt']['x0'] - 190, -58, 'under the 40 m cantilever', 44, INK2, None, 'end'))
o.append(txt(S['forecourt']['x0'] - 190, 95, 'RAIL STATION BELOW', 52, '#c3cad1', 600, 'end'))
o.append(txt(S['forecourt']['x0'] - 190, 145, 'high-speed line + metro', 44, INK2, None, 'end'))
o.append(txt(-4950, 390, 'Metro spur to the Orange Line', 56, '#c3cad1'))
o.append(txt(-4950, -130, 'to Nagpur · Samruddhi Expressway', 56, INK3))
# title block
tx, ty = VB[0] + 150, VB[1] + 250
o.append(txt(tx, ty, 'VIKRAM SARABHAI INTERNATIONAL · VSI', 230, INK, 700))
o.append(txt(tx, ty + 150, f'Master plan · {len(S["runways"])} runways · {c_st + r_st} stands ({c_st} contact + {r_st} remote) · {c_m + r_m} MARS · '
         f'up to {c_pos + r_pos} aircraft parked · {n_bays} holding bays', 100, INK2))
# right-hand panel: legend, the idea, north arrow, scale
def sw(kind, x, y):
    if kind == 'roof': return f'<rect x="{x}" y="{y}" width="150" height="70" rx="10" fill="url(#roofg)" stroke="{ROOF_EDGE}" stroke-width="10"/>'
    if kind == 'p2': return f'<rect x="{x}" y="{y}" width="150" height="70" rx="10" fill="{SAND}" fill-opacity=".18" stroke="{SAND}" stroke-width="8" stroke-dasharray="30 18"/>'
    if kind == 'apm': return f'<path d="M{x} {y+35} H{x+150}" stroke="{APM_C}" stroke-width="16" stroke-dasharray="50 24"/>'
    if kind == 'apm2': return f'<path d="M{x} {y+35} H{x+150}" stroke="{APM_C}" stroke-opacity=".55" stroke-width="12" stroke-dasharray="24 30"/>'
    if kind == 'oneway': return chevron(x + 45, y + 35, 1, 0, 90) + chevron(x + 115, y + 35, 1, 0, 90)
    if kind == 'mars': return f'<rect x="{x+30}" y="{y}" width="90" height="70" fill="none" stroke="{MARS_C}" stroke-width="8"/><path d="M{x+75} {y} V{y+70}" stroke="{MARS_C}" stroke-width="6" stroke-dasharray="10 7"/>'
    if kind == 'axis': return f'<path d="M{x} {y+35} H{x+130}" stroke="{SIGN}" stroke-width="16" marker-end="url(#ah)"/>'
    if kind == 'xfer': return f'<path d="M{x} {y+35} H{x+150}" stroke="{XFER}" stroke-width="20"/>'
    if kind == 'garden': return f'<circle cx="{x+40}" cy="{y+35}" r="32" fill="{GARDEN}"/><rect x="{x+85}" y="{y+5}" width="60" height="60" rx="10" fill="{GARDEN}"/>'
    if kind == 'court': return f'<rect x="{x}" y="{y}" width="150" height="70" rx="10" fill="{STONE}" fill-opacity=".6" stroke="#d8b483" stroke-width="6"/><rect x="{x+50}" y="{y+18}" width="50" height="34" fill="{WATER}"/>'
    if kind == 'rail': return f'<path d="M{x} {y+35} H{x+150}" stroke="#9aa3ad" stroke-opacity=".35" stroke-width="22"/><path d="M{x} {y+35} H{x+150}" stroke="#c3cad1" stroke-width="7" stroke-dasharray="40 26"/>'
    if kind == 'bay': return f'<rect x="{x}" y="{y}" width="64" height="70" rx="8" fill="none" stroke="{SIGN}" stroke-width="7"/><rect x="{x+86}" y="{y+5}" width="64" height="60" rx="8" fill="#e0703a"/>'
    return f'<rect x="{x}" y="{y}" width="150" height="70" rx="10" fill="{kind}"/>'
LEG = [(ARR, 'Arrival runway (default)'), (DEP, 'Departure runway (default)'),
       ('roof', 'One continuous roof: Hall, Mall, 12 piers (phase 1)'),
       ('p2', 'Phase 2: satellites G and H, pier-tip remote aprons'),
       ('apm', 'Automated people mover (phase 1)'), ('apm2', 'People mover to G and H (phase 2)'),
       ('oneway', 'One-way taxiway, arrow shows direction'),
       ('mars', 'MARS stand: one widebody or two narrowbodies'),
       ('axis', 'Gateway axis: from the oculus toward home'),
       ('xfer', 'Transfer journey, F north to B south'),
       ('garden', 'Gardens: valleys, garden valley, courts'),
       ('court', 'Stepwell forecourt under the 40 m cantilever'),
       ('rail', 'Rail below ground (proposed)'),
       ('bay', 'Holding bays · heat pads')]
def wrap(t, n):
    out, line = [], ''
    for w_ in t.split():
        if len(line) + len(w_) + 1 > n: out.append(line); line = ''
        line += (' ' if line else '') + w_
    return out + [line]
panel_at = len(o); o.append('')
ly = VB[1] + 860
def head(t):
    global ly
    o.append(txt(PX, ly, t, 104, SIGN, 700, extra=' letter-spacing="4"')); ly += 140
def para(t, n=58, size=76, col=INK2):
    global ly
    for line in wrap(t, n): o.append(txt(PX, ly, line, size, col, fam=FB)); ly += 102
o.append(txt(PX, ly, 'LEGEND', 120, INK, 700, extra=' letter-spacing="6"')); ly += 175
for kind, t in LEG:
    o.append(f'<g transform="translate({PX} {ly-62}) scale(1.25)">{sw(kind, 0, 0)}</g>'); o.append(txt(PX + 250, ly, t, 98, INK2)); ly += 150
ly += 110
head('EACH GATEWAY LOBE POINTS HOME')
for lid in ('S', 'WSW', 'WNW'):
    m = DNA[lid]
    o.append(txt(PX, ly, f'{lid} lobe {rd(LOBES[lid]["compass"])}°', 84, INK, 600) + txt(PX + 1000, ly, f'{m["city"]} ({m["code"]}) {rd(m["bearing"])}°', 84, INK2)); ly += 112
o.append(txt(PX, ly, f'N lobe {rd(LOBES["N"]["compass"])}°', 84, INK, 600) + txt(PX + 1000, ly, 'arrivals hall, toward Delhi 347°', 84, INK2)); ly += 130
para('The three gateway axes meet under the oculus, at the Zero Mile marker. Mumbai builds the roof, Bengaluru plants its underside, Ahmedabad screens its edges.')
ly += 90
head('TAXI FLOW')
para('Outer parallels run west. In the midfield the runway-side parallel runs west and the terminal-side parallel runs east. The end-arounds mean no runway crossings.')
ly += 90
head('STANDS')
para(f'Contact: {c_st} stands, {c_m} of them MARS. Remote: {r_st} stands, {r_m} MARS. A MARS stand takes one widebody or two narrowbodies, so up to {c_pos + r_pos} aircraft can park at once. Plus {n_bays} holding bays.')
ly += 90
head('PHASE 2 (DASHED)')
para(S['phase2']['note'])
ly += 160
nx, ny = PX + 2700, ly
o.append(f'<path d="M{nx} {ny} L{nx-90} {ny+260} L{nx} {ny+200} L{nx+90} {ny+260} Z" fill="{INK}"/>' + txt(nx, ny - 40, 'N', 110, INK, 700, 'middle'))
sx_, sy_ = PX, ly + 180
o.append(f'<rect x="{sx_}" y="{sy_}" width="1000" height="40" fill="{INK}"/><rect x="{sx_+1000}" y="{sy_}" width="1000" height="40" fill="none" stroke="{INK}" stroke-width="10"/>'
         + txt(sx_, sy_ - 40, '0', 80) + txt(sx_ + 1000, sy_ - 40, '1 km', 80, anchor='middle') + txt(sx_ + 2000, sy_ - 40, '2 km', 80, anchor='middle'))
ly = sy_ + 200
o[panel_at] = f'<rect x="{PX-130}" y="{VB[1]+600}" width="{VB[0]+VB[2]-PX+70}" height="{ly-VB[1]-600}" rx="40" fill="#121a1c" stroke="#24302f" stroke-width="8"/>'
o.append('</svg>')
open(os.path.join(D, 'masterplan.svg'), 'w').write('\n'.join(o))

# ------------------------------------------------------------------ roof plan
R = S['roof']
W, H = 1600, 900
K = 0.36; X0 = -3420; Y0 = 440
def X(x): return (x - X0) * K + 30
def Y(y): return y * K + Y0
XCUT = -930
r = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-label="Roof plan of the Zero Mile Hall, the Mall and concourses A and B: one continuous roof with north-light coffers, branching tree columns, gardens in the valleys, jaali screens on the sun-facing walls, an oculus over the Zero Mile marker and a 40 m cantilever over the stepwell forecourt.">']
r.append('<defs><linearGradient id="rg" gradientUnits="userSpaceOnUse" x1="-2950" y1="-650" x2="-900" y2="650"><stop offset="0" stop-color="#f7eedb"/><stop offset=".5" stop-color="#eee2c4"/><stop offset="1" stop-color="#dccaa2"/></linearGradient>'
         f'<clipPath id="cl"><rect x="-4000" y="-2000" width="{XCUT+4000}" height="4000"/></clipPath>'
         '<linearGradient id="fd" x1="0" x2="1"><stop offset="0" stop-color="#0f1417" stop-opacity="0"/><stop offset="1" stop-color="#0f1417"/></linearGradient></defs>')
r.append(f'<rect width="{W}" height="{H}" fill="#0f1417"/>')
r.append(f'<g transform="translate({30 - X0*K:.2f} {Y0}) scale({K})" clip-path="url(#cl)">')
fc = S['forecourt']
# stepwell forecourt (below the cantilever)
for i, lev in enumerate(fc['levels']):
    ins = i * 22
    r.append(f'<rect x="{fc["x0"]+ins}" y="{fc["y0"]+ins}" width="{fc["x1"]-fc["x0"]-2*ins}" height="{fc["y1"]-fc["y0"]-2*ins}" rx="{max(6,40-ins)}" fill="{STONE}" fill-opacity="{0.35+0.13*i:.2f}" stroke="#e0bf8f" stroke-width="3"/>')
pl = fc['pool']
r.append(f'<rect x="{pl["x"]-pl["w"]/2}" y="{pl["y"]-pl["l"]/2}" width="{pl["w"]}" height="{pl["l"]}" rx="6" fill="{WATER}"/>')
# roof surface: Hall + Mall + piers A and B as one, plus the cantilever band
SH = [hall['outline'], mall['outline']] + [c['outline'] for c in S['concourses'] if c['id'][0] in 'AB']
r.append(f'<path d="{poly(cant["pts"])}" fill="none" stroke="{ROOF_EDGE}" stroke-width="{2*cant["depth"]+10}" stroke-linejoin="round" stroke-linecap="round"/>')
for d in SH: r.append(f'<path d="{d}" fill="none" stroke="{ROOF_EDGE}" stroke-width="10" stroke-linejoin="round"/>')
r.append(f'<path d="{poly(cant["pts"])}" fill="none" stroke="#f3e9d2" stroke-opacity=".8" stroke-width="{2*cant["depth"]}" stroke-linejoin="round" stroke-linecap="round"/>')
for d in SH: r.append(f'<path d="{d}" fill="url(#rg)"/>')
r.append(f'<path d="{poly(cant["pts"])}" fill="none" stroke="#8e7a52" stroke-width="2.5" stroke-dasharray="8 6" transform="translate(-36 0)"/>')
# valleys (structure + rainwater)
for v in R['valleys']:
    r.append(f'<path d="{poly(v["pts"])}" stroke="#9c8152" stroke-width="7" fill="none" stroke-linecap="round"/>')
# gardens
for g in R['gardens']:
    if g['kind'] == 'belt':
        r.append(f'<rect x="{g["x"]-g["w"]/2}" y="{g["y"]-g["l"]/2}" width="{g["w"]}" height="{g["l"]}" rx="22" fill="{GARDEN}" fill-opacity=".85" stroke="#3f8a4a" stroke-width="4"/>')
    elif g['kind'] == 'oculus':
        r.append(f'<circle cx="{g["x"]}" cy="{g["y"]}" r="{g["r"]}" fill="{GARDEN}" fill-opacity=".85" stroke="#3f8a4a" stroke-width="4"/>')
    else:
        r.append(f'<circle cx="{g["x"]}" cy="{g["y"]}" r="{g["r"]}" fill="{GARDEN}" fill-opacity=".85" stroke="#3f8a4a" stroke-width="3"/>')
# skylight coffers (north-light), coloured lenses in the coffers, clear strips on the piers and Mall
LENS = ['#f2b84b', '#e67a5c', '#6fb7c9', '#9ac36a', '#c98fd6']
lr_ = random.Random(5)
for s in R['skylights']:
    if s['x'] > XCUT + 30: continue
    col = lr_.choice(LENS) if s['kind'] == 'coffer' else '#a9d6e8'
    r.append(f'<rect x="{-s["w"]/2}" y="{-s["l"]/2}" width="{s["w"]}" height="{s["l"]}" fill="{col}" stroke="#7f6844" stroke-width="1.5" transform="translate({s["x"]} {s["y"]}) rotate({s["a"]})"/>')
# tree columns: a node with its arms
for c in R['columns']:
    if c['x'] > XCUT: continue
    rr = c['span'] / 2.6
    arms = ' '.join(f'M{c["x"]} {c["y"]} L{c["x"]+rr*math.cos(2*math.pi*i/c["arms"]):.1f} {c["y"]+rr*math.sin(2*math.pi*i/c["arms"]):.1f}' for i in range(c['arms']))
    r.append(f'<path d="{arms}" stroke="#5b4a2e" stroke-width="2.6" stroke-linecap="round"/><circle cx="{c["x"]}" cy="{c["y"]}" r="3.6" fill="#5b4a2e"/>')
# jaali screens on the sun-facing walls: dotted band
for j in R['jaali']:
    if min(p[0] for p in j['pts']) > XCUT: continue
    d = poly(j['pts'])
    r.append(f'<path d="{d}" fill="none" stroke="{JAALI}" stroke-width="11" stroke-opacity=".35" stroke-linejoin="round"/>'
             f'<path d="{d}" fill="none" stroke="{JAALI}" stroke-width="7" stroke-dasharray="3 6" stroke-linejoin="round"/>')
# gateway axes and the oculus
for lid, _, _ in GW:
    t = LOBES[lid]['tip']
    r.append(f'<path d="M{OC["x"]} {OC["y"]} L{t[0]} {t[1]}" stroke="{SIGN}" stroke-width="4" stroke-dasharray="14 10" fill="none" opacity=".9"/>')
r.append(f'<circle cx="{OC["x"]}" cy="{OC["y"]}" r="{OC["r"]}" fill="#cfe8f2" stroke="#7f6844" stroke-width="5"/><circle cx="{OC["x"]}" cy="{OC["y"]}" r="12" fill="{SIGN}"/>')
r.append('</g>')
r.append(f'<rect x="{X(-1060):.0f}" y="0" width="{X(XCUT)-X(-1060)+2:.0f}" height="{H}" fill="url(#fd)"/>')
# gateway tags at the tips
HALO = ' stroke="#0f1417" stroke-width="3.5" paint-order="stroke"'
for lid, an, dx, dy in (('WNW', 'end', -30, -16), ('WSW', 'end', -30, 28), ('S', 'start', 12, 24)):
    t = LOBES[lid]['tip']; m = DNA[lid]
    r.append(txt(X(t[0]) + dx, Y(t[1]) + dy, f'to {m["city"]} {rd(m["bearing"])}°', 15, SIGN, 700, an, extra=HALO))
top_y = Y(min(p[1] for c_ in R['centrelines'][:7] for p in c_)) - 70
r.append(f'<path d="M{X(OC["x"]):.0f} {top_y+8:.0f} V{Y(-OC["r"]):.0f}" stroke="{INK}" stroke-width="1.2" opacity=".8"/>')
r.append(txt(X(OC['x']), top_y - 18, 'OCULUS over the Zero Mile marker', 15, INK, 700, 'middle', fam=FB))
r.append(txt(X(OC['x']), top_y, 'the three gateway axes meet here', 13, INK2, None, 'middle', fam=FB))
# the bicycle-and-rocket installation, just east of the oculus on the walk into the Mall (tribute to Thumba, design.md section 7)
BK = (OC['x'] + 130, 0); bx_, by_ = X(BK[0]), Y(BK[1])
r.append(f'<g stroke="{SIGN}" stroke-width="1.6" fill="#0f1417"><circle cx="{bx_-6:.1f}" cy="{by_+3:.1f}" r="4.2"/><circle cx="{bx_+6:.1f}" cy="{by_+3:.1f}" r="4.2"/>'
         f'<path d="M{bx_-6:.1f} {by_+3:.1f} L{bx_-1:.1f} {by_-4:.1f} L{bx_+6:.1f} {by_+3:.1f}" fill="none"/></g>'
         f'<path d="M{bx_-9:.1f} {by_-6:.1f} H{bx_+5:.1f} l5 -2.5 l-5 -2.5 H{bx_-9:.1f} z" fill="{SIGN}"/>')
BLX, BLY = X(OC['x']) + 310, 212                       # label in the clear sky between the Hall and pier A
r.append(f'<path d="M{bx_+3:.0f} {by_-9:.0f} L{BLX-70:.0f} {BLY+26:.0f}" stroke="#0f1417" stroke-width="3.5" opacity=".6"/>'
         f'<path d="M{bx_+3:.0f} {by_-9:.0f} L{BLX-70:.0f} {BLY+26:.0f}" stroke="{INK}" stroke-width="1.3"/>')
r.append(txt(BLX, BLY, 'BICYCLE AND ROCKET', 15, INK, 700, 'end', fam=FB))
r.append(txt(BLX, BLY + 17, 'after the Thumba photographs, 1960s', 13, INK2, None, 'end', fam=FB))
# title
r.append(txt(30, 52, 'THE ROOF · ONE SURFACE OVER THE HALL, THE MALL AND PIERS A AND B', 34, INK, 700))
r.append(txt(30, 80, 'Roof plan. Structure from Mumbai, underside and gardens from Bengaluru, edges from Ahmedabad.', 17, INK2, fam=FB))
# three DNA callouts with leaders
col_m = min(R['columns'], key=lambda c: math.hypot(c['x'] - (OC['x'] - 200), c['y'] - 250))
cof = min((sk for sk in R['skylights'] if sk['kind'] == 'coffer'), key=lambda c: math.hypot(c['x'] - (OC['x'] - 220), c['y'] - 150))
belt = next(g for g in R['gardens'] if g['kind'] == 'belt')
court = next(g for g in R['gardens'] if g['kind'] == 'court' and g['y'] > 0)
vg = next(g for g in R['gardens'] if g['kind'] == 'valley' and g['y'] > 150)
jw = next(j for j in R['jaali'] if j['face'] == 'WSW')
jp = jw['pts'][len(jw['pts']) // 2]
cp = cant['pts'][2]
CALL = [
    ('AHMEDABAD · EDGES', JAALI, 30, 792, [(X(jp[0]), Y(jp[1])), (X(fc['x0'] + 60), Y(fc['y1']))],
     ['Jaali screens on the sun-facing walls', '(tree-of-life pattern on the west lobe);', 'the stepwell forecourt in the west valley.']),
    ('BENGALURU · UNDERSIDE', GARDEN, 650, 792, [(X(vg['x']), Y(vg['y'])), (X(belt['x']), Y(belt['y'] + belt['l'] / 2)), (X(court['x']), Y(court['y']))],
     ['Bamboo soffits and hanging gardens;', 'the garden valley where the Hall', 'becomes the Mall; courts at pier roots.']),
    ('MUMBAI · STRUCTURE', '#e8b04a', 340, 792, [(X(col_m['x']), Y(col_m['y'])), (X(cof['x']), Y(cof['y'])), (X(cp[0]) - 6, Y(cp[1]) + 4)],
     ['Tree columns open into coffers', 'with coloured lenses; a 40 m', 'cantilever over the kerb.']),
]
for h, col, x, y, pts_, lines in CALL:
    for px_, py_ in pts_:
        r.append(f'<path d="M{x+12} {y-24} L{x+12} {y-36} L{px_:.0f} {py_:.0f}" stroke="{col}" stroke-width="1.4" fill="none" opacity=".9"/><circle cx="{px_:.0f}" cy="{py_:.0f}" r="4" fill="{col}" stroke="#0f1417" stroke-width="1"/>')
    r.append(txt(x, y, h, 20, col, 700, extra=' letter-spacing="1"'))
    for i, ln in enumerate(lines): r.append(txt(x, y + 24 + i * 21, ln, 15, INK2, fam=FB))
r.append(txt((X(fc['x0']) + X(fc['x1'])) / 2, Y(fc['y0']) - 8, 'stepwell forecourt', 13, '#e0bf8f', 600, 'middle', fam=FB, extra=HALO))
# notes column: the numbers, then short notes
A = R['areas']
NX = 1040
r.append(f'<rect x="{NX-24}" y="110" width="{W-NX+4}" height="{H-140}" rx="10" fill="#121a1c" stroke="#24302f"/>')
r.append(txt(NX, 150, 'THE ROOF IN NUMBERS', 24, SIGN, 700, extra=' letter-spacing="1"'))
hh = [h for kk, hs in zip(R['kinds'], R['heights']) if kk == 'lobe' for h in hs]
mh = [h for kk, hs in zip(R['kinds'], R['heights']) if kk == 'spine' for h in hs]
ph = [h for kk, hs in zip(R['kinds'], R['heights']) if kk == 'pier' for h in hs]
ncof = sum(1 for s in R['skylights'] if s['kind'] == 'coffer'); nstr = len(R['skylights']) - ncof
gk = {}
for g in R['gardens']: gk[g['kind']] = gk.get(g['kind'], 0) + 1
rows = [
    ('Roof area, one surface', f'{A["roof_m2"]/1e6:.2f} million m²'),
    ('  Hall · Mall · piers', f'{A["hall_m2"]/1e3:,.0f}k · {A["mall_m2"]/1e3:,.0f}k · {A["piers_m2"]/1e3:,.0f}k m²'),
    ('Skylight glass', f'{A["skylight_m2"]/1e3:,.0f}k m² · {A["skylight_ratio"]*100:.1f}% (estimate)'),
    ('North-light openings', f'{ncof} coffers + {nstr} strips'),
    ('Tree columns', f'{len(R["columns"])}, {min(c["arms"] for c in R["columns"])}–{max(c["arms"] for c in R["columns"])} arms each'),
    ('Roof height', f'Hall {max(hh):.0f}→{min(hh):.0f} m · Mall {min(mh):.0f}–{max(mh):.0f} m · piers {max(ph):.0f}→{min(ph):.0f} m'),
    ('Gardens', f'{gk.get("valley",0)} in the valleys · {gk.get("belt",0)} garden valley · {gk.get("court",0)} courts'),
    ('Jaali runs', f'{len(R["jaali"])} on sun-facing walls'),
    ('Oculus', f'{OC["r"]*2} m across, over the Zero Mile marker'),
    ('Cantilever', f'{cant["depth"]} m over the kerb and forecourt'),
    ('Rain to the stepwell', f'about {fc["harvest_m3"]/1e6:.2f} million m³ a year (estimate)'),
]
yy = 186
for a_, b_ in rows:
    r.append(txt(NX, yy, a_, 15, INK3 if a_.startswith('  ') else INK2, fam=FB))
    r.append(txt(NX, yy + 19, b_, 16, INK, 600, fam=FB)); yy += 46
yy += 10
notes = [
    ('Each gateway lobe points home', 'S to Bengaluru, WSW to Mumbai, WNW to Ahmedabad, each within 8°. The three axes meet under the oculus.'),
    ('North light only', 'Coffers face north: daylight without direct sun, under a thick, insulated shell built for 47 °C afternoons.'),
]
for h, t in notes:
    r.append(txt(NX, yy, h, 18, SIGN, 700)); yy += 22
    line = ''
    for w_ in t.split():
        if len(line) + len(w_) > 60:
            r.append(txt(NX, yy, line, 14, INK2, fam=FB)); yy += 19; line = ''
        line += (' ' if line else '') + w_
    r.append(txt(NX, yy, line, 14, INK2, fam=FB)); yy += 30
# scale bar for the roof plan (200 m)
sb = 200 * K
r.append(f'<rect x="30" y="118" width="{sb/2:.1f}" height="5" fill="{INK}"/><rect x="{30+sb/2:.1f}" y="118" width="{sb/2:.1f}" height="5" fill="none" stroke="{INK}" stroke-width="1.2"/>'
         + txt(30, 112, '0', 12) + txt(30 + sb, 112, '200 m', 12, anchor='middle'))
r.append(f'<path d="M{30+sb+40:.0f} 104 l-8 22 l8 -5 l8 5 z" fill="{INK}"/>' + txt(30 + sb + 40, 100, 'N', 13, INK, 700, 'middle'))
r.append('</svg>')
open(os.path.join(D, 'roof.svg'), 'w').write('\n'.join(r))
print('ok', os.path.getsize(os.path.join(D, 'masterplan.svg')), os.path.getsize(os.path.join(D, 'roof.svg')))
