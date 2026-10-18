/* ============ 3D view: the same sim, drawn in Three.js ============ */
// The sim above stays the source of truth; this file only draws it. Three.js loads as an ES module through the import map
// in the page head (pinned CDN build), with the addons (physical sky, post-processing). If the addons can't load the view
// renders without post-processing; if three itself can't load (offline, no WebGL), the game stays on the 2D map.
// M toggles the map, C cycles cameras, G cycles render quality (High / Medium / Low).
// Modules in 3d/*.js register a builder in Z3MOD; each builder gets the shared context Z and returns {update(dt,now)}.
// World to 3D: x east -> X, y south -> Z, altitude -> Y, 1 unit = 1 m.
//
// Frame order: lightRig (sun, resets Z.atmo to clear-day values) -> camera -> module updates (weather writes Z.atmo)
// -> atmoApply (fog, sun, sky, grade read Z.atmo) -> environment map (only when the sky changed) -> render.
// Post chain: scene into a 4x MSAA half-float target -> GTAO (half res) -> bloom mips -> grade + tone map + sRGB.
const Z3MOD={};
const THREE_URL='https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const V3={ready:false,failed:false,loading:false,on:false,qn:0,warm:0,want:store.get('zm_view')!=='2d',mode:'map',waiters:[],fps:60,frames:0,fpsT:0,tier:0,tierMsg:0};
const AIR_K=0.55;   // sim altitude units to metres: a 700-unit final over 7.45 km is a 3 degree glide path
function altM(f){return f.alt>2?f.alt*AIR_K:0;}
const Z={THREE:null,scene:null,camera:null,renderer:null,SPEC,mods:{},kEx:1,camDist:9000,quality:2,tier:'High',sunDir:null,addons:{},atmo:null,
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
// render quality tiers; frame-time trouble drops AO first, then bloom, then pixel ratio (then shadows, as a last resort)
const TIERS=[{name:'High',ao:true,bloom:true,pr:1.5},{name:'Medium',ao:false,bloom:true,pr:1.5},{name:'Low',ao:false,bloom:false,pr:1}];
// height haze: fog density is base * (1 + HAZE_K * exp(-height / HAZE_H)); the sky gets the same haze toward the horizon
const HAZE_K=0.5,HAZE_H=400;
const ENV_K=0.5;   // sky light scale in the environment map (keeps a ~3:1 sun to sky ratio, so shadows read)

function init3D(){
  if(V3.ready||V3.failed||V3.loading)return;V3.loading=true;
  const ADD=[['Sky','objects/Sky.js'],['EffectComposer','postprocessing/EffectComposer.js'],['RenderPass','postprocessing/RenderPass.js'],
    ['ShaderPass','postprocessing/ShaderPass.js'],['UnrealBloomPass','postprocessing/UnrealBloomPass.js'],['OutputPass','postprocessing/OutputPass.js'],
    ['GTAOPass','postprocessing/GTAOPass.js'],['FXAAShader','shaders/FXAAShader.js']];
  import('three').catch(()=>import(THREE_URL)).then(THREE=>
    Promise.allSettled(ADD.map(([k,p])=>import('three/addons/'+p).then(m=>[k,m[k]]))).then(rs=>{
      const ad={};for(const r of rs)if(r.status==='fulfilled'&&r.value[1])ad[r.value[0]]=r.value[1];
      if(Object.keys(ad).length<ADD.length)console.warn('3D: some addons did not load',ADD.map(a=>a[0]).filter(k=>!ad[k]));
      build3D(THREE,ad);
    })
  ).catch(err=>{V3.failed=true;V3.loading=false;console.warn('3D view unavailable, staying on the 2D map:',err&&err.message);V3.waiters.splice(0).forEach(w=>w(false));});
}
function build3D(THREE,ad){
  Z.THREE=THREE;Z.addons=ad;
  const usePost=!!(ad.EffectComposer&&ad.RenderPass&&ad.ShaderPass);
  const gl=document.createElement('canvas');gl.id='gl';gl.setAttribute('aria-hidden','true');$('#app').insertBefore(gl,cv);
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas:gl,antialias:!usePost,powerPreference:'high-performance',alpha:false,stencil:false});}
  catch(err){gl.remove();throw err;}
  const st=store.get('zm_q');V3.tier=Math.max(0,TIERS.findIndex(t=>t.name===st));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,usePost?TIERS[V3.tier].pr:1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;   // one shadow render per frame, even with extra passes
  renderer.info.autoReset=false;
  const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(42,1,4,160000);
  Object.assign(Z,{renderer,scene,camera});
  installFogChunks(THREE);
  // the atmosphere every module shares (weather.js writes it each frame, the core resets what it doesn't write)
  Z.atmo={fogColor:new THREE.Color('#c6d3de'),fogDensity:0.000035,hazeHeight:HAZE_H,skyTint:new THREE.Color('#c6d3de'),skyTintK:0,
    sunDim:1,sunTint:new THREE.Color(1,1,1),ambientK:1,grade:{exposure:1,contrast:1,saturation:1,warmth:0,vignette:0,grain:0},
    bloom:1,lightning:0,wind:{dir:0,speed:4,gust:0},visibility:50000};
  V3.atmoDef={fogColor:new THREE.Color('#c6d3de'),fogDensity:0.000035};
  // fog: FogExp2 (density from Z.atmo), plus legacy near/far for shaders written against linear fog
  const fog=new THREE.FogExp2(0xc6d3de,0.000035);fog.near=7000;fog.far=45000;scene.fog=fog;
  // sky: Preetham scattering (addons Sky) with a dust tint, horizon haze and a pale disc for storms; old gradient dome as a fallback
  let sky,skyU;
  if(ad.Sky){
    sky=new ad.Sky();sky.scale.setScalar(10000);skyU=sky.material.uniforms;
    Object.assign(skyU,{skyGain:{value:1},tintCol:{value:new THREE.Color()},tintK:{value:0},fogCol:{value:new THREE.Color()},fogDens:{value:0.000035},
      hazeH:{value:HAZE_H},groundCol:{value:new THREE.Color()},envMode:{value:0},discK:{value:1},paleK:{value:0},sunTintC:{value:new THREE.Color()},flash:{value:0}});
    const fs=sky.material.fragmentShader;
    sky.material.fragmentShader=fs.replace('uniform vec3 up;','uniform vec3 up;\nuniform float skyGain,tintK,fogDens,hazeH,envMode,discK,paleK,flash;uniform vec3 tintCol,fogCol,groundCol,sunTintC;')
      .replace(/float sundisk = ([^;]+);/,'float sundisk = $1 * discK;')
      .replace('gl_FragColor = vec4( retColor, 1.0 );',`retColor *= skyGain;
        float dyS = direction.y, yyS = max( dyS, 0.0 );
        vec3 tinted = tintCol * ( 1.1 - 0.3 * clamp( dyS * 1.6, 0.0, 1.0 ) ) + tintCol * sunTintC * pow( max( cosTheta, 0.0 ), 6.0 ) * 0.45;
        retColor = mix( retColor, tinted, tintK );
        float DhS = 22000.0 / ( 1.0 + 16.0 * yyS );
        float odS = ( fogDens * DhS ) * ( fogDens * DhS ) + fogDens * ${HAZE_K.toFixed(2)} / ( 1.0 + fogDens * 6000.0 ) * hazeH / max( yyS, hazeH / DhS );
        retColor = mix( retColor, fogCol, 1.0 - exp( - odS ) );
        if ( dyS < 0.0 ) retColor = mix( retColor, envMode > 0.5 ? groundCol : fogCol, smoothstep( 0.0, 0.05, - dyS ) );
        retColor += sunTintC * paleK * smoothstep( 0.99925, 0.9996, cosTheta );
        retColor *= 1.0 + flash * 2.5;
        gl_FragColor = vec4( retColor, 1.0 );`);
    sky.material.depthTest=false;V3.skyKind='preetham';
  }else{
    skyU={top:{value:new THREE.Color('#2b5d9a')},hor:{value:new THREE.Color('#bcd2e6')},sunDir:{value:new THREE.Vector3(0,1,0)},sunCol:{value:new THREE.Color('#fff2d8')},glow:{value:1}};
    sky=new THREE.Mesh(new THREE.SphereGeometry(140000,32,16),new THREE.ShaderMaterial({uniforms:skyU,side:THREE.BackSide,depthWrite:false,fog:false,
      vertexShader:'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform vec3 top,hor,sunCol,sunDir;uniform float glow;varying vec3 vD;void main(){float h=max(vD.y,0.);vec3 c=mix(hor,top,pow(h,.55));float s=max(dot(vD,normalize(sunDir)),0.);c+=sunCol*(pow(s,600.)*4.+pow(s,24.)*.35*glow+pow(s,4.)*.12*glow);if(vD.y<0.)c=mix(hor,hor*.7,min(-vD.y*8.,1.));gl_FragColor=vec4(c,1.);}'}));
    V3.skyKind='dome';
  }
  sky.renderOrder=-1000;sky.frustumCulled=false;scene.add(sky);   // first of all (the field paints ground layers from renderOrder -40)
  const hemi=new THREE.HemisphereLight(0xcfe3ff,0x5d7a45,0.9);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffffff,2.6);sun.castShadow=true;const sm=renderer.capabilities.maxTextureSize>=8192?4096:2048;sun.shadow.mapSize.set(sm,sm);sun.shadow.bias=-0.0002;sun.shadow.normalBias=0.6;sun.shadow.radius=2;
  const sc=sun.shadow.camera;sc.near=1;sc.far=30000;scene.add(sun);scene.add(sun.target);
  Object.assign(V3,{sky,skyU,hemi,sun,fog,sunC:new THREE.Color('#fff4e2'),sunBase:3,heat:false,hemiBase:1,expBase:1,shR:new THREE.Vector3(),shU:new THREE.Vector3(),shD:null,
    tv:new THREE.Vector3(),tv2:new THREE.Vector3(),tv3:new THREE.Vector3(),tc:new THREE.Color(),envKey:null,envT:-9});
  Z.sunDir=new THREE.Vector3(0.45,0.75,-0.48).normalize();V3.keyDir=Z.sunDir;Z.sun=sun;Z.hemi=hemi;
  // image-based lighting: the sky (with a ground below the horizon) rendered into a PMREM cube, refreshed only when it changes
  if(V3.skyKind==='preetham'){try{V3.pmrem=new THREE.PMREMGenerator(renderer);V3.envScene=new THREE.Scene();const es=new THREE.Mesh(sky.geometry,sky.material);es.scale.setScalar(50);es.frustumCulled=false;V3.envScene.add(es);}catch(err){console.warn('3D: no environment map',err);V3.pmrem=null;}}
  // guides: glowing ribbons for the next two arrivals per runway (no spaghetti), and the holding racetracks
  const gmat=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.9,depthWrite:false,fog:false});
  const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6000*3),3));gg.setAttribute('color',new THREE.BufferAttribute(new Float32Array(6000*3),3));
  V3.guides=new THREE.LineSegments(gg,gmat);V3.guides.frustumCulled=false;V3.guides.renderOrder=5;scene.add(V3.guides);
  V3.ray=new THREE.Raycaster();V3.v=new THREE.Vector3();V3.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  if(usePost){try{buildPost(THREE,ad);}catch(err){console.warn('3D: post-processing unavailable, rendering directly',err);V3.comp=null;}}
  for(const k of ['field','terminal','aircraft']){if(!Z3MOD[k])continue;try{Z.mods[k]=Z3MOD[k](Z)||{};}catch(err){console.error('3D module '+k+' failed to build',err);}}
  for(const k of Object.keys(Z3MOD))if(!Z.mods[k]&&!['field','terminal','aircraft'].includes(k)){try{Z.mods[k]=Z3MOD[k](Z)||{};}catch(err){console.error('3D module '+k,err);}}
  window.addEventListener('keydown',e=>{if((e.key==='g'||e.key==='G')&&V3.on&&!e.metaKey&&!e.ctrlKey&&!(e.target.closest&&e.target.closest('input,textarea,select')))setTier((V3.tier+1)%TIERS.length,false,true);});
  V3.ready=true;V3.loading=false;addViewButtons();setTier(V3.tier,true);setView(V3.want?'3d':'2d',true);
  V3.waiters.splice(0).forEach(w=>w(true));
}

