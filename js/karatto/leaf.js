/* カラット: the emblem. A momiji (Japanese maple) leaf built from cells: seven pointed lobes, a stem, dark veins
   along the lobes, a few dark and checkered modules, and the AI's yellow artery climbing from the stem to the upper
   right lobe. Generated once per grid size, so the same leaf works at 16 px on a tab and at 400 px on a wall.
   Cell codes: 0 empty, 1 light, 2 dark, 3 checker, 4 artery (yellow). */
const LOBES = [[90, 1.12, .48], [46, 1, .45], [134, 1, .45], [4, .9, .38], [176, .9, .38], [-38, .56, .3], [218, .56, .3]];
const cache = {};
const sd = n => { const x = Math.sin(n * 91.3 + 17.7) * 43758.5453; return x - Math.floor(x); };
function inTri(px, py, ax, ay, bx, by, cx, cy) { const d = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), u = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / d, v = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / d; return u >= 0 && v >= 0 && u + v <= 1; }
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - ax - t * dx, py - ay - t * dy); }

export function leafGrid(N = 31) {
  if (cache[N]) return cache[N];
  const g = [], cyo = -.2, cell = 2 / N;
  const tips = LOBES.map(([a, l]) => [Math.cos(a * Math.PI / 180) * l, Math.sin(a * Math.PI / 180) * l + cyo]);
  const art0 = [-.14, -.6], art1 = tips[1];                                     // the artery: from below the heart to the upper-right tip
  for (let j = 0; j < N; j++) { const row = []; for (let i = 0; i < N; i++) {
    const x = -1 + (i + .5) * cell, y = 1 - (j + .5) * cell;
    let inside = Math.hypot(x, y - cyo) < .34, vein = false;
    for (const [a, l, w] of LOBES) { const r = a * Math.PI / 180, tx = Math.cos(r) * l, ty = Math.sin(r) * l + cyo, nx = -Math.sin(r) * w, ny = Math.cos(r) * w;
      if (inTri(x, y, nx, ny + cyo, -nx, -ny + cyo, tx, ty)) inside = true;
      if (N >= 23 && segDist(x, y, 0, cyo, tx, ty) < cell * .4 && Math.hypot(x, y - cyo) > .18) vein = true; }
    const stem = Math.abs(x - .02) < cell * .6 && y < cyo - .25 && y > -.9;
    if (stem) { row.push(1); continue; }
    if (!inside) { row.push(0); continue; }
    const s = sd(i * 31 + j * 7 + N);
    let c = vein ? 2 : s < .08 ? 2 : s < .12 ? 3 : 1;
    if (segDist(x, y, art0[0], art0[1], art1[0], art1[1]) < cell * .75) c = 4;
    row.push(c); } g.push(row); }
  /* the artery as a staircase: keep it two cells wide at most per row */
  return cache[N] = g;
}
const COL = { 1: '#A3ABBA', 2: '#2A2E36', 4: '#FFE600' };
/* an SVG of the leaf. mono: every cell in currentColor, the artery still yellow (for small marks on dark UIs) */
/* Jeff's own pixel leaf (Nov 27): the emblem is his image, as is (karatto/leaf.png); the procedural grid above is kept unused */
const SRC = new URL('../../karatto/leaf.png?v=20', import.meta.url).href, SRC64 = new URL('../../karatto/leaf-64.png?v=20', import.meta.url).href;
let IMG = null; const img = () => { if (!IMG && typeof Image !== 'undefined') { IMG = new Image(); IMG.src = SRC; } return IMG; };
export function leafSVG(size = 24) { return `<img class="leaf" src="${size <= 64 ? SRC64 : SRC}" width="${size}" height="${size}" alt="" style="image-rendering:auto;display:inline-block;vertical-align:middle">`; }
/* on a canvas: the same footprint as before (N cells of s pixels) */
export function drawLeaf(cx, x, y, s, { N = 31, alpha = 1 } = {}) { const i = img(); if (!i || !i.complete || !i.naturalWidth) return; cx.save(); cx.globalAlpha = alpha; cx.drawImage(i, x, y, N * s, N * s); cx.restore(); }
export function leafFavicon() { try { const l = document.querySelector('link[rel=icon]') || document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'icon' })); l.href = SRC64; } catch (e) {} }
