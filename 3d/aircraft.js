Z3MOD.aircraft = function (Z) {
  // Every aircraft and ground vehicle, and how they move. One procedural low-poly model per TYPE (two LODs), painted from
  // a canvas livery atlas (one band per airline, selected per instance in the shader), smoothed bank/pitch/gear from
  // the sim's state machine, blob contact shadows, nav/beacon/strobe/landing lights as one Points draw, a pooled
  // particle system (tyre smoke, reverse-thrust haze, dust), and ground vehicles built from instanced boxes.
  const THREE = Z.THREE, D2R = Math.PI / 180, CAP = 500;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const angD = (a, b) => { let d = (b - a) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI; return d; };
  const sstep = u => u * u * (3 - 2 * u);
  const C = h => new THREE.Color(h);
  const COL = { white: C('#ffffff'), wing: C('#c6cbd1'), wingB: C('#a7adb5'), stab: C('#dfe2e6'), pylon: C('#c9cdd2'), exh: C('#6a6f75'),
    strut: C('#a0a6ad'), tyre: C('#232528'), prop: C('#26292d'), hub: C('#3a3e43') };

  /* ---------------- livery atlas: one 64 px band per airline ---------------- */
  // band layout (u across, v down within the band): fuselage unwrap x 0..1400 (u = t nose->tail, v = angle from the
  // crown to the keel), fin x 1408..1888 (left = leading edge, top = tip), flat patches 1900..2040, window row at v .84-.92
  const AW = 2048, AH = 1024, BH = 64, UF = 1400 / AW, UN0 = 1408 / AW, UN1 = 1888 / AW, VK = BH / AH;
  const PU = { white: [1912 / AW, 0.5], eng: [1940 / AW, 0.5], wlt: [1968 / AW, 0.5], dark: [1996 / AW, 0.5], grey: [2024 / AW, 0.5] };
  const ALK = Object.keys(Z.AL), AIDX = {}; ALK.forEach((k, i) => { AIDX[k] = i; });
  const atlas = document.createElement('canvas'); atlas.width = AW; atlas.height = AH;
  const atlasE = document.createElement('canvas'); atlasE.width = AW; atlasE.height = AH;
  {
    const c = atlas.getContext('2d'), e = atlasE.getContext('2d'); e.fillStyle = '#000'; e.fillRect(0, 0, AW, AH);
    const fa = a => 0.03 + 0.75 * a;
    for (let i = 0; i < ALK.length && i < AH / BH; i++) {
      const y0 = i * BH, k = ALK[i];
      const F = (t0, t1, a0, a1, col) => { c.fillStyle = col; c.fillRect(t0 * 1400, y0 + fa(a0) * BH, (t1 - t0) * 1400, (fa(a1) - fa(a0)) * BH + 0.5); };
      const FP = (pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach((p, j) => (j ? c.lineTo : c.moveTo).call(c, p[0] * 1400, y0 + fa(p[1]) * BH)); c.closePath(); c.fill(); };
      const fx = x => 1408 + x * 480, fy = y => y0 + (0.03 + 0.94 * y) * BH;
      const N = (x0, x1, y0_, y1, col) => { c.fillStyle = col; c.fillRect(fx(x0), fy(y0_), (x1 - x0) * 480, (y1 - y0_) * 0.94 * BH + 0.5); };
      const NP = (pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach((p, j) => (j ? c.lineTo : c.moveTo).call(c, fx(p[0]), fy(p[1]))); c.closePath(); c.fill(); };
      const ND = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(fx(x), fy(y), r * 480, r * 0.94 * BH * 3.2, 0, 0, 7); c.fill(); };
      const titles = (t0, a, col, n) => { c.fillStyle = col; let x = t0 * 1400; for (let j = 0; j < (n || 9); j++) { const w = 7 + ((j * 37) % 9); c.fillRect(x, y0 + fa(a) * BH, w, (fa(a + 0.085) - fa(a)) * BH); x += w + 3 + (j % 4 === 3 ? 6 : 0); } };
      let eng = '#d4d8dd', wlt = '#e6e8eb';
      // base: white crown, light grey keel
      F(0, 1, 0, 1, '#f3f4f6'); F(0, 1, 0.8, 1, '#c9cdd2'); N(0, 1, 0, 1, '#f3f4f6');
      switch (k) {
        case '6E': { const ind = '#2a2f8f'; N(0, 1, 0, 1, ind); for (let gx = 0; gx < 9; gx++) for (let gy = 0; gy < 6; gy++) { const px = 0.42 + gx * 0.065, py = 0.08 + gy * 0.1; if (px < 1 && Math.hypot(gx - 7, gy - 1) < 6.5) ND(px, py, 0.012 * (1 - Math.hypot(gx - 7, gy - 1) / 8) + 0.004, '#ffffff'); }
          FP([[0.86, 0], [1, 0], [1, 0.35]], ind); titles(0.17, 0.18, ind, 7); eng = ind; wlt = ind; break; }
        case 'AI': { const red = '#c8102e', aub = '#4a1d3f', gold = '#c9a14a'; F(0, 1, 0.62, 1, red); F(0, 1, 0.6, 0.62, gold);
          N(0, 1, 0, 1, aub); NP([[0, 1], [0, 0.35], [0.6, 1]], red); c.strokeStyle = gold; c.lineWidth = 3; c.beginPath(); c.moveTo(fx(0.42), fy(0.88)); c.lineTo(fx(0.42), fy(0.45)); c.quadraticCurveTo(fx(0.62), fy(-0.1), fx(0.82), fy(0.45)); c.lineTo(fx(0.82), fy(0.88)); c.stroke();
          FP([[0.82, 0], [1, 0], [1, 0.4]], aub); titles(0.15, 0.17, red, 8); eng = aub; wlt = red; break; }
        case 'IX': { const or = '#e8452c'; N(0, 1, 0, 1, or); NP([[0.2, 1], [1, 0.2], [1, 0.5], [0.55, 1]], '#b9301c'); FP([[0.8, 0], [1, 0], [1, 0.5], [0.9, 0.3]], or); titles(0.16, 0.18, or, 8); eng = or; wlt = or; break; }
        case 'QP': { const or = '#f26722'; N(0, 1, 0, 1, or); c.strokeStyle = '#ffa060'; c.lineWidth = 2; for (let j = 0; j < 4; j++) { c.beginPath(); c.ellipse(fx(0.6), fy(0.95), (0.14 + j * 0.1) * 480, (0.16 + j * 0.12) * BH, 0, Math.PI, 2 * Math.PI); c.stroke(); }
          titles(0.17, 0.18, or, 6); eng = or; wlt = or; break; }
        case 'SG': { const red = '#d71920'; FP([[0, 0.72], [0.7, 0.72], [0.9, 0.25], [1, 0.1], [1, 1], [0, 1]], red); N(0, 1, 0, 1, red); NP([[0.25, 0.95], [0.75, 0.2], [0.6, 0.65]], '#f04a3a'); NP([[0.45, 0.95], [0.9, 0.35], [0.8, 0.8]], '#ffffff'); titles(0.16, 0.18, red, 8); eng = red; wlt = red; break; }
        case 'EK': { const red = '#d71920'; titles(0.13, 0.15, '#b8955a', 12); F(0.13, 0.43, 0.15, 0.26, '#b8955a'); N(0, 0.3, 0, 1, red); N(0.3, 1, 0, 0.33, '#00843d'); N(0.3, 1, 0.33, 0.66, '#ffffff'); N(0.3, 1, 0.66, 1, '#111111'); eng = '#e9eaec'; wlt = red; break; }
        case 'QR': { const bu = '#5c0632'; F(0, 1, 0, 1, '#bdbec2'); F(0, 1, 0.82, 1, '#cdced1'); N(0, 1, 0, 1, bu); for (let j = 0; j < 7; j++) NP([[0.02 + j * 0.02, j / 7], [0.1 + j * 0.02, (j + 0.5) / 7], [0.02 + j * 0.02, (j + 1) / 7]], '#ffffff');
          FP([[0.84, 0], [1, 0], [1, 0.45], [0.92, 0.1]], bu); titles(0.16, 0.17, bu, 8); eng = '#bdbec2'; wlt = bu; break; }
        case 'EY': { const sand = '#e2d5bb', gold = '#b8925a'; F(0, 1, 0, 1, sand); F(0, 1, 0.75, 1, '#cfc0a0'); N(0, 1, 0, 1, sand); for (let j = 0; j < 6; j++) for (let m = 0; m < 4; m++) NP([[0.2 + j * 0.13, 0.15 + m * 0.22], [0.3 + j * 0.13, 0.15 + m * 0.22], [0.25 + j * 0.13, 0.33 + m * 0.22]], (j + m) % 2 ? gold : '#8c6c3f');
          titles(0.15, 0.17, gold, 8); eng = '#d9c7a3'; wlt = gold; break; }
        case 'SQ': { const bl = '#1c3f94'; F(0, 1, 0.42, 0.48, bl); F(0, 1, 0.48, 0.52, '#f0b323'); N(0, 1, 0, 1, bl); NP([[0.25, 0.85], [0.55, 0.15], [0.8, 0.3], [0.6, 0.45], [0.75, 0.7], [0.45, 0.6]], '#d9a441'); titles(0.15, 0.17, bl, 9); eng = '#e9eaec'; wlt = bl; break; }
        case 'LH': { const bl = '#05164d'; N(0, 1, 0, 1, bl); ND(0.58, 0.45, 0.2, '#f9ba00'); ND(0.58, 0.45, 0.16, bl); NP([[0.5, 0.3], [0.68, 0.45], [0.5, 0.6]], '#f9ba00'); FP([[0.82, 0], [1, 0], [1, 0.45], [0.92, 0.12]], bl); F(0, 1, 0.8, 1, '#f3f4f6'); titles(0.15, 0.17, bl, 10); eng = bl; wlt = bl; break; }
        case 'BA': { const bl = '#1c2f5e', red = '#d22630'; F(0, 1, 0.62, 1, bl); F(0, 1, 0.6, 0.625, red); N(0, 1, 0, 1, '#ffffff'); NP([[0, 0.35], [1, 0.05], [1, 0.35], [0, 0.65]], red); NP([[0, 0.65], [1, 0.35], [1, 1], [0, 1]], bl); NP([[0, 0.45], [1, 0.2], [1, 0.26], [0, 0.52]], '#ffffff');
          titles(0.15, 0.17, bl, 10); eng = bl; wlt = bl; break; }
        case 'SV': { const gr = '#0f7a5a', bl = '#2b5aa8'; F(0, 1, 0.55, 1, '#d8c69f'); N(0, 1, 0, 1, '#f3efe4'); NP([[0, 1], [0, 0.45], [0.7, 1]], gr); NP([[0.1, 1], [0.45, 0.1], [1, 0], [1, 1]], bl); NP([[0.2, 1], [0.6, 0.35], [1, 0.3], [1, 1]], '#d8c69f'); titles(0.16, 0.17, bl, 7); eng = '#d8c69f'; wlt = gr; break; }
        case 'TG': { const pu = '#5b2a86'; N(0, 1, 0, 1, pu); NP([[0.3, 0.9], [0.5, 0.25], [0.75, 0.15], [0.62, 0.5], [0.8, 0.75]], '#c9a227'); NP([[0.38, 0.85], [0.55, 0.4], [0.68, 0.38], [0.6, 0.6]], '#c4307a'); FP([[0.78, 0], [1, 0], [1, 0.55], [0.9, 0.18]], pu); titles(0.15, 0.17, pu, 6); eng = pu; wlt = pu; break; }
        case 'FZ': { const bl = '#1a4c86', or = '#f26b21'; FP([[0, 0.5], [0.75, 0.55], [1, 0.2], [1, 1], [0, 1]], bl); N(0, 1, 0, 1, or); N(0, 0.15, 0, 1, bl); titles(0.15, 0.17, bl, 8); eng = or; wlt = or; break; }
        case 'AF': { const bl = '#002157', red = '#e4002b'; N(0, 1, 0, 1, '#ffffff'); for (let j = 0; j < 4; j++) NP([[0.05 + j * 0.13, 1], [0.2 + j * 0.13, 0], [0.27 + j * 0.13, 0], [0.12 + j * 0.13, 1]], j === 3 ? red : bl); titles(0.15, 0.17, bl, 9); eng = '#eef0f2'; wlt = bl; break; }
        default: { const col = (Z.AL[k] && Z.AL[k].tail) || '#777'; N(0, 1, 0, 1, col); titles(0.16, 0.18, col, 7); eng = col; wlt = col; }
      }
      // patches
      const P = (x, col) => { c.fillStyle = col; c.fillRect(x, y0, 28, BH); };
      P(1900, '#ffffff'); P(1928, eng); P(1956, wlt); P(1984, '#121820'); P(2012, '#9aa0a6');
      // window row: the crown colour at window height, with dark windows; emissive copy lights them at night
      const wy = y0 + Math.round(0.84 * BH), wh = Math.round(0.08 * BH);
      c.drawImage(atlas, 0, Math.round(y0 + fa(0.35) * BH), 1400, 1, 0, wy, 1400, wh);
      c.fillStyle = '#1b2430'; e.fillStyle = '#ffd08a';
      for (let x = 2; x < 1400; x += 8) { c.fillRect(x, wy + 1, 4, wh - 2); e.fillRect(x, wy + 1, 4, wh - 2); }
      // tail logo lights: a dim copy of the fin glows at night
      e.globalAlpha = 0.28; e.drawImage(atlas, 1408, y0, 480, BH, 1408, y0, 480, BH); e.globalAlpha = 1;
    }
  }
  const mkTex = cv => { const t = new THREE.CanvasTexture(cv); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  const texA = mkTex(atlas), texE = mkTex(atlasE);

  /* ---------------- geometry builder ---------------- */
  const Geo = () => ({ p: [], n: [], c: [], uv: [], o: [0, 0, 0] });
  function put(g, P, N, c, uv) { g.p.push(P[0], P[1], P[2]); g.n.push(N[0], N[1], N[2]); g.c.push(c.r, c.g, c.b); g.uv.push(uv[0], uv[1]); }
  const one = x => x && x.r !== undefined || (x && typeof x[0] === 'number');
  function tri(g, A, B, Cc, col, nA, nB, nC, uv) {
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = Cc[0] - A[0], vy = Cc[1] - A[1], vz = Cc[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-9) return;
    nx /= l; ny /= l; nz /= l;
    let rx, ry, rz;
    if (nA) { rx = nA[0] + nB[0] + nC[0]; ry = nA[1] + nB[1] + nC[1]; rz = nA[2] + nB[2] + nC[2]; }
    else { rx = (A[0] + B[0] + Cc[0]) / 3 - g.o[0]; ry = (A[1] + B[1] + Cc[1]) / 3 - g.o[1]; rz = (A[2] + B[2] + Cc[2]) / 3 - g.o[2]; }
    const cA = one(col) ? col : col[0], cB = one(col) ? col : col[1], cC = one(col) ? col : col[2];
    uv = uv || PU.white; const uA = one(uv) ? uv : uv[0], uB = one(uv) ? uv : uv[1], uC = one(uv) ? uv : uv[2];
    if (nx * rx + ny * ry + nz * rz < 0) { const fn = [-nx, -ny, -nz]; put(g, A, nA || fn, cA, uA); put(g, Cc, nC || fn, cC, uC); put(g, B, nB || fn, cB, uB); }
    else { const fn = [nx, ny, nz]; put(g, A, nA || fn, cA, uA); put(g, B, nB || fn, cB, uB); put(g, Cc, nC || fn, cC, uC); }
  }
  function quad(g, A, B, Cc, D, col, nA, nB, nC, nD, uv) {
    const c4 = one(col) ? [col, col, col, col] : col, u4 = !uv || one(uv) ? [uv, uv, uv, uv] : uv;
    tri(g, A, B, Cc, [c4[0], c4[1], c4[2]], nA, nB, nC, [u4[0] || PU.white, u4[1] || PU.white, u4[2] || PU.white]);
    tri(g, A, Cc, D, [c4[0], c4[2], c4[3]], nA, nC, nD, [u4[0] || PU.white, u4[2] || PU.white, u4[3] || PU.white]);
  }
  // convex slab: 4 planform corners, thickness at each corner along axis ax (1 = y, 2 = z); uv constant or per corner
  function slab(g, pts, th, ax, col, colB, uv) {
    const top = [], bot = []; let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < 4; i++) { const a = pts[i].slice(), b = pts[i].slice(); a[ax] += th[i] / 2; b[ax] -= th[i] / 2; top.push(a); bot.push(b); cx += pts[i][0] / 4; cy += pts[i][1] / 4; cz += pts[i][2] / 4; }
    const u4 = !uv || one(uv) ? [uv, uv, uv, uv] : uv;
    g.o = [cx, cy, cz];
    quad(g, top[0], top[1], top[2], top[3], col, null, null, null, null, u4); quad(g, bot[0], bot[1], bot[2], bot[3], colB || col, null, null, null, null, u4);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(g, top[i], top[j], bot[j], bot[i], col, null, null, null, null, [u4[i], u4[j], u4[j], u4[i]]); }
  }
  function box(g, cx, cy, cz, lx, ly, lz, col, uv) {
    slab(g, [[cx + lx / 2, cy, cz - lz / 2], [cx - lx / 2, cy, cz - lz / 2], [cx - lx / 2, cy, cz + lz / 2], [cx + lx / 2, cy, cz + lz / 2]], [ly, ly, ly, ly], 1, col, null, uv);
  }
  // body of revolution along x: rings [x, r], N segments; flat < 1 squashes the lower half (737 nacelles); chev = chevron TE
  function revX(g, rings, cy, cz, N, col, uv, capF, capB, flat, chev) {
    const fl = flat || 1;
    const R = (i, j) => { const r = rings[i][1]; return chev && i === rings.length - 1 ? r * (1 + (j % 2 ? chev : -chev)) : r; };
    const P = (i, j) => { const a = j / N * 2 * Math.PI, ca = Math.cos(a), r = R(i, j % N); return [rings[i][0], cy + r * ca * (ca < 0 ? fl : 1), cz + r * Math.sin(a)]; };
    for (let i = 0; i < rings.length - 1; i++) {
      const sl = (rings[i][1] - rings[i + 1][1]) / Math.max(1e-6, rings[i][0] - rings[i + 1][0]);
      for (let j = 0; j < N; j++) {
        const a0 = j / N * 2 * Math.PI, a1 = (j + 1) / N * 2 * Math.PI, n0 = [-sl, Math.cos(a0), Math.sin(a0)], n1 = [-sl, Math.cos(a1), Math.sin(a1)];
        quad(g, P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1), col, n0, n0, n1, n1, uv);
      }
    }
    const fan = (i, k, tipX, c, u) => { const x = rings[i][0]; g.o = [x - (tipX - x) * 3, cy, cz]; for (let j = 0; j < N; j++) { const A = P(i, j), B = P(i, j + 1);
      tri(g, [x, cy + (A[1] - cy) * k, cz + (A[2] - cz) * k], [x, cy + (B[1] - cy) * k, cz + (B[2] - cz) * k], [tipX, cy, cz], c, null, null, null, u); } };
    if (capF) fan(0, capF.k, rings[0][0] + capF.d, capF.c, capF.uv);
    if (capB) fan(rings.length - 1, capB.k, rings[rings.length - 1][0] + capB.d, capB.c, capB.uv);
  }
  function cylZ(g, cx, cy, cz, r, w, N, col) {
    for (let j = 0; j < N; j++) {
      const a0 = j / N * 2 * Math.PI, a1 = (j + 1) / N * 2 * Math.PI, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      g.o = [cx, cy, cz];
      quad(g, [cx + r * c0, cy + r * s0, cz - w / 2], [cx + r * c1, cy + r * s1, cz - w / 2], [cx + r * c1, cy + r * s1, cz + w / 2], [cx + r * c0, cy + r * s0, cz + w / 2], col,
        [c0, s0, 0], [c1, s1, 0], [c1, s1, 0], [c0, s0, 0]);
      tri(g, [cx, cy, cz - w / 2], [cx + r * c0, cy + r * s0, cz - w / 2], [cx + r * c1, cy + r * s1, cz - w / 2], col);
      tri(g, [cx, cy, cz + w / 2], [cx + r * c0, cy + r * s0, cz + w / 2], [cx + r * c1, cy + r * s1, cz + w / 2], col);
    }
  }
  function toGeom(g, liv) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, 3));
    if (liv) { geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2)); geo.setAttribute('aLiv', liv); }
    geo.computeBoundingSphere(); return geo;
  }

  /* ---------------- aircraft types (true dimensions, metres; nose +X, wheels at y = 0) ---------------- */
  const NOSE = { airbus: { qt: 0.5, qb: 0.5, qw: 0.5, drop: 0.36 }, boeing: { qt: 0.78, qb: 0.42, qw: 0.62, drop: 0.5 }, b787: { qt: 0.68, qb: 0.48, qw: 0.56, drop: 0.42 },
    a380: { qt: 0.3, qb: 0.6, qw: 0.5, drop: 0.5 }, atr: { qt: 0.6, qb: 0.45, qw: 0.55, drop: 0.3 } };
  const TAIL = { round: { eh: 0.15, ew: 0.15, drop: 0.22 }, max: { eh: 0.06, ew: 0.06, drop: 0.28 }, blade: { eh: 0.24, ew: 0.035, drop: 0.2 }, b787: { eh: 0.11, ew: 0.09, drop: 0.24 },
    a380: { eh: 0.13, ew: 0.11, drop: 0.32 }, atr: { eh: 0.16, ew: 0.16, drop: 0.12 } };
  const base = {
    nb: { W: 1.98, H: 2.03, yb: 1.6, tn: .14, tt: .7, deck: 1, nose: 'airbus', tail: 'round', win: [[59, 64]],
      wing: { x: 3.6, y: 0.5, cr: 7.0, ct: 1.55, sw: 26, dh: 5.5, t: 0.9, kink: .36, flex: 0, wl: 'sharklet', wlh: 2.4 },
      eng: [{ z: 5.75, r: 1.1, len: 4.8, fwd: 2.6, drop: 1.12 }],
      hs: { half: 6.3, cr: 3.8, ct: 1.4, sw: 31, dh: 6, te: 1.0, y: 0.2 }, fin: { cr: 6.4, ct: 2.3, h: 5.9, sw: 37, te: 0.8 },
      gear: { nd: 5.1, mains: [{ dx: 3.0, z: 3.8, b: 1 }], r: 0.58, nr: 0.4 } },
    tp: { W: 1.32, H: 1.38, yb: 0.95, tn: .12, tt: .66, deck: 1, high: 1, nose: 'atr', tail: 'atr', win: [[63, 70]],
      wing: { x: 1.9, y: 0, cr: 2.6, ct: 1.45, sw: 3, dh: 0.5, t: 0.42, kink: 0, flex: 0, wl: '' },
      eng: [{ z: 4.05, r: 0.6, len: 5.0, fwd: 2.2, drop: 0.32, prop: 1.95 }],
      hs: { half: 3.9, cr: 2.1, ct: 1.25, sw: 12, dh: 0, te: 0.9, ttail: 1 }, fin: { cr: 4.8, ct: 2.4, h: 4.4, sw: 33, te: 0.6 },
      gear: { nd: 2.9, mains: [{ dx: 2.8, z: 2.05, b: 1 }], r: 0.45, nr: 0.32, spon: 1 } },
    wb: { W: 2.98, H: 3.08, yb: 2.25, tn: .13, tt: .72, deck: 1, nose: 'airbus', tail: 'round', win: [[58, 62]],
      wing: { x: 6.5, y: 0.6, cr: 13.2, ct: 2.7, sw: 31, dh: 5.5, t: 1.5, kink: .33, flex: 0, wl: 'classic', wlh: 3.0 },
      eng: [{ z: 9.9, r: 1.55, len: 7.2, fwd: 4.0, drop: 1.6 }],
      hs: { half: 9.6, cr: 6.8, ct: 2.4, sw: 33, dh: 5, te: 1.6, y: 0.2 }, fin: { cr: 10.8, ct: 4.0, h: 9.0, sw: 40, te: 1.0 },
      gear: { nd: 6.3, mains: [{ dx: 7.6, z: 5.4, b: 2 }], r: 0.66, nr: 0.55 } },
  };
  const merge = (a, b) => { const o = Array.isArray(a) ? a.slice() : Object.assign({}, a); for (const key in b) o[key] = b[key] && typeof b[key] === 'object' && !Array.isArray(b[key]) && a[key] ? merge(a[key], b[key]) : b[key]; return o; };
  const TDEF = {
    A20N: merge(base.nb, { L: 37.6, S: 35.8, doors: [[0.115, 1], [0.44, 0], [0.475, 0], [0.84, 1]] }),
    A21N: merge(base.nb, { L: 44.5, S: 35.8, doors: [[0.1, 1], [0.3, 1], [0.53, 1], [0.84, 1]], wing: { x: 3.2 }, gear: { nd: 5.4 } }),
    B38M: merge(base.nb, { L: 39.5, S: 35.9, W: 1.88, H: 1.95, yb: 1.05, tn: .17, nose: 'boeing', tail: 'max', doors: [[0.12, 1], [0.45, 0], [0.485, 0], [0.86, 1]],
      wing: { x: 3.3, y: 0.42, cr: 7.3, ct: 1.3, sw: 25, dh: 6, wl: 'split', wlh: 2.0 }, eng: [{ z: 4.95, r: 1.02, len: 4.6, fwd: 3.6, drop: 0.55, flat: 0.8 }],
      hs: { half: 7.1, cr: 4.0 }, fin: { cr: 6.8, h: 6.4, sw: 38 }, gear: { nd: 4.6, mains: [{ dx: 3.6, z: 2.85, b: 1 }], r: 0.55, nr: 0.36 } }),
    AT76: merge(base.tp, { L: 27.2, S: 27.1, doors: [[0.1, 1], [0.86, 1]] }),
    A333: merge(base.wb, { L: 63.7, S: 60.3, W: 2.82, H: 2.86, eng: [{ z: 9.4, r: 1.4, len: 6.6, fwd: 3.6, drop: 1.5 }], doors: [[0.085, 1], [0.27, 1], [0.6, 1], [0.84, 1]],
      wing: { x: 6.0, cr: 12.0, wl: 'classic', wlh: 2.8 } }),
    A359: merge(base.wb, { L: 66.8, S: 64.75, mask: 1, eng: [{ z: 9.9, r: 1.68, len: 7.4, fwd: 4.0, drop: 1.6 }], doors: [[0.085, 1], [0.26, 1], [0.6, 1], [0.84, 1]],
      wing: { wl: 'curve', wlh: 3.4, flex: 0.025 } }),
    B788: merge(base.wb, { L: 56.7, S: 60.1, W: 2.88, H: 2.98, tn: .15, nose: 'b787', tail: 'b787', cock4: 1, doors: [[0.09, 1], [0.3, 1], [0.6, 1], [0.86, 1]],
      wing: { x: 5.6, cr: 12.0, sw: 32, dh: 6, wl: 'raked', flex: 0.06 }, eng: [{ z: 9.6, r: 1.5, len: 7.0, fwd: 3.8, drop: 1.55, chev: 0.09 }],
      fin: { cr: 10.0, h: 9.4 }, gear: { nd: 6.0, mains: [{ dx: 7.2, z: 4.9, b: 2 }] } }),
    B789: merge(base.wb, { L: 62.8, S: 60.1, W: 2.88, H: 2.98, tn: .14, nose: 'b787', tail: 'b787', cock4: 1, doors: [[0.085, 1], [0.27, 1], [0.6, 1], [0.86, 1]],
      wing: { x: 6.0, cr: 12.0, sw: 32, dh: 6, wl: 'raked', flex: 0.06 }, eng: [{ z: 9.6, r: 1.5, len: 7.0, fwd: 3.8, drop: 1.55, chev: 0.09 }],
      fin: { cr: 10.0, h: 9.4 }, gear: { nd: 6.2, mains: [{ dx: 7.2, z: 4.9, b: 2 }] } }),
    B77W: merge(base.wb, { L: 73.9, S: 64.8, W: 3.1, H: 3.2, tn: .12, tt: .74, nose: 'b787', tail: 'blade', doors: [[0.075, 1], [0.23, 1], [0.5, 1], [0.69, 1], [0.86, 1]],
      wing: { x: 6.0, cr: 14.0, sw: 31.6, wl: 'raked', flex: 0.02 }, eng: [{ z: 9.7, r: 2.0, len: 7.8, fwd: 4.4, drop: 1.75 }],
      fin: { cr: 11.5, h: 10.2 }, gear: { nd: 6.6, mains: [{ dx: 8.0, z: 5.5, b: 3 }], r: 0.68 } }),
    A388: { L: 72.7, S: 79.75, W: 3.57, H: 4.2, yb: 2.2, tn: .15, tt: .71, deck: 2, nose: 'a380', tail: 'a380', win: [[44, 48], [70, 73]],
      doors: [[0.1, 1], [0.25, 1], [0.45, 1], [0.62, 1], [0.8, 1]],
      wing: { x: 9.5, y: 0.7, cr: 17.5, ct: 4.0, sw: 33.5, dh: 5.6, t: 2.0, kink: .3, flex: 0.01, wl: 'fence', wlh: 2.4 },
      eng: [{ z: 14.5, r: 1.55, len: 7.0, fwd: 4.6, drop: 1.9 }, { z: 25.8, r: 1.5, len: 6.8, fwd: 4.0, drop: 1.6 }],
      hs: { half: 15.3, cr: 10.5, ct: 3.6, sw: 34, dh: 4, te: 1.8, y: 0.0 }, fin: { cr: 14.8, ct: 5.4, h: 13.4, sw: 41, te: 1.2 },
      gear: { nd: 6.4, mains: [{ dx: 10.5, z: 6.2, b: 2 }, { dx: 13.8, z: 2.3, b: 3 }], r: 0.7, nr: 0.6 } },
  };
  const TKEYS = Object.keys(TDEF);

  function ringAt(P, t) {
    const L = P.L, W = P.W, H = P.H, yc = P.yb + H, x = L / 2 - t * L;
    if (t < P.tn) { const NS = NOSE[P.nose], s = t / P.tn, q = 1 - (1 - s) * (1 - s), ytip = yc - NS.drop * H;
      const top = ytip + (yc + H - ytip) * Math.pow(q, NS.qt), bot = ytip - (ytip - (yc - H)) * Math.pow(q, NS.qb);
      return [x, (top + bot) / 2, W * Math.max(0.05, Math.pow(q, NS.qw)), Math.max(0.05 * H, (top - bot) / 2)]; }
    if (t > P.tt) { const TL = TAIL[P.tail], s = (t - P.tt) / (1 - P.tt), hh = H * (1 - (1 - TL.eh) * Math.pow(s, 1.25)), top = yc + H - TL.drop * H * s;
      return [x, top - hh, W * (1 - (1 - TL.ew) * Math.pow(s, 1.1)), hh]; }
    return [x, yc, W, H];
  }
  const tOfX = (P, x) => clamp((P.L / 2 - x) / P.L, 0, 1);
  function surf(P, t, th, off) {
    const [x, yc, w, h] = ringAt(P, t), e = 0.004; const ra = ringAt(P, Math.max(0, t - e)), rb = ringAt(P, Math.min(1, t + e));
    const R = (w + h) / 2, dR = ((ra[2] + ra[3]) - (rb[2] + rb[3])) / 2 / Math.max(1e-6, ra[0] - rb[0]);
    let nx = -dR, ny = Math.cos(th) * R / h, nz = Math.sin(th) * R / w; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    return { p: [x + nx * off, yc + h * Math.cos(th) + ny * off, w * Math.sin(th) + nz * off], n: [nx, ny, nz] };
  }
  const fusUV = (t, th) => { let a = Math.abs(th) % (2 * Math.PI); if (a > Math.PI) a = 2 * Math.PI - a; return [t * UF, 0.03 + 0.75 * a / Math.PI]; };
  function patch(g, P, t0, t1, nt, thF, nth, off, col, uvF) {
    for (let i = 0; i < nt; i++) for (let j = 0; j < nth; j++) {
      const ta = t0 + (t1 - t0) * i / nt, tb = t0 + (t1 - t0) * (i + 1) / nt, ua = j / nth, ub = (j + 1) / nth;
      const A = surf(P, ta, thF(ta, ua), off), B = surf(P, tb, thF(tb, ua), off), Cc = surf(P, tb, thF(tb, ub), off), D = surf(P, ta, thF(ta, ub), off);
      quad(g, A.p, B.p, Cc.p, D.p, col, A.n, B.n, Cc.n, D.n, uvF ? [uvF(ta, ua), uvF(tb, ua), uvF(tb, ub), uvF(ta, ub)] : PU.dark);
    }
  }
  function wingGeom(P) {
    const w = P.wing, zr = P.high ? 0.2 : P.W * 0.6, half = P.S / 2 - (w.wl === 'sharklet' || w.wl === 'classic' || w.wl === 'curve' || w.wl === 'split' ? 0.2 : 0);
    const rootY = P.high ? P.yb + 2 * P.H + 0.05 : P.yb + w.y, tsw = Math.tan(w.sw * D2R), tdh = Math.tan(w.dh * D2R);
    const xLE = z => w.x - (z - zr) * tsw, yAt = z => { const u = (z - zr) / (half - zr); return rootY + (z - zr) * tdh + (w.flex || 0) * u * u * half; };
    const zk = w.kink ? zr + w.kink * (half - zr) : zr, teIn = w.x - w.cr, ck = xLE(zk) - teIn;
    const chord = z => (z <= zk ? xLE(z) - teIn : ck + (w.ct - ck) * (z - zk) / (half - zk));
    return { zr, half, rootY, xLE, yAt, zk, chord };
  }

  function buildType(P, hi, liv) {
    const body = Geo(), gear = Geo(), prop = Geo(), N = hi ? (P.W > 2.5 ? 16 : 14) : 8;
    const WG = wingGeom(P); P.WG = WG;
    P.nx = P.L / 2 - P.gear.nd; P.mains = P.gear.mains.map(m => ({ x: P.wing.x - m.dx, z: m.z, b: m.b }));
    // fuselage
    const ts = [];
    for (const s of hi ? [0, .04, .1, .2, .33, .5, .7, .85, 1] : [0, .12, .4, 1]) ts.push(s * P.tn);
    if (hi) ts.push(P.tn + (P.tt - P.tn) * 0.5);
    for (const s of hi ? [0, .2, .4, .6, .75, .88, .96, 1] : [0, .4, .75, 1]) ts.push(P.tt + s * (1 - P.tt));
    const ring = (t, j) => surf(P, t, j / N * 2 * Math.PI, 0);
    for (let i = 0; i < ts.length - 1; i++) for (let j = 0; j < N; j++) {
      const A = ring(ts[i], j), B = ring(ts[i + 1], j), Cc = ring(ts[i + 1], j + 1), D = ring(ts[i], j + 1);
      const ta = j / N * 2 * Math.PI, tb = (j + 1) / N * 2 * Math.PI;
      quad(body, A.p, B.p, Cc.p, D.p, COL.white, A.n, B.n, Cc.n, D.n, [fusUV(ts[i], ta), fusUV(ts[i + 1], ta), fusUV(ts[i + 1], tb), fusUV(ts[i], tb)]);
    }
    { const r0 = ringAt(P, 0), r1 = ringAt(P, 1);
      for (let j = 0; j < N; j++) { const A = ring(0, j), D = ring(0, j + 1); body.o = [r0[0] - 5, r0[1], 0]; tri(body, A.p, D.p, [r0[0] + 0.1, r0[1], 0], COL.white, null, null, null, fusUV(0, 1.2));
        const B = ring(1, j), Cc = ring(1, j + 1); body.o = [r1[0] + 5, r1[1], 0]; tri(body, B.p, Cc.p, [r1[0] - (P.tail === 'max' ? 0.9 : 0.3), r1[1], 0], COL.exh, null, null, null, PU.white); } }
    // wing-body fairing / sponsons (painted like the keel)
    const keel = fusUV(0.5, Math.PI);
    if (P.gear.spon) box(body, P.mains[0].x - 0.3, P.yb + 0.35, 0, 4.6, 0.9, P.W * 2 + 0.7, COL.white, keel);
    else box(body, P.wing.x - P.wing.cr * 0.45, P.yb + 0.3, 0, P.wing.cr * 1.2, 0.9, P.W * 1.5, COL.white, keel);
    // wings: inboard (unswept trailing edge), outboard, with flex for the 787
    const { zr, half, xLE, yAt, zk, chord } = WG, wt = P.wing.t, wl = P.wing.wl;
    const sta = [zr]; if (P.wing.kink) sta.push(zk); if (hi && P.wing.flex) { sta.push(zk + (half - zk) * 0.45, zk + (half - zk) * 0.75); } sta.push(half);
    const rake = wl === 'raked' ? (P.L > 70 ? 3.6 : 4.4) : 0;
    for (const sgn of [-1, 1]) {
      const pt = (z, le) => [le ? xLE(z) : xLE(z) - chord(z), yAt(z), sgn * z], th = z => wt * (1 - 0.72 * (z - zr) / (half - zr));
      for (let i = 0; i < sta.length - 1; i++) { const za = sta[i], zb = sta[i + 1];
        slab(body, [pt(za, 1), pt(za, 0), pt(zb, 0), pt(zb, 1)], [th(za), th(za) * 0.3, th(zb) * 0.3, th(zb)], 1, COL.wing, COL.wingB); }
      const tx = xLE(half), ty = yAt(half), ct = P.wing.ct, h = P.wing.wlh || 0, z0 = sgn * half;
      if (wl === 'sharklet') { // blended: a short curved root, then a tall swept blade
        slab(body, [[tx - 0.05, ty, z0], [tx - ct, ty, z0], [tx - ct - 0.2, ty + 0.45, z0 + sgn * 0.32], [tx - 0.35, ty + 0.45, z0 + sgn * 0.32]], [0.18, 0.08, 0.08, 0.14], 1, COL.white, null, PU.wlt);
        slab(body, [[tx - 0.35, ty + 0.4, z0 + sgn * 0.3], [tx - ct - 0.2, ty + 0.4, z0 + sgn * 0.3], [tx - h * 0.7 - 0.8, ty + h, z0 + sgn * 0.5], [tx - h * 0.7 - 0.2, ty + h, z0 + sgn * 0.5]], [0.14, 0.06, 0.05, 0.06], 2, COL.white, null, PU.wlt);
      } else if (wl === 'split') { // 737 MAX AT winglet: one blade up, one down
        slab(body, [[tx - 0.1, ty, z0], [tx - ct, ty, z0], [tx - h * 0.8 - 0.6, ty + h, z0 + sgn * 0.35], [tx - h * 0.8 - 0.1, ty + h, z0 + sgn * 0.35]], [0.12, 0.06, 0.04, 0.05], 2, COL.white, null, PU.wlt);
        slab(body, [[tx - 0.2, ty, z0], [tx - ct * 0.8, ty, z0], [tx - 1.2, ty - 0.85, z0 + sgn * 0.3], [tx - 0.75, ty - 0.85, z0 + sgn * 0.3]], [0.1, 0.05, 0.04, 0.04], 2, COL.white, null, PU.wlt);
      } else if (wl === 'classic') {
        slab(body, [[tx - 0.05, ty, z0], [tx - ct * 0.95, ty, z0], [tx - h * 0.9 - 0.9, ty + h, z0 + sgn * 0.3], [tx - h * 0.9, ty + h, z0 + sgn * 0.3]], [0.16, 0.07, 0.05, 0.08], 2, COL.white, null, PU.wlt);
      } else if (wl === 'curve') { // A350: wingtip bending smoothly up and back
        const seg = hi ? 3 : 1; let px = tx, py = ty, pz = half, pc = ct;
        for (let i = 1; i <= seg; i++) { const a = (i / seg) * 72 * D2R, sl = h / seg * 1.25, nx = px - sl * 0.75, ny = py + Math.sin(a) * sl, nz = pz + Math.cos(a) * sl * 0.6, nc = ct * (1 - 0.55 * i / seg);
          slab(body, [[px, py, sgn * pz], [px - pc, py, sgn * pz], [nx - nc, ny, sgn * nz], [nx, ny, sgn * nz]], [0.14, 0.06, 0.05, 0.1], i === seg ? 2 : 1, COL.white, null, PU.wlt); px = nx; py = ny; pz = nz; pc = nc; }
      } else if (wl === 'fence') {
        slab(body, [[tx + 0.4, ty - 0.9, z0], [tx - ct * 0.85, ty - 0.9, z0], [tx - ct * 0.9 - 0.6, ty + h, z0], [tx - 0.8, ty + h, z0]], [0.12, 0.06, 0.05, 0.08], 2, COL.white, null, PU.wlt);
      } else if (wl === 'raked') { // 787 / 777: a highly swept tip panel, no winglet
        slab(body, [[tx, ty, z0], [tx - ct, ty, z0], [tx - rake * 1.15 - 0.35, ty + rake * 0.12, z0 + sgn * rake], [tx - rake * 1.05, ty + rake * 0.12, z0 + sgn * rake]], [wt * 0.28, wt * 0.08, 0.06, 0.08], 1, COL.wing, COL.wingB);
      }
      // engines + pylons
      for (const E of P.eng) {
        const ez = sgn * E.z, x0 = xLE(E.z) + E.fwd, ey = yAt(E.z) - E.drop, r = E.r, len = E.len, NE = hi ? (P.W > 2.5 ? 12 : 10) : 6;
        if (E.prop) {
          revX(body, [[x0, r * 0.55], [x0 - 0.25 * len, r], [x0 - 0.75 * len, r * 0.9], [x0 - len, r * 0.35]], ey, ez, NE, COL.white, PU.eng, null, { k: 1, d: -0.3, c: COL.exh, uv: PU.white });
          revX(body, [[x0 + 0.7, 0.02], [x0 + 0.35, r * 0.4], [x0, r * 0.55]], ey, ez, NE, COL.white, PU.white);
          if (sgn > 0) for (let b = 0; b < 6; b++) { const a = b / 6 * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a), pa = -sa, pb = ca, R = E.prop;
            const w0 = 0.16, w1 = 0.1; const P0 = [0.02, ca * 0.25 + pa * w0, sa * 0.25 + pb * w0], P1 = [0.02, ca * R + pa * w1, sa * R + pb * w1], P2 = [-0.02, ca * R - pa * w1, sa * R - pb * w1], P3 = [-0.02, ca * 0.25 - pa * w0, sa * 0.25 - pb * w0];
            prop.o = [-5, 0, 0]; quad(prop, P0, P1, P2, P3, COL.prop); }
          E.px = x0 + 0.3; E.py = ey;
        } else {
          const rings = hi ? [[x0, r * 0.9], [x0 - 0.12 * len, r], [x0 - 0.45 * len, r * 0.98], [x0 - 0.8 * len, r * 0.8], [x0 - len, r * 0.62]] : [[x0, r * 0.92], [x0 - 0.4 * len, r], [x0 - len, r * 0.65]];
          revX(body, rings, ey, ez, NE, COL.white, PU.eng, { k: 0.86, d: -0.45 * r, c: COL.white, uv: PU.dark }, { k: 1, d: -0.6 * r, c: COL.exh, uv: PU.white }, E.flat, hi ? E.chev : 0);
          if (hi) revX(body, [[x0 + 0.02, r * 0.93], [x0 - 0.06 * len, r * 1.01]], ey, ez, NE, C('#e4e7ea'), PU.white, null, null, E.flat);
          const wy = yAt(E.z), c = chord(E.z);
          slab(body, [[x0 - 0.15 * len, ey + r * 0.6, ez], [x0 - 0.95 * len, ey + r * 0.6, ez], [xLE(E.z) - c * 0.7, wy - 0.05, ez], [xLE(E.z) + 0.3, wy - 0.05, ez]],
            [r * 0.26, r * 0.2, r * 0.16, r * 0.18], 2, COL.pylon);
        }
        E.x0 = x0; E.ey = ey;
      }
    }
    // tailplane, fin (+ dorsal fillet)
    const fin = P.fin, finTE = -P.L / 2 + fin.te, finLE = finTE + fin.cr, rmid = ringAt(P, tOfX(P, (finLE + finTE) / 2));
    const finY = rmid[1] + rmid[3] - 0.25, ftLE = finLE - Math.tan(fin.sw * D2R) * fin.h, finTop = finY + fin.h;
    const fuv = (fx, fy) => [UN0 + fx * (UN1 - UN0), 0.03 + 0.94 * fy];
    slab(body, [[finLE, finY, 0], [finTE, finY, 0], [ftLE - fin.ct, finTop, 0], [ftLE, finTop, 0]], [fin.cr * 0.07, 0.12, 0.08, fin.ct * 0.08], 2, COL.white, null,
      [fuv(0, 1), fuv(1, 1), fuv(1, 0), fuv(0, 0)]);
    const dh = fin.h * 0.22, dLE = finLE - Math.tan(fin.sw * D2R) * dh;
    slab(body, [[finLE + fin.cr * 0.4, finY + 0.05, 0], [finLE - 0.1, finY + 0.05, 0], [dLE - 0.3, finY + dh, 0], [dLE, finY + dh, 0]], [0.3, 0.3, 0.12, 0.12], 2, COL.white, null,
      [fuv(0, 1), fuv(0.05, 1), fuv(0.05, 0.78), fuv(0, 0.78)]);
    P.finTop = finTop;
    const hs = P.hs; let hsY, hsTE, hsLE;
    if (hs.ttail) { hsY = finTop - 0.1; hsLE = ftLE + 0.2; hsTE = hsLE - hs.cr; }
    else { hsTE = -P.L / 2 + hs.te; hsLE = hsTE + hs.cr; const rr = ringAt(P, tOfX(P, (hsLE + hsTE) / 2)); hsY = rr[1] + hs.y * rr[3]; }
    for (const sgn of [-1, 1]) { const tLE = hsLE - Math.tan(hs.sw * D2R) * hs.half, ty = hsY + Math.tan(hs.dh * D2R) * hs.half;
      slab(body, [[hsLE, hsY, 0], [hsTE, hsY, 0], [tLE - hs.ct, ty, sgn * hs.half], [tLE, ty, sgn * hs.half]], [hs.cr * 0.09, 0.08, 0.05, hs.ct * 0.08], 1, COL.stab, COL.wingB); }
    if (hi) {
      // cockpit windows (dark), the A350's black mask, the 787's four panes
      const c0 = P.tn * (P.mask ? 0.3 : 0.36), c1 = P.tn * (P.mask ? 0.6 : 0.54), ca = P.mask ? 78 : P.nose === 'boeing' ? 58 : 62;
      if (P.cock4) for (const [a, b] of [[-56, -31], [-27, -3], [3, 27], [31, 56]]) patch(body, P, c0, c1, 1, (t, u) => (a + (b - a) * u) * D2R, 2, 0.03, COL.white);
      else patch(body, P, c0, c1, 1, (t, u) => (-ca + 2 * ca * u) * D2R, 6, 0.03, COL.white);
      // cabin window rows (each row is a strip textured with the airline's window row; it glows at night)
      const w0 = P.tn * 1.08, w1 = P.tt + (1 - P.tt) * 0.2;
      for (const sgn of [-1, 1]) for (const [a, b] of P.win)
        patch(body, P, w0, w1, 3, (t, u) => sgn * (a + (b - a) * u) * D2R, 1, 0.04, COL.white, (t, u) => [t * UF, 0.845 + 0.07 * u]);
      // door outlines: two thin dark edges per door
      const wa = P.win[P.win.length - 1][0];
      for (const sgn of [-1, 1]) for (const [dt, big] of P.doors || []) {
        const dw = (big ? 1.0 : 0.55) / P.L, a0 = wa - 4, a1 = big ? wa + 24 : wa + 10;
        for (const e of [-1, 1]) { const tc = dt + e * dw / 2; patch(body, P, tc - 0.06 / P.L, tc + 0.06 / P.L, 1, (t, u) => sgn * (a0 + (a1 - a0) * u) * D2R, 1, 0.035, COL.white, () => PU.grey); }
      }
      if (P.deck === 2) for (const sgn of [-1, 1]) for (const dt of [0.2, 0.45, 0.7]) for (const e of [-1, 1]) { const tc = dt + e * 0.5 / P.L;
        patch(body, P, tc - 0.06 / P.L, tc + 0.06 / P.L, 1, (t, u) => sgn * (40 + 18 * u) * D2R, 1, 0.035, COL.white, () => PU.grey); }
    }
    // landing gear (separate mesh: it retracts)
    const G = P.gear, gTop = P.high ? P.yb + 0.3 : WG.rootY - 0.1, ws = hi ? 8 : 5;
    box(gear, P.nx, G.nr, 0, 0.22, P.yb + 0.25 - G.nr, 0.22, COL.strut);
    cylZ(gear, P.nx, G.nr, 0, G.nr, 0.75, ws, COL.tyre);
    for (const M of P.mains) for (const sgn of [-1, 1]) {
      const z = sgn * M.z, top = M.z < P.W ? P.yb + 0.3 : gTop;
      box(gear, M.x, G.r, z, 0.32, top - G.r, 0.32, COL.strut);
      if (M.b === 1) cylZ(gear, M.x, G.r, z, G.r, 1.0, ws, COL.tyre);
      else { const sp = 1.45; for (let kk = 0; kk < M.b; kk++) cylZ(gear, M.x + (kk - (M.b - 1) / 2) * sp, G.r, z, G.r, 1.3, ws, COL.tyre);
        box(gear, M.x, G.r - 0.12, z, sp * (M.b - 1) + 0.4, 0.24, 0.3, COL.strut); }
    }
    P.pv = Math.min(...P.mains.map(m => m.x)); P.gy = P.yb + 0.3 * P.H;
    const tipX = xLE(half) - P.wing.ct * 0.15 - (rake ? rake * 1.05 : 0), tipY = yAt(half) + 0.05 + (rake ? rake * 0.12 : 0), rt = ringAt(P, 1);
    P.LP = { tipX, tipY, tipZ: half + rake + 0.05, tailX: rt[0] - 0.15, tailY: rt[1], topX: P.wing.x - P.wing.cr * 0.3, topY: P.yb + 2 * P.H + 0.12,
      botX: P.wing.x - P.wing.cr * 0.75, botY: P.yb - 0.05, noseX: P.nx + 0.4, noseY: P.yb * 0.8, rootX: P.wing.x + 0.2, rootY: WG.rootY, rootZ: P.W + 1.2 };
    return { body: toGeom(body, liv), gear: hi ? toGeom(gear) : null, prop: prop.p.length ? toGeom(prop) : null };
  }

  /* ---------------- meshes: per type a hi (near, casts shadows), a lo (far) and a gear mesh ---------------- */
  const root = new THREE.Group(); root.name = 'aircraft'; Z.scene.add(root);
  const matBody = new THREE.MeshStandardMaterial({ vertexColors: true, map: texA, emissiveMap: texE, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4, metalness: 0.12 });
  const ambU = { value: 0 };
  matBody.onBeforeCompile = sh => {
    sh.uniforms.uAmb = ambU;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uAmb;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uAmb;');
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aLiv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv.y=(vMapUv.y+aLiv)*' + VK.toFixed(6) + ';\n#endif\n#ifdef USE_EMISSIVEMAP\nvEmissiveMapUv.y=(vEmissiveMapUv.y+aLiv)*' + VK.toFixed(6) + ';\n#endif');
  };
  const matGear = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.2 });
  const matProp = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
  const matDisc = new THREE.MeshBasicMaterial({ color: 0x2a2d31, transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide });
  const IM = (geo, mat, cap, shadow) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.frustumCulled = false; m.castShadow = !!shadow; m.receiveShadow = !!shadow; m.count = 0;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(m); return m; };
  const MESH = {}, TRIS = {};
  let propG = null;
  for (const k of TKEYS) {
    const P = TDEF[k];
    const livH = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1).setUsage(THREE.DynamicDrawUsage), livL = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1).setUsage(THREE.DynamicDrawUsage);
    const gl = buildType(P, false, livL), gh = buildType(P, true, livH);
    if (gh.prop) propG = gh.prop;
    MESH[k] = { hi: IM(gh.body, matBody, CAP, true), lo: IM(gl.body, matBody, CAP, false), gear: IM(gh.gear, matGear, CAP, false), livH, livL, P };
    MESH[k].lo.receiveShadow = true;
    TRIS[k] = [gh.body.attributes.position.count / 3, gl.body.attributes.position.count / 3, gh.gear.attributes.position.count / 3];
  }
  const props = propG ? IM(propG, matProp, CAP * 2, true) : null;
  const discG = new THREE.CircleGeometry(1, 20); discG.rotateY(Math.PI / 2);
  const discs = IM(discG, matDisc, CAP * 2, false); discs.renderOrder = 3;
  Z.aircraftTris = TRIS;

  /* ---------------- blob contact shadows: one soft aircraft-shaped decal per aircraft ---------------- */
  const blobG = new THREE.PlaneGeometry(1, 1); blobG.rotateX(-Math.PI / 2);
  const bU = { fogN: { value: 1e6 }, fogF: { value: 2e6 } };
  const blobs = new THREE.InstancedMesh(blobG, new THREE.ShaderMaterial({ uniforms: bU, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: 'uniform float fogN,fogF;varying vec2 vUv;varying float vS;void main(){vUv=uv;vS=1.;\n#ifdef USE_INSTANCING_COLOR\nvS=instanceColor.r;\n#endif\nvec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;vS*=1.-smoothstep(fogN,fogF,-mv.z);}',
    fragmentShader: 'varying vec2 vUv;varying float vS;void main(){vec2 p=vUv*2.-1.;float f=1.-smoothstep(0.55,1.,length(vec2(p.x,p.y*7.)));float w=1.-smoothstep(0.45,1.,length(vec2((p.x+0.05)*4.2,p.y*1.02)));float t=1.-smoothstep(0.5,1.,length(vec2((p.x+0.86)*9.,p.y*2.8)));float a=max(f,max(w*0.9,t*0.8));if(a<0.01)discard;gl_FragColor=vec4(0.,0.,0.,a*vS);}' }), CAP + 50);
  for (let i = 0; i < CAP + 50; i++) blobs.setColorAt(i, C('#ffffff'));
  blobs.frustumCulled = false; blobs.count = 0; blobs.renderOrder = 1; blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(blobs);
  const _bc = new THREE.Color();
  const WHITE = C('#ffffff');
  /* ---------------- point sprites: lights (additive) and particles (alpha) ---------------- */
  const gl = Z.renderer.getContext(); let maxPt = 256; try { const r = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE); if (r && r[1]) maxPt = Math.min(1024, r[1]); } catch (e) { /* keep default */ }
  const LCAP = 9000, lPos = new Float32Array(LCAP * 3), lCol = new Float32Array(LCAP * 3), lSize = new Float32Array(LCAP);
  const lGeo = new THREE.BufferGeometry();
  const lPA = new THREE.BufferAttribute(lPos, 3).setUsage(THREE.DynamicDrawUsage), lCA = new THREE.BufferAttribute(lCol, 3).setUsage(THREE.DynamicDrawUsage), lSA = new THREE.BufferAttribute(lSize, 1).setUsage(THREE.DynamicDrawUsage);
  lGeo.setAttribute('position', lPA); lGeo.setAttribute('color', lCA); lGeo.setAttribute('size', lSA); lGeo.setDrawRange(0, 0);
  const lU = { pxs: { value: 600 }, fogN: { value: 1e6 }, fogF: { value: 2e6 }, maxPt: { value: maxPt } };
  const lMat = new THREE.ShaderMaterial({ uniforms: lU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float size;attribute vec3 color;uniform float pxs,fogN,fogF,maxPt;varying vec3 vC;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;float d=max(-mv.z,1.);float px=size*pxs/d;float k=clamp(px/2.2,0.3,1.);gl_PointSize=clamp(max(px,2.2),1.,maxPt);float fg=1.-smoothstep(fogN,fogF,d);vC=color*k*fg;}',
    fragmentShader: 'varying vec3 vC;void main(){vec2 q=gl_PointCoord*2.-1.;float r2=dot(q,q);if(r2>1.)discard;float a=exp(-r2*4.5)*(1.-r2)+0.8*exp(-r2*40.);gl_FragColor=vec4(vC*a,1.);}' });
  const lights = new THREE.Points(lGeo, lMat); lights.frustumCulled = false; lights.renderOrder = 5; root.add(lights);
  let nL = 0;
  function L(x, y, z, r, g, b, s) { if (nL >= LCAP) return; const i = nL++; lPos[i * 3] = x; lPos[i * 3 + 1] = y; lPos[i * 3 + 2] = z; lCol[i * 3] = r; lCol[i * 3 + 1] = g; lCol[i * 3 + 2] = b; lSize[i] = s; }

  const PCAP = 4000, pPos = new Float32Array(PCAP * 3), pCol = new Float32Array(PCAP * 4), pSize = new Float32Array(PCAP);
  const pr = { x: new Float32Array(PCAP), y: new Float32Array(PCAP), z: new Float32Array(PCAP), vx: new Float32Array(PCAP), vy: new Float32Array(PCAP), vz: new Float32Array(PCAP),
    age: new Float32Array(PCAP).fill(1e9), life: new Float32Array(PCAP).fill(1), s0: new Float32Array(PCAP), s1: new Float32Array(PCAP), a0: new Float32Array(PCAP),
    r: new Float32Array(PCAP), g: new Float32Array(PCAP), b: new Float32Array(PCAP), drag: new Float32Array(PCAP) };
  let pHead = 0;
  const pGeo = new THREE.BufferGeometry();
  const pPA = new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage), pCA = new THREE.BufferAttribute(pCol, 4).setUsage(THREE.DynamicDrawUsage), pSA = new THREE.BufferAttribute(pSize, 1).setUsage(THREE.DynamicDrawUsage);
  pGeo.setAttribute('position', pPA); pGeo.setAttribute('col', pCA); pGeo.setAttribute('size', pSA); pGeo.setDrawRange(0, 0);
  const pU = { pxs: { value: 600 }, lum: { value: 1 }, maxPt: { value: maxPt } };
  const pMat = new THREE.ShaderMaterial({ uniforms: pU, transparent: true, depthWrite: false,
    vertexShader: 'attribute float size;attribute vec4 col;uniform float pxs,maxPt;varying vec4 vC;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;float d=max(-mv.z,1.);float px=size*pxs/d;gl_PointSize=clamp(px,1.,maxPt);vC=col;vC.a*=clamp(px/3.,0.,1.)*min(1.,maxPt/max(px,1.));}',
    fragmentShader: 'uniform float lum;varying vec4 vC;void main(){vec2 q=gl_PointCoord*2.-1.;float r2=dot(q,q);if(r2>1.)discard;float a=(1.-r2);a*=a;float sh=0.82+0.18*(q.y*0.5+0.5);gl_FragColor=vec4(vC.rgb*lum*sh,vC.a*a);}' });
  const parts = new THREE.Points(pGeo, pMat); parts.frustumCulled = false; parts.renderOrder = 4; root.add(parts);
  function emit(x, y, z, vx, vy, vz, life, s0, s1, a0, r, g, b, drag) {
    const i = pHead; pHead = (pHead + 1) % PCAP;
    pr.x[i] = x; pr.y[i] = y; pr.z[i] = z; pr.vx[i] = vx; pr.vy[i] = vy; pr.vz[i] = vz; pr.age[i] = 0; pr.life[i] = life; pr.s0[i] = s0; pr.s1[i] = s1; pr.a0[i] = a0;
    pr.r[i] = r; pr.g[i] = g; pr.b[i] = b; pr.drag[i] = drag;
  }

  /* ---------------- ground vehicles: instanced boxes ---------------- */
  const BCAP = 5000;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const boxes = new THREE.InstancedMesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.1 }), BCAP);
  for (let i = 0; i < BCAP; i++) boxes.setColorAt(i, WHITE);
  boxes.frustumCulled = false; boxes.castShadow = true; boxes.receiveShadow = true; boxes.instanceMatrix.setUsage(THREE.DynamicDrawUsage); boxes.count = 0; root.add(boxes);
  const VC = { yel: C('#f0bd1e'), yelD: C('#b58a12'), dark: C('#2a2e33'), glass: C('#34465a'), white: C('#eceef0'), tank: C('#d9dde2'), blue: C('#2d5fae'),
    grey: C('#7c838b'), red: C('#c42a1f'), tug: C('#e8e2d4'), belt: C('#3b3e42'), green: C('#2f7d4a'), bird: C('#1d1915') };
  // birds: one wing, mirrored by a negative z scale for the other side
  const birdG = new THREE.BufferGeometry(); birdG.setAttribute('position', new THREE.Float32BufferAttribute([0.35, 0, 0, -0.25, 0, 0, -0.15, 0, 1, 0.35, 0, 0, -0.15, 0, 1, 0.1, 0, 0.75], 3)); birdG.computeVertexNormals();
  const birds = new THREE.InstancedMesh(birdG, new THREE.MeshBasicMaterial({ color: 0x1d1915, side: THREE.DoubleSide }), 400);
  birds.frustumCulled = false; birds.count = 0; birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(birds);

  /* ---------------- scratch ---------------- */
  const _m = new THREE.Matrix4(), _mg = new THREE.Matrix4(), _mr = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qy = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YZX');
  const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
  const hiN = {}, loN = {}, gN = {}; for (const k of TKEYS) { hiN[k] = 0; loN[k] = 0; gN[k] = 0; }
  let nProp = 0, nDisc = 0, nBlob = 0;
  const _mb = new THREE.Matrix4(), _qb = new THREE.Quaternion(), _pb = new THREE.Vector3(), _sb = new THREE.Vector3(), _eb = new THREE.Euler(0, 0, 0, 'YZX');
  const SKIP = { sched: 1, gone: 1, diverted: 1, towed: 1, cancelled: 1 };
  const OFF = { at_gate: 1, parked: 1, dock: 1, tow: 1 };
  const AIR = { inbound: 1, holding: 1, approach: 1, goaround: 1, divert: 1, climb: 1, roll: 1 };
  const STROBE = { lineup: 1, roll: 1, climb: 1, approach: 1, goaround: 1, inbound: 1, holding: 1, divert: 1, rollout: 1 };
  const LAND = { approach: 1, rollout: 1, lineup: 1, roll: 1, climb: 1, goaround: 1 };
  const TAXI = { taxi_in: 1, taxi_out: 1, hp: 1, nogate: 1, stuck: 1 };
  const mem = new Map(); let frame = 0, lastT = -1, cleanT = 0;
  let nB = 0, nBird = 0;
  function bx(vx, vz, h, k, cx, cy, cz, l, hh, w, col, pitch) {
    if (nB >= BCAP) return; const c = Math.cos(h), s = Math.sin(h);
    _p.set(vx + (c * cx - s * cz) * k, cy * k, vz + (s * cx + c * cz) * k);
    _e.set(0, -h, pitch || 0); _q.setFromEuler(_e); _s.set(l * k, hh * k, w * k); _m.compose(_p, _q, _s);
    boxes.setMatrixAt(nB, _m); boxes.setColorAt(nB, col); nB++;
  }
  let NOW = 0, NF = 0;
  function beacon(vx, vz, h, k, cx, cy, ph) { // amber rotating beacon
    if (Math.sin(NOW * 9 + ph) < 0.15) return; const c = Math.cos(h), s = Math.sin(h);
    L(vx + c * cx * k, cy * k, vz + s * cx * k, 1.0, 0.55, 0.08, (0.9 + 1.6 * NF) * k);
  }
  // vehicle kinds: draws boxes at (x, z) heading h, scale k
  function veh(kind, x, z, h, k, ph, lift) {
    switch (kind) {
      case 'tug': bx(x, z, h, k, 0, 0, 0, 5.6, 1.15, 2.7, VC.tug); bx(x, z, h, k, -1.9, 1.15, 0, 1.3, 0.85, 1.7, VC.glass); bx(x, z, h, k, 2.6, 0.1, 0, 0.5, 0.6, 2.8, VC.dark); beacon(x, z, h, k, -1.9, 2.2, ph); break;
      case 'optug': bx(x, z, h, k, 0, 0, 0, 5.6, 1.15, 2.7, VC.yel); bx(x, z, h, k, -1.9, 1.15, 0, 1.3, 0.85, 1.7, VC.glass); beacon(x, z, h, k, -1.9, 2.2, ph); break;
      case 'bowser': bx(x, z, h, k, 0.3, 0.15, 0, 9.4, 0.65, 2.3, VC.dark); bx(x, z, h, k, 3.6, 0.6, 0, 2.0, 2.1, 2.4, VC.white); bx(x, z, h, k, 4.2, 1.6, 0, 0.9, 0.9, 2.42, VC.glass);
        bx(x, z, h, k, -0.9, 0.8, 0, 6.6, 2.0, 2.35, VC.tank); bx(x, z, h, k, -0.9, 1.3, 0, 6.62, 0.35, 2.37, VC.green); beacon(x, z, h, k, 3.6, 2.8, ph); break;
      case 'cater': bx(x, z, h, k, 0, 0.15, 0, 7.8, 0.75, 2.4, VC.dark); bx(x, z, h, k, 3.0, 0.6, 0, 1.8, 1.9, 2.4, VC.white); bx(x, z, h, k, 3.5, 1.4, 0, 0.8, 0.8, 2.42, VC.glass);
        if (lift > 0.3) bx(x, z, h, k, -0.9, 0.9, 0, 2.6, lift, 1.6, VC.grey);
        bx(x, z, h, k, -0.9, 0.9 + lift, 0, 5.2, 2.6, 2.45, VC.white); bx(x, z, h, k, -0.9, 0.9 + lift + 2.0, 0, 5.22, 0.3, 2.47, VC.blue); beacon(x, z, h, k, 3.0, 2.7, ph); break;
      case 'belt': { bx(x, z, h, k, 0, 0.15, 0, 7.0, 0.8, 1.9, VC.yelD); bx(x, z, h, k, -2.4, 0.95, -0.55, 1.2, 1.1, 0.8, VC.glass);
        const top = Math.max(1.3, lift), len = 8.6, pa = Math.asin(clamp((top - 0.9) / len, 0, 0.6));
        bx(x, z, h, k, 0.5, (0.9 + top) / 2 - 0.2, 0.3, len, 0.3, 0.9, VC.belt, pa); beacon(x, z, h, k, -2.4, 2.2, ph); break; }
      case 'bus': bx(x, z, h, k, 0, 0.3, 0, 13.2, 2.9, 2.7, VC.blue); bx(x, z, h, k, 0, 1.45, 0, 12.6, 1.05, 2.74, VC.glass); bx(x, z, h, k, 0, 3.15, 0, 12.8, 0.12, 2.6, VC.white); break;
      case 'jeep': bx(x, z, h, k, 0, 0.3, 0, 4.6, 1.0, 1.9, VC.yel); bx(x, z, h, k, -0.5, 1.3, 0, 2.5, 0.85, 1.8, VC.glass); bx(x, z, h, k, -0.5, 2.1, 0, 2.5, 0.08, 1.82, VC.yel); beacon(x, z, h, k, -0.3, 2.35, ph); break;
      case 'redjeep': bx(x, z, h, k, 0, 0.3, 0, 4.6, 1.0, 1.9, VC.red); bx(x, z, h, k, -0.5, 1.3, 0, 2.5, 0.85, 1.8, VC.glass); beacon(x, z, h, k, -0.3, 2.35, ph); break;
      case 'sweeper': bx(x, z, h, k, 0, 0.3, 0, 6.8, 2.3, 2.5, VC.yel); bx(x, z, h, k, 2.2, 2.6, 0, 2.0, 1.0, 2.2, VC.glass); bx(x, z, h, k, 3.9, 0, 0, 1.0, 0.8, 2.9, VC.dark);
        bx(x, z, h, k, -1.2, 2.6, 0, 3.6, 0.6, 2.3, VC.yelD); beacon(x, z, h, k, 2.2, 3.8, ph); break;
    }
  }

  /* ---------------- motion helpers ---------------- */
  function visAlt(f) { // the sim's glide path is a straight 3 degree line to the ground; draw a flare over the last 15 m
    const s = f.state;
    if (s === 'approach' && f.rwy && f.finalStart != null && f.pd >= f.finalStart) {
      const d = f.x - (f.rwy.x1 - 450);
      if (d < 577) return d <= 0 ? 0 : 15 * Math.pow(d / 577, 2.07);
      return f.alt * 0.55;
    }
    if (s === 'roll') return Math.max(0, f.alt) * 0.55;
    return Z.altM(f);
  }
  function pitchT(f, st, alt, T) { // degrees
    switch (f.state) {
      case 'approach': return alt > 15 ? 2.5 : alt > 0.05 ? 2.5 + 3.5 * (1 - alt / 15) : 5.5;
      case 'rollout': { const t = T - st.tdT; return t < 0.9 ? 5.5 : (t > 4 && f.v > 20) ? -0.7 : 0; }
      case 'roll': { if (f.rto) return -0.6; if (f.alt > 0) return 9; const lift = f.T.code === 'C' ? 1500 : Z.heatNow ? 3000 : 2300; return (f.v > 64 && f.s > lift - 6.5 * f.v) ? 9 : 0; }
      case 'climb': return 9;
      case 'goaround': return 8;
      case 'divert': return 5;
      case 'inbound': return 1;
      case 'holding': return 2.5;
      default: return 0;
    }
  }
  function gearT(f, alt) { const s = f.state; if (alt < 1) return 1; if (s === 'approach') return alt < 450 ? 1 : 0; if (s === 'roll') return alt > 30 ? 0 : 1; return 0; }
  const lw = (x, y, z) => _v.set(x, y, z).applyMatrix4(_m);
  // a ground-support vehicle placed in the aircraft's frame: slot (lx, lz) in model metres, drives in/out along an offset
  function gse(f, sx, sz, k, kind, lx, lz, relH, uIn, uOut, ph, lift) {
    if (uIn <= 0 || uOut >= 1) return;
    const ei = 1 - sstep(uIn), eo = sstep(uOut), c = Math.cos(f.heading), sn = Math.sin(f.heading);
    const ox = lx * sx * k - (22 * ei + 30 * eo) * k, oz = lz * sz * k + (Math.sign(lz) || 1) * (38 * ei + 45 * eo) * k;
    veh(kind, f.x + c * ox - sn * oz, f.y + sn * ox + c * oz, f.heading + relH + (ei - eo) * 0.9 * (Math.sign(lz) || 1), k, ph, lift);
  }
  let SDT = 0, RDT = 0;
  const sm = (tS, tR) => 1 - Math.exp(-Math.min(SDT / tS, RDT / tR));
  const uIn = (T, ib, d) => (ib < -1e8 ? 1 : clamp((T - ib - d) / 30, 0, 1)), uOut = (T, ra, lead) => clamp((T - (ra - lead)) / 30, 0, 1);
  const cleaner = (st, id) => { if (st.seen !== frame) mem.delete(id); };
  function upd(a, n) { a.needsUpdate = true; if (a.addUpdateRange) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, n) * a.itemSize); } }

  return {
    update(dt, now) {
      frame++; NOW = now; NF = Z.nightF || 0;
      const T = Z.T, F = Z.flights(), k = Z.kEx, dust = !!Z.dustNow;
      let dts = T - lastT, snap = false;
      if (lastT < 0 || dts < 0 || dts > 20) { snap = true; dts = 0; mem.clear(); }
      lastT = T; dts = Math.min(dts, 2);
      // the sim runs ~20 sim-seconds per real second: every smoothing has a real-time floor so motion stays visible,
      // and particles live in real time (frozen while paused)
      const rdt = Math.min(dt, 0.1), pdt = dts > 0 ? rdt : 0; SDT = dts; RDT = rdt;
      const cam = Z.camera, pxs = Z.renderer.domElement.height / (2 * Math.tan(cam.fov * D2R / 2));
      lU.pxs.value = pxs; pU.pxs.value = pxs;
      const fog = Z.scene.fog; if (fog) { lU.fogN.value = fog.near * 1.5; lU.fogF.value = fog.far * 1.6; }
      pU.lum.value = 0.28 + 0.72 * (1 - NF);
      for (let j = 0; j < TKEYS.length; j++) { const kk = TKEYS[j]; hiN[kk] = 0; loN[kk] = 0; gN[kk] = 0; }
      nL = 0; nB = 0; nBird = 0; nProp = 0; nDisc = 0; nBlob = 0;
      const cp = cam.position, nearR = 1800 * k, nearR2 = nearR * nearR;
      const sd = Z.sunDir || _pb.set(0, 1, 0), sdy = Math.max(0.3, sd.y), sunUp = clamp(sd.y * 4, 0, 1), blobLift = 0.15 + Math.min(3, (Z.camDist || 1000) * 0.0003);
      if (fog) { bU.fogN.value = fog.near; bU.fogF.value = fog.far; }
      const nav = 0.18 + 0.95 * NF, navS = (0.8 + 2.4 * NF) * k;
      for (let i = 0; i < F.length; i++) {
        const f = F[i], s = f.state; if (SKIP[s]) continue;
        const fam = MESH[f.type] ? f.type : 'A20N', M = MESH[fam], P = M.P;
        if (hiN[fam] + loN[fam] >= CAP) continue;
        let st = mem.get(f.id), fresh = false;
        if (!st) { st = { hd: f.heading, hr: 0, bank: 0, pitch: 0, gear: 1, prev: s, px: f.x, py: f.y, spd: 0, tdT: -1e9, smokeT: -1e9, smokeN: 0, ph: Math.random(), ph2: Math.random(), prop: Math.random() * 6, spool: 0, acc: 0, seen: 0 }; mem.set(f.id, st); fresh = true; }
        st.seen = frame;
        const alt = visAlt(f);
        if (st.prev !== s) { if (s === 'rollout' && st.prev === 'approach' && !fresh) { st.tdT = T; st.smokeT = T; st.smokeN = 0; } st.prev = s; }
        if (fresh && s === 'rollout') st.tdT = T - 30;
        const pt = pitchT(f, st, alt, T) * D2R, gt = gearT(f, alt);
        if (fresh || snap) { st.pitch = pt; st.gear = gt; st.hd = f.heading; st.px = f.x; st.py = f.y; st.hr = 0; st.bank = 0; st.spd = f.v || (AIR[s] ? 75 : 0); }
        else if (dts > 0) {
          const dh = angD(st.hd, f.heading); st.hd = f.heading;
          const a1 = sm(0.6, 0.12), a2 = sm(1.1, 0.3);
          st.hr += (dh / dts - st.hr) * a1;
          const sp = Math.hypot(f.x - st.px, f.y - st.py) / dts; st.px = f.x; st.py = f.y; if (sp < 400) st.spd += (sp - st.spd) * sm(0.8, 0.15);
          const bt = alt > 3 && AIR[s] ? clamp(Math.atan(st.spd * st.hr / 9.81), -25 * D2R, 25 * D2R) : 0;
          st.bank += (bt - st.bank) * a2;
          const rate = Math.min((s === 'rollout' ? 2.6 : 3.2) * dts, 14 * rdt) * D2R; st.pitch += clamp(pt - st.pitch, -rate, rate);
          const gr = Math.min(dts / 7, rdt / 0.9); st.gear += clamp(gt - st.gear, -gr, gr);
        }
        // matrix: yaw, then pitch and bank about the main-gear contact point (rotation and flare pivot on the mains)
        const sx = 1, sz = 1, sy = 1, yaw = -f.heading;
        _e.set(st.bank, yaw, st.pitch); _q.setFromEuler(_e); _e.set(0, yaw, 0); _qy.setFromEuler(_e);
        _v1.set(P.pv * sx * k, 0, 0); _v2.copy(_v1).applyQuaternion(_q); _v1.applyQuaternion(_qy);
        _p.set(f.x + _v1.x - _v2.x, alt + _v1.y - _v2.y, f.y + _v1.z - _v2.z); _s.set(sx * k, sy * k, sz * k);
        _m.compose(_p, _q, _s);
        const ddx = f.x - cp.x, ddy = alt - cp.y, ddz = f.y - cp.z, near = ddx * ddx + ddy * ddy + ddz * ddz < nearR2, li = AIDX[f.al] || 0;
        if (near) { const idx = hiN[fam]++; M.hi.setMatrixAt(idx, _m); M.livH.array[idx] = li;
          if (st.gear > 0.01) { const g = sstep(clamp(st.gear, 0, 1)); _mr.makeScale(1, g, 1); _mr.elements[13] = P.gy * (1 - g); _mg.multiplyMatrices(_m, _mr); M.gear.setMatrixAt(gN[fam]++, _mg); } }
        else { const idx = loN[fam]++; M.lo.setMatrixAt(idx, _m); M.livL.array[idx] = li; }
        const run = !OFF[s];
        if (P.eng[0].prop) { // spool up in 'start'; blades turn slowly, then blur into a disc
          const tgt = !run || s === 'push' ? 0 : s === 'start' ? clamp((T - (f.startT || T)) / 18, 0, 1) : 1;
          st.spool += (tgt - st.spool) * (1 - Math.exp(-rdt / 1.6)); st.prop += rdt * 30 * st.spool;
          if (near) for (let e = 0; e < P.eng.length; e++) { const E = P.eng[e]; for (let sg = -1; sg <= 1; sg += 2) {
            if (st.spool < 0.7 && props) { _mr.makeRotationX(st.prop + sg); _mr.setPosition(E.px, E.py, sg * E.z); _mg.multiplyMatrices(_m, _mr); props.setMatrixAt(nProp++, _mg); }
            if (st.spool > 0.25) { const r = E.prop; _mr.makeScale(1, r, r); _mr.setPosition(E.px, E.py, sg * E.z); _mg.multiplyMatrices(_m, _mr); discs.setMatrixAt(nDisc++, _mg); } } }
        }
        { // blob shadow: under the aircraft on the ground, cast along the sun when airborne, fading with height
          const str = (0.26 + 0.24 * sunUp) * (1 - clamp(alt / 650, 0, 1)) * (dust ? 0.7 : 1);
          if (str > 0.01 && nBlob < CAP + 50) { const gr = 1 + alt / 260, off = sd.y > 0.05 ? alt / sdy : 0;
            _eb.set(0, yaw, 0); _qb.setFromEuler(_eb); _pb.set(f.x - sd.x * off, blobLift, f.y - sd.z * off); _sb.set(f.T.len * 1.04 * k * gr, 1, f.T.span * 1.02 * k * gr);
            _mb.compose(_pb, _qb, _sb); blobs.setMatrixAt(nBlob, _mb); _bc.setRGB(str, str, str); blobs.setColorAt(nBlob++, _bc); }
        }
        // ---- lights ----
        const LP = P.LP;
        if (run || NF > 0.35) {
          lw(LP.tipX, LP.tipY, -LP.tipZ); L(_v.x, _v.y, _v.z, 1.0 * nav, 0.07 * nav, 0.05 * nav, navS);
          lw(LP.tipX, LP.tipY, LP.tipZ); L(_v.x, _v.y, _v.z, 0.08 * nav, 1.0 * nav, 0.35 * nav, navS);
          lw(LP.tailX, LP.tailY, 0); L(_v.x, _v.y, _v.z, 0.85 * nav, 0.85 * nav, 0.85 * nav, navS * 0.85);
        }
        if (run) {
          const ph = (now + st.ph) % 1, bi = ph < 0.16 ? 1 - ph / 0.16 : 0;
          if (bi > 0) { const bI = (0.9 + 1.6 * NF) * bi, bS = (1.4 + 2.6 * NF) * k; lw(LP.topX, LP.topY, 0); L(_v.x, _v.y, _v.z, bI, 0.1 * bI, 0.05 * bI, bS); }
          const ph3 = (now + st.ph + 0.5) % 1, bj = ph3 < 0.16 ? 1 - ph3 / 0.16 : 0;
          if (bj > 0) { const bI = (0.9 + 1.6 * NF) * bj, bS = (1.4 + 2.6 * NF) * k; lw(LP.botX, LP.botY, 0); L(_v.x, _v.y, _v.z, bI, 0.1 * bI, 0.05 * bI, bS); }
        }
        if (STROBE[s]) {
          const t = (now / 1.2 + st.ph2) % 1;
          if (t < 0.035 || (t > 0.11 && t < 0.145)) { const sS = (2.2 + 4.5 * NF) * k;
            lw(LP.tipX, LP.tipY, -LP.tipZ); L(_v.x, _v.y, _v.z, 1.6, 1.6, 1.75, sS); lw(LP.tipX, LP.tipY, LP.tipZ); L(_v.x, _v.y, _v.z, 1.6, 1.6, 1.75, sS);
            lw(LP.tailX, LP.tailY, 0); L(_v.x, _v.y, _v.z, 1.3, 1.3, 1.4, sS * 0.8); }
        }
        if (LAND[s]) {
          const I = 0.4 + 1.3 * NF; lw(LP.noseX, LP.noseY, 0); L(_v.x, _v.y, _v.z, I, 0.96 * I, 0.86 * I, (1.1 + 18 * NF) * k);
          const I2 = 0.35 + 0.9 * NF, S2 = (1.2 + 6 * NF) * k; lw(LP.rootX, LP.rootY, -LP.rootZ); L(_v.x, _v.y, _v.z, I2, 0.95 * I2, 0.85 * I2, S2); lw(LP.rootX, LP.rootY, LP.rootZ); L(_v.x, _v.y, _v.z, I2, 0.95 * I2, 0.85 * I2, S2);
        } else if (TAXI[s] && NF > 0.15) { const I = 0.9 * NF; lw(LP.noseX, LP.noseY, 0); L(_v.x, _v.y, _v.z, I, 0.95 * I, 0.85 * I, (1 + 7 * NF) * k); }
        // ---- particles ----
        if (pdt > 0) {
          const hc = Math.cos(f.heading), hs = Math.sin(f.heading), v = f.v || st.spd;
          if (st.smokeT === T && f.rwy) { // tyre smoke: a streak of puffs from the touchdown point to where the mains are now
            const dx = f.x - (f.rwy.x1 - 450), dz = f.y - f.rwy.y;
            for (let j = 0; j < 22; j++) { const Mg = P.mains[j % P.mains.length], sg = (j >> 1) % 2 ? 1 : -1, u = Math.min(1, (j >> 2) / 4);
              lw(Mg.x, 0.8, sg * Mg.z); const r = Math.random();
              emit(_v.x - dx * (1 - u) + (r - 0.5) * 4, _v.y, _v.z - dz * (1 - u) + (Math.random() - 0.5) * 2, hc * 5 + (r - 0.5) * 3, 1.2 + r * 1.6, hs * 5 + sg * (1 + Math.random() * 2.5),
                2.0 + r * 1.2, 2.5 * k, (15 + r * 12) * k, 0.72, 0.94, 0.94, 0.92, 0.8); }
          }
          const tr = T - st.tdT;
          if (s === 'rollout' && tr > 1 && tr < 12) { // reverse-thrust haze, thrown forward and out from the cowls
            st.acc += pdt * 40;
            while (st.acc >= 1) { st.acc -= 1;
              for (let e = 0; e < P.eng.length; e++) { const E = P.eng[e]; for (let sg = -1; sg <= 1; sg += 2) {
                lw(E.x0 - E.len * 0.4, E.ey, sg * (E.z + E.r * 0.9)); const r = Math.random(), out = sg * (4 + r * 4);
                emit(_v.x, _v.y, _v.z, hc * 6 - hs * out, 0.6 + r, hs * 6 + hc * out, 0.8 + r * 0.5, 2.4 * k, (8 + r * 5) * k, dust ? 0.22 : 0.13, dust ? 0.78 : 0.88, dust ? 0.68 : 0.88, dust ? 0.55 : 0.88, 1.5); } } }
          }
          if (dust && (((s === 'roll' && alt < 12) || s === 'rollout') && v > 25)) { // dust kicked up by take-offs and landings in the storm
            st.acc += pdt * 150;
            while (st.acc >= 1) { st.acc -= 1; const E = P.eng[0], sg = Math.random() < 0.5 ? -1 : 1;
              lw(E.x0 - E.len - 3, 0.6, sg * E.z * (0.6 + Math.random() * 0.8)); const r = Math.random();
              emit(_v.x, Math.max(0.5, _v.y - alt), _v.z, -hc * (8 + r * 8), 1.5 + r * 2, -hs * (8 + r * 8), 2.4 + r * 1.6, 6 * k, (26 + r * 18) * k, 0.42, 0.8, 0.64, 0.46, 0.8); }
          }
        }
        // ---- ground support ----
        if ((s === 'at_gate' && T < f.readyAt) || (s === 'parked' && f.inBlock != null && T < f.inBlock + 900)) {
          const ib = f.inBlock != null ? f.inBlock : -1e9, ra = s === 'at_gate' ? f.readyAt : ib + 900, id = f.id;
          gse(f, sx, sz, k, 'belt', P.nx * 0.5, P.W + 4.4, -Math.PI / 2, uIn(T, ib, 15), uOut(T, ra, 150), id, (P.yb + 0.3 * P.H) * sy);
          const lift = Math.max(0, (P.yb + 0.75 * P.H) * sy - 1.3), le = Math.min(clamp((T - ib - 95) / 35, 0, 1), 1 - clamp((T - (ra - 360)) / 35, 0, 1));
          gse(f, sx, sz, k, 'cater', -P.L * 0.37, P.W + 3.7, Math.PI / 2, uIn(T, ib, 40), uOut(T, ra, 300), id + 1, lift * (ib < -1e8 ? 1 : le));
          if (s === 'at_gate') { const E = P.eng[0], lz = E.z + E.r + 3.2; gse(f, sx, sz, k, 'bowser', P.WG.xLE(lz) + 5.5, lz, 0, uIn(T, ib, 70), uOut(T, ra, 420), id + 2, 0); }
        }
        if (f.gate && f.gate.remote && (s === 'at_gate' || s === 'parked')) {
          const ib = f.inBlock != null ? f.inBlock : -1e9, go = s === 'at_gate' ? Math.max(f.std || 0, f.readyAt || 0) : -1e9;
          if (ib > -1e8 && T < ib + 420) gse(f, sx, sz, k, 'bus', P.nx * 0.42, -(P.W + 7), 0, clamp((T - ib - 10) / 30, 0, 1), clamp((T - ib - 390) / 30, 0, 1), f.id + 3, 0);
          else if (s === 'at_gate' && T > f.readyAt - 480 && T < go + 30) gse(f, sx, sz, k, 'bus', P.nx * 0.42, -(P.W + 7), 0, clamp((T - (f.readyAt - 480)) / 30, 0, 1), clamp((T - go) / 30, 0, 1), f.id + 3, 0);
        }
        if (s === 'push' || s === 'tow' || (s === 'start' && T - (f.startT || T) < 32)) {
          const nose = (P.L / 2) * sx + 3.4, hc = Math.cos(f.heading), hs = Math.sin(f.heading);
          let lx = nose, lz = 0, h = f.heading + Math.PI;
          if (s === 'tow' && f.pd >= 90) h = f.heading;
          if (s === 'start') { const u = clamp((T - f.startT - 8) / 24, 0, 1); lx = nose + 22 * u; lz = -26 * u * u; h = f.heading + Math.PI - u * 2.2; }
          veh('tug', f.x + (hc * lx - hs * lz) * k, f.y + (hs * lx + hc * lz) * k, h, k, f.id, 0);
        }
      }
      // ---- airside ops vehicles ----
      const O = Z.ops();
      for (let i = 0; i < O.length; i++) {
        const o = O[i];
        if (o.kind === 'birds') {
          const u = clamp((T - o.t0) / 60, 0, 1); veh('jeep', o.sx + (o.x - o.sx) * sstep(u), o.y, Math.PI, k, o.id, 0);
          const sc = clamp((T - o.t0 - 50) / 70, 0, 1);
          if (sc < 1) for (let b = 0; b < 9 && nBird < 398; b++) {
            const an = now * (0.55 + b * 0.04) + b * 0.7, rad = (45 + 7 * b) * (1 + sc * 5), bxw = o.x + Math.cos(an) * rad, bzw = o.y + Math.sin(an) * rad * 0.8;
            const by = 22 + b * 3.5 + sc * sc * 220 + Math.sin(now * 0.9 + b) * 4, fl = Math.sin(now * 11 + b * 1.7) * 0.7, hh = -(an + Math.PI / 2), bs = 2.4 * k * (1 - sc * 0.3);
            for (let w = -1; w <= 1; w += 2) { _e.set(-w * fl, hh, 0); _q.setFromEuler(_e); _p.set(bxw, by, bzw); _s.set(bs, bs, w * bs); _m.compose(_p, _q, _s); birds.setMatrixAt(nBird++, _m); }
          }
        } else if (o.kind === 'fod') {
          const r = o.r;
          if (o.phase === 'wait') { veh('sweeper', r.x1 + 140, r.y + (r.y < 0 ? -110 : 110), Math.PI, k, o.id, 0); const p = 0.6 + 0.4 * Math.sin(now * 5); L(o.x, 0.4, r.y, 1.0 * p, 0.25 * p, 0.08 * p, (1.4 + 2 * NF) * k); }
          else { const u = clamp((T - o.ts) / Z.OPSW, 0, 1), x = (r.x1 - 60) + ((r.x0 + 60) - (r.x1 - 60)) * u; veh('sweeper', x, r.y, Math.PI, k, o.id, 0);
            if (pdt > 0 && u < 1) for (let j = 0; j < 2; j++) { const q = Math.random(); emit(x - 3.9 * k, 0.5, r.y + (q - 0.5) * 3 * k, 8 + q * 6, 1 + q, (Math.random() - 0.5) * 3, 1.6 + q, 1.6 * k, (6 + q * 5) * k, 0.2, 0.7, 0.64, 0.55, 1.2); } }
        } else if (o.kind === 'tug' && o.f) {
          const f = o.f, a = f.heading, u = clamp((T - o.t0) / 60, 0, 1), d = (f.T.len * 0.5 + 3.4) * k, tx = f.x + Math.cos(a) * d, ty = f.y + Math.sin(a) * d;
          const e = sstep(u), h = u < 1 ? Math.atan2(ty - o.sy, tx - o.sx) : a + Math.PI; veh('optug', o.sx + (tx - o.sx) * e, o.sy + (ty - o.sy) * e, h, k, o.id, 0);
        }
      }
      const CN = Z.CONC; for (let i = 0; i < CN.length; i++) { const c = CN[i]; if (c.laneShut > T || c.slowUntil > T) veh(c.laneShut > T ? 'redjeep' : 'optug', c.lx, c.ly, Math.PI / 2, k, i * 3.1, 0); }
      // ---- particles ----
      let np = 0;
      for (let i = 0; i < PCAP; i++) {
        if (pr.age[i] >= pr.life[i]) continue;
        pr.age[i] += pdt; const a = pr.age[i] / pr.life[i]; if (a >= 1) continue;
        const dr = Math.exp(-pr.drag[i] * pdt); pr.vx[i] *= dr; pr.vy[i] *= dr; pr.vz[i] *= dr;
        pr.x[i] += pr.vx[i] * pdt; pr.y[i] += pr.vy[i] * pdt; pr.z[i] += pr.vz[i] * pdt;
        pPos[np * 3] = pr.x[i]; pPos[np * 3 + 1] = pr.y[i]; pPos[np * 3 + 2] = pr.z[i];
        pSize[np] = pr.s0[i] + (pr.s1[i] - pr.s0[i]) * (1 - (1 - a) * (1 - a));
        pCol[np * 4] = pr.r[i]; pCol[np * 4 + 1] = pr.g[i]; pCol[np * 4 + 2] = pr.b[i]; pCol[np * 4 + 3] = pr.a0[i] * Math.pow(1 - a, 1.4) * Math.min(1, a * 12);
        np++;
      }
      pGeo.setDrawRange(0, np); parts.visible = np > 0; if (np) { upd(pPA, np); upd(pCA, np); upd(pSA, np); }
      lGeo.setDrawRange(0, nL); lights.visible = nL > 0; if (nL) { upd(lPA, nL); upd(lCA, nL); upd(lSA, nL); }
      // ---- instance counts ----
      for (let j = 0; j < TKEYS.length; j++) {
        const kk = TKEYS[j], M = MESH[kk], h = hiN[kk], l = loN[kk], g = gN[kk];
        M.hi.count = h; M.hi.visible = h > 0; if (h) { M.hi.instanceMatrix.needsUpdate = true; upd(M.livH, h); }
        M.lo.count = l; M.lo.visible = l > 0; if (l) { M.lo.instanceMatrix.needsUpdate = true; upd(M.livL, l); }
        M.gear.count = g; M.gear.visible = g > 0; if (g) M.gear.instanceMatrix.needsUpdate = true;
      }
      if (props) { props.count = nProp; props.visible = nProp > 0; if (nProp) props.instanceMatrix.needsUpdate = true; }
      discs.count = nDisc; discs.visible = nDisc > 0; if (nDisc) discs.instanceMatrix.needsUpdate = true;
      blobs.count = nBlob; blobs.visible = nBlob > 0; if (nBlob) { blobs.instanceMatrix.needsUpdate = true; blobs.instanceColor.needsUpdate = true; }
      matBody.emissiveIntensity = NF * 0.95; ambU.value = 0.13 * Math.max(NF, Z.dustNow ? 0.5 : 0); matGear.emissiveIntensity = 0;
      boxes.count = nB; boxes.visible = nB > 0; if (nB) { boxes.instanceMatrix.needsUpdate = true; boxes.instanceColor.needsUpdate = true; }
      birds.count = nBird; birds.visible = nBird > 0; if (nBird) birds.instanceMatrix.needsUpdate = true;
      if (now - cleanT > 2) { cleanT = now; mem.forEach(cleaner); }
    },
  };
};
