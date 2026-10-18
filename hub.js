(function(){
'use strict';
const $=s=>document.querySelector(s);
const SPEC=JSON.parse(document.getElementById('specData').textContent);
const cv=$('#map'),ctx=cv.getContext('2d');
const wcv=$('#wcv'),wctx=wcv.getContext('2d');
let DPR=1,VW=0,VH=0;

/* ============ helpers ============ */
const lerp=(a,b,t)=>a+(b-a)*t,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b,c,d)=>Math.hypot(c-a,d-b);
const D2R=Math.PI/180;const compA=d=>(d-90)*D2R;
function angDiff(a,b){let d=b-a;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d;}
function pathLen(p){let L=0;for(let i=1;i<p.length;i++)L+=dist(p[i-1].x,p[i-1].y,p[i].x,p[i].y);return L;}
function pointAt(p,d){for(let i=1;i<p.length;i++){const L=dist(p[i-1].x,p[i-1].y,p[i].x,p[i].y);if(d<=L||i===p.length-1){const t=L?clamp(d/L,0,1):1;return{x:lerp(p[i-1].x,p[i].x,t),y:lerp(p[i-1].y,p[i].y,t),a:Math.atan2(p[i].y-p[i-1].y,p[i].x-p[i-1].x)};}d-=L;}return{x:p[0].x,y:p[0].y,a:0};}
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function rr(c,x,y,w,h,r){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
const mins=s=>Math.round(s/60);
let SIMR=mulberry(11);
const store={get(k){try{return JSON.parse(localStorage.getItem(k));}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};

/* ============ geometry from the architect's spec ============ */
const EXT=SPEC.extent;
const G=new Map();
const kk=(x,y)=>Math.round(x)+','+Math.round(y);
function gnode(x,y){const k=kk(x,y);let n=G.get(k);if(!n){n={k,x:Math.round(x),y:Math.round(y),out:[]};G.set(k,n);}return n;}
function gedge(a,b,one){if(a===b)return;const d=dist(a.x,a.y,b.x,b.y);if(!a.out.some(e=>e[0]===b.k))a.out.push([b.k,d]);if(!one&&!b.out.some(e=>e[0]===a.k))b.out.push([a.k,d]);}
const TWY=SPEC.taxiways.map(t=>({id:t.id,oneway:!!t.oneway,pts:t.pts.map(p=>({x:p[0],y:p[1]}))}));
(function buildGraph(){
  const segs=[];TWY.forEach((t,ti)=>{for(let i=1;i<t.pts.length;i++)segs.push({a:t.pts[i-1],b:t.pts[i],one:t.oneway,cuts:[]});});
  const verts=[];TWY.forEach(t=>t.pts.forEach(p=>verts.push(p)));
  const extra=[];(SPEC.runways||[]).forEach(r=>{(r.holds||[]).forEach(h=>extra.push({x:h.x,y:h.y}));(r.exits||[]).forEach(e=>extra.push({x:e.to[0],y:e.to[1]}));});
  [...(SPEC.concourses||[]).flatMap(c=>c.gates),...(SPEC.remote||[])].forEach(g=>extra.push({x:g.lane[0],y:g.lane[1]}));
  const pts=verts.concat(extra);
  for(const s of segs){const minx=Math.min(s.a.x,s.b.x)-2,maxx=Math.max(s.a.x,s.b.x)+2,miny=Math.min(s.a.y,s.b.y)-2,maxy=Math.max(s.a.y,s.b.y)+2;const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,L2=dx*dx+dy*dy;if(!L2)continue;
    for(const p of pts){if(p.x<minx||p.x>maxx||p.y<miny||p.y>maxy)continue;const t=((p.x-s.a.x)*dx+(p.y-s.a.y)*dy)/L2;if(t<=0.0005||t>=0.9995)continue;const px=s.a.x+dx*t,py=s.a.y+dy*t;if(Math.hypot(px-p.x,py-p.y)<1.6)s.cuts.push({t,x:p.x,y:p.y});}}
  // true crossings between segments
  for(let i=0;i<segs.length;i++){const s=segs[i];for(let j=i+1;j<segs.length;j++){const q=segs[j];
    if(Math.max(s.a.x,s.b.x)<Math.min(q.a.x,q.b.x)||Math.max(q.a.x,q.b.x)<Math.min(s.a.x,s.b.x)||Math.max(s.a.y,s.b.y)<Math.min(q.a.y,q.b.y)||Math.max(q.a.y,q.b.y)<Math.min(s.a.y,s.b.y))continue;
    const r1x=s.b.x-s.a.x,r1y=s.b.y-s.a.y,r2x=q.b.x-q.a.x,r2y=q.b.y-q.a.y;const den=r1x*r2y-r1y*r2x;if(Math.abs(den)<1e-6)continue;
    const t=((q.a.x-s.a.x)*r2y-(q.a.y-s.a.y)*r2x)/den,u=((q.a.x-s.a.x)*r1y-(q.a.y-s.a.y)*r1x)/den;
    if(t>0.0005&&t<0.9995&&u>0.0005&&u<0.9995){const x=s.a.x+r1x*t,y=s.a.y+r1y*t;s.cuts.push({t,x,y});q.cuts.push({t:u,x,y});}}}
  for(const s of segs){const chain=[s.a].concat(s.cuts.sort((a,b)=>a.t-b.t)).concat([s.b]);for(let i=1;i<chain.length;i++)gedge(gnode(chain[i-1].x,chain[i-1].y),gnode(chain[i].x,chain[i].y),s.one);}
})();
function nearestNode(x,y){let best=null,bd=1e18;for(const n of G.values()){const d=(n.x-x)**2+(n.y-y)**2;if(d<bd){bd=d;best=n;}}return best;}
function ensureNode(x,y){const k=kk(x,y);if(G.has(k))return G.get(k);const n=nearestNode(x,y);const m=gnode(x,y);gedge(m,n,false);return m;}
// heap dijkstra with cache
const RC=new Map();
function route(a,b){
  if(a===b)return[{x:G.get(a).x,y:G.get(a).y}];const ck=a+'|'+b;if(RC.has(ck))return RC.get(ck);
  const D=new Map(),P=new Map(),H=[];const push=(k,d)=>{H.push([d,k]);let i=H.length-1;while(i>0){const p=(i-1)>>1;if(H[p][0]<=H[i][0])break;[H[p],H[i]]=[H[i],H[p]];i=p;}};
  const pop=()=>{const top=H[0],last=H.pop();if(H.length){H[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<H.length&&H[l][0]<H[m][0])m=l;if(r<H.length&&H[r][0]<H[m][0])m=r;if(m===i)break;[H[m],H[i]]=[H[i],H[m]];i=m;}}return top;};
  D.set(a,0);push(a,0);let found=false;
  while(H.length){const [d,u]=pop();if(d>D.get(u))continue;if(u===b){found=true;break;}const n=G.get(u);for(const e of n.out){const nd=d+e[1];if(nd<(D.has(e[0])?D.get(e[0]):Infinity)){D.set(e[0],nd);P.set(e[0],u);push(e[0],nd);}}}
  let out=null;if(found){out=[];let c=b,g=0;while(c!==undefined&&g++<5000){const n=G.get(c);out.unshift({x:n.x,y:n.y});if(c===a)break;c=P.get(c);}}
  RC.set(ck,out);return out;
}
const RW=SPEC.runways.map(r=>{const o=Object.assign({},r);o.exits=(r.exits||[]).map(e=>({x:e.x,to:ensureNode(e.to[0],e.to[1]).k})).sort((a,b)=>b.x-a.x);o.holds=(r.holds||[]).map(h=>ensureNode(h.x,h.y).k);o.len=r.x1-r.x0;o.mode='OFF';o.locked=true;o.changeUntil=-1;o.closedUntil=-1;o.why='';o.tdList=[];o.lastSchedTd=-1e9;o.lastDep=-1e9;o.lastDepWake='M';o.lastArrWake='M';o.arrExit=-1e9;o.occ=null;o.ops=0;o.blocks=[];o.short=o.name.split('/')[1]||o.name;return o;}).sort((a,b)=>a.y-b.y);
const LONGEST=RW.reduce((a,b)=>b.len>a.len?b:a,RW[0]);
const GATES=[];
(SPEC.concourses||[]).forEach((c,ci)=>c.gates.forEach(g=>GATES.push({id:g.id,x:g.x,y:g.y,a:compA(g.nose),code:g.code,zone:g.zone,bridge:g.bridge!==false,lane:ensureNode(g.lane[0],g.lane[1]).k,conc:c.id,ci,occ:null,res:null,open:true,mars:g.mars,marsRole:g.marsRole})));
(SPEC.remote||[]).forEach(g=>GATES.push({id:g.id,x:g.x,y:g.y,a:compA(g.nose),code:g.code,zone:g.zone||'swing',bridge:false,lane:ensureNode(g.lane[0],g.lane[1]).k,conc:'REM',ci:-1,occ:null,res:null,open:true,remote:true,mars:g.mars,marsRole:g.marsRole}));
// MARS stands (Bengaluru T2 builds every gate this way): the wide position and its two narrowbody halves exclude each other
const MARS=new Map();GATES.forEach(g=>{if(g.mars){if(!MARS.has(g.mars))MARS.set(g.mars,[]);MARS.get(g.mars).push(g);}});
const marsBusy=g=>!!g.mars&&MARS.get(g.mars).some(o=>o!==g&&(o.occ||o.res)&&(o.marsRole==='wide'||g.marsRole==='wide'));
const CONC=(SPEC.concourses||[]).map((c,i)=>{const gs=GATES.filter(g=>g.ci===i);const cx=gs.reduce((s,g)=>s+g.x,0)/Math.max(1,gs.length),cy=gs.reduce((s,g)=>s+g.y,0)/Math.max(1,gs.length);const ln=gs.map(g=>G.get(g.lane));const lx=ln.reduce((s,n)=>s+n.x,0)/Math.max(1,ln.length),ly=ln.reduce((s,n)=>s+n.y,0)/Math.max(1,ln.length);return{id:c.id,name:c.name,zone:c.zone,cx,cy,lx,ly,apm:c.apm,gates:gs,path:c.outline?new Path2D(c.outline):null};});
const CONCI=Object.fromEntries(CONC.map(c=>[c.id,c]));
const laneShut=g=>{const c=g&&CONCI[g.conc];return !!(c&&c.laneShut>T);};
const PROC=(SPEC.buildings||[]).find(b=>b.kind==='processor');
const procC=(function(){if(SPEC.apm&&SPEC.apm.stations&&SPEC.apm.stations.length){const s=SPEC.apm.stations;return{x:s.reduce((a,b)=>a+b.x,0)/s.length,y:s.reduce((a,b)=>a+b.y,0)/s.length};}return{x:0,y:0};})();
CONC.forEach(c=>c.d=dist(c.cx,c.cy,procC.x,procC.y));
const CONC_ORDER=CONC.slice().sort((a,b)=>a.d-b.d);
const STACKS=[{id:'N',x:EXT.x1+3600,y:(EXT.y0+EXT.y1)/2-3900},{id:'C',x:EXT.x1+4300,y:(EXT.y0+EXT.y1)/2},{id:'S',x:EXT.x1+3600,y:(EXT.y0+EXT.y1)/2+3900}];
const PARK=(function(){const m=(SPEC.buildings||[]).find(b=>b.kind==='mro');if(m&&m.cx!=null)return nearestNode(m.cx,m.cy).k;const rem=GATES.filter(g=>g.remote);if(rem.length){const g=rem[rem.length-1];return g.lane;}return nearestNode(EXT.x0+500,0).k;})();

/* ============ time ============ */
const BASE=20;
let T=0,T0C=6*3600,LV=null,speed=1,paused=true,running=false,ended=false;
let LEN=5400;   // per level: LV.len
function clk(t){let v=((T0C+Math.floor(t))%86400+86400)%86400;return String(Math.floor(v/3600)).padStart(2,'0')+':'+String(Math.floor(v%3600/60)).padStart(2,'0');}

/* ============ aircraft and airlines ============ */
const TYPES={
  A20N:{name:'Airbus A320neo',len:37.6,span:35.8,code:'C',wake:'M',eng:2,pax:186,turn:40},
  A21N:{name:'Airbus A321neo',len:44.5,span:35.8,code:'C',wake:'M',eng:2,pax:222,turn:45},
  B38M:{name:'Boeing 737-8',len:39.5,span:35.9,code:'C',wake:'M',eng:2,pax:189,turn:40},
  AT76:{name:'ATR 72-600',len:27.2,span:27.1,code:'C',wake:'M',eng:2,pax:70,prop:true,turn:30},
  A359:{name:'Airbus A350-900',len:66.8,span:64.75,code:'E',wake:'H',eng:2,pax:303,turn:75},
  B788:{name:'Boeing 787-8',len:56.7,span:60.1,code:'E',wake:'H',eng:2,pax:254,turn:70},
  B789:{name:'Boeing 787-9',len:62.8,span:60.1,code:'E',wake:'H',eng:2,pax:290,turn:75},
  B77W:{name:'Boeing 777-300ER',len:73.9,span:64.8,code:'E',wake:'H',eng:2,pax:354,turn:80,hot:true},
  A333:{name:'Airbus A330-300',len:63.7,span:60.3,code:'E',wake:'H',eng:2,pax:290,turn:70},
  A388:{name:'Airbus A380-800',len:72.7,span:79.75,code:'F',wake:'J',eng:4,pax:489,turn:100,hot:true},
  IL96:{name:'Ilyushin Il-96-300PU',len:55.3,span:57.7,code:'E',wake:'H',eng:4,pax:120,turn:90},
  A124:{name:'Antonov An-124 Ruslan',len:68.96,span:73.3,code:'F',wake:'J',eng:4,pax:20,turn:120}
};
const CR={C:1,E:3,F:4};
const AL={
  '6E':{name:'IndiGo',radio:'IFLY',tail:'#3b42c4'},AI:{name:'Air India',radio:'AIR INDIA',tail:'#d0263a'},IX:{name:'Air India Express',radio:'EXPRESS INDIA',tail:'#e4572e'},
  QP:{name:'Akasa Air',radio:'AKASA AIR',tail:'#f26722'},SG:{name:'SpiceJet',radio:'SPICEJET',tail:'#e0262e'},
  EK:{name:'Emirates',radio:'EMIRATES',tail:'#d71a21'},QR:{name:'Qatar Airways',radio:'QATARI',tail:'#8a1648'},EY:{name:'Etihad',radio:'ETIHAD',tail:'#b8925a'},
  SQ:{name:'Singapore Airlines',radio:'SINGAPORE',tail:'#264a8c'},LH:{name:'Lufthansa',radio:'LUFTHANSA',tail:'#22397a'},BA:{name:'British Airways',radio:'SPEEDBIRD',tail:'#2f52a8'},
  SV:{name:'Saudia',radio:'SAUDIA',tail:'#12805a'},TG:{name:'Thai',radio:'THAI',tail:'#6a3496'},FZ:{name:'flydubai',radio:'SKY DUBAI',tail:'#1a4c86'},AF:{name:'Air France',radio:'AIRFRANS',tail:'#1d3c8f'},
  IN1:{name:'Air India One',radio:'INDIA ONE',tail:'#ff9933'},RSD:{name:'Rossiya Special Flight Squadron',radio:'RUSSIA',tail:'#1c3f94'}
};
const DOMC=[['Delhi','DEL','N',3],['Mumbai','BOM','W',3],['Bengaluru','BLR','S',3],['Hyderabad','HYD','S',2],['Chennai','MAA','S',2],['Kolkata','CCU','E',2],['Ahmedabad','AMD','W',2],['Pune','PNQ','W',1.5],['Goa','GOX','W',1],['Kochi','COK','S',1],['Jaipur','JAI','N',1],['Lucknow','LKO','N',1],['Guwahati','GAU','E',1],['Patna','PAT','E',1],['Bhubaneswar','BBI','E',1],['Srinagar','SXR','N',0.6],['Varanasi','VNS','N',0.8],['Indore','IDR','N',0.8],['Raipur','RPR','E',0.6],['Visakhapatnam','VTZ','E',0.8],['Thiruvananthapuram','TRV','S',0.8],['Chandigarh','IXC','N',0.7],['Amritsar','ATQ','N',0.6],['Coimbatore','CJB','S',0.6]];
const INTC=[['Dubai','DXB','W',['EK','6E','AI','FZ'],5],['Doha','DOH','W',['QR','6E'],2],['Abu Dhabi','AUH','W',['EY','6E','IX'],2],['Singapore','SIN','E',['SQ','AI','6E'],2],['London','LHR','W',['BA','AI'],1.5],['Frankfurt','FRA','W',['LH','AI'],1],['Paris','CDG','W',['AF','AI'],0.8],['Jeddah','JED','W',['SV','6E'],1],['Bangkok','BKK','E',['TG','6E','AI'],1.2]];
const DIRSTACK={N:0,W:1,E:1,S:2};

/* ============ levels ============ */
const LEVELS=[
  {n:1,name:'Opening day',sub:'Bengaluru moves in',from:'BLR',clock:'06:00',arr:42,dep:42,amp:0.9,rw:2,rwOpen:{R3:'ARR',R4:'DEP'},concs:'AB',intl:0.08,wide:0.06,a380:0,target:110,light:'day',
   blurb:'Kempegowda International closes at dawn and Bengaluru\'s airlines move in. Two runways, two concourses. Learn the bank chart and the runway desk.',
   last:{t:'Last flight out of Kempegowda',d:'<p>At 05:55, IndiGo 6E 6101 pushed back from Bengaluru\'s Kempegowda International: the last departure before it closed. Bengaluru\'s airlines now fly from here.</p><p>Look for its terminal-in-a-garden in ZMI: the gardens under the oculus, the planted valley where the Hall becomes the Mall, and a garden court at every pier root. And every stand built two ways, for one widebody or two narrowbodies, as at Bengaluru\'s T2.</p>'},
   script:[[300,'st_ribbon'],[900,'medical'],[2700,'st_tiger']],ops:[[700,'birds'],[2100,'fod']]},
  {n:2,name:'Ahmedabad and Hyderabad',sub:'+ Ahmedabad, Hyderabad',from:'BLR+AMD+HYD',clock:'09:00',arr:76,dep:76,amp:0.9,rw:4,rwOpen:{R2:'ARR',R3:'DEP',R4:'DEP',R5:'MIX'},concs:'ABC',intl:0.12,wide:0.10,a380:0,target:205,light:'day',
   blurb:'Sardar Vallabhbhai Patel International closes and Ahmedabad\'s flights move in, with Hyderabad\'s hub traffic. Four runways, taller waves: flip runways as each bank comes through.',
   last:{t:'Last flight out of Sardar Vallabhbhai Patel',d:'<p>At 08:50, IndiGo 6E 6202 left Ahmedabad and SVPIA closed. Ahmedabad\'s flights and Hyderabad\'s connecting banks now run through ZMI.</p><p>Ahmedabad lives on in the building\'s edges: jaali screens shade every sun-facing glass wall, and the forecourt is a stepwell, terraces stepping down to shaded water. Sardar Patel brought more than 560 princely states into one India; the unity marker under the oculus remembers it.</p>'},
   script:[[700,'st_kites'],[1500,'strike'],[3000,'medical'],[4000,'st_lastball']],ops:[[400,'birds'],[1200,'tug'],[2400,'fod'],[3800,'birds']]},
  {n:3,name:'Mumbai and the Gulf',sub:'+ Mumbai',from:'BLR+AMD+HYD+BOM',clock:'14:00',len:6600,arr:90,dep:90,amp:0.85,starsAt:{otp2:78,cx2:76,otp3:84,cx3:82},rw:5,rwOpen:{R1:'ARR',R2:'MIX',R3:'DEP',R4:'DEP',R5:'MIX'},concs:'ABCDE',intl:0.22,wide:0.18,a380:4,target:315,light:'heat',
   blurb:'Chhatrapati Shivaji Maharaj International closes: Mumbai\'s airlines and the Gulf wave arrive. 46 °C. Hot air is thin, so heavy jets need the long runway to get airborne.',
   last:{t:'Last flight out of Chhatrapati Shivaji Maharaj',d:'<p>At 13:50, Air India AI 629 left Mumbai\'s Terminal 2 and the airport closed. Mumbai\'s widebodies and the Gulf carriers now fly from here.</p><p>Mumbai holds up ZMI\'s roof: branching columns that flare into a field of coffers with coloured lenses, a 40 m cantilever over the kerb, and an art wall along the transfer route.</p>'},
   script:[[1500,'st_dabba'],[3000,'summit'],[4800,'medical']],ops:[[600,'birds'],[1500,'fod'],[2300,'tug'],[3900,'birds']]},
  {n:4,name:'Delhi. Full hub.',sub:'+ Delhi',from:'ALL 5 CITIES',clock:'12:00',arr:116,dep:116,amp:0.75,rw:6,rwOpen:{R1:'ARR',R2:'ARR',R3:'DEP',R4:'DEP',R5:'DEP',R6:'MIX'},concs:'ABCDEF',intl:0.25,wide:0.20,a380:6,target:315,light:'day',dust:[2400,3300],
   blurb:'Delhi\'s hub banks move in: four airports\' worth of traffic at the peak, about 230 movements an hour with peaks well above. Then a pre-monsoon squall kicks up an andhi (dust storm).',
   last:{t:'Delhi\'s banks move in',d:'<p>Delhi\'s own airport stays open for its city, but from today its connecting banks run through ZMI. Four cities\' traffic, three cities\' building, at the old Zero Mile.</p><p>The north lobe of the Hall points almost exactly at Delhi.</p>'},
   script:[[600,'st_whatsapp'],[1000,'lights'],[1800,'lane'],[2550,'shear'],[3700,'medical'],[4300,'st_trophy']],ops:[[500,'birds'],[1400,'tug'],[3000,'fod'],[4400,'birds']]}
];

/* ============ state ============ */
let flights=[],FID=0,S=null,incidents=[],INC=0,selected=null,hover=null,selRw=null;
const puffs=[],moveLog=[];
function resetState(){
  SUM=null;STO=[];CINE=null;MARKS=[];cinema.q=[];specialArr.list=[];flights=[];FID=0;incidents=[];INC=0;selected=null;hover=null;selRw=null;puffs.length=0;moveLog.length=0;ops.length=0;opsClock=0;lastCnx=-1e9;
  S={tl:[],flipLog:[],tlNext:0,combo:0,bestCombo:0,moves:0,arr:0,dep:0,depOnTime:0,arrOnTime:0,cnxMade:0,cnxMiss:0,safety:100,incOk:0,incDef:0,incTypes:{},hits:[],holdMin:0,div:0,goArounds:0,log:[],delaySum:0,flips:0};
  GATES.forEach(g=>{g.occ=null;g.res=null;});
  RW.forEach(r=>{r.tdList=[];r.lastSchedTd=-1e9;r.lastDep=-1e9;r.arrExit=-1e9;r.occ=null;r.changeUntil=-1;r.closedUntil=-1;r.why='';r.ops=0;r.flash=0;r.blocks=[];r.gapReq=false;r.degraded=false;r.strike=null;r.shear=false;r.sepK=1;r.sepUntil=-1;r.kiteUntil=-1;});
  Object.assign(FX,{chgK:1,chgUntil:-1,pushFreeze:-1,pushSlow:-1,pushSlowS:0});
  CONC.forEach(c=>{c.laneShut=-1;c.slowUntil=-1;});
  RC.clear();SIMR=mulberry(11);
}
const cs=f=>f.callsign||f.A.radio+' '+f.num,fl=f=>f.disp||f.al+' '+f.num;
function logE(t,tone){S.log.push({t:clk(T),text:t,tone:tone||''});}
function radio(src,text){$('#ticker').innerHTML=`<span class="mono" style="color:var(--ink-3)">${clk(T)}</span> <span class="src">${src}</span> ${text}`;}

/* ============ schedule ============ */
function buildLevel(L){
  const R=mulberry(1000+L.n*17);const pick=a=>a[Math.floor(R()*a.length)];
  const wdom=()=>{const tot=DOMC.reduce((s,d)=>s+d[3],0);let x=R()*tot;for(const d of DOMC){x-=d[3];if(x<=0)return d;}return DOMC[0];};
  const wint=()=>{const tot=INTC.reduce((s,d)=>s+d[4],0);let x=R()*tot;for(const d of INTC){x-=d[4];if(x<=0)return d;}return INTC[0];};
  const domAl=()=>{const x=R();return x<.55?'6E':x<.8?'AI':x<.9?'QP':x<.96?'IX':'SG';};
  const used=new Set();const num=(al,intl)=>{let n;for(let k=0;k<80;k++){n=String(intl?100+Math.floor(R()*900):(al==='6E'?2000+Math.floor(R()*6000):al==='AI'?400+Math.floor(R()*2600):1000+Math.floor(R()*900)));if(!used.has(al+n))break;}used.add(al+n);return n;};
  let a380left=L.a380;
  function mkSpec(){
    const intl=R()<L.intl;let al,city,type;
    if(intl){const c=wint();city=c;al=pick(c[3]);if(['6E','IX','FZ'].includes(al))type=R()<.7?'A21N':'B38M';else if(a380left>0&&['EK','QR','SQ','BA','LH'].includes(al)&&R()<.35){type='A388';a380left--;}else type=pick(al==='EK'||al==='BA'||al==='SV'?['B77W','B77W','A388'].slice(0,2):['A359','B789','B788','A333']);if(type==='A388'&&a380left<0)type='B77W';}
    else{city=wdom();al=domAl();if(R()<L.wide*0.5&&al==='AI')type=pick(['A359','B788','A333']);else if(al==='6E'&&R()<.05)type='AT76';else type=al==='6E'?(R()<.55?'A20N':'A21N'):al==='AI'?(R()<.5?'A20N':'A21N'):'B38M';}
    return{al,type,intl,city:city[0],code:city[1],dir:city[2]};
  }
  const per=3600;const amp=L.amp;
  const wv=t=>{const s=Math.sin(2*Math.PI*(t-600)/per);return Math.sign(s)*Math.pow(Math.abs(s),0.45);};
  const rateA=t=>L.arr/3600*(1+amp*wv(t));
  const rateD=t=>L.dep/3600*(1-amp*wv(t));
  const times=(rate,t0,t1)=>{const out=[];let acc=R();for(let t=t0;t<t1;t+=10){acc+=rate(t)*10;while(acc>=1){acc-=1;out.push(t+Math.floor(R()*10));}}return out;};
  const arrT=times(rateA,60,LEN);const depT=times(rateD,-600,LEN);
  const arrs=arrT.map(t=>Object.assign(mkSpec(),{eta:t}));
  const deps=depT.map(t=>Object.assign(mkSpec(),{std:t}));
  // pair departures with arrivals (turnarounds)
  const freeA=arrs.slice().sort((a,b)=>a.eta-b.eta);
  for(const d of deps.sort((a,b)=>a.std-b.std)){
    let best=null,bs=1e9;for(const a of freeA){if(a.paired||a.al!==d.al||a.type!==d.type||a.intl!==d.intl)continue;const turn=TYPES[a.type].turn*60;const slack=d.std-(a.eta+turn+300);if(slack<0)continue;if(slack<bs){bs=slack;best=a;}}
    if(best&&bs<3600){best.paired=d;d.from=best;}
  }
  // create flights
  for(const a of arrs){const f=mk({kind:'arr',state:'sched',al:a.al,type:a.type,intl:a.intl,from:a.city,fromCode:a.code,dir:a.dir,eta:a.eta,endurance:38+Math.floor(R()*20)});f.origEta=a.eta;f.spawnT=a.eta-D_APP-150;a.f=f;if(a.paired){f.turnTo=a.paired;}}
  const parked=[];
  for(const d of deps){
    if(d.from){d.from.f.turn={num:num(d.al,d.intl),std:d.std,to:d.city,toCode:d.code,dir:d.dir};d.from.f.num=num(d.al,d.intl);continue;}
    const f=mk({kind:'dep',state:'at_gate',al:d.al,type:d.type,intl:d.intl,to:d.city,toCode:d.code,dir:d.dir,std:d.std});f.num=num(d.al,d.intl);f.origStd=d.std;
    const late=R();f.readyAt=d.std-120-Math.floor(R()*300)+(late<0.12?300+Math.floor(R()*900):0);parked.push(f);
  }
  for(const f of flights)if(!f.num)f.num=num(f.al,f.intl);
  // park the departures at gates, earliest first
  parked.sort((a,b)=>a.std-b.std);
  for(const f of parked){const g=freeGate(f,true);if(g){g.occ=f;f.gate=g;f.x=g.x;f.y=g.y;f.heading=g.a;}else{f.state='cancelled';f.dropped=true;}}
  flights=flights.filter(f=>!f.dropped);
  // transfers: each arrival feeds 1 to 3 later departures
  const depList=flights.filter(f=>f.kind==='dep').concat(flights.filter(f=>f.turn).map(f=>({virtualOf:f,std:f.turn.std,intl:f.intl})));
  for(const a of flights.filter(f=>f.kind==='arr')){
    const tp=Math.round(a.pax*(a.intl?0.38:0.16));const cands=depList.filter(d=>d.std>=a.eta+(a.intl||d.intl?62:46)*60&&d.std<=a.eta+150*60&&d.virtualOf!==a);if(!cands.length)continue;
    const k=1+Math.floor(R()*3);for(let i=0;i<k;i++){const d=cands[Math.floor(R()*cands.length)];const n=Math.max(3,Math.round(tp/k*(0.6+R()*0.8)));const link={arr:a,n,x:(a.intl||d.intl?40:26)*60};(d.links=d.links||[]).push(link);}
  }
  for(const v of depList)if(v.virtualOf&&v.links)v.virtualOf.turnLinks=v.links;
}
function mk(o){const f=Object.assign({id:++FID,x:0,y:0,heading:Math.PI,alt:0,v:0,path:null,pd:0,plen:0,prio:false,held:false,trail:[]},o);f.T=TYPES[f.type];f.A=AL[f.al];f.pax=Math.round(f.T.pax*(0.78+SIMR()*0.18));flights.push(f);return f;}
function zoneOk(g,f){return g.zone==='swing'||(f.intl?g.zone==='intl':g.zone==='dom');}
function freeGate(f,initial){
  const code=CR[f.T.code];let best=null,bs=1e18;
  for(const g of GATES){if(g.occ||g.res||!g.open||CR[g.code]<code||!zoneOk(g,f)||marsBusy(g))continue;let s=(CR[g.code]-code)*400+(g.remote?2500:0);s+=dist(g.x,g.y,procC.x,procC.y)*(initial?0.02:0.1);if(s<bs){bs=s;best=g;}}
  return best;
}
function toDep(f){const t=f.turn;f.kind='dep';f.num=t.num;f.to=t.to;f.toCode=t.toCode;f.dir=t.dir;f.std=t.std;f.origStd=t.std;f.state='at_gate';f.links=f.turnLinks;f.readyAt=Math.max(f.std-120,f.inBlock+f.T.turn*60+(f.gate&&f.gate.remote?300:0));f.prio=false;f.held=false;}

/* ============ glossary ============ */
const GL={
  hub:{t:'You run hub control',d:'This is the airport operations centre of the hub. You decide what each runway does, deal with incidents and protect connections. Air traffic control flies the aircraft. You give it the runways to fly them on.'},
  bank:{t:'Banks and waves',d:'A hub schedules flights in waves. First a bank of arrivals lands within about half an hour, passengers change planes, then a bank of departures leaves. The bank chart at the bottom shows the waves coming. The trick is to give arrivals more runways while they land, then hand runways to departures.'},
  modes:{t:'Runway modes',d:'ARR: arrivals only, about 40 landings an hour. DEP: departures only, about 48 take-offs an hour. MIX: both, alternating, about 25 of each. OFF: closed. Changing a runway\'s mode takes 2 minutes while traffic on it clears.'},
  wake:{t:'Wake turbulence',d:'Wings leave spinning vortices behind them. Heavy jets leave stronger ones, so the aircraft after a 777 or an A380 waits longer. That is why widebodies eat runway capacity.'},
  stack:{t:'Holding stacks',d:'When arrivals come faster than the runways can land them, ATC parks them on racetrack loops in the sky, one above the other, 1,000 ft apart. The lowest leaves first. Holding burns fuel and every minute up there delays connections.'},
  cnx:{t:'Connections',d:'A hub lives on transfers. Each arriving aircraft carries passengers for later departures. If the arrival lands late, or the departure leaves early, they miss it. Domestic transfers need about 26 minutes in this hub, international about 40, because of immigration.'},
  fod:{t:'FOD: foreign object debris',d:'Anything loose on a runway: a bolt, a piece of tyre, a luggage tag. Engines suck it in and tyres burst on it. Air France 4590, the Concorde, was brought down by a metal strip on the runway in 2000. Airside ops sweeps for it in gaps between movements, or while a runway is changing over.'},
  birds:{t:'Bird strikes',d:'Black kites and egrets love the grass beside a runway. The wildlife team patrols all day from the perimeter road, so you only hear about birds when one hits an aircraft. Then there may be remains on the runway: inspect now and lose the runway for a few minutes, or keep going and accept the risk.'},
  ops:{t:'The ops teams have the routine',d:'Amber vehicles on the map are the airport\'s own teams: the wildlife patrol, the runway sweeper and the ramp tugs. They handle routine birds, debris and breakdowns for you, timed around the traffic. Your job is the runways and the few calls that need a duty manager.'},
  fuel:{t:'Minimum fuel and MAYDAY',d:'Aircraft carry fuel to hold for a while, then divert. Minimum fuel means the crew can accept no more delay. If it keeps holding, it declares MAYDAY: an emergency that jumps every queue. Long stacks cause this, so it is really a runway-planning problem.'},
  vvip:{t:'VVIP movements',d:'When a head of state or the Prime Minister flies, protocol closes a runway to all other traffic for a few minutes. You usually get only a few minutes\' warning. Choose the runway whose traffic is easiest to absorb elsewhere.'},
  lights:{t:'Runway edge lights',d:'White lights along both edges of a runway show pilots its width and length at night and in poor visibility. With some out, ATC can still land aircraft but needs more spacing between them.'},
  shear:{t:'Windshear',d:'A sudden change in wind speed or direction close to the ground, common at the gust front of a dust storm. An aircraft on short final can lose lift without warning, so pilots go around rather than risk a hard landing.'},
  heat:{t:'Heat and heavy jets',d:'Hot air is thinner, so wings make less lift and engines less thrust. At 46 °C a full A380 or 777 needs a much longer take-off roll, so it can only use the longest runway.'},
  gate:{t:'Gates, swing gates and remote stands',d:'Contact gates have aerobridges. Swing gates can serve domestic or international flights. Remote stands have no bridge, so passengers ride buses, which adds time.'},
  apm:{t:'APM: automated people mover',d:'The driverless train under the apron that links the central terminal with every concourse. Transfers depend on it.'},
  otp:{t:'On time',d:'The share of flights that ran to schedule. An arrival is on time if it lands within 15 minutes of its scheduled time, so time in the holding stack counts against you. A departure is on time if it is airborne within 25 minutes of its scheduled pushback: 15 minutes of tolerance plus a 10-minute taxi.'},
  dust:{t:'Andhi: dust storm',d:'Pre-monsoon dust storms sweep across central India. Visibility drops fast, crosswinds gust, and ATC widens the gaps between landings.'},
  mix:{t:'Mixed mode',d:'One runway doing both arrivals and departures, slotting a take-off between each pair of landings. Flexible, but each runway handles fewer movements in total than two specialised runways.'}
};
const term=(k,txt)=>`<span class="term" tabindex="0" data-k="${k}">${txt}</span>`;
const coachItems=[];let toastTimer=0;const seen=new Set();
function showToast(t,d){$('#tT').textContent=t;$('#tD').innerHTML=d.startsWith('<')?d:`<p>${d}</p>`;const el=$('#toast');el.hidden=false;el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');toastTimer=18;placeToast();}
function coach(t,d,alarm){coachItems.unshift({t,d,at:clk(T)});$('#coachList').innerHTML=coachItems.map(c=>`<div class="ci"><div class="tm">${c.at}</div><h4>${c.t}</h4>${c.d.startsWith('<')?c.d:`<p>${c.d}</p>`}</div>`).join('');showToast(t,d);$('#toast').classList.toggle('alarm',!!alarm);}
function explain(k){if(seen.has(k))return;seen.add(k);const g=GL[k];if(g)coach(g.t,g.d);}
// some lessons only need teaching once ever, not once per level
function explainOnce(k){const done=store.get('zm_seen')||{};if(done[k]){seen.add(k);return;}done[k]=1;store.set('zm_seen',done);explain(k);}
$('#tX').onclick=()=>{$('#toast').hidden=true;};
document.addEventListener('click',e=>{const t=e.target.closest('.term');if(t&&t.dataset.k&&GL[t.dataset.k])showToast(GL[t.dataset.k].t,GL[t.dataset.k].d);});
(function(){const g=$('#gloss');Object.keys(GL).forEach(k=>{const b=document.createElement('button');b.textContent=GL[k].t;b.onclick=()=>showToast(GL[k].t,GL[k].d);g.appendChild(b);});})();
function placeToast(){const w=$('#wave').getBoundingClientRect(),app=$('#app').getBoundingClientRect();$('#toast').style.bottom=(app.bottom-w.top+8)+'px';}

/* ============ runway logic ============ */
const D_APP=170,SEP_AA=88,SEP_DD=72,MIX_GAP=58,DEP_OCC=55,CHANGE=120;
// set-piece effects: slower changeovers, a pushback freeze or slowdown (reset each level)
const FX={chgK:1,chgUntil:-1,pushFreeze:-1,pushSlow:-1,pushSlowS:0};
let dustNow=false,heatNow=false;
const sepF=()=>dustNow?1.4:1;
const canArr=r=>!r.locked&&(r.mode==='ARR'||r.mode==='MIX')&&T>=r.changeUntil&&T>=r.closedUntil&&!r.gapReq;
const blockAt=(r,t,pre)=>r.blocks.some(b=>t>=b.from-(pre||0)&&t<b.to);
const canDep=r=>!r.locked&&(r.mode==='DEP'||r.mode==='MIX')&&T>=r.changeUntil&&T>=r.closedUntil;
const depModeOk=r=>!r.locked&&(r.mode==='DEP'||r.mode==='MIX');
const needsLong=f=>heatNow&&f.T.hot&&!f.offloaded;
function setMode(r,m,silent){
  if(r.locked||r.mode===m)return;const was=r.mode;r.mode=m;r.changeUntil=T+CHANGE*(T<FX.chgUntil?FX.chgK:1);S.flips++;S.flipLog.push({t:T,r:r.short,from:was,to:m});
  if(r.degraded){r.degraded=false;r.changeUntil+=120;radio('OPS',`Electricians fixing ${r.short}'s edge lights during the changeover.`);logE(`Edge lights on ${r.short} repaired during a changeover.`);}
  if(r.strike){r.strike=null;logE(`${r.short} inspected for bird remains during the changeover.`);}
  if(m!=='ARR'&&m!=='MIX')for(const f of flights)if(f.state==='approach'&&f.rwy===r&&f.td-T>40)breakOff(f,r);
  for(const f of flights){if((f.state==='taxi_out'||f.state==='hp')&&f.rwy===r&&!depModeOk(r))assignDep(f,true);}
  if(!silent){radio('AOCC',`Runway ${r.short} ${was} → ${m}. Changeover 2 minutes.`);logE(`Runway ${r.short} set to ${m}.`);}
  renderRw();
}
function rk(f){return(f.mayday?0:f.prio?1:f.minFuel?2:3)*1e7+(f.state==='holding'?f.holdSince:f.eta);}
function gateY(f){if(f.gate)return f.gate.y;if(f.res)return f.res.y;return procC.y;}
function arrSep(r){return (SEP_AA*sepF()+(r.lastArrWake==='J'?55:r.lastArrWake==='H'?25:0))*(r.degraded?1.6:1)*(T<r.sepUntil?r.sepK:1);}
function runways(){
  // arrivals
  const avail=RW.filter(r=>canArr(r)&&r.status!=='x');
  if(avail.length){
    const cands=flights.filter(f=>(f.state==='holding'||(f.state==='inbound'&&T>=f.eta-D_APP-40))).sort((a,b)=>rk(a)-rk(b));
    const depWaiting=r=>flights.some(f=>f.state==='hp'&&f.rwy===r);
    const ready=avail.filter(r=>{const td=T+D_APP;let need=r.lastSchedTd+arrSep(r);if(r.mode==='MIX'&&depWaiting(r))need+=MIX_GAP;return td>=need&&td>=r.lastDep+DEP_OCC&&!blockAt(r,td,30);});
    for(const c of cands){if(!ready.length)break;
      if(!c.res&&!c.gate){const g=freeGate(c);if(g){g.res=c;c.res=g;}}
      const gy=gateY(c);ready.sort((a,b)=>Math.abs(a.y-gy)-Math.abs(b.y-gy));const r=ready.shift();beginApproach(c,r,T+D_APP);}
  }
  // departures
  for(const r of RW){
    if(!canDep(r)||r.occ||T<r.arrExit+4||r.gapReq||blockAt(r,T,60))continue;
    const wk=r.lastDepWake==='J'?90:r.lastDepWake==='H'?30:0;
    if(T<r.lastDep+SEP_DD*(dustNow?1.15:1)+wk)continue;
    if(r.tdList.some(td=>td-T<DEP_OCC&&td-T>-12))continue;
    const q=flights.filter(f=>f.state==='hp'&&f.rwy===r&&!(needsLong(f)&&r!==LONGEST)).sort((a,b)=>(b.prio-a.prio)||(a.hpSince-b.hpSince));if(!q.length)continue;
    const f=q[0];f.state='lineup';r.occ=f;r.lastDep=T;r.lastDepWake=f.T.wake;f.rollT=T;
    if(r.strike&&r.strike.bad&&T<r.strike.until){r.strike=null;f.burst=true;}
    const st={x:r.x1-60,y:r.y};setPath(f,[{x:f.x,y:f.y},{x:r.x1-30,y:lerp(f.y,r.y,0.6)},st],50);
    radio('TWR',`${cs(f)}, runway ${r.short}, cleared for take-off.`);
  }
}
function assignDep(f,reroute){
  let opts=RW.filter(r=>depModeOk(r)&&T>=r.closedUntil-300);if(needsLong(f)&&opts.includes(LONGEST))opts=[LONGEST];
  if(!opts.length){f.rwy=null;f.noRwy=true;return false;}
  f.noRwy=false;const from=reroute?nearestNode(f.x,f.y).k:f.gate.lane;
  let best=null,bs=1e18,bp=null,bh=null;
  for(const r of opts){const q=flights.filter(o=>(o.state==='hp'||o.state==='taxi_out')&&o.rwy===r).length;for(const h of r.holds){const p=route(from,h);if(!p)continue;const c=pathLen(p)/14+q*75+(r.mode==='MIX'?60:0);if(c<bs){bs=c;best=r;bp=p;bh=h;}}}
  if(!best){f.rwy=null;f.noRwy=true;return false;}
  f.rwy=best;f.hold=bh;setPath(f,(reroute?[{x:f.x,y:f.y}]:[]).concat(bp),TAXI_R);f.state='taxi_out';return true;
}

/* ============ flight logic ============ */
// round each corner with an arc (a quadratic curve through the corner): taxi turns follow the centreline, approaches
// curve onto final instead of snapping at a waypoint
function smoothPath(p,R){if(!p||p.length<3||!R)return p;const out=[p[0]];
  for(let i=1;i<p.length-1;i++){const a=p[i-1],b=p[i],c=p[i+1];const l1=dist(a.x,a.y,b.x,b.y),l2=dist(b.x,b.y,c.x,c.y);if(l1<1||l2<1){out.push(b);continue;}
    const u1x=(b.x-a.x)/l1,u1y=(b.y-a.y)/l1,u2x=(c.x-b.x)/l2,u2y=(c.y-b.y)/l2;const turn=Math.acos(clamp(u1x*u2x+u1y*u2y,-1,1));if(turn<0.05){out.push(b);continue;}
    const t=Math.min(R*Math.tan(Math.min(turn,2.6)/2),l1*0.45,l2*0.45);const p1={x:b.x-u1x*t,y:b.y-u1y*t},p2={x:b.x+u2x*t,y:b.y+u2y*t};
    const n=Math.max(2,Math.ceil(turn/0.2));out.push(p1);for(let k=1;k<n;k++){const q=k/n;out.push({x:(1-q)*(1-q)*p1.x+2*(1-q)*q*b.x+q*q*p2.x,y:(1-q)*(1-q)*p1.y+2*(1-q)*q*b.y+q*q*p2.y});}out.push(p2);}
  out.push(p[p.length-1]);return out;}
const TAXI_R=0;   // taxi paths stay exact: cut corners trip blocked() at junctions and jam taxi flow; models still turn smoothly
function setPath(f,p,R){f.path=R?smoothPath(p,R):p;f.pd=0;f.plen=pathLen(f.path);}
function advance(f,dt,v,rev){f.pd=Math.min(f.plen,f.pd+v*dt);const p=pointAt(f.path,f.pd);f.x=p.x;f.y=p.y;const tg=rev?p.a+Math.PI:p.a;f.heading+=angDiff(f.heading,tg)*Math.min(1,dt*1.8);return f.pd>=f.plen-0.01;}
const MOVING=new Set(['rollout','taxi_in','taxi_out','hp','push','start','lineup','nogate','tow','stuck']);
let movingList=[];
function blocked(f){const hx=Math.cos(f.heading),hy=Math.sin(f.heading);const lim=Math.max(70,f.T.len*1.9);for(const o of movingList){if(o===f)continue;const dx=o.x-f.x,dy=o.y-f.y;if(Math.abs(dx)>lim||Math.abs(dy)>lim)continue;const d=Math.hypot(dx,dy);if(d>lim||d<1)continue;if((dx*hx+dy*hy)/d<0.9)continue;if(o.state!=='stuck'&&o.state!=='nogate'&&o.state!=='hp'&&Math.abs(angDiff(f.heading,o.heading))>1.3)continue;return true;}return false;}
function stackOf(f){return STACKS[Math.min(STACKS.length-1,DIRSTACK[f.dir]??1)];}
function spawnInbound(f){const st=stackOf(f);const a=Math.atan2(st.y-0,st.x-0);const sx=st.x+Math.cos(a)*9000+(SIMR()-0.5)*4000,sy=st.y+Math.sin(a)*9000+(SIMR()-0.5)*4000;f.x=sx;f.y=sy;f.alt=2400;setPath(f,[{x:sx,y:sy},{x:st.x,y:st.y}]);f.state='inbound';f.heading=Math.atan2(st.y-sy,st.x-sx);f.stack=st;}
function beginApproach(f,r,td){
  f.state='approach';f.rwy=r;f.apT0=T;f.td=td;const faf={x:r.x1+7000,y:r.y},tdp={x:r.x1-450,y:r.y};
  const mid={x:Math.max(f.x,faf.x)+1200,y:lerp(f.y,r.y,0.7)};
  setPath(f,[{x:f.x,y:f.y},mid,faf,tdp],1600);f.finalLen=7000;f.finalStart=f.plen-f.finalLen;f.startAlt=f.alt||1500;
  r.tdList.push(td);r.lastSchedTd=td;r.lastArrWake=f.T.wake;f.gaRoll=SIMR();
}
function breakOff(f,r){
  r.tdList=r.tdList.filter(t=>t!==f.td);const alts=RW.filter(o=>o!==r&&canArr(o));
  if(!alts.length){f.td=null;goAround(f,`runway ${r.short} changing to departures`);return;}
  alts.sort((a,b)=>Math.abs(a.y-f.y)-Math.abs(b.y-f.y));const o=alts[0],td=Math.max(T+D_APP*0.85,o.lastSchedTd+arrSep(o));
  f.startAlt=f.alt;beginApproach(f,o,td);radio('APP',`${cs(f)}, break off, sidestep to runway ${o.short}.`);
}
function goAround(f,why){const r=f.rwy;r.tdList=r.tdList.filter(t=>t!==f.td);f.state='goaround';f.td=null;const st=stackOf(f);setPath(f,[{x:f.x,y:f.y},{x:r.x0-1500,y:r.y},{x:r.x0-3000,y:r.y+(r.y<0?-3000:3000)},{x:st.x,y:st.y}],1400);S.goArounds++;radio('TWR',`${cs(f)}, go around, ${why}.`);}
function touchdown(f){
  const r=f.rwy;f.state='rollout';f.alt=0;f.v=68;
  if(f.medSince!=null){const w=(T-f.medSince)/60;if(w>8)hitSafety(4,`The medical on ${fl(f)} waited ${Math.round(w)} min to land.`);else logE(`${fl(f)} landed its medical after ${Math.round(w)} min.`);f.medSince=null;}r.occ=f;r.tdList=r.tdList.filter(t=>t!==f.td);r.ops++;S.moves++;S.arr++;moveLog.push(T);f.landT=T;if(T-f.origEta<=900)S.arrOnTime++;
  const need=f.T.code==='F'?2200:f.T.code==='E'?1900:1300;const tx=r.x1-450;let ex=r.exits.find(e=>tx-e.x>=need)||r.exits[r.exits.length-1];
  const to=G.get(ex.to);setPath(f,[{x:tx,y:r.y},{x:ex.x,y:r.y},{x:to.x,y:to.y}],120);f.exitAt=tx-ex.x+40;f.exitNode=ex.to;
  const now=performance.now()/1000;for(let i=0;i<6;i++)puffs.push({x:tx-i*6,y:r.y+(i%2?-7:7),t:now+i*0.05});
}
function startTaxiIn(f){
  if(!f.res&&!f.gate){const g=freeGate(f);if(g){g.res=f;f.res=g;}}
  if(f.res){const p=route(f.exitNode,f.res.lane);if(p){setPath(f,[{x:f.x,y:f.y}].concat(p),TAXI_R);f.state='taxi_in';return;}}
  f.state='nogate';f.nogateSince=T;if(!incidents.some(i=>i.f===f))spawnInc('nogate',f);
}
function depart(f){const late=(f.rollT-f.std)/60;S.moves++;S.dep++;moveLog.push(f.rollT);if(late<=25){S.depOnTime++;S.combo=(S.combo||0)+1;S.bestCombo=Math.max(S.bestCombo||0,S.combo);if(S.combo>=3)comboPop();}else{if((S.combo||0)>=5)logE(`On-time run of ${S.combo} departures ended by ${fl(f)}.`);S.combo=0;comboPop();}S.delaySum+=Math.max(0,late-10);floater(f.x,f.y,f.alt,'+1','#2fd3c6');}
// juice: floating +1s, the on-time combo, a soft sound tick (WebAudio, mutable; off by default on touch screens)
const FLOATS=[];function floater(x,y,alt,txt,col){if(FLOATS.length<40)FLOATS.push({x,y,alt:alt||0,txt,col,t0:performance.now()/1000});}
function drawFloats(projector){const now=performance.now()/1000;ctx.font='700 15px Barlow Condensed, sans-serif';ctx.textAlign='center';
  for(let i=FLOATS.length-1;i>=0;i--){const q=FLOATS[i],a=now-q.t0;if(a>1.4){FLOATS.splice(i,1);continue;}const p=projector(q);if(!p)continue;ctx.globalAlpha=clamp(1.4-a,0,1);ctx.fillStyle='rgba(8,11,13,.7)';ctx.fillText(q.txt,p.X+1,p.Y-a*34+1);ctx.fillStyle=q.col;ctx.fillText(q.txt,p.X,p.Y-a*34);}ctx.globalAlpha=1;ctx.textAlign='left';}
const SND={on:store.get('zm_snd')!=null?store.get('zm_snd'):!matchMedia('(pointer:coarse)').matches,ctx:null};
function tickSound(up){if(!SND.on)return;try{if(!SND.ctx)SND.ctx=new (window.AudioContext||window.webkitAudioContext)();const c=SND.ctx;if(c.state==='suspended')c.resume();const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=up?660+Math.min(12,S.combo||0)*28:220;g.gain.setValueAtTime(0.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(0.06,c.currentTime+0.01);g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+0.18);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+0.2);}catch(e){}}
function comboPop(){const el=$('#combo');if(!el)return;const n=S.combo||0;el.hidden=n<3;if(n>=3){el.innerHTML=`<b>${n}×</b> on time`;el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');tickSound(true);}else tickSound(false);}
function climbOut(f){
  f.state='climb';const side=f.y<0?-1:1,H={N:-Math.PI/2,S:Math.PI/2,E:0,W:Math.PI}[f.dir];const h=H==null?Math.PI:H;
  const p0={x:f.x,y:f.y},p1={x:f.x-2600,y:f.y};let p2,p3;
  if(h===0){p2={x:p1.x-1800,y:p1.y+side*5200};p3={x:p2.x+16000,y:p2.y+side*1500};}
  else{p2={x:p1.x+Math.cos(h)*3000-(h===Math.PI?3000:0),y:p1.y+Math.sin(h)*3000};p3={x:p2.x+Math.cos(h)*14000,y:p2.y+Math.sin(h)*14000};}
  setPath(f,[p0,p1,p2,p3],3200);
}
function settleLinks(f){if(!f.links)return;for(const l of f.links){const ok=l.arr.inBlock!=null&&l.arr.inBlock+l.x+(l.arr.gate&&l.arr.gate.remote?300:0)<=f.pushT+(f.heldFor||0);if(ok)S.cnxMade+=l.n;else S.cnxMiss+=l.n;}f.links=null;}
function laneClear(g){const L=G.get(g.lane);for(const o of movingList){if(o.gate===g)continue;if(Math.abs(o.x-L.x)<130&&Math.abs(o.y-L.y)<130)return false;}return true;}
function updateFlight(f,dt){
  switch(f.state){
  case 'sched':if(T>=f.spawnT)spawnInbound(f);break;
  case 'inbound':advance(f,dt,150);f.endurance-=dt/60;f.alt=Math.max(1800,f.alt-dt*2);if(f.pd>=f.plen){f.state='holding';f.holdSince=T;f.hu=SIMR()*6000;}fuelCheck(f);break;
  case 'holding':{f.hu+=72*dt;const st=f.stack;const mates=flights.filter(o=>o.state==='holding'&&o.stack===st);f.level=Math.max(0,mates.sort((a,b)=>rk(a)-rk(b)).indexOf(f));const p=stackPos(st,f.hu,f.level);f.x=p.x;f.y=p.y;f.heading+=angDiff(f.heading,p.a)*Math.min(1,dt*2);f.alt=2100+f.level*300;f.endurance-=dt/60;S.holdMin+=dt/60;fuelCheck(f);break;}
  case 'approach':{const fr=clamp((T-f.apT0)/(f.td-f.apT0),0,1);f.pd=fr*f.plen;const p=pointAt(f.path,f.pd);f.x=p.x;f.y=p.y;f.heading+=angDiff(f.heading,p.a)*Math.min(1,dt*1.5);
    if(f.pd>=f.finalStart){const k=(f.pd-f.finalStart)/f.finalLen;f.alt=Math.max(0,700*(1-k/0.96));}else f.alt=lerp(f.startAlt,700,clamp(f.pd/Math.max(1,f.finalStart),0,1));
    if(dustNow&&f.td-T<20&&f.td-T>10&&f.gaRoll<(f.rwy.shear?0.3:0.07)&&!f.gaDone){f.gaDone=true;goAround(f,'windshear in the dust');break;}
    if(f.birdHit&&f.td-T<20&&!f.gaDone){f.gaDone=true;goAround(f,'bird strike on short final');break;}
    if(f.rwy.kiteUntil>T&&f.td-T<20&&f.td-T>10&&f.gaRoll<0.25&&!f.gaDone&&!f.vip){f.gaDone=true;goAround(f,'kite on short final. Yes, a kite');break;}
    if(T>=f.td)touchdown(f);break;}
  case 'rollout':{f.v=Math.max(14,f.v-1.15*dt);const done=advance(f,dt,f.v);if(f.rwy.occ===f&&f.pd>=f.exitAt){f.rwy.occ=null;f.rwy.arrExit=T;floater(f.x,f.y,0,'+1','#a99cff');}if(done){if(f.rwy.occ===f){f.rwy.occ=null;f.rwy.arrExit=T;}startTaxiIn(f);}break;}
  case 'nogate':{if(!f.res){const g=freeGate(f);if(g){g.res=f;f.res=g;}}if(f.res){const p=route(f.exitNode,f.res.lane);if(p){setPath(f,[{x:f.x,y:f.y}].concat(p),TAXI_R);f.state='taxi_in';closeIncFor(f,true);}}break;}
  case 'taxi_in':if(blocked(f))break;if(advance(f,dt,14)){const g=f.res;setPath(f,[{x:G.get(g.lane).x,y:G.get(g.lane).y},{x:g.x,y:g.y}]);f.state='dock';}break;
  case 'dock':if(laneShut(f.res))break;if(advance(f,dt,4)){const g=f.res;g.occ=f;g.res=null;f.gate=g;f.res=null;f.heading=g.a;f.inBlock=T;if(f.turn)toDep(f);else{f.state='parked';f.towAt=T+(20+SIMR()*15)*60;}}break;
  case 'parked':if(f.vip)break;if(T>=f.towAt&&laneClear(f.gate)){const g=f.gate;const p=route(g.lane,PARK);g.occ=null;f.state='tow';setPath(f,[{x:g.x,y:g.y}].concat(p||[]),TAXI_R);f.gate=null;}break;
  case 'tow':if(blocked(f))break;if(advance(f,dt,f.pd<90?3:7,f.pd<90))f.state='towed';break;
  case 'at_gate':{
    if(f.std<=T&&f.links&&!f.cnxAsked&&!f.held){const late=f.links.filter(l=>l.arr.inBlock==null&&l.arr.state!=='diverted').reduce((s,l)=>s+l.n,0);if(late>=40&&T-lastCnx>400&&!incidents.some(i=>i.type==='connex')){f.cnxAsked=true;spawnInc('connex',f,{n:late});}}
    const go=Math.max(f.std,f.readyAt);
    if(T>=go&&!f.held&&T>=FX.pushFreeze&&laneClear(f.gate)&&!laneShut(f.gate)){const pc=CONCI[f.gate.conc];f.pushExtra=(pc&&pc.slowUntil>T?180:0)+(T<FX.pushSlow?FX.pushSlowS:0);f.pushT=T;settleLinks(f);f.state='push';const g=f.gate;setPath(f,[{x:g.x,y:g.y},{x:G.get(g.lane).x,y:G.get(g.lane).y}]);g.occ=null;f.lastGate=g;f.gate=null;f.gateRef=g;}
    break;}
  case 'push':if(advance(f,dt,3.5,true)){f.state='start';f.startT=T;}break;
  case 'start':if(T>=f.startT+45+(f.pushExtra||0)){f.gate={lane:f.gateRef.lane};const ok=assignDep(f,false);f.gate=null;if(!ok){f.state='start';f.startT=T-35;f.noRwy=true;}}break;
  case 'taxi_out':if(f.noRwy||!f.rwy){if(T<(f.retryAt||0))break;f.retryAt=T+10;if(!assignDep(f,true))break;}if(blocked(f))break;if(advance(f,dt,14)){f.state='hp';f.hpSince=T;if(needsLong(f)&&f.rwy!==LONGEST&&!f.heatAsked){f.heatAsked=true;}}break;
  case 'hp':if(!f.rwy||!depModeOk(f.rwy)){if(T>=(f.retryAt||0)){f.retryAt=T+10;assignDep(f,true);}break;}if(needsLong(f)&&f.rwy!==LONGEST&&!f.heavyInc)spawnInc('heavy',f);break;
  case 'lineup':if(advance(f,dt,8)){f.state='roll';f.v=8;f.s=60;}break;
  case 'roll':{const r=f.rwy;f.v=Math.min(95,f.v+(heatNow&&f.T.hot?1.7:2.3)*dt);f.s+=f.v*dt;f.x=r.x1-f.s;f.y=r.y;f.heading+=angDiff(f.heading,Math.PI)*Math.min(1,dt*3);const lift=f.T.code==='C'?1500:heatNow?3000:2300;
    if(f.burst&&f.v>40){f.burst=false;f.rto=true;f.rtoBurst=true;radio('TWR',`${cs(f)} rejecting take-off! Tyre burst on ${r.short}.`);}
    if(f.rto){f.v=Math.max(0,f.v-5*dt);if(f.v<=6){f.rto=false;f.state='taxi_out';r.occ=null;if(f.rtoBurst){f.rtoBurst=false;r.closedUntil=T+900;r.why='Burst tyre: debris clean-up';hitSafety(8,`${fl(f)} burst a tyre on bird debris on ${r.short}.`);}else{r.closedUntil=T+360;r.why='Runway inspection after a rejected take-off';}f.rollT=null;assignDep(f,true);renderRw();}break;}
    if(f.s>lift)f.alt+=f.v*0.14*dt;if(r.occ===f&&(f.alt>60))r.occ=null;if(f.alt>60&&!f.counted){f.counted=true;r.ops++;depart(f);climbOut(f);}break;}
  case 'climb':f.v=Math.min(150,f.v+1.1*dt);f.alt=Math.min(3000,f.alt+f.v*0.13*dt);if(advance(f,dt,f.v))f.state='gone';break;
  case 'goaround':advance(f,dt,100);f.alt=Math.min(1200,f.alt+12*dt);f.endurance-=dt/60;if(f.pd>=f.plen){f.state='holding';f.holdSince=T-40;f.hu=0;}break;
  case 'divert':advance(f,dt,170);f.alt=Math.min(3500,f.alt+15*dt);if(f.pd>=f.plen)f.state='diverted';break;
  case 'stuck':if(T>=f.stuckUntil){f.state=f.stuckPrev;}break;
  }
  if(f.alt>30&&['approach','roll','climb','goaround','inbound','divert'].includes(f.state)){const tr=f.trail;if(!tr.length||Math.hypot(tr[tr.length-1].x-f.x,tr[tr.length-1].y-f.y)>160){tr.push({x:f.x,y:f.y});if(tr.length>20)tr.shift();}}
}
function fuelCheck(f){
  if(!f.minFuel&&f.endurance<14){f.minFuel=true;radio(f.al,`${cs(f)}, minimum fuel.`);if(!f.prio)spawnInc('fuel',f);}
  if(!f.mayday&&f.endurance<6){f.mayday=true;f.prio=true;radio(f.al,`MAYDAY MAYDAY MAYDAY, ${cs(f)}, fuel.`);hitSafety(5,`${fl(f)} declared MAYDAY fuel after holding.`);
    const I=incidents.find(i=>i.type==='fuel'&&i.fs.includes(f));if(I){I.fs=I.fs.filter(g=>g!==f);S.incDef++;if(!I.fs.length)drop(I);else{I.title=I.fs.length>1?`${I.fs.length} aircraft on minimum fuel`:`${fl(I.fs[0])} is on minimum fuel`;renderInc();}}
    coach(`MAYDAY: ${fl(f)}`,`<p>It held so long that it is now an emergency. It lands next, ahead of everyone, and safety drops 5.</p><p>A smaller stack prevents this: give arrivals more runways before the wave peaks, not during it.</p>`,true);}
  if(f.endurance<2.5&&['holding','inbound','goaround'].includes(f.state)){hitSafety(6,`${fl(f)} had to divert with almost no fuel left.`);divert(f,'fuel');}
}
function divert(f,why){if(f.td&&f.rwy)f.rwy.tdList=f.rwy.tdList.filter(t=>t!==f.td);if(f.res){f.res.res=null;f.res=null;}f.state='divert';setPath(f,[{x:f.x,y:f.y},{x:f.x+12000,y:f.y<0?-9000:9000}]);S.div++;logE(`${fl(f)} diverted (${why}).`,'miss');radio('APP',`${cs(f)} diverting.`);closeIncFor(f,false);}
function hitSafety(v,msg){S.safety=clamp(S.safety-v,0,100);if(msg){logE(msg,'miss');S.hits.push({t:clk(T),v,msg});}}
function stackPos(st,u,level){const R=560+level*40,h=1100;const P=4*h+2*Math.PI*R;u=((u%P)+P)%P;const cx=st.x,cy=st.y;
  if(u<2*h)return{x:cx+R,y:cy-h+u,a:Math.PI/2};u-=2*h;const arc=Math.PI*R;if(u<arc){const t=u/R;return{x:cx+R*Math.cos(t),y:cy+h+R*Math.sin(t),a:t+Math.PI/2};}u-=arc;if(u<2*h)return{x:cx-R,y:cy+h-u,a:-Math.PI/2};u-=2*h;const t=Math.PI+u/R;return{x:cx+R*Math.cos(t),y:cy-h+R*Math.sin(t),a:t+Math.PI/2};}

/* ============ ops teams: routine airside work happens without you ============ */
// A real duty manager doesn't dispatch every bird patrol or sweeper: the wildlife unit and airside ops get on with it.
// You see their vehicles on the map and a line on the radio. Nothing to click, and they work around the traffic.
const ops=[];let OPN=0,opsClock=0;const OPSW=75;
function pickRunway(){const rs=RW.filter(r=>!r.locked&&r.mode!=='OFF'&&T>=r.closedUntil);return rs.length?rs[Math.floor(SIMR()*rs.length)]:null;}
function opsSpawn(kind,target){
  if(kind==='tug'){const f=target||flights.filter(o=>o.state==='taxi_out'&&o.pd>400&&o.plen-o.pd>800).sort(()=>SIMR()-0.5)[0];if(!f)return false;
    f.stuckPrev='taxi_out';f.state='stuck';f.stuckUntil=T+210;const a=f.heading;ops.push({id:++OPN,kind,f,t0:T,dur:210,sx:f.x-Math.cos(a)*700,sy:f.y-Math.sin(a)*700});
    radio('RAMP',`${cs(f)} stopped with a hydraulic warning. Tug on the way, about 3 minutes.`);logE(`${fl(f)} broke down on the taxiway; the ramp team towed it clear.`);explainOnce('ops');return true;}
  const r=target||pickRunway();if(!r)return false;
  if(kind==='birds'){const side=r.y<0?-1:1,x=lerp(r.x0,r.x1,0.2+SIMR()*0.7);ops.push({id:++OPN,kind,r,x,y:r.y+side*170,t0:T,dur:180,sx:Math.min(r.x1+300,x+900)});
    if(ops.filter(o=>o.kind==='birds').length===1)radio('WILDLIFE',`Kites over the grass by ${r.short}. Patrol on the way. No effect on the runway.`);explainOnce('ops');return true;}
  if(kind==='fod'){if(ops.some(o=>o.kind==='fod'&&o.r===r))return false;ops.push({id:++OPN,kind,r,x:lerp(r.x0,r.x1,0.3+SIMR()*0.5),t0:T,phase:'wait'});
    radio('OPS',`Debris reported on ${r.short}. The sweeper goes at the next gap in traffic.`);explainOnce('ops');return true;}
  return false;
}
function opsTick(dt){
  for(let i=ops.length-1;i>=0;i--){const o=ops[i];
    if(o.kind!=='fod'){if(T>=o.t0+o.dur)ops.splice(i,1);continue;}
    const r=o.r;if(r.locked){r.gapReq=false;ops.splice(i,1);continue;}
    if(o.phase==='wait'){
      const quiet=r.mode==='OFF'||T<r.changeUntil||T<r.closedUntil;
      const busy=r.occ||r.tdList.some(td=>td>T-5&&td<T+OPSW+30)||flights.some(f=>f.rwy===r&&(f.state==='lineup'||(f.state==='roll'&&f.alt<60)));
      if(quiet||!busy){o.phase='sweep';o.ts=T;o.free=quiet;r.gapReq=false;if(T+OPSW>r.closedUntil){r.closedUntil=T+OPSW;r.why='Runway sweep';}renderRw();
        radio('OPS',quiet?`Sweeping ${r.short} while it is out of use. No time lost.`:`Sweeping ${r.short} in a gap. Back in ${OPSW} seconds.`);}
      else if(T-o.t0>300&&!r.gapReq){r.gapReq=true;radio('TWR',`Making a gap on ${r.short} for the sweeper.`);}
    }else if(T>=o.ts+OPSW){logE(`Runway ${r.short} swept${o.free?' while out of use':' in a gap'}.`);ops.splice(i,1);}
  }
  opsClock+=dt;if(opsClock>=60){opsClock=0;if(SIMR()<0.03)opsSpawn('birds');}
  for(const s of LV.ops||[])if(!s.done&&T>=s[0]){if(opsSpawn(s[1]))s.done=true;else if((s.tries=(s.tries||0)+1)>15)s.done=true;else s[0]=T+60;}
}

/* ============ decisions: the few calls that need the duty manager ============ */
// What reaches you is either a consequence of your runway plan (a stack that grew too big, a heavy jet sent to a
// short runway in the heat) or a real two-sided call. Each card says what ops does if you leave it, so ignoring a
// card is allowed; it just isn't always the best call.
const ICON={medical:{g:'+',c:'#ff4d3f'},fuel:{g:'F',c:'#ffae3b'},heavy:{g:'H',c:'#ff7a3f'},nogate:{g:'G',c:'#6aa3ff'},connex:{g:'C',c:'#b48cff'},strike:{g:'B',c:'#ff7a3f'},vvip:{g:'V',c:'#f4c430'},summitOrder:{g:'V',c:'#ff9933'},lights:{g:'L',c:'#ffae3b'},lane:{g:'T',c:'#ffae3b'},shear:{g:'W',c:'#ff7a3f'}};
const CFG=Object.assign({inc:'std'},store.get('zm_cfg')||{});
const SCRIPTED=new Set(['medical','strike','vvip','lights','lane','shear','summit']);
const STORY={};const MAXOPEN=3;let lastCnx=-1e9;
function estWait(f){const cap=Math.max(1,capNow('arr'));const ahead=flights.filter(o=>o!==f&&(o.state==='approach'||((o.state==='holding'||o.state==='inbound')&&rk(o)<rk(f)))).length;return Math.max(3,Math.round(Math.max((f.eta-T)/60,ahead/cap*60)+2));}
function priorityLand(f){
  const rs=RW.filter(r=>canArr(r)&&!r.blocks.some(b=>T+D_APP>=b.from-30&&T+D_APP<b.to));if(!rs.length){f.prio=true;return '';}
  rs.sort((a,b)=>Math.abs(a.y-f.y)-Math.abs(b.y-f.y));const r=rs[0],td=T+D_APP,sep=arrSep(r),prev=r.lastSchedTd;let bumped=[];
  for(const o of flights)if(o.state==='approach'&&o.rwy===r&&Math.abs(o.td-td)<sep&&o.td-T>25){goAround(o,'priority traffic');bumped.push(fl(o));}
  if(!f.res&&!f.gate){const g=freeGate(f);if(g){g.res=f;f.res=g;}}
  beginApproach(f,r,td);r.lastSchedTd=Math.max(prev,td);f.prio=true;
  return bumped.length?`${bumped.join(' and ')} went around to make room.`:'No one had to go around.';
}
function sendLong(f){f.rwy=LONGEST;let best=null,bl=1e18,bp=null;for(const h of LONGEST.holds){const p=route(nearestNode(f.x,f.y).k,h);if(p&&pathLen(p)<bl){bl=pathLen(p);best=h;bp=p;}}if(bp){setPath(f,[{x:f.x,y:f.y}].concat(bp),TAXI_R);f.state='taxi_out';f.hold=best;}}
function spawnInc(type,target,extra){
  if(CFG.inc==='off'&&(SCRIPTED.has(type)||type.startsWith('st_')))return true; // runways-only mode: the scripted calls never happen
  if(type.startsWith('st_'))return startStory(type.slice(3));
  if(incidents.length>=MAXOPEN&&SCRIPTED.has(type))return false;
  if(['fuel','heavy','nogate','connex'].includes(type)&&!target)return false;
  const I={id:++INC,type,born:T,left:0,total:40,def:null,defText:''};let ok=true;
  switch(type){
  case 'summit':{if(SUM||!startSummit()){ok=false;break;}return true;}
  case 'medical':{const f=target||flights.filter(o=>['inbound','holding'].includes(o.state)&&!o.prio&&!incidents.some(i=>i.f===o)).sort((a,b)=>a.eta-b.eta)[0];if(!f){ok=false;break;}const w=estWait(f);
    Object.assign(I,{f,title:`Medical emergency on ${fl(f)}`,text:`A passenger in cardiac distress on the ${f.A.name} from ${f.from}. Priority sends it straight to the nearest runway; anyone it cuts in front of goes around. In sequence it lands in about ${w} min.`,def:1,defText:`it lands in sequence, about ${w} min. A wait over 8 min costs safety.`,
      acts:[{l:'Priority landing',pri:1,fn(){const m=priorityLand(f);resolve(I,true,`${fl(f)} cleared straight in for the medical. ${m}`);}},{l:'Land in sequence',fn(){f.medSince=I.born;resolve(I,true,`${fl(f)} lands in sequence with its medical.`);}}]});explain('stack');break;}
  case 'fuel':{const f=target;const I0=incidents.find(i=>i.type==='fuel');if(I0){if(!I0.fs.includes(f)){I0.fs.push(f);I0.title=`${I0.fs.length} aircraft on minimum fuel`;renderInc();}return true;}
    Object.assign(I,{f,fs:[f],simFuse:true,offPick:0,title:`${fl(f)} is on minimum fuel`,text:`Holding has left it with no spare fuel: it can't accept more delay. Land it next, or divert to Nagpur's old airport and its passengers miss their connections. A long stack causes this; more arrival runways fix it.`,def:null,defText:'it declares MAYDAY when the fuel runs low. Safety −5 each.',
      acts:[{l:'Land next',pri:1,fn(){for(const g of I.fs)g.prio=true;resolve(I,true,`${I.fs.map(fl).join(', ')} prioritised on minimum fuel.`);}},{l:'Divert to NAG',fn(){for(const g of I.fs.slice())divert(g,'your call');resolve(I,true,`${I.fs.length} aircraft sent to Nagpur's old airport.`);}}]});I.total=Math.max(4,(f.endurance-6)*60/BASE);explain('fuel');break;}
  case 'heavy':{const f=target;const I0=incidents.find(i=>i.type==='heavy');if(I0){if(!I0.fs.includes(f)){I0.fs.push(f);f.heavyInc=I0;I0.title=`${I0.fs.length} heavy jets can't take off here`;renderInc();}return true;}f.heavyInc=I;
    Object.assign(I,{f,fs:[f],title:`${fl(f)} can't take off here`,text:`At ${LV.n===3?'46':'40'} °C a ${f.T.name} needs the long runway, ${LONGEST.short}, to get airborne. Send it there (${LONGEST.short} must be on DEP or MIX), or offload 40 passengers to cut weight and go from here.`,def:1,defText:'ops offloads 40 passengers from each jet; they miss their flight.',
      acts:[{l:`Taxi to ${LONGEST.short}`,pri:1,dis:()=>!depModeOk(LONGEST),fn(){for(const g of I.fs)if(g.state==='hp'||g.state==='taxi_out')sendLong(g);resolve(I,true,`Heavy jets sent to the long runway.`);}},{l:'Offload and go',fn(){for(const g of I.fs){g.offloaded=true;S.cnxMiss+=40;}resolve(I,true,`${I.fs.length*40} passengers offloaded so heavy jets could leave from a short runway.`);}}]});explain('heat');break;}
  case 'nogate':{const f=target;const swing=()=>GATES.filter(g=>!g.remote&&g.open&&!g.occ&&!g.res&&!marsBusy(g)&&CR[g.code]>=CR[f.T.code]).sort((a,b)=>dist(a.x,a.y,f.x,f.y)-dist(b.x,b.y,f.x,f.y))[0];
    Object.assign(I,{f,title:`${fl(f)} has no stand`,text:`Every stand that fits, contact and remote, is taken. It is waiting on the taxiway and blocking traffic behind it. Swing a gate from the other zone, or let it wait for the next free stand.`,def:1,defText:'it waits on the taxiway until a stand frees up.',
      acts:[{l:'Swing a gate',pri:1,dis:()=>!swing(),fn(){const g=swing();if(g){g.zone='swing';g.res=f;f.res=g;resolve(I,true,`Gate ${g.id} swung for ${fl(f)}.`);}}},{l:'Wait',fn(){resolve(I,true,'');}}]});explain('gate');break;}
  case 'connex':{const f=target;const n=extra.n;lastCnx=T;Object.assign(I,{f,title:`Hold ${fl(f)} for ${n} connecting passengers?`,text:`Their inbound flight hasn't reached the gate. Holding up to 10 minutes saves the connections but makes ${fl(f)} late.`,def:1,defText:`${fl(f)} leaves on time and ${n} passengers miss it.`,
      acts:[{l:'Hold 10 min',pri:1,fn(){f.held=true;f.holdUntil=T+600;f.heldFor=0;resolve(I,true,`${fl(f)} held for connections.`);}},{l:'Go now',fn(){resolve(I,true,'');}}]});explain('cnx');break;}
  case 'strike':{const r=target||RW.filter(r=>canDep(r)).sort((a,b)=>b.ops-a.ops)[0];if(!r){ok=false;break;}const v=flights.filter(o=>o.rwy===r&&(o.state==='roll'||o.state==='gone')&&o.rollT!=null).sort((a,b)=>b.rollT-a.rollT)[0];const who=v?`${fl(v)}, a ${v.T.name},`:'A departing jet';
    Object.assign(I,{r,x:lerp(r.x0,r.x1,0.55),y:r.y,title:`Bird strike on ${r.short}`,text:`${who} hit a black kite rotating off ${r.short} and is flying on. Remains may be on the runway. Inspect now and ${r.short} shuts for 4 minutes. Keep going and there is about a 1 in 3 chance a tyre bursts on debris: a 15-minute closure. A runway changeover also counts as an inspection.`,def:0,defText:`ops shuts ${r.short} for a 4-minute inspection.`,
      acts:[{l:'Inspect now (4 min)',pri:1,fn(){closeRw(r,240,'Bird strike inspection');resolve(I,true,`${r.short} inspected after a bird strike.`);}},{l:'Keep going',fn(){r.strike={until:T+600,bad:SIMR()<0.33};resolve(I,true,`${r.short} kept running after a bird strike.`);}}]});explain('birds');break;}
  case 'vvip':{const load=r=>flights.filter(o=>o.rwy===r&&['approach','hp','taxi_out'].includes(o.state)).length;const rs=RW.filter(r=>!r.locked&&r.mode!=='OFF').sort((a,b)=>load(a)-load(b));if(rs.length<2){ok=false;break;}const di=Math.max(0,rs.indexOf(LONGEST));
    const give=r=>{const from=T+180;r.blocks.push({from,to:from+360,why:'VVIP movement'});radio('AOCC',`VVIP movement on ${r.short} at ${clk(from)}. Runway closed for 6 minutes.`);renderRw();};
    Object.assign(I,{x:LONGEST.x0+LONGEST.len*0.5,y:LONGEST.y,title:'VVIP movement: pick a runway',text:`Protocol needs one runway to itself for 6 minutes, starting 3 minutes after you choose: no landings, no take-offs. Pick the one that hurts least. The busy count is aircraft on final, taxiing or queued for it.`,def:di,defText:`protocol takes the long runway, ${LONGEST.short}.`,
      acts:rs.map((r,i)=>({l:`${r.short} · ${r.mode} · ${load(r)} busy`,pri:i===0,fn(){give(r);resolve(I,true,`VVIP movement given runway ${r.short}.`);}}))});explain('vvip');break;}
  case 'lights':{const r=target||RW.filter(r=>canArr(r)).sort((a,b)=>b.tdList.length-a.tdList.length)[0];if(!r){ok=false;break;}
    Object.assign(I,{r,x:lerp(r.x0,r.x1,0.4),y:r.y,title:`Edge lights failed on ${r.short}`,text:`Half of ${r.short}'s edge lights have failed, and in this haze ATC needs them. Repair now and it closes for 6 minutes. Or keep it open with 60% more spacing between landings; the electricians then fix it during the runway's next changeover.`,def:1,defText:`${r.short} stays open at a reduced landing rate until its next changeover.`,
      acts:[{l:'Repair now (6 min)',pri:1,fn(){closeRw(r,360,'Lighting repair');resolve(I,true,`Edge lights on ${r.short} repaired.`);}},{l:'Keep open, slower',fn(){r.degraded=true;renderRw();resolve(I,true,`${r.short} kept landing with its edge lights out.`);}}]});explain('lights');break;}
  case 'lane':{const due=c=>flights.filter(o=>o.state==='at_gate'&&o.gate&&o.gate.conc===c.id&&o.std<T+1500).length;const c=target||CONC.filter(c=>c.open!==false).sort((a,b)=>due(b)-due(a))[0];if(!c){ok=false;break;}const n=due(c);
    Object.assign(I,{c,x:c.lx,y:c.ly,title:`Dead tug blocks ${c.name}`,text:`A pushback tug broke down in the apron lane of ${c.name}, with ${n} departures due there soon. Clear it now and nothing moves on that pier for 4 minutes. Or work around it: crews push by hand from the lane edge, adding 3 minutes to every pushback there for 15 minutes.`,def:1,defText:'crews work around it: +3 min on every pushback from that pier for 15 min.',
      acts:[{l:'Clear it now (4 min)',pri:1,fn(){c.laneShut=T+240;resolve(I,true,`Dead tug cleared from ${c.name}.`);}},{l:'Work around it',fn(){c.slowUntil=T+900;resolve(I,true,`Pushbacks at ${c.name} slowed around a dead tug.`);}}]});break;}
  case 'shear':{if(!dustNow){ok=false;break;}const r=target||RW.filter(r=>canArr(r)).sort((a,b)=>b.tdList.length-a.tdList.length)[0];if(!r){ok=false;break;}let n=0;
    for(const o of flights.filter(o=>o.state==='approach'&&o.rwy===r&&o.td-T>25).sort((a,b)=>a.td-b.td)){if(n>=2)break;goAround(o,'windshear on short final');n++;}
    Object.assign(I,{r,x:r.x1-400,y:r.y,title:`Windshear on ${r.short}${n?`: ${n} go-around${n>1?'s':''}`:''}`,text:`The dust storm's gust front is sitting on the approach to ${r.short}. Stop landing there for the storm (set it to DEP and the other runways take its arrivals), or keep landing and expect more go-arounds.`,def:0,defText:`${r.short} keeps landing and go-arounds there get much more likely.`,
      acts:[{l:'Keep landing',pri:1,fn(){r.shear=true;resolve(I,true,`${r.short} kept landing through windshear.`);}},{l:`${r.short} to DEP`,fn(){setMode(r,'DEP');resolve(I,true,`${r.short} switched to departures for the storm.`);}}]});explain('shear');break;}
  }
  if(!ok)return false;
  S.incTypes[type]=(S.incTypes[type]||0)+1;
  if(CFG.inc==='off'){const a=I.acts[I.offPick!=null?I.offPick:I.def];if(a&&!(a.dis&&a.dis()))a.fn(true);return true;}
  I.left=I.total;incidents.push(I);renderInc();radio('AOCC',I.title+'.');return true;
}
function closeRw(r,secs,why){r.closedUntil=Math.max(r.closedUntil,T+secs);r.why=why;for(const f of flights){if(f.state==='approach'&&f.rwy===r&&f.td-T>25&&f.td<r.closedUntil+20)goAround(f,why.toLowerCase());}renderRw();}
function resolve(I,ok,msg){const k=incidents.indexOf(I);if(k<0)return;incidents.splice(k,1);if(ok){S.incOk++;if(msg)logE(msg);}renderInc();if(popInc===I)closePop();}
function drop(I){const k=incidents.indexOf(I);if(k<0)return;incidents.splice(k,1);renderInc();if(popInc===I)closePop();}
function closeIncFor(f){for(const I of incidents.slice())if(I.f===f)drop(I);}
function expire(I){const k=incidents.indexOf(I);if(k<0)return;incidents.splice(k,1);S.incDef++;const a=I.def!=null?I.acts[I.def]:null;if(a&&!(a.dis&&a.dis()))a.fn(true);logE(`Left to ops: ${I.defText}`);renderInc();if(popInc===I)closePop();}
function incPos(I){if(I.f)return{x:I.f.x,y:I.f.y};return{x:I.x,y:I.y};}
function incTick(dt){for(const I of incidents.slice()){if(I.f&&['gone','diverted','towed'].includes(I.f.state)){drop(I);continue;}if(I.type==='medical'&&I.f.landT!=null){drop(I);continue;}if(I.simFuse)continue;I.left-=dt;if(I.left<=0)expire(I);}}
function incSpawner(dt){for(const s of LV.script)if(!s.done&&T>=s[0]){if(spawnInc(s[1]))s.done=true;else if((s.tries=(s.tries||0)+1)>12)s.done=true;else s[0]=T+60;}}
// ============ summit day: protocol shuts the whole airport ============
// Real airports close to all other traffic for heads of government. No warning, no choice: that's protocol. The jokes
// are about protocol and logistics, never the leaders. Three VIP landings, each with a cinematic cut and a flag banner.
let SUM=null;
const FLAG_IN='<svg viewBox="0 0 90 60" class="flag"><rect width="90" height="20" fill="#FF9933"/><rect y="20" width="90" height="20" fill="#fff"/><rect y="40" width="90" height="20" fill="#138808"/><circle cx="45" cy="30" r="8.4" fill="none" stroke="#000080" stroke-width="1.4"/>'+Array.from({length:24},(_,k)=>{const a=k*Math.PI/12;return `<line x1="45" y1="30" x2="${(45+8.2*Math.cos(a)).toFixed(2)}" y2="${(30+8.2*Math.sin(a)).toFixed(2)}" stroke="#000080" stroke-width=".6"/>`;}).join('')+'<circle cx="45" cy="30" r="1.6" fill="#000080"/></svg>';
const FLAG_RU='<svg viewBox="0 0 90 60" class="flag"><rect width="90" height="20" fill="#fff"/><rect y="20" width="90" height="20" fill="#0039A6"/><rect y="40" width="90" height="20" fill="#D52B1E"/></svg>';
(function(){const st=document.createElement('style');st.textContent=`#vipBanner{position:absolute;left:50%;top:150px;transform:translate(-50%,-30px);z-index:12;opacity:0;pointer-events:none;transition:opacity .45s,transform .45s;
  background:linear-gradient(180deg,rgba(10,13,16,.94),rgba(10,13,16,.86));border:1px solid #f4c430;border-radius:8px;padding:10px 18px 12px;text-align:center;min-width:420px;box-shadow:0 18px 50px rgba(0,0,0,.6)}
#vipBanner.on{opacity:1;transform:translate(-50%,0)}#vipBanner .flags{display:flex;gap:14px;justify-content:center;margin-bottom:6px}
#vipBanner .flag{width:66px;height:44px;border-radius:2px;box-shadow:0 2px 8px rgba(0,0,0,.5);animation:wave 1.6s ease-in-out infinite;transform-origin:left center}
#vipBanner .flag:nth-child(2){animation-delay:.4s}@keyframes wave{0%,100%{transform:perspective(200px) rotateY(0) skewY(0)}50%{transform:perspective(200px) rotateY(-14deg) skewY(2deg)}}
#vipBanner .k{font-family:var(--f-sign);font-weight:700;letter-spacing:.12em;font-size:12px;color:#f4c430}#vipBanner h3{margin:2px 0 2px;font-family:var(--f-sign);font-weight:700;font-size:30px;letter-spacing:.02em;color:#fff}
#vipBanner .meme{font-family:var(--f-sign);font-weight:600;font-size:19px;color:#ffd27a;animation:pulse 1.2s ease-in-out infinite}@keyframes pulse{50%{transform:scale(1.05)}}
#vipBanner .ico{font-size:46px;line-height:48px;display:inline-block;animation:wave 1.6s ease-in-out infinite}#vipBanner .ico:nth-child(2){animation-delay:.4s}#vipBanner .ico:nth-child(3){animation-delay:.8s}
@media (prefers-reduced-motion:reduce){#vipBanner .flag,#vipBanner .meme,#vipBanner .ico{animation:none}}`;document.head.appendChild(st);
  const b=document.createElement('div');b.id='vipBanner';b.setAttribute('aria-live','polite');$('#app').appendChild(b);})();
// the bodyguard: dark suit, sunglasses, earpiece; slides in on the dashboard side and says his piece
(function(){const st=document.createElement('style');st.textContent=`#guard{position:absolute;right:calc(var(--rail) + 30px);top:118px;z-index:13;display:flex;align-items:flex-start;gap:6px;pointer-events:none;transform:translateX(130%);opacity:0;transition:transform .55s cubic-bezier(.2,.9,.25,1.15),opacity .3s}
#guard.on{transform:translateX(0);opacity:1}#vipBanner.on~#guard{top:350px}#guard{transition:transform .55s cubic-bezier(.2,.9,.25,1.15),opacity .3s,top .4s}#guard svg{width:116px;height:150px;filter:drop-shadow(0 10px 18px rgba(0,0,0,.6));animation:gbob 2.4s ease-in-out infinite}
@keyframes gbob{50%{transform:translateY(-3px) rotate(-1deg)}}#guard .glint{animation:glint 2.2s ease-in-out infinite}@keyframes glint{0%,70%,100%{opacity:0}80%{opacity:1}}
#guard .bub{order:-1;margin-top:18px;max-width:240px;background:#f4f1e8;color:#121212;font-family:var(--f-sign);font-weight:700;font-size:19px;line-height:1.15;padding:9px 12px;border-radius:10px;position:relative;box-shadow:0 8px 24px rgba(0,0,0,.5)}
#guard .bub::after{content:'';position:absolute;right:-9px;top:18px;border:6px solid transparent;border-left:10px solid #f4f1e8}#guard .bub small{display:block;font-family:var(--f-mono);font-weight:500;font-size:10.5px;color:#6a6a6a;letter-spacing:.06em;margin-bottom:2px}
@media (prefers-reduced-motion:reduce){#guard svg,#guard .glint{animation:none}}`;document.head.appendChild(st);
  const g=document.createElement('div');g.id='guard';g.setAttribute('aria-live','assertive');g.innerHTML=`<div class="bub"><small>SECURITY · SPG</small><span id="guardTxt"></span></div>
<svg viewBox="0 0 116 150" aria-hidden="true"><path d="M14 150 C16 112 30 98 58 96 C86 98 100 112 102 150 Z" fill="#14171c"/><path d="M50 97 L58 122 L66 97 Z" fill="#f2f2f2"/><path d="M56 101 L58 128 L60 101 Z" fill="#7a0d12"/>
<path d="M30 104 L50 97 L56 122 L40 128 Z" fill="#0d0f13"/><path d="M86 104 L66 97 L60 122 L76 128 Z" fill="#0d0f13"/><rect x="49" y="80" width="18" height="18" rx="4" fill="#b98262"/>
<ellipse cx="58" cy="58" rx="22" ry="26" fill="#c89070"/><path d="M36 52 C36 34 48 28 58 28 C70 28 80 34 80 50 C76 42 68 40 58 40 C48 40 40 44 36 52 Z" fill="#1c1a19"/>
<rect x="38" y="52" width="17" height="10" rx="4" fill="#0a0a0a"/><rect x="61" y="52" width="17" height="10" rx="4" fill="#0a0a0a"/><rect x="54" y="55" width="8" height="2.4" fill="#0a0a0a"/>
<rect class="glint" x="42" y="54" width="6" height="2" rx="1" fill="#fff"/><path d="M50 74 Q58 77 66 74" stroke="#7a4a36" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<path d="M80 58 C88 62 90 74 86 88 C84 96 82 100 80 104" stroke="#d8d8d8" stroke-width="1.6" fill="none"/><circle cx="80" cy="58" r="3" fill="#2a2a2a"/>
<path d="M96 132 C100 116 96 100 86 92 C84 84 88 70 82 62 C78 58 74 62 76 68 C78 76 74 86 78 96" fill="#1a1d23"/><ellipse cx="80" cy="62" rx="5" ry="6" fill="#c89070"/></svg>`;$('#app').appendChild(g);})();
function guard(lines,who){const g=$('#guard'),t=$('#guardTxt');if(!g)return;clearTimeout(guard.t1);clearTimeout(guard.t2);
  // the bodyguard by default; set pieces bring their own character (badge + 116x150 svg)
  if(!guard.svg)guard.svg=g.querySelector('svg').outerHTML;g.querySelector('.bub small').textContent=who?who.badge:'SECURITY · SPG';
  const sv=g.querySelector('svg'),want=who&&who.svg?who.svg:guard.svg;if(guard.cur!==want){sv.outerHTML=want;guard.cur=want;}
  t.textContent=lines[0];g.classList.add('on');
  if(lines[1])guard.t1=setTimeout(()=>{t.textContent=lines[1];},2600);guard.t2=setTimeout(()=>g.classList.remove('on'),lines[1]?6200:4200);}
function vipBanner(on,k,title,meme,icons){const b=$('#vipBanner');if(!on){b.classList.remove('on');return;}const g=$('#guard');if(g&&icons==null)g.classList.remove('on');b.innerHTML=`<div class="flags">${icons==null?FLAG_IN+FLAG_RU:icons}</div><div class="k">${k}</div><h3>${title}</h3><div class="meme">${meme}</div>`;b.classList.add('on');}
function startSummit(){
  S.summitAt=T;const open=RW.filter(r=>!r.locked&&r.mode!=='OFF');if(open.length<2)return false;
  const E=T,order=open.slice().sort((a,b)=>b.len-a.len),reopen0=E+600;
  order.forEach((r,i)=>r.blocks.push({from:E,to:reopen0+60*i,why:'Security (VVIP)',summit:true}));
  let waved=0;for(const f of flights)if(f.state==='approach'&&f.td-T>25&&f.rwy&&open.includes(f.rwy)){goAround(f,'VVIP protocol, all runways closed');waved++;}
  const stands=GATES.filter(g=>g.remote&&!g.occ&&!g.res&&!g.mars&&CR[g.code]>=CR.E).sort((a,b)=>b.x-a.x).slice(0,3);
  const vip=(al,type,disp,call,from,code,td,rw,stand,banner)=>{const f=mk({kind:'arr',state:'sched',al,type,intl:al!=='IN1',from,fromCode:code,dir:'W',eta:td,endurance:180});
    Object.assign(f,{num:'1',disp,callsign:call,vip:true,origEta:td,spawnT:1e12,vipRw:rw,vipTd:td,banner});if(stand){stand.res=f;f.res=stand;}return f;};
  const R=order;
  const v1=vip('RSD','A124','Antonov An-124','RUSSIA CARGO','Moscow','VKO',E+185,R[1]||R[0],stands[2],['THE MOTORCADE HAS ITS OWN AEROPLANE','Antonov An-124 on final','Hindi-Rusi bhai bhai! 🚗🚗🚗']);
  const v2=vip('IN1','B77W','Bharat 1','INDIA ONE','Delhi','DEL',E+370,R[0],stands[0],['PRIME MINISTER NARENDRA MODI','Bharat 1 · Air India One on final','Mitron, welcome to Zero Mile! 🙏']);
  const v3=vip('RSD','IL96','Russia One','RUSSIA ONE','Moscow','VKO',E+555,R[1]||R[0],stands[1],['PRESIDENT VLADIMIR PUTIN','Russia One · Ilyushin Il-96 on final','🎶 Ra-Ra-Rasputin… let\'s go! 🎶']);
  SUM={E,reopen0,order,vips:[v1,v2,v3],said:new Set(),cine:null,lines:[
    [0,'SPG','Prime Minister Modi and President Putin are dropping in to see Tadoba\'s tigers, the Zero Mile stone and, unofficially, Nagpur\'s oranges. Every runway is ours. Now.'],
    [12,'TWR',`All aircraft, hold where you are. Yes, everyone. Yes, even you.${waved?` ${waved} on final are going around.`:''}`],
    [60,'SPG','Can you have one runway back? No. We have chosen the runways. We choose the order. We are very fast at saying no.'],
    [120,'FSO','An Antonov An-124 is bringing the President\'s cars. The motorcade has its own aeroplane.'],
    [190,'TWR','Antonov, welcome to Zero Mile. Please do not park on the red carpet.'],
    [250,'SPG','Ground ops has been asked to arrange the oranges by size. And then by colour. They are all orange.'],
    [370,'TWR','Bharat 1, welcome to Zero Mile. Follow the car with the very large flag.'],
    [450,'FSO','The two motorcades have met on the apron. Both are refusing to reverse. Talks are under way.'],
    [555,'TWR','Russia One, welcome to Zero Mile. Your follow-me car is the other car with the very large flag.'],
    [585,'SPG','The leaders have left for Tadoba. The tigers have been informed.'],
    [600,'SPG','We are returning your runways, one at a time. We pick the order. We like the long one first.']]};
  guard(['Sir. We have taken over your runways.','All of them. Yes, the long one too.']);
  radio(SUM.lines[0][1],SUM.lines[0][2]);SUM.said.add(0);logE(SUM.lines[0][2]);renderRw();return true;
}
function vipCinema(f){if(!SUM)return;if(SUM.cine){(SUM.queue=SUM.queue||[]).push(f);return;}SUM.cine={f,t0:performance.now()};if(SUM.prevSpeed==null){SUM.prevSpeed=speed;speed=0.5;}vipBanner(true,f.banner[0],f.banner[1],f.banner[2]);
  if(V3.on&&V3.ready){if(!SUM.prevCam)SUM.prevCam={t:Object.assign({},C3.t)};V3.mode='approach';C3.follow=f;C3.fpos=null;C3.apT=-99;camLabel();}else{centerOn(f.x,f.y);}}
function vipCinemaEnd(){if(!SUM||!SUM.cine)return;SUM.cine=null;vipBanner(false);const nx=(SUM.queue||[]).shift();if(nx&&nx.state!=='gone'){if(nx.landT==null){vipCinema(nx);return;}}
  if(SUM.prevSpeed!=null){speed=SUM.prevSpeed;SUM.prevSpeed=null;if(running)setSpeed(speed);}if(V3.on&&V3.ready&&SUM.prevCam){setCam('map');Object.assign(C3.t,SUM.prevCam.t);}}
function summitTick(){
  if(!SUM)return;const t=T-SUM.E,now=performance.now();
  for(const [at,src,txt] of SUM.lines)if(t>=at&&!SUM.said.has(at)){SUM.said.add(at);radio(src,txt);logE(txt);}
  for(const f of SUM.vips){if(f.state==='sched'&&T>=f.vipTd-D_APP-10){const r=f.vipRw;f.x=r.x1+14000;f.y=r.y+(r.y<0?-2600:2600);f.alt=2000;f.heading=Math.PI;f.state='inbound';beginApproach(f,r,f.vipTd);}
    if(f.state==='approach'&&!f.cineAsked&&T>=f.vipTd-95){f.cineAsked=true;vipCinema(f);}}
  const c=SUM.cine;if(c){if(!V3.on)centerOn(c.f.x,c.f.y);if(c.f.landT!=null&&!c.landed){c.landed=now;}if(c.landed&&now-c.landed>(SUM.queue&&SUM.queue.length?2200:4500))vipCinemaEnd();}
  for(const r of SUM.order){const b=r.blocks.find(b=>b.summit);if(b&&!b.said&&T>=b.to){b.said=true;const left=SUM.order.filter(o=>{const q=o.blocks.find(x=>x.summit);return q&&T<q.to;}).length;
    radio('TWR',`Runway ${r.short} back in service${left?`, ${left} to go`:'. The leaders have seen a tiger and two orange trees; your holding stack is the third most talked-about thing in Nagpur today'}.`);}}
  if(t>=600&&!SUM.guardBack){SUM.guardBack=true;guard(['Your runways. One at a time.','Have a nice day, sir.']);}
  if(T>SUM.reopen0+60*SUM.order.length+5&&!SUM.cine)SUM=null;
}
// ============ set pieces: the summit's siblings, one or two per level ============
// Each is a story with a character on the dashboard, radio lines on a timeline, a disruption the sim really feels,
// and often a cinematic cut with a banner. Defined in STORY; a level's script starts one like any incident ('st_<key>').
let STO=[],CINE=null;
const face=(e,bg)=>`<svg viewBox="0 0 116 150" aria-hidden="true"><circle cx="58" cy="82" r="50" fill="${bg||'#1d232b'}" stroke="#f4c430" stroke-width="3"/><text x="58" y="108" font-size="68" text-anchor="middle">${e}</text></svg>`;
const icos=(...e)=>e.map(x=>`<span class="ico">${x}</span>`).join('');
function startStory(k){const d=STORY[k];if(!d)return false;const c={k,E:T,said:new Set(),lines:[],len:d.len||900};if(d.start(c)===false)return false;
  STO.push(c);(S.storyRec=S.storyRec||[]).push(c);renderRw();return true;}
function storyTick(){
  for(const c of STO.slice()){const t=T-c.E;
    for(let i=0;i<c.lines.length;i++){const L=c.lines[i];if(t>=L[0]&&!c.said.has(i)){c.said.add(i);if(typeof L[1]==='function')L[1](c,t);else{radio(L[1],L[2]);logE(L[2]);}}}
    const d=STORY[c.k];if(d.tick)d.tick(c,t);if(t>=c.len&&!(CINE&&CINE.c===c))STO.splice(STO.indexOf(c),1);}
  cineTick();
}
// a cinematic cut on one aircraft: the sim slows to half speed, the camera follows it, a banner names the moment
function cinema(f,ban,o){o=o||{};if(!f||['gone','diverted'].includes(f.state))return;if(CINE||(SUM&&SUM.cine)){(cinema.q=cinema.q||[]).push([f,ban,o]);return;}
  CINE={f,ban,o,c:o.c,t0:performance.now(),prevSpeed:speed,prevCam:V3.on&&V3.ready?{t:Object.assign({},C3.t)}:null};speed=0.5;
  vipBanner(true,ban[0],ban[1],ban[2],ban[3]==null?'':ban[3]);
  if(V3.on&&V3.ready){V3.mode=f.state==='approach'?'approach':'follow';C3.follow=f;C3.fpos=null;C3.apT=-99;camLabel();}else centerOn(f.x,f.y);}
function cineTick(){
  if(!CINE){const q=cinema.q;if(q&&q.length&&!(SUM&&SUM.cine)){const [f,b,o]=q.shift();cinema(f,b,o);}return;}
  const c=CINE,now=performance.now();if(!V3.on)centerOn(c.f.x,c.f.y);
  if(c.o.landed&&c.f.landT!=null&&!c.landAt)c.landAt=now;
  const over=['gone','diverted'].includes(c.f.state)||(c.landAt&&now-c.landAt>3500)||now-c.t0>(c.o.ms||(c.o.landed?20000:6500));
  if(over){CINE=null;vipBanner(false);speed=c.prevSpeed;if(running)setSpeed(speed);if(V3.on&&V3.ready&&c.prevCam){setCam('map');Object.assign(C3.t,c.prevCam.t);}}
}
// a special arrival that appears 14 km out and lands on runway r at sim time td (holds a stand if one is given)
function specialArr(o,r,td,stand){const f=mk(Object.assign({kind:'arr',state:'sched',intl:false,dir:'W',eta:td,endurance:180},o));Object.assign(f,{origEta:td,spawnT:1e12,spRw:r,spTd:td});if(stand){stand.res=f;f.res=stand;}
  (specialArr.list=specialArr.list||[]).push(f);return f;}
function specialTick(){const L=specialArr.list;if(!L)return;for(const f of L){if(f.state==='sched'&&T>=f.spTd-D_APP-10){const r=f.spRw;f.x=r.x1+14000;f.y=r.y+(r.y<0?-2600:2600);f.alt=2000;f.heading=Math.PI;f.state='inbound';beginApproach(f,r,Math.max(f.spTd,T+D_APP));}}
  specialArr.list=L.filter(f=>f.state==='sched');}
// runways a story takes: from 'from' for 'secs', reopening one by one 'step' apart (blocks are what the sim and forecast read)
function takeRunways(rs,from,secs,step,why,desk){rs.forEach((r,i)=>{r.blocks.push({from,to:from+secs+(step||0)*i,why,desk:desk||why});r.blocks.sort((a,b)=>a.from-b.from);});
  for(const f of flights)if(f.state==='approach'&&rs.includes(f.rwy)&&f.td-T>25&&f.td>=from-20&&f.td<from+secs)goAround(f,why.toLowerCase());renderRw();}
// ---- the stories (pitched by the writers' room; jokes aim at systems and situations, never at real people) ----
const OTPNOW=()=>S.dep+S.arr?Math.round((S.depOnTime+S.arrOnTime)/(S.dep+S.arr)*100):100;
const rwBy=(k,not)=>RW.filter(r=>!r.locked&&r.mode!=='OFF'&&r!==not&&(k==='arr'?canArr(r):canDep(r)));
const nextOn=r=>flights.filter(o=>o.state==='approach'&&o.rwy===r).sort((a,b)=>a.td-b.td)[0];
// an incident card that belongs to a story (buttons are ordered best-first: the bots take the first)
function storyCard(c,o){const I=Object.assign({id:++INC,type:'story',born:T,total:40,def:0,st:c},o);I.left=I.total;
  S.incTypes['st_'+c.k]=(S.incTypes['st_'+c.k]||0)+1;incidents.push(I);renderInc();radio('AOCC',I.title+'.');return I;}
function flashBanner(b,ms){if(CINE||(SUM&&SUM.cine))return;vipBanner(true,b[0],b[1],b[2],b[3]==null?'':b[3]);clearTimeout(flashBanner.t);
  flashBanner.t=setTimeout(()=>{if(!CINE&&!(SUM&&SUM.cine))vipBanner(false);},ms||4500);}
// emoji on the field (2D map and 3D overlay): {x,y,e,until,n,sp,alt,px}
let MARKS=[];
function drawMarks(g,toScr,now){for(const m of MARKS){if(T>m.until)continue;const n=m.n||1;
  for(let i=0;i<n;i++){const x=m.x+(n>1?(((i*37)%7)-3)*m.sp/6+Math.sin(now*0.7+i)*m.sp*0.06:0),y=m.y+(n>1?(((i*53)%5)-2)*m.sp/10+Math.cos(now*0.9+i*2)*m.sp*0.04:0);
    const p=toScr(x,y,m.alt||0);if(!p)continue;g.font=`${m.px||26}px serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(m.e,p.X,p.Y+(n>1?Math.sin(now*2+i)*3:0));}}
  g.textAlign='left';g.textBaseline='alphabetic';MARKS=MARKS.filter(m=>T<=m.until);}
const WHO={protocol:{badge:'PROTOCOL · MINISTRY',svg:face('🙏','#3a2614')},ranger:{badge:'RANGE OFFICER · FOREST DEPT',svg:face('🐅','#1f3a14')},
  kid:{badge:'ROOFTOP · AHMEDABAD',svg:face('🪁','#14304a')},ramp:{badge:'GROUND OPS SUPERVISOR',svg:face('🏏','#123a22')},tower:{badge:'TOWER',svg:face('📣','#123a22')},
  dabba:{badge:'MUKADAM · DABBAWALAS',svg:face('🍱','#3a2a10')},admin:{badge:'GROUP ADMIN · OPS',svg:face('📱','#103a2a')},team:{badge:'TEAM MANAGER',svg:face('🏆','#123a5a')}};

// L1 · the ribbon: the first departure can't go until the Chief Guest cuts it, and he is always five minutes away
STORY.ribbon={len:1500,start(c){const r=rwBy('dep')[0];if(!r)return false;c.r=r;
  c.blk={from:T,to:T+1e6,open:true,why:'Inauguration ribbon',desk:'Ribbon across it, until it is cut'};r.blocks.push(c.blk);r.blocks.sort((a,b)=>a.from-b.from);
  c.mark={x:r.x0+300,y:r.y,e:'🎀',until:T+1e6,px:30};MARKS.push(c.mark);
  guard(['Sir, no departures yet. The Chief Guest will cut the ribbon.','He is five minutes away. 🙏'],WHO.protocol);
  c.lines.push([0,'PROTOCOL',`A ceremonial ribbon is tied across ${r.short}. No departures until the Chief Guest cuts it. He is five minutes away.`]);
  const go=()=>{r.blocks=r.blocks.filter(b=>b!==c.blk);c.mark.until=T;renderRw();const f=flights.find(o=>o.rwy===r&&['lineup','hp'].includes(o.state))||flights.find(o=>o.rwy===r&&o.state==='taxi_out');
    if(f)cinema(f,['OPENING DAY',`The first departure rolls through the ribbon on ${r.short}`,'BAS PAANCH MINUTE 🙏',icos('🎀','✂️','🛫')],{ms:7000});};
  c.go=go;c.wait=T+240+Math.floor(SIMR()*240);
  const I=storyCard(c,{icon:{g:'🎀',c:'#ff9933'},x:r.x0+300,y:r.y,title:`A ribbon across ${r.short}`,
    text:`The opening ceremony has tied a ribbon across ${r.short}, and the first departures are queuing behind it. Cut it yourselves and traffic flows now, but Protocol will re-stage the ceremony in about 15 minutes on the arrivals runway, for 3 minutes. Or wait: the Chief Guest is "five minutes away".`,
    def:1,defText:'you wait for the Chief Guest.',
    acts:[{l:'Cut it ourselves',pri:1,fn(){go();const ra=rwBy('arr').sort((a,b)=>b.tdList.length-a.tdList.length)[0];
        c.cut=true;if(ra){takeRunways([ra],T+900,180,0,'Inauguration, take two','Inauguration, take two');c.lines.push([T-c.E+900,()=>{guard(['The Chief Guest has arrived. We will now inaugurate again.','Only four minutes. Your arrivals runway, please. 🎀'],WHO.protocol);
          flashBanner(['OPENING DAY',`The ceremony is re-staged on ${ra.short}`,'INAUGURATED. AGAIN. 🎀',icos('🎀','📸','🎀')]);}]);}
        resolve(I,true,`${r.short}'s ribbon was cut by ops. Protocol will be back.`);}},
      {l:'Wait for the Chief Guest',fn(){resolve(I,true,'');}}]});c.I=I;
},tick(c,t){if(!c.cut&&!c.went){if(T>=c.wait){c.went=true;if(incidents.includes(c.I))resolve(c.I,true,'The Chief Guest arrived and cut the ribbon.');c.go();guard(['The Chief Guest has cut the ribbon.','He would like to do it again for the photographers. (No.)'],WHO.protocol);}
    else if(T>=(c.nag||0)){if(c.nag)radio('PROTOCOL',['The Chief Guest is five minutes away.','Still five minutes, sir. Very consistent.','The convoy has been sighted. It was a different convoy.','Five minutes. Same five minutes.'][(c.nagN=(c.nagN||0)+1)%4]);c.nag=T+120;}}}};

// L1 · the tigress: Nagpur is the tiger capital of India, and she has right of way
STORY.tiger={len:1500,start(c){const r=rwBy('dep')[0];if(!r)return false;c.r=r;c.ra=rwBy('arr',r)[0]||null;
  const f=flights.find(o=>o.rwy===r&&['hp','lineup'].includes(o.state))||flights.find(o=>o.rwy===r&&o.state==='taxi_out');
  if(f)cinema(f,['TIGER CAPITAL OF INDIA',`A tigress is walking down ${r.short}`,'Shere Khan, you are not cleared to line up 🐅',icos('🐅','🛫','🌳')],{ms:6500});
  c.mark={x:lerp(r.x0,r.x1,0.45),y:r.y,e:'🐅',until:T+1e6,px:34};MARKS.push(c.mark);
  guard(['Sir, she is not a bird. You cannot sweep her.','She is the senior-most resident here. 🐅'],WHO.ranger);
  c.lines.push([0,'TWR',`All stations: a tigress is on ${r.short}. Nobody is to taxi towards her. That includes the follow-me car.`]);
  const I=storyCard(c,{icon:{g:'🐅',c:'#ff8c1a'},x:c.mark.x,y:r.y,title:`A tigress on ${r.short}`,
    text:`A tigress from the Umred-Karhandla corridor has walked onto ${r.short}. Wait for the forest department's dart team and ${r.short} shuts for 5 to 8 minutes; nobody knows exactly. Or herd her off with sirens: ${r.short} stays open, but she is still out there.`,
    def:0,defText:`${r.short} shuts until the dart team arrives.`,
    acts:[{l:'Wait for the dart team',pri:1,fn(){const d=300+Math.floor(SIMR()*180);closeRw(r,d,'Tigress on the runway');c.mark.until=T+d;
        c.lines.push([T-c.E+d,'FOREST','She has been darted, weighed and named. She is called Runway. She is going home to Tadoba.']);resolve(I,true,`${r.short} shut for the tigress.`);}},
      {l:'Herd her off with sirens',fn(){c.mark.until=T+60;c.herd=true;resolve(I,true,'');
        if(c.ra){const ra=c.ra,at=T-c.E+900;c.lines.push([at-60,'FOREST',`Update: the tigress has been seen heading towards ${ra.short}. She did not like the sirens.`]);
          c.lines.push([at,()=>{closeRw(ra,240,'Tigress, again');MARKS.push({x:lerp(ra.x0,ra.x1,0.6),y:ra.y,e:'🐅',until:T+240,px:34});
            guard(['She is back. On your arrivals runway.','Sirens only made her curious, sir. 🐅'],WHO.ranger);
            const g=nextOn(ra);flashBanner(['SHE IS BACK',`The tigress is on ${ra.short}`,'Madam has right of way 🐅',icos('🐅','🐅')]);}]);}}}]});
},lesson(c){return c.herd?{w:25,title:'The tigress came back',text:'Herding her off kept the departure runway open, but she walked onto the arrivals runway 15 minutes later, mid-wave. A cost you put off still has to be paid: when you choose the risky option, flip a second runway to MIX early so the bill lands softly.'}:null;}};

// L2 · Uttarayan: Ahmedabad moved in, and so did its kites
STORY.kites={len:1000,start(c){const ra=rwBy('arr').sort((a,b)=>b.tdList.length-a.tdList.length);const r=ra[0];if(!r)return false;c.r=r;r.kiteUntil=T+480;
  c.nx=ra.find(o=>o!==r)||null;MARKS.push({x:r.x1+1600,y:r.y,e:'🪁',until:T+480,n:9,sp:2200,alt:160,px:24});
  const f=nextOn(r);if(f)cinema(f,['UTTARAYAN · KITE FESTIVAL',`Ahmedabad moved in. So did its kites, over ${r.short}.`,'KAI PO CHE! 🪁 Kites 1, A321neo 0',icos('🪁','🪁','🪁')],{ms:6500});
  guard(['Uncle, the whole city is on the roof.','We are not cutting your planes. We are cutting each other. 🪁'],WHO.kid);
  c.lines.push([0,'TWR',`All aircraft for ${r.short}: kites reported on final, 300 to 800 feet. Yes, kites.`]);
  const I=storyCard(c,{icon:{g:'🪁',c:'#3aa0ff'},x:r.x1+1200,y:r.y,title:`Kites over the approach to ${r.short}`,
    text:`It's Uttarayan, and a cloud of kites is drifting across ${r.short}'s final approach for the next 8 minutes: about 1 landing in 4 there will go around. Switch ${r.short} to departures while they pass (ops switches it back when they move on), or keep landing through them. They are drifting south${c.nx?`, towards ${c.nx.short}`:''}.`,
    def:1,defText:`${r.short} keeps landing through the kites.`,
    acts:[{l:`${r.short} to DEP while they pass`,pri:1,fn(){c.back=r.mode;setMode(r,'DEP');resolve(I,true,`${r.short} switched to departures while the kites passed.`);}},{l:'Keep landing',fn(){resolve(I,true,'');}}]});
  if(c.nx){const n=c.nx;c.lines.push([400,'WX',`The kites are drifting south. Expect them over ${n.short} in about a minute.`]);
    c.lines.push([480,()=>{if(c.back&&r.mode==='DEP'&&!r.locked)setMode(r,c.back);n.kiteUntil=T+360;MARKS.push({x:n.x1+1600,y:n.y,e:'🪁',until:T+360,n:8,sp:2200,alt:160,px:24});radio('TWR',`Kites now on final for ${n.short}. ${r.short} is clear.`);guard(['Uncle, sorry. Wind changed.','Kai po che! 🪁'],WHO.kid);renderRw();}]);}
  c.lines.push([860,'TWR','The kites have gone home for lunch. All finals clear.']);}};

// L2 · the last ball of the World Cup final: the country stops, and so does the apron
STORY.lastball={len:900,start(c){
  guard(['Sir, India need six off the last ball.','Every tug driver is watching. Even the birds have stopped. 🏏'],WHO.ramp);
  c.lines.push([0,'RAMP','Tug 14, report position. … Tug 14? … "Sorry sir, checking tyre pressure."']);
  const I=storyCard(c,{icon:{g:'🏏',c:'#3ad07f'},x:CONC[0].lx,y:CONC[0].ly,title:'The last ball of the World Cup final',
    text:'India need six off the last ball, and every crew on the apron is on their phone. Put it on the PA: all pushbacks stop for 3 minutes, and if India win the crews come back flying (turnarounds 4 minutes quicker). Or order everyone back to work: they watch anyway, under the wings, and pushbacks run slow for 6 minutes.',
    def:1,defText:'crews watch on their phones: slow pushbacks for 6 minutes.',
    acts:[{l:'Put it on the PA (3 min)',pri:1,fn(){FX.pushFreeze=T+180;c.pa=true;c.six=T+180;radio('PA','Ladies and gentlemen, the last ball. Nobody move.');resolve(I,true,'The last ball went on the PA: pushbacks paused for 3 minutes.');}},
      {l:'Back to work',fn(){FX.pushSlow=T+360;FX.pushSlowS=150;c.six=T+180;resolve(I,true,'');}}]});
  c.sixFn=(cc=>{radio('PA','SIX! INDIA WIN THE WORLD CUP!');logE('India won the World Cup off the last ball.');
    if(cc.pa)for(const f of flights)if(f.state==='at_gate'&&f.readyAt>T)f.readyAt=Math.max(T,f.readyAt-240);
    const f=flights.find(o=>o.state==='push')||flights.find(o=>o.state==='at_gate'&&o.kind==='dep');
    const b=['LAST BALL · SIX TO WIN','SIX! India win the World Cup','IN-DI-A! IN-DI-A! 🏆',icos('🏏')+FLAG_IN+icos('🏆')];if(f)cinema(f,b,{ms:6500});else flashBanner(b);
    guard([cc.pa?'The crews are back. They are running.':'They are back. Slowly. Smiling.','Who is honking? … Fine. Honk. 📣'],WHO.tower);});c.len=4000;
},tick(c){if(c.six&&T>=c.six&&!c.sixed){c.sixed=true;c.sixFn(c);}}};

// L3 · the dabbawalas: Mumbai's lunch network moved with the airport, and it is never late
STORY.dabba={len:900,start(c){const ds=CONC.filter(o=>o.id[0]==='D');if(!ds.length)return false;
  const f=flights.filter(o=>o.state==='at_gate'&&o.gate&&o.gate.conc[0]==='D').sort((a,b)=>b.T.span-a.T.span)[0];
  guard(['Saheb, since 1890, never late.',`Your on-time is ${OTPNOW()}%. Ours is 100. Please hold the aeroplane. 🍱`],WHO.dabba);
  if(f)cinema(f,['MUMBAI MOVED IN','120 dabbawalas crossing at Concourse D','A380 GIVES WAY TO TIFFIN 🍱',icos('🚲','🍱','🚲')],{ms:6500});
  const I=storyCard(c,{icon:{g:'🍱',c:'#f4c430'},x:ds[0].lx,y:ds[0].ly,title:'Dabbawalas crossing at Concourse D',
    text:"Mumbai's dabbawalas moved with the airport, and they feed the tower. 120 bicycles on the tiffin run need to cross Concourse D's apron road. Let them cross and nothing moves at D for 3 minutes. Hold them and the tower's lunch is late: every runway changeover takes 3 minutes instead of 2 for the next 15 minutes.",
    def:0,defText:'they cross anyway: Concourse D stops for 3 minutes.',
    acts:[{l:'Let them cross (3 min)',pri:1,fn(){for(const d of ds){d.laneShut=Math.max(d.laneShut,T+180);MARKS.push({x:d.lx,y:d.ly,e:'🚲',until:T+180,n:6,sp:500,px:20});}resolve(I,true,'The dabbawalas crossed Concourse D. On time, obviously.');}},
      {l:'Hold the bicycles',fn(){FX.chgK=1.5;FX.chgUntil=T+900;c.hangry=true;renderRw();resolve(I,true,'');}}]});
  c.lines.push([200,cc=>{if(cc.hangry){radio('TWR','The tower is hungry. Changeovers are taking longer. Nobody talk to the supervisor.');guard(['Lunch is late, saheb.','The tower is not happy. 🍱'],WHO.dabba);}
    else radio('TWR','Lunch has arrived in the tower. Every dabba correct. Again.');}]);}};

// L4 · Delhi moves in: five ops WhatsApp groups become one
const WA=['Good afternoon to all 🌞🙏','Forwarded many times: NASA says Zero Mile is visible from space','R3 closed?? pls confirm urgent','Happy birthday to the Fire Chief\'s grandson 🎂🎂','Who has added me in this group','Pls do not send good morning msgs in official group',
  'Good morning 🌞','Is canteen open','Sir my leave application pls see','Video: amazing A380 landing (not ours)','👍','👍👍','Sir which one is the Delhi bank? Pls share Excel','This message was deleted','Pls call','Ok'];
STORY.whatsapp={len:720,start(c){
  guard(['Dear all, the five ops groups are now one group.','1,400 members. Official purposes only. 🙏'],WHO.admin);
  flashBanner(['DELHI MOVES IN','Five ops WhatsApp groups are now one','GOOD AFTERNOON TO ALL 🌞🙏',icos('📱','🌞','🙏')],5000);
  for(let i=0;i<6;i++)c.lines.push([10+i*12,'OPS GROUP',WA[i]]);
  const I=storyCard(c,{icon:{g:'📱',c:'#25d366'},x:CONC[0].lx,y:CONC[0].ly,title:'1,400 people in the ops WhatsApp group',
    text:"Delhi's arrival merged five ops groups into one, and runway changeover confirmations are buried under good-morning messages: changeovers take 4 minutes instead of 2. Make the group admin-only and the hurt members start \"ZMI Ops (Real)\", where gate changes get lost: pushbacks take 90 seconds longer for 8 minutes. Or ride it out for 8 minutes.",
    def:1,defText:'you ride it out: 4-minute changeovers for 8 minutes.',
    acts:[{l:'Make it admin-only',pri:1,fn(){FX.pushSlow=T+480;FX.pushSlowS=90;c.quiet=true;radio('OPS GROUP','Only admins can send messages. 214 members have left. "ZMI Ops (Real)" has 213 members.');resolve(I,true,'The ops group went admin-only.');}},
      {l:'Ride it out',fn(){FX.chgK=2;FX.chgUntil=T+480;renderRw();resolve(I,true,'');}}]});
},tick(c,t){if(!c.quiet&&t>90&&t<600&&t>=(c.nm||90)){c.nm=t+30;radio('OPS GROUP',WA[6+Math.floor(Math.random()*(WA.length-6))]);}}};

// L4 · the champions come home (the team from Level 2's last ball)
STORY.trophy={len:900,start(c){const r=rwBy('arr').sort((a,b)=>a.y-b.y)[0];if(!r)return false;c.r=r;
  const st=GATES.filter(g=>g.remote&&!g.occ&&!g.res&&!g.mars&&CR[g.code]>=CR.E).sort((a,b)=>b.x-a.x)[0]||null;const td=T+420;
  c.f=specialArr({al:'AI',type:'A359',disp:'Trophy One',callsign:'TROPHY ONE',num:'1',from:'Melbourne',fromCode:'MEL',intl:true,vip:true},r,td,st);
  guard(['Sir, the champions land in seven minutes.','The boys want the water salute. And a second bus. For the trophy. 🏆'],WHO.team);
  const I=storyCard(c,{icon:{g:'🏆',c:'#f4c430'},x:r.x1+1500,y:r.y,title:'The World Cup is coming home',
    text:`The team from the last ball lands on ${r.short} in about 7 minutes, and half of Nagpur is on the airport road. Give them the water salute and an apron parade: ${r.short} closes for 5 minutes after they land. Or send them straight to the motorcade: the crowd jams the forecourt, and pushbacks at Concourses A and B take 3 minutes longer for 10 minutes.`,
    def:1,defText:'straight to the motorcade: slow pushbacks at A and B for 10 minutes.',
    acts:[{l:'Water salute + parade',pri:1,fn(){takeRunways([r],td+40,300,0,'Victory parade','Victory parade');c.arch=true;resolve(I,true,`${r.short} closed for the champions' parade.`);}},
      {l:'Straight to the motorcade',fn(){for(const o of CONC)if('AB'.includes(o.id[0]))o.slowUntil=Math.max(o.slowUntil,T+600);resolve(I,true,'');}}]});
  c.lines.push([5,'APP','Trophy One, Nagpur Approach. Welcome home. Everybody on this frequency says congratulations.']);
  c.lines.push([70,'FSO','There are 1,00,000 people on the airport road. 40,000 of them have a drum.']);
},tick(c,t){const f=c.f;if(f&&f.state==='approach'&&!c.cine&&f.td-T<95){c.cine=true;
  cinema(f,['THE CHAMPIONS ARE HOME',`Trophy One · Air India A350 on final for ${c.r.short}`,c.arch?'Water salute! IN-DI-A! 🏆':'IN-DI-A! IN-DI-A! 🏆',icos('🏆')+FLAG_IN+icos('🏏')],{landed:true});}}};
const tleft=I=>I.simFuse?`MAYDAY in ${Math.max(0,Math.ceil(I.left/Math.max(1,speed)))} s`:`${Math.max(0,Math.ceil(I.left))} s`;
function renderInc(){
  $('#incCount').textContent=incidents.length?`${incidents.length} open`:'all clear';
  $('#incList').innerHTML=incidents.map(I=>{const ic=I.icon||ICON[I.type];return `<div class="inc" data-id="${I.id}"><div class="ic" style="background:${ic.c}">${ic.g}</div><h4 data-find="${I.id}">${I.title}</h4><p>${I.text}</p><div class="acts">${I.acts.map((a,i)=>`<button data-i="${i}" class="${a.pri?'pri':''}" ${a.dis&&a.dis()?'disabled':''}>${a.l}</button>`).join('')}</div><div class="dflt">If you leave it: ${I.defText}</div><div class="tm"><span>${tleft(I)}</span><i style="width:${clamp(I.left/I.total*120,0,120)}px"></i></div></div>`;}).join('');
}
$('#incList').addEventListener('click',e=>{const row=e.target.closest('.inc');if(!row)return;const I=incidents.find(i=>i.id===+row.dataset.id);if(!I)return;const b=e.target.closest('button[data-i]');if(b&&!b.disabled){I.acts[+b.dataset.i].fn();return;}if(e.target.closest('[data-find]')){const p=incPos(I);centerOn(p.x,p.y);}});
function incTimers(){document.querySelectorAll('#incList .inc').forEach(row=>{const I=incidents.find(i=>i.id===+row.dataset.id);if(!I)return;row.querySelector('.tm span').textContent=tleft(I);row.querySelector('.tm i').style.width=clamp(I.left/I.total*120,0,120)+'px';row.querySelectorAll('button[data-i]').forEach(b=>{const a=I.acts[+b.dataset.i];b.disabled=!!(a.dis&&a.dis());});});}

/* ============ popover ============ */
let popInc=null,popRw=null,popF=null;
function closePop(){$('#pop').hidden=true;popInc=null;popRw=null;popF=null;selRw=null;renderRw();}
$('#popX').onclick=closePop;
function placePop(sx,sy){const p=$('#pop');p.hidden=false;const w=272,h=p.offsetHeight||140;let x=sx+18,y=sy-20;const r=cam.region||{L:0,R:VW,Tp:0,B:VH};if(x+w>r.R)x=sx-w-18;if(y+h>r.B)y=r.B-h-4;if(y<r.Tp)y=r.Tp+4;p.style.left=x+'px';p.style.top=y+'px';}
function openIncPop(I){popInc=I;popRw=null;popF=null;const ic=I.icon||ICON[I.type];$('#popBody').innerHTML=`<h4><span style="color:${ic.c}">●</span> ${I.title}</h4><p>${I.text}</p><div class="acts">${I.acts.map((a,i)=>`<button data-i="${i}" class="${a.pri?'pri':''}" ${a.dis&&a.dis()?'disabled':''}>${a.l}</button>`).join('')}</div><p class="dflt" style="margin:6px 0 0;font-size:11.5px;color:var(--ink-3)">If you leave it: ${I.defText}</p>`;$('#popBody').querySelectorAll('button[data-i]').forEach(b=>b.onclick=()=>{I.acts[+b.dataset.i].fn();closePop();});const p=incPos(I);placePop(sx(p.x),sy(p.y));}
function openRwPop(r,mx,my){popRw=r;popInc=null;popF=null;selRw=r;$('#popBody').innerHTML=`<h4>Runway ${r.name}</h4><p>${r.len.toLocaleString('en-IN')} m${r===LONGEST?' · the long runway':''}. What should it do? ${term('modes','Modes')}</p>${segHtml(r)}`;$('#popBody').querySelectorAll('.seg button').forEach(b=>{b.onclick=()=>{WAVEP=null;setMode(r,b.dataset.m);openRwPop(r,mx,my);};previewOn(b,r);});placePop(mx,my);renderRw();}
function openFlightPop(f,mx,my){popF=f;popInc=null;popRw=null;selected=f;renderFlightPop();placePop(mx,my);}
function renderFlightPop(){const f=popF;if(!f)return;const st=stateText(f);let dl=`<dt>Aircraft</dt><dd>${f.T.name}</dd><dt>Route</dt><dd>${f.kind==='dep'?`→ ${f.toCode} ${f.to}`:`${f.fromCode} ${f.from} →`}${f.intl?' · intl':''}</dd><dt>Status</dt><dd>${st}</dd>`;
  if(f.kind==='dep'){const l=mins(T-f.std);dl+=`<dt>Departs</dt><dd class="mono">${clk(f.std)} ${l>0?`<span style="color:var(--stop)">+${l}m</span>`:''}</dd>`;if(f.links)dl+=`<dt>Connecting</dt><dd>${f.links.reduce((s,l)=>s+l.n,0)} passengers from ${f.links.length} flights</dd>`;}
  else{dl+=`<dt>Lands</dt><dd class="mono">${clk(f.eta)}${f.state==='holding'?` · <span style="color:var(--warn)">${Math.round(f.endurance)}m fuel</span>`:''}</dd>`;if(f.turnLinks||f.turn)dl+=`<dt>Next</dt><dd>${f.turn?`${f.al} ${f.turn.num} at ${clk(f.turn.std)}`:'Night stop'}</dd>`;}
  $('#popBody').innerHTML=`<h4 style="display:flex;gap:8px;align-items:center"><i style="width:5px;height:18px;background:${f.A.tail};border-radius:2px;display:inline-block"></i>${fl(f)} <span style="font-size:12px;color:var(--ink-3);font-family:var(--f-body);font-weight:400">${f.A.name}</span></h4><dl>${dl}</dl><div class="acts"><button id="fpPrio" class="${f.prio?'pri':''}" ${['holding','inbound','at_gate','taxi_out','hp'].includes(f.state)?'':'disabled'}>${f.prio?'Prioritised':'Prioritise'}</button>${f.kind==='dep'&&f.state==='at_gate'?`<button id="fpHold">${f.held?'Release':'Hold at gate'}</button>`:''}${V3.on?'<button id="fpFollow">Follow</button>':''}</div>`;
  const p=$('#fpPrio');if(p)p.onclick=()=>{f.prio=!f.prio;renderFlightPop();};const fw=$('#fpFollow');if(fw)fw.onclick=()=>{setCam('follow',f);closePop();};const h=$('#fpHold');if(h)h.onclick=()=>{f.held=!f.held;renderFlightPop();};}
function stateText(f){const m={sched:'On the ground at origin',inbound:'Inbound',holding:`Holding at ${7+(f.level||0)},000 ft`,approach:`Final for ${f.rwy?f.rwy.short:''}`,rollout:'Landing',taxi_in:'Taxiing to gate '+(f.res?f.res.id:''),dock:'Parking',parked:'Parked, no onward flight',nogate:'Waiting for a gate',tow:'Towed to long-stay parking',push:'Pushing back',start:'Starting engines',taxi_out:f.noRwy?'No departure runway open':`Taxiing to ${f.rwy?f.rwy.short:''}`,hp:`Holding short of ${f.rwy?f.rwy.short:''}`,lineup:'Lining up',roll:'Taking off',climb:'Climbing out',goaround:'Going around',divert:'Diverting',stuck:'Stopped on the taxiway'};
  if(f.vip&&(f.state==='parked'||f.state==='dock'))return 'VVIP: on the red carpet';
  if(f.state==='at_gate'){if(f.held)return 'Held at gate';const go=Math.max(f.std,f.readyAt);return T<f.readyAt?'Turnaround in progress':T<go?'Boarding':'Waiting to push';}return m[f.state]||f.state;}

/* ============ camera ============ */
const cam={x:0,y:0,s:0.1,fit:0.1};const camT={x:0,y:0,s:0.1,anchor:null};
const WX0=EXT.x0-600,WX1=EXT.x1+5000,WY0=EXT.y0-400,WY1=EXT.y1+400;
const CB={x0:WX0-3000,x1:WX1+6000,y0:WY0-3000,y1:WY1+3000};
function clampCam(c){const r=cam.region||{L:0,R:VW,Tp:0,B:VH};const hx=((r.L+r.R)/2)/c.s,hy=((r.Tp+r.B)/2)/c.s,hw=(r.R-r.L)/2/c.s,hh=(r.B-r.Tp)/2/c.s;const fit=(v,a,b,h)=>a+h>b-h?(a+b)/2:clamp(v,a+h,b-h);const cx=fit(c.x+hx,CB.x0,CB.x1,hw),cy=fit(c.y+hy,CB.y0,CB.y1,hh);c.x=cx-hx;c.y=cy-hy;}
function zoomAt(mx,my,f){const wx=mx/camT.s+camT.x,wy=my/camT.s+camT.y;const ns=clamp(camT.s*f,cam.fit*0.8,cam.fit*14);camT.s=ns;camT.x=wx-mx/ns;camT.y=wy-my/ns;clampCam(camT);camT.anchor={mx,my,wx,wy};}
function zoomCenter(f){const r=cam.region||{L:0,R:VW,Tp:0,B:VH};zoomAt((r.L+r.R)/2,(r.Tp+r.B)/2,f);}
function camEase(dt){const k=1-Math.exp(-dt*16);if(camT.anchor&&Math.abs(cam.s-camT.s)>camT.s*0.002){cam.s+=(camT.s-cam.s)*k;const a=camT.anchor;cam.x=a.wx-a.mx/cam.s;cam.y=a.wy-a.my/cam.s;}else{camT.anchor=null;cam.s+=(camT.s-cam.s)*k;cam.x+=(camT.x-cam.x)*k;cam.y+=(camT.y-cam.y)*k;}}
function fitCam(){
  const app=cv.getBoundingClientRect(),rail=$('#rail').getBoundingClientRect(),top=$('#top').getBoundingClientRect(),wv=$('#wave').getBoundingClientRect();
  const wide=rail.left-app.left>VW*0.45;let L=6,R=VW-6,Tp=top.bottom-app.top+4,B=VH-6;
  if(wide){R=rail.left-app.left-8;B=wv.height?wv.top-app.top-4:VH-6;}else B=rail.top-app.top-4;
  const w=Math.max(100,R-L),h=Math.max(100,B-Tp);const s=Math.min(w/(WX1-WX0),h/(WY1-WY0));cam.fit=s;cam.s=s;
  cam.x=(WX0+WX1)/2-(L+w/2)/s;cam.y=(WY0+WY1)/2-(Tp+h/2)/s;cam.region={L,R,Tp,B};camT.x=cam.x;camT.y=cam.y;camT.s=cam.s;camT.anchor=null;
  const z=$('#zoomBox');z.style.left=(L+8)+'px';z.style.top=(Tp+8)+'px';
}
const sx=x=>(x-cam.x)*cam.s,sy=y=>(y-cam.y)*cam.s;
function centerOn(x,y){if(!cam.region)return;const r=cam.region;if(camT.s<cam.fit*2.5)camT.s=cam.fit*3.5;camT.anchor=null;camT.x=x-((r.L+r.R)/2)/camT.s;camT.y=y-((r.Tp+r.B)/2)/camT.s;clampCam(camT);}
function resize(){if(typeof resize3D==='function'&&V3.ready)setTimeout(resize3D,0);DPR=Math.min(window.devicePixelRatio||1,2);VW=cv.clientWidth;VH=cv.clientHeight;cv.width=Math.round(VW*DPR);cv.height=Math.round(VH*DPR);const wr=wcv.getBoundingClientRect();wcv.width=Math.round(wr.width*DPR);wcv.height=Math.round(wr.height*DPR);fitCam();placeToast();}
window.addEventListener('resize',resize);
if(window.ResizeObserver)new ResizeObserver(()=>{if(cv.clientWidth)resize();}).observe($('#app'));
document.addEventListener('visibilitychange',()=>{if(!document.hidden){last=performance.now();resize();}});

/* ============ static terrain ============ */
const TX0=CB.x0,TY0=CB.y0,TW=CB.x1-CB.x0,TH=CB.y1-CB.y0,TRES=0.09;
let TERR=null;
const APRONS=(SPEC.aprons||[]).map(d=>new Path2D(d));
const BLD=(SPEC.buildings||[]).map(b=>({kind:b.kind,label:b.label,p:b.outline?new Path2D(b.outline):null,cx:b.cx,cy:b.cy}));
function buildTerrain(){
  TERR=document.createElement('canvas');TERR.width=Math.round(TW*TRES);TERR.height=Math.round(TH*TRES);const g=TERR.getContext('2d');g.setTransform(TRES,0,0,TRES,-TX0*TRES,-TY0*TRES);
  const R=mulberry(5);
  g.fillStyle='#8d7a5c';g.fillRect(TX0,TY0,TW,TH);
  // fields: black cotton soil, dry stubble, orange orchards
  for(let i=0;i<1600;i++){const x=TX0+R()*TW,y=TY0+R()*TH,w=300+R()*900,h=200+R()*700,a=(R()-0.5)*0.5;const k=R();g.save();g.translate(x,y);g.rotate(a);
    g.fillStyle=k<.3?'#4a4036':k<.55?'#a38c63':k<.75?'#9b8a5e':k<.9?'#6c6a3c':'#b39a6b';g.fillRect(0,0,w,h);
    if(k>=.75&&k<.9){g.fillStyle='#3f5a2c';for(let ox=20;ox<w;ox+=38)for(let oy=20;oy<h;oy+=38){g.beginPath();g.arc(ox,oy,11,0,7);g.fill();}}
    g.restore();}
  g.strokeStyle='rgba(40,30,20,.35)';g.lineWidth=14;for(let i=0;i<260;i++){const x=TX0+R()*TW,y=TY0+R()*TH;g.beginPath();g.moveTo(x,y);g.lineTo(x+(R()-0.5)*3000,y+(R()-0.5)*3000);g.stroke();}
  // villages
  for(let v=0;v<26;v++){const vx=TX0+R()*TW,vy=TY0+R()*TH;if(vx>EXT.x0-500&&vx<EXT.x1+500&&vy>EXT.y0-500&&vy<EXT.y1+500)continue;for(let i=0;i<160;i++){const a=R()*7,d=R()*420;g.fillStyle=['#b9a48a','#a38a6e','#c8b59a','#8e7a64','#7aa0b8'][Math.floor(R()*5)];g.fillRect(vx+Math.cos(a)*d,vy+Math.sin(a)*d,14+R()*26,12+R()*20);}}
  // nallahs and ponds
  g.strokeStyle='#4f6b6a';g.lineWidth=40;g.lineCap='round';for(let k=0;k<3;k++){g.beginPath();let x=TX0,y=TY0+R()*TH;g.moveTo(x,y);while(x<TX0+TW){x+=600+R()*600;y+=(R()-0.5)*900;g.lineTo(x,y);}g.stroke();}
  for(let i=0;i<14;i++){g.fillStyle='#46625f';g.beginPath();g.ellipse(TX0+R()*TW,TY0+R()*TH,120+R()*300,80+R()*200,R()*3,0,7);g.fill();}
  // airport ground: graded, dry grass
  g.fillStyle='#a69a6c';g.fillRect(EXT.x0-200,EXT.y0-200,EXT.x1-EXT.x0+400,EXT.y1-EXT.y0+400);
  for(let i=0;i<5000;i++){const x=EXT.x0+R()*(EXT.x1-EXT.x0),y=EXT.y0+R()*(EXT.y1-EXT.y0);g.fillStyle=R()<.5?'rgba(130,140,80,.25)':'rgba(190,170,120,.22)';g.fillRect(x,y,40+R()*120,14+R()*40);}
  g.strokeStyle='rgba(240,240,230,.5)';g.lineWidth=10;g.setLineDash([60,40]);g.strokeRect(EXT.x0-200,EXT.y0-200,EXT.x1-EXT.x0+400,EXT.y1-EXT.y0+400);g.setLineDash([]);
  // landside roads and rail
  for(const l of SPEC.landside||[]){g.strokeStyle=l.kind==='rail'?'#4a4a52':'#5d5a54';g.lineWidth=l.kind==='rail'?26:40;g.beginPath();l.pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.stroke();if(l.kind==='rail'){g.strokeStyle='#9aa0a6';g.lineWidth=4;g.setLineDash([30,20]);g.stroke();g.setLineDash([]);}}
}

/* ============ sprites & aircraft drawing ============ */
function sprite(rgb){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,`rgba(${rgb},1)`);gr.addColorStop(.16,`rgba(${rgb},.8)`);gr.addColorStop(.42,`rgba(${rgb},.2)`);gr.addColorStop(1,`rgba(${rgb},0)`);g.fillStyle=gr;g.fillRect(0,0,64,64);return c;}
const SPR={w:sprite('255,246,226'),g:sprite('90,255,150'),r:sprite('255,64,50'),b:sprite('90,150,255'),a:sprite('255,170,50'),y:sprite('255,214,140')};
function glow(s,x,y,r,a){ctx.globalAlpha=a;ctx.drawImage(s,x-r,y-r,r*2,r*2);}
function planeShape(f,L,Sp,fw,col){
  const T_=f.T,prop=T_.prop;const wx=L*(prop?0.02:0.08),sweep=prop?L*0.02:(T_.code==='C'?0.2:0.26)*L,tip=L*(prop?0.08:0.07),root=L*(prop?0.12:0.25);
  ctx.fillStyle=col?col.wing:'#000';ctx.beginPath();ctx.moveTo(wx,-fw*0.45);ctx.lineTo(wx-sweep,-Sp/2);ctx.lineTo(wx-sweep-tip,-Sp/2);ctx.lineTo(wx-root,-fw*0.45);ctx.lineTo(wx-root,fw*0.45);ctx.lineTo(wx-sweep-tip,Sp/2);ctx.lineTo(wx-sweep,Sp/2);ctx.lineTo(wx,fw*0.45);ctx.closePath();ctx.fill();
  const tx=-L*0.35,ts=Sp*(T_.code==='F'?0.19:0.17);ctx.beginPath();ctx.moveTo(tx,-fw*0.3);ctx.lineTo(tx-L*0.08,-ts);ctx.lineTo(tx-L*0.12,-ts);ctx.lineTo(tx-L*0.12,ts);ctx.lineTo(tx-L*0.08,ts);ctx.lineTo(tx,fw*0.3);ctx.closePath();ctx.fill();
  if(col&&L>14){ctx.fillStyle=col.eng;const eng=fr=>{const ey=Sp/2*fr,ex=wx-sweep*fr+L*(prop?0.07:0.03);ctx.beginPath();ctx.ellipse(ex,ey,L*0.055,Math.max(1,fw*0.36),0,0,7);ctx.fill();ctx.beginPath();ctx.ellipse(ex,-ey,L*0.055,Math.max(1,fw*0.36),0,0,7);ctx.fill();};eng(prop?0.3:0.34);if(T_.eng===4)eng(0.62);}
  ctx.fillStyle=col?col.body:'#000';rr(ctx,-L/2,-fw/2,L,fw,fw/2);ctx.fill();
  if(col){ctx.fillStyle=col.tail;rr(ctx,-L/2,-fw*0.24,L*0.2,fw*0.48,fw*0.2);ctx.fill();}
}
let EXs=2.6,nightF=0;
const ENG=new Set(['inbound','holding','approach','rollout','taxi_in','dock','nogate','push','start','taxi_out','hp','lineup','roll','goaround','divert']);
function drawPlane(f,now){
  const X=sx(f.x),Y=sy(f.y);f.sx=X;f.sy=Y;const altK=1+f.alt/2600;const k=EXs*cam.s*altK;const L=f.T.len*k,Sp=f.T.span*k,fw=Math.max(1.6,f.T.len*0.075*k);f.sr=Math.max(L,Sp)/2;
  if(X<-120||Y<-120||X>VW+120||Y>VH+120)return;
  if(L<5){ctx.fillStyle=f.alt>2?'#f4f6f7':'#e6e8e9';ctx.fillRect(X-1.5,Y-1.5,3,3);if(f===selected){ctx.strokeStyle='#f4c430';ctx.beginPath();ctx.arc(X,Y,7,0,7);ctx.stroke();}return;}
  const sh=f.alt>2?Math.min(60,3+f.alt*0.03)*cam.s/cam.fit:1.6*cam.s/cam.fit;
  ctx.save();ctx.translate(X+sh*0.8,Y+sh*0.5);ctx.rotate(f.heading);ctx.globalAlpha=f.alt>2?0.18:0.24*(1-nightF*0.6);planeShape(f,L/altK,Sp/altK,fw/altK);ctx.restore();ctx.globalAlpha=1;
  ctx.save();ctx.translate(X,Y);ctx.rotate(f.heading);
  if(f===selected||f===hover){ctx.strokeStyle=f===selected?'#f4c430':'rgba(244,196,48,.6)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,f.sr+5,0,7);ctx.stroke();}
  planeShape(f,L,Sp,fw,{body:'#f4f6f7',wing:'#d4d9dc',eng:'#9aa2a8',tail:f.A.tail});
  if(f.state==='roll'&&f.alt<60){ctx.strokeStyle=dustNow?'rgba(200,160,110,.6)':'rgba(255,255,255,.3)';ctx.lineWidth=Math.max(1,fw*0.5);const ln=f.v*0.5*k;ctx.beginPath();ctx.moveTo(-L*0.1,Sp*0.17);ctx.lineTo(-L*0.1-ln,Sp*0.17);ctx.moveTo(-L*0.1,-Sp*0.17);ctx.lineTo(-L*0.1-ln,-Sp*0.17);ctx.stroke();}
  ctx.restore();
  if(nightF>0.15&&ENG.has(f.state)){const c=Math.cos(f.heading),s=Math.sin(f.heading);const tipX=L*0.08-(f.T.code==='C'?0.2:0.26)*L;const P=(lx,ly)=>[X+lx*c-ly*s,Y+lx*s+ly*c];ctx.globalCompositeOperation='lighter';const l=P(tipX,-Sp/2),r=P(tipX,Sp/2);glow(SPR.r,l[0],l[1],4,0.9*nightF);glow(SPR.g,r[0],r[1],4,0.9*nightF);if(Math.sin(now*6.3+f.id)>0.6){const b=P(0,0);glow(SPR.r,b[0],b[1],6,0.9);}if(['approach','roll','lineup','rollout'].includes(f.state)){const n=P(L/2+6,0);glow(SPR.w,n[0],n[1],9,0.8*nightF);}ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}
}
function drawTag(f){
  if(f.sx==null)return;let l2=f.type;switch(f.state){case 'approach':l2+=` · final ${f.rwy.short}`;break;case 'holding':l2+=` · ${Math.round(f.endurance)}m fuel`;break;case 'taxi_in':l2+=` · gate ${f.res?f.res.id:''}`;break;case 'taxi_out':case 'hp':l2+=` · ${f.rwy?f.rwy.short:'no rwy'}`;break;case 'roll':case 'lineup':l2+=` · ${f.toCode}`;break;case 'at_gate':l2+=` · ${clk(f.std)}`;break;}
  const l1=fl(f);const X=f.sx+Math.max(6,f.sr*0.7)+4,Y=f.sy-Math.max(6,f.sr*0.7)-26;ctx.font='600 10.5px JetBrains Mono, monospace';const w1=ctx.measureText(l1).width;ctx.font='400 9.5px JetBrains Mono, monospace';const w2=ctx.measureText(l2).width;const w=Math.max(w1,w2)+14,h=27;
  ctx.strokeStyle='rgba(20,20,20,.5)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(f.sx,f.sy);ctx.lineTo(X,Y+h);ctx.stroke();ctx.fillStyle='rgba(8,11,13,.86)';rr(ctx,X,Y,w,h,3);ctx.fill();ctx.fillStyle=f.A.tail;ctx.fillRect(X,Y,3,h);ctx.fillStyle='#ece7da';ctx.font='600 10.5px JetBrains Mono, monospace';ctx.fillText(l1,X+7,Y+11);ctx.fillStyle='#a6afb4';ctx.font='400 9.5px JetBrains Mono, monospace';ctx.fillText(l2,X+7,Y+23);
}

/* ============ map drawing ============ */
const LIGHT={dawn:{tint:'rgba(255,170,110,.10)',dark:0.28},day:{tint:null,dark:0},heat:{tint:'rgba(255,190,120,.16)',dark:0},dusk:{tint:'rgba(20,24,48,.0)',dark:0}};
function worldT(){ctx.setTransform(DPR*cam.s,0,0,DPR*cam.s,-cam.x*cam.s*DPR,-cam.y*cam.s*DPR);}
function screenT(){ctx.setTransform(DPR,0,0,DPR,0,0);}
function drawAirfield(now){
  worldT();const z=cam.s/cam.fit;const px=1/cam.s;
  for(const p of APRONS){ctx.fillStyle='#b9b5aa';ctx.fill(p);}
  // taxiways
  ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#5a5d60';ctx.lineWidth=24;
  for(const t of TWY){ctx.beginPath();t.pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}
  if(z>2.2){ctx.strokeStyle='#e5b62a';ctx.lineWidth=Math.max(1.2*px,0.9);for(const t of TWY){ctx.beginPath();t.pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}}
  // exits
  ctx.strokeStyle='#5a5d60';ctx.lineWidth=24;for(const r of RW)for(const e of r.exits){const to=G.get(e.to);ctx.beginPath();ctx.moveTo(e.x+250,r.y);ctx.lineTo(e.x,r.y);ctx.lineTo(to.x,to.y);ctx.stroke();}
  // runways
  for(const r of RW){const w=r.width;ctx.fillStyle='#45484b';ctx.fillRect(r.x0,r.y-w/2-8,r.len,w+16);ctx.fillStyle=r.locked?'#3a3c3e':'#2f3133';ctx.fillRect(r.x0,r.y-w/2,r.len,w);
    if(z>1.4){ctx.fillStyle='rgba(245,245,240,.9)';ctx.fillRect(r.x0,r.y-w/2+1,r.len,1.5);ctx.fillRect(r.x0,r.y+w/2-2.5,r.len,1.5);for(let x=r.x0+200;x<r.x1-200;x+=60)ctx.fillRect(x,r.y-0.9,34,1.8);
      for(const x0 of[r.x0+6,r.x1-46])for(let i=0;i<8;i++){const o=3+i*(w/2-6)/8;ctx.fillRect(x0,r.y-o-1.6,40,1.6);ctx.fillRect(x0,r.y+o,40,1.6);}
      ctx.fillRect(r.x1-460,r.y-12,55,6);ctx.fillRect(r.x1-460,r.y+6,55,6);ctx.fillRect(r.x0+400,r.y-12,55,6);ctx.fillRect(r.x0+400,r.y+6,55,6);
      ctx.save();ctx.translate(r.x1-110,r.y);ctx.rotate(Math.PI/2);ctx.font='600 26px Barlow Condensed, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(r.short,0,0);ctx.restore();
      ctx.save();ctx.translate(r.x0+110,r.y);ctx.rotate(-Math.PI/2);ctx.font='600 26px Barlow Condensed, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(r.name.split('/')[0],0,0);ctx.restore();}
    // mode wash
    const col=r.locked?null:T<r.closedUntil||blockAt(r,T)?'rgba(255,77,63,.35)':T<r.changeUntil?'rgba(255,174,59,.28)':r.mode==='ARR'?'rgba(138,124,255,.26)':r.mode==='DEP'?'rgba(47,211,198,.24)':r.mode==='MIX'?'rgba(244,196,48,.24)':'rgba(0,0,0,.35)';
    if(col){ctx.fillStyle=col;ctx.fillRect(r.x0,r.y-w/2-8,r.len,w+16);}
    if(r===selRw){ctx.strokeStyle='#f4c430';ctx.lineWidth=3*px;ctx.strokeRect(r.x0-20,r.y-w/2-24,r.len+40,w+48);}
    if(T<r.closedUntil&&z>1){ctx.fillStyle='rgba(255,255,255,.95)';for(const ss of[0.2,0.5,0.8]){const x=lerp(r.x0,r.x1,ss);ctx.save();ctx.translate(x,r.y);for(const a of[Math.PI/4,-Math.PI/4]){ctx.save();ctx.rotate(a);ctx.fillRect(-32,-4,64,8);ctx.restore();}ctx.restore();}}
  }
  // apm
  if(SPEC.apm&&SPEC.apm.pts){ctx.strokeStyle='rgba(106,163,255,.55)';ctx.lineWidth=Math.max(10,2.2*px);ctx.setLineDash([60,40]);ctx.beginPath();SPEC.apm.pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();ctx.setLineDash([]);}
  // buildings
  for(const b of BLD){if(!b.p)continue;ctx.fillStyle=b.kind==='processor'?'#dcd6c8':b.kind==='tower'?'#c9cfd4':b.kind==='fire'?'#b8423a':b.kind==='cargo'?'#9c958a':b.kind==='mro'?'#a9a49a':b.kind==='fuel'?'#9a978e':b.kind==='rail'?'#7f8790':'#b8b2a6';ctx.fill(b.p);ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=2*px;ctx.stroke(b.p);}
  for(const c of CONC){if(!c.path)continue;const open=c.open!==false;ctx.fillStyle=open?'#e4dfd2':'#8b877f';ctx.fill(c.path);ctx.strokeStyle=open?'rgba(120,100,60,.45)':'rgba(0,0,0,.3)';ctx.lineWidth=3*px;ctx.stroke(c.path);}
  const RF=SPEC.roof;if(RF){
    if(z>1.6){ctx.fillStyle='rgba(120,170,200,.55)';const k=z>3.5?1:2;for(let i=0;i<RF.skylights.length;i+=k){const q=RF.skylights[i];ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.a*D2R);ctx.fillRect(-q.l/2,-q.w/2,q.l,q.w);ctx.restore();}}
    for(const g of RF.gardens){ctx.fillStyle=g.kind==='belt'?'rgba(86,130,70,.75)':'rgba(96,142,74,.8)';if(g.kind==='belt')ctx.fillRect(g.x-g.w/2,g.y-g.l/2,g.w,g.l);else{ctx.beginPath();ctx.arc(g.x,g.y,g.r,0,7);ctx.fill();}}
    const o=RF.oculus;ctx.fillStyle='#cfe8f2';ctx.beginPath();ctx.arc(o.x,o.y,o.r*0.62,0,7);ctx.fill();ctx.fillStyle='#f4c430';ctx.beginPath();ctx.arc(o.x,o.y,Math.max(6,3*px),0,7);ctx.fill();
    if(z>2.2){ctx.strokeStyle='rgba(160,120,70,.7)';ctx.lineWidth=Math.max(2,1.4*px);ctx.setLineDash([6,5]);for(const j of RF.jaali){ctx.beginPath();j.pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();}ctx.setLineDash([]);}
  }
  // stands
  if(z>3){ctx.strokeStyle='rgba(217,169,31,.8)';ctx.lineWidth=1.2*px;for(const g of GATES){if(!g.open)continue;const L=G.get(g.lane);ctx.beginPath();ctx.moveTo(L.x,L.y);ctx.lineTo(g.x+Math.cos(g.a)*30,g.y+Math.sin(g.a)*30);ctx.stroke();}}
  if(z>4.5){ctx.font='600 13px Barlow Condensed, sans-serif';ctx.fillStyle='rgba(30,30,30,.65)';ctx.textAlign='center';ctx.textBaseline='middle';for(const g of GATES){if(!g.open)continue;ctx.fillText(g.id,g.x-Math.cos(g.a)*52,g.y-Math.sin(g.a)*52);}}
  // runway & taxi lights
  const la=Math.max(nightF,dustNow?0.6:0,LV&&LV.light==='dawn'?Math.max(0,0.7-T/1800):0);
  screenT();
  if(la>0.05){ctx.globalCompositeOperation='lighter';const rad=Math.max(1.6,2.4*Math.sqrt(z));for(const r of RW){if(r.locked||r.mode==='OFF')continue;const step=z>3?60:z>1.5?120:240;for(let x=r.x0;x<=r.x1;x+=step){for(const o of[-r.width/2-3,r.width/2+3])glow(SPR.w,sx(x),sy(r.y+o),rad,.5*la);}
      for(let o=-r.width/2;o<=r.width/2;o+=z>2?6:15){glow(SPR.g,sx(r.x1+2),sy(r.y+o),rad,.85*la);glow(SPR.r,sx(r.x0-2),sy(r.y+o),rad,.85*la);}
      if(r.mode!=='DEP'){const seq=Math.floor(now*14)%30;if(seq<30)glow(SPR.w,sx(r.x1+900-seq*30),sy(r.y),rad*3,la);for(let x=r.x1;x<r.x1+900;x+=60)glow(SPR.w,sx(x),sy(r.y),rad*.8,.35*la);}}
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}
}
function signText(x,y,t,a,col){ctx.globalAlpha=a;ctx.font='700 12px Barlow Condensed, Arial Narrow, sans-serif';const w=ctx.measureText(t).width+12;ctx.fillStyle='#0b0b0b';ctx.fillRect(x-w/2,y-9,w,18);ctx.strokeStyle=col||'#f4c430';ctx.lineWidth=1.5;ctx.strokeRect(x-w/2+1.5,y-7.5,w-3,15);ctx.fillStyle=col||'#f4c430';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t,x,y+1);ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.globalAlpha=1;return{x:x-w/2,y:y-9,w,h:18};}
// ops vehicles: airside-yellow with an amber beacon; a ring when zoomed out so you can see the teams at work
function drawVeh(x,y,a,len,col,now,beacon,label){const X=sx(x),Y=sy(y);if(X<-40||Y<-40||X>VW+40||Y>VH+40)return;const z=cam.s/cam.fit,L=Math.max(7,len*cam.s*EXs),W=L*0.45;
  ctx.save();ctx.translate(X,Y);ctx.rotate(a);ctx.fillStyle=col;rr(ctx,-L/2,-W/2,L,W,W*0.25);ctx.fill();ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(L*0.08,-W/2+1,L*0.22,W-2);ctx.restore();
  if(beacon&&Math.sin(now*10+x*0.01)>0){ctx.globalCompositeOperation='lighter';glow(SPR.a,X,Y,Math.max(7,L*0.9),0.9);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}
  if(z<2.2){ctx.strokeStyle='rgba(255,174,59,.75)';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(X,Y,8+2*Math.sin(now*4),0,7);ctx.stroke();}
  else if(label&&z>2.6){ctx.font='600 11px Barlow Condensed, sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='rgba(10,12,14,.8)';ctx.strokeText(label,X,Y-L*0.6-6);ctx.fillStyle='#ffd27a';ctx.fillText(label,X,Y-L*0.6-6);ctx.textAlign='left';}}
function drawOps(now){
  for(const o of ops){
    if(o.kind==='birds'){const k=clamp((T-o.t0)/60,0,1);drawVeh(lerp(o.sx,o.x,k),o.y,Math.PI,5,'#f4c430',now,true,'Wildlife patrol');
      const sc=clamp((T-o.t0-50)/70,0,1);if(sc<1){ctx.strokeStyle=`rgba(28,24,20,${0.9*(1-sc)})`;ctx.lineWidth=1.3;const base=Math.max(9,60*cam.s),w=Math.max(2.5,5*cam.s*EXs);
        for(let i=0;i<9;i++){const an=now*(0.7+i*0.05)+i*0.7,rad=base*(0.5+0.06*i)*(1+sc*5);const bx=sx(o.x)+Math.cos(an)*rad,by=sy(o.y)+Math.sin(an)*rad*0.55-base*sc*3,fl=Math.sin(now*14+i)*w*0.4;
          ctx.beginPath();ctx.moveTo(bx-w,by-w*0.4+fl);ctx.lineTo(bx,by);ctx.lineTo(bx+w,by-w*0.4+fl);ctx.stroke();}}}
    else if(o.kind==='fod'){const r=o.r;if(o.phase==='wait'){drawVeh(r.x1+140,r.y+(r.y<0?-110:110),Math.PI,9,'#f4c430',now,true,'Sweeper: waiting for a gap');const X=sx(o.x),Y=sy(r.y);ctx.fillStyle='#ff4d3f';ctx.beginPath();ctx.arc(X,Y,Math.max(2,6*cam.s*EXs),0,7);ctx.fill();}
      else drawVeh(lerp(r.x1-60,r.x0+60,clamp((T-o.ts)/OPSW,0,1)),r.y,Math.PI,9,'#f4c430',now,true,'Sweeper');}
    else if(o.kind==='tug'){const f=o.f,a=f.heading,k=clamp((T-o.t0)/60,0,1),d=f.T.len*0.55*EXs/2.6;drawVeh(lerp(o.sx,f.x+Math.cos(a)*d,k),lerp(o.sy,f.y+Math.sin(a)*d,k),a,7,'#f4c430',now,true,'Tug');}
  }
  for(const c of CONC){if(c.laneShut>T||c.slowUntil>T)drawVeh(c.lx,c.ly,Math.PI/2,7,c.laneShut>T?'#ff4d3f':'#ffae3b',now,true,c.laneShut>T?'Recovery: lane shut':'Dead tug: slow pushbacks');}
  drawMarks(ctx,(x,y)=>({X:sx(x),Y:sy(y)}),now);
}
const mmss=s=>{s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
let rwSigns=[];
function rwSign(r){const bk=r.blocks[0];const lbl=(r.locked?'NOT YET OPEN':T<r.closedUntil?`CLOSED · ${r.why.toUpperCase()}`:blockAt(r,T)?(ab=>`CLOSED · ${ab.why.toUpperCase()}${ab.open?'':' '+mmss(ab.to-T)}`)(r.blocks.find(b=>T>=b.from&&T<b.to)||bk):T<r.changeUntil?`CHANGEOVER → ${r.mode}`:r.mode==='ARR'?'ARRIVALS':r.mode==='DEP'?'DEPARTURES':r.mode==='MIX'?'MIXED':'CLOSED')+(r.locked?'':bk&&T<bk.from?` · VVIP IN ${mmss(bk.from-T)}`:r.degraded?' · LIGHTS OUT':r.gapReq?' · GAP FOR SWEEPER':'');const col=r.locked?'#6f7a80':T<r.closedUntil||blockAt(r,T)?'#ff4d3f':r.mode==='ARR'?'#8a7cff':r.mode==='DEP'?'#2fd3c6':r.mode==='MIX'?'#f4c430':'#a6afb4';return{lbl,col};}
const dustP=[];{const r=mulberry(3);for(let i=0;i<500;i++)dustP.push({x:r(),y:r(),v:.6+r()*.8,s:1+r()*3});}
function draw(now){
  screenT();ctx.fillStyle='#6b5d47';ctx.fillRect(0,0,VW,VH);
  if(TERR){const k=TRES;const x0=Math.max(TX0,cam.x),y0=Math.max(TY0,cam.y),x1=Math.min(TX0+TW,cam.x+VW/cam.s),y1=Math.min(TY0+TH,cam.y+VH/cam.s);if(x1>x0&&y1>y0){ctx.imageSmoothingQuality='high';ctx.drawImage(TERR,(x0-TX0)*k,(y0-TY0)*k,(x1-x0)*k,(y1-y0)*k,sx(x0),sy(y0),(x1-x0)*cam.s,(y1-y0)*cam.s);}}
  const z=cam.s/cam.fit;EXs=clamp(2.6*Math.pow(1/z,0.55),0.95,2.6);
  if(LV){nightF=LV.light==='dusk'?clamp((T-600)/2400,0,1):LV.light==='dawn'?clamp(0.6-T/1500,0,0.6):0;}
  drawAirfield(now);
  screenT();
  // darkness overlay before lights/aircraft
  if(nightF>0){ctx.fillStyle=`rgba(10,14,32,${0.5*nightF})`;ctx.fillRect(0,0,VW,VH);}
  if(LV&&LIGHT[LV.light].tint){ctx.fillStyle=LIGHT[LV.light].tint;ctx.fillRect(0,0,VW,VH);}
  if(nightF>0.15){ctx.globalCompositeOperation='lighter';for(const c of CONC){if(c.open===false)continue;for(const g of c.gates)glow(SPR.y,sx(g.x),sy(g.y),Math.max(6,40*cam.s),.16*nightF);}ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}
  // stacks
  for(const st of STACKS){const hs=flights.filter(f=>f.state==='holding'&&f.stack===st);ctx.strokeStyle=hs.length?'rgba(255,214,60,.85)':'rgba(255,214,60,.35)';ctx.lineWidth=1.3;ctx.setLineDash([5,5]);ctx.beginPath();for(let u=0;u<=4*1100+2*Math.PI*560;u+=200){const p=stackPos(st,u,0);u?ctx.lineTo(sx(p.x),sy(p.y)):ctx.moveTo(sx(p.x),sy(p.y));}ctx.closePath();ctx.stroke();ctx.setLineDash([]);
    if(hs.length){signText(sx(st.x),sy(st.y-1100-900),`STACK ${st.id} · ${hs.length}`,1,hs.some(f=>f.minFuel)?'#ff4d3f':'#f4c430');}}
  const vis=flights.filter(f=>!['sched','diverted','gone','cancelled','towed'].includes(f.state));
  const ground=vis.filter(f=>f.alt<=2),air=vis.filter(f=>f.alt>2).sort((a,b)=>a.alt-b.alt);
  for(const f of ground){if(f.state==='at_gate'&&f.kind==='dep'&&z>1.6){const late=T>f.std;if(late||f.std-T<600){ctx.strokeStyle=late?'#ff4d3f':'#3ad07f';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(sx(f.x),sy(f.y),Math.max(5,f.T.span*EXs*cam.s*0.45),0,7);ctx.stroke();}}drawPlane(f,now);}
  const nowS=performance.now()/1000;for(let i=puffs.length-1;i>=0;i--){const p=puffs[i];const age=nowS-p.t;if(age>1.5){puffs.splice(i,1);continue;}if(age<0)continue;ctx.fillStyle=`rgba(225,230,235,${0.6*(1-age/1.5)})`;ctx.beginPath();ctx.arc(sx(p.x),sy(p.y),2+age*8*z,0,7);ctx.fill();}
  for(const f of air){if(f.trail.length>1&&z<4){ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=1;ctx.beginPath();f.trail.forEach((p,i)=>i?ctx.lineTo(sx(p.x),sy(p.y)):ctx.moveTo(sx(p.x),sy(p.y)));ctx.lineTo(sx(f.x),sy(f.y));ctx.stroke();}}
  for(const f of air)drawPlane(f,now);
  drawOps(now);
  for(const f of vis){if(!f.mayday||f.landT!=null)continue;const X=sx(f.x),Y=sy(f.y),p=(now*1.4)%1;ctx.strokeStyle=`rgba(255,77,63,${1-p})`;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(X,Y,10+p*28,0,7);ctx.stroke();ctx.globalCompositeOperation='lighter';glow(SPR.r,X,Y,16,0.75+0.25*Math.sin(now*12));ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;signText(X,Y-30,`MAYDAY ${fl(f)}`,1,'#ff4d3f');}
  // dust storm
  if(dustNow){ctx.fillStyle='rgba(170,120,70,.32)';ctx.fillRect(0,0,VW,VH);ctx.fillStyle='rgba(220,180,130,.45)';for(const p of dustP){const x=((p.x*VW-now*220*p.v)%VW+VW)%VW,y=p.y*VH;ctx.fillRect(x,y,p.s*6,p.s);}}
  if(LV&&LV.light==='heat'){const a=0.06+0.03*Math.sin(now*2);ctx.fillStyle=`rgba(255,220,170,${a})`;ctx.fillRect(0,0,VW,VH);}
  // runway signs
  rwSigns=[];for(const r of RW){const {lbl,col}=rwSign(r);
    const X=sx(r.x0+r.len*0.18),Y=sy(r.y)-Math.max(14,r.width*cam.s/2+12);const rect=signText(X,Y,`${r.short} · ${lbl}`,r.locked?.6:1,col);rect.r=r;rwSigns.push(rect);}
  
  // incident markers
  for(const I of incidents){const p=incPos(I);const X=sx(p.x),Y=sy(p.y);const ic=I.icon||ICON[I.type];const pulse=1+0.18*Math.sin(now*7);const R=13*pulse;
    ctx.fillStyle='rgba(0,0,0,.55)';ctx.beginPath();ctx.arc(X,Y,R+5,0,7);ctx.fill();ctx.strokeStyle=ic.c;ctx.lineWidth=3;ctx.beginPath();ctx.arc(X,Y,R+3,-Math.PI/2,-Math.PI/2+2*Math.PI*clamp(I.left/I.total,0,1));ctx.stroke();
    ctx.fillStyle=ic.c;ctx.beginPath();ctx.arc(X,Y,R-2,0,7);ctx.fill();ctx.fillStyle='#0b0b0b';ctx.font='700 15px Barlow Condensed, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(ic.g,X,Y+1);ctx.textAlign='left';ctx.textBaseline='alphabetic';I.sx=X;I.sy=Y;}
  // tags
  const tagged=new Set();if(selected)tagged.add(selected);if(hover)tagged.add(hover);
  if(z>3.2){let n=0;for(const f of vis){if(n>30)break;if(['approach','rollout','taxi_in','taxi_out','hp','lineup','roll','nogate'].includes(f.state)&&f.sx>0&&f.sx<VW&&f.sy>0&&f.sy<VH){tagged.add(f);n++;}}}
  for(const f of tagged)if(vis.includes(f))drawTag(f);
  if(popInc){const p=incPos(popInc);placePop(sx(p.x),sy(p.y));}
  drawFloats(q=>({X:sx(q.x),Y:sy(q.y)}));
}

/* ============ bank chart ============ */
function capNow(kind,ov,at){const tt=at==null?T:at;let c=0;for(const r of RW){const md=ov&&ov.r===r?ov.m:r.mode;if(r.locked||tt<r.closedUntil||blockAt(r,tt))continue;const dg=(r.degraded?1.6:1)*(tt<r.sepUntil?r.sepK:1);if(kind==='arr'){if(md==='ARR')c+=3600/(SEP_AA*sepF()*dg+6);else if(md==='MIX')c+=3600/(SEP_AA*sepF()*dg+MIX_GAP+6)*1;}else{if(md==='DEP')c+=3600/(SEP_DD*(dustNow?1.15:1)+4);else if(md==='MIX')c+=3600/(SEP_AA*sepF()+MIX_GAP+6);}}return c;}
// forecast: what the holding stack and the departure queue do from now if the setup stays (or with one runway flipped)
let WAVEP=null,WBINS=null;
function forecast(A,D,cur,nb,B,t0,ov){let b=flights.filter(f=>f.state==='holding').length,q=flights.filter(f=>f.state==='hp'||f.state==='taxi_out').length;const out=[];
  for(let i=Math.max(0,cur);i<nb&&t0+i*B<LEN;i++){const rf=i===cur?clamp((t0+(i+1)*B-T)/B,0,1):1,tm=Math.max(T,t0+(i+0.5)*B),cA=capNow('arr',ov,tm)*B/3600,cD=capNow('dep',ov,tm)*B/3600;b=Math.max(0,b+A[i]-cA*rf);q=Math.max(0,q+D[i]-cD*rf);out.push({i,b,q});}return out;}
function drawWave(){
  const W=wcv.width/DPR,H=wcv.height/DPR;if(!W)return;wctx.setTransform(DPR,0,0,DPR,0,0);wctx.clearRect(0,0,W,H);
  const B=300,t0=Math.floor((T-1200)/B)*B,t1=t0+B*20;const nb=(t1-t0)/B;const bw=(W-40)/nb;const X=t=>36+(t-t0)/(t1-t0)*(W-40);const mid=H/2;
  const A=new Array(nb).fill(0),D=new Array(nb).fill(0),Aa=new Array(nb).fill(0),Da=new Array(nb).fill(0);
  for(const f of flights){
    if(f.landT!=null){const i=Math.floor((f.landT-t0)/B);if(i>=0&&i<nb)Aa[i]++;}
    else if(f.kind==='arr'&&!['diverted','divert'].includes(f.state)){const t=Math.max(f.eta,T);const i=Math.floor((t-t0)/B);if(i>=0&&i<nb)A[i]++;}
    if(f.rollT!=null&&(f.state==='roll'||f.state==='climb'||f.state==='gone')){const i=Math.floor((f.rollT-t0)/B);if(i>=0&&i<nb)Da[i]++;}
    else if(f.kind==='dep'&&!['gone','cancelled','roll','lineup'].includes(f.state)){const t=Math.max(f.std,T);const i=Math.floor((t-t0)/B);if(i>=0&&i<nb)D[i]++;}
    else if(f.kind==='arr'&&f.turn&&f.landT==null){const i=Math.floor((Math.max(f.turn.std,T)-t0)/B);if(i>=0&&i<nb)D[i]++;}
  }
  const cur=Math.floor((T-t0)/B);const fa=A.filter((_,i)=>i!==cur),fd=D.filter((_,i)=>i!==cur);
  const mx=Math.max(6,...fa,...fd,...Aa,...Da,capNow('arr')*B/3600,capNow('dep')*B/3600)*1.15;const sc=(mid-8)/mx;
  wctx.font='500 10px JetBrains Mono, monospace';wctx.textBaseline='middle';
  for(let i=0;i<nb;i++){const x=X(t0+i*B)+1,w=bw-2;const past=t0+(i+1)*B<=T;
    const va=past?Aa[i]:A[i]+(i===cur?Aa[i]:0),vd=past?Da[i]:D[i]+(i===cur?Da[i]:0);const ha=Math.min(mid-2,va*sc),hd=Math.min(mid-2,vd*sc);
    wctx.fillStyle=past?'rgba(138,124,255,.35)':'#8a7cff';wctx.fillRect(x,mid-ha,w,ha);
    wctx.fillStyle=past?'rgba(47,211,198,.35)':'#2fd3c6';wctx.fillRect(x,mid,w,hd);
    if(i===cur){wctx.fillStyle='#0b0b0b';wctx.textAlign='center';if(va*sc>mid-2){wctx.fillRect(x,2,w,13);wctx.fillStyle='#b8adff';wctx.fillText(va+' due now',x+w/2,9);}if(vd*sc>mid-2){wctx.fillStyle='#0b0b0b';wctx.fillRect(x,mid+3,w,13);wctx.fillStyle='#7ff0e6';wctx.fillText(vd+' due now',x+w/2,mid+10);}wctx.textAlign='left';}}
  WBINS={t0,B,nb,X,W,A,D,Aa,Da};
  wctx.strokeStyle='rgba(255,255,255,.18)';wctx.beginPath();wctx.moveTo(36,mid);wctx.lineTo(W-4,mid);wctx.stroke();
  // capacity lines from now on
  const ca=capNow('arr')*B/3600*sc,cd=capNow('dep')*B/3600*sc;const xn=X(T);
  wctx.setLineDash([5,4]);wctx.lineWidth=2;wctx.strokeStyle='#b8adff';wctx.beginPath();wctx.moveTo(xn,mid-ca);wctx.lineTo(W-4,mid-ca);wctx.stroke();wctx.strokeStyle='#7ff0e6';wctx.beginPath();wctx.moveTo(xn,mid+cd);wctx.lineTo(W-4,mid+cd);wctx.stroke();wctx.setLineDash([]);wctx.lineWidth=1;
  // forecast curves: the stack above the axis, the departure queue below; a ghost set when a mode button is hovered
  const drawFc=(fc,dash,alpha,lbl)=>{const ys=v=>Math.min(mid-2,v*sc);wctx.setLineDash(dash);wctx.lineWidth=2.4;
    wctx.strokeStyle=`rgba(255,122,107,${alpha})`;wctx.beginPath();wctx.moveTo(xn,mid-ys(fc.length?fc[0].b:0));for(const p of fc)wctx.lineTo(X(t0+(p.i+1)*B),mid-ys(p.b));wctx.stroke();
    wctx.strokeStyle=`rgba(255,210,122,${alpha})`;wctx.beginPath();wctx.moveTo(xn,mid+ys(fc.length?fc[0].q:0));for(const p of fc)wctx.lineTo(X(t0+(p.i+1)*B),mid+ys(p.q));wctx.stroke();wctx.setLineDash([]);wctx.lineWidth=1;
    const pb=fc.reduce((a,p)=>p.b>a.b?p:a,{b:0,i:cur}),pq=fc.reduce((a,p)=>p.q>a.q?p:a,{q:0,i:cur});
    if(lbl){wctx.font='600 10.5px JetBrains Mono, monospace';if(pb.b>=4){const xx=Math.min(W-150,X(t0+(pb.i+1)*B)-60);wctx.fillStyle='rgba(8,11,13,.85)';wctx.fillRect(xx-3,Math.max(2,mid-ys(pb.b)-15),lbl==='now'?150:170,13);wctx.fillStyle=`rgba(255,140,125,${alpha})`;wctx.fillText(`${lbl==='now'?'':lbl+': '}stack ${Math.round(pb.b)} by ${clk(t0+(pb.i+1)*B)}`,xx,Math.max(8,mid-ys(pb.b)-8));}
      if(pq.q>=6){const xx=Math.min(W-150,X(t0+(pq.i+1)*B)-60);wctx.fillStyle='rgba(8,11,13,.85)';wctx.fillRect(xx-3,Math.min(H-28,mid+ys(pq.q)+2),lbl==='now'?150:170,13);wctx.fillStyle=`rgba(255,215,140,${alpha})`;wctx.fillText(`${lbl==='now'?'':lbl+': '}queue ${Math.round(pq.q)} by ${clk(t0+(pq.i+1)*B)}`,xx,Math.min(H-21,mid+ys(pq.q)+9));}wctx.font='500 10px JetBrains Mono, monospace';}};
  drawFc(forecast(A,D,cur,nb,B,t0,null),[],WAVEP?0.45:0.95,'now');
  if(WAVEP){const ca2=capNow('arr',WAVEP)*B/3600*sc,cd2=capNow('dep',WAVEP)*B/3600*sc;wctx.setLineDash([2,3]);wctx.lineWidth=2;wctx.strokeStyle='rgba(255,255,255,.85)';wctx.beginPath();wctx.moveTo(xn,mid-ca2);wctx.lineTo(W-4,mid-ca2);wctx.moveTo(xn,mid+cd2);wctx.lineTo(W-4,mid+cd2);wctx.stroke();wctx.setLineDash([]);wctx.lineWidth=1;
    drawFc(forecast(A,D,cur,nb,B,t0,WAVEP),[6,4],1,`if ${WAVEP.r.short} → ${WAVEP.m}`);}
  wctx.strokeStyle='#f4c430';wctx.lineWidth=1.5;wctx.beginPath();wctx.moveTo(xn,2);wctx.lineTo(xn,H-2);wctx.stroke();wctx.lineWidth=1;
  wctx.fillStyle='#6f7a80';for(let t=Math.ceil(t0/900)*900;t<t1;t+=900){const x=X(t);wctx.fillText(clk(t),x+2,H-6);}
  if(LV&&T0C+LEN){const xe=X(LEN);if(xe<W){wctx.fillStyle='rgba(255,255,255,.06)';wctx.fillRect(xe,0,W-xe,H);wctx.fillStyle='#6f7a80';wctx.fillText('END',xe+3,10);}}
  wctx.fillStyle='#8a7cff';wctx.fillText('ARR',2,12);wctx.fillStyle='#2fd3c6';wctx.fillText('DEP',2,H-12);
  const hold=flights.filter(f=>f.state==='holding').length,q=flights.filter(f=>f.state==='hp').length,taxi=flights.filter(f=>f.state==='taxi_out').length;
  $('#wCounts').innerHTML=`<span style="color:${hold>8?'var(--stop)':hold>3?'var(--warn)':'var(--ink-2)'}">${hold} holding</span> · <span style="color:${q>14?'var(--stop)':q>6?'var(--warn)':'var(--ink-2)'}">${q} queued to depart</span> · ${taxi} taxiing out · capacity ${Math.round(capNow('arr'))}↓ ${Math.round(capNow('dep'))}↑ per hr`;
}

(function(){const tip=document.createElement('div');tip.id='wTip';tip.className='panel';tip.hidden=true;$('#wave').appendChild(tip);
  wcv.addEventListener('mousemove',e=>{if(!WBINS||!LV)return;const r=wcv.getBoundingClientRect(),mx=e.clientX-r.left;const {t0,B,nb,X}=WBINS;let i=-1;for(let k=0;k<nb;k++){if(mx>=X(t0+k*B)&&mx<X(t0+(k+1)*B)){i=k;break;}}if(i<0){tip.hidden=true;return;}
    const a0=t0+i*B,a1=a0+B,arr=[],dep=[];for(const f of flights){const ta=f.landT!=null?f.landT:f.kind==='arr'&&!['diverted','divert'].includes(f.state)?Math.max(f.eta,T):null;if(ta!=null&&ta>=a0&&ta<a1)arr.push(f);
      const td=f.rollT!=null?f.rollT:f.kind==='dep'&&!['gone','cancelled'].includes(f.state)?Math.max(f.std,T):f.turn&&f.landT==null?Math.max(f.turn.std,T):null;if(td!=null&&td>=a0&&td<a1)dep.push(f);}
    const line=(list,lbl,c)=>list.length?`<div><b style="color:${c}">${list.length} ${lbl}</b> ${list.slice(0,7).map(f=>`<span class="mono">${f.turn&&f.landT==null&&lbl==='departures'?f.al+' '+f.turn.num:fl(f)}</span>`).join(' · ')}${list.length>7?` +${list.length-7}`:''}</div>`:'';
    tip.innerHTML=`<div class="mono" style="color:var(--ink-3)">${clk(a0)}–${clk(a1)}</div>${line(arr,'arrivals','var(--arr)')}${line(dep,'departures','var(--dep)')}`||'';tip.hidden=!arr.length&&!dep.length;tip.style.left=Math.min(r.width-330,Math.max(0,mx-150))+'px';});
  wcv.addEventListener('mouseleave',()=>{tip.hidden=true;});})();

/* ============ runway desk ============ */
function segHtml(r){return `<div class="seg" role="group" aria-label="Mode for runway ${r.short}">${['ARR','DEP','MIX','OFF'].map(m=>`<button data-m="${m}" class="${r.mode===m?'on':''}" ${r.locked?'disabled':''}>${m}</button>`).join('')}</div>`;}
function previewOn(b,r){b.onmouseenter=()=>{if(r.locked||r.mode===b.dataset.m)return;WAVEP={r,m:b.dataset.m};try{drawWave();}catch(e){}};b.onmouseleave=()=>{WAVEP=null;try{drawWave();}catch(e){}};}
function renderRw(){
  $('#rwRows').innerHTML=RW.map(r=>`<div class="rw ${r.locked?'locked':''} ${r===selRw?'sel':''}" data-r="${r.id}"><div class="nm">${r.short}<small>${(r.len/1000).toFixed(1)} km${r===LONGEST?' · long':''}</small></div>${segHtml(r)}<div class="st"></div></div>`).join('');
  $('#rwRows').querySelectorAll('.rw').forEach(row=>{const r=RW.find(x=>x.id===row.dataset.r);row.querySelectorAll('.seg button').forEach(b=>{b.onclick=()=>{WAVEP=null;setMode(r,b.dataset.m);explain('modes');};previewOn(b,r);});});
  rwStatus();
}
function rwStatus(){
  let a=0,d=0,m=0;RW.forEach(r=>{if(r.locked)return;if(r.mode==='ARR')a++;if(r.mode==='DEP')d++;if(r.mode==='MIX')m++;});$('#rwSum').textContent=`ARR ${a} · DEP ${d}${m?` · MIX ${m}`:''}`;
  document.querySelectorAll('#rwRows .rw').forEach(row=>{const r=RW.find(x=>x.id===row.dataset.r);const st=row.querySelector('.st');if(r.locked){st.textContent='Opens in a later level';return;}
    const fin=flights.filter(f=>f.state==='approach'&&f.rwy===r).length,q=flights.filter(f=>(f.state==='hp')&&f.rwy===r).length;
    let s='';const bk=r.blocks[0];if(T<r.closedUntil)s=`<span class="bad">closed ${Math.ceil((r.closedUntil-T)/60)} min · ${r.why}</span>`;else if(bk&&T>=bk.from)s=`<span class="bad">${bk.summit?'Taken by security':(bk.desk||'VVIP closure')}${bk.open?'':' · '+mmss(bk.to-T)}</span>`;else if(T<r.changeUntil)s=`<span class="hot">changeover ${Math.ceil((r.changeUntil-T)/60)} min</span>`;else s=`<b>${fin}</b> on final · <b class="${q>6?'hot':''}">${q}</b> queued · ${r.ops} ops`;
    const tags=[];if(bk&&T<bk.from)tags.push(`<span class="bad">VVIP in ${mmss(bk.from-T)}</span>`);if(r.degraded)tags.push('<span class="hot">lights out: slower landings</span>');if(T<r.sepUntil)tags.push(`<span class="hot">${r.sepWhy||'double spacing'}</span>`);if(r.kiteUntil>T)tags.push('<span class="hot">kites on final: go-arounds</span>');if(r.strike)tags.push('<span class="hot">bird remains: risk</span>');if(ops.some(o=>o.kind==='fod'&&o.r===r&&o.phase==='wait'))tags.push('<span class="hot">sweep pending</span>');if(r.shear)tags.push('<span class="hot">windshear</span>');st.innerHTML=s+(tags.length?' · '+tags.join(' · '):'');});
}

/* ============ HUD ============ */
function kpi(id,txt,cls){const el=$(id);el.querySelector('.v').innerHTML=txt;el.className='kpi '+(cls||'');}
const RATE={v:0};
function hud(){
  $('#clock').textContent=clk(T);$('#left').textContent=ended?'Level over':`${Math.max(0,Math.ceil((LEN-T)/60))} min left`;
  while(moveLog.length&&moveLog[0]<T-1800)moveLog.shift();
  const rate=Math.round(moveLog.length*2);
  kpi('#kMov',`${S.moves}<small>/${LV.target}</small>`,S.moves>=LV.target?'good':'');
  RATE.v+=(rate-RATE.v)*0.35;if(Math.abs(rate-RATE.v)<0.6)RATE.v=rate;kpi('#kRate',`${Math.round(RATE.v)}`,RATE.v>=250?'gold':'');
  const hold=flights.filter(f=>f.state==='holding').length;$('#vign').style.opacity=clamp((hold-6)/28,0,0.85).toFixed(2);
  const otp=S.dep+S.arr?Math.round((S.depOnTime+S.arrOnTime)/(S.dep+S.arr)*100):null;kpi('#kOtp',otp==null?'—':otp+'%',otp==null?'':otp>=85?'good':otp>=65?'mid':'bad');
  const ct=S.cnxMade+S.cnxMiss;const cx=ct?Math.round(S.cnxMade/ct*100):null;kpi('#kCnx',cx==null?'—':cx+'%',cx==null?'':cx>=90?'good':cx>=78?'mid':'bad');
  kpi('#kSafe',Math.round(S.safety),S.safety>=90?'good':S.safety>=70?'mid':'bad');
  rwStatus();incTimers();renderLate();if(popF)renderFlightPop();
}
let lastLate='';
function renderLate(){
  const rows=flights.filter(f=>(f.kind==='dep'&&['at_gate','taxi_out','hp','push','start','stuck'].includes(f.state)&&T>f.std-300)||(f.state==='holding'&&f.endurance<20)||f.state==='nogate').sort((a,b)=>(b.state==='holding'?1:0)-(a.state==='holding'?1:0)||(a.std||a.eta)-(b.std||b.eta)).slice(0,40);
  const late=flights.filter(f=>f.kind==='dep'&&['at_gate','taxi_out','hp','push','start','stuck'].includes(f.state)&&T>f.std+900).length;$('#lateCount').textContent=late||'';
  const h='<table class="board"><thead><tr><th>Flight</th><th>Time</th><th>Where</th><th>Status</th></tr></thead><tbody>'+rows.map(f=>{const late=f.kind==='dep'?mins(T-f.std):0;const c=f.state==='holding'||f.state==='nogate'?'#ffae3b':late>15?'#ff4d3f':late>0?'#ffae3b':'#3ad07f';return `<tr data-id="${f.id}"><td class="f">${fl(f)}<div class="sub">${f.type}</div></td><td class="f">${f.kind==='dep'?clk(f.std):clk(f.eta)}${late>0?`<div class="sub" style="color:var(--stop)">+${late}m</div>`:''}</td><td>${f.kind==='dep'?f.toCode:f.fromCode}</td><td><span class="pill" style="background:${c};color:#0b0b0b">${stateText(f)}</span></td></tr>`;}).join('')+'</tbody></table>';
  if(h!==lastLate){$('#tabLate').innerHTML=rows.length?h:'<p style="padding:9px 10px;color:var(--ink-3);font-size:12.5px;margin:0">Nothing late or at risk.</p>';lastLate=h;}
}
$('#tabLate').addEventListener('pointerdown',e=>{const tr=e.target.closest('tr[data-id]');if(!tr)return;const f=flights.find(f=>f.id===+tr.dataset.id);if(f){centerOn(f.x,f.y);selected=f;}});
document.querySelectorAll('.tabbar button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabbar button').forEach(x=>x.classList.toggle('on',x===b));$('#tabLate').hidden=b.dataset.tab!=='late';$('#tabCoach').hidden=b.dataset.tab!=='coach';$('#tabTerms').hidden=b.dataset.tab!=='terms';});

/* ============ tick ============ */
function tick(dt){
  T+=dt;
  dustNow=!!(LV.dust&&T>=LV.dust[0]&&T<LV.dust[1]);heatNow=LV.light==='heat';
  if(dustNow)once('dust',()=>{radio('ATC','Dust storm. Visibility 1,500 m and falling. Increased spacing on all runways.');logE('Andhi: dust storm over the field.','miss');explain('dust');});
  if(LV.dust&&T>=LV.dust[1])once('dustend',()=>{radio('ATC','Dust storm passing. Normal spacing resumes.');logE('Dust storm passed.');});
  movingList=flights.filter(f=>MOVING.has(f.state));
  runways();
  for(const f of flights){if(f.held&&f.holdUntil&&T>=f.holdUntil){f.held=false;f.holdUntil=null;}updateFlight(f,dt);}
  for(const I of incidents.slice())if(I.simFuse){I.fs=I.fs.filter(g=>!g.mayday&&!g.prio&&['inbound','holding','goaround'].includes(g.state));if(!I.fs.length){drop(I);continue;}I.f=I.fs.reduce((a,b)=>a.endurance<b.endurance?a:b);I.left=Math.max(0,(I.f.endurance-6)*60/BASE);}
  for(const r of RW){if(r.strike&&T>=r.strike.until){r.strike=null;opsSpawn('fod',r);}if(r.shear&&!dustNow)r.shear=false;if(r.blocks.length&&r.blocks[0].to<T)r.blocks.shift();}
  opsTick(dt);
  incSpawner(dt);
  if(T>=S.tlNext&&T>=0){S.tlNext=T+60;recordShift();}
  summitTick();specialTick();storyTick();
  if(T>=LEN&&!ended)finish();
}
const onceSet=new Set();function once(k,fn){if(onceSet.has(k))return;onceSet.add(k);fn();}

/* ============ input ============ */
let drag=null;
cv.addEventListener('contextmenu',e=>{if(V3.on)e.preventDefault();});
cv.addEventListener('dblclick',e=>{if(!V3.on)return;const r=cv.getBoundingClientRect();const f=pick(e.clientX-r.left,e.clientY-r.top);if(f){closePop();setCam('follow',f);}});
cv.addEventListener('pointerdown',e=>{if(V3.on){drag={x:e.clientX,y:e.clientY,lx:e.clientX,ly:e.clientY,moved:false,orbit:e.button===2||e.shiftKey||e.altKey};cv.setPointerCapture(e.pointerId);return;}camT.x=cam.x;camT.y=cam.y;camT.s=cam.s;camT.anchor=null;drag={x:e.clientX,y:e.clientY,cx:cam.x,cy:cam.y,moved:false};cv.setPointerCapture(e.pointerId);});
cv.addEventListener('pointermove',e=>{const r=cv.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;if(drag&&V3.on){if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>4){drag.moved=true;cv.classList.add('drag');}if(drag.moved)cam3Drag(e.clientX-drag.lx,e.clientY-drag.ly,drag.orbit);drag.lx=e.clientX;drag.ly=e.clientY;}else if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4){drag.moved=true;cv.classList.add('drag');}if(drag.moved){camT.x=drag.cx-dx/camT.s;camT.y=drag.cy-dy/camT.s;clampCam(camT);cam.x=camT.x;cam.y=camT.y;}}else{hover=pick(mx,my);cv.classList.toggle('point',!!(hover||pickInc(mx,my)||pickRw(mx,my)));}});
cv.addEventListener('pointerup',e=>{const r=cv.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;if(drag&&!drag.moved&&running){const I=pickInc(mx,my);if(I)openIncPop(I);else{const f=pick(mx,my);if(f)openFlightPop(f,mx,my);else{const rw=pickRw(mx,my);if(rw)openRwPop(rw,mx,my);else{closePop();selected=null;}}}}drag=null;cv.classList.remove('drag');});
cv.addEventListener('wheel',e=>{e.preventDefault();const r=cv.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;const line=e.deltaMode===1;const mw=line||(e.deltaX===0&&Math.abs(e.deltaY)>=40&&Math.abs(e.deltaY)%1===0);if(V3.on){if(e.ctrlKey||e.metaKey)cam3Zoom(Math.exp(e.deltaY*0.012),mx,my);else if(mw)cam3Zoom(Math.exp((line?e.deltaY*33:e.deltaY)*0.0016),mx,my);else cam3Drag(-e.deltaX,-e.deltaY,false);return;}if(e.ctrlKey||e.metaKey)zoomAt(mx,my,Math.exp(-e.deltaY*0.012));else if(mw)zoomAt(mx,my,Math.exp(-(line?e.deltaY*33:e.deltaY)*0.0016));else{camT.anchor=null;camT.x+=e.deltaX/camT.s;camT.y+=e.deltaY/camT.s;clampCam(camT);}},{passive:false});
$('#zIn').onclick=()=>V3.on?cam3Zoom(1/1.6,VW/2,VH/2):zoomCenter(1.6);$('#zOut').onclick=()=>V3.on?cam3Zoom(1.6):zoomCenter(1/1.6);$('#zFit').onclick=()=>V3.on?cam3Fit():fitCam();
function pick(mx,my){let best=null,bd=1e9;for(const f of flights){if(f.sx==null||['sched','diverted','gone','cancelled','towed'].includes(f.state))continue;const d=Math.hypot(f.sx-mx,f.sy-my);const lim=Math.max(9,f.sr||0);if(d<lim&&d<bd){bd=d;best=f;}}return best;}
function pickInc(mx,my){for(const I of incidents)if(I.sx!=null&&Math.hypot(I.sx-mx,I.sy-my)<20)return I;return null;}
function pickRw(mx,my){for(const s of rwSigns)if(mx>=s.x&&mx<=s.x+s.w&&my>=s.y-3&&my<=s.y+s.h+3)return s.r;let wx=mx/cam.s+cam.x,wy=my/cam.s+cam.y,tol=10/cam.s;if(V3.on){const g=groundAt(mx,my);if(!g)return null;wx=g.x;wy=g.y;tol=45;}for(const r of RW){if(wx>=r.x0&&wx<=r.x1&&Math.abs(wy-r.y)<Math.max(r.width/2+10,tol))return r;}return null;}
document.querySelectorAll('.speeds button').forEach(b=>b.onclick=()=>setSpeed(+b.dataset.s));
(function(){const b=$('#snd');const paint=()=>{b.textContent=SND.on?'Sound on':'Sound off';b.classList.toggle('on',SND.on);};paint();b.onclick=()=>{SND.on=!SND.on;store.set('zm_snd',SND.on);paint();if(SND.on)tickSound(true);};})();
function setSpeed(s){if(!running)return;if(s===0)paused=!paused;else{speed=s;paused=false;}document.querySelectorAll('.speeds button').forEach(b=>{const v=+b.dataset.s;b.classList.toggle('on',v===0?paused:(!paused&&v===speed));});$('#spP').textContent=paused?'Resume':'Pause';}
window.addEventListener('keydown',e=>{if(e.key===' '&&!(e.target.closest&&e.target.closest('button'))){e.preventDefault();setSpeed(0);}if(e.key==='1')setSpeed(1);if(e.key==='2')setSpeed(2);if(e.key==='3')setSpeed(4);if(e.key==='Escape'){closePop();if(V3.on&&V3.mode!=='map')setCam('map');}if(e.key==='+'||e.key==='=')zoomCenter(1.6);if(e.key==='-')zoomCenter(1/1.6);if(e.key==='f')V3.on?cam3Fit():fitCam();if(e.key==='m'||e.key==='M')setView(V3.on?'2d':'3d');if(e.key==='c'||e.key==='C')cycleCam();if(V3.on&&(e.key==='q'||e.key==='Q'))C3.t.yaw+=0.25;if(V3.on&&(e.key==='e'||e.key==='E'))C3.t.yaw-=0.25;});

