Z3MOD.fx2 = function (Z) {
  // Round 2 set pieces (3d/FX.md "Round 2"): the tigress, Uttarayan kites, the inauguration ribbon, the dabbawalas, fireworks,
  // the water-salute arch, the wedding elephant, GPS-spoofing ghosts and the ops WhatsApp storm. Reads Z.fx every frame and draws
  // the kinds it knows. States follow sim time (Z.T); motion runs in real time. Characters are procedural lofted meshes,
  // skinned (tigress, elephant) or vertex-animated instances (cyclists), with contact shadows, and scale up with camera
  // distance so they read from the strategic view. Every mesh is hidden while no item of its kind is active.
  const THREE = Z.THREE, scene = Z.scene;
  const root = new THREE.Group(); root.name = 'fx2'; scene.add(root);
  const KS = Z.fxKinds || (Z.fxKinds = new Set());
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  const UP = new THREE.Vector3(0, 1, 0);
  const GLSL_NOISE = `
float fx2h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float fx2n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(fx2h(i),fx2h(i+vec2(1,0)),f.x),mix(fx2h(i+vec2(0,1)),fx2h(i+vec2(1,1)),f.x),f.y);}
`;

  // ---------------- character scale: modest close up, big enough to read from the strategic camera ----------------
  let charK = 1;
  const charScale = () => clamp(Z.camDist / 80, 1, 160);

  // ---------------- contact shadows: soft ground blobs, one instanced draw for every character ----------------
  const BLOBN = 128;
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
    _q.setFromAxisAngle(UP, rot); _v.set(x, 0.3 + 0.03 * charK, z); _s.set(sx, 1, sz); _m.compose(_v, _q, _s);
    blobs.setMatrixAt(nBlob, _m); blobOp.array[nBlob] = op; nBlob++;
  };

  // ---------------- procedural loft builder (tubes along a bone chain, skinned) ----------------
  function Loft() { this.p = []; this.si = []; this.sw = []; this.pat = []; this.ix = []; }
  // rings: [x,y,z, a (radius along "up"), b (radius along side), bone0, bone1, w1 (weight of bone1), param]
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
    for (let i = 0; i < m - 1; i++) for (let j = 0; j < n; j++) {
      const a = base + i * n + j, b = base + i * n + (j + 1) % n, c = a + n, d = b + n;
      this.ix.push(a, b, c, b, d, c);
    }
    const cap = (i, end) => {
      const r = rings[i], o = rings[end ? i - 1 : i + 1]; T.set(r[0] - o[0], r[1] - o[1], r[2] - o[2]).normalize();
      const k = (Math.min(r[3], r[4])) * 0.35, ci = this.p.length / 3;
      this.p.push(r[0] + T.x * k, r[1] + T.y * k, r[2] + T.z * k); this.si.push(r[5], r[6], 0, 0); this.sw.push(1 - r[7], r[7], 0, 0);
      this.pat.push(r[0], r[1], r[2], region + (end ? 0.98 : 0));
      for (let j = 0; j < n; j++) { const a = base + i * n + j, b = base + i * n + (j + 1) % n; if (end) this.ix.push(ci, a, b); else this.ix.push(ci, b, a); }
    };
    if (caps & 1) cap(0, false); if (caps & 2) cap(m - 1, true);
  };
  Loft.prototype.geo = function () {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setAttribute('aPat', new THREE.Float32BufferAttribute(this.pat, 4));
    g.setIndex(this.ix); g.computeVertexNormals(); return g;
  };
  // bones: [name, parentIndex, [x,y,z] absolute bind position]
  function makeSkel(defs) {
    const bones = defs.map(d => { const b = new THREE.Bone(); b.name = d[0]; return b; });
    defs.forEach((d, i) => { const p = d[1] >= 0 ? defs[d[1]][2] : [0, 0, 0]; bones[i].position.set(d[2][0] - p[0], d[2][1] - p[1], d[2][2] - p[2]); if (d[1] >= 0) bones[d[1]].add(bones[i]); });
    return bones;
  }
  // a skinned creature: material colours come from a GLSL function of the bind-pose position and the region
  function creature(defs, loft, colorGLSL, rough) {
    const bones = makeSkel(defs), geo = loft.geo();
    const U = { uFade: { value: 1 } };
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: rough || 0.85, metalness: 0, envMapIntensity: 0.9 });
    mat.onBeforeCompile = sh => {
      sh.uniforms.uFade = U.uFade;
      sh.vertexShader = 'attribute vec4 aPat;varying vec4 vPat;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPat=aPat;');
      sh.fragmentShader = 'uniform float uFade;varying vec4 vPat;\n' + sh.fragmentShader.replace('#include <common>', '#include <common>\n' + GLSL_NOISE + colorGLSL + '\n').replace('vec4 diffuseColor = vec4( diffuse, opacity );',
        'if(fx2h(floor(gl_FragCoord.xy))>uFade)discard;vec4 diffuseColor=vec4(fxCol(vPat.xyz,floor(vPat.w+0.001),fract(vPat.w+0.001)),opacity);');
    };
    const mesh = new THREE.SkinnedMesh(geo, mat); mesh.add(bones[0]); mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones)); mesh.frustumCulled = false; mesh.visible = false;
    const g = new THREE.Group(); g.add(mesh); root.add(g);
    const by = {}; bones.forEach((b, i) => { by[b.name] = i; });
    return { g, mesh, bones, by, U, rx: new Float32Array(bones.length), ry: new Float32Array(bones.length), rz: new Float32Array(bones.length) };
  }
  const applyPose = (C) => { for (let i = 0; i < C.bones.length; i++) { C.bones[i].rotation.set(C.rx[i], C.ry[i], C.rz[i]); } };

  // path helpers (path in sim coords); per-item cumulative lengths are built once
  const pathPrep = p => { const c = [0]; for (let i = 1; i < p.length; i++) c.push(c[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])); return c; };
  const PT = { x: 0, y: 0, h: 0 };
  const pathAt = (p, c, d) => {
    const L = c[c.length - 1]; d = clamp(d, 0, L); let i = 1; while (i < c.length - 1 && c[i] < d) i++;
    const a = p[i - 1], b = p[i] || a, sl = Math.max(1e-6, c[i] - c[i - 1]), t = clamp((d - c[i - 1]) / sl, 0, 1);
    PT.x = a[0] + (b[0] - a[0]) * t; PT.y = a[1] + (b[1] - a[1]) * t; PT.h = Math.atan2(b[1] - a[1], b[0] - a[0]); return PT;
  };
  const ST = new Map();   // per-item state (allocated once per item)
  const stOf = (it, mk) => { let s = ST.get(it); if (!s) { s = mk(); ST.set(it, s); } return s; };

  // =====================================================================================================
  // THE TIGRESS: a lofted, skinned Bengal tigress (about 2.7 m nose to rump, 0.9 m tail), procedural stripes
  // =====================================================================================================
  const TG = (() => {
    const z1 = 0.135, z2 = 0.145;
    const defs = [
      ['root', -1, [0, 0, 0]], ['pelvis', 0, [-0.55, 0.76, 0]], ['spine', 1, [0.0, 0.72, 0]], ['chest', 2, [0.48, 0.74, 0]],
      ['neck', 3, [0.76, 0.82, 0]], ['head', 4, [0.96, 0.87, 0]],
      ['t0', 1, [-0.84, 0.80, 0]], ['t1', 6, [-1.0, 0.70, 0]], ['t2', 7, [-1.13, 0.54, 0]], ['t3', 8, [-1.22, 0.38, 0]], ['t4', 9, [-1.32, 0.24, 0]], ['t5', 10, [-1.45, 0.16, 0]],
      ['flU', 3, [0.50, 0.78, z1]], ['flL', 12, [0.47, 0.47, z1]], ['flP', 13, [0.51, 0.11, z1]],
      ['frU', 3, [0.50, 0.78, -z1]], ['frL', 15, [0.47, 0.47, -z1]], ['frP', 16, [0.51, 0.11, -z1]],
      ['hlU', 1, [-0.62, 0.78, z2]], ['hlL', 18, [-0.50, 0.47, z2]], ['hlP', 19, [-0.68, 0.25, z2]],
      ['hrU', 1, [-0.62, 0.78, -z2]], ['hrL', 21, [-0.50, 0.47, -z2]], ['hrP', 22, [-0.68, 0.25, -z2]],
    ];
    const L = new Loft();
    // torso: x, centre y, half height, half width; bones blend pelvis(1) spine(2) chest(3) neck(4)
    const bx = [[-0.55, 1], [0.0, 2], [0.48, 3], [0.76, 4]];
    const bw = x => { if (x <= bx[0][0]) return [1, 1, 0]; for (let i = 0; i < bx.length - 1; i++) if (x <= bx[i + 1][0]) { const t = (x - bx[i][0]) / (bx[i + 1][0] - bx[i][0]); return [bx[i][1], bx[i + 1][1], t]; } return [4, 4, 0]; };
    const tor = [[-0.9, 0.78, 0.07, 0.06], [-0.86, 0.77, 0.16, 0.13], [-0.78, 0.75, 0.22, 0.18], [-0.64, 0.74, 0.25, 0.205], [-0.46, 0.725, 0.255, 0.21], [-0.22, 0.705, 0.25, 0.205],
      [0.02, 0.70, 0.27, 0.215], [0.24, 0.695, 0.30, 0.225], [0.42, 0.70, 0.315, 0.225], [0.58, 0.735, 0.29, 0.205], [0.70, 0.79, 0.225, 0.17], [0.80, 0.83, 0.18, 0.145], [0.88, 0.855, 0.16, 0.135]];
    L.tube(tor.map(r => { const w = bw(r[0]); return [r[0], r[1], 0, r[2], r[3], w[0], w[1], w[2], (r[0] + 0.9) / 1.8]; }), 18, 0, [0, 1, 0], 1);
    // head: neck(4) to head(5)
    const hd = [[0.84, 0.85, 0.15, 0.13, 0], [0.92, 0.865, 0.165, 0.155, 0.6], [1.0, 0.875, 0.165, 0.17, 1], [1.08, 0.87, 0.15, 0.158, 1], [1.15, 0.855, 0.125, 0.13, 1],
      [1.21, 0.835, 0.10, 0.10, 1], [1.27, 0.815, 0.08, 0.082, 1], [1.31, 0.805, 0.062, 0.066, 1], [1.335, 0.80, 0.03, 0.036, 1]];
    L.tube(hd.map(r => [r[0], r[1], 0, r[2] * 1.1, r[3] * 1.12, 4, 5, r[4], (r[0] - 0.84) / 0.5]), 16, 2, [0, 1, 0], 3);
    // ears
    for (const s of [1, -1]) L.tube([[0.985, 0.97, 0.10 * s, 0.05, 0.03, 5, 5, 0, 0], [0.98, 1.02, 0.112 * s, 0.04, 0.022, 5, 5, 0, 0.6], [0.975, 1.055, 0.118 * s, 0.012, 0.008, 5, 5, 0, 1]], 8, 4, [1, 0, 0], 2);
    // tail: t0..t5 (6..11)
    const tl = [[-0.86, 0.79, 0.05], [-1.0, 0.70, 0.048], [-1.13, 0.54, 0.045], [-1.22, 0.38, 0.042], [-1.32, 0.24, 0.04], [-1.45, 0.16, 0.038], [-1.55, 0.14, 0.03]];
    L.tube(tl.map((r, i) => [r[0], r[1], 0, r[2], r[2], 6 + Math.min(i, 5), 6 + Math.min(i + 1, 5), i < 5 ? 0.5 : 0, i / 6]), 8, 3, [0, 0, 1], 3);
    // legs: front (shoulder 12/15), hind (hip 18/21). Rings: x, y, half side width, half front-back thickness, bone a, bone b, w
    const fl = (z, b0) => [[0.52, 0.80, 0.10, 0.15, 3, b0, 0.5], [0.49, 0.62, 0.095, 0.12, b0, b0, 0], [0.47, 0.47, 0.08, 0.085, b0, b0 + 1, 0.5], [0.48, 0.30, 0.065, 0.068, b0 + 1, b0 + 1, 0],
      [0.51, 0.13, 0.06, 0.058, b0 + 1, b0 + 2, 0.6], [0.53, 0.06, 0.075, 0.055, b0 + 2, b0 + 2, 0], [0.59, 0.04, 0.078, 0.045, b0 + 2, b0 + 2, 0], [0.645, 0.032, 0.05, 0.03, b0 + 2, b0 + 2, 0]].map((r, i) => [r[0], r[1], z, r[2], r[3], r[4], r[5], r[6], i / 7]);
    const hl = (z, b0) => [[-0.60, 0.84, 0.11, 0.19, 1, b0, 0.5], [-0.57, 0.66, 0.11, 0.16, b0, b0, 0], [-0.50, 0.47, 0.075, 0.09, b0, b0 + 1, 0.5], [-0.60, 0.35, 0.055, 0.065, b0 + 1, b0 + 1, 0],
      [-0.68, 0.25, 0.05, 0.055, b0 + 1, b0 + 2, 0.5], [-0.66, 0.12, 0.05, 0.05, b0 + 2, b0 + 2, 0], [-0.63, 0.055, 0.07, 0.05, b0 + 2, b0 + 2, 0], [-0.57, 0.04, 0.072, 0.042, b0 + 2, b0 + 2, 0],
      [-0.525, 0.032, 0.045, 0.028, b0 + 2, b0 + 2, 0]].map((r, i) => [r[0], r[1], z, r[2], r[3], r[4], r[5], r[6], i / 8]);
    L.tube(fl(z1, 12), 10, 1, [0, 0, 1], 2); L.tube(fl(-z1, 15), 10, 1, [0, 0, 1], 2);
    L.tube(hl(z2, 18), 10, 1, [0, 0, 1], 2); L.tube(hl(-z2, 21), 10, 1, [0, 0, 1], 2);
    const col = `
vec3 fxCol(vec3 P,float reg,float t){
  vec3 org=vec3(0.80,0.25,0.035),rust=vec3(0.50,0.10,0.012),crm=vec3(0.86,0.78,0.62),blk=vec3(0.012,0.009,0.007);
  vec3 c=org;float st=0.;
  if(reg<0.5){ // torso
    float ang=abs(atan(P.z,P.y-0.70));
    c=mix(org,rust,0.55*smoothstep(1.3,0.,ang));
    float u=P.x*8.2+0.22*sin(ang*3.5+P.x*7.)+0.35*fx2n(vec2(P.x*5.,ang*2.3));
    float w=mix(0.30,0.07,smoothstep(0.2,2.2,ang));
    float d=abs(fract(u)-0.5);st=1.-smoothstep(w*0.5-0.03,w*0.5+0.03,d);
    st*=step(0.22,fx2n(vec2(P.x*11.,ang*3.1+4.)));st*=1.-smoothstep(1.85,2.35,ang);
    float d2=abs(fract(u+0.22)-0.5);st=max(st,(1.-smoothstep(0.03,0.05,d2))*step(0.55,fx2n(vec2(P.x*9.,ang*4.)))*(1.-smoothstep(1.2,1.9,ang)));
    c=mix(c,crm,smoothstep(1.95,2.45,ang));
    c=mix(c,crm,smoothstep(-0.62,-0.75,P.x)*smoothstep(0.6,1.6,ang)*0.6);
  } else if(reg<1.5){ // legs
    float side=abs(P.z);
    c=mix(org,crm,smoothstep(0.75,0.95,t)*0.7);
    float inner=smoothstep(0.135,0.095,side)*smoothstep(0.75,0.35,P.y);c=mix(c,crm,inner*0.6);
    float u=P.y*9.5+0.4*sin(P.x*21.);float d=abs(fract(u)-0.5);
    st=(1.-smoothstep(0.08,0.13,d))*(1.-inner)*step(0.3,P.y)*step(0.3,fx2n(vec2(P.y*7.,P.x*9.)));
  } else if(reg<2.5){ // head
    float z=abs(P.z),y=P.y;
    c=mix(org,rust,0.3*smoothstep(0.85,0.98,y));
    float cheek=smoothstep(0.085,0.135,z)*smoothstep(0.88,0.80,y)*step(1.0,P.x);
    float muz=smoothstep(1.19,1.24,P.x)*smoothstep(0.86,0.80,y);
    float chin=smoothstep(0.82,0.76,y);
    c=mix(c,crm,clamp(cheek+muz+chin,0.,1.));
    float brow=1.-smoothstep(0.012,0.022,length(vec2(P.x-1.135,(y-0.945)*1.4))-0.0)*1.;brow=max(brow,1.-smoothstep(0.014,0.024,length(vec2(P.x-1.15,y-0.925))));
    c=mix(c,crm,brow*step(0.03,z)*step(z,0.1));
    float fs=abs(fract(z*26.+P.x*3.)-0.5);st=(1.-smoothstep(0.08,0.14,fs))*smoothstep(0.93,0.96,y)*step(P.x,1.16);
    float ck=abs(fract((y-0.8)*30.+P.x*8.)-0.5);st=max(st,(1.-smoothstep(0.06,0.12,ck))*smoothstep(0.11,0.15,z)*step(1.0,P.x)*step(P.x,1.13));
    vec2 ed=vec2(P.x-1.165,y-0.905);float er=length(ed);
    float eye=(1.-smoothstep(0.016,0.021,er))*step(0.045,z)*step(z,0.10);
    c=mix(c,mix(vec3(0.55,0.33,0.02),blk,1.-smoothstep(0.004,0.009,er)),eye);
    st=max(st,(1.-smoothstep(0.021,0.026,er))*(smoothstep(0.016,0.021,er))*step(0.045,z)*step(z,0.10));
    c=mix(c,vec3(0.32,0.12,0.09),smoothstep(1.305,1.32,P.x)*smoothstep(0.78,0.81,y));
  } else if(reg<3.5){ // tail
    c=mix(org,crm,0.2);float d=abs(fract(t*9.)-0.5);st=(1.-smoothstep(0.17,0.22,d))*step(0.15,t);st=max(st,step(0.86,t));
  } else { // ears: black backs with a white spot, pale fronts
    float back=step(P.x,0.982);float spot=1.-smoothstep(0.008,0.014,length(vec2(P.y-1.01,abs(P.z)-0.112)));
    c=mix(crm,blk,back);c=mix(c,crm,back*spot);
  }
  return mix(c,blk,st);
}`;
    const C = creature(defs, L, col, 0.86);
    C.g.name = 'tiger';
    return C;
  })();

  // ---- pose library: writes bone angles into C.rx/ry/rz (weighted, accumulated) ----
  const P0 = { y: 0, roll: 0 };
  function poseClear(C) { C.rx.fill(0); C.ry.fill(0); C.rz.fill(0); P0.y = 0; P0.roll = 0; }
  const B = TG.by;
  const LEGS_T = [[B.hlU, 0, 1], [B.flU, 0.25, 0], [B.hrU, 0.5, 1], [B.frU, 0.75, 0]];   // lateral-sequence walk
  const LEGS_L = [[B.hlU, 0.0, 1], [B.hrU, 0.1, 1], [B.flU, 0.5, 0], [B.frU, 0.6, 0]];   // rotary lope
  function tigerGait(C, ph, w, lope, now) {
    const sw = lope ? 0.52 : 0.38, A = lope ? 0.62 : 0.36, legs = lope ? LEGS_L : LEGS_T;
    for (const [u, off, hind] of legs) {
      const q = ((ph + off) % 1 + 1) % 1; let a, lift, s;
      if (q < sw) { s = q / sw; a = mix(-A, A, 0.5 - 0.5 * Math.cos(Math.PI * s)); lift = Math.sin(Math.PI * s); }
      else { s = (q - sw) / (1 - sw); a = mix(A, -A, s); lift = 0; }
      if (hind) { C.rz[u] += w * (a * 0.85 - 0.04); C.rz[u + 1] += w * (-0.75 * lift); C.rz[u + 2] += w * (1.1 * lift - (a * 0.85 - 0.75 * lift) * 0.7); }
      else { C.rz[u] += w * (a + 0.04); C.rz[u + 1] += w * (-0.35 * lift + (lope ? 0.25 * lift : 0)); C.rz[u + 2] += w * (-1.25 * lift * (1 - 0.4 * s) - a * 0.85 * (1 - lift)); }
    }
    const k = Math.PI * 2 * ph;
    if (lope) {
      P0.y += w * (0.06 * Math.sin(k * 2 + 0.6) - 0.03);
      C.rz[B.pelvis] += w * 0.12 * Math.sin(k + 0.3); C.rz[B.chest] += w * -0.14 * Math.sin(k + 1.0);
      C.rz[B.neck] += w * (-0.18 + 0.06 * Math.sin(k)); C.rz[B.t0] += w * -0.95; C.rz[B.t1] += w * -0.3; C.rz[B.t5] += w * -0.3;
      for (let i = 0; i < 6; i++) C.ry[B.t0 + i] += w * 0.08 * Math.sin(k - i * 0.7);
    } else {
      P0.y += w * (-0.012 - 0.012 * Math.cos(k * 2));
      C.ry[B.pelvis] += w * 0.05 * Math.sin(k); C.ry[B.chest] += w * -0.06 * Math.sin(k); C.rx[B.spine] += w * 0.02 * Math.sin(k);
      C.rz[B.neck] += w * -0.16; C.rz[B.head] += w * 0.08; C.ry[B.neck] += w * 0.05 * Math.sin(k + 1);
      C.rz[B.t0] += w * -0.3; C.rz[B.t3] += w * -0.2; C.rz[B.t4] += w * -0.45; C.rz[B.t5] += w * -0.55;
      for (let i = 0; i < 6; i++) C.ry[B.t0 + i] += w * 0.13 * Math.sin(k - i * 0.6 + now * 0.4);
    }
  }
  function tigerStand(C, w, now, seed) {
    const look = Math.sin(now * 0.35 + seed) * 0.5 + Math.sin(now * 0.13 + seed * 2) * 0.3;
    C.ry[B.neck] += w * look * 0.6; C.ry[B.head] += w * look * 0.4; C.rz[B.neck] += w * -0.05; C.rz[B.head] += w * 0.05;
    const fl = Math.pow(Math.max(0, Math.sin(now * 0.9 + seed)), 6);
    C.rz[B.t0] += w * -0.15; C.rz[B.t4] += w * -(0.4 + fl * 0.5); C.rz[B.t5] += w * -(0.5 + fl * 0.6);
    for (let i = 0; i < 6; i++) C.ry[B.t0 + i] += w * (0.1 * Math.sin(now * 0.8 - i * 0.5) + fl * 0.25 * Math.sin(now * 7 - i));
    P0.y += w * 0.005 * Math.sin(now * 1.6);
  }
  function tigerSit(C, w, now, seed) {
    const p = 0.46;
    P0.y += w * -0.47; C.rz[B.pelvis] += w * p;
    C.rz[B.flU] += w * -p; C.rz[B.frU] += w * -p; C.rz[B.flP] += w * 0.02; C.rz[B.frP] += w * 0.02;
    for (const u of [B.hlU, B.hrU]) { C.rz[u] += w * 1.0; C.rz[u + 1] += w * -2.1; C.rz[u + 2] += w * 1.15; C.rx[u] += w * (u === B.hlU ? -0.42 : 0.42); }
    C.rx[B.flU] += w * -0.06; C.rx[B.frU] += w * 0.06;
    C.rz[B.neck] += w * -0.32; C.rz[B.head] += w * -0.08;
    const look = Math.sin(now * 0.3 + seed) * 0.6;
    C.ry[B.neck] += w * look * 0.5; C.ry[B.head] += w * look * 0.4;
    C.rz[B.t0] += w * -0.75; C.rz[B.t1] += w * 0.55; C.rz[B.t2] += w * 0.5;
    const fl = Math.pow(Math.max(0, Math.sin(now * 1.1 + seed)), 5);
    for (let i = 1; i < 6; i++) C.ry[B.t0 + i] += w * (0.35 + fl * 0.3 * Math.sin(now * 8 - i));
  }
  function tigerLie(C, w, now) {
    // darted: rolled onto her side, legs out, head down, slow breathing
    const br = Math.sin(now * 1.3) * 0.015;
    P0.y += w * -0.12; P0.roll += w * 1.32;
    C.rz[B.flU] += w * 0.55; C.rz[B.flL] += w * -0.35; C.rz[B.frU] += w * 0.3; C.rz[B.frL] += w * -0.5;
    C.rz[B.hlU] += w * 0.35; C.rz[B.hlL] += w * -0.3; C.rz[B.hlP] += w * 0.3; C.rz[B.hrU] += w * 0.6; C.rz[B.hrL] += w * -0.6; C.rz[B.hrP] += w * 0.5;
    C.rx[B.flU] += w * -0.15; C.rx[B.hlU] += w * -0.15;
    C.rz[B.neck] += w * 0.1; C.rx[B.neck] += w * 0.25; C.rx[B.head] += w * 0.2; C.rz[B.spine] += w * br; C.rz[B.chest] += w * br;
    C.rz[B.t0] += w * 0.6; for (let i = 1; i < 6; i++) C.ry[B.t0 + i] += w * 0.22;
  }

  // per-frame tiger logic
  const tigerItems = [];
  function tigerUpdate(list, dt, now, dTs) {
    const C = TG; const it = list[0];
    if (!it) { C.mesh.visible = false; return; }
    const st = stOf(it, () => ({ c: pathPrep(it.path), d: 0, ph: 0, wW: 1, wS: 0, wT: 0, wL: 0, wP: 0, hd: null, x: 0, y: 0, ex: null, exT: 0, seed: (it.id.length * 1.7) % 6, init: false, fade: 0 }));
    const T = Z.T, L = st.c[st.c.length - 1], s = charK;
    if (!st.init) { st.init = true; st.d = 0; pathAt(it.path, st.c, 0); st.x = PT.x; st.y = PT.y; st.hd = PT.h; st.th = PT.h; }
    // state by sim time: darted > exit > walking the path at path-length / duration, with pauses folded in
    // (a 110 sim-s cycle: walk 75, stop and look 10, then sit or stand 25)
    let want = 'walk';
    const darted = it.darted != null && T >= it.darted, tau = T - it.t0, cyc = ((tau % 110) + 110) % 110, nCyc = Math.floor(tau / 110);
    if (darted) want = 'lie';
    else if (it.exit) { want = 'lope'; if (!st.ex) { st.ex = it.exit; st.exT = Math.min(T, it.t1 - 60); } }
    else if (st.d >= L - 1) want = cyc < 40 ? 'stand' : 'sit';
    else if (tau > 20 && cyc >= 75) want = cyc < 85 || (nCyc & 1) ? 'stand' : 'sit';
    let speed = 0;
    if (want === 'walk' && dTs > 0) {
      const wt = t => { const u = Math.max(0, t - it.t0); return Math.floor(u / 110) * 75 + Math.min(u % 110, 75); };
      const tEnd = it.darted != null ? it.darted : it.t1;
      const rem = tEnd - T < 3000 ? wt(tEnd) - wt(T) : 1e9;
      const v = rem < 1e8 ? clamp((L - st.d) / Math.max(5, rem), 0.4, 9) : 2.6;
      const dd = Math.min(dTs, 30) * v; st.d = Math.min(L, st.d + dd); pathAt(it.path, st.c, st.d); st.x = PT.x; st.y = PT.y; st.th = PT.h; speed = dd;
    }
    else if (want === 'lope' && dTs > 0) {
      const tx = st.ex[0] - st.x, ty = st.ex[1] - st.y, dl = Math.hypot(tx, ty);
      const dd = Math.min(dl, Math.min(dTs, 30) * clamp(dl / Math.max(4, it.t1 - T), 1, 25)); if (dl > 1) { st.x += tx / dl * dd; st.y += ty / dl * dd; st.th = Math.atan2(ty, tx); } speed = dd;
    }
    if (st.th != null) st.hd += wrapA(st.th - st.hd) * Math.min(1, dt * (want === 'lope' ? 3 : 1.6));
    // gait phase from real displacement (no foot sliding where possible), capped to a natural cadence close up
    const stride = (want === 'lope' ? 3.3 : 1.45) * s;
    st.ph = (st.ph + Math.min(speed / stride, dt * (want === 'lope' ? 2.6 : 1.5))) % 1;
    const k = Math.min(1, dt * 2.2);
    st.wW += ((want === 'walk' ? 1 : 0) - st.wW) * k; st.wS += ((want === 'sit' ? 1 : 0) - st.wS) * k * 0.8; st.wT += ((want === 'stand' ? 1 : 0) - st.wT) * k;
    st.wL += ((want === 'lie' ? 1 : 0) - st.wL) * Math.min(1, dt * 0.9); st.wP += ((want === 'lope' ? 1 : 0) - st.wP) * Math.min(1, dt * 4);
    const ws = st.wW + st.wS + st.wT + st.wL + st.wP || 1;
    poseClear(C);
    if (st.wW > 0.01) tigerGait(C, st.ph, st.wW / ws, false, now);
    if (st.wP > 0.01) tigerGait(C, st.ph, st.wP / ws, true, now);
    if (st.wT > 0.01) tigerStand(C, st.wT / ws, now, st.seed);
    if (st.wS > 0.01) tigerSit(C, st.wS / ws, now, st.seed);
    if (st.wL > 0.01) tigerLie(C, st.wL / ws, now);
    C.rz[0] = 0; C.ry[0] = 0; C.rx[0] = P0.roll; applyPose(C);
    // fade in at t0, out before t1 (dart team took her / she has gone into the grass)
    const fin = smooth(it.t0, it.t0 + 8, T), fout = it.exit ? 1 - smooth(it.t1 - 25, it.t1 - 2, T) : 1 - smooth(it.t1 - 14, it.t1 - 1, T);
    const fade = Math.min(fin, fout);
    C.U.uFade.value = fade; C.mesh.visible = fade > 0.01;
    const g = C.g; g.position.set(st.x, P0.y * s, st.y); g.rotation.set(0, -st.hd, 0); g.scale.setScalar(s);
    if (P0.roll > 0.01) { g.position.x += -Math.sin(st.hd) * 0.55 * s * Math.min(1, P0.roll); g.position.z += Math.cos(st.hd) * 0.55 * s * Math.min(1, P0.roll); }
    g.updateMatrixWorld(true);
    // contact shadows: body (soft, offset from the sun), and one under each paw
    const ch = Math.cos(st.hd), sh = Math.sin(st.hd), sd = Z.sunDir || UP, lie = Math.min(1, st.wL), sk = 0.45 * s * (1 - 0.8 * lie) / Math.max(0.3, sd.y);
    blob(st.x - sd.x * sk, st.y - sd.z * sk, -st.hd, 2.7 * s, (0.8 + 0.6 * lie) * s, 0.55 * fade);
    blob(st.x, st.y, -st.hd, 2.1 * s, (0.62 + 0.5 * lie) * s, 0.5 * fade);
    for (const pb of [B.flP, B.frP, B.hlP, B.hrP]) {
      C.bones[pb].getWorldPosition(_v2); const h = clamp(1 - _v2.y / (0.25 * s), 0, 1);
      blob(_v2.x + ch * 0.06 * s, _v2.z + sh * 0.06 * s, -st.hd, 0.42 * s, 0.3 * s, 0.7 * h * fade * (1 - lie));
    }
  }
  KS.add('tiger');

  // =====================================================================================================
  // UTTARAYAN KITES: instanced two-tone paper patangs with fluttering tail ribbons, plus faint strings to the rooftops
  // =====================================================================================================
  const KT = (() => {
    const N = 160, P = [], A = [];   // A: part (0 main colour, 1 second colour, 2 stick, 3+t tail)
    const tri = (a, b, c, part) => { P.push(...a, ...b, ...c); A.push(part, part, part); };
    const top = [0, 0.62, 0], bot = [0, -0.5, 0], l = [-0.5, 0.12, 0.06], r = [0.5, 0.12, 0.06], ctr = [0, 0.12, -0.04];
    tri(top, l, ctr, 0); tri(top, ctr, r, 1); tri(ctr, l, bot, 1); tri(ctr, bot, r, 0);
    // bamboo sticks (thin dark slivers along the spine and the bow)
    tri([-0.012, 0.62, 0.01], [0.012, 0.62, 0.01], [0, -0.5, 0.01], 2); tri([-0.5, 0.12, 0.07], [0.5, 0.12, 0.07], [0, 0.17, 0.0], 2);
    // tail ribbon: two streamers from the bottom tip
    for (const sx of [-1, 1]) for (let i = 0; i < 7; i++) {
      const t0 = i / 7, t1 = (i + 1) / 7, y0 = -0.5 - t0 * 1.3, y1 = -0.5 - t1 * 1.3, w = 0.04, x0 = sx * 0.05 * t0 * 3, x1 = sx * 0.05 * t1 * 3;
      tri([x0 - w, y0, 0], [x0 + w, y0, 0], [x1 + w, y1, 0], 3 + t0 * 0.98); A[A.length - 1] = 3 + t1 * 0.98;
      tri([x0 - w, y0, 0], [x1 + w, y1, 0], [x1 - w, y1, 0], 3 + t0 * 0.98); A[A.length - 2] = 3 + t1 * 0.98; A[A.length - 1] = 3 + t1 * 0.98;
    }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aPart', new THREE.Float32BufferAttribute(A, 1)); g.computeVertexNormals();
    const c1 = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3), c2 = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3), ph = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    g.setAttribute('aC1', c1); g.setAttribute('aC2', c2); g.setAttribute('aPh', ph);
    const PAL = ['#e8177d', '#ff8a00', '#ffd400', '#1fa83c', '#1e88e5', '#e53935', '#8e24aa', '#f5f5f5', '#00acc1', '#ff5252'];
    const R = mulberry(4242);
    for (let i = 0; i < N; i++) { const a = new THREE.Color(PAL[i % PAL.length]), b = new THREE.Color(PAL[(i * 7 + 3) % PAL.length]); if (b.equals(a)) b.set('#ffffff'); c1.setXYZ(i, a.r, a.g, a.b); c2.setXYZ(i, b.r, b.g, b.b); ph.setX(i, R() * 100); }
    const U = { uTime: { value: 0 } };
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.75, metalness: 0, emissive: 0xffffff, emissiveIntensity: 1 });
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = U.uTime;
      sh.vertexShader = 'uniform float uTime;attribute float aPart;attribute vec3 aC1;attribute vec3 aC2;attribute float aPh;varying vec3 vKC;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vKC=aPart<0.5?aC1:aPart<1.5?aC2:aPart<2.5?vec3(0.12,0.08,0.04):mix(aC2,aC1,step(0.5,fract((aPart-3.)*3.)));
        if(aPart>=3.){float t=aPart-3.;transformed.z+=sin(uTime*9.+aPh+t*7.)*0.22*t;transformed.x+=sin(uTime*6.3+aPh*1.7+t*5.)*0.18*t;}
        else{transformed.z+=sin(uTime*13.+aPh)*0.03*(abs(position.x)*2.);}`);
      sh.fragmentShader = 'varying vec3 vKC;\n' + sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor=vec4(vKC*0.7,opacity);')
        .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance=vKC*0.5;');
    };
    const mesh = new THREE.InstancedMesh(g, mat, N); mesh.frustumCulled = false; mesh.count = 0; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(mesh);
    const sp = new Float32Array(N * 6), sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.attributes.position.setUsage(THREE.DynamicDrawUsage);
    const strings = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xf4efe6, transparent: true, opacity: 0.32, depthWrite: false }));
    strings.frustumCulled = false; strings.visible = false; root.add(strings);
    const rnd = new Float32Array(N * 8); { const Rr = mulberry(99); for (let i = 0; i < rnd.length; i++) rnd[i] = Rr(); }
    return { mesh, strings, sp, rnd, U, N };
  })();
  function kitesUpdate(list, dt, now) {
    let n = 0; const T = Z.T, k = clamp(Z.camDist / 75, 1.2, 140), N = KT.N, rnd = KT.rnd;
    KT.U.uTime.value = now;
    for (const it of list) {
      const m = Math.min(it.n || 40, N - n), span = it.sp || 1500, alt = it.alt || 180;
      for (let j = 0; j < m; j++) {
        const i = n, q = j * 8 % (N * 8), r0 = rnd[q], r1 = rnd[q + 1], r2 = rnd[q + 2], r3 = rnd[q + 3], r4 = rnd[q + 4];
        const tIn = it.t0 + r0 * 45, tOut = it.t1 - r1 * 70;
        let a = smooth(tIn, tIn + 12, T), fall = 0;
        if (T > tOut) { fall = clamp((T - tOut) / 30, 0, 1); a = 1 - smooth(0.7, 1, fall); }   // a cut kite tumbles away
        if (a <= 0.001) continue;
        const ang = r2 * Math.PI * 2, rad = Math.sqrt(r3) * span, drift = (T - it.t0) * 0.45;
        const ph = r4 * 50, sw = now * (0.35 + r0 * 0.3) + ph;
        const dive = Math.pow(Math.max(0, Math.sin(now * 0.23 + ph)), 8);   // an occasional swooping dive
        const x = it.x + Math.cos(ang) * rad + Math.sin(sw) * 0.05 * alt + fall * 40 * Math.sin(ph);
        const z = it.y + Math.sin(ang) * rad * 0.6 + drift + fall * 120 + Math.cos(sw * 0.8) * 0.03 * alt;
        const y = alt * (0.6 + r1 * 0.7) * (1 - 0.35 * dive) * (1 - 0.85 * fall) + Math.sin(now * 1.3 + ph) * 0.03 * alt + 10;
        _e.set(-1.15 + 0.25 * Math.sin(now * 1.7 + ph) + dive * 0.8 + fall * 3 * Math.sin(now * 3 + ph), Math.sin(sw * 0.7) * 0.5, Math.sin(now * 2.3 + ph * 1.3) * 0.35 + dive * 1.5 * Math.sin(now * 2 + ph) + fall * now * 2, 'YXZ');
        _q.setFromEuler(_e); _v.set(x, y, z); _s.setScalar(k * (0.7 + r2 * 0.6) * a);
        _m.compose(_v, _q, _s); KT.mesh.setMatrixAt(i, _m);
        const o = i * 6; KT.sp[o] = x; KT.sp[o + 1] = y - 0.5 * k; KT.sp[o + 2] = z;
        KT.sp[o + 3] = x + (r3 - 0.5) * alt * 0.8; KT.sp[o + 4] = fall > 0 ? y : 4; KT.sp[o + 5] = z - alt * (1.1 + r4 * 0.6);
        n++;
      }
    }
    KT.mesh.count = n; KT.mesh.visible = n > 0; KT.strings.visible = n > 0;
    if (n) { KT.mesh.instanceMatrix.needsUpdate = true; KT.strings.geometry.setDrawRange(0, n * 2); KT.strings.geometry.attributes.position.needsUpdate = true;
      const f = list[0]; KT.strings.material.opacity = 0.3 * smooth(f.t0, f.t0 + 20, Z.T) * (1 - smooth(f.t1 - 20, f.t1, Z.T)); }
  }
  KS.add('kites');

  // =====================================================================================================
  // THE INAUGURATION RIBBON: red satin across the runway on two gold posts, big bows; snaps, halves flutter down, petals burst
  // =====================================================================================================
  const RB = (() => {
    const NS = 40, nStrip = 2 * (NS + 1) * 2;
    // bow template (local, unit size): two flat loops, a knot and two tails; band width along x
    const bp = [], bn = [], bi = [];
    const band = (pts, wid) => {   // pts: [[y,z,ny,nz],...] a ribbon band, width along x
      const b0 = bp.length / 3;
      for (const q of pts) { bp.push(-wid, q[0], q[1], wid, q[0], q[1]); bn.push(0, q[2], q[3], 0, q[2], q[3]); }
      for (let i = 0; i < pts.length - 1; i++) { const a = b0 + i * 2; bi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    };
    for (const sz of [-1, 1]) { const L = []; for (let i = 0; i <= 16; i++) { const t = i / 16 * Math.PI * 2, y = Math.sin(t) * 0.17, z = sz * (0.2 + Math.cos(t + Math.PI) * 0.2); L.push([y, z, Math.sin(t), -sz * Math.cos(t)]); } band(L, 0.09); }
    band([[0.07, -0.05, 0, -1], [-0.07, -0.05, 0, -1]], 0.1); band([[0.07, 0.05, 0, 1], [-0.07, 0.05, 0, 1]], 0.1);
    for (const sz of [-1, 1]) band([[0, 0, 0, sz], [-0.2, sz * 0.08, 0, sz], [-0.42, sz * 0.12, 0, sz], [-0.6, sz * 0.2, 0, sz]], 0.07);
    const box = new THREE.BoxGeometry(1, 1, 1); const xp = box.attributes.position.array, xn = box.attributes.normal.array, xi = box.index.array;
    const nBow = bp.length / 3, nBox = xp.length / 3, NV = nStrip + 3 * nBow + 2 * nBox + 2 * nBox;
    const pos = new Float32Array(NV * 3), nor = new Float32Array(NV * 3), col = new Float32Array(NV * 3), idx = [];
    const RED = new THREE.Color('#c8102e'), GOLD = new THREE.Color('#d4a017'), RED2 = new THREE.Color('#9e0b22');
    let v = 0;
    // strip: half h (0 west.., 1), columns 0..NS, rows top/bottom
    for (let h = 0; h < 2; h++) { for (let c = 0; c <= NS; c++) for (let r = 0; r < 2; r++) { nor[v * 3] = 1; const k = r ? RED2 : RED; col[v * 3] = k.r; col[v * 3 + 1] = k.g; col[v * 3 + 2] = k.b; v++; }
      const b0 = h * (NS + 1) * 2; for (let c = 0; c < NS; c++) { const a = b0 + c * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    v = nStrip;   // the strip uses 2 halves x (NS+1) columns x 2 rows
    const bowAt = [], boxAt = [];
    for (let b = 0; b < 3; b++) { bowAt.push(v); for (let i = 0; i < nBow; i++) { nor.set(bn.slice(i * 3, i * 3 + 3), (v + i) * 3); col[(v + i) * 3] = RED.r; col[(v + i) * 3 + 1] = RED.g; col[(v + i) * 3 + 2] = RED.b; } for (const i of bi) idx.push(v + i); v += nBow; }
    for (let b = 0; b < 4; b++) { boxAt.push(v); const k = b < 2 ? GOLD : new THREE.Color('#f2f0ea'); for (let i = 0; i < nBox; i++) { nor.set(xn.slice(i * 3, i * 3 + 3), (v + i) * 3); col[(v + i) * 3] = k.r; col[(v + i) * 3 + 1] = k.g; col[(v + i) * 3 + 2] = k.b; } for (const i of xi) idx.push(v + i); v += nBox; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx); g.setDrawRange(0, idx.length);
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.32, metalness: 0.15, envMapIntensity: 1.2 }));
    mesh.frustumCulled = false; mesh.visible = false; root.add(mesh);
    // marigold petals
    const PN = 360, pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.5, 0.15, 0.05, 1, 0, 0, 0.5, -0.15, 0.05], 3)); pg.setIndex([0, 1, 2, 0, 2, 3]); pg.computeVertexNormals();
    const petals = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.6, emissive: 0x401000 }), PN);
    petals.frustumCulled = false; petals.count = 0; petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(petals);
    const PC = ['#ff8c00', '#ffa500', '#ffb000', '#ff7a00', '#ffc400', '#e85d04', '#d00000'];
    const pr = new Float32Array(PN * 6); { const Rr = mulberry(7); for (let i = 0; i < PN; i++) { for (let j = 0; j < 6; j++) pr[i * 6 + j] = Rr(); petals.setColorAt(i, _c.set(PC[i % PC.length])); } }
    return { mesh, pos, NS, bp, nBow, bowAt, boxAt, xp, nBox, petals, pr, PN };
  })();
  function ribbonUpdate(list, dt, now) {
    const it = list[0]; if (!it) { RB.mesh.visible = false; RB.petals.count = 0; RB.petals.visible = false; return; }
    const T = Z.T, kr = clamp(Z.camDist / 110, 1, 60), w = it.w || 75, P = RB.pos, NS = RB.NS;
    const fade = smooth(it.t0, it.t0 + 4, T) * (1 - smooth(it.t1 - 25, it.t1 - 2, T)), cut = it.cutAt != null && T >= it.cutAt, tau = cut ? T - it.cutAt : 0;
    const hp = 1.25 * Math.max(1, kr * 0.7), rw = 0.32 * kr * Math.max(0.05, fade), sag = Math.min(w * 0.04, 0.6 * hp);
    const ox = it.x, oz = it.y, wind = Z.atmo && Z.atmo.wind ? Z.atmo.wind.speed || 4 : 4;
    let v = 0;
    for (let h = 0; h < 2; h++) {
      const sgn = h ? 1 : -1;   // post at z = sgn*w, free end toward the centre
      for (let c = 0; c <= NS; c++) {
        const u = c / NS;                       // 0 at the post .. 1 at the centre
        const zz = sgn * w * (1 - u), sg = sag * (1 - Math.pow(1 - u, 2));
        let fu = 0; if (cut) fu = smooth(0, 1, (tau - (1 - u) * 3) / 9);
        const rec = cut ? 0.14 * u * smooth(0, 4, tau) : 0;
        const z = oz + zz * (1 - rec);
        const fl = Math.sin(now * (2.5 + wind * 0.25) + u * 9 + h * 2) * (0.04 + 0.03 * u) * kr * (1 - 0.7 * fu);
        const curl = cut ? Math.sin(u * 13 + h) * 0.9 * kr * fu * u : 0;
        const yB = mix(hp - sg - rw, 0.08 * kr, fu), phi = fu * Math.PI * 0.5;
        const xb = ox + fl + curl;
        P[v * 3] = xb + Math.sin(phi) * rw; P[v * 3 + 1] = yB + Math.cos(phi) * rw; P[v * 3 + 2] = z; v++;
        P[v * 3] = xb; P[v * 3 + 1] = yB; P[v * 3 + 2] = z; v++;
      }
    }
    // bows: two at the posts, one in the middle (falls with the cut)
    const bs = 3.2 * kr * Math.max(0.05, fade);
    for (let b = 0; b < 3; b++) {
      const at = RB.bowAt[b], bz = b === 2 ? 0 : (b ? w : -w), cy = b === 2 ? mix(hp - sag, 0.25 * bs, smooth(0, 8, tau)) : hp - rw * 0.5;
      const sq = b === 2 && cut ? Math.max(0.05, 1 - smooth(40, 120, tau)) : 1;
      for (let i = 0; i < RB.nBow; i++) { P[(at + i) * 3] = ox + RB.bp[i * 3] * bs * sq; P[(at + i) * 3 + 1] = cy + RB.bp[i * 3 + 1] * bs * sq; P[(at + i) * 3 + 2] = oz + bz + RB.bp[i * 3 + 2] * bs * sq; }
    }
    // gold posts and their white bases
    for (let b = 0; b < 4; b++) {
      const at = RB.boxAt[b], bz = (b & 1) ? w : -w, base = b >= 2, sx = (base ? 0.5 : 0.12) * Math.max(1, kr * 0.7) * Math.max(0.05, fade), sy = base ? 0.12 * Math.max(1, kr * 0.7) : hp * 1.05;
      for (let i = 0; i < RB.nBox; i++) { P[(at + i) * 3] = ox + RB.xp[i * 3] * sx; P[(at + i) * 3 + 1] = (RB.xp[i * 3 + 1] + 0.5) * sy; P[(at + i) * 3 + 2] = oz + bz + RB.xp[i * 3 + 2] * sx; }
    }
    RB.mesh.geometry.attributes.position.needsUpdate = true; RB.mesh.visible = fade > 0.01;
    // the petal burst
    let n = 0;
    if (cut && tau < 150) {
      const pr = RB.pr, ks = kr, wx = Z.atmo && Z.atmo.wind ? Math.cos(Z.atmo.wind.dir) : 1, wz = Z.atmo && Z.atmo.wind ? Math.sin(Z.atmo.wind.dir) : 0;
      for (let i = 0; i < RB.PN; i++) {
        const r0 = pr[i * 6], r1 = pr[i * 6 + 1], r2 = pr[i * 6 + 2], r3 = pr[i * 6 + 3], r4 = pr[i * 6 + 4], r5 = pr[i * 6 + 5];
        const t = Math.max(0, tau - r5 * 2); if (t <= 0) continue;
        const a = r0 * Math.PI * 2, out = (1 - Math.exp(-t / 3)) * (4 + 10 * r1) * ks, drift = t * (0.15 + 0.25 * r2) * ks;
        const up = (1 - Math.exp(-t / 2.5)) * (3 + 5 * r3) * ks - t * 0.035 * ks * (0.5 + r4);
        const y = Math.max(0.05 * ks, hp + up + Math.sin(now * 2 + i) * 0.2 * ks);
        _v.set(ox + Math.cos(a) * out * 0.6 + wx * drift + Math.sin(now * 1.3 + i) * 0.3 * ks, y, oz + Math.sin(a) * out + wz * drift);
        _e.set(now * (2 + r1 * 3) + i, now * (1 + r2 * 2), now * (1.5 + r3) + i * 2); _q.setFromEuler(_e);
        const sc = 0.16 * Math.max(ks, 2.5) * (0.7 + r4 * 0.6) * (1 - smooth(100, 148, tau)) * (y <= 0.051 * ks ? 0.8 : 1);
        _s.set(sc, sc, sc); _m.compose(_v, _q, _s); RB.petals.setMatrixAt(n++, _m);
      }
    }
    RB.petals.count = n; RB.petals.visible = n > 0; if (n) RB.petals.instanceMatrix.needsUpdate = true;
  }
  KS.add('ribbon');

  // =====================================================================================================
  // per frame
  // =====================================================================================================
  let lastT = null;
  const L = { tiger: [], kites: [], ribbon: [] };
  return {
    update(dt, now) {
      const fx = Z.fx || [], T = Z.T;
      const dTs = lastT == null ? 0 : Math.max(0, T - lastT); lastT = T;
      for (const k in L) L[k].length = 0;
      for (let i = 0; i < fx.length; i++) { const o = fx[i]; if (L[o.kind] && T >= o.t0 - 1 && T <= o.t1 + 2) L[o.kind].push(o); }
      if (ST.size > 64) ST.clear();
      const want = charScale(); charK += (want - charK) * Math.min(1, dt * 3);
      nBlob = 0;
      tigerUpdate(L.tiger, dt, now, dTs);
      kitesUpdate(L.kites, dt, now);
      ribbonUpdate(L.ribbon, dt, now);
      blobs.count = nBlob; blobs.visible = nBlob > 0;
      if (nBlob) { blobs.instanceMatrix.needsUpdate = true; blobOp.needsUpdate = true; }
    },
  };
};
