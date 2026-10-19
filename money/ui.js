/* money/ui.js — the money layer's user interface, as a self-contained module.
   It never reads game state on its own. The economy (wired into hub.js later) pushes numbers in
   through window.ZMMoney, and the dialogs hand decisions back through Promises.
   All amounts are in ₹ crore (1 crore = 100 lakh). See money/CONTRACT.md.
   Open the game with ?moneymock in the URL to see every component driven by fake data. */
(function(){
'use strict';
if(window.ZMMoney)return;
const M=window.ZMMoney={version:1};
/* names live in one place, so renaming the airport is one call: ZMMoney.config({...}) */
M.cfg={airportName:'Vikram Sarabhai International Airport',airportShort:'VSI',spvName:'Vikram Sarabhai International Airport Limited',spvShort:'VSIAL',years:60,
  coinvestor:{name:'L5 Capital: Lagrange Point Infrastructure Fund',blurb:'Patient money. Like a body parked at the L5 point, it stays put for decades.'},
  rivals:[{name:'Kármán Line Ventures',blurb:'Aggressive. Always reaching for the edge of space. Bids high and overreaches.'},
          {name:'QNH Infragenesis',blurb:'Pension money. Sets its altimeter before every approach: never bids above what it can fund.'},
          {name:'Thakral–Wainganga Airports',blurb:'A Nagpur developer named for Sarla Thakral, India\'s first woman pilot (1936), with a European operator.'}]};
M.config=function(o){Object.assign(M.cfg,o||{});return M.cfg;};
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- number formatting: crore above ₹1 cr, lakh below ---------- */
function fmt(v,opt){opt=opt||{};if(v==null||isNaN(v))return '—';const s=v<0?'−':opt.sign&&v>0?'+':'';const a=Math.abs(v);
  if(a>=1000)return s+'₹'+Math.round(a).toLocaleString('en-IN')+' cr';
  if(a>=1)return s+'₹'+(a>=10?Math.round(a):a.toFixed(1))+' cr';
  const l=a*100;return s+'₹'+(l>=10?Math.round(l):l.toFixed(1))+' L';}
M.fmt=fmt;

/* ---------- styles ---------- */
const CSS=`
.zmm-chip{position:relative;min-width:118px;padding:3px 8px 4px;border-left:1px solid var(--panel-edge);cursor:help}
.zmm-chip .k{font-family:var(--f-sign);font-weight:600;letter-spacing:.05em;text-transform:uppercase;font-size:10.5px;color:var(--ink-3);white-space:nowrap;display:flex;gap:6px;align-items:center}
.zmm-chip .v{font-family:var(--f-mono);font-size:17px;font-weight:500;line-height:1.15;white-space:nowrap}
.zmm-chip .r{font-family:var(--f-mono);font-size:10px;color:var(--ink-3);white-space:nowrap}
.zmm-chip.up .v{color:var(--go)}.zmm-chip.dn .v{color:var(--stop)}
.zmm-chip canvas{display:block;width:100%;height:14px;margin-top:2px}
.zmm-chip .tick{position:absolute;right:6px;top:2px;font-family:var(--f-mono);font-size:10px;opacity:0;transition:opacity .25s}
.zmm-chip .tick.show{opacity:1}
#zmmFloat{position:absolute;inset:0;pointer-events:none;z-index:4;overflow:hidden}
.zmm-f{position:absolute;font-family:var(--f-mono);font-weight:700;font-size:12px;padding:1px 6px;border-radius:3px;white-space:nowrap;transform:translate(-50%,-100%);animation:zmmUp 1.8s ease-out forwards;text-shadow:0 1px 2px rgba(0,0,0,.8)}
.zmm-f.rev{color:#7dffb4;background:rgba(10,40,24,.72);border:1px solid rgba(58,208,127,.45)}
.zmm-f.cost{color:#ffb1a8;background:rgba(48,12,10,.75);border:1px solid rgba(255,77,63,.5)}
.zmm-f.big{font-size:15px}
@keyframes zmmUp{0%{opacity:0;transform:translate(-50%,-80%)}12%{opacity:1}75%{opacity:1}100%{opacity:0;transform:translate(-50%,-260%)}}
@media (prefers-reduced-motion:reduce){.zmm-f{animation:none;opacity:1}}
#zmmPL{padding:0 0 8px}
#zmmPL table{width:100%;border-collapse:collapse;font-size:12px}
#zmmPL th{position:sticky;top:0;background:#0d1114;text-align:left;font-family:var(--f-sign);font-weight:600;letter-spacing:.05em;text-transform:uppercase;font-size:10.5px;color:var(--ink-3);padding:5px 8px;border-bottom:1px solid var(--panel-edge)}
#zmmPL td{padding:4px 8px;border-bottom:1px solid #151c21}
#zmmPL td.a{text-align:right;font-family:var(--f-mono);white-space:nowrap}
#zmmPL tr.rev td.a{color:#9de8bd}#zmmPL tr.cost td.a{color:#ffb7ae}
#zmmPL tr.sum td{font-weight:600;border-top:1px solid var(--panel-edge);background:#0f1518}
#zmmPL .why{color:var(--ink-3);font-size:11px;display:block}
#zmmPL .bar{height:3px;border-radius:2px;margin-top:2px}
#zmmPL .note{padding:8px;color:var(--ink-3);font-size:11.5px}
#zmmOv{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;padding:18px 16px;background:linear-gradient(180deg,rgba(3,5,7,.7),rgba(3,5,7,.92))}
#zmmOv[hidden]{display:none!important}
.zmm-sheet{background:#0a0e11;border:1px solid var(--panel-edge);border-radius:8px;max-width:980px;width:100%;max-height:100%;overflow:auto;box-shadow:0 30px 80px rgba(0,0,0,.7)}
.zmm-sheet .band{background:var(--sign);color:var(--sign-ink,#121212);padding:8px 20px;font-family:var(--f-sign);font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:14px;display:flex;justify-content:space-between;gap:12px}
.zmm-sheet .in{padding:20px 24px 22px}
.zmm-sheet h1{font-family:var(--f-sign);font-weight:700;font-size:44px;line-height:.98;margin:0 0 8px;text-wrap:balance}
.zmm-sheet h2{font-family:var(--f-sign);font-weight:600;font-size:21px;margin:18px 0 6px}
.zmm-sheet p{color:var(--ink-2);max-width:72ch;margin:0 0 9px;font-size:14.5px}
.zmm-sheet .steps{display:flex;gap:6px;margin:0 0 14px;flex-wrap:wrap}
.zmm-sheet .steps span{font-family:var(--f-sign);font-weight:600;letter-spacing:.05em;text-transform:uppercase;font-size:11.5px;color:var(--ink-3);border:1px solid var(--panel-edge);border-radius:3px;padding:2px 8px}
.zmm-sheet .steps span.on{color:var(--sign-ink,#121212);background:var(--sign);border-color:var(--sign)}
.zmm-sheet .steps span.done{color:var(--go);border-color:rgba(58,208,127,.4)}
.zmm-in{font:inherit;font-family:var(--f-sign);font-weight:600;font-size:30px;letter-spacing:.02em;background:#0e1316;color:var(--ink);border:1px solid var(--panel-edge);border-radius:5px;padding:8px 12px;width:min(520px,100%)}
.zmm-in:focus{outline:2px solid var(--sign);outline-offset:1px}
.zmm-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0 4px}
.zmm-go{background:var(--sign);color:var(--sign-ink,#121212);font-family:var(--f-sign);font-weight:700;letter-spacing:.05em;text-transform:uppercase;font-size:17px;padding:10px 20px;border-radius:4px}
.zmm-go:disabled{opacity:.4;cursor:not-allowed}
.zmm-ghost{border:1px solid var(--panel-edge);color:var(--ink);font-family:var(--f-sign);font-weight:600;letter-spacing:.05em;text-transform:uppercase;font-size:15px;padding:9px 16px;border-radius:4px}
.zmm-ghost:hover,.zmm-opt:hover{border-color:var(--sign)}
.zmm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:9px;margin:10px 0}
.zmm-box{border:1px solid var(--panel-edge);border-radius:6px;padding:10px 12px;background:#0d1215}
.zmm-box .k{font-family:var(--f-sign);font-weight:600;letter-spacing:.05em;text-transform:uppercase;font-size:11px;color:var(--ink-3)}
.zmm-box .v{font-family:var(--f-mono);font-size:21px;margin-top:2px}
.zmm-box .s{font-size:12px;color:var(--ink-3);margin-top:3px}
.zmm-opt{display:flex;flex-direction:column;gap:4px;text-align:left;border:1px solid var(--panel-edge);border-radius:6px;padding:10px 12px;background:#0d1215}
.zmm-opt.on{border-color:var(--sign);box-shadow:inset 0 0 0 1px var(--sign)}
.zmm-opt b{font-family:var(--f-sign);font-weight:600;font-size:18px}
.zmm-opt span{font-size:12.5px;color:var(--ink-2)}
.zmm-own{display:flex;height:26px;border-radius:4px;overflow:hidden;margin:8px 0 4px;font-family:var(--f-sign);font-weight:700;font-size:13px;letter-spacing:.03em}
.zmm-own div{display:flex;align-items:center;justify-content:center;color:#0b0b0b;white-space:nowrap;overflow:hidden}
.zmm-range{width:min(520px,100%);accent-color:var(--sign)}
.zmm-big{font-family:var(--f-mono);font-size:30px}
.zmm-rivals{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin:8px 0}
.zmm-rivals div{border:1px dashed var(--panel-edge);border-radius:5px;padding:8px 10px;font-size:12.5px;color:var(--ink-2)}
.zmm-rivals b{display:block;font-family:var(--f-sign);font-weight:600;font-size:16px;color:var(--ink)}
.zmm-meter{height:8px;background:#1b2329;border-radius:4px;overflow:hidden;margin:4px 0}
.zmm-meter i{display:block;height:100%}
.zmm-card{display:grid;grid-template-columns:1fr auto;gap:2px 10px;text-align:left;border:1px solid var(--panel-edge);border-radius:6px;padding:10px 12px;background:#0d1215}
.zmm-card.on{border-color:var(--go);box-shadow:inset 0 0 0 1px var(--go)}
.zmm-card.own{opacity:.55;cursor:default}
.zmm-card:disabled{opacity:.35;cursor:not-allowed}
.zmm-card b{font-family:var(--f-sign);font-weight:600;font-size:17px}
.zmm-card .c{font-family:var(--f-mono);font-size:13px;color:var(--sign);text-align:right}
.zmm-card .e{grid-column:1/3;font-size:12.5px;color:var(--ink-2)}
.zmm-card .w{grid-column:1/3;font-size:11.5px;color:var(--ink-3)}
.zmm-order{border:1px solid #3b3220;border-radius:6px;background:#100e08;padding:12px 14px;margin:10px 0}
.zmm-order .h{font-family:var(--f-sign);font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:12px;color:var(--sign)}
.zmm-order .t{font-size:14px;color:var(--ink);margin-top:4px}
.zmm-is{width:100%;border-collapse:collapse;font-size:14px;margin:8px 0}
.zmm-is td{padding:6px 8px;border-bottom:1px solid #182027}
.zmm-is td.a{text-align:right;font-family:var(--f-mono)}
.zmm-is tr.h td{font-family:var(--f-sign);font-weight:600;letter-spacing:.05em;text-transform:uppercase;font-size:12px;color:var(--ink-3);padding-top:14px}
.zmm-is tr.t td{font-weight:600;border-top:1px solid var(--panel-edge)}
.zmm-is tr.g td{color:var(--go);font-size:16px}
.zmm-is tr.b td{color:var(--stop)}
.zmm-hero{font-family:var(--f-sign);font-weight:700;font-size:28px;line-height:1.15;margin:14px 0 4px}
.zmm-hero em{font-style:normal;color:var(--sign)}
.zmm-cmp{display:grid;grid-template-columns:150px 1fr 60px;gap:4px 10px;align-items:center;font-size:13px;margin:6px 0}
.zmm-cmp .bar{height:10px;border-radius:3px;background:#2a3238}
.zmm-cmp .bar i{display:block;height:100%;border-radius:3px;background:var(--cool,#6aa3ff)}
.zmm-cmp.me .bar i{background:var(--sign)}.zmm-cmp.me span{color:var(--sign);font-weight:600}
.zmm-err{color:var(--stop);font-size:12.5px;min-height:18px}
@media (max-width:700px){.zmm-sheet h1{font-size:32px}.zmm-in{font-size:22px}}
`;

/* ---------- mount ---------- */
let mounted=false;
M.mount=function(){
  if(mounted)return;const app=$('#app');if(!app)return;mounted=true;
  const st=document.createElement('style');st.id='zmmCss';st.textContent=CSS;document.head.appendChild(st);
  // floater layer sits above the map canvas, under the HUD panels
  const fl=document.createElement('div');fl.id='zmmFloat';const map=$('#map');if(map&&map.nextSibling)app.insertBefore(fl,map.nextSibling);else app.appendChild(fl);
  // overlay for the money dialogs (separate from the game's own #overlay)
  const ov=document.createElement('div');ov.id='zmmOv';ov.hidden=true;ov.innerHTML='<div class="zmm-sheet" id="zmmSheet" role="dialog" aria-modal="true"></div>';app.appendChild(ov);
  // P&L tab in the right rail
  const bar=document.querySelector('#tabs .tabbar'),tabs=$('#tabs');
  if(bar&&tabs){const b=document.createElement('button');b.dataset.tab='pl';b.id='zmmPLBtn';b.textContent='P&L';b.hidden=true;bar.appendChild(b);
    const body=document.createElement('div');body.className='tabbody';body.id='zmmPLTab';body.hidden=true;body.innerHTML='<div id="zmmPL"><p class="note">The day\'s money appears here once a shift is running.</p></div>';tabs.appendChild(body);
    bar.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;const mine=t===b;body.hidden=!mine;b.classList.toggle('on',mine);
      if(mine){bar.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));tabs.querySelectorAll('.tabbody').forEach(x=>{if(x!==body)x.hidden=true;});}},true);}
};
M.enable=function(on){M.mount();const c=$('#zmmChip');if(on&&!c)buildChip();if(!on&&c)c.remove();const b=$('#zmmPLBtn');if(b)b.hidden=!on;if(!on){const t=$('#zmmPLTab');if(t&&!t.hidden){t.hidden=true;const first=document.querySelector('#tabs .tabbar button');if(first)first.click();}}};