/* ============ the debrief: what to do better next time, from your own shift ============ */
(function(){const st=document.createElement('style');st.textContent=`.sheet ol.lessons{margin:4px 0 8px;padding-left:22px;color:var(--ink-2);font-size:14px}.sheet ol.lessons li{margin-bottom:7px}.sheet ol.lessons b{color:var(--ink);font-family:var(--f-sign);font-weight:600;font-size:15.5px;letter-spacing:.01em}
.shift{border:1px solid var(--panel-edge);border-radius:6px;padding:6px 8px 2px;margin:8px 0;background:#0c1114}.shift svg{display:block;width:100%;height:auto}.lg2{display:flex;gap:14px;flex-wrap:wrap;font-family:var(--f-mono);font-size:11px}
.sheet .bench{font-size:13.5px;color:var(--ink-2)}.sheet .bench b{color:var(--sign);font-weight:400}.sheet .nexttip{border-left:3px solid var(--sign);padding:4px 10px;background:#13181b;font-size:13.5px}
details.log{margin-top:10px}details.log summary{cursor:pointer;font-family:var(--f-sign);font-weight:600;font-size:18px;color:var(--ink-2)}`;document.head.appendChild(st);})();
function recordShift(){let hold=0,q=0,aDue=0,dDue=0;for(const f of flights){if(f.state==='holding')hold++;else if(f.state==='hp'||f.state==='taxi_out')q++;
    if(f.kind==='arr'&&f.landT==null&&!['diverted','divert'].includes(f.state)&&f.eta>=T&&f.eta<T+900)aDue++;
    if(f.kind==='dep'&&['at_gate','push','start'].includes(f.state)&&f.std>=T&&f.std<T+900)dDue++;}
  const md={};for(const r of RW)if(!r.locked)md[r.short]=T<r.changeUntil?'CHG':r.mode;
  S.tl.push({t:T,hold,q,aDue,dDue,capA:Math.round(capNow('arr')),capD:Math.round(capNow('dep')),md,moves:S.moves});}
