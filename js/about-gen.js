/* About · the path: everything that does not need the graphics card (the planet grid, the builders, the five planets,
   the camera's authored shots). Loaded on the page as a classic script (self.GEN) and, to build the planets without
   freezing the page, as a Web Worker (the handler at the end). See js/about-planets.js. */
self.GEN = (() => {
'use strict';
/* ================= the planet grid =================
   An equi-angular cube sphere. Each face has a dominant axis D and two tangent axes U, V; a point's grid coordinates are
   i = atan(p.U / p.D) * R, j = atan(p.V / p.D) * R, k = |p| - R (in cells). Lines of constant i or j are great circles, so
   everything authored on (face, i, j, k) has planar walls and sits exactly on the cell grid the shader draws. */
const R = 200, CELL = 1, SUB = 4, IMAX = R * Math.PI / 4, MACRO = 4;
const FACES = [
  { D: [1, 0, 0], U: [0, 0, -1], V: [0, 1, 0] }, { D: [-1, 0, 0], U: [0, 0, 1], V: [0, 1, 0] },
  { D: [0, 1, 0], U: [1, 0, 0], V: [0, 0, -1] }, { D: [0, -1, 0], U: [1, 0, 0], V: [0, 0, 1] },
  { D: [0, 0, 1], U: [1, 0, 0], V: [0, 1, 0] }, { D: [0, 0, -1], U: [-1, 0, 0], V: [0, 1, 0] }];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]), unit = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function gdir(f, i, j) { const F = FACES[f], ta = Math.tan(i * CELL / R), tb = Math.tan(j * CELL / R); return unit(add(F.D, add(mul(F.U, ta), mul(F.V, tb)))); }
const gp = (f, i, j, k) => mul(gdir(f, i, j), R + k * CELL);
function slerp(a, b, t) { const d = Math.min(1, Math.max(-1, dot(a, b))), w = Math.acos(d); if (w < 1e-5) return a; const s = Math.sin(w); return add(mul(a, Math.sin((1 - t) * w) / s), mul(b, Math.sin(t * w) / s)); }
const angTo = (d, e) => Math.acos(Math.min(1, Math.max(-1, dot(d, e))));

/* ================= palette ================= */
const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const COL = { light: hex('#C9CDD6'), mid: hex('#5A606C'), dark: hex('#2F333C'), bone: hex('#E7E7E2'), slate: hex('#3A3F4A'), steel: hex('#8A909C'), ink: hex('#E9EBF0'), deep: hex('#22252C') };
const FRONTS = [['blue', '#4A5BFF'], ['red', '#FF5A3D'], ['lime', '#B4F000'], ['yellow', '#FFC400']];
const K_SOLID = 0, K_GROUND = 1, K_LAMP = 2, K_WIN = 3;

/* ================= the builder ================= */
class Geo {
  /* indexed and compact: position f32 x3, normal + seed i8 x4, colour + kind u8 x4, front offset f32; 4 vertices a quad */
  constructor(cap = 1 << 16) { this.vc = 0; this.ic = 0; this.P = new Float32Array(cap * 3); this.N = new Int8Array(cap * 4); this.C = new Uint8Array(cap * 4); this.O = new Float32Array(cap); this.I = new Uint32Array(cap * 2); }
  grow(nv, ni) {
    if (this.vc + nv > this.O.length) { const n = this.O.length * 2, g = (A, k) => { const B = new A.constructor(n * k); B.set(A); return B; }; this.P = g(this.P, 3); this.N = g(this.N, 4); this.C = g(this.C, 4); this.O = g(this.O, 1); }
    if (this.ic + ni > this.I.length) { const B = new Uint32Array(this.I.length * 2); B.set(this.I); this.I = B; }
  }
  v(p, n, col, kind, seed) {
    const i = this.vc++, i3 = i * 3, i4 = i * 4;
    this.P[i3] = p[0]; this.P[i3 + 1] = p[1]; this.P[i3 + 2] = p[2];
    this.N[i4] = Math.round(n[0] * 127); this.N[i4 + 1] = Math.round(n[1] * 127); this.N[i4 + 2] = Math.round(n[2] * 127); this.N[i4 + 3] = Math.round(seed * 254 - 127);
    this.C[i4] = Math.round(col[0] * 255); this.C[i4 + 1] = Math.round(col[1] * 255); this.C[i4 + 2] = Math.round(col[2] * 255); this.C[i4 + 3] = kind;
    this.O[i] = VOFF; return i;
  }
  tri(a, b, c, n, col, kind, seed) { this.grow(3, 3); const i0 = this.v(a, n, col, kind, seed), i1 = this.v(b, n, col, kind, seed), i2 = this.v(c, n, col, kind, seed); this.I[this.ic++] = i0; this.I[this.ic++] = i1; this.I[this.ic++] = i2; }
  quad(a, b, c, d, col, kind, seed, ref, out = true) {
    let n = unit(cross(sub(b, a), sub(d, a)));
    if (ref) { const m = mul(add(add(a, b), add(c, d)), .25); if ((dot(n, sub(m, ref)) < 0) === out) { n = mul(n, -1); const t = b; b = d; d = t; } }
    this.grow(4, 6);
    const i0 = this.v(a, n, col, kind, seed), i1 = this.v(b, n, col, kind, seed), i2 = this.v(c, n, col, kind, seed), i3 = this.v(d, n, col, kind, seed), I = this.I;
    I[this.ic++] = i0; I[this.ic++] = i1; I[this.ic++] = i2; I[this.ic++] = i0; I[this.ic++] = i2; I[this.ic++] = i3;
  }
  triOut(a, b, c, col, kind, seed, ref) {
    let n = unit(cross(sub(b, a), sub(c, a))); const m = mul(add(add(a, b), c), 1 / 3);
    if (dot(n, sub(m, ref)) < 0) { n = mul(n, -1); const t = b; b = c; c = t; }
    this.tri(a, b, c, n, col, kind, seed);
  }
  get tris() { return this.ic / 3; }
  out(chunked) {
    const o = { P: this.P.slice(0, this.vc * 3), N: this.N.slice(0, this.vc * 4), C: this.C.slice(0, this.vc * 4), O: this.O.slice(0, this.vc) };
    if (!chunked) { o.I = this.I.slice(0, this.ic); o.CH = new Float32Array(0); return o; }
    /* 6 cube faces x 4 x 4; per chunk: first index, index count, centre direction, cos of its angular radius, max radius, AABB */
    const NB = 4, NC = 6 * NB * NB, nt = this.ic / 3, I = this.I, P = this.P, id = new Uint16Array(nt), cnt = new Uint32Array(NC);
    for (let t = 0; t < nt; t++) {
      const v = I[t * 3] * 3, x = P[v], y = P[v + 1], z = P[v + 2], ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
      let fc, u, w; if (ax >= ay && ax >= az) { fc = x > 0 ? 0 : 1; u = y / ax; w = z / ax; } else if (ay >= az) { fc = y > 0 ? 2 : 3; u = x / ay; w = z / ay; } else { fc = z > 0 ? 4 : 5; u = x / az; w = y / az; }
      const c = fc * NB * NB + Math.min(NB - 1, (u + 1) / 2 * NB | 0) * NB + Math.min(NB - 1, (w + 1) / 2 * NB | 0); id[t] = c; cnt[c]++;
    }
    const st = new Uint32Array(NC); for (let c = 1; c < NC; c++) st[c] = st[c - 1] + cnt[c - 1];
    const J = new Uint32Array(this.ic), fill = st.slice(), cx = new Float64Array(NC * 3), bb = new Float64Array(NC * 6), mx = new Float64Array(NC);
    for (let c = 0; c < NC; c++) { bb[c * 6] = bb[c * 6 + 1] = bb[c * 6 + 2] = 1e9; bb[c * 6 + 3] = bb[c * 6 + 4] = bb[c * 6 + 5] = -1e9; }
    for (let t = 0; t < nt; t++) { const c = id[t], d = fill[c]++ * 3;
      for (let q = 0; q < 3; q++) { const vi = I[t * 3 + q]; J[d + q] = vi; const x = P[vi * 3], y = P[vi * 3 + 1], z = P[vi * 3 + 2], L = Math.hypot(x, y, z) || 1;
        cx[c * 3] += x / L; cx[c * 3 + 1] += y / L; cx[c * 3 + 2] += z / L; if (L > mx[c]) mx[c] = L;
        bb[c * 6] = Math.min(bb[c * 6], x); bb[c * 6 + 1] = Math.min(bb[c * 6 + 1], y); bb[c * 6 + 2] = Math.min(bb[c * 6 + 2], z);
        bb[c * 6 + 3] = Math.max(bb[c * 6 + 3], x); bb[c * 6 + 4] = Math.max(bb[c * 6 + 4], y); bb[c * 6 + 5] = Math.max(bb[c * 6 + 5], z); } }
    const list = []; for (let c = 0; c < NC; c++) if (cnt[c]) list.push(c);
    const CH = new Float32Array(list.length * 13);
    list.forEach((c, n) => { const L = Math.hypot(cx[c * 3], cx[c * 3 + 1], cx[c * 3 + 2]) || 1, d = [cx[c * 3] / L, cx[c * 3 + 1] / L, cx[c * 3 + 2] / L];
      let mn = 1; for (let i = st[c] * 3; i < (st[c] + cnt[c]) * 3; i++) { const vi = J[i] * 3, x = P[vi], y = P[vi + 1], z = P[vi + 2], Lv = Math.hypot(x, y, z) || 1; mn = Math.min(mn, (x * d[0] + y * d[1] + z * d[2]) / Lv); }
      CH.set([st[c] * 3, cnt[c] * 3, d[0], d[1], d[2], mn, mx[c], bb[c * 6], bb[c * 6 + 1], bb[c * 6 + 2], bb[c * 6 + 3], bb[c * 6 + 4], bb[c * 6 + 5]], n * 13); });
    o.I = J; o.CH = CH; return o;
  }
}
let G = null, KB = 0, VOFF = 0, JIT = 0;                                             // the geometry being built; KB: base height everything is lifted by
/* a grid box on face f: i, j, k ranges in cells. Tops and wide walls are split every SUB cells so they follow the curve. */
function gbox(f, i0, i1, j0, j1, k0, k1, col, kind = K_SOLID, o = {}) {
  if (i1 - i0 < .05 || j1 - j0 < .05 || k1 - k0 < .02) return;
  /* every box a hair bigger by its own amount, so no two faces ever share a plane (no z-fighting where boxes meet) */
  JIT = (JIT + .6180339887) % 1; const ej = .004 + .014 * JIT; i0 -= ej; i1 += ej; j0 -= ej; j1 += ej; k0 -= ej; k1 += ej;
  k0 += KB; k1 += KB;
  const si = Math.max(1, Math.ceil((i1 - i0) / SUB)), sj = Math.max(1, Math.ceil((j1 - j0) / SUB)), seed = o.seed || 0;
  const I = t => i0 + (i1 - i0) * t / si, J = t => j0 + (j1 - j0) * t / sj, ctr = gp(f, (i0 + i1) / 2, (j0 + j1) / 2, (k0 + k1) / 2), O = [0, 0, 0];
  if (o.top !== false) for (let a = 0; a < si; a++) for (let b = 0; b < sj; b++)
    G.quad(gp(f, I(a), J(b), k1), gp(f, I(a + 1), J(b), k1), gp(f, I(a + 1), J(b + 1), k1), gp(f, I(a), J(b + 1), k1), col, kind, seed, O, true);
  if (o.bottom || k0 > .2) for (let a = 0; a < si; a++) for (let b = 0; b < sj; b++)
    G.quad(gp(f, I(a), J(b), k0), gp(f, I(a + 1), J(b), k0), gp(f, I(a + 1), J(b + 1), k0), gp(f, I(a), J(b + 1), k0), col, kind, seed, O, false);
  for (let b = 0; b < sj; b++) for (const i of [i0, i1]) G.quad(gp(f, i, J(b), k0), gp(f, i, J(b + 1), k0), gp(f, i, J(b + 1), k1), gp(f, i, J(b), k1), col, kind, seed, ctr, true);
  for (let a = 0; a < si; a++) for (const j of [j0, j1]) G.quad(gp(f, I(a), j, k0), gp(f, I(a + 1), j, k0), gp(f, I(a + 1), j, k1), gp(f, I(a), j, k1), col, kind, seed, ctr, true);
}
/* a box with one-cell notches cut out of its four vertical corners (three boxes, no overlapping tops) */
function nbox(f, i0, i1, j0, j1, k0, k1, col, kind = K_SOLID, n = 1) {
  if (n <= 0 || i1 - i0 < 2 * n + 1.5 || j1 - j0 < 2 * n + 1.5) return gbox(f, i0, i1, j0, j1, k0, k1, col, kind);
  gbox(f, i0 + n, i1 - n, j0, j1, k0, k1, col, kind); gbox(f, i0, i0 + n, j0 + n, j1 - n, k0, k1, col, kind); gbox(f, i1 - n, i1, j0 + n, j1 - n, k0, k1, col, kind);
}
/* local frames for anything that is not on the grid */
function frame(f, i, j, k = 0) {
  k += KB; const o = gp(f, i, j, k), up = gdir(f, i, j), e = unit(sub(gp(f, i + .5, j, k), gp(f, i - .5, j, k))), n = unit(cross(e, up));
  return { o, up, e, n, L: ([x, y, z]) => add(o, add(add(mul(e, x), mul(up, y)), mul(n, z))) };
}
function obox(C, X, Y, Z, h, col, kind = K_SOLID) {
  const P = (a, b, c) => add(C, add(add(mul(X, a * h[0]), mul(Y, b * h[1])), mul(Z, c * h[2])));
  [[[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]], [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]],
   [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]]
    .forEach(q => G.quad(...q.map(v => P(...v)), col, kind, 0, C, true));
}
const lbox = (fr, c, s, col, kind) => obox(fr.L(c), fr.e, fr.up, fr.n, mul(s, .5), col, kind);
function beam(fr, a, b, t, col, kind = K_SOLID) {
  const A = fr.L(a), B = fr.L(b), Z = unit(sub(B, A)), X = unit(Math.abs(dot(Z, fr.up)) > .95 ? cross(fr.e, Z) : cross(fr.up, Z)), Y = cross(Z, X);
  obox(mul(add(A, B), .5), X, Y, Z, [t / 2, t / 2, len(sub(B, A)) / 2], col, kind);
}
function cyl(fr, x, z, r, y0, y1, col, n = 12, kind = K_SOLID) {
  const ctr = fr.L([x, (y0 + y1) / 2, z]), top = fr.L([x, y1, z]);
  for (let s = 0; s < n; s++) {
    const a0 = s / n * Math.PI * 2, a1 = (s + 1) / n * Math.PI * 2, P = (a, y) => fr.L([x + Math.cos(a) * r, y, z + Math.sin(a) * r]);
    G.quad(P(a0, y0), P(a1, y0), P(a1, y1), P(a0, y1), col, kind, 0, ctr, true);
    G.triOut(P(a0, y1), P(a1, y1), top, col, kind, 0, fr.L([x, y1 - 1, z]));
  }
}
function tank(fr, x, z, r, h, col) {                               // a cylinder with a stepped cap and two dark hoops
  cyl(fr, x, z, r, -1, h, col, 14);
  cyl(fr, x, z, r * .78, h, h + r * .28, col, 14); cyl(fr, x, z, r * .5, h + r * .28, h + r * .5, col, 14);
  cyl(fr, x, z, r * 1.05, h * .3, h * .3 + .5, COL.dark, 14); cyl(fr, x, z, r * 1.05, h * .7, h * .7 + .5, COL.dark, 14);
}
function lamp(f, side, w, a, k, s = .5) {                         // a small light on a grid wall
  k += KB; const e = .03, out = side[1] === '+' ? 1 : -1, q = side[0] === 'i' ? (u, v) => gp(f, w + out * e, u, v) : (u, v) => gp(f, u, w + out * e, v);
  const ref = side[0] === 'i' ? gp(f, w - out * 5, a, k) : gp(f, a, w - out * 5, k);
  G.quad(q(a, k), q(a + s, k), q(a + s, k + s), q(a, k + s), COL.ink, K_LAMP, r(), ref, true);
}
function topLamp(f, i, j, k, s = .6) { k += KB; G.quad(gp(f, i, j, k + .02), gp(f, i + s, j, k + .02), gp(f, i + s, j + s, k + .02), gp(f, i, j + s, k + .02), COL.ink, K_LAMP, r(), [0, 0, 0], true); }

