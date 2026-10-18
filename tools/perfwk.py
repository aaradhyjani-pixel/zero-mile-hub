"""Real-time frame recorder (WebKit by default): Level 3's summit landings at 1x, every rAF frame timed, with what was
going on in it (sim time, cinematic, set pieces, draw calls, programs, audio element work), then a worst-frames report.
usage: perfwk.py <hub.html> <out.json> [secs=100] [webkit|chromium] [js run after the fast-forward]
(DSF=2: a Retina-scale page; HB=1: a main-thread heartbeat, so gaps outside our own JS show as "blocked"; --report <out.json> re-prints)
(one browser at a time; run it under nice: the numbers are relative, compare runs back to back on the same machine)"""
import asyncio, sys, json, os
from playwright.async_api import async_playwright

INIT = r'''
(()=>{try{localStorage.setItem('zm_snd','true');}catch(e){}
 const P=window.__P={on:false,fr:[],ev:[],mod:{},rc:0,last:null};
 const now=()=>performance.now(),ev=(k,d,x)=>{if(P.on)P.ev.push([+now().toFixed(2),k,+(+d||0).toFixed(2),x==null?'':String(x)]);};P.log=ev;
 const raf=window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame=function(cb){if(!cb||cb.name!=='frame')return raf(cb);
   return raf(ts=>{const s=now();P.mod={};P.rc=0;P.dom=0;P.gbr=0;cb(ts);const e=now();if(!P.on)return;
     const H=window.HUB,Z=H.Z&&H.Z(),R=Z&&Z.renderer,V=Z&&Z.V3;let m=0;for(const k in P.mod)m+=P.mod[k];
     P.fr.push([+ts.toFixed(2),+s.toFixed(2),+(e-s).toFixed(2),Math.round(H.T*10)/10,R?R.info.render.calls:0,R?R.info.render.triangles:0,R?R.info.programs.length:0,+m.toFixed(2),+P.rc.toFixed(2),V&&V.cine?1:0,V?V.ql:-1,P.dom||0,P.gbr||0]);
     let top='',tv=0;for(const k in P.mod)if(P.mod[k]>tv){tv=P.mod[k];top=k;}if(tv>6)ev('slowmod',tv,top);
     const d=H.dbg?H.dbg():null,c=d&&d.cine?d.cine.f||d.cine.ban:'',sp=d?d.speed+'/'+d.pace:'';
     if(c!==P.lastC){P.lastC=c;ev('cine',0,c);}if(sp!==P.lastS){P.lastS=sp;ev('speed',0,sp);}
     const fk=Z&&Z.fx?Z.fx.filter(o=>o&&H.T>=o.t0&&H.T<=o.t1).map(o=>o.kind).join(','):'';if(fk!==P.lastF){P.lastF=fk;ev('fx',0,fk);}
     if(R){const g=R.info.programs.length+'p '+R.info.memory.geometries+'g '+R.info.memory.textures+'t';if(g!==P.lastG){P.lastG=g;ev('gpu',0,g);}}
     if(V&&V.ql!==P.lastQ){P.lastQ=V.ql;ev('ql',0,V.ql);}});};
 const A=window.Audio;const W=function(src){const s=now();const a=arguments.length?new A(src):new A();ev('newAudio',now()-s,src);return a;};W.prototype=A.prototype;window.Audio=W;
 for(const k of ['play','load','pause']){const o=HTMLMediaElement.prototype[k];HTMLMediaElement.prototype[k]=function(){const s=now();const r=o.apply(this,arguments);ev(k,now()-s,(this.src||'').split('/').pop());return r;};}
 const sd=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');if(sd&&sd.set)Object.defineProperty(HTMLMediaElement.prototype,'src',{get:sd.get,set(v){const s=now();sd.set.call(this,v);ev('src=',now()-s,String(v).split('/').pop());},configurable:true});
 {const g=Element.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(){if(P.on){P.gbr=(P.gbr||0)+1;P.gbrT=(P.gbrT||0)+1;}return g.call(this);};}
 // timers: callbacks over 3 ms are logged; HB=1 adds a MessageChannel heartbeat (main thread blocked > 40 ms shows as 'blocked')
 const st=window.setTimeout.bind(window);window.setTimeout=function(f,ms,...a){if(typeof f!=='function')return st(f,ms,...a);return st(function(){const s=now();try{return f.apply(this,arguments);}finally{const d=now()-s;if(d>3)ev('timer',d,(f.name||'anon')+' '+(ms|0));}},ms,...a);};
 P.hb=()=>{const ch=new MessageChannel();let last=now();ch.port1.onmessage=()=>{const t=now();if(P.on&&t-last>40)P.ev.push([+last.toFixed(2),'blocked',+(t-last).toFixed(1),'']);last=t;st(()=>ch.port2.postMessage(0),2);};ch.port2.postMessage(0);};
 try{new PerformanceObserver(l=>{for(const e of l.getEntries())ev('longtask',e.duration,'');}).observe({entryTypes:['longtask']});}catch(e){P.noLT=1;}
 // DOM writes: count innerHTML / textContent sets per frame on the HUD (cheap wrappers)
 for(const [proto,k] of [[Element.prototype,'innerHTML'],[Node.prototype,'textContent']]){const d=Object.getOwnPropertyDescriptor(proto,k);if(!d||!d.set)continue;
   Object.defineProperty(proto,k,{get:d.get,set(v){const s=now();d.set.call(this,v);const t=now()-s;if(P.on){P.dom=(P.dom||0)+1;P.domT=(P.domT||0)+1;P.domMs=(P.domMs||0)+t;if(t>2)ev('dom',t,(this.id||this.className||this.tagName)+'.'+k);}},configurable:true});}
})();
'''
HOOK = r'''
(()=>{const P=window.__P,Z=window.HUB.Z(),V=Z.V3;
 for(const k in Z.mods){const m=Z.mods[k];if(!m||!m.update)continue;const u=m.update;m.update=function(a,b){const s=performance.now();const r=u.call(this,a,b);P.mod[k]=(P.mod[k]||0)+performance.now()-s;return r;};}
 if(V.comp){const r=V.comp.render.bind(V.comp);V.comp.render=d=>{const s=performance.now();r(d);P.rc+=performance.now()-s;};}
 return Object.keys(Z.mods);})()
'''

