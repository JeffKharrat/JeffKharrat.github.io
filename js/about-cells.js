/* The About page's world, in the PROPAGATE language: flat-shaded, cell-cut structures (one place per CV stop), a causeway of
   cells along the original road, a "+" field, a few data-center racks. It shares the original walkway's camera, road curve,
   timeline and spark; only the scene changes. Every surface is cut into 0.5 m cells: ahead of the camera the world computes
   itself in with the cell front (the accent only on the newest band), behind it, it dissolves.
   AboutCells(gl, { xs, stops: [{ id, code, z, s }], zEnd, road }) → { draw(cam, opts) } */
(function () {
'use strict';
window.AboutCells = function (gl, cfg) {
const xs = cfg.xs, TAU = Math.PI * 2, CW = cfg.road, CH = .5, ZEND = cfg.zEnd;
const dxs = z => (xs(z + .5) - xs(z - .5));
const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const C = { ground: hex('#0E1014'), tile: hex('#050608'), panel: hex('#161920'), ghost: hex('#1D2029'), line: hex('#343945'),
  slate: hex('#2B2F38'), mid: hex('#5A6172'), ink2: hex('#9AA1B0'), bone: hex('#CDD0D8'), ink: hex('#E9EBF0'),
  red: hex('#FF5A3D'), lime: hex('#B4F000'), blue: hex('#4A5BFF'), yellow: hex('#FFC400') };
const NAMES = { tut: 'Bone gantry', mc: 'Facade street', zag: 'Turntable yard', mth: 'Layout stage', isd: 'Amphitheatre' };
const STOPS = cfg.stops.map((S, k) => ({ id: S.id, code: S.code, abt: 'ABT-0' + (k + 1), name: NAMES[S.id] || S.id, z: S.z, side: S.s, s: S.s, Tb: S.Tb, ext: S.ext }));

/* ---------- geometry: pos3 nrm3 col3 uv2 fsz2 kind1 rot3 rect4 = 21 floats ---------- */
const V = [];
let ROT = [0, 0, 0], RECT = [0, 0, 0, 0];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/* the road frame: local x is the distance from the road's centre (mirrored by side s, offset off), z runs along the road from
   z0, so everything authored straight follows the road's curve; directions turn with the road's tangent at that point */
/* two frames. The road frame: local x is the distance from the road's centre (mirrored by side s, offset off), z runs along the
   road from z0, so anything authored straight follows the road's curve. The hero frame: each place is authored facing the camera
   that parks at its stop: origin on the ground under the old building's centre, +z toward the parked camera, +x to its right
   on screen, so the composition is built for that one view. */
let F = { z0: 0, off: 0, s: 1 };
const RF = (z0, off, s) => ({ z0, off, s });
function HF(S) {
  const d = unit([S.s * .6, 0, .78]);                                     // the parked camera's heading (see parked() in index.html)
  return { hero: true, o: [S.Tb[0], 0, S.Tb[2]], X: [d[2], 0, -d[0]], Z: [-d[0], 0, -d[2]] };
}
const P = p => {
  if (F.hero) return [F.o[0] + F.X[0] * p[0] + F.Z[0] * p[2], p[1], F.o[2] + F.X[2] * p[0] + F.Z[2] * p[2]];
  const z = F.z0 + p[2]; return [xs(z) + F.s * (F.off + p[0]), p[1], z];
};
const N = (n, zl = 0) => {
  if (F.hero) return [F.X[0] * n[0] + F.Z[0] * n[2], n[1], F.X[2] * n[0] + F.Z[2] * n[2]];
  const d = dxs(F.z0 + zl), X = unit([1, 0, -d]), Z = unit([d, 0, 1]), v = [n[0] * F.s, n[1], n[2]];
  return [v[0] * X[0] + v[2] * Z[0], v[1], v[0] * X[2] + v[2] * Z[2]];
};
function quad(a, b, c, d, n, col, kind = 0, uvs) {           // a, b, c, d counter-clockwise seen from the front (world points)
  const w = Math.hypot(...sub(b, a)), h = Math.hypot(...sub(d, a));
  const U = uvs || [[0, 0], [1, 0], [1, 1], [0, 1]], pts = [a, b, c, d];
  [0, 1, 2, 0, 2, 3].forEach(i => V.push(...pts[i], ...n, ...col, ...U[i], w, h, kind, ...ROT, ...RECT));
}
/* an oriented box: centre, half sizes along its axes ax (3 unit vectors, local), colour */
function obox(c, h, ax, col, kind = 0, faces) {
  const [X, Y, Z] = ax.map(a => N(a, c[2])), C0 = P(c);
  const pt = (sx, sy, sz) => add(C0, add(add(mul(X, sx * h[0]), mul(Y, sy * h[1])), mul(Z, sz * h[2])));
  const fl = F.s < 0;                                          // a mirrored frame flips the winding
  const q = (a, b, c2, d, n, k) => { if (faces && !faces.includes(k)) return; fl ? quad(b, a, d, c2, n, col, kind) : quad(a, b, c2, d, n, col, kind); };
  q(pt(-1, -1, 1), pt(1, -1, 1), pt(1, 1, 1), pt(-1, 1, 1), Z, 'pz');
  q(pt(1, -1, -1), pt(-1, -1, -1), pt(-1, 1, -1), pt(1, 1, -1), mul(Z, -1), 'nz');
  q(pt(1, -1, 1), pt(1, -1, -1), pt(1, 1, -1), pt(1, 1, 1), X, 'px');
  q(pt(-1, -1, -1), pt(-1, -1, 1), pt(-1, 1, 1), pt(-1, 1, -1), mul(X, -1), 'nx');
  q(pt(-1, 1, 1), pt(1, 1, 1), pt(1, 1, -1), pt(-1, 1, -1), Y, 'py');
  q(pt(-1, -1, -1), pt(1, -1, -1), pt(1, -1, 1), pt(-1, -1, 1), mul(Y, -1), 'ny');
}
const AX0 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const box = (c, s, col, kind = 0, faces) => obox(c, mul(s, .5), AX0, col, kind, faces);   // axis-aligned: centre, full size
function beam(a, b, t, col, kind = 0) {                       // a square beam between two local points
  const d = sub(b, a), L = Math.hypot(...d), Z = unit(d), X = unit(Math.abs(Z[1]) > .95 ? cross([1, 0, 0], Z) : cross([0, 1, 0], Z)), Y = cross(Z, X);
  obox(mul(add(a, b), .5), [t / 2, t / 2, L / 2], [X, Y, Z], col, kind);
}
function prism(c, r, h, n, col, kind = 0) {                   // an n-sided column standing on c
  for (let i = 0; i < n; i++) {
    const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, p0 = [c[0] + Math.cos(a0) * r, c[1], c[2] + Math.sin(a0) * r], p1 = [c[0] + Math.cos(a1) * r, c[1], c[2] + Math.sin(a1) * r];
    const nn = N(unit([Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)]));
    const A = P(p0), B = P(p1), A2 = P(add(p0, [0, h, 0])), B2 = P(add(p1, [0, h, 0]));
    F.s < 0 ? quad(A, B, B2, A2, nn, col, kind) : quad(B, A, A2, B2, nn, col, kind);
    const T = P(add(c, [0, h, 0]));
    F.s < 0 ? quad(A2, B2, T, T, [0, 1, 0], col, kind) : quad(B2, A2, T, T, [0, 1, 0], col, kind);
  }
}
function sphere(c, r, col, kind = 0, nl = 10, nm = 16) {       // faceted sphere (flat faces read as cells)
  for (let i = 0; i < nl; i++) for (let j = 0; j < nm; j++) {
    const v = (a, b) => { const la = -Math.PI / 2 + a / nl * Math.PI, lo = b / nm * TAU; return [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)]; };
    const a = v(i, j), b = v(i, j + 1), c2 = v(i + 1, j + 1), d = v(i + 1, j);
    const n = N(unit(add(add(a, b), add(c2, d))));
    const W = q => P(add(c, mul(q, r)));
    F.s < 0 ? quad(W(a), W(b), W(c2), W(d), n, col, kind) : quad(W(b), W(a), W(d), W(c2), n, col, kind);
  }
}
/* a flat textured plate (atlas item), standing or lying: centre, width, height, facing normal n, up vector */
function label(item, c, w, n, up = [0, 1, 0], col = C.ink, kind = 3) {
  const A = ATLAS[item]; if (!A) return;
  const h = w * A.h / A.w, Nw = N(n, c[2]), Up = N(up, c[2]), Rt = unit(cross(Nw, Up)), C0 = P(c);
  const p = (x, y) => add(C0, add(mul(Rt, x * w / 2), mul(Up, y * h / 2)));
  const keep = RECT; RECT = [A.x, A.y, A.w, A.h];
  quad(p(-1, -1), p(1, -1), p(1, 1), p(-1, 1), Nw, col, kind);
  RECT = keep;
}

/* ---------- the text atlas ---------- */
/* ---------- the text atlas (labels, codes, numerals, logos) ---------- */
const atl = document.createElement('canvas'); atl.width = 2048; atl.height = 2048;
const ax = atl.getContext('2d');
const ATLAS = {};
let ax0 = 0, ay0 = 0, rowH = 0;
function slot(name, w, h) { if (ax0 + w > 2048) { ax0 = 0; ay0 += rowH + 4; rowH = 0; } ATLAS[name] = { x: ax0 / 2048, y: ay0 / 2048, w: w / 2048, h: h / 2048, px: ax0, py: ay0, pw: w, ph: h }; ax0 += w + 4; rowH = Math.max(rowH, h); return ATLAS[name]; }
function text(name, str, font, size, opt = {}) {
  ax.font = `${opt.weight || 800} ${size}px ${font}`;
  const w = Math.ceil(ax.measureText(str).width + size * .3), h = Math.ceil(size * 1.25), s = slot(name, w, h);
  ax.fillStyle = '#fff'; ax.textBaseline = 'middle'; ax.fillText(str, s.px + size * .15, s.py + h / 2);
}
function vtext(name, str, font, size) {
  const ch = [...str], c = Math.round(size * 1.15), s = slot(name, c, c * ch.length);
  ax.font = `400 ${size}px ${font}`; ax.fillStyle = '#fff'; ax.textAlign = 'center'; ax.textBaseline = 'middle';
  ch.forEach((g, i) => ax.fillText(g, s.px + c / 2, s.py + c * i + c / 2 + size * .04));
  ax.textAlign = 'start';
}
function solidK(name, ch, font, size) {
  const c = Math.round(size * 1.2), s = slot(name, c, c);
  ax.fillStyle = '#fff'; ax.fillRect(s.px, s.py, c, c);
  ax.save(); ax.globalCompositeOperation = 'destination-out'; ax.font = `400 ${size}px ${font}`; ax.textAlign = 'center'; ax.textBaseline = 'middle';
  ax.fillText(ch, s.px + c / 2, s.py + c / 2 + size * .04); ax.restore();
}
function buildAtlas() {
  ax.clearRect(0, 0, 2048, 2048); ax0 = ay0 = rowH = 0;
  const D = "'Tektur'", M = "'M PLUS 1 Code'", J = "'Dela Gothic One'";
  ['01', '02', '03', '04', '05'].forEach(n => text('n' + n, n, D, 220));
  STOPS.forEach(S => { text('c-' + S.id, S.code, D, 96); text('a-' + S.id, S.abt + ' · ' + S.name.toUpperCase(), M, 44, { weight: 500 }); });
  [['TAG', 'タグ'], ['EXPORT', '書出し'], ['IMPORT', '読込み'], ['BUILD', '構築']].forEach(([e, j], i) => { text('g' + i, e, D, 80); text('gj' + i, j, J, 64, { weight: 400 }); });
  text('manifest', 'MANIFEST · FBX METADATA', M, 40, { weight: 700 });
  ['SH010', 'SH020', 'SH030'].forEach(s => text(s, s, D, 90));
  text('gate', '2.39 : 1', M, 50, { weight: 700 });
  text('rename', 'ZAG-23 → MC-23', D, 90);
  text('chart', 'CHART · 24 STEPS', M, 40, { weight: 700 });
  text('spark', 'FRAME 0', D, 80);
  text('tiers', 'TEAM OF 8', M, 44, { weight: 700 });
  text('cell', '1 CELL = 0.5 M', M, 36, { weight: 500 });
  /* Japanese: vertical signs (one character per cell) and solid blocks (an ink square with the kanji knocked out) */
  [['v-tut', '研究室'], ['v-mc', '書割りの街'], ['v-zag', '回転台'], ['v-mth', '撮影舞台'], ['v-isd', '階段教室'], ['v-path', '経路'], ['v-spark', '火花']].forEach(([n, str]) => vtext(n, str, J, 120));
  ['骨', '街', '灯', '舞', '筋', '火', '門', '学'].forEach(ch => solidK('k-' + ch, ch, J, 220));
}


/* ---------- the places: hero frame, +z toward the parked camera, +x screen right ---------- */
const front = [0, 0, 1];
function vsign(item, x, z, h, col = C.ink) {                              // a vertical kanji sign facing the camera, on a post
  const A = ATLAS[item]; if (!A) return;
  const w = h * A.w / A.h;
  box([x, h / 2 + 1.2, z], [w + .5, h + .6, .25], C.panel); box([x, .6, z - .1], [.3, 1.2, .2], C.mid);
  label(item, [x, h / 2 + 1.2, z + .14], w, front, [0, 1, 0], col);
}
/* a hall in the made-moon manner: blunt block, a band of cells near the top, stacks and a lattice mast on the roof, and on its
   front (facing the camera) a building-scale numeral and a solid kanji */
function hall(cx, cz, w, d, h, num, kanji, mastSide = 1) {
  box([cx, h / 2, cz], [w, h, d], C.slate, 9);
  box([cx - w * .18, h + .55, cz - d * .1], [w * .42, 1.1, d * .5], C.mid);
  [-.32, 0, .32].forEach((f, i) => prism([cx + w * .28 + f * 2.4, h, cz - d * .25], .7 + i * .08, 2.6 + i * .9, 10, C.mid));
  const mx = cx + mastSide * w * .38, mz = cz - d * .3, mh = h + 7.5;
  [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]].forEach(([a, b]) => beam([mx + a, h, mz + b], [mx + a * .3, mh, mz + b * .3], .09, C.ink2));
  for (let y = h + 1.2; y < mh - .6; y += 1.4) { const k = (y - h) / 7.5 * .35; beam([mx - .5 + k, y, mz + .5 - k], [mx + .5 - k, y + 1.4, mz - .5 + k], .05, C.ink2); }
  if (num) label(num, [cx - w * .24, h * .46, cz + d / 2 + .03], Math.min(w * .36, h * .8), front, [0, 1, 0], C.ink2);
  if (kanji) label(kanji, [cx + w * .26, h * .5, cz + d / 2 + .03], Math.min(w * .26, h * .5), front, [0, 1, 0], C.ink);
}
function joint(p, size, live) {                                           // a joint block with its three axis stubs
  box(p, [size, size, size], live ? C.ink : C.mid, live ? 6 : 0);
  const a = size * .5, b = size * 1.1;
  beam(add(p, [a, 0, 0]), add(p, [b, 0, 0]), size * .12, C.red); beam(add(p, [0, a, 0]), add(p, [0, b, 0]), size * .12, C.lime); beam(add(p, [0, 0, a]), add(p, [0, 0, b]), size * .12, C.blue);
}
const BUILD = {
  /* 01 · the research institute: a blunt hall wearing the bone gantry over its door, and a path of four torii gates leading
     to it from the camera, one per pipeline step (TAG, EXPORT, IMPORT, BUILD), read front to back */
  tut(S) {
    hall(0, -3.4, 13, 9.6, 11.6, 'n01', null, -1);
    box([0, 2.4, 1.45], [3.2, 4.8, .4], C.tile);                           // the door
    const J = [[-5.4, 0, 2.4], [-5.4, 8.2, 2.4], [-3, 11.4, 2.4], [1.4, 12.8, 2.4], [5.4, 10.2, 2.4], [5.4, 0, 2.4]];
    for (let i = 0; i < J.length - 1; i++) beam(J[i], J[i + 1], .75, C.bone);
    J.forEach((j, i) => { if (!i || i === J.length - 1) box(add(j, [0, .35, 0]), [1.4, .7, 1.4], C.slate); else joint(j, 1.1, i === 3); });
    label('k-骨', [0, 6.3, 2.62], 2.2, front, [0, 1, 0], C.ink);
    [['g3', 'gj3', 3.6], ['g2', 'gj2', 6.2], ['g1', 'gj1', 8.8], ['g0', 'gj0', 11.4]].forEach(([g, gj, z], i) => {
      const hw = 1.7, hh = 3.3 - i * .1;
      box([-hw, hh / 2, z], [.3, hh, .3], C.mid); box([hw, hh / 2, z], [.3, hh, .3], C.mid);
      box([0, hh + .2, z], [hw * 2 + .9, .34, .4], C.bone); box([0, hh + .48, z], [hw * 2 + 1.5, .2, .5], C.ink2);
      box([0, hh - .7, z], [hw * 2 + .2, .24, .22], C.mid);
      label(g, [-.75, hh - .7, z + .13], 1.15, front, [0, 1, 0], C.ink); label(gj, [.95, hh - .7, z + .13], .72, front, [0, 1, 0], C.ink2);
    });
    box([0, .06, 7.6], [3, .12, 12.4], C.panel, 1);                         // the path
    vsign('v-tut', 6.6, 2.2, 4.2);
    label('manifest', [-3.4, 1.1, 11.6], 2.2, front, [0, 1, 0], C.ink2); box([-3.4, 1.1, 11.45], [2.5, .7, .2], C.panel);
  },
  /* 02 · facade street: a real street receding from the camera, two rows of buildings with cube-mapped window rooms on their
     street sides and fronts, shop signs, and a gate building at the end with a passage under a solid 街 */
  mc(S) {
    const st = 2.6, rows = [[5, 7.5], [-1.5, 9], [-8, 6.6]];
    [-1, 1].forEach(sd => rows.forEach(([z, h], i) => {
      const d = 6, w = 5.4 + (i % 2) * .8, x = sd * (st + w / 2), hh = h + (sd > 0 ? .8 : 0) * (i === 1 ? 1 : 0);
      box([x, hh / 2, z], [w, hh, d - .2], C.ink2, 2, [sd > 0 ? 'nx' : 'px', 'pz']);
      box([x, hh / 2, z], [w, hh, d - .2], C.slate, 9, [sd > 0 ? 'px' : 'nx', 'nz', 'py']);
      box([x + sd * .6, hh + .6, z - .8], [w * .4, 1.2, 1.8], C.mid);
      if (i === 0) { box([x + sd * 1.2, hh + 1.6, z + 1.2], [1, 1, 1], C.bone); prism([x + sd * 1.2, hh + 1.2, z + 1.2], .5, .4, 8, C.mid); }
      box([sd * (st + .35), 2.8, z + 1.6], [.5, 3, .18], C.panel);           // a vertical shop sign hanging off the wall
      label(['k-街', 'k-灯', 'k-門'][i], [sd * (st + .35), 2.8, z + 1.71], .42, front, [0, 1, 0], C.ink);
    }));
    box([0, 4, -12.6], [st * 2 + 11, 8, 5], C.ink2, 2, ['pz']); box([0, 4, -12.6], [st * 2 + 11, 8, 5], C.slate, 9, ['nz', 'py', 'px', 'nx']);
    box([0, 1.6, -10.05], [st * 2 - .4, 3.2, .2], C.tile);                // the passage
    label('k-街', [0, 5.4, -10.05], 2.4, front, [0, 1, 0], C.ink);
    vsign('v-mc', st + .6, 6.3, 4.8);
    [[-1.2, 0, 4.5], [-.6, 0, 3.2], [-1.0, 1, 4.0]].forEach(([x, y, z], i) => box([x, y + .45, z], [.9, .9, .9], i % 2 ? C.mid : C.bone));
    box([0, .04, -2], [st * 2, .08, 22], C.panel, 1);
  },
  /* 03 · the turntable yard: three plinths with turning reference balls in front of a lookdev hall, a light gantry over them,
     a grey chart on the right, the rename sign on the hall */
  zag(S) {
    hall(0, -6, 12, 7, 9.4, 'n03', 'k-灯', 1);
    label('rename', [0, 7.9, -2.45], 5.4, front, [0, 1, 0], C.ink);
    [[-3.6, 2.2, 0], [0, 3.4, 5], [3.6, 2.2, 7]].forEach(([x, z, k], i) => {
      prism([x, 0, z], 1.5, .8, 10, C.slate);
      ROT = [P([x, 0, z])[0], P([x, 0, z])[2], .3 + i * .1];
      prism([x, .8, z], 1.3, .12, 10, C.mid); sphere([x, 2.1, z], 1.05, i === 1 ? C.ink : C.ink2, k, 10, 16);
      ROT = [0, 0, 0];
    });
    [[-5.6, -.4], [5.6, -.4], [-5.6, 6], [5.6, 6]].forEach(([x, z]) => box([x, 3.6, z], [.25, 7.2, .25], C.mid));
    beam([-5.6, 7.2, -.4], [5.6, 7.2, -.4], .25, C.mid); beam([-5.6, 7.2, 6], [5.6, 7.2, 6], .25, C.mid);
    beam([-5.6, 7.2, -.4], [-5.6, 7.2, 6], .25, C.mid); beam([5.6, 7.2, -.4], [5.6, 7.2, 6], .25, C.mid);
    [[-3.6, 2.2], [0, 3.4], [3.6, 2.2]].forEach(([x, z]) => box([x, 6.9, z], [.6, .4, .6], C.bone));
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const g = (r * 4 + c) / 15, col = [0, 1, 2].map(i => C.tile[i] + (C.ink[i] - C.tile[i]) * g); box([7.4 + c * .8, .9 + r * .8, 2], [.75, .75, .2], col); }
    label('chart', [8.6, 4.4, 2.12], 2.6, front, [0, 1, 0], C.ink2);
    vsign('v-zag', -7.6, 3, 3.4);
  },
  /* 04 · the layout stage: a sound-stage hall behind, a stage of grey-box blocking in front of it, a 2.39:1 film gate on the
     stage's front edge, cameras on tripods aimed at the stage */
  mth(S) {
    hall(0, -7, 14, 8, 9.2, 'n04', 'k-舞', -1);
    box([0, .3, 0], [13, .6, 7.5], C.panel);
    [[-3.4, 1.6, -1.2, 2, 2, 2, 'SH010'], [0, 2.1, -2, 2.4, 3, 2.4, 'SH020'], [3.6, 1.3, .4, 3, 1.4, 3, 'SH030']].forEach(([x, y, z, a, b, c, t]) => {
      box([x, y, z], [a, b, c], C.mid); label(t, [x, y + b / 2 + .02, z], a * .8, [0, 1, 0], [0, 0, -1], C.ink);
    });
    prism([5.6, .6, -2.4], .8, 2.6, 8, C.ink2);
    const gw = 9, gh = gw / 2.39, gz = 3.6;
    beam([-gw / 2, .6, gz], [-gw / 2, .6 + gh, gz], .32, C.bone); beam([gw / 2, .6, gz], [gw / 2, .6 + gh, gz], .32, C.bone);
    beam([-gw / 2, .6 + gh, gz], [gw / 2, .6 + gh, gz], .32, C.bone); beam([-gw / 2, .6, gz], [gw / 2, .6, gz], .32, C.bone);
    label('gate', [-gw / 2 + 1.3, .6 + gh + .45, gz + .17], 1.8, front, [0, 1, 0], C.ink2);
    [[-6.4, 7.4], [6.6, 6.6]].forEach(([x, z]) => {
      const top = [x, 1.7, z]; [0, 1, 2].forEach(i => { const a = i / 3 * TAU; beam([x + Math.cos(a) * .5, 0, z + Math.sin(a) * .5], top, .05, C.ink2); });
      const cam = add(top, [0, .25, 0]); box(cam, [.45, .38, .6], C.bone);
      const aim = unit(sub([0, 2, -1], cam)), r = unit(cross([0, 1, 0], aim)), u = cross(aim, r), far = add(cam, mul(aim, 5));
      const cnr = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => add(far, add(mul(r, a * 1.6), mul(u, b * .67))));
      cnr.forEach((p, i) => { beam(cam, p, .03, C.ink2); beam(p, cnr[(i + 1) % 4], .03, C.ink2); });
    });
    vsign('v-mth', 7.8, 1.4, 4.2);
  },
  /* 05 · the amphitheatre: stepped tiers in a half ring opening toward the camera, a muscle arch of layered fibres between two
     bones in the middle, eight plinths for the team of eight, the school's halls behind */
  isd(S) {
    hall(-3, -14, 12, 7, 8, 'n05', 'k-学', 1); hall(9, -12, 8, 6, 6, null, 'k-筋', -1);
    for (let t = 0; t < 5; t++) {
      const R = 4.6 + t * 1.3, n = 10 + t * 2, h = (t + 1) * .32;
      for (let i = 0; i < n; i++) {
        const a = Math.PI + (i + .5) / n * Math.PI, w = R * Math.PI / n * .95;
        const Rr = [Math.cos(a), 0, Math.sin(a)], Tg = [-Math.sin(a), 0, Math.cos(a)];
        obox([Rr[0] * R, h / 2, -1 + Rr[2] * R], [.65, h / 2, w / 2], [Rr, [0, 1, 0], Tg], t % 2 ? C.slate : C.mid);
      }
    }
    for (let i = 0; i < 8; i++) { const a = Math.PI + (i + .5) / 8 * Math.PI, R = 4.6 + 3 * 1.3; box([Math.cos(a) * R, 1.28 + .8, -1 + Math.sin(a) * R], [.4, 1.6, .4], C.bone); }
    const A = [-3.6, 0, 0], B = [3.6, 0, 0];
    [A, B].forEach(p => { box(add(p, [0, 3, 0]), [1, 6, 1], C.bone); box(add(p, [0, 6.6, 0]), [1.6, 1.6, 1.6], C.ink); label('k-骨', add(p, [0, 6.6, .82]), 1.2, front, [0, 1, 0], C.ink); });
    for (let l = 0; l < 6; l++) {
      const seg = 12, y0 = 6.6 + l * .22, ofs = (l - 2.5) * .26;
      for (let i = 0; i < seg; i++) {
        const p = t => [-3.6 + t * 7.2, y0 + Math.sin(t * Math.PI) * (2.2 + l * .2), ofs];
        beam(p(i / seg), p((i + 1) / seg), .22, l === 3 ? C.ink : (l % 2 ? C.ink2 : C.bone), l === 3 ? 6 : 0);
      }
    }
    vsign('v-isd', -8.4, 3.6, 4.2);
  }
};


