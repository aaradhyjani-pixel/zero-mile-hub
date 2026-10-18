Z3MOD.fx5 = function (Z) {
  // Level 3's fog and the runway collision it can lead to (3d/FX.md). Played straight: a serious accident, not a show.
  // CRASH ({kind:'crash'} in Z.fx): a blinding flash, a rolling fireball that climbs ~150 m and cools into a towering black
  // column leaning downwind, burning fuel spreading over the runway, debris and sparks, secondary explosions, then a
  // sustained fire that crash tenders from the nearest fire station smother with foam over ~15 sim minutes; the smoke stays.
  // Fast things (flash, fireball, debris, sparks) run on a hybrid clock: real seconds since the crash was first drawn, but
  // never behind sim time / 20, so they play in real time in the slow-motion cut and are already over after a fast-forward.
  // Slow things (fire intensity, foam, tenders) follow sim time. The column is a pure function of its own clock and the wind.
  // FOG (Z.fogF > 0): the core fog thickens with how low the camera is (the runway is gone within ~400 m from the follow
  // camera), low drifting fog banks surround low cameras, and from high up only a thin veil of drifting banks lies on the
  // field, so every runway and aircraft stays readable from the strategic view.
  // Draw calls while active: fuel pool 1, fire 1, smoke/foam/fog banks 1, debris 1, tenders 1, fog veil 1 (6). No per-frame
  // allocations. Every mesh is in the scene from the start, so the core's warm-up frame compiles all of it.
  const THREE = Z.THREE, scene = Z.scene;
  const root = new THREE.Group(); root.name = 'fx5'; scene.add(root);
  (Z.fxKinds = Z.fxKinds || new Set()).add('crash');
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), mix = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
  // weather.js rewrites Z.atmo every frame; run after it so the fog and the flash land in the core's atmosphere pass
  Promise.resolve().then(() => { const m = Z.mods && Z.mods.fx5; if (m && Z.mods.weather) { delete Z.mods.fx5; Z.mods.fx5 = m; } });

  const NOISE = `
float f5h(vec2 p){vec3 p3=fract(vec3(p.xyx)*0.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float f5n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(f5h(i),f5h(i+vec2(1.,0.)),f.x),mix(f5h(i+vec2(0.,1.)),f5h(i+vec2(1.,1.)),f.x),f.y);}
float f5f(vec2 p){return f5n(p)*0.5+f5n(p*2.03+7.1)*0.3+f5n(p*4.11+3.3)*0.2;}
`;
  const FOGU = () => THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
  const quadSet = (N, attrs) => {
    const g = new THREE.InstancedBufferGeometry(), b = new THREE.PlaneGeometry(1, 1);
    g.setIndex(b.index); g.setAttribute('position', b.attributes.position); g.setAttribute('uv', b.attributes.uv);
    const o = { g };
    for (const [name, n] of attrs) { const arr = new Float32Array(N * n), at = new THREE.InstancedBufferAttribute(arr, n); at.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, at); o[name] = arr; o[name + 'A'] = at; }
    g.instanceCount = 1; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7); return o;
  };
  const lightU = { uSunV: { value: new THREE.Vector3(0, 1, 0) }, uUpV: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(3, 3, 3) },
    uAmbT: { value: new THREE.Color(0.5, 0.55, 0.6) }, uAmbB: { value: new THREE.Color(0.3, 0.28, 0.25) }, uTime: { value: 0 }, uGlowC: { value: new THREE.Color(3.2, 1.1, 0.25) } };

  /* ================================================================ smoke, foam and fog banks (lit, alpha) ================ */
  const NS = 320;
  const SM = quadSet(NS, [['aP', 4], ['aC', 4], ['aR', 4]]);
  const smU = Object.assign(FOGU(), lightU);
  const smMat = new THREE.ShaderMaterial({ uniforms: smU, transparent: true, depthWrite: false, fog: true,
    vertexShader: `attribute vec4 aP,aC,aR;varying vec2 vUv;varying vec4 vC,vR;
#include <fog_pars_vertex>
void main(){vUv=uv;vC=aC;vR=aR;vec4 mvPosition=viewMatrix*vec4(aP.xyz,1.);
  vec2 o=vec2(position.x*aR.x,position.y)*aP.w;mvPosition.xy+=o;gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform vec3 uSunV,uUpV,uSunCol,uAmbT,uAmbB,uGlowC;uniform float uTime;varying vec2 vUv;varying vec4 vC,vR;
#include <fog_pars_fragment>
${NOISE}
void main(){vec2 p=vUv*2.-1.;float r=length(p);if(r>1.)discard;
  float c=cos(vR.y),s=sin(vR.y);vec2 q=vec2(c*p.x-s*p.y,s*p.x+c*p.y);
  float n=f5f(q*1.7+vR.y*3.1+vec2(0.,uTime*0.05)),n2=f5n(q*4.3+vR.y*7.);
  float d=smoothstep(0.,vR.w,1.-r+(n-0.5)*0.9+(n2-0.5)*0.25);
  float a=vC.a*d;if(a<0.003)discard;
  vec3 N=normalize(vec3(p*0.9+(vec2(n,n2)-0.5)*0.6,sqrt(max(0.,1.-r*r))+0.25));
  float w=clamp(0.42+0.58*dot(N,uSunV),0.,1.);
  vec3 col=vC.rgb*(uSunCol*w+mix(uAmbB,uAmbT,0.5+0.5*dot(N,uUpV)))*(0.72+0.5*n);
  col+=uGlowC*vR.z*(0.35+0.9*n)*clamp(0.55-0.6*dot(N,uUpV),0.,1.);
  gl_FragColor=vec4(col,a);
  #include <fog_fragment>
}` });
  const smoke = new THREE.Mesh(SM.g, smMat); smoke.frustumCulled = false; smoke.renderOrder = 7; smoke.visible = false; root.add(smoke);
  // staging: 12 floats per slot, a persistent depth order (nearly sorted frame to frame, so insertion sort is ~linear)
  const ST = new Float32Array(NS * 12), KEY = new Float32Array(NS), ORD = new Int32Array(NS); for (let i = 0; i < NS; i++) ORD[i] = i;
  let sN = 0;
  const sPut = (x, y, z, size, r, g, b, a, asp, rot, glow, soft) => { if (sN >= NS || a < 0.003 || size <= 0) return; const o = sN * 12;
    ST[o] = x; ST[o + 1] = y; ST[o + 2] = z; ST[o + 3] = size; ST[o + 4] = r; ST[o + 5] = g; ST[o + 6] = b; ST[o + 7] = a; ST[o + 8] = asp; ST[o + 9] = rot; ST[o + 10] = glow; ST[o + 11] = soft; sN++; };
  function sFlush() {
    const cp = Z.camera.position;
    for (let i = 0; i < NS; i++) { const o = i * 12; KEY[i] = i < sN ? (ST[o] - cp.x) ** 2 + (ST[o + 1] - cp.y) ** 2 + (ST[o + 2] - cp.z) ** 2 : -1; }
    for (let i = 1; i < NS; i++) { const v = ORD[i], k = KEY[v]; let j = i - 1; while (j >= 0 && KEY[ORD[j]] < k) { ORD[j + 1] = ORD[j]; j--; } ORD[j + 1] = v; }
    const P = SM.aP, C = SM.aC, R = SM.aR;
    for (let i = 0; i < sN; i++) { const o = ORD[i] * 12, d = i * 4;
      P[d] = ST[o]; P[d + 1] = ST[o + 1]; P[d + 2] = ST[o + 2]; P[d + 3] = ST[o + 3]; C[d] = ST[o + 4]; C[d + 1] = ST[o + 5]; C[d + 2] = ST[o + 6]; C[d + 3] = ST[o + 7];
      R[d] = ST[o + 8]; R[d + 1] = ST[o + 9]; R[d + 2] = ST[o + 10]; R[d + 3] = ST[o + 11]; }
    smoke.visible = sN > 0; SM.g.instanceCount = Math.max(1, sN);
    if (sN) { SM.aPA.needsUpdate = true; SM.aCA.needsUpdate = true; SM.aRA.needsUpdate = true; }
  }

  /* ================================================================ fire, flash and sparks (premultiplied, HDR) =========== */
  const NF = 260;
  const FI = quadSet(NF, [['aP', 4], ['aQ', 4]]);
  const fiU = Object.assign(FOGU(), { uTime: lightU.uTime });
  const fiMat = new THREE.ShaderMaterial({ uniforms: fiU, transparent: true, depthWrite: false, fog: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
    vertexShader: `attribute vec4 aP,aQ;varying vec2 vUv;varying vec4 vQ;
#include <fog_pars_vertex>
void main(){vUv=uv;vQ=aQ;vec4 mvPosition;
  if(aQ.w>0.5&&aQ.w<1.5){vec3 t=cameraPosition-aP.xyz;t.y=0.;float l=length(t);vec3 R=l>0.01?vec3(-t.z,0.,t.x)/l:vec3(1.,0.,0.);
    vec3 W=aP.xyz+R*position.x*aP.w*0.8+vec3(0.,(position.y+0.5)*aP.w,0.);mvPosition=viewMatrix*vec4(W,1.);}
  else{mvPosition=viewMatrix*vec4(aP.xyz,1.);mvPosition.xy+=position.xy*aP.w;}
  gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform float uTime;varying vec2 vUv;varying vec4 vQ;
#include <fog_pars_fragment>
${NOISE}
vec3 ramp(float t){vec3 c=mix(vec3(0.35,0.03,0.005),vec3(3.4,0.7,0.06),smoothstep(0.,0.4,t));c=mix(c,vec3(7.,2.9,0.45),smoothstep(0.35,0.75,t));return mix(c,vec3(12.,9.,5.5),smoothstep(0.8,1.,t));}
void main(){vec2 p=vUv*2.-1.;float I=vQ.x,tp=vQ.y,sd=vQ.z,k=vQ.w,r=length(p);vec3 col;float a;
  if(k<0.5){float n=f5f(p*1.6+vec2(sd*17.,sd*9.-uTime*0.5)),n2=f5n(p*4.+sd*5.+uTime*0.8);
    float d=smoothstep(1.,0.25,r+(n-0.5)*0.85+(n2-0.5)*0.2);float t=clamp(tp*(0.5+0.8*n)*(1.25-r*0.7),0.,1.);
    float soot=smoothstep(0.55,0.95,r+(0.5-n)*0.5)*(1.-tp*0.6);a=d*I*mix(0.95,0.45,tp);col=ramp(t)*d*I*(0.25+1.0*n)*(1.-soot*0.85)+vec3(0.02,0.017,0.015)*a;}
  else if(k<1.5){float y=vUv.y;float n=f5f(vec2(p.x*1.4+sd*13.,y*2.2-uTime*2.6+sd*7.)),n2=f5n(vec2(p.x*3.+sd,y*5.-uTime*4.));
    float w=(1.-y)*0.85+0.08;float sh=smoothstep(0.,0.3,w-abs(p.x*0.95+(n-0.5)*0.7*y))*smoothstep(1.,0.62,y+(n2-0.5)*0.45)*smoothstep(0.,0.06,y);
    float t=clamp((1.05-y*1.15)*(0.55+0.7*n)*tp,0.,1.);col=ramp(t)*sh*I*(0.6+0.7*n2);a=sh*I*0.2;}
  else if(k<2.5){float d=smoothstep(1.,0.,r);col=vec3(9.,4.5,1.3)*d*d*I;a=0.;}
  else{float d=max(exp(-r*r*6.)-0.0025,0.)*smoothstep(1.,0.75,r);float h=max(1.-r,0.);col=vec3(26.,22.,17.)*d*I+vec3(5.,2.4,0.8)*h*h*I;a=0.;}
  #ifdef USE_FOG
  #ifdef FOG_EXP2
  {float fd=length(vFogOff);float ff=1.-exp(-fogDensity*fogDensity*fd*fd);col*=1.-ff*0.8;a*=1.-ff;}
  #endif
  #endif
  if(max(col.r,a)<0.002)discard;
  gl_FragColor=vec4(col,a);
}` });
  const fire = new THREE.Mesh(FI.g, fiMat); fire.frustumCulled = false; fire.renderOrder = 6; fire.visible = false; root.add(fire);
  let fN = 0;
  const fPut = (x, y, z, size, I, temp, seed, kind) => { if (fN >= NF || I < 0.004 || size <= 0) return; const d = fN * 4;
    FI.aP[d] = x; FI.aP[d + 1] = y; FI.aP[d + 2] = z; FI.aP[d + 3] = size; FI.aQ[d] = I; FI.aQ[d + 1] = temp; FI.aQ[d + 2] = seed; FI.aQ[d + 3] = kind; fN++; };

  /* ================================================================ the fuel pool: scorch, burning fuel, foam blanket ===== */
  const PRX = 125, PRZ = 72;   // pool radii (m) along and across the runway
  const poolGeo = new THREE.PlaneGeometry(PRX * 3.2, PRZ * 3.2); poolGeo.rotateX(-Math.PI / 2);
  const poU = Object.assign(FOGU(), { uTime: lightU.uTime, uSunCol: lightU.uSunCol, uAmbT: lightU.uAmbT, uSunY: { value: 0.7 }, uGrow: { value: 0 }, uBurn: { value: 1 }, uFoam: { value: 0 }, uRad: { value: new THREE.Vector2(PRX, PRZ) } });
  const poMat = new THREE.ShaderMaterial({ uniforms: poU, transparent: true, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
    vertexShader: `varying vec2 vL;
#include <fog_pars_vertex>
void main(){vL=position.xz;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform float uTime,uSunY,uGrow,uBurn,uFoam;uniform vec3 uSunCol,uAmbT;uniform vec2 uRad;varying vec2 vL;
#include <fog_pars_fragment>
${NOISE}
void main(){vec2 q=vL/uRad;float n=f5f(vL*0.03+3.1),n2=f5f(vL*0.085+11.);
  float d=length(q)+(n-0.5)*0.6;float g=max(uGrow,1e-3);
  float ch=1.-smoothstep(g*1.2,g*1.5,d+(n2-0.5)*0.3);if(ch<0.004)discard;
  float fuel=1.-smoothstep(g*0.9,g*1.02,d);
  float foam=smoothstep(0.,0.2,uFoam*1.1-n2*0.75-d*0.3)*ch*0.9;
  float burn=fuel*(1.-smoothstep(uBurn*g*0.75,uBurn*g+0.03,d+(n2-0.5)*0.3))*(1.-foam)*step(0.001,uBurn);
  float fl=f5f(vL*0.05+vec2(0.,-uTime*0.9)),fl2=f5n(vL*0.16+vec2(uTime*0.7,-uTime*1.7));
  vec3 alb=mix(vec3(0.016,0.015,0.014),vec3(0.035,0.03,0.026),fuel*(0.5+0.5*n2));alb=mix(alb,vec3(0.62,0.63,0.6)*(0.8+0.25*n),foam);
  vec3 col=alb*(uSunCol*uSunY+uAmbT);
  col+=mix(vec3(2.6,0.6,0.07),vec3(7.,3.6,0.9),fl*fl2)*burn*(0.35+0.9*fl)*(0.75+0.25*sin(uTime*13.+n*20.));
  gl_FragColor=vec4(col,max(ch*0.93,foam));
  #include <fog_fragment>
}` });
  const pool = new THREE.Mesh(poolGeo, poMat); pool.frustumCulled = false; pool.renderOrder = 5; pool.visible = false; pool.position.y = 0.35; root.add(pool);

  /* ================================================================ debris: charred metal and torn skin =================== */
  const ND = 72;
  const debMat = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.35 });
  const deb = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), debMat, ND); deb.frustumCulled = false; deb.visible = false; deb.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  deb.setColorAt(0, _c.setRGB(0.1, 0.1, 0.1)); root.add(deb);
  const DB = new Float32Array(ND * 14);   // p0 xyz, v xyz, axis xyz, w, scale xyz, (unused)

  /* ================================================================ ARFF crash tenders ==================================== */
  const NT = 5;
  const tenderGeo = (() => {
    const P = [], N = [], C = [], E = [], I = [];
    const box = (x, y, z, sx, sy, sz, hex, em, rz) => { const g = new THREE.BoxGeometry(sx, sy, sz); if (rz) g.rotateZ(rz); g.translate(x, y, z);
      const p = g.attributes.position, n = g.attributes.normal, base = P.length / 3; _c.set(hex);
      for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); C.push(_c.r, _c.g, _c.b); E.push(em || 0); }
      const ix = g.index.array; for (let i = 0; i < ix.length; i++) I.push(base + ix[i]); g.dispose(); };
    const RED = '#c0101a', GL = '#0b1418';
    box(0.3, 0.03, 0, 13.6, 0.04, 4.1, '#0c0c0c', 3);                                    // contact shadow
    box(0.2, 0.95, 0, 11.6, 0.5, 2.4, '#1c1c1c');
    for (const x of [4.2, -1.7, -3.6]) for (const z of [-1.25, 1.25]) box(x, 0.66, z, 1.32, 1.32, 0.62, '#101010');
    box(5.0, 2.2, 0, 2.6, 2.2, 2.92, RED); box(6.33, 2.75, 0, 0.08, 1.0, 2.7, GL); box(5.0, 2.82, 0, 2.2, 0.78, 2.96, GL);
    box(6.4, 1.05, 0, 0.3, 0.42, 3.0, '#d6d6d6');
    for (const z of [-1.1, 1.1]) box(6.56, 1.33, z, 0.06, 0.22, 0.42, '#ffffff', 2);
    box(-1.3, 2.25, 0, 9.3, 2.3, 2.96, RED);
    for (const x of [2.0, -0.8, -3.6]) box(x, 2.05, 0, 2.4, 1.4, 3.0, '#c2c5c9');
    box(0.2, 1.22, 0, 12.2, 0.2, 3.02, '#f0d20a');
    box(-1.3, 3.43, 0, 9.3, 0.12, 2.9, '#ececec');
    box(5.55, 3.4, 0, 0.36, 0.2, 2.2, '#333333', 1);
    box(-5.95, 2.9, 0, 0.08, 0.3, 2.4, '#ff2010', 4);
    box(4.3, 3.55, 0, 0.6, 0.3, 0.6, '#cfcfcf'); box(5.0, 3.95, 0, 1.6, 0.22, 0.22, '#e0e0e0', 0, 0.38);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('aE', new THREE.Float32BufferAttribute(E, 1)); g.setIndex(I); return g;
  })();
  const tMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.12, envMapIntensity: 1.1 });
  tMat.onBeforeCompile = sh => { sh.uniforms.uTime = lightU.uTime;
    sh.vertexShader = 'attribute float aE;varying float vE;varying vec3 vLP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvE=aE;vLP=position;');
    sh.fragmentShader = 'uniform float uTime;varying float vE;varying vec3 vLP;\n' + sh.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;', `vec3 totalEmissiveRadiance = emissive;
      if(abs(vE-1.)<0.5){float sd=vLP.z>0.?1.:0.;float on=step(0.5,fract(uTime*2.2+sd*0.5))*step(0.3,fract(uTime*8.7));totalEmissiveRadiance+=mix(vec3(1.,0.04,0.02),vec3(0.05,0.2,1.),sd)*on*9.;}
      if(abs(vE-2.)<0.5)totalEmissiveRadiance+=vec3(3.5);
      if(abs(vE-4.)<0.5)totalEmissiveRadiance+=vec3(2.,0.1,0.05)*step(0.5,fract(uTime*1.7));`)
; };
  tMat.customProgramCacheKey = () => 'fx5-tender';
  const tenders = new THREE.InstancedMesh(tenderGeo, tMat, NT); tenders.frustumCulled = false; tenders.visible = false; tenders.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(tenders);

  /* ================================================================ fog veil: three thin drifting layers ================== */
  const veilGeo = (() => {
    const P = [], L = [], I = [], S = 30000, Y = [4, 14, 30];
    for (let l = 0; l < 3; l++) { const b = l * 4; P.push(-S, Y[l], -S, S, Y[l], -S, S, Y[l], S, -S, Y[l], S); L.push(l, l, l, l); I.push(b, b + 2, b + 1, b, b + 3, b + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aL', new THREE.Float32BufferAttribute(L, 1)); g.setIndex(I);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6); return g;
  })();
  const veU = Object.assign(FOGU(), { uTime: lightU.uTime, uLA: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color(0.8, 0.82, 0.84) }, uDrift: { value: new THREE.Vector2() }, uCen: { value: new THREE.Vector2(-500, 0) } });
  const veMat = new THREE.ShaderMaterial({ uniforms: veU, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    vertexShader: `attribute float aL;varying float vL;varying vec3 vW;
