/* ============ 3D view: the same sim, drawn in Three.js ============ */
// The sim above stays the source of truth; this file only draws it. Three.js loads as an ES module from a pinned CDN
// build. If it can't load (offline, no WebGL), the game stays on the 2D map. M toggles the map, C cycles cameras.
// Modules in 3d/*.js register a builder in Z3MOD; each builder gets the shared context Z and returns {update(dt,now)}.
// World to 3D: x east -> X, y south -> Z, altitude -> Y, 1 unit = 1 m.
const Z3MOD={};
const THREE_URL='https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const V3={ready:false,failed:false,loading:false,on:false,want:store.get('zm_view')!=='2d',mode:'map',waiters:[],fps:60,frames:0,fpsT:0};
const AIR_K=0.55;   // sim altitude units to metres: a 700-unit final over 7.45 km is a 3 degree glide path
function altM(f){return f.alt>2?f.alt*AIR_K:0;}
const Z={THREE:null,scene:null,camera:null,renderer:null,SPEC,mods:{},kEx:1,camDist:9000,quality:1,sunDir:null,
  get T(){return T;},get LV(){return LV;},get nightF(){return nightF;},get dustNow(){return dustNow;},get heatNow(){return heatNow;},
  get selected(){return selected;},get running(){return running;},
  flights:()=>flights,incidents:()=>incidents,ops:()=>ops,RW,GATES,CONC,TYPES,AL,EXT,STACKS,procC,G,BLD,
  terrain:()=>TERR,altM,clk:t=>clk(t),stackPos:(st,u,l)=>stackPos(st,u,l),LONGEST,
  canArr:r=>canArr(r),canDep:r=>canDep(r),blockAt:(r,t)=>blockAt(r,t),CHANGE,OPSW,
  terrainBounds:{x0:TX0,y0:TY0,w:TW,h:TH},
};
// cameras: map (orbit, the default), tower (the cab), follow (a clicked aircraft), approach (rides an arrival down)
const C3={tx:-700,ty:0,dist:10500,yaw:0,pitch:0.92,t:{tx:-700,ty:0,dist:10500,yaw:0,pitch:0.92},
  tower:{yaw:Math.PI,pitch:-0.07,fov:48},follow:null,fpos:null,flook:null,apT:0};
const CAM_MODES=['map','tower','follow','approach'];
const CAM_NAMES={map:'Strategic view',tower:'Tower cab',follow:'Follow',approach:'Approach cam'};