/* ---------- the world ---------- */
function world() {
  V.length = 0; ROT = [0, 0, 0]; RECT = [0, 0, 0, 0];
  F = RF(0, 0, 1);
  for (let z = -14; z < ZEND - 26; z += 1.5) box([0, CH / 2, z], [CW * 2, CH, 1.62], C.slate, 1);   // the causeway along the road
  for (let z = ZEND - 26; z < ZEND - 16; z += 1.5) {                       // its end breaks into cells before the spark's field
    for (let x = -CW + .25; x < CW; x += .5) if (Math.sin(x * 12.9 + z * 78.2) * .5 + .5 > (z - (ZEND - 26)) / 10) box([x, CH / 2, z], [.48, CH, .48], C.slate, 1);
  }
  STOPS.forEach((S, k) => {
    F = RF(S.z - 9, 0, 1); label('n0' + (k + 1), [0, CH + .012, 0], 2.6, [0, 1, 0], [0, 0, 1], C.ink2);
    F = RF(S.z - 24, CW + .35, S.side);
    box([0, 1.1, 0], [.12, 2.2, .12], C.mid);
    label('c-' + S.id, [0, 2.0, -.08], 1.3, [0, 0, -1], [0, 1, 0], C.ink);
    label('a-' + S.id, [0, 1.62, -.08], 1.5, [0, 0, -1], [0, 1, 0], C.ink2);
  });
  STOPS.forEach((S, k) => { F = HF(S); if (BUILD[S.id]) BUILD[S.id](S, k); F = RF(0, 0, 1); });
  let rs = 11; const rr = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
  /* the made moon's industry between and behind the places (after concept 09): low blunt halls with cell bands, stacks,
     lattice masts, tank farms, terraces; kept off the road and out of every parked camera's line of sight */
  const VIEWS = STOPS.map(S => { const d = unit([S.s * .6, 0, .78]); return { a: [S.Tb[0] - d[0] * 30, S.Tb[2] - d[2] * 30], b: [S.Tb[0], S.Tb[2]] }; });
  const segD = (p, a, b) => { const ab = [b[0] - a[0], b[1] - a[1]], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / (ab[0] ** 2 + ab[1] ** 2))); return Math.hypot(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t); };
  const free = (x, z, r) => {
    for (let zz = z - r - 6; zz <= z + r + 6; zz += 3) if (Math.abs(xs(zz) - x) < r + 9) return false;          // the road and the camera on it
    return STOPS.every(S => Math.hypot(S.Tb[0] - x, S.Tb[2] - z) > r + 15) && VIEWS.every(V => segD([x, z], V.a, V.b) > r + 6);
  };
  const KJ = ['k-骨', 'k-街', 'k-灯', 'k-舞', 'k-筋', 'k-門', 'k-学'];
  let placed = 0;
  for (let i = 0; i < 260 && placed < 70; i++) {
    const z = -20 + rr() * (ZEND - 10), sd = rr() < .5 ? -1 : 1, far = rr(), dist = 18 + far * far * 80, x = xs(z) + sd * dist;
    const kind = rr(), r = kind < .5 ? 7 : kind < .75 ? 4 : 3;
    if (!free(x, z, r)) continue;
    placed++;
    const toRoad = unit([xs(z) - x, 0, 0 - 0 + .35]), yaw = Math.round(Math.atan2(toRoad[0], toRoad[2]) / (Math.PI / 8)) * (Math.PI / 8);
    F = { hero: true, o: [x, 0, z], X: [Math.cos(yaw), 0, -Math.sin(yaw)], Z: [Math.sin(yaw), 0, Math.cos(yaw)] };
    if (kind < .5) {                                                        // a hall, sometimes with a wing and a painted kanji
      const w = 8 + rr() * 10, d = 6 + rr() * 8, h = 4 + rr() * 7;
      hall(0, 0, w, d, h, null, rr() < .35 ? KJ[rr() * KJ.length | 0] : null, rr() < .5 ? 1 : -1);
      if (rr() < .5) box([w * .5 + 2, h * .3, d * .1], [4, h * .6, d * .7], C.slate, 9);
    } else if (kind < .75) {                                                // a tank farm: squat cylinders on a plinth, pipes between
      box([0, .3, 0], [8, .6, 6], C.panel);
      for (let t = 0; t < 3; t++) { const tx = -2.6 + t * 2.6, th = 2 + rr() * 2.5; prism([tx, .6, 0], 1.05, th, 10, t % 2 ? C.mid : C.slate); if (t) beam([tx - 2.6 + 1, 1.6, 0], [tx - 1, 1.6, 0], .18, C.ink2); }
    } else if (kind < .9) {                                                 // a lone lattice mast with a lamp box
      const mh = 10 + rr() * 12;
      [[-.6, -.6], [.6, -.6], [.6, .6], [-.6, .6]].forEach(([a, b]) => beam([a, 0, b], [a * .25, mh, b * .25], .08, C.ink2));
      for (let y = 1.4; y < mh - 1; y += 1.6) { const k = y / mh * .45; beam([-.6 + k, y, .6 - k], [.6 - k, y + 1.6, -.6 + k], .04, C.ink2); }
      box([0, mh + .3, 0], [.6, .6, .6], C.bone);
    } else {                                                                // a stepped terrace of cells
      for (let t = 0; t < 4; t++) box([0, .5 + t, -t * 1.2], [6 - t, 1, 2.4], t % 2 ? C.slate : C.mid, 9);
    }
  }
  F = RF(0, 0, 1);
  /* the horizon: a far ring of long, low blocks so the field never just stops */
  for (let z = -60; z < ZEND + 60; z += 14 + rr() * 10) [-1, 1].forEach(sd => {
    const x = xs(z) + sd * (110 + rr() * 30), w = 10 + rr() * 22, h = 3 + rr() * 9;
    F = { hero: true, o: [x, 0, z], X: [1, 0, 0], Z: [0, 0, 1] }; box([0, h / 2, 0], [8, h, w], C.panel, 9);
    if (rr() < .3) prism([0, h, w * .2], 1, 3 + rr() * 4, 8, C.slate);
  });
  F = RF(0, 0, 1);
  for (let z = 4; z < ZEND - 30; z += 16 + rr() * 14) {                  // a few data-center machines here and there
    const sd = rr() < .5 ? -1 : 1, x0 = 20 + rr() * 26, n = 1 + (rr() * 3 | 0), hR = 2.2 + (rr() < .3 ? 1.1 : 0);
    F = RF(z, x0, sd);
    for (let r = 0; r < n; r++) box([0, hR / 2, r * .82], [1.1, hR, .78], C.panel, 8);
  }
  F = RF(-4, CW + .02, -1); label('v-path', [0, CH + 2.2, 0], 1.0, [-1, 0, 0], [0, 1, 0], C.ink2);
}