async def main():
    url = sys.argv[1]; out = sys.argv[2]; secs = float(sys.argv[3]) if len(sys.argv) > 3 else 100
    eng = sys.argv[4] if len(sys.argv) > 4 else 'webkit'; extra = sys.argv[5] if len(sys.argv) > 5 else ''
    if not url.startswith(('file:', 'http')): url = 'file://' + os.path.abspath(url)
    async with async_playwright() as p:
        b = await getattr(p, eng).launch(); logs = []
        pg = await b.new_page(viewport={'width': 1440, 'height': 860}, device_scale_factor=float(os.environ.get('DSF', '1')))
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'[:200]) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append(f'pageerror: {e}'[:200]))
        await pg.add_init_script(INIT)
        await pg.goto(url); await pg.wait_for_timeout(800)
        await pg.evaluate("window.HUB.view('3d')"); ok = await pg.evaluate('window.HUB.ready3d()')
        await pg.evaluate('window.HUB.startLevel(3)'); await pg.evaluate('window.HUB.pause()')
        await pg.evaluate('window.HUB.ff(3000)')
        if extra: await pg.evaluate(extra)
        for _ in range(40):
            if await pg.evaluate('window.HUB.Z().V3.warm') == 3: break
            await pg.wait_for_timeout(250)
        await pg.wait_for_timeout(2500)
        mods = await pg.evaluate(HOOK)
        if os.environ.get('HB'): await pg.evaluate('window.__P.hb()')
        await pg.evaluate('window.__P.on=true;window.HUB.speed(1)')
        await pg.wait_for_timeout(int(secs * 1000))
        P = await pg.evaluate('(()=>{const P=window.__P;P.on=false;return {fr:P.fr,ev:P.ev,dom:P.domT||0,domMs:P.domMs||0,noLT:!!P.noLT,gbrT:P.gbrT||0}})()')
        st = await pg.evaluate('window.HUB.stats3d()')
        await b.close()
    P['logs'] = logs; P['mods'] = mods; P['stats'] = st; P['ready'] = ok
    json.dump(P, open(out, 'w'))
    report(P)

