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
  A124:{name:'Antonov An-124 Ruslan',len:68.96,span:73.3,code:'F',wake:'J',eng:4,pax:20,turn:120},
  GLF6:{name:'Gulfstream G650',len:30.4,span:30.4,code:'C',wake:'M',eng:2,pax:14,turn:30},
  B748:{name:'Boeing 747-8',len:76.3,span:68.4,code:'F',wake:'H',eng:4,pax:410,turn:100},
  C17:{name:'Boeing C-17 Globemaster III',len:53,span:51.75,code:'E',wake:'H',eng:4,pax:100,turn:90}
};
const CR={C:1,E:3,F:4};
const AL={
  '6E':{name:'IndiGo',radio:'IFLY',tail:'#3b42c4'},AI:{name:'Air India',radio:'AIR INDIA',tail:'#d0263a'},IX:{name:'Air India Express',radio:'EXPRESS INDIA',tail:'#e4572e'},
  QP:{name:'Akasa Air',radio:'AKASA AIR',tail:'#f26722'},SG:{name:'SpiceJet',radio:'SPICEJET',tail:'#e0262e'},
  EK:{name:'Emirates',radio:'EMIRATES',tail:'#d71a21'},QR:{name:'Qatar Airways',radio:'QATARI',tail:'#8a1648'},EY:{name:'Etihad',radio:'ETIHAD',tail:'#b8925a'},
  SQ:{name:'Singapore Airlines',radio:'SINGAPORE',tail:'#264a8c'},LH:{name:'Lufthansa',radio:'LUFTHANSA',tail:'#22397a'},BA:{name:'British Airways',radio:'SPEEDBIRD',tail:'#2f52a8'},
  SV:{name:'Saudia',radio:'SAUDIA',tail:'#12805a'},TG:{name:'Thai',radio:'THAI',tail:'#6a3496'},FZ:{name:'flydubai',radio:'SKY DUBAI',tail:'#1a4c86'},AF:{name:'Air France',radio:'AIRFRANS',tail:'#1d3c8f'},
  IN1:{name:'Air India One',radio:'INDIA ONE',tail:'#ff9933'},CHW:{name:'Chambani Wedding Air',radio:'BARAAT',tail:'#d4a017'},
  USAF:{name:'United States Air Force',radio:'AIR FORCE',tail:'#1c3f7a'},CCA:{name:'Air China',radio:'AIR CHINA',tail:'#c8102e'},JAF:{name:'Japan Air Self-Defense Force',radio:'JAPANESE AIR FORCE',tail:'#c8102e'},
  GAF:{name:'German Air Force',radio:'GERMAN AIR FORCE',tail:'#3a3a3a'},RRR:{name:'Royal Air Force',radio:'ASCOT',tail:'#2d3e66'},CTM:{name:'French Republic',radio:'COTAM',tail:'#22397a'},
  TCG:{name:'Turkish State Flight',radio:'TURKISH GOVERNMENT',tail:'#c8102e'},ROK:{name:'Republic of Korea Air Force',radio:'KOREAN AIR FORCE',tail:'#2c5aa0'},RCF:{name:'Royal Canadian Air Force',radio:'CANFORCE',tail:'#c8102e'},
  RAA:{name:'Royal Australian Air Force',radio:'AUSSIE',tail:'#2b3a55'},MH:{name:'Malaysia Airlines',radio:'MALAYSIAN',tail:'#1e4ea1'},GA:{name:'Garuda Indonesia',radio:'INDONESIA',tail:'#00577a'},
  IAM:{name:'Italian Air Force',radio:'ITALIAN AIR FORCE',tail:'#008c45'},BRS:{name:'Brazilian Air Force',radio:'BRAZILIAN AIR FORCE',tail:'#009c3b'},EUR:{name:'European Union',radio:'EU',tail:'#003399'},
  GOV:{name:'State flight',radio:'STATE',tail:'#5a6470'},AM:{name:'Aeromexico',radio:'AEROMEXICO',tail:'#0b2343'},
  OCA:{name:'Orange City Cargo',radio:'ORANGE CITY',tail:'#ff8c1a'},SPC:{name:'Satpura Cargo',radio:'SATPURA',tail:'#5b6b2e'},RSD:{name:'Rossiya Special Flight Squadron',radio:'RUSSIA',tail:'#1c3f94'}
};
const DOMC=[['Delhi','DEL','N',3],['Mumbai','BOM','W',3],['Bengaluru','BLR','S',3],['Hyderabad','HYD','S',2],['Chennai','MAA','S',2],['Kolkata','CCU','E',2],['Ahmedabad','AMD','W',2],['Pune','PNQ','W',1.5],['Goa','GOX','W',1],['Kochi','COK','S',1],['Jaipur','JAI','N',1],['Lucknow','LKO','N',1],['Guwahati','GAU','E',1],['Patna','PAT','E',1],['Bhubaneswar','BBI','E',1],['Srinagar','SXR','N',0.6],['Varanasi','VNS','N',0.8],['Indore','IDR','N',0.8],['Raipur','RPR','E',0.6],['Visakhapatnam','VTZ','E',0.8],['Thiruvananthapuram','TRV','S',0.8],['Chandigarh','IXC','N',0.7],['Amritsar','ATQ','N',0.6],['Coimbatore','CJB','S',0.6]];
const INTC=[['Dubai','DXB','W',['EK','6E','AI','FZ'],5],['Doha','DOH','W',['QR','6E'],2],['Abu Dhabi','AUH','W',['EY','6E','IX'],2],['Singapore','SIN','E',['SQ','AI','6E'],2],['London','LHR','W',['BA','AI'],1.5],['Frankfurt','FRA','W',['LH','AI'],1],['Paris','CDG','W',['AF','AI'],0.8],['Jeddah','JED','W',['SV','6E'],1],['Bangkok','BKK','E',['TG','6E','AI'],1.2]];
const DIRSTACK={N:0,W:1,E:1,S:2};

/* ============ levels ============ */
const LEVELS=[
  {n:1,name:'Opening day',sub:'Bengaluru moves in',from:'BLR',clock:'06:00',arr:42,dep:42,amp:0.9,starsAt:{otp2:82,cx2:85,otp3:86,cx3:90},rw:2,rwOpen:{R3:'ARR',R4:'DEP'},concs:'AB',intl:0.08,wide:0.06,a380:0,target:110,light:'day',
   blurb:'Kempegowda International closes at dawn and Bengaluru\'s airlines move in. Two runways, two concourses. Learn the bank chart and the runway desk.',
   last:{t:'Last flight out of Kempegowda',d:'<p>At 05:55, IndiGo 6E 6101 pushed back from Bengaluru\'s Kempegowda International: the last departure before it closed. Bengaluru\'s airlines now fly from here.</p><p>Look for its terminal-in-a-garden in ZMI: the gardens under the oculus, the planted valley where the Hall becomes the Mall, and a garden court at every pier root. And every stand built two ways, for one widebody or two narrowbodies, as at Bengaluru\'s T2.</p>'},
   script:[[300,'st_ribbon'],[900,'medical'],[1500,'st_surya'],[3300,'st_tiger']],ops:[[700,'birds'],[2100,'fod']]},
  {n:2,name:'Ahmedabad and Hyderabad',sub:'+ Ahmedabad, Hyderabad',from:'BLR+AMD+HYD',clock:'09:00',arr:76,dep:76,amp:0.9,rw:4,rwOpen:{R2:'ARR',R3:'DEP',R4:'DEP',R5:'MIX'},concs:'ABC',intl:0.12,wide:0.10,a380:0,target:205,light:'day',
   blurb:'Sardar Vallabhbhai Patel International closes and Ahmedabad\'s flights move in, with Hyderabad\'s hub traffic. Four runways, taller waves: flip runways as each bank comes through.',
   last:{t:'Last flight out of Sardar Vallabhbhai Patel',d:'<p>At 08:50, IndiGo 6E 6202 left Ahmedabad and SVPIA closed. Ahmedabad\'s flights and Hyderabad\'s connecting banks now run through ZMI.</p><p>Ahmedabad lives on in the building\'s edges: jaali screens shade every sun-facing glass wall, and the forecourt is a stepwell, terraces stepping down to shaded water. Sardar Patel brought more than 560 princely states into one India; the unity marker under the oculus remembers it.</p>'},
   script:[[700,'st_kites'],[1500,'strike'],[3000,'medical'],[4000,'st_lastball']],ops:[[400,'birds'],[1200,'tug'],[2400,'fod'],[3800,'birds']]},
  {n:3,name:'Mumbai and the Gulf',sub:'+ Mumbai',from:'BLR+AMD+HYD+BOM',clock:'14:00',len:9300,windDown:true,phase:3000,taper:{arr:[8300,8900],dep:[8500,9200]},fog:[6600,7500],arr:90,dep:90,amp:0.85,starsAt:{otp2:69,cx2:80,otp3:69,cx3:86},rw:5,rwOpen:{R1:'ARR',R2:'DEP',R3:'DEP',R4:'MIX',R5:'ARR'},concs:'ABCDE',intl:0.22,wide:0.18,a380:5,target:450,light:'heat',
   blurb:'Chhatrapati Shivaji Maharaj International closes: Mumbai\'s airlines and the Gulf wave arrive. 46 °C. Hot air is thin, so heavy jets need the long runway to get airborne.',
   last:{t:'Last flight out of Chhatrapati Shivaji Maharaj',d:'<p>At 13:50, Air India AI 629 left Mumbai\'s Terminal 2 and the airport closed. Mumbai\'s widebodies and the Gulf carriers now fly from here.</p><p>Mumbai holds up ZMI\'s roof: branching columns that flare into a field of coffers with coloured lenses, a 40 m cantilever over the kerb, and an art wall along the transfer route.</p>'},
   // 14:00 an arrival bank · 14:25 dabbawalas · 14:35 GPS spoofing · 14:50 the summit shuts every runway as the next arrival
   // bank builds; the SPG hands them back one by one from about 15:05 · 15:15 the stack it left (and a medical) · 15:25 the
   // Chambani wedding · 15:50 fog (and, if the chain completes, the collision) · 30 minutes of recovery · 16:20 the wind-down
   script:[[1500,'st_dabba'],[2100,'st_gps'],[3000,'summit'],[4700,'medical'],[5100,'st_wedding'],[6600,'st_fog'],[7700,'st_evening']],ops:[[600,'birds'],[1500,'fod'],[2300,'tug'],[4800,'birds'],[5700,'fod'],[7900,'tug'],[8500,'birds']]},
  {n:4,name:'Delhi. Full hub.',sub:'+ Delhi',from:'ALL 5 CITIES',clock:'12:00',len:12200,windDown:true,lateDeps:4200,evening:[7800,12200,0.7,0.1,1.5,0.15],arr:116,dep:116,amp:0.75,starsAt:{otp2:66,cx2:80,otp3:74,cx3:88},rw:6,rwOpen:{R1:'ARR',R2:'ARR',R3:'DEP',R4:'DEP',R5:'DEP',R6:'MIX'},concs:'ABCDEF',intl:0.25,wide:0.20,a380:6,target:720,light:'day',dust:[2400,3300],
   blurb:'Delhi\'s hub banks move in: four airports\' worth of traffic at the peak, about 230 movements an hour with peaks well above. Then a pre-monsoon squall kicks up an andhi (dust storm), Delhi brings guests, and the day ends only when the evening bank is away.',
   last:{t:'Delhi\'s banks move in',d:'<p>Delhi\'s own airport stays open for its city, but from today its connecting banks run through ZMI. Four cities\' traffic, three cities\' building, at the old Zero Mile.</p><p>The north lobe of the Hall points almost exactly at Delhi.</p>'},
   script:[[1000,'lights'],[1500,'st_monkeys'],[2550,'shear'],[3700,'medical'],[4000,'st_trophy'],[4800,'st_delhisummit']],ops:[[500,'birds'],[1400,'tug'],[3000,'fod'],[4400,'birds']]}
];

/* ============ state ============ */
let flights=[],FID=0,S=null,incidents=[],INC=0,selected=null,hover=null,selRw=null;
const puffs=[],moveLog=[];
function resetState(){
  SUM=null;STO=[];CINE=null;PACE=null;endDue.cut=false;HOLDDEP=null;MARKS=[];FXV=[];voiceReset();if(typeof ltReset==="function")ltReset();{const kc=$('#kiteChip');if(kc)kc.hidden=true;const wc=$('#wedChip');if(wc)wc.hidden=true;const sb=$('#stopBtn');if(sb)sb.hidden=true;const ft=$('#fogTag');if(ft)ft.hidden=true;fogF=0;}cinema.q=[];specialArr.list=[];flights=[];FID=0;incidents=[];INC=0;selected=null;hover=null;selRw=null;puffs.length=0;moveLog.length=0;ops.length=0;opsClock=0;lastCnx=-1e9;
  S={tl:[],flipLog:[],tlNext:0,combo:0,bestCombo:0,moves:0,arr:0,dep:0,depOnTime:0,arrOnTime:0,cnxMade:0,cnxMiss:0,safety:100,incOk:0,incDef:0,incTypes:{},hits:[],holdMin:0,div:0,goArounds:0,log:[],delaySum:0,flips:0};
  GATES.forEach(g=>{g.occ=null;g.res=null;});
  RW.forEach(r=>{r.tdList=[];r.lastSchedTd=-1e9;r.lastDep=-1e9;r.arrExit=-1e9;r.occ=null;r.changeUntil=-1;r.closedUntil=-1;r.why='';r.ops=0;r.flash=0;r.blocks=[];r.gapReq=false;r.degraded=false;r.strike=null;r.shear=false;r.sepK=1;r.sepUntil=-1;r.kiteUntil=-1;r.kiteFrom=-1;r.kiteP=0.25;r.noArrUntil=-1;r.gpsUntil=-1;r.noDepUntil=-1;r.btUntil=-1;});
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
  const wv=t=>{const s=Math.sin(2*Math.PI*(t-600-(L.phase||0))/per);return Math.sign(s)*Math.pow(Math.abs(s),0.45);};
  // evening:[t0,t1,a0,a1,d0,d1]: from t0 the waves stop; arrivals and departures run at a0..a1 and d0..d1 of their mean rate (a wind-down)
  const eve=L.evening,ek=(t,a,b)=>a+(b-a)*clamp((t-eve[0])/(eve[1]-eve[0]),0,1);
  // taper: {arr:[t0,t1],dep:[t0,t1]} fades that rate out between t0 and t1 (an end-of-shift wind-down)
  const tp=(k,t)=>{const w=L.taper&&L.taper[k];return w?clamp((w[1]-t)/(w[1]-w[0]),0,1):1;};
  const rateA=t=>eve&&t>=eve[0]?L.arr/3600*ek(t,eve[2],eve[3]):L.arr/3600*(1+amp*wv(t))*tp('arr',t);
  const rateD=t=>eve&&t>=eve[0]?L.dep/3600*ek(t,eve[4],eve[5]):L.dep/3600*(1-amp*wv(t))*tp('dep',t);
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
  // lateDeps: later departures are towed to a free stand about an hour before they leave, instead of waiting there from the start
  for(const f of parked){if(L.lateDeps&&f.std>=L.lateDeps){f.state='sched';f.appearT=f.std-3600;continue;}const g=freeGate(f,true);if(g){g.occ=f;f.gate=g;f.x=g.x;f.y=g.y;f.heading=g.a;}else{f.state='cancelled';f.dropped=true;}}
  flights=flights.filter(f=>!f.dropped);
  // transfers: each arrival feeds 1 to 3 later departures
  const depList=flights.filter(f=>f.kind==='dep').concat(flights.filter(f=>f.turn).map(f=>({virtualOf:f,std:f.turn.std,intl:f.intl})));
  for(const a of flights.filter(f=>f.kind==='arr')){
    const tp=Math.round(a.pax*(a.intl?0.38:0.16));const cands=depList.filter(d=>d.std>=a.eta+(a.intl||d.intl?62:46)*60&&d.std<=a.eta+150*60&&d.virtualOf!==a);if(!cands.length)continue;
    const k=1+Math.floor(R()*3);for(let i=0;i<k;i++){const d=cands[Math.floor(R()*cands.length)];const n=Math.max(3,Math.round(tp/k*(0.6+R()*0.8)));const link={arr:a,n,x:(a.intl||d.intl?40:26)*60};(d.links=d.links||[]).push(link);}
  }
  for(const v of depList)if(v.virtualOf&&v.links)v.virtualOf.turnLinks=v.links;
  // fan charters (a set piece cancels them): on the bank chart from the start, no connections
  if(L.charters){const C=L.charters,als=['6E','IX','SG','QP'],tys=['A20N','B38M','A20N','A21N'],cities=[['Mumbai','BOM','W'],['Delhi','DEL','N'],['Pune','PNQ','W'],['Hyderabad','HYD','S'],['Bengaluru','BLR','S'],['Kolkata','CCU','E'],['Chennai','MAA','S'],['Ahmedabad','AMD','W']];
    for(let i=0;i<C.n;i++){const c=cities[i%8];const f=mk({kind:'dep',state:'at_gate',al:als[i%4],type:tys[i%4],intl:false,to:c[0],toCode:c[1],dir:c[2],std:C.std+(i%4)*45});f.num=String(7101+i);f.origStd=f.std;f.readyAt=f.std-300;f.charter=true;
      const g=freeGate(f,true);if(g){g.occ=f;f.gate=g;f.x=g.x;f.y=g.y;f.heading=g.a;}else flights.splice(flights.indexOf(f),1);}}
}
function mk(o){const f=Object.assign({id:++FID,x:0,y:0,heading:Math.PI,alt:0,v:0,path:null,pd:0,plen:0,prio:false,held:false,trail:[]},o);f.T=TYPES[f.type];f.A=AL[f.al];f.pax=Math.round(f.T.pax*(0.78+SIMR()*0.18));flights.push(f);return f;}
function zoneOk(g,f){return g.zone==='swing'||(f.intl?g.zone==='intl':g.zone==='dom');}
function freeGate(f,initial){
  const code=CR[f.T.code];let best=null,bs=1e18;
  for(const g of GATES){if(g.occ||g.res||!g.open||CR[g.code]<code||!zoneOk(g,f)||marsBusy(g))continue;let s=(CR[g.code]-code)*400+(g.remote?2500:0);s+=dist(g.x,g.y,procC.x,procC.y)*(initial?0.02:0.1);if(s<bs){bs=s;best=g;}}
  return best;
}
function toDep(f){const t=f.turn;
  // a wind-down level ends when every departure has gone, so it may not hold one that cannot go: an onward flight whose
  // turnaround (from a late arrival) would not be done by the time it would need to push to get away before the day's hard
  // stop (push, start and taxi take 3 minutes at least) is cancelled, and the aircraft night-stops
  if(LV.windDown&&Math.max(t.std-120,f.inBlock+f.T.turn*60+(f.gate&&f.gate.remote?300:0))>LEN+WIND-180){f.turn=null;f.turnLinks=null;f.nightStop=true;f.state='parked';f.towAt=T+1500;
    logE(`${fl(f)}: its onward flight is cancelled, it would not be turned round before the day ends. It stays the night.`);return;}
  const hd=HOLDDEP&&t.std<HOLDDEP.until&&T<HOLDDEP.until;f.kind='dep';f.num=t.num;f.to=t.to;f.toCode=t.toCode;f.dir=t.dir;f.std=t.std;f.origStd=t.std;f.state='at_gate';f.links=f.turnLinks;f.readyAt=Math.max(f.std-120,f.inBlock+f.T.turn*60+(f.gate&&f.gate.remote?300:0));f.prio=false;f.held=false;if(hd)sumHold(f);}
// summit protocol: departures stay at their gates until the SPG hands the runways back (HOLDDEP.until), then they all go
let HOLDDEP=null;function sumHold(f){f.held=true;f.sumHeld=true;f.holdUntil=HOLDDEP.until;f.readyAt0=f.readyAt0!=null?f.readyAt0:f.readyAt;f.readyAt=Math.max(f.readyAt0,HOLDDEP.until);}

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
const coachItems=[];let toastTimer=0,toastFold=false;const HUDR=[];const seen=new Set();
function showToast(t,d){$('#tT').textContent=t;$('#tD').innerHTML=d.startsWith('<')?d:`<p>${d}</p>`;const el=$('#toast');el.hidden=false;el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');toastTimer=18;placeToast();toastRoom();}
// The 3D view's left margin is a stack, top to bottom: a set piece's chip (fog, kites, wedding, delegations; at 200 px), the
// banner just under it (--banT, 250 px when there is no chip), the speaker's popup under that; and at the bottom, above the
// bank chart, the Delhi summit's lower third (#delegLT) with the coach card on top of it. While the open card would run into
// the popup, the banner or a chip (a tall card, a short screen) it folds to its title, and its timer waits. Then HUDR gets the
// rects (map canvas px) of the card and of everything else that floats over the map, so incident badges never end up under
// one (incMark). Runs a few times a second from the HUD loop, and whenever the card opens or a cinematic starts or ends.
const HUD_FLOAT=['#toast','#vipBanner.on','#guard.on','#fogTag','#stopBtn','#kiteChip','#wedChip','#delegChip','#delegLT.on','#zoomBox','#camLbl'],HUD_CHIPS=['#fogTag','#delegChip','#kiteChip','#wedChip'];
// RWE: where each runway's west end is on screen in the strategic view, re-read while the map camera frames the field (a
// cinematic or a close zoom keeps the last reading, so nothing jumps); reach(y0,y1) is how far right a card in the left margin
// may reach between those screen rows without covering a runway (Infinity: no runway ends in that band)
const RWE=[];
const reach=(y0,y1)=>{let x=Infinity;for(const p of RWE)if(p.Y>y0-20&&p.Y<y1+20)x=Math.min(x,p.X);return x;};
const setVar=(e,k,v)=>{if(e.style.getPropertyValue(k)!==v){if(v)e.style.setProperty(k,v);else e.style.removeProperty(k);return true;}return false;};
function toastRoom(){const el=$('#toast'),app=$('#app'),a=app.getBoundingClientRect(),v3=document.body.classList.contains('v3');
  let chipB=0;if(v3)for(const s of HUD_CHIPS){const e=$(s);if(e&&!e.hidden){const r=e.getBoundingClientRect();if(r.height)chipB=Math.max(chipB,r.bottom-a.top);}}
  const btN=Math.max(250,Math.ceil(chipB)+14),bt=btN+'px';if(app.style.getPropertyValue('--banT')!==bt)app.style.setProperty('--banT',bt);
  if(v3&&V3.ready&&V3.mode==='map'&&!CINE&&!(SUM&&SUM.cine)&&C3.dist>6000&&!(C3.intro>0)){RWE.length=0;for(const r of RW)for(const dy of [-30,30]){const p=proj(r.x0,r.y+dy,0);if(p)RWE.push(p);}}
  {const b=$('#vipBanner'),g=$('#guard'),w=$('#wave').getBoundingClientRect(),cb=w.top-a.top-8,lx=14,gap=16;
    // the banner from its top to about 110 px down, the speaker's popup under it (figure 96 px, then the bubble), the card above the chart
    const bm=v3?Math.round(clamp(reach(btN-12,btN+110)-lx-gap,200,500))+'px':'',gt=b.classList.contains('on')?btN+Math.max(100,b.offsetHeight+14):btN;
    const bw=v3?Math.round(clamp(reach(gt,gt+125)-lx-96-gap,150,240))+'px':'',cw=v3?Math.round(clamp(reach(cb-260,cb)-lx-gap,260,380))+'px':'';
    if(setVar(b,'--banMax',bm)&&b.classList.contains('on'))banFit();setVar(g,'--bubW',bw);if(el)setVar(el,'--cardW',cw);}
  // (folded, it can still be in the way on a short screen during the Delhi summit: then it tucks away until there is room)
  const crowd=()=>{const r=el.getBoundingClientRect();for(const s of ['#guard.on','#vipBanner.on'].concat(HUD_CHIPS)){const o=$(s);if(!o||o.hidden)continue;const q=o.getBoundingClientRect();
    if(q.height&&q.bottom+8>r.top&&q.top<r.bottom&&q.left<r.right&&q.right>r.left)return true;}return false;};
  if(el&&!el.hidden){placeToast();let fold=false,tuck=false;el.classList.remove('tuck');
    if(!app.classList.contains('cine')){el.classList.remove('fold');fold=crowd();}
    if(fold||app.classList.contains('cine')){el.classList.add('fold');tuck=crowd();}
    el.classList.toggle('fold',fold);el.classList.toggle('tuck',tuck);toastFold=fold||tuck;}else{toastFold=false;if(el)el.classList.remove('fold','tuck');}
  // (the Delhi summit's lower third gives up its quote, which the ticker carries too, while the speaker's popup needs the room)
  const lt=$('#delegLT'),gd=$('#guard');if(lt){let tight=false;if(v3&&lt.classList.contains('on')&&gd&&gd.classList.contains('on')){lt.classList.remove('tight');tight=gd.getBoundingClientRect().bottom+6>lt.getBoundingClientRect().top;}
    if(tight!==lt.classList.contains('tight'))lt.classList.toggle('tight',tight);}
  HUDR.length=0;
  for(const s of HUD_FLOAT){const e=document.querySelector(s);if(!e||e.hidden)continue;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);if(r.width>0&&r.height>0&&+cs.opacity>0.05&&cs.visibility!=='hidden')HUDR.push({l:r.left-a.left,t:r.top-a.top,r:r.right-a.left,b:r.bottom-a.top});}}
function coach(t,d,alarm){coachItems.unshift({t,d,at:clk(T)});$('#coachList').innerHTML=coachItems.map(c=>`<div class="ci"><div class="tm">${c.at}</div><h4>${c.t}</h4>${c.d.startsWith('<')?c.d:`<p>${c.d}</p>`}</div>`).join('');showToast(t,d);$('#toast').classList.toggle('alarm',!!alarm);}
function explain(k){if(seen.has(k))return;seen.add(k);const g=GL[k];if(g)coach(g.t,g.d);}
// some lessons only need teaching once ever, not once per level
function explainOnce(k){const done=store.get('zm_seen')||{};if(done[k]){seen.add(k);return;}done[k]=1;store.set('zm_seen',done);explain(k);}
$('#tX').onclick=()=>{$('#toast').hidden=true;toastRoom();};
document.addEventListener('click',e=>{const t=e.target.closest('.term');if(t&&t.dataset.k&&GL[t.dataset.k])showToast(GL[t.dataset.k].t,GL[t.dataset.k].d);});
(function(){const g=$('#gloss');Object.keys(GL).forEach(k=>{const b=document.createElement('button');b.textContent=GL[k].t;b.onclick=()=>showToast(GL[k].t,GL[k].d);g.appendChild(b);});})();
// (in the 3D view, while the Delhi summit's lower third is up, the card sits on top of it)
function placeToast(){const w=$('#wave').getBoundingClientRect(),app=$('#app').getBoundingClientRect(),lt=$('#delegLT');let top=w.top;
  if(document.body.classList.contains('v3')&&lt&&lt.classList.contains('on'))top=Math.min(top,lt.getBoundingClientRect().top);const b=Math.round(app.bottom-top+8)+'px',el=$('#toast');if(el.style.bottom!==b)el.style.bottom=b;}