/* ================= seeded random and noise ================= */
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const h3 = (x, y, z) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(p, s) {
  const q = mul(p, s), b = q.map(Math.floor), f = q.map((v, i) => { const t = v - b[i]; return t * t * (3 - 2 * t); });
  let r = 0; for (let c = 0; c < 8; c++) { const o = [c & 1, c >> 1 & 1, c >> 2 & 1], w = o.reduce((a, oo, i) => a * (oo ? f[i] : 1 - f[i]), 1); r += w * h3(b[0] + o[0], b[1] + o[1], b[2] + o[2]); }
  return r;
}

/* ================= the building kit: depth, not just stacked cubes =================
   A building rises from a dark plinth in levels. Each level is a run of storeys (windowed walls) separated by recessed slots
   one cell high, its corners notched by a cell, and capped by a ledge that overhangs by 0.3; the next level steps in.
   Fins stand off the walls, pipes run down them, and the roof carries a parapet and plant. Detail falls off with distance
   from what the cameras see (lod: 2 full, 1 simple, 0 a block). */
let r = Math.random;
function roof(f, a0, a1, b0, b1, k, lod) {
  if (a1 - a0 < 2.2 || b1 - b0 < 2.2) return;
  const p = .3, h = .7;
  gbox(f, a0, a1, b0, b0 + p, k, k + h, COL.mid); gbox(f, a0, a1, b1 - p, b1, k, k + h, COL.mid);
  gbox(f, a0, a0 + p, b0 + p, b1 - p, k, k + h, COL.mid); gbox(f, a1 - p, a1, b0 + p, b1 - p, k, k + h, COL.mid);
  if (lod >= 1 && !FAR) roofProps(f, a0, a1, b0, b1, k, lod);
  if (lod < 2) return;
  const n = 1 + (r() * 3 | 0);
  for (let m = 0; m < n; m++) {
    const w = 1 + r() * Math.min(3, (a1 - a0) * .35), d = 1 + r() * Math.min(3, (b1 - b0) * .35), x = a0 + .6 + r() * Math.max(0, a1 - a0 - w - 1.2), y = b0 + .6 + r() * Math.max(0, b1 - b0 - d - 1.2);
    const kind = r();
    if (kind < .45) { gbox(f, x, x + w, y, y + d, k, k + 1 + (r() * 2 | 0), [COL.dark, COL.steel, COL.bone][r() * 3 | 0]); if (r() < .5) gbox(f, x + .2, x + w - .2, y + .2, y + d - .2, k + 1, k + 1.4, COL.mid); }
    else if (kind < .7) { const fr = frame(f, x + w / 2, y + d / 2, k); cyl(fr, 0, 0, Math.min(w, d) * .42, 0, 1.2 + r() * 1.5, COL.bone, 10); }
    else if (kind < .85) { for (let v = 0; v < 3; v++) gbox(f, x + v * .7, x + v * .7 + .4, y, y + d, k, k + .6, COL.dark); }
    else { const mh = 3 + r() * 6; gbox(f, x, x + .25, y, y + .25, k, k + mh, COL.bone); gbox(f, x - .5, x + .75, y + .05, y + .2, k + mh * .7, k + mh * .7 + .15, COL.bone); topLamp(f, x - .05, y - .05, k + mh, .35); }
  }
}
function fins(f, a0, a1, b0, b1, k0, k1, sides, col) {           // vertical fins standing off chosen walls
  const step = 1.5 + (r() * 2 | 0) * .5, t = .3, o = .45;
  for (const s of sides) {
    if (s === 'j-' || s === 'j+') { const j = s === 'j-' ? b0 : b1, out = s === 'j-' ? -1 : 1; for (let x = a0 + 1; x < a1 - .8; x += step) gbox(f, x, x + t, Math.min(j, j + out * o), Math.max(j, j + out * o), k0, k1, col); }
    else { const i = s === 'i-' ? a0 : a1, out = s === 'i-' ? -1 : 1; for (let y = b0 + 1; y < b1 - .8; y += step) gbox(f, Math.min(i, i + out * o), Math.max(i, i + out * o), y, y + t, k0, k1, col); }
  }
}
function building(f, i0, i1, j0, j1, H, col, lod, o = {}) {
  if (lod <= 0) { gbox(f, i0, i1, j0, j1, -1.5, Math.max(1, Math.round(H * .6)), col); return H; }
  gbox(f, i0 - .3, i1 + .3, j0 - .3, j1 + .3, -1.5, 1, COL.dark);
  let k = 1, a0 = i0, a1 = i1, b0 = j0, b1 = j1;
  const nL = o.levels || (H > 14 ? 3 : H > 7 ? 2 : 1), notch = o.notch ?? (i1 - i0 >= 5 && j1 - j0 >= 5 ? 1 : 0);
  let rem = Math.max(2, H - 1);
  for (let l = 0; l < nL && rem > 1.5; l++) {
    const h = l === nL - 1 ? rem : Math.max(3, Math.round(rem * (.5 + r() * .2)));
    rem -= h;
    const sp = o.storey || (3 + (r() * 2 | 0));
    let y = 0;
    while (y < h - .01) {
      const seg = Math.min(sp, h - y);
      nbox(f, a0, a1, b0, b1, k + y, k + y + seg, col, lod > 1 ? K_WIN : K_SOLID, notch);
      y += seg;
      if (y < h - 1.2 && lod > 1) { nbox(f, a0 + .35, a1 - .35, b0 + .35, b1 - .35, k + y, k + y + 1, COL.deep, K_SOLID, notch); y += 1; }
    }
    if (lod > 1 && o.fins !== false && h > 5 && r() < (o.finP ?? .45)) fins(f, a0, a1, b0, b1, k + 1, k + h - .5, r() < .5 ? ['j-', 'i-'] : ['j-', 'i+'], COL.bone);
    if (lod > 1 && h > 6 && r() < .3) gbox(f, a1, a1 + .45, b0 + 1, b0 + 1.45, 0, k + h, COL.mid);            // a pipe down the wall
    k += h;
    if (l < nL - 1 || o.ledge) { gbox(f, a0 - .3, a1 + .3, b0 - .3, b1 + .3, k, k + .5, COL.bone); k += .5; }
    const ins = o.ins ?? (1 + (r() < .4 ? 1 : 0));
    if (l < nL - 1) { a0 += ins; a1 -= ins; b0 += ins; b1 -= ins; if (a1 - a0 < 2.5 || b1 - b0 < 2.5) break; }
  }
  if (o.roof !== false) roof(f, a0, a1, b0, b1, k, lod);
  if (lod >= 1) citySigns(f, i0, i1, j0, j1, k, a0, a1, b0, b1, notch);
  return k;
}

