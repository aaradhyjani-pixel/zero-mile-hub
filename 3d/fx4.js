Z3MOD.fx4 = function (Z) {
  // Round 2/3 set pieces (3d/FX.md): the water-salute arch, the wedding elephant, GPS-spoofing ghost aircraft and the ops
  // WhatsApp storm. Reads Z.fx every frame and draws the kinds it knows. States follow sim time (Z.T); motion runs in real
  // time. Everything scales up with camera distance so it reads from the strategic view, and every mesh is hidden while no
  // item of its kind is active. Draw calls while all four are active: shadows 1, tenders 1, water 1, elephant 1, ghosts 1,
  // chat 1. No per-frame allocations.
  const THREE = Z.THREE, scene = Z.scene;
  const root = new THREE.Group(); root.name = 'fx4'; scene.add(root);
  const KS = Z.fxKinds || (Z.fxKinds = new Set());
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _s = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0), ZAX = new THREE.Vector3(0, 0, 1), QFLIP = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI);
  const camD = () => Z.camDist || 3000;
  const pxScale = () => { const c = Z.camera, h = Z.renderer.domElement.height; return h / (2 * Math.tan(c.fov * Math.PI / 360)); };
  const GLSL_NOISE = `
float fx4h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float fx4n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(fx4h(i),fx4h(i+vec2(1,0)),f.x),mix(fx4h(i+vec2(0,1)),fx4h(i+vec2(1,1)),f.x),f.y);}
`;
  const ST = new Map();
  const stOf = (it, mk) => { let s = ST.get(it); if (!s) { s = mk(); ST.set(it, s); } return s; };

  // ---------------- contact shadows and wet patches: soft ground blobs, one instanced draw ----------------
  const BLOBN = 24;
  const blobGeo = new THREE.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);
  const blobOp = new THREE.InstancedBufferAttribute(new Float32Array(BLOBN), 1); blobOp.setUsage(THREE.DynamicDrawUsage); blobGeo.setAttribute('aOp', blobOp);
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  blobMat.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute float aOp;varying float vOp;varying vec2 vQ;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvOp=aOp;vQ=position.xz*2.;');
    sh.fragmentShader = 'varying float vOp;varying vec2 vQ;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\nfloat r2=dot(vQ,vQ);diffuseColor.a*=vOp*pow(max(0.,1.-r2),1.6);');
  };
  const blobs = new THREE.InstancedMesh(blobGeo, blobMat, BLOBN); blobs.frustumCulled = false; blobs.renderOrder = 20; blobs.count = 0;
  blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(blobs);
  let nBlob = 0;
  const blob = (x, z, rot, sx, sz, op) => {
    if (nBlob >= BLOBN || op <= 0.001) return;
    _q.setFromAxisAngle(UP, rot); _v.set(x, 0.35, z); _s.set(sx, 1, sz); _m.compose(_v, _q, _s);
    blobs.setMatrixAt(nBlob, _m); blobOp.array[nBlob] = op; nBlob++;
  };

  // ---------------- a merged, vertex-coloured kit builder (rough/metal/part per vertex) ----------------
  function Kit() { this.P = []; this.N = []; this.C = []; this.RM = []; this.A = []; }
  const KM = new THREE.Matrix4(), KN = new THREE.Matrix3(), KQ = new THREE.Quaternion(), KE = new THREE.Euler(), KV = new THREE.Vector3(), KS3 = new THREE.Vector3(), KT = new THREE.Vector3(), KC = new THREE.Color();
  Kit.prototype.add = function (geo, x, y, z, rx, ry, rz, sx, sy, sz, hex, rough, metal, part) {
    const g = geo.index ? geo.toNonIndexed() : geo; KE.set(rx, ry, rz); KQ.setFromEuler(KE); KV.set(x, y, z); KS3.set(sx, sy, sz); KM.compose(KV, KQ, KS3); KN.getNormalMatrix(KM); KC.set(hex);
    const gp = g.attributes.position, gn = g.attributes.normal;
    for (let i = 0; i < gp.count; i++) {
      KT.fromBufferAttribute(gp, i).applyMatrix4(KM); this.P.push(KT.x, KT.y, KT.z); KT.fromBufferAttribute(gn, i).applyMatrix3(KN).normalize(); this.N.push(KT.x, KT.y, KT.z);
      this.C.push(KC.r, KC.g, KC.b); this.RM.push(rough, metal); this.A.push(part || 0);
    }
  };
  Kit.prototype.geo = function (inst) {
    const g = inst ? new THREE.InstancedBufferGeometry() : new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3)); g.setAttribute('aRM', new THREE.Float32BufferAttribute(this.RM, 2)); g.setAttribute('aPart', new THREE.Float32BufferAttribute(this.A, 1));
    return g;
  };
  const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 14), CYL8 = new THREE.CylinderGeometry(1, 1, 1, 10), SPH = new THREE.SphereGeometry(1, 10, 6);

  // =====================================================================================================
  // THE WATER-SALUTE ARCH: two red ARFF tenders, roof monitors throwing crossing water arcs (GPU particles with drag),
  // droplets that glint, drifting mist, and a rainbow where the sunlit spray sits 42 degrees from the antisolar point
  // =====================================================================================================
  const WAT = (() => {
    const K = new Kit(), RED = '#c3121b', GLASS = '#0b1418', EL = 0.86;   // monitor elevation (rad)
    K.add(BOX, 0.2, 0.95, 0, 0, 0, 0, 11.8, 0.45, 2.3, '#1f1f1f', 0.7, 0.3, 0);
    for (const x of [4.3, -1.75, -3.65]) for (const z of [-1.27, 1.27]) {
      K.add(CYL, x, 0.68, z, Math.PI / 2, 0, 0, 0.68, 0.58, 0.68, '#121212', 0.92, 0, 0);
      K.add(CYL8, x, 0.68, z + Math.sign(z) * 0.3, Math.PI / 2, 0, 0, 0.36, 0.04, 0.36, '#d6d6d6', 0.35, 0.8, 0);
      K.add(BOX, x, 1.45, z * 1.02, 0, 0, 0, 1.75, 0.1, 0.7, '#202020', 0.6, 0.2, 0);
    }
    K.add(BOX, 5.0, 2.2, 0, 0, 0, 0, 2.7, 2.1, 2.95, RED, 0.3, 0.08, 0);                 // cab
    K.add(BOX, 6.28, 2.62, 0, 0, 0, 0.3, 0.12, 1.2, 2.8, GLASS, 0.04, 0.2, 0);            // raked windscreen
    K.add(BOX, 4.95, 2.75, 0, 0, 0, 0, 2.3, 0.85, 3.0, GLASS, 0.04, 0.2, 0);             // side glass
    K.add(BOX, 6.45, 1.05, 0, 0, 0, 0, 0.32, 0.42, 3.02, '#d8d8d8', 0.35, 0.6, 0);       // bumper
    for (const z of [-1.15, 1.15]) K.add(BOX, 6.56, 1.33, z, 0, 0, 0, 0.1, 0.2, 0.45, '#ffffff', 0.2, 0, 4);
    K.add(BOX, -1.25, 2.25, 0, 0, 0, 0, 9.5, 2.2, 2.95, RED, 0.3, 0.08, 0);              // body
    for (const x of [2.15, -0.6, -3.4]) K.add(BOX, x, 2.05, 0, 0, 0, 0, 2.45, 1.45, 3.03, '#c4c7cb', 0.35, 0.7, 2);   // roller shutters
    K.add(BOX, 0.25, 1.3, 0, 0, 0, 0, 12.4, 0.2, 3.05, '#f0d20a', 0.35, 0, 5);           // reflective band
    K.add(BOX, -1.25, 3.22, 0, 0, 0, 0, 9.55, 0.12, 3.0, '#f2f2f2', 0.4, 0, 0);
    for (const z of [-1.38, 1.38]) K.add(BOX, -1.3, 3.45, z, 0, 0, 0, 9.0, 0.07, 0.06, '#cfcfcf', 0.3, 0.8, 0);
    K.add(BOX, 5.75, 3.35, 0, 0, 0, 0, 0.35, 0.16, 2.3, '#3a3a3a', 0.3, 0, 3);           // light bar
    for (const z of [-0.95, 0.95]) K.add(BOX, -6.0, 2.9, z, 0, 0, 0, 0.1, 0.25, 0.3, '#ff2010', 0.3, 0, 6);
    // roof monitor on the cab, aimed across the runway (local +z)
    K.add(CYL8, 4.6, 3.45, 0, 0, 0, 0, 0.34, 0.3, 0.34, '#d0d0d0', 0.3, 0.85, 0);
    K.add(SPH, 4.6, 3.72, 0, 0, 0, 0, 0.27, 0.27, 0.27, '#d4d4d4', 0.25, 0.9, 0);
    K.add(CYL8, 4.6, 3.72 + 0.62 * Math.sin(EL), 0.62 * Math.cos(EL), Math.PI / 2 - EL, 0, 0, 0.12, 1.24, 0.12, '#e2e2e2', 0.22, 0.9, 0);
    K.add(CYL8, 4.6, 3.72 + 1.3 * Math.sin(EL), 1.3 * Math.cos(EL), Math.PI / 2 - EL, 0, 0, 0.17, 0.3, 0.17, '#262626', 0.5, 0.3, 0);
    const geo = K.geo(false);
    const U = { uTime: { value: 0 } };
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 1.15 });
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = U.uTime;
      sh.vertexShader = 'attribute vec2 aRM;attribute float aPart;varying vec2 vRM;varying float vPart;varying vec3 vLP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRM=aRM;vPart=aPart;vLP=position;');
      sh.fragmentShader = 'uniform float uTime;varying vec2 vRM;varying float vPart;varying vec3 vLP;\n' + sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\nif(abs(vPart-2.)<0.5)diffuseColor.rgb*=0.78+0.22*step(0.28,fract(vLP.y*9.));')
        .replace('float roughnessFactor = roughness;', 'float roughnessFactor = vRM.x;').replace('float metalnessFactor = metalness;', 'float metalnessFactor = vRM.y;')
        .replace('vec3 totalEmissiveRadiance = emissive;', `vec3 totalEmissiveRadiance = emissive;
          if(abs(vPart-3.)<0.5){float sd=vLP.z>0.?1.:0.;float on=step(0.55,fract(uTime*2.3+sd*0.5))*step(0.3,fract(uTime*9.2));totalEmissiveRadiance+=mix(vec3(1.,0.04,0.02),vec3(0.05,0.2,1.),sd)*on*7.;}
          if(abs(vPart-4.)<0.5)totalEmissiveRadiance+=vec3(3.);
          if(abs(vPart-5.)<0.5)totalEmissiveRadiance+=diffuseColor.rgb*0.25;
          if(abs(vPart-6.)<0.5)totalEmissiveRadiance+=vec3(2.,0.1,0.05);`);
    };
    const trucks = new THREE.InstancedMesh(geo, mat, 2); trucks.frustumCulled = false; trucks.visible = false; trucks.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(trucks);

    // jet ballistics with linear drag, solved once: from the monitor tip (lateral -D+s0, height h0) to a crown at H just past
    // the centreline
    const D = 52, h0 = 3.72 + 1.45 * Math.sin(EL), s0 = -D + 1.45 * Math.cos(EL), H = 36, sPk = 5, KD = 0.24, g = 9.81;
    let lo = 1, hi = 90; const yAt = (vy, t) => ((vy + g / KD) / KD) * (1 - Math.exp(-KD * t)) - g * t / KD;
    for (let i = 0; i < 60; i++) { const vy = (lo + hi) / 2, tp = Math.log(1 + KD * vy / g) / KD; if (yAt(vy, tp) > H - h0) hi = vy; else lo = vy; }
    const VY = (lo + hi) / 2, TP = Math.log(1 + KD * VY / g) / KD, VX = (sPk - s0) * KD / (1 - Math.exp(-KD * TP));
    let TF = TP; while (h0 + yAt(VY, TF) > 0 && TF < 20) TF += 0.01;
    // particles: 0/1 stream (jet A/B), 2/3 droplets, 4/5 mist
    const NS = 2600, ND = 800, NM = 520, n = 2 * (NS + ND + NM), sd = new Float32Array(n * 4), R = mulberry(515);
    let o = 0; const put = (kind) => { sd[o++] = kind; sd[o++] = R(); sd[o++] = R(); sd[o++] = R(); };
    for (let j = 0; j < 2; j++) { for (let i = 0; i < NS; i++) put(j); for (let i = 0; i < ND; i++) put(2 + j); for (let i = 0; i < NM; i++) put(4 + j); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); pg.setAttribute('aSd', new THREE.BufferAttribute(sd, 4));
    const PU = { uTime: { value: 0 }, uFade: { value: 0 }, uK: { value: 1 }, uSz: { value: 1 }, uProj: { value: 1000 }, uO: { value: new THREE.Vector3() }, uAx: { value: new THREE.Vector2(1, 0) },
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uWind: { value: new THREE.Vector2() }, uJ: { value: new THREE.Vector4(VX, VY, KD, h0) }, uS0: { value: s0 }, uTF: { value: TF }, uTP: { value: TP } };
    const pmat = new THREE.ShaderMaterial({ uniforms: PU, transparent: true, depthWrite: false,
      vertexShader: `uniform float uTime,uFade,uK,uSz,uProj,uS0,uTF,uTP;uniform vec3 uO,uSun;uniform vec2 uAx,uWind;uniform vec4 uJ;attribute vec4 aSd;
        varying vec4 vCol;varying float vTyp;
        float h1(float x){return fract(sin(x*78.233)*43758.5453);}
        vec2 traj(float t,float vj){float e=1.-exp(-uJ.z*t);return vec2(uS0+uJ.x*vj/uJ.z*e,uJ.w+(uJ.y*vj+9.81/uJ.z)/uJ.z*e-9.81*t/uJ.z);}
        vec3 hue(float h){return clamp(vec3(abs(h*6.-3.)-1.,2.-abs(h*6.-2.),2.-abs(h*6.-4.)),0.,1.);}
        void main(){
          float kind=aSd.x,side=mod(kind,2.)<0.5?1.:-1.,typ=floor(kind*0.5+0.01),r1=aSd.y,r2=aSd.z,r3=aSd.w;
          vec3 lp;float size,a,t=0.;vec3 col=vec3(0.80,0.87,0.95);
          vec3 rr=vec3(h1(r1*31.+r2),h1(r2*17.+r3),h1(r3*13.+r1))-0.5;
          if(typ<1.5){
            float life=uTF*(0.96+0.1*h1(r1*7.));
            t=fract(r1+uTime/life)*life;
            float vj=1.+(r2-0.5)*(typ<0.5?0.035:0.12);
            vec2 b=traj(t,vj);
            float br=smoothstep(uTP*0.55,uTF,t);   // the jet breaks up after the crown
            float sp=(typ<0.5?1.:2.4)*(0.07+0.22*t+0.25*t*t*br+0.6*br);
            lp=vec3(b.x+rr.x*sp*0.7,b.y+rr.y*sp,rr.z*sp*(1.6+2.*br));
            size=typ<0.5?(0.32+0.22*t+0.5*br):(0.10+0.06*r3);
            a=typ<0.5?mix(0.55,0.22,br):0.85;
            a*=smoothstep(-0.2,1.4,b.y)*smoothstep(0.,0.06,t);
            if(typ>0.5){float gl=step(0.9,h1(r1*91.+floor(uTime*14.+r2*10.)));col=col*(1.+gl*5.);size*=1.+gl;}
          } else {
            float tb=uTP*0.9+(uTF-uTP*0.9)*pow(r1,0.6);
            vec2 b=traj(tb,1.);
            float life=5.+4.*r2,age=fract(r3+uTime/life)*life,u=age/life;
            lp=vec3(b.x+rr.x*(5.+6.*u),max(0.4+2.5*u,b.y*0.9+rr.y*6.-u*2.),rr.z*(7.+5.*u));
                        size=3.2+7.*u+3.*r2;
            a=0.085*sin(3.1416*u)*(0.6+0.8*h1(r1*3.));
            col=vec3(0.86,0.9,0.95);
          }
          lp.x*=side;
          vec2 L=vec2(-uAx.y,uAx.x);
          vec3 wp=uO+vec3(L.x*lp.x+uAx.x*lp.z,lp.y,L.y*lp.x+uAx.y*lp.z)*uK;
          if(typ>1.5)wp.xz+=uWind*uK*(lp.y*0.15);
          // light: sunlit tops are brighter; a rainbow where the scattering angle is 40-42.5 degrees
          col*=0.8+0.3*clamp(uSun.y,0.,1.);
          vec3 vd=normalize(wp-cameraPosition);float th=acos(clamp(dot(vd,-uSun),-1.,1.));
          float x=(0.742-th)/0.052;
          if(x>0.&&x<1.){float w=sin(3.1416*x);col=mix(col,hue(x*0.78)*1.25+0.08,(typ>1.5?0.65:0.45)*w);}
          vec4 mv=modelViewMatrix*vec4(wp,1.);gl_Position=projectionMatrix*mv;
          float px=size*uK*uSz*uProj/-mv.z;
          a*=uFade*clamp(px*px/2.25,0.08,1.);
          gl_PointSize=clamp(px,1.5,220.);
          vCol=vec4(col,a);vTyp=typ;
        }`,
      fragmentShader: `varying vec4 vCol;varying float vTyp;void main(){vec2 q=gl_PointCoord*2.-1.;float r=dot(q,q);if(r>1.)discard;
        float a=vCol.a*(vTyp>1.5?(1.-r)*(1.-r):vTyp>0.5?(1.-r*r):(1.-r));gl_FragColor=vec4(vCol.rgb,a);}` });
    const pts = new THREE.Points(pg, pmat); pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 30; root.add(pts);
    return { trucks, U, pts, PU, D, TF, sPk };
  })();
  function archUpdate(list, dt, now) {
    const it = list[0];
    if (!it) { WAT.trucks.visible = false; WAT.pts.visible = false; return; }
    const T = Z.T, k = clamp(camD() / 2300, 1, 4.6), ca = Math.cos(it.a || 0), sa = Math.sin(it.a || 0);
    const vis = smooth(it.t0 - 1, it.t0 + 4, T) * (1 - smooth(it.t1 - 6, it.t1, T));
    const flow = smooth(it.t0 + 4, it.t0 + 16, T) * (1 - smooth(it.t1 - 40, it.t1 - 12, T));
    WAT.trucks.visible = vis > 0.01; WAT.pts.visible = flow > 0.01;
    // trucks: A on the -lateral side facing along the axis, B mirrored; monitors line up at axis offset 0
    const Lx = -sa, Lz = ca, D = WAT.D * k, sc = k * Math.max(0.02, vis);
    for (let i = 0; i < 2; i++) {
      const sg = i ? 1 : -1, th = i ? -(it.a || 0) + Math.PI : -(it.a || 0), fx = i ? -1 : 1;
      _q.setFromAxisAngle(UP, th); _v.set(it.x + Lx * D * sg - ca * 4.6 * k * fx, 0, it.y + Lz * D * sg - sa * 4.6 * k * fx); _s.setScalar(sc);
      _m.compose(_v, _q, _s); WAT.trucks.setMatrixAt(i, _m);
      blob(_v.x + ca * 0.3 * k * fx, _v.z + sa * 0.3 * k * fx, -(it.a || 0), 14 * k, 4.4 * k, 0.55 * vis);
      // wet runway where the arc comes down
      const land = (WAT.sPk + 28) * k;
      blob(it.x - Lx * land * sg, it.y - Lz * land * sg, -(it.a || 0), 26 * k, 52 * k, 0.22 * flow);
    }
    WAT.trucks.instanceMatrix.needsUpdate = true; WAT.U.uTime.value = now;
    const P = WAT.PU; P.uTime.value = now; P.uFade.value = flow; P.uK.value = k; P.uSz.value = clamp(camD() / 1600, 1, 2.6); P.uProj.value = pxScale();
    P.uO.value.set(it.x, 0, it.y); P.uAx.value.set(ca, sa); if (Z.sunDir) P.uSun.value.copy(Z.sunDir);
    const w = Z.atmo && Z.atmo.wind; if (w) P.uWind.value.set(Math.cos(w.dir) * (w.speed || 0), Math.sin(w.dir) * (w.speed || 0)); else P.uWind.value.set(2, 0);
  }
  KS.add('waterarch');

  // =====================================================================================================
  // per frame
  // =====================================================================================================
  let lastT = null;
  const L = { waterarch: [], elephant: [], ghosts: [], chat: [] };
  return {
    update(dt, now) {
      const fx = Z.fx || [], T = Z.T;
      lastT = T;
      for (const k in L) L[k].length = 0;
      for (let i = 0; i < fx.length; i++) { const o = fx[i]; if (L[o.kind] && T >= o.t0 - 1 && T <= o.t1 + 2) L[o.kind].push(o); }
      if (ST.size > 32) ST.clear();
      nBlob = 0;
      archUpdate(L.waterarch, dt, now);
      blobs.count = nBlob; blobs.visible = nBlob > 0;
      if (nBlob) { blobs.instanceMatrix.needsUpdate = true; blobOp.needsUpdate = true; }
    },
  };
};