/* ---------- top-strip chip ---------- */
let hist=[],lastTotal=null;
function buildChip(){const k=$('#kpis');if(!k)return;const d=document.createElement('div');d.className='zmm-chip';d.id='zmmChip';
  d.title='Profit so far this shift: everything the airport earned minus everything it spent. The small number is the current rate per hour.';
  d.innerHTML='<div class="k">Today <span class="tick"></span></div><div class="v">₹0.0 cr</div><div class="r">—</div><canvas width="200" height="28" aria-hidden="true"></canvas>';
  k.insertBefore(d,k.firstChild);}
M.setDay=function(o){M.mount();let c=$('#zmmChip');if(!c){buildChip();c=$('#zmmChip');if(!c)return;}
  const v=+o.total||0;c.querySelector('.v').textContent=fmt(v);c.classList.toggle('up',v>0);c.classList.toggle('dn',v<0);
  c.querySelector('.r').textContent=o.ratePerHr==null?'—':fmt(o.ratePerHr,{sign:true})+' an hour';
  if(lastTotal!=null&&Math.abs(v-lastTotal)>=0.005){const t=c.querySelector('.tick');const d=v-lastTotal;t.textContent=fmt(d,{sign:true});t.style.color=d>=0?'var(--go)':'var(--stop)';t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),900);}
  lastTotal=v;hist=o.history?o.history.slice(-60):hist.concat([v]).slice(-60);drawSpark(c.querySelector('canvas'));};