/* ================= sky lanes: straight runs over the streets, canyons and fin rows, at a height in cells ================= */
let LANES = [];
function lane(f, axis, c, a0, a1, k) {
  const A = axis === 'i' ? gp(f, a0, c, k) : gp(f, c, a0, k), B = axis === 'i' ? gp(f, a1, c, k) : gp(f, c, a1, k), m = unit(add(A, B));
  if (!seen(m) || angTo(m, DCTR) > .85 || angTo(m, HDIR) < .1) return;
  LANES.push([A, B, len(sub(B, A))]);
}
function lanesGrid(start, pitch, seg, k0, k1, p, along = ['i', 'j']) {
  eachFace(f => { for (let c = start; c < 157; c += pitch) for (let a = -150; a + seg <= 152; a += seg) for (const ax of along) if (r() < p) lane(f, ax, c, a, a + seg, k0 + r() * (k1 - k0)); });
}

/* ================= the planets ================= */
const HERO = { f: 4, i: 0, j: 0 }, HDIR = gdir(4, 0, 0);
let VIS = HDIR, DCTR = HDIR, LG = [];
const seen = d => dot(d, VIS) > -.12;
let LITE = false, FAR = false;                                                   // small screens: no full-detail districts, far fewer triangles
const lodOf = d => { if (FAR) return 0; const a = angTo(d, DCTR); return LITE ? (a < .55 ? 1 : 0) : (a < .64 ? 2 : a < 1.05 ? 1 : 0); };   // far: the planet seen from afar, blocks only
const PAINT = hex('#14161B');
let SLOT = {};
/* a sign on the hero's j- wall at jw, centred (ic, kc), width w; PAINT signs sit on a solid bone panel. The quad's texture
   coordinates are filled on the main thread from the atlas (item names). */
function plateJ(item, jw, ic, kc, w, col) {
  const f = HERO.f, S = SLOT[item] || { w: 2, h: 1 }, hgt = w * S.h / S.w;
  if (col === PAINT) { const m = Math.min(w, hgt) * .12; gbox(f, ic - w / 2 - m, ic + w / 2 + m, jw - .35, jw, kc - hgt / 2 - m, kc + hgt / 2 + m, COL.bone); }
  const j = col === PAINT ? jw - .43 : jw - .08, P = (i, k) => gp(f, i, j, k + KB);
  const a = P(ic - w / 2, kc - hgt / 2), b = P(ic + w / 2, kc - hgt / 2), c = P(ic + w / 2, kc + hgt / 2), d = P(ic - w / 2, kc + hgt / 2);
  LG.push({ item, pts: [a, b, c, d], col, n: unit(cross(sub(b, a), sub(d, a))) });
}

/* ================= props: small rooftop equipment, instanced (types: 0 AC unit, 1 water tank, 2 antenna, 3 duct, 4 dish) =================
   Their own random stream (rs): the buildings are unchanged. Kept clear of the parapet. */
let PROPS = [];
function prop(t, f, i, j, k, s = 1, rot = 0) {
  const o = gp(f, i, j, k + KB), up = gdir(f, i, j), e0 = unit(sub(gp(f, i + 1, j, k + KB), o)), n0 = cross(up, e0);
  const e = add(mul(e0, Math.cos(rot)), mul(n0, Math.sin(rot)));
  PROPS.push(t, o[0], o[1], o[2], up[0], up[1], up[2], e[0], e[1], e[2], s);
}
function roofProps(f, a0, a1, b0, b1, k, lod) {
  const W = a1 - a0, D = b1 - b0; if (W < 3 || D < 3) return;
  const n = Math.min(9, Math.round(W * D / (lod > 1 ? 7 : 14) * rs())), rot = (rs() * 4 | 0) * Math.PI / 2;
  for (let m = 0; m < n; m++) {
    const q = rs(), t = q < .5 ? 0 : q < .66 ? 3 : q < .8 ? 1 : q < .93 ? 2 : 4;
    const i = a0 + 1 + rs() * (W - 2), j = b0 + 1 + rs() * (D - 2);
    prop(t, f, i, j, k, t === 1 ? .8 + rs() * .5 : t === 2 ? .7 + rs() * .8 : .8 + rs() * .4, rot + (t === 4 ? rs() * 6 : 0));
  }
}

/* ================= Japanese signage: words drawn in the atlas, put up on the city's buildings =================
   Their own random stream (rs), so the buildings come out exactly as before. Item '@v<n>' / '@h<n>': word n, vertical or
   horizontal; the atlas draws each word in cells of WC px with WP px of padding, so the aspect is known here. */
const WORDS_C = ['営業中', '立入禁止', '非常口', '高圧注意', '出口', '駐車場', '東口', '喫茶', '電気', '薬', '湯', '安全第一', '整備中', '回送', 'リグ', '関節', 'ボーン', 'アニメ'];
const WORDS_P = [['研究棟', '図書館', '講義棟', '八王子', '学食', '実験室'], ['第二工場', '背景美術', '小道具', '組立', '出荷口', '資材置場'],
  ['回転台', '試写室', '模型', '撮影中', '第一棟', '音響'], ['撮影所', 'スタジオ', '照明', '美術部', '編集室', '本番中'], ['階段教室', '卒業制作', '学生寮', '作画', '巴里', '講評']];
const WORDS = [...WORDS_C, ...WORDS_P.flat()], WC = 80, WP = 16;
const wAsp = (n, v) => v ? (WC * n + WP) / (WC + WP) : (WC + WP) / (WC * n + WP);       // height / width of a word's slot
const SIGN = hex('#F3EEDF');
let rs = Math.random, PK = 0;
/* a text quad from grid corners (bottom-left, bottom-right, top-right, top-left as seen from outside); flipped if it faces in */
function signQ(f, item, A, B, C, D, outG, col, g) {
  const P = q => gp(f, q[0], q[1], q[2] + KB); let a = P(A), b = P(B), c = P(C), d = P(D);
  const o = sub(gp(f, outG[0] + A[0], outG[1] + A[1], A[2]), gp(f, A[0], A[1], A[2]));
  let n = unit(cross(sub(b, a), sub(d, a))); if (dot(n, o) < 0) { [a, b, c, d] = [b, a, d, c]; n = mul(n, -1); }
  LG.push({ item, pts: [a, b, c, d], col, n, g, city: 1 });
}
/* a wall of a box: u along it, d out from it; M maps (u, d, k) to the grid, O is the outward step, U the step along u */
const wallOf = (sd, I0, I1, J0, J1) => sd === 0 ? { u0: J0, u1: J1, M: (u, d, k) => [I1 + d, u, k], O: [1, 0, 0], U: [0, 1, 0] }
  : sd === 1 ? { u0: J0, u1: J1, M: (u, d, k) => [I0 - d, u, k], O: [-1, 0, 0], U: [0, 1, 0] }
  : sd === 2 ? { u0: I0, u1: I1, M: (u, d, k) => [u, J1 + d, k], O: [0, 1, 0], U: [1, 0, 0] } : { u0: I0, u1: I1, M: (u, d, k) => [u, J0 - d, k], O: [0, -1, 0], U: [1, 0, 0] };