/* ============ runway logic ============ */
const D_APP=170,SEP_AA=88,SEP_DD=72,MIX_GAP=58,DEP_OCC=55,CHANGE=120;
// set-piece effects: slower changeovers, a pushback freeze or slowdown (reset each level)
const FX={chgK:1,chgUntil:-1,pushFreeze:-1,pushSlow:-1,pushSlowS:0};
let dustNow=false,heatNow=false;
const sepF=()=>dustNow?1.4:fogF>0.3?1.35:1;
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
    const ready=avail.filter(r=>{const td=T+D_APP;let need=r.lastSchedTd+arrSep(r);if(r.mode==='MIX'&&depWaiting(r))need+=MIX_GAP;return td>=need&&td>=r.lastDep+DEP_OCC&&!blockAt(r,td,30)&&!(T<r.noArrUntil);});
    for(const c of cands){if(!ready.length)break;
      if(!c.res&&!c.gate){const g=freeGate(c);if(g){g.res=c;c.res=g;}}
      const gy=gateY(c);ready.sort((a,b)=>Math.abs(a.y-gy)-Math.abs(b.y-gy));const r=ready.shift();beginApproach(c,r,T+D_APP);}
  }
  // departures
  for(const r of RW){
    if(!canDep(r)||r.occ||T<r.arrExit+4||r.gapReq||blockAt(r,T,60))continue;
    const wk=r.lastDepWake==='J'?90:r.lastDepWake==='H'?30:0;
    if(T<r.lastDep+SEP_DD*(dustNow?1.15:fogF>0.3?1.2:1)+wk+(T<r.btUntil?70:0)||T<r.noDepUntil)continue;
    if(r.tdList.some(td=>td-T<DEP_OCC&&td-T>-12))continue;
    const q=flights.filter(f=>f.state==='hp'&&f.rwy===r&&!(needsLong(f)&&r!==LONGEST)).sort((a,b)=>(b.prio-a.prio)||(a.hpSince-b.hpSince));if(!q.length)continue;
    const f=q[0];f.state='lineup';r.occ=f;r.lastDep=T;r.lastDepWake=f.T.wake;f.rollT=T;
    if(r.strike&&r.strike.bad&&T<r.strike.until){r.strike=null;f.burst=true;}
    const st={x:r.x1-60,y:r.y};setPath(f,[{x:f.x,y:f.y},{x:r.x1-30,y:lerp(f.y,r.y,0.6)},st],50);
    radio('TWR',`${cs(f)}, runway ${r.short}, cleared for take-off.`);
  }
}
function assignDep(f,reroute){
  let opts=RW.filter(r=>depModeOk(r)&&T>=r.closedUntil-300&&!(T<r.noDepUntil-120));if(needsLong(f)&&opts.includes(LONGEST))opts=[LONGEST];
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
  if(f.toPark){const p=route(f.exitNode,PARK);if(p){setPath(f,[{x:f.x,y:f.y}].concat(p),TAXI_R);f.state='wedtaxi';}else f.state='towed';return;}
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
  case 'sched':if(f.kind==='dep'){if(T>=f.appearT){const g=freeGate(f,true);if(g){g.occ=f;f.gate=g;f.x=g.x;f.y=g.y;f.heading=g.a;f.state='at_gate';if(HOLDDEP&&f.std<HOLDDEP.until&&T<HOLDDEP.until)sumHold(f);}else if(T>f.std+1800)f.state='cancelled';else f.appearT=T+60;}break;}if(T>=f.spawnT)spawnInbound(f);break;
  case 'inbound':advance(f,dt,150);f.endurance-=dt/60;f.alt=Math.max(1800,f.alt-dt*2);if(f.pd>=f.plen){f.state='holding';f.holdSince=T;f.hu=SIMR()*6000;}fuelCheck(f);break;
  case 'holding':{f.hu+=72*dt;const st=f.stack;const mates=flights.filter(o=>o.state==='holding'&&o.stack===st);f.level=Math.max(0,mates.sort((a,b)=>rk(a)-rk(b)).indexOf(f));const p=stackPos(st,f.hu,f.level);f.x=p.x;f.y=p.y;f.heading+=angDiff(f.heading,p.a)*Math.min(1,dt*2);f.alt=2100+f.level*300;f.endurance-=dt/60;S.holdMin+=dt/60;fuelCheck(f);break;}
  case 'approach':{const fr=clamp((T-f.apT0)/(f.td-f.apT0),0,1);f.pd=fr*f.plen;const p=pointAt(f.path,f.pd);f.x=p.x;f.y=p.y;f.heading+=angDiff(f.heading,p.a)*Math.min(1,dt*1.5);
    if(f.pd>=f.finalStart){const k=(f.pd-f.finalStart)/f.finalLen;f.alt=Math.max(0,700*(1-k/0.96));}else f.alt=lerp(f.startAlt,700,clamp(f.pd/Math.max(1,f.finalStart),0,1));
    if(dustNow&&f.td-T<20&&f.td-T>10&&f.gaRoll<(f.rwy.shear?0.3:0.07)&&!f.gaDone){f.gaDone=true;goAround(f,'windshear in the dust');break;}
    if(f.birdHit&&f.td-T<20&&!f.gaDone){f.gaDone=true;goAround(f,'bird strike on short final');break;}
    if(f.rwy.kiteUntil>T&&T>=f.rwy.kiteFrom&&f.td-T<20&&f.td-T>10&&f.gaRoll<(f.rwy.kiteP||0.25)&&!f.gaDone&&!f.vip){f.gaDone=true;goAround(f,'kite on short final. Yes, a kite');const kc=STO.find(o=>o.k==='kites');if(kc&&kc.hit)kc.hit(f);break;}
    if(f.rwy.gpsUntil>T&&f.td-T<25&&f.td-T>12&&f.gaRoll<0.3&&!f.gaDone&&!f.vip){f.gaDone=true;floater(f.x,f.y,f.alt,'PULL UP','#ff4d3f');goAround(f,'false TERRAIN PULL UP alarm, GPS spoofing');break;}
    if(T>=f.td)touchdown(f);break;}
  case 'rollout':{f.v=Math.max(f.slowRoll?9:14,f.v-(f.slowRoll?2.6:1.15)*dt);const done=advance(f,dt,f.v);if(f.rwy.occ===f&&f.pd>=f.exitAt){f.rwy.occ=null;f.rwy.arrExit=T;floater(f.x,f.y,0,'+1','#a99cff');}if(done){if(f.rwy.occ===f){f.rwy.occ=null;f.rwy.arrExit=T;}startTaxiIn(f);}break;}
  case 'nogate':{if(!f.res){const g=freeGate(f);if(g){g.res=f;f.res=g;}}if(f.res){const p=route(f.exitNode,f.res.lane);if(p){setPath(f,[{x:f.x,y:f.y}].concat(p),TAXI_R);f.state='taxi_in';closeIncFor(f,true);}}break;}
  case 'taxi_in':if(blocked(f))break;if(advance(f,dt,14)){const g=f.res;setPath(f,[{x:G.get(g.lane).x,y:G.get(g.lane).y},{x:g.x,y:g.y}]);f.state='dock';}break;
  case 'dock':if(laneShut(f.res))break;if(advance(f,dt,4)){const g=f.res;g.occ=f;g.res=null;f.gate=g;f.res=null;f.heading=g.a;f.inBlock=T;if(f.turn)toDep(f);else{f.state='parked';f.towAt=T+(20+SIMR()*15)*60;}}break;
  case 'parked':if(f.vip)break;if(T>=f.towAt&&laneClear(f.gate)){const g=f.gate;const p=route(g.lane,PARK);g.occ=null;f.state='tow';setPath(f,[{x:g.x,y:g.y}].concat(p||[]),TAXI_R);f.gate=null;}break;
  case 'wedtaxi':if(advance(f,dt,16))f.state='towed';break;
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
  if(f.notam&&f.endurance<11&&['holding','inbound','goaround'].includes(f.state)){S.notamDiv=(S.notamDiv||0)+1;radio(f.al,`${cs(f)}, diverting to Nagpur's old airport, as planned for the summit.`);divert(f,'planned under the summit NOTAM');return;}
  if(!f.minFuel&&f.endurance<14&&!f.notam){f.minFuel=true;radio(f.al,`${cs(f)}, minimum fuel.`);if(!f.prio)spawnInc('fuel',f);}
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
    Object.assign(I,{f,fs:[f],title:`${fl(f)} can't take off here`,text:`At ${LV.n===3?'46':'40'} °C a ${f.T.name} needs the long runway, ${LONGEST.short}, to get airborne. ${T<LONGEST.closedUntil-300?`${LONGEST.short} is closed, so the only way out is to offload 40 passengers to cut weight and go from here.`:`Send it there (${LONGEST.short} must be on DEP or MIX), or offload 40 passengers to cut weight and go from here.`}`,def:1,defText:'ops offloads 40 passengers from each jet; they miss their flight.',
      acts:[{l:`Taxi to ${LONGEST.short}`,pri:1,dis:()=>!depModeOk(LONGEST)||T<LONGEST.closedUntil-300,fn(){for(const g of I.fs)if(g.state==='hp'||g.state==='taxi_out')sendLong(g);resolve(I,true,`Heavy jets sent to the long runway.`);}},{l:'Offload and go',fn(){for(const g of I.fs){g.offloaded=true;S.cnxMiss+=40;}resolve(I,true,`${I.fs.length*40} passengers offloaded so heavy jets could leave from a short runway.`);}}]});explain('heat');break;}
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
function closeRw(r,secs,why){r.closedUntil=Math.max(r.closedUntil,T+secs);r.why=why;for(const f of flights){if(f.state==='approach'&&f.rwy===r&&!f.vip&&f.td-T>25&&f.td<r.closedUntil+20)goAround(f,why.toLowerCase());}renderRw();}
function resolve(I,ok,msg){const k=incidents.indexOf(I);if(k<0)return;incidents.splice(k,1);if(ok){S.incOk++;if(msg)logE(msg);}renderInc();if(popInc===I)closePop();}
function drop(I){const k=incidents.indexOf(I);if(k<0)return;incidents.splice(k,1);renderInc();if(popInc===I)closePop();}
function closeIncFor(f){for(const I of incidents.slice())if(I.f===f)drop(I);}
function expire(I){const k=incidents.indexOf(I);if(k<0)return;incidents.splice(k,1);S.incDef++;const a=I.def!=null?I.acts[I.def]:null;if(a&&!(a.dis&&a.dis()))a.fn(true);logE(`Left to ops: ${I.defText}`);renderInc();if(popInc===I)closePop();}
function incPos(I){if(I.f)return{x:I.f.x,y:I.f.y};return{x:I.x,y:I.y};}
// an incident's marker at screen point X,Y (2D map and 3D overlay alike): a flight's sits on the aircraft; one on the ground
// (a story's tigress, queue or stage, a runway fault) floats up and to the right on a leader line from a dot on the spot, so
// it never hides the thing it marks; 'up' is how tall the subject stands on screen (the 3D view passes it, so close up the
// badge clears a tigress that fills the shot). Leaves I.sx/I.sy on the badge, the click target.
const hudAt=(x,y)=>{for(const q of HUDR)if(x>q.l-22&&x<q.r+22&&y>q.t-22&&y<q.b+22)return q;return null;};
function incMark(g,I,X,Y,now,up){const ic=I.icon||ICON[I.type],R=13*(1+0.18*Math.sin(now*7));let bx=X,by=Y;
  // (it hangs below the spot instead when lifting it would tuck it under the top strip)
  // (and it leans left instead when leaning right would tuck it under the dashboard)
  if(!I.f){const lift=Math.max(46,(up||0)+26);bx=X+16>(cam.region?cam.region.R:VW)-22?X-16:X+16;by=Y-lift<(cam.region?cam.region.Tp:0)+22?Y+lift:Y-lift;}
  // and no badge, a flight's included, is left under the coach card, the banner, a speaker's popup or any other card over
  // the map: it steps out to the nearest clear side of whatever covers it, on its leader line
  {let q=hudAt(bx,by);if(q){const gr=cam.region||{L:0,R:VW,Tp:0,B:VH},cx=clamp(bx,q.l+22,q.r-22);let bd=1e9,nx=bx,ny=by;
    for(const [x,y] of [[q.r+26,by],[q.l-26,by],[cx,q.t-28],[cx,q.b+28]]){if(x<gr.L+18||x>gr.R-18||y<gr.Tp+18||y>gr.B-18||hudAt(x,y))continue;const d=Math.hypot(x-bx,y-by);if(d<bd){bd=d;nx=x;ny=y;}}
    bx=nx;by=ny;}}
  // (a subject standing tall on screen, as in a close-up, is pointed at from just above it, so the line doesn't cross it out)
  if(bx!==X||by!==Y){const y0=!I.f&&up>60&&by<Y?Y-up*0.55:Y;g.lineCap='round';g.strokeStyle='rgba(0,0,0,.6)';g.lineWidth=4;g.beginPath();g.moveTo(X,y0);g.lineTo(bx,by);g.stroke();
    g.strokeStyle=ic.c;g.lineWidth=2;g.beginPath();g.moveTo(X,y0);g.lineTo(bx,by);g.stroke();
    if(y0===Y){g.fillStyle='rgba(0,0,0,.6)';g.beginPath();g.arc(X,Y,4.5,0,7);g.fill();g.fillStyle=ic.c;g.beginPath();g.arc(X,Y,3,0,7);g.fill();}g.lineCap='butt';X=bx;Y=by;}
  g.fillStyle='rgba(0,0,0,.55)';g.beginPath();g.arc(X,Y,R+5,0,7);g.fill();g.strokeStyle=ic.c;g.lineWidth=3;g.beginPath();g.arc(X,Y,R+3,-Math.PI/2,-Math.PI/2+2*Math.PI*clamp(I.left/I.total,0,1));g.stroke();
  g.fillStyle=ic.c;g.beginPath();g.arc(X,Y,R-2,0,7);g.fill();g.fillStyle='#0b0b0b';g.font='700 15px Barlow Condensed, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(ic.g,X,Y+1);g.textAlign='left';g.textBaseline='alphabetic';I.sx=X;I.sy=Y;}
function incTick(dt){for(const I of incidents.slice()){if(I.f&&['gone','diverted','towed'].includes(I.f.state)){drop(I);continue;}if(I.type==='medical'&&I.f.landT!=null){drop(I);continue;}if(I.simFuse)continue;I.left-=dt;if(I.left<=0)expire(I);}}
function incSpawner(dt){for(const s of LV.script)if(!s.done&&T>=s[0]){if(spawnInc(s[1]))s.done=true;else if((s.tries=(s.tries||0)+1)>12)s.done=true;else s[0]=T+60;}}
// ============ summit day: protocol shuts the whole airport ============
// Real airports close to all other traffic for heads of government. No warning, no choice: that's protocol. The jokes
// are about protocol and logistics, never the leaders, who appear only by title. Four VIP landings, each announced and shown.
let SUM=null;
const FLAG_IN='<svg viewBox="0 0 90 60" class="flag"><rect width="90" height="20" fill="#FF9933"/><rect y="20" width="90" height="20" fill="#fff"/><rect y="40" width="90" height="20" fill="#138808"/><circle cx="45" cy="30" r="8.4" fill="none" stroke="#000080" stroke-width="1.4"/>'+Array.from({length:24},(_,k)=>{const a=k*Math.PI/12;return `<line x1="45" y1="30" x2="${(45+8.2*Math.cos(a)).toFixed(2)}" y2="${(30+8.2*Math.sin(a)).toFixed(2)}" stroke="#000080" stroke-width=".6"/>`;}).join('')+'<circle cx="45" cy="30" r="1.6" fill="#000080"/></svg>';
const FLAG_RU='<svg viewBox="0 0 90 60" class="flag"><rect width="90" height="20" fill="#fff"/><rect y="20" width="90" height="20" fill="#0039A6"/><rect y="40" width="90" height="20" fill="#D52B1E"/></svg>';
// the banner is a compact card in the left margin, west of the runway thresholds as the strategic view frames them (runway
// ends sit at about 50vw - 22vh), so it never hides a runway however tall it gets; the kicker rides on its top edge. The title
// and the line under it wrap to two lines each and step their font down until they fit (banFit), so nothing is ever cut off
(function(){const st=document.createElement('style');st.textContent=`#vipBanner{--banMax:max(260px,min(500px,calc(50vw - 22.5vh - 30px)));position:absolute;box-sizing:border-box;left:max(14px,env(safe-area-inset-left,0px));top:var(--banT,250px);width:max-content;max-width:var(--banMax);min-width:min(var(--kw,0px),var(--banMax));transform:translateX(-24px);z-index:12;opacity:0;pointer-events:none;transition:opacity .45s,transform .45s;
  display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:9px;align-items:center;background:linear-gradient(180deg,rgba(10,13,16,.95),rgba(10,13,16,.9));border:1px solid #f4c430;border-left-width:3px;border-radius:6px;padding:9px 12px 7px 9px;box-shadow:0 10px 26px rgba(0,0,0,.5)}
#vipBanner.slim .flags{max-width:52px}#vipBanner.slim .flag{width:24px;height:16px}#vipBanner.slim .ico{font-size:17px;line-height:19px}
#vipBanner.kin .k{position:static;grid-column:1/-1;max-width:none;white-space:normal;padding:0;margin:-2px 0 3px;background:none;line-height:1.2}#vipBanner.kin .flags{grid-row:2/span 2}
#vipBanner.on{opacity:1;transform:none}#vipBanner .flags{grid-row:1/span 2;display:flex;flex-wrap:wrap;justify-content:center;gap:4px;max-width:64px;align-items:center}#vipBanner.nof{grid-template-columns:minmax(0,1fr)}#vipBanner.nof .flags{display:none}
#vipBanner .flag{width:30px;height:20px;border-radius:2px;box-shadow:0 2px 6px rgba(0,0,0,.5);animation:wave 1.6s ease-in-out infinite;transform-origin:left center}
#vipBanner .flag:nth-child(2){animation-delay:.4s}#vipBanner .flag:nth-child(3){animation-delay:.8s}@keyframes wave{0%,100%{transform:perspective(200px) rotateY(0) skewY(0)}50%{transform:perspective(200px) rotateY(-14deg) skewY(2deg)}}
#vipBanner .k{position:absolute;left:10px;top:-8px;max-width:calc(100% - 20px);box-sizing:border-box;padding:0 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:#0a0d10;border-radius:3px;font-family:var(--f-sign);font-weight:700;letter-spacing:.1em;font-size:var(--ks,10px);line-height:14px;color:#f4c430}
#vipBanner h3{grid-column:-2;margin:0;font-family:var(--f-sign);font-weight:700;font-size:var(--hs,17px);line-height:1.15;letter-spacing:0;color:#fff;text-wrap:balance}
#vipBanner .meme{grid-column:-2;margin-top:2px;font-family:var(--f-sign);font-weight:600;font-size:var(--ms,14px);line-height:1.2;color:#ffd27a;text-wrap:balance;transform-origin:left center;animation:pulse 1.2s ease-in-out infinite}#vipBanner .meme:empty{display:none}@keyframes pulse{50%{transform:scale(1.03)}}
#vipBanner .ico{font-size:20px;line-height:22px;display:inline-block;animation:wave 1.6s ease-in-out infinite}#vipBanner .ico:nth-child(2){animation-delay:.4s}#vipBanner .ico:nth-child(3){animation-delay:.8s}
@media (prefers-reduced-motion:reduce){#vipBanner .flag,#vipBanner .meme,#vipBanner .ico{animation:none}}`;document.head.appendChild(st);
  const b=document.createElement('div');b.id='vipBanner';b.setAttribute('aria-live','polite');$('#app').appendChild(b);
  let rt=0;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(banFit,150);});})();
// fits the banner's text to its box: the kicker widens the box (up to its limit) and then shrinks to one line; the title and
// the line under it step down from 17 and 14 px until each takes two lines at most (three only if a title is still too long
// at the smallest size: readable beats tidy). The banner's height goes to --banH, for the speaker's popup that stacks under it.
function banFit(){const b=$('#vipBanner');if(!b||!b.classList.contains('on'))return;
  const set=(v,px)=>b.style.setProperty(v,px+'px'),k=b.querySelector('.k'),h=b.querySelector('h3'),m=b.querySelector('.meme'),rows=(e,px,lh)=>Math.round(e.offsetHeight/(px*lh));
  for(const v of ['--kw','--ks','--hs','--ms'])b.style.removeProperty(v);b.classList.remove('kin');
  b.classList.toggle('slim',parseFloat(getComputedStyle(b).maxWidth)<360);
  if(k&&k.textContent){set('--kw',k.scrollWidth+24);for(let px=10;px>8.5&&k.scrollWidth>k.clientWidth+1;)set('--ks',px-=0.5);
    if(k.scrollWidth>k.clientWidth+1){b.classList.add('kin');b.style.removeProperty('--kw');}}
  if(h&&h.textContent)for(let px=17;px>14&&rows(h,px,1.15)>2;)set('--hs',px-=0.5);
  if(m&&m.textContent)for(let px=14;px>12&&rows(m,px,1.2)>2;)set('--ms',px-=0.5);
  $('#app').style.setProperty('--banH',b.offsetHeight+'px');}
// the bodyguard: dark suit, sunglasses, earpiece; slides in from the left margin and says his piece. He stands in the banner's
// corner (just under it, when it is up), clear of the runways and of whatever a cinematic is showing mid-screen
(function(){const st=document.createElement('style');st.textContent=`#guard{position:absolute;left:max(14px,env(safe-area-inset-left,0px));top:var(--banT,250px);z-index:13;display:flex;align-items:flex-start;gap:4px;pointer-events:none;transform:translateX(-130%);opacity:0;transition:transform .55s cubic-bezier(.2,.9,.25,1.15),opacity .3s,top .4s .35s}
#guard.on{transform:translateX(0);opacity:1}#vipBanner.on~#guard{top:calc(var(--banT,250px) + max(100px,var(--banH,0px) + 14px));transition:transform .55s cubic-bezier(.2,.9,.25,1.15),opacity .3s,top .4s}#guard svg{order:-1;flex:none;width:92px;height:119px;filter:drop-shadow(0 8px 14px rgba(0,0,0,.6));animation:gbob 2.4s ease-in-out infinite}
@keyframes gbob{50%{transform:translateY(-3px) rotate(-1deg)}}#guard,#guard svg,#vipBanner,#vipBanner .flag,#vipBanner .ico,#vipBanner .meme{will-change:transform}#guard .glint{animation:glint 2.2s ease-in-out infinite}@keyframes glint{0%,70%,100%{opacity:0}80%{opacity:1}}
#guard .bub{margin-top:14px;max-width:var(--bubW,min(240px,calc(50vw - 22.5vh - 140px)));min-width:150px;background:#f4f1e8;color:#121212;font-family:var(--f-sign);font-weight:700;font-size:17px;line-height:1.15;padding:8px 11px;border-radius:10px;position:relative;box-shadow:0 8px 24px rgba(0,0,0,.5)}
#guard .bub::after{content:'';position:absolute;left:-9px;top:16px;border:6px solid transparent;border-right:10px solid #f4f1e8}#guard .bub small{display:block;font-family:var(--f-mono);font-weight:500;font-size:10px;color:#6a6a6a;letter-spacing:.06em;margin-bottom:2px}
/* the 2D map draws the airport on the left and open approach airspace on the right: there the stack mirrors to the right */
body:not(.v3) #vipBanner,body:not(.v3) #guard{left:auto;right:calc(var(--rail) + 36px)}body:not(.v3) #vipBanner{--banMax:min(440px,30vw);transform:translateX(24px)}
body:not(.v3) #guard{transform:translateX(130%)}body:not(.v3) #vipBanner.on,body:not(.v3) #guard.on{transform:none}body:not(.v3) #guard svg{order:0}
body:not(.v3) #guard .bub::after{left:auto;right:-9px;border-right-color:transparent;border-left:10px solid #f4f1e8}
/* short screens: a smaller figure, tucked closer under the banner, so the stack fits the margin */
@media (max-height:760px){#guard svg{width:72px;height:93px}#vipBanner.on~#guard{top:calc(var(--banT,250px) + var(--banH,0px) + 10px)}}
@media (prefers-reduced-motion:reduce){#guard svg,#guard .glint{animation:none}}`;document.head.appendChild(st);
  const g=document.createElement('div');g.id='guard';g.setAttribute('aria-live','assertive');g.innerHTML=`<div class="bub"><small>SECURITY · SPG</small><span id="guardTxt"></span></div>
<svg viewBox="0 0 116 150" aria-hidden="true"><path d="M14 150 C16 112 30 98 58 96 C86 98 100 112 102 150 Z" fill="#14171c"/><path d="M50 97 L58 122 L66 97 Z" fill="#f2f2f2"/><path d="M56 101 L58 128 L60 101 Z" fill="#7a0d12"/>
<path d="M30 104 L50 97 L56 122 L40 128 Z" fill="#0d0f13"/><path d="M86 104 L66 97 L60 122 L76 128 Z" fill="#0d0f13"/><rect x="49" y="80" width="18" height="18" rx="4" fill="#b98262"/>
<ellipse cx="58" cy="58" rx="22" ry="26" fill="#c89070"/><path d="M36 52 C36 34 48 28 58 28 C70 28 80 34 80 50 C76 42 68 40 58 40 C48 40 40 44 36 52 Z" fill="#1c1a19"/>
<rect x="38" y="52" width="17" height="10" rx="4" fill="#0a0a0a"/><rect x="61" y="52" width="17" height="10" rx="4" fill="#0a0a0a"/><rect x="54" y="55" width="8" height="2.4" fill="#0a0a0a"/>
<rect class="glint" x="42" y="54" width="6" height="2" rx="1" fill="#fff"/><path d="M50 74 Q58 77 66 74" stroke="#7a4a36" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<path d="M80 58 C88 62 90 74 86 88 C84 96 82 100 80 104" stroke="#d8d8d8" stroke-width="1.6" fill="none"/><circle cx="80" cy="58" r="3" fill="#2a2a2a"/>
<path d="M96 132 C100 116 96 100 86 92 C84 84 88 70 82 62 C78 58 74 62 76 68 C78 76 74 86 78 96" fill="#1a1d23"/><ellipse cx="80" cy="62" rx="5" ry="6" fill="#c89070"/></svg>`;$('#app').appendChild(g);})();
function guardShow(text,who){const g=$('#guard'),t=$('#guardTxt');if(!g)return;if(!guard.svg)guard.svg=g.querySelector('svg').outerHTML;
  g.querySelector('.bub small').textContent=who?who.badge:'SECURITY · SPG';const sv=g.querySelector('svg'),want=who&&who.svg?who.svg:guard.svg;if(guard.cur!==want){sv.outerHTML=want;guard.cur=want;}
  t.textContent=text;g.classList.add('on');}
// the bodyguard by default; set pieces bring their own character (badge + 116x150 svg). When sound is on the bodyguard
// speaks, and his popup follows his voice line by line.
function guard(lines,who,o){const g=$('#guard');if(!g||ended)return;clearTimeout(guard.t1);clearTimeout(guard.t2);o=o||{};
  if((!who||(typeof SPG_AUDIO!=='undefined'&&lines.every(t=>SPG_AUDIO[t])))&&speak(lines,{gap:o.gap,gaps:o.gaps,endGap:o.endGap,valid:o.valid,pri:o.pri,hold:o.hold,onLine:i=>{clearTimeout(guard.t2);guardShow(lines[i],who);if(o.onLine)o.onLine(i);},onDone:()=>{guard.t2=setTimeout(()=>g.classList.remove('on'),1400);if(o.onDone)o.onDone();}}))return;
  guardShow(lines[0],who);if(o.onLine)o.onLine(0);let i=0;const step=()=>{i++;if(i<lines.length){$('#guardTxt').textContent=lines[i];if(o.onLine)o.onLine(i);guard.t1=setTimeout(step,2600);}};
  if(lines.length>1)guard.t1=setTimeout(step,2600);guard.t2=setTimeout(()=>{g.classList.remove('on');if(o.onDone)o.onDone();},2600*(lines.length-1)+3600+(o.extra||0));}
// the voice: pre-recorded clips (voice/spg_audio.js maps each line to voice/clips/*.mp3) one after another with pauses; a line without a clip falls back
// to the browser's speech at a natural pitch, with the best Indian English voice the device has
/*@@VOICE@@*/
// The queue is ordered so that a line is heard while what it describes is still on screen (pri, highest first; FIFO within):
//  3 a set piece's own beat (a ceremonial announcement, a line that belongs to a shot, the fog chain): next in line, and
//    never dropped for age; give it valid() instead (a VIP's announcement goes once its aircraft is down; cut() stops it)
//  2 a character speaking in a popup (the SPG, the wedding planner, the met office): dropped if it cannot start in 12 s
//  1 radio chatter (say): dropped if it cannot start within 4 s (or 150 game seconds). Heard late, it would describe the past
// One call's lines stay together, and at most VQ_MAX lines wait (whole calls go, oldest chatter first). A line may carry
// hold: while it plays the sim runs no faster than that (VHOLD), so what it describes does not run away from it.
const VQ=[];let vqOn=false,vqCur=null,vqIt=null,vqDone=null,vqT0=0,vqG=null,vqGen=0,VHOLD=null,FFING=false;
const VQ_TTL={1:[4000,150],2:[12000,600]},VQ_MAX=8;
// voicePreload(keys): start fetching the clips for these on-screen lines now, so they play without a gap when their turn
// comes (speak() and say() call it for every line they queue; set pieces may call it early with their whole script)
const VPRE=new Map();
function voicePreload(keys){if(typeof SPG_AUDIO==='undefined'||!SND.on)return;(Array.isArray(keys)?keys:[keys]).forEach(k=>{const u=SPG_AUDIO[k];if(!u||VPRE.has(u))return;
  try{const a=new Audio();a.preload='auto';a.src=u;a.load();VPRE.set(u,a);}catch(e){}});}
// a line can carry an accent (lang, e.g. 'ru-RU'): its clip is recorded in that voice; without a clip the browser's voice for
// that language reads it (accented English), and a radio call with no clip and no matching voice stays silent
function pickVoice(vs,lang){const sc=v=>(/en[-_]IN/i.test(v.lang)?4:/en[-_]GB/i.test(v.lang)?2:/^en/i.test(v.lang)?1:0)+(/enhanced|premium|natural|neural|google/i.test(v.name)?3:0)+(/aman/i.test(v.name)?2:0)-(/rishi|compact/i.test(v.name)?1:0);
  if(lang){const L=lang.toLowerCase().replace('_','-'),m=vs.filter(v=>v.lang.toLowerCase().replace('_','-').startsWith(L.split('-')[0])&&(L.indexOf('-')<0||v.lang.toLowerCase().replace('_','-')===L||true));
    const q=v=>(v.lang.toLowerCase().replace('_','-')===L?2:0)+(/enhanced|premium|natural|neural|google/i.test(v.name)?1:0);return m.sort((a,b)=>q(b)-q(a))[0]||null;}
  return vs.slice().sort((a,b)=>sc(b)-sc(a))[0]||null;}
// sound follows the game: paused, ended, on the menu or in a background tab, the voice and the music hold where they
// are and carry on when play resumes; no new line starts while held
const audioHold=()=>!running||paused||ended||document.hidden;let AHELD=false;
function audioSync(){const h=audioHold();if(h===AHELD)return;AHELD=h;
  try{if(vqCur){if(h)vqCur.pause();else{const p=vqCur.play();if(p&&p.catch)p.catch(()=>{});}}}catch(e){}
  try{if(MUS&&MUS.el){if(h)MUS.el.pause();else{const p=MUS.el.play();if(p&&p.catch)p.catch(()=>{});}}}catch(e){}
  try{if(window.speechSynthesis){if(h)speechSynthesis.pause();else speechSynthesis.resume();}}catch(e){}
  if(!h)vqNext();}
document.addEventListener('visibilitychange',audioSync);
function vqAdd(items){if(!items.length)return null;const g={on:false},p=items[0].pri,now=performance.now();
  for(const it of items){it.g=g;it.born=now;it.bornT=T;}
  // (a call already under way keeps its turn against equal or lower priority; a set piece's beat goes before its next line)
  let i=0;while(i<VQ.length&&VQ[i].pri>=p)i++;VQ.splice(i,0,...items);
  while(VQ.length>VQ_MAX){let v=null;for(const it of VQ)if(it.g!==vqG&&it.pri<3&&(!v||it.pri<v.pri))v=it;if(!v)break;vqDrop(v.g);}
  // a set piece's beat does not wait for radio chatter to finish: the chatter is cut
  if(p>=3&&vqIt&&vqIt.pri<=1&&vqDone){if(window.speechSynthesis)try{speechSynthesis.cancel();}catch(e){}vqDone();}
  vqNext();return items;}
function vqClear(maxPri){for(let i=VQ.length-1;i>=0;i--)if(VQ[i].pri<=maxPri&&VQ[i].g!==vqG)VQ.splice(i,1);}
// a set piece takes the air: everything of priority maxPri or below goes, the line playing now included (stopped mid-word)
function vqCut(maxPri){for(let i=VQ.length-1;i>=0;i--)if(VQ[i].pri<=maxPri)VQ.splice(i,1);
  if(vqIt&&vqIt.pri<=maxPri&&vqDone){if(vqCur)try{vqCur.pause();}catch(e){}if(window.speechSynthesis)try{speechSynthesis.cancel();}catch(e){}vqDone();}}
function vqDrop(g){let last=null;for(let i=VQ.length-1;i>=0;i--)if(VQ[i].g===g){if(!last)last=VQ[i];VQ.splice(i,1);}if(last&&last.onEnd)last.onEnd();}
function vqStale(it,now){if(it.valid&&!it.valid())return true;if(it.g.on)return false;const L=VQ_TTL[it.pri];return !!L&&(now-it.born>L[0]||T-it.bornT>L[1]);}
// real seconds until a queued (or playing) line has been heard: the clip's own length once it is loaded, else an estimate
const vqEst=it=>0.6+it.text.split(/\s+/).length/2.1;
function vqEta(it){const now=performance.now();let s=0;
  if(vqIt){const a=vqCur,d=a&&isFinite(a.duration)&&a.duration>0?a.duration-a.currentTime:vqEst(vqIt)-(now-vqT0)/1000;s+=Math.max(0.1,d);if(vqIt===it)return s;s+=vqIt.gap/1000;}
  for(const x of VQ){s+=vqEst(x);if(x===it)return s;s+=x.gap/1000;}return null;}
function vqNext(){if(vqOn||audioHold())return;const now=performance.now();let it;
  while((it=VQ[0])&&vqStale(it,now)){if(it.g.on){VQ.shift();if(it.onEnd)it.onEnd();}else vqDrop(it.g);if(vqOn)return;}
  if(!it)return;VQ.shift();vqOn=true;vqG=it.g;it.g.on=true;vqIt=it;vqT0=now;const gen=vqGen;let fin=false,cutI=0,wd=null;
  if(it.hold!=null)VHOLD=it.hold;vqDone=()=>done();
  const done=()=>{if(fin)return;fin=true;clearInterval(cutI);clearTimeout(wd);if(gen!==vqGen)return;{const a=vqCur;if(a){try{a.onended=a.onerror=a.onplaying=null;a.pause();}catch(e){}}}vqCur=null;vqIt=null;vqDone=null;if(VHOLD===it.hold)VHOLD=null;duck(false);if(it.onEnd)it.onEnd();setTimeout(()=>{if(gen!==vqGen)return;vqOn=false;vqNext();},Math.max(500,it.gap||0));};   // at least half a second between any two voices
  if(it.cut)cutI=setInterval(()=>{if(gen!==vqGen){clearInterval(cutI);return;}if(!it.cut())return;if(vqCur)try{vqCur.pause();}catch(e){}if(window.speechSynthesis)try{speechSynthesis.cancel();}catch(e){}done();},200);
  if(it.onStart)it.onStart();const clip=typeof SPG_AUDIO!=='undefined'&&SPG_AUDIO[it.text];
  if(clip){const a=VPRE.get(clip)||new Audio(clip);VPRE.delete(clip);vqCur=a;a.volume=it.vol||0.95;a.onended=done;a.onerror=done;duck(true);const p=a.play();if(p&&p.catch)p.catch(done);
    // the watchdog starts when the sound actually starts and trusts the clip's real length; while the game is held it waits
    const words=it.text.split(/\s+/).length,wdog=()=>{if(audioHold()){wd=setTimeout(wdog,500);return;}done();};
    a.onplaying=()=>{clearTimeout(wd);const d=isFinite(a.duration)&&a.duration>0?a.duration*1000:2500+words*600;wd=setTimeout(wdog,d+1500);};
    wd=setTimeout(wdog,9000+words*600);   // it never started playing at all (blocked or failed to load): move on
    return;}
  if(!it.radio&&window.speechSynthesis&&window.SpeechSynthesisUtterance){try{const S2=window.speechSynthesis,v=pickVoice(S2.getVoices(),it.lang);if(it.lang&&!v)return done();const u=new SpeechSynthesisUtterance(it.text.replace(/[\u{1F000}-\u{1FAFF}☀-➿️]/gu,'').trim());
    if(v){u.voice=v;u.lang=v.lang;}else u.lang='en-IN';u.rate=0.95;u.pitch=1;u.onend=done;u.onerror=done;duck(true);S2.speak(u);wd=setTimeout(done,9000);return;}catch(e){}}
  done();}
