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
  // THE WEDDING ELEPHANT: a lofted, skinned Asian tusker (6.5 m trunk to tail) with a painted face and trunk, an embroidered
  // velvet jhool, a gold howdah under a chhatri, gold anklets and a mahout; lateral-sequence walk, ear flaps, trunk swing
  // =====================================================================================================
  function Loft() { this.p = []; this.si = []; this.sw = []; this.pat = []; this.ix = []; }
  // rings: [x,y,z, a (radius along U), b (radius along S), bone0, bone1, w1, param]
  Loft.prototype.tube = function (rings, n, region, ref, caps) {
    const T = new THREE.Vector3(), S = new THREE.Vector3(), U = new THREE.Vector3(), R = new THREE.Vector3(ref[0], ref[1], ref[2]), P = new THREE.Vector3();
    const base = this.p.length / 3, m = rings.length;
    for (let i = 0; i < m; i++) {
      const a = rings[Math.max(0, i - 1)], b = rings[Math.min(m - 1, i + 1)], r = rings[i];
      T.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
      S.crossVectors(T, R); if (S.lengthSq() < 1e-6) S.set(0, 0, 1); S.normalize(); U.crossVectors(S, T).normalize();
      for (let j = 0; j < n; j++) {
        const th = j / n * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
        P.set(r[0], r[1], r[2]).addScaledVector(U, r[3] * c).addScaledVector(S, r[4] * s);
        this.p.push(P.x, P.y, P.z); this.si.push(r[5], r[6], 0, 0); this.sw.push(1 - r[7], r[7], 0, 0);
        this.pat.push(P.x, P.y, P.z, region + clamp(r[8] != null ? r[8] : i / (m - 1), 0, 1) * 0.98);
      }
    }
    for (let i = 0; i < m - 1; i++) for (let j = 0; j < n; j++) { const a = base + i * n + j, b = base + i * n + (j + 1) % n, c = a + n, d = b + n; this.ix.push(a, b, c, b, d, c); }
    const cap = (i, end) => {
      const r = rings[i], o = rings[end ? i - 1 : i + 1]; T.set(r[0] - o[0], r[1] - o[1], r[2] - o[2]).normalize();
      const k = Math.min(r[3], r[4]) * 0.35, ci = this.p.length / 3;
      this.p.push(r[0] + T.x * k, r[1] + T.y * k, r[2] + T.z * k); this.si.push(r[5], r[6], 0, 0); this.sw.push(1 - r[7], r[7], 0, 0); this.pat.push(r[0], r[1], r[2], region + (end ? 0.98 : 0));
      for (let j = 0; j < n; j++) { const a = base + i * n + j, b = base + i * n + (j + 1) % n; if (end) this.ix.push(ci, a, b); else this.ix.push(ci, b, a); }
    };
    if (caps & 1) cap(0, false); if (caps & 2) cap(m - 1, true);
  };
  // an open sheet: rows of points (already positioned) with bones, across-param in w
  Loft.prototype.sheet = function (rows, region) {
    const base = this.p.length / 3, m = rows.length, n = rows[0].length;
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) { const q = rows[i][j]; this.p.push(q[0], q[1], q[2]); this.si.push(q[3], q[4], 0, 0); this.sw.push(1 - q[5], q[5], 0, 0); this.pat.push(q[0], q[1], q[2], region + j / (n - 1) * 0.98); }
    for (let i = 0; i < m - 1; i++) for (let j = 0; j < n - 1; j++) { const a = base + i * n + j, b = a + 1, c = a + n, d = c + 1; this.ix.push(a, c, b, b, c, d); }
  };
  const PM = new THREE.Matrix4(), PQ = new THREE.Quaternion(), PE = new THREE.Euler(), PV = new THREE.Vector3(), PS = new THREE.Vector3();
  Loft.prototype.prim = function (geo, x, y, z, rx, ry, rz, sx, sy, sz, bone, region) {
    PE.set(rx, ry, rz); PQ.setFromEuler(PE); PV.set(x, y, z); PS.set(sx, sy, sz); PM.compose(PV, PQ, PS);
    const pos = geo.attributes.position, base = this.p.length / 3;
    for (let i = 0; i < pos.count; i++) { PV.fromBufferAttribute(pos, i).applyMatrix4(PM); this.p.push(PV.x, PV.y, PV.z); this.si.push(bone, bone, 0, 0); this.sw.push(1, 0, 0, 0); this.pat.push(PV.x, PV.y, PV.z, region + 0.5); }
    if (geo.index) for (let j = 0; j < geo.index.count; j++) this.ix.push(base + geo.index.getX(j)); else for (let j = 0; j < pos.count; j++) this.ix.push(base + j);
  };
  Loft.prototype.geo = function () {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4)); g.setAttribute('aPat', new THREE.Float32BufferAttribute(this.pat, 4));
    g.setIndex(this.ix); g.computeVertexNormals(); return g;
  };
  const pathPrep = p => { const c = [0]; for (let i = 1; i < p.length; i++) c.push(c[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])); return c; };
  const PT = { x: 0, y: 0, h: 0 };
  const pathAt = (p, c, d) => {
    const Ln = c[c.length - 1]; d = clamp(d, 0, Ln); let i = 1; while (i < c.length - 1 && c[i] < d) i++;
    const a = p[i - 1], b = p[i] || a, sl = Math.max(1e-6, c[i] - c[i - 1]), t = clamp((d - c[i - 1]) / sl, 0, 1);
    PT.x = a[0] + (b[0] - a[0]) * t; PT.y = a[1] + (b[1] - a[1]) * t; PT.h = Math.atan2(b[1] - a[1], b[0] - a[0]); return PT;
  };

  const EL = (() => {
    const zf = 0.46, zh = 0.43;
    const defs = [
      ['root', -1, [0, 0, 0]], ['pelvis', 0, [-1.2, 2.15, 0]], ['spine', 1, [-0.2, 2.15, 0]], ['chest', 2, [0.75, 2.2, 0]], ['neck', 3, [1.3, 2.35, 0]], ['head', 4, [1.7, 2.45, 0]],
      ['tr1', 5, [2.25, 2.05, 0]], ['tr2', 6, [2.38, 1.6, 0]], ['tr3', 7, [2.45, 1.15, 0]], ['tr4', 8, [2.45, 0.75, 0]], ['tr5', 9, [2.45, 0.4, 0]],
      ['earL', 5, [1.55, 2.82, 0.52]], ['earR', 5, [1.55, 2.82, -0.52]], ['ta0', 1, [-1.8, 2.3, 0]], ['ta1', 13, [-1.84, 1.9, 0]], ['ta2', 14, [-1.86, 1.5, 0]],
      ['flU', 3, [0.88, 2.1, zf]], ['flL', 16, [0.9, 1.07, zf]], ['flP', 17, [0.9, 0.27, zf]],
      ['frU', 3, [0.88, 2.1, -zf]], ['frL', 19, [0.9, 1.07, -zf]], ['frP', 20, [0.9, 0.27, -zf]],
      ['hlU', 1, [-1.15, 2.1, zh]], ['hlL', 22, [-1.12, 1.02, zh]], ['hlP', 23, [-1.17, 0.27, zh]],
      ['hrU', 1, [-1.15, 2.1, -zh]], ['hrL', 25, [-1.12, 1.02, -zh]], ['hrP', 26, [-1.17, 0.27, -zh]],
    ];
    const bones = defs.map(d => { const b = new THREE.Bone(); b.name = d[0]; return b; });
    defs.forEach((d, i) => { const p = d[1] >= 0 ? defs[d[1]][2] : [0, 0, 0]; bones[i].position.set(d[2][0] - p[0], d[2][1] - p[1], d[2][2] - p[2]); if (d[1] >= 0) bones[d[1]].add(bones[i]); });
    const L = new Loft();
    const bx = [[-1.2, 1], [-0.2, 2], [0.75, 3], [1.3, 4]];
    const bw = x => { if (x <= bx[0][0]) return [1, 1, 0]; for (let i = 0; i < bx.length - 1; i++) if (x <= bx[i + 1][0]) { const t = (x - bx[i][0]) / (bx[i + 1][0] - bx[i][0]); return [bx[i][1], bx[i + 1][1], t]; } return [4, 4, 0]; };
    // torso: x, centre y, half height, half width
    const tor = [[-1.95, 2.0, 0.22, 0.2], [-1.88, 2.02, 0.5, 0.42], [-1.72, 2.02, 0.68, 0.58], [-1.45, 2.0, 0.8, 0.68], [-1.1, 1.98, 0.86, 0.75], [-0.6, 1.96, 0.9, 0.8],
      [-0.1, 1.95, 0.92, 0.82], [0.4, 1.98, 0.9, 0.79], [0.8, 2.03, 0.86, 0.72], [1.1, 2.1, 0.78, 0.62], [1.32, 2.2, 0.68, 0.54]];
    const torAt = x => { for (let i = 0; i < tor.length - 1; i++) if (x <= tor[i + 1][0]) { const t = (x - tor[i][0]) / (tor[i + 1][0] - tor[i][0]); return [mix(tor[i][1], tor[i + 1][1], t), mix(tor[i][2], tor[i + 1][2], t), mix(tor[i][3], tor[i + 1][3], t)]; } return tor[tor.length - 1].slice(1); };
    L.tube(tor.map(r => { const w = bw(r[0]); return [r[0], r[1], 0, r[2], r[3], w[0], w[1], w[2], (r[0] + 1.95) / 3.3]; }), 32, 0, [0, 1, 0], 1);
    // head and trunk in one tube (ref z: a = half width, b = half height)
    const hd = [[1.22, 2.3, 0.55, 0.66, 3, 4, 0.8], [1.5, 2.42, 0.55, 0.68, 4, 5, 0.4], [1.75, 2.47, 0.52, 0.62, 5, 5, 0], [1.97, 2.42, 0.46, 0.53, 5, 5, 0], [2.14, 2.25, 0.36, 0.41, 5, 6, 0.3],
      [2.27, 2.0, 0.26, 0.28, 6, 6, 0], [2.36, 1.7, 0.21, 0.22, 6, 7, 0.3], [2.42, 1.36, 0.18, 0.18, 7, 7, 0], [2.45, 1.02, 0.155, 0.155, 8, 8, 0], [2.45, 0.72, 0.13, 0.13, 9, 9, 0],
      [2.45, 0.45, 0.115, 0.115, 9, 10, 0.5], [2.47, 0.25, 0.1, 0.1, 10, 10, 0], [2.54, 0.15, 0.085, 0.08, 10, 10, 0], [2.63, 0.14, 0.06, 0.055, 10, 10, 0]];
    L.tube(hd.map((r, i) => [r[0], r[1], 0, r[2], r[3], r[4], r[5], r[6], i / (hd.length - 1)]), 22, 2, [0, 0, 1], 2);
    // ears (flattened tubes down the side of the head, bound to the ear bones)
    for (const s of [1, -1]) {
      const b = s > 0 ? 11 : 12;
      L.tube([[1.52, 2.92, 0.5 * s, 0.16, 0.03], [1.49, 2.78, 0.57 * s, 0.36, 0.045], [1.45, 2.52, 0.61 * s, 0.43, 0.05], [1.42, 2.22, 0.62 * s, 0.38, 0.045], [1.42, 1.98, 0.6 * s, 0.25, 0.04], [1.46, 1.82, 0.58 * s, 0.1, 0.03]]
        .map((r, i) => [r[0], r[1], r[2], r[3], r[4], b, b, 0, i / 5]), 12, 4, [1, 0, 0], 3);
      // tusks
      L.tube([[2.1, 2.02, 0.22 * s, 0.07, 0.07], [2.34, 1.8, 0.26 * s, 0.058, 0.058], [2.58, 1.74, 0.28 * s, 0.042, 0.042], [2.72, 1.82, 0.28 * s, 0.014, 0.014]].map((r, i) => [r[0], r[1], r[2], r[3], r[4], 5, 5, 0, i / 3]), 8, 9, [0, 0, 1], 2);
    }
    // tail
    L.tube([[-1.82, 2.32, 0.075, 1, 13, 0.5], [-1.84, 1.95, 0.055, 13, 13, 0], [-1.86, 1.6, 0.045, 14, 14, 0], [-1.87, 1.32, 0.04, 15, 15, 0], [-1.88, 1.16, 0.075, 15, 15, 0], [-1.88, 1.0, 0.02, 15, 15, 0]]
      .map((r, i) => [r[0], r[1], 0, r[2], r[2], r[3], r[4], r[5], i / 5]), 8, 3, [0, 0, 1], 2);
    // legs (ref z: a = side, b = front-back)
    const leg = (x0, z, u, top, hind) => [[x0, 2.25, z, hind ? 0.38 : 0.36, hind ? 0.5 : 0.42, top, u, 0.6], [x0, 1.8, z, hind ? 0.34 : 0.33, hind ? 0.42 : 0.36, u, u, 0], [x0 + 0.02, 1.4, z, 0.3, 0.31, u, u, 0],
      [x0 + 0.03, 1.05, z, 0.265, 0.275, u, u + 1, 0.5], [x0 + 0.02, 0.75, z, 0.24, 0.25, u + 1, u + 1, 0], [x0 + 0.01, 0.45, z, 0.245, 0.255, u + 1, u + 1, 0],
      [x0 + 0.01, 0.27, z, 0.26, 0.27, u + 1, u + 2, 0.5], [x0 + 0.02, 0.12, z, 0.29, 0.3, u + 2, u + 2, 0], [x0 + 0.02, 0.02, z, 0.3, 0.31, u + 2, u + 2, 0]].map((r, i) => [...r, i / 8]);
    L.tube(leg(0.88, zf, 16, 3, 0), 14, 1, [0, 0, 1], 2); L.tube(leg(0.88, -zf, 19, 3, 0), 14, 1, [0, 0, 1], 2);
    L.tube(leg(-1.15, zh, 22, 1, 1), 14, 1, [0, 0, 1], 2); L.tube(leg(-1.15, -zh, 25, 1, 1), 14, 1, [0, 0, 1], 2);
    // the jhool: embroidered velvet draped over the back, hanging straight down the flanks
    const rows = [];
    for (let i = 0; i <= 10; i++) {
      const x = -1.02 + i / 10 * 1.9, tb = torAt(x), cy = tb[0], a = tb[1] + 0.05, b = tb[2] + 0.05, w = bw(x), hem = 1.22 + 0.14 * Math.pow((x + 0.07) / 0.95, 2), row = [];
      const NA = 18, NH = 5;
      for (let j = 0; j <= NH; j++) { const y = mix(hem, cy, j / NH); row.push([x, y, -(b + 0.05 * (cy - y)), w[0], w[1], w[2]]); }
      for (let j = 1; j < NA; j++) { const th = -Math.PI / 2 + j / NA * Math.PI; row.push([x, cy + a * Math.cos(th), b * Math.sin(th), w[0], w[1], w[2]]); }
      for (let j = NH; j >= 0; j--) { const y = mix(hem, cy, j / NH); row.push([x, y, b + 0.05 * (cy - y), w[0], w[1], w[2]]); }
      rows.push(row);
    }
    L.sheet(rows, 5);
    // howdah: cushion, seat box, rail, posts, chhatri with finial
    const HX = -0.08;
    L.prim(BOX, HX, 2.98, 0, 0, 0, 0, 1.55, 0.18, 1.3, 2, 13);
    L.prim(BOX, HX, 3.34, 0, 0, 0, 0, 1.15, 0.55, 1.0, 2, 7);
    L.prim(BOX, HX, 3.63, 0, 0, 0, 0, 1.24, 0.07, 1.08, 2, 6);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.prim(CYL8, HX + sx * 0.54, 4.05, sz * 0.46, 0, 0, 0, 0.035, 0.84, 0.035, 2, 6);
    const dome = new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    L.prim(dome, HX, 4.46, 0, 0, 0, 0, 0.8, 0.5, 0.72, 2, 8);
    L.prim(new THREE.CylinderGeometry(1, 1, 1, 16), HX, 4.46, 0, 0, 0, 0, 0.84, 0.07, 0.76, 2, 6);
    L.prim(SPH, HX, 4.98, 0, 0, 0, 0, 0.09, 0.09, 0.09, 2, 6); L.prim(new THREE.ConeGeometry(1, 1, 8), HX, 5.17, 0, 0, 0, 0, 0.05, 0.3, 0.05, 2, 6);
    // gold anklets
    const tor8 = new THREE.TorusGeometry(1, 0.13, 5, 16);
    for (const [bx0, zz, bn] of [[0.91, zf, 17], [0.91, -zf, 20], [-1.16, zh, 23], [-1.16, -zh, 26]]) { L.prim(tor8, bx0, 0.36, zz, Math.PI / 2, 0, 0, 0.27, 0.27, 0.27, bn, 6); L.prim(tor8, bx0, 0.5, zz, Math.PI / 2, 0, 0, 0.26, 0.26, 0.26, bn, 6); }
    // the mahout on the neck: white kurta, saffron safa
    L.prim(BOX, 1.28, 3.22, 0, 0, 0, 0.12, 0.26, 0.5, 0.36, 4, 11);
    for (const s of [1, -1]) { L.prim(BOX, 1.36, 2.78, 0.4 * s, 0.55 * s, 0, 0, 0.15, 0.62, 0.15, 4, 11); L.prim(BOX, 1.42, 3.12, 0.21 * s, 0, 0, 0.7, 0.09, 0.42, 0.09, 4, 11); }
    L.prim(SPH, 1.31, 3.6, 0, 0, 0, 0, 0.11, 0.12, 0.1, 4, 10); L.prim(SPH, 1.3, 3.69, 0, 0, 0, 0, 0.14, 0.1, 0.13, 4, 12);
    const geo = L.geo();
    const col = `
float fxR=0.85,fxM=0.;
vec3 pal(float i){i=mod(i,5.);return i<1.?vec3(0.95,0.12,0.42):i<2.?vec3(1.,0.72,0.04):i<3.?vec3(0.92,0.92,0.88):i<4.?vec3(0.05,0.42,0.85):vec3(1.,0.36,0.02);}
vec3 gold(){fxM=0.85;fxR=0.32;return vec3(1.,0.66,0.22);}
float dots(vec3 P,float f,float r){vec3 q=fract(P*f)-0.5;return 1.-smoothstep(r-0.05,r,length(q));}
vec3 fxCol(vec3 P,float reg,float t){
  float n=fx4n(P.xy*6.+P.z*2.)*0.6+fx4n(vec2(P.z*21.,P.y*23.))*0.4;
  vec3 skin=mix(vec3(0.20,0.185,0.18),vec3(0.31,0.29,0.28),n);vec3 c=skin;fxR=0.9;fxM=0.;
  float wr=fx4n(vec2(P.x*3.,P.y*40.));c*=0.9+0.12*wr;
  if(reg<0.5){
  } else if(reg<1.5){ // legs: painted bands and dots above the anklets, pale toenails
    float b=max(1.-smoothstep(0.012,0.024,abs(P.y-0.66)),1.-smoothstep(0.012,0.024,abs(P.y-0.84)));
    c=mix(c,vec3(1.,0.75,0.08),b);
    float dd=dots(vec3(P.x,P.y-0.75,P.z),11.,0.28)*step(0.7,P.y)*step(P.y,0.8);c=mix(c,pal(floor(P.x*11.+P.z*11.)),dd);
    float nail=step(P.y,0.13)*step(0.06,P.y)*step(0.55,fract(atan(P.z,P.x)*2.));c=mix(c,vec3(0.75,0.7,0.62),nail*0.0);
  } else if(reg<2.5){ // head + trunk
    if(t<0.36){
      float hw=mix(0.11,0.34,smoothstep(2.0,2.85,P.y));
      float plate=step(1.9,P.x)*step(abs(P.z),hw)*step(1.92,P.y);
      if(plate>0.5){c=gold();float bo=dots(vec3(0.,P.y,P.z),12.,0.3);c=mix(c,vec3(1.,0.85,0.45),bo);fxR=mix(fxR,0.18,bo);
        float e=hw-abs(P.z);if(e<0.035){c=vec3(0.6,0.02,0.04);fxM=0.;fxR=0.5;}
        if(length(vec2(P.y-2.55,P.z))<0.07){c=vec3(0.02,0.45,0.12);fxM=0.2;fxR=0.15;}}
      else{
        float d=length(vec2(P.x-1.88,P.y-2.12));float side=step(0.28,abs(P.z));
        float ro=step(d,0.2)*side;c=mix(c,pal(floor(d*22.)),ro*step(0.4,fract(d*22.)));
        float sw=(1.-smoothstep(0.01,0.02,abs(length(vec2(P.x-1.96,P.y-2.4))-0.1)))*side;c=mix(c,vec3(0.95,0.95,0.9),sw);
        float eye=(1.-smoothstep(0.035,0.045,length(vec2(P.x-1.96,P.y-2.4))))*side;c=mix(c,vec3(0.03,0.02,0.01),eye);
      }
    } else { // painted trunk: rings, dots in five colours, a vine
      float u=t*9.;float ring=smoothstep(0.41,0.45,abs(fract(u)-0.5));
      c=mix(c,vec3(1.,0.72,0.04),ring);
      float dd=dots(P,10.,0.3);c=mix(c,pal(floor(P.y*10.)+floor(P.z*10.)),dd*(1.-ring));
      float vine=1.-smoothstep(0.008,0.018,abs(P.z-0.05*sin(P.y*16.)));c=mix(c,vec3(0.1,0.7,0.2),vine*(1.-ring)*step(2.4,P.x+0.05));
    }
  } else if(reg<3.5){ c=mix(c,vec3(0.06),step(0.75,t));
  } else if(reg<4.5){ // ears: pink freckles and a painted rim
    float fr=step(0.62,fx4n(P.xy*18.));c=mix(c,vec3(0.55,0.36,0.32),fr*0.6);
    float rim=step(0.8,t)+step(P.x,1.1);float dd=dots(P,9.,0.3);c=mix(c,pal(floor(P.y*13.)),dd*min(rim,1.));
  } else if(reg<5.5){ // jhool: maroon velvet, gold border and lattice, mirror work, gold tassels
    float hem=P.y-(1.22+0.14*pow((P.x+0.07)/0.95,2.));float ed=min(min(P.x+1.02,0.88-P.x),hem);
    c=vec3(0.30,0.008,0.03)*(0.8+0.45*fx4n(P.xy*60.+P.z*30.));fxR=0.95;
    vec2 g=vec2(P.x*3.4,t*16.);vec2 f=fract(g)-0.5;float dm=abs(f.x)+abs(f.y);
    float lat=1.-smoothstep(0.03,0.06,abs(dm-0.4));
    float mir=1.-smoothstep(0.1,0.13,length(f));
    if(lat>0.5){c=gold();}
    if(mir>0.5){c=vec3(0.9,0.92,0.95);fxM=1.;fxR=0.1;}
    if(ed<0.2){c=gold();float stp=1.-smoothstep(0.015,0.025,abs(ed-0.1));c=mix(c,vec3(0.05,0.3,0.12),stp);if(stp>0.5){fxM=0.;fxR=0.6;}}
    if(hem<0.07){c=step(0.5,fract(P.x*14.+P.z*14.))>0.5?gold():vec3(0.5,0.02,0.04);}
  } else if(reg<6.5){ c=gold();
  } else if(reg<7.5){ // howdah panels: red with gold rims and studs
    c=vec3(0.45,0.01,0.03);fxR=0.6;float px=abs(P.x+0.08),pz=abs(P.z);
    float rim=step(0.5,px)*step(0.44,pz)+step(abs(P.y-3.34),0.0)+step(0.22,abs(P.y-3.34));
    float stud=dots(vec3(P.x,P.y,P.z),9.,0.3);
    if(rim>0.5||(px>0.49&&pz<0.44)&&false)c=gold();
    if(abs(P.y-3.34)>0.21||(pz>0.49&&px>0.5)||(px>0.56&&pz>0.42))c=gold();
    else if(stud>0.5){c=gold();}
  } else if(reg<8.5){ float a=atan(P.z,P.x+0.08);float s=step(0.5,fract(a*16./6.2832));c=mix(vec3(1.,0.32,0.01),vec3(0.75,0.02,0.05),s);fxR=0.75;
    if(P.y<4.56){c=gold();}
  } else if(reg<9.5){ c=vec3(0.86,0.8,0.66);fxR=0.35;
  } else if(reg<10.5){ c=vec3(0.36,0.2,0.12);
  } else if(reg<11.5){ c=vec3(0.88,0.87,0.83);
  } else if(reg<12.5){ c=vec3(1.,0.4,0.02);
  } else { c=vec3(0.6,0.02,0.05);float s=step(0.5,fract(P.x*8.));c=mix(c,gold(),s*step(abs(P.y-2.98),0.03)); }
  return c;
}`;
    const U = { uFade: { value: 1 } };
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, envMapIntensity: 1.0, side: THREE.DoubleSide });
    mat.onBeforeCompile = sh => {
      sh.uniforms.uFade = U.uFade;
      sh.vertexShader = 'attribute vec4 aPat;varying vec4 vPat;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPat=aPat;');
      sh.fragmentShader = 'uniform float uFade;varying vec4 vPat;\n' + sh.fragmentShader.replace('#include <common>', '#include <common>\n' + GLSL_NOISE + col + '\n')
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'if(fx4h(floor(gl_FragCoord.xy))>uFade)discard;vec4 diffuseColor=vec4(fxCol(vPat.xyz,floor(vPat.w+0.001),fract(vPat.w+0.001)),opacity);')
        .replace('float roughnessFactor = roughness;', 'float roughnessFactor = fxR;').replace('float metalnessFactor = metalness;', 'float metalnessFactor = fxM;');
    };
    const mesh = new THREE.SkinnedMesh(geo, mat); mesh.add(bones[0]); mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones)); mesh.frustumCulled = false; mesh.visible = false;
    const g = new THREE.Group(); g.name = 'fx4ele'; g.add(mesh); root.add(g);
    const n = bones.length;
    return { g, mesh, bones, U, rx: new Float32Array(n), ry: new Float32Array(n), rz: new Float32Array(n), tris: geo.index.count / 3 };
  })();
  const ELEGS = [[22, 0, 1], [16, 0.25, 0], [25, 0.5, 1], [19, 0.75, 0]];   // lateral sequence: LH, LF, RH, RF
  const EP = { y: 0 }, EFEET = [18, 21, 24, 27];
  function elePose(C, ph, wW, wI, now, seed) {
    C.rx.fill(0); C.ry.fill(0); C.rz.fill(0); EP.y = 0;
    const k = Math.PI * 2 * ph, SW = 0.32, A = 0.23;
    if (wW > 0.01) {
      for (let i = 0; i < 4; i++) {
        const u = ELEGS[i][0], hind = ELEGS[i][2], q = ((ph + ELEGS[i][1]) % 1 + 1) % 1; let a, lift;
        if (q < SW) { const s = q / SW; a = mix(-A, A, 0.5 - 0.5 * Math.cos(Math.PI * s)); lift = Math.sin(Math.PI * s); }
        else { a = mix(A, -A, (q - SW) / (1 - SW)); lift = 0; }
        const kn = (hind ? -0.5 : -0.85) * lift;
        C.rz[u] += wW * (a + 0.1 * lift); C.rz[u + 1] += wW * kn; C.rz[u + 2] += wW * (-(a + 0.1 * lift + kn) * 0.9 + 0.3 * lift);
      }
      EP.y += wW * (0.035 * Math.cos(2 * k) - 0.02);
      C.rx[1] += wW * 0.035 * Math.sin(k); C.rx[3] += wW * -0.03 * Math.sin(k + 0.6); C.ry[1] += wW * 0.035 * Math.sin(k);
      C.rz[4] += wW * 0.045 * Math.sin(2 * k + 1); C.ry[4] += wW * 0.04 * Math.sin(k + 0.5);
      for (let i = 0; i < 5; i++) { C.ry[6 + i] += wW * 0.11 * Math.sin(k - i * 0.55); C.rz[6 + i] += wW * (0.035 * Math.sin(2 * k - i * 0.5) - 0.02); }
      for (let i = 0; i < 3; i++) C.rx[13 + i] += wW * 0.22 * Math.sin(k - i * 0.7);
    }
    if (wI > 0.01) {
      for (let i = 0; i < 5; i++) { C.ry[6 + i] += wI * 0.14 * Math.sin(now * 0.7 + seed - i * 0.6); C.rz[6 + i] += wI * (i > 2 ? 0.22 : 0.05) * (0.5 + 0.5 * Math.sin(now * 0.45 + seed)); }
      C.rx[1] += wI * 0.025 * Math.sin(now * 0.5); C.rx[3] += wI * -0.02 * Math.sin(now * 0.5); C.ry[4] += wI * 0.12 * Math.sin(now * 0.3 + seed);
      for (let i = 0; i < 3; i++) C.rx[13 + i] += wI * 0.3 * Math.sin(now * 1.3 - i * 0.8);
    }
    const flap = 0.08 + 0.42 * Math.pow(Math.max(0, Math.sin(now * 1.6 + seed)), 2);
    C.ry[11] += flap; C.ry[12] -= flap;
    for (let i = 0; i < C.bones.length; i++) C.bones[i].rotation.set(C.rx[i], C.ry[i], C.rz[i]);
  }
  let elK = 1;
  function elephantUpdate(list, dt, now) {
    const C = EL, it = list[0];
    if (!it || !it.path || it.path.length < 2) { C.mesh.visible = false; return; }
    const st = stOf(it, () => ({ c: pathPrep(it.path), ph: 0, hd: null, lastD: -1, wW: 0, seed: (it.id || 'e').length * 1.3 }));
    const T = Z.T, Ln = st.c[st.c.length - 1];
    const walkT = Math.max(30, (it.t1 - it.t0) - 150);
    const d = clamp((T - it.t0 - 10) / walkT, 0, 1) * Ln;
    pathAt(it.path, st.c, d);
    const moved = st.lastD < 0 ? 0 : Math.abs(d - st.lastD); st.lastD = d;
    if (st.hd == null) st.hd = PT.h;
    st.hd += wrapA(PT.h - st.hd) * Math.min(1, dt * 1.5);
    const walking = moved > 1e-4 && d < Ln;
    st.wW += ((walking ? 1 : 0) - st.wW) * Math.min(1, dt * 2.5);
    const want = clamp(Math.pow(camD() / 400, 1.3), 1, 72); elK += (want - elK) * Math.min(1, dt * 3);
    const s = elK, stride = 2.4 * s;
    if (walking) st.ph = (st.ph + dt * clamp(moved / stride / Math.max(dt, 1e-3), 0.32, 0.6)) % 1;
    elePose(C, st.ph, st.wW, 1 - st.wW, now, st.seed);
    const fade = smooth(it.t0, it.t0 + 8, T) * (1 - smooth(it.t1 - 14, it.t1 - 1, T));
    C.U.uFade.value = fade; C.mesh.visible = fade > 0.01;
    C.g.position.set(PT.x, EP.y * s, PT.y); C.g.rotation.set(0, -st.hd, 0); C.g.scale.setScalar(s); C.g.updateMatrixWorld(true);
    const ch = Math.cos(st.hd), sh = Math.sin(st.hd), sd = Z.sunDir || UP, sk = 1.2 * s / Math.max(0.3, sd.y);
    blob(PT.x - sd.x * sk + ch * 0.2 * s, PT.y - sd.z * sk + sh * 0.2 * s, -st.hd, 5.6 * s, 2.6 * s, 0.5 * fade);
    blob(PT.x + ch * 0.1 * s, PT.y + sh * 0.1 * s, -st.hd, 4.6 * s, 2.1 * s, 0.45 * fade);
    for (let i = 0; i < 4; i++) { C.bones[EFEET[i]].getWorldPosition(_v2); const h = clamp(1 - _v2.y / (0.5 * s), 0, 1); blob(_v2.x, _v2.z, -st.hd, 0.85 * s, 0.85 * s, 0.6 * h * fade); }
  }
  KS.add('elephant');

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
      elephantUpdate(L.elephant, dt, now);
      blobs.count = nBlob; blobs.visible = nBlob > 0;
      if (nBlob) { blobs.instanceMatrix.needsUpdate = true; blobOp.needsUpdate = true; }
    },
  };
};