const signWord = () => { const pw = WORDS_P[PK]; return rs() < .55 ? WORDS_C.length + PK * 6 + (rs() * pw.length | 0) : rs() * WORDS_C.length | 0; };
const signLook = () => { const x = rs(); return x < .55 ? [SIGN, 1, COL.deep] : x < .75 ? [SIGN, 2, COL.deep] : [PAINT, 0, COL.bone]; };   // lit white, lit accent, painted on bone
function wbox(f, W, uA, uB, dA, dB, kA, kB, col) { const p = W.M(uA, dA, 0), q = W.M(uB, dB, 0); gbox(f, Math.min(p[0], q[0]), Math.max(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[1], q[1]), kA, kB, col); }
/* a sign flat on a wall, centred at uc, bottom at kb; size is the width (vertical) or the height (horizontal). Returns its height or 0 */
function flatSign(f, W, uc, kb, size, vert, kMax, back = true, n = signWord(), lk = signLook()) {
  const L = WORDS[n].length; let tw = vert ? size : size / wAsp(L, 0), th = vert ? size * wAsp(L, 1) : size;
  const room = W.u1 - W.u0 - 1; if (tw > room) { th *= room / tw; tw = room; } if (kb + th > kMax || th < .8) return 0;
  const [col, g, bk] = back ? lk : [PAINT, 0, 0], d = back ? .26 : .05;
  uc = Math.max(W.u0 + .5 + tw / 2, Math.min(W.u1 - .5 - tw / 2, uc));
  if (back) wbox(f, W, uc - tw / 2 - .25, uc + tw / 2 + .25, 0, .22, kb - .22, kb + th + .22, bk);
  signQ(f, (vert ? '@v' : '@h') + n, W.M(uc - tw / 2, d, kb), W.M(uc + tw / 2, d, kb), W.M(uc + tw / 2, d, kb + th), W.M(uc - tw / 2, d, kb + th), W.O, col, g);
  return th;
}
/* a blade sign standing out from a wall at uc, lettered on both faces */
function bladeSign(f, W, uc, kb, tw, kMax) {
  const n = signWord(), [col, g, bk] = signLook(), th = tw * wAsp(WORDS[n].length, 1), bh = th + .45; if (kb + bh > kMax) return;
  wbox(f, W, uc - .2, uc + .2, 0, tw + .7, kb, kb + bh, bk); wbox(f, W, uc - .08, uc + .08, 0, .45, kb - .6, kb, COL.mid);
  const bl = (u, out) => signQ(f, '@v' + n, W.M(u, .35, kb + .22), W.M(u, .35 + tw, kb + .22), W.M(u, .35 + tw, kb + .22 + th), W.M(u, .35, kb + .22 + th), out, col, g);
  bl(uc + .22, W.U); bl(uc - .22, W.U.map(x => -x));
}
function citySigns(f, i0, i1, j0, j1, top, a0, a1, b0, b1, notch) {
  if (f === HERO.f && Math.abs((i0 + i1) / 2 - HERO.i) < 23 && Math.abs((j0 + j1) / 2 - HERO.j) < 23) return;   // the hero's own plates stay alone
  if (rs() < .85 && top > 7) {                                     // 1. a blade at a corner of the base
    const W = wallOf(rs() * 4 | 0, i0, i1, j0, j1), inset = 1.4 + notch;
    if (W.u1 - W.u0 > 2 * inset) bladeSign(f, W, rs() < .5 ? W.u0 + inset : W.u1 - inset, 2.5 + rs() * Math.max(0, top * .4), 3.2, top - 1);
  }
  if (rs() < .5 && top > 12) {                                    // 2. a vertical banner flat on the wall
    const W = wallOf(rs() * 4 | 0, i0, i1, j0, j1); flatSign(f, W, W.u0 + rs() * (W.u1 - W.u0), 3 + rs() * top * .3, 3.6, true, top - 1);
  }
  if (rs() < .55 && top > 6) {                                     // 3. a horizontal sign along the top of the upper wall
    const W = wallOf(rs() * 4 | 0, a0, a1, b0, b1), th = Math.min(3, top * .22); flatSign(f, W, (W.u0 + W.u1) / 2, top - th - .8, th, false, top);
  }
}

/* a district: blocks of lots filled with kit buildings, B's city */
function district(f, i0, i1, j0, j1, hs, P = 14, BS = 12, skip = () => false, pal = [COL.light, COL.steel, COL.bone, COL.mid]) {
  for (let bi = i0; bi + BS <= i1; bi += P) for (let bj = j0; bj + BS <= j1; bj += P) {
    const ci = bi + BS / 2, cj = bj + BS / 2, d = gdir(f, ci, cj);
    if (!seen(d) || skip(f, ci, cj, d)) continue;
    const lod = lodOf(d), g = Math.max(.15, 1 - angTo(d, HDIR) / 1.2) * hs;
    if (lod === 0) { if (r() < .8) gbox(f, bi + 1, bi + BS - 1, bj + 1, bj + BS - 1, -1, 1 + (r() * 3 * g | 0), r() < .5 ? COL.dark : COL.mid); continue; }
    const lots = r() < .45 ? [[0, 0, 6, 12], [6, 0, 12, 12]] : r() < .6 ? [[0, 0, 12, 6], [0, 6, 6, 12], [6, 6, 12, 12]] : r() < .5 ? [[0, 0, 6, 6], [6, 0, 12, 6], [0, 6, 6, 12], [6, 6, 12, 12]] : [[0, 0, 12, 12]];
    const tall = [];
    for (const [a0, b0, a1, b1] of lots) {
      const i0l = bi + a0 * BS / 12 + .5, i1l = bi + a1 * BS / 12 - .5, j0l = bj + b0 * BS / 12 + .5, j1l = bj + b1 * BS / 12 - .5, wi = i1l - i0l, wj = j1l - j0l, lc = [(i0l + i1l) / 2, (j0l + j1l) / 2];
      const roll = r();
      if (roll < .56) { const H = 3 + Math.round(r() * 16 * g); building(f, i0l, i1l, j0l, j1l, H, pal[r() * pal.length | 0], lod); if (H > 10) tall.push([lc, H, i0l, i1l, j0l, j1l]); }
      else if (roll < .68) {                                        // a tank pair on a pad
        gbox(f, i0l, i1l, j0l, j1l, -1, .4, COL.dark);
        const fr = frame(f, lc[0], lc[1]), rr = Math.min(wi, wj) * .22;
        tank(fr, -wi * .22, 0, rr, 3 + r() * 4, COL.bone); tank(fr, wi * .22, 0, rr * .9, 2.5 + r() * 4, COL.light);
        if (lod > 1) beam(fr, [-wi * .22, 2.2, 0], [wi * .22, 2.2, 0], .5, COL.mid);
      } else if (roll < .8) {                                       // a hall with a notched roof
        nbox(f, i0l, i1l, j0l, j1l, -1, 3, COL.slate, lod > 1 ? K_WIN : K_SOLID);
        for (let s = 0; s < 4; s++) { const a = i0l + s * wi / 4; gbox(f, a, a + wi / 8, j0l, j1l, 3, 4.2, COL.steel); }
      } else if (roll < .92) {                                      // a slab tower with fins
        const hh = 10 + Math.round(r() * 22 * g);
        building(f, lc[0] - 1.8, lc[0] + 1.8, j0l, j1l, hh, COL.light, lod, { levels: 1, notch: 0, finP: .9, storey: 4 });
        if (lod > 1) for (let w = 0; w < 3; w++) lamp(f, 'i-', lc[0] - 1.8, j0l + 1 + r() * (wj - 2), 2 + r() * (hh - 3), .5);
      } else {                                                      // a yard with crates
        gbox(f, i0l, i1l, j0l, j1l, -1, .3, COL.dark);
        if (lod > 1) for (let c = 0; c < 5; c++) { const x = i0l + 1 + r() * (wi - 3), y = j0l + 1 + r() * (wj - 3); gbox(f, x, x + 1, y, y + 1.5, .3, 1.3 + (r() < .3 ? 1 : 0), r() < .5 ? COL.bone : COL.mid); }
      }
    }
    if (lod > 1 && tall.length > 1 && r() < .6) {                  // a sky bridge between two towers of the block
      const [A, B] = tall, k = Math.min(A[1], B[1]) * (.4 + r() * .3), w = .9;
      const ia = Math.min(A[0][0], B[0][0]), ib = Math.max(A[0][0], B[0][0]), ja = Math.min(A[0][1], B[0][1]), jb = Math.max(A[0][1], B[0][1]);
      if (ib - ia > jb - ja) gbox(f, ia, ib, (ja + jb) / 2 - w, (ja + jb) / 2 + w, k, k + 1.2, COL.bone, K_WIN); else gbox(f, (ia + ib) / 2 - w, (ia + ib) / 2 + w, ja, jb, k, k + 1.2, COL.bone, K_WIN);
    }
    if (lod > 1 && r() < .35) gbox(f, bi - 1.3, bi - .7, bj, bj + BS, .4, 1, COL.bone);     // a pipe along the street
  }
}
/* the face cells of the seen hemisphere, for planets that cover everything */
function eachFace(fn) { for (let f = 0; f < 6; f++) fn(f); }
const nearHero = (rad) => (f, i, j, d) => angTo(d, HDIR) < rad;

