Z3MOD.terminal = function (Z) {
  // The terminal: one continuous roof (the seven-lobed Hall, the Mall, twelve piers), its glass, jaali screens,
  // gardens, the stepwell forecourt, the other buildings and the aerobridges. World (x east, y south) -> (X, Y up, Z).
  const THREE = Z.THREE, SPEC = Z.SPEC, RF = SPEC.roof || {}, PI = Math.PI, TAU = 2 * PI;
  const group = new THREE.Group(); group.name = 'terminal'; Z.scene.add(group);
  const NEG = -1e9, OV = 7, TH = 1.6;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  let seed = 90210; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const col = h => new THREE.Color(h);
  const safe = (name, fn) => { try { fn(); } catch (e) { console.error('terminal: ' + name, e); } };
  const aniso = Math.min(8, Z.renderer.capabilities.getMaxAnisotropy ? Z.renderer.capabilities.getMaxAnisotropy() : 4);

  // ------------------------------------------------------------ geometry accumulators
  const Acc = () => ({ p: [], n: [], c: [], u: [], g: [], i: [] });
  function V(A, x, y, z, nx, ny, nz, c, u, v, gl) { A.p.push(x, y, z); A.n.push(nx, ny, nz); A.c.push(c.r, c.g, c.b); A.u.push(u, v); A.g.push(gl || 0); return A.p.length / 3 - 1; }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3();
  // flat polygon P = [[X,Y,Z],...] (three-space), facing roughly 'want' if given
  function face(A, P, c, uv, gl, want) {
    _a.set(P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]);
    _b.set(P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]);
    _n.crossVectors(_a, _b); const L = _n.length(); if (L < 1e-9) { if (P.length === 4) { _b.set(P[3][0] - P[0][0], P[3][1] - P[0][1], P[3][2] - P[0][2]); _n.crossVectors(_a, _b); if (_n.length() < 1e-9) return; } else return; }
    _n.normalize();
    const flip = want && (_n.x * want[0] + _n.y * want[1] + _n.z * want[2] < 0);
    if (flip) _n.negate();
    const b = A.p.length / 3;
    for (let k = 0; k < P.length; k++) V(A, P[k][0], P[k][1], P[k][2], _n.x, _n.y, _n.z, c, uv ? uv[k][0] : 0.5, uv ? uv[k][1] : 0.5, gl);
    for (let k = 1; k < P.length - 1; k++) { if (flip) A.i.push(b, b + k + 1, b + k); else A.i.push(b, b + k, b + k + 1); }
  }
  // axis-aligned-in-yaw box: centre (x, y0..y1, z), size sx (along heading) x sz, rotated by yaw (radians, three rotation.y)
  function box(A, x, y0, z, sx, sy, sz, c, yaw, gl, cTop) {
    const cs = Math.cos(yaw || 0), sn = Math.sin(yaw || 0), hx = sx / 2, hz = sz / 2;
    const P = (lx, ly, lz) => [x + lx * cs + lz * sn, y0 + ly, z - lx * sn + lz * cs];
    const q = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
    for (let k = 0; k < 4; k++) { const a = q[k], b = q[(k + 1) % 4]; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; const w = P(mx, 0, mz); face(A, [P(a[0], 0, a[1]), P(b[0], 0, b[1]), P(b[0], sy, b[1]), P(a[0], sy, a[1])], c, null, gl, [w[0] - x, 0, w[2] - z]); }
    face(A, [P(-hx, sy, -hz), P(hx, sy, -hz), P(hx, sy, hz), P(-hx, sy, hz)], cTop || c, null, gl, [0, 1, 0]);
    face(A, [P(-hx, 0, -hz), P(hx, 0, -hz), P(hx, 0, hz), P(-hx, 0, hz)], c, null, gl, [0, -1, 0]);
  }
  // vertical cylinder side (and optional caps): centre x,z, radii r0 (bottom) r1 (top)
  function cyl(A, x, z, y0, y1, r0, r1, n, c, gl, capTop, capBot, cTop) {
    for (let k = 0; k < n; k++) {
      const a0 = TAU * k / n, a1 = TAU * (k + 1) / n, am = (a0 + a1) / 2;
      face(A, [[x + r0 * Math.cos(a0), y0, z + r0 * Math.sin(a0)], [x + r0 * Math.cos(a1), y0, z + r0 * Math.sin(a1)], [x + r1 * Math.cos(a1), y1, z + r1 * Math.sin(a1)], [x + r1 * Math.cos(a0), y1, z + r1 * Math.sin(a0)]],
        c, [[k / n * 4, y0 / 4], [(k + 1) / n * 4, y0 / 4], [(k + 1) / n * 4, y1 / 4], [k / n * 4, y1 / 4]], gl, [Math.cos(am), 0, Math.sin(am)]);
      if (capTop) face(A, [[x, capTop === true ? y1 : capTop, z], [x + r1 * Math.cos(a0), y1, z + r1 * Math.sin(a0)], [x + r1 * Math.cos(a1), y1, z + r1 * Math.sin(a1)]], cTop || c, null, gl, [0, 1, 0]);
      if (capBot) face(A, [[x, y0, z], [x + r0 * Math.cos(a0), y0, z + r0 * Math.sin(a0)], [x + r0 * Math.cos(a1), y0, z + r0 * Math.sin(a1)]], c, null, gl, [0, -1, 0]);
    }
  }
  function toGeo(A) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(A.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(A.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(A.c, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(A.u, 2));
    g.setAttribute('glow', new THREE.Float32BufferAttribute(A.g, 1)); g.setIndex(A.i); g.computeBoundingSphere(); return g;
  }
  // SVG path (M L H V Q C Z, absolute) -> [[x,y],...]
  function pathPts(d) {
    const tk = d.match(/[MLHVQCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) || []; const out = []; let i = 0, cmd = 'M', x = 0, y = 0;
    const num = () => +tk[i++];
    while (i < tk.length) {
      if (/[A-Za-z]/.test(tk[i])) { cmd = tk[i++].toUpperCase(); if (cmd === 'Z') continue; }
      if (cmd === 'M' || cmd === 'L') { x = num(); y = num(); out.push([x, y]); }
      else if (cmd === 'H') { x = num(); out.push([x, y]); }
      else if (cmd === 'V') { y = num(); out.push([x, y]); }
      else if (cmd === 'Q') { const cx = num(), cy = num(), ex = num(), ey = num(); for (let k = 1; k <= 4; k++) { const t = k / 4, u = 1 - t; out.push([u * u * x + 2 * u * t * cx + t * t * ex, u * u * y + 2 * u * t * cy + t * t * ey]); } x = ex; y = ey; }
      else if (cmd === 'C') { const c1x = num(), c1y = num(), c2x = num(), c2y = num(), ex = num(), ey = num(); for (let k = 1; k <= 6; k++) { const t = k / 6, u = 1 - t; out.push([u * u * u * x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex, u * u * u * y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey]); } x = ex; y = ey; }
      else i++;
    }
    if (out.length > 2) { const a = out[0], b = out[out.length - 1]; if (Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01) out.pop(); }
    return out;
  }
  const area2 = pts => { let s = 0; for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };

  // ------------------------------------------------------------ canvas textures
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  function tex(c, rep) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.anisotropy = aniso; return t; }
  // a soft sky for reflections (glass, water, the white roof's sheen)
  const envT = (() => { const [c, x] = canvas(256, 128); const g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#3a6aa2'); g.addColorStop(0.42, '#b9d0e4'); g.addColorStop(0.5, '#e9e4d6'); g.addColorStop(0.53, '#9a8a70'); g.addColorStop(1, '#4a4032');
    x.fillStyle = g; x.fillRect(0, 0, 256, 128); const s = x.createRadialGradient(70, 40, 0, 70, 40, 30); s.addColorStop(0, 'rgba(255,248,230,1)'); s.addColorStop(1, 'rgba(255,248,230,0)'); x.fillStyle = s; x.fillRect(0, 0, 256, 128);
    const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();
  // roof panels: white with faint seams (vertex colour tints it)
  const seamT = (() => { const [c, x] = canvas(256, 256); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 900; k++) { x.fillStyle = `rgba(120,110,90,${0.02 + rnd() * 0.03})`; x.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
    x.fillStyle = 'rgba(105,95,78,0.42)'; x.fillRect(0, 0, 256, 3); x.fillRect(0, 0, 3, 256);
    x.fillStyle = 'rgba(105,95,78,0.16)'; x.fillRect(0, 127, 256, 2); x.fillRect(127, 0, 2, 256);
    return tex(c, true); })();
  // curtain-wall panel (3 m x 4.5 m): blue-grey glass, mullions, transom; and its night emissive twin
  const glassT = (() => { const [c, x] = canvas(64, 96); const g = x.createLinearGradient(0, 0, 0, 96); g.addColorStop(0, '#7f97a8'); g.addColorStop(1, '#4d6474');
    x.fillStyle = g; x.fillRect(0, 0, 64, 96); x.fillStyle = 'rgba(255,255,255,0.10)'; x.beginPath(); x.moveTo(10, 0); x.lineTo(34, 0); x.lineTo(6, 96); x.lineTo(0, 96); x.lineTo(0, 30); x.fill();
    x.fillStyle = '#c9cfd2'; x.fillRect(0, 0, 4, 96); x.fillRect(0, 92, 64, 4); return tex(c, true); })();
  const glassE = (() => { const [c, x] = canvas(64, 96); const g = x.createLinearGradient(0, 0, 0, 96); g.addColorStop(0, '#6a4a28'); g.addColorStop(0.6, '#d29a58'); g.addColorStop(1, '#ffd29a');
    x.fillStyle = g; x.fillRect(0, 0, 64, 96); x.fillStyle = '#000'; x.fillRect(0, 0, 4, 96); x.fillRect(0, 92, 64, 4); return tex(c, true); })();
  // jaali: an abstract branching lattice. Top half 'tree', bottom half the denser 'tree-of-life'. Alpha = stone.
  const jaaliT = (() => {
    const W = 512, [c, x] = canvas(W, 1024);
    function half(y0, dense) {
      x.save(); x.beginPath(); x.rect(0, y0, W, 512); x.clip();
      x.globalCompositeOperation = 'source-over'; x.fillStyle = '#c9a77a'; x.fillRect(0, y0, W, 512);
      for (let k = 0; k < 1400; k++) { x.fillStyle = `rgba(${90 + rnd() * 60},${70 + rnd() * 40},40,${0.06 + rnd() * 0.08})`; x.fillRect(rnd() * W, y0 + rnd() * 512, 3, 3); }
      // perforation lattice (diamonds)
      x.globalCompositeOperation = 'destination-out'; const P = dense ? 22 : 30, hs = dense ? 7.5 : 10.5;
      for (let j = 0; j * P < 512 + P; j++) for (let i = 0; i * P < W + P; i++) {
        const cx = i * P + (j % 2 ? P / 2 : 0), cy = y0 + j * P; x.beginPath(); x.moveTo(cx, cy - hs); x.lineTo(cx + hs, cy); x.lineTo(cx, cy + hs); x.lineTo(cx - hs, cy); x.fill(); }
      // the branching tree drawn back in stone
      x.globalCompositeOperation = 'source-over'; x.strokeStyle = '#c4a174'; x.lineCap = 'round';
      function br(px, py, ang, len, w, depth) {
        if (depth <= 0 || len < 6) return; const ex = px + Math.cos(ang) * len, ey = py + Math.sin(ang) * len;
        x.lineWidth = w; x.beginPath(); x.moveTo(px, py);
        if (dense) x.quadraticCurveTo(px + Math.cos(ang + 0.35) * len * 0.6, py + Math.sin(ang + 0.35) * len * 0.6, ex, ey); else x.lineTo(ex, ey);
        x.stroke();
        const n = dense ? 3 : 2, spread = dense ? 0.62 : 0.5;
        for (let k = 0; k < n; k++) { const a = ang + (k - (n - 1) / 2) * spread * 1.4 + (rnd() - 0.5) * 0.2; br(ex, ey, a, len * (dense ? 0.7 : 0.72), w * 0.68, depth - 1); }
        if (dense && depth < 3) { x.save(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.ellipse(ex, ey, 5, 9, ang, 0, TAU); x.fill(); x.restore(); }
      }
      br(W / 2, y0 + 500, -PI / 2, dense ? 120 : 140, dense ? 26 : 22, dense ? 6 : 5);
      if (dense) { br(W / 2, y0 + 500, -PI / 2 - 0.9, 90, 14, 4); br(W / 2, y0 + 500, -PI / 2 + 0.9, 90, 14, 4); }
      // frame: posts at the tile edges, sill and head bands
      x.fillStyle = '#bf9c6e'; x.fillRect(0, y0, 14, 512); x.fillRect(W - 14, y0, 14, 512); x.fillRect(0, y0, W, 18); x.fillRect(0, y0 + 494, W, 18);
      x.restore();
    }
    half(0, false); half(512, true);
    const t = tex(c, false); t.wrapS = THREE.RepeatWrapping; return t;
  })();

  // ------------------------------------------------------------ materials
  function glowify(m, key) {
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlow;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vGlow;');
    };
    m.customProgramCacheKey = () => key; return m;
  }
  const M = {
    solid: glowify(new THREE.MeshStandardMaterial({ vertexColors: true, map: seamT, roughness: 0.6, metalness: 0, envMap: envT, envMapIntensity: 0.45, emissive: col('#ffb56e'), emissiveIntensity: 0 }), 'zmhSolid'),
    glass: new THREE.MeshStandardMaterial({ map: glassT, emissiveMap: glassE, emissive: col('#ffffff'), emissiveIntensity: 0, roughness: 0.12, metalness: 0.5, envMap: envT, envMapIntensity: 1.1, side: THREE.DoubleSide }),
    tglass: new THREE.MeshStandardMaterial({ color: col('#a9cbd9'), transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.4, envMap: envT, envMapIntensity: 1.3, depthWrite: false, emissive: col('#ffd59a'), emissiveIntensity: 0 }),
    jaali: new THREE.MeshStandardMaterial({ map: jaaliT, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, metalness: 0 }),
    tree: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }),
    pool: new THREE.MeshStandardMaterial({ color: col('#2c6a66'), roughness: 0.06, metalness: 0.55, envMap: envT, envMapIntensity: 1.3, emissive: col('#39b3a6'), emissiveIntensity: 0 }),
    coffer: new THREE.MeshStandardMaterial({ color: col('#6f8c99'), roughness: 0.14, metalness: 0.55, envMap: envT, envMapIntensity: 1.2, emissive: col('#ffc27a'), emissiveIntensity: 0 }),
    lens: new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.25, metalness: 0.1, envMap: envT, envMapIntensity: 0.6, emissive: col('#ffffff'), emissiveIntensity: 0 }),
    bridge: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35, envMap: envT, envMapIntensity: 0.7 }),
  };
  M.solid.shadowSide = THREE.DoubleSide;
  M.lens.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance *= vColor.rgb * 1.6;\n#endif'); };
  M.lens.customProgramCacheKey = () => 'zmhLens';
  M.coffer.onBeforeCompile = M.lens.onBeforeCompile; M.coffer.customProgramCacheKey = () => 'zmhLens';

  const CL = { roof: col('#efe8da'), roofEdge: col('#d9d0bf'), bamboo: col('#c39a63'), stone: col('#c9a77a'), stoneL: col('#dcc39b'), stoneD: col('#a5835a'),
    terrace: col('#d2b98f'), green: col('#5f8f3e'), green2: col('#4f7d34'), green3: col('#76a04a'), conc: col('#d6d2c8'), conc2: col('#bdb8ad'), white: col('#f2f0ea'),
    dark: col('#3a3f44'), red: col('#b4382c'), steel: col('#9ea6ad'), solar: col('#283a5a'), gold: col('#d8b46a') };

  // ------------------------------------------------------------ the roof's shape (reusing gen_airport.py's formulas)
  const HCX = -2380, HCY = 0, HRX = 440, HRY = 490;
  const hallR = t => (1 + 0.10 * Math.cos(7 * t)) * HRX * HRY / Math.hypot(HRY * Math.cos(t), HRX * Math.sin(t));
  const angd = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const hallOv = t => OV + 33 * sstep(0.92, 0.62, Math.abs(angd(t, PI)));     // Mumbai's 40 m cantilever over the forecourt kerb
  function hallRaw(x, y) {
    const dx = x - HCX, dy = y - HCY, r = Math.hypot(dx, dy), t = Math.atan2(dy, dx), R = hallR(t);
    if (r > R + hallOv(t) + 1) return NEG;
    const s = Math.min(r / R, 1), vl = (1 - Math.cos(7 * t)) / 2;
    let h = 24 + 22 * (1 - Math.pow(s, 1.6)) - Math.pow(vl, 1.5) * (2 + 4.5 * s);       // 46 m at the oculus rim, 24 m at the lobe tips, valleys lower
    if (r > R) h -= (r - R) * 0.07;
    if (x > -1995) h -= (x + 1995) * 0.45;                                // the east lobe dives into the garden valley
    return h;
  }
  const MX0 = -1900, MX1 = 300, MXS = -1975, MXE = MX1 + OV;
  const mallHW = x => 120 + 26 * Math.cos((x + 1440) / 320 * TAU);
  function mallRaw(x, y) {
    if (x < -2015 || x > MXE + 1) return NEG;
    const xx = Math.min(x, MX1), hw = mallHW(xx), ay = Math.abs(y); if (ay > hw + OV + 1) return NEG;
    let crown = 31 - 5 * (xx - MX0) / (MX1 - MX0) + 2.5 * Math.max(0, Math.cos((xx + 1440) / 320 * TAU));
    if (x < MX0) crown -= (MX0 - x) * 0.1; if (x < MXS) crown -= (MXS - x) * 0.8;
    const eave = 16, s = ay / hw;
    return s <= 1 ? eave + (crown - eave) * (1 - s * s) : eave - Math.min(2 * (crown - eave) / hw, 0.25) * (ay - hw);
  }
  const piers = (SPEC.concourses || []).map(c => {
    const sgn = c.tip > 0 ? 1 : -1, tip = Math.abs(c.tip), cx = c.apm[0], ri = (RF.ids || []).indexOf('PIER-' + c.id);
    const ds = ri >= 0 ? RF.centrelines[ri].map(p => Math.abs(p[1])) : [120, tip - 10], hh = ri >= 0 ? RF.heights[ri] : [27, 21];
    return { id: c.id, c, cx, sgn, tip, dE: tip - 28, dEnd: tip + 14, ds, hh };
  });
  const pierById = {}; piers.forEach(P => (pierById[P.id] = P));
  function pierHW(P, d) {
    const tip = P.tip;
    if (d >= P.dE) return 35 * Math.sqrt(Math.max(0, 1 - ((d - P.dE) / 42) ** 2));
    if (d > tip - 70) { const u = (d - (tip - 70)) / 70; return 26 + 9 * Math.sin(Math.min(1, u * 1.6) * PI / 2); }
    if (d < 208) { const k = Math.min(1, Math.max(0, 1 - (d - 130) / 78)); return 26 + 49 * k * k; }
    return 26;
  }
  const pierRoofHW = (P, d) => (d <= P.dE ? pierHW(P, d) + OV : (35 + OV) * Math.sqrt(Math.max(0, 1 - ((d - P.dE) / (42 + OV)) ** 2)));
  function pierCrown(P, d) { const ds = P.ds, hh = P.hh; if (d <= ds[0]) return hh[0]; for (let i = 1; i < ds.length; i++) if (d <= ds[i]) return hh[i - 1] + (hh[i] - hh[i - 1]) * (d - ds[i - 1]) / (ds[i] - ds[i - 1]); return hh[hh.length - 1]; }
  function pierRaw(P, x, y) {
    const d = y * P.sgn, lat = x - P.cx, al = Math.abs(lat); if (d < 55 || d > P.dEnd + OV + 1 || al > 84) return NEG;
    if (al > pierRoofHW(P, d) + 1) return NEG;
    let q, hw; if (d <= P.dE) { hw = pierHW(P, d); q = al / hw; } else { hw = 35; q = Math.hypot(lat / 35, (d - P.dE) / 42); }
    const crown = pierCrown(P, d), eave = 15;
    return q <= 1 ? eave + (crown - eave) * (1 - q * q) : eave - Math.min(2 * (crown - eave) / hw, 0.3) * (q - 1) * hw;
  }
  const insHall = (x, y, m) => { const dx = x - HCX, dy = y - HCY, t = Math.atan2(dy, dx); return Math.hypot(dx, dy) < hallR(t) + hallOv(t) - m; };
  const insMall = (x, y, m) => x > MXS + m && x < MXE - m && Math.abs(y) < mallHW(Math.min(x, MX1)) + OV - m;
  const insPier = (P, x, y, m) => { const d = y * P.sgn; return d > 60 + m && d < P.dEnd + OV - m && Math.abs(x - P.cx) < pierRoofHW(P, d) - m; };
  const PCS = [{ raw: hallRaw, ins: insHall }, { raw: mallRaw, ins: insMall }].concat(piers.map(P => ({ raw: (x, y) => pierRaw(P, x, y), ins: (x, y, m) => insPier(P, x, y, m), P })));
  function smax(a, b) { if (a === NEG) return b; if (b === NEG) return a; const k = 4, h = Math.max(k - Math.abs(a - b), 0); return Math.max(a, b) + h * h / (4 * k); }
  function H(x, y) {
    let v = hallRaw(x, y); v = smax(v, mallRaw(x, y));
    if (Math.abs(y) > 50) for (const P of piers) if (Math.abs(x - P.cx) < 90) v = smax(v, pierRaw(P, x, y));
    if (v === NEG) return NEG;
    const ay = Math.abs(y);
    if (ay < 150 && x > -2030 && x < -1830) v -= 7 * Math.exp(-(((x + 1930) / 32) ** 2)) * (ay < 105 ? 1 : Math.max(0, 1 - (ay - 105) / 45));   // the garden valley
    return v;
  }
  // holes: the oculus, the garden valley ('belt') and the two open courts at every pier root
  const GARD = RF.gardens || [];
  const courts = GARD.filter(g => g.kind === 'court');
  const BELT = { x0: -1958, x1: -1895, vf: 4 / 7 };
  const inBelt = (x, y) => x > BELT.x0 && x < BELT.x1 && Math.abs(y) < BELT.vf * (mallHW(x) + OV);
  function isHole(x, y) {
    if (inBelt(x, y)) return true;
    const dx = x - HCX, dy = y - HCY; if (dx * dx + dy * dy < 48 * 48) return true;
    if (Math.abs(Math.abs(y) - 168) < 15) for (const c of courts) if ((x - c.x) ** 2 + (y - c.y) ** 2 < c.r * c.r) return true;
    return false;
  }

  // ------------------------------------------------------------ build: roof shell
  const SA = Acc();          // solid, vertex-coloured: roof, buildings, forecourt, garden ground
  const GA = Acc();          // opaque curtain-wall glass
  const TA = Acc();          // transparent glass (dome, tower cab)
  const JA = Acc();          // jaali
  const WA = Acc();          // water
  function grid(ip, NI, NJ, periodic, XY, UVF, CF) {
    const nx = NI + 1, ny = NJ + 1, N = nx * ny;
    const X = new Float64Array(N), Y = new Float64Array(N), Hh = new Float64Array(N), NX = new Float32Array(N), NZ = new Float32Array(N);
    const raw = PCS[ip].raw;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const k = i * ny + j, p = XY(i, j); X[k] = p[0]; Y[k] = p[1];
      let h = H(p[0], p[1]); if (h === NEG) h = raw(p[0], p[1]); if (h === NEG) h = 15; Hh[k] = h;
      const e = 1.2; let hx1 = H(p[0] + e, p[1]), hx0 = H(p[0] - e, p[1]), hz1 = H(p[0], p[1] + e), hz0 = H(p[0], p[1] - e);
      if (hx1 === NEG) hx1 = h; if (hx0 === NEG) hx0 = h; if (hz1 === NEG) hz1 = h; if (hz0 === NEG) hz0 = h;
      NX[k] = -(hx1 - hx0) / (2 * e); NZ[k] = -(hz1 - hz0) / (2 * e);
    }
    const node = (i, j) => i * ny + j;
    const st = new Uint8Array(NI * NJ);   // 0 keep, 1 hole/outside, 2 covered by another piece
    for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) {
      const a = node(i, j), b = node(i + 1, j), c = node(i + 1, j + 1), d = node(i, j + 1);
      const cx = (X[a] + X[b] + X[c] + X[d]) / 4, cy = (Y[a] + Y[b] + Y[c] + Y[d]) / 4;
      if (ip === 0 && cx > -2000 && insMall(X[a], Y[a], 0) && insMall(X[b], Y[b], 0) && insMall(X[c], Y[c], 0) && insMall(X[d], Y[d], 0)) { st[i * NJ + j] = 2; continue; }
      if (isHole(cx, cy)) { st[i * NJ + j] = 1; continue; }
      const ra = raw(cx, cy); if (ra === NEG) { st[i * NJ + j] = 1; continue; }
      for (let q = 0; q < PCS.length; q++) { if (q === ip || (ip === 1 && q === 0)) continue; const B = PCS[q]; if (B.P && Math.abs(cx - B.P.cx) > 95) continue; if (!B.ins(cx, cy, 5)) continue; if (B.raw(cx, cy) > ra + 0.3) { st[i * NJ + j] = 2; break; } }
    }
    const S = (i, j) => { if (j < 0 || j >= NJ) return 1; if (periodic) i = ((i % NI) + NI) % NI; else if (i < 0 || i >= NI) return 1; return st[i * NJ + j]; };
    // soffit only where it can be seen: within three cells of an edge or a hole
    const near = new Uint8Array(NI * NJ);
    for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) { if (st[i * NJ + j] !== 0) continue; let f = 0; for (let di = -3; di <= 3 && !f; di++) for (let dj = -3; dj <= 3; dj++) if (S(i + di, j + dj) === 1) { f = 1; break; } near[i * NJ + j] = f; }
    // vertices: top and soffit
    const tb = SA.p.length / 3; const tmpN = new THREE.Vector3();
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const k = i * ny + j; tmpN.set(NX[k], 1, NZ[k]).normalize(); const uv = UVF ? UVF(i, j, X[k], Y[k]) : [X[k] / 18, Y[k] / 18]; V(SA, X[k], Hh[k], Y[k], tmpN.x, tmpN.y, tmpN.z, CF ? CF(X[k], Y[k]) : CL.roof, uv[0], uv[1], 0.025); }
    const ub = SA.p.length / 3;
    for (let k = 0; k < N; k++) { tmpN.set(NX[k], 1, NZ[k]).normalize(); V(SA, X[k], Hh[k] - TH, Y[k], -tmpN.x, -tmpN.y, -tmpN.z, CL.bamboo, X[k] / 3, Y[k] / 30, 0.55); }
    for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) {
      if (st[i * NJ + j] !== 0) continue;
      const a = node(i, j), b = node(i + 1, j), c = node(i + 1, j + 1), d = node(i, j + 1);
      // orientation: top must face up
      const ux = X[b] - X[a], uz = Y[b] - Y[a], vx = X[c] - X[a], vz = Y[c] - Y[a]; let up = (uz * vx - ux * vz) > 0;
      if (Math.abs(uz * vx - ux * vz) < 1e-9) { const wx = X[d] - X[a], wz = Y[d] - Y[a]; up = (vz * wx - vx * wz) > 0; }
      if (up) { SA.i.push(tb + a, tb + b, tb + c, tb + a, tb + c, tb + d); if (near[i * NJ + j]) SA.i.push(ub + a, ub + c, ub + b, ub + a, ub + d, ub + c); }
      else { SA.i.push(tb + a, tb + c, tb + b, tb + a, tb + d, tb + c); if (near[i * NJ + j]) SA.i.push(ub + a, ub + b, ub + c, ub + a, ub + c, ub + d); }
      // fascia on edges facing a hole or the outside
      const cxm = (X[a] + X[b] + X[c] + X[d]) / 4, cym = (Y[a] + Y[b] + Y[c] + Y[d]) / 4;
      const edges = [[a, b, i, j - 1], [b, c, i + 1, j], [c, d, i, j + 1], [d, a, i - 1, j]];
      for (const [p, q, ni, nj] of edges) {
        if (S(ni, nj) !== 1) continue;
        if (Math.hypot(X[q] - X[p], Y[q] - Y[p]) < 0.05) continue;
        const mx = (X[p] + X[q]) / 2, my = (Y[p] + Y[q]) / 2;
        face(SA, [[X[p], Hh[p], Y[p]], [X[q], Hh[q], Y[q]], [X[q], Hh[q] - TH, Y[q]], [X[p], Hh[p] - TH, Y[p]]], CL.roofEdge, null, 0.7, [mx - cxm, 0, my - cym]);
      }
    }
  }
  safe('roof', () => {
    // Hall: polar grid from the oculus rim to the roof edge (overhang, cantilever on the west)
    const NI = 252, NJ = 30;
    const cTmp = new THREE.Color(), cGut = col('#c9bca4');
    grid(0, NI, NJ, true, (i, j) => { const t = TAU * i / NI, Re = hallR(t) + hallOv(t), r = 48 + (Re - 48) * j / NJ; return [HCX + r * Math.cos(t), HCY + r * Math.sin(t)]; },
      (i, j, x, y) => [i / NI * 84, Math.hypot(x - HCX, y - HCY) / 16],
      (x, y) => { const t = Math.atan2(y - HCY, x - HCX), vl = (1 - Math.cos(7 * t)) / 2; return cTmp.copy(CL.roof).lerp(cGut, Math.pow(vl, 6) * 0.9); });
    // Mall: x rows (exact rows at the garden valley's edges), vault across
    const xs = [MXS, (MXS + BELT.x0) / 2]; for (let k = 0; k <= 9; k++) xs.push(BELT.x0 + 7 * k); const n2 = 276; for (let k = 1; k <= n2; k++) xs.push(BELT.x1 + (MXE - BELT.x1) * k / n2);
    const NJm = 28;
    grid(1, xs.length - 1, NJm, false, (i, j) => { const x = xs[i], hw = mallHW(Math.min(x, MX1)) + OV; return [x, (-1 + 2 * j / NJm) * hw]; });
    // piers
    piers.forEach((P, k) => {
      const d0 = 60, d1 = P.dEnd + OV, NIp = Math.ceil((d1 - d0) / 6), NJp = 16;
      grid(2 + k, NIp, NJp, false, (i, j) => { const d = d0 + (d1 - d0) * Math.pow(i / NIp, 1), hw = pierRoofHW(P, d); return [P.cx + (-1 + 2 * j / NJp) * hw, P.sgn * d]; });
    });
  });

  // ------------------------------------------------------------ oculus: glass dome over the garden
  const hallTop = H(HCX + 48, HCY); let rimMax = -1, rimMin = 99;
  for (let k = 0; k < 64; k++) { const t = TAU * k / 64, h = H(HCX + 48.5 * Math.cos(t), HCY + 48.5 * Math.sin(t)); rimMax = Math.max(rimMax, h); rimMin = Math.min(rimMin, h); }
  safe('oculus', () => {
    const rise = 13, Rs = (48 * 48 + rise * rise) / (2 * rise), th = Math.asin(48 / Rs), base = rimMax + 0.6, cy = base + rise - Rs;
    const NA = 48, NB = 10;
    for (let a = 0; a < NA; a++) for (let b = 0; b < NB; b++) {
      const P = (ai, bi) => { const ph = TAU * ai / NA, tt = th * bi / NB; return [HCX + Rs * Math.sin(tt) * Math.cos(ph), cy + Rs * Math.cos(tt), HCY + Rs * Math.sin(tt) * Math.sin(ph)]; };
      const p0 = P(a, b + 1), p1 = P(a + 1, b + 1), p2 = P(a + 1, b), p3 = P(a, b);
      const mx = (p0[0] + p1[0] + p2[0]) / 3 - HCX, my = (p0[1] + p1[1] + p2[1]) / 3 - cy, mz = (p0[2] + p1[2] + p2[2]) / 3 - HCY;
      if (b === 0) face(TA, [P(a, 1), P(a + 1, 1), P(a, 0)], col('#ffffff'), null, 0, [mx, my, mz]); else face(TA, [p0, p1, p2, p3], col('#ffffff'), null, 0, [mx, my, mz]);
    }
    // ribs and the rim curb
    const R2 = Rs + 0.25;
    for (let a = 0; a < 16; a++) { const ph = TAU * a / 16, cs = Math.cos(ph), sn = Math.sin(ph);
      for (let b = 0; b < NB; b++) { const t0 = th * b / NB, t1 = th * (b + 1) / NB, w = 0.5;
        const P = (tt, s) => [HCX + R2 * Math.sin(tt) * cs - s * sn * w, cy + R2 * Math.cos(tt), HCY + R2 * Math.sin(tt) * sn + s * cs * w];
        face(SA, [P(t1, -1), P(t1, 1), P(t0, 1), P(t0, -1)], CL.white, null, 0.2, [Math.sin(t0) * cs, Math.cos(t0), Math.sin(t0) * sn]); } }
    cyl(SA, HCX, HCY, rimMin - TH, base + 0.4, 48.6, 48.6, 48, CL.roofEdge, 0, false, false);
    cyl(SA, HCX, HCY, rimMin - TH, base + 0.4, 47.8, 47.8, 48, CL.bamboo, 0.4, false, false);
    for (let k = 0; k < 48; k++) { const a0 = TAU * k / 48, a1 = TAU * (k + 1) / 48; face(SA, [[HCX + 47.8 * Math.cos(a0), base + 0.4, HCY + 47.8 * Math.sin(a0)], [HCX + 48.6 * Math.cos(a0), base + 0.4, HCY + 48.6 * Math.sin(a0)], [HCX + 48.6 * Math.cos(a1), base + 0.4, HCY + 48.6 * Math.sin(a1)], [HCX + 47.8 * Math.cos(a1), base + 0.4, HCY + 47.8 * Math.sin(a1)]], CL.white, null, 0, [0, 1, 0]); }
  });

  // ------------------------------------------------------------ glass curtain walls
  function wallRun(pts, hint, skip) {
    let s = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const p0 = pts[k], p1 = pts[k + 1], len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); if (len < 0.01) continue;
      const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
      if (skip && skip(mx, my)) { s += len; continue; }
      const h0 = H(p0[0], p0[1]), h1 = H(p1[0], p1[1]); if (h0 === NEG || h1 === NEG) { s += len; continue; }
      const t0 = h0 - TH - 0.05, t1 = h1 - TH - 0.05, w = hint(mx, my);
      face(GA, [[p0[0], 0.2, p0[1]], [p1[0], 0.2, p1[1]], [p1[0], t1, p1[1]], [p0[0], t0, p0[1]]], CL.white, [[s / 3, 0], [(s + len) / 3, 0], [(s + len) / 3, t1 / 4.5], [s / 3, t0 / 4.5]], 0, [w[0], 0, w[1]]);
      s += len;
    }
  }
  const inPierWall = (x, y, m) => { for (const P of piers) { const d = y * P.sgn; if (d < 60 || d > P.dEnd || Math.abs(x - P.cx) > 90) continue; if (Math.abs(x - P.cx) < pierHW(P, d) - (m || 0)) return true; } return false; };
  const inCourt = (x, y, m) => { for (const c of courts) if ((x - c.x) ** 2 + (y - c.y) ** 2 < (c.r + (m || 0)) ** 2) return true; return false; };
  safe('walls', () => {
    // Hall perimeter, from the north side of the garden valley round the west to its south side
    let tc = 0; for (let t = 0; t < 1; t += 0.0005) { if (HCX + hallR(t) * Math.cos(t) < -1968) { tc = t; break; } }
    const hp = []; const NW = 900; for (let k = 0; k <= NW; k++) { const t = tc + (TAU - 2 * tc) * k / NW, R = hallR(t); hp.push([HCX + R * Math.cos(t), HCY + R * Math.sin(t)]); }
    wallRun(hp, (x, y) => [x - HCX, y - HCY]);
    const yh = hallR(tc) * Math.sin(tc), ym = mallHW(-1968);
    wallRun([[-1968, yh], [-1968, ym]], () => [-1, 0]); wallRun([[-1968, -yh], [-1968, -ym]], () => [-1, 0]);
    // Mall long walls and the east gable
    for (const sg of [-1, 1]) { const mp = []; for (let x = -1968; x <= MX1 + 0.01; x += 4) mp.push([x, sg * mallHW(x)]); wallRun(mp, () => [0, sg], (x, y) => inPierWall(x, y, -0.5) || inCourt(x, y)); }
    const gp = []; for (let y = -mallHW(MX1); y <= mallHW(MX1) + 0.01; y += 6) gp.push([MX1, y]); wallRun(gp, () => [1, 0]);
    // the garden valley's courtyard walls
    const bl = []; const yb = x => BELT.vf * (mallHW(x) + OV);
    for (let x = BELT.x0; x <= BELT.x1 + 0.01; x += 5) bl.push([x, -yb(x)]); for (let y = -yb(BELT.x1); y <= yb(BELT.x1) + 0.01; y += 6) bl.push([BELT.x1, y]);
    for (let x = BELT.x1; x >= BELT.x0 - 0.01; x -= 5) bl.push([x, yb(x)]); for (let y = yb(BELT.x0); y >= -yb(BELT.x0) - 0.01; y -= 6) bl.push([BELT.x0, y]);
    wallRun(bl, (x, y) => [-1930 - x, -y]);
    // piers: west face out to the tip lounge and back down the east face
    for (const P of piers) {
      const pp = []; for (let d = 60; d <= P.dEnd; d += 4) pp.push([P.cx - pierHW(P, d), P.sgn * d]); pp.push([P.cx, P.sgn * P.dEnd]);
      for (let d = Math.floor(P.dEnd / 4) * 4; d >= 60; d -= 4) pp.push([P.cx + pierHW(P, d), P.sgn * d]);
      wallRun(pp, (x, y) => { const d = y * P.sgn; return [x - P.cx, d > P.dE ? P.sgn * (d - P.dE) * 0.9 : 0]; }, (x, y) => Math.abs(y) < mallHW(x) || inCourt(x, y));
    }
    // court walls (glass drums cut into the pier roots)
    for (const c of courts) { const cp = []; for (let k = 0; k <= 28; k++) { const a = TAU * k / 28; cp.push([c.x + c.r * Math.cos(a), c.y + c.r * Math.sin(a)]); }
      wallRun(cp, (x, y) => [c.x - x, c.y - y], (x, y) => !(inPierWall(x, y) && Math.abs(y) > mallHW(x))); }
  });

  // ------------------------------------------------------------ bridges: static rotundas (dynamic walkways later)
  const BR = [];
  safe('bridge-setup', () => {
    for (const g of Z.GATES) {
      if (!g.bridge || g.remote || !pierById[g.conc]) continue;
      const P = pierById[g.conc], fs = Math.sign(g.x - P.cx) || 1, d = Math.abs(g.y), faceX = P.cx + fs * pierHW(P, d);
      const lx = Math.sin(g.a), ly = -Math.cos(g.a);
      const rx = faceX + fs * 6, ry = g.y + ly * 14 + lx * 0;
      BR.push({ g, P, fs, faceX, lx, ly, rx, ry, e: -1, dx: rx + fs * 14, dy: g.y + ly * 2 });
    }
  });

  // ------------------------------------------------------------ jaali screens
  safe('jaali', () => {
    for (const J of RF.jaali || []) {
      const v0 = J.pattern === 'tree-of-life' ? 0.0 : 0.5, pts = [];
      for (let k = 0; k < J.pts.length - 1; k++) { const a = J.pts[k], b = J.pts[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 3)); for (let m = 0; m < n; m++) pts.push([a[0] + (b[0] - a[0]) * m / n, a[1] + (b[1] - a[1]) * m / n]); }
      pts.push(J.pts[J.pts.length - 1]);
      let s = 0;
      for (let k = 0; k < pts.length - 1; k++) {
        const p0 = pts[k], p1 = pts[k + 1], len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); if (len < 0.01) continue;
        const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
        let gap = false; for (const b of BR) if (Math.abs(b.ry - my) < 4.5 && Math.abs(b.rx - mx) < 9) { gap = true; break; }
        const h0 = H(p0[0], p0[1]), h1 = H(p1[0], p1[1]);
        if (gap || h0 === NEG || h1 === NEG) { s += len; continue; }
        const t0 = Math.min(h0 - TH - 0.8, 20), t1 = Math.min(h1 - TH - 0.8, 20), hgt = (t0 + t1) / 2;
        face(JA, [[p0[0], 0.3, p0[1]], [p1[0], 0.3, p1[1]], [p1[0], t1, p1[1]], [p0[0], t0, p0[1]]], CL.white, [[s / hgt, v0], [(s + len) / hgt, v0], [(s + len) / hgt, v0 + 0.5], [s / hgt, v0 + 0.5]], 0, null);
        s += len;
      }
    }
  });

  // ------------------------------------------------------------ gardens (ground) and trees
  const TREES = [];   // [x, y, ground, scale, hue]
  const addTree = (x, y, h0, s) => TREES.push([x, y, h0 || 0, s || (0.75 + rnd() * 0.6), rnd()]);
  function disc(A, x, y, r, h, c, n) { for (let k = 0; k < n; k++) { const a0 = TAU * k / n, a1 = TAU * (k + 1) / n; face(A, [[x, h, y], [x + r * Math.cos(a0), h, y + r * Math.sin(a0)], [x + r * Math.cos(a1), h, y + r * Math.sin(a1)]], c, null, 0, [0, 1, 0]); } }
  safe('gardens', () => {
    for (const G of GARD) {
      if (G.kind === 'oculus') {
        disc(SA, G.x, G.y, G.r, 0.35, CL.green, 40);
        disc(SA, G.x, G.y, 9, 0.45, CL.stoneL, 24); disc(SA, G.x, G.y, 2.2, 0.5, CL.gold, 12);       // the unity inlay
        cyl(SA, G.x, G.y, 0.45, 4.2, 0.9, 0.7, 8, CL.stone, 0.3, true, false);                         // the Zero Mile pillar
        for (let k = 0; k < 26; k++) { const a = rnd() * TAU, r = 14 + rnd() * 44; addTree(G.x + r * Math.cos(a), G.y + r * Math.sin(a), 0.35, 0.9 + rnd() * 0.7); }
      } else if (G.kind === 'valley') {
        disc(SA, G.x, G.y, G.r, 0.35, CL.green2, 24);
        for (let k = 0; k < 5; k++) { const a = rnd() * TAU, r = rnd() * G.r * 0.8; addTree(G.x + r * Math.cos(a), G.y + r * Math.sin(a), 0.35); }
      } else if (G.kind === 'belt') {
        const x0 = G.x - G.w / 2, x1 = G.x + G.w / 2, y0 = G.y - G.l / 2, y1 = G.y + G.l / 2;
        face(SA, [[x0, 0.35, y0], [x1, 0.35, y0], [x1, 0.35, y1], [x0, 0.35, y1]], CL.green3, null, 0, [0, 1, 0]);
        // a meandering path down the valley
        for (let k = 0; k < 24; k++) { const ya = y0 + (y1 - y0) * k / 24, yb2 = y0 + (y1 - y0) * (k + 1) / 24, xa = G.x + 10 * Math.sin(ya / 25), xb = G.x + 10 * Math.sin(yb2 / 25);
          face(SA, [[xa - 2.5, 0.4, ya], [xa + 2.5, 0.4, ya], [xb + 2.5, 0.4, yb2], [xb - 2.5, 0.4, yb2]], CL.stoneL, null, 0, [0, 1, 0]); }
        for (let k = 0; k < 160; k++) { const y = y0 + 4 + rnd() * (G.l - 8), x = x0 + 4 + rnd() * (G.w - 8); if (Math.abs(x - (G.x + 10 * Math.sin(y / 25))) < 5) continue;
          const inCourtyard = x > BELT.x0 + 4 && x < BELT.x1 - 4 && Math.abs(y) < BELT.vf * (mallHW(x) + OV) - 4, outside = Math.abs(y) > mallHW(x) + OV + 5 && !insHall(x, y, -5);
          if (inCourtyard || outside) addTree(x, y, 0.35, 0.8 + rnd() * 0.8); }
      } else if (G.kind === 'court') {
        disc(SA, G.x, G.y, G.r, 0.35, CL.green, 20);
        for (let k = 0; k < 3; k++) { const a = TAU * k / 3 + rnd(), r = 4 + rnd() * 4; addTree(G.x + r * Math.cos(a), G.y + r * Math.sin(a), 0.35, 0.8 + rnd() * 0.4); }
      }
    }
  });

  // ------------------------------------------------------------ stepwell forecourt
  safe('forecourt', () => {
    const F = SPEC.forecourt; if (!F) return;
    const cx = (F.x0 + F.x1) / 2, cy = (F.y0 + F.y1) / 2, HX = (F.x1 - F.x0) / 2, HY = (F.y1 - F.y0) / 2;
    const pool = F.pool || { x: cx, y: cy, w: 70, l: 140 }, px = pool.w / 2, py = pool.l / 2, lv = F.levels || [0, -2.4, -4.8, -7.2, -9.6];
    const nB = lv.length - 1, run = 7, bot = 9, tx = (HX - px - nB * run - bot) / (nB - 1), ty = (HY - py - nB * run - bot) / (nB - 1);
    const ring = (o, i, h, c, gl) => { // flat ring between outer half-size o=[hx,hy] and inner i
      const Q = (a, b) => [[cx + a[0], h, cy + a[1]], [cx + b[0], h, cy + b[1]]];
      const os = [[-o[0], -o[1]], [o[0], -o[1]], [o[0], o[1]], [-o[0], o[1]]], is = [[-i[0], -i[1]], [i[0], -i[1]], [i[0], i[1]], [-i[0], i[1]]];
      for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; face(SA, [[cx + os[k][0], h, cy + os[k][1]], [cx + os[k2][0], h, cy + os[k2][1]], [cx + is[k2][0], h, cy + is[k2][1]], [cx + is[k][0], h, cy + is[k][1]]], c, [[(cx + os[k][0]) / 6, (cy + os[k][1]) / 6], [(cx + os[k2][0]) / 6, (cy + os[k2][1]) / 6], [(cx + is[k2][0]) / 6, (cy + is[k2][1]) / 6], [(cx + is[k][0]) / 6, (cy + is[k][1]) / 6]], gl || 0, [0, 1, 0]); }
      void Q;
    };
    const riser = (r, h0, h1, c, gl, inward) => { const os = [[-r[0], -r[1]], [r[0], -r[1]], [r[0], r[1]], [-r[0], r[1]]];
      for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4, mx = (os[k][0] + os[k2][0]) / 2, my = (os[k][1] + os[k2][1]) / 2;
        face(SA, [[cx + os[k][0], h0, cy + os[k][1]], [cx + os[k2][0], h0, cy + os[k2][1]], [cx + os[k2][0], h1, cy + os[k2][1]], [cx + os[k][0], h1, cy + os[k][1]]], c, null, gl || 0, inward === false ? [mx, 0, my] : [-mx, 0, -my]); } };
    let o = [HX, HY];
    riser(o, 0.25, -0.3, CL.stoneD, 0, true);
    const NS = 8;
    for (let b = 0; b < nB; b++) {
      const top = lv[b], drop = lv[b] - lv[b + 1], inr = [o[0] - run, o[1] - run * 1.1];
      for (let s = 0; s < NS; s++) {
        const a = [o[0] + (inr[0] - o[0]) * s / NS, o[1] + (inr[1] - o[1]) * s / NS], c2 = [o[0] + (inr[0] - o[0]) * (s + 1) / NS, o[1] + (inr[1] - o[1]) * (s + 1) / NS];
        const h = top - drop * s / NS - 0.3, h2 = top - drop * (s + 1) / NS - 0.3;
        ring(a, c2, h, s % 2 ? CL.stoneL : CL.stone, 0);
        riser(c2, h, h2, s % 2 ? CL.stoneD : CL.stone, s === NS - 1 ? 0.25 : 0.06, true);
      }
      const inner = b < nB - 1 ? [inr[0] - tx, inr[1] - ty] : [px, py];
      ring(inr, inner, lv[b + 1] - 0.3, b < nB - 1 ? CL.terrace : CL.stoneL, 0);
      if (b < nB - 1) { for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) { const yy = cy + (k - 1.5) * inr[1] * 0.45; addTree(cx + sx * (inr[0] - tx / 2), yy, lv[b + 1] - 0.3, 0.7 + rnd() * 0.3); } }
      o = inner;
    }
    // the pool
    riser([px, py], lv[nB] - 0.3, lv[nB] - 1.0, CL.stoneD, 0.4, true);
    face(WA, [[cx - px, lv[nB] - 0.75, cy - py], [cx + px, lv[nB] - 0.75, cy - py], [cx + px, lv[nB] - 0.75, cy + py], [cx - px, lv[nB] - 0.75, cy + py]], CL.white, null, 0, [0, 1, 0]);
    // trees along the forecourt's rim (shade for the families waiting up top)
    for (let k = 0; k < 9; k++) { addTree(F.x0 + 15 + k * (F.x1 - F.x0 - 30) / 8, F.y0 - 12, 0, 1.1); addTree(F.x0 + 15 + k * (F.x1 - F.x0 - 30) / 8, F.y1 + 12, 0, 1.1); }
    for (let k = 0; k < 10; k++) addTree(F.x0 - 14, F.y0 + 20 + k * (F.y1 - F.y0 - 40) / 9, 0, 1.15);
  });

  // ------------------------------------------------------------ other buildings
  function extrude(A, pts, z0, z1, cw, cr, gl, glr) {
    const sgn = area2(pts) > 0 ? 1 : -1; let s = 0;
    for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.01) continue;
      const nx = (b[1] - a[1]) * sgn, ny = -(b[0] - a[0]) * sgn;
      face(A, [[a[0], z0, a[1]], [b[0], z0, b[1]], [b[0], z1, b[1]], [a[0], z1, a[1]]], cw, [[s / 12, z0 / 12], [(s + L) / 12, z0 / 12], [(s + L) / 12, z1 / 12], [s / 12, z1 / 12]], gl || 0, [nx, 0, ny]); s += L; }
    if (cr) { const tri = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []);
      for (const t of tri) { const P = t.map(k => [pts[k][0], z1, pts[k][1]]); face(A, P, cr, P.map(p => [p[0] / 24, p[2] / 24]), glr || 0, [0, 1, 0]); } }
  }
  const rectPts = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const bbox = pts => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } return { x0, y0, x1, y1 }; };
  safe('buildings', () => {
    for (const B of SPEC.buildings || []) {
      if (['ZMH', 'MALL', 'FC'].includes(B.id) || B.kind === 'processor' || B.kind === 'court') continue;
      const pts = pathPts(B.outline); if (pts.length < 3) continue; const bb = bbox(pts);
      if (B.kind === 'tower') {
        const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
        extrude(SA, pts, 0, 14, CL.conc, CL.conc2, 0.25, 0);
        cyl(SA, cx, cy, 14, 80, 8, 6.2, 16, CL.white, 0, false, false);
        for (let k = 0; k < 4; k++) { const a = TAU * k / 4 + PI / 4; box(SA, cx + Math.cos(a) * 6.8, 14, cy + Math.sin(a) * 6.8, 1.2, 64, 1.2, CL.conc2, -a, 0); }
        cyl(SA, cx, cy, 80, 86.2, 7, 13.5, 24, CL.conc, 0.4, false, false);
        cyl(TA, cx, cy, 86.2, 95.5, 12.6, 14.2, 24, CL.white, 0, false, false);
        cyl(SA, cx, cy, 95.5, 97.4, 15.5, 15, 24, CL.white, 0.2, true, false, CL.conc2);
        cyl(SA, cx, cy, 97.4, 114, 0.6, 0.3, 6, CL.red, 0, false, false);
      } else if (B.kind === 'fire') {
        extrude(SA, pts, 0, 11, CL.conc, CL.conc2, 0.15, 0);
        extrude(SA, rectPts(bb.x0 - 0.4, bb.y0 - 0.4, bb.x1 + 0.4, bb.y1 + 0.4), 8.6, 10.2, CL.red, null, 0.1);
        // apparatus bay doors facing the field
        const yy = Math.abs(bb.y0) > Math.abs(bb.y1) ? bb.y1 + 0.3 : bb.y0 - 0.3; for (let k = 0; k < 6; k++) { const x = bb.x0 + 20 + k * (bb.x1 - bb.x0 - 40) / 5; box(SA, x, 0, yy, 14, 7, 0.6, CL.red, 0, 0.3); }
      } else if (B.kind === 'cargo') {
        const n = 3, gap = 24, w = (bb.x1 - bb.x0 - gap * (n - 1)) / n;
        for (let k = 0; k < n; k++) { const x0 = bb.x0 + k * (w + gap); extrude(SA, rectPts(x0, bb.y0, x0 + w, bb.y1), 0, 21, CL.conc, CL.steel, 0.12, 0);
          for (let m = 0; m < 6; m++) box(SA, x0 + w * (m + 0.5) / 6, 21, (bb.y0 + bb.y1) / 2, 6, 1.2, bb.y1 - bb.y0 - 40, CL.white, 0, 0.3);
          for (let m = 0; m < 10; m++) box(SA, x0 + 12 + m * (w - 24) / 9, 0, bb.y1 + 0.4, 9, 6, 0.8, col('#3c6f9c'), 0, 0); }
      } else if (B.kind === 'mro') {
        const n = 3, gap = 30, w = (bb.x1 - bb.x0 - gap * (n - 1)) / n, eave = 22, crown = 40, NS = 18;
        for (let k = 0; k < n; k++) {
          const x0 = bb.x0 + k * (w + gap), xc = x0 + w / 2, hw = w / 2, hz = u => eave + (crown - eave) * (1 - u * u);
          for (let s = 0; s < NS; s++) { const u0 = -1 + 2 * s / NS, u1 = -1 + 2 * (s + 1) / NS, xa = xc + u0 * hw, xb = xc + u1 * hw;
            face(SA, [[xa, hz(u0), bb.y0], [xb, hz(u1), bb.y0], [xb, hz(u1), bb.y1], [xa, hz(u0), bb.y1]], CL.white, [[xa / 12, bb.y0 / 24], [xb / 12, bb.y0 / 24], [xb / 12, bb.y1 / 24], [xa / 12, bb.y1 / 24]], 0, [0, 1, 0]);
            face(SA, [[xa, 0, bb.y0], [xb, 0, bb.y0], [xb, hz(u1), bb.y0], [xa, hz(u0), bb.y0]], s > 1 && s < NS - 2 ? CL.dark : CL.conc, null, s > 1 && s < NS - 2 ? 0.25 : 0, [0, 0, -1]);
            face(SA, [[xa, 0, bb.y1], [xb, 0, bb.y1], [xb, hz(u1), bb.y1], [xa, hz(u0), bb.y1]], CL.conc, null, 0, [0, 0, 1]); }
          face(SA, [[x0, 0, bb.y0], [x0, 0, bb.y1], [x0, eave, bb.y1], [x0, eave, bb.y0]], CL.conc, null, 0, [-1, 0, 0]);
          face(SA, [[x0 + w, 0, bb.y0], [x0 + w, 0, bb.y1], [x0 + w, eave, bb.y1], [x0 + w, eave, bb.y0]], CL.conc, null, 0, [1, 0, 0]);
        }
      } else if (B.kind === 'fuel') {
        extrude(SA, pts, 0, 1.6, CL.conc2, CL.conc2, 0, 0);
        const cols = 3, rows = 2, cw = (bb.x1 - bb.x0) / cols, ch = (bb.y1 - bb.y0) / rows;
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const x = bb.x0 + cw * (i + 0.5), y = bb.y0 + ch * (j + 0.5), r = Math.min(cw, ch) * 0.36;
          cyl(SA, x, y, 0, 20, r, r, 28, CL.white, 0, false, false); cyl(SA, x, y, 20, 20, r, r * 0.15, 28, CL.conc, 0, 24.5, false); }
      } else if (B.kind === 'rail') {
        // two entrance pavilions either side of the stepwell; the station itself is below
        const F = SPEC.forecourt || { y0: -170, y1: 170 };
        for (const [ya, yb] of [[bb.y0, F.y0 - 4], [F.y1 + 4, bb.y1]]) { if (yb - ya < 10) continue;
          extrude(GA, rectPts(bb.x0 + 4, ya + 2, bb.x1 - 4, yb - 2), 0.2, 7, CL.white, null, 0);
          extrude(SA, rectPts(bb.x0 - 3, ya - 3, bb.x1 + 3, yb + 3), 7, 7.9, CL.white, CL.roof, 0.1, 0); }
      } else {
        // multi-storey car parks: open decks
        const lv = 5, fh = 3.3;
        for (let k = 0; k <= lv; k++) { extrude(SA, pts, k * fh, k * fh + 0.9, CL.conc, CL.conc2, 0.05, 0); }
        const inset = rectPts(bb.x0 + 3, bb.y0 + 3, bb.x1 - 3, bb.y1 - 3);
        for (let k = 0; k < lv; k++) extrude(SA, inset, k * fh + 0.9, (k + 1) * fh, CL.dark, null, 0.5);
        for (let y = bb.y0 + 24; y < bb.y1 - 30; y += 26) extrude(SA, rectPts(bb.x0 + 22, y, bb.x1 - 22, y + 12), lv * fh + 4.2, lv * fh + 4.6, CL.solar, CL.solar, 0, 0);
      }
    }
  });

  // ------------------------------------------------------------ meshes (static)
  const meshes = {};
  safe('meshes', () => {
    const mk = (A, m, cast, recv, name) => { if (!A.i.length) return null; const me = new THREE.Mesh(toGeo(A), m); me.castShadow = !!cast; me.receiveShadow = !!recv; me.name = name; group.add(me); meshes[name] = me; return me; };
    mk(SA, M.solid, true, true, 'solid');
    mk(GA, M.glass, false, true, 'glass');
    mk(JA, M.jaali, true, true, 'jaali');
    mk(WA, M.pool, false, true, 'pool');
    const tg = mk(TA, M.tglass, false, false, 'tglass'); if (tg) tg.renderOrder = 2;
  });

  // ------------------------------------------------------------ trees (instanced, one draw)
  safe('trees', () => {
    if (!TREES.length) return;
    const A = Acc(), trunk = col('#6b4f33'), leaf = col('#ffffff');
    cyl(A, 0, 0, 0, 4.2, 0.45, 0.3, 5, trunk, 0, false, false);
    const ico = new THREE.IcosahedronGeometry(1, 0); const ip = ico.attributes.position;
    for (let k = 0; k < ip.count; k += 3) { const P = [0, 1, 2].map(m => [ip.getX(k + m) * 4.2, 6.6 + ip.getY(k + m) * 3.4, ip.getZ(k + m) * 4.2]); face(A, P, leaf, null, 0, [(P[0][0] + P[1][0] + P[2][0]) / 3, (P[0][1] + P[1][1] + P[2][1]) / 3 - 6.6, (P[0][2] + P[1][2] + P[2][2]) / 3]); }
    // the leaf colour comes from the instance colour; trunk vertices darken by being multiplied too
    const g = toGeo(A); const im = new THREE.InstancedMesh(g, M.tree, TREES.length);
    const o = new THREE.Object3D(), c = new THREE.Color(), greens = ['#4e7f35', '#5f8d3a', '#6c9a44', '#3f6f2f', '#7a9b3c', '#558a48'];
    TREES.forEach((t, k) => { o.position.set(t[0], t[2], t[1]); o.rotation.set(0, t[4] * TAU, 0); o.scale.setScalar(t[3]); o.updateMatrix(); im.setMatrixAt(k, o.matrix); c.set(greens[Math.floor(t[4] * greens.length) % greens.length]); im.setColorAt(k, c); });
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; group.add(im); meshes.trees = im;
  });

  // ------------------------------------------------------------ skylight coffers with coloured lenses (instanced)
  safe('skylights', () => {
    const SK = (RF.skylights || []).filter(s => !isHole(s.x, s.y) && H(s.x, s.y) !== NEG); if (!SK.length) return;
    const A = Acc(), w = col('#ffffff');
    // a low glazed lantern: octagonal footprint 1 x 1 (scaled to l x w), sloped glass sides up to a flat lens ring
    const NO = 8, rb = 0.5, rt = 0.34, hgt = 0.55, oc = k => [Math.cos(TAU * (k + 0.5) / NO), Math.sin(TAU * (k + 0.5) / NO)];
    for (let k = 0; k < NO; k++) { const a = oc(k), b = oc(k + 1); face(A, [[a[0] * rb, 0, a[1] * rb], [b[0] * rb, 0, b[1] * rb], [b[0] * rt, hgt, b[1] * rt], [a[0] * rt, hgt, a[1] * rt]], w, null, 0, [a[0] + b[0], 0.7, a[1] + b[1]]);
      face(A, [[0, hgt, 0], [a[0] * rt, hgt, a[1] * rt], [b[0] * rt, hgt, b[1] * rt]], w, null, 0, [0, 1, 0]); }
    const LA = Acc(); for (let k = 0; k < NO; k++) { const a = oc(k), b = oc(k + 1), r = 0.15; face(LA, [[0, hgt + 0.08, 0], [a[0] * r, hgt + 0.08, a[1] * r], [b[0] * r, hgt + 0.08, b[1] * r]], w, null, 0, [0, 1, 0]); }
    const g1 = toGeo(A), g2 = toGeo(LA); g1.deleteAttribute('color'); g2.deleteAttribute('color');
    const im = new THREE.InstancedMesh(g1, M.coffer, SK.length), il = new THREE.InstancedMesh(g2, M.lens, SK.length);
    const m4 = new THREE.Matrix4(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Zv = new THREE.Vector3(), S = new THREE.Vector3(), c = new THREE.Color();
    const peacock = ['#1d8f8a', '#d9a531', '#2f62c0', '#8a3f9a', '#3c9a48', '#d0573b', '#1aa3c9', '#e0c04a'];
    SK.forEach((s, k) => {
      const a = (s.a || 0) * PI / 180, h = H(s.x, s.y), e = 2;
      const hx = (H(s.x + e, s.y) - H(s.x - e, s.y)) / (2 * e), hz = (H(s.x, s.y + e) - H(s.x, s.y - e)) / (2 * e);
      Y.set(-hx, 1, -hz).normalize(); X.set(Math.cos(a), 0, Math.sin(a)); X.addScaledVector(Y, -X.dot(Y)).normalize(); Zv.crossVectors(X, Y).normalize();
      m4.makeBasis(X, Y, Zv); S.set(s.l || 16, 2.2, s.w || 12); m4.scale(S); m4.setPosition(s.x, h + 0.05, s.y);
      im.setMatrixAt(k, m4);
      S.set((s.l || 16) * 0.55, 2.2, (s.w || 12) * 0.55); m4.makeBasis(X, Y, Zv); m4.scale(S); m4.setPosition(s.x, h + 0.05, s.y); il.setMatrixAt(k, m4);
      c.set(peacock[((k * 7 + Math.floor(Math.abs(s.x * 0.37 + s.y * 0.11))) % peacock.length)] || peacock[k % 8]); il.setColorAt(k, c); c.lerp(CL.white, 0.45); im.setColorAt(k, c);
    });
    im.frustumCulled = il.frustumCulled = false; im.receiveShadow = true; group.add(im); group.add(il); meshes.coffer = im; meshes.lens = il;
  });

  // ------------------------------------------------------------ aerobridges (instanced: walkway, cab, leg)
  const BRM = {};
  safe('bridges', () => {
    if (!BR.length) return;
    const body = col('#cfd3d6'), glassC = col('#45535c'), dark = col('#5a6066');
    const WK = Acc(); // walkway spans x 0..1
    box(WK, 0.5, -1.6, 0, 1, 3.2, 3.8, body, 0, 0, body); box(WK, 0.5, -0.2, 0, 1.002, 1.0, 3.86, glassC, 0, 0, glassC);
    const CB = Acc(); box(CB, 0, -1.8, 0, 4.4, 3.6, 5.0, body, 0, 0, body); box(CB, 1.6, -1.2, 0, 1.4, 2.4, 5.1, glassC, 0, 0, glassC);
    const LG = Acc(); box(LG, 0, 0, 0, 0.9, 3.6, 0.9, dark, 0, 0); box(LG, 0, 0, 0, 2.2, 1.0, 3.4, dark, 0, 0);
    const mk = (A, n) => { const g = toGeo(A); const im = new THREE.InstancedMesh(g, M.bridge, BR.length); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; group.add(im); BRM[n] = im; };
    mk(WK, 'walk'); mk(CB, 'cab'); mk(LG, 'leg');
    // static rotundas and the link through the jaali to the pier face, into the solid mesh (rebuilt below)
    const RA = Acc();
    for (const b of BR) { cyl(RA, b.rx, b.ry, 0, 7.2, 3.2, 3.2, 10, body, 0.15, true, false, CL.steel); cyl(RA, b.rx, b.ry, 0, 3.6, 0.9, 0.9, 6, dark, 0, false, false);
      box(RA, (b.rx + b.faceX) / 2, 3.6, b.ry, Math.abs(b.rx - b.faceX), 3.2, 3.6, body, 0, 0.2, body); }
    const rm = new THREE.Mesh(toGeo(RA), M.solid); rm.castShadow = true; rm.receiveShadow = true; group.add(rm); meshes.rot = rm;
  });
  const gIdx = new Map(); BR.forEach((b, k) => gIdx.set(b.g, k));
  const dockF = new Array(BR.length).fill(null);
  const o3 = new THREE.Object3D();

  // ------------------------------------------------------------ per frame
  const warm = col('#ffb56e');
  function update(dt) {
    const nf = Z.nightF || 0, L = Math.max(nf, Z.dustNow ? 0.45 : 0, Z.LV && Z.LV.light === 'dawn' ? Math.max(0, 0.6 - (Z.T || 0) / 1500) : 0);
    M.solid.emissiveIntensity = 0.9 * L; M.glass.emissiveIntensity = 1.5 * L; M.tglass.emissiveIntensity = 2.6 * L; M.tglass.opacity = 0.32 + 0.4 * L;
    M.coffer.emissiveIntensity = 0.75 * L; M.lens.emissiveIntensity = 1.8 * L; M.pool.emissiveIntensity = 0.5 * L;
    const env = 1 - 0.85 * nf; M.glass.envMapIntensity = 1.1 * env; M.solid.envMapIntensity = 0.45 * env; M.tglass.envMapIntensity = 1.3 * env; M.pool.envMapIntensity = 1.3 * env; M.coffer.envMapIntensity = 1.2 * env; M.bridge.envMapIntensity = 0.7 * env;
    if (!BRM.walk) return;
    for (let k = 0; k < dockF.length; k++) dockF[k] = null;
    const fl = Z.flights ? Z.flights() : [];
    for (let k = 0; k < fl.length; k++) { const f = fl[k]; if (f.state === 'dock' && f.res) { const i = gIdx.get(f.res); if (i !== undefined) dockF[i] = f; } }
    const kE = Z.kEx || 1, ke = 1 - Math.exp(-(dt || 0.016) * 1.3);
    for (let k = 0; k < BR.length; k++) {
      const b = BR[k], g = b.g, o = g.occ; let f = null;
      if (o && (o.state === 'at_gate' || o.state === 'parked')) f = o; else if (dockF[k]) f = dockF[k];
      if (f && f.T) { const Ln = f.T.len * kE, ca = Math.cos(g.a), sa = Math.sin(g.a);
        let dx = g.x + ca * 0.35 * Ln + b.lx * 2, dy = g.y + sa * 0.35 * Ln + b.ly * 2;
        const pr = (dx - b.rx) * b.fs; if (pr < 6) dx += (6 - pr) * b.fs;
        b.dx = dx; b.dy = dy; }
      const tgt = f ? 1 : 0; if (b.e < 0) b.e = tgt; else b.e += (tgt - b.e) * ke;
      const e = b.e * b.e * (3 - 2 * b.e);
      const rx = b.rx + b.fs * 9 - b.lx * 3, ry = b.ry - b.ly * 3;           // parked: tucked along the face
      const ex = rx + (b.dx - rx) * e, ey = ry + (b.dy - ry) * e;
      const vx = ex - b.rx, vy = ey - b.ry, len = Math.max(2, Math.hypot(vx, vy)), yaw = -Math.atan2(vy, vx), ux = vx / len, uy = vy / len;
      const wl = Math.max(1, len - 2.2), y = 5.6 - 0.6 * e;
      o3.position.set(b.rx, 5.6, b.ry); o3.rotation.set(0, yaw, Math.atan2(y - 5.6, wl)); o3.scale.set(wl, 1, 1); o3.updateMatrix(); BRM.walk.setMatrixAt(k, o3.matrix);
      o3.position.set(b.rx + ux * (wl + 2.2), y, b.ry + uy * (wl + 2.2)); o3.rotation.set(0, yaw, 0); o3.scale.set(1, 1, 1); o3.updateMatrix(); BRM.cab.setMatrixAt(k, o3.matrix);
      o3.position.set(b.rx + ux * wl * 0.72, 0, b.ry + uy * wl * 0.72); o3.updateMatrix(); BRM.leg.setMatrixAt(k, o3.matrix);
    }
    BRM.walk.instanceMatrix.needsUpdate = true; BRM.cab.instanceMatrix.needsUpdate = true; BRM.leg.instanceMatrix.needsUpdate = true;
  }
  void warm;
  return { update, group, H, meshes };
};
