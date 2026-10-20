/* money/cert.js: the Certificate of Concession, a one-page PDF (A4 landscape) written in the browser.
   No library and no network: a small PDF writer (base-14 Helvetica and Times, WinAnsi text, line and curve operators for the
   border, the rosettes and the seal) and the player's day-one signature embedded as a JPEG (/DCTDecode).

   window.ZMCert (and module.exports, for node):
     ZMCert.pdf(cert, opts?) → Promise<Uint8Array>      cert = VSIEra.certificate(state): {ok, founder, company, signedOn, endsOn,
                                                         years, big, lines:{putIn, cameBack, made, perYear, today}, delivered:[{sentence}],
                                                         signature (PNG data URL)}
     ZMCert.download(cert, opts?) → Promise<{ok, why?, name?, bytes?}>   saves "VSI certificate, <founder>.pdf"
     ZMCert.build(cert, jpeg?) → Uint8Array             synchronous; jpeg = {bytes: Uint8Array, w, h} (node tests)
   Every figure comes from the engine; this file only lays it out. Base-14 fonts have no ₹, so ₹ is written "Rs". */
(function (root) {
  'use strict';
  var W = 842, H = 595;   // A4 landscape, in points
  var PAPER = [0.988, 0.988, 0.976], INK = [0.114, 0.125, 0.141], BLUE = [0.122, 0.227, 0.541], RED = [0.761, 0.165, 0.180],
    GREEN = [0.169, 0.420, 0.294], PALE = [0.62, 0.74, 0.64], PENCIL = [0.404, 0.424, 0.443];
  var AIRPORT = 'Vikram Sarabhai International Airport', SPV = 'Vikram Sarabhai International Airport Limited', SPVS = 'VSIAL';
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // ---- font metrics (Adobe AFM widths, characters 32-126) ----
  function tab(s) { var a = []; s.split(',').forEach(function (x) { var m = /^(\d+)x(\d+)$/.exec(x); if (m) for (var i = 0; i < +m[2]; i++) a.push(+m[1]); else a.push(+x); }); return a; }
  var HV = tab('278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556x10,278,278,584,584,584,556,1015,' +
    '667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,' +
    '556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584');
  var HB = tab('278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556x10,333,333,584,584,584,611,975,' +
    '722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,' +
    '556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584');
  var TR = tab('250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278,500x10,278,278,564,564,564,444,921,' +
    '722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,333,' +
    '444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541');
  var TB = tab('250,333,555,500,500,1000,833,278,333,333,500,570,250,333,250,278,500x10,333,333,570,570,570,500,930,' +
    '722,667,722,722,667,611,778,778,389,500,778,667,944,722,778,611,778,722,556,667,722,722,1000,722,722,667,333,278,333,581,500,333,' +
    '500,556,444,556,444,333,500,556,278,333,556,278,833,556,500,556,556,444,389,333,556,500,722,500,500,444,394,220,394,520');
  var TI = tab('250,333,420,500,500,833,778,214,333,333,500,675,250,333,250,278,500x10,333,333,675,675,675,500,920,' +
    '611,611,667,722,611,611,722,722,333,444,667,556,833,667,722,611,722,611,500,556,722,611,833,611,556,556,389,278,389,422,500,333,' +
    '500,500,444,500,444,278,500,500,278,278,444,278,722,500,500,500,500,389,389,278,500,444,667,444,444,389,400,275,400,541');
  var FONTS = {F1: ['Helvetica', HV], F2: ['Helvetica-Bold', HB], F3: ['Times-Roman', TR], F4: ['Times-Bold', TB], F5: ['Times-Italic', TI], F6: ['Helvetica-Oblique', HV]};

  // ---- text: to WinAnsi bytes (₹ → "Rs", typographic marks → their nearest), escaped for a PDF string ----
  function ansi(s) {
    s = String(s == null ? '' : s).replace(/₹\s?/g, 'Rs ').replace(/[‘’ʼ]/g, '\'').replace(/[“”]/g, '"').replace(/[–—−]/g, '-').replace(/…/g, '...')
      .replace(/×/g, 'x').replace(/✓/g, '').replace(/ /g, ' ');
    var o = '';
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); o += c >= 32 && c < 127 ? s[i] : c >= 160 && c < 256 ? s[i] : '?'; }
    return o;
  }
  function pstr(s) {
    var o = '(';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i), ch = s[i];
      o += ch === '(' || ch === ')' || ch === '\\' ? '\\' + ch : c < 127 ? ch : '\\' + ('00' + c.toString(8)).slice(-3);
    }
    return o + ')';
  }
  function width(s, f, size) {   // s already WinAnsi
    var t = FONTS[f][1], times = /^Times/.test(FONTS[f][0]), w = 0;
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); w += c >= 32 && c < 127 ? t[c - 32] : c === 183 ? (times ? 250 : 278) : times ? 500 : 556; }
    return w * size / 1000;
  }
  function wrap(s, f, size, max) {
    var words = ansi(s).split(/\s+/).filter(Boolean), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (cur && width(t, f, size) > max) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  }
  function n(v) { return (Math.round(v * 100) / 100).toString(); }
  function rgb(c, stroke) { return c.map(n).join(' ') + (stroke ? ' RG' : ' rg'); }

  // ---- the page, as a content stream ----
  function Page() { this.o = []; }
  Page.prototype = {
    raw: function (s) { this.o.push(s); return this; },
    text: function (s, x, y, f, size, col, opt) {
      opt = opt || {}; s = ansi(s); var cs = opt.cs || 0, w = width(s, f, size) + cs * Math.max(0, s.length - 1);
      if (opt.align === 'center') x -= w / 2; else if (opt.align === 'right') x -= w;
      this.o.push('BT /' + f + ' ' + n(size) + ' Tf ' + rgb(col || INK) + (cs ? ' ' + n(cs) + ' Tc' : '') + ' ' + n(x) + ' ' + n(y) + ' Td ' + pstr(s) + ' Tj' + (cs ? ' 0 Tc' : '') + ' ET');
      return w;
    },
    // a paragraph, wrapped to max; returns the y under it
    para: function (s, x, y, f, size, max, lead, col, align) {
      var self = this, ls = wrap(s, f, size, max);
      ls.forEach(function (l, i) { self.text(l, align === 'center' ? x + max / 2 : x, y - i * lead, f, size, col, {align: align}); });
      return y - ls.length * lead;
    },
    line: function (x1, y1, x2, y2, w, col) { this.o.push(rgb(col || INK, true) + ' ' + n(w) + ' w ' + n(x1) + ' ' + n(y1) + ' m ' + n(x2) + ' ' + n(y2) + ' l S'); },
    rect: function (x, y, w, h, lw, col, fill) { this.o.push(fill ? rgb(fill) + ' ' + n(x) + ' ' + n(y) + ' ' + n(w) + ' ' + n(h) + ' re f' : rgb(col, true) + ' ' + n(lw) + ' w ' + n(x) + ' ' + n(y) + ' ' + n(w) + ' ' + n(h) + ' re S'); },
    // a circle (or ellipse) from four Bézier arcs
    ell: function (cx, cy, rx, ry) {
      var k = 0.5523;
      this.o.push(n(cx + rx) + ' ' + n(cy) + ' m ' + n(cx + rx) + ' ' + n(cy + ry * k) + ' ' + n(cx + rx * k) + ' ' + n(cy + ry) + ' ' + n(cx) + ' ' + n(cy + ry) + ' c ' +
        n(cx - rx * k) + ' ' + n(cy + ry) + ' ' + n(cx - rx) + ' ' + n(cy + ry * k) + ' ' + n(cx - rx) + ' ' + n(cy) + ' c ' +
        n(cx - rx) + ' ' + n(cy - ry * k) + ' ' + n(cx - rx * k) + ' ' + n(cy - ry) + ' ' + n(cx) + ' ' + n(cy - ry) + ' c ' +
        n(cx + rx * k) + ' ' + n(cy - ry) + ' ' + n(cx + rx) + ' ' + n(cy - ry * k) + ' ' + n(cx + rx) + ' ' + n(cy) + ' c');
    },
    circle: function (cx, cy, r, w, col, fill) { this.ell(cx, cy, r, r); this.o.push(fill ? rgb(fill) + ' f' : rgb(col, true) + ' ' + n(w) + ' w S'); },
    poly: function (pts, w, col) {
      var s = n(pts[0][0]) + ' ' + n(pts[0][1]) + ' m';
      for (var i = 1; i < pts.length; i++) s += ' ' + n(pts[i][0]) + ' ' + n(pts[i][1]) + ' l';
      this.o.push(rgb(col, true) + ' ' + n(w) + ' w ' + s + ' S');
    },
    // text set on a circle, each letter turned to the tangent; top: reads clockwise over the top, letters upright outward
    // bottom: reads left to right under the foot, letters upright inward. The size shrinks until the text fits maxArc (radians).
    arcText: function (s, cx, cy, r, bottom, f, size, col, spacing, maxArc) {
      s = ansi(s); var tot = function () { return width(s, f, size) + spacing * (s.length - 1); };
      while (maxArc && tot() / r > maxArc && size > 3) { size -= 0.1; spacing *= 0.98; }
      var mid = bottom ? -Math.PI / 2 : Math.PI / 2, dirn = bottom ? 1 : -1, th = mid - dirn * tot() / r / 2, self = this;
      for (var i = 0; i < s.length; i++) {
        var w = width(s[i], f, size), tc = th + dirn * w / 2 / r, phi = tc + dirn * Math.PI / 2, c = Math.cos(phi), sn = Math.sin(phi);
        var x = cx + r * Math.cos(tc) - c * w / 2, y = cy + r * Math.sin(tc) - sn * w / 2;
        self.o.push('BT /' + f + ' ' + n(size) + ' Tf ' + rgb(col) + ' ' + [c, sn, -sn, c].map(function (v) { return v.toFixed(4); }).join(' ') + ' ' + n(x) + ' ' + n(y) + ' Tm ' + pstr(s[i]) + ' Tj ET');
        th += dirn * (w + spacing) / r;
      }
    },
    out: function () { return this.o.join('\n'); }
  };

  // the hypotrochoid rosette of the duty paper (ui.js rosette()), as a polyline
  function rosette(cx, cy, R0) {
    var R = 10, r = 3, d = 7.2, k = R0 / (R - r + d), pts = [];
    for (var i = 0; i <= 420; i++) { var t = i / 420 * Math.PI * 6; pts.push([cx + ((R - r) * Math.cos(t) + d * Math.cos((R - r) / r * t)) * k, cy - ((R - r) * Math.sin(t) - d * Math.sin((R - r) / r * t)) * k]); }
    return pts;
  }
  // the VSI mark (ui.js vsiLogo): a ring, an orbit and a satellite around a V, drawn in its own 48-unit box, y down
  function logo(pg, x, y, size, col) {
    var s = size / 48;
    pg.raw('q ' + n(s) + ' 0 0 ' + n(-s) + ' ' + n(x) + ' ' + n(y + size) + ' cm 1 J 1 j');
    pg.circle(24, 24, 15, 2.4, col);
    pg.raw('q 1 0 0 1 24 24 cm ' + [Math.cos(-28 * Math.PI / 180), Math.sin(-28 * Math.PI / 180), -Math.sin(-28 * Math.PI / 180), Math.cos(-28 * Math.PI / 180)].map(function (v) { return v.toFixed(4); }).join(' ') + ' 0 0 cm');
    pg.ell(0, 0, 22, 8); pg.raw(rgb(col, true) + ' 1.6 w S Q');
    pg.circle(41.6, 14.2, 3, 0, null, col);
    pg.raw(rgb(col, true) + ' 2.6 w 17 18 m 24 32 l 31 18 l S Q');
  }
  function guilloche(pg) {   // two interleaved waves between the double rules, all round the sheet
    var a = 24, b = 36, mid = (a + b) / 2, amp = (b - a) / 2 - 1.2, edge = function (x0, y0, x1, y1, ph) {
      var L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, pts = [], N = Math.round(L / 2.5);
      for (var i = 0; i <= N; i++) { var t = i / N * L, o = amp * Math.sin(t / 7 + ph); pts.push([x0 + ux * t - uy * o, y0 + uy * t + ux * o]); }
      return pts;
    };
    [[mid, mid, W - mid, mid], [W - mid, mid, W - mid, H - mid], [W - mid, H - mid, mid, H - mid], [mid, H - mid, mid, mid]].forEach(function (e) {
      pg.poly(edge(e[0], e[1], e[2], e[3], 0), 0.45, PALE); pg.poly(edge(e[0], e[1], e[2], e[3], Math.PI), 0.45, PALE);
    });
    pg.rect(a, a, W - 2 * a, H - 2 * a, 1.6, GREEN); pg.rect(b, b, W - 2 * b, H - 2 * b, 0.6, GREEN);
    pg.rect(a - 5, a - 5, W - 2 * a + 10, H - 2 * a + 10, 0.4, GREEN);
    [[mid, mid], [W - mid, mid], [mid, H - mid], [W - mid, H - mid]].forEach(function (c) { pg.circle(c[0], c[1], 15, 0, null, PAPER); pg.poly(rosette(c[0], c[1], 13), 0.5, GREEN); pg.circle(c[0], c[1], 14.5, 0.6, GREEN); });
  }
  function seal(pg, cx, cy, r, yearWord) {
    pg.raw('q');
    var rot = -8 * Math.PI / 180, c = Math.cos(rot), s = Math.sin(rot);
    pg.raw([c, s, -s, c].map(function (v) { return v.toFixed(4); }).join(' ') + ' ' + n(cx - c * cx + s * cy) + ' ' + n(cy - s * cx - c * cy) + ' cm');
    pg.circle(cx, cy, r, 2.2, RED); pg.circle(cx, cy, r - 3.2, 0.6, RED); pg.circle(cx, cy, r * 0.62, 1, RED);
    var inner = r * 0.62, outer = r - 3.2, cap = 4.6;
    pg.arcText('VIKRAM SARABHAI INTERNATIONAL', cx, cy, inner + (outer - inner - cap) / 2, false, 'F2', 6.6, RED, 0.6, 2.55);
    pg.arcText('AIRPORT LIMITED · COMMON SEAL', cx, cy, outer - (outer - inner - cap) / 2, true, 'F2', 6.6, RED, 0.6, 2.1);
    pg.circle(cx - inner - (outer - inner) / 2, cy, 1.3, 0, null, RED); pg.circle(cx + inner + (outer - inner) / 2, cy, 1.3, 0, null, RED);
    logo(pg, cx - r * 0.22, cy - r * 0.02, r * 0.44, RED);
    pg.text('HANDED BACK', cx, cy - r * 0.17, 'F2', 4.6, RED, {align: 'center', cs: 0.5});
    pg.text(yearWord, cx, cy - r * 0.34, 'F4', 8, RED, {align: 'center', cs: 0.4});
    pg.raw('Q');
  }
  function dLong(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? (+m[3]) + ' ' + MON[+m[2] - 1] + ' ' + m[1] : ''; }

  function content(cert, img) {
    var pg = new Page(), cx = W / 2, yrs = cert.years || 60, L = cert.lines || {};
    pg.rect(0, 0, W, H, 0, null, PAPER);
    guilloche(pg);
    // head: the mark, the airport, the title
    logo(pg, cx - 17, 512, 34, GREEN);
    pg.text(AIRPORT.toUpperCase() + '  ·  NAGPUR', cx, 496, 'F1', 9, GREEN, {align: 'center', cs: 1.6});
    pg.text('Certificate of Concession', cx, 455, 'F4', 36, INK, {align: 'center'});
    pg.line(cx - 70, 442, cx + 70, 442, 0.7, GREEN);
    pg.text('This certificate is awarded to', cx, 420, 'F5', 13, PENCIL, {align: 'center'});
    pg.text(cert.founder || 'The director', cx, 391, 'F4', 27, BLUE, {align: 'center'});
    pg.text('director, for ' + (cert.company || 'your company'), cx, 371, 'F3', 14, INK, {align: 'center'});
    var span = dLong(cert.signedOn) && dLong(cert.endsOn) ? ' from ' + dLong(cert.signedOn) + ' and handed it back on ' + dLong(cert.endsOn) : ', and handed it back after ' + yrs + ' years';
    var y = pg.para('who ran ' + AIRPORT + ', Nagpur, through ' + SPVS + span + '. The airport now belongs to the Airports Authority of India and the State of Maharashtra.',
      cx - 300, 351, 'F3', 12, 600, 15, INK, 'center');
    // the return, in big type
    y -= 30;
    pg.text(cert.big || (cert.returnPct + '% a year for ' + yrs + ' years'), cx, y, 'F4', 34, BLUE, {align: 'center'});
    pg.text('the return on every rupee ' + (cert.company || 'your company') + ' put in, counting every rupee that came back', cx, y - 17, 'F5', 11, PENCIL, {align: 'center'});
    // two columns: the money in plain words, and what delivered it
    var top = y - 48, lx = 84, lw = 340, rx = 462, rw = 296;
    pg.text('The money', lx, top, 'F2', 10.5, GREEN, {cs: 0.3});
    var ly = top - 17;
    [L.putIn, L.cameBack, L.made, L.perYear].filter(Boolean).forEach(function (s) { ly = pg.para(s, lx, ly, 'F1', 11.5, lw, 15, INK); });
    if (L.today) ly = pg.para(L.today, lx, ly - 5, 'F6', 8.6, lw, 11, PENCIL);
    pg.text('What delivered it:', rx, top, 'F2', 10.5, GREEN, {cs: 0.3});
    var ry = top - 18, dv = (cert.delivered || []).slice(0, 2);
    if (!dv.length) ry = pg.para(cert.closing || 'No single decision made it: it was many small ones.', rx, ry, 'F3', 12.5, rw, 15.5, INK);
    dv.forEach(function (d, i) { pg.text((i + 1) + '.', rx, ry, 'F4', 12.5, BLUE); ry = pg.para(d.sentence, rx + 16, ry, 'F3', 12.5, rw - 16, 15.5, INK) - 6; });
    pg.line(lx + lw + 18, top + 8, lx + lw + 18, Math.min(ly, ry) + 6, 0.4, PALE);
    // foot: the day-one signature, the issue line, the seal
    var fy = 86;
    if (img) {
      var maxW = 190, maxH = 50, sc = Math.min(maxW / img.w, maxH / img.h), iw = img.w * sc, ih = img.h * sc;
      pg.raw('q ' + n(iw) + ' 0 0 ' + n(ih) + ' ' + n(84 + (maxW - iw) / 2) + ' ' + n(fy + 4) + ' cm /Im1 Do Q');
    } else pg.text('(signed on the Concession Agreement)', 84 + 95, fy + 18, 'F5', 10, PENCIL, {align: 'center'});
    pg.line(84, fy, 84 + 190, fy, 0.7, INK);
    pg.text((cert.founder || 'The director') + ', director', 84, fy - 12, 'F1', 8.6, INK);
    pg.text('Signed on day one' + (cert.signedOn ? ', ' + dLong(cert.signedOn) : ''), 84, fy - 23, 'F6', 8, PENCIL);
    pg.text('Issued at Nagpur' + (cert.endsOn ? ' on ' + dLong(cert.endsOn) : '') + ',', cx + 6, fy + 10, 'F3', 10.5, INK, {align: 'center'});
    pg.text('the day the airport was handed back.', cx + 6, fy - 3, 'F3', 10.5, INK, {align: 'center'});
    pg.text('No. VSI/' + yrs + '/' + String(cert.signedOn || '').replace(/-/g, '') + '-C', cx + 6, fy - 19, 'F1', 7.5, PENCIL, {align: 'center', cs: 0.6});
    seal(pg, W - 124, fy + 8, 56, String(cert.endsOn || '').slice(0, 4));
    return pg.out();
  }

  // ---- the file: objects, a cross-reference table, the trailer ----
  function bytesOf(s) { var b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; }
  function build(cert, img) {
    cert = cert || {};
    var objs = [], add = function (parts) { objs.push(parts); return objs.length; };
    var fontIds = {};
    Object.keys(FONTS).forEach(function (k) { fontIds[k] = add(['<< /Type /Font /Subtype /Type1 /BaseFont /' + FONTS[k][0] + ' /Encoding /WinAnsiEncoding >>']); });
    var imId = img ? add(['<< /Type /XObject /Subtype /Image /Width ' + img.w + ' /Height ' + img.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + img.bytes.length + ' >>\nstream\n', img.bytes, '\nendstream']) : 0;
    var body = content(cert, img), cs = bytesOf(body);
    var cId = add(['<< /Length ' + cs.length + ' >>\nstream\n', cs, '\nendstream']);
    var pagesId = objs.length + 2, pageId = add(['<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Contents ' + cId + ' 0 R /Resources << /Font << ' +
      Object.keys(fontIds).map(function (k) { return '/' + k + ' ' + fontIds[k] + ' 0 R'; }).join(' ') + ' >>' + (imId ? ' /XObject << /Im1 ' + imId + ' 0 R >>' : '') + ' >> >>']);
    add(['<< /Type /Pages /Kids [' + pageId + ' 0 R] /Count 1 >>']);
    var catId = add(['<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>']);
    var infoId = add(['<< /Title ' + pstr(ansi('Certificate of Concession, ' + AIRPORT)) + ' /Author ' + pstr(ansi(cert.founder || '')) + ' /Subject ' + pstr(ansi(cert.big || '')) +
      ' /Creator (Vikram Sarabhai International, the game) /Producer (money/cert.js) >>']);
    var chunks = [bytesOf('%PDF-1.4\n%âãÏÓ\n')], off = chunks[0].length, xref = [];
    objs.forEach(function (parts, i) {
      xref.push(off);
      [bytesOf((i + 1) + ' 0 obj\n')].concat(parts.map(function (p) { return typeof p === 'string' ? bytesOf(p) : p; }), [bytesOf('\nendobj\n')]).forEach(function (b) { chunks.push(b); off += b.length; });
    });
    var x = 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + xref.map(function (o) { return ('000000000' + o).slice(-10) + ' 00000 n \n'; }).join('') +
      'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + catId + ' 0 R /Info ' + infoId + ' 0 R >>\nstartxref\n' + off + '\n%%EOF\n';
    chunks.push(bytesOf(x));
    var len = chunks.reduce(function (a, b) { return a + b.length; }, 0), out = new Uint8Array(len), p = 0;
    chunks.forEach(function (b) { out.set(b, p); p += b.length; });
    return out;
  }

  // ---- the signature: PNG data URL → trimmed to its ink → JPEG on the paper's white, via a canvas ----
  function jpegOf(dataUrl) {
    return new Promise(function (res) {
      if (!dataUrl || typeof document === 'undefined') { res(null); return; }
      var im = new Image();
      im.onload = function () {
        try {
          var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
          var g = c.getContext('2d'); g.drawImage(im, 0, 0);
          var a = g.getImageData(0, 0, c.width, c.height).data, x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
          for (var y = 0; y < c.height; y++) for (var x = 0; x < c.width; x++) if (a[(y * c.width + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
          if (x1 < 0) { x0 = 0; y0 = 0; x1 = c.width - 1; y1 = c.height - 1; }
          var pad = 8; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(c.width - 1, x1 + pad); y1 = Math.min(c.height - 1, y1 + pad);
          var t = document.createElement('canvas'); t.width = x1 - x0 + 1; t.height = y1 - y0 + 1;
          var h = t.getContext('2d'); h.fillStyle = 'rgb(' + PAPER.map(function (v) { return Math.round(v * 255); }).join(',') + ')'; h.fillRect(0, 0, t.width, t.height);
          h.drawImage(c, x0, y0, t.width, t.height, 0, 0, t.width, t.height);
          var url = t.toDataURL('image/jpeg', 0.92), bin = atob(url.slice(url.indexOf(',') + 1)), b = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
          res(b[0] === 0xFF && b[1] === 0xD8 ? {bytes: b, w: t.width, h: t.height} : null);
        } catch (e) { res(null); }
      };
      im.onerror = function () { res(null); };
      im.src = dataUrl;
    });
  }
  function pdf(cert, opts) {
    opts = opts || {};
    return jpegOf(opts.signature || (cert && cert.signature)).then(function (img) { return build(cert, img); });
  }
  function fileName(cert) { return 'VSI certificate, ' + (ansi((cert && cert.founder) || 'director').replace(/[^\w .-]+/g, '').trim() || 'director') + '.pdf'; }
  function download(cert, opts) {
    if (!cert || !cert.ok) return Promise.resolve({ok: false, why: (cert && cert.why) || 'There is no certificate for this concession.'});
    var Z = typeof window !== 'undefined' && window.ZMMoney;   // never for a banned company or director name
    if (Z && Z.certBanned && Z.certBanned(cert)) { if (Z.resetBanned) Z.resetBanned(); return Promise.resolve({ok: false, why: 'Error: no certificate for this name.'}); }
    return pdf(cert, opts).then(function (bytes) {
      var name = fileName(cert), url = URL.createObjectURL(new Blob([bytes], {type: 'application/pdf'})), a = document.createElement('a');
      a.href = url; a.download = name; a.style.display = 'none'; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 5000);
      return {ok: true, name: name, bytes: bytes.length};
    });
  }
  var API = {pdf: pdf, download: download, build: build, fileName: fileName, _ansi: ansi, _width: width};
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') root.ZMCert = API;
})(typeof window !== 'undefined' ? window : this);
