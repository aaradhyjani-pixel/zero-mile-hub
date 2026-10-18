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
  // Draw calls while active: fuel pool 1, smoke + fire + foam + fog banks 1 (one sorted premultiplied draw), debris 1, tenders 1,
  // fog veil 1 (5). No per-frame allocations. Every mesh is in the scene from the start, so the core's warm-up frame compiles it.
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

  /* ================================================================ smoke, fire, foam and fog banks: ONE sorted draw ====== */
  // Premultiplied alpha (One, OneMinusSrcAlpha), sorted back to front, so fire behind smoke is hidden and smoke behind fire
  // is not blended over it. Smoke outputs rgb*a; fire outputs additive rgb with a small occluding a. A slot with aR.w < 0 is
  // fire (aC = intensity, temperature, seed, kind); kinds: 0 fireball, 1 upright flame, 2 spark, 3 flash, 4 fog-scatter halo.
  // aV (xyz, stretch > 0): a world-space tangent; the quad is stretched along its screen projection (the foam jets).
  // Fog: a height-limited ground fog (the fog layer is ~120 m deep), integrated along the ray, so the column rises out of it.
  const NS = 820;
  const SM = quadSet(NS, [['aP', 4], ['aC', 4], ['aR', 4], ['aV', 4]]);
  const smU = Object.assign(FOGU(), lightU, { uFS: { value: 0 }, uFB: { value: 0 } });
  const smMat = new THREE.ShaderMaterial({ uniforms: smU, transparent: true, depthWrite: false, fog: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
    vertexShader: `attribute vec4 aP,aC,aR,aV;varying vec2 vUv;varying vec4 vC,vR;varying float vFl;
#include <fog_pars_vertex>
void main(){vUv=uv;vC=aC;vR=aR;vFl=aV.w;vec4 mvPosition;
  if(aR.w<0.&&aC.w>0.5&&aC.w<1.5){vec3 t=cameraPosition-aP.xyz;t.y=0.;float l=length(t);vec3 R=l>0.01?vec3(t.z,0.,-t.x)/l:vec3(1.,0.,0.);
    vec3 W=aP.xyz+R*position.x*aP.w*0.72+vec3(0.,(position.y+0.44)*aP.w,0.);mvPosition=viewMatrix*vec4(W,1.);}
  else{mvPosition=viewMatrix*vec4(aP.xyz,1.);
    if(aV.w>0.){vec2 d=(viewMatrix*vec4(aV.xyz,0.)).xy;float dl=length(d);d=dl>1e-4?d/dl:vec2(1.,0.);
      mvPosition.xy+=(d*position.x*aV.w*max(dl,0.3)+vec2(-d.y,d.x)*position.y)*aP.w;}
    else mvPosition.xy+=vec2(position.x*aR.x,position.y)*aP.w;}
  gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform vec3 uSunV,uUpV,uSunCol,uAmbT,uAmbB,uGlowC;uniform float uTime,uFS,uFB;varying vec2 vUv;varying vec4 vC,vR;varying float vFl;
#include <fog_pars_fragment>
${NOISE}
vec3 ramp(float t){vec3 c=mix(vec3(0.35,0.03,0.005),vec3(3.4,0.7,0.06),smoothstep(0.,0.4,t));c=mix(c,vec3(7.,2.9,0.45),smoothstep(0.35,0.75,t));return mix(c,vec3(6.,3.5,1.2),smoothstep(0.8,1.,t));}
float gF(float y){return y<120.?y:120.+60.*(1.-exp(-(y-120.)/60.));}
float gfog(){
#ifdef USE_FOG
  float d=length(vFogOff),y0=max(cameraPosition.y,0.),y1=max(cameraPosition.y+vFogOff.y,0.);
  float g=abs(y1-y0)>0.5?(gF(y1)-gF(y0))/(y1-y0):exp(-max(0.,y0-120.)/60.);
  return 1.-exp(-uFB*uFB*d*d-uFS*d*g);
#else
  return 0.;
#endif
}
void main(){vec2 p=vUv*2.-1.;float r=length(p);vec3 col;float a,ff=gfog();
  if(vR.w<0.){float I=vC.x,tp=vC.y,sd=vC.z,k=vC.w;
    if(k<0.5){if(r>1.)discard;float n=f5f(p*1.6+vec2(sd*17.,sd*9.-uTime*0.5)),n2=f5n(p*4.+sd*5.+uTime*0.8),n3=f5n(p*8.3+sd*3.-uTime*0.6);
      float d=smoothstep(1.,0.3,r+(n-0.5)*0.95+(n2-0.5)*0.35+(n3-0.5)*0.18);float t=clamp(tp*(0.5+0.8*n)*(1.2-r*0.75),0.,0.86);
      float soot=smoothstep(0.4,0.85,r+(0.5-n)*0.55)*(1.-tp*0.5);a=d*I*mix(0.95,0.5,tp);col=ramp(t)*d*I*(0.25+0.9*n)*(1.-soot*0.9)+vec3(0.02,0.017,0.015)*a;}
    else if(k<1.5){float y=vUv.y,ty=uTime;
      float x=p.x+(f5n(vec2(y*2.3-ty*1.7,sd*11.))-0.5)*1.1*y+(f5n(vec2(y*5.7-ty*3.9,sd*5.+3.))-0.5)*0.5*y;
      float n=f5f(vec2(x*2.1+sd*13.,y*2.6-ty*2.4+sd*7.)),n2=f5n(vec2(x*4.+sd,y*6.-ty*4.6));
      float w=0.6*pow(max(1.-y,0.),0.55)+0.04,e=w-abs(x)+(n-0.5)*0.55*(0.3+y);
      float sh=smoothstep(0.,0.22,e)*(1.-smoothstep(0.55,0.95,y)*smoothstep(0.4,0.62,n2))*smoothstep(1.,0.72,y+(n2-0.5)*0.35);
      float t=min(clamp((1.08-y*1.1)*(0.55+0.7*n)*tp,0.,1.),0.65)*(0.6+0.4*smoothstep(0.,0.25,e));
      col=ramp(t)*sh*I*0.28*(0.7+0.6*n2);a=sh*I*0.45;}
    else if(k<2.5){float d=smoothstep(1.,0.,r);col=vec3(9.,4.5,1.3)*d*d*I;a=0.;}
    else if(k<3.5){float d=max(exp(-r*r*6.)-0.0025,0.)*smoothstep(1.,0.75,r);float h=max(1.-r,0.);col=vec3(14.,11.,8.)*d*I+vec3(4.,1.9,0.6)*h*h*I;a=0.;}
    else{col=vec3(1.,0.42,0.12)*I*max(exp(-r*r*4.)-0.0183,0.);a=0.;ff=0.;}
    #ifdef USE_FOG
    col=col*(1.-ff)+fogColor*a*ff;
    #endif
    if(max(col.r,a)<0.002)discard;gl_FragColor=vec4(col,a);return;}
  if(r>1.)discard;
  float c=cos(vR.y),s=sin(vR.y);vec2 q=vec2(c*p.x-s*p.y,s*p.x+c*p.y);
  float n=f5f(q*1.7+vR.y*3.1+vec2(0.,uTime*0.05)),n2=f5n(q*4.3+vR.y*7.);
  float d=smoothstep(0.,vR.w,1.-r*1.3+(n-0.5)*0.9+(n2-0.5)*0.25)*smoothstep(1.,0.62,r);
  a=vC.a*d;if(a<0.003)discard;
  vec3 N=normalize(vec3(p*0.9+(vec2(n,n2)-0.5)*0.6,sqrt(max(0.,1.-r*r))+0.25));
  float w=vFl>0.?0.9:clamp(0.42+0.58*dot(N,uSunV),0.,1.);
  col=vC.rgb*(uSunCol*w+mix(uAmbB,uAmbT,0.5+0.5*dot(N,uUpV)))*(0.72+0.5*n);
  col+=uGlowC*vR.z*(0.35+0.9*n)*clamp(0.55-0.6*dot(N,uUpV),0.,1.);
  #ifdef USE_FOG
  col=mix(col,fogColor,ff);
  #endif
  gl_FragColor=vec4(col*a,a);
}` });
  const smoke = new THREE.Mesh(SM.g, smMat); smoke.frustumCulled = false; smoke.renderOrder = 7; smoke.visible = false; root.add(smoke);
  // staging: 16 floats per slot, a persistent depth order (nearly sorted frame to frame, so insertion sort is ~linear)
  const SW = 16, ST = new Float32Array(NS * SW), KEY = new Float32Array(NS), ORD = new Int32Array(NS); for (let i = 0; i < NS; i++) ORD[i] = i;
  let sN = 0, fN = 0;
  const put = (x, y, z, size, c0, c1, c2, c3, r0, r1, r2, r3, v0, v1, v2, v3) => { const o = sN * SW;
    ST[o] = x; ST[o + 1] = y; ST[o + 2] = z; ST[o + 3] = size; ST[o + 4] = c0; ST[o + 5] = c1; ST[o + 6] = c2; ST[o + 7] = c3;
    ST[o + 8] = r0; ST[o + 9] = r1; ST[o + 10] = r2; ST[o + 11] = r3; ST[o + 12] = v0; ST[o + 13] = v1; ST[o + 14] = v2; ST[o + 15] = v3; sN++; };
  const sPut = (x, y, z, size, r, g, b, a, asp, rot, glow, soft) => { if (sN >= NS || a < 0.003 || size <= 0) return; put(x, y, z, size, r, g, b, a, asp, rot, glow, soft, 0, 0, 0, 0); };
  // a jet segment: stretched along the world tangent (tx, ty, tz), flat-lit
  const jPut = (x, y, z, size, r, g, b, a, tx, ty, tz, st) => { if (sN >= NS || a < 0.003 || size <= 0) return; put(x, y, z, size, r, g, b, a, 1, x * 0.01, 0, 0.45, tx, ty, tz, st); };
  const fPut = (x, y, z, size, I, temp, seed, kind) => { if (sN >= NS || I < 0.004 || size <= 0) return; fN++; put(x, y, z, size, I, temp, seed, kind, 1, 0, 0, -1, 0, 0, 0, 0); };
  function sFlush() {
    const cp = Z.camera.position;
    for (let i = 0; i < NS; i++) { const o = i * SW; KEY[i] = i < sN ? (ST[o] - cp.x) ** 2 + (ST[o + 1] - cp.y) ** 2 + (ST[o + 2] - cp.z) ** 2 : -1; }
    for (let i = 1; i < NS; i++) { const v = ORD[i], k = KEY[v]; let j = i - 1; while (j >= 0 && KEY[ORD[j]] < k) { ORD[j + 1] = ORD[j]; j--; } ORD[j + 1] = v; }
    const P = SM.aP, C = SM.aC, R = SM.aR, V = SM.aV;
    for (let i = 0; i < sN; i++) { const o = ORD[i] * SW, d = i * 4;
      P[d] = ST[o]; P[d + 1] = ST[o + 1]; P[d + 2] = ST[o + 2]; P[d + 3] = ST[o + 3]; C[d] = ST[o + 4]; C[d + 1] = ST[o + 5]; C[d + 2] = ST[o + 6]; C[d + 3] = ST[o + 7];
      R[d] = ST[o + 8]; R[d + 1] = ST[o + 9]; R[d + 2] = ST[o + 10]; R[d + 3] = ST[o + 11]; V[d] = ST[o + 12]; V[d + 1] = ST[o + 13]; V[d + 2] = ST[o + 14]; V[d + 3] = ST[o + 15]; }
    smoke.visible = sN > 0; SM.g.instanceCount = Math.max(1, sN);
    if (sN) { SM.aPA.needsUpdate = true; SM.aCA.needsUpdate = true; SM.aRA.needsUpdate = true; SM.aVA.needsUpdate = true; }
  }

  /* ================================================================ the fuel pool: scorch, burning fuel, foam blanket ===== */
  // The foam grows from each tender's impact point (uFm: local x, z, radius, 1) instead of covering the scorch at once.
  const PRX = 90, PRZ = 50;   // pool radii (m) along and across the runway
  const poolGeo = new THREE.PlaneGeometry(PRX * 4, PRZ * 4); poolGeo.rotateX(-Math.PI / 2);
  const FM = []; for (let i = 0; i < 5; i++) FM.push(new THREE.Vector4());
  const poU = Object.assign(FOGU(), { uTime: lightU.uTime, uSunCol: lightU.uSunCol, uAmbT: lightU.uAmbT, uSunY: { value: 0.7 }, uSunL: { value: new THREE.Vector2(0.5, 0.5) }, uGrow: { value: 0 }, uBurn: { value: 1 }, uFm: { value: FM }, uRad: { value: new THREE.Vector2(PRX, PRZ) } });
  const poMat = new THREE.ShaderMaterial({ uniforms: poU, transparent: true, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
    vertexShader: `varying vec2 vL;
#include <fog_pars_vertex>
void main(){vL=position.xz;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform float uTime,uSunY,uGrow,uBurn;uniform vec3 uSunCol,uAmbT;uniform vec2 uRad,uSunL;uniform vec4 uFm[5];varying vec2 vL;
#include <fog_pars_fragment>
${NOISE}
void main(){vec2 q=vL/uRad;float n=f5f(vL*0.04+3.1),n2=f5f(vL*0.11+11.);
  float d=length(q)+(n-0.5)*0.6;float g=max(uGrow,1e-3);
  float ch=(1.-smoothstep(g*1.2,g*1.5,d+(n2-0.5)*0.3))*(1.-smoothstep(0.75,0.98,max(abs(vL.x)/(uRad.x*2.),abs(vL.y)/(uRad.y*2.))));if(ch<0.004)discard;
  float fuel=1.-smoothstep(g*0.9,g*1.02,d);
  float foam=0.;for(int i=0;i<5;i++){vec4 f=uFm[i];if(f.z>0.5)foam=max(foam,1.-smoothstep(f.z*0.62,f.z,length(vL-f.xy)+(n2-0.5)*f.z*0.55));}
  foam*=ch;
  float burn=fuel*(1.-smoothstep(uBurn*g*0.75,uBurn*g+0.03,d+(n2-0.5)*0.3))*(1.-foam)*step(0.001,uBurn);
  float fl=f5f(vL*0.06+vec2(0.,-uTime*0.9)),fl2=f5n(vL*0.18+vec2(uTime*0.7,-uTime*1.7)),mot=smoothstep(0.3,0.62,f5n(vL*0.09+vec2(uTime*0.15,0.)));
  vec3 alb=mix(vec3(0.016,0.015,0.014),vec3(0.035,0.03,0.026),fuel*(0.5+0.5*n2));
  float lump=f5n(vL*0.7),lx=f5n(vL*0.7+vec2(0.6,0.)),lz=f5n(vL*0.7+vec2(0.,0.6));
  float fsh=clamp(0.78+1.6*((lump-lx)*uSunL.x+(lump-lz)*uSunL.y),0.45,1.15);
  vec3 fa=vec3(0.88,0.89,0.87)*mix(0.45,1.,smoothstep(8.,45.,length(vL)+n*20.));
  vec3 col=mix(alb*(uSunCol*uSunY+uAmbT),fa*(uSunCol*uSunY*fsh+uAmbT*1.15),foam);
  col+=mix(vec3(0.9,0.22,0.03),vec3(1.5,0.5,0.08),fl*fl2)*burn*(0.3+0.7*fl)*(0.35+0.65*mot)*(0.8+0.2*sin(uTime*13.+n*20.));
  gl_FragColor=vec4(col,max(ch*0.93,foam));
  #include <fog_fragment>
}` });
  const pool = new THREE.Mesh(poolGeo, poMat); pool.frustumCulled = false; pool.renderOrder = 5; pool.visible = false; pool.position.y = 0.35; root.add(pool);

  /* ================================================================ debris: crumpled, mostly charred panels =============== */
  const ND = 72;
  const debMat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.4, side: THREE.DoubleSide });
  const debGeo = (() => { const g = new THREE.PlaneGeometry(1, 1, 4, 4); g.rotateX(-Math.PI / 2); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, (hash(i, 31) - 0.5) * 0.32 + 0.45 * x * x - 0.2 * z * x + 0.12 * Math.sin(z * 7)); }
    g.computeVertexNormals(); return g; })();
  const deb = new THREE.InstancedMesh(debGeo, debMat, ND); deb.frustumCulled = false; deb.visible = false; deb.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  deb.setColorAt(0, _c.setRGB(0.1, 0.1, 0.1)); root.add(deb);
  const DB = new Float32Array(ND * 14);   // p0 xyz, v xyz, axis xyz, w, scale xyz, (unused)

  /* ================================================================ ARFF crash tenders ==================================== */
  const NT = 5;
  const tenderGeo = (() => {
    const P = [], N = [], C = [], E = [], I = [];
    const add = (g, hex, em) => { const p = g.attributes.position, n = g.attributes.normal, base = P.length / 3; _c.set(hex);
      for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); C.push(_c.r, _c.g, _c.b); E.push(em || 0); }
      if (g.index) { const ix = g.index.array; for (let i = 0; i < ix.length; i++) I.push(base + ix[i]); } else for (let i = 0; i < p.count; i++) I.push(base + i); g.dispose(); };
    const box = (x, y, z, sx, sy, sz, hex, em, rz, ry) => { const g = new THREE.BoxGeometry(sx, sy, sz); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z); add(g, hex, em); };
    const cyl = (x, y, z, r0, r1, h, seg, hex, rx, rz, em) => { const g = new THREE.CylinderGeometry(r0, r1, h, seg); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y, z); add(g, hex, em); };
    const RED = '#c0101a', DRED = '#9a0c14', GL = '#0d1a20', YEL = '#f0d20a';
    box(0.3, 0.03, 0, 13.6, 0.04, 4.1, '#0c0c0c', 3);                                    // contact shadow
    box(0.2, 0.95, 0, 11.6, 0.5, 2.4, '#1c1c1c');
    for (const x of [4.2, -1.7, -3.6]) for (const z of [-1.27, 1.27]) { cyl(x, 0.66, z, 0.66, 0.66, 0.6, 16, '#121212', Math.PI / 2); cyl(x, 0.66, z + Math.sign(z) * 0.31, 0.34, 0.34, 0.04, 10, '#9a9a9a', Math.PI / 2); }
    // cab: lower body, sloped glazed screen between pillars, side glass, red roof
    box(5.0, 1.75, 0, 2.6, 1.3, 2.92, RED); box(4.75, 3.05, 0, 2.1, 0.12, 2.86, DRED);
    box(6.1, 2.55, 0, 0.07, 1.25, 2.6, GL, 0, -0.32); for (const z of [-1.4, 1.4]) { box(6.1, 2.55, z, 0.16, 1.3, 0.12, RED, 0, -0.32); box(4.9, 2.55, z * 1.01, 1.9, 1.0, 0.05, GL); box(3.82, 2.45, z, 0.18, 1.2, 0.14, RED); }
    box(4.75, 2.0, 0, 1.6, 0.4, 2.9, RED);
    box(6.4, 1.05, 0, 0.3, 0.42, 3.0, '#d6d6d6');
    for (const z of [-1.1, 1.1]) box(6.56, 1.33, z, 0.06, 0.22, 0.42, '#ffffff', 2);
    // body with bevelled top edges, lockers, reflective stripe
    box(-1.3, 2.15, 0, 9.3, 2.1, 2.96, RED); box(-1.3, 3.27, 0, 9.3, 0.18, 2.7, RED);
    for (const z of [-1.4, 1.4]) box(-1.3, 3.2, z, 9.3, 0.14, 0.16, RED, 0, 0, 0);
    for (const x of [2.0, -0.8, -3.6]) box(x, 2.15, 0, 2.4, 1.4, 3.0, '#b9bcc0');
    box(0.2, 1.22, 0, 12.2, 0.2, 3.02, YEL); box(-1.3, 2.98, 0, 9.32, 0.1, 3.0, '#f4f4f0');
    // roof: red with yellow and white chevrons
    box(-1.3, 3.38, 0, 9.0, 0.05, 2.6, DRED);
    for (let k = 0; k < 4; k++) { const x = -5.0 + k * 1.1, hx = k % 2 ? '#f4f4f0' : YEL; box(x, 3.42, -0.62, 0.35, 0.03, 1.5, hx, 0, 0, 0.75); box(x, 3.42, 0.62, 0.35, 0.03, 1.5, hx, 0, 0, -0.75); }
    // light bar (flashing red/blue) and rear beacons
    box(5.0, 3.18, 0, 0.4, 0.18, 2.1, '#333333', 1);
    box(-5.95, 2.9, 0, 0.08, 0.3, 2.4, '#ff2010', 4);
    // roof turret and nozzle
    cyl(3.3, 3.55, 0, 0.42, 0.5, 0.35, 12, '#d8d8d8'); cyl(3.9, 3.95, 0, 0.12, 0.2, 1.7, 10, '#e2e2e2', 0, -1.2); cyl(4.7, 4.25, 0, 0.17, 0.13, 0.25, 10, '#222222', 0, -1.2);
    // front bumper turret
    cyl(6.7, 0.95, 0, 0.08, 0.12, 0.8, 8, '#d0d0d0', 0, -1.4);
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

  /* ================================================================ fog veil: three drifting layers with banks and gaps ==== */
  // Layers at 3, 9 and 16 m, so tails and the terminal roof poke out; runways are masked to half density so they stay readable.
  const veilGeo = (() => {
    const P = [], L = [], I = [], S = 30000, Y = [3, 9, 16];
    for (let l = 0; l < 3; l++) { const b = l * 4; P.push(-S, Y[l], -S, S, Y[l], -S, S, Y[l], S, -S, Y[l], S); L.push(l, l, l, l); I.push(b, b + 2, b + 1, b, b + 3, b + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aL', new THREE.Float32BufferAttribute(L, 1)); g.setIndex(I);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6); return g;
  })();
  const RWU = []; for (let i = 0; i < 6; i++) RWU.push(new THREE.Vector4());
  { let k = 0; for (const r of Z.RW || []) { if (k >= 6) break; if (Number.isFinite(r.x0) && Number.isFinite(r.x1) && Number.isFinite(r.y)) RWU[k++].set(Math.min(r.x0, r.x1), Math.max(r.x0, r.x1), r.y, (r.w || r.width || 45) / 2 + 12); } }
  const veU = Object.assign(FOGU(), { uTime: lightU.uTime, uLA: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color('#eef1f3') }, uWarm: { value: new THREE.Color(1, 0.86, 0.66) },
    uSunXZ: { value: new THREE.Vector2(0.6, 0.6) }, uDrift: { value: new THREE.Vector2() }, uCen: { value: new THREE.Vector2(-500, 0) }, uRw: { value: RWU } });
  const veMat = new THREE.ShaderMaterial({ uniforms: veU, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    vertexShader: `attribute float aL;varying float vL;varying vec3 vW;
#include <fog_pars_vertex>
void main(){vL=aL;vW=position;vec4 mvPosition=viewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform vec3 uLA,uCol,uWarm;uniform vec2 uDrift,uCen,uSunXZ;uniform vec4 uRw[6];varying float vL;varying vec3 vW;
#include <fog_pars_fragment>
${NOISE}
void main(){float la=vL<0.5?uLA.x:vL<1.5?uLA.y:uLA.z;if(la<0.002)discard;
  vec2 p=vW.xz+uDrift*(1.+vL*0.35);
  float n=f5f(p/1300.+vL*5.3),n2=f5f(p/380.+vL*2.1+9.);
  float dn=smoothstep(0.28,0.82,n*0.78+n2*0.32);
  float edge=1.-smoothstep(8500.,14000.,length(vW.xz-uCen));
  float rm=0.;for(int i=0;i<6;i++){vec4 r=uRw[i];if(r.w>0.)rm=max(rm,(1.-smoothstep(r.w,r.w+60.,abs(vW.z-r.z)))*(1.-smoothstep(0.,80.,max(r.x-vW.x,vW.x-r.y))));}
  float a=la*(0.05+0.4*smoothstep(0.45,0.75,dn))*edge*(1.-0.5*rm);if(a<0.002)discard;
  float hl=clamp((n-f5n((p+uSunXZ*90.)/1300.*2.03+vL*5.3+7.1))*2.5,0.,1.)*smoothstep(0.35,0.7,dn);
  gl_FragColor=vec4(uCol*(0.95+0.08*n2)+uWarm*hl*0.22,a);
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
    for (let i = 0; i < NT; i++) { const th = base + off[i], R = 74 + 12 * (i % 2), fx = CR.x + Math.cos(th) * R, fy = CR.y + Math.sin(th) * R, o = i * 9;
      CR.tp[o] = CR.st[0] + (i - 2) * 7; CR.tp[o + 1] = CR.st[1] - sd * 60; CR.tp[o + 2] = CR.x + (fx - CR.x) * 2.3; CR.tp[o + 3] = CR.y + sd * 200 + (i - 2) * 6;
      CR.tp[o + 4] = fx; CR.tp[o + 5] = fy; CR.tp[o + 6] = it.t0 + 40 + i * 5 + rnd() * 3; CR.tp[o + 7] = 0; CR.tp[o + 8] = 0; }
    // debris thrown mostly along the roll, some sideways; at most ~250 m
    const ca = Math.cos(CR.ax), sa = Math.sin(CR.ax);
    for (let i = 0; i < ND; i++) { const o = i * 14, along = (rnd() < 0.7 ? 1 : -0.6) * (6 + 30 * rnd() ** 1.5), side = (rnd() - 0.5) * 36, vy = 5 + 20 * rnd() ** 1.3;
      DB[o] = CR.x + (rnd() - 0.5) * 30; DB[o + 1] = 3 + 8 * rnd(); DB[o + 2] = CR.y + (rnd() - 0.5) * 16;
      DB[o + 3] = ca * along - sa * side; DB[o + 4] = vy; DB[o + 5] = sa * along + ca * side;
      _v.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(); DB[o + 6] = _v.x; DB[o + 7] = _v.y; DB[o + 8] = _v.z; DB[o + 9] = 2 + 8 * rnd();
      const big = i < 6; DB[o + 10] = big ? 4 + 5 * rnd() : 0.8 + 2.8 * rnd() ** 2; DB[o + 11] = big ? 1.5 + rnd() : 0.6 + 0.8 * rnd(); DB[o + 12] = big ? 2.5 + 4 * rnd() : 0.6 + 2.2 * rnd();
      const k = rnd(), ch = 0.03 + 0.12 * rnd();
      if (k < 0.72) _c.setRGB(ch, ch * 0.95, ch * 0.9); else if (k < 0.86) _c.setRGB(0.5, 0.52, 0.55); else if (k < 0.95) _c.setRGB(0.62, 0.24, 0.04); else _c.setRGB(0.75, 0.75, 0.73);
      deb.setColorAt(i, _c); }
    deb.instanceColor.needsUpdate = true;
    for (let k = 0; k < 6; k++) { const o = k * 4; CR.sec[o] = [1.3, 2.4, 3.6, 5.1, 6.9, 8.8][k] + rnd() * 0.4; CR.sec[o + 1] = CR.x + ca * (rnd() - 0.4) * 110 + (rnd() - 0.5) * 30; CR.sec[o + 2] = CR.y + sa * (rnd() - 0.4) * 110 + (rnd() - 0.5) * 30; CR.sec[o + 3] = 0.6 + 0.6 * rnd(); }
    for (let i = 0; i < 5; i++) FM[i].set(0, 0, 0, 0);
  }

  // fire intensity (sim time): full for a minute, then the foam knocks it down over ~15 minutes to a few smouldering spots
  const fireK = (T, t0) => T - t0 < 60 ? 1 : 1 - 0.94 * sstep(t0 + 60, t0 + 960, T);
  const foamK = (T, t0) => sstep(t0 + 75, t0 + 900, T);
  const WARM = new THREE.Color('#ff8a3a'), FMW = new Float32Array(15);

  function updCrash(it, dt, now) {
    if (CR.id !== it.id || CR.it !== it) setup(it);
    const T = Z.T || 0, t0 = it.t0;
    CR.e = Math.max(CR.e + dt, (T - t0) / 20); const e = CR.e;
    const cam = Z.camera, cd = Math.hypot(cam.position.x - CR.x, cam.position.y, cam.position.z - CR.y), fogF = Z.fogF || 0;
    const kF = clamp(cd / 2600, 1, 2.8);   // flames and sparks grow with distance so the fire reads from the strategic view
    const F = fireK(T, t0), FO = foamK(T, t0), grow = 1 - Math.exp(-e / 1.6), FF = mix(0.3, 1, F);
    const A = Z.atmo, w = A && A.wind ? A.wind : null, wd = w ? w.dir : 0.3, ws = w ? w.speed : 4, wx = Math.cos(wd), wz = Math.sin(wd), wK = clamp(ws / 5, 0.35, 1.5);
    const tm = lightU.uTime.value, ca = Math.cos(CR.ax), sa = Math.sin(CR.ax);

    // ---- pool ----
    pool.visible = true; pool.position.x = CR.x; pool.position.z = CR.y; pool.rotation.y = -CR.ax;
    poU.uGrow.value = grow; poU.uBurn.value = F > 0.07 ? clamp(0.25 + 0.75 * F, 0, 1) : F * 3.5;

    // ---- flash: a small lift of the scene light only; in fog the fog itself lights up orange ----
    let fk = 0;
    if (e < 0.7) { fk = (1 - e / 0.7) ** 2; fPut(CR.x, 25 + 60 * e, CR.y, (260 + 500 * e) * Math.sqrt(kF), fk * 1.2, 1, 0.3, 3);
      if (A) { A.lightning = Math.max(A.lightning || 0, Math.min(0.15, fk * 0.15 * clamp(1.6 - cd / 6000, 0.3, 1))); if (A.grade) A.grade.exposure *= 1 + 0.06 * fk; } }
    const ballI = sstep(0, 0.12, e) * (1 - sstep(3.2, 6.5, e));
    if (A && A.fogColor) { const near = Math.exp(-cd / 3000), fz = clamp(fogF * 1.5, 0.25, 1);
      const wk = Math.max(0.6 * fk, 0.32 * (1 - sstep(2, 8, e)), 0.1 * F * fogF) * near * fz; if (wk > 0.002) A.fogColor.lerp(WARM, Math.min(0.6, wk)); }
    // light scattered by the fog: one large unfogged halo over the fire
    if (fogF > 0.01) fPut(CR.x, 30, CR.y, 900, fogF * (0.22 * F * grow + 0.9 * ballI + 1.6 * fk), 0, 0, 4);

    // ---- the fireball: a rolling torus of fire that climbs ~150 m and cools; matching smoke takes over as it cools ----
    const NB = 26;
    if (e < 26) for (let j = 0; j < NB; j++) {
      const th = j / NB * 6.283 + hash(j, 1) * 0.4, core = j < 6, rise = 150 * (1 - Math.exp(-e / 2.4)) + 4 * e, lr = 0.7 + 0.6 * hash(j, 8);
      const R = (core ? 8 : 38 * lr) * (1 - Math.exp(-e / 0.7)) + e * 2.5, rr = (core ? 6 : 26 * lr) * (1 - Math.exp(-e / 0.5)), ph = hash(j, 2) * 6.283 + e * 1.3;
      const x = CR.x + Math.cos(th) * (R + rr * Math.cos(ph)) + ca * (hash(j, 3) - 0.5) * 50, z = CR.y + Math.sin(th) * (R + rr * Math.cos(ph)) + sa * (hash(j, 3) - 0.5) * 50;
      const y = Math.max(8, rise + rr * Math.sin(ph) + (core ? -15 : 0) + (hash(j, 4) - 0.5) * 30 * (1 - Math.exp(-e)));
      const sz = (30 + 75 * (1 - Math.exp(-e / 0.6))) * (0.55 + 0.8 * hash(j, 5)) * (1 + 0.04 * e);
      const temp = Math.exp(-e / (core ? 2.6 : 1.9));
      if (ballI > 0.01) fPut(x + wx * e * 3, y, z + wz * e * 3, sz * Math.sqrt(kF), ballI, clamp(0.3 + temp * 0.7, 0, 1), hash(j, 6), 0);
      const sa2 = sstep(0.9, 3.4, e) * (1 - sstep(8, 22, e)) * 0.8;
      if (sa2 > 0.01) sPut(x + wx * e * 6, y + 9 * e, z + wz * e * 6, sz * (0.95 + e * 0.02), 0.022, 0.02, 0.019, sa2, 1, hash(j, 7) * 6.283 + e * 0.15, 0.35 * Math.exp(-e / 3), 0.6);
    }
    // ---- secondary explosions over the first seconds (fuel tanks, tyres, oxygen bottles): real-time gate ----
    if (e < 16) for (let k = 0; k < 6; k++) { const o = k * 4, de = e - CR.sec[o]; if (de < 0 || de > 6) continue; const S = CR.sec[o + 3];
      if (de < 0.25) fPut(CR.sec[o + 1], 12, CR.sec[o + 2], 120 * S * Math.sqrt(kF), (1 - de / 0.25) * 0.7, 1, 0.5, 3);
      for (let j = 0; j < 5; j++) { const th = j * 1.256 + k, r = 14 * S * (1 - Math.exp(-de / 0.5)), x = CR.sec[o + 1] + Math.cos(th) * r, z = CR.sec[o + 2] + Math.sin(th) * r, y = 10 + 45 * S * (1 - Math.exp(-de / 1.1)) + j * 4;
        const I = sstep(0, 0.08, de) * (1 - sstep(1.2, 2.6, de)); fPut(x, y, z, (22 + 30 * (1 - Math.exp(-de / 0.4))) * S * (0.7 + 0.6 * hash(k, j + 9)) * Math.sqrt(kF), I, clamp(0.3 + Math.exp(-de / 0.9) * 0.7, 0, 1), hash(k, j), 0);
        const s2 = sstep(0.6, 2.2, de) * (1 - sstep(3.5, 6, de)) * 0.75; sPut(x, y + de * 6, z, (30 + 12 * de) * S, 0.022, 0.02, 0.019, s2, 1, j + k, 0.15, 0.6); } }
    // ---- sparks: from the impact and from each secondary ----
    for (let j = 0; j < 72; j++) { const grp = j < 42 ? -1 : (j - 42) % 6, te = grp < 0 ? 0 : CR.sec[grp * 4], de = e - te, life = 1.2 + 1.6 * hash(j, 8); if (de < 0 || de > life) continue;
      const ox = grp < 0 ? CR.x : CR.sec[grp * 4 + 1], oz = grp < 0 ? CR.y : CR.sec[grp * 4 + 2], az = hash(j, 9) * 6.283, sp = 20 + 60 * hash(j, 10), vy = 15 + 45 * hash(j, 11);
      const dr = (1 - Math.exp(-de * 0.9)) / 0.9;
      fPut(ox + Math.cos(az) * sp * dr, Math.max(0.5, 6 + vy * dr - 4.9 * de * de), oz + Math.sin(az) * sp * dr, (1.6 + 1.6 * hash(j, 12)) * kF, (1 - de / life) * 1.2, 1, 0, 2); }

    // ---- tenders: positions, and the foam each one lays from its impact point (radius grows with spray time) ----
    let nt = 0; const ks = clamp(Z.kEx || 1, 1, 3.4), VT = 23;
    for (let i = 0; i < NT; i++) { const o = i * 9, td = CR.tp[o + 6]; FMW[i * 3 + 2] = 0; FM[i].z = 0; if (T < td) continue;
      let x = CR.tp[o], y = CR.tp[o + 1], hx = 0, hy = 1, d = (T - td) * VT, arrived = false;
      for (let k = 0; k < 2; k++) { const ax = CR.tp[o + 2 * k], ay = CR.tp[o + 2 * k + 1], bx = CR.tp[o + 2 * k + 2], by = CR.tp[o + 2 * k + 3], sl = Math.hypot(bx - ax, by - ay) || 1;
        hx = (bx - ax) / sl; hy = (by - ay) / sl; if (d <= sl) { x = ax + hx * d; y = ay + hy * d; break; } d -= sl; x = bx; y = by; if (k === 1) arrived = true; }
      _v.set(x, 0, y); _q.setFromAxisAngle(_v2.set(0, 1, 0), -Math.atan2(hy, hx)); _s.set(ks, ks, ks); _m.compose(_v, _q, _s); tenders.setMatrixAt(nt++, _m);
      if (!arrived) continue;
      const tArr = td + (Math.hypot(CR.tp[o + 2] - CR.tp[o], CR.tp[o + 3] - CR.tp[o + 1]) + Math.hypot(CR.tp[o + 4] - CR.tp[o + 2], CR.tp[o + 5] - CR.tp[o + 3])) / VT;
      const dist = Math.hypot(CR.x - x, CR.y - y), reach = Math.max(18, dist - 26 - 14 * (1 - F)), tx = x + hx * reach, ty = y + hy * reach;
      const fr = T > tArr + 3 ? 6 + 58 * Math.pow(sstep(tArr + 3, tArr + 640, T), 0.7) : 0;
      if (fr > 0) { const dx = tx - CR.x, dz = ty - CR.y; FM[i].set(dx * ca + dz * sa, -dx * sa + dz * ca, fr, 1); FMW[i * 3] = tx; FMW[i * 3 + 1] = ty; FMW[i * 3 + 2] = fr;
        // low white mounds give the blanket some volume
        for (let j = 0; j < 5; j++) { const ang = hash(i, j + 50) * 6.283, rr = Math.sqrt(hash(j, i + 60)) * fr * 0.75, sz = (3.5 + 4.5 * hash(i + 3, j)) * Math.min(1, fr / 25);
          sPut(tx + Math.cos(ang) * rr, 0.8 + sz * 0.12, ty + Math.sin(ang) * rr, sz, 0.86, 0.87, 0.86, 0.6, 2.2, j + i * 5, 0, 0.5); } }
      const spray = sstep(tArr + 3, tArr + 8, T) * (1 - sstep(t0 + 1150, t0 + 1250, T)); if (spray < 0.01) continue;
      const nx = x + hx * 5.2 * ks, ny = y + hy * 5.2 * ks, nh = 4.3 * ks, apex = 12 + reach * 0.2, ddx = tx - nx, ddz = ty - ny;
      for (let j = 0; j < 36; j++) { const u = (tm * 0.8 + j / 36 + i * 0.13) % 1, h = nh + (0.8 - nh) * u + 4 * apex * u * (1 - u);
        const px = nx + ddx * u + (hash(j, i) - 0.5) * 2 * u, pz = ny + ddz * u + (hash(i, j) - 0.5) * 2 * u;
        if (u < 0.84) { const dy = (0.8 - nh) + 4 * apex * (1 - 2 * u), tl = Math.hypot(ddx, dy, ddz) || 1;
          jPut(px, h, pz, (1.1 + 2.2 * u) * Math.max(1, ks * 0.7), 0.95, 0.96, 0.96, spray * (0.75 - 0.35 * u), ddx / tl, dy / tl, ddz / tl, 5); }
        else sPut(px, h, pz, (4 + 26 * (u - 0.84) / 0.16) * Math.max(1, ks * 0.7), 0.92, 0.93, 0.93, spray * 0.55 * (1 - (u - 0.84) / 0.16 * 0.6), 1.6, j, 0, 0.6); }
      // steam where the foam meets the fire
      for (let j = 0; j < 3; j++) { const u = (tm * 0.12 + j / 3 + i * 0.3) % 1; sPut(tx + wx * 40 * u, 6 + 50 * u, ty + wz * 40 * u, 24 + 50 * u, 0.7, 0.71, 0.72, spray * F * 0.45 * (1 - u) * sstep(0, 0.15, u), 1, j + i, 0, 0.7); }
    }
    tenders.count = nt; tenders.visible = nt > 0; if (nt) tenders.instanceMatrix.needsUpdate = true;
    const inFoam = (x, z) => { for (let i = 0; i < 5; i++) { const r = FMW[i * 3 + 2]; if (r > 0 && (x - FMW[i * 3]) ** 2 + (z - FMW[i * 3 + 1]) ** 2 < r * r * 0.6) return true; } return false; };

    // ---- sustained fire: ~16 tall flames at the wrecks, shorter tongues over the rest of the burning fuel ----
    const NFL = 46, burnR = (F > 0.07 ? 0.25 + 0.75 * F : F * 3.5) * grow, gk = sstep(0.1, 0.9, grow);
    for (let j = 0; j < NFL; j++) {
      const tall = j < 16, rk = j / NFL; if (rk > 0.2 + F * 0.85) continue;
      const r = Math.sqrt(hash(j, 13)) * burnR * (tall ? 0.32 : 0.92), th = hash(j, 14) * 6.283, lx = Math.cos(th) * r * PRX, lz = Math.sin(th) * r * PRZ;
      const x = CR.x + ca * lx - sa * lz, z = CR.y + sa * lx + ca * lz; if (inFoam(x, z)) continue;
      const fl = 0.8 + 0.2 * Math.sin(tm * (5 + 4 * hash(j, 15)) + j) + 0.1 * Math.sin(tm * 17 + j * 3);
      const h = (tall ? 40 + 40 * hash(j, 16) : 10 + 20 * hash(j, 16)) * (0.45 + 0.55 * F) * fl * gk;
      fPut(x, 0.5, z, h * kF ** 0.7, clamp(0.85 + 0.4 * F, 0, 1.25), 1, hash(j, 17), 1);
      // black smoke wrapping the tall flame tops
      if (tall && h > 4) sPut(x + wx * h * 0.15, h * kF ** 0.7 * 0.92, z + wz * h * 0.15, h * 0.75 * kF ** 0.7, 0.02, 0.019, 0.018, 0.55 * FF * gk, 1, j, F * 0.35, 0.6); }

    // ---- the column: jet-black smoke rising ~0.9 km and leaning downwind, born at the fire, on its own (real-time) clock ----
    // after the knock-down it thins to a pale 300 m steam plume
    const kS = clamp(cd / 3800, 1, 2.1), L = 46, NCOL = 170, Hc = 900 * (0.85 + 0.15 * kS) * FF, light = mix(0.02, 0.38, (1 - F) * FO);
    for (let i = 0; i < NCOL; i++) { const ph = i / NCOL, cyc = Math.floor(e / L + ph), a = (e / L + ph - cyc) * L; if (cyc < 1 && a > e) continue;
      const u = a / L, s = hash(i, cyc * 1.37 + 0.5), s2 = hash(i + 7, cyc * 2.11), h = 15 + Hc * Math.pow(u, 0.9), dr = Hc * 0.62 * wK * Math.pow(u, 1.5);
      const spread = (14 + 0.22 * h / kS) * (1 + u * 0.8) * kS, ox = (s - 0.5) * spread, oz = (s2 - 0.5) * spread;
      const size = (52 + 240 * Math.pow(u, 0.9)) * (0.4 + 0.6 * kS) * (0.75 + 0.5 * hash(i, cyc + 3)) * mix(0.4, 1, F);
      const al = sstep(0, 0.04, u) * (1 - sstep(0.62, 1, u)) * 0.66 * mix(0.45, 1, F) * sstep(0, 3, e);
      const c = light * (0.85 + 0.3 * s), px = wx * dr + ox, pz = wz * dr + oz;
      sPut(CR.x + px, h, CR.y + pz, size, c, c * 0.97, c * 0.94, al, 1, s * 6.283 + a * 0.02, F * 0.8 * Math.exp(-Math.hypot(px, h, pz) / 28), 0.55 + 0.3 * u); }
    // a wide, faint body pass over the lower third, so the base is a solid trunk, not beads
    for (let i = 0; i < 26; i++) { const L3 = 30, ph = i / 26, cyc = Math.floor(e / L3 + ph), a = (e / L3 + ph - cyc) * L3; if (cyc < 1 && a > e) continue;
      const u = a / L3, s = hash(i + 90, cyc), h = 20 + Hc * 0.36 * u, dr = Hc * 0.62 * wK * Math.pow(u * 0.36, 1.5);
      sPut(CR.x + wx * dr + (s - 0.5) * 40, h, CR.y + wz * dr + (hash(i, cyc + 5) - 0.5) * 40, (110 + 160 * u) * (0.4 + 0.6 * kS) * mix(0.4, 1, F), light, light * 0.97, light * 0.94,
        sstep(0, 0.1, u) * (1 - sstep(0.6, 1, u)) * 0.3 * mix(0.45, 1, F) * sstep(0, 4, e), 1, s * 6, F * 0.4 * Math.exp(-h / 35), 0.8); }
    // the low plume: dark smoke rolling off the fire downwind, just above the runway; only the part near the flames glows
    for (let i = 0; i < 16; i++) { const L2 = 22, ph = i / 16, cyc = Math.floor(e / L2 + ph), a = (e / L2 + ph - cyc) * L2; if (cyc < 1 && a > e) continue;
      const u = a / L2, s = hash(i + 40, cyc), d = 30 + 340 * u, y = 14 + 90 * u + 25 * s;
      sPut(CR.x + wx * d + (s - 0.5) * 80, y, CR.y + wz * d + (hash(i, cyc + 9) - 0.5) * 80, (50 + 140 * u) * mix(0.5, 1, F), light, light * 0.97, light * 0.94,
        sstep(0, 0.1, u) * (1 - sstep(0.55, 1, u)) * 0.55 * Math.max(F, 0.35) * sstep(1, 4, e), 1.4, s * 6, F * 0.6 * Math.exp(-Math.hypot(d, y) / 50), 0.65); }

    // ---- debris ----
    deb.visible = true; const dk = Math.max(1, Math.sqrt(kF));
    for (let i = 0; i < ND; i++) { const o = i * 14, vy = DB[o + 4], tf = (vy + Math.sqrt(vy * vy + 2 * 9.81 * DB[o + 1])) / 9.81, t = Math.min(e, tf);
      _v.set(DB[o] + DB[o + 3] * t, Math.max(0.3, DB[o + 1] + vy * t - 4.9 * t * t), DB[o + 2] + DB[o + 5] * t);
      _v2.set(DB[o + 6], DB[o + 7], DB[o + 8]); _q.setFromAxisAngle(_v2, DB[o + 9] * t + i);
      if (e >= tf) { _e.setFromQuaternion(_q); _e.x *= 0.1; _e.z *= 0.1; _q.setFromEuler(_e); }   // settled: lying flat-ish
      _s.set(DB[o + 10] * dk, DB[o + 11] * dk, DB[o + 12] * dk); _m.compose(_v, _q, _s); deb.setMatrixAt(i, _m); }
    deb.instanceMatrix.needsUpdate = true;
  }
  function hideCrash() { pool.visible = false; deb.visible = false; tenders.visible = false; CR.id = null; CR.it = null; }

  /* ================================================================ fog ===================================================== */
  const FOGC = new THREE.Color('#dde2e5'), fogS = { drift: 0, dx: 0, dz: 0 };
  function updFog(dt, now) {
    const f = Z.fogF || 0;
    if (f <= 0.001) { veil.visible = false; smU.uFS.value = 0; return; }
    const A = Z.atmo, cam = Z.camera, cy = Math.max(1, cam.position.y);
    const w = A && A.wind ? A.wind : null, wd = w ? w.dir : 0.3, ws = Math.max(1.5, w ? w.speed : 4);
    fogS.dx += Math.cos(wd) * ws * dt * 1.6; fogS.dz += Math.sin(wd) * ws * dt * 1.6;
    // how deep in the fog the camera sits: 1 at runway level, ~0.4 in the tower cab, ~0 from the strategic height
    const low = 1 / (1 + Math.pow(Math.max(0, cy - 30) / 45, 1.3));
    smU.uFS.value = f * (0.0047 * low + 0.00003);
    if (A) {
      A.fogDensity = Math.max(A.fogDensity, f * (0.0043 * low + 0.00002));
      A.fogColor.lerp(FOGC, f * (0.35 + 0.65 * Math.min(1, low * 3)));
      A.skyTint.copy(FOGC); A.skyTintK = Math.max(A.skyTintK, f * clamp(low * 2.2, 0.15, 0.9));
      A.sunDim = Math.min(A.sunDim, 1 - 0.45 * f * Math.min(1, low * 2));
      if (A.grade) { A.grade.saturation *= 1 - 0.18 * f; A.grade.contrast *= 1 - 0.1 * f * Math.min(1, low * 2); }
      A.visibility = Math.min(A.visibility || 5e4, mix(5e4, 350, f));
    }
    // the veil: only layers clearly below the camera; banks and gaps
    veU.uLA.value.set(0.9 * f * sstep(8, 50, cy), 0.7 * f * sstep(16, 70, cy), 0.5 * f * sstep(26, 90, cy));
    veU.uDrift.value.set(-fogS.dx, -fogS.dz);
    if (Z.sunDir) { const l = Math.hypot(Z.sunDir.x, Z.sunDir.z) || 1; veU.uSunXZ.value.set(Z.sunDir.x / l, Z.sunDir.z / l); }
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
    state: () => ({ crash: CR.id, e: +CR.e.toFixed(2), sprites: sN, fire: fN, fog: veil.visible }),
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
      if (Z.sunDir) poU.uSunL.value.set(Z.sunDir.x, Z.sunDir.z);
      // the ordinary day haze for the sprites (the core thins it for high cameras); the fog layer is added in updFog
      const A = Z.atmo; smU.uFB.value = (A ? Math.min(A.fogDensity, 0.00012) : 0.000035) * (1 - 0.6 * clamp((cam.position.y - 1500) / 5500, 0, 1));
      updFog(dt, now);
      const list = Z.fx; let it = null;
      if (list && list.length) for (const f of list) if (f && f.kind === 'crash' && Z.T >= f.t0 - 0.5 && Z.T <= (f.t1 || 1e9)) { it = f; break; }
      if (it) updCrash(it, dt, now); else hideCrash();
      sFlush();
    },
  };
};