function init3D(){
  if(V3.ready||V3.failed||V3.loading)return;V3.loading=true;
  import(THREE_URL).then(THREE=>{
    Z.THREE=THREE;
    const gl=document.createElement('canvas');gl.id='gl';gl.setAttribute('aria-hidden','true');$('#app').insertBefore(gl,cv);
    const renderer=new THREE.WebGLRenderer({canvas:gl,antialias:true,powerPreference:'high-performance',alpha:false});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(42,1,4,160000);
    Object.assign(Z,{renderer,scene,camera});
    // sky dome: horizon to zenith gradient with a sun glow
    const skyU={top:{value:new THREE.Color('#2b5d9a')},hor:{value:new THREE.Color('#bcd2e6')},sunDir:{value:new THREE.Vector3(0,1,0)},sunCol:{value:new THREE.Color('#fff2d8')},glow:{value:1}};
    const sky=new THREE.Mesh(new THREE.SphereGeometry(140000,32,16),new THREE.ShaderMaterial({uniforms:skyU,side:THREE.BackSide,depthWrite:false,fog:false,
      vertexShader:'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform vec3 top,hor,sunCol,sunDir;uniform float glow;varying vec3 vD;void main(){float h=max(vD.y,0.);vec3 c=mix(hor,top,pow(h,.55));float s=max(dot(vD,normalize(sunDir)),0.);c+=sunCol*(pow(s,600.)*4.+pow(s,24.)*.35*glow+pow(s,4.)*.12*glow);if(vD.y<0.)c=mix(hor,hor*.7,min(-vD.y*8.,1.));gl_FragColor=vec4(c,1.);}'}));
    sky.renderOrder=-1;sky.frustumCulled=false;scene.add(sky);
    const hemi=new THREE.HemisphereLight(0xcfe3ff,0x5d7a45,0.9);scene.add(hemi);
    const sun=new THREE.DirectionalLight(0xffffff,2.6);sun.castShadow=true;const sm=renderer.capabilities.maxTextureSize>=8192?4096:2048;sun.shadow.mapSize.set(sm,sm);sun.shadow.bias=-0.00025;sun.shadow.normalBias=0.8;sun.shadow.radius=2;
    const sc=sun.shadow.camera;sc.near=10;sc.far=30000;scene.add(sun);scene.add(sun.target);
    scene.fog=new THREE.Fog(0xbcd2e6,12000,60000);
    Object.assign(V3,{sky,skyU,hemi,sun});Z.sunDir=new THREE.Vector3(0,1,0);Z.sun=sun;Z.hemi=hemi;
    // guides: glowing ribbons for the next two arrivals per runway (no spaghetti), and the holding racetracks
    const gmat=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.9,depthWrite:false,fog:false});
    const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6000*3),3));gg.setAttribute('color',new THREE.BufferAttribute(new Float32Array(6000*3),3));
    V3.guides=new THREE.LineSegments(gg,gmat);V3.guides.frustumCulled=false;V3.guides.renderOrder=5;scene.add(V3.guides);
    V3.ray=new THREE.Raycaster();V3.v=new THREE.Vector3();V3.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    for(const k of ['field','terminal','aircraft']){if(!Z3MOD[k])continue;try{Z.mods[k]=Z3MOD[k](Z)||{};}catch(err){console.error('3D module '+k+' failed to build',err);}}
    for(const k of Object.keys(Z3MOD))if(!Z.mods[k]&&!['field','terminal','aircraft'].includes(k)){try{Z.mods[k]=Z3MOD[k](Z)||{};}catch(err){console.error('3D module '+k,err);}}
    V3.ready=true;V3.loading=false;addViewButtons();setView(V3.want?'3d':'2d',true);
    V3.waiters.splice(0).forEach(w=>w(true));
  }).catch(err=>{V3.failed=true;V3.loading=false;console.warn('3D view unavailable, staying on the 2D map:',err&&err.message);V3.waiters.splice(0).forEach(w=>w(false));});
}
function addViewButtons(){
  const z=$('#zoomBox');if($('#zView'))return;
  z.insertAdjacentHTML('beforeend','<button id="zView" title="Switch between the 3D view and the 2D map (M)">2D</button><button id="zCam" title="Change camera: strategic, tower cab, follow, approach (C)">Cam</button>');
  $('#zView').onclick=()=>setView(V3.on?'2d':'3d');$('#zCam').onclick=()=>cycleCam();
  const lb=document.createElement('div');lb.id='camLbl';lb.className='hud';$('#app').appendChild(lb);
}
function setView(v,quiet){
  if(v==='3d'&&!V3.ready){V3.want=true;init3D();return;}
  V3.on=v==='3d'&&V3.ready;V3.want=v==='3d';store.set('zm_view',V3.want?'3d':'2d');
  const gl=$('#gl');if(gl)gl.style.display=V3.on?'block':'none';
  document.body.classList.toggle('v3',V3.on);
  if($('#zView'))$('#zView').textContent=V3.on?'2D':'3D';if($('#zCam'))$('#zCam').disabled=!V3.on;
  if(V3.on){resize3D();if(!quiet)radio('AOCC','3D view. Drag to pan, right-drag to orbit, C for cameras, M for the map.');}
  camLabel();
}
function camLabel(){const l=$('#camLbl');if(!l)return;const f=C3.follow;l.hidden=!V3.on||V3.mode==='map';l.textContent=`${CAM_NAMES[V3.mode]}${f&&(V3.mode==='follow'||V3.mode==='approach')?' · '+fl(f):''} · C to change`;}
function cycleCam(){if(!V3.on)return;let i=(CAM_MODES.indexOf(V3.mode)+1)%CAM_MODES.length;setCam(CAM_MODES[i]);}
function setCam(m,f){
  V3.mode=m;C3.fpos=null;
  if(m==='follow'){C3.follow=f||selected||pickBusy(['roll','lineup','approach','taxi_out','taxi_in','climb']);if(!C3.follow){V3.mode='map';}}
  if(m==='approach'){C3.follow=nextArrival();C3.apT=0;if(!C3.follow)V3.mode='map';}
  camLabel();
}
function pickBusy(states){return flights.find(f=>states.includes(f.state))||null;}
function nextArrival(){let best=null,bt=1e9;for(const f of flights){if(f.state!=='approach')continue;const left=f.td-T;if(left>45&&left<bt){bt=left;best=f;}}return best||flights.find(f=>f.state==='approach')||null;}
function resize3D(){if(!Z.renderer||!VW)return;Z.renderer.setSize(VW,VH,false);Z.camera.aspect=VW/Math.max(1,VH);Z.camera.updateProjectionMatrix();}