function drawSpark(cv){const g=cv.getContext('2d');const W=cv.width,H=cv.height;g.clearRect(0,0,W,H);if(hist.length<2)return;
  const mn=Math.min(0,...hist),mx=Math.max(0,...hist),sp=(mx-mn)||1;const X=i=>i/(hist.length-1)*(W-2)+1,Y=v=>H-2-(v-mn)/sp*(H-4);
  g.strokeStyle='rgba(255,255,255,.18)';g.beginPath();g.moveTo(0,Y(0));g.lineTo(W,Y(0));g.stroke();
  g.lineWidth=2;g.strokeStyle=hist[hist.length-1]>=0?'#3ad07f':'#ff4d3f';g.beginPath();hist.forEach((v,i)=>i?g.lineTo(X(i),Y(v)):g.moveTo(X(i),Y(v)));g.stroke();}

/* ---------- floaters on the map ---------- */
const live=[];
M.float=function(sx,sy,amount,opt){M.mount();opt=opt||{};const fl=$('#zmmFloat');if(!fl||!isFinite(sx)||!isFinite(sy))return;
  const now=performance.now();for(let i=live.length-1;i>=0;i--)if(now-live[i].t>1700)live.splice(i,1);
  const near=live.find(o=>Math.abs(o.x-sx)<44&&Math.abs(o.y-sy)<28&&(o.amt>=0)===(amount>=0)&&now-o.t<900);
  if(near){near.amt+=amount;near.el.textContent=(opt.label?opt.label+' ':'')+fmt(near.amt,{sign:true});return;}
  if(live.length>=(opt.max||6)){const o=live.shift();o.el.remove();}
  const e=document.createElement('div');e.className='zmm-f '+(amount>=0?'rev':'cost')+(Math.abs(amount)>=(opt.bigAt||1)?' big':'');
  e.textContent=(opt.label?opt.label+' ':'')+fmt(amount,{sign:true});e.style.left=sx+'px';e.style.top=sy+'px';fl.appendChild(e);
  live.push({x:sx,y:sy,amt:amount,el:e,t:now});setTimeout(()=>e.remove(),1850);};