#include <fog_pars_vertex>
void main(){vL=aL;vW=position;vec4 mvPosition=viewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform vec3 uLA,uCol;uniform vec2 uDrift,uCen;varying float vL;varying vec3 vW;
#include <fog_pars_fragment>
${NOISE}
void main(){float la=vL<0.5?uLA.x:vL<1.5?uLA.y:uLA.z;if(la<0.002)discard;
  vec2 p=vW.xz+uDrift*(1.+vL*0.35);
  float n=f5f(p/1300.+vL*5.3),n2=f5f(p/380.+vL*2.1+9.);
  float dn=smoothstep(0.28,0.82,n*0.78+n2*0.32);
  float edge=1.-smoothstep(8500.,14000.,length(vW.xz-uCen));
  float a=la*(0.3+0.7*dn)*edge;if(a<0.002)discard;
  gl_FragColor=vec4(uCol*(0.93+0.1*n2),a);
  #include <fog_fragment>
}` });
  const veil = new THREE.Mesh(veilGeo, veMat); veil.frustumCulled = false; veil.renderOrder = 4; veil.visible = false; root.add(veil);

  /* ================================================================ crash state ============================================ */
  const CR = { it: null, id: null, e: 0, x: 0, y: 0, ax: 0, st: [0, 0], tp: new Float32Array(NT * 9), sec: new Float32Array(6 * 4), rng: 1 };
  const stations = [];
  for (const b of (Z.SPEC && Z.SPEC.buildings) || []) { if (b.kind !== 'fire' || !b.outline) continue;
    const t = b.outline.match(/[MLHVQCZ]|-?\d*\.?\d+/g) || []; let cmd = '', x = 0, y = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let i = 0; i < t.length;) { if (/[A-Z]/.test(t[i])) { cmd = t[i++]; continue; }
      if (cmd === 'H') x = +t[i++]; else if (cmd === 'V') y = +t[i++]; else if (cmd === 'Q') { i += 2; x = +t[i++]; y = +t[i++]; } else if (cmd === 'C') { i += 4; x = +t[i++]; y = +t[i++]; } else { x = +t[i++]; y = +t[i++]; }
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 > x0) stations.push([(x0 + x1) / 2, (y0 + y1) / 2]); }
  function rnd() { let s = CR.rng | 0; s = s + 0x6D2B79F5 | 0; CR.rng = s; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  function setup(it) {
    CR.it = it; CR.id = it.id; CR.x = +it.x || 0; CR.y = +it.y || 0; CR.rng = (Math.floor(CR.x * 7 + CR.y * 13) ^ 0x5f3759df) | 0;
    const T = Z.T || 0; CR.e = Math.max(0, (T - it.t0) / 20);
    // the runway axis: the colliding aircraft were on it (a backtracker heading east, a roll heading west)
    CR.ax = Number.isFinite(it.b) ? it.b : Number.isFinite(it.a) ? it.a : Math.PI;
    let best = null, bd = 1e18; for (const s of stations) { const d = (s[0] - CR.x) ** 2 + (s[1] - CR.y) ** 2; if (d < bd) { bd = d; best = s; } }
    CR.st[0] = best ? best[0] : CR.x + 500; CR.st[1] = best ? best[1] : CR.y + 500;
    // tenders: out of the station, to a staging point on the station's side, then nose-in to the fire, upwind spread
    const sd = Math.sign(CR.st[1] - CR.y) || 1, base = Math.atan2(sd, 0), off = [-1.2, -0.55, 0, 0.6, 1.25];
    for (let i = 0; i < NT; i++) { const th = base + off[i], R = 92 + 14 * (i % 2), fx = CR.x + Math.cos(th) * R, fy = CR.y + Math.sin(th) * R, o = i * 9;
      CR.tp[o] = CR.st[0] + (i - 2) * 7; CR.tp[o + 1] = CR.st[1] - sd * 60; CR.tp[o + 2] = CR.x + (fx - CR.x) * 2.3; CR.tp[o + 3] = CR.y + sd * 200 + (i - 2) * 6;
      CR.tp[o + 4] = fx; CR.tp[o + 5] = fy; CR.tp[o + 6] = it.t0 + 40 + i * 5 + rnd() * 3; CR.tp[o + 7] = 0; CR.tp[o + 8] = 0; }
    // debris thrown mostly along the roll (the 777F was at ~90 m/s), some sideways
    const ca = Math.cos(CR.ax), sa = Math.sin(CR.ax);
    for (let i = 0; i < ND; i++) { const o = i * 14, along = (rnd() < 0.7 ? 1 : -0.6) * (8 + 55 * rnd() ** 1.5), side = (rnd() - 0.5) * 50, vy = 6 + 30 * rnd() ** 1.3;
      DB[o] = CR.x + (rnd() - 0.5) * 30; DB[o + 1] = 3 + 8 * rnd(); DB[o + 2] = CR.y + (rnd() - 0.5) * 16;
      DB[o + 3] = ca * along - sa * side; DB[o + 4] = vy; DB[o + 5] = sa * along + ca * side;
      _v.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(); DB[o + 6] = _v.x; DB[o + 7] = _v.y; DB[o + 8] = _v.z; DB[o + 9] = 2 + 8 * rnd();
      const big = i < 6; DB[o + 10] = big ? 4 + 5 * rnd() : 0.6 + 2.6 * rnd() ** 2; DB[o + 11] = big ? 0.4 + 0.5 * rnd() : 0.15 + 0.9 * rnd(); DB[o + 12] = big ? 2 + 4 * rnd() : 0.5 + 2 * rnd();
      const k = rnd(); _c.setRGB(...(k < 0.45 ? [0.035, 0.032, 0.03] : k < 0.7 ? [0.5, 0.52, 0.55] : k < 0.88 ? [0.8, 0.8, 0.78] : [0.16, 0.08, 0.04])); deb.setColorAt(i, _c); }
    deb.instanceColor.needsUpdate = true;
    for (let k = 0; k < 6; k++) { const o = k * 4; CR.sec[o] = [1.3, 2.4, 3.6, 5.1, 6.9, 8.8][k] + rnd() * 0.4; CR.sec[o + 1] = CR.x + ca * (rnd() - 0.4) * 110 + (rnd() - 0.5) * 30; CR.sec[o + 2] = CR.y + sa * (rnd() - 0.4) * 110 + (rnd() - 0.5) * 30; CR.sec[o + 3] = 0.6 + 0.6 * rnd(); }
  }

  // fire intensity (sim time): full for a minute, then the foam knocks it down over ~15 minutes to a few smouldering spots
  const fireK = (T, t0) => T - t0 < 60 ? 1 : 1 - 0.94 * sstep(t0 + 60, t0 + 960, T);
  const foamK = (T, t0) => sstep(t0 + 75, t0 + 900, T);

  function updCrash(it, dt, now, smokeOnly) {
    if (CR.id !== it.id || CR.it !== it) setup(it);
    const T = Z.T || 0, t0 = it.t0, ts = T - t0;
    CR.e = Math.max(CR.e + dt, ts / 20); const e = CR.e;
    const cam = Z.camera, cd = Math.hypot(cam.position.x - CR.x, cam.position.y, cam.position.z - CR.y);
    const kF = clamp(cd / 2600, 1, 2.8);   // flames and sparks grow with distance so the fire reads from the strategic view
    const F = fireK(T, t0), FO = foamK(T, t0), grow = 1 - Math.exp(-e / 1.6);
    const A = Z.atmo, w = A && A.wind ? A.wind : null, wd = w ? w.dir : 0.3, ws = w ? w.speed : 4, wx = Math.cos(wd), wz = Math.sin(wd), wK = clamp(ws / 5, 0.35, 1.5);
    const tm = lightU.uTime.value, ca = Math.cos(CR.ax), sa = Math.sin(CR.ax);

    // ---- pool ----
    pool.visible = true; pool.position.x = CR.x; pool.position.z = CR.y; pool.rotation.y = -CR.ax;
    poU.uGrow.value = grow; poU.uBurn.value = F > 0.07 ? clamp(0.25 + 0.75 * F, 0, 1) : F * 3.5; poU.uFoam.value = FO;

    // ---- flash (and a lift of the whole scene's light for the first instants) ----
    if (e < 0.7) { const fk = (1 - e / 0.7) ** 2; fPut(CR.x, 25 + 60 * e, CR.y, (260 + 500 * e) * Math.sqrt(kF), fk * 1.4, 1, 0.3, 3);
      if (A) { A.lightning = Math.max(A.lightning || 0, fk * clamp(1.15 - cd / 9000, 0.25, 0.9)); if (A.grade) A.grade.exposure *= 1 + 0.5 * fk; } }

    // ---- the fireball: a rolling torus of fire that climbs ~150 m and cools; matching smoke takes over as it cools ----
    const NB = 26;
    if (e < 26) for (let j = 0; j < NB; j++) {
      const th = j / NB * 6.283 + hash(j, 1) * 0.4, core = j < 6, rise = 150 * (1 - Math.exp(-e / 2.4)) + 4 * e;
      const R = (core ? 8 : 38) * (1 - Math.exp(-e / 0.7)) + e * 2.5, rr = (core ? 6 : 26) * (1 - Math.exp(-e / 0.5)), ph = hash(j, 2) * 6.283 + e * 1.3;
      const x = CR.x + Math.cos(th) * (R + rr * Math.cos(ph)) + ca * (hash(j, 3) - 0.5) * 50, z = CR.y + Math.sin(th) * (R + rr * Math.cos(ph)) + sa * (hash(j, 3) - 0.5) * 50;
      const y = Math.max(8, rise + rr * Math.sin(ph) + (core ? -15 : 0) + (hash(j, 4) - 0.5) * 30 * (1 - Math.exp(-e)));
      const sz = (30 + 75 * (1 - Math.exp(-e / 0.6))) * (0.7 + 0.6 * hash(j, 5)) * (1 + 0.04 * e);
      const temp = Math.exp(-e / (core ? 2.6 : 1.9)), I = sstep(0, 0.12, e) * (1 - sstep(3.2, 6.5, e));
      if (I > 0.01) fPut(x + wx * e * 3, y, z + wz * e * 3, sz * Math.sqrt(kF), I, clamp(0.35 + temp * 0.75, 0, 1), hash(j, 6), 0);
      const sa2 = sstep(0.9, 3.4, e) * (1 - sstep(8, 22, e)) * 0.8;
      if (sa2 > 0.01) sPut(x + wx * e * 6, y + 9 * e, z + wz * e * 6, sz * (0.95 + e * 0.02), 0.03, 0.028, 0.026, sa2, 1, hash(j, 7) * 6.283 + e * 0.15, 0.35 * Math.exp(-e / 3), 0.55);
    }
    // ---- secondary explosions over the first seconds (fuel tanks, tyres, oxygen bottles) ----
    if (ts < 120) for (let k = 0; k < 6; k++) { const o = k * 4, de = e - CR.sec[o]; if (de < 0 || de > 6) continue; const S = CR.sec[o + 3];
      if (de < 0.25) fPut(CR.sec[o + 1], 12, CR.sec[o + 2], 120 * S * Math.sqrt(kF), (1 - de / 0.25) * 0.8, 1, 0.5, 3);
      for (let j = 0; j < 5; j++) { const th = j * 1.256 + k, r = 14 * S * (1 - Math.exp(-de / 0.5)), x = CR.sec[o + 1] + Math.cos(th) * r, z = CR.sec[o + 2] + Math.sin(th) * r, y = 10 + 45 * S * (1 - Math.exp(-de / 1.1)) + j * 4;
        const I = sstep(0, 0.08, de) * (1 - sstep(1.2, 2.6, de)); fPut(x, y, z, (22 + 30 * (1 - Math.exp(-de / 0.4))) * S * Math.sqrt(kF), I, clamp(0.3 + Math.exp(-de / 0.9) * 0.8, 0, 1), hash(k, j), 0);
        const s2 = sstep(0.6, 2.2, de) * (1 - sstep(3.5, 6, de)) * 0.75; sPut(x, y + de * 6, z, (30 + 12 * de) * S, 0.03, 0.028, 0.026, s2, 1, j + k, 0.15, 0.6); } }
    // ---- sparks: from the impact and from each secondary ----
    for (let j = 0; j < 72; j++) { const grp = j < 42 ? -1 : (j - 42) % 6, te = grp < 0 ? 0 : CR.sec[grp * 4], de = e - te, life = 1.2 + 1.6 * hash(j, 8); if (de < 0 || de > life) continue;
      const ox = grp < 0 ? CR.x : CR.sec[grp * 4 + 1], oz = grp < 0 ? CR.y : CR.sec[grp * 4 + 2], az = hash(j, 9) * 6.283, sp = 20 + 60 * hash(j, 10), vy = 15 + 45 * hash(j, 11);
      const dr = (1 - Math.exp(-de * 0.9)) / 0.9;
      fPut(ox + Math.cos(az) * sp * dr, Math.max(0.5, 6 + vy * dr - 4.9 * de * de), oz + Math.sin(az) * sp * dr, (1.6 + 1.6 * hash(j, 12)) * kF, (1 - de / life) * 1.2, 1, 0, 2); }

    // ---- sustained fire: upright flames over the burning part of the pool, tallest at the wrecks ----
    const NFL = 90, burnR = (F > 0.07 ? 0.25 + 0.75 * F : F * 3.5) * grow;
    for (let j = 0; j < NFL; j++) {
      const rk = j / NFL; if (rk > 0.15 + F * 0.9) continue;
      const r = Math.sqrt(hash(j, 13)) * burnR * 0.92, th = hash(j, 14) * 6.283, lx = Math.cos(th) * r * PRX, lz = Math.sin(th) * r * PRZ;
      const x = CR.x + ca * lx - sa * lz, z = CR.y + sa * lx + ca * lz, near = 1 - r / Math.max(burnR, 0.05);
      const fl = 0.75 + 0.25 * Math.sin(tm * (5 + 4 * hash(j, 15)) + j) + 0.12 * Math.sin(tm * 17 + j * 3);
      const h = (20 + 34 * hash(j, 16) + 60 * near * near * (j < 16 ? 1 : 0.4)) * (0.45 + 0.55 * F) * fl * sstep(0.1, 0.9, grow);
      fPut(x, 0.5, z, h * kF ** 0.7, clamp(0.8 + 0.5 * F, 0, 1.3), 0.62 + 0.18 * F, hash(j, 17), 1); }

    // ---- the column: black smoke rising ~1 km and leaning downwind, born at the fire, on its own (real-time) clock ----
    const kS = clamp(cd / 3800, 1, 2.1), L = 46, NCOL = 120, Hc = 1250 * kS * (0.8 + 0.2 * Math.max(F, 0.35)), light = mix(0.032, 0.11, FO * 0.8);
    for (let i = 0; i < NCOL; i++) { const ph = i / NCOL, cyc = Math.floor(e / L + ph), a = (e / L + ph - cyc) * L; if (cyc < 1 && a > e) continue;
      const u = a / L, s = hash(i, cyc * 1.37 + 0.5), s2 = hash(i + 7, cyc * 2.11), h = 20 + Hc * Math.pow(u, 0.72), dr = Hc * 0.62 * wK * Math.pow(u, 1.5);
      const spread = (10 + 0.22 * h / kS) * (1 + u * 0.8) * kS, ox = (s - 0.5) * spread, oz = (s2 - 0.5) * spread;
      const size = (22 + 250 * Math.pow(u, 0.9)) * (0.4 + 0.6 * kS) * (0.75 + 0.5 * hash(i, cyc + 3)) * (0.7 + 0.3 * Math.max(F, 0.3));
      const al = sstep(0, 0.04, u) * (1 - sstep(0.62, 1, u)) * mix(0.42, 0.72, Math.max(F, 0.3)) * sstep(0, 3, e);
      const c = light * (0.85 + 0.3 * s);
      sPut(CR.x + wx * dr + ox, h, CR.y + wz * dr + oz, size, c, c * 0.95, c * 0.9, al, 1, s * 6.283 + a * 0.02, F * 0.9 * Math.exp(-h / 70), 0.5 + 0.3 * u); }
    // the low plume: dark smoke rolling off the fire downwind, just above the runway
    for (let i = 0; i < 16; i++) { const L2 = 22, ph = i / 16, cyc = Math.floor(e / L2 + ph), a = (e / L2 + ph - cyc) * L2; if (cyc < 1 && a > e) continue;
      const u = a / L2, s = hash(i + 40, cyc), d = 30 + 340 * u, y = 14 + 90 * u + 25 * s;
      sPut(CR.x + wx * d + (s - 0.5) * 80, y, CR.y + wz * d + (hash(i, cyc + 9) - 0.5) * 80, 50 + 140 * u, light, light * 0.96, light * 0.92, sstep(0, 0.1, u) * (1 - sstep(0.55, 1, u)) * 0.55 * Math.max(F, 0.35) * sstep(1, 4, e), 1.4, s * 6, F * 0.5 * Math.exp(-y / 50), 0.6); }

    // ---- debris ----
    deb.visible = true; const dk = Math.max(1, Math.sqrt(kF));
    for (let i = 0; i < ND; i++) { const o = i * 14, vy = DB[o + 4], tf = (vy + Math.sqrt(vy * vy + 2 * 9.81 * DB[o + 1])) / 9.81, t = Math.min(e, tf);
      _v.set(DB[o] + DB[o + 3] * t, Math.max(DB[o + 11] * 0.5, DB[o + 1] + vy * t - 4.9 * t * t), DB[o + 2] + DB[o + 5] * t);
      _v2.set(DB[o + 6], DB[o + 7], DB[o + 8]); _q.setFromAxisAngle(_v2, DB[o + 9] * t + i);
      if (e >= tf) { _e.setFromQuaternion(_q); _e.x *= 0.1; _e.z *= 0.1; _q.setFromEuler(_e); }   // settled: lying flat-ish
      _s.set(DB[o + 10] * dk, DB[o + 11] * dk, DB[o + 12] * dk); _m.compose(_v, _q, _s); deb.setMatrixAt(i, _m); }
    deb.instanceMatrix.needsUpdate = true;

    // ---- tenders and their foam ----
    let nt = 0; const ks = clamp(Z.kEx || 1, 1, 3.4), VT = 23;
    for (let i = 0; i < NT; i++) { const o = i * 9, td = CR.tp[o + 6]; if (T < td) continue;
      let x = CR.tp[o], y = CR.tp[o + 1], hx = 0, hy = 1, d = (T - td) * VT, arrived = false;
      for (let k = 0; k < 2; k++) { const ax = CR.tp[o + 2 * k], ay = CR.tp[o + 2 * k + 1], bx = CR.tp[o + 2 * k + 2], by = CR.tp[o + 2 * k + 3], sl = Math.hypot(bx - ax, by - ay) || 1;
        hx = (bx - ax) / sl; hy = (by - ay) / sl; if (d <= sl) { x = ax + hx * d; y = ay + hy * d; break; } d -= sl; x = bx; y = by; if (k === 1) arrived = true; }
      _v.set(x, 0, y); _q.setFromAxisAngle(_v2.set(0, 1, 0), -Math.atan2(hy, hx)); _s.set(ks, ks, ks); _m.compose(_v, _q, _s); tenders.setMatrixAt(nt++, _m);
      if (!arrived) continue;
      const tArr = td + (Math.hypot(CR.tp[o + 2] - CR.tp[o], CR.tp[o + 3] - CR.tp[o + 1]) + Math.hypot(CR.tp[o + 4] - CR.tp[o + 2], CR.tp[o + 5] - CR.tp[o + 3])) / VT;
      const spray = sstep(tArr + 3, tArr + 8, T) * (1 - sstep(t0 + 1150, t0 + 1250, T)); if (spray < 0.01) continue;
      const nx = x + hx * 5.8 * ks, ny = y + hy * 5.8 * ks, nh = 4.1 * ks, dist = Math.hypot(CR.x - x, CR.y - y), reach = Math.max(20, dist - 34 - 20 * (1 - F));
      const tx = x + hx * reach, ty = y + hy * reach, apex = 14 + reach * 0.22;
      for (let j = 0; j < 18; j++) { const u = (tm * 0.8 + j / 18 + i * 0.13) % 1, px = nx + (tx - nx) * u, py = ny + (ty - ny) * u, h = nh + (0.8 - nh) * u + 4 * apex * u * (1 - u);
        const sz = (1.2 + 7 * u * u + (u > 0.85 ? 10 * (u - 0.85) / 0.15 : 0)) * Math.max(1, ks * 0.7);
        sPut(px + (hash(j, i) - 0.5) * 3 * u, h, py + (hash(i, j) - 0.5) * 3 * u, sz, 0.92, 0.93, 0.92, spray * (0.82 - 0.4 * u) , 1, j, 0, 0.45); }
      // steam where the foam meets the fire
      for (let j = 0; j < 3; j++) { const u = (tm * 0.12 + j / 3 + i * 0.3) % 1; sPut(tx + wx * 40 * u, 6 + 50 * u, ty + wz * 40 * u, 24 + 50 * u, 0.7, 0.71, 0.72, spray * F * 0.45 * (1 - u) * sstep(0, 0.15, u), 1, j + i, 0, 0.7); }
    }
    tenders.count = nt; tenders.visible = nt > 0; if (nt) tenders.instanceMatrix.needsUpdate = true;
  }
  function hideCrash() { pool.visible = false; deb.visible = false; tenders.visible = false; CR.id = null; CR.it = null; }

  /* ================================================================ fog ===================================================== */
  const FOGC = new THREE.Color('#dde2e5'), fogS = { drift: 0, dx: 0, dz: 0 };
  function updFog(dt, now) {
    const f = Z.fogF || 0;
    if (f <= 0.001) { veil.visible = false; return; }
    const A = Z.atmo, cam = Z.camera, cy = Math.max(1, cam.position.y);
    const w = A && A.wind ? A.wind : null, wd = w ? w.dir : 0.3, ws = Math.max(1.5, w ? w.speed : 4);
    fogS.dx += Math.cos(wd) * ws * dt * 1.6; fogS.dz += Math.sin(wd) * ws * dt * 1.6;
    // how deep in the fog the camera sits: 1 at runway level, ~0.4 in the tower cab, ~0 from the strategic height
    const low = 1 / (1 + Math.pow(Math.max(0, cy - 30) / 45, 1.3));
    if (A) {
      A.fogDensity = Math.max(A.fogDensity, f * (0.0043 * low + 0.00002));
      A.fogColor.lerp(FOGC, f * (0.35 + 0.65 * Math.min(1, low * 3)));
      A.skyTint.copy(FOGC); A.skyTintK = Math.max(A.skyTintK, f * clamp(low * 2.2, 0.15, 0.9));
      A.sunDim = Math.min(A.sunDim, 1 - 0.45 * f * Math.min(1, low * 2));
      if (A.grade) { A.grade.saturation *= 1 - 0.18 * f; A.grade.contrast *= 1 - 0.1 * f * Math.min(1, low * 2); }
      A.visibility = Math.min(A.visibility || 5e4, mix(5e4, 350, f));
    }
    // the veil: only layers clearly below the camera, thin from high up so the field stays readable
    const hiA = mix(0.14, 0.1, sstep(1500, 7000, cy)) * f;
    veU.uLA.value.set(hiA * sstep(12, 70, cy), hiA * sstep(24, 90, cy), hiA * 0.8 * sstep(45, 120, cy));
    veU.uDrift.value.set(-fogS.dx, -fogS.dz); veU.uCol.value.copy(A ? A.fogColor : FOGC).lerp(FOGC, 0.5);
    veil.visible = true;
    // banks around low cameras: big soft billows on a wrapped lattice that drifts with the wind
    const lk = f * (1 - sstep(250, 700, cy));
    if (lk > 0.01) { const cx = cam.position.x, cz = cam.position.z, W = 2600;
      for (let i = 0; i < 40; i++) { let bx = hash(i, 21) * W + fogS.dx * 1.2 - cx, bz = hash(i, 22) * W + fogS.dz * 1.2 - cz; bx = ((bx % W) + W) % W - W / 2; bz = ((bz % W) + W) % W - W / 2;
        const d = Math.hypot(bx, bz), sz = 160 + 220 * hash(i, 23);
        const al = lk * 0.42 * sstep(30, 170, d) * (1 - sstep(W * 0.36, W * 0.5, d)) * (0.6 + 0.4 * Math.sin(now * 0.05 + i));
        sPut(cx + bx, sz * 0.11 + 4, cz + bz, sz, FOGC.r * 0.97, FOGC.g * 0.97, FOGC.b * 0.97, al, 2.8, 0, 0, 0.9); } }
  }

  return {
    state: () => ({ crash: CR.id, e: +CR.e.toFixed(2), smoke: sN, fire: fN, fog: veil.visible }),
    update(dt, now) {
      if (!(dt > 0) || dt > 0.25) dt = 0.016;
      lightU.uTime.value = now % 3600;
      sN = 0; fN = 0;
      // shared lighting for the lit particles: the sun and sky in view space
      const cam = Z.camera; cam.updateMatrixWorld();
      if (Z.sunDir) lightU.uSunV.value.copy(Z.sunDir).transformDirection(cam.matrixWorldInverse);
      lightU.uUpV.value.set(0, 1, 0).transformDirection(cam.matrixWorldInverse);
      const s = Z.sun; if (s) lightU.uSunCol.value.copy(s.color).multiplyScalar(s.intensity / Math.PI * 0.9);
      const h = Z.hemi; if (h) { lightU.uAmbT.value.copy(h.color).multiplyScalar(h.intensity * 0.55); lightU.uAmbB.value.copy(h.groundColor).multiplyScalar(h.intensity * 0.45); }
      poU.uSunY.value = Z.sunDir ? Math.max(0.1, Z.sunDir.y) : 0.7;
      updFog(dt, now);
      const list = Z.fx; let it = null;
      if (list && list.length) for (const f of list) if (f && f.kind === 'crash' && Z.T >= f.t0 - 0.5 && Z.T <= (f.t1 || 1e9)) { it = f; break; }
      if (it) updCrash(it, dt, now); else hideCrash();
      fire.visible = fN > 0; FI.g.instanceCount = Math.max(1, fN); if (fN) { FI.aPA.needsUpdate = true; FI.aQA.needsUpdate = true; }
      sFlush();
    },
  };
};