// solar position for Nagpur (21.15 N, 79.09 E) in late May, from the sim clock (IST)
function solar(secOfDay){
  const lat=21.15*D2R,dec=21.3*D2R;const solarH=(secOfDay/3600)-(82.5-79.09)/15;const ha=(solarH-12)*15*D2R;
  const el=Math.asin(Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(ha));
  let az=Math.acos(clamp((Math.sin(dec)-Math.sin(el)*Math.sin(lat))/(Math.cos(el)*Math.cos(lat)),-1,1));if(ha>0)az=2*Math.PI-az;
  return{el,az};
}
const tmpC=[];function col(h){return(tmpC[h]=tmpC[h]||new Z.THREE.Color(h));}
function lightRig(){
  const THREE=Z.THREE;if(!LV)return;
  nightF=LV.light==='dusk'?clamp((T-600)/2400,0,1):LV.light==='dawn'?clamp(0.6-T/1500,0,0.6):0;
  // daytime only: the sun keeps a mid-morning angle on every level (a 14:00 afternoon sun in the heat level)
  const {el,az}=solar(((LV.light==='heat'?14*3600:10*3600)+T*0.25)%86400);const e=el/D2R;
  const d=new THREE.Vector3(Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el));Z.sunDir.copy(d);
  const day=clamp((e+4)/14,0,1),warm=1-clamp((e-2)/25,0,1);
  const sunC=new THREE.Color().lerpColors(col('#fff6e8'),col('#ff9a52'),warm*0.85);
  // after sunset a moon takes over the key light, and twilight keeps the sky bright for a while (civil twilight):
  // the airport must stay readable at night, it's a game
  const tw=clamp((e+9)/13,0,1),moon=clamp((-1-e)/5,0,1);
  if(moon>0){const ma=140*D2R,me=48*D2R;V3.keyDir=new THREE.Vector3(Math.sin(ma)*Math.cos(me),Math.sin(me),-Math.cos(ma)*Math.cos(me));}else V3.keyDir=d;
  V3.sun.color.copy(sunC).lerp(col('#a9bde8'),moon);V3.sun.intensity=Math.max(3.1*day*(LV.light==='heat'?1.15:1),0.75*moon)*(dustNow?0.45:1);
  const top=new THREE.Color().lerpColors(col('#0a1226'),LV.light==='heat'?col('#6f95bd'):col('#2f64a3'),day);
  const hor=new THREE.Color().lerpColors(col('#1b2238'),LV.light==='heat'?col('#efe6d2'):col('#c9d9e6'),day);
  if(warm>0.2&&day>0.02)hor.lerp(col('#f2a46b'),warm*0.55*Math.min(1,day*3));
  if(e<2&&e>-10){const tw=1-Math.abs(e+3)/9;hor.lerp(col('#e58a5c'),clamp(tw,0,1)*0.55);}
  if(dustNow){hor.lerp(col('#b88a5c'),0.75);top.lerp(col('#8a6a4a'),0.6);}
  V3.skyU.top.value.copy(top);V3.skyU.hor.value.copy(hor);V3.skyU.sunDir.value.copy(d);V3.skyU.sunCol.value.copy(sunC);V3.skyU.glow.value=day*(dustNow?0.4:1);
  V3.hemi.color.lerpColors(col('#6a80b4'),col('#cfe3ff'),tw);V3.hemi.groundColor.lerpColors(col('#2e3f2a'),col('#5f7d46'),tw);V3.hemi.intensity=1.15-0.15*tw;
  Z.renderer.toneMappingExposure=LV.light==='heat'?1.2:1.0+0.4*(1-day);
  const fogC=hor.clone();const near=V3.mode==='map'?C3.dist*1.4:2500,far=V3.mode==='map'?C3.dist*5+22000:38000;
  Z.scene.fog.color.copy(fogC);Z.scene.fog.near=dustNow?250:LV.light==='heat'?near*0.6:near;Z.scene.fog.far=dustNow?4200:LV.light==='heat'?far*0.7:far;
}