/* ---------- P&L tab ---------- */
M.setPL=function(lines,opt){M.mount();opt=opt||{};const box=$('#zmmPL');if(!box)return;
  const rev=lines.filter(l=>l.kind==='rev'),cost=lines.filter(l=>l.kind==='cost');const sum=a=>a.reduce((s,l)=>s+(+l.amount||0),0);
  const R=sum(rev),C=sum(cost),mx=Math.max(1e-9,...lines.map(l=>Math.abs(+l.amount||0)));
  const row=l=>`<tr class="${l.kind}" title="${esc(l.why||'')}"><td>${l.term?`<span class="term" tabindex="0" data-k="${esc(l.term)}">${esc(l.label)}</span>`:esc(l.label)}${l.sub?`<span class="why">${esc(l.sub)}</span>`:''}<div class="bar" style="width:${Math.abs(l.amount)/mx*100}%;background:${l.kind==='rev'?'#3ad07f':'#ff4d3f'}"></div></td><td class="a">${fmt(l.kind==='cost'?-Math.abs(l.amount):l.amount)}</td></tr>`;
  box.innerHTML=`<table><thead><tr><th>${esc(opt.title||'This shift')}</th><th style="text-align:right">₹</th></tr></thead><tbody>`+
   rev.map(row).join('')+`<tr class="sum"><td>Revenue</td><td class="a">${fmt(R)}</td></tr>`+
   cost.map(row).join('')+`<tr class="sum"><td>Costs</td><td class="a">${fmt(-Math.abs(C))}</td></tr>`+
   `<tr class="sum"><td>Profit before interest</td><td class="a" style="color:${R-C>=0?'var(--go)':'var(--stop)'}">${fmt(R-C)}</td></tr></tbody></table>`+(opt.note?`<p class="note">${esc(opt.note)}</p>`:'');};

/* ---------- dialog plumbing ---------- */
function open(html){M.mount();const ov=$('#zmmOv'),sh=$('#zmmSheet');sh.innerHTML=html;ov.hidden=false;sh.scrollTop=0;const f=sh.querySelector('[autofocus]')||sh.querySelector('button,input');if(f)setTimeout(()=>{f.focus({preventScroll:true});sh.scrollTop=0;},30);return sh;}
function close(){const ov=$('#zmmOv');if(ov)ov.hidden=true;}
M.close=close;
const stepper=(names,i)=>`<div class="steps">${names.map((n,k)=>`<span class="${k===i?'on':k<i?'done':''}">${k+1} · ${esc(n)}</span>`).join('')}</div>`;

/* ---------- onboarding: company → SPV → bid → financial close ---------- */
/* opts: {defaultName, capexCr, partners:[{name,pct,color}], rivals:[{name,blurb}],
          bidTypes:{share:{min,max,step,def,benchmarks:[{name,val}]}, ppf:{min,max,step,def,benchmarks}},
          gearing:{min,max,def}, previewBid(bid)->{winPct, note}, previewClose(cfg)->{equityCr,debtCr,parentCr,minDscr,note}}
   resolves {parent, bid:{type,value}, gearing, repayment} or null if cancelled */