// speak(lines,{onLine,onDone,gap,endGap,gaps,lang,pri,hold,valid}): lines one after another; the gap after each line is
// gaps[i], else gap (1200 ms: the SPG takes his time), and endGap after the last line
function speak(lines,o){o=o||{};if(!SND.on||ended)return false;voicePreload(lines);vqAdd(lines.map((t,i)=>{const last=i===lines.length-1;return{text:t,lang:o.lang,valid:o.valid,pri:o.pri||2,hold:o.hold,gap:o.gaps&&o.gaps[i]!=null?o.gaps[i]:last?(o.endGap!=null?o.endGap:900):(o.gap!=null?o.gap:1200),onStart:o.onLine?()=>o.onLine(i):null,onEnd:last?o.onDone:null};}));return true;}
// a radio call in a speaker's own voice: shows on the ticker, and plays its recorded clip (keyed by the exact text) if there
// is one. o: {pri (1), valid, cut, hold, gap, vol, onStart, onEnd, ref (gets .it, the queued line)}
// the same radio line is never voiced twice within 30 s (a set piece that re-sends a call each tick can't make it echo),
// unless the repeat is the point (o.again: Russia Two's announcement is Russia One's, word for word)
const VQ_SEEN=new Map();
function say(src,text,o){o=o||{};radio(src,text);const now=performance.now(),seen=VQ_SEEN.get(text);if(SND.on&&!ended&&typeof SPG_AUDIO!=='undefined'&&SPG_AUDIO[text]&&!(seen&&now-seen<30000&&!o.again)){VQ_SEEN.set(text,now);voicePreload(text);const q=vqAdd([{text,radio:true,pri:o.pri||1,gap:o.gap!=null?o.gap:500,vol:o.vol,valid:o.valid,cut:o.cut,hold:o.hold,onStart:o.onStart,onEnd:o.onEnd}]);if(o.ref)o.ref.it=q[0];return true;}if(o.onEnd)o.onEnd();return false;}
// silence: the queue, the line playing (its callbacks are dropped with it) and, unless keepMusic, the music
function voiceReset(keepMusic){VQ.length=0;VQ_SEEN.clear();vqGen++;if(vqCur){try{vqCur.pause();}catch(e){}}vqCur=null;vqIt=null;vqDone=null;vqG=null;vqOn=false;VHOLD=null;if(window.speechSynthesis)try{speechSynthesis.cancel();}catch(e){}duck(false);
  if(!keepMusic){music(null,{now:true});const g=$('#guard');if(g)g.classList.remove('on');}}
// music for set pieces: music('dj') plays music/dj.mp3 (looped unless {loop:false}), crossfading from whatever was playing;
// music(null) fades it out. It ducks under voice lines. A missing file is simply silent, so tracks can be dropped in later.
var MUS={el:null,name:null,vol:0.4,tm:null,fi:null};
function musFade(a,to,ms,cb){const from=a.volume,t0=performance.now();const st=()=>{const k=Math.min(1,(performance.now()-t0)/ms);try{a.volume=Math.max(0,Math.min(1,from+(to-from)*k));}catch(e){}if(k<1)a._f=requestAnimationFrame(st);else if(cb)cb();};cancelAnimationFrame(a._f);st();}
function music(name,o){o=o||{};if(!MUS)return;if(name&&MUS.name===name&&MUS.el)return;clearTimeout(MUS.tm);const old=MUS.el;MUS.el=null;MUS.name=null;
  if(old){if(o.now){old.pause();}else musFade(old,0,o.fadeOut||1500,()=>old.pause());}
  if(!name||!SND.on||ended)return;const src=(typeof MUSIC_SRC!=='undefined'&&MUSIC_SRC[name])||`music/${name}.mp3`;const a=new Audio(src);a.loop=o.loop!==false;a.volume=0;
  MUS.el=a;MUS.name=name;MUS.vol=o.vol!=null?o.vol:0.4;a.onerror=()=>{if(MUS.el===a){MUS.el=null;MUS.name=null;}};const p=a.play();if(p&&p.catch)p.catch(()=>{});musFade(a,vqCur?MUS.vol*0.2:MUS.vol,o.fadeIn||1200);
  if(!a.loop)a.onended=()=>{if(MUS.el===a){MUS.el=null;MUS.name=null;}};if(o.ms)MUS.tm=setTimeout(()=>{if(MUS.el===a)music(null);},o.ms);}
function duck(on){const a=MUS&&MUS.el;if(a)musFade(a,on?MUS.vol*0.2:MUS.vol,on?250:700);}
// after a summit the SPG hands the runways back one by one, then signs off
function spgReturn(order){const n=order.length;guard(['Your runways shall now be cleared, in a staged manner.'].concat(order.map((r,i)=>i===0?`Runway ${r.short} shall be cleared first.`:i===n-1?`And finally, runway ${r.short}.`:`Then runway ${r.short}.`)));}
function spgOpen(r){}
function spgFinale(){setTimeout(()=>guard(['Thank you, sir, for this.','And thank you for serving the nation.','Jai Hind.'],null,
  {extra:2500,gaps:[1800,2300],endGap:1500,onLine:i=>{if(i===0)vipBanner(true,'SECURITY · SPG','Thank you for serving the nation','Jai Hind 🇮🇳',FLAG_IN);},onDone:()=>setTimeout(()=>{if(!CINE)vipBanner(false);},1800)}),4000);}
// the SPG hands the runways back one at a time, in step with his voice: he names a runway, it reopens about a minute later
// (lead), and only then does he name the next one (step apart); then a pause and his sign-off. It runs in sim time, so bots
// and fast-forward see the same schedule; while he speaks with sound on, the game is held at 1x so his voice keeps up.
// spgStaged.times(t0,n,o) gives the reopen times, so a set piece can end its runway blocks to match.
const STAGED=[];
function spgStaged(rws,o){o=o||{};const t0=o.at!=null?o.at:T,n=rws.length,tm=spgStaged.times(t0,n,o),s={lv:LV,t0,ev:[],prev:null};
  const line=i=>i===0?`Runway ${rws[0].short} shall be cleared first.`:i===n-1?`And finally, runway ${rws[i].short}.`:`Then runway ${rws[i].short}.`;
  const hold=()=>{if(SND.on&&speed>1&&s.prev==null){s.prev=speed;speed=1;if(running)setSpeed(1,true);}};
  // (each line is said only while it is still ahead of the runway it names, and the clock runs at half speed while he
  // and the tower speak, so a line and the next runway never run into each other)
  s.ev.push([t0,()=>{hold();guard(['Your runways shall now be cleared, in a staged manner.'],null,{valid:()=>T<tm.open[0],hold:0.5});}]);
  rws.forEach((r,i)=>{s.ev.push([tm.say[i],()=>{hold();guard([line(i)],null,{valid:()=>T<tm.open[i],hold:0.5});}]);s.ev.push([tm.open[i],()=>{if(o.open)o.open(r,i);say('TWR',`Runway ${r.short} is back in service.`,{hold:0.5});renderRw();}]);});
  s.ev.push([tm.open[n-1]+1,()=>{if(s.prev!=null){speed=s.prev;if(running)setSpeed(speed,true);s.prev=null;}if(o.done)o.done();if(o.finale!==false)spgFinale();}]);
  s.ev.sort((a,b)=>a[0]-b[0]);STAGED.push(s);return tm;}
spgStaged.times=(t0,n,o)=>{o=o||{};const first=o.first||100,lead=o.lead||60,step=o.step||110,say=[],open=[];for(let i=0;i<n;i++){say.push(t0+first+step*i);open.push(t0+first+step*i+lead);}return{say,open};};
function stagedTick(){for(const s of STAGED.slice()){if(s.lv!==LV||T<s.t0-5){STAGED.splice(STAGED.indexOf(s),1);continue;}while(s.ev.length&&T>=s.ev[0][0])s.ev.shift()[1]();if(!s.ev.length)STAGED.splice(STAGED.indexOf(s),1);}}
function vipBanner(on,k,title,meme,icons){const b=$('#vipBanner');if(!on){b.classList.remove('on');return;}const g=$('#guard');if(g&&icons==null)g.classList.remove('on');const fl=icons==null?FLAG_IN+FLAG_RU:icons;b.innerHTML=`<div class="flags">${fl}</div><div class="k">${k}</div><h3>${title}</h3><div class="meme">${meme}</div>`;b.classList.toggle('nof',!fl);b.classList.add('on');banFit();}
// Level 3's summit, beat by beat; every line is tied to something the player can see at that moment:
//  E       the SPG takes every runway, finals go around, flow control holds later arrivals at their origins
//  PM      as Air India One turns final the SPG's ceremonial announcer names it and its runway (music 'india'); the camera
//          rides it down onto that runway
//  RUSSIA  the Russian protocol officer announces the An-124 with the motorcade, then the two identical Il-96s (music
//          'rasputin', only while they are on approach and landing); each is shown landing on the runway it names
//  APRON   the Prime Minister receives the President at the VIP stands; the motorcade drives off to Tadoba
//  RETURN  spgStaged: the SPG names each runway and it reopens a game minute later; then his sign-off; then the stack
// Voice first, one VIP at a time: its announcement plays over the strategic view (banner up, its music in), and only as it
// ends does the camera ride the aircraft down from short final; the next announcement waits until this one has landed.
// The summit runs live (PACE, as L4's does) from the takeover until the SPG starts handing the runways back (the apron
// ceremony included): about a third of normal speed between the VIPs, and while an announcement plays the clock is paced
// (vipPace) so that its aircraft reaches short final (SUMT.fin game seconds out) just as the voice ends, however long the
// line or whatever was still being said. The sim's own times do not change (fast-forward and the bots see the same
// summit); only how fast real time walks through them.
// Lines for the gaps between VIPs (SUM.fill) wait for a gap long enough to finish in, and go if their moment passes.
// Everything here is event-driven and allocation-free per tick (no DOM work outside the events).
const SUMT={pm:200,an:390,il1:550,il2:680,ret:800,cue:110,fin:40,first:100,step:110,lead:60};
const SUMV={gap:0.3,shot:0.25};   // live pace (1 = 1x) between VIPs, and while the camera rides one down
// a character's popup that follows their recorded voice line by line, like the SPG's; without clips it reads at 2.6 s a line
function voiced(lines,who,o){o=o||{};const g=$('#guard');if(!g||ended)return;
  if(!(SND.on&&typeof SPG_AUDIO!=='undefined'&&lines.every(t=>SPG_AUDIO[t])))return guard(lines,who,o);
  clearTimeout(guard.t1);clearTimeout(guard.t2);
  speak(lines,{gap:o.gap!=null?o.gap:700,pri:o.pri,hold:o.hold,onLine:i=>{clearTimeout(guard.t2);guardShow(lines[i],who);if(o.onLine)o.onLine(i);},onDone:()=>{guard.t2=setTimeout(()=>g.classList.remove('on'),1400);if(o.onDone)o.onDone();}});}
function startSummit(){
  const open=RW.filter(r=>!r.locked&&r.mode!=='OFF');if(open.length<2)return false;S.summitAt=T;
  vqCut(1);const E=T,order=open.slice().sort((a,b)=>b.len-a.len),ret=E+SUMT.ret,so={first:SUMT.first,step:SUMT.step,lead:SUMT.lead},tm=spgStaged.times(ret,order.length,so);
  // every runway is the SPG's until he names it in the staged return; the blocks end exactly when he reopens each one
  const blk=order.map((r,i)=>{const b={from:E,to:tm.open[i],why:'Security (VVIP)',summit:true};r.blocks.push(b);r.blocks.sort((a,c)=>a.from-c.from);return b;});
  let waved=0;for(const f of flights)if(f.state==='approach'&&f.td-T>25&&f.rwy&&open.includes(f.rwy)&&!f.vip){goAround(f,'VVIP protocol, all runways closed');waved++;}
  // the airlines thin the window (a third of the arrivals nobody connects from, a quarter of the departures) and flow control
  // holds the remaining arrivals at their origins, releasing them to reach Nagpur from about ten minutes before the first
  // runway comes back: a real stack to work afterwards, without a fuel crisis in it
  const refd=new Set();for(const f of flights)if(f.links)for(const l of f.links)refd.add(l.arr);
  let nc=0,ka=0,kd=0;for(const f of flights){
    if(f.kind==='arr'&&f.state==='sched'&&!f.vip&&f.spawnT>T&&f.eta>E+120&&f.eta<tm.open[0]+300&&!refd.has(f)&&ka++%3===2){f.state='diverted';f.cancelled=true;f.turn=null;if(f.res){f.res.res=null;f.res=null;}nc++;}
    else if(f.kind==='dep'&&f.state==='at_gate'&&!f.charter&&f.std>E&&f.std<tm.open[0]&&kd++%4===3){if(f.gate){f.gate.occ=null;f.gate=null;}f.state='cancelled';nc++;}}
  // (due between E+4 min and the first reopening: released in order to arrive from 2 minutes before it to 10 minutes after
  // the last one, so the stack afterwards is a recovery job of about 20 minutes, not an endless one)
  const a0=E+240,a1=tm.open[0],b0=tm.open[0]-120,b1=tm.open[tm.open.length-1]+600;let held=0;
  for(const f of flights)if(f.kind==='arr'&&f.state==='sched'&&!f.vip&&f.eta>a0&&f.eta<a1&&f.spawnT>T){const eta=b0+(f.eta-a0)*(b1-b0)/(a1-a0);if(eta>f.eta+30){f.spawnT+=eta-f.eta;f.eta=eta;held++;}}
  // the red carpet goes to the free stand nearest the runway exit each VIP will take, so the taxi in is short
  const pick=(type,r)=>{const T_=TYPES[type],need=T_.code==='F'?2200:T_.code==='E'?1900:1300,tx=r.x1-450,ex=r.exits.find(e=>tx-e.x>=need)||r.exits[r.exits.length-1],n=G.get(ex.to);
    return GATES.filter(g=>g.open&&!g.occ&&!g.res&&!marsBusy(g)&&CR[g.code]>=CR[T_.code]).sort((a,b)=>dist(a.x,a.y,n.x,n.y)-dist(b.x,b.y,n.x,n.y))[0]||null;};
  const vip=(al,type,disp,call,from,code,td,rw,o)=>{const f=mk({kind:'arr',state:'sched',al,type,intl:al!=='IN1',from,fromCode:code,dir:'W',eta:td,endurance:180});
    Object.assign(f,{num:'1',disp,callsign:call,vip:true,origEta:td,spawnT:1e12,vipRw:rw,vipTd:td},o);const g=pick(type,rw);if(g){g.res=f;f.res=g;f.stand=g;}return f;};
  // the Prime Minister on the long runway; the Russians on the other long one nearest the terminal
  const rp=order[0],rr=order.slice(1,3).sort((a,b)=>Math.abs(a.y-procC.y)-Math.abs(b.y-procC.y))[0]||order[0];cinema.q.length=0;
  const pm=vip('IN1','B77W','Air India One','INDIA ONE','Delhi','DEL',E+SUMT.pm,rp,{mus:'india',src:'SPG',
    ann:`Ladies and gentlemen. The aircraft carrying the Honourable Prime Minister of India shall now be landing on runway ${rp.short}.`,
    ban:['SPG · CEREMONIAL ARRIVAL','The Honourable Prime Minister of India',`Air India One · Boeing 777 · on final for runway ${rp.short}`,FLAG_IN],
    hello:'Air India One, welcome to Zero Mile. Follow the car with the very large flag.'});
  const an=vip('RSD','A124','Antonov An-124','RUSSIA CARGO','Moscow','VKO',E+SUMT.an,rr,{mus:'rasputin',src:'RUSSIAN PROTOCOL',
    ann:`Ladies and gentlemen. The motorcade of His Excellency the President of the Russian Federation will now land on runway ${rr.short}. By Antonov.`,
    ban:['PROTOCOL · RUSSIAN FEDERATION','The motorcade arrives first',`Antonov An-124 on final for runway ${rr.short} · the cars have their own aeroplane 🚗`,FLAG_RU],
    hello:'Antonov, welcome to Zero Mile. Please do not park on the red carpet.'});
  const ilAnn=`Ladies and gentlemen. The aircraft of His Excellency the President of the Russian Federation will now land on runway ${rr.short}.`;
  const il1=vip('RSD','IL96','Russia One','RUSSIA ONE','Moscow','VKO',E+SUMT.il1,rr,{mus:'rasputin',src:'RUSSIAN PROTOCOL',ann:ilAnn,
    ban:['PROTOCOL · RUSSIAN FEDERATION','His Excellency the President of the Russian Federation',`Russia One · Ilyushin Il-96 on final for runway ${rr.short} 🎶`,FLAG_RU],
    hello:'Russia One, welcome to Zero Mile. Your follow-me car is the other car with the very large flag.'});
  const il2=vip('RSD','IL96','Russia Two','RUSSIA TWO','Moscow','VKO',E+SUMT.il2,rr,{mus:'rasputin',src:'RUSSIAN PROTOCOL',ann:ilAnn,
    ban:['PROTOCOL · RUSSIAN FEDERATION','The same announcement. The identical Il-96.',`Russia Two on final for runway ${rr.short} · which one was his? Classified 🎶`,FLAG_RU],
    hello:'Russia Two, welcome. Yes, you look exactly like Russia One. Follow the third car with the very large flag.'});
  SUM={E,ret,tm,order,blk,vips:[pm,an,il1,il2],ci:0,cine:null,ann:null,ev:[],fill:[],pm,an,il1,il2,held};
  // timed lines (relative to E); the rest are events below (spawned, landed, docked) and gap lines (SUM.fill)
  SUM.ev=[[15,()=>{if(held||nc){radio('ATC',`Airlines have cancelled ${nc} flights for the summit. Flow control is holding ${held} more on the ground at their origins until the runways come back.`);logE(`The summit: ${nc} flights cancelled, ${held} arrivals held at their origins.`);}}],
    ];
  // the SPG's joke: only if it can be finished before the Prime Minister's announcement is due (it is on the log either way)
  SUM.fill.push({src:'SPG',text:'Can you have one runway back? No. We have chosen the runways. We choose the order. We are very fast at saying no.',from:E+40,slack:-1,ok:()=>SUM.ci<1});
  say('TWR',`All stations, summit protocol: every runway at Zero Mile is closed.${waved?` ${waved} on final, go around.`:''} Everyone else, hold.`,{pri:2});
  guard(['Sir. We have taken over your runways.','All of them. Yes, the long one too.']);
  logE('The summit: the SPG took every runway.');renderRw();return true;
}
// a VIP's turn begins: the announcement (it jumps the queue; dropped if the aircraft is somehow down first, cut if it lands
// while it plays), the banner and its music, over the strategic view. Without sound the line stays up for a reading time.
function vipAnn(f){const s=SUM,a={f,done:false,it:null,read:0};s.ann=a;f.annT=T;
  vipBanner(true,f.ban[0],f.ban[1],f.ban[2],f.ban[3]);
  if(f.mus==='rasputin')music('rasputin',{vol:0.5});else music(f.mus||null,{fadeOut:900});
  logE(f.ann);if(!say(f.src,f.ann,{pri:3,gap:300,ref:a,again:true,valid:()=>f.landT==null,cut:()=>f.landT!=null,onEnd:()=>{a.done=true;}})){a.done=false;a.read=performance.now()+Math.max(1800,f.ann.length*60);}}
// real seconds until the announcement has been heard (or read)
// (a line silenced without being heard, by a sound switch or a reset, counts as heard)
function vipEta(a){if(a.read)return Math.max(0,(a.read-performance.now())/1000);if(a.done||!a.it)return 0;const e=vqEta(a.it);if(e==null){a.done=true;return 0;}return e;}
// ...then the shot: the camera rides it down from short final; it ends 3.6 s after touchdown, once the tower's welcome is heard
function vipShot(f){const s=SUM;s.ann=null;s.cine={f,landed:0,vo:false};
  if(V3.on&&V3.ready){if(!s.prevCam)s.prevCam={t:Object.assign({},C3.t)};V3.mode='approach';C3.follow=f;C3.fpos=null;C3.apT=-99;camLabel();}else centerOn(f.x,f.y);}
function vipCineEnd(){const s=SUM,c=s.cine;s.cine=null;
  // the music carries on into the next VIP's announcement if it shares it and is due soon (the Russians); else it fades
  const nx=s.vips[s.ci],soon=nx&&nx.landT==null&&!['gone','diverted'].includes(nx.state)&&T>=nx.vipTd-SUMT.cue-120;
  if(!(soon&&nx.mus===c.f.mus))music(null,{fadeOut:2200});
  vipBanner(false);
  if(V3.on&&V3.ready&&s.prevCam){setCam('map');Object.assign(C3.t,s.prevCam.t);s.prevCam=null;}}
// the live pace: between VIPs a third of normal speed; while an announcement plays, whatever brings its aircraft to short
// final as the voice ends (so it never lands under its own announcement, and never waits long after it); during the shot
// a slow-motion quarter speed. Real time only: the sim's schedule is untouched.
function vipPace(s){if(s.ann){const a=s.ann,need=a.f.td-SUMT.fin-T,eta=vipEta(a);return eta>0.05?clamp(need/eta/BASE,0.03,0.6):SUMV.gap;}
  return s.cine?SUMV.shot:SUMV.gap;}
// a gap line may start when nobody is being announced or shown, the radio is free, and it can finish (at the live pace)
// before the next VIP's announcement is due (or a few seconds into its turn: the pacing absorbs that)
function sumFits(s,x){if(s.ann||s.cine||CINE||vqOn||VQ.length)return false;const nx=s.vips[s.ci];if(!nx||!SND.on)return true;
  if(x.est==null)x.est=vqEst(x);return (nx.vipTd-SUMT.cue-T)/(SUMV.gap*BASE)>x.est-(x.slack!=null?x.slack:4);}
// while anyone speaks during the summit the game runs at no more than 1x, so each line is heard with what it describes
function sumHold(s,off){if(!off&&SND.on&&!s.cine&&!CINE&&(vqOn||VQ.length)){if(speed>1){if(s.hold==null)s.hold=speed;speed=1;if(running)setSpeed(1);}}
  else if(s.hold!=null&&(off||(!vqOn&&!VQ.length&&!STAGED.length&&!s.cine&&!CINE))){speed=s.hold;s.hold=null;if(running)setSpeed(speed);}}
function summitTick(){
  const s=SUM;if(!s)return;const t=T-s.E;sumHold(s);
  while(s.ev.length&&t>=s.ev[0][0])s.ev.shift()[1]();
  for(const f of s.vips){
    if(f.state==='sched'&&T>=f.vipTd-D_APP-10){const r=f.vipRw;f.x=r.x1+14000;f.y=r.y+(r.y<0?-2600:2600);f.alt=2000;f.heading=Math.PI;f.state='inbound';beginApproach(f,r,f.vipTd);
      if(f===s.pm)say('APP',`Air India One, Nagpur Approach, radar contact. Expect runway ${r.short}.`);
      else if(f===s.an)s.fill.push({src:'APP',text:`An Antonov An-124 is inbound for ${r.short} with the Russian motorcade. The motorcade has its own aeroplane.`,from:T,ok:()=>s.an.annT==null&&s.an.landT==null});}
    // the tower's welcome belongs to the landing shot: the shot stays up until it has been heard
    if(f.landT!=null&&!f.helloed){f.helloed=true;const c=s.cine&&s.cine.f===f?s.cine:null;if(c)c.vo=true;say('TWR',f.hello,{pri:3,onEnd:()=>{if(c)c.vo=false;}});}
    if(f.inBlock!=null&&!f.docked){f.docked=T;
      // (what is seen happens at once; its line waits for a gap, and goes if the moment passes first)
      if(f===s.pm){if(f.stand)MARKS.push({x:f.stand.x,y:f.stand.y,e:'🇮🇳',until:T+1500,px:24});
        s.fill.push({src:'PROTOCOL',text:'The Honourable Prime Minister is on the red carpet, to receive His Excellency the President of the Russian Federation.',from:T,ok:()=>!s.shook});}
      else if(f===s.an&&f.stand){const g=s.pm.stand||f.stand,t1=T+240;MARKS.push({e:'🚗',n:4,sp:120,px:18,path:[[f.stand.x,f.stand.y],[lerp(f.stand.x,g.x,0.5),lerp(f.stand.y,g.y,0.5)+80],[g.x,g.y+60]],t0:T,t1,until:T+700,x:f.stand.x,y:f.stand.y});
        s.fill.push({src:'RAMP',text:'The motorcade is driving out of the Antonov. Ten cars. Nobody has asked where they will park.',from:T,ok:()=>!s.gone&&T<t1});}}}
  // one VIP at a time, in the order they land: announcement, then shot
  const c=s.cine,a=s.ann;
  if(!c&&!a){const f=s.vips[s.ci];if(f){if(f.landT!=null||['gone','diverted'].includes(f.state))s.ci++;else if(f.state==='approach'&&T>=f.vipTd-SUMT.cue){if(CINE){const p=CINE;CINE=null;speed=p.prevSpeed;if(p.prevCam&&V3.on&&V3.ready){setCam('map');Object.assign(C3.t,p.prevCam.t);}}s.ci++;vipAnn(f);}}}
  else if(a){const f=a.f;if(a.read&&performance.now()>=a.read)a.done=true;
    // the shot starts as the voice ends (or, if the voice is somehow still going, at the last moment: 20 s out)
    if(a.done||f.td-T<=SUMT.fin/2||f.landT!=null||['gone','diverted'].includes(f.state))vipShot(f);}
  else{const f=c.f;if(!V3.on)centerOn(f.x,f.y);
    if(f.landT!=null&&!c.landed)c.landed=performance.now();
    if(['gone','diverted'].includes(f.state)||c.landed&&performance.now()-c.landed>3600&&!(c.vo&&!FFING&&performance.now()-c.landed<15000))vipCineEnd();}
  // live: the clock follows the voices from the takeover until the SPG starts handing the runways back, the ceremony on
  // the apron included (the speed buttons wait, as in L4's summit)
  const live=!s.back;if(live)PACE=vipPace(s);else if(s.liveW)PACE=null;
  if(s.liveW!==live){s.liveW=live;document.querySelectorAll('.speeds').forEach(x=>x.classList.toggle('live',live));}
  // the Prime Minister receives the President once both Il-96s are down and Russia One is on its stand: the shot and the
  // announcer's line together, and the shot stays up until the line has been heard
  if(!s.shook&&s.il1.docked&&s.il2.landT!=null&&!s.cine){s.shook=T;s.hs=1;}
  // (shown once the radio is free, so nothing else is being said over it; in a fast-forward at once)
  if(s.hs===1&&(FFING||!SND.on||!(vqOn||VQ.length||CINE)||T>=s.shook+120)){s.hs=2;s.hsT=T;const g=s.il1.stand||s.pm.stand;let C=null;
    if(g){MARKS.push({x:g.x,y:g.y,e:'🤝',until:T+400,px:30});if(T<s.ret+80&&!CINE){cinema(null,['ZERO MILE · THE SUMMIT','The Prime Minister receives the President of the Russian Federation','Hindi-Rusi bhai bhai 🤝',FLAG_IN+FLAG_RU],{view:{tx:g.x,ty:g.y,dist:650,pitch:0.32,yaw:0.7},at:[g.x,g.y],ms:5500});C=CINE;}}
    if(C)C.vo=true;say('PROTOCOL','The Honourable Prime Minister has received His Excellency the President of the Russian Federation on the red carpet. Handshake: eleven seconds.',{pri:3,onEnd:()=>{if(C)C.vo=false;}});logE('The Prime Minister received the President at the VIP stands.');}
  // a gap line, if one fits now (one at a time; a line whose moment has passed is dropped, it is on the log already)
  if(s.fill.length&&s.hs!==1)for(let i=0;i<s.fill.length;i++){const x=s.fill[i];if(!x.ok()){s.fill.splice(i--,1);continue;}
    if(T>=x.from&&sumFits(s,x)){s.fill.splice(i,1);say(x.src,x.text,{pri:2});break;}}
  if(s.hs===2&&!s.gone&&T>=s.hsT+40){s.gone=true;say('SPG','The motorcade has left for Tadoba. Every road from here to the tigers is closed. The tigers have been informed.',{pri:2});
    const g=s.il1.stand||s.pm.stand;if(g)MARKS.push({e:'🚗',n:6,sp:160,px:18,path:[[g.x,g.y],[lerp(g.x,procC.x,0.5),lerp(g.y,procC.y,0.5)],[procC.x-900,procC.y]],t0:T,t1:T+300,until:T+300,x:g.x,y:g.y});}
  // the staged return: he names a runway, it reopens a game minute later, then the next one
  // (anything still queued for the radio voice is stale by now: drop it so his lines keep step with the runways)
  // (if a cinematic held it up, it starts now, and every runway's block moves to the time he will actually reopen it)
  // he starts once the handshake has been shown (or at the latest 2 minutes after the plan)
  // (and, with sound, once the radio is free, so his lines are heard as he names the runways, not behind a backlog)
  // (played live, no runway comes back before he has named it: until then their blocks are held open-ended; a fast-forward
  // keeps the planned times, as the bots always have)
  if(!s.back&&!FFING)for(const b of s.blk)if(b.to<T+5)b.to=T+5;
  if(!s.back&&T>=s.ret&&!s.cine&&!CINE&&s.hs!==1&&(s.shook?T>=s.hsT+50:T>=s.ret+120)&&(FFING||!SND.on||!(vqOn||VQ.length)||T>=s.ret+300)){s.back=T;vqClear(1);
    const tm=spgStaged(s.order,{at:T,first:SUMT.first,step:SUMT.step,lead:SUMT.lead,open:(r,i)=>{r.blocks=r.blocks.filter(b=>b!==s.blk[i]);},done:()=>{s.done=T;}});
    s.blk.forEach((b,i)=>{b.to=tm.open[i];});S.summitBack=tm.open[0];renderRw();}
  // then the stack the summit left: the approach controller calls it down
  if(s.done&&T>=(s.nextStack||0)){s.nextStack=T+30;let h=0;for(const f of flights)if(f.state==='holding')h++;
    if(!s.peak){s.peak=Math.max(1,h);say('APP',`The summit stack is ${h} aircraft. Give arrivals every runway you can.`);}
    else if(!s.half&&h<=s.peak/2&&T>s.done+240){s.half=true;say('APP',`Stack down to ${h}. Keep the arrival runways coming.`);}
    else if(h<=3&&T>s.done+240){say('APP',h?`The summit stack is cleared: ${h} left holding. Normal service.`:'The summit stack is cleared. Normal service.');logE('The stack from the summit was cleared.');sumHold(s,true);SUM=null;}
    else if(T>s.E+3000){sumHold(s,true);SUM=null;}}
}
// ============ set pieces: the summit's siblings, one or two per level ============
// Each is a story with a character on the dashboard, radio lines on a timeline, a disruption the sim really feels,
// and often a cinematic cut with a banner. Defined in STORY; a level's script starts one like any incident ('st_<key>').
let STO=[],CINE=null,PACE=null;   // PACE: while a set piece runs live (the Delhi summit), the sim runs at this speed whatever the buttons say
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
function cinema(f,ban,o){o=o||{};if(ended)return;if(f?['gone','diverted'].includes(f.state):!o.view)return;let keep=null;if(o.force&&CINE){keep=CINE;CINE=null;speed=keep.prevSpeed;}if(!o.force&&(CINE||(SUM&&(SUM.cine||SUM.ann)))){(cinema.q=cinema.q||[]).push([f,ban,o]);return;}
  CINE={f,ban,o,c:o.c,t0:performance.now(),prevSpeed:keep?keep.prevSpeed:speed,prevCam:keep?keep.prevCam:V3.on&&V3.ready?{t:Object.assign({},C3.t)}:null};speed=o.speed||0.5;
  vipBanner(true,ban[0],ban[1],ban[2],ban[3]==null?'':ban[3]);
  if(V3.on&&V3.ready){if(f){V3.mode=f.state==='approach'?'approach':'follow';C3.follow=f;C3.fpos=null;C3.apT=-99;camLabel();}else{setCam('map');Object.assign(C3.t,o.view);}}else if(f)centerOn(f.x,f.y);else if(o.at)centerOn(o.at[0],o.at[1]);}
// a line that belongs to the shot on screen: it plays next, and the shot stays up until it has been heard
function cineSay(C,src,text,o){if(!C)return say(src,text,Object.assign({pri:2},o));C.vo=true;return say(src,text,Object.assign({pri:3},o,{onEnd:()=>{C.vo=false;if(o&&o.onEnd)o.onEnd();}}));}
// a queued shot whose moment has passed (its aircraft landed a while ago, or its sim-time window is over) is dropped, not shown late
const cineStale=(f,o)=>(o.until!=null&&T>=o.until-2)||(f&&['gone','diverted','towed'].includes(f.state))||(o.landed&&f&&f.landT!=null&&T-f.landT>25);
function cineTick(){stagedTick();
  if(!CINE){const q=cinema.q;while(q&&q.length&&!(SUM&&(SUM.cine||SUM.ann))){const [f,b,o]=q.shift();if(cineStale(f,o))continue;cinema(f,b,o);break;}return;}
  const c=CINE,now=performance.now();if(!V3.on&&c.f)centerOn(c.f.x,c.f.y);
  if(c.o.landed&&c.f&&c.f.landT!=null&&!c.landAt)c.landAt=now;
  const gone=c.f&&['gone','diverted'].includes(c.f.state);let over=gone||(c.o.until!=null?T>=c.o.until||now-c.t0>40000:(c.landAt&&now-c.landAt>3500)||now-c.t0>(c.o.ms||(c.o.landed?20000:6500)));
  // a shot with a line of its own (CINE.vo, see cineSay) stays up until the line has been heard (at most 25 s; not in a fast-forward)
  if(over&&!gone&&c.vo&&!FFING&&now-c.t0<25000)over=false;
  if(over){CINE=null;vipBanner(false);speed=c.prevSpeed;if(running)setSpeed(speed,true);if(V3.on&&V3.ready&&c.prevCam){setCam('map');Object.assign(C3.t,c.prevCam.t);}}
}
// a special arrival that appears 14 km out and lands on runway r at sim time td (holds a stand if one is given)
function specialArr(o,r,td,stand){const f=mk(Object.assign({kind:'arr',state:'sched',intl:false,dir:'W',eta:td,endurance:180},o));Object.assign(f,{origEta:td,spawnT:1e12,spRw:r,spTd:td});if(stand){stand.res=f;f.res=stand;}
  (specialArr.list=specialArr.list||[]).push(f);return f;}
