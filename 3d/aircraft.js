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
  const COL = { white: C('#ffffff'), wing: C('#c3c8cf'), wingB: C('#a9b0b9'), stab: C('#d9dde2'), pylon: C('#c9cdd2'), exh: C('#8a8f96'),
    strut: C('#c9ced4'), tyre: C('#1d1e20'), prop: C('#26292d'), hub: C('#8d939a'), lip: C('#d6dade'), glass: C('#0b1016'), fan: C('#16181b'),
    blade: C('#5d636a'), spin: C('#2a2d31'), inner: C('#3a3f45'), door: C('#e9ebee'), cone: C('#9ca1a8'), char: C('#1b1816') };
  // per-vertex material: [roughness, metalness, clearcoat]; the 4th channel carries the gear pivot height (retracts in the shader)
  const MAT = { paint: [0.34, 0, 1], wing: [0.46, 0.12, 0.45], wingB: [0.55, 0.1, 0.2], le: [0.2, 1, 0], glass: [0.04, 0.1, 1], tyre: [0.93, 0, 0],
    strut: [0.25, 0.95, 0], hub: [0.42, 0.7, 0], fan: [0.45, 0.8, 0], blade: [0.3, 0.95, 0], exh: [0.42, 1, 0], inner: [0.7, 0.2, 0], door: [0.36, 0, 0.8] };

  /* ---------------- livery atlas: one 128 px band per airline (fuselage), plus a 384 px tile per airline (fin) ---------------- */
  // 18 bands of 112 px, 18 fin tiles of 336 px (3 x 6). band layout (v within a band): fuselage unwrap x 0..2800 (u = t nose->tail, v = angle crown->keel) at v .02-.66,
  // window row .68-.74, titles + registration row .76-.985; flat colour patches at x 3994..4094.
  // fin tiles: 3 columns x 6 rows of 336 px at x 2832 (selected per instance in the vertex shader).
  // the atlas grows to 4096 x 4096 (about 89 MB with mipmaps) when there are more than 18 liveries: the band height and fin tile shrink
  // just enough to fit every airline (plus the C-17's grey USAF scheme as an extra band)
  const ALK = Object.keys(Z.AL).concat(['USAF_C17']), AIDX = {}; ALK.forEach((k, i) => { AIDX[k] = i; });
  const NBD = Math.max(18, ALK.length), AW = 4096, AH = NBD > 18 ? 4096 : 2048, BH = Math.min(112, Math.floor(AH / NBD)), FW = 2800, UF = FW / AW, VK = BH / AH,
    FT = Math.min(336, Math.floor(AH / Math.ceil(NBD / 3))), FX0 = 2832;
  const FA0 = 0.02, FAK = 0.64, WV0 = 0.68, WV1 = 0.74, TV0 = 0.76, TV1 = 0.985, TA = 0.12, TB = 0.31, RA = 0.79, RB = 0.875;
  const PU = { white: [4004 / AW, 0.5], eng: [4024 / AW, 0.5], wlt: [4044 / AW, 0.5], dark: [4064 / AW, 0.5], grey: [4084 / AW, 0.5] };
  const SANS = '"Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif', SERIF = 'Georgia, "Times New Roman", serif';
  const REG = { '6E': 'VT-IFJ', AI: 'VT-AIX', IX: 'VT-EXB', QP: 'VT-YAE', SG: 'VT-SGQ', EK: 'A6-EVK', QR: 'A7-BHD', EY: 'A6-BLM', SQ: '9V-SMF',
    LH: 'D-AIXP', BA: 'G-ZBKA', SV: 'HZ-ARF', TG: 'HS-TQD', FZ: 'A6-FMH', AF: 'F-HTYB', IN1: 'VT-AIO', CHW: 'VT-CHW', RSD: 'RA-96100',
    USAF: '28000', USAF_C17: '07-7182', CCA: 'B-2479', JAF: '80-1111', GAF: '10+03', RRR: 'ZZ336', CTM: 'F-RARF', TCG: 'TC-TRK', ROK: '10001', RCF: '330001',
    RAA: 'A39-001', MH: '9M-MTA', GA: 'PK-GIA', IAM: 'MM62243', BRS: 'FAB2101', EUR: 'EU-001', GOV: 'STATE 1', AM: 'XA-ADL', OCA: 'VT-OCC', SPC: 'VT-SPC' };
  const atlas = document.createElement('canvas'); atlas.width = AW; atlas.height = AH;
  {
    const c = atlas.getContext('2d'); c.fillStyle = '#eef0f2'; c.fillRect(0, 0, AW, AH);
    const fa = a => FA0 + FAK * a;
    for (let i = 0; i < ALK.length && i < AH / BH; i++) {
      const y0 = i * BH, k = ALK[i], tx0 = FX0 + (i % 3) * FT, ty0 = Math.floor(i / 3) * FT;
      const F = (t0, t1, a0, a1, col) => { c.fillStyle = col; c.fillRect(t0 * FW, y0 + fa(a0) * BH, (t1 - t0) * FW, (fa(a1) - fa(a0)) * BH + 0.5); };
      const FP = (pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach((p, j) => (j ? c.lineTo : c.moveTo).call(c, p[0] * FW, y0 + fa(p[1]) * BH)); c.closePath(); c.fill(); };
      const fx = x => tx0 + (0.02 + 0.96 * x) * FT, fy = y => ty0 + (0.02 + 0.96 * y) * FT;
      const clipT = fn => { c.save(); c.beginPath(); c.rect(tx0, ty0, FT, FT); c.clip(); fn(); c.restore(); };
      const N = (x0, x1, y0_, y1, col) => clipT(() => { c.fillStyle = col; c.fillRect(fx(x0), fy(y0_), (x1 - x0) * 0.96 * FT + 0.5, (y1 - y0_) * 0.96 * FT + 0.5); });
      const NP = (pts, col) => clipT(() => { c.fillStyle = col; c.beginPath(); pts.forEach((p, j) => (j ? c.lineTo : c.moveTo).call(c, fx(p[0]), fy(p[1]))); c.closePath(); c.fill(); });
      const ND = (x, y, r, col) => clipT(() => { c.fillStyle = col; c.beginPath(); c.ellipse(fx(x), fy(y), r * FT, r * FT * 0.78, 0, 0, 7); c.fill(); });
      let WM = null; const titles = (t0, a, col, n) => { WM = WM || [Z.AL[k] ? Z.AL[k].name.toUpperCase() : k, col, 'bold {s}px ' + SANS, 0]; };
      const word = (txt, col, font, sp) => { WM = [txt, col, font, sp || 0]; };
      let eng = '#d4d8dd', wlt = '#e6e8eb', wpat = '#ffffff', wins = 1;
      // fin helpers (tile units: x LE 0 .. TE 1, y tip 0 .. root 1) and fuselage roundels (metres on a typical airframe of length LL, half-width WW)
      const star = (x, y, r, col, n, k) => { n = n || 5; k = k || 0.42; const p = []; for (let j = 0; j < 2 * n; j++) { const a = -Math.PI / 2 + j * Math.PI / n, rr = j % 2 ? r * k : r; p.push([x + rr * Math.cos(a), y + rr * Math.sin(a) * 0.78]); } NP(p, col); };
      const flagUS = (x0, y0, w, h) => { for (let j = 0; j < 13; j++) N(x0, x0 + w, y0 + j * h / 13, y0 + (j + 1) * h / 13 + 0.002, j % 2 ? '#ffffff' : '#b22234');
        N(x0, x0 + w * 0.42, y0, y0 + h * 7 / 13, '#3c3b6e'); for (let j = 0; j < 20; j++) ND(x0 + w * (0.05 + (j % 5) * 0.08 + (Math.floor(j / 5) % 2) * 0.04), y0 + h * (0.06 + Math.floor(j / 5) * 0.12), 0.007, '#ffffff'); };
      const ftxt = (txt, x, y, sz, col, font) => clipT(() => { c.font = (font || 'bold {s}px ' + SANS).replace('{s}', Math.round(sz * FT)); c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, fx(x), fy(y)); c.textAlign = 'left'; });
      const rnd = (t, a, R, col, LL, WW) => { c.fillStyle = col; c.beginPath(); c.ellipse(t * FW, y0 + fa(a) * BH, R * FW / LL, R / (Math.PI * WW) * FAK * BH, 0, 0, 7); c.fill(); };
      const leaf = (x, y, s, col) => NP([[0, -1], [0.18, -0.66], [0.38, -0.75], [0.3, -0.25], [0.62, -0.5], [0.68, -0.36], [0.95, -0.42], [0.85, -0.12], [0.98, -0.06], [0.55, 0.32], [0.62, 0.5], [0.06, 0.42], [0.06, 0.9], [-0.06, 0.9], [-0.06, 0.42],
        [-0.62, 0.5], [-0.55, 0.32], [-0.98, -0.06], [-0.85, -0.12], [-0.95, -0.42], [-0.68, -0.36], [-0.62, -0.5], [-0.3, -0.25], [-0.38, -0.75], [-0.18, -0.66]].map(p => [x + p[0] * s, y + p[1] * s * 0.8]), col);
      const roo = [[-0.95, 0.6], [-0.4, 0.35], [-0.15, 0.0], [0.1, -0.3], [0.3, -0.45], [0.42, -0.75], [0.5, -0.78], [0.55, -0.6], [0.7, -0.55], [0.62, -0.45], [0.45, -0.35], [0.42, -0.1], [0.55, 0.0], [0.4, 0.05], [0.35, 0.3], [0.5, 0.6], [0.7, 0.7], [0.2, 0.7], [0.0, 0.55], [-0.3, 0.55]];
      const vband = (cols, x0, x1, sk) => cols.forEach((col, j) => { const a = x0 + (x1 - x0) * j / cols.length, b = x0 + (x1 - x0) * (j + 1) / cols.length; NP([[a + sk, -0.05], [b + sk, -0.05], [b, 1.05], [a, 1.05]], col); });
      // base: off-white crown, grey-blue belly
      F(0, 1, 0, 1, '#eef0f2'); F(0, 1, 0.78, 1, '#b7bec8'); F(0, 1, 0.765, 0.78, '#d3d8de');
      N(-0.03, 1.03, -0.03, 1.03, '#eef0f2');
      switch (k) {
        case '6E': { const ind = '#262c86'; N(-0.03, 1.03, -0.03, 1.03, ind); for (let gx = 0; gx < 11; gx++) for (let gy = 0; gy < 9; gy++) { const px = 0.36 + gx * 0.06, py = 0.06 + gy * 0.09, d = Math.hypot(gx - 9, (gy - 1) * 0.9); if (px < 1 && d < 8) ND(px, py, 0.016 * (1 - d / 9.5) + 0.003, '#ffffff'); }
          FP([[0.86, 0], [1, 0], [1, 0.35]], ind); word('IndiGo', ind, '600 {s}px ' + SANS); eng = ind; wlt = ind; break; }
        case 'AI': { const red = '#c8102e', aub = '#4a1d3f', gold = '#c9a14a'; F(0, 1, 0.62, 1, red); F(0, 1, 0.6, 0.62, gold);
          N(-0.03, 1.03, -0.03, 1.03, aub); NP([[0, 1], [0, 0.35], [0.6, 1]], red); c.strokeStyle = gold; c.lineWidth = 7; c.beginPath(); c.moveTo(fx(0.42), fy(0.88)); c.lineTo(fx(0.42), fy(0.45)); c.quadraticCurveTo(fx(0.62), fy(-0.1), fx(0.82), fy(0.45)); c.lineTo(fx(0.82), fy(0.88)); c.stroke();
          FP([[0.82, 0], [1, 0], [1, 0.4]], aub); word('AIR INDIA', red, 'bold {s}px ' + SERIF, 2); eng = aub; wlt = red; break; }
        case 'IX': { const or = '#e8452c'; N(-0.03, 1.03, -0.03, 1.03, or); NP([[0.2, 1], [1, 0.2], [1, 0.5], [0.55, 1]], '#b9301c'); FP([[0.8, 0], [1, 0], [1, 0.5], [0.9, 0.3]], or); word('air india express', or, 'bold italic {s}px ' + SANS); eng = or; wlt = or; break; }
        case 'QP': { const or = '#f26722'; N(-0.03, 1.03, -0.03, 1.03, or); c.strokeStyle = '#ffa060'; c.lineWidth = 6; for (let j = 0; j < 4; j++) { c.beginPath(); c.ellipse(fx(0.6), fy(0.95), (0.14 + j * 0.1) * FT, (0.16 + j * 0.12) * FT, 0, Math.PI, 2 * Math.PI); c.stroke(); }
          word('Akasa Air', or, '600 {s}px ' + SANS); eng = or; wlt = or; break; }
        case 'SG': { const red = '#d71920'; FP([[0, 0.72], [0.7, 0.72], [0.9, 0.25], [1, 0.1], [1, 1], [0, 1]], red); N(-0.03, 1.03, -0.03, 1.03, red); NP([[0.25, 0.95], [0.75, 0.2], [0.6, 0.65]], '#f04a3a'); NP([[0.45, 0.95], [0.9, 0.35], [0.8, 0.8]], '#ffffff'); word('SpiceJet', red, 'bold italic {s}px ' + SANS); eng = red; wlt = red; break; }
        case 'EK': { const red = '#d71920'; N(-0.03, 0.3, -0.03, 1.03, red); N(0.3, 1.03, -0.03, 0.33, '#00843d'); N(0.3, 1.03, 0.33, 0.66, '#ffffff'); N(0.3, 1.03, 0.66, 1.03, '#111111'); word('Emirates', '#a8854a', 'bold italic {s}px ' + SERIF, 1); eng = '#e9eaec'; wlt = red; break; }
        case 'QR': { const bu = '#5c0632'; F(0, 1, 0, 1, '#bdbec2'); F(0, 1, 0.8, 1, '#a9abb0'); N(-0.03, 1.03, -0.03, 1.03, bu); for (let j = 0; j < 7; j++) NP([[0.02 + j * 0.02, j / 7], [0.1 + j * 0.02, (j + 0.5) / 7], [0.02 + j * 0.02, (j + 1) / 7]], '#ffffff');
          FP([[0.84, 0], [1, 0], [1, 0.45], [0.92, 0.1]], bu); word('QATAR AIRWAYS', bu, 'bold {s}px ' + SANS, 2); eng = '#bdbec2'; wlt = bu; break; }
        case 'EY': { const sand = '#e2d5bb', gold = '#b8925a'; F(0, 1, 0, 1, sand); F(0, 1, 0.75, 1, '#cfc0a0'); N(-0.03, 1.03, -0.03, 1.03, sand); for (let j = 0; j < 6; j++) for (let m = 0; m < 4; m++) NP([[0.2 + j * 0.13, 0.15 + m * 0.22], [0.3 + j * 0.13, 0.15 + m * 0.22], [0.25 + j * 0.13, 0.33 + m * 0.22]], (j + m) % 2 ? gold : '#8c6c3f');
          word('ETIHAD', '#8c6c3f', '{s}px ' + SERIF, 6); eng = '#d9c7a3'; wlt = gold; break; }
        case 'SQ': { const bl = '#1c3f94'; F(0, 1, 0.42, 0.48, bl); F(0, 1, 0.48, 0.52, '#f0b323'); N(-0.03, 1.03, -0.03, 1.03, bl); NP([[0.25, 0.85], [0.55, 0.15], [0.8, 0.3], [0.6, 0.45], [0.75, 0.7], [0.45, 0.6]], '#d9a441'); word('SINGAPORE AIRLINES', bl, 'bold {s}px ' + SERIF, 1); eng = '#e9eaec'; wlt = bl; break; }
        case 'LH': { const bl = '#05164d'; N(-0.03, 1.03, -0.03, 1.03, bl); ND(0.58, 0.45, 0.2, '#f9ba00'); ND(0.58, 0.45, 0.16, bl); NP([[0.5, 0.3], [0.68, 0.45], [0.5, 0.6]], '#f9ba00'); FP([[0.82, 0], [1, 0], [1, 0.45], [0.92, 0.12]], bl); F(0, 1, 0.8, 1, '#eef0f2'); word('Lufthansa', bl, 'bold {s}px ' + SERIF); eng = bl; wlt = bl; break; }
        case 'BA': { const bl = '#1c2f5e', red = '#d22630'; F(0, 1, 0.62, 1, bl); F(0, 1, 0.6, 0.625, red); N(-0.03, 1.03, -0.03, 1.03, '#ffffff'); NP([[0, 0.35], [1, 0.05], [1, 0.35], [0, 0.65]], red); NP([[0, 0.65], [1, 0.35], [1, 1.05], [0, 1.05]], bl); NP([[0, 0.45], [1, 0.2], [1, 0.26], [0, 0.52]], '#ffffff');
          word('BRITISH AIRWAYS', bl, 'bold {s}px ' + SANS, 2); eng = bl; wlt = bl; break; }
        case 'SV': { const gr = '#0f7a5a', bl = '#2b5aa8'; F(0, 1, 0.55, 1, '#d8c69f'); N(-0.03, 1.03, -0.03, 1.03, '#f3efe4'); NP([[0, 1.05], [0, 0.45], [0.7, 1.05]], gr); NP([[0.1, 1.05], [0.45, 0.1], [1, 0], [1, 1.05]], bl); NP([[0.2, 1.05], [0.6, 0.35], [1, 0.3], [1, 1.05]], '#d8c69f'); word('SAUDIA', gr, 'bold {s}px ' + SANS, 4); eng = '#d8c69f'; wlt = gr; break; }
        case 'TG': { const pu = '#5b2a86'; N(-0.03, 1.03, -0.03, 1.03, pu); NP([[0.3, 0.9], [0.5, 0.25], [0.75, 0.15], [0.62, 0.5], [0.8, 0.75]], '#c9a227'); NP([[0.38, 0.85], [0.55, 0.4], [0.68, 0.38], [0.6, 0.6]], '#c4307a'); FP([[0.78, 0], [1, 0], [1, 0.55], [0.9, 0.18]], pu); word('THAI', pu, 'bold {s}px ' + SANS, 8); eng = pu; wlt = pu; break; }
        case 'FZ': { const bl = '#1a4c86', or = '#f26b21'; FP([[0, 0.5], [0.75, 0.55], [1, 0.2], [1, 1], [0, 1]], bl); N(-0.03, 1.03, -0.03, 1.03, or); N(-0.03, 0.15, -0.03, 1.03, bl); word('flydubai', '#ffffff', 'bold {s}px ' + SANS); eng = or; wlt = or; break; }
        case 'AF': { const bl = '#002157', red = '#e4002b'; N(-0.03, 1.03, -0.03, 1.03, '#ffffff'); for (let j = 0; j < 4; j++) NP([[0.05 + j * 0.13, 1.05], [0.2 + j * 0.13, -0.05], [0.27 + j * 0.13, -0.05], [0.12 + j * 0.13, 1.05]], j === 3 ? red : bl); word('AIRFRANCE', bl, 'bold italic {s}px ' + SANS, 3); eng = '#eef0f2'; wlt = bl; break; }
        case 'IN1': { const sf = '#ff9933', gn = '#138808', nv = '#0b2a6f'; F(0, 1, 0.78, 1, '#e9ebee'); F(0, 1, 0.55, 0.6, sf); F(0, 1, 0.6, 0.645, '#ffffff'); F(0, 1, 0.645, 0.7, gn); F(0, 1, 0.535, 0.55, nv);
          NP([[0, 0.55], [1, 0.12], [1, 0.42], [0, 0.85]], sf); NP([[0, 0.85], [1, 0.42], [1, 0.62], [0, 1.05]], '#ffffff'); NP([[0, 1.05], [1, 0.62], [1, 1.05]], gn); N(-0.03, 1.03, -0.03, 0.05, nv);
          word('भारत · INDIA', nv, 'bold {s}px Georgia, "Kohinoor Devanagari", "Devanagari Sangam MN", "Noto Sans Devanagari", serif', 2); eng = '#1d3c8f'; wlt = sf; break; }
        case 'CHW': { // the Chambani wedding: white, a gold cheatline, a marigold garland round the nose, a gold fin with a C monogram
          const gold = '#c99a2e', goldL = '#f0cf6a', goldD = '#8f6512';
          F(0, 1, 0, 1, '#f8f7f3'); F(0, 1, 0.8, 1, '#eceae4'); F(0, 1, 0.765, 0.8, '#f2f0eb');
          F(0.05, 1, 0.455, 0.49, gold); F(0.05, 1, 0.49, 0.497, goldD); F(0.08, 1, 0.3, 0.307, gold);
          // the garland: two strands of marigolds (orange and saffron-yellow) hung round the radome below the windscreen,
          // meeting under the chin, with a few leaves and a rose pendant
          const flower = (t, a, rx, col, hl) => { const x = t * FW, y = y0 + fa(a) * BH, ry = Math.max(2.2, rx * 0.36);
            c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill();
            if (hl) { c.fillStyle = hl; c.beginPath(); c.ellipse(x - rx * 0.2, y - ry * 0.25, rx * 0.5, ry * 0.45, 0, 0, 7); c.fill(); } };
          for (const [dt, cA, cB, rx] of [[0.0, '#e86a00', '#f08400', 12], [0.017, '#f5a300', '#ffb81c', 10]])
            for (let j = 0; j <= 40; j++) { const s = j / 40, t = 0.118 + dt - 0.1 * Math.pow(s, 0.85) + 0.006 * Math.sin(s * Math.PI * 3) ** 2, a = 0.34 + 0.6 * s;
              flower(t, a, rx * (1 - 0.3 * s), j % 2 ? cA : cB, j % 2 ? '#ffa640' : '#ffd060'); if (j % 4 === 2) flower(t + 0.008, a + 0.014, 5, '#2e7d32'); }
          flower(0.02, 0.96, 7, '#c2185b'); flower(0.028, 0.93, 5, '#e91e63');
          // fin: gold, lighter toward the tip, a fine white ring with a serif C
          clipT(() => { const gr = c.createLinearGradient(0, fy(0), 0, fy(1)); gr.addColorStop(0, goldL); gr.addColorStop(0.55, gold); gr.addColorStop(1, goldD);
            c.fillStyle = gr; c.fillRect(tx0, ty0, FT, FT);
            c.strokeStyle = '#fffaf0'; c.lineWidth = 6; c.beginPath(); c.ellipse(fx(0.5), fy(0.52), 0.25 * FT, 0.21 * FT, 0, 0, 7); c.stroke();
            c.lineWidth = 2; c.beginPath(); c.ellipse(fx(0.5), fy(0.52), 0.285 * FT, 0.24 * FT, 0, 0, 7); c.stroke();
            c.font = 'italic bold ' + Math.round(0.42 * FT) + 'px Didot, "Bodoni 72", Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillStyle = 'rgba(90,40,10,0.45)'; c.fillText('C', fx(0.5) + 4, fy(0.54) + 4); c.fillStyle = '#fffaf0'; c.fillText('C', fx(0.5), fy(0.54)); c.textAlign = 'left'; });
          word('Chambani', gold, 'italic 600 {s}px "Snell Roundhand", "Apple Chancery", "Brush Script MT", Georgia, serif', 1); eng = '#f8f7f3'; wlt = gold; break; }
        case 'RSD': { const bl = '#1c3f94', rd = '#d52b1e'; F(0, 1, 0.37, 0.47, bl); F(0, 1, 0.475, 0.495, rd); F(0, 1, 0.78, 1, '#d9dce0');
          N(0.12, 0.92, 0.2, 0.36, '#ffffff'); N(0.12, 0.92, 0.36, 0.52, bl); N(0.12, 0.92, 0.52, 0.68, rd); N(0.1, 0.94, 0.19, 0.2, '#c9cdd2'); N(0.1, 0.94, 0.68, 0.69, '#c9cdd2'); N(-0.03, 1.03, 0.9, 1.03, bl);
          word('RUSSIA', bl, 'bold {s}px ' + SANS, 10); eng = '#eef0f2'; wlt = bl; break; }
        case 'USAF': { // VC-25 Air Force One: white crown, a dark blue cheatline under the windows sweeping up over the nose, sky-blue lower fuselage
          const sky = '#8fbfe0', nv = '#1b2f63'; F(0, 1, 0.43, 1, sky); F(0.02, 0.985, 0.375, 0.43, nv); F(0.02, 0.985, 0.43, 0.442, '#c9a14a');
          FP([[0, 0.2], [0.02, 0.12], [0.075, 0.06], [0.1, 0.2], [0.07, 0.375], [0.02, 0.375]], nv); F(0, 0.02, 0.2, 1, nv); rnd(0.115, 0.3, 0.75, '#c9a14a', 76, 3.3); rnd(0.115, 0.3, 0.62, '#1b2f63', 76, 3.3);
          flagUS(0.22, 0.12, 0.74, 0.3); N(-0.03, 1.03, 0.86, 1.03, nv); word('UNITED STATES OF AMERICA', nv, 'bold {s}px "Big Caslon", "Hoefler Text", Georgia, serif', 2); eng = sky; wlt = nv; break; }
        case 'USAF_C17': { const g = '#737b83'; F(0, 1, 0, 1, g); F(0, 1, 0.8, 1, '#6a7279'); N(-0.03, 1.03, -0.03, 1.03, g); flagUS(0.3, 0.16, 0.5, 0.17);
          ftxt('AMC', 0.55, 0.5, 0.11, '#3d4349'); ftxt('AF 07 182', 0.52, 0.64, 0.07, '#3d4349'); word('U.S. AIR FORCE', '#3a4046', 'bold {s}px ' + SANS, 3); eng = g; wlt = g; wpat = '#9aa1a8'; wins = 3; break; }
        case 'CCA': { const red = '#c8102e'; F(0, 1, 0.8, 1, '#dfe2e6'); N(-0.03, 1.03, -0.03, 1.03, '#f6f6f4');
          clipT(() => { c.strokeStyle = red; c.lineCap = 'round'; c.lineWidth = 0.07 * FT; c.beginPath(); c.arc(fx(0.55), fy(0.5), 0.22 * FT, -2.6, 1.9); c.stroke();
            c.lineWidth = 0.05 * FT; c.beginPath(); c.arc(fx(0.5), fy(0.47), 0.11 * FT, 0.3, 4.4); c.stroke(); c.beginPath(); c.moveTo(fx(0.34), fy(0.28)); c.quadraticCurveTo(fx(0.2), fy(0.12), fx(0.42), fy(0.1)); c.stroke();
            c.lineWidth = 0.035 * FT; c.beginPath(); c.moveTo(fx(0.66), fy(0.72)); c.quadraticCurveTo(fx(0.85), fy(0.86), fx(0.95), fy(0.7)); c.stroke(); });
          word('中国国际航空公司  AIR CHINA', '#222222', 'bold {s}px "Kaiti SC", STKaiti, "PingFang SC", "Hiragino Sans GB", serif', 1); eng = '#f6f6f4'; wlt = red; break; }
        case 'JAF': { const red = '#c8102e'; F(0.02, 0.97, 0.39, 0.425, red); F(0.02, 0.97, 0.425, 0.435, '#c9a14a'); FP([[0.82, 0.39], [1, 0.12], [1, 0.2], [0.86, 0.425]], red);
          N(-0.03, 1.03, -0.03, 1.03, '#ffffff'); NP([[-0.05, 1.05], [-0.05, 0.75], [1.05, 0.55], [1.05, 1.05]], red); N(0.3, 0.92, 0.12, 0.44, '#e3e5e8'); N(0.31, 0.91, 0.13, 0.43, '#ffffff'); ND(0.61, 0.28, 0.1, '#bc002d');
          word('日本国  JAPAN', '#1a1a1a', 'bold {s}px "Hiragino Mincho ProN", "Yu Mincho", Georgia, serif', 4); eng = '#ffffff'; wlt = red; break; }
        case 'GAF': { F(0, 1, 0.5, 1, '#a2aab2'); F(0.03, 0.97, 0.44, 0.46, '#111111'); F(0.03, 0.97, 0.46, 0.48, '#dd0000'); F(0.03, 0.97, 0.48, 0.5, '#ffce00');
          N(-0.03, 1.03, -0.03, 1.03, '#ffffff'); N(-0.03, 1.03, 0.1, 0.22, '#111111'); N(-0.03, 1.03, 0.22, 0.34, '#dd0000'); N(-0.03, 1.03, 0.34, 0.46, '#ffce00');
          NP([[0.5, 0.58], [0.58, 0.66], [0.66, 0.58], [0.6, 0.66], [0.66, 0.74], [0.58, 0.68], [0.5, 0.74], [0.56, 0.66]], '#111111');
          word('BUNDESREPUBLIK DEUTSCHLAND', '#111111', 'bold {s}px ' + SANS, 2); eng = '#ffffff'; wlt = '#a2aab2'; break; }
        case 'RRR': { F(0, 1, 0, 1, '#d6d9dc'); F(0, 1, 0.55, 1, '#b7bcc1'); N(-0.03, 1.03, -0.03, 1.03, '#d0d4d8');
          for (const [R, col] of [[1.3, '#1f3a8a'], [0.85, '#ffffff'], [0.45, '#c8102e']]) rnd(0.66, 0.3, R, col, 63.7, 2.82);
          vband(['#c8102e', '#ffffff', '#1f3a8a'], 0.42, 0.72, 0.25); word('ROYAL AIR FORCE', '#3a4a6a', 'bold {s}px ' + SANS, 3); eng = '#c6cacf'; wlt = '#c6cacf'; wpat = '#e3e6e9'; break; }
        case 'CTM': { const bl = '#002395', rd = '#ed2939'; F(0.05, 0.97, 0.43, 0.445, bl); F(0.05, 0.97, 0.445, 0.455, '#ffffff'); F(0.05, 0.97, 0.455, 0.47, rd);
          N(-0.03, 1.03, -0.03, 1.03, '#ffffff'); vband([bl, '#ffffff', rd], 0.08, 0.98, 0.3); word('RÉPUBLIQUE FRANÇAISE', bl, 'bold {s}px ' + SERIF, 3); eng = '#ffffff'; wlt = bl; break; }
        case 'TCG': { const red = '#d0102a'; F(0.04, 0.97, 0.42, 0.45, red); N(-0.03, 1.03, -0.03, 1.03, red); ND(0.5, 0.45, 0.2, '#ffffff'); ND(0.56, 0.45, 0.16, red); star(0.74, 0.45, 0.085, '#ffffff');
          word('TÜRKİYE CUMHURİYETİ', red, 'bold {s}px ' + SERIF, 2); eng = '#ffffff'; wlt = red; break; }
        case 'ROK': { const lb = '#62aee0', nv = '#14306b'; F(0.02, 0.98, 0.38, 0.455, lb); F(0.02, 0.98, 0.455, 0.47, nv); F(0, 1, 0.8, 1, '#c9ced4');
          N(-0.03, 1.03, -0.03, 1.03, '#ffffff'); NP([[-0.05, 1.05], [-0.05, 0.8], [1.05, 0.62], [1.05, 1.05]], lb); N(0.22, 0.98, 0.12, 0.5, '#e6e8eb'); N(0.23, 0.97, 0.13, 0.49, '#ffffff');
          clipT(() => { const x = fx(0.6), y = fy(0.31), r = 0.1 * FT; c.fillStyle = '#cd2e3a'; c.beginPath(); c.arc(x, y, r, Math.PI, 0); c.fill(); c.fillStyle = '#0047a0'; c.beginPath(); c.arc(x, y, r, 0, Math.PI); c.fill();
            c.fillStyle = '#cd2e3a'; c.beginPath(); c.arc(x - r / 2, y, r / 2, 0, Math.PI * 2); c.fill(); c.fillStyle = '#0047a0'; c.beginPath(); c.arc(x + r / 2, y, r / 2, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#111'; for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let b = 0; b < 3; b++) c.fillRect(x + dx * 0.27 * FT - 0.04 * FT, y + dy * 0.12 * FT + (b - 1) * 0.022 * FT, 0.08 * FT, 0.014 * FT); });
          word('대한민국  REPUBLIC OF KOREA', nv, 'bold {s}px "Apple SD Gothic Neo", "Malgun Gothic", ' + SANS, 2); eng = '#ffffff'; wlt = lb; break; }
        case 'RCF': { const red = '#d52b1e'; F(0, 1, 0.8, 1, '#c9ced4'); N(-0.03, 1.03, -0.03, 1.03, '#ffffff'); leaf(0.56, 0.48, 0.3, red);
          for (const [R, col] of [[1.1, '#1f3a8a'], [0.75, '#ffffff']]) rnd(0.66, 0.3, R, col, 58.8, 2.82); c.save(); c.translate(0.66 * FW, y0 + fa(0.3) * BH); c.scale(0.5 * FW / 58.8, 0.5 / (Math.PI * 2.82) * FAK * BH);
          c.fillStyle = red; c.beginPath(); c.arc(0, 0, 0.6, 0, 7); c.fill(); c.restore(); word('ROYAL CANADIAN AIR FORCE', '#333a44', 'bold {s}px ' + SANS, 2); eng = '#ffffff'; wlt = red; break; }
        case 'RAA': { const g = '#a7adb3'; F(0, 1, 0, 1, g); F(0, 1, 0.6, 1, '#979ea5'); N(-0.03, 1.03, -0.03, 1.03, g);
          for (const [R, col] of [[1.2, '#1f3a8a'], [0.85, '#ffffff']]) rnd(0.66, 0.3, R, col, 58.8, 2.82);
          c.save(); c.translate(0.66 * FW, y0 + fa(0.3) * BH); c.scale(0.75 * FW / 58.8, 0.75 / (Math.PI * 2.82) * FAK * BH); c.fillStyle = '#c8102e'; c.beginPath(); roo.forEach((p, j) => (j ? c.lineTo : c.moveTo).call(c, p[0], p[1])); c.closePath(); c.fill(); c.restore();
          NP(roo.map(p => [0.56 + p[0] * 0.22, 0.42 + p[1] * 0.22]), '#c8102e'); word('ROYAL AUSTRALIAN AIR FORCE', '#2b3a55', 'bold {s}px ' + SANS, 2); eng = g; wlt = g; wpat = '#c9ced2'; break; }
        case 'MH': { const red = '#d71920', bl = '#1e4ea1'; F(0.5, 0.97, 0.66, 0.7, red); F(0.5, 0.97, 0.7, 0.74, bl); FP([[0.55, 0.74], [0.97, 0.5], [1, 0.5], [1, 0.74]], bl);
          N(-0.03, 1.03, -0.03, 1.03, '#ffffff'); NP([[0.25, 0.42], [0.55, 0.12], [0.9, 0.2], [0.62, 0.3], [0.5, 0.48]], red); NP([[0.25, 0.5], [0.52, 0.56], [0.68, 0.84], [0.45, 0.72], [0.3, 0.62]], bl);
          NP([[0.5, 0.48], [0.62, 0.3], [0.78, 0.5], [0.62, 0.56]], red); NP([[0.52, 0.56], [0.62, 0.56], [0.78, 0.5], [0.68, 0.84]], bl);
          word('malaysia', bl, 'bold {s}px ' + SANS, 2); eng = '#ffffff'; wlt = bl; break; }
        case 'GA': { const nv = '#00577a'; F(0, 1, 0.8, 1, '#d6dade'); FP([[0.84, 0.0], [1, 0], [1, 0.45], [0.9, 0.22]], '#1d3c6e');
          clipT(() => { const g = c.createLinearGradient(fx(0), fy(1), fx(1), fy(0)); g.addColorStop(0, '#0b2c5a'); g.addColorStop(1, '#19a5b5'); c.fillStyle = g; c.fillRect(tx0, ty0, FT, FT);
            c.strokeStyle = '#ffffff'; c.lineCap = 'round'; for (let j = 0; j < 5; j++) { c.lineWidth = (0.035 - j * 0.004) * FT; c.beginPath(); c.moveTo(fx(0.3 + j * 0.05), fy(0.78 - j * 0.04)); c.quadraticCurveTo(fx(0.42 + j * 0.06), fy(0.35 - j * 0.03), fx(0.82 + j * 0.03), fy(0.18 + j * 0.06)); c.stroke(); } });
          word('Garuda Indonesia', '#1d3c6e', 'bold {s}px ' + SANS, 1); eng = '#ffffff'; wlt = nv; break; }
        case 'IAM': { const gn = '#009246', rd = '#ce2b37'; F(0.03, 0.97, 0.42, 0.44, gn); F(0.03, 0.97, 0.44, 0.455, '#ffffff'); F(0.03, 0.97, 0.455, 0.475, rd);
          N(-0.03, 1.03, -0.03, 1.03, '#ffffff'); vband([gn, '#ffffff', rd], 0.12, 0.96, 0.3); word('REPUBBLICA ITALIANA', '#1c2f5e', 'bold {s}px ' + SERIF, 3); eng = '#ffffff'; wlt = gn; break; }
        case 'BRS': { const gn = '#009c3b', ye = '#ffdf00'; F(0.03, 0.97, 0.4, 0.44, gn); F(0.03, 0.97, 0.44, 0.465, ye); F(0, 1, 0.8, 1, '#d6dade');
          N(-0.03, 1.03, -0.03, 1.03, '#ffffff'); N(0.2, 0.98, 0.14, 0.5, gn); NP([[0.25, 0.32], [0.59, 0.17], [0.93, 0.32], [0.59, 0.47]], ye); ND(0.59, 0.32, 0.075, '#002776');
          word('FORÇA AÉREA BRASILEIRA', gn, 'bold {s}px ' + SANS, 2); eng = '#ffffff'; wlt = gn; break; }
        case 'EUR': { const bl = '#003399'; F(0.03, 0.97, 0.43, 0.46, bl); N(-0.03, 1.03, -0.03, 1.03, bl); for (let j = 0; j < 12; j++) { const a = j / 12 * Math.PI * 2; star(0.58 + 0.24 * Math.cos(a), 0.45 + 0.24 * Math.sin(a), 0.04, '#ffcc00'); }
          word('EUROPEAN UNION', bl, 'bold {s}px ' + SANS, 4); eng = '#ffffff'; wlt = bl; break; }
        case 'GOV': { const gb = '#5a6e86'; F(0, 1, 0.55, 1, '#aab1b8'); F(0.03, 0.97, 0.43, 0.48, gb); N(-0.03, 1.03, -0.03, 1.03, gb); NP([[-0.05, 0.62], [1.05, 0.38], [1.05, 0.44], [-0.05, 0.68]], '#ffffff');
          word('', gb, 'bold {s}px ' + SANS); eng = '#ffffff'; wlt = gb; break; }
        case 'AM': { const nv = '#0b2343', sl = '#b9c2cc'; F(0, 1, 0.47, 1, nv); FP([[0.62, 0.47], [0.8, 0.2], [1, 0], [1, 0.47]], nv); F(0.02, 0.97, 0.46, 0.47, sl); N(-0.03, 1.03, -0.03, 1.03, nv);
          NP([[0.3, 0.75], [0.36, 0.45], [0.5, 0.3], [0.66, 0.28], [0.8, 0.38], [0.92, 0.5], [0.78, 0.5], [0.7, 0.56], [0.62, 0.66], [0.55, 0.8]], sl);
          for (let j = 0; j < 6; j++) NP([[0.36 + j * 0.035, 0.45 - j * 0.02], [0.3 + j * 0.03, 0.12 + j * 0.01], [0.4 + j * 0.035, 0.42 - j * 0.02]], sl); ND(0.62, 0.4, 0.025, nv);
          word('AEROMEXICO', nv, 'bold {s}px ' + SANS, 4); eng = nv; wlt = nv; break; }
        case 'OCA': { const or = '#ff8c1a'; F(0, 1, 0.44, 1, or); FP([[0.6, 0.44], [0.85, 0.15], [1, 0.05], [1, 0.44]], or); F(0.02, 0.97, 0.43, 0.44, '#e06a00');
          N(-0.03, 1.03, -0.03, 1.03, or); ND(0.58, 0.46, 0.25, '#ffffff'); ND(0.58, 0.48, 0.18, '#f77f00'); ND(0.54, 0.44, 0.06, '#ffb04d');
          NP([[0.58, 0.31], [0.66, 0.22], [0.76, 0.24], [0.68, 0.3]], '#2e7d32'); N(0.575, 0.59, 0.27, 0.32, '#5d4037'); word('ORANGE CITY CARGO', '#e06a00', 'bold {s}px ' + SANS, 3); eng = or; wlt = or; wins = 0; break; }
        case 'SPC': { const ol = '#5b6b2e'; F(0, 1, 0.44, 1, ol); FP([[0.62, 0.44], [0.84, 0.18], [1, 0.06], [1, 0.44]], ol); F(0.02, 0.97, 0.43, 0.44, '#c9b458');
          N(-0.03, 1.03, -0.03, 1.03, ol); NP([[-0.05, 0.9], [0.2, 0.55], [0.32, 0.66], [0.52, 0.32], [0.66, 0.5], [0.78, 0.4], [1.05, 0.78], [1.05, 1.05], [-0.05, 1.05]], '#8a9a52');
          NP([[0.44, 0.44], [0.52, 0.32], [0.6, 0.42], [0.55, 0.4], [0.5, 0.45]], '#ffffff'); NP([[0.1, 1.05], [0.38, 0.72], [0.56, 0.86], [0.75, 0.64], [1.05, 0.95], [1.05, 1.05]], '#3d4a1c');
          word('SATPURA CARGO', ol, 'bold {s}px ' + SANS, 3); eng = ol; wlt = ol; wins = 0; break; }
        default: { const col = (Z.AL[k] && Z.AL[k].tail) || '#777'; N(-0.03, 1.03, -0.03, 1.03, col); titles(0.16, 0.18, col, 7); eng = col; wlt = col; }
      }
      // fin: rudder hinge, a faint shadow under the tip cap and a lit leading edge
      c.fillStyle = 'rgba(0,0,0,0.16)'; c.fillRect(fx(0.71), fy(0.04), 2, 0.92 * FT); c.fillRect(fx(0.71), fy(0.5), 0.27 * FT, 1.5);
      c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(fx(0), fy(0), 0.03 * FT, 0.96 * FT);
      // panel lines: frames every ~0.5 m on a single-aisle (lap joints along), very faint
      c.fillStyle = 'rgba(20,30,40,0.07)';
      for (let x = 0.15; x < 0.95; x += 0.033) c.fillRect(x * FW, y0 + fa(0) * BH, 1, (fa(0.95) - fa(0)) * BH);
      for (const a of [0.12, 0.3, 0.56]) c.fillRect(0.06 * FW, y0 + fa(a) * BH, 0.88 * FW, 1);
      // patches
      const P = (x, col) => { c.fillStyle = col; c.fillRect(x, y0, 20, BH); };
      P(3994, wpat); P(4014, eng); P(4034, wlt); P(4054, '#0e1318'); P(4074, '#8d949c');
      // titles row: the crown colour at title height with the airline's wordmark (a strip on each side of the fuselage samples it)
      // and the registration near the tail
      { const ty = Math.round(y0 + TV0 * BH), th = Math.round((TV1 - TV0) * BH); c.drawImage(atlas, 0, Math.round(y0 + fa(0.22) * BH), FW, 1, 0, ty, FW, th);
        if (!WM) titles(0.16, 0.18, '#333', 8);
        const [txt, col, font, sp] = WM, x0 = (TA + 0.018) * FW, x1 = (TB - 0.012) * FW, s = Math.round(th * 0.9), sx = 1.7;
        c.save(); c.font = font.replace('{s}', s); if ('letterSpacing' in c) c.letterSpacing = sp + 'px';
        const w = c.measureText(txt).width * sx, kx = Math.min(sx, sx * (x1 - x0) / Math.max(1, w));
        c.fillStyle = col; c.textBaseline = 'middle'; c.translate(x0, ty + th * 0.54); c.scale(kx, 1); c.fillText(txt, 0, 0); c.restore();
        c.save(); c.font = '600 ' + Math.round(th * 0.62) + 'px ' + SANS; if ('letterSpacing' in c) c.letterSpacing = '2px';
        const rw = c.measureText(REG[k] || 'VT-ZMH').width * 1.6, rk = Math.min(1.6, 1.6 * (RB - RA - 0.02) * FW / rw);
        c.fillStyle = 'rgba(30,34,40,0.85)'; c.textBaseline = 'middle'; c.translate((RA + 0.01) * FW, ty + th * 0.52); c.scale(rk, 1); c.fillText(REG[k] || 'VT-ZMH', 0, 0); c.restore(); }
      // window row: the crown colour at window height with glossy dark windows (rounded, ~0.4 m pitch on a single-aisle)
      const wy = y0 + Math.round(WV0 * BH), wh = Math.round((WV1 - WV0) * BH);
      c.drawImage(atlas, 0, Math.round(y0 + fa(0.33) * BH), FW, 1, 0, wy, FW, wh);
      c.fillStyle = '#121a24';
      if (k === 'CHW') for (let j = 0; j < 10; j++) { c.beginPath(); c.ellipse((0.225 + j * 0.037) * FW, wy + wh / 2, 0.0115 * FW, wh / 2 - 0.6, 0, 0, 7); c.fill(); }   // the G650's big ovals
      else if (wins === 3) for (const t of [0.13, 0.155, 0.185]) { c.beginPath(); c.ellipse(t * FW, wy + wh / 2, 7, wh / 2 - 1.5, 0, 0, 7); c.fill(); }
      else if (wins) for (let x = 4; x < FW; x += 30) { c.beginPath(); if (c.roundRect) c.roundRect(x, wy + 1, 12, wh - 2, 4); else c.rect(x, wy + 1, 12, wh - 2); c.fill(); }
    }
  }
  const mkTex = cv => { const t = new THREE.CanvasTexture(cv); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, Z.renderer.capabilities.getMaxAnisotropy()); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  const texA = mkTex(atlas);
  const C17L = {}; for (const kk of ALK) if (AIDX[kk + '_C17'] != null) C17L[kk] = AIDX[kk + '_C17'];   // C-17s wear their air force's grey band

  /* ---------------- geometry builder ---------------- */
  const Geo = () => ({ p: [], n: [], c: [], uv: [], m: [], o: [0, 0, 0], M: MAT.paint, G: 0 });
  function put(g, P, N, c, uv) { g.p.push(P[0], P[1], P[2]); g.n.push(N[0], N[1], N[2]); g.c.push(c.r, c.g, c.b); g.uv.push(uv[0], uv[1]); g.m.push(g.M[0], g.M[1], g.M[2], g.G); }
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
  function revX(g, rings, cy, cz, N, col, uv, capF, capB, flat, chev, inv) {
    const fl = flat || 1, sg = inv ? -1 : 1;
    const R = (i, j) => { const r = rings[i][1]; return chev && i === rings.length - 1 ? r * (1 + (j % 2 ? chev : -chev)) : r; };
    const P = (i, j) => { const a = j / N * 2 * Math.PI, ca = Math.cos(a), r = R(i, j % N); return [rings[i][0], cy + r * ca * (ca < 0 ? fl : 1), cz + r * Math.sin(a)]; };
    for (let i = 0; i < rings.length - 1; i++) {
      const sl = (rings[i][1] - rings[i + 1][1]) / Math.max(1e-6, rings[i][0] - rings[i + 1][0]);
      for (let j = 0; j < N; j++) {
        const a0 = j / N * 2 * Math.PI, a1 = (j + 1) / N * 2 * Math.PI, n0 = [-sl * sg, Math.cos(a0) * sg, Math.sin(a0) * sg], n1 = [-sl * sg, Math.cos(a1) * sg, Math.sin(a1) * sg];
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
  // vertical cylinder (struts, oleos)
  function cylY(g, cx, cz, y0, y1, r, N, col) {
    for (let j = 0; j < N; j++) { const a0 = j / N * 2 * Math.PI, a1 = (j + 1) / N * 2 * Math.PI, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      quad(g, [cx + r * c0, y0, cz + r * s0], [cx + r * c1, y0, cz + r * s1], [cx + r * c1, y1, cz + r * s1], [cx + r * c0, y1, cz + r * s0], col, [c0, 0, s0], [c1, 0, s1], [c1, 0, s1], [c0, 0, s0]); }
  }
  // smooth ellipsoidal body along x: rings [x, half-width]; height = width * ky; lower half squashed by kb
  function ellX(g, rings, cy, ky, kb, N, col, uv, cz) {
    cz = cz || 0; const P = (i, a) => { const r = rings[i][1], ca = Math.cos(a); return [rings[i][0], cy + r * ky * ca * (ca < 0 ? kb : 1), cz + r * Math.sin(a)]; };
    const Nn = (i, a) => { const sl = i === 0 ? (rings[1][1] - rings[0][1]) / (rings[0][0] - rings[1][0]) : i === rings.length - 1 ? (rings[i][1] - rings[i - 1][1]) / (rings[i - 1][0] - rings[i][0]) : (rings[i + 1][1] - rings[i - 1][1]) / (rings[i - 1][0] - rings[i + 1][0]);
      const ca = Math.cos(a); const v = [sl, ca / (ky * (ca < 0 ? kb : 1)), Math.sin(a)], l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < N; j++) { const a0 = j / N * 2 * Math.PI, a1 = (j + 1) / N * 2 * Math.PI;
      quad(g, P(i, a0), P(i + 1, a0), P(i + 1, a1), P(i, a1), col, Nn(i, a0), Nn(i + 1, a0), Nn(i + 1, a1), Nn(i, a1), uv); }
  }
  // airfoil loft through spanwise stations {x: LE x, y, z, c: chord, t: thickness}; leading-edge band polished metal
  const AF = [1, 0.85, 0.62, 0.4, 0.22, 0.1, 0.035, 0.008, 0], AFU = s => 0.62 * (2.97 * Math.sqrt(s) - 1.26 * s - 3.52 * s * s + 2.84 * s * s * s - 1.04 * s ** 4) / 1.0, AFL = s => -0.38 * (2.97 * Math.sqrt(s) - 1.26 * s - 3.52 * s * s + 2.84 * s * s * s - 1.04 * s ** 4);
  function airfoil(g, st, colT, colB, matT, matB, cap) {
    const prof = []; // [s, upper?]
    for (const s of AF) prof.push([s, 1]); for (let i = AF.length - 2; i >= 0; i--) prof.push([AF[i], 0]);
    const pt = (S, s, up) => { const h = (up ? AFU(s) : AFL(s)) * S.t; return [S.x - s * S.c, S.y + h, S.z]; };
    const nr = (S, s, up) => { const e = 0.004, s0 = Math.max(0, s - e), s1 = Math.min(1, s + e), f = up ? AFU : AFL, dy = (f(s1) - f(s0)) * S.t, dx = -(s1 - s0) * S.c;
      let nx = -dy, ny = dx; if (up) { nx = dy; ny = -dx; } if (s < 0.004) { nx = 1; ny = 0; } const l = Math.hypot(nx, ny) || 1; return [nx / l, ny / l, 0]; };
    for (let i = 0; i < st.length - 1; i++) { const A = st[i], B = st[i + 1];
      for (let j = 0; j < prof.length - 1; j++) { const [s0, u0] = prof[j], [s1, u1] = prof[j + 1], up = u0 && u1 ? 1 : (!u0 && !u1 ? 0 : (s0 + s1 < 0.01 ? 1 : u0));
        const le = Math.max(s0, s1) <= (up ? 0.105 : 0.04); g.M = le ? MAT.le : up ? matT : matB;
        const col = le ? COL.lip : up ? colT : colB;
        quad(g, pt(A, s0, u0), pt(B, s0, u0), pt(B, s1, u1), pt(A, s1, u1), col, nr(A, s0, u0), nr(B, s0, u0), nr(B, s1, u1), nr(A, s1, u1)); } }
    if (cap) { const S = st[st.length - 1]; g.M = matB; g.o = [S.x - S.c * 0.4, S.y, S.z - Math.sign(S.z) * 5];
      for (let j = 0; j < prof.length - 1; j++) tri(g, pt(S, prof[j][0], prof[j][1]), pt(S, prof[j + 1][0], prof[j + 1][1]), [S.x - S.c * 0.35, S.y, S.z], colB); }
    g.M = MAT.paint;
  }
  function toGeom(g, liv, extra) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, 3));
    geo.setAttribute('aMat', new THREE.Float32BufferAttribute(g.m, 4));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    if (liv) geo.setAttribute('aLiv', liv);
    if (extra) for (const k in extra) geo.setAttribute(k, extra[k]);
    geo.computeBoundingSphere(); return geo;
  }

  /* ---------------- aircraft types (true dimensions, metres; nose +X, wheels at y = 0) ---------------- */
  const NOSE = { airbus: { qt: 0.5, qb: 0.5, qw: 0.5, drop: 0.36 }, boeing: { qt: 0.78, qb: 0.42, qw: 0.62, drop: 0.5 }, b787: { qt: 0.68, qb: 0.48, qw: 0.56, drop: 0.42 },
    a380: { qt: 0.3, qb: 0.6, qw: 0.5, drop: 0.5 }, il96: { qt: 0.42, qb: 0.4, qw: 0.42, drop: 0.3 }, an124: { qt: 0.22, qb: 0.62, qw: 0.42, drop: 0.38 }, c17: { qt: 0.36, qb: 0.5, qw: 0.46, drop: 0.3 }, b747: { qt: 0.7, qb: 0.46, qw: 0.6, drop: 0.48 }, atr: { qt: 0.6, qb: 0.45, qw: 0.55, drop: 0.3 }, biz: { qt: 0.58, qb: 0.52, qw: 0.6, drop: 0.4 } };
  const TAIL = { round: { eh: 0.15, ew: 0.15, drop: 0.22 }, max: { eh: 0.06, ew: 0.06, drop: 0.28 }, blade: { eh: 0.24, ew: 0.035, drop: 0.2 }, b787: { eh: 0.11, ew: 0.09, drop: 0.24 },
    a380: { eh: 0.13, ew: 0.11, drop: 0.32 }, atr: { eh: 0.16, ew: 0.16, drop: 0.12 }, an124: { eh: 0.13, ew: 0.17, drop: 0.07 }, c17: { eh: 0.16, ew: 0.24, drop: 0.03 }, biz: { eh: 0.1, ew: 0.09, drop: 0.3 } };
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
    AT76: merge(base.tp, { L: 27.2, S: 27.1, ttl: [36, 60], doors: [[0.1, 1], [0.86, 1]] }),
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
    A388: { L: 72.7, S: 79.75, W: 3.57, H: 4.2, yb: 2.2, tn: .15, tt: .71, deck: 2, nose: 'a380', tail: 'a380', win: [[41, 48], [68, 75]], ttl: [18, 38], reg: [52, 63],
      doors: [[0.1, 1], [0.25, 1], [0.45, 1], [0.62, 1], [0.8, 1]],
      wing: { x: 9.5, y: 0.7, cr: 17.5, ct: 4.0, sw: 33.5, dh: 5.6, t: 2.0, kink: .3, flex: 0.01, wl: 'fence', wlh: 1.5 },
      eng: [{ z: 14.5, r: 1.55, len: 7.0, fwd: 4.6, drop: 1.9 }, { z: 25.8, r: 1.5, len: 6.8, fwd: 4.0, drop: 1.6 }],
      hs: { half: 15.3, cr: 10.5, ct: 3.6, sw: 34, dh: 4, te: 1.8, y: 0.0 }, fin: { cr: 14.8, ct: 5.4, h: 13.4, sw: 41, te: 1.2 },
      gear: { nd: 6.4, mains: [{ dx: 10.5, z: 6.2, b: 2 }, { dx: 13.8, z: 2.3, b: 3 }], r: 0.7, nr: 0.6 } },
    // Ilyushin Il-96-300PU: blunt rounded nose, big cockpit glazing, four slim PS-90A pods, upturned winglets, tall swept fin, centre gear
    IL96: merge(base.wb, { L: 55.3, S: 57.7, W: 3.04, H: 3.04, tn: .135, tt: .7, nose: 'il96', cockW: 64, doors: [[0.09, 1], [0.3, 1], [0.56, 1], [0.83, 1]],
      wing: { x: 5.2, cr: 11.4, ct: 2.5, sw: 30, dh: 5, t: 1.35, kink: .3, wl: 'classic', wlh: 3.0 },
      eng: [{ z: 8.4, r: 1.12, len: 5.8, fwd: 3.4, drop: 1.35 }, { z: 16.0, r: 1.08, len: 5.6, fwd: 2.8, drop: 1.1 }],
      hs: { half: 10.2, cr: 6.4, ct: 2.2, sw: 35 }, fin: { cr: 10.6, ct: 3.6, h: 9.8, sw: 43, te: 1.0 },
      gear: { nd: 6.8, mains: [{ dx: 7.2, z: 5.0, b: 2 }, { dx: 7.9, z: 0, b: 2 }], r: 0.62, nr: 0.5 } }),
    // Antonov An-124 Ruslan: fat freighter, cockpit hump over an upward-hinging nose visor, high anhedral wing, four big fans,
    // upswept tail with a low-set tailplane and tall fin, ten twin-wheel main legs in long sponsons low on the fuselage
    A124: { L: 68.96, S: 73.3, W: 3.65, H: 3.95, yb: 1.2, tn: .135, tt: .6, deck: 1, high: 1, nose: 'an124', tail: 'an124', win: [[24, 29]], winT: [0.15, 0.36], cockW: 48, visor: 1,
      doors: [[0.17, 0]], ttl: [30, 52], reg: [36, 48], spH: 1.45,
      wing: { x: 6.0, y: 0, cr: 13.5, ct: 3.6, sw: 32, dh: -3.5, t: 1.7, kink: .28, flex: 0, wl: '' },
      eng: [{ z: 10.4, r: 1.5, len: 5.8, fwd: 3.2, drop: 2.15 }, { z: 19.2, r: 1.45, len: 5.6, fwd: 2.6, drop: 2.0 }],
      hs: { half: 12.2, cr: 7.6, ct: 3.0, sw: 34, dh: 0, te: 1.0, y: 0.35 }, fin: { cr: 12.4, ct: 4.6, h: 9.8, sw: 40, te: 0.8 },
      gear: { nd: 7.2, spon: 1, mains: [{ dx: 8.2, z: 3.0, b: 1 }, { dx: 10.0, z: 3.0, b: 1 }, { dx: 11.8, z: 3.0, b: 1 }, { dx: 13.6, z: 3.0, b: 1 }, { dx: 15.4, z: 3.0, b: 1 }], r: 0.64, nr: 0.56 } },
    // Gulfstream G650: slender pointed nose, swept low wing with blended winglets, two BR725s on pylons on the rear
    // fuselage, a T-tail on a swept fin, big oval windows (CHW's window row is drawn for them), twin-wheel mains
    GLF6: { L: 30.4, S: 30.4, W: 1.36, H: 1.4, yb: 1.1, tn: .17, tt: .64, deck: 1, nose: 'biz', tail: 'biz', win: [[57, 81]], winT: [0.19, 0.6], ttl: [24, 48], reg: [86, 104], cockW: 58,
      doors: [[0.13, 1]], noCanoe: 1,
      wing: { x: 3.4, y: 0.3, cr: 6.0, ct: 1.3, sw: 34, dh: 3.5, t: 0.72, kink: 0, flex: 0, wl: 'sharklet', wlh: 1.5 },
      eng: [{ aft: 1, x: -3.9, y: 3.25, z: 2.25, r: 0.8, len: 5.2 }],
      hs: { half: 5.1, cr: 2.4, ct: 1.15, sw: 30, dh: 0, te: 0.6, ttail: 1 }, fin: { cr: 4.6, ct: 2.4, h: 4.0, sw: 40, te: 1.5 },
      gear: { nd: 2.9, mains: [{ dx: 3.9, z: 2.1, b: 1 }], r: 0.43, nr: 0.29 } },
    // Boeing 747-8: the upper-deck hump (hump: [t start, t full, t fade, t end, height]) running back to just ahead of the wing,
    // cockpit up on the hump's forehead, four GEnx pods with chevrons, raked tips (drawn span 68.4 m), a tall swept fin
    B748: merge(base.wb, { L: 76.3, S: 61.2, W: 3.25, H: 3.3, yb: 2.0, tn: .1, tt: .72, nose: 'b747', tail: 'round', N: 32, hump: [0.006, 0.125, 0.305, 0.378, 2.05],
      cockT: [0.056, 0.081], cockW: 50, win: [[47, 51, 0.1, 0.3], [60, 64]], ttl: [24, 50], doors: [[0.07, 1], [0.19, 1], [0.37, 1], [0.6, 1], [0.8, 1]],
      wing: { x: 8.6, y: 0.7, cr: 15.2, ct: 3.6, sw: 37.5, dh: 7, t: 1.9, kink: .3, wl: 'raked', flex: 0.015 },
      eng: [{ z: 11.9, r: 1.5, len: 6.4, fwd: 4.2, drop: 1.85, chev: 0.08 }, { z: 21.2, r: 1.5, len: 6.4, fwd: 3.4, drop: 1.65, chev: 0.08 }],
      hs: { half: 11.1, cr: 9.0, ct: 2.7, sw: 37, dh: 7, te: 1.2, y: 0.15 }, fin: { cr: 13.2, ct: 4.4, h: 11.0, sw: 45, te: 0.9 },
      gear: { nd: 7.6, mains: [{ dx: 12.4, z: 5.6, b: 2 }, { dx: 15.0, z: 1.9, b: 2 }], r: 0.66, nr: 0.6 } }),
    // Boeing C-17 Globemaster III: high anhedral wing on a dorsal fairing, winglets, four PW2040s on deep pylons, T-tail,
    // the rear fuselage swept up into a cargo ramp, main gear in long sponsons, a big glazed cockpit; grey all over
    C17: { L: 53, S: 51.75, W: 3.43, H: 3.35, yb: 0.95, tn: .12, tt: .6, deck: 1, high: 1, nose: 'c17', tail: 'c17', win: [[62, 67]], winT: [0.125, 0.2], cockW: 60, cockT: [0.045, 0.085],
      doors: [[0.15, 0]], ttl: [28, 50], reg: [36, 48], spH: 1.4, ramp: 1, topF: 1, noCanoe: 1,
      wing: { x: 5.6, y: 0, cr: 10.6, ct: 3.2, sw: 25, dh: -3.5, t: 1.45, kink: 0, flex: 0, wl: 'classic', wlh: 2.9 },
      eng: [{ z: 7.6, r: 1.12, len: 5.6, fwd: 2.6, drop: 1.95 }, { z: 14.2, r: 1.12, len: 5.6, fwd: 2.2, drop: 1.8 }],
      hs: { half: 9.9, cr: 5.2, ct: 2.5, sw: 30, dh: 0, te: 0.8, ttail: 1 }, fin: { cr: 9.6, ct: 5.6, h: 8.9, sw: 36, te: 0.3 },
      gear: { nd: 6.2, spon: 1, mains: [{ dx: 8.0, z: 2.75, b: 1 }, { dx: 10.2, z: 2.75, b: 1 }], r: 0.64, nr: 0.5 } },
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
  // the 747's upper deck: a flat-topped hump added over the crown, fading out down the sides
  const humpAt = (P, t) => { const H = P.hump; if (t <= H[0] || t >= H[3]) return 0;
    if (t < H[1]) { const u = (t - H[0]) / (H[1] - H[0]); return H[4] * Math.pow(Math.sin(u * Math.PI / 2), 0.75); }
    return t > H[2] ? H[4] * (1 - sstep((t - H[2]) / (H[3] - H[2]))) : H[4]; };
  const humpG = th => sstep(clamp((Math.cos(th) - 0.3) / 0.52, 0, 1));
  const posH = (P, t, th) => { const r = ringAt(P, t); return [r[0], r[1] + r[3] * Math.cos(th) + humpAt(P, t) * humpG(th), r[2] * Math.sin(th)]; };
  function surfH(P, t, th, off) {
    const p = posH(P, t, th), e = 0.0012, a = posH(P, Math.max(0, t - e), th), b = posH(P, Math.min(1, t + e), th), c = posH(P, t, th - 0.01), d = posH(P, t, th + 0.01);
    const tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2], ux = d[0] - c[0], uy = d[1] - c[1], uz = d[2] - c[2];
    let nx = ty * uz - tz * uy, ny = tz * ux - tx * uz, nz = tx * uy - ty * ux;
    if (ny * Math.cos(th) + nz * Math.sin(th) + (t < 0.01 ? nx : 0) < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    return { p: [p[0] + nx * off, p[1] + ny * off, p[2] + nz * off], n: [nx, ny, nz] };
  }
  function surf(P, t, th, off) {
    if (P.hump) return surfH(P, t, th, off);
    const [x, yc, w, h] = ringAt(P, t), e = 0.004; const ra = ringAt(P, Math.max(0, t - e)), rb = ringAt(P, Math.min(1, t + e));
    const R = (w + h) / 2, dR = ((ra[2] + ra[3]) - (rb[2] + rb[3])) / 2 / Math.max(1e-6, ra[0] - rb[0]);
    let nx = -dR, ny = Math.cos(th) * R / h, nz = Math.sin(th) * R / w; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    return { p: [x + nx * off, yc + h * Math.cos(th) + ny * off, w * Math.sin(th) + nz * off], n: [nx, ny, nz] };
  }
  let UVP = null; // the type being built (fusUV reads its deck count)
  const fusUV = (t, th) => { let a = Math.abs(th) % (2 * Math.PI); if (a > Math.PI) a = 2 * Math.PI - a; let q = a / Math.PI;
    if (UVP && UVP.deck === 2) { const d = q * 180; q = d <= 50 ? d / 180 * 1.3 : 0.361 + (d - 50) / 130 * 0.639; }
    return [t * UF, FA0 + FAK * q]; };
  function patch(g, P, t0, t1, nt, thF, nth, off, col, uvF) {
    const te = []; for (let i = 0; i <= nt; i++) te.push(t0 + (t1 - t0) * i / nt);
    if (P.cutT) { for (const ct of P.cutT) if (ct > t0 + 1e-4 && ct < t1 - 1e-4) te.push(ct); te.sort((a, b) => a - b); }
    for (let i = 0; i < te.length - 1; i++) for (let j = 0; j < nth; j++) {
      const ta = te[i], tb = te[i + 1], ua = j / nth, ub = (j + 1) / nth;
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

  function buildType(P, hi, liv, extra) {
    const body = Geo(), prop = Geo(), N = hi ? (P.N || (P.W > 2.5 ? 26 : 22)) : (P.hump ? 10 : 8);
    const WG = wingGeom(P); P.WG = WG; UVP = P;
    // wreck break lines (see below): fuselage rings, patches and wing stations are split there so no triangle straddles a break
    P.cutF = P.wing.x + Math.max(3, 0.1 * P.L); P.cutA = P.wing.x - P.wing.cr - Math.max(2.5, 0.07 * P.L); P.zb = WG.zr + 0.55 * (WG.half - WG.zr);
    P.cutT = [tOfX(P, P.cutF), tOfX(P, P.cutA)];
    P.nx = P.L / 2 - P.gear.nd; P.mains = P.gear.mains.map(m => ({ x: P.wing.x - m.dx, z: m.z, b: m.b }));
    P.gy = P.yb + 0.3 * P.H; P.pv = Math.min(...P.mains.map(m => m.x));
    // fuselage (smooth: analytic normals from the section function)
    const ts = [];
    for (const s of hi ? [0, .03, .07, .12, .18, .26, .35, .45, .56, .68, .8, .9, 1] : [0, .12, .4, 1]) ts.push(s * P.tn);
    if (hi) for (const s of [0.25, 0.5, 0.75]) ts.push(P.tn + (P.tt - P.tn) * s);
    for (const s of hi ? [0, .12, .25, .38, .5, .62, .74, .85, .93, .98, 1] : [0, .4, .75, 1]) ts.push(P.tt + s * (1 - P.tt));
    ts.push(P.cutT[0], P.cutT[1]);
    if (P.hump) { const H = P.hump; for (const s of hi ? [0.15, 0.3, 0.45, 0.6, 0.75, 0.9] : [0.4]) ts.push(H[0] + (H[1] - H[0]) * s);
      for (const s of hi ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.5, 1]) ts.push(H[2] + (H[3] - H[2]) * s); ts.push(H[1]);
    }
    ts.sort((a, b) => a - b); for (let i = ts.length - 1; i > 0; i--) if (ts[i] - ts[i - 1] < 1e-4) ts.splice(i, 1);
    const ring = (t, j) => surf(P, t, j / N * 2 * Math.PI, 0);
    for (let i = 0; i < ts.length - 1; i++) for (let j = 0; j < N; j++) {
      const A = ring(ts[i], j), B = ring(ts[i + 1], j), Cc = ring(ts[i + 1], j + 1), D = ring(ts[i], j + 1);
      const ta = j / N * 2 * Math.PI, tb = (j + 1) / N * 2 * Math.PI;
      quad(body, A.p, B.p, Cc.p, D.p, COL.white, A.n, B.n, Cc.n, D.n, [fusUV(ts[i], ta), fusUV(ts[i + 1], ta), fusUV(ts[i + 1], tb), fusUV(ts[i], tb)]);
    }
    { const r0 = ringAt(P, 0), r1 = ringAt(P, 1);
      for (let j = 0; j < N; j++) { const A = ring(0, j), D = ring(0, j + 1); body.o = [r0[0] - 5, r0[1], 0]; tri(body, A.p, D.p, [r0[0] + 0.1, r0[1], 0], COL.white, null, null, null, fusUV(0, 1.2));
        body.M = MAT.exh; const B = ring(1, j), Cc = ring(1, j + 1); body.o = [r1[0] + 5, r1[1], 0]; tri(body, B.p, Cc.p, [r1[0] - (P.tail === 'max' ? 0.9 : 0.3), r1[1], 0], COL.exh, null, null, null, PU.white); body.M = MAT.paint; } }
    // wing-to-body fairing (a smooth belly blister, painted like the keel) or the ATR's gear sponsons
    const keel = fusUV(0.5, Math.PI), EN = hi ? 16 : 6;
    if (P.gear.spon) { const xa = Math.max(...P.mains.map(m => m.x)), xb = Math.min(...P.mains.map(m => m.x)), w = P.W + (P.spH ? 0.55 : 0.32), hh = P.spH || 0.62;
      ellX(body, [[xa + 2.6, w * 0.3], [xa + 1.5, w * 0.92], [(xa + xb) / 2, w], [xb - 1.7, w * 0.92], [xb - 3.0, w * 0.35]], P.yb + (P.spH ? 0.95 : 0.5), hh / w, 1, EN, COL.white, keel); }
    else { const x0 = P.wing.x + (P.W > 2.5 ? 2.2 : 1.4), x1 = P.wing.x - P.wing.cr - (P.W > 2.5 ? 2.5 : 1.4), Wf = P.W * 1.06, rs = [];
      for (const s of hi ? [0, 0.06, 0.16, 0.32, 0.5, 0.68, 0.84, 0.94, 1] : [0, 0.25, 0.75, 1]) rs.push([x0 + (x1 - x0) * s, Wf * Math.max(0.12, Math.pow(Math.sin(Math.PI * (0.06 + 0.88 * s)), 0.42))]);
      ellX(body, rs, P.yb + 0.5 * P.H, 0.56 * P.H / Wf, 0.95, EN, COL.white, keel); }
    if (P.topF) { const x0 = P.wing.x + 2.4, x1 = P.wing.x - P.wing.cr - 2.6, rs = [];   // dorsal wing-root fairing over a high wing
      for (const s of hi ? [0, 0.08, 0.2, 0.4, 0.6, 0.8, 0.92, 1] : [0, 0.3, 0.7, 1]) rs.push([x0 + (x1 - x0) * s, P.W * 0.78 * Math.max(0.1, Math.pow(Math.sin(Math.PI * (0.04 + 0.92 * s)), 0.5))]);
      ellX(body, rs, P.yb + 2 * P.H - 0.55, 0.62, 0.3, EN, COL.white, fusUV(0.4, 0.2)); }
    // wings: airfoil sections (hi) with polished leading edges; flat slabs far away
    const { zr, half, xLE, yAt, zk, chord } = WG, wt = P.wing.t, wl = P.wing.wl;
    const sta = [zr]; if (P.wing.kink) sta.push(zk); if (hi) for (const u of [0.3, 0.55, 0.78]) sta.push(zk + (half - zk) * u); sta.push(half, P.zb);
    sta.sort((a, b) => a - b); for (let i = sta.length - 1; i > 0; i--) if (sta[i] - sta[i - 1] < 0.05) sta.splice(i, 1);
    const rake = wl === 'raked' ? (P.L > 70 ? 3.6 : 4.4) : 0;
    for (const sgn of [-1, 1]) {
      const pt = (z, le) => [le ? xLE(z) : xLE(z) - chord(z), yAt(z), sgn * z], th = z => wt * (1 - 0.72 * (z - zr) / (half - zr));
      if (hi) airfoil(body, sta.map(z => ({ x: xLE(z), y: yAt(z), z: sgn * z, c: chord(z), t: th(z) })), COL.wing, COL.wingB, MAT.wing, MAT.wingB, !rake);
      else { body.M = MAT.wing; for (let i = 0; i < sta.length - 1; i++) { const za = sta[i], zb = sta[i + 1];
        slab(body, [pt(za, 1), pt(za, 0), pt(zb, 0), pt(zb, 1)], [th(za), th(za) * 0.3, th(zb) * 0.3, th(zb)], 1, COL.wing, COL.wingB); } body.M = MAT.paint; }
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
        const seg = hi ? 4 : 1; let px = tx, py = ty, pz = half, pc = ct;
        for (let i = 1; i <= seg; i++) { const a = (i / seg) * 72 * D2R, sl = h / seg * 1.25, nx = px - sl * 0.75, ny = py + Math.sin(a) * sl, nz = pz + Math.cos(a) * sl * 0.6, nc = ct * (1 - 0.55 * i / seg);
          slab(body, [[px, py, sgn * pz], [px - pc, py, sgn * pz], [nx - nc, ny, sgn * nz], [nx, ny, sgn * nz]], [0.14, 0.06, 0.05, 0.1], i === seg ? 2 : 1, COL.white, null, PU.wlt); px = nx; py = ny; pz = nz; pc = nc; }
      } else if (wl === 'fence') {
        slab(body, [[tx + 0.3, ty - 0.7, z0], [tx - ct * 0.6, ty - 0.7, z0], [tx - ct * 0.75 - 0.4, ty + h, z0], [tx - ct * 0.25, ty + h, z0]], [0.12, 0.06, 0.05, 0.08], 2, COL.white, null, PU.wlt);
      } else if (wl === 'raked') { // 787 / 777: a highly swept tip panel, no winglet
        if (hi) airfoil(body, [{ x: tx, y: ty, z: z0, c: ct, t: th(half) }, { x: tx - rake * 0.55, y: ty + rake * 0.06, z: sgn * (half + rake * 0.55), c: ct * 0.62, t: th(half) * 0.6 }, { x: tx - rake * 1.05, y: ty + rake * 0.12, z: sgn * (half + rake), c: 0.4, t: 0.07 }], COL.wing, COL.wingB, MAT.wing, MAT.wingB, true);
        else { body.M = MAT.wing; slab(body, [[tx, ty, z0], [tx - ct, ty, z0], [tx - rake * 1.15 - 0.35, ty + rake * 0.12, z0 + sgn * rake], [tx - rake * 1.05, ty + rake * 0.12, z0 + sgn * rake]], [wt * 0.28, wt * 0.08, 0.06, 0.08], 1, COL.wing, COL.wingB); body.M = MAT.paint; }
      }
      // flap-track fairings: canoes under the trailing edge
      if (hi && !P.high && !P.noCanoe) for (const fr of P.W > 2.5 ? [0.2, 0.42, 0.62, 0.8] : [0.24, 0.5, 0.74]) {
        const z = zr + fr * (half - zr); if (P.eng.some(E => !E.aft && Math.abs(z - E.z) < E.r * 1.1)) continue;
        const c = chord(z), xf = xLE(z) - 0.6 * c, Lc = 0.78 * c, R = Math.max(0.1, 0.05 * c), y = yAt(z) - th(z) * 0.3 - R * 0.55;
        body.M = MAT.wingB; ellX(body, [[xf, R * 0.1], [xf - 0.2 * Lc, R * 0.42], [xf - 0.5 * Lc, R * 0.5], [xf - 0.8 * Lc, R * 0.3], [xf - Lc, R * 0.05]], y, 2.0, 1, 8, COL.wingB, PU.white, sgn * z); body.M = MAT.paint; }
      // engines + pylons
      for (const E of P.eng) {
        const ez = sgn * E.z, x0 = E.aft ? E.x : xLE(E.z) + E.fwd, ey = E.aft ? E.y : yAt(E.z) - E.drop, r = E.r, len = E.len, NE = hi ? (P.W > 2.5 ? 22 : 18) : 6, fl = E.flat || 1;
        if (E.prop) {
          revX(body, [[x0, r * 0.55], [x0 - 0.25 * len, r], [x0 - 0.75 * len, r * 0.9], [x0 - len, r * 0.35]], ey, ez, NE, COL.white, PU.eng, null, { k: 1, d: -0.3, c: COL.exh, uv: PU.white });
          revX(body, [[x0 + 0.7, 0.02], [x0 + 0.35, r * 0.4], [x0, r * 0.55]], ey, ez, NE, COL.white, PU.white);
          if (sgn > 0) for (let b = 0; b < 6; b++) { const a = b / 6 * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a), pa = -sa, pb = ca, R = E.prop;
            const w0 = 0.16, w1 = 0.1; const P0 = [0.02, ca * 0.25 + pa * w0, sa * 0.25 + pb * w0], P1 = [0.02, ca * R + pa * w1, sa * R + pb * w1], P2 = [-0.02, ca * R - pa * w1, sa * R - pb * w1], P3 = [-0.02, ca * 0.25 - pa * w0, sa * 0.25 - pb * w0];
            prop.o = [-5, 0, 0]; quad(prop, P0, P1, P2, P3, COL.prop); }
          E.px = x0 + 0.3; E.py = ey;
        } else if (hi) {
          const xf = x0 - 0.16 * len;
          body.M = MAT.le; revX(body, [[x0, r * 0.86], [x0 - 0.012 * len, r * 0.95], [x0 - 0.05 * len, r]], ey, ez, NE, COL.lip, PU.white, null, null, E.flat);
          body.M = MAT.paint; revX(body, [[x0 - 0.05 * len, r], [x0 - 0.3 * len, r * 0.995], [x0 - 0.6 * len, r * 0.94], [x0 - 0.8 * len, r * 0.8], [x0 - len, r * 0.64]], ey, ez, NE, COL.white, PU.eng, null, null, E.flat, E.chev);
          body.M = MAT.inner; revX(body, [[x0, r * 0.86], [xf, r * 0.8]], ey, ez, NE, COL.inner, PU.white, null, null, E.flat, 0, true);
          revX(body, [[x0 - len + 0.55 * r, r * 0.55], [x0 - len, r * 0.64]], ey, ez, NE, COL.inner, PU.white, null, null, E.flat, 0, true);
          // fan face: dark disc, 20 twisted blades, spinner
          body.M = MAT.fan; const Q = (a, rr, x) => { const ca = Math.cos(a); return [x, ey + rr * ca * (ca < 0 ? fl : 1), ez + rr * Math.sin(a)]; };
          body.o = [xf - 5, ey, ez]; for (let j = 0; j < NE; j++) tri(body, [xf, ey, ez], Q(j / NE * 2 * Math.PI, r * 0.8, xf), Q((j + 1) / NE * 2 * Math.PI, r * 0.8, xf), COL.fan);
          body.M = MAT.blade; for (let b = 0; b < 20; b++) { const a = b / 20 * 2 * Math.PI, xb = xf + 0.05 * r;
            body.o = [xb - 5, ey, ez]; quad(body, Q(a - 0.07, r * 0.3, xb + 0.05 * r), Q(a - 0.035, r * 0.79, xb + 0.09 * r), Q(a + 0.07, r * 0.79, xb - 0.05 * r), Q(a + 0.09, r * 0.3, xb - 0.03 * r), COL.blade); }
          body.M = MAT.fan; revX(body, [[xf + 0.42 * r, 0.0], [xf + 0.3 * r, 0.14 * r], [xf + 0.14 * r, 0.25 * r], [xf + 0.02, 0.3 * r]], ey, ez, 12, COL.spin, PU.white);
          // core nozzle and plug
          body.M = MAT.exh; revX(body, [[x0 - len + 0.55 * r, 0.52 * r], [x0 - len - 0.2 * r, 0.47 * r], [x0 - len - 0.45 * r, 0.4 * r]], ey, ez, NE, COL.exh, PU.white, null, { k: 0.85, d: -0.6 * r, c: COL.cone, uv: PU.white });
          body.M = MAT.paint;
        } else {
          revX(body, [[x0, r * 0.92], [x0 - 0.4 * len, r], [x0 - len, r * 0.65]], ey, ez, NE, COL.white, PU.eng, { k: 0.86, d: -0.3 * r, c: COL.fan, uv: PU.white }, { k: 1, d: -0.6 * r, c: COL.exh, uv: PU.white }, E.flat);
        }
        if (E.aft) { body.M = MAT.wing; const zi = ringAt(P, tOfX(P, x0 - 0.45 * len))[2] * 0.7;   // a short swept stub from the fuselage side
          slab(body, [[x0 - 0.2 * len, ey, sgn * (E.z - r * 0.5)], [x0 - 0.72 * len, ey, sgn * (E.z - r * 0.5)], [x0 - 0.86 * len, ey - 0.15, sgn * zi], [x0 - 0.1 * len, ey - 0.15, sgn * zi]],
            [0.34, 0.16, 0.22, 0.42], 1, COL.pylon); body.M = MAT.paint; }
        else if (!E.prop) { const wy = yAt(E.z), c = chord(E.z); body.M = MAT.wing;
          slab(body, [[x0 - 0.15 * len, ey + r * 0.6, ez], [x0 - 0.95 * len, ey + r * 0.6, ez], [xLE(E.z) - c * 0.7, wy - 0.05, ez], [xLE(E.z) + 0.3, wy - 0.05, ez]],
            [r * 0.26, r * 0.2, r * 0.16, r * 0.18], 2, COL.pylon); body.M = MAT.paint; }
        E.x0 = x0; E.ey = ey;
      }
    }
    // tailplane, fin (+ dorsal fillet); fin uv: u = 2 + chordwise (LE 0 .. TE 1), v = spanwise (tip 0 .. root 1): the shader maps it into the airline's tile
    const fin = P.fin, finTE = -P.L / 2 + fin.te, finLE = finTE + fin.cr, rmid = ringAt(P, tOfX(P, (finLE + finTE) / 2));
    const finY = rmid[1] + rmid[3] - 0.25, ftLE = finLE - Math.tan(fin.sw * D2R) * fin.h, finTop = finY + fin.h;
    const fuv = (fx, fy) => [2 + fx, fy];
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
      if (hi) airfoil(body, [{ x: hsLE, y: hsY, z: 0, c: hs.cr, t: hs.cr * 0.09 }, { x: tLE, y: ty, z: sgn * hs.half, c: hs.ct, t: hs.ct * 0.08 }], COL.stab, COL.wingB, MAT.wing, MAT.wingB, true);
      else slab(body, [[hsLE, hsY, 0], [hsTE, hsY, 0], [tLE - hs.ct, ty, sgn * hs.half], [tLE, ty, sgn * hs.half]], [hs.cr * 0.09, 0.08, 0.05, hs.ct * 0.08], 1, COL.stab, COL.wingB); }
    if (hi) {
      // cockpit glass (dark, glossy: it mirrors the sky), the A350's black mask, the 787's four panes
      const c0 = P.cockT ? P.cockT[0] : P.tn * (P.mask ? 0.3 : P.cockW ? 0.32 : 0.36), c1 = P.cockT ? P.cockT[1] : P.tn * (P.mask ? 0.6 : P.cockW ? 0.58 : 0.54), ca = P.mask ? 78 : P.cockW || (P.nose === 'boeing' ? 58 : 62);
      body.M = MAT.glass;
      if (P.cock4) for (const [a, b] of [[-56, -31], [-27, -3], [3, 27], [31, 56]]) patch(body, P, c0, c1, 3, (t, u) => (a + (b - a) * u) * D2R, 2, 0.06, COL.white);
      else patch(body, P, c0, c1, P.mask ? 4 : 3, (t, u) => (-ca + 2 * ca * u) * D2R, P.mask ? 10 : 6, 0.06, COL.white);
      body.M = MAT.paint;
      // cabin window rows (each row is a strip textured with the airline's window row)
      const w0 = P.winT ? P.winT[0] : P.tn * 1.08, w1 = P.winT ? P.winT[1] : P.tt + (1 - P.tt) * 0.2;
      for (const sgn of [-1, 1]) for (const [a, b, ra, rb] of P.win)
        patch(body, P, ra || w0, rb || w1, 6, (t, u) => sgn * (a - 1.5 + (b - a + 3) * u) * D2R, 1, 0.04, COL.white, (t, u) => [t * UF, WV0 + 0.004 + (WV1 - WV0 - 0.008) * u]);
      // titles and registration: a strip per side; U runs backwards on the starboard side so they read nose-first on both sides
      const tl = P.ttl || [19, 55], rg = P.reg || [44, 55];
      for (const sgn of [-1, 1]) { patch(body, P, TA, TB, 8, (t, u) => sgn * (tl[0] + (tl[1] - tl[0]) * u) * D2R, 5, 0.04, COL.white,
        (t, u) => [(sgn < 0 ? t : TA + TB - t) * UF, TV0 + 0.004 + (TV1 - TV0 - 0.008) * u]);
        patch(body, P, RA, RB, 3, (t, u) => sgn * (rg[0] + (rg[1] - rg[0]) * u) * D2R, 2, 0.04, COL.white,
          (t, u) => [(sgn < 0 ? t : RA + RB - t) * UF, TV0 + 0.004 + (TV1 - TV0 - 0.008) * u]); }
      // door outlines: two thin dark edges per door
      const wa = P.win[P.win.length - 1][0];
      for (const sgn of [-1, 1]) for (const [dt, big] of P.doors || []) {
        const dw = (big ? 1.0 : 0.55) / P.L, a0 = wa - 4, a1 = big ? wa + 24 : wa + 10;
        for (const e of [-1, 1]) { const tc = dt + e * dw / 2; patch(body, P, tc - 0.05 / P.L, tc + 0.05 / P.L, 1, (t, u) => sgn * (a0 + (a1 - a0) * u) * D2R, 1, 0.035, COL.white, () => PU.grey); }
        for (const aa of [a0, a1]) patch(body, P, dt - dw / 2, dt + dw / 2, 1, (t, u) => sgn * (aa - 0.6 + 1.2 * u) * D2R, 1, 0.035, COL.white, () => PU.grey);
      }
      if (P.visor) for (const sgn of [-1, 1]) { const tv = P.tn * 0.97, tc = P.tn * 0.62;
        patch(body, P, tv - 0.05 / P.L, tv + 0.05 / P.L, 1, (t, u) => sgn * (66 + 114 * u) * D2R, 4, 0.035, COL.white, () => PU.grey);
        patch(body, P, tc, tv, 3, (t, u) => sgn * (65.4 + 1.2 * u) * D2R, 1, 0.035, COL.white, () => PU.grey); }
      if (P.ramp) { const r0 = P.tt + 0.06, r1 = 0.955, L1 = 0.06 / P.L;   // the C-17's cargo ramp: hinge line and side seams
        for (const sgn of [-1, 1]) patch(body, P, r0, r1, 6, (t, u) => sgn * (128 + 1.6 * u) * D2R, 1, 0.035, COL.white, () => PU.dark);
        for (const tc of [r0, r0 - 0.035]) patch(body, P, tc - L1, tc + L1, 1, (t, u) => (128 + 104 * u) * D2R, 8, 0.035, COL.white, () => PU.dark); }
      if (P.deck === 2) for (const sgn of [-1, 1]) for (const dt of [0.2, 0.45, 0.7]) for (const e of [-1, 1]) { const tc = dt + e * 0.5 / P.L;
        patch(body, P, tc - 0.05 / P.L, tc + 0.05 / P.L, 1, (t, u) => sgn * (40 + 18 * u) * D2R, 1, 0.035, COL.white, () => PU.grey); }
      // landing gear: in the body mesh, flagged with its pivot height so the shader can retract it
      const G = P.gear, gTop = P.high ? P.yb + 0.3 : WG.rootY - 0.1, ws = 12, wb = P.W > 2.5;
      const keelAt = x => { const r = ringAt(P, tOfX(P, x)); return r[1] - r[3]; };
      body.G = P.gy;
      { const nw = wb ? 0.42 : 0.3, nz = nw / 2 + 0.06, top = keelAt(P.nx) + 0.2;
        body.M = MAT.strut; cylY(body, P.nx, 0, G.nr * 0.9, top, wb ? 0.14 : 0.1, 8, COL.strut); box(body, P.nx, G.nr, 0, 0.14, 0.14, nz * 2 + 0.1, COL.strut);
        box(body, P.nx + 0.25, (G.nr + top) * 0.55, 0, 0.5, 0.08, 0.08, COL.strut);
        for (const sg of [-1, 1]) { body.M = MAT.tyre; cylZ(body, P.nx, G.nr, sg * nz, G.nr, nw, ws, COL.tyre);
          body.M = MAT.hub; cylZ(body, P.nx, G.nr, sg * (nz + nw / 2), G.nr * 0.5, 0.03, 10, COL.hub);
          body.M = MAT.door; box(body, P.nx + 0.3, top - 0.42, sg * (wb ? 0.5 : 0.36), wb ? 1.3 : 1.0, 0.45, 0.03, COL.door, PU.white); } }
      for (const M of P.mains) for (const sgn of M.z === 0 ? [1] : [-1, 1]) {
        const z = sgn * M.z, top = M.z < P.W ? keelAt(M.x) + 0.3 : gTop, tw = wb ? 0.52 : 0.4, tz = tw / 2 + 0.12, sp = 1.45;
        body.M = MAT.strut; cylY(body, M.x, z, G.r * 0.9, top, wb ? 0.2 : 0.15, 8, COL.strut);
        box(body, M.x + 0.9, (G.r + top) * 0.62, z, 1.8, 0.1, 0.1, COL.strut);
        const axles = M.b === 1 ? [0] : Array.from({ length: M.b }, (_, kk) => (kk - (M.b - 1) / 2) * sp);
        if (M.b > 1) box(body, M.x, G.r + 0.05, z, sp * (M.b - 1) + 0.5, 0.22, 0.24, COL.strut);
        for (const ax of axles) { body.M = MAT.strut; box(body, M.x + ax, G.r, z, 0.14, 0.14, tz * 2 + 0.1, COL.strut);
          for (const sg of [-1, 1]) { body.M = MAT.tyre; cylZ(body, M.x + ax, G.r, z + sg * tz, G.r, tw, ws, COL.tyre);
            body.M = MAT.hub; cylZ(body, M.x + ax, G.r, z + sg * (tz + tw / 2), G.r * 0.55, 0.03, 10, COL.hub); } }
        if (M.z >= P.W) { body.M = MAT.door; const dl = top - G.r * 2 - 0.2; if (dl > 0.4) box(body, M.x + 0.1, G.r * 2 + 0.25 + dl / 2, z + sgn * 0.36, wb ? 1.9 : 1.4, dl, 0.05, COL.door, PU.white); }
      }
      body.G = 0; body.M = MAT.paint;
    }
    // wreck pieces: where the fuselage breaks (ahead of the wing, behind it) and where the starboard wing snaps; the dark end caps sit
    // inside the closed fuselage (unseen) until a wreck pulls the pieces apart; every triangle is tagged with its piece and pivot
    const { cutF, cutA, zb } = P;
    if (hi) { body.M = MAT.tyre; const ash = COL.char; for (const [xc, dir] of [[cutF + 0.06, 1], [cutF - 0.06, -1], [cutA + 0.06, 1], [cutA - 0.06, -1]]) {
      const t = tOfX(P, xc), rc = ringAt(P, t); body.o = [xc + 5 * dir, rc[1], 0];
      for (let j = 0; j < N; j++) tri(body, surf(P, t, j / N * 2 * Math.PI, -0.03).p, surf(P, t, (j + 1) / N * 2 * Math.PI, -0.03).p, [xc, rc[1], 0], ash); } body.M = MAT.paint; }
    const segA = new Float32Array(body.p.length), bp = body.p, PH = Math.max(P.W * 1.4, P.hs.half + 0.6);
    for (let i = 0; i < bp.length; i += 9) { const cx = (bp[i] + bp[i + 3] + bp[i + 6]) / 3, cz = (bp[i + 2] + bp[i + 5] + bp[i + 8]) / 3, az = Math.abs(cz);
      let s = 0, pa = 0, pb = 0; if (cx > cutF && az < P.W * 1.4) { s = 1; pa = cutF; pb = P.yb; } else if (cx < cutA && az < PH) { s = 2; pa = cutA; pb = P.yb; } else if (cz > zb) { s = 3; pa = zb; pb = yAt(zb); }
      for (let j = 0; j < 3; j++) { segA[i + j * 3] = s; segA[i + j * 3 + 1] = pa; segA[i + j * 3 + 2] = pb; } }
    const tipX = xLE(half) - P.wing.ct * 0.15 - (rake ? rake * 1.05 : 0), tipY = yAt(half) + 0.05 + (rake ? rake * 0.12 : 0), rt = ringAt(P, 1);
    P.LP = { tipX, tipY, tipZ: half + rake + 0.05, tailX: rt[0] - 0.15, tailY: rt[1], topX: P.wing.x - P.wing.cr * 0.3, topY: P.yb + 2 * P.H + 0.12,
      botX: P.wing.x - P.wing.cr * 0.75, botY: P.yb - 0.05, noseX: P.nx + 0.4, noseY: P.yb * 0.8, rootX: P.wing.x + 0.2, rootY: WG.rootY, rootZ: P.W + 1.2 };
    return { body: toGeom(body, liv, Object.assign({ aSeg: new THREE.Float32BufferAttribute(segA, 3) }, extra)), prop: prop.p.length ? toGeom(prop) : null };
  }

  /* ---------------- meshes: per type a hi (near, casts shadows, gear inside) and a lo (far) ---------------- */
  const root = new THREE.Group(); root.name = 'aircraft'; Z.scene.add(root);
  // the core provides scene.environment (sky PMREM); until it does, a small gradient-sky PMREM of our own keeps the paint reflective
  let ownEnv = null;
  if (!Z.scene.environment) try {
    const es = new THREE.Scene(), sm = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec3 vP;void main(){vec3 d=normalize(vP);float h=d.y;vec3 sky=mix(vec3(.82,.9,1.),vec3(.22,.42,.78),pow(max(h,0.),.45));vec3 gr=mix(vec3(.5,.5,.46),vec3(.24,.28,.2),min(1.,-h*4.));gl_FragColor=vec4(h>0.?sky:gr,1.);}' });
    es.add(new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), sm));
    const pm = new THREE.PMREMGenerator(Z.renderer); ownEnv = pm.fromScene(es, 0.01).texture; pm.dispose(); sm.dispose();
  } catch (e) { ownEnv = null; }
  // one physically based paint material for every type: per-vertex roughness / metalness / clear coat (paint, polished
  // leading edges, glass, rubber, chrome), the airline picked per instance, the gear retracted per instance
  const matBody = new THREE.MeshPhysicalMaterial({ vertexColors: true, map: texA, roughness: 0.35, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06,
    envMap: ownEnv, envMapIntensity: ownEnv ? 0.85 : 1 });
  const ambU = { value: 0 };
  const GEARV = 'if (aMat.w > 0.0) transformed.y = aMat.w + (transformed.y - aMat.w) * iGear;';
  // a wreck (negative livery index): the nose piece kinks down and aside, the tail section is torn off, yawed and rolled onto its side,
  // the starboard outer wing droops; rotations about each piece's pivot (aSeg = piece, pivot along, pivot height)
  const WRK = 'attribute vec3 aSeg;\nvec3 zwRot(vec3 d, vec3 r) { float c = cos(r.z), s = sin(r.z); d.xy = vec2(c * d.x - s * d.y, s * d.x + c * d.y); c = cos(r.x); s = sin(r.x); d.yz = vec2(c * d.y - s * d.z, s * d.y + c * d.z);' +
    ' c = cos(r.y); s = sin(r.y); d.xz = vec2(c * d.x + s * d.z, -s * d.x + c * d.z); return d; }\n' +
    'vec3 zwR(float s) { return s < 0.5 ? vec3(0.) : s < 1.5 ? vec3(0.06, 0.13, -0.055) : s < 2.5 ? vec3(0.34, -0.42, 0.035) : vec3(0.19, 0.03, 0.); }\n' +
    'vec3 zwT(float s) { return s < 0.5 ? vec3(0.) : s < 1.5 ? vec3(2.6, -0.3, 1.1) : s < 2.5 ? vec3(-8.5, -0.2, -5.5) : vec3(-0.3, -0.25, 0.); }\n' +
    'vec3 zwO(vec3 a) { return a.x > 2.5 ? vec3(0., a.z, a.y) : vec3(a.y, a.z, 0.); }\n';
  const WRKV = 'if (aLiv < -0.5 && aSeg.x > 0.5) { vec3 zo = zwO(aSeg); transformed = zo + zwRot(transformed - zo, zwR(aSeg.x)) + zwT(aSeg.x); }';
  matBody.onBeforeCompile = sh => {
    sh.uniforms.uAmb = ambU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aLiv;\nattribute vec4 aMat;\nattribute float iGear;\nvarying vec3 vMat;\nvarying float vWr;\nvarying vec3 vOP;\n' + WRK)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nif (aLiv < -0.5 && aSeg.x > 0.5) objectNormal = zwRot(objectNormal, zwR(aSeg.x));')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nfloat zLiv = aLiv < -0.5 ? -aLiv - 1.0 : aLiv;\n#ifdef USE_MAP\nif (uv.x > 1.5) { float fc = mod(zLiv, 3.), fr = floor(zLiv / 3. + 0.01); vMapUv = vec2((' + FX0.toFixed(1) + ' + (fc + 0.02 + 0.96 * (uv.x - 2.)) * ' + FT.toFixed(1) + ') / ' + AW.toFixed(1) + ', (fr + 0.02 + 0.96 * uv.y) * ' + (FT / AH).toFixed(6) + '); }\nelse vMapUv.y = (vMapUv.y + zLiv) * ' + VK.toFixed(6) + ';\n#endif')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat.xyz;\n' + GEARV + '\nvOP = transformed; vWr = aLiv < -0.5 ? 1.0 : 0.0;\n' + WRKV);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uAmb;\nvarying vec3 vMat;\nvarying float vWr;\nvarying vec3 vOP;\n' +
        'float zwH(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n' +
        'float zwN(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(mix(zwH(i), zwH(i + vec3(1., 0., 0.)), f.x), mix(zwH(i + vec3(0., 1., 0.)), zwH(i + vec3(1., 1., 0.)), f.x), f.y),' +
        ' mix(mix(zwH(i + vec3(0., 0., 1.)), zwH(i + vec3(1., 0., 1.)), f.x), mix(zwH(i + vec3(0., 1., 1.)), zwH(i + vec3(1., 1., 1.)), f.x), f.y), f.z); }')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat zwC = 0.0;\nif (vWr > 0.5) { float nz = zwN(vOP * 0.16) * 0.72 + zwN(vOP * 0.55) * 0.28;' +
        ' zwC = smoothstep(0.17, 0.29, nz); vec3 soot = mix(vec3(0.01, 0.009, 0.008), vec3(0.034, 0.031, 0.028), smoothstep(0.35, 0.8, zwN(vOP * 0.7 + 3.1)));' +
        ' diffuseColor.rgb = mix(diffuseColor.rgb * mix(vec3(0.5, 0.43, 0.36), vec3(0.22, 0.16, 0.11), smoothstep(0.05, 0.17, nz)), soot, zwC); }\nfloat lvSat = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)) - min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(clamp(vMat.x + 0.12 * lvSat, 0.03, 1.0), 0.97, max(zwC, vWr * 0.5));')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vMat.y * (1.0 - zwC);')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= vMat.z * (1.0 - vWr);\n#endif\nmaterial.specularColor *= 1.0 - 0.8 * zwC; material.specularF90 *= 1.0 - 0.8 * zwC;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uAmb;');
  };
  matBody.customProgramCacheKey = () => 'zmh-air-body-3';
  const matDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  matDepth.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aMat;\nattribute float iGear;\nattribute float aLiv;\n' + WRK).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + GEARV + '\n' + WRKV); };
  matDepth.customProgramCacheKey = () => 'zmh-air-depth-3';
  const matProp = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
  const matDisc = new THREE.MeshBasicMaterial({ color: 0x2a2d31, transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide });
  const IM = (geo, mat, cap, shadow) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.frustumCulled = false; m.castShadow = !!shadow; m.receiveShadow = !!shadow; m.count = 0;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(m); return m; };
  const MESH = {}, TRIS = {};
  let propG = null;
  for (const k of TKEYS) {
    const P = TDEF[k], IA = () => new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1).setUsage(THREE.DynamicDrawUsage);
    const livH = IA(), livL = IA(), gearA = IA();
    const gl = buildType(P, false, livL), gh = buildType(P, true, livH, { iGear: gearA });
    if (gh.prop) propG = gh.prop;
    MESH[k] = { hi: IM(gh.body, matBody, CAP, true), lo: IM(gl.body, matBody, CAP, false), livH, livL, gearA, P };
    MESH[k].hi.customDepthMaterial = matDepth; MESH[k].lo.receiveShadow = true;
    TRIS[k] = [gh.body.attributes.position.count / 3, gl.body.attributes.position.count / 3];
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

  /* ---------------- ground vehicles: every kind merged into one instanced mesh; each instance keeps only its own kind ---------------- */
  // aMat.w = kind * 10 + part (0 fixed, 1 rides the catering lift, 2 conveyor pivots, 3 scissor stretches); pure-white vertices take the instance paint
  const VK_ = { tug: 0, optug: 0, bowser: 1, cater: 2, belt: 3, bus: 4, jeep: 5, redjeep: 5, sweeper: 6 };
  const VT = { tug: C('#e9e4d6'), optug: C('#f0bd1e'), bowser: C('#f2f3f4'), cater: C('#f2f3f4'), belt: C('#f0bd1e'), bus: C('#2d5fae'), jeep: C('#f0bd1e'), redjeep: C('#c42a1f'), sweeper: C('#f0bd1e') };
  const VC = { dark: C('#2a2e33'), glass: C('#121820'), white: C('#f7f8f9'), tank: C('#d4d9de'), red: C('#c42a1f'), green: C('#2f7d4a'), blue: C('#2d5fae'), grey: C('#7c838b'), belt: C('#1f2124'), rail: C('#b9bec4'), yel: C('#f0bd1e') };
  const VM = { body: [0.45, 0.1, 0], glass: [0.06, 0.4, 0], tyre: [0.92, 0, 0], metal: [0.32, 0.85, 0], plastic: [0.7, 0, 0], tank: [0.28, 0.75, 0] };
  const BP = { x: -3.7, y: 1.05 }; // belt-loader conveyor pivot
  const VG = Array.from({ length: 7 }, () => Geo());
  { let g = VG[0]; const K = (kd, pt) => { g = VG[kd]; g.G = pt || 0; };
    const B = (x, y, z, l, h, w, col, m) => { g.M = m || VM.body; box(g, x, y + h / 2, z, l, h, w, col); };
    const wheel = (x, z, r, w) => { g.M = VM.tyre; cylZ(g, x, r, z, r, w, 8, COL.tyre); g.M = VM.metal; cylZ(g, x, r, z + Math.sign(z) * (w / 2 + 0.01), r * 0.5, 0.02, 6, COL.hub); };
    const stripe = (x0, x1, y, h, z, n) => { g.M = VM.plastic; const dx = (x1 - x0) / n; for (const sz of [-1, 1]) for (let i = 0; i < n; i++) { const xa = x0 + i * dx, zz = sz * z;
      g.o = [xa + dx / 2, y, 0]; quad(g, [xa, y, zz], [xa + dx, y, zz], [xa + dx, y + h, zz], [xa, y + h, zz], i % 2 ? VC.red : VC.white); } };
    const glassCab = (x, y, z, l, h, w) => { B(x, y, z, l, h, w, VC.glass, VM.glass); B(x, y + h, z, l + 0.06, 0.08, w + 0.06, COL.white); B(x, y - 0.02, z, l + 0.04, 0.12, w + 0.04, COL.white); };
    // 0 pushback tug: a low, heavy wedge with a side cab
    K(0); B(0, 0.3, 0, 5.6, 0.75, 2.7, COL.white); B(0.4, 1.05, 0.3, 3.2, 0.12, 1.9, VC.dark); B(2.85, 0.25, 0, 0.25, 0.55, 2.8, VC.dark); B(-2.85, 0.25, 0, 0.25, 0.55, 2.8, VC.dark);
    glassCab(-1.9, 1.05, -0.55, 1.4, 0.9, 1.4); stripe(-2.7, 2.7, 0.62, 0.14, 1.36, 8); for (const [x, z] of [[1.8, 1.2], [-1.8, 1.2], [1.8, -1.2], [-1.8, -1.2]]) wheel(x, z, 0.46, 0.42);
    // 1 fuel bowser: cab, chassis, polished tank with a band, hose reel
    K(1); B(0.3, 0.45, 0, 9.4, 0.35, 2.2, VC.dark); B(3.9, 0.55, 0, 1.9, 1.5, 2.4, COL.white); glassCab(4.5, 1.25, 0, 0.7, 0.75, 2.42);
    g.M = VM.tank; revX(g, [[2.7, 0.85], [2.6, 1.08], [-4.0, 1.08], [-4.15, 0.85]], 1.95, 0, 12, VC.tank, PU.white, { k: 1, d: 0.12, c: VC.tank }, { k: 1, d: -0.12, c: VC.tank }, 0.85);
    g.M = VM.body; revX(g, [[0.2, 1.1], [-0.6, 1.1]], 1.95, 0, 12, VC.green, PU.white, null, null, 0.85);
    B(-4.4, 0.6, 0, 0.5, 1.0, 2.0, VC.grey); stripe(-4.2, 2.7, 0.62, 0.14, 1.12, 10);
    for (const [x, z] of [[3.6, 1.05], [3.6, -1.05], [-1.8, 1.05], [-1.8, -1.05], [-3.0, 1.05], [-3.0, -1.05]]) wheel(x, z, 0.5, 0.42);
    // 2 catering high-loader: cab, scissor lift, box body that rides up to the door
    K(2); B(0, 0.45, 0, 7.8, 0.4, 2.3, VC.dark); B(3.1, 0.55, 0, 1.7, 1.55, 2.4, COL.white); glassCab(3.7, 1.3, 0, 0.55, 0.75, 2.42);
    K(2, 3); g.M = VM.metal; for (const sz of [-0.9, 0.9]) { slab(g, [[-2.3, 0.9, sz], [-2.0, 0.9, sz], [0.4, 1.9, sz], [0.1, 1.9, sz]], [0.1, 0.1, 0.1, 0.1], 2, VC.grey); slab(g, [[0.1, 0.9, sz], [0.4, 0.9, sz], [-2.0, 1.9, sz], [-2.3, 1.9, sz]], [0.1, 0.1, 0.1, 0.1], 2, VC.grey); }
    K(2, 1); B(-0.9, 0.95, 0, 5.2, 2.55, 2.45, COL.white); B(-0.9, 3.15, 0, 5.22, 0.3, 2.47, VC.blue); B(-3.6, 0.95, 0, 0.3, 0.12, 2.6, VC.grey); stripe(-3.5, 1.7, 1.05, 0.14, 1.235, 8);
    K(2); for (const [x, z] of [[2.9, 1.1], [2.9, -1.1], [-2.4, 1.1], [-2.4, -1.1]]) wheel(x, z, 0.45, 0.4);
    // 3 belt loader: chassis, side cab, conveyor (pivots up to the hold door) with rails
    K(3); B(0, 0.35, 0, 6.8, 0.45, 1.9, COL.white); glassCab(-2.4, 0.8, -0.5, 1.2, 0.95, 0.85); B(1.6, 0.8, 0, 0.25, 0.5, 0.5, VC.grey); stripe(-3.3, 3.3, 0.45, 0.14, 0.96, 8);
    K(3, 2); B(0.6, 0.95, 0.25, 8.6, 0.18, 0.9, VC.belt, VM.tyre); B(0.6, 1.08, -0.22, 8.6, 0.22, 0.06, VC.rail, VM.metal); B(0.6, 1.08, 0.72, 8.6, 0.22, 0.06, VC.rail, VM.metal);
    K(3); for (const [x, z] of [[2.4, 0.95], [2.4, -0.95], [-2.2, 0.95], [-2.2, -0.95]]) wheel(x, z, 0.36, 0.3);
    // 4 apron bus: low floor, glass band, white roof, three doors on the right
    K(4); B(0, 0.3, 0, 13.2, 1.15, 2.75, COL.white); B(0, 1.45, 0, 13.0, 1.25, 2.78, VC.glass, VM.glass); B(0, 2.7, 0, 13.2, 0.45, 2.75, VC.white); B(0, 1.32, 0, 13.22, 0.12, 2.77, VC.white);
    for (const x of [-4.2, 0, 4.2]) B(x, 0.35, 1.38, 1.3, 2.3, 0.04, VC.glass, VM.glass);
    for (const [x, z] of [[4.6, 1.2], [4.6, -1.2], [-4.6, 1.2], [-4.6, -1.2]]) wheel(x, z, 0.5, 0.38);
    // 5 follow-me / ops jeep: body, glasshouse, roof, light bar
    K(5); B(0, 0.35, 0, 4.6, 0.75, 1.9, COL.white); glassCab(-0.4, 1.1, 0, 2.5, 0.75, 1.82); B(-0.4, 1.95, 0, 1.2, 0.12, 1.4, VC.dark); stripe(-2.2, 2.2, 0.75, 0.12, 0.96, 6);
    for (const [x, z] of [[1.5, 0.85], [1.5, -0.85], [-1.5, 0.85], [-1.5, -0.85]]) wheel(x, z, 0.38, 0.3);
    // 6 runway sweeper: boxy body, high cab, brush
    K(6); B(0, 0.4, 0, 6.8, 2.1, 2.5, COL.white); glassCab(2.2, 2.5, 0, 2.0, 0.95, 2.2); B(-1.2, 2.5, 0, 3.6, 0.6, 2.3, VC.yel);
    g.M = VM.plastic; cylZ(g, 3.9, 0.45, 0, 0.45, 2.9, 8, VC.dark); stripe(-3.3, 1.0, 0.5, 0.16, 1.26, 8);
    for (const [x, z] of [[2.2, 1.15], [2.2, -1.15], [-2.2, 1.15], [-2.2, -1.15]]) wheel(x, z, 0.5, 0.36);
  }
  const VCAP = 700, VSH = 'float vpt = aMat.w;\nif (vpt > 0.5 && vpt < 1.5) transformed.y += iLift;\n' +
    'else if (vpt > 1.5 && vpt < 2.5) { vec2 vd = transformed.xy - vec2(' + BP.x.toFixed(2) + ', ' + BP.y.toFixed(2) + '); float vc = cos(iLift), vs = sin(iLift); transformed.xy = vec2(' + BP.x.toFixed(2) + ', ' + BP.y.toFixed(2) + ') + vec2(vc * vd.x - vs * vd.y, vs * vd.x + vc * vd.y); }\n' +
    'else if (vpt > 2.5) transformed.y = 0.9 + (transformed.y - 0.9) * max(iLift, 0.02);';
  const matVeh = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.1, envMap: ownEnv, envMapIntensity: ownEnv ? 0.8 : 1 });
  matVeh.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aMat;\nattribute float iLift;\nattribute vec3 iTint;\nvarying vec2 vMat;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat.xy;\n' + VSH + '\n#ifdef USE_COLOR\nvColor.rgb = mix(vColor.rgb, iTint, step(2.995, vColor.r + vColor.g + vColor.b));\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vMat;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vMat.x;').replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vMat.y;');
  };
  matVeh.customProgramCacheKey = () => 'zmh-veh-3';
  const matVehD = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  matVehD.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aMat;\nattribute float iLift;').replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VSH); };
  matVehD.customProgramCacheKey = () => 'zmh-veh-d-3';
  const VEH = VG.map(g => { const lift = new THREE.InstancedBufferAttribute(new Float32Array(VCAP), 1).setUsage(THREE.DynamicDrawUsage), tint = new THREE.InstancedBufferAttribute(new Float32Array(VCAP * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const m = new THREE.InstancedMesh(toGeom(g, null, { iLift: lift, iTint: tint }), matVeh, VCAP); m.customDepthMaterial = matVehD;
    m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; root.add(m); return { m, lift, tint, n: 0 }; });
  Z.vehicleTris = VEH.map(v => v.m.geometry.attributes.position.count / 3);
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
  function vput(kind, vx, vz, h, k, lift) {
    const V = VEH[VK_[kind]], i = V.n; if (i >= VCAP) return; _p.set(vx, 0, vz); _e.set(0, -h, 0); _q.setFromEuler(_e); _s.set(k, k, k); _m.compose(_p, _q, _s);
    V.m.setMatrixAt(i, _m); V.lift.array[i] = lift || 0; const t = VT[kind]; V.tint.array[i * 3] = t.r; V.tint.array[i * 3 + 1] = t.g; V.tint.array[i * 3 + 2] = t.b; V.n++;
  }
  let NOW = 0, NF = 0;
  function beacon(vx, vz, h, k, cx, cy, ph) { // amber rotating beacon
    if (Math.sin(NOW * 9 + ph) < 0.15) return; const c = Math.cos(h), s = Math.sin(h);
    L(vx + c * cx * k, cy * k, vz + s * cx * k, 3.0, 1.5, 0.2, (0.7 + 1.6 * NF) * k);
  }
  // vehicle kinds: draws boxes at (x, z) heading h, scale k
  function veh(kind, x, z, h, k, ph, lift) {
    switch (kind) {
      case 'tug': case 'optug': vput(kind, x, z, h, k, 0); beacon(x, z, h, k, -1.9, 2.15, ph); break;
      case 'bowser': vput(kind, x, z, h, k, 0); beacon(x, z, h, k, 3.9, 2.2, ph); break;
      case 'cater': vput(kind, x, z, h, k, lift); beacon(x, z, h, k, 3.1, 2.25, ph); break;
      case 'belt': { const top = Math.max(1.3, lift || 0); vput(kind, x, z, h, k, Math.atan(clamp((top - BP.y) / 8.6, 0, 0.6))); beacon(x, z, h, k, -2.4, 1.95, ph); break; }
      case 'bus': vput(kind, x, z, h, k, 0); break;
      case 'jeep': case 'redjeep': vput(kind, x, z, h, k, 0); beacon(x, z, h, k, -0.4, 2.15, ph); break;
      case 'sweeper': vput(kind, x, z, h, k, 0); beacon(x, z, h, k, 2.2, 3.6, ph); break;
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
      const fog = Z.scene.fog, fN = fog ? (fog.isFogExp2 ? 0.3 / Math.max(1e-6, fog.density) : fog.near) : 1e6, fF = fog ? (fog.isFogExp2 ? 1.8 / Math.max(1e-6, fog.density) : fog.far) : 2e6;
      lU.fogN.value = fN * 1.5; lU.fogF.value = fF * 1.6;
      const WI = Z.atmo && Z.atmo.wind, wdir = WI ? WI.dir || 0 : 0, wspd = WI ? WI.speed || 0 : 0, wgust = WI ? WI.gust || 0 : 0;
      pU.lum.value = 0.28 + 0.72 * (1 - NF);
      for (let j = 0; j < TKEYS.length; j++) { const kk = TKEYS[j]; hiN[kk] = 0; loN[kk] = 0; gN[kk] = 0; }
      nL = 0; nB = 0; nBird = 0; nProp = 0; nDisc = 0; nBlob = 0;
      const cp = cam.position, nearR = 1250 * k, nearR2 = nearR * nearR;
      const sd = Z.sunDir || _pb.set(0, 1, 0), sdy = Math.max(0.3, sd.y), sunUp = clamp(sd.y * 4, 0, 1), blobLift = 0.15 + Math.min(3, (Z.camDist || 1000) * 0.0003);
      bU.fogN.value = fN; bU.fogF.value = fF;
      const nav = 1.1 + 0.6 * NF, navS = (0.7 + 2.4 * NF) * k;
      for (let i = 0; i < F.length; i++) {
        const f = F[i], s = f.state; if (SKIP[s]) continue;
        const fam = MESH[f.type] ? f.type : 'A20N', M = MESH[fam], P = M.P;
        if (hiN[fam] + loN[fam] >= CAP) continue;
        let st = mem.get(f.id), fresh = false;
        if (!st) { st = { hd: f.heading, hr: 0, bank: 0, pitch: 0, gear: 1, prev: s, px: f.x, py: f.y, spd: 0, tdT: -1e9, smokeT: -1e9, smokeN: 0, ph: Math.random(), ph2: Math.random(), prop: Math.random() * 6, spool: 0, acc: 0, seen: 0, crab: 0 }; mem.set(f.id, st); fresh = true; }
        st.seen = frame;
        const dead = s === 'wreck', alt = dead ? -0.55 * P.yb * k : visAlt(f);
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
        if (dead) { st.pitch = -0.03; st.bank = st.ph > 0.5 ? 0.055 : -0.055; st.gear = 0; st.hr = 0; }
        // crab into the crosswind while airborne (de-crabbed in the flare), and buffeting in gusts / the andhi
        let bf = 0, pf = 0;
        { let ct = 0;
          if (alt > 1.5 && AIR[s] && wspd > 0.5) { const va = Math.max(60, st.spd || 0), gx = Math.cos(f.heading) * va - Math.cos(wdir) * wspd, gy = Math.sin(f.heading) * va - Math.sin(wdir) * wspd;
            ct = clamp(angD(f.heading, Math.atan2(gy, gx)), -0.26, 0.26) * clamp((alt - 1.5) / 12, 0, 1); }
          st.crab += (ct - st.crab) * (fresh || snap ? 1 : 1 - Math.exp(-rdt / 1.2));
          if (alt > 2) { const amp = (dust ? 0.7 + 0.9 * wgust : 0.12 + 0.35 * wgust) * clamp(alt / 25, 0, 1), q = now + st.ph * 40;
            bf = amp * (Math.sin(q * 3.1) * 0.035 + Math.sin(q * 7.7 + 1.3) * 0.02 + Math.sin(q * 1.3 + 4.1) * 0.03);
            pf = amp * (Math.sin(q * 4.3 + 2.2) * 0.012 + Math.sin(q * 9.1) * 0.006); } }
        // matrix: yaw, then pitch and bank about the main-gear contact point (rotation and flare pivot on the mains)
        const sx = 1, sz = 1, sy = 1, yaw = -(f.heading + st.crab);
        _e.set(st.bank + bf, yaw, st.pitch + pf); _q.setFromEuler(_e); _e.set(0, yaw, 0); _qy.setFromEuler(_e);
        _v1.set(P.pv * sx * k, 0, 0); _v2.copy(_v1).applyQuaternion(_q); _v1.applyQuaternion(_qy);
        _p.set(f.x + _v1.x - _v2.x, alt + _v1.y - _v2.y, f.y + _v1.z - _v2.z); _s.set(sx * k, sy * k, sz * k);
        _m.compose(_p, _q, _s);
        const ddx = f.x - cp.x, ddy = alt - cp.y, ddz = f.y - cp.z, near = ddx * ddx + ddy * ddy + ddz * ddz < nearR2; let li = fam === 'C17' && C17L[f.al] != null ? C17L[f.al] : (AIDX[f.al] || 0);
        if (dead) li = -li - 1;
        if (near) { const idx = hiN[fam]++; M.hi.setMatrixAt(idx, _m); M.livH.array[idx] = li; M.gearA.array[idx] = st.gear > 0.01 ? sstep(clamp(st.gear, 0, 1)) : 0; }
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
        if (!dead && (run || NF > 0.35)) {
          lw(LP.tipX, LP.tipY, -LP.tipZ); L(_v.x, _v.y, _v.z, 1.0 * nav, 0.07 * nav, 0.05 * nav, navS);
          lw(LP.tipX, LP.tipY, LP.tipZ); L(_v.x, _v.y, _v.z, 0.08 * nav, 1.0 * nav, 0.35 * nav, navS);
          lw(LP.tailX, LP.tailY, 0); L(_v.x, _v.y, _v.z, 0.85 * nav, 0.85 * nav, 0.85 * nav, navS * 0.85);
        }
        if (run && !dead) {
          const ph = (now + st.ph) % 1, bi = ph < 0.16 ? 1 - ph / 0.16 : 0;
          if (bi > 0) { const bI = (3.2 + 1.6 * NF) * bi, bS = (1.3 + 2.6 * NF) * k; lw(LP.topX, LP.topY, 0); L(_v.x, _v.y, _v.z, bI, 0.1 * bI, 0.05 * bI, bS); }
          const ph3 = (now + st.ph + 0.5) % 1, bj = ph3 < 0.16 ? 1 - ph3 / 0.16 : 0;
          if (bj > 0) { const bI = (3.2 + 1.6 * NF) * bj, bS = (1.3 + 2.6 * NF) * k; lw(LP.botX, LP.botY, 0); L(_v.x, _v.y, _v.z, bI, 0.1 * bI, 0.05 * bI, bS); }
        }
        if (STROBE[s]) {
          const t = (now / 1.2 + st.ph2) % 1;
          if (t < 0.035 || (t > 0.11 && t < 0.145)) { const sS = (1.8 + 4.5 * NF) * k;
            lw(LP.tipX, LP.tipY, -LP.tipZ); L(_v.x, _v.y, _v.z, 6, 6, 6.5, sS); lw(LP.tipX, LP.tipY, LP.tipZ); L(_v.x, _v.y, _v.z, 6, 6, 6.5, sS);
            lw(LP.tailX, LP.tailY, 0); L(_v.x, _v.y, _v.z, 4.5, 4.5, 5, sS * 0.8); }
        }
        if (LAND[s]) {
          const I = 2.6 + 1.3 * NF; lw(LP.noseX, LP.noseY, 0); L(_v.x, _v.y, _v.z, I, 0.96 * I, 0.86 * I, (1.1 + 18 * NF) * k);
          const I2 = 2.2 + 0.9 * NF, S2 = (1.2 + 6 * NF) * k; lw(LP.rootX, LP.rootY, -LP.rootZ); L(_v.x, _v.y, _v.z, I2, 0.95 * I2, 0.85 * I2, S2); lw(LP.rootX, LP.rootY, LP.rootZ); L(_v.x, _v.y, _v.z, I2, 0.95 * I2, 0.85 * I2, S2);
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
        const kk = TKEYS[j], M = MESH[kk], h = hiN[kk], l = loN[kk];
        M.hi.count = h; M.hi.visible = h > 0; if (h) { M.hi.instanceMatrix.needsUpdate = true; upd(M.livH, h); upd(M.gearA, h); }
        M.lo.count = l; M.lo.visible = l > 0; if (l) { M.lo.instanceMatrix.needsUpdate = true; upd(M.livL, l); }
      }
      if (props) { props.count = nProp; props.visible = nProp > 0; if (nProp) props.instanceMatrix.needsUpdate = true; }
      discs.count = nDisc; discs.visible = nDisc > 0; if (nDisc) discs.instanceMatrix.needsUpdate = true;
      blobs.count = nBlob; blobs.visible = nBlob > 0; if (nBlob) { blobs.instanceMatrix.needsUpdate = true; blobs.instanceColor.needsUpdate = true; }
      ambU.value = 0.1 * Math.max(NF, Z.dustNow ? 0.5 : 0);
      if (ownEnv && Z.scene.environment) { matBody.envMap = null; matBody.envMapIntensity = 1; matBody.needsUpdate = true; ownEnv = null; }
      for (let j = 0; j < VEH.length; j++) { const V = VEH[j], n = V.n; V.m.count = n; V.m.visible = n > 0; if (n) { V.m.instanceMatrix.needsUpdate = true; upd(V.lift, n); upd(V.tint, n); } V.n = 0; }
      if (!ownEnv && matVeh.envMap) { matVeh.envMap = null; matVeh.needsUpdate = true; }
      birds.count = nBird; birds.visible = nBird > 0; if (nBird) birds.instanceMatrix.needsUpdate = true;
      if (now - cleanT > 2) { cleanT = now; mem.forEach(cleaner); }
    },
  };
};
