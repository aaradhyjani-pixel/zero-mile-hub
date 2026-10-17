"""Draws masterplan.svg and roof.svg for Zero Mile International from spec.json."""
import json, math, os, random
D = os.path.dirname(os.path.abspath(__file__))
S = json.load(open(os.path.join(D, 'spec.json')))
F = "Barlow Condensed, Barlow, sans-serif"
ARR, DEP, SAND, INK, INK2, INK3, SIGN = '#8a7cff', '#2fd3c6', '#e4dccb', '#ece7da', '#a6afb4', '#6f7a80', '#f4c430'

def poly(pts): return 'M' + ' L'.join(f'{x:.0f} {y:.0f}' for x, y in pts)

# ------------------------------------------------------------------ master plan
VB = (-5200, -5300, 10800, 10600)
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VB[0]} {VB[1]} {VB[2]} {VB[3]}" role="img" '
     f'aria-label="Master plan of Zero Mile International: six east-west runways in two triples, a midfield terminal with the Zero Mile Hall to the west, a central Mall and six concourses, remote stands, cargo and maintenance to the east.">']
o.append('<defs>'
         '<linearGradient id="roofg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3ead6"/><stop offset="1" stop-color="#cdbf9f"/></linearGradient>'
         '<radialGradient id="hallg" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#fff6df"/><stop offset=".6" stop-color="#e9d9b4"/><stop offset="1" stop-color="#bda77c"/></radialGradient>'
         '<marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1 L9 5 L1 9" fill="none" stroke="context-stroke" stroke-width="1.8"/></marker>'
         '</defs>')
o.append(f'<rect x="{VB[0]}" y="{VB[1]}" width="{VB[2]}" height="{VB[3]}" fill="#0f1417"/>')
# farmland texture, quiet
rnd = random.Random(4)
for _ in range(260):
    x, y = rnd.uniform(VB[0], VB[0] + VB[2]), rnd.uniform(VB[1], VB[1] + VB[3])
    if -4500 < x < 3600 and -4900 < y < 4900: continue
    w, h = rnd.uniform(250, 800), rnd.uniform(200, 600)
    c = rnd.choice(['#141b1d', '#161d1a', '#13191c', '#18201b'])
    o.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="{w:.0f}" height="{h:.0f}" fill="{c}" transform="rotate({rnd.uniform(-12,12):.1f} {x:.0f} {y:.0f})"/>')
# boundary
E = S['extent']
o.append(f'<rect x="{E["x0"]-200}" y="{E["y0"]-200}" width="{E["x1"]-E["x0"]+400}" height="{E["y1"]-E["y0"]+400}" rx="120" fill="#161e1f" stroke="#2c3a3c" stroke-width="16" stroke-dasharray="80 50"/>')
# landside
for l in S['landside']:
    col, w = ('#3b4247', 46) if l['kind'] == 'road' else ('#33373f', 30)
    o.append(f'<path d="{poly(l["pts"])}" fill="none" stroke="{col}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>')
    if l['kind'] == 'rail': o.append(f'<path d="{poly(l["pts"])}" fill="none" stroke="#7d8590" stroke-width="5" stroke-dasharray="40 26"/>')
for a in S['aprons']: o.append(f'<path d="{a}" fill="#262d31"/>')
# taxiways
for t in S['taxiways']:
    o.append(f'<path d="{poly(t["pts"])}" fill="none" stroke="#353c41" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>')
for r in S['runways']:
    for e in r['exits']:
        o.append(f'<path d="M{e["x"]+260} {r["y"]} L{e["x"]} {r["y"]} L{e["to"][0]} {e["to"][1]}" fill="none" stroke="#353c41" stroke-width="30" stroke-linejoin="round"/>')
