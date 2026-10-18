Z3MOD.fx = function (Z) {
  // Set-piece spectacles from Z.fx (see 3d/FX.md): the Surya Kiran flypast and the rhesus troop on Pier F.
  // Flypast: the whole display is baked once per item into per-jet paths on a fixed nominal timeline (smoothed, with
  // per-sample frames), so the jets and every point of their smoke trails are pure functions of sim time: the trails
  // need no history, survive fast-forward and pause, and cost one ribbon draw. Monkeys: every body part is an ellipsoid
  // instance of one sphere (one draw for the troop, one for its shadow), posed procedurally each frame from joint
  // positions (sit, walk, gallop blended), with real-time idle behaviour and sim-time entry, flight and exit.
  // Both scale up with camera distance so they still read from the strategic view.
  // Draw calls when active: jets 1, smoke 1, monkeys 1 (+1 shadow). Nothing is drawn while Z.fx is empty.
  const THREE = Z.THREE, D2R = Math.PI / 180, TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const root = new THREE.Group(); root.name = 'fx'; Z.scene.add(root);
  const UP = new THREE.Vector3(0, 1, 0);

  /* ======================================================================= flypast ======================================================================= */
  // Hawk Mk132 (12.4 m long, 9.4 m span), nose +X, y up, z right; red over white, white wing bands, a tricolour fin flash
  const jetGeo = (() => {
    const P = [], N = [], Cc = [];
    const cRed = new THREE.Color('#d3202b'), cWhite = new THREE.Color('#f4f4f2'), cGlass = new THREE.Color('#121a22'), cSaf = new THREE.Color('#ff9933'), cGrn = new THREE.Color('#138808'), cDark = new THREE.Color('#3a3d42');
    const v = (p, n, c) => { P.push(p[0], p[1], p[2]); N.push(n[0], n[1], n[2]); Cc.push(c.r, c.g, c.b); };
    const tri = (a, b, c, col, na, nb, nc) => {
      let nx, ny, nz; if (!na) { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
        nx = uy * wz - uz * wy; ny = uz * wx - ux * wz; nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; na = nb = nc = [nx, ny, nz]; }
      v(a, na, col.isColor ? col : col[0]); v(b, nb, col.isColor ? col : col[1]); v(c, nc, col.isColor ? col : col[2]); };
    // body of revolution with elliptical sections: [x, half-width, half-height, centre y]
    const loft = (st, seg, colF) => {
      const pt = (s, j) => { const a = j / seg * TAU; return [s[0], s[3] + Math.cos(a) * s[2], Math.sin(a) * s[1]]; };
      const nr = (i, j) => { const s = st[i], a = j / seg * TAU, sl = i === 0 ? 1.5 : i === st.length - 1 ? -0.4 : ((st[i - 1][1] + st[i - 1][2]) - (st[i + 1][1] + st[i + 1][2])) / 2 / (st[i - 1][0] - st[i + 1][0]);
        const n = [-sl, Math.cos(a) / s[2], Math.sin(a) / s[1]]; const l = Math.hypot(n[0], n[1], n[2]); return [n[0] / l, n[1] / l, n[2] / l]; };
      for (let i = 0; i < st.length - 1; i++) for (let j = 0; j < seg; j++) {
        const A = pt(st[i], j), B = pt(st[i + 1], j), C = pt(st[i + 1], j + 1), D = pt(st[i], j + 1);
        const cA = colF(A), cB = colF(B), cC = colF(C), cD = colF(D);
        tri(A, B, C, [cA, cB, cC], nr(i, j), nr(i + 1, j), nr(i + 1, j + 1)); tri(A, C, D, [cA, cC, cD], nr(i, j), nr(i + 1, j + 1), nr(i, j + 1)); }
    };
    const ell = (c, r, nu, nv, col) => {
      const pt = (i, j) => { const th = i / nv * Math.PI, ph = j / nu * TAU; return [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]; };
      for (let i = 0; i < nv; i++) for (let j = 0; j < nu; j++) {
        const q = [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)].map(u => [[c[0] + u[0] * r[0], c[1] + u[1] * r[1], c[2] + u[2] * r[2]], [u[0] / r[0], u[1] / r[1], u[2] / r[2]]]);
        const n = q.map(x => { const l = Math.hypot(x[1][0], x[1][1], x[1][2]); return [x[1][0] / l, x[1][1] / l, x[1][2] / l]; });
        tri(q[0][0], q[2][0], q[1][0], col, n[0], n[2], n[1]); tri(q[0][0], q[3][0], q[2][0], col, n[0], n[3], n[2]); }
    };
    // thin panel through 4 planform corners (LE root, TE root, TE tip, LE tip), thickness t0 at root, t1 at tip along axis ax
    const panel = (A, B, C, D, t0, t1, ax, cTop, cBot) => {
      const off = (p, t) => { const a = p.slice(); a[ax] += t / 2; return a; };
      const At = off(A, t0), Bt = off(B, t0 * 0.3), Ct = off(C, t1 * 0.3), Dt = off(D, t1), Ab = off(A, -t0), Bb = off(B, -t0 * 0.3), Cb = off(C, -t1 * 0.3), Db = off(D, -t1);
      const up = ax === 1 ? [0, 1, 0] : [0, 0, 1], dn = up.map(x => -x);
      const s = Math.sign((B[0] - A[0]) * (D[2 - (ax === 2 ? 1 : 0)] - A[2 - (ax === 2 ? 1 : 0)])) || 1; void s;
      const face = (a, b, c, d, col, n) => { tri(a, b, c, col, n, n, n); tri(a, c, d, col, n, n, n); };
      // orient so the faces point outward regardless of the corner order
      const cross = (a, b, c) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2]; return [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx]; };
      const nT = cross(At, Bt, Ct), flip = nT[ax] < 0;
      if (!flip) { face(At, Bt, Ct, Dt, cTop, up); face(Ab, Db, Cb, Bb, cBot, dn); } else { face(At, Dt, Ct, Bt, cTop, up); face(Ab, Bb, Cb, Db, cBot, dn); }
      const ring = [[At, Ab], [Bt, Bb], [Ct, Cb], [Dt, Db]];
      for (let i = 0; i < 4; i++) { const [p0, q0] = ring[i], [p1, q1] = ring[(i + 1) % 4]; tri(p0, p1, q1, cBot); tri(p0, q1, q0, cBot); }
    };
    loft([[6.2, 0.02, 0.02, -0.05], [5.75, 0.2, 0.2, -0.04], [5.0, 0.38, 0.4, 0.0], [4.2, 0.52, 0.56, 0.05], [3.2, 0.62, 0.68, 0.08], [2.0, 0.7, 0.75, 0.05],
      [0.8, 0.78, 0.72, 0.0], [-0.6, 0.76, 0.68, 0.0], [-2.2, 0.62, 0.6, 0.05], [-3.8, 0.45, 0.5, 0.12], [-5.2, 0.32, 0.38, 0.15], [-6.0, 0.26, 0.28, 0.12], [-6.25, 0.22, 0.22, 0.1]], 12,
      p => (p[1] > 0.02 + 0.05 * p[0] * 0 ? cRed : cWhite));
    ell([2.55, 0.66, 0], [1.55, 0.5, 0.42], 10, 5, cGlass);   // canopy
    ell([0.9, 0.12, 0.7], [1.0, 0.32, 0.2], 6, 4, cRed); ell([0.9, 0.12, -0.7], [1.0, 0.32, 0.2], 6, 4, cRed);   // intakes
    ell([-6.25, 0.1, 0], [0.12, 0.2, 0.2], 6, 3, cDark);   // jet pipe
    const tw = Math.tan(26 * D2R);
    for (const sg of [-1, 1]) {
      const st = [0.55, 2.85, 3.35, 4.7], Y = z => -0.38 + (z - 0.55) * Math.tan(2 * D2R), LE = z => 1.3 - (z - 0.55) * tw, CH = z => 2.8 - (z - 0.55) / 4.15 * 1.85, TH = z => 0.24 - (z - 0.55) / 4.15 * 0.16;
      for (let k = 0; k < 3; k++) { const za = st[k], zb = st[k + 1], c = k === 1 ? cWhite : cRed;
        panel([LE(za), Y(za), sg * za], [LE(za) - CH(za), Y(za), sg * za], [LE(zb) - CH(zb), Y(zb), sg * zb], [LE(zb), Y(zb), sg * zb], TH(za), TH(zb), 1, c, cWhite); }
      const hy = z => 0.08 - (z - 0.3) * Math.tan(10 * D2R), hle = z => -4.3 - (z - 0.3) * Math.tan(32 * D2R), hch = z => 1.7 - (z - 0.3) / 1.95 * 0.95;
      panel([hle(0.3), hy(0.3), sg * 0.3], [hle(0.3) - hch(0.3), hy(0.3), sg * 0.3], [hle(2.25) - hch(2.25), hy(2.25), sg * 2.25], [hle(2.25), hy(2.25), sg * 2.25], 0.14, 0.05, 1, cRed, cWhite);
    }
    // fin with a saffron / white / green flash near the top
    const fs = [0.45, 1.7, 1.95, 2.2, 2.45], fle = y => -3.7 - (y - 0.45) * Math.tan(42 * D2R), fch = y => 2.6 - (y - 0.45) / 2.0 * 1.65, fth = y => 0.18 - (y - 0.45) / 2.0 * 0.12, fc = [cRed, cSaf, cWhite, cGrn];
    for (let k = 0; k < 4; k++) { const ya = fs[k], yb = fs[k + 1]; panel([fle(ya), ya, 0], [fle(ya) - fch(ya), ya, 0], [fle(yb) - fch(yb), yb, 0], [fle(yb), yb, 0], fth(ya), fth(yb), 2, fc[k], fc[k]); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
    g.computeBoundingSphere(); return g;
  })();
  const NJ = 9;
  const jetMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.08, envMapIntensity: 1.1 });
  const jets = new THREE.InstancedMesh(jetGeo, jetMat, NJ); jets.frustumCulled = false; jets.count = 0; jets.visible = false;
  jets.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(jets);
  // formation (body frame: x forward, y up, z right): lead, three each side in the arrowhead's arms, two in the shaft
  const FORM = [[0, 0, 0], [-12, -1.2, -11], [-12, -1.2, 11], [-24, -2.4, -22], [-24, -2.4, 22], [-36, -3.6, -33], [-36, -3.6, 33], [-17, -1.6, 0], [-34, -3.2, 0]];
  const SMOKE = [0, 1, 2, 1, 2, 1, 2, 0, 0];   // 0 white, 1 saffron (left arm), 2 green (right arm)
  const SCOL = [new THREE.Color(0.86, 0.87, 0.88), new THREE.Color(1.0, 0.36, 0.035), new THREE.Color(0.05, 0.42, 0.1)];

  // the display, baked on a nominal 240 s timeline (scaled to the item's t0..t1): two low passes along the runway axis
  // (with a wingover between them), a loop, a wingover back, a pull-up into the vertical and a bomb-burst, a rejoin with
  // smoke off, and a final arrowhead pass
  const DT = 0.25;
  function bakeShow(it) {
    const cx = num(it.cx, -700), cy = num(it.cy, 0), R = clamp(num(it.r, 3000), 1600, 3200);
    const V = 160, H0 = 110, RHO = 480, HW = 650, RL = clamp(R * 0.25, 600, 850), RP = 420, RB = 700;
    const xA0 = cx - R, xA1 = cx + 0.75 * R, yN = cy - 2 * RHO, xW = cx - 0.65 * R, xP = cx - RP;
    const segs = []; const add = (d, f) => segs.push([d, f]);
    const tB = Math.PI * RHO / V * 1.3, tD = TAU * RL / 170, tF1 = Math.PI / 2 * RP / V * 1.1, tF2 = 5, CL = 650;
    add(1.75 * R / V, (t, o) => o.set(xA0 + V * t, H0, cy));
    add(tB, (t, o) => { const th = Math.PI * t / tB; o.set(xA1 + RHO * Math.sin(th), H0 + HW * Math.sin(th) ** 2, cy - RHO * (1 - Math.cos(th))); });
    add((xA1 - cx) / V, (t, o) => o.set(xA1 - V * t, H0, yN));
    add(tD, (t, o) => { const u = t / tD, ph = TAU * (u + 0.05 * Math.sin(TAU * u)); o.set(cx - RL * Math.sin(ph), H0 + RL * (1 - Math.cos(ph)), yN); });
    add((cx - xW) / V, (t, o) => o.set(cx - V * t, H0, yN));
    add(tB, (t, o) => { const th = Math.PI * t / tB; o.set(xW - RHO * Math.sin(th), H0 + HW * Math.sin(th) ** 2, yN + RHO * (1 - Math.cos(th))); });
    add((xP - xW) / V, (t, o) => o.set(xW + V * t, H0, cy));
    add(tF1, (t, o) => { const ph = Math.PI / 2 * t / tF1; o.set(xP + RP * Math.sin(ph), H0 + RP * (1 - Math.cos(ph)), cy); });
    add(tF2, (t, o) => { const u = t / tF2; o.set(cx, H0 + RP + CL * u * (1.3 - 0.3 * u), cy); });
    const sB = segs.reduce((a, s) => a + s[0], 0), tF3 = 7, tF4 = 11, sG = Math.max(196, sB + tF3 + tF4 + 30), TEND = sG + 44, xG0 = cx - 1.25 * R;
    const NS = Math.ceil(TEND / DT) + 3, kB = Math.floor(sB / DT), kG = Math.ceil(sG / DT);
    const tv = new THREE.Vector3(), tv2 = new THREE.Vector3();
    // the lead's formation path (segments up to the split, the final pass after the rejoin), smoothed, with frames
    const L = new Float32Array(NS * 3);
    for (let k = 0; k < NS; k++) { const s = k * DT;
      if (k <= kB + 2) { let t = s, i = 0; while (i < segs.length - 1 && t > segs[i][0]) { t -= segs[i][0]; i++; } segs[i][1](Math.min(t, segs[i][0] * 1.2), tv); }
      else tv.set(xG0 + V * (s - sG), H0 + 10, cy);
      L[k * 3] = tv.x; L[k * 3 + 1] = tv.y; L[k * 3 + 2] = tv.z; }
    const smooth = (A, k0, k1, w, pass) => { const tmp = new Float32Array(A.length);
      for (let p = 0; p < pass; p++) { tmp.set(A); for (let k = k0 + w; k <= k1 - w; k++) for (let c = 0; c < 3; c++) { let s = 0; for (let j = -w; j <= w; j++) s += tmp[(k + j) * 3 + c]; A[k * 3 + c] = s / (2 * w + 1); } } };
    smooth(L, 0, kB + 2, 4, 2);
    const frames = (A, F, Uu) => { let px = 0, py = 1, pz = 0;
      for (let k = 0; k < NS; k++) { const a = Math.max(0, k - 1), b = Math.min(NS - 1, k + 1);
        let fx = A[b * 3] - A[a * 3], fy = A[b * 3 + 1] - A[a * 3 + 1], fz = A[b * 3 + 2] - A[a * 3 + 2]; const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
        let ax = 0, ay = 9.81, az = 0; if (k > 0 && k < NS - 1) { const i0 = (k - 1) * 3, i1 = k * 3, i2 = (k + 1) * 3; ax += (A[i2] - 2 * A[i1] + A[i0]) / (DT * DT); ay += (A[i2 + 1] - 2 * A[i1 + 1] + A[i0 + 1]) / (DT * DT); az += (A[i2 + 2] - 2 * A[i1 + 2] + A[i0 + 2]) / (DT * DT); }
        let d = ax * fx + ay * fy + az * fz; ax -= fx * d; ay -= fy * d; az -= fz * d; let l = Math.hypot(ax, ay, az);
        if (l < 3) { d = px * fx + py * fy + pz * fz; ax = px - fx * d; ay = py - fy * d; az = pz - fz * d; l = Math.hypot(ax, ay, az) || 1; }
        ax /= l; ay /= l; az /= l; px = ax; py = ay; pz = az;
        F[k * 3] = fx; F[k * 3 + 1] = fy; F[k * 3 + 2] = fz; Uu[k * 3] = ax; Uu[k * 3 + 1] = ay; Uu[k * 3 + 2] = az; } };
    const LF = new Float32Array(NS * 3), LU = new Float32Array(NS * 3); frames(L, LF, LU);
    const form = (i, k, o) => { const f = [LF[k * 3], LF[k * 3 + 1], LF[k * 3 + 2]], u = [LU[k * 3], LU[k * 3 + 1], LU[k * 3 + 2]], r = [f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]], F = FORM[i];
      o.set(L[k * 3] + f[0] * F[0] + u[0] * F[1] + r[0] * F[2], L[k * 3 + 1] + f[1] * F[0] + u[1] * F[1] + r[1] * F[2], L[k * 3 + 2] + f[2] * F[0] + u[2] * F[1] + r[2] * F[2]); };
    const herm = (P0, T0, P1, T1, t, o) => { const t2 = t * t, t3 = t2 * t, a = 2 * t3 - 3 * t2 + 1, b = t3 - 2 * t2 + t, c = -2 * t3 + 3 * t2, d = t3 - t2;
      o.set(a * P0.x + b * T0.x + c * P1.x + d * T1.x, a * P0.y + b * T0.y + c * P1.y + d * T1.y, a * P0.z + b * T0.z + c * P1.z + d * T1.z); };
    const J = [];
    for (let i = 0; i < NJ; i++) {
      const A = new Float32Array(NS * 3), F = new Float32Array(NS * 3), U = new Float32Array(NS * 3), SM = new Float32Array(NS);
      const ps = new THREE.Vector3(); form(i, kB, ps);
      const psi = (i * TAU) / NJ + 0.35, dir = new THREE.Vector3(Math.cos(psi), 0, Math.sin(psi));
      const bE = 135 * D2R, Pb = ps.clone().addScaledVector(dir, RB * (1 - Math.cos(bE))).addScaledVector(UP, RB * Math.sin(bE));
      const Vb = dir.clone().multiplyScalar(Math.sin(bE)).addScaledVector(UP, Math.cos(bE)).multiplyScalar(RB * bE / tF3 * tF4 * 0.8);
      const Pq = new THREE.Vector3(ps.x, 280, ps.z).addScaledVector(dir, RB * 1.7 + 1500), Vq = dir.clone().multiplyScalar(V * tF4 * 0.8);
      const Pj = new THREE.Vector3(); form(i, kG, Pj); const dR = sG - sB - tF3 - tF4, T0 = dir.clone().multiplyScalar(V * dR * 0.3), T1 = new THREE.Vector3(V * dR * 0.45, 0, 0);
      for (let k = 0; k < NS; k++) { const s = k * DT;
        if (k <= kB || k >= kG) form(i, k, tv);
        else if (s < sB + tF3) { const b = (s - sB) / tF3 * bE; tv.copy(ps).addScaledVector(dir, RB * (1 - Math.cos(b))).addScaledVector(UP, RB * Math.sin(b)); }
        else if (s < sB + tF3 + tF4) herm(Pb, Vb, Pq, Vq, (s - sB - tF3) / tF4, tv);
        else herm(Pq, T0, Pj, T1, (s - sB - tF3 - tF4) / dR, tv);
        A[k * 3] = tv.x; A[k * 3 + 1] = Math.max(25, tv.y); A[k * 3 + 2] = tv.z;
        SM[k] = 1 - sstep(sB + tF3 + tF4 - 1.5, sB + tF3 + tF4 + 1, s) * (1 - sstep(sG - 4, sG - 1, s)); }
      smooth(A, 0, NS - 1, 2, 2); frames(A, F, U);
      J.push({ A, F, U, SM });
    }
    void tv2;
    return { id: it.id, cx, cy, R, NS, TEND, sB, sG, J };
  }
  const _o = [0, 0, 0];
  function cr(A, NS, x, o3) {   // Catmull-Rom through baked samples; x in sample units
    let k = Math.floor(x), f = x - k; if (k < 0) { k = 0; f = 0; } if (k > NS - 2) { k = NS - 2; f = 1; }
    const k0 = Math.max(0, k - 1) * 3, k1 = k * 3, k2 = (k + 1) * 3, k3 = Math.min(NS - 1, k + 2) * 3, f2 = f * f, f3 = f2 * f;
    for (let c = 0; c < 3; c++) { const p0 = A[k0 + c], p1 = A[k1 + c], p2 = A[k2 + c], p3 = A[k3 + c];
      _o[c] = 0.5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f2 + (3 * p1 - p0 - 3 * p2 + p3) * f3); }
    return o3.set(_o[0], _o[1], _o[2]);
  }
  function lin(A, NS, x, o3) { let k = Math.floor(x), f = x - k; if (k < 0) { k = 0; f = 0; } if (k > NS - 2) { k = NS - 2; f = 1; } const a = k * 3, b = a + 3;
    return o3.set(A[a] + (A[b] - A[a]) * f, A[a + 1] + (A[b + 1] - A[a + 1]) * f, A[a + 2] + (A[b + 2] - A[a + 2]) * f); }
  const lin1 = (A, NS, x) => { let k = Math.floor(x), f = x - k; if (k < 0) { k = 0; f = 0; } if (k > NS - 2) { k = NS - 2; f = 1; } return A[k] + (A[k + 1] - A[k]) * f; };

  // smoke: one camera-facing ribbon per jet, 48 segments over the last LIFE sim seconds, rebuilt every frame from the paths
  const NT = 90, LIFE = 30, TV = NT + 1;
  const trGeo = new THREE.BufferGeometry();
  const trPos = new Float32Array(NJ * TV * 2 * 3), trTan = new Float32Array(NJ * TV * 2 * 3), trD = new Float32Array(NJ * TV * 2 * 4), trCol = new Float32Array(NJ * TV * 2 * 3);
  const trPA = new THREE.BufferAttribute(trPos, 3).setUsage(THREE.DynamicDrawUsage), trTA = new THREE.BufferAttribute(trTan, 3).setUsage(THREE.DynamicDrawUsage), trDA = new THREE.BufferAttribute(trD, 4).setUsage(THREE.DynamicDrawUsage);
  trGeo.setAttribute('position', trPA); trGeo.setAttribute('aTan', trTA); trGeo.setAttribute('aD', trDA); trGeo.setAttribute('aCol', new THREE.BufferAttribute(trCol, 3));
  { const idx = []; for (let i = 0; i < NJ; i++) for (let j = 0; j < NT; j++) { const a = (i * TV + j) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trGeo.setIndex(idx);
    for (let i = 0; i < NJ; i++) for (let j = 0; j < TV * 2; j++) { const c = SCOL[SMOKE[i]], o = (i * TV * 2 + j) * 3; trCol[o] = c.r; trCol[o + 1] = c.g; trCol[o + 2] = c.b; } }
  trGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const trU = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uAmbT: { value: new THREE.Color(0.3, 0.34, 0.4) }, uAmbB: { value: new THREE.Color(0.2, 0.19, 0.16) } }]);
  const trMat = new THREE.ShaderMaterial({ uniforms: trU, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    vertexShader: `attribute vec3 aTan; attribute vec4 aD; attribute vec3 aCol;
varying vec3 vCol, vV, vS; varying float vSide, vA, vEmit;
#include <fog_pars_vertex>
void main() {
  vec3 P = position; vec3 V = normalize(cameraPosition - P); vec3 T = aTan;
  vec3 S = cross(T, V); float l = length(S); S = l > 1e-4 ? S / l : vec3(0.0, 1.0, 0.0);
  P += S * aD.x * aD.w;
  vec4 mvPosition = viewMatrix * vec4(P, 1.0); gl_Position = projectionMatrix * mvPosition;
  vCol = aCol; vSide = aD.x; vA = aD.y; vEmit = aD.z; vV = V; vS = S;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform vec3 uSunDir, uSunCol, uAmbT, uAmbB;
varying vec3 vCol, vV, vS; varying float vSide, vA, vEmit;
#include <fog_pars_fragment>
float fh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(fh(i), fh(i + vec2(1.0, 0.0)), f.x), mix(fh(i + vec2(0.0, 1.0)), fh(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  float s = vSide, prof = max(1.0 - s * s, 0.0);
  // billows: noise anchored to the emission time (puffs stay where they were made), coarse lumps plus fine fray at the edges
  vec2 q = vec2(vEmit * 3.2, s * 1.4 + vEmit * 0.53);
  float n = vn(q) * 0.5 + vn(q * 2.1 + 7.1) * 0.3 + vn(q * 4.7 + 3.3) * 0.2;
  float d = pow(prof, 0.75) * (0.3 + 1.05 * n);
  float a = min(1.0, vA * smoothstep(0.1, 0.8, d) * (0.8 + 0.35 * n));
  if (a < 0.004) discard;
  vec3 V = normalize(vV), S = normalize(vS);
  vec3 N = normalize(S * s * 0.8 + V * sqrt(prof) + vec3(0.0, (n - 0.5) * 0.6, 0.0));
  float wrap = clamp(0.5 + 0.5 * dot(N, uSunDir), 0.0, 1.0);
  vec3 col = vCol * (uSunCol * wrap + mix(uAmbB, uAmbT, 0.5 + 0.5 * N.y)) * (0.8 + 0.35 * n);
  col += vCol * uSunCol * pow(max(dot(-V, uSunDir), 0.0), 8.0) * 0.5 * (1.0 - prof * 0.6);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}` });
  const trails = new THREE.Mesh(trGeo, trMat); trails.frustumCulled = false; trails.renderOrder = 6; trails.visible = false; root.add(trails);

  const show = { bake: null, S: 1 };
  const _p = new THREE.Vector3(), _p0 = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3(), _r = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  const jetAt = (B, i, s, S, o) => {   // a jet's position at nominal time s, its formation offset scaled by S
    const x = s / DT, wF = 1 - sstep(B.sB - 1, B.sB + 1.5, s) * (1 - sstep(B.sG - 6, B.sG - 0.5, s));
    cr(B.J[i].A, B.NS, x, o); if (i && wF > 0 && S !== 1) { cr(B.J[0].A, B.NS, x, _p0); o.x += (o.x - _p0.x) * (S - 1) * wF; o.y += (o.y - _p0.y) * (S - 1) * wF; o.z += (o.z - _p0.z) * (S - 1) * wF; }
    return o; };
  function updFlypast(it, dt, T) {
    if (!show.bake || show.bake.id !== it.id || show.key !== [it.t0, it.t1, it.cx, it.cy, it.r].join()) { show.bake = bakeShow(it); show.key = [it.t0, it.t1, it.cx, it.cy, it.r].join(); }
    const B = show.bake, D = Math.max(30, it.t1 - it.t0), kT = B.TEND / D, s = (T - it.t0) * kT, cam = Z.camera.position;
    const fade = sstep(0, 2.5, s) * (1 - sstep(B.TEND - 5, B.TEND, s));
    jetAt(B, 0, s, 1, _p); const St = clamp(cam.distanceTo(_p) / 2100, 1, 5);
    show.S = show.S + (St - show.S) * (1 - Math.exp(-Math.min(dt, 0.1) * 4)); const S = show.S;
    // jets
    const js = S * sstep(0, 1.5, s) * (1 - sstep(B.TEND - 2, B.TEND, s));
    for (let i = 0; i < NJ; i++) { const x = s / DT, J = B.J[i];
      jetAt(B, i, s, S, _p); lin(J.F, B.NS, x, _f).normalize(); lin(J.U, B.NS, x, _u); _u.addScaledVector(_f, -_u.dot(_f)).normalize(); _r.crossVectors(_f, _u);
      _m.makeBasis(_f, _u, _r); _q.setFromRotationMatrix(_m); _s.setScalar(Math.max(1e-4, js)); _m.compose(_p, _q, _s); jets.setMatrixAt(i, _m); }
    jets.count = NJ; jets.visible = js > 1e-3; jets.instanceMatrix.needsUpdate = true;
    // smoke: sample each jet's path at past emission times; wind drift and sink grow with age
    const W = Z.atmo && Z.atmo.wind, wsp = W ? W.speed || 0 : 3, wd = W ? W.dir || 0 : 0, wx = -Math.cos(wd) * wsp, wz = -Math.sin(wd) * wsp;
    for (let i = 0; i < NJ; i++) { const J = B.J[i];
      for (let j = 0; j < TV; j++) { const a = j / NT * LIFE, se = s - a * kT, o = (i * TV + j) * 2;
        jetAt(B, i, Math.max(0, se), S, _p);
        // the trail starts at the nozzle, a little behind the jet's origin
        if (j === 0) { lin(J.F, B.NS, s / DT, _f).normalize(); _p.addScaledVector(_f, -6.5 * S); }
        const wob = Math.sin(se * 0.9 + i * 1.7) * 0.6 + Math.sin(se * 2.3 + i) * 0.3;
        _p.x += wx * a + wob * a * 0.5; _p.y -= 0.5 * a; _p.z += wz * a + Math.cos(se * 1.1 + i) * a * 0.4;
        trPos[o * 3] = _p.x; trPos[o * 3 + 1] = _p.y; trPos[o * 3 + 2] = _p.z; trPos[o * 3 + 3] = _p.x; trPos[o * 3 + 4] = _p.y; trPos[o * 3 + 5] = _p.z;
        const on = se < 0 ? 0 : lin1(J.SM, B.NS, se / DT);
        const al = fade * on * Math.pow(1 - a / LIFE, 1.25) * sstep(0, 0.35, a) * 0.92, hw = S * (1.0 + 10 * (1 - Math.exp(-a / 2.5)) + 0.5 * a);
        trD[o * 4] = -1; trD[o * 4 + 1] = al; trD[o * 4 + 2] = se; trD[o * 4 + 3] = hw; trD[o * 4 + 4] = 1; trD[o * 4 + 5] = al; trD[o * 4 + 6] = se; trD[o * 4 + 7] = hw; }
      for (let j = 0; j < TV; j++) { const a = (i * TV + Math.max(0, j - 1)) * 6, b = (i * TV + Math.min(NT, j + 1)) * 6, o = (i * TV + j) * 6;
        let tx = trPos[a] - trPos[b], ty = trPos[a + 1] - trPos[b + 1], tz = trPos[a + 2] - trPos[b + 2]; const l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
        trTan[o] = tx; trTan[o + 1] = ty; trTan[o + 2] = tz; trTan[o + 3] = tx; trTan[o + 4] = ty; trTan[o + 5] = tz; } }
    trPA.needsUpdate = true; trTA.needsUpdate = true; trDA.needsUpdate = true; trails.visible = fade > 0.001;
  }

  /* ======================================================================= monkeys ======================================================================= */
  // ellipsoid parts per monkey: 0 rump, 1 chest, 2 head, 3 face, 4 muzzle, 5-6 eyes, 7-8 ears, 9-12 arms (upper, fore) L/R,
  // 13-16 legs (thigh, shin) L/R, 17-21 tail, 22-23 a baby (body, head) riding on the mother's back
  const NP = 24, MCAP = 24;
  const sph = new THREE.SphereGeometry(1, 7, 5);
  const fadeA = new THREE.InstancedBufferAttribute(new Float32Array(NP * MCAP).fill(1), 1).setUsage(THREE.DynamicDrawUsage); sph.setAttribute('aFade', fadeA);
  const furMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, envMapIntensity: 0.8 });
  furMat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aFade;\nvarying float vFade;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = aFade;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFade;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453) > vFade) discard;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float fz = 1.0 - abs(dot(normal, normalize(vViewPosition))); totalEmissiveRadiance += diffuseColor.rgb * fz * fz * 0.3; }');
  };
  furMat.customProgramCacheKey = () => 'zmh-fx-fur-2';
  const troop = new THREE.InstancedMesh(sph, furMat, NP * MCAP); troop.frustumCulled = false; troop.count = 0; troop.visible = false; troop.castShadow = false; troop.receiveShadow = true;
  troop.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(troop);
  { const C = h => new THREE.Color(h), body = C('#a08d72'), rump = C('#a8875f'), limb = C('#94816a'), head = C('#a39078'), face = C('#e09a8c'), muz = C('#d48a80'), eye = C('#2a1a12'), ear = C('#c79486'), tail = C('#a48660'), baby = C('#7a6853'), bface = C('#dca394');
    const pc = [rump, body, head, face, muz, eye, eye, ear, ear, limb, limb, limb, limb, rump, limb, rump, limb, tail, tail, tail, tail, tail, baby, bface];
    for (let m = 0; m < MCAP; m++) for (let k = 0; k < NP; k++) { const c = pc[k].clone(); if (k !== 5 && k !== 6) c.multiplyScalar(1 + ((m * 37 + 11) % 9 - 4) * 0.03); troop.setColorAt(m * NP + k, c); }
    troop.instanceColor.setUsage(THREE.StaticDrawUsage); }
  // soft contact shadows (one quad per monkey): ground the troop close up and give it contrast from far away
  const shG = new THREE.PlaneGeometry(1, 1); shG.rotateX(-Math.PI / 2);
  const shadows = new THREE.InstancedMesh(shG, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    vertexShader: 'varying vec2 vUv;varying float vA;void main(){vUv=uv;vA=1.;\n#ifdef USE_INSTANCING_COLOR\nvA=instanceColor.r;\n#endif\ngl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv;varying float vA;void main(){vec2 p=vUv*2.-1.;float r=dot(p,p);float a=(1.-smoothstep(0.15,1.,r))*vA;if(a<0.01)discard;gl_FragColor=vec4(0.03,0.025,0.02,a);}' }), MCAP);
  shadows.frustumCulled = false; shadows.count = 0; shadows.visible = false; shadows.renderOrder = 2; shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(shadows);
  for (let i = 0; i < MCAP; i++) shadows.setColorAt(i, new THREE.Color(0, 0, 0)); shadows.instanceColor.setUsage(THREE.DynamicDrawUsage);

  // the aerobridge walkways (drawn by terminal.js): found once in the scene by their unit-length geometry, read every frame
  let walkIM = null, walkScan = -1e9;
  const findWalk = () => { let best = null;
    Z.scene.traverse(o => { if (best || !o.isInstancedMesh || o === troop || o === jets || o === shadows || !o.geometry) return; const g = o.geometry; if (!g.attributes.position) return; if (!g.boundingBox) g.computeBoundingBox(); const b = g.boundingBox;
      if (Math.abs(b.min.x) < 0.01 && Math.abs(b.max.x - 1) < 0.01 && Math.abs(b.max.z - 1.93) < 0.06 && b.max.y - b.min.y > 2.5) { best = o; roofY = b.max.y; } });
    return best; };
  let roofY = 0.3;
  const _wm = new THREE.Matrix4(), _wa = new THREE.Vector3(), _wb = new THREE.Vector3();
  const walkEnds = (k, a, b) => { walkIM.getMatrixAt(k, _wm); a.set(0, roofY, 0).applyMatrix4(_wm); b.set(1, roofY, 0).applyMatrix4(_wm); };
  function nearestWalk(x, y) { if (!walkIM) return -1; let best = -1, bd = 75 * 75;
    for (let k = 0; k < walkIM.count; k++) { walkEnds(k, _wa, _wb); const vx = _wb.x - _wa.x, vz = _wb.z - _wa.z, l2 = vx * vx + vz * vz || 1, t = clamp(((x - _wa.x) * vx + (y - _wa.z) * vz) / l2, 0, 1);
      const dx = _wa.x + vx * t - x, dz = _wa.z + vz * t - y, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = k; } }
    return best; }

  const troopS = { id: null, M: [], S: 1 };
  const rnd = (m, k) => { const x = Math.sin(m * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  function setupTroop(it) {
    troopS.id = it.id; troopS.M = []; troopS.key = it.t0 + ',' + it.t1;
    let pts = Array.isArray(it.pts) && it.pts.length ? it.pts : Z.GATES.filter(g => g.conc === 'FN').map(g => [g.x, g.y]);
    if (!pts.length) pts = [[160, -450]];
    const n = clamp(Math.round(num(it.n, 14)), 3, MCAP);
    for (let m = 0; m < n; m++) {
      const p = pts[(m * 5) % pts.length], k = nearestWalk(p[0], p[1]), roof = k >= 0 && (m % 3 !== 2);
      const M = { m, roof, k, u: 0.15 + 0.7 * rnd(m, 1), lat: (rnd(m, 2) - 0.5) * 1.8, gx: p[0] + (rnd(m, 3) - 0.5) * 24, gy: p[1] + (rnd(m, 4) - 0.5) * 24, gdir: rnd(m, 5) * TAU,
        st: 'sit', tEnd: 0, tu: 0, w: 0, g: 0, ph: rnd(m, 6), hd: rnd(m, 7) * TAU, hY: 0, hYt: 0, hT: 0, scr: 0, scrOn: 0, baby: m === 1 || m === 6, fade: 0, flee: null, wx: 0, wy: 0, wz: 0, sitOff: (rnd(m, 8) < 0.5 ? -1 : 1) * (Math.PI / 2 + (rnd(m, 9) - 0.5) * 0.9) };
      if (roof && rnd(m, 10) < 0.3) M.lat = 0;
      troopS.M.push(M);
    }
  }
  // joints in the monkey's frame (x forward, y up, z right), metres at 1x; three poses blended
  const J0 = () => ({ pt: new THREE.Vector3(), pm: new THREE.Vector3(), pn: new THREE.Vector3(), hd: new THREE.Vector3(),
    sh: [new THREE.Vector3(), new THREE.Vector3()], el: [new THREE.Vector3(), new THREE.Vector3()], ha: [new THREE.Vector3(), new THREE.Vector3()],
    hp: [new THREE.Vector3(), new THREE.Vector3()], kn: [new THREE.Vector3(), new THREE.Vector3()], ft: [new THREE.Vector3(), new THREE.Vector3()], tl: Array.from({ length: 6 }, () => new THREE.Vector3()) });
  const JS = J0(), JW = J0(), JG = J0(), JX = J0();
  const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _t3 = new THREE.Vector3();
  function ik(root, foot, a, b, bend, out) {   // two-bone IK: the middle joint, bent toward `bend`
    _t1.subVectors(foot, root); let d = _t1.length(); const dm = (a + b) * 0.999; if (d > dm) { _t1.multiplyScalar(dm / d); foot.copy(root).add(_t1); d = dm; } d = Math.max(d, 1e-4);
    _t1.divideScalar(d); const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
    _t2.copy(bend).addScaledVector(_t1, -bend.dot(_t1)).normalize();
    return out.copy(root).addScaledVector(_t1, x).addScaledVector(_t2, h); }
  const BF = new THREE.Vector3(1, 0, 0), BB = new THREE.Vector3(-1, 0.2, 0);
  const tailFrom = (J, angs, side, segL) => { let a = 0; J.tl[0].copy(J.pt); for (let i = 1; i < 6; i++) { const an = angs[i - 1] * D2R; a += side * 0.25;
    J.tl[i].set(J.tl[i - 1].x - Math.cos(an) * segL * Math.cos(a * 0.6), J.tl[i - 1].y + Math.sin(an) * segL, J.tl[i - 1].z + Math.sin(a * 0.6) * segL * Math.cos(an)); } };
  function poseSit(J, hY, scr, now, ph) {
    const br = Math.sin(now * 1.9 + ph * 11) * 0.004;   // breathing
    J.pt.set(-0.085, 0.07, 0); J.pm.set(-0.06, 0.18 + br, 0); J.pn.set(0.005, 0.29 + br, 0); J.hd.set(0.075, 0.345 + br, 0);
    for (let s = 0; s < 2; s++) { const z = s ? 1 : -1;
      J.sh[s].set(0.01, 0.27 + br, z * 0.08); J.hp[s].set(-0.05, 0.075, z * 0.075); J.ft[s].set(0.11, 0.012, z * 0.085); ik(J.hp[s], J.ft[s], 0.14, 0.15, BF, J.kn[s]);
      J.kn[s].z = z * 0.105; J.ha[s].set(0.165, 0.014, z * 0.05); }
    if (scr > 0) { const o = Math.sin(now * 24 + ph * 9) * 0.022; J.ha[1].lerp(_t3.set(-0.03, 0.2 + o, 0.105), scr); }
    for (let s = 0; s < 2; s++) { ik(J.sh[s], J.ha[s], 0.13, 0.14, BB, J.el[s]); J.el[s].z = (s ? 1 : -1) * Math.max(Math.abs(J.el[s].z), 0.1); }
    tailFrom(J, [-55, -8, 0, 0, 0], 1.5, 0.052); for (let i = 1; i < 6; i++) J.tl[i].y = Math.max(0.014, J.tl[i].y);
  }
  function poseWalk(J, ph) {
    const bob = Math.sin(ph * TAU * 2) * 0.008;
    J.pt.set(-0.2, 0.27 + bob, 0); J.pm.set(-0.04, 0.27 + bob, 0); J.pn.set(0.11, 0.255 + bob, 0); J.hd.set(0.21, 0.305 + bob, 0);
    const legs = [[0, -1, 1], [0.5, 1, 1], [0.25, -1, 0], [0.75, 1, 0]];   // phase, side, hind?
    for (const [o, sd, hind] of legs) { const p = (ph + o) % 1, s = sd > 0 ? 1 : 0, str = 0.2; let fx, fy;
      if (p < 0.62) { fx = str * (0.5 - p / 0.62); fy = 0; } else { const q = (p - 0.62) / 0.38; fx = str * (-0.5 + q); fy = 0.05 * Math.sin(Math.PI * q); }
      if (hind) { J.hp[s].set(-0.17, 0.245 + bob, sd * 0.065); J.ft[s].set(-0.15 + fx, fy + 0.01, sd * 0.07); ik(J.hp[s], J.ft[s], 0.14, 0.15, BF, J.kn[s]); }
      else { J.sh[s].set(0.11, 0.225 + bob, sd * 0.065); J.ha[s].set(0.14 + fx, fy + 0.01, sd * 0.065); ik(J.sh[s], J.ha[s], 0.13, 0.14, BB, J.el[s]); } }
    tailFrom(J, [35, 20, 0, -25, -50], 0, 0.05);
  }
  function poseGallop(J, ph) {
    const c = Math.sin(ph * TAU), up = 0.07 * Math.max(0, Math.sin(ph * TAU + 0.9)), pit = 0.2 * c;
    const cp = Math.cos(pit), sp = Math.sin(pit), Lf = 0.15 * (1 + 0.12 * c), Lh = 0.17 * (1 - 0.12 * c);
    J.pm.set(-0.03, 0.27 + up, 0); J.pn.set(J.pm.x + Lf * cp, J.pm.y + Lf * sp, 0); J.pt.set(J.pm.x - Lh * cp, J.pm.y - Lh * sp, 0); J.hd.set(J.pn.x + 0.1, J.pn.y + 0.04, 0);
    for (let s = 0; s < 2; s++) { const sd = s ? 1 : -1;
      for (let hind = 0; hind < 2; hind++) { const p = (ph + (hind ? 0.5 : 0) + s * 0.06) % 1, str = 0.42; let fx, fy;
        if (p < 0.38) { fx = str * (0.5 - p / 0.38); fy = 0; } else { const q = (p - 0.38) / 0.62; fx = str * (-0.5 + q); fy = 0.11 * Math.sin(Math.PI * q); }
        if (hind) { J.hp[s].set(J.pt.x + 0.03, J.pt.y - 0.02, sd * 0.065); J.ft[s].set(-0.16 + fx, fy + 0.01, sd * 0.07); ik(J.hp[s], J.ft[s], 0.14, 0.15, BF, J.kn[s]); }
        else { J.sh[s].set(J.pn.x - 0.01, J.pn.y - 0.03, sd * 0.065); J.ha[s].set(0.15 + fx, fy + 0.01, sd * 0.06); ik(J.sh[s], J.ha[s], 0.13, 0.14, BB, J.el[s]); } } }
    tailFrom(J, [18, 14, 10, 6, 2], 0, 0.05);
  }
  const lerpJ = (A, B, w, O) => { for (const k of ['pt', 'pm', 'pn', 'hd']) O[k].lerpVectors(A[k], B[k], w);
    for (const k of ['sh', 'el', 'ha', 'hp', 'kn', 'ft', 'tl']) for (let i = 0; i < A[k].length; i++) O[k][i].lerpVectors(A[k][i], B[k][i], w); };
  const copyJ = (A, O) => lerpJ(A, A, 0, O);
  // place one ellipsoid instance along a bone (A -> B) or at a point with a quaternion
  const _mq = new THREE.Quaternion(), _mq2 = new THREE.Quaternion(), _mp = new THREE.Vector3(), _ms = new THREE.Vector3(), _md = new THREE.Vector3(), _mm = new THREE.Matrix4(), _base = new THREE.Vector3(), _qy = new THREE.Quaternion(), _e = new THREE.Euler();
  let SC = 1;
  const toW = (v, o) => o.copy(v).multiplyScalar(SC).applyQuaternion(_qy).add(_base);
  function bone(idx, A, B, r, rz, k) {
    _md.subVectors(B, A); const l = _md.length() || 1e-4; _md.divideScalar(l); _mq.setFromUnitVectors(UP, _md); _mq2.multiplyQuaternions(_qy, _mq);
    _t3.addVectors(A, B).multiplyScalar(0.5); toW(_t3, _mp); _ms.set(r * SC, l * 0.5 * (k || 1.15) * SC, (rz || r) * SC); _mm.compose(_mp, _mq2, _ms); troop.setMatrixAt(idx, _mm); }
  function blob(idx, C, q, rx, ry, rz) { toW(C, _mp); _mq2.multiplyQuaternions(_qy, q); _ms.set(rx * SC, ry * SC, rz * SC); _mm.compose(_mp, _mq2, _ms); troop.setMatrixAt(idx, _mm); }
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0), _bc = new THREE.Color();
  const _hq = new THREE.Quaternion(), _hv = new THREE.Vector3(), _hf = new THREE.Vector3(), _hr = new THREE.Vector3(), _hu = new THREE.Vector3(), _hb = new THREE.Vector3();
  function drawMonkey(M, now, fade) {
    const b = M.m * NP; SC = troopS.S;
    poseSit(JS, M.hY, M.scr, now, M.ph);
    if (M.g > 0.001) { poseGallop(JG, M.ph); if (M.w > 0.001) { poseWalk(JW, M.ph); lerpJ(JS, JW, M.w, JX); lerpJ(JX, JG, M.g, JX); } else lerpJ(JS, JG, M.g, JX); }
    else if (M.w > 0.001) { poseWalk(JW, M.ph); lerpJ(JS, JW, M.w, JX); } else copyJ(JS, JX);
    const J = JX;
    _qy.setFromAxisAngle(UP, -M.hd); _base.set(M.wx, M.wy, M.wz);
    bone(b, J.pt, J.pm, 0.1, 0.095, 1.5); bone(b + 1, J.pm, J.pn, 0.088, 0.084, 1.45);
    // head: turns and nods; the bare pink face, muzzle, eyes and ears follow it
    _e.set(0, M.hY, (M.g > 0.5 ? -0.25 : 0.05) + Math.sin(now * 0.7 + M.ph * 7) * 0.08, 'YZX'); _hq.setFromEuler(_e);
    _hf.set(1, 0, 0).applyQuaternion(_hq); _hu.set(0, 1, 0).applyQuaternion(_hq); _hr.set(0, 0, 1).applyQuaternion(_hq);
    blob(b + 2, J.hd, _hq, 0.066, 0.064, 0.06);
    _hv.copy(J.hd).addScaledVector(_hf, 0.036).addScaledVector(_hu, -0.006); blob(b + 3, _hv, _hq, 0.034, 0.046, 0.046);
    _hv.copy(J.hd).addScaledVector(_hf, 0.062).addScaledVector(_hu, -0.024); blob(b + 4, _hv, _hq, 0.026, 0.022, 0.028);
    for (const sd of [-1, 1]) { _hv.copy(J.hd).addScaledVector(_hf, 0.066).addScaledVector(_hu, 0.012).addScaledVector(_hr, sd * 0.019); blob(b + (sd < 0 ? 5 : 6), _hv, _hq, 0.008, 0.009, 0.009);
      _hv.copy(J.hd).addScaledVector(_hr, sd * 0.056).addScaledVector(_hu, 0.008).addScaledVector(_hf, -0.008); blob(b + (sd < 0 ? 7 : 8), _hv, _hq, 0.012, 0.019, 0.008); }
    for (let s = 0; s < 2; s++) { bone(b + 9 + s * 2, J.sh[s], J.el[s], 0.03); bone(b + 10 + s * 2, J.el[s], J.ha[s], 0.023, 0.023, 1.22);
      bone(b + 13 + s * 2, J.hp[s], J.kn[s], 0.04, 0.036, 1.25); bone(b + 14 + s * 2, J.kn[s], J.ft[s], 0.026, 0.026, 1.22); }
    for (let i = 0; i < 5; i++) bone(b + 17 + i, J.tl[i], J.tl[i + 1], 0.02 - i * 0.002, 0, 1.3);
    if (M.baby) { _hb.subVectors(J.pn, J.pt); const l = _hb.length(); _hb.divideScalar(l || 1); _hv.set(-_hb.y, _hb.x, 0);
      _t3.copy(J.pm).addScaledVector(_hv, 0.085).addScaledVector(_hb, -0.01); _t2.copy(_t3).addScaledVector(_hb, 0.075); _t3.addScaledVector(_hb, -0.06);
      bone(b + 22, _t3, _t2, 0.045, 0.05, 1.2); _t2.addScaledVector(_hb, 0.04).addScaledVector(_hv, 0.025); _e.set(0, Math.sin(now * 1.3 + 2) * 0.5, 0, 'YZX'); _hq.setFromEuler(_e); blob(b + 23, _t2, _hq, 0.04, 0.036, 0.035); }
    else { troop.setMatrixAt(b + 22, ZERO); troop.setMatrixAt(b + 23, ZERO); }
    // contact shadow under the body
    _t3.copy(J.pm).setY(0); toW(_t3, _mp); _mp.y = M.wy + 0.03 * SC; _ms.set(0.62 * SC, 1, 0.42 * SC); _mm.compose(_mp, _qy, _ms); shadows.setMatrixAt(M.m, _mm);
    _bc.setRGB(0.5 * fade, 0, 0); shadows.setColorAt(M.m, _bc);
    for (let k = 0; k < NP; k++) fadeA.array[b + k] = fade;
  }
  const _fp = new THREE.Vector3();
  function fleePos(M, p, o) {   // polyline: start -> jump to the ground -> (x0,y0) -> (x1,y1); returns heading
    const F = M.flee, P = F.P; let L = 0; for (let i = 0; i < P.length - 1; i++) L += F.seg[i];
    let d = p * L, i = 0; while (i < P.length - 2 && d > F.seg[i]) { d -= F.seg[i]; i++; }
    const t = clamp(d / (F.seg[i] || 1), 0, 1), A = P[i], B = P[i + 1];
    o.lerpVectors(A, B, t); if (i === 0) o.y = A.y * (1 - t) + 1.2 * troopS.S * Math.sin(Math.PI * t) * (A.y > 1 ? 1 : 0);
    return Math.atan2(B.z - A.z, B.x - A.x);
  }
  function updMonkeys(it, dt, now, T, adv) {
    if (!walkIM && now - walkScan > 2) { walkScan = now; walkIM = findWalk(); if (walkIM && troopS.id === it.id) troopS.id = null; }
    if (troopS.id !== it.id || troopS.key !== it.t0 + ',' + it.t1) setupTroop(it);
    const MS = troopS.M, cam = Z.camera, rdt = adv ? Math.min(dt, 0.1) : 0;
    // scale: keep a monkey ~5 px long, never below life size, capped for the strategic view
    let cx = 0, cz = 0; for (const M of MS) { cx += M.wx; cz += M.wz; } cx /= MS.length || 1; cz /= MS.length || 1;
    const dist = Math.hypot(cam.position.x - cx, cam.position.y, cam.position.z - cz), vh = Z.renderer.domElement.clientHeight || 860;
    const mpp = dist * 2 * Math.tan(cam.fov * D2R / 2) / vh, St = clamp(mpp * 12 / 0.5, 1, 160);
    troopS.S = troopS.S === 1 && St > 1 && !troopS.init ? St : troopS.S + (St - troopS.S) * (1 - Math.exp(-Math.min(dt, 0.1) * 5)); troopS.init = 1;
    const S = troopS.S, fin = sstep(it.t0, it.t0 + 12, T) * (1 - sstep(it.t1 - 12, it.t1, T)), F = it.flee;
    let n = 0;
    for (const M of MS) {
      // the monkey's spot this frame: on its walkway roof (the bridge moves when an aircraft docks) or on the apron
      let ax, ay, az, dx, dz;
      if (M.roof && walkIM && M.k < walkIM.count) { walkEnds(M.k, _wa, _wb); dx = _wb.x - _wa.x; dz = _wb.z - _wa.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        ax = _wa.x + (_wb.x - _wa.x) * M.u - dz * M.lat; ay = _wa.y + (_wb.y - _wa.y) * M.u; az = _wa.z + (_wb.z - _wa.z) * M.u + dx * M.lat; M.len = l; }
      else { dx = Math.cos(M.gdir); dz = Math.sin(M.gdir); const l = 10 + Math.min(4 * S, 30); ax = M.gx + dx * (M.u - 0.5) * l; ay = 0; az = M.gy + dz * (M.u - 0.5) * l; M.len = l; }
      let fade = fin, gT = 0, wT = 0;
      if (F && T >= F.t0) {
        if (!M.flee) { const jit = (rnd(M.m, 20) - 0.5) * 2, j2 = (rnd(M.m, 21) - 0.5) * 2, fx = num(F.x0, ax), fy = num(F.y0, az), gx = num(F.x1, fx), gy = num(F.y1, fy);
          const ux = gx - fx, uy = gy - fy, ul = Math.hypot(ux, uy) || 1, nx = -uy / ul, ny = ux / ul, sp = 1.6 * S + 4;
          const P = [new THREE.Vector3(ax, ay, az), new THREE.Vector3(ax + dz * (ay > 1 ? 4 : 0), 0, az - dx * (ay > 1 ? 4 : 0)),
            new THREE.Vector3(fx + nx * jit * sp, 0, fy + ny * jit * sp), new THREE.Vector3(gx + nx * j2 * sp, 0, gy + ny * j2 * sp)];
          const seg = []; for (let i = 0; i < 3; i++) seg.push(P[i].distanceTo(P[i + 1]));
          M.flee = { P, seg, d: 0.32 * rnd(M.m, 22), dur: 0.55 + 0.12 * rnd(M.m, 23) }; }
        const uF = clamp((T - F.t0) / Math.max(1, F.t1 - F.t0), 0, 1), p = clamp((uF - M.flee.d) / M.flee.dur, 0, 1);
        if (p > 0) { M.hd = fleePos(M, p, _fp); ax = _fp.x; ay = _fp.y; az = _fp.z; gT = p < 1 ? 1 : 0; M.hYt = 0; }
        else { wT = 1; M.hYt = Math.sin(now * 3 + M.m) * 0.9; }
        fade = Math.min(fade, 1 - sstep(0.9, 1, p)); if (T > F.t1) fade = 0;
        M.ph = (M.ph + rdt * 3.1) % 1;
      } else {
        // idle life in real time: sit (look around, scratch), now and then walk somewhere along the roof or the apron
        if (now > M.tEnd) {
          if (M.st === 'walk' || rnd(M.m, Math.floor(now * 7)) < 0.55 || !M.tEnd) { M.st = 'sit'; M.tEnd = now + 3 + 6 * Math.random(); M.scrOn = Math.random() < 0.45 ? 1 : 0; M.scrT = now + 0.8 + Math.random() * 2; }
          else { M.st = 'walk'; let t = M.u + (Math.random() < 0.5 ? -1 : 1) * (0.15 + 0.35 * Math.random()); if (t < 0.08 || t > 0.95) t = M.u - (t - M.u); M.tu = clamp(t, 0.08, 0.95); M.tEnd = now + 30; }
        }
        if (M.st === 'walk') { const v = 0.55 * S / Math.max(1, M.len), du = M.tu - M.u; wT = 1;
          if (Math.abs(du) < v * rdt + 1e-4) { M.u = M.tu; M.tEnd = now; } else if (M.w > 0.6) M.u += Math.sign(du) * v * rdt;
          const want = Math.atan2(dz, dx) + (du < 0 ? Math.PI : 0); let dh = want - M.hd; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); M.hd += dh * (1 - Math.exp(-rdt * 6));
          M.ph = (M.ph + rdt * 1.9) % 1; M.hYt = 0; }
        else { const want = Math.atan2(dz, dx) + (M.roof ? M.sitOff : 0); let dh = want - M.hd; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); M.hd += dh * (1 - Math.exp(-rdt * 1.5));
          if (now > M.hT) { M.hT = now + 0.6 + Math.random() * 2.2; M.hYt = (Math.random() - 0.5) * 2.2; } }
        if (M.scrOn && now > M.scrT) { M.scrOn = 0; }
      }
      M.w += (wT - M.w) * (1 - Math.exp(-rdt * 5)); M.g += (gT - M.g) * (1 - Math.exp(-rdt * 8)); M.scr += ((M.st === 'sit' && M.scrOn && !M.flee ? 1 : 0) - M.scr) * (1 - Math.exp(-rdt * 6));
      M.hY += (M.hYt - M.hY) * (1 - Math.exp(-rdt * 7));
      M.wx = ax; M.wy = ay + 0.02; M.wz = az; M.fade = fade;
      if (fade < 0.01) { for (let k = 0; k < NP; k++) troop.setMatrixAt(M.m * NP + k, ZERO); shadows.setMatrixAt(M.m, ZERO); continue; }
      drawMonkey(M, now, fade); n++;
    }
    troop.count = MS.length * NP; troop.visible = n > 0; troop.instanceMatrix.needsUpdate = true; fadeA.needsUpdate = true;
    shadows.count = MS.length; shadows.visible = n > 0; shadows.instanceMatrix.needsUpdate = true; shadows.instanceColor.needsUpdate = true;
  }

  let lastT = -1;
  return {
    state: () => ({ troop: troopS, show, walk: !!walkIM }),
    update(dt, now) {
      const list = Z.fx, T = Z.T; let fly = null, mk = null;
      if (list && list.length) for (const it of list) { if (!it) continue;
        if (it.kind === 'flypast' && !fly && T >= it.t0 - 1 && T <= it.t1 + 1) fly = it;
        else if (it.kind === 'monkeys' && !mk && T >= it.t0 && T <= Math.max(it.t1, it.flee ? it.flee.t1 : -1e9) + 1) mk = it; }
      const adv = T !== lastT; lastT = T;
      if (fly) {
        const s = Z.sun, sd = Z.sunDir; if (sd) trU.uSunDir.value.copy(sd);
        if (s) trU.uSunCol.value.copy(s.color).multiplyScalar(s.intensity / Math.PI * 0.95);
        const h = Z.hemi; if (h) { trU.uAmbT.value.copy(h.color).multiplyScalar(h.intensity * 0.55); trU.uAmbB.value.copy(h.groundColor).multiplyScalar(h.intensity * 0.5); }
        updFlypast(fly, dt, T);
      } else { jets.visible = false; trails.visible = false; show.bake = null; }
      if (mk) updMonkeys(mk, dt, now, T, adv); else { troop.visible = false; shadows.visible = false; troopS.id = null; }
    },
  };
};