M.onboarding=function(opts){opts=opts||{};
  const S=['Your company','The SPV','The bid','Financial close'];
  const st={parent:opts.defaultName||'',bid:{type:'share',value:(opts.bidTypes&&opts.bidTypes.share||{}).def||30},gearing:(opts.gearing||{}).def||70,repayment:'sculpted'};
  return new Promise(res=>{
  const band=`<div class="band"><span>${esc(M.cfg.spvName)} · ${esc(M.cfg.spvShort)}</span><span>Concession · ${M.cfg.years} years</span></div>`;
  function s1(){const sh=open(band+`<div class="in">${stepper(S,0)}<h1>Who is building India's busiest airport?</h1>
    <p>Name your company. It will found the concession company, raise the money, build the airport and run it for 60 years. Then it hands the airport back to the state.</p>
    <input class="zmm-in" id="zmmName" maxlength="40" placeholder="Your company name" value="${esc(st.parent)}" autofocus aria-label="Company name">
    <div class="zmm-err" id="zmmNErr"></div>
    <div class="zmm-row"><button class="zmm-go" id="zmmN1">Found the company</button><button class="zmm-ghost" id="zmmX">Not now</button></div></div>`);
    const go=()=>{const v=sh.querySelector('#zmmName').value.trim();if(v.length<2){sh.querySelector('#zmmNErr').textContent='Give your company a name of at least two characters.';return;}st.parent=v;s2();};
    sh.querySelector('#zmmN1').onclick=go;sh.querySelector('#zmmName').onkeydown=e=>{if(e.key==='Enter')go();};sh.querySelector('#zmmX').onclick=()=>{close();res(null);};}
  function s2(){const P=opts.partners||[{name:st.parent,pct:80,color:'#f4c430'},{name:'Airports Authority of India',pct:10,color:'#6aa3ff'},{name:'State of Maharashtra (MADC)',pct:10,color:'#2fd3c6'}];
    P[0].name=st.parent;
    const sh=open(band+`<div class="in">${stepper(S,1)}<h1>${esc(st.parent)} founds ${esc(M.cfg.spvShort)}</h1>
    <p>Indian airports are built by a special-purpose company (an SPV) that holds the concession. ${esc(st.parent)} owns 80% of ${esc(M.cfg.spvName)}. The state's partners hold the rest and give the land on a nominal lease. You raise and spend everything else.</p>
    <div class="zmm-own" role="img" aria-label="${P.map(p=>p.name+' '+p.pct+'%').join(', ')}">${P.map(p=>`<div style="width:${p.pct}%;background:${p.color}">${p.pct>=15?esc(p.name)+' · ':''}${p.pct}%</div>`).join('')}</div>
    <div class="zmm-grid">${P.map(p=>`<div class="zmm-box"><div class="k">${esc(p.name)}</div><div class="v">${p.pct}%</div><div class="s">${esc(p.role||(p===P[0]?'Builds, finances and runs the airport':'State partner'))}</div></div>`).join('')}</div>
    <p>Same pattern as Bengaluru: a private majority, with AAI and the state as minority partners.</p>
    <div class="zmm-row"><button class="zmm-go" id="zmmN2" autofocus>Go to the bid</button><button class="zmm-ghost" id="zmmB">Back</button></div></div>`);
    sh.querySelector('#zmmN2').onclick=s3;sh.querySelector('#zmmB').onclick=s1;}
  function s3(){const T=opts.bidTypes||{share:{min:10,max:50,step:0.5,def:30,unit:'%'},ppf:{min:100,max:450,step:5,def:250,unit:'₹ / pax'}};
    const t=st.bid.type,cfg=T[t];if(st.bid.value<cfg.min||st.bid.value>cfg.max)st.bid.value=cfg.def;
    const rivals=opts.rivals||M.cfg.rivals;
    const pv=opts.previewBid?opts.previewBid({type:t,value:st.bid.value}):{winPct:50,note:''};
    const unit=t==='share'?'% of revenue to AAI':'₹ per passenger to AAI';
    const sh=open(band+`<div class="in">${stepper(S,2)}<h1>Bid for the concession</h1>
    <p>Three rivals want this airport. The state awards it to the bid that pays AAI the most. Bid high and you win, but you pay that share for 60 years. Bid low and you may lose it.</p>
    <div class="zmm-grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
      <button class="zmm-opt ${t==='share'?'on':''}" data-t="share"><b>Revenue share</b><span>A percentage of every rupee the airport earns goes to AAI. Delhi and Mumbai work this way.</span></button>
      <button class="zmm-opt ${t==='ppf'?'on':''}" data-t="ppf"><b>Per-passenger fee</b><span>A fixed fee to AAI for every passenger. Adani's six airports work this way.</span></button></div>
    <div class="zmm-big" id="zmmBV">${t==='share'?st.bid.value+'%':'₹'+st.bid.value}</div><div class="s" style="color:var(--ink-3);font-size:12.5px">${unit}</div>
    <input type="range" class="zmm-range" id="zmmBR" min="${cfg.min}" max="${cfg.max}" step="${cfg.step}" value="${st.bid.value}" aria-label="Bid">
    ${(cfg.benchmarks||[]).length?`<p style="font-size:12.5px;color:var(--ink-3)">Real bids: ${cfg.benchmarks.map(b=>esc(b.name)+' '+(t==='share'?b.val+'%':'₹'+b.val)).join(' · ')}</p>`:''}
    <h2>Chance of winning</h2><div class="zmm-meter"><i id="zmmWin" style="width:${pv.winPct}%;background:${pv.winPct>66?'var(--go)':pv.winPct>33?'var(--warn)':'var(--stop)'}"></i></div><p id="zmmWinT" style="font-size:13px">${esc(pv.note||'')}</p>
    <div class="zmm-rivals">${rivals.map(r=>`<div><b>${esc(r.name)}</b>${esc(r.blurb)}</div>`).join('')}</div>
    <div class="zmm-row"><button class="zmm-go" id="zmmN3">Submit the bid</button><button class="zmm-ghost" id="zmmB">Back</button></div></div>`);
    sh.querySelectorAll('.zmm-opt').forEach(b=>b.onclick=()=>{st.bid.type=b.dataset.t;st.bid.value=T[b.dataset.t].def;s3();});
    const r=sh.querySelector('#zmmBR');r.oninput=()=>{st.bid.value=+r.value;sh.querySelector('#zmmBV').textContent=t==='share'?st.bid.value+'%':'₹'+st.bid.value;
      const p=opts.previewBid?opts.previewBid({type:t,value:st.bid.value}):{winPct:50,note:''};const w=sh.querySelector('#zmmWin');w.style.width=p.winPct+'%';w.style.background=p.winPct>66?'var(--go)':p.winPct>33?'var(--warn)':'var(--stop)';sh.querySelector('#zmmWinT').textContent=p.note||'';};
    sh.querySelector('#zmmN3').onclick=s4;sh.querySelector('#zmmB').onclick=s2;}
  function s4(){const G=opts.gearing||{min:60,max:75,def:70};
    const pv=()=>opts.previewClose?opts.previewClose({gearing:st.gearing,repayment:st.repayment,bid:st.bid}):{equityCr:(opts.capexCr||56000)*(1-st.gearing/100),debtCr:(opts.capexCr||56000)*st.gearing/100,parentCr:(opts.capexCr||56000)*(1-st.gearing/100)*0.8,minDscr:null,note:''};
    const p=pv();
    const sh=open(band+`<div class="in">${stepper(S,3)}<h1>Financial close</h1>
    <p>Phase 1 costs ${fmt(opts.capexCr||56000)}. Lenders fund most of it. ${esc(st.parent)} puts in 80% of the equity. More debt means a bigger return on your money and less room when traffic disappoints.</p>
    <div class="zmm-grid"><div class="zmm-box"><div class="k">Debt</div><div class="v" id="zmmD">${fmt(p.debtCr)}</div><div class="s" id="zmmG">${st.gearing}% of the cost</div></div>
      <div class="zmm-box"><div class="k">Equity</div><div class="v" id="zmmE">${fmt(p.equityCr)}</div><div class="s">${100-st.gearing}% of the cost</div></div>
      <div class="zmm-box"><div class="k">${esc(st.parent)} puts in</div><div class="v" id="zmmP">${fmt(p.parentCr)}</div><div class="s">80% of the equity</div></div>
      <div class="zmm-box"><div class="k">Lowest <span class="term" tabindex="0" data-k="dscr">DSCR</span> forecast</div><div class="v" id="zmmM" style="color:${p.minDscr==null?'inherit':p.minDscr<1.1?'var(--stop)':p.minDscr<1.2?'var(--warn)':'var(--go)'}">${p.minDscr==null?'—':p.minDscr.toFixed(2)}</div><div class="s">Lenders warn below 1.20 and step in below 1.0</div></div></div>
    <h2>Debt share</h2><input type="range" class="zmm-range" id="zmmGR" min="${G.min}" max="${G.max}" step="1" value="${st.gearing}" aria-label="Debt share">
    <h2>Repayment</h2><div class="zmm-grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
      <button class="zmm-opt ${st.repayment==='sculpted'?'on':''}" data-r="sculpted"><b>Sculpted</b><span>Small repayments while traffic builds, growing later. Standard for Indian infrastructure.</span></button>
      <button class="zmm-opt ${st.repayment==='equal'?'on':''}" data-r="equal"><b>Equal instalments</b><span>The same every year. Cheaper interest overall, but the opening years are tight.</span></button></div>
    <p id="zmmCN" style="font-size:13px">${esc(p.note||'')}</p>
    <div class="zmm-row"><button class="zmm-go" id="zmmN4">Sign and start building</button><button class="zmm-ghost" id="zmmB">Back</button></div></div>`);
    const upd=()=>{const q=pv();sh.querySelector('#zmmD').textContent=fmt(q.debtCr);sh.querySelector('#zmmE').textContent=fmt(q.equityCr);sh.querySelector('#zmmP').textContent=fmt(q.parentCr);sh.querySelector('#zmmG').textContent=st.gearing+'% of the cost';const m=sh.querySelector('#zmmM');m.textContent=q.minDscr==null?'—':q.minDscr.toFixed(2);m.style.color=q.minDscr==null?'inherit':q.minDscr<1.1?'var(--stop)':q.minDscr<1.2?'var(--warn)':'var(--go)';sh.querySelector('#zmmCN').textContent=q.note||'';};
    const r=sh.querySelector('#zmmGR');r.oninput=()=>{st.gearing=+r.value;upd();};
    sh.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{st.repayment=b.dataset.r;sh.querySelectorAll('[data-r]').forEach(x=>x.classList.toggle('on',x===b));upd();});
    sh.querySelector('#zmmN4').onclick=()=>{close();res({parent:st.parent,bid:Object.assign({},st.bid),gearing:st.gearing,repayment:st.repayment});};sh.querySelector('#zmmB').onclick=s3;}
  s1();});
};

