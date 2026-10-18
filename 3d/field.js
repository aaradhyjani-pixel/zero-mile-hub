Z3MOD.field = function (Z) {
  // The ground: farmland, the graded airport, aprons, taxiways, runways with markings, the runway mode wash,
  // airfield lights and fixtures, signs, windsocks, ILS, blast fences, perimeter fence, landside roads, and a lush green
  // landscape with three kinds of wind-swayed trees, reflective ponds and nallahs, and farmhouses.
  // Ground layers are flat and coplanar, so they are painter-ordered (renderOrder, depthFunc Always) in the opaque
  // pass before anything else: no z-fighting at 10 km, and aircraft and buildings still depth-test against them.
  // Every surface that should look real is a MeshStandardMaterial (lit and reflected by the core's sky environment),
  // with procedural tileable detail maps (albedo / roughness / normal) sampled in world space at two or three scales
  // that fade out with distance (mipmapped and anisotropic, so no tiling from 10 km and no shimmer up close).
  const THREE = Z.THREE, S = Z.SPEC, RW = Z.RW, EXT = Z.EXT, FC = S.forecourt;
  const root = new THREE.Group(); root.name = 'field'; Z.scene.add(root);
  const caps = Z.renderer.capabilities, ANISO = Math.min(16, caps.getMaxAnisotropy()), MAXT = caps.maxTextureSize || 8192;
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const mkTex = (c, srgb, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = ANISO;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return t; };
  const lin = h => new THREE.Color(h);
  const disp = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const AX0 = EXT.x0 - 200, AX1 = EXT.x1 + 200, AY0 = EXT.y0 - 200, AY1 = EXT.y1 + 200;
  const inAirport = (x, y, m) => x > AX0 - m && x < AX1 + m && y > AY0 - m && y < AY1 + m;
  const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1; const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1); return Math.hypot(px - ax - dx * t, py - ay - dy * t); };
  const nodeXY = (k, fb) => { const n = Z.G && Z.G.get ? Z.G.get(k) : null; return n ? [n.x, n.y] : fb; };
  const flatLayer = (mesh, order) => { mesh.renderOrder = order; const m = mesh.material; m.depthFunc = THREE.AlwaysDepth; mesh.receiveShadow = true; mesh.frustumCulled = false; root.add(mesh); return mesh; };
  const windNow = o => { const A = Z.atmo, W = A && A.wind; o.dir = W && isFinite(W.dir) ? W.dir : 0.55; o.speed = W && isFinite(W.speed) ? W.speed : (Z.dustNow ? 16 : 4); o.gust = W && isFinite(W.gust) ? W.gust : (Z.dustNow ? 0.8 : 0.2); return o; };

  // ---------- geometry builder: flat triangles at a fixed height, vertex colours, uvs ----------
  const newB = ws => ({ p: [], c: [], u: [], i: [], ws: ws || 1 });
  const WHITE = lin('#ffffff');
  const vtx = (B, x, y, h, col, u, v) => { B.p.push(x, h, y); B.c.push(col.r, col.g, col.b); B.u.push(u, v); return B.p.length / 3 - 1; };
  const tri = (B, a, b, c) => { const P = B.p; const cr = (P[b * 3] - P[a * 3]) * (P[c * 3 + 2] - P[a * 3 + 2]) - (P[b * 3 + 2] - P[a * 3 + 2]) * (P[c * 3] - P[a * 3]); if (cr > 0) B.i.push(a, c, b); else B.i.push(a, b, c); };
  function quad(B, ax, ay, bx, by, hw, h, col, u0, u1) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L * hw, ny = dx / L * hw, W = u0 === undefined, ws = B.ws;
    const q = [[ax + nx, ay + ny, u0, 0], [bx + nx, by + ny, u1, 0], [bx - nx, by - ny, u1, 1], [ax - nx, ay - ny, u0, 1]];
    const id = q.map(o => vtx(B, o[0], o[1], h, col, W ? o[0] / ws : o[2], W ? o[1] / ws : o[3]));
    tri(B, id[0], id[1], id[2]); tri(B, id[0], id[2], id[3]);
  }
  function disc(B, x, y, r, h, col, n, uv) {
    const ws = B.ws, c = vtx(B, x, y, h, col, uv ? uv[0] : x / ws, uv ? uv[1] : y / ws), ring = [];
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; ring.push(vtx(B, px, py, h, col, uv ? uv[0] : px / ws, uv ? uv[1] : py / ws)); }
    for (let k = 0; k < n; k++) tri(B, c, ring[k], ring[(k + 1) % n]);
  }
  function rect(B, x0, y0, x1, y1, h, col) { const ws = B.ws; const a = vtx(B, x0, y0, h, col, x0 / ws, y0 / ws), b = vtx(B, x1, y0, h, col, x1 / ws, y0 / ws), c = vtx(B, x1, y1, h, col, x1 / ws, y1 / ws), d = vtx(B, x0, y1, h, col, x0 / ws, y1 / ws); tri(B, a, b, c); tri(B, a, c, d); }
  function geoOf(B) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
    const n = new Float32Array(B.p.length); for (let i = 1; i < n.length; i += 3) n[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(B.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3)); g.setIndex(B.i); g.computeBoundingSphere(); return g;
  }
  const simplify = pts => { if (pts.length < 3) return pts.slice(); const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) { const a = out[out.length - 1], b = pts[i], c = pts[i + 1]; const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
      const cr = ux * vy - uy * vx, l = Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1; if (Math.abs(cr / l) > 1e-3 || ux * vx + uy * vy < 0) out.push(b); }
    out.push(pts[pts.length - 1]); return out; };
  const bez = (a, c, b, n) => { const o = []; for (let k = 0; k <= n; k++) { const t = k / n, s = 1 - t; o.push([s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]]); } return o; };
  // walk a polyline, calling fn(x,y,dirx,diry,dist) every `step` metres
  function walk(pts, step, fn, off) { let carry = off || 0, dist = 0;
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue; const dx = (b[0] - a[0]) / L, dy = (b[1] - a[1]) / L;
      let s = carry; while (s <= L) { fn(a[0] + dx * s, a[1] + dy * s, dx, dy, dist + s); s += step; } carry = s - L; dist += L; } }
  // 3D prop builder: non-indexed template geometries merged with a transform and a vertex colour (+ optional extra float)
  const MB = () => ({ p: [], n: [], c: [], e: [] });
  const _o = new THREE.Object3D(), _v = new THREE.Vector3(), _nm = new THREE.Matrix3(); _o.rotation.order = 'YXZ';
  function put(B, geo, x, h, y, sx, sy, sz, yaw, col, e, pitch, roll) {
    _o.position.set(x, h, y); _o.rotation.set(pitch || 0, yaw || 0, roll || 0); _o.scale.set(sx, sy, sz); _o.updateMatrix(); _nm.getNormalMatrix(_o.matrix);
    const P = geo.attributes.position, N = geo.attributes.normal, cc = col.isColor ? col : lin(col);
    for (let i = 0; i < P.count; i++) { _v.fromBufferAttribute(P, i).applyMatrix4(_o.matrix); B.p.push(_v.x, _v.y, _v.z); _v.fromBufferAttribute(N, i).applyMatrix3(_nm).normalize(); B.n.push(_v.x, _v.y, _v.z); B.c.push(cc.r, cc.g, cc.b); B.e.push(typeof e === 'function' ? e(i, P) : e || 0); }
  }
  const mbGeo = (B, ename) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3)); if (ename) g.setAttribute(ename, new THREE.Float32BufferAttribute(B.e, 1)); g.computeBoundingSphere(); return g; };
  const BOX = new THREE.BoxGeometry(1, 1, 1).toNonIndexed(); BOX.translate(0, 0.5, 0);
  const CYL6 = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).toNonIndexed(); CYL6.translate(0, 0.5, 0);
  const CYL8C = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false).toNonIndexed(); CYL8C.translate(0, 0.5, 0);

  // SVG path (M L H V Q C Z, absolute) to THREE.Shape list; world (x,y) -> shape (x,-y)
  function pathShapes(d) {
    const tok = d.match(/[MLHVQCZmlhvqcz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || []; const shapes = []; let sh = null, cx = 0, cy = 0, i = 0, cmd = '';
    const num = () => parseFloat(tok[i++]);
    while (i < tok.length) {
      if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++].toUpperCase();
      if (cmd === 'M') { cx = num(); cy = num(); sh = new THREE.Shape(); sh.moveTo(cx, -cy); shapes.push(sh); cmd = 'L'; }
      else if (cmd === 'L') { cx = num(); cy = num(); sh.lineTo(cx, -cy); }
      else if (cmd === 'H') { cx = num(); sh.lineTo(cx, -cy); }
      else if (cmd === 'V') { cy = num(); sh.lineTo(cx, -cy); }
      else if (cmd === 'Q') { const x1 = num(), y1 = num(); cx = num(); cy = num(); sh.quadraticCurveTo(x1, -y1, cx, -cy); }
      else if (cmd === 'C') { const x1 = num(), y1 = num(), x2 = num(), y2 = num(); cx = num(); cy = num(); sh.bezierCurveTo(x1, -y1, x2, -y2, cx, -cy); }
      else if (cmd === 'Z') { cmd = ''; }
      else i++;
    }
    return shapes;
  }
  const foreHole = () => { const p = new THREE.Path(); p.moveTo(FC.x0, -FC.y0); p.lineTo(FC.x0, -FC.y1); p.lineTo(FC.x1, -FC.y1); p.lineTo(FC.x1, -FC.y0); p.closePath(); return p; };

  // ---------- shared noise texture (R: broad, G: medium, B: fine grain), tileable ----------
  function noiseCanvas(N, seed) {
    const R = mulberry(seed), c = mkCanvas(N, N), g = c.getContext('2d'), img = g.createImageData(N, N);
    const sets = [[[4, .45], [8, .3], [16, .15], [32, .1]], [[8, .4], [16, .3], [32, .2], [64, .1]], [[32, .3], [64, .35], [128, .35]]];
    const ch = sets.map(oct => { const out = new Float32Array(N * N);
      for (const [G, amp] of oct) { const lat = new Float32Array(G * G); for (let k = 0; k < G * G; k++) lat[k] = R();
        for (let y = 0; y < N; y++) { const fy = y / N * G, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty), y0 = iy % G * G, y1 = (iy + 1) % G * G;
          for (let x = 0; x < N; x++) { const fx = x / N * G, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx), x0 = ix % G, x1 = (ix + 1) % G;
            out[y * N + x] += amp * ((lat[y0 + x0] * (1 - sx) + lat[y0 + x1] * sx) * (1 - sy) + (lat[y1 + x0] * (1 - sx) + lat[y1 + x1] * sx) * sy); } } }
      return out; });
    for (let k = 0; k < N * N; k++) { img.data[k * 4] = ch[0][k] * 255; img.data[k * 4 + 1] = ch[1][k] * 255; img.data[k * 4 + 2] = ch[2][k] * 255; img.data[k * 4 + 3] = 255; }
    g.putImageData(img, 0, 0); return c;
  }
  const noiseTex = mkTex(noiseCanvas(256, 77), false, true);

  // ---------- procedural PBR detail maps: tileable RGBA DataTextures, R albedo, G roughness, B/A normal (x, z) ----------
  const lattice = (N, G, R) => { const lat = new Float32Array(G * G); for (let k = 0; k < G * G; k++) lat[k] = R(); const out = new Float32Array(N * N);
    for (let y = 0; y < N; y++) { const fy = y / N * G, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty), y0 = iy % G * G, y1 = (iy + 1) % G * G;
      for (let x = 0; x < N; x++) { const fx = x / N * G, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx), x0 = ix % G, x1 = (ix + 1) % G;
        out[y * N + x] = (lat[y0 + x0] * (1 - sx) + lat[y0 + x1] * sx) * (1 - sy) + (lat[y1 + x0] * (1 - sx) + lat[y1 + x1] * sx) * sy; } } return out; };
  const addN = (F, N, G, amp, R) => { const n = lattice(N, G, R); for (let k = 0; k < N * N; k++) F[k] += (n[k] - 0.5) * amp; };
  const splat = (F, N, cx, cy, r, v, hard) => { const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) { const dd = ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / r2; if (dd >= 1) continue;
      F[((y % N + N) % N) * N + ((x % N + N) % N)] += v * (hard ? 1 : 1 - dd); } };
  function pbrTex(N, seed, nk, build) {
    const R = mulberry(seed), H = new Float32Array(N * N), A = new Float32Array(N * N).fill(0.5), G = new Float32Array(N * N).fill(0.5); build(H, A, G, R, N);
    const d = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x, hx = H[y * N + (x + 1) % N] - H[y * N + (x + N - 1) % N], hy = H[((y + 1) % N) * N + x] - H[((y + N - 1) % N) * N + x];
      const nx = -hx * nk, ny = -hy * nk, l = Math.hypot(nx, ny, 1);
      d[i * 4] = clamp(A[i], 0, 1) * 255; d[i * 4 + 1] = clamp(G[i], 0, 1) * 255; d[i * 4 + 2] = (nx / l * 0.5 + 0.5) * 255; d[i * 4 + 3] = (ny / l * 0.5 + 0.5) * 255; }
    const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true; t.anisotropy = ANISO; t.needsUpdate = true; return t; }
  // asphalt aggregate, 6 m tile: stones (light quartz, dark basalt), binder, fine roughness
  const asphTex = pbrTex(512, 101, 1.6, (H, A, G, R, N) => {
    addN(H, N, 64, 0.35, R); addN(A, N, 16, 0.22, R); addN(A, N, 64, 0.14, R); addN(G, N, 32, 0.25, R);
    for (let k = 0; k < 9000; k++) { const x = R() * N, y = R() * N, r = 1 + R() * 2.6, s = R(); splat(H, N, x, y, r, 0.45 + R() * 0.4, false);
      splat(A, N, x, y, r * 0.8, s < 0.3 ? 0.32 : s < 0.6 ? -0.22 : 0.1, true); splat(G, N, x, y, r * 0.8, -0.12, true); } });
  // macro asphalt, 90 m tile: repair patches, crack-seal tar snakes (dark, smooth, raised), stains
  const macroTex = pbrTex(512, 202, 2.2, (H, A, G, R, N) => { const c = mkCanvas(N, N), g = c.getContext('2d');
    g.fillStyle = 'rgb(128,128,40)'; g.fillRect(0, 0, N, N);
    const rep = fn => { for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { g.save(); g.translate(ox, oy); fn(); g.restore(); } };
    for (let k = 0; k < 7; k++) { const x = R() * N, y = R() * N, w = 20 + R() * 90, h = 14 + R() * 50, v = R() < 0.6 ? 104 : 150, rr = R() < 0.6 ? 112 : 142; rep(() => { g.fillStyle = `rgb(${v},${rr},46)`; g.fillRect(x, y, w, h); g.strokeStyle = 'rgb(70,90,80)'; g.lineWidth = 1.2; g.strokeRect(x, y, w, h); }); }
    for (let k = 0; k < 24; k++) { const r = 4 + R() * 26, x = R() * N, y = R() * N, c0 = R() < 0.7 ? '84,108' : '160,146'; rep(() => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c0},40,.55)`); gr.addColorStop(1, `rgba(${c0},40,0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }); }
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let k = 0; k < 26; k++) { let x = R() * N, y = R() * N, a = R() * 6.28; const pts = [[x, y]], n = 6 + R() * 24; for (let j = 0; j < n; j++) { a += (R() - 0.5) * 1.1; x += Math.cos(a) * 6; y += Math.sin(a) * 6; pts.push([x, y]); }
      const w = 1 + R() * 1.4; rep(() => { g.strokeStyle = 'rgb(40,58,210)'; g.lineWidth = w; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); }); }
    const d = g.getImageData(0, 0, N, N).data; for (let k = 0; k < N * N; k++) { A[k] = d[k * 4] / 255; G[k] = d[k * 4 + 1] / 255; H[k] = d[k * 4 + 2] / 255 * 0.7; }
    addN(A, N, 8, 0.22, R); addN(A, N, 32, 0.1, R); addN(H, N, 32, 0.12, R); addN(G, N, 16, 0.12, R); });
  // grass, 4 m tile: blades and clumps
  const grassTex = pbrTex(512, 303, 1.1, (H, A, G, R, N) => {
    addN(A, N, 8, 0.3, R); addN(A, N, 32, 0.22, R); addN(A, N, 128, 0.2, R); addN(H, N, 128, 0.5, R); addN(H, N, 32, 0.3, R); addN(G, N, 16, 0.3, R);
    for (let k = 0; k < 16000; k++) { const x = R() * N, y = R() * N, a = R() * 6.28, L = 3 + R() * 9, v = (R() - 0.42) * 0.3;
      for (let s = 0; s < L; s++) { const i = ((Math.floor(y + Math.sin(a) * s) % N + N) % N) * N + ((Math.floor(x + Math.cos(a) * s) % N + N) % N); A[i] += v; H[i] += 0.25; } } });
  // water ripples, 40 m tile
  const waterTex = pbrTex(256, 404, 7.0, (H, A, G, R, N) => { addN(H, N, 8, 0.5, R); addN(H, N, 16, 0.35, R); addN(H, N, 32, 0.22, R); addN(H, N, 64, 0.12, R); });

  // ---------- green landscape: a procedural patchwork of fields, meadows, orchards, ponds and nallahs ----------
  // (the 2D map's farmland raster is not used here: the 3D view is a lush, monsoon-green Vidarbha)
  const GC = { x0: -22500, y0: -22000, w: 44000, h: 44000 }, GN = Math.min(2048, MAXT), RG = mulberry(9);
  const GREENS = ['#4c8229', '#3f7426', '#578a30', '#376824', '#5c9233', '#477d2f', '#518535', '#336326', '#5a8a2c', '#427a35', '#4e7f27', '#3b6e29'];
  const EARTH = ['#8a8452', '#7d7448', '#93a04a', '#86a345', '#9a9658', '#6e6243'];
  const ROT = 0.21, cR = Math.cos(ROT), sR = Math.sin(ROT), FCX = -500, FCY = 0;
  const toW = (u, v) => [FCX + u * cR - v * sR, FCY + u * sR + v * cR];
  const fields = [];
  for (let v = -33000; v < 33000;) { const rh = 240 + RG() * 520;
    for (let u = -33000; u < 33000;) { const fw = 200 + RG() * 760, c = toW(u + fw / 2, v + rh / 2);
      if (c[0] > GC.x0 - 800 && c[0] < GC.x0 + GC.w + 800 && c[1] > GC.y0 - 800 && c[1] < GC.y0 + GC.h + 800) { const k = RG(), e = RG();
        fields.push({ u, v, w: fw, h: rh, cx: c[0], cy: c[1], type: k < 0.1 ? 'orch' : k < 0.16 ? 'meadow' : 'field', col: e < 0.1 ? EARTH[Math.floor(RG() * EARTH.length)] : GREENS[Math.floor(RG() * GREENS.length)], hedge: RG(), lt: RG() }); }
      u += fw; }
    v += rh; }
  const ponds = [], nallahs = [];
  for (let k = 0; k < 40 && ponds.length < 18; k++) { const x = -500 + (RG() - 0.5) * 30000, y = (RG() - 0.5) * 30000; if (inAirport(x, y, 600)) continue; ponds.push([x, y, 70 + RG() * 200, 50 + RG() * 120, RG() * 3]); }
  for (let k = 0; k < 3; k++) { const pts = []; let x = GC.x0, y = [-7600, 6900, -15000][k] + (RG() - 0.5) * 1500, dy = 0; pts.push([x, y]);
    while (x < GC.x0 + GC.w) { x += 240 + RG() * 260; dy = dy * 0.6 + (RG() - 0.5) * 260; y += dy; if (inAirport(x, y, 400)) y += y > 0 ? 300 : -300; pts.push([x, y]); } nallahs.push(pts); }
  // landside roads, extended far out so they run off into the haze
  const roads = [], rails = [];
  for (const l of S.landside || []) { const pts = l.pts.map(p => p.slice());
    const ext = (i, j) => { const a = pts[i], b = pts[j]; if (Math.hypot(a[0], a[1]) < 6000) return; const L = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; const e = [a[0] + (a[0] - b[0]) / L * 26000, a[1] + (a[1] - b[1]) / L * 26000]; if (i === 0) pts.unshift(e); else pts.push(e); };
    if (l.kind === 'road') { ext(0, 1); ext(pts.length - 1, pts.length - 2); roads.push(pts); } else rails.push(pts); }
  const nearRoad = (x, y, m) => { for (const p of roads) for (let i = 1; i < p.length; i++) if (segD(x, y, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]) < m) return true; return false; };
  const nearWater = (x, y, m) => { for (const p of nallahs) for (let i = 1; i < p.length; i++) { const a = p[i - 1], b = p[i]; if (Math.abs(a[0] - x) > 700) continue; if (segD(x, y, a[0], a[1], b[0], b[1]) < m) return true; }
    for (const q of ponds) { const c = Math.cos(-q[4]), s = Math.sin(-q[4]), dx = x - q[0], dy = y - q[1], u = (dx * c - dy * s) / (q[2] + m), v = (dx * s + dy * c) / (q[3] + m); if (u * u + v * v < 1) return true; } return false; };

  // ---------- airside network (needed by the ground overlays, pavements, lights, signs) ----------
  const tws = S.taxiways.map(t => ({ kind: t.kind, pts: t.pts.map(p => [p[0], p[1]]), id: t.id }));
  const junc = [];  // junction points: polyline endpoints that sit on another polyline, shared vertices
  { const vcount = new Map(); for (const t of tws) for (const p of t.pts) { const k = p[0] + ',' + p[1]; vcount.set(k, (vcount.get(k) || 0) + 1); }
    for (const t of tws) for (let e = 0; e < 2; e++) { const p = e ? t.pts[t.pts.length - 1] : t.pts[0];
      let on = (vcount.get(p[0] + ',' + p[1]) || 0) > 1; if (!on) for (const o of tws) { if (o === t) continue; for (let i = 1; i < o.pts.length; i++) if (segD(p[0], p[1], o.pts[i - 1][0], o.pts[i - 1][1], o.pts[i][0], o.pts[i][1]) < 2) { on = true; break; } if (on) break; }
      if (on) junc.push([p[0], p[1]]); }
    for (const [k, n] of vcount) if (n > 1) { const [x, y] = k.split(',').map(Number); junc.push([x, y]); } }
  const exitPaths = [];
  for (const r of RW) for (const e of r.exits) { const to = nodeXY(e.to, null); if (!to) continue;
    const A = [e.x + 250, r.y], C = [e.x, r.y], L = Math.hypot(to[0] - C[0], to[1] - C[1]) || 1, dir = [(to[0] - C[0]) / L, (to[1] - C[1]) / L], t = Math.min(170, L * 0.45);
    const curve = bez([C[0] + 170, C[1]], C, [C[0] + dir[0] * t, C[1] + dir[1] * t], 14); curve.unshift(A); curve.push(to);
    exitPaths.push({ r, sharp: [A, C, to], curve, to }); junc.push(to); }
  const holds = [];
  for (const r of RW) for (const hk of r.holds) { const h = nodeXY(hk, null); if (h) holds.push([h[0], h[1], r]); }
  const clearOf = (x, y, m) => { for (const t of tws) for (let i = 1; i < t.pts.length; i++) if (segD(x, y, t.pts[i - 1][0], t.pts[i - 1][1], t.pts[i][0], t.pts[i][1]) < m + 12) return false;
    for (const e of exitPaths) for (let i = 1; i < e.curve.length; i++) if (segD(x, y, e.curve[i - 1][0], e.curve[i - 1][1], e.curve[i][0], e.curve[i][1]) < m + 12) return false;
    for (const r of RW) if (x > r.x0 - 70 && x < r.x1 + 70 && Math.abs(y - r.y) < m + 40) return false; return true; };
  // airside sites: localizer beyond the stop end (x0), glide slope and windsock by the threshold (x1), blast fence behind the threshold
  const sites = RW.map(r => { const side = s => clearOf(r.x1 - 320, r.y + s * 130, 25) ? s : -s, gs = side(-1), wsS = clearOf(r.x1 - 160, r.y - 95, 15) ? -1 : 1;
    let lx = r.x0 - 300; while (!clearOf(lx, r.y, 25) && lx > r.x0 - 700) lx -= 50;
    let bx = r.x1 + 170; while ((!clearOf(bx, r.y + 40, 6) || !clearOf(bx, r.y - 40, 6)) && bx < r.x1 + 600) bx += 25;
    return { r, gs: [r.x1 - 320, r.y + gs * 130], gsS: gs, ws: [[r.x1 - 160, r.y + wsS * 95], [r.x0 + 200, r.y - wsS * 95]], loc: [lx, r.y], blast: bx }; });

  // ---------- 1. terrain ----------
  const farmC = mkCanvas(GN, GN);
  { const g = farmC.getContext('2d'), k = GN / GC.w, R = mulberry(13); g.setTransform(k, 0, 0, k, -GC.x0 * k, -GC.y0 * k);
    g.fillStyle = '#4f6b34'; g.fillRect(GC.x0, GC.y0, GC.w, GC.h);   // bund / field-boundary colour shows through the gaps
    g.save(); g.translate(FCX, FCY); g.rotate(ROT);
    for (const f of fields) { g.fillStyle = f.type === 'orch' ? '#36652a' : f.type === 'meadow' ? '#5d9038' : f.col; g.fillRect(f.u + 6, f.v + 6, f.w - 12, f.h - 12);
      if (f.lt < 0.5) { g.fillStyle = `rgba(${f.lt < 0.25 ? '255,250,200' : '20,50,10'},${0.04 + f.lt * 0.12})`; g.fillRect(f.u + 6, f.v + 6, f.w - 12, f.h - 12); }
      // within-field variation: a wetter / greener end and a drier corner, so fields are not flat cards
      const gr = g.createLinearGradient(f.u, f.v, f.u + f.w, f.v + f.h); gr.addColorStop(0, `rgba(30,70,20,${0.05 + f.hedge * 0.1})`); gr.addColorStop(1, `rgba(200,190,110,${0.03 + f.lt * 0.08})`); g.fillStyle = gr; g.fillRect(f.u + 6, f.v + 6, f.w - 12, f.h - 12);
      if (f.type === 'orch') { g.fillStyle = 'rgba(28,70,24,.75)'; for (let y = f.v + 12; y < f.v + f.h - 8; y += 30) g.fillRect(f.u + 8, y, f.w - 16, 12); }
      else if (f.type === 'field' && f.lt > 0.6) { g.fillStyle = 'rgba(255,255,220,.06)'; for (let y = f.v + 10; y < f.v + f.h - 10; y += 44) g.fillRect(f.u + 8, y, f.w - 16, 18); } }
    g.strokeStyle = 'rgba(30,64,24,.9)'; g.lineWidth = 18;
    for (const f of fields) if (f.hedge < 0.35) { g.beginPath(); g.moveTo(f.u, f.v + f.h); g.lineTo(f.u, f.v); g.lineTo(f.u + f.w, f.v); g.stroke(); }
    // farm tracks between fields
    g.strokeStyle = 'rgba(150,132,96,.55)'; g.lineWidth = 9; for (const f of fields) if (f.lt > 0.82) { g.beginPath(); g.moveTo(f.u + f.w, f.v); g.lineTo(f.u + f.w, f.v + f.h); g.stroke(); }
    g.restore();
    // big soft meadow patches so the patchwork never reads as a grid
    for (let i = 0; i < 260; i++) { const x = GC.x0 + R() * GC.w, y = GC.y0 + R() * GC.h, r = 300 + R() * 1400, gr = g.createRadialGradient(x, y, 0, x, y, r);
      const c = R() < 0.5 ? '88,138,54' : R() < 0.5 ? '46,96,38' : '112,150,66'; gr.addColorStop(0, `rgba(${c},.3)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    // water: nallahs with green banks, ponds
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const p of nallahs) { g.beginPath(); p.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.strokeStyle = '#2d5d25'; g.lineWidth = 110; g.stroke(); g.strokeStyle = '#6b6646'; g.lineWidth = 34; g.stroke(); }
    for (const q of ponds) { g.fillStyle = '#2d5d25'; g.beginPath(); g.ellipse(q[0], q[1], q[2] + 45, q[3] + 45, q[4], 0, 7); g.fill(); g.fillStyle = '#6b6646'; g.beginPath(); g.ellipse(q[0], q[1], q[2] + 8, q[3] + 8, q[4], 0, 7); g.fill(); }
    // the airport: neatly mown, with graded strips along the runways and taxiways (detail comes from the airfield overlay)
    g.fillStyle = '#4a7d29'; g.fillRect(AX0 - 60, AY0 - 60, AX1 - AX0 + 120, AY1 - AY0 + 120);
    g.fillStyle = '#4d852b'; g.fillRect(AX0, AY0, AX1 - AX0, AY1 - AY0);
  }
  const farmTex = mkTex(farmC, true, false); farmTex.wrapS = farmTex.wrapT = THREE.ClampToEdgeWrapping;
  // airfield overlays (world space, ~6 m/px): aptC tints the grass (graded strips, worn edges by the pavement, dirt tracks,
  // drainage, dry and lush patches); paveC holds pavement stains (R: oil / tyre wear on aprons and taxiway centrelines)
  const APB = new THREE.Vector4(AX0 - 600, AY0 - 600, AX1 - AX0 + 1200, AY1 - AY0 + 1200), APW = 1536, APH = Math.round(APW * APB.w / APB.z), AK = APW / APB.z;
  const aptC = mkCanvas(APW, APH), paveC = mkCanvas(APW, APH);
  { const g = aptC.getContext('2d'), R = mulberry(17); g.setTransform(AK, 0, 0, AK, -APB.x * AK, -APB.y * AK); g.lineCap = 'round'; g.lineJoin = 'round';
    const line = (pts, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); };
    for (let i = 0; i < 420; i++) { const x = AX0 + R() * (AX1 - AX0), y = AY0 + R() * (AY1 - AY0), r = 30 + R() * 160, gr = g.createRadialGradient(x, y, 0, x, y, r), c = R() < 0.55 ? '44,84,30' : R() < 0.6 ? '128,140,70' : '96,128,52';
      gr.addColorStop(0, `rgba(${c},.32)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    for (const r of RW) { g.fillStyle = 'rgba(104,146,60,.30)'; g.fillRect(r.x0 - 150, r.y - 150, r.len + 300, 300);
      // drainage swales, lush and dark, either side of the strip; patrol tracks just inside them
      for (const s of [-1, 1]) { line([[r.x0 - 120, r.y + s * 165], [r.x1 + 120, r.y + s * 165]], 9, 'rgba(34,70,26,.55)'); line([[r.x0 - 80, r.y + s * 182], [r.x1 + 60, r.y + s * 182]], 5, 'rgba(146,128,92,.6)'); }
      g.fillStyle = 'rgba(132,122,82,.30)'; g.fillRect(r.x0 - 72, r.y - 50, r.len + 144, 100); g.fillStyle = 'rgba(126,116,76,.45)'; g.fillRect(r.x0 - 66, r.y - 44, r.len + 132, 88); }
    for (const t of tws) { if (t.kind === 'taxilane') continue; line(t.pts, 120, 'rgba(100,142,58,.18)'); line(t.pts, 40, 'rgba(130,120,80,.32)'); line(t.pts, 31, 'rgba(126,116,78,.4)'); }
    for (const x of exitPaths) { line(x.curve, 38, 'rgba(130,120,80,.32)'); }
    for (const d of S.aprons || []) { try { const p = new Path2D(d); g.strokeStyle = 'rgba(128,118,80,.45)'; g.lineWidth = 14; g.stroke(p); } catch (e) { /* Path2D unsupported */ } }
    // service tracks to the ILS, glide slope and windsock sites
    for (const s of sites) { line([[s.loc[0], s.loc[1] + 30], [AX0 + 25, s.loc[1] + 30]], 6, 'rgba(150,132,96,.7)'); line([s.gs, [s.gs[0], s.gs[1] + s.gsS * 60], [AX1 - 25, s.gs[1] + s.gsS * 60]], 5, 'rgba(150,132,96,.65)'); }
    line([[AX0 + 50, AY0 + 50], [AX1 - 50, AY0 + 50], [AX1 - 50, AY1 - 50], [AX0 + 50, AY1 - 50], [AX0 + 50, AY0 + 50]], 6, 'rgba(146,128,92,.6)'); }
  { const g = paveC.getContext('2d'), R = mulberry(19); g.fillStyle = '#000'; g.fillRect(0, 0, APW, APH); g.setTransform(AK, 0, 0, AK, -APB.x * AK, -APB.y * AK); g.lineCap = 'round'; g.globalCompositeOperation = 'lighter';
    const line = (pts, w, a) => { g.strokeStyle = `rgba(255,0,0,${a})`; g.lineWidth = w; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); };
    for (const t of tws) { line(t.pts, 10, 0.08); line(t.pts, 3.5, 0.28); }
    for (const x of exitPaths) line(x.curve, 3.5, 0.2);
    for (const h of holds) { g.fillStyle = 'rgba(255,0,0,.35)'; g.beginPath(); g.ellipse(h[0], h[1] - Math.sign(h[2].y - h[1]) * 25, 7, 26, 0, 0, 7); g.fill(); }
    for (const gt of Z.GATES) { const ca = Math.cos(gt.a), sa = Math.sin(gt.a), L = nodeXY(gt.lane, null);
      if (L) line([L, [gt.x + ca * 30, gt.y + sa * 30], [gt.x - ca * 20, gt.y - sa * 20]], 3, 0.3);
      g.save(); g.translate(gt.x, gt.y); g.rotate(gt.a); g.fillStyle = `rgba(255,0,0,${0.18 + R() * 0.14})`; g.beginPath(); g.ellipse(-4, 0, 38, 16, 0, 0, 7); g.fill(); g.fillStyle = `rgba(255,0,0,${0.2 + R() * 0.15})`; g.beginPath(); g.ellipse(-2, 0, 24, 8, 0, 0, 7); g.fill();
      g.fillStyle = `rgba(255,0,0,${0.18 + R() * 0.2})`; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(-6 + R() * 4, s * (7 + R() * 5), 4 + R() * 3, 3, 0, 0, 7); g.fill(); }
      g.beginPath(); g.ellipse(14, 0, 5, 3, 0, 0, 7); g.fill(); g.restore(); }
    for (let k = 0; k < 900; k++) { const x = AX0 + R() * (AX1 - AX0), y = AY0 + R() * (AY1 - AY0), r = 2 + R() * 8; g.fillStyle = `rgba(255,0,0,${0.05 + R() * 0.15})`; g.beginPath(); g.ellipse(x, y, r, r * (0.4 + R() * 0.6), R() * 3, 0, 7); g.fill(); } }
  const aptTex = mkTex(aptC, true, false), paveTex = mkTex(paveC, false, false); aptTex.wrapS = aptTex.wrapT = paveTex.wrapS = paveTex.wrapT = THREE.ClampToEdgeWrapping;

  const groundShape = new THREE.Shape(); { const E = 120000; groundShape.moveTo(-E, -E); groundShape.lineTo(E, -E); groundShape.lineTo(E, E); groundShape.lineTo(-E, E); groundShape.closePath(); groundShape.holes.push(foreHole()); }
  const groundGeo = new THREE.ShapeGeometry(groundShape, 1); groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, envMapIntensity: 0.75 });
  groundMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { farm: { value: farmTex }, dtl: { value: noiseTex }, grT: { value: grassTex }, aptT: { value: aptTex }, gcv: { value: new THREE.Vector4(GC.x0, GC.y0, GC.w, GC.h) }, apb: { value: APB },
      baseCol: { value: lin('#477a26') }, rot: { value: new THREE.Vector3(Math.cos(ROT), Math.sin(ROT), 0) }, nglow: { value: 0 }, dry: { value: 0 }, apt: { value: new THREE.Vector4(AX0, AY0, AX1, AY1) } });
    sh.vertexShader = 'varying vec2 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xz;');
    sh.fragmentShader = 'uniform sampler2D farm;uniform sampler2D dtl;uniform sampler2D grT;uniform sampler2D aptT;uniform vec4 gcv;uniform vec4 apt;uniform vec4 apb;uniform vec3 baseCol;uniform vec3 rot;uniform float nglow,dry;varying vec2 vWP;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `
      vec2 tuv=(vWP-gcv.xy)/gcv.zw;
      vec3 fcol=texture2D(farm,vec2(clamp(tuv.x,0.0004,0.9996),1.0-clamp(tuv.y,0.0004,0.9996))).rgb;
      float em=min(min(tuv.x,1.0-tuv.x),min(tuv.y,1.0-tuv.y))*gcv.z;
      float fade=smoothstep(0.0,5000.0,em);
      float gd=length(vViewPosition);
      vec3 n1=texture2D(dtl,vWP*0.00007).rgb; vec3 n2=texture2D(dtl,vWP*0.00041+0.37).rgb;
      vec3 n3=texture2D(dtl,vWP*0.0029+0.13).rgb; vec3 n4=texture2D(dtl,vWP*0.0171+0.71).rgb; vec3 n5=texture2D(dtl,vWP*0.083+0.29).rgb;
      vec3 base=baseCol*(0.8+0.34*n1.r);
      base=mix(base,base*vec3(0.78,0.9,0.78),smoothstep(0.5,0.72,n2.g)*0.8);
      base=mix(base,base*vec3(1.16,1.1,0.86),smoothstep(0.55,0.75,n2.r)*0.6);
      vec3 gc=mix(base,fcol,fade);
      float inA=step(apt.x,vWP.x)*step(vWP.x,apt.z)*step(apt.y,vWP.y)*step(vWP.y,apt.w);
      float c3=(n3.g-0.5)*2.0,c3b=(n3.r-0.5)*2.0,c4=(n4.g-0.5)*2.0,c4b=(n4.b-0.5)*2.0,c5=(n5.b-0.5)*2.0;
      gc*=mix(vec3(1.0),vec3(0.76,0.9,0.7),smoothstep(0.0,0.45,c3)*0.85);
      gc*=mix(vec3(1.0),vec3(1.2,1.1,0.72),smoothstep(0.1,0.55,c3b)*mix(0.3,0.65,inA));
      gc*=1.0+0.3*c4+0.16*c5;
      gc*=mix(vec3(1.0),vec3(1.12,1.05,0.82),smoothstep(0.15,0.55,c4b)*0.45);
      vec2 aq=(vWP-apb.xy)/apb.zw; vec4 ap=texture2D(aptT,vec2(aq.x,1.0-aq.y));
      ap.a*=step(0.0,aq.x)*step(aq.x,1.0)*step(0.0,aq.y)*step(aq.y,1.0)*smoothstep(0.0,0.03,min(min(aq.x,1.0-aq.x),min(aq.y,1.0-aq.y)));
      gc=mix(gc,ap.rgb,ap.a);
      float cv=(-(vWP.x+500.0)*rot.y+vWP.y*rot.x)/6.5;float cfw=fwidth(cv);
      gc*=1.0+(1.0-inA)*(1.0-smoothstep(0.2,0.6,cfw))*smoothstep(0.45,0.6,n4.r)*0.07*sin(cv*6.2832);
      float fg=1.0-smoothstep(25.0,650.0,gd);
      vec4 gt=texture2D(grT,vWP*0.23); vec4 gu=texture2D(grT,vWP*0.97+vec2(0.41,0.17));
      gc*=mix(1.0,(0.88+0.24*gt.r)*(0.9+0.2*gu.r),fg*fg);
      // close-range detail: mowing rows in the runway strips (9 m passes along the runways), dry tufts at ~2 m,
      // and a drier, straw-tinted field in the 46 C heat level (still green overall)
      float mw=vWP.y/9.0,mwf=fwidth(mw);float mowK=inA*(1.0-ap.a)*(1.0-smoothstep(0.15,0.45,mwf))*(1.0-smoothstep(600.0,2200.0,gd));
      gc*=1.0+mowK*0.055*(step(0.5,fract(mw))*2.0-1.0)*(0.7+0.3*n4.g);
      vec3 n6=texture2D(dtl,vWP*0.47+0.53).rgb;float tuft=smoothstep(0.62-0.12*dry,0.8,n6.b*0.7+n5.g*0.3)*(1.0-smoothstep(40.0,420.0,gd));
      gc=mix(gc,gc*vec3(1.32,1.16,0.68),tuft*(0.5+0.3*dry));
      gc=mix(gc,gc*vec3(1.16,1.06,0.74),dry*(0.22+0.2*smoothstep(0.4,0.7,n3.r)));
      float gRough=0.9+0.12*(gt.g-0.5)*fg+0.06*tuft;
      vec2 gq=(gt.ba*2.0-1.0)*0.6*fg+(gu.ba*2.0-1.0)*0.45*fg*fg;
      vec3 gN=vec3(gq.x,1.0,gq.y);
      diffuseColor.rgb*=gc;totalEmissiveRadiance+=gc*vec3(0.55,0.65,1.0)*nglow;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=gRough;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal=normalize((viewMatrix*vec4(normalize(gN),0.0)).xyz);');
    groundMat.userData.sh = sh;
  };
  groundMat.customProgramCacheKey = () => 'zmhGround3';
  const ground = new THREE.Mesh(groundGeo, groundMat); ground.receiveShadow = true; ground.renderOrder = -40; ground.frustumCulled = false; root.add(ground);

  // ---------- water: ponds and nallahs, reflecting the sky, ripples drifting with the wind ----------
  const WU = { tW: { value: waterTex }, uWt: { value: new THREE.Vector4(0, 0, 0.3, 0) } };
  { const B = newB(1), col = WHITE;
    for (const q of ponds) { const c = vtx(B, q[0], q[1], 0.04, col, 0, 0), ring = [], ca = Math.cos(q[4]), sa = Math.sin(q[4]);
      for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2, wob = 1 + 0.07 * Math.sin(a * 3 + q[4] * 5) + 0.04 * Math.sin(a * 7 + q[0]), ex = Math.cos(a) * q[2] * wob, ey = Math.sin(a) * q[3] * wob; ring.push(vtx(B, q[0] + ex * ca - ey * sa, q[1] + ex * sa + ey * ca, 0.04, col, 0, 0)); }
      for (let k = 0; k < 28; k++) tri(B, c, ring[k], ring[(k + 1) % 28]); }
    for (const p of nallahs) { for (let i = 1; i < p.length; i++) quad(B, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], 12, 0.04, col, 0, 0); for (let i = 1; i < p.length - 1; i++) disc(B, p[i][0], p[i][1], 12, 0.04, col, 8, [0, 0]); }
    const wm = new THREE.MeshStandardMaterial({ color: '#1e3a34', roughness: 0.07, metalness: 0, envMapIntensity: 1.2 });
    wm.onBeforeCompile = sh => { Object.assign(sh.uniforms, WU);
      sh.vertexShader = 'varying vec2 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xz;');
      sh.fragmentShader = 'uniform sampler2D tW;uniform vec4 uWt;varying vec2 vWP;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec4 w1=texture2D(tW,vWP*0.025+uWt.xy*0.012); vec4 w2=texture2D(tW,vWP*0.061+vec2(-uWt.y,uWt.x)*0.017+0.5);
        vec2 wq=((w1.ba*2.0-1.0)+(w2.ba*2.0-1.0)*0.7)*uWt.z*(1.0-0.6*smoothstep(300.0,5000.0,length(vViewPosition)));
        normal=normalize((viewMatrix*vec4(normalize(vec3(wq.x,1.0,wq.y)),0.0)).xyz);`); };
    wm.customProgramCacheKey = () => 'zmhWater';
    flatLayer(new THREE.Mesh(geoOf(B), wm), -39.5); }

  // ---------- pavement material: Standard + world-space PBR detail (asphalt aggregate, patches, tar snakes, slab joints, stains) ----------
  // kinds: 0 taxiway (vertex colours; light ones are concrete), 1 apron concrete, 2 runway (canvas map), 3 road (canvas map)
  const PU = { tA: { value: asphTex }, tM: { value: macroTex }, tP: { value: paveTex }, apb: { value: APB }, wet: { value: 0 } };
  const PAVE = `
    float pd=length(vViewPosition);
    float fd=1.0-smoothstep(30.0,650.0,pd), fm=1.0-smoothstep(1500.0,12000.0,pd);
    vec4 mi=texture2D(tA,vWP*0.16667); vec4 mj=texture2D(tA,vWP*0.59+vec2(0.37,0.11));
    vec4 ma=texture2D(tM,vWP*0.011); vec4 mb=texture2D(tM,vWP.yx*0.0073+vec2(0.5,0.21));
    vec2 pq=(vWP-apb.xy)/apb.zw; vec4 ps=texture2D(tP,vec2(pq.x,1.0-pq.y));
    float lum0=dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722));
    float alb=mix(1.0,(0.74+0.52*mi.r)*(0.86+0.28*mj.r),fd);
    alb*=mix(1.0,(0.62+0.76*ma.r)*(0.8+0.4*mb.r),fm);
    float pr=0.86+(ma.g-0.5)*0.45*fm+(mb.g-0.5)*0.15+(mi.g-0.5)*0.2*fd;
    vec2 nq=(mi.ba*2.0-1.0)*0.8*fd+(mj.ba*2.0-1.0)*0.5*fd*fd+(ma.ba*2.0-1.0)*0.3*fm;
    float cc=PK==1?1.0:(PK==0?smoothstep(0.12,0.25,lum0):0.0);
    if(cc>0.0){vec2 sl=vWP*0.2;vec2 sid=floor(sl);vec2 sf=fract(sl);vec2 sw=fwidth(sl);float swm=max(sw.x,sw.y);
      float hs=fract(sin(dot(sid,vec2(12.9898,78.233)))*43758.5453);
      vec2 jd=min(sf,1.0-sf);vec2 jm=1.0-smoothstep(vec2(0.003),vec2(0.003)+sw*1.5,jd);
      float jt=max(jm.x,jm.y)*(1.0-smoothstep(0.04,0.18,swm));
      vec2 bid=floor(vWP/vec2(55.0,40.0));float hb=fract(sin(dot(bid,vec2(41.3,17.9)))*24634.63);
      alb*=mix(1.0,(1.0+(hb-0.5)*0.12)*(1.0+(hs-0.5)*0.1*(1.0-smoothstep(0.1,0.6,swm)))*(1.0-0.38*jt),cc);
      pr+=(0.08*jt-0.04)*cc; nq*=1.0-0.4*cc;}
    float oil=PK==2?0.0:ps.r; alb*=1.0-0.6*oil; pr-=0.3*oil;
    if(PK>=2){float paint=smoothstep(0.1,0.32,lum0);float rub=1.0-smoothstep(0.012,0.03,lum0);
      alb=mix(alb,0.9+0.1*alb,paint);pr=mix(pr,0.6,paint)-0.22*rub;nq*=1.0-0.5*paint;}
    alb*=1.0-0.22*wet; pr=mix(pr,0.35+0.25*(pr-0.86),wet); nq*=1.0-0.6*wet;   // the andhi's rain tail: darker, glossy pavement
    diffuseColor.rgb*=alb; float pRgh=clamp(pr,0.18,1.0); vec3 pN=vec3(nq.x,1.0,nq.y);`;
  function paveMat(kind, opts) {
    const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.86, metalness: 0, envMapIntensity: 0.5 }, opts));
    m.onBeforeCompile = sh => { Object.assign(sh.uniforms, PU);
      sh.vertexShader = 'varying vec2 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xz;');
      sh.fragmentShader = `#define PK ${kind}\nuniform sampler2D tA;uniform sampler2D tM;uniform sampler2D tP;uniform vec4 apb;uniform float wet;varying vec2 vWP;\n` + sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + PAVE)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=pRgh;')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal=normalize((viewMatrix*vec4(normalize(pN),0.0)).xyz);'); };
    m.customProgramCacheKey = () => 'zmhPave' + kind; return m; }

  // ---------- 2. landside roads (28 m, lane markings) and rail (dashed, faint) ----------
  const roadC = mkCanvas(512, 64); { const g = roadC.getContext('2d'), R = mulberry(21); g.fillStyle = '#4b4a47'; g.fillRect(0, 0, 512, 64);
    for (let k = 0; k < 1800; k++) { g.fillStyle = R() < .5 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.05)'; g.fillRect(R() * 512, R() * 64, 1 + R() * 5, 1); }
    g.fillStyle = '#8f8b80'; g.fillRect(0, 28, 512, 8); g.fillStyle = '#5a6236'; g.fillRect(0, 29.5, 512, 5);
    g.fillStyle = 'rgba(236,234,226,.9)'; g.fillRect(0, 2, 512, 1.6); g.fillRect(0, 60.4, 512, 1.6); g.fillRect(0, 26, 512, 1); g.fillRect(0, 37, 512, 1);
    for (const x of [0, 256]) { g.fillRect(x, 13.5, 96, 1.4); g.fillRect(x, 49, 96, 1.4); }
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let k = 0; k < 6; k++) { g.fillRect(0, 6 + k * 3.4, 512, 0.6); g.fillRect(0, 40 + k * 3.4, 512, 0.6); } }
  const roadTex = mkTex(roadC, true, false); roadTex.wrapS = THREE.RepeatWrapping; roadTex.wrapT = THREE.ClampToEdgeWrapping;
  { const B = newB(1), col = WHITE;
    for (const p0 of roads) { const p = simplify(p0); let d = 0;
      for (let i = 1; i < p.length; i++) { const L = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); quad(B, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], 14, 0.05, col, d / 48, (d + L) / 48); d += L; }
      for (let i = 1; i < p.length - 1; i++) disc(B, p[i][0], p[i][1], 14, 0.05, col, 14, [0.02, 0.3]); }
    flatLayer(new THREE.Mesh(geoOf(B), paveMat(3, { map: roadTex })), -39); }

  // ---------- 3. aprons (concrete slabs with sealed joints, per-slab tone, oil and tyre stains at the stands) ----------
  const apronShapes = []; for (const d of S.aprons || []) for (const s of pathShapes(d)) apronShapes.push(s);
  if (apronShapes.length) { const g = new THREE.ShapeGeometry(apronShapes, 6); g.rotateX(-Math.PI / 2); g.translate(0, 0.08, 0);
    flatLayer(new THREE.Mesh(g, paveMat(1, { color: '#b1ada2', roughness: 0.82 })), -38); }

  // ---------- 4. taxiways, exits, shoulders, blast pads, perimeter and service roads, rail ----------
  const ASPH = lin('#4f5254'), LANE = lin('#aaa69c'), SHLD = lin('#6c6e6a'), PAD = lin('#5f605e'), PERIM = lin('#625f59'), RAIL = lin('#6e7480');
  const LB = newB(1);  // markings (yellow/white lines), fades out with distance
  const YEL = lin('#e5b52a'), RED = lin('#b8322a');
  const twB = newB(22);
  for (const t of tws) { const col = t.kind === 'taxilane' ? LANE : ASPH, p = simplify(t.pts);
    for (let i = 1; i < p.length; i++) quad(twB, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], 11.5, 0.1, col);
    for (let i = 0; i < p.length; i++) disc(twB, p[i][0], p[i][1], 11.5, 0.1, col, 12); }
  for (const x of exitPaths) { for (const p of [x.sharp, x.curve]) { for (let i = 1; i < p.length; i++) quad(twB, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], 11.5, 0.1, ASPH); for (let i = 1; i < p.length - 1; i++) disc(twB, p[i][0], p[i][1], 11.5, 0.1, ASPH, 10); } }
  for (const j of junc) disc(twB, j[0], j[1], 16, 0.1, ASPH, 16);
  for (const r of RW) { quad(twB, r.x0 - 60, r.y, r.x1 + 60, r.y, 38, 0.1, SHLD); rect(twB, r.x0 - 60, r.y - 30, r.x0, r.y + 30, 0.1, PAD); rect(twB, r.x1, r.y - 30, r.x1 + 60, r.y + 30, 0.1, PAD);
    for (const [xe, s] of [[r.x0, -1], [r.x1, 1]]) for (let k = 0; k < 3; k++) { const ax = xe + s * (12 + k * 16); for (const side of [-1, 1]) quad(LB, ax, r.y, ax + s * 20, r.y + side * 26, 0.6, 0.2, YEL); } }
  { const pr = [[AX0 + 25, AY0 + 25], [AX1 - 25, AY0 + 25], [AX1 - 25, AY1 - 25], [AX0 + 25, AY1 - 25], [AX0 + 25, AY0 + 25]]; for (let i = 1; i < pr.length; i++) quad(twB, pr[i - 1][0], pr[i - 1][1], pr[i][0], pr[i][1], 3.5, 0.1, PERIM); for (const p of pr) disc(twB, p[0], p[1], 3.5, 0.1, PERIM, 8); }
  for (const s of sites) { quad(twB, s.loc[0] + 8, s.loc[1] + 30, AX0 + 25, s.loc[1] + 30, 2.5, 0.1, PERIM); rect(twB, s.loc[0] - 4, s.loc[1] + 26, s.loc[0] + 10, s.loc[1] + 36, 0.1, PERIM); }
  for (const p of rails) walk(p, 70, (x, y, dx, dy) => { if (inAirport(x, y, 150)) return; quad(twB, x, y, x + dx * 40, y + dy * 40, 3, 0.1, RAIL); });
  flatLayer(new THREE.Mesh(geoOf(twB), paveMat(0, { vertexColors: true })), -37);

  // ---------- 5. runways: one atlas canvas (a band per runway), one mesh ----------
  const RWH = 192, RWW = Math.min(MAXT, 8192, Math.round(Math.max(...RW.map(r => r.len)) * 1.45)), rwC = mkCanvas(RWW, RWH * RW.length), rg = rwC.getContext('2d'), rwB = newB(1);
  RW.forEach((r, ri) => {
    const len = r.len, W = Math.min(RWW, Math.round(len * 1.45)), H = RWH, g = rg, R = mulberry(100 + Math.round(r.y));
    const sx = W / len, sy = H / 76; g.setTransform(sx, 0, 0, sy, 0, ri * H + 38 * sy);
    g.save(); g.beginPath(); g.rect(0, -38, len, 76); g.clip();
    g.fillStyle = '#5f615f'; g.fillRect(0, -38, len, 76);
    for (let k = 0; k < 2500; k++) { g.fillStyle = R() < .5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.05)'; g.fillRect(R() * len, (R() < .5 ? -38 : 30) + R() * 8, 3 + R() * 20, 0.5 + R()); }
    g.fillStyle = '#383a3b'; g.fillRect(0, -30, len, 60);
    // paving lanes (laid in 7.5 m passes) of slightly different age, longitudinal joints
    for (let y = -30; y < 30; y += 7.5) { g.fillStyle = `rgba(${R() < .5 ? '0,0,0' : '255,255,255'},${0.015 + R() * 0.03})`; g.fillRect(0, y, len, 7.5); }
    for (const end of [0, len - 320]) { g.fillStyle = '#4a4b4b'; g.fillRect(end, -30, 320, 60); g.fillStyle = 'rgba(0,0,0,.25)'; for (let x = end; x <= end + 320; x += 7.5) g.fillRect(x, -30, 0.25, 60); for (let y = -30; y <= 30; y += 7.5) g.fillRect(end, y, 320, 0.25); }
    for (let k = 0; k < 9000; k++) { g.fillStyle = R() < .5 ? `rgba(0,0,0,${.03 + R() * .04})` : `rgba(255,255,255,${.015 + R() * .03})`; g.fillRect(R() * len, -30 + R() * 60, 2 + R() * 28, 0.4 + R() * 1.4); }
    g.fillStyle = 'rgba(0,0,0,.12)'; for (let y = -22.5; y < 30; y += 7.5) g.fillRect(0, y - 0.15, len, 0.3);
    // markings
    g.fillStyle = '#f1f0e9';
    g.fillRect(0, -29.6, len, 0.9); g.fillRect(0, 28.7, len, 0.9);
    for (let x = 110; x < len - 140; x += 50) g.fillRect(x, -0.45, 30, 0.9);
    const nm = r.name.split('/'), parse = s => { const m = /^(\d+)([A-Z]?)$/.exec(s || ''); return m ? [m[1], m[2]] : [s || '', '']; };
    for (const [thr, s, des] of [[0, 1, parse(nm[0])], [len, -1, parse(nm[1] || nm[0])]]) {
      for (let i = 0; i < 8; i++) for (const sd of [-1, 1]) { const y0 = sd * (3 + i * 3.4); g.fillRect(Math.min(thr + s * 6, thr + s * 36), sd > 0 ? y0 : y0 - 1.8, 30, 1.8); }
      for (const [d, n] of [[150, 3], [300, 3], [600, 2], [750, 2], [900, 1]]) for (let k = 0; k < n; k++) for (const sd of [-1, 1]) { const y0 = sd * (9 + k * 3.3); g.fillRect(Math.min(thr + s * d, thr + s * (d + 22.5)), sd > 0 ? y0 : y0 - 1.8, 22.5, 1.8); }
      for (const sd of [-1, 1]) { const y0 = sd * 9.5; g.fillRect(Math.min(thr + s * 400, thr + s * 460), sd > 0 ? y0 : y0 - 9, 60, 9); }
      g.font = 'bold 12px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const txt = (t, lx) => { g.save(); g.translate(lx, 0); g.rotate(s > 0 ? Math.PI / 2 : -Math.PI / 2); g.scale(0.5, 1); g.fillText(t, 0, 0); g.restore(); };
      if (des[1]) { txt(des[1], thr + s * 53); txt(des[0], thr + s * 72); } else txt(des[0], thr + s * 56);
    }
    // worn paint: flecks of asphalt showing through the markings
    for (let k = 0; k < 2500; k++) { g.fillStyle = `rgba(56,58,59,${0.25 + R() * 0.4})`; const x = R() < 0.5 ? R() * 1000 : len - R() * 1000; g.fillRect(x, -30 + R() * 60, 0.3 + R() * 1.2, 0.2 + R() * 0.4); }
    // tyre rubber: heavy in the touchdown zone near x1, light near x0
    for (let k = 0; k < 2600; k++) { const d = 140 + Math.pow(R(), 1.7) * 1100, lx = len - d, gear = R() < .8; const ly = gear ? (R() < .5 ? -1 : 1) * (3 + R() * 9) : (R() - 0.5) * 4;
      g.fillStyle = `rgba(8,8,8,${(0.09 + 0.16 * (1 - d / 1300)) * (gear ? 1 : 0.6)})`; g.beginPath(); g.ellipse(lx, ly, 8 + R() * 40, 0.6 + R() * 1.8, 0, 0, 7); g.fill(); }
    for (let k = 0; k < 900; k++) { const d = 150 + Math.pow(R(), 1.5) * 750; g.fillStyle = `rgba(10,10,10,${0.05 + 0.06 * (1 - d / 900)})`; g.beginPath(); g.ellipse(d, (R() - 0.5) * 22, 10 + R() * 30, 0.6 + R() * 1.4, 0, 0, 7); g.fill(); }
    g.restore();
    const TH = RWH * RW.length, u1 = W / RWW, vT = 1 - ri * H / TH, vB = 1 - (ri + 1) * H / TH;
    const a = vtx(rwB, r.x0, r.y - 38, 0.15, WHITE, 0, vT), b = vtx(rwB, r.x1, r.y - 38, 0.15, WHITE, u1, vT), cc = vtx(rwB, r.x1, r.y + 38, 0.15, WHITE, u1, vB), d = vtx(rwB, r.x0, r.y + 38, 0.15, WHITE, 0, vB);
    tri(rwB, a, b, cc); tri(rwB, a, cc, d);
  });
  const rwTex = mkTex(rwC, true, false); rwTex.wrapS = rwTex.wrapT = THREE.ClampToEdgeWrapping;
  flatLayer(new THREE.Mesh(geoOf(rwB), paveMat(2, { map: rwTex, roughness: 0.86 })), -36);

  // ---------- 6. markings: taxi centrelines, exit lead-offs, hold-short bars, stand lead-ins ----------
  for (const t of tws) { const p = simplify(t.pts); for (let i = 1; i < p.length; i++) quad(LB, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], 0.5, 0.2, YEL); }
  for (const x of exitPaths) { const p = x.curve; for (let i = 1; i < p.length; i++) quad(LB, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], 0.5, 0.2, YEL); }
  for (const h of holds) { const s = Math.sign(h[2].y - h[1]) || 1;
    for (const [o, dash] of [[-1.7, 0], [-0.5, 0], [0.7, 1], [1.9, 1]]) { const y = h[1] + s * o; if (!dash) quad(LB, h[0] - 12, y, h[0] + 12, y, 0.3, 0.2, YEL); else for (let x = -12; x < 12; x += 3) quad(LB, h[0] + x, y, h[0] + x + 1.8, y, 0.3, 0.2, YEL); } }
  for (const g of Z.GATES) { const L = nodeXY(g.lane, null); if (!L) continue; const ca = Math.cos(g.a), sa = Math.sin(g.a), sx = g.x + ca * 30, sy = g.y + sa * 30;
    quad(LB, L[0], L[1], sx, sy, 0.45, 0.2, YEL); quad(LB, sx - sa * 5, sy + ca * 5, sx + sa * 5, sy - ca * 5, 0.6, 0.2, YEL);
    quad(LB, g.x - ca * 40 - sa * 26, g.y - sa * 40 + ca * 26, g.x + ca * 34 - sa * 26, g.y + sa * 34 + ca * 26, 0.25, 0.2, RED);
    quad(LB, g.x - ca * 40 + sa * 26, g.y - sa * 40 - ca * 26, g.x + ca * 34 + sa * 26, g.y + sa * 34 - ca * 26, 0.25, 0.2, RED); }
  const linesMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, transparent: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, depthWrite: false, opacity: 1 });
  const linesMesh = flatLayer(new THREE.Mesh(geoOf(LB), linesMat), -35);

  // ---------- 7. runway mode wash ----------
  const washGeo = new THREE.PlaneGeometry(1, 1); washGeo.rotateX(-Math.PI / 2);
  const washes = RW.map((r, i) => {
    const m = new THREE.ShaderMaterial({ transparent: false, depthWrite: false, depthFunc: THREE.AlwaysDepth, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { cA: { value: new THREE.Vector3() }, cB: { value: new THREE.Vector3() }, p: { value: 2 }, al: { value: 0.3 }, chg: { value: -1 }, closed: { value: 0 }, t: { value: 0 }, heat: { value: 0 }, len: { value: r.len }, far: { value: 1 }, vis: { value: 50000 } },
      vertexShader: 'varying vec2 vUv;varying vec2 vW;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.0);vW=w.xz;gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader: `uniform vec3 cA,cB;uniform float p,al,chg,closed,t,heat,len,far,vis;varying vec2 vUv;varying vec2 vW;
        void main(){float s=1.0-vUv.x;vec3 c=s<p?cB:cA;float a=al;float side=abs(vUv.y-0.5)*2.0;
          // the full-surface tint is for the map view; close up only the edge band and the changeover markers stay (no teal asphalt)
          float cdist=length(cameraPosition-vec3(vW.x,0.0,vW.y));float full=smoothstep(1500.0,5000.0,cdist);
          a*=mix(0.42,0.72,far)*full+mix(0.58,0.28,far)*smoothstep(0.5,0.98,side)*mix(1.0,0.8,full);
          if(p<1.0){float e=exp(-abs(s-p)*len/22.0)*step(s,p+0.02);c=mix(c,vec3(1.0),e*0.55);a=max(a,e*0.85);}
          if(closed>0.5){float h=step(0.5,fract((vW.x-vW.y)/34.0-t*0.25));a*=0.55+0.75*h;}
          if(heat>0.0){float m=heat*smoothstep(0.62,1.0,0.5+0.5*sin(vW.x*0.031+t*1.1+2.2*sin(vW.y*0.21+t*2.7)));c=mix(c,vec3(0.86,0.9,0.96),m*0.6);a=max(a,m*0.2);}
          if(chg>=0.0&&side>0.8){a=mix(a*0.4,0.95,step(s,chg));c=mix(c*0.6,vec3(1.0,0.66,0.2),step(s,chg));}
          // in dust a low camera loses the wash with the runway; the strategic (high) camera keeps it readable
          a*=mix(clamp(1.35*exp(-cdist/max(vis,1.0)),0.0,1.0),1.0,smoothstep(1200.0,4500.0,cameraPosition.y));
          gl_FragColor=vec4(c,a);}` });
    const w = new THREE.Mesh(washGeo, m); w.position.set((r.x0 + r.x1) / 2, 0.3, r.y); w.scale.set(r.len, 1, 76); w.renderOrder = -34; w.frustumCulled = false; root.add(w);
    w.userData.st = { key: '' }; return w;
  });

  // ---------- 8. floodlight pools on the aprons ----------
  const poolMat = new THREE.ShaderMaterial({ transparent: false, depthWrite: false, depthFunc: THREE.AlwaysDepth, blending: THREE.AdditiveBlending,
    uniforms: { uI: { value: 0 }, uC: { value: new THREE.Vector3(1.0, 0.78, 0.5) } },
    vertexShader: 'attribute float aI;varying vec2 vQ;varying float vI;void main(){vQ=uv*2.0-1.0;vI=aI;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform float uI;uniform vec3 uC;varying vec2 vQ;varying float vI;void main(){float d=dot(vQ,vQ);if(d>1.0)discard;float a=1.0-sqrt(d);a*=a*(1.5-0.5*a);gl_FragColor=vec4(uC*a*uI*vI,1.0);}' });
  let poolMesh;
  { const P = [], U = [], A = [], I = []; const R = mulberry(41); let n = 0;
    const pool = (x, y, rad, k) => { for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { P.push(x + (u * 2 - 1) * rad, 0.35, y + (v * 2 - 1) * rad); U.push(u, v); A.push(k); } I.push(n, n + 2, n + 1, n, n + 3, n + 2); n += 4; };
    Z.GATES.forEach((g, i) => { if (i % 2) return; pool(g.x - Math.cos(g.a) * 10, g.y - Math.sin(g.a) * 10, g.remote ? 55 : 65, 0.7 + R() * 0.5); });
    for (const b of S.bays || []) pool(b.x, b.y, 90, 0.9);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('aI', new THREE.Float32BufferAttribute(A, 1)); g.setIndex(I);
    poolMesh = new THREE.Mesh(g, poolMat); poolMesh.renderOrder = -33; poolMesh.frustumCulled = false; poolMesh.visible = false; root.add(poolMesh); }

  // ---------- 9. airfield lights: one Points draw, per-runway switching in the shader; plus 3D fixtures (instanced) ----------
  const LP = [], LC = [], LA = [], FX = [];  // FX: elevated light fixtures [x, y, hex]
  const light = (x, y, h, hex, size, kind, rw, seq) => { const c = disp(hex); LP.push(x, h, y); LC.push(c[0], c[1], c[2]); LA.push(size, kind, rw, seq || 0); };
  // kinds: 0 always (with night), 1 runway lights (rwOn), 2 approach lights / PAPI (rwApp), 3 rabbit (rwApp, sequenced)
  RW.forEach((r, i) => {
    for (let x = r.x0; x <= r.x1 + 0.1; x += 60) for (const sd of [-1, 1]) { const hx = x < r.x0 + 600 ? '#ffc457' : '#fff1d6'; light(x, r.y + sd * 31.5, 0.6, hx, 7, 1, i); FX.push([x, r.y + sd * 31.5, hx]); }
    for (let x = r.x0 + 15; x < r.x1; x += 30) { const d = x - r.x0; light(x, r.y, 0.4, d < 300 ? '#ff4030' : d < 900 ? ((Math.round(x / 30) % 2) ? '#ff4030' : '#e8f0ff') : '#e8f0ff', 4.5, 1, i); }
    for (let x = r.x1 - 30; x > r.x1 - 900; x -= 60) for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) light(x, r.y + sd * (9 + k * 1.5), 0.4, '#f4f6ff', 3.2, 1, i);
    for (let y = -28.5; y <= 28.6; y += 3) { light(r.x1 + 1.5, r.y + y, 0.6, '#3dff86', 6.5, 1, i); light(r.x0 - 1.5, r.y + y, 0.6, '#ff3426', 6.5, 1, i); }
    for (const sd of [-1, 1]) for (let k = 0; k < 5; k++) { light(r.x1 + 1.5, r.y + sd * (34 + k * 3), 0.6, '#3dff86', 6, 1, i); FX.push([r.x1 + 1.5, r.y + sd * (34 + k * 3), '#3dff86']); }
    for (let st = 1; st <= 30; st++) { const x = r.x1 + st * 30; for (let k = -2; k <= 2; k++) light(x, r.y + k * 1.05, 1.2 + st * 0.35, '#fff0cf', 5, 2, i);
      if (st <= 9) for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) light(x, r.y + sd * (10.5 + k * 1.5), 1.2, '#ff3a2a', 4.5, 2, i);
      if (st >= 10) light(x, r.y, 4 + st * 0.35, '#ffffff', 22, 3, i, (30 - st) / 20); }
    for (let y = -16.5; y <= 16.6; y += 1.5) if (Math.abs(y) > 2.5) light(r.x1 + 300, r.y + y, 4, '#fff0cf', 5, 2, i);
    for (let y = -9; y <= 9.1; y += 1.5) if (Math.abs(y) > 2.5) light(r.x1 + 150, r.y + y, 2.5, '#fff0cf', 4.5, 2, i);
    for (let k = 0; k < 4; k++) light(r.x1 - 400, r.y + 45 + k * 9, 1, k < 2 ? '#ff3a2a' : '#ffffff', 6, 2, i);
  });
  // taxiway edge (blue) and centreline (green) lights; exits green; stop bars red at the holds
  const nearJunc = (x, y, m) => { for (const j of junc) if (Math.abs(j[0] - x) < m && Math.abs(j[1] - y) < m && Math.hypot(j[0] - x, j[1] - y) < m) return true; return false; };
  for (const t of tws) { if (t.kind === 'taxilane') continue; const p = simplify(t.pts);
    walk(p, 50, (x, y, dx, dy) => { if (nearJunc(x, y, 34)) return; for (const sd of [-1, 1]) { light(x - dy * sd * 13, y + dx * sd * 13, 0.4, '#3d6dff', 4.2, 0, -1); FX.push([x - dy * sd * 13, y + dx * sd * 13, '#3d6dff']); } }, 25);
    walk(p, 30, (x, y) => { if (nearJunc(x, y, 18)) return; light(x, y, 0.3, '#3dff8c', 2.6, 0, -1); }); }
  for (const x of exitPaths) walk(x.curve.slice(1), 15, (px, py, dx, dy, d) => light(px, py, 0.3, (Math.floor(d / 15) % 2) && Math.abs(py - x.r.y) < 150 ? '#ffd040' : '#3dff8c', 3, 1, RW.indexOf(x.r)));
  for (const h of holds) for (let k = -10.5; k <= 10.6; k += 3) light(h[0] + k, h[1], 0.4, '#ff2a20', 4.2, 0, -1);
  // landside: street lights along the roads; a few white farmhouses with a warm lamp each
  for (const p of roads) { let n = 0; walk(p, 55, (x, y, dx, dy) => { if (Math.hypot(x, y) > 17000) return; n++; const sd = n % 2 ? 1 : -1; light(x - dy * sd * 15.5, y + dx * sd * 15.5, 10, '#ffab55', 9, 0, -1); }); }
  const farmhouses = []; { const R = mulberry(51); for (let k = 0; k < 400 && farmhouses.length < 90; k++) { const f = fields[Math.floor(R() * fields.length)], p = toW(f.u + 20, f.v + 20); if (Math.hypot(p[0] + 500, p[1]) > 12000 || inAirport(p[0], p[1], 400) || nearRoad(p[0], p[1], 40) || nearWater(p[0], p[1], 30)) continue;
    farmhouses.push([p[0], p[1], -ROT, 7 + R() * 5, 3.5 + R() * 2.5, 8 + R() * 6]); light(p[0], p[1], 3, '#ffbb6a', 5, 0, -1); } }
  const NRW = Math.max(1, RW.length);
  const LU = { uLa: { value: 0 }, uT: { value: 0 }, uPx: { value: 1000 }, uMin: { value: 2.5 }, uDust: { value: 0 }, uFog: { value: new THREE.Vector2(1e5, 2e5) }, uOn: { value: new Float32Array(NRW) }, uApp: { value: new Float32Array(NRW) } };
  const lightMat = new THREE.ShaderMaterial({ uniforms: LU, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    vertexShader: `#define NRW ${NRW}
      uniform float uLa,uT,uPx,uMin,uDust;uniform vec2 uFog;uniform float uOn[NRW];uniform float uApp[NRW];
      attribute vec3 aCol;attribute vec4 aP;varying vec3 vC;varying float vA;
      void main(){float k=aP.y;float on=1.0;int ri=int(aP.z+0.5);
        if(aP.z>-0.5){on=(k>1.5)?uApp[ri]:uOn[ri];}
        if(k>2.5){float ph=fract(uT*2.0)/0.6;on*=smoothstep(0.07,0.0,abs(ph-aP.w))*1.5;}
        vec4 mv=modelViewMatrix*vec4(position,1.0);float dist=max(1.0,-mv.z);
        float sz=aP.x*(1.0+uDust*(k>0.5&&k<1.5?0.6:0.4))*uPx/dist;float ps=clamp(sz,uMin,40.0);gl_PointSize=ps;
        // pull the sprite toward the camera by its own world radius, so the ground never clips it into a half-dome
        mv.xyz-=normalize(mv.xyz)*min(0.5*ps*dist/uPx+0.5,dist*0.5);gl_Position=projectionMatrix*mv;
        float f=smoothstep(uFog.x,uFog.y*1.4,dist);
        vA=uLa*on*clamp(sz/uMin,0.6,1.0)*(1.0-0.7*f);vC=aCol;
        if(vA<0.003)gl_Position=vec4(2.0,2.0,2.0,1.0);}`,
    fragmentShader: 'varying vec3 vC;varying float vA;void main(){vec2 q=gl_PointCoord*2.0-1.0;float d=dot(q,q);if(d>1.0)discard;float a=exp(-d*8.0)*0.9+exp(-d*2.2)*0.12;gl_FragColor=vec4(mix(vC,vec3(1.0),exp(-d*40.0)*0.6),a*vA);}' });
  const lightGeo = new THREE.BufferGeometry(); lightGeo.setAttribute('position', new THREE.Float32BufferAttribute(LP, 3)); lightGeo.setAttribute('aCol', new THREE.Float32BufferAttribute(LC, 3)); lightGeo.setAttribute('aP', new THREE.Float32BufferAttribute(LA, 4));
  const lightPts = new THREE.Points(lightGeo, lightMat); lightPts.frustumCulled = false; lightPts.renderOrder = 5; lightPts.visible = false; root.add(lightPts);
  // elevated light fixtures: frangible stem + coloured lens (lens takes the instance colour and glows a little)
  const FXU = { uGlow: { value: 0.3 } };
  let fixIM = null;
  { const B = MB(), CYL4 = new THREE.CylinderGeometry(1, 1, 1, 4, 1, true).toNonIndexed(), LENS = new THREE.OctahedronGeometry(1, 0); CYL4.translate(0, 0.5, 0);
    put(B, CYL4, 0, 0, 0, 0.035, 0.34, 0.035, 0.78, '#d9b43a', 0); put(B, LENS, 0, 0.38, 0, 0.08, 0.07, 0.08, 0.39, '#ffffff', 1);
    const geo = mbGeo(B, 'aLens'), mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.1 });
    mat.onBeforeCompile = sh => { Object.assign(sh.uniforms, FXU);
      sh.vertexShader = 'attribute float aLens;varying float vLens;\n' + sh.vertexShader.replace('#include <color_vertex>', 'vColor=color;\n#ifdef USE_INSTANCING_COLOR\nvColor=mix(color,instanceColor,aLens);\n#endif\nvLens=aLens;');
      sh.fragmentShader = 'uniform float uGlow;varying float vLens;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vColor*vLens*uGlow;'); };
    mat.customProgramCacheKey = () => 'zmhFix';
    const im = new THREE.InstancedMesh(geo, mat, FX.length), c = new THREE.Color(); _o.rotation.set(0, 0, 0);
    FX.forEach((f, k) => { _o.position.set(f[0], 0.12, f[1]); _o.scale.set(1.5, 1.5, 1.5); _o.updateMatrix(); im.setMatrixAt(k, _o.matrix); im.setColorAt(k, c.set(f[2])); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); root.add(im); fixIM = im; }

  // ---------- 10. airside furniture (one merged mesh): approach-light masts, PAPI, localizer arrays, glide-slope masts,
  // shelters, blast fences, windsock poles ----------
  const FB = MB();
  const GREY = lin('#9a9c9c'), DGREY = lin('#55595b'), WHT = lin('#e8e6df'), ORG = lin('#e2582c'), GALV = lin('#a3a7a8');
  for (const s of sites) { const r = s.r;
    for (let st = 1; st <= 30; st++) { const x = r.x1 + st * 30, h = 1.2 + st * 0.35; put(FB, BOX, x, 0, r.y, 0.22, h, 0.22, 0, st % 2 ? GREY : ORG); put(FB, BOX, x, h - 0.12, r.y, 0.12, 0.12, 5.2, 0, DGREY); }
    put(FB, BOX, r.x1 + 300, 0, r.y, 0.3, 3.9, 0.3, 0, GREY); put(FB, BOX, r.x1 + 300, 3.8, r.y, 0.14, 0.14, 34, 0, DGREY);
    put(FB, BOX, r.x1 + 150, 0, r.y, 0.25, 2.4, 0.25, 0, GREY); put(FB, BOX, r.x1 + 150, 2.3, r.y, 0.14, 0.14, 19, 0, DGREY);
    for (let k = 0; k < 4; k++) put(FB, BOX, r.x1 - 400, 0, r.y + 45 + k * 9, 1.4, 0.9, 1.0, 0, k % 2 ? '#c9c6bd' : '#b9b6ad');
    // localizer: a wide array of log-periodic antennas on a frame, with its shelter
    const [lx, ly] = s.loc; put(FB, BOX, lx, 0, ly, 0.6, 0.25, 48, 0, '#b6b4ad'); put(FB, BOX, lx, 2.1, ly, 0.25, 0.25, 47, 0, '#c64a2a');
    for (let k = 0; k < 16; k++) { const y = ly - 22.5 + k * 3; put(FB, BOX, lx, 0, y, 0.12, 3.1, 0.12, 0, WHT); put(FB, BOX, lx - 0.4, 2.6, y, 1.9, 0.08, 0.08, 0, k % 2 ? WHT : ORG); put(FB, BOX, lx - 0.4, 1.7, y, 1.5, 0.06, 0.06, 0, WHT); }
    put(FB, BOX, lx + 14, 0, ly + 30, 4, 2.7, 3, 0, WHT); put(FB, BOX, lx + 14, 2.7, ly + 30, 4.3, 0.18, 3.3, 0, DGREY);
    // glide slope: lattice-ish mast with three antennas, shelter at its foot
    const [gx, gy] = s.gs; put(FB, BOX, gx, 0, gy, 0.5, 15, 0.5, 0, ORG); for (let k = 0; k < 6; k++) put(FB, BOX, gx, k * 2.6 + 1.3, gy, 0.55, 0.9, 0.55, 0, k % 2 ? WHT : ORG);
    for (const h of [5, 9.5, 14]) put(FB, BOX, gx - 0.6, h, gy, 0.8, 1.1, 1.3, 0, '#cfcfca');
    put(FB, BOX, gx + 6, 0, gy + s.gsS * 10, 3.6, 2.6, 2.8, 0, WHT); put(FB, BOX, gx + 6, 2.6, gy + s.gsS * 10, 3.9, 0.18, 3.1, 0, DGREY);
    // windsock masts (the socks are instanced and follow the wind)
    for (const w of s.ws) { put(FB, BOX, w[0], 0, w[1], 1.6, 0.3, 1.6, 0, '#bdbab2'); put(FB, CYL6, w[0], 0.3, w[1], 0.09, 7.9, 0.09, 0, WHT); put(FB, BOX, w[0], 7.6, w[1], 0.7, 0.07, 0.7, 0, DGREY); }
    // blast fence behind the threshold: louvred slats on posts, in two halves either side of the approach lights
    for (const sd of [-1, 1]) { const yc = r.y + sd * 40;
      for (let k = 0; k <= 10; k++) put(FB, BOX, s.blast + 0.8, 0, yc - 25 + k * 5, 0.3, 5.2, 0.3, 0, DGREY);
      for (let k = 0; k < 9; k++) put(FB, BOX, s.blast, 0.3 + k * 0.56, yc, 0.06, 0.7, 50, 0, k % 2 ? GALV : '#b2b6b7', -0.0, 0, 0.75);
      put(FB, BOX, s.blast + 1.8, 0, yc, 2.6, 0.5, 50, 0, '#8f8a7c'); } }
  const furn = new THREE.Mesh(mbGeo(FB), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 })); furn.castShadow = true; furn.receiveShadow = true; root.add(furn);

  // ---------- 11. windsocks: red/white truncated cones, one instanced draw, pointed and lifted by Z.atmo.wind ----------
  const socks = []; for (const s of sites) for (const w of s.ws) socks.push(w);
  let sockIM = null;
  { const g = new THREE.CylinderGeometry(0.18, 0.42, 1, 10, 5, true).toNonIndexed(); g.rotateZ(-Math.PI / 2); g.translate(0.5, 0, 0);
    const P = g.attributes.position, C = new Float32Array(P.count * 3), red = lin('#e2401f'), wh = lin('#f2efe6');
    for (let t = 0; t < P.count; t += 3) { const cx = (P.getX(t) + P.getX(t + 1) + P.getX(t + 2)) / 3, c = Math.floor(cx * 5 - 1e-4) % 2 ? wh : red; for (let j = 0; j < 3; j++) C.set([c.r, c.g, c.b], (t + j) * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    sockIM = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }), Math.max(1, socks.length)); sockIM.count = socks.length;
    sockIM.castShadow = true; sockIM.frustumCulled = false; sockIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(sockIM); }

  // ---------- 12. taxiway signs: instanced boards with a canvas atlas (mandatory red, location black/yellow, direction yellow) ----------
  { const LET = 'ABCDEFGHJKLMNPQRSTUVWYZ', named = tws.filter(t => t.kind !== 'taxilane' && t.kind !== 'pad' && t.kind !== 'bay'), name = new Map();
    named.forEach((t, i) => name.set(t, LET[i % LET.length] + (i >= LET.length ? Math.floor(i / LET.length) : '')));
    const defs = [], slots = new Map(), slotOf = (k, a, b) => { const key = k + a + '|' + b; if (!slots.has(key)) { if (slots.size >= 64) return 0; slots.set(key, { i: slots.size, k, a, b }); } return slots.get(key).i; };
    const add = (x, y, dx, dy, slot) => defs.push([x, y, Math.atan2(-dx, -dy), slot]);
    for (const h of holds) { const r = h[2], s = Math.sign(r.y - h[1]) || 1, nm = r.name.replace('/', '-'); const sl = slotOf('M', nm, '');
      for (const sd of [-1, 1]) add(h[0] + sd * 21, h[1] - s * 1.5, 0, s, sl); }
    for (const t of named) { const p = simplify(t.pts); if (p.length < 2) continue;
      for (const e of [0, 1]) { const b = e ? p[p.length - 1] : p[0], a = e ? p[p.length - 2] : p[1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 120) continue;
        const dx = (b[0] - a[0]) / L, dy = (b[1] - a[1]) / L; let other = null;
        for (const o of named) { if (o === t) continue; for (let i = 1; i < o.pts.length && !other; i++) if (segD(b[0], b[1], o.pts[i - 1][0], o.pts[i - 1][1], o.pts[i][0], o.pts[i][1]) < 4) other = o; if (other) break; }
        let arrow = '↑'; if (other) { const op = other.pts, q = op[op.length - 1], q0 = op[0], ox = q[0] - q0[0], oy = q[1] - q0[1], cr = dx * oy - dy * ox; arrow = Math.abs(cr) < 1e-3 * Math.hypot(ox, oy) ? '↑' : cr > 0 ? '→' : '←'; }
        const sl = slotOf('L', name.get(t), other ? name.get(other) + ' ' + arrow : '');
        add(b[0] - dx * 70 + dy * 21, b[1] - dy * 70 - dx * 21, dx, dy, sl); } }
    const SC = mkCanvas(1024, 1024), g = SC.getContext('2d'); g.fillStyle = '#2a2b2c'; g.fillRect(0, 0, 1024, 1024);
    for (const sl of slots.values()) { const x = (sl.i % 4) * 256, y = Math.floor(sl.i / 4) * 64; g.save(); g.translate(x, y); g.fillStyle = '#2a2b2c'; g.fillRect(0, 0, 256, 64);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 40px "Arial Narrow", Arial, Helvetica, sans-serif';
      if (sl.k === 'M') { g.fillStyle = '#c1121c'; g.fillRect(4, 4, 248, 56); g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeText(sl.a, 128, 34); g.fillText(sl.a, 128, 34); }
      else { const lw = sl.b ? 84 : 248; g.fillStyle = '#111'; g.fillRect(4, 4, lw, 56); g.strokeStyle = '#f2c230'; g.lineWidth = 3; g.strokeRect(9, 9, lw - 10, 46); g.fillStyle = '#f2c230'; g.fillText(sl.a, 4 + lw / 2, 34);
        if (sl.b) { g.fillStyle = '#f2c230'; g.fillRect(92, 4, 160, 56); g.fillStyle = '#111'; g.fillText(sl.b, 172, 34); } }
      g.restore(); }
    const st = mkTex(SC, true, false);
    // board: front/back faces carry the slot, sides and legs are housing grey (uv in the dark gutter)
    const P = [], N = [], U = [], C = [], hw = 2.1, y0 = 0.5, y1 = 1.55, dz = 0.16, G = [0.002, 0.002];
    const sq = (a, b, c, d, n, uv, col) => { for (const [v, t] of [[a, uv[0]], [b, uv[1]], [c, uv[2]], [a, uv[0]], [c, uv[2]], [d, uv[3]]]) { P.push(v[0], v[1], v[2]); N.push(n[0], n[1], n[2]); U.push(t[0], t[1]); C.push(col, col, col); } };
    sq([-hw, y0, dz], [hw, y0, dz], [hw, y1, dz], [-hw, y1, dz], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]], 1);
    sq([hw, y0, -dz], [-hw, y0, -dz], [-hw, y1, -dz], [hw, y1, -dz], [0, 0, -1], [[0, 0], [1, 0], [1, 1], [0, 1]], 1);
    const box = (x0, x1, ya, yb, z0, z1, col) => { sq([x0, yb, z1], [x1, yb, z1], [x1, yb, z0], [x0, yb, z0], [0, 1, 0], [G, G, G, G], col); sq([x0, ya, z0], [x0, ya, z1], [x0, yb, z1], [x0, yb, z0], [-1, 0, 0], [G, G, G, G], col); sq([x1, ya, z1], [x1, ya, z0], [x1, yb, z0], [x1, yb, z1], [1, 0, 0], [G, G, G, G], col); };
    box(-hw, hw, y0, y1, -dz, dz, 1); for (const lx of [-1.5, 1.5]) { box(lx - 0.06, lx + 0.06, 0, y0, -0.06, 0.06, 1); sq([lx - 0.06, 0, 0.06], [lx + 0.06, 0, 0.06], [lx + 0.06, y0, 0.06], [lx - 0.06, y0, 0.06], [0, 0, 1], [G, G, G, G], 1); sq([lx + 0.06, 0, -0.06], [lx - 0.06, 0, -0.06], [lx - 0.06, y0, -0.06], [lx + 0.06, y0, -0.06], [0, 0, -1], [G, G, G, G], 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    const aS = new Float32Array(Math.max(1, defs.length) * 2); defs.forEach((d, k) => { aS[k * 2] = (d[3] % 4) * 0.25; aS[k * 2 + 1] = 1 - (Math.floor(d[3] / 4) + 1) / 16; });
    geo.setAttribute('aSlot', new THREE.InstancedBufferAttribute(aS, 2));
    const mat = new THREE.MeshStandardMaterial({ map: st, vertexColors: true, roughness: 0.5, emissive: '#ffffff', emissiveMap: st, emissiveIntensity: 0.12 });
    mat.onBeforeCompile = sh => { sh.vertexShader = 'attribute vec2 aSlot;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv=vMapUv*vec2(0.25,0.0625)+aSlot;\n#ifdef USE_EMISSIVEMAP\nvEmissiveMapUv=vMapUv;\n#endif'); };
    mat.customProgramCacheKey = () => 'zmhSign';
    if (defs.length) { const im = new THREE.InstancedMesh(geo, mat, defs.length); _o.rotation.set(0, 0, 0); _o.scale.set(1, 1, 1);
      defs.forEach((d, k) => { _o.position.set(d[0], 0, d[1]); _o.rotation.y = d[2]; _o.updateMatrix(); im.setMatrixAt(k, _o.matrix); });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true; root.add(im); var signMat = mat; } }

  // ---------- 13. perimeter fence: chain-link (alpha), posts, barbed-wire outriggers; one transparent draw ----------
  { const c = mkCanvas(256, 128), g = c.getContext('2d'); g.clearRect(0, 0, 256, 128);
    g.strokeStyle = 'rgba(150,156,158,.55)'; g.lineWidth = 1.2; for (let k = -16; k < 32; k++) { g.beginPath(); g.moveTo(k * 16, 128); g.lineTo(k * 16 + 128, 16); g.stroke(); g.beginPath(); g.moveTo(k * 16, 16); g.lineTo(k * 16 + 112, 128); g.stroke(); }
    g.fillStyle = 'rgba(120,124,126,1)'; g.fillRect(0, 0, 7, 128); g.fillRect(0, 14, 256, 4); g.fillRect(0, 124, 256, 4);
    g.fillStyle = 'rgba(80,82,84,.9)'; for (const y of [2, 6, 10]) g.fillRect(0, y, 256, 1.2);
    const ft = mkTex(c, true, true); ft.wrapT = THREE.ClampToEdgeWrapping;
    const P = [], U = [], I = [], H = 2.8, pr = [[AX0 + 8, AY0 + 8], [AX1 - 8, AY0 + 8], [AX1 - 8, AY1 - 8], [AX0 + 8, AY1 - 8], [AX0 + 8, AY0 + 8]]; let d = 0, n = 0;
    for (let i = 1; i < pr.length; i++) { const a = pr[i - 1], b = pr[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      P.push(a[0], 0, a[1], b[0], 0, b[1], b[0], H, b[1], a[0], H, a[1]); U.push(d / 4, 0, (d + L) / 4, 0, (d + L) / 4, 1, d / 4, 1); I.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4; d += L; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setIndex(I); geo.computeVertexNormals(); geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: ft, transparent: true, alphaTest: 0.03, depthWrite: false, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.4 })); m.frustumCulled = false; root.add(m); }

  // ---------- 14. trees: neem (broad, lobed), mango (dense dome), eucalyptus (tall, narrow); near LOD with trunks and
  // shadows, far LOD a cheap blob; wind sway + leaf flutter in the vertex shader from Z.atmo.wind ----------
  const trees = [];  // [x, y, radius, height, colourHex, type]
  { const R = mulberry(61), oc = ['#2f6a2a', '#2b6227', '#35722e', '#306826'], vc = ['#3d7a2f', '#467f33', '#356c2a', '#4e8738', '#2f662b', '#41702c'], ec = ['#5d7e45', '#647f4a', '#56773f'];
    const ok = (x, y) => !inAirport(x, y, 250) && !nearRoad(x, y, 24) && !nearWater(x, y, 8);
    const pick = a => a[Math.floor(R() * a.length)];
    const near = fields.map(f => ({ f, d: Math.hypot(Math.max(AX0 - f.cx, 0, f.cx - AX1), Math.max(AY0 - f.cy, 0, f.cy - AY1)) })).filter(o => o.d > 150).sort((a, b) => a.d - b.d);
    let n = 0;
    for (const { f } of near) { if (n >= 5200) break; if (f.type !== 'orch') continue;
      for (let v = f.v + 12; v < f.v + f.h - 8 && n < 5200; v += 10) for (let u = f.u + 8; u < f.u + f.w - 8 && n < 5200; u += 8) { const p = toW(u + (R() - 0.5) * 0.8, v + (R() - 0.5) * 0.8); if (!ok(p[0], p[1])) continue; trees.push([p[0], p[1], 2.8 + R() * 0.9, 4.6 + R() * 1.6, oc[n % 4], 1]); n++; } }
    n = 0;
    for (const { f } of near) { if (n >= 4800) break; if (f.hedge >= 0.35) continue;
      for (const [u0, v0, u1, v1] of [[f.u, f.v + f.h, f.u, f.v], [f.u, f.v, f.u + f.w, f.v]]) { const L = Math.hypot(u1 - u0, v1 - v0); for (let s = 4; s < L; s += 8 + R() * 6) { if (R() < 0.12) continue; const t = s / L, p = toW(u0 + (u1 - u0) * t + (R() - 0.5) * 3, v0 + (v1 - v0) * t + (R() - 0.5) * 3); if (!ok(p[0], p[1])) continue;
        if (R() < 0.3) trees.push([p[0], p[1], 2.2 + R() * 1.2, 13 + R() * 7, pick(ec), 2]); else trees.push([p[0], p[1], 3.4 + R() * 3, 7 + R() * 6, pick(vc), 0]); n++; } } }
    for (let k = 0; k < 600; k++) { const a = R() * Math.PI * 2, d = 5500 + R() * 9000, x = -500 + Math.cos(a) * d, y = Math.sin(a) * d * 0.9; if (!ok(x, y)) continue; const m = 1 + Math.floor(R() * 4);
      for (let j = 0; j < m; j++) trees.push([x + (R() - 0.5) * 30 * m, y + (R() - 0.5) * 30 * m, 6 + R() * 5, 11 + R() * 6, pick(vc), 0]); }
    for (const p of nallahs) walk(p, 22, (x, y, dx, dy) => { if (R() < 0.4 || Math.abs(x + 500) > 15000) return; const sd = R() < .5 ? -1 : 1, o = 22 + R() * 26, tx = x - dy * sd * o, ty = y + dx * sd * o; if (inAirport(tx, ty, 200) || nearRoad(tx, ty, 20)) return;
      if (R() < 0.35) trees.push([tx, ty, 2.4 + R() * 1.2, 14 + R() * 6, pick(ec), 2]); else trees.push([tx, ty, 3.5 + R() * 4, 8 + R() * 6, pick(vc), 0]); });
    for (const q of ponds) for (let k = 0; k < 26; k++) { const a = R() * 7, x = q[0] + Math.cos(a) * (q[2] + 30 + R() * 30), y = q[1] + Math.sin(a) * (q[3] + 30 + R() * 30); if (ok(x, y)) trees.push([x, y, 4 + R() * 4, 9 + R() * 5, pick(vc), R() < 0.5 ? 0 : 1]); }
    for (const h of farmhouses) for (let k = 0; k < 4; k++) { const a = R() * 7, x = h[0] + Math.cos(a) * (14 + R() * 12), y = h[1] + Math.sin(a) * (14 + R() * 12); trees.push([x, y, 5 + R() * 3, 9 + R() * 4, pick(vc), R() < 0.5 ? 1 : 0]); }
    for (const p of roads) walk(p, 18, (x, y, dx, dy) => { const dd = Math.hypot(x + 500, y); if (dd < 6500 || dd > 15000 || R() < 0.3) return; for (const sd of [-1, 1]) { const tx = x - dy * sd * 24, ty = y + dx * sd * 24; if (!inAirport(tx, ty, 250)) trees.push([tx, ty, 2.3 + R(), 13 + R() * 6, pick(ec), 2]); } });
    for (let k = 0; k < 650; k++) { const a = R() * Math.PI * 2, d = 16000 + R() * 16000, x = -500 + Math.cos(a) * d, y = Math.sin(a) * d; const m = 1 + Math.floor(R() * 3); for (let j = 0; j < m; j++) trees.push([x + (R() - 0.5) * 120, y + (R() - 0.5) * 120, 5 + R() * 4, 10 + R() * 6, pick(vc), 0]); }
  }
  const TU = { uWind: { value: new THREE.Vector4(1, 0, 0.01, 0.2) }, uTm: { value: 0 } };
  const SWAY = `vec4 mvPosition=instanceMatrix*vec4(transformed,1.0);
    float th=length(instanceMatrix[1].xyz);float hk=max(transformed.y-0.15,0.0);float ph=dot(mvPosition.xz,vec2(0.021,0.017));
    float sw=uWind.z*hk*hk*th*(0.75+0.25*sin(uTm*1.3+ph)+uWind.w*0.5*sin(uTm*3.1+ph*1.7));
    mvPosition.xz+=uWind.xy*sw;
    mvPosition.xyz+=(1.0-aBark)*uWind.z*th*0.06*hk*vec3(sin(uTm*7.1+position.x*9.0+ph),0.4*sin(uTm*6.3+position.z*11.0),cos(uTm*8.3+position.y*7.0+ph));
    mvPosition=modelViewMatrix*mvPosition;gl_Position=projectionMatrix*mvPosition;`;
  const swayHook = (sh, colour) => { Object.assign(sh.uniforms, TU);
    sh.vertexShader = 'uniform vec4 uWind;uniform float uTm;attribute float aBark;\n' + sh.vertexShader.replace('#include <project_vertex>', SWAY);
    if (colour) sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', 'vColor=color;\n#ifdef USE_INSTANCING_COLOR\nvColor*=mix(instanceColor,vec3(1.0),aBark);\n#endif'); };
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.6 });
  treeMat.onBeforeCompile = sh => swayHook(sh, true); treeMat.customProgramCacheKey = () => 'zmhTree';
  const treeDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); treeDepth.onBeforeCompile = sh => swayHook(sh, false); treeDepth.customProgramCacheKey = () => 'zmhTreeD';
  function treeGeo(lobes, trunkH, trunkR, bark, tmpl, seed) {
    const B = MB(), R = mulberry(seed), hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
    if (trunkH > 0) { put(B, CYL6, 0, 0, 0, trunkR, trunkH, trunkR, 0, bark, 1); put(B, CYL6, trunkR * 0.8, trunkH * 0.55, 0, trunkR * 0.45, trunkH * 0.5, trunkR * 0.45, 0, bark, 1, 0, 0, -0.7); }
    const P = tmpl.attributes.position;
    for (const [cx, cy, cz, sx, sy, sz] of lobes) { const j = 0.85 + R() * 0.3;
      for (let i = 0; i < P.count; i++) { const px = P.getX(i), py = P.getY(i), pz = P.getZ(i), rr = 1 + 0.22 * (hash(px + cx, py + cy, pz + cz) - 0.5), x = cx + px * sx * rr * j, y = cy + py * sy * rr * j, z = cz + pz * sz * rr * j;
        let nx = px / sx, ny = py / sy + 0.35, nz = pz / sz; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        const ao = (0.42 + 0.58 * clamp(0.5 + 0.6 * py, 0, 1)) * (0.7 + 0.35 * clamp(y, 0, 1));
        B.p.push(x, y, z); B.n.push(nx, ny, nz); B.c.push(ao, ao * 1.02, ao * 0.96); B.e.push(0); } }
    return mbGeo(B, 'aBark'); }
  const ICO = new THREE.IcosahedronGeometry(1, 0), OCT = new THREE.OctahedronGeometry(1, 0);
  const TGEO = [
    treeGeo([[0, 0.66, 0, 0.55, 0.3, 0.55], [0.45, 0.58, 0.12, 0.42, 0.25, 0.42], [-0.38, 0.6, 0.3, 0.42, 0.26, 0.42], [-0.18, 0.57, -0.45, 0.42, 0.25, 0.42], [0.18, 0.82, -0.05, 0.42, 0.2, 0.42], [0.32, 0.64, -0.38, 0.38, 0.22, 0.38]], 0.5, 0.07, '#5a4a3a', ICO, 7),
    treeGeo([[0, 0.52, 0, 0.78, 0.36, 0.78], [0.35, 0.74, 0.2, 0.45, 0.25, 0.45], [-0.3, 0.76, -0.16, 0.48, 0.24, 0.48], [0.08, 0.9, -0.3, 0.36, 0.14, 0.36]], 0.32, 0.08, '#4d3e30', ICO, 8),
    treeGeo([[0, 0.6, 0, 0.55, 0.16, 0.55], [0.15, 0.78, 0.1, 0.48, 0.15, 0.48], [-0.1, 0.92, -0.06, 0.32, 0.09, 0.32]], 0.66, 0.09, '#b6ad9a', ICO, 9)];
  const FARG = treeGeo([[0, 0.62, 0, 1, 0.38, 1]], 0, 0, '#000', OCT, 10);
  const NT = trees.length, TM = new Float32Array(NT * 16), TCOL = new Float32Array(NT * 3), TTY = new Uint8Array(NT);
  { const R = mulberry(71), c = new THREE.Color(); _o.rotation.set(0, 0, 0);
    trees.forEach((t, k) => { _o.position.set(t[0], 0, t[1]); _o.rotation.y = R() * 6.28; _o.scale.set(t[2], t[3], t[2] * (0.85 + R() * 0.3)); _o.updateMatrix(); _o.matrix.toArray(TM, k * 16);
      c.set(t[4]).multiplyScalar(0.8 + R() * 0.35); c.r *= 0.92 + R() * 0.16; TCOL[k * 3] = c.r; TCOL[k * 3 + 1] = c.g; TCOL[k * 3 + 2] = c.b; TTY[k] = t[5]; }); }
  const NCAP = [2600, 2600, 1300];
  const mkTreeIM = (geo, cap, shadow) => { const im = new THREE.InstancedMesh(geo, treeMat, cap); im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); im.count = 0;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.instanceColor.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.castShadow = shadow; im.receiveShadow = shadow; if (shadow) im.customDepthMaterial = treeDepth; root.add(im); return im; };
  const nearIM = TGEO.map((g, k) => mkTreeIM(g, NCAP[k], true)), farIM = mkTreeIM(FARG, Math.max(1, NT), false);
  // the far mesh holds every tree, written and uploaded once; the trees drawn by the near meshes are flagged (aNear) and
  // dropped in its vertex shader, so a moving camera re-sends only the near trees and an 18 KB flag array (it used to
  // re-send all 18,000 far matrices, 1.8 MB, up to four times a second in a cinematic: a long frame in Safari each time)
  const nearF = new Uint8Array(Math.max(1, NT)), nearA = new THREE.InstancedBufferAttribute(nearF, 1); nearA.setUsage(THREE.DynamicDrawUsage); FARG.setAttribute('aNear', nearA);
  const farMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.6 });
  farMat.onBeforeCompile = sh => { swayHook(sh, true); sh.vertexShader = 'attribute float aNear;\n' + sh.vertexShader.replace('gl_Position=projectionMatrix*mvPosition;', 'gl_Position=projectionMatrix*mvPosition;if(aNear>0.5)gl_Position=vec4(0.0,0.0,-2.0,1.0);'); };
  farMat.customProgramCacheKey = () => 'zmhTreeFar'; farIM.material = farMat;
  farIM.instanceMatrix.array.set(TM); farIM.instanceColor.array.set(TCOL); farIM.count = NT;
  const rng = (a, n) => { a.needsUpdate = true; if (a.addUpdateRange) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, n) * a.itemSize); } };
  const camV = new THREE.Vector3(), lod = { t: -1, px: 1e9, pz: 1e9, fx: 1e9, fz: 1e9 }, ncount = [0, 0, 0];
  function lodTrees(force) {
    const cam = Z.camera; if (!cam) return; const px = cam.position.x, py = cam.position.y, pz = cam.position.z; cam.getWorldDirection(camV);
    const cd = Z.camDist || 3000, fx = px + camV.x * cd, fz = pz + camV.z * cd;
    if (!force && Math.abs(px - lod.px) + Math.abs(pz - lod.pz) < 120 && Math.abs(fx - lod.fx) + Math.abs(fz - lod.fz) < 120) return;
    lod.px = px; lod.pz = pz; lod.fx = fx; lod.fz = fz;
    const r1 = 2000 * 2000, r2 = cd < 5000 ? 1200 * 1200 : 0, h2 = py * py; ncount[0] = ncount[1] = ncount[2] = 0; let nf = 0;
    for (let i = 0; i < NT; i++) { const x = TM[i * 16 + 12], z = TM[i * 16 + 14], d1 = (x - px) * (x - px) + (z - pz) * (z - pz) + h2, d2 = (x - fx) * (x - fx) + (z - fz) * (z - fz), ty = TTY[i];
      if ((d1 < r1 || d2 < r2) && ncount[ty] < NCAP[ty]) { const im = nearIM[ty], M = im.instanceMatrix.array, C = im.instanceColor.array, j = ncount[ty]++; nearF[i] = 1;
        for (let q = 0; q < 16; q++) M[j * 16 + q] = TM[i * 16 + q]; C[j * 3] = TCOL[i * 3]; C[j * 3 + 1] = TCOL[i * 3 + 1]; C[j * 3 + 2] = TCOL[i * 3 + 2]; }
      else nearF[i] = 0; }
    for (let k = 0; k < 3; k++) { const im = nearIM[k]; im.count = ncount[k]; rng(im.instanceMatrix, ncount[k]); rng(im.instanceColor, ncount[k]); }
    nearA.needsUpdate = true; }
  lodTrees(true);
  if (farmhouses.length) { const bg = new THREE.BoxGeometry(1, 1, 1); bg.translate(0, 0.5, 0); bg.setIndex(Array.from(bg.index.array).filter((_, j) => j < 18 || j >= 24)); bg.clearGroups();
    const im = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), farmhouses.length), c = new THREE.Color(); _o.rotation.set(0, 0, 0);
    farmhouses.forEach((h, k) => { _o.position.set(h[0], 0, h[1]); _o.rotation.y = h[2]; _o.scale.set(h[3], h[4], h[5]); _o.updateMatrix(); im.setMatrixAt(k, _o.matrix); c.set(k % 7 ? '#e9e6dc' : '#ddd2bf'); im.setColorAt(k, c); });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true; root.add(im); }

  // ---------- per frame ----------
  const MODEC = { ARR: disp('#8a7cff'), DEP: disp('#2fd3c6'), MIX: disp('#f4c430'), X: disp('#ff4d3f'), OFF: disp('#33373b'), L: disp('#26282b') };
  const ALPHA = { ARR: 0.3, DEP: 0.3, MIX: 0.3, X: 0.42, OFF: 0.45, L: 0.5 };
  const v2 = new THREE.Vector2(), wnd = { dir: 0, speed: 0, gust: 0 };
  let lodT = 0, wx = 0, wy = 0;
  return {
    update(dt, now) {
      const T = Z.T, LV = Z.LV, cd = Z.camDist || 9000;
      { const w = Z.mods.weather, ws = w && w.state ? w.state() : null, tgt = ws ? Math.min(1, ws.tail * 1.2) : 0; PU.wet.value += (tgt - PU.wet.value) * Math.min(1, dt * 0.5); }
      const la = clamp(Math.max(Z.nightF * 1.15, Z.dustNow ? 0.85 : 0, LV && LV.light === 'dawn' ? 0.85 - T / 1800 : 0), 0, 1);
      const far = clamp((cd - 1500) / 8000, 0, 1), heat = LV && LV.light === 'heat' ? (Z.heatNow ? 1 : 0.65) * (1 - far) : 0;
      for (let i = 0; i < RW.length; i++) {
        const r = RW[i], w = washes[i], u = w.material.uniforms, st = w.userData.st;
        const closed = T < r.closedUntil || !!Z.blockAt(r, T);
        const key = r.locked ? 'L' : closed ? 'X' : MODEC[r.mode] ? r.mode : 'OFF';
        if (key !== st.key) { const c = MODEC[key]; if (st.key) { u.cA.value.copy(u.cB.value); st.t0 = now; } else { u.cA.value.set(c[0], c[1], c[2]); st.t0 = now - 10; } u.cB.value.set(c[0], c[1], c[2]); st.key = key; }
        u.p.value = Math.min(1.05, (now - st.t0) / 1.2);
        u.al.value = (ALPHA[key] + far * 0.22) * (1 - 0.25 * Z.nightF);
        u.chg.value = T < r.changeUntil ? clamp((r.changeUntil - T) / (Z.CHANGE || 120), 0, 1) : -1;
        u.far.value = far; u.vis.value = Z.atmo && Z.atmo.visibility ? Z.atmo.visibility : 50000; u.closed.value = key === 'X' ? 1 : 0; u.t.value = now; u.heat.value = heat;
        w.scale.z = 76 + Math.max(0, cd - 2000) * 0.0065;
        const on = !r.locked && r.mode !== 'OFF' && !closed && !r.degraded;
        LU.uOn.value[i] = on ? 1 : 0; LU.uApp.value[i] = on && (r.mode === 'ARR' || r.mode === 'MIX') ? 1 : 0;
      }
      lightPts.visible = la > 0.02;
      if (lightPts.visible) {
        Z.renderer.getDrawingBufferSize(v2); const cam = Z.camera;
        LU.uLa.value = la; LU.uT.value = now; LU.uPx.value = v2.y / (2 * Math.tan(cam.fov * Math.PI / 360)); LU.uMin.value = 3.0 * Z.renderer.getPixelRatio();
        LU.uDust.value = Z.dustNow ? 1 : 0; const fg = Z.scene.fog; if (fg && fg.near !== undefined) LU.uFog.value.set(fg.near, fg.far); else if (fg && fg.density) LU.uFog.value.set(0.4 / fg.density, 2.0 / fg.density);
      }
      poolMat.uniforms.uI.value = 0.5 * clamp((Math.max(Z.nightF, Z.dustNow ? 0.5 : 0) - 0.25) / 0.6, 0, 1); poolMesh.visible = poolMat.uniforms.uI.value > 0.01;
      if (groundMat.userData.sh) { const gu = groundMat.userData.sh.uniforms; gu.nglow.value = 0.05 * Z.nightF; gu.dry.value = LV && LV.light === 'heat' ? 1 : 0; }
      linesMesh.visible = cd < 4000; linesMat.opacity = clamp((4000 - cd) / 1600, 0, 1) * 0.95;
      FXU.uGlow.value = 0.25 + 2.6 * la; if (fixIM) fixIM.visible = cd < 2600; if (typeof signMat !== 'undefined') signMat.emissiveIntensity = 0.12 + 0.9 * la;
      // wind: trees, water ripples, windsocks
      windNow(wnd); const dx = Math.cos(wnd.dir), dy = Math.sin(wnd.dir), sp = wnd.speed, gu = wnd.gust;
      TU.uTm.value = now % 10000; TU.uWind.value.set(dx, dy, 0.0035 * sp * (1 + 0.6 * gu), gu);
      wx += dx * sp * dt; wy += dy * sp * dt; WU.uWt.value.set(wx % 1e4, wy % 1e4, 0.18 + 0.03 * Math.min(sp, 20), 0);
      if (sockIM) { const lift = clamp(sp / 8, 0, 1), droop = (1 - lift) * 1.3 + 0.08;
        for (let i = 0; i < socks.length; i++) { const s = socks[i], fl = Math.sin(now * (2.2 + sp * 0.25) + i * 1.7) * (0.04 + 0.1 * gu) * lift;
          _o.position.set(s[0], 7.95, s[1]); _o.rotation.set(0, -wnd.dir + fl, -droop + fl * 0.5); _o.scale.set(3.6, 1, 1); _o.updateMatrix(); sockIM.setMatrixAt(i, _o.matrix); }
        sockIM.instanceMatrix.needsUpdate = true; }
      lodT -= dt; if (lodT <= 0) { lodT = 0.25; lodTrees(false); }
    }
  };
};