const PLANETS = [
/* ---------- 01 · Monument (TUT) ---------- */
{ id: 'tut', name: 'Monument', num: '01', code: 'TUT-25', vk: '研究室', date: '2025.10 — · 01', title: 'TOKYO UNIVERSITY<br>OF TECHNOLOGY',
  cam: [-62, -132, 96], yaw: .2, aim: .42, far: [-26, -92], seed: 11,
  build() {
    /* the land: long field walls on great circles, buttressed, cut into segments */
    eachFace(f => { for (let L = -150; L <= 150; L += 36) for (const along of ['i', 'j']) for (let a = -156; a < 156; a += 12) {
      if (r() < .3) continue;
      const d = along === 'i' ? gdir(f, a + 6, L) : gdir(f, L, a + 6);
      if (!seen(d) || angTo(d, HDIR) < .22) continue;
      const lod = lodOf(d), hg = 2 + (r() < .25 ? 2 : 0);
      if (along === 'i') { gbox(f, a, a + 11, L - 1, L + 1, -1, hg, COL.dark); if (lod > 1) for (let b = a + 1; b < a + 11; b += 3) gbox(f, b, b + 1, L - 1.6, L + 1.6, -1, hg - .8, COL.slate); }
      else { gbox(f, L - 1, L + 1, a, a + 11, -1, hg, COL.dark); if (lod > 1) for (let b = a + 1; b < a + 11; b += 3) gbox(f, L - 1.6, L + 1.6, b, b + 1, -1, hg - .8, COL.slate); }
    } });
    /* settlements: low districts in some of the fields */
    eachFace(f => { for (let L1 = -150; L1 < 150; L1 += 36) for (let L2 = -150; L2 < 150; L2 += 36) {
      const d = gdir(f, L1 + 18, L2 + 18); if (!seen(d) || r() < .45 || angTo(d, HDIR) < .3) continue;
      district(f, L1 + 4, L1 + 34, L2 + 4, L2 + 34, .35, 10, 8, nearHero(.3));
    } });
    /* monuments: stepped mesas and slab monoliths */
    const placed = [];
    for (let n = 0; n < 500 && placed.length < 22; n++) {
      const f = [4, 4, 4, 2, 3, 0, 1][r() * 7 | 0], i = Math.round((r() * 2 - 1) * 140), j = Math.round((r() * 2 - 1) * 140), d = gdir(f, i, j);
      if (!seen(d) || angTo(d, HDIR) < .25 || placed.some(p => angTo(p, d) < .17)) continue;
      placed.push(d);
      const big = r(), w = 12 + Math.round(big * 20), lod = lodOf(d), col = [COL.light, COL.bone, COL.steel][r() * 3 | 0];
      if (r() < .3) { const tall = 16 + r() * 14; building(f, i - 2.5, i + 2.5, j - w / 2, j + w / 2, tall, col, lod, { levels: 1, notch: 0, finP: 1, storey: 5 }); topLamp(f, i - .3, j - .3, tall + 1); }
      else building(f, i - w / 2, i + w / 2, j - w * .4, j + w * .4, 8 + big * 18, col, lod, { levels: 3 + (r() * 2 | 0), storey: 4 });
    }
    lanesGrid(-144 + 3, 36, 48, 8, 16, .6); lane(4, 'j', -2, -72, -40, 3); lane(4, 'j', 2, -72, -40, 3);
    /* the hero: a colossal stepped ziggurat between two monolith slabs, a ring of pylons, an avenue toward the camera */
    const f = 4;
    gbox(f, -36, 36, -36, 36, -1.5, 1, COL.dark);
    const top = building(f, -26, 26, -26, 26, 42, COL.light, 2, { levels: 7, storey: 3, notch: 2, ledge: true, finP: .6, ins: 3 });
    building(f, -30, -25, -6, 16, 40, COL.bone, 2, { levels: 1, notch: 0, finP: 1, storey: 5 }); building(f, 25, 30, -12, 10, 34, COL.bone, 2, { levels: 1, notch: 0, finP: 1, storey: 5 });
    topLamp(f, -27.8, 4, 41.2); topLamp(f, 27.2, -1, 35.2);
    for (let a = 0; a < 12; a++) { const t = a / 12 * Math.PI * 2, pi = Math.cos(t) * 33, pj = Math.sin(t) * 33; gbox(f, pi - 1, pi + 1, pj - 1, pj + 1, 0, 9 + (a % 3) * 3, COL.bone); topLamp(f, pi - .3, pj - .3, 9 + (a % 3) * 3); }
    gbox(f, -4, 4, -70, -36, -1, .3, COL.slate); for (let y = -68; y < -37; y += 5) { gbox(f, -5.5, -5, y, y + .5, 0, 3, COL.bone); gbox(f, 5, 5.5, y, y + .5, 0, 3, COL.bone); }
    plateJ('code', -26, 7, 3.4, 6, PAINT); plateJ('vk', -6, -27.5, 28, 2.8, PAINT);
    return top;
  },
  /* the fly-by: the orbital ring, which the camera dives through */
  orbital() {
    const ax = unit([.32, .9, .28]), u0 = unit(cross(ax, [0, 0, 1])), v0 = cross(ax, u0), RR = R * 1.42, NS = 240;
    const seg = s => { const t = (s + .5) / NS * Math.PI * 2; return add(mul(u0, Math.cos(t)), mul(v0, Math.sin(t))); };
    let near = null, bd = 1e9; for (let s = 0; s < NS; s++) { const q = mul(seg(s), RR), d = pathDist(q); if (d < bd) { bd = d; near = q; } }
    VOFF = timedOff(near);
    for (let s = 0; s < NS; s++) {
      if (s % 37 === 5 || s % 37 === 6) continue;
      const dir = seg(s), tg = cross(ax, dir), notch = s % 8 === 0;
      obox(mul(dir, RR), dir, ax, tg, [notch ? 3.2 : 2, (notch ? 7 : 6) / 2, RR * Math.PI / NS * .96], notch ? COL.bone : COL.steel);
      if (s % 2 === 0) obox(mul(dir, RR + 2.1), dir, ax, tg, [.35, 1.2, RR * Math.PI / NS * .5], COL.dark);
    }
  } },
/* ---------- 02 · Industrial (Miraculous) ---------- */
{ id: 'mc', name: 'Industrial', num: '02', code: 'MC-23', vk: '書割りの街', date: '2023.09 — 2025.07 · 02', title: 'MIRACULOUS CORP',
  cam: [-62, -132, 96], yaw: .2, aim: .42, far: [-26, -92], seed: 23,
  /* the descent: down a column beside the elevator's tether, then away from it to the reading view */
  path: [[.3, -40, -150, 380], [.66, -40, -150, 160]],
  build() {
    eachFace(f => district(f, -154, 156, -154, 156, 1, 14, 12, nearHero(.2)));
    lanesGrid(-155, 14, 56, 9, 24, .55);
    const f = 4;
    gbox(f, -30, 30, -30, 30, -1.5, 1, COL.mid); gbox(f, -28, 28, -28, 28, -1.5, 3, COL.dark);
    const top = building(f, -15, 15, -15, 15, 46, COL.light, 2, { levels: 5, storey: 4, notch: 2, ledge: true, finP: .8 });
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b], n) => {            // cantilevered modules, windowed, with an underside
      const k0 = 12 + n * 6, L = 14, W = 4;
      if (a) nbox(f, a > 0 ? 12 : -12 - L, a > 0 ? 12 + L : -12, -W + n, W + n, k0, k0 + 6, COL.bone, K_WIN);
      else nbox(f, -W - n, W - n, b > 0 ? 12 : -12 - L, b > 0 ? 12 + L : -12, k0, k0 + 6, COL.bone, K_WIN);
    });
    const fr = frame(f, 0, 0);
    [[-21, -21], [21, 21], [21, -21]].forEach(([x, z], n) => { tank(fr, x, z, 4.2, 13 + n * 3, n === 1 ? COL.light : COL.bone); beam(fr, [x * .62, 9, z * .62], [x, 9, z], 1, COL.mid); beam(fr, [x * .62, 5, z * .62], [x, 5, z], .6, COL.steel); });
    beam(fr, [-27, 0, 20], [-27, 24, 20], 1.2, COL.steel); beam(fr, [-21, 0, 20], [-21, 24, 20], 1.2, COL.steel); beam(fr, [-27, 24, 20], [6, 24, 20], 1.6, COL.steel);
    for (let x = -26; x < 4; x += 3) beam(fr, [x, 24, 20], [x + 1.5, 21.5, 20], .3, COL.steel);
    gbox(f, -1, 1, 4, 6, top, top + 10, COL.bone); topLamp(f, -.3, 4.7, top + 10);
    plateJ('code', -15, 7, 6.5, 7, PAINT); plateJ('vk', -12, 7, 38, 3.2, PAINT);
    return top;
  },
  /* the fly-by: a space elevator beside the dive. A lattice tether rises from an anchor block to a counterweight station;
     it builds from the top down as the camera comes past */
  orbital() {
    /* the tether stands 18 cells from the descent column, 26 degrees to the right of the camera's heading */
    const [, cx, cz] = PL.path[0], hl = Math.hypot(cx, cz), hx = -cx / hl, hz = -cz / hl, ta = -.45, ox = hx * Math.cos(ta) - hz * Math.sin(ta), oz = hx * Math.sin(ta) + hz * Math.cos(ta);
    const ci = cx + ox * 18, cj = cz + oz * 18, fr = frame(4, ci, cj), H = 300, w = 1.6;
    let bk = 0, bd = 1e9; for (let y = 0; y < H; y += 10) { const d = pathDist(fr.L([0, y, 0])); if (d < bd) { bd = d; bk = y; } }
    const off0 = timedOff(fr.L([0, bk, 0]));
    VOFF = off0 - .1; building(4, ci - 7, ci + 7, cj - 7, cj + 7, 14, COL.steel, 2, { levels: 2, storey: 3, notch: 1, fins: false });
    for (let y = 12; y < H; y += 8) {
      VOFF = timedOff(fr.L([0, y + 4, 0]));
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b], n, A) => {
        beam(fr, [a * w, y, b * w], [a * w, y + 8, b * w], .45, COL.light);
        const [c, d] = A[(n + 1) % 4]; beam(fr, [a * w, y, b * w], [c * w, y + 8, d * w], .22, COL.steel);
      });
      if ((y / 8 | 0) % 4 === 0) lbox({ ...fr, L: p => fr.L(p) }, [0, y, 0], [w * 2 + 1.6, .8, w * 2 + 1.6], COL.bone);
    }
    VOFF = timedOff(fr.L([0, H, 0])) - .05;
    lbox(fr, [0, H + 4, 0], [16, 8, 16], COL.light); lbox(fr, [0, H + 9, 0], [9, 3, 9], COL.bone); lbox(fr, [0, H - 1, 0], [18, 2, 3], COL.steel); lbox(fr, [0, H - 1, 0], [3, 2, 18], COL.steel);
    [[-10, 0], [10, 0], [0, -10], [0, 10]].forEach(([x, z]) => lbox(fr, [x, H + 3, z], [5, 4, 5], COL.mid));
  } },