/* ---------- board meeting (between eras) ---------- */
/* opts: {era, years, parent, treasuryCr, cashCr, aera:{title,text,canAppeal,appealText}, dscr:{value,warn:1.2,covenant:1.1},
          investments:[{id,name,costCr,effect,why,payback,owned,disabled,reason}],
          dividend:{maxCr}, prepay:{maxCr}, debtCr}
   resolves {bought:[ids], appeal:bool, dividendCr, prepayCr} */
M.boardMeeting=function(o){o=o||{};return new Promise(res=>{
  const sel=new Set();let appeal=false,div=0,pre=0;
  const spend=()=>[...sel].reduce((s,id)=>s+((o.investments||[]).find(i=>i.id===id)||{}).costCr||0,0)+div+pre;
  const sh=open(`<div class="band"><span>Board meeting · era ${esc(o.era)} · ${esc(o.years||'')}</span><span>${esc(o.parent||'')} · ${esc(M.cfg.spvShort)}</span></div><div class="in">
   <h1>Board meeting</h1>
   <div class="zmm-grid">
    <div class="zmm-box"><div class="k">Cash available</div><div class="v" id="zmmCash">${fmt(o.cashCr)}</div><div class="s" id="zmmLeft"></div></div>
    <div class="zmm-box"><div class="k">Debt outstanding</div><div class="v">${fmt(o.debtCr)}</div><div class="s">${o.dscr?`<span class="term" tabindex="0" data-k="dscr">DSCR</span> last era ${o.dscr.value.toFixed(2)}`:''}</div></div>
    <div class="zmm-box"><div class="k">Lender view</div><div class="v" style="font-size:17px;color:${!o.dscr?'inherit':o.dscr.value<(o.dscr.covenant||1.1)?'var(--stop)':o.dscr.value<(o.dscr.warn||1.2)?'var(--warn)':'var(--go)'}">${!o.dscr?'—':o.dscr.value<1?'Step-in risk':o.dscr.value<(o.dscr.covenant||1.1)?'Covenant breached':o.dscr.value<(o.dscr.warn||1.2)?'On watch':'Comfortable'}</div><div class="s">Warn below ${(o.dscr&&o.dscr.warn||1.2).toFixed(2)} · covenant ${(o.dscr&&o.dscr.covenant||1.1).toFixed(2)}</div></div></div>
   ${o.aera?`<div class="zmm-order"><div class="h">${esc(o.aera.title||'AERA tariff order')}</div><div class="t">${esc(o.aera.text)}</div>${o.aera.canAppeal?`<div class="zmm-row"><label style="font-size:13px;color:var(--ink-2)"><input type="checkbox" id="zmmAp"> Appeal the order. ${esc(o.aera.appealText||'')}</label></div>`:''}</div>`:''}
   <h2>Invest</h2><div class="zmm-grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">${(o.investments||[]).map(i=>`<button class="zmm-card ${i.owned?'own':''}" data-id="${esc(i.id)}" ${i.owned||i.disabled?'disabled':''} aria-pressed="false"><b>${esc(i.name)}</b><span class="c">${i.owned?'Owned':fmt(i.costCr)}</span><span class="e">${esc(i.effect)}</span><span class="w">${esc(i.disabled&&i.reason?i.reason:(i.why||'')+(i.payback?' Payback about '+i.payback+'.':''))}</span></button>`).join('')}</div>
   ${o.dividend||o.prepay?`<h2>Cash</h2><div class="zmm-grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
     ${o.dividend?`<div class="zmm-box"><div class="k">Dividend to shareholders</div><div class="v" id="zmmDv">${fmt(0)}</div><input type="range" class="zmm-range" id="zmmDR" min="0" max="${o.dividend.maxCr}" step="${Math.max(1,o.dividend.maxCr/100)}" value="0" aria-label="Dividend"><div class="s">80% goes to your company. Lenders block dividends while the DSCR is below the covenant.</div></div>`:''}
     ${o.prepay?`<div class="zmm-box"><div class="k">Prepay debt</div><div class="v" id="zmmPv">${fmt(0)}</div><input type="range" class="zmm-range" id="zmmPR" min="0" max="${o.prepay.maxCr}" step="${Math.max(1,o.prepay.maxCr/100)}" value="0" aria-label="Prepay debt"><div class="s">Less interest from now on, and a safer DSCR.</div></div>`:''}</div>`:''}
   <div class="zmm-err" id="zmmBErr"></div>
   <div class="zmm-row"><button class="zmm-go" id="zmmBGo">Approve and play the next shift</button></div></div>`);
  const upd=()=>{const left=(o.cashCr||0)-spend();sh.querySelector('#zmmLeft').textContent='After these decisions: '+fmt(left);sh.querySelector('#zmmLeft').style.color=left<0?'var(--stop)':'';sh.querySelector('#zmmBGo').disabled=left<0;sh.querySelector('#zmmBErr').textContent=left<0?'That spends more cash than ZMIAL has. Drop something.':'';};
  sh.querySelectorAll('.zmm-card[data-id]').forEach(b=>b.onclick=()=>{const id=b.dataset.id;if(sel.has(id))sel.delete(id);else sel.add(id);b.classList.toggle('on',sel.has(id));b.setAttribute('aria-pressed',sel.has(id));upd();});
  const dr=sh.querySelector('#zmmDR');if(dr)dr.oninput=()=>{div=+dr.value;sh.querySelector('#zmmDv').textContent=fmt(div);upd();};
  const pr=sh.querySelector('#zmmPR');if(pr)pr.oninput=()=>{pre=+pr.value;sh.querySelector('#zmmPv').textContent=fmt(pre);upd();};
  const ap=sh.querySelector('#zmmAp');if(ap)ap.onchange=()=>{appeal=ap.checked;};
  sh.querySelector('#zmmBGo').onclick=()=>{close();res({bought:[...sel],appeal,dividendCr:div,prepayCr:pre});};upd();});};

