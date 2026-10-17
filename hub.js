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
const RW=SPEC.runways.map(r=>{const o=Object.assign({},r);o.exits=(r.exits||[]).map(e=>({x:e.x,to:ensureNode(e.to[0],e.to[1]).k})).sort((a,b)=>b.x-a.x);o.holds=(r.holds||[]).map(h=>ensureNode(h.x,h.y).k);o.len=r.x1-r.x0;o.mode='OFF';o.locked=true;o.changeUntil=-1;o.closedUntil=-1;o.why='';o.tdList=[];o.lastSchedTd=-1e9;o.lastDep=-1e9;o.lastDepWake='M';o.lastArrWake='M';o.arrExit=-1e9;o.occ=null;o.ops=0;o.short=o.name.split('/')[1]||o.name;return o;}).sort((a,b)=>a.y-b.y);
const LONGEST=RW.reduce((a,b)=>b.len>a.len?b:a,RW[0]);
const GATES=[];
(SPEC.concourses||[]).forEach((c,ci)=>c.gates.forEach(g=>GATES.push({id:g.id,x:g.x,y:g.y,a:compA(g.nose),code:g.code,zone:g.zone,bridge:g.bridge!==false,lane:ensureNode(g.lane[0],g.lane[1]).k,conc:c.id,ci,occ:null,res:null,open:true})));
(SPEC.remote||[]).forEach(g=>GATES.push({id:g.id,x:g.x,y:g.y,a:compA(g.nose),code:g.code,zone:g.zone||'swing',bridge:false,lane:ensureNode(g.lane[0],g.lane[1]).k,conc:'REM',ci:-1,occ:null,res:null,open:true,remote:true}));
const CONC=(SPEC.concourses||[]).map((c,i)=>{const gs=GATES.filter(g=>g.ci===i);const cx=gs.reduce((s,g)=>s+g.x,0)/Math.max(1,gs.length),cy=gs.reduce((s,g)=>s+g.y,0)/Math.max(1,gs.length);return{id:c.id,name:c.name,zone:c.zone,cx,cy,apm:c.apm,gates:gs,path:c.outline?new Path2D(c.outline):null};});
const PROC=(SPEC.buildings||[]).find(b=>b.kind==='processor');
const procC=(function(){if(SPEC.apm&&SPEC.apm.stations&&SPEC.apm.stations.length){const s=SPEC.apm.stations;return{x:s.reduce((a,b)=>a+b.x,0)/s.length,y:s.reduce((a,b)=>a+b.y,0)/s.length};}return{x:0,y:0};})();
CONC.forEach(c=>c.d=dist(c.cx,c.cy,procC.x,procC.y));
const CONC_ORDER=CONC.slice().sort((a,b)=>a.d-b.d);
const STACKS=[{id:'N',x:EXT.x1+3600,y:(EXT.y0+EXT.y1)/2-3900},{id:'C',x:EXT.x1+4300,y:(EXT.y0+EXT.y1)/2},{id:'S',x:EXT.x1+3600,y:(EXT.y0+EXT.y1)/2+3900}];
const PARK=(function(){const m=(SPEC.buildings||[]).find(b=>b.kind==='mro');if(m&&m.cx!=null)return nearestNode(m.cx,m.cy).k;const rem=GATES.filter(g=>g.remote);if(rem.length){const g=rem[rem.length-1];return g.lane;}return nearestNode(EXT.x0+500,0).k;})();

/* ============ time ============ */
const BASE=20;
let T=0,T0C=6*3600,LV=null,speed=1,paused=true,running=false,ended=false;
const LEN=5400;
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
  A388:{name:'Airbus A380-800',len:72.7,span:79.75,code:'F',wake:'J',eng:4,pax:489,turn:100,hot:true}
};
const CR={C:1,E:3,F:4};
const AL={
  '6E':{name:'IndiGo',radio:'IFLY',tail:'#3b42c4'},AI:{name:'Air India',radio:'AIR INDIA',tail:'#d0263a'},IX:{name:'Air India Express',radio:'EXPRESS INDIA',tail:'#e4572e'},
  QP:{name:'Akasa Air',radio:'AKASA AIR',tail:'#f26722'},SG:{name:'SpiceJet',radio:'SPICEJET',tail:'#e0262e'},
  EK:{name:'Emirates',radio:'EMIRATES',tail:'#d71a21'},QR:{name:'Qatar Airways',radio:'QATARI',tail:'#8a1648'},EY:{name:'Etihad',radio:'ETIHAD',tail:'#b8925a'},
  SQ:{name:'Singapore Airlines',radio:'SINGAPORE',tail:'#264a8c'},LH:{name:'Lufthansa',radio:'LUFTHANSA',tail:'#22397a'},BA:{name:'British Airways',radio:'SPEEDBIRD',tail:'#2f52a8'},
  SV:{name:'Saudia',radio:'SAUDIA',tail:'#12805a'},TG:{name:'Thai',radio:'THAI',tail:'#6a3496'},FZ:{name:'flydubai',radio:'SKY DUBAI',tail:'#1a4c86'},AF:{name:'Air France',radio:'AIRFRANS',tail:'#1d3c8f'}
};
const DOMC=[['Delhi','DEL','N',3],['Mumbai','BOM','W',3],['Bengaluru','BLR','S',3],['Hyderabad','HYD','S',2],['Chennai','MAA','S',2],['Kolkata','CCU','E',2],['Ahmedabad','AMD','W',2],['Pune','PNQ','W',1.5],['Goa','GOX','W',1],['Kochi','COK','S',1],['Jaipur','JAI','N',1],['Lucknow','LKO','N',1],['Guwahati','GAU','E',1],['Patna','PAT','E',1],['Bhubaneswar','BBI','E',1],['Srinagar','SXR','N',0.6],['Varanasi','VNS','N',0.8],['Indore','IDR','N',0.8],['Raipur','RPR','E',0.6],['Visakhapatnam','VTZ','E',0.8],['Thiruvananthapuram','TRV','S',0.8],['Chandigarh','IXC','N',0.7],['Amritsar','ATQ','N',0.6],['Coimbatore','CJB','S',0.6]];
const INTC=[['Dubai','DXB','W',['EK','6E','AI','FZ'],5],['Doha','DOH','W',['QR','6E'],2],['Abu Dhabi','AUH','W',['EY','6E','IX'],2],['Singapore','SIN','E',['SQ','AI','6E'],2],['London','LHR','W',['BA','AI'],1.5],['Frankfurt','FRA','W',['LH','AI'],1],['Paris','CDG','W',['AF','AI'],0.8],['Jeddah','JED','W',['SV','6E'],1],['Bangkok','BKK','E',['TG','6E','AI'],1.2]];
const DIRSTACK={N:0,W:1,E:1,S:2};

/* ============ levels ============ */
const LEVELS=[
  {n:1,name:'Opening day',sub:'Bengaluru moves in',from:'BLR',clock:'06:00',arr:32,dep:32,amp:0.5,rw:2,rwOpen:{R3:'ARR',R4:'DEP'},concs:'AB',intl:0.08,wide:0.06,a380:0,incRate:0.10,target:82,light:'dawn',
   blurb:'The first airline traffic arrives: Bengaluru\'s morning wave. Two runways, two concourses. Learn the bank chart and the runway desk.',
   script:[[240,'fod'],[900,'medical'],[1700,'breakdown'],[2600,'birds']]},
  {n:2,name:'Hyderabad joins',sub:'+ Hyderabad',from:'BLR+HYD',clock:'09:00',arr:64,dep:64,amp:0.6,rw:4,rwOpen:{R2:'ARR',R3:'DEP',R4:'DEP',R5:'ARR'},concs:'ABC',intl:0.12,wide:0.10,a380:0,incRate:0.16,target:165,light:'day',
   blurb:'Four runways and two traffic streams. The waves get taller. Flip runways between arrivals and departures as each bank comes through.',
   script:[[600,'birds'],[1500,'breakdown'],[2700,'medical']]},
  {n:3,name:'Mumbai and the Gulf',sub:'+ Mumbai',from:'BLR+HYD+BOM',clock:'14:00',arr:94,dep:94,amp:0.6,rw:5,rwOpen:{R1:'ARR',R2:'ARR',R3:'DEP',R4:'DEP',R5:'ARR'},concs:'ABCDE',intl:0.22,wide:0.18,a380:4,incRate:0.22,target:245,light:'heat',
   blurb:'46 °C. Hot air is thin, so heavy jets need the long runway to get airborne. Widebodies, A380s and the Gulf wave on top of the domestic banks.',
   script:[[900,'birds'],[2000,'fod'],[3400,'medical']]},
  {n:4,name:'Delhi. Full hub.',sub:'+ Delhi',from:'DEL+BOM+BLR+HYD',clock:'19:00',arr:116,dep:116,amp:0.5,rw:6,rwOpen:{R1:'ARR',R2:'ARR',R3:'DEP',R4:'DEP',R5:'DEP',R6:'ARR'},concs:'ABCDEF',intl:0.25,wide:0.20,a380:6,incRate:0.30,target:310,light:'dusk',dust:[2400,3300],
   blurb:'Four airports\' worth of traffic through one hub at the evening peak: about 230 movements an hour, with peaks well above. Then an andhi (dust storm) rolls in from the west.',
   script:[[1500,'medical'],[2450,'fod']]}
];

