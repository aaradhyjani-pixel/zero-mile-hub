Z3MOD.weather = function (Z) {
  // Weather and atmospherics: fair-weather cumulus with their moving shadows on normal days, and the andhi (level 4's
  // pre-monsoon dust storm): a haboob wall that rolls in from the west, a gust front, the passage, the inside of the
  // storm (dust streaks, drifting sheets, distant lightning), a tail with big pre-monsoon drops, and the clearing.
  // This module writes Z.atmo every frame (fog, sky tint, sun, grade, bloom, lightning, wind); the core renders from it.
  // Storm phase follows the sim clock (Z.T); every visual motion runs in REAL time so it looks right at any sim speed.
  // Draw calls: veil 1, cloud shadow 1, billows (wall, gust front, storm cells, cumulus) 1, sheets 1, particles 1, bolt 1.
  const THREE = Z.THREE, scene = Z.scene, cam = Z.camera;
  const coreAtmo = !!Z.atmo;
  const lin = h => new THREE.Color(h);
  const A = Z.atmo || (Z.atmo = {});
  const def = {
    fogColor: A.fogColor && A.fogColor.isColor ? A.fogColor.clone() : lin('#c4d3df'),
    fogDensity: A.fogDensity != null ? A.fogDensity : 0.000035,
    hazeHeight: A.hazeHeight != null ? A.hazeHeight : 1200,
    ambientK: A.ambientK != null ? A.ambientK : 1, bloom: A.bloom != null ? A.bloom : 1,
    grade: Object.assign({ exposure: 1, contrast: 1.1, saturation: 1.08, warmth: 0, vignette: 0.08, grain: 0.015 }, A.grade || {}),
  };
  if (!A.fogColor || !A.fogColor.isColor) A.fogColor = def.fogColor.clone();
  if (!A.skyTint || !A.skyTint.isColor) A.skyTint = lin('#a8794a');
  if (!A.sunTint || !A.sunTint.isColor) A.sunTint = lin('#ffffff');
  if (!A.grade) A.grade = Object.assign({}, def.grade);
  if (!A.wind) A.wind = { dir: 0.3, speed: 4, gust: 0 };
  const DG = def.grade;

  // ---------- deterministic random ----------
  const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;

  // ---------- tileable noise atlas (R: soft fBm, G: fine fBm, B: cauliflower cells, A: warp fBm) ----------
  const NS = 256, noiseData = new Uint8Array(NS * NS * 4);
  {
    const lat = (P, R) => { const a = new Float32Array(P * P); for (let i = 0; i < P * P; i++) a[i] = R(); return a; };
    const R = mulberry(77), oct = [];
    for (let o = 0; o < 6; o++) oct.push([lat(4 << o, R), 4 << o], [lat(8 << o, R), 8 << o]);
    const vn = (L, P, x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const x0 = ((xi % P) + P) % P, y0 = ((yi % P) + P) % P, x1 = (x0 + 1) % P, y1 = (y0 + 1) % P;
      const a = L[y0 * P + x0], b = L[y0 * P + x1], c = L[y1 * P + x0], d = L[y1 * P + x1]; return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
    const fbm = (u, v, first, n, step) => { let s = 0, w = 0.5, t = 0; for (let o = 0; o < n; o++) { const [L, P] = oct[first + o * step]; s += vn(L, P, u * P, v * P) * w; t += w; w *= 0.5; } return s / t; };
    // cells: jittered points on two periodic grids; inverted distance gives round puffs
    const cells = (G, R2) => { const p = new Float32Array(G * G * 2); for (let i = 0; i < G * G * 2; i++) p[i] = R2(); return [p, G]; };
    const C1 = cells(5, mulberry(5)), C2 = cells(11, mulberry(9));
    const cell = (C, u, v) => { const [p, G] = C, x = u * G, y = v * G, xi = Math.floor(x), yi = Math.floor(y); let best = 9;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const cx = xi + i, cy = yi + j, k = (((cy % G) + G) % G) * G + (((cx % G) + G) % G);
        const dx = cx + p[k * 2] - x, dy = cy + p[k * 2 + 1] - y, d = dx * dx + dy * dy; if (d < best) best = d; }
      return Math.sqrt(best); };
    let k = 0, mn = [9, 9, 9, 9], mx = [-9, -9, -9, -9]; const tmp = new Float32Array(NS * NS * 4);
    for (let j = 0; j < NS; j++) for (let i = 0; i < NS; i++) {
      const u = i / NS, v = j / NS;
      const r = fbm(u, v, 0, 5, 2), g = fbm(u, v, 3, 4, 2), a = fbm(u + 0.37, v + 0.71, 1, 4, 2);
      const b = (1 - cell(C1, u, v)) * 0.65 + (1 - cell(C2, u, v)) * 0.35 + (g - 0.5) * 0.25;
      const vals = [r, g, b, a]; for (let c = 0; c < 4; c++) { tmp[k + c] = vals[c]; mn[c] = Math.min(mn[c], vals[c]); mx[c] = Math.max(mx[c], vals[c]); } k += 4;
    }
    for (let i = 0; i < tmp.length; i++) { const c = i & 3; noiseData[i] = Math.round(255 * (tmp[i] - mn[c]) / (mx[c] - mn[c])); }
  }
  const noiseTex = new THREE.DataTexture(noiseData, NS, NS, THREE.RGBAFormat);
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping; noiseTex.magFilter = THREE.LinearFilter; noiseTex.minFilter = THREE.LinearMipmapLinearFilter;
  noiseTex.generateMipmaps = true; noiseTex.needsUpdate = true;

  // ---------- shared shader bits ----------
  const hzH = (typeof HAZE_H === 'number') ? HAZE_H : 650, hzK = (typeof HAZE_K === 'number') ? HAZE_K : 1.2;
  const U = {
    uNoise: { value: noiseTex }, uTime: { value: 0 }, uFogCol: { value: new THREE.Color() }, uFogP: { value: new THREE.Vector3(0.000035, 1 / hzH, hzK) },
    uCamPos: { value: new THREE.Vector3() }, uFrontX: { value: -1e6 }, uCurv: { value: 5e-6 }, uWD: { value: new THREE.Vector2(1, 0) }, uFlow: { value: 0 },
    uSunV: { value: new THREE.Vector3(0, 1, 0) }, uSunD: { value: new THREE.Vector3(0, 1, 0) }, uSunC: { value: new THREE.Color(1, 1, 1) },
    uSkyC: { value: new THREE.Color(0.3, 0.35, 0.45) }, uGndC: { value: new THREE.Color(0.1, 0.11, 0.07) }, uFlash: { value: 0 }, uFlashD: { value: new THREE.Vector3(-1, 0.2, 0) },
    uGust: { value: 0 },
  };
  // fog: the core's FogExp2 plus its height haze (exp falloff with height), so sprites fog exactly like the scene
  const FOG = `uniform vec3 uFogCol;uniform vec3 uFogP;uniform vec3 uCamPos;
float fogF(vec3 off){float d=length(off);float h0=max(uCamPos.y,0.),h1=max(uCamPos.y+off.y,0.);float t=(h1-h0)*uFogP.y,e0=exp(-h0*uFogP.y);
  float I=abs(t)>1e-4?(e0-exp(-h1*uFogP.y))/t:e0;return 1.-exp(-uFogP.x*uFogP.x*d*d-uFogP.x*uFogP.z*d*I);}
`;
  // the same order three uses for its own materials: tone map, colour space, then fog, then premultiply
  const OUT = (col, a, off, fk) => `gl_FragColor=vec4(${col},1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\ngl_FragColor.rgb=mix(gl_FragColor.rgb,uFogCol,fogF(${off})*${fk || '1.'});gl_FragColor=vec4(gl_FragColor.rgb*(${a}),${a});\n`;
  const VHEAD = '#include <common>\n#include <logdepthbuf_pars_vertex>\n';
  const FHEAD = '#include <logdepthbuf_pars_fragment>\n' + FOG;
  const mat = (o) => { const m = new THREE.ShaderMaterial(Object.assign({ transparent: true, depthWrite: false, depthTest: true, premultipliedAlpha: true, blending: THREE.NormalBlending, fog: false }, o)); return m; };
  const root = new THREE.Group(); root.name = 'weather'; scene.add(root);
  const quadGeo = (n, attrs) => { const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
    for (const k in attrs) g.setAttribute(k, new THREE.InstancedBufferAttribute(attrs[k], 4)); g.instanceCount = n; return g; };
  const mk = (geo, m, order) => { const o = new THREE.Mesh(geo, m); o.frustumCulled = false; o.renderOrder = order; root.add(o); return o; };

  // ---------- 1. sky veil: the dust overcast inside the storm, the dark storm mass in the west on the approach ----------
  const veilU = Object.assign({}, U, { uIn: { value: 0 }, uAppr: { value: 0 }, uHor: { value: new THREE.Color() }, uZen: { value: new THREE.Color() }, uStormC: { value: lin('#4a4038') },
    uSunDisc: { value: new THREE.Color() }, uTintK: { value: 0 }, uTint: { value: new THREE.Color() }, uFrontDX: { value: 1e6 }, uCamY: { value: 100 } });
  const veil = mk(new THREE.SphereGeometry(1, 48, 24), mat({ uniforms: veilU, side: THREE.BackSide,
    vertexShader: VHEAD + 'varying vec3 vDir;void main(){vDir=position;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;\n#include <logdepthbuf_vertex>\n}',
    fragmentShader: FHEAD + `uniform sampler2D uNoise;uniform float uTime,uIn,uAppr,uTintK,uFrontDX,uCamY,uFlow,uFlash,uGust;uniform vec3 uHor,uZen,uStormC,uSunDisc,uTint,uSunD,uFlashD;uniform vec2 uWD;varying vec3 vDir;
    void main(){
      #include <logdepthbuf_fragment>
      vec3 v=normalize(vDir);float up=max(v.y,0.);float hl=max(length(v.xz),1e-3);
      vec2 pc=v.xz/max(v.y,0.035)*1800.;
      vec4 n=texture2D(uNoise,(pc-uWD*uFlow*0.5)*0.00011+0.31);
      vec3 dust=mix(uHor,uZen,pow(up,0.55));
      float tex=n.r*0.6+n.g*0.4;dust*=0.8+0.38*tex*smoothstep(0.,0.25,up+0.05);
      float s=max(dot(v,normalize(uSunD)),0.);
      dust+=uSunDisc*(smoothstep(0.99962,0.9998,s)*1.6+pow(s,90.)*0.45+pow(s,10.)*0.16);
      float fl=pow(max(dot(v,uFlashD),0.),5.);dust+=uFlash*vec3(0.75,0.7,0.85)*(0.18+1.6*fl)*(0.6+0.8*tex);
      // the storm mass seen from outside: everything west of the front under the anvil height
      float aW=0.;vec3 sc=uStormC;
      if(uAppr>0.001){float wx=-v.x/hl;
        float D=uFrontDX/max(wx,0.04);float el=atan(v.y,hl);
        float top=atan(7500.-uCamY,D+7000.)+(n.r-0.5)*0.06;
        aW=uAppr*smoothstep(top+0.1,top-0.08,el)*smoothstep(0.0,0.5,wx)*0.92;
        sc=uStormC*(0.85+0.3*n.r)*mix(1.35,0.85,smoothstep(top-0.3,top,el));
        sc+=uFlash*vec3(0.6,0.6,0.75)*fl*1.5;}
      vec3 col=dust;float a=uIn;
      if(aW>0.){col=mix(sc,dust,uIn/(uIn+aW+1e-4));a=max(uIn,aW);}
      a=max(a,uTintK);col=mix(uTint,col,a>0.?max(uIn,aW)/a:0.);
      if(a<0.002)discard;
      float hf=(1.-smoothstep(-0.02,0.09,v.y))*uIn;
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      gl_FragColor.rgb=mix(gl_FragColor.rgb,uFogCol,hf);gl_FragColor=vec4(gl_FragColor.rgb*a,a);
    }` }), -30);

  // ---------- 2. cloud shadows (and the storm's shadow) on the ground: a multiply layer just above it ----------
  const NCL = 24, clU = []; for (let i = 0; i < NCL; i++) clU.push(new THREE.Vector4(0, 0, 1, 0));
  const shU = Object.assign({}, U, { uCl: { value: clU }, uSunOff: { value: new THREE.Vector2() }, uCloudSh: { value: 0.4 }, uStormSh: { value: 0 }, uCumOff: { value: new THREE.Vector2() },
    uCen: { value: new THREE.Vector3() }, uSize: { value: 80000 }, uH: { value: 1 } });
  const shGeo = new THREE.PlaneGeometry(1, 1); shGeo.rotateX(-Math.PI / 2);
  const shadow = mk(shGeo, mat({ uniforms: shU, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, toneMapped: false,
    vertexShader: VHEAD + 'uniform vec3 uCen;uniform float uSize,uH;varying vec3 vWP;void main(){vWP=vec3(uCen.x+position.x*uSize,uH,uCen.z+position.z*uSize);gl_Position=projectionMatrix*viewMatrix*vec4(vWP,1.);\n#include <logdepthbuf_vertex>\n}',
    fragmentShader: FHEAD + `uniform sampler2D uNoise;uniform vec4 uCl[${NCL}];uniform vec2 uSunOff,uCumOff;uniform float uCloudSh,uStormSh,uFrontX,uCurv,uSize;uniform vec3 uCen;varying vec3 vWP;
    void main(){
      #include <logdepthbuf_fragment>
      vec2 p=vWP.xz;float s=0.;
      vec4 nz=texture2D(uNoise,(p-uSunOff-uCumOff)*0.00021);vec4 nz2=texture2D(uNoise,(p-uSunOff-uCumOff)*0.0007+0.5);
      float wob=(nz.b-0.5)*0.75+(nz2.g-0.5)*0.3;
      for(int i=0;i<${NCL};i++){vec4 c=uCl[i];if(c.w<0.001)continue;vec2 dd=p-(c.xy+uSunOff);float r=length(dd)/c.z;
        s=max(s,c.w*smoothstep(1.0,0.45,r+wob));}
      float fx=uFrontX-uCurv*vWP.z*vWP.z;
      float st=uStormSh*smoothstep(fx+9000.,fx+600.,vWP.x+(nz.r-0.5)*2500.);
      vec3 m=vec3(1.)-s*uCloudSh*vec3(0.46,0.42,0.33)-st*vec3(0.5,0.52,0.5);
      float k=(1.-fogF(vWP-uCamPos))*(1.-smoothstep(uSize*0.3,uSize*0.48,max(abs(vWP.x-uCen.x),abs(vWP.z-uCen.z))));
      m=mix(vec3(1.),max(m,vec3(0.25)),k);
      gl_FragColor=vec4(m,1.);
      #include <colorspace_fragment>
    }` }), -40);

  // ---------- 3. billows: the haboob wall, the gust front skirt, the parent storm cells, the fair-weather cumulus ----------
  // instance attributes: iP (x, y, z, radius), iS (seed, rate, kind, -), iC (kind specific)
  const BL = [];
  const push = (x, y, z, r, seed, rate, kind, c0, c1, c2, c3) => BL.push([x, y, z, r, seed, rate, kind, 0, c0, c1, c2, c3]);
  const R = mulberry(2024);
  // cumulus first (they are drawn first, behind everything): clusters of puffs with flat bases
  const CLU = [];
  { const Rc = mulberry(31); let tries = 0;
    while (CLU.length < NCL && tries++ < 400) { const x = (Rc() - 0.5) * 56000, z = (Rc() - 0.5) * 56000; if (CLU.some(c => Math.hypot(c[0] - x, c[1] - z) < 5200)) continue;
      const rad = 650 + Rc() * 750, base = 1600 + Rc() * 700, hgt = 350 + Rc() * 500; CLU.push([x, z, rad, base, hgt]); }
    for (const c of CLU) { const n = Math.round(10 + c[2] / 60);
      for (let i = 0; i < n; i++) { const a = Rc() * 6.283, d = Math.sqrt(Rc()) * c[2] * 0.85, ox = Math.cos(a) * d, oz = Math.sin(a) * d * 0.8, dome = 1 - (d / c[2]) ** 2;
        const pr = (170 + Rc() * 200) * (0.7 + 0.5 * dome); push(ox, c[3] + pr * 0.55 + dome * c[4] * Rc(), oz, pr, Rc(), 0.004 + Rc() * 0.006, 4, c[0], c[1], c[3], c[4]); } } }
  // more fair-weather clusters for the low cameras (tower, follow, approach): no ground shadow, never within ~9 km of
  // the field, so they read as a band of cumulus on the horizon (they fade out for high cameras like the rest)
  { const Rc = mulberry(57);
    for (let k = 0; k < 60; k++) { const ang = Rc() * 6.283, dist = 13000 + Rc() * 17000, x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
      const rad = 700 + Rc() * 900, base = 1500 + Rc() * 600, hgt = 250 + Rc() * 450, n = Math.round(8 + rad / 90);
      for (let i = 0; i < n; i++) { const a = Rc() * 6.283, d = Math.sqrt(Rc()) * rad * 0.9, ox = Math.cos(a) * d, oz = Math.sin(a) * d * 0.7, dome = 1 - (d / rad) ** 2;
        const pr = (200 + Rc() * 230) * (0.7 + 0.5 * dome); push(ox, base + pr * 0.5 + dome * hgt * Rc(), oz, pr, Rc(), 0.004 + Rc() * 0.006, 4.25, x, z, base, hgt); } } }
  const nCum = BL.length;
  // storm cells: the dark parent thunderstorm behind the wall
  for (let i = 0; i < 46; i++) { const z = (R() - 0.5) * 44000; push(-3500 - R() * 10000, 2800 + R() * 5000, z, 2400 + R() * 1800, R(), 0.004 + R() * 0.004, 3, 260 + R() * 300, 0, 0, 0.45 + R() * 0.25); }
  // the wall: columns along the front (denser near the airport); body behind, then the rolling face, then the base
  const cols = []; for (let z = -38000; z <= 38000;) { cols.push(z); z += 230 + 0.011 * Math.abs(z); }
  const colTop = z => 1900 + 360 * Math.sin(z * 0.00041 + 1.3) + 170 * Math.sin(z * 0.0013 + 0.4) + 80 * Math.sin(z * 0.0037);
  cols.forEach((z, i) => { if (i % 2) return; const top = colTop(z); push(-1100 - R() * 5200, 300 + R() * top * 0.85, z + (R() - 0.5) * 300, 1200 + R() * 1050, R(), 0.01 + R() * 0.01, 1, 90 + R() * 120, top, 0, 0.85); });
  cols.forEach(z => { const top = colTop(z);
    const nt = 1 + (R() < 0.5 ? 1 : 0); for (let k = 0; k < nt; k++) push(-520 - R() * 420, top - R() * 180, z + (R() - 0.5) * 200, 420 + R() * 345, R(), 0.016 + R() * 0.014, 0, 70 + R() * 90, top, 0, 1);
    for (let y = top - 450; y > 300; y -= 380 + R() * 130) { const f = y / top; push(-80 - 420 * f * f - R() * 180, y, z + (R() - 0.5) * 220, 390 + R() * 300, R(), 0.018 + R() * 0.014, 0, 50 + R() * 80, top, 0, 1); } });
  cols.forEach(z => { const top = colTop(z); push(-40 + R() * 90, 90 + R() * 260, z + (R() - 0.5) * 160, 380 + R() * 220, R(), 0.02 + R() * 0.02, 0, 40 + R() * 40, top, 0, 1); });
  // the gust front: low dust racing ahead of the wall near the airport
  for (let z = -16000; z <= 16000; z += 170) for (let k = 0; k < 2; k++) push(R() * 150, 6 + R() * 30, z + (R() - 0.5) * 160, 70 + R() * 90, R(), 0.03 + R() * 0.04, 2, 900 + R() * 1400, 25 + R() * 70, 2.8 + R() * 2.2, 0.55 + R() * 0.45);
  // drifting dust masses: big soft volumes that wrap around the view and stream with the wind (inside the storm)
  const nMass0 = BL.length;
  for (let i = 0; i < 110; i++) push(R(), Math.pow(R(), 1.6), R(), 0.05 + R() * 0.07, R(), 0.006 + R() * 0.01, 5, 0.6 + R() * 0.8, R(), 0, 0.6 + R() * 0.5);
  const NB = BL.length, bP = new Float32Array(NB * 4), bS = new Float32Array(NB * 4), bC = new Float32Array(NB * 4);
  BL.forEach((b, i) => { bP.set(b.slice(0, 4), i * 4); bS.set(b.slice(4, 8), i * 4); bC.set(b.slice(8, 12), i * 4); });
  const billU = Object.assign({}, U, { uWallA: { value: 0 }, uSkirtA: { value: 0 }, uCellA: { value: 0 }, uCumA: { value: 1 }, uDom: { value: 60000 }, uCumOff: { value: new THREE.Vector2() },
    uMassA: { value: 0 }, uMB: { value: new THREE.Vector4(0, 0, 0, 4000) }, uMV: { value: new THREE.Vector3() },
    uDustLo: { value: lin('#2e2017') }, uDustHi: { value: lin('#c89660') }, uField: { value: new THREE.Vector4(0, 0, 4000, 3000) }, uCellC: { value: lin('#584a3e') }, uCumC: { value: lin('#ffffff') }, uCumBase: { value: lin('#6f7a8c') } });
  const bill = mk(quadGeo(NB, { iP: bP, iS: bS, iC: bC }), mat({ uniforms: billU,
    vertexShader: VHEAD + `attribute vec4 iP,iS,iC;uniform float uTime,uFrontX,uCurv,uWallA,uSkirtA,uCellA,uCumA,uDom,uMassA;uniform vec2 uCumOff;uniform vec4 uMB,uField;uniform vec3 uMV;
    varying vec2 vUv;varying float vA,vD;varying vec3 vWP;varying vec4 vS;varying vec3 vInfo;
    void main(){
      float kind=iS.z;vec3 c=iP.xyz;float R=iP.w,a=1.;vec2 sc=vec2(1.);float hb=0.,ht=1500.;
      float th=6.2832*(iS.x+uTime*iS.y);
      if(kind<1.5){c.x+=sin(th)*iC.x;c.y+=cos(th)*iC.x*0.5;R*=0.9+0.14*sin(th*0.5+iS.x*17.);
        c.x+=uFrontX-uCurv*c.z*c.z;a=uWallA*iC.w;ht=iC.y;c.y=max(c.y,R*0.32);}
      else if(kind<2.5){float ph=fract(iS.x+uTime*iS.y);c.x+=uFrontX-uCurv*c.z*c.z+ph*iC.x;c.y+=ph*iC.y;R*=0.65+0.7*ph;
        a=uSkirtA*iC.w*smoothstep(0.,0.18,ph)*smoothstep(1.,0.5,ph);sc=vec2(iC.z,1.);ht=200.;}
      else if(kind<3.5){c.x+=uFrontX-uCurv*c.z*c.z+sin(th)*iC.x;c.y+=cos(th)*iC.x*0.4;a=uCellA*iC.w;hb=1500.;ht=9500.;}
      else if(kind>4.5){vec3 box=vec3(uMB.w,uMB.w*0.07+120.,uMB.w);
        vec3 p=iP.xyz*box+uMV*iC.x;p.xz=uMB.xz+mod(p.xz-uMB.xz+box.xz*0.5,box.xz)-box.xz*0.5;p.y=iP.y*box.y;
        R=iP.w*uMB.w*(0.9+0.15*sin(th));c=p;c.y=max(c.y,R*0.25);
        float fx=uFrontX-uCurv*c.z*c.z;vec2 rel=abs(c.xz-uMB.xz)/box.xz;
        a=uMassA*iC.w*smoothstep(fx+300.,fx-900.,c.x)*(1.-smoothstep(0.3,0.5,max(rel.x,rel.y)));hb=0.;ht=box.y+R;}
      else{vec2 cc=mod(iC.xy+uCumOff+uDom*0.5,uDom)-uDom*0.5;float e=max(abs(cc.x),abs(cc.y));c.xz+=cc;c.y+=sin(th)*15.;R*=0.96+0.06*sin(th*0.7);
        a=uCumA*smoothstep(uDom*0.5,uDom*0.5-6000.,e);hb=iC.z;ht=iC.z+iC.w+250.;
        if(kind>4.1)a*=smoothstep(9000.,14000.,length(c.xz));
        a*=1.-smoothstep(hb-900.,hb-250.,cameraPosition.y);}  // never between a high (strategic) camera and the field
      if(kind<3.5&&cameraPosition.y>c.y+50.){vec3 cp=cameraPosition;vec2 g=cp.xz+(c.xz-cp.xz)*(cp.y/(cp.y-c.y));   // where the puff sits on the ground, seen from the camera
        vec2 ob=max(abs(g-uField.xy)-uField.zw,0.);a*=mix(1.,smoothstep(R*0.4,R*1.6+600.,length(ob)),smoothstep(1500.,4000.,cp.y));}
      vec4 mv=modelViewMatrix*vec4(c,1.);float d=length(mv.xyz);
      a*=smoothstep(R*0.3,R*1.5,d);
      if(a<0.003){gl_Position=vec4(0.,0.,-2.,1.);return;}
      vec2 q=position.xy*R*sc;mv.xy+=q;gl_Position=projectionMatrix*mv;
      #include <logdepthbuf_vertex>
      vWP=c+vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0])*q.x+vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1])*q.y;
      vUv=position.xy*vec2(sc.x>1.?1.:1.,1.);vA=a;vD=length(mv.xyz);vS=iS;vInfo=vec3(hb,ht,kind);
    }`,
    fragmentShader: FHEAD + `uniform sampler2D uNoise;uniform float uTime,uFlash;uniform vec3 uSunV,uSunC,uSkyC,uGndC,uDustLo,uDustHi,uCellC,uCumC,uCumBase;
    varying vec2 vUv;varying float vA,vD;varying vec3 vWP;varying vec4 vS;varying vec3 vInfo;
    void main(){
      #include <logdepthbuf_fragment>
      vec2 p=vUv;float r=length(p);if(r>1.)discard;
      float kind=vInfo.z;float sp=kind>3.5?0.35:(kind>2.5?0.5:1.);
      vec2 o=vS.x*vec2(13.7,7.3);
      vec4 w=texture2D(uNoise,p*0.21+o+vec2(uTime*0.006,-uTime*0.0045)*sp);
      vec2 wp=p+(w.ra-0.5)*0.6;
      vec4 n=texture2D(uNoise,wp*0.4+o.yx+vec2(-uTime*0.008,uTime*0.011)*sp);
      float cau=n.b,det=n.g;
      float edge=r+(0.55-cau)*0.62+(0.5-det)*0.24;
      float dens=kind>2.5&&kind<3.5?smoothstep(1.,0.25,edge):smoothstep(1.,0.52,edge);
      if(kind>1.5&&kind<2.5)dens*=0.55+0.45*det;
      if(kind>4.5)dens*=0.5+0.5*smoothstep(0.2,0.8,n.r);
      if(dens<0.004)discard;
      vec3 N=normalize(vec3(wp*0.9+(n.rg-0.5)*0.75,sqrt(max(0.05,1.-r*r))));
      float lam=clamp(dot(N,uSunV)*0.62+0.38,0.,1.);
      float h01=clamp((vWP.y-vInfo.x)/max(1.,vInfo.y-vInfo.x),0.,1.);
      float crev=mix(0.5,1.08,smoothstep(0.15,0.85,cau));
      vec3 alb;vec3 col;
      if(kind<2.5||kind>4.5){alb=mix(uDustLo,uDustHi,smoothstep(0.02,0.9,h01));if(kind>4.5)alb=mix(uDustLo,uDustHi,0.35+0.4*h01)*mix(0.75,1.2,vS.x);
        col=alb*(uSkyC*(0.35+0.65*h01)+uGndC*0.5+uSunC*lam*crev*mix(0.3,1.15,h01));
        if(kind<1.5){float rim=pow(clamp(1.-N.z,0.,1.),2.5)*max(dot(normalize(N.xy+1e-4),normalize(uSunV.xy+1e-4)),0.);col+=uSunC*alb*rim*0.9*h01;}}
      else if(kind<3.5){alb=uCellC*mix(0.55,1.15,h01);col=alb*(uSkyC*0.8+uSunC*lam*crev*(0.25+0.75*h01))+uFlash*vec3(1.,0.95,1.1)*0.9*cau;}
      else{float base=smoothstep(vInfo.x-20.,vInfo.x+300.,vWP.y);alb=mix(uCumBase,uCumC,base*base*(3.-2.*base));
        dens*=smoothstep(vInfo.x-25.,vInfo.x+12.,vWP.y);col=alb*(uSkyC*0.9+uGndC*0.4*(1.-base)+uSunC*lam*crev);}
      float a=clamp(vA*dens,0.,1.);
      ${OUT('col', 'a', 'vWP-uCamPos', '(kind<1.5?0.38:(kind<3.5?0.5:(kind>4.5?0.8:1.)))')}
    }` }), -20);

  // ---------- 4. drifting dust sheets at several heights (the flowing veils seen from above and from inside) ----------
  // three layers (each one is a full-screen transparent pass from inside the storm, so they are kept few and denser)
  const LAY = [[3, 0.5, 800, 2.1], [110, 0.42, 1500, 1.6], [650, 0.36, 2900, 1.25]];
  const shtGeo = new THREE.BufferGeometry(); { const p = [], l = [], ix = []; LAY.forEach((L, i) => { p.push(-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5); for (let k = 0; k < 4; k++) l.push(...L); ix.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2); });
    shtGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); shtGeo.setAttribute('aL', new THREE.Float32BufferAttribute(l, 4)); shtGeo.setIndex(ix); }
  const shtU = Object.assign({}, U, { uCen: { value: new THREE.Vector3() }, uSize: { value: 30000 }, uSheetA: { value: 0 }, uLead: { value: 900 }, uDustA: { value: new THREE.Color() }, uDustB: { value: new THREE.Color() }, uFade: { value: 12000 } });
  const sheets = mk(shtGeo, mat({ uniforms: shtU, side: THREE.DoubleSide,
    vertexShader: VHEAD + 'attribute vec4 aL;uniform vec3 uCen;uniform float uSize;varying vec3 vWP;varying vec4 vL;void main(){vWP=vec3(uCen.x+position.x*uSize,aL.x,uCen.z+position.z*uSize);vL=aL;gl_Position=projectionMatrix*viewMatrix*vec4(vWP,1.);\n#include <logdepthbuf_vertex>\n}',
    fragmentShader: FHEAD + `uniform sampler2D uNoise;uniform float uTime,uFlow,uFrontX,uCurv,uLead,uSheetA,uGust,uFade;uniform vec3 uDustA,uDustB;uniform vec2 uWD;varying vec3 vWP;varying vec4 vL;
    void main(){
      #include <logdepthbuf_fragment>
      vec3 V=vWP-uCamPos;float d=length(V);
      vec2 q=vec2(dot(vWP.xz,uWD),dot(vWP.xz,vec2(-uWD.y,uWD.x)));
      float S=vL.z,an=vL.w,fl=uFlow*(0.75+vL.x*0.0006);
      vec2 uv=vec2((q.x-fl)/(S*an),q.y/S+vL.x*0.0131);
      vec4 n1=texture2D(uNoise,uv);
      vec4 n2=texture2D(uNoise,uv*vec2(2.1,2.7)+(n1.ra-0.5)*0.3-vec2(fl*0.5/(S*an),0.));
      float n=n1.r*0.82+n2.g*0.18;
      float band=texture2D(uNoise,vec2(q.x-fl*1.15,q.y*0.6)*0.000055+vec2(0.13,0.71)).r;
      float dens=smoothstep(0.3-0.1*uGust,0.92,n)*(0.35+1.15*smoothstep(0.28,0.78,band));
      float fx=uFrontX-uCurv*vWP.z*vWP.z;
      float m=smoothstep(fx+uLead,fx-250.,vWP.x+(n1.a-0.5)*500.);
      float a=dens*vL.y*m*uSheetA;
      a*=smoothstep(0.01,0.16,abs(V.y)/max(d,1.));
      a*=smoothstep(vL.x*0.4+2.,vL.x*1.5+30.,d);
      a*=1.-smoothstep(uFade*0.55,uFade,d);
      if(a<0.004)discard;
      vec3 col=mix(uDustA,uDustB,clamp(n2.b*0.6+0.3*(n1.a-0.5)+0.55*smoothstep(0.,700.,vWP.y)-0.2*(1.-band),0.,1.))*(0.8+0.4*n1.g);
      ${OUT('col', 'a', 'V')}
    }` }), 10);

  // ---------- 5. particles: near dust streaks, debris, field streaks, near rain, far rain (one draw call) ----------
  const NP = { dust: 10000, debris: 800, field: 1400, rain: 7000, farRain: 4500 };
  const NPT = NP.dust + NP.debris + NP.field + NP.rain + NP.farRain;
  const pR = new Float32Array(NPT * 4), pK = new Float32Array(NPT * 4);
  // interleaved by kind, so drawing only the first N instances (the quality tiers) thins every kind evenly
  { const Rp = mulberry(99), KN = [NP.dust, NP.debris, NP.field, NP.rain, NP.farRain], acc = [0, 0, 0, 0, 0];
    for (let i = 0; i < NPT; i++) { let k = 0, best = -1; for (let j = 0; j < 5; j++) { const lag = (i + 1) * KN[j] / NPT - acc[j]; if (lag > best) { best = lag; k = j; } } acc[k]++;
      pR.set([Rp(), Rp(), Rp(), Rp()], i * 4); pK.set([k, Rp(), Rp(), Rp()], i * 4); } }
  const parU = Object.assign({}, U, { uBoxN: { value: 140 }, uBoxF: { value: 6000 }, uFieldH: { value: 60 }, uPxK: { value: 0.001 }, uWindV: { value: new THREE.Vector3(20, 0, 0) }, uFieldV: { value: new THREE.Vector3(60, 0, 0) },
    uFocus: { value: new THREE.Vector3() }, uAmt: { value: new THREE.Vector4() }, uFarRain: { value: 0 }, uLead: { value: 900 }, uDustP: { value: new THREE.Color() }, uDebC: { value: lin('#3a2c20') }, uRainC: { value: lin('#e4e8ee') } });
  const parts = mk(quadGeo(NPT, { iR: pR, iK: pK }), mat({ uniforms: parU,
    vertexShader: VHEAD + `attribute vec4 iR,iK;uniform float uTime,uBoxN,uBoxF,uFieldH,uPxK,uFrontX,uCurv,uLead,uFarRain;uniform vec3 uCamPos,uWindV,uFieldV,uFocus;uniform vec4 uAmt;
    varying vec2 vUv;varying float vA,vK,vT;varying vec3 vOff;
    void main(){
      float k=iK.x;vec3 P,vel;float wid,blur,a;vec3 rel;
      float ks=uBoxN/150.;
      if(k<1.5){vec3 box=vec3(uBoxN,uBoxN*0.55,uBoxN);
        vec3 v=uWindV*(0.7+0.6*iK.z);
        vec3 tur=vec3(sin(uTime*1.3+iR.w*31.),sin(uTime*1.9+iR.x*23.)*0.7+(k>0.5?sin(uTime*5.+iR.y*40.)*1.5:0.),cos(uTime*1.1+iR.y*17.))*2.5*ks;
        P=iR.xyz*box+v*uTime+tur;P=uCamPos+mod(P-uCamPos+box*0.5,box)-box*0.5;
        vel=v+vec3(cos(uTime*1.3+iR.w*31.),cos(uTime*1.9+iR.x*23.),-sin(uTime*1.1+iR.y*17.))*3.;
        rel=(P-uCamPos)/box;
        if(k<0.5){wid=(0.018+0.05*iK.y*iK.y)*ks;blur=0.04;a=uAmt.x*(0.35+0.65*iK.w);}else{wid=(0.04+0.09*iK.y)*ks;blur=0.015;a=uAmt.y;}
      }else if(k<2.5){vec3 v=uFieldV*(0.65+0.7*iK.z);
        vec2 pp=iR.xz*uBoxF+v.xz*uTime;pp=uFocus.xz+mod(pp-uFocus.xz+uBoxF*0.5,uBoxF)-uBoxF*0.5;
        P=vec3(pp.x,0.6+iR.y*iR.y*uFieldH,pp.y);vel=v;
        float len=uBoxF*0.07*(0.4+iK.y);blur=len/max(length(v),1.);wid=uBoxF*0.004*(0.5+iK.w);
        rel=vec3((P.xz-uFocus.xz)/uBoxF,0.).xzy;
        float fx=uFrontX-uCurv*P.z*P.z;a=uAmt.z*smoothstep(fx+uLead*1.3,fx-200.,P.x)*(0.4+0.6*iK.w);
      }else if(k<3.5){float B=uBoxN*0.42;vec3 box=vec3(B,B*1.2,B);
        vec3 v=vec3(uWindV.x*0.35,-8.-3.*iK.z,uWindV.z*0.35);
        P=iR.xyz*box+v*uTime;P=uCamPos+mod(P-uCamPos+box*0.5,box)-box*0.5;vel=v;
        rel=(P-uCamPos)/box;wid=(0.007+0.006*iK.y)*ks;blur=0.054*ks;a=uAmt.w*(0.25+0.25*iK.w);
      }else{float H=uBoxF*0.12+200.;vec3 v=vec3(uFieldV.x*0.12,-(9.+3.*iK.z)*max(1.,uBoxF/1200.),uFieldV.z*0.12);
        vec2 pp=iR.xz*uBoxF+v.xz*uTime;pp=uFocus.xz+mod(pp-uFocus.xz+uBoxF*0.5,uBoxF)-uBoxF*0.5;
        P=vec3(pp.x,mod(iR.y*H+v.y*uTime,H),pp.y);vel=v;rel=vec3((P.xz-uFocus.xz)/uBoxF,0.).xzy;
        blur=0.09;wid=uBoxF*0.00025*(0.6+iK.y);a=uFarRain*(0.4+0.6*iK.w);}
      a*=1.-smoothstep(0.3,0.5,max(max(abs(rel.x),abs(rel.y)),abs(rel.z)));
      vec3 v0=(viewMatrix*vec4(P,1.)).xyz;
      float dz=-v0.z;
      a*=smoothstep(1.2,7.*min(1.,uBoxN/150.)+1.,dz);
      if(a<0.004||dz<0.5){gl_Position=vec4(0.,0.,-2.,1.);return;}
      float wmin=uPxK*dz*1.1;if(wid<wmin){a*=wid/wmin;wid=wmin;}
      vec3 v1=(viewMatrix*vec4(P-vel*blur,1.)).xyz;
      vec3 ax=v1-v0;float L=length(ax);vec3 dir=L>1e-4?ax/L:vec3(0.,1.,0.);
      vec3 side=cross(dir,normalize(v0));float sl=length(side);side=sl>1e-3?side/sl:vec3(1.,0.,0.);
      float t=position.x*0.5+0.5;
      vec3 vv=mix(v0,v1,t)+dir*position.x*wid+side*position.y*wid;
      gl_Position=projectionMatrix*vec4(vv,1.);
      #include <logdepthbuf_vertex>
      vUv=vec2(position.x*(L+2.*wid)/(2.*wid+1e-4),position.y);vT=(L+2.*wid)/(2.*wid+1e-4);vA=a;vOff=(vec4(vv,0.)*viewMatrix).xyz;vK=k;
    }`,
    fragmentShader: FHEAD + `uniform vec3 uDustP,uDebC,uRainC;varying vec2 vUv;varying float vA,vK,vT;varying vec3 vOff;
    void main(){
      #include <logdepthbuf_fragment>
      float ax=abs(vUv.x),cap=max(0.,ax-(vT-1.));
      float r2=cap*cap+vUv.y*vUv.y;if(r2>1.)discard;
      float sh=(1.-r2);sh*=sh;
      float head=mix(1.,0.45,clamp(vUv.x/vT*0.5+0.5,0.,1.));
      vec3 col=vK<0.5?uDustP:(vK<1.5?uDebC:(vK<2.5?uDustP*1.05:uRainC));
      float a=vA*sh*(vK<0.5||vK>1.5?head:1.)*(vK>2.5?0.9:1.);
      ${OUT('col', 'a', 'vOff')}
    }` }), 5);

  // ---------- 6. lightning: a bolt far away in the darker cells, plus Z.atmo.lightning ----------
  const boltC = document.createElement('canvas'); boltC.width = 1024; boltC.height = 512;
  { const g = boltC.getContext('2d'), Rb = mulberry(7); g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 512); g.lineCap = 'round'; g.lineJoin = 'round';
    const path = (x, y, len, ang, depth, segs) => { const pts = [[x, y]]; for (let i = 0; i < segs; i++) { ang += (Rb() - 0.5) * 0.9; ang = ang * 0.7 + Math.PI / 2 * 0.3; x += Math.cos(ang) * len / segs; y += Math.sin(ang) * len / segs; pts.push([x, y]); } return pts; };
    const stroke = (pts, w, a, blur) => { g.save(); g.shadowColor = 'rgba(190,170,255,1)'; g.shadowBlur = blur; g.strokeStyle = `rgba(255,250,255,${a})`; g.lineWidth = w; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.restore(); };
    for (let b = 0; b < 4; b++) { g.save(); g.beginPath(); g.rect(b * 256, 0, 256, 512); g.clip();
      const main = path(b * 256 + 128 + (Rb() - 0.5) * 40, 8, 520, Math.PI / 2, 0, 46); const br = [];
      for (let k = 0; k < 5; k++) { const s = main[4 + Math.floor(Rb() * 30)]; br.push(path(s[0], s[1], 60 + Rb() * 120, Math.PI / 2 + (Rb() < 0.5 ? -1 : 1) * (0.5 + Rb() * 0.6), 1, 12)); }
      for (const p of br) { stroke(p, 3, 0.25, 10); stroke(p, 1.2, 0.7, 3); }
      stroke(main, 9, 0.18, 24); stroke(main, 4, 0.5, 8); stroke(main, 1.8, 1, 2);
      const gr = g.createRadialGradient(b * 256 + 128, 0, 0, b * 256 + 128, 0, 140); gr.addColorStop(0, 'rgba(200,190,255,0.55)'); gr.addColorStop(1, 'rgba(200,190,255,0)'); g.fillStyle = gr; g.fillRect(b * 256, 0, 256, 160);
      g.restore(); } }
  const boltTex = new THREE.CanvasTexture(boltC); boltTex.colorSpace = THREE.SRGBColorSpace;
  const boltU = Object.assign({}, U, { uTex: { value: boltTex }, uBP: { value: new THREE.Vector3() }, uBH: { value: 3000 }, uBW: { value: 1500 }, uBI: { value: 0 }, uIdx: { value: 0 } });
  const boltGeo = new THREE.PlaneGeometry(1, 1);
  const bolt = mk(boltGeo, mat({ uniforms: boltU, blending: THREE.AdditiveBlending,
    vertexShader: VHEAD + 'uniform vec3 uBP,uCamPos;uniform float uBH,uBW;varying vec2 vUv;varying float vD;void main(){vec3 tc=uCamPos-uBP;tc.y=0.;vec3 rt=normalize(cross(vec3(0.,1.,0.),normalize(tc+vec3(1e-3,0.,0.))));vec3 w=uBP+rt*position.x*uBW+vec3(0.,(position.y+0.5)*uBH,0.);vUv=position.xy+0.5;vec4 mv=viewMatrix*vec4(w,1.);vD=length(mv.xyz);gl_Position=projectionMatrix*mv;\n#include <logdepthbuf_vertex>\n}',
    fragmentShader: FHEAD + `uniform sampler2D uTex;uniform float uBI,uIdx;varying vec2 vUv;varying float vD;
    void main(){
      #include <logdepthbuf_fragment>
      vec3 t=texture2D(uTex,vec2((uIdx+vUv.x)/4.,vUv.y)).rgb;
      float f=1.-exp(-uFogP.x*uFogP.x*0.12*vD*vD);
      gl_FragColor=vec4(t*vec3(0.92,0.9,1.)*uBI*7.*(1.-f*0.85),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }` }), 8);
  bolt.visible = false;

  // ---------- per-frame state (no allocations below) ----------
  const tv = new THREE.Vector3(), tv2 = new THREE.Vector3(), camPos = new THREE.Vector3(), focus = new THREE.Vector3();
  const cA = new THREE.Color(), cB = new THREE.Color();
  const P = {
    preFog: lin('#c9b28f'), inFog: lin('#86593a'), inFogDark: lin('#5a3d26'), tailFog: lin('#7a6a5a'),
    skyIn: lin('#9a6436'), zenIn: lin('#b48a5c'), sunIn: lin('#ffb46e'), sunDisc: lin('#ffd9a6'), white: lin('#ffffff'),
    dustP: lin('#c49566'), dustA: lin('#7d5636'), dustB: lin('#c7976a'), sunWarm: lin('#fff1dc'),
    skyClear: new THREE.Color(0.30, 0.36, 0.46), skyDust: new THREE.Color(0.26, 0.18, 0.11), gndClear: new THREE.Color(0.09, 0.11, 0.06), gndDust: new THREE.Color(0.12, 0.08, 0.05),
  };
  const t0 = performance.now() / 1000; let flow = 0, flowF = 0, massFlow = 0, cumX = 0, cumZ = 0, lastNow = 0;
  const L = { next: 0, t: -9, k: 0, x: 0, z: 0, idx: 0, dist: 0, force: false };
  let fieldBox = null;
  const S = { front: -1e6, inside: 0, appr: 0, I: 0, tail: 0, rain: 0, wall: 0 };   // exposed for debugging
  const base = { fog: def.fogColor.clone(), den: def.fogDensity, haze: def.hazeHeight }, wrote = { den: -1 };

  function gustAt(t) { const g = 0.5 + 0.32 * Math.sin(t * 0.71) + 0.24 * Math.sin(t * 1.93 + 1.3) + 0.18 * Math.sin(t * 0.27 + 4.0) + 0.1 * Math.sin(t * 3.7); return smooth(0.48, 0.98, g); }
  function lightningEnv(dt) { // three strokes in ~0.45 s
    if (dt < 0 || dt > 0.6) return 0;
    return Math.max(dt < 0.07 ? 1 - dt / 0.07 * 0.3 : 0, dt > 0.11 && dt < 0.17 ? 0.75 : 0, dt > 0.3 && dt < 0.42 ? 0.9 * (1 - (dt - 0.3) / 0.12) : 0) * (1 - dt / 0.9);
  }

  function update(dt, now) {
    const time = now - t0; if (!dt || dt > 0.25) dt = 0.016; lastNow = now;
    const LV = Z.LV, T = Z.T || 0, dust = LV && LV.dust, heat = LV && LV.light === 'heat';
    cam.updateMatrixWorld(); camPos.setFromMatrixPosition(cam.matrixWorld);
    // the focus: where the camera looks on the ground (bounded by its focus distance)
    cam.getWorldDirection(tv); const cd = Z.camDist || 3000;
    if (tv.y < -0.03) { const t = Math.min(-camPos.y / tv.y, cd * 1.6); focus.copy(camPos).addScaledVector(tv, t); } else focus.copy(camPos).addScaledVector(tv, Math.min(cd, 4000));
    focus.y = 0;
    const camY = Math.max(1, camPos.y), hi = smooth(300, 2500, camY);
    const refX = mix(camPos.x, focus.x, hi), refZ = mix(camPos.z, focus.z, hi);

    // ---- storm timeline (sim seconds) ----
    let front = -1e6, wall = 0, inside = 0, appr = 0, env = 0, tail = 0;
    const curv = 5.5e-6;
    if (dust) {
      const d0 = dust[0], d1 = dust[1], len = d1 - d0;
      front = -4200 + 38 * (T - d0);
      wall = smooth(d0 - 760, d0 - 600, T) * (1 - smooth(d0 + 330, d0 + 520, T));
      const e = refX - (front - curv * refZ * refZ);
      inside = smooth(700, -2600, e);
      env = T < d0 + 0.75 * len ? 1 : mix(1, 0.55, smooth(d0 + 0.75 * len, d1, T));
      if (T > d1) env = 0.55 * (1 - smooth(d1, d1 + 170, T));
      if (T < d0 - 800) inside = 0;
      appr = smooth(d0 - 700, d0 - 150, T) * (1 - inside) * (T < d0 + 400 ? 1 : 0);
      tail = smooth(d0 + 0.7 * len, d0 + 0.8 * len, T) * (1 - smooth(d1 + 40, d1 + 190, T));
    }
    const I = inside * env, rain = tail * inside;
    Object.assign(S, { front, inside, appr, I, tail, rain, wall });
    const gust = gustAt(time) * (0.25 + 0.75 * Math.max(I, appr * 0.5));

    // ---- wind (dir = heading the air moves toward, 2D frame: 0 east, +PI/2 south) ----
    const wDir = mix(0.32, 0.06, Math.max(I, appr * 0.6)) + 0.08 * Math.sin(time * 0.13);
    const frontNear = dust ? Math.exp(-(((refX - front) / 2500) ** 2)) : 0;
    const wSpd = mix(3.5 + 1.5 * Math.sin(time * 0.21), 17 + 9 * gust, Math.max(I * (1 - 0.45 * tail), frontNear * 1.15, appr * 0.25));
    A.wind.dir = wDir; A.wind.speed = wSpd; A.wind.gust = Math.max(gust * Math.max(I, frontNear), 0.08 * Math.sin(time * 0.5) ** 2);
    const wx = Math.cos(wDir), wz = Math.sin(wDir);

    // ---- lightning: in the dark cells behind the wall on the approach, around us inside the storm ----
    const canFlash = dust && (appr * wall > 0.3 || (I > 0.5 && tail < 0.9));
    if (canFlash && (time > L.next || L.force)) {
      const Rl = Math.random;
      if (L.t < 0 || time - L.t > 1.5 || L.force) {
        L.t = time; L.idx = Math.floor(Rl() * 4); L.force = false;
        if (I > 0.5) { const a = Rl() * 6.283, dd = 2600 + Rl() * 3500; L.x = camPos.x + Math.cos(a) * dd; L.z = camPos.z + Math.sin(a) * dd; L.dist = dd; L.k = 0.35 + Rl() * 0.3; }
        else { L.x = front - 5000 - Rl() * 7000; L.z = camPos.z + (Rl() - 0.5) * 16000; L.dist = Math.hypot(L.x - camPos.x, L.z - camPos.z); L.k = 0.45 + Rl() * 0.35; }
      }
      L.next = time + 3.5 + Rl() * 8;
    }
    const fl = canFlash || L.t > 0 ? lightningEnv(time - L.t) * L.k : 0;
    A.lightning = fl;
    U.uFlash.value = fl; U.uFlashD.value.set(L.x - camPos.x, 900, L.z - camPos.z).normalize();
    bolt.visible = fl > 0.01;
    if (bolt.visible) { boltU.uBP.value.set(L.x, 0, L.z); boltU.uBH.value = I > 0.5 ? 1700 : 3200; boltU.uBW.value = boltU.uBH.value * 0.5; boltU.uBI.value = fl; boltU.uIdx.value = L.idx; }

    // ---- atmosphere (the core has just reset Z.atmo to this level's clear-day values: read them as the baseline) ----
    if (A.fogDensity !== wrote.den) { base.fog.copy(A.fogColor); base.den = A.fogDensity; base.haze = A.hazeHeight; }
    cA.copy(base.fog).lerp(P.preFog, appr * 0.5);
    cB.copy(P.inFog).lerp(P.inFogDark, 0.45 * gust + 0.2 * (1 - tail)).lerp(P.tailFog, tail * 0.65);
    A.fogColor.copy(cA).lerp(cB, I).multiplyScalar(1 + fl * 1.6);
    // in the storm, visibility of ~1.5-2 km near the ground; from far out, enough to keep the field readable
    const inDen = Math.min(0.0009, Math.max(0.00007, 0.95 / Math.max(cd, 500))) * (1 + 0.22 * gust) * mix(1, 0.5, tail);
    A.fogDensity = mix(base.den * (1 + 0.5 * appr), inDen, I); wrote.den = A.fogDensity;
    A.hazeHeight = mix(base.haze, 300, I);
    A.skyTint.copy(P.preFog).lerp(P.skyIn, I); A.skyTintK = Math.max(I * 0.92, appr * wall * 0.25);
    A.sunDim = mix(mix(1, 0.45, appr * wall), 0.28 + 0.14 * tail, I);
    A.sunTint.copy(P.white).lerp(P.sunIn, Math.max(I, appr * 0.25));
    A.ambientK = mix(1 - 0.4 * appr * wall, 0.6 + 0.1 * tail, I);
    const G = A.grade;
    G.exposure = DG.exposure * mix(1, 1.05, I); G.contrast = DG.contrast * mix(1, 0.88, I); G.saturation = DG.saturation * mix(1 - 0.25 * appr * wall, 0.75 + 0.1 * tail, I);
    G.warmth = DG.warmth + mix(0.06 * appr, 0.3, I); G.vignette = DG.vignette + mix(0.05 * appr, 0.2, I); G.grain = DG.grain + mix(0, 0.045, I);
    A.bloom = mix(1, 1.35, I);
    A.visibility = 1.73 / Math.max(1e-6, A.fogDensity);

    // ---- fallback: a core without Z.atmo (round 1) gets the fog and the sun directly ----
    const fog = scene.fog;
    if (!coreAtmo && (I > 0.001 || appr > 0.001) && fog) {
      fog.color.copy(A.fogColor).convertLinearToSRGB();
      if (fog.isFogExp2) fog.density = A.fogDensity; else { fog.near = 0.1 / A.fogDensity; fog.far = 2.1 / A.fogDensity; }
      if (Z.sun) { Z.sun.intensity = Z.sun.intensity / (Z.dustNow ? 0.45 : 1) * A.sunDim; Z.sun.color.multiply(A.sunTint); }
      if (Z.hemi) Z.hemi.intensity *= A.ambientK * (1 + fl * 1.5);
    }
    // fog uniforms for my own shaders: what the core will give the scene's materials this frame
    const dbgFog = Z.dbg && Z.dbg.fog != null ? Z.dbg.fog : 1;
    if (coreAtmo || !fog) { U.uFogCol.value.copy(A.fogColor); U.uFogP.value.x = A.fogDensity * dbgFog; }
    else { U.uFogCol.value.copy(fog.color); U.uFogP.value.x = fog.isFogExp2 ? fog.density : 1.6 / fog.far; }

    // ---- shared uniforms ----
    U.uTime.value = time; U.uCamPos.value.copy(camPos); U.uFrontX.value = front; U.uCurv.value = curv; U.uGust.value = gust;
    U.uWD.value.set(wx, wz);
    const kv = Math.min(5, Math.max(1, cd / 1100));
    flow += dt * wSpd * kv * 1.4; flowF += dt * wSpd * 1.0; U.uFlow.value = flow;
    const sd = Z.sunDir || tv2.set(0.5, 0.8, 0.2); U.uSunD.value.copy(sd).normalize();
    U.uSunV.value.copy(U.uSunD.value).transformDirection(cam.matrixWorldInverse);
    U.uSunC.value.copy(P.sunWarm).multiply(A.sunTint).multiplyScalar(0.95 * A.sunDim);
    U.uSkyC.value.copy(P.skyClear).lerp(P.skyDust, Math.max(I, appr * 0.4)).multiplyScalar(A.ambientK * (1 + fl * 2));
    U.uGndC.value.copy(P.gndClear).lerp(P.gndDust, I);

    // ---- veil ----
    veil.position.copy(camPos); veil.scale.setScalar(Math.min(cam.far * 0.85, 120000)); veil.updateMatrixWorld();
    veilU.uIn.value = Math.min(1, I * 1.05) * (0.9 + 0.1 * hi);
    veilU.uAppr.value = appr * wall; veilU.uFrontDX.value = Math.max(1, camPos.x - (front - curv * camPos.z * camPos.z)); veilU.uCamY.value = camY;
    veilU.uHor.value.copy(A.fogColor).multiplyScalar(1.05); veilU.uZen.value.copy(P.zenIn).lerp(P.tailFog, tail * 0.5);
    veilU.uSunDisc.value.copy(P.sunDisc).multiplyScalar(mix(0.9, 1.6, tail) * (1 - 0.35 * gust));
    veilU.uTintK.value = 0; veilU.uTint.value.copy(A.skyTint);
    veil.visible = veilU.uIn.value > 0.002 || veilU.uAppr.value > 0.002;

    // ---- cloud shadows ----
    cumX += dt * Math.cos(0.32) * 6 * kv; cumZ += dt * Math.sin(0.32) * 6 * kv;
    const dom = 60000; billU.uCumOff.value.set(cumX % dom, cumZ % dom); shU.uCumOff.value.copy(billU.uCumOff.value);
    const cumA = (heat ? 0.65 : 1) * (1 - Math.max(appr, I)) * (1 - smooth(0.25, 0.9, I));
    billU.uCumA.value = cumA;
    const sy = Math.max(0.15, U.uSunD.value.y), offK = -1 / sy; shU.uSunOff.value.set(U.uSunD.value.x * offK * 1950, U.uSunD.value.z * offK * 1950);
    for (let i = 0; i < NCL; i++) { const c = CLU[i], v = clU[i]; if (!c) { v.w = 0; continue; }
      let x = ((c[0] + cumX % dom) % dom + dom * 1.5) % dom - dom * 0.5, z = ((c[1] + cumZ % dom) % dom + dom * 1.5) % dom - dom * 0.5;
      v.set(x, z, c[2] * 1.05, cumA * smooth(dom * 0.5, dom * 0.5 - 6000, Math.max(Math.abs(x), Math.abs(z)))); }
    shU.uCloudSh.value = mix(0.95, 0.4, smooth(800, 3000, camY)); shU.uStormSh.value = appr * wall * 0.8;
    shU.uCen.value.set(camPos.x, 0, camPos.z); shU.uSize.value = 90000; shU.uH.value = Math.min(40, Math.max(0.5, camY * 0.25));
    shadow.visible = cumA > 0.01 || shU.uStormSh.value > 0.01;

    // ---- billows ----
    billU.uWallA.value = wall * (1 - 0.6 * I); billU.uSkirtA.value = wall * 0.9;
    billU.uCellA.value = wall * (1 - 0.7 * I);
    if (!fieldBox) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const add = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
      for (const r of Z.RW || []) { add(r.x0, r.y); add(r.x1, r.y); } for (const g of Z.GATES || []) add(g.x, g.y);
      fieldBox = x0 < x1 ? [(x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + 500, (y1 - y0) / 2 + 500] : [0, 0, 4000, 3000]; billU.uField.value.set(...fieldBox); }


    // ---- sheets ----
    shtU.uCen.value.set(Math.round(camPos.x / 500) * 500, 0, Math.round(camPos.z / 500) * 500);
    shtU.uSize.value = Math.min(60000, Math.max(9000, cd * 4.5)); shtU.uFade.value = shtU.uSize.value * 0.5;
    const sheetOn = dust ? smooth(dust[0] - 500, dust[0] - 300, T) : 0;
    shtU.uSheetA.value = sheetOn * mix(1, 0.5, hi) * env * (1 - 0.55 * tail) * (0.85 + 0.3 * gust);
    shtU.uLead.value = 900;
    shtU.uDustA.value.copy(P.dustA).multiplyScalar(0.6 + 0.6 * A.sunDim);
    shtU.uDustB.value.copy(P.dustB).multiplyScalar(0.55 + 0.75 * A.sunDim);
    sheets.visible = shtU.uSheetA.value > 0.002;

    // ---- particles ----
    const fovK = 2 * Math.tan(cam.fov * Math.PI / 360) / Math.max(1, Z.renderer.domElement.height);
    parU.uPxK.value = fovK; parU.uFocus.value.copy(focus);
    parU.uBoxN.value = Math.min(380, Math.max(70, camY * 1.1)); parU.uBoxF.value = Math.min(14000, Math.max(500, cd * 1.4)); parU.uFieldH.value = Math.min(120, Math.max(6, cd * 0.014));
    parU.uWindV.value.set(wx * wSpd, 0, wz * wSpd); parU.uFieldV.value.set(wx * wSpd * kv * 1.6, 0, wz * wSpd * kv * 1.6);
    const lowCam = 1 - smooth(250, 900, camY);
    const dustAmt = Math.max(I * (1 - 0.7 * tail), frontNear * (dust && T > dust[0] - 200 ? 1 : 0));
    parU.uAmt.value.set(dustAmt * lowCam * (0.6 + 0.4 * gust) * 0.85, dustAmt * lowCam * gust, Math.max(I, frontNear) * env * (1 - 0.6 * tail) * 0.6 * smooth(250, 1500, camY), rain * lowCam);
    parU.uFarRain.value = rain * (1 - lowCam * 0.4) * 0.8;
    parU.uDustP.value.copy(P.dustP).multiplyScalar(0.95 + 0.7 * A.sunDim + fl);
    const pq = Z.quality >= 2 ? 0.6 : Z.quality === 1 ? 0.42 : 0.28, pAk = 1 / Math.sqrt(pq);   // fewer streaks, each a little denser
    parts.geometry.instanceCount = Math.round(NPT * pq); parU.uAmt.value.multiplyScalar(pAk); parU.uFarRain.value *= pAk;
    parts.visible = parU.uAmt.value.x + parU.uAmt.value.y + parU.uAmt.value.z + parU.uAmt.value.w + parU.uFarRain.value > 0.003;
    massFlow += dt * wSpd * kv * 1.1;
    billU.uMB.value.set(mix(camPos.x, focus.x, hi), 0, mix(camPos.z, focus.z, hi), Math.min(24000, Math.max(2600, cd * 2.2)));
    billU.uMV.value.set(wx * massFlow, 0, wz * massFlow);
    billU.uMassA.value = sheetOn * env * (1 - 0.45 * tail) * mix(0.75, 0.55, hi);
    bill.visible = billU.uCumA.value > 0.003 || wall > 0.003 || billU.uMassA.value > 0.003;
  }

  return { update, flash() { L.force = true; L.next = 0; L.t = -9; }, state: () => S };
};