function camUpdate(dt){
  const THREE=Z.THREE,cam=Z.camera,k=1-Math.exp(-dt*9);
  let focus=null;
  if(V3.mode!=='map'&&V3.mode!=='tower'){const f=C3.follow;if(!f||['gone','diverted','towed','cancelled','sched'].includes(f.state)){if(V3.mode==='approach'){C3.follow=nextArrival();if(!C3.follow)setCam('map');}else setCam('map');camLabel();}}
  if(V3.mode==='map'){
    if(!running){C3.t.yaw+=dt*0.035;C3.t.dist=Math.max(C3.t.dist,8000);}
    const ke=C3.intro>0?1-Math.exp(-dt*1.6):k;if(C3.intro>0)C3.intro-=dt;
    for(const key of ['tx','ty','dist','yaw','pitch'])C3[key]+=(C3.t[key]-C3[key])*ke;
    const cp=Math.cos(C3.pitch);cam.position.set(C3.tx+Math.sin(C3.yaw)*cp*C3.dist,Math.sin(C3.pitch)*C3.dist,C3.ty+Math.cos(C3.yaw)*cp*C3.dist);
    cam.fov+=(42-cam.fov)*k;cam.lookAt(C3.tx,0,C3.ty);Z.kEx=clamp(C3.dist/2600,1,3.4);Z.camDist=C3.dist;focus=[C3.tx,C3.ty];
  }else if(V3.mode==='tower'){
    const t=C3.tower;cam.position.set(1000,92,0);cam.fov+=(t.fov-cam.fov)*k;
    cam.lookAt(1000+Math.cos(t.yaw)*Math.cos(t.pitch)*1000,92+Math.sin(t.pitch)*1000,Math.sin(t.yaw)*Math.cos(t.pitch)*1000);Z.kEx=1;Z.camDist=2500;focus=[1000-1400,0];
  }else{
    const f=C3.follow;if(f){const h=f.heading,a=altM(f),span=f.T.span;const air=a>5;
      const back=V3.mode==='approach'?span*1.7+38:span*(air?2.3:2.0)+28,up=V3.mode==='approach'?span*0.32+7:span*(air?0.5:0.42)+6,side=V3.mode==='approach'?span*0.55:span*0.15;
      const want=new THREE.Vector3(f.x-Math.cos(h)*back-Math.sin(h)*side,a+up,f.y-Math.sin(h)*back+Math.cos(h)*side);
      const look=new THREE.Vector3(f.x+Math.cos(h)*span*1.5,a+span*0.12,f.y+Math.sin(h)*span*1.5);
      if(!C3.fpos){C3.fpos=want.clone();C3.flook=look.clone();}
      const kk=1-Math.exp(-dt*(V3.mode==='approach'?4:3));C3.fpos.lerp(want,kk);C3.flook.lerp(look,Math.min(1,kk*1.6));
      if(C3.fpos.y<3)C3.fpos.y=3;cam.position.copy(C3.fpos);cam.lookAt(C3.flook);cam.fov+=(V3.mode==='approach'?38:46-cam.fov)*0+((V3.mode==='approach'?38:46)-cam.fov)*k;
      Z.kEx=1;Z.camDist=back;focus=[f.x,f.y];
      if(V3.mode==='approach'&&f.landT!=null){C3.apT+=dt;if(C3.apT>9){const n=nextArrival();if(n&&n!==f){C3.follow=n;C3.fpos=null;C3.apT=0;camLabel();}}}
    }
  }
  cam.updateProjectionMatrix();
  // shadows cover the area around the focus, sized to the view
  if(focus){const s=clamp(Z.camDist*(V3.mode==='map'?0.38:0.6),350,3800),sh=V3.sun.shadow.camera;sh.left=-s;sh.right=s;sh.top=s;sh.bottom=-s;sh.updateProjectionMatrix();
    const kd=V3.keyDir||Z.sunDir;V3.sun.target.position.set(focus[0],0,focus[1]);V3.sun.position.set(focus[0]+kd.x*12000,Math.max(300,kd.y*12000),focus[1]+kd.z*12000);V3.sun.castShadow=kd.y>0.03;}
}