for t in S['taxiways']:
    o.append(f'<path d="{poly(t["pts"])}" fill="none" stroke="#b98f1c" stroke-opacity=".55" stroke-width="5"/>')
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
    o.append(f'<text x="{x0-90}" y="{y+30}" fill="{INK2}" font-family="{F}" font-size="110" font-weight="600" text-anchor="end">{lab[0]}</text>')
    o.append(f'<text x="{x1+90}" y="{y+30}" fill="{INK}" font-family="{F}" font-size="110" font-weight="700">{lab[1]}</text>')
    tag = ('ARRIVALS' if r['role'] == 'arr' else 'DEPARTURES') + (' · 4,500 m' if r['longest'] else f' · {x1-x0:,} m')
    o.append(f'<text x="{(x0+x1)/2}" y="{y-w/2-50}" fill="{col}" font-family="{F}" font-size="96" font-weight="600" text-anchor="middle" letter-spacing="6">{tag}</text>')
    # approach arrow
    o.append(f'<path d="M{x1+1650} {y} L{x1+260} {y}" stroke="{ARR}" stroke-width="16" fill="none" marker-end="url(#ah)" opacity=".8"/>')
# one-way circulation arrows on the end-arounds
for (x, y0, y1) in ((-3300, -3300, -1700), (-3300, 3300, 1700), (2700, -1700, -3300), (2700, 1700, 3300)):
    o.append(f'<path d="M{x} {y0} L{x} {y1}" stroke="{SIGN}" stroke-width="18" fill="none" marker-end="url(#ah)" opacity=".85"/>')
o.append(f'<text x="-3420" y="-2500" fill="{SIGN}" font-family="{F}" font-size="80" font-weight="600" text-anchor="end">END-AROUND</text><text x="-3420" y="-2410" fill="{INK2}" font-family="{F}" font-size="66" text-anchor="end">no runway crossings</text>')
o.append(f'<text x="-3420" y="2560" fill="{SIGN}" font-family="{F}" font-size="80" font-weight="600" text-anchor="end">END-AROUND</text>')
# buildings
for b in S['buildings']:
    k = b['kind']
    if b['id'] == 'ZMH':
        o.append(f'<path d="{b["outline"]}" fill="url(#hallg)" stroke="#8e7a52" stroke-width="10"/>')
        cx, cy = -2380, 0
        for i in range(7):
            a = 2 * math.pi * i / 7 + math.pi / 7
            o.append(f'<path d="M{cx} {cy} Q{cx+330*math.cos(a-0.25):.0f} {cy+400*math.sin(a-0.25):.0f} {cx+600*math.cos(a):.0f} {cy+700*math.sin(a):.0f}" stroke="#a88e5c" stroke-width="9" fill="none" opacity=".75"/>')
        o.append(f'<circle cx="{cx}" cy="{cy}" r="95" fill="#fff8e6" stroke="#a88e5c" stroke-width="10"/><circle cx="{cx}" cy="{cy}" r="22" fill="{SIGN}"/>')
    elif b['id'] == 'MALL':
        o.append(f'<path d="{b["outline"]}" fill="url(#roofg)" stroke="#8e7a52" stroke-width="8"/>')
    else:
        fill = {'tower': '#c9cfd4', 'fire': '#b8423a', 'cargo': '#5b5f63', 'mro': '#4f5559', 'fuel': '#55524c', 'rail': '#4b5563', 'other': '#3d4448'}[k]
        o.append(f'<path d="{b["outline"]}" fill="{fill}"/>')
for c in S['concourses']:
    o.append(f'<path d="{c["outline"]}" fill="url(#roofg)" stroke="#8e7a52" stroke-width="6"/>')
# skylight seams on piers
for c in S['concourses']:
    gx = [g['x'] for g in c['gates']]; gy = [g['y'] for g in c['gates']]
    cx = (min(gx) + max(gx)) / 2
    for y in range(int(min(gy)), int(max(gy)), 60):
        o.append(f'<path d="M{cx-14} {y} Q{cx} {y+18} {cx+14} {y}" stroke="#9c8558" stroke-width="4" fill="none" opacity=".6"/>')
# parked aircraft silhouettes at a sample of gates (scale feel)
def plane(x, y, nose, code):
    L = {'C': 38, 'E': 66, 'F': 73}[code]; Sp = {'C': 36, 'E': 64, 'F': 80}[code]
    a = nose - 90
    return (f'<g transform="translate({x} {y}) rotate({a})" fill="#dfe4e7" opacity=".9">'
            f'<rect x="{-L/2}" y="-3" width="{L}" height="6" rx="3"/><path d="M{L*0.1} -3 L{-L*0.12} {-Sp/2} L{-L*0.2} {-Sp/2} L{-L*0.12} 0 L{-L*0.2} {Sp/2} L{-L*0.12} {Sp/2} L{L*0.1} 3 Z"/>'
            f'<path d="M{-L*0.36} -2 L{-L*0.46} {-Sp*0.18} L{-L*0.5} {-Sp*0.18} L{-L*0.5} {Sp*0.18} L{-L*0.46} {Sp*0.18} L{-L*0.36} 2 Z"/></g>')