/* ---------- 03 · Shell (Zag) ---------- */
{ id: 'zag', name: 'Shell', num: '03', code: 'ZAG-23', vk: '回転台', date: '2023.01 — 2023.06 · 03', title: 'ZAG STUDIOS',
  cam: [-62, -132, 96], yaw: .2, aim: .42, far: [-26, -92], seed: 37,
  build() {
    const terr = d => { const v = vnoise(d, 3.2) * .7 + vnoise(d, 8) * .3; return Math.max(0, Math.floor((v - .48) * 9)); };
    eachFace(f => { for (let bi = -154; bi < 152; bi += 7) for (let bj = -154; bj < 152; bj += 7) {
      const ci = bi + 3, cj = bj + 3, d = gdir(f, ci, cj);
      if (!seen(d) || angTo(d, HDIR) < .22) continue;
      const lod = lodOf(d);
      const trench = (Math.abs(((bi + 157) % 63) - 3) < 4 && f !== 2) || (Math.abs(((bj + 157) % 84) - 3) < 4);
      if (trench) { if (r() < .55 && lod > 0) topLamp(f, ci, cj, -.98, .7); gbox(f, bi, bi + 6, bj, bj + 6, -3, -1, COL.deep); if (lod > 1 && r() < .3) gbox(f, bi + 2.6, bi + 3.4, bj, bj + 7, -1, -.2, COL.bone); continue; }
      const t = terr(d), h = 1 + t * 2 + (r() < .08 ? 2 : 0), col = t > 1 ? COL.steel : t ? COL.mid : COL.slate;
      if (lod > 1) { nbox(f, bi, bi + 6, bj, bj + 6, -2, h, col, K_SOLID, 1); gbox(f, bi + 1.2, bi + 4.8, bj + 1.2, bj + 4.8, h, h + .3, COL.dark); }
      else gbox(f, bi, bi + 6, bj, bj + 6, -2, h, col);
      if (lod > 1) {
        const q = r();
        if (q < .22) for (let v = 0; v < 3; v++) gbox(f, bi + 1 + v * 1.6, bi + 2 + v * 1.6, bj + 1.5, bj + 4.5, h + .3, h + 1.1, COL.dark);
        else if (q < .34) { const H = 5 + r() * 10; KB = h - 1; building(f, bi + .8, bi + 5.2, bj + .8, bj + 5.2, H, COL.light, 2, { levels: 2, notch: 0, storey: 3 }); KB = 0; }
        else if (q < .42) topLamp(f, ci - .3, cj - .3, h + .3);
        if (h >= 2 && rs() < .5) roofProps(f, bi + 1.2, bi + 4.8, bj + 1.2, bj + 4.8, h + .3, 2);
        if (h >= 3 && rs() < .45) flatSign(f, wallOf(rs() * 4 | 0, bi, bi + 6, bj, bj + 6), bi + 3 + (rs() - .5) * 2, Math.max(.2, h - 2.4), 2, false, h - .2);   // a sign on the block
      }
    } });
    lanesGrid(-154 + 20.5, 21, 42, 6, 14, .5); for (const f of [4, 2, 5, 3]) { lane(f, 'j', -7, -150, -40, 16); lane(f, 'j', 7, -150, -40, 16); }
    for (const f of [4, 2, 5, 3]) for (let a = -156; a < 156; a += 6) {         // the spine
      const d = gdir(f, 0, a + 3); if (!seen(d) || angTo(d, HDIR) < .2) continue;
      const hh = 9 + ((a / 6 | 0) % 3 === 0 ? 5 : 0), lod = lodOf(d);
      nbox(f, -3, 3, a, a + 5, -1, hh, COL.light, lod > 1 ? K_WIN : K_SOLID, lod > 1 ? 1 : 0); gbox(f, -4.2, 4.2, a, a + 5, -1, 4, COL.mid);
      if (lod > 1) { gbox(f, -3.3, 3.3, a + .5, a + 1, hh - 1.5, hh - 1, COL.bone); gbox(f, -.4, .4, a + 1, a + 4, hh, hh + 1.2, COL.dark);
        if (rs() < .5) flatSign(f, wallOf(rs() < .5 ? 0 : 1, -3, 3, a, a + 5), a + 2.5, 4.4, 2.6, true, hh - 1.6); }       // banners down the spine
    }
    const f = 4;
    for (let s = 0; s < 4; s++) nbox(f, -33 + s * 3, 33 - s * 3, -33 + s * 3, 33 - s * 3, s ? s * 3 - 3 : -1.5, s * 3 + 3, s % 2 ? COL.steel : COL.mid, K_WIN, 1);
    KB = 11; const top = 11 + building(f, -14, 14, -14, 14, 32, COL.light, 2, { levels: 4, storey: 4, notch: 2, ledge: true, finP: .9 }); KB = 0;
    for (let v = 0; v < 6; v++) gbox(f, -12 + v * 4, -10 + v * 4, -22, -18, 12, 15, COL.dark);
    for (let w = 0; w < 14; w++) lamp(f, 'j-', -14, -12 + (w % 7) * 3.6, 16 + (w / 7 | 0) * 5, .6);
    gbox(f, -1, 1, -1, 1, top, top + 10, COL.bone); topLamp(f, -.3, -.3, top + 10);
    plateJ('code', -14, 7, 21, 7, PAINT); plateJ('vk', -33, 20, 6.5, 2.4, hex('#9AA1B0'));
    return top;
  },
  /* the fly-by: three satellites the camera drops past, each built just before it gets there */
  orbital() {
    [[3.0, 1, 22, 9], [4.4, -1, 18, -6], [5.7, 1, 26, 4]].forEach(([t, side, d, h], n) => {
      const s = shotAt('play', t), f = unit(sub(s.T, s.E)), rt = unit(cross(f, s.up)), u = cross(rt, f);
      const Q = add(s.E, add(mul(rt, side * d), mul(u, h)));
      VOFF = timedOff(Q);
      const Y = unit(Q), X = unit(cross(Y, [.3, .2, .93])), Z = cross(X, Y), sat = { o: Q, up: Y, e: X, n: Z, L: ([x, y, z]) => add(Q, add(add(mul(X, x), mul(Y, y)), mul(Z, z))) };
      lbox(sat, [0, 0, 0], [5, 4, 4], COL.bone); lbox(sat, [0, 2.4, 0], [3, .8, 3], COL.mid); lbox(sat, [0, -2.4, 0], [2, .8, 2], COL.dark);
      for (const sx of [-1, 1]) {
        beam(sat, [sx * 2.5, 0, 0], [sx * 5, 0, 0], .4, COL.steel);
        for (let p = 0; p < 3; p++) lbox(sat, [sx * (6.6 + p * 4.2), 0, 0], [4, .3, 6], p % 2 ? COL.steel : COL.mid);
      }
      cyl(sat, 0, 2.6, 2.2, 2.6, 3.1, COL.light, 14); cyl(sat, 0, 2.6, 1.2, 3.1, 3.6, COL.light, 12); beam(sat, [0, 3.6, 2.6], [0, 6, 2.6], .2, COL.bone);
      topLampAt(sat.L([0, 6.1, 2.6]), Y);
    });
  } },