// screen <-> world
function proj(x,y,h){const v=V3.v.set(x,h||0,y).project(Z.camera);if(v.z>1||v.z<-1)return null;return{X:(v.x+1)/2*VW,Y:(1-v.y)/2*VH,z:v.z};}
function groundAt(mx,my){const THREE=Z.THREE;V3.ray.setFromCamera(new THREE.Vector2(mx/VW*2-1,-(my/VH)*2+1),Z.camera);const p=new THREE.Vector3();return V3.ray.ray.intersectPlane(V3.plane,p)?{x:p.x,y:p.z}:null;}
function project3D(){
  const cam=Z.camera,fovK=VH/(2*Math.tan(cam.fov*D2R/2));
  for(const f of flights){if(['sched','diverted','gone','cancelled','towed'].includes(f.state)){f.sx=null;continue;}
    const a=altM(f),p=proj(f.x,f.y,a);if(!p){f.sx=null;continue;}f.sx=p.X;f.sy=p.Y;
    const d=Math.hypot(cam.position.x-f.x,cam.position.y-a,cam.position.z-f.y);f.sr=Math.max(5,f.T.span*Z.kEx*0.5*fovK/Math.max(1,d));}
}

// controls (called from the 2D canvas's pointer and wheel handlers)
function cam3Drag(dx,dy,orbit){
  if(V3.mode==='tower'){C3.tower.yaw-=dx*0.003*(C3.tower.fov/48);C3.tower.pitch=clamp(C3.tower.pitch+dy*0.002,-0.6,0.4);return;}
  if(V3.mode!=='map')setCam('map');
  if(orbit){C3.t.yaw-=dx*0.005;C3.t.pitch=clamp(C3.t.pitch+dy*0.004,0.18,1.52);return;}
  const upp=C3.t.dist*2*Math.tan(Z.camera.fov*D2R/2)/Math.max(1,VH)/Math.max(0.35,Math.sin(C3.t.pitch));
  const rx=Math.cos(C3.t.yaw),rz=-Math.sin(C3.t.yaw),fx=-Math.sin(C3.t.yaw),fz=-Math.cos(C3.t.yaw);
  C3.t.tx-=rx*dx*upp;C3.t.ty-=rz*dx*upp;C3.t.tx+=fx*dy*upp*Math.sin(C3.t.pitch);C3.t.ty+=fz*dy*upp*Math.sin(C3.t.pitch);clampC3();
  Object.assign(C3,{tx:C3.t.tx,ty:C3.t.ty});
}
function cam3Zoom(f,mx,my){
  if(V3.mode==='tower'){C3.tower.fov=clamp(C3.tower.fov*f,10,70);return;}
  if(V3.mode!=='map')setCam('map');
  const nd=clamp(C3.t.dist*f,220,30000),g=mx!=null?groundAt(mx,my):null;
  if(g&&f<1){const k=1-nd/C3.t.dist;C3.t.tx+=(g.x-C3.t.tx)*k;C3.t.ty+=(g.y-C3.t.ty)*k;}
  C3.t.dist=nd;clampC3();
}
function clampC3(){C3.t.tx=clamp(C3.t.tx,EXT.x0-6000,EXT.x1+9000);C3.t.ty=clamp(C3.t.ty,EXT.y0-4000,EXT.y1+4000);}
function cam3Intro(){if(!V3.ready)return;setCam('map');Object.assign(C3,{tx:-1500,ty:2500,dist:24000,yaw:C3.yaw%(2*Math.PI)-0.9,pitch:0.42});Object.assign(C3.t,{tx:-700,ty:0,dist:10500,yaw:0,pitch:0.92});C3.intro=3.2;}
function cam3Fit(){setCam('map');Object.assign(C3.t,{tx:-700,ty:0,dist:10500,yaw:0,pitch:0.92});}