/* ============ state ============ */
let flights=[],FID=0,S=null,incidents=[],INC=0,selected=null,hover=null,selRw=null;
const puffs=[],moveLog=[];
function resetState(){
  flights=[];FID=0;incidents=[];INC=0;selected=null;hover=null;selRw=null;puffs.length=0;moveLog.length=0;
  S={moves:0,arr:0,dep:0,depOnTime:0,cnxMade:0,cnxMiss:0,safety:100,incOk:0,incFail:0,holdMin:0,div:0,goArounds:0,log:[],delaySum:0,flips:0};
  GATES.forEach(g=>{g.occ=null;g.res=null;});
  RW.forEach(r=>{r.tdList=[];r.lastSchedTd=-1e9;r.lastDep=-1e9;r.arrExit=-1e9;r.occ=null;r.changeUntil=-1;r.closedUntil=-1;r.why='';r.ops=0;r.flash=0;});
  RC.clear();SIMR=mulberry(11);
}
const cs=f=>f.A.radio+' '+f.num,fl=f=>f.al+' '+f.num;
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
  for(const g of GATES){if(g.occ||g.res||!g.open||CR[g.code]<code||!zoneOk(g,f))continue;let s=(CR[g.code]-code)*400+(g.remote?2500:0);s+=dist(g.x,g.y,procC.x,procC.y)*(initial?0.02:0.1);if(s<bs){bs=s;best=g;}}
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
  fod:{t:'FOD: foreign object debris',d:'Anything loose on a runway: a bolt, a piece of tyre, a luggage tag. Engines suck it in and tyres burst on it. Air France 4590, the Concorde, was brought down by a metal strip on the runway in 2000. A sweep closes the runway for a few minutes.'},
  birds:{t:'Bird activity',d:'Birds near a runway are a real risk at take-off and landing. A bird patrol scares them off with noise and vehicles, closing the runway for a short time.'},
  heat:{t:'Heat and heavy jets',d:'Hot air is thinner, so wings make less lift and engines less thrust. At 46 °C a full A380 or 777 needs a much longer take-off roll, so it can only use the longest runway.'},
  gate:{t:'Gates, swing gates and remote stands',d:'Contact gates have aerobridges. Swing gates can serve domestic or international flights. Remote stands have no bridge, so passengers ride buses, which adds time.'},
  apm:{t:'APM: automated people mover',d:'The driverless train under the apron that links the central terminal with every concourse. Transfers depend on it.'},
  otp:{t:'On time',d:'A departure counts as on time if it is airborne within 25 minutes of its scheduled pushback: 15 minutes of tolerance plus a 10-minute taxi.'},
  dust:{t:'Andhi: dust storm',d:'Pre-monsoon dust storms sweep across central India. Visibility drops fast, crosswinds gust, and ATC widens the gaps between landings.'},
  mix:{t:'Mixed mode',d:'One runway doing both arrivals and departures, slotting a take-off between each pair of landings. Flexible, but each runway handles fewer movements in total than two specialised runways.'}
};
const term=(k,txt)=>`<span class="term" tabindex="0" data-k="${k}">${txt}</span>`;
const coachItems=[];let toastTimer=0;const seen=new Set();
function showToast(t,d){$('#tT').textContent=t;$('#tD').innerHTML=d.startsWith('<')?d:`<p>${d}</p>`;const el=$('#toast');el.hidden=false;el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');toastTimer=18;placeToast();}
function coach(t,d){coachItems.unshift({t,d,at:clk(T)});$('#coachList').innerHTML=coachItems.map(c=>`<div class="ci"><div class="tm">${c.at}</div><h4>${c.t}</h4>${c.d.startsWith('<')?c.d:`<p>${c.d}</p>`}</div>`).join('');showToast(t,d);}
function explain(k){if(seen.has(k))return;seen.add(k);const g=GL[k];if(g)coach(g.t,g.d);}
$('#tX').onclick=()=>{$('#toast').hidden=true;};
document.addEventListener('click',e=>{const t=e.target.closest('.term');if(t&&t.dataset.k&&GL[t.dataset.k])showToast(GL[t.dataset.k].t,GL[t.dataset.k].d);});
(function(){const g=$('#gloss');Object.keys(GL).forEach(k=>{const b=document.createElement('button');b.textContent=GL[k].t;b.onclick=()=>showToast(GL[k].t,GL[k].d);g.appendChild(b);});})();
function placeToast(){const w=$('#wave').getBoundingClientRect(),app=$('#app').getBoundingClientRect();$('#toast').style.bottom=(app.bottom-w.top+8)+'px';}

/* ============ runway logic ============ */
const D_APP=170,SEP_AA=88,SEP_DD=72,MIX_GAP=58,DEP_OCC=55,CHANGE=120;
let dustNow=false,heatNow=false;
const sepF=()=>dustNow?1.4:1;
const canArr=r=>!r.locked&&(r.mode==='ARR'||r.mode==='MIX')&&T>=r.changeUntil&&T>=r.closedUntil;
const canDep=r=>!r.locked&&(r.mode==='DEP'||r.mode==='MIX')&&T>=r.changeUntil&&T>=r.closedUntil;
const depModeOk=r=>!r.locked&&(r.mode==='DEP'||r.mode==='MIX');
const needsLong=f=>heatNow&&f.T.hot&&!f.offloaded;
function setMode(r,m,silent){
  if(r.locked||r.mode===m)return;const was=r.mode;r.mode=m;r.changeUntil=T+CHANGE;S.flips++;
  for(const f of flights){if((f.state==='taxi_out'||f.state==='hp')&&f.rwy===r&&!depModeOk(r))assignDep(f,true);}
  if(!silent){radio('AOCC',`Runway ${r.short} ${was} → ${m}. Changeover 2 minutes.`);logE(`Runway ${r.short} set to ${m}.`);}
  renderRw();
}
function rk(f){return(f.mayday?0:f.prio?1:f.minFuel?2:3)*1e7+(f.state==='holding'?f.holdSince:f.eta);}
function gateY(f){if(f.gate)return f.gate.y;if(f.res)return f.res.y;return procC.y;}
function arrSep(r){return SEP_AA*sepF()+(r.lastArrWake==='J'?55:r.lastArrWake==='H'?25:0);}
function runways(){
  // arrivals
  const avail=RW.filter(r=>canArr(r)&&r.status!=='x');
  if(avail.length){
    const cands=flights.filter(f=>(f.state==='holding'||(f.state==='inbound'&&T>=f.eta-D_APP-40))).sort((a,b)=>rk(a)-rk(b));
    const depWaiting=r=>flights.some(f=>f.state==='hp'&&f.rwy===r);
    const ready=avail.filter(r=>{const td=T+D_APP;let need=r.lastSchedTd+arrSep(r);if(r.mode==='MIX'&&depWaiting(r))need+=MIX_GAP;return td>=need&&td>=r.lastDep+DEP_OCC;});
    for(const c of cands){if(!ready.length)break;
      if(!c.res&&!c.gate){const g=freeGate(c);if(g){g.res=c;c.res=g;}}
      const gy=gateY(c);ready.sort((a,b)=>Math.abs(a.y-gy)-Math.abs(b.y-gy));const r=ready.shift();beginApproach(c,r,T+D_APP);}
  }
  // departures
  for(const r of RW){
    if(!canDep(r)||r.occ||T<r.arrExit+4)continue;
    const wk=r.lastDepWake==='J'?90:r.lastDepWake==='H'?30:0;
    if(T<r.lastDep+SEP_DD*(dustNow?1.15:1)+wk)continue;
    if(r.tdList.some(td=>td-T<DEP_OCC&&td-T>-12))continue;
    const q=flights.filter(f=>f.state==='hp'&&f.rwy===r&&!(needsLong(f)&&r!==LONGEST)).sort((a,b)=>(b.prio-a.prio)||(a.hpSince-b.hpSince));if(!q.length)continue;
    const f=q[0];f.state='lineup';r.occ=f;r.lastDep=T;r.lastDepWake=f.T.wake;f.rollT=T;
    const st={x:r.x1-60,y:r.y};setPath(f,[{x:f.x,y:f.y},{x:r.x1-30,y:lerp(f.y,r.y,0.6)},st]);
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
  f.rwy=best;f.hold=bh;setPath(f,(reroute?[{x:f.x,y:f.y}]:[]).concat(bp));f.state='taxi_out';return true;
}

/* ============ flight logic ============ */
function setPath(f,p){f.path=p;f.pd=0;f.plen=pathLen(p);}
function advance(f,dt,v,rev){f.pd=Math.min(f.plen,f.pd+v*dt);const p=pointAt(f.path,f.pd);f.x=p.x;f.y=p.y;const tg=rev?p.a+Math.PI:p.a;f.heading+=angDiff(f.heading,tg)*Math.min(1,dt*1.8);return f.pd>=f.plen-0.01;}
const MOVING=new Set(['rollout','taxi_in','taxi_out','hp','push','start','lineup','nogate','tow','stuck']);
let movingList=[];
function blocked(f){const hx=Math.cos(f.heading),hy=Math.sin(f.heading);const lim=Math.max(70,f.T.len*1.9);for(const o of movingList){if(o===f)continue;const dx=o.x-f.x,dy=o.y-f.y;if(Math.abs(dx)>lim||Math.abs(dy)>lim)continue;const d=Math.hypot(dx,dy);if(d>lim||d<1)continue;if((dx*hx+dy*hy)/d<0.9)continue;if(o.state!=='stuck'&&o.state!=='nogate'&&o.state!=='hp'&&Math.abs(angDiff(f.heading,o.heading))>1.3)continue;return true;}return false;}
function stackOf(f){return STACKS[Math.min(STACKS.length-1,DIRSTACK[f.dir]??1)];}
function spawnInbound(f){const st=stackOf(f);const a=Math.atan2(st.y-0,st.x-0);const sx=st.x+Math.cos(a)*9000+(SIMR()-0.5)*4000,sy=st.y+Math.sin(a)*9000+(SIMR()-0.5)*4000;f.x=sx;f.y=sy;f.alt=2400;setPath(f,[{x:sx,y:sy},{x:st.x,y:st.y}]);f.state='inbound';f.heading=Math.atan2(st.y-sy,st.x-sx);f.stack=st;}
function beginApproach(f,r,td){
  f.state='approach';f.rwy=r;f.apT0=T;f.td=td;const faf={x:r.x1+7000,y:r.y},tdp={x:r.x1-450,y:r.y};
  const mid={x:Math.max(f.x,faf.x)+1200,y:lerp(f.y,r.y,0.7)};
  setPath(f,[{x:f.x,y:f.y},mid,faf,tdp]);f.finalLen=7450;f.finalStart=f.plen-f.finalLen;f.startAlt=f.alt||1500;
  r.tdList.push(td);r.lastSchedTd=td;r.lastArrWake=f.T.wake;f.gaRoll=SIMR();
}
function goAround(f,why){const r=f.rwy;r.tdList=r.tdList.filter(t=>t!==f.td);f.state='goaround';f.td=null;const st=stackOf(f);setPath(f,[{x:f.x,y:f.y},{x:r.x0-1500,y:r.y},{x:r.x0-3000,y:r.y+(r.y<0?-3000:3000)},{x:st.x,y:st.y}]);S.goArounds++;radio('TWR',`${cs(f)}, go around, ${why}.`);}
function touchdown(f){
  const r=f.rwy;f.state='rollout';f.alt=0;f.v=68;r.occ=f;r.tdList=r.tdList.filter(t=>t!==f.td);r.ops++;S.moves++;S.arr++;moveLog.push(T);f.landT=T;
  const need=f.T.code==='F'?2200:f.T.code==='E'?1900:1300;const tx=r.x1-450;let ex=r.exits.find(e=>tx-e.x>=need)||r.exits[r.exits.length-1];
  const to=G.get(ex.to);setPath(f,[{x:tx,y:r.y},{x:ex.x,y:r.y},{x:to.x,y:to.y}]);f.exitAt=tx-ex.x+40;f.exitNode=ex.to;
  const now=performance.now()/1000;for(let i=0;i<6;i++)puffs.push({x:tx-i*6,y:r.y+(i%2?-7:7),t:now+i*0.05});
}
function startTaxiIn(f){
  if(!f.res&&!f.gate){const g=freeGate(f);if(g){g.res=f;f.res=g;}}
  if(f.res){const p=route(f.exitNode,f.res.lane);if(p){setPath(f,[{x:f.x,y:f.y}].concat(p));f.state='taxi_in';return;}}
  f.state='nogate';f.nogateSince=T;if(!incidents.some(i=>i.f===f))spawnInc('nogate',f);
}
function depart(f){f.state='gone';const late=(f.rollT-f.std)/60;S.moves++;S.dep++;moveLog.push(f.rollT);if(late<=25)S.depOnTime++;S.delaySum+=Math.max(0,late-10);}
function settleLinks(f){if(!f.links)return;for(const l of f.links){const ok=l.arr.inBlock!=null&&l.arr.inBlock+l.x+(l.arr.gate&&l.arr.gate.remote?300:0)<=f.pushT+(f.heldFor||0);if(ok)S.cnxMade+=l.n;else S.cnxMiss+=l.n;}f.links=null;}
function laneClear(g){const L=G.get(g.lane);for(const o of movingList){if(o.gate===g)continue;if(Math.abs(o.x-L.x)<130&&Math.abs(o.y-L.y)<130)return false;}return true;}
function updateFlight(f,dt){
  switch(f.state){
  case 'sched':if(T>=f.spawnT)spawnInbound(f);break;
  case 'inbound':advance(f,dt,150);f.endurance-=dt/60;f.alt=Math.max(1800,f.alt-dt*2);if(f.pd>=f.plen){f.state='holding';f.holdSince=T;f.hu=SIMR()*6000;}fuelCheck(f);break;
  case 'holding':{f.hu+=72*dt;const st=f.stack;const mates=flights.filter(o=>o.state==='holding'&&o.stack===st);f.level=Math.max(0,mates.sort((a,b)=>rk(a)-rk(b)).indexOf(f));const p=stackPos(st,f.hu,f.level);f.x=p.x;f.y=p.y;f.heading+=angDiff(f.heading,p.a)*Math.min(1,dt*2);f.alt=2100+f.level*300;f.endurance-=dt/60;S.holdMin+=dt/60;fuelCheck(f);break;}
  case 'approach':{const fr=clamp((T-f.apT0)/(f.td-f.apT0),0,1);f.pd=fr*f.plen;const p=pointAt(f.path,f.pd);f.x=p.x;f.y=p.y;f.heading+=angDiff(f.heading,p.a)*Math.min(1,dt*1.5);
    if(f.pd>=f.finalStart){const k=(f.pd-f.finalStart)/f.finalLen;f.alt=Math.max(0,700*(1-k/0.96));}else f.alt=lerp(f.startAlt,700,clamp(f.pd/Math.max(1,f.finalStart),0,1));
    if(dustNow&&f.td-T<20&&f.td-T>10&&f.gaRoll<0.07&&!f.gaDone){f.gaDone=true;goAround(f,'windshear in the dust');break;}
    if(f.birdHit&&f.td-T<20&&!f.gaDone){f.gaDone=true;goAround(f,'bird strike on short final');break;}
    if(T>=f.td)touchdown(f);break;}
  case 'rollout':{f.v=Math.max(14,f.v-1.15*dt);const done=advance(f,dt,f.v);if(f.rwy.occ===f&&f.pd>=f.exitAt){f.rwy.occ=null;f.rwy.arrExit=T;}if(done){if(f.rwy.occ===f){f.rwy.occ=null;f.rwy.arrExit=T;}startTaxiIn(f);}break;}
  case 'nogate':{if(!f.res){const g=freeGate(f);if(g){g.res=f;f.res=g;}}if(f.res){const p=route(f.exitNode,f.res.lane);if(p){setPath(f,[{x:f.x,y:f.y}].concat(p));f.state='taxi_in';closeIncFor(f,true);}}break;}
  case 'taxi_in':if(blocked(f))break;if(advance(f,dt,14)){const g=f.res;setPath(f,[{x:G.get(g.lane).x,y:G.get(g.lane).y},{x:g.x,y:g.y}]);f.state='dock';}break;
  case 'dock':if(advance(f,dt,4)){const g=f.res;g.occ=f;g.res=null;f.gate=g;f.res=null;f.heading=g.a;f.inBlock=T;if(f.turn)toDep(f);else{f.state='parked';f.towAt=T+(20+SIMR()*15)*60;}}break;
  case 'parked':if(T>=f.towAt&&laneClear(f.gate)){const g=f.gate;const p=route(g.lane,PARK);g.occ=null;f.state='tow';setPath(f,[{x:g.x,y:g.y}].concat(p||[]));f.gate=null;}break;
  case 'tow':if(blocked(f))break;if(advance(f,dt,f.pd<90?3:7,f.pd<90))f.state='towed';break;
  case 'at_gate':{
    if(f.std<=T&&f.links&&!f.cnxAsked&&!f.held){const late=f.links.filter(l=>l.arr.inBlock==null&&l.arr.state!=='diverted').reduce((s,l)=>s+l.n,0);if(late>=35&&incidents.length<maxInc()){f.cnxAsked=true;spawnInc('connex',f,{n:late});}}
    const go=Math.max(f.std,f.readyAt);
    if(T>=go&&!f.held&&laneClear(f.gate)){f.pushT=T;settleLinks(f);f.state='push';const g=f.gate;setPath(f,[{x:g.x,y:g.y},{x:G.get(g.lane).x,y:G.get(g.lane).y}]);g.occ=null;f.lastGate=g;f.gate=null;f.gateRef=g;}
    break;}
  case 'push':if(advance(f,dt,3.5,true)){f.state='start';f.startT=T;}break;
  case 'start':if(T>=f.startT+45){f.gate={lane:f.gateRef.lane};const ok=assignDep(f,false);f.gate=null;if(!ok){f.state='start';f.startT=T-35;f.noRwy=true;}}break;
  case 'taxi_out':if(f.noRwy||!f.rwy){if(T<(f.retryAt||0))break;f.retryAt=T+10;if(!assignDep(f,true))break;}if(blocked(f))break;if(advance(f,dt,14)){f.state='hp';f.hpSince=T;if(needsLong(f)&&f.rwy!==LONGEST&&!f.heatAsked){f.heatAsked=true;}}break;
  case 'hp':if(!f.rwy||!depModeOk(f.rwy)){if(T>=(f.retryAt||0)){f.retryAt=T+10;assignDep(f,true);}break;}if(needsLong(f)&&f.rwy!==LONGEST&&!incidents.some(i=>i.f===f))spawnInc('heavy',f);break;
  case 'lineup':if(advance(f,dt,8)){f.state='roll';f.v=8;f.s=60;}break;
  case 'roll':{const r=f.rwy;f.v=Math.min(95,f.v+(heatNow&&f.T.hot?1.7:2.3)*dt);f.s+=f.v*dt;f.x=r.x1-f.s;f.y=r.y;f.heading+=angDiff(f.heading,Math.PI)*Math.min(1,dt*3);const lift=f.T.code==='C'?1500:heatNow?3000:2300;
    if(f.rto){f.v=Math.max(0,f.v-5*dt);if(f.v<=6){f.rto=false;f.state='taxi_out';r.occ=null;r.closedUntil=T+360;r.why='Runway inspection after a rejected take-off';f.rollT=null;assignDep(f,true);}break;}
    if(f.s>lift)f.alt+=f.v*0.14*dt;if(r.occ===f&&(f.alt>60))r.occ=null;if(f.x<EXT.x0-2500){r.ops++;depart(f);}break;}
  case 'goaround':advance(f,dt,100);f.alt=Math.min(1200,f.alt+12*dt);f.endurance-=dt/60;if(f.pd>=f.plen){f.state='holding';f.holdSince=T-40;f.hu=0;}break;
  case 'divert':advance(f,dt,170);f.alt=Math.min(3500,f.alt+15*dt);if(f.pd>=f.plen)f.state='diverted';break;
  case 'stuck':if(T>=f.stuckUntil){f.state=f.stuckPrev;}break;
  }
  if(f.alt>30&&['approach','roll','goaround','inbound','divert'].includes(f.state)){const tr=f.trail;if(!tr.length||Math.hypot(tr[tr.length-1].x-f.x,tr[tr.length-1].y-f.y)>160){tr.push({x:f.x,y:f.y});if(tr.length>20)tr.shift();}}
}
function fuelCheck(f){
  if(!f.minFuel&&f.endurance<14){f.minFuel=true;radio(f.al,`${cs(f)}, minimum fuel.`);if(!incidents.some(i=>i.f===f))spawnInc('fuel',f);}
  if(!f.mayday&&f.endurance<6){f.mayday=true;f.prio=true;radio(f.al,`MAYDAY fuel, ${cs(f)}.`);hitSafety(5,`${fl(f)} declared MAYDAY fuel after holding.`);}
  if(f.endurance<2.5&&['holding','inbound','goaround'].includes(f.state))divert(f,'fuel');
}
function divert(f,why){if(f.td&&f.rwy)f.rwy.tdList=f.rwy.tdList.filter(t=>t!==f.td);if(f.res){f.res.res=null;f.res=null;}f.state='divert';setPath(f,[{x:f.x,y:f.y},{x:f.x+12000,y:f.y<0?-9000:9000}]);S.div++;logE(`${fl(f)} diverted (${why}).`,'miss');radio('APP',`${cs(f)} diverting.`);closeIncFor(f,false);}
function hitSafety(v,msg){S.safety=clamp(S.safety-v,0,100);if(msg)logE(msg,'miss');}
function stackPos(st,u,level){const R=560+level*40,h=1100;const P=4*h+2*Math.PI*R;u=((u%P)+P)%P;const cx=st.x,cy=st.y;
  if(u<2*h)return{x:cx+R,y:cy-h+u,a:Math.PI/2};u-=2*h;const arc=Math.PI*R;if(u<arc){const t=u/R;return{x:cx+R*Math.cos(t),y:cy+h+R*Math.sin(t),a:t+Math.PI/2};}u-=arc;if(u<2*h)return{x:cx-R,y:cy+h-u,a:-Math.PI/2};u-=2*h;const t=Math.PI+u/R;return{x:cx+R*Math.cos(t),y:cy-h+R*Math.sin(t),a:t+Math.PI/2};}

/* ============ incidents ============ */
const ICON={medical:{g:'+',c:'#ff4d3f'},fuel:{g:'F',c:'#ffae3b'},fod:{g:'!',c:'#ff4d3f'},birds:{g:'B',c:'#ffae3b'},heavy:{g:'H',c:'#ff7a3f'},nogate:{g:'G',c:'#6aa3ff'},connex:{g:'C',c:'#b48cff'},breakdown:{g:'T',c:'#ffae3b'}};
const maxInc=()=>LV?(LV.n>=4?6:LV.n===3?5:4):4;
function pickRunway(){const rs=RW.filter(r=>!r.locked&&r.mode!=='OFF'&&T>=r.closedUntil);return rs.length?rs[Math.floor(SIMR()*rs.length)]:null;}
function spawnInc(type,target,extra){
  if(incidents.length>=maxInc()&&!['fuel','nogate','heavy'].includes(type))return;
  if(['fuel','heavy','nogate','connex'].includes(type)&&!target)return;
  const I={id:++INC,type,born:T,left:0,total:0};let ok=true;
  switch(type){
  case 'medical':{const f=target||flights.filter(o=>['inbound','holding'].includes(o.state)&&!o.prio&&!incidents.some(i=>i.f===o)).sort((a,b)=>a.eta-b.eta)[0];if(!f){ok=false;break;}
    Object.assign(I,{f,title:`Medical emergency on ${fl(f)}`,text:`A passenger in cardiac distress on the ${f.A.name} from ${f.from}. The crew asks for priority landing.`,total:35,acts:[{l:'Priority landing',pri:1,fn(){f.prio=true;resolve(I,true,`${fl(f)} moved to the front of the landing sequence.`);}}],timeout(){f.prio=true;hitSafety(6,`${fl(f)} medical emergency waited too long.`);}});explain('stack');break;}
  case 'fuel':{const f=target;Object.assign(I,{f,title:`${fl(f)} is on minimum fuel`,text:`It can hold about ${Math.max(1,Math.round(f.endurance))} more minutes. Land it next, or send it to Nagpur's old airport.`,total:30,acts:[{l:'Land it next',pri:1,fn(){f.prio=true;resolve(I,true,`${fl(f)} prioritised.`);}},{l:'Divert',fn(){divert(f,'your call');resolve(I,true,'');}}],timeout(){}});break;}
  case 'fod':{const r=target||pickRunway();if(!r){ok=false;break;}const x=lerp(r.x0,r.x1,0.3+SIMR()*0.5);Object.assign(I,{r,x,y:r.y,title:`Debris on runway ${r.short}`,text:`A pilot reports a metal strip near the centreline. A ${term('fod','sweep')} closes ${r.short} for 3 minutes.`,total:30,acts:[{l:'Sweep now',pri:1,fn(){closeRw(r,180,'Runway sweep');resolve(I,true,`Runway ${r.short} swept clean.`);}}],timeout(){closeRw(r,20*60,'Burst tyre on the runway');hitSafety(12,`A tyre burst on debris on runway ${r.short}.`);radio('TWR',`Burst tyre on ${r.short}! Runway closed.`);}});explain('fod');break;}
  case 'birds':{const r=target||pickRunway();if(!r){ok=false;break;}const x=lerp(r.x0,r.x1,0.55+SIMR()*0.35);Object.assign(I,{r,x,y:r.y+(SIMR()<.5?-140:140),title:`Birds near runway ${r.short}`,text:`A flock of black kites over the grass beside ${r.short}. A bird patrol clears them in 90 seconds with the runway closed.`,total:28,acts:[{l:'Send bird patrol',pri:1,fn(){closeRw(r,90,'Bird patrol');resolve(I,true,`Kites cleared from ${r.short}.`);}}],timeout(){const v=flights.find(o=>(o.state==='approach'&&o.rwy===r)||(o.state==='roll'&&o.rwy===r));if(v){if(v.state==='roll'&&v.alt<5){v.rto=true;}else v.birdHit=true;}closeRw(r,8*60,'Bird strike inspection');hitSafety(8,`Bird strike on runway ${r.short}.`);}});explain('birds');break;}
  case 'heavy':{const f=target;Object.assign(I,{f,title:`${fl(f)} can't take off here`,text:`At ${LV.n===3?'46':'40'} °C this ${f.A.name} ${f.type} needs the long runway, ${LONGEST.short}. Send it there (the long runway must be DEP or MIX).`,total:35,acts:[{l:`Taxi to ${LONGEST.short}`,pri:1,dis:()=>!depModeOk(LONGEST),fn(){f.rwy=LONGEST;const hs=LONGEST.holds;let best=null,bl=1e18,bp=null;for(const h of hs){const p=route(nearestNode(f.x,f.y).k,h);if(p&&pathLen(p)<bl){bl=pathLen(p);best=h;bp=p;}}if(bp){setPath(f,[{x:f.x,y:f.y}].concat(bp));f.state='taxi_out';f.hold=best;}resolve(I,true,`${fl(f)} taxiing to the long runway.`);}}],timeout(){f.offloaded=true;f.state='stuck';f.stuckPrev='hp';f.stuckUntil=T+20*60;S.cnxMiss+=40;logE(`${fl(f)} offloaded 40 passengers to cut weight.`,'miss');}});explain('heat');break;}
  case 'nogate':{const f=target;Object.assign(I,{f,title:`${fl(f)} has no gate`,text:`It landed and is waiting on the taxiway, blocking traffic behind it. Open a swing gate or send it to a remote stand (passengers go by bus).`,total:30,acts:[{l:'Remote stand',pri:1,fn(){const g=GATES.filter(g=>g.remote&&!g.occ&&!g.res&&CR[g.code]>=CR[f.T.code]).sort((a,b)=>dist(a.x,a.y,f.x,f.y)-dist(b.x,b.y,f.x,f.y))[0];if(g){g.res=f;f.res=g;resolve(I,true,`${fl(f)} sent to remote stand ${g.id}.`);}else coach('No remote stand free','Every remote stand that fits is taken. Try a swing gate.');}},{l:'Swing a gate',fn(){const g=GATES.filter(g=>!g.remote&&!g.occ&&!g.res&&CR[g.code]>=CR[f.T.code]).sort((a,b)=>dist(a.x,a.y,f.x,f.y)-dist(b.x,b.y,f.x,f.y))[0];if(g){g.zone='swing';g.res=f;f.res=g;resolve(I,true,`Gate ${g.id} swung for ${fl(f)}.`);}else coach('No gate to swing','Every contact gate that fits is taken.');}}],timeout(){}});explain('gate');break;}
  case 'connex':{const f=target;const n=extra.n;Object.assign(I,{f,title:`Hold ${fl(f)} for ${n} connecting passengers?`,text:`Its inbound feeder hasn't landed yet. Holding up to 10 minutes saves the connections but makes ${fl(f)} late.`,total:25,acts:[{l:'Hold 10 min',pri:1,fn(){f.held=true;f.holdUntil=T+600;f.heldFor=0;resolve(I,true,`${fl(f)} held for connections.`);}},{l:'Go now',fn(){resolve(I,true,'');}}],timeout(){}});explain('cnx');break;}
  case 'breakdown':{const f=target||flights.filter(o=>o.state==='taxi_out'&&o.pd>400&&o.plen-o.pd>800).sort(()=>SIMR()-0.5)[0];if(!f){ok=false;break;}f.stuckPrev=f.state;f.state='stuck';f.stuckUntil=T+15*60;Object.assign(I,{f,title:`${fl(f)} stuck on the taxiway`,text:`A hydraulic warning: it stopped mid-taxiway and everyone behind it is stuck. Send a tug to tow it clear.`,total:30,acts:[{l:'Send a tug',pri:1,fn(){f.stuckUntil=T+120;resolve(I,true,`Tug on the way to ${fl(f)}.`);}}],timeout(){hitSafety(3,`${fl(f)} blocked a taxiway for 15 minutes.`);}});break;}
  }
  if(!ok)return;I.left=I.total;incidents.push(I);renderInc();radio('AOCC',I.title+'.');
}
function closeRw(r,secs,why){r.closedUntil=Math.max(r.closedUntil,T+secs);r.why=why;for(const f of flights){if(f.state==='approach'&&f.rwy===r&&f.td-T>25)goAround(f,why.toLowerCase());}renderRw();}
function resolve(I,ok,msg){const k=incidents.indexOf(I);if(k<0)return;incidents.splice(k,1);if(ok){S.incOk++;if(msg)logE(msg);}renderInc();if(popInc===I)closePop();}
function closeIncFor(f){for(const I of incidents.slice())if(I.f===f)resolve(I,true,'');}
function incPos(I){if(I.f)return{x:I.f.x,y:I.f.y};return{x:I.x,y:I.y};}
function incTick(dt){for(const I of incidents.slice()){if(I.f&&['gone','diverted','towed'].includes(I.f.state)){resolve(I,true,'');continue;}I.left-=dt;if(I.left<=0){incidents.splice(incidents.indexOf(I),1);S.incFail++;if(I.timeout)I.timeout();logE(`Missed: ${I.title}.`,'miss');renderInc();if(popInc===I)closePop();}}}
let incClock=0;
function incSpawner(dt){
  for(const s of LV.script)if(!s.done&&T>=s[0]){s.done=true;spawnInc(s[1]);}
  incClock+=dt;if(incClock<60)return;incClock=0;
  if(SIMR()<LV.incRate){const pool=['fod','birds','medical','breakdown'];if(LV.n>=2)pool.push('birds');spawnInc(pool[Math.floor(SIMR()*pool.length)]);}
}
function renderInc(){
  $('#incCount').textContent=`${incidents.length} open`;
  $('#incList').innerHTML=incidents.map(I=>{const ic=ICON[I.type];return `<div class="inc" data-id="${I.id}"><div class="ic" style="background:${ic.c}">${ic.g}</div><h4 data-find="${I.id}">${I.title}</h4><p>${I.text}</p><div class="acts">${I.acts.map((a,i)=>`<button data-i="${i}" class="${a.pri?'pri':''}" ${a.dis&&a.dis()?'disabled':''}>${a.l}</button>`).join('')}</div><div class="tm"><span>${Math.ceil(I.left)} s</span><i style="width:${clamp(I.left/I.total*120,0,120)}px"></i></div></div>`;}).join('');
}
$('#incList').addEventListener('click',e=>{const row=e.target.closest('.inc');if(!row)return;const I=incidents.find(i=>i.id===+row.dataset.id);if(!I)return;const b=e.target.closest('button[data-i]');if(b&&!b.disabled){I.acts[+b.dataset.i].fn();return;}if(e.target.closest('[data-find]')){const p=incPos(I);centerOn(p.x,p.y);}});
function incTimers(){document.querySelectorAll('#incList .inc').forEach(row=>{const I=incidents.find(i=>i.id===+row.dataset.id);if(!I)return;row.querySelector('.tm span').textContent=Math.ceil(I.left)+' s';row.querySelector('.tm i').style.width=clamp(I.left/I.total*120,0,120)+'px';row.querySelectorAll('button[data-i]').forEach(b=>{const a=I.acts[+b.dataset.i];b.disabled=!!(a.dis&&a.dis());});});}

/* ============ popover ============ */
let popInc=null,popRw=null,popF=null;
function closePop(){$('#pop').hidden=true;popInc=null;popRw=null;popF=null;selRw=null;renderRw();}
$('#popX').onclick=closePop;
function placePop(sx,sy){const p=$('#pop');p.hidden=false;const w=272,h=p.offsetHeight||140;let x=sx+18,y=sy-20;const r=cam.region||{L:0,R:VW,Tp:0,B:VH};if(x+w>r.R)x=sx-w-18;if(y+h>r.B)y=r.B-h-4;if(y<r.Tp)y=r.Tp+4;p.style.left=x+'px';p.style.top=y+'px';}
function openIncPop(I){popInc=I;popRw=null;popF=null;const ic=ICON[I.type];$('#popBody').innerHTML=`<h4><span style="color:${ic.c}">●</span> ${I.title}</h4><p>${I.text}</p><div class="acts">${I.acts.map((a,i)=>`<button data-i="${i}" class="${a.pri?'pri':''}" ${a.dis&&a.dis()?'disabled':''}>${a.l}</button>`).join('')}</div>`;$('#popBody').querySelectorAll('button[data-i]').forEach(b=>b.onclick=()=>{I.acts[+b.dataset.i].fn();closePop();});const p=incPos(I);placePop(sx(p.x),sy(p.y));}
function openRwPop(r,mx,my){popRw=r;popInc=null;popF=null;selRw=r;$('#popBody').innerHTML=`<h4>Runway ${r.name}</h4><p>${r.len.toLocaleString('en-IN')} m${r===LONGEST?' · the long runway':''}. What should it do? ${term('modes','Modes')}</p>${segHtml(r)}`;$('#popBody').querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{setMode(r,b.dataset.m);openRwPop(r,mx,my);});placePop(mx,my);renderRw();}
function openFlightPop(f,mx,my){popF=f;popInc=null;popRw=null;selected=f;renderFlightPop();placePop(mx,my);}
function renderFlightPop(){const f=popF;if(!f)return;const st=stateText(f);let dl=`<dt>Aircraft</dt><dd>${f.T.name}</dd><dt>Route</dt><dd>${f.kind==='dep'?`→ ${f.toCode} ${f.to}`:`${f.fromCode} ${f.from} →`}${f.intl?' · intl':''}</dd><dt>Status</dt><dd>${st}</dd>`;
  if(f.kind==='dep'){const l=mins(T-f.std);dl+=`<dt>Departs</dt><dd class="mono">${clk(f.std)} ${l>0?`<span style="color:var(--stop)">+${l}m</span>`:''}</dd>`;if(f.links)dl+=`<dt>Connecting</dt><dd>${f.links.reduce((s,l)=>s+l.n,0)} passengers from ${f.links.length} flights</dd>`;}
  else{dl+=`<dt>Lands</dt><dd class="mono">${clk(f.eta)}${f.state==='holding'?` · <span style="color:var(--warn)">${Math.round(f.endurance)}m fuel</span>`:''}</dd>`;if(f.turnLinks||f.turn)dl+=`<dt>Next</dt><dd>${f.turn?`${f.al} ${f.turn.num} at ${clk(f.turn.std)}`:'Night stop'}</dd>`;}
  $('#popBody').innerHTML=`<h4 style="display:flex;gap:8px;align-items:center"><i style="width:5px;height:18px;background:${f.A.tail};border-radius:2px;display:inline-block"></i>${fl(f)} <span style="font-size:12px;color:var(--ink-3);font-family:var(--f-body);font-weight:400">${f.A.name}</span></h4><dl>${dl}</dl><div class="acts"><button id="fpPrio" class="${f.prio?'pri':''}" ${['holding','inbound','at_gate','taxi_out','hp'].includes(f.state)?'':'disabled'}>${f.prio?'Prioritised':'Prioritise'}</button>${f.kind==='dep'&&f.state==='at_gate'?`<button id="fpHold">${f.held?'Release':'Hold at gate'}</button>`:''}</div>`;
  const p=$('#fpPrio');if(p)p.onclick=()=>{f.prio=!f.prio;renderFlightPop();};const h=$('#fpHold');if(h)h.onclick=()=>{f.held=!f.held;renderFlightPop();};}
function stateText(f){const m={sched:'On the ground at origin',inbound:'Inbound',holding:`Holding at ${7+(f.level||0)},000 ft`,approach:`Final for ${f.rwy?f.rwy.short:''}`,rollout:'Landing',taxi_in:'Taxiing to gate '+(f.res?f.res.id:''),dock:'Parking',parked:'Parked, no onward flight',nogate:'Waiting for a gate',tow:'Towed to long-stay parking',push:'Pushing back',start:'Starting engines',taxi_out:f.noRwy?'No departure runway open':`Taxiing to ${f.rwy?f.rwy.short:''}`,hp:`Holding short of ${f.rwy?f.rwy.short:''}`,lineup:'Lining up',roll:'Taking off',goaround:'Going around',divert:'Diverting',stuck:'Stopped on the taxiway'};
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
function resize(){DPR=Math.min(window.devicePixelRatio||1,2);VW=cv.clientWidth;VH=cv.clientHeight;cv.width=Math.round(VW*DPR);cv.height=Math.round(VH*DPR);const wr=wcv.getBoundingClientRect();wcv.width=Math.round(wr.width*DPR);wcv.height=Math.round(wr.height*DPR);fitCam();placeToast();}
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
    const col=r.locked?null:T<r.closedUntil?'rgba(255,77,63,.35)':T<r.changeUntil?'rgba(255,174,59,.28)':r.mode==='ARR'?'rgba(138,124,255,.26)':r.mode==='DEP'?'rgba(47,211,198,.24)':r.mode==='MIX'?'rgba(244,196,48,.24)':'rgba(0,0,0,.35)';
    if(col){ctx.fillStyle=col;ctx.fillRect(r.x0,r.y-w/2-8,r.len,w+16);}
    if(r===selRw){ctx.strokeStyle='#f4c430';ctx.lineWidth=3*px;ctx.strokeRect(r.x0-20,r.y-w/2-24,r.len+40,w+48);}
    if(T<r.closedUntil&&z>1){ctx.fillStyle='rgba(255,255,255,.95)';for(const ss of[0.2,0.5,0.8]){const x=lerp(r.x0,r.x1,ss);ctx.save();ctx.translate(x,r.y);for(const a of[Math.PI/4,-Math.PI/4]){ctx.save();ctx.rotate(a);ctx.fillRect(-32,-4,64,8);ctx.restore();}ctx.restore();}}
  }
  // apm
  if(SPEC.apm&&SPEC.apm.pts){ctx.strokeStyle='rgba(106,163,255,.55)';ctx.lineWidth=Math.max(10,2.2*px);ctx.setLineDash([60,40]);ctx.beginPath();SPEC.apm.pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();ctx.setLineDash([]);}
  // buildings
  for(const b of BLD){if(!b.p)continue;ctx.fillStyle=b.kind==='processor'?'#dcd6c8':b.kind==='tower'?'#c9cfd4':b.kind==='fire'?'#b8423a':b.kind==='cargo'?'#9c958a':b.kind==='mro'?'#a9a49a':b.kind==='fuel'?'#9a978e':b.kind==='rail'?'#7f8790':'#b8b2a6';ctx.fill(b.p);ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=2*px;ctx.stroke(b.p);}
  for(const c of CONC){if(!c.path)continue;const open=c.open!==false;ctx.fillStyle=open?'#e4dfd2':'#8b877f';ctx.fill(c.path);ctx.strokeStyle=open?'rgba(120,100,60,.45)':'rgba(0,0,0,.3)';ctx.lineWidth=3*px;ctx.stroke(c.path);}
  if(PROC&&PROC.outline){}
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
let rwSigns=[];
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
  // dust storm
  if(dustNow){ctx.fillStyle='rgba(170,120,70,.32)';ctx.fillRect(0,0,VW,VH);ctx.fillStyle='rgba(220,180,130,.45)';for(const p of dustP){const x=((p.x*VW-now*220*p.v)%VW+VW)%VW,y=p.y*VH;ctx.fillRect(x,y,p.s*6,p.s);}}
  if(LV&&LV.light==='heat'){const a=0.06+0.03*Math.sin(now*2);ctx.fillStyle=`rgba(255,220,170,${a})`;ctx.fillRect(0,0,VW,VH);}
  // runway signs
  rwSigns=[];for(const r of RW){const lbl=r.locked?'NOT YET OPEN':T<r.closedUntil?`CLOSED · ${r.why.toUpperCase()}`:T<r.changeUntil?`CHANGEOVER → ${r.mode}`:r.mode==='ARR'?'ARRIVALS':r.mode==='DEP'?'DEPARTURES':r.mode==='MIX'?'MIXED':'CLOSED';const col=r.locked?'#6f7a80':T<r.closedUntil?'#ff4d3f':r.mode==='ARR'?'#8a7cff':r.mode==='DEP'?'#2fd3c6':r.mode==='MIX'?'#f4c430':'#a6afb4';
    const X=sx(r.x0+r.len*0.18),Y=sy(r.y)-Math.max(14,r.width*cam.s/2+12);const rect=signText(X,Y,`${r.short} · ${lbl}`,r.locked?.6:1,col);rect.r=r;rwSigns.push(rect);}
  // incident markers
  for(const I of incidents){const p=incPos(I);const X=sx(p.x),Y=sy(p.y);const ic=ICON[I.type];const pulse=1+0.18*Math.sin(now*7);const R=13*pulse;
    ctx.fillStyle='rgba(0,0,0,.55)';ctx.beginPath();ctx.arc(X,Y,R+5,0,7);ctx.fill();ctx.strokeStyle=ic.c;ctx.lineWidth=3;ctx.beginPath();ctx.arc(X,Y,R+3,-Math.PI/2,-Math.PI/2+2*Math.PI*clamp(I.left/I.total,0,1));ctx.stroke();
    ctx.fillStyle=ic.c;ctx.beginPath();ctx.arc(X,Y,R-2,0,7);ctx.fill();ctx.fillStyle='#0b0b0b';ctx.font='700 15px Barlow Condensed, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(ic.g,X,Y+1);ctx.textAlign='left';ctx.textBaseline='alphabetic';I.sx=X;I.sy=Y;}
  // tags
  const tagged=new Set();if(selected)tagged.add(selected);if(hover)tagged.add(hover);
  if(z>3.2){let n=0;for(const f of vis){if(n>30)break;if(['approach','rollout','taxi_in','taxi_out','hp','lineup','roll','nogate'].includes(f.state)&&f.sx>0&&f.sx<VW&&f.sy>0&&f.sy<VH){tagged.add(f);n++;}}}
  for(const f of tagged)if(vis.includes(f))drawTag(f);
  if(popInc){const p=incPos(popInc);placePop(sx(p.x),sy(p.y));}
}

/* ============ bank chart ============ */
function capNow(kind){let c=0;for(const r of RW){if(r.locked||T<r.closedUntil)continue;if(kind==='arr'){if(r.mode==='ARR')c+=3600/(SEP_AA*sepF()+6);else if(r.mode==='MIX')c+=3600/(SEP_AA*sepF()+MIX_GAP+6)*1;}else{if(r.mode==='DEP')c+=3600/(SEP_DD*(dustNow?1.15:1)+4);else if(r.mode==='MIX')c+=3600/(SEP_AA*sepF()+MIX_GAP+6);}}return c;}
function drawWave(){
  const W=wcv.width/DPR,H=wcv.height/DPR;if(!W)return;wctx.setTransform(DPR,0,0,DPR,0,0);wctx.clearRect(0,0,W,H);
  const B=300,t0=Math.floor((T-1200)/B)*B,t1=t0+B*20;const nb=(t1-t0)/B;const bw=(W-40)/nb;const X=t=>36+(t-t0)/(t1-t0)*(W-40);const mid=H/2;
  const A=new Array(nb).fill(0),D=new Array(nb).fill(0),Aa=new Array(nb).fill(0),Da=new Array(nb).fill(0);
  for(const f of flights){
    if(f.landT!=null){const i=Math.floor((f.landT-t0)/B);if(i>=0&&i<nb)Aa[i]++;}
    else if(f.kind==='arr'&&!['diverted','divert'].includes(f.state)){const t=Math.max(f.eta,T);const i=Math.floor((t-t0)/B);if(i>=0&&i<nb)A[i]++;}
    if(f.rollT!=null&&(f.state==='roll'||f.state==='gone')){const i=Math.floor((f.rollT-t0)/B);if(i>=0&&i<nb)Da[i]++;}
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
    if(i===cur){wctx.fillStyle='#0b0b0b';wctx.textAlign='center';if(va*sc>mid-2){wctx.fillRect(x,2,w,13);wctx.fillStyle='#b8adff';wctx.fillText(va+' due now',x+w/2,9);}if(vd*sc>mid-2){wctx.fillStyle='#0b0b0b';wctx.fillRect(x,H-15,w,13);wctx.fillStyle='#7ff0e6';wctx.fillText(vd+' due now',x+w/2,H-8);}wctx.textAlign='left';}}
  wctx.strokeStyle='rgba(255,255,255,.18)';wctx.beginPath();wctx.moveTo(36,mid);wctx.lineTo(W-4,mid);wctx.stroke();
  // capacity lines from now on
  const ca=capNow('arr')*B/3600*sc,cd=capNow('dep')*B/3600*sc;const xn=X(T);
  wctx.setLineDash([5,4]);wctx.lineWidth=2;wctx.strokeStyle='#b8adff';wctx.beginPath();wctx.moveTo(xn,mid-ca);wctx.lineTo(W-4,mid-ca);wctx.stroke();wctx.strokeStyle='#7ff0e6';wctx.beginPath();wctx.moveTo(xn,mid+cd);wctx.lineTo(W-4,mid+cd);wctx.stroke();wctx.setLineDash([]);wctx.lineWidth=1;
  wctx.strokeStyle='#f4c430';wctx.lineWidth=1.5;wctx.beginPath();wctx.moveTo(xn,2);wctx.lineTo(xn,H-2);wctx.stroke();wctx.lineWidth=1;
  wctx.fillStyle='#6f7a80';for(let t=Math.ceil(t0/900)*900;t<t1;t+=900){const x=X(t);wctx.fillText(clk(t),x+2,H-6);}
  if(LV&&T0C+LEN){const xe=X(LEN);if(xe<W){wctx.fillStyle='rgba(255,255,255,.06)';wctx.fillRect(xe,0,W-xe,H);wctx.fillStyle='#6f7a80';wctx.fillText('END',xe+3,10);}}
  wctx.fillStyle='#8a7cff';wctx.fillText('ARR',2,12);wctx.fillStyle='#2fd3c6';wctx.fillText('DEP',2,H-12);
  const hold=flights.filter(f=>f.state==='holding').length,q=flights.filter(f=>f.state==='hp').length,taxi=flights.filter(f=>f.state==='taxi_out').length;
  $('#wCounts').innerHTML=`<span style="color:${hold>8?'var(--stop)':hold>3?'var(--warn)':'var(--ink-2)'}">${hold} holding</span> · <span style="color:${q>14?'var(--stop)':q>6?'var(--warn)':'var(--ink-2)'}">${q} queued to depart</span> · ${taxi} taxiing out · capacity ${Math.round(capNow('arr'))}↓ ${Math.round(capNow('dep'))}↑ per hr`;
}

/* ============ runway desk ============ */
function segHtml(r){return `<div class="seg" role="group" aria-label="Mode for runway ${r.short}">${['ARR','DEP','MIX','OFF'].map(m=>`<button data-m="${m}" class="${r.mode===m?'on':''}" ${r.locked?'disabled':''}>${m}</button>`).join('')}</div>`;}
function renderRw(){
  $('#rwRows').innerHTML=RW.map(r=>`<div class="rw ${r.locked?'locked':''} ${r===selRw?'sel':''}" data-r="${r.id}"><div class="nm">${r.short}<small>${(r.len/1000).toFixed(1)} km${r===LONGEST?' · long':''}</small></div>${segHtml(r)}<div class="st"></div></div>`).join('');
  $('#rwRows').querySelectorAll('.rw').forEach(row=>{const r=RW.find(x=>x.id===row.dataset.r);row.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{setMode(r,b.dataset.m);explain('modes');});});
  rwStatus();
}
function rwStatus(){
  let a=0,d=0,m=0;RW.forEach(r=>{if(r.locked)return;if(r.mode==='ARR')a++;if(r.mode==='DEP')d++;if(r.mode==='MIX')m++;});$('#rwSum').textContent=`ARR ${a} · DEP ${d}${m?` · MIX ${m}`:''}`;
  document.querySelectorAll('#rwRows .rw').forEach(row=>{const r=RW.find(x=>x.id===row.dataset.r);const st=row.querySelector('.st');if(r.locked){st.textContent='Opens in a later level';return;}
    const fin=flights.filter(f=>f.state==='approach'&&f.rwy===r).length,q=flights.filter(f=>(f.state==='hp')&&f.rwy===r).length;
    let s='';if(T<r.closedUntil)s=`<span class="bad">closed ${Math.ceil((r.closedUntil-T)/60)} min · ${r.why}</span>`;else if(T<r.changeUntil)s=`<span class="hot">changeover ${Math.ceil((r.changeUntil-T)/60)} min</span>`;else s=`<b>${fin}</b> on final · <b class="${q>6?'hot':''}">${q}</b> queued · ${r.ops} ops`;st.innerHTML=s;});
}

