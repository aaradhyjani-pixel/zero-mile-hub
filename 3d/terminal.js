Z3MOD.terminal = function (Z) {
  // The terminal: one continuous roof (the seven-lobed Hall, the Mall, twelve piers), its glass, jaali screens,
  // gardens, the stepwell forecourt, the other buildings and the aerobridges. World (x east, y south) -> (X, Y up, Z).
  const THREE = Z.THREE, SPEC = Z.SPEC, RF = SPEC.roof || {}, PI = Math.PI, TAU = 2 * PI;
  const group = new THREE.Group(); group.name = 'terminal'; Z.scene.add(group);
  const NEG = -1e9, OV = 7, TH = 2.6;
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
    if (!box.noBottom) face(A, [P(-hx, 0, -hz), P(hx, 0, -hz), P(hx, 0, hz), P(-hx, 0, hz)], c, null, gl, [0, -1, 0]);
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
    g.setAttribute('glow', new THREE.Float32BufferAttribute(A.g, 1)); if (A.t && A.t.length === A.g.length * 4) g.setAttribute('tang', new THREE.Float32BufferAttribute(A.t, 4));
    g.setIndex(A.i); g.computeBoundingSphere(); return g;
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
  // cladding for the other buildings: white with faint seams and panel-to-panel tone (vertex colour tints it)
  const seamT = (() => { const [c, x] = canvas(256, 256); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const v = 238 + rnd() * 17 | 0; x.fillStyle = `rgb(${v},${v},${v - 2})`; x.fillRect(i * 64, j * 128, 64, 128); }
    for (let k = 0; k < 900; k++) { x.fillStyle = `rgba(120,110,90,${0.02 + rnd() * 0.03})`; x.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
    x.fillStyle = 'rgba(95,90,82,0.5)'; x.fillRect(0, 0, 256, 3); x.fillRect(0, 0, 3, 256);
    x.fillStyle = 'rgba(95,90,82,0.28)'; x.fillRect(0, 127, 256, 2); for (let i = 1; i < 4; i++) x.fillRect(i * 64, 0, 2, 256);
    return tex(c, true); })();
  // height canvas -> tangent-space normal map (linear)
  function normalFrom(hc, k) {
    const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
    const [c, x] = canvas(w, h), out = x.createImageData(w, h), d = out.data;
    const Hh = (i, j) => src[((((j + h) % h) * w) + ((i + w) % w)) * 4] / 255;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const dx = (Hh(i + 1, j) - Hh(i - 1, j)) * k, dy = (Hh(i, j + 1) - Hh(i, j - 1)) * k, L = Math.hypot(dx, dy, 1), o = (j * w + i) * 4;
      d[o] = (-dx / L * 0.5 + 0.5) * 255; d[o + 1] = (dy / L * 0.5 + 0.5) * 255; d[o + 2] = (1 / L * 0.5 + 0.5) * 255; d[o + 3] = 255; }
    x.putImageData(out, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; return t;
  }
  // the roof: ceramic-white standing-seam panels. Strong seams run down the slope (texture u), staggered cross joints,
  // a slight tone and roughness change panel to panel, faint brushing along the seams. Map + normal + roughness.
  const roofT = (() => {
    const S = 1024, NC = 8, NR = 4, cw = S / NC, rh = S / NR;
    const [c, x] = canvas(S, S), [hc, hx] = canvas(S, S), [rc, rx] = canvas(S, S);
    hx.fillStyle = '#808080'; hx.fillRect(0, 0, S, S);
    for (let i = 0; i < NC; i++) {
      const tones = [], rus = [], cb = i % 2 ? 0.9 : 1; for (let r = 0; r < NR; r++) { tones.push(cb * (0.93 + rnd() * 0.07)); rus.push((i % 2 ? 0.22 : 0.4) + rnd() * 0.14); }
      for (let r = -1; r <= NR; r++) {
        const rr = ((r % NR) + NR) % NR, y0 = r * rh + (i % 2) * rh / 2, x0 = i * cw, tn = tones[rr], wm = (rnd() - 0.5) * 0.025;
        x.fillStyle = `rgb(${255 * tn * (1 + wm) | 0},${255 * tn | 0},${255 * tn * (1 - wm) | 0})`; x.fillRect(x0, y0, cw, rh);
        rx.fillStyle = `rgb(0,${rus[rr] * 255 | 0},0)`; rx.fillRect(x0, y0, cw, rh);
        // a very slight pillow in each panel
        const g = hx.createLinearGradient(x0, 0, x0 + cw, 0); g.addColorStop(0, '#7a7a7a'); g.addColorStop(0.5, '#868686'); g.addColorStop(1, '#7a7a7a'); hx.fillStyle = g; hx.fillRect(x0, y0, cw, rh);
        // cross joint
        x.fillStyle = 'rgba(80,76,70,0.45)'; x.fillRect(x0, y0, cw, 2); hx.fillStyle = '#505050'; hx.fillRect(x0, y0, cw, 2); rx.fillStyle = 'rgb(0,170,0)'; rx.fillRect(x0, y0, cw, 2);
      }
      for (let k = 0; k < 70; k++) { const a = rnd() * 0.05; x.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(90,85,80,${a})`; x.fillRect(i * cw + rnd() * cw, 0, 1 + rnd() * 2, S); }
      // standing seam: a raised rib with a shadow line and a highlight
      x.fillStyle = 'rgba(60,58,55,0.7)'; x.fillRect(i * cw, 0, 6, S); x.fillStyle = 'rgba(255,255,255,0.8)'; x.fillRect(i * cw + 6, 0, 3, S);
      hx.fillStyle = '#e0e0e0'; hx.fillRect(i * cw - 1, 0, 10, S); rx.fillStyle = 'rgb(0,120,0)'; rx.fillRect(i * cw, 0, 9, S);
    }
    const m = tex(c, true), n = normalFrom(hc, 6), r = new THREE.CanvasTexture(rc); r.wrapS = r.wrapT = THREE.RepeatWrapping; r.anisotropy = aniso;
    return { m, n, r };
  })();
  // the soffit: warm engineered-bamboo slats with nodes (Bengaluru's lattice ceiling)
  const bambooT = (() => {
    const S = 512, N = 16, sw = S / N, [c, x] = canvas(S, S), [hc, hx] = canvas(S, S);
    x.fillStyle = '#2a1c10'; x.fillRect(0, 0, S, S); hx.fillStyle = '#000'; hx.fillRect(0, 0, S, S);
    for (let k = 0; k < N; k++) {
      const x0 = k * sw + 2, w = sw - 6, tn = 0.85 + rnd() * 0.25;
      x.fillStyle = `rgb(${200 * tn | 0},${150 * tn | 0},${92 * tn | 0})`; x.fillRect(x0, 0, w, S);
      for (let q = 0; q < 30; q++) { x.fillStyle = `rgba(${120 + rnd() * 60 | 0},${80 + rnd() * 40 | 0},40,${0.08 + rnd() * 0.1})`; x.fillRect(x0 + rnd() * w, 0, 1, S); }
      for (let q = 0; q < 3; q++) { const y = rnd() * S; x.fillStyle = 'rgba(90,60,30,0.55)'; x.fillRect(x0, y, w, 3); }
      const g = hx.createLinearGradient(x0, 0, x0 + w, 0); g.addColorStop(0, '#606060'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#606060'); hx.fillStyle = g; hx.fillRect(x0, 0, w, S);
    }
    return { m: tex(c, true), n: normalFrom(hc, 4) };
  })();
  // ripples for the stepwell pool
  const rippleN = (() => { const S = 256, [c, x] = canvas(S, S); x.fillStyle = '#808080'; x.fillRect(0, 0, S, S);
    for (let k = 0; k < 260; k++) { const px = rnd() * S, py = rnd() * S, r = 6 + rnd() * 22, g = x.createRadialGradient(px, py, 0, px, py, r), v = rnd() < 0.5 ? 255 : 0;
      g.addColorStop(0, `rgba(${v},${v},${v},0.16)`); g.addColorStop(1, `rgba(${v},${v},${v},0)`); for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { x.save(); x.translate(ox, oy); x.fillStyle = g; x.fillRect(px - r, py - r, 2 * r, 2 * r); x.restore(); } }
    return normalFrom(c, 3); })();
  // jaali: an abstract branching lattice. Top half 'tree', bottom half the denser 'tree-of-life'. Alpha = stone.
  const jaaliT = (() => {
    const W = 512, [c, x] = canvas(W, 1024);
    function half(y0, dense) {
      x.save(); x.beginPath(); x.rect(0, y0, W, 512); x.clip();
      x.globalCompositeOperation = 'source-over'; x.fillStyle = '#c9a77a'; x.fillRect(0, y0, W, 512);
      for (let k = 0; k < 1400; k++) { x.fillStyle = `rgba(${90 + rnd() * 60},${70 + rnd() * 40},40,${0.06 + rnd() * 0.08})`; x.fillRect(rnd() * W, y0 + rnd() * 512, 3, 3); }
      // perforation lattice (diamonds)
      x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000'; const P = dense ? 26 : 34, hs = dense ? 10.5 : 14;
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
        if (dense && depth < 3) { x.save(); x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000'; x.beginPath(); x.ellipse(ex, ey, 5, 9, ang, 0, TAU); x.fill(); x.restore(); }
      }
      br(W / 2, y0 + 500, -PI / 2, dense ? 120 : 140, dense ? 26 : 22, dense ? 6 : 5);
      if (dense) { br(W / 2, y0 + 500, -PI / 2 - 0.9, 90, 14, 4); br(W / 2, y0 + 500, -PI / 2 + 0.9, 90, 14, 4); }
      // frame: posts at the tile edges, sill and head bands
      x.fillStyle = '#bf9c6e'; x.fillRect(0, y0, 14, 512); x.fillRect(W - 14, y0, 14, 512); x.fillRect(0, y0, W, 18); x.fillRect(0, y0 + 494, W, 18);
      x.restore();
    }
    half(0, false); half(512, true);
    const t = tex(c, false); t.wrapS = THREE.RepeatWrapping;
    // carved relief: height from the stone's alpha, softened so the edges read as chamfers
    const [hc, hx] = canvas(256, 512); hx.fillStyle = '#000'; hx.fillRect(0, 0, 256, 512); hx.filter = 'blur(1.5px)'; hx.drawImage(c, 0, 0, 256, 512);
    const id = hx.getImageData(0, 0, 256, 512); for (let k = 0; k < id.data.length; k += 4) { const a = id.data[k + 3]; id.data[k] = id.data[k + 1] = id.data[k + 2] = a; id.data[k + 3] = 255; } hx.putImageData(id, 0, 0);
    t.userData.n = normalFrom(hc, 5); t.userData.n.wrapT = THREE.ClampToEdgeWrapping; return t;
  })();

  // ------------------------------------------------------------ materials
  function glowify(m, key) {
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlow;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vGlow;');
    };
    m.customProgramCacheKey = () => key; return m;
  }
  // selective instance colour + per-part roughness/metalness, keyed by the 'glow' attribute:
  // 0 = body (R[0], Mt[0]), 1 = glass (R[1], Mt[1]), 2 = takes the instance colour (R[2], Mt[2], emissive E)
  function selInst(m, key, R, Mt, E) {
    const f = v => v.toFixed(3);
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vSel;')
        .replace('#include <color_vertex>', 'vColor = vec3(1.0);\n#ifdef USE_COLOR\nvColor *= color;\n#endif\nvSel = glow;\n#ifdef USE_INSTANCING_COLOR\nif (glow > 1.5) vColor.xyz *= instanceColor.xyz;\n#endif');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSel;')
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = vSel < 0.5 ? ${f(R[0])} : (vSel < 1.5 ? ${f(R[1])} : ${f(R[2])});`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\nmetalnessFactor = vSel < 0.5 ? ${f(Mt[0])} : (vSel < 1.5 ? ${f(Mt[1])} : ${f(Mt[2])});`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += step(1.5, vSel) * diffuseColor.rgb * ${f(E || 0)};`);
    };
    m.customProgramCacheKey = () => key; return m;
  }
  // curtain-wall glass: a mullion grid, low-iron glass reflecting the sky, and behind it a lit interior faked by
  // ray-casting a box room in the shader (mezzanine slab, polished floor with people and coloured coffer light,
  // bamboo soffit with peacock lenses, white tree columns, lit shopfronts and the art wall at the back)
  const glassU = { uGI: { value: 1 } };
  const GLSL_INT = `
uniform float uGI;
varying vec3 vGW; varying vec3 vGN; varying vec4 vGT;
float gh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 pea(float h) { h = fract(h) * 6.0;
  return h < 1.0 ? vec3(0.06, 0.5, 0.48) : h < 2.0 ? vec3(0.9, 0.62, 0.12) : h < 3.0 ? vec3(0.12, 0.3, 0.8) : h < 4.0 ? vec3(0.55, 0.18, 0.62) : h < 5.0 ? vec3(0.2, 0.62, 0.22) : vec3(0.88, 0.3, 0.16); }
float gFrame() {
  float u = vGT.y, y = vGW.y; vec2 fw = max(fwidth(vec2(u, y)), vec2(1e-4));
  float dm = abs(fract(u / 3.0 + 0.5) - 0.5) * 3.0, dt = abs(fract((y - 0.2) / 4.5 + 0.5) - 0.5) * 4.5;
  float m = 1.0 - smoothstep(0.075, 0.075 + fw.x, dm), t = 1.0 - smoothstep(0.1, 0.1 + fw.y, dt);
  m = mix(m, 0.05, smoothstep(0.08, 0.5, fw.x)); t = mix(t, 0.045, smoothstep(0.1, 0.6, fw.y));
  float sill = 1.0 - smoothstep(0.7, 0.7 + fw.y, y), head = smoothstep(vGT.w - 0.6 - fw.y, vGT.w - 0.6, y);
  return clamp(max(max(m, t), max(sill, head)), 0.0, 1.0);
}
vec3 gInterior() {
  vec3 V = normalize(vGW - cameraPosition), N = normalize(vGN), T = normalize(vec3(vGT.x, 0.0, vGT.z));
  float rw = max(dot(V, -N), 0.03), ru = dot(V, T), ry = V.y, u0 = vGT.y, y0 = vGW.y, top = vGT.w;
  const float SLAB = 7.0, EDGE = 6.0, BACK = 32.0, COLW = 13.0, COLS = 18.0;
  float t = BACK / rw; int kind = 0;
  if (ry < 0.0) { float tf = (0.0 - y0) / ry; if (tf < t) { t = tf; kind = 1; } }
  if (y0 < SLAB - 0.6 && ry > 0.0) { float ts = (SLAB - 0.6 - y0) / ry; if (ts < t && rw * ts > EDGE) { t = ts; kind = 2; } }
  if (y0 > SLAB && ry < 0.0) { float ts = (SLAB - y0) / ry; if (ts < t && rw * ts > EDGE) { t = ts; kind = 3; } }
  float te = EDGE / rw, ye = y0 + ry * te; if (te < t && ye > SLAB - 0.8 && ye < SLAB + 1.1) { t = te; kind = 6; }
  float den = ry - 0.16 * rw; if (den > 0.0) { float tc = (top + 1.5 - y0) / den; if (tc < t) { t = tc; kind = 4; } }
  float tcol = COLW / rw, uc = u0 + ru * tcol, yc = y0 + ry * tcol, cu = (floor(uc / COLS) + 0.5) * COLS;
  float hd = abs(uc - cu) * rw / max(length(vec2(ru, rw)), 1e-3), cr = 0.85 + 0.03 * pow(max(yc - SLAB - 2.0, 0.0), 2.0);
  if (tcol < t && hd < cr && yc > 0.0) { t = tcol; kind = 5; }
  vec3 P = vec3(u0 + ru * t, y0 + ry * t, rw * t);
  vec3 c;
  if (kind == 1 || kind == 3) {
    c = kind == 1 ? vec3(0.34, 0.29, 0.23) : vec3(0.4, 0.33, 0.25);
    vec2 l = P.xz / 7.0, lf = fract(l) - 0.5; float hl = gh(floor(l) + 3.1);
    c += pea(hl) * 0.45 * (1.0 - smoothstep(0.08, 0.3, length(lf))) * step(0.35, hl);
    vec2 g = P.xz / 1.6, gf = fract(g) - 0.5; float hp = gh(floor(g) + (kind == 3 ? 17.0 : 0.0));
    if (hp < 0.2) c = mix(mix(vec3(0.03), pea(hp * 9.7) * 0.6, step(0.06, hp)), c, smoothstep(0.16, 0.24, length(gf)));
  } else if (kind == 2) {
    vec2 lf = fract(P.xz / 3.0) - 0.5;
    c = vec3(0.32, 0.22, 0.13) * (0.85 + 0.15 * sin(P.x * 9.0)) + vec3(2.2, 1.8, 1.3) * (1.0 - smoothstep(0.04, 0.1, length(lf)));
  } else if (kind == 4) {
    c = vec3(0.46, 0.32, 0.17) * (0.8 + 0.2 * sin(P.x * 7.0));
    vec2 l = P.xz / vec2(9.0, 8.0), lf = fract(l) - 0.5;
    c = mix(c, pea(gh(floor(l))) * 1.8 + 0.25, 1.0 - smoothstep(0.13, 0.2, length(lf)));
  } else if (kind == 5) {
    float s = (uc - cu) / max(cr, 0.01);
    c = vec3(0.86, 0.84, 0.8) * (0.45 + 0.55 * sqrt(max(1.0 - s * s, 0.0)));
  } else if (kind == 6) {
    c = P.y > SLAB ? vec3(0.25, 0.32, 0.33) : vec3(0.82, 0.8, 0.76);
  } else {
    float bf = fract(P.x / 9.0), hb = gh(vec2(floor(P.x / 9.0), 5.0));
    if (P.y < 4.2) c = mix(vec3(1.0, 0.8, 0.55), vec3(0.62, 0.78, 0.9), step(0.72, hb)) * (bf < 0.07 ? 0.2 : 1.0);
    else if (P.y < 5.4) c = pea(hb) * 1.1 + 0.08;
    else if (P.y > SLAB && P.y < SLAB + 4.0) c = vec3(0.86, 0.68, 0.46) * (bf < 0.07 ? 0.25 : 1.0);
    else { vec2 a = floor(vec2(P.x / 4.0, P.y / 3.0)); c = mix(vec3(0.5, 0.36, 0.24), pea(gh(a + 9.0)) * 0.7, 0.35 * step(0.55, gh(a))); }
  }
  float fres = 0.04 + 0.96 * pow(1.0 - clamp(rw, 0.0, 1.0), 5.0);
  return c * (0.3 + 0.7 * exp(-t * 0.014)) * (1.0 - fres) * vec3(0.8, 0.88, 0.88) * uGI;
}`;
  const M = {
    roof: glowify(new THREE.MeshStandardMaterial({ vertexColors: true, map: roofT.m, normalMap: roofT.n, normalScale: new THREE.Vector2(0.7, 0.7), roughnessMap: roofT.r, roughness: 1, metalness: 0.12, envMapIntensity: 0.9, emissive: col('#ffb56e'), emissiveIntensity: 0 }), 'zmhRoof'),
    soffit: glowify(new THREE.MeshStandardMaterial({ vertexColors: true, map: bambooT.m, normalMap: bambooT.n, roughness: 0.62, metalness: 0, envMapIntensity: 0.5, emissive: col('#ffb56e'), emissiveIntensity: 0 }), 'zmhSoffit'),
    solid: glowify(new THREE.MeshStandardMaterial({ vertexColors: true, map: seamT, roughness: 0.55, metalness: 0.08, envMapIntensity: 0.6, emissive: col('#ffb56e'), emissiveIntensity: 0 }), 'zmhSolid'),
    glass: new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.04, metalness: 0, envMapIntensity: 1.6 }),
    tglass: new THREE.MeshStandardMaterial({ color: col('#7fa3b0'), transparent: true, opacity: 0.42, roughness: 0.04, metalness: 0.6, envMapIntensity: 1.6, depthWrite: false, emissive: col('#ffd59a'), emissiveIntensity: 0 }),
    jaali: new THREE.MeshStandardMaterial({ map: jaaliT, normalMap: jaaliT.userData.n, normalScale: new THREE.Vector2(1.2, 1.2), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.82, metalness: 0, color: col('#fff4e2') }),
    tree: selInst(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), 'zmhPlant', [0.9, 0.9, 0.85], [0, 0, 0], 0),
    pool: new THREE.MeshStandardMaterial({ color: col('#0f3a3a'), roughness: 0.03, metalness: 0, normalMap: rippleN, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.8, emissive: col('#39b3a6'), emissiveIntensity: 0 }),
    coffer: selInst(new THREE.MeshStandardMaterial({ vertexColors: true, envMapIntensity: 1.4 }), 'zmhCoffer', [0.4, 0.03, 0.12], [0.1, 0, 0.3], 0.55),
    inst: selInst(new THREE.MeshStandardMaterial({ vertexColors: true, envMapIntensity: 1.1 }), 'zmhInst', [0.6, 0.06, 0.32], [0.1, 0, 0.45], 0),
    bridge: selInst(new THREE.MeshStandardMaterial({ vertexColors: true, envMapIntensity: 1.1 }), 'zmhBridge', [0.38, 0.05, 0.4], [0.55, 0, 0.3], 0),
  };
  M.solid.shadowSide = THREE.DoubleSide; M.roof.shadowSide = THREE.DoubleSide;
  M.glass.onBeforeCompile = sh => {
    sh.uniforms.uGI = glassU.uGI;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 tang;\nvarying vec3 vGW; varying vec3 vGN; varying vec4 vGT;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz; vGN = normalize(mat3(modelMatrix) * normal); vGT = tang;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + GLSL_INT)
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat gF = gFrame(); diffuseColor.rgb = mix(vec3(0.01, 0.014, 0.016), vec3(0.6, 0.62, 0.64), gF);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.035, 0.38, gF);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(0.0, 0.8, gF);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += (1.0 - gF) * gInterior();');
  };
  M.glass.customProgramCacheKey = () => 'zmhGlassInt';
  // jaali: a stable screen-space dither instead of a hard 0.5 cut, so the perforation survives mip-mapping at distance
  M.jaali.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>',
    'float jd = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));\nfloat ja = clamp((diffuseColor.a - 0.5) / max(fwidth(diffuseColor.a), 1e-3) + 0.5, 0.0, 1.0);\nif (mix(diffuseColor.a, ja, 0.5) < mix(0.5, jd, 0.85)) discard;'); };
  M.jaali.customProgramCacheKey = () => 'zmhJaali';
  // the core's PMREM sky (scene.environment) when it exists; the canvas sky only as a fallback
  const ENVM = [];
  for (const k in M) { if (!Z.scene.environment) { M[k].envMap = envT; ENVM.push(M[k]); } }
  for (const k in M) M[k].userData.env0 = M[k].envMapIntensity;

  const CL = { roof: col('#ebe8e1'), roofEdge: col('#b9bcbf'), bamboo: col('#c39a63'), stone: col('#c9a77a'), stoneL: col('#dcc39b'), stoneD: col('#a5835a'),
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
  const SA = Acc();          // solid, vertex-coloured: buildings, forecourt, garden ground
  const RA = Acc();          // the roof's top skin and fascia
  const OA = Acc();          // the bamboo soffit
  const GA = Acc(); GA.t = [];   // curtain-wall glass (+ tangent, arc length, wall top for the interior shader)
  const TA = Acc();          // transparent glass (dome, tower cab)
  const JA = Acc();          // jaali
  const WA = Acc();          // water
  function grid(ip, NI, NJ, periodic, XY, UVF, CF, SUV) {
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
    const tb = RA.p.length / 3; const tmpN = new THREE.Vector3();
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const k = i * ny + j; tmpN.set(NX[k], 1, NZ[k]).normalize(); const uv = UVF ? UVF(i, j, X[k], Y[k]) : [X[k] / 18, Y[k] / 18]; V(RA, X[k], Hh[k], Y[k], tmpN.x, tmpN.y, tmpN.z, CF ? CF(X[k], Y[k]) : CL.roof, uv[0], uv[1], 0.025); }
    const ub = OA.p.length / 3;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const k = i * ny + j; tmpN.set(NX[k], 1, NZ[k]).normalize(); const uv = SUV ? SUV(i, j, X[k], Y[k]) : [X[k] / 8, Y[k] / 8]; V(OA, X[k], Hh[k] - TH, Y[k], -tmpN.x, -tmpN.y, -tmpN.z, CL.white, uv[0], uv[1], 0.55); }
    for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) {
      if (st[i * NJ + j] !== 0) continue;
      const a = node(i, j), b = node(i + 1, j), c = node(i + 1, j + 1), d = node(i, j + 1);
      // orientation: top must face up
      const ux = X[b] - X[a], uz = Y[b] - Y[a], vx = X[c] - X[a], vz = Y[c] - Y[a]; let up = (uz * vx - ux * vz) > 0;
      if (Math.abs(uz * vx - ux * vz) < 1e-9) { const wx = X[d] - X[a], wz = Y[d] - Y[a]; up = (vz * wx - vx * wz) > 0; }
      if (up) { RA.i.push(tb + a, tb + b, tb + c, tb + a, tb + c, tb + d); if (near[i * NJ + j]) OA.i.push(ub + a, ub + c, ub + b, ub + a, ub + d, ub + c); }
      else { RA.i.push(tb + a, tb + c, tb + b, tb + a, tb + d, tb + c); if (near[i * NJ + j]) OA.i.push(ub + a, ub + b, ub + c, ub + a, ub + c, ub + d); }
      // fascia on edges facing a hole or the outside
      const cxm = (X[a] + X[b] + X[c] + X[d]) / 4, cym = (Y[a] + Y[b] + Y[c] + Y[d]) / 4;
      const edges = [[a, b, i, j - 1], [b, c, i + 1, j], [c, d, i, j + 1], [d, a, i - 1, j]];
      for (const [p, q, ni, nj] of edges) {
        if (S(ni, nj) !== 1) continue;
        if (Math.hypot(X[q] - X[p], Y[q] - Y[p]) < 0.05) continue;
        const mx = (X[p] + X[q]) / 2, my = (Y[p] + Y[q]) / 2;
        face(RA, [[X[p], Hh[p] + 0.15, Y[p]], [X[q], Hh[q] + 0.15, Y[q]], [X[q], Hh[q] - TH, Y[q]], [X[p], Hh[p] - TH, Y[p]]], CL.roofEdge, null, 0.7, [mx - cxm, 0, my - cym]);
      }
    }
  }
  safe('roof', () => {
    // Hall: polar grid from the oculus rim to the roof edge (overhang, cantilever on the west)
    const NI = 252, NJ = 30;
    const cTmp = new THREE.Color(), cGut = col('#c9bca4');
    grid(0, NI, NJ, true, (i, j) => { const t = TAU * i / NI, Re = hallR(t) + hallOv(t), r = 48 + (Re - 48) * j / NJ; return [HCX + r * Math.cos(t), HCY + r * Math.sin(t)]; },
      (i, j, x, y) => [i / NI * 42, Math.hypot(x - HCX, y - HCY) / 24],
      (x, y) => { const t = Math.atan2(y - HCY, x - HCX), vl = (1 - Math.cos(7 * t)) / 2, sec = Math.floor(((t + TAU) % TAU) / TAU * 84);
        return cTmp.copy(CL.roof).multiplyScalar(sec % 3 === 0 ? 0.965 : 1).lerp(cGut, Math.pow(vl, 6) * 0.9); },
      (i, j, x, y) => [i / NI * 240, Math.hypot(x - HCX, y - HCY) / 8]);
    // Mall: x rows (exact rows at the garden valley's edges), vault across
    const xs = [MXS, (MXS + BELT.x0) / 2]; for (let k = 0; k <= 9; k++) xs.push(BELT.x0 + 7 * k); const n2 = 276; for (let k = 1; k <= n2; k++) xs.push(BELT.x1 + (MXE - BELT.x1) * k / n2);
    const NJm = 28;
    grid(1, xs.length - 1, NJm, false, (i, j) => { const x = xs[i], hw = mallHW(Math.min(x, MX1)) + OV; return [x, (-1 + 2 * j / NJm) * hw]; });
    // piers
    piers.forEach((P, k) => {
      const d0 = 60, d1 = P.dEnd + OV, NIp = Math.ceil((d1 - d0) / 6), NJp = 16;
      grid(2 + k, NIp, NJp, false, (i, j) => { const d = d0 + (d1 - d0) * Math.pow(i / NIp, 1), hw = pierRoofHW(P, d); return [P.cx + (-1 + 2 * j / NJp) * hw, P.sgn * d]; },
        (i, j, x, y) => [y / 18, x / 18], null, (i, j, x, y) => [y / 8, x / 8]);
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
    cyl(OA, HCX, HCY, rimMin - TH, base + 0.4, 47.8, 47.8, 48, CL.white, 0.4, false, false);
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
      const nb = GA.p.length / 3;
      face(GA, [[p0[0], 0.2, p0[1]], [p1[0], 0.2, p1[1]], [p1[0], t1, p1[1]], [p0[0], t0, p0[1]]], CL.white, [[s / 3, 0], [(s + len) / 3, 0], [(s + len) / 3, t1 / 4.5], [s / 3, t0 / 4.5]], 0, [w[0], 0, w[1]]);
      if (GA.p.length / 3 > nb) { const tx = (p1[0] - p0[0]) / len, tz = (p1[1] - p0[1]) / len; GA.t.push(tx, s, tz, t0, tx, s + len, tz, t1, tx, s + len, tz, t1, tx, s, tz, t0); }
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
        let gap = (k % 5) === 4; for (const b of BR) if (Math.abs(b.ry - my) < 4.5 && Math.abs(b.rx - mx) < 9) { gap = true; break; }
        const h0 = H(p0[0], p0[1]), h1 = H(p1[0], p1[1]);
        if (gap || h0 === NEG || h1 === NEG) { s += len; continue; }
        const t0 = Math.min(h0 - TH - 4.5, 18), t1 = Math.min(h1 - TH - 4.5, 18), hgt = (t0 + t1) / 2;
        face(JA, [[p0[0], 0.3, p0[1]], [p1[0], 0.3, p1[1]], [p1[0], t1, p1[1]], [p0[0], t0, p0[1]]], CL.white, [[s / hgt, v0], [(s + len) / hgt, v0], [(s + len) / hgt, v0 + 0.5], [s / hgt, v0 + 0.5]], 0, null);
        s += len;
      }
    }
  });

  // ------------------------------------------------------------ gardens (ground) and trees
  const TREES = [];   // [x, y, ground, scale, hue]
  const PALMS = [], SHRUBS = [], PEOPLE = [], CARS = [], TCOL = [];   // [x, y, ground, scale, hue, (yaw)]
  const addPalm = (x, y, h0, s) => PALMS.push([x, y, h0 || 0, s || (0.85 + rnd() * 0.35), rnd()]);
  const addShrub = (x, y, h0, s) => SHRUBS.push([x, y, h0 || 0, s || (0.6 + rnd() * 0.8), rnd()]);
  const addPerson = (x, y, h0) => PEOPLE.push([x, y, h0 || 0, 0.92 + rnd() * 0.16, rnd(), rnd() * TAU]);
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
    void 0;
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
      if (b < nB - 1) { for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) { const yy = cy + (k - 1.5) * inr[1] * 0.45; addTree(cx + sx * (inr[0] - tx / 2), yy, lv[b + 1] - 0.3, 0.7 + rnd() * 0.3);
          for (let q = 0; q < 5; q++) addShrub(cx + sx * (inr[0] - tx / 2) + (rnd() - 0.5) * tx * 0.8, yy + (rnd() - 0.5) * 16, lv[b + 1] - 0.3, 0.5 + rnd() * 0.5); }
        for (let k = 0; k < 6; k++) { const xx = cx + (k - 2.5) * inr[0] * 0.33; for (const sy of [-1, 1]) { addPalm(xx, cy + sy * (inr[1] - ty / 2), lv[b + 1] - 0.3, 0.7 + rnd() * 0.25); addShrub(xx + 4, cy + sy * (inr[1] - ty / 2), lv[b + 1] - 0.3); } } }
      // families on the terraces and steps, thicker near the water
      { const n = b < nB - 1 ? 110 : 220; let cnt = 0; for (let q = 0; q < n * 4; q++) { const xx = (rnd() * 2 - 1) * inr[0], yy = (rnd() * 2 - 1) * inr[1]; if (Math.abs(xx) < inner[0] + 1.5 && Math.abs(yy) < inner[1] + 1.5) continue; addPerson(cx + xx, cy + yy, lv[b + 1] - 0.3); if (++cnt >= n) break; } }
      o = inner;
    }
    // the pool
    riser([px, py], lv[nB] - 0.3, lv[nB] - 1.0, CL.stoneD, 0.4, true);
    face(WA, [[cx - px, lv[nB] - 0.75, cy - py], [cx + px, lv[nB] - 0.75, cy - py], [cx + px, lv[nB] - 0.75, cy + py], [cx - px, lv[nB] - 0.75, cy + py]], CL.white, null, 0, [0, 1, 0]);
    // trees along the forecourt's rim (shade for the families waiting up top)
    for (let k = 0; k < 9; k++) { const xx = F.x0 + 15 + k * (F.x1 - F.x0 - 30) / 8; addTree(xx, F.y0 - 12, 0, 1.1); addTree(xx, F.y1 + 12, 0, 1.1); addPalm(xx + 13, F.y0 - 8, 0); addPalm(xx + 13, F.y1 + 8, 0); }
    for (let k = 0; k < 10; k++) { addTree(F.x0 - 14, F.y0 + 20 + k * (F.y1 - F.y0 - 40) / 9, 0, 1.15); addPalm(F.x0 - 7, F.y0 + 36 + k * (F.y1 - F.y0 - 40) / 9, 0); }
    for (let k = 0; k < 160; k++) { const a = rnd(); if (a < 0.5) addShrub(F.x0 + rnd() * (F.x1 - F.x0), (rnd() < 0.5 ? F.y0 - 4 - rnd() * 18 : F.y1 + 4 + rnd() * 18), 0); else addShrub(F.x0 - 4 - rnd() * 18, F.y0 + rnd() * (F.y1 - F.y0), 0); }
    for (let k = 0; k < 500; k++) { const a = rnd(); if (a < 0.4) addPerson(F.x0 - 2 - rnd() * 24, F.y0 + rnd() * (F.y1 - F.y0), 0); else addPerson(F.x0 + rnd() * (F.x1 - F.x0), (rnd() < 0.5 ? F.y0 - 2 - rnd() * 22 : F.y1 + 2 + rnd() * 22), 0); }
    { const NP = 520; for (let k = 0; k < NP; k++) { const t0 = TAU * k / NP, t1 = TAU * (k + 1) / NP, tm = (t0 + t1) / 2, ov = hallOv(tm), out = ov > 12 ? ov + 4 : 4.5;
        const x0 = HCX + hallR(tm) * Math.cos(tm); if (x0 > -1990) continue;
        const P = (t, r) => [HCX + r * Math.cos(t), 0.14, HCY + r * Math.sin(t)], ra0 = hallR(t0) - 0.5, ra1 = hallR(t1) - 0.5, rb0 = hallR(t0) + out, rb1 = hallR(t1) + out;
        const xm = HCX + (hallR(tm) + out / 2) * Math.cos(tm), ym = HCY + (hallR(tm) + out / 2) * Math.sin(tm);
        if (ov > 12 && xm < F.x1 + 2 && Math.abs(ym) < F.y1 + 2) continue;
        face(SA, [P(t0, ra0), P(t1, ra1), P(t1, rb1), P(t0, rb0)], k % 2 ? CL.stoneL : col('#d8cdb8'), [[k, ra0 / 6], [k + 1, ra1 / 6], [k + 1, rb1 / 6], [k, rb0 / 6]], 0, [0, 1, 0]); } }
    // the departures kerb under the 40 m cantilever: a crowd at the doors, tree columns holding the roof's edge
    for (let k = 0; k < 900; k++) { const t = PI + (rnd() * 2 - 1) * 0.62, R = hallR(t), ov = hallOv(t), r = R + 1 + rnd() * (ov - 2) * (rnd() < 0.6 ? 0.35 : 1), x = HCX + r * Math.cos(t), y = HCY + r * Math.sin(t);
      if (x < F.x1 + 1 && Math.abs(y) < F.y1 + 1) continue; addPerson(x, y, 0); }
    for (let t = PI - 0.6; t <= PI + 0.6 + 1e-6; t += 0.06) { const R = hallR(t), ov = hallOv(t); if (ov < 22) continue; const r = R + ov * 0.5, x = HCX + r * Math.cos(t), y = HCY + r * Math.sin(t); TCOL.push([x, y, H(x, y) - TH, t]); }
    // a planted strip all round the Hall's glass, beyond the overhang
    for (let t = 0; t < TAU; t += 0.011) { const R = hallR(t), x = HCX + (R + hallOv(t) + 5) * Math.cos(t), y = HCY + (R + hallOv(t) + 5) * Math.sin(t);
      if (x > -1985 || (x < F.x1 + 25 && Math.abs(y) < F.y1 + 25)) continue; addShrub(x, y, 0, 0.8 + rnd() * 0.7); if (rnd() < 0.18) addTree(x + (rnd() - 0.5) * 6, y + (rnd() - 0.5) * 6, 0, 0.8 + rnd() * 0.5); else if (rnd() < 0.1) addPalm(x, y, 0); }
    // cars queueing on the kerb loops
    for (const l of SPEC.landside || []) { if (l.label !== 'Kerb loop') continue; const P = l.pts;
      for (let k = 0; k < P.length - 1; k++) { const a = P[k], b = P[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
        for (const lane of [-9, -5, 5, 9]) for (let d = rnd() * 10; d < L; d += 7 + rnd() * 18) { if (rnd() < 0.25) continue; CARS.push([a[0] + ux * d - uy * lane, a[1] + uy * d + ux * lane, 0, 1, rnd(), -Math.atan2(uy, ux) + (lane < 0 ? PI : 0)]); } } }
  });

  // ------------------------------------------------------------ other buildings
  function extrude(A, pts, z0, z1, cw, cr, gl, glr) {
    const sgn = area2(pts) > 0 ? 1 : -1; let s = 0;
    for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.01) continue;
      const nx = (b[1] - a[1]) * sgn, ny = -(b[0] - a[0]) * sgn;
      const nb = A.p.length / 3;
      face(A, [[a[0], z0, a[1]], [b[0], z0, b[1]], [b[0], z1, b[1]], [a[0], z1, a[1]]], cw, [[s / 12, z0 / 12], [(s + L) / 12, z0 / 12], [(s + L) / 12, z1 / 12], [s / 12, z1 / 12]], gl || 0, [nx, 0, ny]);
      if (A.t) { if (A.p.length / 3 > nb) { const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L; A.t.push(tx, s, tz, z1, tx, s + L, tz, z1, tx, s + L, tz, z1, tx, s, tz, z1); } }
      s += L; }
    if (A.t && cr) cr = null;
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
        // the ATC tower as a landmark: a glazed podium, a twisting trefoil shaft (three fins winding a third of a turn)
        // that flares into a cab deck, an outward-leaning glazed cab with mullions, a cantilevered roof and a radome
        const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
        extrude(SA, pts, 0, 1.2, CL.conc2, CL.conc2, 0, 0);
        const pr = Math.min(bb.x1 - bb.x0, bb.y1 - bb.y0) / 2 - 2, NP = 32, ring = [];
        for (let k = 0; k < NP; k++) { const a = TAU * k / NP; ring.push([cx + pr * Math.cos(a), cy + pr * Math.sin(a)]); }
        const rr = ring.slice().reverse(); extrude(GA, rr, 1.2, 11, CL.white, null, 0); extrude(SA, rr.map(p => [cx + (p[0] - cx) * 1.08, cy + (p[1] - cy) * 1.08]), 11, 13, CL.white, CL.conc, 0.1, 0);
        const NY = 30, NA = 36, y0 = 13, y1 = 84;
        const rad = (y, a) => { const u = (y - y0) / (y1 - y0), base = 7.6 - 2.2 * u + 6.5 * Math.pow(Math.max(0, (u - 0.82) / 0.18), 2.2), tw = u * TAU / 3;
          return base * (1 + 0.26 * Math.max(0, Math.cos(3 * (a - tw))) ** 3); };
        for (let j = 0; j < NY; j++) for (let k = 0; k < NA; k++) {
          const ya = y0 + (y1 - y0) * j / NY, yb = y0 + (y1 - y0) * (j + 1) / NY, a0 = TAU * k / NA, a1 = TAU * (k + 1) / NA, am = (a0 + a1) / 2;
          const P = (y, a) => { const r = rad(y, a); return [cx + r * Math.cos(a), y, cy + r * Math.sin(a)]; };
          face(SA, [P(ya, a0), P(ya, a1), P(yb, a1), P(yb, a0)], k % 12 < 2 ? CL.conc : CL.white, null, 0, [Math.cos(am), 0, Math.sin(am)]);
        }
        cyl(SA, cx, cy, 84, 86.2, 14.0, 14.4, 36, CL.white, 0.3, true, false, CL.conc);                      // cab deck
        cyl(TA, cx, cy, 86.2, 95.5, 12.6, 14.4, 36, CL.white, 0, false, false);                              // cab glass, leaning out
        for (let k = 0; k < 18; k++) { const a = TAU * k / 18, ca = Math.cos(a), sa = Math.sin(a);
          face(SA, [[cx + ca * 12.75 - sa * 0.14, 86.2, cy + sa * 12.75 + ca * 0.14], [cx + ca * 12.75 + sa * 0.14, 86.2, cy + sa * 12.75 - ca * 0.14], [cx + ca * 14.55 + sa * 0.14, 95.5, cy + sa * 14.55 - ca * 0.14], [cx + ca * 14.55 - sa * 0.14, 95.5, cy + sa * 14.55 + ca * 0.14]], CL.dark, null, 0, [ca, 0, sa]); }
        cyl(SA, cx, cy, 95.5, 97.0, 16.8, 16.4, 36, CL.white, 0.2, true, false, CL.conc2);                     // cantilevered roof
        cyl(SA, cx, cy, 97.0, 99.5, 6, 5, 18, CL.conc, 0, true, false);
        blob(SA, cx + 2, 101.4, cy, 2.2, 2.2, 2.2, CL.white, 0, 1);                                           // radome
        cyl(SA, cx - 2.5, cy, 99.5, 116, 0.5, 0.18, 6, CL.red, 0, false, false);
        for (const yy of [104, 110]) box(SA, cx - 2.5, yy, cy, 2.4, 0.15, 0.15, CL.steel, 0, 0);
      } else if (B.kind === 'fire') {
        extrude(SA, pts, 0, 11, CL.conc, CL.conc2, 0.15, 0);
        extrude(SA, rectPts(bb.x0 - 0.4, bb.y0 - 0.4, bb.x1 + 0.4, bb.y1 + 0.4), 8.6, 10.2, CL.red, null, 0.1);
        // apparatus bay doors facing the field
        const yy = Math.abs(bb.y0) > Math.abs(bb.y1) ? bb.y1 + 0.3 : bb.y0 - 0.3; for (let k = 0; k < 6; k++) { const x = bb.x0 + 20 + k * (bb.x1 - bb.x0 - 40) / 5; box(SA, x, 0, yy, 14, 7, 0.6, CL.red, 0, 0.3); }
      } else if (B.kind === 'cargo') {
        const n = 3, gap = 24, w = (bb.x1 - bb.x0 - gap * (n - 1)) / n;
        for (let k = 0; k < n; k++) { const x0 = bb.x0 + k * (w + gap); extrude(SA, rectPts(x0, bb.y0, x0 + w, bb.y1), 0, 21, CL.conc, CL.steel, 0.12, 0);
          for (let m = 0; m < 6; m++) box(SA, x0 + w * (m + 0.5) / 6, 21, (bb.y0 + bb.y1) / 2, 6, 1.2, bb.y1 - bb.y0 - 40, CL.white, 0, 0.3);
          for (let m = 0; m < 10; m++) box(SA, x0 + 12 + m * (w - 24) / 9, 0, bb.y1 + 0.4, 9, 6, 0.8, col('#3c6f9c'), 0, 0);
          // rooftop plant: air handlers, a louvred plant screen, a brand band along the eaves
          for (let m = 0; m < 9; m++) { const hx = x0 + 15 + rnd() * (w - 30), hz = bb.y0 + 18 + rnd() * (bb.y1 - bb.y0 - 36); box(SA, hx, 21, hz, 7, 2.6, 4, CL.steel, 0, 0, CL.conc2); cyl(SA, hx + 2, hz, 23.6, 24.4, 1.2, 1.2, 10, CL.dark, 0, true, false); }
          extrude(SA, rectPts(x0 - 0.3, bb.y0 - 0.3, x0 + w + 0.3, bb.y1 + 0.3), 18.5, 20.2, col('#1f5a8a'), null, 0.1); }
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
    mk(RA, M.roof, true, true, 'roof');
    mk(OA, M.soffit, false, true, 'soffit');
    mk(GA, M.glass, false, true, 'glass');
    mk(JA, M.jaali, true, true, 'jaali');
    mk(WA, M.pool, false, true, 'pool');
    const tg = mk(TA, M.tglass, false, false, 'tglass'); if (tg) tg.renderOrder = 2;
  });

  // ------------------------------------------------------------ planting, people, cars, tree columns (instanced, one draw each)
  // vertex 'glow' doubles as a part selector: 0 = own colour, 1 = glass, 2 = takes the instance colour
  function inst(name, A, mat, list, colours, cast, place) {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(toGeo(A), mat, list.length), o = new THREE.Object3D(), c = new THREE.Color();
    list.forEach((t, k) => { o.position.set(t[0], t[2], t[1]); o.rotation.set(0, t[5] !== undefined ? t[5] : t[4] * TAU, 0); o.scale.setScalar(t[3]); if (place) place(o, t); o.updateMatrix(); im.setMatrixAt(k, o.matrix);
      c.set(colours[Math.floor(t[4] * 997) % colours.length]); im.setColorAt(k, c); });
    im.castShadow = !!cast; im.receiveShadow = true; im.frustumCulled = false; group.add(im); meshes[name] = im; return im;
  }
  function blob(A, cx, cy, cz, sx, sy, sz, c, gl, det) {
    const ico = new THREE.IcosahedronGeometry(1, det || 0), ip = ico.attributes.position;
    for (let k = 0; k < ip.count; k += 3) { const b = A.p.length / 3;
      for (let m = 0; m < 3; m++) { const x = ip.getX(k + m), y = ip.getY(k + m), z = ip.getZ(k + m), L = Math.hypot(x / sx, y / sy, z / sz) || 1; V(A, cx + x * sx, cy + y * sy, cz + z * sz, x / sx / L, y / sy / L, z / sz / L, c, 0.5, 0.5, gl); }
      A.i.push(b, b + 1, b + 2); }
    ico.dispose();
  }
  // a tube between two points
  function strut(A, p0, p1, r0, r1, n, c, gl) {
    const d = new THREE.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]).normalize(), a = Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(d, a).normalize(), v = new THREE.Vector3().crossVectors(d, u);
    for (let k = 0; k < n; k++) { const a0 = TAU * k / n, a1 = TAU * (k + 1) / n, am = (a0 + a1) / 2, Q = (p, r, an) => [p[0] + r * (u.x * Math.cos(an) + v.x * Math.sin(an)), p[1] + r * (u.y * Math.cos(an) + v.y * Math.sin(an)), p[2] + r * (u.z * Math.cos(an) + v.z * Math.sin(an))];
      face(A, [Q(p0, r0, a0), Q(p0, r0, a1), Q(p1, r1, a1), Q(p1, r1, a0)], c, null, gl, [u.x * Math.cos(am) + v.x * Math.sin(am), u.y * Math.cos(am) + v.y * Math.sin(am), u.z * Math.cos(am) + v.z * Math.sin(am)]); }
  }
  safe('planting', () => {
    const trunk = col('#5e4630'), W = col('#ffffff');
    // broadleaf: a trunk and a clustered canopy; ~1 in 5 flowering (gulmohar, amaltas, jacaranda)
    const T = Acc(); cyl(T, 0, 0, 0, 4.6, 0.42, 0.26, 6, trunk, 0, false, false);
    blob(T, 0, 7.0, 0, 3.6, 2.6, 3.6, W, 2, 0); blob(T, 1.9, 6.1, 0.8, 2.4, 1.9, 2.4, W, 2, 0); blob(T, -1.6, 6.3, -1.1, 2.5, 2.0, 2.5, W, 2, 0); blob(T, 0.2, 8.6, -0.6, 2.2, 1.6, 2.2, W, 2, 0);
    inst('trees', T, M.tree, TREES, ['#4e7f35', '#5f8d3a', '#6c9a44', '#3f6f2f', '#7a9b3c', '#558a48', '#46783a', '#b8563c', '#4e7f35', '#5f8d3a', '#c9a640', '#4e7f35', '#3f6f2f', '#6c9a44', '#8f7fb0', '#558a48'], true);
    // palms: a slender ringed trunk and drooping fronds
    const Pm = Acc(); cyl(Pm, 0, 0, 0, 10, 0.32, 0.22, 6, col('#8a7a62'), 0, false, false);
    for (let k = 0; k < 10; k++) { const a = TAU * k / 10 + (k % 2) * 0.2, ca = Math.cos(a), sa = Math.sin(a), pa = [-sa, ca], L = k % 2 ? 4.6 : 3.8;
      const top = [0, 10, 0], mid = [ca * L * 0.5, 10.7, sa * L * 0.5], tip = [ca * L, 9.0 - (k % 2), sa * L], w = 0.7;
      face(Pm, [top, [mid[0] + pa[0] * w, mid[1], mid[2] + pa[1] * w], [mid[0] - pa[0] * w, mid[1], mid[2] - pa[1] * w]], W, null, 2, [0, 1, 0]);
      face(Pm, [[mid[0] + pa[0] * w, mid[1], mid[2] + pa[1] * w], tip, [mid[0] - pa[0] * w, mid[1], mid[2] - pa[1] * w]], W, null, 2, [0, 1, 0]); }
    inst('palms', Pm, M.tree, PALMS, ['#4f8a3a', '#5c9640', '#46803a', '#62973f'], true);
    // shrubs and flowering bushes (bougainvillea, lantana)
    const Sh = Acc(); blob(Sh, 0, 0.7, 0, 1.7, 1.0, 1.7, W, 2, 0);
    inst('shrubs', Sh, M.tree, SHRUBS, ['#3f6f2f', '#4e7f35', '#5a8a3a', '#3a6a35', '#a8466e', '#4e7f35', '#46743a', '#5a8a3a', '#b86a3a', '#6c9a44', '#3f6f2f', '#5a8a3a'], false);
    // people: legs, a shirt / kurta / sari (instance colour), a head
    box.noBottom = true;
    const Pe = Acc(), skin = col('#7a5038'); box(Pe, 0, 0, 0, 0.34, 0.82, 0.22, col('#2c2c34'), 0, 0); box(Pe, 0, 0.82, 0, 0.46, 0.66, 0.28, W, 0, 2, skin);
    inst('people', Pe, M.inst, PEOPLE, ['#f2efe6', '#e8a33a', '#c0392b', '#2e5fa8', '#f2efe6', '#7a2b5c', '#2e8b57', '#e7d3a8', '#1f3a5f', '#d4562a', '#f2efe6', '#e0c341'], false);
    // cars: body (instance colour), glasshouse, a kaali-peeli taxi or two
    const Ca = Acc(); box(Ca, 0, 0.28, 0, 4.4, 0.78, 1.8, W, 0, 2); box(Ca, -0.2, 1.06, 0, 2.5, 0.62, 1.62, col('#1a2026'), 0, 1);
    box.noBottom = false;
    inst('cars', Ca, M.inst, CARS, ['#f4f4f2', '#c9ccd0', '#1c1f24', '#f4f4f2', '#8a1f1f', '#2a4a7a', '#e8c21a', '#f4f4f2', '#6f757b', '#c9ccd0'], false);
    // Mumbai's branching tree columns under the cantilever: a trunk that flares and splits into arms that open into the soffit
    const TC = Acc(), wc = col('#f0eee8'), Hn = 20;
    cyl(TC, 0, 0, 0, 7.5, 1.15, 0.95, 12, wc, 0, false, false); cyl(TC, 0, 0, 7.5, 9.2, 0.95, 1.6, 12, wc, 0, false, false);
    for (let k = 0; k < 4; k++) { const a = TAU * k / 4 + PI / 4, ca = Math.cos(a), sa = Math.sin(a);
      strut(TC, [ca * 0.8, 8.8, sa * 0.8], [ca * 7.5, Hn + 0.4, sa * 7.5], 0.62, 0.32, 8, wc, 0);
      for (const dv of [-0.55, 0.55]) { const b2 = a + dv; strut(TC, [ca * 4.2, 14.5, sa * 4.2], [Math.cos(b2) * 10.5, Hn + 0.4, Math.sin(b2) * 10.5], 0.34, 0.2, 6, wc, 0); } }
    inst('tcols', TC, M.inst, TCOL.map(t => [t[0], t[1], 0, 1, 0, -t[3]]), ['#ffffff'], true, (o, t) => { const src = TCOL.find(q => q[0] === t[0] && q[1] === t[1]); o.scale.set(1, Math.max(0.6, (src ? src[2] : Hn) / Hn), 1); });
  });

  // ------------------------------------------------------------ skylight coffers with coloured lenses (instanced)
  safe('skylights', () => {
    const SK = (RF.skylights || []).filter(s => !isHole(s.x, s.y) && H(s.x, s.y) !== NEG); if (!SK.length) return;
    // a glazed coffer opening: a white upstand curb, a recessed well, a faceted low glass pyramid (catching the sun at
    // different angles) and a coloured lens at its crown. Unit footprint, scaled to l x w; heights in metres.
    const A = Acc(), w = CL.white, gc = col('#1c2a33'), wl = col('#6b7378');
    const NO = 8, oc = (k, r) => [Math.cos(TAU * (k + 0.5) / NO) * r, Math.sin(TAU * (k + 0.5) / NO) * r];
    for (let k = 0; k < NO; k++) {
      const a0 = oc(k, 0.5), a1 = oc(k + 1, 0.5), b0 = oc(k, 0.43), b1 = oc(k + 1, 0.43), c0 = oc(k, 0.12), c1 = oc(k + 1, 0.12), n = [a0[0] + a1[0], 0, a0[1] + a1[1]];
      face(A, [[a0[0], -0.5, a0[1]], [a1[0], -0.5, a1[1]], [a1[0], 0.7, a1[1]], [a0[0], 0.7, a0[1]]], w, null, 0, n);                     // curb outside
      face(A, [[a0[0], 0.7, a0[1]], [a1[0], 0.7, a1[1]], [b1[0], 0.7, b1[1]], [b0[0], 0.7, b0[1]]], w, null, 0, [0, 1, 0]);             // curb cap
      face(A, [[b0[0], 0.7, b0[1]], [b1[0], 0.7, b1[1]], [b1[0], 0.2, b1[1]], [b0[0], 0.2, b0[1]]], wl, null, 0, [-n[0], 0, -n[2]]);  // the well, in shade
      face(A, [[b0[0], 0.2, b0[1]], [b1[0], 0.2, b1[1]], [c1[0], 0.95, c1[1]], [c0[0], 0.95, c0[1]]], gc, null, 1, [n[0], 1.2, n[2]]); // glass facet
      face(A, [[0, 1.0, 0], [c0[0], 0.95, c0[1]], [c1[0], 0.95, c1[1]]], w, null, 2, [0, 1, 0]);                                       // the lens
    }
    const g1 = toGeo(A);
    const im = new THREE.InstancedMesh(g1, M.coffer, SK.length);
    const m4 = new THREE.Matrix4(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Zv = new THREE.Vector3(), S = new THREE.Vector3(), c = new THREE.Color();
    const peacock = ['#0f8f86', '#e0a020', '#2456c8', '#8a2fa0', '#2f9a3c', '#e0502c', '#10a8d0', '#e8c43a'];
    SK.forEach((s, k) => {
      const a = (s.a || 0) * PI / 180, h = H(s.x, s.y), e = 2;
      const hx = (H(s.x + e, s.y) - H(s.x - e, s.y)) / (2 * e), hz = (H(s.x, s.y + e) - H(s.x, s.y - e)) / (2 * e);
      Y.set(-hx, 1, -hz).normalize(); X.set(Math.cos(a), 0, Math.sin(a)); X.addScaledVector(Y, -X.dot(Y)).normalize(); Zv.crossVectors(X, Y).normalize();
      m4.makeBasis(X, Y, Zv); S.set(s.l || 16, 1, s.w || 12); m4.scale(S); m4.setPosition(s.x, h, s.y);
      im.setMatrixAt(k, m4);
      c.set(peacock[((k * 7 + Math.floor(Math.abs(s.x * 0.37 + s.y * 0.11))) % peacock.length)] || peacock[k % 8]); im.setColorAt(k, c);
    });
    const il = null;
    void il; im.frustumCulled = false; im.receiveShadow = true; im.castShadow = false; group.add(im); meshes.coffer = im;
  });

  // ------------------------------------------------------------ aerobridges (instanced: walkway, cab, leg)
  const BRM = {};
  safe('bridges', () => {
    if (!BR.length) return;
    const body = col('#cfd3d6'), glassC = col('#45535c'), dark = col('#5a6066');
    const WK = Acc(); // walkway spans x 0..1
    box(WK, 0.5, -1.6, 0, 1, 3.2, 3.8, body, 0, 0, body); box(WK, 0.5, -0.2, 0, 1.002, 1.0, 3.86, glassC, 0, 1, glassC);
    const CB = Acc(); box(CB, 0, -1.8, 0, 4.4, 3.6, 5.0, body, 0, 0, body); box(CB, 1.6, -1.2, 0, 1.4, 2.4, 5.1, glassC, 0, 1, glassC);
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
    if (ENVM.length && Z.scene.environment) { for (const m of ENVM) { m.envMap = null; m.needsUpdate = true; } ENVM.length = 0; }
    M.solid.emissiveIntensity = 0.9 * L; M.roof.emissiveIntensity = 0.9 * L; M.soffit.emissiveIntensity = 0.9 * L; M.tglass.emissiveIntensity = 2.6 * L; M.tglass.opacity = 0.42 + 0.3 * L;
    M.pool.emissiveIntensity = 0.5 * L; glassU.uGI.value = 0.62 + 1.5 * L;
    const env = 1 - 0.85 * nf; for (const k in M) M[k].envMapIntensity = M[k].userData.env0 * env;
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
