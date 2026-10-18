"""Synchronous bot (same planner as run.py's expert, via HUB.ff): python fastbot.py <hub.html> <expert|handler|lazy> [js_before_start] [crash]"""
import asyncio, sys, json, os, re
from playwright.async_api import async_playwright
HUB, MODE = sys.argv[1], sys.argv[2]; PRE = sys.argv[3] if len(sys.argv) > 3 else ''
src = open(os.path.expanduser('~/zmh-l3/run.py')).read(); AUTO = re.search(r"AUTO = '''(.*?)'''", src, re.S).group(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1440, 'height': 860}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
        await pg.goto('file://' + os.path.abspath(HUB)); await pg.wait_for_timeout(800)
        await pg.evaluate("window.HUB.view('2d')")
        if PRE: await pg.evaluate(PRE)
        await pg.evaluate('window.HUB.startLevel(3)'); await pg.evaluate('window.HUB.pause()')
        tl = []
        while True:
            if MODE == 'expert': await pg.evaluate(AUTO)
            elif MODE == 'handler': await pg.evaluate('window.HUB.resolveAll()')
            await pg.evaluate('window.HUB.ff(20)')
            r = await pg.evaluate('window.__hubResult||null')
            s = await pg.evaluate("(()=>({T:Math.round(window.HUB.T),h:window.HUB.flights().filter(f=>f.state==='holding').length,q:window.HUB.flights().filter(f=>f.state==='hp'||f.state==='taxi_out').length,S:{moves:window.HUB.S.moves}}))()")
            if s['T'] % 600 < 20: tl.append(f"{s['T']}:h{s['h']}q{s['q']}")
            if r: break
        S = s['S']; late = None
        print(MODE, 'RESULT', json.dumps({k: r[k] for k in ('stars','moves','target','otp','otpA','otpD','cx','safety','flips','div','incTypes','hits')}))
        print('  tl', ' '.join(tl)); print('  ERR', errs[:4])
        an = await pg.evaluate('''(()=>{const B={};for(const f of window.HUB.flights()){if(f.cancelled||f.state==='cancelled')continue;
          if(f.kind==='dep'||f.origStd!=null&&f.rollT!=null){const std=f.origStd!=null?f.origStd:f.std;if(std==null)continue;const k=Math.floor(std/600)*10;B[k]=B[k]||{d:0,dl:0,a:0,al:0};B[k].d++;if(f.rollT==null||(f.rollT-f.std)/60>25)B[k].dl++;}
          if(f.origEta!=null&&!f.vip&&f.al!=='CHW'){const k=Math.floor(f.origEta/600)*10;B[k]=B[k]||{d:0,dl:0,a:0,al:0};B[k].a++;if(f.landT==null||f.landT-f.origEta>900)B[k].al++;}}
          return Object.entries(B).sort((a,b)=>a[0]-b[0]).map(([k,v])=>k+'m:'+v.dl+'/'+v.d+'d,'+v.al+'/'+v.a+'a').join(' ');})()''')
        print('  late by 10-min bucket (min:lateDep/dep,lateArr/arr)', an)
        await b.close()
asyncio.run(main())