// the overlay: incident markers, runway signs, stack signs, tags and MAYDAY beacons, drawn on the 2D canvas
function drawOverlay3D(now){
  screenT();ctx.clearRect(0,0,VW,VH);
  for(const st of STACKS){const n=flights.filter(f=>f.state==='holding'&&f.stack===st);if(!n.length)continue;const p=proj(st.x,st.y,2600*AIR_K);if(p)signText(p.X,p.Y-40,`STACK ${st.id} · ${n.length}`,0.95,n.some(f=>f.minFuel)?'#ff4d3f':'#f4c430');}
  rwSigns=[];for(const r of RW){const p=proj(r.x0+r.len*0.18,r.y,0);if(!p)continue;const s=rwSign(r);const rect=signText(p.X,p.Y-16,`${r.short} · ${s.lbl}`,r.locked?.6:1,s.col);rect.r=r;rwSigns.push(rect);}
  for(const f of flights){if(!f.mayday||f.landT!=null||f.sx==null)continue;const X=f.sx,Y=f.sy,pp=(now*1.4)%1;ctx.strokeStyle=`rgba(255,77,63,${1-pp})`;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(X,Y,10+pp*28,0,7);ctx.stroke();signText(X,Y-30,`MAYDAY ${fl(f)}`,1,'#ff4d3f');}
  for(const I of incidents){const q=incPos(I);const p=proj(q.x,q.y,I.f?altM(I.f):0);if(!p){I.sx=null;continue;}const X=p.X,Y=p.Y-(I.f?0:14);const ic=ICON[I.type];const pulse=1+0.18*Math.sin(now*7);const R=13*pulse;
    ctx.fillStyle='rgba(0,0,0,.55)';ctx.beginPath();ctx.arc(X,Y,R+5,0,7);ctx.fill();ctx.strokeStyle=ic.c;ctx.lineWidth=3;ctx.beginPath();ctx.arc(X,Y,R+3,-Math.PI/2,-Math.PI/2+2*Math.PI*clamp(I.left/I.total,0,1));ctx.stroke();
    ctx.fillStyle=ic.c;ctx.beginPath();ctx.arc(X,Y,R-2,0,7);ctx.fill();ctx.fillStyle='#0b0b0b';ctx.font='700 15px Barlow Condensed, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(ic.g,X,Y+1);ctx.textAlign='left';ctx.textBaseline='alphabetic';I.sx=X;I.sy=Y;}
  const tagged=new Set();if(selected)tagged.add(selected);if(hover)tagged.add(hover);
  if(V3.mode==='map'&&Z.camDist<2200){const cp=Z.camera.position,cand=[];for(const f of flights){if(f.sx!=null&&['approach','rollout','lineup','roll','nogate','climb','hp'].includes(f.state)&&f.sx>40&&f.sx<VW-40&&f.sy>40&&f.sy<VH-40)cand.push([Math.hypot(cp.x-f.x,cp.z-f.y),f]);}
    cand.sort((a,b)=>a[0]-b[0]);for(const c of cand.slice(0,6))tagged.add(c[1]);}
  for(const f of tagged)if(f.sx!=null)drawTag(f);
  if(selected&&selected.sx!=null){ctx.strokeStyle='#f4c430';ctx.lineWidth=2;ctx.beginPath();ctx.arc(selected.sx,selected.sy,Math.max(10,selected.sr+5),0,7);ctx.stroke();}
  if(dustNow){ctx.fillStyle='rgba(220,180,130,.35)';for(const p of dustP){const x=((p.x*VW-now*260*p.v)%VW+VW)%VW,y=p.y*VH;ctx.fillRect(x,y,p.s*7,p.s);}}
  if(popInc){const q=incPos(popInc);const p=proj(q.x,q.y,popInc.f?altM(popInc.f):0);if(p)placePop(p.X,p.Y);}
  drawFloats(q=>proj(q.x,q.y,q.alt*AIR_K+40));
}

function guides3D(now){
  const g=V3.guides.geometry,P=g.attributes.position.array,Cc=g.attributes.color.array;let n=0;const cap=P.length/3-2;
  const seg=(x1,y1,h1,x2,y2,h2,r,gc,b)=>{if(n>=cap)return;P.set([x1,h1,y1,x2,h2,y2],n*3);Cc.set([r,gc,b,r,gc,b],n*3);n+=2;};
  const pulse=0.75+0.25*Math.sin(now*3);
  for(const r of RW){if(r.locked)continue;const q=flights.filter(f=>f.state==='approach'&&f.rwy===r).sort((a,b)=>a.td-b.td).slice(0,2);
    q.forEach((f,qi)=>{const path=f.path;if(!path)return;const k=qi?0.45:1;let d=f.pd,prev=null;const L=f.plen,step=Math.max(120,(L-d)/40);
      for(;d<=L+1;d+=step){const pt=pointAt(path,Math.min(d,L));const fr=d>=f.finalStart?(d-f.finalStart)/f.finalLen:0;const a=(d>=f.finalStart?Math.max(0,700*(1-fr/0.96)):lerp(f.startAlt||1500,700,clamp(d/Math.max(1,f.finalStart),0,1)))*AIR_K;
        if(prev)seg(prev[0],prev[1],prev[2],pt.x,pt.y,a,0.54*k*pulse,0.49*k*pulse,1*k*pulse);prev=[pt.x,pt.y,a];}});}
  for(const st of STACKS){const busy=flights.some(f=>f.state==='holding'&&f.stack===st);if(!busy)continue;const P0=4*1100+2*Math.PI*560;let prev=null;
    for(let u=0;u<=P0+1;u+=P0/48){const p=stackPos(st,u,0);const a=2100*AIR_K;if(prev&&((u/(P0/48))|0)%2===0)seg(prev.x,prev.y,a,p.x,p.y,a,0.95,0.78,0.2);prev=p;}}
  g.setDrawRange(0,n);g.attributes.position.needsUpdate=true;g.attributes.color.needsUpdate=true;
}
// quality: if the frame rate sags, drop the pixel ratio, then shadows
function quality3D(){if(!V3.qT)V3.qT=0;if(V3.fps<42&&++V3.qT>3){V3.qT=0;const pr=Z.renderer.getPixelRatio();if(pr>1){Z.renderer.setPixelRatio(Math.max(1,pr-0.5));resize3D();}else if(Z.renderer.shadowMap.enabled){Z.renderer.shadowMap.enabled=false;Z.scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});}}else if(V3.fps>=42)V3.qT=0;}
function draw3D(now,dtR){
  if(!Z.renderer)return;const t0=performance.now();
  if(Z.renderer.domElement.width!==Math.round(VW*Z.renderer.getPixelRatio()))resize3D();
  lightRig();camUpdate(dtR);
  for(const k in Z.mods){const m=Z.mods[k];if(m&&m.update){try{m.update(dtR,now);}catch(err){console.error('3D '+k,err);m.update=null;}}}
  guides3D(now);
  Z.renderer.render(Z.scene,Z.camera);
  project3D();drawOverlay3D(now);V3.cpu=(V3.cpu||0)*0.9+(performance.now()-t0)*0.1;
  V3.frames++;V3.fpsT+=dtR;if(V3.fpsT>1){V3.fps=V3.frames/V3.fpsT;V3.frames=0;V3.fpsT=0;if(!navigator.webdriver)quality3D();}
}