def report(P):
    fr = P['fr']; ev = P['ev']
    if len(fr) < 3: print('no frames', P.get('logs')); return
    dts = [fr[i][0] - fr[i - 1][0] for i in range(1, len(fr))]; cpu = [f[2] for f in fr]
    s = sorted(dts); n = len(s); q = lambda a, k: a[min(len(a) - 1, int(len(a) * k))]
    span = (fr[-1][0] - fr[0][0]) / 1000
    print(f"frames {len(fr)} over {span:.1f}s = {len(fr)/span:.1f} fps | rAF dt med {q(s,.5):.1f} p90 {q(s,.9):.1f} p99 {q(s,.99):.1f} max {s[-1]:.1f} ms"
          f" | >25ms {sum(d>25 for d in dts)} >50ms {sum(d>50 for d in dts)} >100ms {sum(d>100 for d in dts)}")
    sc = sorted(cpu); print(f"frame JS cpu med {q(sc,.5):.1f} p90 {q(sc,.9):.1f} p99 {q(sc,.99):.1f} max {sc[-1]:.1f} ms | mods med {q(sorted(f[7] for f in fr),.5):.1f} render med {q(sorted(f[8] for f in fr),.5):.1f}"
          f" | DOM writes {P['dom']} ({P['domMs']:.0f} ms) | longtask api {'no' if P['noLT'] else 'yes'}")
    print(f"calls max {max(f[4] for f in fr)} tris max {max(f[5] for f in fr)} programs {fr[0][6]}->{fr[-1][6]}")
    # by phase: cinematic or not
    for lab, sel in (('cine', lambda f: f[9]), ('map', lambda f: not f[9])):
        d = sorted(fr[i][0] - fr[i - 1][0] for i in range(1, len(fr)) if sel(fr[i]))
        c = sorted(fr[i][2] for i in range(1, len(fr)) if sel(fr[i]))
        if d: print(f"  {lab}: {len(d)} frames, dt med {q(d,.5):.1f} p90 {q(d,.9):.1f} p99 {q(d,.99):.1f} max {d[-1]:.1f} | cpu med {q(c,.5):.1f} p90 {q(c,.9):.1f} max {c[-1]:.1f}")
    worst = sorted(range(1, len(fr)), key=lambda i: -dts[i - 1])[:14]
    print('worst frames (dt, cpu, mods, render, T, calls, progs, cine) and events within the frame:')
    for i in sorted(worst):
        f = fr[i]; t0 = fr[i - 1][1]; t1 = f[1] + f[2]
        es = [f"{e[1]}:{e[2]}:{e[3][:28]}" for e in ev if t0 - 1 <= e[0] <= t1 + 1 and e[1] not in ('speed',)]
        print(f"  dt {dts[i-1]:6.1f} cpu {f[2]:6.1f} mods {f[7]:5.1f} rend {f[8]:5.1f} T {f[3]:7.1f} calls {f[4]} progs {f[6]} cine {f[9]} | {' '.join(es)[:260]}")
    au = [e for e in ev if e[1] in ('newAudio', 'play', 'load', 'src=', 'pause')]
    if au: print('audio calls', len(au), 'total ms', round(sum(e[2] for e in au), 1), 'max', max(e[2] for e in au), [f"{e[1]}:{e[2]}" for e in sorted(au, key=lambda e: -e[2])[:6]])
    sl = [e for e in ev if e[1] in ('slowmod', 'dom', 'longtask', 'timer', 'blocked')]
    if sl: print('slow pieces', [f"{e[1]}:{e[2]}:{e[3]}" for e in sorted(sl, key=lambda e: -e[2])[:12]])
    print('cine/fx/gpu timeline:', ' | '.join(f"{(e[0]-fr[0][1])/1000:.1f}s {e[1]}={e[3][:30]}" for e in ev if e[1] in ('cine', 'fx', 'gpu', 'ql'))[:1500])
    print('logs', P.get('logs', [])[:6])

if __name__ == '__main__':
    if sys.argv[1] == '--report': report(json.load(open(sys.argv[2])))
    else: asyncio.run(main())