/* ---------- shaders: the original walkway's camera projection, so both passes line up ---------- */
const PROJ = `
uniform vec3 uE, uR, uU, uF; uniform vec2 uC, uHalf; uniform float uFoc;
vec4 proj(vec3 p){ vec3 dd = p - uE, c = vec3(dot(dd, uR), dot(dd, uU), dot(dd, uF));
  return vec4((uFoc * c.x + uC.x * c.z) / uHalf.x, (uFoc * c.y - uC.y * c.z) / uHalf.y, (c.z * 1000.1 - 200.) / 999.9, c.z); }`;
const VS = `
attribute vec3 aP, aN, aC; attribute vec2 aUV, aFS; attribute float aK; attribute vec3 aR; attribute vec4 aRect;
uniform float uT;` + PROJ + `
varying vec3 vW, vO, vN, vC; varying vec2 vUV, vFS; varying float vK; varying vec4 vRect;
void main(){
  vec3 p = aP, n = aN;
  if (aR.z != 0.) { float a = uT * aR.z, c = cos(a), s = sin(a); vec2 d = p.xz - aR.xy; p.xz = aR.xy + vec2(c*d.x - s*d.y, s*d.x + c*d.y); n.xz = vec2(c*n.x - s*n.z, s*n.x + c*n.z); }
  vO = aP; vW = p; vN = n; vC = aC; vUV = aUV; vFS = aFS; vK = aK; vRect = aRect;
  gl_Position = proj(p);
}`;
const FS = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
varying vec3 vW, vO, vN, vC; varying vec2 vUV, vFS; varying float vK; varying vec4 vRect;
uniform vec3 uE, uAcc, uL, uGround; uniform float uCamZ, uT, uAhead, uBehind, uFog;
uniform sampler2D uTex;
const vec3 GROUND = vec3(.055,.063,.078), INK = vec3(.914,.922,.941), INK2 = vec3(.604,.631,.69), PANEL = vec3(.086,.098,.125),
  GHOST = vec3(.114,.125,.161), LINE = vec3(.204,.224,.271), SLATE = vec3(.169,.184,.22);
