"""Queue scenario: python tools/queuetest.py hub.html <lvl 3|4> R2 R3 [flipT]  - jams R2 (only DEP), flips R3 to DEP at flipT, then R2 to ARR 5 min later; logs queue+lineup per runway"""
import asyncio, sys, os, json
from playwright.async_api import async_playwright
HUB=sys.argv[1]; LVL=int(sys.argv[2]); JAM=sys.argv[3]; NEW=sys.argv[4]; PRE=int(sys.argv[5]) if len(sys.argv)>5 else 1500
Q="""(()=>{const H=window.HUB,o={};for(const r of H.RW)o[r.id]=[0,0,r.mode];for(const f of H.flights()){if(!f.rwy)continue;if(['hp','taxi_out'].includes(f.state))o[f.rwy.id][0]++;else if(['lineup','roll'].includes(f.state))o[f.rwy.id][1]++;}return {T:Math.round(H.T),o,msgs:(window.__radio||[])}})()"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1440,'height':860}); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
        await pg.goto('file://'+os.path.abspath(HUB)); await pg.wait_for_timeout(800)
        await pg.evaluate("window.HUB.view('2d')"); await pg.evaluate(f'window.HUB.startLevel({LVL})'); await pg.evaluate('window.HUB.pause()')
        await pg.evaluate("""(j)=>{for(const r of window.HUB.RW){window.HUB.setMode(r.short,r.id===j?'DEP':'ARR');}}""",JAM)
        await pg.evaluate('window.HUB.ff(1)')
        flipped=False; rows=[]
        while True:
            s=await pg.evaluate(Q)
            if not flipped and s['T']>=PRE:
                flipped=True; rows.append('--- flip '+NEW+' to DEP at T=%d'%s['T']); await pg.evaluate(f"window.HUB.setMode('{NEW}','DEP')")
            rows.append('%5d '%s['T']+' '.join(f"{k}:{v[0]}+{v[1]}{v[2][0]}" for k,v in s['o'].items()))
            if flipped and not globals().get('c2') and s['T']>=PRE+300:
                globals()['c2']=1; rows.append('--- flip '+JAM+' to ARR'); await pg.evaluate(f"window.HUB.setMode('{JAM}','ARR')")
            if s['T']>=PRE+600: break
            await pg.evaluate('window.HUB.ff(30)')
        print('\n'.join(rows)); print('ERR',errs[:3])
        log=await pg.evaluate("(window.HUB.S.log||[]).filter(x=>/re-routed/.test(JSON.stringify(x))).map(x=>JSON.stringify(x)).slice(0,10)")
        print('LOG',log)
        await b.close()
asyncio.run(main())
