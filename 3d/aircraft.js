Z3MOD.aircraft = function (Z) {
  // Every aircraft and ground vehicle, and how they move. Procedural low-poly models, one InstancedMesh per family per
  // part, smoothed bank/pitch/gear from the sim's state machine, nav/beacon/strobe/landing lights as one Points draw,
  // a pooled particle system (tyre smoke, reverse-thrust haze, dust), and ground vehicles built from instanced boxes.
  const THREE = Z.THREE, D2R = Math.PI / 180, CAP = 500;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const angD = (a, b) => { let d = (b - a) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI; return d; };
  const sstep = u => u * u * (3 - 2 * u);
  const C = h => new THREE.Color(h);
  const COL = { white: C('#f2f3f5'), belly: C('#9da3aa'), wing: C('#c3c8ce'), wingB: C('#a9afb6'), eng: C('#d0d4d9'), engD: C('#1d2024'),
    exh: C('#5b6066'), strut: C('#a0a6ad'), tyre: C('#232528'), prop: C('#26292d'), spin: C('#e8eaec'), glass: C('#ffffff') };

  /* ---------------- geometry builder ---------------- */
  const Geo = () => ({ p: [], n: [], c: [], o: [0, 0, 0] });
  function put(g, P, N, c) { g.p.push(P[0], P[1], P[2]); g.n.push(N[0], N[1], N[2]); g.c.push(c.r, c.g, c.b); }
  function tri(g, A, B, Cc, col, nA, nB, nC) {
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = Cc[0] - A[0], vy = Cc[1] - A[1], vz = Cc[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-9) return;
    nx /= l; ny /= l; nz /= l;
    let rx, ry, rz;
    if (nA) { rx = nA[0] + nB[0] + nC[0]; ry = nA[1] + nB[1] + nC[1]; rz = nA[2] + nB[2] + nC[2]; }
    else { rx = (A[0] + B[0] + Cc[0]) / 3 - g.o[0]; ry = (A[1] + B[1] + Cc[1]) / 3 - g.o[1]; rz = (A[2] + B[2] + Cc[2]) / 3 - g.o[2]; }
    const cA = col.r !== undefined ? col : col[0], cB = col.r !== undefined ? col : col[1], cC = col.r !== undefined ? col : col[2];
    if (nx * rx + ny * ry + nz * rz < 0) { const fn = [-nx, -ny, -nz]; put(g, A, nA || fn, cA); put(g, Cc, nC || fn, cC); put(g, B, nB || fn, cB); }
    else { const fn = [nx, ny, nz]; put(g, A, nA || fn, cA); put(g, B, nB || fn, cB); put(g, Cc, nC || fn, cC); }
  }
  function quad(g, A, B, Cc, D, col, nA, nB, nC, nD) {
    if (col.r !== undefined) { tri(g, A, B, Cc, col, nA, nB, nC); tri(g, A, Cc, D, col, nA, nC, nD); }
    else { tri(g, A, B, Cc, [col[0], col[1], col[2]], nA, nB, nC); tri(g, A, Cc, D, [col[0], col[2], col[3]], nA, nC, nD); }
  }
  // a convex slab: 4 planform corners, thickness at each corner along axis ax (1 = y, 2 = z)
  function slab(g, pts, th, ax, col, colB) {
    const top = [], bot = []; let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < 4; i++) { const a = pts[i].slice(), b = pts[i].slice(); a[ax] += th[i] / 2; b[ax] -= th[i] / 2; top.push(a); bot.push(b); cx += pts[i][0] / 4; cy += pts[i][1] / 4; cz += pts[i][2] / 4; }
    g.o = [cx, cy, cz];
    quad(g, top[0], top[1], top[2], top[3], col); quad(g, bot[0], bot[1], bot[2], bot[3], colB || col);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(g, top[i], top[j], bot[j], bot[i], col); }
  }
  function box(g, cx, cy, cz, lx, ly, lz, col) {
    slab(g, [[cx + lx / 2, cy, cz - lz / 2], [cx - lx / 2, cy, cz - lz / 2], [cx - lx / 2, cy, cz + lz / 2], [cx + lx / 2, cy, cz + lz / 2]], [ly, ly, ly, ly], 1, col);
  }
  // body of revolution along x: rings [x, r], N segments, centre (cy, cz); optional end caps (dark colours)
  function revX(g, rings, cy, cz, N, col, capF, capB) {
    for (let i = 0; i < rings.length - 1; i++) {
      const [x0, r0] = rings[i], [x1, r1] = rings[i + 1]; const sl = (r0 - r1) / Math.max(1e-6, x0 - x1);
      for (let j = 0; j < N; j++) {
        const a0 = j / N * 2 * Math.PI, a1 = (j + 1) / N * 2 * Math.PI;
        const n0 = [-sl, Math.cos(a0), Math.sin(a0)], n1 = [-sl, Math.cos(a1), Math.sin(a1)];
        quad(g, [x0, cy + r0 * Math.cos(a0), cz + r0 * Math.sin(a0)], [x1, cy + r1 * Math.cos(a0), cz + r1 * Math.sin(a0)],
          [x1, cy + r1 * Math.cos(a1), cz + r1 * Math.sin(a1)], [x0, cy + r0 * Math.cos(a1), cz + r0 * Math.sin(a1)], col, n0, n0, n1, n1);
      }
    }
    const fan = (x, r, tipX, c) => { for (let j = 0; j < N; j++) { const a0 = j / N * 2 * Math.PI, a1 = (j + 1) / N * 2 * Math.PI; g.o = [x - (tipX - x) * 3, cy, cz];
      tri(g, [x, cy + r * Math.cos(a0), cz + r * Math.sin(a0)], [x, cy + r * Math.cos(a1), cz + r * Math.sin(a1)], [tipX, cy, cz], c); } };
    if (capF) fan(rings[0][0], rings[0][1] * capF.k, rings[0][0] + capF.d, capF.c);
    if (capB) { const l = rings[rings.length - 1]; fan(l[0], l[1] * capB.k, l[0] + capB.d, capB.c); }
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
  function toGeom(g) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, 3));
    geo.computeBoundingSphere(); return geo;
  }

  /* ---------------- aircraft families (reference type dimensions, metres) ---------------- */
  const FAMS = {
    nb: { L: 37.6, S: 35.8, W: 1.98, H: 2.03, yb: 1.6, tn: .14, tt: .7, N: 10, deck: 1,
      wing: { x: 3.6, y: 0.5, cr: 7.0, ct: 1.55, sw: 26, dh: 5.5, t: 0.9, kink: .36, wl: 2.3 },
      eng: [{ z: 5.75, r: 1.07, len: 4.7, fwd: 2.6, drop: 1.1 }],
      hs: { half: 6.3, cr: 3.8, ct: 1.4, sw: 31, dh: 6, te: 1.0, y: 0.2 }, fin: { cr: 6.4, ct: 2.3, h: 5.9, sw: 37, te: 0.8 },
      gear: { nx: 13.5, mains: [{ x: 0.8, z: 3.8, b: 1 }], r: 0.58, nr: 0.4 } },
    tp: { L: 27.2, S: 27.1, W: 1.32, H: 1.38, yb: 0.95, tn: .13, tt: .66, N: 10, deck: 1, high: 1,
      wing: { x: 1.9, y: 0, cr: 2.6, ct: 1.45, sw: 3, dh: 0.5, t: 0.42, kink: 0, wl: 0 },
      eng: [{ z: 4.05, r: 0.6, len: 5.0, fwd: 2.2, drop: 0.32, prop: 1.95 }],
      hs: { half: 3.9, cr: 2.1, ct: 1.25, sw: 12, dh: 0, te: 0.9, ttail: 1 }, fin: { cr: 4.8, ct: 2.4, h: 4.4, sw: 33, te: 0.6 },
      gear: { nx: 10.4, mains: [{ x: -0.9, z: 2.05, b: 1 }], r: 0.45, nr: 0.32, spon: 1 } },
    wb: { L: 66.8, S: 64.75, W: 2.98, H: 3.08, yb: 2.25, tn: .13, tt: .72, N: 12, deck: 1,
      wing: { x: 6.5, y: 0.6, cr: 13.2, ct: 2.7, sw: 31, dh: 5.5, t: 1.5, kink: .33, wl: 3.4 },
      eng: [{ z: 9.9, r: 1.55, len: 7.2, fwd: 4.0, drop: 1.6 }],
      hs: { half: 9.6, cr: 6.8, ct: 2.4, sw: 33, dh: 5, te: 1.6, y: 0.2 }, fin: { cr: 10.8, ct: 4.0, h: 9.0, sw: 40, te: 1.0 },
      gear: { nx: 26.6, mains: [{ x: -1.6, z: 5.4, b: 2 }], r: 0.66, nr: 0.55 } },
    a38: { L: 72.7, S: 79.75, W: 3.57, H: 4.2, yb: 2.2, tn: .15, tt: .71, N: 12, deck: 2,
      wing: { x: 9.5, y: 0.7, cr: 17.5, ct: 4.0, sw: 33.5, dh: 5.6, t: 2.0, kink: .3, wl: 2.2 },
      eng: [{ z: 14.5, r: 1.5, len: 7.0, fwd: 4.6, drop: 1.9 }, { z: 25.8, r: 1.45, len: 6.8, fwd: 4.0, drop: 1.6 }],
      hs: { half: 15.3, cr: 10.5, ct: 3.6, sw: 34, dh: 4, te: 1.8, y: 0.0 }, fin: { cr: 14.8, ct: 5.4, h: 12.6, sw: 41, te: 1.2 },
      gear: { nx: 29.0, mains: [{ x: -2.5, z: 6.2, b: 2 }, { x: -6.0, z: 2.3, b: 3 }], r: 0.7, nr: 0.6 } },
  };
  const FAMOF = { A20N: 'nb', A21N: 'nb', B38M: 'nb', AT76: 'tp', A359: 'wb', B788: 'wb', B789: 'wb', A333: 'wb', B77W: 'wb', A388: 'a38' };
  const FKEYS = ['nb', 'tp', 'wb', 'a38'];

  function ringAt(P, t) {
    const L = P.L, W = P.W, H = P.H, yc0 = P.yb + H, top0 = P.yb + 2 * H, x = L / 2 - t * L;
    if (t < P.tn) { const s = t / P.tn; const f = Math.max(0.06, Math.sqrt(Math.max(0, 1 - (1 - s) * (1 - s)))); return [x, yc0 - 0.38 * H * (1 - f), W * f, H * f]; }
    if (t > P.tt) { const s = (t - P.tt) / (1 - P.tt); const hh = H * (1 - 0.86 * Math.pow(s, 1.25)); const top = top0 - 0.22 * H * s; return [x, top - hh, W * (1 - 0.86 * Math.pow(s, 1.1)), hh]; }
    return [x, yc0, W, H];
  }
  const tOfX = (P, x) => clamp((P.L / 2 - x) / P.L, 0, 1);
  function surf(P, t, th, off) {
    const [x, yc, w, h] = ringAt(P, t), e = 0.004; const ra = ringAt(P, Math.max(0, t - e)), rb = ringAt(P, Math.min(1, t + e));
    const R = (w + h) / 2, dR = ((ra[2] + ra[3]) - (rb[2] + rb[3])) / 2 / Math.max(1e-6, ra[0] - rb[0]);
    let nx = -dR, ny = Math.cos(th) * R / h, nz = Math.sin(th) * R / w; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    return { p: [x + nx * off, yc + h * Math.cos(th) + ny * off, w * Math.sin(th) + nz * off], n: [nx, ny, nz] };
  }
  function patch(g, P, t0, t1, nt, thF, nth, off, col) { // thF(t,u) -> angle, u in 0..1
    for (let i = 0; i < nt; i++) for (let j = 0; j < nth; j++) {
      const ta = t0 + (t1 - t0) * i / nt, tb = t0 + (t1 - t0) * (i + 1) / nt, ua = j / nth, ub = (j + 1) / nth;
      const A = surf(P, ta, thF(ta, ua), off), B = surf(P, tb, thF(tb, ua), off), Cc = surf(P, tb, thF(tb, ub), off), D = surf(P, ta, thF(ta, ub), off);
      quad(g, A.p, B.p, Cc.p, D.p, col, A.n, B.n, Cc.n, D.n);
    }
  }
  function wingGeom(P) { // helpers shared by geometry and lights
    const w = P.wing, zr = P.high ? 0.2 : P.W * 0.6, half = P.S / 2 - (w.wl ? 0.15 : 0);
    const rootY = P.high ? P.yb + 2 * P.H + 0.05 : P.yb + w.y, tsw = Math.tan(w.sw * D2R), tdh = Math.tan(w.dh * D2R);
    const xLE = z => w.x - (z - zr) * tsw, yAt = z => rootY + (z - zr) * tdh;
    const zk = w.kink ? zr + w.kink * (half - zr) : zr, teIn = w.x - w.cr, ck = xLE(zk) - teIn;
    const chord = z => (z <= zk ? xLE(z) - teIn : ck + (w.ct - ck) * (z - zk) / (half - zk));
    return { zr, half, rootY, xLE, yAt, zk, chord };
  }

  function buildFamily(P) {
    const body = Geo(), liv = Geo(), glass = Geo(), gear = Geo(), prop = Geo(), N = P.N;
    const WG = wingGeom(P); P.WG = WG;
    // fuselage
    const ts = [];
    for (const s of [0, .07, .2, .42, .7, 1]) ts.push(s * P.tn);
    for (const s of [0, .2, .4, .6, .8, .93, 1]) ts.push(P.tt + s * (1 - P.tt));
    const ring = (t, j) => surf(P, t, j / N * 2 * Math.PI, 0);
    const vc = j => (Math.cos(j / N * 2 * Math.PI) < -0.45 ? COL.belly : COL.white);
    for (let i = 0; i < ts.length - 1; i++) for (let j = 0; j < N; j++) {
      const A = ring(ts[i], j), B = ring(ts[i + 1], j), Cc = ring(ts[i + 1], j + 1), D = ring(ts[i], j + 1);
      quad(body, A.p, B.p, Cc.p, D.p, [vc(j), vc(j), vc(j + 1), vc(j + 1)], A.n, B.n, Cc.n, D.n);
    }
    { const r0 = ringAt(P, 0), r1 = ringAt(P, 1);
      for (let j = 0; j < N; j++) { const A = ring(0, j), D = ring(0, j + 1); body.o = [r0[0] - 5, r0[1], 0]; tri(body, A.p, D.p, [r0[0] + 0.12, r0[1], 0], COL.white);
        const B = ring(1, j), Cc = ring(1, j + 1); body.o = [r1[0] + 5, r1[1], 0]; tri(body, B.p, Cc.p, [r1[0] - 0.3, r1[1], 0], COL.exh); } }
    // wing-body fairing / sponsons
    if (P.gear.spon) box(body, P.gear.mains[0].x - 0.3, P.yb + 0.35, 0, 4.6, 0.9, P.W * 2 + 0.7, COL.belly);
    else box(body, P.wing.x - P.wing.cr * 0.45, P.yb + 0.35, 0, P.wing.cr * 1.15, 0.9, P.W * 1.55, COL.belly);
    // wings
    for (const sgn of [-1, 1]) {
      const { zr, half, xLE, yAt, zk, chord } = WG, t = P.wing.t;
      const pt = (z, le) => [le ? xLE(z) : xLE(z) - chord(z), yAt(z), sgn * z];
      if (P.wing.kink) {
        slab(body, [pt(zr, 1), pt(zr, 0), pt(zk, 0), pt(zk, 1)], [t, t * 0.3, t * 0.2, t * 0.75], 1, COL.wing, COL.wingB);
        slab(body, [pt(zk, 1), pt(zk, 0), pt(half, 0), pt(half, 1)], [t * 0.75, t * 0.2, t * 0.08, t * 0.3], 1, COL.wing, COL.wingB);
      } else slab(body, [pt(zr, 1), pt(zr, 0), pt(half, 0), pt(half, 1)], [t, t * 0.35, t * 0.15, t * 0.6], 1, COL.wing, COL.wingB);
      if (P.wing.wl) { const h = P.wing.wl, ct = P.wing.ct, x0 = xLE(half), y0 = yAt(half);
        slab(liv, [[x0 - ct * 0.05, y0, sgn * half], [x0 - ct * 0.95, y0, sgn * half], [x0 - h * 0.65 - ct * 0.55, y0 + h, sgn * (half + h * 0.12)], [x0 - h * 0.65 - ct * 0.1, y0 + h, sgn * (half + h * 0.12)]],
          [0.16, 0.08, 0.05, 0.08], 2, COL.white); }
      // engines + pylons
      for (const E of P.eng) {
        const ez = sgn * E.z, x0 = xLE(E.z) + E.fwd, ey = yAt(E.z) - E.drop, r = E.r, len = E.len;
        if (E.prop) {
          revX(body, [[x0, r * 0.55], [x0 - 0.25 * len, r], [x0 - 0.75 * len, r * 0.9], [x0 - len, r * 0.35]], ey, ez, 8, COL.eng, null, { k: 1, d: -0.3, c: COL.exh });
          revX(body, [[x0 + 0.7, 0.02], [x0 + 0.35, r * 0.4], [x0, r * 0.55]], ey, ez, 8, COL.spin);
          for (let b = 0; b < 6; b++) { const a = b / 6 * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a), pa = -sa, pb = ca, R = E.prop;
            const w0 = 0.16, w1 = 0.1; const P0 = [0.02, ca * 0.25 + pa * w0, sa * 0.25 + pb * w0], P1 = [0.02, ca * R + pa * w1, sa * R + pb * w1], P2 = [-0.02, ca * R - pa * w1, sa * R - pb * w1], P3 = [-0.02, ca * 0.25 - pa * w0, sa * 0.25 - pb * w0];
            prop.o = [-5, 0, 0]; quad(prop, P0, P1, P2, P3, COL.prop); }
          E.px = x0 + 0.3; E.py = ey;
        } else {
          revX(body, [[x0, r * 0.9], [x0 - 0.3 * len, r], [x0 - 0.8 * len, r * 0.8], [x0 - len, r * 0.62]], ey, ez, 8, COL.eng,
            { k: 0.92, d: -0.5 * r, c: COL.engD }, { k: 1, d: -0.55 * r, c: COL.exh });
          const wy = yAt(E.z), c = chord(E.z);
          slab(body, [[x0 - 0.15 * len, ey + r * 0.6, ez], [x0 - 0.95 * len, ey + r * 0.6, ez], [xLE(E.z) - c * 0.7, wy - 0.05, ez], [xLE(E.z) + 0.3, wy - 0.05, ez]],
            [r * 0.28, r * 0.22, r * 0.18, r * 0.2], 2, COL.wingB);
        }
        E.x0 = x0; E.ey = ey;
      }
    }
    // tailplane, fin
    const fin = P.fin, finTE = -P.L / 2 + fin.te, finLE = finTE + fin.cr, rmid = ringAt(P, tOfX(P, (finLE + finTE) / 2));
    const finY = rmid[1] + rmid[3] - 0.25, ftLE = finLE - Math.tan(fin.sw * D2R) * fin.h, finTop = finY + fin.h;
    slab(liv, [[finLE, finY, 0], [finTE, finY, 0], [ftLE - fin.ct, finTop, 0], [ftLE, finTop, 0]], [fin.cr * 0.07, 0.12, 0.08, fin.ct * 0.08], 2, COL.white);
    // dorsal fillet in livery colour too
    slab(liv, [[finLE + fin.cr * 0.45, finY + 0.05, 0], [finLE - 0.1, finY + 0.05, 0], [finLE - fin.h * 0.25 * Math.tan(fin.sw * D2R) - 0.3, finY + fin.h * 0.25, 0], [finLE - fin.h * 0.25 * Math.tan(fin.sw * D2R), finY + fin.h * 0.25, 0]], [0.25, 0.25, 0.1, 0.1], 2, COL.white);
    P.finTop = finTop; P.tailX = -P.L / 2;
    const hs = P.hs; let hsY, hsTE, hsLE;
    if (hs.ttail) { hsY = finTop - 0.1; hsLE = ftLE + 0.2; hsTE = hsLE - hs.cr; }
    else { hsTE = -P.L / 2 + hs.te; hsLE = hsTE + hs.cr; const rr = ringAt(P, tOfX(P, (hsLE + hsTE) / 2)); hsY = rr[1] + hs.y * rr[3]; }
    for (const sgn of [-1, 1]) { const tLE = hsLE - Math.tan(hs.sw * D2R) * hs.half, ty = hsY + Math.tan(hs.dh * D2R) * hs.half;
      slab(body, [[hsLE, hsY, 0], [hsTE, hsY, 0], [tLE - hs.ct, ty, sgn * hs.half], [tLE, ty, sgn * hs.half]], [hs.cr * 0.09, 0.08, 0.05, hs.ct * 0.08], 1, COL.wing, COL.wingB); }
    // livery cheatline: a band below the windows that sweeps up into the fin
    const cl = (t, u) => { const s = clamp((t - P.tt) / (1 - P.tt), 0, 1); const c = (P.deck === 2 ? 92 : 84) - 52 * s, hw = 7 + 5 * s; return (c - hw + 2 * hw * u) * D2R; };
    for (const sgn of [-1, 1]) patch(liv, P, P.tn * 0.75, 0.985, 12, (t, u) => sgn * cl(t, u), 1, 0.03, COL.white);
    // glass: cockpit windscreen band, cabin window lines
    patch(glass, P, P.tn * 0.36, P.tn * 0.54, 1, (t, u) => (-62 + 124 * u) * D2R, 6, 0.03, COL.glass);
    const wl = P.deck === 2 ? [[47, 51], [70, 73]] : P.high ? [[64, 70]] : [[60, 65]];
    for (const sgn of [-1, 1]) for (const [a, b] of wl) patch(glass, P, P.tn * 1.05, P.tt + (1 - P.tt) * 0.22, 2, (t, u) => sgn * (a + (b - a) * u) * D2R, 1, 0.025, COL.glass);
    // landing gear: legs, wheels; retracts about the belly
    const G = P.gear, gTop = P.high ? P.yb + 0.3 : WG.rootY - 0.1;
    box(gear, G.nx, G.nr, 0, 0.22, P.yb + 0.25 - G.nr, 0.22, COL.strut);
    cylZ(gear, G.nx, G.nr, 0, G.nr, 0.75, 6, COL.tyre);
    for (const M of G.mains) for (const sgn of [-1, 1]) {
      const z = sgn * M.z, top = M.z < P.W ? P.yb + 0.3 : gTop;
      box(gear, M.x, G.r, z, 0.32, top - G.r, 0.32, COL.strut);
      if (M.b === 1) cylZ(gear, M.x, G.r, z, G.r, 1.0, 6, COL.tyre);
      else { const sp = M.b === 3 ? 1.5 : 1.4; for (let k = 0; k < M.b; k++) cylZ(gear, M.x + (k - (M.b - 1) / 2) * sp, G.r, z, G.r, 1.25, 6, COL.tyre);
        box(gear, M.x, G.r - 0.12, z, sp * (M.b - 1) + 0.4, 0.24, 0.3, COL.strut); }
    }
    P.pv = Math.min(...G.mains.map(m => m.x)); P.gy = P.yb + 0.3 * P.H;
    // light points (local, unscaled)
    const tipX = WG.xLE(WG.half) - P.wing.ct * 0.15, tipY = WG.yAt(WG.half) + 0.05, rt = ringAt(P, 1);
    P.LP = { tipX, tipY, tipZ: WG.half + 0.05, tailX: rt[0] - 0.15, tailY: rt[1], topX: P.wing.x - P.wing.cr * 0.3, topY: P.yb + 2 * P.H + 0.12,
      botX: P.wing.x - P.wing.cr * 0.75, botY: P.yb - 0.05, noseX: G.nx + 0.4, noseY: P.yb * 0.8, rootX: P.wing.x + 0.2, rootY: WG.rootY, rootZ: P.W + 1.2 };
    return { body: toGeom(body), liv: toGeom(liv), glass: toGeom(glass), gear: toGeom(gear), prop: prop.p.length ? toGeom(prop) : null };
  }

  /* ---------------- meshes ---------------- */
  const root = new THREE.Group(); root.name = 'aircraft'; Z.scene.add(root);
  const matBody = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.12 });
  const matLiv = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 });
  const matGlass = new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.18, metalness: 0.5, emissive: 0xffc27a, emissiveIntensity: 0 });
  const matGear = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.2 });
  const matProp = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
  const IM = (geo, mat, cap, shadow) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.frustumCulled = false; m.castShadow = !!shadow; m.receiveShadow = !!shadow; m.count = 0;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(m); return m; };
  const WHITE = C('#ffffff');
  const MESH = {};
  for (const k of FKEYS) {
    const P = FAMS[k], g = buildFamily(P);
    const liv = new THREE.InstancedMesh(g.liv, matLiv, CAP); for (let i = 0; i < CAP; i++) liv.setColorAt(i, WHITE);
    liv.frustumCulled = false; liv.castShadow = true; liv.receiveShadow = true; liv.instanceMatrix.setUsage(THREE.DynamicDrawUsage); liv.count = 0; root.add(liv);
    MESH[k] = { body: IM(g.body, matBody, CAP, true), liv, glass: IM(g.glass, matGlass, CAP, false), gear: IM(g.gear, matGear, CAP, true),
      prop: g.prop ? IM(g.prop, matProp, CAP * 2, false) : null, P, tris: g.body.attributes.position.count / 3 };
  }
  const tailCol = {}; for (const k in Z.AL) tailCol[k] = C(Z.AL[k].tail || '#888888');
  const tailColDef = C('#777777');

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
  const cnt = { nb: 0, tp: 0, wb: 0, a38: 0 }, gcnt = { nb: 0, tp: 0, wb: 0, a38: 0 }, pcnt = { nb: 0, tp: 0, wb: 0, a38: 0 };
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
      const rdt = Math.min(dt, 0.1), pdt = dts > 0 ? rdt : 0;
      const sm = (tS, tR) => 1 - Math.exp(-Math.min(dts / tS, rdt / tR));
      const cam = Z.camera, pxs = Z.renderer.domElement.height / (2 * Math.tan(cam.fov * D2R / 2));
      lU.pxs.value = pxs; pU.pxs.value = pxs;
      const fog = Z.scene.fog; if (fog) { lU.fogN.value = fog.near * 1.5; lU.fogF.value = fog.far * 1.6; }
      pU.lum.value = 0.28 + 0.72 * (1 - NF);
      matGlass.emissiveIntensity = NF * 0.9;
      for (let j = 0; j < 4; j++) { const kk = FKEYS[j]; cnt[kk] = 0; gcnt[kk] = 0; pcnt[kk] = 0; }
      nL = 0; nB = 0; nBird = 0;
      const nav = 0.18 + 0.95 * NF, navS = (0.8 + 2.4 * NF) * k;
      for (let i = 0; i < F.length; i++) {
        const f = F[i], s = f.state; if (SKIP[s]) continue;
        const fam = FAMOF[f.type] || 'nb', M = MESH[fam], P = M.P;
        if (cnt[fam] >= CAP) continue;
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
        const sx = f.T.len / P.L, sz = f.T.span / P.S, sy = (sx + sz) / 2, yaw = -f.heading;
        _e.set(st.bank, yaw, st.pitch); _q.setFromEuler(_e); _e.set(0, yaw, 0); _qy.setFromEuler(_e);
        _v1.set(P.pv * sx * k, 0, 0); _v2.copy(_v1).applyQuaternion(_q); _v1.applyQuaternion(_qy);
        _p.set(f.x + _v1.x - _v2.x, alt + _v1.y - _v2.y, f.y + _v1.z - _v2.z); _s.set(sx * k, sy * k, sz * k);
        _m.compose(_p, _q, _s);
        const idx = cnt[fam]++;
        M.body.setMatrixAt(idx, _m); M.liv.setMatrixAt(idx, _m); M.glass.setMatrixAt(idx, _m); M.liv.setColorAt(idx, tailCol[f.al] || tailColDef);
        if (st.gear > 0.01) { const g = sstep(clamp(st.gear, 0, 1)); _mr.makeScale(1, g, 1); _mr.elements[13] = P.gy * (1 - g); _mg.multiplyMatrices(_m, _mr); M.gear.setMatrixAt(gcnt[fam]++, _mg); }
        const run = !OFF[s];
        if (M.prop) {
          const tgt = !run || s === 'push' ? 0 : s === 'start' ? clamp((T - (f.startT || T)) / 18, 0, 1) : 1;
          st.spool += (tgt - st.spool) * (1 - Math.exp(-dt / 2.5)); st.prop += dt * 26 * st.spool;
          for (let e = 0; e < P.eng.length; e++) { const E = P.eng[e]; for (let sg = -1; sg <= 1; sg += 2) {
            _mr.makeRotationX(st.prop + sg); _mr.setPosition(E.px, E.py, sg * E.z); _mg.multiplyMatrices(_m, _mr); M.prop.setMatrixAt(pcnt[fam]++, _mg); } }
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
            for (let j = 0; j < 16; j++) { const Mg = P.gear.mains[j % P.gear.mains.length], sg = (j >> 1) % 2 ? 1 : -1, u = (j >> 2) / 3;
              lw(Mg.x, 0.6, sg * Mg.z); const r = Math.random();
              emit(_v.x - dx * (1 - u) + (r - 0.5) * 3, _v.y, _v.z - dz * (1 - u) + (Math.random() - 0.5) * 2, hc * 4 + (r - 0.5) * 2, 0.8 + r * 1.2, hs * 4 + (Math.random() - 0.5) * 2,
                1.8 + r * 1.0, 1.8 * k, (10 + r * 7) * k, 0.6, 0.93, 0.93, 0.91, 0.9); }
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
            st.acc += pdt * 70;
            while (st.acc >= 1) { st.acc -= 1; const E = P.eng[0], sg = Math.random() < 0.5 ? -1 : 1;
              lw(E.x0 - E.len - 3, 0.6, sg * E.z * (0.6 + Math.random() * 0.8)); const r = Math.random();
              emit(_v.x, Math.max(0.5, _v.y - alt), _v.z, -hc * (8 + r * 8), 1.5 + r * 2, -hs * (8 + r * 8), 2.2 + r * 1.4, 5 * k, (22 + r * 16) * k, 0.3, 0.74, 0.6, 0.44, 0.8); }
          }
        }
        // ---- ground support ----
        if ((s === 'at_gate' && T < f.readyAt) || (s === 'parked' && f.inBlock != null && T < f.inBlock + 900)) {
          const ib = f.inBlock != null ? f.inBlock : -1e9, ra = s === 'at_gate' ? f.readyAt : ib + 900, id = f.id;
          const uI = d => (ib < -1e8 ? 1 : clamp((T - ib - d) / 30, 0, 1)), uO = lead => clamp((T - (ra - lead)) / 30, 0, 1);
          gse(f, sx, sz, k, 'belt', P.gear.nx * 0.5, P.W + 4.4, -Math.PI / 2, uI(15), uO(150), id, (P.yb + 0.3 * P.H) * sy);
          const lift = Math.max(0, (P.yb + 0.75 * P.H) * sy - 1.3), le = Math.min(clamp((T - ib - 95) / 35, 0, 1), 1 - clamp((T - (ra - 360)) / 35, 0, 1));
          gse(f, sx, sz, k, 'cater', -P.L * 0.37, P.W + 3.7, Math.PI / 2, uI(40), uO(300), id + 1, lift * (ib < -1e8 ? 1 : le));
          if (s === 'at_gate') { const E = P.eng[0], lz = E.z + E.r + 3.2; gse(f, sx, sz, k, 'bowser', P.WG.xLE(lz) + 5.5, lz, 0, uI(70), uO(420), id + 2, 0); }
        }
        if (f.gate && f.gate.remote && (s === 'at_gate' || s === 'parked')) {
          const ib = f.inBlock != null ? f.inBlock : -1e9, go = s === 'at_gate' ? Math.max(f.std || 0, f.readyAt || 0) : -1e9;
          if (ib > -1e8 && T < ib + 420) gse(f, sx, sz, k, 'bus', P.gear.nx * 0.42, -(P.W + 7), 0, clamp((T - ib - 10) / 30, 0, 1), clamp((T - ib - 390) / 30, 0, 1), f.id + 3, 0);
          else if (s === 'at_gate' && T > f.readyAt - 480 && T < go + 30) gse(f, sx, sz, k, 'bus', P.gear.nx * 0.42, -(P.W + 7), 0, clamp((T - (f.readyAt - 480)) / 30, 0, 1), clamp((T - go) / 30, 0, 1), f.id + 3, 0);
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
      for (let j = 0; j < 4; j++) {
        const kk = FKEYS[j], M = MESH[kk], n = cnt[kk];
        M.body.count = n; M.liv.count = n; M.glass.count = n; M.body.visible = M.liv.visible = M.glass.visible = n > 0;
        M.gear.count = gcnt[kk]; M.gear.visible = gcnt[kk] > 0;
        if (n) { M.body.instanceMatrix.needsUpdate = true; M.liv.instanceMatrix.needsUpdate = true; M.glass.instanceMatrix.needsUpdate = true; M.liv.instanceColor.needsUpdate = true; }
        if (gcnt[kk]) M.gear.instanceMatrix.needsUpdate = true;
        if (M.prop) { M.prop.count = pcnt[kk]; M.prop.visible = pcnt[kk] > 0; if (pcnt[kk]) M.prop.instanceMatrix.needsUpdate = true; }
      }
      boxes.count = nB; boxes.visible = nB > 0; if (nB) { boxes.instanceMatrix.needsUpdate = true; boxes.instanceColor.needsUpdate = true; }
      birds.count = nBird; birds.visible = nBird > 0; if (nBird) birds.instanceMatrix.needsUpdate = true;
      if (now - cleanT > 2) { cleanT = now; mem.forEach(cleaner); }
    },
  };
};