rnd = random.Random(9)
for c in S['concourses']:
    for g in c['gates']:
        if rnd.random() < 0.72: o.append(plane(g['x'], g['y'], g['nose'], g['code']))
for g in S['remote']:
    if rnd.random() < 0.45: o.append(plane(g['x'], g['y'], g['nose'], g['code']))
# APM
ap = S['apm']
o.append(f'<path d="{poly(ap["pts"])}" stroke="#6aa3ff" stroke-width="14" stroke-dasharray="70 40" fill="none"/>')
for st in ap['stations']: o.append(f'<circle cx="{st["x"]}" cy="{st["y"]}" r="30" fill="#0f1417" stroke="#6aa3ff" stroke-width="10"/>')
# labels
for c in S['concourses']:
    if c['id'].endswith('N'):
        x = c['apm'][0]; o.append(f'<text x="{x}" y="-880" fill="{INK}" font-family="{F}" font-size="120" font-weight="700" text-anchor="middle">{c["id"][0]}</text>')
o.append(f'<text x="-2380" y="-880" fill="{INK}" font-family="{F}" font-size="92" font-weight="700" text-anchor="middle" letter-spacing="4">ZERO MILE HALL</text>')
o.append(f'<text x="-2380" y="-790" fill="{INK2}" font-family="{F}" font-size="62" text-anchor="middle">check-in, security, rail and road</text>')
o.append(f'<text x="-700" y="1000" fill="{INK2}" font-family="{F}" font-size="66" text-anchor="middle">THE MALL · APM under the spine</text>')
for yy in (-1250, 1320): o.append(f'<text x="-640" y="{yy}" fill="{INK3}" font-family="{F}" font-size="58" text-anchor="middle" letter-spacing="4">PIER EXTENSION RESERVE (PHASE 2)</text>')
for x, y, t in ((1900, -1290, 'REMOTE STANDS'), (1900, 1330, 'REMOTE STANDS'), (1900, -480, 'CARGO'), (1900, 500, 'MRO'), (3600, -1000, 'FUEL'), (-3570, 760, 'RAIL'), (1000, 140, 'TOWER')):
    o.append(f'<text x="{x}" y="{y}" fill="{INK2}" font-family="{F}" font-size="70" font-weight="600" text-anchor="middle" letter-spacing="3">{t}</text>')
o.append(f'<text x="-8800" y="40" fill="{INK3}" font-family="{F}" font-size="70">to Nagpur · Samruddhi Expressway</text>')
# title block, legend, north arrow, scale bar
tx, ty = VB[0] + 180, VB[1] + 260
o.append(f'<text x="{tx}" y="{ty}" fill="{INK}" font-family="{F}" font-size="230" font-weight="700">ZERO MILE INTERNATIONAL · ZMI</text>')
o.append(f'<text x="{tx}" y="{ty+150}" fill="{INK2}" font-family="{F}" font-size="110">Master plan · 6 runways · 220 contact gates + 152 remote stands · design peak 260 movements an hour</text>')
lx, ly = VB[0] + 180, VB[1] + VB[3] - 760
for i, (c, t) in enumerate(((ARR, 'Arrival runway (default)'), (DEP, 'Departure runway (default)'), ('#6aa3ff', 'Automated people mover'), (SIGN, 'One-way end-around taxiway'), ('#e4dccb', 'Terminal roof'))):
    o.append(f'<rect x="{lx}" y="{ly+i*120}" width="140" height="70" rx="10" fill="{c}"/><text x="{lx+190}" y="{ly+i*120+58}" fill="{INK2}" font-family="{F}" font-size="80">{t}</text>')
