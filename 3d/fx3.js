Z3MOD.fx3 = function (Z) {
  // Round 3 set piece: the Chief Minister's inauguration stage (Z.fx kind 'stage'), standing on a runway centreline.
  // A low platform with steps and a red carpet, a saffron-and-white shamiana, marigold garlands and pots, a podium,
  // a backdrop banner, two rows of white chairs with seated officials, speakers, photographers with flashes, a crowd
  // behind barricades, and (when cutAt is set) a ribbon on gold stanchions that he cuts with giant scissors.
  // Build-up and pack-away follow the sim clock (Z.T); every motion (gestures, walk cycle, petals, flashes) runs in
  // real time. Draw calls while active: structure 1, people/props 1, petals+flashes 1, contact shadow 1, plus the two
  // shadow casters (structure, people) = 6. Nothing is drawn while no stage is active.
  const THREE = Z.THREE;
  const col = h => new THREE.Color(h);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const R = mulberry(9137);
  const FLOOR = 1.1;                 // stage deck height (m)
  const POD = [2.2, 3.35];           // podium (x, z) at the front edge of the deck, clear of the eaves; the speaker stands just behind it
  const RIB = 6.1;                   // ribbon line (z), on the ground in front of the steps
  const Z0 = 7.0;                    // beyond this z the approach (carpet, barricades, arch) is squeezed toward the stage when scaled up

  // ================= atlas: the backdrop banner (top 3/4) and plain white (bottom 1/4) =================
  const AW = 2048, AH = 1280, BH = 768, FY0 = 790, FY1 = 970, WU = 0.5, WV = 1 - 1150 / 1280;
  const cv = document.createElement('canvas'); cv.width = AW; cv.height = AH;
  { const g = cv.getContext('2d'), W = AW, H = BH;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, AW, AH);
    const bg = g.createRadialGradient(W * 0.5, H * 0.42, 60, W * 0.5, H * 0.5, W * 0.62);
    bg.addColorStop(0, '#b3172f'); bg.addColorStop(0.55, '#850f24'); bg.addColorStop(1, '#470713'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // faint gold damask
    g.save(); g.globalAlpha = 0.09; g.strokeStyle = '#ffd98a'; g.lineWidth = 3;
    for (let y = 30, r = 0; y < H; y += 74, r++) for (let x = (r % 2) * 62; x < W; x += 124) {
      g.beginPath(); g.ellipse(x, y, 20, 31, 0, 0, 7); g.stroke(); g.beginPath(); g.arc(x, y, 7, 0, 7); g.stroke(); }
    g.restore();
    // a soft light pool behind the title
    const lp = g.createRadialGradient(W * 0.53, H * 0.42, 10, W * 0.53, H * 0.42, 700); lp.addColorStop(0, 'rgba(255,200,120,0.28)'); lp.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = lp; g.fillRect(0, 0, W, H);
    // tricolour sweep along the bottom
    const sweep = (y0, c, th) => { g.beginPath(); g.moveTo(0, y0); g.bezierCurveTo(W * 0.3, y0 - 70, W * 0.65, y0 + 50, W, y0 - 30); g.lineTo(W, y0 - 30 + th); g.bezierCurveTo(W * 0.65, y0 + 50 + th, W * 0.3, y0 - 70 + th, 0, y0 + th); g.closePath(); g.fillStyle = c; g.fill(); };
    sweep(H - 150, '#ff9933', 34); sweep(H - 116, '#ffffff', 30); sweep(H - 86, '#138808', 34);
    // gold frame
    const gold = g.createLinearGradient(0, 0, 0, H); gold.addColorStop(0, '#fff3b8'); gold.addColorStop(0.45, '#e2b23c'); gold.addColorStop(1, '#9c6a14');
    g.strokeStyle = gold; g.lineWidth = 22; g.strokeRect(14, 14, W - 28, H - 28); g.lineWidth = 6; g.strokeRect(46, 46, W - 92, H - 92);
    for (const [x, y] of [[46, 46], [W - 46, 46], [46, H - 46], [W - 46, H - 46]]) { g.fillStyle = gold; g.beginPath(); g.arc(x, y, 26, 0, 7); g.fill(); g.fillStyle = '#850f24'; g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill(); }
    // marigold festoons along the top
    for (let k = 0; k < 9; k++) { const x0 = 60 + k * (W - 120) / 9, x1 = x0 + (W - 120) / 9;
      for (let i = 0; i <= 26; i++) { const t = i / 26, x = lerp(x0, x1, t), y = 70 + Math.sin(Math.PI * t) * 46;
        g.fillStyle = i % 2 ? '#ffb000' : '#ff7a00'; g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); }
      g.fillStyle = '#2f7d1e'; g.beginPath(); g.ellipse(x1, 72, 9, 20, 0, 0, 7); g.fill(); }
    // emblem, left: a gold wheel with a white aircraft
    { const cx = 250, cy = 420; const eg = g.createRadialGradient(cx - 30, cy - 40, 10, cx, cy, 165); eg.addColorStop(0, '#fff2b0'); eg.addColorStop(1, '#c58e1c');
      g.fillStyle = eg; g.beginPath(); g.arc(cx, cy, 158, 0, 7); g.fill(); g.fillStyle = '#7a0c1f'; g.beginPath(); g.arc(cx, cy, 128, 0, 7); g.fill();
      g.strokeStyle = '#f2c94c'; g.lineWidth = 4; for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; g.beginPath(); g.moveTo(cx + Math.cos(a) * 132, cy + Math.sin(a) * 132); g.lineTo(cx + Math.cos(a) * 150, cy + Math.sin(a) * 150); g.stroke(); }
      g.save(); g.translate(cx, cy); g.rotate(-0.5); g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(0, 0, 92, 15, 0, 0, 7); g.fill();
      g.beginPath(); g.moveTo(-10, -8); g.lineTo(-45, -88); g.lineTo(-22, -88); g.lineTo(35, -8); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-10, 8); g.lineTo(-45, 88); g.lineTo(-22, 88); g.lineTo(35, 8); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-70, -4); g.lineTo(-92, -38); g.lineTo(-80, -38); g.lineTo(-58, -4); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-70, 4); g.lineTo(-92, 38); g.lineTo(-80, 38); g.lineTo(-58, 4); g.closePath(); g.fill(); g.restore();
      g.fillStyle = '#f2c94c'; g.font = 'bold 34px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.fillText('ZMI', cx, cy + 102); }
    // a tricolour flag, right
    { const fx = 1760, fy = 290, fw = 210, fh = 140;
      g.fillStyle = '#d9d9d9'; g.fillRect(fx - 10, fy - 20, 9, 330);
      for (let b = 0; b < 3; b++) { g.fillStyle = ['#ff9933', '#ffffff', '#138808'][b]; g.beginPath();
        for (let i = 0; i <= 20; i++) { const t = i / 20; g.lineTo(fx + t * fw, fy + b * fh / 3 + Math.sin(t * 5) * 10 * t); }
        for (let i = 20; i >= 0; i--) { const t = i / 20; g.lineTo(fx + t * fw, fy + (b + 1) * fh / 3 + Math.sin(t * 5) * 10 * t); }
        g.closePath(); g.fill(); }
      g.strokeStyle = '#000080'; g.lineWidth = 3; g.beginPath(); g.arc(fx + fw / 2, fy + fh / 2 + 5, 19, 0, 7); g.stroke();
      for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; g.beginPath(); g.moveTo(fx + fw / 2, fy + fh / 2 + 5); g.lineTo(fx + fw / 2 + Math.cos(a) * 19, fy + fh / 2 + 5 + Math.sin(a) * 19); g.stroke(); } }
    // title
    const tx = 1040; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const fit = (txt, font, px, maxW) => { let s = px; g.font = font.replace('#', s); while (g.measureText(txt).width > maxW && s > 20) { s -= 2; g.font = font.replace('#', s); } return s; };
    g.fillStyle = '#ffe9b8'; g.font = 'italic 42px Georgia, "Times New Roman", serif'; g.fillText('Welcome to the', tx, 300);
    fit('ZERO MILE INTERNATIONAL', 'bold #px Georgia, "Times New Roman", serif', 132, 1280);
    g.lineWidth = 10; g.strokeStyle = '#3a0509'; g.strokeText('ZERO MILE INTERNATIONAL', tx, 430);
    const tg = g.createLinearGradient(0, 330, 0, 440); tg.addColorStop(0, '#fff7cf'); tg.addColorStop(0.5, '#f3c443'); tg.addColorStop(1, '#c48a16');
    g.fillStyle = tg; g.fillText('ZERO MILE INTERNATIONAL', tx, 430);
    // the saffron scroll with INAUGURATION
    { const y0 = 462, y1 = 572, x0 = tx - 560, x1 = tx + 560;
      g.fillStyle = '#b8560a'; g.beginPath(); g.moveTo(x0 - 70, y0 + 20); g.lineTo(x0 + 10, y0 + 20); g.lineTo(x0 + 10, y1 + 20); g.lineTo(x0 - 70, y1 + 20); g.lineTo(x0 - 40, (y0 + y1) / 2 + 20); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(x1 + 70, y0 + 20); g.lineTo(x1 - 10, y0 + 20); g.lineTo(x1 - 10, y1 + 20); g.lineTo(x1 + 70, y1 + 20); g.lineTo(x1 + 40, (y0 + y1) / 2 + 20); g.closePath(); g.fill();
      const sg = g.createLinearGradient(0, y0, 0, y1); sg.addColorStop(0, '#ffb347'); sg.addColorStop(0.5, '#ff8c1a'); sg.addColorStop(1, '#e8700a');
      g.fillStyle = sg; g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.strokeStyle = '#ffe08a'; g.lineWidth = 5; g.strokeRect(x0 + 10, y0 + 10, x1 - x0 - 20, y1 - y0 - 20);
      fit('INAUGURATION', 'bold #px Georgia, "Times New Roman", serif', 94, 980);
      g.fillStyle = '#5a0710'; g.fillText('INAUGURATION', tx + 4, y1 - 22 + 4); g.fillStyle = '#ffffff'; g.fillText('INAUGURATION', tx, y1 - 22); }
    // the pandal fascia strip (rows FY0..FY1): gold on maroon with marigold edges, read by elevated cameras above the eaves
    { const y0 = FY0, h = FY1 - FY0, fg = g.createLinearGradient(0, y0, 0, y0 + h); fg.addColorStop(0, '#a3142a'); fg.addColorStop(1, '#5c0715');
      g.fillStyle = fg; g.fillRect(0, y0, AW, h); g.fillStyle = gold; g.fillRect(0, y0 + 20, AW, 5); g.fillRect(0, y0 + h - 25, AW, 5);
      for (let x = 6, i = 0; x < AW; x += 22, i++) { g.fillStyle = i % 2 ? '#ffb000' : '#ff7a00'; g.beginPath(); g.arc(x, y0 + 9, 10, 0, 7); g.fill(); g.beginPath(); g.arc(x + 11, y0 + h - 9, 10, 0, 7); g.fill(); }
      const fL = 'bold 88px Georgia, "Times New Roman", serif', fD = '700 92px "Kohinoor Devanagari", "Devanagari Sangam MN", "ITF Devanagari", "Noto Sans Devanagari", sans-serif';
      const t1 = 'ZERO MILE INTERNATIONAL  \u00b7  ', t2 = 'उद्घाटन';
      g.font = fL; const w1 = g.measureText(t1).width; g.font = fD; const w2 = g.measureText(t2).width;
      const x0 = (AW - w1 - w2) / 2, by = y0 + h / 2 + 31; g.textAlign = 'left';
      const fgd = g.createLinearGradient(0, y0 + 30, 0, y0 + h - 30); fgd.addColorStop(0, '#fff4c4'); fgd.addColorStop(0.5, '#f3c443'); fgd.addColorStop(1, '#c48a16');
      g.lineWidth = 8; g.strokeStyle = '#2a0306'; g.font = fL; g.strokeText(t1, x0, by); g.font = fD; g.strokeText(t2, x0 + w1, by);
      g.fillStyle = fgd; g.font = fL; g.fillText(t1, x0, by); g.font = fD; g.fillText(t2, x0 + w1, by); g.textAlign = 'center'; }
  }
  const atlas = new THREE.CanvasTexture(cv); atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = Math.min(8, Z.renderer.capabilities.getMaxAnisotropy ? Z.renderer.capabilities.getMaxAnisotropy() : 4);
  const BANNER_UV = [0, 1 - BH / AH, 1, 1], FASCIA_UV = [0, 1 - FY1 / AH, 1, 1 - FY0 / AH];

  // ================= the structure: one merged mesh with a per-vertex build phase and pivot =================
  const P = [], NN = [], CC = [], UV = [], AB = [], MRA = [], IX = [];
  const tv = new THREE.Vector3(), tn = new THREE.Vector3(), tm = new THREE.Matrix4(), nm = new THREE.Matrix3(), tq = new THREE.Quaternion(), te = new THREE.Euler(), ts = new THREE.Vector3(), tp = new THREE.Vector3();
  let PH = 0, PV = [0, 0, 0], MR = [0, 0.8];
  const ctx = (ph, pv, mr) => { PH = ph; PV = pv; MR = mr || [0, 0.8]; };
  function addGeo(geo, m, c, uvRect) {
    const p = geo.attributes.position, n = geo.attributes.normal, u = geo.attributes.uv, base = P.length / 3;
    nm.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      tv.fromBufferAttribute(p, i).applyMatrix4(m); tn.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      P.push(tv.x, tv.y, tv.z); NN.push(tn.x, tn.y, tn.z);
      const cc = typeof c === 'function' ? c(tv.x, tv.y, tv.z, i) : c; CC.push(cc.r, cc.g, cc.b);
      if (uvRect && u) UV.push(lerp(uvRect[0], uvRect[2], u.getX(i)), lerp(uvRect[1], uvRect[3], u.getY(i))); else UV.push(WU, WV);
      AB.push(PH, PV[0], PV[1], PV[2]); MRA.push(MR[0], MR[1]);
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) IX.push(base + geo.index.getX(i)); else for (let i = 0; i < p.count; i++) IX.push(base + i);
  }
  const M = (x, y, z, ry, sx, sy, sz, rx, rz) => tm.compose(tp.set(x, y, z), tq.setFromEuler(te.set(rx || 0, ry || 0, rz || 0)), ts.set(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz));
  const BOX = new THREE.BoxGeometry(1, 1, 1), SPH = new THREE.IcosahedronGeometry(1, 1), OCT = new THREE.OctahedronGeometry(1, 0);
  const box = (x, y, z, w, h, d, c, ry) => addGeo(BOX, M(x, y, z, ry, w, h, d), c);
  const cyl = (x, y0, z, rb, rt, h, seg, c, open) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!open); addGeo(g, M(x, y0 + h / 2, z), c); };
  const up = new THREE.Vector3(0, 1, 0), dv = new THREE.Vector3();
  const rod = (a, b, r, c, seg) => { dv.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = dv.length(); dv.normalize();
    const g = new THREE.CylinderGeometry(r, r, L, seg || 5, 1, true); tq.setFromUnitVectors(up, dv);
    tm.compose(tp.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), tq, ts.set(1, 1, 1)); addGeo(g, tm, c); };
  const qv = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  function tri(a, b, c, k) { qv[0].set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); qv[1].set(c[0] - a[0], c[1] - a[1], c[2] - a[2]); qv[2].crossVectors(qv[0], qv[1]).normalize();
    const base = P.length / 3; for (const p of [a, b, c]) { P.push(p[0], p[1], p[2]); NN.push(qv[2].x, qv[2].y, qv[2].z); CC.push(k.r, k.g, k.b); UV.push(WU, WV); AB.push(PH, PV[0], PV[1], PV[2]); MRA.push(MR[0], MR[1]); }
    IX.push(base, base + 1, base + 2); }
  const quad = (a, b, c, d, k) => { tri(a, b, c, k); tri(a, c, d, k); };
  const L3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  // a marigold string: a tube along points whose radius swells into beads, orange and yellow
  const MARI = [col('#ff7a00'), col('#ffae00'), col('#ff9200'), col('#e85d00')];
  function garland(pts, r, beads, alt, radSegs) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
    const segs = beads || Math.max(6, Math.round(curve.getLength() / Math.max(0.1, r * 1.6))), rad = radSegs || (r > 0.1 ? 4 : 3);
    const g = new THREE.TubeGeometry(curve, segs, r, rad, false);
    const pa = g.attributes.position, na = g.attributes.normal;
    for (let i = 0; i < pa.count; i++) { const ring = Math.floor(i / (rad + 1)), f = ring % 2 ? 0.3 : -0.15;
      pa.setXYZ(i, pa.getX(i) + na.getX(i) * r * f, pa.getY(i) + na.getY(i) * r * f, pa.getZ(i) + na.getZ(i) * r * f); }
    addGeo(g, tm.identity(), alt != null ? (x, y, z, i) => MARI[(Math.floor(i / (rad + 1)) + alt) % 2] : (x, y, z, i) => MARI[(Math.floor(i / (rad + 1)) >> 1) % 4]);
  }
  const swag = (a, b, dip, r) => { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; const p = L3(a, b, t); p[1] -= Math.sin(Math.PI * t) * dip; pts.push(p); } garland(pts, r); };

  // palette
  const K = {
    red: col('#8c0f1d'), carpet: col('#a3121f'), white: col('#f3f0e8'), cream: col('#efe6cf'), saffron: col('#ff8a1c'), saf2: col('#f47b0f'),
    maroon: col('#7a0c1c'), green: col('#1f7a32'), gold: col('#d9a630'), silver: col('#b9bec4'), black: col('#18191b'), dark: col('#2a2c30'),
    teak: col('#6b3a1c'), terra: col('#a5502a'), leaf: col('#2f6f22'), steel: col('#8d949b'), velvet: col('#6a0f24'),
  };

  // ---- platform, skirt, steps, carpet ----
  const HW = 6, HD = 4;           // deck half sizes
  ctx(0.0, [0, 0, 0]); box(0, FLOOR / 2, 0, HW * 2, FLOOR, HD * 2, K.carpet);
  box(0, FLOOR + 0.01, -0.6, HW * 2 - 0.6, 0.02, HD * 2 - 1.8, K.red);              // inner darker carpet field
  ctx(0.05, [0, 0, 0]);
  { // pleated skirt (white with saffron bands) on the front and both sides, a saffron top band, gold edge
    const run = (x0, z0, x1, z1, nx, nz) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 0.22);
      for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, o0 = (i % 2) * 0.06, o1 = ((i + 1) % 2) * 0.06;
        const a = [lerp(x0, x1, t0) + nx * (0.03 + o0), 0, lerp(z0, z1, t0) + nz * (0.03 + o0)], b = [lerp(x0, x1, t1) + nx * (0.03 + o1), 0, lerp(z0, z1, t1) + nz * (0.03 + o1)];
        const band = Math.floor(i / 3) % 3 === 1 ? K.saffron : K.white;
        quad(a, b, [b[0], FLOOR - 0.2, b[2]], [a[0], FLOOR - 0.2, a[2]], band);
        quad([a[0], FLOOR - 0.2, a[2]], [b[0], FLOOR - 0.2, b[2]], [b[0], FLOOR + 0.02, b[2]], [a[0], FLOOR + 0.02, a[2]], K.saf2); } };
    run(-HW, HD, HW, HD, 0, 1); run(HW, HD, HW, -HD, 1, 0); run(-HW, -HD, -HW, HD, -1, 0);
    box(0, FLOOR + 0.03, HD + 0.1, HW * 2 + 0.2, 0.06, 0.06, K.gold); box(HW + 0.1, FLOOR + 0.03, 0, 0.06, 0.06, HD * 2, K.gold); box(-HW - 0.1, FLOOR + 0.03, 0, 0.06, 0.06, HD * 2, K.gold);
  }
  ctx(0.1, [0, 0, HD]);
  for (let k = 0; k < 3; k++) { const h = FLOOR * (3 - k) / 3, d = 0.42; box(0, h / 2, HD + d * (k + 0.5), 3.2, h, d, K.carpet); box(0, h + 0.005, HD + d * (k + 0.5) + d / 2 - 0.02, 3.2, 0.012, 0.04, K.gold); }
  for (const s of [-1, 1]) box(s * 1.7, 0.5, HD + 0.63, 0.12, 1.0, 1.26, K.white);   // step cheeks
  ctx(10.12, [0, 0, HD + 1.3]);
  box(0, 0.16, 11.6, 2.6, 0.04, 20.6, K.carpet); for (const s of [-1, 1]) box(s * 1.26, 0.185, 11.6, 0.09, 0.012, 20.6, K.gold);

  // ---- shamiana: poles, a hipped striped roof with billowing panels, a scalloped valance with tassels ----
  const CW = 6.75, CD = 4.75, YE = 6.6, RWd = 2.3, YR = 8.3;
  const poles = [[-CW, -CD], [CW, -CD], [CW, CD], [-CW, CD], [CW, 0], [-CW, 0]];
  poles.forEach(([px, pz], i) => { ctx(0.18 + i * 0.01, [px, 0, pz], [0, 0.6]);
    const g = new THREE.CylinderGeometry(0.1, 0.12, YE, 6, 12, true);
    addGeo(g, M(px, YE / 2, pz), (x, y, z) => { const a = Math.atan2(z - pz, x - px) / 6.2832; return ((y * 1.6 + a) % 1 + 1) % 1 < 0.38 ? K.saffron : K.white; });
    cyl(px, 0, pz, 0.32, 0.26, 0.18, 8, K.white); });
  ctx(0.3, [0, YR, 0], [0, 0.9]);
  { const E = [[-CW, YE, -CD], [CW, YE, -CD], [CW, YE, CD], [-CW, YE, CD]], R0 = [-RWd, YR, 0], R1 = [RWd, YR, 0], sag = 0.16;
    const longFace = (b0, b1, u0, u1, n, off) => { for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, tmid = (t0 + t1) / 2;
      const a = L3(b0, b1, t0), b = L3(b0, b1, t1), c = L3(u0, u1, t1), d = L3(u0, u1, t0), bm = L3(b0, b1, tmid), um = L3(u0, u1, tmid);
      bm[1] -= sag; um[1] -= sag * 0.25; const k = (i + off) % 2 ? K.white : K.saffron; MR = [0, k === K.white ? 0.905 : 0.903]; quad(a, bm, um, d, k); quad(bm, b, c, um, k); } MR = [0, 0.9]; };
    longFace(E[3], E[2], R0, R1, 12, 0); longFace(E[1], E[0], R1, R0, 12, 0);
    const endFace = (b0, b1, apex, n) => { for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n; const a = L3(b0, b1, t0), b = L3(b0, b1, t1), bm = L3(b0, b1, (t0 + t1) / 2);
      bm[1] -= sag; const k = i % 2 ? K.white : K.saffron; MR = [0, k === K.white ? 0.905 : 0.903]; tri(a, bm, apex, k); tri(bm, b, apex, k); } MR = [0, 0.9]; };
    endFace(E[2], E[1], R1, 8); endFace(E[0], E[3], R0, 8);
    rod(R0, R1, 0.09, K.gold, 6);
    // valance: maroon band, scallops alternating saffron / white / green, a gold tassel at each point
    ctx(0.36, [0, YR, 0], [0, 0.9]);
    const edge = (a, b, nx, nz) => { const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(2, Math.round(L / 0.8)), o = 0.04;
      const A = [a[0] + nx * o, YE + 0.02, a[2] + nz * o], B = [b[0] + nx * o, YE + 0.02, b[2] + nz * o];
      quad(A, B, [B[0], YE - 0.2, B[2]], [A[0], YE - 0.2, A[2]], K.maroon);
      for (let s = 0; s < n; s++) { const kk = [K.saffron, K.white, K.green, K.white][s % 4];
        for (let j = 0; j < 4; j++) { const t0 = (s + j / 4) / n, t1 = (s + (j + 1) / 4) / n, p0 = L3(A, B, t0), p1 = L3(A, B, t1);
          const d0 = 0.15 + 0.25 * Math.sin(Math.PI * j / 4), d1 = 0.15 + 0.25 * Math.sin(Math.PI * (j + 1) / 4);
          p0[0] += nx * 0.005; p1[0] += nx * 0.005; p0[2] += nz * 0.005; p1[2] += nz * 0.005;
          quad([p0[0], YE - 0.2, p0[2]], [p1[0], YE - 0.2, p1[2]], [p1[0], YE - 0.2 - d1 + 0.2, p1[2]], [p0[0], YE - 0.2 - d0 + 0.2, p0[2]], kk); }
        const pm = L3(A, B, (s + 0.5) / n); MR = [0.8, 0.35]; addGeo(OCT, M(pm[0] + nx * 0.02, YE - 0.5, pm[2] + nz * 0.02, 0, 0.06, 0.1, 0.06), K.gold); MR = [0, 0.9]; } };
    edge(E[3], E[2], 0, 1); edge(E[2], E[1], 1, 0); edge(E[1], E[0], 0, -1); edge(E[0], E[3], -1, 0);
    ctx(0.4, [0, YR, 0], [0.9, 0.3]); for (const s of [-1, 1]) { addGeo(SPH, M(s * RWd, YR + 0.25, 0, 0, 0.22, 0.26, 0.22), K.gold); cyl(s * RWd, YR + 0.45, 0, 0.03, 0.01, 0.4, 5, K.gold); }
  }
  // canopy garlands: swags along the front and both sides, strings down the poles
  ctx(0.46, [0, YE, 0]);
  for (let i = 0; i < 6; i++) { const x0 = -CW + i * CW / 3, x1 = x0 + CW / 3; swag([x0, YE - 0.1, CD + 0.22], [x1, YE - 0.1, CD + 0.22], 0.4, 0.075); }
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const z0 = -CD + i * CD / 2, z1 = z0 + CD / 2; swag([s * (CW + 0.12), YE - 0.1, z0], [s * (CW + 0.12), YE - 0.1, z1], 0.45, 0.075); }
  poles.forEach(([px, pz]) => garland([[px + Math.sign(px) * 0.13, YE - 0.2, pz + (pz ? Math.sign(pz) * 0.13 : 0.13)], [px + Math.sign(px) * 0.13, 1.6, pz + (pz ? Math.sign(pz) * 0.13 : 0.13)]], 0.07));

  // ---- pandal fascia: a flex board across the canopy front, tilted back 15 degrees (atlas strip) ----
  ctx(0.38, [0, YE, CD], [0, 0.7]);
  { const tilt = -0.26, cy = YE - 0.1 + 0.6 * Math.cos(tilt), cz = CD + 0.2 + 0.6 * Math.sin(tilt);
    addGeo(new THREE.PlaneGeometry(2 * CW + 0.3, 1.2), M(0, cy, cz, 0, 1, 1, 1, tilt), col('#ffffff'), FASCIA_UV);
    addGeo(BOX, M(0, cy - 0.01, cz - 0.04, 0, 2 * CW + 0.4, 1.28, 0.05, tilt), K.maroon); }

  // ---- backdrop: truss towers, the banner, a white back, a garland across the top ----
  ctx(0.22, [0, FLOOR, -HD], [0.7, 0.35]);
  const BW = 11.4, BY0 = FLOOR + 0.35, BY1 = BY0 + BW * BH / AW;
  for (const s of [-1, 1]) { box(s * (BW / 2 + 0.2), (FLOOR + BY1 + 0.3) / 2, -HD + 0.05, 0.32, BY1 + 0.3 - FLOOR, 0.32, K.silver);
    for (let y = FLOOR + 0.3; y < BY1; y += 0.6) rod([s * (BW / 2 + 0.04), y, -HD + 0.21], [s * (BW / 2 + 0.36), y + 0.55, -HD + 0.21], 0.02, K.silver, 4); }
  box(0, BY1 + 0.2, -HD + 0.05, BW + 0.72, 0.32, 0.32, K.silver);
  ctx(0.3, [0, FLOOR, -HD], [0, 0.65]);
  box(0, (BY0 + BY1) / 2, -HD - 0.02, BW, BY1 - BY0, 0.06, K.white);
  { const g = new THREE.PlaneGeometry(BW, BY1 - BY0); addGeo(g, M(0, (BY0 + BY1) / 2, -HD + 0.025), col('#ffffff'), BANNER_UV); }
  box(0, BY0 - 0.12, -HD + 0.03, BW, 0.24, 0.05, K.maroon);
  ctx(0.5, [0, BY1, -HD]); for (let i = 0; i < 4; i++) swag([-BW / 2 + i * BW / 4, BY1 + 0.02, -HD + 0.2], [-BW / 2 + (i + 1) * BW / 4, BY1 + 0.02, -HD + 0.2], 0.45, 0.07);

  // ---- chairs: two rows of white covered chairs with saffron sashes; a maroon-and-gold chair (empty) for him ----
  const SEATS = [];
  const chair = (x, z, vip, ph) => { ctx(ph, [x, FLOOR, z]);
    const w = vip ? 0.82 : 0.56, c = vip ? K.velvet : K.white;
    box(x, FLOOR + 0.24, z, w, 0.48, 0.56, c); box(x, FLOOR + 0.78, z - 0.25, w, 0.66, 0.1, c);
    if (vip) { MR = [0.85, 0.3]; box(x, FLOOR + 1.13, z - 0.25, w + 0.06, 0.06, 0.14, K.gold); for (const s of [-1, 1]) box(x + s * (w / 2 + 0.03), FLOOR + 0.62, z - 0.03, 0.06, 0.06, 0.55, K.gold); MR = [0, 0.8]; }
    else box(x, FLOOR + 0.92, z - 0.31, w + 0.02, 0.14, 0.03, K.saffron);
  };
  for (let i = 0; i < 6; i++) { const x = -4.4 + i * 1.6, vip = i === 3; chair(vip ? x - 0.8 : x, -1.15, vip, 0.42 + i * 0.012); }
  for (let i = 0; i < 6; i++) { const x = -4.2 + i * 1.65; chair(x, -2.55, false, 0.46 + i * 0.012); SEATS.push([x, -2.55]); }
  for (let i = 0; i < 6; i++) if (i !== 3) SEATS.push([-4.4 + i * 1.6, -1.15]);
  const VIPSEAT = [-4.4 + 3 * 1.6 - 0.8, -1.15];
  // side tables with bouquets and water bottles: a white-clothed table in front of the front row
  ctx(0.48, [0, FLOOR, -0.2]); box(-0.8, FLOOR + 0.36, -0.2, 6.6, 0.72, 0.5, K.white); box(-0.8, FLOOR + 0.69, 0.05, 6.62, 0.08, 0.02, K.saffron);
  for (let i = 0; i < 5; i++) { addGeo(SPH, M(-3.6 + i * 1.4, FLOOR + 0.86, -0.2, 0, 0.17, 0.13, 0.17), (x, y, z, j) => MARI[j % 3]); }

  // ---- podium with emblem, gooseneck mic and a marigold bouquet ----
  ctx(40.45, [POD[0], FLOOR, POD[1]]);
  { const [px, pz] = POD; box(px, FLOOR + 0.55, pz, 0.8, 1.1, 0.55, K.teak); box(px, FLOOR + 1.14, pz - 0.02, 0.9, 0.08, 0.66, K.teak, 0);
    box(px, FLOOR + 0.6, pz + 0.285, 0.66, 0.78, 0.02, K.saffron); MR = [0.9, 0.3]; addGeo(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 16), M(px, FLOOR + 0.72, pz + 0.3, 0, 1, 1, 1, Math.PI / 2), K.gold);
    rod([px + 0.12, FLOOR + 1.18, pz + 0.1], [px + 0.1, FLOOR + 1.45, pz - 0.1], 0.012, K.black, 4); MR = [0, 0.5];
    addGeo(SPH, M(px + 0.1, FLOOR + 1.47, pz - 0.13, 0, 0.04, 0.04, 0.05), K.black);
    MR = [0, 0.8]; addGeo(SPH, M(px, FLOOR + 1.2, pz + 0.3, 0, 0.3, 0.2, 0.16), (x, y, z, j) => MARI[j % 4]); }

  // ---- speakers on tripods, side stacks ----
  ctx(0.4, [0, 0, 0], [0.2, 0.5]);
  for (const s of [-1, 1]) { const x = s * 7.4, z = 4.9, top = 2.6;
    for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.4; rod([x + Math.cos(a) * 0.65, 0.02, z + Math.sin(a) * 0.65], [x, 1.05, z], 0.022, K.dark, 4); }
    rod([x, 0.9, z], [x, top, z], 0.03, K.dark, 5);
    box(x, top + 0.42, z, 0.52, 0.82, 0.44, K.black, -s * 0.45); box(x + s * 0.09, top + 0.42, z + 0.23, 0.4, 0.66, 0.02, K.dark, -s * 0.45);
    box(x - s * 0.2, 0.85, -2.6, 0.75, 1.7, 0.65, K.black, -s * 0.3); box(x - s * 0.2, 0.85, -2.27, 0.6, 1.5, 0.02, K.dark, -s * 0.3); }

  // ---- flower pots: along the deck edge, flanking the steps, lining the carpet ----
  const POTS = [];
  for (const x of [-5.5, -4.3, -3.1, -1.95, 1.95, 3.1, 4.3, 5.5]) if (Math.abs(x - POD[0]) > 0.75) POTS.push([x, FLOOR, 3.65, 0.8]);
  for (const s of [-1, 1]) { POTS.push([s * 2.15, 0, HD + 0.9, 1.25]); for (let z = 8.2; z < 21; z += 3.2) POTS.push([s * 1.75, 0.17, z, 0.85]); }
  POTS.forEach(([x, y, z, k], i) => { ctx(0.5 + i * 0.006 + (z > Z0 ? 20 : 0), [x, y, z]);
    cyl(x, y, z, 0.17 * k, 0.24 * k, 0.4 * k, 8, K.terra); cyl(x, y + 0.4 * k, z, 0.26 * k, 0.26 * k, 0.05 * k, 8, K.terra);
    addGeo(OCT, M(x, y + 0.5 * k, z, 0.4, 0.3 * k, 0.15 * k, 0.3 * k), K.leaf);
    addGeo(SPH, M(x, y + 0.66 * k, z, i, 0.27 * k, 0.24 * k, 0.27 * k), (xx, yy, zz, j) => MARI[(j * 7 + i) % 4]); });
  // stage-front swags
  ctx(0.52, [0, FLOOR, HD]); for (let i = 0; i < 8; i++) { const x0 = -HW + i * 1.5, x1 = x0 + 1.5; swag([x0, FLOOR - 0.04, HD + 0.14], [x1, FLOOR - 0.04, HD + 0.14], 0.38, 0.06); }

  // ---- barricades with saffron and white cloth; a marigold welcome arch over the carpet ----
  ctx(10.3, [0, 0, RIB + 1], [0, 0.85]);
  { const run = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 2));
      for (let i = 0; i < n; i++) { const a = [lerp(x0, x1, i / n), 0, lerp(z0, z1, i / n)], b = [lerp(x0, x1, (i + 1) / n), 0, lerp(z0, z1, (i + 1) / n)];
        MR = [0, 0.85]; quad([a[0], 0.25, a[2]], [b[0], 0.25, b[2]], [b[0], 0.95, b[2]], [a[0], 0.95, a[2]], i % 2 ? K.white : K.saffron);
        MR = [0.6, 0.4]; rod([a[0], 0, a[2]], [a[0], 1.05, a[2]], 0.025, K.steel, 4); }
      MR = [0.6, 0.4]; rod([x0, 1.02, z0], [x1, 1.02, z1], 0.025, K.steel, 4); rod([x1, 0, z1], [x1, 1.05, z1], 0.025, K.steel, 4); MR = [0, 0.85]; };
    for (const s of [-1, 1]) { run(s * 2.0, RIB + 0.9, s * 2.0, 19.5); run(s * 2.0, RIB + 0.9, s * 8.0, RIB + 0.9); } }
  ctx(30.55, [0, 0, 21.4]);
  { for (let gi = 0; gi < 3; gi++) { const rr = 1.62 + gi * 0.13, hh = 3.4 + gi * 0.13, zz = 21.3 + gi * 0.1, pts = [];
      for (let i = 0; i <= 16; i++) { const a = Math.PI * i / 16; pts.push([-Math.cos(a) * rr, Math.sin(a) * hh + 0.05, zz]); }
      garland(pts, 0.07, 0, gi, 4); }
    addGeo(OCT, M(0, 3.62, 21.4, 0.4, 0.34, 0.22, 0.3), K.leaf); addGeo(SPH, M(0, 3.72, 21.4, 0, 0.16, 0.14, 0.16), (x, y, z, j) => MARI[j % 2]);
    for (const s of [-1, 1]) { cyl(s * 1.75, 0, 21.4, 0.22, 0.3, 0.45, 8, K.terra); addGeo(OCT, M(s * 1.75, 0.55, 21.4, 0.5, 0.34, 0.26, 0.34), K.leaf); } }

  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); sg.setAttribute('normal', new THREE.Float32BufferAttribute(NN, 3));
  sg.setAttribute('color', new THREE.Float32BufferAttribute(CC, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  sg.setAttribute('aB', new THREE.Float32BufferAttribute(AB, 4)); sg.setAttribute('aMR', new THREE.Float32BufferAttribute(MRA, 2)); sg.setIndex(IX);
  sg.computeBoundingSphere();
  const U = { uBuild: { value: 1 }, uK: { value: 1 }, uPodS: { value: 1 }, uFar: { value: 0 } };
  // aB.x = build phase + 10 * flag: 1 squeeze z beyond Z0 per vertex, 2 shift with the squeeze by pivot, 3 the same and hidden
  // when squeezed hard (the arch), 4 hero scale about the pivot (the podium)
  const z0s = Z0.toFixed(2);
  const BUILD = `float bph=aB.x;float bfl=floor(bph*0.1);bph-=bfl*10.;float bk=clamp((uBuild-bph)/0.16,0.,1.);bk=bk*bk*(3.-2.*bk);
    if(bfl>3.5)bk*=uPodS;if(bfl>2.5&&bfl<3.5)bk*=step(0.3,uK);
    transformed=aB.yzw+(transformed-aB.yzw)*bk;
    if(bfl>0.5&&bfl<1.5&&transformed.z>${z0s})transformed.z=${z0s}+(transformed.z-${z0s})*uK;
    if(bfl>1.5&&bfl<3.5&&aB.w>${z0s})transformed.z+=${z0s}+(aB.w-${z0s})*uK-aB.w;`;
  const patchV = sh => { sh.uniforms.uBuild = U.uBuild; sh.uniforms.uK = U.uK; sh.uniforms.uPodS = U.uPodS;
    sh.vertexShader = 'attribute vec4 aB;attribute vec2 aMR;uniform float uBuild,uK,uPodS;varying vec2 vMR;varying vec3 vLP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + BUILD + 'vMR=aMR;vLP=transformed;'); };
  const smat = new THREE.MeshStandardMaterial({ vertexColors: true, map: atlas, roughness: 1, metalness: 1, side: THREE.DoubleSide, envMapIntensity: 0.9 });
  smat.onBeforeCompile = sh => { patchV(sh);
    sh.uniforms.uFar = U.uFar;
    sh.fragmentShader = 'varying vec2 vMR;varying vec3 vLP;uniform float uFar;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nif(abs(vMR.y-0.904)<0.0015){float sct=mod(floor(atan(vLP.z,vLP.x)*0.95493+6.),2.);diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(1.,0.33,0.01),vec3(0.95,0.93,0.88),sct),uFar);}').replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * vMR.y;').replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * vMR.x;'); };
  smat.customProgramCacheKey = () => 'fx3-stage';
  const sdep = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  sdep.onBeforeCompile = sh => { sh.uniforms.uBuild = U.uBuild; sh.uniforms.uK = U.uK; sh.uniforms.uPodS = U.uPodS;
    sh.vertexShader = 'attribute vec4 aB;uniform float uBuild,uK,uPodS;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + BUILD); };
  sdep.customProgramCacheKey = () => 'fx3-stage-depth';
  const root = new THREE.Group(); root.name = 'fx3-stage'; root.visible = false; Z.scene.add(root);
  const structure = new THREE.Mesh(sg, smat); structure.customDepthMaterial = sdep; structure.castShadow = true; structure.receiveShadow = true; root.add(structure);
  // the AO pass renders its g-buffer with an override material that knows nothing of the build/squeeze patch: keep the structure
  // out of it whenever the shader moves vertices (it hides objects that are invisible at that point; update() shows it again)
  structure.onAfterRender = () => { if (U.uBuild.value < 1 || U.uK.value < 0.999 || U.uPodS.value > 1.001) structure.visible = false; };
  const nTriStatic = IX.length / 3;

  // ================= contact shadow =================
  const shc = document.createElement('canvas'); shc.width = shc.height = 128;
  { const g = shc.getContext('2d'); const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const shTex = new THREE.CanvasTexture(shc);
  const shMat = new THREE.MeshBasicMaterial({ map: shTex, color: 0x000000, transparent: true, depthWrite: false, opacity: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const shGeo = new THREE.PlaneGeometry(1, 1); shGeo.rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(shGeo, shMat); shadow.position.set(0, 0.2, 5); shadow.scale.set(22, 1, 30); shadow.renderOrder = -1; root.add(shadow);

  // ================= people and props: one instanced capsule, posed on the CPU every frame =================
  // a 40-triangle capsule (two poles, four rings of five), smooth normals
  const capGeo = (() => { const pos = [0, -1, 0], idx = [], RG = [[-0.84, 0.36], [-0.45, 0.5], [0.45, 0.5], [0.84, 0.36]], n = 5;
    for (const [y, r] of RG) for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; pos.push(Math.cos(a) * r, y, Math.sin(a) * r); }
    pos.push(0, 1, 0); const top = 1 + RG.length * n;
    for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; idx.push(0, 1 + k, 1 + k1);
      for (let g = 0; g < RG.length - 1; g++) { const a = 1 + g * n + k, b = 1 + g * n + k1, c = a + n, d = b + n; idx.push(a, c, b, b, c, d); }
      idx.push(top, 1 + (RG.length - 1) * n + k1, 1 + (RG.length - 1) * n + k); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; })();
  const MAXI = 760;
  const pmat = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0, envMapIntensity: 0.8 });
  const IM = new THREE.InstancedMesh(capGeo, pmat, MAXI); IM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  IM.setColorAt(0, K.white); IM.instanceColor.setUsage(THREE.DynamicDrawUsage); IM.castShadow = false; IM.receiveShadow = true; IM.count = 0; root.add(IM);
  IM.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 7), 18);
  const EA = IM.instanceMatrix.array, CA = IM.instanceColor.array;
  let NI = 0;
  function seg(ax, ay, az, bx, by, bz, r, dz, c, fx, fz) {
    if (NI >= MAXI) return;
    const dx = bx - ax, dy = by - ay, dzz = bz - az; let L = Math.sqrt(dx * dx + dy * dy + dzz * dzz), yx = 0, yy = 1, yz = 0;
    if (L > 1e-5) { yx = dx / L; yy = dy / L; yz = dzz / L; } else L = 0;
    let fd = fx * yx + fz * yz, zx = fx - fd * yx, zy = -fd * yy, zz = fz - fd * yz, zl = Math.sqrt(zx * zx + zy * zy + zz * zz);
    if (zl < 1e-3) { fd = yy; zx = -fd * yx; zy = 1 - fd * yy; zz = -fd * yz; zl = Math.sqrt(zx * zx + zy * zy + zz * zz) || 1; }
    zx /= zl; zy /= zl; zz /= zl;
    const xx = yy * zz - yz * zy, xy = yz * zx - yx * zz, xz = yx * zy - yy * zx, sx = 2 * r, sy = (L + 2 * r) / 2, sz = 2 * r * dz, o = NI * 16;
    EA[o] = xx * sx; EA[o + 1] = xy * sx; EA[o + 2] = xz * sx; EA[o + 3] = 0;
    EA[o + 4] = yx * sy; EA[o + 5] = yy * sy; EA[o + 6] = yz * sy; EA[o + 7] = 0;
    EA[o + 8] = zx * sz; EA[o + 9] = zy * sz; EA[o + 10] = zz * sz; EA[o + 11] = 0;
    EA[o + 12] = (ax + bx) / 2; EA[o + 13] = (ay + by) / 2; EA[o + 14] = (az + bz) / 2; EA[o + 15] = 1;
    CA[NI * 3] = c.r; CA[NI * 3 + 1] = c.g; CA[NI * 3 + 2] = c.b; NI++;
  }
  // a skeleton in person space (x = his left, y up, z forward), placed by root/yaw/scale
  const J = new Float32Array(17 * 3), W = new Float32Array(17 * 3);
  const sj = (i, x, y, z) => { J[i * 3] = x; J[i * 3 + 1] = y; J[i * 3 + 2] = z; };
  const PELV = 0, NECK = 1, HEAD = 2, LS = 3, LE = 4, LH = 5, RS = 6, RE = 7, RH = 8, LHIP = 9, LK = 10, LF = 11, RHIP = 12, RK = 13, RF = 14, PROP = 15, PROP2 = 16;
  function stand() { sj(PELV, 0, 0.97, 0); sj(NECK, 0, 1.45, 0); sj(HEAD, 0, 1.6, 0.01); sj(LS, 0.19, 1.41, 0); sj(LE, 0.22, 1.13, 0.0); sj(LH, 0.2, 0.88, 0.05);
    sj(RS, -0.19, 1.41, 0); sj(RE, -0.22, 1.13, 0.0); sj(RH, -0.2, 0.88, 0.05); sj(LHIP, 0.09, 0.94, 0); sj(LK, 0.1, 0.51, 0.02); sj(LF, 0.11, 0.06, 0.0);
    sj(RHIP, -0.09, 0.94, 0); sj(RK, -0.1, 0.51, 0.02); sj(RF, -0.11, 0.06, 0.0); }
  function seated() { sj(PELV, 0, 0.55, -0.1); sj(NECK, 0, 1.02, -0.14); sj(HEAD, 0, 1.17, -0.11); sj(LS, 0.19, 0.99, -0.13); sj(LE, 0.22, 0.74, -0.04); sj(LH, 0.14, 0.6, 0.2);
    sj(RS, -0.19, 0.99, -0.13); sj(RE, -0.22, 0.74, -0.04); sj(RH, -0.14, 0.6, 0.2); sj(LHIP, 0.1, 0.53, -0.06); sj(LK, 0.11, 0.55, 0.35); sj(LF, 0.12, 0.06, 0.4);
    sj(RHIP, -0.1, 0.53, -0.06); sj(RK, -0.11, 0.55, 0.35); sj(RF, -0.12, 0.06, 0.4); }
  function walkLegs(ph, amp) { const s = Math.sin(ph) * amp, c = Math.cos(ph) * amp;
    sj(LK, 0.1, 0.52 + Math.max(0, c) * 0.08, 0.02 + s * 0.22); sj(LF, 0.11, 0.06 + Math.max(0, c) * 0.12, s * 0.38 - 0.03);
    sj(RK, -0.1, 0.52 + Math.max(0, -c) * 0.08, 0.02 - s * 0.22); sj(RF, -0.11, 0.06 + Math.max(0, -c) * 0.12, -s * 0.38 - 0.03);
    sj(LE, 0.22, 1.13, -s * 0.12); sj(LH, 0.2, 0.89, -s * 0.24); sj(RE, -0.22, 1.13, s * 0.12); sj(RH, -0.2, 0.89, s * 0.24);
    J[PELV * 3 + 1] += Math.abs(c) * 0.025; }
  let pfx = 0, pfz = 1;
  function place(x, y, z, yaw, k) { const c = Math.cos(yaw), s = Math.sin(yaw); pfx = s; pfz = c;
    for (let i = 0; i < 17; i++) { const lx = J[i * 3], ly = J[i * 3 + 1], lz = J[i * 3 + 2];
      W[i * 3] = x + k * (lx * c + lz * s); W[i * 3 + 1] = y + k * ly; W[i * 3 + 2] = z + k * (-lx * s + lz * c); } }
  let PK = 1;
  const S = (i, j, r, dz, c) => seg(W[i * 3], W[i * 3 + 1], W[i * 3 + 2], W[j * 3], W[j * 3 + 1], W[j * 3 + 2], r * PK, dz, c, pfx, pfz);
  // a point between joints, lifted: used for the kurta hem, the jacket, the head
  const tA = new Float32Array(3), tB = new Float32Array(3);
  const at = (o, i, j, t, dy) => { o[0] = lerp(W[i * 3], W[j * 3], t); o[1] = lerp(W[i * 3 + 1], W[j * 3 + 1], t) + dy * PK; o[2] = lerp(W[i * 3 + 2], W[j * 3 + 2], t); };
  const SP = (r, dz, c) => seg(tA[0], tA[1], tA[2], tB[0], tB[1], tB[2], r * PK, dz, c, pfx, pfz);
  // dress the skeleton: o = {skin, hair, top, bottom, jacket, saree, pallu, cap, kurta, police}
  let LOD = false;
  function dress(o, seatedPose) {
    if (LOD) {   // far away: torso, legs, head (three capsules, a little stockier so they still read)
      S(PELV, NECK, 0.2, 0.8, o.jacket || o.top); if (!seatedPose) { at(tA, LF, RF, 0.5, 0.05); at(tB, PELV, PELV, 0, 0); SP(0.13, 1, o.saree || o.bottom); }
      at(tA, HEAD, HEAD, 0, -0.03); at(tB, HEAD, HEAD, 0, 0.04); SP(0.1, 1, o.cap || o.skin); return; }
    if (o.saree) { at(tA, PELV, PELV, 0, seatedPose ? 0.02 : 0.05); if (seatedPose) { at(tB, LK, RK, 0.5, 0); SP(0.2, 0.9, o.saree); at(tA, LK, RK, 0.5, 0); at(tB, LF, RF, 0.5, 0.04); SP(0.17, 0.8, o.saree); }
      else { at(tB, LF, RF, 0.5, 0.02); SP(0.21, 0.85, o.saree); } }
    else { S(LHIP, LK, 0.085, 1, o.bottom); S(LK, LF, 0.064, 1, o.bottom); S(RHIP, RK, 0.085, 1, o.bottom); S(RK, RF, 0.064, 1, o.bottom);
      if (o.kurta && !seatedPose) { at(tA, LK, RK, 0.5, 0.1); at(tB, PELV, PELV, 0, 0.06); SP(0.19, 0.72, o.top); } }
    S(PELV, NECK, 0.18, 0.66, o.top);
    if (o.jacket) { at(tA, PELV, NECK, 0.12, 0); at(tB, PELV, NECK, 0.88, 0); SP(0.185, 0.74, o.jacket); }
    if (o.pallu) { at(tA, RHIP, RHIP, 0, 0.02); at(tB, LS, LS, 0, 0.02); SP(0.075, 0.55, o.pallu); }
    if (o.police) { at(tA, PELV, PELV, 0, 0.04); at(tB, PELV, PELV, 0, 0.1); SP(0.18, 0.7, K.dark); }
    S(LS, LE, 0.056, 1, o.sleeve || o.top); S(LE, LH, 0.047, 1, o.forearm || o.sleeve || o.top); S(RS, RE, 0.056, 1, o.sleeve || o.top); S(RE, RH, 0.047, 1, o.forearm || o.sleeve || o.top);
    at(tA, HEAD, HEAD, 0, -0.035); at(tB, HEAD, HEAD, 0, 0.035); SP(0.088, 0.95, o.skin);
    if (o.cap) { at(tA, HEAD, HEAD, 0, 0.075); tA[0] -= pfx * 0.01; tA[2] -= pfz * 0.01; at(tB, HEAD, HEAD, 0, 0.1); SP(0.082, 1.05, o.cap); }
    else { at(tA, HEAD, HEAD, 0, 0.045); tA[0] -= pfx * 0.025 * PK; tA[2] -= pfz * 0.025 * PK; at(tB, HEAD, HEAD, 0, 0.07); tB[0] -= pfx * 0.03 * PK; tB[2] -= pfz * 0.03 * PK; SP(0.088, 1, o.hair);
      if (o.saree) { at(tA, HEAD, HEAD, 0, 0.0); tA[0] -= pfx * 0.11 * PK; tA[2] -= pfz * 0.11 * PK; tB[0] = tA[0]; tB[1] = tA[1] + 0.02; tB[2] = tA[2]; SP(0.06, 1, o.hair); } }
  }
  const SKIN = ['#8d5a3b', '#a06a45', '#7a4a30', '#b07a52', '#6e4229', '#9a6644'].map(col);
  const HAIR = ['#151210', '#1d1813', '#3b3632', '#6e6a66', '#d8d5d0'].map(col);
  const pick = a => a[Math.floor(R() * a.length)];
  // officials: men in kurtas with Nehru jackets (some with white caps), women in silk sarees
  const OFF = SEATS.map(([x, z], i) => { const woman = i % 4 === 1 || i === 6;
    return woman ? { x, z, ph: R() * 9, skin: pick(SKIN), hair: HAIR[R() < 0.7 ? 0 : 2], saree: col(['#c2185b', '#2e7d32', '#e0a100', '#1565c0', '#8e24aa', '#d84315'][i % 6]), pallu: K.gold, top: col(['#ad1457', '#1b5e20', '#c77800', '#0d47a1'][i % 4]), th: 0.74 + R() * 0.12 }
      : { x, z, ph: R() * 9, skin: pick(SKIN), hair: pick(HAIR), cap: R() < 0.3 ? K.white : null, kurta: 1, top: pick([K.white, K.cream, col('#f2efe6')]), bottom: K.white,
        jacket: R() < 0.75 ? col(pick(['#8a5a2b', '#1f3b5a', '#e2dccb', '#5b2333', '#2f5d46', '#4b3a5e'])) : null, th: 0.74 + R() * 0.12 }; });
  const CMO = { skin: col('#8a5638'), hair: col('#2b2724'), kurta: 1, top: col('#f7f6f1'), bottom: col('#f7f6f1'), jacket: col('#e07a1f'), forearm: col('#f7f6f1') };   // white kurta, saffron Nehru jacket: nobody else wears it
  // photographers in the press pit, police at the steps, the crowd behind the barricades
  const PHO = [[-3.0, 5.6, 0], [-4.6, 5.3, 1], [3.4, 5.5, 0], [4.9, 5.85, 0], [-6.0, 5.7, 0]].map(([x, z, crouch], i) => ({ x, z, crouch, ph: R() * 9, skin: pick(SKIN), hair: pick(HAIR),
    top: col(pick(['#2a2a2a', '#3c4a5a', '#5a4a3a', '#20303f', '#6b6f73'])), bottom: col(pick(['#23272e', '#3a3226', '#2b3a4a'])), vest: R() < 0.5 ? col('#6d6342') : null, th: 0.8 + i * 0.02, shoot: 0, fl: [0, 0, 0] }));
  const POL = [-2.75, 2.75].map(x => ({ x, z: HD + 1.0, skin: pick(SKIN), top: col('#b49a62'), bottom: col('#a68c56'), cap: col('#2c2f6b'), police: 1, th: 0.72 }));
  const CROWD = [];
  { const SH = ['#2b6cb0', '#e53e3e', '#38a169', '#f6e05e', '#ed8936', '#ffffff', '#805ad5', '#319795', '#d53f8c', '#4a5568', '#f4f1e8', '#e8d36a'].map(col);
    const PA = ['#2d3748', '#4a3b2a', '#1a365d', '#718096', '#22252a', '#efe9da'].map(col);
    for (const s of [-1, 1]) for (let i = 0; i < 13; i++) { const row = Math.floor(i / 5), x = s * (2.55 + (i % 5) * 1.05 + R() * 0.35 + row * 0.4), z = RIB + 1.45 + row * 0.85 + R() * 0.3;
      const woman = R() < 0.35, act = R();
      CROWD.push({ x, z, ph: R() * 9, skin: pick(SKIN), hair: pick(HAIR.slice(0, 4)), top: woman ? null : pick(SH), bottom: pick(PA), saree: woman ? col(pick(['#d81b60', '#ff7043', '#43a047', '#fdd835', '#1e88e5', '#8e24aa'])) : null,
        pallu: woman ? pick(SH) : null, cap: !woman && R() < 0.2 ? K.white : null, act: act < 0.22 ? 'flag' : act < 0.45 ? 'phone' : 'stand', th: 0.78 + R() * 0.18, k: 0.94 + R() * 0.1 }); }
    for (const c of CROWD) if (c.saree) c.top = c.saree; }
  const FLAGC = [col('#ff9933'), col('#ffffff'), col('#138808')];

  // ================= petals and camera flashes: one point cloud =================
  const NPET = 520, NFL = 28, NP = NPET + NFL;
  const pPos = new Float32Array(NP * 3), pS = new Float32Array(NP * 4), pF = new Float32Array(NP * 4);
  for (let i = 0; i < NPET; i++) { pS[i * 4] = R(); pS[i * 4 + 1] = R(); pS[i * 4 + 2] = R(); pS[i * 4 + 3] = i < 140 ? 0 : 1; }
  for (let i = NPET; i < NP; i++) pF[i * 4] = 1;
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pgeo.setAttribute('aS', new THREE.BufferAttribute(pS, 4));
  const pFA = new THREE.BufferAttribute(pF, 4); pFA.setUsage(THREE.DynamicDrawUsage); pgeo.setAttribute('aF', pFA);
  const PU = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uPx: { value: 800 }, uScl: { value: 1 }, uFm: { value: 3.5 }, uB: { value: new THREE.Vector2(-1, -1) }, uO0: { value: new THREE.Vector3() }, uO1: { value: new THREE.Vector3() }, uBuild: { value: 1 } }]);
  const pmatP = new THREE.ShaderMaterial({ uniforms: PU, fog: true, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: `attribute vec4 aS;attribute vec4 aF;uniform float uPx,uScl,uBuild,uFm;uniform vec2 uB;uniform vec3 uO0,uO1;
      varying vec3 vCol;varying float vA,vK,vRot,vAsp;varying float vFD;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){
        vec3 p=position;float size=0.;vK=aF.x;vA=1.;vRot=0.;vAsp=1.;vCol=vec3(1.);
        if(aF.x<0.5){
          bool s1=aS.w>0.5;float t=s1?uB.y:uB.x;vec3 o=s1?uO1:uO0+vec3((aS.x-.5)*1.8,aS.z*0.5,(fract(aS.y*3.71)-.5)*6.);
          if(t<0.||uBuild<0.3){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;return;}
          vec3 v0=s1?vec3((aS.x-.5)*8.,3.+aS.z*7.5,(aS.y-.5)*7.+0.8):vec3((aS.x-.5)*1.2,-0.2-aS.z*0.6,(aS.y-.5)*1.2);
          float floorY=s1?0.18:${(FLOOR + 0.03).toFixed(2)};
          float tau=0.45,vt=-(0.5+0.65*fract(aS.x*7.31+aS.z));vec2 wd=s1?vec2(0.55,0.3):vec2(0.15,0.08);
          float tl=tau+max(o.y+v0.y*tau-floorY,0.)/-vt;
          vec2 land=o.xz+v0.xz*tau+wd*(tl-tau);   // off the deck (or off the carpet) a petal falls to the ground
          if(s1?abs(land.x)>1.3:(abs(land.x)>${HW.toFixed(1)}||abs(land.y)>${HD.toFixed(1)})){floorY=0.03;tl=tau+max(o.y+v0.y*tau-floorY,0.)/-vt;}
          float tt=min(t,tl);float e=1.-exp(-tt/tau);
          p=o+vec3(v0.x*tau*e+wd.x*(tt-tau*e),v0.y*tau*e+vt*(tt-tau*e),v0.z*tau*e+wd.y*(tt-tau*e));
          p.xz+=vec2(sin(tt*2.6+aS.x*40.),cos(tt*2.1+aS.y*40.))*0.35*min(tt,1.);p.y=max(p.y,floorY+aS.z*0.02);
          size=0.08+0.05*aS.y;
          vCol=mix(vec3(1.,0.36,0.01),vec3(1.,0.62,0.02),step(0.5,aS.z));if(fract(aS.y*13.7)>0.82)vCol=vec3(0.7,0.03,0.07);
          vRot=tt*(3.+aS.x*5.)+aS.y*6.28;vAsp=t<tl?0.3+0.7*abs(sin(tt*(4.+aS.z*4.)+aS.x*9.)):0.55;
          vA=smoothstep(0.3,0.45,uBuild);
        }else{size=aF.z;vA=aF.y;vK=aF.w>1.5?2.:1.;vCol=aF.w>1.5?vec3(1.,0.7,0.32):aF.w>0.5?vec3(0.8,0.88,1.):vec3(1.,0.96,0.9);if(vA<0.004){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;return;}}
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;vFD=-mv.z;
        float px=size*uScl*uPx/max(-mv.z,1.);
        gl_PointSize=aF.x<0.5?max(px,1.4):max(px,uFm*min(vA*3.,1.));
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform vec3 fogColor;uniform float fogDensity;varying vec3 vCol;varying float vA,vK,vRot,vAsp,vFD;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        vec2 c=gl_PointCoord-0.5;float ff=1.-exp(-fogDensity*fogDensity*vFD*vFD);
        if(vK<0.5){float cs=cos(vRot),sn=sin(vRot);vec2 q=vec2(cs*c.x-sn*c.y,sn*c.x+cs*c.y);q.y/=vAsp;float d=length(q)*2.;if(d>1.)discard;
          vec3 cc=mix(vCol*(0.8+0.2*(1.-d)),fogColor,ff);gl_FragColor=vec4(cc*vA,vA);}
        else if(vK>1.5){float d=length(c)*2.;if(d>1.)discard;gl_FragColor=vec4(vCol*exp(-d*d*3.5)*(1.-d)*vA*(1.-ff),0.);}
        else{float d=length(c)*2.;if(d>1.)discard;float I=(exp(-d*d*22.)*7.+exp(-d*d*5.)*0.9+(exp(-abs(c.x)*70.)+exp(-abs(c.y)*70.))*(1.-d)*1.6)*vA*(1.-ff);
          gl_FragColor=vec4(vCol*I,0.);}
      }` });
  pgeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 3, 4), 22);
  const points = new THREE.Points(pgeo, pmatP); points.renderOrder = 5; root.add(points);

  // ================= state =================
  let cur = null, scl = -1, lastT = 0, lastNow = -1e9, rate = 20, snipAt = 1e9, cutSeen = -1e9, welAt = -1e9, ribAt = -1e9, offAt = -1e9, appl = -1e9, cheer = -1e9,
    holdEndT = null, strikeK = 1, lastHit = -1e9, gest = 0, gestT = 0, nextGest = 0, flSlot = 0, flDirty = true;
  const NFR = NFL - 1, HALO = NFL - 1;        // camera flashes use a ring of NFR slots; the last slot is the speaker's halo
  const flash = new Float32Array(NFL * 6);   // x, y, z, start, size, kind (0 camera, 1 phone)
  const A = { le: [0, 0, 0], lh: [0, 0, 0], re: [0, 0, 0], rh: [0, 0, 0], lean: 0, yaw: 0, yawT: 0, nod: 0 };
  const ARMS = ['le', 'lh', 're', 'rh'], SG = [-1, 1];
  const AT = { le: [0, 0, 0], lh: [0, 0, 0], re: [0, 0, 0], rh: [0, 0, 0] };
  const set3 = (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; };
  const fireFlash = (x, y, z, now, size, phone) => { const o = flSlot * 6; flash[o] = x; flash[o + 1] = y; flash[o + 2] = z; flash[o + 3] = now; flash[o + 4] = size; flash[o + 5] = phone ? 1 : 0; flSlot = (flSlot + 1) % NFR; };
  // the Chief Minister's paths: backstage -> podium; podium -> down the steps -> behind the ribbon; podium -> off, backstage
  const PATH_IN = [[5.6, FLOOR, -3.4], [5.3, FLOOR, 1.2], [POD[0] + 0.1, FLOOR, POD[1] - 0.62]];
  const PATH_RIB = [[POD[0] + 0.1, FLOOR, POD[1] - 0.62], [1.4, FLOOR, 2.8], [0.45, FLOOR, 3.7], [0.15, 0, HD + 1.35], [0, 0, RIB - 0.5]];
  const PATH_OUT = [[POD[0] + 0.1, FLOOR, POD[1] - 0.62], [5.3, FLOOR, 1.2], [5.6, FLOOR, -3.4]];
  const pathLen = p => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][2] - p[i - 1][2]); return L; };
  const PLEN = [pathLen(PATH_IN), pathLen(PATH_RIB), pathLen(PATH_OUT)];
  // walks run in real time at a walking pace, whatever the sim speed (seconds)
  const DIN = PLEN[0] / 1.3, DRIB = PLEN[1] / 1.15, DOFF = PLEN[2] / 1.3;
  const pp = [0, 0, 0, 0];   // x, y, z, heading
  function pathAt(p, d) { let L = 0;
    for (let i = 1; i < p.length; i++) { const l = Math.hypot(p[i][0] - p[i - 1][0], p[i][2] - p[i - 1][2]);
      if (L + l >= d || i === p.length - 1) { const t = l > 0 ? clamp((d - L) / l, 0, 1) : 1; pp[0] = lerp(p[i - 1][0], p[i][0], t); pp[2] = lerp(p[i - 1][2], p[i][2], t);
        pp[1] = lerp(p[i - 1][1], p[i][1], t); pp[3] = Math.atan2(p[i][0] - p[i - 1][0], p[i][2] - p[i - 1][2]); return pp; } L += l; }
    return pp; }
  const deckY = z => z <= HD ? FLOOR : z >= HD + 1.26 ? 0 : FLOOR * (1 - Math.ceil((z - HD) / 0.42 - 1e-3) / 3);
  // aircraft that put the stage in the way: moving on or along the runway
  const MOVING = { lineup: 1, roll: 1, rollout: 1, taxi_out: 1, taxi_in: 1, wedtaxi: 1, tow: 1, approach: 1, goaround: 1 };

  let GX = 1;   // gesture size: bigger with distance so the speech reads from far away
  const SHL = [0.19, 1.41, 0], SHR = [-0.19, 1.41, 0];
  const big = (o, s) => { o[0] = s[0] + (o[0] - s[0]) * GX; o[1] = s[1] + (o[1] - s[1]) * GX; o[2] = s[2] + (o[2] - s[2]) * GX; };
  function poseCM(now, mode, u, dt) {
    // mode 0 speaking at the podium, 1 walking along a path (u = metres walked), 2 at the ribbon, 3 idle/namaste
    const fast = 1 - Math.exp(-dt * 7);
    if (mode === 0) {
      if (now > nextGest) { gest = Math.floor(R() * 9); gestT = now; nextGest = now + (gest >= 6 ? 2.4 : 1.3) + R() * 1.6;
        A.yawT = gest === 7 ? -1.35 : gest === 8 ? 1.2 : (R() - 0.5) * 0.5; }
      const tt = now - gestT, wv = Math.sin(tt * 5) * 0.3;
      switch (gest) {
        case 0: set3(AT.le, 0.25, 1.12, 0.18); set3(AT.lh, 0.18, 1.12, 0.42); set3(AT.re, -0.25, 1.12, 0.18); set3(AT.rh, -0.18, 1.12, 0.42); break;      // hands on the lectern
        case 1: case 7: case 8: set3(AT.le, 0.25, 1.12, 0.18); set3(AT.lh, 0.18, 1.12, 0.42); set3(AT.re, -0.36, 1.5, 0.08); set3(AT.rh, -0.45 + wv, 1.86, 0.16); break;   // wave (turned to one side of the crowd for 7, 8)
        case 2: set3(AT.le, 0.25, 1.12, 0.18); set3(AT.lh, 0.18, 1.12, 0.42); set3(AT.re, -0.26, 1.55, 0.22); set3(AT.rh, -0.3, 1.92 + Math.sin(tt * 4) * 0.05, 0.55); break; // point up and out
        case 3: set3(AT.le, 0.42, 1.3, 0.1); set3(AT.lh, 0.7, 1.5, 0.28); set3(AT.re, -0.42, 1.3, 0.1); set3(AT.rh, -0.7, 1.5, 0.28); break;     // arms open
        case 4: { const b = Math.abs(Math.sin(tt * 6)) * 0.25; set3(AT.le, 0.25, 1.12, 0.18); set3(AT.lh, 0.18, 1.12, 0.42); set3(AT.re, -0.3, 1.32, 0.18); set3(AT.rh, -0.24, 1.32 + b, 0.5); break; } // emphatic chop
        case 6: { const b = Math.sin(tt * 4) * 0.05; set3(AT.le, 0.34, 1.66, 0.04); set3(AT.lh, 0.58, 2.08 + b, 0.1); set3(AT.re, -0.34, 1.66, 0.04); set3(AT.rh, -0.58, 2.08 + b, 0.1); break; } // 'Jai Hind!' arms up in a V
        default: set3(AT.le, 0.22, 1.18, 0.1); set3(AT.lh, 0.035, 1.34, 0.26); set3(AT.re, -0.22, 1.18, 0.1); set3(AT.rh, -0.035, 1.34, 0.26);   // namaste
      }
      big(AT.le, SHL); big(AT.lh, SHL); big(AT.re, SHR); big(AT.rh, SHR);
      A.lean += ((gest === 4 || gest === 2 ? 0.07 : 0.02) - A.lean) * fast; A.nod = Math.sin(now * (gest === 4 ? 6 : 2.3)) * (gest === 4 ? 0.03 : 0.012);
    } else if (mode === 1) {
      const ph = u / 0.72 * Math.PI, s = Math.sin(ph) * 0.9;
      set3(AT.le, 0.22, 1.13, -s * 0.12); set3(AT.lh, 0.2, 0.89, -s * 0.24); set3(AT.re, -0.22, 1.13, s * 0.12); set3(AT.rh, -0.2, 0.89, s * 0.24);
      A.lean += (0.04 - A.lean) * fast; A.nod = 0; A.yawT = 0;
    } else if (mode === 2) {
      const ts = now - snipAt;
      if (ts < 0) { set3(AT.re, -0.26, 1.2, 0.22); set3(AT.rh, -0.08, 1.12, 0.5); set3(AT.le, 0.24, 1.15, 0.12); set3(AT.lh, 0.12, 1.08, 0.38); }
      else if (ts < 2.6) { const up = sm(0.35, 0.9, ts); set3(AT.re, -0.3, lerp(1.2, 1.5, up), 0.18); set3(AT.rh, lerp(-0.08, -0.36, up), lerp(1.12, 1.95, up), lerp(0.5, 0.3, up));
        set3(AT.le, 0.26, 1.2, 0.12); set3(AT.lh, 0.3, 1.3 + up * 0.25 + Math.sin(ts * 12) * 0.04 * up, 0.3); }
      else { set3(AT.le, 0.22, 1.18, 0.1); set3(AT.lh, 0.035, 1.34, 0.26); set3(AT.re, -0.22, 1.18, 0.1); set3(AT.rh, -0.035, 1.34, 0.26); }
      A.lean += (0.03 - A.lean) * fast; A.nod = 0; A.yawT = 0;
    } else { set3(AT.le, 0.22, 1.18, 0.1); set3(AT.lh, 0.035, 1.34, 0.26); set3(AT.re, -0.22, 1.18, 0.1); set3(AT.rh, -0.035, 1.34, 0.26); A.lean *= 1 - fast; A.nod = Math.sin(now * 2) * 0.01; A.yawT = 0; }
    A.yaw += (A.yawT - A.yaw) * (1 - Math.exp(-dt * (mode === 0 ? 3 : 8)));
    const kk = mode === 1 ? 1 : 1 - Math.exp(-dt * 9);
    for (let q = 0; q < 4; q++) { const n = ARMS[q]; for (let i = 0; i < 3; i++) A[n][i] += (AT[n][i] - A[n][i]) * kk; }
    stand(); if (mode === 1) walkLegs(u / 0.72 * Math.PI, 0.9);
    sj(LE, A.le[0], A.le[1], A.le[2]); sj(LH, A.lh[0], A.lh[1], A.lh[2]); sj(RE, A.re[0], A.re[1], A.re[2]); sj(RH, A.rh[0], A.rh[1], A.rh[2]);
    J[NECK * 3 + 2] += A.lean; J[HEAD * 3 + 2] += A.lean * 1.3 + A.nod; J[HEAD * 3 + 1] -= Math.abs(A.nod) * 0.5; J[LS * 3 + 2] += A.lean; J[RS * 3 + 2] += A.lean;
  }
  const SCISS = [col('#d8dde2'), col('#c8102e'), col('#e0b23a')], SHAD = col('#0b0b0c');
  // a flattened dark capsule on the ground under a standing figure (contact shadow, same instanced mesh)
  const foot = (x, y, z, k) => { if (!LOD) seg(x - 0.25 * k, y + 0.04, z, x + 0.25 * k, y + 0.04, z, 0.005, 35 * k, SHAD, 0, 1); };
  function drawCM(x, y, z, yaw, now, mode, scissOpen, pk) {
    PK = pk; place(x, y, z, yaw, PK); dress(CMO, false);
    // a big marigold garland around his neck, and hands
    at(tA, LS, LS, 0, -0.02); at(tB, PELV, NECK, 0.45, 0); tB[0] += pfx * 0.17 * PK; tB[2] += pfz * 0.17 * PK; SP(0.08, 1, MARI[0]);
    at(tA, RS, RS, 0, -0.02); SP(0.08, 1, MARI[1]);
    at(tA, LH, LH, 0, 0); tB[0] = tA[0]; tB[1] = tA[1] - 0.02; tB[2] = tA[2]; SP(0.045, 1, CMO.skin);
    at(tA, RH, RH, 0, 0); tB[0] = tA[0]; tB[1] = tA[1] - 0.02; tB[2] = tA[2]; SP(0.045, 1, CMO.skin);
    foot(x, y, z, PK);
    if (scissOpen >= 0) {   // giant scissors in the right hand, pointing forward, blades opening in the vertical plane
      const hx = W[RH * 3], hy = W[RH * 3 + 1], hz = W[RH * 3 + 2], ang = scissOpen * 0.42, L = 0.85 * PK;
      const px = hx + pfx * 0.18, pz = hz + pfz * 0.18;
      for (let q = 0; q < 2; q++) { const s = SG[q], ex = px + pfx * L * Math.cos(ang), ey = hy + s * L * Math.sin(ang), ez = pz + pfz * L * Math.cos(ang);
        seg(px, hy, pz, ex, ey, ez, 0.045, 0.35, SCISS[0], -pfz * 1, pfx * 1);
        seg(px, hy, pz, hx - pfx * 0.08, hy - s * 0.09, hz - pfz * 0.08, 0.055, 0.6, SCISS[1], -pfz, pfx); }
      seg(px, hy - 0.02, pz, px, hy + 0.02, pz, 0.04, 1, SCISS[2], pfx, pfz);
    }
  }
  // the ribbon on gold stanchions: before the cut a sagging satin band with a bow; after it, two halves swinging down
  const RIBC = [col('#c8102e'), col('#e01b3c')];
  function drawRibbon(now) {
    const ts = now - snipAt, x0 = 1.75, y0 = 1.08, n = 7;
    for (let q = 0; q < 2; q++) { const x = SG[q] * x0; seg(x, 0, RIB, x, 0, RIB, 0.13, 1, K.gold, 0, 1); seg(x, 0.06, RIB, x, 1.04, RIB, 0.035, 1, K.gold, 0, 1); seg(x, 1.1, RIB, x, 1.1, RIB, 0.08, 1, K.gold, 0, 1); }
    if (ts < 0) {
      for (let i = 0; i < n * 2; i++) { const t0 = i / (n * 2), t1 = (i + 1) / (n * 2), xa = lerp(-x0, x0, t0), xb = lerp(-x0, x0, t1);
        seg(xa, y0 - Math.sin(Math.PI * t0) * 0.07, RIB, xb, y0 - Math.sin(Math.PI * t1) * 0.07, RIB, 0.055, 0.22, RIBC[i % 2], 0, 1); }
      const by = y0 - 0.07;
      for (let q = 0; q < 2; q++) { const s = SG[q]; seg(0, by, RIB + 0.01, s * 0.24, by + 0.12, RIB + 0.01, 0.06, 0.3, RIBC[1], 0, 1); seg(s * 0.24, by + 0.12, RIB + 0.01, s * 0.2, by - 0.06, RIB + 0.01, 0.06, 0.3, RIBC[1], 0, 1);
        seg(s * 0.02, by - 0.02, RIB + 0.01, s * 0.14, by - 0.42, RIB + 0.02, 0.05, 0.25, RIBC[0], 0, 1); }
      seg(0, by - 0.02, RIB + 0.02, 0, by + 0.02, RIB + 0.02, 0.07, 0.6, RIBC[0], 0, 1);
      return;
    }
    const sw = 1.45 * (1 - Math.exp(-ts * 3.2) * Math.cos(ts * 6.5)) + Math.sin(ts * 2.4) * 0.05 * Math.exp(-ts * 0.3);
    for (let q = 0; q < 2; q++) { const s = SG[q]; let px = s * x0, py = y0; const l = x0 / n;
      for (let i = 0; i < n; i++) { const a = Math.min(1.57, sw * (0.75 + 0.25 * (i + 1) / n)) + Math.sin(now * 5 + i) * 0.04 * (i / n), qx = px - s * Math.cos(a) * l, qy = py - Math.sin(a) * l;
        seg(px, py, RIB, qx, Math.max(0.05, qy), RIB, 0.055, 0.22, RIBC[i % 2], 0, 1); px = qx; py = Math.max(0.05, qy); } }
  }

  // which stage to draw: one with a live speech or an uncut ribbon first, otherwise the one nearest the camera
  function pickItem(T) {
    const list = Z.fx; if (!list) return null; let best = null, bs = -Infinity; const cp = Z.camera.position;
    for (let i = 0; i < list.length; i++) { const o = list[i]; if (!o || o.kind !== 'stage' || !(T >= o.t0 && T <= o.t1)) continue;
      const sp = o.speaker, live = (sp && T >= sp.t0 - 30 && T <= sp.t1) || (o.cutAt != null && T <= o.cutAt + 30);
      const dx = o.x - cp.x, dz = o.y - cp.z, s = (live ? 1e13 : 0) - (dx * dx + dz * dz) + (o === cur ? 1e6 : 0);
      if (s > bs) { bs = s; best = o; } }
    return best; }

  const DBG = {};
  function step(dt, now) {
    const T = Z.T, it = pickItem(T);
    if (!it) { root.visible = false; cur = null; lastNow = now; return; }
    const resync = it !== cur || now - lastNow > 0.5; lastNow = now;
    const sp = it.speaker, cut = it.cutAt;
    if (resync) {
      if (it !== cur) { cur = it; snipAt = 1e9; cutSeen = -1e9; welAt = -1e9; ribAt = -1e9; offAt = -1e9; appl = -1e9; cheer = -1e9; holdEndT = null;
        strikeK = 1; lastHit = -1e9; scl = -1; A.yaw = A.yawT = 0; for (let i = 0; i < NFL; i++) flash[i * 6 + 3] = -1e9; }
      // cues already well past (a stage first seen late, or back from the 2D view): played long ago
      if (sp && T >= sp.t0 + 25 && welAt < -1e8) welAt = now - 60;
      if (cut != null && T >= cut + 25 && snipAt > 1e8) { snipAt = now - 60; ribAt = now - 60; cutSeen = now - 60; }
      if (sp && cut == null && T >= sp.t1 + 25 && offAt < -1e8) offAt = now - 60;
    } else if (dt > 0) rate += (clamp((T - lastT) / dt, 5, 100) - rate) * (1 - Math.exp(-dt * 2));
    lastT = T;
    // the programme: cues in sim time (due and not yet played), walks in real time
    if (sp && T >= sp.t0 && welAt < -1e8) { welAt = now; appl = now + 0.4; }
    const inDone = welAt > -1e8 && now - welAt >= DIN;
    if (sp && cut != null && sp.t0 < cut && inDone && ribAt < -1e8 && T >= cut - Math.max(14, (DRIB + 1.5) * rate)) ribAt = now;
    const arrived = ribAt > -1e8 && now - ribAt >= DRIB;
    if (cut != null && T >= cut && snipAt > 1e8) { if (cutSeen < -1e8) cutSeen = now;
      if (!(sp && sp.t0 < cut && welAt > -1e8 && !arrived) || now - cutSeen > 6) { snipAt = now; cheer = now; appl = now; } }
    if (sp && cut == null && T >= sp.t1 && inDone && offAt < -1e8) { offAt = now; appl = now; }

    // build-up and pack-away (sim time); after the cut the celebration holds for 4 s of real time if there is sim time left
    const span = Math.max(1, it.t1 - it.t0), BD = clamp(span * 0.25, 8, 40), PD = clamp(span * 0.2, 8, 30);
    let pStart = it.t1 - PD;
    if (cut != null) {
      if (snipAt > 1e8) pStart = Math.max(pStart, it.t1 - 6);
      else { if (holdEndT == null && now - snipAt >= 4) holdEndT = T;
        pStart = Math.max(pStart, cut + 5, holdEndT == null ? it.t1 - 6 : Math.min(it.t1 - 6, holdEndT)); } }
    pStart = Math.min(pStart, it.t1 - 1);
    let build = Math.min(clamp((T - it.t0) / BD, 0, 1), clamp((it.t1 - T) / (it.t1 - pStart), 0, 1));
    const post = cut != null && snipAt < 1e8 && T > pStart;

    // aircraft about to use the runway through the stage: strike it fast (and re-erect only if it has time left)
    let hit = false, near = 1e9;
    const F = Z.flights ? Z.flights() : null;
    if (F) { const ca = Math.cos(it.a || 0), sa = Math.sin(it.a || 0), reach = HW * Math.max(1, scl) + 250;
      for (let i = 0; i < F.length; i++) { const f = F[i]; if (!f || !MOVING[f.state]) continue;
        const dx = f.x - it.x, dy = f.y - it.y, al = dx * ca + dy * sa, lat = -dx * sa + dy * ca, alt = f.alt || 0;
        if (alt < 300) { const d = Math.sqrt(dx * dx + dy * dy); if (d < near) near = d; }
        if (Math.abs(lat) < 60 && Math.abs(al) < reach && alt < 150) hit = true;
        else if (f.state === 'approach' && f.rwy && Math.abs(f.rwy.y - it.y) < 60 && it.x > f.rwy.x0 && it.x < f.rwy.x1 &&
          Math.hypot(f.x - (f.rwy.x1 - 450), f.y - f.rwy.y) < 1500) hit = true; } }
    if (hit) lastHit = now;
    const struck = lastHit > -1e8 && (now - lastHit < 2.5 || T > it.t1 - 60);
    strikeK = struck ? Math.max(0, strikeK - dt / 1.2) : Math.min(1, strikeK + dt / 1.5);
    build = Math.min(build, strikeK);
    if (build <= 0) { root.visible = false; return; }
    root.visible = true; structure.visible = true;
    U.uBuild.value = build; PU.uBuild.value = build;
    const bp = post ? Math.min(1, build / 0.75) : build;   // after the cut the people leave last

    // placement and scale: bigger with the real camera distance so it reads from the strategic camera, capped near aircraft
    const cp = Z.camera.position, cdx = cp.x - it.x, cdz = cp.z - it.y, cd = Math.sqrt(cdx * cdx + cp.y * cp.y + cdz * cdz);
    let tgt = clamp(Math.max(Math.sqrt(Math.max(1, cd) / 38), cd / 500), 1, 22);
    if (near < 600) tgt = Math.min(tgt, 2.5 * (Z.kEx || 1));
    if (scl < 0 || !isFinite(scl)) scl = tgt; else scl += (tgt - scl) * (1 - Math.exp(-dt * 3));
    root.position.set(it.x, 0, it.y); root.rotation.y = -(it.a || 0); root.scale.setScalar(scl);
    const kz = clamp((32 / scl - Z0) / (21.6 - Z0), 0.12, 1), kc = Math.max(kz, 0.45), sqz = z => z > Z0 ? Z0 + (z - Z0) * kc : z;
    const hero = 1 + 0.25 * sm(1.5, 4, scl);
    U.uK.value = kz; U.uPodS.value = hero; GX = 1 + 0.6 * sm(2, 5, scl);
    PU.uScl.value = scl; U.uFar.value = sm(4.5, 10, scl); PU.uFm.value = scl > 8 ? 6 : 3.5;
    PU.uPx.value = Z.renderer.domElement.height / (2 * Math.tan(Z.camera.fov * Math.PI / 360));
    LOD = scl > 5.5;
    { const zmax = Math.max(9, Z0 + (20 - Z0) * kz); shadow.position.z = (zmax - 8) / 2; shadow.scale.z = zmax + 8; }
    shMat.opacity = 0.55 * sm(0, 0.25, build);

    // ---- the Chief Minister's state ----
    let cmMode = -1, cmX = 0, cmY = 0, cmZ = 0, cmYaw = 0, cmU = 0, sciss = -1;
    if (sp && welAt > -1e8 && bp > 0.72) {
      if (!inDone) { const d = (now - welAt) * 1.3; pathAt(PATH_IN, d); cmMode = 1; cmU = d; cmX = pp[0]; cmY = pp[1]; cmZ = pp[2]; cmYaw = pp[3]; }
      else if (cut != null && ribAt > -1e8) {
        if (!arrived) { const d = (now - ribAt) / DRIB * PLEN[1]; pathAt(PATH_RIB, d); cmMode = 1; cmU = d; cmX = pp[0]; cmZ = pp[2]; cmY = deckY(pp[2]); cmYaw = pp[3]; if (d > PLEN[1] * 0.7) sciss = 0.5; }
        else { cmMode = 2; cmX = 0; cmY = 0; cmZ = RIB - 0.5; cmYaw = 0;
          sciss = snipAt > 1e8 ? 0.5 + 0.5 * sm(1.5, 0, (cut - T) / rate) : now - snipAt > 2.6 ? -1 : Math.max(0, 1 - (now - snipAt) * 12); } }
      else if (cut == null && offAt > -1e8) { if (now - offAt < DOFF) { const d = (now - offAt) * 1.3; pathAt(PATH_OUT, d); cmMode = 1; cmU = d; cmX = pp[0]; cmY = pp[1]; cmZ = pp[2]; cmYaw = pp[3]; } }
      else { cmMode = 0; cmX = POD[0] + 0.1; cmY = FLOOR; cmZ = POD[1] - 0.62; cmYaw = A.yaw - 0.12; }
    } else if (!sp && cut != null && bp > 0.72 && T >= cut - 3) { cmMode = 2; cmX = 0; cmY = 0; cmZ = RIB - 0.5; cmYaw = 0;
      sciss = snipAt > 1e8 ? 1 : now - snipAt > 2.6 ? -1 : Math.max(0, 1 - (now - snipAt) * 12); }
    DBG.mode = cmMode; DBG.wel = now - welAt; DBG.rib = now - ribAt; DBG.snip = now - snipAt; DBG.T = T; DBG.cut = cut;
    const speaking = cmMode === 0, clapping = now - appl < 1.6 && now >= appl;

    // ---- people ----
    NI = 0;
    // officials, seated
    for (const o of OFF) { const pk = sm(o.th, o.th + 0.05, bp); if (pk < 0.02) continue;
      seated(); const look = Math.sin(now * 0.4 + o.ph) * 0.3 + (speaking ? 0.25 : 0);
      J[HEAD * 3] += Math.sin(look) * 0.03;
      if (clapping) { const c = 0.02 + 0.07 * (0.5 + 0.5 * Math.sin(now * 23 + o.ph)); sj(LE, 0.2, 0.8, 0.02); sj(RE, -0.2, 0.8, 0.02); sj(LH, c, 0.92, 0.2); sj(RH, -c, 0.92, 0.2); }
      PK = pk; place(o.x, FLOOR, o.z + 0.12, look * 0.25, pk); dress(o, true); }
    // the Chief Minister (hero scale and a warm halo while he holds the stage)
    let haloI = 0;
    if (cmMode >= 0) { poseCM(now, cmMode, cmU, dt); drawCM(cmX, cmY, cmZ, cmYaw, now, cmMode, sciss, 1.1 * hero);
      if (cmMode === 0 || cmMode === 2) { haloI = 0.45 * sm(0.72, 0.85, bp); const o = HALO * 6; flash[o] = W[HEAD * 3] - pfx * 0.35 * PK; flash[o + 1] = W[HEAD * 3 + 1] + 0.05 * PK; flash[o + 2] = W[HEAD * 3 + 2] - pfz * 0.35 * PK; flash[o + 4] = 2.5; } }
    // police at the steps
    for (const o of POL) { const pk = sm(o.th, o.th + 0.04, bp); if (pk < 0.02) continue; stand(); sj(LH, 0.12, 0.92, -0.12); sj(RH, -0.12, 0.92, -0.12); sj(LE, 0.22, 1.12, -0.08); sj(RE, -0.22, 1.12, -0.08);
      PK = pk; place(o.x, 0, o.z, 0, pk); dress(o, false); foot(o.x, 0, o.z, pk); }
    // photographers: face whoever is the story, shoot in bursts
    const focX = cmMode >= 0 ? cmX : 0, focZ = cmMode >= 0 ? cmZ : -1;
    const frate = (now - snipAt < 2.5 && now >= snipAt) ? 9 : speaking ? 2.4 : cmMode >= 0 ? 1.6 : 0.35;
    for (const o of PHO) { const pk = sm(o.th, o.th + 0.05, bp); if (pk < 0.02) continue;
      const yaw = Math.atan2(focX - o.x, focZ - o.z) + Math.sin(now * 0.7 + o.ph) * 0.08;
      if (R() < frate / PHO.length * dt * 2.2) { o.shoot = now + 0.9 + R(); }
      const shooting = now < o.shoot || speaking && Math.sin(now * 0.5 + o.ph) > -0.3;
      stand();
      if (o.crouch) { sj(PELV, 0, 0.52, -0.12); sj(NECK, 0, 0.98, -0.02); sj(HEAD, 0, 1.13, 0.02); sj(LS, 0.19, 0.95, -0.02); sj(RS, -0.19, 0.95, -0.02);
        sj(LHIP, 0.1, 0.52, -0.1); sj(LK, 0.13, 0.5, 0.3); sj(LF, 0.13, 0.05, 0.22); sj(RHIP, -0.1, 0.52, -0.1); sj(RK, -0.13, 0.08, 0.05); sj(RF, -0.13, 0.05, -0.32); }
      const hy = o.crouch ? 1.12 : 1.58;
      if (shooting) { sj(LE, 0.22, hy - 0.22, 0.1); sj(RE, -0.22, hy - 0.22, 0.1); sj(LH, 0.07, hy - 0.04, 0.2); sj(RH, -0.08, hy - 0.02, 0.18); sj(PROP, 0, hy, 0.17); sj(PROP2, 0, hy, 0.34); }
      else { sj(PROP, -0.12, hy - 0.62, 0.16); sj(PROP2, -0.12, hy - 0.62, 0.3); sj(RH, -0.15, hy - 0.66, 0.1); }
      PK = pk; place(o.x, 0, o.z, yaw, pk); dress(o, false); foot(o.x, 0, o.z, pk);
      if (o.vest) { at(tA, PELV, NECK, 0.2, 0); at(tB, PELV, NECK, 0.85, 0); SP(0.183, 0.72, o.vest); }
      S(PROP, PROP2, 0.07, 1.25, K.black);   // camera body and lens
      at(tA, PROP, PROP, 0, 0.08); tB[0] = tA[0]; tB[1] = tA[1] + 0.06 * PK; tB[2] = tA[2]; SP(0.04, 1.4, K.dark);
      o.fl[0] = tB[0]; o.fl[1] = tB[1] + 0.04; o.fl[2] = tB[2];
      if (shooting && R() < frate / PHO.length * dt * 1.6) fireFlash(o.fl[0], o.fl[1], o.fl[2], now, 3.4, false); }
    // the crowd (squeezed toward the stage with the approach when the stage is scaled up)
    const cheering = now - cheer < 2.8 && now >= cheer;
    for (const o of CROWD) { const pk = sm(o.th, o.th + 0.04, bp); if (pk < 0.02) continue;
      stand(); const sway = Math.sin(now * 0.9 + o.ph) * 0.035; J[PELV * 3] += sway * 0.5; J[NECK * 3] += sway; J[HEAD * 3] += sway * 1.2; J[LS * 3] += sway; J[RS * 3] += sway;
      let phone = false, flag = false;
      if (cheering && (o.ph % 1) < 0.7) { const b = Math.abs(Math.sin(now * 8 + o.ph)) * 0.1; sj(LE, 0.3, 1.62, 0.04); sj(LH, 0.34, 1.95 + b, 0.06); sj(RE, -0.3, 1.62, 0.04); sj(RH, -0.34, 1.95 + b, 0.06); }
      else if (clapping && (o.ph % 1) < 0.6) { const c = 0.03 + 0.08 * (0.5 + 0.5 * Math.sin(now * 21 + o.ph)); sj(LE, 0.2, 1.18, 0.12); sj(RE, -0.2, 1.18, 0.12); sj(LH, c, 1.32, 0.3); sj(RH, -c, 1.32, 0.3); }
      else if (o.act === 'phone' && (speaking || cmMode >= 0)) { sj(RE, -0.24, 1.42, 0.12); sj(RH, -0.12, 1.68, 0.32); phone = true; }
      else if (o.act === 'flag') { const w = Math.sin(now * 6 + o.ph); sj(RE, -0.3, 1.55, 0.05); sj(RH, -0.33 + w * 0.08, 1.85, 0.08); flag = true; }
      const oz = sqz(o.z);
      PK = pk * o.k; place(o.x, 0, oz, Math.atan2(focX * 0.5 - o.x, focZ - oz), PK); dress(o, false); foot(o.x, 0, oz, PK);
      if (phone) { at(tA, RH, RH, 0, 0.02); tB[0] = tA[0]; tB[1] = tA[1] + 0.12 * PK; tB[2] = tA[2]; SP(0.035, 0.4, K.black);
        if (R() < (cmMode >= 0 ? 0.05 : 0.01) * dt * 8) fireFlash(tB[0], tB[1], tB[2] + 0.04, now, 1.2, true); }
      if (flag) { const hx = W[RH * 3], hy = W[RH * 3 + 1], hz = W[RH * 3 + 2], w = Math.sin(now * 6 + o.ph);
        seg(hx, hy - 0.1, hz, hx, hy + 0.55 * PK, hz, 0.012, 1, K.silver, pfx, pfz);
        for (let b = 0; b < 3; b++) { const fy = hy + (0.52 - b * 0.09) * PK, fx = hx - pfz * 0.02 * w, fz = hz + pfx * 0.02 * w;
          seg(hx, fy, hz, fx + (-pfz) * 0.34 * PK * (0.9 + 0.1 * w), fy - 0.02 * w, fz + pfx * 0.34 * PK * (0.9 + 0.1 * w), 0.045 * PK, 0.25, FLAGC[b], pfx, pfz); } } }
    // ribbon and its stanchions (only for a stage with a ribbon)
    if (cut != null && bp > 0.62) { PK = 1; drawRibbon(now); }
    IM.count = NI; IM.visible = NI > 0;
    if (NI > 0) { const im = IM.instanceMatrix, ic = IM.instanceColor;
      if (im.clearUpdateRanges) { im.clearUpdateRanges(); im.addUpdateRange(0, NI * 16); ic.clearUpdateRanges(); ic.addUpdateRange(0, NI * 3); }
      im.needsUpdate = true; ic.needsUpdate = true; }

    // ---- petals: the welcome shower over his walk in, the burst at the ribbon ----
    PU.uB.value.set(now - welAt < 90 ? now - welAt : (welAt > -1e8 ? 90 : -1), now - snipAt < 90 ? (now >= snipAt ? now - snipAt : -1) : (snipAt < 1e8 ? 90 : -1));
    PU.uO0.value.set(5.0, 3.4, -0.6); PU.uO1.value.set(0, 1.3, RIB);
    // a ring of flashes at the snip
    if (now - snipAt >= 0 && now - snipAt < 1.2 && R() < dt * 16) { const o = PHO[Math.floor(R() * PHO.length)]; fireFlash(o.fl[0], o.fl[1], o.fl[2], now, 3.6, false); }
    // ---- flashes: write the slots (the last one is the halo) ----
    let any = false;
    for (let i = 0; i < NFL; i++) { const o = i * 6, v = NPET + i;
      let I = 0, kind = flash[o + 5];
      if (i === HALO) { I = haloI; kind = 2; }
      else { const a = now - flash[o + 3]; I = a >= 0 && a < 0.25 ? Math.exp(-a * 16) * (a < 0.02 ? a / 0.02 : 1) * (kind ? 0.55 : 1) : 0; }
      if (I > 0 || pF[v * 4 + 1] > 0) { any = true; pPos[v * 3] = flash[o]; pPos[v * 3 + 1] = flash[o + 1]; pPos[v * 3 + 2] = flash[o + 2];
        pF[v * 4 + 1] = I; pF[v * 4 + 2] = flash[o + 4]; pF[v * 4 + 3] = kind; } }
    if (any || flDirty) { pFA.needsUpdate = true; pgeo.attributes.position.needsUpdate = true; flDirty = false; }
  }
  function update(dt, now) {
    try { step(dt, now); }
    catch (e) { root.visible = false; if (Z.fxKinds) Z.fxKinds.delete('stage'); throw e; }   // let the flat stand-in come back
  }

  (Z.fxKinds = Z.fxKinds || new Set()).add('stage');   // hides the flat emoji stand-in
  return { update, stats: () => ({ staticTris: nTriStatic, maxInst: MAXI, inst: NI, capTris: capGeo.index ? capGeo.index.count / 3 : capGeo.attributes.position.count / 3, scl, build: U.uBuild.value, strikeK, rate, dbg: DBG }) };
};