/* ---------- income statement (end of a shift, an era, or the concession) ---------- */
/* opts: {band, title, sections:[{title, rows:[{label, amount, kind:'rev'|'cost'|'total'|'good'|'bad'}]}],
          hero, compare:[{name, value, me}], compareLabel, moments:[text], cta, cta2}
   resolves 'cta' or 'cta2' */
M.incomeStatement=function(o){o=o||{};return new Promise(res=>{
  const secs=(o.sections||[]).map(s=>`<tr class="h"><td colspan="2">${esc(s.title)}</td></tr>`+s.rows.map(r=>`<tr class="${r.kind==='total'?'t':r.kind==='good'?'g t':r.kind==='bad'?'b t':''}"><td>${esc(r.label)}</td><td class="a">${typeof r.amount==='string'?esc(r.amount):fmt(r.kind==='cost'?-Math.abs(r.amount):r.amount)}</td></tr>`).join('')).join('');
  const mx=Math.max(1,...(o.compare||[]).map(c=>c.value));
  const sh=open(`<div class="band"><span>${esc(o.band||'Income statement')}</span><span>${esc(M.cfg.spvShort)}</span></div><div class="in"><h1>${esc(o.title||'The numbers')}</h1>
   ${o.hero?`<div class="zmm-hero">${o.hero}</div>`:''}
   <table class="zmm-is">${secs}</table>
   ${o.compare&&o.compare.length?`<h2>${esc(o.compareLabel||'EBITDA margin compared')}</h2>${o.compare.map(c=>`<div class="zmm-cmp ${c.me?'me':''}"><span>${esc(c.name)}</span><div class="bar"><i style="width:${c.value/mx*100}%"></i></div><span class="mono">${c.value}%</span></div>`).join('')}`:''}
   ${o.moments&&o.moments.length?`<h2>The most expensive moments</h2><ul style="color:var(--ink-2);padding-left:18px">${o.moments.map(m=>`<li>${esc(m)}</li>`).join('')}</ul>`:''}
   <div class="zmm-row"><button class="zmm-go" id="zmmI1">${esc(o.cta||'Continue')}</button>${o.cta2?`<button class="zmm-ghost" id="zmmI2">${esc(o.cta2)}</button>`:''}</div></div>`);
  sh.querySelector('#zmmI1').onclick=()=>{close();res('cta');};const b2=sh.querySelector('#zmmI2');if(b2)b2.onclick=()=>{close();res('cta2');};});};

/* ---------- glossary terms the economy introduces (merge into hub.js GL) ---------- */
M.terms={
  aero:{t:'Aeronautical revenue',d:'Money from flying: landing fees by aircraft weight, parking fees per hour on a stand, and the user development fee each departing passenger pays. India\'s regulator AERA caps it.'},
  nonaero:{t:'Non-aeronautical revenue',d:'Money from everything else: shops, duty-free, food, car parks, the hotel, advertising, cargo. AERA does not cap it, which is why airports make their real profit here.'},
  mtow:{t:'MTOW',d:'Maximum take-off weight. Landing fees are charged per tonne of it, so an A380 (575 t) pays many times an A320 (79 t).'},
  udf:{t:'User development fee (UDF)',d:'A charge on every departing passenger\'s ticket that goes to the airport, set by AERA. New airports get higher UDFs because they still have to pay back the cost of building.'},
  aera:{t:'AERA',d:'The Airports Economic Regulatory Authority of India. Every five years it sets how much a major airport may charge airlines and passengers, from the airport\'s asset base, costs and a fair return.'},
  rab:{t:'Regulated asset base (RAB)',d:'What the regulator counts as invested in the airport. Charges are set so the airport earns a fair return on it. Build more and the RAB grows; it shrinks as assets depreciate.'},
  till:{t:'Hybrid till',d:'Under AERA\'s hybrid till, 30% of an airport\'s non-aeronautical revenue is used to lower what airlines and passengers pay. The other 70% the airport keeps.'},
  trueup:{t:'True-up',d:'If AERA lets an airport charge less than it was owed in one five-year period, the shortfall is carried into the next, with interest. Early squeezes can be recovered later.'},
  dscr:{t:'DSCR',d:'Debt service coverage ratio: the cash the airport makes divided by the loan payments due. At 1.0 it can just pay the bank. Lenders get nervous below 1.2, breach a covenant below 1.1, and can step in below 1.0.'},
  stepin:{t:'Lender step-in',d:'If the airport cannot service its debt, the lenders can take control of the concession company and replace its management. In the game that ends your concession.'},
  sla:{t:'SLA',d:'Service level agreement: the promises the airport makes to its airlines, such as how long they wait for a stand. Breaking them costs penalties.'},
  ebitda:{t:'EBITDA',d:'Earnings before interest, tax, depreciation and amortisation: what the airport earns from running itself, before paying for its debt and its buildings. Bengaluru\'s margin is about 72%, Delhi\'s about 37%.'},
  irr:{t:'Equity IRR',d:'The yearly return on the money your company put in, counting every rupee out and every dividend back, over the whole concession.'},
  spv:{t:'SPV',d:'Special-purpose vehicle: a company created for one project. The SPV exists only to hold this concession, so its debts stay ring-fenced from your parent company.'},
  concession:{t:'Concession',d:'The state\'s permission to build and run the airport for a fixed term, here 60 years, after which it is handed back.'}
};