/* ============ HUD ============ */
function kpi(id,txt,cls){const el=$(id);el.querySelector('.v').innerHTML=txt;el.className='kpi '+(cls||'');}
function hud(){
  $('#clock').textContent=clk(T);$('#left').textContent=ended?'Level over':`${Math.max(0,Math.ceil((LEN-T)/60))} min left`;
  while(moveLog.length&&moveLog[0]<T-1800)moveLog.shift();
  const rate=Math.round(moveLog.length*2);
  kpi('#kMov',`${S.moves}<small>/${LV.target}</small>`,S.moves>=LV.target?'good':'');
  kpi('#kRate',`${rate}`,'');
  const otp=S.dep?Math.round(S.depOnTime/S.dep*100):null;kpi('#kOtp',otp==null?'—':otp+'%',otp==null?'':otp>=80?'good':otp>=65?'mid':'bad');
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
  incSpawner(dt);
  if(T>=LEN&&!ended)finish();
}
const onceSet=new Set();function once(k,fn){if(onceSet.has(k))return;onceSet.add(k);fn();}

/* ============ input ============ */
let drag=null;
cv.addEventListener('pointerdown',e=>{camT.x=cam.x;camT.y=cam.y;camT.s=cam.s;camT.anchor=null;drag={x:e.clientX,y:e.clientY,cx:cam.x,cy:cam.y,moved:false};cv.setPointerCapture(e.pointerId);});
cv.addEventListener('pointermove',e=>{const r=cv.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4){drag.moved=true;cv.classList.add('drag');}if(drag.moved){camT.x=drag.cx-dx/camT.s;camT.y=drag.cy-dy/camT.s;clampCam(camT);cam.x=camT.x;cam.y=camT.y;}}else{hover=pick(mx,my);cv.classList.toggle('point',!!(hover||pickInc(mx,my)||pickRw(mx,my)));}});
cv.addEventListener('pointerup',e=>{const r=cv.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;if(drag&&!drag.moved&&running){const I=pickInc(mx,my);if(I)openIncPop(I);else{const f=pick(mx,my);if(f)openFlightPop(f,mx,my);else{const rw=pickRw(mx,my);if(rw)openRwPop(rw,mx,my);else{closePop();selected=null;}}}}drag=null;cv.classList.remove('drag');});
cv.addEventListener('wheel',e=>{e.preventDefault();const r=cv.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;const line=e.deltaMode===1;const mw=line||(e.deltaX===0&&Math.abs(e.deltaY)>=40&&Math.abs(e.deltaY)%1===0);if(e.ctrlKey||e.metaKey)zoomAt(mx,my,Math.exp(-e.deltaY*0.012));else if(mw)zoomAt(mx,my,Math.exp(-(line?e.deltaY*33:e.deltaY)*0.0016));else{camT.anchor=null;camT.x+=e.deltaX/camT.s;camT.y+=e.deltaY/camT.s;clampCam(camT);}},{passive:false});
$('#zIn').onclick=()=>zoomCenter(1.6);$('#zOut').onclick=()=>zoomCenter(1/1.6);$('#zFit').onclick=()=>fitCam();
function pick(mx,my){let best=null,bd=1e9;for(const f of flights){if(f.sx==null||['sched','diverted','gone','cancelled','towed'].includes(f.state))continue;const d=Math.hypot(f.sx-mx,f.sy-my);const lim=Math.max(9,f.sr||0);if(d<lim&&d<bd){bd=d;best=f;}}return best;}
function pickInc(mx,my){for(const I of incidents)if(I.sx!=null&&Math.hypot(I.sx-mx,I.sy-my)<20)return I;return null;}
function pickRw(mx,my){for(const s of rwSigns)if(mx>=s.x&&mx<=s.x+s.w&&my>=s.y-3&&my<=s.y+s.h+3)return s.r;const wx=mx/cam.s+cam.x,wy=my/cam.s+cam.y;for(const r of RW){if(wx>=r.x0&&wx<=r.x1&&Math.abs(wy-r.y)<Math.max(r.width/2+10,10/cam.s))return r;}return null;}
document.querySelectorAll('.speeds button').forEach(b=>b.onclick=()=>setSpeed(+b.dataset.s));
function setSpeed(s){if(!running)return;if(s===0)paused=!paused;else{speed=s;paused=false;}document.querySelectorAll('.speeds button').forEach(b=>{const v=+b.dataset.s;b.classList.toggle('on',v===0?paused:(!paused&&v===speed));});$('#spP').textContent=paused?'Resume':'Pause';}
window.addEventListener('keydown',e=>{if(e.key===' '&&!(e.target.closest&&e.target.closest('button'))){e.preventDefault();setSpeed(0);}if(e.key==='1')setSpeed(1);if(e.key==='2')setSpeed(2);if(e.key==='3')setSpeed(4);if(e.key==='Escape')closePop();if(e.key==='+'||e.key==='=')zoomCenter(1.6);if(e.key==='-')zoomCenter(1/1.6);if(e.key==='f')fitCam();});

