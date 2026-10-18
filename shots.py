"""Headless screenshots of specific moments, for checking the look.

  python3 shots.py <outdir> [scenario ...]

Each scenario: name:level:sim_seconds:camera  where camera is fit | x,y,zoom
Optional JS to run before the shot can follow after a second colon-separated field '|js'.
"""
import asyncio, os, sys
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
SC = sys.argv[2:]


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader'])
        errs = []
        for sc in SC:
            js = ''
            if '|' in sc:
                sc, js = sc.split('|', 1)
            name, lvl, secs, camspec = sc.split(':')
            w, h = (390, 844) if name.startswith('m_') else (1440, 860)
            pg = await b.new_page(viewport={'width': w, 'height': h})
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
            await pg.goto('file://' + os.path.join(HERE, 'hub.html'))
            await pg.wait_for_timeout(700)
            if lvl != '0':
                await pg.evaluate(f'window.HUB.startLevel({lvl})')
                await pg.evaluate('window.HUB.pause()')
                await pg.evaluate(f'window.HUB.ff({secs})')
                if js:
                    await pg.evaluate(js)
                if camspec.startswith('ops') or camspec.startswith('inc'):
                    z = float(camspec[3:] or 4)
                    pos = await pg.evaluate("(()=>{const H=window.HUB;const o=H.ops()[0];if('%s'==='ops'&&o){const f=o.f;return f?[f.x,f.y]:[o.x||o.r.x1,o.y||o.r.y];}const I=H.incidents()[0];if(I){const p=I.f?I.f:I;return [p.x,p.y];}return [0,0];})()" % camspec[:3])
                    await pg.evaluate(f'window.HUB.look({pos[0]},{pos[1]},{z})')
                elif camspec != 'fit':
                    x, y, z = map(float, camspec.split(','))
                    await pg.evaluate(f'window.HUB.look({x},{y},{z})')
            elif js:
                await pg.evaluate(js)
            await pg.wait_for_timeout(600)
            await pg.screenshot(path=os.path.join(OUT, name + '.png'))
            await pg.close()
        print('ERR', errs[:10])
        await b.close()

asyncio.run(main())