// fog for every built-in material: exponential-squared distance fog plus a height haze integrated along the view ray
function installFogChunks(THREE){
  const S=THREE.ShaderChunk;
  S.fog_pars_vertex='#ifdef USE_FOG\n\tvarying float vFogDepth;\n\tvarying vec3 vFogOff;\n#endif';
  S.fog_vertex='#ifdef USE_FOG\n\tvFogDepth = - mvPosition.z;\n\t{ mat3 fogR = mat3( viewMatrix ); vFogOff = vec3( dot( fogR[ 0 ], mvPosition.xyz ), dot( fogR[ 1 ], mvPosition.xyz ), dot( fogR[ 2 ], mvPosition.xyz ) ); }\n#endif';
  S.fog_pars_fragment='#ifdef USE_FOG\n\tuniform vec3 fogColor;\n\tvarying float vFogDepth;\n\tvarying vec3 vFogOff;\n\t#ifdef FOG_EXP2\n\t\tuniform float fogDensity;\n\t#else\n\t\tuniform float fogNear;\n\t\tuniform float fogFar;\n\t#endif\n#endif';
  S.fog_fragment=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogD = length( vFogOff );
		float fogH0 = max( cameraPosition.y, 0.0 ), fogH1 = max( cameraPosition.y + vFogOff.y, 0.0 );
		float fogT = ( fogH1 - fogH0 ) * ${(1/HAZE_H).toExponential(6)};
		float fogE0 = exp( - fogH0 * ${(1/HAZE_H).toExponential(6)} );
		float fogI = abs( fogT ) > 1e-4 ? ( fogE0 - exp( - fogH1 * ${(1/HAZE_H).toExponential(6)} ) ) / fogT : fogE0;
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * fogD * fogD - fogDensity * ${HAZE_K.toFixed(3)} / ( 1.0 + fogDensity * 6000.0 ) * fogD * fogI );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
}

