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
  // THE INAUGURATION RIBBON: wide red satin with gold edging on tall gold posts, three big glossy bows. On cutAt a pair of giant
  // ceremonial scissors drops in and snips it, the halves fall like cloth, and marigold petals and confetti spray up and drift.
  // One dynamic mesh (strip + bows + posts + scissors, per-vertex satin/gold/steel) and one instanced petal mesh: two draws.
  // =====================================================================================================
  const RB = (() => {
    const NS = 56, ROWV = [0, 0.07, 0.075, 0.925, 0.93, 1], ROWM = [1, 1, 0, 0, 1, 1], NR = ROWV.length;
    const tp = [], tn = [], tm = [], tw = [], ti = [];   // template: position, normal, material, flutter weight; index
    const M4 = new THREE.Matrix4(), M3 = new THREE.Matrix3(), V = new THREE.Vector3();
    const addGeo = (geo, m, mat, fw) => {   // a THREE geometry, transformed by m, appended to the template
      const g = geo.index ? geo : geo, p = g.attributes.position, n = g.attributes.normal, b = tp.length / 3; M3.getNormalMatrix(m);
      for (let i = 0; i < p.count; i++) { V.fromBufferAttribute(p, i).applyMatrix4(m); tp.push(V.x, V.y, V.z); V.fromBufferAttribute(n, i).applyMatrix3(M3).normalize(); tn.push(V.x, V.y, V.z); tm.push(mat); tw.push(fw || 0); }
      if (g.index) for (let i = 0; i < g.index.count; i++) ti.push(b + g.index.getX(i)); else for (let i = 0; i < p.count; i++) ti.push(b + i);
    };
    // a band: centre points C[i], width directions W[i], widths w[i], bulge along B[i]; three columns (edge, crown, edge)
    const addBand = (C, W, w, Bv, bulge, mat, fw) => {
      const g = new THREE.BufferGeometry(), P = [], I = [], m = C.length;
      for (let i = 0; i < m; i++) for (let j = 0; j < 3; j++) { const s = (j - 1) * 0.5 * w[i], k = j === 1 ? bulge : 0; P.push(C[i][0] + W[i][0] * s + Bv[i][0] * k, C[i][1] + W[i][1] * s + Bv[i][1] * k, C[i][2] + W[i][2] * s + Bv[i][2] * k); }
      for (let i = 0; i < m - 1; i++) for (let j = 0; j < 2; j++) { const a = i * 3 + j; I.push(a, a + 1, a + 3, a + 1, a + 4, a + 3); }
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
      const b = tp.length / 3; addGeo(g, M4.identity(), mat, 0); if (fw) for (let i = 0; i < m * 3; i++) tw[b + i] = fw(Math.floor(i / 3) / (m - 1), i % 3);
    };
    const T0 = () => tp.length / 3, I0 = () => ti.length;
    // ---- the bow (unit: about 1 across, facing +x; loops along +-z, tails down) ----
    const bowV0 = T0(), bowI0 = I0();
    for (const s of [-1, 1]) {
      const D = [0, 0.3, s], dl = Math.hypot(0.3, 1); D[1] /= dl; D[2] /= dl;
      const Wd = [0, D[2] * s, -D[1] * s], C = [], W = [], w = [], Bv = [], NL = 30, L = 0.5, puff = 0.17;
      for (let i = 0; i <= NL; i++) {
        const th = i / NL * Math.PI * 2, out = L * (1 - Math.cos(th)) / 2, xb = puff * Math.sin(th) * (0.55 + 0.45 * (1 - Math.cos(th)) / 2);
        const sag = -0.05 * Math.sin(th / 2) * Math.sin(th / 2);
        C.push([xb, D[1] * out + sag, D[2] * out]); W.push(Wd); w.push(0.1 + 0.3 * Math.pow(Math.sin(th / 2), 0.8));
        const rx = Math.sin(th), ro = -Math.cos(th); const bl = Math.hypot(rx, ro) || 1; Bv.push([rx / bl, D[1] * ro / bl, D[2] * ro / bl]);
      }
      addBand(C, W, w, Bv, 0.035, 0, null);
      // tail with a swallow-tail (V) cut
      const Ct = [], Wt = [], wt = [], Bt = [], NT = 10;
      for (let i = 0; i <= NT; i++) { const t = i / NT; Ct.push([0.02 + 0.03 * Math.sin(t * 4), -0.06 - 0.62 * t, s * (0.05 + 0.2 * t)]); const tz = 0.2, ty = -0.62, tl = Math.hypot(tz, ty); Wt.push([0, s * tz / tl, -ty / tl * 1]); wt.push(0.26 - 0.03 * t); Bt.push([1, 0, 0]); }
      addBand(Ct, Wt, wt, Bt, 0.012, 0, (t, j) => t * t * (j === 1 ? 0.8 : 1));
      // pull the crown of the last tail row up to make the V notch
      const last = tp.length - 3 * 3 + 3; tp[last + 1] += 0.09;
    }
    { const sp = new THREE.SphereGeometry(1, 14, 10); addGeo(sp, M4.compose(V.set(0.03, 0, 0), new THREE.Quaternion(), new THREE.Vector3(0.09, 0.12, 0.11)), 0); }
    const bowV1 = T0(), bowI1 = I0();
    // ---- the gold post (unit height 1) ----
    { const cyl = (r0, r1, h, y, seg) => { const g = new THREE.CylinderGeometry(r0, r1, h, seg || 20); addGeo(g, M4.makeTranslation(0, y + h / 2, 0), 1); };
      cyl(0.026, 0.03, 0.92, 0.06); cyl(0.13, 0.15, 0.035, 0); cyl(0.085, 0.11, 0.04, 0.035); cyl(0.045, 0.06, 0.05, 0.075);
      const tor = new THREE.TorusGeometry(0.04, 0.012, 8, 20); tor.rotateX(Math.PI / 2); addGeo(tor, M4.makeTranslation(0, 0.86, 0), 1); addGeo(tor, M4.makeTranslation(0, 0.97, 0), 1);
      const sp = new THREE.SphereGeometry(0.065, 18, 12); addGeo(sp, M4.makeTranslation(0, 1.04, 0), 1);
      const cn = new THREE.ConeGeometry(0.03, 0.09, 14); addGeo(cn, M4.makeTranslation(0, 1.13, 0), 1); }
    const postV1 = T0(), postI1 = I0();
    // ---- one half of the ceremonial scissors (unit: about 1 long, pivot at the origin, blade plane xy; the other half is mirrored) ----
    { const bl = new THREE.BoxGeometry(1, 1, 1, 1, 8, 1), p = bl.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 0.5, t = y, wdt = 0.085 * (1 - 0.9 * Math.pow(t, 1.3)); p.setXYZ(i, (p.getX(i) + 0.5) * wdt, -0.66 * t, p.getZ(i) * (p.getX(i) > 0 ? 0.012 : 0.032) + 0.016); }
      bl.computeVertexNormals(); addGeo(bl.toNonIndexed(), M4.identity(), 2);
      const sh = new THREE.CylinderGeometry(0.018, 0.024, 1, 10); const a = Math.atan2(0.1, 0.26); addGeo(sh, M4.compose(V.set(-0.05, 0.14, 0.012), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a), new THREE.Vector3(1, 0.28, 1)), 1);
      const tor = new THREE.TorusGeometry(0.085, 0.02, 10, 24); addGeo(tor, M4.compose(V.set(-0.12, 0.36, 0.012), new THREE.Quaternion(), new THREE.Vector3(1, 1.25, 1)), 1);
      const pv = new THREE.CylinderGeometry(0.03, 0.03, 0.05, 16); pv.rotateX(Math.PI / 2); addGeo(pv, M4.makeTranslation(0, 0, 0.02), 1);
      const sc = new THREE.CylinderGeometry(0.018, 0.018, 0.012, 14); sc.rotateX(Math.PI / 2); addGeo(sc, M4.makeTranslation(0, 0, 0.05), 3); }
    const sciV1 = T0(), sciI1 = I0();
    const nBow = bowV1 - bowV0, nPost = postV1 - bowV1, nSci = sciV1 - postV1;
    const nStrip = 2 * (NS + 1) * NR, NV = nStrip + 3 * nBow + 2 * nPost + 2 * nSci;
    const pos = new Float32Array(NV * 3), nor = new Float32Array(NV * 3), mat = new Float32Array(NV), idx = [];
    for (let h = 0; h < 2; h++) { const b0 = h * (NS + 1) * NR;
      for (let c = 0; c <= NS; c++) for (let r = 0; r < NR; r++) mat[b0 + c * NR + r] = ROWM[r];
      for (let c = 0; c < NS; c++) for (let r = 0; r < NR - 1; r++) { const a = b0 + c * NR + r; idx.push(a, a + 1, a + NR, a + 1, a + NR + 1, a + NR); } }
    const parts = [];   // [vertex start in the buffer, template v0, count, index start in the template, index count]
    let v = nStrip;
    const place = (tv0, tv1, ti0, ti1) => { const at = v; for (let i = 0; i < tv1 - tv0; i++) mat[at + i] = tm[tv0 + i]; for (let i = ti0; i < ti1; i++) idx.push(ti[i] - tv0 + at); parts.push([at, tv0, tv1 - tv0]); v += tv1 - tv0; return parts.length - 1; };
    const bows = [place(bowV0, bowV1, bowI0, bowI1), place(bowV0, bowV1, bowI0, bowI1), place(bowV0, bowV1, bowI0, bowI1)];
    const posts = [place(bowV1, postV1, bowI1, postI1), place(bowV1, postV1, bowI1, postI1)];
    const scis = [place(postV1, sciV1, postI1, sciI1), place(postV1, sciV1, postI1, sciI1)];
    const TP = new Float32Array(tp), TN = new Float32Array(tn), TW = new Float32Array(tw);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aMat', new THREE.BufferAttribute(mat, 1)); g.setIndex(idx);
    const sciCount = idx.length, sciStart = idx.length - (sciI1 - postI1) * 2;   // the scissors are the last indices: drop them from the draw range when idle
    // materials: 0 satin, 1 gold, 2 blade steel, 3 dark pivot screw. Exit fades are a screen-door dither (uFade), never a shrink.
    const U = { uFade: { value: 1 } };
    const M = new THREE.MeshPhysicalMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.3, metalness: 0, envMapIntensity: 0.6,
      sheen: 1, sheenRoughness: 0.32, sheenColor: new THREE.Color(0.45, 0.02, 0.05), clearcoat: 0.05, clearcoatRoughness: 0.2 });
    M.onBeforeCompile = sh => {
      sh.uniforms.uFade = U.uFade;
      sh.vertexShader = 'attribute float aMat;varying float vMat;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat=aMat;');
      sh.fragmentShader = 'uniform float uFade;varying float vMat;\n' + sh.fragmentShader.replace('#include <common>', '#include <common>\n' + GLSL_NOISE)
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'if(fx2h(floor(gl_FragCoord.xy))>uFade)discard;float fxM=floor(vMat+0.5);vec4 diffuseColor=vec4(fxM<0.5?vec3(0.62,0.012,0.03):fxM<1.5?vec3(1.0,0.7,0.26):fxM<2.5?vec3(0.5,0.52,0.56):vec3(0.035,0.035,0.04),opacity);')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=fxM<0.5?0.28:fxM<1.5?0.2:fxM<2.5?0.2:0.35;')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor=fxM<0.5?0.0:1.0;')
        .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_SHEEN\nmaterial.sheenColor*=fxM<0.5?1.:0.;\n#endif\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat*=fxM<0.5?1.:0.;\n#endif');
    };
    const mesh = new THREE.Mesh(g, M); mesh.frustumCulled = false; mesh.visible = false; root.add(mesh);
    // marigold petals and confetti: a gently cupped petal; confetti are the same shape, squarer, instanced and coloured
    const PN = 1100, pg = new THREE.BufferGeometry(), PP = [];
    for (let i = 0; i <= 2; i++) for (let j = 0; j <= 2; j++) { const x = i / 2 - 0.5, y = (j / 2 - 0.5) * (i === 1 ? 0.62 : 0.42); PP.push(x, y, 0.16 * (y * y * 6 + x * x)); }
    pg.setAttribute('position', new THREE.Float32BufferAttribute(PP, 3)); pg.setIndex([0, 3, 1, 1, 3, 4, 1, 4, 2, 2, 4, 5, 3, 6, 4, 4, 6, 7, 4, 7, 5, 5, 7, 8]); pg.computeVertexNormals();
    const PU = { uFade: { value: 1 } };
    const pm = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.05 });
    pm.onBeforeCompile = sh => { sh.uniforms.uFade = PU.uFade;
      sh.fragmentShader = 'uniform float uFade;\n' + sh.fragmentShader.replace('#include <common>', '#include <common>\n' + GLSL_NOISE)
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'if(fx2h(floor(gl_FragCoord.xy)+0.37)>uFade)discard;vec4 diffuseColor = vec4( diffuse, opacity );')
        .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = vColor*0.32;'); };
    const petals = new THREE.InstancedMesh(pg, pm, PN);
    petals.frustumCulled = false; petals.count = 0; petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(petals);
    const PC = ['#ff8c00', '#ffa000', '#ffb300', '#ff7b00', '#ffc400', '#f57c00', '#ffd000', '#ff9500', '#ffe14d', '#ff6a00'];
    const pr = new Float32Array(PN * 8); { const Rr = mulberry(7); for (let i = 0; i < PN; i++) { for (let j = 0; j < 8; j++) pr[i * 8 + j] = Rr(); petals.setColorAt(i, _c.set(PC[i % PC.length]).multiplyScalar(1.15)); } }
    return { mesh, g, pos, nor, NS, NR, ROWV, nStrip, parts, bows, posts, scis, TP, TN, TW, sciStart, sciCount, petals, pr, PN, U, PU };
  })();
  const _n3 = new THREE.Matrix3(), _rq = new THREE.Quaternion(), _ra = new THREE.Vector3();
  // write a template part into the dynamic buffer through the matrix _m (with an optional flutter offset along x)
  function rbPart(pi, flut, now) {
    const [at, t0, n] = RB.parts[pi], P = RB.pos, N = RB.nor, TP = RB.TP, TN = RB.TN, TW = RB.TW, e = _m.elements; _n3.getNormalMatrix(_m);
    const ne = _n3.elements;
    for (let i = 0; i < n; i++) {
      const s = (t0 + i) * 3, d = (at + i) * 3, f = flut ? TW[t0 + i] * flut * Math.sin(now * 5.3 + TP[s + 1] * 9 + pi) : 0;
      const x = TP[s] + f, y = TP[s + 1], z = TP[s + 2] + f * 0.4;
      P[d] = e[0] * x + e[4] * y + e[8] * z + e[12]; P[d + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; P[d + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      const nx = TN[s], ny = TN[s + 1], nz = TN[s + 2];
      let a = ne[0] * nx + ne[3] * ny + ne[6] * nz, b = ne[1] * nx + ne[4] * ny + ne[7] * nz, c = ne[2] * nx + ne[5] * ny + ne[8] * nz; const l = Math.hypot(a, b, c) || 1;
      N[d] = a / l; N[d + 1] = b / l; N[d + 2] = c / l;
    }
  }
  // The cut animates in real time: tau is "animation seconds" (10 per real second, the cinematic's 0.5x), counted from the first
  // frame cutAt is seen, and forced ahead of sim time so it always finishes before the exit fade at t1.
  const RB_SNIP = 11;   // animation seconds after the cut when the blades meet (1.1 s real)
  function ribbonUpdate(list, dt, now) {
    const it = list[0]; if (!it) { RB.mesh.visible = false; RB.petals.count = 0; RB.petals.visible = false; return; }
    // snap onto its runway, ahead of the line-up point (the story spawns it on the hold, past the runway end); cached per item
    const st = stOf(it, () => ({ x: it.x, y: it.y, ix: NaN, iy: NaN, cutT: null, cutNow: 0 }));
    if (st.ix !== it.x || st.iy !== it.y) {
      st.ix = it.x; st.iy = it.y; st.x = it.x; st.y = it.y; const RWs = Z.RW || [];
      for (let i = 0; i < RWs.length; i++) { const r = RWs[i]; if (Math.abs(r.y - it.y) >= r.width) continue;
        const a = Math.min(r.x0, r.x1), b = Math.max(r.x0, r.x1);
        if (it.x < a + 150 || it.x > b - 150) st.x = Math.abs(it.x - a) < Math.abs(it.x - b) ? a + 220 : b - 220;
        st.y = r.y; break; }
    }
    if (it.cutAt == null) st.cutT = null; else if (st.cutT !== it.cutAt) { st.cutT = it.cutAt; st.cutNow = now; }
    // scale by the camera's distance to the ribbon itself (the follow-cam cinematic frames the aircraft, a few hundred metres off)
    const cp = Z.camera.position, cd = Math.max(Z.camDist * 0.5, Math.hypot(cp.x - st.x, cp.y, cp.z - st.y));
    const T = Z.T, k = clamp(cd / 110, 1, 30), w0 = it.w || 75, P = RB.pos, NS = RB.NS, NR = RB.NR;
    const fade = smooth(it.t0, it.t0 + 4, T) * (1 - smooth(it.t1 - 25, it.t1 - 2, T));
    const tau = st.cutT != null ? Math.max(10 * (now - st.cutNow), 2 * (T - st.cutT) - 100) : -1, cut = tau >= RB_SNIP, tf = cut ? (tau - RB_SNIP) / 10 : 0;   // tf: real seconds of fall
    // strategic: a longer, proportionally slimmer band, turned about its span axis to face the camera
    const kS = 1 + 1.6 * smooth(2500, 9000, cd), sW = smooth(2500, 9000, cd), sF = smooth(1500, 5000, cd), w = w0 * mix(1, 3, sW);
    const PH = 2.9 * k * kS, RH = Math.min(0.6 * k * kS * kS, w * 0.4), yc = PH * 0.74 - RH * 0.5, sag = Math.min(w * 0.03, 0.3 * PH);
    const ox = st.x, oz = st.y, wind = Z.atmo && Z.atmo.wind ? Z.atmo.wind.speed || 4 : 4, gy = 0.025 * k;
    let thF = Math.atan2(-(cp.y - yc), cp.x - ox); if (thF > Math.PI / 2) thF -= Math.PI; else if (thF < -Math.PI / 2) thF += Math.PI;
    const thB = sF * thF, cB = Math.cos(thB), sB = Math.sin(thB);
    // ---- the satin strip: two halves from each post to the centre ----
    let v = 0;
    for (let h = 0; h < 2; h++) {
      const sgn = h ? 1 : -1;
      for (let c = 0; c <= NS; c++) {
        const u = c / NS, s = u * w;
        // intact: a shallow catenary and two or three travelling twists a half, so a sheen highlight runs along the satin
        const yI = yc - sag * (1 - (1 - u) * (1 - u));
        const thI = mix(0.5 * Math.sin(now * 1.3 - u * 15.7 + h * 1.7) * Math.min(1, u * (1 - u) * 8) + 0.06 * Math.sin(now * 2.1 + u * 15), thF, sF);
        let x = ox + Math.sin(now * (1.6 + wind * 0.15) + u * 6 + h * 2) * 0.05 * k * u * (1 - sF), y = yI, z = oz + sgn * w * (1 - u), th = thI;
        if (cut) {   // falls free-end first, flutters, and lies on the runway in a lazy S with a loose loop near the cut, hanging from the post
          const f = clamp((tf - (1 - u) * 0.35) / (0.9 + 0.5 * (1 - u)), 0, 1), fe = f * f * (3 - 2 * f), mid = Math.sin(f * Math.PI);
          const Lh = yc, sl = Math.max(0, s - Lh), lie = sl * 0.82, lp = clamp((u - 0.8) / 0.12, 0, 1) * Math.PI * 2, LR = 0.9 * k * (1 - sW);
          const yF = s < Lh ? yc - s : gy + 0.03 * k * (1 + Math.sin(sl * 0.7 / k + h)) + LR * (1 - Math.cos(lp));
          const zF = s < Lh ? oz + sgn * w : oz + sgn * (w - lie + LR * Math.sin(lp));
          const xF = ox + (s < Lh ? 0 : Math.sin(sl * 0.5 / k + h * 2.1) * 1.6 * k * smooth(0, 4 * k, sl));
          x = mix(x, xF, fe) + mid * Math.sin(now * 6.5 + u * 11 + h) * 1.4 * k * u;
          y = mix(yI, yF, fe) + mid * Math.sin(now * 8 + u * 14) * 0.5 * k;
          z = mix(z, zF, fe); th = mix(thI, Math.PI * 0.5 + (s < Lh ? 0 : 0.5 * Math.sin(sl * 0.9 / k + h)), fe) + mid * 1.6 * Math.sin(now * 5 + u * 9 + h * 3);
        }
        const sx = Math.sin(th), sy = Math.cos(th);
        for (let r = 0; r < NR; r++) {
          const q = (RB.ROWV[r] - 0.5) * RH, cup = (RB.ROWV[r] - 0.5) * (RB.ROWV[r] - 0.5) * 0.25 * RH;
          P[v * 3] = x + sx * q + sy * cup; P[v * 3 + 1] = y + sy * q - sx * cup; P[v * 3 + 2] = z; v++;
        }
      }
    }
    // strip normals from the grid (no allocations)
    const N = RB.nor;
    for (let h = 0; h < 2; h++) { const b0 = h * (NS + 1) * NR;
      for (let c = 0; c <= NS; c++) for (let r = 0; r < NR; r++) {
        const i = b0 + c * NR + r, a = b0 + Math.max(0, c - 1) * NR + r, b = b0 + Math.min(NS, c + 1) * NR + r, d = b0 + c * NR + Math.max(0, r - 1), e2 = b0 + c * NR + Math.min(NR - 1, r + 1);
        const tx = P[b * 3] - P[a * 3], ty = P[b * 3 + 1] - P[a * 3 + 1], tz = P[b * 3 + 2] - P[a * 3 + 2], bx = P[e2 * 3] - P[d * 3], by = P[e2 * 3 + 1] - P[d * 3 + 1], bz = P[e2 * 3 + 2] - P[d * 3 + 2];
        let nx = by * tz - bz * ty, ny = bz * tx - bx * tz, nz = bx * ty - by * tx; const l = Math.hypot(nx, ny, nz) || 1; N[i * 3] = nx / l; N[i * 3 + 1] = ny / l; N[i * 3 + 2] = nz / l;
      } }
    // ---- the posts and their bows (the bows turn with the band) ----
    const BS = 1.55 * k * kS;
    _rq.setFromAxisAngle(_ra.set(0, 0, 1), -thB);
    for (let b = 0; b < 2; b++) {
      const pz = oz + (b ? w : -w);
      _q.identity(); _v.set(ox, 0, pz); _s.set(PH, PH, PH); _m.compose(_v, _q, _s); rbPart(RB.posts[b], 0, now);
      _e.set(0.06 * Math.sin(now * 1.1 + b), b ? 0.12 : -0.12, 0); _q.setFromEuler(_e); _q.premultiply(_rq);
      _v.set(ox + cB * 0.04 * PH, yc + RH * 0.1 * (1 - sF) - sB * 0.04 * PH, pz); _s.setScalar(BS); _m.compose(_v, _q, _s); rbPart(RB.bows[b], 0.05 + 0.05 * (wind / 8), now);
    }
    // the centre bow: rides the ribbon, then drops and tumbles onto the runway
    { const f = cut ? clamp(tf / 0.8, 0, 1) : 0, fe = f * f;
      _e.set(fe * 1.45 + 0.05 * Math.sin(now * 1.4), 0.15 * Math.sin(now * 0.7) * (1 - f), Math.sin(f * Math.PI) * 0.8, 'XYZ'); _q.setFromEuler(_e);
      if (!cut) _q.premultiply(_rq);
      _v.set(ox + fe * 0.4 * BS + (1 - fe) * cB * 0.03 * PH, mix(yc - sag + RH * 0.1 * (1 - sF) - sB * 0.03 * PH, gy + 0.12 * BS, fe), oz); _s.setScalar(BS * 1.15); _m.compose(_v, _q, _s); rbPart(RB.bows[2], 0.06, now); }
    // ---- the scissors: drop in, open, snip, lift away ----
    const sci = tau >= 0 && tau < 32;
    if (sci) {
      const ca = Math.atan2(cp.z - oz, cp.x - ox), SL = 4.6 * k, pop = smooth(0, 4, tau), out = smooth(18, 30, tau), sc = SL * (pop * (1 + 0.12 * Math.sin(clamp(tau / 4, 0, 1) * Math.PI)) * (1 - out) + 0.001);
      const open = tau < 8 ? 0.62 * smooth(1, 6, tau) : tau < RB_SNIP ? 0.62 * (1 - smooth(8, RB_SNIP, tau)) : 0.3 * smooth(RB_SNIP + 2, RB_SNIP + 9, tau);
      const lift = (1 - pop) * 6 * k + smooth(RB_SNIP + 1, RB_SNIP + 8, tau) * 1.1 * SL;
      const ycut = yc - sag;
      _e.set(-0.2, Math.PI * 0.5 - ca - 0.75 + 0.1 * Math.sin(now * 0.8), 0.05 * Math.sin(now * 1.3), 'YXZ'); _rq.setFromEuler(_e);
      const fx = Math.cos(ca) * 0.8 * BS, fz = Math.sin(ca) * 0.8 * BS;
      for (let hh = 0; hh < 2; hh++) {
        _q.setFromAxisAngle(_ra.set(0, 0, 1), hh ? -open : open); _q.premultiply(_rq);
        _v.set(ox + fx, ycut + RH * 0.5 + 0.1 * SL + lift, oz + fz); _s.set(hh ? -sc : sc, sc, hh ? -sc : sc); _m.compose(_v, _q, _s); rbPart(RB.scis[hh], 0, now);
      }
    }
    RB.g.setDrawRange(0, sci ? RB.sciCount : RB.sciStart);
    RB.g.attributes.position.needsUpdate = true; RB.g.attributes.normal.needsUpdate = true; RB.mesh.visible = fade > 0.01; RB.U.uFade.value = fade;
    // ---- the petal and confetti burst: a ballistic fountain peaking ~0.5 s after the snip, then a fluttering, drifting plume ----
    let n = 0;
    if (cut && fade > 0.01) {
      const pr = RB.pr, kp = k, ps = clamp(cd * 0.0034, 0.07, 36), wd = Z.atmo && Z.atmo.wind;
      const wx = wd ? Math.cos(wd.dir) : 1, wz = wd ? Math.sin(wd.dir) : 0, ycut = yc - sag, G = 36 * kp, y0 = gy + 0.02 * kp;
      for (let i = 0; i < RB.PN; i++) {
        const o = i * 8, r0 = pr[o], r1 = pr[o + 1], r2 = pr[o + 2], r3 = pr[o + 3], r4 = pr[o + 4], r5 = pr[o + 5], r6 = pr[o + 6], r7 = pr[o + 7];
        const t = tf - r5 * 0.12; if (t <= 0) continue;
        const conf = r6 > 0.68, tp = 0.38 + 0.24 * r3, vy = G * tp, vt = (conf ? 0.8 : 1.3) * (0.7 + 0.6 * r4) * kp, tc = 0.3;
        const a = r0 * Math.PI * 2, vh = (25 + 15 * r1) * (0.25 + 0.75 * Math.sqrt(r7)) * kp, td = 0.26, ex = 1 - Math.exp(-t / td);
        const ypk = ycut + 0.5 * G * tp * tp, tl = tp + tc + (ypk - y0) / vt, ta = Math.min(t, tl), sd = Math.max(0, ta - tp);
        const y = Math.max(y0, t < tp ? ycut + vy * t - 0.5 * G * t * t : ypk - vt * (sd - tc * (1 - Math.exp(-sd / tc))));
        const air = t < tl ? 1 : 0, dr = Math.max(0, ta - tp * 0.5) * (1.1 + 1.4 * r2) * kp, sw = Math.sin(now * (1.5 + r7 * 2) + i) * 0.7 * kp * smooth(0, 1, sd) * air;
        _v.set(ox + Math.cos(a) * vh * td * ex * 1.15 + wx * dr + sw, y, oz + Math.sin(a) * vh * td * ex * 1.5 + wz * dr + Math.cos(now * (1.2 + r2) + i) * 0.5 * kp * smooth(0, 1, sd) * air);
        if (!air) _e.set(Math.PI * 0.5, r0 * 6, 0); else _e.set(now * (2 + r1 * 4) + i, now * (1 + r2 * 3), now * (1.5 + r3 * 2) + i * 2);
        _q.setFromEuler(_e);
        const sc = ps * (0.7 + 0.6 * r4);
        if (conf) _s.set(sc * 0.75, sc * 0.75, sc); else _s.set(sc, sc * 0.9, sc);
        _m.compose(_v, _q, _s); RB.petals.setMatrixAt(n++, _m);
      }
      RB.PU.uFade.value = fade * (1 - smooth(110, 150, tau));
    }
    RB.petals.count = n; RB.petals.visible = n > 0; if (n) RB.petals.instanceMatrix.needsUpdate = true;
  }
  KS.add('ribbon');

  // =====================================================================================================
  // DABBAWALAS: instanced riders on black roadsters, white kurta and Gandhi cap, tiffin crates; pedalling in the vertex shader
  // =====================================================================================================
  const CY = (() => {
    const N = 160, P = [], Nn = [], C = [], A = [];
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(), NM = new THREE.Matrix3();
    const add = (geo, x, y, z, rx, ry, rz, sx, sy, sz, hex, part) => {
      const g = geo.index ? geo.toNonIndexed() : geo; E.set(rx, ry, rz); Q.setFromEuler(E); V.set(x, y, z); S.set(sx, sy, sz); M.compose(V, Q, S); NM.getNormalMatrix(M);
      const gp = g.attributes.position, gn = g.attributes.normal, col = new THREE.Color(hex), t = new THREE.Vector3();
      for (let i = 0; i < gp.count; i++) { t.fromBufferAttribute(gp, i).applyMatrix4(M); P.push(t.x, t.y, t.z); t.fromBufferAttribute(gn, i).applyMatrix3(NM).normalize(); Nn.push(t.x, t.y, t.z); C.push(col.r, col.g, col.b); A.push(part); }
    };
    const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 8), SPH = new THREE.SphereGeometry(1, 7, 5), TOR = new THREE.TorusGeometry(0.33, 0.028, 4, 14);
    const bar = (x0, y0, x1, y1, z, th, hex, part) => { const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy); add(BOX, (x0 + x1) / 2, (y0 + y1) / 2, z, 0, 0, Math.atan2(dy, dx), l, th, th, hex, part); };
    const BLK = '#1d1f1c', WHT = '#f3f1ea', SKIN = '#7a4a2c', WOOD = '#8a5a2b', STEEL = '#b9bdc2';
    add(TOR, 0.52, 0.35, 0, 0, 0, 0, 1, 1, 1, BLK, 1); add(TOR, -0.52, 0.35, 0, 0, 0, 0, 1, 1, 1, BLK, 2);
    bar(-0.1, 0.38, 0.42, 0.8, 0, 0.04, BLK, 0); bar(-0.1, 0.38, -0.2, 0.92, 0, 0.04, BLK, 0); bar(-0.18, 0.84, 0.42, 0.84, 0, 0.035, BLK, 0);
    bar(-0.1, 0.38, -0.52, 0.35, 0.05, 0.025, BLK, 0); bar(-0.1, 0.38, -0.52, 0.35, -0.05, 0.025, BLK, 0); bar(0.42, 0.86, 0.52, 0.35, 0, 0.035, BLK, 0);
    bar(-0.2, 0.92, -0.52, 0.35, 0, 0.025, BLK, 0); add(BOX, 0.42, 1.0, 0, 0, 0, 0, 0.04, 0.04, 0.56, BLK, 0); bar(0.42, 0.86, 0.42, 1.0, 0, 0.035, BLK, 0);
    add(BOX, -0.2, 0.95, 0, 0, 0, 0, 0.22, 0.05, 0.12, '#3b2a1a', 0);   // saddle
    add(BOX, -0.5, 0.72, 0, 0, 0, 0, 0.5, 0.04, 0.34, BLK, 0);          // carrier
    add(BOX, -0.5, 0.92, 0, 0, 0, 0, 0.56, 0.34, 0.5, WOOD, 0);         // tiffin crate
    for (let i = 0; i < 6; i++) add(CYL, -0.68 + (i % 3) * 0.17, 1.14, (i < 3 ? -0.12 : 0.12), 0, 0, 0, 0.065, 0.12, 0.065, STEEL, 0);
    for (const z of [-0.22, 0.22]) add(BOX, 0.5, 0.82, z, 0, 0, 0, 0.26, 0.3, 0.16, z < 0 ? '#2d6a4f' : '#b5651d', 0);   // tiffin bags on the bars
    // rider: kurta torso, skirt, head + cap, arms (part 6), legs (parts 3/4 swing at the hip)
    add(BOX, -0.04, 1.32, 0, 0, 0, -0.32, 0.26, 0.6, 0.36, WHT, 0); add(BOX, -0.14, 1.0, 0, 0, 0, -0.1, 0.34, 0.24, 0.4, WHT, 0);
    add(SPH, 0.1, 1.74, 0, 0, 0, 0, 0.11, 0.125, 0.105, SKIN, 5); add(BOX, 0.1, 1.86, 0, 0, 0, 0, 0.23, 0.09, 0.15, WHT, 5); add(BOX, 0.1, 1.83, 0, 0, 0, 0, 0.24, 0.03, 0.16, '#e0ddd2', 5);
    for (const z of [-0.2, 0.2]) { bar(0.02, 1.56, 0.4, 1.02, z, 0.08, WHT, z > 0 ? 6 : 0); add(SPH, 0.41, 1.0, z, 0, 0, 0, 0.045, 0.045, 0.045, SKIN, z > 0 ? 6 : 0); }
    for (const z of [-0.11, 0.11]) { const pt = z > 0 ? 3 : 4; bar(-0.14, 0.98, 0.1, 0.62, z, 0.12, WHT, pt); bar(0.1, 0.62, -0.02, 0.32, z, 0.1, WHT, pt); add(BOX, 0.0, 0.29, z, 0, 0, 0, 0.18, 0.05, 0.08, '#2a2018', pt); }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('aPart', new THREE.Float32BufferAttribute(A, 1));
    const an = new THREE.InstancedBufferAttribute(new Float32Array(N * 2), 2); an.setUsage(THREE.DynamicDrawUsage); g.setAttribute('aAn', an);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
    mat.onBeforeCompile = sh => {
      sh.vertexShader = 'attribute float aPart;attribute vec2 aAn;\nvec2 fxRot(vec2 p,vec2 c,float a){p-=c;float s=sin(a),k=cos(a);return c+vec2(p.x*k-p.y*s,p.x*s+p.y*k);}\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph=aAn.x,hold=aAn.y;
        if(aPart>2.5&&aPart<4.5){float a=mix(0.42*sin(ph+(aPart>3.5?3.1416:0.)),-0.18+0.06*sin(ph*0.37+aPart),hold);transformed.xy=fxRot(transformed.xy,vec2(-0.14,0.98),a);}
        if(aPart>4.5&&aPart<5.5){float a=hold>0.5?0.6*sin(ph*0.21):0.12*sin(ph*0.3);transformed.xz=fxRot(transformed.xz,vec2(0.08,0.),a);}
        if(aPart>5.5){float u=pow(max(0.,sin(ph*0.17+1.)),10.)*hold;transformed.xy=fxRot(transformed.xy,vec2(0.02,1.56),1.9*u);}
        if(aPart<0.5||aPart>4.5){transformed.y+=0.015*sin(ph*2.)*(1.-hold);}`);
    };
    const mesh = new THREE.InstancedMesh(g, mat, N); mesh.boundingSphere = new THREE.Sphere(); mesh.count = 0; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(mesh);
    const rnd = new Float32Array(N * 4); { const R = mulberry(31); for (let i = 0; i < rnd.length; i++) rnd[i] = R(); }
    return { mesh, an, rnd, N };
  })();
  function cyclistsUpdate(list, dt, now) {
    let n = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const T = Z.T, kc = clamp(Z.camDist / 140, 1, 55), N = CY.N, rnd = CY.rnd;
    for (const it of list) {
      const m = Math.min(it.n || 30, N - n), dx = it.x1 - it.x0, dy = it.y1 - it.y0, L = Math.hypot(dx, dy), hold = it.hold || L < 1;
      const hx = hold ? 1 : dx / L, hy = hold ? 0 : dy / L, hd = Math.atan2(hy, hx), fade = smooth(it.t0 - 1, it.t0 + 2, T) * (1 - smooth(it.t1 - 3, it.t1, T));
      const gap = 2.6 * kc, D = it.t1 - it.t0, v = (L + m * gap / 3) / Math.max(10, D);
      for (let j = 0; j < m; j++) {
        const r0 = rnd[j * 4], r1 = rnd[j * 4 + 1], r2 = rnd[j * 4 + 2], r3 = rnd[j * 4 + 3];
        let x, y, h = hd, mode = 0;
        const row = Math.floor(j / 3), lane = (j % 3) - 1;
        if (hold) {
          x = it.x0 - row * 2.3 * kc + (r0 - 0.5) * 0.9 * kc; y = it.y0 + lane * 1.5 * kc + (r1 - 0.5) * 0.6 * kc; h = hd + (r2 - 0.5) * 0.3; mode = 1;
        } else {
          const d = v * (T - it.t0) - row * gap + (r0 - 0.5) * gap * 0.6;
          if (d < -0.5 || d > L + 0.5) continue;
          const lat = lane * 1.5 * kc + (r1 - 0.5) * 0.8 * kc + Math.sin(now * 0.6 + j) * 0.15 * kc;
          x = it.x0 + hx * d - hy * lat; y = it.y0 + hy * d + hx * lat; h = hd + Math.sin(now * 1.1 + j * 2) * 0.04;
        }
        const ph = mode ? now + r3 * 40 : now * (7 + r2 * 2) + r3 * 6;
        _e.set(mode ? Math.sin(now * 0.5 + j) * 0.04 : Math.sin(ph) * 0.03, -h, 0, 'YXZ'); _q.setFromEuler(_e);
        _v.set(x, 0.12, y); _s.setScalar(kc * Math.max(0.01, fade)); _m.compose(_v, _q, _s); CY.mesh.setMatrixAt(n, _m); CY.an.setXY(n, ph, mode);
        blob(x, y, -h, 1.9 * kc, 0.55 * kc, 0.45 * fade);
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        n++;
      }
    }
    CY.mesh.count = n; CY.mesh.visible = n > 0; if (n) { CY.mesh.instanceMatrix.needsUpdate = true; CY.an.needsUpdate = true;
      // culled as one group (80 riders are 72k triangles: a cinematic across the field rarely has them in view)
      const bs = CY.mesh.boundingSphere; bs.center.set((x0 + x1) / 2, kc, (y0 + y1) / 2); bs.radius = Math.hypot(x1 - x0, y1 - y0) / 2 + 3 * kc; }
  }
  KS.add('cyclists');

  // =====================================================================================================
  // FIREWORKS, built to read in daylight: one instanced draw of camera-facing quads. Big saturated shells (saffron, white, green,
  // gold, tiranga, gold willow) as tapered velocity-stretched streaks with an HDR burst flash, rocket smoke trails, lingering
  // coloured smoke puffs that drift with the wind, and four ground fountains. Premultiplied blending lets one draw mix
  // occluding smoke (drawn first) with glowing sparks. All motion is in the vertex shader; the CPU sets a few uniforms.
  // =====================================================================================================
  const FW = (() => {
    const S = 16, PP = 230, NSB = 10, NST = 8, NF = 4, FP = 170, FS = 10;
    const nSmoke = S * (NSB + NST) + NF * FS, nSpark = NF * FP + S * PP, n = nSmoke + nSpark;
    const A = new Float32Array(n * 4), B = new Float32Array(n * 4), R = mulberry(77);
    let i = 0;
    const put = (type, slot, j, dx, dy, dz) => { A[i * 4] = type; A[i * 4 + 1] = slot; A[i * 4 + 2] = j; A[i * 4 + 3] = R(); B[i * 4] = dx; B[i * 4 + 1] = dy; B[i * 4 + 2] = dz; B[i * 4 + 3] = R(); i++; };
    const dir = (k) => { const u = R() * 2 - 1, a = R() * Math.PI * 2, q = Math.sqrt(1 - u * u); return [Math.cos(a) * q * k, u * k, Math.sin(a) * q * k]; };
    // smoke first (it occludes), then fountain sparks, then shell sparks
    for (let s = 0; s < S; s++) for (let j = 0; j < NSB; j++) put(0, s, j / NSB, ...dir(1));
    for (let s = 0; s < S; s++) for (let j = 0; j < NST; j++) put(1, s, (j + 0.5) / NST, ...dir(1));
    for (let f = 0; f < NF; f++) for (let j = 0; j < FS; j++) put(2, f, j / FS, ...dir(1));
    for (let f = 0; f < NF; f++) for (let j = 0; j < FP; j++) put(3, f, j / FP, ...dir(1));
    for (let s = 0; s < S; s++) for (let j = 0; j < PP; j++) put(4, s, j, ...dir(0.84 + 0.16 * R()));
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('aA', new THREE.InstancedBufferAttribute(A, 4)); g.setAttribute('aB', new THREE.InstancedBufferAttribute(B, 4)); g.instanceCount = n;
    // uC: show centre (bursts), uG: launch site on open ground (rockets, gerbs), uR: burst scale with camera distance, uSm: smoke alpha
    const U = { uTime: { value: 0 }, uC: { value: new THREE.Vector3() }, uG: { value: new THREE.Vector3() }, uFade: { value: 0 }, uK: { value: 1 }, uR: { value: 1 }, uSm: { value: 1 },
      uPix: { value: 0.001 }, uWind: { value: new THREE.Vector2(3, 0) }, uDay: { value: 0 } };
    // Colours stay at or below ~1.1 with the secondary channels near zero, so ACES and bloom keep them saffron, green and gold;
    // only the burst flash (and a white shell's first 0.15 s) goes HDR and carries the bloom.
    const mat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      vertexShader: `uniform float uTime,uFade,uK,uPix,uR,uSm,uDay;uniform vec3 uC,uG;uniform vec2 uWind;attribute vec4 aA,aB;
        varying vec2 vUv;varying vec3 vCol;varying float vA,vT,vSeed,vHot;
        float h1(float x){return fract(sin(x*78.233)*43758.5453);}
        const float PER=0.62,RISE=1.25;const float CYC=${S}.*PER;
        const vec3 SAF=vec3(1.,.32,0.),WHT=vec3(1.,.96,.9),GRN=vec3(0.,.85,.18),GLD=vec3(1.,.68,.08);
        vec3 shellCol(float ci,vec3 d){
          if(ci<1.)return SAF;if(ci<2.)return WHT;if(ci<3.)return GRN;if(ci<4.)return GLD;
          return d.y>.33?SAF:d.y<-.33?GRN:WHT;}   // tiranga: saffron over white over green
        vec3 smokeCol(float ci,vec3 d){
          vec3 sa=vec3(.95,.42,.08),wh=vec3(.86,.85,.83),gr=vec3(.12,.55,.22),go=vec3(.9,.6,.16);
          if(ci<1.)return sa;if(ci<2.)return wh;if(ci<3.)return gr;if(ci<4.)return go;return d.y>.33?sa:d.y<-.33?gr:wh;}
        // shell parameters for slot s at time t: burst point, launch point, kind, colour index, age in the cycle
        void shell(float s,out vec3 bp,out vec3 g0,out float kind,out float ci,out float age){
          float tt=uTime-s*PER,c=floor(tt/CYC);age=tt-c*CYC;float sh=s*7.13+c*31.7;
          bp=uC+vec3((h1(sh)-.5)*560.*uR,(190.+h1(sh+1.)*230.)*uR,(h1(sh+2.)-.5)*560.*uR);
          g0=uG+vec3((h1(sh+5.)-.5)*90.,0.,(h1(sh+6.)-.5)*90.);kind=h1(sh+3.);ci=floor(h1(sh+4.)*5.);}
        // kinds: <.45 peony, .45-.72 peony + crackle, .72-.88 big chrysanthemum, >.88 gold willow (slow, drooping, long trails)
        vec3 sparkAt(vec3 bp,vec3 d,float kind,float t){
          float big=step(.72,kind),wil=step(.88,kind),R=mix(150.,200.,big)*uR*(1.-exp(-t*mix(mix(2.6,1.7,big),2.2,wil)));
          return bp+d*R-vec3(0.,(mix(mix(15.,9.,big),22.,wil)*t*t+mix(6.,3.,big)*t)*uR,0.);}
        void main(){
          float type=aA.x,s=aA.y,j=aA.z,r=aA.w;vec3 d=aB.xyz;float r2=aB.w;
          vec3 p=uC,pp=uC;float w=1.,a=0.;vec3 col=vec3(1.);float vt=0.;vHot=0.;
          vec3 bp,g0;float kind,ci,age;
          if(type<1.5){                                   // shell smoke: burst puffs (0) and rocket trail (1); denser, deeper-coloured by day
            shell(s,bp,g0,kind,ci,age);vt=1.;
            if(type<0.5){float t=age-RISE-.05;a=t>0.?.55*smoothstep(0.,.35,t)*exp(-t/5.):0.;
              col=mix(vec3(.78,.76,.74),smokeCol(ci,d),.85+.15*uDay)*(1.-.12*uDay);a*=1.+.6*uDay;
              p=bp+d*(80.+55.*r)*uR*(1.-exp(-t*1.6))-vec3(0.,4.*t,0.)+vec3(uWind.x,0.,uWind.y)*t*2.2;w=((32.+26.*r)*(.55+.45*min(t,3.)/3.)+t*5.)*uR;}
            else{float te=j*RISE*.92,t=age-te;float f=j;f=1.-(1.-f)*(1.-f);
              a=t>0.?.42*exp(-t/3.)*smoothstep(0.,.15,t):0.;col=vec3(.84,.83,.81);
              p=mix(g0,bp,f*.92)+vec3(uWind.x,0.,uWind.y)*t*2.+vec3(d.x,0.,d.z)*3.*t;w=(7.+t*5.5+r*3.)*sqrt(uR);}
            a*=(1.-smoothstep(CYC-2.2,CYC-.2,age))*uSm;
          } else if(type<2.5){                            // fountain smoke rising from each gerb
            float fa=s*1.5708+.785,life=4.5,t=mod(uTime+j*life+r,life);vec3 base=uG+vec3(cos(fa),0.,sin(fa))*55.;vt=1.;
            p=base+vec3(0.,8.+t*9.,0.)*sqrt(uK)+vec3(uWind.x,0.,uWind.y)*t*1.8+d*4.;w=(8.+t*5.)*sqrt(uK);a=.32*smoothstep(0.,.6,t)*(1.-t/life)*uSm;col=vec3(.9,.88,.84);
          } else if(type<3.5){                            // fountain sparks (gerbs): golden arcs
            float fa=s*1.5708+.785,life=1.25+.35*r2,t=mod(uTime*1.+j*7.31+r*life,life);vec3 base=uG+vec3(cos(fa),0.,sin(fa))*55.;
            float kf=sqrt(uK);vec3 v=vec3(d.x*9.,30.+9.*r,d.z*9.)*kf;
            p=base+(v*t-vec3(0.,.5*30.*kf*t*t,0.));float tq=max(0.,t-.1);pp=base+(v*tq-vec3(0.,.5*30.*kf*tq*tq,0.));
            a=(1.-t/life)*(.6+.4*step(.5,h1(j*91.+floor(uTime*24.))));col=mix(vec3(1.,.5,.05),vec3(1.,.74,.25),r2)*1.1;w=.2*kf;
          } else {                                       // shell sparks: rocket, then the burst (star 0 becomes the flash)
            shell(s,bp,g0,kind,ci,age);
            if(age<RISE){float f=age/RISE;f=1.-(1.-f)*(1.-f);float lag=j<1.?0.:j/${PP}.*.35;
              float f2=max(0.,f-lag);p=mix(g0,bp,f2)+vec3(d.x,0.,d.z)*lag*40.;pp=mix(g0,bp,max(0.,f2-.035));
              a=j<1.?1.:(j<60.?max(0.,1.-lag*3.)*.8:0.);col=j<1.?vec3(1.,.8,.5)*1.8:vec3(1.,.55,.18);w=j<1.?.9:.4;
            } else {
              float t=age-RISE,big=step(.72,kind),wil=step(.88,kind),life=mix(mix(2.8,4.4,big),5.8,wil),R=mix(150.,200.,big)*uR;
              if(j<1.){p=bp;pp=bp;a=t<.45?1.4*(1.-t/.45):0.;col=mix(shellCol(ci,vec3(0.,1.,0.)),vec3(1.),.35)*2.6;w=.4*R*(.35+.65*smoothstep(0.,.06,t));vt=2.;}
              else{p=sparkAt(bp,d,kind,t);pp=sparkAt(bp,d,kind,max(0.,t-mix(mix(.3,.45,big),.75,wil)));
                a=pow(max(0.,1.-t/life),1.2)*(.55+.9*fract(r*13.7));
                col=shellCol(ci,d);if(big>.5&&ci!=4.)col=mix(col,GLD,.4);
                if(wil>.5)col=mix(vec3(1.,.62,.1),vec3(.9,.36,.04),smoothstep(1.,4.5,t));
                if(kind>.45&&kind<.72&&t>.9){a*=step(.5,h1(j*3.1+floor(uTime*20.)))*1.5;col=mix(col,vec3(1.,.9,.6),.5);}   // crackle
                float wsh=ci==1.||(ci==4.&&abs(d.y)<=.33)?1.:0.;vHot=wsh*max(0.,1.-t/.15);
                w=.3*(1.+.35*big);}
            }
          }
          vA=a*uFade;vT=vt;vSeed=r*17.+s;
          vec4 m0=modelViewMatrix*vec4(p,1.);vec3 c=m0.xyz;
          if(vt>.5){float an=r*6.283+uTime*.05*(r-.5);mat2 R2=mat2(cos(an),-sin(an),sin(an),cos(an));
            if(vt<1.5){float nz=-m0.z;w*=max(.15,smoothstep(300.,1500.,nz));vA*=smoothstep(120.,450.,nz);}   // never sit inside a puff
            c.xy+=R2*position.xy*w;vUv=position.xy;vCol=col*(vt<1.5?.85+.25*position.y:1.);}   // smoke lit from above
          else{w=max(w,uPix*-m0.z);vec4 m1=modelViewMatrix*vec4(pp,1.);vec2 ax=m0.xy-m1.xy;float L=length(ax);vec2 dr=L>1e-3?ax/L:vec2(0.,1.);vec2 sd=vec2(dr.y,-dr.x);
            c=mix(m1.xyz,m0.xyz,position.y*.5+.5);c.xy+=sd*position.x*w+dr*position.y*w;vUv=position.xy;vCol=col;}
          gl_Position=vA>.002?projectionMatrix*vec4(c,1.):vec4(2.,2.,2.,1.);
        }`,
      fragmentShader: `uniform float uDay;varying vec2 vUv;varying vec3 vCol;varying float vA,vT,vSeed,vHot;
        ${GLSL_NOISE}
        void main(){
          if(vT>1.5){float r=length(vUv);float a=vA*(exp(-r*r*6.)+.35*exp(-r*r*2.));if(a<.003)discard;gl_FragColor=vec4(vCol*a,a*.3);}
          else if(vT>.5){float n=fx2n(vUv*2.2+vSeed)*.6+fx2n(vUv*5.1-vSeed)*.4;float m=smoothstep(1.,.25,length(vUv)+(n-.5)*.7);float a=m*vA;
            if(a<.004)discard;gl_FragColor=vec4(vCol*a,a);}
          else{float y=vUv.y*.5+.5,x=vUv.x;float core=exp(-x*x*mix(3.5,6.,uDay));float along=pow(y,1.6)*(1.-smoothstep(.93,1.,y)*.5);float a=min(1.,vA*core*along*mix(1.4,2.4,uDay));
            // daylight: a soft dark rim around each streak (alpha only) so the colour holds against a bright field or haze
            float rim=min(.4,vA*along*exp(-x*x*1.5)*.5)*uDay;
            if(a<.003&&rim<.003)discard;gl_FragColor=vec4((vCol+vec3(vHot*1.2*core))*a,max(a*.88,rim));}
        }` });
    const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.visible = false; root.add(mesh);
    return { mesh, U };
  })();
  // the launch site: open ground 380-900 m from the show centre, clear of buildings, piers and stands (gates) and runways,
  // so the rockets and the four gerbs never rise out of a roof. Found once per item and cached.
  const fwCtx = (() => { try { return document.createElement('canvas').getContext('2d'); } catch (e) { return null; } })();
  const fwBlocked = (x, y) => {
    const Bs = Z.BLD || [], Gs = Z.GATES || [], Rs = Z.RW || [];
    if (fwCtx) for (let i = 0; i < Bs.length; i++) if (Bs[i].p && fwCtx.isPointInPath(Bs[i].p, x, y)) return true;
    for (let i = 0; i < Gs.length; i++) if (Gs[i].x != null && Math.hypot(Gs[i].x - x, Gs[i].y - y) < 130) return true;
    for (let i = 0; i < Rs.length; i++) { const r = Rs[i]; if (x > Math.min(r.x0, r.x1) - 120 && x < Math.max(r.x0, r.x1) + 120 && Math.abs(y - r.y) < r.width / 2 + 70) return true; }
    return false;
  };
  const fwSite = it => {
    for (const rad of [380, 450, 550, 700, 900]) for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2 + Math.PI / 2, x = it.x + Math.cos(a) * rad, y = it.y + Math.sin(a) * rad;
      let ok = !fwBlocked(x, y);
      for (let q = 0; q < 8 && ok; q++) { const b = q * Math.PI / 4; ok = !fwBlocked(x + Math.cos(b) * 75, y + Math.sin(b) * 75); }
      if (ok) return { x, y };
    }
    return { x: it.x, y: it.y };
  };
  function fireworksUpdate(list, dt, now) {
    const it = list[0]; if (!it) { FW.mesh.visible = false; return; }
    const st = stOf(it, () => fwSite(it));
    const T = Z.T, f = smooth(it.t0, it.t0 + 6, T) * (1 - smooth(it.t1 - 25, it.t1, T)), cd = Z.camDist, sS = smooth(2500, 9000, cd);
    FW.U.uTime.value = now; FW.U.uC.value.set(it.x, 0, it.y); FW.U.uG.value.set(st.x, 0, st.y); FW.U.uFade.value = f; FW.U.uK.value = clamp(cd / 1500, 1, 7);
    FW.U.uR.value = mix(1, 2.2, sS); FW.U.uSm.value = mix(1, 0.5, sS);
    const wd = Z.atmo && Z.atmo.wind; if (wd) FW.U.uWind.value.set(Math.cos(wd.dir) * (wd.speed || 3), Math.sin(wd.dir) * (wd.speed || 3));
    const day = clamp(1 - (Z.nightF || 0) * 1.6, 0, 1); FW.U.uDay.value = day;   // daylight: fatter, denser sparks (see the shader)
    FW.U.uPix.value = 2 / (Z.camera.projectionMatrix.elements[5] * Z.renderer.domElement.height) * mix(1.3, 2.5, sS) * (1 + 0.9 * day);   // spark half-width floor in pixels
    FW.mesh.visible = f > 0.01;
  }
  KS.add('fireworks');

  // =====================================================================================================
  // per frame
  // =====================================================================================================
  let lastT = null;
  const L = { tiger: [], kites: [], ribbon: [], cyclists: [], fireworks: [] };
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
      cyclistsUpdate(L.cyclists, dt, now);
      fireworksUpdate(L.fireworks, dt, now);
      blobs.count = nBlob; blobs.visible = nBlob > 0;
      if (nBlob) { blobs.instanceMatrix.needsUpdate = true; blobOp.needsUpdate = true; }
    },
  };
};