function specialTick(){const L=specialArr.list;if(!L)return;for(const f of L){if(f.state==='sched'&&T>=f.spTd-D_APP-10){const r=f.spRw;f.x=r.x1+14000;f.y=r.y+(r.y<0?-2600:2600);f.alt=2000;f.heading=Math.PI;f.state='inbound';beginApproach(f,r,Math.max(f.spTd,T+D_APP));}}
  specialArr.list=L.filter(f=>f.state==='sched');}
// runways a story takes: from 'from' for 'secs', reopening one by one 'step' apart (blocks are what the sim and forecast read)
function takeRunways(rs,from,secs,step,why,desk){rs.forEach((r,i)=>{r.blocks.push({from,to:from+secs+(step||0)*i,why,desk:desk||why});r.blocks.sort((a,b)=>a.from-b.from);});
  for(const f of flights)if(f.state==='approach'&&rs.includes(f.rwy)&&!f.vip&&f.td-T>25&&f.td>=from-20&&f.td<from+secs)goAround(f,why.toLowerCase());renderRw();}
// ---- the stories (pitched by the writers' room; jokes aim at systems and situations, never at real people) ----
const OTPNOW=()=>S.dep+S.arr?Math.round((S.depOnTime+S.arrOnTime)/(S.dep+S.arr)*100):100;
const rwBy=(k,not)=>RW.filter(r=>!r.locked&&r.mode!=='OFF'&&r!==not&&(k==='arr'?canArr(r):canDep(r)));
const nextOn=r=>flights.filter(o=>o.state==='approach'&&o.rwy===r).sort((a,b)=>a.td-b.td)[0];
// an incident card that belongs to a story (buttons are ordered best-first: the bots take the first)
function storyCard(c,o){const I=Object.assign({id:++INC,type:'story',born:T,total:40,def:0,st:c},o);I.left=I.total;
  S.incTypes['st_'+c.k]=(S.incTypes['st_'+c.k]||0)+1;incidents.push(I);renderInc();radio('AOCC',I.title+'.');return I;}
function flashBanner(b,ms){if(ended||CINE||(SUM&&(SUM.cine||SUM.ann)))return;vipBanner(true,b[0],b[1],b[2],b[3]==null?'':b[3]);clearTimeout(flashBanner.t);
  flashBanner.t=setTimeout(()=>{if(!CINE&&!(SUM&&(SUM.cine||SUM.ann)))vipBanner(false);},ms||4500);}
// emoji on the field (2D map and 3D overlay): {x,y,e,until,n,sp,alt,px}
let MARKS=[];
// 3D spectacles the stories ask for (read by 3d/fx.js through Z.fx): see 3d/FX.md for the item shapes
let FXV=[];
function drawMarks(g,toScr,now,skip){for(const m of MARKS){if(T>m.until||(m.from&&T<m.from)||(skip&&m.k&&skip.has(m.k)))continue;const n=m.n||1;
  if(m.path){const u=clamp((T-m.t0)/Math.max(1,m.t1-m.t0),0,1)*(m.path.length-1),i0=Math.min(m.path.length-2,Math.floor(u)),k=u-i0;m.x=lerp(m.path[i0][0],m.path[i0+1][0],k);m.y=lerp(m.path[i0][1],m.path[i0+1][1],k);}
  for(let i=0;i<n;i++){const x=m.x+(n>1?(((i*37)%7)-3)*m.sp/6+Math.sin(now*0.7+i)*m.sp*0.06:0),y=m.y+(n>1?(((i*53)%5)-2)*m.sp/10+Math.cos(now*0.9+i*2)*m.sp*0.04:0);
    const p=toScr(x,y,m.alt||0);if(!p)continue;g.font=`${m.px||26}px serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(m.e,p.X,p.Y+(n>1?Math.sin(now*2+i)*3:0));}}
  g.textAlign='left';g.textBaseline='alphabetic';MARKS=MARKS.filter(m=>T<=m.until);}
const WHO={protocol:{badge:'PROTOCOL · MINISTRY',svg:face('🙏','#3a2614')},ranger:{badge:'FOREST DEPT · SHERNI PUTTAR WATCH',svg:face('🐅','#1f3a14')},
  kid:{badge:'ROOFTOP · AHMEDABAD',svg:face('🪁','#14304a')},ramp:{badge:'GROUND OPS SUPERVISOR',svg:face('🏏','#123a22')},tower:{badge:'TOWER',svg:face('📣','#123a22')},
  dabba:{badge:'MUKADAM · DABBAWALAS',svg:face('🍱','#3a2a10')},admin:{badge:'GROUP ADMIN · OPS',svg:face('📱','#103a2a')},team:{badge:'TEAM MANAGER',svg:face('🏆','#123a5a')},
  surya:{badge:'SURYA KIRAN LEADER · IAF',svg:face('✈️','#3a1414')},langur:{badge:'LANGUR-CALL MAN · WILDLIFE',svg:face('🐒','#3a2a14')},radar:{badge:'RADAR CONTROLLER',svg:face('📡','#1c1440')},
  planner:{badge:'WEDDING PLANNER · CHAMBANI',svg:face('💍','#3a2a08')},fan:{badge:'FAN CLUB · JAMTHA',svg:face('🏏','#103a2a')}};

// L1 · the ribbon: the first departure can't go until the Chief Minister cuts it, and he is always five minutes away.
// A stage stands on the runway: officials, marigolds, a podium; when he arrives he gives a speech first (the joke is the
// speech and the protocol, never the person).
const SPEECH=['Brothers and sisters of Vidarbha, namaskar!','From the Zero Mile of India, we will fly to the whole world.','I will be brief.','Briefly, my second point.','In conclusion. And, secondly…','Jai Hind! Now, the ribbon.'];
function speech(c,t0,len){SPEECH.forEach((l,i)=>c.lines.push([t0-c.E+Math.round(i*len/SPEECH.length),'CM ON STAGE',l]));}
STORY.ribbon={len:2000,start(c){const r=rwBy('dep')[0];if(!r)return false;c.r=r;
  c.blk={from:T,to:T+1e6,open:true,why:'Inauguration ribbon',desk:'Ribbon across it, until it is cut'};r.blocks.push(c.blk);r.blocks.sort((a,b)=>a.from-b.from);
  const hx=r.holds.length?G.get(r.holds[0]).x:r.x1-300;c.mark={x:hx,y:r.y,e:'🎀',until:T+1e6,px:30,k:'ribbon'};MARKS.push(c.mark);
  c.fx={kind:'ribbon',id:'ribbon',x:hx,y:r.y,w:75,t0:T,t1:T+1e6,cutAt:null};FXV.push(c.fx);
  c.stage={kind:'stage',id:'stage1',x:hx-720,y:r.y,a:0,t0:T,t1:T+1e6,speaker:null};FXV.push(c.stage);MARKS.push(c.smark={x:hx-720,y:r.y,e:'🎤',until:T+1e6,px:26,k:'stage'});
  c.wait=T+240+Math.floor(SIMR()*240);
  guard(['Sir, no departures yet. The Chief Minister will cut the ribbon.','He is five minutes away. 🙏'],WHO.protocol);
  c.lines.push([0,'PROTOCOL',`A stage and a ceremonial ribbon are on ${r.short}. No departures until the Chief Minister cuts it. He is five minutes away.`]);
  // after the cut the stage packs away before anything rolls: the runway stays shut until it is gone, then the first departure goes
  const PACK=40,go=()=>{Object.assign(c.blk,{to:T+PACK,open:false,why:'Stage packing away',desk:'Ribbon cut: the stage is packing away'});c.mark.until=T;c.fx.cutAt=T;c.fx.t1=T+150;c.stage.t1=T+PACK-4;c.smark.until=T;renderRw();
    c.lines.push([T-c.E+PACK,()=>{const f=flights.find(o=>o.rwy===r&&['lineup','hp'].includes(o.state))||flights.find(o=>o.rwy===r&&o.state==='taxi_out');
      if(f)cinema(f,['OPENING DAY',`The first departure rolls through the ribbon on ${r.short}`,'BAS PAANCH MINUTE 🙏',icos('🎀','✂️','🛫')],{ms:7000});}]);};
  c.go=go;
  const I=storyCard(c,{icon:{g:'🎀',c:'#ff9933'},x:hx,y:r.y,title:`A stage and a ribbon on ${r.short}`,
    text:`The opening ceremony has put a stage and a ribbon on ${r.short}, and the first departures are queuing behind it. Cut the ribbon yourselves and traffic flows now, but Protocol will re-stage the whole ceremony, speech included, in about 15 minutes in the middle of the arrivals runway, for 3 minutes. Or wait: the Chief Minister is "five minutes away".`,
    def:1,defText:'you wait for the Chief Minister.',
    acts:[{l:'Cut it ourselves',pri:1,fn(){go();const ra=rwBy('arr').sort((a,b)=>b.tdList.length-a.tdList.length)[0];c.cut=true;
        if(ra){const t2=T+900,mx=(ra.x0+ra.x1)/2;takeRunways([ra],t2,180,0,'Inauguration, take two','Inauguration, take two: a stage mid-runway');
          // the stage stands only inside the closure: it goes up as the runway shuts and is packed away before it reopens
          const st={kind:'stage',id:'stage2',x:mx,y:ra.y,a:0,t0:t2,t1:t2+180,speaker:{t0:t2+30,t1:t2+160},cutAt:t2+160};FXV.push(st);MARKS.push({x:mx,y:ra.y,e:'🎤',until:t2+180,px:26,k:'stage'});
          speech(c,t2+30,130);
          c.lines.push([t2-c.E,()=>{guard(['The Chief Minister has arrived. We will now inaugurate again.','Only two minutes. Mid-runway, please. 🎤'],WHO.protocol);
            cinema(null,['OPENING DAY · TAKE TWO',`The Chief Minister's speech, in the middle of ${ra.short}`,'"I will be brief." 🎤',icos('🎤','🎀','📸')],{view:{tx:mx,ty:ra.y+60,dist:520,pitch:0.32,yaw:0.9},at:[mx,ra.y],ms:9000});}]);
          c.lines.push([t2-c.E+178,'PROTOCOL','The speech ran three minutes. That is a record. For brevity.']);}
        resolve(I,true,`${r.short}'s ribbon was cut by ops. Protocol will be back.`);}},
      {l:'Wait for the Chief Minister',fn(){resolve(I,true,'');}}]});c.I=I;
  // waiting: he arrives a little before the cut and speaks first
  c.arrive=Math.max(T+60,c.wait-150);c.stage.speaker={t0:c.arrive+10,t1:c.wait-5};speech(c,c.arrive+10,c.wait-c.arrive-15);
},tick(c,t){if(c.cut){if(!c.packed){c.packed=true;c.stage.speaker=null;}return;}
  if(!c.arrived&&T>=c.arrive){c.arrived=true;guard(['The Chief Minister has arrived.','He will say a few words. 🎤'],WHO.protocol);
    cinema(null,['OPENING DAY','The Chief Minister takes the stage',"He'll be brief. 🎤",icos('🎤','🎀','📸')],{view:{tx:c.stage.x,ty:c.stage.y+60,dist:520,pitch:0.32,yaw:0.9},at:[c.stage.x,c.stage.y],ms:9000});}
  if(!c.went){if(T>=c.wait){c.went=true;if(incidents.includes(c.I))resolve(c.I,true,'The Chief Minister arrived, spoke and cut the ribbon.');c.go();guard(['The Chief Minister has cut the ribbon.','He would like to do it again for the photographers. (No.)'],WHO.protocol);}
    else if(!c.arrived&&T>=(c.nag||0)){if(c.nag)radio('PROTOCOL',['The Chief Minister is five minutes away.','Still five minutes, sir. Very consistent.','The convoy has been sighted. It was a different convoy.','Five minutes. Same five minutes.'][(c.nagN=(c.nagN||0)+1)%4]);c.nag=T+120;}}}};

// L1 · Sherni on the loose: Nagpur is the tiger capital of India, and the tigress has right of way
const walk=(r,a,b,n,side)=>Array.from({length:n},(_,i)=>[lerp(r.x0,r.x1,lerp(a,b,i/(n-1))),r.y+(i%2?1:-1)*(8+side*(i%3))]);
// her cinematic waits until she has faded in, then frames her close up from ahead and slightly to the side, at near real time
// (so she walks like a tigress, not a cheetah), the camera following her as the 3D view draws her
const tigerAt=()=>{const S3=V3.on&&V3.ready&&Z.scene;if(!S3)return null;const g=tigerAt.g&&tigerAt.g.parent?tigerAt.g:(tigerAt.g=S3.getObjectByName('tiger'));return g?[g.position.x,g.position.z]:null;};
const tigerCam=(ban,x,y)=>cinema(null,ban,{view:{tx:x,ty:y,dist:14,pitch:0.2,yaw:-1.0},at:[x,y],ms:8000,speed:0.04,track:tigerAt});
STORY.tiger={len:2000,start(c){const r=rwBy('dep')[0];if(!r)return false;c.r=r;c.ra=rwBy('arr',r)[0]||null;
  const p0=walk(r,0.66,0.38,6,6);
  c.mark={x:p0[0][0],y:r.y,e:'🐅',until:T+1e6,px:34,k:'tiger',path:p0,t0:T,t1:T+420};MARKS.push(c.mark);
  c.fx={kind:'tiger',id:'tiger1',path:p0,t0:T,t1:T+420,darted:null,exit:null};FXV.push(c.fx);
  c.lines.push([8,()=>tigerCam(['SHERNI PUTTAR ON THE LOOSE',`A tigress is walking down ${r.short}`,'Sherni Puttar, you are not cleared to line up 🐅',icos('🐅','🛫','🌳')],p0[0][0],r.y)]);
  guard(['Sir, she is not a bird. You cannot sweep her.','She is the senior-most resident here. 🐅'],WHO.ranger);
  c.lines.push([0,'TWR',`All stations: a tigress is on ${r.short}. Nobody is to taxi towards her. That includes the follow-me car.`]);
  const I=c.I=storyCard(c,{icon:{g:'🐅',c:'#ff8c1a'},x:p0[0][0],y:r.y,title:`Sherni Puttar on the loose: a tigress on ${r.short}`,
    text:`Sherni Puttar, a tigress from the Umred-Karhandla corridor, is strolling down ${r.short}. Wait for the forest department's dart team and ${r.short} shuts for 4 to 6 minutes; nobody knows exactly. Or shoo her off with sirens: ${r.short} stays open, but she is still out there, and tigresses come back.`,
    def:0,defText:`${r.short} shuts until the dart team arrives.`,
    acts:[{l:'Wait for the dart team',pri:1,fn(){const d=240+Math.floor(SIMR()*120);closeRw(r,d,'Tigress on the runway');c.mark.until=T+d;c.mark.t1=T+d-90;c.fx.t1=T+d;c.fx.darted=T+d-90;
        c.lines.push([T-c.E+d-90,'FOREST','Dart away. She is lying down. Very dignified about it.']);c.lines.push([T-c.E+d,'FOREST','She has been weighed and named. She is called Runway. She is going home to Tadoba.']);resolve(I,true,`${r.short} shut for the tigress.`);}},
      {l:'Shoo her off with sirens',fn(){c.mark.until=T+60;c.fx.t1=T+60;c.fx.exit=[lerp(r.x0,r.x1,0.4),r.y+(r.y<0?-900:900)];c.herd=true;resolve(I,true,'');
        if(c.ra){const ra=c.ra,at=T-c.E+900;c.lines.push([at-60,'FOREST',`Update: the tigress has been seen heading towards ${ra.short}. She did not like the sirens.`]);
          c.lines.push([at,()=>{const D=330,p=walk(ra,0.72,0.34,8,10);p.unshift([lerp(ra.x0,ra.x1,0.75),ra.y+(ra.y<0?-650:650)]);closeRw(ra,D,'Tigress, again');
            MARKS.push({x:p[0][0],y:p[0][1],e:'🐅',until:T+D,px:34,k:'tiger',path:p,t0:T,t1:T+D});FXV.push({kind:'tiger',id:'tiger2',path:p,t0:T,t1:T+D,darted:null,exit:null});
            guard(['Sherni Puttar is back. On your arrivals runway.','Sirens only made her curious, sir. She will take her time. 🐅'],WHO.ranger);
            c.lines.push([at+8,()=>tigerCam(['SHERNI PUTTAR AFOOT',`She is back, on ${ra.short}, and in no hurry`,'Madam has right of way 🐅',icos('🐅','🐾','🐅')],p[0][0],p[0][1])]);}]);
          c.lines.push([at+150,'TWR',`${ra.short} remains closed. The tigress is inspecting the touchdown zone. Thoroughly.`]);
          c.lines.push([at+330,'FOREST','She has left for the jungle. On her own schedule.']);}}}]});
},
// her card's marker goes where she goes (as drawn: the 3D tigress, or the map's emoji)
tick(c){if(c.I&&incidents.includes(c.I)){const p=tigerAt()||[c.mark.x,c.mark.y];c.I.x=p[0];c.I.y=p[1];}},lesson(c){return c.herd?{w:25,title:'Sherni Puttar came back',text:'Shooing her off kept the departure runway open, but she walked onto the arrivals runway 15 minutes later and took her time, mid-wave. A cost you put off still has to be paid: when you choose the risky option, flip a second runway to MIX early so the bill lands softly.'}:null;}};

// L2 · Uttarayan: Ahmedabad moved in, and so did its kite fight. "Kai po che!" is what a kite fighter shouts on cutting a
// rival's kite; today the rooftops' rival is your arrivals. The fight drifts south across every runway, about 4 minutes
// each, and every go-around it causes is a point to the rooftops.
(function(){const st=document.createElement('style');st.textContent=`#kiteChip{position:absolute;left:16px;top:200px;z-index:12;padding:7px 13px;border-radius:8px;background:rgba(10,13,16,.92);border:1px solid #3aa0ff;font-family:var(--f-sign);font-weight:700;font-size:18px;letter-spacing:.03em;color:#fff;box-shadow:0 8px 20px rgba(0,0,0,.45)}
#kiteChip[hidden]{display:none}#kiteChip b{color:#ffd23f;font-size:21px}#kiteChip small{display:block;font-family:var(--f-mono);font-weight:500;font-size:10.5px;color:#9fb3c8;letter-spacing:.06em}#kiteChip.pop{animation:cpop .45s ease-out}`;document.head.appendChild(st);
  const d=document.createElement('div');d.id='kiteChip';d.hidden=true;d.setAttribute('aria-live','polite');$('#app').appendChild(d);})();
function kiteChip(c,on){const d=$('#kiteChip');if(!d)return;if(!on){d.hidden=true;return;}const nx=c.seq.find(r=>T<r.kiteUntil);
  d.innerHTML=`<small>UTTARAYAN · KITE FIGHT${nx?` · OVER ${nx.short}`:''}</small>🪁 ROOFTOPS <b>${c.score}</b> · AIRLINES <b>0</b>`;d.hidden=false;d.classList.remove('pop');void d.offsetWidth;d.classList.add('pop');}
STORY.kites={len:1400,start(c){const seq=RW.filter(r=>!r.locked).sort((a,b)=>a.y-b.y);if(!seq.length)return false;c.seq=seq;c.score=0;const V=240;
  seq.forEach((r,i)=>{const t0=T+i*V;r.kiteFrom=t0;r.kiteUntil=t0+V;r.kiteP=0.3;
    FXV.push({kind:'kites',id:'k'+i,x:r.x1+1600,y:r.y,sp:1800,alt:180,n:60,t0:t0-30,t1:t0+V+30});MARKS.push({x:r.x1+1600,y:r.y,e:'🪁',until:t0+V,from:t0,n:9,sp:2200,alt:160,px:24,k:'kites'});
    if(i>0)c.lines.push([i*V-100,cc=>{radio('WX',`The kite fight is drifting south: over ${r.short} in about a minute and a half.`);kiteChip(cc,true);}]);});
  c.end=T+seq.length*V;
  c.hit=f=>{c.score++;floater(f.x,f.y,f.alt,'KAI PO CHE!','#ffd23f');kiteChip(c,true);
    const cries=[`KAI PO CHE! We cut ${f.A.name}'s ${f.T.name}!`,'KAI PO CHE! Put it on the scoreboard, uncle!','KAI PO CHE! Rooftop 14 takes the lead!','KAI PO CHE! That one had 180 people in it. Still counts!','KAI PO CHE! Ahmedabad 5, aviation 0!'];
    radio('ROOFTOPS',cries[Math.min(c.score-1,cries.length-1)]);logE(`A kite sent ${fl(f)} around. Rooftops ${c.score}, airlines 0.`);
    if(c.score===1)guard([`KAI PO CHE! We cut ${f.A.name}'s ${f.T.name}!`,'Uncle, it is 1-0 to the rooftops. 🪁'],WHO.kid);};
  kiteChip(c,true);
  guard(['Uncle, all of Ahmedabad is on the roof.','Today the sky is ours. Kai po che! 🪁'],WHO.kid);
  const r0=seq[0],f=nextOn(r0)||seq.map(nextOn).filter(Boolean)[0];
  const ban=['UTTARAYAN · THE KITE FESTIVAL','Ahmedabad moved in, and brought its kite fight','"Kai po che!" means "I cut it!" Today they are cutting your arrivals 🪁',icos('🪁','🪁','🪁')];
  if(f)cinema(f,ban,{ms:7000});else flashBanner(ban,6000);
  c.lines.push([0,'TWR',`All aircraft: a kite fight is in progress over the approaches, starting with ${r0.short}. Yes, kites. Hundreds.`]);
  const I=storyCard(c,{icon:{g:'🪁',c:'#3aa0ff'},x:r0.x1+1200,y:r0.y,title:'Uttarayan: a kite fight over every approach',
    text:`It's Uttarayan, Gujarat's kite festival, and Ahmedabad brought it along. The rooftops' kite fight is drifting south across every runway's approach, about 4 minutes each: ${seq.map(r=>r.short).join(', then ')}. When a kite fouls a landing the jet goes around and the rooftops shout "Kai po che!" ("I cut it!"), a point to them. Keep landings off the runway under the kites (the desk shows "kites in…"). Or send 400 plates of undhiyu and jalebi to the rooftops: they fly lower and far fewer jets go around, but the catering trucks clog the apron (pushbacks 2 minutes slower for 10 minutes).`,
    def:1,defText:'you chase the kites yourself: about 1 landing in 3 under them goes around.',
    acts:[{l:'Send undhiyu and jalebi',pri:1,fn(){for(const r of seq)r.kiteP=0.08;FX.pushSlow=T+600;FX.pushSlowS=120;c.fed=true;radio('CATERING','400 plates of undhiyu and jalebi are on their way to the rooftops.');
        c.lines.push([T-c.E+90,'ROOFTOPS','Thank you, uncle! We are flying lower now. We are also eating.']);resolve(I,true,'Undhiyu and jalebi went to the rooftops; the kites are flying lower.');}},
      {l:'Chase the kites',fn(){resolve(I,true,'');}}]});
  c.lines.push([c.end-T,cc=>{kiteChip(cc,true);flashBanner(['UTTARAYAN · FULL TIME',`Rooftops ${cc.score} · Airlines 0`,cc.score?'Kai po che! 🪁':'A clean sheet! The rooftops demand a rematch 🪁',icos('🪁','🏆','🪁')],6000);
    const al=(flights.find(o=>o.landT!=null&&o.al==='6E')||{A:{name:'IndiGo'}}).A.name;
    guard(['Uncle, good game. 🪁',`Can we have our pink kite back? It's on your ${al} jet's tail.`],WHO.kid);radio('TWR','The kite fight is over. All finals clear. One pink kite is on a tail fin; ground ops will return it.');
    setTimeout(()=>kiteChip(cc,false),12000);}]);
},lesson(c){return c.score>=3?{w:15,title:`The rooftops won ${c.score}-0`,text:'The kite fight moved south one runway every 4 minutes, and the desk warned "kites in…" before each. Chase the kites: just before they reach a runway, take arrivals off it (DEP), and hand it back once they pass.'}:null;}};

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
    for(const o of CONC)if(o.open!==false)floater(o.cx,o.cy,0,'SIX! 🏏','#ffd23f');radio('RAMP','The whole apron is honking. The tower has joined in. So has a fire tender.');
    if(cc.pa)for(const f of flights)if(f.state==='at_gate'&&f.readyAt>T){f.readyAt=Math.max(T,f.readyAt-240);}FXV.push({kind:'fireworks',id:'six',x:procC.x,y:procC.y,t0:T,t1:T+200});
    // the cut goes to the fireworks over the terminal, seen from above them so they burst against the field, not the sky
    const b=['LAST BALL · SIX TO WIN','SIX! India win the World Cup','IN-DI-A! IN-DI-A! 🏆',icos('🏏')+FLAG_IN+icos('🏆')];
    cinema(null,b,{view:{tx:procC.x,ty:procC.y,dist:2200,pitch:0.22,yaw:0.4},at:[procC.x,procC.y],track:orbitShot({x:procC.x,y:procC.y,h:320,dist:1350,pitch:0.1,yaw:0.4,rate:0.035,right:330}),ms:8000});
    guard([cc.pa?'The crews are back. They are running.':'They are back. Slowly. Smiling.','Who is honking? … Fine. Honk. 📣'],WHO.tower);});c.len=4000;
},tick(c){if(c.six&&T>=c.six&&!c.sixed){c.sixed=true;c.sixFn(c);}}};

// L3 · the dabbawalas: Mumbai's lunch network moved with the airport, and it is never late
STORY.dabba={len:1100,start(c){const ds=CONC.filter(o=>o.id[0]==='D');if(!ds.length)return false;c.ds=ds;
  // they are already here when the call comes: riding in along Concourse D's apron road, then waiting at its edge
  c.wait=[];for(const d of ds){const ex=d.lx-450;
    FXV.push({kind:'cyclists',id:'dabbaIn'+d.id,x0:d.lx-1500,y0:d.ly,x1:ex,y1:d.ly,n:40,t0:T,t1:T+70});
    const w={kind:'cyclists',id:'dabbaWait'+d.id,x0:ex,y0:d.ly,x1:ex,y1:d.ly,n:40,t0:T+70,t1:T+1e6,hold:true};FXV.push(w);c.wait.push([d,w]);
    MARKS.push(c.mk=c.mk||{x:ex,y:d.ly,e:'🚲',until:T+1e6,n:6,sp:400,px:20,k:'cyclists'});}
  const d0=ds[0],ban=['MUMBAI MOVED IN','120 dabbawalas at Concourse D, waiting to cross','A380 GIVES WAY TO TIFFIN 🍱',icos('🚲','🍱','🚲')];
  cinema(null,ban,{view:{tx:d0.lx-450,ty:d0.ly,dist:650,pitch:0.34,yaw:0.7},at:[d0.lx-450,d0.ly],ms:8500});
  guard(['Saheb, since 1890, never late.',`Your on-time is ${OTPNOW()}%. Ours is 100. Please hold the aeroplane. 🍱`],WHO.dabba);
  const cross=(t0,shut)=>{for(const [d,w] of c.wait){w.t1=t0;FXV.push({kind:'cyclists',id:'dabbaX'+d.id,x0:d.lx-450,y0:d.ly,x1:d.lx+450,y1:d.ly,n:40,t0,t1:t0+180});if(shut)d.laneShut=Math.max(d.laneShut,t0+180);}
    if(c.mk){c.mk.until=t0+180;}};
  const I=storyCard(c,{icon:{g:'🍱',c:'#f4c430'},x:d0.lx-450,y:d0.ly,title:'Dabbawalas waiting at Concourse D',
    text:"Mumbai's dabbawalas moved with the airport, and they feed the tower. 120 bicycles on the tiffin run are lined up at the edge of Concourse D's apron road. Let them cross and nothing moves at D for 3 minutes. Hold them and the tower's lunch is late: every runway changeover takes 3 minutes instead of 2 for the next 15 minutes.",
    def:0,defText:'they cross anyway: Concourse D stops for 3 minutes.',
    acts:[{l:'Let them cross (3 min)',pri:1,fn(){cross(T,true);resolve(I,true,'The dabbawalas crossed Concourse D. On time, obviously.');}},
      {l:'Hold the bicycles',fn(){FX.chgK=1.5;FX.chgUntil=T+900;c.hangry=true;cross(T+300,false);renderRw();resolve(I,true,'');}}]});
  c.lines.push([200,cc=>{if(cc.hangry){say('TWR','The tower is hungry. Changeovers are taking longer. Nobody talk to the supervisor.');guard(['Lunch is late, saheb.','The tower is not happy. 🍱'],WHO.dabba);}
    else say('TWR','Lunch has arrived in the tower. Every dabba correct. Again.');}]);}};

// L4 · Delhi moves in: five ops WhatsApp groups become one
const WA=['Good afternoon to all 🌞🙏','Forwarded many times: NASA says Zero Mile is visible from space','R3 closed?? pls confirm urgent','Happy birthday to the Fire Chief\'s grandson 🎂🎂','Who has added me in this group','Pls do not send good morning msgs in official group',
  'Good morning 🌞','Is canteen open','Sir my leave application pls see','Video: amazing A380 landing (not ours)','👍','👍👍','Sir which one is the Delhi bank? Pls share Excel','This message was deleted','Pls call','Ok'];