// post-processing: MSAA HDR scene -> GTAO -> bloom (mips only) -> one grade/tone-map/output pass (bloom added there)
function buildPost(THREE,ad){
  const R=Z.renderer,isGL2=R.capabilities.isWebGL2;
  const rt=new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType,stencilBuffer:false});
  const comp=new ad.EffectComposer(R,rt);comp.renderTarget2.samples=isGL2?4:0;   // only the scene target is multisampled
  V3.rtMS=comp.renderTarget2;
  const rp=new ad.RenderPass(Z.scene,Z.camera);comp.addPass(rp);
  // take the render counters right after the scene (stats3d reports scene + shadow work; post passes are reported apart)
  const rpr=rp.render.bind(rp);rp.render=(...a)=>{rpr(...a);const i=R.info.render;V3.sceneCalls=i.calls;V3.sceneTris=i.triangles;};
  if(ad.GTAOPass){try{
    const ao=new ad.GTAOPass(Z.scene,Z.camera,4,4);ao.output=ad.GTAOPass.OUTPUT.Default;ao.blendIntensity=1.0;
    ao.updateGtaoMaterial({radius:6,distanceExponent:1.6,thickness:14,scale:1,samples:12,distanceFallOff:1});
    ao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:6,rings:2,samples:12});
    const ss=ao.setSize.bind(ao);ao.setSize=(w,h)=>ss(Math.max(4,Math.round(w*0.5)),Math.max(4,Math.round(h*0.5)));   // AO at half resolution
    // the AO g-buffer holds only solid surfaces: no sky, lines, points, decals or see-through effects (dust sheets, glass)
    ao.overrideVisibility=function(){const c=this._visibilityCache,sky=V3.sky;this.scene.traverse(o=>{c.set(o,o.visible);const m=o.material;
      if(o.isPoints||o.isLine||o.isSprite||o===sky||(m&&!Array.isArray(m)&&(m.transparent||!m.depthWrite||!m.colorWrite||m.side===THREE.BackSide||(m.blending!==THREE.NormalBlending&&m.blending!==THREE.NoBlending))))o.visible=false;});};
    comp.addPass(ao);V3.ao=ao;}catch(err){console.warn('3D: no AO',err);V3.ao=null;}}
  if(ad.UnrealBloomPass){
    const bl=new ad.UnrealBloomPass(new THREE.Vector2(256,256),0.35,0.55,1.0);bl.needsSwap=false;
    // clamp what feeds the blur: one overflowing pixel (Inf in half float) would otherwise smear black blocks across the mips
    const hp=bl.materialHighPassFilter;hp.fragmentShader=hp.fragmentShader.replace('vec4 texel = texture2D( tDiffuse, vUv );','vec4 texel = texture2D( tDiffuse, vUv ); texel = vec4( clamp( texel.rgb, 0.0, 48.0 ), 1.0 ); if ( !( texel.r < 1e5 && texel.g < 1e5 && texel.b < 1e5 ) ) texel = vec4( 0.0 );');
    // bloom keeps its result in its own mip target; the grade pass adds it (no blending into the multisampled scene target)
    bl.render=function(renderer,writeBuffer,readBuffer){
      const oc=this._oldClearColor;renderer.getClearColor(oc);const oa=renderer.getClearAlpha(),ac=renderer.autoClear;renderer.autoClear=false;renderer.setClearColor(this.clearColor,0);
      this.highPassUniforms.tDiffuse.value=readBuffer.texture;this.highPassUniforms.luminosityThreshold.value=this.threshold;this.fsQuad.material=this.materialHighPassFilter;
      renderer.setRenderTarget(this.renderTargetBright);renderer.clear();this.fsQuad.render(renderer);
      let inp=this.renderTargetBright;const U=ad.UnrealBloomPass;
      for(let i=0;i<this.nMips;i++){const m=this.separableBlurMaterials[i];this.fsQuad.material=m;
        m.uniforms.colorTexture.value=inp.texture;m.uniforms.direction.value=U.BlurDirectionX;renderer.setRenderTarget(this.renderTargetsHorizontal[i]);renderer.clear();this.fsQuad.render(renderer);
        m.uniforms.colorTexture.value=this.renderTargetsHorizontal[i].texture;m.uniforms.direction.value=U.BlurDirectionY;renderer.setRenderTarget(this.renderTargetsVertical[i]);renderer.clear();this.fsQuad.render(renderer);
        inp=this.renderTargetsVertical[i];}
      this.fsQuad.material=this.compositeMaterial;const cu=this.compositeMaterial.uniforms;cu.bloomStrength.value=this.strength;cu.bloomRadius.value=this.radius;cu.bloomTintColors.value=this.bloomTintColors;
      renderer.setRenderTarget(this.renderTargetsHorizontal[0]);renderer.clear();this.fsQuad.render(renderer);
      renderer.setClearColor(oc,oa);renderer.autoClear=ac;};
    comp.addPass(bl);V3.bloom=bl;
  }
  // grade + tone map + sRGB in one pass (exposure, white balance, saturation in linear; contrast, vignette, grain on display values)
  const gu={tDiffuse:{value:null},tBloom:{value:V3.bloom?V3.bloom.renderTargetsHorizontal[0].texture:null},bloomK:{value:V3.bloom?1:0},toneMappingExposure:{value:1},
    contrast:{value:1},saturation:{value:1},warmth:{value:0},vignette:{value:0},grain:{value:0},seed:{value:0},aspect:{value:1}};
  const gm=new THREE.RawShaderMaterial({name:'GradeOutput',uniforms:gu,depthTest:false,depthWrite:false,
    vertexShader:'precision highp float;uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;attribute vec3 position;attribute vec2 uv;varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`precision highp float;
uniform sampler2D tDiffuse;uniform sampler2D tBloom;uniform float bloomK,contrast,saturation,warmth,vignette,grain,seed,aspect;
#include <tonemapping_pars_fragment>
#include <colorspace_pars_fragment>
varying vec2 vUv;
float gHash(vec2 p){vec3 p3=fract(vec3(p.xyx)*0.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
void main(){
  vec3 c=texture2D(tDiffuse,vUv).rgb;
  c=clamp(c,0.0,256.0);if(!(c.r<1e5&&c.g<1e5&&c.b<1e5))c=vec3(0.0);
  if(bloomK>0.0)c+=texture2D(tBloom,vUv).rgb*bloomK;
  c*=vec3(1.0+0.09*warmth,1.0+0.015*warmth,1.0-0.11*warmth);
  float l=dot(c,vec3(0.2126,0.7152,0.0722));c=max(mix(vec3(l),c,saturation),0.0);
#ifdef TM_ACES
  c=ACESFilmicToneMapping(c);
#else
  c=AgXToneMapping(c);
#endif
  c=clamp(sRGBTransferOETF(vec4(c,1.0)).rgb,0.0,1.0);
  c=clamp(c+(c*c*(3.0-2.0*c)-c)*(contrast-1.0),0.0,1.0);
  vec2 q=vUv-0.5;q.x*=aspect;c*=1.0-vignette*smoothstep(0.1,0.9,dot(q,q)*1.6);
  c+=(gHash(gl_FragCoord.xy+seed)-0.5)*grain;
  gl_FragColor=vec4(c,1.0);
}`});
  const gp=new ad.ShaderPass(gm);comp.addPass(gp);V3.grade=gp;V3.gradeU=gu;V3.tm='';
  // no MSAA (WebGL1): FXAA on the display-referred image
  if(!isGL2&&ad.FXAAShader){const fx=new ad.ShaderPass(ad.FXAAShader);comp.addPass(fx);V3.fxaa=fx;}
  V3.comp=comp;
}

function setTier(i,quiet,manual){
  V3.tier=clamp(i,0,TIERS.length-1);const t=TIERS[V3.tier];Z.tier=t.name;Z.quality=TIERS.length-1-V3.tier;
  V3.ql=QTOP[V3.tier];V3.qSlow=0;V3.qFast=0;V3.qWait=20;qApply();
  if(manual)store.set('zm_q',t.name);
  if(!quiet){V3.tierMsg=performance.now()+2400;camLabel();}
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
  if(V3.on){resize3D();if(!quiet)radio('AOCC','3D view. Drag to pan, right-drag to orbit, C for cameras, G for quality, M for the map.');}
  camLabel();
}
function camLabel(){const l=$('#camLbl');if(!l)return;const f=C3.follow,q=V3.tierMsg>performance.now();l.hidden=!V3.on||(V3.mode==='map'&&!q);
  l.textContent=V3.mode==='map'?`Quality: ${Z.tier} · G to change`:`${CAM_NAMES[V3.mode]}${f&&(V3.mode==='follow'||V3.mode==='approach')?' · '+fl(f):''} · C to change${q?' · Quality: '+Z.tier:''}`;}
function cycleCam(){if(!V3.on)return;let i=(CAM_MODES.indexOf(V3.mode)+1)%CAM_MODES.length;setCam(CAM_MODES[i]);}
function setCam(m,f){
  V3.mode=m;C3.fpos=null;
  if(m==='follow'){C3.follow=f||selected||pickBusy(['roll','lineup','approach','taxi_out','taxi_in','climb']);if(!C3.follow){V3.mode='map';}}
  if(m==='approach'){C3.follow=nextArrival();C3.apT=0;if(!C3.follow)V3.mode='map';}
  camLabel();
}
function pickBusy(states){return flights.find(f=>states.includes(f.state))||null;}
function nextArrival(){let best=null,bt=1e9;for(const f of flights){if(f.state!=='approach')continue;const left=f.td-T;if(left>45&&left<bt){bt=left;best=f;}}return best||flights.find(f=>f.state==='approach')||null;}
function resize3D(){if(!Z.renderer||!VW)return;Z.renderer.setSize(VW,VH,false);Z.camera.aspect=VW/Math.max(1,VH);Z.camera.updateProjectionMatrix();
  if(V3.comp){V3.comp.setPixelRatio(Z.renderer.getPixelRatio());V3.comp.setSize(VW,VH);V3.gradeU.aspect.value=VW/Math.max(1,VH);if(V3.fxaa){const pr=Z.renderer.getPixelRatio();V3.fxaa.material.uniforms.resolution.value.set(1/(VW*pr),1/(VH*pr));}}}

// solar position for Nagpur (21.15 N, 79.09 E) in late May, from the sim clock (IST)
function solar(secOfDay){
  const lat=21.15*D2R,dec=21.3*D2R;const solarH=(secOfDay/3600)-(82.5-79.09)/15;const ha=(solarH-12)*15*D2R;
  const el=Math.asin(Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(ha));
  let az=Math.acos(clamp((Math.sin(dec)-Math.sin(el)*Math.sin(lat))/(Math.cos(el)*Math.cos(lat)),-1,1));if(ha>0)az=2*Math.PI-az;
  return{el,az};
}
const tmpC=[];function col(h){return(tmpC[h]=tmpC[h]||new Z.THREE.Color(h));}
// the sun and the clear-day atmosphere for this moment; Z.atmo goes back to these values before the modules update
function lightRig(){
  if(!LV)return;
  nightF=LV.light==='dusk'?clamp((T-600)/2400,0,1):LV.light==='dawn'?clamp(0.6-T/1500,0,0.6):0;
  // daytime only: the sun keeps a mid-morning angle on every level (a 14:00 afternoon sun in the heat level)
  const heat=LV.light==='heat';
  const {el,az}=solar(((heat?14*3600:10*3600)+T*0.25)%86400);const e=el/D2R;
  const d=Z.sunDir.set(Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el));V3.keyDir=d;
  const day=clamp((e+4)/14,0,1),warm=1-clamp((e-2)/25,0,1);
  V3.sunC.lerpColors(col('#fff4e2'),col('#ff9a52'),warm*0.85);
  V3.sunBase=3.0*day*(heat?1.12:1);V3.heat=heat;
  // clear-day haze: pale blue-grey on a May morning, a whiter, thicker haze at 46 C
  V3.atmoDef.fogColor.copy(heat?col('#dcd2bf'):col('#c3d0dc'));V3.atmoDef.fogDensity=heat?0.000034:0.000022;
  atmoReset();
}
function atmoReset(){
  const a=Z.atmo,D=V3.atmoDef,g=a.grade;if(!a)return;
  a.fogColor.copy(D.fogColor);a.fogDensity=D.fogDensity;a.hazeHeight=HAZE_H;a.skyTint.copy(D.fogColor);a.skyTintK=0;a.sunDim=1;a.sunTint.setRGB(1,1,1);a.ambientK=1;
  g.exposure=1;g.contrast=1;g.saturation=1;g.warmth=0;g.vignette=0;g.grain=0;a.bloom=1;a.lightning=0;a.wind.dir=0;a.wind.speed=4;a.wind.gust=0;
  // no weather module: a simple andhi so the storm still reads
  if(dustNow&&!Z.mods.weather){a.fogColor.copy(col('#a98058'));a.fogDensity=0.0011;a.skyTint.copy(col('#b08a62'));a.skyTintK=0.85;a.sunDim=0.4;a.sunTint.copy(col('#ffb98a'));a.ambientK=0.8;g.warmth=0.3;g.saturation=0.85;a.wind.speed=18;}
  a.visibility=1.73/Math.max(1e-6,a.fogDensity);
}
// apply the (weather-written) atmosphere to fog, lights, sky and grade
function atmoApply(now){
  const a=Z.atmo,fog=V3.fog,lt=clamp(a.lightning||0,0,1),tk=clamp(a.skyTintK,0,1),sd=clamp(a.sunDim,0,1.5);
  fog.color.copy(a.fogColor);
  // the strategic view must stay readable: a high camera looks through much less of the day haze (storm dust thins less)
  const hiK=clamp((Z.camera.position.y-1500)/5500,0,1),fb=V3.atmoDef.fogDensity,fx=Math.max(0,a.fogDensity-fb);
  fog.density=Math.max(0,Math.min(a.fogDensity,fb)*(1-0.6*hiK)+fx*(1-0.3*hiK));const dd=Math.max(1e-6,fog.density);fog.near=0.25/dd;fog.far=1.6/dd;
  V3.sun.color.copy(V3.sunC).multiply(a.sunTint);V3.sun.intensity=V3.sunBase*sd;
  const env=!!Z.scene.environment;
  V3.hemi.color.copy(col('#cfe3ff')).lerp(V3.tc.copy(a.fogColor).multiplyScalar(1.5),tk*0.85);V3.hemi.groundColor.copy(col('#6d7f4c')).lerp(a.fogColor,tk*0.6);
  V3.hemi.intensity=(env?0.42:1.0)*a.ambientK*(1+lt*5);
  if(V3.skyKind==='preetham'){const u=V3.skyU;
    u.sunPosition.value.copy(Z.sunDir);u.turbidity.value=(V3.heat?4.6:2.6)+tk*10;u.rayleigh.value=(V3.heat?1.15:1.55)*(1-tk*0.6);
    u.mieCoefficient.value=(V3.heat?0.0055:0.0035)+tk*0.02;u.mieDirectionalG.value=0.82;
    u.skyGain.value=0.5*(V3.heat?1.05:1);u.tintCol.value.copy(a.skyTint);u.tintK.value=tk;u.fogCol.value.copy(a.fogColor);u.fogDens.value=a.fogDensity;u.hazeH.value=a.hazeHeight||HAZE_H;
    u.discK.value=clamp(1-tk*1.3,0,1)*Math.min(1,sd);u.paleK.value=tk*sd*2.2;u.sunTintC.value.copy(V3.sunC).multiply(a.sunTint);u.flash.value=lt;
    u.envMode.value=0;
  }else{const u=V3.skyU;
    u.sunDir.value.copy(Z.sunDir);u.top.value.copy(V3.heat?col('#6f95bd'):col('#2f64a3')).lerp(a.skyTint,tk*0.8);u.hor.value.copy(a.fogColor);u.sunCol.value.copy(V3.sunC);u.glow.value=sd;
  }
  // exposure and grade: the core's daylight look, then the weather's adjustments on top
  const G=a.grade;V3.expBase=V3.tm==='agx'?1.55:0.95;const ex=V3.expBase*(V3.heat?1.04:1)*(G.exposure||1)*(1+lt*0.8);
  Z.renderer.toneMappingExposure=ex;
  if(V3.gradeU){const u=V3.gradeU,tm=Z.toneMap==='agx'?'agx':'aces';   // ACES reads better in hard daylight; AgX kept for comparison
    if(V3.tm!==tm){V3.tm=tm;V3.grade.material.defines=tm==='aces'?{TM_ACES:''}:{};V3.grade.material.needsUpdate=true;}
    u.toneMappingExposure.value=ex;u.contrast.value=(tm==='aces'?1.04:1.14)*(G.contrast??1);u.saturation.value=(tm==='aces'?0.96:1.12)*(G.saturation??1);
    u.warmth.value=0.05+(G.warmth||0);u.vignette.value=0.16+(G.vignette||0);u.grain.value=0.012+(G.grain||0);u.seed.value=(now*61.7)%997;
    if(V3.bloom){V3.bloom.strength=0.32*(a.bloom??1)*(1+lt);V3.bloom.threshold=1.0;}}
  const DB=Z.dbg;if(DB){   // dev hook for A/B shots: Z.dbg={fog:0,bloom:0,ao:0,env:0,exp:1.2,hemi:0.5}
    if(DB.fog!=null)fog.density*=DB.fog;if(DB.bloom!=null&&V3.bloom)V3.bloom.strength*=DB.bloom;if(DB.ao!=null&&V3.ao)V3.ao.enabled=!!DB.ao;if(DB.env===0)Z.scene.environment=null,V3.pmrem=null;if(DB.exp&&V3.gradeU)V3.gradeU.toneMappingExposure.value*=DB.exp;if(DB.hemi!=null)V3.hemi.intensity*=DB.hemi;}
}
// re-render the environment map when the sun or the sky colour has moved enough to see (never every frame)
function envUpdate(now){
  if(!V3.pmrem)return;const a=Z.atmo,s=Z.sunDir,u=V3.skyU;
  const key=[s.x,s.y,s.z,a.skyTintK,a.skyTint.r,a.skyTint.g,a.skyTint.b,a.fogColor.r,a.fogColor.g,a.fogColor.b,Math.log(Math.max(1e-6,a.fogDensity)),a.ambientK,a.sunDim];
  const tol=[0.004,0.004,0.004,0.04,0.025,0.025,0.025,0.025,0.025,0.025,0.35,0.05,0.05];
  const k=V3.envKey;let ch=!k;if(k)for(let i=0;i<key.length;i++)if(Math.abs(key[i]-k[i])>tol[i]){ch=true;break;}
  if(!ch||(k&&now-V3.envT<0.8))return;
  V3.envKey=key;V3.envT=now;
  // the env sees no sun disc (the sun light already gives the highlight) and a sunlit ground below the horizon
  const g0=u.skyGain.value,d0=u.discK.value,p0=u.paleK.value,f0=u.flash.value;
  const irr=(V3.sunBase*clamp(a.sunDim,0,1.5)*Math.max(0,s.y)+1.1*a.ambientK)/Math.PI;
  u.groundCol.value.setRGB(0.15,0.15,0.1).multiplyScalar(irr).lerp(a.fogColor,clamp(a.skyTintK,0,1)*0.5);
  u.envMode.value=1;u.discK.value=0;u.paleK.value*=0.4;u.flash.value=0;u.skyGain.value=g0*a.ambientK*ENV_K;u.groundCol.value.multiplyScalar(ENV_K);u.fogCol.value.multiplyScalar(ENV_K);
  const rt=V3.pmrem.fromScene(V3.envScene,0.02,0.1,100);
  u.envMode.value=0;u.discK.value=d0;u.paleK.value=p0;u.flash.value=f0;u.skyGain.value=g0;u.fogCol.value.copy(a.fogColor);V3.envN=(V3.envN||0)+1;
  const old=V3.envRT;V3.envRT=rt;Z.scene.environment=rt.texture;if(old)old.dispose();
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
    // a near plane that follows the camera height keeps depth precision (and AO) clean in the strategic view
    cam.near=clamp((cam.position.y-1500)*0.35,4,1500);
  }else if(V3.mode==='tower'){
    const t=C3.tower;cam.position.set(1000,92,0);cam.fov+=(t.fov-cam.fov)*k;cam.near=4;
    cam.lookAt(1000+Math.cos(t.yaw)*Math.cos(t.pitch)*1000,92+Math.sin(t.pitch)*1000,Math.sin(t.yaw)*Math.cos(t.pitch)*1000);Z.kEx=1;Z.camDist=2500;focus=[1000-1400,0];
  }else{
    cam.near=4;
    const f=C3.follow;if(f){const h=f.heading,a=altM(f),span=f.T.span;const air=a>5;
      const back=V3.mode==='approach'?span*1.7+38:span*(air?2.3:2.0)+28,up=V3.mode==='approach'?span*0.32+7:span*(air?0.5:0.42)+6,side=V3.mode==='approach'?span*0.55:span*0.15;
      const want=new THREE.Vector3(f.x-Math.cos(h)*back-Math.sin(h)*side,a+up,f.y-Math.sin(h)*back+Math.cos(h)*side);
      const look=new THREE.Vector3(f.x+Math.cos(h)*span*1.5,a+span*0.12,f.y+Math.sin(h)*span*1.5);
      if(!C3.fpos){C3.fpos=want.clone();C3.flook=look.clone();}
      const kk=1-Math.exp(-dt*(f.vip?16:V3.mode==='approach'?4:3));C3.fpos.lerp(want,kk);C3.flook.lerp(look,Math.min(1,kk*1.6));
      if(C3.fpos.y<3)C3.fpos.y=3;cam.position.copy(C3.fpos);cam.lookAt(C3.flook);cam.fov+=((V3.mode==='approach'?38:46)-cam.fov)*k;
      Z.kEx=1;Z.camDist=back;focus=[f.x,f.y];
      if(V3.mode==='approach'&&f.landT!=null){C3.apT+=dt;if(C3.apT>9){const n=nextArrival();if(n&&n!==f){C3.follow=n;C3.fpos=null;C3.apT=0;camLabel();}}}
    }
  }
  cam.updateProjectionMatrix();cam.updateMatrixWorld();
  if(focus)shadowFit(focus);
}
// one shadow map fitted to the visible ground (light-space bounds of the view footprint), sizes quantised and the
// origin snapped to whole texels so panning doesn't make shadow edges crawl; the light direction only re-aims when
// the sun has moved by more than ~0.15 degrees
const SHP=[];
function shadowFit(focus){
  const THREE=Z.THREE,cam=Z.camera,sun=V3.sun,sh=sun.shadow.camera,kd=V3.keyDir||Z.sunDir;
  sun.castShadow=kd.y>0.03;if(!sun.castShadow)return;
  if(!V3.shD||V3.shD.dot(kd)<0.9999965){V3.shD=(V3.shD||new THREE.Vector3()).copy(kd);V3.shR.set(0,1,0).cross(V3.shD).normalize();V3.shU.crossVectors(V3.shD,V3.shR);}
  const D=V3.shD,Rr=V3.shR,Uu=V3.shU,cp=cam.position;
  const far=V3.mode==='map'?clamp(C3.dist*1.35,700,16000):V3.mode==='tower'?3200:900;
  if(!SHP.length)for(let i=0;i<6;i++)SHP.push(new THREE.Vector3());
  const ground=Math.min(cp.y,160);SHP[0].set(cp.x,Math.max(0,ground),cp.z);SHP[1].set(focus[0],0,focus[1]);
  const v=V3.tv,dir=V3.tv2,fwd=cam.getWorldDirection(V3.tv3);let n=2;
  for(const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
    v.set(sx,sy,0.5).unproject(cam);dir.copy(v).sub(cp).normalize();
    let t=far/Math.max(0.05,dir.dot(fwd));   // distance along the ray to the far slice
    if(dir.y<-1e-4)t=Math.min(t,-cp.y/dir.y);
    const p=SHP[n++].copy(cp).addScaledVector(dir,t);p.y=clamp(p.y,0,160);
  }
  let a0=1e9,a1=-1e9,b0=1e9,b1=-1e9,d0=1e9,d1=-1e9;
  for(let i=0;i<n;i++){const p=SHP[i],a=p.dot(Rr),b=p.dot(Uu),dd=p.dot(D);if(a<a0)a0=a;if(a>a1)a1=a;if(b<b0)b0=b;if(b>b1)b1=b;if(dd<d0)d0=dd;if(dd>d1)d1=dd;}
  const N=sun.shadow.mapSize.x,smax=V3.mode==='map'?4600:2600;
  const q=s=>Math.pow(2,Math.ceil(Math.log2(Math.max(s,120))*4)/4);   // quarter-octave steps
  let hx=q((a1-a0)/2+40),hy=q((b1-b0)/2+40),ca=(a0+a1)/2,cb=(b0+b1)/2;
  const fa=SHP[1].dot(Rr),fb=SHP[1].dot(Uu);
  if(hx>smax){hx=smax;ca=clamp(ca,fa-smax*0.6,fa+smax*0.6);}if(hy>smax){hy=smax;cb=clamp(cb,fb-smax*0.6,fb+smax*0.6);}
  const tx=2*hx/N,ty=2*hy/N;ca=Math.round(ca/tx)*tx;cb=Math.round(cb/ty)*ty;
  const lift=d1+700;   // casters up to ~700 m above the highest receiver along the light
  sun.position.set(0,0,0).addScaledVector(Rr,ca).addScaledVector(Uu,cb).addScaledVector(D,lift);
  sun.target.position.copy(sun.position).addScaledVector(D,-1000);
  sh.left=-hx;sh.right=hx;sh.top=hy;sh.bottom=-hy;sh.near=1;sh.far=lift-d0+60;sh.updateProjectionMatrix();
  const texel=Math.max(tx,ty);sun.shadow.normalBias=texel*0.9;sun.shadow.bias=-0.25/sh.far;
  sun.target.updateMatrixWorld();sun.updateMatrixWorld();
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
  // the weather module draws the andhi in 3D; the old screen-space streaks only without it
  if(dustNow&&!Z.mods.weather){ctx.fillStyle='rgba(220,180,130,.35)';for(const p of dustP){const x=((p.x*VW-now*260*p.v)%VW+VW)%VW,y=p.y*VH;ctx.fillRect(x,y,p.s*7,p.s);}}
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
// adaptive quality: a ladder of small steps (pixel ratio first, then AO, then bloom) walked down EARLY, as soon as the
// median frame time sags for a second, and back up only after a long steady stretch (with a growing back-off, so it
// never oscillates). G picks the top rung (High 0, Medium 2, Low 4); hitches (>100 ms) never count as "slow".
const QL=[{ao:true,bloom:true,pr:1.5},{ao:true,bloom:true,pr:1.25},{ao:false,bloom:true,pr:1.25},{ao:false,bloom:true,pr:1},{ao:false,bloom:false,pr:1},{ao:false,bloom:false,pr:0.85}];
const QTOP=[0,2,4],QFT=new Float32Array(64);
function qApply(){const q=QL[V3.ql],R=Z.renderer;if(V3.ao)V3.ao.enabled=q.ao;if(V3.bloom)V3.bloom.enabled=q.bloom;if(V3.gradeU)V3.gradeU.bloomK.value=q.bloom&&V3.bloom?1:0;
  const pr=Math.min(window.devicePixelRatio||1,V3.comp?q.pr:Math.min(1.75,q.pr+0.25));if(R.getPixelRatio()!==pr){R.setPixelRatio(pr);resize3D();}}
function quality3D(dtR){
  if(navigator.webdriver&&!Z.adaptive)return;
  const ms=dtR*1000;if(ms>100||ms<=0)return;QFT[V3.qn++&63]=ms;V3.qAcc=(V3.qAcc||0)+dtR;if(V3.qAcc<0.5)return;V3.qAcc=0;
  const n=Math.min(V3.qn,64),a=Array.from(QFT.subarray(0,n)).sort((x,y)=>x-y),med=a[n>>1];V3.qn=0;
  const top=QTOP[V3.tier];if(V3.ql==null||V3.ql<top)V3.ql=top;
  if(med>18.5){V3.qSlow=(V3.qSlow||0)+1;V3.qFast=0;
    if(V3.qSlow>=2&&V3.ql<QL.length-1){V3.qSlow=0;if(performance.now()-(V3.qUpT||0)<6000)V3.qWait=Math.min(240,(V3.qWait||20)*2);V3.ql++;qApply();}}
  else if(med<17.2){V3.qSlow=0;V3.qFast=(V3.qFast||0)+1;
    if(V3.ql>top&&V3.qFast*0.5>=(V3.qWait||20)){V3.qFast=0;V3.ql--;V3.qUpT=performance.now();qApply();}}
  else{V3.qSlow=0;V3.qFast=0;}}
// first-use hitches: compile every program once (in parallel where the browser can), then draw one hidden frame with
// every object forced visible and unculled, so pipelines, buffers and textures are all created before the player
// looks at them (the andhi, the night lights, aircraft types, AO). Runs once, behind the level menu.
function prewarm3D(){
  const R=Z.renderer;V3.warm=1;const rt=R.getRenderTarget();
  try{R.setRenderTarget(V3.comp?V3.rtMS:null);const p=R.compileAsync?R.compileAsync(Z.scene,Z.camera):null;R.setRenderTarget(rt);
    if(p&&p.then)p.then(()=>{V3.warm=2;},()=>{V3.warm=2;});else V3.warm=2;}
  catch(err){R.setRenderTarget(rt);console.warn('3D: prewarm compile',err);V3.warm=2;}
}
function warmFrame(on){
  if(on){const L=V3.warmL=[];Z.scene.traverse(o=>{L.push(o,o.visible,o.frustumCulled,o.isInstancedMesh?o.count:-1);o.visible=true;o.frustumCulled=false;if(o.isInstancedMesh&&!o.count)o.count=1;});
    V3.warmAO=V3.ao?V3.ao.enabled:false;if(V3.ao)V3.ao.enabled=true;return;}
  const L=V3.warmL;for(let i=0;i<L.length;i+=4){const o=L[i];o.visible=L[i+1];o.frustumCulled=L[i+2];if(L[i+3]>=0)o.count=L[i+3];}V3.warmL=null;if(V3.ao)V3.ao.enabled=V3.warmAO;
}
function draw3D(now,dtR){
  if(!Z.renderer)return;const t0=performance.now(),R=Z.renderer;
  if(R.domElement.width!==Math.round(VW*R.getPixelRatio()))resize3D();
  lightRig();camUpdate(dtR);
  for(const k in Z.mods){const m=Z.mods[k];if(m&&m.update){try{m.update(dtR,now);}catch(err){console.error('3D '+k,err);m.update=null;}}}
  atmoApply(now);guides3D(now);
  try{envUpdate(now);}catch(err){console.warn('3D: environment map failed',err);V3.pmrem=null;}
  V3.sky.position.copy(Z.camera.position);
  if(!V3.warm&&Z.scene.environment&&LV)prewarm3D();
  if(V3.warm===2){V3.warm=3;try{warmFrame(true);R.shadowMap.needsUpdate=true;if(V3.comp){const c=V3.comp;c.readBuffer=V3.rtMS;c.writeBuffer=c.renderTarget1;c.render(dtR);}else R.render(Z.scene,Z.camera);}
    catch(err){console.warn('3D: warm-up frame',err);}finally{warmFrame(false);}}
  R.info.reset();R.shadowMap.needsUpdate=true;V3.sceneCalls=-1;
  if(V3.comp){const c=V3.comp;c.readBuffer=V3.rtMS;c.writeBuffer=c.renderTarget1;
    if(V3.ao&&V3.ao.enabled){const r=clamp(Z.camDist*0.012,3.5,40);V3.ao.gtaoMaterial.uniforms.radius.value=r;V3.ao.gtaoMaterial.uniforms.thickness.value=r*2.5;}
    c.render(dtR);
    const i=R.info.render;if(V3.sceneCalls>=0){V3.postCalls=i.calls-V3.sceneCalls;V3.postTris=i.triangles-V3.sceneTris;i.calls=V3.sceneCalls;i.triangles=V3.sceneTris;}}
  else R.render(Z.scene,Z.camera);
  Z.renderStats={tier:Z.tier,ql:V3.ql,warm:V3.warm,postCalls:V3.postCalls|0,postTris:V3.postTris|0,envRegens:V3.envN|0,pr:R.getPixelRatio()};
  project3D();drawOverlay3D(now);V3.cpu=(V3.cpu||0)*0.9+(performance.now()-t0)*0.1;
  if(V3.tierMsg&&performance.now()>V3.tierMsg){V3.tierMsg=0;camLabel();}
  V3.frames++;V3.fpsT+=dtR;if(V3.fpsT>1){V3.fps=V3.frames/V3.fpsT;V3.frames=0;V3.fpsT=0;}quality3D(dtR);
}