// the expert autopilot's result on the same schedule (headless runs, run_all.py)
const EXPERT={1:{st:3,moves:131,otp:97,cx:100},2:{st:3,moves:236,otp:95,cx:99},3:{st:3,moves:331,otp:87,cx:98},4:{st:3,moves:352,otp:92,cx:96}};
const NEXT_TIP={1:'Level 2 opens with only one arrival runway and one MIX. The first purple wave arrives about 10 minutes in: have two runways on ARR before it.',
  2:'Level 3 is 46 °C: 777s and A380s can only take off from 27L, the 4,500 m runway. Keep 27L on DEP or MIX through the heat. And keep some slack in hand around 14:50: Nagpur has visitors today.',
  3:'Level 4 is all six runways at once, with a dust storm at 12:40 that widens the gaps between landings by 40%. Put an extra runway on ARR just before the storm, not during it.',
  4:'Replay any level to chase three stars: the bank chart\'s red forecast line tells you when the stack will grow, so flip before it climbs.'};
function debrief(otp,cx){
  const tl=S.tl,out=[];if(tl.length<6)return{lessons:out,svg:''};
  const avg=(a,k)=>a.reduce((x,s)=>x+s[k],0)/Math.max(1,a.length);
  const pk=tl.reduce((a,s)=>s.hold>a.hold?s:a,tl[0]);
  if(pk.hold>=8){const w=tl.filter(s=>s.t>=pk.t-1500&&s.t<=pk.t);const dem=Math.round(avg(w,'aDue')*4),cap=Math.round(avg(w,'capA'));
    const dep=Object.keys(pk.md).filter(k=>w.filter(s=>s.md[k]==='DEP').length>=w.length*0.6);const by=clk(Math.max(0,pk.t-1800));
    const late=S.flipLog.find(f=>(f.to==='ARR'||f.to==='MIX')&&f.t>pk.t-1500&&f.t<=pk.t);
    let tip=dep.length?`Next time, turn ${dep[0]} to ARR (or MIX) by about ${by}, as the purple bars start to rise.`:'Every open runway was already landing; turning a departure runway to MIX would have taken the edge off.';
    if(late){const at=tl.find(s=>s.t>=late.t)||pk;tip+=` You did turn ${late.r} to ${late.to} at ${clk(late.t)}, but the stack was already ${at.hold} by then: flip about 15 minutes earlier.`;}
    out.push({w:pk.hold*3,title:`The stack peaked at ${pk.hold} aircraft at ${clk(pk.t)}`,text:`In the 25 minutes before it, arrivals came in at about ${dem} an hour against ${cap} an hour of landing capacity. ${tip}`});}
  const pq=tl.reduce((a,s)=>s.q>a.q?s:a,tl[0]);
  if(pq.q>=14){const w=tl.filter(s=>s.t>=pq.t-1500&&s.t<=pq.t);const arr=Object.keys(pq.md).filter(k=>w.filter(s=>s.md[k]==='ARR').length>=w.length*0.6);const calm=avg(w,'hold')<5;
    const capD=Math.round(avg(w,'capD')),due=Math.round(avg(w,'dDue')*4);
    const why=capD>due*1.2?`Take-off capacity (about ${capD} an hour) was above the rate new departures fell due (about ${due}), so this was a backlog: aircraft already late from the wave before.`:`Take-off capacity was about ${capD} an hour while departures were due at about ${due}.`;
    out.push({w:pq.q*2,title:`${pq.q} departures queued at ${clk(pq.t)}`,text:`${why} ${arr.length&&calm?`${arr[0]} stayed on arrivals with almost nobody holding: turn it to DEP until the backlog clears, then hand it back before the purple wave.`:'Hand a runway to departures before the teal wave peaks, and back again before the purple one.'}`});}
  const idle=tl.filter(s=>s.hold>=6&&s.dDue<=3&&Object.values(s.md).includes('DEP'));
  if(idle.length>=5){const k=Object.keys(idle[0].md).find(x=>idle[0].md[x]==='DEP');out.push({w:idle.length*2,title:`${k} sat on departures with little to launch`,text:`For about ${idle.length} minutes (from ${clk(idle[0].t)}) aircraft were holding while a departure runway had almost nothing due. A runway that is idle in one direction is free capacity for the other.`});}
  const open=RW.filter(r=>!r.locked).length;
  if(S.flips===0)out.push({w:60,title:'You never flipped a runway',text:'The hub runs in waves: about 30 minutes of arrivals, then 30 of departures, and the starting setup only suits the departure wave. Before each purple wave turn one or two departure runways to ARR; before each teal wave, turn them back.'});
  else if(S.flips>open*4)out.push({w:S.flips,title:`${S.flips} runway flips`,text:'Every flip closes a runway for 2 minutes while traffic clears. Fewer, earlier flips beat many late ones: plan each change about 10 to 15 minutes ahead using the bank chart.'});
  const may=S.hits.filter(h=>/MAYDAY|almost no fuel/.test(h.msg)).length;
  if(may)out.push({w:30*may,title:`${may} fuel emergenc${may>1?'ies':'y'}`,text:'Minimum fuel becomes MAYDAY after about 8 more minutes in the stack. Answer the fuel card with "Land next", and treat it as a warning that the stack is too long: add an arrival runway.'});
  if(cx<90)out.push({w:(90-cx)*3,title:`Connections ${cx}%`,text:'Transfer passengers miss their flights when their inbound sits in the stack. Keeping the stack short protects connections; for big groups, the "Hold 10 min" call trades a late departure for the passengers.'});
  if(S.summitAt!=null){const at=S.summitAt,w=tl.filter(s=>s.t>=at&&s.t<=at+1500),pk2=w.reduce((a,s)=>s.hold>a.hold?s:a,w[0]||{hold:0,t:at}),back=S.flipLog.filter(f=>f.t>=at+540&&f.t<=at+900&&(f.to==='ARR'||f.to==='MIX')).length;
    out.push({w:45,title:`The summit shut every runway at ${clk(at)}`,text:`The stack reached ${pk2.hold} by ${clk(pk2.t)}. You can't stop protocol, but you can recover faster: during the closure, line departures up at the holding points; as runways come back, put most of them on ARR first to drain the stack, then hand some back to departures.${back?'':' You made no ARR flips as the runways came back.'}`});}
  for(const c of S.storyRec||[]){const d=STORY[c.k];const l=d&&d.lesson&&d.lesson(c,tl);if(l)out.push(l);}
  if(otp<87&&!out.length)out.push({w:10,title:`On time ${otp}%`,text:'Watch the forecast lines on the bank chart: red is the stack, amber the departure queue. When either starts to climb, flip a runway before it peaks.'});
  out.sort((a,b)=>b.w-a.w);
  // a compact chart of the shift: stack (red), departure queue (amber), arrivals due (purple) and the flips
  const W=960,H=150,mx=Math.max(10,...tl.map(s=>Math.max(s.hold,s.q,s.aDue))),X=t=>16+t/LEN*(W-32),Y=v=>H-26-v/mx*(H-46);
  const line=(k,c)=>`<polyline fill="none" stroke="${c}" stroke-width="2.2" points="${tl.map(s=>`${X(s.t).toFixed(1)},${Y(s[k]).toFixed(1)}`).join(' ')}"/>`;
  const area=`<polygon fill="rgba(138,124,255,.18)" points="${X(tl[0].t)},${Y(0)} ${tl.map(s=>`${X(s.t).toFixed(1)},${Y(s.aDue).toFixed(1)}`).join(' ')} ${X(tl[tl.length-1].t)},${Y(0)}"/>`;
  const flips=S.flipLog.filter(f=>f.t>=0).map(f=>`<g><line x1="${X(f.t)}" x2="${X(f.t)}" y1="${H-24}" y2="${H-14}" stroke="${f.to==='ARR'?'#8a7cff':f.to==='DEP'?'#2fd3c6':f.to==='MIX'?'#f4c430':'#a6afb4'}" stroke-width="2"/></g>`).join('');
  const ticks=Array.from({length:Math.floor(LEN/900)+1},(_,k)=>k*900).map(t=>`<text x="${X(t)}" y="${H-2}" fill="#6f7a80" font-size="10" font-family="JetBrains Mono, monospace" text-anchor="middle">${clk(t)}</text>`).join('');
  const pkm=pk.hold>=4?`<circle cx="${X(pk.t)}" cy="${Y(pk.hold)}" r="4" fill="#ff7a6b"/><text x="${X(pk.t)+6}" y="${Y(pk.hold)-6}" fill="#ff9a8d" font-size="11" font-family="JetBrains Mono, monospace">stack ${pk.hold}</text>`:'';
  const svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Your shift: arrivals due, the holding stack, the departure queue and your runway flips over the 90 minutes"><line x1="16" x2="${W-16}" y1="${Y(0)}" y2="${Y(0)}" stroke="rgba(255,255,255,.15)"/>${area}${line('q','#ffd27a')}${line('hold','#ff7a6b')}${pkm}${flips}${ticks}</svg>`;
  return{lessons:out.slice(0,3),svg};
}

