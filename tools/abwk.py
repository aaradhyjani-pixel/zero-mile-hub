"""Interleaved A/B in ONE WebKit browser (the machine is shared, so builds alternate in short rounds and the rounds are pooled):
each round loads a build, fast-forwards Level 3 to T, then records `secs` of real time from 1x (summit landings from T=3000).
usage: abwk.py <a.html> <b.html> [rounds=3] [secs=20] [T=3000]   (DSF=2 for a Retina-scale page; run under nice)"""
import asyncio, sys, os, statistics
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from perfwk import INIT

async def one(b, url, secs, T):
    pg = await b.new_page(viewport={'width': 1440, 'height': 860}, device_scale_factor=float(os.environ.get('DSF', '2')))
    await pg.add_init_script(INIT); await pg.goto(url); await pg.wait_for_timeout(800)
    await pg.evaluate("window.HUB.view('3d')"); await pg.evaluate('window.HUB.ready3d()')
    await pg.evaluate('window.HUB.startLevel(3)'); await pg.evaluate('window.HUB.pause()'); await pg.evaluate(f'window.HUB.ff({T+30})')
    for _ in range(40):
        if await pg.evaluate('window.HUB.Z().V3.warm') == 3: break
        await pg.wait_for_timeout(250)
    await pg.wait_for_timeout(2000)
    await pg.evaluate('window.__P.on=true;window.HUB.speed(1)'); await pg.wait_for_timeout(int(secs * 1000))
    fr = await pg.evaluate('(()=>{const P=window.__P;P.on=false;return P.fr.map(f=>[f[0],f[2]])})()')
    await pg.close(); return fr

def stats(frs):
    dt = []; js = []
    for fr in frs:
        dt += [fr[i][0] - fr[i - 1][0] for i in range(1, len(fr))]; js += [f[1] for f in fr]
    q = lambda a, k: sorted(a)[min(len(a) - 1, int(len(a) * k))]
    return (f"frames {len(dt)} | dt med {q(dt,.5):.0f} p90 {q(dt,.9):.0f} p99 {q(dt,.99):.0f} | >50ms {100*sum(d>50 for d in dt)/len(dt):.1f}% >100ms {100*sum(d>100 for d in dt)/len(dt):.1f}%"
            f" | JS med {q(js,.5):.1f} p90 {q(js,.9):.1f} p99 {q(js,.99):.1f} max {max(js):.0f} | JS>16ms {100*sum(j>16 for j in js)/len(js):.1f}% >25ms {100*sum(j>25 for j in js)/len(js):.1f}%")

async def main():
    A, B = [u if u.startswith(('file:', 'http')) else 'file://' + os.path.abspath(u) for u in sys.argv[1:3]]
    R = int(sys.argv[3]) if len(sys.argv) > 3 else 3; secs = float(sys.argv[4]) if len(sys.argv) > 4 else 20; T = int(sys.argv[5]) if len(sys.argv) > 5 else 3000
    res = {'A': [], 'B': []}
    async with async_playwright() as p:
        b = await p.webkit.launch()
        for r in range(R):
            for k, u in (('A', A), ('B', B)) if r % 2 == 0 else (('B', B), ('A', A)):
                fr = await one(b, u, secs, T); res[k].append(fr); print(f'round {r} {k}: {stats([fr])}', flush=True)
        await b.close()
    for k in 'AB': print(f'{k} pooled: {stats(res[k])}')

if __name__ == '__main__':
    asyncio.run(main())