const float CELL = .5;
float hash(vec3 p){ p = fract(p * .3183099 + vec3(.11,.17,.13)); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float bayer(vec2 q){ vec2 m = mod(floor(q), 4.); float i = m.x + m.y * 4.; float b = 0.;
  if (i < .5) b = 0.; else if (i < 1.5) b = 8.; else if (i < 2.5) b = 2.; else if (i < 3.5) b = 10.; else if (i < 4.5) b = 12.; else if (i < 5.5) b = 4.;
  else if (i < 6.5) b = 14.; else if (i < 7.5) b = 6.; else if (i < 8.5) b = 3.; else if (i < 9.5) b = 11.; else if (i < 10.5) b = 1.; else if (i < 11.5) b = 9.;
  else if (i < 12.5) b = 15.; else if (i < 13.5) b = 7.; else if (i < 14.5) b = 13.; else b = 5.; return (b + .5) / 16.; }
/* interior mapping: a room behind a window. f = position in the window (0..1), d = view ray in the window's tangent frame */
vec3 room(vec2 f, vec3 d, float lit){
  vec3 p = vec3(f * 2. - 1., 0.); d.z = min(d.z, -.001);
  vec3 tw = (sign(d) - p) / d; tw.z = (-2. - p.z) / d.z;     // walls at x/y = ±1, back wall at z = -2
  float t = min(min(tw.x, tw.y), tw.z);
  vec3 h = p + d * t;
  vec3 c = t == tw.z ? mix(GHOST, INK2, lit) : (t == tw.y ? (d.y > 0. ? PANEL : LINE) : mix(PANEL, GHOST, .5 + .5 * sign(d.x) * .4));
  float g = step(.92, fract(h.z * -1.)) * step(t, tw.z - .01);
  return mix(c, LINE, g * .5);
}
void main(){
  vec3 n = normalize(vN);
  /* the cell front: world cells (fixed to the object, so turning parts keep their cells) */
  vec3 cid = floor((vO - n * .01) / CELL);
  float rnd = hash(cid + 7.3);
  float dz = (cid.z + .5) * CELL - uCamZ;
  float vA = dz / uAhead + abs(cid.x * CELL) * .004 + rnd * .45;   // ahead: resolved inside uAhead (plus noise)
  float vB = -dz / uBehind + rnd * .7;                               // behind: gone past uBehind
  if (vA > 1. || vB > 1.) discard;
  float band = step(1. - .1, vA) + step(1. - .22, vB);
  float k = vK;
  vec3 col = vC;
  float L = dot(n, uL), lit = step(0., L);
  float top = step(.7, n.y);
  vec3 shade = col * mix(.42, 1., lit) * mix(1., 1.06, top);
  vec2 m = vUV * vFS;                                                 // position on the face in metres
  float ed = min(min(m.x, vFS.x - m.x), min(m.y, vFS.y - m.y));
  float edge = 1. - smoothstep(0., fwidth(ed) * 1.4, ed);
  if (k > .5 && k < 1.5) {                                            // causeway top: cell grid, resolved floor
    vec2 g = fract(vW.xz / CELL); float gl = step(min(min(g.x, 1. - g.x), min(g.y, 1. - g.y)), .025);
    shade = mix(shade, LINE * mix(.6, 1., lit), gl * top);
  } else if (k > 1.5 && k < 2.5) {                                    // facade: a window grid, each window a room
    vec2 w = vec2(m.x / 1.75, m.y / 2.6); vec2 wi = floor(w), wf = fract(w);
    float inWin = step(.18, wf.x) * step(wf.x, .82) * step(.22, wf.y) * step(wf.y, .86) * step(1., wi.y);
    vec3 T = normalize(cross(vec3(0., 1., 0.), n)), B = vec3(0., 1., 0.);
    vec3 vd = normalize(vW - uE);
    vec3 d = vec3(dot(vd, T), dot(vd, B), dot(vd, n));
    float rowOn = step(.5, hash(vec3(wi, floor(uT * .25)))) ;
    vec3 r = room(vec2((wf.x - .18) / .64, (wf.y - .22) / .64), d, rowOn);
    vec3 fac = mix(SLATE * .8, vec3(.30,.32,.37), lit);
    shade = mix(fac, r, inWin);
    float sw = step(abs(wi.y - mod(floor(uT * 1.3), 7.) - 1.), .1) * inWin * step(.6, hash(vec3(wi.x, 3., floor(uT * 1.3))));
    shade = mix(shade, uAcc, sw);                                     // one row of windows switching on: the only accent here
  } else if (k > 2.5 && k < 3.5) {                                    // a label from the atlas
    float a = texture2D(uTex, vRect.xy + vec2(vUV.x, 1. - vUV.y) * vRect.zw).a;
    if (a < .35) discard;
    shade = col; edge = 0.;
  } else if (k > 3.5 && k < 4.5) {                                    // the spark: unlit
    shade = col; edge = 0.;
  } else if (k > 4.5 && k < 5.5) {                                    // dithered ball
    float lam = clamp(L * .5 + .5, 0., 1.);
    shade = mix(PANEL, INK, step(bayer(gl_FragCoord.xy / 2.), lam * lam * 1.1)); edge = 0.;
  } else if (k > 5.5 && k < 6.5) {                                    // the evaluating part: the accent pulses through it as a front
    float ph = fract(uT * .35 - (vO.y + vO.z) * .05);
    shade = mix(shade, uAcc, step(ph, .08));
  } else if (k > 6.5 && k < 7.5) {                                    // chrome ball drawn flat: bands of the reflected sky
    vec3 rv = reflect(normalize(vW - uE), n);
    shade = mix(LINE, INK, step(.15, rv.y)) * mix(.5, 1., step(-.25, rv.y)); edge = 0.;
  } else if (k > 7.5 && k < 8.5) {                                    // a rack face: rack units, each with a square status light
    float side = step(.5, abs(n.x)) + step(.5, abs(n.z));
    vec2 u = vec2(m.x, m.y); float un = floor(u.y / .2);
    float slot = step(.03, fract(u.y / .2)) * step(.08, u.x) * step(u.x, vFS.x - .08) * step(.2, u.y) * step(u.y, vFS.y - .15);
    vec3 face = mix(PANEL, GHOST, slot * .8);
    float led = step(abs(u.x - .2), .03) * step(abs(fract(u.y / .2) - .5), .15) * step(.2, u.y) * step(u.y, vFS.y - .15);
    float on = step(.45, hash(vec3(un, floor(vO.z * 2.), floor(vO.x) + floor(uT * .7 + hash(vec3(un, 1., floor(vO.z * 2.))) * 3.))));
    shade = mix(face * mix(.5, 1., lit), mix(LINE, INK2, on), led * step(.5, top < .5 ? 1. : 0.));
  } else if (k > 8.5 && k < 9.5) {                                    // a hall wall: a band of cells near the top, like the made moon's halls
    float wall = 1. - top;
    float bandY = step(vFS.y - 2.6, m.y) * step(m.y, vFS.y - 1.4) * wall;
    float ck = mod(floor(m.x / CELL) + floor(m.y / CELL), 2.);
    shade = mix(shade, mix(GHOST, INK2, ck) * mix(.55, 1., lit), bandY);
  } else if (k > 9.5 && k < 10.5) {                                   // the spark's haze: concentric rings in the four accents, dithered
    vec2 q = (vUV - .5) * 2.; float r = length(q);
    if (r > 1.) discard;
    float ring = floor(r * 7.); float dens = (1. - r) * .55;
    if (bayer(gl_FragCoord.xy / 3.) > dens) discard;
    vec3 c4 = mod(ring, 4.) < .5 ? vec3(.29,.36,1.) : mod(ring, 4.) < 1.5 ? vec3(1.,.35,.24) : mod(ring, 4.) < 2.5 ? vec3(.71,.94,0.) : vec3(1.,.77,0.);
    shade = mix(c4, INK, step(r, .16)); edge = 0.;
  } else if (k > 10.5) {                                              // the lens streak: one row of cells, thinning out
    float x = abs(vUV.x - .5) * 2.;
    if (bayer(gl_FragCoord.xy / 3.) > (1. - x) * (1. - x)) discard;
    shade = mix(uAcc, INK, step(x, .1)); edge = 0.;
  }
  if ((k < 2.5 && k != 2.) || (k > 8.5 && k < 9.5)) shade = mix(shade, INK * .85, edge * .55);
  shade = mix(shade, uAcc, min(1., band));                            // the front band
  float dist = length(vW - uE);
  shade = mix(shade, uGround, smoothstep(uFog * .35, uFog, dist));
  gl_FragColor = vec4(shade, 1.);
}`;
const FVS = `attribute vec2 aP;` + PROJ + ` varying vec3 vW; void main(){ vW = vec3(aP.x, 0., aP.y); gl_Position = proj(vW); }`;
const FFS = `
#extension GL_OES_standard_derivatives : enable
precision highp float; varying vec3 vW; uniform vec3 uE, uGround, uLineC; uniform float uFog;
void main(){
  vec2 g = vW.xz / 2., d = abs(fract(g + .5) - .5);
  vec2 w = fwidth(g) * .9; float arm = .09;
  float plus = max(step(d.x, w.x) * step(d.y, arm), step(d.y, w.y) * step(d.x, arm));
  float dist = length(vW - uE);
  gl_FragColor = vec4(mix(uGround, uLineC, plus * (1. - smoothstep(uFog * .3, uFog * .9, dist))), 1.);
}`;
gl.getExtension('OES_standard_derivatives');
function prog(vs, fs) {
  const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
  return { p, u };
}
const SP = prog(VS, FS), FP = prog(FVS, FFS);
const vbo = gl.createBuffer(), fb = gl.createBuffer(), tex = gl.createTexture();
gl.bindBuffer(gl.ARRAY_BUFFER, fb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-500, -200, 500, -200, 500, 700, -500, -200, 500, 700, -500, 700]), gl.STATIC_DRAW);
let nV = 0, onReady = null;
function upload() {
  buildAtlas(); world();
  gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atl);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(V), gl.STATIC_DRAW); nV = V.length / 21; V.length = 0;
  if (onReady) onReady();
}
(document.fonts ? Promise.all([document.fonts.load("800 64px 'Tektur'"), document.fonts.load("700 32px 'M PLUS 1 Code'"), document.fonts.load("400 32px 'Dela Gothic One'", 'タグ書出し読込み構築骨街灯舞筋学研究室')]).catch(() => {}) : Promise.resolve()).then(upload);

const uni = (U, cam, o) => { gl.uniform3fv(U.uE, cam.E); gl.uniform3fv(U.uR, cam.r); gl.uniform3fv(U.uU, cam.u); gl.uniform3fv(U.uF, cam.f);
  gl.uniform2f(U.uC, cam.cx - o.W / 2, cam.cy - o.H / 2); gl.uniform2f(U.uHalf, o.W / 2, o.H / 2); gl.uniform1f(U.uFoc, cam.F);
  gl.uniform3fv(U.uGround, o.ground); gl.uniform1f(U.uFog, o.fog); };
const ATTS = [['aP', 3, 0], ['aN', 3, 3], ['aC', 3, 6], ['aUV', 2, 9], ['aFS', 2, 11], ['aK', 1, 13], ['aR', 3, 14], ['aRect', 4, 17]];
return {
  set ready(f) { onReady = f; },
  /* cam: the walkway's camera ({ E, r, u, f, F, cx, cy }); o: { W, H, time, acc, ground, line, ahead, fog } */
  draw(cam, o) {
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND);
    gl.useProgram(FP.p); uni(FP.u, cam, o); gl.uniform3fv(FP.u.uLineC, o.line);
    gl.bindBuffer(gl.ARRAY_BUFFER, fb); const fa = gl.getAttribLocation(FP.p, 'aP'); gl.enableVertexAttribArray(fa); gl.vertexAttribPointer(fa, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6); gl.disableVertexAttribArray(fa);
    if (nV) {
      gl.useProgram(SP.p); uni(SP.u, cam, o);
      gl.uniform3fv(SP.u.uAcc, o.acc); gl.uniform3fv(SP.u.uL, unit([-.45, .78, -.42])); gl.uniform1f(SP.u.uCamZ, cam.E[2]); gl.uniform1f(SP.u.uT, o.time);
      gl.uniform1f(SP.u.uAhead, o.ahead); gl.uniform1f(SP.u.uBehind, 18);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(SP.u.uTex, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      const A = ATTS.map(([n, s, off]) => { const l = gl.getAttribLocation(SP.p, n); if (l < 0) return -1; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, s, gl.FLOAT, false, 84, off * 4); return l; });
      gl.drawArrays(gl.TRIANGLES, 0, nV);
      A.forEach(l => { if (l >= 0) gl.disableVertexAttribArray(l); });
    }
    gl.disable(gl.DEPTH_TEST);
  }
};
};
})();