STORY.whatsapp={len:720,start(c){
  guard(['Dear all, the five ops groups are now one group.','1,400 members. Official purposes only. 🙏'],WHO.admin);
  flashBanner(['DELHI MOVES IN','Five ops WhatsApp groups are now one','GOOD AFTERNOON TO ALL 🌞🙏',icos('📱','🌞','🙏')],5000);c.fx={kind:'chat',id:'wa',x:procC.x,y:procC.y,t0:T,t1:T+600};FXV.push(c.fx);
  for(let i=0;i<6;i++)c.lines.push([10+i*12,'OPS GROUP',WA[i]]);
  const I=storyCard(c,{icon:{g:'📱',c:'#25d366'},x:CONC[0].lx,y:CONC[0].ly,title:'1,400 people in the ops WhatsApp group',
    text:"Delhi's arrival merged five ops groups into one, and runway changeover confirmations are buried under good-morning messages: changeovers take 4 minutes instead of 2. Make the group admin-only and the hurt members start \"ZMI Ops (Real)\", where gate changes get lost: pushbacks take 90 seconds longer for 8 minutes. Or ride it out for 8 minutes.",
    def:1,defText:'you ride it out: 4-minute changeovers for 8 minutes.',
    acts:[{l:'Make it admin-only',pri:1,fn(){FX.pushSlow=T+480;FX.pushSlowS=90;c.quiet=true;c.fx.t1=T+30;radio('OPS GROUP','Only admins can send messages. 214 members have left. "ZMI Ops (Real)" has 213 members.');resolve(I,true,'The ops group went admin-only.');}},
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
    acts:[{l:'Water salute + parade',pri:1,fn(){takeRunways([r],td+40,300,0,'Victory parade','Victory parade');c.arch=true;c.ax=r.x1-1700;if(c.f)c.f.slowRoll=true;FXV.push({kind:'waterarch',id:'arch',x:c.ax,y:r.y,a:Math.PI,t0:td-30,t1:td+320});resolve(I,true,`${r.short} closed for the champions' parade.`);}},
      {l:'Straight to the motorcade',fn(){for(const o of CONC)if('AB'.includes(o.id[0]))o.slowUntil=Math.max(o.slowUntil,T+600);resolve(I,true,'');}}]});
  c.lines.push([5,'APP','Trophy One, Nagpur Approach. Welcome home. Everybody on this frequency says congratulations.']);
  c.lines.push([70,'FSO','There are 1,00,000 people on the airport road. 40,000 of them have a drum.']);
},tick(c,t){const f=c.f;if(f&&f.state==='approach'&&!c.cine&&f.td-T<95){c.cine=true;
  cinema(f,['THE CHAMPIONS ARE HOME',`Trophy One · Air India A350 on final for ${c.r.short}`,c.arch?'Water salute! IN-DI-A! 🏆':'IN-DI-A! IN-DI-A! 🏆',icos('🏆')+FLAG_IN+icos('🏏')],{landed:true});}
  // the water salute: when Trophy One, slowed to a taxi, nears the arch, cut to a low side view that holds the arch in frame
  if(c.arch&&f&&!c.cine2&&f.state==='rollout'&&f.x<c.ax+430){c.cine2=true;const v=archView(c.ax,c.r.y);
    cinema(null,['THE WATER SALUTE','Trophy One taxis through the arch',`Two fire tenders, one World Cup 💦`,icos('💦','🏆','🚒')],{force:true,view:v,at:[c.ax,c.r.y],until:T+(430+180)/9,speed:0.4});}}};
// a low camera beside the runway, a little past the arch, looking back up the runway: the arch fills the frame and the
// aircraft rolls through it towards the camera
function archView(ax,ay){const cx=ax-260,cz=ay+(ay<0?230:-230),h=28,lx=ax+70,lz=ay;const dx=cx-lx,dz=cz-lz,hz=Math.hypot(dx,dz);return{tx:lx,ty:lz,dist:Math.hypot(hz,h),pitch:Math.atan2(h,hz),yaw:Math.atan2(dx,dz)};}
// L1 · the Surya Kiran flypast: every runway stops for 4 minutes, and you pick the slot off the bank chart
STORY.surya={len:3000,start(c){const open=RW.filter(r=>!r.locked);if(!open.length)return false;
  const due=s=>flights.filter(f=>(f.kind==='arr'&&f.landT==null&&f.eta>=s-60&&f.eta<s+300)||(f.kind==='dep'&&['at_gate','push','start','taxi_out','hp'].includes(f.state)&&Math.max(f.std,f.readyAt||0)>=s-60&&Math.max(f.std,f.readyAt||0)<s+300)).length;
  const cand=[];for(let s=T+300;s<=T+1200;s+=60)cand.push({s,n:due(s)});
  const opts=[cand[0],cand.reduce((a,b)=>b.n<a.n?b:a),cand.reduce((a,b)=>b.n>a.n?b:a)].filter((o,i,A)=>A.findIndex(p=>Math.abs(p.s-o.s)<240)===i);
  for(const o of cand){if(opts.length>=3)break;if(opts.every(p=>Math.abs(p.s-o.s)>=240))opts.push(o);}
  opts.sort((a,b)=>a.s-b.s);
  const cx=RW.reduce((a,r)=>a+(r.x0+r.x1)/2,0)/RW.length,cy=RW.reduce((a,r)=>a+r.y,0)/RW.length;
  const pick=o=>{const t=o.s;takeRunways(open,t,240,0,'Surya Kiran display','Air display');FXV.push({kind:'flypast',id:'surya',t0:t,t1:t+240,cx,cy,r:4200});c.at=t;
    c.lines.push([t-c.E,()=>{guard(['Zero Mile, Surya Kiran leader. Nine Hawks, running in.',"How's the josh? 🇮🇳"],WHO.surya);
      cinema(null,['SURYA KIRAN · IAF AEROBATIC TEAM','Nine Hawks open Zero Mile',"How's the josh? High, sir! 🇮🇳",icos('✈️')+FLAG_IN+icos('✈️')],{view:{tx:cx-1500,ty:cy,dist:4200,pitch:0.3,yaw:0.5},at:[cx,cy],track:chaseFlypast(),speed:0.15,until:t+38});}]);
    c.lines.push([t-c.E+240,'TWR','Surya Kiran, beautiful. All runways back to normal. The josh remains high.']);};
  guard(['Sir, the Surya Kiran team will open the airport.','Every runway stops for 4 minutes. You choose when. ✈️'],WHO.surya);
  const best=opts.reduce((a,b)=>b.n<a.n?b:a);
  const I=storyCard(c,{icon:{g:'✈️',c:'#ff9933'},x:cx,y:cy,title:'Surya Kiran flypast: pick the slot',
    text:"The Air Force's aerobatic team opens Zero Mile with a 4-minute display, and every runway stops for it. You choose when. The count is how many flights are due to land or take off around that slot: find the quiet gap between waves on the bank chart and it costs almost nothing.",
    def:0,defText:`the Air Force takes the first slot, ${clk(opts[0].s)}.`,botPick:opts.indexOf(best),
    acts:opts.map(o=>({l:`${clk(o.s)} · ${o.n} due`,fn(){pick(o);resolve(I,true,`Surya Kiran display set for ${clk(o.s)}.`);}}))});
  c.opts=opts;},
  lesson(c){if(c.at==null)return null;const o=c.opts.find(p=>p.s===c.at),b=c.opts.reduce((a,p)=>p.n<a.n?p:a);
    return o&&o.n>b.n+2?{w:15,title:'The flypast slot',text:`You put the display at ${clk(o.s)} with ${o.n} flights due; ${clk(b.s)} had ${b.n}. The bank chart shows the gaps between waves: a closure placed in a gap costs almost nothing.`}:null;}};

// L4 · Pier F is under new management: Delhi's macaques take the airbridges
STORY.monkeys={len:900,start(c){const pc=CONCI.FN;if(!pc)return false;const gs=GATES.filter(g=>g.conc==='FN');
  const pts=gs.map(g=>[g.x,g.y]).concat(gs.map(g=>{const n=G.get(g.lane);return [lerp(g.x,n.x,0.5),lerp(g.y,n.y,0.5)];}));
  const r=RW.filter(o=>!o.locked).sort((a,b)=>Math.abs(a.y-pc.cy)-Math.abs(b.y-pc.cy))[0];if(!r)return false;c.r=r;
  pc.laneShut=Math.max(pc.laneShut,T+600);const fx={kind:'monkeys',id:'pierF',t0:T,t1:T+600,pts,n:14,flee:null};FXV.push(fx);
  const m1={x:pc.cx,y:pc.cy,e:'🐒',until:T+600,n:7,sp:700,px:22,k:'monkeys'};MARKS.push(m1);
  guard(["Sir, I am not a langur. They don't know that.",'HOO-HOOP! 🐒'],WHO.langur);
  c.lines.push([0,'TWR','Emirates 510, monkeys on the airbridge, hold position. … Say again? … Affirm, monkeys.']);
  const f=flights.find(o=>o.gate&&o.gate.conc==='FN'&&o.state==='at_gate')||flights.find(o=>o.res&&o.res.conc==='FN');
  if(f)cinema(f,['PIER F IS UNDER NEW MANAGEMENT',"Delhi's macaques have taken the airbridges",'Affirm, monkeys. Hold position 🐒',icos('🐒','🍌','🐒')],{ms:7000});
  const I=storyCard(c,{icon:{g:'🐒',c:'#b07a3c'},x:pc.cx,y:pc.cy,title:'Monkeys have taken Pier F',
    text:`A troop of Delhi's macaques has moved onto Pier F North's airbridges, and nothing can park or push back there. Call the langur-call men and the monkeys bolt within 90 seconds, straight across ${r.short}, which closes for 3 minutes. Or send the wildlife team with nets: gentler, but Pier F stays shut for 8 minutes.`,
    def:1,defText:'the wildlife team uses nets: Pier F shut for 8 minutes.',
    acts:[{l:'Langur-call men (90 s)',pri:1,fn(){pc.laneShut=T+90;fx.flee={t0:T+20,t1:T+110,x0:pc.cx,y0:pc.cy,x1:pc.cx+300,y1:r.y+(r.y>pc.cy?700:-700)};fx.t1=T+110;m1.until=T+20;
        MARKS.push({x:pc.cx+150,y:r.y,e:'🐒',until:T+110,n:6,sp:500,px:22,k:'monkeys'});takeRunways([r],T+30,180,0,'Monkeys crossing','Monkeys crossing');
        c.lines.push([T-c.E+25,'RAMP',`HOO-HOOP! … They are running. They are running towards ${r.short}.`]);resolve(I,true,`The langur-call men cleared Pier F; the monkeys crossed ${r.short}.`);}},
      {l:'Wildlife team, nets',fn(){pc.laneShut=T+480;fx.t1=T+480;m1.until=T+480;resolve(I,true,'');}}]});
  c.lines.push([300,'WILDLIFE',"One monkey has a passenger's boarding pass. He is not on the manifest."]);}};

// L3 · "Nagpur is flat": GPS spoofing sets off false terrain alarms on the runways that only have GPS approaches
STORY.gps={len:900,start(c){const gr=RW.filter(r=>!r.locked&&['R2','R5'].includes(r.id));if(!gr.length)return false;c.gr=gr;
  const nm=gr.map(r=>r.short).join(' and '),il=RW.filter(r=>!r.locked&&!gr.includes(r)).map(r=>r.short).join(', ');
  for(const r of gr)MARKS.push({x:r.x1+2400,y:r.y,e:'📡',until:T+600,px:24,k:'ghosts'});FXV.push({kind:'ghosts',id:'gps',pts:gr.map(r=>[r.x1+2600,r.y]),t0:T,t1:T+600});
  guard(['GPS says Khyber Pakhtunkhwa. Radar says Butibori.','I believe my radar. 📡'],WHO.radar);
  const f=gr.map(nextOn).filter(Boolean)[0];
  if(f)cinema(f,['GPS SPOOFING','"TERRAIN, PULL UP." There is no terrain.','Nagpur is flat. 🗺️',icos('🛰️','📡','🛰️')],{ms:6500});
  const I=storyCard(c,{icon:{g:'📡',c:'#7a5cff'},x:gr[0].x1+2000,y:gr[0].y,title:`GPS spoofing: false alarms on ${nm}`,
    text:`Someone is broadcasting fake satellite signals, and aircraft GPS now thinks it is over Khyber Pakhtunkhwa. ${nm} have no ILS (the radio beam on the ground that guides a plane onto the runway), so landings there use GPS, and the fake signal sets off "TERRAIN, PULL UP" alarms: the jet goes around, though Nagpur is flat. For 10 minutes: land only on the ILS runways (${il}) and use ${nm} for take-offs, or keep landing everywhere and expect surprise go-arounds.`,
    def:0,defText:`ops stops landings on ${nm} for 10 minutes.`,
    acts:[{l:'ILS runways only (10 min)',pri:1,fn(){for(const r of gr)r.noArrUntil=T+600;renderRw();resolve(I,true,`Landings moved off the GPS runways ${nm} for 10 minutes.`);}},
      {l:'Keep landing on GPS',fn(){for(const r of gr)r.gpsUntil=T+600;renderRw();resolve(I,true,'');}}]});
  c.lines.push([0,'APP','Emirates 210, GPS spoofing reported in the area. … Unable RNP, request vectors for the ILS.']);
  c.lines.push([600,()=>say('APP','GPS spoofing has stopped. The aircraft are back over Nagpur, where they always were.')]);}};

// L3 · the Chambani wedding: 40 private jets must land before the muhurat (the jokes are about the scale, not the couple).
// The fleet always comes; the call is how. A chip counts the jets down, the camera rides the first one and the groom's
// (with a water salute), quick cuts pick out a few on the way, and the DJ plays from the first jet to the fireworks.
(function(){const st=document.createElement('style');st.textContent=`#wedChip{position:absolute;left:16px;top:200px;z-index:12;padding:7px 13px;border-radius:8px;background:rgba(10,13,16,.92);border:1px solid #d4a017;font-family:var(--f-sign);font-weight:700;font-size:18px;letter-spacing:.03em;color:#fff;box-shadow:0 8px 20px rgba(0,0,0,.45)}
#wedChip[hidden]{display:none}#wedChip b{color:#ffd23f;font-size:21px}#wedChip small{display:block;font-family:var(--f-mono);font-weight:500;font-size:10.5px;color:#d9c79a;letter-spacing:.06em}`;document.head.appendChild(st);
  const d=document.createElement('div');d.id='wedChip';d.hidden=true;d.setAttribute('aria-live','polite');$('#app').appendChild(d);})();
function wedChip(c,on){const d=$('#wedChip');if(!d)return;if(!on){if(!d.hidden)d.hidden=true;return;}
  const k=c.jets.filter(f=>f.landT!=null).length,left=Math.ceil((c.tM-T)/60);c.kn=k;
  const h=`💍 Chambani wedding fleet <b>${k}</b>/40<small>${T<c.tM?`MUHURAT ${clk(c.tM)} · IN ${left} MIN`:`MUHURAT ${clk(c.tM)} · ${k} MADE IT`}</small>`;if(h!==c.chipH){c.chipH=h;d.innerHTML=h;}if(d.hidden)d.hidden=false;}
const WED_C=[['Mumbai','BOM',0],['London','LHR',1],['Dubai','DXB',1],['Jamnagar','JGA',0],['New York','JFK',1],['Udaipur','UDR',0],['Paris','CDG',1],['Singapore','SIN',1]];
// the jets the camera picks out: [number, banner, landed?]; the groom is on 30
const WED_CUTS={1:[['THE CHAMBANI WEDDING','Baraat 1 of 40 · Gulfstream G650 on final for RWY','The guest list has its own airline 💍',icos('💍','🛩️','🐘')],true],
  21:[['BARAAT 21 OF 40','This one carries only the lehengas','Baraat 22 carries the jewellery for Baraat 21 💎',icos('👗','🛩️','💎')],false],
  30:[['THE GROOM ARRIVES','Baraat 30 · the groom · on final for RWY','A water salute waits on the runway. The bride\'s side asked for a bigger one 💦',icos('🤵','💦','🐎')],true],
  36:[['BARAAT 36 OF 40','The DJ\'s speakers','The DJ came on Baraat 1. He has not stopped 🎧',icos('🎧','🔊','💃')],false]};
STORY.wedding={len:2200,start(c){const L=r=>r.tdList.length+flights.filter(f=>f.rwy===r&&['hp','taxi_out'].includes(f.state)).length;
  const MK={DEP:0,MIX:1,ARR:2};const r=RW.filter(o=>!o.locked&&o.mode!=='OFF'&&o!==LONGEST).sort((a,b)=>(MK[a.mode]-MK[b.mode])||(L(a)-L(b)))[0];if(!r)return false;c.r=r;
  const n=40,gap=28,tA=T+300,tM=tA+n*gap+15;Object.assign(c,{n,gap,tA,tM,jets:[],cut:{}});vqCut(2);
  voiced(['Sir, forty jets. One muhurat.','Not one minute after. 💍'],WHO.planner);
  c.lines.push([0,'AOCC',`The Chambani family's wedding guests are inbound: 40 private jets from ${clk(tA)}. Shananth Chambani weds Kanika Merchant at ${clk(tM)}.`]);
  const mkJets=own=>{for(let i=0;i<n;i++){const k=WED_C[i%8],td=tA+i*gap,o={al:'CHW',type:'GLF6',num:String(i+1),disp:`Baraat ${i+1}`,callsign:`BARAAT ${i+1}`,from:k[0],fromCode:k[1],intl:!!k[2]};let f;
      if(own){f=specialArr(Object.assign({vip:true},o),r,td,null);}
      else{f=mk(Object.assign({kind:'arr',state:'sched',dir:'W',eta:td,endurance:60},o));f.origEta=td;f.spawnT=td-D_APP-150;}
      f.toPark=true;c.jets.push(f);}
    const pk=G.get(PARK),path=[[pk.x+1600,pk.y+900],[pk.x+700,pk.y+500],[pk.x+120,pk.y+80]];FXV.push({kind:'elephant',id:'haathi',path,t0:tA+300,t1:tM+600});
    MARKS.push({e:'🐘',k:'elephant',px:26,path,t0:tA+300,t1:tA+900,until:tM+600,x:path[0][0],y:path[0][1]});
    c.lines.push([tA+300-T,()=>say('FSO','One elephant is arriving by road. It has been cleared.')]);
    wedChip(c,true);};
  const I=storyCard(c,{icon:{g:'💍',c:'#d4a017'},x:r.x1+1500,y:r.y,title:'The Chambani wedding: 40 jets before the muhurat',
    text:`Shananth Chambani weds Kanika Merchant at ${clk(tM)}, and the guest list has its own airline: 40 private jets, landing from ${clk(tA)}. Give the family ${r.short} to themselves until the muhurat: 40 landings in 19 minutes, but ${r.short} is shut to everyone else. Or fit the jets into normal traffic on your arrival runways: nothing closes, but the stack grows and some guests will miss the muhurat.`,
    def:0,defText:`the family gets ${r.short} until the muhurat.`,
    acts:[{l:`Give them ${r.short}`,pri:1,fn(){c.own=true;takeRunways([r],tA-40,n*gap+80,0,'The Chambani wedding','Booked by the Chambanis');mkJets(true);resolve(I,true,`${r.short} booked for the Chambani wedding: 40 jets inbound.`);}},
      {l:'Fit them into traffic',fn(){c.own=false;mkJets(false);resolve(I,true,'The Chambani wedding jets were fitted into normal arrivals.');}}]});c.I=I;
  // the muhurat: fireworks over the wedding apron, the count, the sign-off
  c.lines.push([tM-T,cc=>{if(!cc.jets.length)return;const pk=G.get(PARK);FXV.push({kind:'fireworks',id:'muhurat',x:pk.x,y:pk.y,t0:T,t1:T+150});const k=cc.jets.filter(f=>f.landT!=null).length;cc.kn=k;
    if(k===40)voiced(['All forty landed before the muhurat.','Shubh vivah! 💐'],WHO.planner,{pri:3,hold:0.3});else guard([`${k} of 40 landed before the muhurat.`,'Shubh vivah! 💐'],WHO.planner,{pri:3,hold:0.3});
    flashBanner(['THE MUHURAT',`Shananth weds Kanika · ${k} of 40 jets made it`,'Shubh vivah! 💐',icos('💍','💐','🐘')],5000);wedChip(cc,true);}]);
  c.lines.push([tM-T+60,cc=>{if(cc.jets.length)say('TWR','Return gift for the tower: one silver box of kaju katli. Each. We have accepted.');}]);
  c.lines.push([tM-T+130,cc=>{music(null,{fadeOut:3500});}]);
  c.lines.push([tM-T+150,cc=>{wedChip(cc,false);}]);
},tick(c){
  // the first jet will not wait for the card: if it is still open when Baraat 1 is due in, ops gives the family the runway
  if(!c.jets.length){if(c.I&&incidents.includes(c.I)&&T>=c.tA-D_APP-40)expire(c.I);if(!c.jets.length)return;}
  if(T<Math.min(c.tM+150,LV.fog?LV.fog[0]-5:1e9)&&T>=(c.chipAt||0)){c.chipAt=T+10;wedChip(c,true);}
  // cuts: one at a time, never over another cinematic
  for(const n in WED_CUTS){const f=c.jets[n-1];if(!f||c.cut[n]||f.state!=='approach')continue;
    if(+n===30&&!c.arch){c.arch=true;FXV.push({kind:'waterarch',id:'groom',x:f.rwy.x1-1700,y:f.rwy.y,a:Math.PI,t0:f.td-40,t1:f.td+160});}
    const [b,landed]=WED_CUTS[n];if(f.td-T>(landed?100:60))continue;c.cut[n]=true;if(CINE||(SUM&&SUM.cine)||(cinema.q&&cinema.q.length))continue;
    if(+n===1)music('dj',{vol:0.35});
    cinema(f,[b[0],b[1].replace('RWY',f.rwy.short),b[2],b[3]],landed?{landed:true}:{ms:5200});
    // voice first: Baraat 21's line is about Baraat 21, so it plays over Baraat 21's own shot, which waits for it
    if(+n===21&&!c.m20&&CINE&&CINE.f===f){c.m20=true;cineSay(CINE,'PLANNER',WED_L.m20,{hold:0.3});}}
  // what the radio says follows the count of jets actually down; while the planner speaks the clock is held to 0.3x (hold),
  // so the count on the chip does not run away from what she is saying
  const k=c.kn||0,shot=i=>CINE&&CINE.f===c.jets[i]?CINE:null;
  if(!c.m1&&c.jets[0].landT!=null){c.m1=true;cineSay(shot(0),'TWR','Baraat 1, welcome to Zero Mile. Follow the car with the marigolds to the wedding apron.');if(!MUS.name)music('dj',{vol:0.35});}
  if(!c.m10&&k>=10){c.m10=true;say('PLANNER',WED_L.m10,{pri:2,hold:0.3});}
  if(!c.m20&&k>=20){c.m20=true;say('PLANNER',WED_L.m20,{pri:2,hold:0.3});}
  if(!c.m30&&c.jets[29].landT!=null){c.m30=true;cineSay(shot(29),'PLANNER',WED_L.m30,{hold:0.3});}}};
const WED_L={m10:'Ten down, thirty to go. The groom\'s side has asked for a water salute. The bride\'s side has asked for a bigger one.',
  m20:'Half the guest list is down. Baraat 21 is carrying only the lehengas. Baraat 22 is carrying the jewellery for Baraat 21.',m30:'The groom will now change to a horse. The horse is on Baraat 31.'};

// L4 · Super Over at Jamtha: 16 fan charters sit on the bank chart all day, then the fans decide to stay
STORY.superover={len:3200,start(c){const ch=flights.filter(f=>f.charter);if(!ch.length)return false;c.ch=ch;const std=Math.min(...ch.map(f=>f.std));
  flashBanner(['JAMTHA · INDIA v AUSTRALIA',`16 fan charters leave after the match, from ${clk(std)}`,'Find them on the bank chart 🏏',icos('🏏','🏟️','🏏')],5000);
  c.lines.push([0,'AOCC',`The T20 at Jamtha ends around ${clk(std-1500)}. 16 fan charters are due out from ${clk(std)}.`]);
  const d=(std-600)-T;
  c.lines.push([d-240,()=>{guard(["It's a TIE at Jamtha!",'SUPER OVER! Nobody in Nagpur is breathing. 🏏'],WHO.fan);radio('JAMTHA','It is a tie. Super Over.');}]);
  c.lines.push([d,cc=>{let n=0;for(const f of cc.ch)if(['at_gate','push','start'].includes(f.state)){if(f.gate){f.gate.occ=null;f.gate=null;}f.state='cancelled';n++;}cc.n=n;
    FXV.push({kind:'fireworks',id:'jamtha',x:procC.x,y:procC.y+5200,t0:T,t1:T+400});renderRw();flashBanner(['SUPER OVER · JAMTHA','India win! And the champions land here within the hour',`The fans are staying: ${n} charters cancelled 🎉`,icos('🏏','🎉','🏏')],6000);
    guard(['Sir, we are not leaving. Trophy One is landing.','Also, we have no hotel. We will sleep at your airport. 🎉'],WHO.fan);
    radio('AOCC',`All ${n} fan charters cancelled: the fans are staying for the champions. If you set runways for their departures, set them back.`);logE(`${n} fan charters were cancelled after the Super Over.`);}]);},
  lesson(c){return c.n?{w:20,title:`${c.n} charters vanished`,text:'The fan charters sat on the bank chart all day, then were cancelled 10 minutes before departure. Preparing for a wave is right; keep watching the chart after you flip, and when a wave disappears, flip back straight away.'}:null;}};

// 2D: the flypast as nine red Hawks on a racetrack with saffron, white and green smoke (the 3D view draws its own)
function drawFx2D(){for(const o of FXV){if(o.kind!=='flypast'||T<o.t0||T>o.t1+60)continue;
  const pos=t=>{const u=clamp((t-o.t0)/(o.t1-o.t0),0,1),th=u*Math.PI*4;return{x:o.cx+Math.cos(th)*o.r,y:o.cy+Math.sin(th)*o.r*0.45,a:Math.atan2(Math.cos(th)*o.r*0.45,-Math.sin(th)*o.r)};};
  const tc=Math.min(T,o.t1),cols=['#ff9933','#ffffff','#138808'];ctx.lineCap='round';
  for(let k=0;k<3;k++){ctx.strokeStyle=cols[k];ctx.globalAlpha=0.7*(T>o.t1?1-(T-o.t1)/60:1);ctx.lineWidth=4;ctx.beginPath();
    for(let j=0;j<=30;j++){const t=tc-j*2.5;if(t<o.t0)break;const p=pos(t),s=(k-1)*55;const X=sx(p.x-Math.sin(p.a)*s),Y=sy(p.y+Math.cos(p.a)*s);j?ctx.lineTo(X,Y):ctx.moveTo(X,Y);}ctx.stroke();}
  ctx.globalAlpha=1;if(T>o.t1)continue;const p=pos(T);
  for(let i=0;i<9;i++){const row=Math.ceil(i/2),side=i===0?0:(i%2?-1:1);const bx=p.x-Math.cos(p.a)*row*70-Math.sin(p.a)*side*row*45,by=p.y-Math.sin(p.a)*row*70+Math.cos(p.a)*side*row*45;
    ctx.save();ctx.translate(sx(bx),sy(by));ctx.rotate(p.a);ctx.fillStyle='#e0262e';ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-6,-6);ctx.lineTo(-3,0);ctx.lineTo(-6,6);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}}}