/* ============ levels: start and finish ============ */
function stars(L,s){let n=0;const otp=s.dep?s.depOnTime/s.dep*100:0,ct=s.cnxMade+s.cnxMiss,cx=ct?s.cnxMade/ct*100:100;if(s.safety>=70)n=1;if(n>=1&&s.moves>=L.target&&otp>=65&&cx>=80)n=2;if(n>=2&&otp>=87&&cx>=90&&s.safety>=90)n=3;return n;}
function starStr(n){return '<b>'+'★'.repeat(n)+'</b>'+'★'.repeat(3-n);}
function startLevel(n){
  LV=Object.assign({},LEVELS[n-1]);LV.script=LV.script.map(s=>s.slice());T0C=+LV.clock.split(':')[0]*3600+ +LV.clock.split(':')[1]*60;
  resetState();onceSet.clear();
  // which runways and concourses open
  RW.forEach(r=>{r.locked=true;r.mode='OFF';if(LV.rwOpen[r.id]){r.locked=false;r.mode=LV.rwOpen[r.id];}});
  const openC=new Set(CONC.filter(c=>LV.concs.includes(c.id[0])).map(c=>c.id));CONC.forEach(c=>c.open=openC.has(c.id));GATES.forEach(g=>{g.open=g.remote||openC.has(g.conc);g.zone=g.zone0||(g.zone0=g.zone);});
  T=-30;buildLevel(LV);
  // warm start: put the first inbound arrivals in the air
  $('#lvCode').textContent=`LEVEL ${LV.n} · ${LV.from}`;$('#lvName').textContent=LV.name;
  renderRw();renderInc();$('#coachList').innerHTML='';coachItems.length=0;seen.clear();
  $('#overlay').hidden=true;running=true;paused=false;ended=false;speed=1;setSpeed(1);resize();
  for(let i=0;i<30;i++)tick(1);
  explain('hub');setTimeout(()=>{if(running&&LV.n===1)explain('bank');},9000);
  radio('AOCC',`Level ${LV.n}: ${LV.name}. ${LV.blurb}`);
}
function finish(){
  ended=true;paused=true;closePop();
  const left=flights.filter(f=>f.kind==='dep'&&['at_gate','taxi_out','hp','push','start','stuck'].includes(f.state)&&T>f.std+1500).length;
  for(const f of flights)if(f.links&&f.kind==='dep'&&f.state==='at_gate'&&T>f.std){for(const l of f.links){if(l.arr.inBlock!=null&&l.arr.inBlock+l.x<=T)S.cnxMade+=l.n;else S.cnxMiss+=l.n;}}
  const st=stars(LV,S);const best=store.get('zm_stars')||{};if((best[LV.n]||0)<st){best[LV.n]=st;store.set('zm_stars',best);}
  const otp=S.dep?Math.round(S.depOnTime/S.dep*100):0,ct=S.cnxMade+S.cnxMiss,cx=ct?Math.round(S.cnxMade/ct*100):100;
  const verdict=st===3?'Flawless. The hub never noticed it was under pressure.':st===2?'Good shift. The waves came through and the hub kept its promises.':st===1?'The hub survived, but passengers will remember this one.':'Safety fell below 70. A real hub would stop operations and investigate.';
  const why=[];if(S.moves<LV.target)why.push(`Movements ${S.moves} of ${LV.target}: runways sat idle or were set for the wrong wave.`);if(otp<80)why.push(`On time ${otp}%: watch the departures bars on the bank chart and hand runways to departures before the wave peaks.`);if(cx<90)why.push(`Connections ${cx}%: arrivals that hold in the stack miss their onward flights. Give arrivals runways before the arrival wave, not during it.`);if(S.incFail)why.push(`${S.incFail} incident${S.incFail>1?'s':''} timed out.`);
  const next=LEVELS[LV.n];
  $('#sheet').innerHTML=`<div class="band"><span>Level ${LV.n} · ${LV.name}</span><span>${clk(0)} to ${clk(LEN)}</span></div><div class="in">
   <div class="bigstars">${starStr(st)}</div><h1 style="margin-top:8px">${st?'Level complete':'Level failed'}</h1><p>${verdict}</p>
   <div class="score"><div><div class="k">Movements</div><div class="v">${S.moves}/${LV.target}</div></div><div><div class="k">On time</div><div class="v">${otp}%</div></div><div><div class="k">Connections</div><div class="v">${cx}%</div></div><div><div class="k">Safety</div><div class="v">${Math.round(S.safety)}</div></div><div><div class="k">Incidents</div><div class="v">${S.incOk}/${S.incOk+S.incFail}</div></div><div><div class="k">Runway flips</div><div class="v">${S.flips}</div></div></div>
   <p class="src">Stars: one for keeping safety at 70 or above. Two for reaching the movement target with 65% on time and 80% of connections. Three for 87% on time, 90% of connections and safety 90.</p>
   ${why.length?`<h2>Where the stars went</h2><ul>${why.map(w=>`<li>${w}</li>`).join('')}</ul>`:''}
   <h2>What happened</h2><ul>${S.log.slice(-10).map(l=>`<li><span class="mono">${l.t}</span> ${l.text}</li>`).join('')||'<li>A quiet shift.</li>'}</ul>
   <button class="go" id="again">Replay level ${LV.n}</button> ${next?`<button class="go" id="nextL">Level ${next.n}: ${next.name}</button>`:''} <button class="go ghost" id="toMenu">All levels</button></div>`;
  $('#overlay').hidden=false;$('#again').onclick=()=>startLevel(LV.n);if(next)$('#nextL').onclick=()=>startLevel(next.n);$('#toMenu').onclick=()=>menu('levels');
  window.__hubResult={level:LV.n,stars:st,moves:S.moves,target:LV.target,otp,cx,safety:S.safety,incOk:S.incOk,incFail:S.incFail,flips:S.flips,div:S.div};
}
function menu(tab){
  running=false;const best=store.get('zm_stars')||{};
  const planSvg=document.getElementById('planTpl').innerHTML;
  const D=window.__DESIGN||{};
  const lv=LEVELS.map(L=>`<button class="lc" data-n="${L.n}"><span class="n">LEVEL ${L.n} · ${L.from}</span><h3>${L.name}</h3><p>${L.blurb}</p><span class="meta">${L.clock} · ${L.rw} runways · ~${L.arr+L.dep} movements an hour</span><span class="stars">${starStr(best[L.n]||0)}</span></button>`).join('');
  $('#sheet').innerHTML=`<div class="band"><span>${SPEC.name} · ${SPEC.code}</span><span>Nagpur, Maharashtra</span></div><div class="in">
   <div class="tabs2" role="tablist"><button data-t="levels" class="${tab!=='plan'?'on':''}">Play</button><button data-t="plan" class="${tab==='plan'?'on':''}">The airport</button></div>
   <div id="tLevels" ${tab==='plan'?'hidden':''}>
    <h1>Run the busiest airport ever built</h1>
    <p>Delhi, Mumbai, Bengaluru and Hyderabad now fly from one hub at India's geographic centre: about 3,630 movements and 209 million passengers a year's worth of traffic, 1.7 times Atlanta. The airlines move in one city at a time. Each level adds a city and runways, and the waves get taller.</p>
    <div class="levels">${lv}</div>
    <h2>How to play</h2>
    <ul>
     <li><b>The bank chart</b> at the bottom is your radar for the next hour. Purple bars are arrivals due, teal bars are departures due, dashed lines are what your runways can handle. When the bars poke above the line, you are about to fall behind.</li>
     <li><b>The runway desk</b> (or click a runway on the map) sets each runway to ARR, DEP, MIX or OFF. A switch takes 2 minutes. Move runways to arrivals before an arrival bank, then to departures before the departure bank.</li>
     <li><b>Incidents</b> pop up on the map with a countdown ring. Click the icon to deal with it. If the ring runs out, it goes wrong.</li>
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
}
window.HUB={get T(){return T;},get S(){return S;},get LV(){return LV;},flights:()=>flights,RW,incidents:()=>incidents,setMode:(id,m)=>{const r=RW.find(x=>x.id===id||x.short===id);if(r)setMode(r,m);},startLevel,capNow,resolveAll:()=>{for(const I of incidents.slice()){const a=I.acts.find(a=>!(a.dis&&a.dis()));if(a)a.fn();}},speed:s=>setSpeed(s)};

/* ============ boot ============ */
buildTerrain();resize();
let last=performance.now(),hudT=0;
function frame(ms){
  requestAnimationFrame(frame);
  if(cv.clientWidth&&(cv.clientWidth!==VW||cv.clientHeight!==VH))resize();
  const dtR=Math.min(0.1,(ms-last)/1000);last=ms;camEase(dtR);
  if(running&&!paused&&!ended){let d=dtR*BASE*speed;try{while(d>0){const st=Math.min(1,d);tick(st);d-=st;}}catch(err){console.error(err);}incTick(dtR);if(toastTimer>0){toastTimer-=dtR;if(toastTimer<=0&&!$('#toast').matches(':hover'))$('#toast').hidden=true;}}
  try{draw(ms/1000);}catch(err){console.error(err);}
  hudT+=dtR;if(hudT>0.25&&LV){hudT=0;try{hud();}catch(err){console.error(err);}try{drawWave();}catch(err){console.error(err);}}
}
// idle preview: show level 4's layout behind the menu
LV=LEVELS[3];RW.forEach(r=>{r.locked=false;r.mode=r.role==='arr'?'ARR':r.role==='dep'?'DEP':'MIX';});resetState();
menu('levels');
requestAnimationFrame(frame);
})();
