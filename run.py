"""Headless playtest.

  python3 run.py <level 1-4> <expert|lazy|handler> [outdir] [hub.html]

expert  : flips runways to match the next 20 minutes of demand and resolves every incident
handler : resolves every incident but never touches the runway desk
lazy    : touches nothing

Prints KPIs at 4 checkpoints, the incident types seen, and a RESULT JSON line.
Screenshots go to outdir (default: current directory) as L{n}{e|h|l}_{T}.png.
"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright

LEVEL = int(sys.argv[1])
MODE = sys.argv[2] if len(sys.argv) > 2 else 'expert'
OUT = sys.argv[3] if len(sys.argv) > 3 else '.'
HUB = sys.argv[4] if len(sys.argv) > 4 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'hub.html')
os.makedirs(OUT, exist_ok=True)

AUTO = '''
(()=>{const H=window.HUB;if(!H.LV)return;const T=H.T;const fl=H.flights();
 const open=H.RW.filter(r=>!r.locked);
 // what a good duty manager reads off the bank chart: demand 2..17 minutes out (after a changeover), plus the backlog now
 const w0=T+120,w1=T+1020;let a=0,d=0;
 for(const f of fl){if(f.kind==='arr'&&f.landT==null&&!['diverted','divert','holding'].includes(f.state)){const t=Math.max(f.eta,T);if(t<w1)a++;}
  if(f.kind==='dep'&&['at_gate','push','start'].includes(f.state)){const t=Math.max(f.std,f.readyAt||0,T);if(t<w1)d++;}
  else if(f.kind==='arr'&&f.turn&&f.landT==null&&f.turn.std<w1)d+=0.5;}
 const hold=fl.filter(f=>f.state==='holding').length,q=fl.filter(f=>['hp','taxi_out'].includes(f.state)).length;
 a+=hold;d+=q;
 const hot=H.LV.light==='heat';const longest=H.RW.reduce((p,c)=>c.len>p.len?c:p);
 const dust=H.LV.dust&&T+600>=H.LV.dust[0]&&T<H.LV.dust[1];
 const capA={ARR:38*(dust?0.72:1),DEP:0,MIX:24*(dust?0.8:1)},capD={ARR:0,DEP:47,MIX:24};
 let best=null,bs=1e9;const n=open.length;const tot=Math.pow(3,n);const M=['ARR','DEP','MIX'];const hrs=(w1-T)/3600;
 for(let c=0;c<tot;c++){let k=c,ca=0,cd=0,cfg=[];for(let i=0;i<n;i++){const m=M[k%3];k=Math.floor(k/3);cfg.push(m);ca+=capA[m];cd+=capD[m];}
  if(hot&&!longest.locked){const li=open.indexOf(longest);if(li>=0&&cfg[li]==='ARR')continue;}
  const sa=Math.max(0,a-ca*hrs),sd=Math.max(0,d-cd*hrs);const ch=cfg.reduce((s,m,i)=>s+(m!==open[i].mode?1:0),0);
  const sc=sa*1.4+sd+ch*0.6-(ca+cd)*hrs*0.02;if(sc<bs){bs=sc;best=cfg;}}
 const changes=open.filter((r,i)=>r.mode!==best[i]).length;
 if(changes&&(window.__lastFlip||-1e9)<T-360){window.__lastFlip=T;open.forEach((r,i)=>{if(r.mode!==best[i])H.setMode(r.id,best[i]);});}
 const na=best.join('');
 H.resolveAll();
 return {T,a,d,na,hold,q};})()
'''
SEEN = '''(()=>{const o=window.__seen=window.__seen||{};for(const I of window.HUB.incidents())o[I.id]=I.type;return o;})()'''


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader'])
        pg = await b.new_page(viewport={'width': 1440, 'height': 860})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
        await pg.goto('file://' + os.path.abspath(HUB))
        await pg.wait_for_timeout(1500)
        await pg.evaluate("window.HUB.view('2d')")   # the bots test the sim, not the renderer
        await pg.screenshot(path=os.path.join(OUT, 'menu.png'))
        await pg.evaluate(f'window.HUB.startLevel({LEVEL})')
        await pg.wait_for_timeout(800)
        await pg.evaluate('window.HUB.speed(4)')
        shots = [600, 1800, 3000, 4500]
        done = set()
        i = 0
        tag = f'L{LEVEL}{MODE[0]}'
        seen = {}
        while True:
            i += 1
            r = None
            if MODE == 'expert':
                r = await pg.evaluate(AUTO)
            elif MODE == 'handler':
                await pg.evaluate('window.HUB.resolveAll()')
            seen = await pg.evaluate(SEEN)
            res = await pg.evaluate('window.__hubResult||null')
            T = await pg.evaluate('window.HUB.T')
            for s in shots:
                if T >= s and s not in done:
                    done.add(s)
                    await pg.screenshot(path=os.path.join(OUT, f'{tag}_{s}.png'))
                    st = await pg.evaluate('(()=>{const S=window.HUB.S;return {moves:S.moves,dep:S.dep,ot:S.depOnTime,cm:S.cnxMade,cx:S.cnxMiss,safety:S.safety,inc:window.HUB.incidents().length,hold:window.HUB.flights().filter(f=>f.state==="holding").length,hp:window.HUB.flights().filter(f=>f.state==="hp").length,taxi:window.HUB.flights().filter(f=>f.state==="taxi_out").length,nogate:window.HUB.flights().filter(f=>f.state==="nogate").length,park:window.HUB.flights().filter(f=>f.state==="at_gate").length}})()')
                    print('T', int(T), st, r, flush=True)
            if res:
                types = {}
                for t in seen.values():
                    types[t] = types.get(t, 0) + 1
                res['incTypes'] = res.get('incTypes') or types
                res['incSeen'] = sum(res['incTypes'].values())
                res['mode'] = MODE
                res['errors'] = len(errs)
                print('RESULT', json.dumps(res))
                break
            if i > 4000:
                print('timeout')
                break
            await pg.wait_for_timeout(250)
        await pg.screenshot(path=os.path.join(OUT, f'{tag}_end.png'))
        print('ERR', errs[:8])
        await b.close()

asyncio.run(main())