// L4 · the Delhi summit, live. Delhi moved in and brought its summit: 50 aircraft from 38 delegations, plus Mexico, which
// flew commercial. The SPG takes 27R and 27C for about 40 minutes (and 27L as well near the end: the spare Air Force One
// needs a spare runway). Every delegation lands with its pilot's call in its own accent, a lower-third and the counter; the
// big ones get the announcer before they land and a cinematic of the landing itself. While they land the clock runs at
// about a third of normal speed (PACE), so every call, card and shot lines up with what is on screen. The Prime Minister
// is already on the red carpet, so there is no Indian aircraft today. Leaders by title only; the jokes are about protocol
// and logistics.
const FLAG_US='<svg viewBox="0 0 95 50" class="flag">'+Array.from({length:13},(_,i)=>`<rect y="${(i*50/13).toFixed(2)}" width="95" height="${(50/13+0.2).toFixed(2)}" fill="${i%2?'#fff':'#b22234'}"/>`).join('')+'<rect width="38" height="27" fill="#3c3b6e"/>'+Array.from({length:20},(_,i)=>`<circle cx="${4+(i%5)*7.5}" cy="${4+Math.floor(i/5)*6.3}" r="1.3" fill="#fff"/>`).join('')+'</svg>';
const FLAG_CN='<svg viewBox="0 0 90 60" class="flag"><rect width="90" height="60" fill="#de2910"/><polygon points="15,6 18.5,16.5 29,16.5 20.5,23 23.5,33.5 15,27 6.5,33.5 9.5,23 1,16.5 11.5,16.5" fill="#ffde00"/>'+[[30,6],[36,12],[36,21],[30,27]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.4" fill="#ffde00"/>`).join('')+'</svg>';
const SUMP=6;   // sim seconds per real second while the delegations land (1x is 20)
// [key, country, flag, airline, type, callsign, call name, aircraft, from, code, voice, pilot's call]
// In a call {C} is the call name and {R} the runway it lands on. Voice ids are the accents in voice/lines/l4.json.
const DELEG=[
  ['REACH1','United States','🇺🇸','USAF','C17','REACH 1','Reach One','US Air Force C-17 (the cars)','Washington','IAD','us','Zero Mile Tower, {C}, heavy, {R}. We have the cars. All of them.'],
  ['REACH2','United States','🇺🇸','USAF','C17','REACH 2','Reach Two','US Air Force C-17 (more cars)','Washington','IAD','us',''],
  ['AF1','United States','🇺🇸','USAF','B748','AIR FORCE ONE','Air Force One','Air Force One','Washington','IAD','us','Zero Mile Tower, {C}, established on the localiser, runway {R}.'],
  ['SAM','United States','🇺🇸','USAF','B748','SAM 29000','SAM 29000','The spare Air Force One','Washington','IAD','us','Zero Mile Tower, {C}, the spare, runway {R}. Nobody on board.'],
  ['RUCARGO','Russia','🇷🇺','RSD','A124','RUSSIA CARGO','Russia Cargo','Antonov An-124 (the other cars)','Moscow','VKO','ru','{C}, Antonov, heavy, {R}. The cars are on board.'],
  ['RU1','Russia','🇷🇺','RSD','IL96','RUSSIA','Russia','Ilyushin Il-96 (one of two)','Moscow','VKO','ru','Zero Mile Tower, {C}, Ilyushin, established, runway {R}.'],
  ['RU2','Russia','🇷🇺','RSD','IL96','RUSSIA 2','Russia Two','Ilyushin Il-96 (the other one)','Moscow','VKO','ru','{C}, also Ilyushin, also established, {R}.'],
  ['CN1','China','🇨🇳','CCA','B748','AIR CHINA 1','Air China One','Air China 747-8','Beijing','PEK','cn','Zero Mile Tower, {C}, established on the localiser, runway {R}.'],
  ['CN2','China','🇨🇳','CCA','A333','AIR CHINA 2','Air China Two','Air China A330 (support)','Beijing','PEK','cn',''],
  ['JP1','Japan','🇯🇵','JAF','B77W','JAPANESE AIR FORCE 1','Japanese Air Force One','Japan Air Force One','Tokyo','HND','jp','Zero Mile Tower, {C}, {R}. On time.'],
  ['JP2','Japan','🇯🇵','JAF','B77W','JAPANESE AIR FORCE 2','Japanese Air Force Two','Japan Air Force One (the backup)','Tokyo','HND','jp','Zero Mile Tower, {C}. The backup. Also on time.'],
  ['AE1','United Arab Emirates','🇦🇪','EK','A388','EMIRATES 1','Emirates One','Emirates A380 (the UAE delegation)','Dubai','DXB','ae','Zero Mile Tower, {C}, super, {R}. One delegation, two decks.'],
  ['AE2','United Arab Emirates','🇦🇪','EK','B77W','EMIRATES 2','Emirates Two','Emirates 777 (the luggage)','Dubai','DXB','ae',''],
  ['SA1','Saudi Arabia','🇸🇦','SV','B748','SAUDI 1','Saudi One','Saudi royal 747-8','Riyadh','RUH','ae','Zero Mile Tower, {C}, heavy, {R}. Two more aircraft behind us. Luggage.'],
  ['SA2','Saudi Arabia','🇸🇦','SV','B77W','SAUDI 2','Saudi Two','Saudi 777 (luggage)','Riyadh','RUH','ae',''],
  ['SA3','Saudi Arabia','🇸🇦','SV','B789','SAUDI 3','Saudi Three','Saudi 787 (more luggage)','Riyadh','RUH','ae',''],
  ['KR1','Republic of Korea','🇰🇷','ROK','B748','KOREAN AIR FORCE 1','Korean Air Force One','Korea Code One 747-8','Seoul','ICN','kr','Zero Mile Tower, {C}, {R}. Code One, on the glide path. Exactly on it.'],
  ['GB1','United Kingdom','🇬🇧','RRR','A333','ASCOT 1','Ascot One','RAF Voyager','London','LHR','gb','Zero Mile Tower, {C}, {R}. Lovely holding stack. Very orderly queue.'],
  ['FR1','France','🇫🇷','CTM','A333','COTAM 001','Cotam 001','French Republic A330','Paris','CDG','fr','Zero Mile Tower, {C}, {R}. The press is in the second aircraft. They are already writing.'],
  ['FR2','France','🇫🇷','CTM','A21N','COTAM 002','Cotam 002','French press A321','Paris','CDG','fr',''],
  ['DE1','Germany','🇩🇪','GAF','A359','GERMAN AIR FORCE 1','German Air Force One','Luftwaffe A350','Berlin','BER','de','Zero Mile Tower, {C}, {R}. We are four seconds early. We apologise.'],
  ['DE2','Germany','🇩🇪','GAF','A21N','GERMAN AIR FORCE 2','German Air Force Two','Luftwaffe A321','Berlin','BER','de',''],
  ['QA','Qatar','🇶🇦','QR','B748','AMIRI 1','Amiri One','Qatar Amiri 747-8','Doha','DOH','ae','{C}, heavy, {R}. The gifts are in the forward hold.'],
  ['TR','Türkiye','🇹🇷','TCG','B748','TURKISH GOVERNMENT','Turkish Government','Turkish state 747-8','Ankara','ESB','tr','{C}, {R}. We heard about the carpet. We have brought a carpet.'],
  ['CA','Canada','🇨🇦','RCF','A333','CANFORCE 001','Canforce 001','RCAF CC-330 Husky','Ottawa','YOW','ca','{C}, {R}. Sorry, are we early? Sorry.'],
  ['AU','Australia','🇦🇺','RAA','A333','AUSSIE 1','Aussie One','RAAF KC-30A','Canberra','CBR','au',"{C}, {R}. G'day. Long way for a photo."],
  ['MY','Malaysia','🇲🇾','MH','A333','MALAYSIAN 1','Malaysian One','Malaysia Airlines A330','Kuala Lumpur','KUL','my','{C}, {R}. We were told to land after Thailand. We did.'],
  ['ID','Indonesia','🇮🇩','GA','B77W','INDONESIA 1','Indonesia One','Garuda Indonesia 777','Jakarta','CGK','id','{C}, heavy, {R}. Selamat siang, Nagpur.'],
  ['SG','Singapore','🇸🇬','SQ','A359','SINGAPORE 1','Singapore One','Singapore Airlines A350','Singapore','SIN','sg','{C}, {R}. Touchdown planned at zero seconds past the minute.'],
  ['IT','Italy','🇮🇹','IAM','A20N','ITALIAN AIR FORCE','Italian Air Force','Italian Air Force A319','Rome','CIA','it','{C}, {R}. We are on time. Please write it down.'],
  ['BR','Brazil','🇧🇷','BRS','A20N','BRAZILIAN AIR FORCE 1','Brazilian Air Force One','Brazilian VC-1','Brasília','BSB','br','{C}, {R}. Our follow-me car is following someone else.'],
  ['EU','European Union','🇪🇺','EUR','A333','EU 01','EU 01','European Union A330','Brussels','BRU','eu','{C}, {R}. Twenty-seven countries, one aircraft.'],
  ['ZA','South Africa','🇿🇦','GOV','B38M','SOUTH AFRICAN 1','South African One','South African state BBJ','Pretoria','WKF','za','{C}, {R}. Howzit, Nagpur.'],
  ['AR','Argentina','🇦🇷','GOV','B38M','TANGO 01','Tango 01','Argentine state BBJ','Buenos Aires','EZE','es','{C}, {R}. Longest flight of the day. Do we win something?'],
  ['ES','Spain','🇪🇸','GOV','A333','SPANISH AIR FORCE','Spanish Air Force','Spanish state A330','Madrid','TOJ','es','{C}, {R}. Buenas tardes, Nagpur.'],
  ['NL','Netherlands','🇳🇱','GOV','B38M','NETHERLANDS 1','Netherlands One','Dutch state BBJ','Amsterdam','AMS','nl','{C}, {R}. We brought our own bicycles.'],
  ['NG','Nigeria','🇳🇬','GOV','B77W','NIGERIAN 1','Nigerian One','Nigerian state 777','Abuja','ABV','ng','{C}, heavy, {R}. Our delegation is bigger than our aircraft.'],
  ['KZ','Kazakhstan','🇰🇿','GOV','A21N','KAZAKH 1','Kazakh One','Kazakh state A321','Astana','NQZ','kz','{C}, {R}. Long way from Astana. Short way to the carpet.'],
  ['TH','Thailand','🇹🇭','TG','A359','THAI 1','Thai One','Royal Thai A350','Bangkok','BKK','th','{C}, {R}. Sawasdee, Nagpur.'],
  ['VN','Vietnam','🇻🇳','GOV','A359','VIETNAM 1','Vietnam One','Vietnamese state A350','Hanoi','HAN','vn','{C}, {R}. Xin chào. Ready for the red carpet.'],
  ['PL','Poland','🇵🇱','GOV','B38M','POLISH AIR FORCE 001','Polish Air Force 001','Polish state 737','Warsaw','WAW','pl','{C}, {R}. Dzień dobry. Who do we follow?'],
  ['SE','Sweden','🇸🇪','GOV','A20N','SWEDISH AIR FORCE 1','Swedish Air Force One','Swedish state A320','Stockholm','ARN','se','{C}, {R}. Our red carpet is flat-packed. Assembly takes ten minutes.'],
  ['IE','Ireland','🇮🇪','GOV','A20N','IRISH 1','Irish One','Irish state A320','Dublin','DUB','ie','{C}, {R}. Grand day for it.'],
  ['PT','Portugal','🇵🇹','GOV','A20N','PORTUGUESE AIR FORCE 1','Portuguese Air Force One','Portuguese state A320','Lisbon','LIS','pt','{C}, {R}. Obrigado for the slot. Lovely stack.'],
  ['BE','Belgium','🇧🇪','GOV','A21N','BELGIAN AIR FORCE','Belgian Air Force','Belgian state A321','Brussels','BRU','be','{C}, {R}. Chocolates for the tower are on board.'],
  ['NZ','New Zealand','🇳🇿','GOV','A21N','KIWI 1','Kiwi One','RNZAF A321','Auckland','AKL','au','{C}, {R}. Kia ora. We are not Australia.'],
  ['BD','Bangladesh','🇧🇩','GOV','B789','BANGLADESH 1','Bangladesh One','Bangladeshi state 787','Dhaka','DAC','in','{C}, {R}. Short flight. Long holding.'],
  ['LK','Sri Lanka','🇱🇰','GOV','A333','SRI LANKA 1','Sri Lanka One','Sri Lankan state A330','Colombo','CMB','in','{C}, {R}. We have brought tea for the holding stack.'],
  ['KE','Kenya','🇰🇪','GOV','B38M','KENYA 1','Kenya One','Kenyan state 737','Nairobi','NBO','ng','{C}, {R}. Jambo, Nagpur.'],
  ['BT','Bhutan','🇧🇹','GOV','A20N','BHUTAN 1','Bhutan One','Bhutanese state A320','Paro','PBH','in','{C}, {R}. Smallest delegation. Happiest delegation.'],
  ['MX','Mexico','🇲🇽','AM','B789','AEROMEXICO 92','Aeromexico 92','Aeromexico 787 (scheduled, economy)','Mexico City','MEX','mx','']];
const DL={};DELEG.forEach(a=>{const [k,country,flag,al,type,cs,nm,disp,from,code,v,call]=a;DL[k]={k,country,flag,al,type,cs,nm,disp,from,code,v,call};});
const SPOKEN={'Canforce 001':'Canforce zero zero one','Tango 01':'Tango zero one','EU 01':'E U zero one','Cotam 001':'Cotam zero zero one','Cotam 002':'Cotam zero zero two',
  'SAM 29000':'Sam two nine thousand','Aeromexico 92':'Aeromexico ninety-two','Polish Air Force 001':'Polish Air Force zero zero one'};
const RWW={L:'left',R:'right',C:'centre'},DIG=['zero','one','two','three','four','five','six','seven','eight','nine'];
// what the voice says: runway designators spelled out, numbered callsigns as a pilot reads them
function spoken(t){let s=t.replace(/\b(\d)(\d)([LRC])\b/g,(m,a,b,c)=>`${DIG[+a]} ${DIG[+b]} ${RWW[c]}`);for(const k in SPOKEN)s=s.split(k).join(SPOKEN[k]);return s;}
// how long a line takes to say, in real seconds (the announcer and the SPG take their time)
const lineDur=(t,v)=>0.6+spoken(t).split(/\s+/).length/(v==='announcer'||v==='ru_announcer'?2.25:v==='spg'?2.1:2.7);
const ANN={REACH1:'Ladies and gentlemen, the motorcade of the President of the United States.',AE1:'Ladies and gentlemen: the United Arab Emirates.',
  JP1:'Ladies and gentlemen: Japan.',DE1:'Ladies and gentlemen: the Federal Republic of Germany.',GB1:'Ladies and gentlemen: the United Kingdom.',
  SA1:'Ladies and gentlemen: the Kingdom of Saudi Arabia.',FR1:'Ladies and gentlemen: the French Republic.',KR1:'Ladies and gentlemen: the Republic of Korea.'};
const SBAN={REACH1:r=>['THE MOTORCADE ARRIVES FIRST',`US Air Force C-17s, carrying the cars · ${r[0].short}`,'The car has its own aeroplane. Two, actually 🚗',FLAG_US],
  AE1:r=>['THE UAE DELEGATION',`An Emirates A380. All of it. · ${r[0].short}`,'Business class: the whole aeroplane ✨',icos('🇦🇪')],
  JP1:r=>['JAPAN AIR FORCE ONE',`Boeing 777 · on final for ${r[0].short}`,'Exactly on time 🇯🇵',icos('🇯🇵')],
  JP2:r=>['…AND THE BACKUP',`Japanese Air Force Two · the identical 777 · ${r[1].short}`,'Also on time. To the second ⏱️',icos('🇯🇵')],
  DE1:r=>['THE GERMAN DELEGATION',`Luftwaffe A350 · on final for ${r[0].short}`,'Four seconds early. An apology has been filed 📋',icos('🇩🇪')],
  GB1:r=>['THE BRITISH DELEGATION',`RAF Voyager · on final for ${r[0].short}`,'They admired your holding stack. A very orderly queue 🫖',icos('🇬🇧')],
  SA1:r=>['THE SAUDI DELEGATION',`A royal 747-8 on ${r[0].short}, then a 777 and a 787`,'Three aircraft. Two of them are luggage 🧳',icos('🇸🇦')],
  FR1:r=>['THE FRENCH DELEGATION',`French Republic A330 · the press A321 behind it`,'The press landed already writing 📰',icos('🇫🇷')],
  KR1:r=>['CODE ONE',`Republic of Korea Air Force 747-8 · ${r[0].short}`,'On the glide path. Exactly on it 📐',icos('🇰🇷')],
  CN1:r=>[`AIR CHINA ONE · BOEING 747-8 · ON FINAL FOR ${r[0].short}`,'The President of China','The red carpet was measured twice 📏',FLAG_CN],
  RU0:r=>['THE RUSSIAN FEDERATION','Two identical Ilyushin Il-96s on final','Nobody will say which one 🎶',FLAG_RU],
  RUC:r=>['THE OTHER MOTORCADE',`Russia Cargo · Antonov An-124 with the cars · ${r[1].short}`,'Every motorcade has its own aeroplane now 🚗',FLAG_RU],
  RU1:r=>['IS THE PRESIDENT ON THIS ONE…',`Russia · Ilyushin Il-96 · ${r[0].short}`,'Nobody will say 🎶',FLAG_RU],
  RU2:r=>['…OR ON THIS ONE?',`Russia Two · the identical Il-96 · ${r[1].short}`,'Two aircraft. One President. Zero answers 🎶',FLAG_RU],
  RU2B:r=>['…OR WAS IT THIS ONE?',`Russia Two · the identical Il-96 · ${r[0].short}`,'Two aircraft. One President. Zero answers 🎶',FLAG_RU],
  AF1:r=>[`AIR FORCE ONE · BOEING 747 · ON FINAL FOR ${r[0].short}`,'The President of the United States','Welcome to Zero Mile! 🤝',FLAG_US],
  SAM:r=>['THE SPARE AIR FORCE ONE',`An identical 747 · on final for ${r[0].short}`,'Spare aircraft, spare runway, nobody on board 🛬',FLAG_US],
  TRIO:r=>['THREE PRESIDENTS, ONE PHOTO',`Air China 747-8 · Il-96 · Air Force One · ${r.map(x=>x.short).join(', ')}`,'Nobody landed first 📸',FLAG_CN+FLAG_RU+FLAG_US]};
// radio chatter (ticker only) that follows a delegation, so it always matches what just happened
const AFTER={REACH1:['SPG','The American motorcade has arrived before the President. This is normal.'],BT:['SPG','The Prime Minister is on the red carpet and will welcome every leader personally. The red carpet has been extended twice.'],
  IT:['APP','IndiGo 2214 asks if it can say it is carrying a head of state. Negative.'],jp:['SPG','Japan has brought two aircraft. In case.'],SG:['APP','Akasa 1103 has declared itself a sovereign nation and requests summit priority. Request denied.'],
  AU:['APP','SpiceJet 405: "We have a minister on board." "Which one?" "A junior one." "Hold."'],QA:['FSO','The VIP apron has run out of red carpet. Ops is borrowing the carpet from the lounge.'],
  ru:['FSO','The second motorcade has its own aeroplane too. The two motorcades have been parked facing away from each other.'],ru2:['FSO','The second motorcade has its own aeroplane too. The two motorcades have been parked facing away from each other.'],ES:['PROTOCOL','The seating plan for the family photo is on its eleventh version.'],
  KZ:['FSO','Ground ops reports the red carpet now reaches the cargo apron.']};
// the running order: protocol's alphabetical big three (China, Russia, then the United States, last), everyone else between
const RUN=[['cer','REACH1',['REACH2']],['reg','BT'],['reg','NL'],['reg','KE'],['reg','IT'],['cer','AE1',['AE2']],['reg','TH'],['reg','MY'],['reg','CA'],['reg','PT'],['jp'],['reg','LK'],['reg','BE'],['reg','SG'],
  ['cn'],['reg','AU'],['reg','NZ'],['reg','IE'],['cer','DE1',['DE2']],['reg','SE'],['reg','PL'],['ru'],['reg','BR'],['reg','AR'],['mx'],['cer','GB1',[]],['reg','ID'],['reg','VN'],['spg'],
  ['reg','ZA'],['cer','SA1',['SA2','SA3']],['reg','QA'],['reg','TR'],['cer','FR1',['FR2']],['reg','ES'],['reg','NG'],['cer','KR1',[]],['reg','KZ'],['reg','BD'],['reg','EU'],['us']];
const SPARE_LINES=r=>[`We now take ${r.short} as well.`,'The spare aircraft needs a spare runway.'];
const MID_LINES=['Your holding stack is now the second-largest gathering in Nagpur today.','Very impressive, sir.'];
const MX_LINES=['Zero Mile Approach, Aeromexico 92, still holding. Mexico flew commercial.','Zero Mile Tower, Aeromexico 92, on the ground. Mexico flew commercial.'];
// lay out the running order. Every item is a block of beats in real seconds around its touchdown (td): its airtime (a0..a1)
// may not overlap the next one's, and a runway takes a landing at most every 72 sim-s. trio: the big three land together.
function sumPlan(E,R3,trio){
  const P=SUMP,GAP=0.5,SEPV=60,two=[R3[0],R3[1]],out={items:[],lines:[],p0:E+14*P};let cur=out.p0;const last=new Map(R3.map(r=>[r,-1e9]));
  let tl=[];const V=(v,src,text)=>{tl.push({key:text,voice:v,say:spoken(text)});return{v,src,text,dur:lineDur(text,v)};};
  const fillC=(t,d,r)=>t.split('{C}').join(d.nm).split('{R}').join(r?r.short:'');
  const blk={
    reg(k){return rw=>{const d=DL[k],call=V(d.v,d.cs,fillC(d.call,d,rw[0])),c0=-(call.dur+1.1);
      return{ac:[{d,off:0}],a0:c0,a1:c0+call.dur+0.2,beats:[[c0,'lt',{ds:[d],q:call.text}],[c0,'say',call]]};};},
    cer(k,sups){return rw=>{const d=DL[k],ann=V('announcer','ANNOUNCER',ANN[k]),call=V(d.v,d.cs,fillC(d.call,d,rw[0])),cs=-9.4,as=cs-0.5-ann.dur,ban=SBAN[k](rw),ds=[d].concat(sups.map(s=>DL[s]));
      return{ac:[{d,off:0}].concat(sups.map((s,i)=>({d:DL[s],off:i?13:3.5,ri:i?0:1}))),a0:as,a1:2.8,beats:[[as,'ban',ban],[as,'lt',{ds,q:ann.text,ann:true}],[as,'say',ann],[cs,'lt',{ds,q:call.text}],[cs,'say',call],[-8.6,'shot',{i:0,ban,until:2.6}]]};};},
    jp(){return rw=>{const d1=DL.JP1,d2=DL.JP2,ann=V('announcer','ANNOUNCER',ANN.JP1),c1=V('jp',d1.cs,fillC(d1.call,d1,rw[0])),c2=V('jp',d2.cs,fillC(d2.call,d2,rw[1])),cs=-9.4,as=cs-0.5-ann.dur;
      return{ac:[{d:d1,off:0},{d:d2,off:8,ri:1}],a0:as,a1:10.6,beats:[[as,'ban',SBAN.JP1(rw)],[as,'lt',{ds:[d1,d2],q:ann.text,ann:true}],[as,'say',ann],[cs,'lt',{ds:[d1],q:c1.text}],[cs,'say',c1],
        [-8.6,'shot',{i:0,ban:SBAN.JP1(rw),until:2.2}],[2.4,'lt',{ds:[d2],q:c2.text}],[2.4,'say',c2],[2.2,'shot',{i:1,ban:SBAN.JP2(rw),until:10.5}]]};};},
    cn(){return rw=>{const d=DL.CN1,s=DL.CN2,ann=V('announcer','ANNOUNCER',`Ladies and gentlemen. The aircraft carrying the President of the People's Republic of China shall now be landing on runway ${rw[0].short}.`),
      call=V('cn',d.cs,fillC(d.call,d,rw[0])),twr=V('tower','TWR',`${d.nm}, runway ${rw[0].short}, cleared to land. The red carpet has been measured twice.`),tw=-2.4-twr.dur,cs=tw-0.4-call.dur,as=cs-0.6-ann.dur,ban=SBAN.CN1(rw);
      return{ac:[{d,off:0},{d:s,off:5,ri:1}],a0:as,a1:3.2,stop:[-90,90],beats:[[as,'ban',ban],[as,'lt',{ds:[d,s],q:ann.text,ann:true}],[as,'say',ann],[cs,'lt',{ds:[d,s],q:call.text}],[cs,'say',call],
        [tw,'lt',{ds:[d,s],q:twr.text,twr:true}],[tw,'say',twr],
        // the guqin (music/guqin.mp3, 18.9 s) plays over the whole landing shot, which is cut to its length: it opens 16.5 s out
        // and holds 2.4 s past touchdown, so Air China One lands on the music's last phrase
        [-16.5,'music','guqin'],[-16.5,'shot',{i:0,ban,until:2.4}],[2.6,'music',null]]};};},
    ru(){return rw=>{const d0=DL.RUCARGO,d1=DL.RU1,d2=DL.RU2,ann=V('ru_announcer','PROTOCOL','Attention, please. The delegation of the Russian Federation. First, the cars. Then two aircraft. They are identical.'),
      c0=V('ru',d0.cs,fillC(d0.call,d0,rw[1])),c1=V('ru',d1.cs,fillC(d1.call,d1,rw[0])),c2=V('ru',d2.cs,fillC(d2.call,d2,rw[1])),twr=V('tower','TWR','Russia, Russia Two, welcome to Zero Mile. We will not ask which one.'),
      as=-12.8-ann.dur,s2=2.2,tw=Math.max(5.9,s2+c2.dur+0.3),all=[d0,d1,d2];
      return{ac:[{d:d0,off:-6,ri:1},{d:d1,off:0},{d:d2,off:7.5,ri:1}],a0:as,a1:Math.max(10.6,tw+twr.dur+0.2),stop:[-100,80],beats:[[as,'ban',SBAN.RU0(rw)],[as,'lt',{ds:all,q:ann.text,ann:true}],[as,'say',ann],
        [-12.2,'music','rasputin'],[-12.2,'shot',{i:0,ban:SBAN.RUC(rw),until:-5.5}],[-12.2,'lt',{ds:[d0],q:c0.text}],[-12.2,'say',c0],
        [-5.5,'shot',{i:1,ban:SBAN.RU1(rw),until:2.1}],[-5.5,'lt',{ds:[d1,d2],q:c1.text}],[-5.5,'say',c1],
        [2.1,'shot',{i:2,ban:SBAN.RU2(rw),until:10.4}],[s2,'lt',{ds:[d2,d1],q:c2.text}],[s2,'say',c2],[tw,'lt',{ds:[d2,d1],q:twr.text,twr:true}],[tw,'say',twr],[9.3,'music',null]]};};},
    us(){return rw=>{const d=DL.AF1,s=DL.SAM,sp=SPARE_LINES(R3[2]),ann=V('announcer','ANNOUNCER',`Ladies and gentlemen. The aircraft carrying the President of the United States shall now be landing on runway ${rw[0].short}.`),
      call=V('us',d.cs,fillC(d.call,d,rw[0])),twr=V('tower','TWR',`${d.nm}, Zero Mile Tower, runway ${rw[0].short}, cleared to land. Welcome to India.`),stw=V('tower','TWR',`SAM 29000, the spare, runway ${rw[1].short}, cleared to land.`),
      tw=-2.4-twr.dur,cs=tw-0.4-call.dur,as=cs-0.6-ann.dur,g0=as-0.8-lineDur(sp[0],'spg')-1.2-lineDur(sp[1],'spg'),ban=SBAN.AF1(rw);sp.forEach(t=>tl.push({key:t,voice:'spg',say:spoken(t)}));
      return{ac:[{d,off:0},{d:s,off:6.5,ri:1}],a0:g0,a1:8,stop:[-90,90],spare:g0,beats:[[g0,'guard',{lines:sp,gap:1200}],[as,'ban',ban],[as,'lt',{ds:[d,s],q:ann.text,ann:true}],[as,'say',ann],[cs,'lt',{ds:[d,s],q:call.text}],[cs,'say',call],
        [tw,'lt',{ds:[d,s],q:twr.text,twr:true}],[tw,'say',twr],[-9,'shot',{i:0,ban,until:3}],[3.3,'lt',{ds:[s],q:stw.text,twr:true}],[3.3,'say',stw]]};};},
    // trio mode: the three land together on three runways; then the second Il-96 alone; then the spare 747 alone
    trio(){return rw=>{const a=DL.CN1,b=DL.RU1,c=DL.AF1,ann=V('announcer','ANNOUNCER','Ladies and gentlemen. Three Presidents shall now be landing at the same time, on three runways. Nobody will be first.'),
      ca=V('cn',a.cs,`${a.nm}, runway ${R3[0].short}.`),cb=V('ru',b.cs,`${b.nm}, runway ${R3[1].short}.`),cc=V('us',c.cs,`${c.nm}, runway ${R3[2].short}.`),twr=V('tower','TWR','Air China One, Russia, Air Force One: all three cleared to land. Together.'),
      tw=-1.6-twr.dur,s3=tw-0.4-cc.dur,s2=s3-0.3-cb.dur,s1=s2-0.3-ca.dur,as=s1-0.6-ann.dur,ban=SBAN.TRIO(R3);
      return{ac:[{d:a,off:0,rw:R3[0]},{d:b,off:0,rw:R3[1]},{d:c,off:0,rw:R3[2]},{d:DL.CN2,off:12.5,rw:R3[0]}],a0:as,a1:4.2,stop:[-90,90],trio:1,beats:[[as,'ban',ban],[as,'lt',{ds:[a,b,c],q:ann.text,ann:true}],[as,'say',ann],
        [s1,'lt',{ds:[a],q:ca.text}],[s1,'say',ca],[s2,'lt',{ds:[b],q:cb.text}],[s2,'say',cb],[s3,'lt',{ds:[c],q:cc.text}],[s3,'say',cc],[tw,'lt',{ds:[a,b,c],q:twr.text,twr:true}],[tw,'say',twr],[-9,'shot',{view:'trio',ban,until:4}]]};};},
    ru2(){return rw=>{const d0=DL.RUCARGO,d=DL.RU2,ann=V('ru_announcer','PROTOCOL','Attention, please. The cars of the Russian Federation. Then the second aircraft. Also identical.'),c0=V('ru',d0.cs,fillC(d0.call,d0,rw[1])),
      call=V('ru',d.cs,fillC(d.call,d,rw[0])),as=-12.8-ann.dur,ban=SBAN.RU2B(rw);
      return{ac:[{d:d0,off:-6,ri:1},{d,off:0}],a0:as,a1:4.6,beats:[[as,'ban',SBAN.RUC(rw)],[as,'lt',{ds:[d0,d],q:ann.text,ann:true}],[as,'say',ann],
        [-12.2,'music','rasputin'],[-12.2,'shot',{i:0,ban:SBAN.RUC(rw),until:-5.5}],[-12.2,'lt',{ds:[d0],q:c0.text}],[-12.2,'say',c0],[-5.5,'shot',{i:1,ban,until:3}],[-5.5,'lt',{ds:[d],q:call.text}],[-5.5,'say',call],[3.4,'music',null]]};};},
    sam(){return rw=>{const d=DL.SAM,sp=SPARE_LINES(R3[2]),ann=V('announcer','ANNOUNCER','Ladies and gentlemen. The spare aircraft of the President of the United States.'),call=V('us',d.cs,fillC(d.call,d,rw[0])),cs=-10.6-call.dur+2,as=cs-0.6-ann.dur,
      g0=as-0.8-lineDur(sp[0],'spg')-1.2-lineDur(sp[1],'spg'),ban=SBAN.SAM(rw);sp.forEach(t=>tl.push({key:t,voice:'spg',say:spoken(t)}));
      return{ac:[{d,off:0}],a0:g0,a1:3.2,spare:g0,beats:[[g0,'guard',{lines:sp,gap:1200}],[as,'ban',ban],[as,'lt',{ds:[d],q:ann.text,ann:true}],[as,'say',ann],[cs,'lt',{ds:[d],q:call.text}],[cs,'say',call],[-10,'shot',{i:0,ban,until:3}]]};};},
    spg(){return()=>{MID_LINES.forEach(t=>tl.push({key:t,voice:'spg',say:spoken(t)}));return{ac:[],a0:0,a1:lineDur(MID_LINES[0],'spg')+1.5+lineDur(MID_LINES[1],'spg')+0.6,beats:[[0,'guard',{lines:MID_LINES}]]};};},
    mx(){return()=>{MX_LINES.forEach(t=>V('mx','AEROMEXICO 92',t));return{ac:[],a0:0,a1:lineDur(MX_LINES[0],'mx')+0.4,beats:[[0,'mx',{}]]};};}};
  const order=RUN.map(x=>trio&&x[0]==='cn'?['trio']:trio&&x[0]==='ru'?['ru2']:trio&&x[0]==='us'?['sam']:x);
  order.forEach((x,seq)=>{const mk2=blk[x[0]](x[1],x[2]||[]);
    // runways: the main aircraft takes whichever SPG runway is free sooner; ri:1 the other one, ri:0 the same
    const tryRw=main=>{const other=main===two[0]?two[1]:two[0];tl=[];const it=mk2([main,other]);it.lines=tl;let td=cur-it.a0*P;
      for(const a of it.ac){const r=a.rw||(a.ri===1?other:main);td=Math.max(td,last.get(r)+SEPV-a.off*P);}return{it,td,rw:[main,other]};};
    let pick=tryRw(two[0]);if(!x[0].match(/^(trio)$/)){const b=tryRw(two[1]);if(b.td<pick.td-0.5)pick=b;}
    const {it,td,rw}=pick;out.lines.push(...it.lines);it.k=x[1]||x[0];it.kind=x[0];it.seq=seq;it.td=td;it.A0=td+it.a0*P;it.A1=td+it.a1*P;it.rw=rw;
    it.ac.forEach(a=>{a.r=a.rw||(a.ri===1?rw[1]:rw[0]);a.td=Math.round(td+a.off*P);last.set(a.r,Math.max(last.get(a.r),a.td));});
    it.abs=it.beats.map(b=>[td+b[0]*P,b[1],b[2]]);if(AFTER[it.k])it.abs.push([td+(it.a1+0.2)*P,'radio',AFTER[it.k]]);
    if(it.stop)it.stopAt=[td+it.stop[0],td+it.stop[1]];out.items.push(it);cur=it.A1+GAP*P;});
  out.p1=cur;return out;}
// the trio shot: from high behind the three approaches, looking west down all three finals at once
function trioView(R3){const ys=R3.map(r=>r.y),cy=(Math.min(...ys)+Math.max(...ys))/2,lx=R3[0].x1+900,cx=lx+8200,h=1500;const dx=cx-lx,hz=Math.abs(dx);
  return{tx:lx,ty:cy,dist:Math.hypot(hz,h),pitch:Math.atan2(h,hz),yaw:Math.atan2(dx,0)};}

// ---- the lower-third (who is landing, in their own words) and the delegation counter ----
(function(){const st=document.createElement('style');st.textContent=`#delegLT{position:absolute;left:16px;bottom:200px;z-index:12;width:min(560px,calc(100% - var(--rail) - 70px));pointer-events:none;opacity:0;transform:translateY(14px);transition:opacity .35s,transform .35s}
#delegLT.on{opacity:1;transform:none}#delegLT .cur{display:flex;gap:11px;align-items:center;background:linear-gradient(90deg,rgba(10,13,16,.96),rgba(10,13,16,.86));border-left:4px solid #f4c430;border-radius:6px;padding:8px 13px 9px;box-shadow:0 10px 26px rgba(0,0,0,.5)}
#delegLT .fl{font-size:36px;line-height:40px;white-space:nowrap}#delegLT .tx{min-width:0;flex:1}#delegLT .hd{font-family:var(--f-sign);font-weight:700;font-size:17.5px;color:#fff;letter-spacing:.02em;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#delegLT .hd span{font-weight:500;color:#cfd8dd}
#delegLT .mt{display:flex;flex-wrap:wrap;gap:3px 9px;align-items:center;margin-top:3px;font-family:var(--f-mono);font-size:11px;color:#9fb3c8}#delegLT .mt .rw{font-family:var(--f-sign);font-weight:700;font-size:15px;color:#f4c430}
#delegLT .st{font-family:var(--f-mono);font-weight:600;font-size:10.5px;padding:1px 6px;border-radius:3px;background:#8a7cff;color:#0b0b0b;vertical-align:2px}#delegLT .st.ok{background:#3ad07f}
#delegLT .sub{font-family:var(--f-mono);font-size:11px;color:#9fb3c8;margin-top:2px}#delegLT .q{font-family:var(--f-body);font-size:14.5px;color:#ffd27a;margin-top:3px;font-style:italic;line-height:1.25}
#delegLT .q.ann{color:#fff;font-style:normal}#delegLT .q b{font-style:normal;font-family:var(--f-mono);font-size:10.5px;color:#9fb3c8;margin-right:6px}
#delegLT.tight .q,#delegLT.tight .prev{display:none}
#delegLT .prev{margin-top:5px;display:inline-block;background:rgba(10,13,16,.86);border-radius:4px;padding:3px 9px;font-family:var(--f-mono);font-size:11.5px;color:#cfd8dd}#delegLT .prev:empty{display:none}
#delegChip{position:absolute;left:16px;top:204px;z-index:12;padding:7px 13px;border-radius:8px;background:rgba(10,13,16,.92);border:1px solid #ff9933;font-family:var(--f-sign);font-weight:700;font-size:18px;letter-spacing:.03em;color:#fff;box-shadow:0 8px 20px rgba(0,0,0,.45)}
#delegChip[hidden]{display:none}#delegChip b{color:#ffb35c;font-size:22px}#delegChip small{display:block;font-family:var(--f-mono);font-weight:500;font-size:10.5px;color:#9fb3c8;letter-spacing:.06em}#delegChip small i{font-style:normal;color:#ff5a4f}
.speeds.live button[data-s]:not(#spP){opacity:.4}`;document.head.appendChild(st);
  const d=document.createElement('div');d.id='delegLT';d.setAttribute('aria-live','polite');d.innerHTML='<div class="cur"></div><div class="prev"></div>';$('#app').appendChild(d);
  const c=document.createElement('div');c.id='delegChip';c.hidden=true;$('#app').appendChild(c);})();
const LT={cur:null,prev:null,html:''};
function ltSet(o){if(LT.cur&&LT.cur.ds[0].k!==o.ds[0].k&&!LT.cur.ann)LT.prev=LT.cur;LT.cur=Object.assign({t:T},o);ltRender(true);}
function ltStatus(f){return !f?'':f.landT!=null?'LANDED':f.state==='approach'?'ON FINAL':f.state==='sched'?'':'INBOUND';}
function ltRender(force){const el=$('#delegLT');if(!el)return;const c=LT.cur;
  if(!c){if(el.classList.contains('on'))el.classList.remove('on');return;}
  const fs=c.ds.map(d=>c.fs[d.k]).filter(Boolean),allIn=fs.length&&fs.every(f=>f.landT!=null),lastIn=allIn?Math.max(...fs.map(f=>f.landT)):0;
  if(!force&&T>c.t+16*SUMP&&(allIn?T>lastIn+3*SUMP:false)){LT.cur=null;el.classList.remove('on');return;}
  const d=c.ds[0],f=c.fs[d.k],flags=[...new Set(c.ds.map(x=>x.flag))].join(''),st=ltStatus(f);
  const hd=c.ann?`📣 ${c.ds.length>2&&new Set(c.ds.map(x=>x.country)).size>1?'THREE PRESIDENTS':d.country.toUpperCase()} <span>· the announcer</span>`:`${d.country.toUpperCase()} <span>· ${d.disp}</span>`;
  const sub=c.ann?'':`<div class="mt">${f&&f.rwy?`<span class="rw">${f.rwy.short}</span>`:''}${st?`<span class="st ${st==='LANDED'?'ok':''}">${st==='LANDED'?'LANDED ✓':st}</span>`:''}${c.ds.slice(1).map(x=>{const g=c.fs[x.k];return `<span>+ ${x.disp}${g&&g.rwy?' · '+g.rwy.short:''}${g&&g.landT!=null?' ✓':''}</span>`;}).join('')}</div>`;
  const q=`<div class="q${c.ann?' ann':''}">${c.ann?'<b>ANNOUNCER</b>':c.twr?'<b>TOWER</b>':''}${c.ann||c.twr?c.q:'“'+c.q+'”'}</div>`;
  const p=LT.prev;let ph='';if(p){const pf=p.ds.map(x=>p.fs[x.k]).filter(Boolean),n=pf.filter(g=>g.landT!=null).length;ph=`${p.ds[0].flag} ${p.ds[0].country} · ${n===pf.length?`landed ✓${pf.length===1&&pf[0].rwy?' '+pf[0].rwy.short:''}`:pf.length===1?(ltStatus(pf[0])||'inbound').toLowerCase():`${n} of ${pf.length} landed`}`;}
  const h=`<div class="cur"><span class="fl">${flags}</span><div class="tx"><div class="hd">${hd}</div>${sub}${q}</div></div><div class="prev">${ph}</div>`;
  if(h!==LT.html){el.innerHTML=h;LT.html=h;}if(!el.classList.contains('on')){const w=$('#wave').getBoundingClientRect(),app=$('#app').getBoundingClientRect();el.style.bottom=Math.round(app.bottom-w.top+10)+'px';el.classList.add('on');}}
function ltReset(){LT.cur=LT.prev=null;LT.html='';const el=$('#delegLT');if(el)el.classList.remove('on');const c=$('#delegChip');if(c)c.hidden=true;document.querySelectorAll('.speeds').forEach(s=>s.classList.remove('live'));}

// apply a plan: aircraft times, the SPG's blocks (ending when the staged return reopens each runway) and the big three's stops
function sumApply(c,pl){c.pl=pl;const R3=c.R3,us=pl.items.find(it=>it.spare!=null);c.ret=spgStaged.times(pl.p1+30,3,{});c.retOrder=[R3[2],R3[1],R3[0]];
  HOLDDEP={from:c.E,until:Math.round(pl.p1+30)};for(const f of flights)if(f.sumHeld&&f.state==='at_gate')sumHold(f);
  for(const r of RW)r.blocks=r.blocks.filter(b=>b.sumC!==c);
  c.retOrder.forEach((r,i)=>{const from=r===R3[2]?Math.round(us.td+us.spare*SUMP-6):c.E+60;r.blocks.push({from,to:c.ret.open[i],why:'Security (VVIP)',desk:r===R3[2]?'Taken by security: the spare runway':'Taken by security',summit:true,sumC:c});});
  for(const it of pl.items)if(it.stopAt)for(const r of RW.filter(r=>!r.locked)){if(c.spg.includes(r))continue;r.blocks.push({from:it.stopAt[0],to:it.stopAt[1],why:it.trio?'Summit: three presidents, one photo':'Summit: every runway stopped',desk:it.trio?'Summit: three presidents, one photo':'Summit: every runway stopped',big:true,sumC:c});}
  for(const r of RW)r.blocks.sort((a,b)=>a.from-b.from);
  for(const it of pl.items)for(const a of it.ac){const f=c.fs[a.d.k];if(f&&f.state==='sched'){f.spTd=a.td;f.spRw=a.r;f.origEta=a.td;f.eta=a.td;}}
  c.len=c.ret.open[2]-c.E+60;renderRw();}

STORY.delhisummit={len:4000,start(c){const open=RW.filter(r=>!r.locked);if(open.length<4)return false;
  const E=T,byId=id=>RW.find(r=>r.id===id&&!r.locked);let R3=[byId('R1'),byId('R2'),byId('R3')];if(R3.some(r=>!r))R3=open.slice(0,3);c.R3=R3;c.spg=[R3[0],R3[1]];c.E=E;
  const pl=sumPlan(E,R3,false);c.fs={};c.mode='alpha';c.landed=new Set();c.bi=0;
  // the delegations (Mexico flew commercial: it is a scheduled flight in the stack like everyone else)
  for(const it of pl.items)for(const a of it.ac){const d=a.d;const f=specialArr({al:d.al,type:d.type,num:'1',disp:d.disp,callsign:d.cs,from:d.from,fromCode:d.code,intl:true,vip:true},a.r,a.td,null);
    Object.assign(f,{toPark:true,parkText:'To the VIP apron (red carpet)',deleg:true,dk:d.k});c.fs[d.k]=f;}
  {const d=DL.MX,f=mk({kind:'arr',state:'sched',al:d.al,type:d.type,intl:true,from:d.from,fromCode:d.code,dir:'W',eta:E+700,endurance:95});Object.assign(f,{num:'92',origEta:E+700,spawnT:E+700-D_APP-150,disp:'Aeromexico 92',deleg:true,dk:'MX',notamX:true});c.fs.MX=f;c.mx=f;}
  c.total=Object.keys(c.fs).length;sumApply(c,pl);
  for(const f of flights)if(f.state==='approach'&&c.spg.includes(f.rwy)&&f.td-T>25&&f.td>=E+40)goAround(f,'summit protocol');
  // airlines thin the afternoon: a third of the flights in the window are cancelled; the rest carry the NOTAM's extra fuel
  let nc=0,k=0,nh=0;for(const f of flights){if(f.deleg)continue;const inW=f.kind==='arr'&&f.state==='sched'&&f.eta>E+120&&f.eta<pl.p1;
    if(inW&&(k++%6===5)){if(f.res){f.res.res=null;f.res=null;}f.state='cancelled';nc++;}}
  for(const f of flights)if(f.kind==='dep'&&f.state==='at_gate'&&!f.charter&&!f.vip&&f.std<pl.p1){sumHold(f);nh++;}
  for(const f of flights)if(f.kind==='arr'&&f.landT==null&&!f.vip&&!f.deleg&&['sched','inbound','holding','goaround'].includes(f.state)&&f.origEta>E-1200&&f.origEta<pl.p1+1500){f.endurance+=25;f.notam=true;}
  c.nc=nc;
  c.lines=[[0,'SPG',`The Delhi summit has moved to Zero Mile. 38 delegations, 50 aircraft, and Mexico. We have taken ${c.spg.map(r=>r.short).join(' and ')}. Thank you for your support.`],
    [15,'TWR','All airlines: summit protocol in force. Expect holding. Then expect more holding.'],
    [40,'AOCC',`Airlines have cancelled ${nc} arrivals for the summit. The rest carry extra fuel for the holding, and a plan to divert.`],
    [75,'SPG',`Departures stay at their gates until we hand your runways back. ${nh} so far. They will all want to go at once.`]];c.nh=nh;
  guard(['Sir. Delhi has brought its summit. We have taken over your runways.','Thank you for giving us your runways. Thank you for your support.'],null,{gap:1500});
  flashBanner(['THE DELHI SUMMIT','Delhi moved in, and brought its summit: 50 aircraft from 38 delegations','No Indian aircraft today: the Prime Minister is already on the red carpet 🙏',FLAG_IN+icos('🌍')],6500);
  const cnIt=pl.items.find(it=>it.kind==='cn');
  const I=storyCard(c,{icon:{g:'V',c:'#ff9933'},x:c.spg[0].x1+1500,y:c.spg[0].y,title:'Who lands first? The big three disagree',
    text:'The United States wants to land before Russia. Russia wants to land before the United States. China would like to land at the same time as both. Protocol stops every runway for 3 minutes around each of them, alphabetically: China, Russia, then the US (9 minutes in all). Land all three at once and it is a single 3-minute stop, but their three motorcades meet on the apron and nobody will reverse: pushbacks stop for 12 minutes. Or let them negotiate: every runway stops for 8 minutes while they talk.',
    def:0,defText:"protocol's alphabetical order stands: three 3-minute stops.",
    acts:[{l:'Alphabetical, as planned',pri:1,fn(){resolve(I,true,'The big three land alphabetically: China, Russia, then the United States.');}},
      {l:'All three at once',dis:()=>T>=cnIt.A0-20,fn(){const pb=sumPlan(E,R3,true);const keep=c.pl.items.filter(it=>it.A0<=T);if(keep.some(it=>it.kind==='cn')){resolve(I,true,'');return;}
        pb.items=keep.concat(pb.items.filter(it=>it.seq>=keep.length));c.mode='trio';sumApply(c,pb);const tr=pb.items.find(it=>it.trio);
        c.lines.push([tr.td+120-E,()=>{FX.pushFreeze=Math.max(FX.pushFreeze,T+720);guard(['The three motorcades have met on the apron.','Nobody will reverse. Talks are under way.'],null,{gap:1500});radio('FSO','Three motorcades, one apron road, zero reversing. Pushbacks stopped for 12 minutes.');}]);
        resolve(I,true,'The big three land together: one photo, one gridlocked apron.');}},
      {l:'Let them negotiate',fn(){for(const r of RW.filter(r=>!r.locked&&!c.R3.includes(r)))r.blocks.push({from:T+30,to:T+510,why:'Summit: negotiating who lands first',desk:'Summit: negotiating who lands first',big:true,sumC:c});
        for(const r of RW)r.blocks.sort((a,b)=>a.from-b.from);for(const f of flights)if(f.state==='approach'&&!f.vip&&f.td>=T+10&&f.td<T+510&&!c.R3.includes(f.rwy))goAround(f,'summit protocol, all runways');
        c.lines.push([T-E+500,'SPG','They have agreed. Alphabetical. As originally planned.']);renderRw();resolve(I,true,'The big three negotiated for 8 minutes, then landed alphabetically.');}}]});
  c.I=I;renderRw();},
tick(c,t){const pl=c.pl;
  // the beats, in order: lower-thirds, voices, banners, shots, music, the SPG
  if(c.beatsPl!==pl){c.beatsPl=pl;c.beats=pl.items.flatMap(it=>it.abs.map(b=>[b[0],b[1],b[2],it])).filter(b=>c.doneT==null||b[0]>c.doneT).sort((a,b)=>a[0]-b[0]);c.bi=0;}
  const beats=c.beats;
  while(c.bi<beats.length&&T>=beats[c.bi][0]){const [at,ty,p,it]=beats[c.bi++];const late=at+10*SUMP;   // a reply queued behind a pilot call still gets heard; later than this it would be out of step with the shot
    if(ty==='say')say(p.src,p.text,{pri:3,gap:150,valid:()=>T<=late});
    else if(ty==='lt')ltSet(Object.assign({fs:c.fs},p));
    else if(ty==='ban'){if(!CINE)vipBanner(true,p[0],p[1],p[2],p[3]);}
    else if(ty==='shot'){const until=it.td+p.until*SUMP;if(p.view){const v=trioView(c.R3);cinema(null,p.ban,{force:true,until,speed:PACE||0.5,view:v,at:[v.tx,v.ty]});}
      else{const f=c.fs[it.ac[p.i].d.k];if(f&&f.state==='approach')cinema(f,p.ban,{force:true,until,speed:PACE||0.5,landed:true});}if(p.lt)ltSet(Object.assign({fs:c.fs},p.lt));}
    else if(ty==='music'){if(p)music(p,{loop:false,vol:0.45});else music(null,{fadeOut:1200});}
    else if(ty==='guard')guard(p.lines,null,{gap:p.gap||1500,valid:()=>T<=at+5*SUMP});
    else if(ty==='radio'){radio(p[0],p[1]);logE(p[1]);}
    else if(ty==='mx'){const f=c.mx,txt=f&&f.landT!=null?MX_LINES[1]:MX_LINES[0];say('AEROMEXICO 92',txt,{pri:3,gap:150,valid:()=>T<=late});ltSet({fs:c.fs,ds:[DL.MX],q:txt});}}
  // the banner of an announcement that never got its shot (or after it) goes when the item's airtime is over
  for(const it of pl.items)if(!it.banOff&&T>=it.A1&&T<it.A1+40){it.banOff=true;if(!CINE&&$('#vipBanner').classList.contains('on'))vipBanner(false);}
  // landings: the counter, and the lower-third's status
  for(const k in c.fs){const f=c.fs[k];if(f.landT!=null&&!c.landed.has(k)){c.landed.add(k);logE(`${DL[k].flag} ${DL[k].country}: ${f.disp} landed on ${f.rwy?f.rwy.short:'?'}.`);}}
  // the summit runs live: a third of normal speed from the first delegation to the last
  const live=T>=c.E&&T<pl.p1;if(live)PACE=SUMP/BASE;else if(PACE===SUMP/BASE)PACE=null;if(c.liveW!==live){c.liveW=live;document.querySelectorAll('.speeds').forEach(s=>s.classList.toggle('live',live));}
  const ch=$('#delegChip');if(ch){const on=T<c.ret.open[2]+40;if(ch.hidden===on)ch.hidden=!on;if(on){const n=c.landed.size,h=`🌍 Delegations landed <b>${n}</b>/${c.total}<small>${live?'<i>●</i> LIVE · THE CLOCK RUNS AT A THIRD OF NORMAL SPEED':n>=c.total?'EVERY DELEGATION IS ON THE GROUND':c.mx&&c.mx.landT==null&&n===c.total-1?'MEXICO IS STILL IN YOUR HOLDING STACK':`${c.total-n} STILL TO LAND`}</small>`;if(ch.innerHTML!==h)ch.innerHTML=h;}}
  c.doneT=T;if(T-(c.ltT||-9)>=1){c.ltT=T;ltRender(false);}
  // the SPG hands the runways back, one at a time, in step with his voice; then his thank-you, then the evening
  if(!c.ret0&&T>=pl.p1+30){c.ret0=true;LT.cur=null;ltRender(false);music(null,{fadeOut:800});
    spgStaged(c.retOrder,{at:pl.p1+30,open:r=>{for(const x of RW)x.blocks=x.blocks.filter(b=>!(b.sumC===c&&x===r));renderRw();},done:()=>{c.fin=T;if(STORY.eve4)startStory('eve4');}});}},
lesson(c,tl){const at=c.E,end=c.ret?c.ret.open[2]:at+2700,w=tl.filter(s=>s.t>=at&&s.t<=end),pk=w.reduce((a,s)=>s.hold>a.hold?s:a,w[0]||{hold:0,t:at}),nd=S.notamDiv||0;
  return{w:45,title:`The Delhi summit took two runways from ${clk(at)} to ${clk(end)}`,text:`The stack peaked at ${pk.hold} around ${clk(pk.t)}.${nd?` ${nd} flight${nd>1?'s':''} ran down to their planned diversion fuel and went to Nagpur's old airport.`:''} With 27R and 27C gone for the whole summit, 27L for its last minutes and every runway stopped for the big three, the runways you keep have to do everything: lean them towards arrivals before the stops (the bank chart shows them), then hand departures back as each stop ends. Landing the big three together saves 6 minutes of runway time; it costs a 12-minute apron gridlock.`};}};

// L4 · the evening after the summit: every held departure wants to go at once, the delegations' support aircraft leave
// empty (the heads of state stay), and then the evening bank winds the day down. The level ends when the departures are away.
const EVE_SUP=[[240,'USAF','C17','REACH 1','US Air Force C-17, empty','Washington','IAD',['FSO','REACH 1 and REACH 2 are going home empty. They will come back for the cars tomorrow.']],
  [300,'USAF','C17','REACH 2','US Air Force C-17, empty','Washington','IAD',null],
  [600,'RSD','A124','RUSSIA CARGO','Antonov An-124, empty','Moscow','VKO',['FSO','Russia Cargo is leaving empty too. The cars are staying. The Antonov is not.']],
  [900,'EK','B77W','EMIRATES 2','Emirates 777, empty','Dubai','DXB',['FSO','Emirates 2 and Saudi 2 are taking their empty holds home. The luggage stays.']],
  [960,'SV','B77W','SAUDI 2','Saudi 777, empty','Riyadh','RUH',null],[1030,'SV','B789','SAUDI 3','Saudi 787, empty','Riyadh','RUH',['FSO','Saudi 3 follows them. Also empty. Also luggage, until today.']],
  [1300,'CCA','A333','AIR CHINA 2','Air China A330 (support)','Beijing','PEK',['FSO','Air China 2 is going to wait in Delhi. The President\'s aircraft stays here.']],
  [700,'6E','A21N','PRESS 1','The press charter','Delhi','DEL',null]];
STORY.eve4={len:4400,start(c){c.sup=EVE_SUP.map(x=>({x,done:false}));
  const q=()=>flights.filter(f=>f.kind==='dep'&&!f.counted&&f.std<=T&&['at_gate','push','start','taxi_out','hp','lineup','stuck'].includes(f.state)).length;
  c.lines=[[120,'TWR','All stations: summit protocol cancelled. Normal operations. Well, normal for today.'],
    [150,cc=>{const n=q();radio('AOCC',`${n} departures want to go now: everything the summit held, and the evening bank behind it. Put runways on DEP.`);logE(`${n} departures queued after the summit.`);}],
    [330,cc=>{flashBanner(['THE FAMILY PHOTO','Every leader, three rows, one step','The step was measured twice. Row three is the European Union 📸',icos('📸')],5500);radio('PROTOCOL','The family photo is being taken on the VIP apron. Row three has been asked to squeeze in. Row three is the European Union.');}],
    [1100,'FSO','The red carpet is being rolled up. All 2.4 kilometres of it. It has been given its own tug.'],
    [1800,'AOCC','The evening bank is the last of the day. Get the departures away and the day is done.'],
    [2400,'SPG','The motorcades have left for Delhi. The airport road is open. Mostly.']];},
tick(c,t){for(const o of c.sup){if(o.done||t<o.x[0])continue;o.done=true;const [dt,al,type,cs2,disp,to,code,line]=o.x;const pk=G.get(PARK);if(!pk)continue;
    // they leave from the VIP apron: engines start there, then they taxi out like everyone else
    const f=mk({kind:'dep',state:'start',al,type,intl:al!=='6E',to,toCode:code,dir:al==='6E'?'N':'W',std:T});Object.assign(f,{num:'1',callsign:cs2,disp,origStd:T,readyAt:T,x:pk.x,y:pk.y,heading:0,gateRef:{lane:PARK},startT:T-20,pushT:T,supDep:true});
    if(cs2==='PRESS 1')c.press=f;if(line){radio(line[0],line[1]);logE(line[1]);}}
  if(c.press&&c.press.counted&&!c.pressSaid){c.pressSaid=true;flashBanner(['THE PRESS PLANE','The press pool\'s A321 is airborne','Filing the story from the climb 📰',icos('📰')],4500);radio('TWR','Press 1, airborne. They are filing the story from the climb.');}
  if(t>240&&!c.clear&&!flights.some(f=>f.state==='holding')){c.clear=true;flashBanner(['THE STACK IS EMPTY · FIRST TIME SINCE THE SUMMIT','Nobody is holding','The second-largest gathering in Nagpur has dispersed 🛬',icos('✅')],5000);logE('The holding stack cleared after the summit.');}}};

// L3 · fog, a blocked taxiway, and the chain that leads to a runway collision. This one is played straight: no jokes once
// the risk is live. Inspired by the 1977 Tenerife disaster; the two aircraft are fictional operators (a freighter and an
// empty ferry flight). It can only happen if the player backtracks departures on an active runway in fog, a clearance gets
// garbled, and the player then misses the STOP. Every link is a choice.
(function(){const st=document.createElement('style');st.textContent=`#stopBtn{position:absolute;left:calc(50% - var(--rail)/2);bottom:205px;transform:translateX(-50%);z-index:15;display:flex;flex-direction:column;align-items:center;gap:6px;
  background:#c4001a;color:#fff;font-family:var(--f-sign);font-weight:800;font-size:28px;letter-spacing:.04em;padding:14px 30px 12px;border-radius:12px;border:3px solid #fff;box-shadow:0 0 0 6px rgba(196,0,26,.35),0 18px 50px rgba(0,0,0,.6);cursor:pointer;animation:stopb .5s ease-in-out infinite}
#stopBtn[hidden]{display:none}#stopBtn small{font-family:var(--f-mono);font-weight:500;font-size:12px;letter-spacing:.06em;opacity:.9}#stopBtn i{display:block;height:5px;background:#fff;border-radius:3px;width:100%}
#stopBtn.late{background:#5a5a5a;animation:none;cursor:default}@keyframes stopb{50%{box-shadow:0 0 0 14px rgba(196,0,26,.15),0 18px 50px rgba(0,0,0,.6)}}
#fogTag{position:absolute;left:16px;top:200px;z-index:12;padding:6px 12px;border-radius:8px;background:rgba(10,13,16,.9);border:1px solid #c9d3da;font-family:var(--f-sign);font-weight:700;font-size:16px;color:#e8eef2}#fogTag[hidden]{display:none}`;document.head.appendChild(st);
  const b=document.createElement('button');b.id='stopBtn';b.hidden=true;b.setAttribute('aria-live','assertive');$('#app').appendChild(b);
  const t=document.createElement('div');t.id='fogTag';t.hidden=true;$('#app').appendChild(t);})();
let fogF=0;
WHO.met={badge:'MET OFFICE · NAGPUR',svg:face('🌫️','#2a3440')};
// the fog and the collision belong to the people who would really be talking: the met officer, the tower supervisor and the
// airport's fire chief (never the SPG: anything of his still queued is dropped when the fog rolls in)
WHO.sup={badge:'TOWER SUPERVISOR · ZERO MILE',svg:face('🎧','#123a22')};WHO.arff={badge:'FIRE CHIEF · AIRPORT RESCUE & FIREFIGHTING',svg:face('🚒','#4a1010')};
STORY.fog={len:1700,start(c){const r=LONGEST;if(r.locked)return false;c.r=r;
  vqCut(2);music(null,{fadeOut:1500});{const wc=$('#wedChip');if(wc)wc.hidden=true;}
  voiced(['Sir, fog. In the afternoon. At 46 degrees.','We are as surprised as you are. 🌫️'],WHO.met);
  flashBanner(['FOG · RVR 350 m','A freak fog bank rolls in off Gorewada lake after the storm','Low visibility procedures: wider spacing on every runway',icos('🌫️')],5500);
  c.lines.push([0,()=>say('ATC','Low visibility procedures in force. Runway visual range 350 metres. Increased spacing on all runways.')]);
  const I=storyCard(c,{icon:{g:'🌫️',c:'#c9d3da'},x:r.x1-200,y:r.y,title:`Fog, and the taxiway to ${r.short} is blocked`,
    text:`A broken-down tug is blocking the taxiway to ${r.short}'s threshold for the next 12 minutes, in fog. Departures could still use ${r.short} by backtracking: entering midway, taxiing down the runway itself and turning around at the end. In this visibility the tower cannot see the runway, and backtracking on an active runway in fog is how runway collisions happen. Or stop departures on ${r.short} until the taxiway clears: it is the long runway, so heavy jets in this heat will wait or offload.`,
    // on purpose the bright button here is the dangerous one (press it blindly and the chain can end in a collision); the
    // bots and the timeout default take the safe one, so balance is unchanged
    def:1,botPick:1,defText:`departures on ${r.short} stop until the taxiway clears.`,
    acts:[{l:`Backtrack on ${r.short}`,pri:1,fn(){r.btUntil=T+720;c.bt=true;c.scenAt=T+200;renderRw();resolve(I,true,`${r.short} departures backtracking on the runway in fog.`);
        voiced(['Backtracking in this? I cannot see the runway from the cab.','Every read-back in full. Nobody rushes.'],WHO.sup);}},
      {l:`No backtracking: stop ${r.short} departures`,fn(){r.noDepUntil=T+720;renderRw();resolve(I,true,`${r.short} departures stopped while its taxiway was blocked in fog.`);}}]});
  c.lines.push([720,'OPS',`The tug is clear. ${r.short}'s taxiway is open again.`]);
  c.lines.push([LV.fog[1]-T,cc=>{if(cc.out==='crash'){say('ATC','The fog has lifted. Normal spacing on the open runways.');return;}
    say('ATC','The fog has lifted. Normal visibility, normal spacing.');voiced(['The fog has lifted.','Fifteen minutes of fog at 46 degrees. We are writing a paper.'],WHO.met);}]);},
tick(c,t){const r=c.r;if(c.bt&&!c.sc&&T>=c.scenAt&&!r.occ&&T<r.btUntil-60)this.begin(c);if(c.sc)this.run(c);},
begin(c){const r=c.r,side=procC.y>r.y?1:-1;
  const B=mk({kind:'dep',state:'xhold',al:'OCA',type:'B77W',intl:false,to:'Mumbai',toCode:'BOM',dir:'W',std:T});Object.assign(B,{num:'1801',disp:'Orange City Cargo 1801 (777F)',callsign:'ORANGE CITY 1801',x:r.x1-60,y:r.y,heading:Math.PI,v:0,rwy:r,origStd:T,readyAt:T,cargo:true});
  const A=mk({kind:'dep',state:'xbt',al:'SPC',type:'B748',intl:false,to:'Kolkata',toCode:'CCU',dir:'E',std:T+900});Object.assign(A,{num:'77',disp:'Satpura Cargo 77 (747-8F)',callsign:'SATPURA 77',x:r.x1-1500,y:r.y,heading:0,v:8,rwy:r,origStd:T+900,readyAt:T,cargo:true});
  // backtracking in fog is the first link, and the player chose it: the garbled clearance that follows is certain (the
  // chain still needs the player to miss the STOP). The draw stays, so the random stream is the same as before.
  SIMR();r.occ=B;const sc=c.sc={A,B,t0:T,t:0,go:true,side,turn:0,phase:'bt',wait:1};
  // voice first: the scene's clock (and the freighter) waits while its radio calls are heard, and the sim is held to 0.25x
  say('TWR',`Satpura 77, backtrack runway ${r.short}, vacate at the next exit, report runway vacated.`,{pri:3,hold:0.25,onEnd:()=>{sc.wait=0;}});logE(`Satpura 77 backtracking on ${r.short} in fog.`);},
run(c){const s=c.sc,{A,B}=s,r=c.r,dt0=Math.min(1,T-(s.last||T));s.last=T;const dt=!s.rolled&&s.wait&&!FFING?0:dt0;s.t+=dt;const t=s.t;
  // the freighter backtracks east towards the threshold, then turns off towards the taxiway on the terminal side
  if(A.state==='xbt'){if(A.x<r.x1-1200&&!s.turn)A.x+=8*dt;else{s.turn=Math.min(1,s.turn+dt/16);A.heading=s.side*s.turn*Math.PI/2;A.x+=8*dt*Math.cos(A.heading);A.y+=8*dt*Math.sin(A.heading);
      if(Math.abs(A.y-r.y)>70){A.state='wedtaxi';const p=route(nearestNode(A.x,A.y).k,PARK);if(p)setPath(A,[{x:A.x,y:A.y}].concat(p),TAXI_R);else A.state='towed';
        if(B.state==='xhold'){radio('TWR',`Satpura 77 has vacated. Orange City 1801, runway ${r.short}, cleared for take-off.`);B.state='lineup';B.rollT=T;setPath(B,[{x:B.x,y:B.y},{x:B.x-1,y:B.y}],50);}
        if(s.phase==='bt'){s.phase='done';r.occ=B;}}}}
  if(t>=10&&!s.lu&&(!s.wait||FFING)){s.lu=1;s.wait=1;say('TWR',`Orange City 1801, line up and wait, runway ${r.short}.`,{pri:3,hold:0.25,onEnd:()=>{s.wait=0;}});}
  if(s.go&&!s.rolled&&t>=16&&s.lu&&(!s.wait||FFING)){s.rolled=1;B.state='xroll';B.v=8;B.s=60;B.rollT=T;s.rollT=T;
    // (the tower's garbled reply follows the call at once; the Satpura crew's cry comes after it, as at Tenerife)
    let ok1=false;const l2=()=>{s.l2=1;say('TWR','OK… [squeal] …stand by for take-off, I will call you.',{pri:3});};ok1=say('ORANGE CITY 1801','…we are now at take-off.',{pri:3,gap:150,onEnd:()=>{if(ok1)l2();}});if(!ok1)setTimeout(l2,900);
    s.prevSpeed=speed;stopUI(c,true);
    cinema(null,['RUNWAY INCURSION · '+r.short,'Orange City 1801 is rolling. Satpura 77 is still on the runway.','STOP IT',''],{view:{tx:r.x1-700,ty:r.y,dist:1150,pitch:0.17,yaw:Math.PI/2},at:[r.x1-700,r.y],ms:60000,speed:0.15,force:true});s.stopMs=performance.now()+3000;}
  if(B.state==='xroll'){if(speed!==0.15){speed=0.15;}const px=B.x;B.v=Math.min(95,B.v+(B.rto?-5:2.0)*dt);B.s+=B.v*dt;B.x=r.x1-B.s;if(T-s.rollT>3&&s.l2&&!s.cry){s.cry=1;say('SATPURA 77','We are still on the runway! Satpura 77 still on the runway!',{pri:3});}
    stopUI(c,true);
    if(B.rto&&B.v<=0.5){B.v=0;s.stopped=1;this.end(c,'near');}
    else if(px>A.x+20&&B.x<=A.x+20){if(A.state==='xbt'&&Math.abs(A.y-r.y)<70)this.end(c,'crash');else{B.state='roll';r.occ=B;this.end(c,'clear');}}}},
stop(c){const s=c.sc;if(!s||s.B.state!=='xroll'||s.B.rto||performance.now()>s.stopMs)return;s.B.rto=true;voiceReset(true);say('TWR','ORANGE CITY 1801, STOP IMMEDIATELY! I say again, STOP IMMEDIATELY!',{pri:3});logE('You cancelled Orange City 1801\'s take-off roll.');stopUI(c,true);},
end(c,how){const s=c.sc,{A,B}=s,r=c.r;stopUI(c,false);c.out=how;
  if(CINE&&CINE.o&&CINE.o.ms===60000)CINE.t0=performance.now()-CINE.o.ms+(how==='crash'?9000:3500);
  if(how==='near'){hitSafety(12,`Near collision on ${r.short} in fog: Orange City 1801 rolled without a clearance with Satpura 77 still on the runway. You stopped it.`);
    B.state='taxi_out';B.rto=false;r.occ=null;assignDep(B,true);closeRw(r,900,'Runway incursion investigation');say('TWR',`Orange City 1801 stopped. Runway ${r.short} closed for the investigation.`,{pri:2});
    flashBanner(['NEAR MISS · '+r.short,'Orange City 1801 stopped about 400 m short of Satpura 77','You broke the chain',''],5000);
    setTimeout(()=>{if(STO.includes(c))voiced(['Orange City has stopped. Four hundred metres short.','Nobody moves on that runway until I can see it.'],WHO.sup);},2500);}
  else if(how==='crash'){A.state='wreck';B.state='wreck';A.v=0;B.v=0;r.occ=null;r.closedUntil=1e9;r.why='Accident site';S.crash={t:T,r:r.short};
    voiceReset();music('collision',{loop:false,vol:0.9,fadeIn:60});
    for(const f of flights)if(f.rwy===r&&['taxi_out','hp'].includes(f.state))assignDep(f,true); // nobody waits for a runway that will not reopen
    hitSafety(100,`Runway collision on ${r.short} in fog: Orange City 1801 took off without a clearance into Satpura 77, which was backtracking on the runway.`);
    FXV.push({kind:'crash',id:'crash',x:(A.x+B.x)/2,y:(A.y+B.y)/2,t0:T,t1:T+1e6,a:A.heading,b:B.heading});MARKS.push({x:(A.x+B.x)/2,y:r.y,e:'🔥',until:T+1e6,px:34,k:'crash'});
    const others=RW.filter(o=>!o.locked&&o!==r);takeRunways(others,T,600,0,'Accident: all runways closed','Accident: all runways closed');
    for(const f of flights)if(f.state==='approach'&&f.rwy===r)goAround(f,'runway accident');
    vipBanner(true,'RUNWAY COLLISION · '+r.short,'Two aircraft have collided in fog','Emergency services are responding. All runways closed.','');setTimeout(()=>{if(!CINE)vipBanner(false);},9000);
    const allst=`ALL STATIONS, ALL STATIONS: aircraft accident on runway ${r.short}. All runways closed. Fire services responding.`;radio('ATC',allst);setTimeout(()=>{if(STO.includes(c))say('ATC',allst,{pri:3});},4200);
    c.lines.push([T-c.E+40,()=>{radio('FIRE',`Crash tenders on scene on ${r.short}. Foam going on now.`);voiced(['Crash tenders on scene. Foam going on now.','Both crews are out. The medics have them.'],WHO.arff);}]);
    c.lines.push([T-c.E+120,()=>{say('ATC','Arrivals: hold. Divert if your fuel requires.');voiced([`${r.short} is closed for the rest of the day.`,'We will run on the other four. Arrivals first.'],WHO.sup);}]);
    c.lines.push([T-c.E+600,()=>say('ATC',`Runways other than ${r.short} reopening. ${r.short} is closed for the rest of the day.`)]);}
  else{say('TWR','Orange City 1801 airborne. That was too close.');}},
lesson(c){if(c.out==='crash')return{w:200,title:`A runway collision on ${c.r.short}`,text:'This is how it happened, one link at a time: fog; a blocked taxiway; backtracking departures on an active runway in that fog; a garbled clearance ("…we are now at take-off"); and no stop while there was still time. Each link was a choice. In low visibility, never run backtracks on an active runway: take the capacity hit instead. And when the incursion alarm sounds, stop the roll at once.'};
  if(c.out==='near')return{w:60,title:'A near collision in fog, and you stopped it',text:'Backtracking on an active runway in fog let a garbled clearance put two aircraft on the same runway. You stopped the roll in time. Next time break the chain earlier: in low visibility, stop departures on that runway instead of backtracking.'};
  return null;}};
function stopUI(c,on){const b=$('#stopBtn');if(!b)return;if(!on){b.hidden=true;return;}const s=c.sc,B=s.B,late=performance.now()>(s.stopMs||0),k=clamp(((s.stopMs||0)-performance.now())/3000,0,1);
  if(!b.onclick)b.onclick=()=>{const cc=STO.find(o=>o.k==='fog');if(cc)STORY.fog.stop(cc);};
  b.classList.toggle('late',late||!!B.rto);b.hidden=false;
  b.innerHTML=B.rto?'STOPPING…<small>Orange City 1801 rejecting take-off</small>':late?'COMMITTED<small>too late to stop</small>':`STOP! CANCEL TAKE-OFF<small>ORANGE CITY 1801 · SPACE</small><i style="width:${Math.round(k*100)}%"></i>`;}
// test hooks for the Level 3 set pieces (headless probes)
window.L3T={clearCine:()=>{CINE=null;cinema.q.length=0;vipBanner(false);},vreset:()=>voiceReset(),sum:()=>SUM,mus:()=>MUS.name,cine:()=>CINE&&{ban:CINE.ban[0],f:CINE.f&&CINE.f.disp},sto:()=>STO.map(c=>c.k),vq:()=>VQ.length+(vqOn?1:0),spd:()=>speed};
// L3 · the last stretch: after a collision, the recovery (played straight); otherwise a lighter evening; then the wind-down
STORY.evening={len:2000,start(c){const cr=S.crash,w=(S.storyRec||[]).find(o=>o.k==='wedding');
  if(cr){c.lines.push([0,()=>{radio('FIRE',`The fire on ${cr.r} is out. The foam blanket is holding.`);voiced(['The fire is out.','The foam stays down until the investigators have seen it.'],WHO.arff);}]);
    c.lines.push([450,()=>say('AOCC',`Investigators from the Aircraft Accident Investigation Bureau are on site at ${cr.r}. It stays closed for the rest of the day.`)]);}
  else{c.lines.push([0,()=>say('AOCC','Lost property from the summit: one fur hat, size large. At 46 degrees. It is being kept in the cold room.')]);
    if(w&&w.jets&&w.jets.length)c.lines.push([400,()=>say('PLANNER','The Chambanis thank the tower. The reception is tomorrow. Sixty jets.')]);}
  c.lines.push([Math.max(600,(LV.taper?LV.taper.arr[0]:LEN-1500)-T+200),()=>say('AOCC',`The evening shift takes over at ${clk(LEN)}. The last arrivals are on the bank chart: land them, clear the departure queue, and hand over.`)]);}};
document.addEventListener('keydown',e=>{if(e.code==='Space'){const b=$('#stopBtn');if(b&&!b.hidden){e.preventDefault();e.stopImmediatePropagation();if(!b.classList.contains('late'))b.click();}}},true);

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
  if(f.vip&&(f.state==='parked'||f.state==='dock'))return 'VVIP: on the red carpet';if(f.state==='wedtaxi')return f.parkText||'To the wedding apron (follow the marigolds)';
  if(f.charter&&f.state==='at_gate')return 'Fan charter: leaves after the Jamtha match';
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
  drawMarks(ctx,(x,y)=>({X:sx(x),Y:sy(y)}),now);drawFx2D();
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
  if(fogF>0){ctx.fillStyle=`rgba(226,231,235,${(0.34*fogF).toFixed(3)})`;ctx.fillRect(0,0,VW,VH);}
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
  for(const I of incidents){const p=incPos(I);incMark(ctx,I,sx(p.x),sy(p.y),now);}
  // tags
  const tagged=new Set();if(selected)tagged.add(selected);if(hover)tagged.add(hover);
  if(z>3.2){let n=0;for(const f of vis){if(n>30)break;if(['approach','rollout','taxi_in','taxi_out','hp','lineup','roll','nogate'].includes(f.state)&&f.sx>0&&f.sx<VW&&f.sy>0&&f.sy<VH){tagged.add(f);n++;}}}
  for(const f of tagged)if(vis.includes(f))drawTag(f);
  if(popInc&&popInc.sx!=null)placePop(popInc.sx,popInc.sy);
  drawFloats(q=>({X:sx(q.x),Y:sy(q.y)}));
}

/* ============ bank chart ============ */
function capNow(kind,ov,at){const tt=at==null?T:at;let c=0;for(const r of RW){const md=ov&&ov.r===r?ov.m:r.mode;if(r.locked||tt<r.closedUntil||blockAt(r,tt)||(kind==='arr'&&tt<r.noArrUntil)||(kind==='dep'&&tt<r.noDepUntil))continue;const dg=(r.degraded?1.6:1)*(tt<r.sepUntil?r.sepK:1);if(kind==='arr'){if(md==='ARR')c+=3600/(SEP_AA*sepF()*dg+6);else if(md==='MIX')c+=3600/(SEP_AA*sepF()*dg+MIX_GAP+6)*1;}else{if(md==='DEP')c+=3600/(SEP_DD*(dustNow?1.15:1)+4);else if(md==='MIX')c+=3600/(SEP_AA*sepF()+MIX_GAP+6);}}return c;}
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
    else if(f.kind==='dep'&&!['gone','cancelled','roll','lineup'].includes(f.state)){const t=Math.max(f.std,f.held&&f.holdUntil?f.holdUntil:0,T);const i=Math.floor((t-t0)/B);if(i>=0&&i<nb)D[i]++;}
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
    let s='';const bk=r.blocks[0];if(T<r.closedUntil)s=r.closedUntil-T>43200?`<span class="bad">closed · ${r.why.toLowerCase()}</span>`:`<span class="bad">closed ${Math.ceil((r.closedUntil-T)/60)} min · ${r.why}</span>`;else if(bk&&T>=bk.from)s=`<span class="bad">${bk.summit?'Taken by security':(bk.desk||'VVIP closure')}${bk.open?'':' · '+mmss(bk.to-T)}</span>`;else if(T<r.changeUntil)s=`<span class="hot">changeover ${Math.ceil((r.changeUntil-T)/60)} min</span>`;else s=`<b>${fin}</b> on final · <b class="${q>6?'hot':''}">${q}</b> queued · ${r.ops} ops`;
    const tags=[];if(bk&&T<bk.from)tags.push(`<span class="bad">VVIP in ${mmss(bk.from-T)}</span>`);if(r.degraded)tags.push('<span class="hot">lights out: slower landings</span>');if(T<r.sepUntil)tags.push(`<span class="hot">${r.sepWhy||'double spacing'}</span>`);if(T<r.noArrUntil)tags.push('<span class="hot">GPS spoofed: no landings</span>');if(T<r.noDepUntil)tags.push('<span class="hot">no departures: taxiway blocked</span>');if(T<r.btUntil)tags.push('<span class="bad">backtracking in fog</span>');if(r.gpsUntil>T)tags.push('<span class="hot">GPS spoofed: false PULL UPs</span>');if(r.kiteUntil>T&&T>=r.kiteFrom)tags.push('<span class="hot">🪁 NOW</span>');else if(r.kiteFrom>T&&r.kiteFrom-T<=180)tags.push(`<span class="hot">🪁 in ${mmss(r.kiteFrom-T)}</span>`);if(r.strike)tags.push('<span class="hot">bird remains: risk</span>');if(ops.some(o=>o.kind==='fod'&&o.r===r&&o.phase==='wait'))tags.push('<span class="hot">sweep pending</span>');if(r.shear)tags.push('<span class="hot">windshear</span>');st.innerHTML=s+(tags.length?' · '+tags.join(' · '):'');});
}

