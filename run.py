import asyncio,os,sys,json
from playwright.async_api import async_playwright
LEVEL=int(sys.argv[1]); MODE=sys.argv[2] if len(sys.argv)>2 else 'expert'
AUTO='''
(()=>{const H=window.HUB;if(!H.LV)return;const T=H.T;const fl=H.flights();
 const open=H.RW.filter(r=>!r.locked);
 // demand next 20 min
 let a=0,d=0;for(const f of fl){if(f.kind==='arr'&&f.landT==null&&!['diverted','divert'].includes(f.state)&&Math.max(f.eta,T)<T+1200)a++;if(f.kind==='dep'&&['at_gate','push','start','taxi_out','hp'].includes(f.state)&&Math.max(f.std,f.readyAt||0)<T+1200)d++;}
 const hold=fl.filter(f=>f.state==='holding').length,q=fl.filter(f=>['hp','taxi_out'].includes(f.state)).length;
 a+=hold*0.8;d+=q*0.8;
 const hot=H.LV.light==='heat';const longest=H.RW.reduce((p,c)=>c.len>p.len?c:p);
 const capA={ARR:40,DEP:0,MIX:25},capD={ARR:0,DEP:48,MIX:25};
 let best=null,bs=-1;const n=open.length;const tot=Math.pow(3,n);const M=['ARR','DEP','MIX'];
 for(let c=0;c<tot;c++){let k=c,ca=0,cd=0,cfg=[];for(let i=0;i<n;i++){const m=M[k%3];k=Math.floor(k/3);cfg.push(m);ca+=capA[m];cd+=capD[m];}
  if(hot&&!longest.locked){const li=open.indexOf(longest);if(li>=0&&cfg[li]==='ARR')continue;}
  const sc=Math.min(ca/Math.max(1,a*3),cd/Math.max(1,d*3))*100-cfg.filter(m=>m==='MIX').length*0.5-cfg.reduce((s,m,i)=>s+(m!==open[i].mode?0.8:0),0);if(sc>bs){bs=sc;best=cfg;}}
 const changes=open.filter((r,i)=>r.mode!==best[i]).length;
 if(changes&&(window.__lastFlip||-1e9)<T-480){window.__lastFlip=T;open.forEach((r,i)=>{if(r.mode!==best[i])H.setMode(r.id,best[i]);});}
 const na=best.join('');
 H.resolveAll();
 return {T,a,d,na,hold,q};})()
'''
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=swiftshader'])
        pg=await b.new_page(viewport={'width':1440,'height':860})
        errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m: errs.append('console:'+m.text) if m.type=='error' else None)
        await pg.goto('file://'+os.path.abspath('hub.html'));await pg.wait_for_timeout(1500)
        await pg.screenshot(path=f'menu.png')
        await pg.evaluate(f'window.HUB.startLevel({LEVEL})');await pg.wait_for_timeout(800)
        await pg.evaluate('window.HUB.speed(4)')
        shots=[600,1800,3000,4500];done=set();i=0
        while True:
            i+=1
            r=None
            if MODE=='expert': r=await pg.evaluate(AUTO)
            res=await pg.evaluate('window.__hubResult||null')
            T=await pg.evaluate('window.HUB.T')
            for s in shots:
                if T>=s and s not in done:
                    done.add(s);await pg.screenshot(path=f'L{LEVEL}{MODE[0]}_{s}.png')
                    st=await pg.evaluate('(()=>{const S=window.HUB.S;return {moves:S.moves,dep:S.dep,ot:S.depOnTime,cm:S.cnxMade,cx:S.cnxMiss,safety:S.safety,inc:window.HUB.incidents().length,hold:window.HUB.flights().filter(f=>f.state==="holding").length,hp:window.HUB.flights().filter(f=>f.state==="hp").length,taxi:window.HUB.flights().filter(f=>f.state==="taxi_out").length,nogate:window.HUB.flights().filter(f=>f.state==="nogate").length,park:window.HUB.flights().filter(f=>f.state==="at_gate").length}})()')
                    print('T',int(T),st,r,flush=True)
            if res: print('RESULT',json.dumps(res));break
            if i>4000: print('timeout');break
            await pg.wait_for_timeout(250)
        await pg.screenshot(path=f'L{LEVEL}{MODE[0]}_end.png')
        print('ERR',errs[:8])
        await b.close()
asyncio.run(main())