nx, ny = VB[0] + VB[2] - 520, VB[1] + VB[3] - 720
o.append(f'<path d="M{nx} {ny} L{nx-90} {ny+260} L{nx} {ny+200} L{nx+90} {ny+260} Z" fill="{INK}"/><text x="{nx}" y="{ny-40}" fill="{INK}" font-family="{F}" font-size="110" font-weight="700" text-anchor="middle">N</text>')
sx_, sy_ = VB[0] + VB[2] - 2700, VB[1] + VB[3] - 300
o.append(f'<rect x="{sx_}" y="{sy_}" width="1000" height="40" fill="{INK}"/><rect x="{sx_+1000}" y="{sy_}" width="1000" height="40" fill="none" stroke="{INK}" stroke-width="10"/>'
         f'<text x="{sx_}" y="{sy_-40}" fill="{INK2}" font-family="{F}" font-size="80">0</text><text x="{sx_+1000}" y="{sy_-40}" fill="{INK2}" font-family="{F}" font-size="80" text-anchor="middle">1 km</text><text x="{sx_+2000}" y="{sy_-40}" fill="{INK2}" font-family="{F}" font-size="80" text-anchor="middle">2 km</text>')
o.append('</svg>')
open(os.path.join(D, 'masterplan.svg'), 'w').write('\n'.join(o))

# ------------------------------------------------------------------ roof close-up
W, H = 1600, 900
r = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-label="Roof plan of the Zero Mile Hall and the Mall: a seven-lobed shell with radial skylight ribs around a central oculus, joined to a waisted spine with wave skylights and the piers of concourses A and B.">']
r.append('<defs><radialGradient id="h" cx="50%" cy="50%" r="55%"><stop offset="0" stop-color="#fff7e2"/><stop offset=".7" stop-color="#e3d1a7"/><stop offset="1" stop-color="#b59b6a"/></radialGradient>'
         '<linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9dcbd"/><stop offset=".5" stop-color="#f7efdc"/><stop offset="1" stop-color="#d7c49b"/></linearGradient></defs>')
r.append(f'<rect width="{W}" height="{H}" fill="#0f1417"/>')
# map world (-3150..-900, -720..720) to the drawing
k = 0.34; ox, oy = 3150, 0; q = k / 0.62
X = lambda x: (x + ox) * k + 40
Y = lambda y: y * k + H / 2
def tp(d):
    out, nums = [], []
    for tok in d.replace('M', ' M ').replace('L', ' L ').replace('C', ' C ').replace('Q', ' Q ').replace('Z', ' Z ').replace('H', ' H ').replace('V', ' V ').split():
        out.append(tok)
    res, i, cmd = [], 0, None
    while i < len(out):
        t = out[i]
        if t in 'MLCQZ':
            cmd = t; res.append(t); i += 1; continue
        x, y = float(out[i]), float(out[i + 1]); res.append(f'{X(x):.1f} {Y(y):.1f}'); i += 2
    return ' '.join(res)
hall = next(b for b in S['buildings'] if b['id'] == 'ZMH')
mall = next(b for b in S['buildings'] if b['id'] == 'MALL')
for c in S['concourses']:
    if c['id'][0] in 'AB': r.append(f'<path d="{tp(c["outline"])}" fill="url(#m)" stroke="#8e7a52" stroke-width="2"/>')
r.append(f'<clipPath id="cl"><rect x="0" y="0" width="{X(-930):.0f}" height="{H}"/></clipPath><linearGradient id="fd" x1="0" x2="1"><stop offset="0" stop-color="#0f1417" stop-opacity="0"/><stop offset="1" stop-color="#0f1417"/></linearGradient>')
r.append(f'<g clip-path="url(#cl)"><path d="{tp(mall["outline"])}" fill="url(#m)" stroke="#8e7a52" stroke-width="2"/></g><rect x="{X(-1060):.0f}" y="0" width="{X(-930)-X(-1060):.0f}" height="{H}" fill="url(#fd)"/>')
r.append(f'<path d="{tp(hall["outline"])}" fill="url(#h)" stroke="#8e7a52" stroke-width="3"/>')
cx, cy = X(-2380), Y(0)
for i in range(7):
    a0 = 2 * math.pi * i / 7 + math.pi / 7
    for j in range(5):
        rr = (90 + j * 70) * q
        a = a0 + (j - 2) * 0.05
        r.append(f'<path d="M{cx+rr*0.6*math.cos(a-0.32):.1f} {cy+rr*0.72*math.sin(a-0.32):.1f} Q{cx+(rr+38*q)*math.cos(a):.1f} {cy+(rr+38*q)*1.15*math.sin(a):.1f} {cx+rr*0.6*math.cos(a+0.32):.1f} {cy+rr*0.72*math.sin(a+0.32):.1f}" stroke="#9c8152" stroke-width="2.4" fill="none" opacity=".8"/>')
    r.append(f'<path d="M{cx} {cy} Q{cx+210*q*math.cos(a0-0.3):.1f} {cy+250*q*math.sin(a0-0.3):.1f} {cx+380*q*math.cos(a0):.1f} {cy+450*q*math.sin(a0):.1f}" stroke="#7f6844" stroke-width="3" fill="none"/>')