/* ============ HUD ============ */
// near the end of a windDown level: how many departures still have to get away before the day is done
(function(){const st=document.createElement('style');st.textContent=`#windChip{position:absolute;left:16px;top:168px;z-index:12;padding:7px 13px;border-radius:8px;background:rgba(10,13,16,.92);border:1px solid #2fd3c6;font-family:var(--f-sign);font-weight:700;font-size:18px;letter-spacing:.03em;color:#fff;box-shadow:0 8px 20px rgba(0,0,0,.45)}
#windChip[hidden]{display:none}#windChip b{color:#2fd3c6;font-size:21px}#windChip small{display:block;font-family:var(--f-mono);font-weight:500;font-size:10.5px;color:#9fb3c8;letter-spacing:.06em}`;document.head.appendChild(st);
  const d=document.createElement('div');d.id='windChip';d.hidden=true;d.setAttribute('aria-live','polite');$('#app').appendChild(d);})();
function windChip(){const d=$('#windChip');if(!d)return;const on=!!(LV&&LV.windDown&&!ended&&T>=LEN-900);if(d.hidden===on)d.hidden=!on;if(!on)return;const n=depLeft();
  const h=`🛫 Last departures: <b>${n}</b> to go<small>${T<LEN?`THE EVENING BANK · ${Math.ceil((LEN-T)/60)} MIN OF SCHEDULE LEFT`:`THE DAY ENDS WHEN THEY ARE AWAY · AT ${clk(LEN+WIND)} AT THE LATEST`}</small>`;if(d.innerHTML!==h)d.innerHTML=h;}