/* ============ levels: start and finish ============ */
// star lines; a level with a scripted shutdown (the summit) sets its own, because no player can prevent it
const starLines=L=>Object.assign({otp2:87,cx2:88,otp3:90,cx3:92},L.starsAt||{});
function stars(L,s){let n=0;const k=starLines(L),otp=s.dep+s.arr?(s.depOnTime+s.arrOnTime)/(s.dep+s.arr)*100:0,ct=s.cnxMade+s.cnxMiss,cx=ct?s.cnxMade/ct*100:100;if(s.safety>=70)n=1;if(n>=1&&s.moves>=L.target&&otp>=k.otp2&&cx>=k.cx2)n=2;if(n>=2&&otp>=k.otp3&&cx>=k.cx3&&s.safety>=90)n=3;return n;}
function starStr(n){return '<b>'+'★'.repeat(n)+'</b>'+'★'.repeat(3-n);}
function startLevel(n){
  LV=Object.assign({},LEVELS[n-1]);LV.script=LV.script.map(s=>s.slice());T0C=+LV.clock.split(':')[0]*3600+ +LV.clock.split(':')[1]*60;
  resetState();onceSet.clear();
  // which runways and concourses open
  RW.forEach(r=>{r.locked=true;r.mode='OFF';if(LV.rwOpen[r.id]){r.locked=false;r.mode=LV.rwOpen[r.id];}});
  const openC=new Set(CONC.filter(c=>LV.concs.includes(c.id[0])).map(c=>c.id));CONC.forEach(c=>c.open=openC.has(c.id));GATES.forEach(g=>{g.open=g.remote||openC.has(g.conc);g.zone=g.zone0||(g.zone0=g.zone);});
  LEN=LV.len||5400;T=-30;buildLevel(LV);
  // warm start: put the first inbound arrivals in the air
  $('#lvCode').textContent=`LEVEL ${LV.n} · ${LV.from}`;$('#lvName').textContent=LV.name;
  renderRw();renderInc();$('#coachList').innerHTML='';coachItems.length=0;seen.clear();comboPop();RATE.v=0;
  $('#overlay').hidden=true;running=true;paused=false;ended=false;speed=1;setSpeed(1);resize();
  if(V3.on)cam3Intro();
  for(let i=0;i<30;i++)tick(1);
  if(LV.last){coach(LV.last.t,LV.last.d);radio('AOCC',LV.last.t+'.');setTimeout(()=>{if(running)explain('hub');},8000);}else explain('hub');
  setTimeout(()=>{if(running&&LV.n===1)explain('bank');},16000);

}
function finish(){
  ended=true;paused=true;closePop();
  const left=flights.filter(f=>f.kind==='dep'&&['at_gate','taxi_out','hp','push','start','stuck'].includes(f.state)&&T>f.std+1500).length;
  for(const f of flights)if(f.links&&f.kind==='dep'&&f.state==='at_gate'&&T>f.std){for(const l of f.links){if(l.arr.inBlock!=null&&l.arr.inBlock+l.x<=T)S.cnxMade+=l.n;else S.cnxMiss+=l.n;}}
  const st=stars(LV,S);const best=store.get('zm_stars')||{};if((best[LV.n]||0)<st){best[LV.n]=st;store.set('zm_stars',best);}
  const otp=S.dep+S.arr?Math.round((S.depOnTime+S.arrOnTime)/(S.dep+S.arr)*100):0,otpA=S.arr?Math.round(S.arrOnTime/S.arr*100):0,otpD=S.dep?Math.round(S.depOnTime/S.dep*100):0,ct=S.cnxMade+S.cnxMiss,cx=ct?Math.round(S.cnxMade/ct*100):100;
  const verdict=st===3?'Flawless. The hub never noticed it was under pressure.':st===2?'Good shift. The waves came through and the hub kept its promises.':st===1?'The hub survived, but passengers will remember this one.':'Safety fell below 70. A real hub would stop operations and investigate.';
  const why=[];if(S.moves<LV.target)why.push(`Movements ${S.moves} of ${LV.target}: runways sat idle or were set for the wrong wave.`);if(otp<85)why.push(`On time ${otp}% (arrivals ${otpA}%, departures ${otpD}%): ${otpA<otpD?'arrivals sat in the stack. Give arrivals more runways before the purple wave peaks, not during it.':'departures queued at the holding points. Hand runways to departures before the teal wave peaks.'}`);if(cx<90)why.push(`Connections ${cx}%: arrivals that hold in the stack miss their onward flights. Give arrivals runways before the arrival wave, not during it.`);if(S.safety<90&&S.hits.length)why.push(`Safety ${Math.round(S.safety)}: ${S.hits.slice(0,3).map(h=>h.msg).join(' ')}${S.hits.length>3?` And ${S.hits.length-3} more.`:''}`);
  const next=LEVELS[LV.n];
  $('#sheet').innerHTML=`<div class="band"><span>Level ${LV.n} · ${LV.name}</span><span>${clk(0)} to ${clk(LEN)}</span></div><div class="in">
   <div class="bigstars">${starStr(st)}</div><h1 style="margin-top:8px">${st?'Level complete':'Level failed'}</h1><p>${verdict}</p>
   <div class="score"><div><div class="k">Movements</div><div class="v">${S.moves}/${LV.target}</div></div><div><div class="k">On time</div><div class="v">${otp}%</div><div class="sub">arrivals ${otpA}% · departures ${otpD}%</div></div><div><div class="k">Connections</div><div class="v">${cx}%</div></div><div><div class="k">Safety</div><div class="v">${Math.round(S.safety)}</div></div><div><div class="k">Your calls</div><div class="v">${S.incOk}/${S.incOk+S.incDef}</div><div class="sub">${S.incDef?`${S.incDef} left to ops`:S.incOk?'all made by you':'no calls this shift'}</div></div><div><div class="k">Runway flips</div><div class="v">${S.flips}</div></div><div><div class="k">Best on-time run</div><div class="v">${S.bestCombo||0}</div></div></div>
   <p class="src">${(k=>`Stars: one for keeping safety at 70 or above. Two for reaching the movement target with ${k.otp2}% on time and ${k.cx2}% of connections. Three for ${k.otp3}% on time, ${k.cx3}% of connections and safety 90.${LV.starsAt?' This level allows for the summit shutdown.':''}`)(starLines(LV))}</p>
   ${(()=>{const D=debrief(otp,cx),E=EXPERT[LV.n];return `<h2>What to do better next time</h2>${D.lessons.length?`<ol class="lessons">${D.lessons.map(l=>`<li><b>${l.title}.</b> ${l.text}</li>`).join('')}</ol>`:'<p>A clean shift: nothing to fix. Chase a longer on-time run, or try the next level.</p>'}
     ${D.svg?`<div class="shift"><div class="lg2"><span style="color:#ff7a6b">━ holding stack</span><span style="color:#ffd27a">━ departure queue</span><span style="color:#a99cff">▮ arrivals due</span><span style="color:var(--ink-3)">ticks: your runway flips</span></div>${D.svg}</div>`:''}
     ${E?`<p class="bench">The expert autopilot on this schedule: <b>${'★'.repeat(E.st)}</b> · ${E.moves} movements · ${E.otp}% on time · ${E.cx}% connections.${S.moves>=E.moves&&otp>=E.otp?' You beat it.':''}</p>`:''}
     ${NEXT_TIP[LV.n]?`<p class="nexttip"><b>${LEVELS[LV.n]?'Before level '+(LV.n+1):'Next'}:</b> ${NEXT_TIP[LV.n]}</p>`:''}`;})()}
   ${why.length?`<h2>Where the stars went</h2><ul>${why.map(w=>`<li>${w}</li>`).join('')}</ul>`:''}
   <details class="log"><summary>What happened</summary><ul>${S.log.slice(-14).map(l=>`<li><span class="mono">${l.t}</span> ${l.text}</li>`).join('')||'<li>A quiet shift.</li>'}</ul></details>
   <button class="go" id="again">Replay level ${LV.n}</button> ${next?`<button class="go" id="nextL">Level ${next.n}: ${next.name}</button>`:''} <button class="go ghost" id="toMenu">All levels</button></div>`;
  $('#overlay').hidden=false;$('#again').onclick=()=>startLevel(LV.n);if(next)$('#nextL').onclick=()=>startLevel(next.n);$('#toMenu').onclick=()=>menu('levels');
  window.__hubResult={level:LV.n,stars:st,moves:S.moves,target:LV.target,otp,otpA,otpD,cx,safety:S.safety,incOk:S.incOk,incFail:S.incDef,incTypes:S.incTypes,hits:S.hits.map(h=>h.msg),flips:S.flips,div:S.div,goArounds:S.goArounds};
}
function menu(tab){
  running=false;const best=store.get('zm_stars')||{};
  const planSvg=document.getElementById('planTpl').innerHTML;
  const D=window.__DESIGN||{};
  const lv=LEVELS.map(L=>`<button class="lc" data-n="${L.n}"><span class="n">LEVEL ${L.n} · ${L.from}</span><h3>${L.name}</h3><p>${L.blurb}</p><span class="meta">${L.clock} · ${L.rw} runways · ~${L.arr+L.dep} movements an hour</span><span class="stars">${starStr(best[L.n]||0)}</span></button>`).join('');
  $('#sheet').innerHTML=`<div class="band"><span>${SPEC.name} · ${SPEC.code}</span><span>AMD + BOM + BLR → ZMI · Nagpur</span></div><div class="in">
   <div class="tabs2" role="tablist"><button data-t="levels" class="${tab!=='plan'?'on':''}">Play</button><button data-t="plan" class="${tab==='plan'?'on':''}">The airport</button></div>
   <div id="tLevels" ${tab==='plan'?'hidden':''}>
    <h1>Three airports. One roof.</h1>
    <p>Ahmedabad (SVPIA), Mumbai (CSMIA) and Bengaluru (KIA) close and merge into one airport near Nagpur's Zero Mile, long held to mark the centre of India. You run it. It is sized for the combined traffic of Delhi, Mumbai, Bengaluru and Hyderabad: about 3,630 movements and 209 million passengers a year, 1.7 times Atlanta. The airlines move in one city at a time, and the waves get taller.</p>
    <div class="levels">${lv}</div>
    <div class="cfgrow"><b>Incidents</b><div class="seg2" role="group" aria-label="Incidents"><button data-inc="std" class="${CFG.inc!=='off'?'on':''}">Standard</button><button data-inc="off" class="${CFG.inc==='off'?'on':''}">Off: runways only</button></div><small>${CFG.inc==='off'?'Just you, the bank chart and the runways. Fuel emergencies still happen if the stack grows.':'A few real calls per level. The ops teams handle the routine.'}</small></div>
    <h2>How to play</h2>
    <ul>
     <li><b>The bank chart</b> at the bottom is your radar for the next hour. Purple bars are arrivals due, teal bars are departures due, dashed lines are what your runways can handle. When the bars poke above the line, you are about to fall behind.</li>
     <li><b>The runway desk</b> (or click a runway on the map) sets each runway to ARR, DEP, MIX or OFF. A switch takes 2 minutes. Move runways to arrivals before an arrival bank, then to departures before the departure bank.</li>
     <li><b>Calls</b> pop up on the map with a countdown ring when something needs a duty manager, only a few per level. Each card says what ops will do if you leave it. Routine birds, debris and breakdowns are handled by the ops teams: the amber vehicles on the map.</li>
     <li>Click any aircraft to see where it is going, prioritise it or hold it at the gate. <span class="kbd">Space</span> pauses, <span class="kbd">1</span> <span class="kbd">2</span> <span class="kbd">3</span> change speed. Wheel or pinch to zoom.</li>
    </ul>
   </div>
   <div id="tPlan" ${tab==='plan'?'':'hidden'}>
    <h1>${SPEC.name}</h1><p>${SPEC.tagline||''}</p>
    <div class="plan">${planSvg}</div>
    ${D.html||''}
   </div>
  </div>`;
  $('#overlay').hidden=false;
  $('#sheet').querySelectorAll('.tabs2 button').forEach(b=>b.onclick=()=>menu(b.dataset.t));
  $('#sheet').querySelectorAll('.lc').forEach(b=>b.onclick=()=>startLevel(+b.dataset.n));
  $('#sheet').querySelectorAll('[data-inc]').forEach(b=>b.onclick=()=>{CFG.inc=b.dataset.inc;store.set('zm_cfg',CFG);menu('levels');});
}
window.HUB={get T(){return T;},get S(){return S;},get LV(){return LV;},flights:()=>flights,RW,incidents:()=>incidents,setMode:(id,m)=>{const r=RW.find(x=>x.id===id||x.short===id);if(r)setMode(r,m);},startLevel,capNow,resolveAll:()=>{for(const I of incidents.slice()){const a=I.acts.find(a=>!(a.dis&&a.dis()));if(a)a.fn();}},speed:s=>setSpeed(s),ops:()=>ops,cfg:CFG,
  // test hooks: run the sim forward synchronously, and point the camera
  ff:secs=>{for(let i=0;i<secs&&!ended;i++)tick(1);puffs.length=0;hud();drawWave();},look:(x,y,z)=>{camT.s=cam.fit*z;camT.anchor=null;camT.x=x-((cam.region.L+cam.region.R)/2)/camT.s;camT.y=y-((cam.region.Tp+cam.region.B)/2)/camT.s;clampCam(camT);Object.assign(cam,{x:camT.x,y:camT.y,s:camT.s});},spawn:(t,x)=>spawnInc(t,x),opsSpawn:(k,x)=>opsSpawn(k,x),pause:()=>{paused=true;},
  view:v=>setView(v),ready3d:()=>new Promise(r=>{if(V3.ready||V3.failed)r(V3.ready);else{V3.waiters.push(r);init3D();}}),
  cam3d:o=>{if(o.mode&&o.mode!=='map'){setCam(o.mode,o.fid?flights.find(f=>f.id===o.fid):null);return;}setCam('map');Object.assign(C3.t,o);Object.assign(C3,C3.t);},
  stats3d:()=>V3.ready?{cpuMs:+(V3.cpu||0).toFixed(2),fps:V3.fps,calls:Z.renderer.info.render.calls,tris:Z.renderer.info.render.triangles,geoms:Z.renderer.info.memory.geometries,tex:Z.renderer.info.memory.textures,mods:Object.keys(Z.mods),mode:V3.mode}:null,Z:()=>Z};