/* ---------- auto-mount, and a mock driver for screenshots: ?moneymock ---------- */
function boot(){M.mount();if(!/[?&]moneymock\b/.test(location.search))return;
  M.enable(true);let total=0;const hs=[];
  setInterval(()=>{const d=(Math.random()-0.28)*0.9;total+=d;hs.push(total);M.setDay({total,ratePerHr:total/Math.max(1,hs.length)*60,history:hs});
    const map=$('#map');if(map){const r=map.getBoundingClientRect();M.float(r.width*(0.3+Math.random()*0.4),r.height*(0.3+Math.random()*0.4),d,{label:d>=0?'Landing':'SLA'});}},700);
  M.setPL([{label:'Landing fees',kind:'rev',amount:3.4,term:'aero',sub:'134 landings'},{label:'Parking',kind:'rev',amount:0.6,term:'aero'},{label:'UDF',kind:'rev',amount:7.9,term:'udf',sub:'12,880 departing passengers'},{label:'Shops and food',kind:'rev',amount:4.1,term:'nonaero'},{label:'Transfer incentive',kind:'rev',amount:0.8},
    {label:'Runways open',kind:'cost',amount:1.3,sub:'6 runways × 1.5 h'},{label:'Ops teams',kind:'cost',amount:0.7},{label:'SLA penalties',kind:'cost',amount:0.9,term:'sla'},{label:'Passenger care',kind:'cost',amount:0.4},{label:'Incidents and fuel claims',kind:'cost',amount:0.6}],{note:'Mock data: open the game without ?moneymock to see the real economy.'});
  window.__zmmDemo={
    onboarding:()=>M.onboarding({capexCr:56000,previewBid:b=>{const p=b.type==='share'?Math.min(98,Math.max(3,(b.value-18)*3.2)):Math.min(98,Math.max(3,(b.value-110)*0.35));return{winPct:p,note:p>66?'You probably win, but every rupee of revenue carries this share for 60 years.':p>33?'A coin toss against Kármán Line Ventures.':'Too low. A rival will outbid you.'};},previewClose:c=>({debtCr:56000*c.gearing/100,equityCr:56000*(1-c.gearing/100),parentCr:56000*(1-c.gearing/100)*0.8,minDscr:(c.repayment==='sculpted'?1.32:1.08)-(c.gearing-60)*0.012,note:c.repayment==='equal'?'Equal instalments squeeze the first years: expect a lender warning before Mumbai moves in.':'Sculpted repayments track traffic. The squeeze comes when Mumbai and Delhi need phase 1B.'}),
      bidTypes:{share:{min:10,max:50,step:0.5,def:30,benchmarks:[{name:'Navi Mumbai',val:12.6},{name:'Mumbai',val:38.7},{name:'Delhi',val:45.99}]},ppf:{min:100,max:450,step:5,def:250,benchmarks:[{name:'lowest Adani bid',val:115},{name:'highest recent bid',val:401}]}}}),
    board:()=>M.boardMeeting({era:3,years:'2041–46',parent:'Meridian Infra',cashCr:3120,debtCr:31400,dscr:{value:1.16,warn:1.2,covenant:1.1},aera:{title:'AERA order · control period 3',text:'Aeronautical charges for 2041–46: ₹1,040 per passenger on average, from a regulated asset base of ₹61,900 cr at an 11.3% allowed return. ₹1,820 cr of earlier shortfall is trued up over this period.',canAppeal:true,appealText:'Win and the tariff rises 6%. Lose and airline relations suffer for the whole era.'},
      investments:[{id:'cdm',name:'A-CDM system',costCr:420,effect:'Departures leave the gate only when the runway can take them. Shorter taxi queues.',why:'Airport collaborative decision making.',payback:'4 years'},{id:'drill',name:'Faster changeover drills',costCr:60,effect:'Runway mode changes take 75 s instead of 120 s.',payback:'1 year'},{id:'radar',name:'Bird radar',costCr:180,effect:'Fewer bird events and no closure surprises.',payback:'3 years'},{id:'ret',name:'Extra rapid-exit taxiway',costCr:240,effect:'Arrivals clear 27R faster; arrival spacing shrinks a little.',payback:'3 years'},{id:'apm',name:'APM train upgrade',costCr:900,effect:'Transfers 15% faster, so more connections are made.',payback:'6 years'},{id:'retail',name:'Retail upgrade in the Mall',costCr:650,effect:'+12% spend per passenger.',payback:'3 years'},{id:'g',name:'Satellite G (phase 1B)',costCr:7800,effect:'+40 stands for when Mumbai moves in.',disabled:true,reason:'Not enough cash: needs a debt top-up from the lenders.'},{id:'sweep',name:'Second sweeper truck',costCr:12,effect:'FOD sweeps fit into smaller gaps.',owned:true}],
      dividend:{maxCr:800},prepay:{maxCr:2000}}),
    income:()=>M.incomeStatement({band:'Concession complete · year 60',title:'Handback',hero:'<em>Meridian Infra</em> ran Vikram Sarabhai International for 60 years. <em>₹1,42,800 cr</em> returned on <em>₹13,440 cr</em> invested.',
      sections:[{title:'Over 60 years',rows:[{label:'Aeronautical revenue',amount:612000,kind:'rev'},{label:'Non-aeronautical revenue',amount:488000,kind:'rev'},{label:'Revenue share to AAI',amount:198000,kind:'cost'},{label:'Operating costs',amount:301000,kind:'cost'},{label:'EBITDA',amount:601000,kind:'total'}]},{title:'For your company',rows:[{label:'Equity IRR',amount:'16.8%',kind:'good'},{label:'Debt repaid',amount:'Yes, in year 24',kind:'total'},{label:'Lowest DSCR',amount:'1.12 (year 11)',kind:'total'}]}],
      compare:[{name:'Bengaluru (BIAL)',value:72},{name:'Mumbai (MIAL)',value:40},{name:'Delhi (DIAL)',value:37},{name:'Your VSIAL',value:55,me:true}],moments:['Year 11: Mumbai moved in before Satellite G opened. 19 aircraft a day waited for stands: ₹410 cr in SLA penalties.','Year 31: the pandemic year. Traffic fell 62% and the DSCR touched 0.94. The equity cure saved the concession.'],cta:'Start a new concession',cta2:'Back to the menu'})
  };
  if(/moneymock=onboarding/.test(location.search))window.__zmmDemo.onboarding();
  if(/moneymock=board/.test(location.search))window.__zmmDemo.board();
  if(/moneymock=income/.test(location.search))window.__zmmDemo.income();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