function kpi(id,txt,cls){const el=$(id);el.querySelector('.v').innerHTML=txt;el.className='kpi '+(cls||'');}
const RATE={v:0};
function hud(){
  $('#clock').textContent=clk(T);$('#left').textContent=ended?'Level over':LV.windDown&&T>=LEN?`${depLeft()} to go`:`${Math.max(0,Math.ceil((LEN-T)/60))} min left`;windChip();
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
  fogF=LV.fog?clamp(Math.min((T-LV.fog[0])/120,(LV.fog[1]-T)/120),0,1):0;{const ft=$('#fogTag');if(ft){const on=fogF>0.05;if(on!==!ft.hidden){ft.hidden=!on;ft.textContent='🌫️ FOG · RVR 350 m · LOW VISIBILITY PROCEDURES';}}}
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
  if(!ended&&endDue())finish();
}
// the level ends at LEN; a level with windDown:true runs on (at most 30 minutes, LEN+WIND) until every departure there is
// is airborne (on the bank chart, at a gate or on its way out, whenever it was due: the chip counts the same) and every
// arrival in the air is down. Arrivals not yet airborne at LEN are cancelled (the day is over). No departure can be
// impossible: toDep cancels an onward flight that could not be ready in time.
const WIND=1800,DEP_LEFT=new Set(['sched','at_gate','push','start','taxi_out','hp','lineup','stuck','roll','xhold','xroll']);
const depLeft=()=>{let n=0;for(const f of flights)if(f.kind==='dep'&&!f.counted&&DEP_LEFT.has(f.state))n++;return n;};
const arrLeft=()=>flights.filter(f=>f.kind==='arr'&&['inbound','holding','approach','goaround','rollout'].includes(f.state)).length;
function endDue(){if(T<LEN)return false;if(!LV.windDown||T>=LEN+WIND)return true;
  if(!endDue.cut){endDue.cut=true;for(const f of flights)if(f.kind==='arr'&&f.state==='sched'&&!f.vip){f.state='cancelled';if(f.gate){f.gate.occ=null;f.gate=null;}if(f.res){f.res.res=null;f.res=null;}}}
  return depLeft()===0&&arrLeft()===0;}
const onceSet=new Set();function once(k,fn){if(onceSet.has(k))return;onceSet.add(k);fn();}

/* ============ input ============ */
let drag=null;
cv.addEventListener('contextmenu',e=>{if(V3.on)e.preventDefault();});
cv.addEventListener('dblclick',e=>{if(!V3.on)return;const r=cv.getBoundingClientRect();const f=pick(e.clientX-r.left,e.clientY-r.top);if(f){closePop();setCam('follow',f);}});
cv.addEventListener('pointerdown',e=>{if(V3.on){drag={x:e.clientX,y:e.clientY,lx:e.clientX,ly:e.clientY,moved:false,orbit:e.button===2||e.shiftKey||e.altKey};cv.setPointerCapture(e.pointerId);return;}camT.x=cam.x;camT.y=cam.y;camT.s=cam.s;camT.anchor=null;drag={x:e.clientX,y:e.clientY,cx:cam.x,cy:cam.y,moved:false};cv.setPointerCapture(e.pointerId);});
cv.addEventListener('pointermove',e=>{const r=cv.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;if(drag&&V3.on){if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>4){drag.moved=true;cv.classList.add('drag');}if(drag.moved)cam3Drag(e.clientX-drag.lx,e.clientY-drag.ly,drag.orbit);drag.lx=e.clientX;drag.ly=e.clientY;}else if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4){drag.moved=true;cv.classList.add('drag');}if(drag.moved){camT.x=drag.cx-dx/camT.s;camT.y=drag.cy-dy/camT.s;clampCam(camT);cam.x=camT.x;cam.y=camT.y;}}else{hover=pick(mx,my);cv.classList.toggle('point',!!(hover||pickInc(mx,my)||pickRw(mx,my)));}});
cv.addEventListener('pointerup',e=>{const r=cv.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;if(drag&&!drag.moved&&running){const I=pickInc(mx,my);if(I)openIncPop(I);else{const f=pick(mx,my);if(f)openFlightPop(f,mx,my);else{const rw=pickRw(mx,my);if(rw)openRwPop(rw,mx,my);else{closePop();selected=null;}}}}drag=null;cv.classList.remove('drag');});
cv.addEventListener('wheel',e=>{e.preventDefault();const r=cv.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;const line=e.deltaMode===1;const mw=line||(e.deltaX===0&&Math.abs(e.deltaY)>=40&&Math.abs(e.deltaY)%1===0);if(V3.on){if(e.ctrlKey||e.metaKey)cam3Zoom(Math.exp(e.deltaY*0.012),mx,my);else if(mw)cam3Zoom(Math.exp((line?e.deltaY*33:e.deltaY)*0.0016),mx,my);else cam3Drag(-e.deltaX,-e.deltaY,false);return;}if(e.ctrlKey||e.metaKey)zoomAt(mx,my,Math.exp(-e.deltaY*0.012));else if(mw)zoomAt(mx,my,Math.exp(-(line?e.deltaY*33:e.deltaY)*0.0016));else{camT.anchor=null;camT.x+=e.deltaX/camT.s;camT.y+=e.deltaY/camT.s;clampCam(camT);}},{passive:false});
$('#zIn').onclick=()=>V3.on?cam3Zoom(1/1.6):zoomCenter(1.6);$('#zOut').onclick=()=>V3.on?cam3Zoom(1.6):zoomCenter(1/1.6);$('#zFit').onclick=()=>V3.on?cam3Fit():fitCam();
function pick(mx,my){let best=null,bd=1e9;for(const f of flights){if(f.sx==null||['sched','diverted','gone','cancelled','towed'].includes(f.state))continue;const d=Math.hypot(f.sx-mx,f.sy-my);const lim=Math.max(9,f.sr||0);if(d<lim&&d<bd){bd=d;best=f;}}return best;}
function pickInc(mx,my){for(const I of incidents)if(I.sx!=null&&Math.hypot(I.sx-mx,I.sy-my)<20)return I;return null;}
function pickRw(mx,my){for(const s of rwSigns)if(mx>=s.x&&mx<=s.x+s.w&&my>=s.y-3&&my<=s.y+s.h+3)return s.r;let wx=mx/cam.s+cam.x,wy=my/cam.s+cam.y,tol=10/cam.s;if(V3.on){const g=groundAt(mx,my);if(!g)return null;wx=g.x;wy=g.y;tol=45;}for(const r of RW){if(wx>=r.x0&&wx<=r.x1&&Math.abs(wy-r.y)<Math.max(r.width/2+10,tol))return r;}return null;}
// while a set piece runs live (PACE) the speed buttons only take effect afterwards; say so instead of silently ignoring them
const liveNote=s=>{if(PACE!=null&&s>0)radio('AOCC',`The summit runs live: the clock stays at about a third of normal speed until ${SUM?'the SPG hands the runways back':'the last delegation lands'}, then goes to ${s}×.`);};
document.querySelectorAll('.speeds button').forEach(b=>b.onclick=()=>{liveNote(+b.dataset.s);setSpeed(+b.dataset.s);});
(function(){const b=$('#snd');const paint=()=>{b.textContent=SND.on?'Sound on':'Sound off';b.classList.toggle('on',SND.on);};paint();b.onclick=()=>{SND.on=!SND.on;store.set('zm_snd',SND.on);paint();if(SND.on)tickSound(true);else voiceReset();};})();
// keep: restore a speed without un-pausing (a cinematic ending while the player has paused must not resume the game)
function setSpeed(s,keep){if(!running)return;if(s===0)paused=!paused;else{speed=s;if(!keep)paused=false;}document.querySelectorAll('.speeds button').forEach(b=>{const v=+b.dataset.s;b.classList.toggle('on',v===0?paused:(!paused&&v===speed));});$('#spP').textContent=paused?'Resume':'Pause';}
window.addEventListener('keydown',e=>{if(e.key===' '&&!(e.target.closest&&e.target.closest('button'))){e.preventDefault();setSpeed(0);}if(e.key==='1'){liveNote(1);setSpeed(1);}if(e.key==='2'){liveNote(2);setSpeed(2);}if(e.key==='3'){liveNote(4);setSpeed(4);}if(e.key==='Escape'){closePop();if(V3.on&&V3.mode!=='map')setCam('map');}if(e.key==='+'||e.key==='=')zoomCenter(1.6);if(e.key==='-')zoomCenter(1/1.6);if(e.key==='f')V3.on?cam3Fit():fitCam();if(e.key==='m'||e.key==='M')setView(V3.on?'2d':'3d');if(e.key==='c'||e.key==='C')cycleCam();if(V3.on&&(e.key==='q'||e.key==='Q'))C3.t.yaw+=0.25;if(V3.on&&(e.key==='e'||e.key==='E'))C3.t.yaw-=0.25;});

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
const EXPERT={1:{st:3,moves:128,otp:88,cx:94},2:{st:3,moves:240,otp:93,cx:93},3:{st:3,moves:480,otp:72,cx:95},4:{st:3,moves:751,otp:77,cx:94}};
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
  if(S.summitAt!=null){const at=S.summitAt,bk=S.summitBack||at+540,w=tl.filter(s=>s.t>=at&&s.t<=bk+1200),pk2=w.reduce((a,s)=>s.hold>a.hold?s:a,w[0]||{hold:0,t:at}),back=S.flipLog.filter(f=>f.t>=bk-300&&f.t<=bk+600&&(f.to==='ARR'||f.to==='MIX')).length;
    out.push({w:45,title:`The summit shut every runway at ${clk(at)}`,text:`The stack reached ${pk2.hold} by ${clk(pk2.t)}. You can't stop protocol, but you can recover faster: during the closure, line departures up at the holding points; as runways come back, put most of them on ARR first to drain the stack, then hand some back to departures.${back?'':' You made no ARR flips as the runways came back.'}`});}
  for(const c of S.storyRec||[]){const d=STORY[c.k];const l=d&&d.lesson&&d.lesson(c,tl);if(l)out.push(l);}
  if(otp<87&&!out.length)out.push({w:10,title:`On time ${otp}%`,text:'Watch the forecast lines on the bank chart: red is the stack, amber the departure queue. When either starts to climb, flip a runway before it peaks.'});
  out.sort((a,b)=>b.w-a.w);
  // a compact chart of the shift: stack (red), departure queue (amber), arrivals due (purple) and the flips
  const W=960,H=150,mx=Math.max(10,...tl.map(s=>Math.max(s.hold,s.q,s.aDue))),LE=Math.max(LEN,T),X=t=>16+t/LE*(W-32),Y=v=>H-26-v/mx*(H-46);
  const line=(k,c)=>`<polyline fill="none" stroke="${c}" stroke-width="2.2" points="${tl.map(s=>`${X(s.t).toFixed(1)},${Y(s[k]).toFixed(1)}`).join(' ')}"/>`;
  const area=`<polygon fill="rgba(138,124,255,.18)" points="${X(tl[0].t)},${Y(0)} ${tl.map(s=>`${X(s.t).toFixed(1)},${Y(s.aDue).toFixed(1)}`).join(' ')} ${X(tl[tl.length-1].t)},${Y(0)}"/>`;
  const flips=S.flipLog.filter(f=>f.t>=0).map(f=>`<g><line x1="${X(f.t)}" x2="${X(f.t)}" y1="${H-24}" y2="${H-14}" stroke="${f.to==='ARR'?'#8a7cff':f.to==='DEP'?'#2fd3c6':f.to==='MIX'?'#f4c430':'#a6afb4'}" stroke-width="2"/></g>`).join('');
  const ticks=Array.from({length:Math.floor(LE/900)+1},(_,k)=>k*900).map(t=>`<text x="${X(t)}" y="${H-2}" fill="#6f7a80" font-size="10" font-family="JetBrains Mono, monospace" text-anchor="middle">${clk(t)}</text>`).join('');
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
  // the day is over: nothing may speak, play music or cut away behind the score sheet (late timers find ended set)
  voiceReset();CINE=null;if(cinema.q)cinema.q.length=0;if(SUM){SUM.cine=null;SUM.ann=null;}PACE=null;vipBanner(false);{const sb=$('#stopBtn');if(sb)sb.hidden=true;}
  const left=flights.filter(f=>f.kind==='dep'&&['at_gate','taxi_out','hp','push','start','stuck'].includes(f.state)&&T>f.std+1500).length;
  for(const f of flights)if(f.links&&f.kind==='dep'&&f.state==='at_gate'&&T>f.std){for(const l of f.links){if(l.arr.inBlock!=null&&l.arr.inBlock+l.x<=T)S.cnxMade+=l.n;else S.cnxMiss+=l.n;}}
  const st=stars(LV,S);const best=store.get('zm_stars')||{};if((best[LV.n]||0)<st){best[LV.n]=st;store.set('zm_stars',best);}
  const otp=S.dep+S.arr?Math.round((S.depOnTime+S.arrOnTime)/(S.dep+S.arr)*100):0,otpA=S.arr?Math.round(S.arrOnTime/S.arr*100):0,otpD=S.dep?Math.round(S.depOnTime/S.dep*100):0,ct=S.cnxMade+S.cnxMiss,cx=ct?Math.round(S.cnxMade/ct*100):100;
  const verdict=st===3?'Flawless. The hub never noticed it was under pressure.':st===2?'Good shift. The waves came through and the hub kept its promises.':st===1?'The hub survived, but passengers will remember this one.':'Safety fell below 70. A real hub would stop operations and investigate.';
  const why=[];if(S.moves<LV.target)why.push(`Movements ${S.moves} of ${LV.target}: runways sat idle or were set for the wrong wave.`);if(otp<85)why.push(`On time ${otp}% (arrivals ${otpA}%, departures ${otpD}%): ${otpA<otpD?'arrivals sat in the stack. Give arrivals more runways before the purple wave peaks, not during it.':'departures queued at the holding points. Hand runways to departures before the teal wave peaks.'}`);if(cx<90)why.push(`Connections ${cx}%: arrivals that hold in the stack miss their onward flights. Give arrivals runways before the arrival wave, not during it.`);if(S.safety<90&&S.hits.length)why.push(`Safety ${Math.round(S.safety)}: ${S.hits.slice(0,3).map(h=>h.msg).join(' ')}${S.hits.length>3?` And ${S.hits.length-3} more.`:''}`);
  const next=LEVELS[LV.n];
  $('#sheet').innerHTML=`<div class="band"><span>Level ${LV.n} · ${LV.name}</span><span>${clk(0)} to ${clk(Math.max(LEN,T))}</span></div><div class="in">
   <div class="bigstars">${starStr(st)}</div><h1 style="margin-top:8px">${st?'Level complete':'Level failed'}</h1><p>${verdict}</p>
   <div class="score"><div><div class="k">Movements</div><div class="v">${S.moves}/${LV.target}</div></div><div><div class="k">On time</div><div class="v">${otp}%</div><div class="sub">arrivals ${otpA}% · departures ${otpD}%</div></div><div><div class="k">Connections</div><div class="v">${cx}%</div></div><div><div class="k">Safety</div><div class="v">${Math.round(S.safety)}</div></div><div><div class="k">Your calls</div><div class="v">${S.incOk}/${S.incOk+S.incDef}</div><div class="sub">${S.incDef?`${S.incDef} left to ops`:S.incOk?'all made by you':'no calls this shift'}</div></div><div><div class="k">Runway flips</div><div class="v">${S.flips}</div></div><div><div class="k">Best on-time run</div><div class="v">${S.bestCombo||0}</div></div></div>
   <p class="src">${(k=>`Stars: one for keeping safety at 70 or above. Two for reaching the movement target with ${k.otp2}% on time and ${k.cx2}% of connections. Three for ${k.otp3}% on time, ${k.cx3}% of connections and safety 90.${LV.starsAt?(LV.n===3?' This level allows for the summit shutdown.':LV.n===4?' This level allows for the Delhi summit.':' This level allows for the opening-day surprises.'):''}`)(starLines(LV))}</p>
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
window.HUB={get T(){return T;},get S(){return S;},get LV(){return LV;},flights:()=>flights,RW,incidents:()=>incidents,setMode:(id,m)=>{const r=RW.find(x=>x.id===id||x.short===id);if(r)setMode(r,m);},startLevel,capNow,forceIncursion:()=>{const c=STO.find(o=>o.k==='fog');if(c&&c.sc)c.sc.go=true;},resolveAll:()=>{for(const I of incidents.slice()){const a=I.botPick!=null?I.acts[I.botPick]:I.acts.find(a=>!(a.dis&&a.dis()));if(a)a.fn();}},speed:s=>setSpeed(s),ops:()=>ops,cfg:CFG,
  // test hooks: run the sim forward synchronously, and point the camera
  ff:secs=>{VQ.length=0;FFING=true;try{for(let i=0;i<secs&&!ended;i++){tick(1);if(CINE&&CINE.o.until==null){const ms=1000/BASE/Math.max(0.25,speed);CINE.t0-=ms;if(CINE.landAt)CINE.landAt-=ms;}}}finally{FFING=false;}puffs.length=0;hud();drawWave();},look:(x,y,z)=>{camT.s=cam.fit*z;camT.anchor=null;camT.x=x-((cam.region.L+cam.region.R)/2)/camT.s;camT.y=y-((cam.region.Tp+cam.region.B)/2)/camT.s;clampCam(camT);Object.assign(cam,{x:camT.x,y:camT.y,s:camT.s});},spawn:(t,x)=>spawnInc(t,x),opsSpawn:(k,x)=>opsSpawn(k,x),pause:()=>{paused=true;},
  view:v=>setView(v),ready3d:()=>new Promise(r=>{if(V3.ready||V3.failed)r(V3.ready);else{V3.waiters.push(r);init3D();}}),
  cam3d:o=>{if(o.mode&&o.mode!=='map'){setCam(o.mode,o.fid?flights.find(f=>f.id===o.fid):null);return;}setCam('map');Object.assign(C3.t,o);Object.assign(C3,C3.t);},
  // the Delhi summit's running order (both protocol orders) and every line it can voice, for tests and voice/lines/l4.json
  summitPlan:(E,trio)=>{const R3=['R1','R2','R3'].map(id=>RW.find(r=>r.id===id));const pl=sumPlan(E||0,R3,!!trio);return{p0:pl.p0,p1:pl.p1,items:pl.items.map(it=>({k:it.k,kind:it.kind,td:Math.round(it.td),A0:Math.round(it.A0),A1:Math.round(it.A1),ac:it.ac.map(a=>[a.d.k,a.r.short,a.td])})),lines:pl.lines};},
  voiceL4:()=>{const R3=['R1','R2','R3'].map(id=>RW.find(r=>r.id===id)),out=[],add=(key,voice)=>{if(!out.some(o=>o.key===key))out.push({key,voice,say:spoken(key)});};
    for(const trio of [false,true])for(const l of sumPlan(4800,R3,trio).lines)add(l.key,l.voice);
    ['Sir. Delhi has brought its summit. We have taken over your runways.','Thank you for giving us your runways. Thank you for your support.','Your runways shall now be cleared, in a staged manner.',
     `Runway ${R3[2].short} shall be cleared first.`,`Then runway ${R3[1].short}.`,`And finally, runway ${R3[0].short}.`,'Thank you, sir, for this.','And thank you for serving the nation.','Jai Hind.',
     'The three motorcades have met on the apron.','Nobody will reverse. Talks are under way.'].forEach(t=>add(t,'spg'));return out;},
  // any banner, for layout checks: HUB.banner(kicker,title,line,icons) (icons: HTML, where @IN @RU @US @CN are flags, or just
  // 'IN+RU'); HUB.banner() hides it
  banner:(k,t,m,ic)=>{const F={IN:FLAG_IN,RU:FLAG_RU,US:FLAG_US,CN:FLAG_CN};ic=ic==null?'':/^[A-Z+]+$/.test(ic)?ic.split('+').map(x=>F[x]).join(''):ic.replace(/@(IN|RU|US|CN)/g,(_,x)=>F[x]);
    vipBanner(k!=null,k,t,m||'',ic);return k!=null?$('#vipBanner').getBoundingClientRect().toJSON():null;},
  dbg:()=>({cine:CINE?{f:CINE.f?CINE.f.callsign:null,ban:CINE.ban[0],until:CINE.o.until}:null,mus:MUS.name,pace:PACE,speed}),
  // the voice queue, for timing probes: queue a line (say's options), start a track, read the queue
  voice:{say:(src,text,o)=>say(src,text,o),music:(n,o)=>music(n,o),q:()=>({on:vqOn,n:VQ.length,cur:vqIt&&vqIt.text,pri:vqIt&&vqIt.pri,hold:VHOLD,mus:MUS.name,ended})},
  stats3d:()=>V3.ready?{cpuMs:+(V3.cpu||0).toFixed(2),fps:V3.fps,calls:Z.renderer.info.render.calls,tris:Z.renderer.info.render.triangles,geoms:Z.renderer.info.memory.geometries,tex:Z.renderer.info.memory.textures,mods:Object.keys(Z.mods),mode:V3.mode}:null,Z:()=>Z};

/*@@3D@@*/

/* ============ boot ============ */
buildTerrain();resize();
let last=performance.now(),hudT=0;
function frame(ms){
  requestAnimationFrame(frame);audioSync();
  if(cv.clientWidth&&(cv.clientWidth!==VW||cv.clientHeight!==VH))resize();
  const dtR=Math.min(0.1,(ms-last)/1000);last=ms;camEase(dtR);
  if(running&&!paused&&!ended){let d=dtR*BASE*Math.min(PACE!=null?PACE:speed,VHOLD!=null?VHOLD:99);try{while(d>0){const st=Math.min(1,d);tick(st);d-=st;}}catch(err){console.error(err);}incTick(dtR);if(toastTimer>0&&!frame.cine&&!toastFold){toastTimer-=dtR;if(toastTimer<=0&&!$('#toast').matches(':hover'))$('#toast').hidden=true;}}
  // while a cinematic runs the coach card folds down to its title (#app.cine), and its timer waits until the shot is over
  {const on=!!(CINE||(SUM&&SUM.cine));if(on!==!!frame.cine){frame.cine=on;$('#app').classList.toggle('cine',on);toastRoom();}}
  if(V3.on){try{draw3D(ms/1000,dtR);}catch(err){console.error(err);}}else{try{draw(ms/1000);}catch(err){console.error(err);}}
  hudT+=dtR;if(hudT>0.25&&LV){hudT=0;try{hud();toastRoom();}catch(err){console.error(err);}try{drawWave();}catch(err){console.error(err);}}
}
// idle preview: show level 4's layout behind the menu
LV=LEVELS[3];RW.forEach(r=>{r.locked=false;r.mode=r.role==='arr'?'ARR':r.role==='dep'?'DEP':'MIX';});resetState();
menu('levels');
if(V3.want)init3D();
requestAnimationFrame(frame);
})();
