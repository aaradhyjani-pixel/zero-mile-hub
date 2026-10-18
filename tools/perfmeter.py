"""The in-game perf meter's own report (Shift+P) from a real-time run of Level 3's summit landings (WebKit by default).
usage: perfmeter.py <hub.html> <secs> [png] [webkit|chromium]   (DSF=2 for a Retina-scale page; one browser at a time, under nice)"""
import asyncio, sys, os
from playwright.async_api import async_playwright
async def main():
    url = sys.argv[1]; secs = float(sys.argv[2]); png = sys.argv[3] if len(sys.argv) > 3 else ''; eng = sys.argv[4] if len(sys.argv) > 4 else 'webkit'
    if not url.startswith(('file:', 'http')): url = 'file://' + os.path.abspath(url)
    async with async_playwright() as p:
        b = await getattr(p, eng).launch(); errs = []
        pg = await b.new_page(viewport={'width': 1440, 'height': 860}, device_scale_factor=float(os.environ.get('DSF', '1')))
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.add_init_script("try{localStorage.setItem('zm_snd','true')}catch(e){}")
        await pg.goto(url); await pg.wait_for_timeout(800)
        await pg.evaluate("window.HUB.view('3d')"); await pg.evaluate('window.HUB.ready3d()')
        await pg.evaluate('window.HUB.startLevel(3)'); await pg.evaluate('window.HUB.pause()'); await pg.evaluate('window.HUB.ff(3000)')
        if os.environ.get('ADAPT'): await pg.evaluate('window.HUB.Z().adaptive=true')
        await pg.wait_for_timeout(3000)
        await pg.evaluate('window.HUB.perf(true);window.HUB.speed(1)')
        await pg.wait_for_timeout(int(secs * 1000))
        if png: await pg.screenshot(path=png)
        print(await pg.evaluate('window.HUB.perfReport()'))
        await b.close(); print('ERR', errs[:5])
asyncio.run(main())