/*@@3D@@*/

/* ============ boot ============ */
buildTerrain();resize();
let last=performance.now(),hudT=0;
function frame(ms){
  requestAnimationFrame(frame);
  if(cv.clientWidth&&(cv.clientWidth!==VW||cv.clientHeight!==VH))resize();
  const dtR=Math.min(0.1,(ms-last)/1000);last=ms;camEase(dtR);
  if(running&&!paused&&!ended){let d=dtR*BASE*speed;try{while(d>0){const st=Math.min(1,d);tick(st);d-=st;}}catch(err){console.error(err);}incTick(dtR);if(toastTimer>0){toastTimer-=dtR;if(toastTimer<=0&&!$('#toast').matches(':hover'))$('#toast').hidden=true;}}
  if(V3.on){try{draw3D(ms/1000,dtR);}catch(err){console.error(err);}}else{try{draw(ms/1000);}catch(err){console.error(err);}}
  hudT+=dtR;if(hudT>0.25&&LV){hudT=0;try{hud();}catch(err){console.error(err);}try{drawWave();}catch(err){console.error(err);}}
}
// idle preview: show level 4's layout behind the menu
LV=LEVELS[3];RW.forEach(r=>{r.locked=false;r.mode=r.role==='arr'?'ARR':r.role==='dep'?'DEP':'MIX';});resetState();
menu('levels');
if(V3.want)init3D();
requestAnimationFrame(frame);
})();