rnd = random.Random(2)
for _ in range(240):
    a, d = rnd.uniform(0, 2 * math.pi), rnd.uniform(70, 330) * q
    x, y = cx + d * math.cos(a), cy + d * 1.15 * math.sin(a)
    r.append(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{rnd.uniform(3,6):.1f}" ry="{rnd.uniform(2,4):.1f}" fill="#8fc3dc" opacity=".55" transform="rotate({math.degrees(a):.0f} {x:.1f} {y:.1f})"/>')
r.append(f'<circle cx="{cx}" cy="{cy}" r="32" fill="#cfe8f2" stroke="#7f6844" stroke-width="3"/><circle cx="{cx}" cy="{cy}" r="10" fill="{SIGN}"/>')
for x in range(-1840, -880, 34):
    w = 120 + 26 * math.cos((x + 1440) / 320 * 2 * math.pi)
    r.append(f'<path d="M{X(x):.1f} {Y(-w+18):.1f} Q{X(x+17):.1f} {Y(0):.1f} {X(x):.1f} {Y(w-18):.1f}" stroke="#9c8152" stroke-width="1.6" fill="none" opacity=".65"/>')
r.append(f'<text x="40" y="60" fill="{INK}" font-family="{F}" font-size="40" font-weight="700">THE ROOF · ZERO MILE HALL AND THE MALL</text>')
notes = [
    ('Seven lobes', 'Like the segments of a Nagpur orange. Each lobe is a check-in and security hall; the valleys between them carry structure and monsoon rainwater.'),
    ('The oculus', 'A glass eye over the Zero Mile marker in the floor: the one point every departing passenger crosses.'),
    ('The Mall', 'A waisted spine, widest where each concourse meets it. The automated people mover runs underneath, one station per concourse.'),
    ('Piers', 'Concourses A and B shown. Gates line both faces; walks from the spine to the farthest gate stay under 800 m.'),
]
ty = 140
for h, t in notes:
    r.append(f'<text x="1010" y="{ty}" fill="{SIGN}" font-family="{F}" font-size="26" font-weight="700">{h}</text>')
    words, line, yy = t.split(), '', ty + 30
    for w_ in words:
        if len(line) + len(w_) > 46:
            r.append(f'<text x="1010" y="{yy}" fill="{INK2}" font-family="Barlow, sans-serif" font-size="18">{line}</text>'); yy += 24; line = ''
        line += (' ' if line else '') + w_
    r.append(f'<text x="1010" y="{yy}" fill="{INK2}" font-family="Barlow, sans-serif" font-size="18">{line}</text>')
    ty = yy + 50
r.append(f'<text x="40" y="{H-60}" fill="{INK2}" font-family="Barlow, sans-serif" font-size="18">Skylights are small and many, not big and few: each lets in a soft patch of light while the shell stays thick and insulated against 47 °C afternoons.</text>')
r.append(f'<text x="40" y="{H-30}" fill="{INK3}" font-family="Barlow, sans-serif" font-size="16">Deep overhangs shade the curtain walls. Light-coloured roof membrane reflects heat. Rainwater from the monsoon is collected in the lobes\' valleys.</text>')
r.append('</svg>')
open(os.path.join(D, 'roof.svg'), 'w').write('\n'.join(r))
print('ok', os.path.getsize(os.path.join(D, 'masterplan.svg')), os.path.getsize(os.path.join(D, 'roof.svg')))