/* ---------- 04 · Canyon (Mathematic) ---------- */
{ id: 'mth', name: 'Canyon', num: '04', code: 'MTH-22', vk: '撮影舞台', date: '2022.01 — 2022.06 · 04', title: 'MATHEMATIC STUDIO',
  cam: [-4, -134, 60], yaw: .2, aim: .56, far: [-26, -92], seed: 51, logoS: .62,
  build() {
    /* a plateau 12 cells high cut into blocks by canyons on great circles: i every 44 (8 wide), j every 56 (10 wide), centred on the hero */
    const PH = 12, ci0 = 4, cj0 = 5;
    eachFace(f => {
      for (let I = -176; I < 176; I += 44) for (let J = -168; J < 168; J += 56) {
        const i0 = Math.max(-157, I + ci0), i1 = Math.min(157, I + 44 - ci0), j0 = Math.max(-157, J + cj0), j1 = Math.min(157, J + 56 - cj0);
        if (i1 - i0 < 4 || j1 - j0 < 4) continue;
        const d = gdir(f, (i0 + i1) / 2, (j0 + j1) / 2); if (!seen(d)) continue;
        const lod = lodOf(d), ph = PH + Math.round(vnoise(d, 5) * 3) * 2;
        if (f === 4 && i0 < 0 && i1 > 0 && j0 < 0 && j1 > 0) continue;
        /* the canyon walls are mega facades: storeys of windows with recessed slots, terraces stepping down into the canyon */
        if (lod > 1) {
          let y = -1.5; while (y < ph - .5) { const s = Math.min(3, ph - y); nbox(f, i0, i1, j0, j1, y, y + s, COL.steel, K_WIN, 2); y += s; if (y < ph - 1) { nbox(f, i0 + .4, i1 - .4, j0 + .4, j1 - .4, y, y + 1, COL.deep, K_SOLID, 2); y += 1; } }
          gbox(f, i0 - .4, i1 + .4, j0 - .4, j1 + .4, ph, ph + .5, COL.bone);
          gbox(f, i0 - 2, i1 + 2, j0 - 2, j1 + 2, -1.5, 2, COL.mid);                    // the terrace at the canyon floor
          KB = ph - .5; district(f, i0 + 2, i1 - 2, j0 + 2, j1 - 2, .45, 8, 6, (ff, ci, cj) => ff === 4 && Math.abs(ci) < 27 && Math.abs(cj) < 27, [COL.light, COL.bone, COL.steel]); KB = 0;
          for (let x = i0; x < i1; x += 4) if (r() < .5) lamp(f, 'j-', j0 - 2, x, 2.1, .6);
          for (let sd = 0; sd < 4; sd++) { const W = wallOf(sd, i0, i1, j0, j1);                   // the canyon walls lined with signs
            for (let u = W.u0 + 3 + rs() * 6; u < W.u1 - 3; u += 7 + rs() * 9) { const q = rs();
              if (q < .4) flatSign(f, W, u, 2.5 + rs() * 2, 2.6, true, ph - .6); else if (q < .7) bladeSign(f, W, u, 2.5 + rs() * 2, 2.6, ph - .4); } }
        } else gbox(f, i0, i1, j0, j1, -1.5, ph, COL.steel, lod ? K_WIN : K_SOLID);
      }
      /* bridges across the canyons and lights along their floors */
      for (let I = -176 + 44; I < 176; I += 44) for (let J = -168; J < 168; J += 56) for (const jj of [J + 18, J + 36]) {
        const d = gdir(f, I, jj); if (!seen(d) || lodOf(d) < 2 || r() < .4 || Math.abs(jj) > 154 || Math.abs(I) > 154) continue;
        const k = 5 + (r() * 5 | 0); gbox(f, I - ci0 - .5, I + ci0 + .5, jj, jj + 2, k, k + 1.2, COL.bone, K_WIN); gbox(f, I - .4, I + .4, jj + .6, jj + 1.4, -1, k, COL.mid);
      }
      for (let I = -176 + 44; I < 176; I += 44) for (let J = -156; J < 156; J += 3) { const d = gdir(f, I, J); if (seen(d) && lodOf(d) > 1 && Math.abs(I) < 156 && r() < .6) topLamp(f, I - .3, J, 0, .5); }
    });
    eachFace(f => { for (let c = -132; c < 157; c += 44) for (let a = -150; a + 50 <= 152; a += 50) for (const o of [-2, 2]) if (r() < .8) lane(f, 'j', c + o, a, a + 50, 3 + r() * 7);
      for (let c = -112; c < 157; c += 56) for (let a = -150; a + 44 <= 152; a += 44) for (const o of [-2.5, 2.5]) if (r() < .7) lane(f, 'i', c + o, a, a + 44, 3 + r() * 7); });
    /* the hero: a gate tower straddling the canyon crossing */
    const f = 4;
    building(f, -22, -6, -22, -7, 22, COL.light, 2, { levels: 2, storey: 3, notch: 1 }); building(f, 6, 22, -22, -7, 22, COL.light, 2, { levels: 2, storey: 3, notch: 1 });
    building(f, -22, -6, 7, 22, 26, COL.light, 2, { levels: 2, storey: 3, notch: 1 }); building(f, 6, 22, 7, 22, 26, COL.light, 2, { levels: 2, storey: 3, notch: 1 });
    nbox(f, -22, 22, -22, 22, 24, 30, COL.bone, K_WIN, 2); gbox(f, -22.4, 22.4, -22.4, 22.4, 30, 30.6, COL.mid);
    KB = 29.6; const top = 29.6 + building(f, -12, 12, -12, 12, 22, COL.light, 2, { levels: 3, storey: 4, notch: 2, ledge: true, finP: 1 }); KB = 0;
    gbox(f, -1, 1, -1, 1, top, top + 9, COL.bone); topLamp(f, -.3, -.3, top + 9);
    plateJ('code', -22, 9, 27, 7, PAINT); plateJ('vk', -22, -15, 12, 2.4, PAINT);
    return top;
  },
  /* the fly-by: a field of cube debris the camera falls through, kept out of the reading view */
  orbital() {
    const OE = SHOT.orbit(), of = unit(sub(OE.T, OE.E));
    let placed = 0;
    for (let n = 0; n < 400 && placed < 70; n++) {
      const t = 2.1 + r() * 4.3, s = shotAt('play', t), f = unit(sub(s.T, s.E)), rt = unit(cross(f, s.up)), u = cross(rt, f);
      const a = r() * Math.PI * 2, d = 10 + r() * 40, Q = add(s.E, add(add(mul(rt, Math.cos(a) * d), mul(u, Math.sin(a) * d)), mul(f, (r() - .3) * 30)));
      if (pathDist(Q) < 8 || len(Q) < R + 60) continue;
      const toQ = sub(Q, OE.E); if (len(toQ) < 260 && dot(unit(toQ), of) > .72) continue;
      placed++; VOFF = timedOff(Q);
      const X = unit([r() - .5, r() - .5, r() - .5]), Y = unit(cross(X, [r() - .5, r() - .5, r() - .5])), Z = cross(X, Y);
      const nc = 2 + (r() * 5 | 0), sz = 1.5 + r() * 3.5;
      for (let c = 0; c < nc; c++) {
        const o = [(r() * 2 - 1) * sz, (r() * 2 - 1) * sz, (r() * 2 - 1) * sz].map(v => Math.round(v / (sz * .5)) * sz * .5), k = sz * (.4 + r() * .6);
        obox(add(Q, add(add(mul(X, o[0]), mul(Y, o[1])), mul(Z, o[2]))), X, Y, Z, [k, k * (.6 + r() * .6), k], [COL.light, COL.steel, COL.mid, COL.bone][r() * 4 | 0]);
      }
    }
  } },
/* ---------- 05 · Fins (Isart) ---------- */
{ id: 'isd', name: 'Fins', num: '05', code: 'ARK-20', vk: '階段教室', date: '2020.09 — 2025.06 · 05', title: 'ISART DIGITAL, PARIS',
  cam: [-70, -136, 100], yaw: .2, aim: .4, far: [-26, -92], seed: 67,
  build() {
    /* rows of colossal radiator fins on great circles, crenellated tops, a slot every five cells; pump stations between */
    eachFace(f => { for (let I = -152; I < 152; I += 9) {
      for (let J = -156; J < 150; J += 44) {
        const d = gdir(f, I, J + 20); if (!seen(d) || angTo(d, HDIR) < .27) continue;
        const lod = lodOf(d), H = 12 + Math.round((Math.sin(I * .05 + f) * .5 + .5) * 12 + vnoise(d, 6) * 6), col = (I / 9 | 0) % 3 === 0 ? COL.bone : COL.light;
        if (lod > 1) {
          gbox(f, I - .6, I + .6, J, J + 40, -1, H - 1, col);
          for (let a = J; a < J + 40; a += 4) gbox(f, I - .6, I + .6, a, a + 2, H - 1, H, col);
          for (let y = 5; y < H - 2; y += 5) gbox(f, I - .9, I + .9, J, J + 40, y, y + .4, COL.mid);
          if (H > 12 && rs() < .6) { const uc = J + 4 + rs() * 32, n = signWord(), lk = signLook(), paint = rs() < .6;   // painted on both faces of the fin, as on a hull
            for (const sd of [0, 1]) flatSign(f, wallOf(sd, I - .6, I + .6, J, J + 40), uc, 3, 3.8, true, H - 1.5, !paint, n, lk); }
          if (H > 12 && rs() < .7) for (const sd of [3, 2]) flatSign(f, wallOf(sd, I - 1.9, I + 1.9, J, J + 40), I, 2 + rs() * 3, 2.7, true, H - .8);   // plates on the fin's ends, facing down the rows
          gbox(f, I - 2, I + 2, J, J + 40, -1, 1, COL.dark);
          if (r() < .3) building(f, I + 2.6, I + 6.4, J + 6 + r() * 26, J + 10 + r() * 26, 3 + r() * 5, COL.steel, 2, { levels: 1, notch: 0, storey: 3, fins: false });
          if (r() < .5) gbox(f, I + 3, I + 3.8, J, J + 40, .6, 1.4, COL.bone);
        } else gbox(f, I - .6, I + .6, J, J + 40, -1, lod ? H : H * .6, col);
      }
    } });
    eachFace(f => { for (let I = -152; I < 152; I += 9) for (let J = -156; J < 150; J += 44) if (r() < .4) lane(f, 'j', I + 4.5, J, J + 40, 4 + r() * 7); });
    /* collector halls across the fins */
    eachFace(f => { for (let J = -134; J < 150; J += 44) for (let I = -150; I < 150; I += 36) {
      const d = gdir(f, I, J); if (!seen(d) || angTo(d, HDIR) < .3) continue;
      building(f, I, I + 30, J - 4, J + 2, 8, COL.mid, lodOf(d), { levels: 1, storey: 3, notch: 1, fins: false });
    } });
    /* the hero: a crown tower ringed by radial fins */
    const f = 4, fr = frame(f, 0, 0);
    gbox(f, -26, 26, -26, 26, -1.5, 2, COL.dark); gbox(f, -48, 48, -48, 48, -1.5, .4, COL.slate);
    for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2, pi = Math.cos(t) * 40, pj = Math.sin(t) * 40; gbox(f, pi - 1.2, pi + 1.2, pj - 1.2, pj + 1.2, 0, 6, COL.bone); topLamp(f, pi - .3, pj - .3, 6); }
    const top = building(f, -11, 11, -11, 11, 60, COL.light, 2, { levels: 4, storey: 4, notch: 2, ledge: true, finP: 1 });
    for (let a = 0; a < 20; a++) {
      const t = a / 20 * Math.PI * 2, dir = add(mul(fr.e, Math.cos(t)), mul(fr.n, Math.sin(t))), tg = cross(fr.up, dir), h = 22 + (a % 2) * 8;
      obox(add(fr.o, add(mul(dir, 18), mul(fr.up, h / 2))), dir, fr.up, tg, [5, h / 2, .5], a % 2 ? COL.bone : COL.light);
      obox(add(fr.o, add(mul(dir, 18), mul(fr.up, h + .6))), dir, fr.up, tg, [3, .6, .7], COL.mid);
    }
    gbox(f, -1, 1, -1, 1, top, top + 10, COL.bone); topLamp(f, -.3, -.3, top + 10);
    plateJ('code', -11, 5, 6, 6, PAINT); plateJ('vk', -11, 6, 26, 2, PAINT);
    return top;
  },
  /* the fly-by: a belt of square mirror panels around the planet that the dive cuts through */
  orbital() {
    const s0 = shotAt('play', 4.7), f0 = unit(sub(s0.T, s0.E)), u0 = cross(unit(cross(f0, s0.up)), f0);
    const Pm = add(s0.E, mul(u0, 13)), tv = unit(sub(shotAt('play', 4.8).E, shotAt('play', 4.6).E)), d0 = unit(Pm), side = unit(cross(d0, tv)), RB = len(Pm), NP = 150;
    const at = t => add(mul(d0, Math.cos(t) * RB), mul(side, Math.sin(t) * RB));
    let near = null, bd = 1e9; for (let p = 0; p < NP; p++) { const q = at(p / NP * Math.PI * 2), dd = pathDist(q); if (dd < bd && dd > 7) { bd = dd; near = q; } }
    VOFF = timedOff(near);
    const nrm = unit(cross(d0, side));
    for (let p = 0; p < NP; p++) {
      const t = p / NP * Math.PI * 2, Q = at(t); if (pathDist(Q) < 7 || p % 25 === 0) continue;
      const Y = unit(Q), Z = unit(add(mul(nrm, .8), mul(Y, .6))), X = unit(cross(Y, Z)), Y2 = cross(Z, X);
      obox(Q, X, Y2, Z, [4.6, 4.6, .3], COL.light);
      obox(add(Q, mul(Z, -.5)), X, Y2, Z, [5, .35, .4], COL.mid); obox(add(Q, mul(Z, -.5)), X, Y2, Z, [.35, 5, .4], COL.mid);
      if (p % 3 === 0) obox(add(Q, mul(Y2, -6.5)), X, Y2, Z, [.4, 2, .4], COL.steel);
    }
  } }
];

/* ================= timing the fly-bys to the arrival =================
   pathDist: how close the arrival's camera passes a point. timedOff: the ordering offset that makes a thing build about a
   second before the camera reaches it (the front's natural order is its angle from the origin minus its height term). */
function pathDist(Q) { let b = 1e9; for (let t = 0; t <= T_DIVE; t += .1) b = Math.min(b, len(sub(shotAt('play', t).E, Q))); return b; }
function timedOff(Q) {
  let b = 1e9, tb = 4; for (let t = 0; t <= T_DIVE; t += .05) { const d = len(sub(shotAt('play', t).E, Q)); if (d < b) { b = d; tb = t; } }
  const want = P0 + (Math.max(.5, tb - 1.75) - T0) * SPEED, nat = angTo(unit(Q), HDIR) - Math.min(40, len(Q) - R) * CELL / R * 1.5;
  return want - nat;
}
function topLampAt(p, n, s = .5) { const X = unit(cross(n, [.2, .9, .3])), Z = cross(X, n); G.quad(add(p, add(mul(X, -s), mul(Z, -s))), add(p, add(mul(X, s), mul(Z, -s))), add(p, add(mul(X, s), mul(Z, s))), add(p, add(mul(X, -s), mul(Z, s))), COL.ink, K_LAMP, r(), sub(p, n), true); }

/* ================= the ground ================= */
function ground() { const NS = FAR ? 28 : LITE ? 40 : 72; for (let f = 0; f < 6; f++) for (let a = 0; a < NS; a++) for (let b = 0; b < NS; b++) {
  const i0 = -IMAX + 2 * IMAX * a / NS, i1 = -IMAX + 2 * IMAX * (a + 1) / NS, j0 = -IMAX + 2 * IMAX * b / NS, j1 = -IMAX + 2 * IMAX * (b + 1) / NS;
  G.quad(gp(f, i0, j0, 0), gp(f, i1, j0, 0), gp(f, i1, j1, 0), gp(f, i0, j1, 0), COL.dark, K_GROUND, 0, [0, 0, 0], true);
} }


/* ================= the camera: authored shots, in the planet's own frame =================
   far: the arrival, the whole planet in two thirds of the frame. orbit: the reading view, low over the hero, the curved
   horizon above it, the hero on the right two thirds. play(t): out of the warp (0 - T_IN), the dive (T_IN - T_DIVE), then
   still (the page adds a drift). A planet with a path dives through its keys instead (Hermite through them). */
let PL = PLANETS[0], heroTop = 40;
const sm5 = t => { t = Math.min(1, Math.max(0, t)); return t * t * t * (t * (6 * t - 15) + 10); };
const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const T_IN = 1.8, T_DIVE = 7.4, SPEED = .168, P0 = -.3, LAG = .18, T0 = .4;
const SHOT = {
  far: () => { const d = gdir(4, PL.far[0], PL.far[1]); return { E: mul(d, R * 4.9), T: mul(HDIR, R * .1), up: HDIR }; },
  orbit: () => {
    const E = gp(4, PL.cam[0], PL.cam[1], PL.cam[2]), up = unit(E), H = gp(HERO.f, HERO.i, HERO.j, heroTop * PL.aim);
    const f = unit(sub(H, E)), a = PL.yaw, T = add(E, mul(add(mul(f, Math.cos(a)), mul(cross(up, f), Math.sin(a))), len(sub(H, E))));
    return { E, T, up };
  }
};
function herm(K, u) {
  const n = K.length; let i = 0; while (i < n - 2 && u > K[i + 1].t) i++;
  const A = K[i], B = K[i + 1], h = B.t - A.t, s = Math.min(1, Math.max(0, (u - A.t) / h));
  const tan = j => (j <= 0 || j >= n - 1) ? A.v.map(() => 0) : K[j + 1].v.map((x, c) => (x - K[j - 1].v[c]) / (K[j + 1].t - K[j - 1].t));
  const ma = tan(i), mb = tan(i + 1), s2 = s * s, s3 = s2 * s;
  return A.v.map((x, c) => (2 * s3 - 3 * s2 + 1) * x + (s3 - 2 * s2 + s) * h * ma[c] + (3 * s2 - 2 * s3) * B.v[c] + (s3 - s2) * h * mb[c]);
}
function shotAt(name, t) {
  const F = SHOT.far(), O = SHOT.orbit();
  if (name === 'far') return F;
  if (name === 'orbit') return O;
  if (t < T_IN) { const k = sm5(seg(t, 0, T_IN + .6)), dir = unit(F.E); return { E: mul(dir, R * (4.9 + (1 - k) * (1 - k) * 9)), T: F.T, up: F.up }; }
  const k0 = sm5(seg(T_IN, 0, T_IN + .6)), r0 = R * (4.9 + (1 - k0) * (1 - k0) * 9), u = seg(t, T_IN, T_DIVE);
  if (PL.path) {
    const E0 = mul(unit(F.E), r0), H = gp(HERO.f, HERO.i, HERO.j, heroTop * PL.aim);
    const E = herm([{ t: 0, v: E0 }, ...PL.path.map(([pu, i, j, k]) => ({ t: pu, v: gp(4, i, j, k) })), { t: 1, v: O.E }], u);
    const T = herm([{ t: 0, v: F.T }, ...PL.path.map(([pu]) => ({ t: pu, v: H })), { t: 1, v: O.T }], u);
    const e1 = sm5(seg(u, 0, .35));
    return { E, T, up: unit(add(mul(F.up, 1 - e1), mul(unit(E), e1))) };
  }
  const dA = unit(F.E), dB = unit(O.E), rB = len(O.E);
  const e1 = sm5(u), e2 = sm5(seg(u, .05, 1)), e3 = sm5(seg(u, 0, .85));
  const dir = slerp(dA, dB, e1), rr = r0 + (rB - r0) * (1 - Math.pow(1 - e2, 2.2));
  return { E: mul(unit(dir), rr), T: add(mul(F.T, 1 - e3), mul(O.T, e3)), up: unit(add(mul(F.up, 1 - e1), mul(unit(dir), e1))) };
}
/* the light: art-directed, from the upper left and a little behind the reading camera */
function keyLocal() { const o = SHOT.orbit(), f = unit(sub(o.T, o.E)), rt = unit(cross(f, o.up)); return unit(add(add(mul(rt, -.62), mul(o.up, .95)), mul(f, -.3))); }
/* where the spark should sit in the reading view: upper left, above the panel */
function sparkLocal() { const o = SHOT.orbit(), f = unit(sub(o.T, o.E)), rt = unit(cross(f, o.up)), u = cross(rt, f); return unit(add(f, add(mul(rt, -.33), mul(u, .21)))); }
function use(k, ht) { PL = PLANETS[k]; heroTop = ht; }

/* ================= build one planet ================= */
function buildPlanet(k, slots, lite, far) {
  use(k, 40); SLOT = slots || {}; LITE = !!lite; FAR = !!far; PROPS = [];
  const camG = gdir(HERO.f, PL.cam[0], PL.cam[1]);
  VIS = unit(add(HDIR, gdir(4, PL.far[0] * 1.6, PL.far[1] * 1.6))); DCTR = unit(slerp(HDIR, camG, .4));
  r = rng(PL.seed); rs = rng(PL.seed + 7); JIT = 0; PK = k; G = new Geo(); LG = []; LANES = []; KB = 0; VOFF = 0;
  ground(); heroTop = PL.build(); KB = 0;
  if (PL.orbital) { r = rng(PL.seed + 99); PL.orbital(); VOFF = 0; }
  const lanes = new Float32Array(LANES.length * 7); LANES.forEach(([a, b, L], n) => lanes.set([...a, ...b, L], n * 7));
  const out = G.out(!FAR), tris = G.tris; G = null;
  return { k, far: FAR, heroTop, tris, ...out, lanes: FAR ? new Float32Array(0) : lanes, LG: FAR ? [] : LG, props: new Float32Array(FAR ? [] : PROPS), key: keyLocal(), sparkDir: sparkLocal() };
}
return { K_SOLID, WORDS, WC, WP, R, CELL, MACRO, HERO, HDIR, PLANETS, T_IN, T_DIVE, SPEED, P0, LAG, T0, sm5, seg, add, sub, mul, dot, cross, len, unit, gp, gdir, slerp, hex, FRONTS, COL,
  buildPlanet, view: (k, ht, name, t) => { use(k, ht); return shotAt(name, t); }, key: (k, ht) => { use(k, ht); return keyLocal(); } };
})();
if (typeof window === 'undefined' && typeof importScripts === 'function') {
  self.onmessage = e => {
    const r = self.GEN.buildPlanet(e.data.k, e.data.slots, e.data.lite, e.data.far);
    self.postMessage(r, [r.P.buffer, r.N.buffer, r.C.buffer, r.O.buffer, r.I.buffer, r.lanes.buffer, r.CH.buffer, r.props.buffer]);
  };
}
